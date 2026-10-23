/* Ὁρμή launcher — page swiping that follows the finger, trackpad/mouse-wheel paging, dots. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const pager = { index: 0, locked: false };
  let consumed = false;
  let g = null; // active gesture

  const viewport = () => H.$("#viewport");
  const track = () => H.$("#track");
  const width = () => viewport().clientWidth || window.innerWidth;
  pager.count = () => S().pages.length + 1;
  pager.libraryIndex = () => S().pages.length;
  pager.consumedClick = () => {
    const c = consumed;
    consumed = false;
    return c;
  };

  function setX(px, animate) {
    const tr = track();
    tr.classList.toggle("animating", !!animate);
    tr.style.transform = `translate3d(${px}px,0,0)`;
  }

  /* How many icon rows fit on one screen → --rows (rows then stretch evenly). */
  pager.measure = () => {
    const page = H.$(".page.home");
    const grid = page && H.$(".grid", page);
    if (!grid) return;
    const cs = getComputedStyle(grid);
    const ps = getComputedStyle(page);
    const row = parseFloat(cs.gridAutoRows) || 100;
    const gap = parseFloat(cs.rowGap) || 16;
    const avail = page.clientHeight - parseFloat(ps.paddingTop) - parseFloat(ps.paddingBottom);
    const rows = Math.max(1, Math.floor((avail + gap) / (row + gap)));
    document.body.style.setProperty("--rows", rows);
  };

  pager.layout = () => {
    pager.measure();
    pager.index = H.clamp(S().page, 0, pager.count() - 1);
    setX(-pager.index * width(), false);
    markActive();
  };

  function markActive() {
    H.$$("#dots .dot").forEach((d) => d.classList.toggle("on", Number(d.dataset.jump) === pager.index));
    H.$$("#track > .page").forEach((p, i) => {
      p.toggleAttribute("inert", i !== pager.index && !document.body.classList.contains("dragging"));
      p.setAttribute("aria-hidden", String(i !== pager.index));
    });
    document.body.classList.toggle("on-library", pager.index === pager.libraryIndex());
  }

  pager.go = (i, { animate = true } = {}) => {
    const max = pager.locked ? S().pages.length - 1 : pager.count() - 1;
    const next = H.clamp(i, 0, max);
    const changed = next !== pager.index;
    pager.index = next;
    setX(-next * width(), animate && !H.reducedMotion());
    if (S().page !== next) {
      S().page = next;
      H.store.save();
    }
    markActive();
    if (changed) H.emit("page", next);
    return changed;
  };
  /* Abort a swipe in progress (e.g. a long-press turned into an icon drag). */
  pager.cancelGesture = () => {
    if (!g) return;
    const wasX = g.dir === "x";
    g = null;
    document.body.classList.remove("swiping");
    if (wasX) setX(-pager.index * width(), true);
    setTimeout(() => (consumed = false), 50);
  };
  pager.next = () => pager.go(pager.index + 1);
  pager.prev = () => pager.go(pager.index - 1);
  pager.lock = (on) => {
    pager.locked = on;
    if (!on) markActive();
  };

  /* ---------- touch / pen / mouse swipe ---------- */
  function onDown(e) {
    if (e.button !== 0 || g || H.ui.isOpen()) return;
    if (e.target.closest("input, textarea, select, .ctx-menu, [data-noswipe]")) return;
    if (H.home.editing && e.target.closest(".tile")) return; // tiles are dragged in edit mode
    if (e.pointerType === "mouse" && e.target.closest(".tile, button, a")) return; // mouse: swipe only on empty space
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: performance.now(), dir: null, hist: [] };
  }
  function onMove(e) {
    if (!g || e.pointerId !== g.id) return;
    if (H.drag?.active() || H.ui.menuOpen()) {
      pager.cancelGesture();
      return;
    }
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.dir) {
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
      g.dir = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
      if (g.dir === "y") {
        g = null;
        return;
      }
      try {
        viewport().setPointerCapture(e.pointerId);
      } catch (err) {}
      consumed = true;
      document.body.classList.add("swiping");
    }
    g.x = e.clientX;
    g.hist.push([performance.now(), e.clientX]);
    if (g.hist.length > 6) g.hist.shift();
    const w = width();
    let off = dx;
    const atStart = pager.index === 0 && dx > 0;
    const atEnd = pager.index === pager.count() - 1 && dx < 0;
    if (atStart || atEnd) off = dx * 0.32; // rubber band
    setX(-pager.index * w + off, false);
  }
  function onUp(e) {
    if (!g || e.pointerId !== g.id) return;
    const gesture = g;
    g = null;
    document.body.classList.remove("swiping");
    if (gesture.dir !== "x") return;
    const dx = gesture.x - gesture.x0;
    const h = gesture.hist;
    let v = 0;
    if (h.length > 1) v = (h[h.length - 1][1] - h[0][1]) / Math.max(1, h[h.length - 1][0] - h[0][0]);
    const w = width();
    let target = pager.index;
    if (Math.abs(dx) > w * 0.22 || Math.abs(v) > 0.45) target += dx < 0 ? 1 : -1;
    if (!pager.go(target)) setX(-pager.index * w, true);
    setTimeout(() => (consumed = false), 400);
  }
  function onCancel(e) {
    if (!g || e.pointerId !== g.id) return;
    g = null;
    document.body.classList.remove("swiping");
    setX(-pager.index * width(), true);
  }

  /* ---------- trackpad / wheel ---------- */
  let wheelAcc = 0;
  let wheelLock = 0;
  function onWheel(e) {
    if (H.ui.isOpen() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (performance.now() < wheelLock) return;
    wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 70) {
      pager.go(pager.index + (wheelAcc > 0 ? 1 : -1));
      wheelAcc = 0;
      wheelLock = performance.now() + 520;
    }
    clearTimeout(onWheel.t);
    onWheel.t = setTimeout(() => (wheelAcc = 0), 160);
  }

  pager.init = () => {
    const vp = viewport();
    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onCancel);
    // only our own capture ending counts (a tile losing its implicit touch capture bubbles here too)
    vp.addEventListener("lostpointercapture", (e) => e.target === vp && g && g.dir === "x" && e.pointerId === g.id && onUp(e));
    vp.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", () => pager.layout());
    pager.layout();
  };

  H.pager = pager;
})();
