"""
Payment service - Wallet-based payment with real balance tracking + discount engine
"""
import json
from datetime import datetime
from flask import session
from app.services.db_service import (
    get_cart_items, get_cart_total, clear_cart,
    get_wallet_balance, update_wallet_balance,
    save_transaction, get_transactions
)
from app.services.discount_service import calculate_total_discount


def get_wallet():
    """Get current wallet balance."""
    return get_wallet_balance()


def process_payment():
    """
    Process wallet-based payment with dynamic discount engine.
    Deducts final_total (after discounts) from wallet.
    """
    items = get_cart_items()
    if not items:
        return False, {"error": "Cart is empty"}

    subtotal = get_cart_total()
    balance  = get_wallet_balance()

    # ── Apply discount engine ──────────────────────────────
    user         = session.get("user", {})
    tier         = (user.get("membership_tier") or "bronze").lower()
    total_orders = user.get("total_orders", 0) or 0
    item_count   = sum(i.get("quantity", 1) for i in items)

    disc = calculate_total_discount(subtotal, item_count, tier, total_orders)
    final_total    = disc["final_total"]
    total_discount = disc["total_discount"]
    # ───────────────────────────────────────────────────────

    if final_total > balance:
        return False, {
            "error": (
                f"Insufficient balance. Wallet: ₹{balance:.2f}, "
                f"Required: ₹{final_total:.2f}"
                + (f" (after ₹{total_discount:.2f} discount)" if total_discount > 0 else "")
            )
        }

    # Deduct final_total (discounted amount)
    new_balance = round(balance - final_total, 2)
    update_wallet_balance(new_balance)

    # Save transaction with discount breakdown
    transaction_id = f"TXN_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    timestamp      = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    items_summary = [
        {"name": i["product_name"], "category": i["category"],
         "price": i["price"], "qty": i["quantity"]}
        for i in items
    ]
    items_json = json.dumps(items_summary)

    save_transaction(
        transaction_id, final_total, len(items), items_json,
        balance, new_balance, timestamp,
        subtotal=subtotal,
        total_discount=total_discount,
        membership_discount=disc["membership_discount"],
        bulk_discount=disc["bulk_discount"],
        cart_discount=disc["cart_discount"],
        promo_discount=disc["promo_discount"],
        promo_name=disc["promo_name"],
    )

    clear_cart()

    return True, {
        "message":           "Payment successful!",
        "transaction_id":    transaction_id,
        "amount_paid":       final_total,
        "subtotal":          subtotal,
        "total_discount":    total_discount,
        "membership_discount": disc["membership_discount"],
        "bulk_discount":     disc["bulk_discount"],
        "cart_discount":     disc["cart_discount"],
        "promo_discount":    disc["promo_discount"],
        "promo_name":        disc["promo_name"],
        "savings_pct":       disc["savings_pct"],
        "smart_message":     disc["smart_message"],
        "items_count":       len(items),
        "items_json":        items_json,
        "balance_before":    balance,
        "balance_after":     new_balance,
        "timestamp":         timestamp,
    }


def get_payment_history(date_filter=None):
    """Get payment history, optionally filtered by date."""
    return get_transactions(date_filter)
