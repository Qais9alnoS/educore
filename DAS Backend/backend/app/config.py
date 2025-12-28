import os
import sys
from typing import Optional
from pathlib import Path

def get_base_dir() -> Path:
    """Get base directory - works for both development and PyInstaller exe"""
    if getattr(sys, 'frozen', False):
        # Running as compiled exe
        return Path(os.path.dirname(sys.executable))
    else:
        # Running as script
        return Path(__file__).parent.parent

BASE_DIR = get_base_dir()

class Settings:
    # Database (relative to exe/script location)
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/school_management.db"
    
    # Security
    SECRET_KEY: str = "123456789"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Network - Bind to 127.0.0.1 for all modes
    # CRITICAL FIX: Even when running as exe (Tauri WebView2):
    # - Binding to 0.0.0.0 + using "localhost" hostname FAILS (WebView2 hostname resolution issue)
    # - Binding to 127.0.0.1 + using "127.0.0.1" address WORKS (direct loopback, no DNS needed)
    # Frontend already uses http://localhost:8000/api which resolves to 127.0.0.1
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = "8421665964:AAFfkNY2rhOnlu2thXoQB4EeBjnBOC7BP0M"
    TELEGRAM_CHAT_ID: str = "6931799020"
    
    # Backup (relative to exe/script location)
    BACKUP_DIRECTORY: str = str(BASE_DIR / "backups")
    BACKUP_INTERVAL_HOURS: int = 24
    
    # File Upload (relative to exe/script location)
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIRECTORY: str = str(BASE_DIR / "uploads")

settings = Settings()