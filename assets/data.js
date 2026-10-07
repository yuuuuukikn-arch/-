// 販路ごとの販売手数料（設定画面で変更可。目安の値です）
const CHANNELS = {
  mercari: { name: "メルカリ", rate: 10 },
  yahoo:   { name: "ヤフオク", rate: 10 },
  rakuma:  { name: "ラクマ",   rate: 10 },
  amazon:  { name: "Amazon",   rate: 10 },
};

// 商品データ（サンプル）。実際の相場に書き換えて使ってください。
// buy: 仕入れ値 / ship: 送料 / sold: 月間の売れた数（回転の目安）
// prices: 各販路の相場（null は出品なし）
const PRODUCTS = [
  { id: 1,  name: "携帯ゲーム機 限定カラー",         cat: "ゲーム",     store: "家電量販店",   buy: 37980, ship: 1050, sold: 142, prices: { mercari: 46800, yahoo: 45500, rakuma: 45000, amazon: 49800 } },
  { id: 2,  name: "ゲームソフト 初回限定版",           cat: "ゲーム",     store: "ネット通販",   buy: 9680,  ship: 230,  sold: 88,  prices: { mercari: 12800, yahoo: 12000, rakuma: 12300, amazon: 13900 } },
  { id: 3,  name: "トレーディングカード 拡張パック BOX", cat: "トレカ",     store: "ホビーショップ", buy: 5400,  ship: 520,  sold: 310, prices: { mercari: 8900,  yahoo: 8500,  rakuma: 8600,  amazon: 9800 } },
  { id: 4,  name: "トレーディングカード スターターデッキ", cat: "トレカ",     store: "コンビニ",     buy: 1650,  ship: 230,  sold: 205, prices: { mercari: 2200,  yahoo: 1900,  rakuma: 2100,  amazon: null } },
  { id: 5,  name: "フィギュア 1/7スケール 限定品",     cat: "ホビー",     store: "ホビー通販",   buy: 22000, ship: 1050, sold: 34,  prices: { mercari: 31000, yahoo: 33500, rakuma: 30000, amazon: 34800 } },
  { id: 6,  name: "プラモデル 再販品",                 cat: "ホビー",     store: "家電量販店",   buy: 4950,  ship: 750,  sold: 120, prices: { mercari: 6800,  yahoo: 6500,  rakuma: 6500,  amazon: 7480 } },
  { id: 7,  name: "スニーカー コラボモデル 27cm",      cat: "スニーカー", store: "公式抽選",     buy: 19800, ship: 1050, sold: 56,  prices: { mercari: 32000, yahoo: 30500, rakuma: 31000, amazon: null } },
  { id: 8,  name: "スニーカー 定番モデル 復刻",         cat: "スニーカー", store: "アウトレット", buy: 12100, ship: 1050, sold: 40,  prices: { mercari: 13500, yahoo: 13000, rakuma: 13200, amazon: 14800 } },
  { id: 9,  name: "ワイヤレスイヤホン 型落ち",          cat: "家電",       store: "家電量販店",   buy: 14800, ship: 520,  sold: 95,  prices: { mercari: 17500, yahoo: 17000, rakuma: 16800, amazon: 18900 } },
  { id: 10, name: "美容家電 ヘアドライヤー",            cat: "家電",       store: "ドラッグストア", buy: 24800, ship: 1050, sold: 61,  prices: { mercari: 26500, yahoo: 27000, rakuma: 26000, amazon: 29800 } },
  { id: 11, name: "限定コスメ ホリデーコフレ",          cat: "コスメ",     store: "百貨店",       buy: 8800,  ship: 520,  sold: 74,  prices: { mercari: 13500, yahoo: 12000, rakuma: 13000, amazon: null } },
  { id: 12, name: "アニメ 一番くじ A賞",                cat: "ホビー",     store: "コンビニ",     buy: 3500,  ship: 750,  sold: 160, prices: { mercari: 6500,  yahoo: 6000,  rakuma: 6200,  amazon: null } },
  { id: 13, name: "キャラクター ぬいぐるみ 限定",       cat: "ホビー",     store: "テーマパーク", buy: 4200,  ship: 750,  sold: 48,  prices: { mercari: 5200,  yahoo: 4800,  rakuma: 5000,  amazon: null } },
  { id: 14, name: "腕時計 限定モデル",                  cat: "ファッション", store: "正規店",     buy: 44000, ship: 1050, sold: 18,  prices: { mercari: 52000, yahoo: 55000, rakuma: 51000, amazon: 58000 } },
  { id: 15, name: "家庭用ゲーム機 本体",                cat: "ゲーム",     store: "家電量販店",   buy: 49980, ship: 1600, sold: 210, prices: { mercari: 52000, yahoo: 51500, rakuma: 51000, amazon: 54800 } },
];
