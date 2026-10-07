#!/usr/bin/env python3
"""買取店の価格リスト（コピペしたテキスト）を読み取り、assets/history.js に追記する。

使い方:
  python3 tools/import_kaitori.py data/raw/2026-10-07_買取一丁目.txt --date 2026-10-07 --shop 買取一丁目

同じ日付・同じ店のデータがあれば上書きする（1日に何度送っても最新の1件になる）。
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HISTORY = ROOT / "assets" / "history.js"
HEADER = "// 自動生成ファイル（tools/import_kaitori.py が更新します。手で編集しないでください）\nconst SNAPSHOTS = "

SKIP = {"強化", "新品", "買取強化中"}
PRICE_RE = re.compile(r"^[¥￥]\s*([\d,]+)")


def norm(s):
    return re.sub(r"\s+", " ", s.replace("　", " ")).strip()


def parse(text):
    lines = [norm(l) for l in text.splitlines()]
    items = {}
    i = 0
    while i < len(lines):
        if lines[i] != "新品":
            i += 1
            continue
        # 「新品」の直前の行が商品名
        j = i - 1
        while j >= 0 and (not lines[j] or lines[j] in SKIP):
            j -= 1
        name = lines[j] if j >= 0 else None
        boost = any(lines[k] == "強化" for k in range(max(0, j - 3), j))
        # 「新品」から「未開封」までが色による減額のメモ
        notes, i = [], i + 1
        while i < len(lines) and lines[i] != "未開封":
            if lines[i]:
                notes.append(lines[i])
            i += 1
        item = {"note": " / ".join(notes), "boost": boost}
        # 未開封・開封済未使用の価格
        key = None
        while i < len(lines) and lines[i] != "新品":
            line = lines[i]
            if line == "未開封":
                key = "sealed"
            elif line.startswith("開封済"):
                key = "opened"
            else:
                m = PRICE_RE.match(line)
                if m and key:
                    item[key] = int(m.group(1).replace(",", ""))
                    key = None
            i += 1
        if name and ("opened" in item or "sealed" in item):
            items[name] = item
    return items


def load():
    if not HISTORY.exists():
        return []
    body = HISTORY.read_text(encoding="utf-8")
    return json.loads(body[body.index("[") : body.rindex("]") + 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", help="コピペしたテキストファイル（- で標準入力）")
    ap.add_argument("--date", required=True, help="価格の日付 YYYY-MM-DD")
    ap.add_argument("--shop", required=True, help="買取店の名前")
    ap.add_argument("--cat", default="iPhone", help="カテゴリ（iPhone / ポケカBOX）")
    args = ap.parse_args()

    text = sys.stdin.read() if args.file == "-" else Path(args.file).read_text(encoding="utf-8")
    items = parse(text)
    if not items:
        sys.exit("商品が1件も読み取れませんでした。テキストの形式を確認してください。")

    snaps = [s for s in load() if not (s["date"] == args.date and s["shop"] == args.shop and s["cat"] == args.cat)]
    snaps.append({"date": args.date, "shop": args.shop, "cat": args.cat, "items": items})
    snaps.sort(key=lambda s: (s["date"], s["cat"], s["shop"]))
    HISTORY.write_text(HEADER + json.dumps(snaps, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")

    print(f"{args.date} {args.shop}（{args.cat}）: {len(items)}件を取り込みました")
    for name, it in items.items():
        print(f"  {name}: 未開封 {it.get('sealed', '-')}  {it['note']}")


if __name__ == "__main__":
    main()
