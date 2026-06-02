"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import {
  ejecutarReinicioControlado,
  listarReiniciosControlados,
  previsualizarReinicioControlado,
  solicitarReinicioControlado,
  type EstadoReinicioControlado,
  type PrevisualizarReinicioParams,
  type ReinicioControlado,
  type ResumenReinicioControlado,
  type ResultadoReinicioControlado,
  type TipoReinicioControlado,
} from "../../lib/reinicioControlado";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface FormularioReinicio {
  empresaId: string;
  tipoReinicio: TipoReinicioControlado;
  fechaDesde: string;
  fechaHasta: string;
  incluirMovimientos: boolean;
  incluirChequesNoPagados: boolean;
  incluirFondosChequeras: boolean;
  incluirCalendario: boolean;
  descripcion: string;
}

interface FiltrosHistorico {
  empresaId: string;
  estado: string;
  tipoReinicio: string;
}

const TIPOS_REINICIO: Array<{
  valor: TipoReinicioControlado;
  nombre: string;
  descripcion: string;
}> = [
  {
    valor: "movimientos",
    nombre: "Movimientos",
    descripcion: "Anulacion logica de movimientos de prueba.",
  },
  {
    valor: "cheques",
    nombre: "Cheques",
    descripcion: "Anula cheques no pagados y libera cheques fisicos relacionados.",
  },
  {
    valor: "fondos_chequeras",
    nombre: "Fondos y chequeras",
    descripcion: "Inactiva fondos y chequeras si no hay compromisos activos.",
  },
  {
    valor: "calendario",
    nombre: "Calendario",
    descripcion: "Cancela eventos pendientes o en proceso.",
  },
  {
    valor: "operativo_completo",
    nombre: "Operativo completo",
    descripcion: "Ejecuta el flujo seguro completo en el orden controlado.",
  },
];

const ESTADOS_REINICIO: EstadoReinicioControlado[] = [
  "solicitado",
  "ejecutando",
  "completado",
  "parcial",
  "fallido",
  "cancelado",
];

const FILTROS_HISTORICO_INICIALES: FiltrosHistorico = {
  empresaId: "",
  estado: "",
  tipoReinicio: "",
};

function opcionesPorTipo(tipo: TipoReinicioControlado) {
  return {
    incluirMovimientos: tipo === "movimientos" || tipo === "operativo_completo",
    incluirChequesNoPagados: tipo === "cheques" || tipo === "operativo_completo",
    incluirFondosChequeras:
      tipo === "fondos_chequeras" || tipo === "operativo_completo",
    incluirCalendario: tipo === "calendario" || tipo === "operativo_completo",
  };
}

const FORM_INICIAL: FormularioReinicio = {
  empresaId: "",
  tipoReinicio: "movimientos",
  fechaDesde: "",
  fechaHasta: "",
  ...opcionesPorTipo("movimientos"),
  descripcion: "",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado.";
}

function textoLegible(valor: string | null | undefined) {
  return valor ? valor.replaceAll("_", " ") : "-";
}

function formatoMonto(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mostrarFechaHora(valor: string | null | undefined) {
  if (!valor) return "-";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return fecha.toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estadoClase(estado: string | null | undefined) {
  const normalizado = (estado || "").toLowerCase();
  if (normalizado === "completado") {
    return "border-green-400/30 bg-green-400/10 text-green-200";
  }
  if (normalizado === "parcial") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (normalizado === "fallido" || normalizado === "cancelado") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }
  if (normalizado === "ejecutando") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }
  return "border-slate-400/30 bg-slate-400/10 text-slate-200";
}

function riesgoClase(severidad: string) {
  if (severidad === "critico") return "border-red-400/40 bg-red-500/10 text-red-100";
  if (severidad === "alto") return "border-orange-400/40 bg-orange-500/10 text-orange-100";
  if (severidad === "medio") return "border-yellow-400/40 bg-yellow-500/10 text-yellow-100";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
}

function truncarId(id: string | number | null | undefined) {
  if (id === null || id === undefined || id === "") return "-";
  const texto = String(id);
  return texto.length > 12 ? `${texto.slice(0, 8)}...` : texto;
}

function contarPorEstado<T extends { cantidad: number }>(valores: Record<string, T>) {
  return Object.entries(valores).sort(([a], [b]) => a.localeCompare(b));
}

export default function ReinicioControladoPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [formulario, setFormulario] = useState<FormularioReinicio>(FORM_INICIAL);
  const [filtrosHistorico, setFiltrosHistorico] = useState<FiltrosHistorico>(
    FILTROS_HISTORICO_INICIALES
  );
  const [resumen, setResumen] = useState<ResumenReinicioControlado | null>(null);
  const [paramsPrevisualizados, setParamsPrevisualizados] =
    useState<PrevisualizarReinicioParams | null>(null);
  const [reinicioCreado, setReinicioCreado] = useState<ReinicioControlado | null>(
    null
  );
  const [resultado, setResultado] = useState<ResultadoReinicioControlado | null>(
    null
  );
  const [reinicios, setReinicios] = useState<ReinicioControlado[]>([]);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoReinicios, setCargandoReinicios] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [rolUsuario, setRolUsuario] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const puedeGestionar = useMemo(() => {
    const rol = rolUsuario.trim().toLowerCase();
    return rol === "admin" || rol === "jefe";
  }, [rolUsuario]);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("reinicio-controlado");

        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );

          if (!volverLogin) {
            window.alert("No tienes acceso al modulo Reinicio Controlado.");
          }

          router.replace(volverLogin ? "/login" : "/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          acceso.perfil?.rol || ""
        );

        if (!activo) return;

        setRolUsuario(acceso.perfil?.rol || "");
        setEmpresasPermitidasIds(idsPermitidos);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!idsPermitidos.length) {
          setEmpresas([]);
          setReinicios([]);
          setAviso("No tienes empresas asignadas para reinicios controlados.");
          return;
        }

        setFormulario((actual) => ({
          ...actual,
          empresaId: idsPermitidos.length === 1 ? String(idsPermitidos[0]) : actual.empresaId,
        }));

        await Promise.all([
          cargarEmpresas(idsPermitidos),
          cargarReinicios(idsPermitidos, FILTROS_HISTORICO_INICIALES),
        ]);
      } catch (error) {
        console.error("Error validando acceso a Reinicio Controlado:", error);

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
      console.error("Error cargando empresas para reinicio controlado:", error);
      setAviso("No se pudo cargar el catalogo de empresas permitidas.");
      return;
    }

    setEmpresas((data || []) as Empresa[]);
  }

  async function cargarReinicios(
    idsPermitidos: number[],
    filtros: FiltrosHistorico
  ) {
    setCargandoReinicios(true);
    setErrorCarga(null);

    try {
      if (!idsPermitidos.length) {
        setReinicios([]);
        setAviso("No tienes empresas asignadas para reinicios controlados.");
        return;
      }

      const empresaFiltro = filtros.empresaId ? Number(filtros.empresaId) : null;
      if (
        empresaFiltro !== null &&
        (!Number.isInteger(empresaFiltro) || !idsPermitidos.includes(empresaFiltro))
      ) {
        setReinicios([]);
        setErrorCarga("La empresa seleccionada no esta autorizada.");
        return;
      }

      const idsConsulta = empresaFiltro ? [empresaFiltro] : idsPermitidos;
      const resultados = await Promise.all(
        idsConsulta.map((empresaId) =>
          listarReiniciosControlados({
            empresa_id: empresaId,
            estado: filtros.estado || undefined,
            tipo_reinicio: filtros.tipoReinicio
              ? (filtros.tipoReinicio as TipoReinicioControlado)
              : undefined,
            limite: 50,
          })
        )
      );

      const unicos = new Map<string, ReinicioControlado>();
      resultados.flat().forEach((reinicio) => {
        unicos.set(String(reinicio.id), reinicio);
      });

      const ordenados = Array.from(unicos.values())
        .sort(
          (a, b) =>
            (new Date(b.creado_at || "").getTime() || 0) -
            (new Date(a.creado_at || "").getTime() || 0)
        )
        .slice(0, 50);

      setReinicios(ordenados);
      setAviso(null);
    } catch (error) {
      console.error("Error cargando reinicios controlados:", error);
      setReinicios([]);
      setErrorCarga(getErrorMessage(error));
    } finally {
      setCargandoReinicios(false);
    }
  }

  function limpiarResultadoActual() {
    setResumen(null);
    setParamsPrevisualizados(null);
    setReinicioCreado(null);
    setResultado(null);
    setConfirmacion("");
  }

  function actualizarFormulario(cambios: Partial<FormularioReinicio>) {
    setFormulario((actual) => ({ ...actual, ...cambios }));
    limpiarResultadoActual();
  }

  function cambiarTipo(tipo: TipoReinicioControlado) {
    setFormulario((actual) => ({
      ...actual,
      tipoReinicio: tipo,
      ...opcionesPorTipo(tipo),
    }));
    limpiarResultadoActual();
  }

  function construirParamsReinicio(): PrevisualizarReinicioParams {
    const empresaId = Number(formulario.empresaId);

    if (!Number.isInteger(empresaId) || !empresasPermitidasIds.includes(empresaId)) {
      throw new Error("Selecciona una empresa permitida antes de continuar.");
    }

    return {
      empresa_id: empresaId,
      tipo_reinicio: formulario.tipoReinicio,
      fecha_desde: formulario.fechaDesde || undefined,
      fecha_hasta: formulario.fechaHasta || undefined,
      incluir_movimientos: formulario.incluirMovimientos,
      incluir_cheques_no_pagados: formulario.incluirChequesNoPagados,
      incluir_cheques_pagados: false,
      incluir_fondos_chequeras: formulario.incluirFondosChequeras,
      incluir_calendario: formulario.incluirCalendario,
    };
  }

  async function previsualizar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPrevisualizando(true);
    setErrorCarga(null);
    setResultado(null);
    setReinicioCreado(null);
    setConfirmacion("");

    try {
      const params = construirParamsReinicio();
      const resumenReinicio = await previsualizarReinicioControlado(params);
      setResumen(resumenReinicio);
      setParamsPrevisualizados(params);
      toast.success("Previsualizacion lista. No se modificaron datos.");
    } catch (error) {
      console.error("Error previsualizando reinicio:", error);
      setResumen(null);
      setParamsPrevisualizados(null);
      toast.error(getErrorMessage(error));
    } finally {
      setPrevisualizando(false);
    }
  }

  async function crearSolicitud() {
    if (!puedeGestionar) {
      toast.error("Solo admin o jefe pueden solicitar reinicios controlados.");
      return;
    }

    if (!resumen || !paramsPrevisualizados) {
      toast.error("Primero debes previsualizar el reinicio.");
      return;
    }

    setSolicitando(true);
    setErrorCarga(null);

    try {
      const reinicio = await solicitarReinicioControlado({
        ...paramsPrevisualizados,
        modulo: "reinicio-controlado",
        descripcion:
          formulario.descripcion.trim() ||
          `Solicitud de ${textoLegible(paramsPrevisualizados.tipo_reinicio)}`,
      });

      setReinicioCreado(reinicio);
      setResultado(null);
      toast.success(`Solicitud creada: ${reinicio.id}`);
      await cargarReinicios(empresasPermitidasIds, filtrosHistorico);
    } catch (error) {
      console.error("Error solicitando reinicio controlado:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setSolicitando(false);
    }
  }

  async function ejecutarReinicio() {
    if (!puedeGestionar) {
      toast.error("Solo admin o jefe pueden ejecutar reinicios controlados.");
      return;
    }

    if (!resumen || !reinicioCreado) {
      toast.error("Debes previsualizar y crear una solicitud antes de ejecutar.");
      return;
    }

    if (confirmacion !== "REINICIAR") {
      toast.error('La confirmacion debe ser exactamente "REINICIAR".');
      return;
    }

    setEjecutando(true);
    setErrorCarga(null);

    try {
      await ejecutarReinicioControlado({
        reinicio_id: reinicioCreado.id,
        confirmacion_texto: "",
        modo: "dryRun",
      });

      const resultadoFinal = await ejecutarReinicioControlado({
        reinicio_id: reinicioCreado.id,
        confirmacion_texto: confirmacion,
        modo: "ejecutar",
      });

      setResultado(resultadoFinal);
      setResumen(resultadoFinal.resumen_despues);
      setReinicioCreado(resultadoFinal.reinicio);
      setConfirmacion("");

      if (resultadoFinal.estado === "completado") {
        toast.success("Reinicio controlado completado.");
      } else {
        toast.error(`Reinicio finalizo en estado ${resultadoFinal.estado}. Revisar detalle.`);
      }

      await cargarReinicios(empresasPermitidasIds, filtrosHistorico);
    } catch (error) {
      console.error("Error ejecutando reinicio controlado:", error);
      toast.error(getErrorMessage(error));
      await cargarReinicios(empresasPermitidasIds, filtrosHistorico);
    } finally {
      setEjecutando(false);
    }
  }

  async function aplicarFiltrosHistorico(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await cargarReinicios(empresasPermitidasIds, filtrosHistorico);
  }

  async function limpiarFiltrosHistorico() {
    setFiltrosHistorico(FILTROS_HISTORICO_INICIALES);
    await cargarReinicios(empresasPermitidasIds, FILTROS_HISTORICO_INICIALES);
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const resumenActual = resultado?.resumen_despues || resumen;

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
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-black flex items-center gap-4">
                <RotateCcw className="text-cyan-500" size={46} />
                Reinicio Controlado
              </h1>
              <p className="text-gray-400 mt-2">
                Previsualiza, solicita y ejecuta reinicios logicos sin borrar historial
              </p>
            </div>

            <button
              type="button"
              onClick={() => void cargarReinicios(empresasPermitidasIds, filtrosHistorico)}
              disabled={cargandoReinicios}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              <RefreshCcw size={18} className={cargandoReinicios ? "animate-spin" : ""} />
              Actualizar
            </button>
          </header>

          <section className="mb-8 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-50">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
              <ShieldAlert size={22} />
              Aviso de seguridad
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 text-sm">
              <AvisoItem>No borra documentos.</AvisoItem>
              <AvisoItem>No borra auditoria.</AvisoItem>
              <AvisoItem>No borra usuarios ni permisos; solo archiva empresas de prueba.</AvisoItem>
              <AvisoItem>Los cheques pagados no se revierten automaticamente.</AvisoItem>
              <AvisoItem>Requiere previsualizacion y confirmacion exacta.</AvisoItem>
            </div>
          </section>

          {!puedeGestionar && (
            <div className="mb-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-cyan-100">
              Puedes revisar previsualizaciones por modulo, pero solo admin o jefe pueden
              solicitar y ejecutar reinicios controlados.
            </div>
          )}

          {aviso && (
            <div className="mb-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-cyan-100">
              {aviso}
            </div>
          )}

          {errorCarga && (
            <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-red-100">
              {errorCarga}
            </div>
          )}

          <form
            onSubmit={previsualizar}
            className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ClipboardList size={18} className="text-cyan-400" />
                Formulario de previsualizacion
              </h2>
              <span className="text-xs text-gray-500">
                La previsualizacion no modifica datos.
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Campo label="Empresa">
                <select
                  value={formulario.empresaId}
                  onChange={(event) => actualizarFormulario({ empresaId: event.target.value })}
                  className="campo-reinicio"
                  required
                >
                  <option value="">Seleccionar empresa</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                      {empresa.estado ? ` - ${empresa.estado}` : ""}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Tipo de reinicio">
                <select
                  value={formulario.tipoReinicio}
                  onChange={(event) =>
                    cambiarTipo(event.target.value as TipoReinicioControlado)
                  }
                  className="campo-reinicio"
                >
                  {TIPOS_REINICIO.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Fecha desde">
                <input
                  type="date"
                  value={formulario.fechaDesde}
                  onChange={(event) => actualizarFormulario({ fechaDesde: event.target.value })}
                  className="campo-reinicio"
                />
              </Campo>

              <Campo label="Fecha hasta">
                <input
                  type="date"
                  value={formulario.fechaHasta}
                  onChange={(event) => actualizarFormulario({ fechaHasta: event.target.value })}
                  className="campo-reinicio"
                />
              </Campo>

              <Campo label="Descripcion solicitud">
                <input
                  value={formulario.descripcion}
                  onChange={(event) =>
                    setFormulario((actual) => ({
                      ...actual,
                      descripcion: event.target.value,
                    }))
                  }
                  placeholder="Motivo o referencia"
                  className="campo-reinicio"
                />
              </Campo>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <CheckOpcion
                checked={formulario.incluirMovimientos}
                onChange={(checked) => actualizarFormulario({ incluirMovimientos: checked })}
                label="incluir_movimientos"
              />
              <CheckOpcion
                checked={formulario.incluirChequesNoPagados}
                onChange={(checked) =>
                  actualizarFormulario({ incluirChequesNoPagados: checked })
                }
                label="incluir_cheques_no_pagados"
              />
              <CheckOpcion
                checked={formulario.incluirFondosChequeras}
                onChange={(checked) =>
                  actualizarFormulario({ incluirFondosChequeras: checked })
                }
                label="incluir_fondos_chequeras"
              />
              <CheckOpcion
                checked={formulario.incluirCalendario}
                onChange={(checked) => actualizarFormulario({ incluirCalendario: checked })}
                label="incluir_calendario"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
              <p className="font-semibold text-amber-200">Cheques pagados:</p>
              <p>
                No se incluyen ni se revierten automaticamente. Si existen dentro del
                alcance, el helper los reporta como riesgo y bloquea anulaciones de
                movimientos por seguridad.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={previsualizando || !empresasPermitidasIds.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black hover:bg-cyan-400 disabled:opacity-50"
              >
                {previsualizando ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FileWarning size={18} />
                )}
                Previsualizar
              </button>
              <span className="self-center text-xs text-gray-500">
                Primero se simula. Luego se crea solicitud. La ejecucion exige REINICIAR.
              </span>
            </div>
          </form>

          {resumenActual && (
            <section className="mb-8">
              <ResumenPrevisualizacion
                resumen={resumenActual}
                empresaNombre={
                  empresasPorId.get(Number(resumenActual.empresa_id)) ||
                  `Empresa #${resumenActual.empresa_id}`
                }
              />
            </section>
          )}

          <section className="mb-8 grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <CheckCircle2 size={18} className="text-green-300" />
                Solicitar reinicio
              </h2>
              <p className="mb-4 text-sm text-gray-400">
                Disponible solo despues de previsualizar. La solicitud conserva el
                resumen_antes y la configuracion exacta del alcance.
              </p>
              <button
                type="button"
                onClick={() => void crearSolicitud()}
                disabled={!resumen || !paramsPrevisualizados || solicitando || !puedeGestionar}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400 disabled:opacity-50"
              >
                {solicitando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Crear solicitud de reinicio
              </button>
              {reinicioCreado && (
                <div className="mt-4 rounded-2xl border border-green-400/30 bg-green-400/10 p-4 text-sm text-green-100">
                  Solicitud #{reinicioCreado.id} creada en estado{" "}
                  <strong>{textoLegible(reinicioCreado.estado)}</strong>.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <AlertTriangle size={18} className="text-amber-300" />
                Ejecutar reinicio
              </h2>
              <p className="mb-4 text-sm text-gray-400">
                Solo se habilita con una solicitud creada en esta sesion y una
                confirmacion manual exacta.
              </p>
              <Campo label='Escribe "REINICIAR"'>
                <input
                  value={confirmacion}
                  onChange={(event) => setConfirmacion(event.target.value)}
                  placeholder="REINICIAR"
                  className="campo-reinicio"
                  disabled={!reinicioCreado || ejecutando}
                />
              </Campo>
              <button
                type="button"
                onClick={() => void ejecutarReinicio()}
                disabled={
                  !reinicioCreado ||
                  !resumen ||
                  confirmacion !== "REINICIAR" ||
                  ejecutando ||
                  !puedeGestionar
                }
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-bold text-white hover:bg-red-400 disabled:opacity-50"
              >
                {ejecutando ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                Ejecutar reinicio
              </button>
            </div>
          </section>

          {resultado && (
            <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <ClipboardList size={18} className="text-cyan-300" />
                Resultado final
              </h2>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${estadoClase(resultado.estado)}`}>
                  {textoLegible(resultado.estado)}
                </span>
                <span className="text-sm text-gray-400">
                  Operaciones registradas: {resultado.operaciones.length}
                </span>
                <span className="text-sm text-gray-400">
                  Riesgos: {resultado.riesgos.length}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {resultado.operaciones.map((operacion, index) => (
                  <div
                    key={`${operacion.tabla}-${operacion.accion}-${index}`}
                    className={`rounded-2xl border p-4 ${
                      operacion.ok
                        ? "border-green-400/30 bg-green-400/10"
                        : "border-red-400/30 bg-red-400/10"
                    }`}
                  >
                    <p className="font-bold text-white">{textoLegible(operacion.tabla)}</p>
                    <p className="text-sm text-gray-300">{textoLegible(operacion.accion)}</p>
                    <p className="mt-2 text-sm">
                      Afectados: <strong>{operacion.afectados}</strong>
                    </p>
                    {operacion.mensaje && (
                      <p className="mt-2 text-xs text-red-100">{operacion.mensaje}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ClipboardList size={18} className="text-cyan-400" />
                Ultimos reinicios
              </h2>
              <form
                onSubmit={aplicarFiltrosHistorico}
                className="grid gap-3 md:grid-cols-4"
              >
                <select
                  value={filtrosHistorico.empresaId}
                  onChange={(event) =>
                    setFiltrosHistorico((actual) => ({
                      ...actual,
                      empresaId: event.target.value,
                    }))
                  }
                  className="campo-reinicio"
                >
                  <option value="">Todas las permitidas</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={filtrosHistorico.estado}
                  onChange={(event) =>
                    setFiltrosHistorico((actual) => ({
                      ...actual,
                      estado: event.target.value,
                    }))
                  }
                  className="campo-reinicio"
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS_REINICIO.map((estado) => (
                    <option key={estado} value={estado}>
                      {textoLegible(estado)}
                    </option>
                  ))}
                </select>
                <select
                  value={filtrosHistorico.tipoReinicio}
                  onChange={(event) =>
                    setFiltrosHistorico((actual) => ({
                      ...actual,
                      tipoReinicio: event.target.value,
                    }))
                  }
                  className="campo-reinicio"
                >
                  <option value="">Todos los tipos</option>
                  {TIPOS_REINICIO.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={cargandoReinicios}
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-black hover:bg-cyan-400 disabled:opacity-50"
                  >
                    Filtrar
                  </button>
                  <button
                    type="button"
                    onClick={() => void limpiarFiltrosHistorico()}
                    disabled={cargandoReinicios}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Limpiar
                  </button>
                </div>
              </form>
            </div>

            {cargandoReinicios ? (
              <div className="flex items-center justify-center gap-3 py-16 text-gray-300">
                <Loader2 size={28} className="animate-spin" />
                Cargando reinicios...
              </div>
            ) : reinicios.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                No se encontraron reinicios para el alcance y filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="px-5 py-4 text-left">Fecha</th>
                      <th className="px-5 py-4 text-left">Empresa</th>
                      <th className="px-5 py-4 text-left">Tipo</th>
                      <th className="px-5 py-4 text-left">Estado</th>
                      <th className="px-5 py-4 text-left">Solicitado por</th>
                      <th className="px-5 py-4 text-left">Ejecutado</th>
                      <th className="px-5 py-4 text-left">Resumen compacto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {reinicios.map((reinicio) => (
                      <tr key={String(reinicio.id)} className="align-top hover:bg-white/[0.03]">
                        <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                          {mostrarFechaHora(reinicio.creado_at)}
                          <div className="text-xs text-gray-500">#{truncarId(reinicio.id)}</div>
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-gray-400" />
                            {empresasPorId.get(Number(reinicio.empresa_id)) ||
                              `Empresa #${reinicio.empresa_id}`}
                          </div>
                        </td>
                        <td className="px-5 py-4 capitalize text-gray-300">
                          {textoLegible(String(reinicio.tipo_reinicio))}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full border px-2 py-1 text-xs font-bold uppercase ${estadoClase(String(reinicio.estado))}`}>
                            {textoLegible(String(reinicio.estado))}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-300">
                          {truncarId(reinicio.solicitado_por)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                          {mostrarFechaHora(reinicio.ejecutado_at)}
                        </td>
                        <td className="px-5 py-4 min-w-72">
                          <ResumenCompacto resumen={reinicio.resumen_antes} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .campo-reinicio {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(255 255 255 / 0.1);
          background: rgb(2 6 23 / 0.9);
          padding: 0.75rem;
          color: white;
          outline: none;
        }

        .campo-reinicio:focus {
          border-color: rgb(34 211 238 / 0.7);
        }
      `}</style>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckOpcion({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

function AvisoItem({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-black/20 p-3">
      {children}
    </div>
  );
}

function TarjetaResumen({
  titulo,
  valor,
  detalle,
  icono,
}: {
  titulo: string;
  valor: string | number;
  detalle?: string;
  icono: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
        {icono}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {titulo}
      </p>
      <p className="mt-1 text-2xl font-black text-white">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-gray-400">{detalle}</p>}
    </div>
  );
}

function ResumenPrevisualizacion({
  resumen,
  empresaNombre,
}: {
  resumen: ResumenReinicioControlado;
  empresaNombre: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <FileWarning size={22} className="text-cyan-300" />
            Resultado de previsualizacion
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {empresaNombre} - {textoLegible(resumen.tipo_reinicio)}
          </p>
        </div>
        <div className="text-sm text-gray-400">
          Alcance: {resumen.fecha_desde || "inicio"} a {resumen.fecha_hasta || "hoy"}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <TarjetaResumen
          titulo="Empresa de prueba"
          valor={resumen.empresa.es_prueba ? "Si" : "No"}
          detalle={
            resumen.empresa.motivos_prueba.length
              ? resumen.empresa.motivos_prueba.join(", ")
              : "Bloqueada para ejecucion"
          }
          icono={<ShieldAlert size={20} />}
        />
        <TarjetaResumen
          titulo="Movimientos anulables"
          valor={resumen.movimientos.anulables}
          detalle={`Monto: ${formatoMonto(resumen.movimientos.monto_anulable)}`}
          icono={<ClipboardList size={20} />}
        />
        <TarjetaResumen
          titulo="Cheques no pagados"
          valor={resumen.cheques.no_pagados}
          detalle={`Pagados riesgo: ${resumen.cheques.pagados}`}
          icono={<FileWarning size={20} />}
        />
        <TarjetaResumen
          titulo="Fondos activos"
          valor={resumen.fondos.activos}
          detalle={`Comprometidos: ${resumen.fondos.con_saldo_comprometido}`}
          icono={<Building2 size={20} />}
        />
        <TarjetaResumen
          titulo="Chequeras activas"
          valor={resumen.chequeras.activas}
          detalle={`Fisicos: ${resumen.cheques_fisicos.total}`}
          icono={<ClipboardList size={20} />}
        />
        <TarjetaResumen
          titulo="Calendario pendiente"
          valor={resumen.calendario.pendientes}
          detalle={`Total: ${resumen.calendario.total}`}
          icono={<RefreshCcw size={20} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <BloqueEstado
          titulo="Movimientos por estado"
          valores={resumen.movimientos.por_estado}
          tipo="monto"
        />
        <BloqueEstado
          titulo="Cheques por estado"
          valores={resumen.cheques.por_estado}
          tipo="monto"
        />
        <BloqueEstado
          titulo="Cheques por estado_fondo"
          valores={resumen.cheques.por_estado_fondo}
          tipo="monto"
        />
        <BloqueEstado titulo="Fondos por estado" valores={resumen.fondos.por_estado} tipo="saldos" />
        <BloqueEstado
          titulo="Cheques fisicos por estado"
          valores={resumen.cheques_fisicos.por_estado}
          tipo="simple"
        />
        <BloqueEstado
          titulo="Calendario por estado"
          valores={resumen.calendario.por_estado}
          tipo="simple"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 font-bold text-white">Acciones planeadas</h3>
          {resumen.acciones_planeadas.length ? (
            <ul className="space-y-2 text-sm text-gray-300">
              {resumen.acciones_planeadas.map((accion) => (
                <li key={accion} className="flex gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan-300" />
                  <span>{accion}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No hay acciones planeadas.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 font-bold text-white">Riesgos detectados</h3>
          {resumen.riesgos.length ? (
            <div className="space-y-2">
              {resumen.riesgos.map((riesgo) => (
                <div
                  key={`${riesgo.codigo}-${riesgo.mensaje}`}
                  className={`rounded-xl border p-3 text-sm ${riesgoClase(riesgo.severidad)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="uppercase">{riesgo.severidad}</strong>
                    <span className="text-xs opacity-80">{riesgo.codigo}</span>
                  </div>
                  <p className="mt-1">{riesgo.mensaje}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-green-200">
              <CheckCircle2 size={16} />
              No se detectaron riesgos bloqueantes en la previsualizacion.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniDato label="Cheques sin fecha" valor={resumen.cheques.sin_fecha} />
        <MiniDato
          label="Cheques fisicos relacionados"
          valor={resumen.cheques.cheques_fisicos_relacionados}
        />
        <MiniDato
          label="Movimientos sin empresa detectados"
          valor={resumen.movimientos.sin_empresa_id_detectados ?? "No consultado"}
        />
        <MiniDato
          label="Dependencias activas"
          valor={`Tareas ${resumen.dependencias_operativas.tareas_activas ?? "-"} / Ordenes ${
            resumen.dependencias_operativas.ordenes_activas ?? "-"
          }`}
        />
        <MiniDato
          label="CxP / CxC"
          valor={`${resumen.dependencias_operativas.cuentas_por_pagar ?? "-"} / ${
            resumen.dependencias_operativas.cuentas_por_cobrar ?? "-"
          }`}
        />
        <MiniDato
          label="Pagos CxP / CxC"
          valor={`${resumen.dependencias_operativas.pagos_cuentas_por_pagar ?? "-"} / ${
            resumen.dependencias_operativas.pagos_cuentas_por_cobrar ?? "-"
          }`}
        />
        <MiniDato
          label="Clientes / proveedores"
          valor={`${resumen.dependencias_operativas.clientes ?? "-"} / ${
            resumen.dependencias_operativas.proveedores ?? "-"
          }`}
        />
        <MiniDato
          label="Documentos / auditoria"
          valor={`${resumen.dependencias_operativas.documentos_tramites ?? "-"} / ${
            resumen.dependencias_operativas.auditoria_eventos ?? "-"
          }`}
        />
      </div>
    </div>
  );
}

function BloqueEstado({
  titulo,
  valores,
  tipo,
}: {
  titulo: string;
  valores: Record<string, any>;
  tipo: "monto" | "saldos" | "simple";
}) {
  const entradas = contarPorEstado(valores);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-3 font-bold text-white">{titulo}</h3>
      {entradas.length === 0 ? (
        <p className="text-sm text-gray-500">Sin datos para este alcance.</p>
      ) : (
        <div className="space-y-2">
          {entradas.map(([estado, valor]) => (
            <div
              key={estado}
              className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span className="capitalize text-gray-300">{textoLegible(estado)}</span>
              <span className="text-right text-gray-100">
                {tipo === "saldos" ? (
                  <>
                    <strong>{valor.cantidad}</strong>
                    <div className="text-xs text-gray-500">
                      Disp. {formatoMonto(valor.saldo_disponible)} / Comp.{" "}
                      {formatoMonto(valor.saldo_comprometido)}
                    </div>
                  </>
                ) : tipo === "monto" ? (
                  <>
                    <strong>{valor.cantidad}</strong>
                    <div className="text-xs text-gray-500">
                      {formatoMonto(valor.monto)}
                    </div>
                  </>
                ) : (
                  <strong>{valor.cantidad}</strong>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniDato({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{valor}</p>
    </div>
  );
}

function ResumenCompacto({
  resumen,
}: {
  resumen: ResumenReinicioControlado | null;
}) {
  if (!resumen) {
    return <span className="text-gray-500">Sin resumen disponible.</span>;
  }

  return (
    <div className="space-y-1 text-xs text-gray-300">
      <div>Movimientos anulables: {resumen.movimientos.anulables}</div>
      <div>Cheques no pagados: {resumen.cheques.no_pagados}</div>
      <div>Fondos activos: {resumen.fondos.activos}</div>
      <div>Riesgos: {resumen.riesgos.length}</div>
    </div>
  );
}
