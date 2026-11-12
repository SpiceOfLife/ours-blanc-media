import Anthropic from '@anthropic-ai/sdk';
import { DRY, ledger, log } from './util.mjs';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
export const REVIEW_MODEL = process.env.CLAUDE_REVIEW_MODEL || MODEL;
let client;
const get = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
export const live = () => !DRY && !!process.env.ANTHROPIC_API_KEY;

/**
 * Ask Claude. Returns { text, json, citations }.
 * - webSearch: number of searches allowed (server-side web search tool)
 * - json: true → extracts the last ```json block (or bare JSON) from the answer
 * - mock: value returned in DRY_RUN / no-key mode so the pipeline can be tested end-to-end
 */
export async function ask({ system, prompt, webSearch = 0, json = false, maxTokens = 8000, model = MODEL, mock }) {
  if (!live()) { log(`  (mock) ${model}`); return { text: typeof mock === 'string' ? mock : JSON.stringify(mock), json: json ? mock : undefined, citations: [] }; }
  const tools = webSearch ? [{ type: process.env.WEB_SEARCH_TOOL || 'web_search_20250305', name: 'web_search', max_uses: webSearch }] : undefined;
  const messages = [{ role: 'user', content: prompt }];
  let content = [];
  for (let turn = 0; turn < 4; turn++) {
    const res = await get().messages.create({ model, max_tokens: maxTokens, system, messages, ...(tools ? { tools } : {}) });
    ledger.add(res.usage, model);
    content = content.concat(res.content);
    if (res.stop_reason !== 'pause_turn') break; // long web-search turns may pause; continue them
    messages.push({ role: 'assistant', content: res.content });
  }
  const textBlocks = content.filter((b) => b.type === 'text');
  const text = textBlocks.map((b) => b.text).join('');
  const citations = textBlocks.flatMap((b) => (b.citations ?? []).filter((c) => c.url).map((c) => ({ title: c.title ?? c.url, url: c.url })));
  return { text, json: json ? extractJSON(text) : undefined, citations };
}

export function extractJSON(text) {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = blocks.length ? blocks.reverse() : [text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const c of candidates) { try { return JSON.parse(c); } catch {} }
  throw new Error('Claude response did not contain valid JSON');
}
