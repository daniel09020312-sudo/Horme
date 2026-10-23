/* Ὁρμή service worker — offline shell + update flow.
   Pages: network first (so new versions arrive), cached copy when offline.
   Static files: cached first, refreshed in the background. */
const VERSION = "horme-2.1.0-897e0b6d8f";
const SHELL = [
 "./",
 "./index.html",
 "./studio.html",
 "./시작하기.html",
 "./manifest.webmanifest",
 "./css/base.css",
 "./css/launcher.css",
 "./css/studio.css",
 "./css/widgets.css",
 "./js/core/assets.js",
 "./js/core/backup.js",
 "./js/core/catalog.js",
 "./js/core/glyphs.js",
 "./js/core/launch.js",
 "./js/core/power.js",
 "./js/core/schema.js",
 "./js/core/store.js",
 "./js/core/theme.js",
 "./js/core/ui.js",
 "./js/core/util.js",
 "./js/launcher/bg.js",
 "./js/launcher/drag.js",
 "./js/launcher/folders.js",
 "./js/launcher/home.js",
 "./js/launcher/library.js",
 "./js/launcher/main.js",
 "./js/launcher/pager.js",
 "./js/launcher/sheets.js",
 "./js/launcher/standby.js",
 "./js/studio/prompts.js",
 "./js/studio/studio.js",
 "./js/widgets/editor.js",
 "./js/widgets/types.js",
 "./js/widgets/weather.js",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/icon-maskable-512.png",
 "./icons/apple-touch-icon.png",
 "./icons/favicon-48.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" }))))),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith("horme-")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(req, { signal: ctrl.signal });
          clearTimeout(t);
          if (res.ok) {
            const c = await caches.open(VERSION);
            c.put(req, res.clone());
          }
          return res;
        } catch (err) {
          const cached = (await caches.match(req, { ignoreSearch: true })) || (await caches.match("./index.html")) || (await caches.match("./"));
          return cached || new Response("오프라인이에요.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
      })(),
    );
    return;
  }

  e.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(async (res) => {
          if (res.ok && res.type === "basic") {
            const c = await caches.open(VERSION);
            c.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(network);
        return cached;
      }
      return (await network) || new Response("", { status: 504 });
    })(),
  );
});
