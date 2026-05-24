/**
 * cart.js — Shopping cart page with dynamic discount engine (Step 6)
 */

function loadCart() {
    fetch("/api/cart/summary").then(r => r.json()).then(data => {
        const container = document.getElementById("cart-items");

        // Update cart count badges everywhere
        const itemCount = data.items ? data.items.length : 0;
        document.querySelectorAll(".nav-cart-badge").forEach(el => { el.textContent = itemCount; });

        if (!data.items || data.items.length === 0) {
            container.innerHTML = `
                <div class="rs-empty-state">
                    <div class="icon-badge icon-badge-amber rs-empty-icon"><i class="fas fa-bag-shopping"></i></div>
                    <p class="rs-empty-title">Your cart is empty</p>
                    <p class="rs-empty-sub">Go to Scanner to detect and add products</p>
                    <a href="/" class="btn-glow-primary" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 14px rgba(99,102,241,.35);">
                        <i class="fas fa-crosshairs"></i> Start Scanning
                    </a>
                </div>`;
            updateOrderSummary(data);
            renderOfferBanners([]);
            return;
        }

        container.innerHTML = data.items.map((item, i) => `
            <div class="cart-item-card" style="animation-delay:${i * 0.08}s">
                <div class="d-flex align-items-center gap-3" style="flex:1;min-width:0;">
                    <div class="icon-badge icon-badge-primary flex-shrink-0">
                        <i class="fas fa-box"></i>
                    </div>
                    <div style="min-width:0;">
                        <p class="mb-0 fw-semibold rs-truncate" style="color:var(--text-primary);font-size:.9rem;">${item.product_name}</p>
                        <p class="mb-0 small" style="color:var(--text-secondary);">${item.category} &middot; Qty: ${item.quantity}</p>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                    <span class="fw-bold" style="color:var(--success);font-size:1.05rem;white-space:nowrap;">&#8377;${item.price.toFixed(2)}</span>
                    <button onclick="removeItem(${item.id})" class="rs-icon-btn rs-icon-btn-danger" title="Remove">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join("");

        updateOrderSummary(data);
        renderOfferBanners(data.banners || []);
        renderSmartMessage(data.smart_message);
        loadRecommendations(data.items);
    }).catch(e => {
        console.error("Cart load error", e);
        // Fallback to old /api/cart
        fetch("/api/cart").then(r => r.json()).then(d => {
            document.querySelectorAll(".nav-cart-badge").forEach(el => { el.textContent = d.items.length; });
        });
    });
}

// ========================
// ORDER SUMMARY PANEL
// ========================
function updateOrderSummary(data) {
    const subtotal        = data.subtotal        || 0;
    const membershipDisc  = data.membership_discount || 0;
    const bulkDisc        = data.bulk_discount    || 0;
    const cartDisc        = data.cart_discount    || 0;
    const promoDisc       = data.promo_discount   || 0;
    const totalDisc       = data.total_discount   || 0;
    const finalTotal      = data.final_total      ?? subtotal;
    const itemCount       = data.item_count       || (data.items ? data.items.length : 0);

    setText("total-items",  itemCount);
    setText("subtotal-amt", fmtINR(subtotal));
    setText("final-total",  fmtINR(finalTotal));

    // Discount rows — show/hide per value
    toggleDiscRow("row-membership", "membership-disc-amt", membershipDisc);
    toggleDiscRow("row-bulk",       "bulk-disc-amt",       bulkDisc);
    toggleDiscRow("row-cart",       "cart-disc-amt",       cartDisc);
    toggleDiscRow("row-promo",      "promo-disc-amt",      promoDisc);

    // Total discount line
    const totalDiscEl = document.getElementById("total-discount-amt");
    if (totalDiscEl) totalDiscEl.textContent = totalDisc > 0 ? `-${fmtINR(totalDisc)}` : fmtINR(0);

    const savingsWrap = document.getElementById("savings-wrap");
    if (savingsWrap) savingsWrap.classList.toggle("hidden", totalDisc <= 0);

    const savingsAmt = document.getElementById("savings-amount");
    if (savingsAmt) savingsAmt.textContent = fmtINR(totalDisc);

    // Promo label
    const promoLabel = document.getElementById("promo-label");
    if (promoLabel && data.promo_name) {
        promoLabel.textContent = data.promo_name;
    }
}

function toggleDiscRow(rowId, amtId, value) {
    const row = document.getElementById(rowId);
    const amt = document.getElementById(amtId);
    if (!row) return;
    if (value > 0) {
        row.classList.remove("hidden");
        if (amt) amt.textContent = `-${fmtINR(value)}`;
    } else {
        row.classList.add("hidden");
    }
}

function fmtINR(n) {
    return "₹" + Number(n).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ========================
// OFFER BANNERS
// ========================
const BANNER_COLORS = {
    primary: { bg: "rgba(99,102,241,.1)",  border: "rgba(99,102,241,.25)",  text: "#6366f1" },
    success: { bg: "rgba(16,185,129,.1)",  border: "rgba(16,185,129,.3)",   text: "#059669" },
    warning: { bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.3)",   text: "#d97706" },
    info:    { bg: "rgba(6,182,212,.1)",   border: "rgba(6,182,212,.3)",    text: "#0891b2" },
    accent:  { bg: "rgba(139,92,246,.1)",  border: "rgba(139,92,246,.25)",  text: "#7c3aed" },
};

function renderOfferBanners(banners) {
    const container = document.getElementById("offer-banners");
    if (!container) return;
    if (!banners || banners.length === 0) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = banners.map(b => {
        const c = BANNER_COLORS[b.color] || BANNER_COLORS.info;
        return `
        <div class="d-flex align-items-start gap-3 px-3 py-2 rounded-3 mb-2 animate-fade-in-up"
            style="background:${c.bg};border:1px solid ${c.border};">
            <span style="font-size:1.1rem;line-height:1.4;flex-shrink:0;">${b.icon || "✨"}</span>
            <p class="mb-0" style="color:${c.text};font-size:.82rem;font-weight:600;line-height:1.4;">${b.message}</p>
        </div>`;
    }).join("");
}

function renderSmartMessage(msg) {
    const el = document.getElementById("smart-message");
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.parentElement.classList.remove("hidden");
    } else {
        el.parentElement.classList.add("hidden");
    }
}

// ========================
// RECOMMENDATIONS
// ========================
let _recData    = null;
let _activeTab  = "recommended";

async function loadRecommendations(cartItems) {
    if (!cartItems || cartItems.length === 0) {
        document.getElementById("rec-section")?.classList.add("hidden");
        return;
    }
    try {
        const res  = await fetch("/api/recommendations");
        const data = await res.json();
        if (!data.success) return;

        _recData = data;
        const section = document.getElementById("rec-section");
        if (section) section.classList.remove("hidden");

        // Smart message in header
        if (data.smart_message) {
            const el = document.getElementById("rec-smart-msg");
            if (el) el.textContent = data.smart_message;
        }

        // Combo deal banner
        const activeCombos = (data.combo_deals || []).filter(c => c.type === "combo_active");
        const upsellCombos = (data.combo_deals || []).filter(c => c.type === "combo_upsell");
        const comboBanner  = document.getElementById("combo-banner");
        const comboBannerTxt = document.getElementById("combo-banner-text");
        if (comboBanner && comboBannerTxt) {
            const show = activeCombos[0] || upsellCombos[0];
            if (show) {
                comboBannerTxt.textContent = show.message;
                comboBanner.classList.remove("hidden");
            } else {
                comboBanner.classList.add("hidden");
            }
        }

        renderRecCards(_activeTab);

    } catch (e) {
        console.error("Recommendations error", e);
    }
}

function switchRecTab(tab, btn) {
    _activeTab = tab;
    document.querySelectorAll(".rec-type-pill").forEach(b => {
        b.style.fontWeight = "600";
        b.classList.remove("active");
    });
    btn.classList.add("active");
    renderRecCards(tab);
}

const REC_TYPE_META = {
    fbt:         { icon: "fa-link",              bg: "rgba(99,102,241,.1)",  color: "#6366f1",  label: "FBT"        },
    similar:     { icon: "fa-shuffle",           bg: "rgba(6,182,212,.1)",   color: "#0891b2",  label: "Similar"    },
    trending:    { icon: "fa-fire",              bg: "rgba(245,158,11,.1)",  color: "#d97706",  label: "Trending"   },
    personalized:{ icon: "fa-user-tag",          bg: "rgba(16,185,129,.1)",  color: "#059669",  label: "For You"    },
    combo:       { icon: "fa-tags",              bg: "rgba(239,68,68,.1)",   color: "#dc2626",  label: "Combo Deal" },
    tier:        { icon: "fa-crown",             bg: "rgba(245,158,11,.1)",  color: "#d97706",  label: "Premium"    },
};

function renderRecCards(tab) {
    const container = document.getElementById("rec-cards");
    const empty     = document.getElementById("rec-empty");
    if (!container || !_recData) return;

    let items = [];
    if (tab === "recommended") items = _recData.recommended || [];
    else if (tab === "trending") items = _recData.trending  || [];
    else if (tab === "similar")  items = _recData.similar   || [];

    if (!items.length) {
        container.innerHTML = "";
        if (empty) empty.classList.remove("hidden");
        return;
    }
    if (empty) empty.classList.add("hidden");

    container.innerHTML = items.map(rec => {
        const meta = REC_TYPE_META[rec.type] || REC_TYPE_META.fbt;
        const comboBadge = rec.combo_discount
            ? `<span class="rec-combo-badge"><i class="fas fa-tag"></i>-${rec.combo_discount}% combo</span>`
            : "";
        return `
        <div class="rec-card" data-type="${rec.type}">
            <div class="d-flex align-items-center gap-2">
                <div class="rec-card-icon" style="background:${meta.bg};color:${meta.color};">
                    <i class="fas ${meta.icon}"></i>
                </div>
                <span class="rec-type-pill" style="background:${meta.bg};color:${meta.color};font-size:.6rem;border:none;padding:2px 7px;">${meta.label}</span>
            </div>
            <p class="mb-0 fw-bold" style="color:var(--text-primary);font-size:.875rem;line-height:1.3;">${rec.name}</p>
            ${comboBadge}
            <p class="rec-reason mb-0">${rec.reason}</p>
            <button class="rec-add-btn" onclick="recAddToCart('${rec.name.replace(/'/g, "\\'")}')">
                <i class="fas fa-cart-plus"></i> Add to Cart
            </button>
        </div>`;
    }).join("");
}

function recAddToCart(name) {
    // Add with category 'recommended' and price 0 — detection_id=0 as placeholder
    fetch("/api/add_to_cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection_id: 0, product_name: name, category: "recommended", price: 0 })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) { showToast(`${name} added to cart!`, "success"); loadCart(); }
        else { showToast(d.error || "Could not add item", "error"); }
    })
    .catch(() => showToast("Could not add item", "error"));
}

// ========================
// ACTIONS
// ========================
function removeItem(id) {
    fetch(`/api/cart/remove/${id}`, { method: "DELETE" })
        .then(r => r.json())
        .then(() => { showToast("Item removed"); loadCart(); });
}

document.getElementById("btn-clear-cart").addEventListener("click", () => {
    fetch("/api/cart/clear", { method: "DELETE" })
        .then(r => r.json())
        .then(() => { showToast("Cart cleared"); loadCart(); });
});

loadCart();

