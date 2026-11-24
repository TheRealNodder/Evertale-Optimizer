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
        "clock-face",
        "clockcase",
        "#d5e8f4",
        "<defs><radialGradient id=\"MOTIFID-face\" ><stop offset=\"0\" stop-color=\"#345d8f\" stop-opacity=\"1\"/><stop offset=\"0.5\" stop-color=\"#182b4d\" stop-opacity=\"1\"/><stop offset=\"0.83\" stop-color=\"#10223d\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#060d20\" stop-opacity=\"1\"/></radialGradient><linearGradient id=\"MOTIFID-metal\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#eff2d8\" stop-opacity=\"1\"/><stop offset=\"0.24\" stop-color=\"#718da7\" stop-opacity=\"1\"/><stop offset=\"0.48\" stop-color=\"#213d62\" stop-opacity=\"1\"/><stop offset=\"0.7\" stop-color=\"#9ccde3\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#304c70\" stop-opacity=\"1\"/></linearGradient></defs><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(0 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(7.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(15 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(22.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(30 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(37.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(45 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(52.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(60 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(67.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(75 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(82.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(90 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(97.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(105 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(112.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(120 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(127.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(135 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(142.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(150 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(157.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(165 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(172.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(180 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(187.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(195 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(202.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(210 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(217.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(225 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(232.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(240 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(247.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(255 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(262.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(270 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(277.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(285 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(292.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(300 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(307.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(315 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(322.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(330 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(337.5 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(345 100 80)\"/><rect x=\"98\" y=\"5\" width=\"4\" height=\"7\" rx=\".65\" fill=\"#3a7395\" stroke=\"#95c8df\" stroke-width=\".45\" transform=\"rotate(352.5 100 80)\"/><circle cx=\"100\" cy=\"80\" r=\"70\" fill=\"url(#MOTIFID-metal)\" stroke=\"none\" /><circle cx=\"100\" cy=\"80\" r=\"64\" fill=\"url(#MOTIFID-face)\" stroke=\"none\" /><circle cx=\"100\" cy=\"80\" r=\"63\" stroke=\"#b8e1f4\" stroke-width=\"1\" fill=\"none\"/><circle cx=\"100\" cy=\"80\" r=\"51\" stroke=\"#43688e\" stroke-width=\".75\" fill=\"none\"/><path d=\"M100 27L100 18\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M106.06 22.32L106.48 18.34\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M112.06 23.27L112.89 19.35\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M117.92 24.84L119.16 21.03\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M123.59 27.01L125.22 23.36\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M126.5 34.1L131 26.31\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M134.09 33.08L136.44 29.84\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M138.81 36.9L141.49 33.93\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M143.1 41.19L146.07 38.51\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M146.92 45.91L150.16 43.56\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M145.9 53.5L153.69 49\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M152.99 56.41L156.64 54.78\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M155.16 62.08L158.97 60.84\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M156.73 67.94L160.65 67.11\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M157.68 73.94L161.66 73.52\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M153 80L162 80\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M157.68 86.06L161.66 86.48\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M156.73 92.06L160.65 92.89\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M155.16 97.92L158.97 99.16\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M152.99 103.59L156.64 105.22\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M145.9 106.5L153.69 111\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M146.92 114.09L150.16 116.44\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M143.1 118.81L146.07 121.49\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M138.81 123.1L141.49 126.07\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M134.09 126.92L136.44 130.16\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M126.5 125.9L131 133.69\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M123.59 132.99L125.22 136.64\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M117.92 135.16L119.16 138.97\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M112.06 136.73L112.89 140.65\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M106.06 137.68L106.48 141.66\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M100 133L100 142\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M93.94 137.68L93.52 141.66\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M87.94 136.73L87.11 140.65\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M82.08 135.16L80.84 138.97\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M76.41 132.99L74.78 136.64\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M73.5 125.9L69 133.69\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M65.91 126.92L63.56 130.16\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M61.19 123.1L58.51 126.07\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M56.9 118.81L53.93 121.49\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M53.08 114.09L49.84 116.44\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M54.1 106.5L46.31 111\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M47.01 103.59L43.36 105.22\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M44.84 97.92L41.03 99.16\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M43.27 92.06L39.35 92.89\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M42.32 86.06L38.34 86.48\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M47 80L38 80\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M42.32 73.94L38.34 73.52\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M43.27 67.94L39.35 67.11\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M44.84 62.08L41.03 60.84\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M47.01 56.41L43.36 54.78\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M54.1 53.5L46.31 49\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M53.08 45.91L49.84 43.56\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M56.9 41.19L53.93 38.51\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M61.19 36.9L58.51 33.93\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M65.91 33.08L63.56 29.84\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M73.5 34.1L69 26.31\" fill=\"none\" stroke=\"#f7e4b0\" stroke-width=\"1.4\"/><path d=\"M76.41 27.01L74.78 23.36\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M82.08 24.84L80.84 21.03\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M87.94 23.27L87.11 19.35\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><path d=\"M93.94 22.32L93.52 18.34\" fill=\"none\" stroke=\"#95bfd8\" stroke-width=\"0.58\"/><text x=\"100\" y=\"39\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">XII</text><text x=\"122\" y=\"44.89\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">I</text><text x=\"138.11\" y=\"61\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">II</text><text x=\"144\" y=\"83\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">III</text><text x=\"138.11\" y=\"105\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">IV</text><text x=\"122\" y=\"121.11\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">V</text><text x=\"100\" y=\"127\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">VI</text><text x=\"78\" y=\"121.11\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">VII</text><text x=\"61.89\" y=\"105\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">VIII</text><text x=\"56\" y=\"83\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">IX</text><text x=\"61.89\" y=\"61\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">X</text><text x=\"78\" y=\"44.89\" fill=\"#e1edf4\" stroke=\"none\" font-size=\"10\" font-family=\"Georgia,serif\" font-weight=\"bold\" text-anchor=\"middle\">XI</text><ellipse cx=\"100\" cy=\"112\" rx=\"15\" ry=\"13\" fill=\"#0b1630\" stroke=\"none\" opacity=\".95\"/><circle cx=\"100\" cy=\"112\" r=\"8\" fill=\"#b9cbe8\" stroke=\"none\" /><path d=\"M103 105A8 8 0 1 0 103 119A8 8 0 0 1 103 105Z\" fill=\"#233c68\" stroke=\"none\" /><path d=\"M82 99Q100 104 118 99\" fill=\"none\" stroke=\"#8eb8d5\" stroke-width=\".45\"/><circle cx=\"100\" cy=\"80\" r=\"4.6\" fill=\"#d7b984\" stroke=\"none\" />"
      ],
      [
        "hour-hand",
        "hourflow",
        "#edf2e6",
        "<g transform=\"rotate(60 100 80)\"><path d=\"M97.1 89L98.695 53L100 46L101.305 53L102.9 89Z\" fill=\"#e8dcc0\" stroke=\"#06172a\" stroke-width=\".65\"/><circle cx=\"100\" cy=\"80\" r=\"2.5\" fill=\"#d5e7eb\" stroke=\"none\" /></g>"
      ],
      [
        "minute-hand",
        "minuteflow",
        "#c8f0ff",
        "<g transform=\"rotate(102 100 80)\"><path d=\"M98.2 89L99.19 37L100 30L100.81 37L101.8 89Z\" fill=\"#c5e8f8\" stroke=\"#06172a\" stroke-width=\".65\"/><circle cx=\"100\" cy=\"80\" r=\"2.5\" fill=\"#d5e7eb\" stroke=\"none\" /></g>"
      ],
      [
        "second-hand",
        "secondflow",
        "#f7d58d",
        "<g transform=\"rotate(198 100 80)\"><path d=\"M100 96V21\" fill=\"none\" stroke=\"#f2d48d\" stroke-width=\"1.2\"/><circle cx=\"100\" cy=\"90\" r=\"2.3\" fill=\"#d7ad5f\" stroke=\"none\" /><circle cx=\"100\" cy=\"80\" r=\"2\" fill=\"#f7e8c3\" stroke=\"none\" /></g>"
      ],
      [
        "hourglass",
        "glasscase",
        "#c4ddf1",
        "<defs><linearGradient id=\"MOTIFID-glass\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#9dcbe7\" stop-opacity=\"0.3\"/><stop offset=\"0.17\" stop-color=\"#365a7c\" stop-opacity=\"0.12\"/><stop offset=\"0.45\" stop-color=\"#172b49\" stop-opacity=\"0.12\"/><stop offset=\"0.8\" stop-color=\"#99d5f2\" stop-opacity=\"0.21\"/><stop offset=\"1\" stop-color=\"#d8f7ff\" stop-opacity=\"0.35\"/></linearGradient><linearGradient id=\"MOTIFID-frame\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#b4d8ed\" stop-opacity=\"1\"/><stop offset=\"0.24\" stop-color=\"#5a7b9c\" stop-opacity=\"1\"/><stop offset=\"0.52\" stop-color=\"#182d49\" stop-opacity=\"1\"/><stop offset=\"0.75\" stop-color=\"#bdddeb\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#496382\" stop-opacity=\"1\"/></linearGradient></defs><path d=\"M60 22H140C140 46 128 55 111 69Q103 75 103 80Q103 85 111 91C128 105 140 114 140 138H60C60 114 72 105 89 91Q97 85 97 80Q97 75 89 69C72 55 60 46 60 22Z\" fill=\"url(#MOTIFID-glass)\" stroke=\"#a5d2ec\" stroke-width=\"1.1\"/><path d=\"M66 27C66 50 85 59 96 72M134 27C134 44 127 50 116 60M66 133C66 111 85 102 96 89M134 133C134 118 128 108 117 98\" fill=\"none\" stroke=\"#d0edf7\" stroke-width=\".8\" opacity=\".63\"/><rect x=\"52\" y=\"12\" width=\"96\" height=\"10\" fill=\"url(#MOTIFID-frame)\" stroke=\"none\" rx=\"3\"/><rect x=\"52\" y=\"138\" width=\"96\" height=\"10\" fill=\"url(#MOTIFID-frame)\" stroke=\"none\" rx=\"3\"/><rect x=\"55\" y=\"21\" width=\"5\" height=\"117\" fill=\"url(#MOTIFID-frame)\" stroke=\"none\" rx=\"2\"/><rect x=\"140\" y=\"21\" width=\"5\" height=\"117\" fill=\"url(#MOTIFID-frame)\" stroke=\"none\" rx=\"2\"/><rect x=\"47\" y=\"8\" width=\"106\" height=\"5\" fill=\"#aec7db\" stroke=\"none\" rx=\"2\" opacity=\".92\"/><rect x=\"47\" y=\"148\" width=\"106\" height=\"5\" fill=\"#aec7db\" stroke=\"none\" rx=\"2\" opacity=\".92\"/>"
      ],
      [
        "sand-upper",
        "sandupper",
        "#edce8e",
        "<defs><linearGradient id=\"MOTIFID-sand\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#ffefbb\" stop-opacity=\"1\"/><stop offset=\"0.35\" stop-color=\"#d6b66d\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#715b40\" stop-opacity=\"1\"/></linearGradient><clipPath id=\"MOTIFID-bulb\"><path d=\"M60 22H140C140 46 128 55 111 69Q103 75 103 80Q103 85 111 91C128 105 140 114 140 138H60C60 114 72 105 89 91Q97 85 97 80Q97 75 89 69C72 55 60 46 60 22Z\" fill=\"#fff\" stroke=\"none\" /></clipPath></defs><g clip-path=\"url(#MOTIFID-bulb)\"><path d=\"M61 29Q81 32 100 36T139 29L140 54Q121 66 103 78H97Q80 67 60 54Z\" fill=\"url(#MOTIFID-sand)\" stroke=\"none\" /><path d=\"M61 29Q81 32 100 36T139 29\" fill=\"none\" stroke=\"#fff0be\" stroke-width=\".9\"/><circle cx=\"72\" cy=\"39\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"89\" cy=\"52\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"106\" cy=\"46\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"123\" cy=\"40\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"85\" cy=\"53\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"102\" cy=\"47\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"119\" cy=\"41\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"81\" cy=\"54\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"98\" cy=\"48\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"115\" cy=\"42\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"77\" cy=\"55\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"94\" cy=\"49\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"111\" cy=\"43\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"73\" cy=\"56\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"90\" cy=\"50\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"107\" cy=\"44\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"124\" cy=\"57\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"86\" cy=\"51\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"103\" cy=\"45\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"120\" cy=\"39\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/><circle cx=\"82\" cy=\"52\" r=\"0.55\" fill=\"#f8df9f\" stroke=\"none\" opacity=\".65\"/></g>"
      ],
      [
        "sand-lower",
        "sandlower",
        "#edce8e",
        "<defs><linearGradient id=\"MOTIFID-sand\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#ffefbb\" stop-opacity=\"1\"/><stop offset=\"0.35\" stop-color=\"#d6b66d\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#715b40\" stop-opacity=\"1\"/></linearGradient><clipPath id=\"MOTIFID-bulb\"><path d=\"M60 22H140C140 46 128 55 111 69Q103 75 103 80Q103 85 111 91C128 105 140 114 140 138H60C60 114 72 105 89 91Q97 85 97 80Q97 75 89 69C72 55 60 46 60 22Z\" fill=\"#fff\" stroke=\"none\" /></clipPath></defs><g clip-path=\"url(#MOTIFID-bulb)\"><path d=\"M57 138Q79 130 100 104Q123 131 143 138Z\" fill=\"url(#MOTIFID-sand)\" stroke=\"none\" /><path d=\"M61 137Q80 129 100 104Q121 130 139 137\" fill=\"none\" stroke=\"#ffdf93\" stroke-width=\".8\"/><circle cx=\"74\" cy=\"128\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"93\" cy=\"135\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"112\" cy=\"133\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"78\" cy=\"131\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"97\" cy=\"129\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"116\" cy=\"136\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"82\" cy=\"134\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"101\" cy=\"132\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"120\" cy=\"130\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"86\" cy=\"128\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"105\" cy=\"135\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"124\" cy=\"133\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"90\" cy=\"131\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"109\" cy=\"129\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"75\" cy=\"136\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"94\" cy=\"134\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"113\" cy=\"132\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"79\" cy=\"130\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/><circle cx=\"98\" cy=\"128\" r=\"0.5\" fill=\"#f6daa2\" stroke=\"none\" opacity=\".6\"/></g>"
      ],
      [
        "sand-stream",
        "sandstream",
        "#f9e5b8",
        "<circle cx=\"99.45\" cy=\"77\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.95\"/><circle cx=\"100\" cy=\"80.4\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"100.55\" cy=\"83.8\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.95\"/><circle cx=\"99.45\" cy=\"87.2\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"100\" cy=\"90.6\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.95\"/><circle cx=\"100.55\" cy=\"94\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"99.45\" cy=\"97.4\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.95\"/><circle cx=\"100\" cy=\"100.8\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"100.55\" cy=\"104.2\" r=\"0.54\" fill=\"#ffe8a8\" stroke=\"none\" opacity=\"0.95\"/>"
      ]
    ]
  ],
  "palkia": [
    23,
    [
      [
        "nebula-galaxy",
        "nebula",
        "#cbb4f9",
        "<defs><radialGradient id=\"MOTIFID-space\" ><stop offset=\"0\" stop-color=\"#150c37\" stop-opacity=\"0.98\"/><stop offset=\"0.5\" stop-color=\"#100921\" stop-opacity=\"0.85\"/><stop offset=\"1\" stop-color=\"#090616\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"MOTIFID-rose\" ><stop offset=\"0\" stop-color=\"#e984ba\" stop-opacity=\"0.62\"/><stop offset=\"0.3\" stop-color=\"#b54b9e\" stop-opacity=\"0.4\"/><stop offset=\"0.75\" stop-color=\"#3b245e\" stop-opacity=\"0.2\"/><stop offset=\"1\" stop-color=\"#10071d\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"MOTIFID-blue\" ><stop offset=\"0\" stop-color=\"#8fa8ff\" stop-opacity=\"0.65\"/><stop offset=\"0.42\" stop-color=\"#5562b7\" stop-opacity=\"0.36\"/><stop offset=\"1\" stop-color=\"#17113b\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"MOTIFID-galaxy\" ><stop offset=\"0\" stop-color=\"#fff0e2\" stop-opacity=\"0.9\"/><stop offset=\"0.18\" stop-color=\"#df9eba\" stop-opacity=\"0.66\"/><stop offset=\"0.6\" stop-color=\"#64518d\" stop-opacity=\"0.28\"/><stop offset=\"1\" stop-color=\"#201832\" stop-opacity=\"0\"/></radialGradient></defs><ellipse cx=\"100\" cy=\"80\" rx=\"100\" ry=\"79\" fill=\"url(#MOTIFID-space)\" stroke=\"none\" /><ellipse cx=\"71\" cy=\"62\" rx=\"83\" ry=\"46\" fill=\"url(#MOTIFID-rose)\" stroke=\"none\" transform=\"rotate(-27 71 62)\"/><ellipse cx=\"141\" cy=\"97\" rx=\"65\" ry=\"42\" fill=\"url(#MOTIFID-blue)\" stroke=\"none\" transform=\"rotate(-32 141 97)\"/><ellipse cx=\"100\" cy=\"80\" rx=\"62\" ry=\"28\" fill=\"url(#MOTIFID-galaxy)\" stroke=\"none\" transform=\"rotate(-20 100 80)\"/><path d=\"M39 115C58 82 73 83 93 80S134 59 161 43M47 121C74 111 115 110 138 86S165 56 178 48\" fill=\"none\" stroke=\"#100c29\" stroke-width=\"5\" opacity=\".49\"/><g transform=\"rotate(-20 100 80)\"><circle cx=\"106.16\" cy=\"79\" r=\"0.56\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.53\"/><circle cx=\"105.05\" cy=\"79.39\" r=\"0.26\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.51\"/><circle cx=\"105.17\" cy=\"79.8\" r=\"0.25\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.74\"/><circle cx=\"104.13\" cy=\"80\" r=\"0.57\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"104.4\" cy=\"80.49\" r=\"0.76\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.45\"/><circle cx=\"105.3\" cy=\"81.42\" r=\"0.36\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.31\"/><circle cx=\"104.95\" cy=\"82\" r=\"0.27\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.24\"/><circle cx=\"107.53\" cy=\"85.1\" r=\"0.5\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"105.61\" cy=\"85.31\" r=\"0.68\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.49\"/><circle cx=\"103.51\" cy=\"84.97\" r=\"0.25\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.32\"/><circle cx=\"102.7\" cy=\"87.65\" r=\"0.74\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.83\"/><circle cx=\"100.46\" cy=\"88.3\" r=\"0.76\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.34\"/><circle cx=\"98.12\" cy=\"87.91\" r=\"0.46\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"95.27\" cy=\"88.84\" r=\"0.36\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.42\"/><circle cx=\"93.42\" cy=\"87.54\" r=\"0.54\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.44\"/><circle cx=\"89.93\" cy=\"88.18\" r=\"0.45\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.51\"/><circle cx=\"85.41\" cy=\"88.84\" r=\"0.7\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"83.66\" cy=\"87.31\" r=\"0.63\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.21\"/><circle cx=\"82.32\" cy=\"85.74\" r=\"0.79\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.31\"/><circle cx=\"77.95\" cy=\"85.12\" r=\"0.64\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"75.94\" cy=\"83.51\" r=\"0.35\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.46\"/><circle cx=\"74.15\" cy=\"81.74\" r=\"0.59\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.82\"/><circle cx=\"75.02\" cy=\"79.72\" r=\"0.73\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.79\"/><circle cx=\"75.87\" cy=\"77.86\" r=\"0.5\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.21\"/><circle cx=\"71.71\" cy=\"75.47\" r=\"0.25\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.5\"/><circle cx=\"70.48\" cy=\"72.86\" r=\"0.43\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.2\"/><circle cx=\"74.58\" cy=\"71.36\" r=\"0.42\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.32\"/><circle cx=\"72.9\" cy=\"67.91\" r=\"0.47\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"80.12\" cy=\"68.19\" r=\"0.59\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"79.34\" cy=\"64.07\" r=\"0.33\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.44\"/><circle cx=\"81.97\" cy=\"61.23\" r=\"0.7\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.69\"/><circle cx=\"86.97\" cy=\"60.36\" r=\"0.55\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.85\"/><circle cx=\"92.78\" cy=\"61.6\" r=\"0.79\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.42\"/><circle cx=\"97.11\" cy=\"59.59\" r=\"0.32\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.6\"/><circle cx=\"102.17\" cy=\"59.56\" r=\"0.72\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.28\"/><circle cx=\"107.71\" cy=\"58.52\" r=\"0.28\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"112.21\" cy=\"60.41\" r=\"0.46\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"120.1\" cy=\"58.22\" r=\"0.4\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.55\"/><circle cx=\"126.27\" cy=\"59.2\" r=\"0.75\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.27\"/><circle cx=\"131.94\" cy=\"60.92\" r=\"0.6\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.25\"/><circle cx=\"132.36\" cy=\"65.2\" r=\"0.31\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.53\"/><circle cx=\"137.88\" cy=\"67.07\" r=\"0.26\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.63\"/><circle cx=\"141.51\" cy=\"69.85\" r=\"0.54\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.51\"/><circle cx=\"148.29\" cy=\"72.42\" r=\"0.29\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.69\"/><circle cx=\"150.17\" cy=\"76.09\" r=\"0.57\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.64\"/><circle cx=\"146.76\" cy=\"79.84\" r=\"0.25\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.79\"/><circle cx=\"147.72\" cy=\"83.52\" r=\"0.79\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"150.99\" cy=\"87.95\" r=\"0.56\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.73\"/><circle cx=\"73.73\" cy=\"79\" r=\"0.7\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"75.44\" cy=\"77.13\" r=\"0.31\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"71.9\" cy=\"74.63\" r=\"0.56\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.66\"/><circle cx=\"71.45\" cy=\"72.1\" r=\"0.45\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"77.01\" cy=\"71.19\" r=\"0.49\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.33\"/><circle cx=\"78.14\" cy=\"69.02\" r=\"0.6\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.82\"/><circle cx=\"75.77\" cy=\"64.34\" r=\"0.59\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.26\"/><circle cx=\"79.37\" cy=\"62.29\" r=\"0.36\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.4\"/><circle cx=\"83.34\" cy=\"60.27\" r=\"0.31\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.34\"/><circle cx=\"89.67\" cy=\"61.44\" r=\"0.79\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.48\"/><circle cx=\"93.85\" cy=\"59.31\" r=\"0.63\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.79\"/><circle cx=\"98.99\" cy=\"58.7\" r=\"0.68\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.26\"/><circle cx=\"104.24\" cy=\"58.93\" r=\"0.53\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.49\"/><circle cx=\"109.36\" cy=\"59.53\" r=\"0.3\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.36\"/><circle cx=\"116.71\" cy=\"57.32\" r=\"0.62\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.84\"/><circle cx=\"119.36\" cy=\"61.35\" r=\"0.62\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.75\"/><circle cx=\"125.98\" cy=\"61.48\" r=\"0.77\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.39\"/><circle cx=\"134.04\" cy=\"61.69\" r=\"0.69\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.58\"/><circle cx=\"136.19\" cy=\"65.2\" r=\"0.52\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.22\"/><circle cx=\"144.18\" cy=\"66.74\" r=\"0.76\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.81\"/><circle cx=\"147.59\" cy=\"70.08\" r=\"0.49\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.29\"/><circle cx=\"148.99\" cy=\"73.81\" r=\"0.45\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.23\"/><circle cx=\"147.92\" cy=\"77.61\" r=\"0.78\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.23\"/><circle cx=\"147.71\" cy=\"81.24\" r=\"0.29\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"151.44\" cy=\"85.42\" r=\"0.75\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.66\"/><circle cx=\"146.85\" cy=\"88.74\" r=\"0.44\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.73\"/><circle cx=\"148.36\" cy=\"93.54\" r=\"0.68\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.27\"/><circle cx=\"145.62\" cy=\"97.66\" r=\"0.36\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"138.82\" cy=\"100.1\" r=\"0.45\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.27\"/><circle cx=\"133.41\" cy=\"103.14\" r=\"0.49\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.57\"/><circle cx=\"128.05\" cy=\"106.64\" r=\"0.71\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"119.9\" cy=\"107.47\" r=\"0.52\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.44\"/><circle cx=\"113.25\" cy=\"110.92\" r=\"0.69\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"104.88\" cy=\"111.79\" r=\"0.62\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.22\"/><circle cx=\"96.22\" cy=\"112.86\" r=\"0.3\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"87.87\" cy=\"111.23\" r=\"0.37\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.62\"/><circle cx=\"78.85\" cy=\"111.2\" r=\"0.7\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.34\"/><circle cx=\"70.99\" cy=\"109\" r=\"0.43\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.63\"/><circle cx=\"59.63\" cy=\"109.43\" r=\"0.26\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"55.39\" cy=\"104.24\" r=\"0.38\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.52\"/><circle cx=\"44.12\" cy=\"102.83\" r=\"0.45\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.85\"/><circle cx=\"38.15\" cy=\"98.48\" r=\"0.61\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.71\"/><circle cx=\"35.27\" cy=\"93.27\" r=\"0.36\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"29.07\" cy=\"88.67\" r=\"0.49\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.85\"/><circle cx=\"27.06\" cy=\"83.23\" r=\"0.31\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.54\"/><circle cx=\"25.58\" cy=\"77.66\" r=\"0.65\" fill=\"#ffb6db\" stroke=\"none\" opacity=\"0.31\"/><circle cx=\"30.2\" cy=\"72.38\" r=\"0.47\" fill=\"#a6bbff\" stroke=\"none\" opacity=\"0.25\"/><circle cx=\"28.65\" cy=\"66.48\" r=\"0.52\" fill=\"#f5e0ee\" stroke=\"none\" opacity=\"0.62\"/></g><circle cx=\"18.27\" cy=\"80.67\" r=\"0.46\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.49\"/><path d=\"M16.27 80.67h4M18.27 78.67v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"116.22\" cy=\"137.55\" r=\"0.24\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.63\"/><circle cx=\"49.24\" cy=\"101.78\" r=\"0.48\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.32\"/><circle cx=\"85.41\" cy=\"91.34\" r=\"0.55\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.66\"/><circle cx=\"113.55\" cy=\"73.45\" r=\"0.62\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"148.05\" cy=\"146.92\" r=\"0.28\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"85.67\" cy=\"123.22\" r=\"0.36\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.57\"/><circle cx=\"23.71\" cy=\"143.06\" r=\"0.8\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.45\"/><circle cx=\"26.14\" cy=\"52.77\" r=\"0.59\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.77\"/><circle cx=\"171.93\" cy=\"102\" r=\"0.47\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.85\"/><circle cx=\"57.34\" cy=\"12.13\" r=\"0.37\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.56\"/><circle cx=\"11.35\" cy=\"102.08\" r=\"0.79\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.63\"/><circle cx=\"60.98\" cy=\"95.63\" r=\"0.44\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.41\"/><circle cx=\"140.68\" cy=\"122.15\" r=\"0.57\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.86\"/><circle cx=\"147.57\" cy=\"59.77\" r=\"0.8\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.81\"/><circle cx=\"11.63\" cy=\"7.87\" r=\"0.83\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.47\"/><circle cx=\"187.73\" cy=\"62.98\" r=\"0.8\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.67\"/><circle cx=\"173.58\" cy=\"9.91\" r=\"0.38\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.31\"/><circle cx=\"115.35\" cy=\"27.24\" r=\"0.26\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.36\"/><circle cx=\"160.25\" cy=\"93.99\" r=\"0.8\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.36\"/><path d=\"M158.25 93.99h4M160.25 91.99v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"52.67\" cy=\"21.57\" r=\"0.41\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.5\"/><circle cx=\"188.19\" cy=\"122.84\" r=\"0.77\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"67.19\" cy=\"17.41\" r=\"0.19\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.88\"/><circle cx=\"17.14\" cy=\"9.98\" r=\"0.46\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.64\"/><circle cx=\"130.5\" cy=\"65.85\" r=\"0.74\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.28\"/><circle cx=\"102.27\" cy=\"145.41\" r=\"0.7\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.61\"/><circle cx=\"88.98\" cy=\"146.76\" r=\"0.44\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.36\"/><circle cx=\"98.34\" cy=\"143.19\" r=\"0.59\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"26.31\" cy=\"139.8\" r=\"0.81\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"35.65\" cy=\"110.86\" r=\"0.27\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.68\"/><circle cx=\"67.93\" cy=\"67.27\" r=\"0.32\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.48\"/><circle cx=\"177.92\" cy=\"90.73\" r=\"0.61\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.5\"/><circle cx=\"7.36\" cy=\"8.87\" r=\"0.34\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.41\"/><circle cx=\"132.07\" cy=\"73.09\" r=\"0.53\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.34\"/><circle cx=\"84.37\" cy=\"138.3\" r=\"0.41\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.29\"/><circle cx=\"59.8\" cy=\"131.26\" r=\"0.3\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"65.04\" cy=\"131.8\" r=\"0.85\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"191.11\" cy=\"78.53\" r=\"0.3\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"43.69\" cy=\"48.46\" r=\"0.84\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.32\"/><path d=\"M41.69 48.46h4M43.69 46.46v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"159.66\" cy=\"146.95\" r=\"0.25\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.79\"/><circle cx=\"116.69\" cy=\"132.52\" r=\"0.49\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.6\"/><circle cx=\"60.01\" cy=\"138.02\" r=\"0.8\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.89\"/><circle cx=\"68.15\" cy=\"137.46\" r=\"0.32\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.87\"/><circle cx=\"186.78\" cy=\"45.26\" r=\"0.82\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.39\"/><circle cx=\"17.49\" cy=\"122.02\" r=\"0.67\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.88\"/><circle cx=\"25.59\" cy=\"48.66\" r=\"0.46\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"128.82\" cy=\"18.04\" r=\"0.64\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.85\"/><circle cx=\"105.97\" cy=\"30.92\" r=\"0.51\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.81\"/><circle cx=\"142.34\" cy=\"70.24\" r=\"0.25\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.45\"/><circle cx=\"66.1\" cy=\"115.72\" r=\"0.82\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.62\"/><circle cx=\"57.41\" cy=\"47.8\" r=\"0.21\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.63\"/><circle cx=\"149.4\" cy=\"127.71\" r=\"0.41\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.88\"/><circle cx=\"67.73\" cy=\"77.9\" r=\"0.71\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"53.08\" cy=\"74.5\" r=\"0.77\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.84\"/><circle cx=\"128.16\" cy=\"101.07\" r=\"0.6\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.27\"/><circle cx=\"68.48\" cy=\"150.4\" r=\"0.54\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.44\"/><circle cx=\"103.63\" cy=\"48.44\" r=\"0.37\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.92\"/><circle cx=\"143.3\" cy=\"112.19\" r=\"0.32\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.7\"/><path d=\"M141.3 112.19h4M143.3 110.19v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"119.72\" cy=\"140.83\" r=\"0.75\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.4\"/><circle cx=\"95.75\" cy=\"126.6\" r=\"0.85\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.46\"/><circle cx=\"165.32\" cy=\"109.83\" r=\"0.27\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.34\"/><circle cx=\"30.54\" cy=\"89.79\" r=\"0.33\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.38\"/><circle cx=\"87.01\" cy=\"40.55\" r=\"0.82\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.44\"/><circle cx=\"6.75\" cy=\"118.63\" r=\"0.29\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.71\"/><circle cx=\"165.35\" cy=\"136.49\" r=\"0.46\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.4\"/><circle cx=\"97.56\" cy=\"113.91\" r=\"0.86\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.56\"/><circle cx=\"183.1\" cy=\"6.07\" r=\"0.47\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.76\"/><circle cx=\"81.89\" cy=\"45.39\" r=\"0.59\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"25.3\" cy=\"21.16\" r=\"0.33\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"97.89\" cy=\"58.73\" r=\"0.77\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.71\"/><circle cx=\"101.12\" cy=\"97.47\" r=\"0.66\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.32\"/><circle cx=\"168.32\" cy=\"104.28\" r=\"0.48\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.62\"/>"
      ],
      [
        "space-tear",
        "spatialtear",
        "#fbc3ed",
        "<defs><linearGradient id=\"MOTIFID-rim\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#fce5fb\" stop-opacity=\"1\"/><stop offset=\"0.24\" stop-color=\"#ef7fbf\" stop-opacity=\"1\"/><stop offset=\"0.45\" stop-color=\"#5d329b\" stop-opacity=\"1\"/><stop offset=\"0.66\" stop-color=\"#eaa5e0\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#a5a4ff\" stop-opacity=\"1\"/></linearGradient><radialGradient id=\"MOTIFID-interior\" ><stop offset=\"0\" stop-color=\"#392052\" stop-opacity=\"1\"/><stop offset=\"0.39\" stop-color=\"#160c36\" stop-opacity=\"1\"/><stop offset=\"0.82\" stop-color=\"#05030f\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#10051d\" stop-opacity=\"1\"/></radialGradient><radialGradient id=\"MOTIFID-seam-light\" ><stop offset=\"0\" stop-color=\"#fba6ee\" stop-opacity=\"0.6\"/><stop offset=\"0.4\" stop-color=\"#ae5fce\" stop-opacity=\"0.24\"/><stop offset=\"1\" stop-color=\"#873994\" stop-opacity=\"0\"/></radialGradient><clipPath id=\"MOTIFID-interior-clip\"><path d=\"M129 4L117 20L122 33L102 43L111 57L89 67L99 80L77 96L81 108L57 123L64 136L42 156L66 145L82 137L91 124L103 116L101 102L124 85L115 71L137 55L128 43L146 23L137 20Z\" fill=\"#fff\" stroke=\"none\" /></clipPath></defs><ellipse cx=\"97\" cy=\"81\" rx=\"68\" ry=\"72\" fill=\"url(#MOTIFID-seam-light)\" stroke=\"none\" transform=\"rotate(34 97 81)\"/><path d=\"M129 4L117 20L122 33L102 43L111 57L89 67L99 80L77 96L81 108L57 123L64 136L42 156L66 145L82 137L91 124L103 116L101 102L124 85L115 71L137 55L128 43L146 23L137 20Z\" fill=\"#d46ac9\" stroke=\"#df8fda\" stroke-width=\"8\" opacity=\".27\"/><path d=\"M129 4L117 20L122 33L102 43L111 57L89 67L99 80L77 96L81 108L57 123L64 136L42 156L66 145L82 137L91 124L103 116L101 102L124 85L115 71L137 55L128 43L146 23L137 20Z\" fill=\"url(#MOTIFID-interior)\" stroke=\"url(#MOTIFID-rim)\" stroke-width=\"2.3\" stroke-linejoin=\"miter\"/><g clip-path=\"url(#MOTIFID-interior-clip)\"><ellipse cx=\"104\" cy=\"75\" rx=\"39\" ry=\"62\" fill=\"#0b0625\" stroke=\"none\" /><ellipse cx=\"109\" cy=\"63\" rx=\"17\" ry=\"51\" fill=\"#643070\" stroke=\"none\" opacity=\".36\"/><circle cx=\"162.74\" cy=\"74.79\" r=\"0.73\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.89\"/><path d=\"M160.74 74.79h4M162.74 72.79v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"41.51\" cy=\"138.86\" r=\"0.72\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.3\"/><circle cx=\"68.07\" cy=\"58.87\" r=\"0.63\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.72\"/><circle cx=\"9.74\" cy=\"11.26\" r=\"0.53\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.32\"/><circle cx=\"16.38\" cy=\"46.9\" r=\"0.49\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.69\"/><circle cx=\"131.45\" cy=\"37.45\" r=\"0.28\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.45\"/><circle cx=\"149.19\" cy=\"98.22\" r=\"0.28\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.57\"/><circle cx=\"10.72\" cy=\"18.04\" r=\"0.72\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.68\"/><circle cx=\"29.74\" cy=\"14.07\" r=\"0.34\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.4\"/><circle cx=\"95.58\" cy=\"67.01\" r=\"0.3\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.51\"/><circle cx=\"89.21\" cy=\"79.74\" r=\"0.31\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.55\"/><circle cx=\"185.14\" cy=\"139.77\" r=\"0.71\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.43\"/><circle cx=\"139.68\" cy=\"53.53\" r=\"0.67\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.39\"/><circle cx=\"133.52\" cy=\"58\" r=\"0.82\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"84.09\" cy=\"152.54\" r=\"0.39\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.67\"/><circle cx=\"90.71\" cy=\"31.49\" r=\"0.24\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.33\"/><circle cx=\"162.98\" cy=\"135.45\" r=\"0.64\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.62\"/><circle cx=\"90.31\" cy=\"26.76\" r=\"0.23\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.68\"/><circle cx=\"168.18\" cy=\"82.07\" r=\"0.4\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.79\"/><circle cx=\"124.04\" cy=\"82.58\" r=\"0.49\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.68\"/><path d=\"M122.04 82.58h4M124.04 80.58v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"93.28\" cy=\"19.8\" r=\"0.3\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.51\"/><circle cx=\"133.3\" cy=\"72.39\" r=\"0.82\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.58\"/><circle cx=\"131.1\" cy=\"47\" r=\"0.38\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.5\"/><circle cx=\"107.44\" cy=\"113.59\" r=\"0.74\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.61\"/><circle cx=\"17.91\" cy=\"53.2\" r=\"0.6\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.76\"/><circle cx=\"99\" cy=\"123.65\" r=\"0.57\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"194.61\" cy=\"86.14\" r=\"0.69\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.29\"/><circle cx=\"155.83\" cy=\"23.18\" r=\"0.45\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.5\"/><circle cx=\"34.75\" cy=\"15.82\" r=\"0.75\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.64\"/><circle cx=\"169.98\" cy=\"135.79\" r=\"0.77\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"169.46\" cy=\"145.26\" r=\"0.56\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.78\"/><circle cx=\"23.62\" cy=\"134.93\" r=\"0.66\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.6\"/><circle cx=\"169.18\" cy=\"68.27\" r=\"0.24\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.46\"/><circle cx=\"31.7\" cy=\"137.47\" r=\"0.54\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.36\"/><circle cx=\"132.33\" cy=\"124\" r=\"0.29\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.66\"/><circle cx=\"161.58\" cy=\"44.28\" r=\"0.65\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.89\"/><circle cx=\"100.86\" cy=\"48.43\" r=\"0.33\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.82\"/><circle cx=\"119.45\" cy=\"127.59\" r=\"0.32\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.35\"/><circle cx=\"152.62\" cy=\"72.71\" r=\"0.56\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.42\"/><path d=\"M150.62 72.71h4M152.62 70.71v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"113.71\" cy=\"15.33\" r=\"0.67\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.32\"/><circle cx=\"30.67\" cy=\"118.36\" r=\"0.61\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.49\"/><circle cx=\"15.16\" cy=\"122.22\" r=\"0.55\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.83\"/><circle cx=\"19.41\" cy=\"89.38\" r=\"0.4\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.36\"/><circle cx=\"144.11\" cy=\"127.8\" r=\"0.66\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.57\"/><circle cx=\"27.59\" cy=\"61.17\" r=\"0.44\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.9\"/><circle cx=\"74.32\" cy=\"51.4\" r=\"0.32\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.8\"/><circle cx=\"108.25\" cy=\"66.45\" r=\"0.71\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.4\"/><circle cx=\"13.87\" cy=\"23.84\" r=\"0.26\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.74\"/><circle cx=\"135.5\" cy=\"77.89\" r=\"0.37\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.77\"/><circle cx=\"12.84\" cy=\"106.11\" r=\"0.86\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.57\"/><circle cx=\"158.12\" cy=\"37.74\" r=\"0.84\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.62\"/><circle cx=\"37.93\" cy=\"154.91\" r=\"0.24\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.48\"/><circle cx=\"100.15\" cy=\"84.32\" r=\"0.79\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.55\"/><circle cx=\"153.92\" cy=\"35.04\" r=\"0.78\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.89\"/><circle cx=\"138.24\" cy=\"75.3\" r=\"0.69\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.52\"/><circle cx=\"51.98\" cy=\"28.69\" r=\"0.48\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.52\"/><circle cx=\"45.97\" cy=\"57.96\" r=\"0.6\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.37\"/><circle cx=\"14.93\" cy=\"91.57\" r=\"0.21\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.31\"/><path d=\"M12.93 91.57h4M14.93 89.57v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"164.97\" cy=\"36.27\" r=\"0.76\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.82\"/><circle cx=\"89.3\" cy=\"55.95\" r=\"0.7\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"12.97\" cy=\"84.85\" r=\"0.73\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.53\"/><circle cx=\"124.3\" cy=\"30.56\" r=\"0.19\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.84\"/><circle cx=\"38.69\" cy=\"59.8\" r=\"0.83\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.74\"/><circle cx=\"107.66\" cy=\"97.38\" r=\"0.49\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.58\"/><circle cx=\"63.61\" cy=\"106.44\" r=\"0.68\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.77\"/><circle cx=\"38.35\" cy=\"55.27\" r=\"0.61\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.74\"/><circle cx=\"110.66\" cy=\"13.87\" r=\"0.68\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.49\"/><circle cx=\"96.17\" cy=\"110.52\" r=\"0.77\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.47\"/><circle cx=\"9.69\" cy=\"116.47\" r=\"0.68\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.77\"/><circle cx=\"158.22\" cy=\"114.22\" r=\"0.29\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.85\"/><circle cx=\"59.93\" cy=\"142.21\" r=\"0.82\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.49\"/><circle cx=\"182.21\" cy=\"46.59\" r=\"0.32\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.81\"/><circle cx=\"89.2\" cy=\"57.88\" r=\"0.33\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.67\"/><circle cx=\"126.71\" cy=\"98.07\" r=\"0.44\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"140.14\" cy=\"61.16\" r=\"0.47\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"168.23\" cy=\"47.41\" r=\"0.74\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.67\"/><circle cx=\"123.19\" cy=\"19.61\" r=\"0.71\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.34\"/><path d=\"M121.19 19.61h4M123.19 17.61v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"75.17\" cy=\"36.5\" r=\"0.6\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.44\"/><circle cx=\"146.5\" cy=\"6.52\" r=\"0.35\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.62\"/><circle cx=\"18.69\" cy=\"42.23\" r=\"0.2\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.76\"/><circle cx=\"192.7\" cy=\"133.56\" r=\"0.31\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.51\"/><circle cx=\"160.37\" cy=\"145.07\" r=\"0.72\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.49\"/><circle cx=\"92.56\" cy=\"130.46\" r=\"0.68\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.91\"/><circle cx=\"156.88\" cy=\"94.65\" r=\"0.43\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.71\"/><circle cx=\"175.55\" cy=\"21.41\" r=\"0.55\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.74\"/><circle cx=\"101.37\" cy=\"122.11\" r=\"0.5\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.37\"/><circle cx=\"127.17\" cy=\"98.41\" r=\"0.5\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.84\"/><circle cx=\"51.84\" cy=\"149.44\" r=\"0.52\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.92\"/><circle cx=\"43.3\" cy=\"41.5\" r=\"0.37\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.55\"/><circle cx=\"46.39\" cy=\"95.58\" r=\"0.2\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.39\"/><circle cx=\"71.29\" cy=\"35.85\" r=\"0.5\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.71\"/><circle cx=\"35.23\" cy=\"79.47\" r=\"0.48\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.43\"/><circle cx=\"158.06\" cy=\"135.72\" r=\"0.31\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.65\"/><circle cx=\"109.72\" cy=\"69.96\" r=\"0.57\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.77\"/><circle cx=\"94.92\" cy=\"125.3\" r=\"0.29\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.3\"/><circle cx=\"78.16\" cy=\"32.56\" r=\"0.5\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.77\"/><path d=\"M76.16 32.56h4M78.16 30.560000000000002v4\" fill=\"none\" stroke=\"#e6e3ff\" stroke-width=\".38\" opacity=\".7\"/><circle cx=\"49.41\" cy=\"26.4\" r=\"0.61\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.84\"/><circle cx=\"98.55\" cy=\"123.12\" r=\"0.24\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.87\"/><circle cx=\"63.93\" cy=\"53.1\" r=\"0.51\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.7\"/><circle cx=\"88.12\" cy=\"28.34\" r=\"0.37\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.59\"/><circle cx=\"41.25\" cy=\"13.14\" r=\"0.44\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.53\"/><circle cx=\"189.87\" cy=\"153.19\" r=\"0.53\" fill=\"#d2ddff\" stroke=\"none\" opacity=\"0.39\"/><circle cx=\"26.95\" cy=\"106.33\" r=\"0.82\" fill=\"#ffe5ed\" stroke=\"none\" opacity=\"0.28\"/><circle cx=\"15.84\" cy=\"5.16\" r=\"0.2\" fill=\"#a1b6ef\" stroke=\"none\" opacity=\"0.75\"/><circle cx=\"28.67\" cy=\"119.71\" r=\"0.8\" fill=\"#fff9fa\" stroke=\"none\" opacity=\"0.6\"/><path d=\"M51 131Q87 75 137 24\" fill=\"none\" stroke=\"#b3b1ee\" stroke-width=\"1.4\" opacity=\".54\"/></g><path d=\"M129 4L117 20L122 33L102 43L111 57L89 67L99 80L77 96L81 108L57 123L64 136L42 156\" fill=\"none\" stroke=\"#fff2ff\" stroke-width=\".85\"/><path d=\"M137 20L146 23L128 43L137 55L115 71L124 85L101 102L103 116L91 124L82 137\" fill=\"none\" stroke=\"#fac3f9\" stroke-width=\".75\" opacity=\".86\"/>"
      ],
      [
        "lensed-light",
        "lensing",
        "#e3c6f9",
        "<defs><linearGradient id=\"MOTIFID-lens\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#9c8fe5\" stop-opacity=\"0\"/><stop offset=\"0.25\" stop-color=\"#ceaeff\" stop-opacity=\"0.56\"/><stop offset=\"0.5\" stop-color=\"#fff0fc\" stop-opacity=\"0.94\"/><stop offset=\"0.75\" stop-color=\"#f49fd5\" stop-opacity=\"0.56\"/><stop offset=\"1\" stop-color=\"#9c8fe5\" stop-opacity=\"0\"/></linearGradient></defs><path d=\"M32 58C53 5 134 6 171 58C199 97 156 133 110 138M27 98C5 70 37 40 88 26M39 123C62 150 143 155 175 103C190 80 180 46 149 35\" fill=\"none\" stroke=\"url(#MOTIFID-lens)\" stroke-width=\"5\" opacity=\".13\"/><path d=\"M32 58C53 5 134 6 171 58C199 97 156 133 110 138M27 98C5 70 37 40 88 26M39 123C62 150 143 155 175 103C190 80 180 46 149 35\" fill=\"none\" stroke=\"url(#MOTIFID-lens)\" stroke-width=\"1.45\"/><path d=\"M15 51Q46 64 54 79M144 43Q172 31 195 38M28 124Q44 109 66 113M148 107Q166 100 188 110\" fill=\"none\" stroke=\"#b4a3f4\" stroke-width=\".8\" opacity=\".7\"/><circle cx=\"31\" cy=\"59\" r=\"1.35\" fill=\"#fff2ff\" stroke=\"none\" /><circle cx=\"51\" cy=\"78\" r=\"1.35\" fill=\"#fff2ff\" stroke=\"none\" /><circle cx=\"175\" cy=\"103\" r=\"1.35\" fill=\"#fff2ff\" stroke=\"none\" /><circle cx=\"149\" cy=\"35\" r=\"1.35\" fill=\"#fff2ff\" stroke=\"none\" /><circle cx=\"62\" cy=\"136\" r=\"1.35\" fill=\"#fff2ff\" stroke=\"none\" /><circle cx=\"164\" cy=\"45\" r=\"1.35\" fill=\"#fff2ff\" stroke=\"none\" />"
      ]
    ]
  ],
  "giratina": [
    25,
    [
      [
        "tar-pool",
        "tarspread",
        "#9a4269",
        "<defs><radialGradient id=\"MOTIFID-tar\" cx=\"44%\" cy=\"34%\" r=\"69%\"><stop offset=\"0\" stop-color=\"#291020\" stop-opacity=\"1\"/><stop offset=\"0.32\" stop-color=\"#150919\" stop-opacity=\"1\"/><stop offset=\"0.66\" stop-color=\"#06040d\" stop-opacity=\"1\"/><stop offset=\"0.87\" stop-color=\"#110515\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#7a2446\" stop-opacity=\"1\"/></radialGradient><linearGradient id=\"MOTIFID-shine\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#e0a5b7\" stop-opacity=\"0.65\"/><stop offset=\"0.32\" stop-color=\"#9c5578\" stop-opacity=\"0.32\"/><stop offset=\"1\" stop-color=\"#4c173a\" stop-opacity=\"0\"/></linearGradient><radialGradient id=\"MOTIFID-shadow\" ><stop offset=\"0\" stop-color=\"#08030d\" stop-opacity=\"0.94\"/><stop offset=\"0.55\" stop-color=\"#1c071b\" stop-opacity=\"0.7\"/><stop offset=\"1\" stop-color=\"#27091e\" stop-opacity=\"0\"/></radialGradient></defs><ellipse cx=\"100\" cy=\"88\" rx=\"99\" ry=\"72\" fill=\"url(#MOTIFID-shadow)\" stroke=\"none\" /><path d=\"M16 79C18 62 36 68 47 51C57 36 37 23 60 18C85 13 77 36 98 36C119 36 120 11 143 19C160 25 145 46 168 53C190 59 181 78 187 94C197 117 174 132 154 124C135 116 138 151 114 150C93 149 111 123 86 126C67 129 50 149 38 132C26 114 52 107 28 103C13 100 5 94 16 79Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#822845\" stroke-width=\"1.05\"/><path d=\"M30 76C48 72 48 56 61 51C77 43 91 55 108 43C121 34 128 31 138 33M151 63Q177 71 173 92M42 120Q51 107 65 112\" fill=\"none\" stroke=\"url(#MOTIFID-shine)\" stroke-width=\"2.8\" stroke-linecap=\"round\"/><ellipse cx=\"83\" cy=\"86\" rx=\"29\" ry=\"17\" fill=\"#020206\" stroke=\"none\" transform=\"rotate(-16 83 86)\" opacity=\".74\"/><path d=\"M59 82Q82 63 111 80\" fill=\"none\" stroke=\"#502039\" stroke-width=\"1.1\" opacity=\".78\"/><circle cx=\"13\" cy=\"42\" r=\"3\" fill=\"#180b1c\" stroke=\"none\" opacity=\".83\"/><circle cx=\"179\" cy=\"28\" r=\"5\" fill=\"#180b1c\" stroke=\"none\" opacity=\".83\"/><circle cx=\"20\" cy=\"136\" r=\"5\" fill=\"#180b1c\" stroke=\"none\" opacity=\".83\"/><circle cx=\"182\" cy=\"142\" r=\"3\" fill=\"#180b1c\" stroke=\"none\" opacity=\".83\"/><circle cx=\"151\" cy=\"151\" r=\"2\" fill=\"#180b1c\" stroke=\"none\" opacity=\".83\"/><circle cx=\"34\" cy=\"24\" r=\"2\" fill=\"#180b1c\" stroke=\"none\" opacity=\".83\"/>"
      ],
      [
        "shadow-tendrils",
        "tarstretch",
        "#8e3d60",
        "<defs><radialGradient id=\"MOTIFID-tar\" cx=\"44%\" cy=\"34%\" r=\"69%\"><stop offset=\"0\" stop-color=\"#291020\" stop-opacity=\"1\"/><stop offset=\"0.32\" stop-color=\"#150919\" stop-opacity=\"1\"/><stop offset=\"0.66\" stop-color=\"#06040d\" stop-opacity=\"1\"/><stop offset=\"0.87\" stop-color=\"#110515\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#7a2446\" stop-opacity=\"1\"/></radialGradient><linearGradient id=\"MOTIFID-shine\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#e0a5b7\" stop-opacity=\"0.65\"/><stop offset=\"0.32\" stop-color=\"#9c5578\" stop-opacity=\"0.32\"/><stop offset=\"1\" stop-color=\"#4c173a\" stop-opacity=\"0\"/></linearGradient></defs><path d=\"M37 16C61 5 73 18 72 36C71 58 47 59 53 82C57 99 74 110 65 126C58 138 44 129 48 117C55 99 32 89 36 66C40 47 56 36 37 29Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#69213f\" stroke-width=\".9\"/><path d=\"M121 145C103 133 118 113 133 101C154 85 142 67 151 55C161 42 174 55 169 69C160 90 185 94 159 117C144 132 147 147 121 145Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#792345\" stroke-width=\"1.05\"/><path d=\"M48 26Q65 29 58 44M52 64Q46 81 56 92M157 61Q149 79 163 91M146 108Q133 119 131 134\" fill=\"none\" stroke=\"url(#MOTIFID-shine)\" stroke-width=\"2.2\"/><path d=\"M91 14C84 25 86 38 94 43C102 37 103 25 91 14Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#752342\" stroke-width=\".7\"/>"
      ],
      [
        "falling-tar",
        "tardrop",
        "#7f3658",
        "<defs><radialGradient id=\"MOTIFID-tar\" cx=\"44%\" cy=\"34%\" r=\"69%\"><stop offset=\"0\" stop-color=\"#291020\" stop-opacity=\"1\"/><stop offset=\"0.32\" stop-color=\"#150919\" stop-opacity=\"1\"/><stop offset=\"0.66\" stop-color=\"#06040d\" stop-opacity=\"1\"/><stop offset=\"0.87\" stop-color=\"#110515\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#7a2446\" stop-opacity=\"1\"/></radialGradient><linearGradient id=\"MOTIFID-shine\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#e0a5b7\" stop-opacity=\"0.65\"/><stop offset=\"0.32\" stop-color=\"#9c5578\" stop-opacity=\"0.32\"/><stop offset=\"1\" stop-color=\"#4c173a\" stop-opacity=\"0\"/></linearGradient></defs><path d=\"M22 12.100000000000001C23.68 19.72 29.62 24.34 28 28.54C24.4 34.72 14.5 30.7 16 25C16.6 21.1 20.8 17.8 22 12.100000000000001Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" /><ellipse cx=\"20.2\" cy=\"24.1\" rx=\"0.8999999999999999\" ry=\"1.92\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M91 0.8000000000000007C93.24 10.96 101.16 17.12 99 22.72C94.2 30.96 81 25.6 83 18C83.8 12.8 89.4 8.4 91 0.8000000000000007Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" /><ellipse cx=\"88.6\" cy=\"16.8\" rx=\"1.2\" ry=\"2.56\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M166 20.25C167.4 26.6 172.35 30.45 171 33.95C168 39.1 159.75 35.75 161 31C161.5 27.75 165 25 166 20.25Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" /><ellipse cx=\"164.5\" cy=\"30.25\" rx=\"0.75\" ry=\"1.6\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M135 36.4C136.12 41.48 140.08 44.56 139 47.36C136.6 51.480000000000004 130 48.8 131 45C131.4 42.4 134.2 40.2 135 36.4Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" /><ellipse cx=\"133.8\" cy=\"44.4\" rx=\"0.6\" ry=\"1.28\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M67 28.55C67.84 32.36 70.81 34.67 70 36.77C68.2 39.86 63.25 37.85 64 35C64.3 33.05 66.4 31.4 67 28.55Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" /><ellipse cx=\"66.1\" cy=\"34.55\" rx=\"0.44999999999999996\" ry=\"0.96\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/>"
      ],
      [
        "reverse-gravity",
        "tarreverse",
        "#7f3658",
        "<defs><radialGradient id=\"MOTIFID-tar\" cx=\"44%\" cy=\"34%\" r=\"69%\"><stop offset=\"0\" stop-color=\"#291020\" stop-opacity=\"1\"/><stop offset=\"0.32\" stop-color=\"#150919\" stop-opacity=\"1\"/><stop offset=\"0.66\" stop-color=\"#06040d\" stop-opacity=\"1\"/><stop offset=\"0.87\" stop-color=\"#110515\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#7a2446\" stop-opacity=\"1\"/></radialGradient><linearGradient id=\"MOTIFID-shine\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#e0a5b7\" stop-opacity=\"0.65\"/><stop offset=\"0.32\" stop-color=\"#9c5578\" stop-opacity=\"0.32\"/><stop offset=\"1\" stop-color=\"#4c173a\" stop-opacity=\"0\"/></linearGradient></defs><path d=\"M28 97.8C30.240000000000002 107.96 38.16 114.12 36 119.72C31.2 127.96000000000001 18 122.6 20 115C20.8 109.8 26.4 105.4 28 97.8Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" transform=\"rotate(180 28 115)\"/><ellipse cx=\"25.6\" cy=\"113.8\" rx=\"1.2\" ry=\"2.56\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M87 127.25C88.4 133.6 93.35 137.45 92 140.95C89 146.1 80.75 142.75 82 138C82.5 134.75 86 132 87 127.25Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" transform=\"rotate(180 87 138)\"/><ellipse cx=\"85.5\" cy=\"137.25\" rx=\"0.75\" ry=\"1.6\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M169 74.65C171.52 86.08 180.43 93.01 178 99.31C172.6 108.58 157.75 102.55 160 94C160.9 88.15 167.2 83.2 169 74.65Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" transform=\"rotate(180 169 94)\"/><ellipse cx=\"166.3\" cy=\"92.65\" rx=\"1.3499999999999999\" ry=\"2.88\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M118 117.4C119.12 122.48 123.08 125.56 122 128.36C119.6 132.48 113 129.8 114 126C114.4 123.4 117.2 121.2 118 117.4Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" transform=\"rotate(180 118 126)\"/><ellipse cx=\"116.8\" cy=\"125.4\" rx=\"0.6\" ry=\"1.28\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/><path d=\"M45 73.55C45.84 77.36 48.81 79.67 48 81.77C46.2 84.86 41.25 82.85 42 80C42.3 78.05 44.4 76.4 45 73.55Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#6a2545\" stroke-width=\".65\" transform=\"rotate(180 45 80)\"/><ellipse cx=\"44.1\" cy=\"79.55\" rx=\"0.44999999999999996\" ry=\"0.96\" fill=\"#b1708d\" stroke=\"none\" opacity=\".48\"/>"
      ],
      [
        "shadow-splatter",
        "tarburst",
        "#8c345c",
        "<defs><radialGradient id=\"MOTIFID-tar\" cx=\"44%\" cy=\"34%\" r=\"69%\"><stop offset=\"0\" stop-color=\"#291020\" stop-opacity=\"1\"/><stop offset=\"0.32\" stop-color=\"#150919\" stop-opacity=\"1\"/><stop offset=\"0.66\" stop-color=\"#06040d\" stop-opacity=\"1\"/><stop offset=\"0.87\" stop-color=\"#110515\" stop-opacity=\"1\"/><stop offset=\"1\" stop-color=\"#7a2446\" stop-opacity=\"1\"/></radialGradient></defs><path d=\"M100 51C113 39 123 52 130 41L139 20L137 51C160 42 168 56 155 66L181 82L151 78C143 89 151 103 162 116L137 107C126 118 111 116 105 139L100 113C79 123 69 107 52 118L65 99C49 90 35 99 20 83L53 83C58 69 37 63 40 48L67 66C75 48 85 51 100 51Z\" fill=\"url(#MOTIFID-tar)\" stroke=\"#631f3c\" stroke-width=\".85\"/><circle cx=\"21\" cy=\"53\" r=\"3\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/><circle cx=\"175\" cy=\"55\" r=\"5\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/><circle cx=\"159\" cy=\"141\" r=\"3\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/><circle cx=\"43\" cy=\"143\" r=\"4\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/><circle cx=\"116\" cy=\"13\" r=\"2\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/><circle cx=\"9\" cy=\"100\" r=\"2\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/><circle cx=\"185\" cy=\"120\" r=\"2\" fill=\"#281123\" stroke=\"none\" opacity=\".88\"/>"
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
          // Namespaced, checked-in gradients and clips are local to each rendered SVG.
          const prefix='legendary-'+key+'-'+role+'-'+i+'-';
          p.innerHTML='<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">'+markup.replaceAll('MOTIFID-',prefix)+'</svg>';
          const left=i===0,vars={'--x':left?'14%':'86%','--y':left?'31%':'69%',
            '--mx':'79%','--my':'36%','--s':'210px','--d':cycle+'s',
            '--delay':(left?-cycle*.12:-cycle*.60)+'s','--c':color};
          if(key==='dialga'){
            const sand=role==='hourglass'||role.startsWith('sand-');
            // The two clocks deliberately run at different speeds; each set stays in sync.
            const rate=left?cycle:cycle*1.55;
            Object.assign(vars,{'--x':left?(sand?'17%':'14%'):(sand?'83%':'86%'),
              '--y':left?(sand?'73%':'24%'):(sand?'25%':'70%'),
              '--mx':sand?'20%':'77%','--my':sand?'73%':'23%',
              '--d':rate+'s','--delay':(-rate*(left?.12:.37))+'s'});
          }else if(key==='palkia'){
            Object.assign(vars,{'--x':left?'19%':'81%','--y':left?'30%':'69%',
              '--mx':'76%','--my':'44%'});
          }else if(key==='giratina'){
            Object.assign(vars,{'--x':left?'14%':'86%','--y':left?'28%':'73%',
              '--mx':'77%','--my':'58%'});
          }
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
