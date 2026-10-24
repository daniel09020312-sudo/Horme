/* Ὁρμή Studio — design editor with a live preview of the real launcher (iframe). */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const esc = H.esc;
  const STEPS = [
    ["pack", "한 번에 적용", "디자인 팩 · AI", "layers"],
    ["bg", "배경", "사진 · 영상 · 움직임", "image"],
    ["icons", "아이콘", "앱마다 이미지 · 기호", "grid"],
    ["theme", "테마", "색 · 글꼴 · 스타일", "palette"],
    ["widgets", "위젯", "추가 · 편집 · 크기", "widget"],
    ["prompts", "AI 프롬프트", "이미지 만들기 양식", "wand"],
    ["backup", "백업", "저장 · 불러오기 · 초기화", "archive"],
  ];
  const DEVICES = [
    ["ipad-l", "iPad 가로", 1180, 820, "tabletLand"],
    ["ipad-p", "iPad 세로", 820, 1180, "tablet"],
    ["phone", "휴대폰", 390, 844, "phone"],
  ];
  let step = STEPS.some((s) => s[0] === H.params.get("step")) ? H.params.get("step") : "pack";
  const packState = { wish: "", mode: "svg", scope: "home" };
  let selectedApp = "";
  let device = window.innerWidth < 700 ? "phone" : window.innerHeight > window.innerWidth ? "ipad-p" : "ipad-l";
  let promptState = { type: "icon", style: "glass", color: "theme", subject: "", lang: "en", noText: true, apps: "" };
  const panel = () => H.$("#st-panel");

  /* ---------- saving indicator ---------- */
  let savedTimer = 0;
  function saved(msg = "저장됨") {
    const el = H.$("#st-saved");
    el.textContent = "✓ " + msg;
    el.classList.add("on");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      el.textContent = "자동 저장";
      el.classList.remove("on");
    }, 1600);
  }
  const set = (fn, label = "디자인") => {
    H.store.commit(fn, { undo: false, label });
    saved();
  };

  /* ---------- nav ---------- */
  function renderNav() {
    H.$("#st-steps").innerHTML = STEPS.map(([k, name, sub, g], i) => `<button type="button" class="st-step ${k === step ? "on" : ""}" data-step="${k}" aria-current="${k === step ? "page" : "false"}">
      <span class="st-num">${H.pad(i + 1)}</span>${H.svg(g)}<span class="st-step-t"><b>${name}</b><small>${sub}</small></span></button>`).join("");
  }
  function go(k) {
    step = k;
    renderNav();
    renderPanel();
    panel().scrollTop = 0;
    history.replaceState(null, "", `studio.html?step=${k}`);
  }

  const EN = ["ALL IN ONE", "BACKGROUND", "ICONS", "THEME", "WIDGETS", "AI PROMPTS", "BACKUP"];
  const head = (n, title, lead) => `<header class="st-head"><p class="st-over">STEP ${H.pad(n)} · ${EN[n - 1]}</p><h1>${title}</h1><p class="lead">${lead}</p></header>`;
  const range = (id, label, value, min, max, step = 1, unit = "%", hint = "") =>
    `<label class="st-range"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</span><output data-out="${id}">${value}${unit}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  const thumb = (key) => {
    const url = H.assets.urlSync(key);
    return url ? `<img src="${url}" alt="">` : `<span class="st-empty">${H.svg("image")}<small>비어 있음</small></span>`;
  };

  /* ================= 01 Background ================= */
  function panelBg() {
    const b = S().bg;
    const has = (k) => !!S().assets[k];
    const vid = S().assets["bg:video"];
    const modes = [
      ["ambient", "기본 움직임", "입자와 물결이 천천히 흐르는 기본 배경", "wave"],
      ["image", "사진", "가로·세로 화면에 사진을 따로 지정", "image"],
      ["video", "영상", "MP4 등 영상을 소리 없이 반복 재생", "video"],
      ["animated", "움직이는 이미지", "GIF · APNG · 움직이는 WebP", "sparkle"],
    ];
    const vInfo = vid && b.mode === "video" ? `<div class="st-file">${H.svg("video")}<span><b>${esc(vid.name || "배경 영상")}</b><small>${H.bytes(vid.size)} · 이 기기에 저장됨</small></span></div>` : b.videoUrl ? `<div class="st-file">${H.svg("link")}<span><b>웹 영상 주소</b><small>${esc(b.videoUrl.slice(0, 70))}</small></span></div>` : "";
    const aInfo = vid && b.mode === "animated" ? `<div class="st-file">${H.svg("sparkle")}<span><b>${esc(vid.name || "움직이는 이미지")}</b><small>${H.bytes(vid.size)}</small></span></div>` : "";
    return `${head(2, "배경", "홈 화면 뒤에 깔리는 배경을 골라요. 사진·영상은 서버로 보내지 않고 이 기기에만 저장돼요.")}
      <div class="mode-cards">${modes.map(([k, n, d, g]) => `<button type="button" class="mode-card ${b.mode === k ? "on" : ""}" data-mode="${k}">${H.svg(g)}<b>${n}</b><small>${d}</small></button>`).join("")}</div>

      <section class="st-card ${b.mode === "image" ? "" : "dim"}" data-sec="image">
        <h3>${H.svg("image")} 사진</h3>
        <div class="slots">
          <div class="slot land"><div class="slot-img">${thumb("bg:landscape")}</div><div class="slot-info"><b>가로 화면용</b><small>권장 2732×2048 이상</small>
            <div class="row wrap"><label class="btn small primary">${H.svg("upload")}사진 선택<input type="file" accept="image/*" hidden data-up="bg:landscape"></label>${has("bg:landscape") ? '<button type="button" class="btn small ghost" data-rm="bg:landscape">지우기</button>' : ""}</div></div></div>
          <div class="slot port"><div class="slot-img">${thumb("bg:portrait")}</div><div class="slot-info"><b>세로 화면용 <small>(선택)</small></b><small>없으면 가로 사진을 잘라서 써요</small>
            <div class="row wrap"><label class="btn small">${H.svg("upload")}사진 선택<input type="file" accept="image/*" hidden data-up="bg:portrait"></label>${has("bg:portrait") ? '<button type="button" class="btn small ghost" data-rm="bg:portrait">지우기</button>' : ""}</div></div></div>
        </div>
        ${range("shade", "어둡게", Math.round(b.shade * 100), 0, 90, 5, "%", "아이콘·글자가 잘 보이게")}
        ${range("blur", "흐리게", b.blur, 0, 30, 1, "px", "배경을 부드럽게")}
        <div class="field"><span>채우는 방식</span>${H.ui.seg("fit", [["cover", "꽉 채우기"], ["contain", "전체 보이기"]], b.fit)}</div>
      </section>

      <section class="st-card ${b.mode === "video" ? "" : "dim"}" data-sec="video">
        <h3>${H.svg("video")} 영상</h3>
        ${vInfo}
        <div class="row wrap"><label class="btn primary">${H.svg("upload")}영상 파일 선택<input type="file" accept="video/*,.mov,.m4v,.webm,.mp4" hidden data-up-video="video"></label>${vid && b.mode === "video" ? `<button type="button" class="btn" data-export-video>${H.svg("download")}영상 내보내기</button>` : ""}</div>
        <p class="hint">MP4(H.264)가 가장 잘 돼요. 아이폰으로 찍은 MOV(HEVC)는 기기에 따라 안 될 수 있어요. 300MB 이하.</p>
        <div class="row"><input class="input mono" data-video-url placeholder="또는 https://…/background.mp4 (직접 파일 주소)" value="${esc(b.videoUrl)}" autocapitalize="off" spellcheck="false"><button type="button" class="btn" data-apply-url>적용</button></div>
        <div class="field"><span>재생 속도</span>${H.ui.seg("speed", [["0.5", "0.5×"], ["0.75", "0.75×"], ["1", "1×"], ["1.25", "1.25×"], ["1.5", "1.5×"]], String(b.speed))}</div>
      </section>

      <section class="st-card ${b.mode === "animated" ? "" : "dim"}" data-sec="animated">
        <h3>${H.svg("sparkle")} 움직이는 이미지</h3>
        ${aInfo}
        <label class="btn primary">${H.svg("upload")}GIF · APNG · WebP 선택<input type="file" accept="image/gif,image/apng,image/png,image/webp" hidden data-up-video="animated"></label>
        <p class="hint">30MB 이하. 아주 큰 GIF는 배터리를 많이 써요 — 가능하면 MP4 영상이 더 가벼워요.</p>
      </section>

      <section class="st-card ${b.mode === "video" || b.mode === "animated" ? "" : "dim"}">
        <h3>${H.svg("sliders")} 영상·움직이는 이미지 공통</h3>
        ${range("dim", "어둡게", Math.round(b.dim * 100), 0, 90, 5, "%")}
        <div class="field"><span>채우는 방식</span>${H.ui.seg("fit2", [["cover", "꽉 채우기"], ["contain", "전체 보이기"]], b.fit)}</div>
      </section>

      <section class="st-card">
        <h3>${H.svg("wave")} 움직임</h3>
        ${H.ui.switch("motion-on", S().motion.on, "배경 움직임", "끄면 입자·물결·영상이 멈춰 배터리를 아껴요")}
        ${H.ui.switch("particles", b.particles, "사진·영상 위에 입자 효과 겹치기")}
        ${range("density", "입자 수", S().motion.density, 0, 80, 2, "개")}
      </section>

      <section class="st-card">
        <h3>${H.svg("download")} 배경 만들기 가이드</h3>
        <p class="hint">아이콘·시계가 놓이는 자리를 표시한 양식이에요. 그림 앱에서 밑그림으로 쓰세요.</p>
        <div class="row wrap"><a class="btn small" href="design-templates/wallpaper-landscape-guide.png" download>가로 가이드</a><a class="btn small" href="design-templates/wallpaper-portrait-guide.png" download>세로 가이드</a><a class="btn small" href="design-templates/wallpaper-landscape-editable.svg" download>편집용 SVG</a></div>
      </section>`;
  }

  async function uploadBgImage(key, file) {
    try {
      H.ui.toast("사진을 준비하는 중…");
      const blob = await H.assets.processImage(file, "wallpaper");
      await H.assets.put(key, blob, { name: file.name });
      await H.assets.url(key);
      set((s) => (s.bg.mode = "image"), "배경 사진");
      H.ui.toast("배경 사진을 적용했어요.");
      renderPanel();
    } catch (e) {
      H.ui.toast(e.message || "사진을 적용하지 못했어요.");
    }
  }
  async function uploadMoving(kind, file) {
    const max = kind === "animated" ? 30 : 300;
    if (file.size > max * 1024 * 1024) return H.ui.toast(`파일이 너무 커요 (${max}MB 이하).`);
    H.ui.toast("파일을 확인하는 중…");
    const ok = await H.assets.probeMedia(file, kind);
    if (!ok) return H.ui.toast(kind === "animated" ? "이 이미지를 열 수 없어요." : "이 브라우저에서 재생할 수 없는 영상이에요. MP4(H.264)로 바꿔 주세요.");
    try {
      const u = await H.assets.usage();
      if (u.quota && u.quota - u.usage < file.size * 1.2) return H.ui.toast("기기 저장 공간이 부족해요.");
      await H.assets.put("bg:video", file, { name: file.name });
      set((s) => {
        s.bg.mode = kind;
        s.bg.videoUrl = "";
      }, "배경 영상");
      H.ui.toast(kind === "animated" ? "움직이는 이미지를 적용했어요." : "배경 영상을 적용했어요.");
      renderPanel();
    } catch (e) {
      H.ui.toast(e.message || "저장하지 못했어요. 저장 공간을 확인해 주세요.");
    }
  }

  /* ================= 02 Icons ================= */
  function panelIcons() {
    const t = S().theme;
    const apps = Object.values(S().apps).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const sel = S().apps[selectedApp];
    const iconOf = (a, cls = "") => {
      const url = S().assets["icon:" + a.id] ? H.assets.urlSync("icon:" + a.id) : null;
      return url ? `<span class="icon custom ${cls}"><img src="${url}" alt=""></span>` : `<span class="icon ${cls}">${H.svg(a.glyph)}</span>`;
    };
    const customCount = Object.keys(S().assets).filter((k) => k.startsWith("icon:")).length;
    return `${head(3, "아이콘", "앱마다 원하는 이미지를 넣거나 기본 기호를 바꿔요. 실제 iPad 아이콘은 바뀌지 않고 Ὁρμή 안에서만 바뀌어요.")}
      <section class="st-card">
        <h3>${H.svg("grid")} 앱 고르기 <small>${apps.length}개 · 맞춤 아이콘 ${customCount}개</small></h3>
        <label class="lib-search small">${H.svg("search")}<input type="search" data-icon-q placeholder="앱 이름 검색" autocomplete="off"></label>
        <div class="icon-picker">${apps.map((a) => `<button type="button" class="ip-app ${a.id === selectedApp ? "on" : ""}" data-pick="${esc(a.id)}" data-name="${esc(a.name)}">${iconOf(a)}<span>${esc(a.name)}</span>${S().assets["icon:" + a.id] ? '<i class="ip-dot" title="맞춤 아이콘"></i>' : ""}</button>`).join("")}</div>
      </section>
      ${sel ? `<section class="st-card icon-detail">
        <div class="id-top">${iconOf(sel, "big")}<div><b>${esc(sel.name)}</b><small>${S().assets["icon:" + sel.id] ? "맞춤 이미지 사용 중" : "기본 기호 사용 중"}</small>
        <div class="row wrap"><label class="btn small primary">${H.svg("upload")}이미지 선택<input type="file" accept="image/*" hidden data-icon-up></label>${S().assets["icon:" + sel.id] ? '<button type="button" class="btn small ghost" data-icon-reset>기본 기호로</button>' : ""}</div></div></div>
        <p class="hint">정사각형이 아니면 가운데를 잘라서 써요. 1024×1024 PNG를 권해요.</p>
        <div class="field"><span>기본 기호</span><div class="glyph-grid">${H.APP_GLYPHS.map(([g, l]) => `<button type="button" class="glyph-pick ${g === sel.glyph ? "on" : ""}" data-glyph="${g}" title="${l}" aria-label="${l}">${H.svg(g)}</button>`).join("")}</div></div>
      </section>` : `<p class="st-tip">${H.svg("info")} 위에서 앱을 고르면 아이콘을 바꿀 수 있어요.</p>`}
      <section class="st-card">
        <h3>${H.svg("sliders")} 아이콘 스타일</h3>
        <div class="field"><span>크기</span>${H.ui.seg("iconSize", [["s", "작게"], ["m", "보통"], ["l", "크게"]], t.iconSize)}</div>
        ${range("radius", "모서리 둥글기", t.iconRadius, 8, 50, 1, "%")}
        <div class="field"><span>기호 색</span>${H.ui.seg("glyphTint", [["light", "흰색"], ["accent", "포인트 색"]], t.glyphTint)}</div>
        ${H.ui.switch("labels", t.labels, "아이콘 이름 표시")}
      </section>
      <section class="st-card">
        <h3>${H.svg("layers")} 여러 개 한 번에</h3>
        <p class="hint">파일 이름을 앱 이름으로 맞춰 두면 알아서 찾아 넣어요. 예: <code>youtube.png</code>, <code>유튜브.png</code>, <code>노션.jpg</code>. 홈 화면에 없는 앱 이름이면 그 앱을 새로 더해요.</p>
        <div class="row wrap"><label class="btn primary">${H.svg("upload")}이미지 여러 장 선택<input type="file" accept="image/*" multiple hidden data-bulk></label><a class="btn small ghost" href="design-templates/아이콘_파일명_목록.csv" download>파일명 표</a><a class="btn small ghost" href="design-templates/icon-1024-guide.png" download>아이콘 가이드</a></div>
        <div class="bulk-result"></div>
      </section>
      ${customCount ? `<button type="button" class="btn danger ghost" data-clear-icons>${H.svg("trash")} 맞춤 아이콘 모두 지우기</button>` : ""}`;
  }

  async function setIcon(appId, file) {
    try {
      const blob = await H.assets.processImage(file, "icon");
      await H.assets.put("icon:" + appId, blob, { name: file.name });
      await H.assets.url("icon:" + appId);
      saved();
      return true;
    } catch (e) {
      H.ui.toast(e.message || "아이콘을 넣지 못했어요.");
      return false;
    }
  }

  /* ================= 04 Theme ================= */
  function panelTheme() {
    const t = S().theme;
    const p = H.THEMES[t.preset];
    return `${head(4, "테마", "전체 분위기와 색, 시계 글꼴, 위젯·Dock 모양을 골라요.")}
      <section class="st-card"><h3>${H.svg("palette")} 분위기</h3>
        <div class="preset-grid">${Object.entries(H.THEMES).map(([k, th]) => `<button type="button" class="preset ${t.preset === k ? "on" : ""}" data-preset="${k}" style="--a:${th.accent};--b:${th.accent2};--g1:${th.glow1};--g2:${th.glow2};--base:${th.base}"><i></i><b>${th.name}</b><small>${th.sub}</small></button>`).join("")}</div></section>
      <section class="st-card"><h3>${H.svg("sparkle")} 포인트 색</h3>
        <div class="color-row"><label class="color-field"><input type="color" data-color="accent" value="${t.accent || p.accent}"><span><b>포인트</b><small>버튼·강조</small></span></label>
        <label class="color-field"><input type="color" data-color="accent2" value="${t.accent2 || p.accent2}"><span><b>보조</b><small>은은한 빛·점</small></span></label>
        <button type="button" class="btn small ghost" data-reset-colors>테마 기본 색</button></div></section>
      <section class="st-card"><h3>${H.svg("clock")} 시계 글꼴</h3>
        <div class="font-grid">${[["thin", "얇게", "var(--font)"], ["serif", "세리프", "var(--font-serif)"], ["mono", "모노", "var(--font-mono)"], ["rounded", "둥글게", "var(--font-round)"]].map(([k, n, f]) => `<button type="button" class="font-card ${t.clockFont === k ? "on" : ""}" data-font="${k}"><span style="font-family:${f}">12:34</span><small>${n}</small></button>`).join("")}</div>
        <label class="field"><span>시계 아래 문구</span><input class="input" data-tagline maxlength="90" value="${esc(t.tagline)}" placeholder="A space made yours."></label></section>
      <section class="st-card"><h3>${H.svg("widget")} 모양</h3>
        <div class="field"><span>위젯</span>${H.ui.seg("widgetStyle", [["glass", "유리"], ["solid", "진하게"], ["outline", "테두리만"]], t.widgetStyle)}</div>
        <div class="field"><span>Dock</span>${H.ui.seg("dock", [["glass", "유리"], ["solid", "진하게"], ["clear", "투명"]], t.dock)}</div>
        <div class="field"><span>아이콘 간격</span>${H.ui.seg("spacing", [["compact", "촘촘"], ["standard", "보통"], ["spacious", "넓게"]], t.spacing)}</div>
      </section>`;
  }

  /* ================= 04 Widgets ================= */
  function panelWidgets() {
    const pages = S().pages;
    const blocks = pages.map((p, i) => {
      const ws = p.items.filter((k) => k[0] === "w").map((k) => S().widgets[k.slice(2)]).filter(Boolean);
      return `<section class="st-card"><h3>${H.svg("pages")} 홈 화면 ${i + 1} <small>위젯 ${ws.length}개</small><button type="button" class="btn small" data-add-w="${i}">${H.svg("plus")}추가</button></h3>
        ${ws.length ? `<ul class="w-list">${ws.map((w) => {
          const t = H.WTYPES[w.type];
          return `<li><span class="w-ic">${H.svg(t.glyph)}</span><span class="w-t"><b>${esc(t.name)}</b><small>${H.SIZE_NAME[w.size]}${w.title && w.type !== "hero" ? " · " + esc(w.title) : ""}</small></span>
            ${t.sizes.length > 1 ? `<span class="w-sizes">${t.sizes.map((z) => `<button type="button" class="${z === w.size ? "on" : ""}" data-wsize="${w.id}:${z}">${H.SIZE_NAME[z]}</button>`).join("")}</span>` : ""}
            <button type="button" class="btn small" data-wedit="${w.id}">편집</button><button type="button" class="icon-btn danger" data-wdel="${w.id}" aria-label="삭제">${H.svg("trash")}</button></li>`;
        }).join("")}</ul>` : '<p class="hint">이 페이지에는 위젯이 없어요.</p>'}</section>`;
    }).join("");
    return `${head(5, "위젯", "시계·할 일·D-day·시간표·날씨 같은 위젯을 넣고 크기를 바꿔요. 위치는 홈 화면 편집 모드에서 끌어서 옮겨요.")}
      <div class="row wrap"><button type="button" class="btn primary" data-add-w="0">${H.svg("plus")} 위젯 추가</button><a class="btn ghost" href="index.html?open=edit">${H.svg("move")} 홈 화면에서 위치 바꾸기</a></div>
      ${blocks}`;
  }

  /* ================= 05 Prompts ================= */
  function panelPrompts() {
    const ps = promptState;
    if (!ps.apps) ps.apps = S().pages.flatMap((p) => p.items).filter((k) => k[0] === "a").map((k) => S().apps[k.slice(2)]?.name).filter(Boolean).slice(0, 24).join(", ");
    return `${head(6, "AI 디자인 프롬프트", "그림 생성 AI에 붙여 넣을 설명문을 만들어요. 이 앱이 그림을 만들지는 않아요. 만든 그림은 ② 배경, ③ 아이콘, ⑤ 위젯 사진에 넣거나, ① 한 번에 적용에서 한꺼번에 넣으면 돼요.")}
      <section class="st-card form">
        <div class="field"><span>무엇을 만들까요?</span>${H.ui.seg("p-type", H.prompts.TYPES, ps.type)}</div>
        <label class="field"><span>스타일</span><select class="input" data-p="style">${Object.entries(H.prompts.STYLES).map(([k, v]) => `<option value="${k}" ${k === ps.style ? "selected" : ""}>${v.ko}</option>`).join("")}</select></label>
        <label class="field"><span>색</span><select class="input" data-p="color">${Object.entries(H.prompts.COLORS).map(([k, v]) => `<option value="${k}" ${k === ps.color ? "selected" : ""}>${v.ko}</option>`).join("")}</select></label>
        ${ps.type === "iconset" ? `<label class="field"><span>아이콘을 만들 앱 (쉼표로 구분)</span><textarea class="input" rows="3" data-p="apps">${esc(ps.apps)}</textarea></label>` : `<label class="field"><span>주제 <small>(선택)</small></span><input class="input" data-p="subject" value="${esc(ps.subject)}" placeholder="예: 밤하늘의 오로라, 노트와 펜, 음파"></label>`}
        <div class="field"><span>프롬프트 언어</span>${H.ui.seg("p-lang", [["en", "영어 (추천)"], ["ko", "한국어"]], ps.lang)}</div>
        ${H.ui.switch("p-notext", ps.noText, "글자·로고 없이", "AI가 글자를 그리면 깨지기 쉬워요. 글자는 Ὁρμή에서 넣는 게 깔끔해요.")}
        <label class="field"><span>만들어진 프롬프트 <small>(직접 고쳐도 돼요)</small></span><textarea class="input prompt-out" rows="10" spellcheck="false" data-out-prompt></textarea></label>
        <div class="row wrap"><button type="button" class="btn primary" data-copy>${H.svg("copy")} 복사</button><button type="button" class="btn ghost" data-regen>${H.svg("refresh")} 다시 만들기</button></div>
      </section>`;
  }
  function refreshPrompt() {
    const out = H.$("[data-out-prompt]");
    if (!out) return;
    const t = S().theme;
    const p = H.THEMES[t.preset];
    out.value = H.prompts.build({ ...promptState, apps: promptState.apps.split(/[,，\n]/).map((x) => x.trim()).filter(Boolean), theme: { a: t.accent || p.accent, b: t.accent2 || p.accent2 } });
  }

  /* ================= 01 Design pack ================= */
  function panelPack() {
    const nHome = H.pack.homeApps("home").length;
    const nAll = H.pack.homeApps("all").length;
    return `${head(1, "한 번에 적용", "배경·앱 아이콘·색을 파일 하나, 또는 AI의 답 하나로 한꺼번에 바꿔요. 넣은 아이콘의 앱으로 홈 화면도 구성할 수 있어요.")}
      <section class="st-card pack-drop" data-drop>
        <h3>${H.svg("upload")} 파일로 한 번에</h3>
        <p class="hint">zip 하나, 또는 이미지 여러 장을 한꺼번에 고르세요. 이름만 맞추면 알아서 제자리에 들어가요.</p>
        <ul class="pk-rules">
          <li><b>앱 아이콘</b><span><code>앱 이름.png</code> 예: <code>Chrome.png</code> <code>카카오톡.jpg</code> <code>노션.webp</code></span></li>
          <li><b>배경</b><span><code>배경-가로.jpg</code> <code>배경-세로.jpg</code> 또는 <code>wallpaper-landscape</code> · <code>wallpaper-portrait</code></span></li>
          <li><b>움직이는 배경</b><span><code>배경.mp4</code> 또는 <code>배경.gif</code></span></li>
          <li><b>색·글꼴까지</b><span><code>pack.json</code>을 같이 넣으면 그 설정을 따라요 (아래 AI 프롬프트의 형식)</span></li>
        </ul>
        <label class="btn primary">${H.svg("upload")} 파일 고르기 (여러 개 가능)<input type="file" multiple hidden accept=".zip,.json,image/*,video/*,.svg" data-pack-files></label>
        <p class="hint drop-hint">컴퓨터에서는 이 상자로 끌어다 놓아도 돼요.</p>
      </section>
      <section class="st-card form">
        <h3>${H.svg("wand")} AI에게 맡기기</h3>
        <ol class="steps-list"><li>원하는 분위기를 적고 <b>프롬프트 복사</b>를 눌러요.</li><li>Claude · ChatGPT · Gemini 같은 AI 채팅에 붙여 넣어요.</li><li>AI의 답을 통째로 복사해 아래 <b>AI 답 붙여넣기</b>에 넣어요. zip으로 받았다면 위 <b>파일로 한 번에</b>에 넣으면 돼요.</li></ol>
        <label class="field"><span>원하는 분위기</span><textarea class="input" rows="2" data-pack-wish placeholder="예: 새벽 바다처럼 깊은 남색과 청록, 유리처럼 맑은 아이콘">${esc(packState.wish)}</textarea></label>
        <div class="field"><span>AI가 줄 결과</span>${H.ui.seg("pk-mode", [["svg", "글로 받기 · 모든 AI"], ["zip", "이미지 zip · 그림 AI"]], packState.mode)}<small>글로 받기: 아이콘과 배경을 SVG 코드로 받아요. 어떤 AI든 되고 복사·붙여넣기만 하면 끝나요. 이미지 zip: 그림과 파일을 만들 수 있는 AI(ChatGPT 등)에서 더 사실적인 그림을 받아요.</small></div>
        <div class="field"><span>아이콘을 만들 앱</span>${H.ui.seg("pk-scope", [["home", `홈 화면·Dock ${nHome}개`], ["all", `보관함 전체 ${nAll}개`]], packState.scope)}</div>
        <label class="field"><span>프롬프트 <small>(직접 고쳐도 돼요)</small></span><textarea class="input prompt-out" rows="9" spellcheck="false" data-pack-prompt></textarea></label>
        <div class="row wrap"><button type="button" class="btn primary" data-pack-copy>${H.svg("copy")} 프롬프트 복사</button></div>
      </section>
      <section class="st-card form">
        <h3>${H.svg("doc")} AI 답 붙여넣기</h3>
        <textarea class="input prompt-out" rows="6" spellcheck="false" data-pack-paste placeholder="AI가 준 답을 처음부터 끝까지 그대로 붙여 넣으세요. 앞뒤 설명이 섞여 있어도 괜찮아요."></textarea>
        <div class="row wrap"><button type="button" class="btn primary" data-pack-apply>${H.svg("check")} 적용하기</button><button type="button" class="btn ghost" data-pack-clip>${H.svg("copy")} 클립보드에서 가져오기</button></div>
      </section>
      <section class="st-card"><h3>${H.svg("download")} 지금 디자인을 팩으로</h3><p class="hint">지금 배경·아이콘·색과 홈 화면 앱 구성을 디자인 팩(zip)으로 저장해요. 다른 기기에서 그대로 적용할 수 있어요.</p>
        <button type="button" class="btn" data-pack-export>${H.svg("download")} 디자인 팩 내보내기</button></section>`;
  }
  function refreshPackPrompt() {
    const out = H.$("[data-pack-prompt]");
    if (out) out.value = H.pack.prompt(packState);
  }
  async function copyText(text, ta) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      if (ta) {
        ta.focus();
        ta.select();
      }
      return false;
    }
  }

  /* ================= 07 Backup ================= */
  function panelBackup() {
    return `${head(7, "백업", "디자인과 홈 화면 구성은 이 기기에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업해 두세요.")}
      <div class="backup-grid">
        <section class="st-card"><h3>${H.svg("archive")} 전체 백업</h3><p class="hint">앱 배치·위젯·디자인과 사진·아이콘·영상까지 zip 파일 하나로 저장해요.</p>
          ${H.ui.switch("bk-video", true, "배경 영상도 넣기", S().assets["bg:video"] ? H.bytes(S().assets["bg:video"].size) : "영상 없음")}
          <button type="button" class="btn primary" data-bk-all>${H.svg("download")} 전체 백업 만들기</button></section>
        <section class="st-card"><h3>${H.svg("upload")} 불러오기</h3><p class="hint">전체 백업(zip), 설정 파일(json), 이전 버전의 ‘설정 내보내기’·디자인 파일 모두 돼요.</p>
          <button type="button" class="btn primary" data-bk-import>${H.svg("upload")} 파일 선택</button></section>
        <section class="st-card"><h3>${H.svg("doc")} 설정만</h3><p class="hint">사진·영상 없이 가벼운 JSON 파일로 저장해요.</p>
          <button type="button" class="btn" data-bk-json>${H.svg("download")} 설정 JSON</button></section>
        <section class="st-card"><h3>${H.svg("info")} 저장 공간</h3><div class="storage-card" data-storage>확인 중…</div></section>
      </div>
      <section class="st-card"><h3>${H.svg("refresh")} 초기화</h3>
        <div class="row wrap"><button type="button" class="btn ghost" data-reset-design>디자인만 처음으로</button><button type="button" class="btn danger ghost" data-reset-all>모두 처음으로</button></div>
        <p class="hint">초기화한 바로 뒤에는 ‘되돌리기’로 취소할 수 있어요.</p></section>`;
  }

  /* ---------- panel render + wiring ---------- */
  const PANELS = { pack: panelPack, bg: panelBg, icons: panelIcons, theme: panelTheme, widgets: panelWidgets, prompts: panelPrompts, backup: panelBackup };
  function renderPanel() {
    const p = panel();
    const keepScroll = p.scrollTop;
    p.innerHTML = `<div class="st-panel-in">${PANELS[step]()}${navFoot()}</div>`;
    p.scrollTop = keepScroll;
    if (step === "prompts") refreshPrompt();
    if (step === "pack") refreshPackPrompt();
    if (step === "backup")
      H.assets.usage().then((u) => {
        const el = H.$("[data-storage]");
        if (el) el.innerHTML = `<b>사진·영상 ${u.count}개 · ${H.bytes(u.own)}</b>${u.quota ? `<small>남은 공간 약 ${H.bytes(u.quota - u.usage)}</small><div class="bar"><i style="width:${Math.max(1.5, Math.min(100, (u.usage / u.quota) * 100))}%"></i></div>` : ""}`;
      });
  }
  function navFoot() {
    const i = STEPS.findIndex((s) => s[0] === step);
    const prev = STEPS[i - 1];
    const next = STEPS[i + 1];
    return `<footer class="st-foot">${prev ? `<button type="button" class="btn ghost" data-go="${prev[0]}">${H.svg("chevronL")} ${prev[1]}</button>` : "<span></span>"}
      ${next ? `<button type="button" class="btn primary" data-go="${next[0]}">다음 · ${next[1]} ${H.svg("chevronR")}</button>` : `<a class="btn primary" href="index.html">홈 화면에서 보기 ${H.svg("arrowR")}</a>`}</footer>`;
  }

  function wire() {
    const p = panel();
    H.$("#st-steps").addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (b) go(b.dataset.step);
    });
    p.addEventListener("click", async (e) => {
      const q = (sel) => e.target.closest(sel);
      let b;
      if ((b = q("[data-go]"))) return go(b.dataset.go);
      // background
      if ((b = q("[data-mode]"))) {
        const m = b.dataset.mode;
        const has = m === "ambient" || (m === "image" && (S().assets["bg:landscape"] || S().assets["bg:portrait"])) || (m === "video" && (S().bg.videoUrl || (S().assets["bg:video"] && S().assets["bg:video"].type.startsWith("video")))) || (m === "animated" && S().assets["bg:video"] && S().assets["bg:video"].type.startsWith("image"));
        if (!has) {
          const input = p.querySelector(m === "image" ? '[data-up="bg:landscape"]' : `[data-up-video="${m}"]`);
          input?.click();
          return;
        }
        set((s) => (s.bg.mode = m), "배경 종류");
        return renderPanel();
      }
      if ((b = q("[data-rm]"))) {
        H.assets.remove(b.dataset.rm);
        if (!S().assets["bg:landscape"] && !S().assets["bg:portrait"] && S().bg.mode === "image") set((s) => (s.bg.mode = "ambient"));
        saved();
        return renderPanel();
      }
      if (q("[data-apply-url]")) {
        const v = p.querySelector("[data-video-url]").value.trim();
        if (v && !H.isWebURL(v)) return H.ui.toast("https:// 로 시작하는 영상 파일 주소를 넣어 주세요.");
        set((s) => {
          s.bg.videoUrl = v;
          if (v) s.bg.mode = "video";
          else if (s.bg.mode === "video" && !s.assets["bg:video"]) s.bg.mode = "ambient";
        }, "영상 주소");
        H.ui.toast(v ? "영상 주소를 적용했어요. 재생은 미리보기에서 확인하세요." : "영상 주소를 지웠어요.");
        return renderPanel();
      }
      if (q("[data-export-video]")) {
        const blob = await H.assets.get("bg:video");
        if (blob) H.backup.deliver(blob, S().assets["bg:video"].name || "Hormé-배경영상.mp4");
        return;
      }
      // icons
      if ((b = q("[data-pick]"))) {
        selectedApp = b.dataset.pick;
        renderPanel();
        H.$(".icon-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      if ((b = q(".glyph-pick")) && selectedApp) {
        set((s) => (s.apps[selectedApp].glyph = b.dataset.glyph), "아이콘 기호");
        return renderPanel();
      }
      if (q("[data-icon-reset]") && selectedApp) {
        H.assets.remove("icon:" + selectedApp);
        saved();
        return renderPanel();
      }
      if (q("[data-clear-icons]")) {
        const ok = await H.ui.confirm({ title: "맞춤 아이콘 모두 지우기", msg: "넣은 아이콘 이미지가 모두 기본 기호로 돌아가요.", ok: "지우기", danger: true });
        if (!ok) return;
        H.store.commit((s) => Object.keys(s.assets).forEach((k) => k.startsWith("icon:") && delete s.assets[k]), { label: "맞춤 아이콘 지우기" });
        H.store.broadcastAssets([]);
        H.ui.toast("맞춤 아이콘을 지웠어요.", { action: { label: "되돌리기", fn: () => (H.store.undo(), renderPanel()) } });
        return renderPanel();
      }
      // theme
      if ((b = q("[data-preset]"))) {
        set((s) => {
          s.theme.preset = b.dataset.preset;
          s.theme.accent = "";
          s.theme.accent2 = "";
        }, "테마");
        return renderPanel();
      }
      if (q("[data-reset-colors]")) {
        set((s) => {
          s.theme.accent = "";
          s.theme.accent2 = "";
        });
        return renderPanel();
      }
      if ((b = q("[data-font]"))) {
        set((s) => (s.theme.clockFont = b.dataset.font));
        return renderPanel();
      }
      // widgets
      if ((b = q("[data-add-w]"))) return H.widgetEditor.gallery({ page: Number(b.dataset.addW) });
      if ((b = q("[data-wedit]"))) return H.widgetEditor.open(b.dataset.wedit);
      if ((b = q("[data-wdel]"))) return H.widgetEditor.remove(b.dataset.wdel);
      if ((b = q("[data-wsize]"))) {
        const [id, z] = b.dataset.wsize.split(":");
        H.store.commit((s) => s.widgets[id] && (s.widgets[id].size = z), { label: "위젯 크기" });
        return saved();
      }
      // prompts
      if (q("[data-copy]")) {
        const v = H.$("[data-out-prompt]").value;
        try {
          await navigator.clipboard.writeText(v);
          H.ui.toast("프롬프트를 복사했어요. 그림 생성 AI에 붙여 넣으세요.");
        } catch (err) {
          const ta = H.$("[data-out-prompt]");
          ta.focus();
          ta.select();
          H.ui.toast("선택된 글을 길게 눌러 복사해 주세요.");
        }
        return;
      }
      if (q("[data-regen]")) return refreshPrompt();
      // design pack
      if (q("[data-pack-copy]")) {
        const ta = H.$("[data-pack-prompt]");
        const ok = await copyText(ta.value, ta);
        H.ui.toast(ok ? "프롬프트를 복사했어요. AI 채팅에 붙여 넣으세요." : "선택된 글을 길게 눌러 복사해 주세요.");
        return;
      }
      if (q("[data-pack-clip]")) {
        try {
          H.$("[data-pack-paste]").value = await navigator.clipboard.readText();
        } catch (err) {
          H.ui.toast("붙여넣기 칸을 길게 눌러 ‘붙여넣기’를 골라 주세요.");
        }
        return;
      }
      if (q("[data-pack-apply]")) {
        const text = H.$("[data-pack-paste]").value;
        if (!text.trim()) return H.ui.toast("AI의 답을 먼저 붙여 넣어 주세요.");
        if (await H.pack.run({ text })) saved("디자인 팩 적용");
        return;
      }
      if (q("[data-pack-export]")) {
        H.ui.toast("디자인 팩을 만드는 중…");
        try {
          await H.pack.exportZip();
        } catch (err) {
          H.ui.toast(err.message || "디자인 팩을 만들지 못했어요.");
        }
        return;
      }
      // backup
      if (q("[data-bk-all]")) {
        H.ui.toast("백업 파일을 만드는 중…");
        try {
          await H.backup.exportAll({ includeVideo: H.$("#bk-video")?.checked !== false });
        } catch (err) {
          H.ui.toast("백업을 만들지 못했어요.");
        }
        return;
      }
      if (q("[data-bk-json]")) return H.backup.exportSettings();
      if (q("[data-bk-import]")) return H.backup.importFlow();
      if (q("[data-reset-design]")) {
        const ok = await H.ui.confirm({ title: "디자인 초기화", msg: "배경·테마·아이콘 이미지가 처음 상태로 돌아가요. 앱 배치와 위젯은 그대로예요.", ok: "초기화", danger: true });
        if (!ok) return;
        H.store.commit((x) => {
          x.theme = H.schema.defaultTheme();
          x.bg = H.schema.defaultBg();
          Object.keys(x.assets).forEach((k) => (k.startsWith("bg:") || k.startsWith("icon:")) && delete x.assets[k]);
        }, { label: "디자인 초기화" });
        H.ui.toast("디자인을 초기화했어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
        return renderPanel();
      }
      if (q("[data-reset-all]")) {
        const ok = await H.ui.confirm({ title: "모두 초기화", msg: "앱 배치·위젯·디자인·사진·영상이 모두 처음으로 돌아가요. 먼저 전체 백업을 권해요.", ok: "모두 초기화", danger: true });
        if (!ok) return;
        H.store.replace(H.schema.defaults(), { label: "모두 초기화" });
        H.ui.toast("처음 상태로 돌아왔어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
        return renderPanel();
      }
    });

    p.addEventListener("change", async (e) => {
      const el = e.target;
      if (el.dataset.up) {
        const f = el.files?.[0];
        el.value = "";
        if (f) uploadBgImage(el.dataset.up, f);
      }
      if (el.dataset.upVideo) {
        const f = el.files?.[0];
        el.value = "";
        if (f) uploadMoving(el.dataset.upVideo, f);
      }
      if (el.matches("[data-icon-up]") && selectedApp) {
        const f = el.files?.[0];
        el.value = "";
        if (f && (await setIcon(selectedApp, f))) renderPanel();
      }
      if (el.matches("[data-pack-files]")) {
        const files = [...(el.files || [])];
        el.value = "";
        if (files.length && (await H.pack.run({ files }))) saved("디자인 팩 적용");
      }
      if (el.matches("[data-bulk]")) {
        const files = [...(el.files || [])];
        el.value = "";
        // same engine as the design pack: names are matched, unknown names become new apps
        if (files.length && (await H.pack.run({ files }))) saved("아이콘 적용");
      }
      if (el.id === "motion-on") set((s) => (s.motion.on = el.checked));
      if (el.id === "particles") set((s) => (s.bg.particles = el.checked));
      if (el.id === "labels") set((s) => (s.theme.labels = el.checked));
      if (el.id === "p-notext") {
        promptState.noText = el.checked;
        refreshPrompt();
      }
      if (el.dataset.p) {
        promptState[el.dataset.p] = el.value;
        refreshPrompt();
      }
    });
    const liveRange = H.debounce((id, v) => {
      if (id === "shade") set((s) => (s.bg.shade = v / 100));
      if (id === "blur") set((s) => (s.bg.blur = v));
      if (id === "dim") set((s) => (s.bg.dim = v / 100));
      if (id === "density") set((s) => (s.motion.density = v));
      if (id === "radius") set((s) => (s.theme.iconRadius = v));
    }, 90);
    const liveText = H.debounce((fn) => set(fn), 250);
    p.addEventListener("input", (e) => {
      const el = e.target;
      if (el.type === "range") {
        const out = p.querySelector(`[data-out="${el.id}"]`);
        if (out) out.textContent = el.value + (out.textContent.replace(/^[\d.]+/, "") || "");
        liveRange(el.id, Number(el.value));
      }
      if (el.dataset.color) {
        const v = el.value;
        const k = el.dataset.color;
        liveText((s) => (s.theme[k] = v));
      }
      if (el.matches("[data-tagline]")) {
        const v = el.value;
        liveText((s) => (s.theme.tagline = v));
      }
      if (el.matches("[data-icon-q]")) {
        const q = el.value.trim();
        p.querySelectorAll(".ip-app").forEach((b) => (b.hidden = !!q && !H.matchScore(q, [b.dataset.name, b.dataset.pick])));
      }
      if (el.matches("[data-pack-wish]")) {
        packState.wish = el.value;
        refreshPackPrompt();
      }
      if (el.dataset.p === "subject" || el.dataset.p === "apps") {
        promptState[el.dataset.p] = el.value;
        refreshPrompt();
      }
    });
    p.addEventListener("dragover", (e) => {
      const z = e.target.closest("[data-drop]");
      if (!z) return;
      e.preventDefault();
      z.classList.add("over");
    });
    p.addEventListener("dragleave", (e) => e.target.closest("[data-drop]")?.classList.remove("over"));
    p.addEventListener("drop", async (e) => {
      const z = e.target.closest("[data-drop]");
      if (!z) return;
      e.preventDefault();
      z.classList.remove("over");
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length && (await H.pack.run({ files }))) saved("디자인 팩 적용");
    });
    H.ui.bindSeg(p, (name, v) => {
      const t = (fn) => set(fn);
      if (name === "fit" || name === "fit2") t((s) => (s.bg.fit = v));
      if (name === "speed") t((s) => (s.bg.speed = Number(v)));
      if (["iconSize", "glyphTint", "widgetStyle", "dock", "spacing"].includes(name)) t((s) => (s.theme[name] = v));
      if (name === "p-type") {
        promptState.type = v;
        renderPanel();
      }
      if (name === "p-lang") {
        promptState.lang = v;
        refreshPrompt();
      }
      if (name === "pk-mode" || name === "pk-scope") {
        packState[name === "pk-mode" ? "mode" : "scope"] = v;
        refreshPackPrompt();
      }
    });
  }

  /* ---------- live preview ---------- */
  function renderDevices() {
    H.$("#st-devices").innerHTML = DEVICES.map(([k, n, , , g]) => `<button type="button" role="radio" class="${k === device ? "on" : ""}" aria-checked="${k === device}" data-dev="${k}" title="${n}">${H.svg(g)}<span>${n}</span></button>`).join("");
  }
  function fitPreview() {
    const stage = H.$("#st-stage");
    const dev = DEVICES.find((d) => d[0] === device);
    const [, , w, h] = dev;
    const sw = stage.clientWidth - 8;
    const sh = stage.clientHeight - 8;
    if (sw <= 0 || sh <= 0) return;
    const scale = Math.min(sw / w, sh / h, 1);
    const box = H.$("#st-device");
    box.style.width = w * scale + "px";
    box.style.height = h * scale + "px";
    const fr = H.$("#st-frame");
    fr.style.width = w + "px";
    fr.style.height = h + "px";
    fr.style.transform = `scale(${scale})`;
    box.dataset.kind = device;
  }

  /* ---------- boot ---------- */
  async function boot() {
    await H.store.init();
    H.applyTheme();
    await H.assets.preload();
    renderNav();
    renderPanel();
    renderDevices();
    wire();
    H.$("#st-devices").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dev]");
      if (!b) return;
      device = b.dataset.dev;
      renderDevices();
      fitPreview();
    });
    H.$("#st-preview-open").onclick = () => {
      document.body.classList.add("preview-open");
      requestAnimationFrame(fitPreview);
    };
    H.$("#st-preview-close").onclick = () => document.body.classList.remove("preview-open");
    window.addEventListener("resize", H.debounce(fitPreview, 100));
    new ResizeObserver(H.debounce(fitPreview, 60)).observe(H.$("#st-stage"));
    fitPreview();
    H.listen("change", (d) => {
      H.applyTheme();
      if (d.remote || d.label === "undo" || d.label === "replace" || d.label === "백업 복원" || d.label === "widget-edit" || d.scope?.startsWith?.("widget") || ["위젯 추가", "위젯 제거", "위젯 크기"].some((x) => (d.label || "").includes(x))) {
        const typing = document.activeElement?.closest?.("#st-panel input, #st-panel textarea");
        if (!typing && step !== "prompts") renderPanel();
      }
    });
    H.listen("assets", () => step !== "prompts" && renderPanel());
    H.listen("assets-remote", (keys) => {
      H.assets.invalidate(keys);
      H.assets.preload().then(() => renderPanel());
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.target.closest("input, textarea")) {
        e.preventDefault();
        if (H.store.undo()) {
          H.ui.toast("되돌렸어요.");
          renderPanel();
        }
      }
    });
    if (H.store.migrated) H.ui.toast("이전 버전의 디자인 설정을 새 버전으로 옮겼어요.");
    document.body.classList.add("ready");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
