/* Ὁρμή launcher — folder overlay (open, rename, reorder inside, drag out). */
(() => {
  "use strict";
  const H = window.H;
  const S = () => H.store.state;
  const folders = { openId: null };
  let layer = null;

  folders.render = () => {
    if (!layer || !folders.openId) return;
    const f = S().folders[folders.openId];
    if (!f) return folders.close();
    const name = layer.querySelector(".folder-name");
    if (document.activeElement !== name) name.value = f.name;
    name.readOnly = !H.home.editing;
    layer.querySelector(".folder-grid").innerHTML = f.apps.map((id) => S().apps[id]).filter(Boolean).map((a) => H.home.appTile(a, "folder")).join("");
    layer.classList.toggle("editing", H.home.editing);
  };

  folders.open = (id, fromTile) => {
    const f = S().folders[id];
    if (!f) return;
    folders.close(true);
    folders.openId = id;
    layer = H.h(`<div class="folder-layer" role="dialog" aria-modal="true" aria-label="${H.esc(f.name)} 폴더">
      <div class="folder-backdrop"></div>
      <div class="folder-panel"><input class="folder-name" maxlength="30" aria-label="폴더 이름" enterkeyhint="done">
      <div class="grid folder-grid" data-container="folder:${H.esc(id)}"></div>
      <p class="folder-hint">${H.home.editing ? "앱을 끌어 순서를 바꾸거나 바깥으로 꺼낼 수 있어요." : "길게 누르면 편집할 수 있어요."}</p></div></div>`);
    document.body.append(layer);
    folders.render();
    if (fromTile && !H.reducedMotion()) {
      const r = fromTile.querySelector(".icon").getBoundingClientRect();
      const panel = layer.querySelector(".folder-panel");
      const pr = panel.getBoundingClientRect();
      panel.style.transformOrigin = `${r.left + r.width / 2 - pr.left}px ${r.top + r.height / 2 - pr.top}px`;
    }
    requestAnimationFrame(() => layer?.classList.add("open"));
    document.body.classList.add("folder-open");
    layer.querySelector(".folder-backdrop").addEventListener("click", () => folders.close());
    const name = layer.querySelector(".folder-name");
    name.addEventListener("change", () => {
      const v = name.value.trim();
      if (v && S().folders[id]) H.store.commit((s) => (s.folders[id].name = v.slice(0, 30)), { label: "폴더 이름 변경" });
    });
    name.addEventListener("keydown", (e) => e.key === "Enter" && name.blur());
  };

  folders.close = (instant = false) => {
    if (!layer) return;
    const l = layer;
    layer = null;
    folders.openId = null;
    l.classList.remove("open");
    document.body.classList.remove("folder-open");
    setTimeout(() => l.remove(), instant || H.reducedMotion() ? 0 : 220);
  };

  /* Take an app out of the open folder → placed right after the folder on its page. */
  folders.removeApp = (appId) => {
    const id = folders.openId || Object.values(S().folders).find((f) => f.apps.includes(appId))?.id;
    if (!id) return;
    H.store.commit((s) => {
      const f = s.folders[id];
      if (!f) return;
      f.apps = f.apps.filter((x) => x !== appId);
      const p = s.pages.find((pg) => pg.items.includes("f:" + id));
      if (p) p.items.splice(p.items.indexOf("f:" + id) + 1, 0, "a:" + appId);
    }, { label: "폴더에서 꺼내기" });
    if (!S().folders[id]) folders.close();
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && layer && !H.ui.isOpen()) folders.close();
  });

  H.folders = folders;
})();
