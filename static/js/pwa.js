/**
 * pwa.js — RetailScan PWA: Service Worker registration,
 *           Install prompt, Splash screen, Offline detection
 */
"use strict";

// ── 1. Service Worker Registration ─────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(reg => {
        console.log("[PWA] SW registered. Scope:", reg.scope);

        // Notify user when a new version is available
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              _showUpdateBanner();
            }
          });
        });
      })
      .catch(err => console.warn("[PWA] SW registration failed:", err));
  });

  // Detect controller change (new SW activated) and reload
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  });
}

// ── 2. Install Prompt ────────────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  _deferredPrompt = e;
  _showInstallBanner();
});

window.addEventListener("appinstalled", () => {
  _deferredPrompt = null;
  _hideInstallBanner();
  _showToast("✅ RetailScan installed! Open it from your home screen.", "success");
  // Track install in localStorage
  localStorage.setItem("pwa_installed", "1");
});

function _showInstallBanner() {
  // Don't show if already installed or dismissed this session
  if (localStorage.getItem("pwa_install_dismissed") === "1") return;
  if (window.matchMedia("(display-mode: standalone)").matches) return;

  let banner = document.getElementById("pwa-install-banner");
  if (!banner) {
    banner = _buildInstallBanner();
    document.body.appendChild(banner);
  }
  requestAnimationFrame(() => banner.classList.add("pwa-banner-show"));
}

function _hideInstallBanner() {
  const banner = document.getElementById("pwa-install-banner");
  if (banner) {
    banner.classList.remove("pwa-banner-show");
    setTimeout(() => banner.remove(), 400);
  }
}

function _buildInstallBanner() {
  const div = document.createElement("div");
  div.id = "pwa-install-banner";
  div.className = "pwa-install-banner";
  div.innerHTML = `
    <div class="pwa-banner-inner">
      <div class="pwa-banner-icon">
        <img src="/static/icons/icon-96.png" alt="RetailScan" width="40" height="40"
             style="border-radius:12px;">
      </div>
      <div class="pwa-banner-text">
        <strong>Install RetailScan</strong>
        <span>Add to home screen for faster access</span>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-install-btn" onclick="triggerInstall()">Install</button>
        <button class="pwa-dismiss-btn" onclick="dismissInstall()" aria-label="Dismiss">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>`;
  return div;
}

function triggerInstall() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(choice => {
    if (choice.outcome === "accepted") {
      console.log("[PWA] User accepted install prompt");
    }
    _deferredPrompt = null;
    _hideInstallBanner();
  });
}

function dismissInstall() {
  localStorage.setItem("pwa_install_dismissed", "1");
  _hideInstallBanner();
}

// ── 3. Update Banner ─────────────────────────────────────────────
function _showUpdateBanner() {
  _showToast("🔄 New version available — tap to refresh.", "info", () => window.location.reload(), 8000);
}

// ── 4. Online / Offline Detection ───────────────────────────────
window.addEventListener("offline", () => {
  _showToast("📡 You are offline. Cached data is available.", "warning", null, 4000);
  document.body.classList.add("pwa-offline");
});

window.addEventListener("online", () => {
  _showToast("✅ Back online!", "success", null, 2500);
  document.body.classList.remove("pwa-offline");
});

// ── 5. Standalone mode detection ────────────────────────────────
(function detectStandalone() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    document.body.classList.add("pwa-standalone");
    // Store for other scripts to read
    window.PWA_STANDALONE = true;
  }
})();

// ── 6. Toast helper (shared) ─────────────────────────────────────
window._pwaToastTimer = null;

function _showToast(message, type = "info", onClick = null, duration = 3500) {
  // Reuse global showToast if it exists (from auth.js / main.js)
  if (typeof showToast === "function") {
    showToast(message, type);
    return;
  }

  // Fallback minimal toast
  let toast = document.getElementById("pwa-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pwa-toast";
    toast.className = "pwa-toast";
    document.body.appendChild(toast);
  }

  const icons = { success: "✅", warning: "⚠️", info: "ℹ️", error: "❌" };
  toast.textContent = (icons[type] || "ℹ️") + " " + message;
  toast.className = `pwa-toast pwa-toast-${type} pwa-toast-show`;
  if (onClick) toast.style.cursor = "pointer", toast.onclick = onClick;
  else toast.style.cursor = "", toast.onclick = null;

  clearTimeout(window._pwaToastTimer);
  window._pwaToastTimer = setTimeout(() => toast.classList.remove("pwa-toast-show"), duration);
}

// ── 7. Splash / Startup Animation ───────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Only show splash when launched as installed PWA
  if (!window.PWA_STANDALONE) return;
  if (document.getElementById("pwa-splash")) return;

  const splash = document.createElement("div");
  splash.id = "pwa-splash";
  splash.innerHTML = `
    <div class="pwa-splash-inner">
      <img src="/static/icons/icon-192.png" alt="RetailScan"
           class="pwa-splash-logo" width="88" height="88">
      <h1 class="pwa-splash-title">RetailScan</h1>
      <p  class="pwa-splash-sub">Smart Retail Checkout</p>
      <div class="pwa-splash-bar">
        <div class="pwa-splash-progress"></div>
      </div>
    </div>`;
  document.body.appendChild(splash);

  // Animate progress bar then fade out
  setTimeout(() => {
    const bar = splash.querySelector(".pwa-splash-progress");
    if (bar) bar.style.width = "100%";
  }, 80);

  setTimeout(() => {
    splash.classList.add("pwa-splash-out");
    setTimeout(() => splash.remove(), 600);
  }, 1500);
});

// ── 8. iOS Install Hint ──────────────────────────────────────────
(function showIOSHint() {
  // Detect iOS Safari (not already installed)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isInStandalone = window.navigator.standalone === true;

  if (!isIOS || !isSafari || isInStandalone) return;
  if (localStorage.getItem("ios_hint_dismissed") === "1") return;

  setTimeout(() => {
    const hint = document.createElement("div");
    hint.className = "pwa-ios-hint";
    hint.innerHTML = `
      <i class="fas fa-arrow-up-from-bracket me-1"></i>
      Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong>
      to install RetailScan as an app.
      <br><button onclick="this.closest('.pwa-ios-hint').remove();localStorage.setItem('ios_hint_dismissed','1')"
           style="background:none;border:none;color:#a5b4fc;font-size:.75rem;margin-top:6px;cursor:pointer;text-decoration:underline;">
        Dismiss
      </button>`;
    document.body.appendChild(hint);
    // Auto-dismiss after 8s
    setTimeout(() => {
      hint.style.animation = "none";
      hint.style.opacity = "0";
      hint.style.transition = "opacity .4s";
      setTimeout(() => hint.remove(), 400);
    }, 8000);
  }, 2500);
})();
