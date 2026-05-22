"""
Database schema - Table definitions
"""

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer',
    reward_points INTEGER NOT NULL DEFAULT 0,
    membership_tier TEXT NOT NULL DEFAULT 'bronze',
    total_spent REAL NOT NULL DEFAULT 0.0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,
    product_name TEXT,
    category TEXT,
    FOREIGN KEY (image_id) REFERENCES images(id)
);

CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    price REAL DEFAULT 0.0,
    quantity INTEGER DEFAULT 1,
    added_at TEXT NOT NULL,
    FOREIGN KEY (detection_id) REFERENCES detections(id)
);

CREATE TABLE IF NOT EXISTS wallet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    balance REAL DEFAULT 10000.0
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL,
    amount REAL NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.0,
    total_discount REAL NOT NULL DEFAULT 0.0,
    membership_discount REAL NOT NULL DEFAULT 0.0,
    bulk_discount REAL NOT NULL DEFAULT 0.0,
    cart_discount REAL NOT NULL DEFAULT 0.0,
    promo_discount REAL NOT NULL DEFAULT 0.0,
    promo_name TEXT,
    items_count INTEGER NOT NULL,
    items_json TEXT,
    balance_before REAL,
    balance_after REAL,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    points_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid)
);

INSERT OR IGNORE INTO wallet (id, balance) VALUES (1, 10000.0);
"""
