"""
StudySync AI - Configuration Settings
Loads secrets securely from .env and system environment.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent

# Load .env from backend root
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class Config:
    """Centralized application configuration."""
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    PORT = int(os.getenv("PORT", 5000))
    HOST = os.getenv("HOST", "127.0.0.1")

    # Google Gemini API Key
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

    # Default Gemini Model
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    @classmethod
    def validate(cls):
        """Warn if critical keys are missing without crashing."""
        if not cls.GEMINI_API_KEY:
            print("[WARNING] GEMINI_API_KEY is not set in backend/.env. Using intelligent fallback simulation.")
        else:
            print("[INFO] GEMINI_API_KEY loaded successfully.")
