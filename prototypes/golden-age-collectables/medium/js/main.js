(function () {
  "use strict";

  // Mobile nav toggle (progressive enhancement: nav is visible without JS).
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
  }

  // "Open Today" hours, computed from data rendered into the page.
  var el = document.getElementById("open-today");
  var data = document.getElementById("hours-data");
  if (el && data) {
    try {
      var hours = JSON.parse(data.textContent);
      var today = hours[String(new Date().getDay())];
      if (today) el.textContent = "Open Today: " + today;
    } catch (err) {
      /* keep server-rendered fallback text */
    }
  }

  // Email signup — no backend in the prototype: prevent submit and reveal the
  // message pointing at the shop's real Google Group newsletter. No fake
  // success state. (Production: swap in the real Mailchimp-embed form action.)
  var form = document.getElementById("signup-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = document.getElementById("signup-message");
      if (msg) msg.hidden = false;
    });
  }
})();
