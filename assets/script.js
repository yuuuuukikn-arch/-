const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";
const sign = (n) => (n > 0 ? "plus" : n < 0 ? "minus" : "zero");
const signed = (n) => (n > 0 ? "+" : "") + yen(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const disp = (name) => esc(name.replace(/】\s+/g, "】")); // 表示用（【MEGA】 30th → 【MEGA】30th）
const MEDALS = ["🥇", "🥈", "🥉"];

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

let currentCat = "iPhone";
let openName = null;
let range = 30;

// 実データがあるカテゴリはサンプルを使わない
const realCats = new Set(SNAPSHOTS.map((s) => s.cat));
const ALL = [...SNAPSHOTS, ...SAMPLE_SNAPSHOTS.filter((s) => !realCats.has(s.cat))];

// スマホ（iPhone）は買取率、ポケカは利益で比べる
const useRate = () => currentCat === "iPhone";
const SORTS = {
  rate:   ["rate", "買取率が高い順"],
  profit: ["profit", "利益が高い順"],
  roi:    ["roi", "利益率が高い順"],
  price:  ["price", "買取価格が高い順"],
  change: ["change", "前回から上がった順"],
};
function setSortOptions() {
  const keys = useRate() ? ["rate", "profit", "price", "change"] : ["profit", "roi", "price", "change"];
  $("sort").innerHTML = keys.map((k) => `<option value="${SORTS[k][0]}">${SORTS[k][1]}</option>`).join("");
  $("colRate").textContent = useRate() ? "買取率" : "利益率";
}
function rateCell(p) {
  if (useRate()) return p.rate != null ? `<span class="roi ${sign(p.rate - 1)}">${pct(p.rate)}</span>` : "—";
  return p.roi != null ? `<span class="roi ${sign(p.roi)}">${pct(p.roi)}</span>` : "—";
}

const SHOP_ORDER = Object.keys(SHOPS);
const shopIdx = (shop) => { const i = SHOP_ORDER.indexOf(shop); return i < 0 ? SHOP_ORDER.length : i; };

// 店舗名（公式サイトへのリンク付き）
function shopLink(shop, cls = "") {
  const info = SHOPS[shop];
  if (!info || !info.url) return `<span class="shop ${cls}">${esc(shop)}</span>`;
  return `<a class="shop ${cls}" href="${esc(info.url)}" target="_blank" rel="noopener">${esc(shop)}<span aria-hidden="true">↗</span></a>`;
}

// 店舗を買取価格の高い順に並べた一覧（1行まるごと店のサイトへのリンク）
function shopRanking(p, limit = 3) {
  const list = Object.entries(p.latest.shops)
    .map(([shop, it]) => ({ shop, price: it.sealed, date: it.date }))
    .sort((a, b) => b.price - a.price || shopIdx(a.shop) - shopIdx(b.shop));
  let rank = 0;
  return `<ol class="shop-rank">${list.slice(0, limit).map((x, i) => {
    if (i === 0 || x.price < list[i - 1].price) rank = i + 1; // 同じ価格は同じ順位
    const info = SHOPS[x.shop] || {};
    const metric = p.retail == null ? "" : useRate()
      ? `<span class="sr-metric ${sign(x.price - p.retail)}">${pct(x.price / p.retail)}</span>`
      : `<span class="sr-metric ${sign(x.price - p.retail)}">${signed(x.price - p.retail)}</span>`;
    const inner = `<span class="sr-pos r${rank}">${rank}位</span><span class="sr-name">${esc(x.shop)}${x.date < p.latest.date ? `<small>${x.date.slice(5).replace("-", "/")}時点</small>` : ""}</span><span class="sr-price">${yen(x.price)}</span>${metric}<span class="sr-go" aria-hidden="true">${info.url ? "›" : ""}</span>`;
    return `<li>${info.url ? `<a class="sr-row ${rank === 1 ? "top" : ""}" href="${esc(info.url)}" target="_blank" rel="noopener" aria-label="${esc(x.shop)}のサイトを開く（${yen(x.price)}）">${inner}</a>` : `<div class="sr-row ${rank === 1 ? "top" : ""}">${inner}</div>`}</li>`;
  }).join("")}</ol>`;
}

// 商品ごとに、日付 → 店舗ごとの価格 をまとめる
// 店ごとの価格は、その店の最新の取り込みを「STALE_DAYS 日」まで有効として扱う
// （店によって取り込む日がずれても、比較から消えないように）
const STALE_DAYS = 3;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

function buildProducts(cat) {
  // 商品 → 店 → 日付順の価格
  const map = new Map();
  for (const snap of ALL.filter((s) => s.cat === cat)) {
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

function render() {
  const q = $("q").value.trim().toLowerCase();
  const key = $("sort").value;
  const products = buildProducts(currentCat);
  let items = products.filter((p) =>
    (!q || p.name.toLowerCase().includes(q)) &&
    (!$("onlyProfit").checked || p.profit > 0)
  );
  // 定価が未登録の商品は最後に
  items.sort((a, b) => (a[key] == null) - (b[key] == null) || b[key] - a[key]);

  $("sampleNote").hidden = !products.some((p) => p.latest.sample);
  renderPodium(items.filter((p) => p[key] != null));
  renderUpdated();

  $("rows").innerHTML = items.length ? items.map((p, i) => {
    const sub = currentCat === "iPhone"
      ? (p.bestItem.colors ? `<small>最高値の色：${esc(Object.keys(p.bestItem.colors).filter((c) => p.bestItem.colors[c] === p.price).join("・"))}</small>` : "")
      : (p.bestItem.noShrink != null ? `<small>シュリンクなし ${yen(p.bestItem.noShrink)}</small>` : "") + (p.bestItem.note ? `<small class="memo">備考：${esc(p.bestItem.note)}</small>` : "");
    const row = `<tr class="row ${openName === p.name ? "open" : ""}" data-name="${esc(p.name)}">
      <td class="num rank-cell"><span class="rank r${i + 1}">${i + 1}</span></td>
      <td class="name"><b>${disp(p.name)}${p.boost ? ' <span class="boost">強化</span>' : ""}</b>${sub}</td>
      <td class="num" data-label="定価">${p.retail != null ? yen(p.retail) + (p.estimated ? '<sup class="est" title="推定の定価">推定</sup>' : "") : '<span class="na">未登録</span>'}</td>
      <td class="num sealed" data-label="買取価格">${yen(p.price)}</td>
      <td class="shop-cell" data-label="店舗別（高い順）">${shopRanking(p)}</td>
      <td class="num" data-label="前回比">${p.hasPrev ? `<span class="chg ${sign(p.change)}">${p.change > 0 ? "▲" : p.change < 0 ? "▼" : "±"}${yen(Math.abs(p.change))}</span>` : '<span class="na">—</span>'}</td>
      <td class="spark-cell" data-label="推移">${Chart.sparkline(p.history.map((h) => h.price))}</td>
      <td class="num profit ${p.profit != null ? sign(p.profit) : ""}" data-label="利益">${p.profit != null ? signed(p.profit) : "—"}</td>
      <td class="num metric-cell" data-label="${useRate() ? "最高買取率" : "利益率"}">${rateCell(p)}</td>
    </tr>`;
    return row + (openName === p.name ? `<tr class="detail"><td colspan="9">${detail(p)}</td></tr>` : "");
  }).join("") : `<tr><td colspan="9" class="empty">条件に合う商品がありません</td></tr>`;

  if (openName) drawChart(items.find((p) => p.name === openName));
}

function renderPodium(items) {
  const label = $("sort").selectedOptions[0].textContent.replace("が高い順", "").replace("から上がった順", "比");
  $("podium").innerHTML = items.slice(0, 3).map((p, i) => `
    <article class="pod pod${i + 1}" data-open="${esc(p.name)}">
      <div class="pod-head"><span class="medal">${MEDALS[i]}</span><span class="muted">${i + 1}位 ・ ${label}</span>${p.boost ? '<span class="boost">強化</span>' : ""}</div>
      <h3>${disp(p.name)}</h3>
      ${useRate()
        ? `<div class="pod-profit ${p.rate != null ? sign(p.rate - 1) : ""}"><small>買取率</small>${p.rate != null ? pct(p.rate) : "—"}</div>`
        : `<div class="pod-profit ${p.profit != null ? sign(p.profit) : ""}">${p.profit != null ? signed(p.profit) : "—"}</div>`}
      <div class="pod-meta">
        ${useRate()
          ? `<span>利益 <b class="${p.profit != null ? sign(p.profit) : ""}">${p.profit != null ? signed(p.profit) : "—"}</b></span>`
          : `<span>利益率 <b class="${sign(p.roi)}">${p.roi != null ? pct(p.roi) : "—"}</b></span>`}
        <span>買取 ${yen(p.price)}</span>
        <span>定価 ${p.retail != null ? yen(p.retail) : "—"}</span>
      </div>
      <div class="pod-shop">最高値の店：<b>${p.latest.best.map(esc).join("・")}</b></div>
      <div class="pod-spark">${Chart.sparkline(p.history.map((h) => h.price), 120, 30)}</div>
    </article>`).join("");
}

function renderUpdated() {
  const dates = ALL.filter((s) => s.cat === currentCat).map((s) => s.date).sort();
  const last = dates[dates.length - 1];
  // 掲載店：各商品の比較に使っている店（各店の最新価格が有効期間内のもの）
  const shops = [...new Set(buildProducts(currentCat).flatMap((p) => Object.keys(p.latest.shops)))].sort((a, b) => shopIdx(a) - shopIdx(b));
  $("updated").innerHTML = last ? `価格更新日：${last.replaceAll("-", ".")} ・ 記録 ${new Set(dates).size}日分 ・ 掲載店：${shops.map((sh) => shopLink(sh)).join("")}` : "";
}

// 店舗ごとの価格表（iPhone は色別）
function shopTable(p) {
  const shops = Object.keys(p.latest.shops).sort((a, b) => shopIdx(a) - shopIdx(b));
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
    ${h.length < 2 ? '<p class="note">データが2日分以上たまると線グラフになります。毎日価格を送ってもらうと推移が見えるようになります。</p>' : ""}
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

// イベント
$("year").textContent = new Date().getFullYear();
["q", "sort", "onlyProfit"].forEach((id) => $(id).addEventListener("input", render));

function setCat(cat) {
  currentCat = cat;
  setSortOptions();
  document.querySelectorAll("[data-cat]").forEach((t) => { t.classList.toggle("active", t.dataset.cat === cat); t.setAttribute("aria-selected", t.dataset.cat === cat); });
  openName = null;
  render();
}
$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-cat]");
  if (tab && tab.dataset.cat !== currentCat) { setCat(tab.dataset.cat); window.scrollTo({ top: 0 }); }
});

$("rows").addEventListener("click", (e) => {
  if (e.target.closest("a")) return; // 店舗リンクはそのまま開く
  const rangeBtn = e.target.closest("[data-range]");
  if (rangeBtn) { range = +rangeBtn.dataset.range; return render(); }
  const row = e.target.closest("tr.row");
  if (row) { openName = openName === row.dataset.name ? null : row.dataset.name; render(); }
});

$("podium").addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const pod = e.target.closest("[data-open]");
  if (!pod) return;
  openName = pod.dataset.open;
  render();
  document.querySelector("tr.row.open").scrollIntoView({ behavior: "smooth", block: "start" });
});

// 速報（見出しの位置に1件ずつ。複数あれば5秒ごとに切り替え）
function startFlash() {
  const el = $("flash");
  // 表示期間内のものだけ（date 〜 until。until が無ければ date から NEWS_DAYS 日間）
  const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD（端末の日付）
  const endOf = (n) => n.until || new Date(Date.parse(n.date) + ((typeof NEWS_DAYS === "number" ? NEWS_DAYS : 7) - 1) * 864e5).toISOString().slice(0, 10);
  const news = (typeof NEWS === "undefined" ? [] : NEWS)
    .filter((n) => n.date <= today && today <= endOf(n))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!news.length) { el.hidden = true; return; }
  let i = 0;
  const show = () => {
    const n = news[i];
    const body = `<span class="flash-label">速報</span>
      <span class="flash-text"><small>${n.date.slice(5).replace("-", "/")}${n.tag ? " ・ " + esc(n.tag) : ""}</small>${esc(n.title)}</span>
      ${news.length > 1 ? `<span class="flash-count">${i + 1}/${news.length}</span>` : ""}
      <span class="flash-go" aria-hidden="true">›</span>`;
    el.innerHTML = `<a class="flash-inner" href="news.html#${encodeURIComponent(n.id || "")}">${body}</a>`;
  };
  show();
  if (news.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => { i = (i + 1) % news.length; show(); }, 5000);
  }
}
startFlash();

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => openName && render(), 150); });

// テーマ切り替え
const root = document.documentElement;
const savedTheme = store.get("theme", null);
if (savedTheme) root.dataset.theme = savedTheme;
document.querySelector(".theme-toggle").addEventListener("click", () => {
  const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = isDark ? "light" : "dark";
  store.set("theme", root.dataset.theme);
  if (openName) render();
});

setSortOptions();
render();

// 注目（予約・抽選・新発売・注目商品）：掲載中のものだけ、新しい順に6件
(function () {
  if (typeof PAGES_PUBLIC === "undefined" || !$("attention")) return;
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const items = PAGES_PUBLIC
    .filter((p) => !p.until || p.until >= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  if (!items.length) return;
  $("attList").innerHTML = items.map((p) =>
    `<a class="att-card" href="p/${esc(p.id)}.html"><span class="att-kind">${esc(p.kindLabel)}</span><b>${esc(p.title)}</b><small>${esc(p.summary)}</small></a>`
  ).join("");
  $("attention").hidden = false;
})();

