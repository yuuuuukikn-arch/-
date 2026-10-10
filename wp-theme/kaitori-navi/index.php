<?php
/** その他（投稿の一覧など）。トップは front-page.php、固定ページは page.php が使われる */
get_header(); ?>
  <main class="container page-article">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">ランキングへ</a> ›</p>
    <h1><?php echo is_home() ? '速報' : esc_html(get_the_archive_title()); ?></h1>
    <?php if (have_posts()) { ?>
      <ul class="post-list">
      <?php while (have_posts()) { the_post(); ?>
        <li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a><time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time></li>
      <?php } ?>
      </ul>
    <?php } else { ?>
      <p class="note">まだありません。</p>
    <?php } ?>
  </main>
<?php get_footer();
