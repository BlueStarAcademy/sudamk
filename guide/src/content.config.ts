import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 가이드 아티클 — src/content/articles/<category>/<slug>.md */
const articles = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
    schema: z.object({
        title: z.string(),
        description: z.string().max(160),
        category: z.enum(['basics', 'modes', 'techniques', 'life-and-death', 'academy', 'monsters']),
        order: z.number(),
        updated: z.string().optional(),
    }),
});

export const collections = { articles };
