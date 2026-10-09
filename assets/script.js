const MEDALS = ["🥇", "🥈", "🥉"];

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};


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

// 商品の個別ページへ移動（行・カードを押したとき）。場所は tools/make_pages.js が作る assets/item-pages.js
function goToItem(name) {
  const url = typeof ITEM_PAGES !== "undefined" && ITEM_PAGES[currentCat] && ITEM_PAGES[currentCat][name];
  if (url) location.href = url;
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const key = $("sort").value;
  const products = buildProducts(currentCat);
  let items = products.filter((p) => !q || p.name.toLowerCase().includes(q));
  // 定価が未登録の商品は最後に
  items.sort((a, b) => (a[key] == null) - (b[key] == null) || b[key] - a[key]);

  $("sampleNote").hidden = !products.some((p) => p.latest.sample);
  renderPodium(items.filter((p) => p[key] != null));
  renderUpdated();

  $("rows").innerHTML = items.length ? items.map((p, i) => {
    const sub = currentCat === "iPhone"
      ? (p.bestItem.colors ? `<small>最高値の色：${esc(Object.keys(p.bestItem.colors).filter((c) => p.bestItem.colors[c] === p.price).join("・"))}</small>` : "")
      : (p.bestItem.noShrink != null ? `<small>シュリンクなし ${yen(p.bestItem.noShrink)}</small>` : "") + (p.bestItem.note ? `<small class="memo">備考：${esc(p.bestItem.note)}</small>` : "");
    const row = `<tr class="row" data-name="${esc(p.name)}">
      <td class="num rank-cell"><span class="rank r${i + 1}">${i + 1}</span></td>
      <td class="name"><b>${disp(p.name)}${p.boost ? ' <span class="boost">強化</span>' : ""}</b>${sub}</td>
      <td class="num" data-label="定価">${p.retail != null ? yen(p.retail) + (p.estimated ? '<sup class="est" title="推定の定価">推定</sup>' : "") : '<span class="na">未登録</span>'}</td>
      <td class="num sealed" data-label="買取価格">${yen(p.price)}</td>
      <td class="shop-cell" data-label="店舗別（高い順）">${shopRanking(p)}</td>
      <td class="num" data-label="前回比">${p.hasPrev ? `<span class="chg ${sign(p.change)}">${p.change > 0 ? "▲" : p.change < 0 ? "▼" : "±"}${yen(Math.abs(p.change))}</span>` : '<span class="na">—</span>'}</td>
      <td class="num profit ${p.profit != null ? sign(p.profit) : ""}" data-label="利益">${p.profit != null ? signed(p.profit) : "—"}</td>
      <td class="num metric-cell" data-label="${useRate() ? "最高買取率" : "利益率"}">${rateCell(p)}</td>
    </tr>`;
    return row;
  }).join("") : `<tr><td colspan="8" class="empty">条件に合う商品がありません</td></tr>`;

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

// イベント
$("year").textContent = new Date().getFullYear();
["q", "sort"].forEach((id) => $(id).addEventListener("input", render));

function setCat(cat) {
  currentCat = cat;
  setSortOptions();
  document.querySelectorAll("[data-cat]").forEach((t) => { t.classList.toggle("active", t.dataset.cat === cat); t.setAttribute("aria-selected", t.dataset.cat === cat); });
  render();
}
$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-cat]");
  if (tab && tab.dataset.cat !== currentCat) { setCat(tab.dataset.cat); window.scrollTo({ top: 0 }); }
});

$("rows").addEventListener("click", (e) => {
  if (e.target.closest("a")) return; // 店舗リンクはそのまま開く
  const row = e.target.closest("tr.row");
  if (row) goToItem(row.dataset.name);
});

$("podium").addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const pod = e.target.closest("[data-open]");
  if (!pod) return;
  goToItem(pod.dataset.open);
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


// テーマ切り替え
const root = document.documentElement;
const savedTheme = store.get("theme", null);
if (savedTheme) root.dataset.theme = savedTheme;
document.querySelector(".theme-toggle").addEventListener("click", () => {
  const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = isDark ? "light" : "dark";
  store.set("theme", root.dataset.theme);
});

setSortOptions();
render();

// 注目（予約・抽選・新発売・注目商品）：掲載中のものだけ、新しい順に6件
(function () {
  if (typeof PAGES_PUBLIC === "undefined" || !$("attention")) return;
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const items = PAGES_PUBLIC
    .filter((p) => p.kind !== "article" && (!p.until || p.until >= today))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  if (!items.length) return;
  $("attList").innerHTML = items.map((p) =>
    `<a class="att-card" href="p/${esc(p.id)}.html"><span class="att-kind">${esc(p.kindLabel)}</span><b>${esc(p.title)}</b><small>${esc(p.summary)}</small></a>`
  ).join("");
  $("attention").hidden = false;
})();

// 記事（ランキングの下）：公開中の記事を新しい順に
(function () {
  if (typeof PAGES_PUBLIC === "undefined" || !$("articles")) return;
  const items = PAGES_PUBLIC.filter((p) => p.kind === "article").sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return;
  $("artList").innerHTML = items.map((p) =>
    `<a class="att-card" href="p/${esc(p.id)}.html"><span class="att-kind">記事</span><b>${esc(p.title)}</b><small>${esc(p.summary)}</small></a>`
  ).join("");
  $("articles").hidden = false;
})();

// X のリンク（SITE_CONFIG.xUrl が設定されているときだけ表示）
(function () {
  if (typeof SITE_CONFIG === "undefined" || !SITE_CONFIG.xUrl || !$("xLink")) return;
  $("xLink").href = SITE_CONFIG.xUrl;
  $("xLink").hidden = false;
})();

