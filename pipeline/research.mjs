import { ask } from './lib/claude.mjs';
import { searchItems, bestMatch, rakutenReady } from './lib/rakuten.mjs';
import { amazonSearchUrl } from './lib/amazon.mjs';
import { RESEARCH_SYSTEM, researchPrompt } from './prompts.mjs';
import { mockResearch } from './mock.mjs';
import { jstDate, log } from './lib/util.mjs';

export async function research(topic, { category, experience }) {
  log(`research: ${topic.keyword}`);
  const { json: r, citations } = await ask({ system: RESEARCH_SYSTEM, prompt: researchPrompt(topic, category, experience), webSearch: 8, json: true, maxTokens: 12000, mock: mockResearch(topic) });
  // merge web-search citations into sources (dedupe by URL)
  const seen = new Set(); r.sources = [...(r.sources ?? []), ...citations].filter((s) => s?.url && !seen.has(s.url) && seen.add(s.url)).slice(0, 15);
  // enrich products with live marketplace data (price, image, review stats, affiliate links)
  const today = jstDate();
  for (const p of r.products ?? []) {
    const items = await searchItems(p.rakutenQuery || p.name, { hits: 10 });
    const m = bestMatch(items, p.name);
    if (m) Object.assign(p, { priceJPY: m.price, priceCheckedAt: today, imageUrl: m.image, rakutenUrl: m.url, reviewAverage: m.reviewAverage, reviewCount: m.reviewCount, reviewSource: '楽天レビュー' });
    p.amazonUrl = amazonSearchUrl(`${p.brand ?? ''} ${p.name}`.trim());
  }
  r.usesRakutenApi = !!rakutenReady() && (r.products ?? []).some((p) => p.rakutenUrl);
  return r;
}
