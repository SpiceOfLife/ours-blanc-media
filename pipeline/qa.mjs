// Quality gate. An article is auto-published only if every blocking rule passes AND the editor-model score ≥ qaPassScore.
import { ask, REVIEW_MODEL } from './lib/claude.mjs';
import { REVIEW_SYSTEM } from './prompts.mjs';
import { mockReview } from './mock.mjs';
import { similarity, DRY, log } from './lib/util.mjs';

const SUPERLATIVES = /(最強|絶対(に)?|必ず|No\.?\s?1|ナンバーワン|業界一|日本一|世界一|完璧|100%|誰でも簡単)/g;
const FIRST_HAND = /(使ってみた|実際に使(用|っ)|愛用|購入して|試してみ|自宅で使って|私が使って|レビューすると)/;
const COPY_MARKERS = /(引用元|転載|出典：[^\n]{0,5}$)/m;

export function ruleChecks({ front, body }, { site, experience, existing }) {
  const issues = []; const block = (m) => issues.push({ level: 'block', msg: m }); const warn = (m) => issues.push({ level: 'warn', msg: m });
  const chars = body.replace(/\s/g, '').length;
  if (chars < site.pipeline.minChars) block(`本文が短すぎます (${chars}字 < ${site.pipeline.minChars})`);
  if (chars > site.pipeline.maxChars) warn(`本文が長すぎます (${chars}字)`);
  if (!front.pr) block('PR表記フラグがありません（ステマ規制）');
  if (!front.title || front.title.length > 60) block('タイトルが空、または長すぎます');
  if (!front.description || front.description.length < 60) block('meta description が短すぎます');
  const h2 = (body.match(/^## /gm) ?? []).length; if (h2 < 3) block(`H2見出しが少なすぎます (${h2})`);
  if (/^# /m.test(body)) warn('本文にH1があります');
  if ((front.sources ?? []).length < 3) block(`出典が不足しています (${(front.sources ?? []).length} < 3)`);
  const bad = (front.sources ?? []).filter((s) => !/^https?:\/\//.test(s.url)); if (bad.length) block('不正な出典URLがあります');
  if (front.intent !== 'howto' && (front.products ?? []).length < 2) block('比較・選び方記事に製品が2点未満です');
  for (const p of front.products ?? []) if (!p.rakutenUrl && !p.amazonUrl) warn(`購入リンクがない製品: ${p.name}`);
  const sup = [...new Set(body.match(SUPERLATIVES) ?? [])]; if (sup.length) block(`根拠のない最上級・断定表現: ${sup.join(', ')}`);
  if (/[¥￥]\s?\d|[0-9,]{4,}円/.test(body)) warn('本文に価格の具体額があります（価格は製品カードで日付付き表示）');
  if (COPY_MARKERS.test(body)) warn('転載を示唆する表現があります');
  // first-hand experience may only appear for owned gear that has notes
  const owned = (experience.items ?? []).filter((e) => e.owned && e.notes).flatMap((e) => { const n = e.name.toLowerCase(); return [n, n.split(' ').slice(1).join(' ')].filter((x) => x.length >= 3); });
  for (const para of body.split(/\n{2,}/)) if (FIRST_HAND.test(para) && !owned.some((n) => para.toLowerCase().includes(n)))
    block(`一次体験の記述（所有機材メモ外）: 「${para.slice(0, 40)}…」`);
  // duplicate / scaled-content guard
  for (const p of existing) {
    if (p.slug === front.slug) continue;
    const s = similarity(body, p.body); if (s >= site.pipeline.similarityThreshold) block(`既存記事「${p.front.title}」と内容が重複 (類似度 ${s.toFixed(2)})`);
    if (p.front.keyword && p.front.keyword === front.keyword) block(`同じキーワードの記事が既にあります: ${p.slug}`);
  }
  return issues;
}

export async function checkLinks(urls) {
  if (DRY) return [];
  const dead = [];
  await Promise.all(urls.map(async (u) => {
    try { const r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (ours-blanc-gear link check)' } });
      if (r.status >= 400 && ![401, 403, 429].includes(r.status)) dead.push(`${r.status} ${u}`); } catch (e) { dead.push(`ERR ${u}`); }
  }));
  return dead;
}

export async function qa(article, ctx) {
  log(`qa: ${article.slug}`);
  const issues = ruleChecks({ ...article, front: { ...article.front, slug: article.slug } }, ctx);
  const dead = await checkLinks((article.front.sources ?? []).map((s) => s.url));
  if (dead.length > Math.max(1, (article.front.sources ?? []).length / 3)) issues.push({ level: 'block', msg: `リンク切れの出典が多すぎます: ${dead.join(', ')}` });
  else dead.forEach((d) => issues.push({ level: 'warn', msg: `リンク切れ: ${d}` }));
  // editor model review (cheap to skip if rules already block)
  let review = { total: 0, blocking: false, issues: [], scores: {} };
  if (!issues.some((i) => i.level === 'block')) {
    const { json } = await ask({ system: REVIEW_SYSTEM, model: REVIEW_MODEL, json: true, maxTokens: 3000, mock: mockReview,
      prompt: `リサーチ結果:\n${JSON.stringify(ctx.research)}\n\n記事メタ:\n${JSON.stringify({ title: article.front.title, description: article.front.description, products: article.front.products })}\n\n本文:\n${article.body}` });
    review = json;
    if (review.blocking) issues.push({ level: 'block', msg: `編集長レビューで差し戻し: ${(review.issues ?? []).join(' / ')}` });
    if (review.total < ctx.site.pipeline.qaPassScore) issues.push({ level: 'block', msg: `編集長スコア ${review.total} < ${ctx.site.pipeline.qaPassScore}` });
  }
  const pass = !issues.some((i) => i.level === 'block');
  return { pass, score: review.total ?? 0, scores: review.scores, issues, fixes: review.fixes ?? [] };
}
