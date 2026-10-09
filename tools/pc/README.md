# パソコン側の自動アップロード（Windows）

`C:\Users\81803\Downloads\blog_articles` に保存したテキストを、10 分ごとに GitHub へ送るしくみです。
送られた先では、GitHub が自動で取り込んでサイトを更新します（`.github/workflows/import.yml`）。
一度設定すれば、あとは「フォルダに保存するだけ」です。

## 1. ファイルを置く

1. `C:\Users\81803` の中に `blog_upload` というフォルダを作る
2. この `upload.ps1` をそのフォルダに入れる（GitHub のページで `upload.ps1` を開き、右上の「Download raw file」）

## 2. GitHub の鍵（トークン）を作る

GitHub に「このパソコンから送っていい」と教えるための文字列です。

1. GitHub にログインし、右上の自分のアイコン → **Settings**
2. 左の一番下 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
3. 次のように入れる
   - Token name：`kaitori-upload`
   - Expiration：できるだけ長く（1 年など）
   - Repository access：**Only select repositories** → `kaitori-navi` を選ぶ
   - Permissions → Repository permissions → **Contents** を **Read and write**
4. **Generate token** を押すと `github_pat_...` で始まる文字列が出る。これをコピー
5. `C:\Users\81803\blog_upload` に `token.txt` というファイルを作り、その文字列だけを貼って保存

この文字列は合鍵と同じなので、人に見せないでください。

## 3. 10 分ごとに動くようにする

スタートボタンを右クリック → **ターミナル（管理者）** または **PowerShell（管理者）** を開き、次の 1 行を貼って Enter。

```
schtasks /create /sc minute /mo 10 /tn "kaitori-upload" /tr "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Users\81803\blog_upload\upload.ps1" /f
```

「成功」と出れば完了です。

## 4. 動作確認

同じ画面で次を貼って Enter すると、すぐに 1 回動きます。

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\81803\blog_upload\upload.ps1
```

- `送信: ...` と出れば成功。`blog_articles` の中の「取り込み済み」フォルダに移ります
- 判別できなかったファイルは「要確認」フォルダに移ります（店の見出しや「ホムラプレミアム」の文字がないもの）
- 記録は `C:\Users\81803\blog_upload\upload_log.txt` に残ります

数分後に GitHub の「Actions」タブで取り込みが緑のチェックになり、サイトが更新されます。

## 判別のしかた

| ファイルの中身 | 送り先の名前 |
|---|---|
| 「取得元URL：https://www.1-chome.com/…」の見出しがある | `<取得日時の日付>_買取一丁目.txt`（同じ日は上書き） |
| 「ホムラプレミアム」の文字がある | `<ファイルの更新日>_買取ホムラ.txt`、2 つ目以降は `_p2` `_p3`… |
| 「tradeCards」が URL に含まれる／iPhone の商品がない | 末尾に `_ポケカ` |

## やめるとき

```
schtasks /delete /tn "kaitori-upload" /f
```
