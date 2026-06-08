"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { subirDocumentoTramite } from "../../lib/documentosTramites";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import { Ban, CheckCircle2, Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Prioridad = "Alta" | "Media" | "Baja";
type EstadoTarea = "Pendiente" | "Completado";
type Moneda = "GTQ" | "USD";
type TipoMovimiento = "Ingreso" | "Egreso";

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface Tarea {
  id: number;
  nombre: string;
  estado: EstadoTarea | string;
  empleado: string;
  usuario_id: string;
  empresa: string;
  empresa_id: number | null;
  fecha_limite?: string | null;
  prioridad: Prioridad;
  archivo?: string | null;
  monto?: number | null;
  moneda?: string | null;
  tipo_movimiento?: string | null;
  categoria?: string | null;
  movimiento_generado?: boolean | null;
  creado_por?: string | null;
  cancelada_at?: string | null;
  cancelada_por?: string | null;
  motivo_cancelacion?: string | null;
}

const COLORS = ["#ef4444", "#eab308", "#22c55e"];
const ROLES_ADMIN = ["admin", "supervisor", "jefe"];
const PRIORIDADES: Prioridad[] = ["Alta", "Media", "Baja"];
const MONEDAS: Moneda[] = ["GTQ", "USD"];
const TIPOS_MOVIMIENTO: TipoMovimiento[] = ["Ingreso", "Egreso"];
const CATEGORIAS = ["Tarea", "Cheque", "Planilla", "Proveedor", "Pago", "Otro"];

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function esTareaCancelada(tarea: Pick<Tarea, "cancelada_at" | "motivo_cancelacion">) {
  return Boolean(tarea.cancelada_at || tarea.motivo_cancelacion);
}

function fechaHoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function validarMonto(valor: string) {
  if (!valor.trim()) return 0;
  const monto = Number(valor);
  if (!Number.isFinite(monto)) throw new Error("El monto debe ser numerico.");
  if (monto < 0) throw new Error("El monto no puede ser negativo.");
  return Math.round(monto * 100) / 100;
}

export default function TareasPage() {
  const router = useRouter();

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [userProfile, setUserProfile] = useState<Perfil | null>(null);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoTareas, setCargandoTareas] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [procesandoCrear, setProcesandoCrear] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todas");
  const [empresaFiltro, setEmpresaFiltro] = useState("Todas");
  const [archivos, setArchivos] = useState<{ [key: number]: File }>({});

  const [form, setForm] = useState({
    titulo: "",
    usuarioId: "",
    empresaId: "",
    empresa: "",
    fechaLimite: "",
    prioridad: "Media" as Prioridad,
    monto: "",
    moneda: "GTQ" as Moneda,
    tipoMovimiento: "Egreso" as TipoMovimiento,
    categoria: "Tarea",
  });

  useEffect(() => {
    async function initApp() {
      try {
        setValidandoAcceso(true);
        setCargandoTareas(false);

        const acceso = await validarAccesoModuloUsuario("tareas");

        if (!acceso.ok) {
          if (
            acceso.motivo === "sin_sesion" ||
            acceso.motivo === "sin_perfil" ||
            acceso.motivo === "usuario_inactivo"
          ) {
            if (acceso.motivo === "usuario_inactivo") {
              toast.error("Tu usuario esta inactivo. Contacta al administrador.");
            }

            router.push("/login");
            return;
          }

          if (
            acceso.motivo === "modulo_inactivo" ||
            acceso.motivo === "modulo_no_encontrado"
          ) {
            toast.error("El modulo de Tareas esta desactivado.");
          } else {
            toast.error("No tienes acceso al modulo de Tareas.");
          }

          router.push("/dashboard");
          return;
        }

        const user = acceso.user!;
        const profile = acceso.perfil!;
        const rol = normalizarRol(profile.rol);

        setCargandoTareas(true);
        setUserProfile(profile as Perfil);
        setAutorizado(true);

        const idsPermitidos = await obtenerEmpresasPermitidas(user.id, profile.rol || "");
        const operativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);

        setEmpresasPermitidasIds(operativas.ids);
        setEmpresas(operativas.empresas);
        setFuncionesOperativas(await listarFuncionesOperativasUsuario(user.id, operativas.ids));

        if (operativas.ids.length) {
          const empresaInicial = String(operativas.ids[0]);
          setForm((actual) => ({
            ...actual,
            empresaId: actual.empresaId || empresaInicial,
            empresa:
              actual.empresa ||
              operativas.empresas.find((empresa) => String(empresa.id) === empresaInicial)
                ?.nombre ||
              "",
          }));
        }

        await Promise.all([
          fetchTareas(operativas.ids, profile as Perfil),
          fetchCatalogos(operativas.ids, rol),
        ]);
      } catch (error) {
        toast.error("Error al sincronizar datos iniciales");
        console.error("Error inicializando Tareas:", error);
      } finally {
        setCargandoTareas(false);
        setValidandoAcceso(false);
      }
    }

    initApp();
  }, [router]);

  useEffect(() => {
    if (!autorizado || !userProfile || !empresasPermitidasIds.length) return;

    const filtroEmpresas = `empresa_id=in.(${empresasPermitidasIds.join(",")})`;
    const puedeRecibirTarea = (tarea: Tarea) =>
      !esTareaCancelada(tarea) &&
      empresasPermitidasIds.includes(Number(tarea.empresa_id)) &&
      (ROLES_ADMIN.includes(normalizarRol(userProfile.rol)) ||
        tarea.usuario_id === userProfile.id);

    const channel = supabase
      .channel("tareas-safe-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tareas", filter: filtroEmpresas },
        (payload) => {
          const nueva = payload.new as Tarea;
          if (puedeRecibirTarea(nueva)) {
            setTareas((prev) =>
              prev.some((tarea) => tarea.id === nueva.id) ? prev : [nueva, ...prev]
            );
            toast.success("Nueva tarea detectada");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tareas", filter: filtroEmpresas },
        (payload) => {
          const actualizada = payload.new as Tarea;

          if (!puedeRecibirTarea(actualizada)) {
            setTareas((prev) => prev.filter((tarea) => tarea.id !== actualizada.id));
            return;
          }

          setTareas((prev) =>
            prev.map((tarea) => (tarea.id === actualizada.id ? actualizada : tarea))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autorizado, userProfile, empresasPermitidasIds]);

  async function fetchTareas(idsPermitidos: number[], profile: Perfil) {
    const ids = idsPermitidos.map(Number).filter(Number.isFinite);

    if (!ids.length) {
      setTareas([]);
      return;
    }

    let query = supabase
      .from("tareas")
      .select("*")
      .in("empresa_id", ids)
      .in("estado", ["Pendiente", "Completado"])
      .is("cancelada_at", null)
      .order("id", { ascending: false });

    if (!ROLES_ADMIN.includes(normalizarRol(profile.rol))) {
      query = query.eq("usuario_id", profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    setTareas((data || []) as Tarea[]);
  }

  async function fetchCatalogos(idsPermitidos: number[], rol: string) {
    const puedeAsignar = ROLES_ADMIN.includes(normalizarRol(rol));

    const [resU] = await Promise.all([
      puedeAsignar
        ? supabase
            .from("perfiles")
            .select("id,nombre,rol,activo")
            .eq("activo", true)
            .order("nombre", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (resU.error) throw resU.error;

    setUsuarios((resU.data || []) as Perfil[]);
  }

  function validarEmpresaPermitida(valor: string | number, accion: string) {
    const empresaId = Number(valor);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error(`Debe seleccionar una empresa valida para ${accion}.`);
    }
    if (!empresasPermitidasIds.includes(empresaId)) {
      throw new Error("No tienes permiso para operar sobre esa empresa.");
    }
    return empresaId;
  }

  function esAuditorSoloLectura(empresaId: string | number | null | undefined) {
    return esAuditorSoloLecturaLocal(funcionesOperativas, [empresaId]);
  }

  function tieneFuncionTareas(
    empresaId: string | number | null | undefined,
    funciones: Array<"auxiliar_contable" | "contador_revisor">
  ) {
    return tieneFuncionOperativaLocal(funcionesOperativas, userProfile?.id, empresaId, funciones);
  }

  function usuarioPuedeRecibirTarea(usuarioId: string, empresaId: number) {
    return funcionesOperativas.some(
      (funcion) =>
        funcion.activo !== false &&
        funcion.usuario_id === usuarioId &&
        Number(funcion.empresa_id) === empresaId &&
        ["auxiliar_contable", "contador_revisor"].includes(String(funcion.funcion))
    );
  }

  function puedeCrearTarea(empresaId: string | number | null | undefined) {
    const rol = normalizarRol(userProfile?.rol);
    if (esAuditorSoloLectura(empresaId)) return false;
    return ROLES_ADMIN.includes(rol) || tieneFuncionTareas(empresaId, ["contador_revisor"]);
  }

  function puedeCompletarTarea(tarea: Tarea) {
    if (!tarea.empresa_id || esAuditorSoloLectura(tarea.empresa_id)) return false;
    return (
      tarea.usuario_id === userProfile?.id ||
      ROLES_ADMIN.includes(normalizarRol(userProfile?.rol)) ||
      tieneFuncionTareas(tarea.empresa_id, ["auxiliar_contable", "contador_revisor"])
    );
  }

  function puedeCancelarTarea(tarea: Tarea) {
    if (!tarea.empresa_id || esAuditorSoloLectura(tarea.empresa_id)) return false;
    return (
      ROLES_ADMIN.includes(normalizarRol(userProfile?.rol)) ||
      tieneFuncionTareas(tarea.empresa_id, ["contador_revisor"])
    );
  }

  async function auditarBloqueoAuditor(accion: string, empresaId: number, entidadId?: number) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: empresaId,
        modulo: "tareas",
        accion: "intento_bloqueado_auditor_solo_lectura",
        entidad_tipo: entidadId ? "tarea" : "empresa",
        entidad_id: entidadId || empresaId,
        descripcion: "Auditor solo lectura intento modificar Tareas.",
        sensible: true,
        origen: "modulo_tareas",
        metadatos: { accion_intentada: accion },
      });
    } catch (error) {
      console.warn("No se pudo auditar bloqueo de auditor en Tareas:", error);
    }
  }

  async function completarTarea(id: number) {
    if (processingId) return;

    const tareaActual = tareas.find((tarea) => tarea.id === id);

    if (!userProfile?.id || !tareaActual?.empresa_id) {
      toast.error("No se encontro una tarea valida.");
      return;
    }

    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(tareaActual.empresa_id, "completar tareas");
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (!puedeCompletarTarea(tareaActual)) {
      if (esAuditorSoloLectura(empresaId)) {
        await auditarBloqueoAuditor("completar_tarea", empresaId, id);
      }
      toast.error("No tienes permiso para completar esta tarea.");
      return;
    }

    if (tareaActual.estado !== "Pendiente" || esTareaCancelada(tareaActual)) {
      toast.error("Solo se pueden completar tareas pendientes activas.");
      return;
    }

    setProcessingId(id);
    const toastId = toast.loading("Completando tarea...");

    try {
      let archivoReferencia: string | null = tareaActual.archivo || null;
      const archivo = archivos[id];

      if (archivo) {
        const tiposPermitidos = ["application/pdf", "image/png", "image/jpeg"];

        if (!tiposPermitidos.includes(archivo.type)) {
          throw new Error("Archivo no permitido. Usa PDF, PNG o JPG.");
        }

        if (archivo.size > 5 * 1024 * 1024) {
          throw new Error("El archivo supera el maximo de 5MB.");
        }

        const documento = await subirDocumentoTramite({
          archivo,
          empresa_id: empresaId,
          modulo: "tareas",
          tipo_documento: "evidencia tarea",
          entidad_tipo: "tarea",
          entidad_id: id,
          titulo: `Evidencia de tarea ${id}`,
          descripcion: tareaActual.nombre,
          fecha_documento: fechaHoyISO(),
          monto: tareaActual.monto ?? null,
          moneda: tareaActual.moneda || null,
          sensible: true,
          metadatos: {
            origen: "modulo_tareas",
            bucket_privado: true,
          },
        });

        archivoReferencia = `documentos_tramites:${documento.id}`;
      }

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "Completado",
          archivo: archivoReferencia,
        })
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .eq("estado", "Pendiente");

      if (updateError) throw updateError;

      let movimientoGenerado = Boolean(tareaActual.movimiento_generado);
      const monto = Number(tareaActual.monto || 0);

      if (monto > 0 && !tareaActual.movimiento_generado) {
        if (!MONEDAS.includes((tareaActual.moneda || "GTQ") as Moneda)) {
          throw new Error("La moneda de la tarea no es valida para generar movimiento.");
        }
        if (!TIPOS_MOVIMIENTO.includes((tareaActual.tipo_movimiento || "Egreso") as TipoMovimiento)) {
          throw new Error("El tipo de movimiento de la tarea no es valido.");
        }

        const { error: movError } = await supabase.from("movimientos").insert([
          {
            tipo: tareaActual.tipo_movimiento || "Egreso",
            descripcion: tareaActual.nombre,
            monto,
            empresa: tareaActual.empresa,
            empresa_id: empresaId,
            moneda: tareaActual.moneda || "GTQ",
            fecha: fechaHoyISO(),
            categoria: tareaActual.categoria || "Tarea",
            estado: "activo",
            creado_por: userProfile.id,
          },
        ]);

        if (movError) throw movError;

        const { error: movimientoFlagError } = await supabase
          .from("tareas")
          .update({ movimiento_generado: true })
          .eq("id", id)
          .eq("empresa_id", empresaId);

        if (movimientoFlagError) throw movimientoFlagError;
        movimientoGenerado = true;
      }

      try {
        await registrarAuditoriaEvento({
          empresa_id: empresaId,
          modulo: "tareas",
          accion: "completar_tarea",
          entidad_tipo: "tarea",
          entidad_id: id,
          estado_anterior: tareaActual.estado,
          estado_nuevo: "Completado",
          descripcion: "Tarea completada desde modulo Tareas",
          sensible: true,
          visible_calendario: Boolean(tareaActual.fecha_limite),
          origen: "modulo_tareas",
          metadatos: {
            evidencia_adjunta: Boolean(archivo),
            archivo_referencia: archivoReferencia,
            movimiento_generado: movimientoGenerado,
            monto,
            moneda: tareaActual.moneda || null,
          },
        });
      } catch (auditoriaError) {
        console.error("La tarea se completo, pero fallo la auditoria:", auditoriaError);
        toast.error("Tarea completada, pero fallo la auditoria central.");
      }

      setTareas((prev) =>
        prev.map((tarea) =>
          tarea.id === id
            ? {
                ...tarea,
                estado: "Completado",
                archivo: archivoReferencia || tarea.archivo,
                movimiento_generado: movimientoGenerado,
              }
            : tarea
        )
      );

      setArchivos((prev) => {
        const siguiente = { ...prev };
        delete siguiente[id];
        return siguiente;
      });

      toast.success("Tarea finalizada.", { id: toastId });
    } catch (error) {
      console.error("Error completando tarea:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcessingId(null);
    }
  }

  async function cancelarTarea(id: number) {
    if (!userProfile?.id) {
      toast.error("No se pudo identificar al usuario actual");
      return;
    }

    const tareaActual = tareas.find((tarea) => tarea.id === id);

    if (!tareaActual?.empresa_id) {
      toast.error("No se encontro una tarea valida.");
      return;
    }

    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(tareaActual.empresa_id, "cancelar tareas");
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (!puedeCancelarTarea(tareaActual)) {
      if (esAuditorSoloLectura(empresaId)) {
        await auditarBloqueoAuditor("cancelar_tarea", empresaId, id);
      }
      toast.error("No tienes permiso para cancelar esta tarea.");
      return;
    }

    const mensajeConfirmacion = tareaActual.movimiento_generado
      ? "Esta tarea ya genero un movimiento. Solo se marcara como cancelada y se conservara el historial financiero. Deseas continuar?"
      : "Deseas cancelar esta tarea? No se eliminara el registro ni su historial.";

    if (!window.confirm(mensajeConfirmacion)) return;

    const motivo = window.prompt("Motivo de cancelacion:");

    if (!motivo || motivo.trim().length < 5) {
      toast.error("Debes indicar un motivo valido.");
      return;
    }

    setProcessingId(id);

    try {
      const { error } = await supabase
        .from("tareas")
        .update({
          cancelada_at: new Date().toISOString(),
          cancelada_por: userProfile.id,
          motivo_cancelacion: motivo.trim(),
        })
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      try {
        await registrarAuditoriaEvento({
          empresa_id: empresaId,
          modulo: "tareas",
          accion: "cancelar_tarea",
          entidad_tipo: "tarea",
          entidad_id: id,
          estado_anterior: tareaActual.estado,
          estado_nuevo: tareaActual.estado,
          motivo: motivo.trim(),
          descripcion: "Tarea marcada como cancelada sin usar estado invalido.",
          sensible: true,
          visible_calendario: true,
          origen: "modulo_tareas",
          metadatos: {
            cancelada_at: true,
            movimiento_generado: Boolean(tareaActual.movimiento_generado),
          },
        });
      } catch (auditoriaError) {
        console.error("La tarea se cancelo, pero fallo la auditoria:", auditoriaError);
      }

      setTareas((prev) => prev.filter((tarea) => tarea.id !== id));
      toast.success("Tarea cancelada");
    } catch (error) {
      console.error("Error cancelando tarea:", error);
      toast.error("No se pudo cancelar la tarea");
    } finally {
      setProcessingId(null);
    }
  }

  async function crearTarea() {
    if (procesandoCrear) {
      toast.error("Ya hay una operacion en proceso.");
      return;
    }

    if (!userProfile?.id) {
      toast.error("Sesion no valida.");
      return;
    }

    let empresaId: number;
    let monto: number;

    try {
      empresaId = validarEmpresaPermitida(form.empresaId, "crear tareas");
      monto = validarMonto(form.monto);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (!puedeCrearTarea(empresaId)) {
      if (esAuditorSoloLectura(empresaId)) {
        await auditarBloqueoAuditor("crear_tarea", empresaId);
      }
      toast.error("No tienes permiso para crear tareas en esta empresa.");
      return;
    }

    if (!form.titulo.trim() || !form.usuarioId || !form.fechaLimite) {
      toast.error("Completa titulo, responsable, empresa y fecha limite.");
      return;
    }

    if (!PRIORIDADES.includes(form.prioridad)) {
      toast.error("Prioridad no valida.");
      return;
    }

    if (!MONEDAS.includes(form.moneda)) {
      toast.error("Moneda no valida.");
      return;
    }

    if (!TIPOS_MOVIMIENTO.includes(form.tipoMovimiento)) {
      toast.error("Tipo de movimiento no valido.");
      return;
    }

    if (!CATEGORIAS.includes(form.categoria)) {
      toast.error("Categoria no valida.");
      return;
    }

    const empresaSeleccionada = empresas.find((empresa) => empresa.id === empresaId);
    const empleado = usuarios.find((usuario) => usuario.id === form.usuarioId)?.nombre;

    if (!empresaSeleccionada || !empleado) {
      toast.error("Empresa o responsable no valido.");
      return;
    }

    setProcesandoCrear(true);

    try {
      const { data: tareaCreada, error } = await supabase
        .from("tareas")
        .insert([
          {
            nombre: form.titulo.trim(),
            estado: "Pendiente",
            usuario_id: form.usuarioId,
            empleado,
            empresa: empresaSeleccionada.nombre,
            empresa_id: empresaId,
            fecha_limite: form.fechaLimite,
            prioridad: form.prioridad,
            creado_por: userProfile.id,
            monto,
            moneda: form.moneda,
            tipo_movimiento: form.tipoMovimiento,
            categoria: form.categoria,
            movimiento_generado: false,
          },
        ])
        .select("*")
        .single();

      if (error || !tareaCreada) throw error || new Error("No se pudo crear la tarea.");

      try {
        await registrarAuditoriaEvento({
          empresa_id: empresaId,
          modulo: "tareas",
          accion: "crear_tarea",
          entidad_tipo: "tarea",
          entidad_id: tareaCreada.id,
          estado_nuevo: "Pendiente",
          descripcion: "Tarea creada desde modulo Tareas",
          sensible: true,
          visible_calendario: Boolean(form.fechaLimite),
          origen: "modulo_tareas",
          metadatos: {
            responsable_id: form.usuarioId,
            prioridad: form.prioridad,
            monto,
            moneda: form.moneda,
            genera_movimiento_operativo: monto > 0,
          },
        });
      } catch (auditoriaError) {
        console.error("La tarea se creo, pero fallo la auditoria:", auditoriaError);
        toast.error("Tarea creada, pero fallo la auditoria central.");
      }

      setForm({
        titulo: "",
        usuarioId: "",
        empresaId: String(empresaId),
        empresa: empresaSeleccionada.nombre,
        fechaLimite: "",
        prioridad: "Media",
        monto: "",
        moneda: "GTQ",
        tipoMovimiento: "Egreso",
        categoria: "Tarea",
      });

      setTareas((prev) => [tareaCreada as Tarea, ...prev]);
      toast.success("Tarea asignada");
    } catch (error) {
      console.error("Error creando tarea:", error);
      toast.error("Error al crear la tarea");
    } finally {
      setProcesandoCrear(false);
    }
  }

  const tareasPermitidas = useMemo(
    () =>
      tareas.filter(
        (tarea) =>
          !esTareaCancelada(tarea) &&
          tarea.empresa_id !== null &&
          empresasPermitidasIds.includes(Number(tarea.empresa_id)) &&
          (tarea.estado === "Pendiente" || tarea.estado === "Completado")
      ),
    [tareas, empresasPermitidasIds]
  );

  const stats = useMemo(() => {
    const completadas = tareasPermitidas.filter((tarea) => tarea.estado === "Completado").length;
    const pendientes = tareasPermitidas.filter((tarea) => tarea.estado === "Pendiente").length;
    const vencidas = tareasPermitidas.filter((tarea) => {
      if (!tarea.fecha_limite || tarea.estado === "Completado") return false;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      return new Date(tarea.fecha_limite) < hoy;
    }).length;

    return {
      pendientes,
      completadas,
      vencidas,
      progreso: tareasPermitidas.length
        ? Math.round((completadas / tareasPermitidas.length) * 100)
        : 0,
      dataEstados: [
        { nombre: "Pendientes", cantidad: pendientes },
        { nombre: "Completadas", cantidad: completadas },
        { nombre: "Vencidas", cantidad: vencidas },
      ],
      dataPrioridad: PRIORIDADES.map((prioridad) => ({
        nombre: prioridad,
        valor: tareasPermitidas.filter((tarea) => tarea.prioridad === prioridad).length,
      })),
    };
  }, [tareasPermitidas]);

  const tareasFiltradas = useMemo(() => {
    return tareasPermitidas.filter((tarea) => {
      const matchEmpresa =
        empresaFiltro === "Todas" || Number(tarea.empresa_id) === Number(empresaFiltro);
      const texto = busqueda.trim().toLowerCase();
      const matchBusqueda =
        !texto ||
        tarea.nombre.toLowerCase().includes(texto) ||
        tarea.empleado.toLowerCase().includes(texto);
      const matchEstado =
        filtroEstado === "Todas"
          ? true
          : filtroEstado === "Vencidas"
            ? tarea.fecha_limite &&
              new Date(tarea.fecha_limite) < new Date() &&
              tarea.estado !== "Completado"
            : tarea.estado === filtroEstado;

      return matchEmpresa && matchBusqueda && matchEstado;
    });
  }, [tareasPermitidas, empresaFiltro, busqueda, filtroEstado]);

  const empresaFormId = Number(form.empresaId || 0);
  const auditorSoloLecturaForm = empresaFormId > 0 && esAuditorSoloLectura(empresaFormId);
  const puedeMostrarFormulario =
    userProfile?.rol && ROLES_ADMIN.includes(normalizarRol(userProfile.rol));

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex h-screen bg-[#020617] items-center justify-center text-cyan-400 font-mono italic">
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white font-sans">
      <Toaster
        position="bottom-right"
        toastOptions={{ style: { background: "#0f172a", color: "#fff", border: "1px solid #1e293b" } }}
      />
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-black tracking-tighter italic">CORE_TASKS</h1>
            <p className="text-gray-500 text-sm">
              Operador: {userProfile?.nombre?.toUpperCase()} | Rol:{" "}
              {userProfile?.rol?.toUpperCase()}
            </p>
          </header>

          {!empresas.length && (
            <section className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-6 mb-8 text-yellow-100">
              No tienes empresas operativas disponibles para Tareas. Las empresas
              archivadas, inactivas o de prueba no se muestran aqui.
            </section>
          )}

          <section className="bg-cyan-500/10 border border-cyan-500/20 rounded-3xl p-5 mb-8">
            <h2 className="text-cyan-300 font-black text-sm uppercase">Alcance seguro</h2>
            <p className="text-gray-400 text-sm mt-1">
              Las tareas se consultan por `empresa_id` dentro de empresas permitidas y
              operativas. Las evidencias se suben a `documentos-tramites`; no se
              publican rutas directas de storage.
            </p>
          </section>

          {cargandoTareas ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 flex items-center justify-center gap-2 text-cyan-400">
              <Loader2 className="animate-spin" size={18} />
              Cargando tareas...
            </section>
          ) : (
            <>
              <section className="grid md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Pendientes" value={stats.pendientes} color="text-yellow-400" />
                <StatCard label="Completadas" value={stats.completadas} color="text-green-400" />
                <StatCard label="Vencidas" value={stats.vencidas} color="text-red-400" />
                <StatCard label="Eficiencia" value={`${stats.progreso}%`} color="text-cyan-400" />
              </section>

              <section className="grid md:grid-cols-2 gap-6 mb-10">
                <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 h-80 backdrop-blur-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dataEstados}>
                      <XAxis dataKey="nombre" stroke="#475569" fontSize={10} />
                      <YAxis stroke="#475569" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e293b" }} />
                      <Bar dataKey="cantidad" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 h-80 backdrop-blur-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.dataPrioridad} dataKey="valor" outerRadius={70} stroke="none">
                        {stats.dataPrioridad.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {auditorSoloLecturaForm && (
                <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-yellow-100 flex gap-3">
                  <Ban size={20} />
                  Auditor solo lectura: puedes consultar tareas, pero no crear,
                  completar ni cancelar.
                </div>
              )}

              {puedeMostrarFormulario && (
                <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 mb-8 border-l-4 border-l-cyan-500">
                  <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase italic">
                    Comando de Asignacion
                  </h2>
                  <div className="grid md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Titulo tarea"
                      className="input-custom"
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    />

                    <select
                      className="input-custom"
                      value={form.usuarioId}
                      onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                    >
                      <option value="">Asignar a empleado / supervisor / jefe</option>
                      {usuarios
                        .filter(
                          (usuario) =>
                            empresaFormId > 0 &&
                            usuarioPuedeRecibirTarea(usuario.id, empresaFormId)
                        )
                        .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} - {u.rol}
                        </option>
                        ))}
                    </select>
                    {empresaFormId > 0 &&
                      !usuarios.some((usuario) =>
                        usuarioPuedeRecibirTarea(usuario.id, empresaFormId)
                      ) && (
                        <p className="md:col-span-3 text-sm text-amber-200">
                          No hay usuarios autorizados configurados para esta accion.
                        </p>
                      )}

                    <select
                      className="input-custom"
                      value={form.empresaId}
                      onChange={(e) => {
                        const empresaSeleccionada = empresas.find(
                          (emp) => String(emp.id) === e.target.value
                        );
                        setForm({
                          ...form,
                          empresaId: e.target.value,
                          empresa: empresaSeleccionada?.nombre || "",
                        });
                      }}
                    >
                      <option value="">Empresa...</option>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={String(emp.id)}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      className="input-custom"
                      value={form.fechaLimite}
                      onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
                    />

                    <select
                      className="input-custom"
                      value={form.prioridad}
                      onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })}
                    >
                      {PRIORIDADES.map((prioridad) => (
                        <option key={prioridad} value={prioridad}>
                          Prioridad {prioridad}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={`Monto en ${form.moneda}`}
                      className="input-custom"
                      value={form.monto}
                      onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    />

                    <select
                      className="input-custom border-cyan-500"
                      value={form.moneda}
                      onChange={(e) => setForm({ ...form, moneda: e.target.value as Moneda })}
                    >
                      <option value="GTQ">Moneda: Quetzales (GTQ)</option>
                      <option value="USD">Moneda: Dolares (USD)</option>
                    </select>

                    <select
                      className="input-custom"
                      value={form.tipoMovimiento}
                      onChange={(e) =>
                        setForm({ ...form, tipoMovimiento: e.target.value as TipoMovimiento })
                      }
                    >
                      <option value="Ingreso">Ingreso</option>
                      <option value="Egreso">Egreso</option>
                    </select>

                    <select
                      className="input-custom"
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    >
                      {CATEGORIAS.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={crearTarea}
                      disabled={
                        procesandoCrear ||
                        !empresas.length ||
                        !empresaFormId ||
                        !puedeCrearTarea(empresaFormId)
                      }
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {procesandoCrear ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                      Desplegar Tarea
                    </button>
                  </div>
                </section>
              )}

              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                  type="text"
                  placeholder="Filtrar por nombre o empleado..."
                  className="flex-1 input-custom"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <select
                  className="input-custom md:w-64"
                  value={empresaFiltro}
                  onChange={(e) => setEmpresaFiltro(e.target.value)}
                >
                  <option value="Todas">Todas las empresas</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={String(empresa.id)}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
                <select
                  className="input-custom md:w-48"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="Todas">Estados: Todos</option>
                  <option value="Pendiente">Pendientes</option>
                  <option value="Completado">Completadas</option>
                  <option value="Vencidas">Vencidas</option>
                </select>
              </div>

              <div className="space-y-4">
                {!tareasFiltradas.length && (
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-gray-400">
                    No hay tareas para los filtros aplicados.
                  </div>
                )}

                {tareasFiltradas.map((tarea) => (
                  <TareaRow
                    key={tarea.id}
                    tarea={tarea}
                    puedeCompletar={puedeCompletarTarea(tarea)}
                    puedeCancelar={puedeCancelarTarea(tarea)}
                    isProcessing={processingId === tarea.id}
                    onCompletar={completarTarea}
                    onCancelar={cancelarTarea}
                    onFileChange={(id, file) =>
                      setArchivos((prev) => ({ ...prev, [id]: file }))
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        .input-custom {
          height: 3.5rem;
          padding: 0 1.25rem;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          outline: none;
          font-size: 0.8rem;
          transition: border 0.2s;
        }

        .input-custom option {
          background: #0f172a;
          color: white;
        }

        .input-custom:focus {
          border-color: #06b6d4;
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{label}</p>
      <h2 className={`text-2xl font-black mt-1 ${color}`}>{value}</h2>
    </div>
  );
}

function TareaRow({
  tarea,
  puedeCompletar,
  puedeCancelar,
  isProcessing,
  onCompletar,
  onCancelar,
  onFileChange,
}: {
  tarea: Tarea;
  puedeCompletar: boolean;
  puedeCancelar: boolean;
  isProcessing: boolean;
  onCompletar: (id: number) => Promise<void>;
  onCancelar: (id: number) => Promise<void>;
  onFileChange: (id: number, file: File) => void;
}) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const esVencida =
    tarea.fecha_limite && new Date(tarea.fecha_limite) < hoy && tarea.estado !== "Completado";

  const prioColor: Record<Prioridad, string> = {
    Alta: "bg-red-500/10 text-red-500 border-red-500/20",
    Media: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Baja: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  return (
    <div
      className={`rounded-2xl p-6 border transition-all ${
        esVencida ? "bg-red-900/10 border-red-500/40" : "bg-white/[0.02] border-white/10"
      }`}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[9px] font-bold px-2 py-1 rounded border ${prioColor[tarea.prioridad]}`}>
              {tarea.prioridad.toUpperCase()}
            </span>
            {esVencida && (
              <span className="text-[9px] text-red-500 font-black flex items-center gap-1 animate-pulse uppercase">
                <AlertCircle size={10} /> Sistema vencido
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold tracking-tight">{tarea.nombre}</h3>
          <div className="flex flex-wrap gap-4 text-[10px] text-gray-500 mt-2 font-mono uppercase">
            <span>Empleado: {tarea.empleado}</span>
            <span className="text-cyan-600">Empresa: {tarea.empresa}</span>
            <span>Fecha limite: {tarea.fecha_limite || "N/A"}</span>
            {Number(tarea.monto || 0) > 0 && (
              <span className="text-green-500">
                Monto: {(tarea.moneda || "GTQ") === "USD" ? "$" : "Q"}
                {Number(tarea.monto).toFixed(2)}
              </span>
            )}
            {tarea.categoria && <span className="text-purple-500">Categoria: {tarea.categoria}</span>}
            {tarea.archivo && (
              <span className="text-cyan-500">Evidencia privada registrada</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 items-end w-full md:w-auto">
          {tarea.estado === "Pendiente" ? (
            <div className="flex flex-col gap-2 w-full">
              <input
                type="file"
                className="text-[10px] text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-[10px] file:bg-white/10 file:text-white disabled:opacity-50"
                onChange={(e) => e.target.files?.[0] && onFileChange(tarea.id, e.target.files[0])}
                disabled={isProcessing || !puedeCompletar}
                accept="application/pdf,image/png,image/jpeg"
              />
              <button
                type="button"
                onClick={() => onCompletar(tarea.id)}
                disabled={isProcessing || !puedeCompletar}
                className={`bg-green-500 text-black px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isProcessing ? "opacity-50" : "hover:bg-green-400"
                }`}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                Confirmar ejecucion
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-green-500/5">
              <CheckCircle2 size={12} /> Operacion exitosa
            </div>
          )}

          {puedeCancelar && (
            <button
              type="button"
              onClick={() => onCancelar(tarea.id)}
              disabled={isProcessing}
              className="text-gray-600 hover:text-red-500 transition-colors disabled:opacity-50"
              title="Cancelar tarea"
              aria-label="Cancelar tarea"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
