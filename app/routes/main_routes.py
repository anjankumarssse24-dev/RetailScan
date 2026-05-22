"""
Main routes - Page rendering and static file serving
"""
from flask import Blueprint, render_template, send_from_directory, session, send_file, make_response
import os
from app.config import Config

main_bp = Blueprint("main", __name__)


@main_bp.route("/login")
def login_page():
    return render_template("login.html")


@main_bp.route("/")
def index():
    return render_template("index.html")


@main_bp.route("/cart")
def cart_page():
    return render_template("cart.html")


@main_bp.route("/history")
def history_page():
    return render_template("history.html")


@main_bp.route("/payment")
def payment_page():
    return render_template("payment.html")


@main_bp.route("/profile")
def profile_page():
    return render_template("profile.html")


@main_bp.route("/offers")
def offers_page():
    return render_template("offers.html")


@main_bp.route("/captured_images/<filename>")
def serve_captured_image(filename):
    return send_from_directory(Config.CAPTURED_IMAGES_DIR, filename)


# ── PWA Routes ──────────────────────────────────────────────────

@main_bp.route("/sw.js")
def service_worker():
    """Serve service worker from root scope (required for PWA)."""
    sw_path = os.path.join(os.path.dirname(__file__), "..", "..", "static", "sw.js")
    sw_path = os.path.abspath(sw_path)
    resp = make_response(send_file(sw_path, mimetype="application/javascript"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Service-Worker-Allowed"] = "/"
    return resp


@main_bp.route("/offline")
def offline_page():
    """Offline fallback page (cached by service worker)."""
    return render_template("offline.html")


@main_bp.route("/manifest.json")
def web_manifest():
    """Serve manifest from root URL (canonical PWA path)."""
    manifest_path = os.path.join(os.path.dirname(__file__), "..", "..", "static", "manifest.json")
    manifest_path = os.path.abspath(manifest_path)
    resp = make_response(send_file(manifest_path, mimetype="application/manifest+json"))
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp
