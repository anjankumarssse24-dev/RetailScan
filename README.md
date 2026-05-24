# RetailScan — Intelligent Autonomous Retail Management & Smart Checkout Platform

> A self-service smart checkout system powered by **YOLOv8 real-time object detection**, Firebase authentication, and a full retail management backend — deployed on Render.

---

## Table of Contents

1. [Overview](#overview)
2. [Live Demo](#live-demo)
3. [Key Features](#key-features)
4. [Tech Stack](#tech-stack)
5. [YOLOv8 Detection Engine](#yolov8-detection-engine)
6. [Authentication](#authentication)
7. [Cart & Checkout](#cart--checkout)
8. [Discount & Loyalty System](#discount--loyalty-system)
9. [Payment System](#payment-system)
10. [Analytics & Heatmap](#analytics--heatmap)
11. [Email Receipts](#email-receipts)
12. [Project Structure](#project-structure)
13. [Setup & Run Locally](#setup--run-locally)
14. [Deployment](#deployment)

---

## Overview

RetailScan lets customers scan physical products with their phone camera, automatically identifies the items using a trained **YOLOv8 model**, adds them to a cart, applies smart discounts, and completes payment — all without manual barcode scanning or cashier assistance.

---

## Live Demo

**[https://retailscan.onrender.com](https://retailscan.onrender.com)**

---

## Key Features

| Feature | Details |
|---|---|
| **Live Camera Scan** | Browser `getUserMedia` streams live video; single-tap capture sends the frame for detection |
| **YOLOv8 Product Detection** | Custom-trained YOLOv8n model identifies retail products, returns name, category, confidence score, and price |
| **Video-feed Overlay** | Detection progress and results are shown directly on the camera view; camera stays live for the next scan |
| **Smart Cart** | Add individual items or all detected items at once; items animate out of results when added |
| **Multi-tier Discounts** | Membership, bulk, cart-value, and promo-code discounts stack (up to 100%) with live preview |
| **Loyalty Points** | Earn points on every purchase; tier progression (Bronze → Silver → Gold → Platinum) with a live progress bar |
| **UPI Payment Modal** | Bottom-sheet payment UI with branded Google Pay, PhonePe, Paytm, and BHIM UPI flows |
| **Order History** | Full transaction timeline with item breakdown, savings, and receipt download |
| **Store Heatmap** | Zone-based heatmap built from detection data (Produce, Dairy, Snacks, Beverages, Essentials, Offers) |
| **Email Receipts** | Branded HTML receipts with order summary, savings breakdown, and loyalty points — sent via Brevo API |
| **Admin Dashboard** | Revenue trends, top products, recent activity, customer list — all from real transaction data |
| **PWA-ready** | Web app manifest + service worker for "Add to Home Screen" on iOS and Android |
| **Firebase Auth** | Google Sign-In and Email/Password login; protected routes with session management |

---

## Tech Stack

### Backend
- **Python 3.11 / Flask 3.x** — Blueprint-based modular architecture
- **SQLite** (`instance/retail.db` locally, `/var/data/retail.db` on Render persistent disk)
- **Firebase Admin SDK** — server-side token verification
- **Gunicorn** — WSGI server (`--workers 1 --threads 4 --timeout 120`)

### Frontend
- **Bootstrap 5.3.3** + **Tailwind CSS CDN** (preflight disabled so Bootstrap wins the cascade)
- **Font Awesome 6.5** — icons throughout
- **Vanilla JavaScript** — no frontend framework; modular JS files per page
- **Glassmorphism light design system** — CSS variables, animated gradients, smooth transitions

### Detection
- **YOLOv8n** (Ultralytics) — lightweight nano model, fine-tuned on a retail product dataset
- Model file: `YOLOv8/yolov8n.pt`
- Inference runs server-side; captured JPEG frames are posted to `/api/capture`

### Infrastructure
- **Render.com** — free-tier web service with a persistent disk for the SQLite database
- **Brevo (formerly Sendinblue)** — transactional email API (HTTPS, port 443)
- **GitHub** — source control; Render auto-deploys on every push to `main`

---

## YOLOv8 Detection Engine

The detection pipeline:

1. The browser captures the current video frame onto a hidden `<canvas>`
2. The canvas is exported as a JPEG blob and `POST`-ed to `/api/capture` as `multipart/form-data`
3. Flask passes the image bytes to the `DetectionService` which runs YOLOv8n inference
4. Detected objects are mapped to a retail product catalogue (name, category, unit price)
5. Confidence scores, bounding box data, and product metadata are returned as JSON
6. The frontend renders each detected item as a card in the Detection Results panel
7. A brief summary overlay appears on the live camera feed, then fades away so the user can scan the next item

**Model details:**
- Architecture: YOLOv8 Nano (`yolov8n`) — optimised for mobile-speed inference
- Input: 640 × 640 px
- Trained classes: common retail items (packaged food, beverages, stationery, fresh produce, personal care)
- Confidence threshold: 0.35 (configurable in `detection_service.py`)

---

## Authentication

Powered by **Firebase Authentication** (project: `smartcart-6de46`):

- **Google Sign-In** — OAuth 2.0 one-tap login
- **Email / Password** — standard registration and login
- Firebase ID tokens are verified server-side via the Admin SDK on every protected API call
- Sessions are maintained with Flask-managed cookies; all cart and transaction data is tied to the Firebase UID

---

## Cart & Checkout

- `GET /api/cart/summary` — returns items, subtotal, all discount breakdowns, and final total
- Items are stored in the SQLite `cart_items` table keyed by Firebase UID
- Adding an item from Detection Results immediately removes it from the results panel (with a slide-out animation)
- "Add All to Cart" clears the entire results panel and shows a confirmation

---

## Discount & Loyalty System

Four independent discount layers are calculated and stacked:

| Layer | Trigger |
|---|---|
| **Membership discount** | Silver / Gold / Platinum tier |
| **Bulk discount** | ≥ 5 items in cart |
| **Cart-value discount** | Cart subtotal exceeds threshold |
| **Promo code** | Applied coupon (e.g., `FIRST50` gives ₹50 off first order) |

Combined discount is capped at **100%** of cart value. The live order summary panel updates all rows in real time.

**Loyalty points:** ₹1 spent = 1 point. Tier thresholds:

| Tier | Points required |
|---|---|
| Bronze | 0 |
| Silver | 500 |
| Gold | 1,500 |
| Platinum | 5,000 |

---

## Payment System

The UPI payment modal is a bottom-sheet design that mimics real payment apps:

- **Google Pay** — multi-colour branded header with G-o-o-g-l-e letter treatment
- **PhonePe** — purple (#5F259F) icon with P + dot mark
- **Paytm** — cyan (#00BAF2) Pay branding
- **BHIM UPI** — saffron-to-blue "BHIM" gradient

PIN entry uses a circular numpad (same UX pattern as native UPI apps). Entering the wrong PIN shows a shake animation and "Incorrect UPI PIN" error. On success, a processing animation plays, followed by a detailed success screen with a UPI reference number and order breakdown.

---

## Analytics & Heatmap

**Admin dashboard** (`/admin`) shows:
- Monthly revenue trend (real data from `transactions` table)
- Top 5 products by units sold (parsed from `items_json`)
- Recent activity feed (last 5 transactions)
- Customer list with order count, total spend, and loyalty tier

**Store heatmap** maps detected product categories to physical store zones:

| Zone | Categories |
|---|---|
| Produce | Fruits, vegetables, salad |
| Dairy | Milk, cheese, yoghurt |
| Snacks | Chips, biscuits, chocolate, candy |
| Beverages | Juice, water, soft drinks, coffee |
| Essentials | Pens, pencils, stationery, toiletries |
| Offers | Everything else |

Zone intensity is determined by detection frequency — zones that are scanned more appear hotter on the map.

---

## Email Receipts

Sent via **Brevo SMTP API** (HTTPS POST to `api.brevo.com/v3/smtp/email`):

- Triggered automatically after a successful checkout
- Includes: order summary table, itemised prices, discount breakdown, loyalty points earned, UPI reference
- Branded HTML template with indigo/purple header, green success banner, and monospace transaction ID

Configure via environment variable: `BREVO_API_KEY`

---

## Project Structure

```
RetailScan/
├── run.py                    # Entry point
├── requirements.txt
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── config.py             # Env-based config
│   ├── models/
│   │   └── schema.py         # SQLite schema creation
│   ├── routes/
│   │   ├── auth_routes.py
│   │   ├── camera_routes.py  # /api/capture — YOLOv8 inference endpoint
│   │   ├── cart_routes.py
│   │   ├── detection_routes.py
│   │   ├── main_routes.py
│   │   └── payment_routes.py
│   └── services/
│       ├── auth_service.py
│       ├── camera_service.py
│       ├── cart_service.py
│       ├── db_service.py
│       ├── email_service.py
│       └── payment_service.py
├── YOLOv8/
│   ├── app.py
│   ├── yolov8n.pt            # Trained model weights
│   └── services/
│       ├── camera_service.py
│       └── detection_service.py  # YOLOv8 inference logic
├── static/
│   ├── css/
│   │   ├── style.css
│   │   └── components.css
│   └── js/
│       ├── main.js           # Scanner page (camera + detection)
│       ├── cart.js
│       ├── payment.js
│       ├── history.js
│       └── nav-user.js
└── templates/
    ├── index.html            # Scanner / home
    ├── cart.html
    ├── payment.html
    └── history.html
```

---

## Setup & Run Locally

**Requirements:** Python 3.11+, a modern browser (Chrome / Safari for `getUserMedia`)

```bash
# 1. Clone
git clone https://github.com/anjankumarssse24-dev/RetailScan.git
cd RetailScan

# 2. Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1        # Windows PowerShell
# source venv/bin/activate         # macOS / Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set environment variables
# Create a .env file or set in your shell:
#   FIREBASE_CREDENTIALS   — path or JSON string of your Firebase service account key
#   BREVO_API_KEY          — for email receipts (optional for local testing)

# 5. Run
python run.py
```

Open **http://localhost:5000** in your browser.

---

## Deployment

The app is hosted on **[Render.com](https://render.com)**:

| Setting | Value |
|---|---|
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn run:app --workers 1 --threads 4 --timeout 120` |
| Persistent disk | Mounted at `/var/data` for the SQLite database |
| Environment variables | `FIREBASE_CREDENTIALS`, `BREVO_API_KEY`, `EMAIL_USER` set in Render Dashboard |
| Auto-deploy | Enabled — every push to `main` triggers a new deploy |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
