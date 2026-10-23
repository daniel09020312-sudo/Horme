# HORME (Ὁρμή) — notes for working on this repo

- Static PWA, no build step, no dependencies. The deployed site is `public/` (Cloudflare Pages / Netlify: output dir `public`, no build command, branch `main`).
- Scripts are classic `<script defer>` files sharing `window.H`; load order is in `public/index.html` and `public/studio.html`. `js/core/power.js` must load before `js/launcher/*`.
- After changing anything under `public/`, run `python3 tools/build.py` so `public/sw.js` gets the new cache list and version hash. Bump `H.VERSION` in `js/core/util.js` and the prefix in `tools/sw.template.js` for releases.
- State: `localStorage["horme-state-v2"]` (sanitized by `js/core/schema.js` — every new field needs a default + sanitize rule there). Media blobs: IndexedDB `horme-assets`.
- Battery rules (keep them when adding features):
  - No `setInterval` polling and no permanent `requestAnimationFrame` loops. Wake up only when something visible changes (`home.nextTickIn`, standby `schedule`).
  - Anything that moves checks `H.power.motion()` / `H.power.animate()` and listens to the `power` and `motion-state` events; it must stop when the page is hidden.
  - Infinite CSS animations only behind `body[data-power="smooth"]` (or drive them from the background loop like `.wave-bars`).
  - New glass panels with `backdrop-filter` over the home screen go into the `glass-lite` CSS list and the `GLASS` selector in `js/launcher/bg.js`.
- UI text is Korean, friendly 해요체. Keep touch targets ≥ 44px.
- Never commit personal data (real names, contact info, private URLs).
