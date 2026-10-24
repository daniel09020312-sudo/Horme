/* Ὁρμή launcher — page swiping that follows the finger, trackpad/mouse-wheel paging, dots.
   - While a finger is down, only one thing changes per frame: the track's transform (plus the
     chosen page effect). Moves are coalesced to one update per frame.
   - On release the spring is precomputed and played by the browser's compositor (fx.settle), so the
     glide stays smooth even when JavaScript is busy. Saving the page index and accessibility updates
     wait until the page has settled.
   - Touching a page that is still moving catches it exactly where it is. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const pager = { index: 0, locked: false, x: 0, moving: false };
  let consumed = false;
  let g = null; // active gesture
  let ctrl = null; // running compositor settle
  let jsAnim = null; // fallback spring (browsers without Web Animations)
  let frameReq = 0;
  let pendingX = null;
  let pendingV = 0;
  let afterSettle = [];
  let dirty = false; // page index changed → save + a11y after settling

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
  /* where the track really is right now (also in the middle of a compositor settle) */
  pager.currentX = () => (ctrl ? ctrl.now().x : pager.x);
  /* run fn once the pages stand still */
  pager.afterSettle = (fn) => (pager.moving ? afterSettle.push(fn) : fn());

  /* paint the track at x (px) moving at v (px/s) */
  function render(x, v = 0) {
    pager.x = x;
    track().style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    H.fx?.pageFx(x, v, width());
  }
  function settled() {
    pager.moving = false;
    track().classList.remove("paging");
    H.fx?.pageRest();
    H.bg?.parallax(pager.x, width());
    if (dirty) {
      dirty = false;
      H.store.save();
      markInert();
    }
    const q = afterSettle;
    afterSettle = [];
    q.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }
  /* stop any animation where it is (the track keeps that position) */
  function stopAnim() {
    if (ctrl) {
      const p = ctrl.stop();
      ctrl = null;
      if (p) {
        render(p.x, p.v);
        p.end();
      }
    }
    jsAnim?.stop();
    jsAnim = null;
  }
  function setX(px, animate, v = 0) {
    stopAnim();
    const from = pager.x;
    if (!animate || H.reducedMotion() || Math.abs(px - from) < 0.5) {
      render(px, 0);
      settled();
      return;
    }
    pager.moving = true;
    track().classList.add("paging");
    const zeta = Math.max(0.7, H.fx.zeta(0.04));
    const w = width();
    ctrl = H.fx.settle({
      track: track(),
      x0: from,
      v0: v,
      to: px,
      w,
      k: 230,
      zeta,
      onDone: (end) => {
        ctrl = null;
        render(px, 0);
        end();
        settled();
      },
    });
    if (ctrl) return;
    // no Web Animations: animate from JavaScript
    jsAnim = H.fx.spring({
      from,
      to: px,
      v,
      k: 230,
      zeta,
      restX: 0.5,
      restV: 12,
      onUpdate: (x, vv) => render(x, vv),
      onDone: () => {
        jsAnim = null;
        settled();
      },
    });
  }
  /* coalesce finger moves to one transform per frame */
  function queue(x, v) {
    pendingX = x;
    pendingV = v;
    if (frameReq) return;
    frameReq = requestAnimationFrame(() => {
      frameReq = 0;
      if (pendingX != null) render(pendingX, pendingV);
      pendingX = null;
    });
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
    markDots();
    markInert();
    H.fx?.measureCols();
  };

  function markDots() {
    H.$$("#dots .dot").forEach((d) => d.classList.toggle("on", Number(d.dataset.jump) === pager.index));
    document.body.classList.toggle("on-library", pager.index === pager.libraryIndex());
  }
  function markInert() {
    H.$$("#track > .page").forEach((p, i) => {
      const off = i !== pager.index && !document.body.classList.contains("dragging");
      if (p.hasAttribute("inert") !== off) p.toggleAttribute("inert", off);
      p.setAttribute("aria-hidden", String(i !== pager.index));
    });
  }

  pager.go = (i, { animate = true, v = 0 } = {}) => {
    const max = pager.locked ? S().pages.length - 1 : pager.count() - 1;
    const next = H.clamp(i, 0, max);
    const changed = next !== pager.index;
    pager.index = next;
    if (S().page !== next) {
      S().page = next;
      dirty = true;
    }
    markDots();
    setX(-next * width(), animate, v);
    if (dirty && !pager.moving) {
      dirty = false;
      H.store.save();
      markInert();
    }
    if (changed) H.emit("page", next);
    return changed;
  };
  /* Abort a swipe in progress (e.g. a long-press turned into an icon drag). */
  pager.cancelGesture = () => {
    if (!g) return;
    const wasX = g.dir === "x";
    g = null;
    track().classList.remove("swiping");
    if (wasX) setX(-pager.index * width(), true);
    setTimeout(() => (consumed = false), 50);
  };
  pager.next = () => pager.go(pager.index + 1);
  pager.prev = () => pager.go(pager.index - 1);
  pager.lock = (on) => {
    pager.locked = on;
    if (!on) markInert();
  };

  /* iOS-style rubber band: resistance grows the further you pull */
  const rubber = (d, w) => Math.sign(d) * (1 - 1 / ((Math.abs(d) * 0.55) / w + 1)) * w;

  /* ---------- touch / pen / mouse swipe ---------- */
  function onDown(e) {
    if (e.button !== 0 || g || H.ui.isOpen() || H.drag?.active()) return;
    if (e.target.closest("input, textarea, select, .ctx-menu, [data-noswipe]")) return;
    if (H.home.editing && e.target.closest(".tile")) return; // tiles are dragged in edit mode
    if (e.pointerType === "mouse" && e.target.closest(".tile, button, a")) return; // mouse: swipe only on empty space
    const caught = pager.moving; // a page still settling: grab it where it is
    if (caught) {
      stopAnim();
      consumed = true; // this touch is "stop the page", not a tap on whatever is under it
    }
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, base: pager.x, dir: caught ? "x" : null, hist: [[performance.now(), e.clientX]], caught };
    if (caught) {
      try {
        viewport().setPointerCapture(e.pointerId);
      } catch (err) {}
      track().classList.add("swiping", "paging");
      pager.moving = true;
    }
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
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.dir = Math.abs(dx) > Math.abs(dy) * 1.1 ? "x" : "y";
      if (g.dir === "y") {
        g = null;
        return;
      }
      try {
        viewport().setPointerCapture(e.pointerId);
      } catch (err) {}
      consumed = true;
      H.fx?.releasePress();
      track().classList.add("swiping", "paging");
      pager.moving = true;
      g.x0 = e.clientX - Math.sign(dx) * 0.001; // follow from here (no jump after the slop)
    }
    const now = performance.now();
    g.x = e.clientX;
    g.hist.push([now, e.clientX]);
    while (g.hist.length > 2 && now - g.hist[0][0] > 90) g.hist.shift();
    const w = width();
    const min = -(pager.count() - 1) * w;
    let x = g.base + (e.clientX - g.x0);
    if (x > 0) x = rubber(x, w);
    else if (x < min) x = min + rubber(x - min, w);
    queue(x, velocity(g) * 1000);
  }
  function velocity(gs) {
    const h = gs.hist;
    if (h.length < 2) return 0;
    const a = h[0];
    const b = h[h.length - 1];
    return (b[1] - a[1]) / Math.max(8, b[0] - a[0]); // px/ms
  }
  function onUp(e) {
    if (!g || e.pointerId !== g.id) return;
    const gesture = g;
    g = null;
    track().classList.remove("swiping");
    if (gesture.dir !== "x") return;
    if (frameReq) {
      cancelAnimationFrame(frameReq);
      frameReq = 0;
      if (pendingX != null) render(pendingX, pendingV);
      pendingX = null;
    }
    // finger lifted a moment after it stopped moving: no fling
    const last = gesture.hist[gesture.hist.length - 1];
    const v = performance.now() - last[0] > 80 ? 0 : velocity(gesture);
    const w = width();
    const pos = -pager.x / w; // continuous page position
    // the page this drag started from (a caught, still-moving page counts as the nearest one)
    const from = gesture.caught ? Math.round(pos) : pager.index;
    let target = from;
    if (Math.abs(v) > 0.35) target = v < 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1; // flick
    else if (!gesture.caught && Math.abs(pos - from) > 0.22) target = pos > from ? from + 1 : from - 1; // dragged far enough
    target = H.clamp(target, from - 1, from + 1);
    const max = pager.locked ? S().pages.length - 1 : pager.count() - 1;
    target = H.clamp(target, 0, max);
    if (target !== pager.index) H.haptic(6);
    // carry the finger's speed into the spring (capped so a hard flick doesn't overshoot wildly)
    const vs = Math.max(-5200, Math.min(5200, v * 1000));
    pager.go(target, { v: vs });
    setTimeout(() => (consumed = false), 350);
  }
  function onCancel(e) {
    if (!g || e.pointerId !== g.id) return;
    g = null;
    track().classList.remove("swiping");
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
      H.haptic(6);
      pager.go(pager.index + (wheelAcc > 0 ? 1 : -1), { v: wheelAcc > 0 ? -900 : 900 });
      wheelAcc = 0;
      wheelLock = performance.now() + 420;
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
