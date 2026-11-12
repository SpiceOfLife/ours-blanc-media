import { P, readJSON, listPosts } from './lib/util.mjs';

/** Choose today's work: N new topics (spread across categories) + refreshes chosen by PDCA. */
export function plan({ strategy = readJSON(P.strategy), topics = readJSON(P.topics), site = readJSON(P.site) } = {}) {
  const want = Number(process.env.ARTICLES_OVERRIDE) || strategy.articlesPerDay || site.pipeline.defaultArticlesPerDay;
  const n = Math.max(site.pipeline.minArticlesPerDay, Math.min(site.pipeline.maxArticlesPerDay, want));
  const published = listPosts();
  const perCat = Object.fromEntries(published.map((p) => [p.front.category, 0]));
  for (const p of published) perCat[p.front.category] = (perCat[p.front.category] ?? 0) + 1;
  const score = (t) => t.priority * (strategy.categoryWeights?.[t.category] ?? 1) * (strategy.intentWeights?.[t.intent] ?? 1) / (1 + 0.15 * (perCat[t.category] ?? 0));
  const queued = topics.topics.filter((t) => t.status === 'queued').sort((a, b) => score(b) - score(a));
  const picks = []; const used = new Set();
  for (const t of queued) { if (picks.length >= n) break; if (used.has(t.category)) continue; picks.push(t); used.add(t.category); }
  for (const t of queued) { if (picks.length >= n) break; if (!picks.includes(t)) picks.push(t); }
  const refresh = (strategy.refreshQueue ?? []).filter((r) => published.some((p) => p.slug === r.slug)).slice(0, site.pipeline.maxRefreshesPerDay);
  return { newTopics: picks, refresh, scores: picks.map((t) => ({ id: t.id, score: +score(t).toFixed(2) })) };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(plan(), null, 2));
