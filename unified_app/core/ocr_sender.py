"""
OCR Sender - Send OCR detections to central server
"""
import logging
import requests
from datetime import datetime
from typing import Optional


class OCRSender:
    """Send OCR detections to central server via /api/edge/ocr endpoint"""

    def __init__(self, central_url: str, device_id: str):
        """
        Args:
            central_url: URL of central server (e.g., http://192.168.0.78:8000)
            device_id: Unique identifier for this unified_app instance
        """
        self.central_url = central_url.rstrip('/')
        self.device_id = device_id
        self.endpoint = f"{self.central_url}/api/edge/ocr"
        logging.info(f"[OCRSender] Initialized with central_url={central_url}, device_id={device_id}")

    def send_ocr(self, camera_id: str, camera_name: str, plate_text: str, timestamp: Optional[str] = None) -> bool:
        """
        Send OCR detection to central server

        Args:
            camera_id: Camera ID (e.g., 'a', 'b', 'cam1')
            camera_name: Camera name (e.g., 'khu a', 'Entrance 1')
            plate_text: Detected license plate text
            timestamp: ISO format timestamp, defaults to current time

        Returns:
            True if sent successfully, False otherwise
        """
        if not timestamp:
            timestamp = datetime.utcnow().isoformat()

        payload = {
            "device_id": self.device_id,
            "camera_id": camera_id,
            "camera_name": camera_name,
            "plate_text": plate_text,
            "timestamp": timestamp
        }

        try:
            logging.debug(f"[OCRSender] Sending OCR: {plate_text} from {camera_name}")
            response = requests.post(
                self.endpoint,
                json=payload,
                timeout=5
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    logging.info(f"[OCRSender] ✓ OCR sent successfully: {plate_text} -> {camera_name}")
                    return True
                else:
                    logging.warning(f"[OCRSender] Server returned success=False: {result.get('error')}")
                    return False
            elif response.status_code == 404:
                # Vehicle not in parking - this is expected, just log as debug
                logging.debug(f"[OCRSender] Vehicle {plate_text} not in parking (404)")
                return False
            else:
                logging.error(f"[OCRSender] Failed to send OCR. Status: {response.status_code}, Response: {response.text}")
                return False

        except requests.exceptions.ConnectionError:
            logging.error(f"[OCRSender] Cannot connect to central server at {self.central_url}")
            return False
        except requests.exceptions.Timeout:
            logging.error(f"[OCRSender] Request timeout to {self.endpoint}")
            return False
        except Exception as e:
            logging.error(f"[OCRSender] Error sending OCR: {e}")
            return False


# Global OCR sender instance
_ocr_sender: Optional[OCRSender] = None


def init_ocr_sender(central_url: str, device_id: str):
    """Initialize global OCR sender instance"""
    global _ocr_sender
    _ocr_sender = OCRSender(central_url, device_id)
    logging.info(f"[OCRSender] Global instance initialized")


def get_ocr_sender() -> Optional[OCRSender]:
    """Get global OCR sender instance"""
    return _ocr_sender


def send_ocr_to_central(camera_id: str, camera_name: str, plate_text: str, timestamp: Optional[str] = None) -> bool:
    """
    Convenience function to send OCR using global sender

    Returns:
        True if sent successfully, False if sender not initialized or send failed
    """
    if _ocr_sender is None:
        logging.warning("[OCRSender] OCR sender not initialized, skipping send")
        return False

    return _ocr_sender.send_ocr(camera_id, camera_name, plate_text, timestamp)
