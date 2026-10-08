# せどり比較（WordPress プラグイン）

iPhone・ポケカBOX の買取価格ランキングを、WordPress の固定ページや投稿に表示するプラグインです。

- ランキングの中身（商品名・買取価格・店名）は **WordPress がページの文字として出力**するので、検索エンジンに読まれます
- **AdSense**：自動広告はそのまま有効。ランキングの途中にも広告枠を入れられます
- **アフィリエイト**：各商品に「Amazonで探す」「楽天で探す」ボタン（`rel="sponsored"`、PR 表記つき）
- **速報**：WordPress の投稿（カテゴリ「速報」）の最新記事を、ランキングの上にバナー表示
- スマホ向けのカード表示、価格推移グラフ、店舗別・色別の価格表

## 1. インストール

1. `sedori-hikaku.zip` を用意（下の「zip の作り方」）
2. WordPress 管理画面 → **プラグイン → 新規追加 → プラグインのアップロード** → zip を選んでインストール → 有効化

## 2. ページを作る（SEO のおすすめ）

| ページ | 本文に書くショートコード | タイトル例 | URL（スラッグ）例 |
|---|---|---|---|
| iPhone | `[sedori cat="iPhone"]` | iPhone18 Pro 買取価格比較【毎日更新】買取率ランキング | `/iphone-kaitori/` |
| ポケカ | `[sedori cat="pokeca"]` | ポケカBOX 買取価格比較【毎日更新】利益ランキング | `/pokeca-box-kaitori/` |

- ショートコードの上に、2〜3行の説明文（何を比べているページか・更新頻度）を書くと検索に強くなります
- 記事の途中に上位だけ出すとき：`[sedori cat="iPhone" limit="5" podium="0"]`
- SEO プラグイン（Yoast / SEO SIMPLE PACK など）でメタディスクリプションを設定してください
- 「価格更新日」はページに出るので、毎日更新するほど新しさが伝わります

## 3. 設定（設定 → せどり比較）

| 項目 | 内容 |
|---|---|
| Amazon アソシエイト ID | 例 `example-22`。入れると「Amazonで探す」が出ます |
| 楽天アフィリエイト ID | 入れると「楽天で探す」が出ます |
| 広告コード | AdSense の「記事内広告」などのコード。ランキングの途中に入ります（自動広告だけなら空欄） |
| 広告を入れる間隔 | 何商品ごとに広告を入れるか（初期値 5） |
| PR 表記 | アフィリエイトか広告を設定すると、ランキングの上に表示（ステマ規制対応） |
| 速報のカテゴリ | 初期値 `sokuho`。このカテゴリの最新投稿がバナーになります |
| 表示期間 | 速報バナーを出す日数（初期値 7）。投稿ごとに期限を決めるならカスタムフィールド `sokuho_until` に日付 |
| データの URL | 価格データを置いた URL（自動更新用。下の「毎日の更新」） |

## 4. 速報を書く

1. 投稿 → カテゴリ → 「速報」（スラッグ `sokuho`）を作成
2. 速報を書くときはこのカテゴリで投稿。本文に定価・相場・出典リンクを書く
3. 公開すると、ランキングの上にバナーが出ます（表示期間を過ぎると自動で消えます）

速報は記事として検索に載り、SNS でも共有しやすくなります。

## 5. 毎日の更新

価格の取り込みはこれまでどおりリポジトリで行い、WordPress 用のデータを書き出します。

```sh
python3 tools/import_kaitori.py …   # 価格の取り込み（いつもの作業）
node tools/export_wp.js             # wp-plugin/sedori-hikaku/data/sedori.json を書き出す
```

WordPress への反映は次のどれかです。

- **A. 管理画面からアップロード**：設定 → せどり比較 →「sedori.json をアップロード」
- **B. URL から自動で読む**：sedori.json を公開 URL に置き、設定の「データの URL」に入れる（1時間ごとに読み直し）
- **C. プラグインごと入れ直す**：zip を作り直してアップロード（データも同梱されます）

公開しない店は `tools/export_wp.js` の `WP_EXCLUDE` に入れると書き出しに含まれません（今は買取商店）。

## zip の作り方

```sh
node tools/export_wp.js
cd wp-plugin && zip -r sedori-hikaku.zip sedori-hikaku
```

## 開発用：WordPress なしで表示を確認

```sh
php wp-plugin/tests/preview.php > wp-plugin/preview-out/iphone.html
SEDORI_CAT=pokeca php wp-plugin/tests/preview.php > wp-plugin/preview-out/pokeca.html
```
