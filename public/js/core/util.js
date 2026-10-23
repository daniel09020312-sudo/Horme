/* Ὁρμή — shared helpers. Every script attaches to the single `window.H` namespace. */
(() => {
  "use strict";
  const H = (window.H = window.H || {});

  H.VERSION = "2.1.0";
  H.BUILD = "2026-10-24";

  H.$ = (sel, root = document) => root.querySelector(sel);
  H.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  H.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

  H.uid = (prefix = "") =>
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  H.clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  H.num = (v, fallback, min = -Infinity, max = Infinity) => {
    const n = Number(v);
    return Number.isFinite(n) ? H.clamp(n, min, max) : fallback;
  };
  H.str = (v, max = 200, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
  H.oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

  H.debounce = (fn, ms) => {
    let t = 0;
    const d = (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
    d.flush = (...a) => {
      clearTimeout(t);
      fn(...a);
    };
    d.cancel = () => clearTimeout(t);
    return d;
  };

  H.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  H.nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /* Create a DOM node from an HTML string. */
  H.h = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  /* Delegated event listener. */
  H.on = (root, type, selector, handler, opts) =>
    root.addEventListener(
      type,
      (e) => {
        const target = e.target.closest?.(selector);
        if (target && root.contains(target)) handler(e, target);
      },
      opts,
    );

  H.bytes = (n) => {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / 1024 ** i).toFixed(i ? 1 : 0) + " " + u[i];
  };

  /* ---------- Platform ---------- */
  const ua = navigator.userAgent || "";
  H.isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  H.isAndroid = /Android/i.test(ua);
  H.isMobileOS = H.isIOS || H.isAndroid;
  H.isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  H.reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  H.isPortrait = () => window.innerHeight > window.innerWidth;
  H.params = new URLSearchParams(location.search);
  H.isPreview = H.params.get("preview") === "1";

  /* ---------- Dates ---------- */
  H.pad = (n) => String(n).padStart(2, "0");
  H.dateKey = (d = new Date()) => `${d.getFullYear()}-${H.pad(d.getMonth() + 1)}-${H.pad(d.getDate())}`;
  H.parseDateKey = (k) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  /* Whole days from today (local midnight) to the given YYYY-MM-DD. */
  H.daysUntil = (key, now = new Date()) => {
    const d = H.parseDateKey(key);
    if (!d) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d - today) / 86400000);
  };
  H.ddayLabel = (n) => (n === null ? "날짜 선택" : n === 0 ? "D-DAY" : n > 0 ? `D-${n}` : `D+${-n}`);
  H.WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  H.fmtTime = (d, { hour12 = false, seconds = false } = {}) => {
    let h = d.getHours();
    const m = H.pad(d.getMinutes());
    const s = seconds ? ":" + H.pad(d.getSeconds()) : "";
    if (!hour12) return { ap: "", text: `${H.pad(h)}:${m}${s}` };
    const ap = h < 12 ? "오전" : "오후";
    h = h % 12 || 12;
    return { ap, text: `${h}:${m}${s}` };
  };
  H.fmtDate = (d, style = "long") => {
    const w = H.WEEKDAYS[d.getDay()];
    if (style === "short") return `${d.getMonth() + 1}.${d.getDate()} (${w})`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${w}요일`;
  };

  /* ---------- Hangul-aware search ---------- */
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  H.chosung = (s) =>
    Array.from(String(s || ""))
      .map((ch) => {
        const c = ch.charCodeAt(0) - 0xac00;
        return c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : ch;
      })
      .join("");
  const isChoOnly = (q) => /^[ㄱ-ㅎ]+$/.test(q);
  H.norm = (s) => String(s || "").normalize("NFC").toLowerCase().replace(/[\s·._-]+/g, "");
  /* Higher is better, 0 = no match. */
  H.matchScore = (query, fields) => {
    const q = H.norm(query);
    if (!q) return 0;
    let best = 0;
    fields.forEach((f, i) => {
      const weight = i === 0 ? 1 : 0.8;
      const v = H.norm(f);
      if (!v) return;
      let s = 0;
      if (v === q) s = 100;
      else if (v.startsWith(q)) s = 80;
      else if (v.includes(q)) s = 55;
      else if (isChoOnly(q)) {
        const c = H.chosung(v);
        if (c.startsWith(q)) s = 70;
        else if (c.includes(q)) s = 45;
      } else {
        // allow typing in progress: "유튭" style partial — match by chosung of query as well
        const cq = H.chosung(q);
        const cv = H.chosung(v);
        if (cq.length > 1 && cv.startsWith(cq) && /[가-힣]/.test(q)) s = 30;
      }
      best = Math.max(best, s * weight);
    });
    return best;
  };

  /* ---------- Tiny arithmetic evaluator for the search bar (no eval) ---------- */
  H.calc = (input) => {
    const src = String(input || "")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/,/g, "")
      .trim();
    if (!/^[\d\s+\-*/().%^]+$/.test(src) || !/\d/.test(src) || !/[+\-*/%^]/.test(src.replace(/^-/, "")))
      return null;
    let i = 0;
    const peek = () => src[i];
    const skip = () => {
      while (src[i] === " ") i++;
    };
    const number = () => {
      skip();
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw Error("num");
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const factor = () => {
      skip();
      if (peek() === "-") {
        i++;
        return -factor();
      }
      if (peek() === "+") {
        i++;
        return factor();
      }
      let v;
      if (peek() === "(") {
        i++;
        v = expr();
        skip();
        if (peek() !== ")") throw Error(")");
        i++;
      } else v = number();
      skip();
      if (peek() === "%") {
        i++;
        v = v / 100;
      }
      skip();
      if (peek() === "^") {
        i++;
        v = Math.pow(v, factor());
      }
      return v;
    };
    const term = () => {
      let v = factor();
      for (;;) {
        skip();
        const c = peek();
        if (c === "*" || c === "/") {
          i++;
          const r = factor();
          v = c === "*" ? v * r : v / r;
        } else return v;
      }
    };
    const expr = () => {
      let v = term();
      for (;;) {
        skip();
        const c = peek();
        if (c === "+" || c === "-") {
          i++;
          const r = term();
          v = c === "+" ? v + r : v - r;
        } else return v;
      }
    };
    try {
      const v = expr();
      skip();
      if (i !== src.length || !Number.isFinite(v)) return null;
      return Math.round(v * 1e10) / 1e10;
    } catch (e) {
      return null;
    }
  };

  /* ---------- Event bus ---------- */
  const bus = new EventTarget();
  H.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
  H.listen = (type, fn) => {
    const h = (e) => fn(e.detail);
    bus.addEventListener(type, h);
    return () => bus.removeEventListener(type, h);
  };

  /* Haptic tick where supported (Android). iOS ignores silently. */
  H.haptic = (ms = 8) => {
    try {
      navigator.vibrate?.(ms);
    } catch (e) {}
  };

  /* Short chime through WebAudio (used by the timer widget). */
  let audioCtx = null;
  H.chime = () => {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [880, 1318.5, 1760].forEach((f, k) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + k * 0.18);
        g.gain.exponentialRampToValueAtTime(0.18, now + k * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + k * 0.18 + 0.6);
        o.connect(g).connect(audioCtx.destination);
        o.start(now + k * 0.18);
        o.stop(now + k * 0.18 + 0.65);
      });
    } catch (e) {}
  };
  /* Unlock audio on first gesture so the timer can ring later (iOS requirement). */
  window.addEventListener(
    "pointerdown",
    () => {
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
      } catch (e) {}
    },
    { once: true, capture: true },
  );
})();

/* URL safety shared by every module. web=true → only http(s). */
(() => {
  "use strict";
  const H = window.H;
  const BAD = ["javascript:", "data:", "vbscript:", "file:", "blob:", "about:", "chrome:", "view-source:"];
  H.safeURL = (url, { web = false } = {}) => {
    if (typeof url !== "string" || !url.trim() || url.length > 1024) return false;
    try {
      const u = new URL(url.trim());
      const p = u.protocol.toLowerCase();
      if (BAD.includes(p) || !/^[a-z][a-z0-9+.-]*:$/.test(p)) return false;
      if (web) return p === "https:" || p === "http:";
      return true;
    } catch (e) {
      return false;
    }
  };
  H.isWebURL = (url) => H.safeURL(url, { web: true });
})();
