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
- Motion: anything that follows a finger uses `H.fx.spring` (velocity-preserving, interruptible); CSS transitions use the generated curves `var(--ease-pop|sheet|snap)` with `var(--pop-ms|sheet-ms|snap-ms)`. Page settles after release are precomputed and played with Web Animations (`H.fx.settle`, compositor-driven): during a swipe only transforms change — no canvas redraws, saves or class toggles on `body`. While interacting elsewhere, call `H.bg.boost(ms)` instead of running your own animation loop. Respect `H.reducedMotion()` and `prefs.fx`.
- Home-screen edits that touch several items go through `H.home.mutate.*` (detach / remove / del / toPage / toDock / group). They edit a state object directly; `home.*Keys` wrap them in a commit with undo, and `drag.js` uses them inside its own snapshot undo step. `commit` sanitizes afterwards, so emptied folders and widgets without a page disappear on their own.
- iPad touch: never replace the element under a finger mid-gesture (toggle classes/badges in place); the drag session captures the pointer on `<body>`. A second finger during a drag adds icons to the stack (`addByTap`).
- Category stages (`js/launcher/stages.js`) animate only while open; anything continuous there must stop in saver mode / motion off.
- Design packs (`js/core/pack.js`): app matching = device apps → catalog (`H.CATALOG()`) → new shortcut. Keep the AI prompt (`pack.prompt`) and the documented format in `시작하기.html#pack` in sync.
- App ids from v1 must stay resolvable (`H.V1_APPS`). The starting set is the owner's own apps (`H.DEFAULT_APPS`, 23 apps) arranged by `H.DEFAULT_LAYOUT` (page items may be `{ folder, apps }`); every other app stays addable via `H.EXTRA_APPS`. Only add an app URL scheme to the catalog when it is documented — a wrong scheme shows an iOS error alert.
- UI text is Korean, friendly 해요체. Keep touch targets ≥ 44px.
- Never commit personal data (real names, contact info, private URLs).
