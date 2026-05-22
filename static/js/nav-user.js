/**
 * nav-user.js — Shared user avatar + dropdown logic for all pages
 * Handles both desktop sidebar and mobile collapsed nav
 */

/* ── Desktop dropdown toggle ── */
function toggleUserDropdown() {
    const dd = document.getElementById("user-dropdown");
    if (dd) dd.classList.toggle("show");
}

document.addEventListener("click", (e) => {
    const dd     = document.getElementById("user-dropdown");
    const avatar = document.getElementById("user-avatar");
    if (dd && avatar && !avatar.contains(e.target) && !dd.contains(e.target)) {
        dd.classList.remove("show");
    }
});

/* ── Helper ── */
function getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : parts[0][0].toUpperCase();
}

/* ── Set text safely ── */
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ── Set inner HTML safely ── */
function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

/* ── Load + populate all user fields ── */
function loadUserInfo() {
    fetch("/api/auth/user")
        .then(r => r.json())
        .then(data => {
            if (!data.logged_in) {
                window.location.href = "/login";
                return;
            }

            const user     = data.user;
            const initials = getInitials(user.name);

            /* Desktop avatar */
            const desktopAvatar = document.getElementById("user-avatar");
            if (desktopAvatar) {
                const span = document.getElementById("avatar-initials");
                if (user.picture) {
                    desktopAvatar.innerHTML = `<img src="${user.picture}" alt="avatar" referrerpolicy="no-referrer">`;
                } else if (span) {
                    span.textContent = initials;
                }
            }

            /* Mobile avatar (inside collapse) */
            const mobAvatar = document.getElementById("user-avatar-mob");
            if (mobAvatar) {
                if (user.picture) {
                    mobAvatar.innerHTML = `<img src="${user.picture}" alt="avatar" referrerpolicy="no-referrer">`;
                } else {
                    setText("avatar-initials-mob", initials);
                }
            }

            /* Desktop dropdown info */
            setText("dropdown-name",  user.name  || "User");
            setText("dropdown-email", user.email || "");

            /* Membership tier badge */
            const tierColors = {
                bronze:   { bg: "#cd7f32", label: "Bronze"   },
                silver:   { bg: "#9ca3af", label: "Silver"   },
                gold:     { bg: "#f59e0b", label: "Gold"     },
                platinum: { bg: "#6366f1", label: "Platinum" },
            };
            const tier      = (user.membership_tier || "bronze").toLowerCase();
            const tierData  = tierColors[tier] || tierColors["bronze"];
            const tierHTML  = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:.7rem;font-weight:600;background:${tierData.bg};color:#fff;letter-spacing:.03em;"><i class="fas fa-crown" style="font-size:.6rem;"></i>${tierData.label}</span>`;
            const pointsHTML = `<span style="color:var(--text-secondary);font-size:.75rem;"><i class="fas fa-star" style="color:#f59e0b;font-size:.65rem;margin-right:3px;"></i>${(user.reward_points || 0).toLocaleString()} pts</span>`;

            setHTML("dropdown-tier-badge",   tierHTML);
            setHTML("dropdown-reward-points", pointsHTML);

            /* Mobile user info */
            setText("dropdown-name-mob",  user.name  || "User");
            setText("dropdown-email-mob", user.email || "");
            setHTML("dropdown-tier-badge-mob",    tierHTML);
            setHTML("dropdown-reward-points-mob", pointsHTML);

            // Store globally so other scripts (e.g. payment) can use it
            window._currentUserEmail = user.email || "";
            window._currentUserName  = user.name  || "";
        })
        .catch(() => {});
}

/* ── Logout ── */
function handleLogout() {
    fetch("/api/auth/logout", { method: "POST" })
        .then(() => { window.location.href = "/login"; })
        .catch(() => { window.location.href = "/login"; });
}

loadUserInfo();
