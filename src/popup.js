import { buildEpub, safeName } from "./epub.js";

const $ = (id) => document.getElementById(id);
const statusBox = $("status");
const statusText = $("status-text");

let current = null; // { article, epub }

function setStatus(text, kind = "working") {
  statusBox.hidden = false;
  statusBox.className = `status ${kind}`;
  statusText.textContent = text;
}

function fail(message) {
  statusBox.hidden = true;
  $("preview").hidden = true;
  $("actions").hidden = true;
  $("failure").hidden = false;
  $("failure-text").textContent = message;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function run() {
  $("failure").hidden = true;
  $("preview").hidden = true;
  $("actions").hidden = true;
  setStatus("Reading this page…");

  const tab = await activeTab();
  if (!tab || !tab.id) return fail("No active tab.");
  if (!/^https?:/.test(tab.url || "")) {
    return fail("This page cannot be captured. Open a normal web page and try again.");
  }

  const includeImages = $("images").checked;

  let result;
  try {
    // activeTab grants access only for this click, on this tab — the reason
    // this extension asks for no site permissions at all.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["vendor/Readability.js", "src/extract.js"],
    });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (opts) => globalThis.__kpExtract(opts),
      args: [{ includeImages }],
    });
    result = res && res.result;
  } catch (e) {
    return fail(
      "Chrome blocked access to this page. Browser pages and the Web Store cannot be captured."
    );
  }

  if (!result) return fail("Extraction returned nothing. Reload the page and try again.");
  if (!result.ok) return fail(result.message || "Could not find an article on this page.");

  setStatus("Building EPUB…");

  let epub;
  try {
    epub = await buildEpub({
      ...result,
      images: (result.images || []).map((im) => ({ ...im, bytes: b64ToBytes(im.b64) })),
    });
  } catch (e) {
    return fail("Could not assemble the EPUB: " + (e && e.message ? e.message : "unknown error"));
  }

  current = { article: result, epub };
  render(result, epub);
}

function render(a, epub) {
  const s = a.stats || {};
  $("title").textContent = a.title;
  $("title").setAttribute("dir", a.dir === "rtl" ? "rtl" : "ltr");
  $("byline").textContent = [a.author, a.published].filter(Boolean).join(" · ") || a.url;

  const facts = [];
  facts.push({ text: `${s.words.toLocaleString()} words` });
  facts.push({ text: `~${s.readingTime} min` });
  facts.push({ text: `${Math.round(epub.blob.size / 1024)} KB` });
  if (s.imagesEmbedded) facts.push({ text: `${s.imagesEmbedded} images` });
  if (s.imagesSkipped) facts.push({ text: `${s.imagesSkipped} images unreachable`, warn: true });
  if (s.notes) facts.push({ text: `${s.notes} notes` });
  if (a.dir === "rtl") facts.push({ text: "RTL" });
  if (s.usedSelection) facts.push({ text: "from your selection", warn: true });

  $("facts").replaceChildren(
    ...facts.map((f) => {
      const li = document.createElement("li");
      li.textContent = f.text;
      if (f.warn) li.className = "warn";
      return li;
    })
  );

  statusBox.hidden = true;
  $("preview").hidden = false;
  $("actions").hidden = false;
  $("hint").textContent = "Drop the file on Amazon's uploader, or email it to your Kindle address.";
}

$("download").addEventListener("click", async () => {
  if (!current) return;
  const url = URL.createObjectURL(current.epub.blob);
  try {
    await chrome.downloads.download({ url, filename: current.epub.filename, saveAs: false });
    $("hint").textContent = "Saved to your downloads folder.";
  } catch (e) {
    $("hint").textContent = "Download failed: " + (e && e.message ? e.message : "unknown error");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
});

$("send").addEventListener("click", async () => {
  if (!current) return;
  const url = URL.createObjectURL(current.epub.blob);
  try {
    await chrome.downloads.download({ url, filename: current.epub.filename, saveAs: false });
  } catch {
    /* the uploader is still useful if the file is already saved */
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  await chrome.tabs.create({ url: "https://www.amazon.com/sendtokindle" });
  window.close();
});

$("retry").addEventListener("click", run);
$("images").addEventListener("change", run);

run();
