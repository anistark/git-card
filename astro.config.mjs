// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// Fully static: every page is prerendered and profiles load in the browser from public APIs.
// The GitHub Pages workflow passes SITE_URL and BASE_PATH from actions/configure-pages, so the same build
// works for a project site (user.github.io/git-card/), a user site, or a custom domain.
export default defineConfig({
  site: process.env.SITE_URL || 'https://anistark.github.io',
  // An empty BASE_PATH (custom domain or user site) means the root, so only fall back when it is unset.
  base: (process.env.BASE_PATH ?? '/git-card') || '/',
  trailingSlash: 'ignore',
  // The preview pane assigns a free port through PORT. Plain `astro dev` keeps the default.
  server: { port: Number(process.env.PORT) || 4321 },
  integrations: [react()],
  vite: {
    // The largest chunk is three.js, which only loads when a skyline scrolls into view.
    build: { chunkSizeWarningLimit: 700 },
  },
});
