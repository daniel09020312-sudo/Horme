/* Ὁρμή launcher — background: ambient canvas, photo (separate portrait/landscape), video, animated image.
   Battery notes
   - The colour haze lives on its own tiny canvas (1/6 resolution, stretched by the GPU — it is a soft
     gradient, so nothing is lost). It is drawn once, and only drifts in "smooth" mode.
   - The main canvas carries just the thin waves and particles, drawn with setTimeout at the power
     level's frame rate (12 fps normally) at device-pixel-ratio 1, each frame handed to
     requestAnimationFrame so nothing is drawn while the page is hidden.
   - In glass-lite mode (see power.js) the canvas leaves the area behind glass panels empty, so the
     panels need no live blur.
   - The ambient widget's bars ride on the same frames instead of running their own 60 fps animation.
   - Everything stops in power saver, when hidden, behind the standby clock or a full-screen
     sheet; a video pauses and an animated image is swapped for a still frame in the same cases. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const P = () => H.power;
  const bg = {};
  let canvas, ctx, haze, hctx, imgEl, vid, anim, still, shade;
  let W = 0, Hh = 0, dpr = 1, parts = [], t = 0, overlay = false, mode = "ambient";
  let timer = 0, raf = 0, lastFrame = 0, staticDirty = true, hazeDirty = true;
  const HAZE_SCALE = 1 / 6;
  let videoSrc = "", animSrc = "", imageKey = "", imageT = 0, primed = false;

  const theme = () => H.THEMES[S().theme.preset] || H.THEMES.graphite;

  function seed() {
    parts = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * Hh,
      r: 0.3 + Math.random() * 0.95,
      vx: (Math.random() - 0.5) * 0.13,
      vy: (Math.random() - 0.5) * 0.11,
      s: Math.random() * Math.PI * 2,
    }));
  }
  function resize(reseed = true) {
    glassRects = null;
    dpr = Math.min(window.devicePixelRatio || 1, P().level().dpr);
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    if (reseed || !parts.length || Math.abs(nw - W) > 40 || Math.abs(nh - Hh) > 40) {
      W = nw;
      Hh = nh;
      seed();
    }
    W = nw;
    Hh = nh;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(Hh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    haze.width = Math.max(8, Math.ceil(W * HAZE_SCALE));
    haze.height = Math.max(8, Math.ceil(Hh * HAZE_SCALE));
    hctx.setTransform(HAZE_SCALE, 0, 0, HAZE_SCALE, 0, 0);
    staticDirty = true;
    hazeDirty = true;
  }

  /* Colour haze: two soft radial glows, on the low-resolution haze canvas. */
  function drawHaze() {
    const [c1, c2] = theme().ambient;
    const drift = P().level().haze ? 1 : 0;
    hctx.clearRect(0, 0, W, Hh);
    const h = (x, y, rad, c, o) => {
      const g = hctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${c},${o})`);
      g.addColorStop(0.42, `rgba(${c},${o * 0.25})`);
      g.addColorStop(1, `rgba(${c},0)`);
      hctx.fillStyle = g;
      hctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    h(W * (0.21 + Math.sin(t * 0.55) * 0.04 * drift), Hh * (0.36 + Math.cos(t * 0.6) * 0.035 * drift), Math.max(W, Hh) * 0.52, c1.join(","), 0.11);
    h(W * (0.76 + Math.sin(t * 0.47) * 0.05 * drift), Hh * (0.73 + Math.sin(t * 0.55) * 0.08 * drift), Math.max(W, Hh) * 0.42, c2.join(","), 0.11);
    hazeDirty = false;
  }

  /* Rectangles of glass panels on screen (glass-lite: the canvas stays empty behind them). */
  const GLASS = ".tile.widget:not(.bare):not(.wst-solid) > .wg, .top-actions .icon-btn, .live-pill, .pill-btn:not(.primary), .folder-icon, .lib-search, .lib-card";
  let glassRects = null; // cached; dropped whenever layout may have moved
  const dropRects = () => (glassRects = null);
  let movingUntil = 0; // page transition / scrolling: measure every frame for a moment
  const moving = (ms) => {
    movingUntil = Math.max(movingUntil, performance.now() + ms);
    glassRects = null;
  };
  function measureGlass() {
    const rs = [];
    const add = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > Hh) return;
      rs.push(r);
    };
    document.querySelectorAll(GLASS).forEach(add);
    const dock = document.body.dataset.dock;
    if (dock !== "clear" && dock !== "solid") {
      const d = document.getElementById("dock");
      if (d) add(d);
    }
    return rs;
  }
  function glassClip() {
    const c = document.body.classList;
    const live = c.contains("swiping") || c.contains("dragging") || c.contains("editing") || performance.now() < movingUntil;
    const rs = !glassRects || live ? (glassRects = measureGlass()) : glassRects;
    if (!rs.length) return false;
    ctx.beginPath();
    ctx.rect(0, 0, W, Hh);
    // inset a little: the panels have rounded corners and a 1px border
    for (const r of rs) ctx.rect(r.left + 2, r.top + 2, Math.max(0, r.width - 4), Math.max(0, r.height - 4));
    ctx.clip("evenodd");
    return true;
  }

  function draw(dt) {
    const [c1, c2] = theme().ambient;
    t += dt * 0.225;
    const k = dt * 30; // particle speeds were tuned per 1/30 s
    if (!overlay && (hazeDirty || (dt && P().level().haze))) drawHaze();
    ctx.clearRect(0, 0, W, Hh);
    ctx.save();
    if (P().glassLite()) glassClip();
    const step = W > 900 ? 8 : 6;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      const base = Hh * (0.49 + j * 0.055);
      for (let x = 0; x <= W + step; x += step) {
        const y = base + Math.sin(x * 0.006 + t * (1 + j * 0.2) + j * 1.2) * Hh * 0.078 + Math.sin(x * 0.014 - t * 0.4 + j) * Hh * 0.026;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${(j % 2 ? c2 : c1).join(",")},${(overlay ? 0.05 : 0.038) - j * 0.004})`;
      ctx.lineWidth = j === 1 ? 1.3 : 0.85;
      ctx.stroke();
    }
    const n = Math.min(parts.length, S().motion.density);
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      if (k) {
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.s += 0.014 * k;
        if (p.x > W + 4) p.x = -4;
        if (p.x < -4) p.x = W + 4;
        if (p.y > Hh + 4) p.y = -4;
        if (p.y < -4) p.y = Hh + 4;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(225,229,246,${0.15 + (Math.sin(p.s) + 1) * 0.12})`;
      ctx.fill();
    }
    ctx.restore();
    staticDirty = false;
  }

  /* Ambient widget bars (normal mode): one CSS variable per frame, the transform is computed in CSS. */
  const barsOn = () => document.body.dataset.power === "normal" && !!document.querySelector(".wave-bars:not(.paused)");
  function stepBars(now) {
    const ph = ((now / 1000) % 1.8).toFixed(3);
    document.querySelectorAll(".wave-bars:not(.paused)").forEach((el) => el.style.setProperty("--ph", ph));
  }

  /* ---------- scheduler ---------- */
  const canvasOn = () => canvas.style.display !== "none";
  // a full-screen sheet, folder or search covers the background: no need to keep drawing it
  const covered = () => {
    const c = document.body.classList;
    return c.contains("sheet-open") || c.contains("folder-open") || c.contains("spot-open");
  };
  const running = () => P().animate() && P().level().fps > 0 && !covered() && (canvasOn() || barsOn());
  function stop() {
    clearTimeout(timer);
    timer = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
  }
  function frame() {
    raf = 0;
    if (!running()) return stop();
    const now = performance.now();
    const interval = 1000 / P().level().fps;
    // the timer wakes a little early; if this vsync is still too soon, take the next one
    if (lastFrame && now - lastFrame < interval - 10) return void (raf = requestAnimationFrame(frame));
    const dt = lastFrame ? Math.min(0.25, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (canvasOn()) draw(dt);
    if (barsOn()) stepBars(now);
    timer = setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(frame);
    }, Math.max(0, interval - 12));
  }
  function kick() {
    if (running()) {
      if (!timer && !raf) raf = requestAnimationFrame(frame);
      return;
    }
    stop();
    if (canvasOn() && staticDirty) draw(0);
  }
  bg.kick = kick;
  /* layout moved (page swipe, edit mode, re-render): the empty areas behind glass must follow */
  const relayout = H.debounce(() => {
    dropRects();
    if (!P().glassLite()) return;
    staticDirty = true;
    kick();
  }, 120);

  /* ---------- photo ---------- */
  async function setImage() {
    const portrait = H.isPortrait();
    const key = portrait && S().assets["bg:portrait"] ? "bg:portrait" : S().assets["bg:landscape"] ? "bg:landscape" : S().assets["bg:portrait"] ? "bg:portrait" : "";
    const tm = key ? S().assets[key].t : 0;
    if (key === imageKey && tm === imageT) return;
    imageKey = key;
    imageT = tm;
    const url = key ? await H.assets.url(key) : "";
    imgEl.style.backgroundImage = url ? `url("${url}")` : "none";
  }

  /* ---------- video ---------- */
  const videoMotion = () => P().motion();
  function syncVideo() {
    if (!videoSrc) return;
    if (videoMotion()) {
      vid.play().catch(() => {});
      return;
    }
    vid.pause();
    // iOS shows nothing until a video has played once: play a moment to get a still frame
    if (!primed && vid.readyState < 2 && !document.hidden) {
      primed = true;
      vid
        .play()
        .then(() => !videoMotion() && vid.pause())
        .catch(() => {});
    }
  }
  async function setVideo(on) {
    if (!on) {
      if (videoSrc) {
        vid.pause();
        vid.removeAttribute("src");
        vid.load();
        videoSrc = "";
      }
      document.body.classList.remove("bg-video-ready");
      return;
    }
    const b = S().bg;
    const src = b.videoUrl || (S().assets["bg:video"] ? await H.assets.url("bg:video") : "");
    if (!src) return;
    if (src !== videoSrc) {
      videoSrc = src;
      primed = false;
      document.body.classList.remove("bg-video-ready");
      vid.src = src;
    }
    vid.playbackRate = b.speed;
    vid.style.objectFit = b.fit;
    syncVideo();
  }

  /* ---------- animated image (GIF / APNG / animated WebP) ---------- */
  function drawStill() {
    const sw = anim.naturalWidth;
    const sh = anim.naturalHeight;
    if (!sw || !sh) return false;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    still.width = Math.floor(W * r);
    still.height = Math.floor(Hh * r);
    const c = still.getContext("2d");
    c.setTransform(r, 0, 0, r, 0, 0);
    c.clearRect(0, 0, W, Hh);
    const fit = S().bg.fit === "contain" ? Math.min : Math.max;
    const sc = fit(W / sw, Hh / sh);
    const dw = sw * sc;
    const dh = sh * sc;
    try {
      c.drawImage(anim, (W - dw) / 2, (Hh - dh) / 2, dw, dh);
      return true;
    } catch (e) {
      return false;
    }
  }
  function syncAnimated() {
    if (!animSrc) {
      document.body.classList.remove("bg-frozen");
      return;
    }
    const freeze = !P().motion();
    const frozen = document.body.classList.contains("bg-frozen");
    if (freeze && frozen && (still.width !== Math.floor(W * Math.min(window.devicePixelRatio || 1, 2)))) drawStill(); // rotated while frozen
    if (freeze && !frozen) {
      if (!anim.complete) return anim.addEventListener("load", syncAnimated, { once: true });
      if (drawStill()) document.body.classList.add("bg-frozen");
    } else if (!freeze) document.body.classList.remove("bg-frozen");
  }
  async function setAnimated(on) {
    if (!on) {
      if (animSrc) {
        anim.removeAttribute("src");
        animSrc = "";
      }
      document.body.classList.remove("bg-frozen");
      return;
    }
    const src = S().assets["bg:video"] ? await H.assets.url("bg:video") : "";
    if (src && src !== animSrc) {
      animSrc = src;
      document.body.classList.remove("bg-frozen");
      anim.src = src;
    }
    anim.style.objectFit = S().bg.fit;
    syncAnimated();
  }

  /* Re-evaluate everything that moves (power level, visibility, standby changed). */
  function syncMotion() {
    syncVideo();
    syncAnimated();
    kick();
  }

  bg.sync = async () => {
    const b = S().bg;
    mode = b.mode;
    if (mode === "image" && !S().assets["bg:landscape"] && !S().assets["bg:portrait"]) mode = "ambient";
    if (mode === "video" && !b.videoUrl && !S().assets["bg:video"]) mode = "ambient";
    if (mode === "animated" && !S().assets["bg:video"]) mode = "ambient";
    document.body.dataset.bg = mode;
    imgEl.style.filter = b.blur ? `blur(${b.blur}px)` : "";
    imgEl.style.transform = b.blur ? "scale(1.06)" : "";
    imgEl.style.backgroundSize = b.fit;
    shade.style.opacity = mode === "image" ? b.shade : mode === "video" || mode === "animated" ? b.dim : 0;
    P().glass();
    hazeDirty = true;
    if (mode === "image") await setImage();
    await setVideo(mode === "video");
    await setAnimated(mode === "animated");
    overlay = mode !== "ambient";
    const showCanvas = mode === "ambient" || (b.particles && S().motion.on);
    canvas.style.display = showCanvas ? "block" : "none";
    staticDirty = true;
    if (!overlay) drawHaze();
    kick();
  };

  bg.init = () => {
    canvas = H.$("#bg-canvas");
    ctx = canvas.getContext("2d");
    haze = H.$("#bg-haze");
    hctx = haze.getContext("2d");
    imgEl = H.$("#bg-image");
    vid = H.$("#bg-video");
    anim = H.$("#bg-anim");
    still = H.$("#bg-still");
    shade = H.$("#bg-shade");
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.addEventListener("loadeddata", () => document.body.classList.add("bg-video-ready"));
    vid.addEventListener("playing", () => document.body.classList.add("bg-video-ready"));
    vid.addEventListener("error", () => {
      if (!videoSrc) return;
      document.body.classList.remove("bg-video-ready");
      H.ui.toast("배경 영상을 재생하지 못했어요. MP4(H.264) 파일을 권해요.");
    });
    resize();
    window.addEventListener(
      "resize",
      H.debounce(() => {
        resize(false);
        bg.sync();
      }, 150),
    );
    document.addEventListener("visibilitychange", syncMotion);
    H.listen("motion-state", syncMotion);
    H.listen("page", () => {
      moving(500);
      setTimeout(relayout, 420);
    });
    H.listen("editing", relayout);
    H.listen("change", dropRects);
    document.addEventListener(
      "scroll",
      () => {
        moving(250);
        relayout();
      },
      { capture: true, passive: true },
    );
    // sheets / folders / search opening or closing → pause or resume
    let wasCovered = false;
    new MutationObserver(() => {
      const c = covered();
      if (c !== wasCovered) {
        wasCovered = c;
        kick();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    H.listen("power", () => {
      resize(false); // the power level decides the canvas resolution
      bg.sync();
    });
    // iOS may block autoplay until the first touch
    document.addEventListener("pointerdown", () => videoSrc && vid.paused && videoMotion() && vid.play().catch(() => {}), { passive: true });
    window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => {
      H.applyTheme();
      kick();
    });
    bg.sync();
  };

  H.bg = bg;
})();
