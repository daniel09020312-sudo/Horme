/* Ὁρμή — built-in app catalog.
   app  = app URL scheme (opens the installed app; support varies by app / OS version)
   web  = web address used when the app is missing or on desktop computers
   Schemes left empty are ones without a reliable public URL — link them with Shortcuts instead. */
(() => {
  "use strict";
  const H = window.H;

  H.CATEGORIES = ["생산성", "공부", "크리에이티브", "엔터테인먼트", "게임", "소셜", "유틸리티", "생활"];

  const A = (id, name, glyph, category, app, web, aliases = []) => ({ id, name, glyph, category, app, web, aliases });

  /* Apps of the v1 era, in their original order — the v1 → v2 migration relies on this list. */
  H.V1_APPS = [
    A("safari", "Safari", "compass", "유틸리티", "x-safari-https://www.google.com", "https://www.google.com", ["사파리", "브라우저", "인터넷", "웹"]),
    A("music", "음악", "music", "엔터테인먼트", "music://", "https://music.apple.com/", ["music", "애플뮤직", "노래"]),
    A("photos", "사진", "photo", "크리에이티브", "photos-redirect://", "https://www.icloud.com/photos/", ["photos", "갤러리", "앨범"]),
    A("files", "파일", "folder", "생산성", "shareddocuments://", "https://www.icloud.com/iclouddrive/", ["files", "폴더", "icloud"]),
    A("calendar", "캘린더", "calendar", "생산성", "calshow://", "https://www.icloud.com/calendar/", ["calendar", "달력", "일정"]),
    A("notes", "메모", "notepad", "생산성", "mobilenotes://", "https://www.icloud.com/notes/", ["notes", "노트"]),
    A("maps", "지도", "map", "생활", "maps://", "https://maps.apple.com/", ["maps", "길찾기", "애플지도"]),
    A("shortcuts", "단축어", "bolt", "유틸리티", "shortcuts://", "", ["shortcuts", "자동화"]),
    A("youtube", "YouTube", "playRect", "엔터테인먼트", "youtube://", "https://www.youtube.com/", ["유튜브", "유투브", "yt", "영상"]),
    A("spotify", "Spotify", "headphones", "엔터테인먼트", "spotify://", "https://open.spotify.com/", ["스포티파이", "음악"]),
    A("chatgpt", "ChatGPT", "atom", "생산성", "", "https://chatgpt.com/", ["챗지피티", "챗gpt", "gpt", "ai", "openai"]),
    A("goodnotes", "Goodnotes", "nib", "공부", "goodnotes://", "", ["굿노트", "필기", "노트"]),
    A("clock", "시계", "clock", "유틸리티", "clock-alarm://", "", ["clock", "알람", "스톱워치"]),
    A("mail", "Mail", "mail", "생산성", "message://", "https://www.icloud.com/mail/", ["메일", "이메일", "email"]),
    A("appstore", "App Store", "bag", "유틸리티", "itms-apps://", "https://apps.apple.com/kr/", ["앱스토어", "앱 스토어"]),
    A("interchange", "Interchange", "metro", "크리에이티브", "", "", ["인터체인지", "전자음악 노선도", "전자음악"]),
    A("drive", "Google Drive", "cloudUp", "생산성", "googledrive://", "https://drive.google.com/", ["구글드라이브", "드라이브"]),
    A("docs", "Google Docs", "doc", "생산성", "googledocs://", "https://docs.google.com/", ["구글문서", "독스", "문서"]),
    A("sheets", "Google Sheets", "sheet", "생산성", "googlesheets://", "https://sheets.google.com/", ["구글시트", "스프레드시트", "시트"]),
    A("classroom", "Classroom", "cap", "공부", "", "https://classroom.google.com/", ["클래스룸", "구글클래스룸", "학교"]),
    A("figma", "Figma", "vector", "크리에이티브", "", "https://www.figma.com/", ["피그마", "디자인"]),
    A("procreate", "Procreate", "brush", "크리에이티브", "", "", ["프로크리에이트", "그림", "드로잉"]),
    A("discord", "Discord", "gamepad", "소셜", "discord://", "https://discord.com/app", ["디스코드", "디코"]),
    A("pinterest", "Pinterest", "pin", "크리에이티브", "pinterest://", "https://www.pinterest.com/", ["핀터레스트", "핀터"]),
    A("soundcloud", "SoundCloud", "cloudWave", "엔터테인먼트", "soundcloud://", "https://soundcloud.com/", ["사운드클라우드", "사클"]),
    A("notion", "Notion", "blocks", "생산성", "notion://", "https://www.notion.so/", ["노션"]),
    A("camera", "카메라", "camera", "유틸리티", "", "", ["camera", "촬영"]),
    A("books", "도서", "book", "공부", "ibooks://", "https://books.apple.com/", ["books", "책", "애플북스", "전자책"]),
    A("calculator", "계산기", "calculator", "유틸리티", "", "", ["calculator", "계산"]),
    A("messages", "메시지", "bubble", "소셜", "sms:", "", ["messages", "문자", "imessage"]),
    A("meet", "FaceTime", "videoCam", "소셜", "", "", ["페이스타임", "영상통화"]),
    A("freeform", "Freeform", "canvas", "크리에이티브", "", "", ["프리폼", "화이트보드"]),
    A("settings", "Ὁρμή 설정", "gear", "유틸리티", "horme://settings", "", ["설정", "settings", "호르메"]),
  ];
  const v1 = (id) => H.V1_APPS.find((a) => a.id === id);

  /* Google apps (app = the app's URL scheme on iPhone/iPad, web = fallback). */
  const GOOGLE = [
    A("chrome", "Chrome", "globe", "유틸리티", "googlechrome://", "https://www.google.com/", ["크롬", "브라우저", "구글크롬", "인터넷", "웹"]),
    A("google", "Google", "search", "유틸리티", "", "https://www.google.com/", ["구글", "검색", "구글검색"]),
    A("gmail", "Gmail", "mail", "생산성", "googlegmail://", "https://mail.google.com/", ["지메일", "구글메일", "메일", "이메일"]),
    A("gcalendar", "Google 캘린더", "calendar", "생산성", "googlecalendar://", "https://calendar.google.com/", ["구글캘린더", "캘린더", "달력", "일정", "google calendar"]),
    A("gkeep", "Google Keep", "bulb", "생산성", "", "https://keep.google.com/", ["킵", "구글킵", "구글 메모", "메모", "keep"]),
    A("slides", "Google Slides", "slides", "생산성", "googleslides://", "https://slides.google.com/", ["구글슬라이드", "슬라이드", "프레젠테이션", "발표"]),
    A("gphotos", "Google 포토", "photo", "크리에이티브", "googlephotos://", "https://photos.google.com/", ["구글포토", "포토", "사진", "google photos"]),
    A("gmaps", "Google 지도", "location", "생활", "comgooglemaps://", "https://maps.google.com/", ["구글맵", "구글지도", "지도", "google maps"]),
    A("gtranslate", "Google 번역", "translate", "공부", "googletranslate://", "https://translate.google.com/", ["구글번역", "번역", "google translate"]),
    A("gmeet", "Google Meet", "videoCam", "소셜", "", "https://meet.google.com/", ["구글미트", "미트", "화상회의"]),
    A("ytmusic", "YouTube Music", "play2", "엔터테인먼트", "youtubemusic://", "https://music.youtube.com/", ["유튜브뮤직", "유튭뮤직", "음악"]),
    A("gemini", "Gemini", "sparkle", "생산성", "", "https://gemini.google.com/", ["제미나이", "ai", "구글 ai"]),
  ];
  /* Apps that ship with the launcher: Google first, plus the essentials without a Google version. */
  H.DEFAULT_APPS = [
    ...GOOGLE,
    ...["youtube", "drive", "docs", "sheets", "classroom", "shortcuts", "goodnotes", "notion", "chatgpt", "spotify", "soundcloud",
      "interchange", "figma", "procreate", "discord", "pinterest", "camera", "calculator", "clock", "messages", "appstore", "settings"].map(v1),
  ];

  /* More apps people can add from the "앱 추가" catalog. */
  H.EXTRA_APPS = [
    ...["safari", "music", "photos", "files", "calendar", "notes", "maps", "mail", "books", "meet", "freeform"].map(v1),
    A("kakaotalk", "카카오톡", "bubbleDots", "소셜", "kakaotalk://", "", ["카톡", "kakao"]),
    A("instagram", "Instagram", "aperture", "소셜", "instagram://", "https://www.instagram.com/", ["인스타", "인스타그램"]),
    A("x", "X", "bubble", "소셜", "twitter://", "https://x.com/", ["트위터", "twitter"]),
    A("telegram", "Telegram", "plane", "소셜", "tg://", "https://web.telegram.org/", ["텔레그램"]),
    A("zoom", "Zoom", "videoCam", "소셜", "zoomus://", "https://zoom.us/", ["줌"]),
    A("claude", "Claude", "sparkle", "생산성", "", "https://claude.ai/", ["클로드", "ai"]),
    A("naver", "네이버", "search", "유틸리티", "naversearchapp://", "https://m.naver.com/", ["naver", "검색"]),
    A("navermap", "네이버 지도", "location", "생활", "nmap://", "https://map.naver.com/", ["네이버맵", "길찾기"]),
    A("kakaomap", "카카오맵", "map", "생활", "kakaomap://", "https://map.kakao.com/", ["카카오지도", "길찾기"]),
    A("papago", "파파고", "translate", "공부", "", "https://papago.naver.com/", ["번역", "papago"]),
    A("webtoon", "네이버 웹툰", "book", "엔터테인먼트", "", "https://comic.naver.com/", ["웹툰"]),
    A("melon", "멜론", "music", "엔터테인먼트", "", "https://www.melon.com/", ["melon", "음악"]),
    A("netflix", "Netflix", "film", "엔터테인먼트", "nflx://", "https://www.netflix.com/", ["넷플릭스", "넷플"]),
    A("disney", "Disney+", "star", "엔터테인먼트", "", "https://www.disneyplus.com/", ["디즈니플러스", "디즈니"]),
    A("tving", "TVING", "tv", "엔터테인먼트", "", "https://www.tving.com/", ["티빙"]),
    A("podcasts", "팟캐스트", "podcast", "엔터테인먼트", "podcasts://", "https://podcasts.apple.com/", ["podcast", "팟캐"]),
    A("reminders", "미리 알림", "list", "생산성", "x-apple-reminderkit://", "https://www.icloud.com/reminders/", ["reminders", "할일", "할 일"]),
    A("github", "GitHub", "code", "생산성", "", "https://github.com/", ["깃허브", "깃헙"]),
    A("canva", "Canva", "palette", "크리에이티브", "", "https://www.canva.com/", ["캔바"]),
    A("capcut", "CapCut", "film", "크리에이티브", "", "https://www.capcut.com/", ["캡컷", "영상편집"]),
    A("ebsi", "EBSi", "cap", "공부", "", "https://www.ebsi.co.kr/", ["ebs", "이비에스"]),
    A("duolingo", "Duolingo", "leaf", "공부", "", "https://www.duolingo.com/", ["듀오링고", "영어"]),
    A("wikipedia", "위키백과", "book", "공부", "", "https://ko.wikipedia.org/", ["wikipedia", "위키"]),
    A("namuwiki", "나무위키", "leaf", "공부", "", "https://namu.wiki/", ["나무위키", "위키"]),
    A("roblox", "Roblox", "blocks", "게임", "roblox://", "https://www.roblox.com/", ["로블록스", "로블"]),
    A("minecraft", "Minecraft", "layers", "게임", "minecraft://", "https://www.minecraft.net/", ["마인크래프트", "마크"]),
    A("brawlstars", "브롤스타즈", "star", "게임", "", "https://supercell.com/en/games/brawlstars/", ["brawl stars", "브롤"]),
    A("clashroyale", "클래시 로얄", "bolt", "게임", "", "https://supercell.com/en/games/clashroyale/", ["clash royale", "클로"]),
    A("genshin", "원신", "sparkle", "게임", "", "https://genshin.hoyoverse.com/ko/", ["genshin", "원신 임팩트"]),
    A("cookierun", "쿠키런: 킹덤", "heart", "게임", "", "https://www.cookierun-kingdom.com/", ["쿠키런", "cookie run"]),
    A("pokemongo", "Pokémon GO", "aperture", "게임", "", "https://pokemongolive.com/", ["포켓몬고", "포켓몬 go"]),
    A("chesscom", "Chess.com", "target", "게임", "", "https://www.chess.com/", ["체스", "chess"]),
    A("steam", "Steam", "gamepad", "게임", "", "https://store.steampowered.com/", ["스팀"]),
    A("toss", "토스", "wallet", "생활", "supertoss://", "https://toss.im/", ["toss", "송금"]),
    A("coupang", "쿠팡", "cart", "생활", "", "https://www.coupang.com/", ["coupang", "쇼핑"]),
    A("baemin", "배달의민족", "food", "생활", "", "https://www.baemin.com/", ["배민", "배달"]),
  ];

  H.catalogById = (id) => H.DEFAULT_APPS.find((a) => a.id === id) || H.EXTRA_APPS.find((a) => a.id === id) || v1(id) || null;
  H.CATALOG = () => [...H.DEFAULT_APPS, ...H.EXTRA_APPS];

  /* Apple app → Google counterpart ("구글 앱으로 바꾸기"). */
  H.GOOGLE_SWAP = { safari: "chrome", mail: "gmail", calendar: "gcalendar", photos: "gphotos", maps: "gmaps", notes: "gkeep", files: "drive", music: "ytmusic", meet: "gmeet" };

  /* Starting home screen. Dock apps are not repeated on pages. */
  H.DEFAULT_LAYOUT = {
    dock: ["chrome", "gmail", "youtube", "gphotos", "drive", "gemini"],
    pages: [
      {
        widgets: [
          { type: "hero", size: "m" },
          { type: "focus", size: "s" },
          { type: "ambient", size: "s" },
        ],
        apps: ["gcalendar", "gkeep", "docs", "sheets", "slides", "classroom", "gmaps", "gtranslate",
          "goodnotes", "notion", "google", "gmeet", "ytmusic", "shortcuts", "interchange", "clock"],
      },
      {
        widgets: [
          { type: "calendar", size: "m" },
          { type: "todo", size: "m" },
          { type: "weather", size: "s" },
          { type: "dday", size: "s" },
        ],
        apps: ["figma", "procreate", "pinterest", "discord", "chatgpt", "spotify", "soundcloud", "camera"],
      },
    ],
  };

  H.THEMES = {
    iris: { name: "IRIS", sub: "미드나이트 퍼플", accent: "#c9c9fa", accent2: "#82bfcb", glow1: "rgba(126,113,195,.16)", glow2: "rgba(46,119,143,.15)", base: "#060810", ambient: [[142, 126, 201], [83, 158, 163]] },
    graphite: { name: "GRAPHITE", sub: "그라파이트 · 실버", accent: "#d6dbe4", accent2: "#8d9db3", glow1: "rgba(120,136,160,.12)", glow2: "rgba(80,96,120,.12)", base: "#07090d", ambient: [[160, 172, 190], [98, 114, 138]] },
    aurora: { name: "AURORA", sub: "청록 · 라일락", accent: "#b5e0d8", accent2: "#bd9bd7", glow1: "rgba(65,173,170,.15)", glow2: "rgba(148,87,194,.17)", base: "#050a0f", ambient: [[74, 196, 177], [171, 106, 204]] },
    mono: { name: "MONO", sub: "흑백", accent: "#e0e0e0", accent2: "#9a9a9a", glow1: "rgba(180,180,180,.07)", glow2: "rgba(140,140,140,.05)", base: "#070707", ambient: [[177, 177, 177], [120, 120, 120]] },
    ember: { name: "EMBER", sub: "차분한 로즈", accent: "#ecc4bc", accent2: "#cb969d", glow1: "rgba(159,82,99,.17)", glow2: "rgba(168,122,112,.13)", base: "#0c0709", ambient: [[186, 110, 133], [207, 148, 111]] },
    dusk: { name: "DUSK", sub: "호박빛 저녁", accent: "#f0d3a2", accent2: "#c98f6b", glow1: "rgba(196,140,70,.14)", glow2: "rgba(120,80,140,.14)", base: "#0b0806", ambient: [[214, 160, 96], [140, 96, 160]] },
    forest: { name: "FOREST", sub: "깊은 숲", accent: "#c4e3c6", accent2: "#7fb09a", glow1: "rgba(70,140,100,.15)", glow2: "rgba(40,100,110,.14)", base: "#050a08", ambient: [[110, 180, 130], [70, 140, 150]] },
  };
})();
