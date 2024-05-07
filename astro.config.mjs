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
        sitemap(),
        // React integration
        react(),
        // MDX integration
        mdx(),
    ]
});