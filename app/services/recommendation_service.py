"""
Recommendation Service — Step 7: Smart Recommendation Engine

Scoring system (higher = stronger recommendation):
  - Frequently Bought Together (FBT):  weight 40
  - Same Category affinity:            weight 25
  - Trending (purchased this week):    weight 20
  - Tier bonus (Gold/Platinum):        weight 15
  - Combo discount available:          weight 10 (additive)

All calculations are done dynamically from SQLite — no extra tables needed.
"""
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from app.services.db_service import get_connection

# ================================================================
# COMBO / AFFINITY RULES  (curated + learned dynamically)
# ================================================================

# Static "Frequently Bought Together" rules (seed data)
# Keys are lowercased substrings — partial matching used.
COMBO_RULES = {
    "chips":     [("Pepsi", "beverages", 30), ("Coca Cola", "beverages", 30), ("Sprite", "beverages", 25)],
    "lay's":     [("Pepsi", "beverages", 35), ("Dip Sauce", "condiments", 20)],
    "maggi":     [("Coke", "beverages", 30), ("Ketchup", "condiments", 25)],
    "bread":     [("Jam", "spreads", 40), ("Butter", "dairy", 35), ("Eggs", "dairy", 25)],
    "biscuits":  [("Milk", "dairy", 35), ("Tea", "beverages", 30)],
    "milk":      [("Bread", "bakery", 30), ("Eggs", "dairy", 25), ("Cornflakes", "breakfast", 20)],
    "noodles":   [("Ketchup", "condiments", 30), ("Sprite", "beverages", 20)],
    "coffee":    [("Milk", "dairy", 35), ("Sugar", "grocery", 25), ("Biscuits", "bakery", 20)],
    "tea":       [("Milk", "dairy", 40), ("Sugar", "grocery", 30), ("Biscuits", "bakery", 20)],
    "rice":      [("Dal", "grocery", 35), ("Cooking Oil", "grocery", 30), ("Pickle", "condiments", 20)],
    "chocolate": [("Milk", "dairy", 30), ("Chips", "snacks", 20)],
    "juice":     [("Biscuits", "bakery", 20), ("Chips", "snacks", 15)],
    "eggs":      [("Bread", "bakery", 35), ("Butter", "dairy", 30), ("Milk", "dairy", 20)],
    "soap":      [("Shampoo", "personal care", 30), ("Face Wash", "personal care", 25)],
    "shampoo":   [("Conditioner", "personal care", 40), ("Face Wash", "personal care", 20)],
    "cola":      [("Chips", "snacks", 35), ("Popcorn", "snacks", 25)],
    "pepsi":     [("Chips", "snacks", 35), ("Popcorn", "snacks", 25)],
    "sprite":    [("Chips", "snacks", 30), ("Nachos", "snacks", 20)],
    "butter":    [("Bread", "bakery", 40), ("Jam", "spreads", 30)],
    "yogurt":    [("Fruits", "fresh produce", 30), ("Granola", "breakfast", 25)],
    "cereal":    [("Milk", "dairy", 45), ("Banana", "fresh produce", 20)],
    "pasta":     [("Pasta Sauce", "condiments", 45), ("Cheese", "dairy", 30)],
    "pizza":     [("Coke", "beverages", 40), ("Ketchup", "condiments", 25)],
    "sandwich":  [("Juice", "beverages", 30), ("Chips", "snacks", 25)],
    "samosa":    [("Chai", "beverages", 40), ("Chutney", "condiments", 35)],
    "popcorn":   [("Coke", "beverages", 40), ("Juice", "beverages", 25)],
    "wafer":     [("Pepsi", "beverages", 35), ("Coke", "beverages", 30)],
}

# Combo discount pairs (both names lowercased substrings)
COMBO_DISCOUNTS = [
    ("chips",   "pepsi",  5,  "Chips + Pepsi Combo"),
    ("chips",   "cola",   5,  "Chips + Cola Combo"),
    ("bread",   "butter", 5,  "Bread & Butter Deal"),
    ("bread",   "jam",    5,  "Bread & Jam Deal"),
    ("maggi",   "ketchup",3,  "Maggi Meal Deal"),
    ("pizza",   "coke",   7,  "Pizza + Coke Combo"),
    ("coffee",  "milk",   4,  "Coffee & Milk Bundle"),
    ("cereal",  "milk",   6,  "Breakfast Bundle"),
    ("pasta",   "sauce",  5,  "Pasta Meal Deal"),
    ("popcorn", "cola",   5,  "Movie Night Bundle"),
    ("wafer",   "pepsi",  5,  "Snack + Drink Combo"),
    ("biscuits","tea",    4,  "Tea-Time Bundle"),
    ("samosa",  "chai",   6,  "Street Food Special"),
]

SIMILAR_PRODUCTS = {
    "pepsi":     ["Coca Cola", "Sprite", "7Up", "Mountain Dew"],
    "coca cola": ["Pepsi", "Sprite", "Thumbs Up", "Diet Coke"],
    "sprite":    ["7Up", "Mountain Dew", "Limca"],
    "lay's":     ["Pringles", "Kurkure", "Bingo", "Doritos"],
    "maggi":     ["Yippee Noodles", "Top Ramen", "Knorr Pasta"],
    "dairy milk":["Kit Kat", "5 Star", "Munch", "Gems"],
    "oreo":      ["Bourbon Biscuit", "Good Day", "Hide & Seek"],
    "bread":     ["Brown Bread", "Multigrain Bread", "Pav"],
    "amul butter":["Nutralite", "Britannia Butter"],
    "colgate":   ["Pepsodent", "Oral-B", "Patanjali Dant Kanti"],
    "dove soap":  ["Lux Soap", "Lifebuoy", "Dettol"],
}

TIER_BONUS_CATEGORIES = {
    "gold":     ["premium", "organic", "imported"],
    "platinum": ["premium", "organic", "imported", "gourmet"],
}

# ================================================================
# DATA FETCHERS
# ================================================================

def _get_recent_transactions(days=30, limit=500) -> list:
    """Fetch recent transaction items_json rows from DB."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT items_json FROM transactions WHERE timestamp >= ? AND items_json IS NOT NULL LIMIT ?",
        (cutoff, limit)
    )
    rows = [r["items_json"] for r in cursor.fetchall()]
    conn.close()
    return rows


def _get_user_transactions(firebase_uid: str, limit=50) -> list:
    """Get items_json rows for a specific user (reads reward_history for txn IDs then joins)."""
    conn   = get_connection()
    cursor = conn.cursor()
    # reward_history links user → transaction_id
    cursor.execute(
        """
        SELECT t.items_json FROM transactions t
        JOIN reward_history r ON t.transaction_id = r.transaction_id
        WHERE r.firebase_uid = ? AND t.items_json IS NOT NULL
        ORDER BY t.timestamp DESC LIMIT ?
        """,
        (firebase_uid, limit)
    )
    rows = [r["items_json"] for r in cursor.fetchall()]
    conn.close()
    return rows


def _parse_items(rows: list) -> list[list[str]]:
    """Parse a list of items_json strings into list of [name, ...] per transaction."""
    result = []
    for raw in rows:
        try:
            items = json.loads(raw)
            names = [i.get("name", "") for i in items if i.get("name")]
            if names:
                result.append(names)
        except Exception:
            pass
    return result


def _co_occurrence(transactions: list[list[str]]) -> dict:
    """
    Return {product_name: Counter({other_product: count})} from transaction lists.
    Used for dynamically-learned FBT.
    """
    co = defaultdict(Counter)
    for basket in transactions:
        for i, a in enumerate(basket):
            for b in basket[i+1:]:
                al, bl = a.lower(), b.lower()
                co[al][bl] += 1
                co[bl][al] += 1
    return co


# ================================================================
# INDIVIDUAL RECOMMENDATION ENGINES
# ================================================================

def get_frequently_bought_together(cart_items: list[str], co_occ: dict) -> list[dict]:
    """Return FBT suggestions based on cart contents."""
    scores: Counter = Counter()
    reasons: dict   = {}

    cart_lower = [n.lower() for n in cart_items]

    for name in cart_lower:
        # 1. Static curated rules (seed)
        for key, combos in COMBO_RULES.items():
            if key in name:
                for rec_name, rec_cat, weight in combos:
                    if rec_name.lower() not in cart_lower:
                        scores[rec_name] += weight
                        reasons[rec_name] = f"Frequently bought with {name.title()}"

        # 2. Dynamically-learned co-occurrence (lower weight — less certain)
        if name in co_occ:
            for other, cnt in co_occ[name].most_common(5):
                if other not in cart_lower:
                    # Cap dynamic weight at 30
                    dynamic_w = min(cnt * 5, 30)
                    scores[other.title()] += dynamic_w
                    if other.title() not in reasons:
                        reasons[other.title()] = f"Often bought together with {name.title()}"

    return [
        {
            "name": name,
            "reason": reasons.get(name, "Frequently bought together"),
            "type":   "fbt",
            "score":  score,
        }
        for name, score in scores.most_common(6)
    ]


def get_similar_products(cart_items: list[str]) -> list[dict]:
    """Return 'Customers also consider' alternatives."""
    results = []
    seen    = set()
    cart_lower = [n.lower() for n in cart_items]
    for name in cart_lower:
        for key, similars in SIMILAR_PRODUCTS.items():
            if key in name:
                for sim in similars[:3]:
                    if sim.lower() not in cart_lower and sim not in seen:
                        results.append({
                            "name":   sim,
                            "reason": f"Similar to {name.title()}",
                            "type":   "similar",
                            "score":  20,
                        })
                        seen.add(sim)
    return results[:4]


def get_trending_products(all_txns: list[list[str]], exclude: list[str]) -> list[dict]:
    """Return most purchased products this week (limited to 5)."""
    cutoff_rows = _parse_items(_get_recent_transactions(days=7, limit=200))
    counter: Counter = Counter()
    for basket in cutoff_rows:
        for name in basket:
            counter[name] += 1
    exclude_lower = [e.lower() for e in exclude]
    trending = [
        {"name": name, "reason": f"Trending — bought {cnt} times this week",
         "type": "trending", "score": min(cnt * 3, 30)}
        for name, cnt in counter.most_common(15)
        if name.lower() not in exclude_lower
    ]
    return trending[:5]


def get_personalized_for_user(firebase_uid: str, tier: str, exclude: list[str]) -> list[dict]:
    """Return recommendations based on user's own purchase history + tier."""
    rows   = _get_user_transactions(firebase_uid)
    parsed = _parse_items(rows)

    # Category affinity
    cat_counter: Counter = Counter()
    name_counter: Counter = Counter()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT t.items_json FROM transactions t
            JOIN reward_history r ON t.transaction_id = r.transaction_id
            WHERE r.firebase_uid = ? AND t.items_json IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 100
            """,
            (firebase_uid,)
        )
        for row in cursor.fetchall():
            try:
                items = json.loads(row["items_json"])
                for item in items:
                    if item.get("category"):
                        cat_counter[item["category"].lower()] += 1
                    if item.get("name"):
                        name_counter[item["name"].lower()] += 1
            except Exception:
                pass
        conn.close()
    except Exception:
        pass

    exclude_lower = [e.lower() for e in exclude]
    results = []

    # Re-suggest top categories they love but don't have in cart now
    top_cats = [c for c, _ in cat_counter.most_common(3)]
    if top_cats:
        # Find popular items in those categories from recent global transactions
        recent_rows = _get_recent_transactions(days=14)
        global_cat_items: Counter = Counter()
        for raw in recent_rows:
            try:
                for item in json.loads(raw):
                    if item.get("category", "").lower() in top_cats and item.get("name"):
                        n = item["name"]
                        if n.lower() not in name_counter and n.lower() not in exclude_lower:
                            global_cat_items[n] += 1
            except Exception:
                pass
        for name, cnt in global_cat_items.most_common(3):
            results.append({
                "name":   name,
                "reason": f"Based on your {top_cats[0]} preferences",
                "type":   "personalized",
                "score":  25 + (cnt * 2),
            })

    # Tier-based bonus suggestions
    tier_cats = TIER_BONUS_CATEGORIES.get(tier.lower(), [])
    if tier_cats:
        results.append({
            "name":   "Premium Selection",
            "reason": f"Exclusive for {tier.title()} members",
            "type":   "tier",
            "score":  15,
            "_tier":  True,  # marker — JS will style differently
        })

    return results[:5]


def get_combo_discount_suggestions(cart_items: list[str]) -> list[dict]:
    """Check which combo discounts apply or could apply with one more item."""
    cart_lower = [n.lower() for n in cart_items]
    combos     = []
    for a_key, b_key, disc_pct, label in COMBO_DISCOUNTS:
        a_in = any(a_key in n for n in cart_lower)
        b_in = any(b_key in n for n in cart_lower)
        if a_in and b_in:
            combos.append({
                "type":     "combo_active",
                "label":    label,
                "discount": disc_pct,
                "message":  f"🎉 {label} — extra {disc_pct}% off applied!",
            })
        elif a_in:
            combos.append({
                "type":     "combo_upsell",
                "name":     b_key.title(),
                "label":    label,
                "discount": disc_pct,
                "message":  f"Add {b_key.title()} to unlock {disc_pct}% combo discount!",
                "reason":   f"Complete the {label}",
                "type_rec": "combo",
                "score":    50,
            })
        elif b_in:
            combos.append({
                "type":     "combo_upsell",
                "name":     a_key.title(),
                "label":    label,
                "discount": disc_pct,
                "message":  f"Add {a_key.title()} to unlock {disc_pct}% combo discount!",
                "reason":   f"Complete the {label}",
                "type_rec": "combo",
                "score":    50,
            })
    return combos


# ================================================================
# MASTER RECOMMENDATION FUNCTION
# ================================================================

def get_recommendations(
    cart_items: list[str],
    firebase_uid: str = None,
    tier: str = "bronze",
    limit: int = 8,
) -> dict:
    """
    Return full recommendation payload.

    Returns:
        {
          "recommended": [...],   # top merged list (FBT + personalized + combos)
          "trending":    [...],
          "similar":     [...],
          "combo_deals": [...],   # active + upsell combo discounts
          "smart_message": str | None,
        }
    """
    # Pre-fetch global co-occurrence for dynamic FBT
    all_rows = _get_recent_transactions(days=30)
    all_txns = _parse_items(all_rows)
    co_occ   = _co_occurrence(all_txns)

    fbt       = get_frequently_bought_together(cart_items, co_occ)
    similar   = get_similar_products(cart_items)
    trending  = get_trending_products(all_txns, cart_items)
    combos    = get_combo_discount_suggestions(cart_items)

    personalized = []
    if firebase_uid:
        personalized = get_personalized_for_user(firebase_uid, tier, cart_items)

    # Merge FBT + personalized into "recommended", deduplicate by name
    merged: dict[str, dict] = {}
    for rec in fbt + personalized:
        key = rec["name"].lower()
        if key not in merged or rec["score"] > merged[key]["score"]:
            merged[key] = rec

    # Add combo upsells into recommended at high priority
    for c in combos:
        if c["type"] == "combo_upsell":
            key = c["name"].lower()
            rec = {
                "name":   c["name"],
                "reason": c["message"],
                "type":   "combo",
                "score":  c["score"],
                "combo_discount": c["discount"],
                "combo_label":    c["label"],
            }
            if key not in merged or rec["score"] > merged[key]["score"]:
                merged[key] = rec

    recommended = sorted(merged.values(), key=lambda x: -x["score"])[:limit]

    # Smart message
    smart_msg = None
    active_combos = [c for c in combos if c["type"] == "combo_active"]
    upsell_combos = [c for c in combos if c["type"] == "combo_upsell"]
    if active_combos:
        smart_msg = active_combos[0]["message"]
    elif upsell_combos:
        smart_msg = upsell_combos[0]["message"]
    elif recommended:
        smart_msg = f"Customers who bought these also picked: {recommended[0]['name']}"
    elif trending:
        smart_msg = f"🔥 {trending[0]['name']} is trending today!"

    return {
        "recommended":   recommended,
        "trending":      trending[:5],
        "similar":       similar,
        "combo_deals":   combos,
        "personalized":  personalized,
        "smart_message": smart_msg,
    }


# ================================================================
# POST-DETECTION SUGGESTIONS (Scan page)
# ================================================================

def get_scan_suggestions(detected_names: list[str]) -> list[dict]:
    """
    Fast suggestions to show immediately after a scan.
    Returns top 4 FBT + 2 similar.
    """
    if not detected_names:
        return []

    fbt_scores: Counter = Counter()
    reasons: dict       = {}
    detected_lower      = [n.lower() for n in detected_names]

    for name in detected_lower:
        for key, combos in COMBO_RULES.items():
            if key in name:
                for rec_name, _, weight in combos:
                    if rec_name.lower() not in detected_lower:
                        fbt_scores[rec_name] += weight
                        reasons[rec_name] = f"Often bought with {name.title()}"

    results = [
        {"name": n, "reason": reasons.get(n, "Customers also buy"), "type": "fbt"}
        for n, _ in fbt_scores.most_common(4)
    ]

    # Add similar
    for name in detected_lower:
        for key, similars in SIMILAR_PRODUCTS.items():
            if key in name:
                for sim in similars[:2]:
                    if sim.lower() not in detected_lower:
                        if not any(r["name"].lower() == sim.lower() for r in results):
                            results.append({"name": sim, "reason": f"Similar to {name.title()}", "type": "similar"})
                            break

    return results[:6]


# ================================================================
# ADMIN ANALYTICS
# ================================================================

def get_recommendation_analytics() -> dict:
    """Return data for admin recommendation analytics panel."""
    conn   = get_connection()
    cursor = conn.cursor()

    # Most frequently co-purchased pairs from all transactions
    cursor.execute(
        "SELECT items_json FROM transactions WHERE items_json IS NOT NULL ORDER BY timestamp DESC LIMIT 500"
    )
    rows   = [r["items_json"] for r in cursor.fetchall()]
    conn.close()

    txns   = _parse_items(rows)
    co_occ = _co_occurrence(txns)

    # Top individual products
    product_counter: Counter = Counter()
    for basket in txns:
        for name in basket:
            product_counter[name] += 1

    # Top co-occurring pairs
    pairs = []
    seen  = set()
    for a, others in co_occ.items():
        for b, cnt in others.most_common(2):
            key = tuple(sorted([a, b]))
            if key not in seen:
                seen.add(key)
                pairs.append({"product_a": a.title(), "product_b": b.title(), "count": cnt})
    pairs.sort(key=lambda x: -x["count"])

    return {
        "top_products":    [{"name": n, "count": c} for n, c in product_counter.most_common(10)],
        "top_pairs":       pairs[:10],
        "total_baskets":   len(txns),
        "avg_basket_size": round(sum(len(b) for b in txns) / max(len(txns), 1), 1),
    }
