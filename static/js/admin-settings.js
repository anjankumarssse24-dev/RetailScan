/**
 * admin-settings.js — Settings page logic.
 * Requires admin-shared.js.
 */

let activeTab = "general";

// ========================
// TAB SWITCHING
// ========================
function switchTab(tabId, btn) {
    document.querySelectorAll(".settings-tab").forEach(t => {
        t.classList.add("hidden");
        t.classList.remove("animate-fade-in-up");
    });
    document.querySelectorAll(".rs-tab-btn").forEach(b => b.classList.remove("active"));

    const tab = document.getElementById("tab-" + tabId);
    if (tab) {
        tab.classList.remove("hidden");
        void tab.offsetWidth; // force reflow for animation
        tab.classList.add("animate-fade-in-up");
    }
    if (btn) btn.classList.add("active");
    activeTab = tabId;

    if (tabId === "roles") loadRolesTab();
    if (tabId === "notifications") renderNotifications();
    if (tabId === "security") renderLoginHistory();
}

// ========================
// SAVE CURRENT TAB
// ========================
function saveCurrentTab() {
    // Simulate save for UI purposes
    showToast("Settings saved successfully", "success");
}

// ========================
// GENERAL TAB — no async needed, form fields are pre-filled
// ========================

// ========================
// SECURITY TAB
// ========================
function togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === "password";
    input.type   = isPass ? "text" : "password";
    const icon   = btn.querySelector("i");
    if (icon) icon.className = isPass ? "fas fa-eye-slash" : "fas fa-eye";
}

function handlePasswordChange() {
    const curr    = document.getElementById("curr-pass")?.value;
    const newPwd  = document.getElementById("new-pass")?.value;
    const confirm = document.getElementById("confirm-pass")?.value;

    if (!curr || !newPwd || !confirm) {
        showToast("Please fill in all password fields", "warning");
        return;
    }
    if (newPwd.length < 8) {
        showToast("New password must be at least 8 characters", "warning");
        return;
    }
    if (newPwd !== confirm) {
        showToast("Passwords do not match", "error");
        return;
    }
    // In production this would call Firebase Admin SDK / API
    showToast("Password update requires Firebase Admin SDK integration", "info");
}

const DEMO_LOGIN_HISTORY = [
    { device: "Chrome · Windows",    ip: "192.168.1.1",  time: "Just now",    ok: true },
    { device: "Chrome · Android",    ip: "122.170.41.3", time: "2 hours ago", ok: true },
    { device: "Safari · iPhone",     ip: "157.32.21.9",  time: "Yesterday",   ok: true },
    { device: "Unknown · Linux",     ip: "45.133.72.11", time: "2 days ago",  ok: false },
];

function renderLoginHistory() {
    const el = document.getElementById("login-history-list");
    if (!el) return;
    el.innerHTML = DEMO_LOGIN_HISTORY.map(h => `
        <div class="d-flex align-items-center gap-3 py-2" style="border-bottom:1px solid rgba(99,102,241,.06);">
            <div class="icon-badge ${h.ok ? 'icon-badge-emerald' : 'icon-badge-danger'}"
                style="width:32px;height:32px;border-radius:9px;font-size:.7rem;flex-shrink:0;">
                <i class="fas ${h.ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            </div>
            <div class="flex-grow-1" style="min-width:0;">
                <p class="mb-0 fw-semibold rs-truncate" style="font-size:.82rem;color:var(--text-primary);">${h.device}</p>
                <p class="mb-0" style="font-size:.75rem;color:var(--text-secondary);">${h.ip}</p>
            </div>
            <span class="rs-text-xs flex-shrink-0" style="color:var(--text-secondary);">${h.time}</span>
        </div>
    `).join("");
}

// ========================
// NOTIFICATIONS TAB
// ========================
const EMAIL_NOTIFS = [
    { id: "notif-new-order",    label: "New Order Placed",          sub: "Email when a customer completes checkout", on: true  },
    { id: "notif-new-cust",     label: "New Customer Registered",   sub: "Email when a new user signs up",           on: true  },
    { id: "notif-low-wallet",   label: "Low Wallet Balance Alert",  sub: "When customer wallet drops below ₹500",    on: false },
    { id: "notif-tier-upgrade", label: "Tier Upgrade",              sub: "When a customer moves to Gold / Platinum", on: true  },
    { id: "notif-failed-txn",   label: "Failed Transaction",        sub: "Immediate alert on payment failure",       on: true  },
    { id: "notif-weekly",       label: "Weekly Summary Report",     sub: "Digest every Monday morning",              on: false },
];

const INAPP_NOTIFS = [
    { id: "inapp-order",   label: "Order Notifications",   sub: "Show toast on new orders",                    on: true  },
    { id: "inapp-login",   label: "Admin Login Alert",     sub: "Notify on new admin session",                 on: true  },
    { id: "inapp-errors",  label: "System Error Alerts",   sub: "Critical errors and exceptions",              on: true  },
    { id: "inapp-updates", label: "Feature Updates",       sub: "New phase releases and changelog",            on: false },
];

function renderNotifGroup(items, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = items.map(n => `
        <div class="d-flex align-items-center justify-content-between gap-3">
            <div style="min-width:0;">
                <p class="mb-0 fw-semibold" style="color:var(--text-primary);font-size:.875rem;">${n.label}</p>
                <p class="mb-0" style="color:var(--text-secondary);font-size:.78rem;">${n.sub}</p>
            </div>
            <label class="rs-toggle flex-shrink-0">
                <input type="checkbox" id="${n.id}" ${n.on ? "checked" : ""}>
                <span class="rs-toggle-slider"></span>
            </label>
        </div>
    `).join("");
}

function renderNotifications() {
    renderNotifGroup(EMAIL_NOTIFS, "email-notif-list");
    renderNotifGroup(INAPP_NOTIFS, "inapp-notif-list");
}

// ========================
// ROLES TAB
// ========================
async function loadRolesTab() {
    try {
        const res  = await fetch("/admin/api/users?per_page=200");
        const data = await res.json();
        if (!data.success) return;

        const users = data.users;
        const admins = users.filter(u => u.role === "admin").length;
        const custs  = users.filter(u => u.role === "customer").length;

        setText("role-total",       users.length);
        setText("role-admin-count", admins);
        setText("role-cust-count",  custs);

        renderRolesTable(users);
    } catch (e) {
        console.error("Roles tab load error", e);
    }
}

function renderRolesTable(users) {
    const tbody = document.getElementById("roles-table-body");
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:var(--text-secondary);">No users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const initials = (u.name || "?").split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
        const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN",
            { day:"2-digit", month:"short", year:"numeric" }) : "—";

        return `
        <tr class="rs-table-row">
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rs-cust-avatar" style="width:30px;height:30px;font-size:.65rem;border-radius:8px;">${initials}</div>
                    <span class="fw-semibold" style="color:var(--text-primary);font-size:.875rem;">${u.name || "—"}</span>
                </div>
            </td>
            <td style="color:var(--text-secondary);font-size:.82rem;">${u.email}</td>
            <td>
                ${u.role === "admin"
                    ? `<span class="rs-badge rs-badge-violet"><i class="fas fa-shield-halved me-1"></i>Admin</span>`
                    : `<span class="rs-badge rs-badge-gray">Customer</span>`}
            </td>
            <td style="color:var(--text-secondary);font-size:.8rem;">${joinDate}</td>
            <td>
                <button class="rs-icon-btn ${u.role === 'admin' ? 'rs-icon-btn-danger' : 'rs-icon-btn-primary'}"
                    title="${u.role === 'admin' ? 'Demote to Customer' : 'Promote to Admin'}"
                    onclick="roleToggle('${u.firebase_uid}','${u.role}',this)">
                    <i class="fas ${u.role === 'admin' ? 'fa-user-minus' : 'fa-user-shield'}"></i>
                </button>
            </td>
        </tr>`;
    }).join("");
}

async function roleToggle(uid, currentRole, btn) {
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
            showToast(`Role updated to ${newRole}`, "success");
            loadRolesTab();
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
// INIT
// ========================
// Notifications are rendered when the tab is first opened
// General tab is shown by default and has no async data
