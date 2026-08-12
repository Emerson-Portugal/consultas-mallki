# MALLKI-FACTURAS — Consulta pública de comprobantes

Sitio estático (Astro) donde el cliente final descarga su comprobante electrónico
con el **código de descarga de 8 caracteres** que figura impreso en su ticket.
Descarga un ZIP con el PDF, el XML UBL firmado y (si ya está disponible) la
constancia de recepción de SUNAT (CDR).

- **Dominio:** https://consultas.mallki-facturas.cloud (deploy en Render, `render.yaml`)
- **API que consume:** `GET /api/v1/documentos/publico/zip` del backend Mallki
  (ver `src/lib/descargaComprobante.ts`). No requiere sesión.

## Comandos

```sh
npm ci            # instalar dependencias
npm run dev       # servidor local (http://localhost:4321)
npm run build     # build estático a dist/
npm run preview   # previsualizar el build
```

## Configuración

- `PUBLIC_SITE_URL` — dominio público para el sitemap y los canonicals.
  Ya viene fijado en `render.yaml`; el `astro.config.mjs` usa el mismo valor
  como fallback (nunca publica localhost).

## Estructura

```text
src/
├── pages/index.astro          formulario de descarga (la única página)
├── pages/404.astro            página de error en español
├── lib/descargaComprobante.ts validación del código + descarga del ZIP
├── layouts/Layout.astro       shell (head + header + footer)
└── components/                Container, Heading, Text, Link + globales
```

## Créditos

La base visual proviene del theme **Grunge** de Jess Gaspar (licencia MIT —
ver `LICENSE`, cuyo aviso de copyright se conserva conforme a la licencia).
El contenido del theme (portfolio de ejemplo) fue retirado; solo se reutilizan
el layout y los componentes de UI.
