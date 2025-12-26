"""
UI Widgets - VideoWidget
"""
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from PyQt6 import QtCore, QtGui, QtWidgets

from core.camera_manager import camera_manager


class VideoWidget(QtWidgets.QWidget):
    def __init__(self, camera_id: str, camera_name: str, parent=None):
        super().__init__(parent)
        self.camera_id = camera_id
        self.camera_name = camera_name
        
        # Size policy: Expanding để layout chia đều
        size_policy = QtWidgets.QSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Expanding
        )
        self.setSizePolicy(size_policy)
        
        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(5)
        
        # Label hiển thị tên camera
        self.name_label = QtWidgets.QLabel(camera_name)
        self.name_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.name_label.setStyleSheet("background-color: #333; color: white; padding: 4px; font-weight: bold;")
        self.name_label.setFixedHeight(30)
        layout.addWidget(self.name_label)
        
        # Video display - giữ tỷ lệ 16:9
        self.video_label = QtWidgets.QLabel()
        self.video_label.setScaledContents(False)  # Không tự scale để giữ tỷ lệ
        self.video_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.video_label.setStyleSheet("background-color: #000; border: 1px solid #555;")
        # Size policy: mở rộng theo width, height sẽ được set trong resizeEvent
        size_policy = QtWidgets.QSizePolicy(
            QtWidgets.QSizePolicy.Policy.Expanding,
            QtWidgets.QSizePolicy.Policy.Fixed
        )
        self.video_label.setSizePolicy(size_policy)
        layout.addWidget(self.video_label, 1)  # Cho phép video label mở rộng
        
        # Phần thông tin phía dưới: ảnh nhận diện, OCR text, ngày giờ (theo chiều dọc)
        self.info_area = QtWidgets.QWidget()
        info_layout = QtWidgets.QVBoxLayout(self.info_area)
        info_layout.setContentsMargins(5, 5, 5, 5)
        info_layout.setSpacing(8)
        
        # Phần chứa ảnh nhận diện (ở trên)
        self.detection_image_label = QtWidgets.QLabel("No detection")
        self.detection_image_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.detection_image_label.setMinimumHeight(60)
        self.detection_image_label.setMaximumHeight(120)  # Cho phép cao hơn nếu cần
        self.detection_image_label.setStyleSheet(
            "background-color: #000; border: 1px solid #555; color: #888; font-size: 10px;"
        )
        self.detection_image_label.setScaledContents(False)  # Tắt để giữ tỉ lệ khung hình
        info_layout.addWidget(self.detection_image_label)
        
        # Input text OCR (không có label title)
        self.ocr_text_input = QtWidgets.QLineEdit()
        self.ocr_text_input.setPlaceholderText("Text sẽ tự động điền khi nhận diện...")
        self.ocr_text_input.setStyleSheet(
            "background-color: #2a2a2a; color: #fff; border: 1px solid #555; padding: 5px; font-size: 12px;"
        )
        info_layout.addWidget(self.ocr_text_input)
        
        # Hiển thị ngày giờ phát hiện (không có label title)
        self.detection_time_label = QtWidgets.QLabel("--")
        self.detection_time_label.setStyleSheet(
            "background-color: #2a2a2a; color: #0f0; border: 1px solid #555; padding: 5px; font-size: 11px; font-family: monospace;"
        )
        info_layout.addWidget(self.detection_time_label)
        
        self.info_area.setMinimumHeight(180)
        self.info_area.setStyleSheet("background-color: #1a1a1a; border: 1px solid #555;")
        layout.addWidget(self.info_area, 0)  # Không mở rộng, giữ kích thước cố định

    def resizeEvent(self, event):
        """Đảm bảo video label có height phù hợp với width (tỷ lệ 16:9)"""
        super().resizeEvent(event)
        # Tính height dựa trên width với tỷ lệ 16:9
        video_width = self.video_label.width()
        if video_width > 0:
            video_height = int(video_width * 9 / 16)  # 16:9 aspect ratio
            self.video_label.setFixedHeight(video_height)

    def update_frame(self):
        frame, detections = camera_manager.get_frame(self.camera_id)
        if frame is None:
            self.video_label.setText("No video")
            return
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        bytes_per_line = ch * w
        qimg = QtGui.QImage(rgb.data, w, h, bytes_per_line, QtGui.QImage.Format.Format_RGB888)
        pix = QtGui.QPixmap.fromImage(qimg)
        
        # Scale pixmap giữ tỷ lệ khung hình để fit vào label
        label_size = self.video_label.size()
        if label_size.width() > 0 and label_size.height() > 0:
            scaled_pix = pix.scaled(
                label_size,
                QtCore.Qt.AspectRatioMode.KeepAspectRatio,
                QtCore.Qt.TransformationMode.SmoothTransformation
            )
            self.video_label.setPixmap(scaled_pix)
        else:
            self.video_label.setPixmap(pix)
        
        # Cập nhật detection info: lấy cropped image, OCR text và hiển thị
        cropped_image = camera_manager.get_cropped_image(self.camera_id)
        ocr_text = camera_manager.get_ocr_text(self.camera_id)  # Lấy OCR text từ queue
        detection_time = None
        if detections:
            # Lấy timestamp từ detection mới nhất
            detection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        self.update_detection_info(
            detection_image=cropped_image,
            ocr_text=ocr_text,
            detection_time=detection_time
        )

    def update_detection_info(self, detection_image: Optional[np.ndarray] = None, ocr_text: str = "", detection_time: Optional[str] = None):
        """
        Cập nhật thông tin detection (sẽ dùng sau khi tích hợp OCR)
        
        Args:
            detection_image: Ảnh crop từ vùng nhận diện (numpy array BGR)
            ocr_text: Text OCR đã nhận diện
            detection_time: Ngày giờ phát hiện (format: "YYYY-MM-DD HH:MM:SS")
        """
        # Cập nhật ảnh nhận diện
        if detection_image is not None:
            rgb = cv2.cvtColor(detection_image, cv2.COLOR_BGR2RGB)
            h, w, ch = rgb.shape
            bytes_per_line = ch * w
            qimg = QtGui.QImage(rgb.data, w, h, bytes_per_line, QtGui.QImage.Format.Format_RGB888)
            pix = QtGui.QPixmap.fromImage(qimg)
            
            # Tính toán kích thước label để giữ tỉ lệ ảnh
            label_size = self.detection_image_label.size()
            if label_size.width() > 0 and label_size.height() > 0:
                # Scale ảnh giữ tỉ lệ, fit vào label
                scaled_pix = pix.scaled(
                    label_size,
                    QtCore.Qt.AspectRatioMode.KeepAspectRatio,
                    QtCore.Qt.TransformationMode.SmoothTransformation
                )
                self.detection_image_label.setPixmap(scaled_pix)
            else:
                self.detection_image_label.setPixmap(pix)
        else:
            self.detection_image_label.setText("No detection")
            self.detection_image_label.setPixmap(QtGui.QPixmap())
        
        # Cập nhật OCR text
        if ocr_text:
            self.ocr_text_input.setText(ocr_text)
        else:
            self.ocr_text_input.clear()
        
        # Cập nhật ngày giờ
        if detection_time:
            self.detection_time_label.setText(detection_time)
        else:
            self.detection_time_label.setText("--")

