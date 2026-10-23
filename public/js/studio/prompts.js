/* Ὁρμή Studio — prompt templates for AI image / video generators (text only; nothing is generated here). */
(() => {
  "use strict";
  const H = window.H;

  const TYPES = [
    ["icon", "앱 아이콘 1개"],
    ["iconset", "아이콘 세트 (여러 앱)"],
    ["widget", "위젯 배경"],
    ["wall-land", "가로 배경 (태블릿)"],
    ["wall-port", "세로 배경 (휴대폰·태블릿)"],
    ["video", "움직이는 배경 영상"],
  ];
  const STYLES = {
    glass: { ko: "유리·금속 (η 로고 느낌)", en: "frosted glass and brushed metal, believable refraction, soft prismatic edge light, restrained highlights, deep graphite base", kr: "반투명 유리와 브러시드 메탈, 자연스러운 굴절, 가장자리에만 은은한 프리즘 빛, 절제된 하이라이트, 깊은 그라파이트 바탕" },
    minimal: { ko: "미니멀 그래픽", en: "editorial-grade minimalist graphic design, restrained geometry, precise line weights, generous negative space", kr: "에디토리얼 수준의 미니멀 그래픽, 절제된 기하학, 정확한 선 두께, 넉넉한 여백" },
    line: { ko: "얇은 선 아이콘", en: "single-weight monoline symbol, rounded caps, perfectly consistent stroke, optical centering", kr: "한 가지 두께의 모노라인 기호, 둥근 선 끝, 완전히 일정한 선 두께, 시각적 중앙 정렬" },
    editorial: { ko: "스위스 에디토리얼", en: "contemporary Swiss editorial art direction, meticulous alignment, paper-like matte finish", kr: "현대적인 스위스 에디토리얼 아트 디렉션, 정밀한 정렬, 종이 같은 무광 질감" },
    clay: { ko: "부드러운 3D", en: "soft matte 3D forms, subtle ambient occlusion, gentle studio lighting, no plastic gloss", kr: "부드러운 무광 3D 형태, 은은한 그림자, 스튜디오 조명, 플라스틱 광택 없음" },
    pixel: { ko: "레트로 픽셀", en: "disciplined pixel art, crisp grid, limited 8–12 colour palette, clean silhouette", kr: "정돈된 픽셀 아트, 선명한 격자, 8~12색 제한 팔레트, 깔끔한 실루엣" },
    ink: { ko: "잉크·판화", en: "Japanese ink and monoline printmaking, confident silhouettes, restrained texture", kr: "먹과 모노라인 판화, 자신감 있는 실루엣, 절제된 질감" },
    photo: { ko: "사진 같은 풍경", en: "photographic, natural light, shallow depth, quiet cinematic mood, slight film grain", kr: "사진 같은 사실감, 자연광, 얕은 심도, 조용한 영화 같은 분위기, 약한 필름 그레인" },
  };
  const COLORS = {
    theme: { ko: "지금 테마 색", en: (t) => `palette built around ${t.a} and ${t.b} on a deep charcoal ground`, kr: (t) => `${t.a}와 ${t.b}를 중심으로 한 색, 짙은 차콜 바탕` },
    graphite: { ko: "그라파이트·실버", en: "graphite black, silver and low-saturation blue-grey", kr: "그라파이트 블랙, 실버, 채도 낮은 블루그레이" },
    mono: { ko: "흑백", en: "black and ivory only, strong value contrast", kr: "검정과 아이보리만, 명암 대비 강하게" },
    pastel: { ko: "부드러운 파스텔", en: "soft low-saturation pastels with clear structure", kr: "채도 낮은 부드러운 파스텔, 구조는 또렷하게" },
    vivid: { ko: "선명한 포인트", en: "neutral dark ground with one vivid accent colour", kr: "어두운 무채색 바탕에 선명한 포인트 색 하나" },
  };

  const SPEC = {
    icon: { en: "ONE app icon artwork, square 1:1, 1024×1024 px. One clear symbol, centred, readable at 48 px, generous inner margin (keep the symbol inside the central 70%). Fill the whole square edge to edge — do NOT draw rounded corners, frames, device mockups or shadows outside the art.", kr: "앱 아이콘 1개, 정사각형 1:1, 1024×1024px. 기호는 하나만 가운데에, 48px로 작게 봐도 알아볼 수 있게, 기호는 가운데 70% 안에. 정사각형 끝까지 꽉 채우고 둥근 모서리·테두리·기기 목업·바깥 그림자는 그리지 않기." },
    iconset: { en: "a SET of app icons that share one visual system: identical background, lighting, stroke weight and corner treatment. Produce each icon as a separate square 1024×1024 image. Each icon shows one simple symbol for its app (do not copy any company logo).", kr: "같은 디자인 체계를 공유하는 앱 아이콘 세트: 배경·조명·선 두께·모서리 처리를 모두 동일하게. 아이콘마다 정사각형 1024×1024 이미지 한 장씩. 각 앱을 뜻하는 단순한 기호 하나만 (회사 로고를 따라 그리지 않기)." },
    widget: { en: "ONE background image for a home-screen widget card, 2:1 landscape, at least 1600×800 px. Keep a large calm area for text overlay; no clocks, numbers, buttons or fake UI.", kr: "홈 화면 위젯 카드용 배경 이미지 1장, 가로 2:1, 1600×800px 이상. 글자를 올릴 넓고 조용한 영역을 남기고, 시계·숫자·버튼·가짜 UI는 넣지 않기." },
    "wall-land": { en: "ONE wallpaper for a tablet launcher, landscape 4:3, 2732×2048 px or larger. App icons sit in the lower two thirds and a large clock in the upper left — keep those areas calm and low-detail; put visual interest near the edges.", kr: "태블릿 런처 배경화면 1장, 가로 4:3, 2732×2048px 이상. 아래쪽 3분의 2에 앱 아이콘, 왼쪽 위에 큰 시계가 놓이니 그 부분은 조용하고 단순하게, 시선을 끄는 요소는 가장자리 쪽에." },
    "wall-port": { en: "ONE wallpaper for a phone / tablet held upright, portrait 9:19.5 (or 3:4 for tablets), at least 1440×3120 px. Top 20% holds the clock; the middle and bottom hold icons — keep them calm.", kr: "세로로 든 휴대폰·태블릿 배경화면 1장, 세로 9:19.5 (태블릿은 3:4), 1440×3120px 이상. 위쪽 20%에 시계, 가운데와 아래에 아이콘이 놓이니 차분하게." },
    video: { en: "ONE seamless looping ambient video background, 8–12 seconds, 1920×1080 (landscape) or 1080×1920 (portrait), 24–30 fps, no audio, MP4 H.264. Locked-off camera, no cuts, slow continuous motion only, first and last frame identical for a perfect loop.", kr: "끊김 없이 반복되는 배경 영상 1개, 8~12초, 1920×1080(가로) 또는 1080×1920(세로), 24~30fps, 소리 없음, MP4 H.264. 카메라 고정, 컷 없음, 느리고 연속적인 움직임만, 첫 장면과 마지막 장면이 같아서 자연스럽게 반복되게." },
  };

  function build({ type, style, color, subject, lang, noText, apps, theme }) {
    const en = lang !== "ko";
    const st = STYLES[style] || STYLES.glass;
    const col = COLORS[color] || COLORS.graphite;
    const colText = typeof col.en === "function" ? (en ? col.en(theme) : col.kr(theme)) : en ? col.en : col.kr;
    const spec = SPEC[type] || SPEC.icon;
    const subj = subject.trim();
    const lines = [];
    if (en) {
      lines.push(`Create ${spec.en}`);
      if (type === "iconset") lines.push(`Apps in this set (one icon each): ${apps.join(", ")}.`);
      else lines.push(`Subject: ${subj || (type === "icon" ? "a single clean symbol" : "abstract light, depth and quiet texture")}.`);
      lines.push(`Style: ${st.en}.`);
      lines.push(`Colour: ${colText}.`);
      lines.push(noText ? "No letters, numbers, words, watermarks, logos or signatures anywhere." : "Only include text if explicitly requested above.");
      lines.push("Avoid generic AI look: no random glows, floating sci-fi symbols, cluttered micro details, fake plastic gloss, lens-flare spam. It should feel art-directed and human-designed.");
      lines.push("Output only the image itself — no device frames, mockups, collages or UI around it.");
    } else {
      lines.push(`${spec.kr}`);
      if (type === "iconset") lines.push(`세트에 들어갈 앱 (앱마다 아이콘 1개): ${apps.join(", ")}.`);
      else lines.push(`주제: ${subj || (type === "icon" ? "깔끔한 기호 하나" : "추상적인 빛과 깊이, 조용한 질감")}.`);
      lines.push(`스타일: ${st.kr}.`);
      lines.push(`색: ${colText}.`);
      lines.push(noText ? "글자·숫자·워터마크·로고·서명은 어디에도 넣지 않기." : "위에서 요청한 경우에만 글자 넣기.");
      lines.push("흔한 AI 느낌 피하기: 의미 없는 빛 번짐, 떠다니는 SF 기호, 자잘한 장식, 가짜 플라스틱 광택 없이, 사람이 디자인한 것처럼.");
      lines.push("기기 틀·목업·콜라주 없이 이미지 자체만 출력.");
    }
    return lines.join("\n");
  }

  H.prompts = { TYPES, STYLES, COLORS, build };
})();
