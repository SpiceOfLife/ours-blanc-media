// Eyecatch / OG image generator (1200×630). Original, brand-consistent artwork from text + category glyph —
// no third-party product photos, so no image-rights risk. Rendered with sharp (librsvg); CI installs fonts-noto-cjk.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { P, readJSON, listPosts } from './lib/util.mjs';

const COLORS = { blue: '#007AFF', indigo: '#5856D6', teal: '#30B0C7', pink: '#FF2D55', purple: '#AF52DE', orange: '#FF9500', cyan: '#32ADE6', green: '#34C759', gray: '#8E8E93' };
const GLYPHS = {
  interface: '<rect x="2.5" y="7" width="19" height="10" rx="2.5"/><circle cx="7.5" cy="12" r="2"/><circle cx="13.5" cy="12" r="2"/><path d="M18 10.5v3"/>',
  keys: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M7 5v9M12 5v9M17 5v9M7 14v5M12 14v5M17 14v5"/>',
  speaker: '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><circle cx="12" cy="14.5" r="3.5"/><circle cx="12" cy="7" r="1.5"/>',
  mic: '<rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  wave: '<path d="M2 12c2-6 4-6 5 0s3 6 5 0 3-6 5 0 3 6 5 0"/>',
  plugin: '<path d="M9 3h6v4h3a2 2 0 0 1 2 2v3h-2a2 2 0 0 0 0 4h2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3z"/>',
  phone: '<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M10.5 18.5h3"/>',
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const FONT = "'Hiragino Sans','Noto Sans CJK JP','Noto Sans JP',sans-serif";

/** Balanced wrap by visual width (CJK = 1em, ASCII ≈ 0.56em); prefers breaks after 、。」 or spaces, never leaves 1–2 char orphans. */
export function wrap(text, emPerLine, maxLines) {
  const w = (ch) => (/[\u0000-\u00ff]/.test(ch) ? 0.56 : 1);
  const chars = [...text.replace(/【サンプル】/, '')];
  const total = chars.reduce((a, c) => a + w(c), 0);
  const n = Math.min(maxLines, Math.ceil(total / emPerLine));
  const target = total / n;
  const lines = []; let cur = ''; let cw = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]; cur += ch; cw += w(ch);
    const next = chars[i + 1]; if (!next || lines.length === n - 1) continue;
    const goodBreak = /[、。」』）!？?\s｜|のとをでにはが]/.test(ch) || /[「『（【]/.test(next);
    const kinsoku = /[、。」』）ーぁぃぅぇぉっゃゅょ]/.test(next) || (/[0-9A-Za-z]/.test(ch) && /[0-9A-Za-z]/.test(next));
    if (!kinsoku && ((goodBreak && cw >= target * 0.7) || cw >= target * 1.2 || cw >= emPerLine - 0.6)) { lines.push(cur.trim()); cur = ''; cw = 0; }
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].slice(0, -1) + '…'; return keep; }
  return lines;
}

export function svg({ title, subtitle = '', categoryName, color = 'blue', glyph = 'wave', dark = false }) {
  const c = COLORS[color] ?? COLORS.blue;
  const bg = dark ? '#000' : '#F2F2F7', card = dark ? '#1C1C1E' : '#FFFFFF', label = dark ? '#FFFFFF' : '#000000', label2 = dark ? 'rgba(235,235,245,.6)' : 'rgba(60,60,67,.6)';
  const lines = wrap(title, 16, 3);
  const size = lines.length >= 3 ? 56 : 62, lh = size * 1.28;
  const y0 = 300 - ((lines.length - 1) * lh) / 2 + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity=".7"/></linearGradient></defs>
  <rect width="1200" height="630" fill="${bg}"/>
  <rect width="1200" height="630" fill="${c}" opacity="${dark ? '.28' : '.16'}"/>
  <rect x="48" y="48" width="1104" height="534" rx="44" fill="${card}"/>
  <g opacity=".16" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round">
    <path d="M820 140c25-70 50-70 62 0s38 70 62 0 38-70 62 0 38 70 62 0"/>
    <path d="M790 190c25-50 50-50 62 0s38 50 62 0 38-50 62 0 38 50 62 0 38 50 62 0"/></g>
  <rect x="96" y="96" width="96" height="96" rx="22" fill="url(#g)"/>
  <g transform="translate(116 116) scale(2.33)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph] ?? GLYPHS.wave}</g>
  <text x="216" y="134" font-family="${FONT}" font-size="26" font-weight="700" fill="${c}">${esc(categoryName)}</text>
  <text x="216" y="172" font-family="${FONT}" font-size="24" font-weight="400" fill="${label2}">${esc(subtitle)}</text>
  ${lines.map((l, i) => `<text x="96" y="${y0 + i * lh + 40}" font-family="${FONT}" font-size="${size}" font-weight="800" fill="${label}">${esc(l)}</text>`).join('\n  ')}
  <text x="96" y="534" font-family="${FONT}" font-size="30" font-weight="300" fill="${label}">ours blanc</text>
  <text x="246" y="534" font-family="${FONT}" font-size="30" font-weight="800" fill="${c}">Gear</text>
  <text x="1104" y="534" text-anchor="end" font-family="${FONT}" font-size="22" fill="${label2}">gear.ours-blanc.app</text>
</svg>`;
}

export async function renderEyecatch({ slug, title, subtitle, category }) {
  const cats = readJSON(P.categories); const cat = cats.find((c) => c.id === category) ?? { name: category, color: 'gray', glyph: 'wave' };
  const out = path.join(P.eyecatch, `${slug}.png`);
  fs.mkdirSync(P.eyecatch, { recursive: true });
  await sharp(Buffer.from(svg({ title, subtitle, categoryName: cat.name, color: cat.color, glyph: cat.glyph }))).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(out);
  return out;
}

// CLI: regenerate all eyecatches (+ default OG image)
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const p of listPosts()) { await renderEyecatch({ slug: p.slug, title: p.front.title, subtitle: p.front.eyecatchSubtitle, category: p.front.category }); console.log('eyecatch', p.slug); }
  const site = readJSON(P.site);
  await sharp(Buffer.from(svg({ title: 'DTM・音楽機材の比較とレビュー', subtitle: '出典付きで、使いどころまで整理', categoryName: site.name, color: 'blue', glyph: 'wave' }))).png().toFile(path.join(P.eyecatch, '../og-default.png'));
  console.log('og-default.png');
}
