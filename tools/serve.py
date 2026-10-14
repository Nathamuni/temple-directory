#!/usr/bin/env python3
"""Static server for the Temple Directory with caching disabled, so edits always show after a normal reload.
   python3 tools/serve.py [port]   (default 8080; serves the project root)"""
import http.server, sys, functools, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
http.server.ThreadingHTTPServer(("", port), functools.partial(H, directory=str(root))).serve_forever()
