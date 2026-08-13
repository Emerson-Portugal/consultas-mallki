/**
 * Consulta pública del comprobante — el destino del QR impreso.
 *
 * El cliente escanea el QR del PDF o del ticket térmico y llega a `/?c=CODIGO`.
 * Este módulo habla con los dos endpoints públicos del backend (§152):
 *   GET /api/v1/documentos/publico/comprobante?codigo_seguridad=...
 *   GET /api/v1/documentos/publico/archivo?codigo_seguridad=...&tipo=pdf|xml|cdr
 *
 * Ninguno de los dos consume el contador de 3 descargas del ZIP: son de lectura.
 */
import { getMallkiApiBase } from "./descargaComprobante";

export type TipoArchivo = "pdf" | "xml" | "cdr";

export type ComprobantePublico = {
  codigo_seguridad: string;
  tipo: string;
  tipo_nombre: string;
  serie: string | null;
  correlativo: number | null;
  numero: string | null;
  fecha_emision: string | null;
  moneda: string;
  total: number;
  estado: string | null;
  sunat_estado: string | null;
  estado_texto: string;
  anulado: boolean;
  emisor: {
    ruc: string | null;
    razon_social: string | null;
    nombre_comercial: string | null;
  };
  cliente: { nombre: string; documento: string | null };
  archivos: { pdf: boolean; xml: boolean; cdr: boolean };
};

/** Código impreso en el comprobante: exactamente 8 caracteres alfanuméricos. */
const RE_CODIGO = /^[A-Za-z0-9]{8}$/;

/**
 * Lee el código del query string. Acepta `?c=` (el que va en el QR, corto para
 * que el código de barras no se densifique) y `?codigo=` por si alguien comparte
 * el enlace escrito a mano.
 */
export function leerCodigoDeUrl(search: string = window.location.search): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("c") ?? params.get("codigo") ?? "";
  const codigo = raw.trim().toUpperCase();
  return RE_CODIGO.test(codigo) ? codigo : null;
}

export function buildComprobanteUrl(codigo: string): string {
  const url = new URL("/api/v1/documentos/publico/comprobante", `${getMallkiApiBase()}/`);
  url.searchParams.set("codigo_seguridad", codigo.trim().toUpperCase());
  return url.toString();
}

export function buildArchivoUrl(codigo: string, tipo: TipoArchivo, descargar = false): string {
  const url = new URL("/api/v1/documentos/publico/archivo", `${getMallkiApiBase()}/`);
  url.searchParams.set("codigo_seguridad", codigo.trim().toUpperCase());
  url.searchParams.set("tipo", tipo);
  if (descargar) url.searchParams.set("download", "1");
  return url.toString();
}

function mensajePorStatus(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "El código del comprobante no tiene un formato válido.";
    case 403:
      return "No encontramos este comprobante. Verifique el código o vuelva a escanear el QR.";
    case 404:
      return "El archivo de este comprobante todavía no está disponible.";
    case 429:
      return "Demasiadas consultas seguidas. Espere un momento e intente de nuevo.";
    case 503:
      return "El servicio no está disponible en este momento. Intente más tarde.";
    default:
      return "No se pudo consultar el comprobante. Intente de nuevo.";
  }
}

async function mensajeDeRespuesta(res: Response): Promise<string> {
  const fallback = mensajePorStatus(res.status);
  try {
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return fallback;
    const j = (await res.json()) as { detail?: unknown };
    const d = j?.detail;
    if (typeof d === "string" && d.trim() && d.trim().length <= 400) return d.trim();
  } catch {
    /* usar fallback */
  }
  return fallback;
}

export type ResultadoConsulta =
  | { ok: true; datos: ComprobantePublico }
  | { ok: false; mensaje: string };

/** Trae los datos del comprobante (emisor, cliente, montos, estado, archivos). */
export async function consultarComprobante(codigo: string): Promise<ResultadoConsulta> {
  let res: Response;
  try {
    res = await fetch(buildComprobanteUrl(codigo), { method: "GET", credentials: "omit" });
  } catch {
    return {
      ok: false,
      mensaje: "No se pudo conectar con el servidor. Revise su conexión a internet.",
    };
  }
  if (!res.ok) return { ok: false, mensaje: await mensajeDeRespuesta(res) };
  try {
    return { ok: true, datos: (await res.json()) as ComprobantePublico };
  } catch {
    return { ok: false, mensaje: "La respuesta del servidor no se pudo interpretar." };
  }
}

/**
 * Descarga el PDF y devuelve un blob URL para mostrarlo dentro de la página.
 *
 * 🔑 Por qué blob y no `<iframe src="{url del API}">`:
 * nginx responde con `X-Frame-Options: SAMEORIGIN` en todo el dominio del API, y
 * este sitio vive en otro subdominio → el navegador bloquearía ese iframe y el
 * visor quedaría en blanco. Un blob: URL lo crea este mismo documento, así que
 * es del mismo origen y la cabecera no aplica. Además evita tocar la
 * configuración de nginx, que es infraestructura compartida del servidor.
 */
export async function cargarPdfComoBlobUrl(codigo: string): Promise<string | null> {
  try {
    const res = await fetch(buildArchivoUrl(codigo, "pdf"), { method: "GET", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    // Forzar el tipo: si el servidor manda algo raro el navegador no lo renderiza.
    return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  } catch {
    return null;
  }
}

function sanitizeFilename(raw: string, fallback: string): string {
  const base = raw.trim().split(/[/\\]/).pop() ?? "";
  if (!base || base.includes("..")) return fallback;
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200) || fallback;
}

function nombreDesdeHeaders(contentDisposition: string | null, fallback: string): string {
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
  return fallback;
}

export type ResultadoDescargaArchivo = { ok: true } | { ok: false; mensaje: string };

/** Descarga PDF / XML / CDR al dispositivo del cliente. */
export async function descargarArchivo(
  codigo: string,
  tipo: TipoArchivo
): Promise<ResultadoDescargaArchivo> {
  const url = buildArchivoUrl(codigo, tipo, true);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", credentials: "omit" });
  } catch {
    // Sin red o CORS bloqueado: abrir en pestaña nueva suele funcionar igual.
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true };
  }
  if (!res.ok) return { ok: false, mensaje: await mensajeDeRespuesta(res) };

  try {
    const blob = await res.blob();
    const fallback = `${codigo}-${tipo}`;
    const nombre = sanitizeFilename(
      nombreDesdeHeaders(res.headers.get("Content-Disposition"), fallback),
      fallback
    );
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nombre;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // El revoke NO puede ser inmediato: el navegador arranca la descarga de forma
    // asíncrona y si el blob ya no existe cuando va a leerlo, la descarga se
    // cancela sin ningún aviso (falla intermitente, según el navegador y el peso
    // del archivo). Se libera después, cuando la descarga ya tomó el contenido.
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return { ok: true };
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true };
  }
}

/** Formatea el monto con su moneda (S/ para PEN, $ para USD). */
export function formatearMonto(total: number, moneda: string): string {
  const simbolo = (moneda || "PEN").toUpperCase() === "USD" ? "$" : "S/";
  const valor = Number.isFinite(total) ? total : 0;
  return `${simbolo} ${valor.toFixed(2)}`;
}

/** Formatea la fecha ISO (YYYY-MM-DD) como DD/MM/YYYY sin correrla de día. */
export function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  // Se parsea a mano a propósito: `new Date("2026-08-12")` se interpreta como UTC
  // y en Lima (UTC-5) muestra el día anterior.
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
