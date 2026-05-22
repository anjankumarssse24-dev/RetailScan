"""
Payment routes - Checkout, wallet, and payment history
"""
import json
from flask import Blueprint, jsonify, request, session
from app.services.payment_service import process_payment, get_wallet, get_payment_history
from app.services.email_service import send_payment_email
from app.services.loyalty_service import update_customer_loyalty
from app.services.receipt_analytics_service import get_receipt_analytics, get_admin_receipt_analytics
from app.services.db_service import get_connection

payment_bp = Blueprint("payment", __name__)


@payment_bp.route("/api/checkout", methods=["POST"])
def api_checkout():
    success, result = process_payment()
    if not success:
        return jsonify({"success": False, **result}), 400

    # ── Award loyalty points ──────────────────────────────
    user = session.get("user")
    points_earned = 0
    if user and user.get("uid"):
        loyalty = update_customer_loyalty(
            firebase_uid=user["uid"],
            order_amount=result["amount_paid"],
            transaction_id=result["transaction_id"],
        )
        points_earned = loyalty.get("points_earned", 0)
        # Refresh session with updated loyalty data
        session["user"]["reward_points"]   = loyalty.get("reward_points",   user.get("reward_points", 0))
        session["user"]["membership_tier"] = loyalty.get("membership_tier", user.get("membership_tier", "bronze"))
        session["user"]["total_spent"]     = loyalty.get("total_spent",     user.get("total_spent", 0.0))
        session["user"]["total_orders"]    = loyalty.get("total_orders",    user.get("total_orders", 0))
        session.modified = True

    result["points_earned"] = points_earned

    # ── Compute receipt analytics (for email + frontend) ─
    analytics = get_receipt_analytics(
        result["transaction_id"],
        firebase_uid=user.get("uid") if user else None,
    )

    # ── Send email receipt ────────────────────────────────
    # Prefer session email; fall back to email sent from frontend
    body_data  = request.get_json(silent=True) or {}
    user_email = (user.get("email") if user else None) or body_data.get("user_email", "")
    print(f"[CHECKOUT] email resolved: {user_email!r} (session user: {bool(user)})")
    if user_email:
        items = json.loads(result.get("items_json", "[]")) if "items_json" in result else []
        print(f"[CHECKOUT] Sending email to {user_email} with {len(items)} items")
        send_payment_email(
            user_email=user_email,
            transaction_id=result["transaction_id"],
            timestamp=result["timestamp"],
            items=items,
            total_amount=result["amount_paid"],
            analytics=analytics,
        )
    else:
        print("[CHECKOUT] No email sent — no email in session or request body")

    return jsonify({"success": True, "email_queued_to": user_email or None, **result})


@payment_bp.route("/api/wallet", methods=["GET"])
def api_wallet():
    balance = get_wallet()
    return jsonify({"success": True, "balance": balance})


@payment_bp.route("/api/history", methods=["GET"])
def api_history():
    date_filter  = request.args.get("date")
    transactions = get_payment_history(date_filter)

    # Enrich each transaction with points_earned from reward_history
    try:
        conn   = get_connection()
        cursor = conn.cursor()
        for txn in transactions:
            cursor.execute(
                "SELECT points_earned FROM reward_history WHERE transaction_id = ?",
                (txn["transaction_id"],),
            )
            row = cursor.fetchone()
            txn["points_earned"] = int(row["points_earned"]) if row else 0
        conn.close()
    except Exception:
        pass

    return jsonify({"success": True, "transactions": transactions})


@payment_bp.route("/api/receipt/<transaction_id>")
def api_receipt(transaction_id):
    """Full analytics-rich receipt for a given transaction."""
    user         = session.get("user", {})
    firebase_uid = user.get("uid") if user else None
    analytics    = get_receipt_analytics(transaction_id, firebase_uid=firebase_uid)
    if not analytics:
        return jsonify({"success": False, "error": "Transaction not found"}), 404
    return jsonify(analytics)
