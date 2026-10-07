// 販路ごとの販売手数料（設定画面で変更可。目安の値です）
// noShip: true の販路は送料を差し引かない（店頭・送料無料の買取など）
const CHANNELS = {
  kaitori: { name: "買取店",   rate: 0, noShip: true },
  mercari: { name: "メルカリ", rate: 10 },
  yahoo:   { name: "ヤフオク", rate: 10 },
  rakuma:  { name: "ラクマ",   rate: 10 },
};

// 最終更新日（相場を書き換えたら更新してください）
const UPDATED = "2026-10-07";

// 商品データ（サンプル）。相場は日々変わるので、実際の価格に書き換えて使ってください。
// buy: 仕入れ値（定価など） / ship: 送料 / sold: 月間の売れた数（回転の目安）
// prices: 各販路の相場（null は取り扱いなし）
const PRODUCTS = [
  // ── iPhone（SIMフリー・未開封）──
  { id: 1,  cat: "iPhone", name: "iPhone 18 Pro Max 256GB",  note: "未開封・SIMフリー", store: "Apple Store", buy: 239800, ship: 1050, sold: 420, prices: { kaitori: 252000, mercari: 268000, yahoo: 262000, rakuma: 265000 } },
  { id: 2,  cat: "iPhone", name: "iPhone 18 Pro Max 512GB",  note: "未開封・SIMフリー", store: "Apple Store", buy: 274800, ship: 1050, sold: 260, prices: { kaitori: 286000, mercari: 302000, yahoo: 298000, rakuma: 299000 } },
  { id: 3,  cat: "iPhone", name: "iPhone 18 Pro Max 1TB",    note: "未開封・SIMフリー", store: "Apple Store", buy: 309800, ship: 1050, sold: 90,  prices: { kaitori: 318000, mercari: 335000, yahoo: 330000, rakuma: null } },
  { id: 4,  cat: "iPhone", name: "iPhone 18 Pro 256GB",      note: "未開封・SIMフリー", store: "Apple Store", buy: 219800, ship: 1050, sold: 380, prices: { kaitori: 226000, mercari: 241000, yahoo: 236000, rakuma: 238000 } },
  { id: 5,  cat: "iPhone", name: "iPhone 18 Pro 512GB",      note: "未開封・SIMフリー", store: "Apple Store", buy: 254800, ship: 1050, sold: 170, prices: { kaitori: 259000, mercari: 274000, yahoo: 270000, rakuma: 271000 } },
  { id: 6,  cat: "iPhone", name: "iPhone 18 Pro 1TB",        note: "未開封・SIMフリー", store: "Apple Store", buy: 289800, ship: 1050, sold: 60,  prices: { kaitori: 291000, mercari: 305000, yahoo: 300000, rakuma: null } },
  { id: 7,  cat: "iPhone", name: "iPhone 17 256GB",          note: "未開封・SIMフリー", store: "家電量販店",  buy: 129800, ship: 1050, sold: 300, prices: { kaitori: 122000, mercari: 133000, yahoo: 130000, rakuma: 131000 } },
  { id: 8,  cat: "iPhone", name: "iPhone Air 256GB",         note: "未開封・SIMフリー", store: "家電量販店",  buy: 159800, ship: 1050, sold: 80,  prices: { kaitori: 138000, mercari: 150000, yahoo: 146000, rakuma: 147000 } },

  // ── ポケカBOX（シュリンク付き未開封）──
  { id: 21, cat: "ポケカBOX", name: "インフェルノX",           note: "シュリンク付き", store: "抽選・定価", buy: 6000, ship: 750, sold: 950, prices: { kaitori: 17500, mercari: 21400, yahoo: 20500, rakuma: 20800 } },
  { id: 22, cat: "ポケカBOX", name: "ストームエメラルダ",       note: "シュリンク付き", store: "抽選・定価", buy: 6000, ship: 750, sold: 720, prices: { kaitori: 14000, mercari: 17300, yahoo: 16800, rakuma: 16900 } },
  { id: 23, cat: "ポケカBOX", name: "MEGAドリームex",          note: "シュリンク付き", store: "抽選・定価", buy: 5500, ship: 750, sold: 880, prices: { kaitori: 14300, mercari: 13800, yahoo: 13500, rakuma: 13600 } },
  { id: 24, cat: "ポケカBOX", name: "メガブレイブ",             note: "シュリンク付き", store: "抽選・定価", buy: 5400, ship: 750, sold: 540, prices: { kaitori: 8600,  mercari: 10700, yahoo: 10200, rakuma: 10400 } },
  { id: 25, cat: "ポケカBOX", name: "ニンジャスピナー",         note: "シュリンク付き", store: "抽選・定価", buy: 5400, ship: 750, sold: 610, prices: { kaitori: 10900, mercari: 10200, yahoo: 9800,  rakuma: 9900 } },
  { id: 26, cat: "ポケカBOX", name: "アビスアイ",               note: "シュリンク付き", store: "抽選・定価", buy: 5400, ship: 750, sold: 430, prices: { kaitori: 10300, mercari: 8800,  yahoo: 8500,  rakuma: 8600 } },
  { id: 27, cat: "ポケカBOX", name: "ムニキスゼロ",             note: "シュリンク付き", store: "抽選・定価", buy: 5400, ship: 750, sold: 390, prices: { kaitori: 7200,  mercari: 8400,  yahoo: 8100,  rakuma: 8200 } },
  { id: 28, cat: "ポケカBOX", name: "クレイバースト（再販）",   note: "シュリンク付き", store: "抽選・定価", buy: 5400, ship: 750, sold: 260, prices: { kaitori: 10000, mercari: 11500, yahoo: 11000, rakuma: 11200 } },
];
