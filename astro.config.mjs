import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
import sitemap from '@astrojs/sitemap';
import compress from "astro-compress";
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Build a map of /guides/<slug> -> last-significant-change date, read straight
// from each guide's frontmatter (updatedDate, else pubDate). This feeds honest
// per-guide <lastmod> values into the sitemap. Pages without a real change date
// (the generator, legal pages) intentionally get no lastmod rather than a faked
// build-time one.
const GUIDE_LASTMOD = (() => {
    const map = {};
    try {
        const dir = join(dirname(fileURLToPath(import.meta.url)), 'src/content/guides');
        for (const file of readdirSync(dir)) {
            if (!file.endsWith('.mdx')) continue;
            const src = readFileSync(join(dir, file), 'utf8');
            const updated = src.match(/^updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
            const published = src.match(/^pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
            const date = updated || published;
            if (date) map[`/guides/${file.replace(/\.mdx$/, '')}`] = new Date(`${date}T00:00:00.000Z`).toISOString();
        }
    } catch (err) {
        // Fall back to no lastmod rather than failing the build, but make the
        // degradation visible so a future read failure isn't silent.
        console.warn('[sitemap] could not read guide frontmatter for <lastmod>; sitemap will omit lastmod values.', err);
    }
    return map;
})();

/**
 * Astro Config file for Cloudflare
 * See https://docs.astro.build/en/guides/integrations-guide/cloudflare/
 */

/**
 * Consider implemeting i18n generation
 * https://github.com/yassinedoghri/astro-i18next#readme
 * https://docs.astro.build/en/guides/integrations-guide/sitemap/
 */

// https://astro.build/config
export default defineConfig({
    site: "https://mlagenerator.com",
    // site: "http://localhost:4321",
    output: "server",
    adapter: cloudflare({
        mode: "directory",
        routes: {
            strategy: "exclude",
            include: ["/api/*", "/guides/*"],
        },
        runtime: {
            mode: "local",
            type: "pages",
            bindings: {
                // Bindings for environment variables, KV, D1, R2, Durable Objects, etc.
            }
        },
        // Use cloudflare image service for image optimization
        // https://developers.cloudflare.com/images/manage-images/create-variants/
        // ** can't be enabled without a domain -- wont work on pages.dev endpoint provided by cloudflare **
        // imageService: 'cloudflare',
    }),
    integrations: [
        // Compresses images and minifies HTML, CSS, and JS
        compress(),
        // Generates a sitemap file
        sitemap({
            serialize(item) {
                const pathname = new URL(item.url).pathname.replace(/\/$/, '') || '/';
                if (pathname.startsWith('/admin')) return undefined;
                // Honest per-guide last-modified date from frontmatter, where we have one.
                if (GUIDE_LASTMOD[pathname]) item.lastmod = GUIDE_LASTMOD[pathname];
                // Tier priority to match the link-graph emphasis: the generator,
                // the guides hub, and the seven cornerstone style guides outrank
                // the long-tail how-to/concept guides (was a flat 0.9 for all guides
                // with the hub below its own children).
                const STYLE_GUIDES = ['apa', 'mla', 'chicago', 'harvard', 'vancouver', 'ieee', 'ama']
                    .map((s) => `/guides/${s}`);
                if (pathname === '/') {
                    item.priority = 1.0;
                    item.changefreq = 'weekly';
                } else if (pathname === '/guides') {
                    item.priority = 0.9;
                    item.changefreq = 'weekly';
                } else if (STYLE_GUIDES.includes(pathname)) {
                    item.priority = 0.9;
                    item.changefreq = 'monthly';
                } else if (pathname.startsWith('/guides/')) {
                    item.priority = 0.8;
                    item.changefreq = 'monthly';
                } else if (pathname === '/about') {
                    item.priority = 0.6;
                    item.changefreq = 'monthly';
                } else {
                    item.priority = 0.5;
                    item.changefreq = 'monthly';
                }
                return item;
            },
        }),
        // React integration
        react(),
        // MDX integration
        mdx(),
    ]
});