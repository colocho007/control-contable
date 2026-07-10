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
  Eye,
  Layers,
  Loader2,
  Lock,
  Search,
  RefreshCcw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
  XCircle,
  ChevronDown,
  ChevronUp,
  Terminal
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

interface ResumenOperativoReal {
  empresasAsignadas: number | null;
  empresasActivas: number | null;
  funcionesActivas: number | null;
  asientosRegistrados: number | null;
  asientosBorrador: number | null;
  periodosAbiertos: number | null;
  periodosCerrados: number | null;
  documentosPendientes: number | null;
  movimientosActivos: number | null;
  movimientosAnulados: number | null;
  errores: string[];
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
type EstadoAlerta = "Pendiente" | "En revisión" | "Resuelta" | "Archivada";
type SeveridadAlerta = "Critica" | "Alta" | "Media" | "Baja" | "Informativa";
type CategoriaDiagnostico =
  | "errores"
  | "sensibles"
  | "parciales"
  | "fallas"
  | "usuarios_inactivos"
  | "usuarios_trabajando"
  | "asignaciones"
  | "modulos_activos"
  | "modulos_inactivos";

interface AlertaDiagnostico {
  id: string;
  alertaClave: string;
  categoria: CategoriaDiagnostico;
  fecha: string | null;
  modulo: string;
  accion: string;
  severidad: SeveridadAlerta;
  usuarioId?: string | null;
  usuario: string | null;
  empresaId?: number | null;
  empresa: string | null;
  mensaje: string;
  metadatos: Record<string, string>;
  posibleCausa: string;
  accionRecomendada: string;
  ruta: string;
  fuente: string;
  entidadTipo: string | null;
  entidadId: string | number | null;
  eventoOriginal?: AuditoriaEvento;
  logOriginal?: LogSistema;
}

interface MonitoreoAlertaPersistida {
  id: string;
  alerta_clave: string;
  estado: EstadoAlerta;
  modulo: string;
  accion: string | null;
  severidad: "info" | "baja" | "media" | "alta" | "critica";
  fuente: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  resuelto_por: string | null;
  resuelto_at: string | null;
  archivado_por: string | null;
  archivado_at: string | null;
}

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

const ESTADOS_ALERTA: EstadoAlerta[] = [
  "Pendiente",
  "En revisión",
  "Resuelta",
  "Archivada",
];

const NOMBRES_CATEGORIA: Record<CategoriaDiagnostico, string> = {
  errores: "Errores/logs",
  sensibles: "Alertas sensibles",
  parciales: "Operaciones parciales",
  fallas: "Fallas por módulo",
  usuarios_inactivos: "Usuarios bloqueados/inactivos",
  usuarios_trabajando: "Usuarios trabajando",
  asignaciones: "Asignaciones por usuario",
  modulos_activos: "Módulos activos",
  modulos_inactivos: "Módulos inactivos",
};

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

const ACCIONES_INFORMATIVAS_AUTORRESUELTAS = new Set([
  "abrir_detalle_alerta",
  "actualizar_alerta",
  "archivar_alerta",
  "cambiar_estado_alerta",
  "cierre_sesion_inactividad",
  "consultar_historial",
  "consultar_reporte",
  "marcar_alerta_archivada",
  "marcar_alerta_en_revisión",
  "marcar_alerta_resuelta",
  "marcar_alerta_revisada",
  "modulo_activo",
]);

const ACCIONES_SENSIBLES_PENDIENTES = [
  "cambiar_rol",
  "crear_perfil",
  "crear_usuario",
  "activar_usuario",
  "desactivar_usuario",
  "sincronizar_empresas_usuario",
  "sincronizar_modulos_usuario",
  "sincronizar_funciones_operativas_usuario",
  "ejecutar_reinicio_controlado",
  "rate_limit_excedido",
  "intento_bloqueado",
  "importacion_fallida",
  "importacion_parcial",
];

function accionNormalizada(valor?: string | null) {
  return normalizar(valor).replace(/\s+/g, "_");
}

function esAccionInformativaNormal(modulo?: string | null, accion?: string | null) {
  const moduloNormalizado = accionNormalizada(modulo);
  const accionNormalizadaValor = accionNormalizada(accion);

  if (ACCIONES_INFORMATIVAS_AUTORRESUELTAS.has(accionNormalizadaValor)) return true;
  if (
    moduloNormalizado === "monitoreo-sistema" &&
    (accionNormalizadaValor.startsWith("marcar_alerta_") ||
      accionNormalizadaValor.includes("alerta_resuelta") ||
      accionNormalizadaValor.includes("alerta_revisada") ||
      accionNormalizadaValor.includes("archivar_alerta") ||
      accionNormalizadaValor.includes("actualizar_alerta") ||
      accionNormalizadaValor.includes("cambiar_estado_alerta"))
  ) {
    return true;
  }
  if (moduloNormalizado === "historial" && accionNormalizadaValor.startsWith("consultar")) return true;
  if (moduloNormalizado === "reportes" && accionNormalizadaValor.startsWith("consultar")) return true;

  return false;
}

function esAccionPendienteReal(modulo?: string | null, accion?: string | null, texto = "") {
  const moduloNormalizado = accionNormalizada(modulo);
  const accionNormalizadaValor = accionNormalizada(accion);
  const textoNormalizado = texto.toLowerCase();

  return (
    ACCIONES_SENSIBLES_PENDIENTES.some((patron) =>
      accionNormalizadaValor.includes(patron)
    ) ||
    textoNormalizado.includes("fallida") ||
    textoNormalizado.includes("fallido") ||
    textoNormalizado.includes("bloqueado") ||
    textoNormalizado.includes("denegado") ||
    textoNormalizado.includes("rate_limit") ||
    textoNormalizado.includes("intentos_bloqueados") ||
    moduloNormalizado === "reinicio-controlado"
  );
}

function esEventoInformativoNormal(evento: AuditoriaEvento) {
  return esAccionInformativaNormal(evento.modulo, evento.accion);
}

function categoriaEventoAuditoria(evento: AuditoriaEvento): CategoriaDiagnostico | null {
  const texto = textoEvento(evento);

  if (esEventoInformativoNormal(evento)) {
    return accionNormalizada(evento.modulo) === "monitoreo-sistema" ||
      evento.sensible ||
      coincide(evento, PATRONES_SEGURIDAD)
      ? "sensibles"
      : null;
  }

  if (
    esAccionPendienteReal(evento.modulo, evento.accion, texto) ||
    coincide(evento, PATRONES_ERROR)
  ) {
    return "errores";
  }

  if (evento.sensible || coincide(evento, PATRONES_SEGURIDAD)) {
    return "sensibles";
  }

  if (coincide(evento, PATRONES_PARCIAL)) {
    return "parciales";
  }

  return null;
}

function fechaHora(valor?: string | null) {
  if (!valor) return "Sin fecha";

  return new Date(valor).toLocaleString("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function etiqueta(valor?: string | null) {
  return valor ? valor.replaceAll("_", " ").replaceAll("-", " ") : "Sin dato";
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

function rutaModulo(modulo?: string | null, accion?: string | null) {
  const texto = `${modulo || ""} ${accion || ""}`.toLowerCase();

  if (texto.includes("cheque") || texto.includes("pago")) return "/cheques";
  if (texto.includes("contab") || texto.includes("asiento")) return "/contabilidad";
  if (texto.includes("reinicio")) return "/reinicio-controlado";
  if (
    texto.includes("permiso") ||
    texto.includes("usuario") ||
    texto.includes("perfil") ||
    texto.includes("modulo")
  ) {
    return "/admin";
  }
  if (texto.includes("document")) return "/documentos";
  if (texto.includes("reporte")) return "/reportes";
  if (texto.includes("orden")) return "/ordenes-compra";
  if (texto.includes("cuenta") || texto.includes("cxc") || texto.includes("cxp")) {
    return texto.includes("cobrar") || texto.includes("cxc")
      ? "/cuentas-cobrar"
      : "/cuentas-pagar";
  }
  if (texto.includes("import")) return "/importaciones";

  return "/dashboard";
}

function severidadEvento(evento: AuditoriaEvento): SeveridadAlerta {
  const texto = textoEvento(evento);

  if (esEventoInformativoNormal(evento)) return "Informativa";
  if (esAccionPendienteReal(evento.modulo, evento.accion, texto)) return "Alta";
  if (evento.sensible || texto.includes("denegado") || texto.includes("bloqueado")) {
    return "Alta";
  }
  if (texto.includes("error") || texto.includes("fallo") || texto.includes("falla")) {
    return "Alta";
  }
  if (texto.includes("parcial") || texto.includes("incompleto")) return "Media";
  if (texto.includes("borrador") || texto.includes("pendiente")) return "Baja";

  return "Informativa";
}

function causaEvento(evento: AuditoriaEvento) {
  const texto = textoEvento(evento);

  if (evento.sensible || texto.includes("denegado")) {
    return "Acceso, permiso o cambio sensible que requiere validacion administrativa.";
  }
  if (texto.includes("parcial") || texto.includes("incompleto") || texto.includes("borrador")) {
    return "Operacion iniciada que pudo quedar sin confirmacion final o con datos pendientes.";
  }
  if (texto.includes("error") || texto.includes("fallo") || texto.includes("falla")) {
    return "Falla registrada por el modulo, integracion o validacion operativa.";
  }

  return "Evento auditado que coincide con patrones de monitoreo y necesita revision.";
}

function accionEvento(evento: AuditoriaEvento) {
  const ruta = rutaModulo(evento.modulo, evento.accion);

  if (evento.sensible) {
    return "Validar el usuario, empresa y permiso involucrado; confirmar que el cambio fue autorizado.";
  }
  if (ruta === "/cheques") return "Revisar el cheque o pago relacionado y completar o revertir el flujo operativo.";
  if (ruta === "/contabilidad") return "Revisar asiento, cierre o registro contable asociado antes de continuar.";
  if (ruta === "/reinicio-controlado") return "Revisar el reinicio controlado y sus dependencias operativas.";
  if (ruta === "/documentos") return "Verificar documento, adjunto o tramite relacionado.";

  return "Abrir el modulo relacionado, validar el registro y documentar la revision.";
}

function valorSeguro(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return "Sin dato";
  const texto =
    typeof valor === "string" ? valor : JSON.stringify(valor, null, 0);

  return texto.length > 180 ? `${texto.slice(0, 180)}...` : texto;
}

function metadatosResumidos(valor: ValorJsonAuditoria | LogSistema | null | undefined) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

  const clavesSensibles = ["password", "token", "secret", "clave", "jwt", "cookie"];
  return Object.entries(valor as Record<string, unknown>)
    .filter(([clave]) => !clavesSensibles.some((sensible) => clave.toLowerCase().includes(sensible)))
    .slice(0, 8)
    .reduce<Record<string, string>>((acc, [clave, dato]) => {
      acc[clave] = valorSeguro(dato);
      return acc;
    }, {});
}

function severidadSql(severidad: SeveridadAlerta) {
  const mapa: Record<SeveridadAlerta, MonitoreoAlertaPersistida["severidad"]> = {
    Critica: "critica",
    Alta: "alta",
    Media: "media",
    Baja: "baja",
    Informativa: "info",
  };

  return mapa[severidad];
}

function alertaClaveBase(partes: Array<string | number | null | undefined>) {
  return partes
    .map((parte) => String(parte ?? "sin-dato").trim().toLowerCase())
    .join("|")
    .replace(/\s+/g, "-")
    .slice(0, 500);
}

function uuidValido(valor?: string | null) {
  if (!valor) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
    ? valor
    : null;
}

function payloadMonitoreoAlerta(alerta: AlertaDiagnostico) {
  const usuarioId = alerta.eventoOriginal?.usuario_id ?? alerta.usuarioId ?? null;

  return {
    alerta_clave: alerta.alertaClave,
    empresa_id: alerta.eventoOriginal?.empresa_id ?? alerta.empresaId ?? null,
    usuario_id: uuidValido(usuarioId),
    modulo: alerta.modulo,
    accion: alerta.accion,
    severidad: severidadSql(alerta.severidad),
    estado: estadoInicialAlerta(alerta),
    titulo: `${etiqueta(alerta.modulo)} / ${etiqueta(alerta.accion)}`.slice(0, 220),
    mensaje: alerta.mensaje,
    fuente: alerta.fuente,
    entidad_tipo: alerta.entidadTipo,
    entidad_id: alerta.entidadId !== null && alerta.entidadId !== undefined
      ? String(alerta.entidadId)
      : null,
    ruta_destino: alerta.ruta,
    posible_causa: alerta.posibleCausa,
    accion_recomendada: alerta.accionRecomendada,
    metadatos: {
      categoria: alerta.categoria,
      fecha_origen: alerta.fecha,
      usuario_visible: alerta.usuario,
      empresa_visible: alerta.empresa,
      resumen: alerta.metadatos,
    },
  };
}

function alertaDesdeEvento(
  evento: AuditoriaEvento,
  categoria: CategoriaDiagnostico
): AlertaDiagnostico {
  return {
    id: `auditoria:${evento.id}`,
    alertaClave: alertaClaveBase([
      "auditoria_eventos",
      evento.id,
    ]),
    categoria,
    fecha: evento.creado_at,
    modulo: evento.modulo || "sistema",
    accion: evento.accion || "evento",
    severidad: severidadEvento(evento),
    usuarioId: evento.usuario_id || null,
    usuario: evento.usuario_nombre_snapshot || "Usuario no disponible",
    empresaId: evento.empresa_id,
    empresa: evento.empresa_id ? "Empresa no disponible" : null,
    mensaje:
      evento.descripcion ||
      evento.motivo ||
      `${etiqueta(evento.entidad_tipo)} ${evento.entidad_id || ""}`.trim() ||
      "Evento de auditoría sin descripción.",
    metadatos: {
      ...metadatosResumidos(evento.metadatos),
      entidad: valorSeguro(evento.entidad_tipo),
      entidad_id: valorSeguro(evento.entidad_id),
      origen: valorSeguro(evento.origen),
      categoria_clasificada: categoria,
    },
    posibleCausa: causaEvento(evento),
    accionRecomendada: accionEvento(evento),
    ruta: rutaModulo(evento.modulo, evento.accion),
    fuente: "auditoria_eventos",
    entidadTipo: evento.entidad_tipo,
    entidadId: evento.entidad_id,
    eventoOriginal: evento,
  };
}

function alertaDesdeLog(log: LogSistema, index: number): AlertaDiagnostico {
  const modulo = obtenerCampoLog(log, ["modulo", "module", "origen"]) || "sistema";
  const accion = obtenerCampoLog(log, ["accion", "action", "tipo", "level"]) || "log_tecnico";
  const fecha = obtenerCampoLog(log, ["creado_at", "created_at", "fecha"]);
  const mensaje =
    obtenerCampoLog(log, ["mensaje", "message", "descripcion", "error"]) ||
    "Log técnico disponible para revisión.";

  return {
    id: `log:${String(log.id || index)}`,
    alertaClave: alertaClaveBase([
      "logs",
      modulo,
      accion,
      String(log.id || fecha || index),
    ]),
    categoria: "errores",
    fecha,
    modulo,
    accion,
    severidad: mensaje.toLowerCase().includes("error") ? "Alta" : "Media",
    usuarioId: obtenerCampoLog(log, ["usuario_id", "user_id"]),
    usuario: obtenerCampoLog(log, ["usuario"]) || "Usuario no disponible",
    empresaId: null,
    empresa: obtenerCampoLog(log, ["empresa"]) || null,
    mensaje,
    metadatos: metadatosResumidos(log),
    posibleCausa: "Registro técnico emitido por la aplicación o integración.",
    accionRecomendada: "Revisar el módulo relacionado y contrastar con auditoría antes de cerrar la alerta.",
    ruta: rutaModulo(modulo, accion),
    fuente: "logs",
    entidadTipo: "logs",
    entidadId: String(log.id || index),
    logOriginal: log,
  };
}

function estadoInicialAlerta(alerta: AlertaDiagnostico) {
  const texto = [
    alerta.modulo,
    alerta.accion,
    alerta.mensaje,
    alerta.fuente,
    alerta.categoria,
  ].join(" ");

  if (alerta.categoria === "modulos_activos") return "Resuelta";
  if (esAccionInformativaNormal(alerta.modulo, alerta.accion)) return "Resuelta";
  if (alerta.severidad === "Informativa" && !esAccionPendienteReal(alerta.modulo, alerta.accion, texto)) {
    return "Resuelta";
  }
  return "Pendiente";
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
  const [avisoMonitoreoAlertas, setAvisoMonitoreoAlertas] = useState<string | null>(null);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesandoModulo, setProcesandoModulo] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaDiagnostico>("errores");
  const [alertaSeleccionadaId, setAlertaSeleccionadaId] = useState<string | null>(null);
  const [estadosAlertas, setEstadosAlertas] = useState<Record<string, EstadoAlerta>>({});
  const [alertasPersistidas, setAlertasPersistidas] = useState<Record<string, MonitoreoAlertaPersistida>>({});
  const [sincronizandoAlertas, setSincronizandoAlertas] = useState(false);
  const [persistenciaAlertasActiva, setPersistenciaAlertasActiva] = useState(false);
  const [filtroModulo, setFiltroModulo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<EstadoAlerta | "todos">("Pendiente");
  const [filtroSeveridad, setFiltroSeveridad] = useState<SeveridadAlerta | "todos">("todos");
  const [filtroFuente, setFiltroFuente] = useState("todos");
  const [resumenOperativoReal, setResumenOperativoReal] =
    useState<ResumenOperativoReal | null>(null);

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
        await cargarDatos(validacion.perfil?.id);
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

  useEffect(() => {
    const guardado = window.localStorage.getItem("controlplus_monitoreo_estados_alertas");
    if (!guardado) return;

    try {
      setEstadosAlertas(JSON.parse(guardado) as Record<string, EstadoAlerta>);
    } catch {
      setEstadosAlertas({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "controlplus_monitoreo_estados_alertas",
      JSON.stringify(estadosAlertas)
    );
  }, [estadosAlertas]);

  async function cargarDatos(usuarioId = perfilActual?.id) {
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

      await cargarResumenOperativoReal(usuarioId);
    } catch (error) {
      console.error("Error cargando Monitoreo del Sistema:", error);
      toast.error("No se pudo cargar el monitoreo del sistema.");
    } finally {
      setCargando(false);
    }
  }

  async function cargarResumenOperativoReal(usuarioId?: string | null) {
    const resultados = await Promise.all([
      usuarioId
        ? supabase
            .from("usuario_empresas")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", usuarioId)
            .eq("activo", true)
        : Promise.resolve({ count: null, error: null }),
      supabase.from("empresas").select("id", { count: "exact", head: true }).eq("estado", "activa"),
      supabase
        .from("usuario_funciones_operativas")
        .select("id", { count: "exact", head: true })
        .eq("activo", true),
      supabase
        .from("asientos_contables")
        .select("id", { count: "exact", head: true })
        .eq("estado", "registrado"),
      supabase
        .from("asientos_contables")
        .select("id", { count: "exact", head: true })
        .in("estado", ["borrador", "requiere_revision"]),
      supabase
        .from("periodos_contables")
        .select("id", { count: "exact", head: true })
        .eq("estado", "abierto"),
      supabase
        .from("periodos_contables")
        .select("id", { count: "exact", head: true })
        .eq("estado", "cerrado"),
      supabase
        .from("documentos_contables_revision")
        .select("id", { count: "exact", head: true })
        .in("estado", ["Pendiente", "En revision", "Observado", "Vencido"]),
      supabase
        .from("movimientos")
        .select("id", { count: "exact", head: true })
        .eq("estado", "activo"),
      supabase
        .from("movimientos")
        .select("id", { count: "exact", head: true })
        .eq("estado", "anulado"),
    ]);

    const errores = resultados
      .map((resultado) => resultado.error?.message || null)
      .filter((mensaje): mensaje is string => Boolean(mensaje));

    setResumenOperativoReal({
      empresasAsignadas: resultados[0].count ?? null,
      empresasActivas: resultados[1].count ?? null,
      funcionesActivas: resultados[2].count ?? null,
      asientosRegistrados: resultados[3].count ?? null,
      asientosBorrador: resultados[4].count ?? null,
      periodosAbiertos: resultados[5].count ?? null,
      periodosCerrados: resultados[6].count ?? null,
      documentosPendientes: resultados[7].count ?? null,
      movimientosActivos: resultados[8].count ?? null,
      movimientosAnulados: resultados[9].count ?? null,
      errores,
    });
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

  async function auditarAccionAlerta(
    alerta: AlertaDiagnostico,
    accion: string,
    estadoNuevo?: EstadoAlerta
  ) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: alerta.eventoOriginal?.empresa_id ?? null,
        modulo: "monitoreo-sistema",
        accion,
        entidad_tipo: alerta.fuente,
        entidad_id: alerta.entidadId || alerta.id,
        estado_anterior: estadoActualAlerta(alerta),
        estado_nuevo: estadoNuevo || estadoActualAlerta(alerta),
        descripcion: `Acción de monitoreo sobre alerta: ${alerta.mensaje.slice(0, 140)}`,
        sensible: alerta.severidad === "Alta" || alerta.severidad === "Critica",
        metadatos: {
          alerta_id: alerta.id,
          categoria: alerta.categoria,
          modulo_origen: alerta.modulo,
          ruta_sugerida: alerta.ruta,
          fuente_origen: alerta.fuente,
        },
        origen: "monitoreo_sistema",
      });
    } catch (error) {
      console.warn("No se pudo registrar auditoría de monitoreo:", error);
    }
  }

  async function seleccionarCategoria(categoria: CategoriaDiagnostico) {
    setCategoriaActiva(categoria);
    setAlertaSeleccionadaId(null);
    setFiltroModulo("todos");
    setFiltroEstado(categoria === "modulos_activos" ? "Resuelta" : "Pendiente");
    setFiltroSeveridad("todos");
    setFiltroFuente("todos");
  }

  async function seleccionarAlerta(alerta: AlertaDiagnostico) {
    setAlertaSeleccionadaId(alerta.id);
    await auditarAccionAlerta(alerta, "abrir_detalle_alerta");
  }

  async function cambiarEstadoAlerta(alerta: AlertaDiagnostico, estado: EstadoAlerta) {
    const alertaPersistida = alertasPersistidas[alerta.alertaClave];
    const ahora = new Date().toISOString();
    const cambios: Record<string, string | null> = {
      estado,
      actualizado_at: ahora,
    };

    if (estado === "En revisión") {
      cambios.revisado_por = perfilActual?.id || null;
      cambios.revisado_at = ahora;
    }

    if (estado === "Resuelta") {
      cambios.resuelto_por = perfilActual?.id || null;
      cambios.resuelto_at = ahora;
    }

    if (estado === "Archivada") {
      cambios.archivado_por = perfilActual?.id || null;
      cambios.archivado_at = ahora;
    }

    if (persistenciaAlertasActiva && alertaPersistida) {
      const { data, error } = await supabase
        .from("monitoreo_alertas")
        .update(cambios)
        .eq("id", alertaPersistida.id)
        .select(
          "id,alerta_clave,estado,modulo,accion,severidad,fuente,entidad_tipo,entidad_id,revisado_por,revisado_at,resuelto_por,resuelto_at,archivado_por,archivado_at"
        )
        .single();

      if (error) {
        console.warn("No se pudo actualizar monitoreo_alertas:", error);
        setAvisoMonitoreoAlertas(
          "No se pudo guardar el estado persistente de la alerta. Se aplico temporalmente en esta sesion."
        );
        setEstadosAlertas((actual) => ({ ...actual, [alerta.alertaClave]: estado }));
      } else {
        setAlertasPersistidas((actual) => ({
          ...actual,
          [alerta.alertaClave]: data as MonitoreoAlertaPersistida,
        }));
      }
    } else {
      setEstadosAlertas((actual) => ({ ...actual, [alerta.alertaClave]: estado }));
    }

    await auditarAccionAlerta(alerta, `marcar_alerta_${estado.toLowerCase().replace(" ", "_")}`, estado);
    toast.success(`Alerta marcada como ${estado}.`);
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
    () => eventos.filter((evento) => categoriaEventoAuditoria(evento) === "errores"),
    [eventos]
  );

  const alertasSeguridad = useMemo(
    () => eventos.filter((evento) => categoriaEventoAuditoria(evento) === "sensibles"),
    [eventos]
  );

  const operacionesParciales = useMemo(
    () => eventos.filter((evento) => categoriaEventoAuditoria(evento) === "parciales"),
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

  const alertasDiagnostico = useMemo(() => {
    const alertas: AlertaDiagnostico[] = [
      ...eventosError.map((evento) => alertaDesdeEvento(evento, "errores")),
      ...logs.map((log, index) => alertaDesdeLog(log, index)),
      ...alertasSeguridad.map((evento) => alertaDesdeEvento(evento, "sensibles")),
      ...operacionesParciales.map((evento) => alertaDesdeEvento(evento, "parciales")),
      ...usuariosInactivos.map((usuario) => ({
        id: `usuario-inactivo:${usuario.id}`,
        alertaClave: alertaClaveBase(["perfiles", "usuario_inactivo", usuario.id]),
        categoria: "usuarios_inactivos" as const,
        fecha: null,
        modulo: "usuarios",
        accion: "usuario_inactivo",
        severidad: "Alta" as const,
        usuarioId: usuario.id,
        usuario: usuario.nombre || usuario.id,
        empresaId: null,
        empresa: null,
        mensaje: `${usuario.nombre || "Usuario"} está bloqueado o inactivo.`,
        metadatos: {
          rol: valorSeguro(usuario.rol),
          correo: valorSeguro(usuario.correo),
          usuario_id: valorSeguro(usuario.id),
        },
        posibleCausa: "Perfil desactivado, bloqueo administrativo o usuario fuera de operación.",
        accionRecomendada: "Validar motivo del bloqueo en Admin y revisar asignaciones activas antes de reactivar.",
        ruta: "/admin",
        fuente: "perfiles",
        entidadTipo: "perfiles",
        entidadId: usuario.id,
      })),
      ...trabajosActivos.map((trabajo) => ({
        id: `trabajo-activo:${trabajo.id}`,
        alertaClave: alertaClaveBase(["borradores_trabajo", trabajo.modulo, trabajo.id]),
        categoria: "usuarios_trabajando" as const,
        fecha: trabajo.actualizado_at,
        modulo: trabajo.modulo || "operacion",
        accion: "trabajo_activo",
        severidad: "Informativa" as const,
        usuarioId: trabajo.usuario_id,
        usuario: trabajo.perfiles?.nombre || "Usuario no disponible",
        empresaId: trabajo.empresa_id,
        empresa: trabajo.empresa_id ? "Empresa no disponible" : null,
        mensaje: trabajo.titulo || trabajo.ruta || "Operación activa visible.",
        metadatos: {
          ruta: valorSeguro(trabajo.ruta),
          rol: valorSeguro(trabajo.perfiles?.rol),
          trabajo_id: valorSeguro(trabajo.id),
        },
        posibleCausa: "Usuario tiene un borrador o sesión de trabajo activa.",
        accionRecomendada: "Confirmar si el usuario sigue trabajando o si la operación debe cerrarse desde el módulo.",
        ruta: trabajo.ruta || rutaModulo(trabajo.modulo, "trabajo_activo"),
        fuente: "borradores_trabajo",
        entidadTipo: "borradores_trabajo",
        entidadId: trabajo.id,
      })),
      ...usuarioModulos
        .filter((item) => item.activo !== false)
        .map((item) => {
          const usuario = usuarios.find((perfil) => perfil.id === item.usuario_id);
          const modulo = modulos.find((catalogo) => catalogo.clave === item.modulo_clave);

          return {
            id: `asignacion:${item.id}`,
            alertaClave: alertaClaveBase(["usuario_modulos", item.usuario_id, item.modulo_clave, item.id]),
            categoria: "asignaciones" as const,
            fecha: null,
            modulo: item.modulo_clave,
            accion: "modulo_asignado",
            severidad: modulo?.activo === false ? ("Media" as const) : ("Informativa" as const),
            usuarioId: item.usuario_id,
            usuario: usuario?.nombre || "Usuario no disponible",
            empresaId: null,
            empresa: null,
            mensaje: `${usuario?.nombre || "Usuario"} tiene asignado ${modulo?.nombre || item.modulo_clave}.`,
            metadatos: {
              usuario_id: valorSeguro(item.usuario_id),
              modulo_global: modulo?.activo === false ? "inactivo" : "activo",
              asignacion_id: valorSeguro(item.id),
            },
            posibleCausa:
              modulo?.activo === false
                ? "La asignación está activa pero el módulo global está inactivo."
                : "Asignación operativa activa.",
            accionRecomendada:
              modulo?.activo === false
                ? "Revisar en Admin si la asignación debe mantenerse mientras el módulo está inactivo."
                : "Validar que la asignación corresponde al rol y empresa del usuario.",
            ruta: "/admin",
            fuente: "usuario_modulos",
            entidadTipo: "usuario_modulos",
            entidadId: item.id,
          };
        }),
      ...modulos.map((modulo) => ({
        id: `modulo:${modulo.clave}`,
        alertaClave: alertaClaveBase(["modulos_sistema", modulo.clave, modulo.activo ? "activo" : "inactivo"]),
        categoria: modulo.activo ? ("modulos_activos" as const) : ("modulos_inactivos" as const),
        fecha: null,
        modulo: modulo.clave,
        accion: modulo.activo ? "modulo_activo" : "modulo_inactivo",
        severidad: modulo.activo ? ("Informativa" as const) : ("Media" as const),
        usuarioId: null,
        usuario: null,
        empresaId: null,
        empresa: null,
        mensaje: `${modulo.nombre} está ${modulo.activo ? "activo" : "inactivo"} globalmente.`,
        metadatos: {
          orden: valorSeguro(modulo.orden),
          modulo_id: valorSeguro(modulo.id),
          clave: modulo.clave,
        },
        posibleCausa: modulo.activo
          ? "Módulo disponible para usuarios con permisos."
          : "Módulo desactivado globalmente por administración.",
        accionRecomendada: modulo.activo
          ? "Verificar asignaciones por usuario si alguien no puede acceder."
          : "Confirmar si la desactivación es intencional antes de reactivar.",
        ruta: "/admin",
        fuente: "modulos_sistema",
        entidadTipo: "modulos_sistema",
        entidadId: modulo.clave,
      })),
    ];

    fallasPorModulo.forEach((item) => {
      alertas.push({
        id: `fallas-modulo:${item.modulo}`,
        alertaClave: alertaClaveBase(["auditoria_eventos", "fallas_agrupadas", item.modulo]),
        categoria: "fallas",
        fecha: null,
        modulo: item.modulo,
        accion: "fallas_agrupadas",
        severidad: item.total >= 5 ? "Alta" : "Media",
        usuarioId: null,
        usuario: null,
        empresaId: null,
        empresa: null,
        mensaje: `${item.total} evento(s) problemático(s) agrupados en ${etiqueta(item.modulo)}.`,
        metadatos: { total: String(item.total) },
        posibleCausa: "Concentración de errores recientes en un módulo.",
        accionRecomendada: "Filtrar los errores del módulo y revisar los eventos más recientes primero.",
        ruta: rutaModulo(item.modulo, "fallas"),
        fuente: "auditoria_eventos",
        entidadTipo: "auditoria_eventos",
        entidadId: item.modulo,
      });
    });

    return alertas;
  }, [
    alertasSeguridad,
    eventosError,
    fallasPorModulo,
    logs,
    modulos,
    operacionesParciales,
    trabajosActivos,
    usuarioModulos,
    usuarios,
    usuariosInactivos,
  ]);

  useEffect(() => {
    if (!autorizado || alertasDiagnostico.length === 0) return;

    let cancelado = false;

    async function sincronizarMonitoreoAlertas() {
      setSincronizandoAlertas(true);

      try {
        const claves = Array.from(
          new Set(alertasDiagnostico.map((alerta) => alerta.alertaClave))
        );

        const { data: existentes, error: errorSelect } = await supabase
          .from("monitoreo_alertas")
          .select(
            "id,alerta_clave,estado,modulo,accion,severidad,fuente,entidad_tipo,entidad_id,revisado_por,revisado_at,resuelto_por,resuelto_at,archivado_por,archivado_at"
          )
          .in("alerta_clave", claves);

        if (errorSelect) throw errorSelect;

        const existentesPorClave = new Map(
          ((existentes || []) as MonitoreoAlertaPersistida[]).map((alerta) => [
            alerta.alerta_clave,
            alerta,
          ])
        );
        const faltantes = alertasDiagnostico.filter(
          (alerta) => !existentesPorClave.has(alerta.alertaClave)
        );

        if (faltantes.length > 0) {
          const { error: errorInsert } = await supabase
            .from("monitoreo_alertas")
            .upsert(
              faltantes.map((alerta) => payloadMonitoreoAlerta(alerta)),
              { onConflict: "alerta_clave", ignoreDuplicates: true }
            );

          if (errorInsert) throw errorInsert;
        }

        const { data: sincronizadas, error: errorRefresh } = await supabase
          .from("monitoreo_alertas")
          .select(
            "id,alerta_clave,estado,modulo,accion,severidad,fuente,entidad_tipo,entidad_id,revisado_por,revisado_at,resuelto_por,resuelto_at,archivado_por,archivado_at"
          )
          .in("alerta_clave", claves);

        if (errorRefresh) throw errorRefresh;
        if (cancelado) return;

        setAlertasPersistidas(
          ((sincronizadas || []) as MonitoreoAlertaPersistida[]).reduce<
            Record<string, MonitoreoAlertaPersistida>
          >((acc, alerta) => {
            acc[alerta.alerta_clave] = alerta;
            return acc;
          }, {})
        );
        setPersistenciaAlertasActiva(true);
        setAvisoMonitoreoAlertas(null);
      } catch (error) {
        if (cancelado) return;
        console.warn("Persistencia de monitoreo_alertas no disponible:", error);
        setPersistenciaAlertasActiva(false);
        setAvisoMonitoreoAlertas(
          "La tabla monitoreo_alertas no esta disponible o RLS no permite usarla. Se mantiene monitoreo en modo temporal hasta ejecutar el SQL incluido."
        );
      } finally {
        if (!cancelado) setSincronizandoAlertas(false);
      }
    }

    void sincronizarMonitoreoAlertas();

    return () => {
      cancelado = true;
    };
  }, [alertasDiagnostico, autorizado]);

  function estadoActualAlerta(alerta: AlertaDiagnostico) {
    return (
      alertasPersistidas[alerta.alertaClave]?.estado ||
      estadosAlertas[alerta.alertaClave] ||
      estadosAlertas[alerta.id] ||
      estadoInicialAlerta(alerta)
    );
  }

  const alertasPorCategoria = useMemo(() => {
    return alertasDiagnostico.reduce<Record<CategoriaDiagnostico, AlertaDiagnostico[]>>(
      (acc, alerta) => {
        acc[alerta.categoria].push(alerta);
        return acc;
      },
      {
        errores: [],
        sensibles: [],
        parciales: [],
        fallas: [],
        usuarios_inactivos: [],
        usuarios_trabajando: [],
        asignaciones: [],
        modulos_activos: [],
        modulos_inactivos: [],
      }
    );
  }, [alertasDiagnostico]);

  const alertasCategoriaActual = alertasPorCategoria[categoriaActiva] || [];
  const modulosFiltro = Array.from(
    new Set(alertasCategoriaActual.map((alerta) => alerta.modulo))
  ).sort();
  const fuentesFiltro = Array.from(
    new Set(alertasCategoriaActual.map((alerta) => alerta.fuente))
  ).sort();
  const conteosPorEstado = ESTADOS_ALERTA.reduce<Record<EstadoAlerta, number>>(
    (acc, estado) => {
      acc[estado] = alertasCategoriaActual.filter(
        (alerta) => estadoActualAlerta(alerta) === estado
      ).length;
      return acc;
    },
    {
      Pendiente: 0,
      "En revisión": 0,
      Resuelta: 0,
      Archivada: 0,
    }
  );
  const conteosCategoria = Object.fromEntries(
    Object.entries(alertasPorCategoria).map(([categoria, alertas]) => [
      categoria,
      alertas.filter((alerta) =>
        ["Pendiente", "En revisión"].includes(estadoActualAlerta(alerta))
      ).length,
    ])
  ) as Record<CategoriaDiagnostico, number>;
  const alertasFiltradas = alertasCategoriaActual.filter((alerta) => {
    const estado = estadoActualAlerta(alerta);
    return (
      (filtroModulo === "todos" || alerta.modulo === filtroModulo) &&
      (filtroEstado === "todos" || estado === filtroEstado) &&
      (filtroSeveridad === "todos" || alerta.severidad === filtroSeveridad) &&
      (filtroFuente === "todos" || alerta.fuente === filtroFuente) &&
      (estado !== "Archivada" || filtroEstado === "Archivada")
    );
  });
  const alertaSeleccionada =
    alertasDiagnostico.find((alerta) => alerta.id === alertaSeleccionadaId) ||
    alertasFiltradas[0] ||
    null;

  const salud = useMemo(() => {
    const modulosInactivos = modulos.filter((modulo) => !modulo.activo).length;
    const erroresRecientes = conteosCategoria.errores;
    const alertasSensiblesPendientes = conteosCategoria.sensibles;
    const operacionesPendientes = conteosCategoria.parciales + trabajosActivos.length;

    if (erroresRecientes > 0 || alertasSensiblesPendientes > 0) {
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
  }, [conteosCategoria.errores, conteosCategoria.parciales, conteosCategoria.sensibles, modulos, trabajosActivos.length]);

  const resumen = {
    modulosActivos: conteosCategoria.modulos_activos,
    modulosInactivos: conteosCategoria.modulos_inactivos,
    usuariosActivos: usuariosActivos.length,
    usuariosInactivos: conteosCategoria.usuarios_inactivos,
    errores: conteosCategoria.errores,
    sensibles: conteosCategoria.sensibles,
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

      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto">
          <header className="mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center">
                  <ServerCog size={28} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight">
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
              {avisoMonitoreoAlertas && (
                <div className="border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 rounded-2xl px-5 py-4 mb-6 text-sm">
                  {avisoMonitoreoAlertas}
                </div>
              )}
              {sincronizandoAlertas && (
                <div className="border border-white/10 bg-white/[0.03] text-gray-300 rounded-2xl px-5 py-3 mb-6 text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Sincronizando estados persistentes de alertas...
                </div>
              )}

              <section className="panel mb-8">
                <h2 className="panel-title">
                  <Activity size={16} className="text-cyan-300" />
                  Resumen operativo real
                </h2>
                <p className="mb-4 text-sm text-gray-400">
                  Conteos obtenidos desde Supabase con los permisos de la sesion actual.
                  Un valor no verificable se muestra como Pendiente.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <DatoEstado label="Sesion actual" valor={perfilActual?.nombre || null} />
                  <DatoEstado label="Rol actual" valor={perfilActual?.rol || null} />
                  <DatoEstado label="Empresas asignadas" valor={resumenOperativoReal?.empresasAsignadas} />
                  <DatoEstado label="Usuarios activos" valor={usuariosActivos.length} />
                  <DatoEstado label="Empresas activas" valor={resumenOperativoReal?.empresasActivas} />
                  <DatoEstado label="Funciones activas" valor={resumenOperativoReal?.funcionesActivas} />
                  <DatoEstado label="Asientos registrados" valor={resumenOperativoReal?.asientosRegistrados} />
                  <DatoEstado label="Asientos borrador/revision" valor={resumenOperativoReal?.asientosBorrador} />
                  <DatoEstado label="Periodos abiertos" valor={resumenOperativoReal?.periodosAbiertos} />
                  <DatoEstado label="Periodos cerrados" valor={resumenOperativoReal?.periodosCerrados} />
                  <DatoEstado label="Documentos pendientes" valor={resumenOperativoReal?.documentosPendientes} />
                  <DatoEstado label="Movimientos activos" valor={resumenOperativoReal?.movimientosActivos} />
                  <DatoEstado label="Movimientos anulados" valor={resumenOperativoReal?.movimientosAnulados} />
                  <DatoEstado label="Modulos operativos activos" valor={modulos.filter((modulo) => modulo.activo).length} />
                  <DatoEstado label="Modulos en fase posterior/inactivos" valor={modulos.filter((modulo) => !modulo.activo).length} />
                  <DatoEstado label="RPCs criticas" valor="Verificacion desde Supabase requerida" pendiente />
                  <DatoEstado label="RLS / policies" valor="Verificacion desde Supabase requerida" pendiente />
                  <DatoEstado
                    label="Consultas no verificables"
                    valor={resumenOperativoReal?.errores.length ?? null}
                    estado={
                      resumenOperativoReal?.errores.length ? "Error" : "Correcto"
                    }
                  />
                </div>
                {resumenOperativoReal?.errores.length ? (
                  <p className="mt-4 text-sm text-amber-200">
                    Pendiente: {resumenOperativoReal.errores.length} conteo(s) no pudieron
                    verificarse con la sesion actual.
                  </p>
                ) : null}
              </section>

              <section className="grid md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                <TarjetaResumen titulo="Modulos activos" valor={resumen.modulosActivos} icono={<ToggleRight size={22} />} activo={categoriaActiva === "modulos_activos"} onClick={() => seleccionarCategoria("modulos_activos")} />
                <TarjetaResumen titulo="Modulos inactivos" valor={resumen.modulosInactivos} icono={<ToggleLeft size={22} />} activo={categoriaActiva === "modulos_inactivos"} onClick={() => seleccionarCategoria("modulos_inactivos")} />
                <TarjetaResumen titulo="Usuarios trabajando" valor={conteosCategoria.usuarios_trabajando} icono={<Users size={22} />} activo={categoriaActiva === "usuarios_trabajando"} onClick={() => seleccionarCategoria("usuarios_trabajando")} />
                <TarjetaResumen titulo="Bloqueados/inactivos" valor={resumen.usuariosInactivos} icono={<Lock size={22} />} activo={categoriaActiva === "usuarios_inactivos"} onClick={() => seleccionarCategoria("usuarios_inactivos")} />
                <TarjetaResumen titulo="Errores/logs" valor={resumen.errores} icono={<XCircle size={22} />} activo={categoriaActiva === "errores"} onClick={() => seleccionarCategoria("errores")} />
                <TarjetaResumen titulo="Alertas sensibles" valor={resumen.sensibles} icono={<ShieldAlert size={22} />} activo={categoriaActiva === "sensibles"} onClick={() => seleccionarCategoria("sensibles")} />
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
                    <button type="button" onClick={() => seleccionarCategoria("parciales")} className="text-left bg-[#0f172a]/70 border border-white/10 rounded-xl p-4 hover:border-amber-300/50 cursor-pointer">
                      <p className="text-[11px] uppercase font-black text-gray-500">Operaciones parciales</p>
                      <p className="text-2xl font-black mt-2">{conteosCategoria.parciales}</p>
                    </button>
                    <button type="button" onClick={() => seleccionarCategoria("fallas")} className="text-left bg-[#0f172a]/70 border border-white/10 rounded-xl p-4 hover:border-red-300/50 cursor-pointer">
                      <p className="text-[11px] uppercase font-black text-gray-500">Fallas por modulo</p>
                      <p className="text-2xl font-black mt-2">{fallasPorModulo.length}</p>
                    </button>
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

              <section className="grid xl:grid-cols-[1.25fr_0.75fr] gap-6 mb-8">
                <PanelDiagnostico
                  categoria={categoriaActiva}
                  alertas={alertasFiltradas}
                  alertaSeleccionada={alertaSeleccionada}
                  modulosFiltro={modulosFiltro}
                  fuentesFiltro={fuentesFiltro}
                  conteosPorEstado={conteosPorEstado}
                  filtroModulo={filtroModulo}
                  filtroEstado={filtroEstado}
                  filtroSeveridad={filtroSeveridad}
                  filtroFuente={filtroFuente}
                  onFiltroModulo={setFiltroModulo}
                  onFiltroEstado={setFiltroEstado}
                  onFiltroSeveridad={setFiltroSeveridad}
                  onFiltroFuente={setFiltroFuente}
                  onSeleccionar={seleccionarAlerta}
                  obtenerEstado={estadoActualAlerta}
                />
                <PanelDetalleAlerta
                  alerta={alertaSeleccionada}
                  estado={alertaSeleccionada ? estadoActualAlerta(alertaSeleccionada) : null}
                  onCambiarEstado={cambiarEstadoAlerta}
                  onIrModulo={(alerta) => router.push(alerta.ruta)}
                />
              </section>

              <section className="grid xl:grid-cols-3 gap-6 mb-8">
                <PanelResumenCategoria titulo="Errores recientes" categoria="errores" alertas={alertasPorCategoria.errores.filter((alerta) => ["Pendiente", "En revisión"].includes(estadoActualAlerta(alerta))).slice(0, 8)} onVerCategoria={seleccionarCategoria} onSeleccionar={seleccionarAlerta} obtenerEstado={estadoActualAlerta} />
                <PanelResumenCategoria titulo="Operaciones parciales" categoria="parciales" alertas={alertasPorCategoria.parciales.filter((alerta) => ["Pendiente", "En revisión"].includes(estadoActualAlerta(alerta))).slice(0, 8)} onVerCategoria={seleccionarCategoria} onSeleccionar={seleccionarAlerta} obtenerEstado={estadoActualAlerta} />
                <PanelResumenCategoria titulo="Alertas de seguridad" categoria="sensibles" alertas={alertasPorCategoria.sensibles.filter((alerta) => ["Pendiente", "En revisión"].includes(estadoActualAlerta(alerta))).slice(0, 8)} onVerCategoria={seleccionarCategoria} onSeleccionar={seleccionarAlerta} obtenerEstado={estadoActualAlerta} />
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
                  <button
                    type="button"
                    onClick={() => seleccionarCategoria("asignaciones")}
                    className="mb-3 w-full rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 text-left text-sm font-bold text-purple-100 hover:border-purple-300/50 cursor-pointer"
                  >
                    Ver {conteosCategoria.asignaciones} asignaciones en diagnóstico
                  </button>
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {usuarioModulos.filter((item) => item.activo !== false).map((item) => {
                      const usuario = usuarios.find((perfil) => perfil.id === item.usuario_id);
                      const modulo = modulos.find((catalogo) => catalogo.clave === item.modulo_clave);
                      return (
                        <div key={item.id} className="bg-[#0f172a]/70 border border-white/10 rounded-xl p-4">
                          <p className="font-black">{usuario?.nombre || "Usuario no disponible"}</p>
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
                  <button
                    type="button"
                    onClick={() => seleccionarCategoria("fallas")}
                    className="mb-3 w-full rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-left text-sm font-bold text-red-100 hover:border-red-300/50 cursor-pointer"
                  >
                    Abrir agrupación accionable por módulo
                  </button>
                  <div className="space-y-3">
                    {fallasPorModulo.map((item) => (
                      <button
                        key={item.modulo}
                        type="button"
                        onClick={() => {
                          seleccionarCategoria("fallas");
                          setFiltroModulo(item.modulo);
                        }}
                        className="w-full flex items-center justify-between bg-[#0f172a]/70 border border-white/10 rounded-xl p-4 hover:border-red-300/50 cursor-pointer"
                      >
                        <span className="font-black capitalize">{etiqueta(item.modulo)}</span>
                        <span className="text-red-200 font-black">{item.total}</span>
                      </button>
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
  activo,
  onClick,
}: {
  titulo: string;
  valor: number;
  icono: React.ReactNode;
  activo?: boolean;
  onClick?: () => void;
}) {
  const clickeable = Boolean(onClick && valor > 0);

  return (
    <button
      type="button"
      onClick={clickeable ? onClick : undefined}
      disabled={!clickeable}
      className={`text-left bg-white/[0.035] border rounded-2xl p-5 transition-colors ${
        activo
          ? "border-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
          : "border-white/10"
      } ${clickeable ? "hover:border-amber-300/60 cursor-pointer" : "cursor-default opacity-80"}`}
    >
      <div className="flex items-center justify-between text-amber-300 mb-3">
        <span className="text-xs font-black uppercase tracking-wide text-gray-400">
          {titulo}
        </span>
        {icono}
      </div>
      <div className="text-3xl font-black">{valor}</div>
      <p className="text-[11px] text-gray-500 mt-2">
        {valor > 0 ? "Clic para ver detalle" : "Sin eventos"}
      </p>
    </button>
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

function DatoEstado({
  label,
  valor,
  pendiente = false,
  estado: estadoForzado,
}: {
  label: string;
  valor: string | number | null | undefined;
  pendiente?: boolean;
  estado?: "Correcto" | "Pendiente" | "Error";
}) {
  const verificable = valor !== null && valor !== undefined && valor !== "";
  const estado =
    estadoForzado || (pendiente || !verificable ? "Pendiente" : "Correcto");
  const clase =
    estado === "Correcto"
      ? "border-green-400/30 bg-green-400/10 text-green-200"
      : estado === "Error"
        ? "border-red-400/30 bg-red-400/10 text-red-200"
        : "border-amber-400/30 bg-amber-400/10 text-amber-200";

  return (
    <div className={`rounded-xl border p-4 ${clase}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 text-sm font-black">{verificable ? String(valor) : "No verificable"}</p>
      <p className="mt-2 text-[10px] font-black uppercase">{estado}</p>
    </div>
  );
}

function estiloSeveridad(severidad: SeveridadAlerta) {
  if (severidad === "Critica" || severidad === "Alta") {
    return "border-red-400/30 bg-red-400/10 text-red-100";
  }
  if (severidad === "Media") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (severidad === "Baja") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";
  return "border-slate-400/30 bg-slate-400/10 text-slate-100";
}

function PanelDiagnostico({
  categoria,
  alertas,
  alertaSeleccionada,
  modulosFiltro,
  fuentesFiltro,
  conteosPorEstado,
  filtroModulo,
  filtroEstado,
  filtroSeveridad,
  filtroFuente,
  onFiltroModulo,
  onFiltroEstado,
  onFiltroSeveridad,
  onFiltroFuente,
  onSeleccionar,
  obtenerEstado,
}: {
  categoria: CategoriaDiagnostico;
  alertas: AlertaDiagnostico[];
  alertaSeleccionada: AlertaDiagnostico | null;
  modulosFiltro: string[];
  fuentesFiltro: string[];
  conteosPorEstado: Record<EstadoAlerta, number>;
  filtroModulo: string;
  filtroEstado: EstadoAlerta | "todos";
  filtroSeveridad: SeveridadAlerta | "todos";
  filtroFuente: string;
  onFiltroModulo: (valor: string) => void;
  onFiltroEstado: (valor: EstadoAlerta | "todos") => void;
  onFiltroSeveridad: (valor: SeveridadAlerta | "todos") => void;
  onFiltroFuente: (valor: string) => void;
  onSeleccionar: (alerta: AlertaDiagnostico) => void;
  obtenerEstado: (alerta: AlertaDiagnostico) => EstadoAlerta;
}) {
  return (
    <div className="panel">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <h2 className="panel-title mb-0">
          <Search size={16} className="text-amber-300" />
          Diagnóstico: {NOMBRES_CATEGORIA[categoria]}
        </h2>
        <span className="text-xs text-gray-500">
          {alertas.length > 0 ? `${alertas.length} elemento(s) filtrado(s)` : "sin eventos"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {ESTADOS_ALERTA.map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => onFiltroEstado(estado)}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-bold ${
              filtroEstado === estado
                ? "border-cyan-300/70 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-[#0f172a]/70 text-gray-300 hover:border-cyan-300/40"
            }`}
          >
            {estado}: {conteosPorEstado[estado]}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <select
          value={filtroModulo}
          onChange={(event) => onFiltroModulo(event.target.value)}
          className="input-custom rounded-xl border border-white/10 bg-[#0f172a]/80 px-3 py-2 text-sm"
        >
          <option value="todos">Todos los modulos</option>
          {modulosFiltro.map((modulo) => (
            <option key={modulo} value={modulo}>
              {etiqueta(modulo)}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(event) => onFiltroEstado(event.target.value as EstadoAlerta | "todos")}
          className="input-custom rounded-xl border border-white/10 bg-[#0f172a]/80 px-3 py-2 text-sm"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS_ALERTA.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
        <select
          value={filtroSeveridad}
          onChange={(event) => onFiltroSeveridad(event.target.value as SeveridadAlerta | "todos")}
          className="input-custom rounded-xl border border-white/10 bg-[#0f172a]/80 px-3 py-2 text-sm"
        >
          <option value="todos">Todas las severidades</option>
          {["Critica", "Alta", "Media", "Baja", "Informativa"].map((severidad) => (
            <option key={severidad} value={severidad}>
              {severidad}
            </option>
          ))}
        </select>
        <select
          value={filtroFuente}
          onChange={(event) => onFiltroFuente(event.target.value)}
          className="input-custom rounded-xl border border-white/10 bg-[#0f172a]/80 px-3 py-2 text-sm"
        >
          <option value="todos">Todas las fuentes</option>
          {fuentesFiltro.map((fuente) => (
            <option key={fuente} value={fuente}>
              {fuente}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
        {alertas.map((alerta) => {
          const estado = obtenerEstado(alerta);
          const seleccionada = alertaSeleccionada?.id === alerta.id;

          return (
            <button
              key={alerta.id}
              type="button"
              onClick={() => onSeleccionar(alerta)}
              className={`w-full text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                seleccionada
                  ? "border-amber-300/70 bg-amber-300/10"
                  : "border-white/10 bg-[#0f172a]/70 hover:border-amber-300/50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`rounded-full border px-2 py-0.5 ${estiloSeveridad(alerta.severidad)}`}>
                  Riesgo: {alerta.severidad}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-300">
                  Estado: {estado}
                </span>
                <span className="text-gray-500">Fecha: {fechaHora(alerta.fecha)}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wide text-cyan-300 mt-3">
                Que paso
              </p>
              <p className="font-sans text-sm font-semibold text-gray-100 mt-1 line-clamp-2">
                {alerta.mensaje}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Modulo: {etiqueta(alerta.modulo)} | Usuario: {alerta.usuario || "No aplica"} | Empresa: {alerta.empresa || "No aplica"}
              </p>
            </button>
          );
        })}
        {alertas.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-[#0f172a]/70 p-6 text-sm text-gray-500">
            Sin eventos para esta vista. Cambia filtros o selecciona otro contador.
          </div>
        )}
      </div>
    </div>
  );
}

function PanelDetalleAlerta({
  alerta,
  estado,
  onCambiarEstado,
  onIrModulo,
}: {
  alerta: AlertaDiagnostico | null;
  estado: EstadoAlerta | null;
  onCambiarEstado: (alerta: AlertaDiagnostico, estado: EstadoAlerta) => void;
  onIrModulo: (alerta: AlertaDiagnostico) => void;
}) {
  const [verTecnico, setVerTecnico] = useState(false);

  if (!alerta || !estado) {
    return (
      <div className="panel">
        <h2 className="panel-title">
          <Eye size={16} className="text-cyan-300" />
          Detalle de alerta
        </h2>
        <p className="text-sm text-gray-500">Selecciona un elemento con datos para ver detalle accionable.</p>
      </div>
    );
  }

  return (
    <aside className="panel xl:sticky xl:top-6 h-fit">
      <h2 className="panel-title">
        <Eye size={16} className="text-cyan-300" />
        Detalle de alerta
      </h2>
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`rounded-full border px-2 py-0.5 text-xs ${estiloSeveridad(alerta.severidad)}`}>
              {alerta.severidad}
            </span>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-100">
              {estado}
            </span>
          </div>
          <p className="text-xs text-gray-500">Fecha: {fechaHora(alerta.fecha)}</p>
          <p className="text-[11px] uppercase font-black text-cyan-500/70 mt-3">Qué pasó</p>
          <h3 className="font-sans text-lg font-semibold text-gray-100 mt-1">{alerta.mensaje}</h3>
          <p className="text-sm text-gray-400 mt-2">Módulo: {etiqueta(alerta.modulo)}</p>
        </div>

        <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-4 space-y-4">
          <div>
            <p className="text-[11px] uppercase font-black text-amber-500/70 mb-1">Posible causa</p>
            <p className="text-sm text-gray-200 leading-relaxed">{alerta.posibleCausa}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-black text-cyan-500/70 mb-1">Acción recomendada</p>
            <p className="text-sm font-bold text-white leading-relaxed">{alerta.accionRecomendada}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DatoTexto label="Estado" valor={estado} />
          <DatoTexto label="Riesgo" valor={alerta.severidad} />
          <DatoTexto label="Usuario" valor={alerta.usuario || "No aplica"} />
          <DatoTexto label="Empresa" valor={alerta.empresa || "No aplica"} />
        </div>

        <div className="pt-2">
          <button 
            onClick={() => setVerTecnico(!verTecnico)}
            className="flex items-center gap-2 text-[11px] font-black uppercase text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Terminal size={14} />
            Detalle Técnico
            {verTecnico ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {verTecnico && (
            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="rounded-lg border border-white/5 bg-black/20 p-2 mb-2">
                <p className="text-[10px] text-gray-600 font-mono break-all">ID: {alerta.id}</p>
                <p className="text-[10px] text-gray-600 font-mono break-all">Fuente: {alerta.fuente}</p>
                <p className="text-[10px] text-gray-600 font-mono break-all">Código de acción: {alerta.accion}</p>
              </div>
              {Object.entries(alerta.metadatos).map(([clave, valor]) => (
                <div key={clave} className="rounded-lg border border-white/10 bg-[#0f172a]/70 p-3">
                  <p className="text-[11px] text-gray-500">{clave}</p>
                  <p className="text-xs text-gray-300 break-words font-mono">{valor}</p>
                </div>
              ))}
              {Object.keys(alerta.metadatos).length === 0 && (
                <p className="text-sm text-gray-500 italic">Sin objetos JSON adicionales.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
           <button
              type="button"
              onClick={() => onIrModulo(alerta)}
              className="w-full rounded-xl bg-cyan-500/15 border border-cyan-400/30 px-4 py-2.5 text-sm font-bold text-cyan-100 hover:border-cyan-300 transition-all flex items-center justify-center gap-2"
            >
              Ir al módulo afectado
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onCambiarEstado(alerta, "En revisión")} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[12px] font-bold hover:border-amber-400/50 transition-colors">
                En revisión
              </button>
              <button type="button" onClick={() => onCambiarEstado(alerta, "Resuelta")} className="rounded-xl bg-green-500/10 border border-green-400/30 px-3 py-2 text-[12px] font-bold text-green-100 hover:border-green-300 transition-colors">
                Resolver
              </button>
            </div>
            <button type="button" onClick={() => onCambiarEstado(alerta, "Archivada")} className="w-full rounded-xl bg-slate-500/10 border border-slate-400/30 px-4 py-2 text-[12px] font-bold text-slate-400 hover:text-slate-100 hover:border-slate-300 transition-colors">
              Archivar incidencia
            </button>
         </div>
      </div>
    </aside>
  );
}

function DatoTexto({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f172a]/70 p-3 min-w-0">
      <p className="text-[11px] uppercase font-black text-gray-500">{label}</p>
      <p className="text-sm text-gray-200 mt-1 break-words">{valor}</p>
    </div>
  );
}

function PanelResumenCategoria({
  titulo,
  categoria,
  alertas,
  onVerCategoria,
  onSeleccionar,
  obtenerEstado,
}: {
  titulo: string;
  categoria: CategoriaDiagnostico;
  alertas: AlertaDiagnostico[];
  onVerCategoria: (categoria: CategoriaDiagnostico) => void;
  onSeleccionar: (alerta: AlertaDiagnostico) => void;
  obtenerEstado: (alerta: AlertaDiagnostico) => EstadoAlerta;
}) {
  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="panel-title mb-0">
          <AlertTriangle size={16} className="text-amber-300" />
          {titulo}
        </h2>
        <button
          type="button"
          onClick={() => onVerCategoria(categoria)}
          className="text-xs font-bold text-cyan-200 hover:text-cyan-100"
        >
          Ver todo
        </button>
      </div>
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {alertas.map((alerta) => (
          <button
            key={alerta.id}
            type="button"
            onClick={() => onSeleccionar(alerta)}
            className="w-full text-left bg-[#0f172a]/70 border border-white/10 rounded-xl p-4 hover:border-amber-300/50 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={13} />
              {fechaHora(alerta.fecha)}
            </div>
            <p className="font-sans text-sm font-semibold text-white mt-2 capitalize leading-snug">
              {etiqueta(alerta.modulo)} / {etiqueta(alerta.accion)}
            </p>
            <p className="text-sm text-gray-300 mt-1">{alerta.mensaje}</p>
            <span className="inline-block mt-3 text-[11px] rounded-full border border-white/10 text-gray-300 px-2 py-0.5">
              {obtenerEstado(alerta)}
            </span>
          </button>
        ))}
        {alertas.length === 0 && (
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
            <p className="font-black">{trabajo.perfiles?.nombre || "Usuario no disponible"}</p>
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
