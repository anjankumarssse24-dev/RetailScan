"""
Camera service - OpenCV webcam handling
"""
import os
from datetime import datetime
from app.config import Config

# Try to import cv2 — not available in headless/cloud environments
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# Global camera instance
camera = None


def init_camera():
    """Initialize the webcam. Returns True if successful."""
    global camera
    if not CV2_AVAILABLE:
        print("[WARN] OpenCV not available — camera disabled (cloud/server mode).")
        return False
    try:
        camera = cv2.VideoCapture(Config.CAMERA_INDEX)
        if not camera.isOpened():
            print("[ERROR] Camera not accessible. Check if webcam is connected.")
            return False
        print("[INFO] Camera initialized successfully.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to initialize camera: {e}")
        return False


def get_frame():
    """Capture a single frame from the camera."""
    global camera
    if not CV2_AVAILABLE or camera is None or not camera.isOpened():
        return None
    ret, frame = camera.read()
    return frame if ret else None


def generate_frames():
    """Generator for Flask video streaming."""
    global camera
    if not CV2_AVAILABLE:
        return  # yield nothing — stream ends cleanly
    if camera is None or not camera.isOpened():
        init_camera()

    while True:
        frame = get_frame()
        if frame is None:
            break
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')


def capture_image():
    """Capture current frame and save as JPG. Returns (image_path, timestamp) or (None, None)."""
    global camera
    if not CV2_AVAILABLE:
        print("[WARN] Camera capture skipped — OpenCV not available.")
        return None, None
    if camera is None or not camera.isOpened():
        if not init_camera():
            return None, None

    frame = get_frame()
    if frame is None:
        print("[ERROR] Could not capture frame.")
        return None, None

    os.makedirs(Config.CAPTURED_IMAGES_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"image_{timestamp}.jpg"
    filepath = os.path.join(Config.CAPTURED_IMAGES_DIR, filename)

    cv2.imwrite(filepath, frame)
    print(f"[INFO] Image captured and saved: {filepath}")
    return filepath, timestamp


def is_camera_active():
    """Check if camera is currently active."""
    global camera
    return CV2_AVAILABLE and camera is not None and camera.isOpened()


def stop_camera():
    """Release the camera."""
    global camera
    if camera is not None:
        camera.release()
        camera = None
        print("[INFO] Camera stopped.")
        return True
    return False


def release_camera():
    """Alias for stop_camera — used on app shutdown."""
    stop_camera()
