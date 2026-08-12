# CLAUDE.md — factutas-consulta (Descarga pública de comprobantes)

> Memoria del **sitio público donde el cliente final descarga su comprobante**
> (Astro estático). Lee esto al iniciar cualquier conversación sobre este repo.
> La memoria central global del SaaS está en `../CLAUDE.md` (raíz `Facturacion/`).

**Última actualización:** 2026-08-11 — PODA del theme (D1/D2 resueltos: fuera about/contact/works + secciones + assets de stock), fallback del sitemap al dominio real (D3), 404 en español (D5), README propio con atribución MIT conservada (D6). (La documentación inicial se creó ese mismo día.)

> ⚠️ El nombre de la carpeta y del paquete tienen un **typo**: `factutas` (no `facturas`).
> Está así en el `package.json` (`"name": "factutas-consulta"`) y en `render.yaml`
> (`name: factutas-consulta`). Documentado, **no renombrado** (renombrar el servicio
> de Render cambia la URL pública).

---

## 1. PROPÓSITO

El comprobante impreso (PDF/ticket) lleva un **código de descarga de 8 caracteres**
(`ventas.codigo_seguridad`, §28 del raíz). El cliente entra a este sitio, escribe
ese código y baja un **ZIP con PDF + XML + CDR**.

Es el sitio que el raíz llama `consultas.mallki-facturas.cloud` (§24: ese origen
debe estar en `ALLOWED_ORIGINS` del backend o el `fetch` muere por CORS).

- **Remote:** `https://github.com/Emerson-Portugal/consultas-mallki.git`
- **Deploy:** Render, static site (`render.yaml`).

### El repo es un theme comercial adaptado

Base: theme **"Grunge"** de *jessgaspardev* (portfolio de diseñador). Se reescribió
**solo `src/pages/index.astro`** y se agregó `src/lib/descargaComprobante.ts`.
El theme original fue PODADO el 2026-08-11: quedan solo el layout, los 4 componentes
de UI (Container/Heading/Text/Link), los globales (BaseHead/Nav/Footer/Wrapper) y el
`LICENSE` MIT (atribución obligatoria, se conserva a propósito) → ver §5.
principal de este repo.

---

## 2. STACK

- **Astro 6.0.2** (ojo: el otro sitio, `facturas-web`, usa Astro 5) + **Tailwind 4** vía `@tailwindcss/vite`.
- `@astrojs/sitemap` (genera `sitemap-index.xml` y `sitemap-0.xml`).
- Fuentes autohospedadas: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@fontsource/road-rage`.
- `engines.node >= 22.12.0`.
- Sin framework de UI, sin islas; la lógica del formulario es un `<script>` de módulo en `index.astro`.

---

## 3. LO QUE IMPORTA — el código propio

### `src/lib/descargaComprobante.ts` (163 líneas, TypeScript, bien hecho)

Único punto de contacto con el backend. **No reescribir sin motivo concreto.**

| Qué | Dónde | Detalle |
|---|---|---|
| Base del API | `:2-5` | `PUBLIC_MALLKI_API_BASE` con **fallback hardcodeado** `https://mallki-facturas.cloud` |
| Endpoint | `:11-16` | `GET /api/v1/documentos/publico/zip?codigo_seguridad=...` (público, **sin JWT**) |
| Validación previa | `:19-34` | `^[A-Za-z0-9]{8}$`, normaliza a mayúsculas, mensajes en español |
| Mapa de errores | `:36-55` | 400/422 formato · 401 · 403 código incorrecto · 404 archivos aún no disponibles · **429 "límite de descargas (máximo 3 por comprobante)"** · 503 |
| Detalle del backend | `:57-72` | Si la respuesta trae `detail` string (≤400 chars) lo muestra tal cual; si no, usa el fallback por status |
| Nombre de archivo | `:74-104` | Lee `Content-Disposition` (soporta `filename*=UTF-8''`) y **lo sanea contra path traversal** (`split(/[/\\]/).pop()`, rechaza `..`, whitelist `[a-zA-Z0-9._-]`, corta a 200) |
| Fallback CORS | `:121-130, 155-161` | Si el `fetch` explota, devuelve `mostrarAlternativaNuevaPestana: true` y la UI ofrece abrir la URL en otra pestaña |

### `src/pages/index.astro`

Formulario: input de 8 caracteres (`maxlength=8`, `autocapitalize=characters`,
normaliza a mayúsculas en vivo), botón "Descargar ZIP", `<p role="alert">` para el
error y un bloque `aria-live` con el fallback de nueva pestaña. Importa las 3
funciones de `../lib/descargaComprobante` (`:73`).

---

## 4. DESARROLLO Y DESPLIEGUE

```bash
cd factutas-consulta
npm install
npm run dev      # http://localhost:4321
npm run build
npm run preview
```

**Variables de entorno (ambas son `PUBLIC_*` → se inlinean en el bundle):**

| Var | Dónde se usa | Estado |
|---|---|---|
| `PUBLIC_SITE_URL` | `astro.config.mjs` → `site` (canonical + sitemap) | Fijada en `render.yaml` con `value: https://consultas.mallki-facturas.cloud`; el `astro.config.mjs` usa ese MISMO dominio como fallback → aunque la variable falte, **nunca** se publica localhost (fix 2026-08-11). |
| `PUBLIC_MALLKI_API_BASE` | `descargaComprobante.ts:3` | **NO está en `render.yaml`** → hoy depende del fallback hardcodeado a producción. |

**Render** (`render.yaml`): `type: web`, `runtime: static`,
`buildCommand: npm ci && npm run build`, `staticPublishPath: dist`.

---

## 5. DEUDA CONOCIDA / PROBLEMAS

**Todo lo de acá es público si se despliega tal cual.**

| # | Problema | Sev | Detalle |
|---|---|:---:|---|
| D1 | ~~Páginas del theme con datos ficticios~~ | ✅ | **RESUELTO 2026-08-11**: borrados `about.astro`, `contact.astro`, `works/`, `src/content/` (6 casos + imágenes), `src/components/sections/` completo, los elements exclusivos del theme (Work, ImageContainer, ContainerBottom, Dropdown, ResumeDropdown), `markdown.css`, `content.config.ts`, `peter.jpg/peter2.jpg`, `assets/work-card/` y `assets/ui/`. El build genera SOLO `/` y `/404`. |
| D2 | ~~Sitemap con páginas fake indexables~~ | ✅ | **RESUELTO 2026-08-11** (consecuencia de D1): `sitemap-0.xml` contiene **una sola URL** (`https://consultas.mallki-facturas.cloud/`). Verificado en el build. |
| D3 | ~~Sitemap con `localhost` si falta la env~~ | ✅ | **RESUELTO 2026-08-11**: el fallback de `astro.config.mjs` pasó de `http://localhost:4321` al dominio real `https://consultas.mallki-facturas.cloud`, y `render.yaml` ahora fija `PUBLIC_SITE_URL` con `value:` (ya no `sync: false` manual). localhost es imposible de publicar. |
| D4 | `PUBLIC_MALLKI_API_BASE` no declarada en `render.yaml` | 🟡 | Funciona por el fallback, pero apuntar a un backend de pruebas obliga a editar código en vez de una env var. |
| D5 | ~~404 en inglés~~ | ✅ | RESUELTO 2026-08-11: 404 en español, con CTA "Ir a la página de descarga". |
| D6 | ~~README/LICENSE del theme~~ | ✅ | RESUELTO 2026-08-11: README propio del proyecto. **El `LICENSE` MIT (Jess Gaspar) SE CONSERVA A PROPÓSITO**: MIT exige mantener el aviso de copyright en las copias del software; borrarlo sería el problema legal, no la solución. El README lo referencia en "Créditos". |
| D7 | ~~Artefacto huérfano dist/guia~~ | ✅ | RESUELTO 2026-08-11: el svg era basura de build viejo, pero la carpeta reaparecía en builds frescos porque existía un directorio VACÍO public/guia/ (invisible a find -type f) que Astro copiaba tal cual. Eliminado; el build fresco ya no genera dist/guia (verificado). |
| D8 | Typo `factutas` en carpeta, `package.json` y `render.yaml` | 🟢 | Ver aviso del encabezado. |

**Lo que SÍ está bien (no tocar salvo pedido):** el formulario, la validación,
el mapa de errores en español, el saneado del `filename` y el fallback de CORS.

---

## 6. RELACIÓN CON EL RESTO DEL SISTEMA

- **SÍ consume la API del backend**, un solo endpoint público y sin JWT:
  `GET /api/v1/documentos/publico/zip?codigo_seguridad=...`
- Ese endpoint vive en **`../facturas-backends/app/api/v1/endpoints/documentos/`**
  (§18 del raíz: descarga pública por token; el `codigo_seguridad` es el token).
- El **origen de este sitio debe estar en `ALLOWED_ORIGINS`** del backend
  (§24 del raíz lo lista como `https://consultas.mallki-facturas.cloud`).
  Sin eso, el `fetch` falla por CORS y el usuario solo ve el fallback de "abrir en
  otra pestaña".
- El **límite de 3 descargas por comprobante (429)** lo aplica el backend, no este sitio.
- No comparte código con los frontends Angular ni con `../facturas-web/` (landing).

---

## 7. ANTI-FALSOS-POSITIVOS

- ❌ **"Esto es un portfolio/template abandonado, no es del SaaS"** → **FALSO.**
  `src/pages/index.astro` + `src/lib/descargaComprobante.ts` son **código propio y funcional**
  del SaaS: es la pantalla donde el cliente final baja su comprobante. Lo del theme
  es el resto de páginas (D1), que sobra, no lo principal.
- ❌ **"Hay que reescribir la lógica de descarga"** → **FALSO.** Está bien hecha:
  valida antes de llamar, mapea cada status a español, respeta el `detail` del backend,
  sanea el nombre de archivo contra path traversal y degrada ante CORS. Tocarla sin
  un bug concreto es riesgo gratis.
- ❌ **"El código de descarga es el número del comprobante"** → **FALSO.** Es
  `ventas.codigo_seguridad` (8 caracteres, **único global**), impreso como
  *"Código de descarga"* en el PDF/ticket (§17 y §28 del raíz).
- ❌ **"El sitio necesita login o JWT"** → **FALSO.** El endpoint es público a propósito
  (`credentials: "omit"`, `descargaComprobante.ts:122`): el cliente final no tiene cuenta.
- ❌ **"El límite de 3 descargas hay que implementarlo acá"** → **FALSO.** Lo aplica el
  backend; este sitio solo traduce el `429` a un mensaje entendible.
- ❌ **"Las páginas `about`/`contact`/`works` siguen ahí / hay que borrarlas"** →
  **YA NO EXISTEN** (borradas 2026-08-11, D1/D2). Si un audit las "encuentra", está
  mirando un `dist/` viejo o el historial de git.
- ❌ **"Hay que borrar el `LICENSE` porque es del theme"** → **NO. PROHIBIDO** (D6): es
  MIT y exige conservar el aviso de copyright. Borrarlo crearía el problema legal que
  se quiso evitar. La atribución vive en `LICENSE` + "Créditos" del README.
- ❌ **"`localhost:4321` puede aparecer en el sitemap"** → **YA NO** (D3, 2026-08-11): el
  fallback del config ES el dominio real y `render.yaml` fija la variable. Para publicar
  localhost habría que escribirlo a mano.
