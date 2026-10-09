#!/usr/bin/env bash
# 毎日の更新を1コマンドで行う。
#   tools/update.sh <元テキスト> --date 2026-10-10 --shop 森森買取 [--cat ポケカBOX] [--append]
# 1) 通常価格ではない欄（ホムラプレミアム等）が混ざっていないか確認
# 2) 元テキストを data/raw/<日付>_<店>[_ポケカ][_p2].txt に保存
# 3) 取り込み → ページ生成 → WordPress 用データ書き出し → 整合性チェック
# 読み取り結果の確認だけなら --dry-run。別枠の語があっても進めるなら --force。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SRC=""; DATE=""; SHOP=""; CAT="iPhone"; APPEND=""; DRY=""; FORCE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --date) DATE="$2"; shift 2 ;;
    --shop) SHOP="$2"; shift 2 ;;
    --cat) CAT="$2"; shift 2 ;;
    --append) APPEND="--append"; shift ;;
    --dry-run) DRY=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n 2,7p "$0"; exit 0 ;;
    *) SRC="$1"; shift ;;
  esac
done
[ -n "$SRC" ] && [ -n "$DATE" ] && [ -n "$SHOP" ] || { echo "使い方: tools/update.sh <元テキスト> --date YYYY-MM-DD --shop 店名 [--cat ポケカBOX] [--append]" >&2; exit 2; }
[ -f "$SRC" ] || { echo "元テキストがありません: $SRC" >&2; exit 2; }
[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--date は YYYY-MM-DD で指定してください: $DATE" >&2; exit 2; }
grep -q "\"$SHOP\":" assets/data.js || { echo "店 \"$SHOP\" が assets/data.js の SHOPS にありません。先に登録してください。" >&2; exit 2; }
[ "$CAT" = "iPhone" ] || [ "$CAT" = "ポケカBOX" ] || { echo "--cat は iPhone か ポケカBOX です: $CAT" >&2; exit 2; }

# 1) 別枠の価格が混ざっていないか（保存する前に見る）
SPECIAL='ホムラ|プレミアム買取|会員限定|限定価格|キャンペーン価格|まとめ売り'
if grep -nE "$SPECIAL" "$SRC" >/dev/null; then
  echo "△ 通常価格ではない欄らしい語が含まれています:"
  grep -nE "$SPECIAL" "$SRC" | head -10
  if [ -z "$FORCE" ]; then
    echo "その欄を元テキストから除いてから実行するか、通常価格だと確認できたら --force を付けてください。" >&2; exit 3
  fi
fi

# 2) 元テキストを保存
RAW="data/raw/${DATE}_${SHOP}"
[ "$CAT" = "iPhone" ] || RAW="${RAW}_ポケカ"
if [ -n "$APPEND" ]; then
  n=2; while [ -f "${RAW}_p${n}.txt" ]; do n=$((n+1)); done; RAW="${RAW}_p${n}"
fi
RAW="${RAW}.txt"
if [ "$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")" != "$ROOT/$RAW" ]; then
  if [ -f "$RAW" ] && [ -z "$FORCE" ]; then
    echo "すでに $RAW があります。同じ日・同じ店を取り直すなら --force、2ページ目なら --append を付けてください。" >&2; exit 2
  fi
  mkdir -p data/raw; cp "$SRC" "$RAW"
fi
echo "元テキスト: $RAW（$(wc -l < "$RAW") 行）"

# 3) 取り込み → 生成 → 書き出し → チェック
if [ -n "$DRY" ]; then
  echo "（--dry-run のため取り込みません。読み取り結果の確認だけ行います）"
  cp assets/history.js "$ROOT/.history.bak"
  python3 tools/import_kaitori.py "$RAW" --date "$DATE" --shop "$SHOP" --cat "$CAT" $APPEND || { mv "$ROOT/.history.bak" assets/history.js; exit 1; }
  mv "$ROOT/.history.bak" assets/history.js
  exit 0
fi
python3 tools/import_kaitori.py "$RAW" --date "$DATE" --shop "$SHOP" --cat "$CAT" $APPEND
node tools/make_pages.js
node tools/export_wp.js
echo "--- 整合性チェック"
node tools/check.js || true
echo "--- 変更されたファイル（git add -A && git commit で確定）"
git status --short
echo "コミット例: git add -A && git commit -m \"Import $SHOP $DATE ($CAT)\""
