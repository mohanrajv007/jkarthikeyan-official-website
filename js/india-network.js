/* =========================================================
   J. Karthikeyan & Co. — India Network Coverage (Three.js)
   Premium enterprise-grade digital map: a thin glowing border
   traced from the country silhouette, a soft interior particle
   fill, elegant white/cyan pulsing state nodes, organised HQ-hub
   connection arcs with travelling light, transient hover/activation
   labels, and a scroll-triggered assembly reveal.

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

  /* ---------- Rasterise the silhouette, separating edge pixels (alpha>40
     with a transparent neighbour) from interior fill — this is what lets
     the render show a distinct thin glowing border plus a softer interior
     particle fill, instead of one flat dot mass. ---------- */
  var RASTER = 1024;
  function buildSilhouette(img) {
    var off = document.createElement("canvas");
    off.width = RASTER;
    off.height = RASTER;
    var octx = off.getContext("2d");
    if (!octx) return null;
    try { octx.drawImage(img, 0, 0, RASTER, RASTER); } catch (e) { return null; }

    var data;
    try { data = octx.getImageData(0, 0, RASTER, RASTER).data; } catch (e) { return null; }

    function alphaAt(x, y) {
      if (x < 0 || y < 0 || x >= RASTER || y >= RASTER) return 0;
      return data[(y * RASTER + x) * 4 + 3];
    }

    var bbox = { minX: RASTER, minY: RASTER, maxX: 0, maxY: 0 };
    var interior = [];
    var edge = [];
    for (var y = 0; y < RASTER; y++) {
      for (var x = 0; x < RASTER; x++) {
        var a = alphaAt(x, y);
        if (a <= 40) continue;
        if (x < bbox.minX) bbox.minX = x;
        if (x > bbox.maxX) bbox.maxX = x;
        if (y < bbox.minY) bbox.minY = y;
        if (y > bbox.maxY) bbox.maxY = y;
        var isEdge = alphaAt(x - 1, y) <= 40 || alphaAt(x + 1, y) <= 40 ||
                     alphaAt(x, y - 1) <= 40 || alphaAt(x, y + 1) <= 40;
        if (isEdge) edge.push(x, y); else interior.push(x, y);
      }
    }
    if (bbox.maxX <= bbox.minX || bbox.maxY <= bbox.minY) return null;
    return { bbox: bbox, interior: interior, edge: edge };
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
  scene.fog = new THREE.FogExp2(0x04111f, 0.009);

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
  var BASE_TILT = -0.4;
  mapGroup.rotation.x = BASE_TILT;
  scene.add(mapGroup);

  /* ---------- Palette ---------- */
  var COL_BORDER = 0x5daeff;
  var COL_PRIMARY = 0x66d9ff;
  var COL_SECONDARY = 0xa8e8ff;
  var COL_LINE = 0x66d9ff;
  var COL_NODE = 0xffffff;

  /* ---------- Soft glow sprite texture (cheap stand-in for real bloom) ---------- */
  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(168,232,255,0.95)");
    grad.addColorStop(1, "rgba(168,232,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTexture = makeGlowTexture();

  /* ---------- Tight point texture for the border/interior particle map —
     a crisp core rather than a wide soft blur, so dense clusters still read
     as distinct fine particles instead of a hazy blob. ---------- */
  function makeDotTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 32;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.32, "rgba(210,240,255,0.92)");
    grad.addColorStop(0.68, "rgba(150,215,255,0.32)");
    grad.addColorStop(1, "rgba(150,215,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  var dotTexture = makeDotTexture();

  /* ---------- Soft wide halo texture (glow behind nodes / outer atmosphere) ---------- */
  function makeHaloTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(168,232,255,0.55)");
    grad.addColorStop(0.5, "rgba(168,232,255,0.2)");
    grad.addColorStop(1, "rgba(168,232,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var haloTexture = makeHaloTexture();

  /* ---------- Elegant node-orb texture — small bright white core, soft
     cyan glow, refined rather than a literal map pin. ---------- */
  function makeOrbTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.55, "rgba(210,242,255,0.5)");
    grad.addColorStop(1, "rgba(210,242,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  var orbTexture = makeOrbTexture();

  /* ---------- GPS-style pulse-ring texture ---------- */
  function makeRingTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(168,232,255,0)");
    g.addColorStop(0.6, "rgba(168,232,255,0)");
    g.addColorStop(0.79, "rgba(220,246,255,0.8)");
    g.addColorStop(0.9, "rgba(168,232,255,0.2)");
    g.addColorStop(1, "rgba(168,232,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var ringTexture = makeRingTexture();

  /* ---------- Premium 3D location-pin texture ----------
     Drawn once to an offscreen canvas and shared by every marker sprite:
     glossy gradient body (#1E88E5), inner white lens, specular sheen, glass
     rim-light and a soft contact shadow baked in at the tip. Google/Apple
     Maps-style, not the map's own cyan theme — this is the "state marker",
     the map underneath is untouched. */
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
    body.addColorStop(0, "#64B5F6");
    body.addColorStop(0.22, "#42A5F5");
    body.addColorStop(0.5, "#1E88E5");
    body.addColorStop(1, "#1565C0");
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);

    var gloss = ctx.createRadialGradient(cx - R * 0.46, headY - R * 0.58, 2, cx - R * 0.46, headY - R * 0.58, R * 0.95);
    gloss.addColorStop(0, "rgba(255,255,255,0.42)");
    gloss.addColorStop(0.4, "rgba(255,255,255,0.08)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);

    var rim = ctx.createRadialGradient(cx + R * 0.62, headY + R * 0.5, 4, cx + R * 0.62, headY + R * 0.5, R * 0.95);
    rim.addColorStop(0, "rgba(100, 181, 246, 0.32)");
    rim.addColorStop(0.6, "rgba(100,181,246,0.08)");
    rim.addColorStop(1, "rgba(100,181,246,0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);

    var sheen = ctx.createLinearGradient(cx - R, headY - R * 0.95, cx + R * 0.3, headY + R * 0.25);
    sheen.addColorStop(0, "rgba(255,255,255,0.22)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.06)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.2, headY - R * 0.5, R * 0.74, R * 0.36, deg(-22), 0, Math.PI * 2);
    ctx.fill();

    var deep = ctx.createLinearGradient(cx, headY + R * 0.35, cx, tipY);
    deep.addColorStop(0, "rgba(8,30,58,0)");
    deep.addColorStop(1, "rgba(8,30,58,0.4)");
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, PIN_TEX_W, PIN_TEX_H);
    ctx.restore();

    pinPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(13,53,101,0.5)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, headY, R - 8, deg(198), deg(316), false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineCap = "round";
    ctx.stroke();

    var lensR = R * 0.4;
    ctx.save();
    ctx.shadowColor = "rgba(10,40,80,0.4)";
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
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  var pinTexture = makePinTexture();

  /* ---------- Neutral (untinted) glow texture for the pin's golden halo —
     kept separate from the map's own cyan haloTexture so the marker glow
     tints to pure gold rather than mixing with the map's palette. ---------- */
  function makeGoldGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var goldGlowTexture = makeGoldGlowTexture();
  var GOLD = 0xffd166;
  /* Glow/pulse tint for the pin markers themselves (kept separate from GOLD,
     which still colours the HQ connection lines — those are untouched). */
  var MARKER_GLOW = 0x1e88e5;

  /* ---------- Interior particle fill (sparse, dim — texture, not mass) ---------- */
  var rawInterior = silhouette.interior;
  var totalInterior = rawInterior.length / 2;
  var maxInteriorDots = 3200;
  var interiorKeep = Math.min(1, maxInteriorDots / totalInterior);
  var interiorPositions = [];
  for (var i = 0; i < rawInterior.length; i += 2) {
    if (Math.random() > interiorKeep) continue;
    var w1 = pixelToWorld(rawInterior[i] + (Math.random() - 0.5), rawInterior[i + 1] + (Math.random() - 0.5));
    interiorPositions.push(w1.x, w1.y, (Math.random() - 0.5) * 0.12);
  }

  /* ---------- Border particle line (dense, bright — the "thin glowing
     border" the design calls for, traced straight from the silhouette
     edge rather than hand-drawn). ---------- */
  var rawEdge = silhouette.edge;
  var edgePositions = [];
  for (var j = 0; j < rawEdge.length; j += 2) {
    var w2 = pixelToWorld(rawEdge[j], rawEdge[j + 1]);
    edgePositions.push(w2.x, w2.y, (Math.random() - 0.5) * 0.1 + 0.05);
  }

  /* Island clusters (Andaman & Nicobar, Lakshadweep) — the traced mainland
     silhouette doesn't include these, so scatter small procedural clusters
     at their real projected lat/lon, styled as border particles. */
  function addIslandCluster(lat, lon, count, spreadX, spreadY, target) {
    var center = regionWorldPos({ lat: lat, lon: lon });
    for (var n = 0; n < count; n++) {
      var ox = (Math.random() - 0.5) * spreadX;
      var oy = (Math.random() - 0.5) * spreadY * (0.5 + Math.random() * 0.5);
      target.push(center.x + ox, center.y + oy, (Math.random() - 0.5) * 0.1 + 0.05);
    }
  }
  addIslandCluster(9.5, 92.8, 90, 0.5, 2.2, edgePositions);
  addIslandCluster(10.57, 72.64, 36, 0.32, 0.65, edgePositions);

  var interiorPosArr = new Float32Array(interiorPositions);
  var edgePosArr = new Float32Array(edgePositions);
  var scatterInterior = new Float32Array(interiorPosArr.length);
  var scatterEdge = new Float32Array(edgePosArr.length);
  function fillScatter(target) {
    for (var s = 0; s < target.length; s += 3) {
      target[s] = (Math.random() - 0.5) * 16;
      target[s + 1] = (Math.random() - 0.5) * 10 + 7;
      target[s + 2] = (Math.random() - 0.5) * 10 - 6;
    }
  }
  fillScatter(scatterInterior);
  fillScatter(scatterEdge);

  var interiorGeo = new THREE.BufferGeometry();
  var interiorLive = new Float32Array(interiorPosArr.length);
  interiorLive.set(interiorPosArr);
  interiorGeo.setAttribute("position", new THREE.BufferAttribute(interiorLive, 3));
  var interiorMat = new THREE.PointsMaterial({
    map: dotTexture,
    color: COL_SECONDARY,
    size: 0.05,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
  var interiorCloud = new THREE.Points(interiorGeo, interiorMat);
  mapGroup.add(interiorCloud);

  var edgeGeo = new THREE.BufferGeometry();
  var edgeLive = new Float32Array(edgePosArr.length);
  edgeLive.set(edgePosArr);
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgeLive, 3));
  var edgeMat = new THREE.PointsMaterial({
    map: dotTexture,
    color: COL_BORDER,
    size: 0.082,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var edgeCloud = new THREE.Points(edgeGeo, edgeMat);
  mapGroup.add(edgeCloud);

  /* ---------- Subtle outer atmosphere halo behind the whole map ---------- */
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", edgeGeo.getAttribute("position"));
  var haloMat = new THREE.PointsMaterial({
    map: haloTexture,
    color: COL_PRIMARY,
    size: 0.34,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var mapHalo = new THREE.Points(haloGeo, haloMat);
  mapHalo.position.z = -0.08;
  mapGroup.add(mapHalo);

  /* ---------- Ambient particle field (white / ice-blue) ---------- */
  var particleCount = 160;
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
    color: 0xdff3ff,
    size: 0.055,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var particleField = new THREE.Points(particleGeo, particleMat);
  scene.add(particleField);

  /* ---------- State / UT nodes ---------- */
  var hqRegion = null;
  for (var r = 0; r < REGIONS.length; r++) {
    REGIONS[r].worldPos = (function (region) {
      var pos = regionWorldPos(region);
      return new THREE.Vector3(pos.x, pos.y, region.hq ? 0.55 : 0.15);
    })(REGIONS[r]);
    if (REGIONS[r].hq) hqRegion = REGIONS[r];
  }

  var markerGroup = new THREE.Group();
  mapGroup.add(markerGroup);

  var PIN_BASE_H = 0.85;
  var APPEAR_DUR = 0.7;    /* bounce-in: 700ms (spec: 600-800ms) */
  var STEP_DELAY = 0.55;   /* delay between states: 550ms (spec: 400-700ms) */
  var TRAVEL_DUR = 0.42;   /* must stay < STEP_DELAY so pulses never overlap/abandon */
  var RING_DUR = 1.0;      /* pulse duration: 1s */
  var FLOAT_PERIOD = 5.0;
  var BREATHE_PERIOD = 4.0;
  var CLEAR_DUR = 0.4;
  var LABEL_HOLD = 1900;

  var markers = [];
  var orbSprites = [];
  var regionIndex = {};

  REGIONS.forEach(function (region, idx) {
    regionIndex[region.name] = idx;
    var sizeMul = region.hq ? 1.4 : (region.major ? 1.15 : 1);
    var h = PIN_BASE_H * sizeMul;

    var pin = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pinTexture,
      transparent: true,
      opacity: prefersReduced ? 1 : 0,
      depthTest: false,
      depthWrite: false
    }));
    pin.center.set(0.5, 0);          /* anchor the tip on the state, so it grows upward out of position */
    pin.scale.set(prefersReduced ? h / PIN_ASPECT : 0.001, prefersReduced ? h : 0.001, 1);
    pin.position.copy(region.worldPos);
    pin.renderOrder = 6;
    pin.visible = !!prefersReduced;
    pin.userData.markerIndex = idx;
    markerGroup.add(pin);
    orbSprites.push(pin);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: goldGlowTexture,
      color: MARKER_GLOW,
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
      orb: pin,
      glow: glow,
      h: h,
      curPinH: h,
      dropDist: h * 1.05,
      phase: prefersReduced ? "settled" : "hidden",
      t: 0,
      delay: 0,
      flash: 0,
      burst: false,
      hovered: false,
      hoverAmt: 0,
      phaseOff: idx * 0.7
    });
  });

  /* ---------- Pooled pulse rings ---------- */
  var ringGeo = new THREE.PlaneGeometry(1, 1);
  var ringPool = [];
  for (var rg = 0; rg < 9; rg++) {
    var ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      map: ringTexture,
      color: MARKER_GLOW,
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
      ring.delay = spawned * 0.22;
      ring.size = marker.h * 5.5;
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
      ring.mesh.material.opacity = 0.55 * Math.pow(1 - ring.t, 1.6);
    }
  }

  /* ---------- Connection lines (HQ -> every other state), organised
     hub-and-spoke so the network never reads as a tangled web ---------- */
  var linesGroup = new THREE.Group();
  mapGroup.add(linesGroup);
  var curveEntries = [];

  REGIONS.forEach(function (region) {
    if (region.hq || !hqRegion) return;
    var start = hqRegion.worldPos.clone();
    var end = region.worldPos.clone();
    var mid = start.clone().lerp(end, 0.5);
    mid.z += start.distanceTo(end) * 0.2 + 0.1;
    var curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    region.curve = curve;
    var points = curve.getPoints(34);
    var geo = new THREE.BufferGeometry().setFromPoints(points);
    var mat = new THREE.PointsMaterial({
      map: glowTexture,
      color: GOLD,
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      opacity: prefersReduced ? 0.45 : 0,
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
      color: 0xffe9b3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var sprite = new THREE.Sprite(pMat);
    sprite.scale.setScalar(0.42 - t * 0.045);
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
    m.orb.visible = true;
    m.glow.visible = true;
    showLabel(idx, true);
  }

  /* ---------- Transient labels ----------
     State names are never shown permanently. Hover shows a label while the
     pointer stays over a settled node; sequential activation briefly shows
     the same tooltip for a newly-lit node, then fades it out on its own. */
  var hoveredIndex = -1;
  var autoLabelIdx = -1;
  var autoLabelTimer = null;

  function screenPosForIndex(idx) {
    var m = markers[idx];
    var v = m.orb.position.clone();
    mapGroup.updateMatrixWorld();
    v.applyMatrix4(mapGroup.matrixWorld);
    /* lift the anchor to the crown of the pin so the tooltip clears it */
    var up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    v.addScaledVector(up, m.curPinH * mapGroup.scale.x);
    v.project(camera);
    var rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-v.y * 0.5 + 0.5) * rect.height
    };
  }

  function renderTooltip(idx) {
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

  function showLabel(idx, isAuto) {
    if (hoveredIndex !== -1 && isAuto) return; /* don't interrupt an active hover */
    clearTimeout(autoLabelTimer);
    autoLabelIdx = idx;
    renderTooltip(idx);
    if (isAuto) {
      autoLabelTimer = setTimeout(function () {
        if (autoLabelIdx === idx && hoveredIndex === -1) hideTooltip();
      }, LABEL_HOLD);
    }
  }
  function hideTooltip() {
    tooltip.classList.remove("show");
    autoLabelIdx = -1;
  }

  if (hasFinePointer) {
    var raycaster = new THREE.Raycaster();
    var pointerNDC = new THREE.Vector2();
    canvas.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      var hits = raycaster.intersectObjects(orbSprites, false);
      var newHover = -1;
      for (var hi = 0; hi < hits.length; hi++) {
        var hitIdx = hits[hi].object.userData.markerIndex;
        if (markers[hitIdx].phase === "settled") { newHover = hitIdx; break; }
      }
      if (newHover !== hoveredIndex) {
        if (hoveredIndex !== -1) markers[hoveredIndex].hovered = false;
        hoveredIndex = newHover;
        if (hoveredIndex !== -1) {
          markers[hoveredIndex].hovered = true;
          clearTimeout(autoLabelTimer);
          renderTooltip(hoveredIndex);
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

  /* ---------- Sequential reveal cycle ----------
     HQ lands first, then each remaining state is announced by a light pulse
     travelling out from HQ; the node fades/pops in the moment the light
     arrives, with its label briefly shown. Once every state is marked: hold
     3s, clear smoothly, repeat forever. Driven by accumulated frame delta so
     pausing off-screen resumes exactly where it left off. */
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
      m.delay = (revealOrder.length - 1 - i) * 0.025;
    }
    hideTooltip();
  }

  function updateSequence(dt) {
    if (seq.state === "idle") return;
    seq.timer -= dt;
    if (seq.state === "revealing") {
      if (seq.next < revealOrder.length) {
        /* also gate on !activePulse: TRAVEL_DUR can exceed STEP_DELAY, and
           without this a new pulse silently overwrites (abandons) one still
           travelling, so most states would never reach dropMarker at all */
        if (seq.timer <= 0 && !activePulse) {
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
      curveEntries.forEach(function (c) { c.line.material.opacity = 0.45; });
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
        c.line.material.opacity = 0.45 * lineP;
      });
      if (p < 1) requestAnimationFrame(step);
      else startCycle();
    }
    requestAnimationFrame(step);
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
    var invEase = 1 - assembleProgress;
    var iArr = interiorGeo.attributes.position.array;
    for (var idx = 0; idx < interiorPosArr.length; idx += 3) {
      iArr[idx] = interiorPosArr[idx] + scatterInterior[idx] * invEase;
      iArr[idx + 1] = interiorPosArr[idx + 1] + scatterInterior[idx + 1] * invEase;
      iArr[idx + 2] = interiorPosArr[idx + 2] + scatterInterior[idx + 2] * invEase;
    }
    interiorGeo.attributes.position.needsUpdate = true;
    var eArr = edgeGeo.attributes.position.array;
    for (var idx2 = 0; idx2 < edgePosArr.length; idx2 += 3) {
      eArr[idx2] = edgePosArr[idx2] + scatterEdge[idx2] * invEase;
      eArr[idx2 + 1] = edgePosArr[idx2 + 1] + scatterEdge[idx2 + 1] * invEase;
      eArr[idx2 + 2] = edgePosArr[idx2 + 2] + scatterEdge[idx2 + 2] * invEase;
    }
    edgeGeo.attributes.position.needsUpdate = true;
  }

  function updatePulse(delta) {
    if (!activePulse) {
      pulseSprites.forEach(function (spr) { spr.material.opacity = 0; });
      return;
    }
    activePulse.t += delta / TRAVEL_DUR;
    var tt = Math.min(activePulse.t, 1);
    pulseSprites.forEach(function (spr, idx) {
      var trailT = tt - idx * 0.045;
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

  /* ---------- Marker animation ---------- */
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
        /* damped oscillation: 0 -> overshoot -> single bounce -> settle,
           starting below its final position and moving up into place */
        var damp = 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 2.2);
        scale = Math.max(0.001, damp);
        rise = -m.dropDist * (1 - damp);
        opacity = Math.min(1, p / 0.35);
        glowMul = 1.15 + (1 - p) * 0.7;
        if (!m.burst && p >= 0.45) { m.burst = true; spawnRings(m); }
        if (p >= 1) { m.phase = "settled"; m.t = 0; m.flash = 1; }
      } else if (m.phase === "clearing") {
        if (m.delay > 0) {
          m.delay -= dt;
        } else {
          m.t += dt / CLEAR_DUR;
          var cp = Math.min(m.t, 1);
          var ce = cp * cp;
          scale = 1 - 0.5 * ce;
          opacity = 1 - ce;
          glowMul = 1 - ce * 0.6;
          if (cp >= 1) {
            m.phase = "hidden";
            m.orb.visible = false;
            m.glow.visible = false;
            m.orb.material.opacity = 0;
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
          rise += Math.sin(seqT * (Math.PI * 2 / FLOAT_PERIOD) + m.phaseOff) * 0.05;
          glowMul = 0.85 + 0.16 * Math.sin(seqT * (Math.PI * 2 / BREATHE_PERIOD) + m.phaseOff);
        }
        glowMul += m.flash * 0.9;
      }

      var hoverTarget = m.hovered ? 1 : 0;
      m.hoverAmt += (hoverTarget - m.hoverAmt) * Math.min(1, dt * 10);
      if (m.hoverAmt > 0.001) {
        scale *= 1 + 0.3 * m.hoverAmt;
        rise += 0.1 * m.hoverAmt;
        glowMul += 0.55 * m.hoverAmt;
      }

      var hh = m.h * scale;
      m.curPinH = hh;
      m.orb.scale.set(hh / PIN_ASPECT, hh, 1);
      m.orb.material.opacity = opacity;
      tmpPos.copy(m.region.worldPos).addScaledVector(upLocal, rise);
      m.orb.position.copy(tmpPos);

      var gs = m.h * (1.5 + 0.7 * Math.max(0, glowMul - 1)) * scale;
      m.glow.scale.set(gs, gs, 1);
      m.glow.position.copy(tmpPos).addScaledVector(upLocal, hh * 0.62);
      m.glow.material.opacity = Math.max(0, Math.min(1, 0.42 * glowMul * opacity));
    }
  }

  function animate() {
    if (!running) { animReq = null; return; }
    animReq = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    var delta = Math.min(Math.max(t - prevElapsed, 0), 0.05);
    prevElapsed = t;
    if (!prefersReduced) seqTime += delta;

    if (assembleProgress < 1) updateAssembledPositions();

    if (!prefersReduced) {
      camera.position.x = baseCamPos.x + Math.sin(t * 0.15) * 1.1;
      camera.position.y = baseCamPos.y + Math.sin(t * 0.11) * 0.4;
      camera.lookAt(0, 0, 0);

      var sway = Math.sin(t * 0.18) * THREE.MathUtils.degToRad(8);
      var breatheScale = 1 + Math.sin(t * 0.6) * 0.014;
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
    } else if (autoLabelIdx !== -1 && markers[autoLabelIdx] && markers[autoLabelIdx].phase !== "hidden") {
      var pos2 = screenPosForIndex(autoLabelIdx);
      tooltip.style.left = pos2.x + "px";
      tooltip.style.top = pos2.y + "px";
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
