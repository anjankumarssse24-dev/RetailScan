"""
seed_demo_data.py — RetailScan Demo Data Seeder

Populates the database with realistic demo data so the app never
looks empty during a presentation.

Run from the project root:
    python seed_demo_data.py

Options (set flags at top of file or pass as env vars):
    SEED_USERS          — create 3 demo user accounts
    SEED_TRANSACTIONS   — create ~25 historical transactions
    SEED_DETECTIONS     — create ~60 product scan records
    SEED_CART           — leave cart empty (clean start for demo)
    SEED_LOYALTY        — update loyalty stats to realistic values
"""

import os
import sys
import json
import random
import sqlite3
from datetime import datetime, timedelta

# ── Config ───────────────────────────────────────────────────────
DB_PATH = os.path.join("instance", "retail.db")

SEED_USERS        = True
SEED_TRANSACTIONS = True
SEED_DETECTIONS   = True
SEED_LOYALTY      = True
WIPE_EXISTING     = False   # set True to clear tables first

# ── Demo users ───────────────────────────────────────────────────
DEMO_USERS = [
    {
        "firebase_uid": "demo_user_001",
        "name":         "Priya Sharma",
        "email":        "priya@demo.retailscan",
        "role":         "customer",
        "reward_points": 1240,
        "membership_tier": "gold",
        "total_spent":  12400.0,
        "total_orders": 18,
    },
    {
        "firebase_uid": "demo_user_002",
        "name":         "Rahul Mehta",
        "email":        "rahul@demo.retailscan",
        "role":         "customer",
        "reward_points": 380,
        "membership_tier": "silver",
        "total_spent":  3800.0,
        "total_orders": 7,
    },
    {
        "firebase_uid": "demo_user_003",
        "name":         "Ananya Kumar",
        "email":        "ananya@demo.retailscan",
        "role":         "customer",
        "reward_points": 60,
        "membership_tier": "bronze",
        "total_spent":  600.0,
        "total_orders": 2,
    },
]

# ── Product catalog ──────────────────────────────────────────────
PRODUCTS = [
    # (name, category, price)
    ("Lay's Classic Chips",       "Snacks",    30.0),
    ("Pringles Original",         "Snacks",    99.0),
    ("Oreo Biscuits",             "Snacks",    35.0),
    ("Britannia Marie Gold",      "Snacks",    25.0),
    ("Parle-G Biscuits",          "Snacks",    10.0),
    ("Too Yumm Chips",            "Snacks",    20.0),
    ("Haldiram's Bhujia",         "Snacks",    60.0),
    ("Pepsi 600ml",               "Beverages", 40.0),
    ("Coca-Cola 750ml",           "Beverages", 45.0),
    ("Sprite 600ml",              "Beverages", 40.0),
    ("7UP 600ml",                 "Beverages", 40.0),
    ("Tropicana Orange 1L",       "Beverages", 99.0),
    ("Red Bull 250ml",            "Beverages", 120.0),
    ("B Natural Apple Juice",     "Beverages", 75.0),
    ("Amul Milk 500ml",           "Dairy",     28.0),
    ("Amul Butter 500g",          "Dairy",     240.0),
    ("Amul Cheese Slice",         "Dairy",     90.0),
    ("Nestle Yogurt",             "Dairy",     35.0),
    ("Mother Dairy Paneer 200g",  "Dairy",     80.0),
    ("Britannia Bread",           "Essentials",45.0),
    ("Maggi 2-Minute Noodles",    "Essentials",14.0),
    ("Knorr Soup Packet",         "Essentials",40.0),
    ("Aashirvaad Atta 5kg",       "Essentials",260.0),
    ("Tata Salt 1kg",             "Essentials",28.0),
    ("Dove Soap",                 "Personal Care", 48.0),
    ("Colgate Toothpaste",        "Personal Care", 65.0),
    ("Head & Shoulders Shampoo",  "Personal Care", 175.0),
    ("Dettol Hand Wash",          "Personal Care", 80.0),
]

# ── Helpers ──────────────────────────────────────────────────────
def _rand_ts(days_ago_max=30, days_ago_min=0):
    """Random ISO timestamp within past N days."""
    seconds_ago = random.randint(days_ago_min * 86400, days_ago_max * 86400)
    dt = datetime.now() - timedelta(seconds=seconds_ago)
    # Bias toward retail hours 9AM–9PM
    dt = dt.replace(hour=random.randint(9, 21),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59))
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _txn_id():
    return f"TXN{random.randint(10000000, 99999999)}"


def _basket(n=None):
    """Return n random products from catalog."""
    count = n or random.randint(2, 6)
    return random.sample(PRODUCTS, min(count, len(PRODUCTS)))


# ── Seeding functions ─────────────────────────────────────────────
def seed_users(conn):
    cur = conn.cursor()
    created = 0
    for u in DEMO_USERS:
        cur.execute("SELECT id FROM users WHERE firebase_uid=?", (u["firebase_uid"],))
        if cur.fetchone():
            print(f"  ↷  User {u['name']} already exists — skipping")
            continue
        cur.execute("""
            INSERT INTO users
              (firebase_uid, name, email, role, reward_points,
               membership_tier, total_spent, total_orders, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            u["firebase_uid"], u["name"], u["email"], u["role"],
            u["reward_points"], u["membership_tier"],
            u["total_spent"], u["total_orders"],
            _rand_ts(days_ago_max=90),
        ))
        created += 1
        print(f"  ✓  Created user: {u['name']} ({u['membership_tier']} tier)")
    conn.commit()
    return created


def seed_detections(conn, count=60):
    cur = conn.cursor()
    created = 0
    for _ in range(count):
        ts = _rand_ts(days_ago_max=30)
        cur.execute("INSERT INTO images (image_path, timestamp) VALUES (?, ?)",
                    ("demo/scan.jpg", ts))
        img_id = cur.lastrowid
        product = random.choice(PRODUCTS)
        cur.execute("INSERT INTO detections (image_id, product_name, category) VALUES (?,?,?)",
                    (img_id, product[0], product[1]))
        created += 1
    conn.commit()
    print(f"  ✓  Seeded {created} product scan records")
    return created


def seed_transactions(conn, count=25):
    cur  = conn.cursor()
    uids = [u["firebase_uid"] for u in DEMO_USERS]

    # Check current wallet balance
    cur.execute("SELECT balance FROM wallet WHERE id=1")
    row = cur.fetchone()
    balance = row[0] if row else 10000.0

    created = 0
    for i in range(count):
        basket  = _basket()
        subtotal = sum(p[2] * random.randint(1, 3) for p in basket)
        # Random discount 0–20%
        disc_pct   = random.uniform(0, 0.20)
        total_disc = round(subtotal * disc_pct, 2)
        mem_disc   = round(total_disc * 0.5, 2)
        bulk_disc  = round(total_disc * 0.3, 2)
        cart_disc  = round(total_disc - mem_disc - bulk_disc, 2)
        amount     = round(subtotal - total_disc, 2)

        txn_id = _txn_id()
        ts     = _rand_ts(days_ago_max=30)

        items_json = json.dumps([
            {"name": p[0], "category": p[1], "unit_price": p[2], "qty": 1,
             "total": p[2]} for p in basket
        ])

        bal_before = balance
        balance    = max(0.0, balance - amount)
        bal_after  = balance

        cur.execute("""
            INSERT INTO transactions
              (transaction_id, amount, subtotal, total_discount,
               membership_discount, bulk_discount, cart_discount,
               promo_discount, promo_name, items_count, items_json,
               balance_before, balance_after, timestamp)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            txn_id, amount, subtotal, total_disc,
            mem_disc, bulk_disc, cart_disc,
            0.0, None, len(basket), items_json,
            bal_before, bal_after, ts,
        ))

        # Reward history for first user
        uid = random.choice(uids)
        pts = max(1, int(amount // 20))
        cur.execute("""
            INSERT INTO reward_history
              (firebase_uid, transaction_id, points_earned, points_used, created_at)
            VALUES (?,?,?,?,?)
        """, (uid, txn_id, pts, 0, ts))

        created += 1

    conn.commit()
    print(f"  ✓  Seeded {created} transactions")
    return created


def seed_loyalty(conn):
    """Ensure demo users have up-to-date loyalty stats."""
    cur = conn.cursor()
    for u in DEMO_USERS:
        cur.execute("""
            UPDATE users SET
              reward_points  = ?,
              membership_tier = ?,
              total_spent    = ?,
              total_orders   = ?
            WHERE firebase_uid = ?
        """, (u["reward_points"], u["membership_tier"],
              u["total_spent"], u["total_orders"],
              u["firebase_uid"]))
    conn.commit()
    print(f"  ✓  Updated loyalty stats for {len(DEMO_USERS)} demo users")


# ── Main ──────────────────────────────────────────────────────────
def main():
    if not os.path.exists(DB_PATH):
        print(f"  ✗  Database not found at {DB_PATH}")
        print("     Run the app once first to create the DB, then re-run this script.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if WIPE_EXISTING:
        print("  ⚠  WIPE_EXISTING=True — clearing demo data...")
        cur = conn.cursor()
        for uid in [u["firebase_uid"] for u in DEMO_USERS]:
            cur.execute("DELETE FROM users WHERE firebase_uid=?", (uid,))
        cur.execute("DELETE FROM transactions WHERE transaction_id LIKE 'TXN%'")
        conn.commit()

    print("\n  RetailScan Demo Data Seeder")
    print("  " + "─" * 38)

    if SEED_USERS:
        print("\n  [1/4] Seeding demo users...")
        seed_users(conn)

    if SEED_DETECTIONS:
        print("\n  [2/4] Seeding product scan history...")
        seed_detections(conn, count=60)

    if SEED_TRANSACTIONS:
        print("\n  [3/4] Seeding transaction history...")
        seed_transactions(conn, count=25)

    if SEED_LOYALTY:
        print("\n  [4/4] Updating loyalty profiles...")
        seed_loyalty(conn)

    conn.close()
    print("\n  ✅  Demo seed complete! Your app is presentation-ready.\n")


if __name__ == "__main__":
    main()
