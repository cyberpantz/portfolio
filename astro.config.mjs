// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  site: 'https://frankyoung.dev',
  vite: {
    // Tailwind v4 runs as a Vite plugin rather than an Astro integration.
    // @astrojs/tailwind is retired and never declared support past Astro 5.
    plugins: [tailwindcss()],
    assetsInclude: ['**/*.glsl'],
  },
});
