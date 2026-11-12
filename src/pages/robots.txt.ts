import site from '../../config/site.json';
export const GET = () => new Response(`User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: ${site.url}/sitemap-index.xml\n`);
