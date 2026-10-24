# Ὁρμή (HORMĒ) 2.3 — Custom Launcher

iPad · iPhone · Android에서 쓰는 맞춤 홈 화면 **웹 앱(PWA)**.
움직이는 배경, 위젯 13종, 폴더, 앱 보관함, 초성 검색, 디자인 스튜디오, 디자인 팩(파일·AI 답 하나로 한 번에)을 갖췄어요.
기본 앱 구성(처음 열 때·모두 초기화)은 `js/core/catalog.js`의 `H.DEFAULT_APPS` / `H.DEFAULT_LAYOUT`(폴더 포함)에 있어요.
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

## 여러 개 다루기 · 카테고리 화면 (2.3)
- **묶음 끌기**: 아이콘을 끄는 동안 다른 손가락으로 누른 아이콘이 묶음에 더해지고(`drag.js` `stackAdd`), 놓은 자리 뒤에 순서대로 놓여요(`placeExtras`).
- **선택 모드**: 편집 모드 → 선택. 옮기기(쪽·새 페이지·Dock) · 폴더로 묶기 · 홈에서 빼기 · 삭제. 상태 변경은 `H.home.mutate.*`(state를 직접 고치는 함수) 하나로 모아 드래그와 툴바가 같이 써요.
- **삭제 칸**: 끄는 동안 위쪽에 `홈에서 빼기` / `삭제` 칸. 놓으면 묶음 전체에 적용, 되돌리기 가능.
- **빈 페이지**: 편집 모드에서 바로 지우기, 편집을 마치면 자동 정리(`home.pruneEmptyPages`).
- **카테고리 화면**(`js/launcher/stages.js`, `css/stages.css`): 보관함의 카테고리를 누르면 열려요. 조각(무작위 직선 분할) · 다이얼 · 궤도 · 물감(부드러운 충돌) · 카드 · 키보드 · 스위치 · 지도 · 목록. 카테고리별 선택은 `prefs.stages`에 저장. 화면이 열려 있는 동안만 움직이고, 물감은 절전·동작 끔에서 멈춰 있다가 건드릴 때만 계산해요.
- **넘기기**: 손을 뗀 뒤 스프링을 미리 계산해 Web Animations로 재생(`fx.settle`) — 합성 단계가 그리므로 JS가 바빠도 끊기지 않아요. 넘기는 동안 배경 캔버스를 다시 그리지 않고, 저장·접근성 갱신은 멈춘 뒤에 해요.

## 조작감 · 효과 (2.2)
- 페이지·드래그 고스트는 하나의 스프링 적분기(`js/launcher/fx.js`)로 움직여요: 손가락 속도 이어받기, 러버밴드, 움직이는 중에 다시 잡기.
- 아이콘·창·폴더·메뉴의 CSS 전환은 같은 물리로 만든 `linear()` 곡선(`--ease-pop`, `--ease-sheet`, `--ease-snap`)을 써요.
- 효과: 젤리·깊이·큐브 페이지 넘김, 아이콘 기울기 + 빛 반사, 트랙패드 호버, 앱 열기 팝, 손끝 물결·입자 밀어내기, 배경 시차, Dock 확대.
- 손가락이 닿아 있는 동안만 배경을 화면 주사율로 그리고(boost), 놓으면 전원 모드의 속도로 돌아가요.

## 디자인 팩 (2.2)
`js/core/pack.js`. zip(pack.json + 이미지) · pack.json(SVG/data URL 포함) · 이름 맞춘 파일 여러 개 · AI 답 붙여넣기를 모두 받아요.
아이콘 이름으로 앱을 찾고(기기 → 카탈로그 → 새 바로가기), `"layout": "replace"`면 홈 화면을 팩의 앱 순서대로 다시 구성해요.
형식과 예시는 `public/시작하기.html#pack`, `public/design-templates/example-design-pack.json`.

## 배터리 (2.1)
설정 → 배터리. 자세한 설명은 시작하기 → ‘배터리 아끼기’.

| 모드 | 배경 | 흐림 효과 | 그 밖에 |
| --- | --- | --- | --- |
| 절전 | 멈춘 한 장면 | 끔 | 초·초침·사진 넘김 쉼, 영상 정지, 날씨 90분 |
| 기본 | 20fps(만지는 동안 주사율), 해상도 1배 | 기본 배경에서는 계산 안 함(glass-lite) | |
| 부드럽게 | 주사율 그대로, 해상도 1.5배, 색 번짐 움직임 | 켬 | 깜빡임 등 모든 효과 |

- **자동**: 배터리 20% 이하·저전력 모드(rAF 30fps로 감지)·데이터 절약 → 절전 / 충전 중 → 부드럽게 / 그 밖에 기본.
- **완전한 검정 배경**(OLED), 시트·폴더·검색·스탠바이가 덮을 때 배경 정지.
- 타이머는 폴링하지 않아요: 시계는 필요할 때만 1초, 아니면 1분에 한 번 깨어나요.

테스트 브라우저(1180×820, DPR 2, 기본 배경, 손대지 않은 상태)에서 잰 Chromium 전체 CPU:

| | 2.0 | 2.1 | 2.2 |
| --- | --- | --- | --- |
| 기본 배경 · 기본 모드 | 약 130% | 약 20% (12fps) | 약 35% (20fps, 위젯 막대 부드럽게) |
| 기본 배경 · 절전 | — | 약 0.2% | 약 0.1% |
| 사진 + 입자 · 기본 모드 | 약 106% | 약 33% | — |

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
  css/   base.css(공통) launcher.css widgets.css stages.css studio.css
  js/core/     util(+ iPad 화면 크기 복구) · glyphs · catalog(앱 목록·테마) · schema(데이터 검사·이전) · store(저장·실행 취소)
               assets(IndexedDB 미디어) · ui(시트·메뉴·알림) · theme · power(전원 모드·자동 절전)
               launch(앱/웹 열기) · backup(zip 백업) · pack(디자인 팩·AI 프롬프트)
  js/widgets/  types(위젯 13종) · editor(위젯 편집·추가) · weather(Open-Meteo)
  js/launcher/ home(페이지·Dock·메뉴·선택·여러 개 처리·시계 깨우기) · fx(스프링·효과) · pager(스프링 넘기기)
               drag(드래그·묶음·폴더·삭제 칸) · folders · library(보관함·빠른 검색) · stages(카테고리 화면)
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
