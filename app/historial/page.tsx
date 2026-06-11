"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  Building2,
  CalendarDays,
  Clock,
  Download,
  History,
  Layers,
  Printer,
  RefreshCcw,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import {
  abrirVistaImprimible,
  descargarCsv,
  type ColumnaExportacion,
  type FilaExportacion,
} from "../../lib/exportaciones";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { registrarRateLimitOperativo } from "../../lib/rateLimitOperativo";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

interface Empresa {
  id: number;
  nombre: string;
}

type MetadatosAuditoria =
  | string
  | number
  | boolean
  | null
  | MetadatosAuditoria[]
  | { [clave: string]: MetadatosAuditoria };

interface AuditoriaEvento {
  id: string | number;
  creado_at: string;
  usuario_id: string;
  usuario_nombre_snapshot: string | null;
  empresa_id: number | null;
  modulo: string;
  accion: string;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  motivo: string | null;
  descripcion: string | null;
  metadatos: MetadatosAuditoria | null;
  sensible: boolean;
  visible_usuario: boolean;
  visible_calendario: boolean;
  origen: string | null;
}

interface FiltrosHistorial {
  fechaDesde: string;
  fechaHasta: string;
  empresaId: string;
  modulo: string;
  usuarioId: string;
  accion: string;
  entidadTipo: string;
  sensible: string;
  visibleCalendario: string;
}

const ROLES_PERMITIDOS = ["admin", "jefe", "supervisor"];
const LIMITE_EVENTOS = 200;
const LIMITE_FILAS_EXPORTACION_HISTORIAL = 1000;
const RATE_LIMIT_EXPORTACIONES_HISTORIAL = 10;
const RATE_LIMIT_EXPORTACIONES_HISTORIAL_SEGUNDOS = 15 * 60;
const VENTANA_EXPORTACION_REPETIDA_MS = 2000;
const COLUMNAS_AUDITORIA =
  "id,creado_at,usuario_id,usuario_nombre_snapshot,empresa_id,modulo,accion,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,descripcion,metadatos,sensible,visible_usuario,visible_calendario,origen";
const FILTROS_INICIALES: FiltrosHistorial = {
  fechaDesde: "",
  fechaHasta: "",
  empresaId: "",
  modulo: "",
  usuarioId: "",
  accion: "",
  entidadTipo: "",
  sensible: "",
  visibleCalendario: "",
};

function etiqueta(valor: string | null) {
  return valor ? valor.replaceAll("_", " ") : "Sin dato";
}

function fechaHora(valor: string) {
  return new Date(valor).toLocaleString("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function HistorialPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>(
    []
  );
  const [filtros, setFiltros] =
    useState<FiltrosHistorial>(FILTROS_INICIALES);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [avisoCarga, setAvisoCarga] = useState<string | null>(null);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null);
  const exportacionEnProcesoRef = useRef(false);
  const ultimaExportacionAtRef = useRef(0);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("historial");

        if (!activo) return;

        if (!acceso.ok) {
          const debeVolverAlLogin = [
            "sin_sesion",
            "sin_perfil",
            "usuario_inactivo",
          ].includes(acceso.motivo || "");

          if (!debeVolverAlLogin) {
            window.alert("No tienes acceso al modulo Historial.");
          }

          router.replace(debeVolverAlLogin ? "/login" : "/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          acceso.perfil?.rol || ""
        );
        const funciones = await listarFuncionesOperativasUsuario(acceso.user!.id, idsPermitidos);
        const rolNormalizado = (acceso.perfil?.rol || "").trim().toLowerCase();

        if (!ROLES_PERMITIDOS.includes(rolNormalizado) && !esAuditorSoloLecturaLocal(funciones, idsPermitidos)) {
          router.replace("/dashboard");
          return;
        }

        if (!activo) return;

        setUsuarioActualId(acceso.user!.id);
        setEmpresasPermitidasIds(idsPermitidos);
        setFuncionesOperativas(funciones);
        setAutorizado(true);
        setValidandoAcceso(false);

        await Promise.all([
          cargarEmpresas(idsPermitidos),
          cargarEventos(idsPermitidos, FILTROS_INICIALES),
        ]);
      } catch (error) {
        console.error("Error validando acceso a historial:", error);

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
    if (!idsPermitidos.length) {
      setEmpresas([]);
      return;
    }

    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando empresas para historial:", error);
      setAvisoCarga(
        "No se pudo cargar el catalogo de empresas para los filtros."
      );
      return;
    }

    setEmpresas((data || []) as Empresa[]);
  }

  async function cargarEventos(
    idsPermitidos: number[],
    filtrosAplicados: FiltrosHistorial
  ) {
    setCargandoHistorial(true);
    setErrorCarga(null);

    try {
      let query = supabase.from("auditoria_eventos").select(COLUMNAS_AUDITORIA);

      if (filtrosAplicados.empresaId === "general") {
        query = query.is("empresa_id", null);
      } else if (filtrosAplicados.empresaId) {
        const empresaId = Number(filtrosAplicados.empresaId);

        if (
          !Number.isFinite(empresaId) ||
          !idsPermitidos.includes(empresaId)
        ) {
          setEventos([]);
          void auditarConsultaHistorial("bloquear_consulta_historial", {
            motivo: "empresa_no_permitida",
            filtros: filtrosAplicados,
          });
          void registrarIntentoBloqueadoHistorial("empresa_no_permitida", {
            accion: "consultar_historial",
            filtros: filtrosAplicados,
          });
          return;
        }

        query = query.eq("empresa_id", empresaId);
      } else if (idsPermitidos.length) {
        query = query.or(
          `empresa_id.is.null,empresa_id.in.(${idsPermitidos.join(",")})`
        );
      } else {
        query = query.is("empresa_id", null);
      }

      if (filtrosAplicados.fechaDesde) {
        query = query.gte(
          "creado_at",
          `${filtrosAplicados.fechaDesde}T00:00:00.000`
        );
      }

      if (filtrosAplicados.fechaHasta) {
        query = query.lte(
          "creado_at",
          `${filtrosAplicados.fechaHasta}T23:59:59.999`
        );
      }

      if (filtrosAplicados.modulo) {
        query = query.eq("modulo", filtrosAplicados.modulo);
      }

      if (filtrosAplicados.usuarioId) {
        query = query.eq("usuario_id", filtrosAplicados.usuarioId);
      }

      if (filtrosAplicados.accion) {
        query = query.eq("accion", filtrosAplicados.accion);
      }

      if (filtrosAplicados.entidadTipo) {
        query = query.eq("entidad_tipo", filtrosAplicados.entidadTipo);
      }

      if (filtrosAplicados.sensible) {
        query = query.eq(
          "sensible",
          filtrosAplicados.sensible === "true"
        );
      }

      if (filtrosAplicados.visibleCalendario) {
        query = query.eq(
          "visible_calendario",
          filtrosAplicados.visibleCalendario === "true"
        );
      }

      const { data, error } = await query
        .order("creado_at", { ascending: false })
        .limit(LIMITE_EVENTOS);

      if (error) throw error;

      setEventos((data || []) as AuditoriaEvento[]);
      await auditarConsultaHistorial("consultar_historial", {
        cantidad: (data || []).length,
        filtros: filtrosAplicados,
      });
    } catch (error) {
      console.error("Error cargando auditoria_eventos:", error);
      setErrorCarga("No se pudo cargar el historial general.");
      setEventos([]);
    } finally {
      setCargandoHistorial(false);
    }
  }

  function aplicarFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void cargarEventos(empresasPermitidasIds, filtros);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES);
    void cargarEventos(empresasPermitidasIds, FILTROS_INICIALES);
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const modulos = useMemo(() => {
    const valores = new Set(eventos.map((evento) => evento.modulo));
    if (filtros.modulo) valores.add(filtros.modulo);
    return Array.from(valores).sort();
  }, [eventos, filtros.modulo]);

  const acciones = useMemo(() => {
    const valores = new Set(eventos.map((evento) => evento.accion));
    if (filtros.accion) valores.add(filtros.accion);
    return Array.from(valores).sort();
  }, [eventos, filtros.accion]);

  const entidades = useMemo(() => {
    const valores = new Set(
      eventos
        .map((evento) => evento.entidad_tipo)
        .filter((valor): valor is string => Boolean(valor))
    );
    if (filtros.entidadTipo) valores.add(filtros.entidadTipo);
    return Array.from(valores).sort();
  }, [eventos, filtros.entidadTipo]);

  const usuarios = useMemo(() => {
    const valores = new Map<string, string>();
    eventos.forEach((evento) => {
      valores.set(
        evento.usuario_id,
        evento.usuario_nombre_snapshot || "Usuario no disponible"
      );
    });

    if (filtros.usuarioId && !valores.has(filtros.usuarioId)) {
      valores.set(filtros.usuarioId, filtros.usuarioId);
    }

    return Array.from(valores.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [eventos, filtros.usuarioId]);

  const resumen = useMemo(
    () => ({
      total: eventos.length,
      sensibles: eventos.filter((evento) => evento.sensible).length,
      calendario: eventos.filter((evento) => evento.visible_calendario).length,
      modulos: new Set(eventos.map((evento) => evento.modulo)).size,
    }),
    [eventos]
  );

  const columnasExportacion: ColumnaExportacion[] = [
    { clave: "fecha", titulo: "Fecha" },
    { clave: "empresa", titulo: "Empresa" },
    { clave: "modulo", titulo: "Modulo" },
    { clave: "accion", titulo: "Accion" },
    { clave: "usuario", titulo: "Usuario" },
    { clave: "entidad", titulo: "Entidad" },
    { clave: "estado_anterior", titulo: "Estado anterior" },
    { clave: "estado_nuevo", titulo: "Estado nuevo" },
    { clave: "motivo", titulo: "Motivo" },
    { clave: "sensible", titulo: "Sensible" },
    { clave: "visible_calendario", titulo: "Visible calendario" },
  ];

  function filasExportacion(): FilaExportacion[] {
    return eventos.map((evento) => ({
      fecha: evento.creado_at,
      empresa:
        evento.empresa_id === null
          ? "General"
          : empresasPorId.get(Number(evento.empresa_id)) ||
            "Empresa no disponible",
      modulo: evento.modulo,
      accion: evento.accion,
      usuario: evento.usuario_nombre_snapshot || "Usuario no disponible",
      entidad:
        evento.entidad_id !== null
          ? `${etiqueta(evento.entidad_tipo)} #${evento.entidad_id}`
          : etiqueta(evento.entidad_tipo),
      estado_anterior: evento.estado_anterior || "",
      estado_nuevo: evento.estado_nuevo || "",
      motivo: evento.motivo || "",
      sensible: evento.sensible,
      visible_calendario: evento.visible_calendario,
    }));
  }

  async function exportarCsv() {
    const filas = filasExportacion();
    if (!filas.length) {
      window.alert("No hay eventos de historial para exportar.");
      return;
    }

    if (!validarExportacionHistorial("csv", filas.length)) {
      return;
    }

    const rateLimit = await validarRateLimitExportacionHistorial("csv", filas.length);
    if (!rateLimit.permitido) {
      liberarExportacionHistorial();
      window.alert(rateLimit.mensaje);
      void auditarConsultaHistorial("bloquear_exportacion_historial", {
        formato: "csv",
        motivo: "rate_limit_excedido",
        cantidad: filas.length,
        retry_after_segundos: rateLimit.retry_after_segundos,
        rpc_registro_intento_bloqueado: rateLimit.rpc_disponible,
        filtros,
      });
      return;
    }

    void auditarConsultaHistorial("exportar_historial", {
      formato: "csv",
      cantidad: filas.length,
      limite_filas: LIMITE_FILAS_EXPORTACION_HISTORIAL,
      filtros,
    });
    try {
      descargarCsv("historial-general.csv", columnasExportacion, filas);
    } finally {
      liberarExportacionHistorial();
    }
  }

  async function imprimirPdf() {
    const filas = filasExportacion();
    if (!filas.length) {
      window.alert("No hay eventos de historial para imprimir.");
      return;
    }

    if (!validarExportacionHistorial("pdf_vista_imprimible", filas.length)) {
      return;
    }

    const rateLimit = await validarRateLimitExportacionHistorial(
      "pdf_vista_imprimible",
      filas.length
    );
    if (!rateLimit.permitido) {
      liberarExportacionHistorial();
      window.alert(rateLimit.mensaje);
      void auditarConsultaHistorial("bloquear_exportacion_historial", {
        formato: "pdf_vista_imprimible",
        motivo: "rate_limit_excedido",
        cantidad: filas.length,
        retry_after_segundos: rateLimit.retry_after_segundos,
        rpc_registro_intento_bloqueado: rateLimit.rpc_disponible,
        filtros,
      });
      return;
    }

    void auditarConsultaHistorial("imprimir_historial", {
      formato: "pdf_vista_imprimible",
      cantidad: filas.length,
      limite_filas: LIMITE_FILAS_EXPORTACION_HISTORIAL,
      filtros,
    });
    try {
      abrirVistaImprimible(
        "Historial general",
        "Bitacora central de operaciones del sistema",
        columnasExportacion,
        filas,
        {
          "Eventos mostrados": resumen.total,
          Sensibles: resumen.sensibles,
          "En calendario": resumen.calendario,
          "Modulos activos": resumen.modulos,
        }
      );
    } finally {
      liberarExportacionHistorial();
    }
  }

  function validarExportacionHistorial(formato: string, cantidad: number) {
    const ahora = Date.now();
    const empresaFiltrada =
      filtros.empresaId && filtros.empresaId !== "general" ? Number(filtros.empresaId) : null;

    if (
      empresaFiltrada !== null &&
      (!Number.isInteger(empresaFiltrada) || !empresasPermitidasIds.includes(empresaFiltrada))
    ) {
      window.alert("La empresa seleccionada no esta autorizada para exportar.");
      void auditarConsultaHistorial("bloquear_exportacion_historial", {
        formato,
        motivo: "empresa_no_permitida",
        cantidad,
        filtros,
      });
      void registrarIntentoBloqueadoHistorial("empresa_no_permitida", {
        accion: "exportar_historial",
        formato,
        cantidad,
        filtros,
      });
      return false;
    }

    const repetida =
      exportacionEnProcesoRef.current ||
      ahora - ultimaExportacionAtRef.current < VENTANA_EXPORTACION_REPETIDA_MS;

    if (repetida) {
      window.alert("Ya hay una exportacion de historial en proceso. Espera un momento.");
      void auditarConsultaHistorial("bloquear_exportacion_historial", {
        formato,
        motivo: "exportacion_repetida",
        cantidad,
        filtros,
      });
      void registrarIntentoBloqueadoHistorial("exportacion_repetida", {
        formato,
        cantidad,
        filtros,
      });
      return false;
    }

    if (cantidad > LIMITE_FILAS_EXPORTACION_HISTORIAL) {
      window.alert("La exportacion supera el limite operativo de filas. Ajusta filtros.");
      void auditarConsultaHistorial("bloquear_exportacion_historial", {
        formato,
        motivo: "limite_filas",
        cantidad,
        limite_filas: LIMITE_FILAS_EXPORTACION_HISTORIAL,
        filtros,
      });
      void registrarIntentoBloqueadoHistorial("limite_filas_exportacion", {
        formato,
        cantidad,
        limite_filas: LIMITE_FILAS_EXPORTACION_HISTORIAL,
        filtros,
      });
      return false;
    }

    exportacionEnProcesoRef.current = true;
    ultimaExportacionAtRef.current = ahora;
    return true;
  }

  function liberarExportacionHistorial() {
    window.setTimeout(() => {
      exportacionEnProcesoRef.current = false;
    }, 800);
  }

  async function validarRateLimitExportacionHistorial(formato: string, cantidad: number) {
    if (!usuarioActualId) {
      return { permitido: true, mensaje: "", retry_after_segundos: 0, rpc_disponible: false };
    }

    const empresaId =
      filtros.empresaId && filtros.empresaId !== "general" ? Number(filtros.empresaId) : null;
    const empresaPermitida =
      empresaId !== null && Number.isInteger(empresaId) && empresasPermitidasIds.includes(empresaId)
        ? empresaId
        : null;

    return registrarRateLimitOperativo({
      usuarioId: usuarioActualId,
      modulo: "historial",
      accion: "exportar_historial",
      limite: RATE_LIMIT_EXPORTACIONES_HISTORIAL,
      ventanaSegundos: RATE_LIMIT_EXPORTACIONES_HISTORIAL_SEGUNDOS,
      alcance: empresaPermitida ? "usuario_empresa" : "usuario",
      empresaId: empresaPermitida,
      claveSufijo: formato,
      metadatos: {
        formato,
        cantidad,
        fecha_desde: filtros.fechaDesde || null,
        fecha_hasta: filtros.fechaHasta || null,
        modulo_filtro: filtros.modulo || null,
      },
    });
  }

  async function auditarConsultaHistorial(accion: string, metadatos: Record<string, unknown>) {
    try {
      await registrarAuditoriaEvento({
        modulo: "historial",
        accion,
        entidad_tipo: "auditoria_eventos",
        descripcion: "Consulta de historial auditada",
        sensible: true,
        metadatos: {
          ...metadatos,
          auditor_solo_lectura: esAuditorSoloLecturaLocal(funcionesOperativas),
        },
        origen: "modulo_historial",
      });
    } catch (error) {
      console.warn("No se pudo auditar consulta de historial:", error);
    }
  }

  async function registrarIntentoBloqueadoHistorial(
    motivo: string,
    metadatos: Record<string, unknown>
  ) {
    if (!usuarioActualId) return;

    const empresaId =
      motivo === "empresa_no_permitida" || filtros.empresaId === "general"
        ? null
        : filtros.empresaId
          ? Number(filtros.empresaId)
          : null;

    try {
      await supabase.from("intentos_bloqueados").insert({
        usuario_id: usuarioActualId,
        empresa_id: empresaId && Number.isFinite(empresaId) ? empresaId : null,
        modulo: "historial",
        accion:
          typeof metadatos.accion === "string" ? metadatos.accion : "exportar_historial",
        motivo,
        severidad: motivo.includes("limite") ? "alta" : "media",
        entidad_tipo: "auditoria_eventos",
        mensaje: "Exportacion de historial bloqueada por control operativo.",
        metadatos: {
          ...metadatos,
          auditor_solo_lectura: esAuditorSoloLecturaLocal(funcionesOperativas),
        },
      });
    } catch (error) {
      console.warn("No se pudo registrar intento bloqueado de historial:", error);
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black flex items-center gap-4">
                <History className="text-cyan-500" size={46} />
                Historial general
              </h1>
              <p className="text-gray-400 mt-2">
                Bitacora central de operaciones del sistema
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
                disabled={cargandoHistorial}
                className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-3 font-bold disabled:opacity-50"
              >
                <RefreshCcw size={18} className={cargandoHistorial ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>

          <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <TarjetaResumen
              titulo="Eventos mostrados"
              valor={resumen.total}
              icono={<History size={22} />}
            />
            <TarjetaResumen
              titulo="Sensibles"
              valor={resumen.sensibles}
              icono={<ShieldAlert size={22} />}
            />
            <TarjetaResumen
              titulo="En calendario"
              valor={resumen.calendario}
              icono={<CalendarDays size={22} />}
            />
            <TarjetaResumen
              titulo="Modulos activos"
              valor={resumen.modulos}
              icono={<Layers size={22} />}
            />
          </section>

          <form
            onSubmit={aplicarFiltros}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-8"
          >
            <div className="flex items-center gap-2 mb-5">
              <History size={18} className="text-cyan-400" />
              <h2 className="font-bold text-lg">Filtros</h2>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
              <Campo label="Fecha desde">
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      fechaDesde: event.target.value,
                    }))
                  }
                  className="campo-historial"
                />
              </Campo>

              <Campo label="Fecha hasta">
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      fechaHasta: event.target.value,
                    }))
                  }
                  className="campo-historial"
                />
              </Campo>

              <Campo label="Empresa">
                <select
                  value={filtros.empresaId}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      empresaId: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todas las permitidas</option>
                  <option value="general">General del sistema</option>
                  {empresas.map((empresa) => (
                    <option value={empresa.id} key={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Modulo">
                <select
                  value={filtros.modulo}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      modulo: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todos</option>
                  {modulos.map((modulo) => (
                    <option value={modulo} key={modulo}>
                      {etiqueta(modulo)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Usuario / nombre">
                <select
                  value={filtros.usuarioId}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      usuarioId: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todos</option>
                  {usuarios.map(([id, nombre]) => (
                    <option value={id} key={id}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Accion">
                <select
                  value={filtros.accion}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      accion: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todas</option>
                  {acciones.map((accion) => (
                    <option value={accion} key={accion}>
                      {etiqueta(accion)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Entidad tipo">
                <select
                  value={filtros.entidadTipo}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      entidadTipo: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todas</option>
                  {entidades.map((entidad) => (
                    <option value={entidad} key={entidad}>
                      {etiqueta(entidad)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Sensible">
                <select
                  value={filtros.sensible}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      sensible: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todos</option>
                  <option value="true">Sensibles</option>
                  <option value="false">No sensibles</option>
                </select>
              </Campo>

              <Campo label="Visible calendario">
                <select
                  value={filtros.visibleCalendario}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      visibleCalendario: event.target.value,
                    }))
                  }
                  className="campo-historial"
                >
                  <option value="">Todos</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </Campo>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="submit"
                disabled={cargandoHistorial}
                className="bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limpiarFiltros}
                disabled={cargandoHistorial}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-gray-200 disabled:opacity-50"
              >
                Limpiar filtros
              </button>
              <span className="text-xs text-gray-500 self-center">
                Maximo {LIMITE_EVENTOS} eventos por consulta
              </span>
            </div>
          </form>

          {avisoCarga && (
            <div className="border border-amber-400/30 bg-amber-400/10 text-amber-200 rounded-2xl px-5 py-4 mb-5">
              {avisoCarga}
            </div>
          )}

          {errorCarga && (
            <div className="border border-red-400/30 bg-red-400/10 text-red-200 rounded-2xl px-5 py-4 mb-5">
              {errorCarga}
            </div>
          )}

          <section className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            {cargandoHistorial ? (
              <div className="flex items-center justify-center gap-3 py-20 text-gray-300">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
                Cargando historial...
              </div>
            ) : eventos.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                No se encontraron eventos de auditoria para los filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="text-left px-5 py-4">Fecha / hora</th>
                      <th className="text-left px-5 py-4">Modulo / accion</th>
                      <th className="text-left px-5 py-4">Empresa</th>
                      <th className="text-left px-5 py-4">Usuario</th>
                      <th className="text-left px-5 py-4">Entidad</th>
                      <th className="text-left px-5 py-4">Estado</th>
                      <th className="text-left px-5 py-4">Descripcion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {eventos.map((evento) => (
                      <tr key={evento.id} className="align-top hover:bg-white/[0.03]">
                        <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-cyan-400" />
                            {fechaHora(evento.creado_at)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-cyan-300 capitalize">
                            {etiqueta(evento.modulo)}
                          </div>
                          <div className="text-gray-300 capitalize">
                            {etiqueta(evento.accion)}
                          </div>
                          {evento.sensible && (
                            <span className="inline-block mt-2 text-[11px] rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 px-2 py-0.5">
                              Sensible
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-gray-400" />
                            {evento.empresa_id === null
                              ? "General"
                              : empresasPorId.get(Number(evento.empresa_id)) ||
                                "Empresa no disponible"}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          <div className="flex items-center gap-2">
                            <UserIcon size={14} className="text-gray-400" />
                            {evento.usuario_nombre_snapshot || "Usuario"}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          <div className="capitalize">{etiqueta(evento.entidad_tipo)}</div>
                          {evento.entidad_id !== null && (
                            <div className="text-xs text-gray-500 mt-1">
                              #{String(evento.entidad_id)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          {evento.estado_anterior || evento.estado_nuevo ? (
                            <span>
                              {evento.estado_anterior || "-"} {" -> "}
                              {evento.estado_nuevo || "-"}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-5 py-4 min-w-64">
                          <p className="text-gray-200">
                            {evento.descripcion || etiqueta(evento.accion)}
                          </p>
                          {evento.motivo && (
                            <p className="text-xs text-gray-400 mt-1">
                              Motivo: {evento.motivo}
                            </p>
                          )}
                          {evento.metadatos !== null && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-cyan-300 text-xs">
                                Ver detalles
                              </summary>
                              <pre className="text-xs text-gray-300 bg-black/20 border border-white/10 rounded-xl p-3 mt-2 max-w-sm overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(evento.metadatos, null, 2)}
                              </pre>
                            </details>
                          )}
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
        .campo-historial {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.65rem 0.75rem;
          color: white;
          outline: none;
        }
        .campo-historial:focus {
          border-color: rgba(6, 182, 212, 0.6);
        }
        .campo-historial option {
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
