// Check phase — collect yesterday's numbers from every connected source. Each source is optional; missing ones are reported, not fatal.
import fs from 'node:fs';
import path from 'node:path';
import { serviceAccountToken, refreshToken } from './lib/google.mjs';
import { P, readJSON, writeJSON, jstDate, log, DRY } from './lib/util.mjs';

async function searchConsole(date) {
  const token = await serviceAccountToken('https://www.googleapis.com/auth/webmasters.readonly'); if (!token) return { status: 'not-configured' };
  const site = process.env.GSC_SITE_URL || 'sc-domain:ours-blanc.app';
  const q = async (dimensions, extra = {}) => {
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: date, endDate: date, dimensions, rowLimit: 250, dataState: 'all',
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: 'gear.ours-blanc.app' }] }], ...extra }) });
    if (!r.ok) throw new Error(`GSC ${r.status} ${await r.text()}`); return (await r.json()).rows ?? [];
  };
  const [total] = await q([]); const pages = await q(['page']); const queries = await q(['query']);
  return { status: 'ok', clicks: total?.clicks ?? 0, impressions: total?.impressions ?? 0, ctr: total?.ctr ?? 0, position: total?.position ?? null,
    pages: pages.map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    queries: queries.slice(0, 50).map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position })) };
}

async function cloudflare(date) {
  const { CF_API_TOKEN: token, CF_ACCOUNT_ID: account, CF_SITE_TAG: siteTag } = process.env; if (!token || !account || !siteTag) return { status: 'not-configured' };
  const query = `query($a:String!,$s:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){
    total: rumPageloadEventsAdaptiveGroups(limit:1, filter:{date:$d, siteTag:$s}){ count sum{ visits } }
    pages: rumPageloadEventsAdaptiveGroups(limit:100, filter:{date:$d, siteTag:$s}, orderBy:[count_DESC]){ count sum{ visits } dimensions{ requestPath } }
    refs: rumPageloadEventsAdaptiveGroups(limit:10, filter:{date:$d, siteTag:$s}, orderBy:[count_DESC]){ count dimensions{ refererHost } } }}}`;
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { a: account, s: siteTag, d: date } }) });
  const j = await r.json(); if (j.errors?.length) throw new Error(`Cloudflare: ${JSON.stringify(j.errors).slice(0, 300)}`);
  const a = j.data.viewer.accounts[0];
  return { status: 'ok', pageviews: a.total[0]?.count ?? 0, visits: a.total[0]?.sum?.visits ?? 0,
    pages: a.pages.map((p) => ({ path: p.dimensions.requestPath, pageviews: p.count, visits: p.sum.visits })),
    referrers: a.refs.map((x) => ({ host: x.dimensions.refererHost || '(direct)', pageviews: x.count })) };
}

async function adsense(date) {
  const acct = process.env.ADSENSE_ACCOUNT; const token = await refreshToken(); if (!acct || !token) return { status: 'not-configured' };
  const [y, m, d] = date.split('-').map(Number);
  const q = new URLSearchParams({ dateRange: 'CUSTOM', 'startDate.year': y, 'startDate.month': m, 'startDate.day': d, 'endDate.year': y, 'endDate.month': m, 'endDate.day': d, currencyCode: 'JPY' });
  ['ESTIMATED_EARNINGS', 'PAGE_VIEWS', 'IMPRESSIONS', 'CLICKS', 'PAGE_VIEWS_RPM'].forEach((x) => q.append('metrics', x));
  q.append('dimensions', 'DOMAIN_NAME');
  const r = await fetch(`https://adsense.googleapis.com/v2/${acct}/reports:generate?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`AdSense ${r.status} ${await r.text()}`);
  const j = await r.json(); const heads = j.headers.map((h) => h.name);
  const row = (j.rows ?? []).map((r) => Object.fromEntries(r.cells.map((c, i) => [heads[i], c.value]))).find((r) => r.DOMAIN_NAME?.includes('ours-blanc.app')) ?? {};
  return { status: 'ok', earningsJPY: Number(row.ESTIMATED_EARNINGS ?? 0), pageviews: Number(row.PAGE_VIEWS ?? 0), impressions: Number(row.IMPRESSIONS ?? 0), clicks: Number(row.CLICKS ?? 0), rpm: Number(row.PAGE_VIEWS_RPM ?? 0) };
}

/** Affiliate programmes without a reporting API: drop CSV exports in data/manual/ (date,program,clicks,orders,revenue_jpy). */
function manualAffiliate(date) {
  if (!fs.existsSync(P.manual)) return { status: 'not-configured' };
  const rows = fs.readdirSync(P.manual).filter((f) => f.endsWith('.csv')).flatMap((f) => fs.readFileSync(path.join(P.manual, f), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')));
  const day = rows.filter((r) => r[0] === date); if (!rows.length) return { status: 'not-configured' };
  const by = {}; for (const [, program, clicks, orders, rev] of day) { by[program] ??= { clicks: 0, orders: 0, revenueJPY: 0 }; by[program].clicks += +clicks || 0; by[program].orders += +orders || 0; by[program].revenueJPY += +rev || 0; }
  return { status: day.length ? 'ok' : 'no-data-for-date', programs: by, revenueJPY: Object.values(by).reduce((a, b) => a + b.revenueJPY, 0) };
}

const safe = async (name, fn) => { try { return await fn(); } catch (e) { log(`  metrics ${name} error: ${e.message}`); return { status: 'error', error: e.message.slice(0, 300) }; } };

export async function collect(date = jstDate(-1)) {
  // GSC data lags ~2 days; we take "all" (fresh) data for yesterday and re-pull 3 days ago as finalised.
  log(`metrics for ${date}`);
  const m = DRY ? { gsc: { status: 'dry-run' }, cloudflare: { status: 'dry-run' }, adsense: { status: 'dry-run' }, affiliate: { status: 'dry-run' } } : {
    gsc: await safe('gsc', () => searchConsole(date)), cloudflare: await safe('cloudflare', () => cloudflare(date)),
    adsense: await safe('adsense', () => adsense(date)), affiliate: manualAffiliate(date) };
  const out = { date, ...m, revenueJPY: (m.adsense.earningsJPY ?? 0) + (m.affiliate.revenueJPY ?? 0) };
  writeJSON(path.join(P.reports, `${date}.metrics.json`), out);
  return out;
}

export function trend(days = 7, until = jstDate(-1)) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = jstDate(-i, new Date(until + 'T00:00:00+09:00')); const m = readJSON(path.join(P.reports, `${d}.metrics.json`), null);
    if (m) out.push({ date: d, pv: m.cloudflare?.pageviews ?? null, gscClicks: m.gsc?.clicks ?? null, gscImpr: m.gsc?.impressions ?? null, revenueJPY: m.revenueJPY ?? 0 });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(await collect(process.argv[2]), null, 2));
