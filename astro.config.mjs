import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
import sitemap from '@astrojs/sitemap';
import compress from "astro-compress";
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

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
                const pathname = new URL(item.url).pathname;
                if (pathname === '/') {
                    item.priority = 1.0;
                    item.changefreq = 'weekly';
                } else if (pathname.startsWith('/guides/')) {
                    item.priority = 0.9;
                    item.changefreq = 'monthly';
                } else if (pathname === '/guides' || pathname === '/about') {
                    item.priority = 0.7;
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