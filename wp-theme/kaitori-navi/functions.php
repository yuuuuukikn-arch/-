<?php
/**
 * 買取相場ナビ テーマ
 * 見た目は静的サイト（GitHub Pages 版）と同じ。ランキングの中身は「買取相場ナビ」プラグインのショートコードが出す。
 */
if (!defined('ABSPATH')) { exit; }

define('KAITORI_THEME_VERSION', '0.1.0');

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('html5', array('search-form', 'gallery', 'caption', 'style', 'script'));
    add_theme_support('post-thumbnails');
    load_theme_textdomain('kaitori-navi');
});

// CSS：静的サイトと同じ土台 → テーマの上書き（プラグインの CSS より後に読む）
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('kaitori-base', get_template_directory_uri() . '/assets/style.css', array(), KAITORI_THEME_VERSION);
    wp_enqueue_style('kaitori-theme', get_stylesheet_uri(), array('kaitori-base', 'sedori'), KAITORI_THEME_VERSION);
}, 20);

// <html data-theme="dark">：静的サイトと同じく最初はダーク。切り替えはフッターの小さなスクリプト
add_filter('language_attributes', function ($output) {
    return $output . ' data-theme="dark"';
});

// 有効化したとき、ポケカのページがなければ作る（本文はプラグインのショートコード）
add_action('after_switch_theme', function () {
    if (!get_page_by_path('pokeca')) {
        wp_insert_post(array(
            'post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'pokeca',
            'post_title' => 'ポケカBOX 買取価格ランキング', 'post_content' => '[sedori cat="pokeca"]',
        ));
    }
});

/** ヘッダーのタブ（iPhone ＝ トップ、ポケカ ＝ /pokeca/） */
function kaitori_nav_tabs() {
    $pokeca = get_page_by_path('pokeca');
    $tabs = array(array('iPhone', home_url('/'), is_front_page()));
    if ($pokeca) {
        $tabs[] = array('ポケカ', get_permalink($pokeca), is_page('pokeca'));
    }
    $html = '<nav class="seg" aria-label="カテゴリ">';
    foreach ($tabs as $t) {
        $html .= '<a href="' . esc_url($t[1]) . '"' . ($t[2] ? ' class="active" aria-current="page"' : '') . '>' . esc_html($t[0]) . '</a>';
    }
    return $html . '</nav>';
}

/** フッターのリンク：あるページだけ出す（運営者情報 = about、プライバシーポリシー = WordPress の設定） */
function kaitori_footer_links() {
    $links = array();
    $about = get_page_by_path('about');
    if ($about) {
        $links[] = '<a href="' . esc_url(get_permalink($about)) . '">運営者情報</a>';
    }
    $privacy = get_privacy_policy_url();
    if ($privacy) {
        $links[] = '<a href="' . esc_url($privacy) . '">プライバシーポリシー</a>';
    }
    return $links;
}
