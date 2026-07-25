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

    function isInside(x, y) {
      if (x < 0 || y < 0 || x >= RASTER || y >= RASTER) return false;
      return data[(y * RASTER + x) * 4 + 3] > 40;
    }

    var EDGE_PROBE = 3;
    var bbox = { minX: RASTER, minY: RASTER, maxX: 0, maxY: 0 };
    var dots = [];
    var edgeDots = [];
    for (var y = 0; y < RASTER; y += STRIDE) {
      for (var x = 0; x < RASTER; x += STRIDE) {
        var alpha = data[(y * RASTER + x) * 4 + 3];
        if (alpha > 40) {
          if (x < bbox.minX) bbox.minX = x;
          if (x > bbox.maxX) bbox.maxX = x;
          if (y < bbox.minY) bbox.minY = y;
          if (y > bbox.maxY) bbox.maxY = y;
          dots.push(x, y);

          if (!isInside(x - EDGE_PROBE, y) || !isInside(x + EDGE_PROBE, y) ||
              !isInside(x, y - EDGE_PROBE) || !isInside(x, y + EDGE_PROBE)) {
            edgeDots.push(x, y);
          }
        }
      }
    }
    if (bbox.maxX <= bbox.minX || bbox.maxY <= bbox.minY) return null;
    return { bbox: bbox, dots: dots, edgeDots: edgeDots };
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

  /* ---------- Crisp coastline outline (bright dotted border tracing India's edge) ---------- */
  var outlinePositions = [];
  var rawEdge = silhouette.edgeDots || [];
  for (var e = 0; e < rawEdge.length; e += 2) {
    var ew = pixelToWorld(rawEdge[e], rawEdge[e + 1]);
    outlinePositions.push(ew.x, ew.y, 0.05 + Math.random() * 0.05);
  }
  var outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outlinePositions), 3));
  var outlineMat = new THREE.PointsMaterial({
    map: glowTexture,
    color: 0xfff3d6,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: prefersReduced ? 1 : 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var outlineCloud = new THREE.Points(outlineGeo, outlineMat);
  mapGroup.add(outlineCloud);
  var OUTLINE_TARGET_OPACITY = 1;

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

  var nodeGeo = new THREE.SphereGeometry(0.13, 16, 16);
  var nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  var nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, REGIONS.length);
  nodeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(REGIONS.length * 3), 3);
  mapGroup.add(nodeMesh);

  var dummy = new THREE.Object3D();
  var colorTmp = new THREE.Color();
  var IDLE_COLOR = new THREE.Color(0x5c85bd);
  var ACTIVE_COLOR = new THREE.Color(0xffd166);
  var nodeState = [];
  var regionIndex = {};

  REGIONS.forEach(function (region, idx) {
    regionIndex[region.name] = idx;
    var baseScale = region.hq ? 1.7 : (region.major ? 1.3 : 1);
    var idleGlow = region.hq ? 0.9 : (region.major ? 0.6 : 0.22);
    dummy.position.copy(region.worldPos);
    dummy.scale.setScalar(prefersReduced ? baseScale : 0.001);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(idx, dummy.matrix);
    colorTmp.copy(IDLE_COLOR).lerp(ACTIVE_COLOR, idleGlow);
    nodeMesh.setColorAt(idx, colorTmp);
    nodeState.push({
      region: region,
      baseScale: baseScale,
      curScale: prefersReduced ? baseScale : 0,
      autoTargetScale: baseScale,
      curGlow: idleGlow,
      autoTargetGlow: idleGlow,
      hovered: false
    });
  });
  nodeMesh.instanceMatrix.needsUpdate = true;
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;

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

  function lightUpNode(region) {
    var idx = regionIndex[region.name];
    if (idx === undefined) return;
    var ns = nodeState[idx];
    ns.autoTargetScale = ns.baseScale * 1.85;
    ns.autoTargetGlow = 1;
    setTimeout(function () {
      ns.autoTargetScale = ns.baseScale;
      ns.autoTargetGlow = region.hq ? 0.9 : 0.22;
    }, 1500);
  }

  /* ---------- Auto-cycle: every 2s, pulse HQ -> next state, forever ---------- */
  var cycleOrder = REGIONS.filter(function (r) { return !r.hq; });
  var cycleIndex = 0;
  var cycleTimer = null;
  function cycleTick() {
    var region = cycleOrder[cycleIndex % cycleOrder.length];
    cycleIndex++;
    startPulse(region);
  }
  function startCycle() {
    if (cycleTimer || prefersReduced) return;
    cycleTick();
    cycleTimer = setInterval(cycleTick, 2000);
  }
  function stopCycle() {
    clearInterval(cycleTimer);
    cycleTimer = null;
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
      outlineMat.opacity = OUTLINE_TARGET_OPACITY * assembleProgress;
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
    var v = nodeState[idx].region.worldPos.clone();
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
    var region = nodeState[idx].region;
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
      var hits = raycaster.intersectObject(nodeMesh);
      var newHover = hits.length ? hits[0].instanceId : -1;
      if (newHover !== hoveredIndex) {
        if (hoveredIndex !== -1) nodeState[hoveredIndex].hovered = false;
        hoveredIndex = newHover;
        if (hoveredIndex !== -1) {
          nodeState[hoveredIndex].hovered = true;
          showTooltip(hoveredIndex);
        } else {
          hideTooltip();
        }
      }
      canvas.style.cursor = hoveredIndex !== -1 ? "pointer" : "";
    }, { passive: true });

    canvas.addEventListener("pointerleave", function () {
      if (hoveredIndex !== -1) nodeState[hoveredIndex].hovered = false;
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
    activePulse.t += delta * 0.55;
    var tt = Math.min(activePulse.t, 1);
    pulseSprites.forEach(function (spr, idx) {
      var trailT = tt - idx * 0.035;
      if (trailT <= 0) {
        spr.material.opacity = 0;
        return;
      }
      var point = activePulse.region.curve.getPoint(Math.min(trailT, 1));
      spr.position.copy(point);
      spr.material.opacity = (1 - idx / PULSE_TRAIL) * 0.9;
    });
    if (tt >= 1) {
      lightUpNode(activePulse.region);
      activePulse = null;
    }
  }

  function updateNodes(t) {
    var changed = false;
    for (var idx = 0; idx < nodeState.length; idx++) {
      var ns = nodeState[idx];
      var boost = ns.hovered ? 1.55 : 1;
      var breathe = (ns.region.hq || ns.region.major) && !prefersReduced ? 1 + Math.sin(t * 2.2 + idx) * 0.06 : 1;
      var targetScale = ns.autoTargetScale * boost * breathe;
      var targetGlow = Math.min(1, ns.autoTargetGlow + (ns.hovered ? 0.55 : 0));
      if (Math.abs(ns.curScale - targetScale) > 0.0008 || Math.abs(ns.curGlow - targetGlow) > 0.0008) {
        ns.curScale += (targetScale - ns.curScale) * 0.12;
        ns.curGlow += (targetGlow - ns.curGlow) * 0.12;
        dummy.position.copy(ns.region.worldPos);
        dummy.scale.setScalar(Math.max(0.001, ns.curScale));
        dummy.updateMatrix();
        nodeMesh.setMatrixAt(idx, dummy.matrix);
        colorTmp.copy(IDLE_COLOR).lerp(ACTIVE_COLOR, ns.curGlow);
        nodeMesh.setColorAt(idx, colorTmp);
        changed = true;
      }
    }
    if (changed) {
      nodeMesh.instanceMatrix.needsUpdate = true;
      if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    }
  }

  function animate() {
    if (!running) { animReq = null; return; }
    animReq = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    var delta = clock.getDelta();

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
      updatePulse(delta);
    }

    updateNodes(t);

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
