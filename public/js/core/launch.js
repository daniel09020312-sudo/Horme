/* Ὁρμή — opening apps and links.
   mode "auto": try the app link first, fall back to the web address if the app did not open.
   mode "app":  app link only.  mode "web": web address only. */
(() => {
  "use strict";
  const H = window.H;
  let pending = null;

  function cancelPending() {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
  }
  /* If the page is hidden the app (or another app) opened — cancel the fallback. */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelPending();
  });
  window.addEventListener("pagehide", cancelPending);

  function openWeb(url) {
    const pref = H.S()?.prefs?.openWeb || "auto";
    const sameWindow = pref === "same" || (pref === "auto" && H.isStandalone());
    if (sameWindow) {
      location.assign(url);
      return;
    }
    const w = window.open(url, "_blank", "noopener");
    if (!w) location.assign(url);
  }

  function openScheme(url) {
    // A hidden-iframe trick is unreliable on modern iOS; a direct navigation is the supported path.
    location.href = url;
  }

  /* Open a single URL (scheme or web). */
  function openURL(url) {
    if (!H.safeURL(url)) {
      H.ui.toast("열 수 없는 주소예요. 주소 형식을 확인해 주세요.");
      return false;
    }
    if (H.isPreview) {
      H.ui.toast("미리보기에서는 앱이 실행되지 않아요.");
      return false;
    }
    if (url.startsWith("horme://")) {
      H.emit("internal", url.slice(8));
      return true;
    }
    if (H.isWebURL(url)) openWeb(url);
    else openScheme(url);
    return true;
  }

  function record(app) {
    H.store.commit(
      (s) => {
        const st = s.stats[app.id] || [0, 0];
        s.stats[app.id] = [st[0] + 1, Date.now()];
        s.recent = [app.id, ...s.recent.filter((x) => x !== app.id)].slice(0, 12);
      },
      { undo: false, quiet: true, scope: "stats", sanitize: false },
    );
  }

  /* Returns true if something was opened. */
  function launchApp(app, { force } = {}) {
    if (!app) return false;
    if (app.app === "horme://settings") {
      H.emit("internal", "settings");
      record(app);
      return true;
    }
    const mode = force || app.mode || "auto";
    const hasApp = !!app.app && H.safeURL(app.app);
    const hasWeb = !!app.web && H.isWebURL(app.web);
    if (!hasApp && !hasWeb) {
      H.emit("needs-link", app.id);
      return false;
    }
    if (H.isPreview) {
      H.ui.toast(`미리보기 · ${app.name} 실행`);
      return false;
    }
    record(app);
    cancelPending();
    if (mode === "web" || !hasApp) return openURL(app.web);
    if (mode === "app" || !hasWeb) return openURL(app.app);
    // auto: on computers app links rarely exist → go straight to the web
    if (!H.isMobileOS) return openURL(app.web);
    const started = Date.now();
    openScheme(app.app);
    pending = {
      timer: setTimeout(() => {
        pending = null;
        if (!document.hidden && Date.now() - started < 4000) {
          H.ui.toast(`${app.name} 앱을 열지 못해 웹으로 열어요.`);
          openWeb(app.web);
        }
      }, 1600),
    };
    return true;
  }

  /* Build a Shortcuts link that runs a shortcut by name (Apple's documented URL format). */
  const shortcutURL = (name) => "shortcuts://run-shortcut?name=" + encodeURIComponent(String(name || "").trim());

  /* Web search URL for the search bar. */
  const searchURL = (q) => {
    const e = encodeURIComponent(q);
    const engine = H.S()?.prefs?.search || "google";
    return engine === "naver" ? `https://m.search.naver.com/search.naver?query=${e}` : engine === "duckduckgo" ? `https://duckduckgo.com/?q=${e}` : `https://www.google.com/search?q=${e}`;
  };

  H.launch = { app: launchApp, url: openURL, web: openWeb, shortcutURL, searchURL };
})();
