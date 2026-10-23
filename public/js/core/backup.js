/* Ὁρμή — backup & restore.
   Full backup = one .zip with settings (horme-backup.json) + every image/video as a real file.
   Also reads: plain settings JSON, v1 "설정 내보내기" JSON, and the old design files. */
(() => {
  "use strict";
  const H = window.H;

  /* ---------- minimal ZIP (store) writer + reader (store / deflate) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (u8) => {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  async function zipCreate(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const data = f.data instanceof Uint8Array ? f.data : typeof f.data === "string" ? enc.encode(f.data) : new Uint8Array(await f.data.arrayBuffer());
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // UTF-8 names
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
  }

  async function inflateRaw(u8) {
    if (!("DecompressionStream" in window)) throw Error("이 브라우저는 압축된 zip을 풀 수 없어요. Ὁρμή에서 만든 백업 파일을 그대로 사용해 주세요.");
    const ds = new DecompressionStream("deflate-raw");
    const out = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }

  async function zipRead(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--)
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    if (eocd < 0) throw Error("zip 파일이 아니거나 손상됐어요.");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw Error("zip 구조를 읽지 못했어요.");
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
      const lNameLen = dv.getUint16(local + 26, true);
      const lExtraLen = dv.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + csize);
      out[name] = { method, raw };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return {
      names: Object.keys(out),
      async bytes(name) {
        const f = out[name];
        if (!f) return null;
        if (f.method === 0) return f.raw;
        if (f.method === 8) return inflateRaw(f.raw);
        throw Error("지원하지 않는 압축 방식이에요.");
      },
    };
  }
  H.zip = { create: zipCreate, read: zipRead };

  /* ---------- deliver a file to the user ---------- */
  async function deliver(blob, filename) {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    // iPad/iPhone home-screen apps can't always download; the share sheet ("파일에 저장") works.
    if (H.isMobileOS && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return "shared";
      } catch (e) {
        if (e && e.name === "AbortError") return "cancel";
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "download";
  }

  const extOf = (type) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" })[type] || "bin";
  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${H.pad(d.getMonth() + 1)}${H.pad(d.getDate())}-${H.pad(d.getHours())}${H.pad(d.getMinutes())}`;
  };

  /* Full backup (zip). includeVideo=false skips the (possibly huge) background video. */
  async function exportAll({ includeVideo = true } = {}) {
    H.store.flush();
    const state = JSON.parse(JSON.stringify(H.S()));
    const files = [];
    const index = {};
    for (const [key, meta] of Object.entries(state.assets)) {
      if (key === "bg:video" && !includeVideo) {
        delete state.assets[key];
        continue;
      }
      const blob = await H.assets.get(key);
      if (!blob) {
        delete state.assets[key];
        continue;
      }
      const name = `media/${key.replace(/[:@]/g, "_")}.${extOf(meta.type)}`;
      index[key] = name;
      files.push({ name, data: blob });
    }
    const doc = { format: "HORME_BACKUP", version: 2, app: "Ὁρμή " + H.VERSION, createdAt: new Date().toISOString(), media: index, state };
    files.unshift({ name: "horme-backup.json", data: JSON.stringify(doc, null, 1) });
    files.push({ name: "README.txt", data: "Ὁρμή 전체 백업 파일입니다.\nΟρμή 설정 → 데이터 → 백업 불러오기에서 이 zip 파일을 선택하면 그대로 복원돼요.\n" });
    const zip = await zipCreate(files);
    return H.backup.deliver(zip, `Hormé-백업-${stamp()}.zip`);
  }

  async function exportSettings() {
    H.store.flush();
    const state = JSON.parse(JSON.stringify(H.S()));
    state.assets = {};
    const doc = { format: "HORME_BACKUP", version: 2, app: "Ὁρμή " + H.VERSION, createdAt: new Date().toISOString(), media: {}, state, note: "이미지·영상 제외 설정 파일" };
    return H.backup.deliver(new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" }), `Hormé-설정-${stamp()}.json`);
  }

  /* Parse any supported file → { state, media: [{key, blob}], summary, kind } (nothing is applied yet). */
  async function parse(file) {
    if (!file) throw Error("파일을 선택해 주세요.");
    if (file.size > 1.5 * 1024 * 1024 * 1024) throw Error("파일이 너무 커요.");
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    if (isZip) {
      const z = await zipRead(file);
      const jsonBytes = await z.bytes("horme-backup.json");
      if (!jsonBytes) throw Error("Ὁρμή 백업 zip이 아니에요 (horme-backup.json 없음).");
      const doc = JSON.parse(dec.decode(jsonBytes));
      if (doc.format !== "HORME_BACKUP") throw Error("Ὁρμή 백업 파일이 아니에요.");
      const state = H.schema.sanitize(doc.state);
      const media = [];
      for (const [key, name] of Object.entries(doc.media || {})) {
        if (!H.schema.ASSET_RE.test(key) || !state.assets[key]) continue;
        const bytes = await z.bytes(name);
        if (bytes) media.push({ key, blob: new Blob([bytes], { type: state.assets[key].type }), name: state.assets[key].name });
      }
      Object.keys(state.assets).forEach((k) => {
        if (!media.some((m) => m.key === k)) delete state.assets[k];
      });
      return { kind: "full", state, media };
    }
    if (file.size > 60 * 1024 * 1024) throw Error("설정 파일이 너무 커요.");
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch (e) {
      throw Error("JSON 또는 zip 파일이 아니에요.");
    }
    if (obj?.format === "HORME_BACKUP") {
      const state = H.schema.sanitize(obj.state);
      const keep = { ...H.S().assets };
      state.assets = {}; // settings-only file: keep the media already on this device
      Object.entries(keep).forEach(([k, v]) => {
        if (!k.startsWith("icon:") || state.apps[k.slice(5)]) state.assets[k] = v;
      });
      return { kind: "settings", state, media: [] };
    }
    if (Array.isArray(obj?.apps)) {
      const r = H.schema.fromV1(obj);
      return { kind: "v1", state: H.schema.sanitize(r.state), media: r.assets.map((a) => ({ key: a.key, blob: H.assets.dataURLToBlob(a.dataURL) })) };
    }
    if (["HORME_INTERFACE_DESIGN", "KINET_HOME_DESIGN", "LAYER_HOME_DESIGN", "PRISM_DESIGN"].includes(obj?.format)) {
      const r = H.schema.fromDesign(obj, H.S());
      return { kind: "design", state: H.schema.sanitize(r.state), media: r.assets.map((a) => ({ key: a.key, blob: H.assets.dataURLToBlob(a.dataURL) })) };
    }
    throw Error("Ὁρμή 백업·설정·디자인 파일이 아니에요.");
  }

  function summary(p) {
    const s = p.state;
    const kinds = { full: "전체 백업", settings: "설정 파일", v1: "이전 버전 설정", design: "디자인 파일" };
    const apps = Object.keys(s.apps).length;
    const widgets = Object.keys(s.widgets).length;
    return `<b>${kinds[p.kind]}</b> · 앱 ${apps}개 · 페이지 ${s.pages.length}개 · 위젯 ${widgets}개${p.media.length ? ` · 이미지·영상 ${p.media.length}개` : ""}`;
  }

  /* Apply a parsed backup: write media first, then swap the state (undo-able). */
  async function apply(p) {
    const base = JSON.parse(JSON.stringify(p.state));
    for (const m of p.media) {
      await H.assets.put(m.key, m.blob, { name: m.name || "", silent: true });
      base.assets[m.key] = { ...H.S().assets[m.key] };
    }
    H.store.replace(base, { label: "백업 복원" });
    H.assets.invalidate(Object.keys(base.assets));
    H.store.broadcastAssets(Object.keys(base.assets));
    H.emit("assets", Object.keys(base.assets));
  }

  /* UI flow: pick file → summary → confirm → apply. */
  function importFlow() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.json,application/zip,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      let parsed;
      try {
        H.ui.toast("파일을 읽는 중…");
        parsed = await parse(f);
      } catch (e) {
        H.ui.toast(e.message || "파일을 읽지 못했어요.");
        return;
      }
      const ok = await H.ui.confirm({
        title: "백업 불러오기",
        msg: `${summary(parsed)}<br><br>${parsed.kind === "design" ? "디자인(배경·색상·아이콘 이미지)만 바뀌고 앱 배치는 유지돼요." : "지금 홈 화면 구성이 이 파일 내용으로 바뀌어요. 바로 뒤에 '되돌리기'로 취소할 수 있어요."}`,
        ok: "불러오기",
      });
      if (!ok) return;
      try {
        await apply(parsed);
        H.ui.toast("백업을 불러왔어요.", { action: { label: "되돌리기", fn: () => H.store.undo() } });
      } catch (e) {
        H.ui.toast(e.message || "불러오기에 실패했어요.");
      }
    };
    input.click();
  }

  H.backup = { exportAll, exportSettings, parse, apply, importFlow, deliver, summary };
})();
