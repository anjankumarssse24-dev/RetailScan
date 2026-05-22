/**
 * confetti.js — Canvas confetti burst for tier unlocks & big moments
 *
 * API:
 *   Confetti.burst()              — one full burst from centre
 *   Confetti.burst({ origin })    — custom origin {x,y} in 0–1 fractions
 *   Confetti.rain()               — continuous gentle rain for 3s
 */
(function () {
    "use strict";

    const COLORS = [
        "#6366f1", "#8b5cf6", "#06b6d4", "#10b981",
        "#f59e0b", "#ef4444", "#ec4899", "#f97316",
        "#a78bfa", "#67e8f9", "#6ee7b7", "#fde68a",
    ];

    class Particle {
        constructor(x, y) {
            this.x  = x;
            this.y  = y;
            this.vx = (Math.random() - 0.5) * 14;
            this.vy = (Math.random() - 1.5) * 12;
            this.ax = 0;
            this.ay = 0.35;          // gravity
            this.color  = COLORS[Math.floor(Math.random() * COLORS.length)];
            this.width  = Math.random() * 8 + 4;
            this.height = Math.random() * 5 + 3;
            this.rotation = Math.random() * 360;
            this.spin     = (Math.random() - 0.5) * 10;
            this.alpha    = 1;
            this.decay    = Math.random() * 0.012 + 0.008;
            this.shape    = Math.random() > 0.4 ? "rect" : "circle";
        }
        update() {
            this.vx += this.ax;
            this.vy += this.ay;
            this.x  += this.vx;
            this.y  += this.vy;
            this.rotation += this.spin;
            this.alpha     = Math.max(0, this.alpha - this.decay);
        }
        draw(ctx) {
            if (this.alpha <= 0) return;
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle   = this.color;
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate((this.rotation * Math.PI) / 180);
            if (this.shape === "circle") {
                ctx.beginPath();
                ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            }
            ctx.restore();
        }
        get dead() { return this.alpha <= 0; }
    }

    // ── Canvas setup ─────────────────────────────────────────────
    let _canvas = null;
    let _ctx    = null;
    let _rafId  = null;
    let _particles = [];

    function _ensureCanvas() {
        if (_canvas) return;
        _canvas = document.createElement("canvas");
        _canvas.id = "rs-confetti-canvas";
        Object.assign(_canvas.style, {
            position:      "fixed",
            top:           "0",
            left:          "0",
            width:         "100%",
            height:        "100%",
            pointerEvents: "none",
            zIndex:        "99990",
        });
        document.body.appendChild(_canvas);
        _ctx = _canvas.getContext("2d");
        _resize();
        window.addEventListener("resize", _resize);
    }

    function _resize() {
        if (!_canvas) return;
        _canvas.width  = window.innerWidth;
        _canvas.height = window.innerHeight;
    }

    function _loop() {
        if (!_ctx) return;
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

        _particles = _particles.filter(p => !p.dead);
        _particles.forEach(p => { p.update(); p.draw(_ctx); });

        if (_particles.length > 0) {
            _rafId = requestAnimationFrame(_loop);
        } else {
            cancelAnimationFrame(_rafId);
            _rafId = null;
            // Remove canvas after animation
            if (_canvas) { _canvas.remove(); _canvas = null; _ctx = null; }
        }
    }

    function _spawn(x, y, count) {
        _ensureCanvas();
        for (let i = 0; i < count; i++) {
            _particles.push(new Particle(x, y));
        }
        if (!_rafId) _rafId = requestAnimationFrame(_loop);
    }

    // ── Public API ───────────────────────────────────────────────
    const Confetti = {
        /**
         * Single burst.
         * @param {object} [opts]
         * @param {object} [opts.origin] - {x, y} fractions (0–1), default centre
         * @param {number} [opts.count]  - particle count, default 110
         */
        burst(opts = {}) {
            const W  = window.innerWidth;
            const H  = window.innerHeight;
            const ox = (opts.origin?.x ?? 0.5) * W;
            const oy = (opts.origin?.y ?? 0.38) * H;
            _spawn(ox, oy, opts.count ?? 110);
        },

        /**
         * Gentle continuous rain for `duration` ms.
         * @param {number} [duration=3000]
         */
        rain(duration = 3000) {
            _ensureCanvas();
            const W   = window.innerWidth;
            const end = Date.now() + duration;

            function _drop() {
                if (Date.now() < end) {
                    _spawn(Math.random() * W, -10, 3);
                    setTimeout(_drop, 60);
                }
            }
            _drop();
        },
    };

    window.Confetti = Confetti;
})();
