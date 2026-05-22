/**
 * admin-heatmap.js — Step 9: Store Heatmap Analytics
 *
 * Features:
 *  • heatmap.js canvas rendered over the store floor plan grid
 *  • Time-filter pills (today / week / month / all)
 *  • Category filter dropdown
 *  • Zone breakdown bars + comparison table
 *  • Hourly activity CSS bar chart
 *  • AI-style insight list
 *  • Live Simulation: random Gaussian points injected every 300ms
 */

"use strict";

// ─── State ─────────────────────────────────────────────────────
let _hm        = null;   // heatmap.js instance
let _liveTimer = null;   // setInterval handle
let _liveOn    = false;
let _curFilter = "week";
let _curCat    = "";
let _zonesMeta = {};     // zone metadata from API

// Typical retail traffic weights for live sim (must sum to ~100)
const LIVE_ZONE_WEIGHTS = {
    entrance:   12,
    checkout:   10,
    snacks:     22,
    beverages:  18,
    essentials: 14,
    dairy:      12,
    offers:     12,
};

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    _initHeatmap();
    loadHeatmapData(_curFilter, _curCat);
    _updateActiveLink();
});

function _updateActiveLink() {
    document.querySelectorAll(".rs-sidebar-link").forEach(el => el.classList.remove("active"));
    const hm = document.getElementById("nav-heatmap");
    if (hm) hm.classList.add("active");
}

// ─── heatmap.js instance ────────────────────────────────────────
function _initHeatmap() {
    const container = document.getElementById("heatmap-container");
    if (!container || typeof h337 === "undefined") {
        console.warn("heatmap.js not loaded");
        return;
    }
    _hm = h337.create({
        container:  container,
        radius:     55,
        maxOpacity: 0.72,
        minOpacity: 0,
        blur:       0.82,
        gradient: {
            "0.0": "rgba(59,130,246,0)",
            "0.2": "#3b82f6",
            "0.45":"#10b981",
            "0.65":"#f59e0b",
            "0.85":"#ef4444",
            "1.0": "#7f1d1d",
        },
    });
    // Ensure the internal canvas fills the container
    const canvas = container.querySelector("canvas");
    if (canvas) {
        canvas.style.width  = "600px";
        canvas.style.height = "460px";
        canvas.style.position = "absolute";
        canvas.style.top  = "0";
        canvas.style.left = "0";
    }
}

// ─── Data Load ──────────────────────────────────────────────────
function loadHeatmapData(filter, category) {
    let url = `/admin/api/heatmap?filter=${encodeURIComponent(filter)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;

    fetch(url, { credentials: "same-origin" })
        .then(r => r.json())
        .then(data => {
            if (!data.success) { console.error("Heatmap API error", data); return; }
            _zonesMeta = data.zones_meta || {};
            _renderHeatmapPoints(data.points || []);
            _renderKPICards(data);
            _renderZoneBreakdown(data.zone_data || []);
            _renderHourlyChart(data.hourly_data || []);
            _renderInsights(data.insights || []);
            _renderZoneTable(data.zone_data || []);
            _updateZoneBadges(data.zone_data || []);
            _showBaselineBadge(data.is_baseline);
        })
        .catch(err => console.error("loadHeatmapData:", err));
}

// ─── Heatmap Points ─────────────────────────────────────────────
function _renderHeatmapPoints(points) {
    if (!_hm) return;
    // Find max value for normalisation
    const maxVal = points.reduce((m, p) => Math.max(m, p.value), 0.01);
    _hm.setData({ max: maxVal, data: points });
}

function _addLivePoint(x, y, value) {
    if (!_hm) return;
    _hm.addData({ x, y, value });
}

// ─── KPI Cards ──────────────────────────────────────────────────
function _renderKPICards(data) {
    _setText("kpi-top-zone",  data.peak_zone_label || "—");
    _setText("kpi-peak-hour", data.peak_hour        || "—");
    _setText("kpi-total",     _fmt(data.total_activity));
    _setText("kpi-checkout",  _fmt(data.checkout_count));
}

// ─── Zone Breakdown Bars ────────────────────────────────────────
function _renderZoneBreakdown(zoneData) {
    const el = document.getElementById("zone-breakdown-list");
    if (!el) return;
    if (!zoneData.length) {
        el.innerHTML = `<p class="text-muted rs-text-xs text-center py-2">No zone data yet.</p>`;
        return;
    }
    el.innerHTML = zoneData.slice(0, 7).map((z, i) => `
        <div class="d-flex flex-column gap-1">
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <span style="display:inline-flex;align-items:center;justify-content:center;
                                 width:24px;height:24px;border-radius:8px;
                                 background:${z.color}22;color:${z.color};font-size:.72rem;">
                        <i class="fas ${z.icon}"></i>
                    </span>
                    <span style="font-size:.8rem;font-weight:600;color:var(--text-primary);">${z.label}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span style="font-size:.75rem;color:var(--text-secondary);">${z.pct}%</span>
                    <span style="font-size:.78rem;font-weight:700;color:${z.color};">${_fmt(z.count)}</span>
                </div>
            </div>
            <div class="zone-analytics-bar">
                <div class="zone-analytics-fill"
                     style="width:${Math.round(z.intensity*100)}%;background:${z.color};"
                     data-target="${Math.round(z.intensity*100)}"></div>
            </div>
        </div>
    `).join("");

    // Animate bars from 0 → target
    requestAnimationFrame(() => {
        el.querySelectorAll(".zone-analytics-fill").forEach(bar => {
            const t = bar.dataset.target;
            bar.style.width = "0%";
            requestAnimationFrame(() => { bar.style.width = t + "%"; });
        });
    });
}

// ─── Zone Count Badges on floor plan ────────────────────────────
function _updateZoneBadges(zoneData) {
    zoneData.forEach(z => {
        const badge = document.getElementById(`zbadge-${z.zone}`);
        if (badge) badge.textContent = _fmt(z.count);
    });
}

// ─── Hourly Activity CSS Bar Chart ─────────────────────────────
function _renderHourlyChart(hourlyData) {
    const chart  = document.getElementById("hourly-chart");
    const labels = document.getElementById("hourly-labels");
    if (!chart) return;

    const maxCount = Math.max(...hourlyData.map(h => h.count), 1);
    const peakHour = hourlyData.reduce((best, h) =>
        h.count > (best ? best.count : 0) ? h : best, null);

    chart.innerHTML = hourlyData.map(h => {
        const pct    = Math.round((h.count / maxCount) * 100);
        const isPeak = peakHour && h.hour === peakHour.hour && h.count > 0;
        return `
            <div class="hourly-bar-col" title="${h.label}: ${h.count} scans">
                <div class="hourly-bar ${isPeak ? "peak" : ""}"
                     style="height:${Math.max(pct, 2)}%;"></div>
            </div>`;
    }).join("");

    // Labels every 3 hours
    if (labels) {
        labels.innerHTML = hourlyData.map((h, i) =>
            `<span style="flex:1;text-align:center;">${i % 3 === 0 ? h.hour : ""}</span>`
        ).join("");
    }

    // Peak badge
    if (peakHour && peakHour.count > 0) {
        const ph = document.getElementById("peak-hour-badge");
        if (ph) {
            ph.textContent = `Peak: ${peakHour.label}`;
            ph.classList.remove("hidden");
        }
    }
}

// ─── Insights ──────────────────────────────────────────────────
function _renderInsights(insights) {
    const el = document.getElementById("insights-list");
    if (!el) return;
    if (!insights.length) {
        el.innerHTML = `<p class="text-muted rs-text-xs text-center py-2">No insights yet.</p>`;
        return;
    }
    el.innerHTML = insights.map(insight => `
        <div class="heatmap-insight-row">${_escHtml(insight)}</div>
    `).join("");
}

// ─── Zone Comparison Table ──────────────────────────────────────
function _renderZoneTable(zoneData) {
    const tbody = document.getElementById("zone-table-body");
    if (!tbody) return;
    if (!zoneData.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-muted">No data</td></tr>`;
        return;
    }
    const medals = ["🥇","🥈","🥉"];
    tbody.innerHTML = zoneData.map((z, i) => `
        <tr style="border-bottom:1px solid rgba(99,102,241,.06);">
            <td class="py-2">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                    <span style="width:10px;height:10px;border-radius:50%;
                                 display:inline-block;background:${z.color};"></span>
                    <span style="font-weight:600;color:var(--text-primary);">${z.label}</span>
                </span>
            </td>
            <td class="py-2 text-end" style="font-weight:700;color:${z.color};">${_fmt(z.count)}</td>
            <td class="py-2 text-end" style="color:var(--text-secondary);">${z.pct}%</td>
            <td class="py-2 text-end">${medals[i] || "#" + (i+1)}</td>
        </tr>
    `).join("");
}

// ─── Baseline badge ─────────────────────────────────────────────
function _showBaselineBadge(isBaseline) {
    const el = document.getElementById("baseline-badge");
    if (!el) return;
    el.classList.toggle("hidden", !isBaseline);
}

// ─── Filter Controls ────────────────────────────────────────────
function setFilter(filter, btn) {
    _curFilter = filter;
    document.querySelectorAll(".hm-filter-btn[data-filter]").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    if (!_liveOn) loadHeatmapData(_curFilter, _curCat);
}

function setCategoryFilter(value) {
    _curCat = value;
    if (!_liveOn) loadHeatmapData(_curFilter, _curCat);
}

// ─── Live Simulation ────────────────────────────────────────────
const ZONE_CENTERS = {
    entrance:   { cx: 300, cy: 425 },
    checkout:   { cx: 300, cy: 58  },
    snacks:     { cx: 90,  cy: 270 },
    beverages:  { cx: 510, cy: 270 },
    essentials: { cx: 90,  cy: 135 },
    dairy:      { cx: 510, cy: 135 },
    offers:     { cx: 300, cy: 250 },
};

function _weightedRandomZone() {
    const total  = Object.values(LIVE_ZONE_WEIGHTS).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [zone, weight] of Object.entries(LIVE_ZONE_WEIGHTS)) {
        roll -= weight;
        if (roll <= 0) return zone;
    }
    return "snacks";
}

function _gaussRand() {
    // Box-Muller transform
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function _randomPointNearZone(zoneName) {
    const z   = ZONE_CENTERS[zoneName] || ZONE_CENTERS.entrance;
    const spread = 45;
    const x   = Math.round(Math.max(8, Math.min(592, z.cx + _gaussRand() * spread * 0.5)));
    const y   = Math.round(Math.max(8, Math.min(452, z.cy + _gaussRand() * spread * 0.5)));
    const val = parseFloat((Math.random() * 0.5 + 0.4).toFixed(3));
    return { x, y, value: val, zone: zoneName };
}

function startLiveSimulation() {
    _liveOn = true;
    const btn = document.getElementById("btn-live-sim");
    if (btn) {
        btn.innerHTML = `<i class="fas fa-stop me-1"></i>Stop Sim`;
        btn.style.background = "rgba(239,68,68,.12)";
    }
    const badge = document.getElementById("live-badge-wrap");
    if (badge) badge.classList.remove("hidden");

    // Clear existing heat for fresh live view
    if (_hm) _hm.setData({ max: 1, data: [] });

    const zoneCounts = {};
    _liveTimer = setInterval(() => {
        const zoneName = _weightedRandomZone();
        const pt = _randomPointNearZone(zoneName);
        _addLivePoint(pt.x, pt.y, pt.value);

        // Pulse the zone cell
        const cell = document.querySelector(`.zone-cell.${zoneName}`);
        if (cell) {
            cell.classList.remove("zone-active");
            void cell.offsetWidth; // reflow to restart animation
            cell.classList.add("zone-active");
        }

        // Update badge counts
        zoneCounts[zoneName] = (zoneCounts[zoneName] || 0) + 1;
        const badge = document.getElementById(`zbadge-${zoneName}`);
        if (badge) badge.textContent = _fmt(zoneCounts[zoneName]);
    }, 300);
}

function stopLiveSimulation() {
    _liveOn = false;
    clearInterval(_liveTimer);
    _liveTimer = null;

    const btn = document.getElementById("btn-live-sim");
    if (btn) {
        btn.innerHTML = `<i class="fas fa-play me-1"></i>Live Sim`;
        btn.style.background = "";
    }
    const badge = document.getElementById("live-badge-wrap");
    if (badge) badge.classList.add("hidden");

    // Reload real data after stopping simulation
    loadHeatmapData(_curFilter, _curCat);
}

function toggleLiveSim() {
    _liveOn ? stopLiveSimulation() : startLiveSimulation();
}

// ─── Utilities ──────────────────────────────────────────────────
function _fmt(n) {
    if (n === null || n === undefined) return "0";
    return Number(n).toLocaleString();
}

function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function _escHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
