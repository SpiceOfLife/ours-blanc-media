// Daily PDCA report (Markdown + JSON) — committed to reports/daily/ and summarised by the scheduled Claude task.
import path from 'node:path';
import { P, writeText, writeJSON, ledger, readJSON } from './lib/util.mjs';

const yen = (n) => '¥' + Math.round(n ?? 0).toLocaleString('ja-JP');
const st = (s) => ({ ok: '✅', 'not-configured': '⚪️ 未設定', error: '⚠️ エラー', 'dry-run': '🧪 dry-run', 'no-data-for-date': '— データなし' })[s] ?? s;

export function writeReport({ date, metrics, pdca, plan, results, durationSec }) {
  const site = readJSON(P.site);
  const published = results.filter((r) => r.published); const rejected = results.filter((r) => !r.published);
  const top = [...pdca.pages].sort((a, b) => b.pv - a.pv || b.impressions - a.impressions).slice(0, 5);
  const md = `# 日次レポート ${date}

## サマリー
| 指標 | 値 |
|---|---|
| 収益（推定） | ${yen(metrics.revenueJPY)} |
| PV (Cloudflare) | ${metrics.cloudflare?.pageviews ?? '—'} |
| 検索クリック / 表示 (GSC) | ${metrics.gsc?.clicks ?? '—'} / ${metrics.gsc?.impressions ?? '—'} |
| 平均掲載順位 | ${metrics.gsc?.position ? metrics.gsc.position.toFixed(1) : '—'} |
| AdSense 収益 / RPM | ${metrics.adsense?.status === 'ok' ? `${yen(metrics.adsense.earningsJPY)} / ${yen(metrics.adsense.rpm)}` : st(metrics.adsense?.status)} |
| アフィリエイト（手入力CSV） | ${metrics.affiliate?.status === 'ok' ? yen(metrics.affiliate.revenueJPY) : st(metrics.affiliate?.status)} |
| 公開 / 差し戻し | ${published.length} / ${rejected.length} |
| API費用（推定） | $${ledger.usd.toFixed(2)}（上限 $${site.pipeline.dailyBudgetUSD}） |

データソース: GSC ${st(metrics.gsc?.status)} · Cloudflare ${st(metrics.cloudflare?.status)} · AdSense ${st(metrics.adsense?.status)} · 手入力 ${st(metrics.affiliate?.status)}

## Check（昨日の評価）
${pdca.check.map((c) => `- ${c}`).join('\n') || '- データ蓄積中'}
${pdca.hypotheses.length ? `\n**仮説**\n${pdca.hypotheses.map((h) => `- ${h}`).join('\n')}` : ''}

## Act（自動で反映した改善）
${pdca.applied.map((a) => `- ${a}`).join('\n') || '- 変更なし'}
${pdca.refreshQueue.length ? `\n**リライト候補**\n${pdca.refreshQueue.map((r) => `- \`${r.slug}\` — ${r.reason}`).join('\n')}` : ''}

## Plan（本日の計画）
${plan.newTopics.map((t) => `- 新規: ${t.keyword}（${t.category} / ${t.intent}）`).join('\n')}
${plan.refresh.map((r) => `- 更新: \`${r.slug}\` — ${r.reason}`).join('\n')}

## Do（実行結果）
${results.map((r) => `- ${r.published ? '✅ 公開' : '⏸ 下書き保存'}: ${r.title ?? r.keyword} ${r.published ? `→ ${site.url}/posts/${r.slug}/` : ''}（QA ${r.qa?.score ?? '—'}点）${r.qa && !r.published ? `\n  - 理由: ${r.qa.issues.filter((i) => i.level === 'block').map((i) => i.msg).join(' / ')}` : ''}${r.error ? `\n  - エラー: ${r.error}` : ''}`).join('\n') || '- なし'}

## 記事別トップ5
| 記事 | PV | 表示 | クリック | 順位 |
|---|---|---|---|---|
${top.map((p) => `| ${p.title.slice(0, 28)} | ${p.pv} | ${p.impressions} | ${p.clicks} | ${p.position ? p.position.toFixed(1) : '—'} |`).join('\n') || '| — | | | | |'}

## 運営者のToDo
${pdca.manualTodo.map((t) => `- [ ] ${t}`).join('\n') || '- なし'}

_所要 ${durationSec}s · API ${ledger.calls}回 · 検索 ${ledger.searches}回_
`;
  writeText(path.join(P.reports, `${date}.md`), md);
  writeText(path.join(P.reports, 'latest.md'), md);
  writeJSON(path.join(P.reports, `${date}.json`), { date, metrics: { revenueJPY: metrics.revenueJPY, pv: metrics.cloudflare?.pageviews, gsc: metrics.gsc?.status === 'ok' ? { clicks: metrics.gsc.clicks, impressions: metrics.gsc.impressions, position: metrics.gsc.position } : metrics.gsc?.status },
    pdca: { check: pdca.check, applied: pdca.applied, refreshQueue: pdca.refreshQueue, manualTodo: pdca.manualTodo },
    results: results.map(({ slug, title, keyword, published, qa, error }) => ({ slug, title, keyword, published, score: qa?.score, issues: qa?.issues, error })), costUSD: +ledger.usd.toFixed(3) });
  return md;
}
