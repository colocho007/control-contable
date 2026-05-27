import { supabase } from "./supabase";

export type ValorJsonAuditoria =
  | string
  | number
  | boolean
  | null
  | ValorJsonAuditoria[]
  | { [clave: string]: ValorJsonAuditoria };

export interface RegistrarAuditoriaEventoParams {
  empresa_id?: number | null;
  modulo: string;
  accion: string;
  entidad_tipo?: string | null;
  entidad_id?: string | number | null;
  estado_anterior?: string | null;
  estado_nuevo?: string | null;
  motivo?: string | null;
  descripcion?: string | null;
  metadatos?: ValorJsonAuditoria | null;
  sensible?: boolean;
  visible_usuario?: boolean;
  visible_calendario?: boolean;
  origen?: string | null;
  correlacion_id?: string | null;
}

export interface AuditoriaEvento {
  id: string | number;
  creado_at: string;
  usuario_id: string;
  usuario_nombre_snapshot: string | null;
  empresa_id: number | null;
  modulo: string;
  accion: string;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  motivo: string | null;
  descripcion: string | null;
  metadatos: ValorJsonAuditoria | null;
  sensible: boolean;
  visible_usuario: boolean;
  visible_calendario: boolean;
  origen: string | null;
  correlacion_id: string | null;
}

const COLUMNAS_EVENTO =
  "id,creado_at,usuario_id,usuario_nombre_snapshot,empresa_id,modulo,accion,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,descripcion,metadatos,sensible,visible_usuario,visible_calendario,origen,correlacion_id";

function requerirTexto(valor: string, campo: string) {
  if (!valor?.trim()) {
    throw new Error(`El campo ${campo} es obligatorio para registrar auditoria.`);
  }
}

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

export async function registrarAuditoriaEvento(
  params: RegistrarAuditoriaEventoParams
): Promise<AuditoriaEvento> {
  requerirTexto(params.modulo, "modulo");
  requerirTexto(params.accion, "accion");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw errorSupabase("No se pudo validar la sesion para registrar auditoria", authError);
  }

  if (!user) {
    throw new Error("No hay un usuario autenticado para registrar auditoria.");
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    console.warn(
      "No se pudo obtener el nombre del perfil para el snapshot de auditoria:",
      perfilError.message
    );
  }

  const evento = {
    usuario_id: user.id,
    usuario_nombre_snapshot: perfil?.nombre ?? null,
    modulo: params.modulo.trim(),
    accion: params.accion.trim(),
    ...(params.empresa_id !== undefined && { empresa_id: params.empresa_id }),
    ...(params.entidad_tipo !== undefined && {
      entidad_tipo: params.entidad_tipo,
    }),
    ...(params.entidad_id !== undefined && { entidad_id: params.entidad_id }),
    ...(params.estado_anterior !== undefined && {
      estado_anterior: params.estado_anterior,
    }),
    ...(params.estado_nuevo !== undefined && {
      estado_nuevo: params.estado_nuevo,
    }),
    ...(params.motivo !== undefined && { motivo: params.motivo }),
    ...(params.descripcion !== undefined && {
      descripcion: params.descripcion,
    }),
    ...(params.metadatos !== undefined && { metadatos: params.metadatos }),
    ...(params.sensible !== undefined && { sensible: params.sensible }),
    ...(params.visible_usuario !== undefined && {
      visible_usuario: params.visible_usuario,
    }),
    ...(params.visible_calendario !== undefined && {
      visible_calendario: params.visible_calendario,
    }),
    ...(params.origen !== undefined && { origen: params.origen }),
    ...(params.correlacion_id !== undefined && {
      correlacion_id: params.correlacion_id,
    }),
  };

  const { data, error } = await supabase
    .from("auditoria_eventos")
    .insert(evento)
    .select(COLUMNAS_EVENTO)
    .single();

  if (error) {
    throw errorSupabase("No se pudo registrar el evento de auditoria", error);
  }

  return data as AuditoriaEvento;
}
