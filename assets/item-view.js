// 共通の部品（ランキングと個別ページで使う）：価格の集計・店舗表・推移グラフ
const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";
const sign = (n) => (n > 0 ? "plus" : n < 0 ? "minus" : "zero");
const signed = (n) => (n > 0 ? "+" : "") + yen(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const WDAY = ["日", "月", "火", "水", "木", "金", "土"];
const mdw = (d) => `${d.slice(5).replace("-", "/")}(${WDAY[new Date(d + "T00:00:00").getDay()]})`; // 10/07(火)
const disp = (name) => esc(name.replace(/】\s+/g, "】")); // 表示用（【MEGA】 30th → 【MEGA】30th）
let currentCat = "iPhone";
let range = 30;
// 実データがあるカテゴリはサンプルを使わない
const realCats = new Set(SNAPSHOTS.map((s) => s.cat));
const ALL = [...SNAPSHOTS, ...SAMPLE_SNAPSHOTS.filter((s) => !realCats.has(s.cat))];
// スマホ（iPhone）は買取率、ポケカは利益で比べる
const useRate = () => currentCat === "iPhone";
const SHOP_ORDER = Object.keys(SHOPS);
const shopIdx = (shop) => { const i = SHOP_ORDER.indexOf(shop); return i < 0 ? SHOP_ORDER.length : i; };

// 店のリンク先：商品別ページ（pages、商品名の先頭が長く一致するもの）→ カテゴリ別（urls）→ 店の URL。どれもなければ空
function shopUrl(shop, cat = currentCat, name = "") {
  const info = SHOPS[shop];
  if (!info) return "";
  if (name && info.pages) {
    const key = Object.keys(info.pages).filter((k) => name.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    if (key) return info.pages[key];
  }
  return (info.urls && info.urls[cat]) || info.url || "";
}

// 店舗名（公式サイトへのリンク付き）。name を渡すと商品別ページへ
function shopLink(shop, cls = "", name = "") {
  const url = shopUrl(shop, currentCat, name);
  if (!url) return `<span class="shop ${cls}">${esc(shop)}</span>`;
  return `<a class="shop ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(shop)}<span aria-hidden="true">↗</span></a>`;
}

// 商品ごとに、日付 → 店舗ごとの価格 をまとめる
// 店ごとの価格は、その店の最新の取り込みを「STALE_DAYS 日」まで有効として扱う
// （店によって取り込む日がずれても、比較から消えないように）
const STALE_DAYS = 3;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// 表示しない店（規約で掲載を禁止している店）。記録（history.js）は残しています
const HIDDEN_SHOPS = ["買取商店"];

function buildProducts(cat) {
  // 商品 → 店 → 日付順の価格
  const map = new Map();
  for (const snap of ALL.filter((s) => s.cat === cat && !HIDDEN_SHOPS.includes(s.shop))) {
    for (const [name, it] of Object.entries(snap.items)) {
      if (it.sealed == null) continue;
      if (SHOW_ONLY[cat] && !SHOW_ONLY[cat].test(name)) continue;
      if (!map.has(name)) map.set(name, { shops: new Map(), dates: new Set(), sample: false });
      const p = map.get(name);
      if (!p.shops.has(snap.shop)) p.shops.set(snap.shop, []);
      p.shops.get(snap.shop).push({ ...it, date: snap.date });
      p.dates.add(snap.date);
      p.sample = p.sample || !!snap.sample;
    }
  }
  return [...map].map(([name, p]) => {
    // ある日時点での各店の有効な価格（STALE_DAYS 日以内の最新）
    const asOf = (d) => {
      const shops = {};
      for (const [shop, list] of p.shops) {
        const e = list.filter((x) => x.date <= d).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (e && daysBetween(e.date, d) < STALE_DAYS) shops[shop] = e;
      }
      const price = Math.max(...Object.values(shops).map((x) => x.sealed));
      const best = Object.keys(shops).filter((sh) => shops[sh].sealed === price).sort((a, b) => shopIdx(a) - shopIdx(b));
      return { date: d, shops, price, best, sample: p.sample };
    };
    const history = [...p.dates].sort().map(asOf);
    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    const info = CATALOG[name] || {};
    const retail = info.retail ?? null;
    const profit = retail != null ? latest.price - retail : null;
    const bestItem = latest.shops[latest.best[0]];
    return {
      name, history, latest, retail, estimated: !!info.estimated,
      bestItem, boost: Object.values(latest.shops).some((x) => x.boost),
      shopCount: Object.keys(latest.shops).length,
      profit, roi: profit != null ? profit / retail : null,
      rate: retail != null ? latest.price / retail : null, // 買取率 = 買取価格 ÷ 定価
      price: latest.price,
      change: prev ? latest.price - prev.price : 0,
      hasPrev: !!prev,
    };
  });
}
// 結論：いま売るならどこで、定価で買うといくら得か
function verdict(p) {
  const top = p.latest.best[0];
  const it = p.latest.shops[top];
  const url = shopUrl(top, currentCat, p.name);
  const stale = it.date < p.latest.date ? `<small class="stale">${it.date.slice(5).replace("-", "/")}時点</small>` : "";
  const others = p.latest.best.length > 1 ? `<small class="muted">同額 ${p.latest.best.slice(1).map(esc).join("・")}</small>` : "";
  let judge;
  if (p.retail == null) {
    judge = `<span>定価が未登録のため、損得は計算できません</span>`;
  } else {
    const d = p.profit;
    const rate = useRate() ? `買取率 ${pct(p.rate)}` : "";
    const head = `<span>定価 ${yen(p.retail)}${p.estimated ? "（推定）" : ""} で買って売ると</span>`;
    judge = d > 0
      ? `${head}<b class="plus">${signed(d)} の得</b><small>${rate}</small>`
      : d < 0
        ? `${head}<b class="minus">${signed(d)} の損</b><small>${rate}${rate ? " ・ " : ""}今は見送り</small>`
        : `${head}<b class="zero">±¥0</b><small>${rate}</small>`;
  }
  return `<div class="verdict">
    <div class="v-sell">
      <span>いま売るなら（${p.latest.date.replaceAll("-", "/")} 時点の最高値）</span>
      <b>${esc(top)}</b><b class="v-price">${yen(p.price)}</b>${stale}${others}
      ${url ? `<a class="v-go" href="${esc(url)}" target="_blank" rel="noopener">${esc(top)}のサイトへ<span aria-hidden="true">↗</span></a>` : ""}
    </div>
    <div class="v-judge ${p.profit == null ? "" : sign(p.profit)}">${judge}</div>
  </div>`;
}

// 店舗を買取価格の高い順に並べた一覧（1行まるごと店のサイトへのリンク）
function shopRanking(p, limit = 3) {
  const list = Object.entries(p.latest.shops)
    .map(([shop, it]) => ({ shop, price: it.sealed, date: it.date }))
    .sort((a, b) => b.price - a.price || shopIdx(a.shop) - shopIdx(b.shop));
  let rank = 0;
  return `<ol class="shop-rank">${list.slice(0, limit).map((x, i) => {
    if (i === 0 || x.price < list[i - 1].price) rank = i + 1; // 同じ価格は同じ順位
    const url = shopUrl(x.shop, currentCat, p.name);
    const metric = p.retail == null ? "" : useRate()
      ? `<span class="sr-metric ${sign(x.price - p.retail)}">${pct(x.price / p.retail)}</span>`
      : `<span class="sr-metric ${sign(x.price - p.retail)}">${signed(x.price - p.retail)}</span>`;
    const inner = `<span class="sr-pos r${rank}">${rank}位</span><span class="sr-name">${esc(x.shop)}${x.date < p.latest.date ? `<small>${x.date.slice(5).replace("-", "/")}時点</small>` : ""}</span><span class="sr-price">${yen(x.price)}</span>${metric}<span class="sr-go" aria-hidden="true">${url ? "›" : ""}</span>`;
    return `<li>${url ? `<a class="sr-row ${rank === 1 ? "top" : ""}" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(x.shop)}のサイトを開く（${yen(x.price)}）">${inner}</a>` : `<div class="sr-row ${rank === 1 ? "top" : ""}">${inner}</div>`}</li>`;
  }).join("")}</ol>`;
}

// 店舗ごとの価格表（iPhone は色別）
function shopTable(p) {
  const shops = p.latest.best.slice().sort((a, b) => shopIdx(a) - shopIdx(b)); // 表は最高値（1位）の店舗だけ
  const its = shops.map((sh) => p.latest.shops[sh]);
  const head = `<th>店舗</th>`;
  // 価格の色は定価との比較（定価以上は緑、未満は赤）。店の中で一番高い価格は太字
  const cell = (v, best) => {
    if (v == null) return '<td class="num"><span class="na">—</span></td>';
    const tone = p.retail != null ? sign(v - p.retail) : "";
    return `<td class="num price ${tone} ${v === best ? "best-price" : ""}">${yen(v)}</td>`;
  };
  const rowsHtml = (labels, valueOf) => labels.map((label) => {
    const vals = its.map((it) => valueOf(it, label));
    const best = Math.max(...vals.filter((v) => v != null));
    const prof = p.retail != null && isFinite(best) ? best - p.retail : null;
    const last = prof == null ? "—" : useRate() ? `${pct(best / p.retail)}<small class="muted">（${signed(prof)}）</small>` : signed(prof);
    return `<tr><th scope="row">${esc(label)}</th>${vals.map((v) => cell(v, best)).join("")}<td class="num ${prof != null ? sign(prof) : ""}">${last}</td></tr>`;
  }).join("");
  const shopHead = shops.map((sh) => `<th class="num">${shopLink(sh, "", p.name)}${p.latest.shops[sh].date < p.latest.date ? `<small class="stale">${p.latest.shops[sh].date.slice(5).replace("-", "/")}時点</small>` : ""}</th>`).join("");
  const hasColors = its.some((it) => it.colors);
  const body = hasColors
    ? rowsHtml(colorsFor(p.name).length ? colorsFor(p.name) : [...new Set(its.flatMap((it) => Object.keys(it.colors || {})))], (it, c) => (it.colors ? it.colors[c] ?? null : null))
    : rowsHtml(["未開封"], (it) => it.sealed);
  const notes = shops.map((sh) => {
    const it = p.latest.shops[sh], info = SHOPS[sh] || {};
    const bits = [it.noShrink != null ? `シュリンクなし ${yen(it.noShrink)}` : "", it.note || "", info.hours ? `営業時間 ${info.hours}` : ""].filter(Boolean);
    return bits.length ? `<li>${shopLink(sh, "", p.name)}：${esc(bits.join(" ／ "))}</li>` : "";
  }).join("");
  return `<div class="shop-compare">
    <h4>店舗別の買取価格（${p.latest.date.replaceAll("-", "/")}）</h4>
    <div class="cmp-wrap"><table class="cmp">
      <thead><tr><th>${hasColors ? "色" : ""}</th>${shopHead}<th class="num">${useRate() ? "買取率（最高値）" : "利益（最高値）"}</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${notes ? `<ul class="shop-notes">${notes}</ul>` : ""}
  </div>`;
}

// 推移グラフと数字の箱（記録が 3 日分以上あるときだけ使う）
function chartBlock(p, wed) {
  const h = p.history;
  const first = h[0], last = h[h.length - 1], prev = h[h.length - 2];
  const hi = h.reduce((a, b) => (b.price > a.price ? b : a));
  return `
    <div class="chart-head">
      <div>
        <h3>${disp(p.name)} の買取価格推移</h3>
        <div class="legend">
          <span><i class="key s1"></i>最高値（各店で一番高い買取価格）</span>
          ${p.retail != null ? `<span><i class="key ref-key"></i>定価${p.estimated ? "（推定）" : ""}</span>` : ""}
          ${wed ? `<span><i class="key wed-key"></i>水曜の記録</span>` : ""}
        </div>
      </div>
      <div class="range" role="group" aria-label="期間">
        ${[[7, "7日"], [30, "30日"], [0, "全期間"]].map(([v, l]) => `<button class="${range === v ? "active" : ""}" data-range="${v}">${l}</button>`).join("")}
      </div>
    </div>
    <div class="chart" id="chart"></div>
    ${wed ? `<p class="chart-note">iPhone の買取価格は水曜に上がりやすい傾向があります。水曜の記録に色を付けているので、曜日ごとの動きを見比べてください。</p>` : ""}
    <div class="detail-stats">
      <div><span>前回比</span><b class="${prev ? sign(last.price - prev.price) : "zero"}">${prev ? signed(last.price - prev.price) : "—"}</b><small>${prev ? mdw(prev.date) + " → " + mdw(last.date) : "記録は1日分"}</small></div>
      <div><span>記録開始からの変化</span><b class="${sign(last.price - first.price)}">${signed(last.price - first.price)}</b><small>${mdw(first.date)} から ${h.length}日分</small></div>
      <div><span>期間内の最高値</span><b>${yen(hi.price)}</b><small>${mdw(hi.date)}</small></div>
    </div>
`;
}

function detail(p) {
  const h = p.history;
  const wed = currentCat === "iPhone"; // iPhone は水曜に上がりやすい傾向があるので、水曜の記録に印を付ける
  return `<div class="detail-wrap">
    ${verdict(p)}
    <div class="shop-compare">
      <h4>店舗別ランキング（高い順・押すとその店のサイトへ）</h4>
      ${shopRanking(p, 5)}
    </div>
    ${shopTable(p)}
    ${h.length >= 3 ? chartBlock(p, wed) : `<p class="chart-note">記録 ${h.length} 日目です。価格の推移グラフは、記録が 3 日分たまると表示します。</p>`}
  </div>`;
}

function drawChart(p) {
  const el = $("chart");
  if (!el || !p) return;
  let h = p.history;
  if (range) {
    const cutoff = Date.parse(h[h.length - 1].date) - (range - 1) * 864e5;
    h = h.filter((x) => Date.parse(x.date) >= cutoff);
  }
  Chart.line(el, {
    dates: h.map((x) => x.date),
    series: [{ name: "最高値", cls: "s1", values: h.map((x) => x.price) }],
    extra: (i) => `<div class="muted">${esc(h[i].best.join("・"))}${p.retail != null ? ` ・ 買取率 ${pct(h[i].price / p.retail)}` : ""}</div>`,
    ref: p.retail != null ? { label: "定価", value: p.retail } : null,
    markDay: currentCat === "iPhone" ? { day: 3, label: "水曜" } : null, // 水曜の記録に色を付ける
  }, $("tooltip"));
}
