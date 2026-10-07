// サイトに表示する商品の絞り込み（取り込んだデータ自体はすべて記録されます）
const SHOW_ONLY = {
  iPhone: /^iPhone 18/,   // iPhone は 18 シリーズだけ表示
};

// 定価（仕入れ値）の一覧。利益 = 買取価格（未開封） − 定価 で計算します。
// estimated: true は推定の定価です。正しい金額がわかったら書き換えて false にしてください。
const CATALOG = {
  // iPhone 18 Pro / Pro Max（2026年9月発売）
  "iPhone 18 Pro 256GB":     { cat: "iPhone", retail: 219800 },
  "iPhone 18 Pro 512GB":     { cat: "iPhone", retail: 254800, estimated: true },
  "iPhone 18 Pro 1TB":       { cat: "iPhone", retail: 289800, estimated: true },
  "iPhone 18 Pro 2TB":       { cat: "iPhone", retail: 359800, estimated: true },
  "iPhone 18 Pro Max 256GB": { cat: "iPhone", retail: 239800 },
  "iPhone 18 Pro Max 512GB": { cat: "iPhone", retail: 274800, estimated: true },
  "iPhone 18 Pro Max 1TB":   { cat: "iPhone", retail: 309800, estimated: true },
  "iPhone 18 Pro Max 2TB":   { cat: "iPhone", retail: 379800, estimated: true },

  // ポケカBOX（定価）
  "インフェルノX":         { cat: "ポケカBOX", retail: 6000 },
  "ストームエメラルダ":     { cat: "ポケカBOX", retail: 6000 },
  "MEGAドリームex":        { cat: "ポケカBOX", retail: 5500 },
  "メガブレイブ":           { cat: "ポケカBOX", retail: 5400 },
  "ニンジャスピナー":       { cat: "ポケカBOX", retail: 5400 },
  "アビスアイ":             { cat: "ポケカBOX", retail: 5400 },
  "ムニキスゼロ":           { cat: "ポケカBOX", retail: 5400 },
};

// ポケカBOXの買取価格はまだ実データがないため、サンプルを表示しています。
// 買取店のリストを取り込むと、こちらは自動的に使われなくなります。
const SAMPLE_SNAPSHOTS = [
  { date: "2026-10-07", shop: "サンプル", cat: "ポケカBOX", sample: true, items: {
    "インフェルノX":     { sealed: 17500, note: "シュリンク付き" },
    "ストームエメラルダ": { sealed: 14000, note: "シュリンク付き" },
    "MEGAドリームex":    { sealed: 14300, note: "シュリンク付き" },
    "メガブレイブ":       { sealed: 8600,  note: "シュリンク付き" },
    "ニンジャスピナー":   { sealed: 10900, note: "シュリンク付き" },
    "アビスアイ":         { sealed: 10300, note: "シュリンク付き" },
    "ムニキスゼロ":       { sealed: 7200,  note: "シュリンク付き" },
  } },
];
