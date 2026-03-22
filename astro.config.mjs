// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// En Render (y CI): define PUBLIC_SITE_URL = https://tu-servicio.onrender.com (sin barra final)
const site =
  process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:4321";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
  site,
});