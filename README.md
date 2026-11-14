# ours blanc Gear

AI-assisted DTM & music-gear affiliate media — **https://gear.ours-blanc.app**

Research → outline → writing → eyecatch → quality gate → publish → daily metrics & PDCA, fully automated on GitHub Actions; the site is a static Astro build on Cloudflare Pages styled with [ours-blanc-design](https://github.com/SpiceOfLife/ours-blanc-design) (Apple HIG).

- Design: [`docs/DESIGN.md`](docs/DESIGN.md)
- Setup (accounts, secrets): [`docs/SETUP.md`](docs/SETUP.md)
- Daily reports, drafts, revenue CSVs and PDCA history live in the **private** repo `SpiceOfLife/ours-blanc-media-data` (checked out at `.data/`), so this repo can stay public.

```bash
npm ci
npm run pipeline:dry   # whole pipeline with mock data (no API calls, nothing committed)
npm test               # QA rules, wrapping, parsing
npm run dev            # site at http://localhost:4321 (drafts visible)
```

Daily job: `.github/workflows/daily.yml` (05:17 JST). Manual run: Actions → *Daily PDCA* → Run workflow.

Tuning: `config/site.json` (limits, budget, pass score) · `config/strategy.json` (auto-updated weights) · `config/topics.json` (queue) · `config/experience.json` (gear you own — the only source of first-hand claims).
