/**
 * admin-shared.js — Shared sidebar / topbar / auth logic for ALL admin pages.
 * Must be loaded BEFORE any page-specific admin JS.
 */

// ========================
// SIDEBAR TOGGLE
// ========================
function toggleSidebar() {
    const sidebar = document.getElementById("admin-sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const isOpen  = sidebar.classList.contains("open");
    sidebar.classList.toggle("open", !isOpen);
    overlay.classList.toggle("show", !isOpen);
    document.body.style.overflow = isOpen ? "" : "hidden";
}

document.querySelectorAll(".rs-sidebar-link").forEach(link => {
    link.addEventListener("click", () => {
        if (window.innerWidth < 992) {
            const sidebar = document.getElementById("admin-sidebar");
            const overlay = document.getElementById("sidebar-overlay");
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
            document.body.style.overflow = "";
        }
    });
});

// ========================
// TOPBAR AVATAR DROPDOWN
// ========================
function toggleAdminDropdown() {
    const dd = document.getElementById("admin-user-dropdown");
    if (dd) dd.classList.toggle("show");
}

document.addEventListener("click", (e) => {
    const dd     = document.getElementById("admin-user-dropdown");
    const avatar = document.getElementById("topbar-avatar");
    if (dd && avatar && !avatar.contains(e.target) && !dd.contains(e.target)) {
        dd.classList.remove("show");
    }
});

// ========================
// UTILITIES
// ========================
function getInitials(name) {
    if (!name) return "A";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : parts[0][0].toUpperCase();
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
}

function formatCurrency(amount) {
    return "₹" + Number(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatNumber(n) {
    return Number(n).toLocaleString("en-IN");
}

// ========================
// LOAD ADMIN USER
// ========================
async function loadAdminUser() {
    try {
        const res  = await fetch("/api/auth/user");
        const data = await res.json();
        if (!data.logged_in || data.user.role !== "admin") {
            window.location.href = "/login";
            return;
        }
        const user     = data.user;
        const initials = getInitials(user.name);

        // Topbar avatar
        const avatar = document.getElementById("topbar-avatar");
        if (avatar) {
            if (user.picture) {
                avatar.innerHTML = `<img src="${user.picture}" alt="avatar" referrerpolicy="no-referrer">`;
            } else {
                setText("topbar-avatar-initials", initials);
            }
        }

        // Sidebar identity pill
        const sideAvatar = document.getElementById("sidebar-avatar");
        if (sideAvatar) {
            if (user.picture) {
                sideAvatar.innerHTML = `<img src="${user.picture}" alt="avatar" referrerpolicy="no-referrer"
                    style="width:100%;height:100%;border-radius:8px;object-fit:cover;">`;
            } else {
                sideAvatar.textContent = initials;
            }
        }

        setText("sidebar-admin-name",    user.name  || "Admin");
        setText("topbar-dropdown-name",  user.name  || "Admin");
        setText("topbar-dropdown-email", user.email || "");
    } catch (e) {
        console.error("Failed to load admin user info", e);
    }
}

// ========================
// LOGOUT
// ========================
function handleAdminLogout() {
    fetch("/api/auth/logout", { method: "POST" })
        .then(() => { window.location.href = "/login"; })
        .catch(() => { window.location.href = "/login"; });
}

// ========================
// ACTIVE NAV HIGHLIGHT + TOPBAR TITLE
// ========================
(function highlightActiveNav() {
    const path = window.location.pathname;
    const navMap = {
        "/admin/dashboard":    "nav-dashboard",
        "/admin/customers":    "nav-customers",
        "/admin/analytics":    "nav-analytics",
        "/admin/transactions": "nav-transactions",
        "/admin/settings":     "nav-settings",
    };
    document.querySelectorAll(".rs-sidebar-link").forEach(l => l.classList.remove("active"));
    const targetId = navMap[path];
    if (targetId) {
        const el = document.getElementById(targetId);
        if (el) el.classList.add("active");
    }
    const titles = {
        "/admin/dashboard":    "Dashboard",
        "/admin/customers":    "Customers",
        "/admin/analytics":    "Analytics",
        "/admin/transactions": "Transactions",
        "/admin/settings":     "Settings",
    };
    setText("topbar-page-title", titles[path] || "Admin");
})();

// ========================
// AUTO-INIT (runs on every admin page)
// ========================
loadAdminUser();
