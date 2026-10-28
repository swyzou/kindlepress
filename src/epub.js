import { zip } from "./zip.js";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])
  );

/**
 * Typography tuned for e-ink: generous line-height, no fixed font family (the
 * Kindle picks its own), images capped so they never overflow the page, and
 * footnotes set apart. `dir` is applied on <html> so RTL scripts survive — a
 * documented failure of the incumbent.
 */
const CSS = `
@namespace epub "http://www.idpf.org/2007/ops";
body { line-height: 1.5; margin: 0 5%; text-align: justify; }
h1 { font-size: 1.5em; line-height: 1.25; margin: 1em 0 0.2em; text-align: start; }
h2, h3, h4 { line-height: 1.3; margin: 1.2em 0 0.3em; text-align: start; }
p { margin: 0 0 0.75em; text-indent: 0; widows: 2; orphans: 2; }
a { text-decoration: none; }
img { max-width: 100%; height: auto; }
figure { margin: 1em 0; page-break-inside: avoid; }
figcaption { font-size: 0.85em; font-style: italic; text-align: center; }
blockquote { margin: 1em 1.5em; font-style: italic; }
pre { font-size: 0.8em; white-space: pre-wrap; word-wrap: break-word; }
code { font-size: 0.9em; }
table { border-collapse: collapse; width: 100%; font-size: 0.85em; margin: 1em 0; }
th, td { border: 1px solid #999; padding: 0.3em; text-align: start; }
hr { border: 0; border-top: 1px solid #999; margin: 1.5em 20%; }
.kp-meta { font-size: 0.85em; color: #555; margin: 0 0 1.5em; text-align: start; }
.kp-meta a { color: #555; }
.kp-notes { margin-top: 2em; font-size: 0.85em; }
.kp-notes h2 { font-size: 1.1em; }
.kp-notes li { margin-bottom: 0.5em; }
`.trim();

function opf({ id, title, author, lang, date, source, images }) {
  const imgItems = images
    .map(
      (im, i) =>
        `    <item id="img${i}" href="${esc(im.path)}" media-type="${esc(im.type)}"/>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${esc(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${esc(id)}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>${esc(lang)}</dc:language>
    <dc:creator>${esc(author)}</dc:creator>
    <dc:source>${esc(source)}</dc:source>
    <dc:date>${esc(date)}</dc:date>
    <meta property="dcterms:modified">${esc(date)}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="article" href="article.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
${imgItems}
  </manifest>
  <spine>
    <itemref idref="article"/>
  </spine>
</package>`;
}

function page({ title, lang, dir, bodyHtml }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(lang)}" lang="${esc(lang)}" dir="${esc(dir)}">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Build a valid EPUB 3 from an extracted article.
 * @param {object} a
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function buildEpub(a) {
  const id = crypto.randomUUID();
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const lang = a.lang || "en";
  const dir = a.dir === "rtl" ? "rtl" : "ltr";
  const title = a.title || "Untitled";
  let host = "";
  try {
    host = new URL(a.url).hostname;
  } catch {
    host = "";
  }
  const author = a.author || a.siteName || host || "Unknown";

  const images = (a.images || []).map((im, i) => ({
    path: `img/${i}.${im.ext}`,
    type: im.type,
    bytes: im.bytes,
  }));

  const meta =
    `<p class="kp-meta">` +
    esc(author) +
    (a.published ? ` &#183; ${esc(a.published)}` : "") +
    (host ? ` &#183; <a href="${esc(a.url)}">${esc(host)}</a>` : "") +
    (a.readingTime ? ` &#183; ${esc(a.readingTime)} min read` : "") +
    `</p>`;

  const body = `<h1>${esc(title)}</h1>\n${meta}\n${a.html}`;

  const files = [
    // Must be first and stored uncompressed; zip() stores every entry.
    { name: "mimetype", data: "application/epub+zip" },
    {
      name: "META-INF/container.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    },
    {
      name: "OEBPS/content.opf",
      data: opf({ id, title, author, lang, date, source: a.url, images }),
    },
    {
      name: "OEBPS/nav.xhtml",
      data: page({
        title,
        lang,
        dir,
        bodyHtml: `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="article.xhtml">${esc(
          title
        )}</a></li></ol></nav>`,
      }),
    },
    { name: "OEBPS/article.xhtml", data: page({ title, lang, dir, bodyHtml: body }) },
    { name: "OEBPS/style.css", data: CSS },
    ...images.map((im) => ({ name: `OEBPS/${im.path}`, data: im.bytes })),
  ];

  return { blob: zip(files), filename: safeName(title) + ".epub" };
}

export function safeName(title) {
  const stripped = String(title)
    .split("")
    .filter((ch) => ch.charCodeAt(0) > 31)
    .join("")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  return stripped || "article";
}
