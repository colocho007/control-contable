"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  Coins,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { registrarAuditoriaEvento, type RegistrarAuditoriaEventoParams } from "../../lib/auditoria";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

type Tab = "resumen" | "empleados" | "periodos" | "tasas" | "descuentos" | "calculo";
type Moneda = "GTQ" | "USD";

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

interface EmpleadoPlanilla {
  id: string;
  empresa_id: number;
  codigo_empleado: string | null;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  nit: string | null;
  igss_numero: string | null;
  fecha_ingreso: string;
  puesto: string | null;
  departamento: string | null;
  salario_base: number;
  bonificacion_incentivo: number;
  moneda: string;
  activo: boolean;
  estado: string;
  observaciones: string | null;
}

interface PeriodoPlanilla {
  id: string;
  empresa_id: number;
  anio: number;
  mes: number;
  tipo_planilla: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_pago: string | null;
  estado: string;
  moneda: string;
  total_devengado: number;
  total_descuentos: number;
  total_neto: number;
  total_igss_laboral: number;
  total_igss_patronal: number;
  total_irtra: number;
  total_intecap: number;
  total_isr: number;
  observaciones: string | null;
}

interface TasaPlanilla {
  id: string;
  empresa_id: number;
  nombre: string;
  tipo: string;
  porcentaje: number;
  aplica_empleado: boolean;
  aplica_patrono: boolean;
  vigente_desde: string;
  vigente_hasta: string | null;
  activo: boolean;
  observaciones: string | null;
}

interface PrestamoDescuento {
  id: string;
  empresa_id: number;
  empleado_id: string;
  tipo: string;
  descripcion: string;
  monto_original: number;
  saldo_pendiente: number;
  cuota_periodo: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  observaciones: string | null;
}

const ROLES_ESCRITURA = ["admin", "supervisor", "jefe"];
const MONEDAS: Moneda[] = ["GTQ", "USD"];
const TIPOS_TASA = ["IGSS_LABORAL", "IGSS_PATRONAL", "IRTRA", "INTECAP", "ISR", "OTRO"];
const TIPOS_DESCUENTO = ["ANTICIPO", "PRESTAMO", "DESCUENTO", "OTRO"];
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const COLUMNAS_EMPLEADOS =
  "id,empresa_id,codigo_empleado,nombres,apellidos,dpi,nit,igss_numero,fecha_ingreso,puesto,departamento,salario_base,bonificacion_incentivo,moneda,activo,estado,observaciones";
const COLUMNAS_PERIODOS =
  "id,empresa_id,anio,mes,tipo_planilla,fecha_inicio,fecha_fin,fecha_pago,estado,moneda,total_devengado,total_descuentos,total_neto,total_igss_laboral,total_igss_patronal,total_irtra,total_intecap,total_isr,observaciones";
const COLUMNAS_TASAS =
  "id,empresa_id,nombre,tipo,porcentaje,aplica_empleado,aplica_patrono,vigente_desde,vigente_hasta,activo,observaciones";
const COLUMNAS_DESCUENTOS =
  "id,empresa_id,empleado_id,tipo,descripcion,monto_original,saldo_pendiente,cuota_periodo,fecha_inicio,fecha_fin,estado,observaciones";

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function textoOpcional(valor: string) {
  const texto = valor.trim();
  return texto ? texto : null;
}

function numeroNoNegativo(valor: string, campo: string) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${campo} debe ser un numero no negativo.`);
  }
  return Math.round(numero * 100) / 100;
}

function fechaMostrar(valor?: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function monto(valor?: number | null, moneda = "GTQ") {
  if (valor === null || valor === undefined) return "-";
  return `${moneda} ${Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function errorSeguro(error: unknown) {
  const texto = [
    error instanceof Error ? error.message : "",
    typeof error === "object" && error && "message" in error ? String(error.message) : "",
    typeof error === "object" && error && "details" in error ? String(error.details) : "",
    typeof error === "object" && error && "code" in error ? String(error.code) : "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    texto.includes("duplicate key") ||
    texto.includes("unique constraint") ||
    texto.includes("23505") ||
    texto.includes("already exists")
  ) {
    return "Ya existe un registro con esos datos. Revise la informacion e intente nuevamente.";
  }
  if (
    texto.includes("foreign key") ||
    texto.includes("violates foreign key constraint") ||
    texto.includes("23503") ||
    texto.includes("not present in table")
  ) {
    return "Uno de los datos relacionados no es valido o no pertenece a la empresa seleccionada.";
  }
  if (
    texto.includes("check constraint") ||
    texto.includes("violates check constraint") ||
    texto.includes("23514")
  ) {
    return "Los datos no cumplen las reglas de validacion. Revise montos, fechas, moneda y estado.";
  }
  if (
    texto.includes("null value") ||
    texto.includes("not-null constraint") ||
    texto.includes("23502")
  ) {
    return "Faltan datos obligatorios para guardar el registro.";
  }
  if (
    texto.includes("row-level security") ||
    texto.includes("permission denied") ||
    texto.includes("insufficient privilege") ||
    texto.includes("42501") ||
    texto.includes("403") ||
    texto.includes("not authorized")
  ) {
    return "No tiene permisos para realizar esta accion o la empresa no esta autorizada.";
  }
  if (texto.includes("invalid input syntax for type uuid") || texto.includes("22p02")) {
    return "Uno de los identificadores seleccionados no es valido.";
  }
  if (
    texto.includes("failed to fetch") ||
    texto.includes("network") ||
    texto.includes("timeout")
  ) {
    return "No se pudo conectar con el servidor. Intente nuevamente.";
  }

  return "No se pudo completar la operacion. Revisa los datos e intenta de nuevo.";
}

function formularioEmpleadoInicial(empresaId = "") {
  return {
    empresaId,
    codigoEmpleado: "",
    nombres: "",
    apellidos: "",
    fechaIngreso: "",
    salarioBase: "0",
    bonificacionIncentivo: "0",
    moneda: "GTQ" as Moneda,
    puesto: "",
    departamento: "",
    dpi: "",
    nit: "",
    igssNumero: "",
    observaciones: "",
  };
}

function formularioPeriodoInicial(empresaId = "") {
  const hoy = new Date();
  return {
    empresaId,
    anio: String(hoy.getFullYear()),
    mes: String(hoy.getMonth() + 1),
    tipoPlanilla: "Mensual",
    fechaInicio: "",
    fechaFin: "",
    fechaPago: "",
    moneda: "GTQ" as Moneda,
    observaciones: "",
  };
}

function formularioTasaInicial(empresaId = "") {
  return {
    empresaId,
    nombre: "",
    tipo: "OTRO",
    porcentaje: "0",
    aplicaEmpleado: false,
    aplicaPatrono: false,
    vigenteDesde: "",
    vigenteHasta: "",
    observaciones: "",
  };
}

function formularioDescuentoInicial(empresaId = "") {
  return {
    empresaId,
    empleadoId: "",
    tipo: "DESCUENTO",
    descripcion: "",
    montoOriginal: "0",
    saldoPendiente: "0",
    cuotaPeriodo: "0",
    fechaInicio: "",
    fechaFin: "",
    observaciones: "",
  };
}

export default function PlanillaPage() {
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
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasOperativasIds, setEmpresasOperativasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoPlanilla[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoPlanilla[]>([]);
  const [tasas, setTasas] = useState<TasaPlanilla[]>([]);
  const [descuentos, setDescuentos] = useState<PrestamoDescuento[]>([]);
  const [formEmpleado, setFormEmpleado] = useState(formularioEmpleadoInicial());
  const [formPeriodo, setFormPeriodo] = useState(formularioPeriodoInicial());
  const [formTasa, setFormTasa] = useState(formularioTasaInicial());
  const [formDescuento, setFormDescuento] = useState(formularioDescuentoInicial());

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        setValidandoAcceso(true);
        const acceso = await validarAccesoModuloUsuario("planilla");
        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );

          if (volverLogin) {
            router.replace("/login");
            return;
          }

          setMensajeBloqueo("No tienes acceso al modulo Planilla.");
          setAutorizado(false);
          setValidandoAcceso(false);
          return;
        }

        const user = acceso.user!;
        const perfil = acceso.perfil as Perfil;
        const idsPermitidos = await obtenerEmpresasPermitidas(user.id, perfil.rol || "");
        const operativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const funciones = await listarFuncionesOperativasUsuario(user.id, operativas.ids);

        if (!activo) return;

        const empresaInicial = operativas.ids.length ? String(operativas.ids[0]) : "";
        setUserId(user.id);
        setPerfilActual(perfil);
        setEmpresas(operativas.empresas);
        setEmpresasOperativasIds(operativas.ids);
        setFuncionesOperativas(funciones);
        setFormEmpleado(formularioEmpleadoInicial(empresaInicial));
        setFormPeriodo(formularioPeriodoInicial(empresaInicial));
        setFormTasa(formularioTasaInicial(empresaInicial));
        setFormDescuento(formularioDescuentoInicial(empresaInicial));
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!operativas.ids.length) {
          setAviso("No tienes empresas operativas asignadas para consultar Planilla.");
          return;
        }

        setCargando(true);
        await cargarDatos(operativas.ids);
      } catch (error) {
        console.error("Error cargando Planilla:", error);
        if (activo) {
          setErrorCarga("No se pudo cargar la pantalla de Planilla.");
          setValidandoAcceso(false);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    void iniciar();
    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarDatos(ids = empresasOperativasIds) {
    const idsValidos = ids.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!idsValidos.length) {
      setEmpleados([]);
      setPeriodos([]);
      setTasas([]);
      setDescuentos([]);
      return;
    }

    const [resEmpleados, resPeriodos, resTasas, resDescuentos] = await Promise.all([
      supabase
        .from("empleados_planilla")
        .select(COLUMNAS_EMPLEADOS)
        .in("empresa_id", idsValidos)
        .order("apellidos", { ascending: true }),
      supabase
        .from("planillas_periodos")
        .select(COLUMNAS_PERIODOS)
        .in("empresa_id", idsValidos)
        .order("anio", { ascending: false })
        .order("mes", { ascending: false }),
      supabase
        .from("planilla_configuracion_tasas")
        .select(COLUMNAS_TASAS)
        .in("empresa_id", idsValidos)
        .order("vigente_desde", { ascending: false }),
      supabase
        .from("planilla_prestamos_descuentos")
        .select(COLUMNAS_DESCUENTOS)
        .in("empresa_id", idsValidos)
        .order("fecha_inicio", { ascending: false, nullsFirst: false }),
    ]);

    if (resEmpleados.error) throw resEmpleados.error;
    if (resPeriodos.error) throw resPeriodos.error;
    if (resTasas.error) throw resTasas.error;
    if (resDescuentos.error) throw resDescuentos.error;

    setEmpleados((resEmpleados.data || []) as EmpleadoPlanilla[]);
    setPeriodos((resPeriodos.data || []) as PeriodoPlanilla[]);
    setTasas((resTasas.data || []) as TasaPlanilla[]);
    setDescuentos((resDescuentos.data || []) as PrestamoDescuento[]);
  }

  function validarEmpresa(valor: string | number) {
    const empresaId = Number(valor);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error("Selecciona una empresa valida.");
    }
    if (!empresasOperativasIds.includes(empresaId)) {
      throw new Error("La empresa no esta dentro de tus empresas permitidas y operativas.");
    }
    return empresaId;
  }

  function esAuditorSoloLectura(empresaId?: string | number | null) {
    return esAuditorSoloLecturaLocal(
      funcionesOperativas,
      empresaId ? [empresaId] : empresasOperativasIds
    );
  }

  function puedeEscribir(empresaId?: string | number | null) {
    if (!empresaId || !userId || esAuditorSoloLectura(empresaId)) return false;
    const rol = normalizarRol(perfilActual?.rol);
    return (
      ROLES_ESCRITURA.includes(rol) ||
      tieneFuncionOperativaLocal(funcionesOperativas, userId, empresaId, [
        "auxiliar_contable",
        "contador_revisor",
      ])
    );
  }

  function puedeEscribirAlgunaEmpresa() {
    return empresasOperativasIds.some((empresaId) => puedeEscribir(empresaId));
  }

  async function auditar(params: RegistrarAuditoriaEventoParams) {
    try {
      await registrarAuditoriaEvento(params);
      return true;
    } catch (error) {
      console.warn("No se pudo registrar auditoria de Planilla:", error);
      setAviso("El registro se guardo, pero no se pudo registrar la auditoria central.");
      return false;
    }
  }

  async function guardarEmpleado() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formEmpleado.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar planilla.");
        return;
      }
      if (!formEmpleado.nombres.trim() || !formEmpleado.apellidos.trim() || !formEmpleado.fechaIngreso) {
        throw new Error("Nombres, apellidos y fecha de ingreso son obligatorios.");
      }

      setProcesando(true);
      const { data: empleadoCreado, error } = await supabase
        .from("empleados_planilla")
        .insert({
          empresa_id: empresaId,
          codigo_empleado: textoOpcional(formEmpleado.codigoEmpleado),
          nombres: formEmpleado.nombres.trim(),
          apellidos: formEmpleado.apellidos.trim(),
          dpi: textoOpcional(formEmpleado.dpi),
          nit: textoOpcional(formEmpleado.nit),
          igss_numero: textoOpcional(formEmpleado.igssNumero),
          fecha_ingreso: formEmpleado.fechaIngreso,
          puesto: textoOpcional(formEmpleado.puesto),
          departamento: textoOpcional(formEmpleado.departamento),
          salario_base: numeroNoNegativo(formEmpleado.salarioBase, "Salario base"),
          bonificacion_incentivo: numeroNoNegativo(
            formEmpleado.bonificacionIncentivo,
            "Bonificacion incentivo"
          ),
          moneda: formEmpleado.moneda,
          observaciones: textoOpcional(formEmpleado.observaciones),
          creado_por: userId,
        })
        .select(COLUMNAS_EMPLEADOS)
        .single();

      if (error || !empleadoCreado) throw error || new Error("No se pudo crear el empleado.");

      await auditar({
        empresa_id: empleadoCreado.empresa_id,
        modulo: "planilla",
        accion: "crear_empleado_planilla",
        entidad_tipo: "empleados_planilla",
        entidad_id: empleadoCreado.id,
        estado_nuevo: empleadoCreado.estado,
        sensible: true,
        origen: "app_planilla",
        metadatos: {
          empresa_id: empleadoCreado.empresa_id,
          empleado_id: empleadoCreado.id,
          codigo_empleado: empleadoCreado.codigo_empleado,
          nombre: `${empleadoCreado.nombres} ${empleadoCreado.apellidos}`.trim(),
          estado: empleadoCreado.estado,
          fecha_ingreso: empleadoCreado.fecha_ingreso,
          salario_base: Number(empleadoCreado.salario_base || 0),
          moneda: empleadoCreado.moneda,
        },
      });

      setFormEmpleado(formularioEmpleadoInicial(String(empresaId)));
      await cargarDatos();
      setExito("Empleado registrado.");
    } catch (error) {
      console.error("Error guardando empleado de planilla:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarPeriodo() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formPeriodo.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar planilla.");
        return;
      }
      if (!formPeriodo.fechaInicio || !formPeriodo.fechaFin || !formPeriodo.tipoPlanilla.trim()) {
        throw new Error("Tipo, fecha inicio y fecha fin son obligatorios.");
      }

      const anio = Number(formPeriodo.anio);
      const mes = Number(formPeriodo.mes);
      if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new Error("Anio no valido.");
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error("Mes no valido.");

      setProcesando(true);
      const { data: periodoCreado, error } = await supabase
        .from("planillas_periodos")
        .insert({
          empresa_id: empresaId,
          anio,
          mes,
          tipo_planilla: formPeriodo.tipoPlanilla.trim(),
          fecha_inicio: formPeriodo.fechaInicio,
          fecha_fin: formPeriodo.fechaFin,
          fecha_pago: textoOpcional(formPeriodo.fechaPago),
          moneda: formPeriodo.moneda,
          observaciones: textoOpcional(formPeriodo.observaciones),
          creado_por: userId,
        })
        .select(COLUMNAS_PERIODOS)
        .single();

      if (error || !periodoCreado) throw error || new Error("No se pudo crear el periodo.");

      await auditar({
        empresa_id: periodoCreado.empresa_id,
        modulo: "planilla",
        accion: "crear_periodo_planilla",
        entidad_tipo: "planillas_periodos",
        entidad_id: periodoCreado.id,
        estado_nuevo: periodoCreado.estado,
        origen: "app_planilla",
        metadatos: {
          empresa_id: periodoCreado.empresa_id,
          periodo_id: periodoCreado.id,
          anio: periodoCreado.anio,
          mes: periodoCreado.mes,
          tipo_periodo: periodoCreado.tipo_planilla,
          estado: periodoCreado.estado,
          fecha_inicio: periodoCreado.fecha_inicio,
          fecha_fin: periodoCreado.fecha_fin,
        },
      });

      setFormPeriodo(formularioPeriodoInicial(String(empresaId)));
      await cargarDatos();
      setExito("Periodo registrado sin calculo automatico.");
    } catch (error) {
      console.error("Error guardando periodo de planilla:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarTasa() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formTasa.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar planilla.");
        return;
      }
      if (!formTasa.nombre.trim() || !formTasa.vigenteDesde) {
        throw new Error("Nombre y vigencia desde son obligatorios.");
      }

      setProcesando(true);
      const { data: tasaCreada, error } = await supabase
        .from("planilla_configuracion_tasas")
        .insert({
          empresa_id: empresaId,
          nombre: formTasa.nombre.trim(),
          tipo: formTasa.tipo,
          porcentaje: numeroNoNegativo(formTasa.porcentaje, "Porcentaje"),
          aplica_empleado: formTasa.aplicaEmpleado,
          aplica_patrono: formTasa.aplicaPatrono,
          vigente_desde: formTasa.vigenteDesde,
          vigente_hasta: textoOpcional(formTasa.vigenteHasta),
          observaciones: textoOpcional(formTasa.observaciones),
          creado_por: userId,
        })
        .select(COLUMNAS_TASAS)
        .single();

      if (error || !tasaCreada) throw error || new Error("No se pudo crear la tasa.");

      await auditar({
        empresa_id: tasaCreada.empresa_id,
        modulo: "planilla",
        accion: "crear_tasa_planilla",
        entidad_tipo: "planilla_configuracion_tasas",
        entidad_id: tasaCreada.id,
        estado_nuevo: tasaCreada.activo ? "Activo" : "Inactivo",
        origen: "app_planilla",
        metadatos: {
          empresa_id: tasaCreada.empresa_id,
          tasa_id: tasaCreada.id,
          tipo: tasaCreada.tipo,
          nombre: tasaCreada.nombre,
          porcentaje: Number(tasaCreada.porcentaje || 0),
          activo: Boolean(tasaCreada.activo),
        },
      });

      setFormTasa(formularioTasaInicial(String(empresaId)));
      await cargarDatos();
      setExito("Tasa registrada.");
    } catch (error) {
      console.error("Error guardando tasa de planilla:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarDescuento() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formDescuento.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar planilla.");
        return;
      }
      const empleado = empleados.find((item) => String(item.id) === formDescuento.empleadoId);
      if (!empleado || Number(empleado.empresa_id) !== empresaId) {
        throw new Error("El empleado debe pertenecer a la misma empresa.");
      }
      if (!formDescuento.descripcion.trim()) {
        throw new Error("La descripcion es obligatoria.");
      }

      setProcesando(true);
      const { data: descuentoCreado, error } = await supabase
        .from("planilla_prestamos_descuentos")
        .insert({
          empresa_id: empresaId,
          empleado_id: formDescuento.empleadoId,
          tipo: formDescuento.tipo,
          descripcion: formDescuento.descripcion.trim(),
          monto_original: numeroNoNegativo(formDescuento.montoOriginal, "Monto original"),
          saldo_pendiente: numeroNoNegativo(formDescuento.saldoPendiente, "Saldo pendiente"),
          cuota_periodo: numeroNoNegativo(formDescuento.cuotaPeriodo, "Cuota periodo"),
          fecha_inicio: textoOpcional(formDescuento.fechaInicio),
          fecha_fin: textoOpcional(formDescuento.fechaFin),
          observaciones: textoOpcional(formDescuento.observaciones),
          creado_por: userId,
        })
        .select(COLUMNAS_DESCUENTOS)
        .single();

      if (error || !descuentoCreado) {
        throw error || new Error("No se pudo crear el prestamo o descuento.");
      }

      await auditar({
        empresa_id: descuentoCreado.empresa_id,
        modulo: "planilla",
        accion: "crear_descuento_planilla",
        entidad_tipo: "planilla_prestamos_descuentos",
        entidad_id: descuentoCreado.id,
        estado_nuevo: descuentoCreado.estado,
        sensible: true,
        origen: "app_planilla",
        metadatos: {
          empresa_id: descuentoCreado.empresa_id,
          descuento_id: descuentoCreado.id,
          empleado_id: descuentoCreado.empleado_id,
          tipo: descuentoCreado.tipo,
          monto_total: Number(descuentoCreado.monto_original || 0),
          saldo_pendiente: Number(descuentoCreado.saldo_pendiente || 0),
          moneda: empleado.moneda,
          estado: descuentoCreado.estado,
        },
      });

      setFormDescuento(formularioDescuentoInicial(String(empresaId)));
      await cargarDatos();
      setExito("Prestamo o descuento registrado.");
    } catch (error) {
      console.error("Error guardando prestamo/descuento de planilla:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const empleadosPorId = useMemo(
    () => new Map(empleados.map((empleado) => [String(empleado.id), empleado])),
    [empleados]
  );

  const resumen = useMemo(() => {
    const empleadosActivos = empleados.filter((empleado) => empleado.activo && empleado.estado === "Activo");
    const salariosPorMoneda = empleadosActivos.reduce<Record<string, number>>((acc, empleado) => {
      const moneda = empleado.moneda || "GTQ";
      acc[moneda] = (acc[moneda] || 0) + Number(empleado.salario_base || 0);
      return acc;
    }, {});

    return {
      empleadosActivos: empleadosActivos.length,
      periodosAbiertos: periodos.filter((periodo) => ["Borrador", "En revision"].includes(periodo.estado)).length,
      tasasActivas: tasas.filter((tasa) => tasa.activo).length,
      descuentosActivos: descuentos.filter((descuento) => descuento.estado === "Activo").length,
      salariosPorMoneda,
    };
  }, [empleados, periodos, tasas, descuentos]);

  const empleadosParaDescuento = useMemo(
    () =>
      empleados.filter(
        (empleado) =>
          String(empleado.empresa_id) === String(formDescuento.empresaId) &&
          empleado.activo &&
          empleado.estado === "Activo"
      ),
    [empleados, formDescuento.empresaId]
  );

  const auditorGlobal = esAuditorSoloLectura();
  const puedeCrear = puedeEscribirAlgunaEmpresa();
  const avisoPermisos = !puedeCrear
    ? "No tiene funcion operativa para modificar planilla."
    : null;

  if (validandoAcceso) return <EstadoCentro>Validando acceso...</EstadoCentro>;
  if (!autorizado) return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este modulo."}</EstadoCentro>;

  return (
    <div className="flex min-h-screen bg-[#020617] text-white font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-7">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Users className="text-cyan-400" size={42} />
                <h1 className="text-4xl font-black md:text-5xl">Planilla</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">
                  Base operativa
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm text-gray-400">
                Lectura y mantenimiento inicial de empleados, periodos, tasas y prestamos/descuentos.
              </p>
              {perfilActual && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Operador: {perfilActual.nombre} | Rol: {perfilActual.rol}
                </p>
              )}
            </div>
          </header>

          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-cyan-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0" size={20} />
              <p>
                Planilla consulta datos por empresas permitidas y operativas. No calcula planilla completa, no genera pagos,
                no genera CxP y no envia asientos contables.
              </p>
            </div>
          </section>

          {auditorGlobal && <Banner tipo="warning">Auditor solo lectura: puedes consultar planilla, pero no crear ni actualizar registros.</Banner>}
          {aviso && <Banner tipo="warning">{aviso}</Banner>}
          {avisoPermisos && !auditorGlobal && <Banner tipo="warning">{avisoPermisos}</Banner>}
          {errorCarga && <Banner tipo="error">{errorCarga}</Banner>}
          {exito && <Banner tipo="success">{exito}</Banner>}

          <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <TabButton active={tab === "resumen"} onClick={() => setTab("resumen")} icon={<BadgeDollarSign size={15} />}>
              Resumen
            </TabButton>
            <TabButton active={tab === "empleados"} onClick={() => setTab("empleados")} icon={<Users size={15} />}>
              Empleados
            </TabButton>
            <TabButton active={tab === "periodos"} onClick={() => setTab("periodos")} icon={<CalendarDays size={15} />}>
              Periodos
            </TabButton>
            <TabButton active={tab === "tasas"} onClick={() => setTab("tasas")} icon={<SlidersHorizontal size={15} />}>
              Tasas
            </TabButton>
            <TabButton active={tab === "descuentos"} onClick={() => setTab("descuentos")} icon={<Coins size={15} />}>
              Prestamos / descuentos
            </TabButton>
            <TabButton active={tab === "calculo"} onClick={() => setTab("calculo")} icon={<Lock size={15} />}>
              Calculo
            </TabButton>
          </nav>

          {cargando ? (
            <section className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-cyan-300">
              <Loader2 className="animate-spin" size={24} />
              Cargando Planilla...
            </section>
          ) : (
            <>
              {tab === "resumen" && (
                <ResumenPlanilla
                  resumen={resumen}
                  empleados={empleados}
                  periodos={periodos}
                  tasas={tasas}
                  descuentos={descuentos}
                />
              )}
              {tab === "empleados" && (
                <Panel titulo="Empleados" subtitulo="Alta basica y listado por empresa operativa.">
                  {puedeCrear ? (
                    <FormularioEmpleado
                      form={formEmpleado}
                      setForm={setFormEmpleado}
                      empresas={empresas}
                      procesando={procesando}
                      onGuardar={guardarEmpleado}
                    />
                  ) : (
                    <FormularioBloqueado />
                  )}
                  <TablaEmpleados empleados={empleados} empresasPorId={empresasPorId} />
                </Panel>
              )}
              {tab === "periodos" && (
                <Panel titulo="Periodos" subtitulo="Creacion de periodos sin calculo automatico ni aprobaciones.">
                  {puedeCrear ? (
                    <FormularioPeriodo
                      form={formPeriodo}
                      setForm={setFormPeriodo}
                      empresas={empresas}
                      procesando={procesando}
                      onGuardar={guardarPeriodo}
                    />
                  ) : (
                    <FormularioBloqueado />
                  )}
                  <TablaPeriodos periodos={periodos} empresasPorId={empresasPorId} />
                </Panel>
              )}
              {tab === "tasas" && (
                <Panel titulo="Tasas" subtitulo="Configuracion manual revisable; no se precargan tasas oficiales.">
                  {puedeCrear ? (
                    <FormularioTasa
                      form={formTasa}
                      setForm={setFormTasa}
                      empresas={empresas}
                      procesando={procesando}
                      onGuardar={guardarTasa}
                    />
                  ) : (
                    <FormularioBloqueado />
                  )}
                  <TablaTasas tasas={tasas} empresasPorId={empresasPorId} />
                </Panel>
              )}
              {tab === "descuentos" && (
                <Panel titulo="Prestamos / descuentos" subtitulo="Registro basico ligado a empleados de la misma empresa.">
                  {puedeCrear ? (
                    <FormularioDescuento
                      form={formDescuento}
                      setForm={setFormDescuento}
                      empresas={empresas}
                      empleados={empleadosParaDescuento}
                      procesando={procesando}
                      onGuardar={guardarDescuento}
                    />
                  ) : (
                    <FormularioBloqueado />
                  )}
                  <TablaDescuentos
                    descuentos={descuentos}
                    empresasPorId={empresasPorId}
                    empleadosPorId={empleadosPorId}
                  />
                </Panel>
              )}
              {tab === "calculo" && (
                <Panel titulo="Calculo de planilla" subtitulo="Fase posterior.">
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                    <BriefcaseBusiness className="mx-auto mb-3 text-cyan-400" size={34} />
                    <p className="text-gray-300">
                      El calculo detallado, aprobacion, pago, CxP y asiento contable quedan pendientes.
                    </p>
                    <button type="button" disabled className="mt-5 btn-disabled">
                      <Lock size={14} />
                      Calcular planilla - Próximamente
                    </button>
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        .input-custom {
          height: 3.25rem;
          padding: 0 1rem;
          border-radius: 0.75rem;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          outline: none;
          font-size: 0.82rem;
        }
        .input-custom option {
          background: #0f172a;
          color: white;
        }
        .input-custom:focus {
          border-color: #06b6d4;
        }
        .btn-primary {
          min-height: 3.25rem;
          border-radius: 0.75rem;
          background: #06b6d4;
          color: #020617;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btn-disabled {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.75rem 1rem;
          color: #9ca3af;
          font-size: 0.75rem;
          font-weight: 800;
          opacity: 0.75;
        }
      `}</style>
    </div>
  );
}

function EstadoCentro({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-center text-white">{children}</div>;
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase ${
        active ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-gray-300 hover:bg-white/10"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Banner({ tipo, children }: { tipo: "warning" | "error" | "success"; children: ReactNode }) {
  const clases = {
    warning: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100",
    error: "border-red-400/30 bg-red-400/10 text-red-100",
    success: "border-green-400/30 bg-green-400/10 text-green-100",
  };
  return <section className={`rounded-2xl border p-4 text-sm ${clases[tipo]}`}>{children}</section>;
}

function Panel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5">
        <h2 className="text-xl font-black">{titulo}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitulo}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function ResumenPlanilla({
  resumen,
  empleados,
  periodos,
  tasas,
  descuentos,
}: {
  resumen: {
    empleadosActivos: number;
    periodosAbiertos: number;
    tasasActivas: number;
    descuentosActivos: number;
    salariosPorMoneda: Record<string, number>;
  };
  empleados: EmpleadoPlanilla[];
  periodos: PeriodoPlanilla[];
  tasas: TasaPlanilla[];
  descuentos: PrestamoDescuento[];
}) {
  const salarios = Object.entries(resumen.salariosPorMoneda)
    .map(([moneda, total]) => monto(total, moneda))
    .join(" | ");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard titulo="Empleados activos" valor={resumen.empleadosActivos} icono={<Users size={20} />} />
        <StatCard titulo="Periodos abiertos" valor={resumen.periodosAbiertos} icono={<CalendarDays size={20} />} />
        <StatCard titulo="Tasas activas" valor={resumen.tasasActivas} icono={<SlidersHorizontal size={20} />} />
        <StatCard titulo="Prestamos/descuentos activos" valor={resumen.descuentosActivos} icono={<Coins size={20} />} />
        <StatCard titulo="Salarios base activos" valor={salarios || "-"} icono={<BadgeDollarSign size={20} />} />
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <MiniLista titulo="Empleados recientes" items={empleados.slice(0, 5).map((e) => `${e.nombres} ${e.apellidos}`)} />
        <MiniLista titulo="Periodos recientes" items={periodos.slice(0, 5).map((p) => `${p.anio}/${p.mes} - ${p.tipo_planilla}`)} />
        <MiniLista titulo="Tasas recientes" items={tasas.slice(0, 5).map((t) => `${t.nombre} (${t.porcentaje}%)`)} />
        <MiniLista titulo="Descuentos recientes" items={descuentos.slice(0, 5).map((d) => d.descripcion)} />
      </section>
    </div>
  );
}

function StatCard({ titulo, valor, icono }: { titulo: string; valor: ReactNode; icono: ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between text-cyan-400">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
        {icono}
      </div>
      <h3 className="text-2xl font-black">{valor}</h3>
    </article>
  );
}

function MiniLista({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-black">{titulo}</h3>
      <ul className="mt-3 space-y-2 text-sm text-gray-400">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>Sin datos disponibles.</li>}
      </ul>
    </article>
  );
}

function FormularioBloqueado() {
  return (
    <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
      No tiene funcion operativa para modificar planilla.
    </div>
  );
}

function FormularioEmpleado({
  form,
  setForm,
  empresas,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioEmpleadoInicial>;
  setForm: (form: ReturnType<typeof formularioEmpleadoInicial>) => void;
  empresas: Empresa[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Registrar empleado</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <input className="input-custom" value={form.codigoEmpleado} onChange={(e) => setForm({ ...form, codigoEmpleado: e.target.value })} placeholder="Codigo empleado" />
        <input className="input-custom" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} placeholder="Nombres" />
        <input className="input-custom" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} placeholder="Apellidos" />
        <input className="input-custom" type="date" value={form.fechaIngreso} onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })} />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.salarioBase} onChange={(e) => setForm({ ...form, salarioBase: e.target.value })} placeholder="Salario base" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.bonificacionIncentivo} onChange={(e) => setForm({ ...form, bonificacionIncentivo: e.target.value })} placeholder="Bonificacion incentivo" />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom" value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })} placeholder="Puesto" />
        <input className="input-custom" value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} placeholder="Departamento" />
        <input className="input-custom" value={form.dpi} onChange={(e) => setForm({ ...form, dpi: e.target.value })} placeholder="DPI" />
        <input className="input-custom" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} placeholder="NIT" />
        <input className="input-custom" value={form.igssNumero} onChange={(e) => setForm({ ...form, igssNumero: e.target.value })} placeholder="IGSS" />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <button type="button" onClick={onGuardar} disabled={procesando || !empresas.length} className="btn-primary inline-flex items-center justify-center gap-2">
          {procesando ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
          Guardar empleado
        </button>
      </div>
    </div>
  );
}

function FormularioPeriodo({
  form,
  setForm,
  empresas,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioPeriodoInicial>;
  setForm: (form: ReturnType<typeof formularioPeriodoInicial>) => void;
  empresas: Empresa[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear periodo</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <input className="input-custom" type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} placeholder="Anio" />
        <select className="input-custom" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })}>
          {MESES.map((mes, index) => <option key={mes} value={String(index + 1)}>{mes}</option>)}
        </select>
        <input className="input-custom" value={form.tipoPlanilla} onChange={(e) => setForm({ ...form, tipoPlanilla: e.target.value })} placeholder="Tipo planilla" />
        <input className="input-custom" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom md:col-span-3" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <button type="button" onClick={onGuardar} disabled={procesando || !empresas.length} className="btn-primary inline-flex items-center justify-center gap-2">
          {procesando ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
          Guardar periodo
        </button>
      </div>
    </div>
  );
}

function FormularioTasa({
  form,
  setForm,
  empresas,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioTasaInicial>;
  setForm: (form: ReturnType<typeof formularioTasaInicial>) => void;
  empresas: Empresa[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear tasa configurable</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <input className="input-custom" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" />
        <select className="input-custom" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {TIPOS_TASA.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <input className="input-custom" type="number" min="0" max="100" step="0.0001" value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} placeholder="Porcentaje" />
        <label className="flex h-[3.25rem] items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-gray-300">
          <input type="checkbox" checked={form.aplicaEmpleado} onChange={(e) => setForm({ ...form, aplicaEmpleado: e.target.checked })} />
          Aplica empleado
        </label>
        <label className="flex h-[3.25rem] items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-gray-300">
          <input type="checkbox" checked={form.aplicaPatrono} onChange={(e) => setForm({ ...form, aplicaPatrono: e.target.checked })} />
          Aplica patrono
        </label>
        <input className="input-custom" type="date" value={form.vigenteDesde} onChange={(e) => setForm({ ...form, vigenteDesde: e.target.value })} />
        <input className="input-custom" type="date" value={form.vigenteHasta} onChange={(e) => setForm({ ...form, vigenteHasta: e.target.value })} />
        <input className="input-custom md:col-span-3" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <button type="button" onClick={onGuardar} disabled={procesando || !empresas.length} className="btn-primary inline-flex items-center justify-center gap-2">
          {procesando ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
          Guardar tasa
        </button>
      </div>
    </div>
  );
}

function FormularioDescuento({
  form,
  setForm,
  empresas,
  empleados,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioDescuentoInicial>;
  setForm: (form: ReturnType<typeof formularioDescuentoInicial>) => void;
  empresas: Empresa[];
  empleados: EmpleadoPlanilla[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear prestamo / descuento</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, empleadoId: "" })} />
        <select className="input-custom" value={form.empleadoId} onChange={(e) => setForm({ ...form, empleadoId: e.target.value })}>
          <option value="">Empleado...</option>
          {empleados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>{empleado.nombres} {empleado.apellidos}</option>
          ))}
        </select>
        <select className="input-custom" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {TIPOS_DESCUENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <input className="input-custom" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripcion" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.montoOriginal} onChange={(e) => setForm({ ...form, montoOriginal: e.target.value })} placeholder="Monto original" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.saldoPendiente} onChange={(e) => setForm({ ...form, saldoPendiente: e.target.value })} placeholder="Saldo pendiente" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.cuotaPeriodo} onChange={(e) => setForm({ ...form, cuotaPeriodo: e.target.value })} placeholder="Cuota periodo" />
        <input className="input-custom" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <button type="button" onClick={onGuardar} disabled={procesando || !empresas.length || !empleados.length} className="btn-primary inline-flex items-center justify-center gap-2">
          {procesando ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
          Guardar registro
        </button>
      </div>
    </div>
  );
}

function SelectEmpresa({ value, empresas, onChange }: { value: string; empresas: Empresa[]; onChange: (value: string) => void }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Empresa...</option>
      {empresas.map((empresa) => <option key={empresa.id} value={String(empresa.id)}>{empresa.nombre}</option>)}
    </select>
  );
}

function SelectMoneda({ value, onChange }: { value: Moneda; onChange: (value: Moneda) => void }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value as Moneda)}>
      {MONEDAS.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
    </select>
  );
}

function TablaEmpleados({ empleados, empresasPorId }: { empleados: EmpleadoPlanilla[]; empresasPorId: Map<number, string> }) {
  if (!empleados.length) return <EmptyState texto="No hay empleados de planilla para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Codigo", "Nombres", "DPI/NIT/IGSS", "Puesto", "Salario", "Bonificacion", "Estado", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {empleados.map((empleado) => (
          <tr key={empleado.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(empleado.empresa_id)) || `Empresa #${empleado.empresa_id}`}</td>
            <td className="px-4 py-4 text-gray-300">{empleado.codigo_empleado || "-"}</td>
            <td className="px-4 py-4"><p className="font-bold">{empleado.nombres} {empleado.apellidos}</p><p className="text-xs text-gray-500">{empleado.departamento || "-"}</p></td>
            <td className="px-4 py-4 text-gray-300">DPI {empleado.dpi || "-"}<br />NIT {empleado.nit || "-"}<br />IGSS {empleado.igss_numero || "-"}</td>
            <td className="px-4 py-4 text-gray-300">{empleado.puesto || "-"}</td>
            <td className="px-4 py-4 text-gray-300">{monto(empleado.salario_base, empleado.moneda)}</td>
            <td className="px-4 py-4 text-gray-300">{monto(empleado.bonificacion_incentivo, empleado.moneda)}</td>
            <td className="px-4 py-4"><Badge estado={empleado.activo ? empleado.estado : "Inactivo"} /></td>
            <td className="px-4 py-4"><BotonProximamente label="Editar" /></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaPeriodos({ periodos, empresasPorId }: { periodos: PeriodoPlanilla[]; empresasPorId: Map<number, string> }) {
  if (!periodos.length) return <EmptyState texto="No hay periodos de planilla para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Periodo", "Fechas", "Estado", "Totales", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {periodos.map((periodo) => (
          <tr key={periodo.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(periodo.empresa_id)) || `Empresa #${periodo.empresa_id}`}</td>
            <td className="px-4 py-4"><p className="font-bold">{periodo.anio} / {MESES[periodo.mes - 1] || periodo.mes}</p><p className="text-xs text-gray-500">{periodo.tipo_planilla}</p></td>
            <td className="px-4 py-4 text-gray-300">Inicio {fechaMostrar(periodo.fecha_inicio)}<br />Fin {fechaMostrar(periodo.fecha_fin)}<br />Pago {fechaMostrar(periodo.fecha_pago)}</td>
            <td className="px-4 py-4"><Badge estado={periodo.estado} /></td>
            <td className="px-4 py-4 text-gray-300">Devengado {monto(periodo.total_devengado, periodo.moneda)}<br />Descuentos {monto(periodo.total_descuentos, periodo.moneda)}<br />Neto {monto(periodo.total_neto, periodo.moneda)}</td>
            <td className="px-4 py-4"><div className="flex flex-col gap-2"><BotonProximamente label="Aprobar" /><BotonProximamente label="Pagar" /><BotonProximamente label="Anular" /></div></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaTasas({ tasas, empresasPorId }: { tasas: TasaPlanilla[]; empresasPorId: Map<number, string> }) {
  if (!tasas.length) return <EmptyState texto="No hay tasas configuradas para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Nombre", "Tipo", "Porcentaje", "Aplica", "Vigencia", "Estado"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {tasas.map((tasa) => (
          <tr key={tasa.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(tasa.empresa_id)) || `Empresa #${tasa.empresa_id}`}</td>
            <td className="px-4 py-4 font-bold">{tasa.nombre}</td>
            <td className="px-4 py-4 text-gray-300">{tasa.tipo}</td>
            <td className="px-4 py-4 text-gray-300">{Number(tasa.porcentaje).toFixed(4)}%</td>
            <td className="px-4 py-4 text-gray-300">Empleado: {tasa.aplica_empleado ? "Si" : "No"}<br />Patrono: {tasa.aplica_patrono ? "Si" : "No"}</td>
            <td className="px-4 py-4 text-gray-300">{fechaMostrar(tasa.vigente_desde)} - {fechaMostrar(tasa.vigente_hasta)}</td>
            <td className="px-4 py-4"><Badge estado={tasa.activo ? "Activa" : "Inactiva"} /></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaDescuentos({
  descuentos,
  empresasPorId,
  empleadosPorId,
}: {
  descuentos: PrestamoDescuento[];
  empresasPorId: Map<number, string>;
  empleadosPorId: Map<string, EmpleadoPlanilla>;
}) {
  if (!descuentos.length) return <EmptyState texto="No hay prestamos o descuentos para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Empleado", "Tipo", "Descripcion", "Montos", "Fechas", "Estado"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {descuentos.map((item) => {
          const empleado = empleadosPorId.get(String(item.empleado_id));
          return (
            <tr key={item.id} className="align-top text-sm">
              <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(item.empresa_id)) || `Empresa #${item.empresa_id}`}</td>
              <td className="px-4 py-4 text-gray-300">{empleado ? `${empleado.nombres} ${empleado.apellidos}` : item.empleado_id}</td>
              <td className="px-4 py-4 text-gray-300">{item.tipo}</td>
              <td className="px-4 py-4 font-bold">{item.descripcion}</td>
              <td className="px-4 py-4 text-gray-300">Original {monto(item.monto_original)}<br />Saldo {monto(item.saldo_pendiente)}<br />Cuota {monto(item.cuota_periodo)}</td>
              <td className="px-4 py-4 text-gray-300">{fechaMostrar(item.fecha_inicio)} - {fechaMostrar(item.fecha_fin)}</td>
              <td className="px-4 py-4"><Badge estado={item.estado} /></td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-left">{children}</table>
    </div>
  );
}

function Badge({ estado }: { estado: string }) {
  const texto = estado.toLowerCase();
  const clase = texto.includes("activo") || texto.includes("borrador") || texto.includes("revision")
    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
    : texto.includes("anulada") || texto.includes("inactivo")
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : "border-white/10 bg-white/5 text-gray-300";

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${clase}`}>{estado}</span>;
}

function BotonProximamente({ label }: { label: string }) {
  return (
    <button type="button" disabled className="btn-disabled" title={`${label}: Próximamente`}>
      <Lock size={13} />
      {label} - Próximamente
    </button>
  );
}

function EmptyState({ texto }: { texto: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-400">{texto}</div>;
}
