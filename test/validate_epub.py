"""EPUB 3 conformance checks, Python stdlib only.

This is not epubcheck (which needs a JRE this machine does not have). It covers
the OCF and Package rules that actually decide whether a reader accepts a file:
container structure, the mimetype entry's storage method and position, OPF
well-formedness and required metadata, manifest/spine integrity, the navigation
document, XML validity of every content file, and whether every resource a page
references is really in the archive.

Usage:  python3 test/validate_epub.py [directory]
"""

import os
import re
import struct
import sys
import zipfile
from xml.dom import minidom

OPF_NS = "http://www.idpf.org/2007/opf"
DC_NS = "http://purl.org/dc/elements/1.1/"
CONTAINER_NS = "urn:oasis:names:tc:opendocument:xmlns:container"
OPS_NS = "http://www.idpf.org/2007/ops"
XHTML_NS = "http://www.w3.org/1999/xhtml"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


class Report:
    def __init__(self, name):
        self.name = name
        self.errors = []
        self.warnings = []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def check(self, cond, msg):
        if not cond:
            self.err(msg)
        return cond


def first_entry_raw(path):
    """Read the first local file header directly: name, compression method."""
    with open(path, "rb") as f:
        head = f.read(30)
        if len(head) < 30 or head[:4] != b"PK\x03\x04":
            return None, None, None
        method = struct.unpack("<H", head[8:10])[0]
        name_len = struct.unpack("<H", head[26:28])[0]
        extra_len = struct.unpack("<H", head[28:30])[0]
        name = f.read(name_len).decode("utf-8", "replace")
        return name, method, extra_len


def parse_xml(data, rep, label):
    try:
        return minidom.parseString(data)
    except Exception as e:
        rep.err(f"{label}: not well-formed XML ({e})")
        return None


def validate(path):
    rep = Report(os.path.basename(path))

    name, method, extra_len = first_entry_raw(path)
    rep.check(name == "mimetype", f"first zip entry must be 'mimetype', found {name!r}")
    rep.check(method == 0, f"mimetype must be stored uncompressed (method 0), found {method}")
    rep.check(extra_len == 0, f"mimetype local header must carry no extra field, found {extra_len} bytes")

    try:
        z = zipfile.ZipFile(path)
    except Exception as e:
        rep.err(f"not a readable zip: {e}")
        return rep

    bad = z.testzip()
    rep.check(bad is None, f"corrupt entry: {bad}")

    names = set(z.namelist())
    rep.check(
        z.read("mimetype").decode() == "application/epub+zip"
        if "mimetype" in names
        else False,
        "mimetype content must be exactly 'application/epub+zip'",
    )

    if not rep.check("META-INF/container.xml" in names, "META-INF/container.xml missing"):
        return rep

    cdoc = parse_xml(z.read("META-INF/container.xml"), rep, "container.xml")
    if cdoc is None:
        return rep
    roots = cdoc.getElementsByTagNameNS(CONTAINER_NS, "rootfile")
    if not rep.check(len(roots) >= 1, "container.xml declares no rootfile"):
        return rep
    opf_path = roots[0].getAttribute("full-path")
    rep.check(
        roots[0].getAttribute("media-type") == "application/oebps-package+xml",
        "rootfile media-type must be application/oebps-package+xml",
    )
    if not rep.check(opf_path in names, f"rootfile {opf_path!r} is not in the archive"):
        return rep

    odoc = parse_xml(z.read(opf_path), rep, opf_path)
    if odoc is None:
        return rep
    pkg = odoc.documentElement
    rep.check(pkg.namespaceURI == OPF_NS, "package element is not in the OPF namespace")
    rep.check(pkg.getAttribute("version") == "3.0", "package version must be '3.0'")

    # Required metadata.
    def dc(tag):
        return odoc.getElementsByTagNameNS(DC_NS, tag)

    rep.check(len(dc("title")) >= 1, "dc:title missing")
    rep.check(len(dc("language")) >= 1, "dc:language missing")
    ids = dc("identifier")
    rep.check(len(ids) >= 1, "dc:identifier missing")

    uid = pkg.getAttribute("unique-identifier")
    rep.check(bool(uid), "package@unique-identifier missing")
    rep.check(
        any(i.getAttribute("id") == uid for i in ids),
        f"unique-identifier {uid!r} matches no dc:identifier id",
    )

    modified = [
        m
        for m in odoc.getElementsByTagNameNS(OPF_NS, "meta")
        if m.getAttribute("property") == "dcterms:modified"
    ]
    if rep.check(len(modified) == 1, "exactly one meta dcterms:modified is required"):
        val = modified[0].firstChild.data.strip() if modified[0].firstChild else ""
        rep.check(
            bool(DATE_RE.match(val)),
            f"dcterms:modified must be CCYY-MM-DDThh:mm:ssZ, found {val!r}",
        )

    base = os.path.dirname(opf_path)
    resolve = lambda href: os.path.normpath(os.path.join(base, href)).replace(os.sep, "/")

    items = odoc.getElementsByTagNameNS(OPF_NS, "item")
    by_id, hrefs, nav_items = {}, set(), []
    for it in items:
        iid, href = it.getAttribute("id"), it.getAttribute("href")
        rep.check(iid not in by_id, f"duplicate manifest item id {iid!r}")
        by_id[iid] = it
        rep.check(bool(it.getAttribute("media-type")), f"item {iid!r} has no media-type")
        if href.startswith(("http://", "https://")):
            rep.warn(f"remote resource in manifest: {href}")
            continue
        full = resolve(href)
        hrefs.add(full)
        rep.check(full in names, f"manifest item {href!r} is not in the archive")
        if "nav" in it.getAttribute("properties").split():
            nav_items.append(full)

    rep.check(len(nav_items) == 1, f"exactly one item must declare properties='nav', found {len(nav_items)}")

    refs = odoc.getElementsByTagNameNS(OPF_NS, "itemref")
    rep.check(len(refs) >= 1, "spine is empty")
    for r in refs:
        idref = r.getAttribute("idref")
        rep.check(idref in by_id, f"spine itemref {idref!r} matches no manifest item")

    # Every XHTML file must be valid XML, and everything it points at must exist.
    for n in sorted(names):
        if not n.endswith((".xhtml", ".html")):
            continue
        d = parse_xml(z.read(n), rep, n)
        if d is None:
            continue
        page_base = os.path.dirname(n)
        for tag, attr in (("img", "src"), ("link", "href"), ("image", "href")):
            for el in d.getElementsByTagName(tag):
                v = el.getAttribute(attr) or el.getAttribute("xlink:href")
                if not v or v.startswith(("http://", "https://", "data:", "#")):
                    continue
                target = os.path.normpath(os.path.join(page_base, v)).replace(os.sep, "/")
                rep.check(target in names, f"{n}: references missing resource {v!r}")
                if target in names and target not in hrefs and target != opf_path:
                    rep.err(f"{n}: {v!r} is in the archive but absent from the OPF manifest")

    if nav_items:
        nav = parse_xml(z.read(nav_items[0]), rep, nav_items[0])
        if nav:
            toc = [
                e
                for e in nav.getElementsByTagNameNS(XHTML_NS, "nav")
                if e.getAttributeNS(OPS_NS, "type") == "toc"
                or e.getAttribute("epub:type") == "toc"
            ]
            rep.check(len(toc) >= 1, "navigation document has no nav with epub:type='toc'")

    return rep


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out")
    files = sorted(f for f in os.listdir(d) if f.endswith(".epub"))
    if not files:
        print(f"no .epub files in {d}")
        return 1
    total_err = 0
    print(f"{'file':<28}{'size':>9}  result")
    print("-" * 70)
    for f in files:
        rep = validate(os.path.join(d, f))
        size = os.path.getsize(os.path.join(d, f))
        total_err += len(rep.errors)
        status = "OK" if not rep.errors else f"{len(rep.errors)} ERROR(S)"
        if rep.warnings and not rep.errors:
            status += f"  ({len(rep.warnings)} warning)"
        print(f"{f:<28}{size:>9,}  {status}")
        for e in rep.errors:
            print(f"    ERROR   {e}")
        for w in rep.warnings:
            print(f"    warning {w}")
    print("-" * 70)
    print("ALL VALID" if total_err == 0 else f"{total_err} error(s) across {len(files)} file(s)")
    return 0 if total_err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
