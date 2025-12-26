"""
Camera Worker module - handles RTSP reading, detection, and OCR
"""
import os
import time
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from queue import Queue
import re

import cv2
import numpy as np

from .detector import get_detector, get_ocr_service, crop_plate_image
from .config import load_config
from .db import insert_ocr_log, init_db
from .plate_tracker import PlateTracker
from .events import get_event_emitter


def normalize_plate_text(text: str) -> str:
    """Chuẩn hóa biển số: bỏ khoảng trắng, bỏ dấu chấm, upper-case."""
    if not text:
        return ""
    return (
        text.strip()
        .upper()
        .replace(" ", "")
        .replace(".", "")
    )


def is_valid_vietnamese_plate(text: str) -> bool:
    """
    Kiểm tra text có phù hợp format biển số Việt Nam.

    Hỗ trợ:
    - Ô tô: 29A12345, 29AB12345, 29A-12345, 29AB-12345
    - Công vụ: 123A12345, 123AB12345, 123A-12345
    - Xe máy: 29A112345, 29A1-12345
    """
    if not text or len(text) < 7:
        return False

    clean = normalize_plate_text(text)
    if not clean:
        return False

    # Yêu cầu bắt đầu bằng đúng 2 chữ số (biển VN chuẩn)
    if not clean[:2].isdigit():
        return False

    patterns = [
        # Ô tô: 2 số + 1-2 chữ + 4-6 số, có thể có dấu -
        r"^\d{2}[A-Z]{1,2}\d{4,6}$",
        r"^\d{2}[A-Z]{1,2}-\d{4,6}$",
        # Xe máy: 2 số + 1 chữ + 1 số + 4-5 số (dấu - tùy chọn)
        r"^\d{2}[A-Z]\d-?\d{4,5}$",
    ]

    for pattern in patterns:
        if re.match(pattern, clean):
            return True

    return False


@dataclass
class CameraWorker:
    """
    Real-time oriented worker:
    - Reader thread: đọc RTSP liên tục, luôn ghi đè self.raw_frame (không xếp hàng).
    - Detector thread: định kỳ lấy raw_frame mới nhất để detect + draw.
    - OCR thread: xử lý queue các crop cần OCR.
    =>
    - FPS phụ thuộc CPU/model
    - Độ trễ ~ thời gian detect 1 frame (không tích 10-15s).
    """

    camera_id: str
    url: str
    target_fps: float = 5.0

    running: bool = field(default=False, init=False)
    reader_thread: Optional[threading.Thread] = field(default=None, init=False)
    detector_thread: Optional[threading.Thread] = field(default=None, init=False)

    raw_frame: Optional[np.ndarray] = field(default=None, init=False)
    latest_frame: Optional[np.ndarray] = field(default=None, init=False)
    latest_detections: List[dict] = field(default_factory=list, init=False)
    latest_cropped_image: Optional[np.ndarray] = field(default=None, init=False)  # Ảnh crop từ detection mới nhất
    last_update_ts: float = field(default=0.0, init=False)
    
    # OCR queue và result
    ocr_queue: Queue = field(default_factory=Queue, init=False)  # Queue các crop cần OCR
    ocr_thread: Optional[threading.Thread] = field(default=None, init=False)
    latest_ocr_text: str = field(default="", init=False)  # OCR result mới nhất
    latest_ocr_timestamp: float = field(default=0.0, init=False)  # Timestamp của OCR result
    # Voting system để tăng độ chính xác OCR
    plate_tracker: Optional[PlateTracker] = field(default=None, init=False)

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
        },
        init=False,
    )

    def start(self):
        if self.running:
            return
        logging.info(f"[{self.camera_id}] start detection requested (target_fps={self.target_fps})")
        # Đảm bảo DB đã được khởi tạo
        try:
            init_db()
        except Exception as e:
            logging.error(f"[{self.camera_id}] Failed to init DB: {e}")

        # Khởi tạo Plate Tracker với config từ config.yaml
        cfg = load_config()
        voting_cfg = cfg.get("voting", {})

        self.plate_tracker = PlateTracker(
            window_seconds=voting_cfg.get("window_seconds", 1.5),
            min_votes=voting_cfg.get("min_votes", 2),
            similarity_threshold=voting_cfg.get("similarity_threshold", 0.85)
        )
        logging.info(
            f"[{self.camera_id}] Voting system enabled: "
            f"window={voting_cfg.get('window_seconds', 1.5)}s, "
            f"min_votes={voting_cfg.get('min_votes', 2)}, "
            f"similarity={voting_cfg.get('similarity_threshold', 0.85)}"
        )

        self.running = True
        # Reader: luôn cập nhật raw_frame mới nhất
        self.reader_thread = threading.Thread(target=self._read_loop, daemon=True)
        self.reader_thread.start()
        # Detector: định kỳ lấy raw_frame hiện tại để detect
        self.detector_thread = threading.Thread(target=self._detect_loop, daemon=True)
        self.detector_thread.start()
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
        for th in (self.reader_thread, self.detector_thread, self.ocr_thread):
            if th and th.is_alive():
                th.join(timeout=1.0)
        logging.info(f"[{self.camera_id}] stopped")

    # ---- Reader: always keep freshest frame ----
    def _read_loop(self):
        cap = None
        consecutive_errors = 0
        max_consecutive_errors = 10
        
        try:
            while self.running:
                if cap is None or not cap.isOpened():
                    cap = self._open_capture()
                    if cap is None:
                        logging.error(f"[{self.camera_id}] cannot open RTSP, retry in 1s")
                        time.sleep(1.0)
                        continue
                    consecutive_errors = 0  # Reset khi mở lại thành công

                try:
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        consecutive_errors += 1
                        self.stats["errors"] += 1
                        self.stats["last_err"] = "read_failed"
                        
                        # Nếu lỗi liên tục quá nhiều, đóng và mở lại
                        if consecutive_errors >= max_consecutive_errors:
                            logging.warning(f"[{self.camera_id}] Too many consecutive errors, reconnecting...")
                            if cap:
                                cap.release()
                            cap = None
                            time.sleep(1.0)
                            continue
                        
                        time.sleep(0.05)
                        continue
                    
                    # Validate frame: kiểm tra shape và data
                    if frame.size == 0 or len(frame.shape) != 3 or frame.shape[2] != 3:
                        consecutive_errors += 1
                        self.stats["errors"] += 1
                        self.stats["last_err"] = "invalid_frame"
                        if consecutive_errors >= max_consecutive_errors:
                            logging.warning(f"[{self.camera_id}] Invalid frames detected, reconnecting...")
                            if cap:
                                cap.release()
                            cap = None
                            time.sleep(1.0)
                            continue
                        continue
                    
                    # Frame hợp lệ, reset error counter
                    consecutive_errors = 0
                    
                    # Ghi đè frame mới nhất, bỏ frame cũ => giảm delay
                    self.raw_frame = frame
                    
                except Exception as e:
                    # Bỏ qua lỗi decode (như H.264 decode error)
                    consecutive_errors += 1
                    self.stats["errors"] += 1
                    self.stats["last_err"] = f"decode_error: {str(e)[:50]}"
                    if consecutive_errors < 5:  # Chỉ log 5 lỗi đầu để tránh spam
                        logging.debug(f"[{self.camera_id}] Frame decode error (ignored): {e}")
                    
                    if consecutive_errors >= max_consecutive_errors:
                        logging.warning(f"[{self.camera_id}] Too many decode errors, reconnecting...")
                        if cap:
                            cap.release()
                        cap = None
                        time.sleep(1.0)
                        continue
                    
                    time.sleep(0.05)
                    continue
                    
        finally:
            if cap:
                cap.release()

    # ---- Detector: process latest frame only ----
    def _detect_loop(self):
        detector = get_detector()
        detect_interval = 1.0 / max(self.target_fps, 0.1)  # giãn cách xử lý, không phải FPS camera
        last_detect = 0.0
        while self.running:
            now = time.time()
            if now - last_detect < detect_interval:
                time.sleep(0.01)
                continue

            frame = self.raw_frame
            if frame is None:
                time.sleep(0.01)
                continue

            # Validate frame trước khi detect
            try:
                if frame.size == 0 or len(frame.shape) != 3 or frame.shape[2] != 3:
                    time.sleep(0.01)
                    continue
            except Exception:
                time.sleep(0.01)
                continue

            last_detect = now

            # Detection với error handling
            try:
                detections = detector.detect_from_frame(frame, conf_threshold=0.25, iou_threshold=0.45)
                drawn = detector.draw_detections(frame, detections, color=(0, 255, 0), thickness=2)

                self.latest_frame = drawn
                self.latest_detections = detections
                self.last_update_ts = time.time()
                # FPS xấp xỉ theo khoảng cách 2 lần detect
                dt = max(self.last_update_ts - now, 1e-3)
                self.stats["fps"] = 1.0 / dt
                
                # Crop ảnh từ detection đầu tiên (nếu có) và queue vào OCR
                if detections:
                    first_det = detections[0]
                    cropped = crop_plate_image(frame, first_det.get("bbox", []))
                    if cropped is not None:
                        self.latest_cropped_image = cropped.copy()  # Copy để tránh bị thay đổi
                        # Queue vào OCR (mỗi crop là một task riêng, không bị lẫn)
                        try:
                            self.ocr_queue.put_nowait({
                                "image": cropped.copy(),  # Copy để đảm bảo không bị thay đổi
                                "timestamp": time.time(),
                                "detection_id": id(first_det)  # ID để track
                            })
                        except:
                            pass  # Queue đầy, bỏ qua (đã có task đang xử lý)
                    
            except Exception as e:
                # Bỏ qua lỗi detection (frame corrupt, model error, etc.)
                logging.debug(f"[{self.camera_id}] Detection error (ignored): {e}")
                self.stats["errors"] += 1
                self.stats["last_err"] = f"detect_error: {str(e)[:50]}"
                time.sleep(0.01)
                continue
    
    # ---- OCR: xử lý queue các crop cần OCR với VOTING SYSTEM ----
    def _ocr_loop(self):
        """
        OCR loop với Voting System:
        - OCR mỗi crop và thêm vào voting tracker
        - Chỉ lưu DB khi đủ votes và consensus
        - Tăng độ chính xác, giảm duplicate
        """
        ocr_service = get_ocr_service()
        while self.running:
            try:
                # Lấy crop từ queue (blocking với timeout)
                try:
                    task = self.ocr_queue.get(timeout=0.1)
                except:
                    continue  # Queue rỗng, tiếp tục chờ

                # OCR crop này
                image = task["image"]
                task_timestamp = task["timestamp"]

                try:
                    # OCR
                    raw_text = ocr_service.recognize(image)
                    normalized_text = normalize_plate_text(raw_text)

                    # Bỏ qua nếu không hợp lệ theo format biển số VN
                    if not normalized_text or not is_valid_vietnamese_plate(normalized_text):
                        continue

                    # Update latest OCR text (cho UI display)
                    if task_timestamp >= self.latest_ocr_timestamp:
                        self.latest_ocr_text = normalized_text
                        self.latest_ocr_timestamp = task_timestamp

                    # === VOTING SYSTEM ===
                    # Lấy bbox từ detection để track
                    # Giả sử detection đầu tiên (vì ta chỉ queue detection đầu)
                    # Bbox format: [x1, y1, x2, y2] → convert to (x, y, w, h)
                    detections = self.latest_detections
                    if detections:
                        bbox_xyxy = detections[0].get("bbox", [])
                        if len(bbox_xyxy) == 4:
                            x1, y1, x2, y2 = bbox_xyxy
                            # Convert to x, y, w, h format cho tracker
                            bbox_xywh = (x1, y1, x2 - x1, y2 - y1)

                            # Add vote vào tracker
                            finalized_plate = self.plate_tracker.add_detection(bbox_xywh, normalized_text)
                            self.stats["total_votes"] += 1

                            # Nếu đã có consensus → Lưu vào DB
                            if finalized_plate:
                                self.stats["finalized_plates"] += 1
                                logging.info(
                                    f"[{self.camera_id}] ✅ Plate finalized: {finalized_plate} "
                                    f"(after {self.stats['total_votes']} votes)"
                                )

                                # Kiểm tra duplicate trước khi lưu
                                from datetime import datetime
                                now_ts = time.time()

                                # Đọc dedup_interval từ config
                                cfg = load_config()
                                voting_cfg = cfg.get("voting", {})
                                MIN_INTERVAL = voting_cfg.get("dedup_interval", 15.0)

                                # Chỉ lưu nếu khác biển số trước đó hoặc đã quá MIN_INTERVAL
                                if (
                                    finalized_plate != self.last_saved_plate
                                    or (now_ts - self.last_saved_ts) > MIN_INTERVAL
                                ):
                                    ts_str = datetime.fromtimestamp(now_ts).isoformat()
                                    try:
                                        insert_ocr_log(self.camera_id, finalized_plate, ts_str)
                                        self.last_saved_plate = finalized_plate
                                        self.last_saved_ts = now_ts
                                        logging.info(
                                            f"[{self.camera_id}] 💾 Saved to DB: {finalized_plate} "
                                            f"(votes: {self.stats['total_votes']}, "
                                            f"finalized: {self.stats['finalized_plates']})"
                                        )

                                        # 🔥 REAL-TIME EVENT: Emit signal khi lưu DB thành công
                                        try:
                                            event_emitter = get_event_emitter()
                                            event_emitter.ocr_log_added.emit(self.camera_id, finalized_plate, ts_str)
                                        except Exception as e:
                                            # Không crash nếu signal fail
                                            logging.debug(f"[{self.camera_id}] Failed to emit signal: {e}")

                                    except Exception as db_e:
                                        logging.error(f"[{self.camera_id}] Failed to save OCR log: {db_e}")
                                else:
                                    logging.debug(
                                        f"[{self.camera_id}] Skipped duplicate: {finalized_plate} "
                                        f"(last saved {now_ts - self.last_saved_ts:.1f}s ago)"
                                    )

                except Exception as e:
                    logging.error(f"[{self.camera_id}] OCR error: {e}")

                # Mark task done
                self.ocr_queue.task_done()

            except Exception as e:
                logging.error(f"[{self.camera_id}] OCR loop error: {e}")
                time.sleep(0.1)

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        opts = (
            "rtsp_transport;tcp;"
            "fflags;nobuffer;"
            "flags;low_delay;"
            "probesize;32;"
            "analyzeduration;0;"
            "err_detect;ignore_err;"  # Bỏ qua lỗi decode, không crash
            "loglevel;error"  # Chỉ log ERROR, không log WARNING/INFO
        )
        try:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = opts
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FPS, self.target_fps)
            # Không dùng HW acceleration để tránh lỗi decode
            cv2.setNumThreads(2)
            if not cap.isOpened():
                logging.error(f"[{self.camera_id}] open capture failed for URL {self.url}")
                return None
            logging.info(f"[{self.camera_id}] RTSP opened")
            return cap
        except Exception as e:
            self.stats["last_err"] = f"open_failed: {e}"
            logging.exception(f"[{self.camera_id}] open_capture exception")
            return None

