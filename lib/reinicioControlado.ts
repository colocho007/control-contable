import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
  type ValorJsonAuditoria,
} from "./auditoria";
import { supabase } from "./supabase";

export type TipoReinicioControlado =
  | "movimientos"
  | "cheques"
  | "fondos_chequeras"
  | "calendario"
  | "operativo_completo";

export type EstadoReinicioControlado =
  | "solicitado"
  | "ejecutando"
  | "completado"
  | "parcial"
  | "fallido"
  | "cancelado";

export type SeveridadRiesgoReinicio = "critico" | "alto" | "medio" | "bajo";

export interface PrevisualizarReinicioParams {
  empresa_id: number;
  tipo_reinicio: TipoReinicioControlado;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  incluir_movimientos?: boolean;
  incluir_cheques_no_pagados?: boolean;
  incluir_cheques_pagados?: boolean;
  incluir_fondos_chequeras?: boolean;
  incluir_calendario?: boolean;
}

export interface SolicitarReinicioControladoParams
  extends PrevisualizarReinicioParams {
  modulo?: string | null;
  descripcion?: string | null;
}

export interface EjecutarReinicioParams {
  reinicio_id: string | number;
  confirmacion_texto: string;
  modo?: "dryRun" | "ejecutar";
}

export interface ListarReiniciosControladosParams {
  empresa_id?: number;
  estado?: EstadoReinicioControlado | string;
  tipo_reinicio?: TipoReinicioControlado;
  limite?: number;
}

export interface ConteoMonto {
  cantidad: number;
  monto: number;
}

export interface ConteoSaldos {
  cantidad: number;
  saldo_base: number;
  saldo_comprometido: number;
  saldo_disponible: number;
}

export interface RiesgoReinicioControlado {
  severidad: SeveridadRiesgoReinicio;
  codigo: string;
  mensaje: string;
  metadatos?: ValorJsonAuditoria;
}

export interface ResumenReinicioControlado {
  empresa_id: number;
  tipo_reinicio: TipoReinicioControlado;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  generado_at: string;
  opciones: {
    incluir_movimientos: boolean;
    incluir_cheques_no_pagados: boolean;
    incluir_cheques_pagados: boolean;
    incluir_fondos_chequeras: boolean;
    incluir_calendario: boolean;
  };
  movimientos: {
    total: number;
    anulables: number;
    monto_total: number;
    monto_anulable: number;
    por_estado: Record<string, ConteoMonto>;
    sin_empresa_id_detectados: number | null;
  };
  cheques: {
    total: number;
    no_pagados: number;
    pagados: number;
    monto_total: number;
    monto_no_pagado: number;
    monto_pagado: number;
    sin_fecha: number;
    estados_raros: string[];
    por_estado: Record<string, ConteoMonto>;
    por_estado_fondo: Record<string, ConteoMonto>;
    cheques_fisicos_relacionados: number;
  };
  fondos: {
    total: number;
    activos: number;
    con_saldo_comprometido: number;
    saldos: ConteoSaldos;
    por_estado: Record<string, ConteoSaldos>;
  };
  chequeras: {
    total: number;
    activas: number;
    por_estado: Record<string, { cantidad: number }>;
  };
  cheques_fisicos: {
    total: number;
    disponibles: number;
    reservados: number;
    por_estado: Record<string, { cantidad: number }>;
  };
  calendario: {
    total: number;
    pendientes: number;
    por_estado: Record<string, { cantidad: number }>;
  };
  dependencias_operativas: {
    tareas_activas: number | null;
    ordenes_activas: number | null;
  };
  acciones_planeadas: string[];
  riesgos: RiesgoReinicioControlado[];
}

export interface OperacionReinicioResultado {
  tabla: string;
  accion: string;
  afectados: number;
  ok: boolean;
  mensaje?: string;
}

export interface ResultadoReinicioControlado {
  reinicio: ReinicioControlado | null;
  resumen_antes: ResumenReinicioControlado;
  resumen_despues: ResumenReinicioControlado;
  estado: EstadoReinicioControlado;
  operaciones: OperacionReinicioResultado[];
  riesgos: RiesgoReinicioControlado[];
}

export interface ReinicioControlado {
  id: string | number;
  empresa_id: number;
  modulo: string | null;
  tipo_reinicio: TipoReinicioControlado | string;
  descripcion: string | null;
  estado: EstadoReinicioControlado | string;
  solicitado_por: string | null;
  ejecutado_por: string | null;
  creado_at: string | null;
  actualizado_at: string | null;
  ejecutado_at: string | null;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  resumen_antes: ResumenReinicioControlado | null;
  resumen_despues: ResumenReinicioControlado | null;
  metadatos: ValorJsonAuditoria | null;
  correlacion_id: string | null;
}

interface MovimientoReinicioRow {
  id: number;
  empresa_id: number | null;
  estado: string | null;
  monto: number | null;
  fecha: string | null;
}

interface ChequeReinicioRow {
  id: number;
  empresa_id: number | null;
  estado: string | null;
  estado_fondo: string | null;
  monto: number | null;
  fecha_pago: string | null;
  cheque_fisico_id: number | null;
}

interface FondoReinicioRow {
  id: number;
  empresa_id: number | null;
  estado: string | null;
  saldo_base: number | null;
  saldo_comprometido: number | null;
  saldo_disponible: number | null;
}

interface ChequeraReinicioRow {
  id: number;
  empresa_id: number | null;
  estado: string | null;
}

interface ChequeFisicoReinicioRow {
  id: number;
  empresa_id: number | null;
  estado: string | null;
}

interface CalendarioReinicioRow {
  id: string | number;
  empresa_id: number | null;
  estado: string | null;
  fecha_inicio: string | null;
}

const TIPOS_REINICIO: TipoReinicioControlado[] = [
  "movimientos",
  "cheques",
  "fondos_chequeras",
  "calendario",
  "operativo_completo",
];

const ESTADOS_REINTENTABLES = ["solicitado", "parcial", "fallido"];
const COLUMNAS_REINICIO =
  "id,empresa_id,modulo,tipo_reinicio,descripcion,estado,solicitado_por,ejecutado_por,creado_at,actualizado_at,ejecutado_at,fecha_desde,fecha_hasta,resumen_antes,resumen_despues,metadatos,correlacion_id";
const COLUMNAS_MOVIMIENTOS_REINICIO = "id,empresa_id,estado,monto,fecha";
const COLUMNAS_CHEQUES_REINICIO =
  "id,empresa_id,estado,estado_fondo,monto,fecha_pago,cheque_fisico_id";
const COLUMNAS_FONDOS_REINICIO =
  "id,empresa_id,estado,saldo_base,saldo_comprometido,saldo_disponible";
const COLUMNAS_CHEQUERAS_REINICIO = "id,empresa_id,estado";
const COLUMNAS_CHEQUES_FISICOS_REINICIO = "id,empresa_id,estado";
const COLUMNAS_CALENDARIO_REINICIO = "id,empresa_id,estado,fecha_inicio";
const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 500;
const MOTIVO_REINICIO = "Reinicio controlado";

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

function textoONull(valor?: string | null) {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function validarEmpresaId(empresaId: number) {
  const normalizado = Number(empresaId);
  if (!Number.isInteger(normalizado) || normalizado <= 0) {
    throw new Error("Debe indicar una empresa valida para el reinicio controlado.");
  }
  return normalizado;
}

function validarTipoReinicio(tipo: TipoReinicioControlado) {
  if (!TIPOS_REINICIO.includes(tipo)) {
    throw new Error("El tipo de reinicio controlado no es valido.");
  }
  return tipo;
}

function validarFechaOpcional(valor?: string | null, campo = "fecha") {
  const fecha = textoONull(valor);
  if (!fecha) return null;
  if (Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
    throw new Error(`El campo ${campo} debe ser una fecha valida.`);
  }
  return fecha;
}

function resolverLimite(limite?: number) {
  if (limite === undefined) return LIMITE_PREDETERMINADO;
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error("El limite debe ser un numero entero positivo.");
  }
  return Math.min(limite, LIMITE_MAXIMO);
}

function monto(valor: number | null | undefined) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

function claveEstado(valor?: string | null) {
  return textoONull(valor) || "sin_estado";
}

function normalizarEstado(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

function esChequePagado(estado?: string | null) {
  return normalizarEstado(estado).includes("pagado");
}

function generarCorrelacionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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
    throw new Error("No hay usuario autenticado para el reinicio controlado.");
  }

  return user.id;
}

async function auditarSinBloquear(params: RegistrarAuditoriaEventoParams) {
  try {
    await registrarAuditoriaEvento(params);
  } catch (error) {
    console.error(
      "La operacion de reinicio controlado se completo, pero fallo la auditoria:",
      error
    );
  }
}

function incrementarConteoMonto(
  acumulado: Record<string, ConteoMonto>,
  clave: string,
  valor: number
) {
  const actual = acumulado[clave] || { cantidad: 0, monto: 0 };
  actual.cantidad += 1;
  actual.monto += valor;
  acumulado[clave] = actual;
}

function incrementarConteo(
  acumulado: Record<string, { cantidad: number }>,
  clave: string
) {
  const actual = acumulado[clave] || { cantidad: 0 };
  actual.cantidad += 1;
  acumulado[clave] = actual;
}

function incrementarConteoSaldos(
  acumulado: Record<string, ConteoSaldos>,
  clave: string,
  fondo: FondoReinicioRow
) {
  const actual =
    acumulado[clave] ||
    ({
      cantidad: 0,
      saldo_base: 0,
      saldo_comprometido: 0,
      saldo_disponible: 0,
    } satisfies ConteoSaldos);

  actual.cantidad += 1;
  actual.saldo_base += monto(fondo.saldo_base);
  actual.saldo_comprometido += monto(fondo.saldo_comprometido);
  actual.saldo_disponible += monto(fondo.saldo_disponible);
  acumulado[clave] = actual;
}

function resolverOpciones(params: PrevisualizarReinicioParams) {
  const tipo = validarTipoReinicio(params.tipo_reinicio);
  const operativoCompleto = tipo === "operativo_completo";

  return {
    incluir_movimientos:
      params.incluir_movimientos ?? (tipo === "movimientos" || operativoCompleto),
    incluir_cheques_no_pagados:
      params.incluir_cheques_no_pagados ?? (tipo === "cheques" || operativoCompleto),
    incluir_cheques_pagados: params.incluir_cheques_pagados ?? false,
    incluir_fondos_chequeras:
      params.incluir_fondos_chequeras ??
      (tipo === "fondos_chequeras" || operativoCompleto),
    incluir_calendario:
      params.incluir_calendario ?? (tipo === "calendario" || operativoCompleto),
  };
}

function aplicarRangoFechas<T extends { gte: Function; lte: Function }>(
  query: T,
  columna: string,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  let siguiente: any = query;
  if (fechaDesde) siguiente = siguiente.gte(columna, fechaDesde);
  if (fechaHasta) siguiente = siguiente.lte(columna, fechaHasta);
  return siguiente;
}

function resumenGeneralParaAuditoria(resumen: ResumenReinicioControlado) {
  return {
    empresa_id: resumen.empresa_id,
    tipo_reinicio: resumen.tipo_reinicio,
    fecha_desde: resumen.fecha_desde,
    fecha_hasta: resumen.fecha_hasta,
    movimientos: {
      total: resumen.movimientos.total,
      anulables: resumen.movimientos.anulables,
      monto_anulable: resumen.movimientos.monto_anulable,
    },
    cheques: {
      total: resumen.cheques.total,
      no_pagados: resumen.cheques.no_pagados,
      pagados: resumen.cheques.pagados,
      monto_no_pagado: resumen.cheques.monto_no_pagado,
      monto_pagado: resumen.cheques.monto_pagado,
    },
    fondos: {
      total: resumen.fondos.total,
      activos: resumen.fondos.activos,
      saldo_comprometido: resumen.fondos.saldos.saldo_comprometido,
    },
    chequeras: {
      total: resumen.chequeras.total,
      activas: resumen.chequeras.activas,
    },
    calendario: {
      total: resumen.calendario.total,
      pendientes: resumen.calendario.pendientes,
    },
    riesgos: resumen.riesgos.map((riesgo) => ({
      severidad: riesgo.severidad,
      codigo: riesgo.codigo,
      mensaje: riesgo.mensaje,
    })),
  };
}

function operacionesParaAuditoria(operaciones: OperacionReinicioResultado[]) {
  return operaciones.map((operacion) => ({
    tabla: operacion.tabla,
    accion: operacion.accion,
    afectados: operacion.afectados,
    ok: operacion.ok,
    mensaje: operacion.mensaje ?? null,
  }));
}

async function consultarMovimientos(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  let query: any = supabase
    .from("movimientos")
    .select(COLUMNAS_MOVIMIENTOS_REINICIO)
    .eq("empresa_id", empresaId);

  query = aplicarRangoFechas(query, "fecha", fechaDesde, fechaHasta);

  const { data, error } = await query;

  if (error) {
    throw errorSupabase("No se pudieron consultar movimientos para reinicio", error);
  }

  return (data || []) as MovimientoReinicioRow[];
}

async function contarMovimientosSinEmpresa(
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  try {
    let query: any = supabase
      .from("movimientos")
      .select("id", { count: "exact", head: true })
      .is("empresa_id", null);

    query = aplicarRangoFechas(query, "fecha", fechaDesde, fechaHasta);

    const { count, error } = await query;

    if (error) {
      console.warn("No se pudieron contar movimientos sin empresa_id:", error);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    console.warn("No se pudieron contar movimientos sin empresa_id:", error);
    return null;
  }
}

async function consultarCheques(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  let query: any = supabase
    .from("cheques")
    .select(COLUMNAS_CHEQUES_REINICIO)
    .eq("empresa_id", empresaId);

  query = aplicarRangoFechas(query, "fecha_pago", fechaDesde, fechaHasta);

  const { data, error } = await query;

  if (error) {
    throw errorSupabase("No se pudieron consultar cheques para reinicio", error);
  }

  return (data || []) as ChequeReinicioRow[];
}

async function consultarFondos(empresaId: number) {
  const { data, error } = await supabase
    .from("fondos_empresa")
    .select(COLUMNAS_FONDOS_REINICIO)
    .eq("empresa_id", empresaId);

  if (error) {
    throw errorSupabase("No se pudieron consultar fondos para reinicio", error);
  }

  return (data || []) as FondoReinicioRow[];
}

async function consultarChequeras(empresaId: number) {
  const { data, error } = await supabase
    .from("chequeras")
    .select(COLUMNAS_CHEQUERAS_REINICIO)
    .eq("empresa_id", empresaId);

  if (error) {
    throw errorSupabase("No se pudieron consultar chequeras para reinicio", error);
  }

  return (data || []) as ChequeraReinicioRow[];
}

async function consultarChequesFisicos(empresaId: number) {
  const { data, error } = await supabase
    .from("cheques_fisicos")
    .select(COLUMNAS_CHEQUES_FISICOS_REINICIO)
    .eq("empresa_id", empresaId);

  if (error) {
    throw errorSupabase("No se pudieron consultar cheques fisicos para reinicio", error);
  }

  return (data || []) as ChequeFisicoReinicioRow[];
}

async function consultarCalendario(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  let query: any = supabase
    .from("calendario_eventos")
    .select(COLUMNAS_CALENDARIO_REINICIO)
    .eq("empresa_id", empresaId);

  query = aplicarRangoFechas(query, "fecha_inicio", fechaDesde, fechaHasta);

  const { data, error } = await query;

  if (error) {
    throw errorSupabase("No se pudieron consultar eventos de calendario para reinicio", error);
  }

  return (data || []) as CalendarioReinicioRow[];
}

async function contarDependenciasOperativas(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  const resultado = {
    tareas_activas: null as number | null,
    ordenes_activas: null as number | null,
  };

  try {
    let tareasQuery: any = supabase
      .from("tareas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .neq("estado", "Cancelada");

    tareasQuery = aplicarRangoFechas(tareasQuery, "fecha_limite", fechaDesde, fechaHasta);

    const { count, error } = await tareasQuery;
    if (!error) resultado.tareas_activas = count ?? 0;
  } catch (error) {
    console.warn("No se pudieron contar tareas vinculadas al reinicio:", error);
  }

  try {
    let ordenesQuery: any = supabase
      .from("ordenes_compra")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    ordenesQuery = aplicarRangoFechas(
      ordenesQuery,
      "fecha_necesaria",
      fechaDesde,
      fechaHasta
    );

    const { count, error } = await ordenesQuery;
    if (!error) resultado.ordenes_activas = count ?? 0;
  } catch (error) {
    console.warn("No se pudieron contar ordenes vinculadas al reinicio:", error);
  }

  return resultado;
}

function agregarRiesgos(
  resumen: ResumenReinicioControlado,
  opciones: ReturnType<typeof resolverOpciones>
) {
  if (resumen.cheques.pagados > 0) {
    resumen.riesgos.push({
      severidad: "critico",
      codigo: "cheques_pagados_presentes",
      mensaje:
        "Existen cheques pagados. No se revierten automaticamente porque pueden haber generado movimientos financieros.",
      metadatos: {
        cantidad: resumen.cheques.pagados,
        monto: resumen.cheques.monto_pagado,
        incluir_cheques_pagados: opciones.incluir_cheques_pagados,
      },
    });
  }

  if (resumen.movimientos.sin_empresa_id_detectados) {
    resumen.riesgos.push({
      severidad: "alto",
      codigo: "movimientos_sin_empresa_id",
      mensaje:
        "Existen movimientos sin empresa_id. No entran al reinicio por empresa ni a los totales del resumen.",
      metadatos: {
        cantidad: resumen.movimientos.sin_empresa_id_detectados,
      },
    });
  }

  if (resumen.fondos.con_saldo_comprometido > 0) {
    resumen.riesgos.push({
      severidad: "alto",
      codigo: "fondos_con_saldo_comprometido",
      mensaje:
        "Hay fondos con saldo comprometido. Deben anularse o liberarse cheques antes de poner saldos en cero.",
      metadatos: {
        fondos: resumen.fondos.con_saldo_comprometido,
        saldo_comprometido: resumen.fondos.saldos.saldo_comprometido,
      },
    });
  }

  if (resumen.cheques.sin_fecha > 0) {
    resumen.riesgos.push({
      severidad: "medio",
      codigo: "cheques_sin_fecha_pago",
      mensaje:
        "Hay cheques sin fecha_pago. Si se usa rango de fechas, pueden quedar fuera del reinicio.",
      metadatos: {
        cantidad: resumen.cheques.sin_fecha,
      },
    });
  }

  if (resumen.cheques.estados_raros.length > 0) {
    resumen.riesgos.push({
      severidad: "medio",
      codigo: "cheques_estados_no_estandar",
      mensaje:
        "Hay cheques con estados no estandar. Conviene revisarlos antes de ejecutar el reinicio.",
      metadatos: {
        estados: resumen.cheques.estados_raros,
      },
    });
  }

  if (
    resumen.dependencias_operativas.tareas_activas ||
    resumen.dependencias_operativas.ordenes_activas
  ) {
    resumen.riesgos.push({
      severidad: "bajo",
      codigo: "dependencias_operativas_no_modificadas",
      mensaje:
        "Tareas y ordenes se contabilizan como contexto, pero este helper no las modifica en la version base.",
      metadatos: {
        tareas_activas: resumen.dependencias_operativas.tareas_activas,
        ordenes_activas: resumen.dependencias_operativas.ordenes_activas,
      },
    });
  }
}

function crearResumenBase(
  empresaId: number,
  params: PrevisualizarReinicioParams,
  fechaDesde: string | null,
  fechaHasta: string | null,
  opciones: ReturnType<typeof resolverOpciones>
): ResumenReinicioControlado {
  return {
    empresa_id: empresaId,
    tipo_reinicio: params.tipo_reinicio,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    generado_at: new Date().toISOString(),
    opciones,
    movimientos: {
      total: 0,
      anulables: 0,
      monto_total: 0,
      monto_anulable: 0,
      por_estado: {},
      sin_empresa_id_detectados: null,
    },
    cheques: {
      total: 0,
      no_pagados: 0,
      pagados: 0,
      monto_total: 0,
      monto_no_pagado: 0,
      monto_pagado: 0,
      sin_fecha: 0,
      estados_raros: [],
      por_estado: {},
      por_estado_fondo: {},
      cheques_fisicos_relacionados: 0,
    },
    fondos: {
      total: 0,
      activos: 0,
      con_saldo_comprometido: 0,
      saldos: {
        cantidad: 0,
        saldo_base: 0,
        saldo_comprometido: 0,
        saldo_disponible: 0,
      },
      por_estado: {},
    },
    chequeras: {
      total: 0,
      activas: 0,
      por_estado: {},
    },
    cheques_fisicos: {
      total: 0,
      disponibles: 0,
      reservados: 0,
      por_estado: {},
    },
    calendario: {
      total: 0,
      pendientes: 0,
      por_estado: {},
    },
    dependencias_operativas: {
      tareas_activas: null,
      ordenes_activas: null,
    },
    acciones_planeadas: [],
    riesgos: [],
  };
}

export async function previsualizarReinicioControlado(
  params: PrevisualizarReinicioParams
): Promise<ResumenReinicioControlado> {
  const empresaId = validarEmpresaId(params.empresa_id);
  validarTipoReinicio(params.tipo_reinicio);
  const fechaDesde = validarFechaOpcional(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFechaOpcional(params.fecha_hasta, "fecha_hasta");

  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw new Error("La fecha desde no puede ser mayor que la fecha hasta.");
  }

  const opciones = resolverOpciones(params);
  const resumen = crearResumenBase(
    empresaId,
    params,
    fechaDesde,
    fechaHasta,
    opciones
  );

  const [
    movimientos,
    cheques,
    fondos,
    chequeras,
    chequesFisicos,
    calendario,
    sinEmpresaId,
    dependencias,
  ] = await Promise.all([
    opciones.incluir_movimientos
      ? consultarMovimientos(empresaId, fechaDesde, fechaHasta)
      : Promise.resolve([] as MovimientoReinicioRow[]),
    opciones.incluir_cheques_no_pagados || opciones.incluir_cheques_pagados
      ? consultarCheques(empresaId, fechaDesde, fechaHasta)
      : Promise.resolve([] as ChequeReinicioRow[]),
    opciones.incluir_fondos_chequeras
      ? consultarFondos(empresaId)
      : Promise.resolve([] as FondoReinicioRow[]),
    opciones.incluir_fondos_chequeras
      ? consultarChequeras(empresaId)
      : Promise.resolve([] as ChequeraReinicioRow[]),
    opciones.incluir_fondos_chequeras || opciones.incluir_cheques_no_pagados
      ? consultarChequesFisicos(empresaId)
      : Promise.resolve([] as ChequeFisicoReinicioRow[]),
    opciones.incluir_calendario
      ? consultarCalendario(empresaId, fechaDesde, fechaHasta)
      : Promise.resolve([] as CalendarioReinicioRow[]),
    opciones.incluir_movimientos
      ? contarMovimientosSinEmpresa(fechaDesde, fechaHasta)
      : Promise.resolve(null),
    params.tipo_reinicio === "operativo_completo"
      ? contarDependenciasOperativas(empresaId, fechaDesde, fechaHasta)
      : Promise.resolve({ tareas_activas: null, ordenes_activas: null }),
  ]);

  resumen.movimientos.sin_empresa_id_detectados = sinEmpresaId;
  resumen.dependencias_operativas = dependencias;

  movimientos.forEach((movimiento) => {
    const valor = monto(movimiento.monto);
    const estado = claveEstado(movimiento.estado);
    resumen.movimientos.total += 1;
    resumen.movimientos.monto_total += valor;
    incrementarConteoMonto(resumen.movimientos.por_estado, estado, valor);

    if (normalizarEstado(movimiento.estado) !== "anulado") {
      resumen.movimientos.anulables += 1;
      resumen.movimientos.monto_anulable += valor;
    }
  });

  const chequesFisicosRelacionados = new Set<number>();
  const estadosChequeEstandar = [
    "pendiente de autorizacion",
    "pendiente de autorización",
    "autorizado",
    "rechazado",
    "anulado",
    "pagado",
  ];

  cheques.forEach((cheque) => {
    const valor = monto(cheque.monto);
    const estado = claveEstado(cheque.estado);
    const estadoNormalizado = normalizarEstado(cheque.estado);
    const estadoFondo = claveEstado(cheque.estado_fondo);
    resumen.cheques.total += 1;
    resumen.cheques.monto_total += valor;
    incrementarConteoMonto(resumen.cheques.por_estado, estado, valor);
    incrementarConteoMonto(resumen.cheques.por_estado_fondo, estadoFondo, valor);

    if (!cheque.fecha_pago) resumen.cheques.sin_fecha += 1;
    if (
      estadoNormalizado &&
      !estadosChequeEstandar.some((estandar) => estadoNormalizado.includes(estandar))
    ) {
      resumen.cheques.estados_raros.push(estado);
    }

    if (cheque.cheque_fisico_id) {
      chequesFisicosRelacionados.add(Number(cheque.cheque_fisico_id));
    }

    if (esChequePagado(cheque.estado)) {
      resumen.cheques.pagados += 1;
      resumen.cheques.monto_pagado += valor;
    } else {
      resumen.cheques.no_pagados += 1;
      resumen.cheques.monto_no_pagado += valor;
    }
  });

  resumen.cheques.estados_raros = Array.from(new Set(resumen.cheques.estados_raros));
  resumen.cheques.cheques_fisicos_relacionados = chequesFisicosRelacionados.size;

  fondos.forEach((fondo) => {
    const estado = claveEstado(fondo.estado);
    resumen.fondos.total += 1;
    resumen.fondos.saldos.cantidad += 1;
    resumen.fondos.saldos.saldo_base += monto(fondo.saldo_base);
    resumen.fondos.saldos.saldo_comprometido += monto(fondo.saldo_comprometido);
    resumen.fondos.saldos.saldo_disponible += monto(fondo.saldo_disponible);
    incrementarConteoSaldos(resumen.fondos.por_estado, estado, fondo);

    if (normalizarEstado(fondo.estado) !== "inactiva") {
      resumen.fondos.activos += 1;
    }

    if (monto(fondo.saldo_comprometido) > 0) {
      resumen.fondos.con_saldo_comprometido += 1;
    }
  });

  chequeras.forEach((chequera) => {
    const estado = claveEstado(chequera.estado);
    resumen.chequeras.total += 1;
    incrementarConteo(resumen.chequeras.por_estado, estado);
    if (normalizarEstado(chequera.estado) === "activa") {
      resumen.chequeras.activas += 1;
    }
  });

  chequesFisicos.forEach((chequeFisico) => {
    const estado = claveEstado(chequeFisico.estado);
    const estadoNormalizado = normalizarEstado(chequeFisico.estado);
    resumen.cheques_fisicos.total += 1;
    incrementarConteo(resumen.cheques_fisicos.por_estado, estado);

    if (estadoNormalizado === "disponible") resumen.cheques_fisicos.disponibles += 1;
    if (estadoNormalizado === "reservado") resumen.cheques_fisicos.reservados += 1;
  });

  calendario.forEach((evento) => {
    const estado = claveEstado(evento.estado);
    const estadoNormalizado = normalizarEstado(evento.estado);
    resumen.calendario.total += 1;
    incrementarConteo(resumen.calendario.por_estado, estado);

    if (estadoNormalizado === "pendiente" || estadoNormalizado === "en_proceso") {
      resumen.calendario.pendientes += 1;
    }
  });

  if (opciones.incluir_movimientos) {
    resumen.acciones_planeadas.push(
      "Anular movimientos de la empresa y rango indicados, sin tocar movimientos sin empresa_id."
    );
  }

  if (opciones.incluir_cheques_no_pagados) {
    resumen.acciones_planeadas.push(
      "Anular cheques no pagados, liberar estado_fondo y anular cheques fisicos relacionados."
    );
  }

  if (opciones.incluir_fondos_chequeras) {
    resumen.acciones_planeadas.push(
      "Inactivar chequeras, anular cheques fisicos disponibles/reservados e inactivar fondos con saldos en cero."
    );
  }

  if (opciones.incluir_calendario) {
    resumen.acciones_planeadas.push(
      "Cancelar eventos de calendario pendientes o en proceso dentro del alcance."
    );
  }

  agregarRiesgos(resumen, opciones);

  return resumen;
}

export async function solicitarReinicioControlado(
  params: SolicitarReinicioControladoParams
): Promise<ReinicioControlado> {
  const empresaId = validarEmpresaId(params.empresa_id);
  const tipoReinicio = validarTipoReinicio(params.tipo_reinicio);
  const resumen = await previsualizarReinicioControlado(params);
  const userId = await obtenerUsuarioIdActual();
  const correlacionId = generarCorrelacionId();

  const { data, error } = await supabase
    .from("reinicios_controlados")
    .insert({
      empresa_id: empresaId,
      modulo: textoONull(params.modulo) || "reinicio-controlado",
      tipo_reinicio: tipoReinicio,
      descripcion: textoONull(params.descripcion),
      estado: "solicitado",
      solicitado_por: userId,
      resumen_antes: resumen,
      fecha_desde: resumen.fecha_desde,
      fecha_hasta: resumen.fecha_hasta,
      correlacion_id: correlacionId,
      metadatos: {
        opciones: resumen.opciones,
        riesgos: resumen.riesgos.map((riesgo) => ({
          severidad: riesgo.severidad,
          codigo: riesgo.codigo,
        })),
      },
      actualizado_at: new Date().toISOString(),
    })
    .select(COLUMNAS_REINICIO)
    .single();

  if (error) {
    throw errorSupabase("No se pudo solicitar el reinicio controlado", error);
  }

  const reinicio = data as ReinicioControlado;

  await auditarSinBloquear({
    empresa_id: empresaId,
    modulo: "reinicio-controlado",
    accion: "solicitar_reinicio_controlado",
    entidad_tipo: "reinicio_controlado",
    entidad_id: reinicio.id,
    estado_nuevo: "solicitado",
    descripcion: "Reinicio controlado solicitado",
    sensible: true,
    correlacion_id: correlacionId,
    metadatos: resumenGeneralParaAuditoria(resumen),
  });

  return reinicio;
}

function parametrosDesdeReinicio(
  reinicio: ReinicioControlado
): PrevisualizarReinicioParams {
  const metadatos =
    reinicio.metadatos && typeof reinicio.metadatos === "object" && !Array.isArray(reinicio.metadatos)
      ? reinicio.metadatos
      : {};
  const opciones =
    "opciones" in metadatos &&
    metadatos.opciones &&
    typeof metadatos.opciones === "object" &&
    !Array.isArray(metadatos.opciones)
      ? (metadatos.opciones as Record<string, unknown>)
      : {};

  return {
    empresa_id: Number(reinicio.empresa_id),
    tipo_reinicio: validarTipoReinicio(reinicio.tipo_reinicio as TipoReinicioControlado),
    fecha_desde: reinicio.fecha_desde,
    fecha_hasta: reinicio.fecha_hasta,
    incluir_movimientos:
      typeof opciones.incluir_movimientos === "boolean"
        ? opciones.incluir_movimientos
        : undefined,
    incluir_cheques_no_pagados:
      typeof opciones.incluir_cheques_no_pagados === "boolean"
        ? opciones.incluir_cheques_no_pagados
        : undefined,
    incluir_cheques_pagados:
      typeof opciones.incluir_cheques_pagados === "boolean"
        ? opciones.incluir_cheques_pagados
        : undefined,
    incluir_fondos_chequeras:
      typeof opciones.incluir_fondos_chequeras === "boolean"
        ? opciones.incluir_fondos_chequeras
        : undefined,
    incluir_calendario:
      typeof opciones.incluir_calendario === "boolean"
        ? opciones.incluir_calendario
        : undefined,
  };
}

async function actualizarReinicio(
  id: string | number,
  cambios: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("reinicios_controlados")
    .update({
      ...cambios,
      actualizado_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLUMNAS_REINICIO)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo actualizar el reinicio controlado", error);
  }

  if (!data) {
    throw new Error("No se encontro un reinicio controlado accesible con ese id.");
  }

  return data as ReinicioControlado;
}

async function ejecutarOperacion(
  tabla: string,
  accion: string,
  operacion: () => Promise<number>
): Promise<OperacionReinicioResultado> {
  try {
    const afectados = await operacion();
    return {
      tabla,
      accion,
      afectados,
      ok: true,
    };
  } catch (error) {
    return {
      tabla,
      accion,
      afectados: 0,
      ok: false,
      mensaje: error instanceof Error ? error.message : "Error desconocido.",
    };
  }
}

async function anularMovimientos(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  let query: any = supabase
    .from("movimientos")
    .update({
      estado: "anulado",
      anulado_at: new Date().toISOString(),
      motivo_anulacion: MOTIVO_REINICIO,
    })
    .eq("empresa_id", empresaId)
    .neq("estado", "anulado");

  query = aplicarRangoFechas(query, "fecha", fechaDesde, fechaHasta);

  const { data, error } = await query.select("id");

  if (error) {
    throw errorSupabase("No se pudieron anular movimientos", error);
  }

  return (data || []).length;
}

async function seleccionarChequesNoPagados(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  const cheques = await consultarCheques(empresaId, fechaDesde, fechaHasta);
  return cheques.filter(
    (cheque) =>
      !esChequePagado(cheque.estado) &&
      normalizarEstado(cheque.estado) !== "anulado"
  );
}

async function anularChequesNoPagados(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null,
  userId: string
) {
  const cheques = await seleccionarChequesNoPagados(empresaId, fechaDesde, fechaHasta);
  const ids = cheques.map((cheque) => cheque.id);

  if (!ids.length) {
    return {
      chequesAfectados: 0,
      chequesFisicosIds: [] as number[],
      historialOk: true,
    };
  }

  const ahora = new Date().toISOString();

  const { data, error } = await supabase
    .from("cheques")
    .update({
      estado: "Anulado",
      estado_fondo: "liberado",
      motivo_anulacion: MOTIVO_REINICIO,
      motivo_archivo: MOTIVO_REINICIO,
      archivado_por: userId,
      archivado_at: ahora,
      liberado_at: ahora,
    })
    .in("id", ids)
    .select("id,cheque_fisico_id");

  if (error) {
    throw errorSupabase("No se pudieron anular cheques", error);
  }

  const actualizados = (data || []) as Array<{
    id: number;
    cheque_fisico_id: number | null;
  }>;

  const chequesFisicosIds = actualizados
    .map((cheque) => cheque.cheque_fisico_id)
    .filter((id): id is number => Number.isInteger(Number(id)));

  let historialOk = true;

  if (actualizados.length) {
    const { error: historialError } = await supabase
      .from("cheques_historial")
      .insert(
        actualizados.map((cheque) => ({
          cheque_id: cheque.id,
          modulo: "reinicio-controlado",
          accion: "Anulado por reinicio controlado",
          estado_anterior: null,
          estado_nuevo: "Anulado",
          comentario: MOTIVO_REINICIO,
          usuario_id: userId,
          visible_usuario: true,
          visible_exportacion: true,
          sensible: true,
        }))
      );

    if (historialError) {
      historialOk = false;
      console.error("No se pudo registrar cheques_historial del reinicio:", historialError);
    }
  }

  return {
    chequesAfectados: actualizados.length,
    chequesFisicosIds,
    historialOk,
  };
}

async function anularChequesFisicosPorIds(ids: number[]) {
  const idsUnicos = Array.from(new Set(ids.filter((id) => Number.isInteger(id))));
  if (!idsUnicos.length) return 0;

  const { data, error } = await supabase
    .from("cheques_fisicos")
    .update({ estado: "Anulado" })
    .in("id", idsUnicos)
    .select("id");

  if (error) {
    throw errorSupabase("No se pudieron anular cheques fisicos relacionados", error);
  }

  return (data || []).length;
}

async function anularChequesFisicosDisponiblesOReservados(empresaId: number) {
  const { data, error } = await supabase
    .from("cheques_fisicos")
    .update({ estado: "Anulado" })
    .eq("empresa_id", empresaId)
    .in("estado", ["Disponible", "Reservado"])
    .select("id");

  if (error) {
    throw errorSupabase("No se pudieron anular cheques fisicos disponibles", error);
  }

  return (data || []).length;
}

async function inactivarChequeras(empresaId: number) {
  const { data, error } = await supabase
    .from("chequeras")
    .update({ estado: "Inactiva" })
    .eq("empresa_id", empresaId)
    .neq("estado", "Inactiva")
    .select("id");

  if (error) {
    throw errorSupabase("No se pudieron inactivar chequeras", error);
  }

  return (data || []).length;
}

async function inactivarFondosYCerrarSaldos(empresaId: number) {
  const { data, error } = await supabase
    .from("fondos_empresa")
    .update({
      estado: "Inactiva",
      saldo_base: 0,
      saldo_comprometido: 0,
      saldo_disponible: 0,
    })
    .eq("empresa_id", empresaId)
    .select("id");

  if (error) {
    throw errorSupabase("No se pudieron inactivar fondos", error);
  }

  return (data || []).length;
}

async function cancelarCalendario(
  empresaId: number,
  fechaDesde: string | null,
  fechaHasta: string | null
) {
  let query: any = supabase
    .from("calendario_eventos")
    .update({
      estado: "cancelado",
      actualizado_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId)
    .in("estado", ["pendiente", "en_proceso"]);

  query = aplicarRangoFechas(query, "fecha_inicio", fechaDesde, fechaHasta);

  const { data, error } = await query.select("id");

  if (error) {
    throw errorSupabase("No se pudieron cancelar eventos de calendario", error);
  }

  return (data || []).length;
}

export async function ejecutarReinicioControlado(
  params: EjecutarReinicioParams
): Promise<ResultadoReinicioControlado> {
  if (
    params.reinicio_id === "" ||
    params.reinicio_id === null ||
    params.reinicio_id === undefined
  ) {
    throw new Error("Debe indicar el reinicio controlado que desea ejecutar.");
  }

  const modo = params.modo || "ejecutar";
  const reinicio = await obtenerReinicioControlado(params.reinicio_id);
  const previsualizacionParams = parametrosDesdeReinicio(reinicio);
  const resumenAntes =
    reinicio.resumen_antes ||
    (await previsualizarReinicioControlado(previsualizacionParams));

  if (modo === "dryRun") {
    const resumenDespues = await previsualizarReinicioControlado(previsualizacionParams);
    return {
      reinicio,
      resumen_antes: resumenAntes,
      resumen_despues: resumenDespues,
      estado: reinicio.estado as EstadoReinicioControlado,
      operaciones: [],
      riesgos: resumenDespues.riesgos,
    };
  }

  if (params.confirmacion_texto !== "REINICIAR") {
    throw new Error('Para ejecutar el reinicio debes confirmar con el texto exacto "REINICIAR".');
  }

  if (!ESTADOS_REINTENTABLES.includes(String(reinicio.estado))) {
    throw new Error("El reinicio controlado no esta en un estado ejecutable.");
  }

  const userId = await obtenerUsuarioIdActual();
  await actualizarReinicio(reinicio.id, { estado: "ejecutando" });

  const opciones = resolverOpciones(previsualizacionParams);
  const operaciones: OperacionReinicioResultado[] = [];
  const riesgos = [...resumenAntes.riesgos];

  if (opciones.incluir_movimientos) {
    operaciones.push(
      await ejecutarOperacion("movimientos", "anular_movimientos", () =>
        anularMovimientos(
          previsualizacionParams.empresa_id,
          previsualizacionParams.fecha_desde || null,
          previsualizacionParams.fecha_hasta || null
        )
      )
    );
  }

  if (opciones.incluir_cheques_no_pagados) {
    let chequesFisicosIds: number[] = [];

    const resultadoCheques = await ejecutarOperacion(
      "cheques",
      "anular_cheques_no_pagados",
      async () => {
        const resultado = await anularChequesNoPagados(
          previsualizacionParams.empresa_id,
          previsualizacionParams.fecha_desde || null,
          previsualizacionParams.fecha_hasta || null,
          userId
        );
        chequesFisicosIds = resultado.chequesFisicosIds;

        if (!resultado.historialOk) {
          riesgos.push({
            severidad: "medio",
            codigo: "cheques_historial_parcial",
            mensaje:
              "Los cheques fueron anulados, pero fallo el registro en cheques_historial.",
          });
        }

        return resultado.chequesAfectados;
      }
    );
    operaciones.push(resultadoCheques);

    operaciones.push(
      await ejecutarOperacion(
        "cheques_fisicos",
        "anular_cheques_fisicos_relacionados",
        () => anularChequesFisicosPorIds(chequesFisicosIds)
      )
    );

    if (resumenAntes.cheques.pagados > 0) {
      riesgos.push({
        severidad: opciones.incluir_cheques_pagados ? "alto" : "critico",
        codigo: "cheques_pagados_omitidos",
        mensaje:
          "Los cheques pagados no fueron revertidos automaticamente. Deben revisarse manualmente junto con sus movimientos.",
        metadatos: {
          cantidad: resumenAntes.cheques.pagados,
          incluir_cheques_pagados: opciones.incluir_cheques_pagados,
        },
      });
    }
  }

  if (opciones.incluir_fondos_chequeras) {
    operaciones.push(
      await ejecutarOperacion(
        "cheques_fisicos",
        "anular_cheques_fisicos_disponibles_o_reservados",
        () => anularChequesFisicosDisponiblesOReservados(previsualizacionParams.empresa_id)
      )
    );

    operaciones.push(
      await ejecutarOperacion("chequeras", "inactivar_chequeras", () =>
        inactivarChequeras(previsualizacionParams.empresa_id)
      )
    );

    operaciones.push(
      await ejecutarOperacion("fondos_empresa", "inactivar_fondos_y_cerrar_saldos", () =>
        inactivarFondosYCerrarSaldos(previsualizacionParams.empresa_id)
      )
    );
  }

  if (opciones.incluir_calendario) {
    operaciones.push(
      await ejecutarOperacion("calendario_eventos", "cancelar_eventos", () =>
        cancelarCalendario(
          previsualizacionParams.empresa_id,
          previsualizacionParams.fecha_desde || null,
          previsualizacionParams.fecha_hasta || null
        )
      )
    );
  }

  const resumenDespues = await previsualizarReinicioControlado(previsualizacionParams);
  const hayErrores = operaciones.some((operacion) => !operacion.ok);
  const huboCambios = operaciones.some((operacion) => operacion.afectados > 0);
  const estadoFinal: EstadoReinicioControlado = hayErrores
    ? huboCambios
      ? "parcial"
      : "fallido"
    : "completado";

  const reinicioActualizado = await actualizarReinicio(reinicio.id, {
    estado: estadoFinal,
    ejecutado_por: userId,
    ejecutado_at: new Date().toISOString(),
    resumen_despues: resumenDespues,
    metadatos: {
      ...(reinicio.metadatos && typeof reinicio.metadatos === "object" && !Array.isArray(reinicio.metadatos)
        ? reinicio.metadatos
        : {}),
      operaciones: operacionesParaAuditoria(operaciones),
      riesgos,
    },
  });

  await auditarSinBloquear({
    empresa_id: reinicioActualizado.empresa_id,
    modulo: "reinicio-controlado",
    accion: "ejecutar_reinicio_controlado",
    entidad_tipo: "reinicio_controlado",
    entidad_id: reinicioActualizado.id,
    estado_anterior: "ejecutando",
    estado_nuevo: estadoFinal,
    descripcion: "Reinicio controlado ejecutado",
    sensible: true,
    correlacion_id: reinicioActualizado.correlacion_id,
    metadatos: {
      resumen_antes: resumenGeneralParaAuditoria(resumenAntes),
      resumen_despues: resumenGeneralParaAuditoria(resumenDespues),
      operaciones: operacionesParaAuditoria(operaciones),
      riesgos: riesgos.map((riesgo) => ({
        severidad: riesgo.severidad,
        codigo: riesgo.codigo,
        mensaje: riesgo.mensaje,
      })),
    },
  });

  return {
    reinicio: reinicioActualizado,
    resumen_antes: resumenAntes,
    resumen_despues: resumenDespues,
    estado: estadoFinal,
    operaciones,
    riesgos,
  };
}

export async function listarReiniciosControlados(
  params: ListarReiniciosControladosParams = {}
): Promise<ReinicioControlado[]> {
  let query: any = supabase
    .from("reinicios_controlados")
    .select(COLUMNAS_REINICIO);

  if (params.empresa_id !== undefined) {
    query = query.eq("empresa_id", validarEmpresaId(params.empresa_id));
  }

  if (params.estado?.trim()) {
    query = query.eq("estado", params.estado.trim());
  }

  if (params.tipo_reinicio) {
    query = query.eq("tipo_reinicio", validarTipoReinicio(params.tipo_reinicio));
  }

  const { data, error } = await query
    .order("creado_at", { ascending: false })
    .limit(resolverLimite(params.limite));

  if (error) {
    throw errorSupabase("No se pudieron listar reinicios controlados", error);
  }

  return (data || []) as ReinicioControlado[];
}

export async function obtenerReinicioControlado(
  id: string | number
): Promise<ReinicioControlado> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el reinicio controlado que desea consultar.");
  }

  const { data, error } = await supabase
    .from("reinicios_controlados")
    .select(COLUMNAS_REINICIO)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo obtener el reinicio controlado", error);
  }

  if (!data) {
    throw new Error("No se encontro un reinicio controlado accesible con ese id.");
  }

  return data as ReinicioControlado;
}
