"""
Configuration settings for Smart Retail Checkout System
"""
import os

# Load .env file if it exists (dev convenience; production uses real env vars)
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
except ImportError:
    pass  # python-dotenv not installed; use real env vars

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(24).hex())
    DEBUG = os.environ.get("DEBUG", "true").lower() not in ("false", "0", "no")

    # Database — overridden by DATABASE_PATH env var on Render (persistent disk)
    DATABASE_PATH = os.environ.get(
        "DATABASE_PATH",
        os.path.join(BASE_DIR, "instance", "retail.db")
    )

    # Captured images — overridden by CAPTURED_IMAGES_DIR env var on Render
    CAPTURED_IMAGES_DIR = os.environ.get(
        "CAPTURED_IMAGES_DIR",
        os.path.join(BASE_DIR, "captured_images")
    )

    # Gemini API Keys — tried in order 1→2→3→4; switches on 429/quota-exceeded
    # Set these as environment variables (locally via .env, on Render via Dashboard)
    GEMINI_API_KEY_1 = os.environ.get("GEMINI_API_KEY_1", "")
    GEMINI_API_KEY_2 = os.environ.get("GEMINI_API_KEY_2", "")
    GEMINI_API_KEY_3 = os.environ.get("GEMINI_API_KEY_3", "")
    GEMINI_API_KEY_4 = os.environ.get("GEMINI_API_KEY_4", "")

    # Backward-compat aliases so any code still using these names works
    GEMINI_API_KEY          = GEMINI_API_KEY_1
    GEMINI_API_KEY_FALLBACK = GEMINI_API_KEY_2

    # Gemini model
    GEMINI_MODELS = [
        "gemini-flash-latest",
    ]

    # Max image dimension for resizing before sending
    GEMINI_MAX_IMG_DIM = 500

    # Max retries per model on rate-limit (1 = no retry)
    GEMINI_MAX_RETRY = 1

    # Camera settings
    CAMERA_INDEX = 0

    # SMTP Email settings
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 465
    EMAIL_USER = os.environ.get("EMAIL_USER", "")
    EMAIL_PASS = os.environ.get("EMAIL_PASS", "")

    # Admin email — any user logging in with this email gets admin role automatically
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
