"""
Cart service - Cart business logic
"""
from datetime import datetime
from app.services.db_service import add_to_cart, get_cart_items, get_cart_total, remove_from_cart, clear_cart


def add_item_to_cart(detection_id, product_name, category, price):
    """Add a detected product to the cart with current timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    add_to_cart(detection_id, product_name, category, price, timestamp)


def get_cart():
    """Get cart items and total."""
    return get_cart_items(), get_cart_total()


def remove_item(cart_id):
    """Remove an item from the cart."""
    remove_from_cart(cart_id)


def clear_all():
    """Clear the entire cart."""
    clear_cart()
