// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// PUBLIC_SITE_URL (Render → Environment) permite sobreescribir el dominio.
// El fallback es el dominio público REAL: si la variable falta, el sitemap y los
// canonicals NUNCA deben publicar localhost (bug §146.6 — sitemap indexable con
// URLs http://localhost:4321).
const site =
  process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://consultas.mallki-facturas.cloud";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
  site,
});