import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './config/site.json' with { type: 'json' };

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (p) => !p.includes('/search/') })],
  build: { format: 'directory' },
});
