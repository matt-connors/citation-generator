# MLA Browser Renderer

This Worker owns the Cloudflare Browser Run binding. The Pages app calls it
through a Pages Service binding named `BROWSER_RENDERER`.

Deploy:

```bash
npx wrangler deploy --config workers/browser-renderer/wrangler.toml
```

Cloudflare setup:

- Worker `mla-browser-renderer`: Browser Run binding `BROWSER`.
- Pages project: Service binding `BROWSER_RENDERER` pointing at
  `mla-browser-renderer`.
- Optional hardening: set the same secret value as `RENDERER_SHARED_SECRET` on
  this Worker and `BROWSER_RENDERER_TOKEN` on the Pages project.

If workers.dev is disabled and there is no public route, the service binding is
already private. The shared secret is still useful as a defense-in-depth guard.
