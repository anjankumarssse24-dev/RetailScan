"""
App Factory for Smart Retail Checkout System
"""
from flask import Flask, redirect, url_for, session, request
import os
import mimetypes

# Fix MIME types on Linux servers where they may be missing
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/manifest+json", ".webmanifest")


def create_app():
    """Create and configure the Flask application."""
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates"),
        static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"),
        instance_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance")
    )

    # Load config first so SECRET_KEY is available
    from app.config import Config
    app.config.from_object(Config)
    app.secret_key = Config.SECRET_KEY

    # Ensure directories exist
    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs(Config.CAPTURED_IMAGES_DIR, exist_ok=True)

    # Initialize database
    from app.services.db_service import init_db
    init_db()

    # Register blueprints
    from app.routes.main_routes import main_bp
    from app.routes.camera_routes import camera_bp
    from app.routes.detection_routes import detection_bp
    from app.routes.cart_routes import cart_bp
    from app.routes.payment_routes import payment_bp
    from app.routes.auth_routes import auth_bp
    from app.routes.admin_routes import admin_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(camera_bp)
    app.register_blueprint(detection_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)

    # Login-required middleware
    PUBLIC_ROUTES = {"main.login_page", "auth.verify_token", "static"}

    # The admin/api/setup endpoint is intentionally public (unauthenticated check inside)
    PUBLIC_PATHS = {"/admin/api/setup"}

    @app.before_request
    def require_login():
        # Always allow static assets
        if request.path.startswith("/static/"):
            return
        # Allow explicit public paths (first-run setup)
        if request.path in PUBLIC_PATHS:
            return
        # Allow named public routes (login page, token verify)
        if request.endpoint and request.endpoint in PUBLIC_ROUTES:
            return
        if not session.get("logged_in"):
            # Return JSON 401 for any API path
            if request.path.startswith("/api/") or "/api/" in request.path:
                from flask import jsonify
                return jsonify({"success": False, "error": "Not authenticated"}), 401
            return redirect(url_for("main.login_page"))

    return app
