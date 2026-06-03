import { supabase } from "./supabase";

export type AlcanceRateLimitOperativo =
  | "ip"
  | "usuario"
  | "empresa"
  | "usuario_empresa"
  | "assist";

export interface RegistrarRateLimitOperativoParams {
  usuarioId: string;
  modulo: string;
  accion: string;
  limite: number;
  ventanaSegundos: number;
  alcance?: AlcanceRateLimitOperativo;
  empresaId?: number | null;
  claveSufijo?: string;
  metadatos?: Record<string, unknown>;
}

export interface ResultadoRateLimitOperativo {
  permitido: boolean;
  contador: number | null;
  limite: number;
  bloqueado: boolean;
  retry_after_segundos: number;
  ventana_fin: string | null;
  mensaje: string;
  rpc_disponible: boolean;
}

function limpiarSegmento(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 80);
}

function construirClave(params: RegistrarRateLimitOperativoParams) {
  const empresa = params.empresaId ? `empresa:${params.empresaId}` : "empresa:general";
  const sufijo = params.claveSufijo ? `:${limpiarSegmento(params.claveSufijo)}` : "";
  return [
    "controlplus_rate_limit",
    limpiarSegmento(params.modulo),
    limpiarSegmento(params.accion),
    `usuario:${params.usuarioId}`,
    empresa,
  ].join(":") + sufijo;
}

function normalizarRespuesta(
  data: unknown,
  limite: number
): Omit<ResultadoRateLimitOperativo, "mensaje" | "rpc_disponible"> {
  const objeto = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const permitido = objeto.permitido !== false;
  const retryAfter =
    typeof objeto.retry_after_segundos === "number"
      ? Math.max(0, Math.ceil(objeto.retry_after_segundos))
      : 0;

  return {
    permitido,
    contador: typeof objeto.contador === "number" ? objeto.contador : null,
    limite: typeof objeto.limite === "number" ? objeto.limite : limite,
    bloqueado: objeto.bloqueado === true || !permitido,
    retry_after_segundos: retryAfter,
    ventana_fin: typeof objeto.ventana_fin === "string" ? objeto.ventana_fin : null,
  };
}

export async function registrarRateLimitOperativo(
  params: RegistrarRateLimitOperativoParams
): Promise<ResultadoRateLimitOperativo> {
  const alcance = params.alcance || (params.empresaId ? "usuario_empresa" : "usuario");

  try {
    const { data, error } = await supabase.rpc("registrar_rate_limit_operativo", {
      p_clave: construirClave(params),
      p_alcance: alcance,
      p_modulo: params.modulo,
      p_accion: params.accion,
      p_limite: params.limite,
      p_ventana_segundos: params.ventanaSegundos,
      p_empresa_id: params.empresaId ?? null,
      p_ip_hash: null,
      p_metadatos: {
        ...(params.metadatos || {}),
        ip_real_guardada: false,
        origen: "frontend",
      },
    });

    if (error) {
      console.warn("Rate limit persistente no disponible:", error.message);
      return {
        permitido: true,
        contador: null,
        limite: params.limite,
        bloqueado: false,
        retry_after_segundos: 0,
        ventana_fin: null,
        mensaje: "Control de frecuencia persistente no disponible; se usaran validaciones locales.",
        rpc_disponible: false,
      };
    }

    const normalizado = normalizarRespuesta(data, params.limite);
    return {
      ...normalizado,
      mensaje: normalizado.permitido
        ? "Operacion permitida."
        : `Demasiados intentos. Espera ${normalizado.retry_after_segundos || "unos"} segundos antes de reintentar.`,
      rpc_disponible: true,
    };
  } catch (error) {
    console.warn("No se pudo aplicar rate limit persistente:", error);
    return {
      permitido: true,
      contador: null,
      limite: params.limite,
      bloqueado: false,
      retry_after_segundos: 0,
      ventana_fin: null,
      mensaje: "Control de frecuencia persistente no disponible; se usaran validaciones locales.",
      rpc_disponible: false,
    };
  }
}
