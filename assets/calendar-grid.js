// 発売カレンダーのマス目（個別ページ・カレンダーページの下に置く）
(function () {
  "use strict";
  var WD = ["日", "月", "火", "水", "木", "金", "土"];
  var JST = 9 * 36e5;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var ymd = function (ms) {
    var d = new Date(ms + JST);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  };
  var hm = function (ms) {
    var d = new Date(ms + JST);
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  };

  // 日付ごとの予定（予約開始＝「予」、発売日＝「発」）
  function eventsByDay(list) {
    var map = {};
    var add = function (day, item) { (map[day] = map[day] || []).push(item); };
    list.forEach(function (r) {
      if (r.reserve && r.reserve.start) {
        var ms = Date.parse(r.reserve.start);
        add(ymd(ms), { k: "予", t: r.title, sub: "予約開始 " + hm(ms) });
      }
      if (r.release) add(r.release, { k: "発", t: r.title, sub: "発売日" });
    });
    return map;
  }

  function draw(root, map, y, m, todayKey) {
    var first = new Date(Date.UTC(y, m, 1));
    var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var cells = [];
    for (var i = 0; i < first.getUTCDay(); i++) cells.push("");
    for (var d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7) cells.push("");

    var head = '<div class="cg-head"><button type="button" class="cg-nav" data-step="-1" aria-label="前の月">‹</button>' +
      '<b>' + y + '年' + (m + 1) + '月</b>' +
      '<button type="button" class="cg-nav" data-step="1" aria-label="次の月">›</button></div>';
    var week = '<div class="cg-week">' + WD.map(function (w, i) { return '<span class="' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + w + '</span>'; }).join("") + '</div>';

    var grid = '<div class="cg-grid">' + cells.map(function (d) {
      if (!d) return '<span class="cg-cell empty"></span>';
      var key = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      var ev = map[key] || [];
      var cls = "cg-cell" + (key === todayKey ? " today" : "") + (ev.length ? " has" : "");
      var marks = ev.slice(0, 2).map(function (e) { return '<i class="cg-mark k' + e.k + '" title="' + esc(e.t) + '">' + e.k + '</i>'; }).join("");
      return '<span class="' + cls + '"><span class="cg-d">' + d + '</span>' + marks + '</span>';
    }).join("") + '</div>';

    // 今月の予定（一覧）
    var list = [];
    Object.keys(map).sort().forEach(function (key) {
      if (key.slice(0, 7) !== y + "-" + String(m + 1).padStart(2, "0")) return;
      map[key].forEach(function (e) { list.push('<li><b>' + Number(key.slice(8)) + '日</b> <span class="cg-k k' + e.k + '">' + e.k + '</span> ' + esc(e.t) + '<small>' + esc(e.sub) + '</small></li>'); });
    });
    var foot = list.length ? '<ul class="cg-list">' + list.join("") + '</ul>' : '<p class="cg-none">この月の予定はありません。</p>';

    root.innerHTML = '<div class="cg">' + head + week + grid + foot + '</div>';
    root.dataset.y = y;
    root.dataset.m = m;
  }

  document.querySelectorAll("[data-cal-grid]").forEach(function (root) {
    var list = typeof RELEASES_PUBLIC === "undefined" ? [] : RELEASES_PUBLIC;
    var map = eventsByDay(list);
    var now = Date.now() + JST;
    var t = new Date(now);
    var y = t.getUTCFullYear(), m = t.getUTCMonth();
    var todayKey = ymd(Date.now());
    // 最初に予定がある月があれば、その月から開く
    var keys = Object.keys(map).sort();
    if (keys.length && keys.every(function (k) { return k.slice(0, 7) !== y + "-" + String(m + 1).padStart(2, "0"); })) {
      var k0 = keys[0]; y = Number(k0.slice(0, 4)); m = Number(k0.slice(5, 7)) - 1;
    }
    draw(root, map, y, m, todayKey);
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".cg-nav");
      if (!b) return;
      var step = Number(b.getAttribute("data-step"));
      var ny = Number(root.dataset.y), nm = Number(root.dataset.m) + step;
      if (nm < 0) { nm = 11; ny--; } else if (nm > 11) { nm = 0; ny++; }
      draw(root, map, ny, nm, todayKey);
    });
  });
})();
