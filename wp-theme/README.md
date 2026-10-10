# 買取相場ナビ テーマ（WordPress）

静的サイト（GitHub Pages 版）と同じ見た目を WordPress で再現するテーマです。
ランキングの中身は「買取相場ナビ」プラグイン（`wp-plugin/`）が出します。テーマは器（ヘッダー・フッター・配色・ダーク／ライト切り替え・ページの型）です。

## 入れ方

1. zip を作る：`cd wp-theme && zip -r kaitori-navi.zip kaitori-navi`
2. WordPress 管理画面 → **外観 → テーマ → 新規追加 → テーマのアップロード** → zip を選んでインストール → **有効化**
3. 有効化すると、ポケカのページ（`/pokeca/`、本文 `[sedori cat="pokeca"]`）がなければ自動で作られます
4. トップページは自動で iPhone のランキングになります（「設定 → 表示設定」を触る必要はありません）

## ページの対応

| URL | 中身 | テンプレート |
|---|---|---|
| `/` | iPhone のランキング | `front-page.php` |
| `/pokeca/` | ポケカ BOX のランキング | `page-pokeca.php` |
| スラッグ `about` の固定ページ | 運営者情報（作るとフッターに出る） | `page.php` |
| プライバシーポリシー（設定 → プライバシーで指定） | フッターに出る | `page.php` |
| 投稿 | 速報など | `single.php` |

## 見た目の同期

`wp-theme/kaitori-navi/assets/style.css` は静的サイトの `assets/style.css` のコピーで、`node tools/export_wp.js` のたびに上書きされます。テーマ固有の上書きは `wp-theme/kaitori-navi/style.css` に書きます。
