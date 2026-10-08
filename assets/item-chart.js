// 個別ページの価格推移（ランキングの詳細と同じ。期間の切り替えと、店舗名つきの表示）
(function () {
  const data = window.ITEM_CHART;
  const el = document.getElementById("chart");
  const tip = document.getElementById("tooltip");
  const bar = document.querySelector(".range");
  if (!data || !el || !bar || typeof Chart === "undefined") return;

  const RANGES = [[7, "7日"], [30, "30日"], [0, "全期間"]];
  const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
  const pct = (n) => (n * 100).toFixed(1) + "%";
  let range = 30;

  bar.innerHTML = RANGES.map(([v, l]) => `<button data-range="${v}">${l}</button>`).join("");

  function draw() {
    let h = data.history;
    if (range) {
      const cutoff = Date.parse(h[h.length - 1].date) - (range - 1) * 864e5;
      h = h.filter((x) => Date.parse(x.date) >= cutoff);
    }
    bar.querySelectorAll("button").forEach((b) => b.classList.toggle("active", Number(b.dataset.range) === range));
    if (!h.length) return;
    Chart.line(el, {
      dates: h.map((x) => x.date),
      series: [{ name: "最高値", cls: "s1", values: h.map((x) => x.price) }],
      extra: (i) => `<div class="muted">${h[i].best.join("・")}${data.retail != null ? ` ・ 買取率 ${pct(h[i].price / data.retail)}` : ""}</div>`,
      ref: data.retail != null ? { label: "定価", value: data.retail } : null,
    }, tip);
  }

  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    range = Number(b.dataset.range);
    draw();
  });
  window.addEventListener("resize", draw);
  draw();
})();
