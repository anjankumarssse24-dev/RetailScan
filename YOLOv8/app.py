import os
from flask import Flask, render_template, Response, jsonify, url_for
from services.camera_service import CameraService
from services.detection_service import DetectionService

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CAPTURED_DIR = os.path.join(BASE_DIR, "static", "captured")
os.makedirs(CAPTURED_DIR, exist_ok=True)

# Load services once globally
detection_service = DetectionService(model_path="yolov8n.pt", confidence_threshold=0.5)
camera_service = CameraService(detection_service=detection_service)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/video_feed")
def video_feed():
    """Stream live camera feed with YOLO detections."""
    return Response(
        camera_service.generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/capture", methods=["POST"])
def capture():
    """Capture a single frame, run detection, save image, return results."""
    result = camera_service.capture_and_detect(CAPTURED_DIR)
    if result is None:
        return jsonify({"error": "Camera not available"}), 500
    return jsonify(result)


@app.route("/camera/start", methods=["POST"])
def start_camera():
    camera_service.start()
    return jsonify({"status": "started"})


@app.route("/camera/stop", methods=["POST"])
def stop_camera():
    camera_service.stop()
    return jsonify({"status": "stopped"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
