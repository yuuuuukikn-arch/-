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
const { PAGES, PAGE_CONFIG, RELEASES } = ctx;

// 記事用：価格の記録（data.js・history.js）を読む
const dctx = {};
vm.createContext(dctx);
for (const f of ["assets/data.js", "assets/history.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^const /gm, "var "), dctx);
}
const DATA = { SNAPSHOTS: dctx.SNAPSHOTS, CATALOG: dctx.CATALOG };
const ARTICLE_EXCLUDE = ["買取商店"]; // 公開しない店（規約で転載を禁止している）

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { yoyaku: "予約・抽選", shinhatsu: "新発売", chumoku: "注目商品", article: "記事" };
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
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

// ── 発売カレンダー（予約・発売のファイル）──
const icsEsc = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsUtc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDay = (d) => d.replaceAll("-", "");
function releaseEvents(r) {
  const ev = [];
  if (r.reserve && r.reserve.start) {
    const start = Date.parse(r.reserve.start);
    ev.push({ uid: `${r.id}-reserve@sedori-hikaku`, summary: `【予約開始】${r.title}`,
      start: icsUtc(start), end: icsUtc(start + 36e5), alarm: true,
      desc: `予約開始の日時です。${r.note || ""}${r.official ? "\n公式: " + r.official : ""}` });
  }
  if (r.release) {
    const next = new Date(Date.parse(r.release + "T00:00:00+09:00") + 864e5).toISOString().slice(0, 10);
    ev.push({ uid: `${r.id}-release@sedori-hikaku`, summary: `【発売日】${r.title}`,
      day: icsDay(r.release), dayEnd: icsDay(next), alarm: false,
      desc: `発売日です。${r.note || ""}${r.official ? "\n公式: " + r.official : ""}` });
  }
  return ev;
}
function icsFile(events, name) {
  const stamp = icsUtc(Date.now());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//せどり比較//発売カレンダー//JA",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEsc(name)}`];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.day) lines.push(`DTSTART;VALUE=DATE:${e.day}`, `DTEND;VALUE=DATE:${e.dayEnd}`);
    else lines.push(`DTSTART:${e.start}`, `DTEND:${e.end}`);
    lines.push(`SUMMARY:${icsEsc(e.summary)}`, `DESCRIPTION:${icsEsc(e.desc)}`);
    if (e.alarm) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:予約開始の1時間前です", "TRIGGER:-PT1H", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545：1行は75バイト以内。超えたら改行して次行の先頭に空白を入れる（日本語はバイト数で数える）
  const fold = (line) => {
    const out = [];
    let cur = "";
    for (const ch of line) {
      if (Buffer.byteLength(cur + ch, "utf8") > 75) { out.push(cur); cur = " " + ch; }
      else cur += ch;
    }
    out.push(cur);
    return out.join("\r\n");
  };
  return lines.map(fold).join("\r\n") + "\r\n";
}

function calendarPage() {
  return `<!doctype html>
<html lang="ja">
<head>
  ${head("発売カレンダー｜せどり比較", "予約開始日と発売日をまとめた発売カレンダー。スマホのカレンダーに追加できます。", { depth: 0 })}
  <script src="assets/releases-public.js" defer></script>
  <script src="assets/calendar.js" defer></script>
</head>
<body>
  ${header(0)}
  <main class="container page-article">
    <h1>発売カレンダー</h1>
    <p class="lead">予約開始日と発売日をまとめています。「カレンダーに追加」を押すと、スマホのカレンダーに予定が入ります。</p>
    <div class="cal-actions"><a class="btn-link" href="calendar.ics">全部をまとめて追加（購読）</a>
      <span class="muted">購読すると、予定が増えたときに自動で反映されます（反映の間隔は、お使いのカレンダーの設定によります）。</span></div>
    <div id="cal" class="rel-list"></div>
    <noscript><p class="note">予定の一覧は、JavaScript が動くと表示されます。</p></noscript>
    <p class="note">「予約した」の記録は、この端末のブラウザにだけ保存されます（別の端末とは共有されません）。</p>
  </main>
  <section class="container cal-grid-wrap"><h2>月ごとのカレンダー</h2><div data-cal-grid></div></section>
  ${footer(0)}
  <script src="assets/calendar-grid.js" defer></script>
</body>
</html>
`;
}

function footer(depth = 1) {
  const up = "../".repeat(depth);
  return `<footer class="site-footer"><div class="container">
      <p>&copy; ${new Date().getFullYear()} せどり比較 ・ <a href="${up}index.html">ランキングへ</a> ・ <a href="${up}yoyaku.html">予約・抽選・新発売</a> ・ <a href="${up}calendar.html">発売カレンダー</a></p>
      <p class="muted">掲載の情報は確認時点のものです。申し込みや購入は、各公式ページ・販売店で行ってください。</p>
      ${PAGE_CONFIG.xUrl ? `<p><a href="${esc(PAGE_CONFIG.xUrl)}" target="_blank" rel="noopener">X（旧Twitter）で更新情報</a></p>` : ""}
    </div></footer>`;
}

// 商品の記録（店ごとの最新の価格・推移）
function articleStats(cfg) {
  const byDate = new Map(); // 日付 → { 店: 価格 }
  for (const snap of DATA.SNAPSHOTS.filter((x) => x.cat === cfg.cat && !ARTICLE_EXCLUDE.includes(x.shop))) {
    const it = snap.items[cfg.name];
    if (!it || it.sealed == null) continue;
    if (!byDate.has(snap.date)) byDate.set(snap.date, {});
    byDate.get(snap.date)[snap.shop] = it.sealed;
  }
  const dates = [...byDate.keys()].sort();
  const latest = dates[dates.length - 1] || null;
  return {
    latest,
    shops: latest ? byDate.get(latest) : {},
    retail: (DATA.CATALOG[cfg.name] || {}).retail ?? null,
    history: dates.map((d) => ({ date: d, price: Math.max(...Object.values(byDate.get(d))) })),
  };
}

// 推移の折れ線（SVG）。記録が1日分のときは点だけ
function chartSvg(history, retail) {
  const W = 340, H = 200, L = 52, R = 12, T = 12, B = 26;
  const vals = history.map((h) => h.price).concat(retail != null ? [retail] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.02);
  lo -= pad; hi += pad;
  const t0 = Date.parse(history[0].date), t1 = Date.parse(history[history.length - 1].date);
  const X = (d) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R));
  const Y = (v) => T + (H - T - B) - ((v - lo) / (hi - lo)) * (H - T - B);
  const man = (v) => (v / 10000).toFixed(1).replace(/\.0$/, "") + "万";
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="買取価格の推移">`;
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) * i) / 3;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e6eb"/>`
      + `<text x="${L - 6}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="#667085">${man(v)}</text>`;
  }
  if (retail != null) {
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(retail)}" y2="${Y(retail)}" stroke="#667085" stroke-dasharray="5 4"/>`
      + `<text x="${W - R}" y="${Y(retail) - 4}" text-anchor="end" font-size="10" fill="#667085">定価 ${man(retail)}</text>`;
  }
  if (history.length > 1) {
    s += `<polyline fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" points="${history.map((h) => `${X(h.date)},${Y(h.price)}`).join(" ")}"/>`;
  }
  s += history.map((h) => `<circle cx="${X(h.date)}" cy="${Y(h.price)}" r="3.5" fill="#2a78d6"/>`).join("");
  const first = history[0].date, last = history[history.length - 1].date;
  if (history.length > 1) {
    s += `<text x="${X(first)}" y="${H - 6}" font-size="10" fill="#667085">${fmt(first).slice(5)}</text>`
      + `<text x="${X(last)}" y="${H - 6}" text-anchor="end" font-size="10" fill="#667085">${fmt(last).slice(5)}</text>`;
  } else {
    s += `<text x="${X(first)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#667085">${fmt(first).slice(5)}</text>`;
  }
  return s + "</svg>";
}

// 記事の本体（最新の価格の表・推移グラフ）
function articleBody(p) {
  if (!p.chart) return "";
  const st = articleStats(p.chart);
  if (!st.latest) return '<p class="note">この商品の価格の記録はまだありません。</p>';
  const rows = Object.entries(st.shops).sort((a, b) => b[1] - a[1]);
  const [topShop, topPrice] = rows[0];
  const lines = [`${fmt(st.latest)}時点の買取価格の最高値は、${topShop}の${yen(topPrice)}です。`];
  if (st.retail) {
    const diff = topPrice - st.retail;
    lines.push(`定価は${yen(st.retail)}で、買取率は${(topPrice / st.retail * 100).toFixed(1)}%、利益は${diff >= 0 ? "+" : ""}${yen(diff)}です。`);
  }
  return `<h2>最新の買取価格</h2>
    <p>${lines.map(esc).join("")}</p>
    <div class="table-scroll"><table class="art-table"><thead><tr><th>店舗</th><th class="num">買取価格</th></tr></thead>
      <tbody>${rows.map(([sh, v]) => `<tr><td>${esc(sh)}</td><td class="num">${yen(v)}</td></tr>`).join("")}</tbody></table></div>
    <h2>価格の推移</h2>
    <div class="art-chart">${chartSvg(st.history, st.retail)}</div>
    ${st.history.length < 2 ? '<p class="note">記録が2日分以上たまると、線のグラフになります。</p>' : ""}`;
}

function productPage(p) {
  const draft = !published(p);
  const status = !published(p) ? "下書き" : p.until && p.until < today ? "終了" : "掲載中";
  const official = (p.official || []).map((o) =>
    `<a class="btn-link" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.label)}<span aria-hidden="true">↗</span></a>`).join("");
  const facts = (p.facts || []).length
    ? `<dl class="item-facts">${p.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "";
  const body = (p.body || []).map((t) => `<p>${esc(t)}</p>`).join("") + articleBody(p);
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
  <section class="container cal-grid-wrap"><h2>発売・予約カレンダー</h2><div data-cal-grid></div>
    <p class="note"><a href="../calendar.html">発売カレンダーの一覧を見る ›</a></p></section>
  ${footer()}
  <script src="../assets/releases-public.js"></script>
  <script src="../assets/calendar-grid.js"></script>
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
fs.writeFileSync(path.join(ROOT, "calendar.html"), calendarPage());

const relPub = RELEASES.filter(published);
const allEvents = relPub.flatMap(releaseEvents).sort((a, b) => (a.start || a.day).localeCompare(b.start || b.day));
fs.writeFileSync(path.join(ROOT, "calendar.ics"), icsFile(allEvents, "せどり比較 発売カレンダー"));
fs.mkdirSync(path.join(ROOT, "ics"), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, "ics"))) if (f.endsWith(".ics")) fs.unlinkSync(path.join(ROOT, "ics", f));
for (const r of relPub) {
  fs.writeFileSync(path.join(ROOT, "ics", `${r.id}.ics`), icsFile(releaseEvents(r), r.title));
}
fs.writeFileSync(path.join(ROOT, "assets/releases-public.js"),
  "// tools/make_pages.js が作成（直接編集しない）\nconst RELEASES_PUBLIC = " + JSON.stringify(relPub.map((r) => ({
    id: r.id, title: r.title, reserve: r.reserve || null, release: r.release || null,
    note: r.note || "", official: r.official || "", source: r.source || "",
  })), null, 1) + ";\n");
fs.writeFileSync(path.join(ROOT, "assets/site-config.js"),
  "// tools/make_pages.js が作成（直接編集しない）\nconst SITE_CONFIG = " + JSON.stringify({ xUrl: PAGE_CONFIG.xUrl || "" }) + ";\n");
console.log(`発売カレンダー: ${relPub.length}件（予定 ${allEvents.length}件）→ calendar.html / calendar.ics / ics/`);

const articles = PAGES.filter((p) => published(p) && p.kind === "article");
const pub = PAGES.filter(published).sort((a, b) => b.date.localeCompare(a.date)).map((p) => ({
  id: p.id, title: p.title, kind: p.kind, kindLabel: KIND[p.kind] || "注目", date: p.date,
  until: p.until || null, summary: p.summary || "",
}));
fs.writeFileSync(path.join(ROOT, "assets/pages-public.js"),
  "// tools/make_pages.js が作成（直接編集しない）\nconst PAGES_PUBLIC = " + JSON.stringify(pub, null, 1) + ";\n");

console.log(`商品ページ: ${PAGES.length}件（うち公開 ${pub.length}件、下書き ${PAGES.length - pub.length}件）`);
console.log(`予約・抽選・新発売の一覧: ${listed.length}件 → yoyaku.html`);
console.log(`掲載中（TOP の注目に出る）: ${PAGES.filter(isLive).length}件`);
console.log(`記事: ${articles.length}件（ランキングの下に一覧）`);
