/* Ὁρμή — state shape, validation and migration from the v1 (PRISM/LAYER) format.
   Everything that comes from storage or an imported file passes through sanitize(). */
(() => {
  "use strict";
  const H = window.H;
  const KEY_RE = /^[\w-]{1,64}$/;
  const ASSET_RE = /^(bg:(landscape|portrait|video)|icon:[\w-]{1,64}|w:[\w-]+:\w+)$/;
  const HEX = /^#[0-9a-f]{6}$/i;
  const MAX_PAGES = 12;
  const MAX_DOCK = 10;

  const makeApp = (c, i = 0) => ({
    id: c.id,
    name: c.name,
    glyph: c.glyph,
    category: c.category,
    app: c.app || "",
    web: c.web || "",
    mode: "auto",
    aliases: (c.aliases || []).slice(),
    added: i,
  });
  H.makeApp = makeApp;

  const defaultTheme = () => ({
    preset: "graphite",
    accent: "",
    accent2: "",
    iconRadius: 24,
    iconSize: "m",
    labels: true,
    dock: "glass",
    spacing: "standard",
    clockFont: "thin",
    widgetStyle: "glass",
    glyphTint: "light",
    tagline: "A space made yours.",
  });
  const defaultBg = () => ({ mode: "ambient", shade: 0.35, blur: 0, particles: true, fit: "cover", speed: 1, dim: 0.35, videoUrl: "" });
  const defaultPrefs = () => ({ hour12: false, openWeb: "auto", search: "google", installHint: true, confirmDelete: true, power: "auto", oled: false });

  function defaults() {
    const apps = {};
    H.DEFAULT_APPS.forEach((c, i) => (apps[c.id] = makeApp(c, i)));
    const widgets = {};
    const pages = H.DEFAULT_LAYOUT.pages.map((p) => {
      const items = [];
      p.widgets.forEach((spec) => {
        const w = H.makeWidget(spec.type, spec.size);
        widgets[w.id] = w;
        items.push("w:" + w.id);
      });
      p.apps.forEach((a) => apps[a] && items.push("a:" + a));
      return { id: H.uid("p"), items };
    });
    return {
      v: 2,
      apps,
      folders: {},
      widgets,
      pages,
      dock: H.DEFAULT_LAYOUT.dock.slice(),
      page: 0,
      theme: defaultTheme(),
      bg: defaultBg(),
      motion: { on: true, density: 24 },
      prefs: defaultPrefs(),
      assets: {},
      stats: {},
      recent: [],
      createdAt: Date.now(),
    };
  }

  /* Split a single legacy URL into {app, web}. */
  function splitURL(url) {
    const u = H.str(url, 1024).trim();
    if (!u || !H.safeURL(u)) return { app: "", web: "" };
    return H.isWebURL(u) ? { app: "", web: u } : { app: u, web: "" };
  }

  function sanitizeApp(a, fallbackIndex) {
    if (!a || typeof a !== "object" || !KEY_RE.test(a.id || "")) return null;
    let app = H.str(a.app, 1024).trim();
    let web = H.str(a.web, 1024).trim();
    if (app && !H.safeURL(app)) app = "";
    if (web && !H.safeURL(web)) web = "";
    if (web && !H.isWebURL(web)) {
      // a scheme typed into the web field → treat as app link
      if (!app) app = web;
      web = "";
    }
    return {
      id: a.id,
      name: (H.str(a.name, 42).trim() || "앱"),
      glyph: H.glyphs[a.glyph] ? a.glyph : "sparkle",
      category: H.oneOf(a.category, H.CATEGORIES, "유틸리티"),
      app,
      web,
      mode: H.oneOf(a.mode, ["auto", "app", "web"], "auto"),
      aliases: (Array.isArray(a.aliases) ? a.aliases : []).filter((x) => typeof x === "string").slice(0, 10).map((x) => x.slice(0, 30)),
      added: H.num(a.added, fallbackIndex, 0),
    };
  }

  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== "object" || !raw.apps || typeof raw.apps !== "object") return d;
    const s = { v: 2 };

    /* apps */
    s.apps = {};
    const appList = Array.isArray(raw.apps) ? raw.apps : Object.values(raw.apps);
    appList.slice(0, 400).forEach((a, i) => {
      const x = sanitizeApp(a, i);
      if (x && !s.apps[x.id]) s.apps[x.id] = x;
    });

    /* widgets */
    s.widgets = {};
    Object.values(raw.widgets && typeof raw.widgets === "object" ? raw.widgets : {})
      .slice(0, 80)
      .forEach((w) => {
        const x = H.sanitizeWidget(w);
        if (x && KEY_RE.test(x.id) && !s.widgets[x.id]) s.widgets[x.id] = x;
      });

    /* folders */
    s.folders = {};
    const inFolder = new Set();
    Object.values(raw.folders && typeof raw.folders === "object" ? raw.folders : {})
      .slice(0, 60)
      .forEach((f) => {
        if (!f || !KEY_RE.test(f.id || "")) return;
        const apps = (Array.isArray(f.apps) ? f.apps : []).filter((id) => s.apps[id] && !inFolder.has(id));
        if (!apps.length) return;
        apps.forEach((id) => inFolder.add(id));
        s.folders[f.id] = { id: f.id, name: H.str(f.name, 30).trim() || "폴더", apps: apps.slice(0, 60) };
      });

    /* pages: every widget/folder exactly once, apps once on the home screen */
    const seen = new Set();
    const pagesRaw = Array.isArray(raw.pages) ? raw.pages.slice(0, MAX_PAGES) : [];
    s.pages = pagesRaw
      .map((p) => {
        const items = (Array.isArray(p?.items) ? p.items : []).filter((key) => {
          if (typeof key !== "string" || seen.has(key)) return false;
          const [t, id] = [key.slice(0, 1), key.slice(2)];
          const ok = (t === "a" && s.apps[id] && !inFolder.has(id)) || (t === "w" && s.widgets[id]) || (t === "f" && s.folders[id]);
          if (ok) seen.add(key);
          return !!ok;
        });
        return { id: KEY_RE.test(p?.id || "") ? p.id : H.uid("p"), items: items.slice(0, 120) };
      });
    if (!s.pages.length) s.pages = [{ id: H.uid("p"), items: [] }];
    Object.keys(s.folders).forEach((id) => {
      if (!seen.has("f:" + id)) s.pages[s.pages.length - 1].items.push("f:" + id);
    });
    Object.keys(s.widgets).forEach((id) => {
      if (!seen.has("w:" + id)) delete s.widgets[id];
    });

    /* dock */
    s.dock = [...new Set((Array.isArray(raw.dock) ? raw.dock : []).filter((id) => s.apps[id]))].slice(0, MAX_DOCK);

    s.page = H.num(raw.page, 0, 0, s.pages.length);

    /* theme */
    const t = raw.theme && typeof raw.theme === "object" ? raw.theme : {};
    const dt = defaultTheme();
    s.theme = {
      preset: H.THEMES[t.preset] ? t.preset : dt.preset,
      accent: HEX.test(t.accent || "") ? t.accent : "",
      accent2: HEX.test(t.accent2 || "") ? t.accent2 : "",
      iconRadius: H.num(t.iconRadius, dt.iconRadius, 8, 50),
      iconSize: H.oneOf(t.iconSize, ["s", "m", "l"], "m"),
      labels: t.labels !== false,
      dock: H.oneOf(t.dock, ["glass", "solid", "clear"], "glass"),
      spacing: H.oneOf(t.spacing, ["compact", "standard", "spacious"], "standard"),
      clockFont: H.oneOf(t.clockFont, ["thin", "serif", "mono", "rounded"], "thin"),
      widgetStyle: H.oneOf(t.widgetStyle, ["glass", "solid", "outline"], "glass"),
      glyphTint: H.oneOf(t.glyphTint, ["light", "accent"], "light"),
      tagline: typeof t.tagline === "string" ? t.tagline.slice(0, 90) : dt.tagline,
    };

    /* background */
    const b = raw.bg && typeof raw.bg === "object" ? raw.bg : {};
    s.bg = {
      mode: H.oneOf(b.mode, ["ambient", "image", "video", "animated"], "ambient"),
      shade: H.num(b.shade, 0.35, 0, 0.9),
      blur: H.num(b.blur, 0, 0, 30),
      particles: b.particles !== false,
      fit: H.oneOf(b.fit, ["cover", "contain"], "cover"),
      speed: H.oneOf(Number(b.speed), [0.5, 0.75, 1, 1.25, 1.5], 1),
      dim: H.num(b.dim, 0.35, 0, 0.9),
      videoUrl: H.isWebURL(b.videoUrl) ? b.videoUrl.slice(0, 1024) : "",
    };

    const m = raw.motion && typeof raw.motion === "object" ? raw.motion : {};
    s.motion = { on: m.on !== false, density: H.num(m.density, 24, 0, 80) };

    const p = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
    s.prefs = {
      hour12: !!p.hour12,
      openWeb: H.oneOf(p.openWeb, ["auto", "same", "new"], "auto"),
      search: H.oneOf(p.search, ["google", "naver", "duckduckgo"], "google"),
      installHint: p.installHint !== false,
      confirmDelete: p.confirmDelete !== false,
      power: H.oneOf(p.power, ["auto", "saver", "normal", "smooth"], "auto"),
      oled: !!p.oled,
    };

    /* asset manifest */
    s.assets = {};
    const am = raw.assets && typeof raw.assets === "object" ? raw.assets : {};
    Object.entries(am).slice(0, 400).forEach(([k, v]) => {
      if (!ASSET_RE.test(k) || !v || typeof v !== "object") return;
      s.assets[k] = { type: H.str(v.type, 60, "application/octet-stream"), size: H.num(v.size, 0, 0), t: H.num(v.t, 0, 0), name: H.str(v.name, 120) };
    });
    // icons of removed apps are dropped from the manifest (blobs are garbage-collected later)
    Object.keys(s.assets).forEach((k) => {
      if (k.startsWith("icon:") && !s.apps[k.slice(5)]) delete s.assets[k];
    });

    /* usage stats */
    s.stats = {};
    const st = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
    Object.entries(st).forEach(([id, v]) => {
      if (s.apps[id] && Array.isArray(v)) s.stats[id] = [H.num(v[0], 0, 0, 1e7), H.num(v[1], 0, 0)];
    });
    s.recent = [...new Set((Array.isArray(raw.recent) ? raw.recent : []).filter((id) => typeof id === "string" && s.apps[id]))].slice(0, 12);
    s.createdAt = H.num(raw.createdAt, Date.now(), 0);
    return s;
  }

  /* ---------- v1 (prism-state-v1) → v2 ---------- */
  const V1_WIDGET = { focus: "focus", motion: "ambient", clock: "clock", text: "memo", link: "link", photo: "photo", countdown: "dday" };
  function fromV1(old) {
    const out = defaults();
    const assets = [];
    if (!old || !Array.isArray(old.apps)) return { state: out, assets };
    const v1Apps = old.apps.filter((a) => a && typeof a.id === "string" && typeof a.name === "string" && KEY_RE.test(a.id));
    const legacyDefaults = {};
    const oldDefaultURL = {
      safari: "https://www.google.com", music: "https://music.apple.com/", photos: "https://www.icloud.com/photos/", files: "",
      calendar: "https://www.icloud.com/calendar/", notes: "https://www.icloud.com/notes/", maps: "https://maps.apple.com/",
      shortcuts: "shortcuts://", youtube: "https://www.youtube.com/", spotify: "https://open.spotify.com/", chatgpt: "https://chatgpt.com/",
      goodnotes: "", clock: "", mail: "mailto:", appstore: "https://apps.apple.com/kr/", interchange: "", drive: "https://drive.google.com/",
      docs: "https://docs.google.com/", sheets: "https://sheets.google.com/", classroom: "https://classroom.google.com/", figma: "https://www.figma.com/",
      procreate: "", discord: "https://discord.com/app", pinterest: "https://www.pinterest.com/", soundcloud: "https://soundcloud.com/",
      notion: "https://www.notion.so/", camera: "", books: "https://books.apple.com/", calculator: "", messages: "", meet: "", freeform: "",
      settings: "layer://settings",
    };
    const apps = {};
    v1Apps.forEach((a, i) => {
      const cat = H.DEFAULT_APPS.find((c) => c.id === a.id);
      const url = typeof a.url === "string" ? a.url.trim() : "";
      let app;
      if (cat && (url === (oldDefaultURL[a.id] ?? "") || url === "layer://settings")) {
        app = makeApp(cat, i); // untouched default → take the improved v2 links
        legacyDefaults[a.id] = true;
      } else {
        const split = splitURL(url);
        app = {
          ...(cat ? makeApp(cat, i) : { id: a.id, glyph: "sparkle", category: "유틸리티", aliases: [], added: i, mode: "auto" }),
          ...split,
          mode: split.app ? "app" : "auto",
        };
      }
      app.name = a.name === "LAYER 설정" ? "Ὁρμή 설정" : a.name.slice(0, 42);
      if (!cat) {
        const V1_GLYPH = { graduation: "cap", play: "playRect", note: "notepad", image: "photo", spark: "sparkle", cloud: "cloudUp", sheets: "sheet", message: "bubble", video: "videoCam", store: "bag", pencil: "nib", waveform: "wave", settings: "gear", briefcase: "bag", rocket: "bolt", shield: "lock", flower: "leaf", check: "list", terminal: "terminal", tv: "tv" };
        const g = V1_GLYPH[a.icon] || a.icon;
        if (H.glyphs[g]) app.glyph = g;
      }
      if (H.CATEGORIES.includes(a.category)) app.category = a.category;
      if (typeof a.added === "number" && a.added > 1e9) app.added = a.added;
      apps[a.id] = app;
      if (typeof a.customImage === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(a.customImage))
        assets.push({ key: "icon:" + a.id, dataURL: a.customImage });
    });
    out.apps = apps;

    /* Was the v1 layout still the factory layout? Then use the new default arrangement. */
    const V1_DOCK = ["safari", "music", "photos", "chatgpt", "files", "youtube"];
    const v1DefaultPage = (id) => {
      const i = H.DEFAULT_APPS.findIndex((c) => c.id === id);
      return i < 0 ? undefined : i < 16 ? 0 : i < 32 ? 1 : null;
    };
    const untouched =
      !v1Apps.some((a) => a.order !== undefined) &&
      v1Apps.every((a) => v1DefaultPage(a.id) !== undefined && v1DefaultPage(a.id) === a.page && !!a.dock === V1_DOCK.includes(a.id));
    const sorted = (pg) => v1Apps.filter((a) => a.page === pg).sort((a, b) => (a.order ?? a.added ?? 0) - (b.order ?? b.added ?? 0)).map((a) => a.id);

    /* widgets from v1 slots */
    const slots = Array.isArray(old.widgetSlots) ? old.widgetSlots.slice(0, 2) : [{ type: "focus" }, { type: "motion" }];
    const widgetKeys = [];
    const widgets = {};
    const hero = H.makeWidget("hero", "m");
    widgets[hero.id] = hero;
    slots.forEach((slot) => {
      const type = V1_WIDGET[slot?.type] || "memo";
      const w = H.makeWidget(type, "s");
      if (type === "focus") Object.assign(w, { title: H.str(old.focus, 70, w.title) || w.title, total: H.num(old.focusTotal, 4, 1, 12), done: H.num(old.focusDone, 0, 0, 12) });
      if (type === "memo") Object.assign(w, { title: H.str(slot.title, 30, "QUICK NOTE"), text: H.str(slot.text, 1200) });
      if (type === "link") Object.assign(w, { title: H.str(slot.title, 30, "바로가기"), url: H.safeURL(slot.url) ? slot.url : "", note: H.str(slot.text, 60) });
      if (type === "dday" && /^\d{4}-\d{2}-\d{2}$/.test(slot.date || "")) w.events = [{ id: H.uid("i"), title: H.str(slot.text, 40) || H.str(slot.title, 40) || "목표일", date: slot.date }];
      if (type === "photo") {
        w.caption = H.str(slot.text, 60);
        if (typeof slot.image === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(slot.image)) {
          const k = `w:${w.id}:0`;
          w.images = [k];
          assets.push({ key: k, dataURL: slot.image });
        }
      }
      widgets[w.id] = w;
      widgetKeys.push("w:" + w.id);
    });

    if (untouched) {
      // keep the fresh default pages (built in defaults()) but swap page-1 widgets for the user's
      const defPage1 = out.pages[0].items.filter((k) => k.startsWith("a:"));
      Object.keys(out.widgets).forEach((id) => {
        if (!out.pages[0].items.includes("w:" + id)) widgets[id] = out.widgets[id];
      });
      out.pages[0].items = ["w:" + hero.id, ...widgetKeys, ...defPage1];
      out.widgets = widgets;
      out.pages.forEach((p) => (p.items = p.items.filter((k) => !k.startsWith("a:") || apps[k.slice(2)])));
      out.dock = H.DEFAULT_LAYOUT.dock.filter((id) => apps[id]);
    } else {
      out.widgets = widgets;
      out.pages = [
        { id: H.uid("p"), items: ["w:" + hero.id, ...widgetKeys, ...sorted(0).map((id) => "a:" + id)] },
        { id: H.uid("p"), items: sorted(1).map((id) => "a:" + id) },
      ];
      out.dock = v1Apps.filter((a) => a.dock).map((a) => a.id).slice(0, 8);
    }

    /* look & feel */
    const preset = H.THEMES[old.theme] ? old.theme : "graphite";
    out.theme = {
      ...out.theme,
      preset,
      accent: HEX.test(old.designAccent || "") ? old.designAccent : "",
      accent2: HEX.test(old.designAccent2 || "") ? old.designAccent2 : "",
      iconRadius: H.num(old.iconRadius, 24, 8, 50),
      dock: H.oneOf(old.dockStyle, ["glass", "solid", "clear"], "glass"),
      spacing: { compact: "compact", spacious: "spacious" }[old.layoutStyle] || "standard",
      tagline: typeof old.heroTagline === "string" ? old.heroTagline.slice(0, 90) : out.theme.tagline,
    };
    out.motion = { on: old.motion !== false, density: H.num(old.density, 24, 0, 80) };
    out.bg = {
      ...out.bg,
      shade: H.num(old.wallpaperShade, 0.35, 0, 0.9),
      dim: H.num(old.videoDim, 0.35, 0, 0.9),
      fit: old.videoFit === "contain" ? "contain" : "cover",
      speed: H.oneOf(Number(old.videoSpeed), [0.5, 0.75, 1, 1.25, 1.5], 1),
      videoUrl: H.isWebURL(old.videoUrl) ? old.videoUrl : "",
    };
    if (typeof old.wallpaper === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(old.wallpaper)) {
      assets.push({ key: "bg:landscape", dataURL: old.wallpaper });
      out.bg.mode = "image";
      out.bg.particles = old.motion !== false;
    }
    if (old.videoName) out.bg.mode = old.videoKind === "image" ? "animated" : "video";
    else if (out.bg.videoUrl) out.bg.mode = "video";
    out.recent = (Array.isArray(old.recent) ? old.recent : []).filter((id) => typeof id === "string" && apps[id]).slice(0, 12);
    return { state: out, assets, legacyVideo: !!old.videoName, legacyVideoName: H.str(old.videoName, 120), legacyVideoKind: old.videoKind === "image" ? "animated" : "video" };
  }

  /* ---------- legacy design file (HORME_INTERFACE_DESIGN / PRISM_DESIGN / …) → patch ---------- */
  function fromDesign(obj, base) {
    const st = JSON.parse(JSON.stringify(base));
    const assets = [];
    if (H.THEMES[obj.theme]) st.theme.preset = obj.theme;
    if (HEX.test(obj.designAccent || "")) st.theme.accent = obj.designAccent;
    if (HEX.test(obj.designAccent2 || "")) st.theme.accent2 = obj.designAccent2;
    if (obj.iconRadius !== undefined) st.theme.iconRadius = H.num(obj.iconRadius, 24, 8, 50);
    if (typeof obj.heroTagline === "string") st.theme.tagline = obj.heroTagline.slice(0, 90);
    if (obj.dockStyle) st.theme.dock = H.oneOf(obj.dockStyle, ["glass", "solid", "clear"], "glass");
    if (obj.layoutStyle) st.theme.spacing = { compact: "compact", spacious: "spacious" }[obj.layoutStyle] || "standard";
    if (obj.motion !== undefined) st.motion.on = obj.motion !== false;
    if (obj.wallpaperShade !== undefined) st.bg.shade = H.num(obj.wallpaperShade, 0.35, 0, 0.9);
    if (obj.videoDim !== undefined) st.bg.dim = H.num(obj.videoDim, 0.35, 0, 0.9);
    if (obj.videoFit) st.bg.fit = obj.videoFit === "contain" ? "contain" : "cover";
    if (H.isWebURL(obj.videoUrl)) {
      st.bg.videoUrl = obj.videoUrl;
      st.bg.mode = "video";
    }
    if (typeof obj.wallpaper === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(obj.wallpaper)) {
      assets.push({ key: "bg:landscape", dataURL: obj.wallpaper });
      st.bg.mode = "image";
    }
    (Array.isArray(obj.icons) ? obj.icons : []).slice(0, 250).forEach((it) => {
      if (it && st.apps[it.id] && typeof it.customImage === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(it.customImage))
        assets.push({ key: "icon:" + it.id, dataURL: it.customImage });
    });
    return { state: st, assets };
  }

  H.schema = { KEY: "horme-state-v2", V1_KEY: "prism-state-v1", defaults, sanitize, fromV1, fromDesign, defaultTheme, defaultBg, defaultPrefs, makeApp, MAX_DOCK, MAX_PAGES, ASSET_RE };
})();
