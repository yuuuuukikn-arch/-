#!/usr/bin/env node
// データの整合性チェック。毎日の更新の最後に実行する（tools/update.sh が自動で呼ぶ）。
// 使い方: node tools/check.js
// 問題があれば一覧を出して終了コード 1、なければ「問題なし」。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const ctx = {};
vm.createContext(ctx);
for (const f of ["assets/data.js", "assets/history.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^const /gm, "var "), ctx);
}
const { SHOPS, CATALOG, SNAPSHOTS, SHOW_ONLY } = ctx;
const shown = (cat, name) => !(SHOW_ONLY && SHOW_ONLY[cat]) || SHOW_ONLY[cat].test(name); // サイトに出る商品だけ定価を見る

const errors = [], warns = [];
const rawDir = path.join(ROOT, "data/raw");
const rawFiles = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter((f) => f.endsWith(".txt")) : [];

for (const s of SNAPSHOTS) {
  const tag = `${s.date} ${s.shop}（${s.cat}）`;
  if (!SHOPS[s.shop]) errors.push(`${tag}: 店 "${s.shop}" が assets/data.js の SHOPS に登録されていません`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors.push(`${tag}: 日付の形式が YYYY-MM-DD ではありません`);
  const prefix = `${s.date}_${s.shop}`;
  const hasRaw = rawFiles.some((f) => f.startsWith(prefix) && (s.cat === "iPhone" ? !f.includes("ポケカ") : f.includes("ポケカ")));
  if (!hasRaw) warns.push(`${tag}: 元テキストが data/raw/${prefix}${s.cat === "iPhone" ? "" : "_ポケカ"}.txt にありません（出典を確認できません）`);
  const unknown = Object.keys(s.items).filter((n) => shown(s.cat, n) && !CATALOG[n]);
  if (unknown.length) warns.push(`${tag}: 定価未登録の商品 ${unknown.length}件（${unknown.slice(0, 3).join("、")}${unknown.length > 3 ? " ほか" : ""}）`);
  for (const [n, it] of Object.entries(s.items)) {
    if (typeof it.sealed !== "number" || it.sealed <= 0) errors.push(`${tag}: ${n} の未開封価格が数値ではありません`);
  }
}

// WordPress 用データが最新の取り込みを含んでいるか
const sedori = path.join(ROOT, "wp-plugin/sedori-hikaku/data/sedori.json");
if (fs.existsSync(sedori)) {
  const j = JSON.parse(fs.readFileSync(sedori, "utf8"));
  const excluded = ["買取商店"]; // tools/export_wp.js の WP_EXCLUDE と同じ
  for (const cat of [...new Set(SNAPSHOTS.map((s) => s.cat))]) {
    const latest = SNAPSHOTS.filter((s) => s.cat === cat && !excluded.includes(s.shop)).map((s) => s.date).sort().pop();
    const wp = (j.categories || {})[cat];
    if (latest && (!wp || wp.updated < latest)) errors.push(`WordPress 用データ（sedori.json）が古いです: ${cat} は ${wp ? wp.updated : "なし"}、取り込み済みは ${latest}。node tools/export_wp.js を実行してください`);
  }
} else {
  warns.push("wp-plugin/sedori-hikaku/data/sedori.json がありません（node tools/export_wp.js で作成）");
}

for (const e of errors) console.log(`✖ ${e}`);
for (const w of warns) console.log(`△ ${w}`);
if (!errors.length && !warns.length) console.log("問題なし");
process.exit(errors.length ? 1 : 0);
