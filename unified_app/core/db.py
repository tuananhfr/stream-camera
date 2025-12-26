"""
Local DB module để lưu log OCR (biển số, thời gian, vị trí).
"""
import sqlite3
from pathlib import Path
from typing import List, Dict, Any

from .config import load_config


DB_PATH = Path(__file__).resolve().parent.parent / "ocr_logs.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Khởi tạo DB và bảng nếu chưa tồn tại."""
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS ocr_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plate_text TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                camera_id TEXT NOT NULL,
                camera_name TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                retry_count INTEGER DEFAULT 0
            )
            """
        )

        # Migration: Thêm cột synced và retry_count nếu chưa có (cho DB cũ)
        try:
            cur.execute("ALTER TABLE ocr_logs ADD COLUMN synced INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Cột đã tồn tại

        try:
            cur.execute("ALTER TABLE ocr_logs ADD COLUMN retry_count INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Cột đã tồn tại

        conn.commit()
    finally:
        conn.close()


def insert_ocr_log(camera_id: str, plate_text: str, timestamp: str) -> None:
    """
    Lưu 1 bản ghi OCR vào DB.
    - Tự động lấy camera_name từ config (metadata).
    """
    if not plate_text:
        return

    cfg = load_config()
    meta = cfg.get("metadata", {}).get(camera_id, {})
    camera_name = meta.get("name") or camera_id

    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO ocr_logs (plate_text, timestamp, camera_id, camera_name)
            VALUES (?, ?, ?, ?)
            """,
            (plate_text, timestamp, camera_id, camera_name),
        )
        conn.commit()
    finally:
        conn.close()


def get_ocr_logs(limit: int = 200) -> List[Dict[str, Any]]:
    """
    Lấy danh sách log OCR mới nhất.
    Trả về list dict: {id, plate_text, timestamp, camera_id, camera_name}
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, plate_text, timestamp, camera_id, camera_name
            FROM ocr_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "plate_text": r["plate_text"],
                "timestamp": r["timestamp"],
                "camera_id": r["camera_id"],
                "camera_name": r["camera_name"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def delete_ocr_log(log_id: int) -> None:
    """
    Xóa 1 bản ghi OCR theo ID.
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM ocr_logs WHERE id = ?", (log_id,))
        conn.commit()
    finally:
        conn.close()


def delete_all_ocr_logs() -> int:
    """
    Xóa TẤT CẢ bản ghi OCR.

    Returns:
        Số lượng records đã xóa
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM ocr_logs")
        count = cur.fetchone()[0]
        cur.execute("DELETE FROM ocr_logs")
        conn.commit()
        return count
    finally:
        conn.close()


def get_unsynced_logs(limit: int = 100) -> List[Dict[str, Any]]:
    """
    Lấy danh sách log chưa sync (synced=0).

    Returns:
        List of unsynced records
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, plate_text, timestamp, camera_id, camera_name, retry_count
            FROM ocr_logs
            WHERE synced = 0 AND retry_count < 5
            ORDER BY id ASC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "plate_text": r["plate_text"],
                "timestamp": r["timestamp"],
                "camera_id": r["camera_id"],
                "camera_name": r["camera_name"],
                "retry_count": r["retry_count"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def mark_log_synced(log_id: int) -> None:
    """
    Đánh dấu log đã sync thành công → Xóa khỏi DB.
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM ocr_logs WHERE id = ?", (log_id,))
        conn.commit()
    finally:
        conn.close()


def increment_retry_count(log_id: int) -> None:
    """
    Tăng retry_count khi sync fail.
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE ocr_logs
            SET retry_count = retry_count + 1
            WHERE id = ?
            """,
            (log_id,),
        )
        conn.commit()
    finally:
        conn.close()


