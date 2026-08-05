(function () {
  "use strict";

  /* FAQ accordion — same pattern used on every service/article page */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var question = item.querySelector(".faq-question");
    var answer = item.querySelector(".faq-answer");
    question.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      item.parentElement.querySelectorAll(".faq-item.open").forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove("open");
          openItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
          openItem.querySelector(".faq-answer").style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove("open");
        question.setAttribute("aria-expanded", "false");
        answer.style.maxHeight = null;
      } else {
        item.classList.add("open");
        question.setAttribute("aria-expanded", "true");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });

  /* "Apply Now" on a job card pre-selects that role in the form below */
  document.querySelectorAll(".apply-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var select = document.getElementById("cf-position");
      if (select && btn.dataset.role) {
        Array.prototype.forEach.call(select.options, function (opt) {
          if (opt.value === btn.dataset.role) select.value = btn.dataset.role;
        });
      }
    });
  });

  var MAX_RESUME_BYTES = 5 * 1024 * 1024; /* 5 MB */
  var ALLOWED_RESUME_EXT = [".pdf", ".doc", ".docx"];

  function resumeFileError(file) {
    var name = (file.name || "").toLowerCase();
    var okExt = ALLOWED_RESUME_EXT.some(function (ext) { return name.slice(-ext.length) === ext; });
    if (!okExt) return "Please upload a PDF, DOC or DOCX file.";
    if (file.size > MAX_RESUME_BYTES) return "File is too large — please upload something under 5 MB.";
    return "";
  }

  /* Résumé file input: show the chosen filename in the styled drop zone */
  var fileInput = document.getElementById("cf-resume");
  var fileWrap = document.getElementById("cf-file-wrap");
  var fileLabel = document.getElementById("cf-file-label");
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      var wrap = fileInput.closest(".form-field");
      var errorEl = wrap ? wrap.querySelector(".field-error") : null;
      if (fileInput.files && fileInput.files[0]) {
        var err = resumeFileError(fileInput.files[0]);
        if (err) {
          fileInput.value = "";
          fileLabel.textContent = "Click to choose a file, or drag it here";
          fileWrap.classList.remove("has-file");
          if (wrap) wrap.classList.add("invalid");
          if (errorEl) errorEl.textContent = err;
          return;
        }
        if (wrap) wrap.classList.remove("invalid");
        if (errorEl) errorEl.textContent = "";
        fileLabel.textContent = fileInput.files[0].name;
        fileWrap.classList.add("has-file");
      } else {
        fileLabel.textContent = "Click to choose a file, or drag it here";
        fileWrap.classList.remove("has-file");
      }
    });
  }

  /* Careers application form — self-contained copy of the same
     client-side-only submit pattern main.js uses for the other forms
     on this site (there is no backend, so this simulates success
     rather than actually sending the application anywhere). */
  var form = document.getElementById("careers-form");
  var success = document.getElementById("careers-success");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var valid = true;
      form.querySelectorAll("[required]").forEach(function (field) {
        var wrap = field.closest(".form-field");
        var errorEl = wrap ? wrap.querySelector(".field-error") : null;
        var msg = "";
        if (field.type === "file") {
          if (!field.files || !field.files.length) {
            msg = "Please attach your resume.";
          } else {
            msg = resumeFileError(field.files[0]);
          }
        } else if (!field.value || !field.value.trim()) {
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
      if (!valid) return;
      var submitBtn = form.querySelector("button[type='submit']");
      var originalText = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Sending&hellip;"; }
      setTimeout(function () {
        form.reset();
        fileLabel.textContent = "Click to choose a file, or drag it here";
        fileWrap.classList.remove("has-file");
        if (success) success.classList.add("show");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
        if (success) setTimeout(function () { success.classList.remove("show"); }, 6000);
      }, 900);
    });
  }
})();
