<?php
/**
 * Plugin Name: 買取相場ナビ
 * Description: iPhone・ポケカBOXの買取価格ランキング（店舗比較・価格推移グラフ・速報バナー）をショートコード [sedori] で表示します。
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Text Domain: sedori-hikaku
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SEDORI_VERSION', '1.0.0');
define('SEDORI_DIR', plugin_dir_path(__FILE__));
define('SEDORI_URL', plugin_dir_url(__FILE__));

require_once SEDORI_DIR . 'includes/data.php';
require_once SEDORI_DIR . 'includes/render.php';
require_once SEDORI_DIR . 'includes/admin.php';

/** 設定値（管理画面「設定 → 買取相場ナビ」） */
function sedori_opt($key, $default = '') {
    $opts = get_option('sedori_options', array());
    return isset($opts[$key]) && $opts[$key] !== '' ? $opts[$key] : $default;
}

/** ショートコードがあるページだけ CSS / JS を読み込む */
function sedori_enqueue() {
    wp_enqueue_style('sedori', SEDORI_URL . 'assets/sedori.css', array(), SEDORI_VERSION);
    wp_enqueue_script('sedori-chart', SEDORI_URL . 'assets/chart.js', array(), SEDORI_VERSION, true);
    wp_enqueue_script('sedori', SEDORI_URL . 'assets/sedori.js', array('sedori-chart'), SEDORI_VERSION, true);
}

/**
 * [sedori cat="iPhone"] / [sedori cat="ポケカBOX"]（cat="pokeca" でも可）
 * 任意: limit="10"（表示件数）, podium="0"（上位3つのカードを出さない）
 */
function sedori_shortcode($atts) {
    $atts = shortcode_atts(array('cat' => 'iPhone', 'limit' => 0, 'podium' => 1), $atts, 'sedori');
    $cat = $atts['cat'];
    if (in_array(strtolower($cat), array('pokeca', 'pokemon', 'box'), true)) {
        $cat = 'ポケカBOX';
    }
    $data = sedori_get_data();
    if (!$data || empty($data['categories'][$cat])) {
        return current_user_can('manage_options')
            ? '<p class="sdr-error">買取相場ナビ：「' . esc_html($cat) . '」のデータがありません。設定画面でデータを確認してください。</p>'
            : '';
    }
    sedori_enqueue();
    return sedori_render($cat, $data, array(
        'limit'  => max(0, (int) $atts['limit']),
        'podium' => (bool) (int) $atts['podium'],
    ));
}
add_shortcode('sedori', 'sedori_shortcode');

/** [sedori_news] … 速報バナーだけを表示（記事の先頭などに） */
function sedori_news_shortcode() {
    $html = sedori_render_news_banner();
    if ($html) {
        sedori_enqueue();
    }
    return $html;
}
add_shortcode('sedori_news', 'sedori_news_shortcode');
