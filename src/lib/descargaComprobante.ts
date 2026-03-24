/** Base del API (sin barra final). Configurable con PUBLIC_MALLKI_API_BASE. */
export function getMallkiApiBase(): string {
  const raw = import.meta.env.PUBLIC_MALLKI_API_BASE as string | undefined;
  return (raw?.replace(/\/$/, "") || "https://mallki-facturas.cloud").trim();
}

/**
 * URL del ZIP público: solo `codigo_seguridad` (8 caracteres alfanuméricos, único global).
 * GET /api/v1/documentos/publico/zip?codigo_seguridad=...
 */
export function buildPublicZipUrl(codigoSeguridad: string): string {
  const base = getMallkiApiBase();
  const url = new URL("/api/v1/documentos/publico/zip", `${base}/`);
  url.searchParams.set("codigo_seguridad", codigoSeguridad.trim().toUpperCase());
  return url.toString();
}

/** Código impreso en el comprobante: exactamente 8 caracteres alfanuméricos. */
const RE_CODIGO_SEGURIDAD_ZIP = /^[A-Za-z0-9]{8}$/;

/** Valida el código antes de llamar al API. */
export function validarCodigoSeguridadZip(codigo: string): string | null {
  const c = codigo.trim().toUpperCase();
  if (!c) {
    return "Ingrese el código de seguridad de 8 caracteres que figura en su comprobante.";
  }
  if (c.length !== 8) {
    return "El código de seguridad debe tener exactamente 8 caracteres (letras y números).";
  }
  if (!RE_CODIGO_SEGURIDAD_ZIP.test(c)) {
    return "El código solo puede incluir letras y números (ej. ABCD1234).";
  }
  return null;
}

function mensajePorStatus(status: number): string {
  switch (status) {
    case 400:
      return "Solicitud inválida. Revise el código de seguridad.";
    case 422:
      return "El código de seguridad debe tener exactamente 8 caracteres.";
    case 401:
      return "No autorizado.";
    case 403:
      return "Comprobante no encontrado o código de seguridad incorrecto.";
    case 404:
      return "Aún no hay archivos disponibles para este comprobante.";
    case 429:
      return "Se alcanzó el límite de descargas (máximo 3 por comprobante).";
    case 503:
      return "Servicio temporalmente no disponible. Intente más tarde.";
    default:
      return "No se pudo descargar el comprobante. Intente de nuevo.";
  }
}

async function mensajeErrorDesdeRespuesta(res: Response): Promise<string> {
  const fallback = mensajePorStatus(res.status);
  try {
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return fallback;
    const j = (await res.json()) as { detail?: unknown };
    const d = j?.detail;
    if (typeof d === "string") {
      const t = d.trim();
      if (t.length > 0 && t.length <= 400) return t;
    }
  } catch {
    /* usar fallback */
  }
  return fallback;
}

function nombreArchivoZipDesdeHeaders(
  contentDisposition: string | null,
  fallback: string
): string {
  if (!contentDisposition) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      return fallback;
    }
  }
  const simple = /filename="([^"]+)"/i.exec(contentDisposition);
  if (simple?.[1]) return simple[1];
  const plain = /filename=([^;\s]+)/i.exec(contentDisposition);
  if (plain?.[1]) return plain[1].replace(/^["']|["']$/g, "");
  return fallback;
}

/**
 * Evita rutas y caracteres raros en el nombre sugerido por el servidor (Content-Disposition).
 */
function sanitizeDownloadFilename(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const base = trimmed.split(/[/\\]/).pop() ?? "";
  if (!base || base.includes("..")) return fallback;
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
  return safe || fallback;
}

export type ResultadoDescarga =
  | { ok: true }
  | { ok: false; mensaje: string; mostrarAlternativaNuevaPestana?: boolean };

/**
 * Descarga el ZIP (PDF + XML + CDR) vía GET público (sin JWT).
 * Requiere CORS en el servidor para fetch desde el navegador.
 */
export async function descargarComprobanteZip(codigoSeguridad: string): Promise<ResultadoDescarga> {
  const err = validarCodigoSeguridadZip(codigoSeguridad);
  if (err) return { ok: false, mensaje: err };

  const codigo = codigoSeguridad.trim().toUpperCase();
  const url = buildPublicZipUrl(codigo);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", credentials: "omit" });
  } catch {
    return {
      ok: false,
      mensaje:
        "No se pudo conectar con el servidor. Puede ser un bloqueo de red o de seguridad del navegador (CORS).",
      mostrarAlternativaNuevaPestana: true,
    };
  }

  if (!res.ok) {
    const mensaje = await mensajeErrorDesdeRespuesta(res);
    return { ok: false, mensaje };
  }

  try {
    const blob = await res.blob();
    const disp = res.headers.get("Content-Disposition");
    const safeFallback = codigo.replace(/[^\w.-]/g, "_") + ".zip";
    const sugerido = nombreArchivoZipDesdeHeaders(disp, safeFallback);
    const nombre = sanitizeDownloadFilename(sugerido, safeFallback);

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nombre;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);

    return { ok: true };
  } catch {
    return {
      ok: false,
      mensaje: "No se pudo iniciar la descarga del archivo en este navegador.",
      mostrarAlternativaNuevaPestana: true,
    };
  }
}
