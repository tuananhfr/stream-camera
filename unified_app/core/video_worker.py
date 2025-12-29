"""
Video Source Worker module - handles detection from video files (MP4, AVI, etc.)
"""
import os
import time
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from queue import Queue

import cv2
import numpy as np

from .detector import get_detector, get_ocr_service, crop_plate_image, detect_plates_two_stage
from .config import load_config
from .db import insert_ocr_log, init_db
from .plate_tracker import PlateTracker
from .events import get_event_emitter
from .ocr_sender import send_ocr_to_central
from .camera_worker import normalize_plate_text, is_valid_vietnamese_plate


@dataclass
class VideoSourceWorker:
    """
    Video file processing worker - similar to CameraWorker but for video files
    Processes video frame by frame, runs detection + OCR
    """

    video_id: str  # Unique ID for this video job
    video_path: str  # Path to video file
    target_fps: float = 5.0  # Processing FPS
    vid_stride: int = 3  # Process 1 out of every 3 frames

    running: bool = field(default=False, init=False)
    processor_thread: Optional[threading.Thread] = field(default=None, init=False)

    frame_counter: int = field(default=0, init=False)
    latest_frame: Optional[np.ndarray] = field(default=None, init=False)
    latest_detections: List[dict] = field(default_factory=list, init=False)
    latest_cropped_image: Optional[np.ndarray] = field(default=None, init=False)
    last_update_ts: float = field(default=0.0, init=False)

    # OCR queue và result
    ocr_queue: Queue = field(default_factory=Queue, init=False)
    ocr_thread: Optional[threading.Thread] = field(default=None, init=False)
    latest_ocr_text: str = field(default="", init=False)
    latest_ocr_timestamp: float = field(default=0.0, init=False)
    plate_tracker: Optional[PlateTracker] = field(default=None, init=False)

    # Video info
    total_frames: int = field(default=0, init=False)
    current_frame_idx: int = field(default=0, init=False)
    video_fps: float = field(default=0.0, init=False)
    is_completed: bool = field(default=False, init=False)

    # Results storage
    detected_plates: List[dict] = field(default_factory=list, init=False)  # All detected plates

    # Tránh lưu trùng quá nhiều lần cùng 1 biển số
    last_saved_plate: str = field(default="", init=False)
    last_saved_ts: float = field(default=0.0, init=False)

    stats: Dict = field(
        default_factory=lambda: {
            "fps": 0.0,
            "errors": 0,
            "last_err": "",
            "total_votes": 0,
            "finalized_plates": 0,
            "progress": 0.0,  # Processing progress (0-100%)
        },
        init=False,
    )

    def start(self):
        if self.running:
            return

        # Check if video file exists
        if not os.path.exists(self.video_path):
            logging.error(f"[{self.video_id}] Video file not found: {self.video_path}")
            return

        logging.info(f"[{self.video_id}] Starting video processing: {self.video_path}")

        # Đảm bảo DB đã được khởi tạo
        try:
            init_db()
        except Exception as e:
            logging.error(f"[{self.video_id}] Failed to init DB: {e}")

        # Khởi tạo Plate Tracker
        cfg = load_config()
        voting_cfg = cfg.get("voting", {})

        self.plate_tracker = PlateTracker(
            window_seconds=voting_cfg.get("window_seconds", 1.5),
            min_votes=voting_cfg.get("min_votes", 2),
            similarity_threshold=voting_cfg.get("similarity_threshold", 0.85)
        )

        self.running = True
        self.is_completed = False

        # Processor: đọc video và detect từng frame
        self.processor_thread = threading.Thread(target=self._process_loop, daemon=True)
        self.processor_thread.start()

        # OCR: xử lý queue các crop cần OCR
        self.ocr_thread = threading.Thread(target=self._ocr_loop, daemon=True)
        self.ocr_thread.start()

    def stop(self):
        self.running = False
        # Clear OCR queue
        while not self.ocr_queue.empty():
            try:
                self.ocr_queue.get_nowait()
            except:
                pass
        for th in (self.processor_thread, self.ocr_thread):
            if th and th.is_alive():
                th.join(timeout=1.0)
        logging.info(f"[{self.video_id}] stopped")

    def _process_loop(self):
        """Main processing loop - reads video and runs detection"""
        cap = None
        try:
            cap = cv2.VideoCapture(self.video_path)
            if not cap.isOpened():
                logging.error(f"[{self.video_id}] Cannot open video file")
                self.stats["last_err"] = "cannot_open_video"
                return

            # Get video info
            self.total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            self.video_fps = cap.get(cv2.CAP_PROP_FPS)
            logging.info(f"[{self.video_id}] Video info: {self.total_frames} frames, {self.video_fps} fps")

            detector = get_detector()
            frame_idx = 0
            detect_count = 0
            t_start = time.time()

            while self.running:
                ret, frame = cap.read()
                if not ret or frame is None:
                    # Video ended
                    logging.info(f"[{self.video_id}] Video processing completed")
                    self.is_completed = True
                    break

                frame_idx += 1
                self.current_frame_idx = frame_idx

                # Update progress
                if self.total_frames > 0:
                    self.stats["progress"] = (frame_idx / self.total_frames) * 100

                # Process every frame (no skipping - same as test script)
                # REMOVED frame skipping to ensure we don't miss detections

                # Run 2-stage detection
                try:
                    # 🔥 2-STAGE DETECTION: Detect vehicles first, then plates (with fallback)
                    plates_with_vehicles = detect_plates_two_stage(
                        frame,
                        vehicle_conf=0.5,
                        plate_conf=0.4,
                        fallback_direct=True  # Fallback to direct detection if no vehicles
                    )

                    detect_count += 1
                    detections = []
                    cropped_image = None
                    drawn = frame.copy()

                    for (plate_x1, plate_y1, plate_x2, plate_y2, plate_conf, plate_cls, vehicle_bbox) in plates_with_vehicles:
                        # Draw vehicle box (blue) if available
                        if vehicle_bbox is not None:
                            veh_x1, veh_y1, veh_x2, veh_y2 = vehicle_bbox
                            cv2.rectangle(drawn, (int(veh_x1), int(veh_y1)), (int(veh_x2), int(veh_y2)), (255, 0, 0), 2)
                            cv2.putText(drawn, "Vehicle", (int(veh_x1), int(veh_y1) - 5),
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

                        # Draw plate box (green)
                        cv2.rectangle(drawn, (int(plate_x1), int(plate_y1)), (int(plate_x2), int(plate_y2)), (0, 255, 0), 2)
                        cv2.putText(drawn, f"Plate {plate_conf:.2f}", (int(plate_x1), int(plate_y1) - 5),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                        detections.append({
                            "bbox": [int(plate_x1), int(plate_y1), int(plate_x2), int(plate_y2)],
                            "conf": float(plate_conf),
                            "vehicle_bbox": vehicle_bbox
                        })

                        # Crop plate image (lấy cái đầu tiên)
                        if cropped_image is None:
                            cropped_image = crop_plate_image(frame, [int(plate_x1), int(plate_y1), int(plate_x2), int(plate_y2)])

                    # Update latest frame and detections
                    self.latest_frame = drawn
                    self.latest_detections = detections
                    self.latest_cropped_image = cropped_image
                    self.last_update_ts = time.time()

                    # Nếu có detection, đẩy vào OCR queue
                    if cropped_image is not None:
                        self.ocr_queue.put((cropped_image, time.time()))

                    # Calculate FPS
                    elapsed = time.time() - t_start
                    if elapsed > 0:
                        self.stats["fps"] = detect_count / elapsed

                except Exception as e:
                    logging.error(f"[{self.video_id}] Detection error: {e}")
                    self.stats["errors"] += 1
                    self.stats["last_err"] = str(e)

            # Mark as completed
            self.is_completed = True
            logging.info(
                f"[{self.video_id}] Processing finished. "
                f"Detected {len(self.detected_plates)} unique plates"
            )

        except Exception as e:
            logging.error(f"[{self.video_id}] Process loop error: {e}")
            self.stats["last_err"] = str(e)
        finally:
            if cap:
                cap.release()
            self.running = False

    def _ocr_loop(self):
        """OCR processing loop - similar to CameraWorker"""
        ocr_service = get_ocr_service()
        if not ocr_service:
            logging.warning(f"[{self.video_id}] OCR service not available")
            return

        while self.running or not self.ocr_queue.empty():
            try:
                crop_img, timestamp = self.ocr_queue.get(timeout=0.5)
            except:
                continue

            try:
                # Run OCR (YOLO OCR)
                raw_text = ocr_service.recognize(crop_img)
                if not raw_text:
                    continue

                normalized = normalize_plate_text(raw_text)

                if not normalized or not is_valid_vietnamese_plate(normalized):
                    continue

                # Update latest OCR
                self.latest_ocr_text = normalized
                self.latest_ocr_timestamp = timestamp

                # Add detection to tracker (requires bbox)
                if self.plate_tracker and self.latest_detections:
                    # Get bbox from latest detection
                    first_det = self.latest_detections[0]
                    bbox = first_det["bbox"]

                    # add_detection() returns finalized plate or None
                    finalized_plate = self.plate_tracker.add_detection(bbox, normalized)
                    self.stats["total_votes"] += 1

                    # If finalized
                    if finalized_plate:
                        plate_text = finalized_plate
                        # Get confidence from detection
                        confidence = first_det.get("conf", 0.0)
                        # Vote count from tracker stats
                        vote_count = self.stats["total_votes"]

                        # Tránh lưu trùng (cooldown 5 giây)
                        if (
                            plate_text != self.last_saved_plate
                            or (timestamp - self.last_saved_ts) > 5.0
                        ):
                            logging.info(
                                f"[{self.video_id}] Finalized plate: {plate_text} "
                                f"(confidence={confidence:.2f}, votes={vote_count})"
                            )

                            # Save to DB
                            try:
                                insert_ocr_log(
                                    camera_id=self.video_id,
                                    plate_text=plate_text,
                                    confidence=confidence,
                                )
                            except Exception as e:
                                logging.error(f"[{self.video_id}] Failed to save to DB: {e}")

                            # Add to detected plates list
                            self.detected_plates.append({
                                "plate": plate_text,
                                "confidence": confidence,
                                "votes": vote_count,
                                "timestamp": timestamp,
                                "frame_idx": self.current_frame_idx
                            })

                            # Send to central (if configured)
                            try:
                                send_ocr_to_central(plate_text, self.video_id)
                            except Exception as e:
                                logging.error(f"[{self.video_id}] Failed to send to central: {e}")

                            # Emit event
                            get_event_emitter().emit(
                                "new_ocr_result",
                                {
                                    "camera_id": self.video_id,
                                    "plate_text": plate_text,
                                    "confidence": confidence,
                                    "vote_count": vote_count,
                                },
                            )

                            self.last_saved_plate = plate_text
                            self.last_saved_ts = timestamp
                            self.stats["finalized_plates"] += 1

            except Exception as e:
                logging.error(f"[{self.video_id}] OCR loop error: {e}")

    def get_frame(self):
        """Get latest processed frame with detections"""
        return self.latest_frame, self.latest_detections

    def get_stats(self):
        """Get processing statistics"""
        return {
            **self.stats,
            "current_frame": self.current_frame_idx,
            "total_frames": self.total_frames,
            "is_completed": self.is_completed,
            "detected_plates_count": len(self.detected_plates),
        }

    def get_results(self):
        """Get all detected plates"""
        return self.detected_plates
