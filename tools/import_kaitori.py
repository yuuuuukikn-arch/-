#!/usr/bin/env python3
"""買取店の価格リスト（コピペしたテキスト）を読み取り、assets/history.js に追記する。

使い方:
  python3 tools/import_kaitori.py data/raw/2026-10-07_買取一丁目.txt --date 2026-10-07 --shop 買取一丁目
  python3 tools/import_kaitori.py data/raw/2026-10-07_買取ルデヤ.txt --date 2026-10-07 --shop 買取ルデヤ
  python3 tools/import_kaitori.py data/raw/2026-10-07_買取商店.txt --date 2026-10-07 --shop 買取商店

対応している書き方:
  - 買取一丁目形式: 商品名 → 新品 → 備考 → 未開封/シュリンク有 → ¥価格
  - 買取ルデヤ形式: 新品 → 「機種 容量 色 型番 未開封 SIMフリー」 → JAN → 買取価格 → 000,000円
    （色ごとの行は機種ごとにまとめ、色別価格 colors と最高値 sealed を保存）
  - 買取商店形式: [機種 容量 色 型番 SIMフリー](URL) → JAN → 新品¥000,000 → 中古¥…
  - 森森買取形式: [Apple iPhone18 Pro 256GB 色 SIMフリー](URL) → JAN → 通常/預かり/即フリの3価格（通常を使う）

同じ日付・同じ店のデータがあれば上書きする（1日に何度送っても最新の1件になる）。
2ページ目以降は --append をつけると、前のページに追加される。
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
    s = re.sub("[‎‏﻿]", "", s.replace("　", " "))
    s = re.sub(r"】\s*", "】 ", s)  # 「【MEGA】メガ…」と「【MEGA】 メガ…」をそろえる
    return re.sub(r"\s+", " ", s).strip()


# 価格の見出し → 保存するキー（備考の「未開封のみ」などと区別するため完全一致で判定）
PRICE_KEYS = {
    "未開封": "sealed",
    "新品未開封": "sealed",
    "シュリンク有": "sealed",
    "シュリンク有り": "sealed",
    "シュリンクなし未開封": "noShrink",
    "シュリンクなし": "noShrink",
    "開封済未使用": "opened",
    "開封済未使用品": "opened",
}


def price_key(line):
    return PRICE_KEYS.get(line)


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
        # 「新品」から最初の価格見出しまでが備考（色による減額・JANなど）
        notes, jan, i = [], None, i + 1
        while i < len(lines) and lines[i] != "新品" and not price_key(lines[i]):
            if lines[i].startswith("JAN"):
                jan = re.sub(r"\D", "", lines[i]) or None
            elif lines[i]:
                notes.append(lines[i])
            i += 1
        item = {"note": " / ".join(notes), "boost": boost}
        if jan:
            item["jan"] = jan
        # 価格（未開封・シュリンク有・シュリンクなし未開封・開封済未使用）
        key = None
        while i < len(lines) and lines[i] != "新品":
            line = lines[i]
            m = PRICE_RE.match(line)
            if m and key:
                item.setdefault(key, int(m.group(1).replace(",", "")))
                key = None
            elif price_key(line):
                key = price_key(line)
            i += 1
        if name and "sealed" in item:
            items[name] = item
    return items


# iPhone の色名（表記ゆれ → 正式名）
COLORS = {
    "バーガンディ": "バーガンディ",
    "ブラック": "ブラック",
    "グレイシャー": "グレイシャー",
    "グレイシャ": "グレイシャー",
    "シルバー": "シルバー",
}
IPHONE18_COLORS = ["バーガンディ", "ブラック", "グレイシャー", "シルバー"]
DASH = "-‐−－–"


def color_prices(name, base, note):
    """一丁目の減額メモ（例: 「ブラック,グレイシャー -20000,シルバー -25000」）から色別価格を出す。
    数字の前に並んだ色はその金額を減額、書かれていない色は満額。読み取れなければ None。"""
    if not name.startswith("iPhone 18") or not note:
        return None
    deduct, pending = {}, []
    note = re.sub(r"(\d),(\d{3})\b", r"\1\2", note)  # 「-13,000」の桁区切りは色の区切りではない
    for tok in re.split(r"[,，、]", note):
        tok = tok.strip()
        m = re.match(rf"^(.*?)\s*[{DASH}]\s*(\d+)$", tok)
        label = (m.group(1) if m else tok).strip()
        if label:
            if label not in COLORS:
                return None
            pending.append(COLORS[label])
        if m:
            for c in pending:
                deduct[c] = int(m.group(2))
            pending = []
    if pending:  # 金額がついていない色が残ったら読み方が不明
        return None
    return {c: base - deduct.get(c, 0) for c in IPHONE18_COLORS}


YEN_RE = re.compile(r"^([\d,]+)\s*円$")
MODEL_RE = re.compile(r"^(iPhone .+? \d+(?:GB|TB)) (\S+) \S+/A\b")


def parse_rudeya(text):
    """買取ルデヤ形式（色ごとに1行）。同じ商品が2回出てきても1回として扱う。"""
    lines = [norm(l) for l in text.splitlines()]
    items = {}
    for i, line in enumerate(lines):
        if line != "新品":
            continue
        full = next((l for l in lines[i + 1 : i + 4] if l), None)
        if not full:
            continue
        price, notes = None, []
        for k in range(i + 2, min(i + 20, len(lines))):
            if lines[k] == "新品":
                break
            if lines[k] == "買取価格":
                m = next((YEN_RE.match(l) for l in lines[k + 1 : k + 3] if YEN_RE.match(l)), None)
                price = int(m.group(1).replace(",", "")) if m else None
                break
            if lines[k].startswith("郵送買取"):
                notes.append(lines[k])
        if price is None:
            continue
        m = MODEL_RE.match(full)
        name, color = (m.group(1), COLORS.get(m.group(2), m.group(2))) if m else (full, None)
        item = items.setdefault(name, {"note": " / ".join(notes), "boost": False})
        if color:
            item.setdefault("colors", {})[color] = price
        item["sealed"] = max(item.get("sealed", 0), price)
    return items


NEW_PRICE_RE = re.compile(r"^新品\s*[¥￥]\s*([\d,]+)")
MD_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def parse_shouten(text):
    """買取商店形式（「[商品名](URL) → JAN → ※条件 → 新品¥000,000 → 中古¥…」）。
    iPhone は「機種 容量 色 型番 SIMフリー」を機種ごとにまとめて色別価格に、
    それ以外（トレカなど）は商品名ごとに JAN と条件（※…）も保存する。"""
    lines = [norm(MD_LINK_RE.sub(r"\1", l)) for l in text.splitlines()]
    items = {}
    for i, line in enumerate(lines):
        nxt = next((l for l in lines[i + 1 : i + 3] if l), "")
        if not line or not nxt.startswith("JAN"):
            continue
        jan = re.sub(r"\D", "", nxt) or None
        price, notes = None, []
        for l in lines[i + 2 : i + 8]:
            pm = NEW_PRICE_RE.match(l)
            if pm:
                price = int(pm.group(1).replace(",", ""))
                break
            if l.startswith("※"):
                notes.append(l)
            if l.startswith("JAN"):
                break
        if price is None:
            continue
        prev = next((l for l in reversed(lines[max(0, i - 3) : i]) if l), "")
        boost = prev.startswith("強化")
        m = MODEL_RE.match(line)
        if m:
            name, color = m.group(1), COLORS.get(m.group(2), m.group(2))
            item = items.setdefault(name, {"note": "", "boost": False})
            item["boost"] = item["boost"] or boost
            item.setdefault("colors", {})[color] = price
            item["sealed"] = max(item.get("sealed", 0), price)
        else:
            item = {"note": " / ".join(notes), "boost": boost, "sealed": price}
            if jan:
                item["jan"] = jan
            items[line] = item
    return items


YEN_LINE_RE = re.compile(r"^([\d,]+)\s*円$")


def parse_morimori(text):
    """森森買取形式（色ごとに「Apple iPhone18 Pro 256GB 色 SIMフリー → JAN → 通常/預かり/即フリの3価格」）。
    使うのは1つ目の「通常買取価格」。"""
    lines = [norm(MD_LINK_RE.sub(r"\1", l)) for l in text.splitlines()]
    items = {}
    for i, line in enumerate(lines):
        name_line = re.sub(r"^Apple\s+", "", line)
        name_line = re.sub(r"^iPhone\s*(\d)", r"iPhone \1", name_line)
        m = re.match(r"^(iPhone .+? \d+(?:GB|TB)) (\S+) SIMフリー", name_line)
        nxt = next((l for l in lines[i + 1 : i + 3] if l), "")
        if not m and not nxt.startswith("JAN"):
            continue
        price = None
        for l in lines[i + 1 : i + 4]:
            pm = YEN_LINE_RE.match(l)
            if pm:
                price = int(pm.group(1).replace(",", ""))
                break
        if price is None:
            continue
        if not m:
            # トレカなど：商品名ごと（JAN で登録済み商品にそろえる）
            item = {"note": "", "boost": False, "sealed": price}
            jan = re.sub(r"\D", "", nxt)
            if jan:
                item["jan"] = jan
            items[line] = item
            continue
        name, color = m.group(1), COLORS.get(m.group(2), m.group(2))
        item = items.setdefault(name, {"note": "", "boost": False})
        item.setdefault("colors", {})[color] = price
        item["sealed"] = max(item.get("sealed", 0), price)
    return items


def parse_ichome_list(text):
    """買取一丁目「商品価格一覧」形式（未開封価格・開封済未使用品価格・価格調整表記）"""
    items = {}
    for block in re.split(r"\n(?=【\d+】)", text):
        m = re.match(r"【\d+】\s*(.+)", block.strip())
        if not m:
            continue
        name = norm(m.group(1))
        note = (re.search(r"価格調整表記[：:]\s*(.+)", block) or [None, ""])[1].strip()
        if note == "記載なし":
            note = ""
        sealed = re.search(r"未開封価格[：:]\s*([\d,]+)\s*円", block)
        if not sealed:
            continue
        price = int(sealed.group(1).replace(",", ""))
        item = {"sealed": price, "note": note, "boost": False}
        colors = color_prices(name, price, note)
        if colors:
            item["colors"] = colors
        items[name] = item
    return items


def parse_ichome_boxes(text):
    """買取一丁目の BOX 一覧（JAN・買取金額（税込）・強化の印）。同じ商品が2回載るので最初の1件だけ使う"""
    lines = [l.strip() for l in text.splitlines()]
    items = {}
    for i, line in enumerate(lines):
        if not re.fullmatch(r"\d{13,15}", line):
            continue
        name = next((lines[j] for j in range(i - 1, -1, -1) if lines[j]), "")
        if not name or name in items:
            continue
        price = None
        boost = False
        for j in range(i + 1, min(i + 12, len(lines))):
            pm = re.search(r"[¥￥]\s*([\d,]+)", lines[j])
            if pm and price is None:
                price = int(pm.group(1).replace(",", ""))
            if lines[j] in ("買取強化", "強化", "強"):
                boost = True
            if re.fullmatch(r"\d{13,15}", lines[j]) and j != i:
                break
        if price is None:
            continue
        items[norm(name)] = {"sealed": price, "jan": line, "boost": boost}
    return items


def parse_ichome_unsealed(text):
    """買取一丁目の「【未開封】iPhone 18 Pro Max 256GB burgundy」形式（色ごとの買取金額）"""
    COLOR_JA = {"burgundy": "バーガンディ", "black": "ブラック", "glacier": "グレイシャー", "silver": "シルバー"}
    lines = [l.strip() for l in text.splitlines()]
    items = {}
    for i, line in enumerate(lines):
        m = re.match(r"【未開封】\s*(iPhone .+?)\s+(\w+)$", line)
        if not m:
            continue
        name, color = m.group(1), COLOR_JA.get(m.group(2).lower(), m.group(2))
        price = None
        for j in range(i + 1, min(i + 6, len(lines))):
            pm = re.search(r"[¥￥]\s*([\d,]+)", lines[j])
            if pm:
                price = int(pm.group(1).replace(",", ""))
                break
        if price is None:
            continue
        item = items.setdefault(name, {"note": "", "boost": False, "colors": {}})
        item["colors"][color] = price
        item["sealed"] = max(item["colors"].values())
    return items


def detect_and_parse(text):
    # 「通常買取価格・預かり買取価格・即フリ買取価格」の見出しがあれば森森買取形式
    # （見出しを含めずにコピーした場合も「Apple iPhone18 …」の商品名で見分ける）
    if "即フリ買取価格" in text or "預かり買取価格" in text or re.search(r"^\s*\[?Apple\s+iPhone\s*\d", text, re.M):
        return parse_morimori(text)
    # 「新品¥000,000」の行がある書き方なら買取商店形式
    if re.search(r"^\s*新品\s*[¥￥]\s*[\d,]+", text, re.M):
        return parse_shouten(text)
    # 「買取価格」の次に「000,000円」が来る書き方ならルデヤ形式
    if re.search(r"買取価格\s*\n\s*[\d,]+\s*円", text):
        return parse_rudeya(text)
    if "商品価格一覧" in text and "未開封価格" in text:
        return parse_ichome_list(text)
    if re.search(r"【未開封】\s*iPhone", text):
        return parse_ichome_unsealed(text)
    if "買取金額（税込）" in text:
        return parse_ichome_boxes(text)
    items = parse(text)
    for name, it in items.items():
        colors = color_prices(name, it["sealed"], it.get("note", ""))
        if colors:
            it["colors"] = colors
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
    ap.add_argument("--append", action="store_true",
                    help="同じ日付・同じ店のデータに追加する（2ページ目以降を取り込むとき）")
    args = ap.parse_args()

    text = sys.stdin.read() if args.file == "-" else Path(args.file).read_text(encoding="utf-8")
    items = detect_and_parse(text)
    if not items:
        sys.exit("商品が1件も読み取れませんでした。テキストの形式を確認してください。")

    # トレカなど店ごとに商品名の書き方が違うものは、JAN が同じ登録済み商品の名前にそろえる。
    # 登録済みの商品と JAN が合わないものは取り込まない（ほかのジャンルの商品が混ざるため）。
    if args.cat != "iPhone" and any("jan" in it for it in items.values()):
        base = lambda j: j[-13:]  # 買取一丁目は先頭に 11 / 12 が付くので、後ろ13桁で比べる
        known = {base(it["jan"]): name for s in load() if s["cat"] == args.cat
                 for name, it in s["items"].items() if it.get("jan")}
        # 記録を消したあとも商品をたどれるように、JAN の一覧（data/jan_master.json）も使う
        master = ROOT / "data" / "jan_master.json"
        if args.cat == "ポケカBOX" and master.exists():
            for j, name in json.loads(master.read_text(encoding="utf-8")).items():
                known.setdefault(j, name)
        if known:
            renamed, skipped = {}, []
            for name, it in items.items():
                if "シュリンク無し" in name:  # JAN の土台が同じでも、別の商品（シュリンク無し）として残す
                    renamed[name] = it
                elif it.get("jan") and base(it["jan"]) in known:
                    renamed[known[base(it["jan"])]] = it
                elif name in known.values():
                    renamed[name] = it
                else:
                    skipped.append(name)
            items = renamed
            if skipped:
                print(f"登録済みの商品と JAN が合わないため取り込まなかったもの: {len(skipped)}件")
                for n in skipped:
                    print(f"  - {n}")
            if not items:
                sys.exit("取り込める商品がありませんでした。")

    same = lambda s: s["date"] == args.date and s["shop"] == args.shop and s["cat"] == args.cat
    if args.append:
        # 前に取り込んだページの商品と合わせる（色別価格はまとめ、最高値を取り直す）
        old = next((s["items"] for s in load() if same(s)), {})
        for name, it in items.items():
            if name in old:
                merged = {**old[name], **it}
                if "colors" in old[name] or "colors" in it:
                    merged["colors"] = {**old[name].get("colors", {}), **it.get("colors", {})}
                    merged["sealed"] = max(merged["colors"].values())
                old[name] = merged
            else:
                old[name] = it
        items = old
    snaps = [s for s in load() if not same(s)]
    snaps.append({"date": args.date, "shop": args.shop, "cat": args.cat, "items": items})
    snaps.sort(key=lambda s: (s["date"], s["cat"], s["shop"]))
    HISTORY.write_text(HEADER + json.dumps(snaps, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")

    print(f"{args.date} {args.shop}（{args.cat}）: {len(items)}件を取り込みました")
    for name, it in items.items():
        extra = f" / シュリンクなし {it['noShrink']:,}" if "noShrink" in it else ""
        if "colors" in it:
            extra += "  [" + ", ".join(f"{c} {p:,}" for c, p in it["colors"].items()) + "]"
        print(f"  {name}: 未開封 {it["sealed"]:,}{extra}  {it.get("note", "")}")


if __name__ == "__main__":
    main()
