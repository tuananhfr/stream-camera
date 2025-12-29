"""
Camera Manager module - manages cameras and workers
"""
import logging
import threading
from typing import Dict, Optional, Tuple, List, Union

import numpy as np
from fastapi import HTTPException

from .config import load_config, save_config
from .camera_worker import CameraWorker
from .video_worker import VideoSourceWorker
from api.models import CameraCreate, CameraUpdate, CameraOut


class CameraManager:
    def __init__(self):
        self.cfg = load_config()
        self.workers: Dict[str, Union[CameraWorker, VideoSourceWorker]] = {}
        self.lock = threading.Lock()

    def list_cameras(self) -> List[CameraOut]:
        cams = []
        for cid, url in self.cfg.get("streams", {}).items():
            meta = self.cfg.get("metadata", {}).get(cid, {})
            cams.append(
                CameraOut(
                    id=cid,
                    url=url,
                    name=meta.get("name") or cid,
                    type=meta.get("type") or "rtsp",
                )
            )
        return cams

    def add_camera(self, cam: CameraCreate):
        with self.lock:
            if cam.id in self.cfg["streams"]:
                raise HTTPException(status_code=400, detail="Camera ID exists")
            self.cfg["streams"][cam.id] = cam.url
            self.cfg["metadata"][cam.id] = {"name": cam.name or cam.id, "type": cam.type}
            save_config(self.cfg)
        
        # Start detection sau khi release lock để tránh block
        def _start_detection():
            try:
                self.start_detection(cam.id, fps=5.0)
                logging.info(f"[AUTO-START] Started detection for new camera: {cam.id}")
            except Exception as e:
                logging.error(f"[AUTO-START] Failed to start new camera {cam.id}: {e}")
        
        # Start detection trong background thread để không block UI
        thread = threading.Thread(target=_start_detection, daemon=True)
        thread.start()

    def update_camera(self, cid: str, cam: CameraUpdate):
        with self.lock:
            if cid not in self.cfg["streams"]:
                raise HTTPException(status_code=404, detail="Camera not found")
            if cam.url:
                self.cfg["streams"][cid] = cam.url
            if cid not in self.cfg["metadata"]:
                self.cfg["metadata"][cid] = {}
            if cam.name is not None:
                self.cfg["metadata"][cid]["name"] = cam.name
            if cam.type is not None:
                self.cfg["metadata"][cid]["type"] = cam.type
            save_config(self.cfg)

    def remove_camera(self, cid: str):
        with self.lock:
            # Stop worker trước khi xóa
            if cid in self.workers:
                worker = self.workers[cid]
                worker.stop()
                # Đợi worker stop hoàn toàn (timeout 2s)
                if worker.reader_thread and worker.reader_thread.is_alive():
                    worker.reader_thread.join(timeout=2.0)
                if worker.detector_thread and worker.detector_thread.is_alive():
                    worker.detector_thread.join(timeout=2.0)
                del self.workers[cid]
            
            # Xóa khỏi config
            if cid in self.cfg["streams"]:
                del self.cfg["streams"][cid]
            if cid in self.cfg["metadata"]:
                del self.cfg["metadata"][cid]
            save_config(self.cfg)

    def start_detection(self, cid: str, fps: float = 5.0):
        with self.lock:
            if cid in self.workers and self.workers[cid].running:
                return
            url = self.cfg["streams"].get(cid)
            if not url:
                raise HTTPException(status_code=404, detail="Camera not found")

            # Check source type from metadata
            meta = self.cfg.get("metadata", {}).get(cid, {})
            source_type = meta.get("type", "rtsp")

            # Create appropriate worker based on source type
            if source_type == "video":
                # Video file worker
                worker = VideoSourceWorker(
                    video_id=cid,
                    video_path=url,
                    target_fps=fps
                )
            else:
                # RTSP camera worker (default)
                worker = CameraWorker(camera_id=cid, url=url, target_fps=fps)

            self.workers[cid] = worker
            worker.start()

    def stop_detection(self, cid: str):
        with self.lock:
            worker = self.workers.get(cid)
            if worker:
                worker.stop()
                del self.workers[cid]

    def get_frame(self, cid: str) -> Tuple[Optional[np.ndarray], List[dict]]:
        worker = self.workers.get(cid)
        if not worker:
            return None, []
        return worker.latest_frame, worker.latest_detections
    
    def get_cropped_image(self, cid: str) -> Optional[np.ndarray]:
        """Lấy ảnh crop từ detection mới nhất"""
        worker = self.workers.get(cid)
        if not worker:
            return None
        return worker.latest_cropped_image
    
    def get_ocr_text(self, cid: str) -> str:
        """Lấy OCR text từ detection mới nhất"""
        worker = self.workers.get(cid)
        if not worker:
            return ""
        return worker.latest_ocr_text

    def get_stats(self):
        out = {}
        for cid, w in self.workers.items():
            out[cid] = {
                "fps": w.stats.get("fps", 0),
                "errors": w.stats.get("errors", 0),
                "last_err": w.stats.get("last_err", ""),
                "last_update_ts": w.last_update_ts,
            }
        return out

    def auto_start_all(self, fps: float = 5.0):
        """Tự động start detection cho tất cả camera có trong config"""
        for cid in self.cfg.get("streams", {}).keys():
            if cid not in self.workers or not self.workers[cid].running:
                try:
                    self.start_detection(cid, fps=fps)
                    logging.info(f"[AUTO-START] Started detection for camera: {cid}")
                except Exception as e:
                    logging.error(f"[AUTO-START] Failed to start {cid}: {e}")


# Global camera manager instance
camera_manager = CameraManager()

