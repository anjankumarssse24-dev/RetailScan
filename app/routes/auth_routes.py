"""
Auth routes - Firebase authentication endpoints
"""
from flask import Blueprint, jsonify, request, session
from app.services.auth_service import verify_firebase_token, login_user, logout_user, get_current_user

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/verify", methods=["POST"])
def verify_token():
    """Verify Firebase ID token and create session."""
    data = request.get_json()
    if not data or "token" not in data:
        return jsonify({"success": False, "error": "No token provided"}), 400

    token = data["token"]
    user_info = verify_firebase_token(token)

    if not user_info:
        return jsonify({"success": False, "error": "Invalid token"}), 401

    login_user(user_info)

    return jsonify({
        "success": True,
        "user": {
            "name": user_info["name"],
            "email": user_info["email"],
            "picture": user_info["picture"],
            "role": session["user"]["role"],
            "reward_points": session["user"]["reward_points"],
            "membership_tier": session["user"]["membership_tier"],
        }
    })


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    """Clear user session."""
    logout_user()
    return jsonify({"success": True})


@auth_bp.route("/api/auth/user", methods=["GET"])
def get_user():
    """Get current logged-in user info."""
    user = get_current_user()
    if user:
        return jsonify({
            "success": True,
            "logged_in": True,
            "user": {
                "uid": user.get("uid", ""),
                "name": user.get("name", ""),
                "email": user.get("email", ""),
                "picture": user.get("picture", ""),
                "role": user.get("role", "customer"),
                "reward_points": user.get("reward_points", 0),
                "membership_tier": user.get("membership_tier", "bronze"),
                "total_spent": user.get("total_spent", 0.0),
                "total_orders": user.get("total_orders", 0),
            }
        })
    return jsonify({"success": True, "logged_in": False})


@auth_bp.route("/api/loyalty", methods=["GET"])
def get_loyalty():
    """Return full loyalty summary for the current user."""
    from flask import session
    from app.services.loyalty_service import get_loyalty_summary

    uid = session.get("user", {}).get("uid")
    if not uid:
        return jsonify({"success": False, "error": "Not authenticated"}), 401

    summary = get_loyalty_summary(uid)
    if not summary:
        return jsonify({"success": False, "error": "User not found"}), 404

    return jsonify({"success": True, **summary})
