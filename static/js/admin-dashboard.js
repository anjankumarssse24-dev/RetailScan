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
// REVENUE TREND CHART
// ========================
function drawRevenueChart() {
    const canvas = document.getElementById("revenue-chart");
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
        type: "line",
        data: {
            labels: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
            datasets: [{
                label: "Revenue (INR)",
                data: [42800, 38500, 51200, 47600, 63100, 71400],
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
                    grid: { color: "rgba(99,102,241,0.06)" },
                    ticks: { color: "#6b7280", font: { size: 11 }, callback: v => "Rs " + (v/1000) + "k" }
                }
            }
        }
    });
}

// ========================
// TOP PRODUCTS CHART
// ========================
function drawTopProducts() {
    const canvas = document.getElementById("top-products-chart");
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
        type: "bar",
        data: {
            labels: ["Milk 1L", "Fresh Bread", "Rice 5kg", "Eggs x12", "Chips 100g"],
            datasets: [{
                label: "Units Sold",
                data: [284, 231, 198, 176, 154],
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
                x: { grid: { color: "rgba(99,102,241,.06)" }, ticks: { color: "#6b7280", font: { size: 11 } } },
                y: { grid: { display: false }, ticks: { color: "#374151", font: { size: 11 } } }
            }
        }
    });
}

// ========================
// RECENT ACTIVITY FEED
// ========================
const ACTIVITY = [
    { icon: "fa-bag-shopping",  color: "emerald", text: "Order #TXN-1091 placed",     time: "2 min ago",  sub: "Rs 1,249 · 5 items" },
    { icon: "fa-user-plus",     color: "primary",  text: "New customer registered",   time: "8 min ago",  sub: "priya.sharma@gmail.com" },
    { icon: "fa-star",          color: "amber",    text: "Gold tier upgrade",          time: "14 min ago", sub: "Rahul Verma -- Gold" },
    { icon: "fa-circle-check",  color: "cyan",     text: "Order #TXN-1090 paid",       time: "23 min ago", sub: "Rs 849 · UPI" },
    { icon: "fa-shield-halved", color: "violet",   text: "Admin login detected",       time: "1 hr ago",   sub: "admin@gmail.com" },
];

function renderActivity() {
    const list = document.getElementById("activity-feed");
    if (!list) return;
    list.innerHTML = ACTIVITY.map(a => `
        <div class="d-flex align-items-start gap-3 py-3 rs-activity-row">
            <div class="icon-badge icon-badge-${a.color}" style="width:36px;height:36px;border-radius:10px;font-size:.78rem;flex-shrink:0;">
                <i class="fas ${a.icon}"></i>
            </div>
            <div class="flex-grow-1" style="min-width:0;">
                <p class="mb-0 fw-semibold rs-truncate" style="color:var(--text-primary);font-size:.85rem;">${a.text}</p>
                <p class="mb-0 rs-truncate" style="color:var(--text-secondary);font-size:.75rem;">${a.sub}</p>
            </div>
            <span class="flex-shrink-0 rs-text-xs" style="color:var(--text-secondary);white-space:nowrap;">${a.time}</span>
        </div>
    `).join("");
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
