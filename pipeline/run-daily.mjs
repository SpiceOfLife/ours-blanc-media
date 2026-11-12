// Daily job: Check (metrics) → Act (strategy update) → Plan → Do (research → write → eyecatch → QA → publish) → Report.
import fs from 'node:fs';
import path from 'node:path';
import { collect } from './metrics.mjs';
import { pdca } from './pdca.mjs';
import { plan } from './plan.mjs';
import { research } from './research.mjs';
import { write } from './write.mjs';
import { renderEyecatch } from './eyecatch.mjs';
import { qa } from './qa.mjs';
import { writeReport } from './report.mjs';
import { P, DRY, readJSON, writeJSON, writeText, toMarkdown, listPosts, jstDate, ledger, log } from './lib/util.mjs';
import { live } from './lib/claude.mjs';

const t0 = Date.now();
const today = jstDate();
const site = readJSON(P.site);
const experience = readJSON(P.experience);
const categories = readJSON(P.categories);
const budget = Number(process.env.DAILY_BUDGET_USD ?? site.pipeline.dailyBudgetUSD);
log(`daily run ${today} — ${live() ? 'LIVE' : 'MOCK (no ANTHROPIC_API_KEY or DRY_RUN=1)'}; budget $${budget}`);

const metrics = await collect(jstDate(-1));
const act = await pdca(metrics);
const todo = plan();
log(`plan: ${todo.newTopics.map((t) => t.id).join(', ')} | refresh: ${todo.refresh.map((r) => r.slug).join(', ') || '-'}`);

const setTopic = (id, patch) => { const tp = readJSON(P.topics); const t = tp.topics.find((x) => x.id === id); if (t) Object.assign(t, patch); writeJSON(P.topics, tp); };
const results = [];
const jobs = [
  ...todo.refresh.map((r) => { const post = listPosts().find((p) => p.slug === r.slug); return { refresh: r, topic: { id: r.slug, keyword: post.front.keyword ?? post.front.title, category: post.front.category, intent: post.front.intent } }; }),
  ...todo.newTopics.map((t) => ({ topic: t })),
];

for (const job of jobs) {
  const { topic, refresh } = job;
  if (ledger.usd >= budget * 0.85) { log(`budget reached ($${ledger.usd.toFixed(2)}) — stopping`); results.push({ keyword: topic.keyword, published: false, error: '予算上限に達したため翌日に繰り越し' }); continue; }
  try {
    if (!refresh) setTopic(topic.id, { status: 'in-progress' });
    const category = categories.find((c) => c.id === topic.category);
    const existing = listPosts();
    const r = await research(topic, { category, experience: experience.items });
    let art = await write(topic, r, { experience: experience.items, existing, refresh });
    const ctx = { site, experience, existing, research: r };
    let review = await qa(art, ctx);
    // one revision pass with the editor's feedback, unless the problem is duplication (handled by refreshing instead)
    if (!review.pass && !review.issues.some((i) => /重複|同じキーワード/.test(i.msg)) && ledger.usd < budget * 0.7) {
      log('  revising with QA feedback');
      const feedback = [...review.issues.map((i) => i.msg), ...review.fixes].join('\n- ');
      art = await write(topic, r, { experience: experience.items, existing, refresh, revise: { body: art.body, feedback } });
      review = await qa(art, ctx);
    }
    const slug = DRY ? `_dry-${art.slug}` : art.slug;
    const front = { ...art.front, eyecatch: `/eyecatch/${slug}.png`, qaScore: review.score, draft: DRY || !review.pass ? true : undefined };
    await renderEyecatch({ slug, title: front.title, subtitle: front.eyecatchSubtitle, category: front.category });
    if (review.pass || DRY) {
      writeText(path.join(P.posts, `${slug}.md`), toMarkdown(front, art.body));
      if (!refresh && !DRY) setTopic(topic.id, { status: 'published', slug, publishedAt: today });
    }
    if (!review.pass) {
      writeText(path.join(P.drafts, `${today}-${art.slug}.md`), toMarkdown({ ...front, draft: true }, art.body));
      writeJSON(path.join(P.drafts, `${today}-${art.slug}.qa.json`), review);
      if (!refresh && !DRY) setTopic(topic.id, { status: 'rejected', rejectedAt: today, rejectReason: review.issues.filter((i) => i.level === 'block').map((i) => i.msg).slice(0, 3) });
    }
    results.push({ slug, title: front.title, keyword: topic.keyword, published: review.pass && !DRY, refreshed: !!refresh, qa: review });
    log(`  → ${review.pass ? 'PASS' : 'FAIL'} (${review.score}) $${ledger.usd.toFixed(2)}`);
  } catch (e) {
    log(`  error: ${e.stack ?? e}`);
    if (!refresh) setTopic(topic.id, { status: 'queued' });
    results.push({ keyword: topic.keyword, published: false, error: String(e.message ?? e).slice(0, 300) });
  }
}

// record refreshed slugs so PDCA doesn't churn the same page
const s = readJSON(P.strategy); const h = s.history?.at(-1);
if (h) { h.refreshed = results.filter((r) => r.refreshed && r.published).map((r) => r.slug); h.published = results.filter((r) => r.published).map((r) => r.slug); h.costUSD = +ledger.usd.toFixed(3); writeJSON(P.strategy, s); }

const md = writeReport({ date: today, metrics, pdca: act, plan: todo, results, durationSec: Math.round((Date.now() - t0) / 1000) });
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
log(`done. published ${results.filter((r) => r.published).length}/${results.length}, cost $${ledger.usd.toFixed(2)}`);
