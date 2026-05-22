# RetailScan — Smart Retail Checkout System
### Complete Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Pages & UI](#4-pages--ui)
5. [Backend Architecture](#5-backend-architecture)
6. [API Reference](#6-api-reference)
7. [Database Schema](#7-database-schema)
8. [Authentication Flow](#8-authentication-flow)
9. [AI Product Detection (Gemini)](#9-ai-product-detection-gemini)
10. [Payment System](#10-payment-system)
11. [Frontend JavaScript](#11-frontend-javascript)
12. [CSS Design System](#12-css-design-system)
13. [Running the Project](#13-running-the-project)

---

## 1. Project Overview

**RetailScan** is an AI-powered smart retail checkout system that allows users to:

- Point a live camera at products
- Automatically detect and identify retail items using **Google Gemini AI**
- Add detected products to a shopping cart
- Pay using a built-in **UPI wallet** system
- View full **purchase history** with email receipts

The system is built on **Flask (Python)** for the backend and uses **Firebase Authentication** for secure login.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3, Flask |
| **AI / Detection** | Google Gemini API (`gemini-flash-latest`) |
| **Authentication** | Firebase (Google OAuth + Email/Password) |
| **Database** | SQLite (via `sqlite3`) |
| **Camera** | OpenCV (`opencv-python`) |
| **Image Processing** | Pillow (PIL) |
| **Email** | SMTP (Gmail, SSL port 465) |
| **Frontend CSS** | Bootstrap 5.3 + Tailwind CSS (Preflight disabled) |
| **Frontend JS** | Vanilla JavaScript |
| **Icons** | Font Awesome 6.5 |
| **Fonts** | Google Fonts — Inter |

---

## 3. Project Structure

```
M Project/
│
├── run.py                        # Entry point — starts Flask server on port 5000
├── requirements.txt              # Python dependencies
│
├── app/
│   ├── __init__.py               # App factory — registers blueprints, middleware
│   ├── config.py                 # All configuration (API keys, DB path, SMTP, camera)
│   │
│   ├── models/
│   │   └── schema.py             # SQLite table definitions (CREATE TABLE SQL)
│   │
│   ├── routes/
│   │   ├── main_routes.py        # Page rendering routes (/, /cart, /history, /payment, /login)
│   │   ├── auth_routes.py        # Auth API (/api/auth/verify, /api/auth/user, /api/auth/logout)
│   │   ├── camera_routes.py      # Camera API (/api/camera/start, /stop, /status, /video_feed)
│   │   ├── detection_routes.py   # Detection API (/api/capture)
│   │   ├── cart_routes.py        # Cart API (/api/cart, /api/add_to_cart, /api/cart/remove)
│   │   └── payment_routes.py     # Payment API (/api/checkout, /api/wallet, /api/history)
│   │
│   └── services/
│       ├── auth_service.py       # Firebase token verification, session management
│       ├── camera_service.py     # OpenCV camera stream, frame capture
│       ├── gemini_service.py     # Google Gemini AI product detection
│       ├── db_service.py         # All SQLite database operations
│       ├── cart_service.py       # Cart business logic
│       ├── payment_service.py    # Wallet deduction, transaction saving
│       └── email_service.py      # SMTP email receipt sending
│
├── templates/
│   ├── index.html                # Scanner page (main page)
│   ├── login.html                # Login / Sign-up page
│   ├── cart.html                 # Shopping cart page
│   ├── payment.html              # Payment / checkout page
│   └── history.html              # Purchase history page
│
├── static/
│   ├── css/
│   │   └── style.css             # Full custom CSS (light theme, animations, components)
│   └── js/
│       ├── nav-user.js           # Shared navbar user avatar + dropdown logic
│       ├── auth.js               # Firebase authentication logic
│       ├── main.js               # Scanner page logic (camera, detect, add to cart)
│       ├── cart.js               # Cart page logic (display, remove, totals)
│       ├── payment.js            # Payment page logic (UPI modal, PIN, checkout)
│       └── history.js            # History page logic (load, filter by date)
│
├── captured_images/              # Saved camera captures (auto-created)
└── instance/
    └── retail.db                 # SQLite database (auto-created)
```

---

## 4. Pages & UI

### 4.1 Login Page — `/login`

The entry point for unauthenticated users.

**Features:**
- Tab switcher: **Login** / **Sign Up**
- Email + password fields with show/hide password toggle
- **Google OAuth** sign-in button
- Error display with friendly messages
- Redirects to Scanner (`/`) on successful authentication

**Auth handled by:** Firebase Authentication (client-side) → token sent to `/api/auth/verify`

---

### 4.2 Scanner Page — `/` (index)

The main page of the application.

**Features:**
- **Live Camera Feed** — Start/Stop camera via OpenCV MJPEG stream (`/video_feed`)
- Camera status pill (ONLINE / OFFLINE)
- **Capture & Detect** button — takes a snapshot and calls Gemini AI
- **Detection Result** panel — shows detected items with name, category, price, quantity controls
- **Add to Cart** button per item
- Animated scan line overlay during capture
- Loading overlay with animated ring while Gemini processes

**Camera Controls:**
| Button | Action |
|---|---|
| Start | `POST /api/camera/start` — opens OpenCV capture |
| Stop | `POST /api/camera/stop` — releases camera |
| Capture & Detect | `POST /api/capture` — saves image, calls Gemini, returns items |

---

### 4.3 Cart Page — `/cart`

Review and manage detected items before checkout.

**Features:**
- List of all cart items (name, category, price, quantity)
- Remove individual items (`DELETE /api/cart/remove/<id>`)
- Clear entire cart (`DELETE /api/cart/clear`)
- Total items count and total amount display
- **Proceed to Payment** button

---

### 4.4 Payment Page — `/payment`

Secure checkout using the built-in wallet.

**Features:**
- **Wallet hero card** showing available balance
- Order summary (item count + total amount)
- UPI ID display: `smartcart@upi`
- **Pay Now** button → opens UPI PIN modal
- **UPI PIN Modal** — 4-digit PIN entry (correct PIN: `1234`) with:
  - Animated dot indicators
  - Shake animation on wrong PIN
  - Processing spinner screen
  - Animated SVG checkmark on success
- Post-payment: receipt display + **email receipt** sent to user
- **Scan More** and **History** buttons on success

---

### 4.5 History Page — `/history`

Full record of all completed transactions.

**Features:**
- List of all transactions (transaction ID, date, items, amount)
- Date filter picker
- Empty state with call-to-action
- Expandable item list per transaction

---

## 5. Backend Architecture

### App Factory (`app/__init__.py`)

- Creates Flask app with custom template/static/instance paths
- Secret key for session management
- Initializes SQLite database on startup
- Registers all 6 blueprints
- **Login-required middleware** — `@app.before_request` redirects unauthenticated requests to `/login`

**Public routes** (no login required):
- `/login`
- `/api/auth/verify`
- `static` files

---

### Services

#### `auth_service.py`
- Verifies Firebase JWT tokens using Google's X.509 public keys
- Caches Google's public keys for 1 hour to avoid repeated fetches
- Stores user info (`uid`, `email`, `name`, `picture`) in Flask session

#### `camera_service.py`
- Manages OpenCV `VideoCapture` instance
- `generate_frames()` — MJPEG stream generator for `/video_feed`
- `capture_image()` — saves a JPEG snapshot to `captured_images/`
- `release_camera()` — called on server shutdown

#### `gemini_service.py`
- Sends captured images to Google Gemini API
- Uses **two API keys** (primary + fallback) for rate-limit resilience
- Sends a detailed retail-focused prompt ensuring only **sellable products** are detected
- Returns structured JSON with: `items[]`, `scene`, `description`, `subtotal`
- Each item includes: `name`, `category`, `price` (INR), `quantity`, `confidence`

#### `db_service.py`
- All SQLite CRUD operations
- Tables: `images`, `detections`, `cart`, `wallet`, `transactions`

#### `cart_service.py`
- `add_item_to_cart()` — upserts items (increments quantity if already exists)
- `get_cart()` — returns items + calculated total
- `remove_item()` / `clear_all()`

#### `payment_service.py`
- `process_payment()` — validates balance → deducts → saves transaction → clears cart
- `get_wallet()` — returns current wallet balance
- `get_payment_history()` — returns all transactions with optional date filter

#### `email_service.py`
- Sends HTML receipt email via Gmail SMTP (SSL, port 465)
- Email contains: transaction ID, timestamp, itemised list, total amount

---

## 6. API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/verify` | Verify Firebase token, create session |
| `GET` | `/api/auth/user` | Get current logged-in user info |
| `POST` | `/api/auth/logout` | Clear session, logout |

### Camera

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/video_feed` | MJPEG live stream |
| `POST` | `/api/camera/start` | Start OpenCV camera |
| `POST` | `/api/camera/stop` | Stop camera, release device |
| `GET` | `/api/camera/status` | Check if camera is active |

### Detection

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/capture` | Capture image + run Gemini AI detection |

**Response:**
```json
{
  "success": true,
  "image_id": 5,
  "image_path": "capture_20260521_142301.jpg",
  "items": [
    {
      "name": "Lay's Classic Salted Chips",
      "category": "Snacks",
      "price": 20.0,
      "quantity": 1,
      "confidence": "high",
      "detection_id": 12
    }
  ],
  "scene": "Retail shelf",
  "description": "Packaged snack items on a counter",
  "total_items": 1,
  "subtotal": 20.0,
  "currency": "INR",
  "timestamp": "2026-05-21 14:23:01"
}
```

### Cart

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/add_to_cart` | Add detected item to cart |
| `GET` | `/api/cart` | Get all cart items + total |
| `DELETE` | `/api/cart/remove/<id>` | Remove specific cart item |
| `DELETE` | `/api/cart/clear` | Clear entire cart |

### Payment

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/wallet` | Get wallet balance |
| `POST` | `/api/checkout` | Process payment, send email |
| `GET` | `/api/history` | Get transaction history (optional `?date=YYYY-MM-DD`) |

---

## 7. Database Schema

```sql
-- Captured images metadata
CREATE TABLE images (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path  TEXT NOT NULL,
    timestamp   TEXT NOT NULL
);

-- Gemini detection results
CREATE TABLE detections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id     INTEGER NOT NULL REFERENCES images(id),
    product_name TEXT,
    category     TEXT
);

-- Shopping cart (session-based per cart clear)
CREATE TABLE cart (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER NOT NULL REFERENCES detections(id),
    product_name TEXT NOT NULL,
    category     TEXT,
    price        REAL DEFAULT 0.0,
    quantity     INTEGER DEFAULT 1,
    added_at     TEXT NOT NULL
);

-- Single-row wallet (seeded with ₹10,000)
CREATE TABLE wallet (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    balance REAL DEFAULT 10000.0
);

-- Payment transaction history
CREATE TABLE transactions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL,
    amount         REAL NOT NULL,
    items_count    INTEGER NOT NULL,
    items_json     TEXT,
    balance_before REAL,
    balance_after  REAL,
    timestamp      TEXT NOT NULL
);
```

**Initial seed:** Wallet is seeded with `₹10,000.00` on first run.

---

## 8. Authentication Flow

```
Browser (Firebase SDK)
        │
        │  1. User signs in (Google OAuth or Email/Password)
        ▼
Firebase Auth Server
        │
        │  2. Returns Firebase ID Token (JWT)
        ▼
Browser → POST /api/auth/verify  { token: "<jwt>" }
        │
        ▼
Flask Backend (auth_service.py)
        │  3. Decode JWT header → get key ID (kid)
        │  4. Fetch Google X.509 certs → extract RSA public key
        │  5. Verify JWT signature, expiry, audience, issuer
        │
        │  6. On success → store in Flask session:
        │     session["user"] = { uid, email, name, picture }
        │     session["logged_in"] = True
        ▼
Browser ← { success: true, user: { name, email, picture } }
        │
        │  7. JS redirects to "/"
        ▼
All subsequent requests → session cookie checked by before_request middleware
```

---

## 9. AI Product Detection (Gemini)

### Model
`gemini-flash-latest` — fast, cost-effective vision model

### How It Works
1. User clicks **Capture & Detect**
2. Flask captures a JPEG frame from OpenCV
3. Image is resized to max 500px (configurable) to reduce token usage
4. Image + detailed retail prompt is sent to Gemini API
5. Gemini returns a JSON object with detected products

### Prompt Strategy
The prompt instructs Gemini to:
- **ONLY** detect physical sellable retail products
- **NEVER** detect people, backgrounds, furniture, screens
- Use **fixed prices** for known Indian retail products (Lay's, Pepsi, Maggi, etc.)
- Return confidence scores per item
- Handle multiple items in a single frame

### Dual API Key Fallback
```python
GEMINI_API_KEYS = [Config.GEMINI_API_KEY, Config.GEMINI_API_KEY_FALLBACK]
```
If the primary key hits a rate limit (429), the service automatically retries with the fallback key.

---

## 10. Payment System

### Wallet
- Initial balance: **₹10,000.00**
- Balance persisted in SQLite `wallet` table (single row, `id = 1`)
- Deducted on each successful checkout
- No top-up mechanism (demo system)

### UPI PIN Flow
1. User clicks **Pay Now**
2. Modal opens showing amount and UPI ID `smartcart@upi`
3. User enters 4-digit PIN using on-screen keypad
4. **Correct PIN:** `1234`
5. On correct PIN → `POST /api/checkout`:
   - Balance checked
   - Amount deducted from wallet
   - Transaction saved to DB
   - Cart cleared
   - Email receipt sent
6. Success screen with animated checkmark and receipt details

### Transaction ID Format
```
TXN_YYYYMMDDHHMMSS
Example: TXN_20260521142301
```

---

## 11. Frontend JavaScript

### `nav-user.js` (Shared across all pages)
- Calls `GET /api/auth/user` on page load
- Populates desktop avatar (initials or profile picture)
- Populates mobile collapse user section (name, email, logout)
- `toggleUserDropdown()` — shows/hides desktop account dropdown
- `handleLogout()` — calls `POST /api/auth/logout`, redirects to `/login`

### `auth.js`
- Firebase SDK initialization
- `handleEmailAuth()` — login or signup with email/password
- `handleGoogleLogin()` — Google OAuth popup
- `verifyWithBackend()` — sends Firebase ID token to `/api/auth/verify`
- `switchTab()` — toggles Login/Signup form fields
- `togglePassword()` — show/hide password input

### `main.js` (Scanner page)
- `startCamera()` → `POST /api/camera/start` + shows MJPEG feed
- `stopCamera()` → `POST /api/camera/stop`
- `captureAndDetect()` → `POST /api/capture` → renders detection results
- `addItemToCart(item)` → `POST /api/add_to_cart`
- Renders detected items with quantity selectors
- Updates cart badge count in navbar

### `cart.js`
- Loads cart via `GET /api/cart`
- Renders each item card with remove button
- `removeItem(id)` → `DELETE /api/cart/remove/<id>`
- `clearCart()` → `DELETE /api/cart/clear`
- Updates totals dynamically

### `payment.js`
- Loads wallet balance and cart summary on page load
- `openModal()` — shows UPI PIN modal
- PIN entry via `data-key` buttons + keyboard
- `handlePin(key)` — builds PIN string, fills dot indicators
- `submitPin()` — validates PIN, calls `POST /api/checkout`
- Handles 3 modal steps: pin-entry → processing → success
- Shake animation on wrong PIN
- `handleDone()` — hides modal, shows success screen on page

### `history.js`
- Loads transactions via `GET /api/history`
- Date filter → `GET /api/history?date=YYYY-MM-DD`
- Renders expandable transaction cards
- Empty state handling

---

## 12. CSS Design System

### Color Palette

| Variable | Value | Usage |
|---|---|---|
| `--primary` | `#6366f1` | Indigo — buttons, links, active states |
| `--secondary` | `#8b5cf6` | Violet — gradients, accents |
| `--accent` | `#06b6d4` | Cyan — scan line, highlights |
| `--success` | `#10b981` | Emerald — payment success, online status |
| `--danger` | `#ef4444` | Red — errors, remove, logout |
| `--warning` | `#f59e0b` | Amber — cart, warnings |
| `--text-primary` | `#1e1b4b` | Dark indigo — main text |
| `--text-secondary` | `#64748b` | Slate grey — labels, hints |

### Body Background
Soft animated gradient: `Sky Blue → Lavender → Mint`
```css
background: linear-gradient(135deg, #e0f2fe 0%, #f5f3ff 50%, #ecfdf5 100%);
```

### Key CSS Classes

| Class | Purpose |
|---|---|
| `.glass-card` | White frosted glass card with indigo shadow |
| `.glass-nav` | Sticky navbar with blur backdrop |
| `.rs-nav-link` | Custom navbar links (avoids Bootstrap conflict) |
| `.rs-toggler` | Animated 3-bar hamburger button |
| `.btn-glow` / `.btn-glow-primary` | Gradient buttons with shine animation |
| `.status-pill` | ONLINE/OFFLINE badge with pulsing dot |
| `.scan-line` | Animated sweep line on camera feed |
| `.cart-badge` | Red-orange pill badge with pulse animation |
| `.toast-notification` | Slide-in toast (success/error/info) |
| `.upi-modal` | Payment PIN modal with backdrop blur |
| `.wallet-hero` | Gradient hero card showing wallet balance |
| `.txn-card` | Transaction history card with hover lift |

### Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|---|---|---|
| Mobile | < 768px | Hamburger menu, stacked layout, full-width cards |
| Tablet (md) | ≥ 768px | Navbar expands, 2-column scanner grid |
| Desktop (lg) | ≥ 992px | Full layout, max-width containers |
| Wide (xl) | ≥ 1200px | `container-xl` caps content width |

---

## 13. Running the Project

### Prerequisites
```
Python 3.9+
A webcam connected to the machine
Internet connection (for Firebase, Gemini API, CDNs)
```

### Install Dependencies
```bash
pip install flask opencv-python requests google-generativeai Pillow PyJWT cryptography
```

Or with the requirements file:
```bash
pip install -r requirements.txt
# Also install missing packages:
pip install PyJWT cryptography
```

### Start the Server
```bash
python run.py
```

Server starts at: **http://localhost:5000**

### First Run
1. Navigate to `http://localhost:5000`
2. Redirected to `/login` (not authenticated)
3. Sign in with Google or Email/Password
4. Redirected to Scanner page (`/`)
5. Click **Start Camera** → webcam activates
6. Point camera at a product → click **Capture & Detect**
7. Gemini AI identifies items → add to cart
8. Navigate to **Cart** → review items
9. Navigate to **Pay** → click Pay Now → enter PIN `1234`
10. Payment processed → email receipt sent

### Configuration (`app/config.py`)

| Setting | Description |
|---|---|
| `GEMINI_API_KEY` | Primary Google Gemini API key |
| `GEMINI_API_KEY_FALLBACK` | Secondary key for rate-limit resilience |
| `GEMINI_MODELS` | List of Gemini models to use |
| `GEMINI_MAX_IMG_DIM` | Max image dimension before sending (default: 500px) |
| `CAMERA_INDEX` | OpenCV camera index (0 = default webcam) |
| `EMAIL_USER` | Gmail account for sending receipts |
| `DATABASE_PATH` | Path to SQLite database file |
| `CAPTURED_IMAGES_DIR` | Directory for saved camera captures |

---

*Generated: May 21, 2026 — RetailScan v1.0*
