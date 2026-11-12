import site from '../../config/site.json';
import categories from '../../config/categories.json';
import { getCollection, type CollectionEntry } from 'astro:content';

export { site, categories };
export type Post = CollectionEntry<'posts'>;
export const showDrafts = import.meta.env.DEV || import.meta.env.INCLUDE_DRAFTS === '1';

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', (p) => showDrafts || !p.data.draft);
  return all.sort((a, b) => +(b.data.updatedAt ?? b.data.publishedAt) - +(a.data.updatedAt ?? a.data.publishedAt));
}
export const category = (id: string) => categories.find((c) => c.id === id) ?? { id, name: id, en: id, color: 'gray', glyph: 'wave' };
export const intentLabel: Record<string, string> = { comparison: '比較', howto: 'ハウツー', 'buying-guide': '選び方', 'single-review': 'レビュー' };
export const fmtDate = (d: Date) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(d);
export const yen = (n: number) => '¥' + n.toLocaleString('ja-JP');
export const readMinutes = (body = '') => Math.max(1, Math.round(body.replace(/\s/g, '').length / 600));
export const env = {
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
  cfBeacon: import.meta.env.PUBLIC_CF_BEACON_TOKEN ?? '',
  gscVerification: import.meta.env.PUBLIC_GSC_VERIFICATION ?? '',
};
