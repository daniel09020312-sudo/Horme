# Ὁρμή — 브랜드 가이드

- **공식 이름:** Ὁρμή (고대 그리스어 ‘움직임을 이끄는 힘’) · 영문 HORMĒ / HORME · 한글 호르메
- **설명:** Custom Interface & Launcher · 편집기 이름: Ὁρμή Studio
- **기본 로고:** 03 ETA 정교화 최종본 — 그리스 문자 η를 유리·금속이 겹친 입체로 표현
- **색:** 그라파이트 블랙 `#07090d`, 실버 `#d6dbe4`, 저채도 블루그레이 `#8d9db3` (앱의 기본 테마 GRAPHITE)
- **글꼴:** 시스템 글꼴(SF Pro / Apple SD Gothic Neo), 시계는 얇은 굵기(200)

## 로고 8종
| 번호 | 이름 | 컨셉 |
|---|---|---|
| 01 | VECTOR | 방향과 전진 |
| 02 | FOLD | 접힌 두 패널 |
| 03 | ETA | 그리스 문자 η — **기본** (`public/icons/ETA_원본_1254.png`) |
| 04 | IMPULSE | 추진력과 가속 |
| 05 | RIBBON | 엇갈리는 두 움직임 |
| 06 | AXIS | 축과 연결 |
| 07 | SHIFT | 이동하는 레이어 |
| 08 | MONOGRAM | Η · Μ |

`logos.html`에서 모두 보고 PNG·SVG로 내려받을 수 있어요.

## 설치 아이콘
| 파일 | 용도 |
|---|---|
| `public/icons/apple-touch-icon.png` (180) | iPad · iPhone 홈 화면 |
| `public/icons/icon-192.png`, `icon-512.png` | PWA 설치 아이콘 |
| `public/icons/icon-maskable-512.png` | Android 둥근·물방울 모양 마스크용 (가운데 80% 안전 영역) |
| `public/icons/icon-1024.png` | 고해상도 원본 |
| `public/icons/favicon-48.png` | 브라우저 탭 |

2.0부터 η 아이콘은 원본 이미지에 그려져 있던 둥근 테두리를 잘라낸 **가장자리까지 꽉 찬 버전**을 써요. iOS가 모서리를 직접 둥글게 자르기 때문에, 예전처럼 테두리가 이중으로 보이지 않아요.

## 로고 바꾸기
```bash
pip install pillow
python3 tools/change-logo.py        # η ETA 기본
python3 tools/change-logo.py 05     # 05 RIBBON 등 다른 시안
python3 tools/change-logo.py 내로고.png
python3 tools/build.py              # 캐시 버전 갱신
```
다시 배포한 뒤 홈 화면의 기존 아이콘을 지우고 다시 추가하세요.

## 앱 아이콘 스타일
- 그라파이트 유리 타일 + 한 줄 두께(1.5)의 둥근 선 기호, 은은한 보랏빛 발광
- 기호는 회사 로고가 아닌 일반 기호(예: Discord → 게임패드, Notion → 블록 문서)
- `app-icon-pack/`에 PNG(512)·SVG로 70개. `node tools/make-icon-pack.js`로 다시 만들 수 있어요.

## 예전 데이터와의 호환
- 예전 저장 키 `prism-state-v1`, 영상 DB `layer-home-media-v1`은 처음 실행 때 새 형식으로 자동 이전돼요.
- 예전 ‘설정 내보내기’ JSON과 `PRISM_DESIGN` · `LAYER_HOME_DESIGN` · `KINET_HOME_DESIGN` · `HORME_INTERFACE_DESIGN` 디자인 파일도 불러올 수 있어요.
