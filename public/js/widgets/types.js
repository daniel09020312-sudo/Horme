/* Ὁρμή — widget type definitions (data + rendering; no DOM side effects here).
   Sizes on the home grid: s = 2×2 cells, m = 4×2, l = 4×4. */
(() => {
  "use strict";
  const H = window.H;
  const esc = (s) => H.esc(s);
  const svg = (n, c) => H.svg(n, c);
  const head = (title, glyph, extra = "") =>
    `<div class="wg-head"><span class="wg-kicker">${esc(title)}</span>${extra}${glyph ? svg(glyph, "wg-glyph") : ""}</div>`;
  const list = (v) => (Array.isArray(v) ? v : []);
  const id = () => H.uid("i");

  const TIMEZONES = [
    ["local", "이 기기 시간"], ["Asia/Seoul", "서울"], ["Asia/Tokyo", "도쿄"], ["Asia/Shanghai", "베이징"],
    ["Asia/Singapore", "싱가포르"], ["Europe/London", "런던"], ["Europe/Paris", "파리"], ["America/New_York", "뉴욕"],
    ["America/Los_Angeles", "로스앤젤레스"], ["Australia/Sydney", "시드니"],
  ];
  const tzParts = (now, tz) => {
    if (!tz || tz === "local") return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(), d: now };
    try {
      const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
      const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
      const d = new Date(+p.year, +p.month - 1, +p.day);
      return { h: +p.hour % 24, m: +p.minute, s: +p.second, d };
    } catch (e) {
      return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(), d: now };
    }
  };
  const timeText = (h, m, prefs, s) => {
    const d = new Date(2000, 0, 1, h, m, s || 0);
    return H.fmtTime(d, { hour12: !!prefs.hour12, seconds: s !== undefined });
  };

  /* ---------- weather helpers ---------- */
  const WMO = (code, day = true) => {
    const c = Number(code);
    if (c === 0) return [day ? "sun" : "moon", "맑음"];
    if (c === 1) return [day ? "sun" : "moon", "대체로 맑음"];
    if (c === 2) return [day ? "cloudSun" : "cloudMoon", "구름 조금"];
    if (c === 3) return ["cloud", "흐림"];
    if (c === 45 || c === 48) return ["fog", "안개"];
    if (c >= 51 && c <= 57) return ["drizzle", "이슬비"];
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ["rain", c >= 80 ? "소나기" : "비"];
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ["snow", "눈"];
    if (c >= 95) return ["thunder", "뇌우"];
    return ["cloud", "-"];
  };
  H.WEATHER_CODE = WMO;

  /* ---------- timetable helpers ---------- */
  const DAY_NAMES = ["월", "화", "수", "목", "금", "토"];
  const toMin = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
    return m ? +m[1] * 60 + +m[2] : null;
  };
  const ttNow = (w, now) => {
    const dow = now.getDay(); // 0 sun
    const dayIdx = dow === 0 ? -1 : dow - 1;
    const minutes = now.getHours() * 60 + now.getMinutes();
    let current = -1;
    let next = -1;
    if (dayIdx >= 0 && dayIdx < w.days) {
      w.times.slice(0, w.periods).forEach((t, i) => {
        const s = toMin(t);
        if (s === null) return;
        if (minutes >= s && minutes < s + w.duration) current = i;
        if (next < 0 && s > minutes) next = i;
      });
    }
    return { dayIdx, current, next, minutes };
  };

  /* ---------- timer helpers ---------- */
  const timerTotal = (w) => (w.mode === "pomodoro" ? (w.phase === "break" ? w.breakMin : w.focusMin) : w.minutes) * 60000;
  const timerRemain = (w, now = Date.now()) => {
    if (w.run === "run") return Math.max(0, w.endAt - now);
    if (w.run === "pause") return Math.max(0, w.remain);
    return timerTotal(w);
  };
  const mmss = (ms) => {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return (h ? h + ":" + H.pad(m) : H.pad(m)) + ":" + H.pad(s % 60);
  };
  H.timerRemain = timerRemain;
  H.timerTotal = timerTotal;

  const T = {};

  /* ===== Big clock ===== */
  T.hero = {
    name: "큰 시계", glyph: "clock", sizes: ["m", "l"], size: "m", bare: true,
    desc: "시간·날짜·나만의 문구를 크게 보여 줍니다.",
    defaults: () => ({ label: "PERSONAL WORKSPACE", tagline: "", showDate: true, seconds: false }),
    sanitize: (c) => ({
      label: H.str(c.label, 40, "PERSONAL WORKSPACE"),
      tagline: H.str(c.tagline, 90),
      showDate: c.showDate !== false,
      seconds: !!c.seconds,
    }),
    tick: (w, p) => (w.seconds && !p?.saver ? "second" : "minute"),
    render(w, ctx) {
      const t = H.fmtTime(ctx.now, { hour12: !!ctx.prefs.hour12, seconds: w.seconds && !ctx.saver });
      const parts = t.text.split(":");
      const time = parts.map((p, i) => (i ? '<span class="colon">:</span>' : "") + `<span>${p}</span>`).join("");
      const tagline = w.tagline || ctx.theme.tagline || "";
      return `<div class="hero-eyebrow"><span class="star">✦</span>${esc(w.label)}<span class="hairline"></span><span class="hero-page">${esc(ctx.pageLabel || "")}</span></div>
        <div class="hero-time">${t.ap ? `<small class="ap">${t.ap}</small>` : ""}${time}</div>
        <div class="hero-meta">${w.showDate ? `<span>${H.fmtDate(ctx.now)}</span>` : ""}${w.showDate && tagline ? "<i></i>" : ""}${tagline ? `<em>${esc(tagline)}</em>` : ""}</div>`;
    },
    fields: [
      { k: "label", label: "윗줄 문구", type: "text", max: 40 },
      { k: "tagline", label: "시계 아래 문구 (비우면 테마 문구 사용)", type: "text", max: 90, placeholder: "A space made yours." },
      { k: "showDate", label: "날짜 표시", type: "toggle" },
      { k: "seconds", label: "초 단위 표시", type: "toggle" },
    ],
  };

  /* ===== Clock ===== */
  T.clock = {
    name: "시계", glyph: "clock", sizes: ["s"], size: "s",
    desc: "아날로그 또는 디지털 시계. 다른 도시 시간도 볼 수 있어요.",
    defaults: () => ({ style: "analog", tz: "local" }),
    sanitize: (c) => ({ style: H.oneOf(c.style, ["analog", "digital"], "analog"), tz: H.oneOf(c.tz, TIMEZONES.map((t) => t[0]), "local") }),
    tick: (w, p) => (w.style === "analog" && !p?.saver ? "second" : "minute"),
    render(w, ctx) {
      const p = tzParts(ctx.now, w.tz);
      const city = (TIMEZONES.find((t) => t[0] === w.tz) || TIMEZONES[0])[1];
      const label = w.tz === "local" ? "LOCAL TIME" : city;
      if (w.style === "digital") {
        const t = timeText(p.h, p.m, ctx.prefs);
        return head(label, "clock") + `<div class="wg-big">${t.ap ? `<small>${t.ap}</small>` : ""}${t.text}</div><div class="wg-foot">${H.fmtDate(p.d, "short")}</div>`;
      }
      const hr = ((p.h % 12) + p.m / 60) * 30;
      const mn = (p.m + p.s / 60) * 6;
      const sc = p.s * 6;
      const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="${i % 3 ? 8 : 6}" x2="50" y2="${i % 3 ? 11 : 13}" transform="rotate(${i * 30} 50 50)"/>`).join("");
      return `<div class="analog"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" class="face"/><g class="ticks">${ticks}</g>
        <line class="hand-h" x1="50" y1="50" x2="50" y2="27" transform="rotate(${hr} 50 50)"/><line class="hand-m" x1="50" y1="50" x2="50" y2="16" transform="rotate(${mn} 50 50)"/>
        ${ctx.saver ? "" : `<line class="hand-s" x1="50" y1="56" x2="50" y2="13" transform="rotate(${sc} 50 50)"/>`}<circle cx="50" cy="50" r="2.2" class="pin"/></svg>
        <span class="analog-label">${esc(w.tz === "local" ? H.WEEKDAYS[p.d.getDay()] + "요일" : city)}</span></div>`;
    },
    fields: [
      { k: "style", label: "모양", type: "segment", options: [["analog", "아날로그"], ["digital", "디지털"]] },
      { k: "tz", label: "도시", type: "select", options: TIMEZONES },
    ],
  };

  /* ===== Focus ===== */
  T.focus = {
    name: "오늘의 목표", glyph: "target", sizes: ["s", "m"], size: "s",
    desc: "하루 목표와 진행 단계. 매일 자동으로 0단계부터 시작할 수 있어요.",
    defaults: () => ({ title: "Create something new.", done: 0, total: 4, daily: false, day: H.dateKey() }),
    sanitize(c) {
      const total = H.num(c.total, 4, 1, 12);
      return { title: H.str(c.title, 70, "Create something new.") || "Create something new.", total, done: H.num(c.done, 0, 0, total), daily: !!c.daily, day: H.str(c.day, 10, H.dateKey()) };
    },
    tick: (w) => (w.daily ? "minute" : null),
    /* Reset the counter on a new day if requested. Returns a patch or null. */
    maintain(w) {
      const today = H.dateKey();
      if (w.daily && w.day !== today) return { done: 0, day: today };
      return null;
    },
    render(w, ctx) {
      const pct = (w.done / w.total) * 100;
      const steps = ctx.size === "m"
        ? `<div class="steps">${Array.from({ length: w.total }, (_, i) => `<button type="button" class="step ${i < w.done ? "on" : ""}" data-act="set" data-n="${i + 1}" aria-label="${i + 1}단계"></button>`).join("")}</div>`
        : "";
      return head("TODAY'S FOCUS", "target") + `<div class="focus-title">${esc(w.title)}</div>${steps}
        <div class="focus-bottom"><span class="progress"><span style="width:${pct}%"></span></span><span class="num">${H.pad(w.done)} / ${H.pad(w.total)}</span>
        <button type="button" class="mini-btn" data-act="inc" aria-label="한 단계 완료">${H.svg("plus")}</button></div>`;
    },
    act(w, act, data, ctx) {
      if (act === "inc") ctx.patch({ done: w.done >= w.total ? 0 : w.done + 1, day: H.dateKey() });
      if (act === "set") {
        const n = Number(data.n);
        ctx.patch({ done: w.done === n ? n - 1 : n, day: H.dateKey() });
      }
      if (w.done + 1 === w.total && act === "inc") ctx.toast("오늘의 목표 완료!");
    },
    fields: [
      { k: "title", label: "목표", type: "text", max: 70 },
      { k: "total", label: "전체 단계 수", type: "number", min: 1, max: 12 },
      { k: "done", label: "완료한 단계", type: "number", min: 0, max: 12 },
      { k: "daily", label: "매일 0단계로 초기화", type: "toggle" },
    ],
  };

  /* ===== To-do ===== */
  T.todo = {
    name: "할 일", glyph: "list", sizes: ["s", "m", "l"], size: "m",
    desc: "체크박스를 눌러 바로 완료 표시. 위젯 안에서 바로 추가할 수 있어요.",
    defaults: () => ({ title: "할 일", items: [{ id: id(), text: "위젯 길게 눌러 편집하기", done: false }, { id: id(), text: "체크박스를 눌러 완료", done: true }], hideDone: false }),
    sanitize: (c) => ({
      title: H.str(c.title, 30, "할 일") || "할 일",
      items: list(c.items).slice(0, 60).filter((x) => x && typeof x.text === "string").map((x) => ({ id: H.str(x.id, 30) || id(), text: x.text.slice(0, 120), done: !!x.done })),
      hideDone: !!c.hideDone,
    }),
    render(w, ctx) {
      const cap = { s: 3, m: 4, l: 11 }[ctx.size] || 4;
      const items = w.items.filter((x) => !(w.hideDone && x.done));
      const done = w.items.filter((x) => x.done).length;
      const rows = items.slice(0, cap).map((x) => `<li class="${x.done ? "done" : ""}"><button type="button" class="chk" data-act="toggle" data-id="${esc(x.id)}" aria-label="${x.done ? "완료 취소" : "완료"}">${x.done ? H.svg("check") : ""}</button><span>${esc(x.text)}</span></li>`).join("");
      const more = items.length > cap ? `<li class="more">+${items.length - cap}개 더</li>` : "";
      const empty = !items.length ? `<li class="empty">${w.items.length ? "모두 끝냈어요" : "할 일을 추가해 보세요"}</li>` : "";
      return head(w.title, null, `<span class="wg-count">${done}/${w.items.length}</span><button type="button" class="mini-btn" data-act="add" aria-label="할 일 추가">${H.svg("plus")}</button>`) + `<ul class="todo">${rows}${more}${empty}</ul>`;
    },
    act(w, act, data, ctx) {
      if (act === "toggle") ctx.patch({ items: w.items.map((x) => (x.id === data.id ? { ...x, done: !x.done } : x)) });
      if (act === "add")
        H.ui.prompt({ title: "할 일 추가", label: "내용", placeholder: "예: 수학 과제 제출", max: 120 }).then((v) => {
          if (v) ctx.patch({ items: [...w.items, { id: id(), text: v, done: false }] });
        });
    },
    fields: [
      { k: "title", label: "제목", type: "text", max: 30 },
      { k: "items", label: "목록", type: "todoList" },
      { k: "hideDone", label: "완료한 항목 숨기기", type: "toggle" },
    ],
  };

  /* ===== Memo / quote ===== */
  T.memo = {
    name: "메모", glyph: "notepad", sizes: ["s", "m", "l"], size: "s",
    desc: "짧은 메모나 좋아하는 문구. 누르면 바로 고칠 수 있어요.",
    defaults: () => ({ title: "QUICK NOTE", text: "", style: "note" }),
    sanitize: (c) => ({ title: H.str(c.title, 30, "QUICK NOTE"), text: H.str(c.text, 1200), style: H.oneOf(c.style, ["note", "quote"], "note") }),
    render(w) {
      const body = w.text ? esc(w.text).replace(/\n/g, "<br>") : '<span class="placeholder">눌러서 메모를 적어 보세요.</span>';
      return head(w.title, w.style === "quote" ? "quote" : "notepad") + `<div class="memo ${w.style}">${body}</div>`;
    },
    tap(w, ctx) {
      H.ui.prompt({ title: w.title || "메모", value: w.text, multiline: true, max: 1200, placeholder: "메모 내용" }).then((v) => {
        if (v !== null) ctx.patch({ text: v });
      });
    },
    fields: [
      { k: "title", label: "제목", type: "text", max: 30 },
      { k: "text", label: "내용", type: "textarea", max: 1200 },
      { k: "style", label: "모양", type: "segment", options: [["note", "메모"], ["quote", "큰 문구"]] },
    ],
  };

  /* ===== D-day ===== */
  T.dday = {
    name: "D-day", glyph: "flag", sizes: ["s", "m"], size: "s",
    desc: "시험·생일 같은 날까지 남은 날. 여러 개를 등록하면 가까운 순으로 보여요.",
    defaults: () => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return { title: "D-DAY", events: [{ id: id(), title: "목표일", date: H.dateKey(d) }], showPast: false };
    },
    sanitize: (c) => ({
      title: H.str(c.title, 30, "D-DAY") || "D-DAY",
      events: list(c.events).slice(0, 20).filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date || "")).map((e) => ({ id: H.str(e.id, 30) || id(), title: H.str(e.title, 40), date: e.date })),
      showPast: !!c.showPast,
    }),
    tick: () => "minute",
    sorted(w, now) {
      const evs = w.events.map((e) => ({ ...e, n: H.daysUntil(e.date, now) }));
      const up = evs.filter((e) => e.n >= 0).sort((a, b) => a.n - b.n);
      const past = evs.filter((e) => e.n < 0).sort((a, b) => b.n - a.n);
      return w.showPast ? [...up, ...past] : up.length ? up : past.slice(0, 1);
    },
    render(w, ctx) {
      const evs = T.dday.sorted(w, ctx.now);
      if (!evs.length) return head(w.title, "flag") + `<div class="wg-empty">날짜를 추가해 보세요</div>`;
      if (ctx.size === "s") {
        const e = evs[0];
        return head(w.title, "flag") + `<div class="wg-big dday-num">${H.ddayLabel(e.n)}</div><div class="wg-foot"><b>${esc(e.title || "목표일")}</b><span>${e.date.slice(5).replace("-", ".")}</span></div>`;
      }
      return head(w.title, "flag") + `<ul class="dday-list">${evs.slice(0, 3).map((e) => `<li><span class="t">${esc(e.title || "목표일")}<small>${e.date.replace(/-/g, ".")}</small></span><b>${H.ddayLabel(e.n)}</b></li>`).join("")}</ul>`;
    },
    fields: [
      { k: "title", label: "제목", type: "text", max: 30 },
      { k: "events", label: "날짜 목록", type: "eventList" },
      { k: "showPast", label: "지난 날짜도 표시", type: "toggle" },
    ],
  };

  /* ===== Timer / Pomodoro ===== */
  T.timer = {
    name: "타이머", glyph: "timer", sizes: ["s", "m"], size: "s",
    desc: "포모도로(집중·휴식 반복) 또는 일반 타이머. 끝나면 소리로 알려 줘요.",
    defaults: () => ({ mode: "pomodoro", focusMin: 25, breakMin: 5, minutes: 10, run: "idle", phase: "focus", endAt: 0, remain: 0, rounds: 0, roundsDay: H.dateKey() }),
    sanitize: (c) => ({
      mode: H.oneOf(c.mode, ["pomodoro", "timer"], "pomodoro"),
      focusMin: H.num(c.focusMin, 25, 1, 180), breakMin: H.num(c.breakMin, 5, 1, 60), minutes: H.num(c.minutes, 10, 1, 600),
      run: H.oneOf(c.run, ["idle", "run", "pause"], "idle"), phase: H.oneOf(c.phase, ["focus", "break"], "focus"),
      endAt: H.num(c.endAt, 0, 0), remain: H.num(c.remain, 0, 0), rounds: H.num(c.rounds, 0, 0, 999), roundsDay: H.str(c.roundsDay, 10, H.dateKey()),
    }),
    tick: (w) => (w.run === "run" ? "second" : null),
    maintain(w) {
      if (w.roundsDay !== H.dateKey() && w.run !== "run") return { rounds: 0, roundsDay: H.dateKey() };
      return null;
    },
    /* Called every second while running; returns patch when a phase completes. */
    advance(w, now, ctx) {
      if (w.run !== "run" || now < w.endAt) return null;
      const late = now - w.endAt > 90000;
      if (!late) {
        H.chime();
        H.haptic(200);
      }
      if (w.mode === "pomodoro" && w.phase === "focus") {
        if (!late) ctx.toast(`집중 끝! ${w.breakMin}분 쉬어요.`);
        return { phase: "break", run: "run", endAt: now + w.breakMin * 60000, rounds: w.rounds + 1, roundsDay: H.dateKey() };
      }
      if (w.mode === "pomodoro") {
        if (!late) ctx.toast("휴식 끝! 다음 집중을 시작해 보세요.");
        return { phase: "focus", run: "idle", endAt: 0, remain: 0 };
      }
      if (!late) ctx.toast("타이머가 끝났어요.");
      return { run: "idle", endAt: 0, remain: 0 };
    },
    render(w, ctx) {
      const total = timerTotal(w);
      const remain = timerRemain(w, ctx.now.getTime());
      const frac = total ? remain / total : 0;
      const C = 2 * Math.PI * 42;
      const label = w.mode === "pomodoro" ? (w.phase === "break" ? "휴식" : "집중") : "타이머";
      const ring = `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="track"/><circle cx="50" cy="50" r="42" class="bar ${w.phase}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}" transform="rotate(-90 50 50)"/></svg>`;
      const btn = `<button type="button" class="round-btn" data-act="toggle" aria-label="${w.run === "run" ? "일시정지" : "시작"}">${H.svg(w.run === "run" ? "pause" : "play")}</button>`;
      const reset = `<button type="button" class="round-btn ghost" data-act="reset" aria-label="초기화">${H.svg("refresh")}</button>`;
      const dots = w.mode === "pomodoro" ? `<span class="rounds">오늘 ${w.rounds}회 완료</span>` : "";
      if (ctx.size === "m")
        return head(w.mode === "pomodoro" ? "POMODORO" : "TIMER", "timer") + `<div class="timer-m"><div class="timer-ring">${ring}<span class="timer-time">${mmss(remain)}</span></div><div class="timer-side"><b class="phase ${w.phase}">${label}</b>${dots}<div class="timer-btns">${btn}${reset}</div></div></div>`;
      return head(label, "timer") + `<div class="timer-s"><div class="timer-ring">${ring}<span class="timer-time">${mmss(remain)}</span></div><div class="timer-btns">${btn}${reset}</div></div>`;
    },
    act(w, act, data, ctx) {
      const now = Date.now();
      if (act === "toggle") {
        if (w.run === "run") ctx.patch({ run: "pause", remain: Math.max(0, w.endAt - now) });
        else if (w.run === "pause") ctx.patch({ run: "run", endAt: now + w.remain });
        else ctx.patch({ run: "run", endAt: now + timerTotal(w) });
      }
      if (act === "reset") ctx.patch({ run: "idle", endAt: 0, remain: 0, phase: "focus" });
    },
    fields: [
      { k: "mode", label: "방식", type: "segment", options: [["pomodoro", "포모도로"], ["timer", "일반 타이머"]] },
      { k: "focusMin", label: "집중 시간 (분)", type: "number", min: 1, max: 180, when: (w) => w.mode === "pomodoro" },
      { k: "breakMin", label: "휴식 시간 (분)", type: "number", min: 1, max: 60, when: (w) => w.mode === "pomodoro" },
      { k: "minutes", label: "타이머 시간 (분)", type: "number", min: 1, max: 600, when: (w) => w.mode === "timer" },
    ],
  };

  /* ===== Weather (Open-Meteo, no key) ===== */
  T.weather = {
    name: "날씨", glyph: "cloudSun", sizes: ["s", "m"], size: "s",
    desc: "현재 날씨와 4일 예보. 도시를 검색하거나 현재 위치를 쓸 수 있어요. (인터넷 필요)",
    defaults: () => ({ place: { name: "서울", lat: 37.5665, lon: 126.978 } }),
    sanitize(c) {
      const p = c.place;
      const ok = p && Number.isFinite(+p.lat) && Number.isFinite(+p.lon);
      return { place: ok ? { name: H.str(p.name, 40, "위치"), lat: H.clamp(+p.lat, -90, 90), lon: H.clamp(+p.lon, -180, 180) } : null };
    },
    tick: () => "minute",
    render(w, ctx) {
      if (!w.place) return head("WEATHER", "cloudSun") + `<div class="wg-empty">위치를 설정해 주세요<button type="button" class="chip" data-act="locate">${H.svg("location")}현재 위치</button></div>`;
      const data = H.weather?.peek(w.place);
      if (!data) return head(w.place.name, "cloudSun") + `<div class="wg-empty">${H.weather?.error(w.place) ? "날씨를 불러오지 못했어요" : "불러오는 중…"}</div>`;
      const cur = data.current;
      const [g, text] = WMO(cur.weather_code, cur.is_day !== 0);
      const d = data.daily;
      const hi = Math.round(d.temperature_2m_max[0]);
      const lo = Math.round(d.temperature_2m_min[0]);
      const main = `<div class="wx-main">${H.svg(g, "wx-icon")}<span class="wx-temp">${Math.round(cur.temperature_2m)}°</span></div><div class="wx-sub"><b>${text}</b><span>최고 ${hi}° · 최저 ${lo}°</span></div>`;
      if (ctx.size === "s") return head(w.place.name, null, data.stale ? '<span class="wg-count">오프라인</span>' : "") + main;
      const days = d.time.slice(1, 5).map((t, i) => {
        const dt = H.parseDateKey(t);
        const [gg] = WMO(d.weather_code[i + 1], true);
        const pop = d.precipitation_probability_max?.[i + 1];
        return `<li><span>${dt ? H.WEEKDAYS[dt.getDay()] : ""}</span>${H.svg(gg)}<b>${Math.round(d.temperature_2m_max[i + 1])}°</b><small>${Math.round(d.temperature_2m_min[i + 1])}°${pop != null ? ` · ${pop}%` : ""}</small></li>`;
      }).join("");
      return head(w.place.name, null, data.stale ? '<span class="wg-count">오프라인</span>' : `<span class="wg-count">체감 ${Math.round(cur.apparent_temperature)}° · 습도 ${cur.relative_humidity_2m}%</span>`) + `<div class="wx-m"><div>${main}</div><ul class="wx-days">${days}</ul></div>`;
    },
    act(w, act, data, ctx) {
      if (act === "locate") H.weather?.locate().then((place) => place && ctx.patch({ place }));
    },
    fields: [{ k: "place", label: "위치", type: "place" }],
  };

  /* ===== Month calendar ===== */
  T.calendar = {
    name: "달력", glyph: "calendar", sizes: ["s", "m"], size: "m",
    desc: "이번 달 달력. D-day 위젯의 날짜가 점으로 표시돼요.",
    defaults: () => ({ mondayFirst: false }),
    sanitize: (c) => ({ mondayFirst: !!c.mondayFirst }),
    tick: () => "minute",
    render(w, ctx) {
      const now = ctx.now;
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1);
      const days = new Date(y, m + 1, 0).getDate();
      const off = (first.getDay() - (w.mondayFirst ? 1 : 0) + 7) % 7;
      const marks = new Set((ctx.events || []).map((e) => e.date));
      const names = w.mondayFirst ? ["월", "화", "수", "목", "금", "토", "일"] : H.WEEKDAYS;
      let cells = names.map((n, i) => `<span class="dow ${(w.mondayFirst ? i === 6 : i === 0) ? "sun" : ""}">${n}</span>`).join("");
      for (let i = 0; i < off; i++) cells += "<span></span>";
      for (let d = 1; d <= days; d++) {
        const key = `${y}-${H.pad(m + 1)}-${H.pad(d)}`;
        const dow = new Date(y, m, d).getDay();
        cells += `<span class="day ${d === now.getDate() ? "today" : ""} ${dow === 0 ? "sun" : ""} ${marks.has(key) ? "mark" : ""}">${d}</span>`;
      }
      const grid = `<div class="cal-grid">${cells}</div>`;
      const title = `${y}. ${m + 1}`;
      if (ctx.size === "s") return head(`${m + 1}월`, null) + grid;
      const up = (ctx.events || []).map((e) => ({ ...e, n: H.daysUntil(e.date, now) })).filter((e) => e.n >= 0).sort((a, b) => a.n - b.n).slice(0, 3);
      const side = `<div class="cal-side"><div class="cal-today"><b>${now.getDate()}</b><span>${H.WEEKDAYS[now.getDay()]}요일</span></div><ul>${up.length ? up.map((e) => `<li><span>${esc(e.title || "일정")}</span><b>${H.ddayLabel(e.n)}</b></li>`).join("") : '<li class="muted">다가오는 D-day 없음</li>'}</ul></div>`;
      return head(title, "calendar") + `<div class="cal-m">${grid}${side}</div>`;
    },
    tap(w, ctx) {
      ctx.openApp("calendar");
    },
    fields: [{ k: "mondayFirst", label: "월요일부터 시작", type: "toggle" }],
  };

  /* ===== School timetable ===== */
  const DEFAULT_TIMES = ["08:40", "09:40", "10:40", "11:40", "13:30", "14:30", "15:30", "16:30", "17:30"];
  T.timetable = {
    name: "시간표", glyph: "table", sizes: ["m", "l"], size: "m",
    desc: "요일별 과목을 넣으면 오늘 수업과 지금 교시를 보여 줘요.",
    defaults: () => ({ title: "시간표", days: 5, periods: 7, duration: 50, times: DEFAULT_TIMES.slice(), grid: Array.from({ length: 6 }, () => Array(9).fill("")) }),
    sanitize(c) {
      const days = H.num(c.days, 5, 5, 6);
      const periods = H.num(c.periods, 7, 1, 9);
      const times = DEFAULT_TIMES.map((t, i) => (/^\d{1,2}:\d{2}$/.test(c.times?.[i] || "") ? c.times[i] : t));
      const grid = Array.from({ length: 6 }, (_, d) => Array.from({ length: 9 }, (_, p) => H.str(c.grid?.[d]?.[p], 16)));
      return { title: H.str(c.title, 20, "시간표") || "시간표", days, periods, duration: H.num(c.duration, 50, 10, 120), times, grid };
    },
    tick: () => "minute",
    render(w, ctx) {
      const st = ttNow(w, ctx.now);
      const empty = !w.grid.some((d) => d.some(Boolean));
      if (empty) return head(w.title, "table") + `<div class="wg-empty">편집에서 과목을 입력해 주세요</div>`;
      if (ctx.size === "l") {
        const headRow = `<tr><th></th>${DAY_NAMES.slice(0, w.days).map((n, i) => `<th class="${i === st.dayIdx ? "today" : ""}">${n}</th>`).join("")}</tr>`;
        const rows = Array.from({ length: w.periods }, (_, p) => `<tr><th>${p + 1}<small>${w.times[p]}</small></th>${Array.from({ length: w.days }, (_, d) => `<td class="${d === st.dayIdx ? "today" : ""} ${d === st.dayIdx && p === st.current ? "now" : ""}">${esc(w.grid[d][p])}</td>`).join("")}</tr>`).join("");
        return head(w.title, "table") + `<table class="tt-table">${headRow}${rows}</table>`;
      }
      let day = st.dayIdx;
      let label = "오늘";
      if (day < 0 || day >= w.days) {
        day = 0;
        label = "다음 월요일";
      }
      const items = Array.from({ length: w.periods }, (_, p) => ({ p, s: w.grid[day][p] })).filter((x) => x.s);
      const cur = st.current >= 0 && day === st.dayIdx ? w.grid[day][st.current] : "";
      const nxt = st.next >= 0 && day === st.dayIdx ? w.grid[day][st.next] : "";
      const status = cur ? `<b class="now">지금 ${st.current + 1}교시 · ${esc(cur)}</b>` : nxt ? `<b>다음 ${st.next + 1}교시 · ${esc(nxt)} <small>${w.times[st.next]}</small></b>` : `<b>${label} 수업</b>`;
      return head(`${w.title} · ${DAY_NAMES[day]}`, "table", "") + `<div class="tt-status">${status}</div><ol class="tt-list">${items.map((x) => `<li class="${day === st.dayIdx && x.p === st.current ? "now" : ""} ${day === st.dayIdx && st.minutes > (toMin(w.times[x.p]) ?? 0) + w.duration ? "past" : ""}"><small>${x.p + 1}</small>${esc(x.s)}</li>`).join("")}</ol>`;
    },
    fields: [
      { k: "title", label: "제목", type: "text", max: 20 },
      { k: "grid", label: "과목", type: "timetable" },
    ],
  };

  /* ===== Photo ===== */
  T.photo = {
    name: "사진", glyph: "photo", sizes: ["s", "m", "l"], size: "m",
    desc: "사진 여러 장을 넣으면 자동으로 넘겨 줘요. GIF도 움직여요.",
    defaults: () => ({ images: [], caption: "", interval: 8, idx: 0 }),
    sanitize: (c) => ({ images: list(c.images).filter((k) => typeof k === "string" && /^w:[\w-]+:\w+$/.test(k)).slice(0, 12), caption: H.str(c.caption, 60), interval: H.num(c.interval, 8, 0, 120), idx: H.num(c.idx, 0, 0, 11) }),
    /* number = wake up on every multiple of that many seconds (no polling in between) */
    tick: (w, p) => (w.interval && w.images.length > 1 && !p?.saver ? w.interval : null),
    render(w, ctx) {
      const urls = w.images.map((k) => ctx.asset(k)).filter(Boolean);
      if (!urls.length) return head(w.caption || "PHOTO", "photo") + `<div class="wg-empty">편집에서 사진을 추가하세요</div>`;
      const i = Math.floor((w.interval && !ctx.saver ? ctx.now.getTime() / 1000 / w.interval : 0) + (w.idx || 0)) % urls.length;
      return `<div class="photo-stack">${urls.map((u, k) => `<img src="${u}" alt="" class="${k === i ? "on" : ""}" draggable="false">`).join("")}</div>${w.caption ? `<div class="photo-cap">${esc(w.caption)}</div>` : ""}`;
    },
    /* Cheap update: just move the "on" class. */
    refresh(el, w, ctx) {
      const imgs = el.querySelectorAll(".photo-stack img");
      if (imgs.length < 2) return;
      const i = Math.floor((w.interval && !H.power?.saver() ? ctx.now.getTime() / 1000 / w.interval : 0) + (w.idx || 0)) % imgs.length;
      imgs.forEach((im, k) => im.classList.toggle("on", k === i));
    },
    tap(w, ctx) {
      if (w.images.length > 1) ctx.patch({ idx: ((w.idx || 0) + 1) % 12 }, { quiet: true });
    },
    fields: [
      { k: "images", label: "사진", type: "photos" },
      { k: "caption", label: "설명 (선택)", type: "text", max: 60 },
      { k: "interval", label: "자동 넘김", type: "select", options: [[0, "넘기지 않음"], [5, "5초"], [8, "8초"], [15, "15초"], [30, "30초"], [60, "1분"]] },
    ],
  };

  /* ===== Link card ===== */
  T.link = {
    name: "바로가기 카드", glyph: "link", sizes: ["s", "m"], size: "s",
    desc: "자주 가는 웹페이지나 앱 주소를 큰 카드로.",
    defaults: () => ({ title: "바로가기", url: "", glyph: "link", note: "" }),
    sanitize: (c) => ({ title: H.str(c.title, 30, "바로가기") || "바로가기", url: H.safeURL(c.url) ? H.str(c.url, 1024) : "", glyph: H.glyphs[c.glyph] ? c.glyph : "link", note: H.str(c.note, 60) }),
    render(w) {
      let host = "";
      try {
        host = w.url ? new URL(w.url).host || w.url.split(":")[0] : "";
      } catch (e) {}
      return head("SHORTCUT", "arrowUR") + `<div class="link-body">${H.svg(w.glyph, "link-glyph")}<b>${esc(w.title)}</b><small>${esc(w.note || host || "편집에서 주소를 넣어 주세요")}</small></div>`;
    },
    tap(w, ctx) {
      if (w.url) ctx.openURL(w.url);
      else ctx.edit();
    },
    fields: [
      { k: "title", label: "이름", type: "text", max: 30 },
      { k: "url", label: "주소 (https:// 또는 앱 주소)", type: "url" },
      { k: "note", label: "설명 (선택)", type: "text", max: 60 },
      { k: "glyph", label: "기호", type: "glyph" },
    ],
  };

  /* ===== Ambient switch ===== */
  T.ambient = {
    name: "배경 움직임", glyph: "wave", sizes: ["s"], size: "s",
    desc: "누를 때마다 배경 애니메이션을 켜고 끕니다.",
    defaults: () => ({}),
    sanitize: () => ({}),
    render(w, ctx) {
      const on = ctx.motion && !ctx.saver;
      const state = !ctx.motion ? "OFF" : ctx.saver ? "절전 중" : "ON";
      return head("AMBIENT SPACE", "wave") + `<div class="wave-bars ${on ? "" : "paused"}">${Array.from({ length: 20 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><div class="wg-foot"><span>ANIMATION</span><span>${state}</span></div>`;
    },
    tap(w, ctx) {
      ctx.toggleMotion();
    },
    fields: [],
  };

  H.WTYPES = T;
  H.WIDGET_ORDER = ["hero", "clock", "focus", "todo", "memo", "dday", "timer", "weather", "calendar", "timetable", "photo", "link", "ambient"];
  H.SIZE_SPAN = { s: [2, 2], m: [4, 2], l: [4, 4] };
  H.SIZE_NAME = { s: "작게", m: "넓게", l: "크게" };

  H.makeWidget = (type, size) => {
    const t = T[type];
    return { id: H.uid("w"), type, size: t.sizes.includes(size) ? size : t.size, ...t.defaults() };
  };
  H.sanitizeWidget = (w) => {
    const t = T[w?.type];
    if (!t) return null;
    const base = { id: H.str(w.id, 40) || H.uid("w"), type: w.type, size: t.sizes.includes(w.size) ? w.size : t.size };
    let cfg;
    try {
      cfg = t.sanitize({ ...t.defaults(), ...w });
    } catch (e) {
      cfg = t.defaults();
    }
    return { ...base, ...cfg };
  };
})();
