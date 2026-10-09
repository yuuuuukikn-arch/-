// 買取店（並び順がグラフの線の色の順になります）
// url はリンク先。カテゴリごとに別のページへ飛ばすときは urls: { "ポケカBOX": "…" } を足す（ないカテゴリは url）
const SHOPS = {
  "買取一丁目": { url: "https://www.1-chome.com/", urls: { "ポケカBOX": "https://www.1-chome.com/tradeCards?category=IIzyMdayU5wp7T4G" } },
  "ホムラプレミアム": { url: "https://www.1-chome.com/" }, // 買取一丁目のプレミアム買取（通常価格とは別の店として載せる）
  "買取ルデヤ": { url: "https://kaitori-rudeya.com/", hours: "10時〜19時（月〜土・祝）／日曜定休" },
  "買取商店":   { url: "https://www.kaitorishouten-co.jp/" },
  "森森買取":   { url: "https://www.morimori-kaitori.jp/" },
};

// iPhone 18 の色（色別価格の表の並び順）
const IPHONE_COLORS = ["バーガンディ", "ブラック", "グレイシャー", "シルバー"];

// サイトに表示する商品の絞り込み（取り込んだデータ自体はすべて記録されます）
const SHOW_ONLY = {
  iPhone: /^iPhone 18/,   // iPhone は 18 シリーズだけ表示
};

// 定価（仕入れ値）の一覧。利益 = 買取価格（未開封） − 定価 で計算します。
// estimated: true は推定の定価です。正しい金額がわかったら書き換えて false にしてください。
const CATALOG = {
  // iPhone 18 Pro / Pro Max（Apple Store SIMフリー税込定価・2026年10月確認）
  "iPhone 18 Pro 256GB":     { cat: "iPhone", retail: 219800 },
  "iPhone 18 Pro 512GB":     { cat: "iPhone", retail: 254800 },
  "iPhone 18 Pro 1TB":       { cat: "iPhone", retail: 324800 },
  "iPhone 18 Pro 2TB":       { cat: "iPhone", retail: 429800 },
  "iPhone 18 Pro Max 256GB": { cat: "iPhone", retail: 239800 },
  "iPhone 18 Pro Max 512GB": { cat: "iPhone", retail: 274800 },
  "iPhone 18 Pro Max 1TB":   { cat: "iPhone", retail: 344800 },
  "iPhone 18 Pro Max 2TB":   { cat: "iPhone", retail: 449800 },

  // ポケカBOX（メーカー希望小売価格・税込。2026年5月以降発売の拡張パックは1BOX 6,000円）
  "【MEGA】 30th CELEBRATION BOX":                                    { cat: "ポケカBOX", retail: 7200 },
  "【MEGA】 30th CELEBRATION プレミアムデッキセット エーフィ・ブラッキー": { cat: "ポケカBOX", retail: 6200 },
  "【MEGA】 30th CELEBRATION FUTURISTIC BOX":                         { cat: "ポケカBOX", retail: 27500 },
  "【MEGA】 ストームエメラルダ BOX":   { cat: "ポケカBOX", retail: 6000, estimated: true },
  "【MEGA】 アビスアイ BOX":           { cat: "ポケカBOX", retail: 6000 },
  "【MEGA】 ニンジャスピナー BOX":     { cat: "ポケカBOX", retail: 5400, estimated: true },
  "【MEGA】 ムニキスゼロ BOX":         { cat: "ポケカBOX", retail: 5400, estimated: true },
  "【MEGA】 MEGAドリームex BOX":       { cat: "ポケカBOX", retail: 5500 },
  "【MEGA】 インフェルノX BOX":        { cat: "ポケカBOX", retail: 5400 },
  "【MEGA】 メガブレイブ BOX":         { cat: "ポケカBOX", retail: 5400 },
  "【MEGA】 メガシンフォニア BOX":     { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 ブラックボルト BOX":           { cat: "ポケカBOX", retail: 5800 },
  "【S＆V】 ホワイトフレア BOX":           { cat: "ポケカBOX", retail: 5800 },
  "【S＆V】 ブラックボルト デラックス BOX": { cat: "ポケカBOX", retail: 5800, estimated: true },
  "【S＆V】 ホワイトフレア デラックス BOX": { cat: "ポケカBOX", retail: 5800 },
  "【S＆V】 ロケット団の栄光 BOX":         { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 熱風のアリーナ BOX":           { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 バトルパートナーズ BOX":       { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 テラスタルフェスex BOX":       { cat: "ポケカBOX", retail: 5500 },
  "【S＆V】 超電ブレイカー BOX":           { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 楽園ドラゴーナ BOX":           { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 ステラミラクル BOX":           { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 ナイトワンダラー BOX":         { cat: "ポケカBOX", retail: 5400 },
  "【S＆V】 変幻の仮面 BOX":               { cat: "ポケカBOX", retail: 5400 },
};

// 実データがまだないカテゴリに表示するサンプル（今は不要なので空）
const SAMPLE_SNAPSHOTS = [];

// 速報（新しい順に並べなくてOK。ページ上部に表示期間中のものが1件ずつ出て、
// 押すと速報ページ news.html の該当記事に移動します）
//   id:     記事ごとの英数字の名前（ページ内リンクに使う）
//   date:   速報の日付 / until: この日まで上部に表示（省略すると date から NEWS_DAYS 日間）
//   tag:    ジャンル（ガンプラ・ポケカ・iPhone など）
//   title:  見出し / body: 本文（省略可）
//   retail: 定価 / market: 相場（どちらも省略可。あると差額と倍率を表示）
//   url, source: 出典のリンクと名前（省略可）
// 例:
// { id: "pgu-nu", date: "2026-10-08", until: "2026-10-15", tag: "ガンプラ",
//   title: "PG UNLEASHED νガンダムにプレ値", body: "…", retail: 66000, market: 90000,
//   url: "https://…", source: "…" },
const NEWS_DAYS = 7;
const NEWS = [];
