"""
UI Dialogs - CameraSettingsDialog, OCRLogDialog
"""
import socket
import logging
from PyQt6 import QtCore, QtWidgets

from core.config import load_config, save_config
from core.camera_manager import camera_manager
from core.db import get_ocr_logs, delete_ocr_log, delete_all_ocr_logs
from core.events import get_event_emitter
from api.models import CameraCreate, CameraUpdate


def get_local_ip() -> str:
    """Lấy local IP address của máy"""
    try:
        # Kết nối đến một địa chỉ bất kỳ để lấy local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class CameraSettingsDialog(QtWidgets.QDialog):
    """Popup dialog để quản lý cameras"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Camera Settings")
        self.setMinimumSize(500, 600)
        self.setStyleSheet("background-color: #2a2a2a; color: #fff;")
        
        layout = QtWidgets.QVBoxLayout(self)
        layout.setSpacing(10)
        
        # Server Information Section
        server_group = QtWidgets.QGroupBox("Server Information")
        server_group.setStyleSheet(
            "QGroupBox { border: 1px solid #555; border-radius: 5px; padding: 10px; margin-top: 10px; }"
            "QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 5px; }"
        )
        server_layout = QtWidgets.QVBoxLayout(server_group)
        
        # Current Server (read-only)
        current_label = QtWidgets.QLabel("Current Server:")
        current_label.setStyleSheet("color: #ccc; font-size: 11px;")
        server_layout.addWidget(current_label)
        
        current_server_layout = QtWidgets.QHBoxLayout()
        local_ip = get_local_ip()
        self.current_ip_label = QtWidgets.QLabel(f"IP: {local_ip}")
        self.current_port_label = QtWidgets.QLabel("Port: 5000")
        self.current_ip_label.setStyleSheet("background-color: #1a1a1a; padding: 5px; border: 1px solid #555;")
        self.current_port_label.setStyleSheet("background-color: #1a1a1a; padding: 5px; border: 1px solid #555;")
        current_server_layout.addWidget(self.current_ip_label)
        current_server_layout.addWidget(self.current_port_label)
        server_layout.addLayout(current_server_layout)
        
        # Target Server (for sending data)
        target_label = QtWidgets.QLabel("Target Server (for sending data):")
        target_label.setStyleSheet("color: #ccc; font-size: 11px; margin-top: 10px;")
        server_layout.addWidget(target_label)
        
        target_server_layout = QtWidgets.QHBoxLayout()
        target_ip_label = QtWidgets.QLabel("IP:")
        target_ip_label.setStyleSheet("color: #ccc; font-size: 11px;")
        self.target_ip_input = QtWidgets.QLineEdit()
        self.target_ip_input.setPlaceholderText("192.168.1.100")
        self.target_ip_input.setStyleSheet(
            "background-color: #1a1a1a; color: #fff; border: 1px solid #555; padding: 5px;"
        )
        
        target_port_label = QtWidgets.QLabel("Port:")
        target_port_label.setStyleSheet("color: #ccc; font-size: 11px;")
        self.target_port_input = QtWidgets.QLineEdit()
        self.target_port_input.setPlaceholderText("8080")
        self.target_port_input.setStyleSheet(
            "background-color: #1a1a1a; color: #fff; border: 1px solid #555; padding: 5px;"
        )
        
        target_server_layout.addWidget(target_ip_label)
        target_server_layout.addWidget(self.target_ip_input, 2)
        target_server_layout.addWidget(target_port_label)
        target_server_layout.addWidget(self.target_port_input, 1)
        server_layout.addLayout(target_server_layout)
        
        layout.addWidget(server_group)
        
        # List cameras
        cameras_label = QtWidgets.QLabel("Cameras:")
        cameras_label.setStyleSheet("color: #ccc; font-size: 12px; font-weight: bold; margin-top: 10px;")
        layout.addWidget(cameras_label)
        
        self.camera_list = QtWidgets.QListWidget()
        self.camera_list.setStyleSheet(
            "background-color: #1a1a1a; color: #fff; border: 1px solid #555;"
        )
        layout.addWidget(self.camera_list, 1)
        
        # Buttons
        btn_layout = QtWidgets.QHBoxLayout()
        self.add_btn = QtWidgets.QPushButton("➕ Add Camera")
        self.edit_btn = QtWidgets.QPushButton("✏️ Edit")
        self.del_btn = QtWidgets.QPushButton("🗑️ Delete")
        self.close_btn = QtWidgets.QPushButton("Close")
        
        for btn in [self.add_btn, self.edit_btn, self.del_btn, self.close_btn]:
            btn.setStyleSheet(
                "background-color: #3a3a3a; color: #fff; border: 1px solid #555; padding: 8px;"
            )
            btn_layout.addWidget(btn)
        
        layout.addLayout(btn_layout)
        
        # Connect signals
        self.add_btn.clicked.connect(self.add_camera)
        self.edit_btn.clicked.connect(self.edit_camera)
        self.del_btn.clicked.connect(self.delete_camera)
        self.close_btn.clicked.connect(self.save_and_close)
        
        # Load target server từ config
        self.load_target_server()
        
        self.refresh_list()
    
    def load_target_server(self):
        """Load target server info từ config"""
        try:
            cfg = load_config()
            target_server = cfg.get("target_server", {})
            if target_server:
                self.target_ip_input.setText(target_server.get("ip", ""))
                self.target_port_input.setText(str(target_server.get("port", "")))
        except Exception as e:
            logging.error(f"Failed to load target server: {e}")
    
    def save_target_server(self):
        """Save target server info vào config"""
        try:
            cfg = load_config()
            if "target_server" not in cfg:
                cfg["target_server"] = {}
            cfg["target_server"]["ip"] = self.target_ip_input.text().strip()
            try:
                port = int(self.target_port_input.text().strip()) if self.target_port_input.text().strip() else 0
                cfg["target_server"]["port"] = port
            except ValueError:
                cfg["target_server"]["port"] = 0
            save_config(cfg)
        except Exception as e:
            logging.error(f"Failed to save target server: {e}")
    
    def save_and_close(self):
        """Save target server và đóng dialog"""
        self.save_target_server()
        self.accept()
    
    def refresh_list(self):
        self.camera_list.clear()
        for cam in camera_manager.list_cameras():
            item = QtWidgets.QListWidgetItem(f"{cam.id} - {cam.name}")
            item.setData(QtCore.Qt.ItemDataRole.UserRole, cam.id)
            self.camera_list.addItem(item)
    
    def add_camera(self):
        cid, ok = QtWidgets.QInputDialog.getText(self, "Add Camera", "Camera ID:")
        if not ok or not cid:
            return
        url, ok = QtWidgets.QInputDialog.getText(self, "Add Camera", "RTSP URL:")
        if not ok or not url:
            return
        name, ok = QtWidgets.QInputDialog.getText(self, "Add Camera", "Camera Name (optional):")
        if not ok:
            name = cid
        try:
            camera_manager.add_camera(CameraCreate(id=cid, url=url, name=name or cid))
            self.refresh_list()
            # Delay để đảm bảo config đã save và worker đã start (tăng lên 500ms)
            QtCore.QTimer.singleShot(500, lambda: self.parent().refresh_video_grid() if self.parent() else None)
        except Exception as e:
            QtWidgets.QMessageBox.warning(self, "Error", f"Failed to add camera: {e}")
    
    def edit_camera(self):
        item = self.camera_list.currentItem()
        if not item:
            QtWidgets.QMessageBox.warning(self, "Warning", "Please select a camera to edit")
            return
        
        cid = item.data(QtCore.Qt.ItemDataRole.UserRole)
        cameras = camera_manager.list_cameras()
        camera = next((cam for cam in cameras if cam.id == cid), None)
        
        if not camera:
            QtWidgets.QMessageBox.warning(self, "Error", "Camera not found")
            return
        
        # Dialog để sửa URL và Name
        dialog = QtWidgets.QDialog(self)
        dialog.setWindowTitle(f"Edit Camera: {cid}")
        dialog.setMinimumWidth(400)
        dialog.setStyleSheet("background-color: #2a2a2a; color: #fff;")
        
        layout = QtWidgets.QVBoxLayout(dialog)
        
        # Camera ID (read-only)
        id_label = QtWidgets.QLabel(f"Camera ID: {cid}")
        id_label.setStyleSheet("color: #888; font-size: 11px; padding: 5px;")
        layout.addWidget(id_label)
        
        # RTSP URL
        url_label = QtWidgets.QLabel("RTSP URL:")
        url_label.setStyleSheet("color: #ccc; font-size: 11px;")
        layout.addWidget(url_label)
        url_input = QtWidgets.QLineEdit(camera.url)
        url_input.setStyleSheet(
            "background-color: #1a1a1a; color: #fff; border: 1px solid #555; padding: 5px;"
        )
        layout.addWidget(url_input)
        
        # Camera Name
        name_label = QtWidgets.QLabel("Camera Name:")
        name_label.setStyleSheet("color: #ccc; font-size: 11px;")
        layout.addWidget(name_label)
        name_input = QtWidgets.QLineEdit(camera.name)
        name_input.setStyleSheet(
            "background-color: #1a1a1a; color: #fff; border: 1px solid #555; padding: 5px;"
        )
        layout.addWidget(name_input)
        
        # Buttons
        btn_layout = QtWidgets.QHBoxLayout()
        save_btn = QtWidgets.QPushButton("Save")
        cancel_btn = QtWidgets.QPushButton("Cancel")
        for btn in [save_btn, cancel_btn]:
            btn.setStyleSheet(
                "background-color: #3a3a3a; color: #fff; border: 1px solid #555; padding: 8px;"
            )
            btn_layout.addWidget(btn)
        layout.addLayout(btn_layout)
        
        save_btn.clicked.connect(dialog.accept)
        cancel_btn.clicked.connect(dialog.reject)
        
        if dialog.exec() == QtWidgets.QDialog.DialogCode.Accepted:
            new_url = url_input.text().strip()
            new_name = name_input.text().strip()
            
            if not new_url:
                QtWidgets.QMessageBox.warning(self, "Error", "RTSP URL cannot be empty")
                return
            
            try:
                camera_manager.update_camera(
                    cid,
                    CameraUpdate(url=new_url, name=new_name or cid)
                )
                self.refresh_list()
                # Delay một chút để đảm bảo config đã save
                QtCore.QTimer.singleShot(100, lambda: self.parent().refresh_video_grid() if self.parent() else None)
            except Exception as e:
                QtWidgets.QMessageBox.warning(self, "Error", f"Failed to update camera: {e}")
    
    def delete_camera(self):
        item = self.camera_list.currentItem()
        if not item:
            QtWidgets.QMessageBox.warning(self, "Warning", "Please select a camera to delete")
            return
        cid = item.data(QtCore.Qt.ItemDataRole.UserRole)
        reply = QtWidgets.QMessageBox.question(
            self, "Confirm", f"Delete camera '{cid}'?",
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No
        )
        if reply == QtWidgets.QMessageBox.StandardButton.Yes:
            try:
                camera_manager.remove_camera(cid)
                self.refresh_list()
                # Delay một chút để đảm bảo worker đã stop và config đã save
                QtCore.QTimer.singleShot(200, lambda: self.parent().refresh_video_grid() if self.parent() else None)
            except Exception as e:
                QtWidgets.QMessageBox.warning(self, "Error", f"Failed to delete camera: {e}")


class OCRLogDialog(QtWidgets.QDialog):
    """Dialog hiển thị danh sách log OCR (biển số, thời gian, vị trí) với auto-refresh."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("OCR Logs")
        self.setMinimumSize(700, 500)
        self.setStyleSheet("background-color: #2a2a2a; color: #fff;")

        layout = QtWidgets.QVBoxLayout(self)
        layout.setSpacing(10)

        # Info bar - hiển thị status, total, và sync status
        info_layout = QtWidgets.QHBoxLayout()
        self.status_label = QtWidgets.QLabel("💡 Ready - will update when new data arrives")
        self.status_label.setStyleSheet("color: #4CAF50; font-size: 11px; padding: 5px;")

        # Sync status indicator
        self.sync_label = QtWidgets.QLabel("📡 Sync: Disabled")
        self.sync_label.setStyleSheet("color: #888; font-size: 11px; padding: 5px;")

        self.total_label = QtWidgets.QLabel("Total: 0 records")
        self.total_label.setStyleSheet("color: #ccc; font-size: 11px; padding: 5px;")

        info_layout.addWidget(self.status_label)
        info_layout.addStretch()
        info_layout.addWidget(self.sync_label)
        info_layout.addWidget(QtWidgets.QLabel("|"))  # Separator
        info_layout.addWidget(self.total_label)
        layout.addLayout(info_layout)

        # Bảng hiển thị log
        self.table = QtWidgets.QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(
            ["Plate", "Time", "Camera Name", "Camera ID"]
        )
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.horizontalHeader().setSectionResizeMode(
            QtWidgets.QHeaderView.ResizeMode.Stretch
        )
        self.table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QtWidgets.QAbstractItemView.SelectionMode.ExtendedSelection)
        self.table.setStyleSheet(
            "QTableWidget { background-color: #1a1a1a; gridline-color: #555; }"
            "QHeaderView::section { background-color: #333; color: #fff; }"
        )
        layout.addWidget(self.table)

        # Nút refresh + delete + close
        btn_layout = QtWidgets.QHBoxLayout()
        self.refresh_btn = QtWidgets.QPushButton("🔄 Refresh")
        self.delete_selected_btn = QtWidgets.QPushButton("🗑️ Delete Selected")
        self.delete_all_btn = QtWidgets.QPushButton("🗑️ Clear All")
        self.close_btn = QtWidgets.QPushButton("Close")

        # Style cho delete buttons (màu đỏ cảnh báo)
        self.delete_selected_btn.setStyleSheet(
            "background-color: #d32f2f; color: #fff; border: 1px solid #b71c1c; padding: 8px;"
        )
        self.delete_all_btn.setStyleSheet(
            "background-color: #c62828; color: #fff; border: 1px solid #b71c1c; padding: 8px;"
        )

        for btn in [self.refresh_btn, self.close_btn]:
            btn.setStyleSheet(
                "background-color: #3a3a3a; color: #fff; border: 1px solid #555; padding: 8px;"
            )

        btn_layout.addWidget(self.refresh_btn)
        btn_layout.addWidget(self.delete_selected_btn)
        btn_layout.addWidget(self.delete_all_btn)
        btn_layout.addStretch()
        btn_layout.addWidget(self.close_btn)
        layout.addLayout(btn_layout)

        self.refresh_btn.clicked.connect(self.load_logs)
        self.delete_selected_btn.clicked.connect(self.delete_selected)
        self.delete_all_btn.clicked.connect(self.delete_all)
        self.close_btn.clicked.connect(self.accept)

        # 🔥 REAL-TIME: Connect to event emitter
        self.last_count = 0
        event_emitter = get_event_emitter()
        event_emitter.ocr_log_added.connect(self.on_ocr_log_added)
        event_emitter.sync_status_changed.connect(self.on_sync_status_changed)

        # Check if sync is enabled
        cfg = load_config()
        central_cfg = cfg.get("central", {})
        if central_cfg.get("enabled", False):
            self.sync_label.setText("📡 Sync: Initializing...")
            self.sync_label.setStyleSheet("color: #FFC107; font-size: 11px; padding: 5px;")

        self.load_logs()

    def load_logs(self):
        """Load dữ liệu từ DB và hiển thị."""
        try:
            logs = get_ocr_logs(limit=200)
        except Exception as e:
            logging.error(f"Failed to load OCR logs: {e}")
            QtWidgets.QMessageBox.warning(self, "Error", f"Failed to load logs: {e}")
            return

        self.table.setRowCount(len(logs))
        for row, log in enumerate(logs):
            # Lưu ID vào item đầu tiên (hidden data)
            plate_item = QtWidgets.QTableWidgetItem(log["plate_text"])
            plate_item.setData(QtCore.Qt.ItemDataRole.UserRole, log["id"])  # Store ID
            self.table.setItem(row, 0, plate_item)
            self.table.setItem(row, 1, QtWidgets.QTableWidgetItem(log["timestamp"]))
            self.table.setItem(row, 2, QtWidgets.QTableWidgetItem(log["camera_name"]))
            self.table.setItem(row, 3, QtWidgets.QTableWidgetItem(log["camera_id"]))

        # Update total count
        self.total_label.setText(f"Total: {len(logs)} records")
        self.last_count = len(logs)

    def on_ocr_log_added(self, camera_id: str, plate_text: str, timestamp: str):
        """
        🔥 REAL-TIME EVENT HANDLER: Được gọi khi có OCR log mới

        Args:
            camera_id: Camera ID
            plate_text: Biển số
            timestamp: Timestamp ISO format
        """
        try:
            # Reload data từ DB
            self.load_logs()

            # Flash notification với thông tin chi tiết
            self.status_label.setStyleSheet("color: #FFC107; font-size: 11px; padding: 5px;")
            self.status_label.setText(f"✨ New: {plate_text} @ {camera_id}")

            # Reset sau 3s
            QtCore.QTimer.singleShot(3000, lambda: (
                self.status_label.setStyleSheet("color: #4CAF50; font-size: 11px; padding: 5px;"),
                self.status_label.setText("💡 Ready - will update when new data arrives")
            ))
        except Exception as e:
            logging.error(f"on_ocr_log_added failed: {e}")

    def on_sync_status_changed(self, connected: bool, sent: int, failed: int, pending: int):
        """
        🔥 SYNC STATUS HANDLER: Cập nhật sync status display

        Args:
            connected: WebSocket connected status
            sent: Số logs đã sync thành công
            failed: Số logs sync thất bại
            pending: Số logs đang chờ sync
        """
        try:
            # Update sync status label
            if pending == 0:
                # Không có pending → All synced
                self.sync_label.setText(f"✅ Synced (↑{sent})")
                self.sync_label.setStyleSheet("color: #4CAF50; font-size: 11px; padding: 5px;")
            else:
                # Có pending → Hiển thị status
                if connected:
                    self.sync_label.setText(f"⏳ Syncing... ({pending} pending, ↑{sent})")
                    self.sync_label.setStyleSheet("color: #FFC107; font-size: 11px; padding: 5px;")
                else:
                    self.sync_label.setText(f"⚠️ Offline ({pending} pending)")
                    self.sync_label.setStyleSheet("color: #FF5722; font-size: 11px; padding: 5px;")

            # If có failures, hiển thị warning
            if failed > 0:
                self.sync_label.setText(f"{self.sync_label.text()} ⚠️{failed} failed")

        except Exception as e:
            logging.error(f"on_sync_status_changed failed: {e}")

    def delete_selected(self):
        """Xóa các records được chọn"""
        selected_rows = self.table.selectionModel().selectedRows()

        if not selected_rows:
            QtWidgets.QMessageBox.warning(
                self, "Warning", "Please select at least one record to delete"
            )
            return

        # Confirm trước khi xóa
        count = len(selected_rows)
        reply = QtWidgets.QMessageBox.question(
            self,
            "Confirm Delete",
            f"Delete {count} selected record(s)?",
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No
        )

        if reply == QtWidgets.QMessageBox.StandardButton.Yes:
            try:
                # Lấy IDs từ selected rows
                ids_to_delete = []
                for index in selected_rows:
                    row = index.row()
                    plate_item = self.table.item(row, 0)
                    if plate_item:
                        log_id = plate_item.data(QtCore.Qt.ItemDataRole.UserRole)
                        ids_to_delete.append(log_id)

                # Xóa từ DB
                for log_id in ids_to_delete:
                    delete_ocr_log(log_id)

                # Reload bảng
                self.load_logs()

                # Hiển thị thông báo thành công
                self.status_label.setStyleSheet("color: #4CAF50; font-size: 11px; padding: 5px;")
                self.status_label.setText(f"✅ Deleted {count} record(s)")
                QtCore.QTimer.singleShot(3000, lambda: (
                    self.status_label.setStyleSheet("color: #4CAF50; font-size: 11px; padding: 5px;"),
                    self.status_label.setText("💡 Ready - will update when new data arrives")
                ))

            except Exception as e:
                logging.error(f"Failed to delete records: {e}")
                QtWidgets.QMessageBox.warning(self, "Error", f"Failed to delete: {e}")

    def delete_all(self):
        """Xóa TẤT CẢ records"""
        # Confirm nghiêm ngặt trước khi xóa hết
        reply = QtWidgets.QMessageBox.warning(
            self,
            "⚠️ Confirm Clear All",
            "Are you sure you want to DELETE ALL OCR logs?\n\n"
            "This action CANNOT be undone!",
            QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No,
            QtWidgets.QMessageBox.StandardButton.No  # Default to No
        )

        if reply == QtWidgets.QMessageBox.StandardButton.Yes:
            try:
                count = delete_all_ocr_logs()
                self.load_logs()

                # Hiển thị thông báo
                self.status_label.setStyleSheet("color: #FF9800; font-size: 11px; padding: 5px;")
                self.status_label.setText(f"🗑️ Cleared all ({count} records)")
                QtCore.QTimer.singleShot(3000, lambda: (
                    self.status_label.setStyleSheet("color: #4CAF50; font-size: 11px; padding: 5px;"),
                    self.status_label.setText("💡 Ready - will update when new data arrives")
                ))

            except Exception as e:
                logging.error(f"Failed to clear all logs: {e}")
                QtWidgets.QMessageBox.warning(self, "Error", f"Failed to clear: {e}")


