"""
Discount Service — Dynamic Discount Engine (Step 6)

Discount hierarchy (all stacked, capped at 50% total):
  A) Membership tier discount
  B) Bulk purchase discount (by item count)
  C) Cart value discount (threshold-based ₹ off)
  D) Active promo / festival discount

All amounts in ₹ (INR). Percentages as decimals where noted.
"""
from datetime import datetime

# ================================================================
# RULE TABLES  (edit here to change rules without touching logic)
# ================================================================

# A. Membership tier → discount percentage
MEMBERSHIP_DISCOUNTS = {
    "bronze":   0,
    "silver":   5,
    "gold":     10,
    "platinum": 15,
}

# B. Bulk purchase: item_count → discount %
#    Keys are minimum thresholds, highest matching applies.
BULK_THRESHOLDS = [
    (20, 15),
    (10, 10),
    (5,   5),
]

# C. Cart-value flat discounts: (min_subtotal, flat_₹_off, label)
#    Highest matching threshold applies.
CART_VALUE_DISCOUNTS = [
    (5000, 750, "Premium Cart Offer"),
    (3000, 300, "Big Cart Offer"),
    (1000, 100, "Value Cart Offer"),
]

# D. Active promotions (date-aware)
#    Each entry: {id, name, icon, type:"pct"|"flat", value, active, start, end, description}
ACTIVE_PROMOS = [
    {
        "id":          "weekend_special",
        "name":        "Weekend Special",
        "icon":        "🔥",
        "type":        "pct",
        "value":       3,
        "description": "3% off every weekend",
        "active":      True,
        "start":       None,   # None = always match on weekends
        "end":         None,
    },
    {
        "id":          "diwali_sale",
        "name":        "Diwali Sale",
        "icon":        "🪔",
        "type":        "pct",
        "value":       8,
        "description": "Diwali Festival — 8% off sitewide",
        "active":      False,  # Toggle True during campaign
        "start":       "2026-10-15",
        "end":         "2026-10-25",
    },
    {
        "id":          "new_year_blast",
        "name":        "New Year Blast",
        "icon":        "🎆",
        "type":        "pct",
        "value":       5,
        "description": "New Year special — 5% off",
        "active":      False,
        "start":       "2026-01-01",
        "end":         "2026-01-07",
    },
    {
        "id":          "first_buy",
        "name":        "First Purchase Offer",
        "icon":        "🎁",
        "type":        "flat",
        "value":       50,
        "description": "₹50 off on your first order",
        "active":      True,
        "start":       None,
        "end":         None,
        "min_orders":  0,      # Only if total_orders == 0
        "max_orders":  0,
    },
]

MAX_COMBINED_DISCOUNT_PCT = 50   # Safety cap


# ================================================================
# INDIVIDUAL CALCULATORS
# ================================================================

def calculate_membership_discount(subtotal: float, tier: str) -> dict:
    """Return membership-tier discount amount and metadata."""
    pct  = MEMBERSHIP_DISCOUNTS.get((tier or "bronze").lower(), 0)
    amt  = round(subtotal * pct / 100, 2)
    return {
        "discount_pct": pct,
        "discount_amt": amt,
        "label":        f"{tier.capitalize() if tier else 'Bronze'} Member ({pct}% off)" if pct > 0 else None,
    }


def calculate_bulk_discount(subtotal: float, item_count: int) -> dict:
    """Return bulk-purchase discount based on item count."""
    pct = 0
    for min_qty, discount_pct in BULK_THRESHOLDS:
        if item_count >= min_qty:
            pct = discount_pct
            break
    amt = round(subtotal * pct / 100, 2)
    # Next threshold info for upsell banner
    next_threshold = None
    next_pct       = None
    for min_qty, discount_pct in sorted(BULK_THRESHOLDS):
        if item_count < min_qty:
            next_threshold = min_qty
            next_pct       = discount_pct
            break
    return {
        "discount_pct":    pct,
        "discount_amt":    amt,
        "items_needed":    (next_threshold - item_count) if next_threshold else 0,
        "next_threshold":  next_threshold,
        "next_pct":        next_pct,
        "label":           f"Bulk Discount — {item_count} items ({pct}% off)" if pct > 0 else None,
    }


def calculate_cart_discount(subtotal: float) -> dict:
    """Return flat cart-value discount."""
    flat_off = 0
    label    = None
    for min_val, off, lbl in CART_VALUE_DISCOUNTS:
        if subtotal >= min_val:
            flat_off = off
            label    = f"{lbl} (₹{off} off)"
            break
    # Next tier info
    next_threshold = None
    next_off       = None
    for min_val, off, lbl in sorted(CART_VALUE_DISCOUNTS, key=lambda x: x[0]):
        if subtotal < min_val:
            next_threshold = min_val
            next_off       = off
            break
    return {
        "discount_amt":   float(flat_off),
        "next_threshold": next_threshold,
        "next_off":       next_off,
        "label":          label,
    }


def _is_promo_active(promo: dict, now: datetime, total_orders: int) -> bool:
    """Check if a promo applies right now."""
    if not promo.get("active", False):
        return False
    # Date range check
    start = promo.get("start")
    end   = promo.get("end")
    today = now.date().isoformat()
    if start and today < start:
        return False
    if end   and today > end:
        return False
    # Weekend check (id == weekend_special)
    if promo["id"] == "weekend_special":
        return now.weekday() in (5, 6)  # Sat=5, Sun=6
    # First-buy check
    if "min_orders" in promo and "max_orders" in promo:
        return promo["min_orders"] <= total_orders <= promo["max_orders"]
    return True


def calculate_promo_discount(subtotal: float, total_orders: int = 0) -> dict:
    """Return festival/promo discount (best single applicable promo)."""
    now = datetime.now()
    best_promo = None
    best_amt   = 0.0

    for promo in ACTIVE_PROMOS:
        if not _is_promo_active(promo, now, total_orders):
            continue
        if promo["type"] == "pct":
            amt = round(subtotal * promo["value"] / 100, 2)
        else:
            amt = float(promo["value"])
        amt = min(amt, subtotal)
        if amt > best_amt:
            best_amt   = amt
            best_promo = promo

    if best_promo:
        return {
            "promo_id":    best_promo["id"],
            "promo_name":  best_promo["name"],
            "promo_icon":  best_promo["icon"],
            "discount_amt": best_amt,
            "label":       f"{best_promo['icon']} {best_promo['name']} — {best_promo['description']}",
        }
    return {
        "promo_id":    None,
        "promo_name":  None,
        "promo_icon":  None,
        "discount_amt": 0.0,
        "label":       None,
    }


# ================================================================
# MASTER CALCULATOR
# ================================================================

def calculate_total_discount(
    subtotal: float,
    item_count: int,
    tier: str = "bronze",
    total_orders: int = 0,
) -> dict:
    """
    Calculate all applicable discounts, apply safety cap,
    and return full breakdown dict.
    """
    if subtotal <= 0:
        return _zero_summary(subtotal)

    membership = calculate_membership_discount(subtotal, tier)
    bulk       = calculate_bulk_discount(subtotal, item_count)
    cart_d     = calculate_cart_discount(subtotal)
    promo      = calculate_promo_discount(subtotal, total_orders)

    raw_discount = (
        membership["discount_amt"]
        + bulk["discount_amt"]
        + cart_d["discount_amt"]
        + promo["discount_amt"]
    )

    # Safety cap
    max_discount = round(subtotal * MAX_COMBINED_DISCOUNT_PCT / 100, 2)
    total_discount = min(round(raw_discount, 2), max_discount)

    final_total = max(round(subtotal - total_discount, 2), 0.0)
    savings_pct = round((total_discount / subtotal) * 100, 1) if subtotal > 0 else 0

    # Active banners for frontend
    banners = _build_banners(membership, bulk, cart_d, promo, item_count, subtotal)

    # Smart message
    smart_msg = _build_smart_message(total_discount, subtotal, tier, bulk, cart_d)

    return {
        "subtotal":             round(subtotal, 2),
        "item_count":           item_count,
        "tier":                 tier,
        # Individual breakdowns
        "membership_discount":  membership["discount_amt"],
        "membership_pct":       membership["discount_pct"],
        "bulk_discount":        bulk["discount_amt"],
        "bulk_pct":             bulk["discount_pct"],
        "cart_discount":        cart_d["discount_amt"],
        "promo_discount":       promo["discount_amt"],
        "promo_name":           promo["promo_name"],
        "promo_icon":           promo["promo_icon"],
        # Totals
        "total_discount":       total_discount,
        "final_total":          final_total,
        "savings_pct":          savings_pct,
        # Upsell info
        "items_needed_for_bulk": bulk["items_needed"],
        "next_bulk_threshold":   bulk["next_threshold"],
        "next_bulk_pct":         bulk["next_pct"],
        "next_cart_threshold":   cart_d["next_threshold"],
        "next_cart_off":         cart_d["next_off"],
        # UI elements
        "banners":              banners,
        "smart_message":        smart_msg,
        # Active discount labels (non-null only)
        "active_labels": [l for l in [
            membership.get("label"),
            bulk.get("label"),
            cart_d.get("label"),
            promo.get("label"),
        ] if l],
    }


def _zero_summary(subtotal):
    return {
        "subtotal": round(subtotal, 2), "item_count": 0, "tier": "bronze",
        "membership_discount": 0.0, "membership_pct": 0,
        "bulk_discount": 0.0, "bulk_pct": 0,
        "cart_discount": 0.0, "promo_discount": 0.0,
        "promo_name": None, "promo_icon": None,
        "total_discount": 0.0, "final_total": 0.0, "savings_pct": 0,
        "items_needed_for_bulk": 5, "next_bulk_threshold": 5, "next_bulk_pct": 5,
        "next_cart_threshold": 1000, "next_cart_off": 100,
        "banners": [], "smart_message": None, "active_labels": [],
    }


def _build_banners(membership, bulk, cart_d, promo, item_count, subtotal):
    banners = []

    # Membership
    if membership["discount_pct"] > 0:
        banners.append({
            "type":    "membership",
            "icon":    "🏅",
            "message": f"{membership['label']}",
            "color":   "primary",
        })

    # Bulk upsell
    if bulk["discount_pct"] > 0:
        banners.append({
            "type":    "bulk",
            "icon":    "🛒",
            "message": f"Bulk deal active — {bulk['items_needed'] == 0 and str(item_count) + ' items' or ''}{bulk['label']}",
            "color":   "success",
        })
    elif bulk["next_threshold"]:
        needed = bulk["next_threshold"] - item_count
        banners.append({
            "type":    "upsell_bulk",
            "icon":    "🛒",
            "message": f"Add {needed} more item{'s' if needed != 1 else ''} to unlock {bulk['next_pct']}% bulk discount!",
            "color":   "warning",
        })

    # Cart value upsell
    if cart_d["discount_amt"] > 0:
        banners.append({
            "type":    "cart_value",
            "icon":    "💰",
            "message": cart_d["label"],
            "color":   "success",
        })
    elif cart_d["next_threshold"]:
        needed_amt = cart_d["next_threshold"] - subtotal
        banners.append({
            "type":    "upsell_cart",
            "icon":    "💰",
            "message": f"Add ₹{needed_amt:,.0f} more to unlock ₹{cart_d['next_off']} off!",
            "color":   "info",
        })

    # Promo
    if promo["discount_amt"] > 0:
        banners.append({
            "type":    "promo",
            "icon":    promo["promo_icon"],
            "message": promo["label"],
            "color":   "accent",
        })

    return banners


def _build_smart_message(total_discount, subtotal, tier, bulk, cart_d):
    if total_discount > 0:
        return f"You saved ₹{total_discount:,.2f} today! 🎉"
    if tier == "bronze":
        return "Spend ₹5,000 total to unlock Silver (5% off every order)!"
    if tier == "silver":
        return "Reach ₹15,000 total to unlock Gold (10% off every order)!"
    if bulk.get("next_threshold"):
        needed = bulk["next_threshold"]
        return f"Add {needed} items to unlock {bulk['next_pct']}% bulk discount!"
    if cart_d.get("next_threshold"):
        return f"Add ₹{cart_d['next_threshold']:,} to cart to unlock ₹{cart_d['next_off']} off!"
    return None


# ================================================================
# OFFER CATALOG  (for /offers page)
# ================================================================

TIER_ICONS = {
    "bronze":   "fa-award",
    "silver":   "fa-medal",
    "gold":     "fa-crown",
    "platinum": "fa-gem",
}

TIER_COLORS = {
    "bronze":   "#cd7f32",
    "silver":   "#9ca3af",
    "gold":     "f59e0b",
    "platinum": "#6366f1",
}


def get_all_offers() -> list:
    """Return all offer definitions for the /offers page."""
    now = datetime.now()

    tier_offers = [
        {
            "id": f"tier_{t}",
            "category": "membership",
            "icon": f"fas {TIER_ICONS[t]}",
            "title": f"{t.capitalize()} Member Discount",
            "description": f"{pct}% off on every order as a {t.capitalize()} member." if pct > 0
                            else "Earn 1 point per ₹10 spent. Upgrade to Silver at ₹5,000.",
            "badge": f"{pct}% OFF" if pct > 0 else "Earn Points",
            "badge_color": TIER_COLORS[t] if t != "gold" else "#f59e0b",
            "active": True,
            "tier_required": t,
        }
        for t, pct in MEMBERSHIP_DISCOUNTS.items()
    ]

    bulk_offers = [
        {
            "id": f"bulk_{min_qty}",
            "category": "bulk",
            "icon": "fas fa-layer-group",
            "title": f"Buy {min_qty}+ Items",
            "description": f"Add {min_qty} or more items to your cart and get {pct}% off instantly.",
            "badge": f"{pct}% OFF",
            "badge_color": "#10b981",
            "active": True,
            "tier_required": None,
        }
        for min_qty, pct in BULK_THRESHOLDS
    ]

    cart_offers = [
        {
            "id": f"cart_{int(min_val)}",
            "category": "cart_value",
            "icon": "fas fa-cart-plus",
            "title": lbl,
            "description": f"Spend ₹{int(min_val):,} or more and get flat ₹{off} off.",
            "badge": f"₹{off} OFF",
            "badge_color": "#6366f1",
            "active": True,
            "tier_required": None,
        }
        for min_val, off, lbl in CART_VALUE_DISCOUNTS
    ]

    promo_offers = [
        {
            "id": p["id"],
            "category": "promo",
            "icon": "fas fa-tag",
            "title": f"{p['icon']} {p['name']}",
            "description": p["description"],
            "badge": f"{p['value']}% OFF" if p["type"] == "pct" else f"₹{p['value']} OFF",
            "badge_color": "#f59e0b",
            "active": _is_promo_active(p, now, 0),
            "tier_required": None,
        }
        for p in ACTIVE_PROMOS
    ]

    return tier_offers + bulk_offers + cart_offers + promo_offers
