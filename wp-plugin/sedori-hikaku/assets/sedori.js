// 買取相場ナビ（WordPress）：並び替え・検索・詳細のグラフ
(function () {
  "use strict";
  var yen = function (n) { return (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP"); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  var tooltip = document.createElement("div");
  tooltip.className = "sdr-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  function drawChart(item, range) {
    var el = item.querySelector(".sdr-chart");
    if (!el || typeof SedoriChart === "undefined") return;
    var h = JSON.parse(item.getAttribute("data-history") || "[]"); // [日付, 最高値, 店]
    if (range) {
      var cutoff = Date.parse(h[h.length - 1][0]) - (range - 1) * 864e5;
      h = h.filter(function (x) { return Date.parse(x[0]) >= cutoff; });
    }
    var retail = parseFloat(item.getAttribute("data-retail"));
    SedoriChart.line(el, {
      dates: h.map(function (x) { return x[0]; }),
      series: [{ name: "最高値", cls: "s1", values: h.map(function (x) { return x[1]; }) }],
      ref: isNaN(retail) ? null : { label: "定価", value: retail },
      extra: function (i) {
        return '<div class="muted">' + esc(h[i][2]) + (isNaN(retail) ? "" : " ・ 買取率 " + (h[i][1] / retail * 100).toFixed(1) + "%") + "</div>";
      },
    }, tooltip);
  }

  document.querySelectorAll(".sdr").forEach(function (root) {
    var list = root.querySelector(".sdr-list");
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll(".sdr-item"));
    var ads = Array.prototype.slice.call(list.querySelectorAll(".sdr-ad"));
    var q = root.querySelector(".sdr-q");
    var sort = root.querySelector(".sdr-sort");

    function apply() {
      var key = sort.value;
      var word = q.value.trim().toLowerCase();
      var num = function (el) { var v = el.getAttribute("data-" + key); return v === "" ? -Infinity : parseFloat(v); };
      var shown = items.filter(function (el) {
        var ok = !word || el.getAttribute("data-name").toLowerCase().indexOf(word) >= 0;
        el.hidden = !ok;
        return ok;
      }).sort(function (a, b) { return num(b) - num(a); });
      // 並び替えた順に入れ直し、広告は元の間隔で挟む
      var every = ads.length ? parseInt(list.getAttribute("data-every"), 10) || 5 : 0;
      var adIdx = 0;
      shown.forEach(function (el, i) {
        list.appendChild(el);
        var r = el.querySelector(".sdr-rank");
        r.textContent = i + 1;
        r.className = "sdr-rank r" + (i + 1);
        if (every && (i + 1) % every === 0 && adIdx < ads.length && i + 1 < shown.length) list.appendChild(ads[adIdx++]);
      });
      for (; adIdx < ads.length; adIdx++) list.appendChild(ads[adIdx]);
    }
    q.addEventListener("input", apply);
    sort.addEventListener("change", apply);

    items.forEach(function (item) {
      var d = item.querySelector(".sdr-detail");
      d.addEventListener("toggle", function () { if (d.open) drawChart(item, 30); });
      d.addEventListener("click", function (e) {
        var b = e.target.closest("[data-range]");
        if (!b) return;
        d.querySelectorAll("[data-range]").forEach(function (x) { x.classList.toggle("active", x === b); });
        drawChart(item, parseInt(b.getAttribute("data-range"), 10));
      });
    });

    // 上位3つのカードを押したら、その商品の詳細を開く
    root.querySelectorAll(".sdr-pod").forEach(function (a) {
      a.addEventListener("click", function () {
        var t = document.getElementById(a.getAttribute("href").slice(1));
        if (t) { var d = t.querySelector(".sdr-detail"); if (d) d.open = true; }
      });
    });
  });

  var timer;
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      document.querySelectorAll(".sdr-detail[open]").forEach(function (d) {
        var b = d.querySelector("[data-range].active");
        drawChart(d.closest(".sdr-item"), b ? parseInt(b.getAttribute("data-range"), 10) : 30);
      });
    }, 150);
  });
})();
