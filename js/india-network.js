/* =========================================================
   J. Karthikeyan & Co. — India Network Coverage (Three.js)
   Cinematic 3D dot-map of India built from a traced country
   silhouette, with state/UT nodes, HQ pulse animation, hover
   tooltips and a scroll-triggered assembly reveal.

   India outline traced-path courtesy of djaiss/mapsicon
   (https://github.com/djaiss/mapsicon) — free to use with
   attribution, redistribution/resale not permitted.

   Degrades gracefully: if THREE fails to load, or the canvas
   silhouette cannot be rasterised, the section simply stays
   empty (stats still animate via main.js's generic counter).
   ========================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("network-canvas");
  var section = document.getElementById("network-coverage");
  var tooltip = document.getElementById("network-tooltip");
  if (!canvas || !section || typeof THREE === "undefined") return;

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;

  /* ---------- India silhouette source (traced country outline image) ---------- */
  var INDIA_SVG_SRC = "assets/india-outline.svg";

  var GEO_BOUNDS = { lonMin: 68, lonMax: 97.5, latMin: 6, latMax: 36.5 };

  var REGIONS = [
    { name: "Andhra Pradesh", lat: 16.5, lon: 80.5, clients: 32 },
    { name: "Arunachal Pradesh", lat: 27.1, lon: 93.6, clients: 2 },
    { name: "Assam", lat: 26.1, lon: 91.8, clients: 8 },
    { name: "Bihar", lat: 25.6, lon: 85.1, clients: 16 },
    { name: "Chhattisgarh", lat: 21.25, lon: 81.6, clients: 14 },
    { name: "Goa", lat: 15.5, lon: 73.8, clients: 8 },
    { name: "Gujarat", lat: 23.2, lon: 72.6, clients: 46, major: true },
    { name: "Haryana", lat: 29.05, lon: 76.08, clients: 26 },
    { name: "Himachal Pradesh", lat: 31.1, lon: 77.2, clients: 9 },
    { name: "Jharkhand", lat: 23.35, lon: 85.3, clients: 13 },
    { name: "Karnataka", lat: 12.97, lon: 77.6, clients: 64, major: true },
    { name: "Kerala", lat: 8.5, lon: 76.9, clients: 36 },
    { name: "Madhya Pradesh", lat: 23.25, lon: 77.4, clients: 20 },
    { name: "Maharashtra", lat: 19.07, lon: 72.87, clients: 78, major: true },
    { name: "Manipur", lat: 24.8, lon: 93.9, clients: 3 },
    { name: "Meghalaya", lat: 25.6, lon: 91.9, clients: 4 },
    { name: "Mizoram", lat: 23.7, lon: 92.7, clients: 2 },
    { name: "Nagaland", lat: 25.7, lon: 94.1, clients: 3 },
    { name: "Odisha", lat: 20.3, lon: 85.8, clients: 18 },
    { name: "Punjab", lat: 30.9, lon: 75.85, clients: 22 },
    { name: "Rajasthan", lat: 26.9, lon: 75.8, clients: 28 },
    { name: "Sikkim", lat: 27.3, lon: 88.6, clients: 3 },
    { name: "Tamil Nadu", lat: 13.08, lon: 80.27, clients: 96, hq: true },
    { name: "Telangana", lat: 17.4, lon: 78.5, clients: 52 },
    { name: "Tripura", lat: 23.8, lon: 91.3, clients: 4 },
    { name: "Uttar Pradesh", lat: 26.85, lon: 80.9, clients: 40, major: true },
    { name: "Uttarakhand", lat: 30.3, lon: 78.05, clients: 11 },
    { name: "West Bengal", lat: 22.57, lon: 88.36, clients: 42, major: true },
    { name: "Andaman & Nicobar", lat: 11.6, lon: 92.7, clients: 2 },
    { name: "Chandigarh", lat: 30.73, lon: 76.78, clients: 6 },
    { name: "Dadra & Nagar Haveli and Daman & Diu", lat: 20.27, lon: 73.0, clients: 2 },
    { name: "Delhi (NCT)", lat: 28.6, lon: 77.2, clients: 58, major: true },
    { name: "Jammu & Kashmir", lat: 33.7, lon: 75.0, clients: 6 },
    { name: "Ladakh", lat: 34.15, lon: 77.58, clients: 2 },
    { name: "Lakshadweep", lat: 10.57, lon: 72.64, clients: 1 },
    { name: "Puducherry", lat: 11.94, lon: 79.83, clients: 5 }
  ];

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function geoToUV(lat, lon) {
    return {
      u: clamp01((lon - GEO_BOUNDS.lonMin) / (GEO_BOUNDS.lonMax - GEO_BOUNDS.lonMin)),
      v: clamp01(1 - (lat - GEO_BOUNDS.latMin) / (GEO_BOUNDS.latMax - GEO_BOUNDS.latMin))
    };
  }

  /* ---------- Rasterise the silhouette image to sample dot positions + bounding box ---------- */
  var RASTER = 1024;
  var STRIDE = 1;
  function buildSilhouette(img) {
    var off = document.createElement("canvas");
    off.width = RASTER;
    off.height = RASTER;
    var octx = off.getContext("2d");
    if (!octx) return null;
    try { octx.drawImage(img, 0, 0, RASTER, RASTER); } catch (e) { return null; }

    var data;
    try { data = octx.getImageData(0, 0, RASTER, RASTER).data; } catch (e) { return null; }

    var bbox = { minX: RASTER, minY: RASTER, maxX: 0, maxY: 0 };
    var dots = [];
    for (var y = 0; y < RASTER; y += STRIDE) {
      for (var x = 0; x < RASTER; x += STRIDE) {
        var alpha = data[(y * RASTER + x) * 4 + 3];
        if (alpha > 40) {
          if (x < bbox.minX) bbox.minX = x;
          if (x > bbox.maxX) bbox.maxX = x;
          if (y < bbox.minY) bbox.minY = y;
          if (y > bbox.maxY) bbox.maxY = y;
          dots.push(x, y);
        }
      }
    }
    if (bbox.maxX <= bbox.minX || bbox.maxY <= bbox.minY) return null;
    return { bbox: bbox, dots: dots };
  }

  var indiaImg = new Image();
  indiaImg.onload = function () {
    var silhouette = buildSilhouette(indiaImg);
    if (silhouette) initScene(silhouette);
  };
  indiaImg.onerror = function () {};
  indiaImg.src = INDIA_SVG_SRC;

  function initScene(silhouette) {
  var bbox = silhouette.bbox;
  var MAP_WIDTH = 12;
  var pxScale = MAP_WIDTH / (bbox.maxX - bbox.minX);
  var centerX = (bbox.minX + bbox.maxX) / 2;
  var centerY = (bbox.minY + bbox.maxY) / 2;
  function pixelToWorld(px, py) {
    return { x: (px - centerX) * pxScale, y: -(py - centerY) * pxScale };
  }
  function regionWorldPos(region) {
    var uv = geoToUV(region.lat, region.lon);
    var px = bbox.minX + uv.u * (bbox.maxX - bbox.minX);
    var py = bbox.minY + uv.v * (bbox.maxY - bbox.minY);
    return pixelToWorld(px, py);
  }

  /* ---------- Renderer / scene ---------- */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050b14, 0.009);

  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  var baseCamPos = new THREE.Vector3(0, 3.2, 17);
  camera.position.copy(baseCamPos);
  camera.lookAt(0, 0, 0);

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  var mapGroup = new THREE.Group();
  var BASE_TILT = -0.42;
  mapGroup.rotation.x = BASE_TILT;
  scene.add(mapGroup);

  /* ---------- Soft glow sprite texture (cheap stand-in for real bloom) ---------- */
  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,209,102,0.97)");
    grad.addColorStop(1, "rgba(255,209,102,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTexture = makeGlowTexture();

  /* ---------- Soft wide halo texture (subtle outer glow behind the dot-map) ---------- */
  function makeHaloTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,209,102,0.55)");
    grad.addColorStop(0.5, "rgba(255,209,102,0.2)");
    grad.addColorStop(1, "rgba(255,209,102,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var haloTexture = makeHaloTexture();

  /* ---------- Premium 3D location-pin texture ----------
     Drawn once to an offscreen canvas and shared by every marker sprite, so
     36 glossy pins cost one texture upload and zero per-frame raster work.
     Glossy gradient body (#E53935), inner white lens, specular sheen, glass
     rim-light and a soft contact shadow baked in at the tip. */
  var PIN_TEX_W = 256, PIN_TEX_H = 340;
  var PIN_ASPECT = PIN_TEX_H / PIN_TEX_W;
  function makePinTexture() {
    var c = document.createElement("canvas");
    c.width = PIN_TEX_W;
    c.height = PIN_TEX_H;
    var ctx = c.getContext("2d");
    if (!ctx) return null;
    var cx = 128, headY = 118, R = 86, tipY = 312;
    function deg(d) { return (d * Math.PI) / 180; }

    /* soft elliptical contact shadow under the tip */
    ctx.save();
    ctx.translate(cx, tipY - 2);
    ctx.scale(1, 0.3);
    var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 56);
    sh.addColorStop(0, "rgba(0,0,0,0.5)");
    sh.addColorStop(0.5, "rgba(0,0,0,0.22)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* teardrop silhouette */
    function pinPath() {
      ctx.beginPath();
      ctx.arc(cx, headY, R, deg(150), deg(30), false);
      ctx.quadraticCurveTo(cx + R * 0.6, headY + R * 1.02, cx, tipY);
      ctx.quadraticCurveTo(cx - R * 0.6, headY + R * 1.02, cx + Math.cos(deg(150)) * R, headY + Math.sin(deg(150)) * R);
      ctx.closePath();
    }

    ctx.save();
    pinPath();
    ctx.clip();

    var body = ctx.createLinearGradient(cx - R, headY - R, cx + R * 0.85, tipY);
    body.addColorStop(0, "#FF6055");
    body.addColorStop(0.22, "#EF3F38");
    body.addColorStop(0.5, "#E53935");
    body.addColorStop(1, "#8E1714");
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);

    /* glossy top-left highlight */
    var gloss = ctx.createRadialGradient(cx - R * 0.46, headY - R * 0.58, 2, cx - R * 0.46, headY - R * 0.58, R * 0.95);
    gloss.addColorStop(0, "rgba(255,255,255,0.42)");
    gloss.addColorStop(0.4, "rgba(255,255,255,0.08)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);

    /* warm rim-light bouncing off the lower-right shoulder */
    var rim = ctx.createRadialGradient(cx + R * 0.62, headY + R * 0.5, 4, cx + R * 0.62, headY + R * 0.5, R * 0.95);
    rim.addColorStop(0, "rgba(255,186,150,0.3)");
    rim.addColorStop(0.6, "rgba(255,150,120,0.08)");
    rim.addColorStop(1, "rgba(255,150,120,0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);

    /* glass sheen sweeping across the upper body */
    var sheen = ctx.createLinearGradient(cx - R, headY - R * 0.95, cx + R * 0.3, headY + R * 0.25);
    sheen.addColorStop(0, "rgba(255,255,255,0.22)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.06)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.2, headY - R * 0.5, R * 0.74, R * 0.36, deg(-22), 0, Math.PI * 2);
    ctx.fill();

    /* deep shading along the tip for volume */
    var deep = ctx.createLinearGradient(cx, headY + R * 0.35, cx, tipY);
    deep.addColorStop(0, "rgba(90,12,10,0)");
    deep.addColorStop(1, "rgba(90,12,10,0.4)");
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);
    ctx.restore();

    /* crisp outline + bright specular arc across the crown */
    pinPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(96,14,12,0.5)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, headY, R - 8, deg(198), deg(316), false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineCap = "round";
    ctx.stroke();

    /* inner white lens with a soft inset shadow */
    var lensR = R * 0.4;
    ctx.save();
    ctx.shadowColor = "rgba(70,8,8,0.4)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, headY, lensR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    var lens = ctx.createLinearGradient(cx - lensR, headY - lensR, cx + lensR, headY + lensR);
    lens.addColorStop(0, "#ffffff");
    lens.addColorStop(0.6, "#F7F9FC");
    lens.addColorStop(1, "#E4E9F0");
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(cx, headY, lensR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, headY, lensR - 1.5, deg(200), deg(340), false);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();

    var tex = new THREE.CanvasTexture(c);
    /* the canvas holds sRGB pixels — tag it so the renderer doesn't
       double-convert and wash the red out */
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  var pinTexture = makePinTexture();

  /* ---------- GPS pulse-ring texture (thin golden band) ---------- */
  function makeRingTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,209,102,0)");
    g.addColorStop(0.6, "rgba(255,209,102,0)");
    g.addColorStop(0.79, "rgba(255,231,171,0.85)");
    g.addColorStop(0.9, "rgba(255,209,102,0.22)");
    g.addColorStop(1, "rgba(255,209,102,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var ringTexture = makeRingTexture();

  /* ---------- Dot-map point cloud ----------
     Random (not fixed-stride) sampling: a modulo stride over the row-major
     raster beats against the shape's varying row width and produces visible
     Moire/wave banding, worst where the peninsula narrows. Independent random
     keep-probability avoids any such periodic pattern. */
  var rawDots = silhouette.dots;
  var totalCandidates = rawDots.length / 2;
  var maxDots = 7000;
  var keepProbability = Math.min(1, maxDots / totalCandidates);
  var finalPositions = [];
  for (var i = 0; i < rawDots.length; i += 2) {
    if (Math.random() > keepProbability) continue;
    var jpx = rawDots[i] + (Math.random() - 0.5) * STRIDE;
    var jpy = rawDots[i + 1] + (Math.random() - 0.5) * STRIDE;
    var w = pixelToWorld(jpx, jpy);
    finalPositions.push(w.x, w.y, (Math.random() - 0.5) * 0.18);
  }

  /* Island clusters (Andaman & Nicobar, Lakshadweep) — the traced mainland
     silhouette doesn't include these, so scatter small procedural clusters
     at their real projected lat/lon instead. */
  function addIslandCluster(lat, lon, count, spreadX, spreadY) {
    var center = regionWorldPos({ lat: lat, lon: lon });
    for (var n = 0; n < count; n++) {
      var ox = (Math.random() - 0.5) * spreadX;
      var oy = (Math.random() - 0.5) * spreadY * (0.5 + Math.random() * 0.5);
      finalPositions.push(center.x + ox, center.y + oy, (Math.random() - 0.5) * 0.18);
    }
  }
  addIslandCluster(9.5, 92.8, 150, 0.55, 2.4);
  addIslandCluster(10.57, 72.64, 60, 0.35, 0.7);

  var dotPositions = new Float32Array(finalPositions);
  var scatterOffsets = new Float32Array(dotPositions.length);
  for (var s = 0; s < scatterOffsets.length; s += 3) {
    scatterOffsets[s] = (Math.random() - 0.5) * 16;
    scatterOffsets[s + 1] = (Math.random() - 0.5) * 10 + 7;
    scatterOffsets[s + 2] = (Math.random() - 0.5) * 10 - 6;
  }

  var dotGeo = new THREE.BufferGeometry();
  var livePositions = new Float32Array(dotPositions.length);
  livePositions.set(dotPositions);
  dotGeo.setAttribute("position", new THREE.BufferAttribute(livePositions, 3));
  var dotMat = new THREE.PointsMaterial({
    map: glowTexture,
    color: 0xffd166,
    size: 0.125,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var dotCloud = new THREE.Points(dotGeo, dotMat);
  mapGroup.add(dotCloud);

  /* ---------- Subtle outer glow/halo layer behind the dot-map ---------- */
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", dotGeo.getAttribute("position"));
  var haloMat = new THREE.PointsMaterial({
    map: haloTexture,
    color: 0xffd166,
    size: 0.32,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var dotHalo = new THREE.Points(haloGeo, haloMat);
  dotHalo.position.z = -0.05;
  mapGroup.add(dotHalo);

  /* ---------- Ambient particle field ---------- */
  var particleCount = 200;
  var particlePositions = new Float32Array(particleCount * 3);
  for (var p = 0; p < particleCount; p++) {
    particlePositions[p * 3] = (Math.random() - 0.5) * 30;
    particlePositions[p * 3 + 1] = (Math.random() - 0.5) * 16 + 3;
    particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 16 - 4;
  }
  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  var particleMat = new THREE.PointsMaterial({
    map: glowTexture,
    color: 0x6e96c9,
    size: 0.06,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var particleField = new THREE.Points(particleGeo, particleMat);
  scene.add(particleField);

  /* ---------- State / UT nodes (instanced) ---------- */
  var hqRegion = null;
  for (var r = 0; r < REGIONS.length; r++) {
    REGIONS[r].worldPos = (function (region) {
      var pos = regionWorldPos(region);
      return new THREE.Vector3(pos.x, pos.y, region.hq ? 0.55 : 0.15);
    })(REGIONS[r]);
    if (REGIONS[r].hq) hqRegion = REGIONS[r];
  }

  /* Each region gets a screen-facing glossy pin sprite (anchored at its tip so
     it grows out of the map), an additive golden glow sprite behind the head,
     and shares a small pool of flat expanding GPS rings. Sprites keep the pins
     upright and undistorted through the map's tilt/sway, and every animation is
     a transform/opacity write only — no geometry rebuilds, no layout. */
  var markerGroup = new THREE.Group();
  mapGroup.add(markerGroup);

  var PIN_BASE_H = 1.0;
  var APPEAR_DUR = 0.72;   /* bounce-in: 720ms */
  var STEP_DELAY = 0.6;    /* 600ms between states */
  var TRAVEL_DUR = 0.45;   /* fibre-optic light HQ -> state */
  var RING_DUR = 1.0;      /* pulse ring lifetime: 1s */
  var FLOAT_PERIOD = 5.0;  /* gentle vertical float */
  var BREATHE_PERIOD = 4.0;
  var CLEAR_DUR = 0.5;

  var markers = [];
  var pinSprites = [];
  var regionIndex = {};

  REGIONS.forEach(function (region, idx) {
    regionIndex[region.name] = idx;
    var sizeMul = region.hq ? 1.34 : (region.major ? 1.12 : 1);
    var h = PIN_BASE_H * sizeMul;

    var pin = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pinTexture,
      transparent: true,
      opacity: prefersReduced ? 1 : 0,
      depthTest: false,
      depthWrite: false
    }));
    pin.center.set(0.5, 0);           /* anchor the tip on the state */
    pin.scale.set(h / PIN_ASPECT, h, 1);
    pin.position.copy(region.worldPos);
    pin.renderOrder = 6;
    pin.visible = !!prefersReduced;
    pin.userData.markerIndex = idx;
    markerGroup.add(pin);
    pinSprites.push(pin);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture,
      color: 0xffc64a,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    glow.scale.setScalar(h * 1.5);
    glow.position.copy(region.worldPos);
    glow.renderOrder = 4;
    glow.visible = !!prefersReduced;
    markerGroup.add(glow);

    markers.push({
      region: region,
      pin: pin,
      glow: glow,
      h: h,
      curPinH: h,
      phase: prefersReduced ? "settled" : "hidden",
      t: 0,
      delay: 0,
      flash: 0,
      burst: false,
      hovered: false,
      hoverAmt: 0,
      dropDist: h * 1.05,
      phaseOff: idx * 0.7
    });
  });

  /* ---------- Pooled GPS pulse rings (flat in the map plane) ---------- */
  var ringGeo = new THREE.PlaneGeometry(1, 1);
  var ringPool = [];
  for (var rg = 0; rg < 9; rg++) {
    var ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      map: ringTexture,
      color: 0xffd166,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    }));
    ringMesh.renderOrder = 2;
    ringMesh.visible = false;
    markerGroup.add(ringMesh);
    ringPool.push({ mesh: ringMesh, active: false, t: 0, delay: 0, size: 1 });
  }

  function spawnRings(marker) {
    if (prefersReduced) return;
    var spawned = 0;
    for (var i = 0; i < ringPool.length && spawned < 3; i++) {
      var ring = ringPool[i];
      if (ring.active) continue;
      ring.active = true;
      ring.t = 0;
      ring.delay = spawned * 0.24;
      ring.size = marker.h * 2.5;
      ring.mesh.position.copy(marker.region.worldPos);
      ring.mesh.material.opacity = 0;
      ring.mesh.visible = true;
      spawned++;
    }
  }

  function updateRings(dt) {
    for (var i = 0; i < ringPool.length; i++) {
      var ring = ringPool[i];
      if (!ring.active) continue;
      if (ring.delay > 0) { ring.delay -= dt; continue; }
      ring.t += dt / RING_DUR;
      if (ring.t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        ring.mesh.material.opacity = 0;
        continue;
      }
      var e = 1 - Math.pow(1 - ring.t, 2.2);
      var s = ring.size * (0.3 + e * 1.05);
      ring.mesh.scale.set(s, s, 1);
      ring.mesh.material.opacity = 0.8 * Math.pow(1 - ring.t, 1.6);
    }
  }

  /* ---------- Connection lines (HQ -> every other region) ---------- */
  var linesGroup = new THREE.Group();
  mapGroup.add(linesGroup);
  var curveEntries = [];

  REGIONS.forEach(function (region) {
    if (region.hq || !hqRegion) return;
    var start = hqRegion.worldPos.clone();
    var end = region.worldPos.clone();
    var mid = start.clone().lerp(end, 0.5);
    mid.z += start.distanceTo(end) * 0.22 + 0.1;
    var curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    region.curve = curve;
    var points = curve.getPoints(34);
    var geo = new THREE.BufferGeometry().setFromPoints(points);
    var mat = new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xffd166,
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: prefersReduced ? 0.35 : 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var line = new THREE.Points(geo, mat);
    linesGroup.add(line);
    curveEntries.push({ region: region, line: line });
  });

  /* ---------- Travelling pulse (HQ -> active state), fibre-optic style trail ---------- */
  var PULSE_TRAIL = 6;
  var pulseSprites = [];
  for (var t = 0; t < PULSE_TRAIL; t++) {
    var pMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffd166,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var sprite = new THREE.Sprite(pMat);
    sprite.scale.setScalar(0.55 - t * 0.06);
    linesGroup.add(sprite);
    pulseSprites.push(sprite);
  }
  var activePulse = null;

  function startPulse(region) {
    if (!region.curve) return;
    activePulse = { region: region, t: 0 };
  }

  function dropMarker(region) {
    var idx = regionIndex[region.name];
    if (idx === undefined) return;
    var m = markers[idx];
    if (m.phase !== "hidden") return;
    m.phase = "appearing";
    m.t = 0;
    m.burst = false;
    m.flash = 0;
    m.pin.visible = true;
    m.glow.visible = true;
  }

  /* ---------- Sequential reveal cycle ----------
     HQ lands first, then each remaining state is announced by a light pulse
     travelling out from HQ; the pin bounces in the moment the light arrives.
     Once every state is marked: hold 3s, clear smoothly, repeat forever.
     Driven by accumulated frame delta (not wall clock / timers) so pausing
     off-screen resumes exactly where it left off. */
  var revealOrder = REGIONS.slice().sort(function (a, b) {
    if (a.hq) return -1;
    if (b.hq) return 1;
    if (!hqRegion) return 0;
    return a.worldPos.distanceTo(hqRegion.worldPos) - b.worldPos.distanceTo(hqRegion.worldPos);
  });

  var seq = { state: "idle", next: 0, timer: 0 };
  function startCycle() {
    if (prefersReduced || seq.state !== "idle") return;
    seq.state = "revealing";
    seq.next = 0;
    seq.timer = 0;
  }
  function stopCycle() { /* the sequence pauses with the render loop */ }

  function allMarkersHidden() {
    for (var i = 0; i < markers.length; i++) if (markers[i].phase !== "hidden") return false;
    return true;
  }
  function allMarkersSettled() {
    for (var i = 0; i < markers.length; i++) if (markers[i].phase !== "settled") return false;
    return true;
  }

  function beginClear() {
    for (var i = 0; i < revealOrder.length; i++) {
      var m = markers[regionIndex[revealOrder[i].name]];
      if (m.phase === "hidden") continue;
      m.phase = "clearing";
      m.t = 0;
      m.delay = (revealOrder.length - 1 - i) * 0.03;
    }
  }

  function updateSequence(dt) {
    if (seq.state === "idle") return;
    seq.timer -= dt;
    if (seq.state === "revealing") {
      if (seq.next < revealOrder.length) {
        if (seq.timer <= 0) {
          var region = revealOrder[seq.next++];
          if (region.hq || !region.curve) dropMarker(region);
          else startPulse(region);
          seq.timer = STEP_DELAY;
        }
      } else if (allMarkersSettled()) {
        seq.state = "holding";
        seq.timer = 3;
      }
    } else if (seq.state === "holding") {
      if (seq.timer <= 0) {
        beginClear();
        seq.state = "clearing";
      }
    } else if (seq.state === "clearing") {
      if (allMarkersHidden()) {
        seq.state = "revealing";
        seq.next = 0;
        seq.timer = 0.5;
      }
    }
  }

  /* ---------- Scroll-triggered assembly reveal ---------- */
  var assembleProgress = prefersReduced ? 1 : 0;
  var revealed = false;
  function runAssembleReveal() {
    if (prefersReduced) {
      curveEntries.forEach(function (c) { c.line.material.opacity = 0.35; });
      startCycle();
      return;
    }
    var start = null;
    var DURATION = 1800;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / DURATION, 1);
      assembleProgress = 1 - Math.pow(1 - p, 3);
      curveEntries.forEach(function (c, idx) {
        var lineP = Math.min(1, Math.max(0, p * 1.4 - idx * (0.4 / curveEntries.length)));
        c.line.material.opacity = 0.35 * lineP;
      });
      if (p < 1) requestAnimationFrame(step);
      else startCycle();
    }
    requestAnimationFrame(step);
  }

  /* ---------- Hover interaction (fine pointers only) ---------- */
  var raycaster = new THREE.Raycaster();
  var pointerNDC = new THREE.Vector2();
  var hoveredIndex = -1;

  function screenPosForIndex(idx) {
    var m = markers[idx];
    var v = m.pin.position.clone();
    mapGroup.updateMatrixWorld();
    v.applyMatrix4(mapGroup.matrixWorld);
    /* lift the anchor to the crown of the pin so the tooltip clears it */
    v.addScaledVector(upWorld, m.curPinH * mapGroup.scale.x);
    v.project(camera);
    var rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-v.y * 0.5 + 0.5) * rect.height
    };
  }

  function showTooltip(idx) {
    var region = markers[idx].region;
    var pos = screenPosForIndex(idx);
    tooltip.innerHTML =
      "<strong>" + region.name + (region.hq ? " (HQ)" : "") + "</strong>" +
      '<span class="status">Connected</span>' +
      "<span>" + region.clients + " Active Clients</span>";
    tooltip.style.left = pos.x + "px";
    tooltip.style.top = pos.y + "px";
    tooltip.classList.add("show");
  }
  function hideTooltip() {
    tooltip.classList.remove("show");
  }

  if (hasFinePointer) {
    canvas.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      var hits = raycaster.intersectObjects(pinSprites, false);
      var newHover = -1;
      for (var hi = 0; hi < hits.length; hi++) {
        var hitIdx = hits[hi].object.userData.markerIndex;
        /* only pins that have finished landing are hoverable */
        if (markers[hitIdx].phase === "settled") { newHover = hitIdx; break; }
      }
      if (newHover !== hoveredIndex) {
        if (hoveredIndex !== -1) markers[hoveredIndex].hovered = false;
        hoveredIndex = newHover;
        if (hoveredIndex !== -1) {
          markers[hoveredIndex].hovered = true;
          showTooltip(hoveredIndex);
        } else {
          hideTooltip();
        }
      }
      canvas.style.cursor = hoveredIndex !== -1 ? "pointer" : "";
    }, { passive: true });

    canvas.addEventListener("pointerleave", function () {
      if (hoveredIndex !== -1) markers[hoveredIndex].hovered = false;
      hoveredIndex = -1;
      hideTooltip();
    });
  }

  /* ---------- Mouse parallax (max 5 deg) + slow autonomous camera drift ---------- */
  var mouseX = 0, mouseY = 0;
  if (hasFinePointer) {
    window.addEventListener("mousemove", function (e) {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }
  var MAX_TILT = THREE.MathUtils.degToRad(5);
  var curTiltX = 0, curTiltY = 0;

  /* ---------- Render loop (paused off-screen / hidden / reduced motion) ---------- */
  var clock = new THREE.Clock();
  var running = false;
  var animReq = null;
  var prevElapsed = 0;
  var seqTime = 0;

  function updateAssembledPositions() {
    var arr = dotGeo.attributes.position.array;
    var invEase = 1 - assembleProgress;
    for (var idx = 0; idx < dotPositions.length; idx += 3) {
      arr[idx] = dotPositions[idx] + scatterOffsets[idx] * invEase;
      arr[idx + 1] = dotPositions[idx + 1] + scatterOffsets[idx + 1] * invEase;
      arr[idx + 2] = dotPositions[idx + 2] + scatterOffsets[idx + 2] * invEase;
    }
    dotGeo.attributes.position.needsUpdate = true;
  }

  function updatePulse(delta) {
    if (!activePulse) {
      pulseSprites.forEach(function (spr) { spr.material.opacity = 0; });
      return;
    }
    activePulse.t += delta / TRAVEL_DUR;
    var tt = Math.min(activePulse.t, 1);
    pulseSprites.forEach(function (spr, idx) {
      var trailT = tt - idx * 0.05;
      if (trailT <= 0) {
        spr.material.opacity = 0;
        return;
      }
      var point = activePulse.region.curve.getPoint(Math.min(trailT, 1));
      spr.position.copy(point);
      spr.material.opacity = (1 - idx / PULSE_TRAIL) * 0.9;
    });
    if (tt >= 1) {
      dropMarker(activePulse.region);
      activePulse = null;
    }
  }

  /* ---------- Marker animation ----------
     Screen-up in map-local space, so the bounce/float reads vertically no
     matter how the map is tilted or swaying. */
  var upWorld = new THREE.Vector3(0, 1, 0);
  var upLocal = new THREE.Vector3(0, 1, 0);
  var invQuat = new THREE.Quaternion();
  var tmpPos = new THREE.Vector3();

  function updateMarkers(dt, seqT) {
    upWorld.set(0, 1, 0).applyQuaternion(camera.quaternion);
    invQuat.copy(mapGroup.quaternion).invert();
    upLocal.copy(upWorld).applyQuaternion(invQuat).normalize();

    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      if (m.phase === "hidden") continue;

      var scale = 1, opacity = 1, rise = 0, glowMul = 1;

      if (m.phase === "appearing") {
        m.t += dt / APPEAR_DUR;
        var p = Math.min(m.t, 1);
        /* damped oscillation: 0 -> overshoot -> single bounce -> settle */
        var damp = 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 2.35);
        scale = Math.max(0.001, damp);
        rise = -m.dropDist * (1 - damp);
        opacity = Math.min(1, p / 0.4);
        glowMul = 1.1 + (1 - p) * 0.7;
        if (!m.burst && p >= 0.5) { m.burst = true; spawnRings(m); }
        if (p >= 1) { m.phase = "settled"; m.t = 0; m.flash = 1; }
      } else if (m.phase === "clearing") {
        if (m.delay > 0) {
          m.delay -= dt;
        } else {
          m.t += dt / CLEAR_DUR;
          var cp = Math.min(m.t, 1);
          var ce = cp * cp;
          scale = 1 - 0.4 * ce;
          opacity = 1 - ce;
          rise = ce * m.h * 0.3;
          glowMul = 1 - ce * 0.6;
          if (cp >= 1) {
            m.phase = "hidden";
            m.pin.visible = false;
            m.glow.visible = false;
            m.pin.material.opacity = 0;
            m.glow.material.opacity = 0;
            m.hovered = false;
            m.hoverAmt = 0;
            if (hoveredIndex === i) { hoveredIndex = -1; hideTooltip(); }
            continue;
          }
        }
      }

      if (m.phase === "settled" || (m.phase === "clearing" && m.delay > 0)) {
        m.flash = Math.max(0, m.flash - dt / 0.7);
        if (!prefersReduced) {
          rise += Math.sin(seqT * (Math.PI * 2 / FLOAT_PERIOD) + m.phaseOff) * 0.055;
          glowMul = 0.88 + 0.14 * Math.sin(seqT * (Math.PI * 2 / BREATHE_PERIOD) + m.phaseOff);
        }
        glowMul += m.flash * 0.95;
      }

      /* hover: grow, lift, brighten */
      var hoverTarget = m.hovered ? 1 : 0;
      m.hoverAmt += (hoverTarget - m.hoverAmt) * Math.min(1, dt * 10);
      if (m.hoverAmt > 0.001) {
        scale *= 1 + 0.14 * m.hoverAmt;
        rise += 0.12 * m.hoverAmt;
        glowMul += 0.55 * m.hoverAmt;
      }

      var hh = m.h * scale;
      m.curPinH = hh;
      m.pin.scale.set(hh / PIN_ASPECT, hh, 1);
      m.pin.material.opacity = opacity;
      tmpPos.copy(m.region.worldPos).addScaledVector(upLocal, rise);
      m.pin.position.copy(tmpPos);

      var gs = hh * (1.26 + 0.2 * Math.max(0, glowMul - 1));
      m.glow.scale.set(gs, gs, 1);
      m.glow.position.copy(tmpPos).addScaledVector(upLocal, hh * 0.64);
      m.glow.material.opacity = Math.max(0, Math.min(1, 0.32 * glowMul * opacity));
    }
  }

  function animate() {
    if (!running) { animReq = null; return; }
    animReq = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    /* clamped own-delta: THREE.Clock's getElapsedTime already consumes the
       frame delta, and a tab/scroll pause must not fast-forward the sequence */
    var delta = Math.min(Math.max(t - prevElapsed, 0), 0.05);
    prevElapsed = t;
    if (!prefersReduced) seqTime += delta;

    if (assembleProgress < 1) updateAssembledPositions();

    if (!prefersReduced) {
      camera.position.x = baseCamPos.x + Math.sin(t * 0.15) * 1.1;
      camera.position.y = baseCamPos.y + Math.sin(t * 0.11) * 0.4;
      camera.lookAt(0, 0, 0);

      var sway = Math.sin(t * 0.18) * THREE.MathUtils.degToRad(9);
      var breatheScale = 1 + Math.sin(t * 0.6) * 0.015;
      mapGroup.scale.setScalar(breatheScale);

      var targetTiltY = hasFinePointer ? mouseX * MAX_TILT : 0;
      var targetTiltX = hasFinePointer ? mouseY * MAX_TILT * 0.6 : 0;
      curTiltX += (targetTiltX - curTiltX) * 0.04;
      curTiltY += (targetTiltY - curTiltY) * 0.04;
      mapGroup.rotation.y = sway + curTiltY;
      mapGroup.rotation.x = BASE_TILT + curTiltX;

      particleField.rotation.y = t * 0.01;
      updateSequence(delta);
      updatePulse(delta);
      updateRings(delta);
    }

    updateMarkers(delta, seqTime);

    if (hoveredIndex !== -1) {
      var pos = screenPosForIndex(hoveredIndex);
      tooltip.style.left = pos.x + "px";
      tooltip.style.top = pos.y + "px";
    }

    renderer.render(scene, camera);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  /* ---------- Lazy start/stop tied to section visibility ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          running = true;
          if (!animReq) animate();
          if (!revealed) {
            revealed = true;
            runAssembleReveal();
          } else {
            startCycle();
          }
        } else {
          running = false;
          stopCycle();
        }
      });
    }, { threshold: 0.15 });
    io.observe(section);
  } else {
    running = true;
    animate();
    revealed = true;
    runAssembleReveal();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") {
      running = false;
      stopCycle();
    } else if (revealed) {
      running = true;
      if (!animReq) animate();
      startCycle();
    }
  });
  } // end initScene
})();
