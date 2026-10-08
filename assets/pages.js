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

// 発売カレンダー（予約開始・発売日。確認できたものだけ入れる）
//   reserve: { start: "YYYY-MM-DDTHH:MM+09:00" } … 予約の開始（分からなければ reserve を省略）
//   release: "YYYY-MM-DD" … 発売日 ／ official: 公式ページ ／ source: 日程の出典
//   status: "published" … 公開（カレンダーに出る）／ "draft" … 下書き
const RELEASES = [
  { id: "iphone-duo", status: "published", title: "iPhone Duo（折りたたみ）",
    reserve: { start: "2026-10-16T21:00+09:00" }, release: "2026-10-23",
    note: "予約・発売日は報道による日程です。公式の発表で最終確認してください。",
    official: "https://www.apple.com/jp/iphone/", source: "iPhone Mania（予約・発売日の報道）" },
];

// 記事（価格の比較とグラフは、取り込んだ記録から自動で作る）
//   chart: { cat, name } … 記録から「最新の価格の表」と「推移のグラフ」を作る商品
const ARTICLES = [
  { id: "iphone18-promax-256", kind: "article", status: "published", date: "2026-10-08",
    title: "iPhone 18 Pro Max 256GB の買取価格｜店舗比較と推移",
    summary: "定価・各店の買取価格・買取率を、毎日の記録からまとめます。",
    body: ["このページは、買取店の掲載価格を毎日記録して作っています。価格は日々変わるため、売る前に各店で最新の額を確認してください。"],
    chart: { cat: "iPhone", name: "iPhone 18 Pro Max 256GB" }, search: "iPhone 18 Pro Max 256GB" },
  { id: "pokeca-infernox", kind: "article", status: "published", date: "2026-10-08",
    title: "【MEGA】インフェルノX BOX の買取価格｜店舗比較と推移",
    summary: "定価と各店の買取価格を、毎日の記録からまとめます。",
    body: ["このページは、買取店の掲載価格を毎日記録して作っています。シュリンク付きの価格で比べています。売る前に各店で最新の額を確認してください。"],
    chart: { cat: "ポケカBOX", name: "【MEGA】 インフェルノX BOX" }, search: "インフェルノX BOX" },
];

const PAGES = [...ARTICLES,
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
