/**
 * main.js — Scanner page logic
 */

let cameraActive = false;

function updateCartCount() {
    fetch("/api/cart").then(r => r.json()).then(d => {
        document.querySelectorAll(".nav-cart-badge").forEach(el => { el.textContent = d.items.length; });
    });
}

// ========================
// CAMERA
// ========================
function updateCameraUI(active) {
    cameraActive = active;
    const feed = document.getElementById("camera-feed");
    const ph = document.getElementById("camera-placeholder");
    const status = document.getElementById("camera-status");
    const scanLine = document.getElementById("scan-line");
    const btnStart = document.getElementById("btn-start-camera");
    const btnStop = document.getElementById("btn-stop-camera");
    const btnCapture = document.getElementById("btn-capture");
    const btnCaptureMob = document.getElementById("btn-capture-mob");

    if (active) {
        feed.src = "/video_feed?" + Date.now();
        feed.classList.remove("hidden");
        ph.classList.add("hidden");
        if (scanLine) scanLine.classList.remove("hidden");
        status.className = "status-pill online";
        status.innerHTML = '<span class="status-dot"></span>LIVE';
        btnStart.disabled = true;
        btnStop.disabled = false;
        btnCapture.disabled = false;
        if (btnCaptureMob) btnCaptureMob.disabled = false;
    } else {
        feed.src = "";
        feed.classList.add("hidden");
        ph.classList.remove("hidden");
        if (scanLine) scanLine.classList.add("hidden");
        status.className = "status-pill offline";
        status.innerHTML = '<span class="status-dot"></span>OFFLINE';
        btnStart.disabled = false;
        btnStop.disabled = true;
        btnCapture.disabled = true;
        if (btnCaptureMob) btnCaptureMob.disabled = true;
    }
}

document.getElementById("btn-start-camera").addEventListener("click", () => {
    const btn = document.getElementById("btn-start-camera");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i> Starting...';

    fetch("/api/camera/start", { method: "POST" })
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                updateCameraUI(true);
                showToast("Camera started", "success");
            } else {
                const msg = d.error || "Camera failed to start";
                // Friendly error messages for common failures
                if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
                    showToast("🚫 Camera permission denied. Please allow camera access.", "error", 6000);
                } else if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("unavailable")) {
                    showToast("📷 No camera detected. Connect a camera and try again.", "error", 6000);
                } else if (msg.toLowerCase().includes("busy") || msg.toLowerCase().includes("in use")) {
                    showToast("📷 Camera is in use by another app. Close it and retry.", "error", 5000);
                } else {
                    showToast(msg, "error");
                }
                btn.disabled = false;
            }
            btn.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        })
        .catch(e => {
            showToast("Could not reach camera service. Is the server running?", "error", 5000);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        });
});

document.getElementById("btn-stop-camera").addEventListener("click", () => {
    fetch("/api/camera/stop", { method: "POST" }).then(() => { updateCameraUI(false); showToast("Camera stopped"); });
});

// ========================
// SCANNING ANIMATION
// ========================
let scanTimer = null, scanSeconds = 0;
const scanMessages = ["Capturing image...","Processing image...","Scanning for products...","Analyzing objects...","Identifying items...","Reading labels & brands...","Estimating prices...","Almost done...","Finalizing results..."];

function startScanUI() {
    scanSeconds = 0;
    const overlay = document.getElementById("loading-overlay");
    const status = document.getElementById("analysis-status");
    status.textContent = scanMessages[0];
    overlay.classList.remove("hidden");
    scanTimer = setInterval(() => {
        scanSeconds++;
        let i = scanSeconds < 2 ? 0 : scanSeconds < 4 ? 1 : scanSeconds < 7 ? 2 : scanSeconds < 10 ? 3 : scanSeconds < 13 ? 4 : scanSeconds < 16 ? 5 : scanSeconds < 20 ? 6 : scanSeconds < 25 ? 7 : 8;
        status.textContent = scanMessages[i];
    }, 1000);
}

function stopScanUI() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    document.getElementById("loading-overlay").classList.add("hidden");
}

// ========================
// CAPTURE & DETECT
// ========================
function _doCaptureAndDetect() {
    const btnCapture    = document.getElementById("btn-capture");
    const btnCaptureMob = document.getElementById("btn-capture-mob");
    if (!cameraActive) { showToast("Start camera first!", "error"); return; }
    if (btnCapture)    btnCapture.disabled    = true;
    if (btnCaptureMob) btnCaptureMob.disabled = true;

    const resultArea = document.getElementById("result-area");
    const overlayLabel = document.getElementById("overlay-label");
    startScanUI();

    fetch("/api/capture", { method: "POST" })
        .then(r => r.json())
        .then(data => {
            stopScanUI();
            if (!data.success) {
                const err = data.error || "Detection failed";
                // Friendly AI error messages
                if (err.toLowerCase().includes("gemini") || err.toLowerCase().includes("api")) {
                    showToast("🤖 AI detection temporarily unavailable. Please try again.", "warning", 5000);
                } else if (err.toLowerCase().includes("quota") || err.toLowerCase().includes("rate")) {
                    showToast("⏳ AI quota reached — retrying shortly.", "warning", 5000);
                } else if (err.toLowerCase().includes("offline") || err.toLowerCase().includes("network")) {
                    showToast("📡 Offline — connect to internet for AI detection.", "warning", 5000);
                } else {
                    showToast(err, "error");
                }
                return;
            }

            const items = data.items || [];
            const totalItems = data.total_items || 0;
            const subtotal = data.subtotal || 0;
            const scene = data.scene || "";
            const description = data.description || "";

            if (items.length === 0) {
                overlayLabel.textContent = "No product found";
                overlayLabel.classList.remove("hidden");
                setTimeout(() => overlayLabel.classList.add("hidden"), 5000);
                resultArea.innerHTML = `
                    <div class="w-full">
                        <img src="/captured_images/${data.image_path}" class="w-full rounded-xl border border-white/10 mb-4" alt="Captured">
                        <div class="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                            <i class="fas fa-exclamation-triangle text-2xl text-red-400 mb-2"></i>
                            <p class="text-red-400 font-semibold">No Product Detected</p>
                            <p class="text-gray-500 text-sm mt-1">${scene || "No retail items visible."}</p>
                        </div>
                    </div>`;
                showToast("No product detected", "error");
                return;
            }

            overlayLabel.textContent = items[0].name;
            overlayLabel.classList.remove("hidden");
            setTimeout(() => overlayLabel.classList.add("hidden"), 8000);

            let itemsHTML = items.map((item, i) => `
                <div class="detected-item-card" style="animation-delay:${i * 0.1}s">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs font-bold px-2 py-1 rounded-md bg-cyber/10 text-cyber">#${i + 1}</span>
                        <span class="text-xs font-semibold text-neon-green">${Math.round((item.confidence || 0.9) * 100)}% match</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-400"><i class="fas fa-box mr-1"></i>Product</span><span class="text-white font-medium">${item.name}</span></div>
                        <div class="flex justify-between"><span class="text-gray-400"><i class="fas fa-tag mr-1"></i>Category</span><span class="text-gray-300">${item.category}</span></div>
                        <div class="flex justify-between items-center rounded-lg bg-neon-green/5 border border-neon-green/10 px-3 py-2 -mx-1">
                            <span class="text-gray-400"><i class="fas fa-indian-rupee-sign mr-1"></i>Price</span>
                            <span class="text-xl font-bold text-neon-green">₹${item.unit_price}</span>
                        </div>
                    </div>
                    <button class="btn-glow bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 w-full justify-center mt-3 py-2.5 text-sm"
                            onclick="addToCart(${item.detection_id}, '${item.name.replace(/'/g, "\\'")}', '${item.category.replace(/'/g, "\\'")}', ${item.unit_price})">
                        <i class="fas fa-cart-plus"></i> Add — ₹${item.unit_price}
                    </button>
                </div>`).join("");

            resultArea.innerHTML = `
                <div class="w-full space-y-4">
                    <img src="/captured_images/${data.image_path}" class="w-full rounded-xl border border-white/10" alt="Captured">
                    <div class="rounded-xl bg-neon-green/5 border border-neon-green/15 p-4">
                        <div class="flex items-center gap-2 text-neon-green font-bold mb-1">
                            <i class="fas fa-check-circle"></i> ${totalItems} Product${totalItems > 1 ? 's' : ''} Detected
                        </div>
                        <div class="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                            <span class="text-gray-400 text-sm"><i class="fas fa-clock mr-1"></i>${data.timestamp}</span>
                            <span class="text-xl font-bold text-neon-green">₹${subtotal}</span>
                        </div>
                    </div>
                    <div class="space-y-3">${itemsHTML}</div>
                    ${items.length > 0 ? `
                    <button class="btn-glow-primary bg-gradient-to-r from-cyber-dim to-cyber text-dark-900 w-full justify-center py-3 text-base font-bold"
                            onclick="addAllToCart(${JSON.stringify(items).replace(/"/g, '&quot;')})">
                        <i class="fas fa-cart-arrow-down"></i> Add All — ₹${subtotal}
                    </button>` : ''}
                </div>`;

            showToast(`Detected ${totalItems} item${totalItems > 1 ? 's' : ''} — ₹${subtotal}`);

            // Post-scan suggestions
            if (items.length > 0 && data.suggestions && data.suggestions.length > 0) {
                renderScanSuggestions(data.suggestions);
            } else if (items.length > 0) {
                // Fallback: fetch explicitly
                const names = items.map(i => encodeURIComponent(i.name)).join(",");
                fetch(`/api/scan-suggestions?names=${names}`)
                    .then(r => r.json())
                    .then(s => { if (s.success && s.suggestions.length) renderScanSuggestions(s.suggestions); })
                    .catch(() => {});
            }
        })
        .catch(e => { stopScanUI(); showToast("Error: " + e.message, "error"); })
        .finally(() => {
            const btnC  = document.getElementById("btn-capture");
            const btnCM = document.getElementById("btn-capture-mob");
            if (btnC)  btnC.disabled  = false;
            if (btnCM) btnCM.disabled = false;
        });
}

// Wire both capture buttons to the shared function
document.getElementById("btn-capture").addEventListener("click", _doCaptureAndDetect);
const _mobCaptureBtn = document.getElementById("btn-capture-mob");
if (_mobCaptureBtn) _mobCaptureBtn.addEventListener("click", _doCaptureAndDetect);

// ========================
// SCAN SUGGESTIONS
// ========================
function renderScanSuggestions(suggestions) {
    const wrap  = document.getElementById("scan-suggestions");
    const strip = document.getElementById("scan-suggestions-strip");
    if (!wrap || !strip) return;

    const TYPE_ICON = { fbt: "fa-link", similar: "fa-shuffle", trending: "fa-fire" };

    strip.innerHTML = suggestions.map(s => `
        <button class="scan-rec-chip" onclick="addSuggestionToCart('${s.name.replace(/'/g, "\\'")}')">
            <div class="rec-chip-icon">
                <i class="fas ${TYPE_ICON[s.type] || 'fa-star'}"></i>
            </div>
            <span>${s.name}</span>
        </button>
    `).join("");

    wrap.classList.remove("hidden");
}

function addSuggestionToCart(name) {
    fetch("/api/add_to_cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection_id: 0, product_name: name, category: "recommended", price: 0 })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) { showToast(`${name} added to cart!`); updateCartCount(); }
        else showToast(d.error || "Could not add item", "error");
    })
    .catch(() => showToast("Could not add item", "error"));
}
});

// ========================
// ADD TO CART
// ========================
function addToCart(detectionId, productName, category, price) {
    fetch("/api/add_to_cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection_id: detectionId, product_name: productName, category: category, price: price })
    })
    .then(r => r.json())
    .then(d => { if (d.success) { showToast(`${productName} added to cart!`); updateCartCount(); } else { showToast(d.error, "error"); } })
    .catch(e => showToast("Error: " + e.message, "error"));
}

function addAllToCart(items) {
    let added = 0;
    const promises = items.map(item =>
        fetch("/api/add_to_cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detection_id: item.detection_id, product_name: item.name, category: item.category, price: item.unit_price })
        }).then(r => r.json()).then(d => { if (d.success) added++; })
    );
    Promise.all(promises).then(() => { showToast(`${added} item${added > 1 ? 's' : ''} added to cart!`); updateCartCount(); });
}

// Init
fetch("/api/camera/status").then(r => r.json()).then(d => updateCameraUI(d.active));
updateCartCount();

// ========================
// FULLSCREEN SCAN MODE
// ========================
function openFullscreenScan() {
    if (!cameraActive) { showToast("Start camera first!", "warning"); return; }

    let overlay = document.getElementById("fullscreen-scan-overlay");
    if (overlay) { overlay.classList.remove("hidden"); return; }

    overlay = document.createElement("div");
    overlay.id = "fullscreen-scan-overlay";
    overlay.className = "scan-fullscreen-overlay";
    overlay.innerHTML = `
        <button class="scan-fullscreen-close" onclick="closeFullscreenScan()">
            <i class="fas fa-compress me-1"></i>Exit
        </button>
        <div class="scan-fullscreen-feed" id="fs-feed-wrap">
            <img id="fs-feed" src="/video_feed?fs=1" alt="Camera">
            <div class="scan-fullscreen-line"></div>
        </div>
        <div class="d-flex align-items-center gap-4">
            <button class="scan-fullscreen-capture-btn" id="fs-capture-btn"
                    onclick="fsCapture()">
                <i class="fas fa-camera"></i>
            </button>
        </div>
        <p style="color:rgba(255,255,255,.5);font-size:.75rem;">Tap button to capture &amp; detect</p>`;

    document.body.appendChild(overlay);
}

function closeFullscreenScan() {
    const overlay = document.getElementById("fullscreen-scan-overlay");
    if (overlay) overlay.remove();
}

function fsCapture() {
    const btn = document.getElementById("fs-capture-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    fetch("/api/capture", { method: "POST" })
        .then(r => r.json())
        .then(data => {
            closeFullscreenScan();
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i>'; }
            if (data.success && data.items?.length) {
                showToast(`✅ Detected ${data.total_items} item(s)!`, "success");
                updateCartCount();
            } else {
                showToast("No products detected", "warning");
            }
        })
        .catch(() => { closeFullscreenScan(); showToast("Capture failed", "error"); });
}
