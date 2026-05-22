"""
Camera routes - Video feed streaming + start/stop controls
"""
from flask import Blueprint, Response, jsonify
from app.services.camera_service import generate_frames, init_camera, stop_camera, is_camera_active

camera_bp = Blueprint("camera", __name__)


@camera_bp.route("/video_feed")
def video_feed():
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@camera_bp.route("/api/camera/start", methods=["POST"])
def api_camera_start():
    if is_camera_active():
        return jsonify({"success": True, "message": "Camera already running"})
    result = init_camera()
    if result:
        return jsonify({"success": True, "message": "Camera started"})
    return jsonify({"success": False, "error": "Failed to start camera"}), 500


@camera_bp.route("/api/camera/stop", methods=["POST"])
def api_camera_stop():
    stop_camera()
    return jsonify({"success": True, "message": "Camera stopped"})


@camera_bp.route("/api/camera/status", methods=["GET"])
def api_camera_status():
    return jsonify({"success": True, "active": is_camera_active()})
