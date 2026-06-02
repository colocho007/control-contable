"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Loader2,
  Plus,
  Printer,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import {
  abrirVistaImprimible,
  descargarCsv,
  type ColumnaExportacion,
  type FilaExportacion,
} from "../../lib/exportaciones";
import {
  cancelarEventoCalendario,
  completarEventoCalendario,
  crearEventoCalendario,
  obtenerEventosOperativos,
  type EventoOperativo,
  type ObtenerEventosOperativosParams,
} from "../../lib/calendarioOperativo";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import {
  esEmpresaOperativaVisible,
  obtenerEmpresasOperativasDesdeIds,
} from "../../lib/empresasOperativas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface FiltrosCalendario {
  empresaId: string;
  fechaDesde: string;
  fechaHasta: string;
  estado: string;
  tipoEvento: string;
  responsableId: string;
  moduloOrigen: string;
  sensible: string;
  texto: string;
}

interface FormularioEvento {
  empresaId: string;
  titulo: string;
  descripcion: string;
  tipoEvento: string;
  estado: string;
  prioridad: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  responsableId: string;
  visibleDashboard: boolean;
  sensible: boolean;
}

const LIMITE_EVENTOS = 200;
const FILTROS_INICIALES: FiltrosCalendario = {
  empresaId: "",
  fechaDesde: "",
  fechaHasta: "",
  estado: "",
  tipoEvento: "",
  responsableId: "",
  moduloOrigen: "",
  sensible: "",
  texto: "",
};

const FORM_INICIAL: FormularioEvento = {
  empresaId: "",
  titulo: "",
  descripcion: "",
  tipoEvento: "operativo",
  estado: "pendiente",
  prioridad: "media",
  fechaInicio: "",
  fechaFin: "",
  horaInicio: "",
  horaFin: "",
  responsableId: "",
  visibleDashboard: true,
  sensible: false,
};

const ESTADOS_EVENTO = ["pendiente", "en_proceso", "completado", "cancelado"];
const TIPOS_EVENTO = [
  "operativo",
  "tarea",
  "cheque",
  "orden",
  "auditoria",
  "vencimiento",
  "ejecucion",
  "seguimiento",
  "pago",
  "reunion",
  "otro",
];
const PRIORIDADES = ["baja", "media", "alta", "critica"];
const MODULOS_ORIGEN = [
  "tareas",
  "cheques",
  "ordenes",
  "contabilidad",
  "finanzas",
  "documentos",
  "auditoria",
  "manual",
];

function textoLegible(valor: string | null) {
  return valor ? valor.replaceAll("_", " ") : "-";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado.";
}

function fechaLocalISO(fecha = new Date()) {
  const copia = new Date(fecha);
  copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset());
  return copia.toISOString().slice(0, 10);
}

function sumarDiasISO(dias: number) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

function fechaEvento(evento: EventoOperativo) {
  return evento.fecha || "";
}

function fechaHoraOrden(evento: EventoOperativo) {
  const hora = evento.hora || "00:00";
  return new Date(`${fechaEvento(evento)}T${hora}`).getTime();
}

function compararEventos(a: EventoOperativo, b: EventoOperativo) {
  return fechaHoraOrden(a) - fechaHoraOrden(b);
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

function estadoClase(estado: string) {
  const normalizado = estado.toLowerCase();
  if (normalizado === "completado") return "border-green-400/30 bg-green-400/10 text-green-200";
  if (normalizado === "cancelado") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (normalizado === "en_proceso") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
}

function prioridadClase(prioridad: string | null) {
  const normalizada = (prioridad || "").toLowerCase();
  if (normalizada === "critica" || normalizada === "alta") return "text-red-300";
  if (normalizada === "media") return "text-yellow-300";
  return "text-slate-300";
}

function esEstadoFinal(estado: string) {
  const normalizado = estado.trim().toLowerCase();
  return [
    "completado",
    "cancelado",
    "pagado",
    "rechazado",
    "anulado",
    "archivado",
    "aprobada",
    "aprobado",
  ].includes(normalizado);
}

function fuenteClase(fuente: EventoOperativo["fuente"]) {
  if (fuente === "calendario") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (fuente === "tareas") return "border-purple-400/30 bg-purple-400/10 text-purple-200";
  if (fuente === "cheques") return "border-green-400/30 bg-green-400/10 text-green-200";
  if (fuente === "ordenes") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-slate-400/30 bg-slate-400/10 text-slate-200";
}

function idEventoManual(evento: EventoOperativo) {
  if (evento.fuente !== "calendario") return null;
  return evento.entidad_id ?? evento.id.replace("calendario:", "");
}

export default function CalendarioPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventoOperativo[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [responsables, setResponsables] = useState<Perfil[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCalendario>(FILTROS_INICIALES);
  const [formulario, setFormulario] = useState<FormularioEvento>(FORM_INICIAL);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoCalendario, setCargandoCalendario] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [creandoEvento, setCreandoEvento] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("calendario");

        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );

          if (!volverLogin) {
            window.alert("No tienes acceso al modulo Calendario.");
          }

          router.replace(volverLogin ? "/login" : "/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          acceso.perfil?.rol || ""
        );
        const empresasOperativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const idsOperativos = empresasOperativas.ids;

        if (!activo) return;

        setEmpresasPermitidasIds(idsOperativos);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!idsOperativos.length) {
          setEventos([]);
          setEmpresas([]);
          setAviso("No tienes empresas operativas asignadas para consultar el calendario.");
          return;
        }

        setEmpresas(empresasOperativas.empresas);
        setFormulario((actual) => ({
          ...actual,
          empresaId: idsOperativos.length === 1 ? String(idsOperativos[0]) : actual.empresaId,
        }));

        await Promise.all([
          cargarEmpresas(idsOperativos),
          cargarResponsables(),
          cargarEventos(idsOperativos, FILTROS_INICIALES),
        ]);
      } catch (error) {
        console.error("Error validando acceso a calendario:", error);

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
      console.error("Error cargando empresas para calendario:", error);
      setAviso("No se pudo cargar el catalogo de empresas para filtros.");
      return;
    }

    setEmpresas(((data || []) as Empresa[]).filter(esEmpresaOperativaVisible));
  }

  async function cargarResponsables() {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre,rol,activo")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.warn("No se pudieron cargar responsables para calendario:", error.message);
      setResponsables([]);
      return;
    }

    setResponsables((data || []) as Perfil[]);
  }

  async function cargarEventos(
    idsPermitidos: number[],
    filtrosAplicados: FiltrosCalendario
  ) {
    setCargandoCalendario(true);
    setErrorCarga(null);

    try {
      if (!idsPermitidos.length) {
        setEventos([]);
        setAviso("No tienes empresas operativas asignadas para consultar el calendario.");
        return;
      }

      let idsConsulta = idsPermitidos;

      if (filtrosAplicados.empresaId) {
        const empresaId = Number(filtrosAplicados.empresaId);

        if (!Number.isInteger(empresaId) || !idsPermitidos.includes(empresaId)) {
          setEventos([]);
          setErrorCarga("La empresa seleccionada no esta autorizada.");
          return;
        }

        idsConsulta = [empresaId];
      }

      const paramsBase: Omit<
        ObtenerEventosOperativosParams,
        "empresa_id" | "empresas_ids"
      > = {
        fecha_desde: filtrosAplicados.fechaDesde || undefined,
        fecha_hasta: filtrosAplicados.fechaHasta || undefined,
        estado: filtrosAplicados.estado || undefined,
        tipo_evento: filtrosAplicados.tipoEvento || undefined,
        responsable_id: filtrosAplicados.responsableId || undefined,
        modulo_origen: filtrosAplicados.moduloOrigen || undefined,
        sensible:
          filtrosAplicados.sensible === ""
            ? undefined
            : filtrosAplicados.sensible === "true",
        texto: filtrosAplicados.texto.trim() || undefined,
        limite: LIMITE_EVENTOS,
        incluir_auditoria_general: !filtrosAplicados.empresaId,
      };

      const eventosOperativos = await obtenerEventosOperativos({
        ...paramsBase,
        empresas_ids: idsPermitidos,
        empresa_id: filtrosAplicados.empresaId
          ? Number(filtrosAplicados.empresaId)
          : undefined,
      });

      const eventosUnicos = Array.from(
        new Map(
          eventosOperativos
            .filter(
              (evento) =>
                evento.empresa_id === null ||
                idsConsulta.includes(Number(evento.empresa_id))
            )
            .map((evento) => [String(evento.id), evento])
        ).values()
      ).sort(compararEventos);

      setEventos(eventosUnicos);
      setAviso(null);
    } catch (error) {
      console.error("Error cargando calendario operativo:", error);
      setErrorCarga(getErrorMessage(error));
      setEventos([]);
    } finally {
      setCargandoCalendario(false);
    }
  }

  async function aplicarFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await cargarEventos(empresasPermitidasIds, filtros);
  }

  async function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES);
    await cargarEventos(empresasPermitidasIds, FILTROS_INICIALES);
  }

  async function crearEvento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const empresaId = Number(formulario.empresaId);
    if (!Number.isInteger(empresaId) || !empresasPermitidasIds.includes(empresaId)) {
      toast.error("Selecciona una empresa permitida.");
      return;
    }

    if (!formulario.titulo.trim()) {
      toast.error("El titulo es obligatorio.");
      return;
    }

    if (!formulario.fechaInicio) {
      toast.error("La fecha de inicio es obligatoria.");
      return;
    }

    setCreandoEvento(true);
    try {
      await crearEventoCalendario({
        empresa_id: empresaId,
        titulo: formulario.titulo.trim(),
        descripcion: formulario.descripcion.trim() || null,
        tipo_evento: formulario.tipoEvento || null,
        estado: formulario.estado || "pendiente",
        prioridad: formulario.prioridad || null,
        fecha_inicio: formulario.fechaInicio,
        fecha_fin: formulario.fechaFin || null,
        hora_inicio: formulario.horaInicio || null,
        hora_fin: formulario.horaFin || null,
        responsable_id: formulario.responsableId || null,
        visible_dashboard: formulario.visibleDashboard,
        sensible: formulario.sensible,
        modulo_origen: "manual",
        metadatos: {
          origen: "calendario_operativo",
        },
      });

      toast.success("Evento creado correctamente.");
      setFormulario({
        ...FORM_INICIAL,
        empresaId: empresasPermitidasIds.length === 1 ? String(empresasPermitidasIds[0]) : "",
      });
      await cargarEventos(empresasPermitidasIds, filtros);
    } catch (error) {
      console.error("Error creando evento de calendario:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setCreandoEvento(false);
    }
  }

  async function completarEvento(evento: EventoOperativo) {
    const eventoId = idEventoManual(evento);
    if (!eventoId) {
      toast.error("Solo los eventos manuales pueden completarse desde Calendario.");
      return;
    }

    if (!window.confirm("Deseas marcar este evento como completado?")) return;

    setProcesandoId(evento.id);
    try {
      await completarEventoCalendario(eventoId, "Completado desde Calendario Operativo");
      toast.success("Evento completado.");
      await cargarEventos(empresasPermitidasIds, filtros);
    } catch (error) {
      console.error("Error completando evento:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setProcesandoId(null);
    }
  }

  async function cancelarEvento(evento: EventoOperativo) {
    const eventoId = idEventoManual(evento);
    if (!eventoId) {
      toast.error("Solo los eventos manuales pueden cancelarse desde Calendario.");
      return;
    }

    const motivo = window.prompt("Motivo de cancelacion (opcional):");
    if (motivo === null) return;

    setProcesandoId(evento.id);
    try {
      await cancelarEventoCalendario(
        eventoId,
        motivo.trim() || "Cancelado desde Calendario Operativo"
      );
      toast.success("Evento cancelado.");
      await cargarEventos(empresasPermitidasIds, filtros);
    } catch (error) {
      console.error("Error cancelando evento:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setProcesandoId(null);
    }
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const responsablesPorId = useMemo(
    () => new Map(responsables.map((responsable) => [responsable.id, responsable.nombre])),
    [responsables]
  );

  const resumen = useMemo(() => {
    const hoy = fechaLocalISO();
    const enSieteDias = sumarDiasISO(7);

    return {
      pendientes: eventos.filter((evento) => !esEstadoFinal(evento.estado)).length,
      completados: eventos.filter(
        (evento) => evento.estado.trim().toLowerCase() === "completado"
      ).length,
      cancelados: eventos.filter(
        (evento) => evento.estado.trim().toLowerCase() === "cancelado"
      ).length,
      hoy: eventos.filter((evento) => fechaEvento(evento) === hoy).length,
      proximos: eventos.filter((evento) => {
        const fecha = fechaEvento(evento);
        return (
          fecha >= hoy &&
          fecha <= enSieteDias &&
          !esEstadoFinal(evento.estado)
        );
      }).length,
    };
  }, [eventos]);

  const columnasExportacion: ColumnaExportacion[] = [
    { clave: "fecha", titulo: "Fecha" },
    { clave: "hora", titulo: "Hora" },
    { clave: "empresa", titulo: "Empresa" },
    { clave: "titulo", titulo: "Titulo" },
    { clave: "fuente", titulo: "Fuente" },
    { clave: "tipo_evento", titulo: "Tipo" },
    { clave: "estado", titulo: "Estado" },
    { clave: "prioridad", titulo: "Prioridad" },
    { clave: "modulo_origen", titulo: "Modulo origen" },
    { clave: "entidad", titulo: "Entidad" },
    { clave: "responsable", titulo: "Responsable" },
    { clave: "sensible", titulo: "Sensible" },
  ];

  function filasExportacion(): FilaExportacion[] {
    return eventos.map((evento) => ({
      fecha: evento.fecha,
      hora: evento.hora || "",
      empresa:
        evento.empresa_id === null
          ? "General"
          : empresasPorId.get(Number(evento.empresa_id)) ||
            `Empresa #${evento.empresa_id}`,
      titulo: evento.titulo,
      fuente: evento.fuente,
      tipo_evento: evento.tipo_evento || "",
      estado: evento.estado,
      prioridad: evento.prioridad || "",
      modulo_origen: evento.modulo_origen || "",
      entidad:
        evento.entidad_id !== null && evento.entidad_id !== undefined
          ? `${textoLegible(evento.entidad_tipo)} #${evento.entidad_id}`
          : textoLegible(evento.entidad_tipo),
      responsable: evento.responsable_id
        ? responsablesPorId.get(evento.responsable_id) || evento.responsable_id
        : "",
      sensible: evento.sensible,
    }));
  }

  function exportarCsv() {
    const filas = filasExportacion();
    if (!filas.length) {
      window.alert("No hay eventos de calendario para exportar.");
      return;
    }

    descargarCsv("calendario-operativo.csv", columnasExportacion, filas);
  }

  function imprimirPdf() {
    const filas = filasExportacion();
    if (!filas.length) {
      window.alert("No hay eventos de calendario para imprimir.");
      return;
    }

    abrirVistaImprimible(
      "Calendario Operativo",
      "Eventos, vencimientos, ejecuciones y seguimiento por fecha",
      columnasExportacion,
      filas,
      {
        "Eventos pendientes": resumen.pendientes,
        "Eventos completados": resumen.completados,
        "Eventos cancelados": resumen.cancelados,
        "Eventos de hoy": resumen.hoy,
        "Proximos 7 dias": resumen.proximos,
      }
    );
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
              <h1 className="text-4xl md:text-5xl font-black flex items-center gap-4">
                <CalendarDays className="text-cyan-500" size={46} />
                Calendario Operativo
              </h1>
              <p className="text-gray-400 mt-2">
                Eventos, vencimientos, ejecuciones y seguimiento por fecha
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportarCsv}
                disabled={!eventos.length}
                className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-bold disabled:opacity-50"
              >
                <Download size={18} />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={imprimirPdf}
                disabled={!eventos.length}
                className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-bold disabled:opacity-50"
              >
                <Printer size={18} />
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => void cargarEventos(empresasPermitidasIds, filtros)}
                disabled={cargandoCalendario}
                className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-3 font-bold disabled:opacity-50"
              >
                <RefreshCcw size={18} className={cargandoCalendario ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </header>

          <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
            <TarjetaResumen titulo="Eventos pendientes" valor={resumen.pendientes} icono={<Clock size={22} />} />
            <TarjetaResumen titulo="Eventos completados" valor={resumen.completados} icono={<CheckCircle2 size={22} />} />
            <TarjetaResumen titulo="Eventos cancelados" valor={resumen.cancelados} icono={<XCircle size={22} />} />
            <TarjetaResumen titulo="Eventos de hoy" valor={resumen.hoy} icono={<CalendarDays size={22} />} />
            <TarjetaResumen titulo="Proximos 7 dias" valor={resumen.proximos} icono={<RefreshCcw size={22} />} />
          </section>

          <form
            onSubmit={aplicarFiltros}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-8"
          >
            <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
              <Filter size={18} className="text-cyan-400" />
              Filtros
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
              <Campo label="Empresa">
                <select
                  value={filtros.empresaId}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, empresaId: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  <option value="">Todas las permitidas</option>
                  {empresas.map((empresa) => (
                    <option value={empresa.id} key={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Fecha desde">
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, fechaDesde: event.target.value }))
                  }
                  className="campo-calendario"
                />
              </Campo>

              <Campo label="Fecha hasta">
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, fechaHasta: event.target.value }))
                  }
                  className="campo-calendario"
                />
              </Campo>

              <Campo label="Estado">
                <select
                  value={filtros.estado}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, estado: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  <option value="">Todos</option>
                  {ESTADOS_EVENTO.map((estado) => (
                    <option key={estado} value={estado}>
                      {textoLegible(estado)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Tipo de evento">
                <select
                  value={filtros.tipoEvento}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, tipoEvento: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  <option value="">Todos</option>
                  {TIPOS_EVENTO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {textoLegible(tipo)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Responsable">
                <select
                  value={filtros.responsableId}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, responsableId: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  <option value="">Todos</option>
                  {responsables.map((responsable) => (
                    <option key={responsable.id} value={responsable.id}>
                      {responsable.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Modulo origen">
                <select
                  value={filtros.moduloOrigen}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, moduloOrigen: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  <option value="">Todos</option>
                  {MODULOS_ORIGEN.map((modulo) => (
                    <option key={modulo} value={modulo}>
                      {textoLegible(modulo)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Sensible">
                <select
                  value={filtros.sensible}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, sensible: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  <option value="">Todos</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </Campo>

              <Campo label="Texto">
                <input
                  value={filtros.texto}
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, texto: event.target.value }))
                  }
                  placeholder="Buscar evento"
                  className="campo-calendario"
                />
              </Campo>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="submit"
                disabled={cargandoCalendario}
                className="bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => void limpiarFiltros()}
                disabled={cargandoCalendario}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-gray-200 disabled:opacity-50"
              >
                Limpiar
              </button>
              <span className="text-xs text-gray-500 self-center">
                Maximo {LIMITE_EVENTOS} eventos por empresa consultada
              </span>
            </div>
          </form>

          <form
            onSubmit={crearEvento}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-8"
          >
            <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
              <Plus size={18} className="text-cyan-400" />
              Crear evento
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Campo label="Empresa">
                <select
                  value={formulario.empresaId}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, empresaId: event.target.value }))
                  }
                  className="campo-calendario"
                  required
                >
                  <option value="">Seleccionar empresa</option>
                  {empresas.map((empresa) => (
                    <option value={empresa.id} key={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Titulo">
                <input
                  value={formulario.titulo}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, titulo: event.target.value }))
                  }
                  placeholder="Ej. Pago proveedor"
                  className="campo-calendario"
                  required
                />
              </Campo>

              <Campo label="Tipo evento">
                <select
                  value={formulario.tipoEvento}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, tipoEvento: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  {TIPOS_EVENTO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {textoLegible(tipo)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Estado">
                <select
                  value={formulario.estado}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, estado: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  {ESTADOS_EVENTO.map((estado) => (
                    <option key={estado} value={estado}>
                      {textoLegible(estado)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Prioridad">
                <select
                  value={formulario.prioridad}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, prioridad: event.target.value }))
                  }
                  className="campo-calendario"
                >
                  {PRIORIDADES.map((prioridad) => (
                    <option key={prioridad} value={prioridad}>
                      {textoLegible(prioridad)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Fecha inicio">
                <input
                  type="date"
                  value={formulario.fechaInicio}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, fechaInicio: event.target.value }))
                  }
                  className="campo-calendario"
                  required
                />
              </Campo>

              <Campo label="Fecha fin">
                <input
                  type="date"
                  value={formulario.fechaFin}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, fechaFin: event.target.value }))
                  }
                  className="campo-calendario"
                />
              </Campo>

              <Campo label="Hora inicio">
                <input
                  type="time"
                  value={formulario.horaInicio}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, horaInicio: event.target.value }))
                  }
                  className="campo-calendario"
                />
              </Campo>

              <Campo label="Hora fin">
                <input
                  type="time"
                  value={formulario.horaFin}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, horaFin: event.target.value }))
                  }
                  className="campo-calendario"
                />
              </Campo>

              {responsables.length > 0 && (
                <Campo label="Responsable">
                  <select
                    value={formulario.responsableId}
                    onChange={(event) =>
                      setFormulario((actual) => ({
                        ...actual,
                        responsableId: event.target.value,
                      }))
                    }
                    className="campo-calendario"
                  >
                    <option value="">Sin responsable</option>
                    {responsables.map((responsable) => (
                      <option key={responsable.id} value={responsable.id}>
                        {responsable.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}

              <Campo label="Descripcion">
                <textarea
                  value={formulario.descripcion}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, descripcion: event.target.value }))
                  }
                  rows={2}
                  placeholder="Notas del evento"
                  className="campo-calendario"
                />
              </Campo>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-5">
              <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formulario.visibleDashboard}
                    onChange={(event) =>
                      setFormulario((actual) => ({
                        ...actual,
                        visibleDashboard: event.target.checked,
                      }))
                    }
                  />
                  Visible dashboard
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formulario.sensible}
                    onChange={(event) =>
                      setFormulario((actual) => ({ ...actual, sensible: event.target.checked }))
                    }
                  />
                  Sensible
                </label>
              </div>

              <button
                type="submit"
                disabled={creandoEvento || !empresasPermitidasIds.length}
                className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-3 font-bold disabled:opacity-50"
              >
                {creandoEvento ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Crear evento
              </button>
            </div>
          </form>

          {aviso && (
            <div className="border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 rounded-2xl px-5 py-4 mb-5">
              {aviso}
            </div>
          )}

          {errorCarga && (
            <div className="border border-red-400/30 bg-red-400/10 text-red-200 rounded-2xl px-5 py-4 mb-5">
              {errorCarga}
            </div>
          )}

          <section className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            {cargandoCalendario ? (
              <div className="flex items-center justify-center gap-3 py-20 text-gray-300">
                <Loader2 className="animate-spin" size={28} />
                Cargando calendario...
              </div>
            ) : eventos.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                No se encontraron eventos para el alcance y filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="text-left px-5 py-4">Fecha</th>
                      <th className="text-left px-5 py-4">Hora</th>
                      <th className="text-left px-5 py-4">Empresa</th>
                      <th className="text-left px-5 py-4">Titulo</th>
                      <th className="text-left px-5 py-4">Fuente</th>
                      <th className="text-left px-5 py-4">Tipo</th>
                      <th className="text-left px-5 py-4">Estado</th>
                      <th className="text-left px-5 py-4">Prioridad</th>
                      <th className="text-left px-5 py-4">Modulo origen</th>
                      <th className="text-left px-5 py-4">Responsable</th>
                      <th className="text-left px-5 py-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {eventos.map((evento) => (
                      <tr key={evento.id} className="align-top hover:bg-white/[0.03]">
                        <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                          {mostrarFecha(evento.fecha)}
                          {evento.fecha_fin && evento.fecha_fin !== evento.fecha && (
                            <div className="text-xs text-gray-500">
                              hasta {mostrarFecha(evento.fecha_fin)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                          {evento.hora || "-"}
                          {evento.hora_fin && <div className="text-xs text-gray-500">a {evento.hora_fin}</div>}
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-gray-400" />
                            {evento.empresa_id === null
                              ? "General"
                              : empresasPorId.get(Number(evento.empresa_id)) ||
                              `Empresa #${evento.empresa_id}`}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-64">
                          <p className="font-semibold text-white">{evento.titulo}</p>
                          {evento.descripcion && (
                            <p className="text-xs text-gray-400 mt-1">{evento.descripcion}</p>
                          )}
                          {evento.sensible && (
                            <span className="inline-block mt-2 text-[11px] rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 px-2 py-0.5">
                              Sensible
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${fuenteClase(
                              evento.fuente
                            )}`}
                          >
                            {textoLegible(evento.fuente)}
                          </span>
                        </td>
                        <td className="px-5 py-4 capitalize text-gray-300">
                          {textoLegible(evento.tipo_evento)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold capitalize ${estadoClase(
                              evento.estado
                            )}`}
                          >
                            {textoLegible(evento.estado)}
                          </span>
                        </td>
                        <td className={`px-5 py-4 capitalize font-semibold ${prioridadClase(evento.prioridad)}`}>
                          {textoLegible(evento.prioridad)}
                        </td>
                        <td className="px-5 py-4 capitalize text-gray-300">
                          {textoLegible(evento.modulo_origen)}
                        </td>
                        <td className="px-5 py-4 text-gray-300">
                          {evento.responsable_id
                            ? responsablesPorId.get(evento.responsable_id) || evento.responsable_id
                            : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            {evento.fuente === "calendario" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void completarEvento(evento)}
                                  disabled={
                                    procesandoId === evento.id ||
                                    esEstadoFinal(evento.estado)
                                  }
                                  className="inline-flex items-center justify-center gap-2 bg-green-500/10 border border-green-400/30 text-green-200 hover:bg-green-500/20 rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  Completar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void cancelarEvento(evento)}
                                  disabled={
                                    procesandoId === evento.id ||
                                    esEstadoFinal(evento.estado)
                                  }
                                  className="inline-flex items-center justify-center gap-2 bg-red-500/10 border border-red-400/30 text-red-200 hover:bg-red-500/20 rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                                >
                                  <XCircle size={14} />
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
                                Solo consulta
                              </span>
                            )}
                          </div>
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
        .campo-calendario {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.65rem 0.75rem;
          color: white;
          outline: none;
        }
        .campo-calendario:focus {
          border-color: rgba(6, 182, 212, 0.6);
        }
        .campo-calendario option {
          background: #0f172a;
        }
      `}</style>
    </div>
  );
}

function TarjetaResumen({
  titulo,
  valor,
  icono,
}: {
  titulo: string;
  valor: number;
  icono: ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between text-cyan-400 mb-3">
        <span className="text-sm font-semibold text-gray-400">{titulo}</span>
        {icono}
      </div>
      <div className="text-3xl font-black">{valor}</div>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
      {label}
      {children}
    </label>
  );
}
