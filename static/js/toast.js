/**
 * toast.js — Global Toast Notification System  (Phase 2)
 *
 * Usage:  showToast("Message")
 *         showToast("Message", "success" | "error" | "warning" | "info")
 *         showToast("Message", "error", 5000)   // custom duration ms
 *
 * Backward-compatible with existing showToast(msg, type) calls.
 */

(function () {
    "use strict";

    /* ── Icon map ── */
    const ICONS = {
        success: "fa-circle-check",
        error:   "fa-circle-xmark",
        warning: "fa-triangle-exclamation",
        info:    "fa-circle-info",
    };

    /* ── Ensure container exists ── */
    function getContainer() {
        let c = document.getElementById("rs-toast-container");
        if (!c) {
            c = document.createElement("div");
            c.id = "rs-toast-container";
            document.body.appendChild(c);
        }
        return c;
    }

    /* ── Dismiss a single toast ── */
    function dismiss(el) {
        if (!el || el.dataset.dismissing) return;
        el.dataset.dismissing = "1";
        el.classList.add("dismissing");
        el.addEventListener("animationend", () => el.remove(), { once: true });
        // fallback remove
        setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
    }

    /* ── Core function ── */
    function showToast(msg, type, duration) {
        if (!msg) return;
        type     = (type || "success").toLowerCase();
        duration = duration ?? (type === "error" ? 5000 : 3500);

        // Remap legacy class names to typed names
        if (type !== "success" && type !== "error" && type !== "warning" && type !== "info") {
            type = "info";
        }

        const icon = ICONS[type] || ICONS.info;
        const container = getContainer();

        const el = document.createElement("div");
        el.className = `rs-toast ${type}`;
        el.setAttribute("role", "alert");
        el.innerHTML = `
            <i class="fas ${icon} rs-toast-icon"></i>
            <span class="rs-toast-body">${msg}</span>
            <button class="rs-toast-close" aria-label="Close"><i class="fas fa-times"></i></button>
        `;

        el.querySelector(".rs-toast-close").addEventListener("click", () => dismiss(el));
        el.addEventListener("click", () => dismiss(el));

        container.appendChild(el);

        /* Limit stack to 5 toasts */
        const all = container.querySelectorAll(".rs-toast:not(.dismissing)");
        if (all.length > 5) dismiss(all[0]);

        /* Auto-dismiss — pause on hover, restart on leave */
        let autoTimer = setTimeout(() => dismiss(el), duration);
        el.addEventListener("mouseenter", () => clearTimeout(autoTimer));
        el.addEventListener("mouseleave", () => {
            autoTimer = setTimeout(() => dismiss(el), Math.min(duration, 1800));
        });

        return el;
    }

    /* ── Expose globally ── */
    window.showToast = showToast;

    /* ── Also update all cart count badges centrally ── */
    window.updateCartBadges = function (count) {
        document.querySelectorAll(".nav-cart-badge").forEach(el => {
            el.textContent = count;
        });
    };

})();
