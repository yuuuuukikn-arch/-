<?php
/** 投稿（速報など） */
get_header(); ?>
  <main class="container page-article">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">ランキングへ</a> ›</p>
    <?php while (have_posts()) { the_post(); ?>
      <h1><?php the_title(); ?></h1>
      <p class="lead"><time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time></p>
      <div class="entry-content"><?php the_content(); ?></div>
    <?php } ?>
  </main>
<?php get_footer();
