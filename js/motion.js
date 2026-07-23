/* =========================================================
   J. Karthikeyan & Co. — Premium motion layer
   Lenis smooth scroll + GSAP ScrollTrigger reveals + subtle
   parallax / tilt / magnetic micro-interactions.

   Fully optional: if these CDN libraries fail to load, or the
   visitor has prefers-reduced-motion enabled, this file exits
   early and the site behaves exactly as it did via main.js.
   ========================================================= */
(function () {
  "use strict";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var hasGsap = typeof window.gsap !== "undefined";
  var hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";

  /* ---------- Lenis smooth scroll ---------- */
  var lenis = null;
  if (hasLenis) {
    lenis = new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    window.__lenis = lenis;
    document.documentElement.style.scrollBehavior = "auto";

    if (hasGsap) {
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(time) { lenis.raf(time); requestAnimationFrame(raf); });
    }

    /* In-page anchor links now ease via Lenis instead of the browser's
       instant/CSS jump, matching the smoother global scroll feel. */
    document.addEventListener("click", function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute("href");
      if (!hash || hash.length < 2) return;
      var target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.2 });
    });

    var backToTop = document.getElementById("back-to-top");
    if (backToTop) {
      backToTop.addEventListener("click", function () { lenis.scrollTo(0, { duration: 1.2 }); });
    }

    /* Lenis virtualises scroll independently of body { overflow }, so the
       mobile menu's existing scroll-lock needs an explicit stop/start
       alongside it or the page behind the menu keeps scrolling. */
    var hamburger = document.getElementById("hamburger");
    var mobileMenu = document.getElementById("mobile-menu");
    var menuBackdrop = document.getElementById("menu-backdrop");
    if (hamburger && mobileMenu) {
      hamburger.addEventListener("click", function () {
        if (mobileMenu.classList.contains("open")) lenis.start();
        else lenis.stop();
      });
    }
    if (menuBackdrop) menuBackdrop.addEventListener("click", function () { lenis.start(); });
    document.querySelectorAll(".mobile-menu a").forEach(function (a) {
      a.addEventListener("click", function () { lenis.start(); });
    });
  }

  /* ---------- ScrollTrigger-driven reveal ----------
     Upgrades the trigger mechanism behind the existing [data-reveal]
     fade/rise (main.js skips its own IntersectionObserver when it sees
     window.__jkGsapReveal). The CSS transition that does the actual
     fade + translateY is untouched — this only adds a synced blur-in on
     top via the `filter` property, which never touches `transform`. */
  if (hasGsap && hasScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) lenis.on("scroll", ScrollTrigger.update);
    window.__jkGsapReveal = true;

    var addBlur = window.innerWidth >= 768;
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      var delayMs = parseFloat(el.getAttribute("data-reveal-delay")) || 0;
      if (addBlur) gsap.set(el, { filter: "blur(5px)" });
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: function () {
          el.classList.add("is-visible");
          if (addBlur) {
            gsap.to(el, { filter: "blur(0px)", duration: 0.9, delay: delayMs / 1000, ease: "power2.out" });
          }
        }
      });
    });
  }

  if (!hasGsap || !hasFinePointer) return;

  /* ---------- Hero parallax ----------
     Drives the standalone `translate` CSS property (not `transform`) via
     a plain-object GSAP tween, so it layers on top of any element that
     already has its own transform-based animation/transition instead of
     overwriting it. */
  var parallaxLayers = [];
  function registerParallax(el, depth) {
    if (!el) return;
    var state = { x: 0, y: 0 };
    function apply() { el.style.translate = state.x.toFixed(2) + "px " + state.y.toFixed(2) + "px"; }
    el.style.willChange = "translate";
    var qx = gsap.quickTo(state, "x", { duration: 0.9, ease: "power3.out", onUpdate: apply });
    var qy = gsap.quickTo(state, "y", { duration: 0.9, ease: "power3.out", onUpdate: apply });
    parallaxLayers.push({ qx: qx, qy: qy, depth: depth });
  }

  document.querySelectorAll("#hero, .contact-hero").forEach(function (heroSection) {
    registerParallax(heroSection.querySelector(".hero-badge"), 8);
    registerParallax(heroSection.querySelector(".hero-content h1, h1"), 10);
    registerParallax(heroSection.querySelector(".hero-sub"), 6);
    registerParallax(heroSection.querySelector(".hero-stats"), 5);
    heroSection.querySelectorAll(".hero-shape").forEach(function (shape, i) {
      registerParallax(shape, 18 + i * 6);
    });
  });

  if (parallaxLayers.length) {
    window.addEventListener("mousemove", function (e) {
      var nx = (e.clientX / window.innerWidth) - 0.5;
      var ny = (e.clientY / window.innerHeight) - 0.5;
      parallaxLayers.forEach(function (l) { l.qx(nx * l.depth); l.qy(ny * l.depth); });
    }, { passive: true });
  }

  /* ---------- Card tilt ----------
     Drives the standalone `rotate` CSS property (single axis+angle,
     approximating combined X/Y tilt — accurate enough at these small
     angles) so it composes with each card's existing
     `:hover { transform: translateY(...) }` lift instead of fighting it. */
  var tiltSelectors = ".service-card, .feature-card, .team-card, .insight-card, .value-pillar, .industry-chip, .timeline-row .tl-card, .contact-info-card";
  document.querySelectorAll(tiltSelectors).forEach(function (card) {
    var state = { rx: 0, ry: 0 };
    function apply() {
      var angle = Math.min(7, Math.sqrt(state.rx * state.rx + state.ry * state.ry));
      card.style.rotate = (-state.rx).toFixed(2) + " " + state.ry.toFixed(2) + " 0 " + angle.toFixed(2) + "deg";
    }
    var qx = gsap.quickTo(state, "rx", { duration: 0.5, ease: "power3.out", onUpdate: apply });
    var qy = gsap.quickTo(state, "ry", { duration: 0.5, ease: "power3.out", onUpdate: apply });
    card.addEventListener("mouseenter", function () { card.style.willChange = "rotate"; });
    card.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var px = ((e.clientX - rect.left) / rect.width) - 0.5;
      var py = ((e.clientY - rect.top) / rect.height) - 0.5;
      qx(py * 8);
      qy(px * 8);
    });
    card.addEventListener("mouseleave", function () {
      qx(0); qy(0);
      card.style.willChange = "auto";
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll(".btn").forEach(function (btn) {
    var state = { x: 0, y: 0 };
    function apply() { btn.style.translate = state.x.toFixed(2) + "px " + state.y.toFixed(2) + "px"; }
    var qx = gsap.quickTo(state, "x", { duration: 0.35, ease: "power3.out", onUpdate: apply });
    var qy = gsap.quickTo(state, "y", { duration: 0.35, ease: "power3.out", onUpdate: apply });
    btn.addEventListener("mouseenter", function () { btn.style.willChange = "translate"; });
    btn.addEventListener("mousemove", function (e) {
      var rect = btn.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      qx(px * 10);
      qy(py * 10);
    });
    btn.addEventListener("mouseleave", function () {
      qx(0); qy(0);
      btn.style.willChange = "auto";
    });
  });
})();
