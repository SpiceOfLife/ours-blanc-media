import { getPosts, category } from '../lib/site';
export async function GET() {
  const posts = await getPosts();
  const idx = posts.map((p) => ({ u: `/posts/${p.id}/`, t: p.data.title, d: p.data.description, k: p.data.keyword ?? '', c: p.data.category,
    cn: category(p.data.category).name, p: p.data.products.map((x) => `${x.brand ?? ''} ${x.name}`).join(' ') }));
  return new Response(JSON.stringify(idx), { headers: { 'Content-Type': 'application/json' } });
}
