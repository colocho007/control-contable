import { supabase } from "./supabase";

export interface EstadosFinancierosParams {
  empresasIds: number[];
  empresa_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  moneda?: string;
}

export interface BalanceComprobacionFormalFila {
  cuenta_id: string | number;
  codigo: string;
  nombre: string;
  tipo: string;
  subtipo: string;
  naturaleza: string;
  moneda: string;
  debe: number;
  haber: number;
  saldo_deudor: number;
  saldo_acreedor: number;
}

export interface EstadoFinancieroSeccion {
  moneda: string;
  total: number;
  cuentas: BalanceComprobacionFormalFila[];
}

export interface EstadoResultadosSeccion {
  moneda: string;
  ingresos: number;
  costos: number;
  gastos_operativos: number;
  gastos_financieros: number;
  utilidad_perdida: number;
  cuentas_ingresos: BalanceComprobacionFormalFila[];
  cuentas_costos: BalanceComprobacionFormalFila[];
  cuentas_gastos_operativos: BalanceComprobacionFormalFila[];
  cuentas_gastos_financieros: BalanceComprobacionFormalFila[];
}

export interface PeriodoEstadoFinanciero {
  id: string | number;
  anio: number;
  mes: number;
  estado: string;
}

export interface EstadosFinancierosFormales {
  balance_comprobacion: BalanceComprobacionFormalFila[];
  balance_general: {
    activos: EstadoFinancieroSeccion[];
    pasivos: EstadoFinancieroSeccion[];
    patrimonio: EstadoFinancieroSeccion[];
  };
  estado_resultados: EstadoResultadosSeccion[];
  periodos: PeriodoEstadoFinanciero[];
  preliminar: boolean;
  mensaje_preliminar: string;
}

interface AsientoFormalRow {
  id: string | number;
  empresa_id: number;
  periodo_id: string | number;
  fecha: string;
  estado: string;
  movimientos_contables_detalle?: DetalleFormalRow[];
  periodos_contables?: { id: string | number; anio: number; mes: number; estado: string } | null;
}

interface DetalleFormalRow {
  cuenta_id: string | number;
  debe: number | null;
  haber: number | null;
  moneda: string | null;
  catalogo_cuentas?: {
    codigo: string | null;
    nombre: string | null;
    tipo: string | null;
    subtipo: string | null;
    naturaleza: string | null;
  } | null;
}

const MONEDAS_PERMITIDAS = ["GTQ", "USD"];

function numero(valor: number | null | undefined) {
  const resultado = Number(valor || 0);
  return Math.round((Number.isFinite(resultado) ? resultado : 0) * 100) / 100;
}

function normalizarMoneda(valor?: string | null) {
  const moneda = (valor || "GTQ").trim().toUpperCase();
  return MONEDAS_PERMITIDAS.includes(moneda) ? moneda : "GTQ";
}

function validarFecha(valor?: string, campo = "fecha") {
  const fecha = valor?.trim();
  if (!fecha) return undefined;
  if (Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
    throw new Error(`El campo ${campo} debe ser una fecha valida.`);
  }
  return fecha;
}

function resolverEmpresas(params: EstadosFinancierosParams) {
  const permitidas = (params.empresasIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (params.empresa_id !== undefined) {
    const empresaId = Number(params.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error("Debe indicar una empresa valida para estados financieros.");
    }
    return permitidas.includes(empresaId) ? [empresaId] : [];
  }

  return Array.from(new Set(permitidas));
}

function clasificarCuenta(tipoValor?: string | null, subtipoValor?: string | null) {
  const tipo = (tipoValor || "").trim().toLowerCase();
  const subtipo = (subtipoValor || "").trim().toLowerCase();
  const texto = `${tipo} ${subtipo}`;

  if (texto.includes("activo")) return "activo";
  if (texto.includes("pasivo")) return "pasivo";
  if (texto.includes("patrimonio") || texto.includes("capital")) return "patrimonio";
  if (texto.includes("ingreso") || texto.includes("venta")) return "ingreso";
  if (texto.includes("costo")) return "costo";
  if (texto.includes("financier")) return "gasto_financiero";
  if (texto.includes("gasto") || texto.includes("egreso")) return "gasto_operativo";

  return "sin_clasificar";
}

function totalizarSeccion(moneda: string, cuentas: BalanceComprobacionFormalFila[]) {
  return {
    moneda,
    total: numero(cuentas.reduce((acc, cuenta) => acc + cuenta.saldo_deudor + cuenta.saldo_acreedor, 0)),
    cuentas,
  };
}

function agruparPorMoneda(cuentas: BalanceComprobacionFormalFila[]) {
  const mapa = new Map<string, BalanceComprobacionFormalFila[]>();
  for (const cuenta of cuentas) {
    mapa.set(cuenta.moneda, [...(mapa.get(cuenta.moneda) || []), cuenta]);
  }
  return mapa;
}

function cuentaImporte(cuenta: BalanceComprobacionFormalFila) {
  return numero(cuenta.saldo_deudor + cuenta.saldo_acreedor);
}

export async function obtenerEstadosFinancierosFormales(
  params: EstadosFinancierosParams
): Promise<EstadosFinancierosFormales> {
  const empresas = resolverEmpresas(params);
  if (!empresas.length) {
    return {
      balance_comprobacion: [],
      balance_general: { activos: [], pasivos: [], patrimonio: [] },
      estado_resultados: [],
      periodos: [],
      preliminar: true,
      mensaje_preliminar: "No hay empresas permitidas para consultar estados financieros.",
    };
  }

  const monedaFiltro = params.moneda?.trim().toUpperCase();
  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");

  let query: any = supabase
    .from("asientos_contables")
    .select(
      "id,empresa_id,periodo_id,fecha,estado,periodos_contables(id,anio,mes,estado),movimientos_contables_detalle(cuenta_id,debe,haber,moneda,catalogo_cuentas(codigo,nombre,tipo,subtipo,naturaleza))"
    )
    .in("empresa_id", empresas)
    .eq("estado", "registrado");

  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);

  const { data, error } = await query.order("fecha", { ascending: true });
  if (error) {
    throw new Error(`No se pudieron cargar asientos formales: ${error.message}`);
  }

  const acumulado = new Map<string, BalanceComprobacionFormalFila>();
  const periodos = new Map<string, PeriodoEstadoFinanciero>();

  ((data || []) as AsientoFormalRow[]).forEach((asiento) => {
    if (asiento.periodos_contables) {
      periodos.set(String(asiento.periodos_contables.id), {
        id: asiento.periodos_contables.id,
        anio: asiento.periodos_contables.anio,
        mes: asiento.periodos_contables.mes,
        estado: asiento.periodos_contables.estado,
      });
    }

    (asiento.movimientos_contables_detalle || []).forEach((detalle) => {
      const moneda = normalizarMoneda(detalle.moneda);
      if (monedaFiltro && moneda !== monedaFiltro) return;

      const cuenta = detalle.catalogo_cuentas;
      const naturaleza = (cuenta?.naturaleza || "deudora").trim().toLowerCase();
      const key = `${detalle.cuenta_id}:${moneda}`;
      const actual =
        acumulado.get(key) ||
        ({
          cuenta_id: detalle.cuenta_id,
          codigo: cuenta?.codigo || String(detalle.cuenta_id),
          nombre: cuenta?.nombre || "Cuenta sin nombre",
          tipo: cuenta?.tipo || "sin_tipo",
          subtipo: cuenta?.subtipo || "",
          naturaleza,
          moneda,
          debe: 0,
          haber: 0,
          saldo_deudor: 0,
          saldo_acreedor: 0,
        } satisfies BalanceComprobacionFormalFila);

      actual.debe = numero(actual.debe + numero(detalle.debe));
      actual.haber = numero(actual.haber + numero(detalle.haber));

      const diferencia = numero(actual.debe - actual.haber);
      actual.saldo_deudor = diferencia > 0 ? diferencia : 0;
      actual.saldo_acreedor = diferencia < 0 ? Math.abs(diferencia) : 0;

      acumulado.set(key, actual);
    });
  });

  const balanceComprobacion = Array.from(acumulado.values()).sort((a, b) =>
    a.moneda.localeCompare(b.moneda) || a.codigo.localeCompare(b.codigo)
  );

  const porClasificacion = {
    activos: [] as BalanceComprobacionFormalFila[],
    pasivos: [] as BalanceComprobacionFormalFila[],
    patrimonio: [] as BalanceComprobacionFormalFila[],
    ingresos: [] as BalanceComprobacionFormalFila[],
    costos: [] as BalanceComprobacionFormalFila[],
    gastosOperativos: [] as BalanceComprobacionFormalFila[],
    gastosFinancieros: [] as BalanceComprobacionFormalFila[],
  };

  for (const cuenta of balanceComprobacion) {
    const clasificacion = clasificarCuenta(cuenta.tipo, cuenta.subtipo);
    if (clasificacion === "activo") porClasificacion.activos.push(cuenta);
    if (clasificacion === "pasivo") porClasificacion.pasivos.push(cuenta);
    if (clasificacion === "patrimonio") porClasificacion.patrimonio.push(cuenta);
    if (clasificacion === "ingreso") porClasificacion.ingresos.push(cuenta);
    if (clasificacion === "costo") porClasificacion.costos.push(cuenta);
    if (clasificacion === "gasto_operativo") porClasificacion.gastosOperativos.push(cuenta);
    if (clasificacion === "gasto_financiero") porClasificacion.gastosFinancieros.push(cuenta);
  }

  const activos = Array.from(agruparPorMoneda(porClasificacion.activos)).map(([moneda, cuentas]) =>
    totalizarSeccion(moneda, cuentas)
  );
  const pasivos = Array.from(agruparPorMoneda(porClasificacion.pasivos)).map(([moneda, cuentas]) =>
    totalizarSeccion(moneda, cuentas)
  );
  const patrimonio = Array.from(agruparPorMoneda(porClasificacion.patrimonio)).map(([moneda, cuentas]) =>
    totalizarSeccion(moneda, cuentas)
  );

  const monedasResultado = Array.from(
    new Set(balanceComprobacion.map((cuenta) => cuenta.moneda))
  ).sort();

  const estadoResultados = monedasResultado.map((moneda) => {
    const ingresos = porClasificacion.ingresos.filter((cuenta) => cuenta.moneda === moneda);
    const costos = porClasificacion.costos.filter((cuenta) => cuenta.moneda === moneda);
    const gastosOperativos = porClasificacion.gastosOperativos.filter((cuenta) => cuenta.moneda === moneda);
    const gastosFinancieros = porClasificacion.gastosFinancieros.filter((cuenta) => cuenta.moneda === moneda);
    const totalIngresos = numero(ingresos.reduce((acc, cuenta) => acc + cuentaImporte(cuenta), 0));
    const totalCostos = numero(costos.reduce((acc, cuenta) => acc + cuentaImporte(cuenta), 0));
    const totalGastosOperativos = numero(gastosOperativos.reduce((acc, cuenta) => acc + cuentaImporte(cuenta), 0));
    const totalGastosFinancieros = numero(gastosFinancieros.reduce((acc, cuenta) => acc + cuentaImporte(cuenta), 0));

    return {
      moneda,
      ingresos: totalIngresos,
      costos: totalCostos,
      gastos_operativos: totalGastosOperativos,
      gastos_financieros: totalGastosFinancieros,
      utilidad_perdida: numero(totalIngresos - totalCostos - totalGastosOperativos - totalGastosFinancieros),
      cuentas_ingresos: ingresos,
      cuentas_costos: costos,
      cuentas_gastos_operativos: gastosOperativos,
      cuentas_gastos_financieros: gastosFinancieros,
    };
  });

  const periodosLista = Array.from(periodos.values()).sort(
    (a, b) => a.anio - b.anio || a.mes - b.mes
  );
  const preliminar =
    !periodosLista.length ||
    periodosLista.some((periodo) => periodo.estado !== "cerrado");

  return {
    balance_comprobacion: balanceComprobacion,
    balance_general: { activos, pasivos, patrimonio },
    estado_resultados: estadoResultados,
    periodos: periodosLista,
    preliminar,
    mensaje_preliminar: preliminar
      ? "Estados financieros preliminares: existen periodos abiertos, bloqueados o sin cierre formal."
      : "Estados financieros sobre periodos cerrados.",
  };
}
