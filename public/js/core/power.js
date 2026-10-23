/* Ὁρμή — power manager. Decides how much the launcher may animate, so it costs as little battery as possible.
   Levels
     saver  : nothing moves, no glass blur, no seconds, photos don't rotate
     normal : slow ambient background at 12 frames/s, low-resolution canvas, static colour haze
     smooth : 30 frames/s, sharper canvas, drifting haze, blinking colons
   "auto" picks saver on low battery / OS low-power mode / data saver, smooth while charging, normal otherwise.
   Nothing here polls; it only reacts to events (battery, visibility, an occasional touch). */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store?.state;
  const LEVEL = {
    saver: { fps: 0, dpr: 1, haze: false, blink: false },
    normal: { fps: 12, dpr: 1, haze: false, blink: false },
    smooth: { fps: 30, dpr: 1.5, haze: true, blink: true },
  };
  const NAME = { saver: "절전", normal: "기본", smooth: "부드럽게" };
  const sig = { battery: null, lowPower: false, saveData: !!navigator.connection?.saveData };
  const power = { mode: "normal", reason: "", covered: false, LEVEL, NAME };
  let lastProbe = 0;
  let probing = false;
  let lastOled = null;
  const mqTransparency = window.matchMedia?.("(prefers-reduced-transparency: reduce)");

  function decide() {
    const pref = S()?.prefs.power || "auto";
    if (pref !== "auto") return [pref, ""];
    const b = sig.battery;
    if (b && !b.charging && b.level <= 0.2) return ["saver", `배터리 ${Math.round(b.level * 100)}%`];
    if (sig.lowPower) return ["saver", "기기 저전력 모드가 켜진 것 같아요"];
    if (sig.saveData) return ["saver", "데이터 절약 모드"];
    if (b && b.charging) return ["smooth", "충전 중"];
    return ["normal", ""];
  }

  function apply() {
    const [mode, reason] = decide();
    const oled = !!S()?.prefs.oled;
    const changed = mode !== power.mode || oled !== lastOled;
    power.mode = mode;
    power.reason = reason;
    lastOled = oled;
    const b = document.body;
    if (b) b.dataset.power = mode;
    power.glass();
    if (changed) H.emit("power", { mode });
    H.emit("power-status");
  }

  /* Standby clock (opaque, full screen) covers the background: nothing behind it needs to move. */
  power.cover = (v) => {
    power.covered = !!v;
    H.emit("motion-state");
  };

  /* ---------- OS low-power heuristic ----------
     iOS Low Power Mode caps requestAnimationFrame at 30 fps (WebKit bug 215745); some browser
     battery savers throttle frames the same way. Safari exposes no battery API, so a short sample
     of frame times (about half a second) is the only hint we get. */
  function probe() {
    if (H.isPreview || document.hidden || probing) return;
    probing = true;
    lastProbe = Date.now();
    const ts = [];
    const step = (t) => {
      if (document.hidden) return void (probing = false);
      ts.push(t);
      if (ts.length < 28) return void requestAnimationFrame(step);
      probing = false;
      const d = [];
      for (let i = 6; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
      d.sort((a, b) => a - b);
      const p25 = d[Math.floor(d.length * 0.25)];
      const low = p25 > 26 && p25 < 60;
      if (low !== sig.lowPower) {
        sig.lowPower = low;
        apply();
      }
    };
    requestAnimationFrame(step);
  }
  function probeSoon(ms) {
    if (Date.now() - lastProbe < 20000) return;
    setTimeout(probe, ms);
  }

  /* Glass blur (backdrop-filter) is re-rendered every time anything behind it changes, so a moving
     background makes every widget, the dock and the top buttons re-blur on each frame.
     - glass-lite: over the ambient background the blur is dropped and the canvas leaves the area behind
       glass empty. The haze behind is a smooth gradient, so it looks the same — without the cost.
     - noblur: power saver over a photo/video (or the OS "reduce transparency" setting) uses solid panels. */
  power.glass = () => {
    const b = document.body;
    if (!b) return;
    const ambient = (b.dataset.bg || "ambient") === "ambient";
    const noblur = !!mqTransparency?.matches || (power.mode === "saver" && !ambient);
    b.classList.toggle("noblur", noblur);
    b.classList.toggle("glass-lite", !noblur && ambient && power.mode !== "smooth");
  };
  power.glassLite = () => !!document.body?.classList.contains("glass-lite");

  /* ---------- public helpers ---------- */
  power.level = () => LEVEL[power.mode];
  power.saver = () => power.mode === "saver";
  /* Decorative motion right now? (background canvas, video, CSS loops) */
  power.motion = () => !!S()?.motion.on && power.mode !== "saver" && !power.covered && !document.hidden;
  power.animate = () => power.motion() && !H.reducedMotion();
  power.status = () => {
    const pref = S()?.prefs.power || "auto";
    const what = {
      saver: "배경과 효과를 멈추고 흐림 효과를 꺼요. 초 단위 표시와 사진 자동 넘김도 쉬어요.",
      normal: "배경을 1초에 12장, 낮은 해상도로 천천히 그려요.",
      smooth: "배경을 1초에 30장, 선명하게 그려요. 전기를 가장 많이 써요.",
    }[power.mode];
    const head = pref === "auto" ? `자동 → ${NAME[power.mode]}${power.reason ? ` (${power.reason})` : ""}` : NAME[power.mode];
    return { head, body: what };
  };

  power.init = () => {
    apply();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) probeSoon(800);
      H.emit("motion-state");
    });
    // Low Power Mode can be switched from Control Center while Ὁρμή stays on screen:
    // re-check now and then on a touch (at most every 20 s, about half a second of frames)
    document.addEventListener("pointerdown", () => probeSoon(300), { passive: true, capture: true });
    H.listen("change", () => {
      const pref = S().prefs;
      if (pref.power !== power._pref || pref.oled !== power._oled) {
        power._pref = pref.power;
        power._oled = pref.oled;
        apply();
      }
    });
    power._pref = S().prefs.power;
    power._oled = S().prefs.oled;
    navigator
      .getBattery?.()
      .then((b) => {
        const upd = () => {
          sig.battery = { level: b.level, charging: b.charging };
          apply();
        };
        b.addEventListener("levelchange", upd);
        b.addEventListener("chargingchange", upd);
        upd();
      })
      .catch(() => {});
    mqTransparency?.addEventListener?.("change", apply);
    navigator.connection?.addEventListener?.("change", () => {
      sig.saveData = !!navigator.connection.saveData;
      apply();
    });
    setTimeout(probe, 1500);
  };

  H.power = power;
})();
