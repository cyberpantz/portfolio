// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    /*
     * The sitemap includes every built page by default, which is exactly
     * why the filter matters here:
     *
     *  /v1     the previous portfolio. Nothing links to it, so today it is
     *          an orphan crawlers are unlikely to find — but publishing it
     *          in a sitemap is an explicit invitation to index a second
     *          page carrying the same name, bio and projects as `/`. That
     *          is duplicate content competing with the real homepage for
     *          searches on his own name. It is also noindex'd at the
     *          layout, so this is belt and braces.
     *  /thanks a form receipt. No search value, and landing on it from a
     *          results page is a dead end.
     */
    sitemap({
      filter: (page) => !/\/(v1|thanks)\/?$/.test(page),
      changefreq: 'monthly',
      lastmod: new Date(),
    }),
  ],
  site: 'https://frankyoung.dev',
  vite: {
    // Tailwind v4 runs as a Vite plugin rather than an Astro integration.
    // @astrojs/tailwind is retired and never declared support past Astro 5.
    plugins: [tailwindcss()],
    assetsInclude: ['**/*.glsl'],
  },
});
