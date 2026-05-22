"""
Database service - SQLite operations
"""
import sqlite3
from app.config import Config
from app.models.schema import SCHEMA_SQL


def get_connection():
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database and create tables."""
    conn = get_connection()
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()


def save_image_metadata(image_path, timestamp):
    """Save captured image metadata. Returns the image id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO images (image_path, timestamp) VALUES (?, ?)", (image_path, timestamp))
    conn.commit()
    image_id = cursor.lastrowid
    conn.close()
    return image_id


def save_detection(image_id, product_name, category):
    """Save detection result. Returns the detection id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO detections (image_id, product_name, category) VALUES (?, ?, ?)",
                   (image_id, product_name, category))
    conn.commit()
    detection_id = cursor.lastrowid
    conn.close()
    return detection_id


def add_to_cart(detection_id, product_name, category, price, timestamp):
    """Add a detected product to the cart."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO cart (detection_id, product_name, category, price, quantity, added_at) VALUES (?, ?, ?, ?, 1, ?)",
        (detection_id, product_name, category, price, timestamp))
    conn.commit()
    conn.close()


def get_cart_items():
    """Get all items in the cart."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cart ORDER BY added_at DESC")
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return items


def get_cart_total():
    """Get total amount of items in the cart."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT SUM(price * quantity) as total FROM cart")
    result = cursor.fetchone()
    total = result["total"] if result["total"] else 0.0
    conn.close()
    return total


def remove_from_cart(cart_id):
    """Remove an item from the cart."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cart WHERE id = ?", (cart_id,))
    conn.commit()
    conn.close()


def clear_cart():
    """Clear all items from the cart."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cart")
    conn.commit()
    conn.close()


def get_all_detections():
    """Get all detection records with image info."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.id, d.product_name, d.category, i.image_path, i.timestamp
        FROM detections d
        JOIN images i ON d.image_id = i.id
        ORDER BY i.timestamp DESC
    """)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results


# ========================
# WALLET
# ========================

def get_wallet_balance():
    """Get current wallet balance."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT balance FROM wallet WHERE id = 1")
    row = cursor.fetchone()
    balance = row["balance"] if row else 10000.0
    conn.close()
    return balance


def update_wallet_balance(new_balance):
    """Update wallet balance."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE wallet SET balance = ? WHERE id = 1", (new_balance,))
    conn.commit()
    conn.close()


# ========================
# TRANSACTIONS (Payment History)
# ========================

def save_transaction(transaction_id, amount, items_count, items_json,
                     balance_before, balance_after, timestamp,
                     subtotal=None, total_discount=0.0,
                     membership_discount=0.0, bulk_discount=0.0,
                     cart_discount=0.0, promo_discount=0.0, promo_name=None):
    """Save a payment transaction with full discount breakdown."""
    if subtotal is None:
        subtotal = amount
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO transactions
           (transaction_id, amount, subtotal, total_discount,
            membership_discount, bulk_discount, cart_discount,
            promo_discount, promo_name, items_count, items_json,
            balance_before, balance_after, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (transaction_id, amount, subtotal, total_discount,
         membership_discount, bulk_discount, cart_discount,
         promo_discount, promo_name, items_count, items_json,
         balance_before, balance_after, timestamp))
    conn.commit()
    conn.close()


# ========================
# USERS
# ========================

def upsert_user(firebase_uid, name, email, created_at):
    """Insert a new user or update name/email if they already exist. Returns the full user row as dict."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO users (firebase_uid, name, email, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(firebase_uid) DO UPDATE SET
            name  = CASE WHEN excluded.name  != '' THEN excluded.name  ELSE users.name  END,
            email = CASE WHEN excluded.email != '' THEN excluded.email ELSE users.email END
        """,
        (firebase_uid, name, email, created_at),
    )
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cursor.fetchone()
    user = dict(row) if row else None
    conn.close()
    return user


def get_user_by_uid(firebase_uid):
    """Return user profile dict by Firebase UID, or None if not found."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cursor.fetchone()
    user = dict(row) if row else None
    conn.close()
    return user


def set_user_role(firebase_uid, role):
    """Update a user's role. Allowed values: 'customer', 'admin'."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = ? WHERE firebase_uid = ?", (role, firebase_uid))
    conn.commit()
    conn.close()


def get_admin_count():
    """Return the number of admin users in the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
    row = cursor.fetchone()
    count = row["cnt"] if row else 0
    conn.close()
    return count


def _compute_membership_tier(total_spent):
    """Derive membership tier from cumulative spend.
    Bronze (default) | Silver >= 5,000 | Gold >= 15,000 | Platinum >= 50,000
    """
    if total_spent >= 50000:
        return "platinum"
    if total_spent >= 15000:
        return "gold"
    if total_spent >= 5000:
        return "silver"
    return "bronze"


def award_points_and_update_stats(firebase_uid, order_amount):
    """Add reward points (1 pt per ₹10 spent), update total_spent, total_orders, and recalculate tier."""
    points_earned = int(order_amount // 10)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE users
        SET reward_points = reward_points + ?,
            total_spent   = total_spent + ?,
            total_orders  = total_orders + 1
        WHERE firebase_uid = ?
        """,
        (points_earned, order_amount, firebase_uid),
    )
    conn.commit()
    cursor.execute("SELECT total_spent FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cursor.fetchone()
    if row:
        new_tier = _compute_membership_tier(row["total_spent"])
        cursor.execute("UPDATE users SET membership_tier = ? WHERE firebase_uid = ?", (new_tier, firebase_uid))
        conn.commit()
    cursor.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cursor.fetchone()
    user = dict(row) if row else None
    conn.close()
    return user


def get_transactions(date_filter=None):
    """Get payment history, optionally filtered by date (YYYY-MM-DD)."""
    conn = get_connection()
    cursor = conn.cursor()
    if date_filter:
        cursor.execute("SELECT * FROM transactions WHERE timestamp LIKE ? ORDER BY timestamp DESC", (f"{date_filter}%",))
    else:
        cursor.execute("SELECT * FROM transactions ORDER BY timestamp DESC")
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results


# ========================
# REWARD HISTORY
# ========================

def save_reward_history(firebase_uid, transaction_id, points_earned, points_used=0):
    """Insert a reward_history record for a completed transaction."""
    from datetime import datetime, timezone
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO reward_history (firebase_uid, transaction_id, points_earned, points_used, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (firebase_uid, transaction_id, points_earned, points_used,
         datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def get_reward_history(firebase_uid, limit=10):
    """Return recent reward events for a user, newest first."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, transaction_id, points_earned, points_used, created_at
        FROM reward_history
        WHERE firebase_uid = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (firebase_uid, limit),
    )
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results


def get_top_loyalty_users(limit=5):
    """Return top users by reward_points for admin analytics."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT firebase_uid, name, email, reward_points, membership_tier, total_spent, total_orders
        FROM users
        WHERE role = 'customer'
        ORDER BY reward_points DESC
        LIMIT ?
        """,
        (limit,),
    )
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results
