/* Ὁρμή launcher — long-press menus and iPad-style drag & drop.
   Normal mode: hold an icon → quick menu; keep holding and move → edit mode + drag.
   Edit mode: move an icon to drag it. Drop in the middle of another app → folder.
   Drag to the screen edge to change page (a new page appears after the last one). */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const drag = {};
  let press = null;
  let sess = null;
  let lastLongPress = 0;
  const LONG_MS = 480;

  drag.active = () => !!sess;
  drag.recentLongPress = () => Date.now() - lastLongPress < 900;

  /* ---------- containers ---------- */
  function containerOf(el) {
    const c = el.closest("[data-container]");
    if (!c) return el.closest(".page.library, .spotlight") ? { type: "library" } : null;
    const [type, id] = c.dataset.container.split(":");
    return { type, id, el: c };
  }
  function itemsOf(c) {
    const s = S();
    if (c.type === "page") return s.pages[Number(c.id)]?.items;
    if (c.type === "dock") return s.dock;
    if (c.type === "folder") return s.folders[c.id]?.apps;
    return null;
  }
  const keyIn = (c, key) => (c.type === "page" ? key : key.slice(2)); // dock/folder store bare app ids
  function removeEverywhere(key) {
    const s = S();
    const id = key.slice(2);
    s.pages.forEach((p) => {
      const i = p.items.indexOf(key);
      if (i >= 0) p.items.splice(i, 1);
    });
    if (key[0] === "a") {
      Object.values(s.folders).forEach((f) => {
        const i = f.apps.indexOf(id);
        if (i >= 0) f.apps.splice(i, 1);
      });
    }
  }
  function indexIn(c, key) {
    const items = itemsOf(c);
    return items ? items.indexOf(keyIn(c, key)) : -1;
  }
  const sameC = (a, b) => a && b && a.type === b.type && String(a.id) === String(b.id);

  /* ---------- FLIP re-render ---------- */
  function flip(render) {
    const before = new Map();
    H.$$(".grid .tile, #dock-apps .tile").forEach((t) => before.set(t.dataset.key + "|" + (t.closest("[data-container]")?.dataset.container || ""), t.getBoundingClientRect()));
    render();
    if (H.reducedMotion()) return;
    H.$$(".grid .tile, #dock-apps .tile").forEach((t) => {
      const r0 = before.get(t.dataset.key + "|" + (t.closest("[data-container]")?.dataset.container || ""));
      if (!r0) return;
      const r1 = t.getBoundingClientRect();
      const dx = r0.left - r1.left;
      const dy = r0.top - r1.top;
      if (!dx && !dy) return;
      t.style.transition = "none";
      t.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          t.style.transition = "transform .24s cubic-bezier(.2,.8,.2,1)";
          t.style.transform = "";
          setTimeout(() => (t.style.transition = ""), 260);
        }),
      );
    });
  }
  function rerender(cs) {
    const done = new Set();
    cs.forEach((c) => {
      if (!c) return;
      const k = c.type + c.id;
      if (done.has(k)) return;
      done.add(k);
      if (c.type === "page") H.home.renderPage(Number(c.id));
      if (c.type === "dock") H.home.renderDock();
      if (c.type === "folder") H.folders.render();
    });
    markSource();
  }
  function markSource() {
    if (!sess) return;
    H.$$(".tile.drag-source").forEach((t) => t.classList.remove("drag-source"));
    H.$$(`.tile[data-key="${CSS.escape(sess.key)}"]`).forEach((t) => {
      if (!t.closest(".page.library, .sheet-layer")) t.classList.add("drag-source");
    });
  }

  /* ---------- press / long press ---------- */
  function onDown(e) {
    if (e.button !== 0 || sess) return;
    if (e.target.closest(".sheet-layer, .ctx-menu, .spotlight-panel input")) return;
    if (e.target.closest("[data-badge], [data-act]")) return;
    const tile = e.target.closest(".tile");
    if (!tile || tile.closest(".sheet-layer")) return;
    const c = containerOf(tile);
    if (!c) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, tile, key: tile.dataset.key, c, type: e.pointerType, long: false, timer: 0 };
    if (!H.home.editing || c.type === "library") {
      press.timer = setTimeout(longPress, LONG_MS);
    }
  }
  function longPress() {
    if (!press || sess) return;
    press.long = true;
    lastLongPress = Date.now();
    H.home.suppressNextClick(1200);
    H.home.menuFor(press.tile);
  }
  function onMove(e) {
    if (sess) {
      if (e.pointerId !== sess.pointer) return;
      e.preventDefault();
      moveTo(e.clientX, e.clientY);
      return;
    }
    if (!press || e.pointerId !== press.id) return;
    const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (!press.long) {
      if (dist > 10) clearTimeout(press.timer);
      if (H.home.editing && press.c.type !== "library" && dist > 6) start(e);
      else if (dist > 10 && !H.home.editing) press = null;
      return;
    }
    // long press shown → moving turns it into a drag (iPad behaviour)
    if (dist > 12) {
      H.ui.closeMenu();
      if (!H.home.editing) H.home.setEditing(true);
      start(e);
    }
  }
  function onUp(e) {
    if (sess && e.pointerId === sess.pointer) {
      finish();
      return;
    }
    if (press && e.pointerId === press.id) {
      clearTimeout(press.timer);
      if (press.long) H.home.suppressNextClick();
      press = null;
    }
  }
  function onCancel(e) {
    if (sess && e.pointerId === sess.pointer) finish(true);
    if (press && e.pointerId === press.id) {
      clearTimeout(press.timer);
      press = null;
    }
  }

  /* ---------- drag session ---------- */
  function start(e) {
    const p = press;
    press = null;
    if (!p) return;
    clearTimeout(p.timer);
    H.pager.cancelGesture();
    // the tile may have been re-rendered (entering edit mode) — find it again in the same container
    const scope = p.c.type === "library" ? ".page.library, .sheet-layer" : `[data-container="${p.c.type === "dock" ? "dock" : p.c.type + ":" + p.c.id}"]`;
    const tile = H.$$(`.tile[data-key="${CSS.escape(p.key)}"]`).find((t) => t.closest(scope)) || p.tile;
    const r = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.classList.remove("drag-source", "menu-target");
    ghost.querySelector(".badge")?.remove();
    ghost.style.width = r.width + "px";
    ghost.style.height = r.height + "px";
    const layer = H.$("#drag-layer");
    layer.append(ghost);
    // capture on <body>: it survives grid re-renders and is never pointer-events:none
    try {
      document.body.setPointerCapture(e.pointerId);
    } catch (err) {}
    sess = {
      key: p.key,
      t: p.key[0],
      pointer: e.pointerId,
      ghost,
      off: { x: p.x - r.left, y: p.y - r.top },
      w: r.width,
      h: r.height,
      cur: p.c.type === "library" ? null : p.c,
      fromLibrary: p.c.type === "library",
      snap: H.store.snapshot(),
      lastMove: 0,
      merge: null,
      mergeTimer: 0,
      edgeTimer: 0,
      edgeDir: 0,
      dotTimer: 0,
      createdPages: [],
      x: p.x,
      y: p.y,
    };
    document.body.classList.add("dragging");
    H.pager.lock(true);
    H.haptic(12);
    markSource();
    position(e.clientX, e.clientY);
    requestAnimationFrame(() => ghost.classList.add("lifted"));
  }

  function position(x, y) {
    sess.x = x;
    sess.y = y;
    sess.ghost.style.transform = `translate3d(${x - sess.off.x}px, ${y - sess.off.y}px, 0)`;
  }

  let raf = 0;
  function moveTo(x, y) {
    position(x, y);
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (sess) hitTest(sess.x, sess.y);
    });
  }

  function clearMerge() {
    clearTimeout(sess.mergeTimer);
    sess.mergeTimer = 0;
    if (sess.merge) H.$$(".tile.merge-target").forEach((t) => t.classList.remove("merge-target"));
    sess.merge = null;
    sess.mergeCand = null;
  }

  function hitTest(x, y) {
    const vw = window.innerWidth;
    const el = document.elementFromPoint(x, y);
    // --- page edges ---
    const edge = x < 26 ? -1 : x > vw - 26 ? 1 : 0;
    const overBottom = el?.closest(".bottom");
    if (edge && !overBottom) {
      if (sess.edgeDir !== edge) {
        clearTimeout(sess.edgeTimer);
        sess.edgeDir = edge;
        sess.edgeTimer = setTimeout(() => flipPage(edge), 620);
      }
    } else if (sess.edgeDir) {
      clearTimeout(sess.edgeTimer);
      sess.edgeDir = 0;
    }
    if (!el) return;
    // --- page dots ---
    const dot = el.closest("#dots [data-jump]");
    if (dot && Number(dot.dataset.jump) < S().pages.length) {
      const n = Number(dot.dataset.jump);
      if (sess.dotTarget !== n) {
        sess.dotTarget = n;
        clearTimeout(sess.dotTimer);
        sess.dotTimer = setTimeout(() => H.pager.go(n), 420);
      }
      return;
    }
    sess.dotTarget = -1;
    clearTimeout(sess.dotTimer);

    // --- folder overlay: leaving the panel closes it ---
    if (H.folders.openId && !el.closest(".folder-panel") && sess.cur?.type === "folder") {
      H.folders.close();
      return;
    }
    let c = containerOf(el);
    if (!c && el.closest("#dock")) c = { type: "dock", id: "", el: H.$("#dock-apps") };
    if (!c && el.closest(".page.home")) {
      const pg = el.closest(".page.home");
      c = { type: "page", id: pg.dataset.page, el: H.$(".grid", pg) };
    }
    if (!c || c.type === "library") return;
    // what may go where
    if (c.type !== "page" && sess.t !== "a") return;
    if (c.type === "folder" && sess.t !== "a") return;

    const items = itemsOf(c);
    if (!items) return;
    const tiles = H.$$(":scope > .tile", c.el).filter((t) => t.dataset.key !== sess.key);
    const under = el.closest(".tile");

    // --- merge into folder? (app over the middle of another app / folder) ---
    if (sess.t === "a" && c.type === "page" && under && under.dataset.key !== sess.key && /^[af]:/.test(under.dataset.key)) {
      const ir = (under.querySelector(".icon") || under).getBoundingClientRect();
      const inner = x > ir.left + ir.width * 0.2 && x < ir.right - ir.width * 0.2 && y > ir.top + ir.height * 0.15 && y < ir.bottom - ir.height * 0.15;
      if (inner) {
        clearTimeout(sess.pendingTimer);
        sess.pendingSig = null;
        sess.pendingApply = null;
        if (sess.mergeCand !== under.dataset.key) {
          clearMerge();
          sess.mergeCand = under.dataset.key;
          sess.mergeTimer = setTimeout(() => {
            if (!sess) return;
            sess.merge = sess.mergeCand;
            H.$$(`.tile[data-key="${CSS.escape(sess.merge)}"]`).forEach((t) => t.classList.add("merge-target"));
            H.haptic(6);
          }, 380);
        }
        return;
      }
    }
    clearMerge();

    // --- insertion index ---
    let idx = tiles.length;
    if (c.type === "dock") {
      idx = tiles.filter((t) => {
        const r = t.getBoundingClientRect();
        return r.left + r.width / 2 < x;
      }).length;
    } else {
      for (let i = 0; i < tiles.length; i++) {
        const r = tiles[i].getBoundingClientRect();
        if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) {
          idx = i;
          break;
        }
      }
    }
    // map tile index (excluding the dragged one) to an items index
    const keyAt = tiles[idx]?.dataset.key;
    const without = items.filter((k) => k !== keyIn(c, sess.key));
    let to = keyAt ? without.indexOf(keyIn(c, keyAt)) : without.length;
    if (to < 0) to = without.length;
    const from = sess.cur && sameC(sess.cur, c) ? indexIn(c, sess.key) : -1;
    if (from === to && sameC(sess.cur, c)) return;
    if (c.type === "dock" && !sameC(sess.cur, c) && S().dock.length >= H.schema.MAX_DOCK && !S().dock.includes(sess.key.slice(2))) {
      if (!sess.dockWarned) H.ui.toast(`Dock에는 ${H.schema.MAX_DOCK}개까지 넣을 수 있어요.`);
      sess.dockWarned = true;
      return;
    }
    // apply after a short dwell, so passing over icons doesn't shuffle them (and folders can be made)
    const sig = `${c.type}:${c.id}:${to}`;
    if (sess.pendingSig === sig) return;
    clearTimeout(sess.pendingTimer);
    sess.pendingSig = sig;
    sess.pendingApply = () => {
      if (!sess || sess.pendingSig !== sig) return;
      sess.pendingSig = null;
      sess.pendingApply = null;
      const prev = sess.cur;
      flip(() => {
        placeAt(c, to);
        rerender([prev, c]);
      });
    };
    sess.pendingTimer = setTimeout(() => sess?.pendingApply?.(), sameC(sess.cur, c) ? 170 : 90);
  }

  /* Put the dragged item at index `to` of container c (state is edited directly; committed on drop). */
  function placeAt(c, to) {
    const s = S();
    const key = sess.key;
    const id = key.slice(2);
    // leave the previous container
    if (sess.cur) {
      const prevItems = itemsOf(sess.cur);
      const i = prevItems ? prevItems.indexOf(keyIn(sess.cur, key)) : -1;
      if (i >= 0) prevItems.splice(i, 1);
    } else if (sess.fromLibrary) removeEverywhere(key);
    // an app moving onto the home grid leaves its old home spot
    if (c.type === "page" && sess.cur?.type === "dock") removeEverywhere(key);
    if (c.type === "page" && sess.cur?.type !== "page") removeEverywhere(key);
    const items = itemsOf(c);
    const v = keyIn(c, key);
    const dupe = items.indexOf(v);
    if (dupe >= 0) items.splice(dupe, 1);
    items.splice(H.clamp(to, 0, items.length), 0, v);
    if (c.type === "dock" && sess.cur?.type === "page") {
      // moving to the dock takes it off the page (iPad behaviour)
      s.pages.forEach((p) => (p.items = p.items.filter((k) => k !== key)));
    }
    void id;
    sess.cur = { type: c.type, id: c.id };
  }

  function flipPage(dir) {
    if (!sess) return;
    const s = S();
    const last = s.pages.length - 1;
    let target = H.pager.index + dir;
    if (target > last) {
      const lastItems = s.pages[last].items.filter((k) => k !== sess.key);
      if (!lastItems.length || s.pages.length >= H.schema.MAX_PAGES) return;
      const p = { id: H.uid("p"), items: [] };
      s.pages.push(p);
      sess.createdPages.push(p.id);
      H.home.renderPages();
      H.home.renderDots();
      target = s.pages.length - 1;
    }
    if (target < 0) return;
    H.pager.go(target);
    sess.edgeDir = 0;
    setTimeout(() => sess && hitTest(sess.x, sess.y), 450);
  }

  function finish(cancelled = false) {
    const s = sess;
    if (!s) return;
    clearTimeout(s.edgeTimer);
    clearTimeout(s.dotTimer);
    clearTimeout(s.mergeTimer);
    clearTimeout(s.pendingTimer);
    if (!cancelled && !s.merge && s.pendingApply) s.pendingApply();
    let label = "배치 변경";
    if (cancelled && s.snap) {
      H.store.state = H.schema.sanitize(JSON.parse(s.snap));
    } else if (s.merge) {
      label = mergeInto(s.merge, s.key) || label;
    } else if (!s.cur && s.fromLibrary) {
      // dropped from the library on nothing useful → put it at the end of the current page
      const p = S().pages[H.clamp(H.pager.index, 0, S().pages.length - 1)];
      removeEverywhere(s.key);
      p.items.push(s.key);
    }
    // drop pages created during this drag that stayed empty
    S().pages = S().pages.filter((p) => !s.createdPages.includes(p.id) || p.items.length);
    sess = null;
    document.body.classList.remove("dragging");
    H.pager.lock(false);
    const target = H.$$(`.tile[data-key="${CSS.escape(s.key)}"]`).find((t) => !t.closest(".page.library") && t.closest("[data-container]"));
    const ghost = s.ghost;
    const settle = () => {
      ghost.remove();
      H.$$(".tile.drag-source, .tile.merge-target").forEach((t) => t.classList.remove("drag-source", "merge-target"));
    };
    if (target && !H.reducedMotion()) {
      const r = target.getBoundingClientRect();
      ghost.classList.remove("lifted");
      ghost.classList.add("settling");
      ghost.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      setTimeout(settle, 220);
    } else settle();
    H.store.commit(() => {}, { undo: false });
    if (H.store.pushUndo(s.snap, label)) H.emit("change", { label, undoable: true, scope: "all" });
    H.home.suppressNextClick();
    if (H.pager.index > S().pages.length) H.pager.go(S().pages.length - 1, { animate: false });
  }

  /* Drop app `key` onto `targetKey` (app → new folder, folder → add). */
  function mergeInto(targetKey, key) {
    const s = S();
    const appId = key.slice(2);
    const tid = targetKey.slice(2);
    if (targetKey[0] === "f") {
      const f = s.folders[tid];
      if (!f) return null;
      removeEverywhere(key);
      s.dock = s.dock.filter((x) => x !== appId);
      if (!f.apps.includes(appId)) f.apps.push(appId);
      H.ui.toast(`‘${f.name}’ 폴더에 넣었어요.`);
      return "폴더에 넣기";
    }
    const targetApp = s.apps[tid];
    if (!targetApp || tid === appId) return null;
    // find target position
    const pageIdx = s.pages.findIndex((p) => p.items.includes(targetKey));
    if (pageIdx < 0) return null;
    removeEverywhere(key);
    s.dock = s.dock.filter((x) => x !== appId);
    const p = s.pages[pageIdx];
    const at = p.items.indexOf(targetKey);
    const fid = H.uid("f");
    const dragged = s.apps[appId];
    const name = targetApp.category === dragged?.category ? targetApp.category : "폴더";
    s.folders[fid] = { id: fid, name, apps: [tid, appId] };
    p.items.splice(at, 1, "f:" + fid);
    H.ui.toast(`‘${name}’ 폴더를 만들었어요. 길게 눌러 이름을 바꿀 수 있어요.`);
    return "폴더 만들기";
  }

  drag.init = () => {
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    // Stop native image/text drag and the iOS image callout on icons
    document.addEventListener("dragstart", (e) => {
      if (e.target.closest?.(".tile")) e.preventDefault();
    });
    window.addEventListener("blur", () => sess && finish());
  };

  H.drag = drag;
})();
