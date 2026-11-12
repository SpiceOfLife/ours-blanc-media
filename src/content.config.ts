import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const product = z.object({
  name: z.string(),
  brand: z.string().optional(),
  summary: z.string().optional(),
  priceJPY: z.number().optional(),
  priceCheckedAt: z.string().optional(),
  editorScore: z.number().min(0).max(5).optional(),
  reviewAverage: z.number().optional(),
  reviewCount: z.number().optional(),
  reviewSource: z.string().optional(),
  imageUrl: z.string().optional(),
  rakutenUrl: z.string().optional(),
  amazonUrl: z.string().optional(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  specs: z.record(z.string(), z.string()).default({}),
  bestFor: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    intent: z.enum(['comparison', 'howto', 'buying-guide', 'single-review']),
    keyword: z.string().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    eyecatch: z.string(),
    eyecatchAlt: z.string().optional(),
    products: z.array(product).default([]),
    chart: z.object({ title: z.string(), unit: z.string(), note: z.string().optional(),
      items: z.array(z.object({ label: z.string(), value: z.number() })) }).optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
    pr: z.boolean().default(true),
    aiAssisted: z.boolean().default(true),
    usesRakutenApi: z.boolean().default(false),
    qaScore: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
