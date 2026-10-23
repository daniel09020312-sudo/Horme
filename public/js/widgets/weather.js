/* Ὁρμή — weather data via Open-Meteo (free, no API key). Cached for 30 minutes (90 in power saver); last result is
   kept for offline use. */
(() => {
  "use strict";
  const H = window.H;
  const KEY = "horme-weather-cache";
  const TTL = 30 * 60 * 1000;
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch (e) {
    cache = {};
  }
  const inflight = new Map();
  const errors = new Map();
  const id = (p) => `${(+p.lat).toFixed(3)},${(+p.lon).toFixed(3)}`;
  const persist = H.debounce(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {}
  }, 500);

  async function fetchPlace(p) {
    const k = id(p);
    if (inflight.has(k)) return inflight.get(k);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;
    const job = fetch(url, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        if (!data?.current || !data?.daily) throw Error("bad data");
        cache[k] = { t: Date.now(), data };
        errors.delete(k);
        persist();
        H.emit("weather", k);
        return data;
      })
      .catch((e) => {
        errors.set(k, Date.now());
        H.emit("weather", k);
        throw e;
      })
      .finally(() => inflight.delete(k));
    inflight.set(k, job);
    return job;
  }

  H.weather = {
    /* Synchronous read for rendering; schedules a refresh when stale. */
    peek(p) {
      if (!p) return null;
      const k = id(p);
      const c = cache[k];
      const lastErr = errors.get(k) || 0;
      // fewer network wake-ups in power saver: refresh every 90 minutes instead of 30
      const ttl = H.power?.saver() ? 3 * TTL : TTL;
      if ((!c || Date.now() - c.t > ttl) && !inflight.has(k) && !document.hidden && Date.now() - lastErr > 60000)
        fetchPlace(p).catch(() => {});
      if (!c) return null;
      const stale = Date.now() - c.t > 4 * TTL;
      return { ...c.data, stale };
    },
    error: (p) => p && errors.has(id(p)) && !cache[id(p)],
    refresh: (p) => fetchPlace(p),
    async search(q) {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=ko&format=json`);
      if (!r.ok) throw Error("검색 실패");
      const d = await r.json();
      return (d.results || []).map((x) => ({
        name: x.name,
        detail: [x.admin1, x.country].filter(Boolean).join(", "),
        lat: x.latitude,
        lon: x.longitude,
      }));
    },
    locate() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          H.ui.toast("이 기기에서는 위치를 사용할 수 없어요.");
          return resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ name: "현재 위치", lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) }),
          () => {
            H.ui.toast("위치 권한이 없어요. 편집에서 도시를 검색해 주세요.");
            resolve(null);
          },
          { timeout: 12000, maximumAge: 30 * 60 * 1000 },
        );
      });
    },
  };
})();
