/**
 * admin-dashboard.js — Dashboard stats & charts.
 * Requires admin-shared.js (already loaded by _layout.html).
 */

// ========================
// STATS (from live API)
// ========================
async function loadStats() {
    try {
        const res  = await fetch("/admin/api/stats");
        const data = await res.json();
        if (!data.success) { showToast("Failed to load stats", "error"); return; }

        const { total_revenue, total_orders, total_customers, avg_order_value,
                total_discounts, discount_rate, discounted_orders } = data.stats;

        setVal("stat-revenue",   formatCurrency(total_revenue));
        setVal("stat-orders",    formatNumber(total_orders));
        setVal("stat-customers", formatNumber(total_customers));
        setVal("stat-avg",       formatCurrency(avg_order_value));

        // Optional discount KPI card (if element exists)
        setVal("stat-discounts",  formatCurrency(total_discounts || 0));
        setVal("stat-disc-rate",  (discount_rate || 0) + "% avg savings");

        const topbarRev = document.getElementById("topbar-revenue");
        if (topbarRev) topbarRev.textContent = formatCurrency(total_revenue);

        setText("sidebar-customer-count", total_customers);

    } catch (e) {
        console.error("Stats fetch error", e);
        showToast("Could not load dashboard stats", "error");
    }
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

// ========================
// REVENUE TREND CHART (real DB data)
// ========================
async function drawRevenueChart() {
    const canvas = document.getElementById("revenue-chart");
    if (!canvas || typeof Chart === "undefined") return;

    let labels = [], values = [];
    try {
        const res  = await fetch("/admin/api/revenue-trend");
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            // Format "2026-05" → "May'26"
            const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            labels = data.data.map(r => {
                const [y, m] = r.month.split("-");
                return monthNames[parseInt(m, 10) - 1] + "'" + y.slice(2);
            });
            values = data.data.map(r => r.revenue);
        } else {
            // No data yet — show zeroed placeholder
            labels = ["No data yet"];
            values = [0];
        }
    } catch (e) {
        labels = ["Error"]; values = [0];
    }

    new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Revenue (INR)",
                data: values,
                borderColor: "#6366f1",
                backgroundColor: "rgba(99,102,241,0.08)",
                tension: 0.4, fill: true,
                pointBackgroundColor: "#6366f1",
                pointRadius: 4, pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => " Rs " + ctx.raw.toLocaleString("en-IN") } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11 } } },
                y: {
                    beginAtZero: true,
                    grid: { color: "rgba(99,102,241,0.06)" },
                    ticks: { color: "#6b7280", font: { size: 11 },
                             callback: v => v >= 1000 ? "Rs " + (v/1000).toFixed(1) + "k" : "Rs " + v }
                }
            }
        }
    });
}

// ========================
// TOP PRODUCTS CHART (real DB data)
// ========================
async function drawTopProducts() {
    const canvas = document.getElementById("top-products-chart");
    if (!canvas || typeof Chart === "undefined") return;

    let labels = [], values = [];
    try {
        const res  = await fetch("/admin/api/top-products");
        const data = await res.json();
        if (data.success && data.products.length > 0) {
            labels = data.products.map(p => p.name);
            values = data.products.map(p => p.units);
        } else {
            labels = ["No transactions yet"]; values = [0];
        }
    } catch (e) {
        labels = ["Error"]; values = [0];
    }

    new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Units Sold",
                data: values,
                backgroundColor: [
                    "rgba(99,102,241,.8)", "rgba(139,92,246,.8)",
                    "rgba(6,182,212,.8)", "rgba(16,185,129,.8)", "rgba(245,158,11,.8)"
                ],
                borderRadius: 6, barThickness: 22
            }]
        },
        options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, grid: { color: "rgba(99,102,241,.06)" }, ticks: { color: "#6b7280", font: { size: 11 } } },
                y: { grid: { display: false }, ticks: { color: "#374151", font: { size: 11 } } }
            }
        }
    });
}

// ========================
// RECENT ACTIVITY FEED (real transactions)
// ========================
async function renderActivity() {
    const list = document.getElementById("activity-feed");
    if (!list) return;
    try {
        const res  = await fetch("/admin/api/recent-activity");
        const data = await res.json();
        if (data.success && data.activity.length > 0) {
            list.innerHTML = data.activity.map(t => `
                <div class="d-flex align-items-start gap-3 py-3 rs-activity-row">
                    <div class="icon-badge icon-badge-emerald" style="width:36px;height:36px;border-radius:10px;font-size:.78rem;flex-shrink:0;">
                        <i class="fas fa-bag-shopping"></i>
                    </div>
                    <div class="flex-grow-1" style="min-width:0;">
                        <p class="mb-0 fw-semibold rs-truncate" style="color:var(--text-primary);font-size:.85rem;">Order ${t.transaction_id}</p>
                        <p class="mb-0 rs-truncate" style="color:var(--text-secondary);font-size:.75rem;">Rs ${t.amount.toFixed(2)} &middot; ${t.items_count} item${t.items_count !== 1 ? "s" : ""}</p>
                    </div>
                    <span class="flex-shrink-0 rs-text-xs" style="color:var(--text-secondary);white-space:nowrap;font-size:.72rem;">${t.timestamp.split(" ")[0]}</span>
                </div>
            `).join("");
        } else {
            list.innerHTML = `<p class="text-center py-4" style="color:var(--text-secondary);font-size:.85rem;">No transactions yet</p>`;
        }
    } catch (e) {
        list.innerHTML = `<p class="text-center py-4" style="color:var(--text-secondary);">Could not load activity</p>`;
    }
}

// ========================
// INIT
// ========================
loadStats();
renderActivity();
window.addEventListener("load", () => {
    drawRevenueChart();
    drawTopProducts();
});
