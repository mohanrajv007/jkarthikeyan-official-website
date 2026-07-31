/* =========================================================
   J. Karthikeyan & Co. — Global Network Coverage (Three.js)
   A true 3D globe: a lit solid sphere with a glowing ice-blue
   dot-map of the continents on its surface, a lat/long graticule,
   a Fresnel atmosphere rim, great-circle flight-path arcs from HQ
   to each hub with a travelling light pulse, hover tooltips and a
   scroll-triggered assembly reveal.

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

  /* ---------- World silhouette source (stylised continent outline) ---------- */
  var WORLD_SVG_SRC = "assets/world-outline.svg";
  var GEO_BOUNDS = { lonMin: -180, lonMax: 180, latMin: -60, latMax: 78 };

  var REGIONS = [
    { name: "India", lat: 13.08, lon: 80.27, clients: 96, hq: true },
    { name: "United States", lat: 40.71, lon: -74.0, clients: 210, major: true },
    { name: "United Kingdom", lat: 51.51, lon: -0.13, clients: 140, major: true },
    { name: "Canada", lat: 43.65, lon: -79.38, clients: 60 },
    { name: "Germany", lat: 50.11, lon: 8.68, clients: 85 },
    { name: "France", lat: 48.86, lon: 2.35, clients: 70 },
    { name: "UAE", lat: 25.2, lon: 55.27, clients: 130, major: true },
    { name: "Singapore", lat: 1.35, lon: 103.82, clients: 95, major: true },
    { name: "Australia", lat: -33.87, lon: 151.21, clients: 55 },
    { name: "Japan", lat: 35.68, lon: 139.65, clients: 65 },
    { name: "South Africa", lat: -26.2, lon: 28.05, clients: 40 },
    { name: "Brazil", lat: -23.55, lon: -46.63, clients: 50 }
  ];

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function geoToUV(lat, lon) {
    return {
      u: clamp01((lon - GEO_BOUNDS.lonMin) / (GEO_BOUNDS.lonMax - GEO_BOUNDS.lonMin)),
      v: clamp01(1 - (lat - GEO_BOUNDS.latMin) / (GEO_BOUNDS.latMax - GEO_BOUNDS.latMin))
    };
  }

  /* ---------- Rasterise the silhouette image (aspect-matched: the SVG's
     viewBox is 2:1, so the raster canvas is too — drawing it into a square
     would squash the continents vertically). ---------- */
  var RASTER_W = 1024, RASTER_H = 512;
  function buildSilhouette(img) {
    var off = document.createElement("canvas");
    off.width = RASTER_W;
    off.height = RASTER_H;
    var octx = off.getContext("2d");
    if (!octx) return null;
    try { octx.drawImage(img, 0, 0, RASTER_W, RASTER_H); } catch (e) { return null; }

    var data;
    try { data = octx.getImageData(0, 0, RASTER_W, RASTER_H).data; } catch (e) { return null; }

    var bbox = { minX: RASTER_W, minY: RASTER_H, maxX: 0, maxY: 0 };
    var dots = [];
    for (var y = 0; y < RASTER_H; y++) {
      for (var x = 0; x < RASTER_W; x++) {
        var alpha = data[(y * RASTER_W + x) * 4 + 3];
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

  var worldImg = new Image();
  worldImg.onload = function () {
    var silhouette = buildSilhouette(worldImg);
    if (silhouette) initScene(silhouette);
  };
  worldImg.onerror = function () {};
  worldImg.src = WORLD_SVG_SRC;

  function initScene(silhouette) {
  var bbox = silhouette.bbox;

  /* pixel (within the silhouette bbox) -> lat/lon, inverting geoToUV */
  function pixelToLatLon(px, py) {
    var u = (px - bbox.minX) / (bbox.maxX - bbox.minX);
    var v = (py - bbox.minY) / (bbox.maxY - bbox.minY);
    return {
      lon: GEO_BOUNDS.lonMin + u * (GEO_BOUNDS.lonMax - GEO_BOUNDS.lonMin),
      lat: GEO_BOUNDS.latMax - v * (GEO_BOUNDS.latMax - GEO_BOUNDS.latMin)
    };
  }

  var GLOBE_RADIUS = 8;
  /* Center the camera-facing hemisphere over the EMEA/India/APAC cluster —
     8 of our 12 hubs sit within ~90 deg of longitude 65, so that band reads
     clearly; the Americas (roughly antipodal) drift into view as the globe
     slowly auto-rotates. Centering on the empty mid-Atlantic instead left
     the visible hemisphere mostly bare ocean. */
  var CENTER_LON_DEG = 65;

  function latLonToVector3(lat, lon, radius) {
    var latRad = THREE.MathUtils.degToRad(lat);
    var lonRad = THREE.MathUtils.degToRad(lon);
    return new THREE.Vector3(
      radius * Math.cos(latRad) * Math.sin(lonRad),
      radius * Math.sin(latRad),
      radius * Math.cos(latRad) * Math.cos(lonRad)
    );
  }
  function regionWorldPos(region, radius) {
    return latLonToVector3(region.lat, region.lon, radius);
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
  scene.fog = new THREE.FogExp2(0x04111f, 0.016);

  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  var baseCamPos = new THREE.Vector3(0, GLOBE_RADIUS * 0.3, GLOBE_RADIUS * 2.6);
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
  var BASE_TILT = 0.12;
  mapGroup.rotation.x = BASE_TILT;
  mapGroup.rotation.y = THREE.MathUtils.degToRad(-CENTER_LON_DEG);
  scene.add(mapGroup);

  /* ---------- Lighting: kept deliberately dim. The dots are the only thing
     that should read as bright — a strong ambient/key light here washes the
     whole sphere into a soft glowing patch that fights the dot-map for
     contrast, which is what made the continents unreadable before. */
  scene.add(new THREE.AmbientLight(0x14263c, 0.55));
  var keyLight = new THREE.DirectionalLight(0x6fa8d8, 0.4);
  keyLight.position.set(-7, 9, 11);
  scene.add(keyLight);
  var rimLight = new THREE.DirectionalLight(0x1c4870, 0.2);
  rimLight.position.set(7, -5, -8);
  scene.add(rimLight);

  /* ---------- Solid globe base (near-black ocean; dots + graticule sit just
     above it — high contrast is what makes the continent shapes legible) ---------- */
  var globeMat = new THREE.MeshPhongMaterial({
    color: 0x030a14,
    emissive: 0x00040a,
    shininess: 8,
    specular: 0x0e2438
  });
  var globeMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 0.994, 64, 48), globeMat);
  mapGroup.add(globeMesh);

  /* ---------- Latitude / longitude graticule ---------- */
  var graticuleGroup = new THREE.Group();
  var graticuleMat = new THREE.LineBasicMaterial({ color: 0x3f7aa8, transparent: true, opacity: 0.16 });
  var GRID_R = GLOBE_RADIUS * 1.002;
  [-60, -30, 0, 30, 60].forEach(function (lat) {
    var latRad = THREE.MathUtils.degToRad(lat);
    var ringR = GRID_R * Math.cos(latRad);
    var y = GRID_R * Math.sin(latRad);
    var pts = [];
    for (var i = 0; i <= 64; i++) {
      var a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(ringR * Math.sin(a), y, ringR * Math.cos(a)));
    }
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    graticuleGroup.add(new THREE.Line(geo, graticuleMat));
  });
  for (var lonG = -150; lonG <= 180; lonG += 30) {
    var pts2 = [];
    for (var j = 0; j <= 32; j++) {
      var latT = -90 + (j / 32) * 180;
      pts2.push(latLonToVector3(latT, lonG, GRID_R));
    }
    var geo2 = new THREE.BufferGeometry().setFromPoints(pts2);
    graticuleGroup.add(new THREE.Line(geo2, graticuleMat));
  }
  mapGroup.add(graticuleGroup);

  /* ---------- Fresnel atmosphere rim glow ---------- */
  var atmosphereMat = new THREE.ShaderMaterial({
    vertexShader: [
      "varying vec3 vNormal;",
      "void main() {",
      "  vNormal = normalize( normalMatrix * normal );",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
      "}"
    ].join("\n"),
    fragmentShader: [
      "varying vec3 vNormal;",
      "void main() {",
      "  float intensity = pow( 0.62 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 3.2 );",
      "  gl_FragColor = vec4( 0.42, 0.78, 1.0, 1.0 ) * intensity;",
      "}"
    ].join("\n"),
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  var atmosphere = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.14, 48, 48), atmosphereMat);
  mapGroup.add(atmosphere);

  /* ---------- Soft glow sprite texture (cheap stand-in for real bloom) ---------- */
  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(163,224,255,0.97)");
    grad.addColorStop(1, "rgba(163,224,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTexture = makeGlowTexture();

  /* ---------- Tight coastline-dot texture ----------
     A crisp, small-radius core with a fast falloff, so thousands of
     overlapping points read as distinct pinpoints tracing a coastline —
     the wide, slow-fading gradient used elsewhere causes dense clusters to
     wash out into one soft blob, which is what made the continents
     unreadable. */
  function makeDotTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 32;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(200,235,255,0.95)");
    grad.addColorStop(0.65, "rgba(140,205,245,0.35)");
    grad.addColorStop(1, "rgba(140,205,245,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  var dotTexture = makeDotTexture();

  /* ---------- Soft wide halo texture (glow behind each hub node) ---------- */
  function makeHaloTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(163,224,255,0.55)");
    grad.addColorStop(0.5, "rgba(163,224,255,0.2)");
    grad.addColorStop(1, "rgba(163,224,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var haloTexture = makeHaloTexture();

  /* ---------- Glowing node-orb texture — bright core fading out, tinted
     per-material (ice-blue / white-hot for HQ), monochrome to match the
     reference globe rather than a literal map pin. ---------- */
  function makeOrbTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 96;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.28, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.72, "rgba(255,255,255,0.14)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 96, 96);
    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  var orbTexture = makeOrbTexture();

  /* ---------- GPS-style pulse-ring texture (thin ice-blue band) ---------- */
  function makeRingTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(163,224,255,0)");
    g.addColorStop(0.6, "rgba(163,224,255,0)");
    g.addColorStop(0.79, "rgba(210,240,255,0.85)");
    g.addColorStop(0.9, "rgba(163,224,255,0.22)");
    g.addColorStop(1, "rgba(163,224,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var ringTexture = makeRingTexture();

  /* ---------- Dot-map on the sphere surface ----------
     Random (not fixed-stride) sampling avoids Moire banding across the
     raster's varying row density. */
  var rawDots = silhouette.dots;
  var totalCandidates = rawDots.length / 2;
  var maxDots = 32000;
  var keepProbability = Math.min(1, maxDots / totalCandidates);
  var dotNormals = [];
  var finalPositions = [];
  for (var i = 0; i < rawDots.length; i += 2) {
    if (Math.random() > keepProbability) continue;
    var jpx = rawDots[i] + (Math.random() - 0.5);
    var jpy = rawDots[i + 1] + (Math.random() - 0.5);
    var ll = pixelToLatLon(jpx, jpy);
    var pos = latLonToVector3(ll.lat, ll.lon, GLOBE_RADIUS + 0.01 + Math.random() * 0.03);
    finalPositions.push(pos.x, pos.y, pos.z);
    dotNormals.push(pos.x / GLOBE_RADIUS, pos.y / GLOBE_RADIUS, pos.z / GLOBE_RADIUS);
  }

  var dotPositions = new Float32Array(finalPositions);
  /* Scroll-in assembly: dots start scattered outward along their own
     surface normal (as if condensing out of space onto the globe). */
  var scatterOffsets = new Float32Array(dotPositions.length);
  for (var s = 0; s < scatterOffsets.length; s += 3) {
    var nx = dotNormals[s], ny = dotNormals[s + 1], nz = dotNormals[s + 2];
    var dist = 4 + Math.random() * 11;
    scatterOffsets[s] = nx * dist + (Math.random() - 0.5) * 2.5;
    scatterOffsets[s + 1] = ny * dist + (Math.random() - 0.5) * 2.5;
    scatterOffsets[s + 2] = nz * dist + (Math.random() - 0.5) * 2.5;
  }

  var dotGeo = new THREE.BufferGeometry();
  var livePositions = new Float32Array(dotPositions.length);
  livePositions.set(dotPositions);
  dotGeo.setAttribute("position", new THREE.BufferAttribute(livePositions, 3));
  var dotMat = new THREE.PointsMaterial({
    map: dotTexture,
    color: 0xbfe8ff,
    size: 0.088,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var dotCloud = new THREE.Points(dotGeo, dotMat);
  mapGroup.add(dotCloud);

  /* ---------- Ambient particle field (white / ice-blue / cyan) ---------- */
  var particleCount = 260;
  var particlePositions = new Float32Array(particleCount * 3);
  var particleColors = new Float32Array(particleCount * 3);
  var tintPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xbfe6ff),
    new THREE.Color(0x6ecdf5)
  ];
  for (var p = 0; p < particleCount; p++) {
    particlePositions[p * 3] = (Math.random() - 0.5) * 34;
    particlePositions[p * 3 + 1] = (Math.random() - 0.5) * 18 + 3;
    particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
    var tint = tintPalette[p % tintPalette.length];
    particleColors[p * 3] = tint.r;
    particleColors[p * 3 + 1] = tint.g;
    particleColors[p * 3 + 2] = tint.b;
  }
  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  var particleMat = new THREE.PointsMaterial({
    map: glowTexture,
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var particleField = new THREE.Points(particleGeo, particleMat);
  scene.add(particleField);

  /* ---------- Hub nodes ---------- */
  var hqRegion = null;
  for (var r = 0; r < REGIONS.length; r++) {
    REGIONS[r].worldPos = regionWorldPos(REGIONS[r], GLOBE_RADIUS + (REGIONS[r].hq ? 0.06 : 0.04));
    if (REGIONS[r].hq) hqRegion = REGIONS[r];
  }

  var markerGroup = new THREE.Group();
  mapGroup.add(markerGroup);

  var NODE_BASE_SIZE = 0.32;
  var APPEAR_DUR = 0.7;
  var STEP_DELAY = 0.55;
  var TRAVEL_DUR = 0.75;
  var RING_DUR = 1.0;
  var FLOAT_PERIOD = 5.0;
  var BREATHE_PERIOD = 4.0;
  var CLEAR_DUR = 0.45;

  var ICE = 0x9fe0ff;
  var ICE_MAJOR = 0xcdeeff;
  var HQ_TINT = 0xffffff;

  var markers = [];
  var orbSprites = [];
  var regionIndex = {};

  REGIONS.forEach(function (region, idx) {
    regionIndex[region.name] = idx;
    var sizeMul = region.hq ? 1.5 : (region.major ? 1.2 : 1);
    var size = NODE_BASE_SIZE * sizeMul;
    var tint = region.hq ? HQ_TINT : (region.major ? ICE_MAJOR : ICE);

    var orb = new THREE.Sprite(new THREE.SpriteMaterial({
      map: orbTexture,
      color: tint,
      transparent: true,
      opacity: prefersReduced ? 1 : 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    orb.scale.setScalar(prefersReduced ? size : 0.001);
    orb.position.copy(region.worldPos);
    orb.renderOrder = 6;
    orb.visible = !!prefersReduced;
    orb.userData.markerIndex = idx;
    markerGroup.add(orb);
    orbSprites.push(orb);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture,
      color: tint,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    glow.scale.setScalar(size * 3.2);
    glow.position.copy(region.worldPos);
    glow.renderOrder = 4;
    glow.visible = !!prefersReduced;
    markerGroup.add(glow);

    markers.push({
      region: region,
      orb: orb,
      glow: glow,
      size: size,
      normal: region.worldPos.clone().normalize(),
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

  /* ---------- Pooled pulse rings (flat, camera-facing) ---------- */
  var ringGeo = new THREE.PlaneGeometry(1, 1);
  var ringPool = [];
  for (var rg = 0; rg < 9; rg++) {
    var ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      map: ringTexture,
      color: 0x9fe0ff,
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
      ring.size = marker.size * 7;
      ring.mesh.position.copy(marker.region.worldPos);
      ring.mesh.lookAt(camera.position);
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
      ring.mesh.material.opacity = 0.7 * Math.pow(1 - ring.t, 1.6);
    }
  }

  /* ---------- Great-circle flight-path arcs (HQ -> every hub) ---------- */
  function greatCircleArc(startVec, endVec, radius, segments) {
    var startDir = startVec.clone().normalize();
    var endDir = endVec.clone().normalize();
    var angle = startDir.angleTo(endDir);
    var sinAngle = Math.sin(angle);
    var heightFactor = 0.16 + Math.min(0.4, angle / Math.PI) * 0.55;
    var pts = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var a, b;
      if (sinAngle < 1e-6) { a = 1 - t; b = t; } else {
        a = Math.sin((1 - t) * angle) / sinAngle;
        b = Math.sin(t * angle) / sinAngle;
      }
      var dir = new THREE.Vector3(
        a * startDir.x + b * endDir.x,
        a * startDir.y + b * endDir.y,
        a * startDir.z + b * endDir.z
      ).normalize();
      var rr = radius * (1 + heightFactor * Math.sin(t * Math.PI));
      pts.push(dir.multiplyScalar(rr));
    }
    return pts;
  }

  var linesGroup = new THREE.Group();
  mapGroup.add(linesGroup);
  var curveEntries = [];

  REGIONS.forEach(function (region) {
    if (region.hq || !hqRegion) return;
    var arcPoints = greatCircleArc(hqRegion.worldPos, region.worldPos, GLOBE_RADIUS, 48);
    var curve = new THREE.CatmullRomCurve3(arcPoints);
    region.curve = curve;
    var points = curve.getPoints(60);
    var geo = new THREE.BufferGeometry().setFromPoints(points);
    var mat = new THREE.PointsMaterial({
      map: glowTexture,
      color: 0x9fe0ff,
      size: 0.04,
      sizeAttenuation: true,
      transparent: true,
      opacity: prefersReduced ? 0.3 : 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var line = new THREE.Points(geo, mat);
    linesGroup.add(line);
    curveEntries.push({ region: region, line: line });
  });

  /* ---------- Travelling pulse (HQ -> active hub), fibre-optic style trail ---------- */
  var PULSE_TRAIL = 7;
  var pulseSprites = [];
  for (var t = 0; t < PULSE_TRAIL; t++) {
    var pMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xd8f2ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var sprite = new THREE.Sprite(pMat);
    sprite.scale.setScalar(0.46 - t * 0.045);
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
  }

  /* ---------- Sequential reveal cycle ----------
     HQ lands first, then each hub is announced by a light pulse travelling
     out from HQ along its great-circle arc; the node fades/pops in the
     moment the light arrives. Once every hub is lit: hold 3s, clear
     smoothly, repeat forever. Driven by accumulated frame delta so pausing
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
      curveEntries.forEach(function (c) { c.line.material.opacity = 0.3; });
      startCycle();
      return;
    }
    var start = null;
    var DURATION = 2000;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / DURATION, 1);
      assembleProgress = 1 - Math.pow(1 - p, 3);
      curveEntries.forEach(function (c, idx) {
        var lineP = Math.min(1, Math.max(0, p * 1.4 - idx * (0.4 / curveEntries.length)));
        c.line.material.opacity = 0.3 * lineP;
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
    var v = m.orb.position.clone();
    mapGroup.updateMatrixWorld();
    v.applyMatrix4(mapGroup.matrixWorld);
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
    tooltip.style.top = (pos.y - 16) + "px";
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
      var trailT = tt - idx * 0.04;
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
     A gentle fade + scale pop, floating outward/inward along each hub's own
     surface normal (not a global "up") so it bobs naturally off the globe. */
  var tmpPos = new THREE.Vector3();

  function updateMarkers(dt, seqT) {
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      if (m.phase === "hidden") continue;

      var scale = 1, opacity = 1, rise = 0, glowMul = 1;

      if (m.phase === "appearing") {
        m.t += dt / APPEAR_DUR;
        var p = Math.min(m.t, 1);
        var damp = 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 1.6);
        scale = Math.max(0.001, damp);
        opacity = Math.min(1, p / 0.35);
        glowMul = 1.2 + (1 - p) * 0.8;
        if (!m.burst && p >= 0.4) { m.burst = true; spawnRings(m); }
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
          rise += Math.sin(seqT * (Math.PI * 2 / FLOAT_PERIOD) + m.phaseOff) * 0.035;
          glowMul = 0.85 + 0.18 * Math.sin(seqT * (Math.PI * 2 / BREATHE_PERIOD) + m.phaseOff);
        }
        glowMul += m.flash * 1.1;
      }

      var hoverTarget = m.hovered ? 1 : 0;
      m.hoverAmt += (hoverTarget - m.hoverAmt) * Math.min(1, dt * 10);
      if (m.hoverAmt > 0.001) {
        scale *= 1 + 0.35 * m.hoverAmt;
        rise += 0.09 * m.hoverAmt;
        glowMul += 0.6 * m.hoverAmt;
      }

      var s = m.size * scale;
      m.orb.scale.setScalar(Math.max(0.001, s));
      m.orb.material.opacity = opacity;
      tmpPos.copy(m.region.worldPos).addScaledVector(m.normal, rise);
      m.orb.position.copy(tmpPos);

      var gs = m.size * (3.0 + 1.4 * Math.max(0, glowMul - 1)) * scale;
      m.glow.scale.set(gs, gs, 1);
      m.glow.position.copy(tmpPos);
      m.glow.material.opacity = Math.max(0, Math.min(1, 0.4 * glowMul * opacity));
    }
  }

  function animate() {
    if (!running) { animReq = null; return; }
    animReq = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    /* clamped own-delta: a tab/scroll pause must not fast-forward the sequence */
    var delta = Math.min(Math.max(t - prevElapsed, 0), 0.05);
    prevElapsed = t;
    if (!prefersReduced) seqTime += delta;

    if (assembleProgress < 1) updateAssembledPositions();

    if (!prefersReduced) {
      camera.position.x = baseCamPos.x + Math.sin(t * 0.12) * 1.1;
      camera.position.y = baseCamPos.y + Math.sin(t * 0.09) * 0.4;
      camera.lookAt(0, 0, 0);

      var slowSpin = t * 0.012;
      var sway = Math.sin(t * 0.14) * THREE.MathUtils.degToRad(4);
      var breatheScale = 1 + Math.sin(t * 0.5) * 0.012;
      mapGroup.scale.setScalar(breatheScale);

      var targetTiltY = hasFinePointer ? mouseX * MAX_TILT : 0;
      var targetTiltX = hasFinePointer ? mouseY * MAX_TILT * 0.6 : 0;
      curTiltX += (targetTiltX - curTiltX) * 0.04;
      curTiltY += (targetTiltY - curTiltY) * 0.04;
      mapGroup.rotation.y = THREE.MathUtils.degToRad(-CENTER_LON_DEG) + slowSpin + sway + curTiltY;
      mapGroup.rotation.x = BASE_TILT + curTiltX;

      particleField.rotation.y = t * 0.008;
      updateSequence(delta);
      updatePulse(delta);
      updateRings(delta);
    }

    updateMarkers(delta, seqTime);

    if (hoveredIndex !== -1) {
      var pos = screenPosForIndex(hoveredIndex);
      tooltip.style.left = pos.x + "px";
      tooltip.style.top = (pos.y - 16) + "px";
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
