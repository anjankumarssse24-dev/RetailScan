"""
Utility helpers
"""
from datetime import datetime


def get_timestamp():
    """Return current timestamp string."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_file_timestamp():
    """Return timestamp suitable for filenames."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")
