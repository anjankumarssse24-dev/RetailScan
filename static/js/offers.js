/**
 * offers.js — Offers & Discounts page
 */

let allOffers   = [];
let cartSummary = null;
let activeFilter = "all";

const CAT_ICONS = {
    membership: "fas fa-crown",
    bulk:       "fas fa-layer-group",
    cart_value: "fas fa-cart-plus",
    promo:      "fas fa-fire",
};
const CAT_LABELS = {
    membership: "Membership",
    bulk:       "Bulk Deal",
    cart_value: "Cart Value",
    promo:      "Promo",
};
const CAT_COLORS = {
    membership: { bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.3)",  text: "#d97706", badge: "#f59e0b" },
    bulk:       { bg: "rgba(99,102,241,.08)", border: "rgba(99,102,241,.22)", text: "#6366f1", badge: "#6366f1" },
    cart_value: { bg: "rgba(6,182,212,.08)",  border: "rgba(6,182,212,.25)",  text: "#0891b2", badge: "#06b6d4" },
    promo:      { bg: "rgba(239,68,68,.08)",  border: "rgba(239,68,68,.22)",  text: "#dc2626", badge: "#ef4444" },
};

const TIER_COLORS = {
    bronze:   "#cd7f32",
    silver:   "#9ca3af",
    gold:     "#f59e0b",
    platinum: "#6366f1",
};

async function init() {
    try {
        const [offersRes, cartRes] = await Promise.all([
            fetch("/api/offers"),
            fetch("/api/cart/summary"),
        ]);
        const offersData = await offersRes.json();
        const cartData   = await cartRes.json();

        allOffers   = offersData.offers || [];
        cartSummary = cartData.success ? cartData : null;

        renderOffers(allOffers);
        renderPersonalSummary(cartData);
        renderTierUpgradeBanner(cartData);

    } catch (e) {
        console.error("Offers load error", e);
        document.getElementById("offers-grid").innerHTML =
            `<div class="col-12 text-center py-4" style="color:var(--text-secondary);">Could not load offers. Please try again.</div>`;
    }
}

// ========================
// OFFER CARDS
// ========================
function renderOffers(offers) {
    const grid = document.getElementById("offers-grid");
    const filtered = activeFilter === "all" ? offers : offers.filter(o => o.category === activeFilter);

    if (!filtered.length) {
        grid.innerHTML = `<div class="col-12 text-center py-5" style="color:var(--text-secondary);">
            <i class="fas fa-tag fa-2x mb-3 d-block opacity-30"></i>
            <p class="mb-0">No offers in this category right now.</p>
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map((offer, i) => {
        const c     = CAT_COLORS[offer.category] || CAT_COLORS.promo;
        const icon  = CAT_ICONS[offer.category]  || "fas fa-tag";
        const label = CAT_LABELS[offer.category] || "Offer";
        const tierColor = offer.tier_required ? (TIER_COLORS[offer.tier_required] || "#6366f1") : null;
        const isActive  = offer.active !== false;

        return `
        <div class="col-12 col-sm-6 col-lg-4">
            <div class="glass-card h-100 offer-card animate-fade-in-up ${isActive ? '' : 'offer-inactive'}"
                 style="animation-delay:${i * 0.06}s;border-top:3px solid ${c.badge};${!isActive ? 'opacity:.55;' : ''}">
                <div class="p-4">
                    <!-- Category badge + status -->
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="d-flex align-items-center gap-2 px-2 py-1 rounded-2"
                              style="background:${c.bg};color:${c.text};font-size:.72rem;font-weight:700;border:1px solid ${c.border};">
                            <i class="${icon}" style="font-size:.65rem;"></i>${label}
                        </span>
                        <span class="d-flex align-items-center gap-1 px-2 py-1 rounded-2"
                              style="font-size:.7rem;font-weight:700;
                                  background:${isActive ? 'rgba(16,185,129,.1)' : 'rgba(107,114,128,.1)'};
                                  color:${isActive ? '#059669' : '#9ca3af'};
                                  border:1px solid ${isActive ? 'rgba(16,185,129,.3)' : 'rgba(107,114,128,.2)'};">
                            <i class="fas fa-circle" style="font-size:.4rem;"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>

                    <!-- Title -->
                    <h3 class="fw-bold mb-1" style="font-size:1rem;color:var(--text-primary);line-height:1.3;">${offer.title}</h3>
                    <p class="mb-3" style="color:var(--text-secondary);font-size:.82rem;line-height:1.5;">${offer.description}</p>

                    <!-- Discount badge -->
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span class="fw-bold px-3 py-1 rounded-pill" 
                              style="background:${c.badge};color:#fff;font-size:.85rem;letter-spacing:.02em;">
                            ${offer.badge}
                        </span>
                        ${offer.tier_required
                            ? `<span class="d-flex align-items-center gap-1 px-2 py-1 rounded-2" 
                                   style="background:${tierColor}22;color:${tierColor};font-size:.72rem;font-weight:700;border:1px solid ${tierColor}44;">
                                   <i class="fas fa-crown" style="font-size:.6rem;"></i>${offer.tier_required.charAt(0).toUpperCase()+offer.tier_required.slice(1)}+
                               </span>`
                            : `<span style="color:var(--text-secondary);font-size:.72rem;">All customers</span>`
                        }
                    </div>
                </div>
            </div>
        </div>`;
    }).join("");
}

// ========================
// PERSONAL CART SUMMARY
// ========================
function renderPersonalSummary(data) {
    if (!data || !data.success || !data.items || data.items.length === 0) return;

    const wrap = document.getElementById("personal-summary-wrap");
    if (wrap) wrap.classList.remove("hidden");

    const cards = document.getElementById("personal-discount-cards");
    const discounts = [
        { label: "Subtotal",            value: data.subtotal,             color: "var(--text-primary)", prefix: "" },
        { label: "Membership Discount", value: data.membership_discount,  color: "#10b981", prefix: "-" },
        { label: "Bulk Discount",       value: data.bulk_discount,        color: "#10b981", prefix: "-" },
        { label: "Cart Value Offer",    value: data.cart_discount,        color: "#10b981", prefix: "-" },
        { label: "Promo Discount",      value: data.promo_discount,       color: "#10b981", prefix: "-" },
        { label: "You Pay",             value: data.final_total,          color: "var(--success)", prefix: "" },
    ].filter(d => d.prefix === "" || d.value > 0);

    if (cards) {
        cards.innerHTML = discounts.map(d => `
            <div class="col-6 col-md-4 col-lg-2">
                <div class="rounded-3 p-3 text-center" style="background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.1);">
                    <p class="mb-1" style="color:var(--text-secondary);font-size:.72rem;font-weight:600;">${d.label}</p>
                    <p class="mb-0 fw-bold" style="color:${d.color};font-size:.95rem;">
                        ${d.prefix}₹${Number(d.value).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
                    </p>
                </div>
            </div>`).join("");
    }

    const msgEl  = document.getElementById("personal-smart-msg");
    const msgTxt = document.getElementById("personal-smart-text");
    if (msgEl && msgTxt && data.smart_message) {
        msgTxt.textContent = data.smart_message;
        msgEl.classList.remove("hidden");
    }
}

// ========================
// TIER UPGRADE BANNER
// ========================
function renderTierUpgradeBanner(data) {
    const tierInfo = [
        { tier: "bronze",   threshold: 0,     discount: 0,  next: "Silver", nextAmt: 5000  },
        { tier: "silver",   threshold: 5000,  discount: 5,  next: "Gold",   nextAmt: 15000 },
        { tier: "gold",     threshold: 15000, discount: 10, next: "Platinum", nextAmt: 50000 },
        { tier: "platinum", threshold: 50000, discount: 15, next: null,     nextAmt: null  },
    ];

    const wrap  = document.getElementById("tier-upgrade-banner");
    const cards = document.getElementById("tier-upgrade-cards");
    if (!wrap || !cards) return;

    wrap.classList.remove("hidden");
    cards.innerHTML = tierInfo.map(t => {
        const c = TIER_COLORS[t.tier];
        return `
        <div class="col-6 col-md-3">
            <div class="rounded-3 p-3 text-center" style="background:${c}15;border:1px solid ${c}33;">
                <p class="fw-bold mb-1" style="color:${c};font-size:.95rem;text-transform:capitalize;">${t.tier.charAt(0).toUpperCase()+t.tier.slice(1)}</p>
                <p class="mb-1 fw-bold" style="color:var(--text-primary);font-size:1.1rem;">${t.discount > 0 ? t.discount + '% off' : 'Earn Points'}</p>
                <p class="mb-0 rs-text-xs" style="color:var(--text-secondary);">
                    ${t.threshold === 0 ? 'Default tier' : 'Spend ₹'+t.threshold.toLocaleString('en-IN')+'+'}
                </p>
            </div>
        </div>`;
    }).join("");
}

// ========================
// FILTER
// ========================
function filterOffers(category, btn) {
    activeFilter = category;
    document.querySelectorAll(".rs-offer-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderOffers(allOffers);
}

// ========================
// INIT
// ========================
init();
