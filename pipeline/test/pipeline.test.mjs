import test from 'node:test';
import assert from 'node:assert/strict';
import { similarity, toMarkdown, parseMarkdown, jstDate } from '../lib/util.mjs';
import { ruleChecks } from '../qa.mjs';
import { wrap } from '../eyecatch.mjs';
import { bestMatch } from '../lib/rakuten.mjs';
import { extractJSON } from '../lib/claude.mjs';

const site = { pipeline: { minChars: 100, maxChars: 5000, similarityThreshold: 0.55 } };
const front = { title: 'テスト記事タイトル', description: 'x'.repeat(80), pr: true, intent: 'comparison', keyword: 'k',
  sources: [1, 2, 3].map((i) => ({ title: 's', url: `https://e.com/${i}` })), products: [{ name: 'A', rakutenUrl: 'https://r' }, { name: 'B', amazonUrl: 'https://a' }] };
const body = '## 一\n' + 'あいうえおかきくけこ'.repeat(10) + '\n\n## 二\n本文です。\n\n## 三\nまとめ。';
const ctx = { site, experience: { items: [{ name: 'Yamaha reface DX', owned: true, notes: '軽い' }] }, existing: [] };

test('front-matter round trip', () => { const md = toMarkdown(front, body); const p = parseMarkdown(md); assert.equal(p.front.title, front.title); assert.deepEqual(p.front.sources, front.sources); });
test('clean article has no blocking issues', () => assert.deepEqual(ruleChecks({ front, body }, ctx).filter((i) => i.level === 'block'), []));
test('superlatives block', () => assert.ok(ruleChecks({ front, body: body + '\n\nこれは最強です。' }, ctx).some((i) => i.level === 'block')));
test('fabricated first-hand experience blocks', () => assert.ok(ruleChecks({ front, body: body + '\n\nRoland製品を実際に使ってみた感想です。' }, ctx).some((i) => /一次体験/.test(i.msg))));
test('owned gear with notes may describe experience', () => assert.ok(!ruleChecks({ front, body: body + '\n\nreface DXを実際に使ってみた感想です。' }, ctx).some((i) => /一次体験/.test(i.msg))));
test('missing PR flag blocks', () => assert.ok(ruleChecks({ front: { ...front, pr: false }, body }, ctx).some((i) => /PR/.test(i.msg))));
test('duplicate detection', () => assert.ok(ruleChecks({ front, body }, { ...ctx, existing: [{ slug: 'x', front: { title: 'old' }, body }] }).some((i) => /重複/.test(i.msg))));
test('similarity bounds', () => { assert.equal(similarity('abcdef', 'abcdef'), 1); assert.ok(similarity('オーディオ機材の選び方', '今日の天気は晴れです') < 0.1); });
test('eyecatch wrap ≤ 3 lines', () => assert.ok(wrap('あ'.repeat(80), 16, 3).length <= 3));
test('rakuten best match', () => assert.equal(bestMatch([{ name: 'ケース', reviewCount: 9 }, { name: 'Focusrite Scarlett Solo 4th Gen', reviewCount: 3 }], 'Scarlett Solo 4th Gen')?.reviewCount, 3));
test('extractJSON picks last block', () => assert.deepEqual(extractJSON('x ```json\n{"a":1}\n``` y ```json\n{"b":2}\n```'), { b: 2 }));
test('jstDate format', () => assert.match(jstDate(), /^\d{4}-\d{2}-\d{2}$/));
