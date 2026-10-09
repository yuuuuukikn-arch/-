// 個別ページ：ランキングと同じ価格の詳細（期間の切り替え・店舗の表・推移グラフ）を表示する
// 読み込む前に window.ITEM_PAGE = { cat, name } を設定しておく（tools/make_pages.js が書く）
(function () {
  const cfg = window.ITEM_PAGE;
  const view = document.getElementById("item-view");
  if (!cfg || !view) return;
  currentCat = cfg.cat;

  function show() {
    const p = buildProducts(cfg.cat).find((x) => x.name === cfg.name);
    view.innerHTML = p ? detail(p) : '<p class="note">この商品の価格データはまだありません。</p>';
    if (p) drawChart(p);
    const lead = document.getElementById("item-lead"); // 生成時の固定文（検索エンジン向け）は、同じ内容の結論の箱に置き換える
    if (lead && p) lead.hidden = true;
  }

  view.addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (!b || e.target.closest("a")) return;
    range = +b.dataset.range;
    show();
  });

  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(show, 150); });

  // テーマ切り替え（ランキングと同じ保存先）
  const root = document.documentElement;
  try { const saved = JSON.parse(localStorage.getItem("theme")); if (saved) root.dataset.theme = saved; } catch {}
  document.querySelector(".theme-toggle").addEventListener("click", () => {
    const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = isDark ? "light" : "dark";
    try { localStorage.setItem("theme", JSON.stringify(root.dataset.theme)); } catch {}
    show();
  });

  show();
})();
