import { supabase } from "./supabase";

export interface EstadosFinancierosParams {
  empresasIds: number[];
  empresa_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  moneda?: string;
  periodo_id?: string | number;
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
  empresa_id: number;
  anio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  cerrado_at: string | null;
}

export interface LibroDiarioFila {
  asiento_id: string | number;
  empresa_id: number;
  periodo_id: string | number;
  fecha: string;
  descripcion: string;
  origen_modulo: string | null;
  moneda: string;
  cuenta_id: string | number;
  codigo: string;
  cuenta: string;
  detalle: string | null;
  debe: number;
  haber: number;
}

export interface LibroMayorCuenta {
  cuenta_id: string | number;
  codigo: string;
  nombre: string;
  tipo: string;
  subtipo: string;
  naturaleza: string;
  moneda: string;
  total_debe: number;
  total_haber: number;
  saldo: number;
  movimientos: Array<LibroDiarioFila & { saldo_acumulado: number }>;
}

export interface EstadosFinancierosFormales {
  balance_comprobacion: BalanceComprobacionFormalFila[];
  balance_general: {
    activos: EstadoFinancieroSeccion[];
    pasivos: EstadoFinancieroSeccion[];
    patrimonio: EstadoFinancieroSeccion[];
  };
  estado_resultados: EstadoResultadosSeccion[];
  libro_diario: LibroDiarioFila[];
  libro_mayor: LibroMayorCuenta[];
  cuentas_sin_clasificar: BalanceComprobacionFormalFila[];
  periodos: PeriodoEstadoFinanciero[];
  preliminar: boolean;
  mensaje_preliminar: string;
}

interface AsientoFormalRow {
  id: string | number;
  empresa_id: number;
  periodo_id: string | number;
  fecha: string;
  descripcion: string;
  origen_modulo: string | null;
  estado: string;
  movimientos_contables_detalle?: DetalleFormalRow[];
}

interface DetalleFormalRow {
  cuenta_id: string | number;
  descripcion: string | null;
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
      libro_diario: [],
      libro_mayor: [],
      cuentas_sin_clasificar: [],
      periodos: [],
      preliminar: true,
      mensaje_preliminar: "No hay empresas permitidas para consultar estados financieros.",
    };
  }

  const monedaFiltro = params.moneda?.trim().toUpperCase();
  const fechaDesde = validarFecha(params.fecha_desde, "fecha_desde");
  const fechaHasta = validarFecha(params.fecha_hasta, "fecha_hasta");
  const periodoId =
    params.periodo_id === undefined || params.periodo_id === null || params.periodo_id === ""
      ? undefined
      : String(params.periodo_id);

  const asientosFormales: AsientoFormalRow[] = [];
  const tamanoPagina = 500;
  let desde = 0;

  while (true) {
    let query: any = supabase
      .from("asientos_contables")
      .select(
        "id,empresa_id,periodo_id,fecha,descripcion,origen_modulo,estado,movimientos_contables_detalle(cuenta_id,descripcion,debe,haber,moneda,catalogo_cuentas(codigo,nombre,tipo,subtipo,naturaleza))"
      )
      .in("empresa_id", empresas)
      .eq("estado", "registrado");

    if (periodoId) query = query.eq("periodo_id", periodoId);
    if (fechaDesde) query = query.gte("fecha", fechaDesde);
    if (fechaHasta) query = query.lte("fecha", fechaHasta);

    const { data, error } = await query
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, desde + tamanoPagina - 1);
    if (error) {
      throw new Error(`No se pudieron cargar asientos formales: ${error.message}`);
    }

    const pagina = (data || []) as AsientoFormalRow[];
    asientosFormales.push(...pagina);
    if (pagina.length < tamanoPagina) break;
    desde += tamanoPagina;
  }

  const acumulado = new Map<string, BalanceComprobacionFormalFila>();
  const libroDiario: LibroDiarioFila[] = [];

  asientosFormales.forEach((asiento) => {
    (asiento.movimientos_contables_detalle || []).forEach((detalle) => {
      const moneda = normalizarMoneda(detalle.moneda);
      if (monedaFiltro && moneda !== monedaFiltro) return;

      const cuenta = detalle.catalogo_cuentas;
      const naturaleza = (cuenta?.naturaleza || "deudora").trim().toLowerCase();
      libroDiario.push({
        asiento_id: asiento.id,
        empresa_id: asiento.empresa_id,
        periodo_id: asiento.periodo_id,
        fecha: asiento.fecha,
        descripcion: asiento.descripcion,
        origen_modulo: asiento.origen_modulo,
        moneda,
        cuenta_id: detalle.cuenta_id,
        codigo: cuenta?.codigo || String(detalle.cuenta_id),
        cuenta: cuenta?.nombre || "Cuenta sin nombre",
        detalle: detalle.descripcion,
        debe: numero(detalle.debe),
        haber: numero(detalle.haber),
      });
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
  const libroMayor = balanceComprobacion.map((cuenta) => {
    let saldoAcumulado = 0;
    const movimientos = libroDiario
      .filter(
        (fila) =>
          String(fila.cuenta_id) === String(cuenta.cuenta_id) &&
          fila.moneda === cuenta.moneda
      )
      .map((fila) => {
        saldoAcumulado = numero(
          saldoAcumulado +
            (cuenta.naturaleza === "acreedora"
              ? fila.haber - fila.debe
              : fila.debe - fila.haber)
        );
        return { ...fila, saldo_acumulado: saldoAcumulado };
      });
    const diferencia = numero(cuenta.debe - cuenta.haber);
    return {
      cuenta_id: cuenta.cuenta_id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      subtipo: cuenta.subtipo,
      naturaleza: cuenta.naturaleza,
      moneda: cuenta.moneda,
      total_debe: cuenta.debe,
      total_haber: cuenta.haber,
      saldo:
        cuenta.naturaleza === "acreedora" ? numero(-diferencia) : diferencia,
      movimientos,
    } satisfies LibroMayorCuenta;
  });

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

  let periodosQuery: any = supabase
    .from("periodos_contables")
    .select("id,empresa_id,anio,mes,fecha_inicio,fecha_fin,estado,cerrado_at")
    .in("empresa_id", empresas);
  if (periodoId) periodosQuery = periodosQuery.eq("id", periodoId);
  if (fechaDesde) periodosQuery = periodosQuery.gte("fecha_fin", fechaDesde);
  if (fechaHasta) periodosQuery = periodosQuery.lte("fecha_inicio", fechaHasta);

  const { data: periodosData, error: periodosError } = await periodosQuery.order(
    "fecha_inicio",
    { ascending: true }
  );
  if (periodosError) {
    throw new Error(`No se pudieron cargar periodos contables: ${periodosError.message}`);
  }

  const periodosLista = ((periodosData || []) as PeriodoEstadoFinanciero[]).sort(
    (a, b) => a.anio - b.anio || a.mes - b.mes
  );
  const preliminar =
    !periodosLista.length ||
    periodosLista.some((periodo) => periodo.estado !== "cerrado");

  return {
    balance_comprobacion: balanceComprobacion,
    balance_general: { activos, pasivos, patrimonio },
    estado_resultados: estadoResultados,
    libro_diario: libroDiario,
    libro_mayor: libroMayor,
    cuentas_sin_clasificar: balanceComprobacion.filter(
      (cuenta) => clasificarCuenta(cuenta.tipo, cuenta.subtipo) === "sin_clasificar"
    ),
    periodos: periodosLista,
    preliminar,
    mensaje_preliminar: preliminar
      ? "Estados financieros preliminares: existen periodos abiertos, bloqueados o sin cierre formal."
      : "Estados financieros sobre periodos cerrados.",
  };
}
