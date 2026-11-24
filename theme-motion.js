/* One reusable decorative stage. Theme data and keyframes are built offline.
   CSS owns movement; there is no render loop, polling, or application data. */
(function(g,d){
  'use strict';
  const profiles=g.EvertaleMotionProfiles;
  if(!profiles||!g.EvertaleTheme)return;
  const assetBase=new URL('.',d.currentScript?.src||new URL('theme-motion.js',d.baseURI||g.location.href).href);
  const mobile=g.matchMedia?.('(max-width:480px)');
  const density=g.matchMedia?.('(max-width:700px)');
  const technology=Object.freeze(['miraidon','cyber','crimsonblack','cobaltblack','metallicrose','bronzexl','blackwhitedsi','galaxystyle','superfamicom']);
  let scene=null,active='',artNode=null,particles=null,particleKey='',moduleHost=null;
  /* Sixteen shared primitives, authored geometry and per-theme events. Counts include
     separately animated children; mobile keeps the signature before its atmosphere. */
  function part(type,shape,count,phone,duration,size,region='edges'){
    return Object.freeze({type,shape,count,phone,duration,size,region});
  }
  const P=part;
  /* Original checked-in SVG silhouettes, no external markup or runtime data. */
  const LEGENDARY_MOTIFS={
  "hooh": [
    22,
    [
      [
        "rainbow",
        "reveal",
        "#f9dc8b",
        "<path stroke=\"#f07575\" d=\"M20 108 A80 72 0 0 1 180 108\"/><path stroke=\"#f5ac64\" d=\"M27 108 A73 66 0 0 1 173 108\"/><path stroke=\"#f7d879\" d=\"M34 108 A66 60 0 0 1 166 108\"/><path stroke=\"#8ce2a3\" d=\"M41 108 A59 54 0 0 1 159 108\"/><path stroke=\"#79d8ef\" d=\"M48 108 A52 48 0 0 1 152 108\"/><path stroke=\"#9a9cf5\" d=\"M55 108 A45 42 0 0 1 145 108\"/><path stroke=\"#d59ced\" d=\"M62 108 A38 36 0 0 1 138 108\"/>"
      ],
      [
        "sacred-feathers",
        "ascend",
        "#f4ad58",
        "<path d=\"M30 111Q14 70 60 30Q77 64 30 111Z M30 111L57 44 M38 90L26 70 M45 76L62 69 M115 128Q90 81 144 47Q169 91 115 128Z M115 128L142 62 M123 107L110 91 M132 91L150 83\"/>"
      ],
      [
        "sacred-fire",
        "radiate",
        "#ef7959",
        "<path d=\"M100 145Q64 119 80 87L91 103Q121 65 107 21Q153 70 136 117Z M32 135Q13 109 42 72Q38 107 58 125 M162 135Q181 109 152 72Q156 107 136 125\"/>"
      ]
    ]
  ],
  "lugia": [
    20,
    [
      [
        "pressure",
        "compress",
        "#a7dfff",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"76\" ry=\"30\"/><ellipse cx=\"100\" cy=\"80\" rx=\"53\" ry=\"20\"/><ellipse cx=\"100\" cy=\"80\" rx=\"27\" ry=\"10\"/>"
      ],
      [
        "aeroblast",
        "sweep",
        "#e1f3ff",
        "<path d=\"M9 91C45 21 90 34 99 79S153 130 192 60 M12 110C54 52 81 52 95 94S155 145 190 84\"/>"
      ]
    ]
  ],
  "suicune": [
    18,
    [
      [
        "purification",
        "sweep",
        "#a4f6ff",
        "<path d=\"M8 104Q36 55 70 92T135 85T192 70 M8 117Q40 75 72 108T138 103T192 89 M16 129Q51 100 78 119T155 114\"/>"
      ],
      [
        "north-wind",
        "ribbon",
        "#b6a1f3",
        "<path d=\"M10 78C35 24 76 115 105 52S165 26 190 71 M10 95C35 41 76 132 105 69S165 43 190 88\"/>"
      ],
      [
        "cleared-water",
        "radiate",
        "#dbfbff",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"76\" ry=\"30\"/><ellipse cx=\"100\" cy=\"80\" rx=\"53\" ry=\"20\"/><ellipse cx=\"100\" cy=\"80\" rx=\"27\" ry=\"10\"/>"
      ]
    ]
  ],
  "groudon": [
    20,
    [
      [
        "drought",
        "radiate",
        "#ffc27a",
        "<circle cx=\"100\" cy=\"80\" r=\"39\"/><path d=\"M148.0 80.0L170.0 80.0M141.6 104.0L160.6 115.0M124.0 121.6L135.0 140.6M100.0 128.0L100.0 150.0M76.0 121.6L65.0 140.6M58.4 104.0L39.4 115.0M52.0 80.0L30.0 80.0M58.4 56.0L39.4 45.0M76.0 38.4L65.0 19.4M100.0 32.0L100.0 10.0M124.0 38.4L135.0 19.4M141.6 56.0L160.6 45.0\"/>"
      ],
      [
        "continental-rise",
        "lift",
        "#e46f52",
        "<path d=\"M8 135H192 M18 131L45 79 70 92 96 38 126 94 152 66 183 131Z M45 79L55 106 70 92 M96 38L100 83 126 94\"/>"
      ]
    ]
  ],
  "kyogre": [
    20,
    [
      [
        "ocean-swell",
        "swell",
        "#5db9ff",
        "<path d=\"M8 104Q36 55 70 92T135 85T192 70 M8 117Q40 75 72 108T138 103T192 89 M16 129Q51 100 78 119T155 114\"/>"
      ],
      [
        "pressure",
        "compress",
        "#a8efff",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"76\" ry=\"30\"/><ellipse cx=\"100\" cy=\"80\" rx=\"53\" ry=\"20\"/><ellipse cx=\"100\" cy=\"80\" rx=\"27\" ry=\"10\"/>"
      ]
    ]
  ],
  "rayquaza": [
    20,
    [
      [
        "clear-sky",
        "part",
        "#baf8d8",
        "<path d=\"M8 65Q42 22 87 62 M113 62Q158 22 192 65 M8 114Q40 74 87 112 M113 112Q160 74 192 114\"/>"
      ],
      [
        "air-lock",
        "orbit",
        "#68e3a0",
        "<path d=\"M25 115C5 35 156 0 174 57S86 134 64 88 132 36 148 78\"/>"
      ]
    ]
  ],
  "shinyprimalgroudon": [
    18,
    [
      [
        "desolate-sun",
        "radiate",
        "#ffe178",
        "<circle cx=\"100\" cy=\"80\" r=\"39\"/><path d=\"M148.0 80.0L170.0 80.0M141.6 104.0L160.6 115.0M124.0 121.6L135.0 140.6M100.0 128.0L100.0 150.0M76.0 121.6L65.0 140.6M58.4 104.0L39.4 115.0M52.0 80.0L30.0 80.0M58.4 56.0L39.4 45.0M76.0 38.4L65.0 19.4M100.0 32.0L100.0 10.0M124.0 38.4L135.0 19.4M141.6 56.0L160.6 45.0\"/>"
      ],
      [
        "magma-veins",
        "reveal",
        "#ffbd42",
        "<path d=\"M16 135L44 87 72 95 99 42 127 96 163 73 188 135 M99 42L91 79 106 100 97 135 M44 87L64 124 83 105 M127 96L144 119 165 103\"/>"
      ]
    ]
  ],
  "shinyprimalkyogre": [
    18,
    [
      [
        "primordial-sea",
        "swell",
        "#d3efff",
        "<path d=\"M8 104Q36 55 70 92T135 85T192 70 M8 117Q40 75 72 108T138 103T192 89 M16 129Q51 100 78 119T155 114\"/>"
      ],
      [
        "golden-pressure",
        "radiate",
        "#f8d76e",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"76\" ry=\"30\"/><ellipse cx=\"100\" cy=\"80\" rx=\"53\" ry=\"20\"/><ellipse cx=\"100\" cy=\"80\" rx=\"27\" ry=\"10\"/>"
      ],
      [
        "primal-markings",
        "compress",
        "#e4a5df",
        "<path d=\"M24 71L49 50 70 67 53 86 75 105 M176 71L151 50 130 67 147 86 125 105 M80 80H120\"/>"
      ]
    ]
  ],
  "shinymegarayquaza": [
    17,
    [
      [
        "delta-vortex",
        "orbit",
        "#ffe171",
        "<path d=\"M18 80C18 12 182 12 182 80S18 148 18 80 M47 80C47 36 153 36 153 80S47 124 47 80\"/>"
      ],
      [
        "gold-tendrils",
        "ribbon",
        "#f6bc57",
        "<path d=\"M10 132C88 130 35 28 104 30S159 103 190 9 M10 28C88 30 35 132 104 130S159 57 190 151\"/>"
      ]
    ]
  ],
  "dialga": [
    24,
    [
      [
        "time-dial",
        "hold",
        "#91e6ff",
        "<circle cx=\"100\" cy=\"80\" r=\"60\"/><circle cx=\"100\" cy=\"80\" r=\"49\"/><path d=\"M151.0 80.0L159.0 80.0M144.2 105.5L151.1 109.5M125.5 124.2L129.5 131.1M100.0 131.0L100.0 139.0M74.5 124.2L70.5 131.1M55.8 105.5L48.9 109.5M49.0 80.0L41.0 80.0M55.8 54.5L48.9 50.5M74.5 35.8L70.5 28.9M100.0 29.0L100.0 21.0M125.5 35.8L129.5 28.9M144.2 54.5L151.1 50.5\"/>"
      ],
      [
        "rewinding-hand",
        "rewind",
        "#e0f5ff",
        "<path d=\"M100 80L100 28 M100 80L138 94\"/><circle cx=\"100\" cy=\"80\" r=\"4\"/>"
      ],
      [
        "time-echo",
        "echo",
        "#588cfa",
        "<circle cx=\"100\" cy=\"80\" r=\"69\"/><circle cx=\"100\" cy=\"80\" r=\"36\"/>"
      ]
    ]
  ],
  "palkia": [
    23,
    [
      [
        "space-grid",
        "warp",
        "#e3b4f5",
        "<path d=\"M16 35Q100 5 184 35 M16 61Q100 37 184 61 M16 98Q100 119 184 98 M16 125Q100 155 184 125 M40 16Q8 80 40 144 M78 16Q62 80 78 144 M122 16Q138 80 122 144 M160 16Q192 80 160 144\"/>"
      ],
      [
        "spatial-rift",
        "open",
        "#fba3de",
        "<path d=\"M100 10L83 38 107 54 75 84 119 99 96 125 103 150 M94 10L73 38 97 54 65 84 109 99 86 125 97 150\"/>"
      ],
      [
        "spatial-plane",
        "part",
        "#c5b4ff",
        "<path d=\"M22 46L77 31V124L22 139Z M123 31L178 46V139L123 124Z\"/>"
      ]
    ]
  ],
  "giratina": [
    25,
    [
      [
        "inverted-terrain",
        "invert",
        "#a78bb9",
        "<path d=\"M35 30L58 16 77 59 49 81Z M119 22L153 36 139 82 108 61Z M49 108L79 85 101 136 64 145Z M142 100L178 78 186 132 157 146Z\"/>"
      ],
      [
        "distortion-seam",
        "open",
        "#f27685",
        "<path d=\"M100 10L83 38 107 54 75 84 119 99 96 125 103 150 M94 10L73 38 97 54 65 84 109 99 86 125 97 150\"/>"
      ],
      [
        "reversed-orbit",
        "counter",
        "#e5c477",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"71\" ry=\"31\"/>"
      ]
    ]
  ],
  "arceus": [
    26,
    [
      [
        "creation-ring",
        "hold",
        "#f6df86",
        "<circle cx=\"100\" cy=\"80\" r=\"57\"/><path d=\"M150.0 80.0L169.0 80.0M135.4 115.4L148.8 128.8M100.0 130.0L100.0 149.0M64.6 115.4L51.2 128.8M50.0 80.0L31.0 80.0M64.6 44.6L51.2 31.2M100.0 30.0L100.0 11.0M135.4 44.6L148.8 31.2\"/>"
      ],
      [
        "gathering-light",
        "gather",
        "#f9f3d0",
        "<circle cx=\"167.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"135.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"33.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"25.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/>"
      ],
      [
        "formed-world",
        "radiate",
        "#e0f1d4",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"46\" ry=\"23\"/><ellipse cx=\"100\" cy=\"80\" rx=\"23\" ry=\"46\"/><circle cx=\"100\" cy=\"80\" r=\"46\"/>"
      ]
    ]
  ],
  "reshiram": [
    19,
    [
      [
        "turboblaze",
        "rotate",
        "#f8e9d2",
        "<circle cx=\"100\" cy=\"80\" r=\"51\"/><circle cx=\"100\" cy=\"80\" r=\"23\"/><path d=\"M100 80Q135.0 80.0 143.2 100.9M100 80Q117.5 110.3 103.5 127.9M100 80Q82.5 110.3 60.3 107.0M100 80Q65.0 80.0 56.8 59.1M100 80Q82.5 49.7 96.5 32.1M100 80Q117.5 49.7 139.7 53.0\"/>"
      ],
      [
        "blue-flare",
        "ascend",
        "#78d8ff",
        "<path d=\"M100 145Q64 119 80 87L91 103Q121 65 107 21Q153 70 136 117Z M32 135Q13 109 42 72Q38 107 58 125 M162 135Q181 109 152 72Q156 107 136 125\"/>"
      ],
      [
        "warm-plume",
        "radiate",
        "#f5b26e",
        "<circle cx=\"100\" cy=\"80\" r=\"64\"/>"
      ]
    ]
  ],
  "zekrom": [
    16,
    [
      [
        "teravolt-generator",
        "rotate",
        "#6bcfff",
        "<circle cx=\"100\" cy=\"80\" r=\"51\"/><circle cx=\"100\" cy=\"80\" r=\"23\"/><path d=\"M100 80Q135.0 80.0 143.2 100.9M100 80Q117.5 110.3 103.5 127.9M100 80Q82.5 110.3 60.3 107.0M100 80Q65.0 80.0 56.8 59.1M100 80Q82.5 49.7 96.5 32.1M100 80Q117.5 49.7 139.7 53.0\"/>"
      ],
      [
        "bolt-strike",
        "release",
        "#a9eaff",
        "<path d=\"M12 83L49 65 43 91 94 54 86 83 137 48 126 79 186 56 M86 83L103 109 129 103 M49 65L61 40\"/>"
      ]
    ]
  ],
  "blackkyurem": [
    19,
    [
      [
        "frozen-plates",
        "lock",
        "#a5daef",
        "<path d=\"M28 132L14 86 51 30 80 57 64 113Z M70 128L94 15 128 57 115 123Z M125 129L139 54 181 36 192 105Z M51 30L47 93 28 132 M94 15L100 97 115 123 M181 36L163 104 125 129\"/>"
      ],
      [
        "freeze-shock",
        "release",
        "#59bfff",
        "<path d=\"M12 83L49 65 43 91 94 54 86 83 137 48 126 79 186 56 M86 83L103 109 129 103 M49 65L61 40\"/>"
      ],
      [
        "ice-pressure",
        "radiate",
        "#b9e9ff",
        "<circle cx=\"100\" cy=\"80\" r=\"58\"/>"
      ]
    ]
  ],
  "whitekyurem": [
    20,
    [
      [
        "ice-shell",
        "hold",
        "#c4f0fa",
        "<path d=\"M28 132L14 86 51 30 80 57 64 113Z M70 128L94 15 128 57 115 123Z M125 129L139 54 181 36 192 105Z M51 30L47 93 28 132 M94 15L100 97 115 123 M181 36L163 104 125 129\"/>"
      ],
      [
        "ice-burn",
        "reveal",
        "#ffb16e",
        "<path d=\"M18 110L53 87 70 105 100 48 124 95 151 77 184 100 M100 48L102 92 90 125\"/>"
      ],
      [
        "steam",
        "ascend",
        "#f9e0cb",
        "<path d=\"M45 119C12 91 72 65 42 24 M100 119C67 91 127 65 97 24 M155 119C122 91 182 65 152 24\"/>"
      ]
    ]
  ],
  "xerneas": [
    24,
    [
      [
        "life-branches",
        "grow",
        "#a4e4d2",
        "<path d=\"M100 143V90L58 66 31 28 M58 66L61 31 M31 28L12 39 M100 90L142 66 169 28 M142 66L139 31 M169 28L188 39 M100 90V33\"/>"
      ],
      [
        "seven-color-crown",
        "reveal",
        "#fff4c0",
        "<circle cx=\"12\" cy=\"39\" r=\"5\" fill=\"#f07575\" stroke=\"#f07575\"/><circle cx=\"31\" cy=\"28\" r=\"5\" fill=\"#f5ac64\" stroke=\"#f5ac64\"/><circle cx=\"61\" cy=\"31\" r=\"5\" fill=\"#f7d879\" stroke=\"#f7d879\"/><circle cx=\"100\" cy=\"33\" r=\"5\" fill=\"#8ce2a3\" stroke=\"#8ce2a3\"/><circle cx=\"139\" cy=\"31\" r=\"5\" fill=\"#79d8ef\" stroke=\"#79d8ef\"/><circle cx=\"169\" cy=\"28\" r=\"5\" fill=\"#9a9cf5\" stroke=\"#9a9cf5\"/><circle cx=\"188\" cy=\"39\" r=\"5\" fill=\"#d59ced\" stroke=\"#d59ced\"/>"
      ],
      [
        "life-dispersal",
        "radiate",
        "#b6f3db",
        "<circle cx=\"167.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"135.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"33.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"25.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/>"
      ]
    ]
  ],
  "yveltal": [
    24,
    [
      [
        "oblivion",
        "gather",
        "#f48a9b",
        "<circle cx=\"167.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"135.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"33.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"25.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/>"
      ],
      [
        "y-shaped-drain",
        "reveal",
        "#e15175",
        "<path d=\"M100 138V87L28 25 M100 87L172 25 M100 112L58 66 M100 112L142 66\"/>"
      ],
      [
        "cocoon",
        "compress",
        "#b75c8a",
        "<ellipse cx=\"100\" cy=\"80\" rx=\"34\" ry=\"52\"/><ellipse cx=\"100\" cy=\"80\" rx=\"21\" ry=\"43\"/>"
      ]
    ]
  ],
  "solgaleo": [
    24,
    [
      [
        "solar-core",
        "hold",
        "#fff1b8",
        "<circle cx=\"100\" cy=\"80\" r=\"39\"/><path d=\"M148.0 80.0L170.0 80.0M141.6 104.0L160.6 115.0M124.0 121.6L135.0 140.6M100.0 128.0L100.0 150.0M76.0 121.6L65.0 140.6M58.4 104.0L39.4 115.0M52.0 80.0L30.0 80.0M58.4 56.0L39.4 45.0M76.0 38.4L65.0 19.4M100.0 32.0L100.0 10.0M124.0 38.4L135.0 19.4M141.6 56.0L160.6 45.0\"/>"
      ],
      [
        "solar-prominences",
        "radiate",
        "#ffcc66",
        "<path d=\"M40 61Q37 25 68 30Q83 6 97 32Q133 4 134 36Q166 24 162 55Q194 72 168 89Q187 124 148 124Q142 155 113 137Q78 157 69 128Q24 135 36 98Q5 79 40 61Z\"/>"
      ],
      [
        "sunsteel-ray",
        "release",
        "#ffe9a1",
        "<path d=\"M9 117L176 43 M25 132L185 55 M28 99L157 43\"/>"
      ]
    ]
  ],
  "lunala": [
    26,
    [
      [
        "lunar-disc",
        "hold",
        "#b8c6ff",
        "<circle cx=\"100\" cy=\"80\" r=\"58\"/>"
      ],
      [
        "moon-shadow",
        "eclipse",
        "#b091ec",
        "<path fill=\"currentColor\" d=\"M100 22A58 58 0 1 0 100 138Q49 80 100 22Z\"/>"
      ],
      [
        "moonlight-rays",
        "orbit",
        "#e9ddff",
        "<path d=\"M17 27L29 43 17 59 5 43Z M175 93L187 109 175 125 163 109Z\"/>"
      ]
    ]
  ],
  "ultranecrozma": [
    20,
    [
      [
        "light-absorption",
        "gather",
        "#fff1b0",
        "<circle cx=\"167.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"135.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"33.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"25.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/>"
      ],
      [
        "ultra-prism",
        "lock",
        "#f8db74",
        "<path d=\"M100 12L140 60 100 115 60 60Z M100 12V115 M60 60H140 M38 78L62 116 38 146 14 116Z M162 78L186 116 162 146 138 116Z\"/>"
      ],
      [
        "photon-geyser",
        "release",
        "#fff7d7",
        "<path d=\"M131.0 80.0L173.0 80.0M125.1 98.2L159.1 122.9M109.6 109.5L122.6 149.4M90.4 109.5L77.4 149.4M74.9 98.2L40.9 122.9M69.0 80.0L27.0 80.0M74.9 61.8L40.9 37.1M90.4 50.5L77.4 10.6M109.6 50.5L122.6 10.6M125.1 61.8L159.1 37.1\"/>"
      ]
    ]
  ],
  "zacian": [
    17,
    [
      [
        "crowned-sword",
        "hold",
        "#a6e8f0",
        "<path d=\"M26 124L151 22 177 15 163 39 39 139Z M19 115L48 145 M35 139L15 156 M51 115L158 29\"/>"
      ],
      [
        "behemoth-blade",
        "slash",
        "#ffe28b",
        "<path d=\"M8 139L181 8 M32 153L192 29 M5 112L150 8\"/>"
      ]
    ]
  ],
  "zamazenta": [
    19,
    [
      [
        "crowned-shield",
        "hold",
        "#e8bf72",
        "<path d=\"M100 16L158 39V86Q158 120 100 147Q42 120 42 86V39Z M100 30L145 48V85Q145 110 100 132Q55 110 55 85V48Z\"/>"
      ],
      [
        "incoming-force",
        "approach",
        "#f4a4b6",
        "<path d=\"M8 54H47 M4 80H47 M8 106H47\"/>"
      ],
      [
        "deflection",
        "deflect",
        "#9fe6f1",
        "<path d=\"M42 80Q98 29 191 15 M42 80Q98 131 191 145\"/>"
      ]
    ]
  ],
  "eternatus": [
    24,
    [
      [
        "dynamax-absorption",
        "gather",
        "#ef77c8",
        "<circle cx=\"167.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"135.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"127.6\" r=\"2\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"107.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"33.0\" cy=\"80.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"42.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/><circle cx=\"66.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"100.0\" cy=\"25.0\" r=\"3\" fill=\"currentColor\"/><circle cx=\"133.5\" cy=\"32.4\" r=\"2\" fill=\"currentColor\"/><circle cx=\"158.0\" cy=\"52.5\" r=\"2\" fill=\"currentColor\"/>"
      ],
      [
        "skeletal-core",
        "hold",
        "#ce87f5",
        "<path d=\"M100 18L143 46 143 114 100 142 57 114 57 46Z M100 18L100 142 M57 46L143 114 M143 46L57 114\"/><circle cx=\"100\" cy=\"80\" r=\"24\"/>"
      ],
      [
        "dynamax-cannon",
        "release",
        "#f184ce",
        "<path d=\"M100 80L186 17 M100 80L192 80 M100 80L186 143\"/>"
      ]
    ]
  ],
  "koraidon": [
    18,
    [
      [
        "orichalcum-sun",
        "radiate",
        "#ffca7b",
        "<circle cx=\"100\" cy=\"80\" r=\"39\"/><path d=\"M148.0 80.0L170.0 80.0M141.6 104.0L160.6 115.0M124.0 121.6L135.0 140.6M100.0 128.0L100.0 150.0M76.0 121.6L65.0 140.6M58.4 104.0L39.4 115.0M52.0 80.0L30.0 80.0M58.4 56.0L39.4 45.0M76.0 38.4L65.0 19.4M100.0 32.0L100.0 10.0M124.0 38.4L135.0 19.4M141.6 56.0L160.6 45.0\"/>"
      ],
      [
        "collision-course",
        "impact",
        "#f18060",
        "<path d=\"M8 128L53 86 68 103 100 62 132 103 147 86 192 128 M28 139L58 118 M172 139L142 118\"/>"
      ],
      [
        "primal-dust",
        "sweep",
        "#e5b58b",
        "<path d=\"M9 118Q48 91 82 120T151 107T192 119 M17 139Q57 118 90 138T181 130\"/>"
      ]
    ]
  ],
  "terapagos": [
    26,
    [
      [
        "stellar-shell",
        "lock",
        "#c0f4f7",
        "<path d=\"M128.0 80.0L114.0 104.2L86.0 104.2L72.0 80.0L86.0 55.8L114.0 55.8Z\"/><path d=\"M128.0 32.0L114.0 56.2L86.0 56.2L72.0 32.0L86.0 7.8L114.0 7.8Z\"/><path d=\"M170.0 56.0L156.0 80.2L128.0 80.2L114.0 56.0L128.0 31.8L156.0 31.8Z\"/><path d=\"M170.0 104.0L156.0 128.2L128.0 128.2L114.0 104.0L128.0 79.8L156.0 79.8Z\"/><path d=\"M128.0 128.0L114.0 152.2L86.0 152.2L72.0 128.0L86.0 103.8L114.0 103.8Z\"/><path d=\"M86.0 104.0L72.0 128.2L44.0 128.2L30.0 104.0L44.0 79.8L72.0 79.8Z\"/><path d=\"M86.0 56.0L72.0 80.2L44.0 80.2L30.0 56.0L44.0 31.8L72.0 31.8Z\"/>"
      ],
      [
        "terastal-refraction",
        "orbit",
        "#c3a9f8",
        "<path d=\"M100 12L140 60 100 115 60 60Z M100 12V115 M60 60H140 M38 78L62 116 38 146 14 116Z M162 78L186 116 162 146 138 116Z\"/>"
      ],
      [
        "stellar-spectrum",
        "radiate",
        "#e9fbff",
        "<path stroke=\"#f07575\" d=\"M100 80L170.0 80.0\"/><path stroke=\"#f5ac64\" d=\"M100 80L143.6 134.7\"/><path stroke=\"#f7d879\" d=\"M100 80L84.4 148.2\"/><path stroke=\"#8ce2a3\" d=\"M100 80L36.9 110.4\"/><path stroke=\"#79d8ef\" d=\"M100 80L36.9 49.6\"/><path stroke=\"#9a9cf5\" d=\"M100 80L84.4 11.8\"/><path stroke=\"#d59ced\" d=\"M100 80L143.6 25.3\"/>"
      ]
    ]
  ]
};
  for(const [cycle,layers] of Object.values(LEGENDARY_MOTIFS)){
    for(const layer of layers)Object.freeze(layer);
    Object.freeze(layers);
  }
  for(const profile of Object.values(LEGENDARY_MOTIFS))Object.freeze(profile);
  Object.freeze(LEGENDARY_MOTIFS);
  const SIGNATURES={
    thunderwake:[P('arc','storm',1,1,8,160)],
    spring:[P('fall','petal',16,6,13,12),P('burst','flower',3,1,22,64)],
    summer:[P('heat','sunbeam',3,1,19,110,'top'),P('glint','droplet',8,3,10,7)],
    autumn:[P('fall','leaf',18,7,13,16),P('gust','leaf',3,1,21,75)],
    winter:[P('fall','snow',20,8,16,7),P('prism','frost',2,1,25,90)],
    newyear:[P('burst','firework',4,1,18,100,'top'),P('fall','confetti',12,5,11,9)],
    valentine:[P('rise','heart',10,4,14,12),P('orbit','ribbon',3,1,20,70)],
    stpatrick:[P('fall','clover',14,6,14,15),P('prism','gold',2,1,20,65)],
    easter:[P('fall','blossom',14,6,14,13),P('burst','flower',3,1,22,54)],
    independence:[P('burst','firework',5,2,20,110,'top'),P('glint','star',6,2,10,7)],
    halloween:[P('swell','fog',3,1,24,160),P('heat','lantern',4,2,19,20)],
    thanksgiving:[P('fall','leaf',14,6,15,17),P('gust','wheat',3,1,24,85)],
    christmas:[P('fall','snow',18,7,16,7),P('glint','light',6,2,12,6)],
    midnight:[P('glint','star',12,5,8,5,'top'),P('ripple','water',3,1,18,100)],
    aurora:[P('swell','aurora',4,2,23,190,'top'),P('glint','star',6,2,14,4,'top')],
    sakura:[P('fall','blossom',20,8,14,14),P('gust','ribbon',3,1,22,100)],
    ocean:[P('swell','wave',4,2,20,170),P('ripple','foam',3,1,14,105)],
    ember:[P('rise','ember',14,6,11,6),P('heat','coal',2,1,18,60)],
    royal:[P('prism','gold',4,2,22,105),P('ripple','water',3,1,16,70)],
    cyber:[P('arc','electric',2,1,8,160)],
    forest:[P('fall','leaf',10,4,17,11),P('glint','seed',8,3,12,5)],
    cosmic:[P('orbit','star',6,2,26,14,'top'),P('swell','nebula',3,1,24,145)],
    sunrise:[P('heat','sunbeam',3,1,22,140,'top'),P('burst','sun',3,1,26,95,'top')],
    /* Version identities are journeys through their regions, not mineral finishes. */
    gold:[P('swell','sunlight',2,1,18,110,'top')],
    silver:[P('swell','fog',2,1,18,160)],
    ruby:[P('swell','terrain',2,1,18,150)],
    sapphire:[P('swell','wave',3,1,18,145)],
    emerald:[P('swell','corridor',3,1,18,150)],
    diamond:[P('prism','frost',2,1,18,90)],
    pearl:[P('swell','reflection',2,1,20,145)],
    platinum:[P('swell','fog',2,1,22,130)],
    quartz:[P('prism','crystal',5,2,21,105),P('glint','facet',4,2,18,8)],
    opal:[P('prism','opal',5,2,20,80),P('glint','soft',4,2,15,10)],
    topaz:[P('prism','facet',4,2,19,100),P('heat','amber',2,1,20,55)],
    jade:[P('prism','jade',3,1,25,120),P('ripple','water',3,1,20,65)],
    obsidian:[P('prism','fracture',4,2,24,130),P('heat','coal',2,1,24,30)],
    amethyst:[P('prism','cluster',5,2,22,90),P('glint','facet',5,2,16,7)],
    crimsonblack:[P('prism','shell',2,1,20,80)],
    cobaltblack:[P('gust','reflection',2,1,20,85)],
    metallicrose:[P('prism','rose',2,1,22,105)],
    bronzexl:[P('prism','bronze',2,1,25,115)],
    blackwhitedsi:[P('prism','split',2,1,18,90)],
    galaxystyle:[P('glint','star',7,3,12,5,'top')],
    superfamicom:[P('glint','button',4,2,22,9)],
    hooh:[...LEGENDARY_MOTIFS.hooh[1].map((_,i)=>P('motif',String(i),2,1,22,210,'legendary'))],
    lugia:[...LEGENDARY_MOTIFS.lugia[1].map((_,i)=>P('motif',String(i),2,1,20,210,'legendary'))],
    suicune:[...LEGENDARY_MOTIFS.suicune[1].map((_,i)=>P('motif',String(i),2,1,18,210,'legendary'))],
    groudon:[...LEGENDARY_MOTIFS.groudon[1].map((_,i)=>P('motif',String(i),2,1,20,210,'legendary'))],
    kyogre:[P('fall','rain',14,6,11,22),...LEGENDARY_MOTIFS.kyogre[1].map((_,i)=>P('motif',String(i),2,1,20,210,'legendary'))],
    rayquaza:[...LEGENDARY_MOTIFS.rayquaza[1].map((_,i)=>P('motif',String(i),2,1,20,210,'legendary'))],
    shinyprimalgroudon:[...LEGENDARY_MOTIFS.shinyprimalgroudon[1].map((_,i)=>P('motif',String(i),2,1,18,210,'legendary'))],
    shinyprimalkyogre:[P('fall','rain',18,7,11,25),...LEGENDARY_MOTIFS.shinyprimalkyogre[1].map((_,i)=>P('motif',String(i),2,1,18,210,'legendary'))],
    shinymegarayquaza:[...LEGENDARY_MOTIFS.shinymegarayquaza[1].map((_,i)=>P('motif',String(i),2,1,17,210,'legendary'))],
    dialga:[...LEGENDARY_MOTIFS.dialga[1].map((_,i)=>P('motif',String(i),2,1,24,210,'legendary'))],
    palkia:[...LEGENDARY_MOTIFS.palkia[1].map((_,i)=>P('motif',String(i),2,1,23,210,'legendary'))],
    giratina:[...LEGENDARY_MOTIFS.giratina[1].map((_,i)=>P('motif',String(i),2,1,25,210,'legendary'))],
    arceus:[...LEGENDARY_MOTIFS.arceus[1].map((_,i)=>P('motif',String(i),2,1,26,210,'legendary'))],
    reshiram:[...LEGENDARY_MOTIFS.reshiram[1].map((_,i)=>P('motif',String(i),2,1,19,210,'legendary'))],
    zekrom:[P('trace','generator',3,1,8,160,'charge'),...LEGENDARY_MOTIFS.zekrom[1].map((_,i)=>P('motif',String(i),2,1,16,210,'legendary'))],
    blackkyurem:[...LEGENDARY_MOTIFS.blackkyurem[1].map((_,i)=>P('motif',String(i),2,1,19,210,'legendary'))],
    whitekyurem:[...LEGENDARY_MOTIFS.whitekyurem[1].map((_,i)=>P('motif',String(i),2,1,20,210,'legendary'))],
    xerneas:[...LEGENDARY_MOTIFS.xerneas[1].map((_,i)=>P('motif',String(i),2,1,24,210,'legendary'))],
    yveltal:[...LEGENDARY_MOTIFS.yveltal[1].map((_,i)=>P('motif',String(i),2,1,24,210,'legendary'))],
    zygarde:[],
    solgaleo:[...LEGENDARY_MOTIFS.solgaleo[1].map((_,i)=>P('motif',String(i),2,1,24,210,'legendary'))],
    lunala:[...LEGENDARY_MOTIFS.lunala[1].map((_,i)=>P('motif',String(i),2,1,26,210,'legendary'))],
    ultranecrozma:[...LEGENDARY_MOTIFS.ultranecrozma[1].map((_,i)=>P('motif',String(i),2,1,20,210,'legendary'))],
    zacian:[...LEGENDARY_MOTIFS.zacian[1].map((_,i)=>P('motif',String(i),2,1,17,210,'legendary'))],
    zamazenta:[...LEGENDARY_MOTIFS.zamazenta[1].map((_,i)=>P('motif',String(i),2,1,19,210,'legendary'))],
    eternatus:[...LEGENDARY_MOTIFS.eternatus[1].map((_,i)=>P('motif',String(i),2,1,24,210,'legendary'))],
    koraidon:[...LEGENDARY_MOTIFS.koraidon[1].map((_,i)=>P('motif',String(i),2,1,18,210,'legendary'))],
    miraidon:[], // Hadron accents are synchronized to actual motherboard packet routes.
    terapagos:[...LEGENDARY_MOTIFS.terapagos[1].map((_,i)=>P('motif',String(i),2,1,26,210,'legendary'))],
  };
  for(const value of Object.values(SIGNATURES))Object.freeze(value);
  Object.freeze(SIGNATURES);
  const ROUTES=[[[0,20],[48,20],[48,64],[104,64],[104,30],[154,30]],[[0,64],[36,64],[36,20],[98,20],[98,64],[154,64]],[[0,36],[62,36],[62,70],[122,70],[122,12],[154,12]]];
  const SVG_OPEN='<svg viewBox="-8 -8 176 100" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">';
  const TRACE_OPEN='<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">';
  /* Full-page signature modules: each theme key maps to at most one engine. */
  const MODULE_KEYS=Object.freeze({
    motherboard:technology,
    cells:Object.freeze(['zygarde']),
    quake:Object.freeze(['groudon','shinyprimalgroudon']),
    gems:Object.freeze(['ruby','sapphire','emerald','diamond','pearl','gold','silver','platinum']),
    wind:Object.freeze(['lugia','rayquaza','shinymegarayquaza','zacian'])
  });
  const ENGINES={motherboard:'EvertaleMotherboard',cells:'EvertaleCells',quake:'EvertaleQuake',gems:'EvertaleGems',wind:'EvertaleWind'};
  function moduleFor(key){return Object.keys(MODULE_KEYS).find(name=>MODULE_KEYS[name].includes(key))||null;}
  function clearModule(){
    if(!moduleHost)return;
    for(const api of Object.values(ENGINES))g[api]?.clear(moduleHost);
    moduleHost.remove();moduleHost=null;
  }
  function mountModule(key){
    const name=moduleFor(key),engine=name&&g[ENGINES[name]];
    if(!engine)return;
    moduleHost=node('div','themeMotionModuleHost');moduleHost.setAttribute('data-engine',name);
    particles.appendChild(moduleHost);engine.render(moduleHost,{key,mobile:!!density?.matches});
  }
  function seeded(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^(h>>>15),2246822507);h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
  function syncParticles(key){
    const parts=key&&SIGNATURES[key];
    if(!parts){clearModule();if(particles){particles.hidden=true;particles.replaceChildren();}particleKey='';return;}
    if(!particles){particles=node('div','themeMotionParticles');particles.id='themeMotionParticles';particles.setAttribute('aria-hidden','true');}
    if(particles.parentNode!==d.body)d.body.appendChild(particles);
    particles.hidden=false;
    const bucket=`${key}:${!!density?.matches}`;
    if(particleKey===bucket)return;
    clearModule();
    const rand=seeded(key),colors=['var(--site-theme-accent)','color-mix(in srgb,var(--site-theme-accent) 65%,var(--site-theme-ink))','var(--site-theme-ink)'],spans=[];
    parts.forEach((part,group)=>{
      for(let i=0;i<part.count;i++){
        const p=node('span','themeMotionParticle');
        p.setAttribute('data-primitive',part.type);p.setAttribute('data-shape',part.shape);p.setAttribute('data-mobile',String(i<part.phone));
        if(part.type==='motif'){
          const [cycle,layers]=LEGENDARY_MOTIFS[key],layer=layers[Number(part.shape)];
          const [role,motion,color,markup]=layer;
          p.setAttribute('data-motif-key',key);p.setAttribute('data-motif-role',role);
          p.setAttribute('data-motif-motion',motion);
          p.innerHTML='<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">'+markup+'</svg>';
          const left=i===0,vars={'--x':left?'14%':'86%','--y':left?'31%':'69%',
            '--mx':'79%','--my':'36%','--s':'210px','--d':cycle+'s',
            '--delay':(left?-cycle*.12:-cycle*.60)+'s','--c':color};
          for(const[k,v]of Object.entries(vars))p.style.setProperty(k,v);
          spans.push(p);continue;
        }
        const x=4+rand()*90;
        const y=part.region==='top'?8+rand()*20:part.region==='charge'?18+i*19:8+rand()*80;
        const duration=['arc','clock'].includes(part.type)||part.region==='charge'||part.shape==='stellar'?part.duration:part.duration*(.9+rand()*.2);
        const phase=part.region==='charge'?-duration*.3:part.shape==='stellar'?-i*3:-rand()*duration;
        const vars={'--x':`${x.toFixed(2)}%`,'--y':`${y.toFixed(2)}vh`,'--mx':`${(4+rand()*84).toFixed(2)}%`,'--my':`${(8+rand()*80).toFixed(2)}vh`,
          '--s':`${(part.size*(.85+rand()*.3)).toFixed(1)}px`,'--d':`${duration.toFixed(2)}s`,'--delay':`${phase.toFixed(2)}s`,
          '--dx':`${((rand()-.5)*18).toFixed(2)}vw`,'--r':`${Math.round((rand()-.5)*120)}deg`,'--o':(.5+rand()*.2).toFixed(2),
          '--c':colors[(i+group)%3],'--direction':i%2?'-1':'1'};
        if(part.type==='trace'){
          const route=part.shape==='generator'?3:part.shape==='cell-link'?4:(i+key.length)%ROUTES.length;
          const points=route===3?[[0,60],[30,50],[55,22],[86,22],[116,50],[154,60]]:route===4?[[0,44],[26,0],[76,0],[102,44],[76,88],[26,88]]:ROUTES[route];
          p.setAttribute('data-route',String(route));
          p.innerHTML=TRACE_OPEN+`<path d="M${points.map(point=>point.join(' ')).join(' L')}"/>`+points.filter((_,index)=>index===0||index===2||index===4||index===5).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.3"/>`).join('')+'</svg>';
          points.forEach(([x,y],index)=>{vars[`--p${index}x`]=`${x}px`;vars[`--p${index}y`]=`${y}px`;});
          p.appendChild(node('i','themeMotionPacket'));
        }else if(part.type==='hex'){
          p.innerHTML='<svg viewBox="-8 -8 64 56" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path class="themeMotionCellA" d="M0 20 L12 0 H36 L48 20"/><path class="themeMotionCellB" d="M48 20 L36 40 H12 L0 20"/></svg>';
        }else if(part.type==='arc'){
          const ice=part.shape==='ice'?'<path class="themeMotionIce" d="M20 10 L44 4 L60 28 L48 74 L18 62 Z M100 8 L132 2 L150 34 L125 70 L104 56 Z"/>':'';
          p.innerHTML=SVG_OPEN+ice+'<path class="themeMotionArc" d="M0 46 L42 32 L28 56 L82 26"/><path class="themeMotionArc themeMotionArc--mid" d="M82 26 L68 52 L154 16"/><path class="themeMotionArc themeMotionArc--branch" d="M68 52 L84 72 L110 62"/></svg>';
        }else if(part.shape==='iceheat'){
          p.innerHTML=SVG_OPEN+'<path class="themeMotionIce" d="M24 4 L80 0 L135 26 L118 78 L40 85 L8 40 Z"/><path class="themeMotionWarm" d="M24 58 Q58 15 85 48 T139 24"/></svg>';
        }else if(['gust','swell','rift','heat','burst'].includes(part.type)){
          const shapes={
            gust:part.shape==='leaf'?'M10 70 Q20 0 120 12 Q154 68 60 78 Z M15 65 L125 17 M50 55 L44 30 M80 42 L90 62':part.shape==='blade'?'M0 65 L160 15 M30 75 L135 44':part.shape==='deflect'?'M0 42 H65 M65 42 Q100 12 155 3 M65 42 Q100 74 155 82':'M0 52 Q44 4 90 36 T160 25 M36 70 Q80 30 142 54',
            swell:part.shape==='grass'?'M12 85 Q25 50 10 14 M40 85 Q58 48 40 0 M72 85 Q90 60 83 18 M120 85 Q130 50 114 15 M145 85 Q158 50 147 30':'M0 46 Q30 8 62 42 T122 38 T160 26 M8 65 Q40 28 78 61 T152 52',
            rift:'M72 0 Q113 20 77 42 T87 85 M88 0 Q56 22 92 44 T84 85',
            heat:part.shape==='stair'?'M0 80 H40 V60 H80 V40 H120 V20 H160':part.shape==='core'?'M80 8 A34 34 0 1 1 79 8 M80 10 L80 0 M110 28 L150 8 M112 56 L155 80 M52 56 L8 80 M50 28 L8 4':part.shape==='sunbeam'?'M0 80 L70 0 M40 85 L105 0 M90 85 L150 0':part.shape==='corona'?'M80 5 A36 36 0 1 1 79 5 M80 0 V12 M130 42 H116 M80 85 V72 M28 42 H43':part.shape==='turbine'?'M80 42 Q118 0 132 30 T82 72 T35 22 T94 8':'M0 64 L25 47 L45 54 L65 27 L84 38 L115 10 L138 25 L160 2',
            burst:part.shape==='flower'?'M80 42 C40 20 60 0 80 20 C102 0 122 20 88 40 C132 30 145 60 100 58 C118 88 85 92 80 65 C48 92 27 76 62 54 C15 56 27 25 80 42 Z':part.shape==='fissure'?'M0 72 L38 56 L48 34 L79 40 L109 12 L145 20 M48 34 L40 10 M79 40 L98 70':part.shape==='antler'?'M80 85 V46 L44 18 M64 35 L62 8 M44 18 L22 22 M80 46 L120 18 M104 32 L102 5 M120 18 L145 24':'M80 40 L80 0 M80 40 L112 8 M80 40 L155 40 M80 40 L123 73 M80 40 L80 85 M80 40 L39 75 M80 40 L0 40 M80 40 L35 5'
          };
          const opening=part.type==='rift'?SVG_OPEN.replace('viewBox="-8 -8 176 100"','viewBox="50 -8 70 100" preserveAspectRatio="none"'):SVG_OPEN;
          p.innerHTML=opening+`<path d="${shapes[part.type]}"/></svg>`;
        }
        for(const[k,v]of Object.entries(vars))p.style.setProperty(k,v);
        spans.push(p);
      }
    });
    particles.setAttribute('data-scene-key',key);
    particles.replaceChildren(...spans);mountModule(key);particleKey=bucket;
  }
  function syncImage(){
    const profile=profiles[active];
    if(!artNode||!profile?.art)return;
    const src=new URL(mobile?.matches?profile.artMobile:profile.art,assetBase).href;
    if(artNode.getAttribute('src')!==src)artNode.setAttribute('src',src);
  }
  function node(tag,cls,text){const n=d.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;}
  function syncButtons(){
    g.EvertaleTheme.syncMotionControls();
  }
  function button(){
    const b=node('button','themeMotionToggle');b.type='button';
    g.EvertaleTheme.bindMotionControl(b);
    return b;
  }
  function sync(){
    if(!d.body)return;
    const preview=d.querySelector('.preview-controls');
    if(preview&&!preview.querySelector('.themeMotionToggle'))preview.appendChild(button());
    const cfg=g.EvertaleTheme.getActiveTheme(),profile=profiles[cfg.key];
    const elemental=cfg.material==='elemental';
    if(elemental||!profile){
      if(scene){scene.hidden=true;scene.replaceChildren();}
      active='';artNode=null;d.documentElement.removeAttribute('data-theme-scene');d.documentElement.removeAttribute('data-theme-illustrated');syncParticles(cfg.key);syncButtons();return;
    }
    const host=d.getElementById('siteThemeFx');
    if(!host)return;
    if(cfg.material==='legendary'){
      const encounter=d.getElementById('pokemonEncounter');
      if(encounter&&!encounter.querySelector('.themeMotionToggle'))encounter.appendChild(button());
    }
    if(!scene){scene=node('div','themeMotionScene');scene.id='themeMotionScene';scene.setAttribute('aria-hidden','true');}
    if(scene.parentNode!==host)host.appendChild(scene);
    scene.hidden=false;
    if(active!==cfg.key){
      d.documentElement.removeAttribute('data-theme-illustrated');
      artNode=null;
      scene.setAttribute('data-illustrated',String(!!profile.art));
      const layers=profile.layers.map(layer=>{
        const part=node('div','themeMotionLayer');
        part.setAttribute('data-layer',layer.id);
        part.setAttribute('data-mobile',String(layer.mobile));
        part.innerHTML=`<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">${layer.svg}</svg>`;
        return part;
      });
      if(profile.art){
        const art=node('img','themeMotionArt');art.alt='';art.setAttribute('aria-hidden','true');art.decoding='async';
        art.addEventListener('load',()=>{if(artNode===art&&d.documentElement.getAttribute('data-theme-key')===cfg.key)d.documentElement.setAttribute('data-theme-illustrated',cfg.key);});
        art.addEventListener('error',()=>{if(artNode===art&&d.documentElement.getAttribute('data-theme-key')===cfg.key)d.documentElement.removeAttribute('data-theme-illustrated');});
        artNode=art;layers.unshift(art);
      }
      scene.replaceChildren(...layers);scene.setAttribute('data-scene-key',cfg.key);active=cfg.key;
    }
    syncImage();d.documentElement.setAttribute('data-theme-scene',cfg.key);syncParticles(cfg.key);syncButtons();
  }
  g.EvertaleThemeMotion={keys:Object.freeze(Object.keys(profiles)),signatures:SIGNATURES,technology,modules:MODULE_KEYS,motifs:LEGENDARY_MOTIFS,moduleFor,sync};
  d.addEventListener('evertale:theme-applied',sync);
  mobile?.addEventListener?.('change',syncImage);
  density?.addEventListener?.('change',sync);
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',sync,{once:true}):sync();
})(window,document);
