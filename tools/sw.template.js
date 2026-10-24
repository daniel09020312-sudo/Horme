/* Ὁρμή service worker — offline shell + update flow.
   Pages: network first (so new versions arrive), cached copy when offline.
   Static files: cached first, refreshed in the background. */
const VERSION = "horme-2.3.0-__HASH__";
const SHELL = __FILES__;

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
