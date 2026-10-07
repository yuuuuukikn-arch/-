// 速報ページ
const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const today = new Date().toLocaleDateString("sv-SE");
const endOf = (n) => n.until || new Date(Date.parse(n.date) + ((typeof NEWS_DAYS === "number" ? NEWS_DAYS : 7) - 1) * 864e5).toISOString().slice(0, 10);
const fmt = (d) => d.replaceAll("-", "/");

const all = [...(typeof NEWS === "undefined" ? [] : NEWS)].sort((a, b) => b.date.localeCompare(a.date));
let tag = "";

function card(n) {
  const live = n.date <= today && today <= endOf(n);
  const diff = n.retail != null && n.market != null ? n.market - n.retail : null;
  const prices = n.retail != null || n.market != null ? `
    <div class="news-prices">
      ${n.retail != null ? `<div><span>定価</span><b>${yen(n.retail)}</b></div>` : ""}
      ${n.market != null ? `<div><span>相場</span><b>${yen(n.market)}</b></div>` : ""}
      ${diff != null ? `<div><span>差額</span><b class="${diff >= 0 ? "plus" : "minus"}">${diff >= 0 ? "+" : ""}${yen(diff)}</b><small>定価の ${(n.market / n.retail).toFixed(2)} 倍</small></div>` : ""}
    </div>` : "";
  return `<article class="news-card ${live ? "live" : "ended"}" id="${esc(n.id || "")}">
    <div class="news-meta">
      <time datetime="${esc(n.date)}">${fmt(n.date)}</time>
      ${n.tag ? `<span class="news-tag">${esc(n.tag)}</span>` : ""}
      <span class="news-status">${live ? `掲載中（${fmt(endOf(n)).slice(5)}まで）` : "終了"}</span>
    </div>
    <h2>${esc(n.title)}</h2>
    ${n.body ? `<p class="news-body">${esc(n.body).replace(/\n/g, "<br>")}</p>` : ""}
    ${prices}
    ${n.url ? `<a class="news-source" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.source || "出典を見る")}<span aria-hidden="true">›</span></a>` : ""}
  </article>`;
}

function render() {
  const tags = [...new Set(all.map((n) => n.tag).filter(Boolean))];
  $("newsFilter").hidden = tags.length < 2;
  $("newsFilter").innerHTML = ["", ...tags].map((t) => `<button role="tab" class="${t === tag ? "active" : ""}" data-tag="${esc(t)}">${t ? esc(t) : "すべて"}</button>`).join("");
  const list = all.filter((n) => !tag || n.tag === tag);
  $("newsList").innerHTML = list.length ? list.map(card).join("") : `
    <div class="news-empty">
      <p><b>速報はまだありません。</b></p>
      <p>ガンプラやポケカにプレ値がついたときなどに、ここに載せます。ランキングページの上部にも表示期間中だけ出ます。</p>
      <a href="./" class="news-source">ランキングを見る<span aria-hidden="true">›</span></a>
    </div>`;
  // ランキングページの速報から来たときは、その記事を目立たせる
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) { target.classList.add("focus"); target.scrollIntoView({ block: "start" }); }
}

$("newsFilter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tag]");
  if (b) { tag = b.dataset.tag; render(); }
});
$("year").textContent = new Date().getFullYear();

// テーマ切り替え（ランキングページと共通の設定）
const root = document.documentElement;
try { const t = JSON.parse(localStorage.getItem("theme")); if (t) root.dataset.theme = t; } catch {}
document.querySelector(".theme-toggle").addEventListener("click", () => {
  const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = isDark ? "light" : "dark";
  try { localStorage.setItem("theme", JSON.stringify(root.dataset.theme)); } catch {}
});

render();
