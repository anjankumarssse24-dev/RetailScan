/**
 * admin-customers.js — Customers page logic.
 * Requires admin-shared.js.
 */

let allCustomers  = [];
let filteredData  = [];
let currentPage   = 1;
const PER_PAGE    = 10;

// ========================
// LOAD FROM API
// ========================
async function loadCustomers(page = 1) {
    currentPage = page;
    try {
        const res  = await fetch(`/admin/api/users?page=${page}&per_page=100`);
        const data = await res.json();
        if (!data.success) { showToast("Failed to load customers", "error"); return; }

        allCustomers = data.users;
        filteredData = [...allCustomers];

        // KPI cards
        const customers = allCustomers.filter(u => u.role === "customer");
        const premium   = allCustomers.filter(u => ["gold", "platinum"].includes(u.membership_tier));
        const newMonth  = allCustomers.filter(u => {
            const d = new Date(u.created_at);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        document.getElementById("kpi-total").textContent    = customers.length;
        document.getElementById("kpi-new").textContent      = "+" + newMonth.length;
        document.getElementById("kpi-premium").textContent  = premium.length;
        setText("sidebar-customer-count", customers.length);

        renderTable();
        renderRecentRegistrations();
        renderTierBars();
        renderTopLoyaltyUsers();

    } catch (e) {
        console.error("Customers load error", e);
        showToast("Could not load customer data", "error");
    }
}

// ========================
// FILTER
// ========================
function filterCustomers() {
    const search = (document.getElementById("cust-search")?.value || "").toLowerCase();
    const tier   = document.getElementById("filter-tier")?.value || "";
    const role   = document.getElementById("filter-role")?.value || "";

    filteredData = allCustomers.filter(u => {
        const matchSearch = !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
        const matchTier   = !tier   || u.membership_tier === tier;
        const matchRole   = !role   || u.role === role;
        return matchSearch && matchTier && matchRole;
    });

    currentPage = 1;
    renderTable();
}

// ========================
// RENDER TABLE
// ========================
const TIER_COLORS = { bronze: "#cd7f32", silver: "#9ca3af", gold: "#f59e0b", platinum: "#6366f1" };
const TIER_ICONS  = { bronze: "fa-award", silver: "fa-medal", gold: "fa-crown", platinum: "fa-gem" };

function tierBadge(tier) {
    const color = TIER_COLORS[tier] || "#9ca3af";
    const icon  = TIER_ICONS[tier]  || "fa-award";
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${color}22;color:${color};
        border:1px solid ${color}44;border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:600;">
        <i class="fas ${icon}" style="font-size:.65rem;"></i>${tier.charAt(0).toUpperCase()+tier.slice(1)}</span>`;
}

function roleBadge(role) {
    return role === "admin"
        ? `<span class="rs-badge rs-badge-violet"><i class="fas fa-shield-halved me-1"></i>Admin</span>`
        : `<span class="rs-badge rs-badge-gray">Customer</span>`;
}

function formatDate(str) {
    if (!str) return "—";
    return new Date(str).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function renderTable() {
    const tbody = document.getElementById("cust-table-body");
    if (!tbody) return;

    const start = (currentPage - 1) * PER_PAGE;
    const page  = filteredData.slice(start, start + PER_PAGE);
    const total = filteredData.length;
    const pages = Math.ceil(total / PER_PAGE);

    document.getElementById("cust-count-label").textContent =
        `${total} result${total !== 1 ? "s" : ""}`;
    document.getElementById("cust-page-label").textContent = `${currentPage} / ${pages || 1}`;
    document.getElementById("cust-pagination-info").textContent =
        `Showing ${start + 1}–${Math.min(start + PER_PAGE, total)} of ${total}`;

    const prevBtn = document.getElementById("cust-prev");
    const nextBtn = document.getElementById("cust-next");
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= pages;

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5" style="color:var(--text-secondary);">
            <i class="fas fa-users-slash fa-2x mb-2 d-block opacity-50"></i>No customers found.</td></tr>`;
        return;
    }

    tbody.innerHTML = page.map(u => {
        const initials = (u.name || "?").split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
        const currentUserUid = "";  // set by loadAdminUser if needed
        return `
        <tr class="rs-table-row">
            <td>
                <div class="d-flex align-items-center gap-3">
                    <div class="rs-cust-avatar">${initials}</div>
                    <div>
                        <p class="mb-0 fw-semibold" style="color:var(--text-primary);font-size:.875rem;">${u.name || "—"}</p>
                        <p class="mb-0" style="color:var(--text-secondary);font-size:.75rem;">${u.email}</p>
                    </div>
                </div>
            </td>
            <td>${tierBadge(u.membership_tier)}</td>
            <td><span class="fw-semibold" style="color:var(--primary);">${u.reward_points.toLocaleString()}</span></td>
            <td>${u.total_orders}</td>
            <td>${formatCurrency(u.total_spent)}</td>
            <td style="color:var(--text-secondary);font-size:.8rem;">${formatDate(u.created_at)}</td>
            <td>${roleBadge(u.role)}</td>
            <td>
                <button class="rs-icon-btn ${u.role === 'admin' ? 'rs-icon-btn-danger' : 'rs-icon-btn-primary'}"
                    title="${u.role === 'admin' ? 'Demote to Customer' : 'Promote to Admin'}"
                    onclick="toggleRole('${u.firebase_uid}', '${u.role}', this)">
                    <i class="fas ${u.role === 'admin' ? 'fa-user-minus' : 'fa-user-shield'}"></i>
                </button>
            </td>
        </tr>`;
    }).join("");
}

function changePage(delta) {
    const pages = Math.ceil(filteredData.length / PER_PAGE);
    const next  = currentPage + delta;
    if (next >= 1 && next <= pages) { currentPage = next; renderTable(); }
}

// ========================
// ROLE TOGGLE
// ========================
async function toggleRole(uid, currentRole, btn) {
    const newRole = currentRole === "admin" ? "customer" : "admin";
    btn.disabled  = true;
    try {
        const res  = await fetch(`/admin/api/users/${uid}/role`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: newRole })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`User ${newRole === "admin" ? "promoted to Admin" : "set to Customer"}`, "success");
            loadCustomers(currentPage);
        } else {
            showToast(data.error || "Failed to update role", "error");
            btn.disabled = false;
        }
    } catch (e) {
        showToast("Request failed", "error");
        btn.disabled = false;
    }
}

// ========================
// RECENT REGISTRATIONS
// ========================
function renderRecentRegistrations() {
    const list = document.getElementById("recent-reg-list");
    if (!list) return;

    const recent = [...allCustomers]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

    if (recent.length === 0) {
        list.innerHTML = `<p class="py-4 text-center" style="color:var(--text-secondary);">No registrations yet.</p>`;
        return;
    }

    list.innerHTML = recent.map(u => {
        const initials = (u.name || "?").split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
        const daysAgo  = Math.floor((Date.now() - new Date(u.created_at)) / 86400000);
        const timeStr  = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
        return `
        <div class="d-flex align-items-center gap-3 py-3 rs-activity-row">
            <div class="rs-cust-avatar" style="flex-shrink:0;">${initials}</div>
            <div class="flex-grow-1" style="min-width:0;">
                <p class="mb-0 fw-semibold rs-truncate" style="color:var(--text-primary);font-size:.85rem;">${u.name || "—"}</p>
                <p class="mb-0 rs-truncate" style="color:var(--text-secondary);font-size:.75rem;">${u.email}</p>
            </div>
            <span class="flex-shrink-0 rs-text-xs" style="color:var(--text-secondary);white-space:nowrap;">${timeStr}</span>
        </div>`;
    }).join("");
}

// ========================
// TIER DISTRIBUTION BARS
// ========================
function renderTierBars() {
    const container = document.getElementById("tier-bars");
    if (!container) return;

    const tierOrder = ["platinum", "gold", "silver", "bronze"];
    const counts    = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    allCustomers.forEach(u => { if (counts[u.membership_tier] !== undefined) counts[u.membership_tier]++; });
    const total = allCustomers.length || 1;

    container.innerHTML = tierOrder.map(tier => {
        const count   = counts[tier];
        const pct     = Math.round((count / total) * 100);
        const color   = TIER_COLORS[tier];
        const icon    = TIER_ICONS[tier];
        return `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="d-flex align-items-center gap-2" style="font-size:.85rem;color:var(--text-secondary);">
                    <i class="fas ${icon}" style="color:${color};font-size:.8rem;"></i>
                    ${tier.charAt(0).toUpperCase() + tier.slice(1)}
                </span>
                <span class="fw-semibold" style="font-size:.85rem;color:var(--text-primary);">${count} <span style="color:var(--text-secondary);font-weight:400;">(${pct}%)</span></span>
            </div>
            <div class="rs-progress-track">
                <div class="rs-progress-fill" style="width:${pct}%;background:${color};"></div>
            </div>
        </div>`;
    }).join("");
}

// ========================
// TOP LOYALTY USERS
// ========================
function renderTopLoyaltyUsers() {
    const tbody = document.getElementById("loyalty-top-tbody");
    if (!tbody) return;

    const top = [...allCustomers]
        .filter(u => u.role === "customer")
        .sort((a, b) => (b.reward_points || 0) - (a.reward_points || 0))
        .slice(0, 5);

    if (top.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3" style="color:var(--text-secondary);">No loyalty data yet.</td></tr>`;
        return;
    }

    const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th"];
    tbody.innerHTML = top.map((u, i) => {
        const tier    = (u.membership_tier || "bronze").toLowerCase();
        const color   = TIER_COLORS[tier] || "#6366f1";
        const icon    = TIER_ICONS[tier]  || "fa-award";
        const initials = (u.name || "?").split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
        return `
        <tr>
            <td><span class="fw-bold" style="font-size:1rem;">${MEDALS[i]}</span></td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rs-cust-avatar" style="width:30px;height:30px;font-size:.7rem;flex-shrink:0;">${initials}</div>
                    <div style="min-width:0;">
                        <p class="mb-0 fw-semibold rs-truncate" style="font-size:.85rem;color:var(--text-primary);">${u.name || "—"}</p>
                        <p class="mb-0 rs-truncate" style="font-size:.73rem;color:var(--text-secondary);">${u.email}</p>
                    </div>
                </div>
            </td>
            <td>
                <span style="display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:20px;
                    font-size:.72rem;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}44;">
                    <i class="fas ${icon}" style="font-size:.6rem;"></i>${tier.charAt(0).toUpperCase()+tier.slice(1)}
                </span>
            </td>
            <td class="fw-bold" style="color:${color};">⭐ ${(u.reward_points || 0).toLocaleString()}</td>
            <td style="color:var(--text-primary);">₹${(u.total_spent || 0).toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            <td style="color:var(--text-secondary);">${u.total_orders || 0}</td>
        </tr>`;
    }).join("");
}

// ========================
// INIT
// ========================
loadCustomers(1);
