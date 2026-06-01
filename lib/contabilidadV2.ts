import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
  type ValorJsonAuditoria,
} from "./auditoria";
import { supabase } from "./supabase";

export type NaturalezaCuenta = "deudora" | "acreedora";
export type EstadoPeriodoContable = "abierto" | "cerrado" | "bloqueado";
export type EstadoAsientoContable =
  | "registrado"
  | "borrador"
  | "anulado"
  | "requiere_revision";
export type EstadoDocumentoContable =
  | "Pendiente"
  | "En revision"
  | "Observado"
  | "Contabilizado"
  | "Rechazado"
  | "Vencido";

export interface CatalogoCuenta {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number | null;
  codigo: string;
  nombre: string;
  tipo: string;
  subtipo: string | null;
  naturaleza: NaturalezaCuenta;
  cuenta_padre_id: string | number | null;
  permite_movimientos: boolean;
  descripcion: string | null;
  activo: boolean;
  metadatos: ValorJsonAuditoria | null;
}

export interface PeriodoContable {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  anio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPeriodoContable | string;
  cerrado_por: string | null;
  cerrado_at: string | null;
  metadatos: ValorJsonAuditoria | null;
}

export interface AsientoContable {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  periodo_id: string | number;
  fecha: string;
  descripcion: string;
  origen_modulo: string | null;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  estado: EstadoAsientoContable | string;
  moneda_base: string;
  total_debe: number;
  total_haber: number;
  creado_por: string | null;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  metadatos: ValorJsonAuditoria | null;
  movimientos_contables_detalle?: MovimientoContableDetalle[];
}

export interface MovimientoContableDetalle {
  id: string | number;
  creado_at: string | null;
  asiento_id: string | number;
  cuenta_id: string | number;
  descripcion: string | null;
  debe: number;
  haber: number;
  moneda: string;
  tipo_cambio: number | null;
  monto_base: number | null;
  catalogo_cuentas?: Pick<CatalogoCuenta, "codigo" | "nombre" | "tipo" | "naturaleza"> | null;
}

export interface CrearCuentaContableParams {
  empresa_id?: number | null;
  codigo: string;
  nombre: string;
  tipo: string;
  subtipo?: string | null;
  naturaleza: NaturalezaCuenta;
  cuenta_padre_id?: string | number | null;
  permite_movimientos?: boolean;
  descripcion?: string | null;
  metadatos?: ValorJsonAuditoria | null;
}

export interface CrearPeriodoContableParams {
  empresa_id: number;
  anio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: EstadoPeriodoContable;
  metadatos?: ValorJsonAuditoria | null;
}

export interface MovimientoDetalleInput {
  cuenta_id: string | number;
  descripcion?: string | null;
  debe?: number;
  haber?: number;
  moneda?: string;
  tipo_cambio?: number | null;
  monto_base?: number | null;
}

export interface CrearAsientoContableParams {
  empresa_id: number;
  fecha: string;
  descripcion: string;
  origen_modulo?: string | null;
  entidad_tipo?: string | null;
  entidad_id?: string | number | null;
  moneda_base?: string;
  metadatos?: ValorJsonAuditoria | null;
  detalles: MovimientoDetalleInput[];
}

export interface ListarCatalogoCuentasParams {
  empresa_id?: number;
  incluir_globales?: boolean;
  tipo?: string;
  activo?: boolean;
  texto?: string;
}

export interface ListarPeriodosContablesParams {
  empresa_id: number;
  anio?: number;
  estado?: string;
}

export interface ObtenerOCrearPeriodoContableParams {
  empresa_id: number;
  fecha: string;
}

export interface ListarAsientosContablesParams {
  empresa_id: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  periodo_id?: string | number;
  estado?: string;
  origen_modulo?: string;
  entidad_tipo?: string;
  entidad_id?: string | number;
  limite?: number;
  incluir_detalles?: boolean;
}

export interface BalanceComprobacionFila {
  cuenta_id: string | number;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  debe: number;
  haber: number;
  saldo: number;
}

export interface DocumentoContableRevision {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  proveedor_id: string | number | null;
  cliente_id: string | number | null;
  tipo_documento: string;
  serie: string | null;
  numero_documento: string;
  fecha_documento: string;
  fecha_vencimiento: string | null;
  moneda: string;
  subtotal: number;
  iva: number;
  isr: number;
  total: number;
  descripcion: string | null;
  estado: EstadoDocumentoContable | string;
  creado_por: string | null;
  revisado_por: string | null;
  contabilizado_por: string | null;
  revisado_at: string | null;
  contabilizado_at: string | null;
  observacion: string | null;
  metadatos: ValorJsonAuditoria | null;
}

export interface CrearDocumentoContableRevisionParams {
  empresa_id: number;
  proveedor_id?: string | number | null;
  cliente_id?: string | number | null;
  tipo_documento: string;
  serie?: string | null;
  numero_documento: string;
  fecha_documento: string;
  fecha_vencimiento?: string | null;
  moneda?: string;
  subtotal: number;
  iva?: number;
  isr?: number;
  total: number;
  descripcion?: string | null;
  metadatos?: ValorJsonAuditoria | null;
}

export interface ListarDocumentosContablesRevisionParams {
  empresa_id: number;
  estado?: string;
  limite?: number;
}

export interface CambiarEstadoDocumentoContableParams {
  id: string | number;
  empresa_id: number;
  estado: Exclude<EstadoDocumentoContable, "Pendiente">;
  observacion?: string | null;
}

export interface CorregirDocumentoContableRevisionParams {
  id: string | number;
  empresa_id: number;
  serie?: string | null;
  numero_documento?: string;
  fecha_documento?: string;
  fecha_vencimiento?: string | null;
  moneda?: string;
  subtotal?: number;
  iva?: number;
  isr?: number;
  total?: number;
  descripcion?: string | null;
  observacion: string;
}

export interface CalcularBalanceComprobacionParams {
  empresa_id: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  moneda?: string;
}

const COLUMNAS_CUENTA =
  "id,creado_at,actualizado_at,empresa_id,codigo,nombre,tipo,subtipo,naturaleza,cuenta_padre_id,permite_movimientos,descripcion,activo,metadatos";
const COLUMNAS_PERIODO =
  "id,creado_at,actualizado_at,empresa_id,anio,mes,fecha_inicio,fecha_fin,estado,cerrado_por,cerrado_at,metadatos";
const COLUMNAS_ASIENTO =
  "id,creado_at,actualizado_at,empresa_id,periodo_id,fecha,descripcion,origen_modulo,entidad_tipo,entidad_id,estado,moneda_base,total_debe,total_haber,creado_por,anulado_por,anulado_at,motivo_anulacion,metadatos";
const COLUMNAS_DETALLE =
  "id,creado_at,asiento_id,cuenta_id,descripcion,debe,haber,moneda,tipo_cambio,monto_base";
const COLUMNAS_ASIENTO_CON_DETALLE = `${COLUMNAS_ASIENTO},movimientos_contables_detalle(${COLUMNAS_DETALLE})`;
const COLUMNAS_DOCUMENTO_REVISION =
  "id,creado_at,actualizado_at,empresa_id,proveedor_id,cliente_id,tipo_documento,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,subtotal,iva,isr,total,descripcion,estado,creado_por,revisado_por,contabilizado_por,revisado_at,contabilizado_at,observacion,metadatos";
const LIMITE_PREDETERMINADO = 200;
const LIMITE_MAXIMO = 1000;
const TOLERANCIA_BALANCE = 0.005;
const MONEDAS_PERMITIDAS = ["GTQ", "USD"];
const ESTADOS_DOCUMENTO_CONTABLE: EstadoDocumentoContable[] = [
  "Pendiente",
  "En revision",
  "Observado",
  "Contabilizado",
  "Rechazado",
  "Vencido",
];

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

function texto(valor?: string | null) {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function requerirTexto(valor: string, campo: string) {
  const limpio = texto(valor);
  if (!limpio) {
    throw new Error(`El campo ${campo} es obligatorio para Contabilidad V2.`);
  }
  return limpio;
}

function validarEmpresaId(empresaId: number) {
  if (!Number.isInteger(Number(empresaId)) || Number(empresaId) <= 0) {
    throw new Error("Debe indicar una empresa valida para Contabilidad V2.");
  }
  return Number(empresaId);
}

function validarFecha(valor: string, campo = "fecha") {
  const fecha = requerirTexto(valor, campo);
  if (Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
    throw new Error(`El campo ${campo} debe ser una fecha valida.`);
  }
  return fecha;
}

function normalizarMoneda(valor?: string | null) {
  const moneda = (valor || "GTQ").trim().toUpperCase() || "GTQ";
  if (!MONEDAS_PERMITIDAS.includes(moneda)) {
    throw new Error("La moneda contable debe ser GTQ o USD.");
  }
  return moneda;
}

function numero(valor: number | undefined | null) {
  const resultado = Number(valor || 0);
  if (!Number.isFinite(resultado)) {
    throw new Error("Los montos contables deben ser numeros validos.");
  }
  return Math.round(resultado * 100) / 100;
}

function resolverLimite(limite?: number) {
  if (limite === undefined) return LIMITE_PREDETERMINADO;
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error("El limite debe ser un numero entero positivo.");
  }
  return Math.min(limite, LIMITE_MAXIMO);
}

function validarNaturaleza(naturaleza: string) {
  const normalizada = naturaleza.trim().toLowerCase();
  if (normalizada !== "deudora" && normalizada !== "acreedora") {
    throw new Error("La naturaleza debe ser deudora o acreedora.");
  }
  return normalizada as NaturalezaCuenta;
}

function rangoPeriodo(fechaTexto: string) {
  const fecha = new Date(`${fechaTexto}T12:00:00`);
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0);

  return {
    anio,
    mes,
    fecha_inicio: inicio.toISOString().slice(0, 10),
    fecha_fin: fin.toISOString().slice(0, 10),
  };
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
    throw new Error("No hay usuario autenticado para Contabilidad V2.");
  }

  return user.id;
}

async function auditarSinBloquear(params: RegistrarAuditoriaEventoParams) {
  try {
    await registrarAuditoriaEvento(params);
  } catch (error) {
    console.error("La operacion de Contabilidad V2 se completo, pero fallo la auditoria:", error);
  }
}

function normalizarCuenta(data: unknown) {
  return data as CatalogoCuenta;
}

function normalizarPeriodo(data: unknown) {
  return data as PeriodoContable;
}

function normalizarAsiento(data: unknown) {
  return data as AsientoContable;
}

function normalizarDocumentoRevision(data: unknown) {
  return data as DocumentoContableRevision;
}

function validarEstadoDocumentoContable(estado: string) {
  if (!ESTADOS_DOCUMENTO_CONTABLE.includes(estado as EstadoDocumentoContable)) {
    throw new Error("Estado de documento contable no valido.");
  }

  return estado as EstadoDocumentoContable;
}

function validarMontoNoNegativo(valor: number | undefined | null, campo: string) {
  const monto = numero(valor);
  if (monto < 0) {
    throw new Error(`El campo ${campo} no puede ser negativo.`);
  }

  return monto;
}

export function documentoContableRequiereAlerta24h(
  documento: Pick<DocumentoContableRevision, "creado_at" | "revisado_at" | "estado">
) {
  if (!documento.creado_at || documento.revisado_at) return false;
  if (!["Pendiente", "En revision", "Observado", "Vencido"].includes(documento.estado)) {
    return false;
  }

  const creadoAt = new Date(documento.creado_at).getTime();
  if (Number.isNaN(creadoAt)) return false;

  return Date.now() - creadoAt >= 24 * 60 * 60 * 1000;
}

async function validarCuentasDetalle(
  empresaId: number,
  cuentaIds: Array<string | number>
) {
  const idsUnicos = Array.from(new Set(cuentaIds.map((id) => String(id))));

  const { data, error } = await supabase
    .from("catalogo_cuentas")
    .select("id,empresa_id,activo,permite_movimientos")
    .in("id", idsUnicos);

  if (error) {
    throw errorSupabase("No se pudieron validar las cuentas del asiento", error);
  }

  const cuentas = new Map(
    (data || []).map((cuenta) => [String(cuenta.id), cuenta])
  );

  idsUnicos.forEach((cuentaId) => {
    const cuenta = cuentas.get(cuentaId);

    if (!cuenta) {
      throw new Error(`La cuenta ${cuentaId} no existe o no es accesible.`);
    }

    if (cuenta.activo !== true || cuenta.permite_movimientos !== true) {
      throw new Error(`La cuenta ${cuentaId} no permite movimientos.`);
    }

    if (cuenta.empresa_id !== null && Number(cuenta.empresa_id) !== empresaId) {
      throw new Error(
        `La cuenta ${cuentaId} no pertenece a la empresa del asiento.`
      );
    }
  });
}

function validarDetalle(detalles: MovimientoDetalleInput[], monedaBase: string) {
  if (!Array.isArray(detalles) || detalles.length < 2) {
    throw new Error("Un asiento contable debe tener al menos dos lineas de detalle.");
  }

  const lineas = detalles.map((detalle, index) => {
    if (detalle.cuenta_id === null || detalle.cuenta_id === undefined || detalle.cuenta_id === "") {
      throw new Error(`La linea ${index + 1} no tiene cuenta contable.`);
    }

    const debe = numero(detalle.debe);
    const haber = numero(detalle.haber);

    if (debe > 0 && haber > 0) {
      throw new Error(`La linea ${index + 1} no puede tener debe y haber al mismo tiempo.`);
    }

    if (debe <= 0 && haber <= 0) {
      throw new Error(`La linea ${index + 1} debe tener un monto en debe o haber.`);
    }

    const moneda = normalizarMoneda(detalle.moneda);

    if (moneda !== monedaBase) {
      throw new Error(
        `La linea ${index + 1} usa ${moneda}, pero la moneda base del asiento es ${monedaBase}.`
      );
    }

    return {
      cuenta_id: detalle.cuenta_id,
      descripcion: texto(detalle.descripcion),
      debe,
      haber,
      moneda,
      tipo_cambio:
        detalle.tipo_cambio === null || detalle.tipo_cambio === undefined
          ? null
          : numero(detalle.tipo_cambio),
      monto_base:
        detalle.monto_base === null || detalle.monto_base === undefined
          ? null
          : numero(detalle.monto_base),
    };
  });

  const totalDebe = numero(lineas.reduce((total, linea) => total + linea.debe, 0));
  const totalHaber = numero(lineas.reduce((total, linea) => total + linea.haber, 0));

  if (Math.abs(totalDebe - totalHaber) > TOLERANCIA_BALANCE) {
    throw new Error(
      `Asiento desbalanceado. Debe: ${totalDebe.toFixed(2)} Haber: ${totalHaber.toFixed(2)}.`
    );
  }

  return {
    lineas,
    totalDebe,
    totalHaber,
  };
}

export async function listarCatalogoCuentas(
  params: ListarCatalogoCuentasParams = {}
): Promise<CatalogoCuenta[]> {
  let query: any = supabase.from("catalogo_cuentas").select(COLUMNAS_CUENTA);

  const activo = params.activo ?? true;
  query = query.eq("activo", activo);

  if (params.empresa_id !== undefined) {
    const empresaId = validarEmpresaId(params.empresa_id);
    query = params.incluir_globales
      ? query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
      : query.eq("empresa_id", empresaId);
  } else if (params.incluir_globales === false) {
    query = query.not("empresa_id", "is", null);
  }

  if (params.tipo?.trim()) {
    query = query.eq("tipo", params.tipo.trim());
  }

  if (params.texto?.trim()) {
    const busqueda = params.texto.trim().replace(/[,%()"'\\]/g, " ");
    query = query.or(
      ["codigo", "nombre", "tipo", "subtipo"]
        .map((campo) => `${campo}.ilike.%${busqueda}%`)
        .join(",")
    );
  }

  const { data, error } = await query.order("codigo", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudo listar el catalogo de cuentas", error);
  }

  return (data || []) as CatalogoCuenta[];
}

export async function crearCuentaContable(
  params: CrearCuentaContableParams
): Promise<CatalogoCuenta> {
  const codigo = requerirTexto(params.codigo, "codigo");
  const nombre = requerirTexto(params.nombre, "nombre");
  const tipo = requerirTexto(params.tipo, "tipo");
  const naturaleza = validarNaturaleza(params.naturaleza);
  const empresaId =
    params.empresa_id === null || params.empresa_id === undefined
      ? null
      : validarEmpresaId(Number(params.empresa_id));

  const { data, error } = await supabase
    .from("catalogo_cuentas")
    .insert({
      empresa_id: empresaId,
      codigo,
      nombre,
      tipo,
      subtipo: texto(params.subtipo),
      naturaleza,
      cuenta_padre_id: params.cuenta_padre_id ?? null,
      permite_movimientos: params.permite_movimientos ?? true,
      descripcion: texto(params.descripcion),
      activo: true,
      metadatos: params.metadatos ?? null,
      actualizado_at: new Date().toISOString(),
    })
    .select(COLUMNAS_CUENTA)
    .single();

  if (error) {
    throw errorSupabase("No se pudo crear la cuenta contable", error);
  }

  const cuenta = normalizarCuenta(data);

  await auditarSinBloquear({
    empresa_id: cuenta.empresa_id,
    modulo: "contabilidad_v2",
    accion: "crear_cuenta_contable",
    entidad_tipo: "catalogo_cuenta",
    entidad_id: cuenta.id,
    estado_nuevo: "activo",
    descripcion: "Cuenta contable creada",
    sensible: true,
    metadatos: {
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      subtipo: cuenta.subtipo,
      naturaleza: cuenta.naturaleza,
      permite_movimientos: cuenta.permite_movimientos,
    },
  });

  return cuenta;
}

export async function listarPeriodosContables(
  params: ListarPeriodosContablesParams
): Promise<PeriodoContable[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  let query: any = supabase
    .from("periodos_contables")
    .select(COLUMNAS_PERIODO)
    .eq("empresa_id", empresaId);

  if (params.anio !== undefined) {
    query = query.eq("anio", params.anio);
  }

  if (params.estado?.trim()) {
    query = query.eq("estado", params.estado.trim());
  }

  const { data, error } = await query
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });

  if (error) {
    throw errorSupabase("No se pudieron listar periodos contables", error);
  }

  return (data || []) as PeriodoContable[];
}

export async function obtenerOCrearPeriodoContable(
  params: ObtenerOCrearPeriodoContableParams
): Promise<PeriodoContable> {
  const empresaId = validarEmpresaId(params.empresa_id);
  const fecha = validarFecha(params.fecha);
  const periodoCalculado = rangoPeriodo(fecha);

  const { data: existente, error: buscarError } = await supabase
    .from("periodos_contables")
    .select(COLUMNAS_PERIODO)
    .eq("empresa_id", empresaId)
    .eq("anio", periodoCalculado.anio)
    .eq("mes", periodoCalculado.mes)
    .maybeSingle();

  if (buscarError) {
    throw errorSupabase("No se pudo buscar el periodo contable", buscarError);
  }

  if (existente) {
    return normalizarPeriodo(existente);
  }

  const { data, error } = await supabase
    .from("periodos_contables")
    .insert({
      empresa_id: empresaId,
      ...periodoCalculado,
      estado: "abierto",
      actualizado_at: new Date().toISOString(),
    })
    .select(COLUMNAS_PERIODO)
    .single();

  if (error) {
    throw errorSupabase("No se pudo crear el periodo contable", error);
  }

  const periodo = normalizarPeriodo(data);

  await auditarSinBloquear({
    empresa_id: periodo.empresa_id,
    modulo: "contabilidad_v2",
    accion: "crear_periodo_contable",
    entidad_tipo: "periodo_contable",
    entidad_id: periodo.id,
    estado_nuevo: periodo.estado,
    descripcion: "Periodo contable creado",
    sensible: true,
    metadatos: {
      anio: periodo.anio,
      mes: periodo.mes,
      fecha_inicio: periodo.fecha_inicio,
      fecha_fin: periodo.fecha_fin,
    },
  });

  return periodo;
}

export async function crearAsientoContable(
  params: CrearAsientoContableParams
): Promise<AsientoContable> {
  const empresaId = validarEmpresaId(params.empresa_id);
  const fecha = validarFecha(params.fecha);
  const descripcion = requerirTexto(params.descripcion, "descripcion");
  const monedaBase = normalizarMoneda(params.moneda_base);
  const { lineas, totalDebe, totalHaber } = validarDetalle(
    params.detalles,
    monedaBase
  );
  await validarCuentasDetalle(
    empresaId,
    lineas.map((linea) => linea.cuenta_id)
  );
  const periodo = await obtenerOCrearPeriodoContable({ empresa_id: empresaId, fecha });

  if (periodo.estado !== "abierto") {
    throw new Error("No se pueden crear asientos en un periodo contable cerrado o bloqueado.");
  }

  const userId = await obtenerUsuarioIdActual();
  let asientoId: string | number | null = null;

  try {
    const { data: asientoCreado, error: asientoError } = await supabase
      .from("asientos_contables")
      .insert({
        empresa_id: empresaId,
        periodo_id: periodo.id,
        fecha,
        descripcion,
        origen_modulo: texto(params.origen_modulo),
        entidad_tipo: texto(params.entidad_tipo),
        entidad_id: params.entidad_id ?? null,
        estado: "registrado",
        moneda_base: monedaBase,
        total_debe: totalDebe,
        total_haber: totalHaber,
        creado_por: userId,
        metadatos: params.metadatos ?? null,
        actualizado_at: new Date().toISOString(),
      })
      .select(COLUMNAS_ASIENTO)
      .single();

    if (asientoError) {
      throw errorSupabase("No se pudo crear el asiento contable", asientoError);
    }

    const asiento = normalizarAsiento(asientoCreado);
    asientoId = asiento.id;

    const detallesInsert = lineas.map((linea) => ({
      asiento_id: asiento.id,
      cuenta_id: linea.cuenta_id,
      descripcion: linea.descripcion,
      debe: linea.debe,
      haber: linea.haber,
      moneda: linea.moneda,
      tipo_cambio: linea.tipo_cambio,
      monto_base: linea.monto_base,
    }));

    const { data: detallesCreados, error: detalleError } = await supabase
      .from("movimientos_contables_detalle")
      .insert(detallesInsert)
      .select(COLUMNAS_DETALLE);

    if (detalleError) {
      await supabase
        .from("asientos_contables")
        .update({
          estado: "requiere_revision",
          actualizado_at: new Date().toISOString(),
          metadatos: {
            ...(params.metadatos && typeof params.metadatos === "object" && !Array.isArray(params.metadatos)
              ? params.metadatos
              : {}),
            etapa_fallida: "insertar_detalle",
            motivo_error: detalleError.message,
          },
        })
        .eq("id", asiento.id);

      await auditarSinBloquear({
        empresa_id: empresaId,
        modulo: "contabilidad_v2",
        accion: "asiento_contable_parcial",
        entidad_tipo: "asiento_contable",
        entidad_id: asiento.id,
        estado_anterior: "registrado",
        estado_nuevo: "requiere_revision",
        descripcion: "Asiento contable quedo parcialmente creado",
        sensible: true,
        metadatos: {
          etapa_fallida: "insertar_detalle",
          motivo_error: detalleError.message,
          total_debe: totalDebe,
          total_haber: totalHaber,
        },
      });

      throw errorSupabase("No se pudo insertar el detalle del asiento contable", detalleError);
    }

    await auditarSinBloquear({
      empresa_id: empresaId,
      modulo: "contabilidad_v2",
      accion: "crear_asiento_contable",
      entidad_tipo: "asiento_contable",
      entidad_id: asiento.id,
      estado_nuevo: asiento.estado,
      descripcion: "Asiento contable creado",
      sensible: true,
      visible_calendario: true,
      metadatos: {
        fecha,
        periodo_id: periodo.id,
        total_debe: totalDebe,
        total_haber: totalHaber,
        lineas: lineas.length,
        origen_modulo: params.origen_modulo ?? null,
        entidad_tipo: params.entidad_tipo ?? null,
        entidad_id: params.entidad_id ?? null,
      },
    });

    return {
      ...asiento,
      movimientos_contables_detalle: (detallesCreados || []) as MovimientoContableDetalle[],
    };
  } catch (error) {
    if (asientoId !== null) {
      console.error("Fallo la creacion completa del asiento contable:", error);
    }

    throw error;
  }
}

export async function listarAsientosContables(
  params: ListarAsientosContablesParams
): Promise<AsientoContable[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  let query: any = supabase
    .from("asientos_contables")
    .select(params.incluir_detalles ? COLUMNAS_ASIENTO_CON_DETALLE : COLUMNAS_ASIENTO)
    .eq("empresa_id", empresaId);

  if (params.fecha_desde?.trim()) {
    query = query.gte("fecha", validarFecha(params.fecha_desde, "fecha_desde"));
  }

  if (params.fecha_hasta?.trim()) {
    query = query.lte("fecha", validarFecha(params.fecha_hasta, "fecha_hasta"));
  }

  if (params.periodo_id !== undefined) {
    query = query.eq("periodo_id", params.periodo_id);
  }

  if (params.estado?.trim()) {
    query = query.eq("estado", params.estado.trim());
  }

  if (params.origen_modulo?.trim()) {
    query = query.eq("origen_modulo", params.origen_modulo.trim());
  }

  if (params.entidad_tipo?.trim()) {
    query = query.eq("entidad_tipo", params.entidad_tipo.trim());
  }

  if (params.entidad_id !== undefined) {
    query = query.eq("entidad_id", params.entidad_id);
  }

  const { data, error } = await query
    .order("fecha", { ascending: false })
    .limit(resolverLimite(params.limite));

  if (error) {
    throw errorSupabase("No se pudieron listar asientos contables", error);
  }

  return (data || []) as AsientoContable[];
}

export async function crearDocumentoContableRevision(
  params: CrearDocumentoContableRevisionParams
): Promise<DocumentoContableRevision> {
  const empresaId = validarEmpresaId(params.empresa_id);
  const tipoDocumento = requerirTexto(params.tipo_documento, "tipo_documento");
  const numeroDocumento = requerirTexto(params.numero_documento, "numero_documento");
  const fechaDocumento = validarFecha(params.fecha_documento, "fecha_documento");
  const fechaVencimiento = params.fecha_vencimiento?.trim()
    ? validarFecha(params.fecha_vencimiento, "fecha_vencimiento")
    : null;
  const moneda = normalizarMoneda(params.moneda);
  const subtotal = validarMontoNoNegativo(params.subtotal, "subtotal");
  const iva = validarMontoNoNegativo(params.iva, "iva");
  const isr = validarMontoNoNegativo(params.isr, "isr");
  const total = validarMontoNoNegativo(params.total, "total");
  const userId = await obtenerUsuarioIdActual();

  if (total <= 0) {
    throw new Error("El total del documento debe ser mayor que cero.");
  }

  const { data, error } = await supabase
    .from("documentos_contables_revision")
    .insert({
      empresa_id: empresaId,
      proveedor_id: params.proveedor_id ?? null,
      cliente_id: params.cliente_id ?? null,
      tipo_documento: tipoDocumento,
      serie: texto(params.serie),
      numero_documento: numeroDocumento,
      fecha_documento: fechaDocumento,
      fecha_vencimiento: fechaVencimiento,
      moneda,
      subtotal,
      iva,
      isr,
      total,
      descripcion: texto(params.descripcion),
      estado: "Pendiente",
      creado_por: userId,
      metadatos: {
        ...(params.metadatos && typeof params.metadatos === "object" && !Array.isArray(params.metadatos)
          ? params.metadatos
          : {}),
        preparado_para_distribucion_contable: false,
        requiere_adjunto_antes_contabilizar: true,
      },
      actualizado_at: new Date().toISOString(),
    })
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .single();

  if (error) {
    throw errorSupabase("No se pudo registrar el documento para revision", error);
  }

  const documento = normalizarDocumentoRevision(data);

  await auditarSinBloquear({
    empresa_id: documento.empresa_id,
    modulo: "contabilidad_v2",
    accion: "registrar_documento_revision",
    entidad_tipo: "documento_contable_revision",
    entidad_id: documento.id,
    estado_nuevo: documento.estado,
    descripcion: "Documento contable registrado para revision",
    sensible: true,
    visible_calendario: true,
    metadatos: {
      tipo_documento: documento.tipo_documento,
      serie: documento.serie,
      numero_documento: documento.numero_documento,
      fecha_documento: documento.fecha_documento,
      fecha_vencimiento: documento.fecha_vencimiento,
      moneda: documento.moneda,
      total: documento.total,
    },
  });

  return documento;
}

export async function listarDocumentosContablesRevision(
  params: ListarDocumentosContablesRevisionParams
): Promise<DocumentoContableRevision[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  let query: any = supabase
    .from("documentos_contables_revision")
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .eq("empresa_id", empresaId);

  if (params.estado?.trim()) {
    query = query.eq("estado", validarEstadoDocumentoContable(params.estado));
  }

  const { data, error } = await query
    .order("creado_at", { ascending: false })
    .limit(resolverLimite(params.limite));

  if (error) {
    throw errorSupabase("No se pudieron listar documentos para revision", error);
  }

  return (data || []) as DocumentoContableRevision[];
}

async function contarAdjuntosDocumentoContable(
  documento: DocumentoContableRevision
) {
  const { count, error } = await supabase
    .from("documentos_tramites")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", documento.empresa_id)
    .eq("modulo", "contabilidad")
    .eq("entidad_tipo", "documento_contable_revision")
    .eq("entidad_id", documento.id)
    .eq("estado", "activo");

  if (error) {
    throw errorSupabase("No se pudieron validar adjuntos del documento", error);
  }

  return count || 0;
}

export async function cambiarEstadoDocumentoContable(
  params: CambiarEstadoDocumentoContableParams
): Promise<DocumentoContableRevision> {
  if (params.id === "" || params.id === null || params.id === undefined) {
    throw new Error("Debe indicar el documento contable.");
  }

  const empresaId = validarEmpresaId(params.empresa_id);
  const estadoNuevo = validarEstadoDocumentoContable(params.estado);
  const observacion = texto(params.observacion);
  const userId = await obtenerUsuarioIdActual();

  const { data: actual, error: actualError } = await supabase
    .from("documentos_contables_revision")
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .eq("id", params.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (actualError) {
    throw errorSupabase("No se pudo cargar el documento para revision", actualError);
  }

  if (!actual) {
    throw new Error("No se encontro el documento contable en la empresa indicada.");
  }

  const documentoActual = normalizarDocumentoRevision(actual);

  if (["Contabilizado", "Rechazado"].includes(documentoActual.estado)) {
    throw new Error("El documento ya esta cerrado y no puede cambiar de estado.");
  }

  if (estadoNuevo === "Contabilizado") {
    const adjuntos = await contarAdjuntosDocumentoContable(documentoActual);
    if (adjuntos <= 0) {
      throw new Error("Debe existir al menos un documento adjunto antes de contabilizar.");
    }
  }

  if (["Observado", "Rechazado"].includes(estadoNuevo) && !observacion) {
    throw new Error("Debe indicar una observacion para observar o rechazar.");
  }

  const ahora = new Date().toISOString();
  const cambios = {
    estado: estadoNuevo,
    observacion,
    actualizado_at: ahora,
    ...(estadoNuevo === "En revision" ||
    estadoNuevo === "Observado" ||
    estadoNuevo === "Rechazado"
      ? { revisado_por: userId, revisado_at: ahora }
      : {}),
    ...(estadoNuevo === "Contabilizado"
      ? {
          contabilizado_por: userId,
          contabilizado_at: ahora,
          revisado_por: documentoActual.revisado_por || userId,
          revisado_at: documentoActual.revisado_at || ahora,
          metadatos: {
            ...(documentoActual.metadatos &&
            typeof documentoActual.metadatos === "object" &&
            !Array.isArray(documentoActual.metadatos)
              ? documentoActual.metadatos
              : {}),
            preparado_para_distribucion_contable: true,
            asiento_automatico_creado: false,
            requiere_distribucion_balanceada: true,
          },
        }
      : {}),
  };

  const { data, error } = await supabase
    .from("documentos_contables_revision")
    .update(cambios)
    .eq("id", params.id)
    .eq("empresa_id", empresaId)
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .single();

  if (error) {
    throw errorSupabase("No se pudo actualizar el estado del documento", error);
  }

  const documento = normalizarDocumentoRevision(data);

  await auditarSinBloquear({
    empresa_id: documento.empresa_id,
    modulo: "contabilidad_v2",
    accion:
      estadoNuevo === "Contabilizado"
        ? "marcar_documento_contabilizado"
        : "cambiar_estado_documento_revision",
    entidad_tipo: "documento_contable_revision",
    entidad_id: documento.id,
    estado_anterior: documentoActual.estado,
    estado_nuevo: documento.estado,
    motivo: observacion,
    descripcion: "Documento contable actualizado en flujo de revision",
    sensible: true,
    visible_calendario: estadoNuevo !== "Contabilizado",
    metadatos: {
      numero_documento: documento.numero_documento,
      moneda: documento.moneda,
      total: documento.total,
      asiento_automatico_creado: false,
    },
  });

  return documento;
}

export async function corregirDocumentoContableRevision(
  params: CorregirDocumentoContableRevisionParams
): Promise<DocumentoContableRevision> {
  if (params.id === "" || params.id === null || params.id === undefined) {
    throw new Error("Debe indicar el documento contable que desea corregir.");
  }

  const empresaId = validarEmpresaId(params.empresa_id);
  const observacion = requerirTexto(params.observacion, "observacion");
  const userId = await obtenerUsuarioIdActual();

  const { data: actual, error: actualError } = await supabase
    .from("documentos_contables_revision")
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .eq("id", params.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (actualError) {
    throw errorSupabase("No se pudo cargar el documento para corregir", actualError);
  }

  if (!actual) {
    throw new Error("No se encontro el documento contable en la empresa indicada.");
  }

  const documentoActual = normalizarDocumentoRevision(actual);

  if (["Contabilizado", "Rechazado"].includes(documentoActual.estado)) {
    throw new Error("El documento ya esta cerrado y no puede corregirse.");
  }

  const cambios: Record<string, unknown> = {
    actualizado_at: new Date().toISOString(),
    revisado_por: userId,
    revisado_at: new Date().toISOString(),
    observacion,
    estado: "En revision",
  };

  if (params.serie !== undefined) cambios.serie = texto(params.serie);
  if (params.numero_documento !== undefined) {
    cambios.numero_documento = requerirTexto(
      params.numero_documento,
      "numero_documento"
    );
  }
  if (params.fecha_documento !== undefined) {
    cambios.fecha_documento = validarFecha(params.fecha_documento, "fecha_documento");
  }
  if (params.fecha_vencimiento !== undefined) {
    cambios.fecha_vencimiento = params.fecha_vencimiento?.trim()
      ? validarFecha(params.fecha_vencimiento, "fecha_vencimiento")
      : null;
  }
  if (params.moneda !== undefined) cambios.moneda = normalizarMoneda(params.moneda);
  if (params.subtotal !== undefined) {
    cambios.subtotal = validarMontoNoNegativo(params.subtotal, "subtotal");
  }
  if (params.iva !== undefined) {
    cambios.iva = validarMontoNoNegativo(params.iva, "iva");
  }
  if (params.isr !== undefined) {
    cambios.isr = validarMontoNoNegativo(params.isr, "isr");
  }
  if (params.total !== undefined) {
    const total = validarMontoNoNegativo(params.total, "total");
    if (total <= 0) throw new Error("El total del documento debe ser mayor que cero.");
    cambios.total = total;
  }
  if (params.descripcion !== undefined) {
    cambios.descripcion = texto(params.descripcion);
  }

  const { data, error } = await supabase
    .from("documentos_contables_revision")
    .update(cambios)
    .eq("id", params.id)
    .eq("empresa_id", empresaId)
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .single();

  if (error) {
    throw errorSupabase("No se pudo corregir el documento contable", error);
  }

  const documento = normalizarDocumentoRevision(data);

  await auditarSinBloquear({
    empresa_id: documento.empresa_id,
    modulo: "contabilidad_v2",
    accion: "corregir_documento_revision",
    entidad_tipo: "documento_contable_revision",
    entidad_id: documento.id,
    estado_anterior: documentoActual.estado,
    estado_nuevo: documento.estado,
    motivo: observacion,
    descripcion: "Documento contable corregido durante revision",
    sensible: true,
    visible_calendario: true,
    metadatos: {
      numero_documento_anterior: documentoActual.numero_documento,
      numero_documento_nuevo: documento.numero_documento,
      total_anterior: documentoActual.total,
      total_nuevo: documento.total,
      asiento_automatico_creado: false,
    },
  });

  return documento;
}

export async function anularAsientoContable(
  id: string | number,
  motivo: string
): Promise<AsientoContable> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el asiento contable que desea anular.");
  }

  const motivoAnulacion = requerirTexto(motivo, "motivo");
  const userId = await obtenerUsuarioIdActual();

  const { data: asientoActual, error: asientoError } = await supabase
    .from("asientos_contables")
    .select(`${COLUMNAS_ASIENTO},periodos_contables(estado)`)
    .eq("id", id)
    .maybeSingle();

  if (asientoError) {
    throw errorSupabase("No se pudo cargar el asiento contable", asientoError);
  }

  if (!asientoActual) {
    throw new Error("No se encontro un asiento contable accesible con ese id.");
  }

  const asiento = asientoActual as AsientoContable & {
    periodos_contables?: { estado?: string | null } | null;
  };

  if (asiento.periodos_contables?.estado && asiento.periodos_contables.estado !== "abierto") {
    throw new Error("No se puede anular un asiento de un periodo cerrado o bloqueado.");
  }

  const { data, error } = await supabase
    .from("asientos_contables")
    .update({
      estado: "anulado",
      anulado_por: userId,
      anulado_at: new Date().toISOString(),
      motivo_anulacion: motivoAnulacion,
      actualizado_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLUMNAS_ASIENTO)
    .single();

  if (error) {
    throw errorSupabase("No se pudo anular el asiento contable", error);
  }

  const asientoAnulado = normalizarAsiento(data);

  await auditarSinBloquear({
    empresa_id: asientoAnulado.empresa_id,
    modulo: "contabilidad_v2",
    accion: "anular_asiento_contable",
    entidad_tipo: "asiento_contable",
    entidad_id: asientoAnulado.id,
    estado_anterior: asiento.estado,
    estado_nuevo: "anulado",
    motivo: motivoAnulacion,
    descripcion: "Asiento contable anulado",
    sensible: true,
    metadatos: {
      fecha: asientoAnulado.fecha,
      periodo_id: asientoAnulado.periodo_id,
      total_debe: asientoAnulado.total_debe,
      total_haber: asientoAnulado.total_haber,
    },
  });

  return asientoAnulado;
}

export async function calcularBalanceComprobacion(
  params: CalcularBalanceComprobacionParams
): Promise<BalanceComprobacionFila[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  let query: any = supabase
    .from("asientos_contables")
    .select(
      `${COLUMNAS_ASIENTO},movimientos_contables_detalle(id,cuenta_id,debe,haber,moneda,catalogo_cuentas(codigo,nombre,tipo,naturaleza))`
    )
    .eq("empresa_id", empresaId)
    .eq("estado", "registrado");

  if (params.fecha_desde?.trim()) {
    query = query.gte("fecha", validarFecha(params.fecha_desde, "fecha_desde"));
  }

  if (params.fecha_hasta?.trim()) {
    query = query.lte("fecha", validarFecha(params.fecha_hasta, "fecha_hasta"));
  }

  const { data, error } = await query.order("fecha", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudo calcular el balance de comprobacion", error);
  }

  const moneda = params.moneda?.trim().toUpperCase();
  const acumulado = new Map<string, BalanceComprobacionFila>();

  ((data || []) as AsientoContable[]).forEach((asiento) => {
    (asiento.movimientos_contables_detalle || []).forEach((detalle) => {
      if (moneda && normalizarMoneda(detalle.moneda) !== moneda) return;

      const cuenta = detalle.catalogo_cuentas;
      const key = String(detalle.cuenta_id);
      const actual =
        acumulado.get(key) ||
        ({
          cuenta_id: detalle.cuenta_id,
          codigo: cuenta?.codigo || key,
          nombre: cuenta?.nombre || "Cuenta sin nombre",
          tipo: cuenta?.tipo || "sin_tipo",
          naturaleza: cuenta?.naturaleza || "deudora",
          debe: 0,
          haber: 0,
          saldo: 0,
        } satisfies BalanceComprobacionFila);

      actual.debe = numero(actual.debe + numero(detalle.debe));
      actual.haber = numero(actual.haber + numero(detalle.haber));
      actual.saldo =
        actual.naturaleza === "acreedora"
          ? numero(actual.haber - actual.debe)
          : numero(actual.debe - actual.haber);

      acumulado.set(key, actual);
    });
  });

  return Array.from(acumulado.values()).sort((a, b) =>
    a.codigo.localeCompare(b.codigo)
  );
}
