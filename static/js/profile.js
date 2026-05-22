/**
 * profile.js — Loyalty profile page logic.
 */

const TIER_CONFIG = {
    bronze:   { color: "#cd7f32", bg: "linear-gradient(135deg,#cd7f32,#a0522d)", icon: "fa-award",  label: "Bronze",   threshold: 0,      next: 5000,  discount: 0  },
    silver:   { color: "#9ca3af", bg: "linear-gradient(135deg,#9ca3af,#6b7280)", icon: "fa-medal",  label: "Silver",   threshold: 5000,   next: 15000, discount: 5  },
    gold:     { color: "#f59e0b", bg: "linear-gradient(135deg,#f59e0b,#d97706)", icon: "fa-crown",  label: "Gold",     threshold: 15000,  next: 50000, discount: 10 },
    platinum: { color: "#6366f1", bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", icon: "fa-gem",    label: "Platinum", threshold: 50000,  next: null,  discount: 0  },
};

function fmtCurrency(n) {
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPoints(n) {
    return Number(n).toLocaleString("en-IN");
}

// ========================
// LOAD PROFILE
// ========================
async function loadProfile() {
    try {
        const [userRes, loyaltyRes] = await Promise.all([
            fetch("/api/auth/user"),
            fetch("/api/loyalty"),
        ]);
        const userData    = await userRes.json();
        const loyaltyData = await loyaltyRes.json();

        if (!userData.logged_in) { window.location.href = "/login"; return; }

        const user    = userData.user;
        const loyalty = loyaltyData.success ? loyaltyData : null;

        populateProfile(user, loyalty);

        document.getElementById("profile-loading").classList.add("hidden");
        document.getElementById("profile-content").classList.remove("hidden");

    } catch (e) {
        console.error("Profile load error", e);
        showToast("Could not load profile", "error");
    }
}

// ========================
// POPULATE
// ========================
function populateProfile(user, loyalty) {
    const tier    = (user.membership_tier || "bronze").toLowerCase();
    const cfg     = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
    const initials = (user.name || "U").split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();

    // ── Avatar ──
    const avatarWrap = document.getElementById("profile-avatar-wrap");
    if (user.picture) {
        avatarWrap.innerHTML = `<img src="${user.picture}" alt="avatar" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
        document.getElementById("profile-avatar-initials").textContent = initials;
    }

    // ── Identity ──
    document.getElementById("profile-name").textContent  = user.name  || "—";
    document.getElementById("profile-email").textContent = user.email || "—";
    document.getElementById("profile-tier-badge").innerHTML =
        `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 12px;border-radius:20px;
            font-size:.75rem;font-weight:700;background:${cfg.color}22;color:${cfg.color};
            border:1px solid ${cfg.color}44;">
            <i class="fas ${cfg.icon}" style="font-size:.65rem;"></i>${cfg.label} Member
        </span>`;

    // Member since
    if (user.created_at || loyalty?.total_orders !== undefined) {
        document.getElementById("profile-since").textContent = "Member since account creation";
    }

    // ── Loyalty Card ──
    const points      = user.reward_points || 0;
    const totalSpent  = user.total_spent   || 0;
    const progressPct = loyalty?.progress_pct ?? 0;
    const nextTarget  = loyalty?.next_tier_target;
    const nextTier    = loyalty?.next_tier;
    const ptNext      = loyalty?.points_to_next ?? 0;

    // Card background gradient
    const cardBg = document.getElementById("loyalty-card-bg");
    if (cardBg) cardBg.style.background = cfg.bg;

    const card = document.getElementById("loyalty-card");
    if (card) {
        card.style.setProperty("--tier-color", cfg.color);
        card.style.color = "#fff";
    }

    document.getElementById("loyalty-tier-name").textContent  = cfg.label + " Member";
    document.getElementById("loyalty-points").textContent      = fmtPoints(points);
    document.getElementById("loyalty-spent").textContent       = fmtCurrency(totalSpent);

    const iconEl = document.getElementById("loyalty-tier-icon");
    if (iconEl) { iconEl.className = `fas ${cfg.icon}`; }

    // Progress bar
    if (nextTarget) {
        const nextCfg = TIER_CONFIG[nextTier] || {};
        document.getElementById("tier-progress-label").textContent =
            `${cfg.label} → ${nextCfg.label || nextTier}`;
        document.getElementById("tier-progress-pct").textContent = progressPct + "%";
        document.getElementById("loyalty-progress-bar").style.width = progressPct + "%";
        document.getElementById("tier-progress-sub").textContent =
            `₹${Number(ptNext).toLocaleString("en-IN")} more to reach ${nextCfg.label || nextTier}`;
    } else {
        // Platinum — top tier
        document.getElementById("tier-progress-label").textContent = "Maximum Tier Reached";
        document.getElementById("tier-progress-pct").textContent   = "100%";
        document.getElementById("loyalty-progress-bar").style.width = "100%";
        document.getElementById("tier-progress-sub").textContent   = "You are a Platinum VIP member!";
    }

    // ── Stats cards ──
    document.getElementById("stat-orders").textContent      = (user.total_orders || 0).toLocaleString();
    document.getElementById("stat-savings").textContent     = fmtCurrency(loyalty?.estimated_savings || 0);
    document.getElementById("stat-points-total").textContent = fmtPoints(points);
    document.getElementById("stat-benefit").textContent =
        loyalty?.tier_benefit || (cfg.discount > 0 ? `${cfg.discount}% off` : "Earn points");

    // ── Tier levels ──
    renderTierLevels(tier, totalSpent);

    // ── Recent rewards ──
    renderRecentRewards(loyalty?.recent_history || []);
}

// ========================
// TIER LEVELS LIST
// ========================
function renderTierLevels(currentTier, totalSpent) {
    const container = document.getElementById("tier-levels-list");
    if (!container) return;

    const tiers = ["bronze", "silver", "gold", "platinum"];
    container.innerHTML = tiers.map(t => {
        const cfg      = TIER_CONFIG[t];
        const isActive = t === currentTier;
        const isDone   = tiers.indexOf(t) < tiers.indexOf(currentTier);
        const pct      = cfg.threshold === 0 ? 100 : Math.min(100, Math.round((totalSpent / cfg.threshold) * 100));

        return `
        <div class="d-flex align-items-center gap-3 py-2 ${isDone ? "opacity-60" : ""}"
            style="border-bottom:1px solid rgba(99,102,241,.06);">
            <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;
                justify-content:center;font-size:.8rem;flex-shrink:0;
                background:${cfg.color}22;color:${cfg.color};
                ${isActive ? `box-shadow:0 0 0 2px ${cfg.color};` : ''}">
                <i class="fas ${isDone ? 'fa-circle-check' : cfg.icon}"></i>
            </div>
            <div class="flex-grow-1" style="min-width:0;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-semibold" style="color:var(--text-primary);font-size:.875rem;">
                        ${cfg.label}
                        ${isActive ? `<span class="rs-badge rs-badge-success ms-1" style="font-size:.6rem;">Current</span>` : ""}
                    </span>
                    <span style="color:var(--text-secondary);font-size:.75rem;">
                        ${cfg.threshold === 0 ? "Default" : "₹" + cfg.threshold.toLocaleString("en-IN")}
                    </span>
                </div>
                <div class="rs-progress-track" style="height:4px;">
                    <div class="rs-progress-fill" style="width:${pct}%;background:${cfg.color};"></div>
                </div>
                <p class="mb-0 mt-1" style="color:var(--text-secondary);font-size:.72rem;">
                    ${cfg.discount > 0 ? `${cfg.discount}% discount` : (t === "platinum" ? "VIP access & exclusive offers" : "Earn points on every purchase")}
                </p>
            </div>
        </div>`;
    }).join("");
}

// ========================
// RECENT REWARDS LIST
// ========================
function renderRecentRewards(history) {
    const list  = document.getElementById("recent-rewards-list");
    const empty = document.getElementById("rewards-empty");
    if (!list) return;

    if (!history || history.length === 0) {
        if (empty) empty.classList.remove("hidden");
        return;
    }
    if (empty) empty.classList.add("hidden");

    list.innerHTML = history.map(r => {
        const daysAgo = Math.floor((Date.now() - new Date(r.created_at)) / 86400000);
        const timeStr = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
        return `
        <div class="d-flex align-items-center gap-3 py-3" style="border-bottom:1px solid rgba(99,102,241,.06);">
            <div class="icon-badge icon-badge-emerald" style="width:36px;height:36px;border-radius:10px;font-size:.8rem;flex-shrink:0;">
                <i class="fas fa-star"></i>
            </div>
            <div class="flex-grow-1" style="min-width:0;">
                <p class="mb-0 fw-semibold" style="color:var(--text-primary);font-size:.875rem;">
                    +${r.points_earned} Points Earned
                </p>
                <p class="mb-0 rs-mono" style="color:var(--text-secondary);font-size:.75rem;">${r.transaction_id}</p>
            </div>
            <span class="rs-text-xs flex-shrink-0" style="color:var(--text-secondary);">${timeStr}</span>
        </div>`;
    }).join("");
}

// ========================
// INIT
// ========================
loadProfile();
