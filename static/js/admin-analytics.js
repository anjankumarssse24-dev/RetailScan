/**
 * admin-analytics.js — Analytics charts & reports.
 * Requires admin-shared.js + Chart.js.
 */

// ========================
// REVENUE + ORDERS TREND
// ========================
function drawRevenueTrend() {
    const canvas = document.getElementById("revenue-trend-chart");
    if (!canvas || typeof Chart === "undefined") return;

    new Chart(canvas, {
        type: "line",
        data: {
            labels: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
            datasets: [
                {
                    label: "Revenue (INR)",
                    data: [42800, 38500, 51200, 47600, 63100, 71400],
                    borderColor: "#6366f1",
                    backgroundColor: "rgba(99,102,241,0.07)",
                    tension: 0.4, fill: true,
                    yAxisID: "yRevenue",
                    pointBackgroundColor: "#6366f1", pointRadius: 4, pointHoverRadius: 6
                },
                {
                    label: "Orders",
                    data: [134, 118, 161, 149, 198, 224],
                    borderColor: "#06b6d4",
                    backgroundColor: "transparent",
                    tension: 0.4, fill: false,
                    yAxisID: "yOrders",
                    borderDash: [5, 3],
                    pointBackgroundColor: "#06b6d4", pointRadius: 4, pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.datasetIndex === 0
                            ? " Rev: Rs " + ctx.raw.toLocaleString("en-IN")
                            : " Orders: " + ctx.raw
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11 } } },
                yRevenue: {
                    position: "left",
                    grid: { color: "rgba(99,102,241,0.06)" },
                    ticks: { color: "#6b7280", font: { size: 10 }, callback: v => "Rs " + (v/1000) + "k" }
                },
                yOrders: {
                    position: "right",
                    grid: { display: false },
                    ticks: { color: "#06b6d4", font: { size: 10 } }
                }
            }
        }
    });
}

// ========================
// TIER DONUT CHART (live data)
// ========================
async function drawTierDonut() {
    const canvas = document.getElementById("tier-donut-chart");
    if (!canvas || typeof Chart === "undefined") return;

    // Try to get real tier counts from users API
    let counts = { bronze: 65, silver: 20, gold: 10, platinum: 5 };
    try {
        const res  = await fetch("/admin/api/users?per_page=200");
        const data = await res.json();
        if (data.success && data.users.length > 0) {
            counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
            data.users.forEach(u => { if (counts[u.membership_tier] !== undefined) counts[u.membership_tier]++; });
            // Update sidebar count
            const cust = data.users.filter(u => u.role === "customer").length;
            setText("sidebar-customer-count", cust);
        }
    } catch (_) { /* use demo counts */ }

    new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Bronze", "Silver", "Gold", "Platinum"],
            datasets: [{
                data: [counts.bronze, counts.silver, counts.gold, counts.platinum],
                backgroundColor: ["#cd7f3244", "#9ca3af44", "#f59e0b44", "#6366f144"],
                borderColor:     ["#cd7f32",   "#9ca3af",   "#f59e0b",   "#6366f1"],
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: "#6b7280", boxWidth: 12, padding: 12, font: { size: 11 } }
                }
            },
            cutout: "68%"
        }
    });
}

// ========================
// DAILY ORDERS BAR CHART
// ========================
function drawDailyOrders() {
    const canvas = document.getElementById("daily-orders-chart");
    if (!canvas || typeof Chart === "undefined") return;

    const days  = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
    const vals  = [42, 28, 61, 55, 73, 68, 79];

    new Chart(canvas, {
        type: "bar",
        data: {
            labels: days,
            datasets: [{
                label: "Orders",
                data: vals,
                backgroundColor: vals.map((v, i) => i === vals.length - 1
                    ? "rgba(99,102,241,.9)"
                    : "rgba(99,102,241,.4)"),
                borderRadius: 6,
                barThickness: 28
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11 } } },
                y: {
                    grid: { color: "rgba(99,102,241,0.06)" },
                    ticks: { color: "#6b7280", font: { size: 11 }, stepSize: 20 },
                    beginAtZero: true
                }
            }
        }
    });
}

// ========================
// DEVICE BREAKDOWN
// ========================
const DEVICES = [
    { label: "Mobile",  icon: "fa-mobile-screen", color: "var(--primary)",  pct: 71 },
    { label: "Desktop", icon: "fa-desktop",        color: "var(--accent)",   pct: 22 },
    { label: "Tablet",  icon: "fa-tablet-screen-button", color: "var(--warning)", pct: 7 },
];

function renderDeviceBreakdown() {
    const el = document.getElementById("device-breakdown");
    if (!el) return;
    el.innerHTML = DEVICES.map(d => `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="d-flex align-items-center gap-2" style="font-size:.875rem;color:var(--text-secondary);">
                    <i class="fas ${d.icon}" style="color:${d.color};width:16px;text-align:center;"></i> ${d.label}
                </span>
                <span class="fw-semibold" style="font-size:.875rem;color:var(--text-primary);">${d.pct}%</span>
            </div>
            <div class="rs-progress-track">
                <div class="rs-progress-fill" style="width:${d.pct}%;background:${d.color};"></div>
            </div>
        </div>
    `).join("");
}

// ========================
// TRAFFIC SOURCES TABLE
// ========================
const TRAFFIC_SOURCES = [
    { source: "Direct",        icon: "fa-bolt",        color: "var(--primary)",  sessions: 12840, conv: 3901, rate: "30.4", avg: 748 },
    { source: "Google Search", icon: "fa-magnifying-glass", color: "#4285f4",   sessions: 9210,  conv: 2648, rate: "28.7", avg: 692 },
    { source: "WhatsApp Share",icon: "fa-comment",     color: "#25d366",         sessions: 6330,  conv: 2218, rate: "35.0", avg: 820 },
    { source: "Instagram",     icon: "fa-instagram",   color: "#e1306c",         sessions: 4190,  conv: 921,  rate: "22.0", avg: 610 },
    { source: "Email Campaign",icon: "fa-envelope",    color: "var(--accent)",   sessions: 2840,  conv: 1136, rate: "40.0", avg: 894 },
    { source: "Referral",      icon: "fa-share-nodes", color: "var(--warning)",  sessions: 1880,  conv: 451,  rate: "24.0", avg: 655 },
];

function renderTrafficTable() {
    const tbody = document.getElementById("traffic-table");
    if (!tbody) return;
    const total = TRAFFIC_SOURCES.reduce((s, r) => s + r.sessions, 0);
    tbody.innerHTML = TRAFFIC_SOURCES.map(r => {
        const share = Math.round((r.sessions / total) * 100);
        return `
        <tr class="rs-table-row">
            <td>
                <div class="d-flex align-items-center gap-2">
                    <i class="fab ${r.icon.startsWith("fa-i") ? "fab" : "fas"} ${r.icon}" style="color:${r.color};width:16px;text-align:center;"></i>
                    <span class="fw-semibold" style="color:var(--text-primary);font-size:.875rem;">${r.source}</span>
                </div>
            </td>
            <td style="color:var(--text-secondary);">${r.sessions.toLocaleString()}</td>
            <td style="color:var(--text-secondary);">${r.conv.toLocaleString()}</td>
            <td><span class="rs-badge rs-badge-success">${r.rate}%</span></td>
            <td style="color:var(--text-primary);font-weight:600;">${formatCurrency(r.avg)}</td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rs-progress-track flex-grow-1" style="max-width:80px;">
                        <div class="rs-progress-fill" style="width:${share}%;background:${r.color};"></div>
                    </div>
                    <span class="rs-text-xs" style="color:var(--text-secondary);">${share}%</span>
                </div>
            </td>
        </tr>`;
    }).join("");
}

// ========================
// RECEIPT ANALYTICS
// ========================
async function loadReceiptAnalytics() {
    try {
        const res  = await fetch("/admin/api/receipt-analytics");
        const data = await res.json();
        if (!data.success) return;

        const fmt = n => "₹" + Number(n).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

        setText("ra-total-orders", data.total_orders);
        setText("ra-avg-basket",   fmt(data.avg_order_value));
        setText("ra-avg-discount", fmt(data.avg_discount));
        setText("ra-total-savings", fmt(data.total_savings));

        const badge = document.getElementById("receipt-savings-rate");
        if (badge) badge.textContent = data.avg_savings_rate + "% avg savings";

        // Day of week bar chart
        const bars   = document.getElementById("ra-day-bars");
        const labels = document.getElementById("ra-day-labels");
        if (bars && data.by_day && data.by_day.length) {
            const DAY_ORDER = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            const byDayMap  = {};
            data.by_day.forEach(d => { byDayMap[d.day] = d; });
            const maxOrders = Math.max(...data.by_day.map(d => d.orders), 1);

            const barHTML   = [];
            const labelHTML = [];
            DAY_ORDER.forEach(day => {
                const d   = byDayMap[day] || { orders: 0, avg_amount: 0 };
                const pct = Math.max(8, Math.round((d.orders / maxOrders) * 100));
                const isWeekend = day === "Sat" || day === "Sun";
                const color = isWeekend ? "linear-gradient(180deg,#f59e0b,#d97706)" : "linear-gradient(180deg,var(--primary),var(--secondary))";
                barHTML.push(`
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;">
                        <span style="font-size:.65rem;color:var(--text-secondary);font-weight:600;">${d.orders || 0}</span>
                        <div style="width:100%;height:${pct}%;background:${color};border-radius:6px 6px 0 0;transition:height .4s;"
                             title="${day}: ${d.orders || 0} orders, avg ₹${Number(d.avg_amount||0).toFixed(0)}"></div>
                    </div>`);
                labelHTML.push(`<span style="flex:1;text-align:center;font-size:.72rem;color:var(--text-secondary);font-weight:${isWeekend ? 700 : 400};">${day}</span>`);
            });
            bars.innerHTML   = barHTML.join("");
            labels.innerHTML = labelHTML.join("");
        }
    } catch(e) {
        console.error("Receipt analytics error", e);
    }
}

// ========================
// DISCOUNT ANALYTICS
// ========================
async function loadDiscountStats() {
    try {
        const res  = await fetch("/admin/api/discount-stats");
        const data = await res.json();
        if (!data.success) return;

        const ds = data.discount_stats;
        const fmtCurr = n => "₹" + Number(n).toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2});

        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText("disc-total",  fmtCurr(ds.total_discounts));
        setText("disc-orders", ds.discounted_orders);
        setText("disc-gross",  fmtCurr(ds.gross_revenue));
        setText("disc-net",    fmtCurr(ds.net_revenue));

        const discRate = ds.gross_revenue > 0
            ? (ds.total_discounts / ds.gross_revenue * 100).toFixed(1)
            : 0;
        const badge = document.getElementById("disc-rate-badge");
        if (badge) badge.textContent = discRate + "% avg discount";

        // Type bars
        const bars = document.getElementById("disc-type-bars");
        if (!bars) return;

        const types = [
            { label: "Membership Discount", val: ds.membership_total, color: "#f59e0b" },
            { label: "Bulk Discount",        val: ds.bulk_total,       color: "#6366f1" },
            { label: "Cart Value Offer",     val: ds.cart_total,       color: "#06b6d4" },
            { label: "Promo Discount",       val: ds.promo_total,      color: "#ef4444" },
        ];
        const maxVal = Math.max(...types.map(t => t.val), 1);

        bars.innerHTML = types.map(t => {
            const pct = Math.round((t.val / maxVal) * 100);
            return `
            <div>
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span style="font-size:.84rem;color:var(--text-secondary);">${t.label}</span>
                    <span class="fw-semibold" style="font-size:.84rem;color:var(--text-primary);">${fmtCurr(t.val)}</span>
                </div>
                <div class="rs-progress-track">
                    <div class="rs-progress-fill" style="width:${pct}%;background:${t.color};"></div>
                </div>
            </div>`;
        }).join("");

    } catch (e) {
        console.error("Discount stats error", e);
    }
}

// ========================
// INIT
// ========================
// RECOMMENDATION ANALYTICS
// ========================
async function loadRecommendationAnalytics() {
    try {
        const res  = await fetch("/admin/api/recommendation-analytics");
        const data = await res.json();
        if (!data.success) return;

        // Header badges
        const basketBadge = document.getElementById("rec-basket-badge");
        const countBadge  = document.getElementById("rec-basket-count");
        if (basketBadge) basketBadge.textContent = `Avg basket: ${data.avg_basket_size} items`;
        if (countBadge)  countBadge.textContent  = `${data.total_baskets} baskets`;

        // Top products bar list
        const tpEl = document.getElementById("rec-top-products");
        if (tpEl && data.top_products && data.top_products.length) {
            const maxCnt = data.top_products[0].count || 1;
            tpEl.innerHTML = data.top_products.map((p, i) => `
                <div class="mb-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span style="font-size:.8rem;font-weight:600;color:var(--text-primary);">
                            ${i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`} ${p.name}
                        </span>
                        <span class="rs-badge rs-badge-primary">${p.count}×</span>
                    </div>
                    <div style="height:6px;background:rgba(99,102,241,.1);border-radius:6px;overflow:hidden;">
                        <div style="width:${(p.count/maxCnt*100).toFixed(1)}%;height:100%;
                             background:linear-gradient(90deg,var(--primary),var(--secondary));
                             border-radius:6px;transition:width .4s;"></div>
                    </div>
                </div>`).join("");
        } else if (tpEl) {
            tpEl.innerHTML = `<p class="rs-text-xs text-center py-3" style="color:var(--text-secondary);">No purchase data yet</p>`;
        }

        // Top co-purchase pairs
        const tpairsEl = document.getElementById("rec-top-pairs");
        if (tpairsEl && data.top_pairs && data.top_pairs.length) {
            tpairsEl.innerHTML = data.top_pairs.map(pair => `
                <div class="d-flex align-items-center justify-content-between py-2 border-bottom"
                     style="border-color:rgba(99,102,241,.08)!important;">
                    <div class="d-flex align-items-center gap-2">
                        <span class="rs-badge rs-badge-primary" style="font-size:.65rem;">${pair.product_a}</span>
                        <i class="fas fa-plus" style="color:var(--text-secondary);font-size:.6rem;"></i>
                        <span class="rs-badge rs-badge-violet" style="font-size:.65rem;">${pair.product_b}</span>
                    </div>
                    <span class="rs-text-xs fw-semibold" style="color:var(--success);">${pair.count}× together</span>
                </div>`).join("");
        } else if (tpairsEl) {
            tpairsEl.innerHTML = `<p class="rs-text-xs text-center py-3" style="color:var(--text-secondary);">No pair data yet</p>`;
        }
    } catch (e) {
        console.error("Recommendation analytics error", e);
    }
}

// ========================
window.addEventListener("load", () => {
    drawRevenueTrend();
    drawTierDonut();
    drawDailyOrders();
    renderDeviceBreakdown();
    renderTrafficTable();
    loadReceiptAnalytics();
    loadDiscountStats();
    loadRecommendationAnalytics();
});
