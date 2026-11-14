import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Private business data (reports, drafts, revenue CSVs, PDCA history) lives in a separate PRIVATE repo
// (SpiceOfLife/ours-blanc-media-data) checked out at DATA_DIR, so this code repo can be public.
export const DATA = path.resolve(ROOT, process.env.DATA_DIR || '.data');
export const P = {
  site: path.join(ROOT, 'config/site.json'),
  categories: path.join(ROOT, 'config/categories.json'),
  topics: path.join(ROOT, 'config/topics.json'),
  strategy: path.join(ROOT, 'config/strategy.json'),
  experience: path.join(ROOT, 'config/experience.json'),
  posts: path.join(ROOT, 'src/content/posts'),
  eyecatch: path.join(ROOT, 'public/eyecatch'),
  drafts: process.env.DRY_RUN === '1' ? path.join(ROOT, '.work/drafts') : path.join(DATA, 'drafts'),
  reports: process.env.DRY_RUN === '1' ? path.join(ROOT, '.work/reports') : path.join(DATA, 'reports/daily'),
  history: process.env.DRY_RUN === '1' ? path.join(ROOT, '.work/strategy-history.json') : path.join(DATA, 'strategy-history.json'),
  manual: path.join(DATA, 'manual'),
  work: path.join(ROOT, '.work'),
};
export const DRY = process.env.DRY_RUN === '1';
export const readJSON = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { if (fb !== undefined) return fb; throw new Error(`cannot read ${f}`); } };
export const writeJSON = (f, v) => {
  if (DRY && f.startsWith(path.join(ROOT, 'config'))) f = path.join(ROOT, '.work', path.relative(ROOT, f)); // dry runs never mutate config
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };
export const writeText = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

/** YYYY-MM-DD in Asia/Tokyo, offset in days */
export function jstDate(offsetDays = 0, from = new Date()) {
  const d = new Date(from.getTime() + 9 * 3600e3 + offsetDays * 86400e3);
  return d.toISOString().slice(0, 10);
}
export const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Very small front-matter (YAML subset via JSON values) reader/writer. */
export function toMarkdown(front, body) {
  const y = Object.entries(front).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${y}\n---\n\n${body.trim()}\n`;
}
export function parseMarkdown(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { front: {}, body: src };
  const front = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim(); const raw = line.slice(i + 1).trim();
    try { front[k] = JSON.parse(raw); } catch { front[k] = raw.replace(/^["']|["']$/g, ''); }
  }
  return { front, body: m[2] };
}
export function listPosts() {
  if (!fs.existsSync(P.posts)) return [];
  return fs.readdirSync(P.posts).filter((f) => f.endsWith('.md')).map((f) => {
    const { front, body } = parseMarkdown(fs.readFileSync(path.join(P.posts, f), 'utf8'));
    return { slug: f.replace(/\.md$/, ''), file: path.join(P.posts, f), front, body };
  });
}

/** Running cost ledger so the daily job never exceeds the configured budget. */
export const ledger = {
  usd: 0, calls: 0, searches: 0,
  add(u, model = '') {
    const price = /haiku/.test(model) ? [1, 5] : /opus/.test(model) ? [5, 25] : [3, 15]; // USD / MTok (in, out) — override with env if pricing changes
    const pin = Number(process.env.PRICE_IN_PER_MTOK ?? price[0]); const pout = Number(process.env.PRICE_OUT_PER_MTOK ?? price[1]);
    const s = u?.server_tool_use?.web_search_requests ?? 0;
    this.usd += ((u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0)) / 1e6 * pin + (u?.cache_read_input_tokens ?? 0) / 1e6 * pin * 0.1 + (u?.output_tokens ?? 0) / 1e6 * pout + s * 0.01;
    this.calls++; this.searches += s;
  },
};

/** char 3-gram Jaccard similarity (language-agnostic, works for Japanese). */
export function similarity(a, b) {
  const g = (s) => { const t = s.replace(/[\s\p{P}#*|`>-]+/gu, ''); const set = new Set(); for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3)); return set; };
  const A = g(a), B = g(b); if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
