"""
Cart routes - Cart management API
"""
from flask import Blueprint, jsonify, request, session
from app.services.cart_service import add_item_to_cart, get_cart, remove_item, clear_all
from app.services.discount_service import calculate_total_discount, get_all_offers
from app.services.recommendation_service import get_recommendations

cart_bp = Blueprint("cart", __name__)


@cart_bp.route("/api/add_to_cart", methods=["POST"])
def api_add_to_cart():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400

    product_name = data.get("product_name")
    if not product_name:
        return jsonify({"success": False, "error": "Product name required"}), 400

    add_item_to_cart(
        data.get("detection_id"),
        product_name,
        data.get("category", ""),
        data.get("price", 0)
    )
    return jsonify({"success": True, "message": f"{product_name} added to cart"})


@cart_bp.route("/api/cart", methods=["GET"])
def api_get_cart():
    items, total = get_cart()
    return jsonify({"success": True, "items": items, "total": total})


@cart_bp.route("/api/cart/remove/<int:cart_id>", methods=["DELETE"])
def api_remove_from_cart(cart_id):
    remove_item(cart_id)
    return jsonify({"success": True, "message": "Item removed from cart"})


@cart_bp.route("/api/cart/clear", methods=["DELETE"])
def api_clear_cart():
    clear_all()
    return jsonify({"success": True, "message": "Cart cleared"})


@cart_bp.route("/api/cart/summary", methods=["GET"])
def api_cart_summary():
    """Return cart with full discount breakdown for display in cart/payment pages."""
    items, subtotal = get_cart()
    user  = session.get("user", {})
    tier  = (user.get("membership_tier") or "bronze").lower()
    total_orders = user.get("total_orders", 0) or 0

    item_count = sum(i.get("quantity", 1) for i in items)
    breakdown  = calculate_total_discount(subtotal, item_count, tier, total_orders)

    return jsonify({
        "success":  True,
        "items":    items,
        **breakdown,
    })


@cart_bp.route("/api/offers", methods=["GET"])
def api_offers():
    """Return all available offer definitions."""
    return jsonify({"success": True, "offers": get_all_offers()})


@cart_bp.route("/api/recommendations", methods=["GET"])
def api_recommendations():
    """Return smart recommendations based on current cart + user profile."""
    items, _ = get_cart()
    cart_names  = [i["product_name"] for i in items]
    user        = session.get("user", {})
    uid         = user.get("uid")
    tier        = (user.get("membership_tier") or "bronze").lower()

    recs = get_recommendations(cart_names, firebase_uid=uid, tier=tier)
    return jsonify({"success": True, **recs})
