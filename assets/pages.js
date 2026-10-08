// 予約・抽選・新発売・注目商品のページ（tools/make_pages.js で p/ にページを作る）
//   status: "published" … 公開（TOP の注目・予約一覧に出る）／ "draft" … 下書き（ページは作るが、リンクなし・検索に出ない）
//   kind:   "yoyaku"（予約・抽選）／ "shinhatsu"（新発売）／ "chumoku"（注目商品）
//   date:   公開日（YYYY-MM-DD）／ until: 掲載終了日（省略すると終わらない）
//   summary: 一言の説明（一覧に出る）／ body: 本文の段落の配列
//   facts:  [項目, 内容] の表（受付期間・定価など。確認できたものだけ書く）
//   official: 公式ページへのリンク  ／ search: 商品検索に使う言葉（省略時はタイトル）
//   buyable: false にすると、このページでは通販リンクを付けない（抽選品など）

// アフィリエイトの設定（ID はあなたが登録してから入れる。空のままなら通販リンクは出ない）
const PAGE_CONFIG = {
  amazonTag: "",   // Amazon アソシエイトの ID（例 example-22）
  rakutenId: "",   // 楽天アフィリエイトの ID
  prText: "※本ページは広告（アフィリエイトリンク）を含みます",
};

const PAGES = [
  // 下書きの例（確認用のひな形。公開されず、リンクも出ない。不要なら削除してOK）
  {
    id: "example-yoyaku", kind: "yoyaku", status: "draft", date: "2026-10-08", until: "2026-10-31",
    title: "【例】○○の抽選販売", summary: "抽選の受付期間と申込先をまとめたページの例です。",
    body: ["ここに、商品の内容と抽選の流れを書きます。", "申し込みは公式サイトから行ってください。"],
    facts: [["受付方法", "公式サイトの抽選"], ["受付期間", "（確認して記入）"], ["定価", "（確認して記入）"]],
    official: [{ label: "公式サイト", url: "https://www.pokemon-card.com/" }],
    search: "ポケモンカード", buyable: false,
  },
];
