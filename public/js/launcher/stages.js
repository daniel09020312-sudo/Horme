/* Ὁρμή launcher — category stages: every app category gets its own way of choosing an app.
     게임        조각   the screen is cut by random lines into shards; tap a shard
     엔터테인먼트 다이얼  spin a radio dial, the app at the top is selected
     소셜        궤도   apps orbit like planets
     크리에이티브 물감   apps are paint drops that drift and can be flicked
     공부        카드   a deck of flash cards to swipe through
     생산성      키보드 keycaps you press (typing a letter highlights its key)
     유틸리티    스위치 a control board of toggle switches
     생활        지도   pins on a contour map
   Any style can be picked for any category (remembered per category); "목록" is the plain grid.
   Battery: a stage animates only while it is open. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const stages = {};
  const STYLES = [
    ["shards", "조각", "grid"],
    ["dial", "다이얼", "target"],
    ["orbit", "궤도", "atom"],
    ["drops", "물감", "palette"],
    ["cards", "카드", "layers"],
    ["keys", "키보드", "keyboard"],
    ["switches", "스위치", "sliders"],
    ["map", "지도", "map"],
    ["list", "목록", "list"],
  ];
  const DEFAULT = { 게임: "shards", 엔터테인먼트: "dial", 소셜: "orbit", 크리에이티브: "drops", 공부: "cards", 생산성: "keys", 유틸리티: "switches", 생활: "map" };
  const HINT = {
    shards: "무작위 선으로 나뉜 조각을 눌러요",
    dial: "돌려서 위쪽 표시에 맞추고, 가운데를 눌러 열어요",
    orbit: "돌고 있는 행성을 눌러요",
    drops: "물감 방울을 눌러 열고, 끌어서 던질 수 있어요",
    cards: "옆으로 넘기고, 카드를 눌러 열어요 (← → 키도 돼요)",
    keys: "키를 눌러요 · 키보드로 첫 글자를 치면 그 키가 켜지고 Enter로 열려요",
    switches: "스위치를 올리면 열려요",
    map: "지도의 핀을 눌러요",
    list: "눌러서 열어요",
  };
  const esc = H.esc;
  const hash = (s) => Array.from(String(s)).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hue = (app) => hash(app.id) % 360;
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const icon = (app, size) => `<span class="stg-ico" style="--sz:${Math.round(size)}px">${H.home.iconHTML(app)}</span>`;
  const reduced = () => H.reducedMotion();

  let layer = null;
  let cleanup = null;
  let current = null; // { name, apps, style }

  stages.styleFor = (cat) => S().prefs.stages?.[cat] || DEFAULT[cat] || "shards";
  stages.isOpen = () => !!layer;

  /* ---------- launching ---------- */
  function launch(app, el) {
    if (!app || !layer || layer.classList.contains("launching")) return;
    H.haptic(10);
    layer.classList.add("launching");
    el?.classList.add("picked");
    setTimeout(() => {
      H.launch.app(app);
      setTimeout(close, 420);
    }, reduced() ? 0 : 260);
  }

  /* ---------- open / close ---------- */
  stages.open = (name, apps) => {
    close(true);
    current = { name, apps, style: stages.styleFor(name) };
    layer = H.h(`<div class="stage-layer" role="dialog" aria-modal="true" aria-label="${esc(name)}">
      <header class="stg-head">
        <div class="stg-title"><b>${esc(name)}</b><small>${apps.length}개</small></div>
        <nav class="stg-styles" aria-label="고르는 방식">${STYLES.map(([k, n, g]) => `<button type="button" data-style="${k}">${H.svg(g)}<span>${n}</span></button>`).join("")}</nav>
        <button type="button" class="icon-btn stg-add" aria-label="${esc(name)}에 앱 추가">${H.svg("plus")}</button>
        <button type="button" class="icon-btn stg-close" aria-label="닫기">${H.svg("close")}</button>
      </header>
      <main class="stg-body"></main>
      <p class="stg-hint"></p></div>`);
    document.body.append(layer);
    document.body.classList.add("stage-open");
    requestAnimationFrame(() => layer?.classList.add("open"));
    layer.querySelector(".stg-close").onclick = () => close();
    layer.querySelector(".stg-add").onclick = () => {
      close();
      H.sheets.addApp({ category: name });
    };
    layer.querySelector(".stg-styles").addEventListener("click", (e) => {
      const b = e.target.closest("[data-style]");
      if (!b || b.dataset.style === current.style) return;
      current.style = b.dataset.style;
      H.store.commit((s) => (s.prefs.stages[name] = current.style), { undo: false, scope: "prefs" });
      mount();
    });
    mount();
  };
  function mount() {
    cleanup?.();
    cleanup = null;
    const body = layer.querySelector(".stg-body");
    body.innerHTML = "";
    body.className = `stg-body stg-${current.style}`;
    layer.classList.remove("launching");
    layer.querySelectorAll("[data-style]").forEach((b) => b.classList.toggle("on", b.dataset.style === current.style));
    layer.querySelector(".stg-hint").textContent = HINT[current.style] || "";
    const fn = MOUNT[current.style] || MOUNT.list;
    cleanup = fn(body, current.apps) || null;
  }
  function close(instant = false) {
    if (!layer) return;
    cleanup?.();
    cleanup = null;
    const l = layer;
    layer = null;
    document.body.classList.remove("stage-open");
    l.classList.remove("open");
    setTimeout(() => l.remove(), instant || reduced() ? 0 : 260);
  }
  stages.close = close;
  document.addEventListener("keydown", (e) => {
    if (layer && e.key === "Escape") {
      e.stopImmediatePropagation();
      close();
    }
  }, true);
  document.addEventListener("visibilitychange", () => document.hidden && layer?.classList.contains("launching") && close(true));

  /* tiny helper: watch size changes of a stage body (re-layout on rotation) */
  function onResize(el, fn) {
    let w = el.clientWidth, h = el.clientHeight;
    const ro = new ResizeObserver(
      H.debounce(() => {
        if (!layer || (el.clientWidth === w && el.clientHeight === h)) return; // the first report is the size we already drew
        w = el.clientWidth;
        h = el.clientHeight;
        fn();
      }, 120)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }
  /* tap vs drag on an element */
  function tappable(root, sel, fn) {
    let down = null;
    const d = (e) => {
      const t = e.target.closest(sel);
      if (t) down = { t, x: e.clientX, y: e.clientY, at: performance.now() };
    };
    const u = (e) => {
      if (!down) return;
      const t = e.target.closest(sel);
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (t === down.t && moved < 12) fn(t, e);
      down = null;
    };
    root.addEventListener("pointerdown", d);
    root.addEventListener("pointerup", u);
    return () => {
      root.removeEventListener("pointerdown", d);
      root.removeEventListener("pointerup", u);
    };
  }

  const MOUNT = {};

  /* ===== 조각: random straight cuts ===== */
  const area = (p) => Math.abs(p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
  function centroid(p) {
    let cx = 0, cy = 0, a = 0;
    p.forEach(([x, y], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      const f = x * y2 - x2 * y;
      a += f;
      cx += (x + x2) * f;
      cy += (y + y2) * f;
    });
    a *= 0.5;
    return Math.abs(a) < 1e-6 ? p[0] : [cx / (6 * a), cy / (6 * a)];
  }
  function split(poly, px, py, nx, ny) {
    const A = [], B = [];
    const side = ([x, y]) => (x - px) * nx + (y - py) * ny;
    poly.forEach((P, i) => {
      const Q = poly[(i + 1) % poly.length];
      const dp = side(P), dq = side(Q);
      if (dp >= 0) A.push(P);
      if (dp <= 0) B.push(P);
      if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
        const t = dp / (dp - dq);
        const I = [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
        A.push(I);
        B.push(I);
      }
    });
    return [A, B];
  }
  function inradius(poly, c) {
    let m = Infinity;
    poly.forEach((P, i) => {
      const Q = poly[(i + 1) % poly.length];
      const dx = Q[0] - P[0], dy = Q[1] - P[1];
      const len = Math.hypot(dx, dy) || 1;
      m = Math.min(m, Math.abs((c[0] - P[0]) * dy - (c[1] - P[1]) * dx) / len);
    });
    return m;
  }
  function shatter(W, H_, n, rnd) {
    let polys = [[[0, 0], [W, 0], [W, H_], [0, H_]]];
    let guard = 0;
    while (polys.length < n && guard++ < n * 30) {
      let bi = 0, ba = 0;
      polys.forEach((p, i) => { const a = area(p); if (a > ba) { ba = a; bi = i; } });
      const poly = polys[bi];
      const c = centroid(poly);
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
      // cut across the long side, at a random tilt, a little off-centre
      const ang = (bw > bh ? 0 : Math.PI / 2) + (rnd() - 0.5) * 1.2;
      const nx = Math.cos(ang), ny = Math.sin(ang);
      const off = (rnd() - 0.5) * 0.4 * Math.min(bw, bh);
      const [a, b] = split(poly, c[0] + nx * off, c[1] + ny * off, nx, ny);
      if (a.length < 3 || b.length < 3 || Math.min(area(a), area(b)) < ba * 0.22) continue;
      polys.splice(bi, 1, a, b);
    }
    return polys;
  }
  MOUNT.shards = (body, apps) => {
    let seed = (Math.random() * 1e9) | 0;
    const draw = () => {
      const W = body.clientWidth, Hh = body.clientHeight;
      if (!W || !Hh) return;
      const list = apps.slice(0, 36);
      const polys = shatter(W, Hh, list.length, rng(seed));
      const paths = polys.map((p, i) => `<path class="shard" data-i="${i}" style="--h:${hue(list[i])};--d:${(i * 0.035).toFixed(3)}s" d="M${p.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/>`).join("");
      const labels = polys
        .map((p, i) => {
          const c = centroid(p);
          const r = inradius(p, c);
          const sz = Math.max(30, Math.min(84, r * 0.9));
          return `<span class="shard-label" data-i="${i}" style="left:${c[0].toFixed(1)}px;top:${c[1].toFixed(1)}px;--d:${(0.25 + i * 0.035).toFixed(3)}s">${icon(list[i], sz)}<b style="max-width:${Math.max(60, r * 1.8).toFixed(0)}px">${esc(list[i].name)}</b></span>`;
        })
        .join("");
      body.innerHTML = `<svg class="shard-svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" aria-hidden="true">${paths}</svg>${labels}`;
      body.classList.remove("chosen");
      body._list = list;
    };
    draw();
    // the re-cut button lives under the stage, so it never covers a shard
    const hint = layer.querySelector(".stg-hint");
    hint.insertAdjacentHTML("beforeend", ` <button type="button" class="stg-hint-btn" data-recut>${H.svg("refresh")} 다시 자르기</button>`);
    hint.querySelector("[data-recut]").onclick = () => {
      seed = (Math.random() * 1e9) | 0;
      draw();
    };
    const offTap = tappable(body, ".shard, .shard-label", (t) => {
      const i = Number(t.dataset.i);
      body.querySelector(`.shard[data-i="${i}"]`)?.classList.add("picked");
      body.classList.add("chosen");
      launch(body._list[i], body.querySelector(`.shard-label[data-i="${i}"]`));
    });
    const hover = (e) => {
      const t = e.target.closest?.(".shard, .shard-label");
      body.querySelectorAll(".shard.hot").forEach((x) => x.classList.remove("hot"));
      if (t) body.querySelector(`.shard[data-i="${t.dataset.i}"]`)?.classList.add("hot");
    };
    body.addEventListener("pointerover", hover);
    body.addEventListener("pointerdown", hover);
    const offR = onResize(body, draw);
    return () => {
      offTap();
      offR();
    };
  };

  /* ===== 다이얼 ===== */
  MOUNT.dial = (body, apps) => {
    const list = apps.slice(0, 24);
    const n = list.length;
    const step = 360 / n;
    let rot = 0;
    let sel = 0;
    let shown = -1;
    let anim = null;
    body.innerHTML = `<div class="dial"><div class="dial-ring"></div><span class="dial-mark"></span><div class="dial-center"><div class="dial-sel"></div><button type="button" class="btn primary" data-open>${H.svg("arrowUR")} 열기</button></div></div>`;
    const dial = body.querySelector(".dial");
    const ring = body.querySelector(".dial-ring");
    const layout = () => {
      const D = Math.min(body.clientWidth, body.clientHeight) * 0.86;
      dial.style.setProperty("--D", D + "px");
      const sz = Math.max(40, Math.min(78, ((Math.PI * D) / n) * 0.55));
      ring.innerHTML =
        `<svg class="dial-ticks" viewBox="-50 -50 100 100" aria-hidden="true">${Array.from({ length: n * 4 }, (_, i) => `<line x1="0" y1="${i % 4 ? -47.5 : -49}" x2="0" y2="-45.5" transform="rotate(${(i * step) / 4})"/>`).join("")}</svg>` +
        list.map((a, i) => `<span class="dial-item" data-i="${i}" style="--a:${(i * step).toFixed(3)}deg">${icon(a, sz)}</span>`).join("");
      shown = -1;
      paint();
    };
    const paint = () => {
      ring.style.transform = `rotate(${rot.toFixed(2)}deg)`;
      ring.style.setProperty("--rot", rot.toFixed(2) + "deg");
      sel = ((Math.round(-rot / step) % n) + n) % n;
      if (sel === shown) return;
      if (shown >= 0) H.haptic(4); // a click for every detent
      shown = sel;
      ring.querySelectorAll(".dial-item").forEach((el, i) => el.classList.toggle("sel", i === sel));
      body.querySelector(".dial-sel").innerHTML = `${icon(list[sel], 96)}<b>${esc(list[sel].name)}</b><small>${esc(list[sel].category)}</small>`;
    };
    const springTo = (target, v = 0) => {
      anim?.stop();
      if (reduced()) {
        rot = target;
        return paint();
      }
      anim = H.fx.spring({ from: rot, to: target, v, k: 160, zeta: 0.72, restX: 0.05, restV: 1, onUpdate: (x) => { rot = x; paint(); }, onDone: () => (anim = null) });
    };
    let drag = null;
    const center = () => { const r = dial.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const angleOf = (e) => { const [cx, cy] = center(); return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI; };
    const down = (e) => {
      if (e.target.closest(".dial-center")) return;
      anim?.stop();
      drag = { a: angleOf(e), rot, t: performance.now(), v: 0, moved: 0, id: e.pointerId, target: e.target.closest(".dial-item") };
      try { body.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const move = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      let d = angleOf(e) - drag.a;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      const now = performance.now();
      const dt = Math.max(1, now - drag.t);
      drag.v = drag.v * 0.6 + ((d / dt) * 1000) * 0.4; // deg/s
      drag.a += d;
      drag.t = now;
      drag.moved += Math.abs(d);
      rot += d;
      paint();
    };
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const g = drag;
      drag = null;
      if (g.moved < 3 && g.target) {
        const i = Number(g.target.dataset.i);
        if (i === sel) return launch(list[i], g.target);
        // turn the tapped app to the top
        let target = -i * step;
        while (target - rot > 180) target -= 360;
        while (rot - target > 180) target += 360;
        return springTo(target);
      }
      const v = performance.now() - g.t > 80 ? 0 : g.v;
      const proj = rot + v * 0.28;
      springTo(Math.round(proj / step) * step, v);
    };
    body.addEventListener("pointerdown", down);
    body.addEventListener("pointermove", move);
    body.addEventListener("pointerup", up);
    body.addEventListener("pointercancel", up);
    body.querySelector("[data-open]").onclick = () => launch(list[sel], ring.querySelector(`.dial-item[data-i="${sel}"]`));
    const wheel = (e) => {
      e.preventDefault();
      springTo((Math.round(rot / step) + (e.deltaY > 0 ? -1 : 1)) * step);
    };
    body.addEventListener("wheel", wheel, { passive: false });
    const key = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") springTo((Math.round(rot / step) - 1) * step);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") springTo((Math.round(rot / step) + 1) * step);
      if (e.key === "Enter") launch(list[sel]);
    };
    document.addEventListener("keydown", key);
    layout();
    const offR = onResize(body, layout);
    return () => {
      anim?.stop();
      document.removeEventListener("keydown", key);
      offR();
    };
  };

  /* ===== 궤도 ===== */
  MOUNT.orbit = (body, apps) => {
    const list = apps.slice(0, 30);
    const layout = () => {
      const R = Math.min(body.clientWidth, body.clientHeight) / 2 - 62; // room for the outer icons and their names
      const sun = Math.min(120, R * 0.55);
      const rings = list.length <= 6 ? [list] : list.length <= 14 ? [list.slice(0, 5), list.slice(5)] : [list.slice(0, 5), list.slice(5, 13), list.slice(13)];
      const html = rings
        .map((ring, ri) => {
          const r = rings.length === 1 ? R * 0.7 : R * (0.5 + (0.5 * ri) / (rings.length - 1));
          const dur = 70 + ri * 35;
          const sz = Math.max(40, Math.min(70, ((2 * Math.PI * r) / Math.max(ring.length, 3)) * 0.42));
          return `<div class="orbit${ri % 2 ? " rev" : ""}" style="--r:${r.toFixed(1)}px;--dur:${dur}s">${ring
            .map((a, i) => `<span class="planet" data-id="${esc(a.id)}" style="--a:${((360 / ring.length) * i + ri * 17).toFixed(2)}deg;--sz:${Math.round(sz)}px"><span class="pl-in">${icon(a, sz)}<b>${esc(a.name)}</b></span></span>`)
            .join("")}</div>`;
        })
        .join("");
      body.innerHTML = `<div class="orbit-sys"><div class="orbit-sun" style="width:${sun.toFixed(0)}px;height:${sun.toFixed(0)}px"><b>${esc(current.name)}</b></div>${html}</div>`;
    };
    layout();
    const offTap = tappable(body, ".planet", (t) => {
      body.classList.add("chosen");
      launch(S().apps[t.dataset.id], t);
    });
    const offR = onResize(body, layout);
    return () => {
      offTap();
      offR();
    };
  };

  /* ===== 물감 (soft bodies that drift, collide and can be flicked) ===== */
  MOUNT.drops = (body, apps) => {
    const list = apps.slice(0, 26);
    const st = S().stats;
    const maxUse = Math.max(1, ...list.map((a) => st[a.id]?.[0] || 0));
    let W = body.clientWidth, Hh = body.clientHeight;
    const rnd = rng(hash(current.name));
    const scale = Math.min(1, Math.sqrt((W * Hh) / (list.length * 26000)));
    const bodies = list.map((a, i) => {
      const r = (38 + 30 * Math.sqrt((st[a.id]?.[0] || 0) / maxUse)) * scale + 6;
      return { a, r, x: r + rnd() * Math.max(1, W - 2 * r), y: r + rnd() * Math.max(1, Hh - 2 * r), vx: (rnd() - 0.5) * 40, vy: (rnd() - 0.5) * 40, ph: rnd() * 6.28 };
    });
    body.innerHTML = bodies
      .map((b, i) => `<span class="drop" data-i="${i}" style="--r:${b.r.toFixed(1)}px;--h:${hue(b.a)}">${H.home.iconHTML(b.a)}<b>${esc(b.a.name)}</b></span>`)
      .join("");
    const els = [...body.querySelectorAll(".drop")];
    let held = null;
    let raf = 0;
    let last = 0;
    let calm = 0; // frames in a row where nothing moved (then the loop sleeps)
    const kick = () => {
      if (!raf) {
        last = 0;
        calm = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const step = (now) => {
      raf = 0;
      if (!layer || document.hidden) return;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      const t = now / 1000;
      const wander = H.power.animate(); // battery saver / motion off: drops only move when pushed
      let speed = 0;
      bodies.forEach((b, i) => {
        if (held && held.i === i) return;
        // a slow wander + drag
        if (wander) {
          b.vx += Math.sin(t * 0.35 + b.ph) * 6 * dt;
          b.vy += Math.cos(t * 0.29 + b.ph * 1.3) * 6 * dt;
        }
        b.vx *= 1 - 0.6 * dt;
        b.vy *= 1 - 0.6 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.7; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.7; }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.7; }
        if (b.y > Hh - b.r) { b.y = Hh - b.r; b.vy = -Math.abs(b.vy) * 0.7; }
        speed = Math.max(speed, Math.abs(b.vx) + Math.abs(b.vy));
      });
      // soft collisions
      for (let i = 0; i < bodies.length; i++)
        for (let j = i + 1; j < bodies.length; j++) {
          const A = bodies[i], B = bodies[j];
          const dx = B.x - A.x, dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const o = A.r + B.r + 6 - d;
          if (o > 0) {
            const nx = dx / d, ny = dy / d;
            const ha = held && held.i === i, hb = held && held.i === j;
            const ka = ha ? 0 : hb ? 1 : 0.5, kb = hb ? 0 : ha ? 1 : 0.5;
            A.x -= nx * o * ka; A.y -= ny * o * ka;
            B.x += nx * o * kb; B.y += ny * o * kb;
            const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rv < 0) {
              const imp = -rv * 0.8;
              A.vx -= nx * imp * ka; A.vy -= ny * imp * ka;
              B.vx += nx * imp * kb; B.vy += ny * imp * kb;
            }
          }
        }
      bodies.forEach((b, i) => (els[i].style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px,${(b.y - b.r).toFixed(1)}px,0)`));
      calm = speed < 4 ? calm + 1 : 0;
      if (held || wander || calm < 20) raf = requestAnimationFrame(step);
    };
    kick();
    const down = (e) => {
      const el = e.target.closest(".drop");
      if (!el) return;
      const i = Number(el.dataset.i);
      const r = body.getBoundingClientRect();
      held = { i, id: e.pointerId, ox: e.clientX - r.left - bodies[i].x, oy: e.clientY - r.top - bodies[i].y, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY };
      el.classList.add("held");
      try { body.setPointerCapture(e.pointerId); } catch (err) {}
      kick();
    };
    const move = (e) => {
      if (!held || e.pointerId !== held.id) return;
      const r = body.getBoundingClientRect();
      const b = bodies[held.i];
      const now = performance.now();
      const dt = Math.max(1, now - held.t) / 1000;
      held.vx = held.vx * 0.5 + ((e.clientX - held.lx) / dt) * 0.5;
      held.vy = held.vy * 0.5 + ((e.clientY - held.ly) / dt) * 0.5;
      held.lx = e.clientX;
      held.ly = e.clientY;
      held.t = now;
      held.moved = Math.max(held.moved, Math.hypot(e.clientX - held.x0, e.clientY - held.y0));
      b.x = e.clientX - r.left - held.ox;
      b.y = e.clientY - r.top - held.oy;
    };
    const up = (e) => {
      if (!held || e.pointerId !== held.id) return;
      const h = held;
      held = null;
      const el = els[h.i];
      el.classList.remove("held");
      if (h.moved < 10) return launch(bodies[h.i].a, el);
      bodies[h.i].vx = Math.max(-1600, Math.min(1600, h.vx));
      bodies[h.i].vy = Math.max(-1600, Math.min(1600, h.vy));
      kick();
    };
    body.addEventListener("pointerdown", down);
    body.addEventListener("pointermove", move);
    body.addEventListener("pointerup", up);
    body.addEventListener("pointercancel", up);
    const offR = onResize(body, () => {
      W = body.clientWidth;
      Hh = body.clientHeight;
      kick();
    });
    const wake = () => kick();
    document.addEventListener("visibilitychange", wake);
    return () => {
      cancelAnimationFrame(raf);
      raf = -1; // never restart
      document.removeEventListener("visibilitychange", wake);
      offR();
    };
  };

  /* ===== 카드 ===== */
  MOUNT.cards = (body, apps) => {
    const list = apps.slice(0, 60);
    let idx = 0;
    body.innerHTML = `<div class="deck"></div><div class="deck-nav"><button type="button" class="icon-btn" data-prev aria-label="이전">${H.svg("chevronL")}</button><span class="deck-count"></span><button type="button" class="icon-btn" data-next aria-label="다음">${H.svg("chevronR")}</button></div>`;
    const deck = body.querySelector(".deck");
    const cardHTML = (a, depth) => `<article class="card-app" data-depth="${depth}" data-id="${esc(a.id)}" style="--h:${hue(a)}">
      <div class="card-top">${icon(a, 112)}</div><h2>${esc(a.name)}</h2><p>${esc(a.category)} · ${esc(H.home.locationLabel(a.id))}</p>
      <span class="card-open">${H.svg("arrowUR")} 눌러서 열기</span></article>`;
    const render = () => {
      deck.innerHTML = [2, 1, 0].filter((d) => d < list.length).map((d) => cardHTML(list[(idx + d) % list.length], d)).join("");
      body.querySelector(".deck-count").textContent = `${idx + 1} / ${list.length}`;
    };
    const go = (dir) => {
      const top = deck.querySelector('.card-app[data-depth="0"]');
      if (!top || list.length < 2) return;
      const fly = () => {
        idx = (idx + (dir > 0 ? 1 : list.length - 1)) % list.length;
        render();
      };
      if (reduced()) return fly();
      const a = top.animate([{ transform: top.style.transform || "none", opacity: 1 }, { transform: `translate3d(${dir > 0 ? -130 : 130}%,0,0) rotate(${dir > 0 ? -14 : 14}deg)`, opacity: 0 }], { duration: 260, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
      a.onfinish = fly;
    };
    let g = null;
    const down = (e) => {
      const c = e.target.closest('.card-app[data-depth="0"]');
      if (!c) return;
      g = { c, id: e.pointerId, x0: e.clientX, y0: e.clientY, t: performance.now(), dx: 0 };
      try { deck.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const move = (e) => {
      if (!g || e.pointerId !== g.id) return;
      g.dx = e.clientX - g.x0;
      g.c.style.transform = `translate3d(${g.dx}px,${(e.clientY - g.y0) * 0.2}px,0) rotate(${g.dx * 0.05}deg)`;
    };
    const up = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const s = g;
      g = null;
      const v = s.dx / Math.max(1, performance.now() - s.t);
      if (Math.abs(s.dx) < 8) {
        s.c.style.transform = "";
        return launch(S().apps[s.c.dataset.id], s.c);
      }
      if (Math.abs(s.dx) > 110 || Math.abs(v) > 0.6) return go(s.dx < 0 ? 1 : -1);
      s.c.animate([{ transform: s.c.style.transform }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" });
      s.c.style.transform = "";
    };
    deck.addEventListener("pointerdown", down);
    deck.addEventListener("pointermove", move);
    deck.addEventListener("pointerup", up);
    deck.addEventListener("pointercancel", up);
    body.querySelector("[data-prev]").onclick = () => go(-1);
    body.querySelector("[data-next]").onclick = () => go(1);
    const key = (e) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Enter") launch(list[idx]);
    };
    document.addEventListener("keydown", key);
    render();
    return () => document.removeEventListener("keydown", key);
  };

  /* ===== 키보드 ===== */
  MOUNT.keys = (body, apps) => {
    const list = apps.slice(0, 40);
    let hot = -1;
    const W = body.clientWidth;
    const cols = Math.max(3, Math.min(8, Math.round(W / 150)));
    body.innerHTML = `<div class="keyboard" style="--cols:${cols}">${list
      .map((a, i) => `<button type="button" class="keycap" data-i="${i}" style="--h:${hue(a)}"><span class="kc-top">${icon(a, 40)}<b>${esc(a.name)}</b><kbd>${esc(H.chosung(a.name[0] || "").toUpperCase())}</kbd></span></button>`)
      .join("")}<button type="button" class="keycap space" data-close><span class="kc-top"><b>${esc(current.name)}</b><small>닫기</small></span></button></div>`;
    const kb = body.querySelector(".keyboard");
    const offTap = tappable(kb, ".keycap", (t) => {
      if (t.hasAttribute("data-close")) return close();
      launch(list[Number(t.dataset.i)], t);
    });
    const key = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && hot >= 0) return launch(list[hot], kb.querySelector(`.keycap[data-i="${hot}"]`));
      if (e.key.length !== 1) return;
      const k = H.norm(e.key);
      const matches = list.map((a, i) => [a, i]).filter(([a]) => H.norm(a.name).startsWith(k) || H.chosung(a.name[0] || "") === e.key || (a.aliases || []).some((x) => H.norm(x).startsWith(k)));
      if (!matches.length) return;
      const pos = matches.findIndex(([, i]) => i === hot);
      hot = matches[(pos + 1) % matches.length][1];
      kb.querySelectorAll(".keycap.hot").forEach((x) => x.classList.remove("hot"));
      kb.querySelector(`.keycap[data-i="${hot}"]`)?.classList.add("hot");
    };
    document.addEventListener("keydown", key);
    return () => {
      offTap();
      document.removeEventListener("keydown", key);
    };
  };

  /* ===== 스위치 ===== */
  MOUNT.switches = (body, apps) => {
    body.innerHTML = `<div class="board">${apps
      .slice(0, 40)
      .map((a) => `<button type="button" class="sw-panel" data-id="${esc(a.id)}" style="--h:${hue(a)}"><i class="led"></i>${icon(a, 42)}<b>${esc(a.name)}</b><span class="toggle"><i></i></span><span class="screws"></span></button>`)
      .join("")}</div>`;
    const offTap = tappable(body, ".sw-panel", (t) => {
      t.classList.add("on");
      launch(S().apps[t.dataset.id], t);
    });
    return offTap;
  };

  /* ===== 지도 ===== */
  MOUNT.map = (body, apps) => {
    const list = apps.slice(0, 30);
    const draw = () => {
      const W = body.clientWidth, Hh = body.clientHeight;
      if (!W || !Hh) return;
      const rnd = rng(hash(current.name + list.length));
      // contour lines around a few hills
      const hills = Array.from({ length: 4 }, () => [rnd() * W, rnd() * Hh, 0.35 + rnd() * 0.5]);
      let contours = "";
      hills.forEach(([hx, hy, k]) => {
        const ph = rnd() * 6.28;
        for (let l = 1; l <= 7; l++) {
          const R = l * Math.min(W, Hh) * 0.055 * k * 1.6;
          let d = "";
          for (let s = 0; s <= 48; s++) {
            const a = (s / 48) * Math.PI * 2;
            const rr = R * (1 + 0.16 * Math.sin(a * 3 + ph + l * 0.4) + 0.08 * Math.sin(a * 5 - ph));
            d += `${s ? "L" : "M"}${(hx + Math.cos(a) * rr).toFixed(1)} ${(hy + Math.sin(a) * rr * 0.8).toFixed(1)}`;
          }
          contours += `<path d="${d}Z" style="opacity:${(0.5 - l * 0.045).toFixed(2)}"/>`;
        }
      });
      const roads = Array.from({ length: 3 }, () => `<path class="road" d="M${(rnd() * W).toFixed(0)} 0 C ${(rnd() * W).toFixed(0)} ${(Hh * 0.33).toFixed(0)}, ${(rnd() * W).toFixed(0)} ${(Hh * 0.66).toFixed(0)}, ${(rnd() * W).toFixed(0)} ${Hh}"/>`).join("");
      // pins (spread out by rejection sampling)
      const pts = [];
      const minD = Math.sqrt((W * Hh) / Math.max(1, list.length)) * 0.62;
      list.forEach(() => {
        let best = null, bestD = -1;
        for (let t = 0; t < 40; t++) {
          const p = [60 + rnd() * (W - 120), 80 + rnd() * (Hh - 150)];
          const d = Math.min(...pts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])), Infinity);
          if (d > minD) { best = p; break; }
          if (d > bestD) { bestD = d; best = p; }
        }
        pts.push(best);
      });
      body.innerHTML = `<svg class="map-svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" aria-hidden="true"><g class="contours">${contours}</g>${roads}</svg>` +
        list.map((a, i) => `<button type="button" class="pin" data-i="${i}" style="left:${pts[i][0].toFixed(0)}px;top:${pts[i][1].toFixed(0)}px;--h:${hue(a)};--d:${(i * 0.04).toFixed(2)}s"><span class="pin-head">${icon(a, 34)}</span><b>${esc(a.name)}</b></button>`).join("");
      body._list = list;
    };
    draw();
    const offTap = tappable(body, ".pin", (t) => {
      body.classList.add("chosen");
      launch(body._list[Number(t.dataset.i)], t);
    });
    const offR = onResize(body, draw);
    return () => {
      offTap();
      offR();
    };
  };

  /* ===== 목록 ===== */
  MOUNT.list = (body, apps) => {
    body.innerHTML = `<div class="stg-list-grid">${apps.map((a) => `<button type="button" class="stg-row" data-id="${esc(a.id)}">${icon(a, 52)}<b>${esc(a.name)}</b></button>`).join("")}</div>`;
    return tappable(body, ".stg-row", (t) => launch(S().apps[t.dataset.id], t));
  };

  stages.STYLES = STYLES;
  H.stages = stages;
})();
