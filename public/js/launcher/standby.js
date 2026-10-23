/* Ὁρμή launcher — Standby (desk clock): big clock + today's essentials, keeps the screen awake. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  let el = null;
  let timer = 0;
  let lock = null;
  let lastTap = 0;
  let lastDrift = -1;
  /* Every second only while a timer is running (its countdown is shown); otherwise on the minute. */
  function schedule() {
    clearTimeout(timer);
    timer = 0;
    if (!el || document.hidden) return;
    const now = Date.now();
    const perSecond = Object.values(S().widgets).some((w) => w.type === "timer" && w.run === "run");
    const wait = perSecond ? 1000 - (now % 1000) : 60000 - (now % 60000);
    timer = setTimeout(() => {
      tick();
      schedule();
    }, wait + 15);
  }

  async function wake() {
    try {
      if ("wakeLock" in navigator && !document.hidden) lock = await navigator.wakeLock.request("screen");
    } catch (e) {
      lock = null;
    }
  }
  function onVis() {
    if (el && !document.hidden) {
      wake();
      tick();
    }
    schedule();
  }

  function infoChips(now) {
    const chips = [];
    const ws = Object.values(S().widgets);
    const timerW = ws.find((w) => w.type === "timer" && w.run === "run");
    if (timerW) {
      const ms = H.timerRemain(timerW, now.getTime());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      chips.push(`${H.svg("timer")}<span>${timerW.mode === "pomodoro" ? (timerW.phase === "break" ? "휴식" : "집중") : "타이머"} ${H.pad(m)}:${H.pad(s)}</span>`);
    }
    const tt = ws.find((w) => w.type === "timetable");
    if (tt) {
      const dow = now.getDay() - 1;
      const mins = now.getHours() * 60 + now.getMinutes();
      if (dow >= 0 && dow < tt.days) {
        let cur = -1;
        let next = -1;
        tt.times.slice(0, tt.periods).forEach((t, i) => {
          const [hh, mm] = t.split(":").map(Number);
          const st = hh * 60 + mm;
          if (mins >= st && mins < st + tt.duration) cur = i;
          if (next < 0 && st > mins) next = i;
        });
        if (cur >= 0 && tt.grid[dow][cur]) chips.push(`${H.svg("table")}<span>${cur + 1}교시 ${H.esc(tt.grid[dow][cur])}</span>`);
        else if (next >= 0 && tt.grid[dow][next]) chips.push(`${H.svg("table")}<span>다음 ${next + 1}교시 ${H.esc(tt.grid[dow][next])} · ${tt.times[next]}</span>`);
      }
    }
    const evs = [];
    ws.filter((w) => w.type === "dday").forEach((w) => w.events.forEach((e) => evs.push({ ...e, n: H.daysUntil(e.date, now) })));
    const up = evs.filter((e) => e.n >= 0).sort((a, b) => a.n - b.n)[0];
    if (up) chips.push(`${H.svg("flag")}<span>${H.esc(up.title || "D-day")} ${H.ddayLabel(up.n)}</span>`);
    const focus = ws.find((w) => w.type === "focus");
    if (focus) chips.push(`${H.svg("target")}<span>${H.esc(focus.title)} · ${focus.done}/${focus.total}</span>`);
    return chips.slice(0, 3).map((c) => `<span class="sb-chip">${c}</span>`).join("");
  }

  function tick() {
    if (!el) return;
    const now = new Date();
    const t = H.fmtTime(now, { hour12: S().prefs.hour12 });
    const [hh, mm] = t.text.split(":");
    el.querySelector(".sb-time").innerHTML = `${t.ap ? `<small>${t.ap}</small>` : ""}<span>${hh}</span><span class="colon">:</span><span>${mm}</span>`;
    el.querySelector(".sb-date").textContent = `${now.getFullYear()}년 ${H.fmtDate(now)}`;
    el.querySelector(".sb-info").innerHTML = infoChips(now);
    // gentle drift against burn-in (once a minute)
    if (now.getMinutes() !== lastDrift) {
      lastDrift = now.getMinutes();
      const dx = (Math.random() - 0.5) * 24;
      const dy = (Math.random() - 0.5) * 16;
      el.querySelector(".sb-inner").style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  function open() {
    if (el) return;
    el = H.h(`<div class="standby" role="dialog" aria-label="스탠바이 시계"><div class="sb-inner"><div class="sb-time"></div><div class="sb-date"></div><div class="sb-info"></div></div>
      <button type="button" class="icon-btn sb-close" aria-label="닫기">${H.svg("close")}</button><p class="sb-hint">두 번 탭하거나 Esc로 닫아요 · 화면이 꺼지지 않게 유지해요</p></div>`);
    document.body.append(el);
    requestAnimationFrame(() => el?.classList.add("open"));
    lastDrift = new Date().getMinutes();
    tick();
    schedule();
    H.power?.cover(true);
    wake();
    document.addEventListener("visibilitychange", onVis);
    el.querySelector(".sb-close").onclick = close;
    el.addEventListener("click", (e) => {
      if (e.target.closest(".sb-close")) return;
      const now = Date.now();
      if (now - lastTap < 380) close();
      lastTap = now;
    });
  }
  function close() {
    if (!el) return;
    clearTimeout(timer);
    timer = 0;
    H.power?.cover(false);
    document.removeEventListener("visibilitychange", onVis);
    try {
      lock?.release();
    } catch (e) {}
    lock = null;
    const x = el;
    el = null;
    x.classList.remove("open");
    setTimeout(() => x.remove(), 250);
  }
  document.addEventListener("keydown", (e) => {
    if (el && e.key === "Escape") {
      e.stopImmediatePropagation();
      close();
    }
  }, true);

  H.standby = { open, close, isOpen: () => !!el };
})();
