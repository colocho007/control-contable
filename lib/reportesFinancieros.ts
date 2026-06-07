import { supabase } from "./supabase";

export interface ReportesFinancierosParams {
  empresasIds: number[];
  empresa_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  moneda?: string;
  periodo_id?: string | number;
  estado?: string;
  proveedor_id?: string | number;
  cliente_id?: string | number;
  limite?: number;
}

export interface ResumenPorMoneda {
  moneda: string;
  ingresos: number;
  egresos: number;
  neto: number;
  total_movimientos?: number;
  movimientos_anulados?: number;
  monto_pendiente?: number;
  monto_pagado?: number;
  monto_aprobado?: number;
}

export interface ResumenFinanciero {
  ingresos: number;
  egresos: number;
  neto: number;
  total_movimientos: number;
  movimientos_anulados: number;
  por_moneda: ResumenPorMoneda[];
}

export interface FondoPorEmpresa {
  id: number;
  empresa_id: number;
  empresa: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string;
  saldo_base: number;
  saldo_comprometido: number;
  saldo_disponible: number;
  estado: string | null;
}

export interface ChequeReporte {
  id: number;
  empresa_id: number;
  empresa: string | null;
  beneficiario: string | null;
  concepto: string | null;
  numero_cheque: string | null;
  fecha_pago: string | null;
  estado: string;
  monto: number;
  moneda: string;
  forma_pago: string | null;
}

export interface ChequesResumen {
  pendientes: number;
  autorizados: number;
  pagados: number;
  rechazados: number;
  anulados: number;
  monto_pendiente: number;
  monto_pagado: number;
  por_moneda: ResumenPorMoneda[];
  proximos_pagos: ChequeReporte[];
}

export interface OrdenReporte {
  id: number;
  empresa_id: number;
  empresa: string | null;
  proveedor: string | null;
  concepto: string | null;
  numero_orden: string | null;
  numero_factura: string | null;
  fecha_necesaria: string | null;
  estado: string;
  monto: number;
  moneda: string;
}

export interface OrdenesResumen {
  pendientes: number;
  aprobadas: number;
  observadas: number;
  anuladas_rechazadas: number;
  monto_pendiente: number;
  monto_aprobado: number;
  por_moneda: ResumenPorMoneda[];
  proximas_ordenes: OrdenReporte[];
}

export interface CalendarioPago {
  fuente: "cheques" | "ordenes" | "tareas" | "cxp" | "cxc";
  empresa_id: number;
  fecha: string;
  titulo: string;
  monto: number | null;
  moneda: string | null;
  estado: string;
}

export interface CuentaOperativaReporte {
  id: string | number;
  empresa_id: number;
  tercero_id: string | number | null;
  tercero: string | null;
  documento_contable_id: string | number | null;
  serie: string | null;
  numero_documento: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  moneda: string;
  total: number;
  saldo_pendiente: number;
  estado: string;
  vencida: boolean;
}

export interface PagoParcialReporte {
  id: string | number;
  cuenta_id: string | number;
  empresa_id: number;
  tercero_id: string | number | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  banco: string | null;
  referencia: string | null;
  moneda: string;
  monto: number;
  estado: string;
}

export interface CuentasOperativasResumen {
  pendientes: number;
  parciales: number;
  pagadas: number;
  vencidas: number;
  anuladas: number;
  saldo_pendiente: number;
  total_documentos: number;
  por_moneda: ResumenPorMoneda[];
  cuentas: CuentaOperativaReporte[];
  pagos_parciales: PagoParcialReporte[];
}

export interface ReporteMensual {
  resumen: ResumenFinanciero;
  fondos: FondoPorEmpresa[];
  cheques: ChequesResumen;
  ordenes: OrdenesResumen;
  cuentas_por_pagar: CuentasOperativasResumen;
  cuentas_por_cobrar: CuentasOperativasResumen;
  calendario: CalendarioPago[];
}

interface MovimientoRow {
  id: number;
  tipo: string | null;
  descripcion: string | null;
  monto: number | null;
  empresa: string | null;
  empresa_id: number | null;
  moneda: string | null;
  fecha: string | null;
  estado: string | null;
}

interface FondoRow {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string | null;
  saldo_base: number | null;
  saldo_comprometido: number | null;
  saldo_disponible: number | null;
  estado: string | null;
}

interface ChequeRow {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  beneficiario: string | null;
  concepto: string | null;
  numero_cheque: string | null;
  fecha_pago: string | null;
  estado: string | null;
  monto: number | null;
  moneda: string | null;
  forma_pago: string | null;
}

interface OrdenRow {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  proveedor: string | null;
  concepto: string | null;
  numero_orden: string | null;
  numero_factura: string | null;
  fecha_necesaria: string | null;
  estado: string | null;
  monto: number | null;
  total_final: number | null;
  moneda: string | null;
}

interface TareaRow {
  id: number;
  nombre: string | null;
  empresa_id: number | null;
  fecha_limite: string | null;
  estado: string | null;
  monto: number | null;
  moneda: string | null;
}

interface CuentaPorPagarRow {
  id: string | number;
  empresa_id: number | null;
  proveedor_id: string | number | null;
  documento_contable_id: string | number | null;
  serie: string | null;
  numero_documento: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  moneda: string | null;
  total: number | null;
  saldo_pendiente: number | null;
  estado: string | null;
  proveedores?: { nombre?: string | null; nit?: string | null } | null;
}

interface CuentaPorCobrarRow {
  id: string | number;
  empresa_id: number | null;
  cliente_id: string | number | null;
  documento_contable_id: string | number | null;
  serie: string | null;
  numero_documento: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  moneda: string | null;
  total: number | null;
  saldo_pendiente: number | null;
  estado: string | null;
  clientes?: { nombre?: string | null; nit?: string | null } | null;
}

interface PagoCxPRow {
  id: string | number;
  cuenta_por_pagar_id: string | number;
  empresa_id: number | null;
  proveedor_id: string | number | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  banco: string | null;
  referencia: string | null;
  moneda: string | null;
  monto: number | null;
  estado: string | null;
}

interface PagoCxCRow {
  id: string | number;
  cuenta_por_cobrar_id: string | number;
  empresa_id: number | null;
  cliente_id: string | number | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  banco: string | null;
  referencia: string | null;
  moneda: string | null;
  monto: number | null;
  estado: string | null;
}

const COLUMNAS_MOVIMIENTOS =
  "id,tipo,descripcion,monto,empresa,empresa_id,moneda,fecha,estado";
const COLUMNAS_FONDOS =
  "id,empresa_id,empresa,banco,cuenta_bancaria,moneda,saldo_base,saldo_comprometido,saldo_disponible,estado";
const COLUMNAS_CHEQUES =
  "id,empresa_id,empresa,beneficiario,concepto,numero_cheque,fecha_pago,estado,monto,moneda,forma_pago";
const COLUMNAS_ORDENES =
  "id,empresa_id,empresa,proveedor,concepto,numero_orden,numero_factura,fecha_necesaria,estado,monto,total_final,moneda";
const COLUMNAS_TAREAS =
  "id,nombre,empresa_id,fecha_limite,estado,monto,moneda";
const COLUMNAS_CXP =
  "id,empresa_id,proveedor_id,documento_contable_id,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,total,saldo_pendiente,estado,proveedores(nombre,nit)";
const COLUMNAS_CXC =
  "id,empresa_id,cliente_id,documento_contable_id,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,total,saldo_pendiente,estado,clientes(nombre,nit)";
const COLUMNAS_PAGOS_CXP =
  "id,cuenta_por_pagar_id,empresa_id,proveedor_id,fecha_pago,metodo_pago,banco,referencia,moneda,monto,estado";
const COLUMNAS_PAGOS_CXC =
  "id,cuenta_por_cobrar_id,empresa_id,cliente_id,fecha_pago,metodo_pago,banco,referencia,moneda,monto,estado";
const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 500;

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

function normalizarTexto(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

function normalizarMoneda(valor?: string | null) {
  const moneda = (valor || "GTQ").trim().toUpperCase();
  return moneda || "GTQ";
}

function monto(valor: number | null | undefined) {
  return Number(valor || 0);
}

function resolverLimite(limite?: number) {
  if (limite === undefined) return LIMITE_PREDETERMINADO;
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error("El limite de reportes debe ser un numero entero positivo.");
  }
  return Math.min(limite, LIMITE_MAXIMO);
}

function validarFecha(valor?: string, campo = "fecha") {
  const fecha = valor?.trim();
  if (!fecha) return undefined;
  if (Number.isNaN(new Date(fecha).getTime())) {
    throw new Error(`El campo ${campo} debe ser una fecha valida.`);
  }
  return fecha;
}

function resolverEmpresas(params: ReportesFinancierosParams) {
  const permitidas = (params.empresasIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (params.empresa_id !== undefined) {
    const empresaId = Number(params.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error("Debe indicar una empresa valida para reportes.");
    }
    if (!permitidas.includes(empresaId)) return [];
    return [empresaId];
  }

  return Array.from(new Set(permitidas));
}

function monedaPermitida(params: ReportesFinancierosParams) {
  const moneda = params.moneda?.trim().toUpperCase();
  return moneda ? moneda : undefined;
}

function estadoPermitido(params: ReportesFinancierosParams) {
  const estado = params.estado?.trim();
  return estado ? estado : undefined;
}

function idTexto(valor?: string | number) {
  if (valor === undefined || valor === null || valor === "") return undefined;
  return String(valor);
}

function estaVencida(fechaVencimiento: string | null, estado: string | null) {
  if (!fechaVencimiento) return false;
  const normalizado = normalizarTexto(estado);
  if (normalizado.includes("pagado") || normalizado.includes("anulado")) return false;
  return new Date(`${fechaVencimiento}T23:59:59`).getTime() < Date.now();
}

function sumarPorMoneda(
  mapa: Map<string, ResumenPorMoneda>,
  moneda: string,
  cambios: Partial<Omit<ResumenPorMoneda, "moneda">>
) {
  const actual =
    mapa.get(moneda) ||
    ({
      moneda,
      ingresos: 0,
      egresos: 0,
      neto: 0,
      total_movimientos: 0,
      movimientos_anulados: 0,
      monto_pendiente: 0,
      monto_pagado: 0,
      monto_aprobado: 0,
    } satisfies ResumenPorMoneda);

  actual.ingresos += cambios.ingresos || 0;
  actual.egresos += cambios.egresos || 0;
  actual.total_movimientos =
    (actual.total_movimientos || 0) + (cambios.total_movimientos || 0);
  actual.movimientos_anulados =
    (actual.movimientos_anulados || 0) + (cambios.movimientos_anulados || 0);
  actual.monto_pendiente =
    (actual.monto_pendiente || 0) + (cambios.monto_pendiente || 0);
  actual.monto_pagado =
    (actual.monto_pagado || 0) + (cambios.monto_pagado || 0);
  actual.monto_aprobado =
    (actual.monto_aprobado || 0) + (cambios.monto_aprobado || 0);

  actual.neto = actual.ingresos - actual.egresos;
  mapa.set(moneda, actual);
}

async function consultarMovimientos(params: ReportesFinancierosParams) {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) return [] as MovimientoRow[];

  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const moneda = monedaPermitida(params);
  const estado = estadoPermitido(params);
  const movimientos: MovimientoRow[] = [];
  const tamanoPagina = 500;
  let desde = 0;

  while (true) {
    let query: any = supabase
      .from("movimientos")
      .select(COLUMNAS_MOVIMIENTOS)
      .in("empresa_id", empresas);

    if (fechaDesde) query = query.gte("fecha", fechaDesde);
    if (fechaHasta) query = query.lte("fecha", fechaHasta);
    if (moneda) query = query.eq("moneda", moneda);
    if (estado) query = query.eq("estado", estado);

    const { data, error } = await query
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(desde, desde + tamanoPagina - 1);

    if (error) {
      throw errorSupabase("No se pudieron cargar movimientos para reportes", error);
    }

    const pagina = (data || []) as MovimientoRow[];
    movimientos.push(...pagina);
    if (pagina.length < tamanoPagina) break;
    desde += tamanoPagina;
  }

  return movimientos;
}

export async function obtenerResumenFinanciero(
  params: ReportesFinancierosParams
): Promise<ResumenFinanciero> {
  const movimientos = await consultarMovimientos(params);
  const porMoneda = new Map<string, ResumenPorMoneda>();

  let ingresos = 0;
  let egresos = 0;
  let totalMovimientos = 0;
  let movimientosAnulados = 0;

  movimientos.forEach((movimiento) => {
    if (movimiento.empresa_id === null) return;

    const moneda = normalizarMoneda(movimiento.moneda);
    const valor = monto(movimiento.monto);
    const estado = normalizarTexto(movimiento.estado || "activo");

    if (estado === "anulado") {
      movimientosAnulados += 1;
      sumarPorMoneda(porMoneda, moneda, { movimientos_anulados: 1 });
      return;
    }

    totalMovimientos += 1;

    if (normalizarTexto(movimiento.tipo) === "ingreso") {
      ingresos += valor;
      sumarPorMoneda(porMoneda, moneda, {
        ingresos: valor,
        total_movimientos: 1,
      });
    } else if (normalizarTexto(movimiento.tipo) === "egreso") {
      egresos += valor;
      sumarPorMoneda(porMoneda, moneda, {
        egresos: valor,
        total_movimientos: 1,
      });
    } else {
      sumarPorMoneda(porMoneda, moneda, { total_movimientos: 1 });
    }
  });

  return {
    ingresos,
    egresos,
    neto: ingresos - egresos,
    total_movimientos: totalMovimientos,
    movimientos_anulados: movimientosAnulados,
    por_moneda: Array.from(porMoneda.values()).sort((a, b) =>
      a.moneda.localeCompare(b.moneda)
    ),
  };
}

export async function obtenerFondosPorEmpresa(
  params: ReportesFinancierosParams
): Promise<FondoPorEmpresa[]> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) return [];

  let query: any = supabase
    .from("fondos_empresa")
    .select(COLUMNAS_FONDOS)
    .in("empresa_id", empresas);

  const moneda = monedaPermitida(params);
  if (moneda) query = query.eq("moneda", moneda);

  const { data, error } = await query.order("empresa", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudieron cargar fondos por empresa", error);
  }

  return ((data || []) as FondoRow[])
    .filter((fondo) => fondo.empresa_id !== null)
    .map((fondo) => ({
      id: fondo.id,
      empresa_id: Number(fondo.empresa_id),
      empresa: fondo.empresa,
      banco: fondo.banco,
      cuenta_bancaria: fondo.cuenta_bancaria,
      moneda: normalizarMoneda(fondo.moneda),
      saldo_base: monto(fondo.saldo_base),
      saldo_comprometido: monto(fondo.saldo_comprometido),
      saldo_disponible: monto(fondo.saldo_disponible),
      estado: fondo.estado,
    }));
}

export async function obtenerChequesResumen(
  params: ReportesFinancierosParams
): Promise<ChequesResumen> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) {
    return {
      pendientes: 0,
      autorizados: 0,
      pagados: 0,
      rechazados: 0,
      anulados: 0,
      monto_pendiente: 0,
      monto_pagado: 0,
      por_moneda: [],
      proximos_pagos: [],
    };
  }

  let query: any = supabase
    .from("cheques")
    .select(COLUMNAS_CHEQUES)
    .in("empresa_id", empresas);

  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const moneda = monedaPermitida(params);
  const estadoFiltro = estadoPermitido(params);

  if (fechaDesde) query = query.gte("fecha_pago", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_pago", fechaHasta);
  if (moneda) query = query.eq("moneda", moneda);
  if (estadoFiltro) query = query.eq("estado", estadoFiltro);

  const { data, error } = await query.order("fecha_pago", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudieron cargar cheques para reportes", error);
  }

  const porMoneda = new Map<string, ResumenPorMoneda>();
  const proximos: ChequeReporte[] = [];
  const resumen: ChequesResumen = {
    pendientes: 0,
    autorizados: 0,
    pagados: 0,
    rechazados: 0,
    anulados: 0,
    monto_pendiente: 0,
    monto_pagado: 0,
    por_moneda: [],
    proximos_pagos: [],
  };

  ((data || []) as ChequeRow[]).forEach((cheque) => {
    if (cheque.empresa_id === null) return;

    const estado = normalizarTexto(cheque.estado);
    const moneda = normalizarMoneda(cheque.moneda);
    const valor = monto(cheque.monto);

    if (estado.includes("pagado")) {
      resumen.pagados += 1;
      resumen.monto_pagado += valor;
      sumarPorMoneda(porMoneda, moneda, { monto_pagado: valor });
    } else if (estado.includes("rechazado")) {
      resumen.rechazados += 1;
    } else if (estado.includes("anulado")) {
      resumen.anulados += 1;
    } else {
      resumen.monto_pendiente += valor;
      sumarPorMoneda(porMoneda, moneda, { monto_pendiente: valor });

      if (estado.includes("autorizado") || estado.includes("firmado")) {
        resumen.autorizados += 1;
      } else {
        resumen.pendientes += 1;
      }
    }

    if (!estado.includes("pagado") && !estado.includes("rechazado") && !estado.includes("anulado")) {
      proximos.push({
        id: cheque.id,
        empresa_id: Number(cheque.empresa_id),
        empresa: cheque.empresa,
        beneficiario: cheque.beneficiario,
        concepto: cheque.concepto,
        numero_cheque: cheque.numero_cheque,
        fecha_pago: cheque.fecha_pago,
        estado: cheque.estado || "Pendiente",
        monto: valor,
        moneda,
        forma_pago: cheque.forma_pago,
      });
    }
  });

  resumen.por_moneda = Array.from(porMoneda.values()).sort((a, b) =>
    a.moneda.localeCompare(b.moneda)
  );
  resumen.proximos_pagos = proximos.slice(0, resolverLimite(params.limite));

  return resumen;
}

export async function obtenerOrdenesResumen(
  params: ReportesFinancierosParams
): Promise<OrdenesResumen> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) {
    return {
      pendientes: 0,
      aprobadas: 0,
      observadas: 0,
      anuladas_rechazadas: 0,
      monto_pendiente: 0,
      monto_aprobado: 0,
      por_moneda: [],
      proximas_ordenes: [],
    };
  }

  let query: any = supabase
    .from("ordenes_compra")
    .select(COLUMNAS_ORDENES)
    .in("empresa_id", empresas);

  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const moneda = monedaPermitida(params);
  const estadoFiltro = estadoPermitido(params);

  if (fechaDesde) query = query.gte("fecha_necesaria", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_necesaria", fechaHasta);
  if (moneda) query = query.eq("moneda", moneda);
  if (estadoFiltro) query = query.eq("estado", estadoFiltro);

  const { data, error } = await query.order("fecha_necesaria", { ascending: true });

  if (error) {
    throw errorSupabase("No se pudieron cargar ordenes para reportes", error);
  }

  const porMoneda = new Map<string, ResumenPorMoneda>();
  const proximas: OrdenReporte[] = [];
  const resumen: OrdenesResumen = {
    pendientes: 0,
    aprobadas: 0,
    observadas: 0,
    anuladas_rechazadas: 0,
    monto_pendiente: 0,
    monto_aprobado: 0,
    por_moneda: [],
    proximas_ordenes: [],
  };

  ((data || []) as OrdenRow[]).forEach((orden) => {
    if (orden.empresa_id === null) return;

    const estado = normalizarTexto(orden.estado);
    const moneda = normalizarMoneda(orden.moneda);
    const valor = monto(orden.total_final ?? orden.monto);

    if (estado.includes("aprobada") || estado.includes("aprobado")) {
      resumen.aprobadas += 1;
      resumen.monto_aprobado += valor;
      sumarPorMoneda(porMoneda, moneda, { monto_aprobado: valor });
    } else if (estado.includes("observada") || estado.includes("observado")) {
      resumen.observadas += 1;
      resumen.pendientes += 1;
      resumen.monto_pendiente += valor;
      sumarPorMoneda(porMoneda, moneda, { monto_pendiente: valor });
    } else if (estado.includes("anulada") || estado.includes("anulado") || estado.includes("rechazada") || estado.includes("rechazado")) {
      resumen.anuladas_rechazadas += 1;
    } else {
      resumen.pendientes += 1;
      resumen.monto_pendiente += valor;
      sumarPorMoneda(porMoneda, moneda, { monto_pendiente: valor });
    }

    if (!estado.includes("anulada") && !estado.includes("anulado") && !estado.includes("rechazada") && !estado.includes("rechazado")) {
      proximas.push({
        id: orden.id,
        empresa_id: Number(orden.empresa_id),
        empresa: orden.empresa,
        proveedor: orden.proveedor,
        concepto: orden.concepto,
        numero_orden: orden.numero_orden,
        numero_factura: orden.numero_factura,
        fecha_necesaria: orden.fecha_necesaria,
        estado: orden.estado || "Pendiente",
        monto: valor,
        moneda,
      });
    }
  });

  resumen.por_moneda = Array.from(porMoneda.values()).sort((a, b) =>
    a.moneda.localeCompare(b.moneda)
  );
  resumen.proximas_ordenes = proximas.slice(0, resolverLimite(params.limite));

  return resumen;
}

export async function obtenerCalendarioPagos(
  params: ReportesFinancierosParams
): Promise<CalendarioPago[]> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) return [];

  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const moneda = monedaPermitida(params);
  const estado = estadoPermitido(params);
  const limite = resolverLimite(params.limite);

  let consultaCheques: any = supabase
    .from("cheques")
    .select(COLUMNAS_CHEQUES)
    .in("empresa_id", empresas)
    .not("fecha_pago", "is", null);

  let consultaOrdenes: any = supabase
    .from("ordenes_compra")
    .select(COLUMNAS_ORDENES)
    .in("empresa_id", empresas)
    .not("fecha_necesaria", "is", null);

  let consultaTareas: any = supabase
    .from("tareas")
    .select(COLUMNAS_TAREAS)
    .in("empresa_id", empresas)
    .not("fecha_limite", "is", null)
    .neq("estado", "Cancelada");

  if (fechaDesde) {
    consultaCheques = consultaCheques.gte("fecha_pago", fechaDesde);
    consultaOrdenes = consultaOrdenes.gte("fecha_necesaria", fechaDesde);
    consultaTareas = consultaTareas.gte("fecha_limite", fechaDesde);
  }

  if (fechaHasta) {
    consultaCheques = consultaCheques.lte("fecha_pago", fechaHasta);
    consultaOrdenes = consultaOrdenes.lte("fecha_necesaria", fechaHasta);
    consultaTareas = consultaTareas.lte("fecha_limite", fechaHasta);
  }

  if (moneda) {
    consultaCheques = consultaCheques.eq("moneda", moneda);
    consultaOrdenes = consultaOrdenes.eq("moneda", moneda);
    consultaTareas = consultaTareas.eq("moneda", moneda);
  }

  if (estado) {
    consultaCheques = consultaCheques.eq("estado", estado);
    consultaOrdenes = consultaOrdenes.eq("estado", estado);
    consultaTareas = consultaTareas.eq("estado", estado);
  }

  let consultaCxp: any = supabase
    .from("cuentas_por_pagar")
    .select(COLUMNAS_CXP)
    .in("empresa_id", empresas)
    .not("fecha_vencimiento", "is", null)
    .not("estado", "in", "(Pagado,Anulado)");

  let consultaCxc: any = supabase
    .from("cuentas_por_cobrar")
    .select(COLUMNAS_CXC)
    .in("empresa_id", empresas)
    .not("fecha_vencimiento", "is", null)
    .not("estado", "in", "(Pagado,Anulado)");

  if (fechaDesde) {
    consultaCxp = consultaCxp.gte("fecha_vencimiento", fechaDesde);
    consultaCxc = consultaCxc.gte("fecha_vencimiento", fechaDesde);
  }

  if (fechaHasta) {
    consultaCxp = consultaCxp.lte("fecha_vencimiento", fechaHasta);
    consultaCxc = consultaCxc.lte("fecha_vencimiento", fechaHasta);
  }

  if (moneda) {
    consultaCxp = consultaCxp.eq("moneda", moneda);
    consultaCxc = consultaCxc.eq("moneda", moneda);
  }

  if (estado) {
    consultaCxp = consultaCxp.eq("estado", estado);
    consultaCxc = consultaCxc.eq("estado", estado);
  }

  const [cheques, ordenes, tareas, cxp, cxc] = await Promise.all([
    consultaCheques.order("fecha_pago", { ascending: true }).limit(limite),
    consultaOrdenes.order("fecha_necesaria", { ascending: true }).limit(limite),
    consultaTareas.order("fecha_limite", { ascending: true }).limit(limite),
    consultaCxp.order("fecha_vencimiento", { ascending: true }).limit(limite),
    consultaCxc.order("fecha_vencimiento", { ascending: true }).limit(limite),
  ]);

  if (cheques.error) {
    throw errorSupabase("No se pudieron cargar cheques para calendario de pagos", cheques.error);
  }
  if (ordenes.error) {
    throw errorSupabase("No se pudieron cargar ordenes para calendario de pagos", ordenes.error);
  }
  if (tareas.error) {
    throw errorSupabase("No se pudieron cargar tareas para calendario de pagos", tareas.error);
  }
  if (cxp.error) {
    throw errorSupabase("No se pudieron cargar vencimientos de CxP", cxp.error);
  }
  if (cxc.error) {
    throw errorSupabase("No se pudieron cargar vencimientos de CxC", cxc.error);
  }

  const eventos: CalendarioPago[] = [
    ...((cheques.data || []) as ChequeRow[])
      .filter((cheque) => cheque.empresa_id !== null && cheque.fecha_pago)
      .map((cheque) => ({
        fuente: "cheques" as const,
        empresa_id: Number(cheque.empresa_id),
        fecha: String(cheque.fecha_pago),
        titulo: cheque.beneficiario
          ? `Cheque: ${cheque.beneficiario}`
          : "Cheque por pagar",
        monto: monto(cheque.monto),
        moneda: normalizarMoneda(cheque.moneda),
        estado: cheque.estado || "Pendiente",
      })),
    ...((ordenes.data || []) as OrdenRow[])
      .filter((orden) => orden.empresa_id !== null && orden.fecha_necesaria)
      .map((orden) => ({
        fuente: "ordenes" as const,
        empresa_id: Number(orden.empresa_id),
        fecha: String(orden.fecha_necesaria),
        titulo: orden.proveedor ? `Orden: ${orden.proveedor}` : "Orden de compra",
        monto: monto(orden.total_final ?? orden.monto),
        moneda: normalizarMoneda(orden.moneda),
        estado: orden.estado || "Pendiente",
      })),
    ...((tareas.data || []) as TareaRow[])
      .filter((tarea) => tarea.empresa_id !== null && tarea.fecha_limite)
      .map((tarea) => ({
        fuente: "tareas" as const,
        empresa_id: Number(tarea.empresa_id),
        fecha: String(tarea.fecha_limite),
        titulo: tarea.nombre || "Tarea",
        monto: tarea.monto === null ? null : monto(tarea.monto),
        moneda: tarea.moneda ? normalizarMoneda(tarea.moneda) : null,
        estado: tarea.estado || "Pendiente",
      })),
    ...((cxp.data || []) as CuentaPorPagarRow[])
      .filter((cuenta) => cuenta.empresa_id !== null && cuenta.fecha_vencimiento)
      .map((cuenta) => ({
        fuente: "cxp" as const,
        empresa_id: Number(cuenta.empresa_id),
        fecha: String(cuenta.fecha_vencimiento),
        titulo: cuenta.proveedores?.nombre
          ? `CxP: ${cuenta.proveedores.nombre}`
          : `CxP ${cuenta.numero_documento || cuenta.id}`,
        monto: monto(cuenta.saldo_pendiente),
        moneda: normalizarMoneda(cuenta.moneda),
        estado: estaVencida(cuenta.fecha_vencimiento, cuenta.estado)
          ? "Vencido"
          : cuenta.estado || "Pendiente",
      })),
    ...((cxc.data || []) as CuentaPorCobrarRow[])
      .filter((cuenta) => cuenta.empresa_id !== null && cuenta.fecha_vencimiento)
      .map((cuenta) => ({
        fuente: "cxc" as const,
        empresa_id: Number(cuenta.empresa_id),
        fecha: String(cuenta.fecha_vencimiento),
        titulo: cuenta.clientes?.nombre
          ? `CxC: ${cuenta.clientes.nombre}`
          : `CxC ${cuenta.numero_documento || cuenta.id}`,
        monto: monto(cuenta.saldo_pendiente),
        moneda: normalizarMoneda(cuenta.moneda),
        estado: estaVencida(cuenta.fecha_vencimiento, cuenta.estado)
          ? "Vencido"
          : cuenta.estado || "Pendiente",
      })),
  ];

  return eventos
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, limite);
}

function resumenCuentasVacio(): CuentasOperativasResumen {
  return {
    pendientes: 0,
    parciales: 0,
    pagadas: 0,
    vencidas: 0,
    anuladas: 0,
    saldo_pendiente: 0,
    total_documentos: 0,
    por_moneda: [],
    cuentas: [],
    pagos_parciales: [],
  };
}

function acumularCuenta(resumen: CuentasOperativasResumen, porMoneda: Map<string, ResumenPorMoneda>, cuenta: CuentaOperativaReporte) {
  const estado = normalizarTexto(cuenta.estado);
  resumen.total_documentos += 1;
  resumen.saldo_pendiente += cuenta.saldo_pendiente;

  if (cuenta.vencida) resumen.vencidas += 1;
  if (estado.includes("pagado")) resumen.pagadas += 1;
  else if (estado.includes("anulado")) resumen.anuladas += 1;
  else if (estado.includes("parcial")) resumen.parciales += 1;
  else resumen.pendientes += 1;

  sumarPorMoneda(porMoneda, cuenta.moneda, {
    monto_pendiente: cuenta.saldo_pendiente,
    total_movimientos: 1,
  });
}

export async function obtenerCuentasPorPagarResumen(
  params: ReportesFinancierosParams
): Promise<CuentasOperativasResumen> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) return resumenCuentasVacio();

  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const moneda = monedaPermitida(params);
  const estado = estadoPermitido(params);
  const proveedorId = idTexto(params.proveedor_id);
  const limite = resolverLimite(params.limite);

  let query: any = supabase
    .from("cuentas_por_pagar")
    .select(COLUMNAS_CXP)
    .in("empresa_id", empresas);

  if (fechaDesde) query = query.gte("fecha_documento", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_documento", fechaHasta);
  if (moneda) query = query.eq("moneda", moneda);
  if (estado) query = query.eq("estado", estado);
  if (proveedorId) query = query.eq("proveedor_id", proveedorId);

  const { data, error } = await query.order("fecha_vencimiento", { ascending: true }).limit(limite);
  if (error) throw errorSupabase("No se pudieron cargar CxP para reportes", error);

  let pagosQuery: any = supabase
    .from("pagos_cuentas_por_pagar")
    .select(COLUMNAS_PAGOS_CXP)
    .in("empresa_id", empresas);
  if (fechaDesde) pagosQuery = pagosQuery.gte("fecha_pago", fechaDesde);
  if (fechaHasta) pagosQuery = pagosQuery.lte("fecha_pago", fechaHasta);
  if (moneda) pagosQuery = pagosQuery.eq("moneda", moneda);
  if (proveedorId) pagosQuery = pagosQuery.eq("proveedor_id", proveedorId);

  const pagos = await pagosQuery.order("fecha_pago", { ascending: false }).limit(limite);
  if (pagos.error) throw errorSupabase("No se pudieron cargar pagos parciales CxP", pagos.error);

  const resumen = resumenCuentasVacio();
  const porMoneda = new Map<string, ResumenPorMoneda>();
  resumen.cuentas = ((data || []) as CuentaPorPagarRow[])
    .filter((cuenta) => cuenta.empresa_id !== null)
    .map((cuenta) => ({
      id: cuenta.id,
      empresa_id: Number(cuenta.empresa_id),
      tercero_id: cuenta.proveedor_id,
      tercero: cuenta.proveedores?.nombre || null,
      documento_contable_id: cuenta.documento_contable_id,
      serie: cuenta.serie,
      numero_documento: cuenta.numero_documento,
      fecha_documento: cuenta.fecha_documento,
      fecha_vencimiento: cuenta.fecha_vencimiento,
      moneda: normalizarMoneda(cuenta.moneda),
      total: monto(cuenta.total),
      saldo_pendiente: monto(cuenta.saldo_pendiente),
      estado: cuenta.estado || "Pendiente",
      vencida: estaVencida(cuenta.fecha_vencimiento, cuenta.estado),
    }));

  resumen.cuentas.forEach((cuenta) => acumularCuenta(resumen, porMoneda, cuenta));
  resumen.pagos_parciales = ((pagos.data || []) as PagoCxPRow[])
    .filter((pago) => pago.empresa_id !== null)
    .map((pago) => ({
      id: pago.id,
      cuenta_id: pago.cuenta_por_pagar_id,
      empresa_id: Number(pago.empresa_id),
      tercero_id: pago.proveedor_id,
      fecha_pago: pago.fecha_pago,
      metodo_pago: pago.metodo_pago,
      banco: pago.banco,
      referencia: pago.referencia,
      moneda: normalizarMoneda(pago.moneda),
      monto: monto(pago.monto),
      estado: pago.estado || "Registrado",
    }));
  resumen.por_moneda = Array.from(porMoneda.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));
  return resumen;
}

export async function obtenerCuentasPorCobrarResumen(
  params: ReportesFinancierosParams
): Promise<CuentasOperativasResumen> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) return resumenCuentasVacio();

  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const moneda = monedaPermitida(params);
  const estado = estadoPermitido(params);
  const clienteId = idTexto(params.cliente_id);
  const limite = resolverLimite(params.limite);

  let query: any = supabase
    .from("cuentas_por_cobrar")
    .select(COLUMNAS_CXC)
    .in("empresa_id", empresas);

  if (fechaDesde) query = query.gte("fecha_documento", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_documento", fechaHasta);
  if (moneda) query = query.eq("moneda", moneda);
  if (estado) query = query.eq("estado", estado);
  if (clienteId) query = query.eq("cliente_id", clienteId);

  const { data, error } = await query.order("fecha_vencimiento", { ascending: true }).limit(limite);
  if (error) throw errorSupabase("No se pudieron cargar CxC para reportes", error);

  let pagosQuery: any = supabase
    .from("pagos_cuentas_por_cobrar")
    .select(COLUMNAS_PAGOS_CXC)
    .in("empresa_id", empresas);
  if (fechaDesde) pagosQuery = pagosQuery.gte("fecha_pago", fechaDesde);
  if (fechaHasta) pagosQuery = pagosQuery.lte("fecha_pago", fechaHasta);
  if (moneda) pagosQuery = pagosQuery.eq("moneda", moneda);
  if (clienteId) pagosQuery = pagosQuery.eq("cliente_id", clienteId);

  const pagos = await pagosQuery.order("fecha_pago", { ascending: false }).limit(limite);
  if (pagos.error) throw errorSupabase("No se pudieron cargar cobros parciales CxC", pagos.error);

  const resumen = resumenCuentasVacio();
  const porMoneda = new Map<string, ResumenPorMoneda>();
  resumen.cuentas = ((data || []) as CuentaPorCobrarRow[])
    .filter((cuenta) => cuenta.empresa_id !== null)
    .map((cuenta) => ({
      id: cuenta.id,
      empresa_id: Number(cuenta.empresa_id),
      tercero_id: cuenta.cliente_id,
      tercero: cuenta.clientes?.nombre || null,
      documento_contable_id: cuenta.documento_contable_id,
      serie: cuenta.serie,
      numero_documento: cuenta.numero_documento,
      fecha_documento: cuenta.fecha_documento,
      fecha_vencimiento: cuenta.fecha_vencimiento,
      moneda: normalizarMoneda(cuenta.moneda),
      total: monto(cuenta.total),
      saldo_pendiente: monto(cuenta.saldo_pendiente),
      estado: cuenta.estado || "Pendiente",
      vencida: estaVencida(cuenta.fecha_vencimiento, cuenta.estado),
    }));

  resumen.cuentas.forEach((cuenta) => acumularCuenta(resumen, porMoneda, cuenta));
  resumen.pagos_parciales = ((pagos.data || []) as PagoCxCRow[])
    .filter((pago) => pago.empresa_id !== null)
    .map((pago) => ({
      id: pago.id,
      cuenta_id: pago.cuenta_por_cobrar_id,
      empresa_id: Number(pago.empresa_id),
      tercero_id: pago.cliente_id,
      fecha_pago: pago.fecha_pago,
      metodo_pago: pago.metodo_pago,
      banco: pago.banco,
      referencia: pago.referencia,
      moneda: normalizarMoneda(pago.moneda),
      monto: monto(pago.monto),
      estado: pago.estado || "Registrado",
    }));
  resumen.por_moneda = Array.from(porMoneda.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));
  return resumen;
}

export async function obtenerReporteMensual(
  params: ReportesFinancierosParams
): Promise<ReporteMensual> {
  const [resumen, fondos, cheques, ordenes, cuentasPorPagar, cuentasPorCobrar, calendario] = await Promise.all([
    obtenerResumenFinanciero(params),
    obtenerFondosPorEmpresa(params),
    obtenerChequesResumen(params),
    obtenerOrdenesResumen(params),
    obtenerCuentasPorPagarResumen(params),
    obtenerCuentasPorCobrarResumen(params),
    obtenerCalendarioPagos(params),
  ]);

  return {
    resumen,
    fondos,
    cheques,
    ordenes,
    cuentas_por_pagar: cuentasPorPagar,
    cuentas_por_cobrar: cuentasPorCobrar,
    calendario,
  };
}
