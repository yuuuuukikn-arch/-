<?php
/** 固定ページ（運営者情報・プライバシーポリシーなど） */
get_header(); ?>
  <main class="container page-article">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">ランキングへ</a> ›</p>
    <?php while (have_posts()) { the_post(); ?>
      <h1><?php the_title(); ?></h1>
      <div class="entry-content"><?php the_content(); ?></div>
    <?php } ?>
  </main>
<?php get_footer();
