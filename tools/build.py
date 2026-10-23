#!/usr/bin/env python3
"""Ὁρμή 배포 준비 스크립트.
코드를 고친 뒤 실행하면 public/sw.js(오프라인 캐시 목록 + 버전)를 다시 만들어요.
사용법:  python3 tools/build.py
"""
import hashlib, json, pathlib

TOOLS = pathlib.Path(__file__).resolve().parent
ROOT = TOOLS.parent / "public"   # 배포되는 사이트 폴더
SHELL_GLOBS = ["index.html", "studio.html", "시작하기.html", "manifest.webmanifest",
               "css/*.css", "js/**/*.js",
               "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
               "icons/apple-touch-icon.png", "icons/favicon-48.png"]

files = []
for g in SHELL_GLOBS:
    for p in sorted(ROOT.glob(g)):
        if p.is_file():
            files.append(p)
h = hashlib.sha256()
for p in files:
    h.update(p.relative_to(ROOT).as_posix().encode())
    h.update(p.read_bytes())
digest = h.hexdigest()[:10]
urls = ["./"] + ["./" + p.relative_to(ROOT).as_posix() for p in files]
tpl = (TOOLS / "sw.template.js").read_text(encoding="utf-8")
out = tpl.replace("__HASH__", digest).replace("__FILES__", json.dumps(urls, ensure_ascii=False, indent=1))
(ROOT / "sw.js").write_text(out, encoding="utf-8")
print(f"public/sw.js 생성 완료 · 버전 {digest} · 캐시 파일 {len(urls)}개")
