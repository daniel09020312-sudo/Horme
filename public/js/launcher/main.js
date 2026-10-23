/* Ὁρμή launcher — boot, top bar, keyboard shortcuts, install & update prompts. */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const app = {};

  /* ---------- top bar ---------- */
  H.topbar = {
    tick(now = new Date()) {
      const t = H.fmtTime(now, { hour12: S().prefs.hour12 });
      const el = H.$("#top-time");
      if (el) el.textContent = (t.ap ? t.ap + " " : "") + t.text;
      const d = H.$("#top-day");
      if (d) d.textContent = H.fmtDate(now, "short");
    },
    updateUndo() {
      const b = H.$("#btn-undo");
      if (b) b.hidden = !H.store.undoStack.length;
    },
    init() {
      H.$("#btn-search").onclick = () => H.library.spotlight();
      H.$("#btn-edit").onclick = () => H.home.setEditing(true);
      H.$("#btn-settings").onclick = () => H.sheets.settings();
      H.$("#btn-done").onclick = () => H.home.setEditing(false);
      H.$("#btn-pages").onclick = () => H.sheets.pages();
      H.$("#btn-undo").onclick = () => doUndo();
      H.$("#btn-add").onclick = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        H.ui.menu({
          rect: r,
          title: "추가하기",
          items: [
            { label: "위젯", glyph: "widget", act: () => H.widgetEditor.gallery() },
            { label: "앱 바로가기", glyph: "plus", act: () => H.sheets.addApp() },
            { label: "새 페이지", glyph: "pages", act: () => {
              if (S().pages.length >= H.schema.MAX_PAGES) return H.ui.toast("페이지가 너무 많아요.");
              H.store.commit((s) => s.pages.push({ id: H.uid("p"), items: [] }), { label: "페이지 추가" });
              H.pager.go(S().pages.length - 1);
            } },
          ],
        });
      };
      H.$(".dock-lib").onclick = () => H.pager.go(H.pager.libraryIndex());
      H.topbar.tick();
      H.listen("change", () => H.topbar.updateUndo());
      H.topbar.updateUndo();
    },
  };

  function doUndo() {
    const label = H.store.undo();
    if (label) H.ui.toast(typeof label === "string" && label ? `되돌렸어요 · ${label}` : "되돌렸어요.");
    else H.ui.toast("되돌릴 변경이 없어요.");
  }

  /* ---------- keyboard ---------- */
  function keys(e) {
    const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      H.ui.closeAll();
      return H.library.spotlight();
    }
    if (typing) return;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      return doUndo();
    }
    if (H.ui.isOpen() || H.library.spotlightOpen() || H.folders.openId) return;
    if (e.key === "/" && !mod) {
      e.preventDefault();
      return H.library.spotlight();
    }
    if (e.key === "ArrowRight") H.pager.next();
    if (e.key === "ArrowLeft") H.pager.prev();
    if (e.key === "Escape" && H.home.editing) H.home.setEditing(false);
  }

  /* ---------- service worker + updates ---------- */
  let reg = null;
  function promptUpdate(worker) {
    H.ui.toast("새 버전이 준비됐어요.", {
      ms: 12000,
      action: {
        label: "업데이트",
        fn: () => worker.postMessage({ type: "SKIP_WAITING" }),
      },
    });
  }
  app.checkUpdate = async (manual) => {
    if (!reg) return manual && H.ui.toast(location.protocol === "https:" ? "업데이트를 확인할 수 없어요." : "HTTPS 주소에서만 업데이트를 확인할 수 있어요.");
    try {
      await reg.update();
    } catch (e) {}
    if (reg.waiting) promptUpdate(reg.waiting);
    else if (manual) H.ui.toast(`최신 버전이에요 (${H.VERSION}).`);
  };
  function registerSW() {
    if (!("serviceWorker" in navigator) || H.isPreview || !(location.protocol === "https:" || location.hostname === "localhost")) return;
    navigator.serviceWorker
      .register("sw.js")
      .then((r) => {
        reg = r;
        if (r.waiting && navigator.serviceWorker.controller) promptUpdate(r.waiting);
        r.addEventListener("updatefound", () => {
          const w = r.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) promptUpdate(w);
          });
        });
      })
      .catch(() => {});
    // reload only when an existing version is replaced (not on the very first install)
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading || !hadController) return;
      reloading = true;
      H.store.flush();
      location.reload();
    });
  }

  /* ---------- install hints ---------- */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (S()?.prefs.installHint && !H.isPreview) showBanner("android");
  });
  function showBanner(kind) {
    if (H.$(".install-banner")) return;
    const el = H.h(`<div class="install-banner" role="note"><img src="icons/icon-192.png" alt="" width="36" height="36"><span><b>홈 화면에 설치하기</b><small>${kind === "android" ? "앱처럼 전체 화면으로 열려요." : "공유 → ‘홈 화면에 추가’를 누르면 앱처럼 열려요."}</small></span>
      <button type="button" class="btn small primary" data-i>${kind === "android" ? "설치" : "방법 보기"}</button><button type="button" class="icon-btn" data-x aria-label="닫기">${H.svg("close")}</button></div>`);
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add("show"));
    el.querySelector("[data-i]").onclick = async () => {
      if (kind === "android" && deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        el.remove();
      } else H.sheets.install();
    };
    el.querySelector("[data-x]").onclick = () => {
      el.remove();
      H.store.commit((s) => (s.prefs.installHint = false), { undo: false, scope: "prefs" });
    };
  }

  /* ---------- boot ---------- */
  async function boot() {
    if (H.isPreview) document.body.classList.add("preview");
    try {
      await H.store.init();
    } catch (e) {
      console.error(e);
      H.store.state = H.schema.defaults();
    }
    H.applyTheme();
    H.power.init();
    await H.assets.preload().catch(() => {});
    H.bg.init();
    H.library.init();
    H.home.init();
    H.home.render();
    H.pager.init();
    H.drag.init();
    H.topbar.init();
    H.home.startTicker();
    document.addEventListener("keydown", keys);
    H.listen("save-error", () => H.ui.toast("저장 공간 문제로 설정을 저장하지 못했어요. 전체 백업을 권해요."));
    document.body.classList.add("ready");
    if (H.store.migrated) setTimeout(() => H.ui.toast("이전 버전의 앱·디자인 설정을 새 버전으로 옮겼어요."), 900);
    if (H.store.recovered) setTimeout(() => H.ui.toast("저장된 설정이 손상돼서 기본 화면으로 시작했어요. 백업을 불러올 수 있어요."), 900);
    registerSW();
    if (H.isIOS && !H.isStandalone() && S().prefs.installHint && !H.isPreview) setTimeout(() => showBanner("ios"), 2500);
    setTimeout(() => H.assets.gc(), 6000);
    // deep links: index.html?open=search|settings|widgets|edit
    const open = H.params.get("open");
    if (open === "search") H.library.spotlight();
    if (open === "settings") H.sheets.settings();
    if (open === "widgets") H.widgetEditor.gallery();
    if (open === "edit") H.home.setEditing(true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  H.app = app;
})();
