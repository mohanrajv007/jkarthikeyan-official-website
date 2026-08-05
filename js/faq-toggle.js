(function () {
  "use strict";
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
})();
