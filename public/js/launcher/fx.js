/* Ὁρμή launcher — motion & effects.
   - One damped-spring integrator drives everything that follows a finger (pages, the drag ghost).
     Springs keep velocity, so a flick carries into the settle, and every animation can be grabbed
     mid-way: touching a moving page continues from exactly where it is.
   - CSS spring curves (linear() easing) are generated from the same physics for presses, sheets
     and folders, so small UI and big UI bounce the same way.
   - Effects: page transitions (jelly / depth / cube), icon press tilt with a light glare that follows
     the finger, trackpad hover parallax, dock magnification, launch pop, touch ripples and background
     parallax (drawn by bg.js).
   Battery: nothing here runs on its own. Work happens only while a finger or pointer is down, or for
   the half second an animation needs to settle. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const fx = {};
  const BOUNCE = { soft: 1, mid: 0.78, chewy: 0.64 };

  fx.pref = (k) => S()?.prefs?.fx?.[k];
  fx.reduced = () => H.reducedMotion();
  fx.on = (k) => !fx.reduced() && !!fx.pref(k);
  /* damping ratio for the chosen "쫀득함" (lower = more bounce) */
  fx.zeta = (extra = 0) => (fx.reduced() ? 1 : Math.max(0.3, Math.min(1, (BOUNCE[fx.pref("bounce")] ?? BOUNCE.mid) + extra)));
  fx.pageMode = () => (fx.reduced() ? "slide" : fx.pref("page") || "slide");

  /* ---------- spring ----------
     o: { from, to, v (units/s), k (stiffness), zeta, onUpdate(x, v), onDone() }
     Integrated in fixed 1/240 s steps, so it behaves the same at 60 Hz and 120 Hz. */
  fx.spring = (o) => {
    let x = o.from;
    let v = o.v || 0;
    let to = o.to;
    let raf = 0;
    let last = 0;
    let stopped = false;
    const k = o.k ?? 210;
    const c = 2 * Math.sqrt(k) * (o.zeta ?? fx.zeta());
    const restX = o.restX ?? 0.35;
    const restV = o.restV ?? 6;
    const step = (now) => {
      raf = 0;
      if (stopped) return;
      let dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      while (dt > 1e-6) {
        const h = Math.min(dt, 1 / 240);
        const a = -k * (x - to) - c * v;
        v += a * h;
        x += v * h;
        dt -= h;
      }
      const rest = Math.abs(v) < restV && Math.abs(x - to) < restX;
      if (rest) {
        x = to;
        v = 0;
      }
      o.onUpdate(x, v);
      if (rest) {
        stopped = true;
        o.onDone?.();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return {
      stop() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
      },
      get x() {
        return x;
      },
      get v() {
        return v;
      },
      retarget(t) {
        to = t;
      },
    };
  };

  /* ---------- CSS spring curves ---------- */
  const LINEAR_OK = !!window.CSS?.supports?.("transition-timing-function", "linear(0, 1)");
  fx.curve = (k, zeta) => {
    const c = 2 * Math.sqrt(k) * zeta;
    let x = 0;
    let v = 0;
    let t = 0;
    const dt = 1 / 600;
    const s = [[0, 0]];
    while (t < 2) {
      const a = -k * (x - 1) - c * v;
      v += a * dt;
      x += v * dt;
      t += dt;
      s.push([t, x]);
      if (t > 0.05 && Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
    }
    const N = 44;
    const pts = [];
    let j = 0;
    for (let i = 0; i <= N; i++) {
      const tt = (i / N) * t;
      while (j < s.length - 1 && s[j + 1][0] < tt) j++;
      pts.push(i === N ? 1 : +s[j][1].toFixed(4));
    }
    return { ease: `linear(${pts.join(", ")})`, ms: Math.round(t * 1000) };
  };
  fx.applyCurves = () => {
    const root = document.documentElement.style;
    const z = fx.zeta();
    const set = (name, k, zeta, fallback, fallbackMs) => {
      if (LINEAR_OK && !fx.reduced()) {
        const c = fx.curve(k, zeta);
        root.setProperty(`--ease-${name}`, c.ease);
        root.setProperty(`--${name}-ms`, c.ms + "ms");
      } else {
        root.setProperty(`--ease-${name}`, fallback);
        root.setProperty(`--${name}-ms`, fallbackMs);
      }
    };
    // icons popping back after a press: small, so they can bounce more
    set("pop", 430, Math.max(0.32, z - 0.24), "cubic-bezier(.34,1.56,.64,1)", "480ms");
    // sheets, folders, menus
    set("sheet", 260, Math.min(1, z + 0.06), "cubic-bezier(.22,1.2,.36,1)", "520ms");
    // dots, small indicators
    set("snap", 520, Math.max(0.42, z - 0.12), "cubic-bezier(.3,1.4,.5,1)", "360ms");
  };

  /* ---------- press: squish + tilt toward the finger + glare ---------- */
  const PRESSABLE = ".tile.app, .tile.folder, .tile.widget, .dock-lib";
  let pressEl = null;
  let pressId = null;
  let p0 = [0, 0];
  let pend = null;
  let praf = 0;
  let hoverEl = null;

  function tiltVars(el, x, y) {
    const t = el.querySelector(".icon, .wg") || el;
    const r = t.getBoundingClientRect();
    if (!r.width) return;
    const tx = Math.max(-1, Math.min(1, ((x - r.left) / r.width) * 2 - 1));
    const ty = Math.max(-1, Math.min(1, ((y - r.top) / r.height) * 2 - 1));
    el.style.setProperty("--tx", tx.toFixed(3));
    el.style.setProperty("--ty", ty.toFixed(3));
  }
  function release() {
    if (!pressEl) return;
    pressEl.classList.remove("pressing");
    pressEl = null;
    pressId = null;
  }
  fx.releasePress = release;
  function onDown(e) {
    if (e.button !== 0) return;
    const t = e.target.closest(PRESSABLE);
    if (!t || t.closest(".sheet-layer, #drag-layer") || e.target.closest("[data-badge], [data-act], input, textarea, select")) return;
    release();
    pressEl = t;
    pressId = e.pointerId;
    p0 = [e.clientX, e.clientY];
    tiltVars(t, e.clientX, e.clientY);
    t.classList.add("pressing");
    if (t.closest("#dock")) dockStart(e);
  }
  function onMove(e) {
    if (pressEl && e.pointerId === pressId) {
      // moved away (a swipe, a scroll, sliding along the dock): let the icon spring back
      if (Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) > 14) release();
      else {
        pend = [e.clientX, e.clientY];
        if (!praf)
          praf = requestAnimationFrame(() => {
            praf = 0;
            if (pressEl && pend) tiltVars(pressEl, pend[0], pend[1]);
          });
      }
    } else if (e.pointerType === "mouse" && !e.buttons) hover(e);
    if (dock.active && e.pointerId === dock.id) dockMove(e.clientX);
    else if (!dock.active && (e.pointerType === "mouse" || e.pointerType === "pen") && !e.buttons) {
      const over = e.target.closest?.("#dock");
      if (over) dockHover(e);
      else if (dock.hover) dockEnd();
    }
  }
  function onUp(e) {
    if (e.pointerId === pressId) release();
    if (dock.active && e.pointerId === dock.id) dockEnd();
  }

  /* trackpad / mouse: icons lean toward the cursor (Apple TV style) */
  function hover(e) {
    const t = fx.on("tilt") && !document.body.classList.contains("editing") ? e.target.closest?.(".tile.app, .tile.folder") : null;
    if (t !== hoverEl) {
      hoverEl?.classList.remove("hovering");
      hoverEl = t && !t.closest(".sheet-layer, #drag-layer") ? t : null;
      hoverEl?.classList.add("hovering");
    }
    if (hoverEl) {
      pend = [e.clientX, e.clientY];
      if (!praf)
        praf = requestAnimationFrame(() => {
          praf = 0;
          if (hoverEl && pend) tiltVars(hoverEl, pend[0], pend[1]);
        });
    }
  }

  /* ---------- dock magnification ---------- */
  const dock = { active: false, hover: false, id: null, items: [], rects: [] };
  function dockItems() {
    const d = H.$("#dock");
    return d ? [...d.querySelectorAll(".dock-apps .tile, .dock-lib")].filter((el) => el.offsetParent) : [];
  }
  function dockPrepare() {
    dock.items = dockItems();
    dock.items.forEach((el) => (el.style.transform = ""));
    dock.rects = dock.items.map((el) => el.getBoundingClientRect());
    H.$("#dock")?.classList.add("magnifying");
  }
  function dockMove(x) {
    if (!dock.items.length) return;
    const size = dock.rects[0].width || 56;
    dock.items.forEach((el, i) => {
      const r = dock.rects[i];
      const d = (x - (r.left + r.width / 2)) / (size * 1.3);
      const s = 1 + 0.36 * Math.exp(-d * d);
      el.style.transform = s > 1.004 ? `translateY(${(-(s - 1) * size * 0.62).toFixed(2)}px) scale(${s.toFixed(4)})` : "";
    });
  }
  function dockStart(e) {
    if (!fx.on("magnify") || document.body.classList.contains("editing") || document.body.classList.contains("dragging")) return;
    dock.active = true;
    dock.id = e.pointerId;
    dockPrepare();
    dockMove(e.clientX);
  }
  function dockHover(e) {
    if (!fx.on("magnify") || document.body.classList.contains("editing")) return;
    if (!dock.hover) {
      dock.hover = true;
      dockPrepare();
    }
    dockMove(e.clientX);
  }
  function dockEnd() {
    dock.active = false;
    dock.hover = false;
    dock.id = null;
    H.$("#dock")?.classList.remove("magnifying");
    dock.items.forEach((el) => (el.style.transform = ""));
    dock.items = [];
  }

  /* ---------- launch pop ---------- */
  fx.launch = (tile) => {
    if (!tile || fx.reduced()) return;
    release();
    tile.classList.remove("launching");
    void tile.offsetWidth;
    tile.classList.add("launching");
    setTimeout(() => tile.classList.remove("launching"), 700);
    const r = (tile.querySelector(".icon") || tile).getBoundingClientRect();
    H.bg?.touch(r.left + r.width / 2, r.top + r.height / 2, 1.8);
  };

  /* ---------- page transitions ---------- */
  let styled = new Set();
  fx.measureCols = () => {
    H.$$(".page.home > .grid").forEach((grid) => {
      const g = grid.getBoundingClientRect();
      if (!g.width) return;
      grid.querySelectorAll(":scope > .tile").forEach((t) => {
        const cx = (t.offsetLeft + t.offsetWidth / 2) / g.width;
        const cl = Math.max(0, Math.min(1, cx));
        t.style.setProperty("--cl", cl.toFixed(3));
        t.style.setProperty("--cr", (1 - cl).toFixed(3));
      });
    });
  };
  /* x = track position (px), v = its velocity (px/s) */
  fx.pageFx = (x, v, w) => {
    H.bg?.parallax(x, w);
    const mode = fx.pageMode();
    if (mode === "slide") return;
    const pages = H.$$("#track > .page");
    const jx = mode === "jelly" ? Math.max(-38, Math.min(38, -v * 0.02)) : 0;
    pages.forEach((pg, i) => {
      const p = (i * w + x) / w; // 0 = centred, ±1 = one screen away
      const ap = Math.abs(p);
      if (ap >= 0.999) {
        if (styled.has(pg)) clearPage(pg);
        return;
      }
      styled.add(pg);
      if (mode === "jelly") {
        const grid = pg.firstElementChild;
        if (grid) {
          grid.style.setProperty("--jxp", Math.max(0, jx).toFixed(2) + "px");
          grid.style.setProperty("--jxn", Math.min(0, jx).toFixed(2) + "px");
        }
      } else if (mode === "depth") {
        pg.style.transformOrigin = "50% 50%";
        pg.style.transform = `perspective(1600px) rotateY(${(p * -22).toFixed(2)}deg) scale(${(1 - ap * 0.16).toFixed(4)})`;
        pg.style.opacity = (1 - ap * 0.55).toFixed(3);
      } else if (mode === "cube") {
        pg.style.transformOrigin = p > 0 ? "0% 50%" : "100% 50%";
        pg.style.transform = `perspective(1300px) rotateY(${(p * 90).toFixed(2)}deg)`;
        pg.style.opacity = (1 - Math.max(0, ap - 0.6) * 1.2).toFixed(3);
      }
    });
  };
  function clearPage(pg) {
    styled.delete(pg);
    pg.style.transform = "";
    pg.style.opacity = "";
    pg.style.transformOrigin = "";
    const grid = pg.firstElementChild;
    grid?.style.removeProperty("--jxp");
    grid?.style.removeProperty("--jxn");
  }
  fx.pageRest = () => {
    styled.forEach(clearPage);
    styled = new Set();
  };

  fx.init = () => {
    fx.applyCurves();
    const opt = { passive: true, capture: true };
    document.addEventListener("pointerdown", onDown, opt);
    document.addEventListener("pointermove", onMove, opt);
    document.addEventListener("pointerup", onUp, opt);
    document.addEventListener("pointercancel", onUp, opt);
    document.addEventListener("pointerleave", () => {
      hoverEl?.classList.remove("hovering");
      hoverEl = null;
      if (dock.hover) dockEnd();
    });
    window.addEventListener("blur", () => {
      release();
      if (dock.active || dock.hover) dockEnd();
    });
    H.listen("change", () => {
      const f = S().prefs.fx;
      const sig = `${f.bounce}`;
      if (sig !== fx._sig) {
        fx._sig = sig;
        fx.applyCurves();
      }
      document.body.classList.toggle("fx-tilt", fx.on("tilt"));
      document.body.dataset.pagefx = fx.pageMode();
    });
    fx._sig = `${S().prefs.fx.bounce}`;
    document.body.classList.toggle("fx-tilt", fx.on("tilt"));
    document.body.dataset.pagefx = fx.pageMode();
    window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", fx.applyCurves);
  };

  H.fx = fx;
})();
