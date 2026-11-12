// Check → Act. Turns metrics into a bounded strategy update (guardrails keep any single day's change small).
import { ask } from './lib/claude.mjs';
import { PDCA_SYSTEM, pdcaPrompt } from './prompts.mjs';
import { mockPdca } from './mock.mjs';
import { trend } from './metrics.mjs';
import { P, readJSON, writeJSON, listPosts, slugify, jstDate, log } from './lib/util.mjs';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function pagePerformance(metrics, posts) {
  return posts.map((p) => {
    const url = `/posts/${p.slug}/`;
    const g = metrics.gsc?.pages?.find((x) => x.page.endsWith(url));
    const c = metrics.cloudflare?.pages?.find((x) => x.path === url);
    return { slug: p.slug, title: p.front.title, category: p.front.category, published: p.front.publishedAt, updated: p.front.updatedAt,
      pv: c?.pageviews ?? 0, impressions: g?.impressions ?? 0, clicks: g?.clicks ?? 0, ctr: g?.ctr ?? 0, position: g?.position ?? null };
  });
}

export async function pdca(metrics) {
  const strategy = readJSON(P.strategy); const topics = readJSON(P.topics); const cats = readJSON(P.categories); const site = readJSON(P.site);
  const posts = listPosts().filter((p) => !p.front.draft);
  const pages = pagePerformance(metrics, posts);
  // deterministic signals (used even when the model is unavailable)
  const striking = pages.filter((p) => p.position && p.position >= 8 && p.position <= 20 && p.impressions >= 30).sort((a, b) => b.impressions - a.impressions);
  const lowCtr = pages.filter((p) => p.impressions >= 100 && p.ctr < 0.01);
  const ctx = { strategy: { ...strategy, history: undefined }, metrics: { gsc: metrics.gsc && { clicks: metrics.gsc.clicks, impressions: metrics.gsc.impressions, ctr: metrics.gsc.ctr, position: metrics.gsc.position, status: metrics.gsc.status },
    pv: metrics.cloudflare?.pageviews, adsense: metrics.adsense, affiliate: metrics.affiliate, revenueJPY: metrics.revenueJPY },
    trend: trend(7, metrics.date), pages, queries: metrics.gsc?.queries ?? [], queueLeft: topics.topics.filter((t) => t.status === 'queued').length, postCount: posts.length,
    categories: cats.map((c) => c.id) };
  log('pdca: analysing');
  const { json: r } = await ask({ system: PDCA_SYSTEM, prompt: pdcaPrompt(ctx), json: true, maxTokens: 4000, mock: mockPdca });
  const a = r.act ?? {}; const applied = [];

  const n = clamp(Math.round(a.articlesPerDay ?? strategy.articlesPerDay), site.pipeline.minArticlesPerDay, site.pipeline.maxArticlesPerDay);
  if (n !== strategy.articlesPerDay) { applied.push(`記事数/日 ${strategy.articlesPerDay} → ${n}`); strategy.articlesPerDay = n; }
  for (const [k, dv] of Object.entries(a.categoryWeightChanges ?? {})) {
    if (!(k in strategy.categoryWeights)) continue;
    const nv = +clamp(strategy.categoryWeights[k] + clamp(dv, -0.3, 0.3), 0.3, 2.5).toFixed(2);
    if (nv !== strategy.categoryWeights[k]) { applied.push(`重み ${k}: ${strategy.categoryWeights[k]} → ${nv}`); strategy.categoryWeights[k] = nv; }
  }
  const known = new Set(topics.topics.map((t) => t.keyword));
  for (const t of (a.newTopics ?? []).slice(0, 3)) {
    if (!cats.some((c) => c.id === t.category) || known.has(t.keyword)) continue;
    topics.topics.push({ id: slugify(`${t.category}-${t.keyword}`) || `t-${Date.now()}`, keyword: t.keyword, category: t.category, intent: t.intent ?? 'buying-guide',
      priority: clamp(t.priority ?? 5, 1, 10), status: 'queued', source: 'pdca', reason: t.reason, addedAt: jstDate() });
    applied.push(`トピック追加: ${t.keyword}`);
  }
  const refresh = [...(a.refresh ?? []), ...striking.slice(0, 1).map((p) => ({ slug: p.slug, reason: `平均掲載順位 ${p.position.toFixed(1)}・表示 ${p.impressions}回（あと一歩で1ページ目上位）` })),
    ...lowCtr.slice(0, 1).map((p) => ({ slug: p.slug, reason: `CTR ${(p.ctr * 100).toFixed(1)}% と低い → タイトル/description改善` }))]
    .filter((x, i, arr) => posts.some((p) => p.slug === x.slug) && arr.findIndex((y) => y.slug === x.slug) === i);
  // don't refresh the same article more than once per 14 days
  const recent = new Set((strategy.history ?? []).filter((h) => h.date >= jstDate(-14)).flatMap((h) => h.refreshed ?? []));
  strategy.refreshQueue = refresh.filter((x) => !recent.has(x.slug)).slice(0, 3);
  strategy.updatedAt = jstDate(); strategy.version = (strategy.version ?? 1) + 1;
  strategy.history = [...(strategy.history ?? []), { date: jstDate(), applied, check: r.check, hypotheses: r.hypotheses }].slice(-60);
  writeJSON(P.strategy, strategy); writeJSON(P.topics, topics);
  return { check: r.check ?? [], hypotheses: r.hypotheses ?? [], applied, manualTodo: r.manualTodo ?? [], pages, striking, lowCtr, refreshQueue: strategy.refreshQueue };
}
