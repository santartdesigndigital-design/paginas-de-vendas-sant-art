#!/usr/bin/env python3
import copy
import json
import re
import secrets
import shutil
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, make_response, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
PAGES_DIR = DATA / "pages"
UPLOADS = ROOT / "assets" / "img" / "uploads"
CONTENT_FILE = DATA / "content.json"
STORE_FILE = DATA / "store.json"
AUTH_FILE = DATA / "auth.json"
SECRET_FILE = DATA / "secret.txt"
BACKUP_DIR = DATA / "backups"

DATA.mkdir(exist_ok=True)
PAGES_DIR.mkdir(exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
MAX_BYTES = 8 * 1024 * 1024
RESERVED_SLUGS = {
    "admin",
    "api",
    "assets",
    "css",
    "js",
    "data",
    "static",
    "preview",
    "uploads",
    "favicon.ico",
    "robots.txt",
}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CONTENT_SKIP = {"_page", "_pageId", "_layout"}
SECTION_TYPES = (
    "hero",
    "pains",
    "about",
    "how",
    "identity",
    "commands",
    "consultor",
    "receive",
    "possibilities",
    "audience",
    "compare",
    "offer",
    "faq",
    "final",
    "text",
    "gallery",
)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_secret():
    if SECRET_FILE.exists():
        return SECRET_FILE.read_text(encoding="utf-8").strip()
    value = secrets.token_hex(32)
    SECRET_FILE.write_text(value, encoding="utf-8")
    SECRET_FILE.chmod(0o600)
    return value


def default_auth():
    return {
        "username": "admin",
        "password_hash": generate_password_hash("SantArte#2026"),
    }


def load_auth():
    if AUTH_FILE.exists():
        return json.loads(AUTH_FILE.read_text(encoding="utf-8"))
    auth = default_auth()
    AUTH_FILE.write_text(json.dumps(auth, indent=2), encoding="utf-8")
    AUTH_FILE.chmod(0o600)
    return auth


def save_auth(auth):
    AUTH_FILE.write_text(json.dumps(auth, indent=2), encoding="utf-8")
    AUTH_FILE.chmod(0o600)


def write_json(path, data):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def default_settings():
    return {
        "productName": "Sant'Arte",
        "checkoutUrl": "",
        "metaPixelId": "",
        "googleAnalyticsId": "",
        "googleTagManagerId": "",
        "conversionEvent": "Purchase",
    }


def extract_content(raw):
    if not isinstance(raw, dict):
        return {}
    content = {}
    for key, value in raw.items():
        if key in CONTENT_SKIP:
            continue
        content[key] = copy.deepcopy(value)
    return content


def img_src(content, key, fallback=""):
    images = (content or {}).get("images") or {}
    return images.get(key) or fallback


def slot(src, alt="", caption=""):
    return {"id": str(uuid4())[:8], "src": src or "", "alt": alt or "", "caption": caption or ""}


def section_block(stype, anchor, title, fields, images=None, visible=True, nav=None):
    return {
        "id": "sec_" + stype + "_" + secrets.token_hex(3),
        "type": stype,
        "anchor": anchor,
        "title": title,
        "visible": visible,
        "nav": nav,
        "style": {"theme": "", "align": ""},
        "fields": fields or {},
        "images": images or [],
    }


def build_layout_from_content(content):
    c = content or {}
    hero = c.get("hero") or {}
    offer = c.get("offer") or {}
    offer_block = c.get("offerBlock") or {}
    pains = c.get("pains") or {}
    about = c.get("about") or {}
    how = c.get("how") or {}
    identity = c.get("identity") or {}
    commands = c.get("commands") or {}
    consultor = c.get("consultor") or {}
    receive = c.get("receive") or {}
    possibilities = c.get("possibilities") or {}
    audience = c.get("audience") or {}
    compare = c.get("compare") or {}
    faq = c.get("faq") or {}
    final = c.get("final") or {}
    footer = c.get("footer") or {}
    meta = c.get("meta") or {}
    polaroids = c.get("polaroids") or []
    hero_images = []
    for item in polaroids:
        key = item.get("key") if isinstance(item, dict) else ""
        hero_images.append(slot(img_src(c, key), item.get("label") if isinstance(item, dict) else "", item.get("label") if isinstance(item, dict) else ""))
    if not hero_images:
        for key in ("crest", "monogram", "party", "palette", "stationery"):
            hero_images.append(slot(img_src(c, key), key, key))
    identity_images = []
    for item in identity.get("gallery") or []:
        key = item.get("key") or ""
        identity_images.append(slot(img_src(c, key), item.get("title") or "", item.get("text") or ""))
    poss_images = []
    for item in possibilities.get("items") or []:
        key = item.get("key") or ""
        poss_images.append(slot(img_src(c, key), item.get("text") or "", item.get("text") or ""))
    how_images = []
    for item, key in zip(how.get("steps") or [], ("board", "palette", "party")):
        how_images.append(slot(img_src(c, key), item.get("title") or "", item.get("text") or ""))
    sections = [
        section_block("hero", "apresentacao", "Apresentação", {
            "eyebrow": hero.get("eyebrow") or "",
            "title": hero.get("title") or "",
            "tagline": hero.get("tagline") or "",
            "line1": hero.get("line1") or "",
            "lede": hero.get("lede") or "",
            "line2": hero.get("line2") or "",
            "ctaPrimary": offer.get("ctaCreate") or "",
            "ctaSecondary": offer.get("ctaCartelas") or "",
        }, hero_images, nav="Início"),
        section_block("pains", "identificacao", "Identificação", {
            "eyebrow": pains.get("eyebrow") or "",
            "title": pains.get("title") or "",
            "note": pains.get("note") or "",
            "items": copy.deepcopy(pains.get("items") or []),
        }),
        section_block("about", "conheca", "Conheça", {
            "eyebrow": about.get("eyebrow") or "",
            "title": about.get("title") or "",
            "p1": about.get("p1") or "",
            "p2": about.get("p2") or "",
            "p3": about.get("p3") or "",
            "p4": about.get("p4") or "",
            "cta": offer.get("ctaHow") or "",
        }, [
            slot(img_src(c, "crest"), "Imagem 1"),
            slot(img_src(c, "banner"), "Imagem 2"),
            slot(img_src(c, "cookies"), "Imagem 3"),
        ], nav="O produto"),
        section_block("how", "como-funciona", "Como funciona", {
            "eyebrow": how.get("eyebrow") or "",
            "title": how.get("title") or "",
            "tagline": how.get("tagline") or "",
            "p1": how.get("p1") or "",
            "p2": how.get("p2") or "",
            "steps": copy.deepcopy(how.get("steps") or []),
        }, how_images, nav="Como funciona"),
        section_block("identity", "identidade", "Galeria", {
            "eyebrow": identity.get("eyebrow") or "",
            "title": identity.get("title") or "",
            "lede": identity.get("lede") or "",
            "closing": identity.get("closing") or "",
            "pills": copy.deepcopy(identity.get("pills") or []),
            "gallery": copy.deepcopy(identity.get("gallery") or []),
            "cta": offer.get("ctaCreate") or "",
        }, identity_images, nav="Galeria"),
        section_block("commands", "imagens", "Demonstração", {
            "eyebrow": commands.get("eyebrow") or "",
            "title": commands.get("title") or "",
            "p1": commands.get("p1") or "",
            "p2": commands.get("p2") or "",
            "p3": commands.get("p3") or "",
            "p4": commands.get("p4") or "",
            "p5": commands.get("p5") or "",
            "stamp": commands.get("stamp") or "",
        }, [slot(img_src(c, "characters"), commands.get("stamp") or "")]),
        section_block("consultor", "consultor", "Demonstração extra", {
            "eyebrow": consultor.get("eyebrow") or "",
            "title": consultor.get("title") or "",
            "p1": consultor.get("p1") or "",
            "p2": consultor.get("p2") or "",
            "p3": consultor.get("p3") or "",
            "p4": consultor.get("p4") or "",
            "p5": consultor.get("p5") or "",
            "chatAsk": consultor.get("chatAsk") or "",
            "chatLabel": consultor.get("chatLabel") or "",
            "chatIntro": consultor.get("chatIntro") or "",
            "suggestions": copy.deepcopy(consultor.get("suggestions") or []),
        }),
        section_block("receive", "recebe", "Benefícios", {
            "eyebrow": receive.get("eyebrow") or "",
            "title": receive.get("title") or "",
            "items": copy.deepcopy(receive.get("items") or []),
        }, nav="O que você recebe"),
        section_block("possibilities", "possibilidades", "Possibilidades", {
            "eyebrow": possibilities.get("eyebrow") or "",
            "title": possibilities.get("title") or "",
            "lede": possibilities.get("lede") or "",
            "closing": possibilities.get("closing") or "",
            "items": copy.deepcopy(possibilities.get("items") or []),
        }, poss_images),
        section_block("audience", "para-quem", "Para quem é", {
            "eyebrow": audience.get("eyebrow") or "",
            "title": audience.get("title") or "",
            "items": copy.deepcopy(audience.get("items") or []),
        }),
        section_block("compare", "comparativo", "Comparativo", {
            "eyebrow": compare.get("eyebrow") or "",
            "title": compare.get("title") or "",
            "badTitle": compare.get("badTitle") or "",
            "goodTitle": compare.get("goodTitle") or "",
            "bad": copy.deepcopy(compare.get("bad") or []),
            "good": copy.deepcopy(compare.get("good") or []),
            "cta": offer.get("ctaAcquire") or "",
        }),
        section_block("offer", "oferta", "Oferta e preço", {
            "eyebrow": offer_block.get("eyebrow") or "",
            "title": offer_block.get("title") or "",
            "brand": offer_block.get("brand") or "",
            "tagline": offer_block.get("tagline") or "",
            "includesLabel": offer_block.get("includesLabel") or "",
            "includes": copy.deepcopy(offer_block.get("includes") or []),
            "priceLabel": offer_block.get("priceLabel") or "",
            "price": offer.get("price") or "",
            "checkoutUrl": offer.get("checkoutUrl") or "",
            "ctaAcquire": offer.get("ctaAcquire") or "",
            "ctaCreate": offer.get("ctaCreate") or "",
            "ctaCartelas": offer.get("ctaCartelas") or "",
            "ctaHow": offer.get("ctaHow") or "",
        }, nav="Oferta"),
        section_block("faq", "duvidas", "Perguntas frequentes", {
            "eyebrow": faq.get("eyebrow") or "",
            "title": faq.get("title") or "",
            "items": copy.deepcopy(faq.get("items") or []),
        }, nav="Dúvidas"),
        section_block("final", "chamada-final", "Chamada final", {
            "eyebrow": final.get("eyebrow") or "",
            "title": final.get("title") or "",
            "lede": final.get("lede") or "",
            "brand": final.get("brand") or "",
            "tagline": final.get("tagline") or "",
            "cta": offer.get("ctaCreate") or "",
        }, [
            slot(img_src(c, "crest")),
            slot(img_src(c, "monogram")),
            slot(img_src(c, "palette")),
            slot(img_src(c, "patterns")),
            slot(img_src(c, "party")),
            slot(img_src(c, "logo"), "Logo"),
        ]),
    ]
    media = []
    seen = set()
    for src in (c.get("images") or {}).values():
        if src and src not in seen:
            seen.add(src)
            media.append({"id": str(uuid4())[:10], "src": src, "name": Path(str(src).split("?")[0]).name})
    return {
        "version": 1,
        "meta": {"title": meta.get("title") or "", "description": meta.get("description") or ""},
        "footer": {"tagline": footer.get("tagline") or "", "copy": footer.get("copy") or ""},
        "logo": img_src(c, "logo", "assets/logo.svg"),
        "sections": sections,
        "media": media,
    }


def find_section(layout, stype):
    for section in (layout or {}).get("sections") or []:
        if section.get("type") == stype:
            return section
    return None


def sync_content_from_layout(page):
    layout = page.get("layout") or {}
    content = copy.deepcopy(page.get("content") or {})
    images = dict(content.get("images") or {})

    def take(stype):
        return (find_section(layout, stype) or {}).get("fields") or {}

    def imgs(stype):
        return (find_section(layout, stype) or {}).get("images") or []

    hero_f = take("hero")
    offer_f = take("offer")
    content["hero"] = {
        "eyebrow": hero_f.get("eyebrow") or "",
        "title": hero_f.get("title") or "",
        "tagline": hero_f.get("tagline") or "",
        "line1": hero_f.get("line1") or "",
        "lede": hero_f.get("lede") or "",
        "line2": hero_f.get("line2") or "",
    }
    content["offer"] = {
        "price": offer_f.get("price") or ((content.get("offer") or {}).get("price") or ""),
        "checkoutUrl": offer_f.get("checkoutUrl") if "checkoutUrl" in offer_f else ((content.get("offer") or {}).get("checkoutUrl") or ""),
        "ctaCreate": offer_f.get("ctaCreate") or hero_f.get("ctaPrimary") or ((content.get("offer") or {}).get("ctaCreate") or ""),
        "ctaAcquire": offer_f.get("ctaAcquire") or ((content.get("offer") or {}).get("ctaAcquire") or ""),
        "ctaCartelas": offer_f.get("ctaCartelas") or hero_f.get("ctaSecondary") or ((content.get("offer") or {}).get("ctaCartelas") or ""),
        "ctaHow": offer_f.get("ctaHow") or take("about").get("cta") or ((content.get("offer") or {}).get("ctaHow") or ""),
    }
    ob = take("offer")
    content["offerBlock"] = {
        "eyebrow": ob.get("eyebrow") or "",
        "title": ob.get("title") or "",
        "brand": ob.get("brand") or "",
        "tagline": ob.get("tagline") or "",
        "includesLabel": ob.get("includesLabel") or "",
        "includes": copy.deepcopy(ob.get("includes") or []),
        "priceLabel": ob.get("priceLabel") or "",
    }
    mapping = {
        "pains": "pains",
        "about": "about",
        "how": "how",
        "identity": "identity",
        "commands": "commands",
        "consultor": "consultor",
        "receive": "receive",
        "possibilities": "possibilities",
        "audience": "audience",
        "compare": "compare",
        "faq": "faq",
        "final": "final",
    }
    for stype, key in mapping.items():
        fields = take(stype)
        if fields:
            merged = copy.deepcopy(content.get(key) or {})
            merged.update(copy.deepcopy(fields))
            content[key] = merged
    polaroids = []
    keys = ("crest", "monogram", "party", "palette", "stationery")
    for i, image in enumerate(imgs("hero")):
        key = keys[i] if i < len(keys) else f"hero_{i}"
        images[key] = image.get("src") or ""
        polaroids.append({"key": key, "label": image.get("caption") or image.get("alt") or ""})
    content["polaroids"] = polaroids or content.get("polaroids") or []
    about_keys = ("crest", "banner", "cookies")
    for i, image in enumerate(imgs("about")):
        key = about_keys[i] if i < len(about_keys) else f"about_{i}"
        images[key] = image.get("src") or images.get(key, "")
    how_keys = ("board", "palette", "party")
    for i, image in enumerate(imgs("how")):
        key = how_keys[i] if i < len(how_keys) else f"how_{i}"
        images[key] = image.get("src") or images.get(key, "")
    gallery = []
    identity_keys = ("crest", "monogram", "palette", "patterns", "characters", "stationery")
    identity_sec = find_section(layout, "identity") or {}
    id_fields = identity_sec.get("fields") or {}
    for i, image in enumerate(identity_sec.get("images") or []):
        key = identity_keys[i] if i < len(identity_keys) else f"gallery_{i}"
        images[key] = image.get("src") or ""
        item = {}
        if i < len(id_fields.get("gallery") or []):
            item = copy.deepcopy(id_fields["gallery"][i])
        item["key"] = key
        item["title"] = item.get("title") or image.get("alt") or ""
        item["text"] = item.get("text") or image.get("caption") or ""
        gallery.append(item)
    if gallery:
        content.setdefault("identity", {})["gallery"] = gallery
    if imgs("commands"):
        images["characters"] = imgs("commands")[0].get("src") or images.get("characters", "")
    poss_keys = ("party", "board", "characters", "stationery", "cookies")
    poss_items = copy.deepcopy((take("possibilities").get("items") or content.get("possibilities", {}).get("items") or []))
    for i, image in enumerate(imgs("possibilities")):
        key = poss_keys[i] if i < len(poss_keys) else f"poss_{i}"
        images[key] = image.get("src") or ""
        if i < len(poss_items):
            poss_items[i]["key"] = key
            if image.get("caption"):
                poss_items[i]["text"] = image.get("caption")
    if poss_items:
        content.setdefault("possibilities", {})["items"] = poss_items
    final_keys = ("crest", "monogram", "palette", "patterns", "party", "logo")
    for i, image in enumerate(imgs("final")):
        key = final_keys[i] if i < len(final_keys) else f"final_{i}"
        images[key] = image.get("src") or images.get(key, "")
    if layout.get("logo"):
        images["logo"] = layout.get("logo")
    content["images"] = images
    if layout.get("meta"):
        content["meta"] = copy.deepcopy(layout.get("meta"))
    if layout.get("footer"):
        content["footer"] = copy.deepcopy(layout.get("footer"))
    page["content"] = content
    return page


def ensure_page_layout(page):
    if not isinstance(page, dict):
        return page
    content = page.get("content") or {}
    if not page.get("layout") or not isinstance(page.get("layout"), dict) or not (page.get("layout") or {}).get("sections"):
        page["layout"] = build_layout_from_content(content)
    page.setdefault("media", copy.deepcopy((page.get("layout") or {}).get("media") or []))
    return page


def make_page(content, slug, name, status="published", settings=None, page_id=None):
    settings = default_settings() | (settings or {})
    offer = content.get("offer") or {}
    if offer.get("checkoutUrl") and not settings.get("checkoutUrl"):
        settings["checkoutUrl"] = offer.get("checkoutUrl") or ""
    page = {
        "id": page_id or str(uuid4()),
        "slug": slug,
        "name": name,
        "status": status,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "settings": settings,
        "content": content,
        "template": "santarte-sales",
    }
    return ensure_page_layout(page)


def empty_store():
    return {"version": 3, "defaultSlug": "santarte", "pages": []}


def page_file(page_id):
    return PAGES_DIR / f"{page_id}.json"


def store_meta(store):
    return {
        "version": 3,
        "defaultSlug": store.get("defaultSlug") or "",
        "pageIds": [p["id"] for p in store.get("pages") or []],
    }


def persist_store_files(store):
    PAGES_DIR.mkdir(exist_ok=True)
    keep = set()
    for page in store.get("pages") or []:
        write_json(page_file(page["id"]), page)
        keep.add(page["id"])
    meta = store_meta(store)
    write_json(STORE_FILE, meta)
    write_json(CONTENT_FILE, meta)
    for path in PAGES_DIR.glob("*.json"):
        if path.stem not in keep:
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            shutil.copy2(path, BACKUP_DIR / f"page-{path.stem}-{stamp}.json")


def pages_from_v2(raw):
    if isinstance(raw, dict) and isinstance(raw.get("pages"), list) and raw.get("version") in {2, 3}:
        pages = []
        for item in raw["pages"]:
            if isinstance(item, dict) and item.get("id"):
                pages.append(item)
        return {
            "version": 3,
            "defaultSlug": raw.get("defaultSlug") or "",
            "pages": pages,
        }
    content = extract_content(raw if isinstance(raw, dict) else {})
    page = make_page(
        content,
        slug="santarte",
        name="Sant'Arte",
        status="published",
        settings={
            "productName": "Sant'Arte",
            "checkoutUrl": (content.get("offer") or {}).get("checkoutUrl") or "",
        },
    )
    return {"version": 3, "defaultSlug": "santarte", "pages": [page]}


def load_store_from_files():
    if not STORE_FILE.exists():
        return None
    meta = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    if not isinstance(meta, dict) or not isinstance(meta.get("pageIds"), list):
        return None
    pages = []
    dirty = False
    for page_id in meta.get("pageIds") or []:
        path = page_file(page_id)
        if not path.exists():
            continue
        page = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(page, dict) and page.get("id"):
            had_layout = bool((page.get("layout") or {}).get("sections"))
            page = ensure_page_layout(page)
            if not had_layout:
                dirty = True
            pages.append(page)
    store = {"version": 3, "defaultSlug": meta.get("defaultSlug") or "", "pages": pages}
    if dirty:
        persist_store_files(store)
    return store


def load_store():
    existing = load_store_from_files()
    if existing is not None:
        return existing
    raw = json.loads(CONTENT_FILE.read_text(encoding="utf-8")) if CONTENT_FILE.exists() else {}
    store = pages_from_v2(raw)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    if CONTENT_FILE.exists():
        shutil.copy2(CONTENT_FILE, BACKUP_DIR / f"pre-split-{stamp}.json")
    persist_store_files(store)
    return store


def save_store(store):
    persist_store_files(store)


def slugify(value):
    text = str(value or "").strip().lower()
    trans = str.maketrans("áàâãäéèêëíìîïóòôõöúùûüçñ", "aaaaaeeeeiiiiooooouuuucn")
    text = text.translate(trans)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:60]


def unique_slug(store, desired, ignore_id=None):
    base = slugify(desired) or "pagina"
    if base in RESERVED_SLUGS:
        base = f"pagina-{base}"
    slug = base
    n = 2
    while True:
        clash = next((p for p in store["pages"] if p["slug"] == slug and p["id"] != ignore_id), None)
        if not clash:
            return slug
        slug = f"{base}-{n}"
        n += 1


def find_page(store, page_id=None, slug=None):
    for page in store["pages"]:
        if page_id and page["id"] == page_id:
            return page
        if slug and page["slug"] == slug:
            return page
    return None


def default_page(store):
    page = find_page(store, slug=store.get("defaultSlug") or "santarte")
    if page and page.get("status") == "published":
        return page
    published = [p for p in store["pages"] if p.get("status") == "published"]
    if published:
        return published[0]
    return page or (store["pages"][0] if store["pages"] else None)


def page_summary(page):
    settings = page.get("settings") or {}
    return {
        "id": page["id"],
        "slug": page["slug"],
        "name": page.get("name") or page["slug"],
        "status": page.get("status") or "draft",
        "productName": settings.get("productName") or "",
        "price": ((page.get("content") or {}).get("offer") or {}).get("price") or "",
        "updatedAt": page.get("updatedAt"),
        "createdAt": page.get("createdAt"),
        "path": f"/{page['slug']}",
        "previewPath": f"/preview/{page['id']}",
    }


def public_payload(page, preview=False):
    page = ensure_page_layout(copy.deepcopy(page))
    sync_content_from_layout(page)
    content = copy.deepcopy(page.get("content") or {})
    settings = copy.deepcopy(page.get("settings") or default_settings())
    checkout = settings.get("checkoutUrl") or ((content.get("offer") or {}).get("checkoutUrl") or "")
    content.setdefault("offer", {})
    content["offer"]["checkoutUrl"] = checkout
    layout = copy.deepcopy(page.get("layout") or {})
    content["_page"] = {
        "id": page["id"],
        "slug": page["slug"],
        "name": page.get("name"),
        "status": page.get("status"),
        "preview": preview,
        "settings": {
            "productName": settings.get("productName") or "",
            "checkoutUrl": checkout,
            "metaPixelId": settings.get("metaPixelId") or "",
            "googleAnalyticsId": settings.get("googleAnalyticsId") or "",
            "googleTagManagerId": settings.get("googleTagManagerId") or "",
            "conversionEvent": settings.get("conversionEvent") or "Purchase",
        },
    }
    content["_layout"] = layout
    return content


def remap_upload_src(src, target_id):
    path = str(src or "").split("?")[0]
    if "/uploads/" not in path:
        return src
    file_src = ROOT / path
    if not file_src.exists() or not file_src.is_file():
        return src
    ext = file_src.suffix.lower() or ".jpg"
    name = file_src.name
    dest_dir = UPLOADS / target_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / name
    if not dest.exists():
        shutil.copy2(file_src, dest)
    return f"assets/img/uploads/{target_id}/{name}?v={secrets.token_hex(4)}"


def copy_page_uploads(source, target_id):
    content = copy.deepcopy(source.get("content") or {})
    images = content.get("images") or {}
    dest_dir = UPLOADS / target_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    for key, raw in list(images.items()):
        images[key] = remap_upload_src(raw, target_id)
    content["images"] = images
    layout = copy.deepcopy(source.get("layout") or {})
    for section in layout.get("sections") or []:
        for image in section.get("images") or []:
            image["src"] = remap_upload_src(image.get("src") or "", target_id)
    if layout.get("logo"):
        layout["logo"] = remap_upload_src(layout.get("logo"), target_id)
    for item in layout.get("media") or []:
        item["src"] = remap_upload_src(item.get("src") or "", target_id)
    return content, layout


def is_safe_static(filename):
    if filename.startswith("data/") or filename in {"app.py", "requirements.txt"}:
        return False
    return True


def landing_html(page=None, preview=False):
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    boot = {"slug": "", "preview": "", "pageId": ""}
    payload = None
    if page:
        boot = {
            "slug": "" if preview else (page.get("slug") or ""),
            "preview": page["id"] if preview else "",
            "pageId": page["id"],
        }
        payload = public_payload(page, preview=preview)
    boot_json = json.dumps(boot, ensure_ascii=False).replace("</", "<\\/")
    payload_json = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/") if payload is not None else "null"
    snippet = (
        "<script>window.__SANTARTE_BOOT=" + boot_json +
        ";window.__SANTARTE_CONTENT=" + payload_json + ";</script>\n"
    )
    html = html.replace('<script src="js/main.js"></script>', snippet + '<script src="js/main.js"></script>', 1)
    html = html.replace('href="css/styles.css"', 'href="css/styles.css?v=20261101e"')
    html = html.replace('src="js/content.js"', 'src="js/content.js?v=20261101e"')
    html = html.replace('src="js/main.js"', 'src="js/main.js?v=20261101e"')
    resp = make_response(html)
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    return no_cache(resp)


app = Flask(__name__, static_folder=None)
app.secret_key = load_secret()
app.config["MAX_CONTENT_LENGTH"] = MAX_BYTES
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return jsonify({"ok": False, "error": "Nao autorizado"}), 401
        return fn(*args, **kwargs)

    return wrapper


@app.get("/api/content")
def api_content():
    store = load_store()
    slug = (request.args.get("slug") or "").strip()
    preview_id = (request.args.get("preview") or "").strip()
    if preview_id:
        if not session.get("admin"):
            return jsonify({"ok": False, "error": "Nao autorizado"}), 401
        page = find_page(store, page_id=preview_id)
        if not page:
            return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
        return jsonify(public_payload(page, preview=True))
    if slug:
        page = find_page(store, slug=slug)
    else:
        page = default_page(store)
        if page and page.get("status") != "published":
            published = [p for p in store["pages"] if p.get("status") == "published"]
            page = published[0] if published else None
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    if page.get("status") != "published":
        return jsonify({"ok": False, "error": "Pagina nao publicada"}), 404
    return no_cache(jsonify(public_payload(page)))


@app.post("/api/login")
def api_login():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    auth = load_auth()
    if username != auth.get("username") or not check_password_hash(auth.get("password_hash", ""), password):
        return jsonify({"ok": False, "error": "Usuario ou senha invalidos"}), 401
    session["admin"] = True
    session["username"] = username
    return jsonify({"ok": True, "username": username})


@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/session")
def api_session():
    if session.get("admin"):
        return jsonify({"ok": True, "username": session.get("username", "admin")})
    return jsonify({"ok": False}), 401


@app.get("/api/pages")
@login_required
def api_pages():
    store = load_store()
    pages = [page_summary(p) for p in store["pages"]]
    pages.sort(key=lambda p: p.get("updatedAt") or "", reverse=True)
    return jsonify({"ok": True, "defaultSlug": store.get("defaultSlug"), "pages": pages})


@app.get("/api/pages/<page_id>")
@login_required
def api_get_page(page_id):
    store = load_store()
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    return jsonify({"ok": True, "page": ensure_page_layout(page)})


@app.post("/api/pages")
@login_required
def api_create_page():
    body = request.get_json(silent=True) or {}
    store = load_store()
    source_id = str(body.get("sourceId") or "")
    source = find_page(store, page_id=source_id) if source_id else default_page(store)
    if not source:
        return jsonify({"ok": False, "error": "Modelo nao encontrado"}), 400
    name = str(body.get("name") or "Nova pagina").strip() or "Nova pagina"
    slug = unique_slug(store, body.get("slug") or name)
    if slug in RESERVED_SLUGS:
        return jsonify({"ok": False, "error": "Este endereco e reservado"}), 400
    page_id = str(uuid4())
    content, layout = copy_page_uploads(source, page_id)
    content.setdefault("offer", {})["checkoutUrl"] = ""
    settings = default_settings()
    settings["productName"] = str(body.get("productName") or name)
    settings["checkoutUrl"] = ""
    page = make_page(content, slug=slug, name=name, status="draft", settings=settings, page_id=page_id)
    if isinstance(layout, dict) and layout.get("sections"):
        page["layout"] = layout
    store["pages"].append(page)
    save_store(store)
    return jsonify({"ok": True, "page": page_summary(page)})


@app.post("/api/pages/<page_id>/duplicate")
@login_required
def api_duplicate_page(page_id):
    store = load_store()
    source = find_page(store, page_id=page_id)
    if not source:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    new_id = str(uuid4())
    content, layout = copy_page_uploads(source, new_id)
    content.setdefault("offer", {})["checkoutUrl"] = ""
    settings = default_settings()
    settings["productName"] = f"{source.get('name') or source['slug']} (copia)"
    settings["checkoutUrl"] = ""
    name = f"{source.get('name') or source['slug']} (copia)"
    slug = unique_slug(store, f"{source['slug']}-copia")
    page = make_page(content, slug=slug, name=name, status="draft", settings=settings, page_id=new_id)
    if isinstance(layout, dict) and layout.get("sections"):
        page["layout"] = layout
    store["pages"].append(page)
    save_store(store)
    return jsonify({"ok": True, "page": page_summary(page), "id": page["id"]})


@app.put("/api/pages/<page_id>")
@login_required
def api_update_page(page_id):
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "JSON invalido"}), 400
    store = load_store()
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    if "name" in body:
        name = str(body.get("name") or "").strip()
        if name:
            page["name"] = name
    if "status" in body:
        status = str(body.get("status") or "").strip()
        if status in {"published", "draft", "archived"}:
            page["status"] = status
    if "slug" in body:
        desired = slugify(body.get("slug"))
        if not desired or not SLUG_RE.match(desired):
            return jsonify({"ok": False, "error": "Endereco invalido. Use letras, numeros e hifens."}), 400
        if desired in RESERVED_SLUGS:
            return jsonify({"ok": False, "error": "Este endereco e reservado"}), 400
        taken = find_page(store, slug=desired)
        if taken and taken["id"] != page_id:
            return jsonify({"ok": False, "error": "Este endereco ja esta em uso"}), 409
        if store.get("defaultSlug") == page["slug"]:
            store["defaultSlug"] = desired
        page["slug"] = desired
    if "settings" in body and isinstance(body["settings"], dict):
        page["settings"] = default_settings() | (page.get("settings") or {}) | body["settings"]
        checkout = page["settings"].get("checkoutUrl") or ""
        page.setdefault("content", {}).setdefault("offer", {})["checkoutUrl"] = checkout
    if "layout" in body and isinstance(body["layout"], dict):
        page["layout"] = copy.deepcopy(body["layout"])
        sync_content_from_layout(page)
        offer_checkout = ((page.get("content") or {}).get("offer") or {}).get("checkoutUrl")
        if offer_checkout is not None:
            page.setdefault("settings", default_settings())["checkoutUrl"] = offer_checkout
    elif "content" in body and isinstance(body["content"], dict):
        incoming = extract_content(body["content"])
        page["content"] = copy.deepcopy(incoming)
        page["layout"] = build_layout_from_content(page["content"])
        offer_checkout = ((incoming.get("offer") or {}).get("checkoutUrl"))
        if offer_checkout is not None:
            page.setdefault("settings", default_settings())["checkoutUrl"] = offer_checkout
    page["updatedAt"] = now_iso()
    save_store(store)
    return jsonify({"ok": True, "page": page_summary(page)})


@app.post("/api/pages/<page_id>/status")
@login_required
def api_page_status(page_id):
    body = request.get_json(silent=True) or {}
    status = str(body.get("status") or "").strip()
    if status not in {"published", "draft", "archived"}:
        return jsonify({"ok": False, "error": "Status invalido"}), 400
    store = load_store()
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    page["status"] = status
    page["updatedAt"] = now_iso()
    save_store(store)
    return jsonify({"ok": True, "page": page_summary(page)})


@app.delete("/api/pages/<page_id>")
@login_required
def api_delete_page(page_id):
    store = load_store()
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    if page.get("slug") == store.get("defaultSlug") and page.get("status") == "published":
        return jsonify({"ok": False, "error": "Arquive a pagina principal antes de excluir"}), 400
    store["pages"] = [p for p in store["pages"] if p["id"] != page_id]
    save_store(store)
    upload_dir = UPLOADS / page_id
    if upload_dir.exists() and upload_dir.is_dir():
        shutil.copytree(upload_dir, BACKUP_DIR / f"uploads-{page_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}", dirs_exist_ok=True)
    return jsonify({"ok": True})


@app.get("/api/slugs/check")
@login_required
def api_slug_check():
    slug = slugify(request.args.get("slug") or "")
    ignore = request.args.get("ignoreId") or None
    store = load_store()
    if not slug or not SLUG_RE.match(slug):
        return jsonify({"ok": True, "available": False, "reason": "invalido", "slug": slug})
    if slug in RESERVED_SLUGS:
        return jsonify({"ok": True, "available": False, "reason": "reservado", "slug": slug})
    taken = find_page(store, slug=slug)
    available = not taken or taken["id"] == ignore
    return jsonify({"ok": True, "available": available, "slug": slug, "reason": None if available else "em uso"})


@app.put("/api/content")
@login_required
def api_save_content():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "JSON invalido"}), 400
    store = load_store()
    page_id = str(body.get("_pageId") or request.args.get("pageId") or "")
    if not page_id:
        return jsonify({"ok": False, "error": "Informe o ID da pagina"}), 400
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    if isinstance(body.get("layout"), dict):
        page["layout"] = copy.deepcopy(body["layout"])
        sync_content_from_layout(page)
    else:
        incoming = extract_content(body)
        page["content"] = copy.deepcopy(incoming)
        page["layout"] = build_layout_from_content(page["content"])
    checkout = ((page.get("content") or {}).get("offer") or {}).get("checkoutUrl")
    if checkout is not None:
        page.setdefault("settings", default_settings())["checkoutUrl"] = checkout
    page["updatedAt"] = now_iso()
    save_store(store)
    return jsonify({"ok": True})


@app.post("/api/password")
@login_required
def api_password():
    body = request.get_json(silent=True) or {}
    current_password = str(body.get("currentPassword", ""))
    new_password = str(body.get("newPassword", ""))
    if len(new_password) < 8:
        return jsonify({"ok": False, "error": "A nova senha precisa ter ao menos 8 caracteres"}), 400
    auth = load_auth()
    if not check_password_hash(auth.get("password_hash", ""), current_password):
        return jsonify({"ok": False, "error": "Senha atual incorreta"}), 400
    auth["password_hash"] = generate_password_hash(new_password)
    save_auth(auth)
    return jsonify({"ok": True})


@app.post("/api/upload")
@login_required
def api_upload():
    file = request.files.get("file")
    key = re.sub(r"[^a-zA-Z0-9_-]", "", str(request.form.get("key", "") or ""))
    page_id = str(request.form.get("pageId") or "")
    if not file or not file.filename:
        return jsonify({"ok": False, "error": "Nenhum arquivo enviado"}), 400
    if not page_id:
        return jsonify({"ok": False, "error": "Informe o ID da pagina"}), 400
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        return jsonify({"ok": False, "error": "Formato nao permitido"}), 400
    store = load_store()
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    dest_dir = UPLOADS / page["id"]
    dest_dir.mkdir(parents=True, exist_ok=True)
    unique = secrets.token_hex(4)
    name = secure_filename(f"{key or 'img'}-{unique}{ext}")
    dest = dest_dir / name
    file.save(dest)
    rel = f"assets/img/uploads/{page['id']}/{name}?v={unique}"
    page.setdefault("content", {}).setdefault("images", {})
    if key and key not in {"media", "image", "file"}:
        page["content"]["images"][key] = rel
    ensure_page_layout(page)
    media_item = {"id": unique, "src": rel, "name": name}
    page.setdefault("layout", {}).setdefault("media", []).append(media_item)
    page["updatedAt"] = now_iso()
    save_store(store)
    return jsonify({"ok": True, "path": rel, "key": key, "pageId": page["id"], "media": media_item})


def no_cache(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    resp.headers.pop("ETag", None)
    return resp


@app.get("/admin")
@app.get("/admin/")
def admin_page():
    return no_cache(make_response(send_from_directory(ROOT / "admin", "index.html")))


@app.get("/admin/<path:filename>")
def admin_static(filename):
    return no_cache(make_response(send_from_directory(ROOT / "admin", filename)))


@app.get("/")
def home():
    store = load_store()
    page = default_page(store)
    if page and page.get("status") == "published":
        return landing_html(page)
    published = [p for p in store["pages"] if p.get("status") == "published"]
    if published:
        return landing_html(published[0])
    return no_cache(make_response(send_from_directory(ROOT, "404.html"))), 404


@app.get("/preview/<page_id>")
def preview_page(page_id):
    if not session.get("admin"):
        return jsonify({"ok": False, "error": "Nao autorizado"}), 401
    store = load_store()
    page = find_page(store, page_id=page_id)
    if not page:
        return jsonify({"ok": False, "error": "Pagina nao encontrada"}), 404
    return landing_html(page, preview=True)


@app.get("/<path:filename>")
def public_files(filename):
    if filename.startswith("api/") or filename.startswith("admin"):
        return jsonify({"error": "Not found"}), 404
    if not is_safe_static(filename):
        return jsonify({"error": "Not found"}), 404
    if filename in {"index.html", "index.htm"}:
        return home()
    target = ROOT / filename
    if target.exists() and target.is_file():
        return send_from_directory(ROOT, filename)
    slug = filename.strip("/")
    if "/" not in slug and SLUG_RE.match(slug) and slug not in RESERVED_SLUGS:
        store = load_store()
        page = find_page(store, slug=slug)
        if page and page.get("status") == "published":
            return landing_html(page)
        return no_cache(make_response(send_from_directory(ROOT, "404.html"))), 404
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    load_auth()
    load_store()
    app.run(host="0.0.0.0", port=8000, debug=False)
