// 発売カレンダー（ページ表示・予約の記録はこの端末のみ）
(function () {
  "use strict";
  var KEY = "sedori-reserved";
  var WD = ["日", "月", "火", "水", "木", "金", "土"];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var get = function () { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  var put = function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

  // 日本時間の表示（例：10/16(金) 21:00）
  var jst = function (ms) {
    var d = new Date(ms + 9 * 36e5);
    return (d.getUTCMonth() + 1) + "/" + d.getUTCDate() + "(" + WD[d.getUTCDay()] + ")" +
      (d.getUTCHours() || d.getUTCMinutes() ? " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") : "");
  };

  var el = document.getElementById("cal");
  if (!el || typeof RELEASES_PUBLIC === "undefined") return;
  var now = Date.now();
  var list = RELEASES_PUBLIC.map(function (r) {
    var rs = r.reserve && r.reserve.start ? Date.parse(r.reserve.start) : null;
    var rel = r.release ? Date.parse(r.release + "T00:00:00+09:00") : null;
    var status = "発売日未定";
    if (rel !== null && now >= rel + 864e5) status = "発売済み";
    else if (rs !== null && now >= rs) status = "予約受付中";
    else if (rs !== null) status = "予約前";
    else if (rel !== null) status = "発売前";
    return { r: r, rs: rs, rel: rel, status: status, sort: rs !== null ? rs : (rel !== null ? rel : Infinity) };
  }).sort(function (a, b) { return a.sort - b.sort; });

  var reserved = get();
  el.innerHTML = list.map(function (x) {
    var r = x.r;
    var on = reserved.indexOf(r.id) >= 0;
    return '<article class="rel st-' + (x.status === "発売済み" ? "done" : x.status === "予約受付中" ? "open" : "wait") + '">' +
      '<div class="rel-top"><span class="rel-status">' + esc(x.status) + '</span>' +
      (on ? '<span class="rel-on">✓ 予約した</span>' : "") + '</div>' +
      '<h2>' + esc(r.title) + '</h2>' +
      '<dl class="rel-dates">' +
      (x.rs !== null ? '<div><dt>予約開始</dt><dd>' + esc(jst(x.rs)) + '</dd></div>' : "") +
      (x.rel !== null ? '<div><dt>発売日</dt><dd>' + esc(jst(x.rel)) + '</dd></div>' : "") +
      '</dl>' +
      (r.note ? '<p class="note">' + esc(r.note) + '</p>' : "") +
      '<div class="rel-btns">' +
      '<button type="button" class="rsv-btn' + (on ? " on" : "") + '" data-id="' + esc(r.id) + '" aria-pressed="' + on + '">' + (on ? "予約済みを取り消す" : "予約した") + '</button>' +
      '<a class="ics-btn" href="ics/' + esc(r.id) + '.ics" download>カレンダーに追加</a>' +
      (r.official ? '<a class="ext-btn" href="' + esc(r.official) + '" target="_blank" rel="noopener">公式を見る↗</a>' : "") +
      '</div>' +
      (r.source ? '<p class="src">出典：' + esc(r.source) + '</p>' : "") +
      '</article>';
  }).join("") || '<p class="note">予定はまだありません。</p>';

  el.addEventListener("click", function (e) {
    var b = e.target.closest(".rsv-btn");
    if (!b) return;
    var id = b.getAttribute("data-id");
    var v = get();
    v = v.indexOf(id) >= 0 ? v.filter(function (x) { return x !== id; }) : v.concat([id]);
    put(v);
    location.reload();
  });
})();
