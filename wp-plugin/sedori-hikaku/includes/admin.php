<?php
/**
 * 管理画面「設定 → せどり比較」
 */

if (!defined('ABSPATH')) {
    exit;
}

function sedori_admin_menu() {
    add_options_page('せどり比較', 'せどり比較', 'manage_options', 'sedori-hikaku', 'sedori_admin_page');
}
add_action('admin_menu', 'sedori_admin_menu');

/** 設定の保存とデータのアップロード */
function sedori_admin_save() {
    if (!current_user_can('manage_options') || empty($_POST['sedori_action'])) {
        return;
    }
    check_admin_referer('sedori_admin');

    if ($_POST['sedori_action'] === 'options') {
        $in = wp_unslash($_POST);
        $opts = array(
            'data_url'      => esc_url_raw(trim($in['data_url'] ?? '')),
            'amazon_tag'    => sanitize_text_field($in['amazon_tag'] ?? ''),
            'rakuten_id'    => sanitize_text_field($in['rakuten_id'] ?? ''),
            'ad_every'      => max(1, (int) ($in['ad_every'] ?? 5)),
            'news_category' => sanitize_title($in['news_category'] ?? 'sokuho'),
            'news_days'     => max(1, (int) ($in['news_days'] ?? 7)),
            'pr_text'       => sanitize_text_field($in['pr_text'] ?? ''),
        );
        // 広告コード（AdSense の <ins>・<script>）はそのまま保存する。保存できるのは unfiltered_html 権限のある管理者だけ
        $old = get_option('sedori_options', array());
        $opts['ad_html'] = current_user_can('unfiltered_html') ? trim($in['ad_html'] ?? '') : ($old['ad_html'] ?? '');
        update_option('sedori_options', $opts);
        delete_transient('sedori_remote_data');
        add_settings_error('sedori', 'saved', '設定を保存しました。', 'updated');
    }

    if ($_POST['sedori_action'] === 'upload' && !empty($_FILES['sedori_json']['tmp_name'])) {
        $json = file_get_contents($_FILES['sedori_json']['tmp_name']);
        if (!sedori_decode($json)) {
            add_settings_error('sedori', 'bad', 'sedori.json の形式ではありません。tools/export_wp.js で書き出したファイルを選んでください。', 'error');
            return;
        }
        $path = sedori_upload_path();
        wp_mkdir_p(dirname($path));
        file_put_contents($path, $json);
        add_settings_error('sedori', 'uploaded', '価格データを更新しました。', 'updated');
    }

    if ($_POST['sedori_action'] === 'remove_upload') {
        @unlink(sedori_upload_path());
        add_settings_error('sedori', 'removed', 'アップロードしたデータを削除しました（URL か同梱データを使います）。', 'updated');
    }
}
add_action('admin_init', 'sedori_admin_save');

function sedori_admin_page() {
    $o = get_option('sedori_options', array());
    $v = function ($k, $d = '') use ($o) { return isset($o[$k]) ? $o[$k] : $d; };
    $data = sedori_get_data();
    $source = file_exists(sedori_upload_path()) ? 'アップロードしたファイル' : ($v('data_url') ? 'URL' : 'プラグイン同梱のデータ');
    ?>
    <div class="wrap">
        <h1>せどり比較</h1>
        <?php settings_errors('sedori'); ?>

        <h2>使い方</h2>
        <p>固定ページや投稿に、次のショートコードを書くとランキングが表示されます。</p>
        <ul style="list-style:disc;padding-left:20px">
            <li><code>[sedori cat="iPhone"]</code> … iPhone の買取率ランキング</li>
            <li><code>[sedori cat="pokeca"]</code> … ポケカBOX の利益ランキング</li>
            <li><code>[sedori cat="iPhone" limit="5" podium="0"]</code> … 上位5件だけ・上位3つのカードなし（記事の途中に入れるとき）</li>
            <li><code>[sedori_news]</code> … 速報バナーだけ</li>
        </ul>

        <h2>価格データ</h2>
        <p>今使っているデータ：<b><?php echo esc_html($source); ?></b>
            <?php if ($data) : ?>
                （<?php foreach ($data['categories'] as $name => $c) { echo esc_html($name . ' ' . count($c['products']) . '件・更新 ' . $c['updated'] . '　'); } ?>）
            <?php endif; ?>
        </p>
        <form method="post" enctype="multipart/form-data">
            <?php wp_nonce_field('sedori_admin'); ?>
            <input type="hidden" name="sedori_action" value="upload">
            <input type="file" name="sedori_json" accept=".json,application/json">
            <?php submit_button('sedori.json をアップロード', 'secondary', 'submit', false); ?>
        </form>
        <?php if (file_exists(sedori_upload_path())) : ?>
            <form method="post" style="margin-top:8px">
                <?php wp_nonce_field('sedori_admin'); ?>
                <input type="hidden" name="sedori_action" value="remove_upload">
                <?php submit_button('アップロードしたデータを削除', 'delete', 'submit', false); ?>
            </form>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('sedori_admin'); ?>
            <input type="hidden" name="sedori_action" value="options">
            <table class="form-table" role="presentation">
                <tr><th scope="row"><label for="data_url">データの URL（自動更新）</label></th>
                    <td><input type="url" id="data_url" name="data_url" class="regular-text" value="<?php echo esc_attr($v('data_url')); ?>">
                        <p class="description">sedori.json を置いた URL を入れると、1時間ごとに読み直します（アップロードしたファイルがあるときはそちらが優先）。</p></td></tr>

                <tr><th colspan="2"><h2 style="margin:0">アフィリエイト</h2></th></tr>
                <tr><th scope="row"><label for="amazon_tag">Amazon アソシエイト ID</label></th>
                    <td><input type="text" id="amazon_tag" name="amazon_tag" value="<?php echo esc_attr($v('amazon_tag')); ?>" placeholder="example-22">
                        <p class="description">入れると各商品に「Amazonで探す」ボタンが出ます。</p></td></tr>
                <tr><th scope="row"><label for="rakuten_id">楽天アフィリエイト ID</label></th>
                    <td><input type="text" id="rakuten_id" name="rakuten_id" class="regular-text" value="<?php echo esc_attr($v('rakuten_id')); ?>" placeholder="0123abcd.4567efgh.0123abcd.4567efgh">
                        <p class="description">入れると各商品に「楽天で探す」ボタンが出ます。</p></td></tr>

                <tr><th colspan="2"><h2 style="margin:0">広告（AdSense）</h2></th></tr>
                <tr><th scope="row"><label for="ad_html">ランキングの途中に入れる広告コード</label></th>
                    <td><textarea id="ad_html" name="ad_html" rows="6" class="large-text code" <?php disabled(!current_user_can('unfiltered_html')); ?>><?php echo esc_textarea($v('ad_html')); ?></textarea>
                        <p class="description">AdSense の「ディスプレイ広告」や「記事内広告」のコードを貼ります。自動広告だけ使うなら空欄で構いません。</p></td></tr>
                <tr><th scope="row"><label for="ad_every">広告を入れる間隔</label></th>
                    <td><input type="number" id="ad_every" name="ad_every" min="1" value="<?php echo esc_attr($v('ad_every', 5)); ?>"> 商品ごと</td></tr>
                <tr><th scope="row"><label for="pr_text">PR 表記</label></th>
                    <td><input type="text" id="pr_text" name="pr_text" class="regular-text" value="<?php echo esc_attr($v('pr_text')); ?>" placeholder="※本ページはプロモーション（広告）を含みます">
                        <p class="description">アフィリエイトか広告を設定すると、ランキングの上に表示されます（ステマ規制対応）。</p></td></tr>

                <tr><th colspan="2"><h2 style="margin:0">速報</h2></th></tr>
                <tr><th scope="row"><label for="news_category">速報のカテゴリ（スラッグ）</label></th>
                    <td><input type="text" id="news_category" name="news_category" value="<?php echo esc_attr($v('news_category', 'sokuho')); ?>">
                        <p class="description">このカテゴリの最新の投稿が、ランキングの上に「速報」として出ます。</p></td></tr>
                <tr><th scope="row"><label for="news_days">表示期間</label></th>
                    <td><input type="number" id="news_days" name="news_days" min="1" value="<?php echo esc_attr($v('news_days', 7)); ?>"> 日
                        <p class="description">投稿ごとに期限を決めたいときは、カスタムフィールド <code>sokuho_until</code> に日付（例 2026-10-15）を入れます。</p></td></tr>
            </table>
            <?php submit_button('設定を保存'); ?>
        </form>
    </div>
    <?php
}
