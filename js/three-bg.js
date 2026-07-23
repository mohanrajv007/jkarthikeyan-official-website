/* =========================================================
   J. Karthikeyan & Co. — Hero 3D background (Three.js)
   Elegant floating geometric shapes in navy / royal / gold.
   Degrades gracefully if Three.js fails to load or the user
   prefers reduced motion.
   ========================================================= */
(function () {
  "use strict";
  var canvas = document.getElementById("hero-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 14);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  /* Lighting */
  scene.add(new THREE.AmbientLight(0x8aa4ff, 0.6));
  var key = new THREE.PointLight(0xd4af37, 2.2, 60);
  key.position.set(8, 6, 10);
  scene.add(key);
  var rim = new THREE.PointLight(0x1447e6, 2.4, 60);
  rim.position.set(-10, -4, 6);
  scene.add(rim);

  /* Materials */
  var goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.25, emissive: 0x3a2a05, emissiveIntensity: 0.3 });
  var royalMat = new THREE.MeshStandardMaterial({ color: 0x1447e6, metalness: 0.5, roughness: 0.35, emissive: 0x040d33, emissiveIntensity: 0.4 });
  var wireMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, wireframe: true, transparent: true, opacity: 0.25 });
  var glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.08 });

  var group = new THREE.Group();
  scene.add(group);

  var geometries = [
    new THREE.IcosahedronGeometry(1.4, 0),
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.TorusGeometry(1.1, 0.32, 16, 60),
    new THREE.IcosahedronGeometry(0.8, 0),
    new THREE.TetrahedronGeometry(1.2, 0),
    new THREE.OctahedronGeometry(0.7, 0)
  ];
  var materials = [goldMat, royalMat, wireMat, glassMat];

  var meshes = [];
  var count = 9;
  for (var i = 0; i < count; i++) {
    var geo = geometries[i % geometries.length];
    var mat = materials[i % materials.length];
    var mesh = new THREE.Mesh(geo, mat);
    var radius = 6 + Math.random() * 5;
    var angle = (i / count) * Math.PI * 2;
    mesh.position.set(
      Math.cos(angle) * radius * (0.6 + Math.random() * 0.6),
      (Math.random() - 0.5) * 8,
      Math.sin(angle) * radius * 0.4 - 2
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    var scale = 0.5 + Math.random() * 0.9;
    mesh.scale.setScalar(scale);
    mesh.userData.speed = 0.05 + Math.random() * 0.12;
    mesh.userData.floatOffset = Math.random() * Math.PI * 2;
    mesh.userData.floatAmp = 0.4 + Math.random() * 0.6;
    group.add(mesh);
    meshes.push(mesh);
  }

  /* Subtle particle field */
  var particleCount = 160;
  var positions = new Float32Array(particleCount * 3);
  for (var p = 0; p < particleCount; p++) {
    positions[p * 3] = (Math.random() - 0.5) * 30;
    positions[p * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[p * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
  }
  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var particleMat = new THREE.PointsMaterial({ color: 0xd4af37, size: 0.05, transparent: true, opacity: 0.5 });
  var particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  var mouseX = 0, mouseY = 0, targetRotX = 0, targetRotY = 0;
  window.addEventListener("mousemove", function (e) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  var clock = new THREE.Clock();
  var running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    if (!prefersReduced) {
      meshes.forEach(function (m) {
        m.rotation.x += m.userData.speed * 0.01;
        m.rotation.y += m.userData.speed * 0.015;
        m.position.y += Math.sin(t * 0.5 + m.userData.floatOffset) * 0.0025 * m.userData.floatAmp;
      });
      particles.rotation.y = t * 0.015;

      targetRotY += (mouseX * 0.25 - targetRotY) * 0.03;
      targetRotX += (mouseY * 0.15 - targetRotX) * 0.03;
      group.rotation.y = targetRotY;
      group.rotation.x = targetRotX;
    }

    renderer.render(scene, camera);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  document.addEventListener("visibilitychange", function () {
    running = document.visibilityState === "visible";
    if (running) animate();
  });

  animate();
})();
