"""
Unified Camera App - Main Entry Point
"""
import os
import sys
import threading
import logging

# Suppress FFmpeg warnings (H.264 decode errors)
os.environ["OPENCV_LOG_LEVEL"] = "ERROR"
os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "quiet"

import uvicorn
from PyQt6 import QtWidgets

from api.routes import app
from core.camera_manager import camera_manager
from core.config import load_config
from core.central_sync import CentralSyncService
from core.ocr_sender import init_ocr_sender
from ui import MainWindow, FFmpegWarningFilter

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")

# Global sync service instance
_sync_service = None


def start_api():
    """Start FastAPI server in background thread"""
    config = uvicorn.Config(app, host="0.0.0.0", port=5000, log_level="info")
    server = uvicorn.Server(config)
    server.run()


def main():
    global _sync_service

    # Suppress FFmpeg H.264 decode warnings
    original_stderr = sys.stderr
    sys.stderr = FFmpegWarningFilter(original_stderr)

    # Auto-start all cameras
    camera_manager.auto_start_all(fps=5.0)

    # Load config
    cfg = load_config()

    # Initialize OCR Sender (using target_server from config)
    target_server = cfg.get("target_server", {})
    device_id = cfg.get("device_id", "").strip()

    if target_server and device_id:
        central_ip = target_server.get("ip", "").strip()
        central_port = target_server.get("port", 8000)

        if central_ip:
            central_url = f"http://{central_ip}:{central_port}"
            init_ocr_sender(central_url, device_id)
            logging.info(f"[App] OCR sender initialized: {central_url} (device: {device_id})")
        else:
            logging.warning("[App] OCR sender not initialized: target_server.ip is empty")
    else:
        logging.warning("[App] OCR sender not initialized: device_id or target_server missing")

    # Start Central Sync Service (if enabled)
    central_cfg = cfg.get("central", {})
    if central_cfg.get("enabled", False):
        central_url = central_cfg.get("url", "").strip()
        sync_device_id = central_cfg.get("device_id", "").strip()

        # Validate config
        if not central_url or not sync_device_id:
            logging.warning("[App] Central sync enabled but URL or device_id is empty")
            logging.warning("[App] Please configure 'url' and 'device_id' in config.yaml under 'central' section")
            logging.info("[App] Central sync disabled (missing configuration)")
        else:
            _sync_service = CentralSyncService(central_url=central_url, device_id=sync_device_id)
            _sync_service.start()
            logging.info(f"[App] Central sync enabled: {central_url} (device: {sync_device_id})")
    else:
        logging.info("[App] Central sync disabled")

    # Start API server in background
    api_thread = threading.Thread(target=start_api, daemon=True)
    api_thread.start()

    # Start PyQt6 UI
    qt_app = QtWidgets.QApplication(sys.argv)
    win = MainWindow()
    win.show()

    # Cleanup on exit
    try:
        sys.exit(qt_app.exec())
    finally:
        if _sync_service:
            _sync_service.stop()


if __name__ == "__main__":
    main()

