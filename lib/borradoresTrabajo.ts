import { supabase } from "./supabase";

export type ValorJson =
  | string
  | number
  | boolean
  | null
  | ValorJson[]
  | { [clave: string]: ValorJson };

export type EstadoBorradorTrabajo =
  | "borrador"
  | "completado"
  | "descartado";

export interface BorradorTrabajo {
  id: string | number;
  usuario_id: string;
  empresa_id: number | null;
  modulo: string;
  ruta: string;
  titulo: string;
  referencia_temporal: string | null;
  datos: ValorJson;
  estado: EstadoBorradorTrabajo;
  creado_at: string | null;
  actualizado_at: string;
  expira_at: string | null;
}

export interface GuardarBorradorTrabajoParams {
  modulo: string;
  ruta: string;
  titulo: string;
  empresa_id?: number | null;
  referencia_temporal?: string | null;
  datos: ValorJson;
}

export interface ObtenerBorradorActivoParams {
  modulo: string;
  referencia_temporal?: string | null;
}

export interface ListarBorradoresActivosParams {
  modulo?: string;
}

const COLUMNAS_BORRADOR =
  "id,usuario_id,empresa_id,modulo,ruta,titulo,referencia_temporal,datos,estado,creado_at,actualizado_at,expira_at";

function requerirTexto(valor: string, campo: string) {
  if (!valor?.trim()) {
    throw new Error(`El campo ${campo} es obligatorio para gestionar borradores.`);
  }
}

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

async function obtenerUsuarioId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw errorSupabase("No se pudo validar la sesion del usuario", error);
  }

  if (!user) {
    throw new Error("No hay un usuario autenticado para gestionar borradores.");
  }

  return user.id;
}

export async function guardarBorradorTrabajo(
  params: GuardarBorradorTrabajoParams
): Promise<BorradorTrabajo> {
  requerirTexto(params.modulo, "modulo");
  requerirTexto(params.ruta, "ruta");
  requerirTexto(params.titulo, "titulo");

  const usuarioId = await obtenerUsuarioId();
  const actualizadoAt = new Date().toISOString();
  const referenciaTemporal = params.referencia_temporal ?? null;

  let consultaExistente = supabase
    .from("borradores_trabajo")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("modulo", params.modulo)
    .eq("estado", "borrador");

  consultaExistente =
    referenciaTemporal === null
      ? consultaExistente.is("referencia_temporal", null)
      : consultaExistente.eq("referencia_temporal", referenciaTemporal);

  const { data: existente, error: errorExistente } = await consultaExistente
    .order("actualizado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorExistente) {
    throw errorSupabase("No se pudo buscar el borrador existente", errorExistente);
  }

  const datosBorrador = {
    usuario_id: usuarioId,
    empresa_id: params.empresa_id ?? null,
    modulo: params.modulo,
    ruta: params.ruta,
    titulo: params.titulo,
    referencia_temporal: referenciaTemporal,
    datos: params.datos,
    estado: "borrador" as const,
    actualizado_at: actualizadoAt,
  };

  if (existente) {
    const { data, error } = await supabase
      .from("borradores_trabajo")
      .update(datosBorrador)
      .eq("id", existente.id)
      .eq("usuario_id", usuarioId)
      .eq("estado", "borrador")
      .select(COLUMNAS_BORRADOR)
      .single();

    if (error) {
      throw errorSupabase("No se pudo actualizar el borrador", error);
    }

    return data as BorradorTrabajo;
  }

  const { data, error } = await supabase
    .from("borradores_trabajo")
    .insert({
      ...datosBorrador,
      creado_at: actualizadoAt,
    })
    .select(COLUMNAS_BORRADOR)
    .single();

  if (error) {
    throw errorSupabase("No se pudo crear el borrador", error);
  }

  return data as BorradorTrabajo;
}

export async function obtenerBorradorActivo(
  params: ObtenerBorradorActivoParams
): Promise<BorradorTrabajo | null> {
  requerirTexto(params.modulo, "modulo");

  const usuarioId = await obtenerUsuarioId();
  let consulta = supabase
    .from("borradores_trabajo")
    .select(COLUMNAS_BORRADOR)
    .eq("usuario_id", usuarioId)
    .eq("modulo", params.modulo)
    .eq("estado", "borrador");

  if (params.referencia_temporal !== undefined) {
    consulta =
      params.referencia_temporal === null
        ? consulta.is("referencia_temporal", null)
        : consulta.eq("referencia_temporal", params.referencia_temporal);
  }

  const { data, error } = await consulta
    .order("actualizado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo obtener el borrador activo", error);
  }

  return data ? (data as BorradorTrabajo) : null;
}

export async function listarBorradoresActivos(
  params: ListarBorradoresActivosParams = {}
): Promise<BorradorTrabajo[]> {
  if (params.modulo !== undefined) {
    requerirTexto(params.modulo, "modulo");
  }

  const usuarioId = await obtenerUsuarioId();
  let consulta = supabase
    .from("borradores_trabajo")
    .select(COLUMNAS_BORRADOR)
    .eq("usuario_id", usuarioId)
    .eq("estado", "borrador");

  if (params.modulo) {
    consulta = consulta.eq("modulo", params.modulo);
  }

  const { data, error } = await consulta.order("actualizado_at", {
    ascending: false,
  });

  if (error) {
    throw errorSupabase("No se pudieron listar los borradores activos", error);
  }

  return (data || []) as BorradorTrabajo[];
}

async function actualizarEstadoBorrador(
  id: string | number,
  estado: Exclude<EstadoBorradorTrabajo, "borrador">
): Promise<BorradorTrabajo> {
  const usuarioId = await obtenerUsuarioId();
  const { data, error } = await supabase
    .from("borradores_trabajo")
    .update({
      estado,
      actualizado_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("usuario_id", usuarioId)
    .eq("estado", "borrador")
    .select(COLUMNAS_BORRADOR)
    .maybeSingle();

  if (error) {
    throw errorSupabase(`No se pudo marcar el borrador como ${estado}`, error);
  }

  if (!data) {
    throw new Error("No se encontro un borrador activo del usuario con ese id.");
  }

  return data as BorradorTrabajo;
}

export async function marcarBorradorCompletado(
  id: string | number
): Promise<BorradorTrabajo> {
  return actualizarEstadoBorrador(id, "completado");
}

export async function descartarBorrador(
  id: string | number
): Promise<BorradorTrabajo> {
  return actualizarEstadoBorrador(id, "descartado");
}
