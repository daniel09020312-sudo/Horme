/* Ὁρμή 아이콘 팩 생성기 — app-icon-pack/ 에 앱별 SVG·PNG(512)를 만들어요.
   iPad/iPhone 단축어 앱으로 실제 홈 화면 아이콘을 바꿀 때 쓸 수 있어요.
   사용법: node tools/make-icon-pack.js   (PNG를 만들려면 npm i sharp 필요) */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "public");
const ctx = { window: {} };
ctx.window.H = {};
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
ctx.navigator = { userAgent: "", maxTouchPoints: 0 };
ctx.location = { search: "" };
ctx.URLSearchParams = URLSearchParams;
ctx.EventTarget = EventTarget;
ctx.CustomEvent = class extends Event { constructor(t, o) { super(t); this.detail = o?.detail; } };
ctx.matchMedia = () => ({ matches: false });
ctx.addEventListener = () => {};
ctx.window.addEventListener = () => {};
load("js/core/util.js");
load("js/core/glyphs.js");
load("js/core/catalog.js");
const H = ctx.window.H;
const TINTS = ["#7586be", "#9dbbcb", "#ac8fc5", "#a6a9c8", "#8b96ba", "#b9aab0", "#8fb8b0"];
const hash = (s) => Array.from(s).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const out = path.join(ROOT, "app-icon-pack");
fs.mkdirSync(out, { recursive: true });
const svgFor = (app) => {
  const tint = TINTS[hash(app.id) % TINTS.length];
  const g = H.glyphs[app.glyph].replace(/fill="currentColor"/g, 'fill="#eeeef9"');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#454c63"/><stop offset=".68" stop-color="#141927"/><stop offset="1" stop-color="#0e121c"/></linearGradient>
<radialGradient id="tint" cx=".1" cy="1" r="1"><stop offset="0" stop-color="${tint}" stop-opacity=".22"/><stop offset="1" stop-color="${tint}" stop-opacity="0"/></radialGradient>
<linearGradient id="hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10" result="b"/><feColorMatrix in="b" values="0 0 0 0 .86  0 0 0 0 .82  0 0 0 0 1  0 0 0 .35 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#tint)"/><rect width="1024" height="1024" fill="url(#hl)"/>
<g transform="translate(276 276) scale(19.667)" fill="none" stroke="#eeeef9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">${g}</g>
</svg>`;
};
let sharp = null;
try { sharp = require("sharp"); } catch (e) { try { sharp = require("/opt/npm-tools/node_modules/sharp"); } catch (e2) {} }
(async () => {
  const csv = ["앱 ID,앱 이름,파일명 예시,카테고리"];
  for (const app of [...H.DEFAULT_APPS, ...H.EXTRA_APPS]) {
    const svg = svgFor(app);
    fs.writeFileSync(path.join(out, app.id + ".svg"), svg);
    if (sharp) await sharp(Buffer.from(svg)).resize(512, 512).png({ compressionLevel: 9, effort: 10 }).toFile(path.join(out, app.id + ".png"));
    csv.push(`${app.id},${app.name},${app.id}.png,${app.category}`);
  }
  fs.writeFileSync(path.join(ROOT, "design-templates", "아이콘_파일명_목록.csv"), "﻿" + csv.join("\n") + "\n");
  console.log(`아이콘 ${H.DEFAULT_APPS.length + H.EXTRA_APPS.length}개 생성${sharp ? " (SVG + PNG)" : " (SVG만 — PNG는 sharp 설치 후)"}`);
})();
