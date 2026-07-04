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
        // Configures the embedded citation generator (TryGenerator) for this
        // guide: which input tab it opens on, contextual copy, and the style
        // preselected in the dropdown. `inline: true` means the guide places
        // <TryGenerator> itself in its MDX body (usually right after the
        // examples table), so the layout must not render a second copy.
        cite: z
            .object({
                tab: z.enum(['website', 'book', 'journal']).default('website'),
                placeholder: z.string().optional(),
                style: z.string().optional(),
                heading: z.string().optional(),
                blurb: z.string().optional(),
                inline: z.boolean().default(false),
            })
            .optional(),
        ogImage: z.string().optional(),
    })
});

export const collections = {
    guides,
};
