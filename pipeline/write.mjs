import { ask } from './lib/claude.mjs';
import { WRITE_SYSTEM, writePrompt } from './prompts.mjs';
import { mockWrite } from './mock.mjs';
import { jstDate, log, slugify } from './lib/util.mjs';

export async function write(topic, research, { experience, existing, refresh, revise }) {
  log(`write: ${topic.keyword}${refresh ? ' (refresh)' : ''}`);
  const prev = refresh && existing.find((p) => p.slug === refresh.slug);
  const { json: w } = await ask({ system: WRITE_SYSTEM, maxTokens: 16000, json: true, mock: mockWrite(topic),
    prompt: writePrompt(topic, research, { experience, existingTitles: existing.filter((p) => p.slug !== refresh?.slug).map((p) => p.front.title), refresh, existingBody: prev?.body, revise }) });
  const slug = refresh?.slug ?? (slugify(w.slug || topic.id) || topic.id);
  const byName = Object.fromEntries((w.products ?? []).map((p) => [p.name, p]));
  const products = (research.products ?? []).filter((p) => byName[p.name]).map((p) => ({
    name: p.name, brand: p.brand, summary: byName[p.name].summary, bestFor: byName[p.name].bestFor ?? p.bestFor,
    editorScore: typeof byName[p.name].editorScore === 'number' ? Math.round(byName[p.name].editorScore * 10) / 10 : undefined,
    priceJPY: p.priceJPY, priceCheckedAt: p.priceCheckedAt, imageUrl: p.imageUrl, rakutenUrl: p.rakutenUrl, amazonUrl: p.amazonUrl,
    reviewAverage: p.reviewAverage, reviewCount: p.reviewCount, reviewSource: p.reviewSource,
    pros: (p.pros ?? []).slice(0, 4), cons: (p.cons ?? []).slice(0, 3), specs: Object.fromEntries(Object.entries(p.specs ?? {}).slice(0, 6).map(([k, v]) => [k, String(v)])),
  })).map((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)));
  const today = jstDate();
  const front = {
    title: w.title, description: w.description, category: topic.category, intent: topic.intent, keyword: topic.keyword,
    publishedAt: prev?.front.publishedAt ?? today, updatedAt: prev ? today : undefined,
    eyecatch: `/eyecatch/${slug}.png`, eyecatchAlt: w.eyecatchAlt, eyecatchSubtitle: w.eyecatchSubtitle,
    products, faq: (w.faq ?? []).slice(0, 6), sources: research.sources ?? [], pr: true, aiAssisted: true, usesRakutenApi: !!research.usesRakutenApi,
  };
  return { slug, front, body: w.body ?? '' };
}
