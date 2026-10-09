#!/usr/bin/env python3
"""取り込んだ価格の記録を1つ消す（出典が確認できないときなど）。
使い方: python3 tools/remove_snapshot.py --date 2026-10-09 --shop 買取一丁目 [--cat iPhone]
消したあとは node tools/make_pages.js と node tools/export_wp.js を実行する（tools/update.sh と同じ）。
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HISTORY = ROOT / "assets" / "history.js"
HEADER = "// 自動生成ファイル（tools/import_kaitori.py が更新します。手で編集しないでください）\nconst SNAPSHOTS = "


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True)
    ap.add_argument("--shop", required=True)
    ap.add_argument("--cat", default="iPhone", help="iPhone / ポケカBOX")
    args = ap.parse_args()
    body = HISTORY.read_text(encoding="utf-8")
    snaps = json.loads(body[body.index("[") : body.rindex("]") + 1])
    keep = [s for s in snaps if not (s["date"] == args.date and s["shop"] == args.shop and s["cat"] == args.cat)]
    if len(keep) == len(snaps):
        raise SystemExit(f"{args.date} {args.shop}（{args.cat}）の記録はありません")
    HISTORY.write_text(HEADER + json.dumps(keep, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"{args.date} {args.shop}（{args.cat}）: {len(snaps) - len(keep)}件の記録を消しました（残り {len(keep)} 件）")


if __name__ == "__main__":
    main()
