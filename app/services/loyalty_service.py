"""
Loyalty service — Reward points calculation, membership tier management,
and customer loyalty analytics.

Points formula : 1 pt per ₹10 spent  (₹100 = 10 pts)
Tier thresholds: Bronze (default) | Silver ≥ ₹5,000 | Gold ≥ ₹15,000 | Platinum ≥ ₹50,000
"""
from app.services.db_service import (
    award_points_and_update_stats,
    get_user_by_uid,
    save_reward_history,
    get_reward_history,
)

# ── Constants ────────────────────────────────────────────────
POINTS_PER_INR = 0.1           # 1 point per ₹10

TIER_THRESHOLDS = {
    "bronze":   0,
    "silver":   5_000,
    "gold":     15_000,
    "platinum": 50_000,
}

TIER_BENEFITS = {
    "bronze":   {"discount_pct": 0,  "next_tier": "silver",   "next_at": 5_000,  "color": "#cd7f32", "icon": "fa-award"},
    "silver":   {"discount_pct": 5,  "next_tier": "gold",     "next_at": 15_000, "color": "#9ca3af", "icon": "fa-medal"},
    "gold":     {"discount_pct": 10, "next_tier": "platinum",  "next_at": 50_000, "color": "#f59e0b", "icon": "fa-crown"},
    "platinum": {"discount_pct": 0,  "next_tier": None,        "next_at": None,   "color": "#6366f1", "icon": "fa-gem"},
}


# ── Core calculation helpers ─────────────────────────────────

def calculate_points(amount: float) -> int:
    """Return reward points for a given purchase amount. 1 pt per ₹10."""
    return max(0, int(amount * POINTS_PER_INR))


def calculate_membership_tier(total_spent: float) -> str:
    """Derive membership tier from cumulative spend."""
    if total_spent >= TIER_THRESHOLDS["platinum"]:
        return "platinum"
    if total_spent >= TIER_THRESHOLDS["gold"]:
        return "gold"
    if total_spent >= TIER_THRESHOLDS["silver"]:
        return "silver"
    return "bronze"


# ── Main loyalty update hook ─────────────────────────────────

def update_customer_loyalty(firebase_uid: str, order_amount: float, transaction_id: str) -> dict:
    """
    Call after every successful payment.
    Awards points, updates tier, logs reward history.
    Returns updated user dict + points_earned key.
    """
    points_earned = calculate_points(order_amount)

    # Persist stats + tier in users table
    updated_user = award_points_and_update_stats(firebase_uid, order_amount)

    # Save individual reward event
    save_reward_history(
        firebase_uid=firebase_uid,
        transaction_id=transaction_id,
        points_earned=points_earned,
    )

    result = dict(updated_user) if updated_user else {}
    result["points_earned"] = points_earned
    return result


# ── Loyalty summary (for /api/loyalty and profile page) ─────

def get_loyalty_summary(firebase_uid: str) -> dict:
    """
    Full loyalty snapshot for a user:
    {points, tier, total_spent, total_orders, next_tier_target,
     progress_pct, points_to_next_tier, discount_pct, tier_benefit,
     next_tier, recent_history}
    """
    user = get_user_by_uid(firebase_uid)
    if not user:
        return {}

    tier        = user.get("membership_tier", "bronze")
    total_spent = user.get("total_spent", 0.0)
    points      = user.get("reward_points", 0)
    tier_info   = TIER_BENEFITS.get(tier, TIER_BENEFITS["bronze"])

    # Progress toward next tier
    next_target     = tier_info["next_at"]
    prev_threshold  = TIER_THRESHOLDS.get(tier, 0)

    if next_target is None:
        # Platinum — already at maximum
        progress_pct    = 100
        points_to_next  = 0
        next_tier_target = None
    else:
        span         = next_target - prev_threshold
        earned       = max(0.0, total_spent - prev_threshold)
        progress_pct = min(100, round((earned / span) * 100)) if span > 0 else 100
        points_to_next  = max(0.0, next_target - total_spent)
        next_tier_target = next_target

    # Estimated savings (discount already received on past spend)
    prev_tier_spend = total_spent - max(0, total_spent - prev_threshold)
    discount_pct    = tier_info["discount_pct"]
    estimated_savings = round(total_spent * (discount_pct / 100), 2)

    recent = get_reward_history(firebase_uid, limit=5)

    return {
        "points":            points,
        "tier":              tier,
        "tier_color":        tier_info["color"],
        "tier_icon":         tier_info["icon"],
        "total_spent":       total_spent,
        "total_orders":      user.get("total_orders", 0),
        "next_tier_target":  next_tier_target,
        "progress_pct":      progress_pct,
        "points_to_next":    round(points_to_next, 2),
        "discount_pct":      discount_pct,
        "next_tier":         tier_info["next_tier"],
        "tier_benefit":      (f"{discount_pct}% discount on all orders"
                              if discount_pct > 0
                              else ("VIP priority access & exclusive offers" if tier == "platinum"
                                    else "Earn points on every purchase")),
        "estimated_savings": estimated_savings,
        "recent_history":    recent,
    }
