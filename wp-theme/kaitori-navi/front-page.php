<?php
/** トップ ＝ iPhone の買取価格ランキング（プラグインのショートコード） */
get_header(); ?>
  <main id="top">
    <section class="container summary">
      <div>
        <h1 class="visually-hidden"><?php bloginfo('name'); ?></h1>
        <p class="lead"><strong>iPhone 18 / 17 Pro シリーズ</strong>と<strong>ポケカBOX</strong>の買取価格から、<strong>定価で買って買取店に売ったときの利益</strong>をランキング表示します。</p>
      </div>
    </section>
    <section class="container">
      <?php echo do_shortcode('[sedori cat="iPhone"]'); ?>
    </section>
  </main>
<?php get_footer();
