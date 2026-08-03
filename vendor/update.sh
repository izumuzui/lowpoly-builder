#!/usr/bin/env bash
# vendor/ に取り込んだ three.js を更新する。
#
# 取り込む理由: CDNのバージョン間でモジュールの置き場所が変わることがあり
# （例: r184で Timer が addons からコアへ移動した）、実行時に壊れるのを避けるため。
#
# 更新したら index.html のimportmapとこのスクリプトのバージョンを揃えること。
set -euo pipefail

THREE_VERSION="0.184.0"
BASE="https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}"
DIR="$(cd "$(dirname "$0")" && pwd)/three"

mkdir -p "$DIR/addons/controls" "$DIR/addons/exporters"

# three.module.js は自己完結ではなく、同階層の three.core.js を読む。
# 両方を並べて置かないと解決できない。
curl -fsSL "$BASE/build/three.module.js" -o "$DIR/three.module.js"
curl -fsSL "$BASE/build/three.core.js" -o "$DIR/three.core.js"
curl -fsSL "$BASE/examples/jsm/controls/OrbitControls.js" -o "$DIR/addons/controls/OrbitControls.js"
curl -fsSL "$BASE/examples/jsm/exporters/GLTFExporter.js" -o "$DIR/addons/exporters/GLTFExporter.js"

echo "three.js ${THREE_VERSION} を取り込みました"
du -sh "$DIR"
