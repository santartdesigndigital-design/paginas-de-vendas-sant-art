window.initSantArte = function () {
  if (window.__santArteReady) return;
  window.__santArteReady = true;

  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  const overlay = document.querySelector(".nav-overlay");
  const faqButtons = document.querySelectorAll(".faq-item button");
  const yearEl = document.getElementById("year");
  const checkoutButtons = document.querySelectorAll("[data-checkout]");
  const sticky = document.querySelector(".sticky-cta");
  const offer = document.getElementById("oferta");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox ? lightbox.querySelector("img") : null;
  const lightboxClose = lightbox ? lightbox.querySelector("button") : null;

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const closeNav = function () {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
  };

  const openNav = function () {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "true");
    nav.classList.add("is-open");
    document.body.classList.add("nav-open");
  };

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) closeNav();
      else openNav();
    });
  }

  if (overlay) overlay.addEventListener("click", closeNav);
  document.querySelectorAll(".site-nav a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  window.addEventListener("scroll", function () {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    if (sticky && offer) {
      const offerTop = offer.getBoundingClientRect().top;
      const passedHero = window.scrollY > 520;
      const offerVisible = offerTop < window.innerHeight && offerTop + offer.offsetHeight > 0;
      sticky.style.display = passedHero && !offerVisible && window.innerWidth <= 980 ? "block" : "none";
    }
  });

  faqButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const item = btn.closest(".faq-item");
      const open = item.classList.contains("is-open");
      document.querySelectorAll(".faq-item.is-open").forEach(function (el) {
        el.classList.remove("is-open");
        el.querySelector("button").setAttribute("aria-expanded", "false");
      });
      if (!open) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      const offset = header ? header.offsetHeight + 8 : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach(function (el) {
    observer.observe(el);
  });

  checkoutButtons.forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      const url = btn.getAttribute("data-checkout-url");
      if (!url) return;
      event.preventDefault();
      window.location.href = url;
    });
  });

  const openLightbox = function (src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.hidden = false;
    lightbox.classList.add("is-open");
  };

  const closeLightbox = function () {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.remove("is-open");
    lightbox.hidden = true;
    lightboxImg.src = "";
  };

  document.querySelectorAll(".zoom img, .journey-hero img, .polaroid img:not(.tape), .mini-collage img").forEach(function (img) {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", function () {
      openLightbox(img.src, img.alt);
    });
  });

  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (lightbox) {
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeLightbox();
  });
};
