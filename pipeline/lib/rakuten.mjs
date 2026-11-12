// Rakuten Ichiba Item Search API (2026 endpoint: openapi.rakuten.co.jp, requires applicationId + accessKey + Referer).
import { DRY, log } from './util.mjs';
const EP = process.env.RAKUTEN_ENDPOINT || 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601';

export const rakutenReady = () => !DRY && process.env.RAKUTEN_APP_ID && process.env.RAKUTEN_ACCESS_KEY;

export async function searchItems(keyword, { hits = 5, genreId, minPrice } = {}) {
  if (!rakutenReady()) return [];
  const q = new URLSearchParams({ format: 'json', formatVersion: '2', applicationId: process.env.RAKUTEN_APP_ID, accessKey: process.env.RAKUTEN_ACCESS_KEY,
    keyword, hits: String(hits), sort: '-reviewCount', availability: '1', imageFlag: '1' });
  if (process.env.RAKUTEN_AFFILIATE_ID) q.set('affiliateId', process.env.RAKUTEN_AFFILIATE_ID);
  if (genreId) q.set('genreId', genreId);
  if (minPrice) q.set('minPrice', String(minPrice));
  const res = await fetch(`${EP}?${q}`, { headers: { Referer: process.env.RAKUTEN_REFERER || 'https://gear.ours-blanc.app/', Origin: 'https://gear.ours-blanc.app' } });
  if (!res.ok) { log(`  rakuten ${res.status} for "${keyword}": ${(await res.text()).slice(0, 200)}`); return []; }
  const j = await res.json();
  await new Promise((r) => setTimeout(r, 1100)); // API rule: ≤1 request / second
  return (j.Items ?? []).map((it) => ({
    name: it.itemName, price: it.itemPrice, url: it.affiliateUrl || it.itemUrl, shop: it.shopName,
    image: (it.mediumImageUrls?.[0] ?? '').replace(/\?_ex=\d+x\d+/, '?_ex=300x300'),
    reviewAverage: Number(it.reviewAverage) || undefined, reviewCount: Number(it.reviewCount) || undefined,
  }));
}

/** Pick the listing that best matches a product name (all model tokens present, then most reviews). */
export function bestMatch(items, productName) {
  const toks = productName.toLowerCase().split(/[\s/()（）]+/).filter((t) => t.length >= 2);
  const scored = items.map((it) => ({ it, s: toks.filter((t) => it.name.toLowerCase().includes(t)).length / (toks.length || 1) }));
  const ok = scored.filter((x) => x.s >= 0.6).sort((a, b) => b.s - a.s || (b.it.reviewCount ?? 0) - (a.it.reviewCount ?? 0));
  return ok[0]?.it;
}
