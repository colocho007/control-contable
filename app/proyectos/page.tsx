"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { registrarAuditoriaEvento, type RegistrarAuditoriaEventoParams } from "../../lib/auditoria";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

type Tab = "resumen" | "proyectos" | "presupuestos" | "movimientos" | "proximamente";
type Moneda = "GTQ" | "USD";

interface Empresa {
  id: number;
  nombre: string;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

interface Proyecto {
  id: string;
  empresa_id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  presupuesto: number;
  moneda: string;
  activo: boolean;
  observaciones: string | null;
  creado_at: string;
}

interface Presupuesto {
  id: string;
  empresa_id: number;
  proyecto_id: string;
  categoria: string;
  descripcion: string | null;
  monto_presupuestado: number;
  monto_comprometido: number;
  monto_ejecutado: number;
  moneda: string;
  estado: string;
  creado_at: string;
}

interface Movimiento {
  id: string;
  empresa_id: number;
  proyecto_id: string;
  modulo_origen: string | null;
  entidad_origen_texto: string | null;
  tipo_movimiento: string;
  descripcion: string;
  monto: number;
  moneda: string;
  fecha_movimiento: string;
  estado: string;
  observaciones: string | null;
  creado_at: string;
}

const TIPOS = ["Proyecto", "Centro de costo", "Obra", "Departamento", "Unidad", "Otro"] as const;
const ESTADOS_PROYECTO = ["Activo", "En pausa", "Cerrado", "Cancelado"] as const;
const ESTADOS_MOVIMIENTO = ["Registrado", "Anulado"] as const;
const MONEDAS: Moneda[] = ["GTQ", "USD"];
const ROLES_ESCRITURA = ["admin", "supervisor", "jefe"];
const FUNCIONES_ESCRITURA = ["auxiliar_contable", "contador_revisor"] as const;

const COLUMNAS_PROYECTOS =
  "id,empresa_id,codigo,nombre,descripcion,tipo,estado,fecha_inicio,fecha_fin_estimada,presupuesto,moneda,activo,observaciones,creado_at";
const COLUMNAS_PRESUPUESTOS =
  "id,empresa_id,proyecto_id,categoria,descripcion,monto_presupuestado,monto_comprometido,monto_ejecutado,moneda,estado,creado_at";
const COLUMNAS_MOVIMIENTOS =
  "id,empresa_id,proyecto_id,modulo_origen,entidad_origen_texto,tipo_movimiento,descripcion,monto,moneda,fecha_movimiento,estado,observaciones,creado_at";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function textoOpcional(valor: string) {
  return valor.trim() || null;
}

function numeroNoNegativo(valor: string, campo: string) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) throw new Error(`${campo} debe ser un numero no negativo.`);
  return Math.round(numero * 100) / 100;
}

function validarMoneda(valor: string): Moneda {
  if (!MONEDAS.includes(valor as Moneda)) throw new Error("La moneda debe ser GTQ o USD.");
  return valor as Moneda;
}

function validarFecha(valor: string, campo: string) {
  if (!valor || Number.isNaN(new Date(`${valor}T00:00:00`).getTime())) {
    throw new Error(`${campo} debe ser una fecha valida.`);
  }
  return valor;
}

function formatoMonto(valor: number | null | undefined, moneda: string) {
  return `${moneda} ${Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mostrarFecha(valor?: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString("es-GT");
}

function errorSeguro(error: unknown) {
  const texto = error instanceof Error ? error.message.toLowerCase() : "";
  if (texto.includes("obligatori") || texto.includes("debe ") || texto.includes("selecciona")) {
    return error instanceof Error ? error.message : "Revise los datos obligatorios.";
  }
  if (texto.includes("duplicate") || texto.includes("unique") || texto.includes("23505")) {
    return "Ya existe un registro con esos datos.";
  }
  if (texto.includes("row-level security") || texto.includes("permission") || texto.includes("42501")) {
    return "No tiene permisos para realizar esta accion o la empresa no esta autorizada.";
  }
  return "No se pudo completar la operacion. Revise los datos e intente nuevamente.";
}

function formProyectoInicial(empresaId = "") {
  return {
    empresaId,
    codigo: "",
    nombre: "",
    descripcion: "",
    tipo: "Proyecto",
    estado: "Activo",
    fechaInicio: "",
    fechaFinEstimada: "",
    presupuesto: "0",
    moneda: "GTQ",
    observaciones: "",
  };
}

function formPresupuestoInicial(empresaId = "") {
  return {
    empresaId,
    proyectoId: "",
    categoria: "",
    descripcion: "",
    montoPresupuestado: "0",
    montoComprometido: "0",
    montoEjecutado: "0",
    moneda: "GTQ",
    estado: "Activo",
  };
}

function formMovimientoInicial(empresaId = "") {
  return {
    empresaId,
    proyectoId: "",
    moduloOrigen: "",
    entidadOrigenTexto: "",
    tipoMovimiento: "",
    descripcion: "",
    monto: "0",
    moneda: "GTQ",
    fechaMovimiento: hoyISO(),
    estado: "Registrado",
    observaciones: "",
  };
}

export default function ProyectosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasIds, setEmpresasIds] = useState<number[]>([]);
  const [funciones, setFunciones] = useState<UsuarioFuncionOperativa[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [formProyecto, setFormProyecto] = useState(formProyectoInicial());
  const [formPresupuesto, setFormPresupuesto] = useState(formPresupuestoInicial());
  const [formMovimiento, setFormMovimiento] = useState(formMovimientoInicial());

  useEffect(() => {
    let activo = true;
    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("proyectos");
        if (!activo) return;
        if (!acceso.ok) {
          if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
            router.replace("/login");
            return;
          }
          setMensajeBloqueo("No tienes acceso al modulo Proyectos.");
          setValidandoAcceso(false);
          return;
        }

        const user = acceso.user!;
        const perfilActual = acceso.perfil as Perfil;
        const permitidas = await obtenerEmpresasPermitidas(user.id, perfilActual.rol || "");
        const operativas = await obtenerEmpresasOperativasDesdeIds(permitidas);
        const funcionesUsuario = await listarFuncionesOperativasUsuario(user.id, operativas.ids);
        if (!activo) return;

        const rol = normalizarRol(perfilActual.rol);
        const empresasEscrituraIds = operativas.ids.filter(
          (empresaId) =>
            !esAuditorSoloLecturaLocal(funcionesUsuario, [empresaId]) &&
            (ROLES_ESCRITURA.includes(rol) ||
              tieneFuncionOperativaLocal(
                funcionesUsuario,
                user.id,
                empresaId,
                [...FUNCIONES_ESCRITURA]
              ))
        );
        const empresaInicial = empresasEscrituraIds.length ? String(empresasEscrituraIds[0]) : "";
        setUserId(user.id);
        setPerfil(perfilActual);
        setEmpresas(operativas.empresas);
        setEmpresasIds(operativas.ids);
        setFunciones(funcionesUsuario);
        setFormProyecto(formProyectoInicial(empresaInicial));
        setFormPresupuesto(formPresupuestoInicial(empresaInicial));
        setFormMovimiento(formMovimientoInicial(empresaInicial));
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!operativas.ids.length) {
          setAviso("No tienes empresas operativas asignadas para consultar proyectos.");
          return;
        }
        await cargarDatos(operativas.ids);
      } catch (error) {
        console.error("Error cargando Proyectos:", error);
        if (activo) {
          setErrorCarga("No se pudo cargar la pantalla de Proyectos.");
          setValidandoAcceso(false);
        }
      }
    }
    void iniciar();
    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarDatos(ids = empresasIds) {
    const validos = ids.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!validos.length) return;
    setCargando(true);
    setErrorCarga(null);
    try {
      const [resProyectos, resPresupuestos, resMovimientos] = await Promise.all([
        supabase.from("proyectos_centros_costo").select(COLUMNAS_PROYECTOS).in("empresa_id", validos).order("creado_at", { ascending: false }),
        supabase.from("proyectos_presupuestos").select(COLUMNAS_PRESUPUESTOS).in("empresa_id", validos).order("creado_at", { ascending: false }),
        supabase.from("proyectos_movimientos").select(COLUMNAS_MOVIMIENTOS).in("empresa_id", validos).order("fecha_movimiento", { ascending: false }),
      ]);
      if (resProyectos.error || resPresupuestos.error || resMovimientos.error) {
        console.error("Error consultando proyectos:", resProyectos.error || resPresupuestos.error || resMovimientos.error);
        throw new Error("No se pudieron cargar los datos de proyectos.");
      }
      setProyectos((resProyectos.data || []) as Proyecto[]);
      setPresupuestos((resPresupuestos.data || []) as Presupuesto[]);
      setMovimientos((resMovimientos.data || []) as Movimiento[]);
    } catch (error) {
      console.error("Error cargando datos de proyectos:", error);
      setErrorCarga("No se pudieron consultar los proyectos, presupuestos y movimientos.");
    } finally {
      setCargando(false);
    }
  }

  function validarEmpresa(valor: string | number) {
    const empresaId = Number(valor);
    if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error("Selecciona una empresa valida.");
    if (!empresasIds.includes(empresaId)) throw new Error("La empresa no esta dentro de tus empresas permitidas y operativas.");
    return empresaId;
  }

  function esAuditor(empresaId?: string | number | null) {
    return esAuditorSoloLecturaLocal(funciones, empresaId ? [empresaId] : empresasIds);
  }

  function puedeEscribir(empresaId?: string | number | null) {
    if (!empresaId || !userId || esAuditor(empresaId)) return false;
    return (
      ROLES_ESCRITURA.includes(normalizarRol(perfil?.rol)) ||
      tieneFuncionOperativaLocal(funciones, userId, empresaId, [...FUNCIONES_ESCRITURA])
    );
  }

  function proyectoDeEmpresa(proyectoId: string, empresaId: number) {
    const proyecto = proyectos.find((item) => item.id === proyectoId && Number(item.empresa_id) === empresaId);
    if (!proyecto) throw new Error("El proyecto debe pertenecer a la misma empresa.");
    return proyecto;
  }

  async function auditar(params: RegistrarAuditoriaEventoParams) {
    try {
      await registrarAuditoriaEvento(params);
      return true;
    } catch (error) {
      console.warn("No se pudo registrar auditoria de Proyectos:", error);
      setAviso("El registro se guardo, pero no se pudo registrar la auditoria central.");
      return false;
    }
  }

  function limpiarMensajes() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);
  }

  async function guardarProyecto() {
    limpiarMensajes();
    if (!userId) return setErrorCarga("Sesion no valida.");
    try {
      const empresaId = validarEmpresa(formProyecto.empresaId);
      if (!puedeEscribir(empresaId)) return setErrorCarga("No tiene funcion operativa para modificar proyectos o centros de costo.");
      if (!formProyecto.nombre.trim()) throw new Error("El nombre es obligatorio.");
      if (!TIPOS.includes(formProyecto.tipo as (typeof TIPOS)[number])) throw new Error("El tipo seleccionado no es valido.");
      if (!ESTADOS_PROYECTO.includes(formProyecto.estado as (typeof ESTADOS_PROYECTO)[number])) throw new Error("El estado seleccionado no es valido.");
      if (formProyecto.fechaInicio && formProyecto.fechaFinEstimada && formProyecto.fechaFinEstimada < formProyecto.fechaInicio) {
        throw new Error("La fecha fin estimada no puede ser anterior a la fecha inicio.");
      }
      const payload = {
        empresa_id: empresaId,
        codigo: textoOpcional(formProyecto.codigo),
        nombre: formProyecto.nombre.trim(),
        descripcion: textoOpcional(formProyecto.descripcion),
        tipo: formProyecto.tipo,
        estado: formProyecto.estado,
        fecha_inicio: textoOpcional(formProyecto.fechaInicio),
        fecha_fin_estimada: textoOpcional(formProyecto.fechaFinEstimada),
        presupuesto: numeroNoNegativo(formProyecto.presupuesto, "Presupuesto"),
        moneda: validarMoneda(formProyecto.moneda),
        observaciones: textoOpcional(formProyecto.observaciones),
        creado_por: userId,
      };
      setProcesando(true);
      const { data, error } = await supabase.from("proyectos_centros_costo").insert(payload).select(COLUMNAS_PROYECTOS).single();
      if (error || !data) {
        console.error("Error creando proyecto:", error);
        throw new Error("No se pudo guardar el proyecto.");
      }
      const registro = data as Proyecto;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "proyectos",
        accion: "crear_proyecto_centro_costo",
        entidad_tipo: "proyectos_centros_costo",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Proyecto o centro de costo creado: ${registro.nombre}`,
        metadatos: { empresa_id: empresaId, proyecto_id: registro.id, codigo: registro.codigo, nombre: registro.nombre, tipo: registro.tipo, estado: registro.estado, presupuesto: Number(registro.presupuesto), moneda: registro.moneda },
        origen: "app_proyectos",
      });
      setFormProyecto(formProyectoInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Proyecto o centro de costo registrado." : "Proyecto registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando proyecto:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarPresupuesto() {
    limpiarMensajes();
    if (!userId) return setErrorCarga("Sesion no valida.");
    try {
      const empresaId = validarEmpresa(formPresupuesto.empresaId);
      if (!puedeEscribir(empresaId)) return setErrorCarga("No tiene funcion operativa para modificar proyectos o centros de costo.");
      const proyecto = proyectoDeEmpresa(formPresupuesto.proyectoId, empresaId);
      if (!formPresupuesto.categoria.trim()) throw new Error("La categoria es obligatoria.");
      if (!ESTADOS_PROYECTO.includes(formPresupuesto.estado as (typeof ESTADOS_PROYECTO)[number])) throw new Error("El estado seleccionado no es valido.");
      const payload = {
        empresa_id: empresaId,
        proyecto_id: proyecto.id,
        categoria: formPresupuesto.categoria.trim(),
        descripcion: textoOpcional(formPresupuesto.descripcion),
        monto_presupuestado: numeroNoNegativo(formPresupuesto.montoPresupuestado, "Monto presupuestado"),
        monto_comprometido: numeroNoNegativo(formPresupuesto.montoComprometido, "Monto comprometido"),
        monto_ejecutado: numeroNoNegativo(formPresupuesto.montoEjecutado, "Monto ejecutado"),
        moneda: validarMoneda(formPresupuesto.moneda),
        estado: formPresupuesto.estado,
        creado_por: userId,
      };
      setProcesando(true);
      const { data, error } = await supabase.from("proyectos_presupuestos").insert(payload).select(COLUMNAS_PRESUPUESTOS).single();
      if (error || !data) {
        console.error("Error creando presupuesto de proyecto:", error);
        throw new Error("No se pudo guardar el presupuesto.");
      }
      const registro = data as Presupuesto;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "proyectos",
        accion: "crear_presupuesto_proyecto",
        entidad_tipo: "proyectos_presupuestos",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Presupuesto creado para ${proyecto.nombre}`,
        metadatos: { empresa_id: empresaId, proyecto_id: proyecto.id, categoria: registro.categoria, monto_presupuestado: Number(registro.monto_presupuestado), monto_comprometido: Number(registro.monto_comprometido), monto_ejecutado: Number(registro.monto_ejecutado), moneda: registro.moneda, estado: registro.estado },
        origen: "app_proyectos",
      });
      setFormPresupuesto(formPresupuestoInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Presupuesto registrado." : "Presupuesto registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando presupuesto:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarMovimiento() {
    limpiarMensajes();
    if (!userId) return setErrorCarga("Sesion no valida.");
    try {
      const empresaId = validarEmpresa(formMovimiento.empresaId);
      if (!puedeEscribir(empresaId)) return setErrorCarga("No tiene funcion operativa para modificar proyectos o centros de costo.");
      const proyecto = proyectoDeEmpresa(formMovimiento.proyectoId, empresaId);
      if (!formMovimiento.tipoMovimiento.trim()) throw new Error("El tipo de movimiento es obligatorio.");
      if (!formMovimiento.descripcion.trim()) throw new Error("La descripcion es obligatoria.");
      if (!ESTADOS_MOVIMIENTO.includes(formMovimiento.estado as (typeof ESTADOS_MOVIMIENTO)[number])) throw new Error("El estado seleccionado no es valido.");
      const payload = {
        empresa_id: empresaId,
        proyecto_id: proyecto.id,
        modulo_origen: textoOpcional(formMovimiento.moduloOrigen),
        entidad_origen_texto: textoOpcional(formMovimiento.entidadOrigenTexto),
        tipo_movimiento: formMovimiento.tipoMovimiento.trim(),
        descripcion: formMovimiento.descripcion.trim(),
        monto: numeroNoNegativo(formMovimiento.monto, "Monto"),
        moneda: validarMoneda(formMovimiento.moneda),
        fecha_movimiento: validarFecha(formMovimiento.fechaMovimiento, "Fecha del movimiento"),
        estado: formMovimiento.estado,
        observaciones: textoOpcional(formMovimiento.observaciones),
        creado_por: userId,
      };
      setProcesando(true);
      const { data, error } = await supabase.from("proyectos_movimientos").insert(payload).select(COLUMNAS_MOVIMIENTOS).single();
      if (error || !data) {
        console.error("Error creando movimiento de proyecto:", error);
        throw new Error("No se pudo guardar el movimiento.");
      }
      const registro = data as Movimiento;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "proyectos",
        accion: "crear_movimiento_proyecto",
        entidad_tipo: "proyectos_movimientos",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Movimiento manual creado para ${proyecto.nombre}`,
        metadatos: { empresa_id: empresaId, proyecto_id: proyecto.id, tipo_movimiento: registro.tipo_movimiento, monto: Number(registro.monto), moneda: registro.moneda, fecha_movimiento: registro.fecha_movimiento, estado: registro.estado },
        origen: "app_proyectos",
      });
      setFormMovimiento(formMovimientoInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Movimiento registrado." : "Movimiento registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando movimiento:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  const empresasPorId = useMemo(() => new Map(empresas.map((item) => [Number(item.id), item.nombre])), [empresas]);
  const proyectosPorId = useMemo(() => new Map(proyectos.map((item) => [item.id, item.nombre])), [proyectos]);
  const auditorSoloLectura = esAuditor();
  const empresasEscritura = empresas.filter((empresa) => puedeEscribir(empresa.id));
  const puedeEscribirAlguna = empresasEscritura.length > 0;
  const resumen = useMemo(() => ({
    activos: proyectos.filter((item) => item.activo && item.estado === "Activo" && item.tipo === "Proyecto").length,
    centros: proyectos.filter((item) => item.activo && item.tipo === "Centro de costo").length,
    pausados: proyectos.filter((item) => item.estado === "En pausa").length,
    cerrados: proyectos.filter((item) => item.estado === "Cerrado").length,
    monedas: MONEDAS.map((moneda) => ({
      moneda,
      presupuestado: presupuestos.filter((item) => item.moneda === moneda).reduce((total, item) => total + Number(item.monto_presupuestado || 0), 0),
      comprometido: presupuestos.filter((item) => item.moneda === moneda).reduce((total, item) => total + Number(item.monto_comprometido || 0), 0),
      ejecutado: presupuestos.filter((item) => item.moneda === moneda).reduce((total, item) => total + Number(item.monto_ejecutado || 0), 0),
    })),
  }), [presupuestos, proyectos]);

  if (validandoAcceso) return <EstadoCentro>Validando acceso...</EstadoCentro>;
  if (!autorizado) return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este modulo."}</EstadoCentro>;

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div><div className="flex flex-wrap items-center gap-3"><Building2 className="text-cyan-500" size={42} /><h1 className="text-4xl font-black md:text-5xl">Proyectos / centros de costo</h1><Etiqueta>Base operativa</Etiqueta></div><p className="mt-3 max-w-3xl text-[var(--muted)]">Registro manual de proyectos, presupuestos y movimientos por empresa.</p></div>
            <button type="button" onClick={() => cargarDatos()} disabled={cargando || !empresasIds.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-200 disabled:opacity-50">{cargando ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}Actualizar</button>
          </header>

          <Aviso tono="cyan"><ShieldCheck size={19} />Proyectos y centros de costo esta en fase base operativa. Permite registrar proyectos, presupuestos y movimientos manuales. La conexion con cheques, planilla, CxP/CxC, contabilidad y reportes se realizara en fases posteriores.</Aviso>
          {auditorSoloLectura && <Aviso tono="amarillo">Auditor solo lectura: en las empresas asignadas con esa funcion puede consultar, pero no crear ni modificar registros.</Aviso>}
          {!auditorSoloLectura && !puedeEscribirAlguna && <Aviso tono="amarillo">No tiene funcion operativa para modificar proyectos o centros de costo.</Aviso>}
          {aviso && <Aviso tono="amarillo">{aviso}</Aviso>}
          {errorCarga && <Aviso tono="rojo">{errorCarga}</Aviso>}
          {exito && <Aviso tono="verde">{exito}</Aviso>}

          <nav className="flex flex-wrap gap-2">{([
            ["resumen", "Resumen"], ["proyectos", "Proyectos / centros de costo"], ["presupuestos", "Presupuestos"], ["movimientos", "Movimientos"], ["proximamente", "Fase posterior"],
          ] as Array<[Tab, string]>).map(([clave, label]) => <button key={clave} type="button" onClick={() => setTab(clave)} className={`rounded-xl px-4 py-3 text-sm font-black ${tab === clave ? "bg-cyan-500 text-black" : "border border-[var(--card-border)] bg-[var(--card)] text-[var(--muted-strong)]"}`}>{label}</button>)}</nav>

          {tab === "resumen" && <ResumenPanel resumen={resumen} movimientos={movimientos.length} />}
          {tab === "proyectos" && <><Panel titulo="Proyectos / centros de costo" subtitulo="Catalogo operativo por empresa."><TablaProyectos proyectos={proyectos} empresasPorId={empresasPorId} /></Panel>{puedeEscribirAlguna && !auditorSoloLectura && <FormProyecto form={formProyecto} setForm={setFormProyecto} empresas={empresasEscritura} guardando={procesando} guardar={guardarProyecto} />}</>}
          {tab === "presupuestos" && <><Panel titulo="Presupuestos" subtitulo="Presupuesto, comprometido y ejecutado sin afectar saldos reales."><TablaPresupuestos presupuestos={presupuestos} empresasPorId={empresasPorId} proyectosPorId={proyectosPorId} /></Panel>{puedeEscribirAlguna && !auditorSoloLectura && <FormPresupuesto form={formPresupuesto} setForm={setFormPresupuesto} empresas={empresasEscritura} proyectos={proyectos} guardando={procesando} guardar={guardarPresupuesto} />}</>}
          {tab === "movimientos" && <><Panel titulo="Movimientos" subtitulo="Movimientos manuales sin generar pagos ni asientos contables."><TablaMovimientos movimientos={movimientos} empresasPorId={empresasPorId} proyectosPorId={proyectosPorId} /></Panel>{puedeEscribirAlguna && !auditorSoloLectura && <FormMovimiento form={formMovimiento} setForm={setFormMovimiento} empresas={empresasEscritura} proyectos={proyectos} guardando={procesando} guardar={guardarMovimiento} />}</>}
          {tab === "proximamente" && <Panel titulo="Fase posterior" subtitulo="Integraciones no incluidas en el alcance operativo inicial."><p className="text-sm text-[var(--muted)]">Las integraciones con otros flujos permaneceran fuera de la presentacion hasta contar con validacion operativa.</p></Panel>}
        </div>
      </main>
    </div>
  );
}

function ResumenPanel({ resumen, movimientos }: { resumen: { activos: number; centros: number; pausados: number; cerrados: number; monedas: Array<{ moneda: string; presupuestado: number; comprometido: number; ejecutado: number }> }; movimientos: number }) {
  return <Panel titulo="Resumen" subtitulo="Totales separados por moneda."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Tarjeta titulo="Proyectos activos" valor={String(resumen.activos)} icono={<Building2 />} /><Tarjeta titulo="Centros de costo activos" valor={String(resumen.centros)} icono={<ClipboardList />} /><Tarjeta titulo="Movimientos registrados" valor={String(movimientos)} icono={<BarChart3 />} /><Tarjeta titulo="Pausados / cerrados" valor={`${resumen.pausados} / ${resumen.cerrados}`} icono={<WalletCards />} />{resumen.monedas.flatMap((item) => [<Tarjeta key={`${item.moneda}-p`} titulo={`Presupuesto ${item.moneda}`} valor={formatoMonto(item.presupuestado, item.moneda)} icono={<WalletCards />} />, <Tarjeta key={`${item.moneda}-c`} titulo={`Comprometido ${item.moneda}`} valor={formatoMonto(item.comprometido, item.moneda)} icono={<WalletCards />} />, <Tarjeta key={`${item.moneda}-e`} titulo={`Ejecutado ${item.moneda}`} valor={formatoMonto(item.ejecutado, item.moneda)} icono={<WalletCards />} />])}</div></Panel>;
}

function FormProyecto({ form, setForm, empresas, guardando, guardar }: { form: ReturnType<typeof formProyectoInicial>; setForm: (form: ReturnType<typeof formProyectoInicial>) => void; empresas: Empresa[]; guardando: boolean; guardar: () => void }) {
  return <Formulario titulo="Crear proyecto / centro de costo"><Campos><SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} /><Input value={form.codigo} onChange={(codigo) => setForm({ ...form, codigo })} placeholder="Codigo opcional" /><Input value={form.nombre} onChange={(nombre) => setForm({ ...form, nombre })} placeholder="Nombre obligatorio" /><Input value={form.descripcion} onChange={(descripcion) => setForm({ ...form, descripcion })} placeholder="Descripcion" /><Select value={form.tipo} opciones={[...TIPOS]} onChange={(tipo) => setForm({ ...form, tipo })} /><Select value={form.estado} opciones={[...ESTADOS_PROYECTO]} onChange={(estado) => setForm({ ...form, estado })} /><Input type="date" value={form.fechaInicio} onChange={(fechaInicio) => setForm({ ...form, fechaInicio })} /><Input type="date" value={form.fechaFinEstimada} onChange={(fechaFinEstimada) => setForm({ ...form, fechaFinEstimada })} /><Input type="number" value={form.presupuesto} onChange={(presupuesto) => setForm({ ...form, presupuesto })} placeholder="Presupuesto" /><Select value={form.moneda} opciones={MONEDAS} onChange={(moneda) => setForm({ ...form, moneda })} /><Input value={form.observaciones} onChange={(observaciones) => setForm({ ...form, observaciones })} placeholder="Observaciones" /></Campos><BotonGuardar guardando={guardando} onClick={guardar} label="Crear proyecto / centro de costo" /></Formulario>;
}

function FormPresupuesto({ form, setForm, empresas, proyectos, guardando, guardar }: { form: ReturnType<typeof formPresupuestoInicial>; setForm: (form: ReturnType<typeof formPresupuestoInicial>) => void; empresas: Empresa[]; proyectos: Proyecto[]; guardando: boolean; guardar: () => void }) {
  const disponibles = proyectos.filter((item) => Number(item.empresa_id) === Number(form.empresaId));
  return <Formulario titulo="Crear presupuesto"><Campos><SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, proyectoId: "" })} /><SelectProyecto value={form.proyectoId} proyectos={disponibles} onChange={(proyectoId) => setForm({ ...form, proyectoId })} /><Input value={form.categoria} onChange={(categoria) => setForm({ ...form, categoria })} placeholder="Categoria obligatoria" /><Input value={form.descripcion} onChange={(descripcion) => setForm({ ...form, descripcion })} placeholder="Descripcion" /><Input type="number" value={form.montoPresupuestado} onChange={(montoPresupuestado) => setForm({ ...form, montoPresupuestado })} placeholder="Monto presupuestado" /><Input type="number" value={form.montoComprometido} onChange={(montoComprometido) => setForm({ ...form, montoComprometido })} placeholder="Monto comprometido" /><Input type="number" value={form.montoEjecutado} onChange={(montoEjecutado) => setForm({ ...form, montoEjecutado })} placeholder="Monto ejecutado" /><Select value={form.moneda} opciones={MONEDAS} onChange={(moneda) => setForm({ ...form, moneda })} /><Select value={form.estado} opciones={[...ESTADOS_PROYECTO]} onChange={(estado) => setForm({ ...form, estado })} /></Campos><BotonGuardar guardando={guardando} onClick={guardar} label="Crear presupuesto" /></Formulario>;
}

function FormMovimiento({ form, setForm, empresas, proyectos, guardando, guardar }: { form: ReturnType<typeof formMovimientoInicial>; setForm: (form: ReturnType<typeof formMovimientoInicial>) => void; empresas: Empresa[]; proyectos: Proyecto[]; guardando: boolean; guardar: () => void }) {
  const disponibles = proyectos.filter((item) => Number(item.empresa_id) === Number(form.empresaId));
  return <Formulario titulo="Crear movimiento manual"><Campos><SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, proyectoId: "" })} /><SelectProyecto value={form.proyectoId} proyectos={disponibles} onChange={(proyectoId) => setForm({ ...form, proyectoId })} /><Input value={form.moduloOrigen} onChange={(moduloOrigen) => setForm({ ...form, moduloOrigen })} placeholder="Modulo origen opcional" /><Input value={form.entidadOrigenTexto} onChange={(entidadOrigenTexto) => setForm({ ...form, entidadOrigenTexto })} placeholder="Referencia origen opcional" /><Input value={form.tipoMovimiento} onChange={(tipoMovimiento) => setForm({ ...form, tipoMovimiento })} placeholder="Tipo de movimiento obligatorio" /><Input value={form.descripcion} onChange={(descripcion) => setForm({ ...form, descripcion })} placeholder="Descripcion obligatoria" /><Input type="number" value={form.monto} onChange={(monto) => setForm({ ...form, monto })} placeholder="Monto" /><Select value={form.moneda} opciones={MONEDAS} onChange={(moneda) => setForm({ ...form, moneda })} /><Input type="date" value={form.fechaMovimiento} onChange={(fechaMovimiento) => setForm({ ...form, fechaMovimiento })} /><Select value={form.estado} opciones={[...ESTADOS_MOVIMIENTO]} onChange={(estado) => setForm({ ...form, estado })} /><Input value={form.observaciones} onChange={(observaciones) => setForm({ ...form, observaciones })} placeholder="Observaciones" /></Campos><BotonGuardar guardando={guardando} onClick={guardar} label="Crear movimiento" /></Formulario>;
}

function TablaProyectos({ proyectos, empresasPorId }: { proyectos: Proyecto[]; empresasPorId: Map<number, string> }) {
  if (!proyectos.length) return <EmptyState texto="No hay proyectos registrados todavia." />;
  return <Tabla cabeceras={["Empresa", "Codigo / nombre", "Tipo", "Estado", "Presupuesto", "Fechas"]}>{proyectos.map((item) => <tr key={item.id}><Celda>{empresasPorId.get(Number(item.empresa_id)) || `Empresa ${item.empresa_id}`}</Celda><Celda>{item.codigo || "-"} / {item.nombre}</Celda><Celda>{item.tipo}</Celda><Celda>{item.estado}</Celda><Celda>{formatoMonto(item.presupuesto, item.moneda)}</Celda><Celda>{mostrarFecha(item.fecha_inicio)} - {mostrarFecha(item.fecha_fin_estimada)}</Celda></tr>)}</Tabla>;
}

function TablaPresupuestos({ presupuestos, empresasPorId, proyectosPorId }: { presupuestos: Presupuesto[]; empresasPorId: Map<number, string>; proyectosPorId: Map<string, string> }) {
  if (!presupuestos.length) return <EmptyState texto="No hay presupuestos registrados todavia." />;
  return <Tabla cabeceras={["Empresa", "Proyecto", "Categoria", "Presupuestado", "Comprometido", "Ejecutado", "Estado"]}>{presupuestos.map((item) => <tr key={item.id}><Celda>{empresasPorId.get(Number(item.empresa_id)) || `Empresa ${item.empresa_id}`}</Celda><Celda>{proyectosPorId.get(item.proyecto_id) || item.proyecto_id}</Celda><Celda>{item.categoria}</Celda><Celda>{formatoMonto(item.monto_presupuestado, item.moneda)}</Celda><Celda>{formatoMonto(item.monto_comprometido, item.moneda)}</Celda><Celda>{formatoMonto(item.monto_ejecutado, item.moneda)}</Celda><Celda>{item.estado}</Celda></tr>)}</Tabla>;
}

function TablaMovimientos({ movimientos, empresasPorId, proyectosPorId }: { movimientos: Movimiento[]; empresasPorId: Map<number, string>; proyectosPorId: Map<string, string> }) {
  if (!movimientos.length) return <EmptyState texto="No hay movimientos registrados todavia." />;
  return <Tabla cabeceras={["Fecha", "Empresa", "Proyecto", "Tipo", "Descripcion", "Monto", "Estado"]}>{movimientos.map((item) => <tr key={item.id}><Celda>{mostrarFecha(item.fecha_movimiento)}</Celda><Celda>{empresasPorId.get(Number(item.empresa_id)) || `Empresa ${item.empresa_id}`}</Celda><Celda>{proyectosPorId.get(item.proyecto_id) || item.proyecto_id}</Celda><Celda>{item.tipo_movimiento}</Celda><Celda>{item.descripcion}</Celda><Celda>{formatoMonto(item.monto, item.moneda)}</Celda><Celda>{item.estado}</Celda></tr>)}</Tabla>;
}

function EstadoCentro({ children }: { children: ReactNode }) { return <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">{children}</div>; }
function Etiqueta({ children }: { children: ReactNode }) { return <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">{children}</span>; }
function Aviso({ children, tono }: { children: ReactNode; tono: "cyan" | "amarillo" | "rojo" | "verde" }) { const clases = { cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100", amarillo: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100", rojo: "border-red-400/30 bg-red-400/10 text-red-100", verde: "border-green-400/30 bg-green-400/10 text-green-100" }; return <section className={`flex items-start gap-3 rounded-2xl border p-4 ${clases[tono]}`}>{children}</section>; }
function Panel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) { return <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5"><h2 className="text-xl font-black">{titulo}</h2><p className="mt-1 text-sm text-[var(--muted)]">{subtitulo}</p><div className="mt-5">{children}</div></section>; }
function Tarjeta({ titulo, valor, icono }: { titulo: string; valor: string; icono: ReactNode }) { return <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between text-cyan-400"><p className="text-sm font-semibold text-[var(--muted)]">{titulo}</p>{icono}</div><p className="mt-3 text-2xl font-black">{valor}</p></article>; }
function Formulario({ titulo, children }: { titulo: string; children: ReactNode }) { return <Panel titulo={titulo} subtitulo="Alta manual segura por empresa operativa.">{children}</Panel>; }
function Campos({ children }: { children: ReactNode }) { return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>; }
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rounded-xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3" />; }
function Select({ value, opciones, onChange }: { value: string; opciones: readonly string[]; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3">{opciones.map((item) => <option key={item} value={item}>{item}</option>)}</select>; }
function SelectEmpresa({ value, empresas, onChange }: { value: string; empresas: Empresa[]; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3"><option value="">Seleccionar empresa</option>{empresas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>; }
function SelectProyecto({ value, proyectos, onChange }: { value: string; proyectos: Proyecto[]; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3"><option value="">Seleccionar proyecto / centro</option>{proyectos.map((item) => <option key={item.id} value={item.id}>{item.codigo ? `${item.codigo} - ` : ""}{item.nombre}</option>)}</select>; }
function BotonGuardar({ guardando, onClick, label }: { guardando: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} disabled={guardando} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-black text-black disabled:opacity-50">{guardando ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}{label}</button>; }
function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) { return <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[var(--surface)] text-xs uppercase text-[var(--muted)]"><tr>{cabeceras.map((item) => <th key={item} className="px-4 py-3 text-left">{item}</th>)}</tr></thead><tbody className="divide-y divide-[var(--card-border)]">{children}</tbody></table></div>; }
function Celda({ children }: { children: ReactNode }) { return <td className="px-4 py-4 text-[var(--muted-strong)]">{children}</td>; }
function EmptyState({ texto }: { texto: string }) { return <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{texto}</div>; }
