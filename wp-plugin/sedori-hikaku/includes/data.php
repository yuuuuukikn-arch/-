<?php
/**
 * 価格データ（sedori.json）の読み込み
 * 優先順: ① 管理画面でアップロードしたファイル → ② 設定した URL（1時間キャッシュ）→ ③ プラグイン同梱の data/sedori.json
 */

if (!defined('ABSPATH')) {
    exit;
}

/** アップロードしたデータの保存先 */
function sedori_upload_path() {
    $up = wp_upload_dir();
    return trailingslashit($up['basedir']) . 'sedori/sedori.json';
}

function sedori_decode($json) {
    $data = json_decode($json, true);
    return (is_array($data) && isset($data['categories'])) ? $data : null;
}

function sedori_get_data() {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    // ① アップロードしたファイル
    $file = sedori_upload_path();
    if (file_exists($file)) {
        $data = sedori_decode(file_get_contents($file));
        if ($data) {
            return $cache = $data;
        }
    }

    // ② URL から取得（GitHub などに置いた sedori.json）
    $url = sedori_opt('data_url');
    if ($url) {
        $data = get_transient('sedori_remote_data');
        if (!$data) {
            $res = wp_remote_get($url, array('timeout' => 10));
            if (!is_wp_error($res) && wp_remote_retrieve_response_code($res) === 200) {
                $data = sedori_decode(wp_remote_retrieve_body($res));
                if ($data) {
                    set_transient('sedori_remote_data', $data, HOUR_IN_SECONDS);
                    update_option('sedori_last_remote', $data, false); // 取得に失敗したとき用
                }
            }
            if (!$data) {
                $data = get_option('sedori_last_remote');
            }
        }
        if ($data) {
            return $cache = $data;
        }
    }

    // ③ 同梱データ
    $bundled = SEDORI_DIR . 'data/sedori.json';
    if (file_exists($bundled)) {
        return $cache = sedori_decode(file_get_contents($bundled));
    }
    return $cache = null;
}
