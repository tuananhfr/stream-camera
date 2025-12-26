"""
Detector and OCR service module
"""
import os
import logging
from pathlib import Path
from typing import Optional, List
import numpy as np

# Import ONNX detector from core directory
from .onnx_detector import ONNXLicensePlateDetector

_shared_detector: Optional[ONNXLicensePlateDetector] = None


def get_detector() -> ONNXLicensePlateDetector:
    """Shared detector instance - đọc model path từ config.yaml"""
    global _shared_detector
    if _shared_detector is None:
        # Đọc model path từ config.yaml
        from .config import load_config
        cfg = load_config()
        model_name = cfg.get("model", {}).get("path", "model1.onnx")
        models_dir = Path(__file__).resolve().parent.parent / "models"
        model_path = str(models_dir / model_name)
        logging.info(f"[DETECTOR] Loading ONNX model from {model_path}")
        _shared_detector = ONNXLicensePlateDetector(model_path=model_path)
    return _shared_detector


class OCRService:
    """
    OCR Service - YOLO OCR cho license plate
    Sử dụng Ultralytics YOLO để detect và đọc ký tự
    """
    def __init__(self, model_path: str):
        self.ocr = None
        self.ocr_type = 'none'
        self._ready = False
        self.error = None
        self.model_path = model_path
        
        # Try init YOLO
        if self._try_init_yolo():
            logging.info(f"[OCR] ✅ YOLO OCR ready: {model_path}")
        else:
            logging.warning(f"[OCR] ❌ Failed to load OCR model: {self.error}")
    
    def is_ready(self):
        return self._ready
    
    def _try_init_yolo(self):
        """Khởi tạo YOLO OCR"""
        if not os.path.exists(self.model_path):
            self.error = f"Model không tồn tại: {self.model_path}"
            return False
        
        try:
            from ultralytics import YOLO
            self.ocr = YOLO(self.model_path, task='detect')
            self.ocr_type = 'yolo'
            self._ready = True
            self.error = None
            return True
        except ImportError:
            self.error = "Thiếu ultralytics (pip install ultralytics)"
            return False
        except Exception as exc:
            self.error = f"YOLO init lỗi: {exc}"
            return False
    
    def recognize(self, plate_img: np.ndarray) -> str:
        """
        Đọc text từ plate image
        
        Args:
            plate_img: Cropped license plate image (BGR)
        
        Returns:
            Text string hoặc "" nếu không đọc được
        """
        if not self.is_ready():
            return ""
        
        try:
            # Run inference
            ocr_results = self.ocr(plate_img, conf=0.25, verbose=False, imgsz=640)
            
            # Parse character boxes
            char_data = []
            for cr in ocr_results:
                for cb in cr.boxes:
                    bx1, by1, bx2, by2 = map(int, cb.xyxy[0])
                    char_data.append([
                        bx1, by1, bx2, by2,
                        float(cb.conf[0]),
                        int(cb.cls[0])
                    ])
            
            if not char_data:
                return ""
            
            # Sort và ghép text
            text = self._sort_chars(char_data)
            return text if text else ""
        
        except Exception as e:
            logging.error(f"[OCR Error] {e}")
            return ""
    
    def _sort_chars(self, boxes):
        """Sắp xếp ký tự theo vị trí"""
        if not boxes:
            return ""
        
        # Get class names
        if self.ocr.names is None:
            # Vietnamese plate charset (36 classes: 0-9, A-Z)
            charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            names = {i: c for i, c in enumerate(charset)}
        else:
            names = self.ocr.names
        
        chars = []
        for box in boxes:
            x1, y1, x2, y2 = box[:4]
            cls = int(box[5])
            label = names.get(cls, str(cls))
            
            if label:
                chars.append([(x1+x2)/2, (y1+y2)/2, str(label)])
        
        if not chars:
            return ""
        
        y_coords = [c[1] for c in chars]
        mean_y = sum(y_coords) / len(y_coords) if y_coords else 0
        
        # Check if 2 lines
        is_two_lines = False
        if len(chars) > 2:
            spread = max(y_coords) - min(y_coords)
            if spread > (max(y_coords) + min(y_coords)) * 0.15:
                is_two_lines = True
        
        if is_two_lines:
            top = sorted([c for c in chars if c[1] < mean_y], key=lambda x: x[0])
            bot = sorted([c for c in chars if c[1] >= mean_y], key=lambda x: x[0])
            return "".join([c[2] for c in top]) + "-" + "".join([c[2] for c in bot])
        else:
            return "".join([c[2] for c in sorted(chars, key=lambda x: x[0])])
    
    def recognize_batch(self, images: List[np.ndarray]) -> List[str]:
        """OCR nhiều ảnh cùng lúc"""
        return [self.recognize(img) for img in images]


_shared_ocr_service: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    """Shared OCR service instance - đọc OCR model path từ config.yaml"""
    global _shared_ocr_service
    if _shared_ocr_service is None:
        # Đọc OCR model path từ config.yaml
        from .config import load_config
        cfg = load_config()
        ocr_name = cfg.get("ocr", {}).get("path", "ocr.onnx")
        models_dir = Path(__file__).resolve().parent.parent / "models"
        ocr_path = str(models_dir / ocr_name)
        logging.info(f"[OCR] Loading OCR model from {ocr_path}")
        _shared_ocr_service = OCRService(ocr_path)
    return _shared_ocr_service


def crop_plate_image(frame: np.ndarray, bbox: List[int]) -> Optional[np.ndarray]:
    """
    Crop vùng biển số từ frame
    
    Args:
        frame: Full frame (BGR)
        bbox: [x1, y1, x2, y2]
    
    Returns:
        Cropped image hoặc None nếu bbox không hợp lệ
    """
    try:
        import cv2
        x1, y1, x2, y2 = bbox
        # Đảm bảo coordinates hợp lệ
        x1 = max(0, int(x1))
        y1 = max(0, int(y1))
        x2 = min(frame.shape[1], int(x2))
        y2 = min(frame.shape[0], int(y2))
        
        if x2 <= x1 or y2 <= y1:
            return None
        
        plate_roi = frame[y1:y2, x1:x2]
        return plate_roi
    except Exception as e:
        logging.error(f"Error cropping plate: {e}")
        return None

