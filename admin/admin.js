(function () {
  const titles = {
    settings: "Página e rastreamento",
    sections: "Seções",
    media: "Imagens",
    account: "Conta"
  };

  const typeLabels = {
    hero: "Apresentação",
    pains: "Identificação",
    about: "Conheça",
    how: "Como funciona",
    identity: "Galeria",
    commands: "Demonstração",
    consultor: "Demonstração extra",
    receive: "Benefícios",
    possibilities: "Possibilidades",
    audience: "Para quem é",
    compare: "Comparativo",
    offer: "Oferta e preço",
    faq: "Perguntas frequentes",
    final: "Chamada final",
    text: "Texto",
    gallery: "Galeria livre"
  };

  const fieldLabels = {
    eyebrow: "Eyebrow",
    title: "Título",
    tagline: "Tagline",
    line1: "Linha 1",
    lede: "Texto principal",
    line2: "Linha 2",
    note: "Nota final",
    p1: "Parágrafo 1",
    p2: "Parágrafo 2",
    p3: "Parágrafo 3",
    p4: "Parágrafo 4",
    p5: "Parágrafo 5",
    stamp: "Selo",
    cta: "Botão",
    ctaPrimary: "Botão principal",
    ctaSecondary: "Botão secundário",
    ctaCreate: "Botão criar",
    ctaAcquire: "Botão adquirir",
    ctaCartelas: "Botão cartelas",
    ctaHow: "Botão como funciona",
    chatAsk: "Pergunta do chat",
    chatLabel: "Rótulo do chat",
    chatIntro: "Introdução das sugestões",
    brand: "Marca",
    includesLabel: "Rótulo do que inclui",
    priceLabel: "Rótulo do preço",
    price: "Preço (ex: 197,00)",
    checkoutUrl: "Link de checkout",
    badTitle: "Coluna sem estrutura",
    goodTitle: "Coluna com Sant'Arte",
    closing: "Fechamento",
    items: "Itens",
    steps: "Passos",
    gallery: "Galeria",
    includes: "Itens inclusos",
    suggestions: "Sugestões",
    pills: "Pílulas",
    bad: "Sem estrutura",
    good: "Com Sant'Arte",
    num: "Número",
    text: "Texto",
    q: "Pergunta",
    a: "Resposta",
    mockTitle: "Título do mock",
    mockText: "Texto do mock"
  };

  const statusLabel = {
    published: "Publicada",
    draft: "Rascunho",
    archived: "Arquivada"
  };

  const multilineKeys = {
    tagline: true, line1: true, lede: true, line2: true, note: true,
    p1: true, p2: true, p3: true, p4: true, p5: true, closing: true,
    chatAsk: true, chatIntro: true, text: true, q: true, a: true, mockText: true
  };

  let content = null;
  let layout = null;
  let currentPage = null;
  let pages = [];
  let openSectionId = "";

  const loginScreen = document.getElementById("loginScreen");
  const pagesView = document.getElementById("pagesView");
  const app = document.getElementById("app");
  const panels = document.getElementById("panels");
  const toast = document.getElementById("toast");
  const loginError = document.getElementById("loginError");
  const pagesList = document.getElementById("pagesList");
  const newPageModal = document.getElementById("newPageModal");
  const addSectionModal = document.getElementById("addSectionModal");

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("is-on");
    setTimeout(function () { toast.classList.remove("is-on"); }, 2400);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Math.random().toString(16).slice(2, 8);
  }

  function absUrl(src) {
    if (!src) return "";
    if (/^https?:\/\//i.test(src) || src.charAt(0) === "/") return src;
    return "/" + String(src).replace(/^\.\//, "");
  }

  function hideAll() {
    loginScreen.style.display = "none";
    pagesView.classList.remove("is-on");
    app.classList.remove("is-on");
  }

  function api(url, opts) {
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data };
      }).catch(function () {
        return { res: res, data: {} };
      });
    });
  }

  function ensureLayout() {
    if (!layout || typeof layout !== "object") layout = {};
    if (!Array.isArray(layout.sections)) layout.sections = [];
    if (!Array.isArray(layout.media)) layout.media = [];
    if (!layout.meta) layout.meta = { title: "", description: "" };
    if (!layout.footer) layout.footer = { tagline: "", copy: "" };
    if (!layout.logo) layout.logo = (content && content.images && content.images.logo) || "assets/logo.svg";
  }

  function renderPages() {
    if (!pages.length) {
      pagesList.innerHTML = '<div class="page-card"><h3>Nenhuma página ainda</h3><p>Crie a primeira página de vendas.</p></div>';
      return;
    }
    pagesList.innerHTML = pages.map(function (page) {
      const status = page.status || "draft";
      return '<article class="page-card" data-id="' + page.id + '">' +
        '<div class="meta-row"><span class="badge ' + status + '">' + (statusLabel[status] || status) + "</span><span>" + (page.price ? "R$ " + page.price : "sem preço") + "</span></div>" +
        "<h3>" + esc(page.name || page.slug) + "</h3>" +
        '<div class="path">/' + esc(page.slug) + "</div>" +
        '<div class="card-actions">' +
        '<button class="btn small" data-act="edit" type="button">Editar</button>' +
        '<button class="btn small btn-ghost" data-act="preview" type="button">Prévia</button>' +
        '<button class="btn small btn-ghost" data-act="duplicate" type="button">Duplicar</button>' +
        (status === "published"
          ? '<button class="btn small btn-ghost" data-act="unpublish" type="button">Desativar</button>'
          : '<button class="btn small btn-sage" data-act="publish" type="button">Publicar</button>') +
        (status === "archived"
          ? '<button class="btn small danger" data-act="delete" type="button">Excluir</button>'
          : '<button class="btn small btn-ghost" data-act="archive" type="button">Arquivar</button>') +
        "</div></article>";
    }).join("");
    pagesList.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.closest("[data-id]").getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (act === "edit") openEditor(id);
        if (act === "preview") window.open("/preview/" + id, "_blank");
        if (act === "duplicate") duplicatePage(id);
        if (act === "publish") setStatus(id, "published");
        if (act === "unpublish") setStatus(id, "draft");
        if (act === "archive") setStatus(id, "archived");
        if (act === "delete") deletePage(id);
      });
    });
  }

  function loadPages() {
    return api("/api/pages").then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Falha ao listar páginas");
      pages = out.data.pages || [];
      renderPages();
    });
  }

  function showPages() {
    hideAll();
    pagesView.classList.add("is-on");
    history.replaceState(null, "", "/admin");
    loadPages().catch(function (err) { showToast(err.message); });
  }

  function itemKeys(sample) {
    if (sample == null || typeof sample !== "object") return null;
    return Object.keys(sample).filter(function (k) { return k !== "key"; });
  }

  function fieldInput(label, value, path, multi) {
    const safe = esc(value);
    if (multi) {
      return '<div class="field"><label>' + esc(label) + '</label><textarea data-lpath="' + esc(path) + '">' + safe + "</textarea></div>";
    }
    return '<div class="field"><label>' + esc(label) + '</label><input data-lpath="' + esc(path) + '" value="' + safe + '"></div>';
  }

  function renderValue(value, path, label) {
    if (Array.isArray(value)) {
      const first = value[0];
      const keys = itemKeys(first);
      const title = fieldLabels[label] || label;
      let html = '<div class="list-block" data-list-path="' + esc(path) + '"><div class="list-head"><h3>' + esc(title) + "</h3>" +
        '<button class="btn small btn-ghost" type="button" data-add-item="' + esc(path) + '">Adicionar</button></div>';
      value.forEach(function (item, i) {
        html += '<div class="card inner-card"><div class="list-head"><h3>' + esc(title) + " " + (i + 1) + "</h3>" +
          '<button class="btn small btn-ghost" type="button" data-del-item="' + esc(path) + '" data-index="' + i + '">Remover</button></div>';
        if (keys) {
          keys.forEach(function (k) {
            html += fieldInput(fieldLabels[k] || k, item[k], path + "." + i + "." + k, !!multilineKeys[k]);
          });
        } else {
          html += fieldInput("Texto", item, path + "." + i, true);
        }
        html += "</div>";
      });
      return html + "</div>";
    }
    return fieldInput(fieldLabels[label] || label, value, path, !!multilineKeys[label] || String(value || "").length > 80);
  }

  function renderSectionFields(section, index) {
    const fields = section.fields || {};
    const preferred = [
      "eyebrow", "title", "tagline", "line1", "lede", "line2",
      "p1", "p2", "p3", "p4", "p5", "note", "closing", "stamp",
      "ctaPrimary", "ctaSecondary", "cta", "brand", "chatAsk", "chatLabel", "chatIntro",
      "includesLabel", "priceLabel", "price", "checkoutUrl", "ctaAcquire", "ctaCreate", "ctaCartelas", "ctaHow",
      "badTitle", "goodTitle", "pills", "items", "steps", "gallery", "includes", "suggestions", "bad", "good"
    ];
    const keys = Object.keys(fields);
    const ordered = preferred.filter(function (k) { return keys.indexOf(k) !== -1; })
      .concat(keys.filter(function (k) { return preferred.indexOf(k) === -1; }));
    return ordered.map(function (key) {
      return renderValue(fields[key], "sections." + index + ".fields." + key, key);
    }).join("");
  }

  function renderSectionImages(section, index) {
    const images = section.images || [];
    let html = '<div class="sec-media"><div class="list-head"><h3>Imagens desta seção</h3>' +
      '<button class="btn small btn-ghost" type="button" data-add-image="' + index + '">Adicionar imagem</button></div>';
    if (!images.length) {
      html += '<p class="hint">Nenhuma imagem nesta seção. Envie uma imagem genérica.</p>';
    }
    html += '<div class="thumbs">';
    images.forEach(function (img, i) {
      html += '<div class="thumb"><img src="' + esc(absUrl(img.src)) + '" alt="">' +
        '<div class="meta"><input placeholder="Legenda" data-lpath="sections.' + index + ".images." + i + '.caption" value="' + esc(img.caption || img.alt || "") + '">' +
        '<input type="file" accept="image/*" data-sec-upload="' + index + '" data-img-index="' + i + '">' +
        '<button class="btn small btn-ghost" type="button" data-del-image="' + index + '" data-img-index="' + i + '">Remover</button></div></div>';
    });
    return html + "</div></div>";
  }

  function renderSections() {
    ensureLayout();
    const list = document.getElementById("sectionList");
    if (!list) return;
    if (!layout.sections.length) {
      list.innerHTML = '<p class="hint">Nenhuma seção nesta página.</p>';
      return;
    }
    list.innerHTML = layout.sections.map(function (section, index) {
      const open = section.id === openSectionId;
      const hidden = section.visible === false;
      return '<article class="section-card' + (hidden ? " is-hidden" : "") + (open ? " is-open" : "") + '" data-sec="' + esc(section.id) + '">' +
        '<div class="sec-head">' +
        '<div><span class="badge">' + esc(typeLabels[section.type] || section.type) + "</span>" +
        (hidden ? '<span class="badge draft">Oculta</span>' : "") +
        "<h3>" + esc(section.title || typeLabels[section.type] || "Seção") + "</h3></div>" +
        '<div class="sec-actions">' +
        '<button class="btn small btn-ghost" type="button" data-move="-1" data-index="' + index + '">Subir</button>' +
        '<button class="btn small btn-ghost" type="button" data-move="1" data-index="' + index + '">Descer</button>' +
        '<button class="btn small btn-ghost" type="button" data-toggle-vis="' + index + '">' + (hidden ? "Mostrar" : "Ocultar") + "</button>" +
        '<button class="btn small" type="button" data-edit-sec="' + esc(section.id) + '">' + (open ? "Fechar" : "Editar") + "</button>" +
        "</div></div>" +
        (open ? '<div class="sec-body">' +
          fieldInput("Título interno", section.title || "", "sections." + index + ".title", false) +
          fieldInput("Âncora", section.anchor || "", "sections." + index + ".anchor", false) +
          fieldInput("Item do menu (vazio = não aparece)", section.nav || "", "sections." + index + ".nav", false) +
          renderSectionFields(section, index) +
          renderSectionImages(section, index) +
          '<div class="sec-actions end">' +
          '<button class="btn small btn-ghost" type="button" data-dup-sec="' + index + '">Duplicar seção</button>' +
          '<button class="btn small danger" type="button" data-del-sec="' + index + '">Excluir seção</button>' +
          "</div></div>" : "") +
        "</article>";
    }).join("");
    bindSectionList(list);
  }

  function getAt(obj, path) {
    return path.split(".").reduce(function (acc, key) {
      if (acc == null) return acc;
      return /^\d+$/.test(key) ? acc[Number(key)] : acc[key];
    }, obj);
  }

  function setAt(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
      if (cur[k] == null) cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      cur = cur[k];
    }
    const last = /^\d+$/.test(keys[keys.length - 1]) ? Number(keys[keys.length - 1]) : keys[keys.length - 1];
    cur[last] = value;
  }

  function blankItem(sample) {
    if (sample == null) return "";
    if (typeof sample !== "object") return "";
    const out = {};
    Object.keys(sample).forEach(function (k) { out[k] = ""; });
    return out;
  }

  function bindSectionList(list) {
    list.querySelectorAll("[data-lpath]").forEach(function (el) {
      el.addEventListener("input", function () {
        const path = el.getAttribute("data-lpath");
        setAt(layout, path, el.value);
        if (path.indexOf(".images.") !== -1 && path.slice(-8) === "caption") {
          const imgPath = path.replace(/\.caption$/, "");
          const img = getAt(layout, imgPath);
          if (img && typeof img === "object") img.alt = el.value;
        }
      });
    });
    list.querySelectorAll("[data-edit-sec]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-edit-sec");
        openSectionId = openSectionId === id ? "" : id;
        renderSections();
      });
    });
    list.querySelectorAll("[data-move]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-index"));
        const dir = Number(btn.getAttribute("data-move"));
        const next = index + dir;
        if (next < 0 || next >= layout.sections.length) return;
        const tmp = layout.sections[index];
        layout.sections[index] = layout.sections[next];
        layout.sections[next] = tmp;
        renderSections();
      });
    });
    list.querySelectorAll("[data-toggle-vis]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-toggle-vis"));
        layout.sections[index].visible = layout.sections[index].visible === false;
        renderSections();
      });
    });
    list.querySelectorAll("[data-dup-sec]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-dup-sec"));
        const copy = JSON.parse(JSON.stringify(layout.sections[index]));
        copy.id = uid("sec_" + (copy.type || "block"));
        copy.title = (copy.title || typeLabels[copy.type] || "Seção") + " (cópia)";
        if (copy.anchor) copy.anchor = slugify(copy.anchor + "-copia") || copy.id;
        layout.sections.splice(index + 1, 0, copy);
        openSectionId = copy.id;
        renderSections();
      });
    });
    list.querySelectorAll("[data-del-sec]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-del-sec"));
        if (!window.confirm("Excluir esta seção desta página?")) return;
        layout.sections.splice(index, 1);
        openSectionId = "";
        renderSections();
      });
    });
    list.querySelectorAll("[data-add-item]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const path = btn.getAttribute("data-add-item");
        const arr = getAt(layout, path);
        if (!Array.isArray(arr)) return;
        arr.push(blankItem(arr[0]));
        renderSections();
      });
    });
    list.querySelectorAll("[data-del-item]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const path = btn.getAttribute("data-del-item");
        const index = Number(btn.getAttribute("data-index"));
        const arr = getAt(layout, path);
        if (!Array.isArray(arr)) return;
        arr.splice(index, 1);
        renderSections();
      });
    });
    list.querySelectorAll("[data-add-image]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-add-image"));
        layout.sections[index].images = layout.sections[index].images || [];
        layout.sections[index].images.push({ id: uid("img"), src: "", alt: "", caption: "" });
        renderSections();
      });
    });
    list.querySelectorAll("[data-del-image]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const index = Number(btn.getAttribute("data-del-image"));
        const imgIndex = Number(btn.getAttribute("data-img-index"));
        (layout.sections[index].images || []).splice(imgIndex, 1);
        renderSections();
      });
    });
    list.querySelectorAll("[data-sec-upload]").forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.files || !input.files[0]) return;
        const index = Number(input.getAttribute("data-sec-upload"));
        const imgIndex = Number(input.getAttribute("data-img-index"));
        uploadFile(input.files[0], "").then(function (media) {
          layout.sections[index].images = layout.sections[index].images || [];
          layout.sections[index].images[imgIndex] = layout.sections[index].images[imgIndex] || { id: uid("img"), src: "", alt: "", caption: "" };
          layout.sections[index].images[imgIndex].src = media.path;
          renderSections();
          renderMedia();
          showToast("Imagem enviada nesta página");
        }).catch(function (err) { showToast(err.message); });
      });
    });
  }

  function renderMedia() {
    ensureLayout();
    const grid = document.getElementById("mediaGrid");
    const logo = document.getElementById("logoPreview");
    if (logo) logo.src = absUrl(layout.logo || "");
    if (!grid) return;
    const items = layout.media || [];
    if (!items.length) {
      grid.innerHTML = '<p class="hint">Nenhuma imagem enviada nesta página.</p>';
      return;
    }
    grid.innerHTML = items.map(function (item, i) {
      return '<div class="thumb"><img src="' + esc(absUrl(item.src)) + '" alt="">' +
        '<div class="meta"><b>' + esc(item.name || "Imagem") + "</b>" +
        '<button class="btn small btn-ghost" type="button" data-use-logo="' + i + '">Usar como logo</button></div></div>';
    }).join("");
    grid.querySelectorAll("[data-use-logo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = layout.media[Number(btn.getAttribute("data-use-logo"))];
        if (item) {
          layout.logo = item.src;
          renderMedia();
          showToast("Logo atualizado nesta página");
        }
      });
    });
  }

  function render() {
    const settings = (currentPage && currentPage.settings) || {};
    panels.innerHTML =
      '<div class="panel" data-panel="settings">' +
        '<div class="status-row">' +
        '<span class="badge ' + (currentPage.status || "draft") + '">' + (statusLabel[currentPage.status] || currentPage.status) + "</span>" +
        '<button class="btn small btn-sage" type="button" id="publishNow">Publicar</button>' +
        '<button class="btn small btn-ghost" type="button" id="draftNow">Salvar como rascunho</button>' +
        "</div>" +
        '<div class="field"><label>Nome interno</label><input id="pageName"></div>' +
        '<div class="field"><label>Endereço (slug)</label><input id="pageSlug"><small>santarte.com.br/<span id="liveSlug">' + esc(currentPage.slug || "") + "</span></small></div>" +
        '<div class="field"><label>Nome do produto</label><input id="productName"></div>' +
        '<div class="field"><label>Título da aba</label><input id="metaTitle"></div>' +
        '<div class="field"><label>Descrição SEO</label><textarea id="metaDescription"></textarea></div>' +
        '<div class="field"><label>Rodapé</label><textarea id="footerTagline"></textarea></div>' +
        '<div class="field"><label>Copyright</label><input id="footerCopy"></div>' +
        '<div class="field"><label>Meta Pixel ID</label><input id="metaPixelId"></div>' +
        '<div class="field"><label>Google Analytics ID</label><input id="googleAnalyticsId"></div>' +
        '<div class="field"><label>Google Tag Manager ID</label><input id="googleTagManagerId"></div>' +
        '<div class="field"><label>Evento de conversão</label><input id="conversionEvent"></div>' +
      "</div>" +
      '<div class="panel is-on" data-panel="sections">' +
        '<div class="list-head"><p class="hint">Edite, oculte, duplique ou reordene. O visual da landing permanece o mesmo.</p>' +
        '<button class="btn small" type="button" id="addSectionBtn">Adicionar seção</button></div>' +
        '<div id="sectionList"></div>' +
      "</div>" +
      '<div class="panel" data-panel="media">' +
        '<div class="field"><label>Logo desta página</label><img id="logoPreview" class="logo-preview" alt="Logo"></div>' +
        '<div class="field"><label>Enviar imagem</label><input id="mediaUpload" type="file" accept="image/*"></div>' +
        '<div class="thumbs" id="mediaGrid"></div>' +
      "</div>" +
      '<div class="panel" data-panel="account"><form id="passForm">' +
        '<div class="field"><label>Senha atual</label><input type="password" id="currentPassword" required></div>' +
        '<div class="field"><label>Nova senha</label><input type="password" id="newPassword" minlength="8" required></div>' +
        '<button class="btn btn-sage" type="submit">Trocar senha</button></form></div>';

    const nameEl = document.getElementById("pageName");
    const slugEl = document.getElementById("pageSlug");
    const productEl = document.getElementById("productName");
    if (nameEl) nameEl.value = currentPage.name || "";
    if (slugEl) slugEl.value = currentPage.slug || "";
    if (productEl) productEl.value = settings.productName || "";
    const metaTitle = document.getElementById("metaTitle");
    const metaDescription = document.getElementById("metaDescription");
    const footerTagline = document.getElementById("footerTagline");
    const footerCopy = document.getElementById("footerCopy");
    if (metaTitle) metaTitle.value = (layout.meta && layout.meta.title) || "";
    if (metaDescription) metaDescription.value = (layout.meta && layout.meta.description) || "";
    if (footerTagline) footerTagline.value = (layout.footer && layout.footer.tagline) || "";
    if (footerCopy) footerCopy.value = (layout.footer && layout.footer.copy) || "";
    ["metaPixelId", "googleAnalyticsId", "googleTagManagerId", "conversionEvent"].forEach(function (key) {
      const el = document.getElementById(key);
      if (el) el.value = settings[key] || "";
    });
    if (slugEl) {
      slugEl.addEventListener("input", function () {
        document.getElementById("liveSlug").textContent = slugify(slugEl.value) || currentPage.slug;
      });
    }
    document.getElementById("publishNow").addEventListener("click", function () {
      setStatus(currentPage.id, "published").then(function () { currentPage.status = "published"; render(); showPanel("settings"); });
    });
    document.getElementById("draftNow").addEventListener("click", function () {
      setStatus(currentPage.id, "draft").then(function () { currentPage.status = "draft"; render(); showPanel("settings"); });
    });
    document.getElementById("addSectionBtn").addEventListener("click", openAddSection);
    const mediaUpload = document.getElementById("mediaUpload");
    if (mediaUpload) {
      mediaUpload.addEventListener("change", function () {
        if (!mediaUpload.files || !mediaUpload.files[0]) return;
        uploadFile(mediaUpload.files[0], "").then(function () {
          mediaUpload.value = "";
          renderMedia();
          showToast("Imagem enviada nesta página");
        }).catch(function (err) { showToast(err.message); });
      });
    }
    renderSections();
    renderMedia();
    bindAccount();
    updateChrome();
  }

  function collectMeta() {
    layout.meta = {
      title: (document.getElementById("metaTitle") || {}).value || "",
      description: (document.getElementById("metaDescription") || {}).value || ""
    };
    layout.footer = {
      tagline: (document.getElementById("footerTagline") || {}).value || "",
      copy: (document.getElementById("footerCopy") || {}).value || ""
    };
  }

  function updateChrome() {
    const crumb = document.getElementById("pageCrumb");
    const view = document.getElementById("viewPageBtn");
    if (crumb) crumb.textContent = (currentPage.name || currentPage.slug) + " · /" + currentPage.slug;
    if (view) {
      view.href = currentPage.status === "published" ? "/" + currentPage.slug : "/preview/" + currentPage.id;
      view.textContent = currentPage.status === "published" ? "Ver página" : "Prévia";
    }
  }

  function bindAccount() {
    const form = document.getElementById("passForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      api("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: document.getElementById("currentPassword").value,
          newPassword: document.getElementById("newPassword").value
        })
      }).then(function (out) {
        if (!out.res.ok) throw new Error(out.data.error || "Erro");
        showToast("Senha atualizada");
        form.reset();
      }).catch(function (err) { showToast(err.message); });
    });
  }

  function uploadFile(file, key) {
    const body = new FormData();
    body.append("file", file);
    if (key) body.append("key", key);
    body.append("pageId", currentPage.id);
    return fetch("/api/upload", { method: "POST", body: body })
      .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
      .then(function (out) {
        if (!out.res.ok) throw new Error(out.data.error || "Falha no envio");
        ensureLayout();
        if (out.data.media) layout.media.push(out.data.media);
        else layout.media.push({ id: uid("media"), src: out.data.path, name: file.name });
        return out.data;
      });
  }

  function showPanel(name) {
    document.querySelectorAll(".panel").forEach(function (el) {
      el.classList.toggle("is-on", el.getAttribute("data-panel") === name);
    });
    document.querySelectorAll(".side a[data-panel]").forEach(function (el) {
      el.classList.toggle("is-on", el.getAttribute("data-panel") === name);
    });
    document.getElementById("panelTitle").textContent = titles[name] || name;
  }

  function collectSettings() {
    const offer = (layout.sections || []).find(function (s) { return s.type === "offer"; });
    const checkout = offer && offer.fields ? (offer.fields.checkoutUrl || "") : ((content.offer && content.offer.checkoutUrl) || "");
    return {
      productName: (document.getElementById("productName") || {}).value || "",
      checkoutUrl: checkout,
      metaPixelId: (document.getElementById("metaPixelId") || {}).value || "",
      googleAnalyticsId: (document.getElementById("googleAnalyticsId") || {}).value || "",
      googleTagManagerId: (document.getElementById("googleTagManagerId") || {}).value || "",
      conversionEvent: (document.getElementById("conversionEvent") || {}).value || "Purchase"
    };
  }

  function openEditor(pageId) {
    api("/api/pages/" + pageId).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Página não encontrada");
      currentPage = out.data.page;
      content = currentPage.content || {};
      layout = currentPage.layout || null;
      ensureLayout();
      openSectionId = "";
      hideAll();
      app.classList.add("is-on");
      render();
      const hash = (location.hash || "#sections").slice(1);
      showPanel(titles[hash] ? hash : "sections");
    }).catch(function (err) { showToast(err.message); });
  }

  function setStatus(id, status) {
    return api("/api/pages/" + id + "/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status })
    }).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Não foi possível alterar o status");
      showToast(statusLabel[status] || "Atualizado");
      return loadPages();
    }).catch(function (err) { showToast(err.message); });
  }

  function duplicatePage(id) {
    api("/api/pages/" + id + "/duplicate", { method: "POST" }).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Falha ao duplicar");
      showToast("Cópia criada como rascunho");
      return loadPages();
    }).catch(function (err) { showToast(err.message); });
  }

  function deletePage(id) {
    if (!window.confirm("Excluir esta página arquivada? O conteúdo deixa de aparecer no painel.")) return;
    api("/api/pages/" + id, { method: "DELETE" }).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Não foi possível excluir");
      showToast("Página excluída");
      return loadPages();
    }).catch(function (err) { showToast(err.message); });
  }

  function openApp() {
    loginScreen.style.display = "none";
    showPages();
  }

  function defaultFields(type, source) {
    if (source && source.fields) return JSON.parse(JSON.stringify(source.fields));
    if (type === "text") return { title: "", lede: "" };
    if (type === "gallery") return { title: "", lede: "" };
    return { title: "" };
  }

  function openAddSection() {
    const select = document.getElementById("newSectionType");
    select.innerHTML = Object.keys(typeLabels).map(function (type) {
      return '<option value="' + type + '">' + esc(typeLabels[type]) + "</option>";
    }).join("");
    addSectionModal.classList.add("is-on");
    addSectionModal.hidden = false;
  }

  function closeAddSection() {
    addSectionModal.classList.remove("is-on");
    addSectionModal.hidden = true;
  }

  document.getElementById("cancelAddSection").addEventListener("click", closeAddSection);
  addSectionModal.addEventListener("click", function (event) {
    if (event.target === addSectionModal) closeAddSection();
  });
  document.getElementById("confirmAddSection").addEventListener("click", function () {
    const type = document.getElementById("newSectionType").value;
    const source = (layout.sections || []).find(function (s) { return s.type === type; });
    const section = {
      id: uid("sec_" + type),
      type: type,
      anchor: slugify(typeLabels[type] || type),
      title: typeLabels[type] || type,
      visible: true,
      nav: "",
      style: { theme: "", align: "" },
      fields: defaultFields(type, source),
      images: source && source.images ? JSON.parse(JSON.stringify(source.images)) : []
    };
    layout.sections.push(section);
    openSectionId = section.id;
    closeAddSection();
    renderSections();
    showPanel("sections");
  });

  document.getElementById("loginForm").addEventListener("submit", function (event) {
    event.preventDefault();
    loginError.textContent = "";
    api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    }).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Falha no login");
      openApp();
    }).catch(function (err) { loginError.textContent = err.message; });
  });

  function logout() {
    fetch("/api/logout", { method: "POST" }).finally(function () { location.reload(); });
  }
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("logoutHomeBtn").addEventListener("click", logout);
  document.getElementById("backPagesBtn").addEventListener("click", showPages);

  document.getElementById("saveBtn").addEventListener("click", function () {
    if (!currentPage) return;
    collectMeta();
    const nameEl = document.getElementById("pageName");
    const slugEl = document.getElementById("pageSlug");
    api("/api/pages/" + currentPage.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _pageId: currentPage.id,
        name: nameEl ? nameEl.value : currentPage.name,
        slug: slugEl ? slugEl.value : currentPage.slug,
        settings: collectSettings(),
        layout: layout
      })
    }).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Erro ao salvar");
      currentPage.name = nameEl ? nameEl.value : currentPage.name;
      currentPage.slug = out.data.page.slug;
      currentPage.settings = collectSettings();
      updateChrome();
      showToast("Alterações salvas nesta página");
    }).catch(function (err) { showToast(err.message); });
  });

  document.querySelectorAll(".side a[data-panel]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      showPanel(link.getAttribute("data-panel"));
      history.replaceState(null, "", "#" + link.getAttribute("data-panel"));
    });
  });

  function openNewPageModal() {
    if (!newPageModal) {
      showToast("Não foi possível abrir o formulário");
      return;
    }
    newPageModal.hidden = false;
    newPageModal.classList.add("is-on");
    document.getElementById("newName").value = "";
    document.getElementById("newSlug").value = "";
    document.getElementById("newPageError").textContent = "";
    document.getElementById("slugPreview").textContent = "nova-pagina";
    document.getElementById("newName").focus();
  }

  function closeNewPageModal() {
    if (!newPageModal) return;
    newPageModal.classList.remove("is-on");
    newPageModal.hidden = true;
  }

  document.getElementById("newPageBtn").addEventListener("click", openNewPageModal);
  document.getElementById("cancelNewPage").addEventListener("click", closeNewPageModal);
  newPageModal.addEventListener("click", function (event) {
    if (event.target === newPageModal) closeNewPageModal();
  });
  document.getElementById("newName").addEventListener("input", function () {
    const slug = slugify(document.getElementById("newSlug").value || document.getElementById("newName").value) || "nova-pagina";
    document.getElementById("slugPreview").textContent = slug;
  });
  document.getElementById("newSlug").addEventListener("input", function () {
    document.getElementById("slugPreview").textContent = slugify(this.value) || "nova-pagina";
  });
  document.getElementById("newPageForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const name = document.getElementById("newName").value.trim();
    const slug = document.getElementById("newSlug").value.trim();
    api("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, slug: slug, productName: name })
    }).then(function (out) {
      if (!out.res.ok) throw new Error(out.data.error || "Não foi possível criar");
      closeNewPageModal();
      showToast("Rascunho criado");
      return loadPages().then(function () { openEditor(out.data.page.id); });
    }).catch(function (err) { document.getElementById("newPageError").textContent = err.message; });
  });

  fetch("/api/session").then(function (res) {
    if (res.ok) openApp();
  });
})();
