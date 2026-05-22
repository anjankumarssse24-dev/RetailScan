/**
 * shortcuts.js — Global Keyboard Shortcuts for RetailScan
 *
 * Shortcuts:
 *   /          → focus first visible text input (or scan trigger)
 *   Escape     → close any open modal / dropdown / sheet
 *   Alt+C      → go to Cart
 *   Alt+H      → go to History
 *   Alt+S      → go to Scanner (home)
 *   Alt+P      → go to Payment
 *   Shift+?    → show keyboard shortcuts cheatsheet
 */
(function () {
    "use strict";

    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const MOD   = isMac ? "⌥" : "Alt+";

    const SHORTCUTS = [
        { key: "/",        label: "/",           description: "Focus search / scan",     },
        { key: "Escape",   label: "Esc",         description: "Close modal / dropdown",  },
        { key: "?",shift:1,label: "Shift+?",     description: "Show this cheatsheet",    },
        { key: "c",alt:1,  label: MOD+"C",       description: "Go to Cart",              },
        { key: "h",alt:1,  label: MOD+"H",       description: "Go to History",           },
        { key: "s",alt:1,  label: MOD+"S",       description: "Go to Scanner",           },
        { key: "p",alt:1,  label: MOD+"P",       description: "Go to Payment",           },
    ];

    // ── Prevent firing inside input elements ─────────────────────
    function _inInput() {
        const tag = document.activeElement?.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
               document.activeElement?.isContentEditable;
    }

    // ── Close topmost overlay ─────────────────────────────────────
    function _closeTopmost() {
        // Bootstrap modals
        const modal = document.querySelector(".modal.show");
        if (modal) {
            const bsModal = window.bootstrap?.Modal?.getInstance(modal);
            if (bsModal) { bsModal.hide(); return; }
        }
        // Custom dropdowns
        const dropdown = document.querySelector(".user-dropdown:not([hidden])");
        if (dropdown) { dropdown.style.display = "none"; return; }
        // Any [data-closeable]
        const closeable = document.querySelector("[data-closeable]:not(.hidden)");
        if (closeable) { closeable.classList.add("hidden"); return; }
        // Bottom sheets
        const sheet = document.querySelector(".rs-bottom-sheet.active");
        if (sheet) sheet.classList.remove("active");
    }

    // ── Focus best search / scan target ──────────────────────────
    function _focusSearch() {
        const candidates = [
            document.getElementById("search-input"),
            document.querySelector("input[type=search]"),
            document.querySelector("input[type=text]:not([hidden])"),
            document.getElementById("btn-capture"),
        ];
        for (const el of candidates) {
            if (el && !el.disabled && !el.closest(".hidden")) {
                el.focus();
                if (el.select) el.select();
                return;
            }
        }
    }

    // ── Cheatsheet sheet ─────────────────────────────────────────
    function _buildSheet() {
        let sheet = document.getElementById("shortcuts-sheet");
        if (sheet) { sheet.classList.toggle("hidden"); return; }

        sheet = document.createElement("div");
        sheet.id = "shortcuts-sheet";
        sheet.className = "shortcuts-sheet";
        sheet.innerHTML = `
            <div class="shortcuts-sheet-inner">
                <div class="d-flex align-items-center justify-content-between mb-4">
                    <h3 class="mb-0" style="font-size:1rem;font-weight:700;color:var(--text-primary);">
                        <i class="fas fa-keyboard me-2" style="color:var(--primary);"></i>
                        Keyboard Shortcuts
                    </h3>
                    <button onclick="document.getElementById('shortcuts-sheet').classList.add('hidden')"
                            class="rs-toast-close" style="position:static;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="shortcuts-list">
                    ${SHORTCUTS.map(s => `
                        <div class="shortcut-row">
                            <kbd class="shortcut-key">${s.label}</kbd>
                            <span class="shortcut-desc">${s.description}</span>
                        </div>
                    `).join("")}
                </div>
                <p class="mt-3 mb-0" style="font-size:.72rem;color:var(--text-secondary);">
                    Press <kbd class="shortcut-key">Esc</kbd> to close
                </p>
            </div>`;

        sheet.addEventListener("click", e => { if (e.target === sheet) sheet.classList.add("hidden"); });
        document.body.appendChild(sheet);
    }

    // ── Main handler ─────────────────────────────────────────────
    document.addEventListener("keydown", e => {
        const key = e.key;

        // Escape — always fires (even in inputs)
        if (key === "Escape") { _closeTopmost(); return; }

        // All other shortcuts require no input focus
        if (_inInput()) return;

        if (key === "/" && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            _focusSearch();
            return;
        }

        if (key === "?" && e.shiftKey) {
            e.preventDefault();
            _buildSheet();
            return;
        }

        if (e.altKey) {
            switch (key.toLowerCase()) {
                case "c": e.preventDefault(); window.location.href = "/cart";    break;
                case "h": e.preventDefault(); window.location.href = "/history"; break;
                case "s": e.preventDefault(); window.location.href = "/";        break;
                case "p": e.preventDefault(); window.location.href = "/payment"; break;
            }
        }
    });

})();
