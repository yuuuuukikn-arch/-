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
const DATA = { SNAPSHOTS: dctx.SNAPSHOTS, CATALOG: dctx.CATALOG, SHOW_ONLY: dctx.SHOW_ONLY };
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

const GA_TAG = `<!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-B6RYE9VRH1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag("js", new Date());
    gtag("config", "G-B6RYE9VRH1");
  </script>
  `;
function head(title, desc, { noindex = false, depth = 1 } = {}) {
  const up = "../".repeat(depth);
  return `${GA_TAG}<meta charset="utf-8">
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
      <a href="${up}index.html" class="logo"><span class="logo-mark">¥</span><span class="logo-text">買取相場ナビ</span></a>
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
  // DTSTAMP は予定の元データ（assets/pages.js）を最後に変えた時刻にする。
  // 現在時刻にすると生成のたびに ics が変わり、何が本当に変わったか分からなくなるため。
  let stamp;
  try {
    const t = require("child_process").execSync("git log -1 --format=%ct -- assets/pages.js", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    stamp = icsUtc(t ? Number(t) * 1000 : Date.now());
  } catch { stamp = icsUtc(Date.now()); }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//買取相場ナビ//発売カレンダー//JA",
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

// プライバシーポリシー（問い合わせ先・広告・アフィリエイトの説明）
const CONTACT_EMAIL = "nexttrendmarket.jp@gmail.com";
function privacyPage() {
  return `<!doctype html>
<html lang="ja" data-theme="dark">
<head>
  ${head("プライバシーポリシー｜買取相場ナビ", "買取相場ナビのプライバシーポリシー（個人情報の扱い、広告・アフィリエイト、お問い合わせ先）。", { depth: 0 })}
</head>
<body>
  ${header(0)}
  <main class="container page-article">
    <h1>プライバシーポリシー</h1>
    <p class="lead">買取相場ナビ（以下「当サイト」）における、情報の扱いについて定めています。</p>

    <h2>1. 取得する情報</h2>
    <p>当サイトは、会員登録を行っていません。お問い合わせをいただいた場合は、メールアドレスと、お問い合わせ内容を受け取ります。</p>
    <p>当サイトは、アクセス状況を把握するために Google アナリティクス（GA4）を使用しています。Google アナリティクスは Cookie を使い、閲覧されたページや、おおよその地域（国・都道府県・市区町村）などの情報を Google に送ります。これらの情報は、Google のプライバシーポリシーにもとづいて扱われます。収集を止めたい場合は、Google アナリティクスのオプトアウトアドオンをご利用ください。</p>

    <h2>2. 広告について</h2>
    <p>当サイトは、第三者配信の広告サービス（Google アドセンスなど）を利用することがあります。これらの広告は、Cookie（クッキー）を使って、利用者の興味に合わせた広告を表示することがあります。</p>
    <p>Cookie の使用を無効にする方法や、パーソナライズ広告の設定については、各広告サービスのページをご覧ください。</p>

    <h2>3. アフィリエイトについて</h2>
    <p>当サイトには、Amazon.co.jp アソシエイトおよび楽天アフィリエイトのリンクを掲載しています。リンク先で商品を購入されると、当サイトに紹介料が入ることがあります。</p>
    <p>商品の価格や在庫は、リンク先で必ずご確認ください。</p>

    <h2>4. 掲載情報について</h2>
    <p>当サイトに掲載している買取価格、定価、相場、発売日などは、掲載時点の情報です。実際の買取額や販売状況は、各店舗・各サイトでご確認ください。</p>
    <p>公開する情報は、掲載の許可を得たもの、または公開されている情報に限ります。掲載について問題がある場合は、お問い合わせ先までご連絡ください。</p>

    <h2>5. 外部のサイトについて</h2>
    <p>当サイトから、外部のサイトへリンクすることがあります。外部のサイトの内容や、個人情報の扱いについては、当サイトは責任を負いません。</p>

    <h2>6. お問い合わせ</h2>
    <p>メール：<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

    <h2>7. 改定</h2>
    <p>このポリシーは、必要に応じて変更することがあります。変更した場合は、このページに掲載します。</p>
    <p class="note">制定日：2026年10月8日</p>
  </main>
  ${footer(0)}
</body>
</html>
`;
}

// 運営者情報（サイトの目的・掲載の方針・連絡先）
function aboutPage() {
  return `<!doctype html>
<html lang="ja" data-theme="dark">
<head>
  ${head("運営者情報｜買取相場ナビ", "買取相場ナビの目的、掲載の方針、運営者の連絡先。", { depth: 0 })}
</head>
<body>
  ${header(0)}
  <main class="container page-article">
    <h1>運営者情報</h1>
    <p class="lead">買取相場ナビは、iPhone と ポケモンカードゲーム（BOX）の買取価格を比べるための情報サイトです。</p>

    <h2>サイトの目的</h2>
    <p>店舗ごとの買取価格を並べて、どの店舗が高いかを分かりやすくお伝えします。新しい発売日や予約・抽選の情報も、あわせて掲載しています。</p>

    <h2>掲載の方針</h2>
    <p>掲載する価格は、確認できた時点のものです。確認日を併記し、古くなった情報は更新します。</p>
    <p>実際の買取額や販売状況は、必ず各店舗・各公式サイトでご確認ください。当サイトの情報をもとに行った取引について、当サイトは責任を負いません。</p>
    <p>当サイトは、店舗や商品の公式な情報ではありません。掲載に誤りや、掲載してほしくない情報がある場合は、お問い合わせください。</p>

    <h2>広告・アフィリエイト</h2>
    <p>当サイトは、広告（Google アドセンスなど）と、Amazon.co.jp アソシエイト・楽天アフィリエイトのリンクを掲載しています。詳しくは<a href="privacy.html">プライバシーポリシー</a>をご覧ください。</p>

    <h2>運営者・お問い合わせ</h2>
    <p>運営：買取相場ナビ運営チーム</p>
    <p>メール：<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
    <p class="note">最終更新：2026年10月8日</p>
  </main>
  ${footer(0)}
</body>
</html>
`;
}

function calendarPage() {
  return `<!doctype html>
<html lang="ja" data-theme="dark">
<head>
  ${head("発売カレンダー｜買取相場ナビ", "予約開始日と発売日をまとめた発売カレンダー。スマホのカレンダーに追加できます。", { depth: 0 })}
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
      <p>&copy; ${new Date().getFullYear()} 買取相場ナビ ・ <a href="${up}index.html">ランキングへ</a> ・ <a href="${up}yoyaku.html">予約・抽選・新発売</a> ・ <a href="${up}calendar.html">発売カレンダー</a> ・ <a href="${up}about.html">運営者情報</a> ・ <a href="${up}privacy.html">プライバシーポリシー</a></p>
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
    <h2>価格の推移・店舗別の比較</h2>
    <div id="item-view"><p class="note">読み込み中…</p></div>
    <div class="tooltip" id="tooltip" hidden></div>`;
}

// 個別ページ：ランキングの行から開く、商品ごとのページ（中身は assets/item.js が作る）
const ITEM_CATS = [["iPhone", "iphone"], ["ポケカBOX", "pokeca"]];
function itemList() {
  const out = [];
  for (const [cat, slug] of ITEM_CATS) {
    const names = new Set();
    for (const snap of DATA.SNAPSHOTS.filter((x) => x.cat === cat && !ARTICLE_EXCLUDE.includes(x.shop))) {
      for (const [name, it] of Object.entries(snap.items)) {
        if (it.sealed == null) continue;
        if (DATA.SHOW_ONLY && DATA.SHOW_ONLY[cat] && !DATA.SHOW_ONLY[cat].test(name)) continue;
        names.add(name);
      }
    }
    [...names].sort((a, b) => a.localeCompare(b, "ja")).forEach((name, i) => {
      out.push({ cat, name, file: `p/item-${slug}-${String(i + 1).padStart(2, "0")}.html` });
    });
  }
  return out;
}
const ITEMS = itemList();
const itemScripts = (cat, name) => `<script>window.ITEM_PAGE = ${JSON.stringify({ cat, name }).replace(/</g, "\\u003c")};</script>
  <script src="../assets/data.js"></script>
  <script src="../assets/history.js"></script>
  <script src="../assets/chart.js"></script>
  <script src="../assets/item-view.js"></script>
  <script src="../assets/item.js"></script>`;
function itemPage(cat, name) {
  return `<!doctype html>
<html lang="ja" data-theme="dark">
<head>
  ${head(`${name} の買取価格｜買取相場ナビ`, `${name}の買取価格を店舗別に比べます。価格の推移（7日・30日・全期間）と、定価との比較。`)}
</head>
<body>
  ${header(1)}
  <main class="container page-article">
    <p class="crumb"><a href="../index.html">ランキングへ</a> ›</p>
    <h1>${esc(name)}</h1>
    <div id="item-view"><p class="note">読み込み中…</p></div>
    <div class="tooltip" id="tooltip" hidden></div>
    <section class="cal-grid-wrap"><h2>発売・予約カレンダー</h2><div data-cal-grid></div>
      <p class="note"><a href="../calendar.html">発売カレンダーの一覧を見る ›</a></p></section>
  </main>
  ${footer(1)}
  ${itemScripts(cat, name)}
  <script src="../assets/releases-public.js"></script>
  <script src="../assets/calendar-grid.js"></script>
</body>
</html>
`;
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
<html lang="ja" data-theme="dark">
<head>
  ${head(`${p.title}｜買取相場ナビ`, p.summary || p.title, { noindex: draft })}
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
    <section class="cal-grid-wrap"><h2>発売・予約カレンダー</h2><div data-cal-grid></div>
      <p class="note"><a href="../calendar.html">発売カレンダーの一覧を見る ›</a></p></section>
  </main>
  ${footer()}
  ${p.chart ? itemScripts(p.chart.cat, p.chart.name) : ""}
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
<html lang="ja" data-theme="dark">
<head>
  ${head("予約・抽選・新発売｜買取相場ナビ", "ポケモンカードなどの予約・抽選・新発売の情報を、確認できたものから一覧にします。", { depth: 0 })}
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
fs.writeFileSync(path.join(ROOT, "privacy.html"), privacyPage());
for (const it of ITEMS) fs.writeFileSync(path.join(ROOT, it.file), itemPage(it.cat, it.name));
const itemMap = {};
for (const it of ITEMS) (itemMap[it.cat] ||= {})[it.name] = it.file;
fs.writeFileSync(path.join(ROOT, "assets/item-pages.js"), "// 商品ごとの個別ページ（tools/make_pages.js が作る）\nconst ITEM_PAGES = " + JSON.stringify(itemMap, null, 2) + ";\n");
fs.writeFileSync(path.join(ROOT, "about.html"), aboutPage());

// 検索エンジン用：sitemap.xml と robots.txt（公開中のページだけ）
const SITE_URL = "https://yuuuuukikn-arch.github.io/kaitori-navi/";
const sitemapPages = ["index.html", "news.html", "yoyaku.html", "calendar.html", "privacy.html", "about.html",
  ...PAGES.filter(published).map((p) => `p/${p.id}.html`), ...ITEMS.map((it) => it.file)];
const today2 = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemapPages.map((f) => `  <url><loc>${esc(SITE_URL + f)}</loc><lastmod>${today2}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

const relPub = RELEASES.filter(published);
const allEvents = relPub.flatMap(releaseEvents).sort((a, b) => (a.start || a.day).localeCompare(b.start || b.day));
fs.writeFileSync(path.join(ROOT, "calendar.ics"), icsFile(allEvents, "買取相場ナビ 発売カレンダー"));
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
