"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarDays,
  ClipboardList,
  FileText,
  Loader2,
  Lock,
  Plus,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
} from "../../lib/auditoria";
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

type Tab =
  | "resumen"
  | "configuracion"
  | "documentos"
  | "periodos"
  | "resumen_periodo"
  | "calendario"
  | "proximamente";
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

interface ImpuestoConfiguracion {
  id: string;
  empresa_id: number;
  impuesto_id: string | null;
  nombre: string;
  tipo: string;
  porcentaje: number;
  cuenta_contable_id: string | null;
  aplica_compra: boolean;
  aplica_venta: boolean;
  aplica_retencion: boolean | null;
  proveedor_id: string | null;
  cliente_id: string | null;
  activo: boolean;
  observaciones: string | null;
}

interface ImpuestoDocumento {
  id: string;
  empresa_id: number;
  tipo_documento: string;
  modulo_origen: string | null;
  proveedor_id: string | null;
  cliente_id: string | null;
  nit_emisor: string | null;
  nit_receptor: string | null;
  serie: string | null;
  numero: string | null;
  fecha_documento: string;
  fecha_recepcion: string | null;
  moneda: string;
  tipo_cambio: number | null;
  subtotal: number;
  iva: number;
  total: number;
  credito_fiscal: number;
  debito_fiscal: number;
  retencion_iva: number;
  retencion_isr: number;
  estado: string;
  sensible: boolean;
  observaciones: string | null;
}

interface ImpuestoPeriodo {
  id: string;
  empresa_id: number;
  anio: number;
  mes: number;
  tipo_periodo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_vencimiento: string | null;
  observaciones: string | null;
}

interface ImpuestoResumenPeriodo {
  id: string;
  empresa_id: number;
  periodo_id: string;
  moneda: string;
  total_compras: number;
  total_ventas: number;
  credito_fiscal: number;
  debito_fiscal: number;
  iva_por_pagar: number;
  iva_a_favor: number;
  retenciones_iva: number;
  retenciones_isr: number;
  isr_estimado: number;
  estado: string;
  observaciones: string | null;
}

interface ImpuestoCalendario {
  id: string;
  empresa_id: number;
  periodo_id: string | null;
  titulo: string;
  tipo_obligacion: string;
  fecha_vencimiento: string;
  estado: string;
  monto_estimado: number;
  moneda: string;
  responsable_id: string | null;
  visible_calendario: boolean;
  observaciones: string | null;
}

const ROLES_ESCRITURA = ["admin", "supervisor", "jefe"];
const FUNCIONES_ESCRITURA: Array<"auxiliar_contable" | "contador_revisor"> = [
  "auxiliar_contable",
  "contador_revisor",
];
const FUNCION_CONFIGURACION = ["contabilidad_configuracion"] as const;
const MONEDAS: Moneda[] = ["GTQ", "USD"];
const TIPOS_IMPUESTO = [
  "IVA",
  "ISR",
  "RETENCION_IVA",
  "RETENCION_ISR",
  "Retencion",
  "EXENTO",
  "Exento",
  "OTRO",
  "Otro",
];
const TIPOS_DOCUMENTO = [
  "FACTURA_COMPRA",
  "FACTURA_VENTA",
  "NOTA_CREDITO",
  "NOTA_DEBITO",
  "RECIBO",
  "RETENCION",
  "OTRO",
];
const ESTADOS_DOCUMENTO = ["Borrador", "Registrado", "Revisado", "Declarado", "Anulado"];
const ESTADOS_PERIODO = ["Abierto", "En revision", "Declarado", "Cerrado", "Anulado"];
const ESTADOS_RESUMEN = ["Borrador", "En revision", "Revisado", "Declarado", "Anulado"];
const TIPOS_OBLIGACION = ["IVA", "ISR", "RETENCION", "SAT", "OTRO"];
const ESTADOS_CALENDARIO = ["Pendiente", "En proceso", "Cumplido", "Vencido", "Anulado"];
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

const COLUMNAS_CONFIGURACION =
  "id,empresa_id,impuesto_id,nombre,tipo,porcentaje,cuenta_contable_id,aplica_compra,aplica_venta,aplica_retencion,proveedor_id,cliente_id,activo,observaciones";
const COLUMNAS_DOCUMENTOS =
  "id,empresa_id,tipo_documento,modulo_origen,proveedor_id,cliente_id,nit_emisor,nit_receptor,serie,numero,fecha_documento,fecha_recepcion,moneda,tipo_cambio,subtotal,iva,total,credito_fiscal,debito_fiscal,retencion_iva,retencion_isr,estado,sensible,observaciones";
const COLUMNAS_PERIODOS =
  "id,empresa_id,anio,mes,tipo_periodo,estado,fecha_inicio,fecha_fin,fecha_vencimiento,observaciones";
const COLUMNAS_RESUMENES =
  "id,empresa_id,periodo_id,moneda,total_compras,total_ventas,credito_fiscal,debito_fiscal,iva_por_pagar,iva_a_favor,retenciones_iva,retenciones_isr,isr_estimado,estado,observaciones";
const COLUMNAS_CALENDARIO =
  "id,empresa_id,periodo_id,titulo,tipo_obligacion,fecha_vencimiento,estado,monto_estimado,moneda,responsable_id,visible_calendario,observaciones";

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
  return Math.round(numero * 10000) / 10000;
}

function fechaMostrar(valor?: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function monto(valor?: number | null, moneda = "GTQ") {
  if (valor === null || valor === undefined) return "-";
  return `${moneda} ${Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function validarRangoFechas(inicio: string, fin: string) {
  if (inicio && fin && fin < inicio) {
    throw new Error("La fecha final no puede ser anterior a la fecha inicial.");
  }
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

function formularioConfiguracionInicial(empresaId = "") {
  return {
    empresaId,
    impuestoId: "",
    nombre: "",
    tipo: "IVA",
    porcentaje: "0",
    cuentaContableId: "",
    aplicaCompra: false,
    aplicaVenta: false,
    aplicaRetencion: false,
    proveedorId: "",
    clienteId: "",
    observaciones: "",
  };
}

function formularioDocumentoInicial(empresaId = "") {
  return {
    empresaId,
    tipoDocumento: "FACTURA_COMPRA",
    moduloOrigen: "",
    proveedorId: "",
    clienteId: "",
    nitEmisor: "",
    nitReceptor: "",
    serie: "",
    numero: "",
    fechaDocumento: "",
    fechaRecepcion: "",
    moneda: "GTQ" as Moneda,
    tipoCambio: "",
    subtotal: "0",
    iva: "0",
    total: "0",
    creditoFiscal: "0",
    debitoFiscal: "0",
    retencionIva: "0",
    retencionIsr: "0",
    estado: "Registrado",
    sensible: false,
    observaciones: "",
  };
}

function formularioPeriodoInicial(empresaId = "") {
  const hoy = new Date();
  return {
    empresaId,
    anio: String(hoy.getFullYear()),
    mes: String(hoy.getMonth() + 1),
    tipoPeriodo: "Mensual",
    estado: "Abierto",
    fechaInicio: "",
    fechaFin: "",
    fechaVencimiento: "",
    observaciones: "",
  };
}

function formularioResumenInicial(empresaId = "") {
  return {
    empresaId,
    periodoId: "",
    moneda: "GTQ" as Moneda,
    totalCompras: "0",
    totalVentas: "0",
    creditoFiscal: "0",
    debitoFiscal: "0",
    ivaPorPagar: "0",
    ivaAFavor: "0",
    retencionesIva: "0",
    retencionesIsr: "0",
    isrEstimado: "0",
    estado: "Borrador",
    observaciones: "",
  };
}

function formularioCalendarioInicial(empresaId = "") {
  return {
    empresaId,
    periodoId: "",
    titulo: "",
    tipoObligacion: "IVA",
    fechaVencimiento: "",
    estado: "Pendiente",
    montoEstimado: "0",
    moneda: "GTQ" as Moneda,
    responsableId: "",
    visibleCalendario: true,
    observaciones: "",
  };
}

export default function ImpuestosPage() {
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
  const [configuraciones, setConfiguraciones] = useState<ImpuestoConfiguracion[]>([]);
  const [documentos, setDocumentos] = useState<ImpuestoDocumento[]>([]);
  const [periodos, setPeriodos] = useState<ImpuestoPeriodo[]>([]);
  const [resumenes, setResumenes] = useState<ImpuestoResumenPeriodo[]>([]);
  const [calendario, setCalendario] = useState<ImpuestoCalendario[]>([]);
  const [formConfiguracion, setFormConfiguracion] = useState(formularioConfiguracionInicial());
  const [formDocumento, setFormDocumento] = useState(formularioDocumentoInicial());
  const [formPeriodo, setFormPeriodo] = useState(formularioPeriodoInicial());
  const [formResumen, setFormResumen] = useState(formularioResumenInicial());
  const [formCalendario, setFormCalendario] = useState(formularioCalendarioInicial());

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        setValidandoAcceso(true);
        const acceso = await validarAccesoModuloUsuario("impuestos");
        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );

          if (volverLogin) {
            router.replace("/login");
            return;
          }

          setMensajeBloqueo("No tienes acceso al modulo Impuestos.");
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
        setFormConfiguracion(formularioConfiguracionInicial(empresaInicial));
        setFormDocumento(formularioDocumentoInicial(empresaInicial));
        setFormPeriodo(formularioPeriodoInicial(empresaInicial));
        setFormResumen(formularioResumenInicial(empresaInicial));
        setFormCalendario(formularioCalendarioInicial(empresaInicial));
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!operativas.ids.length) {
          setAviso("No tienes empresas operativas asignadas para consultar Impuestos.");
          return;
        }

        setCargando(true);
        await cargarDatos(operativas.ids);
      } catch (error) {
        console.error("Error cargando Impuestos:", error);
        if (activo) {
          setErrorCarga("No se pudo cargar la pantalla de Impuestos.");
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
      setConfiguraciones([]);
      setDocumentos([]);
      setPeriodos([]);
      setResumenes([]);
      setCalendario([]);
      return;
    }

    const [resConfig, resDocs, resPeriodos, resResumenes, resCalendario] = await Promise.all([
      supabase
        .from("impuestos_configuracion")
        .select(COLUMNAS_CONFIGURACION)
        .in("empresa_id", idsValidos)
        .order("nombre", { ascending: true }),
      supabase
        .from("impuestos_documentos")
        .select(COLUMNAS_DOCUMENTOS)
        .in("empresa_id", idsValidos)
        .order("fecha_documento", { ascending: false }),
      supabase
        .from("impuestos_periodos")
        .select(COLUMNAS_PERIODOS)
        .in("empresa_id", idsValidos)
        .order("anio", { ascending: false })
        .order("mes", { ascending: false }),
      supabase
        .from("impuestos_resumen_periodo")
        .select(COLUMNAS_RESUMENES)
        .in("empresa_id", idsValidos)
        .order("estado", { ascending: true }),
      supabase
        .from("impuestos_calendario")
        .select(COLUMNAS_CALENDARIO)
        .in("empresa_id", idsValidos)
        .order("fecha_vencimiento", { ascending: true }),
    ]);

    if (resConfig.error) {
      console.error("Error cargando configuracion de impuestos:", resConfig.error);
      throw new Error("No se pudo cargar la configuracion fiscal.");
    }
    if (resDocs.error) {
      console.error("Error cargando documentos de impuestos:", resDocs.error);
      throw new Error("No se pudieron cargar los documentos fiscales.");
    }
    if (resPeriodos.error) {
      console.error("Error cargando periodos de impuestos:", resPeriodos.error);
      throw new Error("No se pudieron cargar los periodos fiscales.");
    }
    if (resResumenes.error) {
      console.error("Error cargando resumenes de impuestos:", resResumenes.error);
      throw new Error("No se pudieron cargar los resumenes fiscales.");
    }
    if (resCalendario.error) {
      console.error("Error cargando calendario de impuestos:", resCalendario.error);
      throw new Error("No se pudo cargar el calendario fiscal.");
    }

    setConfiguraciones((resConfig.data || []) as ImpuestoConfiguracion[]);
    setDocumentos((resDocs.data || []) as ImpuestoDocumento[]);
    setPeriodos((resPeriodos.data || []) as ImpuestoPeriodo[]);
    setResumenes((resResumenes.data || []) as ImpuestoResumenPeriodo[]);
    setCalendario((resCalendario.data || []) as ImpuestoCalendario[]);
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
      tieneFuncionOperativaLocal(funcionesOperativas, userId, empresaId, FUNCIONES_ESCRITURA)
    );
  }

  function puedeEscribirAlgunaEmpresa() {
    return empresasOperativasIds.some((empresaId) => puedeEscribir(empresaId));
  }

  function puedeConfigurar(empresaId?: string | number | null) {
    if (!empresaId || !userId || esAuditorSoloLectura(empresaId)) return false;
    return tieneFuncionOperativaLocal(funcionesOperativas, userId, empresaId, [
      ...FUNCION_CONFIGURACION,
    ]);
  }

  function puedeConfigurarAlgunaEmpresa() {
    return empresasOperativasIds.some((empresaId) => puedeConfigurar(empresaId));
  }

  async function auditar(params: RegistrarAuditoriaEventoParams) {
    try {
      await registrarAuditoriaEvento(params);
      return true;
    } catch (error) {
      console.warn("No se pudo registrar auditoria de Impuestos:", error);
      setAviso("El registro se guardo, pero no se pudo registrar la auditoria central.");
      return false;
    }
  }

  async function guardarConfiguracion() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formConfiguracion.empresaId);
      if (!puedeConfigurar(empresaId)) {
        setErrorCarga("No tienes la funcion contabilidad_configuracion para modificar la configuracion fiscal.");
        return;
      }
      if (!formConfiguracion.nombre.trim()) {
        throw new Error("El nombre del impuesto es obligatorio.");
      }

      const porcentaje = numeroNoNegativo(formConfiguracion.porcentaje, "Porcentaje");
      if (porcentaje > 100) throw new Error("El porcentaje no puede ser mayor a 100.");

      setProcesando(true);
      const payload = {
        empresa_id: empresaId,
        impuesto_id: textoOpcional(formConfiguracion.impuestoId),
        nombre: formConfiguracion.nombre.trim(),
        tipo: formConfiguracion.tipo,
        porcentaje,
        cuenta_contable_id: textoOpcional(formConfiguracion.cuentaContableId),
        aplica_compra: formConfiguracion.aplicaCompra,
        aplica_venta: formConfiguracion.aplicaVenta,
        aplica_retencion: formConfiguracion.aplicaRetencion,
        proveedor_id: textoOpcional(formConfiguracion.proveedorId),
        cliente_id: textoOpcional(formConfiguracion.clienteId),
        observaciones: textoOpcional(formConfiguracion.observaciones),
        activo: true,
        creado_por: userId,
      };

      const { data, error } = await supabase
        .from("impuestos_configuracion")
        .insert(payload)
        .select(COLUMNAS_CONFIGURACION)
        .single();

      if (error) {
        console.error("Error guardando configuracion fiscal:", error);
        throw new Error("No se pudo guardar la configuracion fiscal.");
      }

      const registro = data as ImpuestoConfiguracion;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "impuestos",
        accion: "crear_configuracion_impuesto",
        entidad_tipo: "impuestos_configuracion",
        entidad_id: registro.id,
        estado_nuevo: registro.activo ? "Activo" : "Inactivo",
        descripcion: `Configuracion fiscal creada: ${registro.nombre}`,
        metadatos: {
          empresa_id: empresaId,
          impuesto_id: registro.impuesto_id,
          nombre: registro.nombre,
          tipo: registro.tipo,
          porcentaje: Number(registro.porcentaje || 0),
          cuenta_contable_id: registro.cuenta_contable_id,
          aplica_compra: Boolean(registro.aplica_compra),
          aplica_venta: Boolean(registro.aplica_venta),
          aplica_retencion: Boolean(registro.aplica_retencion),
          proveedor_id: registro.proveedor_id,
          cliente_id: registro.cliente_id,
          activo: Boolean(registro.activo),
        },
        origen: "app_impuestos",
      });

      setFormConfiguracion(formularioConfiguracionInicial(String(empresaId)));
      await cargarDatos();
      setExito(
        auditoriaOk
          ? "Configuracion fiscal registrada."
          : "Configuracion fiscal registrada; auditoria pendiente de revision."
      );
    } catch (error) {
      console.error("Error guardando configuracion de impuestos:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarDocumento() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formDocumento.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tienes funcion operativa para modificar Impuestos.");
        return;
      }
      if (!formDocumento.fechaDocumento) {
        throw new Error("La fecha del documento es obligatoria.");
      }

      const tipoCambio = formDocumento.tipoCambio.trim()
        ? numeroNoNegativo(formDocumento.tipoCambio, "Tipo de cambio")
        : null;
      if (tipoCambio !== null && tipoCambio <= 0) {
        throw new Error("El tipo de cambio debe ser mayor a cero.");
      }

      setProcesando(true);
      const payload = {
        empresa_id: empresaId,
        tipo_documento: formDocumento.tipoDocumento,
        modulo_origen: textoOpcional(formDocumento.moduloOrigen),
        proveedor_id: textoOpcional(formDocumento.proveedorId),
        cliente_id: textoOpcional(formDocumento.clienteId),
        nit_emisor: textoOpcional(formDocumento.nitEmisor),
        nit_receptor: textoOpcional(formDocumento.nitReceptor),
        serie: textoOpcional(formDocumento.serie),
        numero: textoOpcional(formDocumento.numero),
        fecha_documento: formDocumento.fechaDocumento,
        fecha_recepcion: textoOpcional(formDocumento.fechaRecepcion),
        moneda: formDocumento.moneda,
        tipo_cambio: tipoCambio,
        subtotal: numeroNoNegativo(formDocumento.subtotal, "Subtotal"),
        iva: numeroNoNegativo(formDocumento.iva, "IVA"),
        total: numeroNoNegativo(formDocumento.total, "Total"),
        credito_fiscal: numeroNoNegativo(formDocumento.creditoFiscal, "Credito fiscal"),
        debito_fiscal: numeroNoNegativo(formDocumento.debitoFiscal, "Debito fiscal"),
        retencion_iva: numeroNoNegativo(formDocumento.retencionIva, "Retencion IVA"),
        retencion_isr: numeroNoNegativo(formDocumento.retencionIsr, "Retencion ISR"),
        estado: formDocumento.estado,
        sensible: formDocumento.sensible,
        observaciones: textoOpcional(formDocumento.observaciones),
        creado_por: userId,
      };

      const { data, error } = await supabase
        .from("impuestos_documentos")
        .insert(payload)
        .select(COLUMNAS_DOCUMENTOS)
        .single();

      if (error) {
        console.error("Error guardando documento fiscal:", error);
        throw new Error("No se pudo guardar el documento fiscal.");
      }

      const registro = data as ImpuestoDocumento;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "impuestos",
        accion: "crear_documento_impuesto",
        entidad_tipo: "impuestos_documentos",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Documento fiscal registrado: ${registro.tipo_documento}`,
        metadatos: {
          empresa_id: empresaId,
          tipo_documento: registro.tipo_documento,
          modulo_origen: registro.modulo_origen,
          proveedor_id: registro.proveedor_id,
          cliente_id: registro.cliente_id,
          nit_emisor: registro.nit_emisor,
          nit_receptor: registro.nit_receptor,
          serie: registro.serie,
          numero: registro.numero,
          fecha_documento: registro.fecha_documento,
          fecha_recepcion: registro.fecha_recepcion,
          moneda: registro.moneda,
          tipo_cambio: registro.tipo_cambio,
          subtotal: Number(registro.subtotal || 0),
          iva: Number(registro.iva || 0),
          total: Number(registro.total || 0),
          credito_fiscal: Number(registro.credito_fiscal || 0),
          debito_fiscal: Number(registro.debito_fiscal || 0),
          retencion_iva: Number(registro.retencion_iva || 0),
          retencion_isr: Number(registro.retencion_isr || 0),
          estado: registro.estado,
          sensible: Boolean(registro.sensible),
        },
        sensible: Boolean(registro.sensible),
        origen: "app_impuestos",
      });

      setFormDocumento(formularioDocumentoInicial(String(empresaId)));
      await cargarDatos();
      setExito(
        auditoriaOk
          ? "Documento fiscal registrado sin generar calculos, pagos ni asientos."
          : "Documento fiscal registrado; auditoria pendiente de revision."
      );
    } catch (error) {
      console.error("Error guardando documento de impuestos:", error);
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
        setErrorCarga("No tienes funcion operativa para modificar Impuestos.");
        return;
      }
      if (!formPeriodo.fechaInicio || !formPeriodo.fechaFin) {
        throw new Error("Fecha inicio y fecha fin son obligatorias.");
      }
      validarRangoFechas(formPeriodo.fechaInicio, formPeriodo.fechaFin);

      const anio = Number(formPeriodo.anio);
      const mes = Number(formPeriodo.mes);
      if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
        throw new Error("Anio no valido.");
      }
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
        throw new Error("Mes no valido.");
      }

      setProcesando(true);
      const payload = {
        empresa_id: empresaId,
        anio,
        mes,
        tipo_periodo: formPeriodo.tipoPeriodo.trim() || "Mensual",
        estado: formPeriodo.estado,
        fecha_inicio: formPeriodo.fechaInicio,
        fecha_fin: formPeriodo.fechaFin,
        fecha_vencimiento: textoOpcional(formPeriodo.fechaVencimiento),
        observaciones: textoOpcional(formPeriodo.observaciones),
        creado_por: userId,
      };

      const { data, error } = await supabase
        .from("impuestos_periodos")
        .insert(payload)
        .select(COLUMNAS_PERIODOS)
        .single();

      if (error) {
        console.error("Error guardando periodo fiscal:", error);
        throw new Error("No se pudo guardar el periodo fiscal.");
      }

      const registro = data as ImpuestoPeriodo;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "impuestos",
        accion: "crear_periodo_impuesto",
        entidad_tipo: "impuestos_periodos",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Periodo fiscal creado: ${registro.anio}/${registro.mes}`,
        metadatos: {
          empresa_id: empresaId,
          anio: registro.anio,
          mes: registro.mes,
          tipo_periodo: registro.tipo_periodo,
          fecha_inicio: registro.fecha_inicio,
          fecha_fin: registro.fecha_fin,
          fecha_vencimiento: registro.fecha_vencimiento,
          estado: registro.estado,
        },
        origen: "app_impuestos",
      });

      setFormPeriodo(formularioPeriodoInicial(String(empresaId)));
      await cargarDatos();
      setExito(
        auditoriaOk
          ? "Periodo fiscal registrado."
          : "Periodo fiscal registrado; auditoria pendiente de revision."
      );
    } catch (error) {
      console.error("Error guardando periodo de impuestos:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarResumen() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formResumen.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tienes funcion operativa para modificar Impuestos.");
        return;
      }

      const periodo = periodos.find((item) => item.id === formResumen.periodoId);
      if (!periodo || Number(periodo.empresa_id) !== empresaId) {
        throw new Error("Selecciona un periodo fiscal de la misma empresa.");
      }

      setProcesando(true);
      const payload = {
        empresa_id: empresaId,
        periodo_id: formResumen.periodoId,
        moneda: formResumen.moneda,
        total_compras: numeroNoNegativo(formResumen.totalCompras, "Total compras"),
        total_ventas: numeroNoNegativo(formResumen.totalVentas, "Total ventas"),
        credito_fiscal: numeroNoNegativo(formResumen.creditoFiscal, "Credito fiscal"),
        debito_fiscal: numeroNoNegativo(formResumen.debitoFiscal, "Debito fiscal"),
        iva_por_pagar: numeroNoNegativo(formResumen.ivaPorPagar, "IVA por pagar"),
        iva_a_favor: numeroNoNegativo(formResumen.ivaAFavor, "IVA a favor"),
        retenciones_iva: numeroNoNegativo(formResumen.retencionesIva, "Retenciones IVA"),
        retenciones_isr: numeroNoNegativo(formResumen.retencionesIsr, "Retenciones ISR"),
        isr_estimado: numeroNoNegativo(formResumen.isrEstimado, "ISR estimado"),
        estado: formResumen.estado,
        observaciones: textoOpcional(formResumen.observaciones),
        creado_por: userId,
      };

      const { data, error } = await supabase
        .from("impuestos_resumen_periodo")
        .insert(payload)
        .select(COLUMNAS_RESUMENES)
        .single();

      if (error) {
        console.error("Error guardando resumen fiscal:", error);
        throw new Error("No se pudo guardar el resumen fiscal.");
      }

      const registro = data as ImpuestoResumenPeriodo;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "impuestos",
        accion: "crear_resumen_impuesto",
        entidad_tipo: "impuestos_resumen_periodo",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: "Resumen fiscal creado de forma revisable.",
        metadatos: {
          empresa_id: empresaId,
          periodo_id: registro.periodo_id,
          moneda: registro.moneda,
          total_compras: Number(registro.total_compras || 0),
          total_ventas: Number(registro.total_ventas || 0),
          credito_fiscal: Number(registro.credito_fiscal || 0),
          debito_fiscal: Number(registro.debito_fiscal || 0),
          iva_por_pagar: Number(registro.iva_por_pagar || 0),
          iva_a_favor: Number(registro.iva_a_favor || 0),
          retenciones_iva: Number(registro.retenciones_iva || 0),
          retenciones_isr: Number(registro.retenciones_isr || 0),
          isr_estimado: Number(registro.isr_estimado || 0),
          estado: registro.estado,
        },
        origen: "app_impuestos",
      });

      setFormResumen(formularioResumenInicial(String(empresaId)));
      await cargarDatos();
      setExito(
        auditoriaOk
          ? "Resumen fiscal registrado de forma revisable."
          : "Resumen fiscal registrado; auditoria pendiente de revision."
      );
    } catch (error) {
      console.error("Error guardando resumen de impuestos:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarCalendario() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);

    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formCalendario.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tienes funcion operativa para modificar Impuestos.");
        return;
      }
      if (!formCalendario.titulo.trim() || !formCalendario.fechaVencimiento) {
        throw new Error("Titulo y fecha de vencimiento son obligatorios.");
      }

      const periodoId = textoOpcional(formCalendario.periodoId);
      if (periodoId) {
        const periodo = periodos.find((item) => item.id === periodoId);
        if (!periodo || Number(periodo.empresa_id) !== empresaId) {
          throw new Error("El periodo del vencimiento debe pertenecer a la misma empresa.");
        }
      }

      setProcesando(true);
      const payload = {
        empresa_id: empresaId,
        periodo_id: periodoId,
        titulo: formCalendario.titulo.trim(),
        tipo_obligacion: formCalendario.tipoObligacion,
        fecha_vencimiento: formCalendario.fechaVencimiento,
        estado: formCalendario.estado,
        monto_estimado: numeroNoNegativo(formCalendario.montoEstimado, "Monto estimado"),
        moneda: formCalendario.moneda,
        responsable_id: textoOpcional(formCalendario.responsableId),
        visible_calendario: formCalendario.visibleCalendario,
        observaciones: textoOpcional(formCalendario.observaciones),
        creado_por: userId,
      };

      const { data, error } = await supabase
        .from("impuestos_calendario")
        .insert(payload)
        .select(COLUMNAS_CALENDARIO)
        .single();

      if (error) {
        console.error("Error guardando vencimiento fiscal:", error);
        throw new Error("No se pudo guardar el vencimiento fiscal.");
      }

      const registro = data as ImpuestoCalendario;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "impuestos",
        accion: "crear_vencimiento_impuesto",
        entidad_tipo: "impuestos_calendario",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Vencimiento fiscal creado: ${registro.titulo}`,
        metadatos: {
          empresa_id: empresaId,
          periodo_id: registro.periodo_id,
          titulo: registro.titulo,
          tipo_obligacion: registro.tipo_obligacion,
          fecha_vencimiento: registro.fecha_vencimiento,
          estado: registro.estado,
          monto_estimado: Number(registro.monto_estimado || 0),
          moneda: registro.moneda,
          responsable_id: registro.responsable_id,
          visible_calendario: Boolean(registro.visible_calendario),
        },
        visible_calendario: Boolean(registro.visible_calendario),
        origen: "app_impuestos",
      });

      setFormCalendario(formularioCalendarioInicial(String(empresaId)));
      await cargarDatos();
      setExito(
        auditoriaOk
          ? "Vencimiento fiscal registrado sin conectar calendario operativo."
          : "Vencimiento fiscal registrado; auditoria pendiente de revision."
      );
    } catch (error) {
      console.error("Error guardando vencimiento de impuestos:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  const empresasPorId = useMemo(() => {
    const mapa = new Map<number, string>();
    empresas.forEach((empresa) => mapa.set(Number(empresa.id), empresa.nombre));
    return mapa;
  }, [empresas]);

  const periodosPorEmpresa = useMemo(() => {
    const mapa = new Map<number, ImpuestoPeriodo[]>();
    periodos.forEach((periodo) => {
      const empresaId = Number(periodo.empresa_id);
      mapa.set(empresaId, [...(mapa.get(empresaId) || []), periodo]);
    });
    return mapa;
  }, [periodos]);

  const totales = useMemo(() => {
    return documentos.reduce(
      (acc, item) => ({
        creditoFiscal: acc.creditoFiscal + Number(item.credito_fiscal || 0),
        debitoFiscal: acc.debitoFiscal + Number(item.debito_fiscal || 0),
        retenciones:
          acc.retenciones + Number(item.retencion_iva || 0) + Number(item.retencion_isr || 0),
        totalDocumentos: acc.totalDocumentos + Number(item.total || 0),
      }),
      { creditoFiscal: 0, debitoFiscal: 0, retenciones: 0, totalDocumentos: 0 }
    );
  }, [documentos]);

  const escrituraHabilitada = puedeEscribirAlgunaEmpresa();
  const empresasConfigurables = empresas.filter((empresa) => puedeConfigurar(empresa.id));
  const configuracionHabilitada = puedeConfigurarAlgunaEmpresa();
  const auditorSoloLectura = esAuditorSoloLectura();

  useEffect(() => {
    if (!empresasConfigurables.length) return;
    if (empresasConfigurables.some((empresa) => String(empresa.id) === formConfiguracion.empresaId)) {
      return;
    }
    setFormConfiguracion((actual) => ({
      ...actual,
      empresaId: String(empresasConfigurables[0].id),
    }));
  }, [empresas, funcionesOperativas, formConfiguracion.empresaId, userId]);

  if (validandoAcceso) {
    return <EstadoCentro>Validando acceso a Impuestos...</EstadoCentro>;
  }

  if (!autorizado) {
    return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este modulo."}</EstadoCentro>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Receipt className="text-cyan-500" size={42} />
                <h1 className="text-4xl font-black md:text-5xl">Impuestos</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">
                  Base operativa
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-[var(--muted)]">
                Registro fiscal revisable para configuracion, documentos, periodos,
                resumenes y vencimientos. No genera pagos, CxP ni asientos contables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargarDatos()}
              disabled={cargando || !empresasOperativasIds.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-3 text-sm font-black text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              Actualizar datos
            </button>
          </header>

          <Avisos
            aviso={aviso}
            error={errorCarga}
            exito={exito}
            auditorSoloLectura={auditorSoloLectura}
            escrituraHabilitada={escrituraHabilitada}
          />

          <ResumenGeneral
            configuraciones={configuraciones}
            documentos={documentos}
            periodos={periodos}
            calendario={calendario}
            totales={totales}
          />

          <Tabs tab={tab} setTab={setTab} />

          {tab === "resumen" && (
            <Panel
              titulo="Vista general"
              subtitulo="Lectura conectada a Supabase, sin calculos fiscales definitivos."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <MiniResumen titulo="Credito fiscal capturado" valor={monto(totales.creditoFiscal)} />
                <MiniResumen titulo="Debito fiscal capturado" valor={monto(totales.debitoFiscal)} />
                <MiniResumen titulo="Retenciones capturadas" valor={monto(totales.retenciones)} />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <TablaPeriodos periodos={periodos.slice(0, 6)} empresasPorId={empresasPorId} />
                <TablaCalendario calendario={calendario.slice(0, 6)} empresasPorId={empresasPorId} />
              </div>
            </Panel>
          )}

          {tab === "configuracion" && (
            <Panel titulo="Configuracion fiscal" subtitulo="Altas basicas de impuestos y retenciones.">
              {configuracionHabilitada ? (
                <FormularioConfiguracion
                  form={formConfiguracion}
                  setForm={setFormConfiguracion}
                  empresas={empresasConfigurables}
                  procesando={procesando}
                  onGuardar={guardarConfiguracion}
                />
              ) : (
                <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
              )}
              <TablaConfiguracion configuraciones={configuraciones} empresasPorId={empresasPorId} />
            </Panel>
          )}

          {tab === "documentos" && (
            <Panel titulo="Documentos fiscales" subtitulo="Metadata fiscal; adjuntos siguen en documentos_tramites.">
              {escrituraHabilitada ? (
                <FormularioDocumento
                  form={formDocumento}
                  setForm={setFormDocumento}
                  empresas={empresas}
                  procesando={procesando}
                  onGuardar={guardarDocumento}
                />
              ) : (
                <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
              )}
              <TablaDocumentos documentos={documentos} empresasPorId={empresasPorId} />
            </Panel>
          )}

          {tab === "periodos" && (
            <Panel titulo="Periodos fiscales" subtitulo="Creacion revisable de periodos, sin cierre automatico.">
              {escrituraHabilitada ? (
                <FormularioPeriodo
                  form={formPeriodo}
                  setForm={setFormPeriodo}
                  empresas={empresas}
                  procesando={procesando}
                  onGuardar={guardarPeriodo}
                />
              ) : (
                <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
              )}
              <TablaPeriodos periodos={periodos} empresasPorId={empresasPorId} />
            </Panel>
          )}

          {tab === "resumen_periodo" && (
            <Panel
              titulo="Resumen por periodo"
              subtitulo="Captura revisable; no calcula ni declara impuestos de forma automatica."
            >
              {escrituraHabilitada ? (
                <FormularioResumen
                  form={formResumen}
                  setForm={setFormResumen}
                  empresas={empresas}
                  periodosPorEmpresa={periodosPorEmpresa}
                  procesando={procesando}
                  onGuardar={guardarResumen}
                />
              ) : (
                <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
              )}
              <TablaResumenes resumenes={resumenes} empresasPorId={empresasPorId} periodos={periodos} />
            </Panel>
          )}

          {tab === "calendario" && (
            <Panel titulo="Vencimientos fiscales" subtitulo="Agenda fiscal interna, sin calendario operativo aun.">
              {escrituraHabilitada ? (
                <FormularioCalendario
                  form={formCalendario}
                  setForm={setFormCalendario}
                  empresas={empresas}
                  periodosPorEmpresa={periodosPorEmpresa}
                  procesando={procesando}
                  onGuardar={guardarCalendario}
                />
              ) : (
                <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
              )}
              <TablaCalendario calendario={calendario} empresasPorId={empresasPorId} />
            </Panel>
          )}

          {tab === "proximamente" && (
            <Panel
              titulo="Fase posterior"
              subtitulo="Funciones no incluidas en el alcance operativo inicial."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  "Calculo definitivo de IVA",
                  "Declaracion SAT/FEL",
                  "Generar CxP fiscal",
                  "Crear asiento contable",
                  "Adjuntar documentos desde este modulo",
                  "Sincronizar calendario operativo",
                ].map((item) => (
                  <BotonProximamente key={item} label={item} />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </main>
    </div>
  );
}

function EstadoCentro({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">
      {children}
    </div>
  );
}

function Avisos({
  aviso,
  error,
  exito,
  auditorSoloLectura,
  escrituraHabilitada,
}: {
  aviso: string | null;
  error: string | null;
  exito: string | null;
  auditorSoloLectura: boolean;
  escrituraHabilitada: boolean;
}) {
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-cyan-100">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-black">Impuestos conectado a datos operativos.</p>
            <p className="mt-1 text-sm">
              Esta pantalla registra datos revisables y auditoria central. Los calculos
              definitivos, SAT/FEL, pagos, CxP y contabilidad formal siguen deshabilitados.
            </p>
          </div>
        </div>
      </section>
      {auditorSoloLectura && (
        <Banner tipo="info">
          Tu funcion auditor_solo_lectura permite consultar, pero bloquea altas y cambios.
        </Banner>
      )}
      {!escrituraHabilitada && !auditorSoloLectura && (
        <Banner tipo="info">No tienes una funcion operativa de escritura para Impuestos.</Banner>
      )}
      {aviso && <Banner tipo="info">{aviso}</Banner>}
      {error && <Banner tipo="error">{error}</Banner>}
      {exito && <Banner tipo="exito">{exito}</Banner>}
    </div>
  );
}

function Banner({ tipo, children }: { tipo: "info" | "error" | "exito"; children: ReactNode }) {
  const clase =
    tipo === "error"
      ? "border-red-400/30 bg-red-400/10 text-red-100"
      : tipo === "exito"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return <div className={`rounded-xl border p-3 text-sm font-semibold ${clase}`}>{children}</div>;
}

function ResumenGeneral({
  configuraciones,
  documentos,
  periodos,
  calendario,
  totales,
}: {
  configuraciones: ImpuestoConfiguracion[];
  documentos: ImpuestoDocumento[];
  periodos: ImpuestoPeriodo[];
  calendario: ImpuestoCalendario[];
  totales: { creditoFiscal: number; debitoFiscal: number; retenciones: number; totalDocumentos: number };
}) {
  const items = [
    { titulo: "Configuraciones activas", valor: String(configuraciones.filter((item) => item.activo).length) },
    { titulo: "Documentos fiscales", valor: String(documentos.length) },
    { titulo: "Periodos abiertos", valor: String(periodos.filter((item) => item.estado === "Abierto").length) },
    {
      titulo: "Vencimientos pendientes",
      valor: String(calendario.filter((item) => item.estado === "Pendiente").length),
    },
    { titulo: "Total documentado", valor: monto(totales.totalDocumentos) },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <article key={item.titulo} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">{item.titulo}</p>
          <h2 className="mt-3 text-2xl font-black">{item.valor}</h2>
        </article>
      ))}
    </section>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "resumen", label: "Resumen", icon: <ClipboardList size={15} /> },
    { id: "configuracion", label: "Configuracion", icon: <SlidersHorizontal size={15} /> },
    { id: "documentos", label: "Documentos", icon: <FileText size={15} /> },
    { id: "periodos", label: "Periodos", icon: <CalendarDays size={15} /> },
    { id: "resumen_periodo", label: "Resumen periodo", icon: <BadgeDollarSign size={15} /> },
    { id: "calendario", label: "Vencimientos", icon: <CalendarDays size={15} /> },
    { id: "proximamente", label: "Fase posterior", icon: <Lock size={15} /> },
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-2">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setTab(item.id)}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
            tab === item.id
              ? "bg-cyan-500 text-slate-950"
              : "text-[var(--muted-strong)] hover:bg-white/10 hover:text-[var(--foreground)]"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <h2 className="text-xl font-black">{titulo}</h2>
      <p className="mt-1 text-sm text-[var(--muted-strong)]">{subtitulo}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function MiniResumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-gray-400">{titulo}</p>
      <p className="mt-2 text-xl font-black">{valor}</p>
    </div>
  );
}

function FormularioBloqueado({ auditorSoloLectura }: { auditorSoloLectura: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
      {auditorSoloLectura
        ? "Modo auditor solo lectura: puedes consultar, pero no crear registros."
        : "No hay permisos operativos de escritura para crear registros de Impuestos."}
    </div>
  );
}

function FormularioConfiguracion({
  form,
  setForm,
  empresas,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioConfiguracionInicial>;
  setForm: (form: ReturnType<typeof formularioConfiguracionInicial>) => void;
  empresas: Empresa[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">
        Crear configuracion
      </h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <input className="input-custom" value={form.impuestoId} onChange={(e) => setForm({ ...form, impuestoId: e.target.value })} placeholder="Impuesto ID" />
        <input className="input-custom" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" />
        <select className="input-custom" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {TIPOS_IMPUESTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <input className="input-custom" type="number" min="0" max="100" step="0.0001" value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} placeholder="Porcentaje" />
        <input className="input-custom" value={form.cuentaContableId} onChange={(e) => setForm({ ...form, cuentaContableId: e.target.value })} placeholder="Cuenta contable UUID" />
        <input className="input-custom" value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })} placeholder="Proveedor ID texto" />
        <input className="input-custom" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} placeholder="Cliente ID texto" />
        <Checkbox label="Aplica compra" checked={form.aplicaCompra} onChange={(valor) => setForm({ ...form, aplicaCompra: valor })} />
        <Checkbox label="Aplica venta" checked={form.aplicaVenta} onChange={(valor) => setForm({ ...form, aplicaVenta: valor })} />
        <Checkbox label="Aplica retencion" checked={form.aplicaRetencion} onChange={(valor) => setForm({ ...form, aplicaRetencion: valor })} />
        <input className="input-custom" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length} onGuardar={onGuardar} label="Guardar configuracion" />
      </div>
    </div>
  );
}

function FormularioDocumento({
  form,
  setForm,
  empresas,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioDocumentoInicial>;
  setForm: (form: ReturnType<typeof formularioDocumentoInicial>) => void;
  empresas: Empresa[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">
        Registrar documento fiscal
      </h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <select className="input-custom" value={form.tipoDocumento} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value })}>
          {TIPOS_DOCUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <select className="input-custom" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
          {ESTADOS_DOCUMENTO.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom" value={form.moduloOrigen} onChange={(e) => setForm({ ...form, moduloOrigen: e.target.value })} placeholder="Modulo origen" />
        <input className="input-custom" value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })} placeholder="Proveedor ID texto" />
        <input className="input-custom" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} placeholder="Cliente ID texto" />
        <input className="input-custom" value={form.nitEmisor} onChange={(e) => setForm({ ...form, nitEmisor: e.target.value })} placeholder="NIT emisor" />
        <input className="input-custom" value={form.nitReceptor} onChange={(e) => setForm({ ...form, nitReceptor: e.target.value })} placeholder="NIT receptor" />
        <input className="input-custom" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="Serie" />
        <input className="input-custom" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Numero" />
        <input className="input-custom" type="date" value={form.fechaDocumento} onChange={(e) => setForm({ ...form, fechaDocumento: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaRecepcion} onChange={(e) => setForm({ ...form, fechaRecepcion: e.target.value })} />
        <input className="input-custom" type="number" min="0" step="0.000001" value={form.tipoCambio} onChange={(e) => setForm({ ...form, tipoCambio: e.target.value })} placeholder="Tipo cambio" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} placeholder="Subtotal" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.iva} onChange={(e) => setForm({ ...form, iva: e.target.value })} placeholder="IVA" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="Total" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.creditoFiscal} onChange={(e) => setForm({ ...form, creditoFiscal: e.target.value })} placeholder="Credito fiscal" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.debitoFiscal} onChange={(e) => setForm({ ...form, debitoFiscal: e.target.value })} placeholder="Debito fiscal" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.retencionIva} onChange={(e) => setForm({ ...form, retencionIva: e.target.value })} placeholder="Retencion IVA" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.retencionIsr} onChange={(e) => setForm({ ...form, retencionIsr: e.target.value })} placeholder="Retencion ISR" />
        <Checkbox label="Sensible" checked={form.sensible} onChange={(valor) => setForm({ ...form, sensible: valor })} />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length} onGuardar={onGuardar} label="Guardar documento" />
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
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear periodo fiscal</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <input className="input-custom" type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} placeholder="Anio" />
        <select className="input-custom" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })}>
          {MESES.map((mes, index) => <option key={mes} value={String(index + 1)}>{mes}</option>)}
        </select>
        <input className="input-custom" value={form.tipoPeriodo} onChange={(e) => setForm({ ...form, tipoPeriodo: e.target.value })} placeholder="Tipo periodo" />
        <select className="input-custom" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
          {ESTADOS_PERIODO.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
        <input className="input-custom" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
        <input className="input-custom md:col-span-3" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length} onGuardar={onGuardar} label="Guardar periodo" />
      </div>
    </div>
  );
}

function FormularioResumen({
  form,
  setForm,
  empresas,
  periodosPorEmpresa,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioResumenInicial>;
  setForm: (form: ReturnType<typeof formularioResumenInicial>) => void;
  empresas: Empresa[];
  periodosPorEmpresa: Map<number, ImpuestoPeriodo[]>;
  procesando: boolean;
  onGuardar: () => void;
}) {
  const periodos = periodosPorEmpresa.get(Number(form.empresaId)) || [];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear resumen fiscal</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, periodoId: "" })} />
        <SelectPeriodo value={form.periodoId} periodos={periodos} onChange={(periodoId) => setForm({ ...form, periodoId })} />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <select className="input-custom" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
          {ESTADOS_RESUMEN.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
        <input className="input-custom" type="number" min="0" step="0.01" value={form.totalCompras} onChange={(e) => setForm({ ...form, totalCompras: e.target.value })} placeholder="Total compras" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.totalVentas} onChange={(e) => setForm({ ...form, totalVentas: e.target.value })} placeholder="Total ventas" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.creditoFiscal} onChange={(e) => setForm({ ...form, creditoFiscal: e.target.value })} placeholder="Credito fiscal" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.debitoFiscal} onChange={(e) => setForm({ ...form, debitoFiscal: e.target.value })} placeholder="Debito fiscal" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.ivaPorPagar} onChange={(e) => setForm({ ...form, ivaPorPagar: e.target.value })} placeholder="IVA por pagar" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.ivaAFavor} onChange={(e) => setForm({ ...form, ivaAFavor: e.target.value })} placeholder="IVA a favor" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.retencionesIva} onChange={(e) => setForm({ ...form, retencionesIva: e.target.value })} placeholder="Retenciones IVA" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.retencionesIsr} onChange={(e) => setForm({ ...form, retencionesIsr: e.target.value })} placeholder="Retenciones ISR" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.isrEstimado} onChange={(e) => setForm({ ...form, isrEstimado: e.target.value })} placeholder="ISR estimado" />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length || !periodos.length} onGuardar={onGuardar} label="Guardar resumen" />
      </div>
    </div>
  );
}

function FormularioCalendario({
  form,
  setForm,
  empresas,
  periodosPorEmpresa,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioCalendarioInicial>;
  setForm: (form: ReturnType<typeof formularioCalendarioInicial>) => void;
  empresas: Empresa[];
  periodosPorEmpresa: Map<number, ImpuestoPeriodo[]>;
  procesando: boolean;
  onGuardar: () => void;
}) {
  const periodos = periodosPorEmpresa.get(Number(form.empresaId)) || [];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear vencimiento</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, periodoId: "" })} />
        <SelectPeriodo value={form.periodoId} periodos={periodos} onChange={(periodoId) => setForm({ ...form, periodoId })} opcional />
        <input className="input-custom" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Titulo" />
        <select className="input-custom" value={form.tipoObligacion} onChange={(e) => setForm({ ...form, tipoObligacion: e.target.value })}>
          {TIPOS_OBLIGACION.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <input className="input-custom" type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
        <select className="input-custom" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
          {ESTADOS_CALENDARIO.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
        </select>
        <input className="input-custom" type="number" min="0" step="0.01" value={form.montoEstimado} onChange={(e) => setForm({ ...form, montoEstimado: e.target.value })} placeholder="Monto estimado" />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom" value={form.responsableId} onChange={(e) => setForm({ ...form, responsableId: e.target.value })} placeholder="Responsable UUID" />
        <Checkbox label="Visible calendario" checked={form.visibleCalendario} onChange={(valor) => setForm({ ...form, visibleCalendario: valor })} />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length} onGuardar={onGuardar} label="Guardar vencimiento" />
      </div>
    </div>
  );
}

function SelectEmpresa({
  value,
  empresas,
  onChange,
}: {
  value: string;
  empresas: Empresa[];
  onChange: (value: string) => void;
}) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Empresa...</option>
      {empresas.map((empresa) => (
        <option key={empresa.id} value={String(empresa.id)}>
          {empresa.nombre}
        </option>
      ))}
    </select>
  );
}

function SelectPeriodo({
  value,
  periodos,
  onChange,
  opcional = false,
}: {
  value: string;
  periodos: ImpuestoPeriodo[];
  onChange: (value: string) => void;
  opcional?: boolean;
}) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{opcional ? "Sin periodo..." : "Periodo..."}</option>
      {periodos.map((periodo) => (
        <option key={periodo.id} value={periodo.id}>
          {periodo.anio} / {MESES[periodo.mes - 1] || periodo.mes} - {periodo.tipo_periodo}
        </option>
      ))}
    </select>
  );
}

function SelectMoneda({ value, onChange }: { value: Moneda; onChange: (value: Moneda) => void }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value as Moneda)}>
      {MONEDAS.map((moneda) => (
        <option key={moneda} value={moneda}>
          {moneda}
        </option>
      ))}
    </select>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-[3.25rem] items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function BotonGuardar({
  procesando,
  disabled,
  onGuardar,
  label,
}: {
  procesando: boolean;
  disabled: boolean;
  onGuardar: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      disabled={procesando || disabled}
      className="btn-primary inline-flex items-center justify-center gap-2"
    >
      {procesando ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
      {label}
    </button>
  );
}

function TablaConfiguracion({
  configuraciones,
  empresasPorId,
}: {
  configuraciones: ImpuestoConfiguracion[];
  empresasPorId: Map<number, string>;
}) {
  if (!configuraciones.length) return <EmptyState texto="No hay configuraciones fiscales para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Nombre", "Tipo", "Porcentaje", "Aplica", "Proveedor/Cliente", "Estado", "Acciones"].map((col) => (
            <th key={col} className="px-4 py-3 text-left">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {configuraciones.map((item) => (
          <tr key={item.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(item.empresa_id)) || `Empresa #${item.empresa_id}`}</td>
            <td className="px-4 py-4"><p className="font-bold">{item.nombre}</p><p className="text-xs text-gray-500">{item.impuesto_id || "-"}</p></td>
            <td className="px-4 py-4 text-gray-300">{item.tipo}</td>
            <td className="px-4 py-4 text-gray-300">{Number(item.porcentaje || 0).toFixed(4)}%</td>
            <td className="px-4 py-4 text-gray-300">Compra: {item.aplica_compra ? "Si" : "No"}<br />Venta: {item.aplica_venta ? "Si" : "No"}<br />Retencion: {item.aplica_retencion ? "Si" : "No"}</td>
            <td className="px-4 py-4 text-gray-300">Proveedor {item.proveedor_id || "-"}<br />Cliente {item.cliente_id || "-"}</td>
            <td className="px-4 py-4"><Badge estado={item.activo ? "Activa" : "Inactiva"} /></td>
            <td className="px-4 py-4"><div className="flex flex-col gap-2"><BotonProximamente label="Editar" /><BotonProximamente label="Inactivar" /></div></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaDocumentos({ documentos, empresasPorId }: { documentos: ImpuestoDocumento[]; empresasPorId: Map<number, string> }) {
  if (!documentos.length) return <EmptyState texto="No hay documentos fiscales para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Documento", "NIT", "Fechas", "Montos", "Estado", "Acciones"].map((col) => (
            <th key={col} className="px-4 py-3 text-left">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {documentos.map((item) => (
          <tr key={item.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(item.empresa_id)) || `Empresa #${item.empresa_id}`}</td>
            <td className="px-4 py-4"><p className="font-bold">{item.tipo_documento}</p><p className="text-xs text-gray-500">{item.serie || "-"} / {item.numero || "-"}</p></td>
            <td className="px-4 py-4 text-gray-300">Emisor {item.nit_emisor || "-"}<br />Receptor {item.nit_receptor || "-"}</td>
            <td className="px-4 py-4 text-gray-300">Doc {fechaMostrar(item.fecha_documento)}<br />Recepcion {fechaMostrar(item.fecha_recepcion)}</td>
            <td className="px-4 py-4 text-gray-300">Subtotal {monto(item.subtotal, item.moneda)}<br />IVA {monto(item.iva, item.moneda)}<br />Total {monto(item.total, item.moneda)}</td>
            <td className="px-4 py-4"><Badge estado={item.estado} /></td>
            <td className="px-4 py-4"><div className="flex flex-col gap-2"><BotonProximamente label="Adjuntar soporte" /><BotonProximamente label="Revisar" /><BotonProximamente label="Anular" /></div></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaPeriodos({ periodos, empresasPorId }: { periodos: ImpuestoPeriodo[]; empresasPorId: Map<number, string> }) {
  if (!periodos.length) return <EmptyState texto="No hay periodos fiscales para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Periodo", "Fechas", "Estado", "Acciones"].map((col) => (
            <th key={col} className="px-4 py-3 text-left">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {periodos.map((item) => (
          <tr key={item.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(item.empresa_id)) || `Empresa #${item.empresa_id}`}</td>
            <td className="px-4 py-4"><p className="font-bold">{item.anio} / {MESES[item.mes - 1] || item.mes}</p><p className="text-xs text-gray-500">{item.tipo_periodo}</p></td>
            <td className="px-4 py-4 text-gray-300">Inicio {fechaMostrar(item.fecha_inicio)}<br />Fin {fechaMostrar(item.fecha_fin)}<br />Vence {fechaMostrar(item.fecha_vencimiento)}</td>
            <td className="px-4 py-4"><Badge estado={item.estado} /></td>
            <td className="px-4 py-4"><div className="flex flex-col gap-2"><BotonProximamente label="Cerrar" /><BotonProximamente label="Declarar" /><BotonProximamente label="Anular" /></div></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaResumenes({
  resumenes,
  empresasPorId,
  periodos,
}: {
  resumenes: ImpuestoResumenPeriodo[];
  empresasPorId: Map<number, string>;
  periodos: ImpuestoPeriodo[];
}) {
  if (!resumenes.length) return <EmptyState texto="No hay resumenes fiscales para mostrar." />;
  const periodosPorId = new Map(periodos.map((periodo) => [periodo.id, periodo]));
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Periodo", "IVA", "Retenciones/ISR", "Estado", "Acciones"].map((col) => (
            <th key={col} className="px-4 py-3 text-left">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {resumenes.map((item) => {
          const periodo = periodosPorId.get(item.periodo_id);
          return (
            <tr key={item.id} className="align-top text-sm">
              <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(item.empresa_id)) || `Empresa #${item.empresa_id}`}</td>
              <td className="px-4 py-4 text-gray-300">{periodo ? `${periodo.anio} / ${MESES[periodo.mes - 1] || periodo.mes}` : item.periodo_id}</td>
              <td className="px-4 py-4 text-gray-300">Credito {monto(item.credito_fiscal, item.moneda)}<br />Debito {monto(item.debito_fiscal, item.moneda)}<br />Por pagar {monto(item.iva_por_pagar, item.moneda)}<br />A favor {monto(item.iva_a_favor, item.moneda)}</td>
              <td className="px-4 py-4 text-gray-300">Ret. IVA {monto(item.retenciones_iva, item.moneda)}<br />Ret. ISR {monto(item.retenciones_isr, item.moneda)}<br />ISR est. {monto(item.isr_estimado, item.moneda)}</td>
              <td className="px-4 py-4"><Badge estado={item.estado} /></td>
              <td className="px-4 py-4"><div className="flex flex-col gap-2"><BotonProximamente label="Declarar" /><BotonProximamente label="Generar CxP" /><BotonProximamente label="Crear asiento" /></div></td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function TablaCalendario({ calendario, empresasPorId }: { calendario: ImpuestoCalendario[]; empresasPorId: Map<number, string> }) {
  if (!calendario.length) return <EmptyState texto="No hay vencimientos fiscales para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400">
        <tr>
          {["Empresa", "Titulo", "Tipo", "Vencimiento", "Monto", "Estado", "Acciones"].map((col) => (
            <th key={col} className="px-4 py-3 text-left">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {calendario.map((item) => (
          <tr key={item.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(item.empresa_id)) || `Empresa #${item.empresa_id}`}</td>
            <td className="px-4 py-4"><p className="font-bold">{item.titulo}</p><p className="text-xs text-gray-500">{item.visible_calendario ? "Visible" : "Interno"}</p></td>
            <td className="px-4 py-4 text-gray-300">{item.tipo_obligacion}</td>
            <td className="px-4 py-4 text-gray-300">{fechaMostrar(item.fecha_vencimiento)}</td>
            <td className="px-4 py-4 text-gray-300">{monto(item.monto_estimado, item.moneda)}</td>
            <td className="px-4 py-4"><Badge estado={item.estado} /></td>
            <td className="px-4 py-4"><div className="flex flex-col gap-2"><BotonProximamente label="Cumplir" /><BotonProximamente label="Conectar calendario" /><BotonProximamente label="Anular" /></div></td>
          </tr>
        ))}
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
  const clase = texto.includes("abierto") || texto.includes("pendiente") || texto.includes("registrado")
    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
    : texto.includes("anulado") || texto.includes("vencido")
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : texto.includes("declarado") || texto.includes("cumplido") || texto.includes("cerrado")
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
        : "border-white/10 bg-white/5 text-gray-300";

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${clase}`}>{estado}</span>;
}

function BotonProximamente({ label }: { label: string }) {
  void label;
  return null;
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-400">
      {texto}
    </div>
  );
}
