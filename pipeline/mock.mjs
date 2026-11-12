// Fixtures for DRY_RUN / no-API-key runs. Clearly labelled sample data; never published (posts are written as draft).
export const mockResearch = (t) => ({
  reader: 'これから自宅で音楽制作を始める人', searchIntent: ['失敗しない選び方を知りたい', '予算別の候補を比較したい'],
  angle: '鍵盤奏者の視点で、演奏のしやすさと制作のしやすさを分けて評価する',
  criteria: [{ name: '接続端子', detail: 'USB-C / iPad対応か', sourceUrl: 'https://example.com/spec' }],
  products: ['サンプル製品A', 'サンプル製品B', 'サンプル製品C'].map((n, i) => ({ name: n, brand: 'Sample', rakutenQuery: n, bestFor: ['入門', '中級', '持ち運び'][i],
    priceJPY: [14800, 26800, 39800][i], priceCheckedAt: '2026-11-13', specs: { 接続: 'USB-C', 重量: `${1 + i}.0kg` }, rakutenUrl: 'https://example.com/rakuten', amazonUrl: 'https://example.com/amazon', reviewAverage: [4.4, 4.2, 4.6][i], reviewCount: [1204, 356, 88][i], reviewSource: '楽天レビュー（サンプル）', pros: ['設定が簡単', '付属ソフトが充実'], cons: ['上位機より機能が少ない'], officialUrl: 'https://example.com' })),
  faq: [{ q: '初心者はどれを選べばいい？', a: 'まずは用途と予算を決め、接続端子を確認しましょう。' }],
  keyFacts: [{ fact: 'サンプルの事実', sourceUrl: 'https://example.com/spec' }],
  sources: [{ title: 'サンプル出典1', url: 'https://example.com/a' }, { title: 'サンプル出典2', url: 'https://example.com/b' }, { title: 'サンプル出典3', url: 'https://example.com/c' }],
});
const para = '（サンプル本文）実際の運用ではClaudeがリサーチ結果に基づいて本文を書きます。ここではレイアウト確認のためのダミーテキストを表示しています。選び方の基準、用途ごとの向き不向き、購入前に確認すべきポイントを順に解説します。';
export const mockWrite = (t) => ({
  title: `【サンプル】${t.keyword.split(' ')[0]}の選び方とおすすめ3選`, description: `${t.keyword}について、選び方の基準と用途別のおすすめをサンプルデータで表示しています。DRY_RUNで生成された確認用の記事です。`.padEnd(110, '。'),
  slug: t.id, eyecatchAlt: `${t.keyword}のアイキャッチ`, eyecatchSubtitle: '選び方とおすすめ',
  products: ['サンプル製品A', 'サンプル製品B', 'サンプル製品C'].map((n, i) => ({ name: n, summary: '入門に必要な機能がまとまっています。', editorScore: 4.5 - i * 0.3, bestFor: ['入門', '中級', '持ち運び'][i] })),
  faq: [{ q: '初心者はどれを選べばいい？', a: 'まずは用途と予算を決め、接続端子を確認しましょう。' }],
  body: ['結論から言うと、' + para, '## 選び方のポイント', para.repeat(6), '### 接続端子', para.repeat(4), '## 用途別のおすすめ', para.repeat(6),
    '| 製品 | 向いている人 |\n|---|---|\n| サンプル製品A | 入門 |\n| サンプル製品B | 中級 |', '## 購入前のチェックリスト', para.repeat(6), '## よくある失敗', para.repeat(3), '## まとめ', para.repeat(2)].join('\n\n'),
});
export const mockReview = { scores: { usefulness: 17, accuracy: 18, originality: 15, readability: 17, compliance: 19 }, total: 86, blocking: false, issues: ['(mock) no issues'], fixes: [] };
export const mockPdca = { check: ['(mock) データ蓄積中'], hypotheses: ['立ち上げ期は購入意図の強い比較記事が先に伸びる'],
  act: { articlesPerDay: 2, categoryWeightChanges: {}, newTopics: [], refresh: [] }, manualTodo: [] };
