import { z, defineCollection } from "astro:content";

const guides = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        pubDate: z.date(),
        updatedDate: z.date().optional(),
        description: z.string(),
        author: z.string().default('MLA Generator Editorial Team'),
        category: z.enum(['style-guide', 'how-to', 'concept', 'comparison', 'meta']),
        tags: z.array(z.string()).default([]),
        keywords: z.array(z.string()).optional(),
        relatedGuides: z.array(z.string()).optional(),
        faq: z
            .array(z.object({ question: z.string(), answer: z.string() }))
            .optional(),
        ogImage: z.string().optional(),
    })
});

export const collections = {
    guides,
};
