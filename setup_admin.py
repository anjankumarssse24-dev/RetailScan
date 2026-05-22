"""
setup_admin.py — Creates the admin@gmail.com Firebase account and sets admin role in SQLite.
Run once: python setup_admin.py
"""
import sys
import sqlite3
import requests
from datetime import datetime, timezone
import os

FIREBASE_API_KEY = "AIzaSyDQ_EfOL_VR8mSVtd21DB0WK7-2RBnyJS8"
ADMIN_EMAIL     = "admin@gmail.com"
ADMIN_PASSWORD  = "admin123"
ADMIN_NAME      = "Admin"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, "instance", "retail.db")

SIGNUP_URL  = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}"
SIGNIN_URL  = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"


def get_or_create_firebase_user():
    """Try to create the user; if already exists, sign in to get their UID."""
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "returnSecureToken": True
    }

    # --- Try signup first ---
    resp = requests.post(SIGNUP_URL, json=payload, timeout=10)
    data = resp.json()

    if "localId" in data:
        print(f"[Firebase] New account created — UID: {data['localId']}")
        return data["localId"]

    error_msg = data.get("error", {}).get("message", "")

    if error_msg == "EMAIL_EXISTS":
        # Account already exists — sign in to retrieve UID
        resp2 = requests.post(SIGNIN_URL, json=payload, timeout=10)
        data2 = resp2.json()
        if "localId" in data2:
            print(f"[Firebase] Account already exists — UID: {data2['localId']}")
            return data2["localId"]
        else:
            print(f"[Firebase] Sign-in failed: {data2.get('error', {}).get('message', 'Unknown error')}")
            sys.exit(1)

    print(f"[Firebase] Error: {error_msg}")
    sys.exit(1)


def set_admin_in_db(uid):
    """Upsert the admin user in SQLite with role='admin'."""
    if not os.path.exists(DB_PATH):
        print(f"[DB] Database not found at {DB_PATH}")
        print("[DB] Start the app once (python run.py) to create it, then re-run this script.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO users (firebase_uid, name, email, role, reward_points, membership_tier,
                           total_spent, total_orders, created_at)
        VALUES (?, ?, ?, 'admin', 0, 'bronze', 0.0, 0, ?)
        ON CONFLICT(firebase_uid) DO UPDATE SET
            name  = excluded.name,
            email = excluded.email,
            role  = 'admin'
    """, (uid, ADMIN_NAME, ADMIN_EMAIL, datetime.now(timezone.utc).isoformat()))
    conn.commit()

    row = conn.execute("SELECT * FROM users WHERE firebase_uid = ?", (uid,)).fetchone()
    conn.close()

    print(f"[DB]  email  : {row[3]}")
    print(f"[DB]  role   : {row[4]}")
    print(f"[DB]  uid    : {row[1]}")


if __name__ == "__main__":
    print("=" * 50)
    print("  RetailScan AI — Admin Account Setup")
    print("=" * 50)

    uid = get_or_create_firebase_user()
    set_admin_in_db(uid)

    print()
    print("=" * 50)
    print("  Admin account ready!")
    print(f"  Email    : {ADMIN_EMAIL}")
    print(f"  Password : {ADMIN_PASSWORD}")
    print("  Login at : /login  (redirects to /admin/dashboard)")
    print("=" * 50)
