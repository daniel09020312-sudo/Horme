/* Ὁρμή — media storage in IndexedDB (Blobs, not base64) + image processing.
   A manifest of stored assets lives in state.assets: { key: {type,size,t,name} }.
   Blobs are saved under "key@t" so undo can bring an older image back; unused versions are cleaned on start-up. */
(() => {
  "use strict";
  const H = window.H;
  const DB = "horme-assets";
  const STORE = "blobs";
  let dbp = null;
  const cache = new Map(); // key -> {t, url}

  function open() {
    if (!("indexedDB" in window)) return Promise.reject(Error("이 브라우저는 미디어 저장소(IndexedDB)를 지원하지 않아요."));
    if (!dbp)
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => {
          const db = r.result;
          db.onversionchange = () => db.close();
          res(db);
        };
        r.onerror = () => rej(r.error || Error("미디어 저장소를 열지 못했어요."));
        r.onblocked = () => rej(Error("다른 창이 저장소를 사용 중이에요. 다른 Ὁρμή 창을 닫고 다시 시도해 주세요."));
      }).catch((e) => {
        dbp = null;
        throw e;
      });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(
      (db) =>
        new Promise((res, rej) => {
          const t = db.transaction(STORE, mode);
          const st = t.objectStore(STORE);
          let out;
          const r = fn(st);
          if (r) r.onsuccess = () => (out = r.result);
          t.oncomplete = () => res(out);
          t.onerror = () => rej(t.error || Error("저장소 작업 실패"));
          t.onabort = () => rej(t.error || Error("저장 공간이 부족하거나 작업이 취소됐어요."));
        }),
    );
  }
  const idbPut = (k, v) => tx("readwrite", (st) => st.put(v, k));
  const idbGet = (k) => tx("readonly", (st) => st.get(k));
  const idbDel = (k) => tx("readwrite", (st) => st.delete(k));
  const idbKeys = () => tx("readonly", (st) => st.getAllKeys());

  const manifest = () => H.store?.state?.assets || {};
  const verKey = (key, t) => `${key}@${t}`;

  const assets = {
    has: (key) => !!manifest()[key],
    meta: (key) => manifest()[key] || null,

    async put(key, blob, { name = "", silent = false } = {}) {
      if (!H.schema.ASSET_RE.test(key)) throw Error("잘못된 저장 키");
      if (!(blob instanceof Blob)) throw Error("파일을 읽지 못했어요.");
      const t = Date.now();
      await idbPut(verKey(key, t), blob);
      H.store.state.assets[key] = { type: blob.type || "application/octet-stream", size: blob.size, t, name: String(name).slice(0, 120) };
      H.store.save(true);
      assets.persist();
      if (!silent) {
        H.store.broadcastAssets([key]);
        H.emit("assets", [key]);
      }
      return key;
    },

    async putDataURL(key, dataURL, opts) {
      return assets.put(key, dataURLToBlob(dataURL), opts);
    },

    async get(key) {
      const m = manifest()[key];
      if (!m) return null;
      let b = await idbGet(verKey(key, m.t)).catch(() => null);
      if (!b) b = await idbGet(key).catch(() => null); // legacy plain key
      return b || null;
    },

    /* Removing only edits the manifest; the blob stays until clean-up so undo still works. */
    remove(key, { silent = false } = {}) {
      if (!manifest()[key]) return;
      delete H.store.state.assets[key];
      H.store.save(true);
      const c = cache.get(key);
      if (c) {
        URL.revokeObjectURL(c.url);
        cache.delete(key);
      }
      if (!silent) {
        H.store.broadcastAssets([key]);
        H.emit("assets", [key]);
      }
    },

    urlSync(key) {
      const m = manifest()[key];
      const c = cache.get(key);
      return m && c && c.t === m.t ? c.url : null;
    },
    async url(key) {
      const m = manifest()[key];
      if (!m) return null;
      const c = cache.get(key);
      if (c && c.t === m.t) return c.url;
      const blob = await assets.get(key);
      if (!blob) return null;
      if (c) URL.revokeObjectURL(c.url);
      const url = URL.createObjectURL(blob);
      cache.set(key, { t: m.t, url });
      return url;
    },
    /* Load object URLs for many keys (with a time limit so start-up never hangs). */
    async preload(keys, ms = 1500) {
      const list = (keys || Object.keys(manifest())).filter((k) => !k.startsWith("bg:video"));
      await Promise.race([Promise.all(list.map((k) => assets.url(k).catch(() => null))), H.sleep(ms)]);
    },
    invalidate(keys) {
      (keys || []).forEach((k) => {
        const c = cache.get(k);
        if (c) URL.revokeObjectURL(c.url);
        cache.delete(k);
      });
    },

    /* Delete blob versions nobody references. Reads the freshest saved manifest and never touches
       anything written in the last 10 minutes (another open page may have just saved it). */
    async gc() {
      try {
        let m = manifest();
        try {
          const saved = JSON.parse(localStorage.getItem(H.schema.KEY) || "null");
          if (saved?.assets) m = { ...saved.assets, ...m };
        } catch (e) {}
        const keep = new Set(Object.entries(m).map(([k, x]) => verKey(k, x.t)));
        const all = await idbKeys();
        const now = Date.now();
        for (const k of all) {
          if (typeof k !== "string" || keep.has(k) || m[k]) continue;
          const t = Number(k.split("@").pop());
          if (Number.isFinite(t) && now - t < 10 * 60 * 1000) continue;
          await idbDel(k);
        }
      } catch (e) {}
    },

    async usage() {
      const m = manifest();
      const own = Object.values(m).reduce((n, x) => n + (x.size || 0), 0);
      let est = null;
      try {
        est = await navigator.storage?.estimate?.();
      } catch (e) {}
      return { own, count: Object.keys(m).length, quota: est?.quota || 0, usage: est?.usage || 0 };
    },
    async persist() {
      try {
        if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist();
      } catch (e) {}
    },

    /* Move the v1 background video (layer-home-media-v1) into this store. */
    async migrateLegacyVideo(name) {
      if (!("indexedDB" in window)) return;
      const old = await new Promise((res) => {
        const r = indexedDB.open("layer-home-media-v1", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("assets");
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      });
      if (!old) return;
      const blob = await new Promise((res) => {
        try {
          const t = old.transaction("assets", "readonly").objectStore("assets").get("wallpaper-video");
          t.onsuccess = () => res(t.result || null);
          t.onerror = () => res(null);
        } catch (e) {
          res(null);
        }
      });
      old.close();
      if (blob) {
        await assets.put("bg:video", blob, { name: name || "background", silent: true });
        try {
          indexedDB.deleteDatabase("layer-home-media-v1");
        } catch (e) {}
      }
    },
  };

  function dataURLToBlob(d) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(d || "");
    if (!m) throw Error("잘못된 이미지 데이터");
    const type = m[1] || "application/octet-stream";
    if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
    const bin = atob(m[3]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }
  assets.dataURLToBlob = dataURLToBlob;
  assets.blobToDataURL = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });

  /* ---------- image processing ---------- */
  const LIMITS = { icon: 512, wallpaper: 2732, widget: 1600 };

  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file);
      } catch (e) {
        /* fall through to <img> (e.g. HEIC in Safari, SVG) */
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } catch (e) {
      throw Error("이 이미지를 열 수 없어요. JPG·PNG·WEBP로 저장해서 다시 시도해 주세요.");
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }
  const dims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];
  const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob((b) => res(b), type, q));

  function hasAlpha(ctx, w, h) {
    try {
      const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [0, h >> 1], [w - 1, h >> 1], [w >> 1, h - 1]];
      return pts.some(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 250);
    } catch (e) {
      return true;
    }
  }

  /* Returns a compact Blob. Safari cannot encode WebP from canvas, so JPEG/PNG are used there. */
  assets.processImage = async (file, kind = "wallpaper") => {
    if (!file) throw Error("파일을 선택해 주세요.");
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|avif|heic|heif|bmp|svg)$/i.test(file.name || ""))
      throw Error("이미지 파일을 선택해 주세요.");
    if (file.size > 40 * 1024 * 1024) throw Error("이미지가 너무 커요 (40MB 이하).");
    const max = LIMITS[kind] || 1600;
    // animated GIF / small originals are kept as they are
    if (kind !== "icon" && file.type === "image/gif") {
      if (file.size > 15 * 1024 * 1024) throw Error("GIF는 15MB 이하로 선택해 주세요.");
      return file;
    }
    const img = await decode(file);
    const [w, h] = dims(img);
    if (!w || !h) throw Error("이미지 크기를 읽지 못했어요.");
    if (kind !== "icon" && /^image\/(jpeg|webp|png)$/.test(file.type) && Math.max(w, h) <= max && file.size <= 3.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    let sx = 0, sy = 0, sw = w, sh = h, cw, ch;
    if (kind === "icon") {
      const side = Math.min(w, h);
      sx = (w - side) / 2;
      sy = (h - side) / 2;
      sw = sh = side;
      cw = ch = Math.min(max, side);
    } else {
      const scale = Math.min(1, max / Math.max(w, h));
      cw = Math.max(1, Math.round(w * scale));
      ch = Math.max(1, Math.round(h * scale));
    }
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    if (kind !== "icon") {
      // photos never need transparency → solid base lets us use compact JPEG where WebP isn't available
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    img.close?.();
    let blob = await toBlob(canvas, "image/webp", kind === "icon" ? 0.9 : 0.86);
    if (!blob || blob.type !== "image/webp") {
      const alpha = kind === "icon" && hasAlpha(ctx, cw, ch);
      blob = alpha ? await toBlob(canvas, "image/png") : await toBlob(canvas, "image/jpeg", kind === "icon" ? 0.92 : 0.86);
    }
    if (!blob) throw Error("이미지를 변환하지 못했어요.");
    return blob;
  };

  /* Video / animated image check: make sure this browser can actually decode it before saving. */
  assets.probeMedia = (file, kind) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const el = kind === "animated" ? new Image() : document.createElement("video");
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        if (el.tagName === "VIDEO") {
          el.removeAttribute("src");
          el.load?.();
        }
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 10000);
      if (kind === "animated") {
        el.onload = () => finish(true);
        el.onerror = () => finish(false);
      } else {
        el.muted = true;
        el.playsInline = true;
        el.preload = "metadata";
        el.onloadedmetadata = () => finish(true);
        el.onerror = () => finish(false);
      }
      el.src = url;
    });

  H.assets = assets;
})();
