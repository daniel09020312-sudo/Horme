#!/usr/bin/env python3
"""Ὁρμή 설치 아이콘 바꾸기.

  python3 tools/change-logo.py          → 기본 η(ETA) 최종 아이콘
  python3 tools/change-logo.py 05       → brand-logos/05_*.png 로고로 교체 (01~08)
  python3 tools/change-logo.py 내사진.png → 원하는 정사각형 이미지로 교체

필요: Python 3, Pillow (pip install pillow)
바꾼 뒤에는 tools/build.py 를 실행하고 커밋·푸시하세요(같은 주소로 다시 배포돼요).
iPad·iPhone 홈 화면의 기존 아이콘은 지우고 다시 '홈 화면에 추가'해야 바뀌어요.
"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    raise SystemExit("Pillow가 필요해요:  pip install pillow")

ROOT = Path(__file__).resolve().parent.parent / "public"
ICONS = ROOT / "icons"
arg = sys.argv[1] if len(sys.argv) > 1 else "eta"

if arg.lower() in ("eta", "final", "03-refined"):
    src = Image.open(ICONS / "ETA_원본_1254.png").convert("RGB")
    w = src.size[0]
    inset = int(w * 0.085)  # 원본에 그려진 둥근 테두리를 잘라내 가장자리까지 꽉 찬 아이콘으로
    src = src.crop((inset, inset, w - inset, w - inset))
    label = "η ETA 최종본"
elif Path(arg).is_file():
    src = Image.open(arg).convert("RGB")
    label = Path(arg).name
else:
    code = arg.zfill(2)
    found = [p for p in (ROOT / "brand-logos").glob(f"{code}_*.png") if p.name != "03_eta_refined.png"]
    if len(found) != 1:
        raise SystemExit("eta, 01~08 중 하나 또는 이미지 파일 경로를 지정해 주세요.")
    src = Image.open(found[0]).convert("RGB")
    label = found[0].name

side = min(src.size)
src = src.crop(((src.width - side) // 2, (src.height - side) // 2, (src.width + side) // 2, (src.height + side) // 2))
full = src.resize((1024, 1024), Image.LANCZOS)
for size, name in [(1024, "icon-1024.png"), (512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (48, "favicon-48.png")]:
    full.resize((size, size), Image.LANCZOS).save(ICONS / name, optimize=True)

# Android용 maskable 아이콘: 가운데 80% 안전 영역에 맞춰 축소
# 바탕은 아이콘 자체를 크게 흐린 것 → 가운데 그림과 색이 이어져 경계가 보이지 않아요
canvas = full.filter(ImageFilter.GaussianBlur(70))
inner = full.resize((800, 800), Image.LANCZOS)
mask = Image.new("L", (800, 800), 0)
ImageDraw.Draw(mask).ellipse((40, 40, 760, 760), fill=255)
canvas.paste(inner, (112, 112), mask.filter(ImageFilter.GaussianBlur(60)))
canvas.resize((512, 512), Image.LANCZOS).save(ICONS / "icon-maskable-512.png", optimize=True)

print(f"적용한 로고: {label}\n다음: python3 tools/build.py 실행 → 폴더 전체를 다시 배포 → 홈 화면 아이콘 다시 추가")
