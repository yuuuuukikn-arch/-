#!/usr/bin/env python3
"""data/raw にある元テキストのうち、まだ取り込んでいない（または中身が変わった）ものを取り込む。
GitHub Actions（.github/workflows/import.yml）が呼ぶ。手で呼んでもよい: python3 tools/import_auto.py

- 取り込み済みのファイルとその内容のハッシュを data/raw/.imported.json に記録し、次回はそこと比べる。
  途中で実行が取り消されても、次の実行で残りを拾える。
- ファイル名の決まり: <日付>_<店名>[_ポケカ][_p2].txt（日付 YYYY-MM-DD、店名は assets/data.js の SHOPS と同じ）。
- 同じ日・同じ店・同じカテゴリのファイル（_p2, _p3 …）は 1 つの組として、どれか 1 つでも変われば
  組ごと順番に取り込み直す（2 ページ目以降は --append で前のページに足す）。
- わざと取り込み直したいときは .imported.json からそのファイルの行を消す。取り込みたくないファイルは
  ハッシュを書いておけば飛ばされる。
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RECORD = RAW / ".imported.json"
NAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})_(.+?)(_ポケカ)?(?:_p(\d+))?\.txt$")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def registered_shops():
    text = (ROOT / "assets" / "data.js").read_text(encoding="utf-8")
    block = text[text.index("const SHOPS = {"): text.index("};", text.index("const SHOPS = {"))]
    return set(re.findall(r'^\s*"([^"]+)":\s*\{', block, re.M))


def main():
    record = json.loads(RECORD.read_text(encoding="utf-8")) if RECORD.exists() else {}
    shops = registered_shops()
    groups, bad = {}, []
    for f in sorted(RAW.glob("*.txt")):
        m = NAME_RE.match(f.name)
        if not m:
            bad.append(f"{f.name}: ファイル名が <日付>_<店名>[_ポケカ][_p2].txt の形ではありません")
            continue
        date, shop, poke, page = m.groups()
        groups.setdefault((date, shop, "ポケカBOX" if poke else "iPhone"), []).append((int(page or 1), f))

    fail = bool(bad)
    for b in bad:
        print(f"✖ {b}")
    todo = [k for k, members in groups.items() if any(record.get(f.name) != sha(f) for _, f in members)]
    if not todo:
        print("新しい元テキストはありません")
    for key in sorted(todo):
        date, shop, cat = key
        members = sorted(groups[key])
        names = "、".join(f.name for _, f in members)
        if shop not in shops:
            print(f"✖ {names}: 店 \"{shop}\" が assets/data.js の SHOPS にありません（{' / '.join(sorted(shops))}）")
            fail = True
            continue
        print(f"--- {date} {shop}（{cat}）: {names}")
        ok = True
        for i, (_, f) in enumerate(members):
            cmd = [sys.executable, str(ROOT / "tools" / "import_kaitori.py"), str(f), "--date", date, "--shop", shop, "--cat", cat]
            if i > 0:
                cmd.append("--append")
            if subprocess.run(cmd, cwd=ROOT).returncode != 0:
                print(f"✖ {f.name}: 読み取れませんでした")
                ok = False
                break
        if ok:
            for _, f in members:
                record[f.name] = sha(f)
        else:
            fail = True
    RECORD.write_text(json.dumps(dict(sorted(record.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    for script in ("make_pages.js", "export_wp.js"):
        if subprocess.run(["node", str(ROOT / "tools" / script)], cwd=ROOT).returncode != 0:
            fail = True
    print("--- 整合性チェック")
    if subprocess.run(["node", str(ROOT / "tools" / "check.js")], cwd=ROOT).returncode != 0:
        fail = True
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
