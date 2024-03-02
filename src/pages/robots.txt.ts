import type { APIRoute } from 'astro';

// @ts-ignore
const sitemapURL = new URL('sitemap-index.xml', import.meta.env.SITE).href;

const robotsTxt = `
User-agent: *
Allow: /
Sitemap: ${sitemapURL}
`.trim();

export const GET: APIRoute = () => {
    return new Response(robotsTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
};