  <footer class="site-footer">
    <div class="container">
      <p>&copy; <?php echo esc_html(date_i18n('Y')); ?> <?php bloginfo('name'); ?><?php foreach (kaitori_footer_links() as $l) { echo ' ・ ' . $l; } ?></p>
      <p class="muted">買取価格は各店の掲載価格をもとにしています。実際の買取額は店舗で確認してください。</p>
      <p><a href="https://x.com/NEXTTREND_MKT" target="_blank" rel="noopener">X（旧Twitter）で更新情報</a></p>
    </div>
  </footer>
  <script>
    // ライト／ダーク切り替え（静的サイトと同じ。選んだ方をこのブラウザに保存）
    (function () {
      var root = document.documentElement, key = "theme";
      try { var saved = JSON.parse(localStorage.getItem(key)); if (saved) root.dataset.theme = saved; } catch (e) {}
      var b = document.querySelector(".theme-toggle");
      if (b) b.addEventListener("click", function () {
        var isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
        root.dataset.theme = isDark ? "light" : "dark";
        try { localStorage.setItem(key, JSON.stringify(root.dataset.theme)); } catch (e) {}
      });
    })();
  </script>
  <?php wp_footer(); ?>
</body>
</html>
