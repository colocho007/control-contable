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

export type FuenteEventoOperativo =
  | "calendario"
  | "tareas"
  | "cheques"
  | "ordenes"
  | "auditoria";

export interface EventoOperativo {
  id: string;
  fuente: FuenteEventoOperativo;
  empresa_id: number | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  fecha_fin: string | null;
  hora_fin: string | null;
  estado: string;
  prioridad: string | null;
  tipo_evento: string | null;
  modulo_origen: string | null;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  responsable_id: string | null;
  visible_dashboard: boolean;
  sensible: boolean;
  metadatos: MetadatosCalendario | null;
  evento_original: unknown;
}

export interface ObtenerEventosOperativosParams
  extends ListarEventosCalendarioParams {
  empresas_ids?: number[];
  incluir_auditoria_general?: boolean;
}

const COLUMNAS_CALENDARIO =
  "id,creado_at,actualizado_at,empresa_id,titulo,descripcion,tipo_evento,estado,prioridad,fecha_inicio,fecha_fin,hora_inicio,hora_fin,modulo_origen,entidad_tipo,entidad_id,responsable_id,creado_por,visible_dashboard,sensible,metadatos";
const COLUMNAS_TAREAS =
  "id,nombre,estado,usuario_id,empresa,empresa_id,fecha_limite,prioridad,monto,moneda,tipo_movimiento,categoria,movimiento_generado";
const COLUMNAS_CHEQUES =
  "id,empresa_id,empresa,beneficiario,concepto,monto,moneda,forma_pago,numero_cheque,fondo_empresa_id,chequera_id,cheque_fisico_id,fecha_pago,estado,prioridad,created_at";
const COLUMNAS_ORDENES =
  "id,empresa_id,empresa,proveedor,concepto,descripcion,monto,total_final,moneda,prioridad,fecha_necesaria,estado,numero_factura,numero_orden,created_at";
const COLUMNAS_AUDITORIA =
  "id,creado_at,usuario_id,usuario_nombre_snapshot,empresa_id,modulo,accion,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,descripcion,metadatos,sensible,visible_calendario,origen";
const LIMITE_PREDETERMINADO = 200;
const LIMITE_MAXIMO = 1000;

interface TareaCalendarioRow {
  id: number;
  nombre: string | null;
  estado: string | null;
  usuario_id: string | null;
  empresa: string | null;
  empresa_id: number | null;
  fecha_limite: string | null;
  prioridad: string | null;
  monto: number | null;
  moneda: string | null;
  tipo_movimiento: string | null;
  categoria: string | null;
  movimiento_generado: boolean | null;
}

interface ChequeCalendarioRow {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  beneficiario: string | null;
  concepto: string | null;
  monto: number | null;
  moneda: string | null;
  forma_pago: string | null;
  numero_cheque: string | null;
  fondo_empresa_id: number | null;
  chequera_id: number | null;
  cheque_fisico_id: number | null;
  fecha_pago: string | null;
  estado: string | null;
  prioridad: string | null;
  created_at: string | null;
}

interface OrdenCalendarioRow {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  proveedor: string | null;
  concepto: string | null;
  descripcion: string | null;
  monto: number | null;
  total_final: number | null;
  moneda: string | null;
  prioridad: string | null;
  fecha_necesaria: string | null;
  estado: string | null;
  numero_factura: string | null;
  numero_orden: string | null;
  created_at: string | null;
}

interface AuditoriaCalendarioRow {
  id: string | number;
  creado_at: string;
  usuario_id: string | null;
  usuario_nombre_snapshot: string | null;
  empresa_id: number | null;
  modulo: string | null;
  accion: string | null;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  motivo: string | null;
  descripcion: string | null;
  metadatos: MetadatosCalendario | null;
  sensible: boolean | null;
  visible_calendario: boolean | null;
  origen: string | null;
}

type ResultadoConsultaCalendario = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

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

function normalizarComparacion(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

function normalizarFecha(valor?: string | null) {
  if (!valor) return null;
  const fecha = valor.includes("T") ? valor.slice(0, 10) : valor;
  return fecha || null;
}

function normalizarHora(valor?: string | null) {
  if (!valor) return null;
  if (valor.includes("T")) return valor.slice(11, 16);
  return valor.slice(0, 5);
}

function fechaHoraEvento(evento: EventoOperativo) {
  return new Date(`${evento.fecha}T${evento.hora || "00:00"}`).getTime();
}

function resolverEmpresasConsulta(params: ObtenerEventosOperativosParams) {
  const permitidas = (params.empresas_ids || [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (params.empresa_id !== undefined) {
    validarEmpresaId(params.empresa_id);

    if (permitidas.length && !permitidas.includes(params.empresa_id)) {
      return [];
    }

    return [params.empresa_id];
  }

  return Array.from(new Set(permitidas));
}

function aplicarFiltrosOperativos(
  eventos: EventoOperativo[],
  params: ObtenerEventosOperativosParams
) {
  const texto = params.texto?.trim()
    ? prepararTextoBusqueda(params.texto).toLowerCase()
    : "";
  const estado = normalizarComparacion(params.estado);
  const tipoEvento = normalizarComparacion(params.tipo_evento);
  const responsableId = normalizarComparacion(params.responsable_id);
  const moduloOrigen = normalizarComparacion(params.modulo_origen);
  const entidadTipo = normalizarComparacion(params.entidad_tipo);

  return eventos
    .filter((evento) => {
      if (params.empresa_id !== undefined && evento.empresa_id !== params.empresa_id) {
        return false;
      }

      if (params.fecha_desde?.trim() && evento.fecha < params.fecha_desde.trim()) {
        return false;
      }

      if (params.fecha_hasta?.trim() && evento.fecha > params.fecha_hasta.trim()) {
        return false;
      }

      if (estado && normalizarComparacion(evento.estado) !== estado) {
        return false;
      }

      if (tipoEvento && normalizarComparacion(evento.tipo_evento) !== tipoEvento) {
        return false;
      }

      if (responsableId && normalizarComparacion(evento.responsable_id) !== responsableId) {
        return false;
      }

      if (moduloOrigen && normalizarComparacion(evento.modulo_origen) !== moduloOrigen) {
        return false;
      }

      if (entidadTipo && normalizarComparacion(evento.entidad_tipo) !== entidadTipo) {
        return false;
      }

      if (params.sensible !== undefined && evento.sensible !== params.sensible) {
        return false;
      }

      if (params.visible_dashboard !== undefined && evento.visible_dashboard !== params.visible_dashboard) {
        return false;
      }

      if (texto) {
        const contenido = [
          evento.fuente,
          evento.titulo,
          evento.descripcion,
          evento.estado,
          evento.prioridad,
          evento.tipo_evento,
          evento.modulo_origen,
          evento.entidad_tipo,
          String(evento.entidad_id || ""),
          evento.metadatos ? JSON.stringify(evento.metadatos) : "",
        ]
          .join(" ")
          .toLowerCase();

        if (!contenido.includes(texto)) return false;
      }

      return true;
    })
    .sort((a, b) => fechaHoraEvento(a) - fechaHoraEvento(b))
    .slice(0, resolverLimite(params.limite));
}

function eventoCalendarioManual(evento: CalendarioEvento): EventoOperativo {
  return {
    id: `calendario:${evento.id}`,
    fuente: "calendario",
    empresa_id: evento.empresa_id,
    titulo: evento.titulo,
    descripcion: evento.descripcion,
    fecha: evento.fecha_inicio,
    hora: evento.hora_inicio,
    fecha_fin: evento.fecha_fin,
    hora_fin: evento.hora_fin,
    estado: evento.estado,
    prioridad: evento.prioridad,
    tipo_evento: evento.tipo_evento || "operativo",
    modulo_origen: evento.modulo_origen || "manual",
    entidad_tipo: evento.entidad_tipo || "calendario_evento",
    entidad_id: evento.id,
    responsable_id: evento.responsable_id,
    visible_dashboard: evento.visible_dashboard,
    sensible: evento.sensible,
    metadatos: evento.metadatos,
    evento_original: evento,
  };
}

function eventoTarea(row: TareaCalendarioRow): EventoOperativo | null {
  const fecha = normalizarFecha(row.fecha_limite);
  if (!fecha || row.empresa_id === null) return null;

  return {
    id: `tareas:${row.id}`,
    fuente: "tareas",
    empresa_id: row.empresa_id,
    titulo: row.nombre || `Tarea #${row.id}`,
    descripcion: row.categoria || null,
    fecha,
    hora: null,
    fecha_fin: null,
    hora_fin: null,
    estado: row.estado || "Pendiente",
    prioridad: row.prioridad,
    tipo_evento: "tarea",
    modulo_origen: "tareas",
    entidad_tipo: "tarea",
    entidad_id: row.id,
    responsable_id: row.usuario_id,
    visible_dashboard: true,
    sensible: false,
    metadatos: {
      empresa: row.empresa,
      monto: row.monto,
      moneda: row.moneda,
      tipo_movimiento: row.tipo_movimiento,
      categoria: row.categoria,
      movimiento_generado: row.movimiento_generado,
    },
    evento_original: row,
  };
}

function eventoCheque(row: ChequeCalendarioRow): EventoOperativo | null {
  const fecha = normalizarFecha(row.fecha_pago);
  if (!fecha || row.empresa_id === null) return null;

  return {
    id: `cheques:${row.id}`,
    fuente: "cheques",
    empresa_id: row.empresa_id,
    titulo: row.beneficiario ? `Cheque: ${row.beneficiario}` : "Cheque por pagar",
    descripcion: row.concepto,
    fecha,
    hora: null,
    fecha_fin: null,
    hora_fin: null,
    estado: row.estado || "Pendiente",
    prioridad: row.prioridad,
    tipo_evento: "cheque",
    modulo_origen: "cheques",
    entidad_tipo: "cheque",
    entidad_id: row.id,
    responsable_id: null,
    visible_dashboard: true,
    sensible: true,
    metadatos: {
      empresa: row.empresa,
      beneficiario: row.beneficiario,
      monto: row.monto,
      moneda: row.moneda,
      forma_pago: row.forma_pago,
      numero_cheque: row.numero_cheque,
      fondo_empresa_id: row.fondo_empresa_id,
      chequera_id: row.chequera_id,
      cheque_fisico_id: row.cheque_fisico_id,
    },
    evento_original: row,
  };
}

function eventoOrden(row: OrdenCalendarioRow): EventoOperativo | null {
  const fecha = normalizarFecha(row.fecha_necesaria);
  if (!fecha || row.empresa_id === null) return null;

  return {
    id: `ordenes:${row.id}`,
    fuente: "ordenes",
    empresa_id: row.empresa_id,
    titulo: row.proveedor ? `Orden: ${row.proveedor}` : `Orden de compra #${row.id}`,
    descripcion: row.concepto || row.descripcion,
    fecha,
    hora: null,
    fecha_fin: null,
    hora_fin: null,
    estado: row.estado || "Pendiente",
    prioridad: row.prioridad,
    tipo_evento: "orden",
    modulo_origen: "ordenes",
    entidad_tipo: "orden_compra",
    entidad_id: row.id,
    responsable_id: null,
    visible_dashboard: true,
    sensible: true,
    metadatos: {
      empresa: row.empresa,
      proveedor: row.proveedor,
      monto: row.total_final ?? row.monto,
      moneda: row.moneda,
      estado: row.estado,
      numero_factura: row.numero_factura,
      numero_orden: row.numero_orden,
    },
    evento_original: row,
  };
}

function eventoAuditoria(row: AuditoriaCalendarioRow): EventoOperativo | null {
  const fecha = normalizarFecha(row.creado_at);
  if (!fecha) return null;

  return {
    id: `auditoria:${row.id}`,
    fuente: "auditoria",
    empresa_id: row.empresa_id,
    titulo: `${row.modulo || "auditoria"} · ${row.accion || "evento"}`,
    descripcion: row.descripcion || row.motivo,
    fecha,
    hora: normalizarHora(row.creado_at),
    fecha_fin: null,
    hora_fin: null,
    estado: row.estado_nuevo || row.estado_anterior || "registrado",
    prioridad: null,
    tipo_evento: "auditoria",
    modulo_origen: row.modulo,
    entidad_tipo: row.entidad_tipo,
    entidad_id: row.entidad_id,
    responsable_id: row.usuario_id,
    visible_dashboard: false,
    sensible: row.sensible ?? false,
    metadatos: {
      usuario_nombre_snapshot: row.usuario_nombre_snapshot,
      estado_anterior: row.estado_anterior,
      estado_nuevo: row.estado_nuevo,
      motivo: row.motivo,
      origen: row.origen,
      metadatos: row.metadatos,
    },
    evento_original: row,
  };
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
  params: ObtenerEventosOperativosParams = {}
): Promise<EventoOperativo[]> {
  const empresasConsulta = resolverEmpresasConsulta(params);

  if (!empresasConsulta.length) {
    return [];
  }

  const limite = resolverLimite(params.limite);
  const filtrosFechaCalendario = {
    fecha_desde: params.fecha_desde,
    fecha_hasta: params.fecha_hasta,
  };

  let consultaCalendario = supabase
    .from("calendario_eventos")
    .select(COLUMNAS_CALENDARIO)
    .in("empresa_id", empresasConsulta);

  if (filtrosFechaCalendario.fecha_desde?.trim()) {
    consultaCalendario = consultaCalendario.gte(
      "fecha_inicio",
      validarFecha(filtrosFechaCalendario.fecha_desde, "fecha_desde")
    );
  }

  if (filtrosFechaCalendario.fecha_hasta?.trim()) {
    consultaCalendario = consultaCalendario.lte(
      "fecha_inicio",
      validarFecha(filtrosFechaCalendario.fecha_hasta, "fecha_hasta")
    );
  }

  let consultaTareas = supabase
    .from("tareas")
    .select(COLUMNAS_TAREAS)
    .in("empresa_id", empresasConsulta)
    .not("fecha_limite", "is", null)
    .neq("estado", "Cancelada");

  if (params.fecha_desde?.trim()) {
    consultaTareas = consultaTareas.gte(
      "fecha_limite",
      validarFecha(params.fecha_desde, "fecha_desde")
    );
  }

  if (params.fecha_hasta?.trim()) {
    consultaTareas = consultaTareas.lte(
      "fecha_limite",
      validarFecha(params.fecha_hasta, "fecha_hasta")
    );
  }

  let consultaCheques = supabase
    .from("cheques")
    .select(COLUMNAS_CHEQUES)
    .in("empresa_id", empresasConsulta)
    .not("fecha_pago", "is", null);

  if (params.fecha_desde?.trim()) {
    consultaCheques = consultaCheques.gte(
      "fecha_pago",
      validarFecha(params.fecha_desde, "fecha_desde")
    );
  }

  if (params.fecha_hasta?.trim()) {
    consultaCheques = consultaCheques.lte(
      "fecha_pago",
      validarFecha(params.fecha_hasta, "fecha_hasta")
    );
  }

  let consultaOrdenes = supabase
    .from("ordenes_compra")
    .select(COLUMNAS_ORDENES)
    .in("empresa_id", empresasConsulta)
    .not("fecha_necesaria", "is", null);

  if (params.fecha_desde?.trim()) {
    consultaOrdenes = consultaOrdenes.gte(
      "fecha_necesaria",
      validarFecha(params.fecha_desde, "fecha_desde")
    );
  }

  if (params.fecha_hasta?.trim()) {
    consultaOrdenes = consultaOrdenes.lte(
      "fecha_necesaria",
      validarFecha(params.fecha_hasta, "fecha_hasta")
    );
  }

  let consultaAuditoriaEmpresas = supabase
    .from("auditoria_eventos")
    .select(COLUMNAS_AUDITORIA)
    .eq("visible_calendario", true)
    .in("empresa_id", empresasConsulta);

  if (params.fecha_desde?.trim()) {
    consultaAuditoriaEmpresas = consultaAuditoriaEmpresas.gte(
      "creado_at",
      validarFecha(params.fecha_desde, "fecha_desde")
    );
  }

  if (params.fecha_hasta?.trim()) {
    consultaAuditoriaEmpresas = consultaAuditoriaEmpresas.lte(
      "creado_at",
      validarFecha(params.fecha_hasta, "fecha_hasta")
    );
  }

  const consultas: Array<Promise<ResultadoConsultaCalendario>> = [
    consultaCalendario
      .order("fecha_inicio", { ascending: true })
      .limit(limite) as unknown as Promise<ResultadoConsultaCalendario>,
    consultaTareas
      .order("fecha_limite", { ascending: true })
      .limit(limite) as unknown as Promise<ResultadoConsultaCalendario>,
    consultaCheques
      .order("fecha_pago", { ascending: true })
      .limit(limite) as unknown as Promise<ResultadoConsultaCalendario>,
    consultaOrdenes
      .order("fecha_necesaria", { ascending: true })
      .limit(limite) as unknown as Promise<ResultadoConsultaCalendario>,
    consultaAuditoriaEmpresas
      .order("creado_at", { ascending: true })
      .limit(limite) as unknown as Promise<ResultadoConsultaCalendario>,
  ];

  if (
    params.incluir_auditoria_general !== false &&
    params.empresa_id === undefined
  ) {
    let consultaAuditoriaGeneral = supabase
      .from("auditoria_eventos")
      .select(COLUMNAS_AUDITORIA)
      .eq("visible_calendario", true)
      .is("empresa_id", null);

    if (params.fecha_desde?.trim()) {
      consultaAuditoriaGeneral = consultaAuditoriaGeneral.gte(
        "creado_at",
        validarFecha(params.fecha_desde, "fecha_desde")
      );
    }

    if (params.fecha_hasta?.trim()) {
      consultaAuditoriaGeneral = consultaAuditoriaGeneral.lte(
        "creado_at",
        validarFecha(params.fecha_hasta, "fecha_hasta")
      );
    }

    consultas.push(
      consultaAuditoriaGeneral
        .order("creado_at", { ascending: true })
        .limit(limite) as unknown as Promise<ResultadoConsultaCalendario>
    );
  }

  const resultados = await Promise.all(consultas);
  const [
    calendarioResultado,
    tareasResultado,
    chequesResultado,
    ordenesResultado,
    auditoriaEmpresasResultado,
    auditoriaGeneralResultado,
  ] = resultados;

  if (calendarioResultado.error) {
    throw errorSupabase("No se pudieron cargar eventos manuales", calendarioResultado.error);
  }

  if (tareasResultado.error) {
    throw errorSupabase("No se pudieron cargar tareas para calendario", tareasResultado.error);
  }

  if (chequesResultado.error) {
    throw errorSupabase("No se pudieron cargar cheques para calendario", chequesResultado.error);
  }

  if (ordenesResultado.error) {
    throw errorSupabase("No se pudieron cargar ordenes para calendario", ordenesResultado.error);
  }

  if (auditoriaEmpresasResultado.error) {
    throw errorSupabase(
      "No se pudo cargar auditoria de empresas para calendario",
      auditoriaEmpresasResultado.error
    );
  }

  if (auditoriaGeneralResultado?.error) {
    throw errorSupabase(
      "No se pudo cargar auditoria general para calendario",
      auditoriaGeneralResultado.error
    );
  }

  const eventos = [
    ...((calendarioResultado.data || []) as CalendarioEvento[]).map(eventoCalendarioManual),
    ...((tareasResultado.data || []) as TareaCalendarioRow[])
      .map(eventoTarea)
      .filter((evento): evento is EventoOperativo => Boolean(evento)),
    ...((chequesResultado.data || []) as ChequeCalendarioRow[])
      .map(eventoCheque)
      .filter((evento): evento is EventoOperativo => Boolean(evento)),
    ...((ordenesResultado.data || []) as OrdenCalendarioRow[])
      .map(eventoOrden)
      .filter((evento): evento is EventoOperativo => Boolean(evento)),
    ...((auditoriaEmpresasResultado.data || []) as AuditoriaCalendarioRow[])
      .map(eventoAuditoria)
      .filter((evento): evento is EventoOperativo => Boolean(evento)),
    ...((auditoriaGeneralResultado?.data || []) as AuditoriaCalendarioRow[])
      .map(eventoAuditoria)
      .filter((evento): evento is EventoOperativo => Boolean(evento)),
  ];

  return aplicarFiltrosOperativos(eventos, params);
}
