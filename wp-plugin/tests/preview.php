<?php
// WordPress なしでショートコードの出力を確認するためのプレビュー（開発用）。
// 使い方: php wp-plugin/tests/preview.php > preview.html
// WordPress の関数を最小限まねして、プラグインを読み込む。
define('ABSPATH', __DIR__ . '/');
define('HOUR_IN_SECONDS', 3600);
$GLOBALS['sdr_opts'] = json_decode(getenv('SEDORI_OPTS') ?: '{}', true);
$GLOBALS['sdr_assets'] = array();
function plugin_dir_path($f) { return dirname($f) . '/'; }
function plugin_dir_url($f) { return '../sedori-hikaku/'; }
function get_option($k, $d = false) { return $k === 'sedori_options' ? $GLOBALS['sdr_opts'] : $d; }
function update_option() {} function get_transient() { return false; } function set_transient() {} function delete_transient() {}
function wp_upload_dir() { return array('basedir' => '/nonexistent'); }
function trailingslashit($s) { return rtrim($s, '/') . '/'; }
function add_shortcode($t, $f) { $GLOBALS['sdr_sc'][$t] = $f; }
function shortcode_atts($d, $a) { return array_merge($d, (array) $a); }
function add_action() {} function add_filter() {} function add_options_page() {} function delete_option() {}
function register_activation_hook() {} function register_deactivation_hook() {}
function home_url($p = '') { return 'https://example.test' . $p; }
function current_user_can() { return true; }
function wp_enqueue_style($h, $u) { $GLOBALS['sdr_assets']['css'][$h] = $u; }
function wp_enqueue_script($h, $u) { $GLOBALS['sdr_assets']['js'][$h] = $u; }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_url($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function wp_json_encode($d, $f = 0) { return json_encode($d, $f | JSON_UNESCAPED_UNICODE); }
function current_time($f) { return date($f); }
function get_posts() { return getenv('SEDORI_NEWS') ? array((object) array('ID' => 1, 'title' => getenv('SEDORI_NEWS'))) : array(); }
function get_post_meta() { return ''; }
function get_permalink() { return '#news'; }
function get_the_title($p) { return $p->title; }
function get_the_date($f) { return date($f); }
require __DIR__ . '/../sedori-hikaku/sedori-hikaku.php';
$cat = getenv('SEDORI_CAT') ?: 'iPhone';
$body = call_user_func($GLOBALS['sdr_sc']['sedori'], array('cat' => $cat));
?><!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>プレビュー</title>
<?php foreach ($GLOBALS['sdr_assets']['css'] ?? array() as $u) echo '<link rel="stylesheet" href="' . $u . '">'; ?>
<style>
/* よくある WordPress テーマの見た目をまねる（プラグインの CSS が負けないか確認用） */
body { margin: 0; font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 16px; color: #333; background: #fff; }
.entry { max-width: 720px; margin: 0 auto; padding: 16px; }
.entry h1 { font-size: 1.5em; }
.entry h3 { border-left: 6px solid #e95; background: #fff3e8; padding: 8px 12px; margin: 2em 0 1em; }
.entry ol li, .entry ul li { margin-bottom: .6em; }
.entry ol { padding-left: 1.5em; } .entry ol li::marker { color: #e95; font-weight: bold; }
.entry table { border: 2px solid #999; } .entry th { background: #eee; border: 1px solid #999; padding: 10px; }
.entry a { color: #06c; text-decoration: underline; }
.entry input, .entry select { border: 2px solid #ccc; padding: 4px; }
</style></head>
<body><div class="entry"><h1><?php echo esc_html($cat); ?> 買取価格ランキング</h1>
<p>テーマの本文です。ここにショートコードが入ります。</p>
<?php echo $body; ?>
</div>
<?php echo '<script src="../sedori-hikaku/assets/chart.js"></script><script src="../sedori-hikaku/assets/sedori.js"></script>'; ?>
</body></html>
