/* Ὁρμή launcher — home pages, dock, folders: rendering + taps + context menus. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const home = { editing: false };
  const TINTS = ["#7586be22", "#9dbbcb22", "#ac8fc522", "#a6a9c822", "#8b96ba22", "#b9aab022", "#8fb8b022"];
  const hash = (s) => Array.from(s).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

  /* ---------- tiles ---------- */
  home.iconHTML = (app, cls = "") => {
    const custom = S().assets["icon:" + app.id] ? H.assets.urlSync("icon:" + app.id) : null;
    if (custom) return `<span class="icon custom ${cls}"><img src="${custom}" alt="" draggable="false"></span>`;
    return `<span class="icon ${cls}" style="--tint:${TINTS[hash(app.id) % TINTS.length]}">${H.svg(app.glyph)}</span>`;
  };
  /* edit-mode badge: "−" normally, a check circle while selecting several items */
  H.badgeGlyphs = () => H.svg("minus", "b-minus") + H.svg("check", "b-check");
  const badge = (kind = "remove") => `<span class="badge del" data-badge="${kind}" aria-hidden="true">${H.badgeGlyphs()}</span>`;

  home.appTile = (app, ctx = "page") => {
    const editing = home.editing && ctx !== "library";
    const needsLink = !app.app && !app.web;
    return `<button type="button" class="tile app ${needsLink ? "unlinked" : ""}" data-key="a:${H.esc(app.id)}" data-ctx="${ctx}" aria-label="${H.esc(app.name)}" style="--d:${(hash(app.id) % 7) * 0.035}s">
      ${home.iconHTML(app)}<span class="label">${H.esc(app.name)}</span>${editing ? badge() : ""}</button>`;
  };
  home.folderTile = (f) => {
    const apps = f.apps.map((id) => S().apps[id]).filter(Boolean);
    const minis = apps.slice(0, 9).map((a) => home.iconHTML(a, "mini")).join("");
    return `<button type="button" class="tile folder" data-key="f:${H.esc(f.id)}" aria-label="${H.esc(f.name)} 폴더, 앱 ${apps.length}개" style="--d:${(hash(f.id) % 7) * 0.035}s">
      <span class="icon folder-icon"><span class="folder-minis">${minis}</span></span><span class="label">${H.esc(f.name)}</span>${home.editing ? badge("ungroup") : ""}</button>`;
  };
  home.tileHTML = (key, pageIndex) => {
    const t = key[0];
    const id = key.slice(2);
    if (t === "a") return S().apps[id] ? home.appTile(S().apps[id]) : "";
    if (t === "f") return S().folders[id] ? home.folderTile(S().folders[id]) : "";
    if (t === "w") {
      const w = S().widgets[id];
      return w ? H.widgetHTML(w, { editing: home.editing, extra: { pageLabel: `${H.pad(pageIndex + 1)} / ${H.pad(S().pages.length)}` } }) : "";
    }
    return "";
  };

  /* ---------- pages ---------- */
  const track = () => H.$("#track");
  home.pageGrid = (i) => H.$(`.grid[data-container="page:${i}"]`);

  home.renderPage = (i) => {
    const grid = home.pageGrid(i);
    const p = S().pages[i];
    if (!grid || !p) return;
    const html = p.items.map((k) => home.tileHTML(k, i)).join("");
    const del = S().pages.length > 1 ? `<button type="button" class="pill-btn danger" data-del-page="${i}">${H.svg("trash")}<span>이 페이지 지우기</span></button>` : "";
    grid.innerHTML =
      html ||
      (home.editing
        ? `<div class="empty-hint"><span>빈 페이지예요 · 아이콘이나 위젯을 여기로 끌어오세요</span>${del}</div>`
        : '<div class="empty-hint quiet">빈 페이지예요 · 편집 모드에서 채우거나 지울 수 있어요</div>');
    grid.classList.toggle("is-empty", !p.items.length);
    if (selected.size) home.syncSelection();
  };

  home.renderPages = () => {
    const tr = track();
    const pages = S().pages;
    const keepScroll = H.$$(".page.home", tr).map((el) => el.scrollTop);
    // (re)build the page shells if the count changed
    const shells = H.$$(".page.home", tr);
    if (shells.length !== pages.length) {
      shells.forEach((el) => el.remove());
      const lib = H.$(".page.library", tr);
      pages.forEach((p, i) => {
        const sec = H.h(`<section class="page home" data-page="${i}" aria-label="홈 화면 ${i + 1}"><div class="grid" data-container="page:${i}"></div></section>`);
        tr.insertBefore(sec, lib);
      });
    }
    pages.forEach((p, i) => home.renderPage(i));
    H.$$(".page.home", tr).forEach((el, i) => (el.scrollTop = keepScroll[i] || 0));
  };

  home.renderDock = () => {
    const dock = H.$("#dock-apps");
    const apps = S().dock.map((id) => S().apps[id]).filter(Boolean);
    dock.innerHTML = apps.map((a) => home.appTile(a, "dock")).join("") || (home.editing ? '<span class="dock-empty">Dock으로 끌어오기</span>' : "");
    H.$("#dock").style.setProperty("--n", Math.max(1, apps.length));
    if (selected.size) home.syncSelection();
  };

  home.renderDots = () => {
    const n = S().pages.length;
    const cur = S().page;
    const dots = Array.from({ length: n }, (_, i) => `<button type="button" class="dot ${i === cur ? "on" : ""}" data-jump="${i}" aria-label="홈 화면 ${i + 1}"></button>`).join("");
    H.$("#dots").innerHTML = dots + `<button type="button" class="dot lib ${cur === n ? "on" : ""}" data-jump="${n}" aria-label="앱 보관함">${H.svg("grid")}</button>`;
  };

  home.render = () => {
    document.body.classList.toggle("editing", home.editing);
    home.renderPages();
    home.renderDock();
    home.renderDots();
    H.library?.render();
    H.pager?.layout();
    if (H.folders?.openId) H.folders.render();
  };

  /* Re-render only one widget (used by widget patches and the ticker). */
  home.renderWidget = (id) => {
    const w = S().widgets[id];
    H.$$(`.tile.widget[data-key="w:${CSS.escape(id)}"]`).forEach((el) => {
      if (!w) return;
      if (el.classList.contains("ws-" + w.size)) {
        const pi = Number(el.closest(".page")?.dataset.page || 0);
        el.querySelector(".wg").innerHTML = H.widgetInner(w, { pageLabel: `${H.pad(pi + 1)} / ${H.pad(S().pages.length)}` });
      } else el.outerHTML = H.widgetHTML(w, { editing: home.editing });
    });
  };

  /* ---------- where is an app? ---------- */
  home.locate = (appId) => {
    const s = S();
    const pi = s.pages.findIndex((p) => p.items.includes("a:" + appId));
    if (pi >= 0) return { where: "page", page: pi };
    const f = Object.values(s.folders).find((x) => x.apps.includes(appId));
    if (f) return { where: "folder", folder: f.id, page: s.pages.findIndex((p) => p.items.includes("f:" + f.id)) };
    return { where: "library" };
  };
  home.locationLabel = (appId) => {
    const l = home.locate(appId);
    const inDock = S().dock.includes(appId);
    const base = l.where === "page" ? `홈 ${l.page + 1}` : l.where === "folder" ? `폴더 · ${S().folders[l.folder].name}` : "보관함";
    return inDock ? (l.where === "library" ? "Dock" : base + " · Dock") : base;
  };

  /* ---------- Apple apps → Google apps (same spots on the home screen) ---------- */
  home.googlePlan = () => {
    const s = S();
    const onHome = (id) => s.dock.includes(id) || s.pages.some((p) => p.items.includes("a:" + id)) || Object.values(s.folders).some((f) => f.apps.includes(id));
    return Object.entries(H.GOOGLE_SWAP).filter(([a]) => onHome(a) && H.catalogById(H.GOOGLE_SWAP[a]));
  };
  home.googleSwap = () => {
    const plan = home.googlePlan();
    if (!plan.length) return 0;
    H.store.commit(
      (st) => {
        for (const [a, g] of plan) {
          if (!st.apps[g]) st.apps[g] = H.makeApp(H.catalogById(g), Date.now());
          let placed = st.dock.includes(g) || st.pages.some((p) => p.items.includes("a:" + g)) || Object.values(st.folders).some((f) => f.apps.includes(g));
          const swapIn = (arr, from, to) => {
            for (let i = arr.length - 1; i >= 0; i--) if (arr[i] === from) placed ? arr.splice(i, 1) : ((arr[i] = to), (placed = true));
          };
          swapIn(st.dock, a, g);
          st.pages.forEach((p) => swapIn(p.items, "a:" + a, "a:" + g));
          Object.values(st.folders).forEach((f) => swapIn(f.apps, a, g));
        }
      },
      { label: "구글 앱으로 바꾸기" },
    );
    return plan.length;
  };

  /* ---------- mutations ---------- */
  home.removeFromHome = (appId) => {
    const app = S().apps[appId];
    H.store.commit(
      (s) => {
        s.pages.forEach((p) => (p.items = p.items.filter((k) => k !== "a:" + appId)));
        Object.values(s.folders).forEach((f) => (f.apps = f.apps.filter((x) => x !== appId)));
        s.dock = s.dock.filter((x) => x !== appId);
      },
      { label: "홈에서 제거" },
    );
    H.ui.toast(`${app?.name || "앱"}을(를) 홈 화면에서 뺐어요. 앱 보관함에는 남아 있어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  };
  home.addToHome = (appId, page = Math.min(S().page, S().pages.length - 1)) => {
    H.store.commit((s) => {
      const p = s.pages[H.clamp(page, 0, s.pages.length - 1)];
      if (!p.items.includes("a:" + appId)) p.items.push("a:" + appId);
    }, { label: "홈에 추가" });
    H.ui.toast(`홈 화면 ${H.clamp(page, 0, S().pages.length - 1) + 1}에 추가했어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  };
  home.toggleDock = (appId) => {
    const inDock = S().dock.includes(appId);
    if (!inDock && S().dock.length >= H.schema.MAX_DOCK) return H.ui.toast(`Dock에는 ${H.schema.MAX_DOCK}개까지 넣을 수 있어요.`);
    H.store.commit((s) => {
      if (inDock) s.dock = s.dock.filter((x) => x !== appId);
      else s.dock.push(appId);
    }, { label: inDock ? "Dock에서 빼기" : "Dock에 추가" });
    H.ui.toast(inDock ? "Dock에서 뺐어요." : "Dock에 추가했어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
  };
  home.deleteShortcut = async (appId) => {
    const app = S().apps[appId];
    if (!app) return;
    if (S().prefs.confirmDelete) {
      const ok = await H.ui.confirm({ title: `‘${app.name}’ 바로가기 삭제`, msg: "Ὁρμή에서만 지워져요. 기기에 설치된 실제 앱은 그대로예요.", ok: "삭제", danger: true });
      if (!ok) return;
    }
    H.store.commit(
      (s) => {
        delete s.apps[appId];
        s.pages.forEach((p) => (p.items = p.items.filter((k) => k !== "a:" + appId)));
        Object.values(s.folders).forEach((f) => (f.apps = f.apps.filter((x) => x !== appId)));
        s.dock = s.dock.filter((x) => x !== appId);
        delete s.assets["icon:" + appId];
      },
      { label: "바로가기 삭제" },
    );
    H.ui.toast(`${app.name} 바로가기를 삭제했어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  };
  home.ungroup = (folderId) => {
    const f = S().folders[folderId];
    if (!f) return;
    H.store.commit(
      (s) => {
        s.pages.forEach((p) => {
          const i = p.items.indexOf("f:" + folderId);
          if (i >= 0) p.items.splice(i, 1, ...f.apps.map((id) => "a:" + id));
        });
        delete s.folders[folderId];
      },
      { label: "폴더 풀기" },
    );
    H.ui.toast(`‘${f.name}’ 폴더를 풀었어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  };
  home.renameFolder = async (folderId) => {
    const f = S().folders[folderId];
    if (!f) return;
    const v = await H.ui.prompt({ title: "폴더 이름", value: f.name, max: 30 });
    if (v) H.store.commit((s) => (s.folders[folderId].name = v), { label: "폴더 이름 변경" });
  };
  home.moveToPage = (key, page) => {
    H.store.commit((s) => {
      s.pages.forEach((p) => (p.items = p.items.filter((k) => k !== key)));
      s.pages[H.clamp(page, 0, s.pages.length - 1)].items.push(key);
    }, { label: "페이지 이동" });
    H.ui.toast(`${page + 1}쪽으로 옮겼어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  };
  home.setWidgetSize = (id, size) => H.store.commit((s) => s.widgets[id] && (s.widgets[id].size = size), { label: "위젯 크기" });

  /* ---------- pages ---------- */
  home.deletePage = async (i, { ask = true } = {}) => {
    const p = S().pages[i];
    if (!p || S().pages.length < 2) return false;
    if (p.items.length && ask) {
      const ok = await H.ui.confirm({ title: `홈 화면 ${i + 1} 삭제`, msg: "이 페이지의 앱은 앱 보관함으로 옮겨지고, 위젯은 지워져요.", ok: "삭제", danger: true });
      if (!ok) return false;
    }
    H.store.commit((st) => {
      st.pages.splice(i, 1); // folders and widgets that lose their page are dropped by sanitize
      st.page = H.clamp(st.page > i ? st.page - 1 : st.page, 0, st.pages.length);
    }, { label: "페이지 삭제" });
    H.ui.toast(`홈 화면 ${i + 1}을(를) 지웠어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
    return true;
  };
  /* empty pages go away when editing ends (like iPadOS); at least one page stays */
  home.pruneEmptyPages = () => {
    const empty = S().pages.filter((p) => !p.items.length).length;
    if (!empty || S().pages.length < 2) return 0;
    const n = Math.min(empty, S().pages.length - 1);
    H.store.commit((st) => {
      let left = n;
      const onLibrary = st.page >= st.pages.length;
      const cur = st.pages[st.page];
      st.pages = st.pages.filter((p) => p.items.length || left-- <= 0);
      const at = st.pages.indexOf(cur);
      st.page = onLibrary ? st.pages.length : at >= 0 ? at : H.clamp(st.page, 0, st.pages.length - 1);
    }, { label: "빈 페이지 정리" });
    H.ui.toast(n > 1 ? `빈 페이지 ${n}개를 지웠어요.` : "빈 페이지를 지웠어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
    return n;
  };

  /* ---------- several items at once ----------
     Keys are page item keys ("a:id", "f:id", "w:id"). The mutate.* helpers edit a state object directly
     (the drag engine uses them inside its own undo step); the home.* wrappers commit with undo. */
  const mutate = {};
  home.mutate = mutate;
  /* the keys in the order they appear: pages, then Dock, then folders */
  mutate.order = (s, keys) => {
    const want = new Set(keys);
    const out = [];
    const push = (k) => want.has(k) && !out.includes(k) && out.push(k);
    s.pages.forEach((p) => p.items.forEach(push));
    s.dock.forEach((id) => push("a:" + id));
    Object.values(s.folders).forEach((f) => f.apps.forEach((id) => push("a:" + id)));
    keys.forEach(push);
    return out;
  };
  /* take a key out of every place on the home screen (apps then live only in the library) */
  mutate.detach = (s, key) => {
    s.pages.forEach((p) => (p.items = p.items.filter((k) => k !== key)));
    if (key[0] !== "a") return;
    const id = key.slice(2);
    s.dock = s.dock.filter((x) => x !== id);
    Object.values(s.folders).forEach((f) => (f.apps = f.apps.filter((x) => x !== id)));
  };
  mutate.remove = (s, keys) => keys.forEach((k) => {
    if (k[0] === "f") {
      // a folder taken off the home screen: the folder goes, its apps stay in the library
      delete s.folders[k.slice(2)];
      s.pages.forEach((p) => (p.items = p.items.filter((x) => x !== k)));
    } else mutate.detach(s, k); // widgets without a page are dropped by sanitize
  });
  mutate.del = (s, keys) => {
    mutate.remove(s, keys);
    keys.filter((k) => k[0] === "a").forEach((k) => {
      const id = k.slice(2);
      delete s.apps[id];
      delete s.assets["icon:" + id];
    });
  };
  /* put keys on page i (or a new page) after removing them from wherever they were */
  mutate.toPage = (s, keys, i) => {
    let page = s.pages[i];
    if (!page) {
      if (s.pages.length >= H.schema.MAX_PAGES) page = s.pages[s.pages.length - 1];
      else s.pages.push((page = { id: H.uid("p"), items: [] }));
    }
    keys.forEach((k) => mutate.detach(s, k));
    page.items.push(...keys);
    return s.pages.indexOf(page);
  };
  mutate.toDock = (s, keys) => {
    const apps = keys.filter((k) => k[0] === "a");
    const room = H.schema.MAX_DOCK - s.dock.filter((id) => !apps.includes("a:" + id)).length;
    const take = apps.slice(0, Math.max(0, room));
    take.forEach((k) => mutate.detach(s, k));
    s.dock.push(...take.map((k) => k.slice(2)));
    return take.length;
  };
  /* one new folder from the chosen apps (chosen folders are poured into it), where the first one was */
  mutate.group = (s, keys) => {
    const ids = [];
    let name = "";
    keys.forEach((k) => {
      if (k[0] === "a" && s.apps[k.slice(2)]) ids.push(k.slice(2));
      if (k[0] === "f" && s.folders[k.slice(2)]) {
        name = name || s.folders[k.slice(2)].name;
        ids.push(...s.folders[k.slice(2)].apps);
      }
    });
    const uniq = [...new Set(ids)];
    if (uniq.length < 2) return null;
    const fid = H.uid("f");
    const first = keys.find((k) => k[0] !== "w" && s.pages.some((p) => p.items.includes(k)));
    const pi = first ? s.pages.findIndex((p) => p.items.includes(first)) : H.clamp(s.page, 0, s.pages.length - 1);
    const page = s.pages[pi];
    page.items.splice(first ? page.items.indexOf(first) : page.items.length, 0, "f:" + fid); // placeholder keeps the spot
    keys.filter((k) => k[0] !== "w").forEach((k) => {
      mutate.detach(s, k);
      if (k[0] === "f") delete s.folders[k.slice(2)];
    });
    uniq.forEach((id) => mutate.detach(s, "a:" + id));
    if (!name) {
      const cats = uniq.map((id) => s.apps[id].category);
      name = cats.every((c) => c === cats[0]) ? cats[0] : "폴더";
    }
    s.folders[fid] = { id: fid, name, apps: uniq.slice(0, 60) };
    return fid;
  };
  const undoToast = (msg) => H.ui.toast(msg, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  const count = (keys) => `${keys.length}개`;
  home.removeKeys = (keys) => {
    if (!keys.length) return;
    H.store.commit((s) => mutate.remove(s, mutate.order(s, keys)), { label: "홈에서 빼기" });
    undoToast(`${count(keys)}를 홈 화면에서 뺐어요. 앱은 보관함에 남아 있어요.`);
  };
  home.deleteKeys = (keys) => {
    if (!keys.length) return;
    const folders = keys.filter((k) => k[0] === "f").length;
    H.store.commit((s) => mutate.del(s, keys), { label: "삭제" });
    undoToast(`${count(keys)}를 삭제했어요.${folders ? " 폴더 속 앱은 보관함에 남겨 뒀어요." : ""}`);
  };
  home.moveKeys = (keys, page) => {
    if (!keys.length) return;
    let at = page;
    H.store.commit((s) => (at = mutate.toPage(s, mutate.order(s, keys), page)), { label: "여러 개 옮기기" });
    undoToast(`${count(keys)}를 홈 화면 ${at + 1}(으)로 옮겼어요.`);
    H.pager.go(at);
  };
  home.dockKeys = (keys) => {
    const apps = keys.filter((k) => k[0] === "a");
    if (!apps.length) return H.ui.toast("Dock에는 앱만 넣을 수 있어요.");
    let n = 0;
    H.store.commit((s) => (n = mutate.toDock(s, mutate.order(s, apps))), { label: "Dock에 넣기" });
    undoToast(n < apps.length ? `Dock 자리가 모자라 ${n}개만 넣었어요 (최대 ${H.schema.MAX_DOCK}개).` : `${n}개를 Dock에 넣었어요.`);
  };
  home.groupKeys = (keys) => {
    let fid = null;
    const s0 = S();
    const apps = new Set();
    keys.forEach((k) => (k[0] === "a" ? apps.add(k) : k[0] === "f" && s0.folders[k.slice(2)]?.apps.forEach((id) => apps.add("a:" + id))));
    if (apps.size < 2) return H.ui.toast("앱을 2개 이상 고르면 폴더로 묶을 수 있어요.");
    H.store.commit((s) => (fid = mutate.group(s, mutate.order(s, keys))), { label: "폴더로 묶기" });
    if (fid && S().folders[fid]) undoToast(`‘${S().folders[fid].name}’ 폴더로 묶었어요.`);
  };

  /* ---------- selecting (edit mode → 선택) ---------- */
  const selected = new Set();
  home.selecting = false;
  home.selected = () => [...selected];
  home.isSelected = (key) => selected.has(key);
  const selectable = (t) => t && t.dataset.key && !t.closest(".page.library, .sheet-layer, #drag-layer, .stage-layer, .spotlight");
  home.syncSelection = () => {
    H.$$(".tile.selected").forEach((t) => !selected.has(t.dataset.key) && t.classList.remove("selected"));
    if (!selected.size) return;
    H.$$(".tile[data-key]").forEach((t) => selected.has(t.dataset.key) && selectable(t) && t.classList.add("selected"));
  };
  function selBar() {
    const n = selected.size;
    const label = H.$("#sel-n");
    if (label) label.textContent = n ? `${n}개 선택` : "항목을 눌러 고르세요";
    H.$$("#sel-actions [data-sel-need]").forEach((b) => (b.disabled = !n));
  }
  home.setSelecting = (on, firstKey) => {
    if (on && !home.editing) home.setEditing(true);
    home.selecting = !!on;
    selected.clear();
    if (on && firstKey) selected.add(firstKey);
    document.body.classList.toggle("selecting", home.selecting);
    home.syncSelection();
    selBar();
  };
  home.toggleSelect = (key) => {
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    H.haptic(4);
    home.syncSelection();
    selBar();
  };
  home.selectPage = () => {
    const p = S().pages[H.pager.index];
    if (!p) return;
    const all = p.items.every((k) => selected.has(k));
    p.items.forEach((k) => (all ? selected.delete(k) : selected.add(k)));
    home.syncSelection();
    selBar();
  };
  /* the toolbar buttons */
  home.selAction = (act, anchor) => {
    const keys = home.selected();
    const done = () => home.setSelecting(false);
    if (act === "all") return home.selectPage();
    if (act === "close") return done();
    if (!keys.length) return;
    if (act === "remove") return done(), home.removeKeys(keys);
    if (act === "delete") return done(), home.deleteKeys(keys);
    if (act === "folder") return done(), home.groupKeys(keys);
    if (act === "move") {
      const n = S().pages.length;
      H.ui.menu({
        rect: anchor?.getBoundingClientRect(),
        title: `${keys.length}개 옮기기`,
        items: [
          { row: S().pages.map((_, i) => ({ label: `${i + 1}쪽`, on: i === H.pager.index, act: () => (done(), home.moveKeys(keys, i)) })) },
          { label: "새 페이지로", glyph: "pages", act: () => (done(), home.moveKeys(keys, n)) },
          { label: "Dock으로", glyph: "dock", act: () => (done(), home.dockKeys(keys)) },
        ],
      });
    }
  };

  /* ---------- edit mode ---------- */
  home.setEditing = (on) => {
    if (home.editing === on) return;
    if (!on && home.selecting) home.setSelecting(false);
    home.editing = on;
    H.ui.closeMenu();
    document.body.classList.toggle("editing", on);
    // Add/remove the badges in place instead of re-rendering: a long-press turning into a drag
    // enters edit mode while the finger is still on the tile, and on iPad replacing that element
    // cuts off its touch events (the drag would freeze).
    syncBadges(on);
    if (on) H.haptic(10);
    H.emit("editing", on);
    if (!on && !H.drag?.active()) home.pruneEmptyPages();
  };
  const widgetBadge = () => `<button type="button" class="badge del" data-badge="remove" aria-label="위젯 제거">${H.badgeGlyphs()}</button>`;
  function syncBadges(on) {
    const scopes = [...H.$$(".page.home > .grid"), H.$("#dock-apps"), H.$(".folder-layer .folder-grid")].filter(Boolean);
    scopes.forEach((sc) =>
      sc.querySelectorAll(":scope > .tile").forEach((t) => {
        const b = t.querySelector(":scope > .badge");
        if (!on) return b?.remove();
        if (b) return;
        const k = (t.dataset.key || "")[0];
        t.insertAdjacentHTML("beforeend", k === "w" ? widgetBadge() : badge(k === "f" ? "ungroup" : "remove"));
      }),
    );
    // texts that depend on the mode
    S().pages.forEach((p, i) => !p.items.length && home.renderPage(i));
    if (!on) H.$$(".tile.selected").forEach((t) => t.classList.remove("selected"));
    if (!S().dock.length) home.renderDock();
    const fl = H.$(".folder-layer");
    if (fl) {
      fl.classList.toggle("editing", on);
      const nm = fl.querySelector(".folder-name");
      if (nm) nm.readOnly = !on;
      const hint = fl.querySelector(".folder-hint");
      if (hint) hint.textContent = on ? "앱을 끌어 순서를 바꾸거나 바깥으로 꺼낼 수 있어요." : "길게 누르면 편집할 수 있어요.";
    }
  }

  /* ---------- taps ---------- */
  let suppressUntil = 0;
  /* Swallow the click that some browsers fire right after a long-press or drag. */
  home.suppressNextClick = (ms = 650) => (suppressUntil = Date.now() + ms);

  function onTileClick(e) {
    if (Date.now() < suppressUntil) {
      suppressUntil = 0;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (H.pager?.consumedClick()) {
      e.preventDefault();
      return;
    }
    const delPage = e.target.closest("[data-del-page]");
    if (delPage) return home.deletePage(Number(delPage.dataset.delPage));
    const badgeEl = e.target.closest("[data-badge]");
    const tile = e.target.closest(".tile");
    // selecting several: a tap (on the tile or its badge) picks it
    if (home.selecting && tile && selectable(tile) && tile.dataset.ctx !== "library") {
      e.preventDefault();
      return home.toggleSelect(tile.dataset.key);
    }
    if (!tile) {
      // tap on empty space in edit mode ends editing (like iPadOS)
      if (home.editing && !home.selecting && e.target.closest(".grid, .page.home") && !e.target.closest(".tile")) home.setEditing(false);
      return;
    }
    const key = tile.dataset.key;
    const t = key[0];
    const id = key.slice(2);
    if (badgeEl) {
      e.preventDefault();
      if (t === "a") {
        if (tile.dataset.ctx === "dock") home.toggleDock(id);
        else if (tile.dataset.ctx === "folder") H.folders.removeApp(id);
        else home.removeFromHome(id);
      } else if (t === "w") H.widgetEditor.remove(id);
      else if (t === "f") home.ungroup(id);
      return;
    }
    if (t === "a") {
      const app = S().apps[id];
      if (!app) return;
      if (home.editing && tile.dataset.ctx !== "library") return H.sheets.appEditor(id);
      H.fx?.launch(tile);
      H.launch.app(app);
      if (tile.dataset.ctx === "folder") H.folders.close();
      return;
    }
    if (t === "f") return H.folders.open(id, tile);
    if (t === "w") {
      const w = S().widgets[id];
      if (!w) return;
      if (home.editing) return H.widgetEditor.open(id);
      const type = H.WTYPES[w.type];
      const act = e.target.closest("[data-act]");
      const ctx = H.widgetActCtx(id);
      if (act && type.act) {
        e.preventDefault();
        type.act(w, act.dataset.act, act.dataset, ctx);
      } else if (type.tap) type.tap(w, ctx);
      else H.widgetEditor.open(id);
    }
  }

  /* ---------- context menus ---------- */
  home.menuFor = (tile, point) => {
    const key = tile.dataset.key;
    const t = key[0];
    const id = key.slice(2);
    const rect = point ? null : tile.querySelector(".icon, .wg")?.getBoundingClientRect() || tile.getBoundingClientRect();
    const where = point ? { x: point.x, y: point.y } : { rect };
    const editItem = { label: home.editing ? "편집 완료" : "홈 화면 편집", glyph: "grid", act: () => home.setEditing(!home.editing) };
    const selectItem = { label: "여러 개 선택", glyph: "check", act: () => home.setSelecting(true, key) };
    tile.classList.add("menu-target");
    const onClose = () => tile.classList.remove("menu-target");
    if (t === "a") {
      const app = S().apps[id];
      if (!app) return;
      const ctx = tile.dataset.ctx;
      const loc = home.locate(id);
      const inDock = S().dock.includes(id);
      const items = [];
      if (app.app && app.web) {
        items.push({ label: "앱으로 열기", glyph: "arrowUR", act: () => H.launch.app(app, { force: "app" }) });
        items.push({ label: "웹으로 열기", glyph: "globe", act: () => H.launch.app(app, { force: "web" }) });
      } else items.push({ label: "열기", glyph: "arrowUR", act: () => H.launch.app(app) });
      items.push({ label: "앱 편집", glyph: "edit", act: () => H.sheets.appEditor(id) });
      items.push({ sep: true });
      if (ctx === "folder") items.push({ label: "폴더에서 꺼내기", glyph: "upload", act: () => H.folders.removeApp(id) });
      else if (loc.where === "library") items.push({ label: "홈 화면에 추가", glyph: "home", act: () => home.addToHome(id) });
      else if (ctx !== "dock") items.push({ label: "홈 화면에서 제거", glyph: "minus", act: () => home.removeFromHome(id) });
      if (loc.where === "page" && S().pages.length > 1 && ctx !== "dock")
        items.push({ row: S().pages.map((_, i) => ({ label: `${i + 1}쪽`, on: i === loc.page, act: () => home.moveToPage("a:" + id, i) })) });
      items.push({ label: inDock ? "Dock에서 빼기" : "Dock에 넣기", glyph: "dock", act: () => home.toggleDock(id) });
      if (ctx !== "library") items.push(editItem, selectItem);
      items.push({ sep: true });
      items.push({ label: "바로가기 삭제", glyph: "trash", danger: true, act: () => home.deleteShortcut(id) });
      H.ui.menu({ ...where, title: app.name, items, onClose });
    } else if (t === "w") {
      const w = S().widgets[id];
      if (!w) return;
      const type = H.WTYPES[w.type];
      const items = [{ label: "위젯 편집", glyph: "sliders", act: () => H.widgetEditor.open(id) }];
      if (w.type === "hero" || w.type === "clock" || w.type === "timer") items.push({ label: "스탠바이 시계로 보기", glyph: "clock", act: () => H.standby.open() });
      if (type.sizes.length > 1) items.push({ row: type.sizes.map((z) => ({ label: H.SIZE_NAME[z], on: z === w.size, act: () => home.setWidgetSize(id, z) })) });
      const wp = S().pages.findIndex((p) => p.items.includes("w:" + id));
      if (S().pages.length > 1) items.push({ row: S().pages.map((_, i) => ({ label: `${i + 1}쪽`, on: i === wp, act: () => home.moveToPage("w:" + id, i) })) });
      items.push(editItem, selectItem, { sep: true }, { label: "위젯 제거", glyph: "trash", danger: true, act: () => H.widgetEditor.remove(id) });
      H.ui.menu({ ...where, title: type.name, items, onClose });
    } else if (t === "f") {
      const f = S().folders[id];
      if (!f) return;
      H.ui.menu({
        ...where,
        title: f.name,
        onClose,
        items: [
          { label: "폴더 열기", glyph: "folder", act: () => H.folders.open(id, tile) },
          { label: "이름 변경", glyph: "text", act: () => home.renameFolder(id) },
          editItem,
          selectItem,
          { sep: true },
          { label: "폴더 풀기", glyph: "layers", danger: true, act: () => home.ungroup(id) },
        ],
      });
    }
    H.haptic(8);
  };

  /* ---------- wiring ---------- */
  home.init = () => {
    document.addEventListener("click", (e) => {
      if (e.target.closest(".sheet-layer, .ctx-menu, .spotlight, .toast")) return;
      if (e.target.closest(".tile, .grid, .page.home")) onTileClick(e);
      const jump = e.target.closest("[data-jump]");
      if (jump) H.pager.go(Number(jump.dataset.jump));
    });
    // right click / Android long-press contextmenu → our menu
    document.addEventListener("contextmenu", (e) => {
      const tile = e.target.closest(".tile");
      if (!tile || e.target.closest(".sheet-layer")) return;
      e.preventDefault();
      if (H.drag?.active()) return;
      if (e.pointerType === "touch" || H.drag?.recentLongPress()) return; // handled by long-press logic
      home.menuFor(tile, { x: e.clientX, y: e.clientY });
    });
    // keyboard: Shift+F10 / ContextMenu key on a focused tile
    document.addEventListener("keydown", (e) => {
      const tile = document.activeElement?.closest?.(".tile");
      if (tile && ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu")) {
        e.preventDefault();
        home.menuFor(tile);
      }
    });
    H.listen("change", (d) => {
      if (d.scope === "stats") return H.library?.render({ soft: true });
      if (d.scope?.startsWith("widget:")) return home.renderWidget(d.scope.slice(7));
      if (d.scope === "motion") {
        H.applyTheme();
        H.bg?.sync();
        Object.values(S().widgets).filter((w) => w.type === "ambient").forEach((w) => home.renderWidget(w.id));
        return;
      }
      if (d.remote) H.assets.preload().then(() => home.render());
      H.applyTheme();
      H.bg?.sync();
      home.render();
    });
    H.listen("assets", () => {
      H.assets.preload().then(() => {
        home.render();
        H.bg?.sync(true);
      });
    });
    H.listen("assets-remote", (keys) => {
      H.assets.invalidate(keys);
      H.assets.preload().then(() => {
        home.render();
        if (keys.some((k) => k.startsWith("bg:"))) H.bg?.sync(true);
      });
    });
    H.listen("weather", () => Object.values(S().widgets).filter((w) => w.type === "weather").forEach((w) => home.renderWidget(w.id)));
    H.listen("needs-link", (id) => H.sheets.needsLink(id));
    H.listen("internal", (what) => what === "settings" && H.sheets.settings());
  };

  /* ---------- ticker: clocks, timers, rotating photos ----------
     Wakes only when something on screen actually changes: every second only while a seconds display,
     an analog second hand or a running timer is visible; at the next photo change; otherwise once a
     minute, on the minute. Nothing runs while the page is hidden. */
  let lastMinute = -1;
  let tickTimer = 0;
  const needOf = (w) => {
    const type = H.WTYPES[w.type];
    if (!type) return null;
    return typeof type.tick === "function" ? type.tick(w, { saver: !!H.power?.saver() }) : type.tick || null;
  };
  home.tick = () => {
    if (document.hidden) return;
    const now = new Date();
    const minuteChanged = now.getMinutes() !== lastMinute;
    lastMinute = now.getMinutes();
    if (minuteChanged) H.topbar?.tick(now);
    for (const w of Object.values(S().widgets)) {
      const type = H.WTYPES[w.type];
      if (!type) continue;
      const patch = type.maintain?.(w);
      if (patch) {
        H.store.commit((s) => Object.assign(s.widgets[w.id], patch), { undo: false, scope: "widget:" + w.id });
        continue;
      }
      if (type.advance) {
        const p = type.advance(w, now.getTime(), H.widgetActCtx(w.id));
        if (p) {
          H.store.commit((s) => Object.assign(s.widgets[w.id], p), { undo: false, scope: "widget:" + w.id });
          continue;
        }
      }
      const need = needOf(w);
      if (need === "second" || typeof need === "number" || (need === "minute" && minuteChanged)) {
        if (type.refresh) H.$$(`.tile.widget[data-key="w:${CSS.escape(w.id)}"]`).forEach((el) => type.refresh(el, w, { now }));
        else home.renderWidget(w.id);
      }
    }
  };
  /* ms until the next moment anything needs redrawing */
  home.nextTickIn = (nowMs = Date.now()) => {
    let next = 60000 - (nowMs % 60000);
    for (const w of Object.values(S().widgets)) {
      const need = needOf(w);
      if (need === "second") return 1000 - (nowMs % 1000);
      if (typeof need === "number" && need > 0) {
        const ms = need * 1000;
        next = Math.min(next, ms - (nowMs % ms));
      }
    }
    return next;
  };
  home.scheduleTick = () => {
    clearTimeout(tickTimer);
    tickTimer = 0;
    if (document.hidden) return;
    tickTimer = setTimeout(() => {
      tickTimer = 0;
      home.tick();
      home.scheduleTick();
    }, home.nextTickIn() + 15);
  };
  home.startTicker = () => {
    home.tick();
    home.scheduleTick();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        lastMinute = -1;
        home.tick();
      }
      home.scheduleTick();
    });
    // a timer started, a widget added, seconds switched on… → the wake-up time may change
    H.listen("change", () => tickTimer && home.scheduleTick());
    H.listen("power", () => {
      Object.values(S().widgets)
        .filter((w) => ["hero", "clock", "photo", "ambient"].includes(w.type))
        .forEach((w) => home.renderWidget(w.id));
      home.scheduleTick();
    });
  };

  H.home = home;
})();
