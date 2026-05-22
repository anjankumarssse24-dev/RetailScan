"""
Detection routes - Capture and product recognition
"""
import os
from flask import Blueprint, jsonify, request
from app.services.camera_service import capture_image
from app.services.gemini_service import call_gemini_api
from app.services.db_service import save_image_metadata, save_detection, get_all_detections
from app.services.recommendation_service import get_scan_suggestions

detection_bp = Blueprint("detection", __name__)


@detection_bp.route("/api/capture", methods=["POST"])
def api_capture():
    """Capture image, detect products, return result with multi-item support."""
    image_path, timestamp = capture_image()
    if image_path is None:
        return jsonify({"success": False, "error": "Failed to capture image. Check camera."}), 500

    image_id = save_image_metadata(image_path, timestamp)
    result = call_gemini_api(image_path)

    # Handle error from Gemini
    if result.get("error"):
        return jsonify({
            "success": False,
            "error": result["error"],
            "image_path": os.path.basename(image_path),
        }), 500

    items = result.get("items", [])
    scene = result.get("scene", "")
    description = result.get("description", "")
    subtotal = result.get("subtotal", 0)

    # Save each detected item to DB
    detection_ids = []
    for item in items:
        name = item.get("name", "Unknown")
        category = item.get("category", "Unknown")
        det_id = save_detection(image_id, name, category)
        item["detection_id"] = det_id
        detection_ids.append(det_id)

    rel_path = os.path.basename(image_path)

    # Post-scan recommendations
    suggestions = get_scan_suggestions([i.get("name", "") for i in items]) if items else []

    return jsonify({
        "success": True,
        "image_id": image_id,
        "image_path": rel_path,
        "items": items,
        "scene": scene,
        "description": description,
        "total_items": len(items),
        "subtotal": subtotal,
        "currency": "INR",
        "timestamp": timestamp,
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
