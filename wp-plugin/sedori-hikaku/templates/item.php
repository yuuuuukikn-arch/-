<?php
/** 商品の個別ページのテンプレート（テーマに sedori-item.php があればそちらが使われる） */
if (!defined('ABSPATH')) { exit; }
list($p, $cat, $data) = sedori_current_item();
get_header(); ?>
  <main class="container page-article">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">ランキングへ</a> ›</p>
    <h1><?php echo esc_html($p['display']); ?> の買取価格</h1>
    <?php echo sedori_render_item_page($p, $cat, $data); ?>
  </main>
<?php get_footer();
