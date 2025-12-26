"""
Event System - Global event emitter cho real-time updates
"""
from PyQt6.QtCore import QObject, pyqtSignal


class EventEmitter(QObject):
    """
    Global event emitter - Singleton pattern

    Signals:
        ocr_log_added: Emit khi có biển số mới được lưu vào DB
            - Args: (camera_id: str, plate_text: str, timestamp: str)
        sync_status_changed: Emit khi sync status thay đổi
            - Args: (connected: bool, logs_sent: int, logs_failed: int, pending: int)
    """
    # Signal khi có OCR log mới
    ocr_log_added = pyqtSignal(str, str, str)  # (camera_id, plate_text, timestamp)

    # Signal khi sync status thay đổi
    sync_status_changed = pyqtSignal(bool, int, int, int)  # (connected, sent, failed, pending)


# Global singleton instance
_event_emitter = None


def get_event_emitter() -> EventEmitter:
    """
    Lấy global event emitter instance (singleton)

    Returns:
        EventEmitter instance
    """
    global _event_emitter
    if _event_emitter is None:
        _event_emitter = EventEmitter()
    return _event_emitter
