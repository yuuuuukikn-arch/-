#!/usr/bin/env node
// WordPress プラグイン用のデータ（wp-plugin/sedori-hikaku/data/sedori.json）を書き出す。
// 使い方: node tools/export_wp.js
// assets/data.js と assets/history.js を読み、サイトと同じ計算（各店の最新価格を3日間有効として比較）をして保存する。
// WP_EXCLUDE の店は書き出さない。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "wp-plugin/sedori-hikaku/data/sedori.json");
const STALE_DAYS = 3;

const ctx = {};
vm.createContext(ctx);
for (const f of ["assets/data.js", "assets/history.js"]) {
  // const を var にして、読み込んだ値を取り出せるようにする
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^const /gm, "var "), ctx);
}
const { SHOPS, CATALOG, SHOW_ONLY, SNAPSHOTS } = ctx;

const shopOrder = Object.keys(SHOPS);
const shopIdx = (s) => (shopOrder.indexOf(s) < 0 ? shopOrder.length : shopOrder.indexOf(s));
// WordPress（公開）には出さない店。規約で「無断転載・引用お断り」としている店。
const WP_EXCLUDE = ["買取商店"];
const published = (s) => !WP_EXCLUDE.includes(s);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const display = (n) => n.replace(/】\s+/g, "】");

function buildCategory(cat) {
  const snaps = SNAPSHOTS.filter((s) => s.cat === cat && published(s.shop));
  const map = new Map();
  for (const snap of snaps) {
    for (const [name, it] of Object.entries(snap.items)) {
      if (it.sealed == null) continue;
      if (SHOW_ONLY[cat] && !SHOW_ONLY[cat].test(name)) continue;
      if (!map.has(name)) map.set(name, { shops: new Map(), dates: new Set() });
      const p = map.get(name);
      if (!p.shops.has(snap.shop)) p.shops.set(snap.shop, []);
      p.shops.get(snap.shop).push({ ...it, date: snap.date });
      p.dates.add(snap.date);
    }
  }
  const products = [...map].map(([name, p]) => {
    const asOf = (d) => {
      const shops = {};
      for (const [shop, list] of p.shops) {
        const e = list.filter((x) => x.date <= d).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (e && daysBetween(e.date, d) < STALE_DAYS) shops[shop] = e;
      }
      const price = Math.max(...Object.values(shops).map((x) => x.sealed));
      const best = Object.keys(shops).filter((s) => shops[s].sealed === price).sort((a, b) => shopIdx(a) - shopIdx(b));
      return { date: d, shops, price, best };
    };
    const history = [...p.dates].sort().map(asOf);
    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    const info = CATALOG[name] || {};
    const retail = info.retail ?? null;
    const shops = Object.entries(latest.shops)
      .map(([shop, e]) => ({
        shop, price: e.sealed, date: e.date,
        ...(e.colors ? { colors: e.colors } : {}),
        ...(e.noShrink != null ? { noShrink: e.noShrink } : {}),
        ...(e.note ? { note: e.note } : {}),
      }))
      .sort((a, b) => b.price - a.price || shopIdx(a.shop) - shopIdx(b.shop));
    const bestItem = latest.shops[latest.best[0]];
    const bestColors = bestItem.colors ? Object.keys(bestItem.colors).filter((c) => bestItem.colors[c] === latest.price) : [];
    return {
      name, display: display(name), retail, estimated: !!info.estimated,
      price: latest.price, date: latest.date,
      profit: retail != null ? latest.price - retail : null,
      rate: retail != null ? +(latest.price / retail).toFixed(4) : null,
      roi: retail != null ? +((latest.price - retail) / retail).toFixed(4) : null,
      change: prev ? latest.price - prev.price : null,
      boost: Object.values(latest.shops).some((x) => x.boost),
      bestColors, shops,
      history: history.map((h) => ({ date: h.date, price: h.price, best: h.best })),
    };
  });
  const metric = cat === "iPhone" ? "rate" : "profit";
  products.sort((a, b) => (a[metric] == null) - (b[metric] == null) || b[metric] - a[metric]);
  const dates = snaps.map((s) => s.date).sort();
  const updated = dates[dates.length - 1] || null;
  return {
    metric, updated, days: new Set(dates).size,
    shops: [...new Set(products.flatMap((p) => p.shops.map((x) => x.shop)))].sort((a, b) => shopIdx(a) - shopIdx(b)),
    products,
  };
}

// このファイルを直接実行したときだけ書き出す（tools/make_pages.js からは部品として読む）
if (require.main === module) {
  const cats = [...new Set(SNAPSHOTS.map((s) => s.cat))];
  const out = {
    generated: new Date().toISOString(),
    shops: Object.fromEntries(Object.entries(SHOPS).filter(([s]) => published(s)).map(([s, v]) => [s, { ...(v.url ? { url: v.url } : {}), ...(v.urls ? { urls: v.urls } : {}), ...(v.pages ? { pages: v.pages } : {}), ...(v.hours ? { hours: v.hours } : {}) }])),
    categories: Object.fromEntries(cats.map((c) => [c, buildCategory(c)])),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // グラフ部品をプラグインにコピー（テーマが読み込む Chart.js と名前がぶつからないように SedoriChart に改名）
  fs.writeFileSync(
    path.join(ROOT, "wp-plugin/sedori-hikaku/assets/chart.js"),
    "// assets/chart.js から自動コピー（tools/export_wp.js）。直接編集しないでください。\n" +
      fs.readFileSync(path.join(ROOT, "assets/chart.js"), "utf8").replace(/^const Chart = /m, "const SedoriChart = ")
  );
  // テーマ（wp-theme/kaitori-navi）の土台 CSS は静的サイトと同じファイル。ここでコピーして同期する
  const themeCss = path.join(ROOT, "wp-theme/kaitori-navi/assets/style.css");
  if (fs.existsSync(path.dirname(themeCss))) {
    fs.writeFileSync(themeCss, "/* assets/style.css から自動コピー（tools/export_wp.js）。直接編集しないでください。 */\n" + fs.readFileSync(path.join(ROOT, "assets/style.css"), "utf8"));
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  for (const [c, v] of Object.entries(out.categories)) console.log(`${c}: ${v.products.length}件（掲載店: ${v.shops.join("・")}、更新 ${v.updated}）`);
  console.log(`書き出し: ${path.relative(ROOT, OUT)}（${fs.statSync(OUT).size.toLocaleString()} bytes）`);
}

module.exports = { buildCategory, STALE_DAYS, WP_EXCLUDE };
