/** Base del API (sin barra final). Configurable con PUBLIC_MALLKI_API_BASE. */
export function getMallkiApiBase(): string {
  const raw = import.meta.env.PUBLIC_MALLKI_API_BASE as string | undefined;
  return (raw?.replace(/\/$/, "") || "https://mallki-facturas.cloud").trim();
}

export function buildPublicZipUrl(numero: string, codigoSeguridad: string): string {
  const base = getMallkiApiBase();
  const url = new URL("/api/v1/documentos/publico/zip", `${base}/`);
  url.searchParams.set("numero", numero.trim());
  url.searchParams.set("codigo_seguridad", codigoSeguridad.trim().toUpperCase());
  return url.toString();
}

/**
 * Une serie + correlativo al formato del API: `F001-5`, `FMK1-1002`, `F001-00000005`.
 * No rellena con ceros: el backend acepta formato corto o completo.
 */
export function componerNumeroSunat(serie: string, correlativo: string): string {
  const s = serie.trim().replace(/\s+/g, "");
  const c = correlativo.trim().replace(/\s+/g, "");
  if (!s || !c) return "";
  return `${s}-${c}`;
}

/** Valida antes de llamar al API (límites del contrato). */
export function validarParametrosZip(numero: string, codigo: string): string | null {
  const n = numero.trim();
  const c = codigo.trim().toUpperCase();
  if (n.length < 4 || n.length > 20) {
    return "El número SUNAT debe tener entre 4 y 20 caracteres (serie + correlativo, ej. F001-5).";
  }
  if (c.length !== 3) {
    return "El código de seguridad debe tener exactamente 3 caracteres.";
  }
  return null;
}

/** Valida serie y correlativo por separado y el código; devuelve mensaje o null si OK. */
export function validarSerieCorrelativoCodigo(
  serie: string,
  correlativo: string,
  codigo: string
): string | null {
  if (!serie.trim()) {
    return "Ingrese la serie del comprobante (ej. F001 o FMK1).";
  }
  if (!correlativo.trim()) {
    return "Ingrese el correlativo (ej. 5, 001 o 1002).";
  }
  const numero = componerNumeroSunat(serie, correlativo);
  return validarParametrosZip(numero, codigo);
}

function mensajePorStatus(status: number): string {
  switch (status) {
    case 400:
      return "Formato de número inválido.";
    case 401:
      return "No autorizado.";
    case 403:
      return "Código de seguridad incorrecto o comprobante anulado.";
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

export type ResultadoDescarga =
  | { ok: true }
  | { ok: false; mensaje: string; mostrarAlternativaNuevaPestana?: boolean };

/**
 * Descarga el ZIP (PDF + XML + CDR) vía GET público (sin JWT).
 * Requiere CORS en el servidor para fetch desde el navegador.
 */
export async function descargarComprobanteZip(
  numero: string,
  codigoSeguridad: string
): Promise<ResultadoDescarga> {
  const err = validarParametrosZip(numero, codigoSeguridad);
  if (err) return { ok: false, mensaje: err };

  const url = buildPublicZipUrl(numero, codigoSeguridad);
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
    return { ok: false, mensaje: mensajePorStatus(res.status) };
  }

  try {
    const blob = await res.blob();
    const disp = res.headers.get("Content-Disposition");
    const safeNum = numero.trim().replace(/[^\w.-]/g, "_");
    const nombre = nombreArchivoZipDesdeHeaders(disp, `${safeNum}.zip`);

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
