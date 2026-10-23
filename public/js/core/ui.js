/* Ὁρμή — UI primitives: toast, sheet (modal), confirm, prompt, context menu, form bits. */
(() => {
  "use strict";
  const H = window.H;
  const ui = {};
  const stack = [];

  /* ---------- toast ---------- */
  let toastEl = null;
  let toastTimer = 0;
  ui.toast = (msg, opts = {}) => {
    if (!toastEl) {
      toastEl = H.h('<div class="toast" role="status" aria-live="polite"><span class="toast-msg"></span><button type="button" class="toast-act" hidden></button></div>');
      document.body.append(toastEl);
    }
    toastEl.querySelector(".toast-msg").textContent = msg;
    const act = toastEl.querySelector(".toast-act");
    if (opts.action) {
      act.hidden = false;
      act.textContent = opts.action.label;
      act.onclick = () => {
        hide();
        opts.action.fn();
      };
    } else act.hidden = true;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    const hide = () => toastEl.classList.remove("show");
    toastTimer = setTimeout(hide, opts.ms || (opts.action ? 5200 : 2800));
  };
  H.listen("toast", (m) => ui.toast(typeof m === "string" ? m : m.msg, m.opts || {}));

  /* ---------- sheet ---------- */
  ui.sheet = ({ title = "", sub = "", body = "", foot = "", size = "md", cls = "", onClose, closable = true } = {}) => {
    const level = stack.length;
    const layer = H.h(`<div class="sheet-layer ${cls}" style="z-index:${200 + level * 10}">
      <div class="sheet-backdrop"></div>
      <section class="sheet size-${size}" role="dialog" aria-modal="true" aria-label="${H.esc(title)}">
        <div class="sheet-grab" aria-hidden="true"></div>
        ${title ? `<header class="sheet-head"><div class="sheet-titles"><h2>${H.esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${closable ? `<button type="button" class="icon-btn sheet-close" aria-label="닫기">${H.svg("close")}</button>` : ""}</header>` : ""}
        <div class="sheet-body"></div>
        <footer class="sheet-foot"></footer>
      </section></div>`);
    const bodyEl = layer.querySelector(".sheet-body");
    const footEl = layer.querySelector(".sheet-foot");
    if (typeof body === "string") bodyEl.innerHTML = body;
    else if (body) bodyEl.append(body);
    if (typeof foot === "string") footEl.innerHTML = foot;
    else if (foot) footEl.append(foot);
    if (!foot) footEl.remove();
    const prevFocus = document.activeElement;
    let closed = false;
    const api = {
      el: layer,
      body: bodyEl,
      foot: footEl,
      close(reason) {
        if (closed) return;
        closed = true;
        layer.classList.remove("open");
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        setTimeout(() => layer.remove(), H.reducedMotion() ? 0 : 240);
        try {
          prevFocus?.focus?.({ preventScroll: true });
        } catch (e) {}
        onClose?.(reason);
        if (!stack.length) document.body.classList.remove("sheet-open");
      },
    };
    if (closable) {
      layer.querySelector(".sheet-backdrop").addEventListener("click", () => api.close("backdrop"));
      layer.querySelector(".sheet-close")?.addEventListener("click", () => api.close("x"));
    }
    stack.push(api);
    document.body.append(layer);
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => {
      layer.classList.add("open");
      const first = layer.querySelector("[autofocus], .sheet-body input:not([type=checkbox]):not([type=range]):not([type=file]), .sheet-body textarea");
      if (first && !H.isMobileOS) first.focus({ preventScroll: true });
      else layer.querySelector(".sheet")?.focus?.();
    });
    layer.querySelector(".sheet").tabIndex = -1;
    return api;
  };
  ui.top = () => stack[stack.length - 1] || null;
  ui.closeAll = () => [...stack].reverse().forEach((s) => s.close("all"));
  ui.isOpen = () => stack.length > 0;

  /* ---------- confirm / prompt ---------- */
  ui.confirm = ({ title = "확인", msg = "", ok = "확인", cancel = "취소", danger = false } = {}) =>
    new Promise((resolve) => {
      let answered = false;
      const s = ui.sheet({
        title,
        size: "sm",
        body: msg ? `<p class="sheet-msg">${msg}</p>` : "",
        foot: `<button type="button" class="btn ghost" data-r="0">${H.esc(cancel)}</button><button type="button" class="btn ${danger ? "danger" : "primary"}" data-r="1">${H.esc(ok)}</button>`,
        onClose: () => !answered && resolve(false),
      });
      s.foot.addEventListener("click", (e) => {
        const b = e.target.closest("[data-r]");
        if (!b) return;
        answered = true;
        resolve(b.dataset.r === "1");
        s.close();
      });
      setTimeout(() => s.foot.querySelector('[data-r="1"]')?.focus(), 30);
    });

  ui.prompt = ({ title = "입력", label = "", value = "", placeholder = "", multiline = false, max = 200, ok = "저장" } = {}) =>
    new Promise((resolve) => {
      let answered = false;
      const input = multiline
        ? `<textarea class="input" rows="7" maxlength="${max}" placeholder="${H.esc(placeholder)}" autofocus>${H.esc(value)}</textarea>`
        : `<input class="input" maxlength="${max}" value="${H.esc(value)}" placeholder="${H.esc(placeholder)}" autofocus>`;
      const s = ui.sheet({
        title,
        size: "sm",
        body: `<form class="form">${label ? `<label class="field"><span>${H.esc(label)}</span>${input}</label>` : input}<button type="submit" hidden></button></form>`,
        foot: `<button type="button" class="btn ghost" data-r="0">취소</button><button type="button" class="btn primary" data-r="1">${H.esc(ok)}</button>`,
        onClose: () => !answered && resolve(null),
      });
      const el = s.body.querySelector(".input");
      const done = (yes) => {
        answered = true;
        resolve(yes ? el.value.trim() : null);
        s.close();
      };
      s.body.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        done(true);
      });
      s.foot.addEventListener("click", (e) => {
        const b = e.target.closest("[data-r]");
        if (b) done(b.dataset.r === "1");
      });
      setTimeout(() => {
        el.focus();
        if (!multiline) el.select();
      }, 60);
    });

  /* ---------- context menu ---------- */
  let menuEl = null;
  ui.closeMenu = () => {
    if (!menuEl) return;
    const m = menuEl;
    menuEl = null;
    m.classList.remove("open");
    setTimeout(() => m.remove(), 160);
    document.body.classList.remove("menu-open");
  };
  ui.menu = ({ x, y, rect, title = "", items = [], onClose } = {}) => {
    ui.closeMenu();
    let idx = 0;
    const flat = [];
    items.forEach((it) => {
      if (it.row) it.row.forEach((r) => ((r.i = idx++), flat.push(r)));
      else if (!it.sep) ((it.i = idx++), flat.push(it));
    });
    const rebuilt = items
      .map((it) => {
        if (it.sep) return '<div class="menu-sep"></div>';
        if (it.row) return `<div class="menu-row">${it.row.map((r) => `<button type="button" class="menu-chip ${r.on ? "on" : ""}" data-i="${r.i}">${H.esc(r.label)}</button>`).join("")}</div>`;
        return `<button type="button" role="menuitem" class="menu-item ${it.danger ? "danger" : ""}" data-i="${it.i}" ${it.disabled ? "disabled" : ""}><span>${H.esc(it.label)}</span>${it.glyph ? H.svg(it.glyph) : ""}</button>`;
      })
      .join("");
    menuEl = H.h(`<div class="ctx-menu" role="menu">${title ? `<div class="menu-title">${H.esc(title)}</div>` : ""}${rebuilt}</div>`);
    document.body.append(menuEl);
    document.body.classList.add("menu-open");
    const mw = menuEl.offsetWidth;
    const mh = menuEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left, top;
    if (rect) {
      left = rect.left + rect.width / 2 - mw / 2;
      top = rect.bottom + 10;
      if (top + mh > vh - 10) top = rect.top - mh - 10;
      if (top < 10) top = Math.min(vh - mh - 10, rect.top + 20);
    } else {
      left = x;
      top = y;
    }
    menuEl.style.left = H.clamp(left, 10, vw - mw - 10) + "px";
    menuEl.style.top = H.clamp(top, 10, vh - mh - 10) + "px";
    menuEl.style.transformOrigin = rect ? `${H.clamp(rect.left + rect.width / 2 - left, 0, mw)}px ${top > rect.top ? 0 : mh}px` : "top left";
    requestAnimationFrame(() => menuEl?.classList.add("open"));
    menuEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]");
      if (!b) return;
      const it = flat[Number(b.dataset.i)];
      ui.closeMenu();
      it?.act?.();
    });
    menuEl.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
    const off = (e) => {
      if (menuEl && !menuEl.contains(e.target)) {
        ui.closeMenu();
        onClose?.();
      }
      if (!menuEl) document.removeEventListener("pointerdown", off, true);
    };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
    return menuEl;
  };
  ui.menuOpen = () => !!menuEl;

  /* ---------- form helpers ---------- */
  ui.seg = (name, options, value) =>
    `<div class="seg" role="radiogroup" data-name="${name}">${options
      .map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? "on" : ""}" data-value="${H.esc(v)}">${H.esc(l)}</button>`)
      .join("")}</div>`;
  /* Wire every .seg in root: clicking selects, then calls onChange(name, value). */
  ui.bindSeg = (root, onChange) => {
    H.on(root, "click", ".seg button", (e, b) => {
      const seg = b.closest(".seg");
      seg.querySelectorAll("button").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-checked", String(x === b));
      });
      onChange?.(seg.dataset.name, b.dataset.value);
    });
  };
  ui.switch = (id, checked, label, sub = "") =>
    `<label class="switch-row"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</span><input type="checkbox" class="switch" id="${id}" ${checked ? "checked" : ""}></label>`;

  /* Escape closes the top sheet or menu everywhere. */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (menuEl) {
      ui.closeMenu();
      e.stopImmediatePropagation();
      return;
    }
    const top = ui.top();
    if (top) {
      top.close("esc");
      e.stopImmediatePropagation();
    }
  }, true);

  H.ui = ui;
})();
