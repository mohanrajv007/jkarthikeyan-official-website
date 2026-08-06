/* Builds the job cards and the résumé form's position dropdown from the
   list in js/jobs-data.js. Runs immediately (placed right after the empty
   .jobs-grid in careers.html) so the cards exist in the DOM before
   motion.js wires up the scroll-reveal animation on [data-reveal]. */
(function () {
  "use strict";
  var jobs = window.JOB_OPENINGS || [];
  var grid = document.getElementById("jobs-grid");

  if (grid) {
    jobs.forEach(function (job, i) {
      var card = document.createElement("article");
      card.className = "job-card";
      card.setAttribute("data-reveal", "");
      var delay = (i % 3) * 40;
      if (delay) card.setAttribute("data-reveal-delay", String(delay));

      var main = document.createElement("div");
      main.className = "job-main";

      var h3 = document.createElement("h3");
      h3.textContent = job.title;
      main.appendChild(h3);

      var meta = document.createElement("div");
      meta.className = "job-meta";
      [job.department, job.location, job.type, job.experience].forEach(function (t) {
        var span = document.createElement("span");
        span.textContent = t;
        meta.appendChild(span);
      });
      main.appendChild(meta);

      var p = document.createElement("p");
      p.textContent = job.description;
      main.appendChild(p);

      var apply = document.createElement("a");
      apply.href = "#apply";
      apply.className = "btn btn-royal apply-btn";
      apply.setAttribute("data-role", job.title);
      apply.textContent = "Apply Now";

      card.appendChild(main);
      card.appendChild(apply);
      grid.appendChild(card);
    });
  }

  /* The position <select> lives further down the page (in the résumé form),
     which the parser hasn't reached yet at this point, so its population
     is deferred until the full document is ready. */
  document.addEventListener("DOMContentLoaded", function () {
    var select = document.getElementById("cf-position");
    if (!select) return;

    select.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a position";
    select.appendChild(placeholder);

    jobs.forEach(function (job) {
      var opt = document.createElement("option");
      opt.textContent = job.title;
      select.appendChild(opt);
    });

    var general = document.createElement("option");
    general.textContent = "General Application";
    select.appendChild(general);
  });
})();
