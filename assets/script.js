const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";
const sign = (n) => (n >= 0 ? "plus" : "minus");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

// 手数料（保存された設定があれば上書き）
const DEFAULT_RATES = Object.fromEntries(Object.entries(CHANNELS).map(([k, c]) => [k, c.rate]));
let rates = { ...DEFAULT_RATES, ...store.get("rates", {}) };
let stars = new Set(store.get("stars", []));
let openId = null;

// 販路ごとの手取りと利益を計算
function calc(buy, price, ship, rate) {
  const fee = Math.floor(price * rate / 100);
  const profit = price - fee - ship - buy;
  return { price, fee, ship, profit, roi: buy ? profit / buy : 0 };
}

function analyze(p) {
  const channels = Object.keys(CHANNELS)
    .filter((k) => p.prices[k] != null)
    .map((k) => ({ key: k, ...calc(p.buy, p.prices[k], p.ship, rates[k]) }));
  const best = channels.reduce((a, b) => (b.profit > a.profit ? b : a), channels[0]);
  return { ...p, channels, best, profit: best ? best.profit : 0, roi: best ? best.roi : 0 };
}

// 一覧の描画
function render() {
  const q = $("q").value.trim().toLowerCase();
  const cat = $("cat").value;
  const sortKey = $("sort").value;
  let items = PRODUCTS.map(analyze).filter((p) =>
    (!q || (p.name + p.store).toLowerCase().includes(q)) &&
    (!cat || p.cat === cat) &&
    (!$("onlyProfit").checked || p.profit > 0) &&
    (!$("onlyStar").checked || stars.has(p.id))
  );
  items.sort((a, b) => sortKey === "buy" ? a.buy - b.buy : b[sortKey] - a[sortKey]);

  const maxSold = Math.max(...PRODUCTS.map((p) => p.sold));
  $("rows").innerHTML = items.length ? items.map((p) => {
    const cells = Object.keys(CHANNELS).map((k) => {
      const v = p.prices[k];
      const label = `data-label="${CHANNELS[k].name}"`;
      if (v == null) return `<td class="num na" ${label}>—</td>`;
      return `<td class="num ${p.best.key === k ? "best-price" : ""}" ${label}>${yen(v)}</td>`;
    }).join("");
    const hot = p.sold >= maxSold * 0.5 ? ' <span class="hot" title="よく売れています">🔥</span>' : "";
    const row = `<tr class="row" data-id="${p.id}">
      <td class="star-cell"><button class="star ${stars.has(p.id) ? "on" : ""}" data-star="${p.id}" aria-label="ウォッチ">${stars.has(p.id) ? "★" : "☆"}</button></td>
      <td class="name"><b>${esc(p.name)}</b><small>${esc(p.cat)} ・ ${esc(p.store)}</small></td>
      <td class="num" data-label="仕入れ値">${yen(p.buy)}</td>
      ${cells}
      <td class="best-ch" data-label="おすすめ"><span class="pill">${CHANNELS[p.best.key].name}</span></td>
      <td class="num profit ${sign(p.profit)}" data-label="利益">${p.profit > 0 ? "+" : ""}${yen(p.profit)}</td>
      <td class="num" data-label="利益率"><span class="roi ${sign(p.roi)}">${pct(p.roi)}</span></td>
      <td class="num" data-label="月間販売">${p.sold}個${hot}</td>
    </tr>`;
    return row + (openId === p.id ? detailRow(p) : "");
  }).join("") : `<tr><td colspan="11" class="empty">条件に合う商品がありません</td></tr>`;

  renderStats(items);
}

function detailRow(p) {
  const maxAbs = Math.max(...p.channels.map((c) => Math.abs(c.profit)), 1);
  const cards = p.channels.map((c) => `
    <div class="ch ${c.key === p.best.key ? "best" : ""}">
      <h4>${CHANNELS[c.key].name}${c.key === p.best.key ? '<span class="plus">最高利益 ✓</span>' : ""}</h4>
      <dl>
        <dt>販売価格</dt><dd>${yen(c.price)}</dd>
        <dt>手数料（${rates[c.key]}%）</dt><dd>-${yen(c.fee)}</dd>
        <dt>送料</dt><dd>-${yen(c.ship)}</dd>
        <dt>仕入れ値</dt><dd>-${yen(p.buy)}</dd>
        <dt class="total">利益</dt><dd class="total ${sign(c.profit)}">${yen(c.profit)}（${pct(c.roi)}）</dd>
      </dl>
      <div class="bar"><i class="${c.profit < 0 ? "neg" : ""}" style="width:${Math.abs(c.profit) / maxAbs * 100}%"></i></div>
    </div>`).join("");
  return `<tr class="detail"><td colspan="11"><div class="breakdown">${cards}</div></td></tr>`;
}

function renderStats(items) {
  const black = items.filter((p) => p.profit > 0);
  const avgRoi = black.length ? black.reduce((s, p) => s + p.roi, 0) / black.length : 0;
  const top = items.reduce((a, b) => (!a || b.profit > a.profit ? b : a), null);
  $("stats").innerHTML = `
    <div class="stat"><span>黒字の商品</span><b>${black.length}<small> / ${items.length}</small></b></div>
    <div class="stat"><span>平均利益率（黒字）</span><b class="plus">${pct(avgRoi)}</b></div>
    <div class="stat"><span>最高利益</span><b class="${top ? sign(top.profit) : ""}">${top ? yen(top.profit) : "—"}</b></div>`;
}

// 利益計算ツール
function renderCalc() {
  const buy = +$("cBuy").value || 0, sell = +$("cSell").value || 0, ship = +$("cShip").value || 0;
  const rate = rates[$("cCh").value];
  const r = calc(buy, sell, ship, rate);
  const breakEven = Math.ceil((buy + ship) / (1 - rate / 100));
  $("cResult").innerHTML = `
    <span class="muted">利益</span>
    <div class="big ${sign(r.profit)}">${r.profit > 0 ? "+" : ""}${yen(r.profit)}</div>
    <dl>
      <dt>利益率</dt><dd class="${sign(r.roi)}">${pct(r.roi)}</dd>
      <dt>手数料（${rate}%）</dt><dd>${yen(r.fee)}</dd>
      <dt>手取り（手数料・送料を引いた額）</dt><dd>${yen(sell - r.fee - ship)}</dd>
      <dt>損益分岐の販売価格</dt><dd>${yen(breakEven)}</dd>
    </dl>`;
}

// 手数料設定
function renderFees() {
  $("fees").innerHTML = Object.entries(CHANNELS).map(([k, c]) =>
    `<label>${c.name}（%）<input type="number" step="0.1" min="0" max="100" data-fee="${k}" value="${rates[k]}"></label>`).join("");
}

// 初期化
$("year").textContent = new Date().getFullYear();
[...new Set(PRODUCTS.map((p) => p.cat))].forEach((c) => $("cat").insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));
Object.entries(CHANNELS).forEach(([k, c]) => $("cCh").insertAdjacentHTML("beforeend", `<option value="${k}">${c.name}</option>`));

["q", "cat", "sort", "onlyProfit", "onlyStar"].forEach((id) => $(id).addEventListener("input", render));
["cBuy", "cSell", "cShip", "cCh"].forEach((id) => $(id).addEventListener("input", renderCalc));

$("rows").addEventListener("click", (e) => {
  const starBtn = e.target.closest("[data-star]");
  if (starBtn) {
    const id = +starBtn.dataset.star;
    stars.has(id) ? stars.delete(id) : stars.add(id);
    store.set("stars", [...stars]);
    return render();
  }
  const row = e.target.closest("tr.row");
  if (row) { const id = +row.dataset.id; openId = openId === id ? null : id; render(); }
});

$("fees").addEventListener("input", (e) => {
  const k = e.target.dataset.fee;
  if (!k) return;
  rates[k] = Math.min(100, Math.max(0, +e.target.value || 0));
  store.set("rates", rates);
  render(); renderCalc();
});
$("resetFees").addEventListener("click", () => {
  rates = { ...DEFAULT_RATES };
  store.set("rates", rates);
  renderFees(); render(); renderCalc();
});

// テーマ切り替え
const root = document.documentElement;
const savedTheme = store.get("theme", null);
if (savedTheme) root.dataset.theme = savedTheme;
document.querySelector(".theme-toggle").addEventListener("click", () => {
  const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = isDark ? "light" : "dark";
  store.set("theme", root.dataset.theme);
});

renderFees();
render();
renderCalc();
