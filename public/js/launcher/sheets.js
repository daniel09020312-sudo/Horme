/* Ὁρμή launcher — sheets: app editor, add app, link helper, settings, pages, install guide. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const sheets = {};
  const esc = H.esc;

  /* ================= App editor ================= */
  sheets.appEditor = (id, { page, category } = {}) => {
    const existing = id ? S().apps[id] : null;
    const isNew = !existing;
    const d = existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: "u" + H.uid("").slice(-10), name: "", glyph: "sparkle", category: category || "생산성", app: "", web: "", mode: "auto", aliases: [], added: Date.now() };
    const cat = H.catalogById(d.id);
    const loc = isNew ? { where: "page", page: page ?? H.clamp(S().page, 0, S().pages.length - 1) } : H.home.locate(d.id);
    let inDock = S().dock.includes(d.id);
    let pendingIcon = null; // Blob | "remove" | null

    const placeOptions = () => {
      const opts = S().pages.map((_, i) => [`p${i}`, `홈 화면 ${i + 1}`]);
      if (loc.where === "folder") opts.unshift(["keep", `폴더 · ${S().folders[loc.folder]?.name || ""}`]);
      opts.push(["lib", "앱 보관함에만"]);
      return opts;
    };
    const placeValue = loc.where === "folder" ? "keep" : loc.where === "page" ? `p${loc.page}` : "lib";
    const iconPreview = () => {
      if (pendingIcon instanceof Blob) return `<span class="icon custom"><img src="${URL.createObjectURL(pendingIcon)}" alt=""></span>`;
      if (pendingIcon === "remove" || !S().assets["icon:" + d.id]) return `<span class="icon">${H.svg(d.glyph)}</span>`;
      return H.home.iconHTML(d);
    };

    const s = H.ui.sheet({
      title: isNew ? "새 바로가기" : "앱 편집",
      sub: "이름·아이콘·실행 방법을 정해요. 기기에 설치된 실제 앱은 바뀌지 않아요.",
      size: "md",
      cls: "app-editor",
      body: `<form class="form" autocomplete="off">
        <div class="ae-head"><div class="ae-icon">${iconPreview()}</div>
          <div class="ae-head-side"><label class="field"><span>이름</span><input class="input" name="name" maxlength="42" value="${esc(d.name)}" placeholder="예: Notability" required></label>
          <div class="row wrap"><label class="btn">${H.svg("image")} 아이콘 이미지<input type="file" accept="image/*" hidden data-icon-file></label><button type="button" class="btn ghost" data-icon-reset>기본 아이콘</button></div></div></div>
        <div class="field"><span>기본 아이콘 기호 <small>(이미지를 넣지 않았을 때)</small></span><div class="glyph-grid">${H.APP_GLYPHS.map(([g, l]) => `<button type="button" class="glyph-pick ${g === d.glyph ? "on" : ""}" data-glyph="${g}" title="${l}" aria-label="${l}">${H.svg(g)}</button>`).join("")}</div></div>
        <label class="field"><span>카테고리</span><select class="input" name="category">${H.CATEGORIES.map((c) => `<option ${c === d.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <h3 class="form-h">실행 방법</h3>
        <label class="field"><span>앱 주소 <small>(설치된 앱을 바로 여는 주소)</small></span><input class="input mono" name="app" value="${esc(d.app)}" placeholder="예: youtube://  ·  notion://" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <div class="row wrap"><button type="button" class="btn ghost" data-shortcut>${H.svg("bolt")} 단축어로 연결…</button><span class="hint">앱 주소가 없는 앱(카메라·계산기 등)은 단축어 앱으로 열 수 있어요.</span></div>
        <label class="field"><span>웹 주소 <small>(앱이 없을 때 · 컴퓨터에서)</small></span><input class="input mono" name="web" value="${esc(d.web)}" placeholder="https://" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <div class="field"><span>여는 방식</span>${H.ui.seg("mode", [["auto", "앱 먼저, 안 되면 웹"], ["app", "앱만"], ["web", "웹만"]], d.mode)}</div>
        <div class="row"><button type="button" class="btn" data-test>${H.svg("arrowUR")} 지금 열어 보기</button><span class="hint test-hint"></span></div>
        <label class="field"><span>검색용 다른 이름 <small>(쉼표로 구분)</small></span><input class="input" name="aliases" value="${esc(d.aliases.join(", "))}" placeholder="예: 유튜브, yt"></label>
        <h3 class="form-h">위치</h3>
        <div class="row wrap"><select class="input" name="place">${placeOptions().map(([v, l]) => `<option value="${v}" ${v === placeValue ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <label class="switch-row inline"><span><b>Dock에 넣기</b></span><input type="checkbox" class="switch" name="dock" ${inDock ? "checked" : ""}></label></div>
        ${cat && !isNew ? `<button type="button" class="link-btn" data-restore>${H.svg("refresh")} 기본 링크·이름으로 되돌리기</button>` : ""}
        <button type="submit" hidden></button></form>`,
      foot: `${!isNew ? `<button type="button" class="btn danger ghost" data-delete>${H.svg("trash")} 삭제</button>` : ""}<span class="spacer"></span><button type="button" class="btn ghost" data-cancel>취소</button><button type="button" class="btn primary" data-save>${isNew ? "추가" : "저장"}</button>`,
    });
    const form = s.body.querySelector("form");
    const f = (n) => form.elements[n];
    const redrawIcon = () => (s.body.querySelector(".ae-icon").innerHTML = iconPreview());
    H.ui.bindSeg(s.body, (name, v) => name === "mode" && (d.mode = v));
    s.body.addEventListener("click", async (e) => {
      const g = e.target.closest(".glyph-pick");
      if (g) {
        d.glyph = g.dataset.glyph;
        s.body.querySelectorAll(".glyph-pick").forEach((x) => x.classList.toggle("on", x === g));
        redrawIcon();
      }
      if (e.target.closest("[data-icon-reset]")) {
        pendingIcon = "remove";
        redrawIcon();
      }
      if (e.target.closest("[data-shortcut]")) {
        const name = await H.ui.prompt({ title: "단축어로 연결", label: "단축어 이름 (단축어 앱에서 만든 이름 그대로)", value: `${f("name").value || "앱"} 열기`, max: 60, ok: "연결" });
        if (name) {
          f("app").value = H.launch.shortcutURL(name);
          d.mode = "app";
          s.body.querySelector('.seg[data-name="mode"] [data-value="app"]')?.click();
          H.ui.toast("단축어 앱에서 같은 이름으로 ‘앱 열기’ 단축어를 만들어 주세요.");
        }
      }
      if (e.target.closest("[data-test]")) {
        const app = { ...d, name: f("name").value || "앱", app: f("app").value.trim(), web: f("web").value.trim() };
        const hint = s.body.querySelector(".test-hint");
        if (app.app && !H.safeURL(app.app)) return (hint.textContent = "앱 주소 형식이 올바르지 않아요.");
        if (app.web && !H.isWebURL(app.web)) return (hint.textContent = "웹 주소는 https:// 로 시작해야 해요.");
        if (!app.app && !app.web) return (hint.textContent = "주소를 먼저 입력해 주세요.");
        hint.textContent = "여는 중…";
        H.launch.app({ ...app, id: "__test" }, {});
      }
      if (e.target.closest("[data-restore]") && cat) {
        f("name").value = cat.name;
        f("app").value = cat.app;
        f("web").value = cat.web;
        f("aliases").value = cat.aliases.join(", ");
        d.glyph = cat.glyph;
        d.mode = "auto";
        s.body.querySelector('.seg[data-name="mode"] [data-value="auto"]')?.click();
        s.body.querySelectorAll(".glyph-pick").forEach((x) => x.classList.toggle("on", x.dataset.glyph === d.glyph));
        redrawIcon();
      }
    });
    s.body.addEventListener("change", async (e) => {
      if (e.target.matches("[data-icon-file]")) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
          pendingIcon = await H.assets.processImage(file, "icon");
          redrawIcon();
        } catch (err) {
          H.ui.toast(err.message);
        }
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      save();
    });
    s.foot.addEventListener("click", (e) => {
      if (e.target.closest("[data-cancel]")) s.close();
      if (e.target.closest("[data-save]")) save();
      if (e.target.closest("[data-delete]")) {
        s.close();
        H.home.deleteShortcut(d.id);
      }
    });

    async function save() {
      const name = f("name").value.trim();
      const appURL = f("app").value.trim();
      const webURL = f("web").value.trim();
      if (!name) return H.ui.toast("이름을 입력해 주세요."), f("name").focus();
      if (appURL && !H.safeURL(appURL)) return H.ui.toast("앱 주소 형식을 확인해 주세요. 예: youtube://");
      if (webURL && !H.isWebURL(webURL)) return H.ui.toast("웹 주소는 https:// 로 시작해야 해요.");
      const next = {
        ...d,
        name,
        app: appURL,
        web: webURL,
        category: f("category").value,
        aliases: f("aliases").value.split(/[,，]/).map((x) => x.trim()).filter(Boolean).slice(0, 10),
      };
      const place = f("place").value;
      const dock = f("dock").checked;
      if (pendingIcon instanceof Blob) {
        try {
          await H.assets.put("icon:" + d.id, pendingIcon, { name: "icon", silent: true });
          await H.assets.url("icon:" + d.id);
        } catch (err) {
          return H.ui.toast(err.message || "아이콘을 저장하지 못했어요.");
        }
      }
      H.store.commit(
        (st) => {
          st.apps[d.id] = next;
          if (pendingIcon === "remove") delete st.assets["icon:" + d.id];
          if (place !== "keep") {
            const key = "a:" + d.id;
            const cur = st.pages.findIndex((p) => p.items.includes(key));
            const target = place === "lib" ? -1 : Number(place.slice(1));
            if (cur !== target) {
              st.pages.forEach((p) => (p.items = p.items.filter((k) => k !== key)));
              Object.values(st.folders).forEach((fo) => (fo.apps = fo.apps.filter((x) => x !== d.id)));
              if (target >= 0) st.pages[target].items.push(key);
            }
          }
          const has = st.dock.includes(d.id);
          if (dock && !has) {
            if (st.dock.length < H.schema.MAX_DOCK) st.dock.push(d.id);
            else H.ui.toast("Dock이 가득 찼어요.");
          }
          if (!dock && has) st.dock = st.dock.filter((x) => x !== d.id);
        },
        { label: isNew ? "앱 추가" : "앱 편집" },
      );
      H.emit("assets", ["icon:" + d.id]);
      s.close();
      H.ui.toast(isNew ? `${name}을(를) 추가했어요.` : "저장했어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
    }
    return s;
  };

  /* ================= Add app (catalog) ================= */
  sheets.addApp = ({ category, page } = {}) => {
    const have = new Set(Object.keys(S().apps));
    const all = [...H.EXTRA_APPS, ...H.DEFAULT_APPS].filter((c) => c.id !== "settings" || !have.has("settings"));
    const s = H.ui.sheet({
      title: "앱 추가",
      sub: "목록에서 고르거나 직접 만들 수 있어요. 앱 주소가 없는 앱은 웹으로 열려요.",
      size: "md",
      cls: "add-app",
      body: `<label class="lib-search small">${H.svg("search")}<input type="search" placeholder="앱 이름 검색" data-q autocomplete="off"></label>
        <button type="button" class="add-custom" data-custom>${H.svg("plus")}<span><b>직접 만들기</b><small>이름·아이콘·주소를 내 마음대로</small></span>${H.svg("chevronR")}</button>
        <div class="rows catalog"></div>`,
    });
    const listEl = s.body.querySelector(".catalog");
    const draw = () => {
      const q = s.body.querySelector("[data-q]").value.trim();
      const list = all
        .filter((c) => !q || H.matchScore(q, [c.name, ...c.aliases, c.category]) > 6)
        .sort((a, b) => Number(have.has(a.id)) - Number(have.has(b.id)) || (category ? Number(b.category === category) - Number(a.category === category) : 0));
      listEl.innerHTML = list
        .map((c) => `<div class="cat-row"><span class="icon sm">${H.svg(c.glyph)}</span><span class="row-text"><b>${esc(c.name)}</b><small>${esc(c.category)}${c.app ? " · 앱 바로 열기" : " · 웹"}</small></span>${have.has(c.id) ? '<span class="muted small">추가됨</span>' : `<button type="button" class="btn small" data-add="${c.id}">${H.svg("plus")}추가</button>`}</div>`)
        .join("") || '<p class="muted center">목록에 없어요. ‘직접 만들기’를 눌러 주세요.</p>';
    };
    draw();
    s.body.querySelector("[data-q]").addEventListener("input", draw);
    s.body.addEventListener("click", (e) => {
      if (e.target.closest("[data-custom]")) {
        s.close();
        sheets.appEditor(null, { page, category });
        return;
      }
      const b = e.target.closest("[data-add]");
      if (!b) return;
      const c = H.catalogById(b.dataset.add);
      if (!c || have.has(c.id)) return;
      const target = page ?? H.clamp(S().page, 0, S().pages.length - 1);
      H.store.commit((st) => {
        st.apps[c.id] = { ...H.makeApp(c), added: Date.now() };
        st.pages[target].items.push("a:" + c.id);
      }, { label: "앱 추가" });
      have.add(c.id);
      draw();
      H.ui.toast(`${c.name}을(를) 홈 화면 ${target + 1}에 추가했어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
    });
  };

  /* ================= Link helper for apps without an address ================= */
  sheets.needsLink = (id) => {
    const app = S().apps[id];
    if (!app) return;
    const isInterchange = id === "interchange";
    const s = H.ui.sheet({
      title: `${app.name} 연결하기`,
      sub: "아직 여는 주소가 없어요. 아래 방법 중 하나로 연결해 주세요.",
      size: "md",
      cls: "link-helper",
      body: `<div class="choice-cards">
        <section class="choice"><h3>${H.svg("bolt")} 단축어로 열기 <small>앱 주소가 없는 앱에 추천</small></h3>
          <ol class="steps-list"><li><b>단축어</b> 앱에서 <b>+</b>를 눌러 새 단축어를 만들어요.</li><li><b>‘앱 열기’</b> 동작을 추가하고 <b>${esc(app.name)}</b>을(를) 골라요.</li><li>단축어 이름을 아래와 똑같이 저장해요.</li></ol>
          <div class="row"><input class="input" data-sc value="${esc(app.name)} 열기" maxlength="60"><button type="button" class="btn primary" data-sc-save>연결</button></div>
          <button type="button" class="link-btn" data-sc-open>${H.svg("external")} 단축어 앱 열기</button></section>
        <section class="choice"><h3>${H.svg("globe")} 웹 주소</h3>${isInterchange ? '<p class="hint">배포한 게임 주소(https://…)를 넣으면 바로 열려요.</p>' : ""}
          <div class="row"><input class="input mono" data-web placeholder="https://" inputmode="url" autocapitalize="off"><button type="button" class="btn" data-web-save>저장</button></div></section>
        <section class="choice"><h3>${H.svg("arrowUR")} 앱 주소 직접 입력</h3>
          <div class="row"><input class="input mono" data-app placeholder="예: myapp://" autocapitalize="off"><button type="button" class="btn" data-app-save>저장</button></div></section></div>`,
      foot: `<button type="button" class="btn ghost" data-full>${H.svg("edit")} 앱 편집 열기</button>`,
    });
    const set = (patch, msg) => {
      H.store.commit((st) => Object.assign(st.apps[id], patch), { label: "앱 연결" });
      s.close();
      H.ui.toast(msg, { action: { label: "열어 보기", fn: () => H.launch.app(S().apps[id]) } });
    };
    s.body.addEventListener("click", (e) => {
      if (e.target.closest("[data-sc-save]")) {
        const n = s.body.querySelector("[data-sc]").value.trim();
        if (n) set({ app: H.launch.shortcutURL(n), mode: "app" }, "단축어로 연결했어요.");
      }
      if (e.target.closest("[data-sc-open]")) H.launch.url("shortcuts://create-shortcut");
      if (e.target.closest("[data-web-save]")) {
        const v = s.body.querySelector("[data-web]").value.trim();
        if (!H.isWebURL(v)) return H.ui.toast("https:// 로 시작하는 주소를 넣어 주세요.");
        set({ web: v }, "웹 주소를 연결했어요.");
      }
      if (e.target.closest("[data-app-save]")) {
        const v = s.body.querySelector("[data-app]").value.trim();
        if (!H.safeURL(v) || H.isWebURL(v)) return H.ui.toast("앱 주소 형식이 아니에요. 예: myapp://");
        set({ app: v, mode: "app" }, "앱 주소를 연결했어요.");
      }
    });
    s.foot.querySelector("[data-full]").onclick = () => {
      s.close();
      sheets.appEditor(id);
    };
  };

  /* ================= Pages ================= */
  sheets.pages = () => {
    let off = null;
    const s = H.ui.sheet({ title: "페이지 관리", sub: "순서를 바꾸거나 빈 페이지를 지울 수 있어요.", size: "sm", cls: "pages-sheet", foot: `<button type="button" class="btn primary" data-new>${H.svg("plus")} 새 페이지</button>`, onClose: () => off?.() });
    const draw = () => {
      const st = S();
      s.body.innerHTML = `<ol class="page-list">${st.pages
        .map((p, i) => {
          const n = (t) => p.items.filter((k) => k[0] === t).length;
          const parts = [n("a") && `앱 ${n("a")}`, n("w") && `위젯 ${n("w")}`, n("f") && `폴더 ${n("f")}`].filter(Boolean).join(" · ") || "비어 있음";
          return `<li><button type="button" class="pg-go" data-go="${i}"><b>홈 화면 ${i + 1}</b><small>${parts}</small></button>
            <button type="button" class="icon-btn" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="위로">${H.svg("chevronU")}</button>
            <button type="button" class="icon-btn" data-down="${i}" ${i === st.pages.length - 1 ? "disabled" : ""} aria-label="아래로">${H.svg("chevronD")}</button>
            <button type="button" class="icon-btn danger" data-del="${i}" ${st.pages.length === 1 ? "disabled" : ""} aria-label="삭제">${H.svg("trash")}</button></li>`;
        })
        .join("")}</ol>`;
    };
    draw();
    off = H.listen("change", () => draw());
    s.body.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.go) {
        s.close();
        H.pager.go(Number(b.dataset.go));
      }
      const move = (i, j) => H.store.commit((st) => st.pages.splice(j, 0, st.pages.splice(i, 1)[0]), { label: "페이지 순서" });
      if (b.dataset.up) move(Number(b.dataset.up), Number(b.dataset.up) - 1);
      if (b.dataset.down) move(Number(b.dataset.down), Number(b.dataset.down) + 1);
      if (b.dataset.del) {
        const i = Number(b.dataset.del);
        const p = S().pages[i];
        if (p.items.length) {
          const ok = await H.ui.confirm({ title: `홈 화면 ${i + 1} 삭제`, msg: "이 페이지의 앱은 앱 보관함으로 옮겨지고, 위젯은 지워져요.", ok: "삭제", danger: true });
          if (!ok) return;
        }
        H.store.commit((st) => {
          const [pg] = st.pages.splice(i, 1);
          pg.items.forEach((k) => {
            if (k[0] === "w") delete st.widgets[k.slice(2)];
            if (k[0] === "f") delete st.folders[k.slice(2)];
          });
          st.page = H.clamp(st.page, 0, st.pages.length);
        }, { label: "페이지 삭제" });
        H.ui.toast("페이지를 삭제했어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
      }
    });
    s.foot.querySelector("[data-new]").onclick = () => {
      if (S().pages.length >= H.schema.MAX_PAGES) return H.ui.toast(`페이지는 ${H.schema.MAX_PAGES}개까지 만들 수 있어요.`);
      H.store.commit((st) => st.pages.push({ id: H.uid("p"), items: [] }), { label: "페이지 추가" });
      H.ui.toast("새 페이지를 만들었어요. 편집 모드에서 아이콘을 끌어 채워 보세요.");
    };
  };

  /* ================= Settings ================= */
  sheets.settings = () => {
    const st = S();
    const themeChips = Object.entries(H.THEMES).map(([k, t]) => `<button type="button" class="theme-chip ${st.theme.preset === k ? "on" : ""}" data-theme="${k}" style="--a:${t.accent};--b:${t.accent2}"><i></i><span>${t.name}</span></button>`).join("");
    let offPower = null;
    const s = H.ui.sheet({
      title: "Ὁρμή 설정",
      onClose: () => offPower?.(),
      sub: "이 설정은 Ὁρμή 안에서만 적용돼요. 기기의 실제 설정은 바뀌지 않아요.",
      size: "md",
      cls: "settings-sheet",
      body: `<div class="form">
        <a class="studio-banner" href="studio.html">${H.svg("palette")}<span><b>디자인 스튜디오</b><small>배경 사진·영상, 아이콘 이미지, 색과 분위기</small></span>${H.svg("chevronR")}</a>
        <div class="row wrap"><button type="button" class="btn" data-pack>${H.svg("layers")} 디자인 팩 적용 (파일 한 번에)</button><a class="btn ghost" href="studio.html?step=pack">${H.svg("wand")} AI로 디자인 팩 만들기</a></div>
        <h3 class="form-h">테마</h3><div class="theme-chips">${themeChips}</div>
        ${H.ui.switch("set-motion", st.motion.on, "배경 움직임", "입자·물결 애니메이션. 절전 모드이거나 기기의 ‘동작 줄이기’가 켜져 있으면 멈춰요.")}
        <label class="field"><span>입자 수 <small data-density-v>${st.motion.density}</small></span><input type="range" min="0" max="80" step="2" value="${st.motion.density}" data-density></label>
        <h3 class="form-h">움직임 · 효과</h3>
        <div class="field"><span>페이지 넘김</span>${H.ui.seg("fx-page", [["jelly", "젤리"], ["slide", "기본"], ["depth", "깊이"], ["cube", "큐브"]], st.prefs.fx.page)}<small>젤리: 넘길 때 아이콘이 열마다 살짝 늦게 따라와요 · 깊이: 뒤로 물러나며 돌아요 · 큐브: 정육면체처럼 돌아요</small></div>
        <div class="field"><span>쫀득함</span>${H.ui.seg("fx-bounce", [["soft", "담백하게"], ["mid", "보통"], ["chewy", "쫀득하게"]], st.prefs.fx.bounce)}<small>페이지·아이콘·창이 멈출 때 튕기는 정도예요.</small></div>
        ${H.ui.switch("set-fx-touch", st.prefs.fx.touch, "손끝 반응 배경", "누른 곳에서 빛이 퍼지고, 손가락을 따라 입자가 비켜나요.")}
        ${H.ui.switch("set-fx-tilt", st.prefs.fx.tilt, "아이콘 기울기 · 빛 반사", "누르는 쪽으로 아이콘이 기울고 빛이 손끝을 따라와요. 트랙패드로 올리면 살짝 떠올라요.")}
        ${H.ui.switch("set-fx-parallax", st.prefs.fx.parallax, "배경 깊이감", "페이지를 넘기면 배경이 더 느리게, 입자는 더 빠르게 따라와요.")}
        ${H.ui.switch("set-fx-magnify", st.prefs.fx.magnify, "Dock 확대", "Dock 위를 손가락으로 쓸거나 트랙패드로 올리면 아이콘이 커져요.")}
        <h3 class="form-h">배터리</h3>
        <div class="field"><span>전원 모드</span>${H.ui.seg("power", [["auto", "자동"], ["saver", "절전"], ["normal", "기본"], ["smooth", "부드럽게"]], st.prefs.power)}<div class="power-status" data-power-status></div></div>
        ${H.ui.switch("set-oled", st.prefs.oled, "완전한 검정 배경", "OLED 화면(대부분의 iPhone, 최신 iPad Pro)에서는 검은 부분이 꺼져서 전기를 덜 써요.")}
        <h3 class="form-h">홈 화면</h3>
        <div class="field"><span>아이콘 크기</span>${H.ui.seg("iconSize", [["s", "작게"], ["m", "보통"], ["l", "크게"]], st.theme.iconSize)}</div>
        <div class="field"><span>간격</span>${H.ui.seg("spacing", [["compact", "촘촘"], ["standard", "보통"], ["spacious", "넓게"]], st.theme.spacing)}</div>
        ${H.ui.switch("set-labels", st.theme.labels, "아이콘 이름 표시")}
        ${H.home.googlePlan().length ? `<div class="row wrap"><button type="button" class="btn" data-google>${H.svg("refresh")} 애플 앱을 구글 앱으로 바꾸기</button></div><p class="hint">Safari → Chrome, 메일 → Gmail, 캘린더·사진·지도·메모·파일·음악·FaceTime → 구글 앱. 자리는 그대로예요.</p>` : ""}
        <div class="row wrap"><button type="button" class="btn" data-pages>${H.svg("pages")} 페이지 관리</button><button type="button" class="btn" data-edit>${H.svg("grid")} 홈 화면 편집</button><button type="button" class="btn" data-addw>${H.svg("widget")} 위젯 추가</button><button type="button" class="btn" data-standby>${H.svg("clock")} 스탠바이 시계</button></div>
        <h3 class="form-h">시간 · 검색 · 링크</h3>
        <div class="field"><span>시계</span>${H.ui.seg("hour12", [["0", "24시간제"], ["1", "12시간제"]], st.prefs.hour12 ? "1" : "0")}</div>
        <div class="field"><span>웹 검색</span>${H.ui.seg("search", [["google", "Google"], ["naver", "네이버"], ["duckduckgo", "DuckDuckGo"]], st.prefs.search)}</div>
        <div class="field"><span>웹 링크 열기</span>${H.ui.seg("openWeb", [["auto", "자동"], ["same", "이 화면에서"], ["new", "새 탭"]], st.prefs.openWeb)}<small>자동: 홈 화면 앱으로 실행 중이면 이 화면에서, 브라우저면 새 탭에서 열어요.</small></div>
        ${H.ui.switch("set-confirm", st.prefs.confirmDelete, "바로가기 삭제 전에 확인")}
        <h3 class="form-h">데이터</h3>
        <div class="storage-card" data-storage>저장 공간 확인 중…</div>
        <div class="row wrap"><button type="button" class="btn primary" data-backup>${H.svg("archive")} 전체 백업 (zip)</button><button type="button" class="btn" data-backup-lite>${H.svg("download")} 설정만 (JSON)</button><button type="button" class="btn" data-import>${H.svg("upload")} 백업 불러오기</button></div>
        <p class="hint">전체 백업에는 배경·아이콘·위젯 사진과 영상까지 들어 있어요. 다른 기기에서 불러오면 그대로 복원돼요.</p>
        <div class="row wrap"><button type="button" class="btn ghost" data-reset-design>디자인만 초기화</button><button type="button" class="btn danger ghost" data-reset-all>모두 초기화</button></div>
        <h3 class="form-h">정보</h3>
        <div class="about"><img src="icons/icon-192.png" alt="" width="44" height="44"><div><b>Ὁρμή</b> <span class="muted">버전 ${H.VERSION}</span><small>${H.isStandalone() ? "홈 화면 앱으로 실행 중" : "브라우저에서 실행 중"} · 데이터는 이 기기에만 저장돼요</small></div></div>
        <div class="row wrap"><button type="button" class="btn ghost" data-install>${H.svg("download")} 홈 화면에 설치하는 법</button><a class="btn ghost" href="시작하기.html">${H.svg("info")} 사용 설명서</a><button type="button" class="btn ghost" data-update>${H.svg("refresh")} 업데이트 확인</button></div>
      </div>`,
    });
    const b = s.body;
    H.assets.usage().then((u) => {
      const el = b.querySelector("[data-storage]");
      if (!el) return;
      const pct = u.quota ? Math.min(100, (u.usage / u.quota) * 100) : 0;
      el.innerHTML = `<div class="storage-top"><b>사진·영상 ${u.count}개 · ${H.bytes(u.own)}</b>${u.quota ? `<small>기기에서 쓸 수 있는 공간 ${H.bytes(u.quota - u.usage)}</small>` : ""}</div>${u.quota ? `<div class="bar"><i style="width:${Math.max(1.5, pct)}%"></i></div>` : ""}`;
    });
    const commit = (fn, label = "설정") => H.store.commit(fn, { label, undo: false });
    H.ui.bindSeg(b, (name, v) => {
      if (name === "iconSize" || name === "spacing") commit((x) => (x.theme[name] = v));
      if (name === "hour12") commit((x) => (x.prefs.hour12 = v === "1"));
      if (name === "search" || name === "openWeb") commit((x) => (x.prefs[name] = v));
      if (name === "power") commit((x) => (x.prefs.power = v));
      if (name === "fx-page") commit((x) => (x.prefs.fx.page = v));
      if (name === "fx-bounce") commit((x) => (x.prefs.fx.bounce = v));
    });
    const paintPower = () => {
      const el = b.querySelector("[data-power-status]");
      if (!el || !H.power) return;
      const st2 = H.power.status();
      el.innerHTML = `<b>지금: ${H.esc(st2.head)}</b><small>${H.esc(st2.body)}</small>`;
    };
    paintPower();
    offPower = H.listen("power-status", paintPower);
    b.addEventListener("change", (e) => {
      const id = e.target.id;
      if (id === "set-motion") commit((x) => (x.motion.on = e.target.checked));
      if (id === "set-labels") commit((x) => (x.theme.labels = e.target.checked));
      if (id === "set-confirm") commit((x) => (x.prefs.confirmDelete = e.target.checked));
      if (id === "set-oled") commit((x) => (x.prefs.oled = e.target.checked));
      if (id?.startsWith("set-fx-")) commit((x) => (x.prefs.fx[id.slice(7)] = e.target.checked));
    });
    b.querySelector("[data-density]").addEventListener("input", (e) => {
      b.querySelector("[data-density-v]").textContent = e.target.value;
      S().motion.density = Number(e.target.value);
      H.bg?.sync();
      H.store.save();
    });
    b.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-theme]");
      if (t) {
        b.querySelectorAll(".theme-chip").forEach((x) => x.classList.toggle("on", x === t));
        commit((x) => {
          x.theme.preset = t.dataset.theme;
          x.theme.accent = "";
          x.theme.accent2 = "";
        }, "테마 변경");
      }
      const q = (sel) => e.target.closest(sel);
      if (q("[data-pages]")) {
        s.close();
        sheets.pages();
      }
      if (q("[data-edit]")) {
        s.close();
        H.home.setEditing(true);
      }
      if (q("[data-google]")) {
        const n = H.home.googleSwap();
        if (n) {
          q("[data-google]").closest(".row").nextElementSibling?.remove();
          q("[data-google]").closest(".row").remove();
          H.ui.toast(`앱 ${n}개를 구글 앱으로 바꿨어요.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
        }
      }
      if (q("[data-pack]")) {
        s.close();
        H.pack.pick();
      }
      if (q("[data-standby]")) {
        s.close();
        H.standby.open();
      }
      if (q("[data-addw]")) {
        s.close();
        H.widgetEditor.gallery();
      }
      if (q("[data-backup]")) {
        const hasVideo = !!S().assets["bg:video"];
        let includeVideo = true;
        if (hasVideo && (S().assets["bg:video"].size || 0) > 40 * 1024 * 1024)
          includeVideo = await H.ui.confirm({ title: "배경 영상도 넣을까요?", msg: `배경 영상이 ${H.bytes(S().assets["bg:video"].size)}예요. 넣으면 백업 파일이 커져요.`, ok: "영상 포함", cancel: "영상 빼고" });
        H.ui.toast("백업 파일을 만드는 중…");
        try {
          const r = await H.backup.exportAll({ includeVideo });
          if (r !== "cancel") H.ui.toast("백업 파일을 만들었어요.");
        } catch (err) {
          H.ui.toast("백업을 만들지 못했어요: " + (err.message || ""));
        }
      }
      if (q("[data-backup-lite]")) H.backup.exportSettings();
      if (q("[data-import]")) H.backup.importFlow();
      if (q("[data-reset-design]")) {
        const ok = await H.ui.confirm({ title: "디자인 초기화", msg: "배경·테마·아이콘 이미지가 처음 상태로 돌아가요. 앱 배치와 위젯은 그대로예요.", ok: "초기화", danger: true });
        if (ok) {
          H.store.commit((x) => {
            x.theme = H.schema.defaultTheme();
            x.bg = H.schema.defaultBg();
            Object.keys(x.assets).forEach((k) => (k.startsWith("bg:") || k.startsWith("icon:")) && delete x.assets[k]);
          }, { label: "디자인 초기화" });
          H.ui.toast("디자인을 초기화했어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
          s.close();
        }
      }
      if (q("[data-reset-all]")) {
        const ok = await H.ui.confirm({ title: "모두 초기화", msg: "앱 배치, 위젯, 디자인, 사진·영상이 모두 처음 상태로 돌아가요. 먼저 전체 백업을 권해요.", ok: "모두 초기화", danger: true });
        if (ok) {
          H.store.replace(H.schema.defaults(), { label: "모두 초기화" });
          H.ui.toast("처음 상태로 돌아왔어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
          s.close();
          H.pager.go(0, { animate: false });
        }
      }
      if (q("[data-install]")) sheets.install();
      if (q("[data-update]")) H.app?.checkUpdate(true);
    });
  };

  /* ================= Install guide ================= */
  sheets.install = () => {
    const ios = H.isIOS;
    const standalone = H.isStandalone();
    H.ui.sheet({
      title: "홈 화면에 설치하기",
      sub: standalone ? "이미 홈 화면 앱으로 실행 중이에요." : "설치하면 주소창 없이 전체 화면 앱처럼 열려요.",
      size: "sm",
      body: `<div class="install-guide">
        <section class="${ios ? "hl" : ""}"><h3>iPad · iPhone (Safari)</h3><ol class="steps-list"><li>Safari로 이 주소를 열어요.</li><li>주소창 옆 <b>공유</b> 버튼 ${H.svg("share", "inline")} 을 눌러요.</li><li><b>홈 화면에 추가</b>를 고르고 <b>추가</b>를 눌러요. (‘웹 앱으로 열기’가 보이면 켜 두세요)</li></ol></section>
        <section class="${H.isAndroid ? "hl" : ""}"><h3>Android (Chrome)</h3><ol class="steps-list"><li>Chrome 메뉴 ⋮ 를 눌러요.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요.</li></ol></section>
        <p class="hint">설치 아이콘이 예전 것으로 보이면 홈 화면의 기존 아이콘을 지우고 다시 추가해 주세요.</p></div>`,
    });
  };

  H.sheets = sheets;
})();
