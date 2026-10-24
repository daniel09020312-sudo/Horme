/* Ὁρμή — design pack: one file (or one paste) that carries a whole look — colours, backgrounds,
   app icons, and which apps sit on the home screen.

   Accepted in one go:
   - a .zip with pack.json (or design.json) + image/video files
   - a pack .json whose images are inline (SVG markup or data: URLs)
   - several files picked together: images named after apps ("Chrome.png", "카카오톡.jpg"),
     "배경-가로.jpg" / "wallpaper-portrait.png", "배경.mp4", optionally a pack.json
   - JSON text pasted from an AI chat (code fences and chatter around it are ignored)

   Icons decide the apps: an icon for an app that is not on the home screen adds it (from the
   built-in catalog when the name is known, otherwise as a new shortcut), and "replace" rebuilds
   the home screen from the icons in the pack. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const pack = {};
  const IMG_RE = /\.(png|jpe?g|webp|gif|avif|heic|heif|bmp|svg)$/i;
  const VID_RE = /\.(mp4|m4v|mov|webm)$/i;
  const BG_RE = /^(bg|background|wallpaper|wall|배경|배경화면|바탕화면)([\s._-]*(landscape|land|horizontal|가로|portrait|port|vertical|세로|video|영상))?$/i;
  const PORTRAIT_RE = /(portrait|port|vertical|세로)$/i;
  const THEME_KEYS = ["preset", "accent", "accent2", "iconRadius", "iconSize", "labels", "widgetStyle", "dock", "clockFont", "glyphTint", "spacing", "tagline"];

  const stem = (name) => String(name || "").split("/").pop().replace(/\.[^.]+$/, "").normalize("NFC").trim();
  const clean = (s) =>
    H.norm(
      stem(s)
        .replace(/^(icon|아이콘|app|앱)[\s._-]+/i, "")
        .replace(/^\d{1,3}[\s._-]+/, "")
        .replace(/[\s._-]+(icon|아이콘|app|앱)$/i, ""),
    );
  const pretty = (s) => stem(s).replace(/^(icon|아이콘)[\s._-]+/i, "").replace(/^\d{1,3}[\s._-]+/, "").replace(/[_]+/g, " ").trim().slice(0, 42);
  const isFile = (x) => x && typeof x === "object" && typeof x.size === "number" && typeof x.type === "string";

  /* ---------- text → JSON ---------- */
  pack.extractJSON = (text) => {
    let t = String(text || "").trim();
    const fence = /```(?:json|javascript|js)?\s*([\s\S]*?)```/i.exec(t);
    if (fence) t = fence[1];
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    t = t.slice(a, b + 1);
    try {
      return JSON.parse(t);
    } catch (e) {
      try {
        return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); // trailing commas
      } catch (e2) {
        return null;
      }
    }
  };

  /* ---------- files → { doc, files } ---------- */
  async function unzip(file, files) {
    const z = await H.zip.read(file);
    let doc = null;
    for (const name of z.names) {
      if (name.endsWith("/") || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
      const bytes = await z.bytes(name);
      if (!bytes) continue;
      const base = name.split("/").pop();
      if (/\.json$/i.test(base)) {
        try {
          const obj = JSON.parse(new TextDecoder().decode(bytes));
          if (!doc || /^(pack|design|horme)/i.test(base)) doc = obj;
        } catch (e) {}
        continue;
      }
      const type = mimeOf(base);
      if (!type) continue;
      files.set(base.toLowerCase(), new File([bytes], base, { type }));
    }
    return doc;
  }
  const mimeOf = (n) => {
    const e = (n.split(".").pop() || "").toLowerCase();
    return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", svg: "image/svg+xml", heic: "image/heic", heif: "image/heif", bmp: "image/bmp", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" }[e] || "";
  };
  pack.read = async (list) => {
    const files = new Map();
    let doc = null;
    for (const f of list) {
      if (!isFile(f)) continue;
      const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (head[0] === 0x50 && head[1] === 0x4b) {
        const d = await unzip(f, files);
        if (d && !doc) doc = d;
      } else if (/\.json$/i.test(f.name) || f.type === "application/json") {
        try {
          doc = JSON.parse(await f.text());
        } catch (e) {
          throw Error(`${f.name}: JSON 형식이 아니에요.`);
        }
      } else if (IMG_RE.test(f.name) || VID_RE.test(f.name) || /^(image|video)\//.test(f.type)) {
        files.set(f.name.toLowerCase(), f);
      }
    }
    return { doc: doc || {}, files };
  };
  /* Is this a backup rather than a design pack? */
  pack.isBackup = (doc) => doc && (doc.format === "HORME_BACKUP" || Array.isArray(doc.apps) && doc.apps.some((a) => a && a.url !== undefined && a.page !== undefined));

  /* ---------- images ---------- */
  function svgBlob(src, kind) {
    let s = String(src);
    const i = s.indexOf("<svg");
    const j = s.lastIndexOf("</svg>");
    if (i < 0 || j < i) throw Error("SVG를 읽지 못했어요.");
    s = s.slice(i, j + 6);
    s = s
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
      .replace(/(href\s*=\s*)("|')\s*(javascript|https?):[^"']*\2/gi, '$1$2#$2');
    let tag = /<svg\b[^>]*>/i.exec(s)[0];
    const orig = tag;
    if (!/\sxmlns=/.test(tag)) tag = tag.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    if (/xlink:/.test(s) && !/xmlns:xlink=/.test(tag)) tag = tag.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    // give it a pixel size so it is decoded sharply (AI output often has only a viewBox)
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
    const vw = vb ? +vb[1] : 1024;
    const vh = vb ? +vb[2] : 1024;
    const target = kind === "icon" ? 1024 : 2732;
    const k = target / Math.max(vw, vh);
    tag = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    tag = tag.replace("<svg", `<svg width="${Math.round(vw * k)}" height="${Math.round(vh * k)}"`);
    s = s.replace(orig, tag);
    return new Blob([s], { type: "image/svg+xml" });
  }
  /* A value from the pack (file name, SVG, data: URL, https URL) → Blob or null */
  async function blobFor(v, files, kind) {
    if (!v) return null;
    if (isFile(v)) return v;
    if (typeof v !== "string") return null;
    const s = v.trim();
    if (s.includes("<svg")) return svgBlob(s, kind);
    if (/^data:/i.test(s)) return H.assets.dataURLToBlob(s);
    const f = files.get(s.split("/").pop().toLowerCase()) || [...files.values()].find((x) => clean(x.name) === clean(s));
    if (f) return f;
    if (/^https:\/\//i.test(s) && kind !== "video") {
      const r = await fetch(s, { mode: "cors" }).catch(() => null);
      if (r?.ok) return await r.blob();
      throw Error(`${s.slice(0, 60)} — 인터넷 주소의 이미지는 가져올 수 없었어요. 파일로 받아서 함께 넣어 주세요.`);
    }
    if (IMG_RE.test(s) || VID_RE.test(s)) throw Error(`${s} 파일이 없어요. 함께 선택해 주세요.`);
    return null;
  }

  /* ---------- apps ---------- */
  /* name / id / file name → an app: one already on this device first, then the built-in catalog */
  function findApp(key, extra) {
    const k = clean(key);
    if (!k) return null;
    const hit = (list) =>
      list.find((a) => H.norm(a.id) === k) ||
      list.find((a) => H.norm(a.name) === k) ||
      list.find((a) => (a.aliases || []).some((x) => H.norm(x) === k)) ||
      list.find((a) => k.length >= 4 && H.norm(a.name).replace(/^google/, "") === k.replace(/^google/, ""));
    const own = hit(Object.values(S().apps));
    if (own) return { app: own, isNew: false };
    const planned = hit(extra);
    if (planned) return { app: planned, isNew: true };
    const cat = hit(H.CATALOG());
    if (cat) return S().apps[cat.id] ? { app: S().apps[cat.id], isNew: false } : { app: H.makeApp(cat, Date.now()), isNew: true };
    return null;
  }
  function customApp(name, url) {
    const app = H.makeApp({ id: H.uid("a"), name: pretty(name) || "새 앱", glyph: "sparkle", category: "유틸리티", app: "", web: "", aliases: [] }, Date.now());
    if (typeof url === "string" && H.safeURL(url.trim())) {
      if (H.isWebURL(url.trim())) app.web = url.trim();
      else app.app = url.trim();
    }
    return app;
  }

  /* ---------- doc + files → plan (nothing applied yet) ---------- */
  pack.plan = async (doc, files = new Map()) => {
    const plan = { name: H.str(doc.name || doc.title, 60), theme: {}, bg: {}, motion: null, media: [], apps: [], dock: [], notes: [], layout: null };
    const note = (m) => plan.notes.push(m);

    /* theme */
    const th = doc.theme && typeof doc.theme === "object" ? doc.theme : {};
    if (typeof doc.theme === "string") th.preset = doc.theme;
    THEME_KEYS.forEach((k) => th[k] !== undefined && (plan.theme[k] = th[k]));
    ["accent", "accent2"].forEach((k) => {
      let c = plan.theme[k];
      if (typeof c !== "string") return delete plan.theme[k];
      c = c.trim();
      if (/^#[0-9a-f]{3}$/i.test(c)) c = "#" + c.slice(1).replace(/./g, "$&$&");
      if (/^#[0-9a-f]{6}$/i.test(c)) plan.theme[k] = c.toLowerCase();
      else delete plan.theme[k];
    });
    if (plan.theme.preset && !H.THEMES[plan.theme.preset]) delete plan.theme.preset;

    /* backgrounds */
    const bgd = doc.background && typeof doc.background === "object" ? doc.background : doc.wallpaper ? { landscape: doc.wallpaper } : {};
    ["shade", "blur", "particles", "fit", "dim", "speed"].forEach((k) => bgd[k] !== undefined && (plan.bg[k] = bgd[k]));
    const loose = [...files.values()];
    const bgFiles = { landscape: bgd.landscape || bgd.image, portrait: bgd.portrait, video: bgd.video };
    for (const f of loose) {
      const st = stem(f.name).toLowerCase();
      if (VID_RE.test(f.name) && !bgFiles.video) bgFiles.video = f;
      else if (BG_RE.test(st)) {
        if (/(video|영상)$/.test(st) || (f.type === "image/gif" && !bgFiles.video)) bgFiles.video = f;
        else if (PORTRAIT_RE.test(st)) bgFiles.portrait = bgFiles.portrait || f;
        else bgFiles.landscape = bgFiles.landscape || f;
      }
    }
    const used = new Set();
    for (const role of ["landscape", "portrait"]) {
      try {
        const b = await blobFor(bgFiles[role], files, "wallpaper");
        if (!b) continue;
        if (isFile(bgFiles[role])) used.add(bgFiles[role]);
        const isGif = b.type === "image/gif";
        const out = await H.assets.processImage(b.type ? b : new File([b], "bg.png", { type: "image/png" }), "wallpaper");
        if (isGif && !bgFiles.video) {
          bgFiles.video = b;
          continue;
        }
        plan.media.push({ key: "bg:" + role, blob: out, name: b.name || `${role}.${(out.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, thumb: true });
      } catch (e) {
        note(`배경(${role === "landscape" ? "가로" : "세로"}): ${e.message}`);
      }
    }
    if (bgFiles.video) {
      try {
        if (typeof bgFiles.video === "string" && /^https:\/\//i.test(bgFiles.video)) {
          plan.bg.videoUrl = bgFiles.video;
          plan.bg.mode = "video";
        } else {
          const v = await blobFor(bgFiles.video, files, "video");
          if (v) {
            if (isFile(bgFiles.video)) used.add(bgFiles.video);
            const animated = /^image\//.test(v.type);
            const file = isFile(v) ? v : new File([v], animated ? "background.gif" : "background.mp4", { type: v.type });
            const ok = await H.assets.probeMedia(file, animated ? "animated" : "video");
            if (!ok) throw Error(animated ? "움직이는 이미지를 열 수 없어요." : "이 기기에서 재생할 수 없는 영상이에요. MP4(H.264)를 권해요.");
            plan.media.push({ key: "bg:video", blob: file, name: file.name });
            plan.bg.mode = animated ? "animated" : "video";
          }
        }
      } catch (e) {
        note(`배경 영상: ${e.message}`);
      }
    }
    if (!plan.bg.mode && plan.media.some((m) => m.key === "bg:landscape" || m.key === "bg:portrait")) plan.bg.mode = "image";
    if (bgd.mode && ["ambient", "image", "video", "animated"].includes(bgd.mode) && !(bgd.mode !== "ambient" && !plan.bg.mode)) plan.bg.mode = bgd.mode;
    if (doc.motion && typeof doc.motion === "object") plan.motion = { on: doc.motion.on !== false, density: H.num(doc.motion.density, S().motion.density, 0, 80) };

    /* apps + icons */
    const entries = [];
    if (Array.isArray(doc.apps)) doc.apps.forEach((a) => a && typeof a === "object" && entries.push({ key: a.id || a.name, name: a.name, icon: a.icon, url: a.url, dock: !!a.dock }));
    if (doc.icons && typeof doc.icons === "object" && !Array.isArray(doc.icons)) Object.entries(doc.icons).forEach(([k, v]) => entries.push({ key: k, name: k, icon: v }));
    const named = new Set(entries.map((e) => clean(e.key)));
    for (const f of loose) {
      if (used.has(f) || !IMG_RE.test(f.name) || BG_RE.test(stem(f.name).toLowerCase())) continue;
      const referenced = entries.some((e) => typeof e.icon === "string" && e.icon.split("/").pop().toLowerCase() === f.name.toLowerCase());
      if (!referenced && !named.has(clean(f.name))) entries.push({ key: f.name, name: f.name, icon: f, fromFile: true });
    }
    const extra = [];
    const seen = new Set();
    for (const e of entries.slice(0, 120)) {
      let found = findApp(e.key, extra) || (e.name && e.name !== e.key ? findApp(e.name, extra) : null);
      const app = found ? found.app : customApp(e.name || e.key, e.url);
      const isNew = found ? found.isNew : true;
      if (seen.has(app.id)) continue;
      seen.add(app.id);
      if (isNew) extra.push(app);
      const item = { id: app.id, name: app.name, app, isNew, custom: !found, dock: !!e.dock, icon: null };
      if (e.icon) {
        try {
          const b = await blobFor(e.icon, files, "icon");
          if (b) {
            item.icon = await H.assets.processImage(isFile(b) ? b : new File([b], `${app.id}.${b.type === "image/svg+xml" ? "svg" : "png"}`, { type: b.type || "image/png" }), "icon");
            plan.media.push({ key: "icon:" + app.id, blob: item.icon, name: isFile(b) ? b.name : `${app.name}.png` });
          }
        } catch (err) {
          note(`${app.name} 아이콘: ${err.message}`);
        }
      }
      plan.apps.push(item);
    }
    if (Array.isArray(doc.dock))
      doc.dock.forEach((d) => {
        const m = plan.apps.find((a) => clean(a.id) === clean(d) || clean(a.name) === clean(d)) || (findApp(d, extra)?.app && plan.apps.find((a) => a.id === findApp(d, extra).app.id));
        if (m) m.dock = true;
      });
    plan.layout = doc.layout === "replace" || doc.layout === "add" ? doc.layout : plan.apps.length >= 4 ? "replace" : "add";
    return plan;
  };

  /* ---------- apply ---------- */
  pack.apply = async (plan, { layout = plan.layout } = {}) => {
    const snap = H.store.snapshot();
    for (const m of plan.media) await H.assets.put(m.key, m.blob, { name: m.name || "", silent: true });
    H.store.commit(
      (st) => {
        if (Object.keys(plan.theme).length) {
          if (plan.theme.preset && plan.theme.accent === undefined) st.theme.accent = st.theme.accent2 = "";
          Object.assign(st.theme, plan.theme);
        }
        Object.assign(st.bg, plan.bg);
        if (plan.motion) Object.assign(st.motion, plan.motion);
        plan.apps.forEach((a) => {
          if (!st.apps[a.id]) st.apps[a.id] = a.app;
        });
        const ids = plan.apps.map((a) => a.id);
        if (layout === "replace" && ids.length) {
          let dockIds = plan.apps.filter((a) => a.dock).map((a) => a.id);
          if (!dockIds.length) {
            dockIds = st.dock.filter((id) => ids.includes(id));
            if (dockIds.length < 3) dockIds = ids.slice(0, Math.min(6, Math.max(0, ids.length - 4)));
          }
          const pageApps = ids.filter((id) => !dockIds.includes(id));
          const caps = st.pages.map((p) => p.items.filter((k) => k[0] === "a" || k[0] === "f").length);
          st.pages.forEach((p) => (p.items = p.items.filter((k) => k[0] === "w")));
          st.folders = {};
          let i = 0;
          st.pages.forEach((p, pi) => {
            const take = pageApps.slice(i, i + caps[pi]);
            i += take.length;
            p.items.push(...take.map((id) => "a:" + id));
          });
          while (i < pageApps.length && st.pages.length < H.schema.MAX_PAGES) {
            const take = pageApps.slice(i, i + 24);
            i += take.length;
            st.pages.push({ id: H.uid("p"), items: take.map((id) => "a:" + id) });
          }
          st.dock = dockIds.slice(0, H.schema.MAX_DOCK);
        } else {
          const onHome = (id) => st.dock.includes(id) || st.pages.some((p) => p.items.includes("a:" + id)) || Object.values(st.folders).some((f) => f.apps.includes(id));
          const last = st.pages[st.pages.length - 1];
          ids.filter((id) => !onHome(id)).forEach((id) => last.items.push("a:" + id));
        }
      },
      { undo: false, label: "디자인 팩" },
    );
    H.store.pushUndo(snap, "디자인 팩");
    H.emit("change", { label: "디자인 팩", undoable: true, scope: "all" });
    const keys = plan.media.map((m) => m.key);
    H.assets.invalidate?.(keys);
    H.store.broadcastAssets(keys);
    H.emit("assets", keys);
  };

  /* ---------- UI: summary → confirm ---------- */
  pack.confirm = (plan) =>
    new Promise((resolve) => {
      const icons = plan.apps.filter((a) => a.icon);
      const added = plan.apps.filter((a) => a.isNew);
      const custom = plan.apps.filter((a) => a.custom && !a.app.web && !a.app.app);
      const bgs = plan.media.filter((m) => m.key.startsWith("bg:"));
      const th = plan.theme;
      const lines = [];
      if (Object.keys(th).length)
        lines.push(`<li>${H.svg("palette")}<span>테마${th.preset ? ` ${H.esc(H.THEMES[th.preset].name)}` : ""}${th.accent ? ` <i class="sw" style="background:${th.accent}"></i>` : ""}${th.accent2 ? `<i class="sw" style="background:${th.accent2}"></i>` : ""}${th.tagline ? ` · “${H.esc(th.tagline)}”` : ""}</span></li>`);
      if (bgs.length || plan.bg.videoUrl) lines.push(`<li>${H.svg("image")}<span>배경 ${bgs.map((m) => ({ "bg:landscape": "가로", "bg:portrait": "세로", "bg:video": plan.bg.mode === "animated" ? "움직이는 이미지" : "영상" })[m.key]).join(" · ")}${plan.bg.videoUrl ? "영상 주소" : ""}</span></li>`);
      if (icons.length) lines.push(`<li>${H.svg("grid")}<span>앱 아이콘 ${icons.length}개${added.length ? ` · 새로 추가되는 앱 ${added.length}개` : ""}</span></li>`);
      const strip = icons
        .slice(0, 40)
        .map((a) => `<span class="pk-icon" title="${H.esc(a.name)}"><img src="${URL.createObjectURL(a.icon)}" alt=""><small>${H.esc(a.name)}</small></span>`)
        .join("");
      const s = H.ui.sheet({
        title: plan.name ? `디자인 팩 · ${plan.name}` : "디자인 팩 적용",
        sub: "아래 내용을 한 번에 적용해요. 적용한 뒤에도 ‘되돌리기’로 취소할 수 있어요.",
        size: "md",
        cls: "pack-sheet",
        body: `<ul class="pk-list">${lines.join("") || "<li><span>바꿀 내용이 없어요.</span></li>"}</ul>
          ${strip ? `<div class="pk-icons">${strip}</div>` : ""}
          ${custom.length ? `<p class="hint">이름으로 찾지 못한 앱 ${custom.length}개(${custom.slice(0, 6).map((a) => H.esc(a.name)).join(", ")}${custom.length > 6 ? " …" : ""})는 새 바로가기로 만들어요. 나중에 길게 눌러 링크를 넣어 주세요.</p>` : ""}
          ${plan.apps.length ? H.ui.switch("pk-replace", plan.layout === "replace", "이 아이콘들로 홈 화면 앱 구성하기", "켜면 홈 화면과 Dock의 앱이 팩에 든 앱으로 바뀌어요(위젯은 그대로). 끄면 아이콘만 바꾸고 없는 앱은 마지막 페이지에 더해요.") : ""}
          ${plan.notes.length ? `<details class="pk-notes"><summary>적용하지 못한 항목 ${plan.notes.length}개</summary><ul>${plan.notes.map((n) => `<li>${H.esc(n)}</li>`).join("")}</ul></details>` : ""}`,
        foot: `<button type="button" class="btn ghost" data-x>취소</button><button type="button" class="btn primary" data-ok ${lines.length ? "" : "disabled"}>적용하기</button>`,
        onClose: () => {
          s.body.querySelectorAll(".pk-icon img").forEach((im) => URL.revokeObjectURL(im.src));
          resolve(null);
        },
      });
      s.foot.querySelector("[data-x]").onclick = () => s.close();
      s.foot.querySelector("[data-ok]").onclick = () => {
        const replace = s.body.querySelector("#pk-replace")?.checked;
        resolve({ layout: replace ? "replace" : "add" });
        s.close();
      };
    });

  /* Whole flow from files or pasted text. Returns true when something was applied. */
  pack.run = async ({ files = [], text = "" } = {}) => {
    let doc = {};
    let map = new Map();
    try {
      H.ui.toast("디자인 팩을 읽는 중…", { ms: 1800 });
      if (files.length) {
        const r = await pack.read([...files]);
        doc = r.doc;
        map = r.files;
      }
      if (text.trim()) {
        const d = pack.extractJSON(text);
        if (!d) throw Error("붙여 넣은 글에서 디자인 팩(JSON)을 찾지 못했어요. AI 답을 처음부터 끝까지 그대로 복사해 주세요.");
        doc = { ...doc, ...d };
      }
      if (pack.isBackup(doc) && files.length === 1) return H.backup.importFile(files[0]);
      const plan = await pack.plan(doc, map);
      const choice = await pack.confirm(plan);
      if (!choice) return false;
      await pack.apply(plan, choice);
      H.ui.toast(`디자인 팩을 적용했어요${plan.notes.length ? ` (못 넣은 항목 ${plan.notes.length}개)` : ""}.`, { action: { label: "되돌리기", fn: () => H.store.undo() } });
      return true;
    } catch (e) {
      console.error(e);
      H.ui.toast(e.message || "디자인 팩을 적용하지 못했어요.", { ms: 4200 });
      return false;
    }
  };
  pack.pick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".zip,.json,application/zip,application/json,image/*,video/*,.svg";
    input.onchange = () => input.files?.length && pack.run({ files: [...input.files] });
    input.click();
  };

  /* ---------- prompt for an AI chat (Claude, ChatGPT, Gemini …) ---------- */
  pack.homeApps = (scope = "home") => {
    const st = S();
    const ids =
      scope === "all"
        ? Object.keys(st.apps).filter((id) => id !== "settings")
        : [...st.dock, ...st.pages.flatMap((p) => p.items.flatMap((k) => (k[0] === "a" ? [k.slice(2)] : k[0] === "f" && st.folders[k.slice(2)] ? st.folders[k.slice(2)].apps : [])))];
    return [...new Set(ids)].map((id) => st.apps[id]).filter(Boolean).map((a) => ({ name: a.name, dock: st.dock.includes(a.id) }));
  };
  pack.prompt = ({ wish = "", mode = "svg", scope = "home" } = {}) => {
    const apps = pack.homeApps(scope);
    const list = apps.map((a) => `- ${a.name}${a.dock ? " (dock)" : ""}`).join("\n");
    const presets = Object.keys(H.THEMES).join(" | ");
    const files = mode === "zip";
    const iconVal = files ? '"Chrome.png"' : '"<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1024 1024\'>…</svg>"';
    const bgL = files ? '"background-landscape.png"' : '"<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 2732 2048\'>…</svg>"';
    const bgP = files ? '"background-portrait.png"' : '"<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1536 2048\'>…</svg>"';
    return [
      "너는 iPad·iPhone용 홈 화면 런처 앱 ‘Ὁρμή(HORME)’의 디자인 팩을 만드는 시각 디자이너야.",
      "아래 요구대로 배경, 앱 아이콘, 테마 색을 한 벌로 디자인해 줘.",
      "",
      "[원하는 분위기]",
      wish.trim() || "차분하고 고급스러운 어두운 톤. 사람이 공들여 디자인한 느낌.",
      "",
      `[앱 목록] 순서대로 홈 화면에 놓여요. (dock)이 붙은 앱은 화면 아래 Dock에 들어가요. 모두 ${apps.length}개.`,
      list,
      "",
      "[아이콘 규칙]",
      "- 모든 아이콘이 하나의 디자인 체계를 공유: 같은 바탕, 같은 선 두께, 같은 조명과 색 규칙.",
      "- 정사각형을 끝까지 꽉 채운 바탕. 둥근 모서리·테두리·바깥 그림자는 그리지 않기 (런처가 모서리를 둥글게 깎아요).",
      "- 앱을 떠올리게 하는 단순한 기호 하나를 가운데 70% 안에. 회사 로고를 그대로 베끼지 말고, 글자는 넣지 않기.",
      "- 작게(48px) 봐도 알아볼 수 있게, 대비는 또렷하게.",
      files
        ? "- 아이콘마다 1024×1024 PNG 한 장. 파일 이름은 앱 목록의 이름 그대로 (예: Chrome.png, 카카오톡.png)."
        : "- 아이콘마다 SVG 하나 (viewBox 0 0 1024 1024). <path> <rect> <circle> <ellipse> <g> <defs> <linearGradient> <radialGradient> <stop>만 쓰고, <text> <image> <script>, 외부 링크는 쓰지 않기. 하나당 1~3KB로 간결하게.",
      "",
      "[배경 규칙]",
      "- 가로용과 세로용 두 장. 왼쪽 위에 큰 시계, 가운데와 아래에 아이콘이 놓이니 그 부분은 차분하게, 시선을 끄는 요소는 가장자리에.",
      files ? "- 가로 2732×2048, 세로 1536×2048 PNG 또는 JPG." : "- SVG로, 부드러운 그라디언트와 도형 위주. 한 장에 3~8KB.",
      "",
      "[출력 형식]",
      files
        ? "이미지를 모두 만든 뒤, 아래 형식의 pack.json과 함께 하나의 zip 파일로 묶어 내려받기 링크로 줘. JSON 안의 이미지 값에는 zip 안의 파일 이름을 적어."
        : "반드시 아래 형식의 JSON 하나만 ```json 코드 블록 안에 출력해. 중간에 끊지 말고 끝까지. SVG 안의 속성 따옴표는 작은따옴표(')로 써서 JSON이 깨지지 않게 해.",
      "{",
      '  "format": "HORME_DESIGN_PACK",',
      '  "version": 2,',
      '  "name": "팩 이름",',
      '  "theme": {',
      `    "preset": "${presets} 중 가장 가까운 것",`,
      '    "accent": "#RRGGBB 밝은 포인트 색",',
      '    "accent2": "#RRGGBB 보조 색",',
      '    "iconRadius": 16에서 40 사이 숫자 (모서리 둥글기 %),',
      '    "widgetStyle": "glass | solid | outline",',
      '    "dock": "glass | solid | clear",',
      '    "clockFont": "thin | serif | mono | rounded",',
      '    "glyphTint": "light | accent",',
      '    "tagline": "시계 아래에 들어갈 짧은 문구"',
      "  },",
      `  "background": { "mode": "image", "landscape": ${bgL}, "portrait": ${bgP}, "shade": 0.2 },`,
      '  "layout": "replace",',
      '  "apps": [',
      `    { "name": "앱 목록의 이름 그대로", "dock": true, "icon": ${iconVal} }`,
      "  ]",
      "}",
      "- apps에는 앱 목록의 모든 앱을 같은 순서로 넣어. 이름을 바꾸면 Ὁρμή가 앱을 알아보지 못해요.",
      '- 목록에 없는 앱을 더하고 싶으면 { "name": "…", "url": "https://…", "icon": … } 처럼 주소를 함께 적어.',
    ].join("\n");
  };

  /* ---------- the current look → a pack (zip) ---------- */
  pack.exportZip = async () => {
    const st = S();
    const files = [];
    const ext = (t) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" })[t] || "bin";
    const doc = { format: "HORME_DESIGN_PACK", version: 2, name: "내 디자인", theme: {}, background: { mode: st.bg.mode, shade: st.bg.shade, blur: st.bg.blur, particles: st.bg.particles }, motion: { ...st.motion }, layout: "replace", apps: [] };
    THEME_KEYS.forEach((k) => (doc.theme[k] = st.theme[k]));
    for (const [role, key] of [["landscape", "bg:landscape"], ["portrait", "bg:portrait"], ["video", "bg:video"]]) {
      const b = st.assets[key] && (await H.assets.get(key));
      if (!b) continue;
      const name = `background-${role}.${ext(b.type)}`;
      files.push({ name, data: b });
      doc.background[role] = name;
    }
    const homeIds = [...st.pages.flatMap((p) => p.items.filter((k) => k[0] === "a").map((k) => k.slice(2))), ...Object.values(st.folders).flatMap((f) => f.apps)];
    const ids = [...new Set([...homeIds, ...st.dock])];
    for (const id of ids) {
      const a = st.apps[id];
      if (!a) continue;
      const entry = { name: a.name, id: a.id };
      if (st.dock.includes(id)) entry.dock = true;
      if (!H.catalogById(id)) entry.url = a.web || a.app || "";
      const b = st.assets["icon:" + id] && (await H.assets.get("icon:" + id));
      if (b) {
        const name = `icons/${a.id}.${ext(b.type)}`;
        files.push({ name, data: b });
        entry.icon = name.split("/").pop();
      }
      doc.apps.push(entry);
    }
    files.unshift({ name: "pack.json", data: JSON.stringify(doc, null, 1) });
    const zip = await H.zip.create(files);
    const d = new Date();
    return H.backup.deliver(zip, `Hormé-디자인팩-${d.getFullYear()}${H.pad(d.getMonth() + 1)}${H.pad(d.getDate())}.zip`);
  };

  H.pack = pack;
})();
