# Ὁρμή (HORMĒ) 2.1 — Custom Launcher

iPad · iPhone · Android에서 쓰는 맞춤 홈 화면 **웹 앱(PWA)**.
움직이는 배경, 위젯 13종, 폴더, 앱 보관함, 초성 검색, 디자인 스튜디오를 갖췄어요.
기기의 진짜 홈 화면을 바꾸지는 않아요 — Ὁρμή를 열었을 때 그 안에서 동작해요.

**사용법은 [`public/시작하기.html`](public/시작하기.html)** 에 모두 있어요.

## 배포 (GitHub → Cloudflare Pages 또는 Netlify)
배포되는 사이트는 **`public/` 폴더**예요. 빌드 단계가 없어요.

| 설정 | 값 |
| --- | --- |
| Framework preset | None |
| Build command | (비움) |
| Build output / Publish directory | `public` |
| Production branch | `main` |

`main`에 푸시하면 자동으로 다시 배포돼요. 설정·사진은 **주소별로** 기기에 저장되니,
주소를 바꿀 때는 예전 주소에서 설정 → 데이터 → **전체 백업(zip)** 을 만들고 새 주소에서 **백업 불러오기** 하세요.

## 배터리 (2.1)
설정 → 배터리. 자세한 설명은 시작하기 → ‘배터리 아끼기’.

| 모드 | 배경 | 흐림 효과 | 그 밖에 |
| --- | --- | --- | --- |
| 절전 | 멈춘 한 장면 | 끔 | 초·초침·사진 넘김 쉼, 영상 정지, 날씨 90분 |
| 기본 | 12fps, 해상도 1배 | 기본 배경에서는 계산 안 함(glass-lite) | 위젯 막대도 같은 장면에 |
| 부드럽게 | 30fps, 해상도 1.5배, 색 번짐 움직임 | 켬 | 깜빡임 등 모든 효과 |

- **자동**: 배터리 20% 이하·저전력 모드(rAF 30fps로 감지)·데이터 절약 → 절전 / 충전 중 → 부드럽게 / 그 밖에 기본.
- **완전한 검정 배경**(OLED), 시트·폴더·검색·스탠바이가 덮을 때 배경 정지.
- 타이머는 폴링하지 않아요: 시계는 필요할 때만 1초, 아니면 1분에 한 번 깨어나요.

테스트 브라우저(1180×820, DPR 2, 기본 배경)에서 잰 Chromium 전체 CPU:

| | 2.0 | 2.1 |
| --- | --- | --- |
| 기본 배경 | 약 130% | 기본 약 20% · 절전 약 0.2% |
| 사진 + 입자 | 약 106% | 기본 약 33% · 절전 약 0.2% |

## 파일 구성
```
public/                  ← 배포되는 사이트
  index.html             런처
  studio.html            디자인 스튜디오 (실제 런처를 iframe으로 미리보기)
  시작하기.html            사용 설명서
  logos.html             로고 시안 8종
  manifest.webmanifest   설치 정보 · 바로가기
  sw.js                  오프라인 캐시 + 업데이트 알림 (tools/build.py가 만듦)
  _headers               sw.js 캐시 안 함 (Cloudflare Pages · Netlify)
  css/   base.css(공통) launcher.css widgets.css studio.css
  js/core/     util · glyphs · catalog(앱 목록·테마) · schema(데이터 검사·이전) · store(저장·실행 취소)
               assets(IndexedDB 미디어) · ui(시트·메뉴·알림) · theme · power(전원 모드·자동 절전)
               launch(앱/웹 열기) · backup(zip 백업)
  js/widgets/  types(위젯 13종) · editor(위젯 편집·추가) · weather(Open-Meteo)
  js/launcher/ home(페이지·Dock·메뉴·시계 깨우기) · pager · drag(드래그·폴더) · folders · library(보관함·빠른 검색)
               sheets(앱 편집·설정·페이지) · bg(배경) · standby · main(시작·단축키·업데이트)
  js/studio/   studio · prompts(AI 프롬프트)
  icons/ app-icon-pack/ brand-logos/ design-templates/
tools/                   build.py · change-logo.py · make-icon-pack.js · sw.template.js (배포 안 됨)
docs/                    브랜드 가이드 · 컨셉 보드 (배포 안 됨)
```

## 저장 방식
- 설정(앱 배치·위젯·테마·전원 모드)은 `localStorage`의 `horme-state-v2`에 작은 JSON으로.
- 사진·아이콘·영상은 `IndexedDB`(`horme-assets`)에 **원본 Blob**으로. 저장 공간 보존(persist)을 요청해요.
- 처음 실행 시 예전 `prism-state-v1`과 `layer-home-media-v1`을 자동으로 옮겨요.
- 모든 데이터는 불러올 때 `schema.sanitize()`로 검사해요 — 손상된 파일로 앱이 멈추지 않아요.

## 코드를 고쳤다면
```bash
python3 tools/build.py          # public/sw.js 캐시 목록·버전 갱신 (커밋 전 꼭 실행)
python3 tools/change-logo.py 05 # 설치 아이콘을 다른 로고로 (Pillow 필요)
node tools/make-icon-pack.js    # 아이콘 팩 다시 만들기 (sharp 필요)
python3 -m http.server 8000 --directory public   # 로컬 확인 → http://localhost:8000
```
빌드 도구 없이 그대로 동작하는 순수 HTML/CSS/JS예요. 외부 라이브러리를 쓰지 않아요.
