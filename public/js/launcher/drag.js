/* Ὁρμή launcher — long-press menus and iPad-style drag & drop.
   Normal mode: hold an icon → quick menu; keep holding and move → edit mode + drag.
   Edit mode: move an icon to drag it. Drop in the middle of another app → folder.
   Drag to the screen edge to change page (a new page appears after the last one).
   Several at once: while dragging, tap other icons with another finger to add them to the stack
   (or drag one of the items picked in 선택 mode). Drop on "홈에서 빼기" / "삭제" at the top to
   remove or delete everything in the stack in one go. */
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
      if (!t.closest(".page.library, .sheet-layer, #drag-layer")) t.classList.add("drag-source");
    });
  }

  /* ---------- press / long press ---------- */
  function onDown(e) {
    if (sess) {
      if (e.pointerId !== sess.pointer) addByTap(e); // a second finger collects more icons
      return;
    }
    if (e.button !== 0) return;
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
    H.fx?.releasePress();
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
    ghost.classList.remove("drag-source", "menu-target", "pressing", "hovering", "launching");
    H.fx?.releasePress();
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
      extra: [], // more keys carried along (a stack)
      zone: null,
      x: p.x,
      y: p.y,
    };
    const ib = (tile.querySelector(":scope > .icon, :scope > .wg") || tile).getBoundingClientRect();
    sess.iconBox = { x: ib.left - r.left, y: ib.top - r.top, w: ib.width, h: ib.height };
    zones(true);
    document.body.classList.add("dragging");
    H.fx?.dockEnd();
    H.pager.lock(true);
    H.haptic(12);
    markSource();
    position(e.clientX, e.clientY);
    requestAnimationFrame(() => ghost.classList.add("lifted"));
    // dragging one of the items picked in 선택 mode carries all of them
    if (H.home.selecting) {
      const picked = H.home.isSelected(p.key) ? H.home.selected().filter((k) => k !== p.key) : [];
      H.home.setSelecting(false);
      picked.forEach((k) => stackAdd(k, visibleTile(k)));
    }
  }

  /* ---------- stacks ---------- */
  const visibleTile = (key) =>
    H.$$(`.tile[data-key="${CSS.escape(key)}"]`).find((t) => {
      if (t.closest("#drag-layer, .sheet-layer, .stage-layer")) return false;
      const r = t.getBoundingClientRect();
      return r.width && r.right > 0 && r.left < window.innerWidth;
    });
  function addByTap(e) {
    const tile = e.target.closest?.(".tile");
    if (!tile || tile.closest("#drag-layer, .sheet-layer, .stage-layer, .ctx-menu")) return;
    const key = tile.dataset.key;
    if (!key || key === sess.key || sess.extra.includes(key) || !containerOf(tile)) return;
    H.home.suppressNextClick();
    stackAdd(key, tile);
  }
  function stackAdd(key, fromTile) {
    const s = sess;
    if (!s || key === s.key || s.extra.includes(key)) return;
    s.extra.push(key);
    // the icon flies into the stack under the finger
    const src = fromTile && (fromTile.querySelector(":scope > .icon, :scope > .wg") || fromTile);
    if (src && !H.reducedMotion()) {
      const r = src.getBoundingClientRect();
      const fly = src.cloneNode(true);
      fly.classList.add("stack-fly");
      Object.assign(fly.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      H.$("#drag-layer").append(fly);
      const tx = s.x - s.off.x + s.iconBox.x + s.iconBox.w / 2 - (r.left + r.width / 2);
      const ty = s.y - s.off.y + s.iconBox.y + s.iconBox.h / 2 - (r.top + r.height / 2);
      const k = Math.min(1, s.iconBox.w / Math.max(1, r.width));
      const a = fly.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${tx}px,${ty}px) scale(${k * 0.9})`, opacity: 0.4 }], { duration: 300, easing: "cubic-bezier(.3,.7,.2,1)" });
      a.onfinish = () => fly.remove();
    }
    // the item leaves its place now (restored from the snapshot if the drag is cancelled)
    H.home.mutate.detach(S(), key); // a folder keeps its apps; only its spot on the page is gone
    if (H.folders.openId && !S().folders[H.folders.openId]?.apps.length) H.folders.close();
    H.home.renderPages();
    H.home.renderDock();
    H.folders.render();
    markSource();
    paintStack();
    H.haptic(6);
  }
  function paintStack() {
    const s = sess;
    const g = s.ghost;
    const n = 1 + s.extra.length;
    let badge = g.querySelector(":scope > .stack-n");
    if (!badge) {
      badge = H.h('<span class="stack-n" aria-hidden="true"></span>');
      g.append(badge);
    }
    badge.textContent = n;
    badge.style.left = s.iconBox.x + s.iconBox.w - 14 + "px";
    badge.style.top = s.iconBox.y - 10 + "px";
    g.classList.add("stacked");
    // up to three cards peek out behind the dragged icon
    g.querySelectorAll(":scope > .stack-card").forEach((c) => c.remove());
    s.extra.slice(-3).forEach((key, i, arr) => {
      const app = key[0] === "a" ? S().apps[key.slice(2)] : null;
      const card = H.h(app ? H.home.iconHTML(app) : '<span class="icon"></span>');
      card.classList.add("stack-card");
      card.style.cssText += `;left:${s.iconBox.x}px;top:${s.iconBox.y}px;width:${Math.min(s.iconBox.w, s.iconBox.h)}px;height:${Math.min(s.iconBox.w, s.iconBox.h)}px;--i:${arr.length - i}`;
      g.prepend(card);
    });
  }
  /* put the carried items next to where the dragged one ended up */
  function placeExtras(s, folderId) {
    const st = S();
    const keys = s.extra.filter((k) => (k[0] === "a" ? st.apps[k.slice(2)] : k[0] === "f" ? st.folders[k.slice(2)] : st.widgets[k.slice(2)]));
    if (!keys.length) return;
    const pageOf = (k) => st.pages.findIndex((p) => p.items.includes(k));
    const fallback = () => st.pages[H.clamp(H.pager.index, 0, st.pages.length - 1)];
    const after = (k, list) => {
      const pi = pageOf(k);
      const page = pi >= 0 ? st.pages[pi] : fallback();
      const at = page.items.indexOf(k);
      page.items.splice(at >= 0 ? at + 1 : page.items.length, 0, ...list);
    };
    const mainId = s.key.slice(2);
    if (folderId && st.folders[folderId]) {
      const f = st.folders[folderId];
      const rest = [];
      keys.forEach((k) => {
        if (k[0] === "a") !f.apps.includes(k.slice(2)) && f.apps.push(k.slice(2));
        else if (k[0] === "f" && k.slice(2) !== folderId) {
          st.folders[k.slice(2)].apps.forEach((id) => !f.apps.includes(id) && f.apps.push(id));
          delete st.folders[k.slice(2)];
        } else rest.push(k);
      });
      if (rest.length) after("f:" + folderId, rest);
      return;
    }
    if (pageOf(s.key) >= 0) return after(s.key, keys);
    const apps = keys.filter((k) => k[0] === "a");
    const others = keys.filter((k) => k[0] !== "a");
    if (s.t === "a" && st.dock.includes(mainId)) {
      const room = Math.max(0, H.schema.MAX_DOCK - st.dock.length);
      const take = apps.slice(0, room);
      st.dock.splice(st.dock.indexOf(mainId) + 1, 0, ...take.map((k) => k.slice(2)));
      const left = [...apps.slice(room), ...others];
      if (apps.length > room) H.ui.toast(`Dock 자리가 모자라 나머지는 홈 화면에 뒀어요.`);
      if (left.length) fallback().items.push(...left);
      return;
    }
    const f = s.t === "a" && Object.values(st.folders).find((x) => x.apps.includes(mainId));
    if (f) {
      f.apps.splice(f.apps.indexOf(mainId) + 1, 0, ...apps.map((k) => k.slice(2)).filter((id) => !f.apps.includes(id)));
      if (others.length) after("f:" + f.id, others);
      return;
    }
    fallback().items.push(...keys);
  }

  /* ---------- drop zones: 홈에서 빼기 / 삭제 ---------- */
  function zones(on) {
    let el = H.$("#drop-zones");
    if (!el) {
      el = H.h(`<div id="drop-zones" aria-hidden="true">
        <div class="dz" data-dropzone="remove">${H.svg("minus")}<b>홈에서 빼기</b></div>
        <div class="dz danger" data-dropzone="delete">${H.svg("trash")}<b>삭제</b></div></div>`);
      H.$("#drag-layer").append(el);
    }
    el.classList.toggle("on", on);
    if (!on) el.querySelectorAll(".dz.hot").forEach((z) => z.classList.remove("hot"));
  }
  function zoneHint() {
    H.$$("#drop-zones .dz").forEach((z) => z.classList.toggle("hot", z.dataset.dropzone === sess?.zone));
    sess?.ghost.classList.toggle("over-zone", !!sess?.zone);
  }

  /* The ghost sits exactly under the finger (no lag) and leans a little into the direction it is
     moving, like a card slid across a table; the lean relaxes back once the finger stops. */
  let follow = 0;
  function position(x, y) {
    const s = sess;
    const now = performance.now();
    if (s.lx !== undefined && now > s.lt) {
      const vx = ((x - s.lx) / (now - s.lt)) * 1000; // px/s
      s.vx = s.vx === undefined ? vx : s.vx * 0.6 + vx * 0.4;
    }
    s.lx = x;
    s.lt = now;
    s.x = x;
    s.y = y;
    paintGhost(s);
    if (!follow && !H.reducedMotion()) follow = requestAnimationFrame(relaxLean);
  }
  function paintGhost(s) {
    const target = H.reducedMotion() ? 0 : Math.max(-8, Math.min(8, (s.vx || 0) * 0.008));
    s.rot = s.rot === undefined ? 0 : s.rot + (target - s.rot) * 0.35;
    s.ghost.style.transform = `translate3d(${(s.x - s.off.x).toFixed(1)}px, ${(s.y - s.off.y).toFixed(1)}px, 0) rotate(${s.rot.toFixed(2)}deg)`;
  }
  function relaxLean() {
    follow = 0;
    const s = sess;
    if (!s) return;
    if (performance.now() - s.lt > 40) s.vx = (s.vx || 0) * 0.7; // finger resting: let the lean settle
    paintGhost(s);
    if (Math.abs(s.rot) > 0.05 || Math.abs(s.vx || 0) > 5) follow = requestAnimationFrame(relaxLean);
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
    // --- drop zones at the top ---
    const dz = el?.closest?.("[data-dropzone]");
    if (dz) {
      if (sess.zone !== dz.dataset.dropzone) {
        sess.zone = dz.dataset.dropzone;
        zoneHint();
        H.haptic(6);
      }
      clearTimeout(sess.pendingTimer);
      sess.pendingSig = null;
      sess.pendingApply = null;
      clearMerge();
      return;
    }
    if (sess.zone) {
      sess.zone = null;
      zoneHint();
    }
    // --- page edges (a finger-wide zone; the outermost pixels belong to the system's own gestures) ---
    const zone = Math.max(44, Math.min(96, vw * 0.065));
    const edge = x < zone ? -1 : x > vw - zone ? 1 : 0;
    const overBottom = el?.closest(".bottom");
    if (edge && !overBottom) {
      if (sess.edgeDir !== edge && !H.pager.moving) {
        clearTimeout(sess.edgeTimer);
        sess.edgeDir = edge;
        edgeHint(edge);
        sess.edgeTimer = setTimeout(() => flipPage(edge), 560);
      }
    } else if (sess.edgeDir) {
      clearTimeout(sess.edgeTimer);
      sess.edgeDir = 0;
      edgeHint(0);
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
    H.haptic(8);
    H.pager.go(target);
    sess.edgeDir = 0;
    edgeHint(0);
    // measure the new page only once it stands still (holding at the edge flips again)
    H.pager.afterSettle(() => sess && hitTest(sess.x, sess.y));
  }
  /* a glowing strip at the screen edge that fills up while you hold an icon there */
  function edgeHint(dir) {
    let el = H.$("#drag-edge");
    if (!el) {
      el = H.h('<div id="drag-edge" aria-hidden="true"><i></i></div>');
      H.$("#drag-layer").append(el);
    }
    el.className = dir ? (dir < 0 ? "left on" : "right on") : "";
  }

  function finish(cancelled = false) {
    const s = sess;
    if (!s) return;
    clearTimeout(s.edgeTimer);
    clearTimeout(s.dotTimer);
    clearTimeout(s.mergeTimer);
    clearTimeout(s.pendingTimer);
    if (!cancelled && !s.merge && !s.zone && s.pendingApply) s.pendingApply();
    let label = "배치 변경";
    let zoneMsg = "";
    if (cancelled && s.snap) {
      H.store.state = H.schema.sanitize(JSON.parse(s.snap));
    } else if (s.zone) {
      const keys = [s.key, ...s.extra];
      const n = keys.length;
      if (s.zone === "delete") {
        H.home.mutate.del(S(), keys);
        label = "삭제";
        zoneMsg = n > 1 ? `${n}개를 삭제했어요.` : "삭제했어요.";
      } else {
        H.home.mutate.remove(S(), keys);
        label = "홈에서 빼기";
        zoneMsg = keys.some((k) => k[0] === "a") ? `${n > 1 ? n + "개를 " : ""}홈 화면에서 뺐어요. 앱은 보관함에 남아 있어요.` : "홈 화면에서 뺐어요.";
      }
    } else if (s.merge) {
      const m = mergeInto(s.merge, s.key);
      label = m?.label || label;
      placeExtras(s, m?.folderId);
    } else {
      if (!s.cur && s.fromLibrary) {
        // dropped from the library on nothing useful → put it at the end of the current page
        const p = S().pages[H.clamp(H.pager.index, 0, S().pages.length - 1)];
        removeEverywhere(s.key);
        p.items.push(s.key);
      }
      placeExtras(s);
    }
    // drop pages created during this drag that stayed empty
    S().pages = S().pages.filter((p) => !s.createdPages.includes(p.id) || p.items.length);
    sess = null;
    edgeHint(0);
    zones(false);
    document.body.classList.remove("dragging");
    H.pager.lock(false);
    const target = s.zone ? null : H.$$(`.tile[data-key="${CSS.escape(s.key)}"]`).find((t) => !t.closest(".page.library") && t.closest("[data-container]"));
    const ghost = s.ghost;
    const settle = () => {
      ghost.remove();
      H.$$(".tile.drag-source, .tile.merge-target").forEach((t) => t.classList.remove("drag-source", "merge-target"));
    };
    if (follow) {
      cancelAnimationFrame(follow);
      follow = 0;
    }
    if (target && !H.reducedMotion()) {
      const r = target.getBoundingClientRect();
      ghost.classList.remove("lifted");
      ghost.classList.add("settling");
      ghost.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-ms")) || 300;
      setTimeout(settle, Math.min(700, ms));
    } else if (s.zone && !H.reducedMotion()) {
      ghost.classList.add("zoned"); // shrinks into the drop zone
      setTimeout(settle, 260);
    } else settle();
    H.store.commit(() => {}, { undo: false });
    if (H.store.pushUndo(s.snap, label)) H.emit("change", { label, undoable: true, scope: "all" });
    if (zoneMsg) H.ui.toast(zoneMsg, { action: { label: "되돌리기", fn: () => H.store.undo() } });
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
      return { label: "폴더에 넣기", folderId: f.id };
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
    return { label: "폴더 만들기", folderId: fid };
  }

  drag.init = () => {
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    // iOS picks "scroll the page" at touch start when the tile allows vertical panning; once an icon
    // is held (menu shown) or being dragged, cancel the touch moves so the drag isn't interrupted.
    document.addEventListener(
      "touchmove",
      (e) => {
        if ((sess || (press && (press.long || H.home.editing))) && e.cancelable) e.preventDefault();
      },
      { passive: false },
    );
    // Stop native image/text drag and the iOS image callout on icons
    document.addEventListener("dragstart", (e) => {
      if (e.target.closest?.(".tile")) e.preventDefault();
    });
    window.addEventListener("blur", () => sess && finish());
  };

  H.drag = drag;
})();
