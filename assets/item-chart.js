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
    stats(h);
    Chart.line(el, {
      dates: h.map((x) => x.date),
      series: [{ name: "最高値", cls: "s1", values: h.map((x) => x.price) }],
      extra: (i) => `<div class="muted">${h[i].best.join("・")}${data.retail != null ? ` ・ 買取率 ${pct(h[i].price / data.retail)}` : ""}</div>`,
      ref: data.retail != null ? { label: "定価", value: data.retail } : null,
    }, tip);
  }

  // 期間内の最高値・最安値・記録開始からの変化・買取率（または定価との差）
  function stats(h) {
    const box = document.getElementById("item-stats");
    if (!box) return;
    const first = data.history[0], last = data.history[data.history.length - 1];
    const hi = h.reduce((a, b) => (b.price > a.price ? b : a));
    const lo = h.reduce((a, b) => (b.price < a.price ? b : a));
    const d = last.price - first.price;
    const sign = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");
    const signed = (n) => (n > 0 ? "+" : n < 0 ? "-" : "±") + yen(Math.abs(n));
    const slash = (s) => s.replaceAll("-", "/");
    const last4 = data.retail != null
      ? (data.useRate ? `<div><span>買取率</span><b>${pct(last.price / data.retail)}</b><small>利益 ${signed(last.price - data.retail)} ・ 定価 ${yen(data.retail)}</small></div>`
                      : `<div><span>定価との差</span><b class="${sign(last.price - data.retail)}">${signed(last.price - data.retail)}</b><small>定価 ${yen(data.retail)}</small></div>`)
      : `<div><span>定価</span><b>—</b><small>定価未登録</small></div>`;
    box.innerHTML = `
      <div><span>期間内の最高値</span><b>${yen(hi.price)}</b><small>${slash(hi.date)}</small></div>
      <div><span>期間内の最安値</span><b>${yen(lo.price)}</b><small>${slash(lo.date)}</small></div>
      <div><span>記録開始からの変化</span><b class="${sign(d)}">${signed(d)}</b><small>${slash(first.date)} から</small></div>
      ${last4}`;
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
