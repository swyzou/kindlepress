/**
 * Extraction, injected into the page on user gesture.
 *
 * It runs against the LIVE DOM, after the page's JavaScript has run and with
 * the user's session already applied. That is what makes logged-in and
 * paywall-popup pages work, and it is the difference between this and any
 * tool that re-fetches the URL from a server.
 *
 * Readability does the heavy lifting, but it has documented weaknesses. The
 * pre-pass below repairs the ones that actually bite:
 *   - lazy-loaded images that never got a real `src`
 *   - data tables dropped because a class name looked like layout
 *   - footnotes stripped of the markup that makes them navigable
 *   - overlays and paywall modals counted as content
 */

const LAZY_ATTRS = [
  "data-src",
  "data-original",
  "data-lazy-src",
  "data-actualsrc",
  "data-hi-res-src",
  "data-url",
];

const JUNK_SELECTORS = [
  "[aria-hidden='true']",
  "[role='dialog']",
  "[role='alertdialog']",
  "dialog[open]",
  ".modal",
  ".paywall",
  ".newsletter",
  ".cookie",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='subscribe-overlay']",
  "[class*='popup']",
  "script",
  "style",
  "noscript",
  "iframe",
  "svg use",
  "[class*='skip-link']",
  "[class*='skip-to-content']",
];

/** Accessibility skip links read as body text once the chrome is gone. */
const SKIP_LINK_TEXT = /^\s*(skip|jump)\s+(to|over|past|navigation|main|content)\b/i;

/** Largest candidate from a srcset string. */
function fromSrcset(srcset) {
  const best = srcset
    .split(",")
    .map((part) => {
      const [url, d] = part.trim().split(/\s+/);
      const w = d && d.endsWith("w") ? parseInt(d) : d && d.endsWith("x") ? parseFloat(d) * 1000 : 0;
      return { url, w: w || 0 };
    })
    .filter((c) => c.url)
    .sort((a, b) => b.w - a.w)[0];
  return best ? best.url : null;
}

/**
 * Give every image a real, absolute `src` before Readability sees it, and
 * remember the rendered size so tiny tracking pixels can be dropped later.
 */
function resolveImages(doc, baseUrl) {
  for (const img of doc.querySelectorAll("img")) {
    let src = img.getAttribute("src") || "";
    if (!src || src.startsWith("data:image/gif") || src.length < 8) {
      for (const a of LAZY_ATTRS) {
        const v = img.getAttribute(a);
        if (v) {
          src = v;
          break;
        }
      }
    }
    const ss = img.getAttribute("srcset") || img.getAttribute("data-srcset");
    if (ss) {
      const best = fromSrcset(ss);
      if (best) src = best;
    }
    if (!src) {
      const pic = img.closest("picture");
      const sourceSs = pic && pic.querySelector("source[srcset]");
      if (sourceSs) src = fromSrcset(sourceSs.getAttribute("srcset")) || src;
    }
    if (src) {
      try {
        img.setAttribute("src", new URL(src, baseUrl).href);
      } catch {
        /* leave as-is; dropped later if unusable */
      }
    }
    img.removeAttribute("srcset");
    img.removeAttribute("loading");
  }
}

/**
 * Readability discards tables whose class hints at layout. Real data tables
 * (those with a header row or several rows and columns) are marked so they
 * survive — users lose comparison tables otherwise.
 */
function protectDataTables(doc) {
  for (const t of doc.querySelectorAll("table")) {
    const rows = t.rows ? t.rows.length : 0;
    const cols = t.rows && t.rows[0] ? t.rows[0].cells.length : 0;
    const hasHeader = !!t.querySelector("th");
    if (hasHeader || (rows >= 2 && cols >= 2)) {
      t.setAttribute("data-kp-keep", "1");
      t.removeAttribute("class");
      t.removeAttribute("role");
    }
  }
}

/** Strip chrome that confuses the paragraph-density heuristic. */
function removeJunk(doc) {
  for (const sel of JUNK_SELECTORS) {
    for (const el of doc.querySelectorAll(sel)) {
      // An aria-hidden wrapper around the article itself would take the
      // article with it, so only drop small or clearly decorative nodes.
      if (sel.startsWith("[aria-hidden") && el.textContent.length > 2000) continue;
      el.remove();
    }
  }
  removeSkipLinks(doc);
}

/**
 * Drop "Skip to main content" anchors. They are in-page links whose text is
 * navigation, not prose, and they survive into the first paragraph of sites
 * that place them inside the article wrapper. Length is capped so a real
 * sentence that happens to start with "skip to" is never removed.
 */
function removeSkipLinks(doc) {
  for (const a of doc.querySelectorAll('a[href^="#"]')) {
    const text = a.textContent || "";
    if (text.length <= 60 && SKIP_LINK_TEXT.test(text)) a.remove();
  }
}

/** rtl when the document says so, or when the text is mostly RTL script. */
function detectDirection(doc, text) {
  const declared = (
    doc.documentElement.getAttribute("dir") ||
    (doc.body && doc.body.getAttribute("dir")) ||
    ""
  ).toLowerCase();
  if (declared === "rtl" || declared === "ltr") return declared;
  const rtl = (text.match(/[֐-ࣿיִ-﷿ﹰ-﻿]/g) || []).length;
  const ltr = (text.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  return rtl > ltr * 0.3 && rtl > 40 ? "rtl" : "ltr";
}

function meta(doc, names) {
  for (const n of names) {
    const el =
      doc.querySelector(`meta[property="${n}"]`) || doc.querySelector(`meta[name="${n}"]`);
    const c = el && el.getAttribute("content");
    if (c && c.trim()) return c.trim();
  }
  return "";
}

/**
 * Turn in-page footnote references into EPUB endnotes with working backlinks.
 * Readability keeps the anchors but the targets usually sit outside the
 * extracted body, leaving dead links — a complaint in the incumbent's reviews.
 */
function rebuildFootnotes(container, sourceDoc) {
  const notes = [];
  const anchors = container.querySelectorAll('a[href^="#"]');
  for (const a of anchors) {
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    if (!id) continue;
    if (container.querySelector(`#${CSS.escape(id)}`)) continue; // target already inside
    const target = sourceDoc.getElementById(id);
    if (!target) continue;
    const text = target.textContent.replace(/\s+/g, " ").trim();
    if (!text || text.length > 2000) continue;
    const n = notes.length + 1;
    notes.push({ n, text });
    a.setAttribute("href", `#kp-note-${n}`);
    a.setAttribute("id", `kp-ref-${n}`);
    a.setAttribute("epub:type", "noteref");
    if (!a.textContent.trim()) a.textContent = String(n);
  }
  return notes;
}

/**
 * Readability scores one top candidate and keeps what is inside it. On
 * component-based layouts the figures sit in sibling containers, so they are
 * never selected — measured on science.nasa.gov, the article body holds two
 * images and the extraction returned none, with every cleaning pass disabled.
 *
 * This walks back to the region of the source document the extracted text
 * actually came from, and re-inserts the figures that belong to it, in place.
 */
function recoverImages(container, sourceDoc, baseUrl) {
  const key = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);

  const kept = [...container.querySelectorAll("p")].map(key).filter((t) => t.length > 40);
  if (!kept.length) return 0;

  // Anchor the extracted text back into the source tree.
  const anchors = [];
  for (const p of sourceDoc.querySelectorAll("p")) {
    if (kept.includes(key(p))) anchors.push(p);
  }
  if (anchors.length < 2) return 0;

  let region = anchors[0];
  for (const a of anchors) {
    while (region && !region.contains(a)) region = region.parentElement;
    if (!region) return 0;
  }

  // Only images the article region owns, and only ones worth carrying.
  const have = new Set(
    [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"))
  );
  const candidates = [...region.querySelectorAll("img")].filter((img) => {
    const src = img.getAttribute("src");
    if (!src || have.has(src)) return false;
    if (img.closest("nav, header, footer, aside")) return false;
    const w = parseInt(img.getAttribute("width") || "0", 10);
    const h = parseInt(img.getAttribute("height") || "0", 10);
    if ((w && w < 120) || (h && h < 120)) return false; // icons, pixels, avatars
    return true;
  });
  if (!candidates.length) return 0;

  const paras = [...container.querySelectorAll("p")];
  let added = 0;

  for (const img of candidates) {
    // The figure carries the caption; prefer it when there is one.
    const fig = img.closest("figure");
    const node = (fig || img).cloneNode(true);
    // These come straight from the source tree, so they still need the lazy-src
    // and srcset resolution the cloned document already went through.
    resolveImages(node, baseUrl);

    // Place it after the last extracted paragraph that precedes it in source order.
    let target = null;
    for (const p of paras) {
      const srcP = anchors.find((a) => key(a) === key(p));
      if (!srcP) continue;
      const pos = srcP.compareDocumentPosition(img);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) target = p;
    }

    if (target && target.parentNode) target.after(node);
    else container.appendChild(node);
    added++;
  }
  return added;
}

/** Serialize through XML so the EPUB is guaranteed well-formed. */
function toXhtml(node) {
  const out = new XMLSerializer().serializeToString(node);
  return out
    .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "")
    .replace(/<\/?body[^>]*>/g, "")
    .trim();
}

/**
 * Fetched here, in the page, so the user's cookies apply — images behind a
 * login or a referrer check come through. Results cross into the extension as
 * base64 because scripting results are JSON-only.
 */
async function imageBytes(url, pageOrigin) {
  // Credentials matter for images behind a login, but CORS forbids sending them
  // to a server that answers `Access-Control-Allow-Origin: *` — which is what
  // most public CDNs do. Asking with credentials first would therefore fail on
  // the common case, so the mode is chosen per URL, with the other as fallback.
  let sameOrigin = false;
  try {
    sameOrigin = new URL(url).origin === pageOrigin;
  } catch {
    return null;
  }
  const modes = sameOrigin ? ["include", "omit"] : ["omit", "include"];

  for (const credentials of modes) {
    try {
      const r = await fetch(url, { credentials });
      if (!r.ok) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length <= 64 || buf.length > 6 * 1024 * 1024) return null;
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      }
      return { b64: btoa(bin), type: r.headers.get("content-type") || "" };
    } catch {
      /* try the other credentials mode */
    }
  }
  return null;
}

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * @param {object}  [opts]
 * @param {boolean} [opts.includeImages]
 * @param {number}  [opts.maxImages]
 * @param {Document}[opts.doc]     source document; defaults to the live page
 * @param {string}  [opts.baseUrl] base for relative URLs; defaults to the page
 */
async function extract({ includeImages = true, maxImages = 60, doc, baseUrl } = {}) {
  if (typeof Readability !== "function") {
    return { ok: false, reason: "engine-missing", message: "Extraction engine failed to load." };
  }

  const sourceDoc = doc || document;
  baseUrl = baseUrl || (sourceDoc.location && sourceDoc.location.href) || location.href;

  // Work on a clone: the user's page is never touched.
  const work = sourceDoc.cloneNode(true);
  resolveImages(work, baseUrl);
  protectDataTables(work);
  removeJunk(work);

  let article = null;
  try {
    article = new Readability(work, {
      charThreshold: 250,
      keepClasses: false,
    }).parse();
  } catch (e) {
    article = null;
  }

  // Fall back to whatever the user highlighted rather than failing silently.
  const selection = sourceDoc.getSelection ? sourceDoc.getSelection() : null;
  const hasSelection = selection && selection.toString().trim().length > 200;

  if ((!article || !article.content) && !hasSelection) {
    return {
      ok: false,
      reason: "no-article",
      message:
        "No article found on this page. Select the text you want and try again.",
    };
  }

  const holder = sourceDoc.createElement("div");
  if (article && article.content && !hasSelection) {
    holder.innerHTML = article.content;
  } else {
    holder.appendChild(selection.getRangeAt(0).cloneContents());
  }

  // Readability wraps everything in #readability-page-1; unwrap for clean XHTML.
  const inner = holder.querySelector("#readability-page-1");
  if (inner) holder.replaceChildren(...inner.childNodes);

  const notes = rebuildFootnotes(holder, sourceDoc);
  const recovered = includeImages ? recoverImages(holder, sourceDoc, baseUrl) : 0;

  // Absolutize links, drop attributes that are meaningless in an EPUB.
  for (const a of holder.querySelectorAll("a[href]")) {
    try {
      a.setAttribute("href", new URL(a.getAttribute("href"), baseUrl).href);
    } catch {
      a.removeAttribute("href");
    }
    a.removeAttribute("target");
    a.removeAttribute("rel");
  }
  // Drop presentation, event handlers and our own internal markers; an EPUB
  // reader needs none of them and they only risk invalid XHTML.
  for (const el of holder.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (/^(on|data-)/i.test(attr.name) || attr.name === "style" || attr.name === "class") {
        el.removeAttribute(attr.name);
      }
    }
  }

  // Keep only ids something actually links to. Generators such as Parsoid
  // stamp an id on nearly every node, which is pure weight in an EPUB.
  const referenced = new Set(
    [...holder.querySelectorAll('a[href^="#"]')].map((a) =>
      decodeURIComponent(a.getAttribute("href").slice(1))
    )
  );
  for (const el of holder.querySelectorAll("[id]")) {
    const id = el.getAttribute("id");
    if (!referenced.has(id) && !id.startsWith("kp-")) el.removeAttribute("id");
  }

  // Images: embed what we can reach, drop what we cannot rather than leaving
  // a broken reference on the device.
  const images = [];
  let skipped = 0;
  let pageOrigin = "";
  try {
    pageOrigin = new URL(baseUrl).origin;
  } catch {
    pageOrigin = "";
  }
  if (includeImages) {
    const imgs = [...holder.querySelectorAll("img")].slice(0, maxImages);
    const results = await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute("src");
        if (!src) return { img, got: null };
        // Inline images are already here; no need to go back to the network.
        const inline = /^data:([^;,]+);base64,(.+)$/i.exec(src);
        if (inline) return { img, got: { b64: inline[2], type: inline[1] } };
        if (src.startsWith("data:")) return { img, got: null };
        const got = await imageBytes(src, pageOrigin);
        return { img, got: got || null };
      })
    );
    for (const r of results) {
      if (!r) continue;
      if (!r.got) {
        r.img.remove();
        skipped++;
        continue;
      }
      const type = (r.got.type.split(";")[0] || "image/jpeg").toLowerCase();
      const ext = EXT_BY_TYPE[type];
      if (!ext) {
        r.img.remove();
        skipped++;
        continue;
      }
      const i = images.length;
      images.push({ ext, type, b64: r.got.b64 });
      r.img.setAttribute("src", `img/${i}.${ext}`);
      r.img.removeAttribute("width");
      r.img.removeAttribute("height");
    }
  }
  for (const img of holder.querySelectorAll("img")) {
    const s = img.getAttribute("src") || "";
    if (!s.startsWith("img/")) img.remove();
  }

  if (notes.length) {
    const sec = sourceDoc.createElement("section");
    sec.setAttribute("class", "kp-notes");
    sec.setAttribute("epub:type", "endnotes");
    const h = sourceDoc.createElement("h2");
    h.textContent = "Notes";
    sec.appendChild(h);
    const ol = sourceDoc.createElement("ol");
    for (const note of notes) {
      const li = sourceDoc.createElement("li");
      li.setAttribute("id", `kp-note-${note.n}`);
      li.setAttribute("epub:type", "footnote");
      li.textContent = note.text + " ";
      const back = sourceDoc.createElement("a");
      back.setAttribute("href", `#kp-ref-${note.n}`);
      back.textContent = "↩";
      li.appendChild(back);
      ol.appendChild(li);
    }
    sec.appendChild(ol);
    holder.appendChild(sec);
  }

  const text = holder.textContent || "";
  const words = (text.match(/\S+/g) || []).length;

  return {
    ok: true,
    title:
      (article && article.title) ||
      meta(sourceDoc, ["og:title", "twitter:title"]) ||
      sourceDoc.title ||
      "Untitled",
    author:
      (article && article.byline) ||
      meta(sourceDoc, ["author", "article:author", "og:article:author"]) ||
      "",
    siteName: (article && article.siteName) || meta(sourceDoc, ["og:site_name"]) || "",
    published: (meta(sourceDoc, ["article:published_time", "datePublished"]) || "").slice(0, 10),
    lang:
      (sourceDoc.documentElement.getAttribute("lang") || "").split("-")[0] ||
      (article && article.lang) ||
      "en",
    dir: detectDirection(sourceDoc, text),
    url: baseUrl,
    html: toXhtml(holder),
    images,
    stats: {
      words,
      readingTime: Math.max(1, Math.round(words / 230)),
      imagesEmbedded: images.length,
      imagesSkipped: skipped,
      notes: notes.length,
      imagesRecovered: recovered,
      usedSelection: hasSelection,
    },
    readingTime: Math.max(1, Math.round(words / 230)),
  };
}

// Injected as a classic script, so hand the entry point to the page world.
globalThis.__kpExtract = extract;
