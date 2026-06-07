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

export interface DistribucionDocumentoContable {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  documento_contable_id: string | number;
  cuenta_id: string | number;
  descripcion: string | null;
  debito: number;
  credito: number;
  moneda: string;
  activo: boolean;
  creado_por: string | null;
  metadatos: ValorJsonAuditoria | null;
  catalogo_cuentas?: Pick<CatalogoCuenta, "codigo" | "nombre" | "tipo" | "naturaleza"> | null;
}

export type TipoImpuestoConfiguracion =
  | "IVA"
  | "ISR"
  | "Retencion"
  | "Exento"
  | "Otro";

export interface ImpuestoConfiguracion {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  impuesto_id: string | null;
  nombre: string;
  tipo: TipoImpuestoConfiguracion | string;
  porcentaje: number;
  cuenta_contable_id: string | number | null;
  aplica_compra: boolean;
  aplica_venta: boolean;
  proveedor_id: string | number | null;
  cliente_id: string | number | null;
  activo: boolean;
  observaciones: string | null;
  creado_por: string | null;
  actualizado_por: string | null;
  metadatos: ValorJsonAuditoria | null;
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
  idempotency_key?: string | null;
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

export interface LineaDistribucionDocumentoInput {
  cuenta_id: string | number;
  descripcion?: string | null;
  debito?: number;
  credito?: number;
  moneda?: string;
}

export interface GuardarDistribucionDocumentoContableParams {
  empresa_id: number;
  documento_contable_id: string | number;
  lineas: LineaDistribucionDocumentoInput[];
  motivo?: string | null;
}

export interface ListarDistribucionDocumentoContableParams {
  empresa_id: number;
  documento_contable_id?: string | number;
}

export interface GuardarImpuestoConfiguracionParams {
  id?: string | number;
  empresa_id: number;
  impuesto_id?: string | null;
  nombre: string;
  tipo: TipoImpuestoConfiguracion | string;
  porcentaje: number;
  cuenta_contable_id?: string | number | null;
  aplica_compra?: boolean;
  aplica_venta?: boolean;
  proveedor_id?: string | number | null;
  cliente_id?: string | number | null;
  activo?: boolean;
  observaciones?: string | null;
  metadatos?: ValorJsonAuditoria | null;
}

export interface ListarImpuestosConfiguracionParams {
  empresa_id: number;
  activo?: boolean;
}

export interface CalcularBalanceComprobacionParams {
  empresa_id: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  moneda?: string;
}

export interface PrevisualizarCierreMensualParams {
  empresa_id: number;
  periodo_id: string | number;
  empresas_permitidas?: number[];
}

export interface CerrarPeriodoContableParams extends PrevisualizarCierreMensualParams {
  observaciones?: string | null;
}

export interface HallazgoCierreMensual {
  codigo: string;
  mensaje: string;
  cantidad: number;
  detalle?: ValorJsonAuditoria;
}

export interface ResumenMonedaCierre {
  moneda: string;
  debe: number;
  haber: number;
  diferencia: number;
  asientos: number;
}

export interface PrevisualizacionCierreMensual {
  periodo: PeriodoContable;
  puede_cerrar: boolean;
  bloqueos: HallazgoCierreMensual[];
  advertencias: HallazgoCierreMensual[];
  resumen: {
    empresa_id: number;
    periodo_id: string | number;
    anio: number;
    mes: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado_periodo: string;
    asientos_registrados: number;
    asientos_borrador: number;
    asientos_requiere_revision: number;
    asientos_pendientes: number;
    documentos_pendientes: number;
    documentos_observados: number;
    documentos_vencidos: number;
    total_debe: number;
    total_haber: number;
    diferencia: number;
    balanceado: boolean;
    cxp_vencidas: number;
    cxc_vencidas: number;
    monedas: ResumenMonedaCierre[];
    cierre_automatico_asientos: false;
  };
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
const COLUMNAS_DISTRIBUCION_DOCUMENTO =
  "id,creado_at,actualizado_at,empresa_id,documento_contable_id,cuenta_id,descripcion,debito,credito,moneda,activo,creado_por,metadatos";
const COLUMNAS_DISTRIBUCION_CON_CUENTA = `${COLUMNAS_DISTRIBUCION_DOCUMENTO},catalogo_cuentas(codigo,nombre,tipo,naturaleza)`;
const COLUMNAS_IMPUESTO_CONFIGURACION =
  "id,creado_at,actualizado_at,empresa_id,impuesto_id,nombre,tipo,porcentaje,cuenta_contable_id,aplica_compra,aplica_venta,proveedor_id,cliente_id,activo,observaciones,creado_por,actualizado_por,metadatos";
const COLUMNAS_IMPUESTO_CON_CUENTA = `${COLUMNAS_IMPUESTO_CONFIGURACION},catalogo_cuentas(codigo,nombre,tipo,naturaleza)`;
const LIMITE_PREDETERMINADO = 200;
const LIMITE_MAXIMO = 1000;
const TOLERANCIA_BALANCE = 0.005;
const MONEDAS_PERMITIDAS = ["GTQ", "USD"];
const IDEMPOTENCY_PREFIX_ASIENTOS = "controlplus_idempotency_contabilidad";
const ESTADOS_DOCUMENTO_CONTABLE: EstadoDocumentoContable[] = [
  "Pendiente",
  "En revision",
  "Observado",
  "Contabilizado",
  "Rechazado",
  "Vencido",
];
const TIPOS_IMPUESTO_CONFIGURACION: TipoImpuestoConfiguracion[] = [
  "IVA",
  "ISR",
  "Retencion",
  "Exento",
  "Otro",
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
    throw new Error(`El campo ${campo} es obligatorio para Contabilidad formal.`);
  }
  return limpio;
}

function validarEmpresaId(empresaId: number) {
  if (!Number.isInteger(Number(empresaId)) || Number(empresaId) <= 0) {
    throw new Error("Debe indicar una empresa valida para Contabilidad formal.");
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

function generarUuidSeguro() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hashSimple(valor: string) {
  let hash = 0;

  for (let index = 0; index < valor.length; index += 1) {
    hash = (hash * 31 + valor.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function obtenerIdempotencyKeyAsiento(
  params: CrearAsientoContableParams,
  periodoId: string | number,
  lineas: ReturnType<typeof validarDetalle>["lineas"]
) {
  if (params.idempotency_key?.trim()) return params.idempotency_key.trim();

  const scope = [
    params.empresa_id,
    periodoId,
    params.fecha,
    params.descripcion,
    params.moneda_base || "GTQ",
    params.origen_modulo || "contabilidad",
    params.entidad_tipo || "asiento_manual",
    JSON.stringify(
      lineas.map((linea) => ({
        cuenta_id: String(linea.cuenta_id),
        descripcion: linea.descripcion || "",
        debe: linea.debe,
        haber: linea.haber,
        moneda: linea.moneda,
        tipo_cambio: linea.tipo_cambio,
        monto_base: linea.monto_base,
      }))
    ),
  ].join("|");

  const storageKey = `${IDEMPOTENCY_PREFIX_ASIENTOS}:registrar_asiento_completo:${hashSimple(scope)}`;

  if (typeof window === "undefined") {
    return `${storageKey}:${generarUuidSeguro()}`;
  }

  const existente = window.localStorage.getItem(storageKey);
  if (existente) return existente;

  const nueva = `${storageKey}:${generarUuidSeguro()}`;
  window.localStorage.setItem(storageKey, nueva);
  return nueva;
}

function liberarIdempotencyKeyAsiento(key: string) {
  if (typeof window === "undefined") return;
  const partes = key.split(":");
  if (partes.length < 4) return;
  const storageKey = partes.slice(0, -1).join(":");
  window.localStorage.removeItem(storageKey);
}

function obtenerIdempotencyKeyFinalizarAsiento(
  asientoId: string | number,
  empresaId: number
) {
  const storageKey = `${IDEMPOTENCY_PREFIX_ASIENTOS}:finalizar_asiento_contable:${hashSimple(
    `${empresaId}|${asientoId}`
  )}`;

  if (typeof window === "undefined") {
    return `${storageKey}:${generarUuidSeguro()}`;
  }

  const existente = window.localStorage.getItem(storageKey);
  if (existente) return existente;

  const nueva = `${storageKey}:${generarUuidSeguro()}`;
  window.localStorage.setItem(storageKey, nueva);
  return nueva;
}

function obtenerIdempotencyKeyOperacion(
  accion: string,
  empresaId: number,
  entidadId: string | number,
  alcanceAdicional = ""
) {
  const storageKey = `${IDEMPOTENCY_PREFIX_ASIENTOS}:${accion}:${hashSimple(
    `${empresaId}|${entidadId}|${alcanceAdicional}`
  )}`;

  if (typeof window === "undefined") {
    return `${storageKey}:${generarUuidSeguro()}`;
  }

  const existente = window.localStorage.getItem(storageKey);
  if (existente) return existente;

  const nueva = `${storageKey}:${generarUuidSeguro()}`;
  window.localStorage.setItem(storageKey, nueva);
  return nueva;
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
    throw new Error("No hay usuario autenticado para Contabilidad formal.");
  }

  return user.id;
}

async function auditarSinBloquear(params: RegistrarAuditoriaEventoParams) {
  try {
    await registrarAuditoriaEvento(params);
  } catch (error) {
    console.error("La operacion de Contabilidad formal se completo, pero fallo la auditoria:", error);
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

function normalizarDistribucionDocumento(data: unknown) {
  return data as DistribucionDocumentoContable;
}

function normalizarImpuestoConfiguracion(data: unknown) {
  return data as ImpuestoConfiguracion;
}

function validarEmpresaPermitidaOpcional(empresaId: number, empresasPermitidas?: number[]) {
  const permitidas = (empresasPermitidas || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (permitidas.length && !permitidas.includes(empresaId)) {
    throw new Error("No tienes permiso para operar sobre la empresa del periodo.");
  }
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

function validarTipoImpuestoConfiguracion(tipo: string) {
  const limpio = requerirTexto(tipo, "tipo");
  if (!TIPOS_IMPUESTO_CONFIGURACION.includes(limpio as TipoImpuestoConfiguracion)) {
    throw new Error("Tipo de impuesto no valido.");
  }

  return limpio as TipoImpuestoConfiguracion;
}

function validarPorcentajeImpuesto(valor: number) {
  const porcentaje = numero(valor);
  if (porcentaje < 0 || porcentaje > 100) {
    throw new Error("El porcentaje de impuesto debe estar entre 0 y 100.");
  }

  return porcentaje;
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

async function validarCuentaImpuestoOpcional(
  empresaId: number,
  cuentaId?: string | number | null
) {
  if (cuentaId === null || cuentaId === undefined || cuentaId === "") {
    return null;
  }

  const { data, error } = await supabase
    .from("catalogo_cuentas")
    .select("id,empresa_id,activo,permite_movimientos")
    .eq("id", cuentaId)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo validar la cuenta fiscal", error);
  }

  if (!data) {
    throw new Error("La cuenta fiscal no existe o no es accesible.");
  }

  if (data.activo !== true) {
    throw new Error("La cuenta fiscal esta inactiva.");
  }

  if (data.permite_movimientos !== true) {
    throw new Error("La cuenta fiscal no permite movimientos.");
  }

  if (data.empresa_id !== null && Number(data.empresa_id) !== empresaId) {
    throw new Error("La cuenta fiscal no pertenece a la empresa indicada.");
  }

  return cuentaId;
}

async function validarLineasDistribucionDocumento(
  documento: DocumentoContableRevision,
  lineasInput: LineaDistribucionDocumentoInput[]
) {
  if (!Array.isArray(lineasInput) || lineasInput.length < 2) {
    throw new Error("La distribucion debe tener al menos dos lineas.");
  }

  const empresaId = validarEmpresaId(documento.empresa_id);
  const monedaDocumento = normalizarMoneda(documento.moneda);
  const lineas = lineasInput.map((linea, index) => {
    if (linea.cuenta_id === null || linea.cuenta_id === undefined || linea.cuenta_id === "") {
      throw new Error(`La linea ${index + 1} no tiene cuenta contable.`);
    }

    const debito = numero(linea.debito);
    const credito = numero(linea.credito);

    if (debito > 0 && credito > 0) {
      throw new Error(`La linea ${index + 1} no puede tener debito y credito al mismo tiempo.`);
    }

    if (debito <= 0 && credito <= 0) {
      throw new Error(`La linea ${index + 1} debe tener debito o credito.`);
    }

    const moneda = normalizarMoneda(linea.moneda);
    if (moneda !== monedaDocumento) {
      throw new Error(
        `La linea ${index + 1} usa ${moneda}, pero el documento esta en ${monedaDocumento}.`
      );
    }

    return {
      cuenta_id: linea.cuenta_id,
      descripcion: texto(linea.descripcion),
      debito,
      credito,
      moneda,
    };
  });

  const cuentaIds = Array.from(new Set(lineas.map((linea) => String(linea.cuenta_id))));
  const { data, error } = await supabase
    .from("catalogo_cuentas")
    .select("id,empresa_id,activo,permite_movimientos")
    .in("id", cuentaIds);

  if (error) {
    throw errorSupabase("No se pudieron validar cuentas de distribucion", error);
  }

  const cuentas = new Map((data || []).map((cuenta) => [String(cuenta.id), cuenta]));

  cuentaIds.forEach((cuentaId) => {
    const cuenta = cuentas.get(cuentaId);

    if (!cuenta) {
      throw new Error(`La cuenta ${cuentaId} no existe o no es accesible.`);
    }

    if (cuenta.activo !== true) {
      throw new Error(`La cuenta ${cuentaId} esta inactiva.`);
    }

    if (cuenta.permite_movimientos !== true) {
      throw new Error(`La cuenta ${cuentaId} no permite movimientos.`);
    }

    if (cuenta.empresa_id !== null && Number(cuenta.empresa_id) !== empresaId) {
      throw new Error(`La cuenta ${cuentaId} no pertenece a la empresa del documento.`);
    }
  });

  const totalDebito = numero(lineas.reduce((total, linea) => total + linea.debito, 0));
  const totalCredito = numero(lineas.reduce((total, linea) => total + linea.credito, 0));

  if (Math.abs(totalDebito - totalCredito) > TOLERANCIA_BALANCE) {
    throw new Error(
      `Distribucion descuadrada. Debito: ${totalDebito.toFixed(2)} Credito: ${totalCredito.toFixed(2)}.`
    );
  }

  return {
    lineas,
    totalDebito,
    totalCredito,
    moneda: monedaDocumento,
  };
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
    modulo: "contabilidad",
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
    modulo: "contabilidad",
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
  const idempotencyKey = obtenerIdempotencyKeyAsiento(params, periodo.id, lineas);
  const tipoAsiento = texto(params.entidad_tipo) || "asiento_manual";

  const { data, error } = await supabase.rpc("registrar_asiento_completo", {
    p_empresa_id: empresaId,
    p_periodo_id: periodo.id,
    p_fecha: fecha,
    p_descripcion: descripcion,
    p_moneda: monedaBase,
    p_tipo: tipoAsiento,
    p_lineas: lineas,
    p_creado_por: userId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw errorSupabase("No se pudo registrar el asiento contable completo", error);
  }

  const resultado = data as
    | {
        ok?: boolean;
        mensaje?: string;
        asiento?: AsientoContable;
        movimientos_contables_detalle?: MovimientoContableDetalle[];
        idempotency_replay?: boolean;
      }
    | null;

  if (!resultado || resultado.ok === false) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw new Error(
      resultado?.mensaje || "No se pudo registrar el asiento contable completo."
    );
  }

  if (!resultado.asiento) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw new Error("La RPC no devolvio el asiento contable creado.");
  }

  liberarIdempotencyKeyAsiento(idempotencyKey);
  return normalizarAsiento(resultado.asiento);
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
    modulo: "contabilidad",
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

export async function listarDistribucionDocumentoContable(
  params: ListarDistribucionDocumentoContableParams
): Promise<DistribucionDocumentoContable[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  let query: any = supabase
    .from("distribuciones_documentos_contables")
    .select(COLUMNAS_DISTRIBUCION_CON_CUENTA)
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  if (params.documento_contable_id !== undefined) {
    query = query.eq("documento_contable_id", params.documento_contable_id);
  }

  const { data, error } = await query.order("creado_at", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudo listar la distribucion del documento", error);
  }

  return (data || []) as DistribucionDocumentoContable[];
}

export async function guardarDistribucionDocumentoContable(
  params: GuardarDistribucionDocumentoContableParams
): Promise<DistribucionDocumentoContable[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  if (
    params.documento_contable_id === "" ||
    params.documento_contable_id === null ||
    params.documento_contable_id === undefined
  ) {
    throw new Error("Debe indicar el documento contable para distribuir.");
  }

  const { data: documentoData, error: documentoError } = await supabase
    .from("documentos_contables_revision")
    .select(COLUMNAS_DOCUMENTO_REVISION)
    .eq("id", params.documento_contable_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (documentoError) {
    throw errorSupabase("No se pudo cargar el documento a distribuir", documentoError);
  }

  if (!documentoData) {
    throw new Error("No se encontro el documento contable en la empresa indicada.");
  }

  const documento = normalizarDocumentoRevision(documentoData);
  if (["Contabilizado", "Rechazado"].includes(documento.estado)) {
    throw new Error("El documento ya esta cerrado y no permite cambiar distribucion.");
  }

  const distribucion = await validarLineasDistribucionDocumento(
    documento,
    params.lineas
  );
  const userId = await obtenerUsuarioIdActual();
  const ahora = new Date().toISOString();

  const { data: existentes, error: existentesError } = await supabase
    .from("distribuciones_documentos_contables")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("documento_contable_id", documento.id)
    .eq("activo", true);

  if (existentesError) {
    throw errorSupabase("No se pudo revisar la distribucion existente", existentesError);
  }

  if (existentes?.length) {
    const { error: inactivarError } = await supabase
      .from("distribuciones_documentos_contables")
      .update({
        activo: false,
        actualizado_at: ahora,
        metadatos: {
          reemplazada_por_correccion: true,
          motivo: texto(params.motivo),
        },
      })
      .in("id", existentes.map((item) => item.id));

    if (inactivarError) {
      throw errorSupabase("No se pudo inactivar la distribucion anterior", inactivarError);
    }
  }

  const insert = distribucion.lineas.map((linea) => ({
    empresa_id: empresaId,
    documento_contable_id: documento.id,
    cuenta_id: linea.cuenta_id,
    descripcion: linea.descripcion,
    debito: linea.debito,
    credito: linea.credito,
    moneda: linea.moneda,
    activo: true,
    creado_por: userId,
    actualizado_at: ahora,
    metadatos: {
      origen: "documento_contable_revision",
      asiento_automatico_creado: false,
    },
  }));

  const { data, error } = await supabase
    .from("distribuciones_documentos_contables")
    .insert(insert)
    .select(COLUMNAS_DISTRIBUCION_CON_CUENTA);

  if (error) {
    throw errorSupabase("No se pudo guardar la distribucion contable", error);
  }

  await supabase
    .from("documentos_contables_revision")
    .update({
      actualizado_at: ahora,
      metadatos: {
        ...(documento.metadatos &&
        typeof documento.metadatos === "object" &&
        !Array.isArray(documento.metadatos)
          ? documento.metadatos
          : {}),
        distribucion_contable_validada: true,
        distribucion_total_debito: distribucion.totalDebito,
        distribucion_total_credito: distribucion.totalCredito,
        distribucion_moneda: distribucion.moneda,
        asiento_automatico_creado: false,
      },
    })
    .eq("id", documento.id)
    .eq("empresa_id", empresaId);

  await auditarSinBloquear({
    empresa_id: empresaId,
    modulo: "contabilidad",
    accion: existentes?.length
      ? "corregir_distribucion_documento"
      : "crear_distribucion_documento",
    entidad_tipo: "documento_contable_revision",
    entidad_id: documento.id,
    estado_nuevo: documento.estado,
    motivo: texto(params.motivo),
    descripcion: "Distribucion contable de documento guardada y validada",
    sensible: true,
    metadatos: {
      lineas: distribucion.lineas.length,
      total_debito: distribucion.totalDebito,
      total_credito: distribucion.totalCredito,
      moneda: distribucion.moneda,
      asiento_automatico_creado: false,
    },
  });

  return (data || []).map(normalizarDistribucionDocumento);
}

export async function listarImpuestosConfiguracion(
  params: ListarImpuestosConfiguracionParams
): Promise<ImpuestoConfiguracion[]> {
  const empresaId = validarEmpresaId(params.empresa_id);

  let query: any = supabase
    .from("impuestos_configuracion")
    .select(COLUMNAS_IMPUESTO_CON_CUENTA)
    .eq("empresa_id", empresaId);

  if (params.activo !== undefined) {
    query = query.eq("activo", params.activo);
  }

  const { data, error } = await query
    .order("activo", { ascending: false })
    .order("tipo", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudo listar la configuracion fiscal", error);
  }

  return (data || []) as ImpuestoConfiguracion[];
}

export async function guardarImpuestoConfiguracion(
  params: GuardarImpuestoConfiguracionParams
): Promise<ImpuestoConfiguracion> {
  const empresaId = validarEmpresaId(params.empresa_id);
  const nombre = requerirTexto(params.nombre, "nombre");
  const tipo = validarTipoImpuestoConfiguracion(params.tipo);
  const porcentaje = validarPorcentajeImpuesto(params.porcentaje);
  const cuentaContableId = await validarCuentaImpuestoOpcional(
    empresaId,
    params.cuenta_contable_id
  );
  const userId = await obtenerUsuarioIdActual();
  const ahora = new Date().toISOString();
  const esActualizacion =
    params.id !== "" && params.id !== null && params.id !== undefined;

  const payload = {
    empresa_id: empresaId,
    impuesto_id: texto(params.impuesto_id),
    nombre,
    tipo,
    porcentaje,
    cuenta_contable_id: cuentaContableId,
    aplica_compra: params.aplica_compra ?? false,
    aplica_venta: params.aplica_venta ?? false,
    proveedor_id: params.proveedor_id ?? null,
    cliente_id: params.cliente_id ?? null,
    activo: params.activo ?? true,
    observaciones: texto(params.observaciones),
    actualizado_at: ahora,
    actualizado_por: userId,
    metadatos: {
      ...(params.metadatos && typeof params.metadatos === "object" && !Array.isArray(params.metadatos)
        ? params.metadatos
        : {}),
      conexion_sat_preparada: true,
      depende_sat: false,
      conexion_cxp_cxc_preparada: true,
      asiento_automatico_creado: false,
    },
  };

  const consulta = esActualizacion
    ? supabase
        .from("impuestos_configuracion")
        .update(payload)
        .eq("id", params.id)
        .eq("empresa_id", empresaId)
    : supabase.from("impuestos_configuracion").insert({
        ...payload,
        creado_por: userId,
      });

  const { data, error } = await consulta
    .select(COLUMNAS_IMPUESTO_CON_CUENTA)
    .single();

  if (error) {
    throw errorSupabase(
      esActualizacion
        ? "No se pudo actualizar la configuracion fiscal"
        : "No se pudo crear la configuracion fiscal",
      error
    );
  }

  const impuesto = normalizarImpuestoConfiguracion(data);

  await auditarSinBloquear({
    empresa_id: impuesto.empresa_id,
    modulo: "contabilidad",
    accion: esActualizacion
      ? "actualizar_impuesto_configuracion"
      : "crear_impuesto_configuracion",
    entidad_tipo: "impuesto_configuracion",
    entidad_id: impuesto.id,
    estado_nuevo: impuesto.activo ? "activo" : "inactivo",
    descripcion: "Configuracion fiscal guardada",
    sensible: true,
    metadatos: {
      impuesto_id: impuesto.impuesto_id,
      nombre: impuesto.nombre,
      tipo: impuesto.tipo,
      porcentaje: impuesto.porcentaje,
      cuenta_contable_id: impuesto.cuenta_contable_id,
      aplica_compra: impuesto.aplica_compra,
      aplica_venta: impuesto.aplica_venta,
      proveedor_id: impuesto.proveedor_id,
      cliente_id: impuesto.cliente_id,
      asiento_automatico_creado: false,
    },
  });

  return impuesto;
}

export async function inactivarImpuestoConfiguracion(
  id: string | number,
  empresaIdValor: number,
  motivo?: string | null
): Promise<ImpuestoConfiguracion> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el impuesto a inactivar.");
  }

  const empresaId = validarEmpresaId(empresaIdValor);
  const userId = await obtenerUsuarioIdActual();

  const { data, error } = await supabase
    .from("impuestos_configuracion")
    .update({
      activo: false,
      actualizado_at: new Date().toISOString(),
      actualizado_por: userId,
      observaciones: texto(motivo),
    })
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .select(COLUMNAS_IMPUESTO_CON_CUENTA)
    .single();

  if (error) {
    throw errorSupabase("No se pudo inactivar la configuracion fiscal", error);
  }

  const impuesto = normalizarImpuestoConfiguracion(data);

  await auditarSinBloquear({
    empresa_id: impuesto.empresa_id,
    modulo: "contabilidad",
    accion: "inactivar_impuesto_configuracion",
    entidad_tipo: "impuesto_configuracion",
    entidad_id: impuesto.id,
    estado_anterior: "activo",
    estado_nuevo: "inactivo",
    motivo: texto(motivo),
    descripcion: "Configuracion fiscal inactivada",
    sensible: true,
    metadatos: {
      impuesto_id: impuesto.impuesto_id,
      nombre: impuesto.nombre,
      tipo: impuesto.tipo,
      porcentaje: impuesto.porcentaje,
    },
  });

  return impuesto;
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
    const idempotencyKey = obtenerIdempotencyKeyOperacion(
      "contabilizar_documento_contable",
      empresaId,
      params.id
    );
    const { data, error } = await supabase.rpc("contabilizar_documento_contable", {
      p_documento_id: params.id,
      p_empresa_id: empresaId,
      p_contabilizado_por: userId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      liberarIdempotencyKeyAsiento(idempotencyKey);
      throw errorSupabase("No se pudo contabilizar el documento", error);
    }

    const resultado = data as
      | { ok?: boolean; mensaje?: string; documento?: DocumentoContableRevision }
      | null;
    if (!resultado || resultado.ok === false || !resultado.documento) {
      liberarIdempotencyKeyAsiento(idempotencyKey);
      throw new Error(resultado?.mensaje || "No se pudo contabilizar el documento.");
    }

    liberarIdempotencyKeyAsiento(idempotencyKey);
    return normalizarDocumentoRevision(resultado.documento);
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
    modulo: "contabilidad",
    accion: "cambiar_estado_documento_revision",
    entidad_tipo: "documento_contable_revision",
    entidad_id: documento.id,
    estado_anterior: documentoActual.estado,
    estado_nuevo: documento.estado,
    motivo: observacion,
    descripcion: "Documento contable actualizado en flujo de revision",
    sensible: true,
    visible_calendario: true,
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
    modulo: "contabilidad",
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
  empresaIdValor: number,
  motivo: string
): Promise<AsientoContable> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el asiento contable que desea anular.");
  }

  const motivoAnulacion = requerirTexto(motivo, "motivo");
  const empresaId = validarEmpresaId(empresaIdValor);
  const userId = await obtenerUsuarioIdActual();
  const idempotencyKey = obtenerIdempotencyKeyOperacion(
    "anular_asiento_contable",
    empresaId,
    id,
    motivoAnulacion
  );
  const { data, error } = await supabase.rpc("anular_asiento_contable", {
    p_asiento_id: id,
    p_empresa_id: empresaId,
    p_motivo: motivoAnulacion,
    p_anulado_por: userId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw errorSupabase("No se pudo anular el asiento contable", error);
  }

  const resultado = data as
    | { ok?: boolean; mensaje?: string; asiento?: AsientoContable }
    | null;
  if (!resultado || resultado.ok === false || !resultado.asiento) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw new Error(resultado?.mensaje || "No se pudo anular el asiento contable.");
  }

  liberarIdempotencyKeyAsiento(idempotencyKey);
  return normalizarAsiento(resultado.asiento);
}

export async function finalizarAsientoContable(
  id: string | number,
  empresaIdValor: number
): Promise<AsientoContable> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el asiento contable que desea finalizar.");
  }

  const empresaId = validarEmpresaId(empresaIdValor);
  const userId = await obtenerUsuarioIdActual();
  const idempotencyKey = obtenerIdempotencyKeyFinalizarAsiento(id, empresaId);

  const { data, error } = await supabase.rpc("finalizar_asiento_contable", {
    p_asiento_id: id,
    p_empresa_id: empresaId,
    p_finalizado_por: userId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw errorSupabase("No se pudo finalizar el asiento contable", error);
  }

  const resultado = data as
    | {
        ok?: boolean;
        mensaje?: string;
        asiento?: AsientoContable;
      }
    | null;

  if (!resultado || resultado.ok === false || !resultado.asiento) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw new Error(resultado?.mensaje || "No se pudo finalizar el asiento contable.");
  }

  liberarIdempotencyKeyAsiento(idempotencyKey);
  return normalizarAsiento(resultado.asiento);
}

async function obtenerPeriodoParaCierre(
  empresaId: number,
  periodoId: string | number
): Promise<PeriodoContable> {
  if (periodoId === "" || periodoId === null || periodoId === undefined) {
    throw new Error("Debe indicar el periodo contable.");
  }

  const { data, error } = await supabase
    .from("periodos_contables")
    .select(COLUMNAS_PERIODO)
    .eq("id", periodoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo cargar el periodo contable", error);
  }

  if (!data) {
    throw new Error("No se encontro el periodo contable para la empresa indicada.");
  }

  return normalizarPeriodo(data);
}

function pushHallazgo(
  lista: HallazgoCierreMensual[],
  codigo: string,
  mensaje: string,
  cantidad: number,
  detalle?: ValorJsonAuditoria
) {
  if (cantidad <= 0) return;
  lista.push({ codigo, mensaje, cantidad, detalle });
}

function serializarHallazgos(lista: HallazgoCierreMensual[]): ValorJsonAuditoria {
  return lista.map((hallazgo) => ({
    codigo: hallazgo.codigo,
    mensaje: hallazgo.mensaje,
    cantidad: hallazgo.cantidad,
    ...(hallazgo.detalle !== undefined ? { detalle: hallazgo.detalle } : {}),
  }));
}

function serializarResumenCierre(
  resumen: PrevisualizacionCierreMensual["resumen"]
): ValorJsonAuditoria {
  return {
    empresa_id: resumen.empresa_id,
    periodo_id: String(resumen.periodo_id),
    anio: resumen.anio,
    mes: resumen.mes,
    fecha_inicio: resumen.fecha_inicio,
    fecha_fin: resumen.fecha_fin,
    estado_periodo: resumen.estado_periodo,
    asientos_registrados: resumen.asientos_registrados,
    asientos_borrador: resumen.asientos_borrador,
    asientos_requiere_revision: resumen.asientos_requiere_revision,
    asientos_pendientes: resumen.asientos_pendientes,
    documentos_pendientes: resumen.documentos_pendientes,
    documentos_observados: resumen.documentos_observados,
    documentos_vencidos: resumen.documentos_vencidos,
    total_debe: resumen.total_debe,
    total_haber: resumen.total_haber,
    diferencia: resumen.diferencia,
    balanceado: resumen.balanceado,
    cxp_vencidas: resumen.cxp_vencidas,
    cxc_vencidas: resumen.cxc_vencidas,
    monedas: resumen.monedas.map((moneda) => ({
      moneda: moneda.moneda,
      debe: moneda.debe,
      haber: moneda.haber,
      diferencia: moneda.diferencia,
      asientos: moneda.asientos,
    })),
    cierre_automatico_asientos: resumen.cierre_automatico_asientos,
  };
}

async function listarAsientosParaCierre(
  empresaId: number,
  periodoId: string | number
): Promise<AsientoContable[]> {
  const asientos: AsientoContable[] = [];
  const tamanoPagina = 500;
  let desde = 0;

  while (true) {
    const { data, error } = await supabase
      .from("asientos_contables")
      .select(`${COLUMNAS_ASIENTO},movimientos_contables_detalle(id,debe,haber,moneda)`)
      .eq("empresa_id", empresaId)
      .eq("periodo_id", periodoId)
      .range(desde, desde + tamanoPagina - 1);

    if (error) {
      throw errorSupabase("No se pudieron validar asientos del periodo", error);
    }

    const pagina = (data || []) as AsientoContable[];
    asientos.push(...pagina);

    if (pagina.length < tamanoPagina) break;
    desde += tamanoPagina;
  }

  return asientos;
}

export async function previsualizarCierreMensualContable(
  params: PrevisualizarCierreMensualParams
): Promise<PrevisualizacionCierreMensual> {
  const empresaId = validarEmpresaId(params.empresa_id);
  validarEmpresaPermitidaOpcional(empresaId, params.empresas_permitidas);

  const periodo = await obtenerPeriodoParaCierre(empresaId, params.periodo_id);
  const bloqueos: HallazgoCierreMensual[] = [];
  const advertencias: HallazgoCierreMensual[] = [];

  const estadoPeriodo = String(periodo.estado || "").toLowerCase();

  if (estadoPeriodo === "cerrado") {
    pushHallazgo(
      bloqueos,
      "periodo_cerrado",
      "El periodo ya esta cerrado.",
      1,
      { cerrado_at: periodo.cerrado_at, cerrado_por: periodo.cerrado_por }
    );
  }

  if (estadoPeriodo === "bloqueado") {
    pushHallazgo(bloqueos, "periodo_bloqueado", "El periodo esta bloqueado.", 1);
  }

  if (!["abierto", "cerrado", "bloqueado"].includes(estadoPeriodo)) {
    pushHallazgo(
      bloqueos,
      "periodo_no_abierto",
      "El periodo no tiene un estado valido para cierre.",
      1,
      { estado: periodo.estado }
    );
  }

  const contarDocumentosPorEstado = (estados: string[]) =>
    supabase
      .from("documentos_contables_revision")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .in("estado", estados)
      .gte("fecha_documento", periodo.fecha_inicio)
      .lte("fecha_documento", periodo.fecha_fin);

  const [pendientesResultado, observadosResultado, vencidosResultado] =
    await Promise.all([
      contarDocumentosPorEstado(["Pendiente", "En revision"]),
      contarDocumentosPorEstado(["Observado"]),
      contarDocumentosPorEstado(["Vencido"]),
    ]);

  const documentosError =
    pendientesResultado.error || observadosResultado.error || vencidosResultado.error;
  if (documentosError) {
    throw errorSupabase("No se pudieron validar documentos pendientes", documentosError);
  }

  const documentosPendientes = pendientesResultado.count || 0;
  const documentosObservados = observadosResultado.count || 0;
  const documentosVencidos = vencidosResultado.count || 0;

  pushHallazgo(bloqueos, "documentos_pendientes", "Hay documentos contables pendientes o en revision.", documentosPendientes);
  pushHallazgo(bloqueos, "documentos_observados", "Hay documentos contables observados.", documentosObservados);
  pushHallazgo(bloqueos, "documentos_vencidos", "Hay documentos contables vencidos.", documentosVencidos);

  const asientos = await listarAsientosParaCierre(empresaId, periodo.id);

  const resumenPorMoneda = new Map<string, ResumenMonedaCierre>();
  const asientosBorrador = asientos.filter(
    (asiento) => String(asiento.estado || "").toLowerCase() === "borrador"
  );
  const asientosRequiereRevision = asientos.filter(
    (asiento) => String(asiento.estado || "").toLowerCase() === "requiere_revision"
  );
  let asientosDescuadrados = 0;
  let asientosConMonedaMezclada = 0;
  let asientosRegistrados = 0;

  asientos.forEach((asiento) => {
    const detalles = asiento.movimientos_contables_detalle || [];
    const monedasDetalle = new Set(detalles.map((detalle) => normalizarMoneda(detalle.moneda)));
    const monedaBase = normalizarMoneda(asiento.moneda_base);

    if (String(asiento.estado || "").toLowerCase() === "registrado") {
      asientosRegistrados += 1;
    }

    if (monedasDetalle.size > 1 || (monedasDetalle.size === 1 && !monedasDetalle.has(monedaBase))) {
      asientosConMonedaMezclada += 1;
    }

    const totalDebeDetalle = numero(detalles.reduce((acc, detalle) => acc + numero(detalle.debe), 0));
    const totalHaberDetalle = numero(detalles.reduce((acc, detalle) => acc + numero(detalle.haber), 0));
    const diferenciaDetalle = numero(totalDebeDetalle - totalHaberDetalle);
    const diferenciaEncabezado = numero(numero(asiento.total_debe) - numero(asiento.total_haber));

    if (Math.abs(diferenciaDetalle) > TOLERANCIA_BALANCE || Math.abs(diferenciaEncabezado) > TOLERANCIA_BALANCE) {
      asientosDescuadrados += 1;
    }

    if (String(asiento.estado || "").toLowerCase() !== "registrado") return;

    const actual =
      resumenPorMoneda.get(monedaBase) ||
      ({
        moneda: monedaBase,
        debe: 0,
        haber: 0,
        diferencia: 0,
        asientos: 0,
      } satisfies ResumenMonedaCierre);

    actual.debe = numero(actual.debe + numero(asiento.total_debe));
    actual.haber = numero(actual.haber + numero(asiento.total_haber));
    actual.diferencia = numero(actual.debe - actual.haber);
    actual.asientos += 1;
    resumenPorMoneda.set(monedaBase, actual);
  });

  pushHallazgo(bloqueos, "asientos_borrador", "Hay asientos en borrador dentro del periodo.", asientosBorrador.length);
  pushHallazgo(
    bloqueos,
    "asientos_requiere_revision",
    "Hay asientos que requieren revision dentro del periodo.",
    asientosRequiereRevision.length
  );
  pushHallazgo(
    bloqueos,
    "asientos_descuadrados",
    "Hay asientos descuadrados en encabezado o detalle.",
    asientosDescuadrados
  );
  pushHallazgo(
    bloqueos,
    "moneda_mezclada",
    "Hay asientos con monedas mezcladas o detalle distinto a la moneda base.",
    asientosConMonedaMezclada
  );

  const monedas = Array.from(resumenPorMoneda.values()).sort((a, b) =>
    a.moneda.localeCompare(b.moneda)
  );
  const totalDebe = numero(monedas.reduce((total, moneda) => total + moneda.debe, 0));
  const totalHaber = numero(monedas.reduce((total, moneda) => total + moneda.haber, 0));
  const diferencia = numero(totalDebe - totalHaber);
  const balanceado =
    asientosDescuadrados === 0 &&
    monedas.every((moneda) => Math.abs(moneda.diferencia) <= TOLERANCIA_BALANCE);

  pushHallazgo(
    bloqueos,
    "balance_periodo_descuadrado",
    "El total debe y haber del periodo no cuadran.",
    balanceado ? 0 : 1,
    { total_debe: totalDebe, total_haber: totalHaber, diferencia }
  );

  const hoy = new Date().toISOString().slice(0, 10);
  const fechaCorte = periodo.fecha_fin < hoy ? periodo.fecha_fin : hoy;

  const { count: cxpVencidas, error: cxpError } = await supabase
    .from("cuentas_por_pagar")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .not("estado", "in", "(Pagado,Anulado)")
    .gt("saldo_pendiente", 0)
    .lte("fecha_vencimiento", fechaCorte);

  if (cxpError) {
    throw errorSupabase("No se pudieron validar cuentas por pagar vencidas", cxpError);
  }

  const { count: cxcVencidas, error: cxcError } = await supabase
    .from("cuentas_por_cobrar")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .not("estado", "in", "(Pagado,Anulado)")
    .gt("saldo_pendiente", 0)
    .lte("fecha_vencimiento", fechaCorte);

  if (cxcError) {
    throw errorSupabase("No se pudieron validar cuentas por cobrar vencidas", cxcError);
  }

  pushHallazgo(
    advertencias,
    "cxp_vencidas",
    "Hay cuentas por pagar vencidas sin resolver. No bloquean el cierre contable base.",
    cxpVencidas || 0
  );
  pushHallazgo(
    advertencias,
    "cxc_vencidas",
    "Hay cuentas por cobrar vencidas sin resolver. No bloquean el cierre contable base.",
    cxcVencidas || 0
  );

  const resumen = {
    empresa_id: empresaId,
    periodo_id: periodo.id,
    anio: periodo.anio,
    mes: periodo.mes,
    fecha_inicio: periodo.fecha_inicio,
    fecha_fin: periodo.fecha_fin,
    estado_periodo: periodo.estado,
    asientos_registrados: asientosRegistrados,
    asientos_borrador: asientosBorrador.length,
    asientos_requiere_revision: asientosRequiereRevision.length,
    asientos_pendientes: asientosBorrador.length + asientosRequiereRevision.length,
    documentos_pendientes: documentosPendientes,
    documentos_observados: documentosObservados,
    documentos_vencidos: documentosVencidos,
    total_debe: totalDebe,
    total_haber: totalHaber,
    diferencia,
    balanceado,
    cxp_vencidas: cxpVencidas || 0,
    cxc_vencidas: cxcVencidas || 0,
    monedas,
    cierre_automatico_asientos: false as const,
  };

  await auditarSinBloquear({
    empresa_id: empresaId,
    modulo: "contabilidad",
    accion: "previsualizar_cierre_mensual",
    entidad_tipo: "periodo_contable",
    entidad_id: periodo.id,
    estado_nuevo: periodo.estado,
    descripcion: "Previsualizacion de cierre mensual contable",
    sensible: true,
    metadatos: {
      puede_cerrar: bloqueos.length === 0,
      bloqueos: bloqueos.length,
      advertencias: advertencias.length,
      resumen: serializarResumenCierre(resumen),
    },
  });

  return {
    periodo,
    puede_cerrar: bloqueos.length === 0,
    bloqueos,
    advertencias,
    resumen,
  };
}

export async function cerrarPeriodoContable(
  params: CerrarPeriodoContableParams
): Promise<PeriodoContable> {
  const empresaId = validarEmpresaId(params.empresa_id);
  validarEmpresaPermitidaOpcional(empresaId, params.empresas_permitidas);

  const previsualizacion = await previsualizarCierreMensualContable(params);
  if (!previsualizacion.puede_cerrar) {
    throw new Error("El periodo tiene bloqueos y no puede cerrarse.");
  }

  const userId = await obtenerUsuarioIdActual();
  const idempotencyKey = obtenerIdempotencyKeyOperacion(
    "cerrar_periodo_contable",
    empresaId,
    previsualizacion.periodo.id,
    texto(params.observaciones) || ""
  );
  const { data, error } = await supabase.rpc("cerrar_periodo_contable", {
    p_periodo_id: previsualizacion.periodo.id,
    p_empresa_id: empresaId,
    p_observaciones: texto(params.observaciones),
    p_cerrado_por: userId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw errorSupabase("No se pudo cerrar el periodo contable", error);
  }

  const resultado = data as
    | { ok?: boolean; mensaje?: string; periodo?: PeriodoContable }
    | null;
  if (!resultado || resultado.ok === false || !resultado.periodo) {
    liberarIdempotencyKeyAsiento(idempotencyKey);
    throw new Error(resultado?.mensaje || "No se pudo cerrar el periodo contable.");
  }

  liberarIdempotencyKeyAsiento(idempotencyKey);
  return normalizarPeriodo(resultado.periodo);
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
