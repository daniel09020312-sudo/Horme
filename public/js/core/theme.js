/* Ὁρμή — apply theme tokens from state to the document (launcher and studio share this). */
(() => {
  "use strict";
  const H = window.H;
  H.applyTheme = (state = H.store.state) => {
    const t = state.theme;
    const p = H.THEMES[t.preset] || H.THEMES.graphite;
    const root = document.documentElement;
    const css = root.style;
    css.setProperty("--accent", t.accent || p.accent);
    css.setProperty("--accent2", t.accent2 || p.accent2);
    css.setProperty("--glow1", p.glow1);
    css.setProperty("--glow2", p.glow2);
    css.setProperty("--base", p.base);
    css.setProperty("--radius", t.iconRadius + "%");
    const b = document.body;
    if (!b) return;
    b.dataset.theme = t.preset;
    b.dataset.dock = t.dock;
    b.dataset.spacing = t.spacing;
    b.dataset.labels = t.labels ? "on" : "off";
    b.dataset.clock = t.clockFont;
    b.dataset.wstyle = t.widgetStyle;
    b.dataset.gtint = t.glyphTint;
    b.dataset.isize = t.iconSize;
    b.dataset.motion = state.motion.on && !H.reducedMotion() ? "on" : "off";
    const oled = !!state.prefs?.oled;
    b.classList.toggle("oled", oled);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", oled ? "#000000" : p.base);
  };
})();
