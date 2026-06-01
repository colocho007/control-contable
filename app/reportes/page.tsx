"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
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
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import {
  obtenerReporteMensual,
  type CalendarioPago,
  type ChequeReporte,
  type FondoPorEmpresa,
  type OrdenReporte,
  type ReporteMensual,
  type ReportesFinancierosParams,
} from "../../lib/reportesFinancieros";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

interface Empresa {
  id: number;
  nombre: string;
}

interface FiltrosReportes {
  empresaId: string;
  fechaDesde: string;
  fechaHasta: string;
  moneda: string;
}

const LIMITE_REPORTES = 100;

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
  return "border-purple-400/30 bg-purple-400/10 text-purple-200";
}

export default function ReportesPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<FiltrosReportes>(FILTROS_INICIALES);
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);

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
            window.alert("No tienes acceso al modulo Reportes.");
          }

          router.replace(volverLogin ? "/login" : "/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          acceso.perfil?.rol || ""
        );
        const funciones = await listarFuncionesOperativasUsuario(acceso.user!.id, idsPermitidos);

        if (!activo) return;

        setEmpresasPermitidasIds(idsPermitidos);
        setFuncionesOperativas(funciones);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!idsPermitidos.length) {
          setEmpresas([]);
          setReporte(null);
          setAviso("No tienes empresas asignadas para consultar reportes.");
          return;
        }

        await Promise.all([
          cargarEmpresas(idsPermitidos),
          cargarReporte(idsPermitidos, FILTROS_INICIALES),
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
      .select("id,nombre")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando empresas para reportes:", error);
      setAviso("No se pudo cargar el catalogo de empresas para filtros.");
      return;
    }

    setEmpresas((data || []) as Empresa[]);
  }

  async function cargarReporte(
    idsPermitidos: number[],
    filtrosAplicados: FiltrosReportes
  ) {
    setCargandoReportes(true);
    setErrorCarga(null);

    try {
      if (!idsPermitidos.length) {
        setReporte(null);
        setAviso("No tienes empresas asignadas para consultar reportes.");
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
        setErrorCarga("La empresa seleccionada no esta autorizada.");
        return;
      }

      const params: ReportesFinancierosParams = {
        empresasIds: idsPermitidos,
        empresa_id: empresaId,
        fecha_desde: filtrosAplicados.fechaDesde || undefined,
        fecha_hasta: filtrosAplicados.fechaHasta || undefined,
        moneda: filtrosAplicados.moneda || undefined,
        limite: LIMITE_REPORTES,
      };

      const reporteMensual = await obtenerReporteMensual(params);
      setReporte(reporteMensual);
      await auditarReporte("consultar_reporte", {
        filtros: filtrosAplicados,
        empresas_consultadas: idsPermitidos,
        total_movimientos: reporteMensual.resumen.total_movimientos,
      });
      setAviso(null);
    } catch (error) {
      console.error("Error cargando reportes:", error);
      setReporte(null);
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

  const monedaSeleccionada = filtros.moneda || null;

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const totalesFondos = useMemo(() => {
    const fondos = reporte?.fondos || [];

    return fondos.reduce(
      (totales, fondo) => ({
        disponible: totales.disponible + Number(fondo.saldo_disponible || 0),
        comprometido: totales.comprometido + Number(fondo.saldo_comprometido || 0),
      }),
      { disponible: 0, comprometido: 0 }
    );
  }, [reporte]);

  function textoEmpresaFiltro() {
    if (!filtros.empresaId) return "Todas las empresas permitidas";
    return empresasPorId.get(Number(filtros.empresaId)) || `Empresa #${filtros.empresaId}`;
  }

  function seccionesExportacionReportes(): SeccionExportacion[] {
    if (!reporte) return [];

    const filtrosResumen = {
      Empresa: textoEmpresaFiltro(),
      "Fecha desde": filtros.fechaDesde || "",
      "Fecha hasta": filtros.fechaHasta || "",
      Moneda: filtros.moneda || "Todas",
    };

    return [
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
        titulo: "Resumen financiero",
        resumen: {
          Ingresos: reporte.resumen.ingresos,
          Egresos: reporte.resumen.egresos,
          Neto: reporte.resumen.neto,
          "Total movimientos": reporte.resumen.total_movimientos,
          "Movimientos anulados": reporte.resumen.movimientos_anulados,
        },
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
    ];
  }

  function exportarCsv() {
    const secciones = seccionesExportacionReportes();
    if (!secciones.length) {
      window.alert("No hay datos de reportes para exportar.");
      return;
    }

    void auditarReporte("exportar_reporte", {
      formato: "csv",
      filtros,
      secciones: secciones.length,
    });
    descargarCsvSecciones(`reportes-${fechaLocalISO()}.csv`, secciones);
  }

  function imprimirPdf() {
    const secciones = seccionesExportacionReportes();
    if (!secciones.length) {
      window.alert("No hay datos de reportes para imprimir.");
      return;
    }

    void auditarReporte("imprimir_reporte", {
      formato: "pdf_vista_imprimible",
      filtros,
      secciones: secciones.length,
    });
    abrirVistaImprimibleSecciones(
      "Reportes",
      "Resumen financiero y operativo por empresa",
      secciones
    );
  }

  async function auditarReporte(accion: string, metadatos: Record<string, unknown>) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: filtros.empresaId ? Number(filtros.empresaId) : null,
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

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div>
              <p className="text-cyan-400 text-sm font-bold uppercase tracking-[0.3em] mb-2">
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
            className="mb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5"
          >
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">
                Empresa
              </span>
              <select
                value={filtros.empresaId}
                onChange={(event) =>
                  setFiltros({ ...filtros, empresaId: event.target.value })
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

            <InputFiltro
              label="Fecha desde"
              type="date"
              value={filtros.fechaDesde}
              onChange={(value) => setFiltros({ ...filtros, fechaDesde: value })}
            />

            <InputFiltro
              label="Fecha hasta"
              type="date"
              value={filtros.fechaHasta}
              onChange={(value) => setFiltros({ ...filtros, fechaHasta: value })}
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
            <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-100">
              Cargando reportes...
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<TrendingUp size={22} />}
              title="Ingresos"
              value={formatoMonto(reporte?.resumen.ingresos || 0, monedaSeleccionada)}
              detail={monedaSeleccionada || "Monto mixto"}
            />
            <StatCard
              icon={<TrendingDown size={22} />}
              title="Egresos"
              value={formatoMonto(reporte?.resumen.egresos || 0, monedaSeleccionada)}
              detail={monedaSeleccionada || "Monto mixto"}
            />
            <StatCard
              icon={<Wallet size={22} />}
              title="Neto"
              value={formatoMonto(reporte?.resumen.neto || 0, monedaSeleccionada)}
              detail={`${reporte?.resumen.total_movimientos || 0} movimientos activos`}
            />
            <StatCard
              icon={<Building2 size={22} />}
              title="Fondos disponibles"
              value={formatoMonto(totalesFondos.disponible, monedaSeleccionada)}
              detail={`Comprometido: ${formatoMonto(totalesFondos.comprometido, monedaSeleccionada)}`}
            />
            <StatCard
              icon={<FileText size={22} />}
              title="Cheques pendientes"
              value={String(reporte?.cheques.pendientes || 0)}
              detail={`Pagados: ${reporte?.cheques.pagados || 0}`}
            />
            <StatCard
              icon={<Wallet size={22} />}
              title="Cheques pagados"
              value={formatoMonto(reporte?.cheques.monto_pagado || 0, monedaSeleccionada)}
              detail={`Pendiente: ${formatoMonto(reporte?.cheques.monto_pendiente || 0, monedaSeleccionada)}`}
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
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <Panel titulo="Resumen financiero" subtitulo="Ingresos, egresos y neto por moneda">
              <TablaResumenMoneda reporte={reporte} />
            </Panel>

            <Panel titulo="Fondos por empresa/cuenta" subtitulo="Saldos disponibles y comprometidos">
              <TablaFondos fondos={reporte?.fondos || []} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <Panel titulo="Cheques pendientes y pagados" subtitulo="Control operativo por fecha de pago">
              <TablaCheques cheques={reporte?.cheques.proximos_pagos || []} />
            </Panel>

            <Panel titulo="Ordenes pendientes/aprobadas" subtitulo="Seguimiento de compromisos por fecha necesaria">
              <TablaOrdenes ordenes={reporte?.ordenes.proximas_ordenes || []} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <Panel titulo="Calendario de pagos" subtitulo="Cheques, ordenes y tareas con fecha">
                <TablaCalendario eventos={reporte?.calendario || []} />
              </Panel>
            </div>

            <Panel titulo="Alertas V1" subtitulo="Criterios conservadores de reporteria">
              <div className="space-y-4 text-sm text-gray-300">
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-100">
                  Los movimientos con <strong>estado anulado</strong> se cuentan como alerta,
                  pero no se incluyen en ingresos, egresos ni neto.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Movimientos sin <strong>empresa_id</strong> no se mezclan en reportes por empresa.
                  Esta V1 prioriza alcance seguro por empresas permitidas.
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-100">
                  Balance general formal, estado de resultados contable y conciliacion bancaria quedan
                  para una fase posterior con catalogo de cuentas y cierres.
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
        <div className="rounded-2xl bg-cyan-400/10 text-cyan-300 p-3">
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
            <td className="py-3 text-cyan-200">{formatoMonto(fila.neto, fila.moneda)}</td>
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
