"""
UI Main Window - MainWindow and FFmpegWarningFilter
"""
import logging
from typing import Dict, Optional, List

from PyQt6 import QtCore, QtWidgets

from .widgets import VideoWidget
from .dialogs import CameraSettingsDialog, OCRLogDialog
from core.camera_manager import camera_manager


class MainWindow(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Unified Camera App")
        self.resize(1400, 800)
        self.setStyleSheet("background-color: #1a1a1a;")

        # Top bar với icon settings và nút xem log
        top_bar = QtWidgets.QHBoxLayout()
        top_bar.setContentsMargins(10, 5, 10, 5)

        # Nút xem log OCR
        self.logs_btn = QtWidgets.QPushButton("📄")
        self.logs_btn.setFixedSize(40, 40)
        self.logs_btn.setStyleSheet(
            "background-color: #3a3a3a; color: #fff; border: 1px solid #555; border-radius: 5px; font-size: 18px;"
        )
        self.logs_btn.setToolTip("Xem lịch sử OCR")
        self.logs_btn.clicked.connect(self.show_logs)

        # Nút settings
        self.settings_btn = QtWidgets.QPushButton("⚙️")
        self.settings_btn.setFixedSize(40, 40)
        self.settings_btn.setStyleSheet(
            "background-color: #3a3a3a; color: #fff; border: 1px solid #555; border-radius: 5px; font-size: 20px;"
        )
        self.settings_btn.setToolTip("Camera Settings")
        self.settings_btn.clicked.connect(self.show_settings)

        top_bar.addStretch()  # Đẩy icon sang phải
        top_bar.addWidget(self.logs_btn)
        top_bar.addWidget(self.settings_btn)

        # Video layout: luôn 3 cột cố định, mỗi camera/video chiếm 1/3 màn hình
        # (Gộp cả RTSP cameras và video files vào cùng 1 grid)
        self.video_container = QtWidgets.QWidget()
        self.video_layout = QtWidgets.QHBoxLayout(self.video_container)
        self.video_layout.setSpacing(10)
        self.video_layout.setContentsMargins(5, 5, 5, 5)

        # Dictionary để lưu video widgets theo camera_id/video_id
        self.video_widgets: Dict[str, VideoWidget] = {}

        # Tạo 3 slots cố định (có thể là None nếu chưa có source)
        self.video_slots: List[Optional[VideoWidget]] = [None, None, None]

        # Main layout
        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addLayout(top_bar, 0)  # Top bar
        layout.addWidget(self.video_container, 1)  # Video grid

        self.timer = QtCore.QTimer(self)
        self.timer.timeout.connect(self.refresh_frames)
        self.timer.start(200)  # 5 fps

        self.refresh_video_grid()
    
    def show_settings(self):
        """Hiển thị popup settings"""
        dialog = CameraSettingsDialog(self)
        dialog.exec()

    def show_logs(self):
        """Hiển thị popup log OCR"""
        dialog = OCRLogDialog(self)
        dialog.exec()
    
    def refresh_video_grid(self):
        """Refresh video grid - hiển thị cả cameras và videos trong cùng 1 grid"""
        try:
            sources = camera_manager.list_cameras()  # Includes both cameras and videos
            max_sources = min(3, len(sources))

            # Xóa tất cả widgets cũ (nhưng không delete ngay để tránh block)
            widgets_to_delete = []
            while self.video_layout.count():
                item = self.video_layout.takeAt(0)
                if item and item.widget():
                    widget = item.widget()
                    widget.setParent(None)
                    widgets_to_delete.append(widget)

            # Đảm bảo layout có spacing và margins đúng
            self.video_layout.setSpacing(10)
            self.video_layout.setContentsMargins(5, 5, 5, 5)

            # Xóa khỏi dict
            self.video_widgets.clear()
            self.video_slots = [None, None, None]

            # Tạo widgets mới - LUÔN có đủ 3 widgets với stretch = 1
            for idx in range(3):
                if idx < max_sources:
                    source = sources[idx]
                    # Display name with icon based on type
                    if source.type == "video":
                        display_name = f"🎬 {source.name}"
                    else:
                        display_name = f"📹 {source.name}"

                    video_widget = VideoWidget(
                        camera_id=source.id,
                        camera_name=display_name,
                        parent=self.video_container
                    )
                    self.video_widgets[source.id] = video_widget
                    self.video_slots[idx] = video_widget
                    self.video_layout.addWidget(video_widget, 1)  # stretch = 1, chia đều
                else:
                    # Placeholder - phải có size policy giống VideoWidget
                    placeholder = QtWidgets.QLabel("No Source")
                    placeholder.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
                    placeholder.setStyleSheet("background-color: #222; color: #888; border: 1px solid #555; font-size: 16px;")
                    # Size policy: Expanding để layout chia đều
                    placeholder_size_policy = QtWidgets.QSizePolicy(
                        QtWidgets.QSizePolicy.Policy.Expanding,
                        QtWidgets.QSizePolicy.Policy.Expanding
                    )
                    placeholder.setSizePolicy(placeholder_size_policy)
                    placeholder.setMinimumSize(320, 240)
                    self.video_slots[idx] = None
                    self.video_layout.addWidget(placeholder, 1)  # stretch = 1, chia đều

            # Force update layout
            self.video_container.update()
            self.update()

            # Delete widgets cũ sau khi đã tạo mới (tránh block UI)
            def _delete_old_widgets():
                for widget in widgets_to_delete:
                    try:
                        widget.deleteLater()
                    except:
                        pass

            QtCore.QTimer.singleShot(100, _delete_old_widgets)

        except Exception as e:
            logging.error(f"Error refreshing video grid: {e}")
            import traceback
            traceback.print_exc()

    def refresh_frames(self):
        # Cập nhật tất cả video widget đang hiển thị
        for video_widget in self.video_widgets.values():
            video_widget.update_frame()


class FFmpegWarningFilter:
    """Filter để ẩn FFmpeg H.264 decode warnings (không ảnh hưởng chức năng)"""
    def __init__(self, original_stderr):
        self.original_stderr = original_stderr
        self.ffmpeg_warning_keywords = [
            "error while decoding MB",
            "cabac decode",
            "left block unavailable",
            "error while decoding",
            "[h264 @",
        ]
    
    def write(self, message):
        # Chỉ filter các FFmpeg H.264 warnings, giữ lại các lỗi khác
        if any(keyword in message for keyword in self.ffmpeg_warning_keywords):
            return  # Bỏ qua FFmpeg decode warnings
        self.original_stderr.write(message)
    
    def flush(self):
        self.original_stderr.flush()

