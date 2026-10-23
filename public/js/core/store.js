/* Ὁρμή — state store: small JSON settings in localStorage, undo history, cross-page sync.
   Images and videos never go into localStorage (see assets.js). */
(() => {
  "use strict";
  const H = window.H;
  const KEY = H.schema.KEY;
  const docId = H.uid("d");
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("horme-sync") : null;

  const store = {
    state: null,
    undoStack: [],
    migrated: false,
    recovered: false,
    lastSaveError: null,
  };

  function readRaw() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function write() {
    try {
      store.state.updatedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(store.state));
      store.lastSaveError = null;
      channel?.postMessage({ type: "state", from: docId });
      return true;
    } catch (e) {
      store.lastSaveError = e;
      H.emit("save-error", e);
      return false;
    }
  }
  const scheduled = H.debounce(write, 180);
  store.save = (now = false) => (now ? scheduled.flush() : scheduled());
  store.flush = () => scheduled.flush();

  /* Load (and migrate if needed). Never throws: falls back to defaults and keeps the broken copy. */
  store.init = async () => {
    const raw = readRaw();
    if (raw) {
      try {
        store.state = H.schema.sanitize(JSON.parse(raw));
      } catch (e) {
        try {
          localStorage.setItem("horme-state-corrupt", raw);
        } catch (_) {}
        store.state = H.schema.defaults();
        store.recovered = true;
      }
      return store.state;
    }
    let v1 = null;
    try {
      v1 = JSON.parse(localStorage.getItem(H.schema.V1_KEY) || "null");
    } catch (e) {
      v1 = null;
    }
    if (v1 && Array.isArray(v1.apps)) {
      const res = H.schema.fromV1(v1);
      store.state = H.schema.sanitize(res.state);
      try {
        for (const a of res.assets) await H.assets.putDataURL(a.key, a.dataURL, { silent: true });
        if (res.legacyVideo) await H.assets.migrateLegacyVideo(res.legacyVideoName);
      } catch (e) {
        /* keep going; images that failed are simply not restored */
      }
      if (write()) {
        try {
          localStorage.setItem("horme-v1-backup", JSON.stringify({ apps: v1.apps.map(({ customImage, ...a }) => a), migratedAt: Date.now() }));
          localStorage.removeItem(H.schema.V1_KEY);
        } catch (e) {}
      }
      store.migrated = true;
      return store.state;
    }
    store.state = H.schema.defaults();
    write();
    return store.state;
  };

  /* Apply a change. opts.undo (default true) records an undo point; opts.label is shown on the undo chip. */
  store.commit = (fn, opts = {}) => {
    const before = opts.undo === false ? null : JSON.stringify(store.state);
    try {
      fn(store.state);
    } catch (e) {
      console.error(e);
      if (before) store.state = JSON.parse(before);
      H.emit("toast", "변경을 적용하지 못했어요.");
      return false;
    }
    if (opts.sanitize !== false) store.state = H.schema.sanitize(store.state);
    if (before) {
      store.undoStack.push({ json: before, label: opts.label || "" });
      if (store.undoStack.length > 40) store.undoStack.shift();
    }
    store.save(opts.now);
    H.emit("change", { label: opts.label || "", undoable: !!before, scope: opts.scope || "all", quiet: !!opts.quiet });
    return true;
  };

  store.undo = () => {
    const last = store.undoStack.pop();
    if (!last) return false;
    store.state = H.schema.sanitize(JSON.parse(last.json));
    store.save(true);
    H.emit("change", { label: "undo", undoable: false, scope: "all" });
    return last.label || true;
  };

  /* For multi-step edits (e.g. a widget editor): take a snapshot first, push it once at the end. */
  store.snapshot = () => JSON.stringify(store.state);
  store.pushUndo = (json, label = "") => {
    if (!json || json === JSON.stringify(store.state)) return false;
    store.undoStack.push({ json, label });
    if (store.undoStack.length > 40) store.undoStack.shift();
    return true;
  };

  store.replace = (next, opts = {}) => {
    const before = JSON.stringify(store.state);
    store.state = H.schema.sanitize(next);
    if (opts.undo !== false) store.undoStack.push({ json: before, label: opts.label || "가져오기" });
    store.save(true);
    H.emit("change", { label: opts.label || "replace", undoable: opts.undo !== false, scope: "all" });
  };

  /* Updates from another page (studio ⇄ launcher, other tabs). */
  function reloadFromStorage() {
    const raw = readRaw();
    if (!raw) return;
    try {
      store.state = H.schema.sanitize(JSON.parse(raw));
      store.undoStack = []; // older snapshots would undo changes made in the other window
      H.emit("change", { label: "remote", undoable: false, scope: "all", remote: true });
    } catch (e) {}
  }
  if (channel)
    channel.onmessage = (e) => {
      const m = e.data || {};
      if (m.from === docId) return;
      if (m.type === "state") reloadFromStorage();
      if (m.type === "assets") H.emit("assets-remote", m.keys || []);
    };
  else
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) reloadFromStorage();
    });
  store.broadcastAssets = (keys) => channel?.postMessage({ type: "assets", keys, from: docId });

  window.addEventListener("pagehide", () => store.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) store.flush();
  });

  H.store = store;
  H.S = () => store.state;
})();
