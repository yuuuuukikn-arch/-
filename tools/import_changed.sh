#!/usr/bin/env bash
# data/raw に置かれた元テキストを、ファイル名から店・日付・カテゴリを読み取って取り込む。
# GitHub Actions（.github/workflows/import.yml）が、ファイルが追加・更新されたときに呼ぶ。手で呼んでもよい。
#   tools/import_changed.sh data/raw/2026-10-10_買取一丁目.txt data/raw/2026-10-10_森森買取_ポケカ.txt
# ファイル名の決まり: <日付>_<店名>[_ポケカ][_p2].txt
#   日付は YYYY-MM-DD、店名は assets/data.js の SHOPS と同じ、ポケカBOX の一覧は _ポケカ、2ページ目以降は _p2 _p3 …
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ $# -gt 0 ] || { echo "取り込むファイルがありません"; exit 0; }

fail=0
for f in "$@"; do
  [ -f "$f" ] || { echo "✖ $f がありません"; fail=1; continue; }
  base="$(basename "$f" .txt)"
  append=""; cat="iPhone"
  if [[ "$base" =~ ^(.*)_p([0-9]+)$ ]]; then base="${BASH_REMATCH[1]}"; append="--append"; fi
  if [[ "$base" =~ ^(.*)_ポケカ$ ]]; then base="${BASH_REMATCH[1]}"; cat="ポケカBOX"; fi
  if [[ ! "$base" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})_(.+)$ ]]; then
    echo "✖ $f: ファイル名が <日付>_<店名>[_ポケカ][_p2].txt の形ではありません"; fail=1; continue
  fi
  date="${BASH_REMATCH[1]}"; shop="${BASH_REMATCH[2]}"
  if ! grep -q "\"$shop\":" assets/data.js; then
    echo "✖ $f: 店 \"$shop\" が assets/data.js の SHOPS にありません（買取一丁目 / 買取ホムラ / 買取ルデヤ / 買取商店 / 森森買取）"; fail=1; continue
  fi
  echo "--- $f → $date $shop（$cat）$append"
  python3 tools/import_kaitori.py "$f" --date "$date" --shop "$shop" --cat "$cat" $append || { echo "✖ $f: 読み取れませんでした"; fail=1; }
done

node tools/make_pages.js
node tools/export_wp.js
echo "--- 整合性チェック"
node tools/check.js || fail=1
exit $fail
