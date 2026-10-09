# 買取相場ナビ：取ってきたテキストを GitHub に自動で送る（Windows 用）
# 設定のしかたは同じフォルダの README.md。10 分ごとに動かす前提。
#   1) このスクリプトと同じフォルダにある .txt を読み、中身から店（買取一丁目 / 買取ホムラ）・日付・カテゴリを判別
#   2) 決まりの名前（<日付>_<店名>[_ポケカ][_p2].txt）で GitHub の data/raw に送る
#   3) 送ったファイルは「取り込み済み」フォルダへ、判別できないものは「要確認」フォルダへ移す
# GitHub 側では .github/workflows/import.yml が取り込みとサイト更新を行う。
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Owner  = "yuuuuukikn-arch"
$Repo   = "kaitori-navi"
$Branch = "claude/site-creation-7inu0t"            # 公開ブランチ
# このスクリプトと token.txt は、取ってきたテキストと同じフォルダ（C:\Users\81803\Downloads\blog_articles）に置く
$Here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$Source    = $Here                                   # 取ってきたテキストを保存するフォルダ（= このスクリプトの場所）
$TokenFile = Join-Path $Here "token.txt"
$Log       = Join-Path $Here "upload_log.txt"
$Done      = Join-Path $Source "取り込み済み"
$Check     = Join-Path $Source "要確認"

function Log($m) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"
  Add-Content -Path $Log -Value $line -Encoding UTF8
  Write-Host $line
}

if (-not (Test-Path $TokenFile)) { Log "token.txt がありません（README.md の手順 2）"; exit 1 }
$Token = (Get-Content $TokenFile -Raw -Encoding UTF8).Trim()
$Headers = @{ Authorization = "Bearer $Token"; Accept = "application/vnd.github+json"; "X-GitHub-Api-Version" = "2022-11-28" }
New-Item -ItemType Directory -Force -Path $Done, $Check | Out-Null

$files = Get-ChildItem -Path $Source -Filter *.txt -File |
  Where-Object { $_.Name -notin @("token.txt", "upload_log.txt") } | Sort-Object LastWriteTime
if (-not $files) { exit 0 }

# GitHub にすでにある元テキストの名前と sha（同じ名前に送るときに必要）
$existing = @{}
try {
  $list = Invoke-RestMethod -Headers $Headers -Uri "https://api.github.com/repos/$Owner/$Repo/contents/data/raw?ref=$Branch"
  foreach ($e in $list) { $existing[$e.name] = $e.sha }
} catch { Log "GitHub に接続できません: $($_.Exception.Message)"; exit 1 }

# 中身から店・日付・カテゴリを判別する
function Detect($path) {
  $text = Get-Content $path -Raw -Encoding UTF8
  $shop = $null; $date = $null; $cat = "iPhone"
  if ($text -match "取得元URL[：:]\s*https?://www\.1-chome\.com") {
    $shop = "買取一丁目"                                   # 通常の一覧（取得ツールの見出し付き）
    if ($text -match "取得日時[：:]\s*(\d{4}-\d{2}-\d{2})") { $date = $Matches[1] }
    if ($text -match "tradeCards") { $cat = "ポケカBOX" }
  } elseif ($text -match "ホムラプレミアム") {
    $shop = "買取ホムラ"                                   # ホムラの一覧（ページをそのままコピーしたもの）
    if ($text -notmatch "【未開封】\s*iPhone") { $cat = "ポケカBOX" }
  }
  if (-not $shop) { return $null }
  if (-not $date) { $date = (Get-Item $path).LastWriteTime.ToString("yyyy-MM-dd") }
  return @{ shop = $shop; date = $date; cat = $cat }
}

foreach ($f in $files) {
  $d = Detect $f.FullName
  if (-not $d) {
    Log "判別できず「要確認」へ: $($f.Name)"
    Move-Item -Path $f.FullName -Destination (Join-Path $Check $f.Name) -Force
    continue
  }
  $base = "$($d.date)_$($d.shop)"
  if ($d.cat -ne "iPhone") { $base += "_ポケカ" }
  if ($d.shop -eq "買取一丁目") {
    $name = "$base.txt"                                   # 同じ日の取り直しは上書き
  } else {
    $name = "$base.txt"; $n = 2                           # ホムラはページごとに _p2, _p3 … と増やす
    while ($existing.ContainsKey($name)) { $name = "${base}_p$n.txt"; $n++ }
  }
  $body = @{ message = "Add $name"; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName)); branch = $Branch }
  if ($existing.ContainsKey($name)) { $body.sha = $existing[$name] }
  $json = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
  $uri = "https://api.github.com/repos/$Owner/$Repo/contents/data/raw/" + [System.Uri]::EscapeDataString($name)
  try {
    $res = Invoke-RestMethod -Method Put -Headers $Headers -Uri $uri -Body $json -ContentType "application/json; charset=utf-8"
    $existing[$name] = $res.content.sha
    Log "送信: $($f.Name) → data/raw/$name（$($d.shop) $($d.date) $($d.cat)）"
    Move-Item -Path $f.FullName -Destination (Join-Path $Done ("$name  ←  " + $f.Name)) -Force
  } catch {
    Log "送信に失敗: $($f.Name): $($_.Exception.Message)"
  }
}
