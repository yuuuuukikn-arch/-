#!/usr/bin/env node
// 予約・抽選・新発売・注目商品のページを、assets/pages.js から作る。
//   p/<id>.html          … 商品ページ（下書きは noindex で、リンクは出ない）
//   yoyaku.html          … 予約・抽選・新発売の一覧（公開分だけ）
//   assets/pages-public.js … TOP の注目に使う、公開分の一覧
// 使い方: node tools/make_pages.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/pages.js"), "utf8").replace(/^const /gm, "var "), ctx);
const { PAGES, PAGE_CONFIG } = ctx;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { yoyaku: "予約・抽選", shinhatsu: "新発売", chumoku: "注目商品" };
const fmt = (d) => d.replaceAll("-", "/");
const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); // 日本時間の日付
const published = (p) => p.status === "published";
const isLive = (p) => published(p) && (!p.until || p.until >= today);

function buyLinks(p) {
  if (p.buyable === false) return [];
  const q = p.search || p.title;
  const out = [];
  if (PAGE_CONFIG.amazonTag) {
    out.push({ label: "Amazonで探す", cls: "amazon",
      url: `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(PAGE_CONFIG.amazonTag)}` });
  }
  if (PAGE_CONFIG.rakutenId) {
    out.push({ label: "楽天で探す", cls: "rakuten",
      url: `https://hb.afl.rakuten.co.jp/hgc/${encodeURIComponent(PAGE_CONFIG.rakutenId)}/?pc=${encodeURIComponent("https://search.rakuten.co.jp/search/mall/" + encodeURIComponent(q) + "/")}` });
  }
  return out;
}

function head(title, desc, { noindex = false, depth = 1 } = {}) {
  const up = "../".repeat(depth);
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  ${noindex ? '<meta name="robots" content="noindex">' : ""}
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>¥</text></svg>">
  <meta name="theme-color" content="#f6f7f9" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)">
  <link rel="stylesheet" href="${up}assets/style.css">`;
}

function header(depth = 1) {
  const up = "../".repeat(depth);
  return `<header class="site-header"><div class="container nav">
      <a href="${up}index.html" class="logo"><span class="logo-mark">¥</span><span class="logo-text">せどり比較</span></a>
      <a href="${up}yoyaku.html" class="back-link">予約・抽選</a>
      <button class="theme-toggle" aria-label="ライト／ダーク切り替え"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg></button>
    </div></header>`;
}

function footer(depth = 1) {
  const up = "../".repeat(depth);
  return `<footer class="site-footer"><div class="container">
      <p>&copy; ${new Date().getFullYear()} せどり比較 ・ <a href="${up}index.html">ランキングへ</a> ・ <a href="${up}yoyaku.html">予約・抽選・新発売</a></p>
      <p class="muted">掲載の情報は確認時点のものです。申し込みや購入は、各公式ページ・販売店で行ってください。</p>
    </div></footer>`;
}

function productPage(p) {
  const draft = !published(p);
  const status = !published(p) ? "下書き" : p.until && p.until < today ? "終了" : "掲載中";
  const official = (p.official || []).map((o) =>
    `<a class="btn-link" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.label)}<span aria-hidden="true">↗</span></a>`).join("");
  const facts = (p.facts || []).length
    ? `<dl class="item-facts">${p.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "";
  const body = (p.body || []).map((t) => `<p>${esc(t)}</p>`).join("");
  const buy = buyLinks(p);
  const aff = buy.length
    ? `<div class="aff"><p class="pr">${esc(PAGE_CONFIG.prText)}</p><div class="aff-btns">${buy.map((a) =>
        `<a class="aff-btn ${a.cls}" href="${esc(a.url)}" target="_blank" rel="sponsored nofollow noopener">${esc(a.label)}</a>`).join("")}</div></div>` : "";
  return `<!doctype html>
<html lang="ja">
<head>
  ${head(`${p.title}｜せどり比較`, p.summary || p.title, { noindex: draft })}
</head>
<body>
  ${header()}
  <main class="container page-article">
    <p class="crumb"><a href="../yoyaku.html">予約・抽選・新発売</a> ›</p>
    <div class="news-meta"><span class="news-tag">${esc(KIND[p.kind] || "注目")}</span><time datetime="${esc(p.date)}">${fmt(p.date)} 掲載</time><span class="news-status">${status}${p.until ? `（${fmt(p.until)}まで）` : ""}</span></div>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ""}
    ${body}
    ${facts}
    ${official ? `<div class="btn-row">${official}</div>` : ""}
    ${aff}
  </main>
  ${footer()}
</body>
</html>
`;
}

function yoyakuPage(items) {
  const cards = items.length ? items.map((p) => {
    const ended = p.until && p.until < today;
    return `<a class="att-card ${ended ? "ended" : ""}" href="p/${esc(p.id)}.html">
      <span class="att-kind">${esc(KIND[p.kind] || "注目")}${ended ? "・終了" : ""}</span>
      <b>${esc(p.title)}</b><small>${esc(p.summary || "")}</small>
      <small class="att-date">${fmt(p.date)} 掲載${p.until ? `・${fmt(p.until)}まで` : ""}</small></a>`;
  }).join("") : `<div class="news-empty"><p><b>掲載中の予約・抽選・新発売はまだありません。</b></p>
    <p>確認できたものから順に載せます。</p></div>`;
  return `<!doctype html>
<html lang="ja">
<head>
  ${head("予約・抽選・新発売｜せどり比較", "ポケモンカードなどの予約・抽選・新発売の情報を、確認できたものから一覧にします。", { depth: 0 })}
</head>
<body>
  ${header(0)}
  <main class="container page-article">
    <h1>予約・抽選・新発売</h1>
    <p class="lead">確認できた予約・抽選・新発売の情報をまとめています。申し込みは各公式ページで行ってください。</p>
    <div class="att-list att-list-full">${cards}</div>
  </main>
  ${footer(0)}
</body>
</html>
`;
}

// ── 出力 ──
fs.mkdirSync(path.join(ROOT, "p"), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, "p"))) {
  if (f.endsWith(".html")) fs.unlinkSync(path.join(ROOT, "p", f));
}
for (const p of PAGES) {
  fs.writeFileSync(path.join(ROOT, "p", `${p.id}.html`), productPage(p));
}
const listed = PAGES.filter((p) => published(p) && (p.kind === "yoyaku" || p.kind === "shinhatsu"))
  .sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(path.join(ROOT, "yoyaku.html"), yoyakuPage(listed));

const pub = PAGES.filter(published).sort((a, b) => b.date.localeCompare(a.date)).map((p) => ({
  id: p.id, title: p.title, kind: p.kind, kindLabel: KIND[p.kind] || "注目", date: p.date,
  until: p.until || null, summary: p.summary || "",
}));
fs.writeFileSync(path.join(ROOT, "assets/pages-public.js"),
  "// tools/make_pages.js が作成（直接編集しない）\nconst PAGES_PUBLIC = " + JSON.stringify(pub, null, 1) + ";\n");

console.log(`商品ページ: ${PAGES.length}件（うち公開 ${pub.length}件、下書き ${PAGES.length - pub.length}件）`);
console.log(`予約・抽選・新発売の一覧: ${listed.length}件 → yoyaku.html`);
console.log(`掲載中（TOP の注目に出る）: ${PAGES.filter(isLive).length}件`);
