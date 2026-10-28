"""Static server for the smoke tests.

Adds two things the tests need:
  - CORS, so the engine can be injected into a third-party page from the console
  - POST /save/<name>, so a test page can write the EPUB it just built to disk
    for the validator to inspect
"""

import functools
import http.server
import os
import re
import socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "test", "out")
SAFE = re.compile(r"^[A-Za-z0-9._-]{1,80}$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        # Edits must show up on the next reload, not after a cache expiry.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        # /proxy?url=... fetches a live page server-side so the test harness can
        # run extraction against real sites without a mixed-content block.
        if self.path.startswith("/proxy?"):
            self.proxy()
            return
        super().do_GET()

    def proxy(self):
        import urllib.parse
        import urllib.request

        qs = urllib.parse.urlparse(self.path).query
        url = urllib.parse.parse_qs(qs).get("url", [""])[0]
        if not url.startswith(("http://", "https://")):
            self.send_error(400, "bad url")
            return
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en,fr;q=0.8",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                body = r.read(6 * 1024 * 1024)
                final = r.geturl()
        except Exception as e:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"error":{e!r}}}'.replace("'", '"').encode())
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("X-Final-Url", final)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.path.startswith("/save/"):
            self.send_error(404)
            return
        name = self.path[len("/save/"):]
        if not SAFE.match(name):
            self.send_error(400, "bad name")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 80 * 1024 * 1024:
            self.send_error(400, "bad length")
            return
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, name)
        with open(path, "wb") as f:
            f.write(self.rfile.read(length))
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"saved {length}\n".encode())


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=ROOT)
    with socketserver.TCPServer(("127.0.0.1", 8777), handler) as httpd:
        print("serving", ROOT, "on 8777")
        httpd.serve_forever()
