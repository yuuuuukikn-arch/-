// 共通の部品（ランキングと個別ページで使う）：価格の集計・店舗表・推移グラフ
const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";
const sign = (n) => (n > 0 ? "plus" : n < 0 ? "minus" : "zero");
const signed = (n) => (n > 0 ? "+" : "") + yen(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
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

// 店舗名（公式サイトへのリンク付き）
function shopLink(shop, cls = "") {
  const info = SHOPS[shop];
  if (!info || !info.url) return `<span class="shop ${cls}">${esc(shop)}</span>`;
  return `<a class="shop ${cls}" href="${esc(info.url)}" target="_blank" rel="noopener">${esc(shop)}<span aria-hidden="true">↗</span></a>`;
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
// 店舗ごとの価格表（iPhone は色別）
function shopTable(p) {
  const shops = p.latest.best.slice().sort((a, b) => shopIdx(a) - shopIdx(b)); // 表は最高値（1位）の店舗だけ
  const its = shops.map((sh) => p.latest.shops[sh]);
  const head = `<th>店舗</th>`;
  const cell = (v, best) => `<td class="num ${v != null && v === best ? "best-price" : ""}">${v != null ? yen(v) : '<span class="na">—</span>'}</td>`;
  const rowsHtml = (labels, valueOf) => labels.map((label) => {
    const vals = its.map((it) => valueOf(it, label));
    const best = Math.max(...vals.filter((v) => v != null));
    const prof = p.retail != null && isFinite(best) ? best - p.retail : null;
    const last = prof == null ? "—" : useRate() ? `${pct(best / p.retail)}<small class="muted">（${signed(prof)}）</small>` : signed(prof);
    return `<tr><th scope="row">${esc(label)}</th>${vals.map((v) => cell(v, best)).join("")}<td class="num ${prof != null ? sign(prof) : ""}">${last}</td></tr>`;
  }).join("");
  const shopHead = shops.map((sh) => `<th class="num">${shopLink(sh)}${p.latest.shops[sh].date < p.latest.date ? `<small class="stale">${p.latest.shops[sh].date.slice(5).replace("-", "/")}時点</small>` : ""}</th>`).join("");
  const hasColors = its.some((it) => it.colors);
  const body = hasColors
    ? rowsHtml(IPHONE_COLORS, (it, c) => (it.colors ? it.colors[c] ?? null : null))
    : rowsHtml(["未開封"], (it) => it.sealed);
  const notes = shops.map((sh) => {
    const it = p.latest.shops[sh], info = SHOPS[sh] || {};
    const bits = [it.noShrink != null ? `シュリンクなし ${yen(it.noShrink)}` : "", it.note || "", info.hours ? `営業時間 ${info.hours}` : ""].filter(Boolean);
    return bits.length ? `<li>${shopLink(sh)}：${esc(bits.join(" ／ "))}</li>` : "";
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

function detail(p) {
  const h = p.history;
  const first = h[0], last = h[h.length - 1];
  const hi = h.reduce((a, b) => (b.price > a.price ? b : a));
  const lo = h.reduce((a, b) => (b.price < a.price ? b : a));
  return `<div class="detail-wrap">
    <div class="chart-head">
      <div>
        <h3>${disp(p.name)} の買取価格推移</h3>
        <div class="legend">
          <span><i class="key s1"></i>最高値（各店で一番高い買取価格）</span>
          ${p.retail != null ? `<span><i class="key ref-key"></i>定価${p.estimated ? "（推定）" : ""}</span>` : ""}
        </div>
      </div>
      <div class="range" role="group" aria-label="期間">
        ${[[7, "7日"], [30, "30日"], [0, "全期間"]].map(([v, l]) => `<button class="${range === v ? "active" : ""}" data-range="${v}">${l}</button>`).join("")}
      </div>
    </div>
    <div class="chart" id="chart"></div>
    <div class="detail-stats">
      <div><span>期間内の最高値</span><b>${yen(hi.price)}</b><small>${hi.date.replaceAll("-", "/")}</small></div>
      <div><span>期間内の最安値</span><b>${yen(lo.price)}</b><small>${lo.date.replaceAll("-", "/")}</small></div>
      <div><span>記録開始からの変化</span><b class="${sign(last.price - first.price)}">${signed(last.price - first.price)}</b><small>${first.date.replaceAll("-", "/")} から</small></div>
      <div><span>${useRate() ? "買取率" : "定価との差"}</span><b class="${p.profit != null ? sign(p.profit) : ""}">${useRate() ? (p.rate != null ? pct(p.rate) : "—") : (p.profit != null ? signed(p.profit) : "—")}</b><small>${p.retail != null ? (useRate() ? `利益 ${signed(p.profit)} ・ ` : "") + "定価 " + yen(p.retail) : "定価未登録"}</small></div>
    </div>
    ${shopTable(p)}
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
  }, $("tooltip"));
}
