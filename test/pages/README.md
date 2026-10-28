# Test fixtures

Saved copies of real pages, kept in the repo so extraction can be tested
offline and so a regression is measured against the same bytes every time.
Each `.url` file records where its `.html` came from.

They are here as test input, unmodified except for being saved. Provenance and
terms:

| Fixture | Source | Terms |
|---|---|---|
| `wikipedia-epub.html` | [en.wikipedia.org/wiki/EPUB](https://en.wikipedia.org/wiki/EPUB) | CC BY-SA 4.0 |
| `wikipedia-fr.html` | [fr.wikipedia.org/wiki/Livre_numérique](https://fr.wikipedia.org/wiki/Livre_num%C3%A9rique) | CC BY-SA 4.0 |
| `wikipedia-ar.html` | [ar.wikipedia.org/wiki/كتاب_إلكتروني](https://ar.wikipedia.org/wiki/%D9%83%D8%AA%D8%A7%D8%A8_%D8%A5%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A) | CC BY-SA 4.0 |
| `mdn-fetch.html` | [MDN, Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) | CC BY-SA 2.5 |
| `nasa.html` | [science.nasa.gov, Curiosity blog](https://science.nasa.gov/blog/curiosity-blog-sols-5036-5042-watching-the-clouds-go-by/) | US Government work, public domain |
| `gutenberg.html` | [Project Gutenberg #1342](https://www.gutenberg.org/ebooks/1342) | Public domain |
| `hn-item.html` | [news.ycombinator.com/item?id=11697644](https://news.ycombinator.com/item?id=11697644) | Comments by their authors; kept as a test input only |
| `with-images.html` | Written for this repo | MIT, same as the project |
| `photo.png` | Generated for this repo | MIT, same as the project |

Why each one is in the set:

- **The three Wikipedias** cover tables, heavy markup and, in Arabic, a
  right-to-left document.
- **MDN** is a documentation layout with code blocks.
- **NASA** is the component-based layout where Readability's single-candidate
  selection loses the figures — the case the image post-pass exists for.
- **Gutenberg** is a plain, old-fashioned page with almost no markup.
- **Hacker News** is a table-based layout that is not an article at all, which
  is the case extraction is expected to decline rather than mangle.

If a fixture needs refreshing, fetch its `.url` again and save the page; do not
hand-edit the HTML, or the test stops measuring what a real page does.
