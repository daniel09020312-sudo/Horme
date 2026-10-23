/* Ὁρμή launcher — App Library page and the Spotlight-style quick search (⌘K). */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const lib = {};
  let query = "";

  /* ---------- search ---------- */
  H.searchApps = (q, limit = 50) => {
    if (!q.trim()) return [];
    return Object.values(S().apps)
      .map((a) => {
        let sc = H.matchScore(q, [a.name, ...a.aliases, a.id]);
        if (!sc && !/^[ㄱ-ㅎ]+$/.test(q.trim())) sc = H.matchScore(q, [a.category]) * 0.6;
        return { a, s: sc ? sc + Math.min(6, (S().stats[a.id]?.[0] || 0) / 4) : 0 };
      })
      .filter((x) => x.s > 6)
      .sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name, "ko"))
      .slice(0, limit)
      .map((x) => x.a);
  };
  function suggested() {
    const now = Date.now();
    const st = S().stats;
    const scored = Object.values(S().apps)
      .filter((a) => st[a.id])
      .map((a) => ({ a, s: st[a.id][0] * Math.exp(-(now - st[a.id][1]) / (7 * 86400000)) }))
      .sort((x, y) => y.s - x.s)
      .map((x) => x.a);
    const fill = S().dock.map((id) => S().apps[id]).filter(Boolean);
    return [...new Set([...scored, ...fill, ...Object.values(S().apps)])].slice(0, 8);
  }
  /* Only apps the user added (timestamps), not the factory set. */
  function recentAdded() {
    return Object.values(S().apps)
      .filter((a) => a.added > 1e11) // factory apps use small index numbers; user-added ones carry a timestamp
      .sort((a, b) => b.added - a.added)
      .slice(0, 8);
  }
  lib.groups = () => {
    const apps = Object.values(S().apps);
    const g = [
      { name: "추천", apps: suggested(), smart: true },
    ];
    const rec = recentAdded();
    if (rec.length) g.push({ name: "최근 추가", apps: rec, smart: true });
    H.CATEGORIES.forEach((c) => {
      const list = apps.filter((a) => a.category === c).sort((a, b) => (S().stats[b.id]?.[0] || 0) - (S().stats[a.id]?.[0] || 0) || a.name.localeCompare(b.name, "ko"));
      if (list.length) g.push({ name: c, apps: list });
    });
    return g;
  };

  /* ---------- library page ---------- */
  function cardHTML(group) {
    const a = group.apps;
    const big = (x) => H.home.appTile(x, "library");
    let quad;
    if (a.length <= 4) quad = a.map(big).join("");
    else
      quad = a.slice(0, 3).map(big).join("") +
        `<button type="button" class="lib-cluster" data-open-cat="${H.esc(group.name)}" aria-label="${H.esc(group.name)} 모두 보기">${a.slice(3, 7).map((x) => H.home.iconHTML(x, "mini")).join("")}</button>`;
    return `<section class="lib-card"><div class="lib-quad">${quad}</div><button type="button" class="lib-card-title" data-open-cat="${H.esc(group.name)}"><span>${H.esc(group.name)}</span><small>${a.length}${H.svg("chevronR")}</small></button></section>`;
  }
  function rowHTML(app) {
    return `<button type="button" class="tile app row" data-key="a:${H.esc(app.id)}" data-ctx="library">${H.home.iconHTML(app)}<span class="row-text"><b>${H.esc(app.name)}</b><small>${H.esc(app.category)} · ${H.esc(H.home.locationLabel(app.id))}</small></span>${H.svg("chevronR", "row-chev")}</button>`;
  }

  lib.render = ({ soft } = {}) => {
    const cats = H.$("#lib-cats");
    const res = H.$("#lib-results");
    if (!cats) return;
    if (soft && query) return;
    if (query) {
      cats.hidden = true;
      res.hidden = false;
      const found = H.searchApps(query);
      const calc = H.calc(query);
      res.innerHTML =
        (calc !== null ? `<div class="calc-row"><span>${H.esc(query)} =</span><b>${calc.toLocaleString("ko-KR", { maximumFractionDigits: 10 })}</b></div>` : "") +
        (found.length ? `<div class="rows">${found.map(rowHTML).join("")}</div>` : '<p class="muted center">일치하는 앱이 없어요.</p>') +
        `<button type="button" class="web-row" data-web="${H.esc(query)}">${H.svg("globe")}<span>웹에서 ‘${H.esc(query)}’ 검색</span>${H.svg("arrowUR")}</button>`;
      return;
    }
    cats.hidden = false;
    res.hidden = true;
    cats.innerHTML = lib.groups().map(cardHTML).join("");
  };

  function openCategory(name) {
    const g = lib.groups().find((x) => x.name === name);
    if (!g) return;
    const s = H.ui.sheet({
      title: name,
      sub: `${g.apps.length}개 앱 · 누르면 실행, 길게 누르면 메뉴`,
      size: "md",
      cls: "cat-sheet",
      body: `<div class="grid sheet-grid">${g.apps.map((a) => H.home.appTile(a, "library")).join("")}</div>`,
      foot: `<button type="button" class="btn" data-add-app>${H.svg("plus")} 앱 추가</button>`,
    });
    s.body.addEventListener("click", (e) => {
      const t = e.target.closest(".tile.app");
      if (!t) return;
      s.close();
      H.launch.app(S().apps[t.dataset.key.slice(2)]);
    });
    s.foot.querySelector("[data-add-app]").onclick = () => {
      s.close();
      H.sheets.addApp({ category: g.smart ? undefined : name });
    };
  }

  function openAll() {
    const apps = Object.values(S().apps).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const groups = {};
    apps.forEach((a) => {
      const ch = H.chosung(a.name[0] || "#");
      const k = /[ㄱ-ㅎ]/.test(ch) ? ch : /[a-z]/i.test(ch) ? ch.toUpperCase() : "#";
      (groups[k] = groups[k] || []).push(a);
    });
    const order = Object.keys(groups).sort((a, b) => a.localeCompare(b, "ko"));
    const s = H.ui.sheet({
      title: "모든 앱",
      sub: `${apps.length}개 · 가나다 / ABC 순`,
      size: "md",
      body: `<nav class="az">${order.map((k) => `<button type="button" data-az="${k}">${k}</button>`).join("")}</nav>${order.map((k) => `<h3 class="az-head" id="az-${k}">${k}</h3><div class="rows">${groups[k].map(rowHTML).join("")}</div>`).join("")}`,
    });
    s.body.addEventListener("click", (e) => {
      const az = e.target.closest("[data-az]");
      if (az) return s.body.querySelector(`#az-${CSS.escape(az.dataset.az)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      const t = e.target.closest(".tile.app");
      if (t) {
        s.close();
        H.launch.app(S().apps[t.dataset.key.slice(2)]);
      }
    });
  }

  lib.init = () => {
    const page = H.$(".page.library");
    page.innerHTML = `<div class="lib-head"><div><p class="eyebrow">ALL IN ONE PLACE</p><h2>앱 보관함<span class="dot-accent">.</span></h2></div>
      <div class="lib-head-actions"><button type="button" class="pill-btn" data-lib-all>${H.svg("list")}<span>전체 목록</span></button><button type="button" class="pill-btn" data-lib-add>${H.svg("plus")}<span>앱 추가</span></button></div></div>
      <label class="lib-search">${H.svg("search")}<input id="lib-q" type="search" placeholder="앱 이름·초성으로 검색 (예: ㅇㅌㅂ)" autocomplete="off" enterkeyhint="search"><kbd>⌘K</kbd></label>
      <div class="lib-cats" id="lib-cats"></div><div class="lib-results" id="lib-results" hidden></div>`;
    const input = H.$("#lib-q");
    input.addEventListener("input", () => {
      query = input.value.trim();
      lib.render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = H.searchApps(query)[0];
        if (first) H.launch.app(first);
        else if (query) H.launch.url(H.launch.searchURL(query));
      }
      if (e.key === "Escape") {
        input.value = "";
        query = "";
        input.blur();
        lib.render();
      }
    });
    page.addEventListener("click", (e) => {
      const c = e.target.closest("[data-open-cat]");
      if (c) return openCategory(c.dataset.openCat);
      if (e.target.closest("[data-lib-all]")) return openAll();
      if (e.target.closest("[data-lib-add]")) return H.sheets.addApp();
      const w = e.target.closest("[data-web]");
      if (w) H.launch.url(H.launch.searchURL(w.dataset.web));
    });
    H.listen("page", (i) => {
      if (i !== H.pager.libraryIndex() && query) {
        query = "";
        input.value = "";
        lib.render();
      }
    });
    lib.render();
  };
  lib.focusSearch = () => {
    H.pager.go(H.pager.libraryIndex());
    setTimeout(() => H.$("#lib-q")?.focus(), 350);
  };

  /* ---------- Spotlight ---------- */
  const COMMANDS = [
    { label: "스탠바이 시계 (탁상시계)", glyph: "clock", keys: "스탠바이 탁상시계 시계 standby 큰시계 공부", run: () => H.standby.open() },
    { label: "홈 화면 편집", glyph: "grid", keys: "편집 배치 아이콘 이동 edit", run: () => H.home.setEditing(true) },
    { label: "위젯 추가", glyph: "widget", keys: "위젯 widget 추가", run: () => H.widgetEditor.gallery() },
    { label: "앱 추가", glyph: "plus", keys: "앱 추가 바로가기 새 app", run: () => H.sheets.addApp() },
    { label: "디자인 스튜디오", glyph: "palette", keys: "디자인 배경 테마 색 아이콘 studio", run: () => (location.href = "studio.html") },
    { label: "설정", glyph: "sliders", keys: "설정 settings 옵션", run: () => H.sheets.settings() },
    { label: "페이지 관리", glyph: "pages", keys: "페이지 page 순서 삭제", run: () => H.sheets.pages() },
    { label: "전체 백업 만들기", glyph: "archive", keys: "백업 backup 저장 내보내기", run: () => H.backup.exportAll() },
    { label: "백업 불러오기", glyph: "upload", keys: "복원 불러오기 가져오기 import", run: () => H.backup.importFlow() },
    { label: "배경 움직임 켜기/끄기", glyph: "wave", keys: "움직임 애니메이션 motion 배경", run: () => H.widgetActCtx("").toggleMotion() },
    { label: "절전 모드 켜기/끄기", glyph: "bolt", keys: "절전 배터리 전원 저전력 power saver battery", run: () => {
      const on = H.store.state.prefs.power !== "saver";
      H.store.commit((s) => (s.prefs.power = on ? "saver" : "auto"), { undo: false, label: "전원 모드" });
      H.ui.toast(on ? "절전 모드를 켰어요. 배경과 효과가 멈춰요." : "전원 모드를 ‘자동’으로 돌렸어요.");
    } },
    { label: "앱 보관함", glyph: "grid", keys: "보관함 library 전체", run: () => H.pager.go(H.pager.libraryIndex()) },
    { label: "사용 설명서", glyph: "info", keys: "도움말 설명서 help 사용법", run: () => (location.href = "시작하기.html") },
  ];
  let spot = null;
  lib.spotlight = () => {
    if (spot) return spot.querySelector("input").focus();
    spot = H.h(`<div class="spotlight" role="dialog" aria-modal="true" aria-label="빠른 검색"><div class="spot-backdrop"></div>
      <div class="spotlight-panel"><label class="spot-input">${H.svg("search")}<input type="search" placeholder="앱 · 계산 · 명령 · 웹 검색" autocomplete="off" enterkeyhint="go"><kbd>esc</kbd></label><div class="spot-results"></div></div></div>`);
    document.body.append(spot);
    requestAnimationFrame(() => spot?.classList.add("open"));
    document.body.classList.add("spot-open");
    const input = spot.querySelector("input");
    const out = spot.querySelector(".spot-results");
    let actions = [];
    let active = 0;
    const draw = () => {
      const q = input.value.trim();
      actions = [];
      let html = "";
      if (!q) {
        const rec = S().recent.map((id) => S().apps[id]).filter(Boolean).slice(0, 6);
        const sug = rec.length ? rec : suggested().slice(0, 6);
        html += `<h4>${rec.length ? "최근 사용" : "추천"}</h4><div class="spot-apps">${sug.map((a) => {
          actions.push(() => H.launch.app(a));
          return `<button type="button" class="spot-app" data-i="${actions.length - 1}">${H.home.iconHTML(a)}<span>${H.esc(a.name)}</span></button>`;
        }).join("")}</div>`;
        html += `<h4>바로 하기</h4>` + COMMANDS.slice(0, 6).map((c) => {
          actions.push(c.run);
          return `<button type="button" class="spot-row" data-i="${actions.length - 1}">${H.svg(c.glyph)}<span>${c.label}</span></button>`;
        }).join("");
      } else {
        const calc = H.calc(q);
        if (calc !== null) {
          actions.push(() => {
            navigator.clipboard?.writeText(String(calc)).then(() => H.ui.toast("결과를 복사했어요."), () => {});
          });
          html += `<button type="button" class="spot-row calc" data-i="${actions.length - 1}"><span class="calc-q">${H.esc(q)} =</span><b>${calc.toLocaleString("ko-KR", { maximumFractionDigits: 10 })}</b><small>눌러서 복사</small></button>`;
        }
        const apps = H.searchApps(q, 8);
        if (apps.length)
          html += `<h4>앱</h4>` + apps.map((a) => {
            actions.push(() => H.launch.app(a));
            return `<button type="button" class="spot-row" data-i="${actions.length - 1}">${H.home.iconHTML(a, "sm")}<span>${H.esc(a.name)}<small>${H.esc(a.category)} · ${H.esc(H.home.locationLabel(a.id))}</small></span></button>`;
          }).join("");
        const cmds = COMMANDS.filter((c) => H.matchScore(q, [c.label, ...c.keys.split(" ")]) > 20).slice(0, 4);
        if (cmds.length)
          html += `<h4>바로 하기</h4>` + cmds.map((c) => {
            actions.push(c.run);
            return `<button type="button" class="spot-row" data-i="${actions.length - 1}">${H.svg(c.glyph)}<span>${c.label}</span></button>`;
          }).join("");
        actions.push(() => H.launch.url(H.launch.searchURL(q)));
        html += `<button type="button" class="spot-row web" data-i="${actions.length - 1}">${H.svg("globe")}<span>웹에서 ‘${H.esc(q)}’ 검색</span>${H.svg("arrowUR")}</button>`;
      }
      out.innerHTML = html;
      active = 0;
      mark();
    };
    const mark = () => out.querySelectorAll("[data-i]").forEach((b) => b.classList.toggle("active", Number(b.dataset.i) === active));
    const run = (i) => {
      const fn = actions[i];
      lib.closeSpotlight();
      fn?.();
    };
    input.addEventListener("input", draw);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = H.clamp(active + (e.key === "ArrowDown" ? 1 : -1), 0, actions.length - 1);
        mark();
        out.querySelector(".active")?.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        run(active);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        lib.closeSpotlight();
      }
    });
    out.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]");
      if (b) run(Number(b.dataset.i));
    });
    spot.querySelector(".spot-backdrop").addEventListener("click", () => lib.closeSpotlight());
    draw();
    setTimeout(() => input.focus(), 30);
  };
  lib.closeSpotlight = () => {
    if (!spot) return;
    const s = spot;
    spot = null;
    s.classList.remove("open");
    document.body.classList.remove("spot-open");
    setTimeout(() => s.remove(), 200);
  };
  lib.spotlightOpen = () => !!spot;

  H.library = lib;
})();
