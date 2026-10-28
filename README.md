# KindlePress

Turn any web page into a clean EPUB for your Kindle. Unlimited, free, no account,
nothing leaves your browser.

[**Install from the Chrome Web Store**](https://chromewebstore.google.com/detail/ihhhlojeadcmjhiefmkjifpaeokkkjed)
 · works in Edge too · or [load it unpacked](#install-unpacked) from this repo

---

## Why this exists

Every send-to-Kindle extension on the Chrome Web Store, measured 28 October 2026:

| Extension | Users | Rating | Last update |
|---|---|---|---|
| Send to Kindle for Google Chrome™ | **500 000** | **2.1** | January 2024 (22 months) |
| Push to Kindle (FiveFilters) | 50 000 | 4.5 (428 ratings) | April 2023 (42 months) |
| Send Web to Kindle | 4 000 | 5.0 (94 ratings) | October 2026 |
| Send to Kindle (third-party) | 2 000 | 4.7 (15 ratings) | March 2023 |
| to kindle | 437 | 4.4 (7 ratings) | October 2026 |
| 15 others, nearly all published in 2026 | 0 – 60 | too few ratings to read | 2026 |

Half a million people use a 2.1-star extension that has not shipped in nearly two
years. The category baseline is **4.18**, so that 2.1 is a broken product, not a
hard category — and the best-liked alternative has been dormant for three and a
half years.

The last row is the honest part: fifteen extensions entered this space in 2026
and sit between zero and sixty users. A clean listing is not distribution, and
this project has no illusions about being the exception by default.

## What the complaints actually say

Gathered from the Firefox add-on review API and vendor forums, not guessed.

| Complaint | Source | What KindlePress does |
|---|---|---|
| "Switching off the free plan, moving to paid-only" | Push to Kindle, 1★ | No server, so no metering. Unlimited by construction. |
| "No free option for light users" | KTool, 2★ | Same. |
| "Doesn't work behind a university proxy and paywall" | Push to Kindle, 1★ | Reads the live DOM in your session, so proxies, logins and pop-up paywalls apply. See the limitation on hard paywalls below. |
| "Requires 'read all content on all pages' when it just forwards a URL" | Push to Kindle, 1★ | `activeTab` only — access is granted for one click, on one tab. No host permissions. |
| "Nothing appeared on my Kindle. Complete silence." | Push to Kindle, 1★ | Every failure names its cause; images that could not be fetched are counted on screen. |
| "Breaks Persian, flips right-to-left into left-to-right" | Push to Kindle, 2★ | Direction detected from the document, falling back to script analysis, and written to `<html dir>`. |
| "Footnotes don't work" | Push to Kindle, 4★ | In-page references become EPUB endnotes with working backlinks. |
| "Book advertisements inside the add-on" | Push to Kindle, 1★ | Nothing is promoted. |
| "Spins forever", "no text fields", broken formatting on JS-heavy pages | Amazon Send to Kindle | Extraction runs after the page's JavaScript, on a clone of the live DOM. |

Readability's own documented weaknesses are handled in a pre-pass: lazy-loaded
images that never got a real `src`, data tables dropped because a class name
looked like layout, and overlays counted as content.

Two more were found by testing against live sites rather than fixtures, and
both would have shipped as "the images are missing":

- **Readability selects one top candidate**, so on component-based layouts the
  figures — which sit in sibling containers — are never picked up. Measured on
  science.nasa.gov: the article body holds two images and extraction returned
  zero, *with every cleaning pass disabled*. A post-pass now walks back to the
  source region the extracted text came from and re-inserts its figures in
  place, skipping anything in nav/header/footer or smaller than 120px.
- **`credentials: "include"` is incompatible with `Access-Control-Allow-Origin: *`.**
  Asking for credentials to support images behind a login silently broke every
  public CDN, which is the common case. Credentials mode is now chosen per URL
  — same-origin first for authenticated images, anonymous first for everything
  else — with the other as fallback.

## Design decision: no server

Every paid competitor runs a backend, which is exactly why they all meter —
FiveFilters sells 10 free credits then $2/month, KTool sells a subscription,
Kindlesuite sells credit packs. Building the EPUB in the browser costs nothing
per article, so it can be free and unlimited forever. It is the one advantage a
funded competitor cannot copy without breaking its own economics.

The trade-off is honest: delivery is one extra step. KindlePress writes the EPUB
to your downloads folder and opens Amazon's uploader; the metered services send
it for you.

## Architecture

```
manifest.json          MV3, permissions: activeTab, scripting, downloads
vendor/Readability.js  Mozilla, Apache-2.0, unmodified
src/extract.js         injected on click — pre-pass, Readability, post-pass, images
src/epub.js            EPUB 3 package (OPF, nav, XHTML, CSS)
src/zip.js             store-only ZIP writer, no dependency
src/popup.*            UI
test/                  smoke tests, see below
```

Two details worth knowing:

- Extraction results cross into the extension as JSON, so image bytes travel as
  base64 and are decoded in the popup.
- The article body is serialized through `XMLSerializer`, because an EPUB is XML
  and readers reject malformed XHTML.

## Install (unpacked)
<a id="install-unpacked"></a>

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

Works in Edge the same way via `edge://extensions` — same Chromium engine, no
code change.

## Tests

```bash
python3 test/serve.py
```

- `http://localhost:8777/test/harness.html` — 25 assertions over one synthetic
  page covering every repair listed above (paywall removal, data tables,
  footnotes, lazy images, srcset, link absolutisation, XML well-formedness, EPUB
  structure, manifest/zip consistency, image references).
- `http://localhost:8777/test/real.html` — extraction against six real pages
  (English/French/Arabic Wikipedia, MDN, Project Gutenberg, Hacker News).
- `http://localhost:8777/test/live.html` — extraction against twenty live sites,
  fetched through the test server's proxy. Note what this does and does not
  prove: the proxy fetches URLs server-side, which the extension never does, so
  a site that blocks server-side clients reports as `unreachable` rather than as
  an extraction failure. Those same pages extract fine in the browser, where the
  DOM is already rendered.
- `http://localhost:8777/test/popup-preview.html` — the four popup states in both
  themes.

The real-page run writes each EPUB it builds to `test/out/`, then:

```bash
python3 test/validate_epub.py
```

checks them against the EPUB 3 rules that decide whether a reader accepts a
file: mimetype stored first and uncompressed with no extra field, container and
rootfile, OPF namespace and version, required Dublin Core metadata, a
`dcterms:modified` in the exact `CCYY-MM-DDThh:mm:ssZ` form, unique manifest ids,
every manifest href present in the archive, exactly one `properties="nav"` item,
spine idrefs resolving, every content file parsing as XML, and every resource a
page references being both in the archive and declared in the manifest.

This is not epubcheck — that needs a JRE, which is not installed here — but it
covers the structural rules epubcheck enforces.

Last run, 28 October 2026: 25/25 assertions, 6/6 real pages clean, 26/26 EPUBs
valid, RTL correctly detected on Arabic and Hebrew Wikipedia, images embedded
with intact bytes and captions. Live sweep: 15 good, 2 weak, 0 broken, 3
unreachable. The two weak are honest — lemonde.fr returns a bot challenge to the
test proxy, and the Hacker News case is a 21-word comment.

## Known limitations

Stated plainly rather than discovered later:

- **Delivery is manual.** The EPUB lands in your downloads folder and Amazon's
  uploader opens; you drop the file. Automating this would need a server or a
  restricted Gmail scope, and both would reintroduce the metering this exists to
  avoid.
- **Hard paywalls stay paywalled.** Reading the live DOM beats re-fetching the
  URL from a server — a server fetch of lemonde.fr returns a bot-challenge page,
  while the browser sees the real article. But where the paywall is enforced
  server-side the text was never sent: measured on lemonde.fr, the DOM contains
  the first 204 words and then *"Il vous reste 83.83% de cet article à lire"*.
  No browser-side tool can recover the rest. Pop-up and overlay paywalls, which
  do send the text and hide it, are a different case and work fine.
- **Cross-origin images without CORS headers are skipped**, not silently broken.
  The popup tells you how many.
- **Readability still fails on pages that are not articles** — dashboards,
  galleries, comparison pages. Selecting the text you want is the fallback.
- No Firefox build yet; the manifest is MV3-only.
- Not tested on a physical Kindle. The EPUB validates structurally and parses as
  XML, which is necessary but not sufficient.

## Licence

KindlePress is MIT licensed — see [LICENSE](LICENSE). Readability.js is
Mozilla's, Apache-2.0, in `vendor/` with its licence intact.

## Verifying the privacy claim

The claim is that nothing leaves your browser. You do not have to take that on
faith, and you do not have to read all of it:

- `manifest.json` lists three permissions and no `host_permissions`. There is no
  entry granting access to a site you have not clicked on.
- There is no background service worker, so no code runs when you are not using
  it.
- Grep the whole tree for network calls: `grep -rn "fetch(\|XMLHttpRequest\|sendBeacon" src/`.
  The only hits are in `src/extract.js`, fetching images from the page you are
  reading so they can be embedded in the EPUB.
- Or watch it yourself: open DevTools on the popup, click the icon, and look at
  the Network tab.

There is no analytics, no telemetry, no error reporting, and no remote
configuration.
