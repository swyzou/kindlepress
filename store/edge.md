# Microsoft Edge Add-ons — dossier de soumission

Même paquet que Chrome, aucune modification de code : Edge accepte le ZIP MV3
tel quel. Inscription gratuite, aucun frais, jamais.

Assets prêts dans ce dossier :

| Champ Edge | Fichier | Taille |
|---|---|---|
| Extension logo (requis) | `edge-logo-300.png` | 300 × 300 |
| Small promotional tile | `edge-tile-small.png` | 440 × 280 |
| Large promotional tile | `edge-tile-large.png` | 1400 × 560 |
| Screenshots (max 6) | `screenshot-1/2/3.png` | 1280 × 800 — taille acceptée par Edge, rien à refaire |
| Package | `../../kindlepress.zip` | v0.1.2 |

Le logo et les tuiles se régénèrent depuis `icon.html` et `tile.html` ; les
commandes exactes sont en commentaire en tête de `tile.html`.

---

## Étape 1 — Compte Partner Center

<https://partner.microsoft.com/dashboard/microsoftedge/public/login>

Connexion avec le compte Microsoft **forgesport.pro@outlook.com** (un compte
Outlook est un MSA valide, c'est exactement ce qu'ils demandent).

Deux champs sont **définitifs**, ils ne peuvent plus être changés ensuite :

- **Account country/region** → `France`
- **Account type** → **Individual**

  Surtout pas « Company » : la vérification y dure de quelques jours à
  plusieurs semaines, avec appels téléphoniques d'un partenaire de
  vérification, et il faut une raison sociale enregistrée. « Individual »
  vérifie seulement que le nom d'éditeur est disponible. On ne peut pas
  passer de Company à Individual après coup.

- **Publisher display name** → `SWZconcept` (50 caractères max, cohérent avec
  la fiche Chrome)

Puis accepter le **App Developer Agreement**. La vérification du compte tourne
en arrière-plan ; on peut préparer la soumission pendant ce temps.

---

## Étape 2 — Upload du paquet

« Create new extension » → déposer `kindlepress.zip`.

Le **nom** et la **description courte** sont lus dans le manifest et sont en
lecture seule dans le formulaire — comme sur Chrome. Pour les changer, il faut
réuploader le ZIP.

---

## Étape 3 — Availability

- **Visibility** → `Public`
- **Markets** → laisser **tous les marchés** (défaut). Aucune raison de
  restreindre : le produit est en anglais et fonctionne partout.

---

## Étape 4 — Properties

| Champ | Valeur |
|---|---|
| **Category** | `Productivity` |
| **Website** | `https://github.com/swyzou/kindlepress` |
| **Support contact detail** | `https://github.com/swyzou/kindlepress/issues` |
| **Mature content** | décoché |

---

## Étape 5 — Privacy

**Single Purpose Description**
```
Convert the web page the user is currently viewing into an EPUB file they can download and read on an e-reader.
```

**Permission justification**

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

**Are you using remote code?** → **No, I am not using remote code**

> Vrai et vérifiable : MV3 l'interdit, tout le code est dans le paquet, et le
> seul appel réseau de l'extension récupère les images de la page lue.

**Data usage** → ne cocher **aucune** case de collecte, puis certifier les
déclarations.

**Privacy Policy URL**
```
https://gist.github.com/swyzou/7992662b610a83d389cb076759cb5754
```

---

## Étape 6 — Store listing (en-US)

**Description** — minimum 250 caractères, maximum 10 000. Reprendre mot pour
mot celle de `listing.md` (2 859 caractères), qui annonce la livraison manuelle
dès le deuxième paragraphe et renvoie au dépôt source.

> Ne **pas** utiliser le bouton « Generate with AI ». Il produit un texte
> générique à partir du paquet, et la fiche perd exactement ce qui la
> distingue des quinze autres : les limites énoncées franchement.

**Search terms** — 7 maximum, 30 caractères chacun, 21 mots en tout.
Celles-ci en font 18 :

```
send to kindle
web page to epub
epub converter
article to ebook
save article offline
read later
kindle
```

---

## Étape 7 — Notes for certification

```
This extension has no backend. The EPUB is generated entirely in the browser from the DOM of the active tab, using Mozilla's Readability (vendor/Readability.js, Apache-2.0, unmodified) plus pre- and post-passes for images, tables and footnotes.

How to test:
1. Open any article, for example https://en.wikipedia.org/wiki/EPUB
2. Click the extension icon. The popup extracts the article and shows the title, word count, reading time and file size.
3. Click "Download EPUB". The file is written to the downloads folder.
4. The resulting file is a valid EPUB 3 and opens in any e-reader application.

Permissions: the extension uses activeTab rather than host permissions, so it has no access to any site until the user clicks the icon. There is no background service worker. There is exactly one network call in the codebase, in src/extract.js, which fetches images from the page being read so they can be embedded in the EPUB file. No analytics, no telemetry, no remote configuration.

The full source is public and matches this package: https://github.com/swyzou/kindlepress

Note on a deliberate limitation: where a site enforces a paywall server-side, the article text is never sent to the browser, so the extension reports that it only found part of the article rather than producing a stub. This is stated in the store description.
```

---

## Délais

Certification jusqu'à **7 jours ouvrés** (Chrome avait répondu en moins d'une
journée). Statut « In the Store » une fois acceptée.

## Si ça coince

Les erreurs `correlationId : undefined` dans Partner Center sont un bug connu
de leur interface : vider le cache, ou passer en navigation privée, ou changer
de navigateur. Ce n'est pas un problème du paquet.
