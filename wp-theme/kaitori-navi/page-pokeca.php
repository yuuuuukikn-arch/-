<?php
/** /pokeca/ ＝ ポケカ BOX の買取価格ランキング（ページの本文にあるショートコードをそのまま出す） */
get_header(); ?>
  <main id="top">
    <section class="container summary">
      <div>
        <h1 class="visually-hidden"><?php the_title(); ?></h1>
        <p class="lead"><strong>ポケカBOX</strong>の買取価格から、<strong>定価で買って買取店に売ったときの利益</strong>をランキング表示します。</p>
      </div>
    </section>
    <section class="container">
      <?php while (have_posts()) { the_post(); the_content(); } ?>
    </section>
  </main>
<?php get_footer();
