<?php
/**
 * ランキングの HTML を作る（検索エンジンが読めるように、価格や店名はすべてサーバー側で出力する）
 */

if (!defined('ABSPATH')) {
    exit;
}

function sedori_yen($n) {
    return ($n < 0 ? '-' : '') . '¥' . number_format(abs((int) round($n)));
}
function sedori_signed($n) {
    return ($n > 0 ? '+' : '') . sedori_yen($n);
}
function sedori_pct($r) {
    return number_format($r * 100, 1) . '%';
}
function sedori_sign($n) {
    return $n > 0 ? 'plus' : ($n < 0 ? 'minus' : 'zero');
}
function sedori_md($date) {
    return substr(str_replace('-', '/', $date), 5);
}

/** 商品の主な指標（iPhone は買取率、ポケカは利益） */
function sedori_metric($p, $metric) {
    if ($metric === 'rate') {
        return $p['rate'] === null ? null : array('label' => '最高買取率', 'text' => sedori_pct($p['rate']), 'sign' => sedori_sign($p['rate'] - 1));
    }
    return $p['roi'] === null ? null : array('label' => '利益率', 'text' => sedori_pct($p['roi']), 'sign' => sedori_sign($p['roi']));
}

/** 店のリンク（アフィリエイトではないので nofollow は付けない） */
function sedori_shop_url($data, $shop) {
    return isset($data['shops'][$shop]['url']) ? $data['shops'][$shop]['url'] : '';
}

/** 仕入れ先（Amazon / 楽天）のアフィリエイトリンク。ID が設定されているものだけ */
function sedori_affiliate_links($p) {
    $q = $p['display'];
    $links = array();
    $amazon = sedori_opt('amazon_tag');
    if ($amazon) {
        $links[] = array('label' => 'Amazonで探す', 'class' => 'amazon',
            'url' => 'https://www.amazon.co.jp/s?k=' . rawurlencode($q) . '&tag=' . rawurlencode($amazon));
    }
    $rakuten = sedori_opt('rakuten_id');
    if ($rakuten) {
        $links[] = array('label' => '楽天で探す', 'class' => 'rakuten',
            'url' => 'https://hb.afl.rakuten.co.jp/hgc/' . rawurlencode($rakuten) . '/?pc=' . rawurlencode('https://search.rakuten.co.jp/search/mall/' . rawurlencode($q) . '/'));
    }
    return $links;
}

/** 速報バナー：カテゴリ（初期値 sokuho）の最新投稿で、表示期間内のもの */
function sedori_render_news_banner() {
    $slug = sedori_opt('news_category', 'sokuho');
    $days = max(1, (int) sedori_opt('news_days', 7));
    $posts = get_posts(array(
        'category_name' => $slug,
        'numberposts'   => 5,
        'post_status'   => 'publish',
        'date_query'    => array(array('after' => $days . ' days ago', 'inclusive' => true)),
    ));
    $today = current_time('Y-m-d');
    foreach ($posts as $post) {
        // 投稿ごとに表示期限を決めたいときは、カスタムフィールド sokuho_until に YYYY-MM-DD を入れる
        $until = get_post_meta($post->ID, 'sokuho_until', true);
        if ($until && $until < $today) {
            continue;
        }
        return '<div class="sdr sdr-news-wrap"><a class="sdr-news" href="' . esc_url(get_permalink($post)) . '">'
            . '<span class="sdr-news-label">速報</span>'
            . '<span class="sdr-news-text"><small>' . esc_html(get_the_date('n/j', $post)) . '</small>' . esc_html(get_the_title($post)) . '</span>'
            . '<span class="sdr-news-go" aria-hidden="true">›</span></a></div>';
    }
    return '';
}

/** 店舗別ランキング（各商品の中、高い順・同額は同順位） */
function sedori_render_shops($p, $data, $metric) {
    $html = '<ol class="sdr-shops">';
    $rank = 0;
    $prev = null;
    foreach (array_slice($p['shops'], 0, 3) as $i => $s) {
        if ($prev === null || $s['price'] < $prev) {
            $rank = $i + 1;
        }
        $prev = $s['price'];
        $url = sedori_shop_url($data, $s['shop']);
        $m = '';
        if ($p['retail']) {
            $m = $metric === 'rate'
                ? '<span class="sdr-sr-metric ' . sedori_sign($s['price'] - $p['retail']) . '">' . sedori_pct($s['price'] / $p['retail']) . '</span>'
                : '<span class="sdr-sr-metric ' . sedori_sign($s['price'] - $p['retail']) . '">' . sedori_signed($s['price'] - $p['retail']) . '</span>';
        }
        $stale = $s['date'] < $p['date'] ? '<small>' . esc_html(sedori_md($s['date'])) . '時点</small>' : '';
        $inner = '<span class="sdr-sr-pos r' . $rank . '">' . $rank . '位</span>'
            . '<span class="sdr-sr-name">' . esc_html($s['shop']) . $stale . '</span>'
            . '<span class="sdr-sr-price">' . sedori_yen($s['price']) . '</span>' . $m
            . '<span class="sdr-sr-go" aria-hidden="true">' . ($url ? '›' : '') . '</span>';
        $cls = 'sdr-sr-row' . ($rank === 1 ? ' top' : '');
        $html .= '<li>' . ($url
            ? '<a class="' . $cls . '" href="' . esc_url($url) . '" target="_blank" rel="noopener">' . $inner . '</a>'
            : '<div class="' . $cls . '">' . $inner . '</div>') . '</li>';
    }
    return $html . '</ol>';
}

/** 詳細（開くとグラフ・店舗別の価格表・備考） */
function sedori_render_detail($p, $data, $metric) {
    $colors = array();
    foreach ($p['shops'] as $s) {
        if (!empty($s['colors'])) {
            $colors = array_unique(array_merge($colors, array_keys($s['colors'])));
        }
    }
    $html = '<details class="sdr-detail"><summary>価格推移・店舗別の詳細</summary><div class="sdr-detail-body">';
    $html .= '<div class="sdr-chart-head"><div class="sdr-legend"><span><i class="key s1"></i>最高値（各店で一番高い買取価格）</span>'
        . ($p['retail'] ? '<span><i class="key ref-key"></i>定価</span>' : '') . '</div>'
        . '<div class="sdr-range" role="group" aria-label="期間"><button type="button" data-range="7">7日</button><button type="button" data-range="30" class="active">30日</button><button type="button" data-range="0">全期間</button></div></div>';
    $html .= '<div class="sdr-chart"></div>';
    if (count($p['history']) < 2) {
        $html .= '<p class="sdr-note">価格の記録が2日分以上たまると線グラフになります。</p>';
    }

    // 店舗別（iPhone は色別）
    $html .= '<h4>店舗別の買取価格</h4><div class="sdr-table-wrap"><table class="sdr-table"><thead><tr><th>' . ($colors ? '色' : '') . '</th>';
    foreach ($p['shops'] as $s) {
        $url = sedori_shop_url($data, $s['shop']);
        $name = $url ? '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">' . esc_html($s['shop']) . '</a>' : esc_html($s['shop']);
        $html .= '<th class="num">' . $name . ($s['date'] < $p['date'] ? '<small>' . esc_html(sedori_md($s['date'])) . '時点</small>' : '') . '</th>';
    }
    $html .= '<th class="num">' . ($metric === 'rate' ? '買取率' : '利益') . '</th></tr></thead><tbody>';
    $rows = $colors ? $colors : array('未開封');
    foreach ($rows as $label) {
        $vals = array();
        foreach ($p['shops'] as $s) {
            $vals[] = $colors ? (isset($s['colors'][$label]) ? $s['colors'][$label] : null) : $s['price'];
        }
        $nums = array_filter($vals, function ($v) { return $v !== null; });
        $best = $nums ? max($nums) : null;
        $html .= '<tr><th scope="row">' . esc_html($label) . '</th>';
        foreach ($vals as $v) {
            $html .= '<td class="num' . ($v !== null && $v === $best ? ' best' : '') . '">' . ($v !== null ? sedori_yen($v) : '—') . '</td>';
        }
        $last = '—';
        if ($best !== null && $p['retail']) {
            $last = $metric === 'rate'
                ? '<span class="' . sedori_sign($best - $p['retail']) . '">' . sedori_pct($best / $p['retail']) . '</span>'
                : '<span class="' . sedori_sign($best - $p['retail']) . '">' . sedori_signed($best - $p['retail']) . '</span>';
        }
        $html .= '<td class="num">' . $last . '</td></tr>';
    }
    $html .= '</tbody></table></div>';

    // 備考（シュリンクなしの価格、店の条件、営業時間）
    $notes = '';
    foreach ($p['shops'] as $s) {
        $bits = array();
        if (isset($s['noShrink'])) {
            $bits[] = 'シュリンクなし ' . sedori_yen($s['noShrink']);
        }
        if (!empty($s['note'])) {
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
        $html .= '<ul class="sdr-notes">' . $notes . '</ul>';
    }
    return $html . '</div></details>';
}

/** 商品1つ分のカード */
function sedori_render_item($p, $i, $data, $metric) {
    $m = sedori_metric($p, $metric);
    $history = array_map(function ($h) { return array($h['date'], $h['price'], implode('・', $h['best'])); }, $p['history']);
    $html = '<li class="sdr-item" id="sdr-' . esc_attr(md5($p['name'])) . '"'
        . ' data-name="' . esc_attr($p['display']) . '"'
        . ' data-rate="' . esc_attr($p['rate'] === null ? '' : $p['rate']) . '"'
        . ' data-profit="' . esc_attr($p['profit'] === null ? '' : $p['profit']) . '"'
        . ' data-roi="' . esc_attr($p['roi'] === null ? '' : $p['roi']) . '"'
        . ' data-price="' . esc_attr($p['price']) . '"'
        . ' data-change="' . esc_attr($p['change'] === null ? '' : $p['change']) . '"'
        . ' data-retail="' . esc_attr($p['retail'] === null ? '' : $p['retail']) . '"'
        . " data-history='" . esc_attr(wp_json_encode($history)) . "'>";

    $html .= '<div class="sdr-head"><span class="sdr-rank r' . ($i + 1) . '">' . ($i + 1) . '</span><div class="sdr-title">'
        . '<h3>' . esc_html($p['display']) . ($p['boost'] ? ' <span class="sdr-boost">強化</span>' : '') . '</h3>'
        . ($p['bestColors'] ? '<small>最高値の色：' . esc_html(implode('・', $p['bestColors'])) . '</small>' : '')
        . '</div></div>';

    $html .= '<div class="sdr-main">'
        . ($m ? '<div class="sdr-metric"><span>' . esc_html($m['label']) . '</span><b class="' . $m['sign'] . '">' . esc_html($m['text']) . '</b></div>' : '<div></div>')
        . ($p['profit'] !== null ? '<div class="sdr-profit"><span>利益</span><b class="' . sedori_sign($p['profit']) . '">' . sedori_signed($p['profit']) . '</b></div>' : '')
        . '</div>';

    $html .= sedori_render_shops($p, $data, $metric);

    $chg = $p['change'] === null ? '—'
        : '<span class="' . sedori_sign($p['change']) . '">' . ($p['change'] > 0 ? '▲' : ($p['change'] < 0 ? '▼' : '±')) . sedori_yen(abs($p['change'])) . '</span>';
    $html .= '<div class="sdr-meta"><span>定価 ' . ($p['retail'] ? sedori_yen($p['retail']) . ($p['estimated'] ? '<sup>推定</sup>' : '') : '未登録') . '</span>'
        . '<span>前回比 ' . $chg . '</span></div>';

    $aff = sedori_affiliate_links($p);
    if ($aff) {
        $html .= '<div class="sdr-buy"><span>定価で探す</span>';
        foreach ($aff as $a) {
            $html .= '<a class="' . esc_attr($a['class']) . '" href="' . esc_url($a['url']) . '" target="_blank" rel="sponsored nofollow noopener">' . esc_html($a['label']) . '</a>';
        }
        $html .= '</div>';
    }

    $html .= sedori_render_detail($p, $data, $metric);
    return $html . '</li>';
}

/** 上位3つ（横スワイプ） */
function sedori_render_podium($products, $metric) {
    $medals = array('🥇', '🥈', '🥉');
    $html = '<div class="sdr-podium">';
    foreach (array_slice($products, 0, 3) as $i => $p) {
        $m = sedori_metric($p, $metric);
        $best = array();
        foreach ($p['shops'] as $s) {
            if ($s['price'] === $p['price']) {
                $best[] = $s['shop'];
            }
        }
        $html .= '<a class="sdr-pod sdr-pod' . ($i + 1) . '" href="#sdr-' . esc_attr(md5($p['name'])) . '">'
            . '<span class="sdr-pod-rank">' . $medals[$i] . ' ' . ($i + 1) . '位</span>'
            . '<b class="sdr-pod-name">' . esc_html($p['display']) . '</b>'
            . ($m ? '<span class="sdr-pod-metric ' . $m['sign'] . '"><small>' . esc_html($m['label']) . '</small>' . esc_html($m['text']) . '</span>' : '')
            . '<span class="sdr-pod-meta">買取 ' . sedori_yen($p['price']) . ($p['profit'] !== null ? ' ・ 利益 ' . sedori_signed($p['profit']) : '') . '</span>'
            . '<span class="sdr-pod-meta">最高値：' . esc_html(implode('・', $best)) . '</span></a>';
    }
    return $html . '</div>';
}

/** 構造化データ（ItemList） */
function sedori_jsonld($cat, $products) {
    $items = array();
    foreach (array_slice($products, 0, 30) as $i => $p) {
        $items[] = array('@type' => 'ListItem', 'position' => $i + 1, 'name' => $p['display'] . ' 買取価格 ' . sedori_yen($p['price']));
    }
    $ld = array('@context' => 'https://schema.org', '@type' => 'ItemList', 'name' => $cat . ' 買取価格ランキング', 'itemListElement' => $items);
    return '<script type="application/ld+json">' . wp_json_encode($ld, JSON_UNESCAPED_UNICODE) . '</script>';
}

function sedori_render($cat, $data, $args) {
    $c = $data['categories'][$cat];
    $metric = $c['metric'];
    $products = $c['products'];
    if ($args['limit']) {
        $products = array_slice($products, 0, $args['limit']);
    }

    $html = '<div class="sdr" data-metric="' . esc_attr($metric) . '">';

    // ステマ規制：アフィリエイトや広告があるときは PR 表記
    if (sedori_opt('amazon_tag') || sedori_opt('rakuten_id') || sedori_opt('ad_html')) {
        $html .= '<p class="sdr-pr">' . esc_html(sedori_opt('pr_text', '※本ページはプロモーション（広告）を含みます')) . '</p>';
    }

    $html .= sedori_render_news_banner();

    $shops = array();
    foreach ($c['shops'] as $s) {
        $url = sedori_shop_url($data, $s);
        $shops[] = $url ? '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">' . esc_html($s) . '</a>' : esc_html($s);
    }
    $html .= '<p class="sdr-updated">価格更新日：<time datetime="' . esc_attr($c['updated']) . '">' . esc_html(str_replace('-', '.', $c['updated'])) . '</time>'
        . ' ・ 掲載店：' . implode('・', $shops) . '</p>';

    if ($args['podium']) {
        $html .= sedori_render_podium($products, $metric);
    }

    $sorts = $metric === 'rate'
        ? array('rate' => '買取率が高い順', 'profit' => '利益が高い順', 'price' => '買取価格が高い順', 'change' => '前回から上がった順')
        : array('profit' => '利益が高い順', 'roi' => '利益率が高い順', 'price' => '買取価格が高い順', 'change' => '前回から上がった順');
    $html .= '<div class="sdr-tools"><input type="search" class="sdr-q" placeholder="商品名で検索" aria-label="商品名で検索"><select class="sdr-sort" aria-label="並び替え">';
    foreach ($sorts as $k => $label) {
        $html .= '<option value="' . esc_attr($k) . '">' . esc_html($label) . '</option>';
    }
    $html .= '</select></div>';

    $ad = sedori_opt('ad_html');
    $every = max(1, (int) sedori_opt('ad_every', 5));
    $html .= '<ol class="sdr-list" data-every="' . esc_attr($every) . '">';
    foreach ($products as $i => $p) {
        $html .= sedori_render_item($p, $i, $data, $metric);
        if ($ad && ($i + 1) % $every === 0 && $i + 1 < count($products)) {
            $html .= '<li class="sdr-ad" aria-label="広告">' . $ad . '</li>';
        }
    }
    $html .= '</ol>';

    $html .= '<p class="sdr-note">' . ($metric === 'rate'
        ? '買取率 = 各店の中で一番高い買取価格（未開封・一番高い色）÷ 定価。'
        : '利益 = 各店の中で一番高い買取価格（未開封・シュリンク付き）− 定価。')
        . '買取価格は各店の掲載価格をもとにしています。実際の買取額は各店で確認してください。</p>';

    $html .= sedori_jsonld($cat, $products);
    return $html . '</div>';
}
