"""
Heatmap Analytics Service — Step 9: Smart Store Heatmap

Generates simulated retail heatmap data derived from real DB activity:
  • Detections  → product scans at shelves → shelf zone heat
  • Cart adds   → engagement with specific zones
  • Transactions → checkout zone + purchase patterns
  • Timestamps  → peak-hour analysis

All (x, y) coordinates target a 600 × 460 canvas (pixels).
Zones use Gaussian spread so heat blobs look natural.
"""

import json
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from app.services.db_service import get_connection

# ================================================================
# STORE LAYOUT — canvas 600 × 460 px
#
#  ┌──────────────────────────────────┐
#  │  [Essentials]  [Checkout]  [Dairy] │  row y≈90–180
#  │  [Snacks]      [Offers]   [Bev.]  │  row y≈220–320
#  │         [ E N T R A N C E ]       │  row y≈390–450
#  └──────────────────────────────────┘
# ================================================================

CANVAS_W = 600
CANVAS_H = 460

ZONES: dict[str, dict] = {
    "entrance": {
        "label": "Entrance",       "icon": "fa-door-open",
        "color": "#06b6d4",        "bg": "rgba(6,182,212,.12)",
        "cx": 300, "cy": 425,      "spread": 65,
        "grid_area": "entrance",
    },
    "checkout": {
        "label": "Checkout",       "icon": "fa-cash-register",
        "color": "#10b981",        "bg": "rgba(16,185,129,.12)",
        "cx": 300, "cy": 58,       "spread": 55,
        "grid_area": "checkout",
    },
    "snacks": {
        "label": "Snacks Shelf",   "icon": "fa-cookie-bite",
        "color": "#f59e0b",        "bg": "rgba(245,158,11,.12)",
        "cx": 90,  "cy": 270,      "spread": 55,
        "grid_area": "snacks",
    },
    "beverages": {
        "label": "Beverages",      "icon": "fa-bottle-water",
        "color": "#3b82f6",        "bg": "rgba(59,130,246,.12)",
        "cx": 510, "cy": 270,      "spread": 55,
        "grid_area": "beverages",
    },
    "essentials": {
        "label": "Essentials",     "icon": "fa-basket-shopping",
        "color": "#8b5cf6",        "bg": "rgba(139,92,246,.12)",
        "cx": 90,  "cy": 135,      "spread": 50,
        "grid_area": "essentials",
    },
    "dairy": {
        "label": "Dairy & Fresh",  "icon": "fa-egg",
        "color": "#ec4899",        "bg": "rgba(236,72,153,.12)",
        "cx": 510, "cy": 135,      "spread": 50,
        "grid_area": "dairy",
    },
    "offers": {
        "label": "Offers Zone",    "icon": "fa-tags",
        "color": "#ef4444",        "bg": "rgba(239,68,68,.12)",
        "cx": 300, "cy": 250,      "spread": 60,
        "grid_area": "offers",
    },
}

# Category keyword → zone name  (checked with 'in' — longest matches first)
CATEGORY_ZONE_MAP: list[tuple[str, str]] = [
    ("snacks",        "snacks"),
    ("chips",         "snacks"),
    ("biscuit",       "snacks"),
    ("cookie",        "snacks"),
    ("wafer",         "snacks"),
    ("namkeen",       "snacks"),
    ("popcorn",       "snacks"),
    ("cracker",       "snacks"),
    ("beverage",      "beverages"),
    ("drink",         "beverages"),
    ("cola",          "beverages"),
    ("juice",         "beverages"),
    ("soda",          "beverages"),
    ("water",         "beverages"),
    ("tea",           "beverages"),
    ("coffee",        "beverages"),
    ("dairy",         "dairy"),
    ("milk",          "dairy"),
    ("egg",           "dairy"),
    ("cheese",        "dairy"),
    ("butter",        "dairy"),
    ("yogurt",        "dairy"),
    ("cream",         "dairy"),
    ("grocery",       "essentials"),
    ("bakery",        "essentials"),
    ("fresh",         "essentials"),
    ("personal care", "essentials"),
    ("household",     "essentials"),
    ("breakfast",     "essentials"),
    ("condiment",     "essentials"),
    ("spread",        "essentials"),
    ("cooking",       "essentials"),
    ("rice",          "essentials"),
    ("pasta",         "essentials"),
    ("bread",         "essentials"),
    ("recommended",   "offers"),
    ("combo",         "offers"),
    ("offer",         "offers"),
    # Stationery / general store items → essentials
    ("stationery",    "essentials"),
    ("pen",           "essentials"),
    ("pencil",        "essentials"),
    ("notebook",      "essentials"),
    ("book",          "essentials"),
    ("soap",          "essentials"),
    ("shampoo",       "essentials"),
    ("toothpaste",    "essentials"),
    ("detergent",     "essentials"),
    ("medicine",      "essentials"),
    ("health",        "essentials"),
    ("candy",         "snacks"),
    ("chocolate",     "snacks"),
    ("sweet",         "snacks"),
    ("ice cream",     "dairy"),
    ("ice-cream",     "dairy"),
    ("paneer",        "dairy"),
]

# Product name keyword → zone (fallback)
PRODUCT_ZONE_KEYWORDS: list[tuple[str, str]] = [
    ("lay",       "snacks"),   ("pringles",  "snacks"),  ("chips",    "snacks"),
    ("biscuit",   "snacks"),   ("cookie",    "snacks"),  ("wafer",    "snacks"),
    ("pepsi",     "beverages"),("coke",      "beverages"),("cola",   "beverages"),
    ("sprite",    "beverages"),("juice",     "beverages"),("7up",    "beverages"),
    ("milk",      "dairy"),    ("egg",       "dairy"),   ("butter",   "dairy"),
    ("cheese",    "dairy"),    ("yogurt",    "dairy"),
    ("bread",     "essentials"),("rice",     "essentials"),("maggi", "essentials"),
    ("noodle",    "essentials"),("pasta",    "essentials"),("dal",   "essentials"),
    # Stationery
    ("pen",       "essentials"),("pencil",   "essentials"),("eraser","essentials"),
    ("ruler",     "essentials"),("notebook", "essentials"),("book",  "essentials"),
    ("scale",     "essentials"),("marker",   "essentials"),("highlighter","essentials"),
    # Personal care / hygiene
    ("soap",      "essentials"),("shampoo",  "essentials"),("toothpaste","essentials"),
    ("detergent", "essentials"),("lotion",   "essentials"),
    # Confectionery → snacks
    ("chocolate", "snacks"),    ("candy",    "snacks"),    ("sweet", "snacks"),
    ("lollipop",  "snacks"),    ("gum",      "snacks"),
]

# ================================================================
# HELPER FUNCTIONS
# ================================================================

def _category_to_zone(category: str, product_name: str = "") -> str:
    """Map a product category (or product name) to a store zone."""
    cat_lower  = (category or "").lower()
    name_lower = (product_name or "").lower()

    for keyword, zone in CATEGORY_ZONE_MAP:
        if keyword in cat_lower:
            return zone
    for keyword, zone in PRODUCT_ZONE_KEYWORDS:
        if keyword in name_lower:
            return zone
    return "offers"  # default to offers zone when unknown


def _gauss_point(cx: int, cy: int, spread: int) -> tuple[int, int]:
    """Generate a Gaussian-scattered point near (cx, cy)."""
    x = int(random.gauss(cx, spread * 0.5))
    y = int(random.gauss(cy, spread * 0.5))
    return (
        max(8, min(CANVAS_W - 8, x)),
        max(8, min(CANVAS_H - 8, y)),
    )


def _date_filter_clause(time_filter: str) -> str:
    """Return a SQL WHERE clause fragment based on time filter."""
    if time_filter == "today":
        return "date(timestamp) = date('now')"
    elif time_filter == "week":
        return "timestamp >= date('now', '-7 days')"
    elif time_filter == "month":
        return "timestamp >= date('now', '-30 days')"
    else:  # "all"
        return "1=1"


def _baseline_counts() -> dict[str, int]:
    """
    Realistic baseline visit counts when DB has no data.
    Simulates a typical retail day (7AM–9PM).
    """
    return {
        "entrance":   35,
        "checkout":   28,
        "snacks":     48,
        "beverages":  42,
        "essentials": 22,
        "dairy":      18,
        "offers":     15,
    }


# ================================================================
# CORE DATA FETCHERS
# ================================================================

def _fetch_zone_counts_from_detections(time_filter: str,
                                        category_filter: str | None) -> Counter:
    """
    Query detections table + images timestamp → map each detection to a zone.
    """
    where = _date_filter_clause(time_filter)
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT d.product_name, d.category
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE {where}
    """)
    rows = cursor.fetchall()
    conn.close()

    counts: Counter = Counter()
    for row in rows:
        cat  = row["category"] or ""
        name = row["product_name"] or ""
        if category_filter and category_filter.lower() not in cat.lower():
            continue
        zone = _category_to_zone(cat, name)
        counts[zone] += 1
    return counts


def _fetch_zone_counts_from_cart(time_filter: str) -> Counter:
    """Cart additions as a proxy for shelf engagement."""
    where = _date_filter_clause(time_filter).replace("timestamp", "added_at")
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT product_name, category FROM cart WHERE {where}")
    rows = cursor.fetchall()
    conn.close()

    counts: Counter = Counter()
    for row in rows:
        zone = _category_to_zone(row["category"] or "", row["product_name"] or "")
        counts[zone] += 1
    return counts


def _fetch_checkout_count(time_filter: str) -> int:
    """Number of completed transactions → checkout zone heat."""
    where = _date_filter_clause(time_filter)
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT COUNT(*) as cnt FROM transactions WHERE {where}")
    row = cursor.fetchone()
    conn.close()
    return int(row["cnt"]) if row else 0


def _fetch_transaction_items(time_filter: str) -> Counter:
    """Parse items_json from transactions → zone heat from purchased items."""
    where = _date_filter_clause(time_filter)
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT items_json FROM transactions
        WHERE {where} AND items_json IS NOT NULL
    """)
    rows = cursor.fetchall()
    conn.close()

    counts: Counter = Counter()
    for row in rows:
        try:
            for item in json.loads(row["items_json"]):
                zone = _category_to_zone(item.get("category", ""), item.get("name", ""))
                counts[zone] += item.get("qty", 1)
        except Exception:
            pass
    return counts


def _fetch_hourly_activity(time_filter: str) -> list[dict]:
    """Return scan counts grouped by hour of day (0–23)."""
    where = _date_filter_clause(time_filter)
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT CAST(strftime('%H', i.timestamp) AS INTEGER) AS hour,
               COUNT(*) AS cnt
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE {where}
        GROUP BY hour
        ORDER BY hour
    """)
    rows = {row["hour"]: int(row["cnt"]) for row in cursor.fetchall()}
    conn.close()

    # Return all 24 hours (fill missing with 0)
    return [{"hour": h, "label": f"{h:02d}:00", "count": rows.get(h, 0)} for h in range(24)]


# ================================================================
# POINT CLOUD GENERATOR
# ================================================================

def _build_heat_points(zone_counts: dict[str, int]) -> list[dict]:
    """Convert zone counts → canvas heat points with Gaussian spread."""
    points = []
    total  = max(sum(zone_counts.values()), 1)

    for zone_name, count in zone_counts.items():
        z = ZONES.get(zone_name)
        if not z or count == 0:
            continue
        # Normalize value (0.1–1.0)
        intensity = 0.1 + 0.9 * (count / total)
        for _ in range(count):
            x, y = _gauss_point(z["cx"], z["cy"], z["spread"])
            points.append({
                "x":     x,
                "y":     y,
                "value": round(intensity * random.uniform(0.7, 1.0), 3),
            })
    return points


# ================================================================
# INSIGHTS GENERATOR
# ================================================================

def _generate_insights(zone_counts: dict[str, int],
                        hourly_data: list[dict],
                        checkout_count: int) -> list[str]:
    """Generate AI-style insight strings from heatmap data."""
    insights = []
    total = sum(zone_counts.values()) or 1

    if not zone_counts:
        return [
            "📊 No scan activity recorded yet — start scanning products to generate heatmap insights.",
            "💡 Tip: Use the Live Simulation to preview how heatmap data will look with real traffic.",
        ]

    # Most and least active zones
    ranked = sorted(zone_counts.items(), key=lambda x: -x[1])
    top_zone   = ranked[0]
    bot_zone   = ranked[-1]
    top_label  = ZONES.get(top_zone[0], {}).get("label", top_zone[0])
    bot_label  = ZONES.get(bot_zone[0], {}).get("label", bot_zone[0])
    top_pct    = round(top_zone[1] / total * 100)

    insights.append(f"🔥 Most visited zone: {top_label} ({top_pct}% of all activity)")
    if bot_zone[1] < top_zone[1] // 3:
        insights.append(f"💤 Low engagement: {bot_label} — consider promotions or relocation")

    # Snacks/Beverages combo
    snacks_cnt = zone_counts.get("snacks", 0)
    bev_cnt    = zone_counts.get("beverages", 0)
    if snacks_cnt > 0 and bev_cnt > 0:
        ratio = round(snacks_cnt / max(bev_cnt, 1), 1)
        if ratio > 1.5:
            insights.append("🍿 Snacks aisle outperforms Beverages — consider expanding snack range")
        elif ratio < 0.7:
            insights.append("🥤 Beverages zone leads — strong drinks demand, stock up on popular brands")
        else:
            insights.append("⚖️ Snacks & Beverages zones have balanced traffic — ideal combo placement")

    # Offers zone
    offers_cnt = zone_counts.get("offers", 0)
    if offers_cnt > 0:
        offers_pct = round(offers_cnt / total * 100)
        if offers_pct >= 20:
            insights.append(f"🏷️ Offers Zone attracts {offers_pct}% of traffic — promotions are working!")
        elif offers_pct < 8:
            insights.append("🏷️ Offers Zone has low visibility — move it closer to the entrance")

    # Checkout conversion
    if checkout_count > 0:
        conv_pct = round(checkout_count / max(total / 3, 1) * 100)
        insights.append(f"🛒 Checkout zone activity: {checkout_count} completed transactions")

    # Peak hour
    active_hours = [(h["hour"], h["count"]) for h in hourly_data if h["count"] > 0]
    if active_hours:
        peak_hour, peak_cnt = max(active_hours, key=lambda x: x[1])
        ph_label = f"{peak_hour:02d}:00–{peak_hour+1:02d}:00"
        insights.append(f"🕒 Peak activity: {ph_label} ({peak_cnt} scans)")

        # Weekend pattern
        weekend_hours = [h for h in active_hours if h[0] in (10, 11, 14, 15, 16, 17, 18, 19)]
        if weekend_hours:
            insights.append("📅 Activity peaks in late afternoon — ideal time for flash promotions")

    # Dairy engagement
    dairy_cnt = zone_counts.get("dairy", 0)
    if dairy_cnt > 0 and dairy_cnt < total * 0.1:
        insights.append("🥛 Dairy & Fresh zone underperforms — consider temperature display upgrades")

    return insights[:5]


# ================================================================
# MASTER HEATMAP FUNCTION
# ================================================================

def generate_heatmap_data(time_filter: str = "week",
                           category_filter: str | None = None) -> dict:
    """
    Build the complete heatmap payload.

    Returns:
        {
          "points":       [{x, y, value}, ...],
          "zone_data":    [{zone, label, count, intensity, color, icon}, ...],
          "hourly_data":  [{hour, label, count}, ...],
          "peak_hour":    "19:00–20:00" | None,
          "peak_zone":    "snacks" | None,
          "peak_zone_label": "Snacks Shelf" | None,
          "total_activity": int,
          "checkout_count": int,
          "insights":     [str, ...],
          "is_baseline":  bool,   # True when no real DB data
        }
    """
    # Aggregate counts from multiple sources
    scan_counts    = _fetch_zone_counts_from_detections(time_filter, category_filter)
    cart_counts    = _fetch_zone_counts_from_cart(time_filter)
    txn_counts     = _fetch_transaction_items(time_filter)
    checkout_count = _fetch_checkout_count(time_filter)

    # Merge all sources (scans weight x2, purchases weight x1, cart x1)
    zone_counts: Counter = Counter()
    for z, c in scan_counts.items():
        zone_counts[z] += c * 2
    for z, c in cart_counts.items():
        zone_counts[z] += c
    for z, c in txn_counts.items():
        zone_counts[z] += c

    # Always add checkout heat for completed transactions
    if checkout_count > 0:
        zone_counts["checkout"] += checkout_count * 3

    # If no real data, use baseline (keeps demo working on first install)
    is_baseline = (sum(zone_counts.values()) == 0)
    if is_baseline:
        zone_counts = Counter(_baseline_counts())

    # Build heat points
    points     = _build_heat_points(dict(zone_counts))
    total      = sum(zone_counts.values()) or 1
    max_count  = max(zone_counts.values()) if zone_counts else 1

    # Zone data list (sorted by count desc)
    zone_data = []
    for zone_name, zone_info in ZONES.items():
        count     = zone_counts.get(zone_name, 0)
        intensity = round(count / max_count, 3) if max_count > 0 else 0
        zone_data.append({
            "zone":      zone_name,
            "label":     zone_info["label"],
            "count":     count,
            "intensity": intensity,
            "color":     zone_info["color"],
            "icon":      zone_info["icon"],
            "pct":       round(count / total * 100, 1),
        })
    zone_data.sort(key=lambda x: -x["count"])

    # Hourly data
    hourly_data = _fetch_hourly_activity(time_filter)
    if is_baseline:
        # Inject realistic hourly pattern for baseline
        base_hourly = {7: 5, 8: 10, 9: 18, 10: 25, 11: 30, 12: 40,
                       13: 35, 14: 28, 15: 32, 16: 38, 17: 45, 18: 55,
                       19: 60, 20: 48, 21: 30, 22: 15}
        hourly_data = [{"hour": h, "label": f"{h:02d}:00",
                        "count": base_hourly.get(h, 0)} for h in range(24)]

    # Peak hour
    peak_hour_entry = max(hourly_data, key=lambda x: x["count"])
    peak_hour_str   = (f"{peak_hour_entry['hour']:02d}:00–{peak_hour_entry['hour']+1:02d}:00"
                       if peak_hour_entry["count"] > 0 else None)

    # Peak zone
    peak_zone_entry = zone_data[0] if zone_data else None

    # Insights
    insights = _generate_insights(dict(zone_counts), hourly_data, checkout_count)

    return {
        "points":           points,
        "zone_data":        zone_data,
        "hourly_data":      hourly_data,
        "peak_hour":        peak_hour_str,
        "peak_zone":        peak_zone_entry["zone"]  if peak_zone_entry else None,
        "peak_zone_label":  peak_zone_entry["label"] if peak_zone_entry else None,
        "total_activity":   total,
        "checkout_count":   checkout_count,
        "insights":         insights,
        "zones_meta":       {name: {k: v for k, v in info.items() if k != "grid_area"}
                             for name, info in ZONES.items()},
        "is_baseline":      is_baseline,
    }
