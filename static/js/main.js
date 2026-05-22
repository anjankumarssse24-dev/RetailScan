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
        ph.classList.add("hidden");
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
        ph.classList.remove("hidden");
        if (scanLine) scanLine.classList.add("hidden");
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

    // Check browser support first
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        showToast("❌ Camera not supported. Open the app over HTTPS in Chrome or Safari.", "error", 7000);
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        _mediaStream = stream;
        const feed = document.getElementById("camera-feed");
        feed.srcObject = stream;
        // Explicitly play — required on some mobile browsers
        feed.onloadedmetadata = () => feed.play().catch(() => {});
        updateCameraUI(true);
        showToast("Camera started", "success");
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play text-xs"></i> Start';
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            showToast("🚫 Camera permission denied. Tap the camera icon in the address bar and allow access.", "error", 7000);
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            showToast("📷 No camera found on this device.", "error", 6000);
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            showToast("📷 Camera is busy — close other apps using the camera and retry.", "error", 5000);
        } else if (err.name === "OverconstrainedError") {
            // Retry without constraints
            try {
                const stream2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                _mediaStream = stream2;
                document.getElementById("camera-feed").srcObject = stream2;
                updateCameraUI(true);
                showToast("Camera started", "success");
            } catch(e2) {
                showToast("Could not start camera: " + (e2.message || e2.name), "error", 5000);
            }
        } else {
            showToast("Camera error: " + (err.message || err.name), "error", 5000);
        }
    }
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

    // Show inline processing animation (like payment processing)
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
