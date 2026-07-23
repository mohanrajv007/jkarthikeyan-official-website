/* =========================================================
   J. Karthikeyan & Co. — Core interactions
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Preloader ---------- */
  window.addEventListener("load", function () {
    var pre = document.getElementById("preloader");
    if (pre) {
      setTimeout(function () { pre.classList.add("hidden"); }, 350);
    }
  });

  /* ---------- Theme (dark / light) ---------- */
  var THEME_KEY = "jk-theme";
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-icon]").forEach(function (el) {
      el.innerHTML = theme === "dark" ? ICON_SUN : ICON_MOON;
    });
  }
  var ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  var savedTheme = localStorage.getItem(THEME_KEY);
  if (!savedTheme) {
    savedTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  applyTheme(savedTheme);

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var current = document.documentElement.getAttribute("data-theme") || "light";
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });

  /* ---------- Scroll progress bar ---------- */
  var progressBar = document.getElementById("scroll-progress");
  function updateProgress() {
    var h = document.documentElement;
    var scrolled = h.scrollTop;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (scrolled / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + "%";
  }

  /* ---------- Header state + back to top ---------- */
  var header = document.getElementById("site-header");
  var backToTop = document.getElementById("back-to-top");
  function onScroll() {
    updateProgress();
    if (header) header.classList.toggle("scrolled", window.scrollY > 40);
    if (backToTop) backToTop.classList.toggle("show", window.scrollY > 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Mobile menu ---------- */
  var hamburger = document.getElementById("hamburger");
  var mobileMenu = document.getElementById("mobile-menu");
  var backdrop = document.getElementById("menu-backdrop");
  function closeMenu() {
    hamburger && hamburger.classList.remove("active");
    mobileMenu && mobileMenu.classList.remove("open");
    backdrop && backdrop.classList.remove("open");
    document.body.style.overflow = "";
  }
  function toggleMenu() {
    var isOpen = mobileMenu && mobileMenu.classList.contains("open");
    if (isOpen) { closeMenu(); return; }
    hamburger && hamburger.classList.add("active");
    mobileMenu && mobileMenu.classList.add("open");
    backdrop && backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  hamburger && hamburger.addEventListener("click", toggleMenu);
  backdrop && backdrop.addEventListener("click", closeMenu);
  document.querySelectorAll(".mobile-menu a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });

  /* ---------- Active nav link on scroll ---------- */
  var navLinks = document.querySelectorAll(".nav-links a[href^='#'], .mobile-menu a[href^='#']");
  var sections = [];
  navLinks.forEach(function (link) {
    var id = link.getAttribute("href").slice(1);
    var sec = document.getElementById(id);
    if (sec) sections.push({ id: id, el: sec });
  });
  function highlightNav() {
    var pos = window.scrollY + 140;
    var activeId = null;
    sections.forEach(function (s) {
      if (pos >= s.el.offsetTop) activeId = s.id;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + activeId);
    });
  }
  if (sections.length) {
    window.addEventListener("scroll", highlightNav, { passive: true });
    highlightNav();
  }

  /* ---------- Reveal on scroll ----------
     Skipped when js/motion.js has already wired a GSAP ScrollTrigger
     version of this same reveal (window.__jkGsapReveal); this remains
     the fallback if that optional motion layer isn't available. */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (!window.__jkGsapReveal) {
    if ("IntersectionObserver" in window && revealEls.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = entry.target.getAttribute("data-reveal-delay") || 0;
            setTimeout(function () { entry.target.classList.add("is-visible"); }, delay);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    }
  }

  /* ---------- Animated counters ---------- */
  var counters = document.querySelectorAll("[data-counter]");
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-counter"));
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1800;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = target * eased;
      el.textContent = (Number.isInteger(target) ? Math.floor(value) : value.toFixed(1)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && counters.length) {
    var counterIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { counterIO.observe(el); });
  }

  /* ---------- Testimonial slider ---------- */
  var slides = document.querySelectorAll(".testimonial-slide");
  var dotsWrap = document.getElementById("slider-dots");
  var current = 0;
  var sliderTimer;
  if (slides.length) {
    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      if (i === 0) b.classList.add("active");
      b.setAttribute("aria-label", "Show testimonial " + (i + 1));
      b.addEventListener("click", function () { goToSlide(i); resetTimer(); });
      dotsWrap && dotsWrap.appendChild(b);
    });
    function goToSlide(i) {
      slides[current].classList.remove("active");
      dotsWrap && dotsWrap.children[current].classList.remove("active");
      current = (i + slides.length) % slides.length;
      slides[current].classList.add("active");
      dotsWrap && dotsWrap.children[current].classList.add("active");
    }
    document.getElementById("slider-prev") && document.getElementById("slider-prev").addEventListener("click", function () {
      goToSlide(current - 1); resetTimer();
    });
    document.getElementById("slider-next") && document.getElementById("slider-next").addEventListener("click", function () {
      goToSlide(current + 1); resetTimer();
    });
    function resetTimer() {
      clearInterval(sliderTimer);
      sliderTimer = setInterval(function () { goToSlide(current + 1); }, 6000);
    }
    resetTimer();
  }

  /* ---------- Form validation helper ---------- */
  function validateForm(form) {
    var valid = true;
    form.querySelectorAll("[required]").forEach(function (field) {
      var wrap = field.closest(".form-field");
      var errorEl = wrap ? wrap.querySelector(".field-error") : null;
      var msg = "";
      if (!field.value || !field.value.trim()) {
        msg = "This field is required.";
      } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
        msg = "Enter a valid email address.";
      } else if (field.type === "tel" && !/^[0-9+\-\s()]{7,}$/.test(field.value)) {
        msg = "Enter a valid phone number.";
      }
      if (wrap) wrap.classList.toggle("invalid", !!msg);
      if (errorEl) errorEl.textContent = msg;
      if (msg) valid = false;
    });
    return valid;
  }

  function wireForm(formId, successId) {
    var form = document.getElementById(formId);
    if (!form) return;
    var success = document.getElementById(successId);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(form)) return;
      var submitBtn = form.querySelector("button[type='submit']");
      var originalText = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Sending&hellip;"; }
      setTimeout(function () {
        form.reset();
        if (success) success.classList.add("show");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
        if (success) setTimeout(function () { success.classList.remove("show"); }, 6000);
      }, 900);
    });
    form.querySelectorAll("[required]").forEach(function (field) {
      field.addEventListener("blur", function () { validateForm(form); });
    });
  }
  wireForm("consultation-form", "consultation-success");
  wireForm("contact-form", "contact-success");

  var newsletterForm = document.getElementById("newsletter-form");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = newsletterForm.querySelector("input");
      if (input && input.value) {
        input.value = "";
        input.placeholder = "Subscribed! Thank you.";
        setTimeout(function () { input.placeholder = "Enter your email"; }, 3500);
      }
    });
  }

  /* ---------- Cookie consent ---------- */
  var COOKIE_KEY = "jk-cookie-consent";
  var cookieBanner = document.getElementById("cookie-banner");
  if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) {
    setTimeout(function () { cookieBanner.classList.add("show"); }, 1400);
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cookie-accept]")) {
      localStorage.setItem(COOKIE_KEY, "accepted");
      cookieBanner && cookieBanner.classList.remove("show");
    }
    if (e.target.closest("[data-cookie-decline]")) {
      localStorage.setItem(COOKIE_KEY, "declined");
      cookieBanner && cookieBanner.classList.remove("show");
    }
  });

  /* ---------- Chatbot (rule-based demo assistant) ---------- */
  var chatFab = document.getElementById("chatbot-fab");
  var chatWindow = document.getElementById("chat-window");
  var chatClose = document.getElementById("chat-close");
  var chatBody = document.getElementById("chat-body");
  var chatForm = document.getElementById("chat-form");
  var chatInput = document.getElementById("chat-input");

  var CHAT_RESPONSES = {
    services: "We offer Statutory Audit, Internal Audit, Tax Audit, GST Advisory, Income Tax, Accounting &amp; Bookkeeping, Payroll, Company Registration, ROC Compliance, Startup Consultancy, Financial Advisory and Business Consulting.",
    consultation: "Wonderful! Your first 30-minute consultation is completely free. Scroll to the \"Book Your Free Consultation\" section, or I can take you there now.",
    pricing: "Our pricing is transparent and tailored to your business size and requirements. Book a free consultation and our CAs will share a clear quote &mdash; no hidden charges.",
    contact: "You can reach us via the Contact page, call us, or WhatsApp us using the green button in the corner.",
    hours: "We're available Monday&ndash;Saturday, 9:30 AM to 6:30 PM IST.",
    default: "Thanks for reaching out! For detailed guidance, I'd recommend booking your free 30-minute consultation with one of our Chartered Accountants. Would you like help with that?"
  };

  function addMsg(text, who) {
    var div = document.createElement("div");
    div.className = "chat-msg " + who;
    div.innerHTML = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function botReply(text) {
    var lower = text.toLowerCase();
    var reply = CHAT_RESPONSES.default;
    if (/service|audit|tax|gst|payroll|roc|account/.test(lower)) reply = CHAT_RESPONSES.services;
    else if (/consult|book|appointment|free/.test(lower)) reply = CHAT_RESPONSES.consultation;
    else if (/price|cost|fee|charge/.test(lower)) reply = CHAT_RESPONSES.pricing;
    else if (/contact|phone|email|reach|address/.test(lower)) reply = CHAT_RESPONSES.contact;
    else if (/hour|time|open|close/.test(lower)) reply = CHAT_RESPONSES.hours;
    setTimeout(function () { addMsg(reply, "bot"); }, 500);
  }

  if (chatFab && chatWindow) {
    chatFab.addEventListener("click", function () {
      chatWindow.classList.toggle("open");
    });
    chatClose && chatClose.addEventListener("click", function () {
      chatWindow.classList.remove("open");
    });
    document.querySelectorAll(".chat-quick button").forEach(function (b) {
      b.addEventListener("click", function () {
        addMsg(b.textContent, "user");
        botReply(b.textContent);
      });
    });
    chatForm && chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = chatInput.value.trim();
      if (!val) return;
      addMsg(val, "user");
      botReply(val);
      chatInput.value = "";
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
