/**
 * loader.js — RetailScan Global Top Loading Bar
 *
 * Provides a slim, animated progress bar at the top of every page
 * during fetch calls, page navigations, and long operations.
 *
 * API (available globally):
 *   Loader.start()          — show and begin infinite crawl
 *   Loader.done()           — complete and fade out
 *   Loader.fail()           — flash red and fade out
 *   Loader.set(pct)         — set exact % (0–100)
 *   Loader.wrapFetch(fn)    — wrap an async fn with auto start/done/fail
 */

(function () {
    "use strict";

    const BAR_ID = "rs-top-loader";

    // ── Build element once ─────────────────────────────────────
    function _getBar() {
        let el = document.getElementById(BAR_ID);
        if (!el) {
            el = document.createElement("div");
            el.id = BAR_ID;
            el.innerHTML = `<div class="rs-loader-fill"></div>`;
            document.body.appendChild(el);
        }
        return el;
    }

    let _timer    = null;
    let _current  = 0;
    let _active   = false;
    let _callCount = 0;    // reference-count concurrent calls

    function _setWidth(el, pct) {
        const fill = el.querySelector(".rs-loader-fill");
        if (fill) fill.style.width = pct + "%";
    }

    // ── Trickle: creep toward 90% while waiting ────────────────
    function _startTrickle(el) {
        clearInterval(_timer);
        _timer = setInterval(() => {
            if (_current < 85) {
                const step = _current < 50 ? 5 : _current < 75 ? 2 : 0.5;
                _current = Math.min(85, _current + step);
                _setWidth(el, _current);
            }
        }, 250);
    }

    const Loader = {
        start() {
            _callCount++;
            const el = _getBar();
            if (!_active) {
                _active  = true;
                _current = 0;
                el.classList.remove("rs-loader-done", "rs-loader-fail");
                el.classList.add("rs-loader-active");
                _setWidth(el, 5);
            }
            _startTrickle(el);
            return this;
        },

        set(pct) {
            const el = _getBar();
            _current = Math.max(0, Math.min(100, pct));
            _setWidth(el, _current);
            return this;
        },

        done() {
            _callCount = Math.max(0, _callCount - 1);
            if (_callCount > 0) return this;  // other calls still in flight

            clearInterval(_timer);
            const el = _getBar();
            _current = 100;
            _setWidth(el, 100);

            el.classList.remove("rs-loader-fail");
            el.classList.add("rs-loader-done");

            setTimeout(() => {
                el.classList.remove("rs-loader-active", "rs-loader-done");
                _setWidth(el, 0);
                _active   = false;
                _current  = 0;
                _callCount = 0;
            }, 400);
            return this;
        },

        fail() {
            _callCount = 0;
            clearInterval(_timer);
            const el = _getBar();
            _current = 100;
            _setWidth(el, 100);
            el.classList.remove("rs-loader-done");
            el.classList.add("rs-loader-fail");

            setTimeout(() => {
                el.classList.remove("rs-loader-active", "rs-loader-fail");
                _setWidth(el, 0);
                _active   = false;
                _current  = 0;
            }, 600);
            return this;
        },

        /**
         * Wrap an async function with automatic loader start/done/fail.
         * Returns the result of fn (or re-throws on error).
         */
        async wrapFetch(fn) {
            this.start();
            try {
                const result = await fn();
                this.done();
                return result;
            } catch (e) {
                this.fail();
                throw e;
            }
        },
    };

    // ── Auto-intercept all fetch() calls ───────────────────────
    const _origFetch = window.fetch;
    window.fetch = function (...args) {
        Loader.start();
        return _origFetch.apply(this, args).then(
            res  => { Loader.done(); return res; },
            err  => { Loader.fail(); return Promise.reject(err); }
        );
    };

    // ── Page navigation (classic links) ───────────────────────
    window.addEventListener("beforeunload", () => {
        Loader.start();
        // Will be cleared naturally when new page loads
    });

    // ── Expose globally ────────────────────────────────────────
    window.Loader = Loader;

})();
