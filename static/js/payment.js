/**
 * payment.js — UPI Payment with PIN Modal
 */

const CORRECT_PIN = "1234";
let selectedPayApp = "";
let enteredPin = "";
let paymentAmount = 0;

// ========================
// DATA LOADING
// ========================
function loadWalletBalance() {
    fetch("/api/wallet").then(r => r.json()).then(d => {
        const el = document.getElementById("wallet-balance");
        if (el) el.textContent = `₹${d.balance.toFixed(2)}`;
    });
}

function loadPaymentInfo() {
    loadWalletBalance();
    fetch("/api/cart").then(r => r.json()).then(d => {
        paymentAmount = d.total;
        document.getElementById("pay-items-count").textContent = d.items.length;
        document.getElementById("pay-total").textContent = `\u20B9${d.total.toFixed(2)}`;
        document.querySelectorAll(".nav-cart-badge").forEach(el => { el.textContent = d.items.length; });
    });
}

// ========================
// UPI MODAL SYSTEM
// ========================
function openModal() {
    if (paymentAmount <= 0) {
        showToast("Cart is empty!", "error");
        return;
    }
    enteredPin = "";
    updatePinDots();
    document.getElementById("pin-error").textContent = "";
    document.getElementById("upi-modal-amount").textContent = `₹${paymentAmount.toFixed(2)}`;
    const methodAmtEl = document.getElementById("method-amount");
    if (methodAmtEl) methodAmtEl.textContent = `₹${paymentAmount.toFixed(2)}`;

    // Show payment app selection step first
    document.getElementById("upi-step-method").classList.remove("hidden");
    document.getElementById("upi-step-pin").classList.add("hidden");
    document.getElementById("upi-step-processing").classList.add("hidden");
    document.getElementById("upi-step-success").classList.add("hidden");

    // Show modal
    const overlay = document.getElementById("upi-modal-overlay");
    overlay.classList.remove("hidden");
    void overlay.offsetWidth;
    overlay.classList.add("show");
}

function closeModal() {
    const overlay = document.getElementById("upi-modal-overlay");
    overlay.classList.remove("show");
    setTimeout(() => overlay.classList.add("hidden"), 300);
}

function selectApp(appName) {
    selectedPayApp = appName;
    const lbl = document.getElementById("upi-pin-app-label");
    if (lbl) lbl.textContent = appName;
    document.getElementById("upi-step-method").classList.add("hidden");
    document.getElementById("upi-step-pin").classList.remove("hidden");
    enteredPin = "";
    updatePinDots();
    document.getElementById("pin-error").textContent = "";
}

function backToMethodStep() {
    document.getElementById("upi-step-pin").classList.add("hidden");
    document.getElementById("upi-step-method").classList.remove("hidden");
}

function updatePinDots() {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((dot, i) => {
        if (i < enteredPin.length) {
            dot.classList.add("filled");
        } else {
            dot.classList.remove("filled");
        }
    });
}

function addDigit(digit) {
    if (enteredPin.length >= 4) return;
    enteredPin += digit;
    updatePinDots();
    document.getElementById("pin-error").textContent = "";

    // Auto-submit when 4 digits entered
    if (enteredPin.length === 4) {
        setTimeout(() => verifyPin(), 200);
    }
}

function removeDigit() {
    if (enteredPin.length === 0) return;
    enteredPin = enteredPin.slice(0, -1);
    updatePinDots();
    document.getElementById("pin-error").textContent = "";
}

function verifyPin() {
    // Accept any 4-digit PIN (bank validates against actual UPI PIN server-side)
    document.getElementById("upi-step-pin").classList.add("hidden");
    document.getElementById("upi-step-processing").classList.remove("hidden");

    // Rotating bank authentication messages
    const bankMsgs = [
        "Contacting bank...",
        `Verifying with ${selectedPayApp || "UPI"}...`,
        "Authorizing via NPCI...",
        "Securing transaction...",
        "Confirming payment..."
    ];
    let mi = 0;
    const msgEl = document.getElementById("upi-processing-msg");
    if (msgEl) msgEl.textContent = bankMsgs[0];
    const msgTimer = setInterval(() => {
        mi++;
        if (mi < bankMsgs.length && msgEl) msgEl.textContent = bankMsgs[mi];
    }, 600);

    // Call API after 3 seconds (realistic bank processing delay)
    setTimeout(() => {
        clearInterval(msgTimer);
        fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_email: window._currentUserEmail || "" })
        })
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    closeModal();
                    showToast(data.error, "error");
                    return;
                }

                // Show success step in modal
                document.getElementById("upi-step-processing").classList.add("hidden");
                document.getElementById("upi-step-success").classList.remove("hidden");

                const npciRef = "NPCI" + data.transaction_id.replace("TXN_", "");
                document.getElementById("upi-success-amount").textContent = `₹${data.amount_paid.toFixed(2)}`;
                const pointsRow = (data.points_earned > 0)
                    ? `<div class="receipt-row"><span style="color:var(--text-secondary);">Reward Points</span><span style="color:#10b981;font-weight:700;">+${data.points_earned} pts</span></div>`
                    : "";
                const discRow = (data.total_discount > 0)
                    ? `<div class="receipt-row"><span style="color:var(--text-secondary);">Discount Saved</span><span style="color:#10b981;font-weight:700;">-₹${data.total_discount.toFixed(2)}</span></div>`
                    : "";
                document.getElementById("upi-success-details").innerHTML = `
                    <div class="receipt-row"><span style="color:var(--text-secondary);">UPI Ref No.</span><span style="color:var(--primary);font-family:monospace;font-size:.72rem;">${npciRef}</span></div>
                    <div class="receipt-row"><span style="color:var(--text-secondary);">Paid via</span><span style="color:var(--text-primary);font-weight:600;">${selectedPayApp || "UPI"}</span></div>
                    <div class="receipt-row"><span style="color:var(--text-secondary);">Merchant</span><span style="color:var(--text-primary);">RetailScan@okaxis</span></div>
                    ${data.total_discount > 0 ? `<div class="receipt-row"><span style="color:var(--text-secondary);">Subtotal</span><span style="color:var(--text-primary);">₹${(data.subtotal||0).toFixed(2)}</span></div>` : ""}
                    ${discRow}
                    <div class="receipt-row"><span style="color:var(--text-secondary);">Amount Paid</span><span style="color:var(--success);font-weight:700;">₹${data.amount_paid.toFixed(2)}</span></div>
                    <div class="receipt-row"><span style="color:var(--text-secondary);">Items</span><span style="color:var(--text-primary);">${data.items_count}</span></div>
                    <div class="receipt-row"><span style="color:var(--text-secondary);">Balance Left</span><span style="color:var(--text-primary);">₹${data.balance_after.toFixed(2)}</span></div>
                    ${pointsRow}
                    <div class="receipt-row"><span style="color:var(--text-secondary);">Date</span><span style="color:var(--text-secondary);font-size:.75rem;">${data.timestamp}</span></div>
                    ${data.email_queued_to ? `<div class="receipt-row"><span style="color:var(--text-secondary);">Receipt sent to</span><span style="color:#10b981;font-size:.75rem;">${data.email_queued_to}</span></div>` : `<div class="receipt-row"><span style="color:var(--text-secondary);">Receipt email</span><span style="color:#ef4444;font-size:.75rem;">Not sent (no email)</span></div>`}
                `;

                // Store data for the main page success view
                window._lastPayment = data;

                const badge = document.getElementById("nav-cart-count");
                if (badge) badge.textContent = "0";
            })
            .catch(e => {
                closeModal();
                showToast("Payment failed: " + e.message, "error");
            });
    }, 3000);
}

// ========================
// EVENT LISTENERS
// ========================

// Pay Now button opens modal
document.getElementById("btn-pay").addEventListener("click", openModal);

// Keypad clicks
document.querySelectorAll(".key-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        if (key === "cancel") {
            closeModal();
        } else if (key === "backspace") {
            removeDigit();
        } else {
            addDigit(key);
        }
    });
});

// Keyboard input support
document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("upi-modal-overlay");
    if (overlay.classList.contains("hidden")) return;
    if (document.getElementById("upi-step-pin").classList.contains("hidden")) return;

    if (e.key >= "0" && e.key <= "9") {
        addDigit(e.key);
    } else if (e.key === "Backspace") {
        removeDigit();
    } else if (e.key === "Escape") {
        closeModal();
    }
});

// Done button — close modal, show analytics-rich success page
document.getElementById("upi-done-btn").addEventListener("click", () => {
    closeModal();

    const data = window._lastPayment;
    if (!data) return;

    // Hide payment form
    document.getElementById("payment-summary").classList.add("hidden");
    document.getElementById("wallet-card-section").classList.add("hidden");
    document.getElementById("payment-success").classList.remove("hidden");

    // 1. Hero section — populate immediately from checkout response
    document.getElementById("ps-amount").textContent    = `₹${data.amount_paid.toFixed(2)}`;
    document.getElementById("ps-txn-id").textContent    = data.transaction_id;
    document.getElementById("ps-timestamp").textContent = data.timestamp;
    document.getElementById("ps-items-badge").textContent = `${data.items_count} item${data.items_count !== 1 ? "s" : ""}`;

    // 2. Highlights (savings + points) — immediate
    renderPaymentHighlights(data);

    // Toasts
    showToast("Payment successful! 🎉");
    if (data.total_discount > 0)
        setTimeout(() => showToast(`You saved ₹${data.total_discount.toFixed(2)} on this order!`, "success"), 400);
    if (data.points_earned > 0)
        setTimeout(() => showToast(`+${data.points_earned} Reward Points Earned!`, "success"), 700);

    // Confetti burst on significant purchases
    if (typeof Confetti !== "undefined") {
        setTimeout(() => Confetti.burst(), 300);
    }

    // 3. Load analytics from API
    loadReceiptAnalytics(data.transaction_id, data);

    // Refresh nav loyalty display
    if (typeof loadUserInfo === "function") loadUserInfo();
    document.querySelectorAll(".nav-cart-badge").forEach(el => { el.textContent = "0"; });
});

// ========================
// ANALYTICS RENDERING
// ========================

function renderPaymentHighlights(data) {
    const el     = document.getElementById("ps-highlights");
    if (!el) return;
    const hasSav = data.total_discount > 0;
    const hasPts = data.points_earned  > 0;
    if (!hasSav && !hasPts) { el.innerHTML = ""; return; }

    el.innerHTML = `
        <div class="row g-3 mb-0">
            ${hasSav ? `
            <div class="${hasPts ? "col-6" : "col-12"}">
                <div class="receipt-highlight-card savings-highlight">
                    <div class="rh-icon"><i class="fas fa-piggy-bank"></i></div>
                    <div>
                        <p class="rh-label">You Saved Today</p>
                        <p class="rh-value">₹${data.total_discount.toFixed(2)}</p>
                        <p class="rh-sub">${data.savings_pct > 0 ? data.savings_pct.toFixed(1) + "% off" : ""}</p>
                    </div>
                </div>
            </div>` : ""}
            ${hasPts ? `
            <div class="${hasSav ? "col-6" : "col-12"}">
                <div class="receipt-highlight-card points-highlight">
                    <div class="rh-icon"><i class="fas fa-star"></i></div>
                    <div>
                        <p class="rh-label">Points Earned</p>
                        <p class="rh-value">+${data.points_earned}</p>
                        <p class="rh-sub">Reward points</p>
                    </div>
                </div>
            </div>` : ""}
        </div>`;
}

async function loadReceiptAnalytics(txnId, payData) {
    const cardsEl = document.getElementById("ps-analytics-cards");
    if (cardsEl) {
        cardsEl.innerHTML = `
            <div class="col-12"><div class="shimmer-card" style="height:80px;"></div></div>
            <div class="col-12"><div class="shimmer-card" style="height:80px;"></div></div>`;
    }
    try {
        const res  = await fetch(`/api/receipt/${txnId}`);
        const data = await res.json();
        if (!data.success) { if (cardsEl) cardsEl.innerHTML = ""; return; }

        renderAnalyticsCards(data, payData);
        renderSmartInsights(data.insights || []);
        renderNextTimeRecs(data.next_time  || []);
        buildPrintReceipt(payData, data);
    } catch(e) {
        console.error("Receipt analytics error", e);
        if (cardsEl) cardsEl.innerHTML = "";
    }
}

function renderAnalyticsCards(analytics, payData) {
    const el = document.getElementById("ps-analytics-cards");
    if (!el) return;

    const cards = [];

    // Category card
    const cat = analytics.category || {};
    if (cat.top_category) {
        cards.push(`
            <div class="col-12 col-md-4">
                <div class="receipt-analytics-mini-card">
                    <div class="ram-icon" style="background:rgba(99,102,241,.1);color:var(--primary);">
                        <i class="fas fa-tags"></i>
                    </div>
                    <div>
                        <p class="ram-label">Top Category</p>
                        <p class="ram-value">${cat.top_category.charAt(0).toUpperCase() + cat.top_category.slice(1)}</p>
                        <p class="ram-sub">${cat.unique_categories} categor${cat.unique_categories === 1 ? "y" : "ies"} this order</p>
                    </div>
                </div>
            </div>`);
    }

    // Spending card
    const sp = analytics.spending || {};
    if (sp.avg_order_value) {
        const trend = sp.trend === "up" ? "📈" : sp.trend === "down" ? "📉" : "📊";
        const pct   = sp.avg_increase_pct;
        const pctTxt = pct > 0 ? `+${pct.toFixed(0)}% vs avg` : pct < 0 ? `${pct.toFixed(0)}% vs avg` : "on par with avg";
        cards.push(`
            <div class="col-12 col-md-4">
                <div class="receipt-analytics-mini-card">
                    <div class="ram-icon" style="background:rgba(6,182,212,.1);color:#0891b2;">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <p class="ram-label">Basket vs Average</p>
                        <p class="ram-value">${trend} ${pctTxt}</p>
                        <p class="ram-sub">Avg: ₹${sp.avg_order_value.toFixed(0)} &bull; Order #${sp.order_count}</p>
                    </div>
                </div>
            </div>`);
    }

    // Loyalty card
    const loy = analytics.loyalty || {};
    if (loy.tier) {
        const pct   = loy.progress_pct || 0;
        const color = loy.color || "#6366f1";
        const nxt   = loy.next_tier ? `To ${loy.next_tier}` : "Max tier";

        // Confetti for Gold / Platinum tier
        if (typeof Confetti !== "undefined") {
            const tier = (loy.tier || "").toLowerCase();
            if (tier === "gold" || tier === "platinum") {
                setTimeout(() => Confetti.rain(2000), 800);
            }
        }
        cards.push(`
            <div class="col-12 col-md-4">
                <div class="receipt-analytics-mini-card">
                    <div class="ram-icon" style="background:rgba(245,158,11,.1);color:#d97706;">
                        <i class="fas fa-${loy.icon || "crown"}"></i>
                    </div>
                    <div style="width:100%;">
                        <p class="ram-label">${loy.tier.charAt(0).toUpperCase() + loy.tier.slice(1)} Member</p>
                        <p class="ram-value">${loy.points} pts</p>
                        <div class="ram-progress-track mt-1">
                            <div class="ram-progress-fill" style="width:${pct}%;background:${color};"></div>
                        </div>
                        <p class="ram-sub mt-1">${nxt} — ${pct.toFixed(0)}%</p>
                    </div>
                </div>
            </div>`);
    }

    // Spending trend mini chart
    const trend = analytics.trend || [];
    if (trend.length > 1 && trend.some(t => t.total > 0)) {
        const maxVal = Math.max(...trend.map(t => t.total), 1);
        const bars = trend.map(t => {
            const h = Math.max(4, Math.round((t.total / maxVal) * 40));
            return `<div class="trend-bar-wrap" title="${t.label}: ₹${t.total}">
                        <div class="trend-bar" style="height:${h}px;"></div>
                        <span class="trend-bar-lbl">${t.week}</span>
                    </div>`;
        }).join("");
        cards.push(`
            <div class="col-12">
                <div class="receipt-analytics-mini-card flex-column align-items-start gap-2">
                    <p class="ram-label mb-0"><i class="fas fa-chart-bar me-1" style="color:var(--primary);"></i> Spending Trend (Last ${trend.length} Weeks)</p>
                    <div class="trend-chart">${bars}</div>
                </div>
            </div>`);
    }

    el.innerHTML = cards.join("");
}

function renderSmartInsights(insights) {
    const card = document.getElementById("ps-insights-card");
    const list = document.getElementById("ps-insights-list");
    if (!card || !list || !insights.length) return;

    list.innerHTML = insights.map(ins => `
        <div class="receipt-insight-row">
            <span>${ins}</span>
        </div>`).join("");
    card.classList.remove("hidden");
}

function renderNextTimeRecs(recs) {
    const card  = document.getElementById("ps-recs-card");
    const strip = document.getElementById("ps-recs-strip");
    if (!card || !strip || !recs.length) return;

    const TYPE_ICON = { fbt: "fa-link", similar: "fa-shuffle", trending: "fa-fire" };
    strip.innerHTML = recs.map(r => `
        <div class="scan-rec-chip" title="${r.reason}">
            <div class="rec-chip-icon">
                <i class="fas ${TYPE_ICON[r.type] || "fa-star"}"></i>
            </div>
            <span>${r.name}</span>
        </div>`).join("");
    card.classList.remove("hidden");
}

// ========================
// PRINT / DOWNLOAD RECEIPT
// ========================

function buildPrintReceipt(payData, analytics) {
    const el = document.getElementById("print-body");
    if (!el) return;

    const savings  = analytics.savings  || {};
    const loyalty  = analytics.loyalty  || {};
    const insights = analytics.insights || [];

    let discountRows = "";
    if (savings.has_savings) {
        discountRows = `
            <tr><td>Subtotal</td><td>₹${savings.subtotal.toFixed(2)}</td></tr>
            ${(savings.breakdown || []).map(b =>
                `<tr class="print-disc-row"><td>${b.type}</td><td>-₹${b.amount.toFixed(2)}</td></tr>`
            ).join("")}
            <tr class="print-saved-row"><td><strong>Total Saved</strong></td><td><strong>-₹${savings.total_discount.toFixed(2)}</strong></td></tr>`;
    }

    let items = [];
    try { items = analytics.items || []; } catch(e) {}

    const itemRows = items.map(i =>
        `<tr><td>${i.name}</td><td>${i.category}</td><td>×${i.qty}</td><td>₹${i.price.toFixed(2)}</td></tr>`
    ).join("");

    el.innerHTML = `
        <table class="print-info-table">
            <tr><td><strong>Transaction ID</strong></td><td>${payData.transaction_id}</td></tr>
            <tr><td><strong>Date & Time</strong></td><td>${payData.timestamp}</td></tr>
            <tr><td><strong>Payment Method</strong></td><td>UPI — smartcart@upi</td></tr>
        </table>
        <h3 class="print-section-title">Order Summary</h3>
        <table class="print-items-table">
            <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>${itemRows}</tbody>
        </table>
        <table class="print-totals-table">
            ${discountRows}
            <tr class="print-paid-row"><td><strong>Amount Paid</strong></td><td><strong>₹${payData.amount_paid.toFixed(2)}</strong></td></tr>
            ${payData.points_earned > 0 ? `<tr class="print-pts-row"><td>Reward Points Earned</td><td>+${payData.points_earned} pts</td></tr>` : ""}
        </table>
        ${loyalty.tier ? `
        <div class="print-loyalty-section">
            <strong>${loyalty.tier.charAt(0).toUpperCase() + loyalty.tier.slice(1)} Member</strong> &bull;
            ${loyalty.points} pts &bull;
            ${loyalty.next_tier ? `${loyalty.progress_pct}% to ${loyalty.next_tier}` : "Platinum tier"}
        </div>` : ""}
        ${insights.length ? `
        <div class="print-insights-section">
            <strong>Shopping Insights</strong>
            <ul>${insights.map(i => `<li>${i}</li>`).join("")}</ul>
        </div>` : ""}`;
}

function downloadReceipt() {
    window.print();
}

// Prevent overlay click from closing during processing/success
document.getElementById("upi-modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
        // Only allow close during PIN step
        if (!document.getElementById("upi-step-pin").classList.contains("hidden")) {
            closeModal();
        }
    }
});

// Init
loadPaymentInfo();
