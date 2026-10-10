<?php
// WordPress なしで商品の個別ページを確認する（開発用）。
// 使い方: SEDORI_SLUG=iphone-18-pro-max-256gb php wp-plugin/tests/preview-item.php > item.html
define('ABSPATH', __DIR__ . '/');
define('HOUR_IN_SECONDS', 3600);
$GLOBALS['sdr_opts'] = json_decode(getenv('SEDORI_OPTS') ?: '{}', true);
$GLOBALS['sdr_assets'] = array();
function plugin_dir_path($f) { return dirname($f) . '/'; }
function plugin_dir_url($f) { return '../sedori-hikaku/'; }
function get_option($k, $d = false) { if ($k === 'sedori_options') return $GLOBALS['sdr_opts']; if ($k === 'sedori_notes') return getenv('SEDORI_NOTES') ?: ''; return $d; }
function update_option() {} function delete_option() {} function get_transient() { return false; } function set_transient() {} function delete_transient() {}
function wp_upload_dir() { return array('basedir' => '/nonexistent'); }
function trailingslashit($s) { return rtrim($s, '/') . '/'; }
function add_shortcode() {} function add_action() {} function add_filter() {} function add_options_page() {}
function register_activation_hook() {} function register_deactivation_hook() {}
function current_user_can() { return true; }
function wp_enqueue_style($h, $u) { $GLOBALS['sdr_assets']['css'][$h] = $u; }
function wp_enqueue_script($h, $u) { $GLOBALS['sdr_assets']['js'][$h] = $u; }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function esc_url($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function wp_json_encode($d, $f = 0) { return json_encode($d, $f | JSON_UNESCAPED_UNICODE); }
function current_time($f) { return date($f); }
function home_url($p = '') { return 'https://example.test' . $p; }
function get_posts() { return array(); }
require __DIR__ . '/../sedori-hikaku/sedori-hikaku.php';
$data = sedori_get_data();
$found = sedori_find_item(getenv('SEDORI_SLUG') ?: 'iphone-18-pro-max-256gb', $data);
if (!$found) { fwrite(STDERR, "slug が見つかりません\n"); exit(1); }
list($p, $cat) = $found;
?><!doctype html>
<html lang="ja" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo esc_html(sedori_item_title($p, $cat)); ?></title>
<link rel="stylesheet" href="../sedori-hikaku/assets/sedori.css">
<link rel="stylesheet" href="../../wp-theme/kaitori-navi/assets/style.css">
<link rel="stylesheet" href="../../wp-theme/kaitori-navi/style.css">
</head>
<body>
<main class="container page-article">
  <p class="crumb"><a href="#">ランキングへ</a> ›</p>
  <h1><?php echo esc_html($p['display']); ?> の買取価格</h1>
  <?php echo sedori_render_item_page($p, $cat, $data); ?>
</main>
<script src="../sedori-hikaku/assets/chart.js"></script><script src="../sedori-hikaku/assets/sedori.js"></script>
</body></html>
