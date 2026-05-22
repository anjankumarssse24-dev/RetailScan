/**
 * history.js — Purchase history with smart receipt analytics (Step 8)
 */

let _expandedTxn = null;  // currently expanded transaction ID

function loadHistory(dateFilter) {
    let url = "/api/history";
    if (dateFilter) url += `?date=${dateFilter}`;

    fetch(url).then(r => r.json()).then(data => {
        const container = document.getElementById("history-list");

        if (!data.transactions || data.transactions.length === 0) {
            container.innerHTML = `
                <div class="rs-empty-state">
                    <div class="icon-badge icon-badge-violet rs-empty-icon"><i class="fas fa-receipt"></i></div>
                    <p class="rs-empty-title">${dateFilter ? "No purchases on this date" : "No transactions yet"}</p>
                    <p class="rs-empty-sub">Complete a purchase to see it here</p>
                    <a href="/" class="btn-glow-primary" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 14px rgba(99,102,241,.35);">
                        <i class="fas fa-crosshairs"></i> Start Shopping
                    </a>
                </div>`;
            return;
        }

        container.innerHTML = data.transactions.map((txn, idx) => {
            let items = [];
            try { items = JSON.parse(txn.items_json); } catch(e) {}

            const saved      = parseFloat(txn.total_discount || 0);
            const pts        = parseInt(txn.points_earned || 0);
            const savedBadge = saved > 0
                ? `<span class="rs-badge" style="background:rgba(16,185,129,.12);color:#059669;border:1px solid rgba(16,185,129,.2);">
                       <i class="fas fa-piggy-bank me-1"></i>Saved ₹${saved.toFixed(0)}
                   </span>`
                : "";
            const ptsBadge   = pts > 0
                ? `<span class="rs-badge" style="background:rgba(139,92,246,.1);color:#7c3aed;border:1px solid rgba(139,92,246,.2);">
                       <i class="fas fa-star me-1"></i>+${pts} pts
                   </span>`
                : "";

            const itemsList = items.map(it => `
                <div class="d-flex justify-content-between align-items-center py-2"
                     style="border-bottom:1px solid rgba(99,102,241,.06);font-size:.85rem;">
                    <span class="d-flex align-items-center gap-2" style="color:var(--text-primary);min-width:0;flex:1;">
                        <i class="fas fa-box" style="color:var(--text-secondary);font-size:.7rem;flex-shrink:0;"></i>
                        <span class="rs-truncate">${it.name}</span>
                    </span>
                    <span class="mx-3" style="color:var(--text-secondary);font-size:.78rem;white-space:nowrap;">
                        ${it.category} &times; ${it.qty}
                    </span>
                    <span class="fw-semibold" style="color:var(--success);white-space:nowrap;">&#8377;${parseFloat(it.price).toFixed(2)}</span>
                </div>
            `).join("");

            return `
                <div class="txn-card" style="animation-delay:${idx * 0.07}s">
                    <!-- Header row -->
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 px-4 py-3"
                         style="border-bottom:1px solid rgba(99,102,241,.07);background:rgba(99,102,241,.02);">
                        <span class="fw-semibold d-flex align-items-center gap-2 rs-mono" style="color:var(--primary);font-size:.82rem;">
                            <i class="fas fa-receipt"></i>${txn.transaction_id}
                        </span>
                        <span class="d-flex align-items-center gap-1" style="color:var(--text-secondary);font-size:.78rem;">
                            <i class="fas fa-calendar-alt"></i>${txn.timestamp}
                        </span>
                    </div>

                    <!-- Items -->
                    <div class="px-4 py-3">${itemsList}</div>

                    <!-- Footer row: amount + badges + analytics button -->
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 px-4 py-3"
                         style="border-top:1px solid rgba(99,102,241,.07);background:rgba(99,102,241,.02);">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="fw-bold" style="color:var(--success);font-size:1.05rem;">&#8377;${parseFloat(txn.amount).toFixed(2)}</span>
                            ${savedBadge}
                            ${ptsBadge}
                            <span class="rs-badge rs-badge-primary">${txn.items_count} item${txn.items_count > 1 ? "s" : ""}</span>
                        </div>
                        <button class="txn-analytics-btn" onclick="toggleTxnAnalytics('${txn.transaction_id}', this)">
                            <i class="fas fa-chart-bar me-1"></i>Analytics
                            <i class="fas fa-chevron-down ms-1 txn-chevron" id="chev-${txn.transaction_id}"></i>
                        </button>
                    </div>

                    <!-- Expandable analytics panel -->
                    <div id="analytics-${txn.transaction_id}" class="txn-analytics-panel hidden"></div>
                </div>`;
        }).join("");
    });
}

async function toggleTxnAnalytics(txnId, btn) {
    const panel = document.getElementById(`analytics-${txnId}`);
    const chev  = document.getElementById(`chev-${txnId}`);
    if (!panel) return;

    const isOpen = !panel.classList.contains("hidden");

    // Close all others
    document.querySelectorAll(".txn-analytics-panel").forEach(p => p.classList.add("hidden"));
    document.querySelectorAll(".txn-chevron").forEach(c => c.style.transform = "");

    if (isOpen) return;  // was open → just closed it

    // Open this one
    panel.classList.remove("hidden");
    if (chev) chev.style.transform = "rotate(180deg)";

    // If already loaded, skip fetch
    if (panel.dataset.loaded) return;

    panel.innerHTML = `
        <div class="p-4">
            <div class="shimmer-card mb-2"></div>
            <div class="shimmer-card mb-2"></div>
            <div class="shimmer-card"></div>
        </div>`;

    try {
        const res  = await fetch(`/api/receipt/${txnId}`);
        const data = await res.json();
        if (!data.success) { panel.innerHTML = `<p class="p-4 text-center" style="color:var(--text-secondary);">Analytics unavailable</p>`; return; }
        panel.innerHTML = buildTxnAnalyticsHTML(data);
        panel.dataset.loaded = "1";
    } catch(e) {
        panel.innerHTML = `<p class="p-4 text-center" style="color:var(--text-secondary);">Could not load analytics</p>`;
    }
}

function buildTxnAnalyticsHTML(a) {
    const savings  = a.savings  || {};
    const loyalty  = a.loyalty  || {};
    const spending = a.spending || {};
    const cat      = a.category || {};

    // Savings breakdown chips
    let savChips = "";
    if (savings.has_savings && savings.breakdown) {
        savChips = savings.breakdown.map(b => `
            <span class="rs-badge" style="background:rgba(16,185,129,.1);color:#059669;border:1px solid rgba(16,185,129,.2);">
                <i class="fas fa-tag me-1"></i>${b.type}: -₹${b.amount.toFixed(2)}
            </span>`).join("");
    }

    // Insights
    const insightRows = (a.insights || []).map(i =>
        `<div class="receipt-insight-row">${i}</div>`
    ).join("");

    // Loyalty progress bar
    let loySection = "";
    if (loyalty.tier) {
        const pct   = loyalty.progress_pct || 0;
        const color = loyalty.color || "#6366f1";
        loySection = `
            <div class="mt-3 p-3 rounded-3" style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.15);">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-2">
                        <i class="fas fa-${loyalty.icon || 'crown'}" style="color:#d97706;"></i>
                        <span class="fw-semibold" style="color:var(--text-primary);font-size:.85rem;">${loyalty.tier.charAt(0).toUpperCase() + loyalty.tier.slice(1)} Member — ${loyalty.points} pts</span>
                    </div>
                    ${loyalty.next_tier ? `<span class="rs-badge rs-badge-amber" style="font-size:.65rem;">→ ${loyalty.next_tier}</span>` : ""}
                </div>
                <div style="height:6px;background:rgba(245,158,11,.12);border-radius:6px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${color};border-radius:6px;transition:width .5s;"></div>
                </div>
                <p class="mb-0 mt-1" style="color:var(--text-secondary);font-size:.72rem;">${loyalty.message || ""}</p>
            </div>`;
    }

    // Next time recs
    const TYPE_ICON = { fbt: "fa-link", similar: "fa-shuffle", trending: "fa-fire" };
    let recsSection = "";
    if (a.next_time && a.next_time.length) {
        recsSection = `
            <div class="mt-3">
                <p class="mb-2 fw-semibold" style="color:var(--text-secondary);font-size:.75rem;">NEXT TIME TRY</p>
                <div class="scan-rec-strip">
                    ${a.next_time.map(r => `
                        <div class="scan-rec-chip" title="${r.reason}">
                            <div class="rec-chip-icon"><i class="fas ${TYPE_ICON[r.type] || 'fa-star'}"></i></div>
                            <span>${r.name}</span>
                        </div>`).join("")}
                </div>
            </div>`;
    }

    return `
        <div class="px-4 py-3" style="border-top:1px solid rgba(99,102,241,.06);">
            ${savings.has_savings ? `
            <div class="mb-3">
                <p class="mb-2 fw-semibold" style="color:var(--text-secondary);font-size:.75rem;">SAVINGS BREAKDOWN</p>
                <div class="d-flex flex-wrap gap-2">${savChips}</div>
            </div>` : ""}
            ${insightRows ? `<div class="d-flex flex-column gap-2 mb-3">${insightRows}</div>` : ""}
            ${spending.avg_order_value ? `
            <div class="p-3 rounded-3 mb-3" style="background:rgba(6,182,212,.05);border:1px solid rgba(6,182,212,.12);">
                <div class="d-flex gap-4 flex-wrap">
                    <div>
                        <p class="mb-0" style="color:var(--text-secondary);font-size:.72rem;">Order #</p>
                        <p class="mb-0 fw-bold" style="color:var(--text-primary);font-size:.9rem;">${spending.order_count}</p>
                    </div>
                    <div>
                        <p class="mb-0" style="color:var(--text-secondary);font-size:.72rem;">Your Avg Basket</p>
                        <p class="mb-0 fw-bold" style="color:var(--text-primary);font-size:.9rem;">₹${spending.avg_order_value.toFixed(0)}</p>
                    </div>
                    <div>
                        <p class="mb-0" style="color:var(--text-secondary);font-size:.72rem;">Monthly Spend</p>
                        <p class="mb-0 fw-bold" style="color:var(--text-primary);font-size:.9rem;">₹${(spending.monthly_spend || 0).toFixed(0)}</p>
                    </div>
                    ${cat.top_category ? `<div>
                        <p class="mb-0" style="color:var(--text-secondary);font-size:.72rem;">Top Category</p>
                        <p class="mb-0 fw-bold" style="color:var(--text-primary);font-size:.9rem;">${cat.top_category.charAt(0).toUpperCase() + cat.top_category.slice(1)}</p>
                    </div>` : ""}
                </div>
            </div>` : ""}
            ${loySection}
            ${recsSection}
        </div>`;
}

document.getElementById("btn-filter").addEventListener("click", () => {
    const date = document.getElementById("filter-date").value;
    if (!date) { showToast("Select a date first", "error"); return; }
    loadHistory(date);
});

document.getElementById("btn-clear-filter").addEventListener("click", () => {
    document.getElementById("filter-date").value = "";
    loadHistory();
});

// Cart badge
fetch("/api/cart").then(r => r.json()).then(d => {
    document.querySelectorAll(".nav-cart-badge").forEach(el => { el.textContent = d.items.length; });
});

loadHistory();
