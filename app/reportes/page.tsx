"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileText,
  Printer,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import {
  abrirVistaImprimibleSecciones,
  descargarCsvSecciones,
  type SeccionExportacion,
} from "../../lib/exportaciones";
import {
  esEmpresaOperativaVisible,
  obtenerEmpresasOperativasDesdeIds,
} from "../../lib/empresasOperativas";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { registrarRateLimitOperativo } from "../../lib/rateLimitOperativo";
import {
  obtenerReporteMensual,
  type CalendarioPago,
  type ChequeReporte,
  type CuentaOperativaReporte,
  type PagoParcialReporte,
  type FondoPorEmpresa,
  type OrdenReporte,
  type ReporteMensual,
  type ReportesFinancierosParams,
} from "../../lib/reportesFinancieros";
import {
  obtenerEstadosFinancierosFormales,
  type BalanceComprobacionFormalFila,
  type EstadoResultadosSeccion,
  type EstadosFinancierosFormales,
  type LibroDiarioFila,
  type LibroMayorCuenta,
  type PeriodoEstadoFinanciero,
} from "../../lib/estadosFinancieros";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import toast, { Toaster } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface FiltrosReportes {
  empresaId: string;
  fechaDesde: string;
  fechaHasta: string;
  moneda: string;
  periodoId: string;
  estado: string;
  proveedorClienteId: string;
}

type ReporteEntregaExportable =
  | "balance_comprobacion"
  | "libro_diario"
  | "libro_mayor"
  | "estado_resultados"
  | "movimientos_operativos"
  | "cierres_periodos";

const LIMITE_REPORTES = 100;
const LIMITE_FILAS_EXPORTACION_REPORTES = 1000;
const RATE_LIMIT_EXPORTACIONES_REPORTES = 10;
const RATE_LIMIT_EXPORTACIONES_REPORTES_SEGUNDOS = 15 * 60;
const RATE_LIMIT_EXPORTACIONES_REPORTES_PESADAS = 5;
const RATE_LIMIT_EXPORTACIONES_REPORTES_PESADAS_SEGUNDOS = 30 * 60;
const UMBRAL_EXPORTACION_PESADA_REPORTES = 500;
const VENTANA_EXPORTACION_REPETIDA_MS = 2000;

function fechaLocalISO(fecha = new Date()) {
  const copia = new Date(fecha);
  copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset());
  return copia.toISOString().slice(0, 10);
}

function inicioMesISO() {
  const hoy = new Date();
  return fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

const FILTROS_INICIALES: FiltrosReportes = {
  empresaId: "",
  fechaDesde: inicioMesISO(),
  fechaHasta: fechaLocalISO(),
  moneda: "",
  periodoId: "",
  estado: "",
  proveedorClienteId: "",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado.";
}

function mostrarFecha(valor: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;

  return fecha.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatoMonto(valor: number, moneda?: string | null) {
  const monedaNormalizada = moneda?.trim().toUpperCase();

  if (monedaNormalizada === "GTQ" || monedaNormalizada === "USD") {
    return new Intl.NumberFormat(monedaNormalizada === "USD" ? "en-US" : "es-GT", {
      style: "currency",
      currency: monedaNormalizada,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(valor || 0));
  }

  return Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function textoLegible(valor: string | null | undefined) {
  return valor ? valor.replaceAll("_", " ") : "-";
}

function estadoClase(estado: string | null | undefined) {
  const normalizado = (estado || "").toLowerCase();
  if (normalizado.includes("pagado") || normalizado.includes("aprob")) {
    return "border-green-400/30 bg-green-400/10 text-green-200";
  }
  if (normalizado.includes("anulad") || normalizado.includes("rechaz")) {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }
  if (normalizado.includes("observ")) {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
}

function fuenteClase(fuente: CalendarioPago["fuente"]) {
  if (fuente === "cheques") return "border-green-400/30 bg-green-400/10 text-green-200";
  if (fuente === "ordenes") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (fuente === "cxp") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (fuente === "cxc") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  return "border-purple-400/30 bg-purple-400/10 text-purple-200";
}

export default function ReportesPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<FiltrosReportes>(FILTROS_INICIALES);
  const [filtrosCargados, setFiltrosCargados] =
    useState<FiltrosReportes>(FILTROS_INICIALES);
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [estadosFinancieros, setEstadosFinancieros] =
    useState<EstadosFinancierosFormales | null>(null);
  const [periodosDisponibles, setPeriodosDisponibles] = useState<PeriodoEstadoFinanciero[]>([]);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null);
  const exportacionEnProcesoRef = useRef(false);
  const ultimaExportacionAtRef = useRef(0);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("reportes");

        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );

          if (!volverLogin) {
            toast.error("No tienes acceso al modulo Reportes.");
          }

          router.replace(volverLogin ? "/login" : "/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasAsignadasReportes(acceso.user!.id);
        const empresasOperativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const idsOperativos = empresasOperativas.ids;
        const funciones = await listarFuncionesOperativasUsuario(acceso.user!.id, idsOperativos);

        if (!activo) return;

        setUsuarioActualId(acceso.user!.id);
        setEmpresasPermitidasIds(idsOperativos);
        setFuncionesOperativas(funciones);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!idsOperativos.length) {
          setEmpresas([]);
          setReporte(null);
          setEstadosFinancieros(null);
          setAviso("No tienes empresas operativas asignadas para consultar reportes.");
          return;
        }

        setEmpresas(empresasOperativas.empresas);
        await Promise.all([
          cargarEmpresas(idsOperativos),
          cargarPeriodosReportes(idsOperativos),
          cargarReporte(idsOperativos, FILTROS_INICIALES),
        ]);
      } catch (error) {
        console.error("Error validando acceso a reportes:", error);

        if (activo) {
          setValidandoAcceso(false);
          router.replace("/dashboard");
        }
      }
    }

    void iniciar();

    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarEmpresas(idsPermitidos: number[]) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre,estado")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando empresas para reportes:", error);
      setAviso("No se pudo cargar el catalogo de empresas para filtros.");
      return;
    }

    setEmpresas(((data || []) as Empresa[]).filter(esEmpresaOperativaVisible));
  }

  async function obtenerEmpresasAsignadasReportes(usuarioId: string) {
    const { data, error } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", usuarioId)
      .eq("activo", true);

    if (error) {
      throw new Error(`No se pudieron validar empresas asignadas para reportes: ${error.message}`);
    }

    return Array.from(
      new Set(
        (data || [])
          .map((asignacion) => Number(asignacion.empresa_id))
          .filter((empresaId) => Number.isInteger(empresaId) && empresaId > 0)
      )
    );
  }

  async function cargarPeriodosReportes(idsPermitidos: number[]) {
    if (!idsPermitidos.length) {
      setPeriodosDisponibles([]);
      return;
    }

    const { data, error } = await supabase
      .from("periodos_contables")
      .select("id,empresa_id,anio,mes,fecha_inicio,fecha_fin,estado,cerrado_at")
      .in("empresa_id", idsPermitidos)
      .order("fecha_inicio", { ascending: false });

    if (error) {
      console.error("Error cargando periodos para reportes:", error);
      setPeriodosDisponibles([]);
      return;
    }

    setPeriodosDisponibles((data || []) as PeriodoEstadoFinanciero[]);
  }

  async function cargarReporte(
    idsPermitidos: number[],
    filtrosAplicados: FiltrosReportes
  ) {
    if (cargandoReportes) return;

    setCargandoReportes(true);
    setErrorCarga(null);

    try {
      if (!idsPermitidos.length) {
        setReporte(null);
        setEstadosFinancieros(null);
        setAviso("No tienes empresas operativas asignadas para consultar reportes.");
        return;
      }

      const empresaId = filtrosAplicados.empresaId
        ? Number(filtrosAplicados.empresaId)
        : undefined;

      if (
        empresaId !== undefined &&
        (!Number.isInteger(empresaId) || !idsPermitidos.includes(empresaId))
      ) {
        setReporte(null);
        setEstadosFinancieros(null);
        setErrorCarga("La empresa seleccionada no esta autorizada.");
        void auditarReporte("bloquear_consulta_reporte", {
          filtros: filtrosAplicados,
          motivo: "empresa_no_permitida",
        });
        void registrarIntentoBloqueadoReporte("empresa_no_permitida", {
          accion: "consultar_reporte",
          filtros: filtrosAplicados,
        });
        return;
      }

      const params: ReportesFinancierosParams = {
        empresasIds: idsPermitidos,
        empresa_id: empresaId,
        fecha_desde: filtrosAplicados.fechaDesde || undefined,
        fecha_hasta: filtrosAplicados.fechaHasta || undefined,
        moneda: filtrosAplicados.moneda || undefined,
        periodo_id: filtrosAplicados.periodoId || undefined,
        estado: filtrosAplicados.estado || undefined,
        proveedor_id: filtrosAplicados.proveedorClienteId || undefined,
        cliente_id: filtrosAplicados.proveedorClienteId || undefined,
        limite: LIMITE_REPORTES,
      };

      const [reporteMensual, estadosFormales] = await Promise.all([
        obtenerReporteMensual(params),
        obtenerEstadosFinancierosFormales(params),
      ]);
      setReporte(reporteMensual);
      setEstadosFinancieros(estadosFormales);
      setFiltrosCargados(filtrosAplicados);
      await auditarReporte("consultar_reporte", {
        filtros: filtrosAplicados,
        empresas_consultadas: idsPermitidos,
        total_movimientos: reporteMensual.resumen.total_movimientos,
        cxp_cuentas: reporteMensual.cuentas_por_pagar.cuentas.length,
        cxc_cuentas: reporteMensual.cuentas_por_cobrar.cuentas.length,
        balance_formal_cuentas: estadosFormales.balance_comprobacion.length,
        estados_formales_preliminares: estadosFormales.preliminar,
      });
      setAviso(null);
    } catch (error) {
      console.error("Error cargando reportes:", error);
      setReporte(null);
      setEstadosFinancieros(null);
      setErrorCarga(getErrorMessage(error));
    } finally {
      setCargandoReportes(false);
    }
  }

  async function aplicarFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await cargarReporte(empresasPermitidasIds, filtros);
  }

  async function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES);
    await cargarReporte(empresasPermitidasIds, FILTROS_INICIALES);
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );
  const periodosParaFiltro = useMemo(
    () =>
      periodosDisponibles.filter(
        (periodo) =>
          !filtros.empresaId || Number(periodo.empresa_id) === Number(filtros.empresaId)
      ),
    [filtros.empresaId, periodosDisponibles]
  );

  function seleccionarPeriodo(periodoId: string) {
    const periodo = periodosDisponibles.find(
      (opcion) => String(opcion.id) === String(periodoId)
    );
    setFiltros({
      ...filtros,
      periodoId,
      ...(periodo
        ? {
            empresaId: String(periodo.empresa_id),
            fechaDesde: periodo.fecha_inicio,
            fechaHasta: periodo.fecha_fin,
          }
        : {}),
    });
  }

  const totalesFondos = useMemo(() => {
    const porMoneda = new Map<string, { moneda: string; disponible: number; comprometido: number }>();
    for (const fondo of reporte?.fondos || []) {
      const moneda = fondo.moneda || "GTQ";
      const actual = porMoneda.get(moneda) || { moneda, disponible: 0, comprometido: 0 };
      actual.disponible += Number(fondo.saldo_disponible || 0);
      actual.comprometido += Number(fondo.saldo_comprometido || 0);
      porMoneda.set(moneda, actual);
    }
    return Array.from(porMoneda.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));
  }, [reporte]);

  function textoEmpresaFiltro() {
    if (!filtrosCargados.empresaId) return "Todas las empresas permitidas";
    return (
      empresasPorId.get(Number(filtrosCargados.empresaId)) ||
      `Empresa #${filtrosCargados.empresaId}`
    );
  }

  function textoPeriodoFiltro() {
    if (!filtrosCargados.periodoId) return "Rango de fechas";
    const periodo = periodosDisponibles.find(
      (opcion) => String(opcion.id) === String(filtrosCargados.periodoId)
    );
    return periodo
      ? `${periodo.mes}/${periodo.anio} - ${textoLegible(periodo.estado)}`
      : String(filtrosCargados.periodoId);
  }

  function infoDocumentoExportacion(nombreReporte: string) {
    return {
      encabezado: {
        Reporte: nombreReporte,
        Empresa: textoEmpresaFiltro(),
        Periodo: textoPeriodoFiltro(),
        Moneda: filtrosCargados.moneda || "Todas",
        "Fecha desde": filtrosCargados.fechaDesde || "",
        "Fecha hasta": filtrosCargados.fechaHasta || "",
        "Fecha de generacion": new Date(),
      },
      notaPie: "Control+ | Reporte generado desde el sistema.",
    };
  }

  function configuracionReporteEntrega(tipo: ReporteEntregaExportable) {
    const configuraciones: Record<
      ReporteEntregaExportable,
      { titulo: string; tituloSeccion: string; archivo: string; imprimible: boolean }
    > = {
      balance_comprobacion: {
        titulo: "Balance de comprobacion",
        tituloSeccion: "Balance de comprobacion formal",
        archivo: "balance-comprobacion",
        imprimible: true,
      },
      libro_diario: {
        titulo: "Libro diario",
        tituloSeccion: "Libro diario formal",
        archivo: "libro-diario",
        imprimible: true,
      },
      libro_mayor: {
        titulo: "Libro mayor",
        tituloSeccion: "Libro mayor formal",
        archivo: "libro-mayor",
        imprimible: true,
      },
      estado_resultados: {
        titulo: "Estado de resultados",
        tituloSeccion: "Estado de resultados formal",
        archivo: "estado-resultados",
        imprimible: true,
      },
      movimientos_operativos: {
        titulo: "Resumen de movimientos operativos",
        tituloSeccion: "Movimientos operativos por moneda",
        archivo: "movimientos-operativos",
        imprimible: false,
      },
      cierres_periodos: {
        titulo: "Cierres y periodos contables",
        tituloSeccion: "Cierres y periodos contables",
        archivo: "cierres-periodos",
        imprimible: true,
      },
    };
    return configuraciones[tipo];
  }

  function seccionesReporteEntrega(tipo: ReporteEntregaExportable) {
    const configuracion = configuracionReporteEntrega(tipo);
    return seccionesExportacionReportes().filter(
      (seccion) => seccion.titulo === configuracion.tituloSeccion
    );
  }

  function seccionesExportacionReportes(): SeccionExportacion[] {
    if (!reporte) return [];

    const filtrosResumen = {
      Empresa: textoEmpresaFiltro(),
      "Fecha desde": filtrosCargados.fechaDesde || "",
      "Fecha hasta": filtrosCargados.fechaHasta || "",
      Moneda: filtrosCargados.moneda || "Todas",
      Periodo: textoPeriodoFiltro(),
      Estado: filtrosCargados.estado || "Todos",
      "Proveedor/cliente ID": filtrosCargados.proveedorClienteId || "Todos",
    };

    const secciones: SeccionExportacion[] = [
      {
        titulo: "Filtros aplicados",
        columnas: [
          { clave: "filtro", titulo: "Filtro" },
          { clave: "valor", titulo: "Valor" },
        ],
        filas: Object.entries(filtrosResumen).map(([filtro, valor]) => ({
          filtro,
          valor,
        })),
      },
      {
        titulo: "Movimientos operativos por moneda",
        columnas: [
          { clave: "moneda", titulo: "Moneda" },
          { clave: "ingresos", titulo: "Ingresos" },
          { clave: "egresos", titulo: "Egresos" },
          { clave: "neto", titulo: "Neto" },
          { clave: "total_movimientos", titulo: "Total movimientos" },
          { clave: "movimientos_anulados", titulo: "Movimientos anulados" },
        ],
        filas: reporte.resumen.por_moneda.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Fondos por empresa/cuenta",
        columnas: [
          { clave: "empresa", titulo: "Empresa" },
          { clave: "banco", titulo: "Banco" },
          { clave: "cuenta_bancaria", titulo: "Cuenta bancaria" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "saldo_base", titulo: "Saldo base" },
          { clave: "saldo_comprometido", titulo: "Saldo comprometido" },
          { clave: "saldo_disponible", titulo: "Saldo disponible" },
          { clave: "estado", titulo: "Estado" },
        ],
        filas: reporte.fondos.map((fondo) => ({
          ...fondo,
          empresa: fondo.empresa || empresasPorId.get(Number(fondo.empresa_id)) || "",
        })),
      },
      {
        titulo: "Cheques resumen",
        columnas: [
          { clave: "pendientes", titulo: "Pendientes" },
          { clave: "autorizados", titulo: "Autorizados" },
          { clave: "pagados", titulo: "Pagados" },
          { clave: "rechazados", titulo: "Rechazados" },
          { clave: "anulados", titulo: "Anulados" },
          { clave: "monto_pendiente", titulo: "Monto pendiente" },
          { clave: "monto_pagado", titulo: "Monto pagado" },
        ],
        filas: [
          {
            pendientes: reporte.cheques.pendientes,
            autorizados: reporte.cheques.autorizados,
            pagados: reporte.cheques.pagados,
            rechazados: reporte.cheques.rechazados,
            anulados: reporte.cheques.anulados,
            monto_pendiente: reporte.cheques.monto_pendiente,
            monto_pagado: reporte.cheques.monto_pagado,
          },
        ],
      },
      {
        titulo: "Cheques proximos pagos",
        columnas: [
          { clave: "fecha_pago", titulo: "Fecha pago" },
          { clave: "empresa", titulo: "Empresa" },
          { clave: "beneficiario", titulo: "Beneficiario" },
          { clave: "concepto", titulo: "Concepto" },
          { clave: "numero_cheque", titulo: "Numero cheque" },
          { clave: "monto", titulo: "Monto" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "forma_pago", titulo: "Forma pago" },
          { clave: "estado", titulo: "Estado" },
        ],
        filas: reporte.cheques.proximos_pagos.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Cheques por moneda",
        columnas: [
          { clave: "moneda", titulo: "Moneda" },
          { clave: "monto_pendiente", titulo: "Monto pendiente" },
          { clave: "monto_pagado", titulo: "Monto pagado" },
          { clave: "total_movimientos", titulo: "Total" },
        ],
        filas: reporte.cheques.por_moneda.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Ordenes resumen",
        columnas: [
          { clave: "pendientes", titulo: "Pendientes" },
          { clave: "aprobadas", titulo: "Aprobadas" },
          { clave: "observadas", titulo: "Observadas" },
          { clave: "anuladas_rechazadas", titulo: "Anuladas/rechazadas" },
          { clave: "monto_pendiente", titulo: "Monto pendiente" },
          { clave: "monto_aprobado", titulo: "Monto aprobado" },
        ],
        filas: [
          {
            pendientes: reporte.ordenes.pendientes,
            aprobadas: reporte.ordenes.aprobadas,
            observadas: reporte.ordenes.observadas,
            anuladas_rechazadas: reporte.ordenes.anuladas_rechazadas,
            monto_pendiente: reporte.ordenes.monto_pendiente,
            monto_aprobado: reporte.ordenes.monto_aprobado,
          },
        ],
      },
      {
        titulo: "Ordenes proximas",
        columnas: [
          { clave: "fecha_necesaria", titulo: "Fecha necesaria" },
          { clave: "empresa", titulo: "Empresa" },
          { clave: "proveedor", titulo: "Proveedor" },
          { clave: "concepto", titulo: "Concepto" },
          { clave: "numero_orden", titulo: "Numero orden" },
          { clave: "numero_factura", titulo: "Numero factura" },
          { clave: "monto", titulo: "Monto" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "estado", titulo: "Estado" },
        ],
        filas: reporte.ordenes.proximas_ordenes.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Ordenes por moneda",
        columnas: [
          { clave: "moneda", titulo: "Moneda" },
          { clave: "monto_pendiente", titulo: "Monto pendiente" },
          { clave: "monto_aprobado", titulo: "Monto aprobado" },
          { clave: "total_movimientos", titulo: "Total" },
        ],
        filas: reporte.ordenes.por_moneda.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Calendario de pagos",
        columnas: [
          { clave: "fecha", titulo: "Fecha" },
          { clave: "fuente", titulo: "Fuente" },
          { clave: "empresa_id", titulo: "Empresa ID" },
          { clave: "titulo", titulo: "Titulo" },
          { clave: "monto", titulo: "Monto" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "estado", titulo: "Estado" },
        ],
        filas: reporte.calendario.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Cuentas por pagar",
        columnas: [
          { clave: "tercero", titulo: "Proveedor" },
          { clave: "numero_documento", titulo: "Documento" },
          { clave: "fecha_documento", titulo: "Fecha documento" },
          { clave: "fecha_vencimiento", titulo: "Vence" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "total", titulo: "Total" },
          { clave: "saldo_pendiente", titulo: "Saldo" },
          { clave: "estado", titulo: "Estado" },
          { clave: "vencida", titulo: "Vencida" },
        ],
        filas: reporte.cuentas_por_pagar.cuentas.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Pagos parciales CxP",
        columnas: [
          { clave: "cuenta_id", titulo: "Cuenta" },
          { clave: "fecha_pago", titulo: "Fecha pago" },
          { clave: "metodo_pago", titulo: "Metodo" },
          { clave: "banco", titulo: "Banco" },
          { clave: "referencia", titulo: "Referencia" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "monto", titulo: "Monto" },
          { clave: "estado", titulo: "Estado" },
        ],
        filas: reporte.cuentas_por_pagar.pagos_parciales.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Cuentas por cobrar",
        columnas: [
          { clave: "tercero", titulo: "Cliente" },
          { clave: "numero_documento", titulo: "Documento" },
          { clave: "fecha_documento", titulo: "Fecha documento" },
          { clave: "fecha_vencimiento", titulo: "Vence" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "total", titulo: "Total" },
          { clave: "saldo_pendiente", titulo: "Saldo" },
          { clave: "estado", titulo: "Estado" },
          { clave: "vencida", titulo: "Vencida" },
        ],
        filas: reporte.cuentas_por_cobrar.cuentas.map((fila) => ({ ...fila })),
      },
      {
        titulo: "Cobros parciales CxC",
        columnas: [
          { clave: "cuenta_id", titulo: "Cuenta" },
          { clave: "fecha_pago", titulo: "Fecha cobro" },
          { clave: "metodo_pago", titulo: "Metodo" },
          { clave: "banco", titulo: "Banco" },
          { clave: "referencia", titulo: "Referencia" },
          { clave: "moneda", titulo: "Moneda" },
          { clave: "monto", titulo: "Monto" },
          { clave: "estado", titulo: "Estado" },
        ],
        filas: reporte.cuentas_por_cobrar.pagos_parciales.map((fila) => ({ ...fila })),
      },
    ];

    if (estadosFinancieros) {
      secciones.push(
        {
          titulo: "Balance de comprobacion formal",
          resumen: {
            Estado: estadosFinancieros.preliminar ? "Preliminar" : "Periodo cerrado",
            Mensaje: estadosFinancieros.mensaje_preliminar,
          },
          columnas: [
            { clave: "codigo", titulo: "Codigo" },
            { clave: "nombre", titulo: "Cuenta" },
            { clave: "tipo", titulo: "Tipo" },
            { clave: "moneda", titulo: "Moneda" },
            { clave: "debe", titulo: "Debe" },
            { clave: "haber", titulo: "Haber" },
            { clave: "saldo_deudor", titulo: "Saldo deudor" },
            { clave: "saldo_acreedor", titulo: "Saldo acreedor" },
          ],
          filas: estadosFinancieros.balance_comprobacion.map((fila) => ({ ...fila })),
        },
        {
          titulo: "Balance general formal",
          columnas: [
            { clave: "seccion", titulo: "Seccion" },
            { clave: "moneda", titulo: "Moneda" },
            { clave: "total", titulo: "Total" },
            { clave: "cuentas", titulo: "Cuentas" },
          ],
          filas: [
            ...estadosFinancieros.balance_general.activos.map((fila) => ({
              seccion: "Activos",
              moneda: fila.moneda,
              total: fila.total,
              cuentas: fila.cuentas.length,
            })),
            ...estadosFinancieros.balance_general.pasivos.map((fila) => ({
              seccion: "Pasivos",
              moneda: fila.moneda,
              total: fila.total,
              cuentas: fila.cuentas.length,
            })),
            ...estadosFinancieros.balance_general.patrimonio.map((fila) => ({
              seccion: "Patrimonio",
              moneda: fila.moneda,
              total: fila.total,
              cuentas: fila.cuentas.length,
            })),
          ],
        },
        {
          titulo: "Estado de resultados formal",
          columnas: [
            { clave: "moneda", titulo: "Moneda" },
            { clave: "ingresos", titulo: "Ingresos" },
            { clave: "costos", titulo: "Costos" },
            { clave: "gastos_operativos", titulo: "Gastos operativos" },
            { clave: "gastos_financieros", titulo: "Gastos financieros" },
            { clave: "utilidad_perdida", titulo: "Utilidad/perdida" },
          ],
          filas: estadosFinancieros.estado_resultados.map((fila) => ({ ...fila })),
        },
        {
          titulo: "Libro diario formal",
          columnas: [
            { clave: "fecha", titulo: "Fecha" },
            { clave: "asiento_id", titulo: "Asiento" },
            { clave: "descripcion", titulo: "Descripcion asiento" },
            { clave: "codigo", titulo: "Codigo cuenta" },
            { clave: "cuenta", titulo: "Cuenta" },
            { clave: "detalle", titulo: "Detalle" },
            { clave: "moneda", titulo: "Moneda" },
            { clave: "debe", titulo: "Debe" },
            { clave: "haber", titulo: "Haber" },
          ],
          filas: estadosFinancieros.libro_diario.map((fila) => ({ ...fila })),
        },
        {
          titulo: "Libro mayor formal",
          columnas: [
            { clave: "codigo", titulo: "Codigo" },
            { clave: "nombre", titulo: "Cuenta" },
            { clave: "fecha", titulo: "Fecha" },
            { clave: "asiento_id", titulo: "Asiento" },
            { clave: "descripcion", titulo: "Descripcion" },
            { clave: "moneda", titulo: "Moneda" },
            { clave: "debe", titulo: "Debe" },
            { clave: "haber", titulo: "Haber" },
            { clave: "saldo_acumulado", titulo: "Saldo acumulado" },
          ],
          filas: estadosFinancieros.libro_mayor.flatMap((cuenta) =>
            cuenta.movimientos.map((movimiento) => ({
              codigo: cuenta.codigo,
              nombre: cuenta.nombre,
              fecha: movimiento.fecha,
              asiento_id: movimiento.asiento_id,
              descripcion: movimiento.detalle || movimiento.descripcion,
              moneda: cuenta.moneda,
              debe: movimiento.debe,
              haber: movimiento.haber,
              saldo_acumulado: movimiento.saldo_acumulado,
            }))
          ),
        },
        {
          titulo: "Cierres y periodos contables",
          columnas: [
            { clave: "empresa_id", titulo: "Empresa ID" },
            { clave: "anio", titulo: "Anio" },
            { clave: "mes", titulo: "Mes" },
            { clave: "fecha_inicio", titulo: "Fecha inicio" },
            { clave: "fecha_fin", titulo: "Fecha fin" },
            { clave: "estado", titulo: "Estado" },
            { clave: "cerrado_at", titulo: "Cerrado en" },
          ],
          filas: estadosFinancieros.periodos.map((fila) => ({ ...fila })),
        }
      );
    }

    return secciones;
  }

  async function exportarCsv() {
    const secciones = seccionesExportacionReportes();
    if (!secciones.length) {
      toast.error("No hay datos de reportes para exportar.");
      return;
    }

    const totalFilas = totalFilasSecciones(secciones);
    if (!validarExportacionReporte("csv", totalFilas)) {
      return;
    }

    const rateLimit = await validarRateLimitExportacionReporte("csv", totalFilas);
    if (!rateLimit.permitido) {
      liberarExportacionReporte();
      toast.error(rateLimit.mensaje);
      void auditarReporte("bloquear_exportacion_reporte", {
        formato: "csv",
        filtros: filtrosCargados,
        motivo: "rate_limit_excedido",
        filas_aproximadas: totalFilas,
        retry_after_segundos: rateLimit.retry_after_segundos,
        rpc_registro_intento_bloqueado: rateLimit.rpc_disponible,
      });
      return;
    }

    void auditarReporte("exportar_reporte", {
      formato: "csv",
      filtros: filtrosCargados,
      secciones: secciones.length,
      filas_aproximadas: totalFilas,
      rango_fechas: {
        desde: filtrosCargados.fechaDesde,
        hasta: filtrosCargados.fechaHasta,
      },
    });
    try {
      descargarCsvSecciones(
        `reportes-${fechaLocalISO()}.csv`,
        secciones,
        infoDocumentoExportacion("Reportes financieros y operativos")
      );
    } finally {
      liberarExportacionReporte();
    }
  }

  async function imprimirPdf() {
    const secciones = seccionesExportacionReportes();
    if (!secciones.length) {
      toast.error("No hay datos de reportes para imprimir.");
      return;
    }

    const totalFilas = totalFilasSecciones(secciones);
    if (!validarExportacionReporte("pdf_vista_imprimible", totalFilas)) {
      return;
    }

    const rateLimit = await validarRateLimitExportacionReporte(
      "pdf_vista_imprimible",
      totalFilas
    );
    if (!rateLimit.permitido) {
      liberarExportacionReporte();
      toast.error(rateLimit.mensaje);
      void auditarReporte("bloquear_exportacion_reporte", {
        formato: "pdf_vista_imprimible",
        filtros: filtrosCargados,
        motivo: "rate_limit_excedido",
        filas_aproximadas: totalFilas,
        retry_after_segundos: rateLimit.retry_after_segundos,
        rpc_registro_intento_bloqueado: rateLimit.rpc_disponible,
      });
      return;
    }

    void auditarReporte("imprimir_reporte", {
      formato: "pdf_vista_imprimible",
      filtros: filtrosCargados,
      secciones: secciones.length,
      filas_aproximadas: totalFilas,
      rango_fechas: {
        desde: filtrosCargados.fechaDesde,
        hasta: filtrosCargados.fechaHasta,
      },
    });
    try {
      abrirVistaImprimibleSecciones(
        "Reportes",
        "Resumen financiero y operativo por empresa",
        secciones,
        infoDocumentoExportacion("Reportes financieros y operativos")
      );
    } finally {
      liberarExportacionReporte();
    }
  }

  async function exportarReporteEntrega(
    tipo: ReporteEntregaExportable,
    formato: "csv" | "pdf_vista_imprimible"
  ) {
    const configuracion = configuracionReporteEntrega(tipo);
    if (formato === "pdf_vista_imprimible" && !configuracion.imprimible) return;

    const secciones = seccionesReporteEntrega(tipo);
    const totalFilas = totalFilasSecciones(secciones);
    if (!secciones.length || totalFilas === 0) {
      toast.error(`No hay datos filtrados para ${configuracion.titulo}.`);
      return;
    }

    const alcanceFormato = `${formato}_${tipo}`;
    if (!validarExportacionReporte(alcanceFormato, totalFilas)) return;

    const rateLimit = await validarRateLimitExportacionReporte(alcanceFormato, totalFilas);
    if (!rateLimit.permitido) {
      liberarExportacionReporte();
      toast.error(rateLimit.mensaje);
      void auditarReporte("bloquear_exportacion_reporte", {
        formato,
        reporte: tipo,
        filtros: filtrosCargados,
        motivo: "rate_limit_excedido",
        filas_aproximadas: totalFilas,
      });
      return;
    }

    const info = infoDocumentoExportacion(configuracion.titulo);
    void auditarReporte(
      formato === "csv" ? "exportar_reporte" : "imprimir_reporte",
      {
        formato,
        reporte: tipo,
        filtros: filtrosCargados,
        filas_aproximadas: totalFilas,
      }
    );

    try {
      if (formato === "csv") {
        descargarCsvSecciones(
          `${configuracion.archivo}-${fechaLocalISO()}.csv`,
          secciones,
          info
        );
      } else {
        abrirVistaImprimibleSecciones(
          configuracion.titulo,
          "Reporte contable filtrado para entrega operativa",
          secciones,
          info
        );
      }
    } finally {
      liberarExportacionReporte();
    }
  }

  function totalFilasSecciones(secciones: SeccionExportacion[]) {
    return secciones.reduce((total, seccion) => total + seccion.filas.length, 0);
  }

  function validarExportacionReporte(formato: string, totalFilas: number) {
    const ahora = Date.now();
    const empresaFiltrada = filtrosCargados.empresaId
      ? Number(filtrosCargados.empresaId)
      : null;

    if (
      empresaFiltrada !== null &&
      (!Number.isInteger(empresaFiltrada) || !empresasPermitidasIds.includes(empresaFiltrada))
    ) {
      toast.error("La empresa seleccionada no esta autorizada para exportar.");
      void auditarReporte("bloquear_exportacion_reporte", {
        formato,
        filtros: filtrosCargados,
        motivo: "empresa_no_permitida",
        filas_aproximadas: totalFilas,
      });
      void registrarIntentoBloqueadoReporte("empresa_no_permitida", {
        accion: "exportar_reporte",
        formato,
        filtros: filtrosCargados,
        filas_aproximadas: totalFilas,
      });
      return false;
    }

    const repetida =
      exportacionEnProcesoRef.current ||
      ahora - ultimaExportacionAtRef.current < VENTANA_EXPORTACION_REPETIDA_MS;

    if (repetida) {
      toast.error("Ya hay una exportacion de reportes en proceso. Espera un momento.");
      void auditarReporte("bloquear_exportacion_reporte", {
        formato,
        filtros: filtrosCargados,
        motivo: "exportacion_repetida",
        filas_aproximadas: totalFilas,
      });
      void registrarIntentoBloqueadoReporte("exportacion_repetida", {
        formato,
        filtros: filtrosCargados,
        filas_aproximadas: totalFilas,
      });
      return false;
    }

    if (totalFilas > LIMITE_FILAS_EXPORTACION_REPORTES) {
      toast.error("La exportacion supera el limite operativo de filas. Ajusta filtros.");
      void auditarReporte("bloquear_exportacion_reporte", {
        formato,
        filtros: filtrosCargados,
        motivo: "limite_filas",
        filas_aproximadas: totalFilas,
        limite_filas: LIMITE_FILAS_EXPORTACION_REPORTES,
      });
      void registrarIntentoBloqueadoReporte("limite_filas_exportacion", {
        formato,
        filtros: filtrosCargados,
        filas_aproximadas: totalFilas,
        limite_filas: LIMITE_FILAS_EXPORTACION_REPORTES,
      });
      return false;
    }

    exportacionEnProcesoRef.current = true;
    ultimaExportacionAtRef.current = ahora;
    return true;
  }

  function liberarExportacionReporte() {
    window.setTimeout(() => {
      exportacionEnProcesoRef.current = false;
    }, 800);
  }

  async function validarRateLimitExportacionReporte(formato: string, totalFilas: number) {
    if (!usuarioActualId) {
      return { permitido: true, mensaje: "", retry_after_segundos: 0, rpc_disponible: false };
    }

    const empresaId = filtrosCargados.empresaId
      ? Number(filtrosCargados.empresaId)
      : null;
    const empresaPermitida =
      empresaId !== null && Number.isInteger(empresaId) && empresasPermitidasIds.includes(empresaId)
        ? empresaId
        : null;
    const base = await registrarRateLimitOperativo({
      usuarioId: usuarioActualId,
      modulo: "reportes",
      accion: "exportar_reporte",
      limite: RATE_LIMIT_EXPORTACIONES_REPORTES,
      ventanaSegundos: RATE_LIMIT_EXPORTACIONES_REPORTES_SEGUNDOS,
      alcance: empresaPermitida ? "usuario_empresa" : "usuario",
      empresaId: empresaPermitida,
      claveSufijo: formato,
      metadatos: {
        formato,
        filas_aproximadas: totalFilas,
        fecha_desde: filtrosCargados.fechaDesde || null,
        fecha_hasta: filtrosCargados.fechaHasta || null,
        moneda: filtrosCargados.moneda || null,
        exportacion_pesada: totalFilas > UMBRAL_EXPORTACION_PESADA_REPORTES,
      },
    });

    if (!base.permitido || totalFilas <= UMBRAL_EXPORTACION_PESADA_REPORTES) {
      return base;
    }

    return registrarRateLimitOperativo({
      usuarioId: usuarioActualId,
      modulo: "reportes",
      accion: "exportar_reporte",
      limite: RATE_LIMIT_EXPORTACIONES_REPORTES_PESADAS,
      ventanaSegundos: RATE_LIMIT_EXPORTACIONES_REPORTES_PESADAS_SEGUNDOS,
      alcance: empresaPermitida ? "usuario_empresa" : "usuario",
      empresaId: empresaPermitida,
      claveSufijo: `${formato}_pesada`,
      metadatos: {
        formato,
        filas_aproximadas: totalFilas,
        fecha_desde: filtrosCargados.fechaDesde || null,
        fecha_hasta: filtrosCargados.fechaHasta || null,
        tipo_control: "exportacion_pesada",
      },
    });
  }

  async function auditarReporte(accion: string, metadatos: Record<string, unknown>) {
    try {
      const filtrosAuditoria =
        metadatos.filtros && typeof metadatos.filtros === "object"
          ? (metadatos.filtros as Partial<FiltrosReportes>)
          : filtros;
      await registrarAuditoriaEvento({
        empresa_id: filtrosAuditoria.empresaId
          ? Number(filtrosAuditoria.empresaId)
          : null,
        modulo: "reportes",
        accion,
        entidad_tipo: "reporte",
        descripcion: "Consulta o exportacion de reporte auditada",
        sensible: true,
        metadatos: {
          ...metadatos,
          auditor_solo_lectura: esAuditorSoloLecturaLocal(funcionesOperativas),
        },
        origen: "modulo_reportes",
      });
    } catch (error) {
      console.warn("No se pudo auditar reporte:", error);
    }
  }

  async function registrarIntentoBloqueadoReporte(
    motivo: string,
    metadatos: Record<string, unknown>
  ) {
    if (!usuarioActualId) return;

    const empresaId =
      motivo === "empresa_no_permitida"
        ? null
        : filtrosCargados.empresaId
          ? Number(filtrosCargados.empresaId)
          : null;

    try {
      await supabase.from("intentos_bloqueados").insert({
        usuario_id: usuarioActualId,
        empresa_id: empresaId && Number.isFinite(empresaId) ? empresaId : null,
        modulo: "reportes",
        accion:
          typeof metadatos.accion === "string" ? metadatos.accion : "exportar_reporte",
        motivo,
        severidad: motivo.includes("limite") ? "alta" : "media",
        entidad_tipo: "reporte",
        mensaje: "Exportacion de reportes bloqueada por control operativo.",
        metadatos: {
          ...metadatos,
          auditor_solo_lectura: esAuditorSoloLecturaLocal(funcionesOperativas),
        },
      });
    } catch (error) {
      console.warn("No se pudo registrar intento bloqueado de reportes:", error);
    }
  }

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex bg-[#020617] min-h-screen items-center justify-center text-white">
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white font-sans">
      <Sidebar />
      <Toaster position="top-right" />

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div>
              <p className="text-[var(--primary)] text-sm font-bold uppercase tracking-[0.3em] mb-2">
                Control+ contable
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                Reportes
              </h1>
              <p className="text-gray-400 mt-2">
                Resumen financiero y operativo por empresa
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportarCsv}
                disabled={!reporte}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-white font-bold px-4 py-3 hover:bg-white/10 disabled:opacity-50"
              >
                <Download size={18} />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={imprimirPdf}
                disabled={!reporte}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-white font-bold px-4 py-3 hover:bg-white/10 disabled:opacity-50"
              >
                <Printer size={18} />
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => cargarReporte(empresasPermitidasIds, filtros)}
                disabled={cargandoReportes}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 text-black font-black px-5 py-3 hover:bg-cyan-400 disabled:opacity-60"
              >
                <RefreshCcw size={18} className={cargandoReportes ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </header>

          {aviso && (
            <div className="mb-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-100">
              {aviso}
            </div>
          )}

          {errorCarga && (
            <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
              {errorCarga}
            </div>
          )}

          <form
            onSubmit={aplicarFiltros}
            className="mb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-9 gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5"
          >
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                Empresa
              </span>
              <select
                value={filtros.empresaId}
                onChange={(event) =>
                  setFiltros({ ...filtros, empresaId: event.target.value, periodoId: "" })
                }
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-3 text-sm text-white"
              >
                <option value="">Todas</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                Periodo contable
              </span>
              <select
                value={filtros.periodoId}
                onChange={(event) => seleccionarPeriodo(event.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-3 text-sm text-white"
              >
                <option value="">Rango de fechas</option>
                {periodosParaFiltro.map((periodo) => (
                  <option key={String(periodo.id)} value={String(periodo.id)}>
                    {empresasPorId.get(Number(periodo.empresa_id)) || `Empresa ${periodo.empresa_id}`} |{" "}
                    {periodo.mes}/{periodo.anio} - {textoLegible(periodo.estado)}
                  </option>
                ))}
              </select>
            </label>

            <InputFiltro
              label="Fecha desde"
              type="date"
              value={filtros.fechaDesde}
              onChange={(value) => setFiltros({ ...filtros, fechaDesde: value, periodoId: "" })}
            />

            <InputFiltro
              label="Fecha hasta"
              type="date"
              value={filtros.fechaHasta}
              onChange={(value) => setFiltros({ ...filtros, fechaHasta: value, periodoId: "" })}
            />

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                Moneda
              </span>
              <select
                value={filtros.moneda}
                onChange={(event) =>
                  setFiltros({ ...filtros, moneda: event.target.value })
                }
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-3 text-sm text-white"
              >
                <option value="">Todas</option>
                <option value="GTQ">GTQ</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                Estado
              </span>
              <select
                value={filtros.estado}
                onChange={(event) =>
                  setFiltros({ ...filtros, estado: event.target.value })
                }
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-3 text-sm text-white"
              >
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Parcial">Parcial</option>
                <option value="Pagado">Pagado</option>
                <option value="Vencido">Vencido</option>
                <option value="Anulado">Anulado</option>
                <option value="Registrado">Registrado</option>
              </select>
            </label>

            <InputFiltro
              label="Proveedor/cliente ID"
              type="text"
              value={filtros.proveedorClienteId}
              onChange={(value) => setFiltros({ ...filtros, proveedorClienteId: value })}
            />

            <button
              type="submit"
              disabled={cargandoReportes}
              className="self-end rounded-xl bg-white text-black font-black px-4 py-3 hover:bg-cyan-100 disabled:opacity-60"
            >
              Aplicar
            </button>

            <button
              type="button"
              onClick={limpiarFiltros}
              disabled={cargandoReportes}
              className="self-end rounded-xl border border-white/10 bg-white/5 text-white font-bold px-4 py-3 hover:bg-white/10 disabled:opacity-60"
            >
              Limpiar
            </button>
          </form>

          {cargandoReportes && (
            <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-[var(--foreground-soft)]">
              Cargando reportes...
            </div>
          )}

          <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4">
              <h2 className="text-xl font-black">Exportaciones para entrega</h2>
              <p className="text-sm text-gray-500 mt-1">
                Cada archivo y vista imprimible usa exactamente los filtros activos.
              </p>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(
                [
                  "balance_comprobacion",
                  "libro_diario",
                  "libro_mayor",
                  "estado_resultados",
                  "movimientos_operativos",
                  "cierres_periodos",
                ] as ReporteEntregaExportable[]
              ).map((tipo) => {
                const configuracion = configuracionReporteEntrega(tipo);
                const disponible =
                  tipo === "movimientos_operativos"
                    ? Boolean(reporte)
                    : Boolean(estadosFinancieros);
                return (
                  <article
                    key={tipo}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-black text-[var(--primary)]">{configuracion.titulo}</p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                          disponible
                            ? "border-green-500/30 bg-green-500/10 text-green-300"
                            : "border-gray-400/30 bg-gray-400/10 text-gray-400"
                        }`}
                      >
                        {disponible ? "Disponible" : "No disponible"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => exportarReporteEntrega(tipo, "csv")}
                        disabled={!disponible || cargandoReportes}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-gray-400/20 disabled:bg-gray-400/5 disabled:text-gray-500 disabled:opacity-100"
                      >
                        <Download size={15} /> CSV Excel
                      </button>
                      {configuracion.imprimible && (
                        <button
                          type="button"
                          onClick={() =>
                            exportarReporteEntrega(tipo, "pdf_vista_imprimible")
                          }
                          disabled={!disponible || cargandoReportes}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-[var(--primary)] hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-gray-400/20 disabled:bg-gray-400/5 disabled:text-gray-500 disabled:opacity-100"
                        >
                          <Printer size={15} /> Vista imprimible
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<FileText size={22} />}
              title="Cheques pendientes"
              value={String(reporte?.cheques.pendientes || 0)}
              detail={`Pagados: ${reporte?.cheques.pagados || 0}`}
            />
            <StatCard
              icon={<Wallet size={22} />}
              title="Cheques pagados"
              value={String(reporte?.cheques.pagados || 0)}
              detail={`Autorizados: ${reporte?.cheques.autorizados || 0}`}
            />
            <StatCard
              icon={<ClipboardList size={22} />}
              title="Ordenes pendientes"
              value={String(reporte?.ordenes.pendientes || 0)}
              detail={`Aprobadas: ${reporte?.ordenes.aprobadas || 0}`}
            />
            <StatCard
              icon={<AlertTriangle size={22} />}
              title="Movimientos anulados"
              value={String(reporte?.resumen.movimientos_anulados || 0)}
              detail="Excluidos de totales"
            />
            <StatCard
              icon={<TrendingDown size={22} />}
              title="CxP vencidas"
              value={String(reporte?.cuentas_por_pagar.vencidas || 0)}
              detail={`${reporte?.cuentas_por_pagar.cuentas.length || 0} cuentas filtradas`}
            />
            <StatCard
              icon={<TrendingUp size={22} />}
              title="CxC vencidas"
              value={String(reporte?.cuentas_por_cobrar.vencidas || 0)}
              detail={`${reporte?.cuentas_por_cobrar.cuentas.length || 0} cuentas filtradas`}
            />
          </section>

          <section className="mb-6">
            <Panel
              titulo="Reportes operativos por moneda"
              subtitulo="Movimientos, fondos, cheques, ordenes, CxP y CxC sin sumar GTQ con USD"
            >
              <ResumenOperativoPorMoneda reporte={reporte} fondos={totalesFondos} />
            </Panel>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <Panel titulo="Movimientos operativos" subtitulo="Ingresos, egresos y neto por moneda">
              <TablaResumenMoneda reporte={reporte} />
            </Panel>

            <Panel titulo="Fondos por empresa/cuenta" subtitulo="Saldos disponibles y comprometidos">
              <TablaFondos fondos={reporte?.fondos || []} />
            </Panel>
          </div>

          <section className="mb-6">
            <Panel
              titulo="Estados financieros formales"
              subtitulo="Solo catalogo de cuentas, asientos registrados, detalle contable y periodos"
            >
              <div className="space-y-5">
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    estadosFinancieros?.preliminar
                      ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-100"
                      : "border-green-400/20 bg-green-400/10 text-green-100"
                  }`}
                >
                  {estadosFinancieros?.mensaje_preliminar ||
                    "Sin datos formales para los filtros seleccionados."}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-lg font-black mb-3">Balance general</h3>
                    <ResumenBalanceGeneralFormal estados={estadosFinancieros} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black mb-3">Estado de resultados</h3>
                    <TablaEstadoResultadosFormal filas={estadosFinancieros?.estado_resultados || []} />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-black mb-3">Balance de comprobacion</h3>
                  <TablaBalanceFormal filas={estadosFinancieros?.balance_comprobacion || []} />
                </div>

                <div>
                  <h3 className="text-lg font-black mb-3">Libro diario</h3>
                  <TablaLibroDiario filas={estadosFinancieros?.libro_diario || []} />
                </div>

                <div>
                  <h3 className="text-lg font-black mb-3">Libro mayor</h3>
                  <TablaLibroMayor cuentas={estadosFinancieros?.libro_mayor || []} />
                </div>

                {(estadosFinancieros?.cuentas_sin_clasificar.length || 0) > 0 && (
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                    Hay {estadosFinancieros?.cuentas_sin_clasificar.length} cuentas sin una
                    clasificacion suficiente en tipo/subtipo. Se incluyen en balance de
                    comprobacion, diario y mayor, pero no se inventa su ubicacion en balance
                    general ni estado de resultados.
                  </div>
                )}

                <PanelPeriodosFormales estados={estadosFinancieros} />
              </div>
            </Panel>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <Panel titulo="Cheques pendientes y pagados" subtitulo="Control operativo por fecha de pago">
              <TablaCheques cheques={reporte?.cheques.proximos_pagos || []} />
            </Panel>

            <Panel titulo="Ordenes pendientes/aprobadas" subtitulo="Seguimiento de compromisos por fecha necesaria">
              <TablaOrdenes ordenes={reporte?.ordenes.proximas_ordenes || []} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <Panel titulo="Cuentas por pagar" subtitulo="Facturas, vencidos, saldos y pagos parciales">
              <TablaCuentasOperativas
                cuentas={reporte?.cuentas_por_pagar.cuentas || []}
                pagos={reporte?.cuentas_por_pagar.pagos_parciales || []}
                terceroLabel="Proveedor"
              />
            </Panel>

            <Panel titulo="Cuentas por cobrar" subtitulo="Clientes, vencidos, saldos y cobros parciales">
              <TablaCuentasOperativas
                cuentas={reporte?.cuentas_por_cobrar.cuentas || []}
                pagos={reporte?.cuentas_por_cobrar.pagos_parciales || []}
                terceroLabel="Cliente"
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <Panel titulo="Calendario de pagos" subtitulo="Cheques, ordenes y tareas con fecha">
                <TablaCalendario eventos={reporte?.calendario || []} />
              </Panel>
            </div>

            <Panel titulo="Alertas operativas" subtitulo="Criterios conservadores de reporteria">
              <div className="space-y-4 text-sm text-gray-300">
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-100">
                  Los movimientos con <strong>estado anulado</strong> se cuentan como alerta,
                  pero no se incluyen en ingresos, egresos ni neto.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Movimientos sin <strong>empresa_id</strong> no se mezclan en reportes por empresa.
                  Los reportes operativos priorizan el alcance seguro por empresas permitidas.
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-[var(--foreground-soft)]">
                  Los estados financieros formales usan solo asientos registrados y se muestran
                  separados por moneda. Si hay periodos abiertos, el resultado es preliminar.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}

function InputFiltro({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-3 text-sm text-white"
      />
    </label>
  );
}

function StatCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="rounded-2xl bg-cyan-400/10 text-[var(--primary)] p-3">
          {icon}
        </div>
      </div>
      <p className="text-sm text-gray-400">{title}</p>
      <h3 className="text-2xl font-black mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-2">{detail}</p>
    </article>
  );
}

function Panel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="p-5 border-b border-white/10">
        <h2 className="text-xl font-black">{titulo}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TablaResumenMoneda({ reporte }: { reporte: ReporteMensual | null }) {
  const filas = reporte?.resumen.por_moneda || [];

  if (!filas.length) return <EmptyState texto="No hay movimientos para el periodo." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Moneda</th>
          <th className="pb-3">Ingresos</th>
          <th className="pb-3">Egresos</th>
          <th className="pb-3">Neto</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.moneda} className="border-t border-white/10">
            <td className="py-3 font-bold">{fila.moneda}</td>
            <td className="py-3 text-green-300">{formatoMonto(fila.ingresos, fila.moneda)}</td>
            <td className="py-3 text-red-300">{formatoMonto(fila.egresos, fila.moneda)}</td>
            <td className="py-3 font-semibold text-[var(--primary)]">{formatoMonto(fila.neto, fila.moneda)}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaFondos({ fondos }: { fondos: FondoPorEmpresa[] }) {
  if (!fondos.length) return <EmptyState texto="No hay fondos para los filtros seleccionados." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Empresa</th>
          <th className="pb-3">Banco / cuenta</th>
          <th className="pb-3">Disponible</th>
          <th className="pb-3">Comprometido</th>
          <th className="pb-3">Estado</th>
        </tr>
      </thead>
      <tbody>
        {fondos.map((fondo) => (
          <tr key={fondo.id} className="border-t border-white/10">
            <td className="py-3">{fondo.empresa || `Empresa ${fondo.empresa_id}`}</td>
            <td className="py-3 text-gray-400">
              {fondo.banco || "-"} / {fondo.cuenta_bancaria || "-"}
            </td>
            <td className="py-3 text-green-300">
              {formatoMonto(fondo.saldo_disponible, fondo.moneda)}
            </td>
            <td className="py-3 text-yellow-300">
              {formatoMonto(fondo.saldo_comprometido, fondo.moneda)}
            </td>
            <td className="py-3">
              <EstadoPill estado={fondo.estado || "activo"} />
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaCheques({ cheques }: { cheques: ChequeReporte[] }) {
  if (!cheques.length) return <EmptyState texto="No hay cheques pendientes para el periodo." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Fecha</th>
          <th className="pb-3">Beneficiario</th>
          <th className="pb-3">Monto</th>
          <th className="pb-3">Estado</th>
        </tr>
      </thead>
      <tbody>
        {cheques.slice(0, 12).map((cheque) => (
          <tr key={cheque.id} className="border-t border-white/10">
            <td className="py-3">{mostrarFecha(cheque.fecha_pago)}</td>
            <td className="py-3">
              <p className="font-semibold">{cheque.beneficiario || "-"}</p>
              <p className="text-xs text-gray-500">{cheque.empresa || "-"}</p>
            </td>
            <td className="py-3">{formatoMonto(cheque.monto, cheque.moneda)}</td>
            <td className="py-3">
              <EstadoPill estado={cheque.estado} />
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaOrdenes({ ordenes }: { ordenes: OrdenReporte[] }) {
  if (!ordenes.length) return <EmptyState texto="No hay ordenes pendientes para el periodo." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Fecha</th>
          <th className="pb-3">Proveedor</th>
          <th className="pb-3">Monto</th>
          <th className="pb-3">Estado</th>
        </tr>
      </thead>
      <tbody>
        {ordenes.slice(0, 12).map((orden) => (
          <tr key={orden.id} className="border-t border-white/10">
            <td className="py-3">{mostrarFecha(orden.fecha_necesaria)}</td>
            <td className="py-3">
              <p className="font-semibold">{orden.proveedor || "-"}</p>
              <p className="text-xs text-gray-500">{orden.empresa || "-"}</p>
            </td>
            <td className="py-3">{formatoMonto(orden.monto, orden.moneda)}</td>
            <td className="py-3">
              <EstadoPill estado={orden.estado} />
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaCalendario({ eventos }: { eventos: CalendarioPago[] }) {
  if (!eventos.length) return <EmptyState texto="No hay pagos o vencimientos para el periodo." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Fecha</th>
          <th className="pb-3">Fuente</th>
          <th className="pb-3">Titulo</th>
          <th className="pb-3">Monto</th>
          <th className="pb-3">Estado</th>
        </tr>
      </thead>
      <tbody>
        {eventos.slice(0, 20).map((evento, index) => (
          <tr key={`${evento.fuente}-${evento.empresa_id}-${evento.fecha}-${index}`} className="border-t border-white/10">
            <td className="py-3">{mostrarFecha(evento.fecha)}</td>
            <td className="py-3">
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${fuenteClase(evento.fuente)}`}>
                {textoLegible(evento.fuente)}
              </span>
            </td>
            <td className="py-3">{evento.titulo}</td>
            <td className="py-3">
              {evento.monto === null ? "-" : formatoMonto(evento.monto, evento.moneda)}
            </td>
            <td className="py-3">
              <EstadoPill estado={evento.estado} />
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function ResumenOperativoPorMoneda({
  reporte,
  fondos,
}: {
  reporte: ReporteMensual | null;
  fondos: Array<{ moneda: string; disponible: number; comprometido: number }>;
}) {
  const monedas = Array.from(
    new Set([
      ...(reporte?.resumen.por_moneda || []).map((fila) => fila.moneda),
      ...fondos.map((fila) => fila.moneda),
      ...(reporte?.cheques.por_moneda || []).map((fila) => fila.moneda),
      ...(reporte?.ordenes.por_moneda || []).map((fila) => fila.moneda),
      ...(reporte?.cuentas_por_pagar.por_moneda || []).map((fila) => fila.moneda),
      ...(reporte?.cuentas_por_cobrar.por_moneda || []).map((fila) => fila.moneda),
    ])
  ).sort();

  if (!monedas.length) return <EmptyState texto="No hay datos monetarios para los filtros." />;

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {monedas.map((moneda) => {
        const movimientos = reporte?.resumen.por_moneda.find((fila) => fila.moneda === moneda);
        const fondo = fondos.find((fila) => fila.moneda === moneda);
        const cheques = reporte?.cheques.por_moneda.find((fila) => fila.moneda === moneda);
        const ordenes = reporte?.ordenes.por_moneda.find((fila) => fila.moneda === moneda);
        const cxp = reporte?.cuentas_por_pagar.por_moneda.find((fila) => fila.moneda === moneda);
        const cxc = reporte?.cuentas_por_cobrar.por_moneda.find((fila) => fila.moneda === moneda);

        return (
          <article key={moneda} className="rounded-2xl border border-white/10 bg-[#0f172a]/70 p-4">
            <h3 className="text-xl font-black text-[var(--primary)] mb-3">{moneda}</h3>
            <div className="grid gap-2 text-sm">
              <LineaResumen label="Ingresos operativos" valor={formatoMonto(movimientos?.ingresos || 0, moneda)} />
              <LineaResumen label="Egresos operativos" valor={formatoMonto(movimientos?.egresos || 0, moneda)} />
              <LineaResumen label="Neto operativo" valor={formatoMonto(movimientos?.neto || 0, moneda)} />
              <LineaResumen label="Fondos disponibles" valor={formatoMonto(fondo?.disponible || 0, moneda)} />
              <LineaResumen label="Fondos comprometidos" valor={formatoMonto(fondo?.comprometido || 0, moneda)} />
              <LineaResumen label="Cheques pendientes" valor={formatoMonto(cheques?.monto_pendiente || 0, moneda)} />
              <LineaResumen label="Ordenes pendientes" valor={formatoMonto(ordenes?.monto_pendiente || 0, moneda)} />
              <LineaResumen label="Saldo CxP" valor={formatoMonto(cxp?.monto_pendiente || 0, moneda)} />
              <LineaResumen label="Saldo CxC" valor={formatoMonto(cxc?.monto_pendiente || 0, moneda)} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LineaResumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
      <span className="text-gray-400">{label}</span>
      <span className="font-black text-white text-right">{valor}</span>
    </div>
  );
}

function TablaCuentasOperativas({
  cuentas,
  pagos,
  terceroLabel,
}: {
  cuentas: CuentaOperativaReporte[];
  pagos: PagoParcialReporte[];
  terceroLabel: string;
}) {
  if (!cuentas.length && !pagos.length) {
    return <EmptyState texto="No hay cuentas ni pagos parciales para los filtros." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">
          Cuentas
        </h3>
        {!cuentas.length ? (
          <EmptyState texto="No hay cuentas para los filtros." />
        ) : (
          <Tabla>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="pb-3">{terceroLabel}</th>
                <th className="pb-3">Documento</th>
                <th className="pb-3">Vence</th>
                <th className="pb-3">Saldo</th>
                <th className="pb-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.slice(0, 12).map((cuenta) => (
                <tr key={String(cuenta.id)} className="border-t border-white/10">
                  <td className="py-3">{cuenta.tercero || "-"}</td>
                  <td className="py-3 text-gray-400">
                    {cuenta.serie || ""} {cuenta.numero_documento || cuenta.id}
                  </td>
                  <td className="py-3">{mostrarFecha(cuenta.fecha_vencimiento)}</td>
                  <td className="py-3 font-semibold text-[var(--primary)]">
                    {formatoMonto(cuenta.saldo_pendiente, cuenta.moneda)}
                  </td>
                  <td className="py-3">
                    <EstadoPill estado={cuenta.vencida ? "Vencido" : cuenta.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>

      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">
          Pagos parciales
        </h3>
        {!pagos.length ? (
          <EmptyState texto="No hay pagos parciales para los filtros." />
        ) : (
          <Tabla>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="pb-3">Fecha</th>
                <th className="pb-3">Metodo</th>
                <th className="pb-3">Referencia</th>
                <th className="pb-3">Monto</th>
                <th className="pb-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagos.slice(0, 8).map((pago) => (
                <tr key={String(pago.id)} className="border-t border-white/10">
                  <td className="py-3">{mostrarFecha(pago.fecha_pago)}</td>
                  <td className="py-3">{pago.metodo_pago || "-"}</td>
                  <td className="py-3 text-gray-400">{pago.referencia || pago.banco || "-"}</td>
                  <td className="py-3 text-green-300">{formatoMonto(pago.monto, pago.moneda)}</td>
                  <td className="py-3"><EstadoPill estado={pago.estado} /></td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>
    </div>
  );
}

function TablaBalanceFormal({ filas }: { filas: BalanceComprobacionFormalFila[] }) {
  if (!filas.length) {
    return <EmptyState texto="No hay asientos registrados para balance de comprobacion." />;
  }

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Cuenta</th>
          <th className="pb-3">Moneda</th>
          <th className="pb-3">Debe</th>
          <th className="pb-3">Haber</th>
          <th className="pb-3">Saldo deudor</th>
          <th className="pb-3">Saldo acreedor</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={`${fila.cuenta_id}-${fila.moneda}`} className="border-t border-white/10">
            <td className="py-3">
              <p className="font-semibold">{fila.codigo} - {fila.nombre}</p>
              <p className="text-xs text-gray-500">{textoLegible(fila.tipo)}</p>
            </td>
            <td className="py-3 font-bold">{fila.moneda}</td>
            <td className="py-3 font-semibold text-[var(--primary)]">{formatoMonto(fila.debe, fila.moneda)}</td>
            <td className="py-3 font-semibold text-[var(--primary)]">{formatoMonto(fila.haber, fila.moneda)}</td>
            <td className="py-3 text-green-300">{formatoMonto(fila.saldo_deudor, fila.moneda)}</td>
            <td className="py-3 text-yellow-300">{formatoMonto(fila.saldo_acreedor, fila.moneda)}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function ResumenBalanceGeneralFormal({
  estados,
}: {
  estados: EstadosFinancierosFormales | null;
}) {
  if (!estados) return <EmptyState texto="No hay balance general para mostrar." />;

  const filas = [
    ...estados.balance_general.activos.map((fila) => ({ ...fila, seccion: "Activos" })),
    ...estados.balance_general.pasivos.map((fila) => ({ ...fila, seccion: "Pasivos" })),
    ...estados.balance_general.patrimonio.map((fila) => ({ ...fila, seccion: "Patrimonio" })),
  ];

  if (!filas.length) return <EmptyState texto="No hay cuentas clasificadas para balance general." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Seccion</th>
          <th className="pb-3">Moneda</th>
          <th className="pb-3">Total</th>
          <th className="pb-3">Cuentas</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={`${fila.seccion}-${fila.moneda}`} className="border-t border-white/10">
            <td className="py-3 font-semibold">{fila.seccion}</td>
            <td className="py-3 font-bold">{fila.moneda}</td>
            <td className="py-3 font-semibold text-[var(--primary)]">{formatoMonto(fila.total, fila.moneda)}</td>
            <td className="py-3 text-gray-400">{fila.cuentas.length}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaEstadoResultadosFormal({ filas }: { filas: EstadoResultadosSeccion[] }) {
  if (!filas.length) return <EmptyState texto="No hay cuentas de resultado registradas." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Moneda</th>
          <th className="pb-3">Ingresos</th>
          <th className="pb-3">Costos</th>
          <th className="pb-3">Gastos</th>
          <th className="pb-3">Financieros</th>
          <th className="pb-3">Utilidad/perdida</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.moneda} className="border-t border-white/10">
            <td className="py-3 font-bold">{fila.moneda}</td>
            <td className="py-3 text-green-300">{formatoMonto(fila.ingresos, fila.moneda)}</td>
            <td className="py-3 text-yellow-300">{formatoMonto(fila.costos, fila.moneda)}</td>
            <td className="py-3 text-red-300">{formatoMonto(fila.gastos_operativos, fila.moneda)}</td>
            <td className="py-3 text-red-200">{formatoMonto(fila.gastos_financieros, fila.moneda)}</td>
            <td className={fila.utilidad_perdida >= 0 ? "py-3 font-semibold text-[var(--primary)]" : "py-3 text-red-200"}>
              {formatoMonto(fila.utilidad_perdida, fila.moneda)}
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaLibroDiario({ filas }: { filas: LibroDiarioFila[] }) {
  if (!filas.length) return <EmptyState texto="No hay asientos registrados para libro diario." />;

  return (
    <Tabla>
      <thead>
        <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
          <th className="pb-3">Fecha / asiento</th>
          <th className="pb-3">Descripcion</th>
          <th className="pb-3">Cuenta</th>
          <th className="pb-3">Moneda</th>
          <th className="pb-3">Debe</th>
          <th className="pb-3">Haber</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, index) => (
          <tr key={`${fila.asiento_id}-${fila.cuenta_id}-${index}`} className="border-t border-white/10">
            <td className="py-3">
              <p>{mostrarFecha(fila.fecha)}</p>
              <p className="text-xs text-gray-500">{String(fila.asiento_id)}</p>
            </td>
            <td className="py-3">
              <p>{fila.descripcion}</p>
              <p className="text-xs text-gray-500">{fila.detalle || fila.origen_modulo || "-"}</p>
            </td>
            <td className="py-3">{fila.codigo} - {fila.cuenta}</td>
            <td className="py-3 font-bold">{fila.moneda}</td>
            <td className="py-3 text-green-300">{formatoMonto(fila.debe, fila.moneda)}</td>
            <td className="py-3 text-red-300">{formatoMonto(fila.haber, fila.moneda)}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaLibroMayor({ cuentas }: { cuentas: LibroMayorCuenta[] }) {
  if (!cuentas.length) return <EmptyState texto="No hay cuentas con movimientos registrados para libro mayor." />;

  return (
    <div className="space-y-5">
      {cuentas.map((cuenta) => (
        <div key={`${cuenta.cuenta_id}-${cuenta.moneda}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap justify-between gap-3 mb-3">
            <div>
              <p className="font-black">{cuenta.codigo} - {cuenta.nombre}</p>
              <p className="text-xs text-gray-500">{textoLegible(cuenta.tipo)} | {cuenta.moneda}</p>
            </div>
            <p className="text-sm font-semibold text-[var(--primary)]">
              Saldo final: {formatoMonto(cuenta.saldo, cuenta.moneda)}
            </p>
          </div>
          <Tabla>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="pb-3">Fecha</th>
                <th className="pb-3">Asiento / detalle</th>
                <th className="pb-3">Debe</th>
                <th className="pb-3">Haber</th>
                <th className="pb-3">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {cuenta.movimientos.map((movimiento, index) => (
                <tr key={`${movimiento.asiento_id}-${index}`} className="border-t border-white/10">
                  <td className="py-3">{mostrarFecha(movimiento.fecha)}</td>
                  <td className="py-3">
                    <p>{movimiento.detalle || movimiento.descripcion}</p>
                    <p className="text-xs text-gray-500">{String(movimiento.asiento_id)}</p>
                  </td>
                  <td className="py-3 text-green-300">{formatoMonto(movimiento.debe, cuenta.moneda)}</td>
                  <td className="py-3 text-red-300">{formatoMonto(movimiento.haber, cuenta.moneda)}</td>
                  <td className="py-3 font-semibold text-[var(--primary)]">{formatoMonto(movimiento.saldo_acumulado, cuenta.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      ))}
    </div>
  );
}

function PanelPeriodosFormales({
  estados,
}: {
  estados: EstadosFinancierosFormales | null;
}) {
  const periodos = estados?.periodos || [];

  if (!periodos.length) {
    return <EmptyState texto="No se encontraron periodos contables asociados al filtro." />;
  }

  return (
    <div>
      <h3 className="text-lg font-black mb-3">Cierres y periodos contables</h3>
      <Tabla>
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-gray-500">
            <th className="pb-3">Periodo</th>
            <th className="pb-3">Fechas</th>
            <th className="pb-3">Estado</th>
            <th className="pb-3">Cerrado en</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((periodo) => (
            <tr key={String(periodo.id)} className="border-t border-white/10">
              <td className="py-3 font-semibold">{periodo.mes}/{periodo.anio}</td>
              <td className="py-3 text-gray-400">
                {mostrarFecha(periodo.fecha_inicio)} a {mostrarFecha(periodo.fecha_fin)}
              </td>
              <td className="py-3"><EstadoPill estado={periodo.estado} /></td>
              <td className="py-3 text-gray-400">
                {periodo.cerrado_at ? new Date(periodo.cerrado_at).toLocaleString("es-GT") : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  );
}

function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">{children}</table>
    </div>
  );
}

function EstadoPill({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${estadoClase(
        estado
      )}`}
    >
      {textoLegible(estado)}
    </span>
  );
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-400">
      {texto}
    </div>
  );
}
