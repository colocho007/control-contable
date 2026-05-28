import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
  type ValorJsonAuditoria,
} from "./auditoria";
import { supabase } from "./supabase";

export type MetadatosCalendario = ValorJsonAuditoria;

export interface CalendarioEvento {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  titulo: string;
  descripcion: string | null;
  tipo_evento: string | null;
  estado: string;
  prioridad: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  modulo_origen: string | null;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  responsable_id: string | null;
  creado_por: string | null;
  visible_dashboard: boolean;
  sensible: boolean;
  metadatos: MetadatosCalendario | null;
}

export interface CrearEventoCalendarioParams {
  empresa_id: number;
  titulo: string;
  fecha_inicio: string;
  descripcion?: string | null;
  tipo_evento?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  fecha_fin?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  modulo_origen?: string | null;
  entidad_tipo?: string | null;
  entidad_id?: string | number | null;
  responsable_id?: string | null;
  visible_dashboard?: boolean;
  sensible?: boolean;
  metadatos?: MetadatosCalendario | null;
}

export interface ListarEventosCalendarioParams {
  empresa_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string;
  tipo_evento?: string;
  responsable_id?: string;
  modulo_origen?: string;
  entidad_tipo?: string;
  visible_dashboard?: boolean;
  sensible?: boolean;
  texto?: string;
  limite?: number;
}

export interface ActualizarEventoCalendarioParams {
  titulo?: string;
  descripcion?: string | null;
  tipo_evento?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  responsable_id?: string | null;
  visible_dashboard?: boolean;
  sensible?: boolean;
  metadatos?: MetadatosCalendario | null;
}

export interface EventoOperativo {
  id: string;
  origen: "calendario";
  empresa_id: number;
  titulo: string;
  descripcion: string | null;
  tipo_evento: string | null;
  estado: string;
  prioridad: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  modulo_origen: string | null;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  responsable_id: string | null;
  visible_dashboard: boolean;
  sensible: boolean;
  metadatos: MetadatosCalendario | null;
  evento_original: CalendarioEvento;
}

const COLUMNAS_CALENDARIO =
  "id,creado_at,actualizado_at,empresa_id,titulo,descripcion,tipo_evento,estado,prioridad,fecha_inicio,fecha_fin,hora_inicio,hora_fin,modulo_origen,entidad_tipo,entidad_id,responsable_id,creado_por,visible_dashboard,sensible,metadatos";
const LIMITE_PREDETERMINADO = 200;
const LIMITE_MAXIMO = 1000;

function requerirTexto(valor: string, campo: string) {
  if (!valor?.trim()) {
    throw new Error(`El campo ${campo} es obligatorio para calendario.`);
  }

  return valor.trim();
}

function validarEmpresaId(empresaId: number) {
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error("Debe indicar una empresa valida para calendario.");
  }
}

function validarFecha(valor: string, campo: string) {
  const fecha = requerirTexto(valor, campo);

  if (Number.isNaN(new Date(fecha).getTime())) {
    throw new Error(`El campo ${campo} debe ser una fecha valida.`);
  }

  return fecha;
}

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

function textoONull(valor?: string | null) {
  const texto = valor?.trim();
  return texto ? texto : null;
}

function resolverLimite(limite?: number) {
  if (limite === undefined) return LIMITE_PREDETERMINADO;

  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error("El limite de eventos debe ser un numero entero positivo.");
  }

  return Math.min(limite, LIMITE_MAXIMO);
}

function prepararTextoBusqueda(texto: string) {
  return texto
    .trim()
    .replace(/[,%()"'\\]/g, " ")
    .replace(/\s+/g, " ");
}

async function obtenerUsuarioIdActual() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw errorSupabase("No se pudo validar la sesion del usuario", error);
  }

  if (!user) {
    throw new Error("No hay un usuario autenticado para gestionar calendario.");
  }

  return user.id;
}

async function auditarSinBloquear(params: RegistrarAuditoriaEventoParams) {
  try {
    await registrarAuditoriaEvento(params);
  } catch (error) {
    console.error("La operacion de calendario se completo, pero fallo la auditoria:", error);
  }
}

function metadatosBasicosEvento(evento: CalendarioEvento): MetadatosCalendario {
  return {
    tipo_evento: evento.tipo_evento,
    prioridad: evento.prioridad,
    fecha_inicio: evento.fecha_inicio,
    fecha_fin: evento.fecha_fin,
    hora_inicio: evento.hora_inicio,
    hora_fin: evento.hora_fin,
    modulo_origen: evento.modulo_origen,
    entidad_tipo: evento.entidad_tipo,
    entidad_id: evento.entidad_id,
    visible_dashboard: evento.visible_dashboard,
  };
}

function normalizarEvento(data: unknown): CalendarioEvento {
  return data as CalendarioEvento;
}

export async function crearEventoCalendario(
  params: CrearEventoCalendarioParams
): Promise<CalendarioEvento> {
  validarEmpresaId(params.empresa_id);
  const titulo = requerirTexto(params.titulo, "titulo");
  const fechaInicio = validarFecha(params.fecha_inicio, "fecha_inicio");
  const creadoPor = await obtenerUsuarioIdActual();

  const { data, error } = await supabase
    .from("calendario_eventos")
    .insert({
      empresa_id: params.empresa_id,
      titulo,
      descripcion: textoONull(params.descripcion),
      tipo_evento: textoONull(params.tipo_evento),
      estado: textoONull(params.estado) || "pendiente",
      prioridad: textoONull(params.prioridad),
      fecha_inicio: fechaInicio,
      fecha_fin: params.fecha_fin ? validarFecha(params.fecha_fin, "fecha_fin") : null,
      hora_inicio: textoONull(params.hora_inicio),
      hora_fin: textoONull(params.hora_fin),
      modulo_origen: textoONull(params.modulo_origen),
      entidad_tipo: textoONull(params.entidad_tipo),
      entidad_id: params.entidad_id ?? null,
      responsable_id: textoONull(params.responsable_id),
      creado_por: creadoPor,
      visible_dashboard: params.visible_dashboard ?? false,
      sensible: params.sensible ?? false,
      metadatos: params.metadatos ?? null,
      actualizado_at: new Date().toISOString(),
    })
    .select(COLUMNAS_CALENDARIO)
    .single();

  if (error) {
    throw errorSupabase("No se pudo crear el evento de calendario", error);
  }

  const evento = normalizarEvento(data);

  await auditarSinBloquear({
    empresa_id: evento.empresa_id,
    modulo: "calendario",
    accion: "crear_evento",
    entidad_tipo: "calendario_evento",
    entidad_id: evento.id,
    estado_nuevo: evento.estado,
    descripcion: "Evento de calendario creado",
    sensible: evento.sensible,
    visible_calendario: true,
    metadatos: metadatosBasicosEvento(evento),
  });

  return evento;
}

export async function listarEventosCalendario(
  params: ListarEventosCalendarioParams = {}
): Promise<CalendarioEvento[]> {
  if (params.empresa_id !== undefined) {
    validarEmpresaId(params.empresa_id);
  }

  let query = supabase
    .from("calendario_eventos")
    .select(COLUMNAS_CALENDARIO);

  if (params.empresa_id !== undefined) {
    query = query.eq("empresa_id", params.empresa_id);
  }

  if (params.fecha_desde?.trim()) {
    query = query.gte("fecha_inicio", validarFecha(params.fecha_desde, "fecha_desde"));
  }

  if (params.fecha_hasta?.trim()) {
    query = query.lte("fecha_inicio", validarFecha(params.fecha_hasta, "fecha_hasta"));
  }

  if (params.estado?.trim()) {
    query = query.eq("estado", params.estado.trim());
  }

  if (params.tipo_evento?.trim()) {
    query = query.eq("tipo_evento", params.tipo_evento.trim());
  }

  if (params.responsable_id?.trim()) {
    query = query.eq("responsable_id", params.responsable_id.trim());
  }

  if (params.modulo_origen?.trim()) {
    query = query.eq("modulo_origen", params.modulo_origen.trim());
  }

  if (params.entidad_tipo?.trim()) {
    query = query.eq("entidad_tipo", params.entidad_tipo.trim());
  }

  if (params.visible_dashboard !== undefined) {
    query = query.eq("visible_dashboard", params.visible_dashboard);
  }

  if (params.sensible !== undefined) {
    query = query.eq("sensible", params.sensible);
  }

  if (params.texto?.trim()) {
    const texto = prepararTextoBusqueda(params.texto);

    if (!texto) {
      throw new Error("El texto de busqueda no contiene caracteres validos.");
    }

    query = query.or(
      [
        "titulo",
        "descripcion",
        "tipo_evento",
        "modulo_origen",
        "entidad_tipo",
      ]
        .map((campo) => `${campo}.ilike.%${texto}%`)
        .join(",")
    );
  }

  const { data, error } = await query
    .order("fecha_inicio", { ascending: true })
    .order("hora_inicio", { ascending: true, nullsFirst: true })
    .limit(resolverLimite(params.limite));

  if (error) {
    throw errorSupabase("No se pudieron listar los eventos de calendario", error);
  }

  return (data || []) as CalendarioEvento[];
}

export async function actualizarEventoCalendario(
  id: string | number,
  cambios: ActualizarEventoCalendarioParams
): Promise<CalendarioEvento> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el evento de calendario que desea actualizar.");
  }

  const actualizacion: Record<string, unknown> = {
    actualizado_at: new Date().toISOString(),
  };

  if (cambios.titulo !== undefined) {
    actualizacion.titulo = requerirTexto(cambios.titulo, "titulo");
  }

  if (cambios.descripcion !== undefined) {
    actualizacion.descripcion = textoONull(cambios.descripcion);
  }

  if (cambios.tipo_evento !== undefined) {
    actualizacion.tipo_evento = textoONull(cambios.tipo_evento);
  }

  if (cambios.estado !== undefined) {
    actualizacion.estado = textoONull(cambios.estado) || "pendiente";
  }

  if (cambios.prioridad !== undefined) {
    actualizacion.prioridad = textoONull(cambios.prioridad);
  }

  if (cambios.fecha_inicio !== undefined) {
    actualizacion.fecha_inicio = validarFecha(cambios.fecha_inicio, "fecha_inicio");
  }

  if (cambios.fecha_fin !== undefined) {
    actualizacion.fecha_fin = cambios.fecha_fin
      ? validarFecha(cambios.fecha_fin, "fecha_fin")
      : null;
  }

  if (cambios.hora_inicio !== undefined) {
    actualizacion.hora_inicio = textoONull(cambios.hora_inicio);
  }

  if (cambios.hora_fin !== undefined) {
    actualizacion.hora_fin = textoONull(cambios.hora_fin);
  }

  if (cambios.responsable_id !== undefined) {
    actualizacion.responsable_id = textoONull(cambios.responsable_id);
  }

  if (cambios.visible_dashboard !== undefined) {
    actualizacion.visible_dashboard = cambios.visible_dashboard;
  }

  if (cambios.sensible !== undefined) {
    actualizacion.sensible = cambios.sensible;
  }

  if (cambios.metadatos !== undefined) {
    actualizacion.metadatos = cambios.metadatos;
  }

  if (Object.keys(actualizacion).length === 1) {
    throw new Error("Debe indicar al menos un cambio para actualizar el evento.");
  }

  const { data, error } = await supabase
    .from("calendario_eventos")
    .update(actualizacion)
    .eq("id", id)
    .select(COLUMNAS_CALENDARIO)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo actualizar el evento de calendario", error);
  }

  if (!data) {
    throw new Error("No se encontro un evento de calendario accesible con ese id.");
  }

  return normalizarEvento(data);
}

export async function completarEventoCalendario(
  id: string | number,
  motivo?: string
): Promise<CalendarioEvento> {
  const evento = await actualizarEventoCalendario(id, { estado: "completado" });

  await auditarSinBloquear({
    empresa_id: evento.empresa_id,
    modulo: "calendario",
    accion: "completar_evento",
    entidad_tipo: "calendario_evento",
    entidad_id: evento.id,
    estado_nuevo: "completado",
    motivo: textoONull(motivo),
    descripcion: "Evento de calendario completado",
    sensible: evento.sensible,
    visible_calendario: true,
    metadatos: metadatosBasicosEvento(evento),
  });

  return evento;
}

export async function cancelarEventoCalendario(
  id: string | number,
  motivo?: string
): Promise<CalendarioEvento> {
  const evento = await actualizarEventoCalendario(id, { estado: "cancelado" });

  await auditarSinBloquear({
    empresa_id: evento.empresa_id,
    modulo: "calendario",
    accion: "cancelar_evento",
    entidad_tipo: "calendario_evento",
    entidad_id: evento.id,
    estado_nuevo: "cancelado",
    motivo: textoONull(motivo),
    descripcion: "Evento de calendario cancelado",
    sensible: evento.sensible,
    visible_calendario: true,
    metadatos: metadatosBasicosEvento(evento),
  });

  return evento;
}

export async function obtenerEventosOperativos(
  params: ListarEventosCalendarioParams = {}
): Promise<EventoOperativo[]> {
  const eventos = await listarEventosCalendario(params);

  return eventos.map((evento) => ({
    id: `calendario:${evento.id}`,
    origen: "calendario",
    empresa_id: evento.empresa_id,
    titulo: evento.titulo,
    descripcion: evento.descripcion,
    tipo_evento: evento.tipo_evento,
    estado: evento.estado,
    prioridad: evento.prioridad,
    fecha_inicio: evento.fecha_inicio,
    fecha_fin: evento.fecha_fin,
    hora_inicio: evento.hora_inicio,
    hora_fin: evento.hora_fin,
    modulo_origen: evento.modulo_origen,
    entidad_tipo: evento.entidad_tipo,
    entidad_id: evento.entidad_id,
    responsable_id: evento.responsable_id,
    visible_dashboard: evento.visible_dashboard,
    sensible: evento.sensible,
    metadatos: evento.metadatos,
    evento_original: evento,
  }));
}
