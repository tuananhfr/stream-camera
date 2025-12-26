"""
Config management module
"""
import threading
import logging
from pathlib import Path
from typing import Dict
import yaml

# Config path: unified_app/config.yaml (parent của core/)
CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"
DEFAULT_CONFIG = {"streams": {}, "metadata": {}}


def load_config() -> dict:
    """Load config từ YAML file"""
    if not CONFIG_PATH.exists():
        CONFIG_PATH.write_text(yaml.safe_dump(DEFAULT_CONFIG, sort_keys=False), encoding="utf-8")
        return DEFAULT_CONFIG.copy()
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("streams", {})
    data.setdefault("metadata", {})
    return data


def save_config(cfg: dict) -> None:
    """Save config to YAML file (async in background thread to avoid blocking UI)"""
    def _save():
        try:
            CONFIG_PATH.write_text(yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True), encoding="utf-8")
        except Exception as e:
            logging.error(f"Failed to save config: {e}")
    
    # Chạy trong background thread để không block UI
    thread = threading.Thread(target=_save, daemon=True)
    thread.start()

