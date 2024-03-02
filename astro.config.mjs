import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";

/**
 * Astro Config file for Cloudflare
 * See https://docs.astro.build/en/guides/integrations-guide/cloudflare/
 */

// https://astro.build/config
export default defineConfig({
    output: "server",
    adapter: cloudflare({
        mode: "directory",
        routes: {
            strategy: "include",
            include: [
                "/api/*"
            ]
        },
        // runtime: {
        //     mode: "local",
        //     type: "pages",
        //     bindings: {
        //         // Bindings for environment variables, KV, D1, R2, Durable Objects, etc.
        //     }
        // },
        // Use cloudflare image service for image optimization
        // https://developers.cloudflare.com/images/manage-images/create-variants/
        // imageService: 'cloudflare',
    })
});