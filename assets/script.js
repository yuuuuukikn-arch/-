const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";
const sign = (n) => (n > 0 ? "plus" : n < 0 ? "minus" : "zero");
const signed = (n) => (n > 0 ? "+" : "") + yen(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const MEDALS = ["🥇", "🥈", "🥉"];

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

let currentCat = "iPhone";
let stars = new Set(store.get("stars", []));
let openName = null;
let range = 30;

// 実データがあるカテゴリはサンプルを使わない
const realCats = new Set(SNAPSHOTS.map((s) => s.cat));
const ALL = [...SNAPSHOTS, ...SAMPLE_SNAPSHOTS.filter((s) => !realCats.has(s.cat))];

// 商品ごとに日付順の履歴をまとめる（同じ日に複数店あれば一番高い店）
function buildProducts(cat) {
  const map = new Map();
  for (const snap of ALL.filter((s) => s.cat === cat)) {
    for (const [name, it] of Object.entries(snap.items)) {
      if (it.sealed == null) continue;
      if (SHOW_ONLY[cat] && !SHOW_ONLY[cat].test(name)) continue;
      if (!map.has(name)) map.set(name, new Map());
      const byDate = map.get(name);
      const cur = byDate.get(snap.date);
      if (!cur || it.sealed > cur.price) byDate.set(snap.date, { price: it.sealed, note: it.note, boost: it.boost, date: snap.date, shop: snap.shop, sample: snap.sample });
    }
  }
  return [...map].map(([name, byDate]) => {
    const history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    const info = CATALOG[name] || {};
    const retail = info.retail ?? null;
    const profit = retail != null ? latest.price - retail : null;
    return {
      name, history, latest, retail, estimated: !!info.estimated,
      profit, roi: profit != null ? profit / retail : null,
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
    (!$("onlyProfit").checked || p.profit > 0) &&
    (!$("onlyStar").checked || stars.has(p.name))
  );
  // 定価が未登録の商品は最後に
  items.sort((a, b) => (a[key] == null) - (b[key] == null) || b[key] - a[key]);

  $("sampleNote").hidden = !products.some((p) => p.latest.sample);
  renderPodium(items.filter((p) => p[key] != null));
  renderStats(products);

  $("rows").innerHTML = items.length ? items.map((p, i) => {
    const row = `<tr class="row ${openName === p.name ? "open" : ""}" data-name="${esc(p.name)}">
      <td class="num rank-cell"><span class="rank r${i + 1}">${i + 1}</span></td>
      <td class="star-cell"><button class="star ${stars.has(p.name) ? "on" : ""}" data-star="${esc(p.name)}" aria-label="ウォッチ">${stars.has(p.name) ? "★" : "☆"}</button></td>
      <td class="name"><b>${esc(p.name)}${p.latest.boost ? ' <span class="boost">強化</span>' : ""}</b>${p.latest.note ? `<small>色・状態の減額：${esc(p.latest.note)}</small>` : ""}</td>
      <td class="num" data-label="定価">${p.retail != null ? yen(p.retail) + (p.estimated ? '<sup class="est" title="推定の定価">推定</sup>' : "") : '<span class="na">未登録</span>'}</td>
      <td class="num sealed" data-label="買取価格（未開封）">${yen(p.price)}</td>
      <td class="num" data-label="前回比">${p.hasPrev ? `<span class="chg ${sign(p.change)}">${p.change > 0 ? "▲" : p.change < 0 ? "▼" : "±"}${yen(Math.abs(p.change))}</span>` : '<span class="na">—</span>'}</td>
      <td class="spark-cell" data-label="推移">${Chart.sparkline(p.history.map((h) => h.price))}</td>
      <td class="num profit ${p.profit != null ? sign(p.profit) : ""}" data-label="利益">${p.profit != null ? signed(p.profit) : "—"}</td>
      <td class="num" data-label="利益率">${p.roi != null ? `<span class="roi ${sign(p.roi)}">${pct(p.roi)}</span>` : "—"}</td>
    </tr>`;
    return row + (openName === p.name ? `<tr class="detail"><td colspan="9">${detail(p)}</td></tr>` : "");
  }).join("") : `<tr><td colspan="9" class="empty">条件に合う商品がありません</td></tr>`;

  if (openName) drawChart(items.find((p) => p.name === openName));
}

function renderPodium(items) {
  const label = $("sort").selectedOptions[0].textContent.replace("が高い順", "").replace("から上がった順", "比");
  $("podium").innerHTML = items.slice(0, 3).map((p, i) => `
    <article class="pod pod${i + 1}" data-open="${esc(p.name)}">
      <div class="pod-head"><span class="medal">${MEDALS[i]}</span><span class="muted">${i + 1}位 ・ ${label}</span>${p.latest.boost ? '<span class="boost">強化</span>' : ""}</div>
      <h3>${esc(p.name)}</h3>
      <div class="pod-profit ${p.profit != null ? sign(p.profit) : ""}">${p.profit != null ? signed(p.profit) : "—"}</div>
      <div class="pod-meta">
        <span>利益率 <b class="${sign(p.roi)}">${p.roi != null ? pct(p.roi) : "—"}</b></span>
        <span>買取 ${yen(p.price)}</span>
        <span>定価 ${p.retail != null ? yen(p.retail) : "—"}</span>
      </div>
      <div class="pod-spark">${Chart.sparkline(p.history.map((h) => h.price), 120, 30)}</div>
    </article>`).join("");
}

function renderStats(products) {
  const withProfit = products.filter((p) => p.profit != null);
  const black = withProfit.filter((p) => p.profit > 0);
  const top = withProfit.reduce((a, b) => (!a || b.profit > a.profit ? b : a), null);
  const dates = ALL.filter((s) => s.cat === currentCat).map((s) => s.date).sort();
  const last = dates[dates.length - 1];
  const shops = [...new Set(ALL.filter((s) => s.cat === currentCat && s.date === last).map((s) => s.shop))];
  $("updated").textContent = last ? `価格更新日：${last.replaceAll("-", ".")}（${shops.join("・")}）・ 記録 ${new Set(dates).size}日分` : "";
  $("stats").innerHTML = `
    <div class="stat"><span>黒字の商品</span><b>${black.length}<small> / ${withProfit.length}</small></b></div>
    <div class="stat"><span>最高利益</span><b class="${top ? sign(top.profit) : ""}">${top ? signed(top.profit) : "—"}</b><small class="muted">${top ? esc(top.name) : ""}</small></div>
    <div class="stat"><span>強化中</span><b>${products.filter((p) => p.latest.boost).length}<small> 件</small></b></div>`;
}

function detail(p) {
  const h = p.history;
  const first = h[0], last = h[h.length - 1];
  const hi = h.reduce((a, b) => (b.price > a.price ? b : a));
  const lo = h.reduce((a, b) => (b.price < a.price ? b : a));
  return `<div class="detail-wrap">
    <div class="chart-head">
      <div>
        <h3>${esc(p.name)} の買取価格推移</h3>
        <div class="legend">
          <span><i class="key s1"></i>買取価格（未開封）</span>
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
      <div><span>定価との差</span><b class="${p.profit != null ? sign(p.profit) : ""}">${p.profit != null ? signed(p.profit) : "—"}</b><small>${p.retail != null ? "定価 " + yen(p.retail) : "定価未登録"}</small></div>
    </div>
    ${p.latest.note ? `<p class="note">色・状態による減額（${esc(p.latest.shop)}の表記そのまま）：<b>${esc(p.latest.note)}</b></p>` : ""}
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
    series: [{ name: "買取価格", cls: "s1", values: h.map((x) => x.price) }],
    ref: p.retail != null ? { label: "定価", value: p.retail } : null,
  }, $("tooltip"));
}

// 利益計算
function renderCalc() {
  const buy = +$("cBuy").value || 0, sell = +$("cSell").value || 0;
  const point = Math.floor(buy * (+$("cPoint").value || 0) / 100), cost = +$("cCost").value || 0;
  const profit = sell - buy + point - cost;
  $("cResult").innerHTML = `
    <span class="muted">利益</span>
    <div class="big ${sign(profit)}">${signed(profit)}</div>
    <dl>
      <dt>利益率</dt><dd class="${sign(profit)}">${buy ? pct(profit / buy) : "—"}</dd>
      <dt>買取価格 − 仕入れ値</dt><dd>${signed(sell - buy)}</dd>
      <dt>ポイント還元</dt><dd>+${yen(point)}</dd>
      <dt>交通費・送料など</dt><dd>-${yen(cost)}</dd>
    </dl>`;
}

// イベント
$("year").textContent = new Date().getFullYear();
["q", "sort", "onlyProfit", "onlyStar"].forEach((id) => $(id).addEventListener("input", render));
["cBuy", "cSell", "cPoint", "cCost"].forEach((id) => $(id).addEventListener("input", renderCalc));

$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  currentCat = tab.dataset.cat;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
  openName = null;
  render();
});

$("rows").addEventListener("click", (e) => {
  const starBtn = e.target.closest("[data-star]");
  if (starBtn) {
    const n = starBtn.dataset.star;
    stars.has(n) ? stars.delete(n) : stars.add(n);
    store.set("stars", [...stars]);
    return render();
  }
  const rangeBtn = e.target.closest("[data-range]");
  if (rangeBtn) { range = +rangeBtn.dataset.range; return render(); }
  const row = e.target.closest("tr.row");
  if (row) { openName = openName === row.dataset.name ? null : row.dataset.name; render(); }
});

$("podium").addEventListener("click", (e) => {
  const pod = e.target.closest("[data-open]");
  if (!pod) return;
  openName = pod.dataset.open;
  render();
  document.querySelector("tr.row.open").scrollIntoView({ behavior: "smooth", block: "start" });
});

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

render();
renderCalc();
