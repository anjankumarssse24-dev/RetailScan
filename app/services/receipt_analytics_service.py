"""
Receipt Analytics Service — Step 8: Smart Receipt Intelligence

Transforms every payment receipt into an analytics-rich report:
  • Savings analysis (breakdown by discount type)
  • Spending insights (vs user average / trends)
  • Category insights (top categories, shopping pattern)
  • Loyalty progress (next tier, points context)
  • AI-style smart insight strings
  • Post-purchase recommendations ("Next time try…")
  • Spending trend data (weekly, for mini chart)
  • Admin aggregated receipt analytics
"""

import json
from collections import Counter
from datetime import datetime, timedelta
from app.services.db_service import get_connection, get_user_by_uid

# ================================================================
# CONSTANTS
# ================================================================

TIER_THRESHOLDS = {
    "bronze":   {"next": "Silver",   "spend_needed": 5_000,  "current_min": 0},
    "silver":   {"next": "Gold",     "spend_needed": 15_000, "current_min": 5_000},
    "gold":     {"next": "Platinum", "spend_needed": 50_000, "current_min": 15_000},
    "platinum": {"next": None,       "spend_needed": None,   "current_min": 50_000},
}

TIER_COLORS = {
    "bronze":   "#cd7f32",
    "silver":   "#94a3b8",
    "gold":     "#f59e0b",
    "platinum": "#8b5cf6",
}

TIER_ICONS = {
    "bronze":   "fa-medal",
    "silver":   "fa-medal",
    "gold":     "fa-crown",
    "platinum": "fa-gem",
}

# AI-style insight templates: (condition_fn, message_fn)
# Each condition receives a 'ctx' dict and returns bool.
INSIGHT_TEMPLATES = [
    (
        lambda c: c.get("savings_pct", 0) >= 10,
        lambda c: f"🎯 Great deal! You saved {c['savings_pct']:.1f}% on this order.",
    ),
    (
        lambda c: c.get("savings_pct", 0) > 0 and c.get("savings_pct", 0) < 10,
        lambda c: f"💡 You saved ₹{c['total_discount']:.0f} today — look for combo deals to save more!",
    ),
    (
        lambda c: c.get("points_earned", 0) >= 50,
        lambda c: f"⭐ {c['points_earned']} points earned — you're building loyalty fast!",
    ),
    (
        lambda c: c.get("points_earned", 0) > 0 and c.get("points_earned", 0) < 50,
        lambda c: f"⭐ +{c['points_earned']} reward points added to your account.",
    ),
    (
        lambda c: c.get("order_count", 0) == 1,
        lambda c: "🎉 Welcome! This is your very first purchase — enjoy the journey!",
    ),
    (
        lambda c: c.get("streak_days", 0) >= 3,
        lambda c: f"🔥 {c['streak_days']}-day shopping streak! Check weekend deals.",
    ),
    (
        lambda c: c.get("avg_increase_pct", 0) >= 15,
        lambda c: f"📈 Basket value up {c['avg_increase_pct']:.0f}% vs your average — bulk discounts may apply!",
    ),
    (
        lambda c: c.get("avg_increase_pct", 0) <= -15,
        lambda c: f"📉 Smaller basket than usual — add more items for bulk savings!",
    ),
    (
        lambda c: c.get("bulk_discount_applied") is True,
        lambda c: "📦 Bulk discount activated — great savings strategy!",
    ),
    (
        lambda c: c.get("tier") == "gold",
        lambda c: "👑 Gold member perks active — enjoy your 10% membership discount!",
    ),
    (
        lambda c: c.get("tier") == "platinum",
        lambda c: "💎 Platinum elite — maximum 15% membership savings on every order!",
    ),
    (
        lambda c: c.get("weekend_shopper") is True,
        lambda c: "📅 Weekend shopper! Weekend-exclusive deals are always active for you.",
    ),
    (
        lambda c: c.get("top_category") is not None and c.get("historic_match") is True,
        lambda c: f"🛒 Consistent pattern — {c['top_category'].title()} is your go-to category.",
    ),
    (
        lambda c: c.get("amount_needed_for_next_tier", 0) > 0
                  and c.get("amount_needed_for_next_tier", 0) <= 500,
        lambda c: f"🚀 Almost there! Spend just ₹{c['amount_needed_for_next_tier']:.0f} more to reach {c['next_tier']}!",
    ),
    (
        lambda c: c.get("monthly_spend", 0) > 3000,
        lambda c: f"📊 You've spent ₹{c['monthly_spend']:.0f} this month — you qualify for our Monthly Saver offer!",
    ),
]


# ================================================================
# DB HELPERS
# ================================================================

def _get_transaction_by_id(transaction_id: str) -> dict | None:
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions WHERE transaction_id = ?", (transaction_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def _get_user_transaction_history(firebase_uid: str, limit: int = 50) -> list[dict]:
    """All transactions for a user (newest first), joined via reward_history."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT t.* FROM transactions t
        JOIN reward_history r ON t.transaction_id = r.transaction_id
        WHERE r.firebase_uid = ?
        ORDER BY t.timestamp DESC LIMIT ?
        """,
        (firebase_uid, limit),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def _get_uid_for_transaction(transaction_id: str) -> str | None:
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT firebase_uid FROM reward_history WHERE transaction_id = ?",
        (transaction_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return row["firebase_uid"] if row else None


def _get_points_for_transaction(transaction_id: str) -> int:
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT points_earned FROM reward_history WHERE transaction_id = ?",
        (transaction_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return int(row["points_earned"]) if row else 0


# ================================================================
# ANALYSIS FUNCTIONS
# ================================================================

def get_savings_analysis(txn: dict) -> dict:
    """Return complete savings breakdown for a single transaction."""
    subtotal       = float(txn.get("subtotal") or txn.get("amount") or 0)
    total_discount = float(txn.get("total_discount") or 0)
    amount_paid    = float(txn.get("amount") or 0)
    savings_pct    = round((total_discount / subtotal * 100) if subtotal > 0 else 0, 1)

    breakdown = []
    if float(txn.get("membership_discount") or 0) > 0:
        breakdown.append({"type": "Membership", "amount": float(txn["membership_discount"]),
                           "icon": "fa-crown",        "color": "#f59e0b"})
    if float(txn.get("bulk_discount") or 0) > 0:
        breakdown.append({"type": "Bulk Savings", "amount": float(txn["bulk_discount"]),
                           "icon": "fa-boxes-stacked", "color": "#6366f1"})
    if float(txn.get("cart_discount") or 0) > 0:
        breakdown.append({"type": "Cart Offer", "amount": float(txn["cart_discount"]),
                           "icon": "fa-bag-shopping", "color": "#06b6d4"})
    if float(txn.get("promo_discount") or 0) > 0:
        breakdown.append({"type": txn.get("promo_name") or "Promo", "amount": float(txn["promo_discount"]),
                           "icon": "fa-tag",           "color": "#10b981"})

    return {
        "subtotal":       subtotal,
        "total_discount": total_discount,
        "amount_paid":    amount_paid,
        "savings_pct":    savings_pct,
        "breakdown":      breakdown,
        "has_savings":    total_discount > 0,
    }


def get_spending_insights(firebase_uid: str, current_amount: float) -> dict:
    """Compare current order to user's historic average and compute trends."""
    history = _get_user_transaction_history(firebase_uid, limit=20)

    if len(history) < 1:
        return {
            "order_count":     1,
            "avg_order_value": current_amount,
            "avg_increase_pct": 0,
            "total_spent":     current_amount,
            "monthly_spend":   current_amount,
            "streak_days":     0,
            "trend":           "first",
        }

    # Historical average (excluding current transaction — it's already in DB
    # but may be the first item in `history`; skip index 0 if it matches)
    amounts = [float(h["amount"]) for h in history]
    # If the current transaction is the newest, history[0] is it → skip
    calc_amounts = amounts[1:] if amounts else []
    avg = (sum(calc_amounts) / len(calc_amounts)) if calc_amounts else current_amount
    increase_pct = round((current_amount - avg) / avg * 100, 1) if avg > 0 else 0

    total_spent  = sum(amounts)

    # Monthly spend (last 30 days)
    cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    monthly = sum(float(h["amount"]) for h in history if (h.get("timestamp") or "") >= cutoff)

    # Shopping streak (consecutive calendar days, newest → oldest)
    dates  = sorted(set((h.get("timestamp") or "")[:10] for h in history if h.get("timestamp")), reverse=True)
    streak = 0
    today  = datetime.now().date()
    for i, d in enumerate(dates):
        try:
            dt = datetime.strptime(d, "%Y-%m-%d").date()
            if dt == today - timedelta(days=i):
                streak += 1
            else:
                break
        except Exception:
            break

    return {
        "order_count":      len(history),
        "avg_order_value":  round(avg, 2),
        "avg_increase_pct": increase_pct,
        "total_spent":      round(total_spent, 2),
        "monthly_spend":    round(monthly, 2),
        "streak_days":      streak,
        "trend":            "up" if increase_pct > 5 else "down" if increase_pct < -5 else "stable",
    }


def get_category_insights(items: list[dict], firebase_uid: str = None) -> dict:
    """Category breakdown for current order + historic top category."""
    cat_counter: Counter = Counter()
    for item in items:
        cat = (item.get("category") or "other").lower().strip()
        cat_counter[cat] += int(item.get("qty", 1))

    top_category = cat_counter.most_common(1)[0][0] if cat_counter else None

    # Historic top category
    historic_top   = None
    historic_match = False
    if firebase_uid:
        conn   = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT t.items_json FROM transactions t
            JOIN reward_history r ON t.transaction_id = r.transaction_id
            WHERE r.firebase_uid = ? AND t.items_json IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 30
            """,
            (firebase_uid,),
        )
        hist_cat: Counter = Counter()
        for row in cursor.fetchall():
            try:
                for it in json.loads(row["items_json"]):
                    c = (it.get("category") or "other").lower().strip()
                    hist_cat[c] += int(it.get("qty", 1))
            except Exception:
                pass
        conn.close()
        if hist_cat:
            historic_top   = hist_cat.most_common(1)[0][0]
            historic_match = (historic_top == top_category)

    return {
        "top_category":      top_category,
        "historic_top":      historic_top or top_category,
        "historic_match":    historic_match,
        "category_counts":   dict(cat_counter.most_common(5)),
        "unique_categories": len(cat_counter),
    }


def get_loyalty_progress_insight(firebase_uid: str) -> dict:
    """Tier progress data for the loyalty section of a receipt."""
    if not firebase_uid:
        return {}
    user = get_user_by_uid(firebase_uid)
    if not user:
        return {}

    tier        = (user.get("membership_tier") or "bronze").lower()
    points      = int(user.get("reward_points") or 0)
    total_spent = float(user.get("total_spent") or 0)

    tier_info  = TIER_THRESHOLDS.get(tier, TIER_THRESHOLDS["bronze"])
    next_tier  = tier_info["next"]

    if next_tier is None:
        return {
            "tier":           tier,
            "points":         points,
            "total_spent":    total_spent,
            "next_tier":      None,
            "amount_needed":  0,
            "progress_pct":   100,
            "message":        "You're at the highest tier — Platinum! 💎",
            "color":          TIER_COLORS["platinum"],
            "icon":           TIER_ICONS["platinum"],
            "next_color":     TIER_COLORS["platinum"],
        }

    spend_for_next = tier_info["spend_needed"]
    current_min    = tier_info["current_min"]
    amount_needed  = max(0, round(spend_for_next - total_spent, 2))
    range_size     = spend_for_next - current_min
    progress_pct   = min(100, round((total_spent - current_min) / range_size * 100, 1)) if range_size > 0 else 0

    message = (
        f"Only ₹{amount_needed:,.0f} more to reach {next_tier} tier!"
        if amount_needed > 0
        else f"Tier upgrade imminent — refresh your profile!"
    )

    return {
        "tier":           tier,
        "points":         points,
        "total_spent":    total_spent,
        "next_tier":      next_tier,
        "amount_needed":  amount_needed,
        "progress_pct":   progress_pct,
        "message":        message,
        "color":          TIER_COLORS.get(tier, "#6366f1"),
        "next_color":     TIER_COLORS.get(next_tier.lower(), "#6366f1"),
        "icon":           TIER_ICONS.get(tier, "fa-medal"),
    }


def generate_smart_insights(ctx: dict) -> list[str]:
    """Run AI-style templates against context dict; return up to 4 messages."""
    insights = []
    for condition, message in INSIGHT_TEMPLATES:
        try:
            if condition(ctx):
                insights.append(message(ctx))
        except Exception:
            pass
        if len(insights) >= 4:
            break
    return insights


def get_spending_trend(firebase_uid: str, weeks: int = 6) -> list[dict]:
    """Return weekly spending totals for mini chart (last `weeks` weeks)."""
    history = _get_user_transaction_history(firebase_uid, limit=200)
    now     = datetime.now()
    result  = []
    for i in range(weeks - 1, -1, -1):
        w_start = now - timedelta(weeks=i + 1)
        w_end   = now - timedelta(weeks=i)
        w_label = w_start.strftime("%b %d")
        w_total = sum(
            float(h["amount"]) for h in history
            if h.get("timestamp") and
            w_start.strftime("%Y-%m-%d") <= h["timestamp"][:10] < w_end.strftime("%Y-%m-%d")
        )
        result.append({"week": f"W{weeks - i}", "label": w_label, "total": round(w_total, 2)})
    return result


# ================================================================
# MASTER RECEIPT ANALYTICS
# ================================================================

def get_receipt_analytics(transaction_id: str, firebase_uid: str = None) -> dict | None:
    """
    Build the full analytics-rich receipt payload for one transaction.

    Returns None if the transaction doesn't exist.
    """
    txn = _get_transaction_by_id(transaction_id)
    if not txn:
        return None

    # Resolve firebase_uid from reward_history if not provided
    if not firebase_uid:
        firebase_uid = _get_uid_for_transaction(transaction_id)

    # Parse items
    items = []
    try:
        items = json.loads(txn.get("items_json") or "[]")
    except Exception:
        pass

    # Core analytics
    savings     = get_savings_analysis(txn)
    cat_info    = get_category_insights(items, firebase_uid)
    points_earned = _get_points_for_transaction(transaction_id)

    # User-specific analytics (only when uid is known)
    spending  = {}
    loyalty   = {}
    trend     = []
    insights  = []

    if firebase_uid:
        spending = get_spending_insights(firebase_uid, float(txn.get("amount") or 0))
        loyalty  = get_loyalty_progress_insight(firebase_uid)
        trend    = get_spending_trend(firebase_uid)

        ctx = {
            "savings_pct":              savings["savings_pct"],
            "total_discount":           savings["total_discount"],
            "points_earned":            points_earned,
            "order_count":              spending.get("order_count", 1),
            "streak_days":              spending.get("streak_days", 0),
            "avg_increase_pct":         spending.get("avg_increase_pct", 0),
            "monthly_spend":            spending.get("monthly_spend", 0),
            "top_category":             cat_info.get("top_category"),
            "historic_match":           cat_info.get("historic_match", False),
            "weekend_shopper":          datetime.now().weekday() >= 5,
            "bulk_discount_applied":    float(txn.get("bulk_discount") or 0) > 0,
            "tier":                     loyalty.get("tier", "bronze"),
            "next_tier":                loyalty.get("next_tier"),
            "amount_needed_for_next_tier": loyalty.get("amount_needed", 0),
            "items_count":              int(txn.get("items_count") or len(items)),
        }
        insights = generate_smart_insights(ctx)

    # Post-purchase product recommendations
    from app.services.recommendation_service import get_scan_suggestions
    item_names = [i.get("name", "") for i in items if i.get("name")]
    next_time  = get_scan_suggestions(item_names)[:4]

    return {
        "transaction_id": transaction_id,
        "timestamp":      txn.get("timestamp"),
        "items":          items,
        "items_count":    int(txn.get("items_count") or len(items)),
        "savings":        savings,
        "spending":       spending,
        "category":       cat_info,
        "loyalty":        loyalty,
        "trend":          trend,
        "insights":       insights,
        "points_earned":  points_earned,
        "next_time":      next_time,
        "success":        True,
    }


# ================================================================
# ADMIN AGGREGATED ANALYTICS
# ================================================================

def get_admin_receipt_analytics() -> dict:
    """Aggregated receipt stats for the admin analytics dashboard."""
    conn   = get_connection()
    cursor = conn.cursor()

    # Overall KPIs
    cursor.execute("""
        SELECT
            COUNT(*)                    AS total_orders,
            COALESCE(AVG(amount), 0)    AS avg_order_value,
            COALESCE(AVG(COALESCE(total_discount, 0)), 0) AS avg_discount,
            COALESCE(SUM(COALESCE(total_discount, 0)), 0) AS total_savings,
            COALESCE(AVG(COALESCE(subtotal, amount)), 0)  AS avg_subtotal
        FROM transactions
        WHERE amount > 0
    """)
    stats = dict(cursor.fetchone() or {})

    # Orders by day of week (last 90 days)
    cursor.execute("""
        SELECT
            CASE CAST(strftime('%w', timestamp) AS INTEGER)
                WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
                WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri'
                ELSE 'Sat'
            END                      AS day,
            COUNT(*)                 AS orders,
            COALESCE(AVG(amount), 0) AS avg_amount
        FROM transactions
        WHERE timestamp >= date('now', '-90 days')
        GROUP BY strftime('%w', timestamp)
        ORDER BY CAST(strftime('%w', timestamp) AS INTEGER)
    """)
    by_day = [dict(r) for r in cursor.fetchall()]

    # Weekly revenue (last 8 weeks)
    cursor.execute("""
        SELECT
            strftime('%Y-W%W', timestamp) AS week,
            COUNT(*)                      AS orders,
            COALESCE(SUM(amount), 0)      AS revenue,
            COALESCE(SUM(COALESCE(total_discount, 0)), 0) AS savings
        FROM transactions
        WHERE timestamp >= date('now', '-56 days')
        GROUP BY strftime('%Y-W%W', timestamp)
        ORDER BY week ASC
        LIMIT 8
    """)
    weekly = [dict(r) for r in cursor.fetchall()]

    conn.close()

    avg_sub  = float(stats.get("avg_subtotal") or 0)
    avg_disc = float(stats.get("avg_discount") or 0)
    avg_savings_rate = round((avg_disc / avg_sub * 100) if avg_sub > 0 else 0, 1)

    return {
        "total_orders":     int(stats.get("total_orders") or 0),
        "avg_order_value":  round(float(stats.get("avg_order_value") or 0), 2),
        "avg_discount":     round(avg_disc, 2),
        "total_savings":    round(float(stats.get("total_savings") or 0), 2),
        "avg_savings_rate": avg_savings_rate,
        "by_day":           by_day,
        "weekly":           weekly,
    }
