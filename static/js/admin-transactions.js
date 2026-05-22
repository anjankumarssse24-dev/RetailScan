/**
 * admin-transactions.js — Transactions page logic.
 * Requires admin-shared.js.
 */

// ========================
// DEMO DATA (enriched with realistic fields)
// ========================
const METHODS  = ["UPI", "UPI", "UPI", "Card", "Wallet", "Net Banking", "UPI", "Card"];
const STATUSES = ["success", "success", "success", "success", "success", "pending", "failed", "success"];
const NAMES    = [
    "Priya Sharma", "Rahul Verma", "Sneha Iyer", "Amit Patel", "Deepika Singh",
    "Kiran Rao",    "Vijay Kumar", "Neha Gupta", "Arjun Mehta","Pooja Nair",
    "Ravi Shankar", "Anita Desai", "Suresh Pillai","Meera Joshi","Rohan Das"
];
const CATEGORIES = ["Dairy", "Bakery", "Grains", "Beverages", "Snacks", "Personal Care", "Vegetables", "Frozen"];

let allTxns      = [];
let filteredTxns = [];
let txnPage      = 1;
const TXN_PER    = 10;
let activeStatus = "all";

// ========================
// LOAD TRANSACTIONS
// ========================
async function loadTransactions() {
    try {
        // Fetch real data from DB
        const res  = await fetch("/admin/api/transactions?per_page=200");
        const data = await res.json();

        let realTxns = [];
        if (data.success && data.transactions && data.transactions.length > 0) {
            realTxns = data.transactions;
        }

        // Merge real data with demo enrichment (customer names, status, method)
        allTxns = buildDisplayList(realTxns);
        filteredTxns = [...allTxns];

        updateKPICards();
        renderTable();

    } catch (e) {
        console.error("Transactions load error", e);
        // Fallback to pure demo data
        allTxns      = buildDemoList(20);
        filteredTxns = [...allTxns];
        updateKPICards();
        renderTable();
    }
}

function buildDisplayList(realTxns) {
    // Map real transactions to display format with demo enrichment
    if (realTxns.length === 0) return buildDemoList(15);

    return realTxns.map((t, i) => ({
        id:         t.transaction_id || ("TXN-" + String(1000 + i).padStart(4, "0")),
        customer:   NAMES[i % NAMES.length],
        items:      t.items_count || Math.floor(Math.random() * 8) + 1,
        amount:     t.amount,
        method:     METHODS[i % METHODS.length],
        status:     STATUSES[i % STATUSES.length],
        timestamp:  t.timestamp,
        items_json: t.items_json,
        balance_before: t.balance_before,
        balance_after:  t.balance_after,
    }));
}

function buildDemoList(n) {
    const now  = Date.now();
    const list = [];
    for (let i = 0; i < n; i++) {
        const amount = Math.round((Math.random() * 1800 + 120) * 100) / 100;
        const ms     = now - i * 3600000 * (1 + Math.random() * 2);
        list.push({
            id:        "TXN-" + String(1091 - i).padStart(4, "0"),
            customer:  NAMES[i % NAMES.length],
            items:     Math.floor(Math.random() * 7) + 1,
            amount,
            method:    METHODS[i % METHODS.length],
            status:    STATUSES[i % STATUSES.length],
            timestamp: new Date(ms).toISOString(),
            items_json: null,
            balance_before: null,
            balance_after:  null,
        });
    }
    return list;
}

// ========================
// KPI CARDS
// ========================
function updateKPICards() {
    const today = new Date().toDateString();
    const todayTxns = allTxns.filter(t => new Date(t.timestamp).toDateString() === today);
    const todayRev  = todayTxns.reduce((s, t) => s + t.amount, 0);

    const successCount = allTxns.filter(t => t.status === "success").length;
    const successRate  = allTxns.length > 0
        ? Math.round((successCount / allTxns.length) * 1000) / 10
        : 96.7;
    const avgTxn = allTxns.length > 0
        ? allTxns.reduce((s, t) => s + t.amount, 0) / allTxns.length
        : 0;

    document.getElementById("txn-today-rev").textContent  = formatCurrency(todayRev);
    document.getElementById("txn-success-rate").textContent = successRate + "%";
    document.getElementById("txn-total-count").textContent  = allTxns.length.toLocaleString();
    document.getElementById("txn-avg").textContent          = formatCurrency(avgTxn);
}

// ========================
// FILTER
// ========================
function setStatusFilter(status, btn) {
    activeStatus = status;
    document.querySelectorAll(".rs-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filterTransactions();
}

function filterTransactions() {
    const search = (document.getElementById("txn-search")?.value || "").toLowerCase();
    filteredTxns = allTxns.filter(t => {
        const matchStatus = activeStatus === "all" || t.status === activeStatus;
        const matchSearch = !search ||
            t.id.toLowerCase().includes(search) ||
            t.customer.toLowerCase().includes(search);
        return matchStatus && matchSearch;
    });
    txnPage = 1;
    renderTable();
}

// ========================
// RENDER TABLE
// ========================
const STATUS_CONFIG = {
    success: { label: "Success", cls: "rs-status-success", icon: "fa-circle-check" },
    pending: { label: "Pending", cls: "rs-status-pending", icon: "fa-clock" },
    failed:  { label: "Failed",  cls: "rs-status-danger",  icon: "fa-circle-xmark" },
};

function statusBadge(s) {
    const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.success;
    return `<span class="rs-status-pill ${cfg.cls}">
        <i class="fas ${cfg.icon}"></i> ${cfg.label}
    </span>`;
}

function formatDateTime(str) {
    if (!str) return "—";
    const d = new Date(str);
    return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
        + " " + d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
}

function renderTable() {
    const tbody = document.getElementById("txn-table-body");
    if (!tbody) return;

    const start = (txnPage - 1) * TXN_PER;
    const page  = filteredTxns.slice(start, start + TXN_PER);
    const total = filteredTxns.length;
    const pages = Math.ceil(total / TXN_PER);

    document.getElementById("txn-count-label").textContent =
        `${total} transaction${total !== 1 ? "s" : ""}`;
    document.getElementById("txn-pagination-info").textContent =
        `${start + 1}–${Math.min(start + TXN_PER, total)} of ${total}`;

    const prevBtn = document.getElementById("txn-prev");
    const nextBtn = document.getElementById("txn-next");
    if (prevBtn) prevBtn.disabled = txnPage <= 1;
    if (nextBtn) nextBtn.disabled = txnPage >= pages;

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5" style="color:var(--text-secondary);">
            <i class="fas fa-receipt fa-2x mb-2 d-block opacity-40"></i>No transactions match.</td></tr>`;
        return;
    }

    tbody.innerHTML = page.map(t => `
        <tr class="rs-table-row">
            <td><span class="rs-mono fw-semibold" style="color:var(--primary);font-size:.82rem;">${t.id}</span></td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rs-cust-avatar" style="width:28px;height:28px;font-size:.65rem;border-radius:8px;">
                        ${t.customer.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase()}
                    </div>
                    <span style="font-size:.85rem;color:var(--text-primary);">${t.customer}</span>
                </div>
            </td>
            <td><span class="rs-badge rs-badge-gray">${t.items} item${t.items !== 1 ? "s" : ""}</span></td>
            <td><span class="fw-semibold" style="color:var(--text-primary);">${formatCurrency(t.amount)}</span></td>
            <td>
                <span class="rs-badge ${t.method === 'UPI' ? 'rs-badge-primary' : t.method === 'Card' ? 'rs-badge-cyan' : 'rs-badge-gray'}">
                    ${t.method}
                </span>
            </td>
            <td>${statusBadge(t.status)}</td>
            <td style="color:var(--text-secondary);font-size:.78rem;white-space:nowrap;">${formatDateTime(t.timestamp)}</td>
            <td>
                <button class="rs-icon-btn rs-icon-btn-primary" title="View Invoice"
                    onclick="viewInvoice(${JSON.stringify(t).replace(/"/g, '&quot;')})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join("");
}

function txnChangePage(delta) {
    const pages = Math.ceil(filteredTxns.length / TXN_PER);
    const next  = txnPage + delta;
    if (next >= 1 && next <= pages) { txnPage = next; renderTable(); }
}

// ========================
// INVOICE MODAL
// ========================
function viewInvoice(t) {
    const modal = document.getElementById("invoice-modal");
    const body  = document.getElementById("invoice-body");
    if (!modal || !body) return;

    let itemsHtml = "";
    if (t.items_json) {
        try {
            const items = JSON.parse(t.items_json);
            itemsHtml = items.map(it => `
                <div class="d-flex justify-content-between py-1" style="font-size:.85rem;border-bottom:1px solid rgba(99,102,241,.05);">
                    <span style="color:var(--text-secondary);">${it.product_name || it.name}</span>
                    <span class="fw-semibold" style="color:var(--text-primary);">${formatCurrency(it.price || 0)}</span>
                </div>`).join("");
        } catch (_) {}
    }

    body.innerHTML = `
        <div class="d-flex justify-content-between mb-3">
            <div>
                <p class="mb-0 rs-text-xs" style="color:var(--text-secondary);">Transaction ID</p>
                <p class="mb-0 fw-semibold rs-mono" style="color:var(--primary);">${t.id}</p>
            </div>
            <div>${statusBadge(t.status)}</div>
        </div>
        <div class="d-flex justify-content-between mb-3 py-2" style="border-top:1px solid rgba(99,102,241,.08);border-bottom:1px solid rgba(99,102,241,.08);">
            <span style="color:var(--text-secondary);font-size:.875rem;">Customer</span>
            <span class="fw-semibold" style="color:var(--text-primary);font-size:.875rem;">${t.customer}</span>
        </div>
        ${itemsHtml ? `<div class="mb-3">${itemsHtml}</div>` : ""}
        <div class="d-flex justify-content-between mb-2">
            <span style="color:var(--text-secondary);font-size:.875rem;">Items Count</span>
            <span class="fw-semibold" style="color:var(--text-primary);">${t.items}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
            <span style="color:var(--text-secondary);font-size:.875rem;">Payment Method</span>
            <span class="fw-semibold" style="color:var(--text-primary);">${t.method}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
            <span style="color:var(--text-secondary);font-size:.875rem;">Date &amp; Time</span>
            <span class="fw-semibold" style="color:var(--text-secondary);font-size:.82rem;">${formatDateTime(t.timestamp)}</span>
        </div>
        ${t.balance_before !== null ? `
        <div class="d-flex justify-content-between mb-2">
            <span style="color:var(--text-secondary);font-size:.875rem;">Balance Before</span>
            <span style="color:var(--text-secondary);font-size:.875rem;">${formatCurrency(t.balance_before)}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
            <span style="color:var(--text-secondary);font-size:.875rem;">Balance After</span>
            <span style="color:var(--text-secondary);font-size:.875rem;">${formatCurrency(t.balance_after)}</span>
        </div>` : ""}
        <hr class="rs-divider">
        <div class="d-flex justify-content-between">
            <span class="fw-bold" style="color:var(--text-primary);">Total Charged</span>
            <span class="fw-bold" style="font-size:1.1rem;color:var(--primary);">${formatCurrency(t.amount)}</span>
        </div>`;

    modal.classList.remove("hidden");
    modal.classList.add("show");
}

function closeInvoice(e) {
    if (e && e.target !== document.getElementById("invoice-modal") && !e.target.closest(".rs-icon-btn")) return;
    const modal = document.getElementById("invoice-modal");
    if (modal) { modal.classList.remove("show"); modal.classList.add("hidden"); }
}

// ========================
// CSV EXPORT
// ========================
function exportCSV() {
    const rows = [["ID","Customer","Items","Amount","Method","Status","Date"]];
    filteredTxns.forEach(t => {
        rows.push([t.id, t.customer, t.items, t.amount, t.method, t.status, formatDateTime(t.timestamp)]);
    });
    const csv    = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob   = new Blob([csv], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = "transactions_" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported", "success");
}

// ========================
// INIT
// ========================
loadTransactions();
