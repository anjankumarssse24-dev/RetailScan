"""
Admin routes - Protected admin dashboard and management pages
url_prefix: /admin
All routes require role='admin' via the admin_required decorator.
"""
import json
from collections import Counter
from flask import Blueprint, render_template, redirect, url_for, jsonify, session, request
from app.services.auth_service import admin_required
from app.services.db_service import get_connection, set_user_role, get_admin_count, get_user_by_uid
from app.services.recommendation_service import get_recommendation_analytics
from app.services.receipt_analytics_service import get_admin_receipt_analytics
from app.services.heatmap_service import generate_heatmap_data

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


# ========================
# PAGE ROUTES
# ========================

@admin_bp.route("/")
@admin_required
def index():
    return redirect(url_for("admin.dashboard"))


@admin_bp.route("/dashboard")
@admin_required
def dashboard():
    return render_template("admin/dashboard.html")


@admin_bp.route("/customers")
@admin_required
def customers():
    return render_template("admin/customers.html")


@admin_bp.route("/analytics")
@admin_required
def analytics():
    return render_template("admin/analytics.html")


@admin_bp.route("/transactions")
@admin_required
def transactions():
    return render_template("admin/transactions.html")


@admin_bp.route("/settings")
@admin_required
def settings():
    return render_template("admin/settings.html")


# ========================
# ADMIN API — STATS
# ========================

@admin_bp.route("/api/stats")
@admin_required
def get_stats():
    """Return summary stats for the dashboard cards."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Total customers
        cursor.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'customer'")
        total_customers = cursor.fetchone()["cnt"]

        # Total orders & revenue
        cursor.execute(
            "SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as rev FROM transactions"
        )
        row = cursor.fetchone()
        total_orders   = row["cnt"]
        total_revenue  = row["rev"]

        # Average order value
        avg_order = (total_revenue / total_orders) if total_orders > 0 else 0.0

        # Discount analytics
        cursor.execute(
            "SELECT COALESCE(SUM(total_discount),0) as total_disc, "
            "COALESCE(SUM(subtotal),0) as total_sub, "
            "COUNT(CASE WHEN total_discount > 0 THEN 1 END) as disc_orders "
            "FROM transactions"
        )
        dr = cursor.fetchone()
        total_discounts   = dr["total_disc"]
        total_subtotal    = dr["total_sub"]
        discounted_orders = dr["disc_orders"]
        discount_rate     = round((total_discounts / total_subtotal * 100), 1) if total_subtotal > 0 else 0

        conn.close()

        return jsonify({
            "success": True,
            "stats": {
                "total_revenue":     round(total_revenue, 2),
                "total_orders":      total_orders,
                "total_customers":   total_customers,
                "avg_order_value":   round(avg_order, 2),
                "total_discounts":   round(total_discounts, 2),
                "discount_rate":     discount_rate,
                "discounted_orders": discounted_orders,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — USER MANAGEMENT
# ========================

@admin_bp.route("/api/users")
@admin_required
def list_users():
    """Return a paginated list of all users."""
    try:
        page     = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 20))
        offset   = (page - 1) * per_page

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, firebase_uid, name, email, role, membership_tier, "
            "reward_points, total_spent, total_orders, created_at "
            "FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (per_page, offset),
        )
        users = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) as cnt FROM users")
        total = cursor.fetchone()["cnt"]

        conn.close()
        return jsonify({"success": True, "users": users, "total": total, "page": page})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/users/<firebase_uid>/role", methods=["POST"])
@admin_required
def update_user_role(firebase_uid):
    """Promote or demote a user's role."""
    data = request.get_json(silent=True)
    if not data or "role" not in data:
        return jsonify({"success": False, "error": "role field required"}), 400

    new_role = data["role"]
    if new_role not in ("customer", "admin"):
        return jsonify({"success": False, "error": "role must be 'customer' or 'admin'"}), 400

    # Prevent an admin from revoking their own admin status
    current_uid = session.get("user", {}).get("uid")
    if firebase_uid == current_uid and new_role != "admin":
        return jsonify({"success": False, "error": "Cannot remove your own admin role"}), 400

    set_user_role(firebase_uid, new_role)
    return jsonify({"success": True})


# ========================
# ADMIN API — TRANSACTIONS
# ========================

@admin_bp.route("/api/transactions")
@admin_required
def list_transactions():
    """Return paginated transaction history."""
    try:
        per_page = min(int(request.args.get("per_page", 20)), 200)
        page     = int(request.args.get("page", 1))
        offset   = (page - 1) * per_page

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, transaction_id, amount, items_count, items_json, "
            "balance_before, balance_after, timestamp "
            "FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (per_page, offset),
        )
        txns = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) as cnt FROM transactions")
        total = cursor.fetchone()["cnt"]

        conn.close()
        return jsonify({"success": True, "transactions": txns, "total": total, "page": page})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN PAGES — HEATMAP
# ========================

@admin_bp.route("/heatmap")
@admin_required
def admin_heatmap():
    """Retail heatmap analytics page."""
    return render_template("admin/heatmap.html",
                           active_page="heatmap")


@admin_bp.route("/api/heatmap")
@admin_required
def api_heatmap():
    """Return heatmap data for the given time/category filter."""
    time_filter     = request.args.get("filter",   "week")
    category_filter = request.args.get("category") or None
    try:
        data = generate_heatmap_data(time_filter, category_filter)
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — RECEIPT ANALYTICS
# ========================

@admin_bp.route("/api/receipt-analytics")
@admin_required
def receipt_analytics():
    """Aggregated receipt KPIs for admin dashboard."""
    try:
        data = get_admin_receipt_analytics()
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — RECOMMENDATION ANALYTICS
# ========================

@admin_bp.route("/api/recommendation-analytics")
@admin_required
def recommendation_analytics():
    """Return co-purchase analytics and trending products for admin."""
    try:
        data = get_recommendation_analytics()
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — DISCOUNT ANALYTICS
# ========================

@admin_bp.route("/api/discount-stats")
@admin_required
def discount_stats():
    """Detailed discount breakdown for admin analytics."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(total_discount),0)      as total_discounts,
                COALESCE(SUM(membership_discount),0) as membership_total,
                COALESCE(SUM(bulk_discount),0)       as bulk_total,
                COALESCE(SUM(cart_discount),0)       as cart_total,
                COALESCE(SUM(promo_discount),0)      as promo_total,
                COALESCE(SUM(subtotal),0)            as gross_revenue,
                COALESCE(SUM(amount),0)              as net_revenue,
                COUNT(*) as total_orders,
                COUNT(CASE WHEN total_discount > 0 THEN 1 END) as discounted_orders
            FROM transactions
            """
        )
        row = dict(cursor.fetchone())

        # Promo breakdown
        cursor.execute(
            """
            SELECT promo_name, COUNT(*) as cnt, COALESCE(SUM(promo_discount),0) as total
            FROM transactions WHERE promo_name IS NOT NULL AND promo_name != ''
            GROUP BY promo_name ORDER BY total DESC
            """
        )
        promos = [dict(r) for r in cursor.fetchall()]

        conn.close()
        return jsonify({"success": True, "discount_stats": row, "promo_breakdown": promos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — REVENUE TREND (real monthly data for chart)
# ========================

@admin_bp.route("/api/revenue-trend")
@admin_required
def revenue_trend():
    """Return last 12 months of real monthly revenue for the dashboard chart."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT strftime('%Y-%m', timestamp) as month,
                   COALESCE(SUM(amount), 0)     as revenue,
                   COUNT(*)                      as orders
            FROM transactions
            GROUP BY strftime('%Y-%m', timestamp)
            ORDER BY month ASC
            LIMIT 12
        """)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({"success": True, "data": rows})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — TOP PRODUCTS (real data from transaction items)
# ========================

@admin_bp.route("/api/top-products")
@admin_required
def top_products():
    """Return top-5 products by units sold (parsed from transaction items_json)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT items_json FROM transactions WHERE items_json IS NOT NULL"
        )
        rows = cursor.fetchall()
        conn.close()

        counts: Counter = Counter()
        for row in rows:
            try:
                for item in json.loads(row["items_json"]):
                    name = item.get("name", "Unknown")
                    counts[name] += int(item.get("qty", 1))
            except Exception:
                pass

        top = [{"name": n, "units": q} for n, q in counts.most_common(5)]
        return jsonify({"success": True, "products": top})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# ADMIN API — RECENT ACTIVITY (real last 5 transactions + user events)
# ========================

@admin_bp.route("/api/recent-activity")
@admin_required
def recent_activity():
    """Return the 5 most recent transactions for the activity feed."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT transaction_id, amount, items_count, timestamp
            FROM transactions
            ORDER BY timestamp DESC
            LIMIT 5
        """)
        txns = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({"success": True, "activity": txns})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ========================
# FIRST-RUN ADMIN SETUP
# ========================

@admin_bp.route("/api/setup", methods=["POST"])
def first_admin_setup():
    """
    One-time endpoint: promotes the currently logged-in user to admin
    ONLY if no admins exist yet. Safe to leave enabled — becomes a no-op
    once the first admin is registered.
    """
    if not session.get("logged_in"):
        return jsonify({"success": False, "error": "Not authenticated"}), 401

    if get_admin_count() > 0:
        return jsonify({"success": False, "error": "Admin already exists. Use role management instead."}), 403

    uid = session["user"]["uid"]
    set_user_role(uid, "admin")

    # Refresh session role
    session["user"]["role"] = "admin"
    session.modified = True

    return jsonify({"success": True, "message": "You are now an admin. Refresh the page."})
