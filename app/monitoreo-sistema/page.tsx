"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarUsuarioActivo } from "../../lib/validarUsuarioActivo";
import {
  registrarAuditoriaEvento,
  type ValorJsonAuditoria,
} from "../../lib/auditoria";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  Lock,
  RefreshCcw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
  XCircle,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

interface Perfil {
  id: string;
  nombre: string;
  correo?: string | null;
  rol: string;
  activo?: boolean | null;
}

interface ModuloSistema {
  id: number;
  clave: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

interface UsuarioModulo {
  id: number;
  usuario_id: string;
  modulo_clave: string;
  activo?: boolean | null;
}

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
  metadatos: ValorJsonAuditoria | null;
  sensible: boolean;
  origen: string | null;
}

interface TrabajoActivo {
  id: string | number;
  usuario_id: string;
  empresa_id: number | null;
  modulo: string;
  ruta: string | null;
  titulo: string | null;
  actualizado_at: string | null;
  perfiles?: { nombre?: string | null; rol?: string | null } | null;
}

type LogSistema = Record<string, unknown>;

const ROLES_MONITOREO = ["admin"];
const LIMITE_EVENTOS = 120;
const COLUMNAS_AUDITORIA =
  "id,creado_at,usuario_id,usuario_nombre_snapshot,empresa_id,modulo,accion,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,descripcion,metadatos,sensible,origen";

const CATEGORIAS_FUNCION = [
  {
    clave: "auditores",
    titulo: "Auditores",
    roles: ["auditor", "auditoria"],
  },
  {
    clave: "contadores",
    titulo: "Contadores",
    roles: ["contador"],
  },
  {
    clave: "auxiliares",
    titulo: "Auxiliares",
    roles: ["auxiliar", "empleado", "iniciador", "iniciador_gestion"],
  },
  {
    clave: "firmantes",
    titulo: "Firmantes",
    roles: ["firmante", "firmante_oc"],
  },
  {
    clave: "autorizadores",
    titulo: "Autorizadores",
    roles: ["jefe", "supervisor", "tesorero"],
  },
  {
    clave: "administradores",
    titulo: "Administradores",
    roles: ["admin"],
  },
  {
    clave: "solo_lectura",
    titulo: "Solo lectura",
    roles: ["solo_lectura", "lectura", "readonly"],
  },
];

const PATRONES_ERROR = [
  "error",
  "fallo",
  "falla",
  "fallido",
  "denegado",
  "denegada",
  "vencida",
  "inactividad",
  "parcial",
  "incompleto",
  "incompleta",
  "supabase",
  "api",
  "auditoria",
  "documento",
  "documentos",
  "importacion",
  "importaciones",
  "cheque",
  "pago",
];

const PATRONES_SEGURIDAD = [
  "seguridad",
  "sospech",
  "denegado",
  "denegada",
  "intento",
  "fallido",
  "bloqueado",
  "inactivo",
  "sin_sesion",
  "sesion",
  "auth",
];

const PATRONES_PARCIAL = [
  "parcial",
  "incompleto",
  "incompleta",
  "borrador",
  "pendiente",
  "fallo_guardado",
  "guardado",
  "importacion",
  "documento",
  "cheque",
  "pago",
];

function normalizar(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

function textoEvento(evento: AuditoriaEvento) {
  return [
    evento.modulo,
    evento.accion,
    evento.entidad_tipo,
    evento.estado_anterior,
    evento.estado_nuevo,
    evento.motivo,
    evento.descripcion,
    evento.origen,
    JSON.stringify(evento.metadatos || {}),
  ]
    .join(" ")
    .toLowerCase();
}

function coincide(evento: AuditoriaEvento, patrones: string[]) {
  const texto = textoEvento(evento);
  return patrones.some((patron) => texto.includes(patron));
}

function fechaHora(valor?: string | null) {
  if (!valor) return "Sin fecha";

  return new Date(valor).toLocaleString("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function etiqueta(valor?: string | null) {
  return valor ? valor.replaceAll("_", " ") : "Sin dato";
}

function obtenerCampoLog(log: LogSistema, campos: string[]) {
  for (const campo of campos) {
    const valor = log[campo];
    if (valor !== null && valor !== undefined && String(valor).trim()) {
      return String(valor);
    }
  }

  return null;
}

export default function MonitoreoSistemaPage() {
  const router = useRouter();
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [usuarioModulos, setUsuarioModulos] = useState<UsuarioModulo[]>([]);
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [trabajosActivos, setTrabajosActivos] = useState<TrabajoActivo[]>([]);
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [avisoLogs, setAvisoLogs] = useState<string | null>(null);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesandoModulo, setProcesandoModulo] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const validacion = await validarUsuarioActivo();
        if (!activo) return;

        if (!validacion.ok) {
          router.replace("/login");
          return;
        }

        const rol = normalizar(validacion.perfil?.rol);
        if (!ROLES_MONITOREO.includes(rol)) {
          router.replace("/dashboard");
          return;
        }

        setPerfilActual({ ...(validacion.perfil as Perfil), rol });
        setAutorizado(true);
        setValidandoAcceso(false);
        await cargarDatos();
      } catch (error) {
        console.error("Error validando acceso a monitoreo:", error);
        router.replace("/dashboard");
      } finally {
        if (activo) setValidandoAcceso(false);
      }
    }

    void iniciar();

    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarDatos() {
    setCargando(true);
    setAvisoLogs(null);

    try {
      const [
        resUsuarios,
        resModulos,
        resUsuarioModulos,
        resEventos,
        resTrabajos,
        resLogs,
      ] = await Promise.all([
        supabase
          .from("perfiles")
          .select("id,nombre,correo,rol,activo")
          .order("nombre", { ascending: true }),
        supabase
          .from("modulos_sistema")
          .select("id,clave,nombre,activo,orden")
          .order("orden", { ascending: true }),
        supabase
          .from("usuario_modulos")
          .select("id,usuario_id,modulo_clave,activo"),
        supabase
          .from("auditoria_eventos")
          .select(COLUMNAS_AUDITORIA)
          .order("creado_at", { ascending: false })
          .limit(LIMITE_EVENTOS),
        supabase
          .from("borradores_trabajo")
          .select(
            "id,usuario_id,empresa_id,modulo,ruta,titulo,actualizado_at,perfiles:usuario_id(nombre,rol)"
          )
          .eq("estado", "activo")
          .order("actualizado_at", { ascending: false })
          .limit(50),
        supabase
          .from("logs")
          .select("*")
          .order("creado_at", { ascending: false })
          .limit(50),
      ]);

      if (resUsuarios.error) {
        console.error("Error cargando perfiles en Monitoreo del Sistema:", resUsuarios.error);
        throw resUsuarios.error;
      }

      if (resModulos.error) {
        console.error("Error cargando modulos_sistema en Monitoreo del Sistema:", resModulos.error);
        throw resModulos.error;
      }

      if (resEventos.error) {
        console.error("Error cargando auditoria_eventos en Monitoreo del Sistema:", resEventos.error);
        throw resEventos.error;
      }

      setUsuarios((resUsuarios.data || []) as Perfil[]);
      setModulos((resModulos.data || []) as ModuloSistema[]);
      setEventos((resEventos.data || []) as AuditoriaEvento[]);

      if (resUsuarioModulos.error) {
        console.warn(
          "No se pudieron cargar usuario_modulos en Monitoreo del Sistema:",
          resUsuarioModulos.error
        );
        setUsuarioModulos([]);
      } else {
        setUsuarioModulos((resUsuarioModulos.data || []) as UsuarioModulo[]);
      }

      if (resTrabajos.error) {
        console.warn("No se pudieron cargar operaciones activas:", resTrabajos.error);
        setTrabajosActivos([]);
      } else {
        setTrabajosActivos((resTrabajos.data || []) as TrabajoActivo[]);
      }

      if (resLogs.error) {
        console.warn("Fuente logs no disponible para monitoreo:", resLogs.error);
        setLogs([]);
        setAvisoLogs(
          "La tabla logs no esta disponible o RLS no permite leerla; se muestra monitoreo con auditoria_eventos y datos operativos existentes."
        );
      } else {
        setLogs((resLogs.data || []) as LogSistema[]);
      }
    } catch (error) {
      console.error("Error cargando Monitoreo del Sistema:", error);
      toast.error("No se pudo cargar el monitoreo del sistema.");
    } finally {
      setCargando(false);
    }
  }

  async function cambiarEstadoModuloGlobal(modulo: ModuloSistema) {
    const nuevoEstado = !modulo.activo;
    const confirmacion = window.confirm(
      `Confirmar ${nuevoEstado ? "activacion" : "desactivacion"} global del modulo ${modulo.nombre}.`
    );

    if (!confirmacion) return;

    setProcesandoModulo(modulo.clave);
    const toastId = toast.loading("Actualizando modulo global...");

    try {
      const { error } = await supabase
        .from("modulos_sistema")
        .update({ activo: nuevoEstado })
        .eq("clave", modulo.clave);

      if (error) throw error;

      await registrarAuditoriaEvento({
        modulo: "monitoreo-sistema",
        accion: nuevoEstado
          ? "activar_modulo_global"
          : "desactivar_modulo_global",
        entidad_tipo: "modulos_sistema",
        entidad_id: modulo.clave,
        estado_anterior: modulo.activo ? "activo" : "inactivo",
        estado_nuevo: nuevoEstado ? "activo" : "inactivo",
        descripcion: "Cambio global de modulo desde Monitoreo del Sistema",
        sensible: true,
        metadatos: {
          modulo_id: modulo.id,
          nombre: modulo.nombre,
          operador: perfilActual?.id || null,
        },
        origen: "monitoreo_sistema",
      });

      await cargarDatos();
      toast.success("Modulo global actualizado y auditado.", { id: toastId });
    } catch (error) {
      console.error("Error actualizando modulo global:", error);
      toast.error("No se pudo actualizar o auditar el modulo global.", {
        id: toastId,
      });
    } finally {
      setProcesandoModulo(null);
    }
  }

  const usuariosActivos = useMemo(
    () => usuarios.filter((usuario) => usuario.activo !== false),
    [usuarios]
  );

  const usuariosInactivos = useMemo(
    () => usuarios.filter((usuario) => usuario.activo === false),
    [usuarios]
  );

  const eventosError = useMemo(
    () => eventos.filter((evento) => coincide(evento, PATRONES_ERROR)),
    [eventos]
  );

  const alertasSeguridad = useMemo(
    () => eventos.filter((evento) => evento.sensible || coincide(evento, PATRONES_SEGURIDAD)),
    [eventos]
  );

  const operacionesParciales = useMemo(
    () => eventos.filter((evento) => coincide(evento, PATRONES_PARCIAL)),
    [eventos]
  );

  const fallasPorModulo = useMemo(() => {
    const conteo = new Map<string, number>();
    eventosError.forEach((evento) => {
      conteo.set(evento.modulo, (conteo.get(evento.modulo) || 0) + 1);
    });

    return Array.from(conteo.entries())
      .map(([modulo, total]) => ({ modulo, total }))
      .sort((a, b) => b.total - a.total);
  }, [eventosError]);

  const usuariosPorFuncion = useMemo(() => {
    const agrupados = CATEGORIAS_FUNCION.map((categoria) => ({
      ...categoria,
      usuarios: usuarios.filter((usuario) =>
        categoria.roles.includes(normalizar(usuario.rol))
      ),
    }));

    return agrupados;
  }, [usuarios]);

  const salud = useMemo(() => {
    const modulosInactivos = modulos.filter((modulo) => !modulo.activo).length;
    const erroresRecientes = eventosError.length + logs.length;
    const operacionesPendientes = operacionesParciales.length + trabajosActivos.length;

    if (erroresRecientes > 0 || alertasSeguridad.length > 0) {
      return {
        estado: "Atencion requerida",
        detalle: "Hay errores, alertas sensibles o logs recientes por revisar.",
        clase: "text-amber-300",
        icono: <AlertTriangle size={24} />,
      };
    }

    if (modulosInactivos > 0 || operacionesPendientes > 0) {
      return {
        estado: "Operativo con observaciones",
        detalle: "No hay errores detectados, pero existen modulos inactivos u operaciones abiertas.",
        clase: "text-cyan-300",
        icono: <Activity size={24} />,
      };
    }

    return {
      estado: "Operativo",
      detalle: "No se detectaron fallas en las fuentes disponibles.",
      clase: "text-green-300",
      icono: <CheckCircle2 size={24} />,
    };
  }, [alertasSeguridad.length, eventosError.length, logs.length, modulos, operacionesParciales.length, trabajosActivos.length]);

  const resumen = {
    modulosActivos: modulos.filter((modulo) => modulo.activo).length,
    modulosInactivos: modulos.filter((modulo) => !modulo.activo).length,
    usuariosActivos: usuariosActivos.length,
    usuariosInactivos: usuariosInactivos.length,
    errores: eventosError.length + logs.length,
    sensibles: alertasSeguridad.length,
  };

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex bg-[#020617] min-h-screen items-center justify-center text-white">
        Validando acceso a Monitoreo del Sistema...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#fff",
            border: "1px solid #1e293b",
          },
        }}
      />
      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center">
                  <ServerCog size={28} />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                    Monitoreo del Sistema
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">
                    Centro general para salud, fallas, seguridad, modulos y eventos sensibles.
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Operador tecnico: {perfilActual?.nombre} | Rol: {perfilActual?.rol?.toUpperCase()}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/admin"
                className="h-12 px-5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-400/50 text-sm font-bold text-cyan-200 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={16} />
                Editar usuarios en Admin
              </a>
              <button
                type="button"
                onClick={() => cargarDatos()}
                disabled={cargando}
                className="h-12 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/50 text-sm font-bold text-gray-300 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCcw size={16} className={cargando ? "animate-spin" : ""} />
                Actualizar monitoreo
              </button>
            </div>
          </header>

          {cargando ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 flex items-center justify-center text-amber-300">
              <Loader2 className="animate-spin mr-2" />
              Cargando monitoreo...
            </section>
          ) : (
            <>
              {avisoLogs && (
                <div className="border border-amber-400/30 bg-amber-400/10 text-amber-100 rounded-2xl px-5 py-4 mb-6 text-sm">
                  {avisoLogs}
                </div>
              )}

              <section className="grid md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                <TarjetaResumen titulo="Modulos activos" valor={resumen.modulosActivos} icono={<ToggleRight size={22} />} />
                <TarjetaResumen titulo="Modulos inactivos" valor={resumen.modulosInactivos} icono={<ToggleLeft size={22} />} />
                <TarjetaResumen titulo="Usuarios activos" valor={resumen.usuariosActivos} icono={<Users size={22} />} />
                <TarjetaResumen titulo="Bloqueados/inactivos" valor={resumen.usuariosInactivos} icono={<Lock size={22} />} />
                <TarjetaResumen titulo="Errores/logs" valor={resumen.errores} icono={<XCircle size={22} />} />
                <TarjetaResumen titulo="Alertas sensibles" valor={resumen.sensibles} icono={<ShieldAlert size={22} />} />
              </section>

              <section className="grid xl:grid-cols-[1.1fr_1.9fr] gap-6 mb-8">
                <div className="panel">
                  <div className={`flex items-center gap-3 ${salud.clase}`}>
                    {salud.icono}
                    <h2 className="text-xl font-black">{salud.estado}</h2>
                  </div>
                  <p className="text-gray-400 text-sm mt-3">{salud.detalle}</p>
                  <div className="grid grid-cols-2 gap-3 mt-6 text-sm">
                    <Dato label="Eventos auditados" valor={eventos.length} />
                    <Dato label="Logs conectados" valor={logs.length} />
                    <Dato label="Operaciones abiertas" valor={trabajosActivos.length} />
                    <Dato label="Fallas por modulo" valor={fallasPorModulo.length} />
                  </div>
                </div>

                <div className="panel">
                  <h2 className="panel-title">
                    <Layers size={16} className="text-amber-300" />
                    Activacion global de modulos
                  </h2>
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-1">
                    {modulos.map((modulo) => (
                      <button
                        key={modulo.clave}
                        type="button"
                        onClick={() => cambiarEstadoModuloGlobal(modulo)}
                        disabled={procesandoModulo === modulo.clave}
                        className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-50 ${
                          modulo.activo
                            ? "border-green-400/30 bg-green-400/10"
                            : "border-red-400/30 bg-red-400/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{modulo.nombre}</p>
                            <p className="text-[11px] text-gray-400 mt-1">{modulo.clave}</p>
                          </div>
                          {procesandoModulo === modulo.clave ? (
                            <Loader2 size={18} className="animate-spin text-amber-300" />
                          ) : modulo.activo ? (
                            <ToggleRight size={22} className="text-green-300" />
                          ) : (
                            <ToggleLeft size={22} className="text-red-300" />
                          )}
                        </div>
                        <p className="text-xs mt-3 text-gray-300">
                          Estado global: {modulo.activo ? "Activo" : "Inactivo"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid xl:grid-cols-3 gap-6 mb-8">
                <PanelEventos titulo="Errores recientes" eventos={eventosError.slice(0, 12)} />
                <PanelEventos titulo="Operaciones parciales" eventos={operacionesParciales.slice(0, 12)} />
                <PanelEventos titulo="Alertas de seguridad" eventos={alertasSeguridad.slice(0, 12)} />
              </section>

              <section className="grid xl:grid-cols-3 gap-6 mb-8">
                <PanelUsuarios titulo="Usuarios activos" usuarios={usuariosActivos} />
                <PanelUsuarios titulo="Usuarios bloqueados/inactivos" usuarios={usuariosInactivos} />
                <PanelTrabajos trabajos={trabajosActivos} />
              </section>

              <section className="grid xl:grid-cols-[1fr_1fr] gap-6 mb-8">
                <div className="panel">
                  <h2 className="panel-title">
                    <Users size={16} className="text-cyan-300" />
                    Usuarios por funcion
                  </h2>
                  <div className="grid md:grid-cols-2 gap-3">
                    {usuariosPorFuncion.map((grupo) => (
                      <div key={grupo.clave} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
                        <p className="text-xs uppercase font-black text-gray-400">{grupo.titulo}</p>
                        <p className="text-3xl font-black mt-2">{grupo.usuarios.length}</p>
                        <p className="text-[11px] text-gray-500 mt-2">
                          Roles: {grupo.roles.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h2 className="panel-title">
                    <ShieldCheck size={16} className="text-purple-300" />
                    Asignaciones de modulos por usuario
                  </h2>
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {usuarioModulos.filter((item) => item.activo !== false).map((item) => {
                      const usuario = usuarios.find((perfil) => perfil.id === item.usuario_id);
                      const modulo = modulos.find((catalogo) => catalogo.clave === item.modulo_clave);
                      return (
                        <div key={item.id} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
                          <p className="font-black">{usuario?.nombre || item.usuario_id}</p>
                          <p className="text-xs text-purple-200 mt-1">
                            {modulo?.nombre || item.modulo_clave}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Modulo global: {modulo?.activo === false ? "inactivo" : "activo"}
                          </p>
                        </div>
                      );
                    })}
                    {usuarioModulos.filter((item) => item.activo !== false).length === 0 && (
                      <p className="text-gray-500 text-sm">No hay asignaciones activas visibles.</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="grid xl:grid-cols-2 gap-6">
                <div className="panel">
                  <h2 className="panel-title">
                    <Activity size={16} className="text-red-300" />
                    Fallas por modulo
                  </h2>
                  <div className="space-y-3">
                    {fallasPorModulo.map((item) => (
                      <div key={item.modulo} className="flex items-center justify-between bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
                        <span className="font-black capitalize">{etiqueta(item.modulo)}</span>
                        <span className="text-red-200 font-black">{item.total}</span>
                      </div>
                    ))}
                    {fallasPorModulo.length === 0 && (
                      <p className="text-gray-500 text-sm">No se detectaron fallas por modulo en auditoria reciente.</p>
                    )}
                  </div>
                </div>

                <PanelLogs logs={logs} />
              </section>
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        .panel {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          padding: 1.25rem;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: rgb(156, 163, 175);
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 1rem;
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
  icono: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.035] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between text-amber-300 mb-3">
        <span className="text-xs font-black uppercase tracking-wide text-gray-400">
          {titulo}
        </span>
        {icono}
      </div>
      <div className="text-3xl font-black">{valor}</div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
      <p className="text-[11px] uppercase font-black text-gray-500">{label}</p>
      <p className="text-2xl font-black mt-2">{valor}</p>
    </div>
  );
}

function PanelEventos({
  titulo,
  eventos,
}: {
  titulo: string;
  eventos: AuditoriaEvento[];
}) {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <AlertTriangle size={16} className="text-amber-300" />
        {titulo}
      </h2>
      <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
        {eventos.map((evento) => (
          <div key={evento.id} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={13} />
              {fechaHora(evento.creado_at)}
            </div>
            <p className="font-black text-white mt-2 capitalize">
              {etiqueta(evento.modulo)} / {etiqueta(evento.accion)}
            </p>
            <p className="text-sm text-gray-300 mt-1">
              {evento.descripcion || evento.motivo || etiqueta(evento.entidad_tipo)}
            </p>
            {evento.sensible && (
              <span className="inline-block mt-3 text-[11px] rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 px-2 py-0.5">
                Sensible
              </span>
            )}
          </div>
        ))}
        {eventos.length === 0 && (
          <p className="text-gray-500 text-sm">Sin eventos detectados en esta categoria.</p>
        )}
      </div>
    </div>
  );
}

function PanelUsuarios({ titulo, usuarios }: { titulo: string; usuarios: Perfil[] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <Users size={16} className="text-cyan-300" />
        {titulo}
      </h2>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {usuarios.map((usuario) => (
          <div key={usuario.id} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
            <p className="font-black">{usuario.nombre}</p>
            <p className="text-xs text-cyan-200 mt-1">{usuario.rol}</p>
            <p className="text-[11px] text-gray-500 mt-1 break-all">
              {usuario.correo || usuario.id}
            </p>
          </div>
        ))}
        {usuarios.length === 0 && (
          <p className="text-gray-500 text-sm">No hay usuarios en esta categoria.</p>
        )}
      </div>
    </div>
  );
}

function PanelTrabajos({ trabajos }: { trabajos: TrabajoActivo[] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <Activity size={16} className="text-green-300" />
        Usuarios trabajando
      </h2>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {trabajos.map((trabajo) => (
          <div key={trabajo.id} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
            <p className="font-black">{trabajo.perfiles?.nombre || trabajo.usuario_id}</p>
            <p className="text-xs text-green-200 mt-1">
              {trabajo.modulo} | {trabajo.titulo || trabajo.ruta || "Operacion activa"}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Actualizado: {fechaHora(trabajo.actualizado_at)}
            </p>
          </div>
        ))}
        {trabajos.length === 0 && (
          <p className="text-gray-500 text-sm">No hay trabajos activos visibles.</p>
        )}
      </div>
    </div>
  );
}

function PanelLogs({ logs }: { logs: LogSistema[] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <ServerCog size={16} className="text-amber-300" />
        Logs tecnicos disponibles
      </h2>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {logs.map((log, index) => {
          const titulo =
            obtenerCampoLog(log, ["mensaje", "message", "descripcion", "error"]) ||
            "Log del sistema";
          const modulo = obtenerCampoLog(log, ["modulo", "module", "origen"]) || "sistema";
          const fecha = obtenerCampoLog(log, ["creado_at", "created_at", "fecha"]);

          return (
            <div key={String(log.id || index)} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
              <p className="font-black">{titulo}</p>
              <p className="text-xs text-amber-200 mt-1">{modulo}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {fecha ? fechaHora(fecha) : "Sin fecha"}
              </p>
            </div>
          );
        })}
        {logs.length === 0 && (
          <p className="text-gray-500 text-sm">
            No hay tabla logs disponible o no existen registros visibles.
          </p>
        )}
      </div>
    </div>
  );
}
