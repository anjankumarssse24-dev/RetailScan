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
// CAMERA  (browser getUserMedia)
// ========================
let _mediaStream = null;

function updateCameraUI(active) {
    cameraActive = active;
    const feed      = document.getElementById("camera-feed");
    const ph        = document.getElementById("camera-placeholder");
    const status    = document.getElementById("camera-status");
    const scanLine  = document.getElementById("scan-line");
    const btnStart  = document.getElementById("btn-start-camera");
    const btnStop   = document.getElementById("btn-stop-camera");
    const btnCapture    = document.getElementById("btn-capture");
    const btnCaptureMob = document.getElementById("btn-capture-mob");

    if (active) {
        feed.classList.remove("hidden");
        ph.style.display = "none";                 // inline beats any Bootstrap class
        if (scanLine) scanLine.classList.remove("hidden");
        status.className = "status-pill online";
        status.innerHTML = '<span class="status-dot"></span>LIVE';
        btnStart.disabled = true;
        btnStart.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        btnStop.disabled  = false;
        btnCapture.disabled = false;
        if (btnCaptureMob) btnCaptureMob.disabled = false;
    } else {
        if (_mediaStream) { _mediaStream.getTracks().forEach(t => t.stop()); _mediaStream = null; }
        if (feed.srcObject) { feed.srcObject = null; }
        feed.classList.add("hidden");
        ph.style.display = "";                     // restore natural flex display
        if (scanLine) scanLine.classList.add("hidden");
        // Hide detect overlay too
        const detOverlay = document.getElementById("camera-detect-overlay");
        if (detOverlay) detOverlay.style.display = "none";
        status.className = "status-pill offline";
        status.innerHTML = '<span class="status-dot"></span>OFFLINE';
        btnStart.disabled = false;
        btnStart.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        btnStop.disabled  = true;
        btnCapture.disabled = true;
        if (btnCaptureMob) btnCaptureMob.disabled = true;
    }
}

document.getElementById("btn-start-camera").addEventListener("click", async () => {
    const btn = document.getElementById("btn-start-camera");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i> Starting...';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        showToast("❌ Camera not supported. Open the app over HTTPS in Chrome or Safari.", "error", 7000);
        return;
    }

    // Try constraints from most specific → least specific (robust mobile fallback)
    const constraintSets = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: "environment" }, audio: false },
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        { video: true, audio: false }
    ];

    let stream = null, lastErr = null;
    for (const constraints of constraintSets) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
        } catch (err) {
            lastErr = err;
            // Don't retry on hard stops — only retry on constraint issues
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") break;
            if (err.name === "NotFoundError"   || err.name === "DevicesNotFoundError")  break;
            if (err.name === "NotReadableError"|| err.name === "TrackStartError")       break;
        }
    }

    if (!stream) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        const n = lastErr ? lastErr.name : "";
        if (n === "NotAllowedError" || n === "PermissionDeniedError")
            showToast("🚫 Camera permission denied. Allow camera access in your browser settings.", "error", 7000);
        else if (n === "NotFoundError" || n === "DevicesNotFoundError")
            showToast("📷 No camera found on this device.", "error", 6000);
        else if (n === "NotReadableError" || n === "TrackStartError")
            showToast("📷 Camera is busy — close other apps using the camera and retry.", "error", 5000);
        else
            showToast("Camera error: " + (lastErr ? (lastErr.message || lastErr.name) : "unknown"), "error", 5000);
        return;
    }

    _mediaStream = stream;
    const feed = document.getElementById("camera-feed");
    feed.srcObject = stream;
    // await play() instead of onloadedmetadata to avoid race condition on mobile
    try { await feed.play(); } catch(e) { /* blocked by autoplay policy — stream still active */ }
    updateCameraUI(true);
    showToast("Camera started", "success");
});

document.getElementById("btn-stop-camera").addEventListener("click", () => {
    updateCameraUI(false);
    showToast("Camera stopped");
});

// ========================
// SCANNING ANIMATION
// ========================
let scanTimer = null, scanSeconds = 0;
const scanMessages = ["Capturing image...","Processing image...","Scanning for products...","Analyzing objects...","Identifying items...","Reading labels & brands...","Estimating prices...","Almost done...","Finalizing results..."];

function startScanUI() {
    scanSeconds = 0;
    scanTimer = setInterval(() => {
        scanSeconds++;
        let i = scanSeconds < 2 ? 0 : scanSeconds < 4 ? 1 : scanSeconds < 7 ? 2 : scanSeconds < 10 ? 3 : scanSeconds < 13 ? 4 : scanSeconds < 16 ? 5 : scanSeconds < 20 ? 6 : scanSeconds < 25 ? 7 : 8;
        const msg = document.getElementById("result-scan-msg");
        if (msg) msg.textContent = scanMessages[i];
    }, 1000);
}

function stopScanUI() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
}

// ========================
// CAMERA DETECT OVERLAY helpers
// ========================
function _showDetectOverlay(html, bg) {
    const ov = document.getElementById("camera-detect-overlay");
    if (!ov) return;
    ov.style.background = bg || "rgba(15,10,40,.82)";
    ov.innerHTML = html;
    ov.style.opacity = "1";
    ov.style.display = "flex";
}
function _hideDetectOverlay(delay) {
    const ov = document.getElementById("camera-detect-overlay");
    if (!ov) return;
    setTimeout(() => {
        ov.style.opacity = "0";
        setTimeout(() => { ov.style.display = "none"; ov.style.opacity = "1"; }, 350);
    }, delay || 0);
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

    // Draw current video frame onto hidden canvas
    const video  = document.getElementById("camera-feed");
    const canvas = document.getElementById("camera-canvas");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const resultArea   = document.getElementById("result-area");
    const overlayLabel = document.getElementById("overlay-label");

    // ── Show scanning overlay on the LIVE VIDEO FEED ──────────────────────
    _showDetectOverlay(`
        <div class="text-center" style="color:#fff;">
            <div style="position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
                <div style="position:absolute;inset:0;border:2.5px solid transparent;border-top-color:#6366f1;border-right-color:#6366f1;border-radius:50%;animation:spin 1.2s linear infinite;filter:drop-shadow(0 0 6px #6366f1);"></div>
                <div style="position:absolute;inset:12px;border:2px solid transparent;border-bottom-color:#8b5cf6;border-left-color:#8b5cf6;border-radius:50%;animation:spin 1.8s linear infinite reverse;"></div>
                <i class="fas fa-barcode" style="color:#a5b4fc;font-size:1.3rem;z-index:10;position:relative;"></i>
            </div>
            <p id="feed-scan-msg" style="font-size:.9rem;font-weight:700;margin:0 0 6px;letter-spacing:.3px;">Capturing image…</p>
            <div style="display:flex;gap:6px;justify-content:center;">
                <span class="loading-dot"></span><span class="loading-dot delay-1"></span><span class="loading-dot delay-2"></span>
            </div>
        </div>`, "rgba(10,8,30,.84)");

    // Cycle messages on the overlay while waiting
    const _overlayMsgs = ["Capturing image…","Analyzing frame…","Scanning products…","Identifying items…","Almost done…"];
    let _omi = 0;
    const _omTimer = setInterval(() => {
        _omi = Math.min(_omi + 1, _overlayMsgs.length - 1);
        const m = document.getElementById("feed-scan-msg");
        if (m) m.textContent = _overlayMsgs[_omi];
    }, 1800);

    // ── Show processing spinner in result area ────────────────────────────
    resultArea.innerHTML = `
        <div class="text-center py-5 w-100">
            <div class="upi-processing-ring mx-auto mb-4">
                <div class="upi-ring-outer"></div>
                <div class="upi-ring-inner"></div>
                <i class="fas fa-barcode fs-5 absolute-center" style="color:var(--primary);z-index:10;"></i>
            </div>
            <p class="fw-semibold fs-5 mb-2" style="color:var(--text-primary);">Detecting Products…</p>
            <p id="result-scan-msg" class="small mb-4" style="color:var(--text-secondary);">${scanMessages[0]}</p>
            <div class="d-flex gap-2 justify-content-center">
                <span class="loading-dot"></span>
                <span class="loading-dot delay-1"></span>
                <span class="loading-dot delay-2"></span>
            </div>
        </div>`;
    startScanUI();

    // Convert canvas to JPEG Blob, then send as FormData (binary — no base64 overhead)
    canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append("image", blob, "capture.jpg");

        fetch("/api/capture", { method: "POST", body: formData })
        .then(r => r.json())
        .then(data => {
            clearInterval(_omTimer);
            stopScanUI();
            if (!data.success) {
                // Show error on video feed overlay briefly
                _showDetectOverlay(`
                    <div class="text-center" style="color:#fff;">
                        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#fca5a5;margin-bottom:10px;"></i>
                        <p style="font-size:.9rem;font-weight:700;margin:0;">Detection failed</p>
                        <p style="font-size:.75rem;opacity:.7;margin:4px 0 0;">Try again</p>
                    </div>`, "rgba(127,29,29,.84)");
                _hideDetectOverlay(2200);
                const rawErr = (data.error || "").toLowerCase();
                const msg = rawErr.includes("quota") || rawErr.includes("rate") ? "Server is busy — please try again in a moment."
                          : rawErr.includes("offline") || rawErr.includes("network") ? "No internet connection detected."
                          : "Could not process the image. Please try again.";
                resultArea.innerHTML = `
                    <div class="text-center py-5 w-100">
                        <div style="width:68px;height:68px;border-radius:18px;font-size:1.8rem;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                            <i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i>
                        </div>
                        <p class="fw-semibold mb-1" style="color:#ef4444;font-size:1.1rem;">Detection Failed</p>
                        <p class="mb-0" style="color:var(--text-secondary);font-size:.85rem;">${msg}</p>
                    </div>`;
                showToast("Detection failed — try again", "error", 4000);
                return;
            }

            const items = data.items || [];
            const totalItems = data.total_items || 0;
            const subtotal = data.subtotal || 0;
            const scene = data.scene || "";
            const description = data.description || "";

            if (items.length === 0) {
                // No-product overlay on video feed
                _showDetectOverlay(`
                    <div class="text-center" style="color:#fff;">
                        <i class="fas fa-search-minus" style="font-size:2rem;color:#fca5a5;margin-bottom:10px;"></i>
                        <p style="font-size:.9rem;font-weight:700;margin:0;">No products found</p>
                        <p style="font-size:.75rem;opacity:.7;margin:4px 0 0;">Try better lighting or move closer</p>
                    </div>`, "rgba(100,20,20,.82)");
                _hideDetectOverlay(2500);
                overlayLabel.textContent = "No product found";
                overlayLabel.classList.remove("hidden");
                setTimeout(() => overlayLabel.classList.add("hidden"), 5000);
                resultArea.innerHTML = `
                    <div class="w-100">
                        <img src="/captured_images/${data.image_path}" class="w-100 rounded-3 mb-3" style="border:1px solid rgba(239,68,68,.15);max-height:180px;object-fit:cover;" alt="Captured">
                        <div class="rounded-3 p-4 text-center" style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.18);">
                            <i class="fas fa-search-minus mb-2" style="color:#ef4444;font-size:1.6rem;"></i>
                            <p class="fw-semibold mb-1" style="color:#ef4444;">No Products Found</p>
                            <p class="mb-0" style="color:var(--text-secondary);font-size:.85rem;">${scene || "No retail items visible in this image. Try better lighting or move closer."}</p>
                        </div>
                    </div>`;
                showToast("No products found — try again", "error");
                return;
            }

            // ── Show brief success overlay on video feed, then fade back to live ──
            const itemLines = items.slice(0, 3).map(it =>
                `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.12);gap:20px;">
                    <span style="font-size:.8rem;font-weight:600;">${it.name}</span>
                    <span style="font-size:.85rem;font-weight:800;color:#6ee7b7;">₹${it.unit_price}</span>
                 </div>`
            ).join("");
            const moreLabel = items.length > 3 ? `<p style="font-size:.7rem;opacity:.6;margin:6px 0 0;text-align:center;">+${items.length - 3} more</p>` : "";
            _showDetectOverlay(`
                <div style="color:#fff;width:85%;max-width:280px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;justify-content:center;">
                        <i class="fas fa-check-circle" style="font-size:1.4rem;color:#34d399;"></i>
                        <span style="font-size:.95rem;font-weight:800;">${totalItems} product${totalItems > 1 ? 's' : ''} detected</span>
                    </div>
                    ${itemLines}${moreLabel}
                    <p style="font-size:.72rem;opacity:.55;text-align:center;margin:10px 0 0;"><i class="fas fa-arrow-right me-1"></i>Camera ready for next scan</p>
                </div>`, "rgba(5,50,36,.88)");
            _hideDetectOverlay(2800);

            overlayLabel.textContent = items[0].name;
            overlayLabel.classList.remove("hidden");
            setTimeout(() => overlayLabel.classList.add("hidden"), 8000);

            let itemsHTML = items.map((item, i) => `
                <div class="detected-item-card" style="animation-delay:${i * 0.1}s">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="rs-badge rs-badge-primary">#${i + 1}</span>
                        <span class="fw-semibold" style="color:var(--success);font-size:.78rem;">${Math.round((item.confidence || 0.9) * 100)}% match</span>
                    </div>
                    <div class="d-flex flex-column gap-2" style="font-size:.9rem;">
                        <div class="d-flex justify-content-between align-items-center">
                            <span style="color:var(--text-secondary);"><i class="fas fa-box me-1"></i>Product</span>
                            <span class="fw-semibold" style="color:var(--text-primary);">${item.name}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span style="color:var(--text-secondary);"><i class="fas fa-tag me-1"></i>Category</span>
                            <span style="color:var(--text-secondary);">${item.category}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center rounded-3 px-3 py-2"
                             style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);">
                            <span style="color:var(--text-secondary);"><i class="fas fa-indian-rupee-sign me-1"></i>Price</span>
                            <span class="fw-bold" style="color:var(--success);font-size:1.15rem;">₹${item.unit_price}</span>
                        </div>
                    </div>
                    <button class="btn-glow w-100 justify-content-center mt-3"
                            style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 12px rgba(16,185,129,.35);font-size:.88rem;"
                            data-did="${item.detection_id}"
                            data-name="${(item.name || '').replace(/"/g, '&quot;')}"
                            data-cat="${(item.category || '').replace(/"/g, '&quot;')}"
                            data-price="${item.unit_price}"
                            onclick="addToCartFromBtn(this)">
                        <i class="fas fa-cart-plus"></i> ${item.name} — ₹${item.unit_price}
                    </button>
                </div>`).join("");

            resultArea.innerHTML = `
                <div class="w-100">
                    <img src="/captured_images/${data.image_path}" class="w-100 rounded-3 mb-3" style="border:1px solid rgba(99,102,241,.12);max-height:220px;object-fit:cover;" alt="Captured">
                    <div class="rounded-3 p-3 mb-3" style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);">
                        <div class="d-flex align-items-center gap-2 fw-bold mb-2" style="color:var(--success);">
                            <i class="fas fa-check-circle"></i> ${totalItems} Product${totalItems > 1 ? 's' : ''} Detected
                        </div>
                        <div class="d-flex justify-content-between align-items-center pt-2" style="border-top:1px solid rgba(16,185,129,.15);">
                            <span style="color:var(--text-secondary);font-size:.82rem;"><i class="fas fa-clock me-1"></i>${data.timestamp}</span>
                            <span class="fw-bold" style="color:var(--success);font-size:1.2rem;">₹${subtotal}</span>
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-3">${itemsHTML}</div>
                    ${items.length > 0 ? `
                    <button class="btn-glow-primary w-100 justify-content-center mt-3 py-3"
                            style="background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 6px 20px rgba(99,102,241,.4);font-size:1rem;font-weight:700;"
                            onclick="addAllToCart(${JSON.stringify(items).replace(/"/g, '&quot;')})">
                        <i class="fas fa-cart-arrow-down me-2"></i>Add All to Cart — ₹${subtotal}
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
    }, "image/jpeg", 0.85); // end canvas.toBlob
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

// ========================
// ADD TO CART
// ========================
function addToCartFromBtn(btn) {
    addToCart(
        parseInt(btn.dataset.did) || 0,
        btn.dataset.name,
        btn.dataset.cat,
        parseFloat(btn.dataset.price) || 0
    );
}

function addToCart(detectionId, productName, category, price) {
    fetch("/api/add_to_cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection_id: detectionId, product_name: productName, category: category, price: price })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            showToast(`${productName} added to cart!`);
            updateCartCount();
            // Animate out and remove this item's card from Detection Results
            const btn = document.querySelector(`.detected-item-card [data-did="${detectionId}"]`);
            if (btn) {
                const card = btn.closest(".detected-item-card");
                if (card) {
                    card.style.transition = "opacity .3s, transform .3s";
                    card.style.opacity = "0";
                    card.style.transform = "translateX(40px)";
                    setTimeout(() => {
                        card.remove();
                        _checkDetectionEmpty();
                    }, 320);
                }
            }
        } else {
            showToast(d.error, "error");
        }
    })
    .catch(e => showToast("Error: " + e.message, "error"));
}

function _checkDetectionEmpty() {
    const resultArea = document.getElementById("result-area");
    if (!resultArea) return;
    const remaining = resultArea.querySelectorAll(".detected-item-card").length;
    if (remaining === 0) {
        // Replace with a "all added" message; keep the captured image if present
        const imgEl = resultArea.querySelector("img");
        const imgHTML = imgEl ? `<img src="${imgEl.src}" class="w-100 rounded-3 mb-3" style="${imgEl.getAttribute('style') || ''}" alt="Captured">` : "";
        resultArea.innerHTML = `
            <div class="w-100">
                ${imgHTML}
                <div class="text-center py-4">
                    <i class="fas fa-cart-check" style="font-size:2.5rem;color:var(--success);"></i>
                    <p class="fw-bold mt-3 mb-1" style="color:var(--success);">All items added to cart!</p>
                    <p class="small mb-0" style="color:var(--text-secondary);">Capture another image to scan more products</p>
                </div>
            </div>`;
    }
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
    Promise.all(promises).then(() => {
        showToast(`${added} item${added > 1 ? 's' : ''} added to cart!`);
        updateCartCount();
        // Clear detection results area
        const resultArea = document.getElementById("result-area");
        if (resultArea) {
            const imgEl = resultArea.querySelector("img");
            const imgHTML = imgEl ? `<img src="${imgEl.src}" class="w-100 rounded-3 mb-3" style="${imgEl.getAttribute('style') || ''}" alt="Captured">` : "";
            resultArea.innerHTML = `
                <div class="w-100">
                    ${imgHTML}
                    <div class="text-center py-4">
                        <i class="fas fa-cart-check" style="font-size:2.5rem;color:var(--success);"></i>
                        <p class="fw-bold mt-3 mb-1" style="color:var(--success);">All ${added} item${added > 1 ? 's' : ''} added to cart!</p>
                        <p class="small mb-0" style="color:var(--text-secondary);">Capture another image to scan more products</p>
                    </div>
                </div>`;
        }
    });
}

// Init — camera always starts inactive (browser getUserMedia)
updateCameraUI(false);
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
            <video id="fs-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;"></video>
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

    // Attach live stream to fullscreen video
    if (_mediaStream) document.getElementById("fs-video").srcObject = _mediaStream;
}

function closeFullscreenScan() {
    const overlay = document.getElementById("fullscreen-scan-overlay");
    if (overlay) overlay.remove();
}

function fsCapture() {
    const btn = document.getElementById("fs-capture-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    const fsVideo = document.getElementById("fs-video");
    const canvas  = document.getElementById("camera-canvas");
    if (fsVideo && fsVideo.videoWidth) {
        canvas.width  = fsVideo.videoWidth;
        canvas.height = fsVideo.videoHeight;
        canvas.getContext("2d").drawImage(fsVideo, 0, 0, canvas.width, canvas.height);
    }

    closeFullscreenScan();

    canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append("image", blob, "capture.jpg");

        fetch("/api/capture", { method: "POST", body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.items?.length) {
                    showToast(`✅ Detected ${data.total_items} item(s)!`, "success");
                    updateCartCount();
                } else {
                    showToast("No products detected", "warning");
                }
            })
            .catch(() => showToast("Capture failed", "error"));
    }, "image/jpeg", 0.85);
}
