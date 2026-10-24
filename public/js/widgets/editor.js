/* Ὁρμή — widget rendering glue, editor sheet and widget gallery. Shared by launcher and studio. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;

  /* ---------- rendering ---------- */
  function allEvents() {
    const out = [];
    Object.values(S().widgets).forEach((w) => {
      if (w.type === "dday") w.events.forEach((e) => out.push(e));
    });
    return out;
  }
  H.widgetRenderCtx = (w, extra = {}) => ({
    now: extra.now || new Date(),
    prefs: S().prefs,
    theme: S().theme,
    size: w.size,
    motion: S().motion.on,
    saver: !!H.power?.saver(),
    asset: (k) => H.assets.urlSync(k),
    events: w.type === "calendar" ? allEvents() : [],
    pageLabel: extra.pageLabel || "",
  });
  H.widgetInner = (w, extra) => {
    const t = H.WTYPES[w.type];
    if (!t) return "";
    try {
      return t.render(w, H.widgetRenderCtx(w, extra));
    } catch (e) {
      console.error(e);
      return '<div class="wg-empty">위젯을 표시하지 못했어요</div>';
    }
  };
  H.widgetHTML = (w, { editing = false, extra = {}, tag = "div" } = {}) => {
    const t = H.WTYPES[w.type];
    if (!t) return "";
    const style = S().theme.widgetStyle;
    return `<${tag} class="tile widget wt-${w.type} ws-${w.size} wst-${style} ${t.bare ? "bare" : ""}" data-key="w:${H.esc(w.id)}" data-type="${w.type}" tabindex="0" role="group" aria-label="${H.esc(t.name)} 위젯">
      <div class="wg">${H.widgetInner(w, extra)}</div>${editing ? `<button type="button" class="badge del" data-badge="remove" aria-label="위젯 제거">${H.badgeGlyphs ? H.badgeGlyphs() : H.svg("minus")}</button>` : ""}</${tag}>`;
  };

  /* Context handed to widget act()/tap() handlers. */
  H.widgetActCtx = (id) => ({
    patch(p, opts = {}) {
      H.store.commit((s) => s.widgets[id] && Object.assign(s.widgets[id], p), { undo: false, scope: "widget:" + id, quiet: !!opts.quiet });
    },
    toast: (m) => H.ui.toast(m),
    openApp(appId) {
      const a = S().apps[appId];
      if (a) H.launch.app(a);
    },
    openURL: (u) => H.launch.url(u),
    edit: () => editor(id),
    toggleMotion() {
      H.store.commit((s) => (s.motion.on = !s.motion.on), { undo: false, scope: "motion" });
      if (S().motion.on && H.power?.saver()) H.ui.toast("배경 움직임을 켰지만 지금은 절전 모드라 멈춰 있어요. 설정 → 배터리에서 바꿀 수 있어요.", { ms: 4200 });
      else H.ui.toast(S().motion.on ? "배경 움직임을 켰어요." : "배경 움직임을 껐어요.");
    },
  });

  /* ---------- editor ---------- */
  const fieldHTML = (f, w) => {
    const v = w[f.k];
    const lab = (inner, hint = "") => `<label class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span>${inner}${hint ? `<small>${hint}</small>` : ""}</label>`;
    switch (f.type) {
      case "text":
        return lab(`<input class="input" data-f="${f.k}" maxlength="${f.max || 100}" value="${H.esc(v)}" placeholder="${H.esc(f.placeholder || "")}">`);
      case "textarea":
        return lab(`<textarea class="input" rows="6" data-f="${f.k}" maxlength="${f.max || 1000}">${H.esc(v)}</textarea>`);
      case "number":
        return lab(`<input class="input" type="number" inputmode="numeric" data-f="${f.k}" data-num="1" min="${f.min}" max="${f.max}" value="${H.esc(v)}">`);
      case "url":
        return lab(`<input class="input" type="url" data-f="${f.k}" value="${H.esc(v)}" placeholder="https://… 또는 앱 주소" autocapitalize="off" autocorrect="off" spellcheck="false">`, "웹 주소나 앱 주소(예: youtube://, shortcuts://run-shortcut?name=…)");
      case "toggle":
        return `<label class="switch-row" data-k="${f.k}"><span><b>${H.esc(f.label)}</b></span><input type="checkbox" class="switch" data-f="${f.k}" data-bool="1" ${v ? "checked" : ""}></label>`;
      case "segment":
        return `<div class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span>${H.ui.seg(f.k, f.options, v)}</div>`;
      case "select":
        return lab(`<select class="input" data-f="${f.k}" ${typeof f.options[0][0] === "number" ? 'data-num="1"' : ""}>${f.options.map(([val, l]) => `<option value="${H.esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${H.esc(l)}</option>`).join("")}</select>`);
      case "glyph":
        return `<div class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span><div class="glyph-grid compact">${H.APP_GLYPHS.map(([g, l]) => `<button type="button" class="glyph-pick ${g === v ? "on" : ""}" data-glyph="${g}" title="${l}" aria-label="${l}">${H.svg(g)}</button>`).join("")}</div></div>`;
      case "todoList":
        return `<div class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span><ul class="edit-list" data-list="todo">${v.map((x) => `<li data-id="${H.esc(x.id)}"><input type="checkbox" class="chk-input" ${x.done ? "checked" : ""} aria-label="완료"><input class="input" value="${H.esc(x.text)}" maxlength="120"><button type="button" class="icon-btn" data-del aria-label="삭제">${H.svg("trash")}</button></li>`).join("")}</ul>
          <div class="row"><input class="input" data-new placeholder="새 할 일 입력 후 Enter" maxlength="120"><button type="button" class="btn" data-add>추가</button></div>
          <button type="button" class="link-btn" data-clear-done>완료한 항목 지우기</button></div>`;
      case "eventList":
        return `<div class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span><ul class="edit-list" data-list="event">${v.map((x) => `<li data-id="${H.esc(x.id)}"><input class="input" data-e="title" value="${H.esc(x.title)}" maxlength="40" placeholder="이름"><input class="input date" type="date" data-e="date" value="${H.esc(x.date)}"><button type="button" class="icon-btn" data-del aria-label="삭제">${H.svg("trash")}</button></li>`).join("")}</ul>
          <button type="button" class="btn" data-add-event>${H.svg("plus")} 날짜 추가</button></div>`;
      case "photos":
        return `<div class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span><div class="photo-edit">${v.map((k) => `<div class="ph" data-key="${H.esc(k)}"><img src="${H.assets.urlSync(k) || ""}" alt=""><button type="button" class="icon-btn" data-del aria-label="사진 삭제">${H.svg("close")}</button></div>`).join("")}
          <label class="ph add">${H.svg("plus")}<span>사진 추가</span><input type="file" accept="image/*" multiple hidden data-photos></label></div><small>최대 12장 · GIF는 움직이는 그대로 보여요</small></div>`;
      case "place":
        return `<div class="field" data-k="${f.k}"><span>${H.esc(f.label)}</span><div class="place-now">${H.svg("location")}<b>${H.esc(v?.name || "설정 안 됨")}</b></div>
          <div class="row"><input class="input" data-place-q placeholder="도시 이름 (예: 부산, 도쿄)"><button type="button" class="btn" data-place-search>검색</button></div>
          <ul class="place-results"></ul><button type="button" class="btn ghost" data-place-locate>${H.svg("location")} 현재 위치 사용</button></div>`;
      case "timetable":
        return timetableHTML(w);
      default:
        return "";
    }
  };

  function timetableHTML(w) {
    const days = ["월", "화", "수", "목", "금", "토"].slice(0, w.days);
    const rows = Array.from({ length: w.periods }, (_, p) => `<tr><th><b>${p + 1}</b><input class="input time" type="time" data-tt-time="${p}" value="${w.times[p]}"></th>${days.map((_, d) => `<td><input class="input" data-tt="${d},${p}" value="${H.esc(w.grid[d][p])}" maxlength="16" placeholder="—"></td>`).join("")}</tr>`).join("");
    return `<div class="field" data-k="grid"><span>요일·교시</span>
      <div class="row wrap">${H.ui.seg("days", [[5, "월–금"], [6, "월–토"]], w.days)}
      <label class="mini-field">교시 수<input class="input" type="number" min="1" max="9" data-f="periods" data-num="1" value="${w.periods}"></label>
      <label class="mini-field">수업 시간(분)<input class="input" type="number" min="10" max="120" data-f="duration" data-num="1" value="${w.duration}"></label></div>
      <div class="tt-edit"><table><tr><th>교시·시작</th>${days.map((d) => `<th>${d}</th>`).join("")}</tr>${rows}</table></div></div>`;
  }

  function editor(id, { isNew = false } = {}) {
    const w0 = S().widgets[id];
    if (!w0) return;
    const t = H.WTYPES[w0.type];
    const snap = H.store.snapshot();
    let pend = {};
    let flushPend = null;
    const s = H.ui.sheet({
      title: t.name,
      sub: H.esc(t.desc || ""),
      size: "md",
      cls: "widget-editor",
      foot: `<button type="button" class="btn danger ghost" data-remove>${H.svg("trash")} 위젯 삭제</button><span class="spacer"></span><button type="button" class="btn primary" data-done>완료</button>`,
      onClose: () => {
        flushPend?.flush();
        if (H.store.pushUndo(snap, isNew ? "위젯 추가" : "위젯 편집")) H.emit("change", { label: "widget-edit", undoable: true, scope: "all" });
      },
    });
    const draw = () => {
      const w = S().widgets[id];
      if (!w) return s.close();
      const sizes = t.sizes.length > 1 ? `<div class="field"><span>크기</span>${H.ui.seg("__size", t.sizes.map((z) => [z, H.SIZE_NAME[z]]), w.size)}</div>` : "";
      const fields = t.fields.filter((f) => !f.when || f.when(w)).map((f) => fieldHTML(f, w)).join("");
      s.body.innerHTML = `<div class="editor-preview"><div class="preview-grid">${H.widgetHTML(w)}</div></div><div class="form">${sizes}${fields}${!t.fields.length ? '<p class="muted">설정할 항목이 없는 위젯이에요.</p>' : ""}</div>`;
    };
    const refreshPreview = () => {
      const w = S().widgets[id];
      const box = s.body.querySelector(".preview-grid");
      if (w && box) box.innerHTML = H.widgetHTML(w);
    };
    const patch = (p, redraw = false) => {
      if (Object.keys(pend).length) {
        p = { ...pend, ...p };
        pend = {};
      }
      H.store.commit((st) => st.widgets[id] && Object.assign(st.widgets[id], p), { undo: false, scope: "widget:" + id });
      if (redraw) draw();
      else refreshPreview();
    };
    // typing is batched; values from several fields are merged so nothing is lost
    flushPend = H.debounce(() => {
      const p = pend;
      pend = {};
      if (Object.keys(p).length) patch(p);
    }, 160);
    const patchLater = (p) => {
      Object.assign(pend, p);
      flushPend();
    };
    patchLater.cancel = () => flushPend.flush();
    draw();

    const W = () => S().widgets[id];
    const cur = (k) => (k in pend ? pend[k] : W()[k]);
    s.body.addEventListener("input", (e) => {
      const el = e.target;
      if (el.dataset.f) {
        const v = el.dataset.bool ? el.checked : el.dataset.num ? Number(el.value) : el.value;
        if (el.dataset.num && !Number.isFinite(v)) return;
        const needsRedraw = ["mode", "periods", "total"].includes(el.dataset.f);
        if (el.tagName === "SELECT" || el.type === "checkbox" || needsRedraw) patch({ [el.dataset.f]: v }, needsRedraw && e.type === "change");
        else patchLater({ [el.dataset.f]: v });
        return;
      }
      if (el.dataset.ttTime !== undefined) {
        const times = cur("times").slice();
        times[Number(el.dataset.ttTime)] = el.value;
        patchLater({ times });
      }
      if (el.dataset.tt) {
        const [d, p] = el.dataset.tt.split(",").map(Number);
        const grid = cur("grid").map((r) => r.slice());
        grid[d][p] = el.value;
        patchLater({ grid });
      }
      const li = el.closest(".edit-list li");
      if (li && !el.matches(".chk-input")) {
        const list = li.parentElement.dataset.list;
        if (list === "todo") patchLater({ items: cur("items").map((x) => (x.id === li.dataset.id ? { ...x, text: el.value } : x)) });
        if (list === "event") patchLater({ events: cur("events").map((x) => (x.id === li.dataset.id ? { ...x, [el.dataset.e]: el.value } : x)) });
      }
    });
    s.body.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.f && ["periods", "total", "mode"].includes(el.dataset.f)) {
        patchLater.cancel();
        patch({ [el.dataset.f]: el.dataset.num ? Number(el.value) : el.value }, true);
      }
      if (el.matches(".chk-input")) {
        const li = el.closest("li");
        patch({ items: W().items.map((x) => (x.id === li.dataset.id ? { ...x, done: el.checked } : x)) });
      }
      if (el.matches("[data-photos]")) addPhotos([...el.files]);
    });
    s.body.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("[data-new]")) {
        e.preventDefault();
        s.body.querySelector("[data-add]")?.click();
      }
      if (e.key === "Enter" && e.target.matches("[data-place-q]")) {
        e.preventDefault();
        s.body.querySelector("[data-place-search]")?.click();
      }
    });
    H.ui.bindSeg(s.body, (name, value) => {
      if (name === "__size") return patch({ size: value }, true);
      if (name === "days") return patch({ days: Number(value) }, true);
      patch({ [name]: value }, true);
    });
    s.body.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const w = W();
      if (b.matches(".glyph-pick")) {
        s.body.querySelectorAll(".glyph-pick").forEach((x) => x.classList.toggle("on", x === b));
        patch({ glyph: b.dataset.glyph });
      }
      if (b.matches("[data-add]")) {
        const inp = s.body.querySelector("[data-new]");
        const text = inp.value.trim();
        if (!text) return inp.focus();
        patch({ items: [...w.items, { id: H.uid("i"), text, done: false }] }, true);
        setTimeout(() => s.body.querySelector("[data-new]")?.focus(), 30);
      }
      if (b.matches("[data-clear-done]")) patch({ items: w.items.filter((x) => !x.done) }, true);
      if (b.matches("[data-add-event]")) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        patch({ events: [...w.events, { id: H.uid("i"), title: "", date: H.dateKey(d) }] }, true);
        setTimeout(() => s.body.querySelector(".edit-list li:last-child input")?.focus(), 30);
      }
      if (b.matches("[data-del]")) {
        const li = b.closest("li");
        const ph = b.closest(".ph");
        if (li?.parentElement.dataset.list === "todo") patch({ items: w.items.filter((x) => x.id !== li.dataset.id) }, true);
        if (li?.parentElement.dataset.list === "event") patch({ events: w.events.filter((x) => x.id !== li.dataset.id) }, true);
        if (ph) {
          H.assets.remove(ph.dataset.key, { silent: true });
          patch({ images: w.images.filter((k) => k !== ph.dataset.key) }, true);
        }
      }
      if (b.matches("[data-place-search]")) {
        const q = s.body.querySelector("[data-place-q]").value.trim();
        const ul = s.body.querySelector(".place-results");
        if (!q) return;
        ul.innerHTML = '<li class="muted">검색 중…</li>';
        try {
          const res = await H.weather.search(q);
          ul.innerHTML = res.length ? res.map((r, i) => `<li><button type="button" class="place-pick" data-i="${i}"><b>${H.esc(r.name)}</b><small>${H.esc(r.detail)}</small></button></li>`).join("") : '<li class="muted">결과가 없어요</li>';
          ul.onclick = (ev) => {
            const pb = ev.target.closest(".place-pick");
            if (!pb) return;
            const r = res[Number(pb.dataset.i)];
            patch({ place: { name: r.name, lat: r.lat, lon: r.lon } }, true);
          };
        } catch (err) {
          ul.innerHTML = '<li class="muted">검색하지 못했어요 (인터넷 연결 확인)</li>';
        }
      }
      if (b.matches("[data-place-locate]")) {
        const place = await H.weather.locate();
        if (place) patch({ place }, true);
      }
    });
    async function addPhotos(files) {
      const w = W();
      const room = 12 - w.images.length;
      if (room <= 0) return H.ui.toast("사진은 12장까지 넣을 수 있어요.");
      const keys = [];
      for (const f of files.slice(0, room)) {
        try {
          const blob = await H.assets.processImage(f, "widget");
          const key = `w:${id}:${H.uid("").slice(-8)}`;
          await H.assets.put(key, blob, { name: f.name });
          await H.assets.url(key);
          keys.push(key);
        } catch (err) {
          H.ui.toast(err.message || "사진을 넣지 못했어요.");
        }
      }
      if (keys.length) patch({ images: [...W().images, ...keys] }, true);
    }
    s.foot.addEventListener("click", async (e) => {
      if (e.target.closest("[data-done]")) s.close();
      if (e.target.closest("[data-remove]")) {
        s.close();
        removeWidget(id);
      }
    });
    return s;
  }

  function removeWidget(id) {
    const w = S().widgets[id];
    if (!w) return;
    const name = H.WTYPES[w.type]?.name || "위젯";
    H.store.commit(
      (s) => {
        s.pages.forEach((p) => (p.items = p.items.filter((k) => k !== "w:" + id)));
        delete s.widgets[id];
      },
      { label: `${name} 제거` },
    );
    H.ui.toast(`${name} 위젯을 제거했어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
  }

  /* ---------- gallery (add a widget) ---------- */
  function gallery({ page } = {}) {
    const cards = H.WIDGET_ORDER.map((type) => {
      const t = H.WTYPES[type];
      const demo = { ...H.makeWidget(type, t.size), id: "demo-" + type };
      return `<article class="wgal-card" data-type="${type}">
        <div class="wgal-preview"><div class="preview-grid">${H.widgetHTML(demo)}</div></div>
        <div class="wgal-info"><b>${H.esc(t.name)}</b><small>${H.esc(t.desc)}</small>
        <div class="wgal-actions">${t.sizes.length > 1 ? H.ui.seg("size-" + type, t.sizes.map((z) => [z, H.SIZE_NAME[z]]), t.size) : `<span class="muted">${H.SIZE_NAME[t.sizes[0]]}</span>`}
        <button type="button" class="btn primary" data-add-widget="${type}">${H.svg("plus")} 추가</button></div></div></article>`;
    }).join("");
    const s = H.ui.sheet({ title: "위젯 추가", sub: "지금 보고 있는 페이지의 위젯들 바로 뒤에 놓여요. 편집 모드에서 끌어서 옮길 수 있어요.", size: "lg", cls: "widget-gallery", body: `<div class="wgal">${cards}</div>` });
    const chosen = {};
    H.ui.bindSeg(s.body, (name, v) => {
      const type = name.slice(5);
      chosen[type] = v;
      const card = s.body.querySelector(`.wgal-card[data-type="${type}"] .preview-grid`);
      const demo = { ...H.makeWidget(type, v), id: "demo-" + type };
      if (card) card.innerHTML = H.widgetHTML(demo);
    });
    s.body.addEventListener("click", (e) => {
      const b = e.target.closest("[data-add-widget]");
      if (!b) return;
      const type = b.dataset.addWidget;
      const w = H.makeWidget(type, chosen[type] || H.WTYPES[type].size);
      const target = page ?? Math.min(S().page, S().pages.length - 1);
      H.store.commit(
        (st) => {
          st.widgets[w.id] = w;
          const p = st.pages[H.clamp(target, 0, st.pages.length - 1)];
          let at = 0;
          while (at < p.items.length && p.items[at].startsWith("w:")) at++;
          p.items.splice(at, 0, "w:" + w.id);
        },
        { label: "위젯 추가" },
      );
      s.close();
      H.ui.toast(`${H.WTYPES[type].name} 위젯을 추가했어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
      if (["timetable", "photo", "link", "dday", "memo"].includes(type)) setTimeout(() => editor(w.id, { isNew: true }), 260);
      H.emit("widget-added", { id: w.id, page: target });
    });
    return s;
  }

  H.widgetEditor = { open: editor, remove: removeWidget, gallery };
})();
