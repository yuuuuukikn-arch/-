<?php
/**
 * 商品の個別ページ（/kaitori/<slug>/）
 * プラグインがページを自動で作る。見た目のテンプレートは templates/item.php（テーマに sedori-item.php があればそちら）。
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SEDORI_ITEM_BASE', 'kaitori');

/** 商品の個別ページの URL */
function sedori_item_url($p) {
    return home_url('/' . SEDORI_ITEM_BASE . '/' . rawurlencode($p['slug']) . '/');
}

/** slug から商品を探す。見つかれば array(商品, カテゴリ名) */
function sedori_find_item($slug, $data) {
    foreach ($data['categories'] as $cat => $c) {
        foreach ($c['products'] as $p) {
            if (isset($p['slug']) && $p['slug'] === $slug) {
                return array($p, $cat);
            }
        }
    }
    return null;
}

// URL の決まり：/kaitori/<slug>/ → sedori_item=<slug>
add_action('init', function () {
    add_rewrite_rule('^' . SEDORI_ITEM_BASE . '/([^/]+)/?$', 'index.php?sedori_item=$matches[1]', 'top');
    if (get_option('sedori_rewrite_v') !== SEDORI_VERSION) {
        flush_rewrite_rules(false);
        update_option('sedori_rewrite_v', SEDORI_VERSION);
    }
});
add_filter('query_vars', function ($vars) {
    $vars[] = 'sedori_item';
    return $vars;
});

/** 今の表示が商品ページなら array(商品, カテゴリ, データ)、違えば null */
function sedori_current_item() {
    static $cur = false;
    if ($cur !== false) {
        return $cur;
    }
    $slug = get_query_var('sedori_item');
    if (!$slug) {
        return $cur = null;
    }
    $data = sedori_get_data();
    $found = $data ? sedori_find_item($slug, $data) : null;
    return $cur = $found ? array($found[0], $found[1], $data) : null;
}

add_filter('template_include', function ($template) {
    if (!get_query_var('sedori_item')) {
        return $template;
    }
    $cur = sedori_current_item();
    if (!$cur) {
        global $wp_query;
        $wp_query->set_404();
        status_header(404);
        return get_404_template();
    }
    sedori_enqueue();
    $theme = locate_template('sedori-item.php');
    return $theme ? $theme : SEDORI_DIR . 'templates/item.php';
});

/** 題名：検索の言葉（機種名＋買取価格）と今日の答え（最高値）を入れる */
function sedori_item_title($p, $cat) {
    return $p['display'] . ' 買取価格【' . sedori_md($p['date']) . ' 更新】最高値 ' . sedori_yen($p['price']) . '・店舗比較';
}
add_filter('pre_get_document_title', function ($title) {
    $cur = sedori_current_item();
    return $cur ? sedori_item_title($cur[0], $cur[1]) . '｜' . get_bloginfo('name') : $title;
});
add_action('wp_head', function () {
    $cur = sedori_current_item();
    if (!$cur) {
        return;
    }
    list($p, $cat) = $cur;
    $title = sedori_item_title($p, $cat) . '｜' . get_bloginfo('name');
    $desc = $p['display'] . 'の買取価格を店舗別に比較。最高値は' . sedori_yen($p['price']) . '。色別・店舗別の価格、前回比、売り時の目安。';
    $url = sedori_item_url($p);
    echo '<meta name="description" content="' . esc_attr($desc) . '">' . "\n";
    echo '<link rel="canonical" href="' . esc_url($url) . '">' . "\n";
    echo '<meta property="og:type" content="website"><meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '">'
        . '<meta property="og:title" content="' . esc_attr($title) . '"><meta property="og:description" content="' . esc_attr($desc) . '">'
        . '<meta property="og:url" content="' . esc_url($url) . '"><meta name="twitter:card" content="summary">' . "\n";
}, 5);

/** 店ごとの備考から、色の減額メモ（表に反映済み）を除く */
function sedori_is_color_memo($s) {
    return !empty($s['colors']) && !empty($s['note']) && preg_match('/[-‐−－]\s*\d/u', $s['note'])
        && preg_match('/バーガンディ|ブラック|グレイシャ|シルバー|オレンジ|ブルー|orange|blue|silver|black|burgundy|glacier/iu', $s['note']);
}

/** 選べる軸の値ごとに、店を高い順に並べる（iPhone は色、ポケカは「未開封」だけ） */
function sedori_item_axis($p) {
    $colors = array();
    foreach ($p['shops'] as $s) {
        if (!empty($s['colors'])) {
            foreach (array_keys($s['colors']) as $c) {
                if (!in_array($c, $colors, true)) {
                    $colors[] = $c;
                }
            }
        }
    }
    $axis = array();
    if ($colors) {
        foreach ($colors as $c) {
            $rows = array();
            foreach ($p['shops'] as $s) {
                if (isset($s['colors'][$c])) {
                    $rows[] = array('shop' => $s['shop'], 'price' => $s['colors'][$c], 'date' => $s['date']);
                }
            }
            $axis[$c] = $rows;
        }
    } else {
        $rows = array();
        foreach ($p['shops'] as $s) {
            $rows[] = array('shop' => $s['shop'], 'price' => $s['price'], 'date' => $s['date']);
        }
        $axis['未開封'] = $rows;
    }
    // 高い順。同額は店の登録順（sedori.json の shops の順 ＝ assets/data.js の SHOPS の順）
    $order = array_flip(array_keys($GLOBALS['sedori_item_shops'] ?? array()));
    foreach ($axis as $k => $rows) {
        usort($rows, function ($a, $b) use ($order) {
            if ($b['price'] !== $a['price']) {
                return $b['price'] - $a['price'];
            }
            return ($order[$a['shop']] ?? 99) - ($order[$b['shop']] ?? 99);
        });
        $axis[$k] = $rows;
    }
    return array($colors, $axis);
}

/** 商品ページの本文 */
function sedori_render_item_page($p, $cat, $data) {
    foreach ($data['shops'] as $shop => $info) {
        if (!empty($info['urls'][$cat])) {
            $data['shops'][$shop]['url'] = $info['urls'][$cat];
        }
    }
    $is_iphone = ($cat === 'iPhone');
    $GLOBALS['sedori_item_shops'] = $data['shops'];
    list($colors, $axis) = sedori_item_axis($p);
    $initial = $colors ? ($p['bestColors'] ? $p['bestColors'][0] : $colors[0]) : '未開封';
    $state = $is_iphone ? '未開封' : 'シュリンク付き・未開封';

    $html = '<div class="sdr sdi">';
    $html .= '<p class="sdi-lead">' . esc_html(str_replace('-', '/', $p['date'])) . ' 更新 ・ ' . count($p['shops']) . ' 店を比較</p>';

    // 色のタブ（色のある商品だけ）
    if ($colors) {
        $html .= '<div class="sdi-tabs" role="tablist" aria-label="色">';
        foreach ($colors as $c) {
            $html .= '<button type="button" role="tab" data-color="' . esc_attr($c) . '"' . ($c === $initial ? ' class="active" aria-selected="true"' : ' aria-selected="false"') . '>' . esc_html($c) . '</button>';
        }
        $html .= '</div>';
    }

    // 軸の値ごとの「何の価格か」「金額」「1 位のカード」「2 位以下」
    foreach ($axis as $label => $rows) {
        $top = $rows ? $rows[0]['price'] : null;
        $tops = array_values(array_filter($rows, function ($r) use ($top) { return $r['price'] === $top; }));
        $rest = array_values(array_filter($rows, function ($r) use ($top) { return $r['price'] !== $top; }));
        $what = $p['display'] . ($colors ? ' ' . $label : '') . '（' . $state . '）の買取価格';
        $html .= '<section class="sdi-panel" data-color="' . esc_attr($label) . '"' . ($label === $initial ? '' : ' hidden') . '>';
        $html .= '<h2 class="sdi-what">' . esc_html($what) . '</h2>';
        if ($top === null) {
            $html .= '<p class="sdr-note">この色の価格はまだありません。</p></section>';
            continue;
        }
        $html .= '<p class="sdi-price"><b>' . sedori_yen($top) . '</b><span>'
            . (count($tops) > 1 ? count($tops) . ' 店が同額' : '最高値') . '（' . esc_html(str_replace('-', '/', $p['date'])) . ' 時点）</span></p>';
        foreach ($tops as $r) {
            $url = sedori_shop_url($data, $r['shop'], $p['name']);
            $stale = $r['date'] < $p['date'] ? '<small>' . esc_html(sedori_md($r['date'])) . '時点</small>' : '';
            $inner = '<span class="sdi-card-pos">1位</span><span class="sdi-card-shop">' . esc_html($r['shop']) . $stale . '</span>'
                . '<span class="sdi-card-price">' . sedori_yen($r['price']) . '</span>'
                . ($url ? '<span class="sdi-card-go">この店で売る →</span>' : '<span class="sdi-card-go muted">リンクなし</span>');
            $html .= $url
                ? '<a class="sdi-card" href="' . esc_url($url) . '" target="_blank" rel="noopener">' . $inner . '</a>'
                : '<div class="sdi-card">' . $inner . '</div>';
        }
        if ($rest) {
            $html .= '<ol class="sdi-rest">';
            $rank = count($tops) + 1;
            $prev = null;
            $i = count($tops);
            foreach ($rest as $r) {
                $i++;
                if ($prev !== null && $r['price'] < $prev) {
                    $rank = $i;
                }
                $prev = $r['price'];
                $url = sedori_shop_url($data, $r['shop'], $p['name']);
                $stale = $r['date'] < $p['date'] ? '<small>' . esc_html(sedori_md($r['date'])) . '時点</small>' : '';
                $row = '<span class="sdi-rest-pos">' . $rank . '位</span><span class="sdi-rest-shop">' . esc_html($r['shop']) . $stale . '</span><span class="sdi-rest-price">' . sedori_yen($r['price']) . '</span>';
                $html .= '<li>' . ($url ? '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">' . $row . '</a>' : $row) . '</li>';
            }
            $html .= '</ol>';
        }
        $html .= '</section>';
    }

    // 色 × 店の表（色のある商品だけ。店は全体の価格が高い順）
    if ($colors) {
        $shops = $p['shops'];
        $html .= '<h2 class="sdi-h">色別・店舗別の買取価格（' . esc_html(sedori_md($p['date'])) . '）</h2>';
        $html .= '<div class="sdr-table-wrap"><table class="sdr-table sdi-table"><thead><tr><th>色</th>';
        foreach ($shops as $s) {
            $url = sedori_shop_url($data, $s['shop'], $p['name']);
            $name = $url ? '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">' . esc_html($s['shop']) . '</a>' : esc_html($s['shop']);
            $html .= '<th class="num">' . $name . ($s['date'] < $p['date'] ? '<small>' . esc_html(sedori_md($s['date'])) . '時点</small>' : '') . '</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach ($colors as $c) {
            $vals = array();
            foreach ($shops as $s) {
                $vals[] = isset($s['colors'][$c]) ? $s['colors'][$c] : null;
            }
            $nums = array_filter($vals, function ($v) { return $v !== null; });
            $best = $nums ? max($nums) : null;
            $html .= '<tr data-color="' . esc_attr($c) . '"' . ($c === $initial ? ' class="active"' : '') . '><th scope="row">' . esc_html($c) . '</th>';
            foreach ($vals as $v) {
                $tone = ($v !== null && $p['retail']) ? ' ' . sedori_sign($v - $p['retail']) : '';
                $html .= '<td class="num price' . $tone . ($v !== null && $v === $best ? ' best' : '') . '">' . ($v !== null ? sedori_yen($v) : '—') . '</td>';
            }
            $html .= '</tr>';
        }
        $html .= '</tbody></table></div><p class="sdi-hint">色ごとに一番高い金額に印。緑は定価以上、赤は定価未満。</p>';
    }

    // 売り時
    $h = $p['history'];
    $n = count($h);
    $html .= '<h2 class="sdi-h">売り時</h2>';
    if ($n >= 2) {
        $d = $h[$n - 1]['price'] - $h[$n - 2]['price'];
        $html .= '<p class="sdi-change">前回比 <b class="' . sedori_sign($d) . '">' . ($d === 0 ? '前回と同じ' : sedori_signed($d)) . '</b>'
            . '<small>' . esc_html(sedori_md($h[$n - 2]['date'])) . ' → ' . esc_html(sedori_md($h[$n - 1]['date'])) . ' の最高値</small></p>';
    }
    if ($n >= 3) {
        $history = array_map(function ($x) { return array($x['date'], $x['price'], implode('・', $x['best'])); }, $h);
        $html .= '<div class="sdi-chart-wrap" data-retail="' . esc_attr($p['retail'] === null ? '' : $p['retail']) . "' data-history='" . esc_attr(wp_json_encode($history)) . "'>"
            . '<div class="sdr-chart-head"><div class="sdr-legend"><span><i class="key s1"></i>最高値</span>' . ($p['retail'] ? '<span><i class="key ref-key"></i>定価</span>' : '') . '</div>'
            . '<div class="sdr-range" role="group" aria-label="期間"><button type="button" data-range="7">7日</button><button type="button" data-range="30" class="active">30日</button><button type="button" data-range="0">全期間</button></div></div>'
            . '<div class="sdr-chart"></div></div>';
    } else {
        $html .= '<p class="sdr-note">記録 ' . $n . ' 日目です。価格の推移グラフは、記録が 3 日分たまると表示します。</p>';
    }
    if ($is_iphone) {
        $html .= '<p class="sdr-note">iPhone の買取価格は水曜に上がりやすい傾向があります。</p>';
    }

    // 店ごとの条件
    $notes = '';
    foreach ($p['shops'] as $s) {
        $bits = array();
        if (!empty($s['note']) && !sedori_is_color_memo($s)) {
            $bits[] = $s['note'];
        }
        if (!empty($data['shops'][$s['shop']]['hours'])) {
            $bits[] = '営業時間 ' . $data['shops'][$s['shop']]['hours'];
        }
        if ($bits) {
            $notes .= '<li><b>' . esc_html($s['shop']) . '</b>：' . esc_html(implode(' ／ ', $bits)) . '</li>';
        }
    }
    if ($notes) {
        $html .= '<h2 class="sdi-h">店ごとの条件</h2><ul class="sdr-notes">' . $notes . '</ul>';
    }

    // 解説（設定「商品ごとの解説」：1 行ごとに「商品名｜文章」）
    $note = sedori_item_note($p);
    if ($note) {
        $html .= '<h2 class="sdi-h">解説</h2>';
        foreach ($note as $para) {
            $html .= '<p class="sdi-note">' . esc_html($para) . '</p>';
        }
    }

    // 仕入れ目線
    if ($p['retail']) {
        $html .= '<h2 class="sdi-h sdi-buy-h">仕入れ目線</h2><p class="sdi-buy">定価 ' . sedori_yen($p['retail']) . ($p['estimated'] ? '（推定）' : '') . ' → 最高値 ' . sedori_yen($p['price']) . ' ＝ '
            . ($cat === 'iPhone' ? '買取率 ' . sedori_pct($p['rate']) . '（' . sedori_signed($p['profit']) . '）' : '利益 ' . sedori_signed($p['profit'])) . '</p>';
    }

    return $html . '</div>';
}

/** 解説：設定の sedori_notes（「商品名｜文章」を 1 行ずつ。同じ商品名の行が複数あれば段落）*/
function sedori_item_note($p) {
    $raw = get_option('sedori_notes', '');
    if (!$raw) {
        return array();
    }
    $out = array();
    foreach (preg_split('/\r?\n/', $raw) as $line) {
        $parts = preg_split('/[｜|]/u', $line, 2);
        if (count($parts) === 2 && trim($parts[0]) === $p['display'] && trim($parts[1]) !== '') {
            $out[] = trim($parts[1]);
        }
    }
    return $out;
}
