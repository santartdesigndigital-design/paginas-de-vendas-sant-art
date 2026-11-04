(function () {
  function getPath(obj, path) {
    return path.split(".").reduce(function (acc, key) {
      if (acc == null) return acc;
      if (/^\d+$/.test(key)) return acc[Number(key)];
      return acc[key];
    }, obj);
  }

  function setText(el, value) {
    if (value == null) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.value = value;
      return;
    }
    el.textContent = value;
  }

  function pageContext() {
    var boot = window.__SANTARTE_BOOT || {};
    if (boot.preview || boot.slug) {
      return { preview: boot.preview || "", slug: boot.slug || "" };
    }
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var preview = path.match(/^\/preview\/([a-zA-Z0-9-]+)$/);
    if (preview) return { preview: preview[1], slug: "" };
    if (path === "/" || path === "/index.html") return { preview: "", slug: "" };
    var slug = path.replace(/^\//, "");
    if (slug.indexOf("/") !== -1) return { preview: "", slug: "" };
    return { preview: "", slug: slug };
  }

  function contentUrl() {
    var ctx = pageContext();
    if (ctx.preview) return "/api/content?preview=" + encodeURIComponent(ctx.preview);
    if (ctx.slug) return "/api/content?slug=" + encodeURIComponent(ctx.slug);
    return "/api/content";
  }

  function absUrl(src) {
    if (!src) return src;
    if (/^https?:\/\//i.test(src) || src.charAt(0) === "/") return src;
    return "/" + src.replace(/^\.\//, "");
  }

  function injectScript(src, inner) {
    var el = document.createElement("script");
    if (src) el.src = src;
    if (inner) el.text = inner;
    el.async = true;
    document.head.appendChild(el);
    return el;
  }

  function injectTracking(settings) {
    if (!settings) return;
    var pixel = (settings.metaPixelId || "").trim();
    var ga = (settings.googleAnalyticsId || "").trim();
    var gtm = (settings.googleTagManagerId || "").trim();
    if (pixel && !window.fbq) {
      injectScript(null,
        "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?" +
        "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;" +
        "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
        "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script'," +
        "'https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + pixel.replace(/'/g, "") + "');fbq('track','PageView');"
      );
    }
    if (ga && !window.gtag) {
      injectScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga));
      injectScript(null,
        "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
        "gtag('js',new Date());gtag('config','" + ga.replace(/'/g, "") + "');"
      );
    }
    if (gtm && !window.__santArteGtm) {
      window.__santArteGtm = true;
      injectScript(null,
        "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});" +
        "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;" +
        "j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);}" +
        ")(window,document,'script','dataLayer','" + gtm.replace(/'/g, "") + "');"
      );
    }
  }

  function showPreviewBanner(page) {
    if (!page || !page.preview) return;
    if (document.querySelector(".preview-banner")) return;
    var bar = document.createElement("div");
    bar.className = "preview-banner";
    bar.innerHTML = "Pré-visualização — esta página ainda não está pública para visitantes. <a href=\"/admin\">Voltar ao painel</a>";
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function blankNode(section) {
    var wrap = document.createElement("div");
    wrap.className = "wrap center";
    var eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    var title = document.createElement("h2");
    var lede = document.createElement("p");
    lede.className = "lede";
    var fields = section.fields || {};
    eyebrow.textContent = fields.eyebrow || "";
    title.textContent = fields.title || section.title || "";
    lede.textContent = fields.lede || "";
    wrap.appendChild(eyebrow);
    wrap.appendChild(title);
    wrap.appendChild(lede);
    if (section.type === "gallery") {
      var grid = document.createElement("div");
      grid.className = "mosaic";
      (section.images || []).forEach(function (image) {
        if (!image || !image.src) return;
        var fig = document.createElement("figure");
        var img = document.createElement("img");
        img.src = absUrl(image.src);
        img.alt = image.alt || "";
        fig.appendChild(img);
        grid.appendChild(fig);
      });
      wrap.appendChild(grid);
    }
    var node = document.createElement("section");
    node.className = "section bg-cream";
    node.appendChild(wrap);
    return node;
  }

  function applyLayout(content) {
    var layout = content._layout;
    if (!layout || !Array.isArray(layout.sections) || !layout.sections.length) return;
    var main = document.getElementById("conteudo");
    if (!main) return;

    var waves = [];
    var originals = {};
    Array.prototype.slice.call(main.children).forEach(function (child) {
      if (child.tagName && child.tagName.toLowerCase() === "svg") {
        waves.push(child);
        return;
      }
      var type = child.getAttribute("data-section-type");
      if (type && !originals[type]) originals[type] = child;
    });
    Object.keys(originals).forEach(function (type) {
      originals[type].parentNode.removeChild(originals[type]);
    });
    waves.forEach(function (wave) { wave.parentNode.removeChild(wave); });
    var wave = waves[0] || null;
    var used = {};

    layout.sections.forEach(function (section, index) {
      if (!section || section.visible === false) return;
      var source = originals[section.type];
      var node;
      if (source) {
        node = used[section.type] ? source.cloneNode(true) : source;
        used[section.type] = true;
      } else if (section.type === "text" || section.type === "gallery") {
        node = blankNode(section);
      } else {
        return;
      }
      if (section.anchor) node.id = section.anchor;
      node.setAttribute("data-section-id", section.id || "");
      node.style.display = "";
      main.appendChild(node);
      if (wave && (section.type === "hero" || index === 0)) {
        main.appendChild(wave);
        wave = null;
      }
    });
    if (wave) main.appendChild(wave);
    applySectionMedia(layout);
    applyNav(layout);
    if (layout.logo) {
      document.querySelectorAll('[data-img="logo"]').forEach(function (el) {
        el.src = absUrl(layout.logo);
      });
    }
  }

  function patchRepeated(root, containerSel, itemSel, items, fill) {
    var container = root.querySelector(containerSel);
    if (!container || !Array.isArray(items)) return;
    var nodes = Array.prototype.slice.call(container.querySelectorAll(itemSel));
    if (!nodes.length) return;
    var template = nodes[0].cloneNode(true);
    nodes.slice(1).forEach(function (node) { container.removeChild(node); });
    items.forEach(function (item, i) {
      var node = i === 0 ? nodes[0] : template.cloneNode(true);
      node.style.display = "";
      fill(node, item, i);
      if (i > 0) container.appendChild(node);
    });
    if (!items.length) nodes[0].parentNode.removeChild(nodes[0]);
  }

  function setChildren(node, selector, value) {
    var el = node.querySelector(selector);
    if (el) el.textContent = value == null ? "" : value;
  }

  function applySectionFields(root, section) {
    var fields = section.fields || {};
    root.querySelectorAll("[data-field]").forEach(function (el) {
      var path = el.getAttribute("data-field").split(".");
      if (path[0] === "meta" || path[0] === "footer") return;
      var local = path.slice(1).join(".");
      var value = getPath(fields, local);
      if (value == null && path[0] === "offerBlock") value = fields[path[path.length - 1]];
      if (value == null && path[0] === "offer" && section.type === "hero") {
        if (local === "ctaCreate") value = fields.ctaPrimary;
        if (local === "ctaCartelas") value = fields.ctaSecondary;
      }
      if (value == null && path[0] === "offer" && local === "ctaHow") value = fields.cta;
      if (value == null && path[0] === "offer" && local === "ctaCreate") value = fields.cta;
      if (value == null && path[0] === "offer" && local === "ctaAcquire") value = fields.cta;
      if (value == null || typeof value === "object") return;
      setText(el, value);
    });
  }

  function applySectionContent(root, section) {
    var fields = section.fields || {};
    applySectionFields(root, section);

    if (section.type === "pains") {
      patchRepeated(root, ".pain-grid", ".pain-card", fields.items, function (node, item) {
        setChildren(node, ".pain-num", item.num);
        setChildren(node, "h3", item.title);
        setChildren(node, "p", item.text);
      });
      setChildren(root, ".note-sticker p", fields.note);
    }
    if (section.type === "how") {
      patchRepeated(root, ".steps", ".step", fields.steps, function (node, item) {
        setChildren(node, ".step-num", item.num);
        setChildren(node, "h3", item.title);
        setChildren(node, "p", item.text);
        setChildren(node, ".mock b", item.mockTitle);
        setChildren(node, ".mock span, .mock code", item.mockText);
      });
    }
    if (section.type === "receive") {
      patchRepeated(root, ".receive-grid", ".receive-card", fields.items, function (node, item) {
        setChildren(node, "b", item.num);
        setChildren(node, "h3", item.title);
        setChildren(node, "p", item.text);
      });
    }
    if (section.type === "audience") {
      patchRepeated(root, ".audience-grid", "article", fields.items, function (node, item) {
        setChildren(node, "h3", item.title);
        setChildren(node, "p", item.text);
      });
    }
    if (section.type === "possibilities") {
      patchRepeated(root, ".poss-mosaic", "article", fields.items, function (node, item, i) {
        setChildren(node, "p", item.text);
        var img = node.querySelector("img");
        var media = (section.images || [])[i];
        if (img && media && media.src) {
          img.src = absUrl(media.src);
          if (media.alt) img.alt = media.alt;
        }
      });
    }
    if (section.type === "identity") {
      patchRepeated(root, ".mosaic", "figure", fields.gallery, function (node, item, i) {
        setChildren(node, ".cap strong", item.title);
        setChildren(node, ".cap span", item.text);
        var img = node.querySelector("img");
        var media = (section.images || [])[i];
        if (img && media && media.src) {
          img.src = absUrl(media.src);
          if (media.alt) img.alt = media.alt;
        }
      });
      var pills = root.querySelectorAll(".kit-pill");
      (fields.pills || []).forEach(function (pill, i) {
        if (pills[i]) pills[i].textContent = pill;
      });
    }
    if (section.type === "compare") {
      [["bad", fields.bad], ["good", fields.good]].forEach(function (pair) {
        var list = root.querySelector(".compare-col." + pair[0] + " ul");
        if (!list || !Array.isArray(pair[1])) return;
        list.innerHTML = pair[1].map(function (item) {
          return "<li>" + (typeof item === "string" ? item : item.text || "") + "</li>";
        }).join("");
      });
    }
    if (section.type === "offer") {
      var list = root.querySelector(".offer-list");
      if (list && Array.isArray(fields.includes)) {
        list.innerHTML = fields.includes.map(function (item) {
          return "<li>" + (typeof item === "string" ? item : item.text || "") + "</li>";
        }).join("");
      }
    }
    if (section.type === "consultor") {
      var sugg = root.querySelector("[data-list='consultor.suggestions']");
      if (sugg && Array.isArray(fields.suggestions)) {
        sugg.innerHTML = fields.suggestions.map(function (item) {
          return "<li>" + (typeof item === "string" ? item : item.text || "") + "</li>";
        }).join("");
      }
    }
    if (section.type === "faq") {
      var faq = root.querySelector(".faq-list");
      var items = fields.items;
      if (faq && Array.isArray(items) && items.length) {
        var nodes = Array.prototype.slice.call(faq.querySelectorAll(".faq-item"));
        var template = nodes[0].cloneNode(true);
        nodes.slice(1).forEach(function (node) { faq.removeChild(node); });
        items.forEach(function (item, i) {
          var node = i === 0 ? nodes[0] : template.cloneNode(true);
          var btn = node.querySelector("button");
          var answer = node.querySelector(".answer");
          if (btn) {
            btn.textContent = item.q || "";
            btn.setAttribute("aria-expanded", "false");
          }
          if (answer) answer.textContent = item.a || "";
          node.classList.remove("is-open");
          if (i > 0) faq.appendChild(node);
        });
      }
    }

    var imgs = root.querySelectorAll("img:not(.tape):not(.float):not(.icon):not(.final-logo)");
    (section.images || []).forEach(function (image, i) {
      if (!image || !image.src || !imgs[i]) return;
      if (["possibilities", "identity"].indexOf(section.type) !== -1) return;
      imgs[i].src = absUrl(image.src);
      if (image.alt) imgs[i].alt = image.alt;
    });
  }

  function applySectionMedia(layout) {
    (layout.sections || []).forEach(function (section) {
      if (!section || section.visible === false) return;
      var root = document.querySelector('[data-section-id="' + (section.id || "") + '"]');
      if (!root) return;
      applySectionContent(root, section);
    });
  }

  function offerCta(layout) {
    var offer = (layout.sections || []).filter(function (s) {
      return s && s.type === "offer" && s.visible !== false;
    })[0];
    var fields = (offer && offer.fields) || {};
    return fields.ctaCreate || fields.ctaAcquire || "";
  }

  function applyNav(layout) {
    var nav = document.querySelector(".site-nav");
    if (!nav) return;
    var cta = nav.querySelector(".btn");
    var links = (layout.sections || []).filter(function (section) {
      return section && section.visible !== false && section.nav && section.anchor;
    });
    nav.innerHTML = "";
    links.forEach(function (section) {
      var a = document.createElement("a");
      a.href = "#" + section.anchor;
      a.textContent = section.nav;
      nav.appendChild(a);
    });
    if (cta) {
      var label = offerCta(layout);
      if (label) cta.textContent = label;
      nav.appendChild(cta);
    }
    var sticky = document.querySelector(".sticky-cta a");
    if (sticky) {
      var stickyLabel = offerCta(layout);
      if (stickyLabel) sticky.textContent = stickyLabel;
    }
  }

  function fillLists(content) {
    document.querySelectorAll("[data-list]").forEach(function (el) {
      var items = getPath(content, el.getAttribute("data-list"));
      if (!Array.isArray(items)) return;
      var attr = el.getAttribute("data-list-item") || "text";
      el.innerHTML = items
        .map(function (item) {
          var text = typeof item === "string" ? item : item[attr] || "";
          return "<li>" + text + "</li>";
        })
        .join("");
    });
  }

  function fillRepeating(root, attr, items, builder) {
    if (!Array.isArray(items) || !items.length) return;
    var nodes = Array.prototype.slice.call(root.querySelectorAll("[" + attr + "]"));
    if (!nodes.length) return;
    var parent = nodes[0].parentNode;
    var template = nodes[0].cloneNode(true);
    nodes.slice(1).forEach(function (node) { node.parentNode.removeChild(node); });
    items.forEach(function (item, i) {
      var node = i === 0 ? nodes[0] : template.cloneNode(true);
      builder(node, item, i);
      if (i > 0) parent.appendChild(node);
    });
  }

  function applyDynamicLists(content) {
    var pains = document.querySelector("#identificacao .pain-grid") || document.querySelector("[data-section-type='pains'] .pain-grid");
    if (pains && content.pains && content.pains.items) {
      fillRepeating(pains, "data-field", content.pains.items, function (node, item) {
        var num = node.querySelector('[data-field$=".num"]');
        var title = node.querySelector('[data-field$=".title"]');
        var text = node.querySelector('[data-field$=".text"]');
        if (num) num.textContent = item.num || "";
        if (title) title.textContent = item.title || "";
        if (text) text.textContent = item.text || "";
      });
    }
    var faq = document.querySelector("#duvidas .faq-list") || document.querySelector("[data-section-type='faq'] .faq-list");
    if (faq && content.faq && content.faq.items) {
      var items = content.faq.items;
      var nodes = Array.prototype.slice.call(faq.querySelectorAll(".faq-item"));
      if (nodes.length) {
        var template = nodes[0].cloneNode(true);
        nodes.slice(1).forEach(function (node) { node.parentNode.removeChild(node); });
        items.forEach(function (item, i) {
          var node = i === 0 ? nodes[0] : template.cloneNode(true);
          var q = node.querySelector("button");
          var a = node.querySelector(".answer");
          if (q) {
            q.textContent = item.q || "";
            q.setAttribute("aria-expanded", "false");
          }
          if (a) a.textContent = item.a || "";
          node.classList.remove("is-open");
          if (i > 0) faq.appendChild(node);
        });
      }
    }
  }

  function hydrate(content) {
    if (!content || content.ok === false) return;
    var hasLayout = !!(content._layout && (content._layout.sections || []).length);
    applyLayout(content);

    document.querySelectorAll("[data-field]").forEach(function (el) {
      var path = el.getAttribute("data-field");
      if (hasLayout && path.indexOf("meta.") !== 0 && path.indexOf("footer.") !== 0) return;
      setText(el, getPath(content, path));
    });

    if (!hasLayout) {
      document.querySelectorAll("[data-img]").forEach(function (el) {
        var key = el.getAttribute("data-img");
        var src = content.images && content.images[key];
        if (src) el.src = absUrl(src);
      });
    }

    if (content._layout && content._layout.logo) {
      document.querySelectorAll('[data-img="logo"]').forEach(function (el) {
        el.src = absUrl(content._layout.logo);
      });
    }
    if (content._layout) applySectionMedia(content._layout);

    var url = (content.offer && content.offer.checkoutUrl) || "";
    document.querySelectorAll("[data-checkout]").forEach(function (el) {
      el.setAttribute("data-checkout-url", url);
      if (url) el.setAttribute("href", url);
    });

    if (content.meta) {
      if (content.meta.title) document.title = content.meta.title;
      var desc = document.querySelector('meta[name="description"]');
      if (desc && content.meta.description) desc.setAttribute("content", content.meta.description);
    }

    if (!hasLayout) {
      fillLists(content);
      applyDynamicLists(content);
    }

    var page = content._page || {};
    showPreviewBanner(page);
    if (!page.preview) injectTracking(page.settings || {});
  }

  function finish() {
    window.__santArteReady = false;
    if (typeof window.initSantArte === "function") window.initSantArte();
  }

  if (window.__SANTARTE_CONTENT) {
    hydrate(window.__SANTARTE_CONTENT);
    finish();
    return;
  }

  fetch(contentUrl(), { cache: "no-store", credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("content");
      return res.json();
    })
    .then(hydrate)
    .catch(function () {})
    .finally(finish);
})();
