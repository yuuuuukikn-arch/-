// 軽量なSVGチャート（外部ライブラリなし）
const Chart = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const man = (n) => (Math.abs(n) >= 10000 ? +(n / 10000).toFixed(2) + "万" : n.toLocaleString("ja-JP"));
  const yenFull = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
  const md = (d) => d.slice(5).replace("-", "/");

  function niceTicks(min, max, count = 4) {
    const span = max - min || Math.abs(max) || 1;
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
    return ticks;
  }

  // 一覧用の小さな推移線
  function sparkline(values, w = 88, h = 26) {
    const v = values.filter((x) => x != null);
    if (!v.length) return "";
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    const x = (i) => (v.length === 1 ? w - 4 : 4 + (i * (w - 8)) / (v.length - 1));
    const y = (n) => (max === min ? h / 2 : h - 4 - ((n - min) / span) * (h - 8));
    const d = v.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join("");
    const trend = v.length > 1 ? (v[v.length - 1] >= v[0] ? "up" : "down") : "flat";
    return `<svg class="spark ${trend}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      ${v.length > 1 ? `<path d="${d}"/>` : ""}<circle cx="${x(v.length - 1)}" cy="${y(v[v.length - 1])}" r="2.5"/></svg>`;
  }

  // 詳細用の折れ線グラフ
  // opts: { dates: [...], series: [{ name, cls, values }], ref: { label, value } }
  function line(el, opts, tooltip) {
    const W = Math.max(280, el.clientWidth), H = 240;
    const m = { l: 52, r: 88, t: 14, b: 28 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const { dates, series, ref } = opts;
    const all = series.flatMap((s) => s.values).filter((v) => v != null);
    if (ref) all.push(ref.value);
    const pad = Math.max((Math.max(...all) - Math.min(...all)) * 0.08, Math.max(...all) * 0.02);
    const ticks = niceTicks(Math.min(...all) - pad, Math.max(...all) + pad);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const t = dates.map((d) => Date.parse(d));
    const tMin = Math.min(...t), tMax = Math.max(...t);
    const X = (i) => (tMax === tMin ? m.l + iw / 2 : m.l + ((t[i] - tMin) / (tMax - tMin)) * iw);
    const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="価格推移">`;
    // 目盛り
    for (const v of ticks) {
      svg += `<line class="grid" x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}"/>`;
      svg += `<text class="axis" x="${m.l - 8}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle">${man(v)}</text>`;
    }
    const step = Math.max(1, Math.ceil(dates.length / Math.floor(iw / 56)));
    dates.forEach((d, i) => {
      if (i % step === 0 || i === dates.length - 1)
        svg += `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="middle">${md(d)}</text>`;
    });
    // 定価の基準線
    if (ref) {
      svg += `<line class="ref" x1="${m.l}" x2="${m.l + iw}" y1="${Y(ref.value)}" y2="${Y(ref.value)}"/>`;
      svg += `<text class="ref-label" x="${m.l + iw + 6}" y="${Y(ref.value)}" dominant-baseline="middle">${ref.label}</text>`;
    }
    // 折れ線
    const labels = [];
    for (const s of series) {
      const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
      const d = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), "");
      svg += `<path class="series ${s.cls}" d="${d}"/>`;
      const showDots = pts.filter(Boolean).length <= 31;
      pts.forEach((p, i) => {
        if (p && (showDots || i === pts.length - 1)) svg += `<circle class="dot ${s.cls}" cx="${p[0]}" cy="${p[1]}" r="4"/>`;
      });
      const last = [...pts].reverse().find(Boolean);
      if (last) labels.push({ y: last[1], text: s.name, cls: s.cls });
    }
    // 線の右端にラベル（重ならないようにずらす）
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
    const lastX = X(dates.length - 1);
    for (const l of labels) svg += `<text class="direct ${l.cls}" x="${lastX + 8}" y="${l.y}" dominant-baseline="middle">${l.text}</text>`;

    svg += `<line class="crosshair" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
    svg += `<rect class="hit" x="${m.l - 10}" y="${m.t}" width="${iw + 20}" height="${ih}" fill="transparent"/></svg>`;
    el.innerHTML = svg;

    // ホバーで値を表示
    const root = el.querySelector("svg"), cross = root.querySelector(".crosshair");
    const move = (ev) => {
      const box = root.getBoundingClientRect();
      const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - box.left) * (W / box.width);
      let best = 0;
      dates.forEach((_, i) => { if (Math.abs(X(i) - px) < Math.abs(X(best) - px)) best = i; });
      cross.setAttribute("x1", X(best)); cross.setAttribute("x2", X(best)); cross.setAttribute("visibility", "visible");
      tooltip.innerHTML = `<b>${dates[best].replaceAll("-", "/")}</b>` +
        series.map((s) => `<div><i class="key ${s.cls}"></i>${s.name}<span>${s.values[best] == null ? "—" : yenFull(s.values[best])}</span></div>`).join("") +
        (ref ? `<div class="muted"><i class="key ref-key"></i>定価<span>${yenFull(ref.value)}</span></div>` : "") +
        (opts.extra ? opts.extra(best) : "");
      tooltip.hidden = false;
      const tx = box.left + (X(best) / W) * box.width, ty = box.top + window.scrollY + 12;
      const tw = tooltip.offsetWidth;
      tooltip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, tx + 14 + tw > window.innerWidth ? tx - tw - 14 : tx + 14)) + "px";
      tooltip.style.top = ty + "px";
    };
    const leave = () => { cross.setAttribute("visibility", "hidden"); tooltip.hidden = true; };
    const hit = root.querySelector(".hit");
    hit.addEventListener("mousemove", move);
    hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave);
    hit.addEventListener("touchend", leave);
  }

  return { sparkline, line };
})();
