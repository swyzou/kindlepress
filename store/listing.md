# Chrome Web Store — dossier de soumission

Tout est prêt à copier-coller. Les champs sont dans l'ordre du formulaire.

---

## Onglet « Store listing »

**Name**
```
KindlePress — Send articles to Kindle
```

**Summary** (132 caractères max — celui-ci en fait 109)
```
Turn any web page into a clean EPUB for your Kindle. Unlimited, free, no account, nothing leaves your browser.
```

**Description**
```
KindlePress turns the article you are reading into a clean EPUB you can read on your Kindle.

Click the icon. It reads the page, keeps what matters, and hands you the file. That is the whole product.

UNLIMITED, BECAUSE THERE IS NO SERVER

Every other send-to-Kindle tool runs a backend, which is why they all meter you: credits that run out, trials that expire, subscriptions. KindlePress builds the EPUB inside your browser. Nothing is sent anywhere, nothing costs anything per article, so there is nothing to meter. Free is not an introductory offer here — it is a consequence of how it is built.

NO ACCOUNT, NO SITE PERMISSIONS

There is no service to sign up for. And KindlePress asks for no access to any website: it uses Chrome's activeTab permission, which grants access to one tab, for one click, only when you ask. You can check this yourself in the permissions list — there are three, and none of them is "read your data on all websites".

IT KEEPS WHAT THE OTHERS DROP

- Images, including lazy-loaded ones and figures that most readers miss entirely
- Data tables, instead of mistaking them for page layout
- Footnotes, rebuilt as proper endnotes with links that work both ways
- Right-to-left text — Arabic, Hebrew and Persian keep their direction
- Pages you are logged into, university proxies, and pop-up paywalls, because it reads the window you are looking at

WHAT IT CANNOT DO

Where a site enforces a hard paywall on its server, the text was never sent to your browser, so nothing running in your browser can recover it. KindlePress will tell you it only found part of the article rather than silently producing a stub.

Images on servers that refuse cross-origin requests are skipped, and the panel tells you how many.

HOW IT WORKS

1. Open an article
2. Click the KindlePress icon
3. Download EPUB
4. Drop the file on Amazon's Send to Kindle page, or email it to your @kindle.com address

Article extraction uses Mozilla's Readability, the engine behind Firefox Reader View, with fixes on top for images, tables and footnotes.
```

**Category** → `Productivity`
**Language** → `English`

---

## Onglet « Privacy »

**Single purpose** (une seule phrase, c'est ce qu'ils vérifient)
```
Convert the web page the user is currently viewing into an EPUB file they can download and read on an e-reader.
```

**Permission justifications**

`activeTab`
```
Reads the article from the tab the user is on, only when they click the extension icon. This is used instead of host permissions so the extension never has standing access to any website.
```

`scripting`
```
Injects the article extraction script into the current tab on that click, to read the rendered article text and images.
```

`downloads`
```
Saves the generated EPUB file to the user's downloads folder.
```

**Data usage** — cocher **aucune** case de collecte, puis les trois certifications :
- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** → voir `privacy.md`, à héberger (GitHub Pages ou Gist public)

---

## Fichiers à téléverser

| Champ | Fichier |
|---|---|
| Package | `kindlepress.zip` (à la racine du projet) |
| Store icon 128×128 | `icons/icon128.png` |
| Screenshots 1280×800 | `store/screenshot-1.png`, `-2.png`, `-3.png` |

---

## Microsoft Edge Add-ons

Même paquet, même textes. Partner Center, inscription gratuite, aucun frais.
Edge accepte le ZIP Chrome sans modification — même moteur Chromium.
