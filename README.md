# My Site

HTML / CSS / JavaScript だけで作ったシンプルなウェブサイトです（ビルド不要）。

## 構成

- `index.html` — ページ本体（About / Works / News / Contact）
- `assets/style.css` — デザイン（ライト／ダークモード対応、スマホ対応）
- `assets/script.js` — テーマ切り替え、メニュー、作品フィルター、スクロール演出、フォーム

## ローカルで見る

`index.html` をブラウザで開くだけで表示できます。

## 公開する（GitHub Pages）

1. GitHub のリポジトリで **Settings → Pages** を開く
2. **Source** を「Deploy from a branch」、ブランチを選んでフォルダを `/ (root)` にして保存
3. 数分後に表示される URL でサイトが公開されます

## カスタマイズ

- テキスト：`index.html` の文章を書き換え
- 色：`assets/style.css` 冒頭の `--accent` などの変数を変更
- 作品画像：`.thumb` の `div` を `<img>` に置き換え
- お問い合わせフォーム：実際に送信するには Formspree などのサービスと連携してください
