"""
Detection routes - Capture and product recognition
"""
import os
import re
import base64
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.services.camera_service import capture_image
from app.services.gemini_service import call_gemini_api
from app.services.db_service import save_image_metadata, save_detection, get_all_detections
from app.services.recommendation_service import get_scan_suggestions
from app.config import Config

detection_bp = Blueprint("detection", __name__)


@detection_bp.route("/api/capture", methods=["POST"])
def api_capture():
    """
    Capture and detect products.
    Accepts either:
      - multipart/form-data with field 'image' (browser camera upload)
      - plain POST with no body (legacy server-side OpenCV, local dev only)
    """
    # ── Browser camera upload (FormData) ──────────────────────────────────────
    if "image" in request.files:
        file = request.files["image"]
        os.makedirs(Config.CAPTURED_IMAGES_DIR, exist_ok=True)
        timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename   = f"capture_{timestamp}.jpg"
        image_path = os.path.join(Config.CAPTURED_IMAGES_DIR, filename)
        file.save(image_path)

    # ── Legacy: server-side OpenCV (local dev only) ────────────────────────────
    else:
        image_path, timestamp = capture_image()
        if image_path is None:
            return jsonify({"success": False,
                            "error": "No camera image received. Use browser camera."}), 400

    image_id = save_image_metadata(image_path, timestamp)
    result   = call_gemini_api(image_path)

    if result.get("error"):
        return jsonify({
            "success": False,
            "error": result["error"],
            "image_path": os.path.basename(image_path),
        }), 500

    items       = result.get("items", [])
    scene       = result.get("scene", "")
    description = result.get("description", "")
    subtotal    = result.get("subtotal", 0)

    for item in items:
        name     = item.get("name", "Unknown")
        category = item.get("category", "Unknown")
        det_id   = save_detection(image_id, name, category)
        item["detection_id"] = det_id

    rel_path    = os.path.basename(image_path)
    suggestions = get_scan_suggestions([i.get("name", "") for i in items]) if items else []

    return jsonify({
        "success":     True,
        "image_id":    image_id,
        "image_path":  rel_path,
        "items":       items,
        "scene":       scene,
        "description": description,
        "total_items": len(items),
        "subtotal":    subtotal,
        "currency":    "INR",
        "timestamp":   timestamp,
        "suggestions": suggestions,
    })


@detection_bp.route("/api/capture_frame", methods=["POST"])
def api_capture_frame():
    """
    Browser-camera capture endpoint.
    Accepts a base64-encoded JPEG from the client (getUserMedia canvas snapshot),
    saves it to disk, runs Gemini detection, and returns the same format as /api/capture.
    """
    data = request.get_json(silent=True)
    if not data or not data.get("image_data"):
        return jsonify({"success": False, "error": "No image data received"}), 400

    image_data = data["image_data"]
    match = re.match(r"data:image/\w+;base64,(.+)", image_data, re.DOTALL)
    if not match:
        return jsonify({"success": False, "error": "Invalid image format"}), 400

    try:
        img_bytes = base64.b64decode(match.group(1))
    except Exception:
        return jsonify({"success": False, "error": "Failed to decode image"}), 400

    # Save to captured_images/
    os.makedirs(Config.CAPTURED_IMAGES_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"frame_{timestamp}.jpg"
    image_path = os.path.join(Config.CAPTURED_IMAGES_DIR, filename)
    with open(image_path, "wb") as f:
        f.write(img_bytes)

    image_id = save_image_metadata(image_path, timestamp)
    result   = call_gemini_api(image_path)

    if result.get("error"):
        return jsonify({"success": False, "error": result["error"],
                        "image_path": filename}), 500

    items       = result.get("items", [])
    scene       = result.get("scene", "")
    description = result.get("description", "")
    subtotal    = result.get("subtotal", 0)

    for item in items:
        det_id = save_detection(image_id, item.get("name", "Unknown"), item.get("category", "Unknown"))
        item["detection_id"] = det_id

    suggestions = get_scan_suggestions([i.get("name", "") for i in items]) if items else []

    return jsonify({
        "success":     True,
        "image_id":    image_id,
        "image_path":  filename,
        "items":       items,
        "scene":       scene,
        "description": description,
        "total_items": len(items),
        "subtotal":    subtotal,
        "currency":    "INR",
        "timestamp":   timestamp,
        "suggestions": suggestions,
    })


@detection_bp.route("/api/detections", methods=["GET"])
def api_get_detections():
    """Get all detection history."""
    detections = get_all_detections()
    return jsonify({"success": True, "detections": detections})


@detection_bp.route("/api/scan-suggestions", methods=["GET"])
def api_scan_suggestions():
    """Return smart suggestions for a set of scanned product names."""
    names_raw = request.args.get("names", "")
    names     = [n.strip() for n in names_raw.split(",") if n.strip()]
    suggestions = get_scan_suggestions(names)
    return jsonify({"success": True, "suggestions": suggestions})
