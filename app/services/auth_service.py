"""
Auth service - Firebase token verification and session management
"""
import time
from functools import wraps
from datetime import datetime, timezone
import jwt  # PyJWT
import requests
from cryptography.x509 import load_pem_x509_certificate
from flask import session, redirect, url_for, request, jsonify

FIREBASE_PROJECT_ID = "smartcart-6de46"
GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

# Cache for Google's public keys (extracted from X.509 certs)
_cached_keys = None
_keys_expiry = 0


def _get_public_keys():
    """Fetch Google's X.509 certs and extract RSA public keys, with caching."""
    global _cached_keys, _keys_expiry
    now = time.time()
    if _cached_keys and now < _keys_expiry:
        return _cached_keys

    resp = requests.get(GOOGLE_CERTS_URL)
    resp.raise_for_status()
    certs = resp.json()

    # Extract the public key from each X.509 certificate
    keys = {}
    for kid, cert_pem in certs.items():
        cert = load_pem_x509_certificate(cert_pem.encode("utf-8"))
        keys[kid] = cert.public_key()

    _cached_keys = keys
    _keys_expiry = now + 3600
    return _cached_keys


def verify_firebase_token(id_token):
    """Verify Firebase ID token using Google's public keys and return user info."""
    try:
        # Decode header to get the key ID
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        if not kid:
            print("[AUTH] No kid in token header")
            return None

        # Get public keys
        keys = _get_public_keys()
        public_key = keys.get(kid)
        if not public_key:
            # Key might have rotated, force refresh
            global _keys_expiry
            _keys_expiry = 0
            keys = _get_public_keys()
            public_key = keys.get(kid)
            if not public_key:
                print(f"[AUTH] kid '{kid}' not found in Google certs")
                return None

        # Verify and decode the token
        decoded = jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
        )

        # Extract user info
        return {
            "uid": decoded["sub"],
            "email": decoded.get("email", ""),
            "name": decoded.get("name", decoded.get("email", "User")),
            "picture": decoded.get("picture", ""),
        }
    except jwt.ExpiredSignatureError:
        print("[AUTH] Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"[AUTH] Invalid token: {e}")
        return None
    except Exception as e:
        print(f"[AUTH] Verification error: {e}")
        return None


def login_user(user_info):
    """Persist user to DB, then store enriched profile in Flask session."""
    from app.services.db_service import upsert_user, set_user_role
    from app.config import Config
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db_user = upsert_user(
        firebase_uid=user_info["uid"],
        name=user_info["name"],
        email=user_info["email"],
        created_at=created_at,
    )

    # Auto-promote if this email is the designated admin email
    admin_email = Config.ADMIN_EMAIL.strip().lower()
    if admin_email and user_info["email"].strip().lower() == admin_email:
        if db_user and db_user.get("role") != "admin":
            set_user_role(user_info["uid"], "admin")
            db_user["role"] = "admin"

    session["user"] = {
        "uid": user_info["uid"],
        "email": user_info["email"],
        "name": user_info["name"],
        "picture": user_info["picture"],
        # DB-backed profile fields
        "role": db_user["role"] if db_user else "customer",
        "reward_points": db_user["reward_points"] if db_user else 0,
        "membership_tier": db_user["membership_tier"] if db_user else "bronze",
        "total_spent": db_user["total_spent"] if db_user else 0.0,
        "total_orders": db_user["total_orders"] if db_user else 0,
    }
    session["logged_in"] = True


def logout_user():
    """Clear user session."""
    session.pop("user", None)
    session.pop("logged_in", None)


def get_current_user():
    """Get current logged-in user from session."""
    if session.get("logged_in"):
        return session.get("user")
    return None


def is_logged_in():
    """Check if user is logged in."""
    return session.get("logged_in", False)


# ========================
# ACCESS-CONTROL DECORATORS
# ========================

def admin_required(f):
    """Decorator: user must be logged-in AND have role='admin'."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            if request.path.startswith("/api/") or "/api/" in request.path:
                return jsonify({"success": False, "error": "Not authenticated"}), 401
            return redirect(url_for("main.login_page"))
        if session.get("user", {}).get("role") != "admin":
            if request.path.startswith("/api/") or "/api/" in request.path:
                return jsonify({"success": False, "error": "Forbidden"}), 403
            # Customer trying admin area → send to scanner
            return redirect(url_for("main.index"))
        return f(*args, **kwargs)
    return decorated


def login_required(f):
    """Decorator: user must be logged-in (any role)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            if request.path.startswith("/api/") or "/api/" in request.path:
                return jsonify({"success": False, "error": "Not authenticated"}), 401
            return redirect(url_for("main.login_page"))
        return f(*args, **kwargs)
    return decorated
