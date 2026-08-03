#!/usr/bin/env python3
"""開発用の静的サーバー。

`python3 -m http.server` はキャッシュ制御ヘッダを送らないため、
ブラウザがESモジュールを使い回して編集が反映されないことがある。
ここではキャッシュを明示的に無効化する。

配信するのは静的ファイルだけなので、本番（GitHub Pages）ではこのスクリプトは使わない。
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    print(f"http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
