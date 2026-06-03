"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { validarRespaldoDocumentalActivo } from "../../lib/documentosTramites";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import { AlertTriangle, Ban, Loader2, Plus, RefreshCcw, Search, WalletCards } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
}

interface Cliente {
  id: string | number;
  empresa_id: number;
  nit: string;
  nombre: string;
  estado: string;
  dias_credito: number | null;
}

interface DocumentoContable {
  id: string | number;
  empresa_id: number;
  cliente_id: string | number | null;
  tipo_documento: string;
  serie: string | null;
  numero_documento: string;
  fecha_documento: string;
  fecha_vencimiento: string | null;
  moneda: string;
  total: number;
  estado: string;
}

interface CuentaCobrar {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  cliente_id: string | number;
  documento_contable_id: string | number | null;
  serie: string | null;
  numero_documento: string;
  fecha_documento: string;
  fecha_vencimiento: string;
  moneda: string;
  total: number;
  saldo_pendiente: number;
  estado: string;
  observaciones: string | null;
  creado_por: string | null;
  actualizado_por: string | null;
}

interface PagoCuentaCobrar {
  id: string | number;
  cuenta_por_cobrar_id: string | number;
  empresa_id: number;
  cliente_id: string | number;
  fecha_pago: string;
  metodo_pago: string;
  banco: string | null;
  referencia: string | null;
  moneda: string;
  monto: number;
  observaciones: string | null;
  estado: string;
  creado_por: string | null;
  creado_at: string | null;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
}

interface ResultadoPagoCxC {
  ok?: boolean;
  mensaje?: string;
  pago: PagoCuentaCobrar;
  cuenta: CuentaCobrar;
  idempotency_replay?: boolean;
}

const IDEMPOTENCY_PREFIX_CXC = "controlplus_idempotency_cxc";
const ESTADOS_CXC = ["Pendiente", "Parcial", "Pagado", "Vencido", "Anulado"];
const MONEDAS = ["GTQ", "USD"];
const METODOS_PAGO = ["Efectivo", "Transferencia", "Depósito", "Cheque", "Otro"];
const COLUMNAS_CXC =
  "id,creado_at,actualizado_at,empresa_id,cliente_id,documento_contable_id,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,total,saldo_pendiente,estado,observaciones,creado_por,actualizado_por";
const COLUMNAS_PAGOS_CXC =
  "id,cuenta_por_cobrar_id,empresa_id,cliente_id,fecha_pago,metodo_pago,banco,referencia,moneda,monto,observaciones,estado,creado_por,creado_at,anulado_por,anulado_at,motivo_anulacion";

function textoONull(valor: string) {
  const texto = valor.trim();
  return texto ? texto : null;
}

function numero(valor: string | number | null | undefined) {
  const resultado = Number(valor || 0);
  if (!Number.isFinite(resultado)) {
    throw new Error("El monto debe ser numerico.");
  }
  return Math.round(resultado * 100) / 100;
}

function fechaHoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function generarIdempotencyKey() {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `cxc-${aleatorio}`;
}

function obtenerIdempotencyKey(alcance: string) {
  const storageKey = `${IDEMPOTENCY_PREFIX_CXC}:${alcance}`;
  const existente = window.localStorage.getItem(storageKey);
  if (existente) return existente;

  const nuevo = generarIdempotencyKey();
  window.localStorage.setItem(storageKey, nuevo);
  return nuevo;
}

function liberarIdempotencyKey(alcance: string) {
  window.localStorage.removeItem(`${IDEMPOTENCY_PREFIX_CXC}:${alcance}`);
}

function esErrorOperacionEnProceso(error: unknown) {
  return getErrorMessage(error).toLowerCase().includes("en proceso");
}

function validarResultadoRpcPago(resultado: unknown) {
  if (
    resultado &&
    typeof resultado === "object" &&
    "ok" in resultado &&
    resultado.ok === false
  ) {
    const mensaje =
      "mensaje" in resultado && typeof resultado.mensaje === "string"
        ? resultado.mensaje
        : "Operacion no permitida.";
    throw new Error(mensaje);
  }
}

function estaVencida(cuenta: CuentaCobrar) {
  if (["Pagado", "Anulado"].includes(cuenta.estado)) return false;
  return new Date(`${cuenta.fecha_vencimiento}T23:59:59`).getTime() < Date.now();
}

export default function CuentasCobrarPage() {
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoContable[]>([]);
  const [cuentasCobrar, setCuentasCobrar] = useState<CuentaCobrar[]>([]);
  const [pagos, setPagos] = useState<PagoCuentaCobrar[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cuentaEditandoId, setCuentaEditandoId] = useState<string | number | null>(null);
  const [cuentaPagoId, setCuentaPagoId] = useState<string | number | null>(null);

  const [form, setForm] = useState({
    empresaId: "",
    clienteId: "",
    documentoContableId: "",
    serie: "",
    numeroDocumento: "",
    fechaDocumento: fechaHoyISO(),
    fechaVencimiento: fechaHoyISO(),
    moneda: "GTQ",
    total: "",
    saldoPendiente: "",
    estado: "Pendiente",
    observaciones: "",
  });

  const [formPago, setFormPago] = useState({
    fechaPago: fechaHoyISO(),
    metodoPago: "Transferencia",
    banco: "",
    referencia: "",
    monto: "",
    observaciones: "",
  });

  useEffect(() => {
    void iniciar();
  }, []);

  async function iniciar() {
    try {
      setValidandoAcceso(true);
      const acceso = await validarAccesoModuloUsuario("cuentas-cobrar");

      if (!acceso.ok) {
        if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
          window.location.href = "/login";
          return;
        }

        toast.error("No tienes acceso a Cuentas por Cobrar.");
        window.location.href = "/dashboard";
        return;
      }

      const idsPermitidos = await obtenerEmpresasPermitidas(
        acceso.user!.id,
        acceso.perfil?.rol || ""
      );
      const funciones = await listarFuncionesOperativasUsuario(acceso.user!.id, idsPermitidos);

      setUserId(acceso.user!.id);
      setEmpresasPermitidasIds(idsPermitidos);
      setFuncionesOperativas(funciones);
      setAutorizado(true);
      setValidandoAcceso(false);
      setCargando(true);
      await cargarDatos(idsPermitidos);
    } catch (error) {
      console.error("Error cargando CxC:", error);
      toast.error("Error cargando Cuentas por Cobrar.");
    } finally {
      setCargando(false);
      setValidandoAcceso(false);
    }
  }

  async function cargarDatos(idsPermitidos = empresasPermitidasIds) {
    if (!idsPermitidos.length) {
      setEmpresas([]);
      setClientes([]);
      setDocumentos([]);
      setCuentasCobrar([]);
      setPagos([]);
      return;
    }

    const [resEmpresas, resClientes, resDocumentos, resCxc, resPagos] = await Promise.all([
      supabase.from("empresas").select("id,nombre").in("id", idsPermitidos).order("nombre"),
      supabase
        .from("clientes")
        .select("id,empresa_id,nit,nombre,estado,dias_credito")
        .in("empresa_id", idsPermitidos)
        .eq("estado", "Activo")
        .order("nombre"),
      supabase
        .from("documentos_contables_revision")
        .select("id,empresa_id,cliente_id,tipo_documento,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,total,estado")
        .in("empresa_id", idsPermitidos)
        .not("cliente_id", "is", null)
        .order("fecha_documento", { ascending: false }),
      supabase
        .from("cuentas_por_cobrar")
        .select(COLUMNAS_CXC)
        .in("empresa_id", idsPermitidos)
        .order("fecha_vencimiento", { ascending: true }),
      supabase
        .from("pagos_cuentas_por_cobrar")
        .select(COLUMNAS_PAGOS_CXC)
        .in("empresa_id", idsPermitidos)
        .order("fecha_pago", { ascending: false }),
    ]);

    if (resEmpresas.error) throw resEmpresas.error;
    if (resClientes.error) throw resClientes.error;
    if (resDocumentos.error) throw resDocumentos.error;
    if (resCxc.error) throw resCxc.error;
    if (resPagos.error) throw resPagos.error;

    setEmpresas((resEmpresas.data || []) as Empresa[]);
    setClientes((resClientes.data || []) as Cliente[]);
    setDocumentos((resDocumentos.data || []) as DocumentoContable[]);
    setCuentasCobrar((resCxc.data || []) as CuentaCobrar[]);
    setPagos((resPagos.data || []) as PagoCuentaCobrar[]);

    if (!form.empresaId && resEmpresas.data?.length) {
      setForm((actual) => ({ ...actual, empresaId: String(resEmpresas.data[0].id) }));
    }
  }

  function validarEmpresaPermitida(valor: string | number) {
    const empresaId = Number(valor);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error("Selecciona una empresa valida.");
    }
    if (!empresasPermitidasIds.includes(empresaId)) {
      throw new Error("No tienes permiso para operar sobre esa empresa.");
    }
    return empresaId;
  }

  function esAuditorSoloLectura(empresaId?: string | number | null) {
    return esAuditorSoloLecturaLocal(
      funcionesOperativas,
      empresaId ? [empresaId] : empresasPermitidasIds
    );
  }

  async function bloquearAuditor(accion: string, empresaId?: string | number | null, entidadId?: string | number | null) {
    const empresaNumero = Number(empresaId || 0);
    const mensaje = "El auditor solo lectura no puede modificar Cuentas por Cobrar.";
    toast.error(mensaje);
    try {
      await registrarAuditoriaEvento({
        empresa_id: Number.isFinite(empresaNumero) && empresaNumero > 0 ? empresaNumero : null,
        modulo: "cuentas-cobrar",
        accion: "intento_bloqueado_auditor_solo_lectura",
        entidad_tipo: "cuentas_por_cobrar",
        entidad_id: entidadId || null,
        descripcion: mensaje,
        sensible: true,
        metadatos: { accion_intentada: accion },
        origen: "modulo_cuentas_cobrar",
      });
    } catch (error) {
      console.warn("No se pudo auditar bloqueo de auditor:", error);
    }
  }

  function clienteSeleccionado() {
    return clientes.find((cliente) => String(cliente.id) === String(form.clienteId));
  }

  function documentoSeleccionado() {
    return documentos.find(
      (documento) => String(documento.id) === String(form.documentoContableId)
    );
  }

  function aplicarDocumento(documentoId: string) {
    const documento = documentos.find((item) => String(item.id) === documentoId);
    if (!documento) {
      setForm({ ...form, documentoContableId: "" });
      return;
    }

    setForm({
      ...form,
      empresaId: String(documento.empresa_id),
      clienteId: documento.cliente_id ? String(documento.cliente_id) : "",
      documentoContableId: String(documento.id),
      serie: documento.serie || "",
      numeroDocumento: documento.numero_documento,
      fechaDocumento: documento.fecha_documento,
      fechaVencimiento: documento.fecha_vencimiento || documento.fecha_documento,
      moneda: documento.moneda,
      total: String(documento.total),
      saldoPendiente: String(documento.total),
      estado: "Pendiente",
    });
  }

  async function auditarCxC(accion: string, cuenta: CuentaCobrar, estadoAnterior?: string | null) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: cuenta.empresa_id,
        modulo: "cuentas-cobrar",
        accion,
        entidad_tipo: "cuenta_por_cobrar",
        entidad_id: cuenta.id,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: cuenta.estado,
        descripcion: "Cuenta por cobrar actualizada",
        sensible: true,
        metadatos: {
          cliente_id: cuenta.cliente_id,
          documento_contable_id: cuenta.documento_contable_id,
          numero_documento: cuenta.numero_documento,
          moneda: cuenta.moneda,
          total: cuenta.total,
          saldo_pendiente: cuenta.saldo_pendiente,
          pagos_parciales_preparados: true,
          asiento_automatico_creado: false,
        },
        origen: "modulo_cuentas_cobrar",
      });
    } catch (error) {
      console.error("CxC guardada, pero fallo auditoria:", error);
      toast.error("Cambio guardado, pero fallo la auditoria.");
    }
  }

  async function auditarPagoCxC(
    accion: string,
    pago: PagoCuentaCobrar,
    cuenta: CuentaCobrar,
    estadoAnterior?: string | null
  ) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: pago.empresa_id,
        modulo: "cuentas-cobrar",
        accion,
        entidad_tipo: "pago_cuenta_por_cobrar",
        entidad_id: pago.id,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: pago.estado,
        descripcion: "Pago de cuenta por cobrar actualizado",
        sensible: true,
        metadatos: {
          cuenta_por_cobrar_id: pago.cuenta_por_cobrar_id,
          cliente_id: pago.cliente_id,
          fecha_pago: pago.fecha_pago,
          metodo_pago: pago.metodo_pago,
          banco: pago.banco,
          referencia: pago.referencia,
          moneda: pago.moneda,
          monto: pago.monto,
          saldo_cxc_resultante: cuenta.saldo_pendiente,
          estado_cxc_resultante: cuenta.estado,
          comprobantes_adjuntos_preparados: true,
          asiento_automatico_creado: false,
        },
        origen: "modulo_cuentas_cobrar",
      });
    } catch (error) {
      console.error("Pago CxC guardado, pero fallo auditoria:", error);
      toast.error("Pago guardado, pero fallo la auditoria.");
    }
  }

  function calcularEstadoConSaldo(saldo: number) {
    if (saldo <= 0) return "Pagado";
    return "Parcial";
  }

  function pagosDeCuenta(cuentaId: string | number) {
    return pagos.filter(
      (pago) =>
        String(pago.cuenta_por_cobrar_id) === String(cuentaId) &&
        pago.estado !== "Anulado"
    );
  }

  function abrirPago(cuenta: CuentaCobrar) {
    if (esAuditorSoloLectura(cuenta.empresa_id)) {
      void bloquearAuditor("abrir_pago_cxc", cuenta.empresa_id, cuenta.id);
      return;
    }
    if (cuenta.estado === "Anulado" || cuenta.estado === "Pagado") {
      toast.error("Esta cuenta no acepta nuevos pagos.");
      return;
    }
    setCuentaPagoId(cuenta.id);
    setFormPago({
      fechaPago: fechaHoyISO(),
      metodoPago: "Transferencia",
      banco: "",
      referencia: "",
      monto: String(cuenta.saldo_pendiente || ""),
      observaciones: "",
    });
  }

  async function registrarPago(cuenta: CuentaCobrar) {
    if (procesando) {
      toast.error("Ya hay una operacion en proceso.");
      return;
    }

    if (!userId) {
      toast.error("Sesion no valida.");
      return;
    }

    let empresaId: number;
    let monto: number;

    try {
      empresaId = validarEmpresaPermitida(cuenta.empresa_id);
      monto = numero(formPago.monto);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (esAuditorSoloLectura(empresaId)) {
      await bloquearAuditor("registrar_pago_cxc", empresaId, cuenta.id);
      return;
    }

    if (cuenta.estado === "Anulado" || cuenta.estado === "Pagado") {
      toast.error("La cuenta por cobrar no acepta nuevos pagos.");
      return;
    }
    if (!formPago.fechaPago) {
      toast.error("La fecha de pago es obligatoria.");
      return;
    }
    if (!METODOS_PAGO.includes(formPago.metodoPago)) {
      toast.error("Metodo de pago no valido.");
      return;
    }
    if (monto <= 0) {
      toast.error("El monto del pago debe ser mayor a cero.");
      return;
    }
    if (monto > Number(cuenta.saldo_pendiente || 0)) {
      toast.error("El pago no puede ser mayor al saldo pendiente.");
      return;
    }

    const cliente = clientes.find((item) => String(item.id) === String(cuenta.cliente_id));
    if (!cliente || Number(cliente.empresa_id) !== empresaId) {
      toast.error("El cliente de la CxC no pertenece a la empresa seleccionada.");
      return;
    }
    if (!MONEDAS.includes(cuenta.moneda)) {
      toast.error("La moneda de la CxC no es valida.");
      return;
    }

    const idempotencyScope = [
      "registrar_pago_cxc",
      userId,
      cuenta.id,
      formPago.fechaPago,
      formPago.metodoPago,
      formPago.monto,
      formPago.referencia.trim(),
    ].join(":");
    const idempotencyKey = obtenerIdempotencyKey(idempotencyScope);

    setProcesando(true);
    const toastId = toast.loading("Registrando pago...");

    try {
      await validarRespaldoDocumentalActivo({
        empresa_id: empresaId,
        modulo: "cuentas-cobrar",
        entidad_tipo: "cuenta_por_cobrar",
        entidad_id: cuenta.id,
        operacion: "registrar cobro CxC",
        tipos_documento: ["recibo", "voucher", "transferencia", "depósito", "deposito", "comprobante", "documento soporte"],
      });

      const { data: resultadoRpc, error: rpcError } = await supabase.rpc(
        "registrar_pago_cxc",
        {
          p_cuenta_id: String(cuenta.id),
          p_empresa_id: empresaId,
          p_fecha_pago: formPago.fechaPago,
          p_metodo_pago: formPago.metodoPago,
          p_banco: textoONull(formPago.banco),
          p_referencia: textoONull(formPago.referencia),
          p_moneda: cuenta.moneda,
          p_monto: monto,
          p_observaciones: textoONull(formPago.observaciones),
          p_creado_por: userId,
          p_idempotency_key: idempotencyKey,
        }
      );

      if (rpcError) throw rpcError;
      validarResultadoRpcPago(resultadoRpc);
      const resultado = resultadoRpc as ResultadoPagoCxC;

      if (!resultado.idempotency_replay) {
        await auditarPagoCxC(
          "registrar_pago_cuenta_por_cobrar",
          resultado.pago,
          resultado.cuenta,
          null
        );
      }

      setCuentaPagoId(null);
      setFormPago({
        fechaPago: fechaHoyISO(),
        metodoPago: "Transferencia",
        banco: "",
        referencia: "",
        monto: "",
        observaciones: "",
      });
      await cargarDatos();
      liberarIdempotencyKey(idempotencyScope);
      toast.success("Pago registrado.", { id: toastId });
    } catch (error) {
      console.error("Error registrando pago CxC:", error);
      if (!esErrorOperacionEnProceso(error)) {
        liberarIdempotencyKey(idempotencyScope);
      }
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function anularPago(pago: PagoCuentaCobrar) {
    if (procesando) {
      toast.error("Ya hay una operacion en proceso.");
      return;
    }

    if (!userId) {
      toast.error("Sesion no valida.");
      return;
    }

    const cuenta = cuentasCobrar.find(
      (item) => String(item.id) === String(pago.cuenta_por_cobrar_id)
    );
    if (!cuenta) {
      toast.error("No se encontro la cuenta por cobrar del pago.");
      return;
    }

    const motivo = window.prompt("Motivo para anular el pago:");
    if (!motivo || motivo.trim().length < 5) {
      toast.error("Debes indicar un motivo valido.");
      return;
    }

    let empresaId: number;
    try {
      empresaId = validarEmpresaPermitida(pago.empresa_id);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (esAuditorSoloLectura(empresaId)) {
      await bloquearAuditor("anular_pago_cxc", empresaId, pago.cuenta_por_cobrar_id);
      return;
    }

    if (pago.estado === "Anulado") {
      toast.error("El pago ya esta anulado.");
      return;
    }
    if (cuenta.estado === "Anulado") {
      toast.error("No se puede devolver saldo a una CxC anulada.");
      return;
    }
    if (Number(cuenta.empresa_id) !== empresaId || Number(pago.empresa_id) !== empresaId) {
      toast.error("El pago y la CxC no pertenecen a la misma empresa.");
      return;
    }
    if (String(cuenta.cliente_id) !== String(pago.cliente_id)) {
      toast.error("El pago no pertenece al cliente de la CxC.");
      return;
    }
    if (cuenta.moneda !== pago.moneda) {
      toast.error("El pago y la CxC tienen monedas diferentes.");
      return;
    }

    const idempotencyScope = [
      "anular_pago_cxc",
      userId,
      pago.id,
      pago.cuenta_por_cobrar_id,
    ].join(":");
    const idempotencyKey = obtenerIdempotencyKey(idempotencyScope);

    setProcesando(true);
    const toastId = toast.loading("Anulando pago...");

    try {
      const { data: resultadoRpc, error: rpcError } = await supabase.rpc(
        "anular_pago_cxc",
        {
          p_pago_id: String(pago.id),
          p_empresa_id: empresaId,
          p_anulado_por: userId,
          p_motivo_anulacion: motivo.trim(),
          p_idempotency_key: idempotencyKey,
        }
      );

      if (rpcError) throw rpcError;
      validarResultadoRpcPago(resultadoRpc);
      const resultado = resultadoRpc as ResultadoPagoCxC;

      if (!resultado.idempotency_replay) {
        await auditarPagoCxC(
          "anular_pago_cuenta_por_cobrar",
          resultado.pago,
          resultado.cuenta,
          pago.estado
        );
      }

      await cargarDatos();
      liberarIdempotencyKey(idempotencyScope);
      toast.success("Pago anulado y saldo devuelto.", { id: toastId });
    } catch (error) {
      console.error("Error anulando pago CxC:", error);
      if (!esErrorOperacionEnProceso(error)) {
        liberarIdempotencyKey(idempotencyScope);
      }
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function guardarCuentaCobrar() {
    if (!userId) {
      toast.error("Sesion no valida.");
      return;
    }

    let empresaId: number;
    let total: number;
    let saldoPendiente: number;

    try {
      empresaId = validarEmpresaPermitida(form.empresaId);
      total = numero(form.total);
      saldoPendiente = numero(form.saldoPendiente || form.total);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (esAuditorSoloLectura(empresaId)) {
      await bloquearAuditor("guardar_cxc", empresaId, cuentaEditandoId || null);
      return;
    }

    if (!form.clienteId || !form.numeroDocumento.trim() || !form.fechaDocumento || !form.fechaVencimiento) {
      toast.error("Cliente, numero, fecha y vencimiento son obligatorios.");
      return;
    }

    if (!MONEDAS.includes(form.moneda)) {
      toast.error("La moneda debe ser GTQ o USD.");
      return;
    }

    if (total <= 0 || saldoPendiente < 0 || saldoPendiente > total) {
      toast.error("Total y saldo pendiente no son validos.");
      return;
    }

    const cliente = clienteSeleccionado();
    if (!cliente || Number(cliente.empresa_id) !== empresaId) {
      toast.error("El cliente no pertenece a la empresa seleccionada.");
      return;
    }

    const documento = documentoSeleccionado();
    if (documento) {
      if (Number(documento.empresa_id) !== empresaId) {
        toast.error("El documento contable pertenece a otra empresa.");
        return;
      }
      if (String(documento.cliente_id) !== String(form.clienteId)) {
        toast.error("El documento contable pertenece a otro cliente.");
        return;
      }
      if (documento.moneda !== form.moneda) {
        toast.error("No se puede mezclar moneda entre documento y CxC.");
        return;
      }
    }

    const payload = {
      empresa_id: empresaId,
      cliente_id: form.clienteId,
      documento_contable_id: form.documentoContableId || null,
      serie: textoONull(form.serie),
      numero_documento: form.numeroDocumento.trim(),
      fecha_documento: form.fechaDocumento,
      fecha_vencimiento: form.fechaVencimiento,
      moneda: form.moneda,
      total,
      saldo_pendiente: saldoPendiente,
      estado: form.estado,
      observaciones: textoONull(form.observaciones),
      actualizado_at: new Date().toISOString(),
      actualizado_por: userId,
      metadatos: {
        preparado_pagos_parciales: true,
        preparado_reportes: true,
        preparado_estado_resultados: true,
        preparado_balance: true,
        asiento_automatico_creado: false,
      },
    };

    setProcesando(true);
    const toastId = toast.loading(cuentaEditandoId ? "Actualizando CxC..." : "Creando CxC...");

    try {
      const anterior = cuentasCobrar.find((cuenta) => String(cuenta.id) === String(cuentaEditandoId));
      const query = cuentaEditandoId
        ? supabase
            .from("cuentas_por_cobrar")
            .update(payload)
            .eq("id", cuentaEditandoId)
            .eq("empresa_id", empresaId)
        : supabase.from("cuentas_por_cobrar").insert({
            ...payload,
            creado_por: userId,
          });

      const { data, error } = await query.select(COLUMNAS_CXC).single();
      if (error) throw error;

      const cuenta = data as CuentaCobrar;
      await auditarCxC(cuentaEditandoId ? "actualizar_cuenta_por_cobrar" : "crear_cuenta_por_cobrar", cuenta, anterior?.estado || null);
      limpiarFormulario(String(empresaId));
      await cargarDatos();
      toast.success("Cuenta por cobrar guardada.", { id: toastId });
    } catch (error) {
      console.error("Error guardando CxC:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function anularCuenta(cuenta: CuentaCobrar) {
    if (esAuditorSoloLectura(cuenta.empresa_id)) {
      await bloquearAuditor("anular_cxc", cuenta.empresa_id, cuenta.id);
      return;
    }

    const motivo = window.prompt("Motivo para anular la cuenta por cobrar:");
    if (!motivo || motivo.trim().length < 5) {
      toast.error("Debes indicar un motivo valido.");
      return;
    }

    setProcesando(true);
    const toastId = toast.loading("Anulando CxC...");

    try {
      const { data, error } = await supabase
        .from("cuentas_por_cobrar")
        .update({
          estado: "Anulado",
          observaciones: motivo.trim(),
          actualizado_at: new Date().toISOString(),
          actualizado_por: userId,
        })
        .eq("id", cuenta.id)
        .eq("empresa_id", cuenta.empresa_id)
        .select(COLUMNAS_CXC)
        .single();

      if (error) throw error;

      await auditarCxC("anular_cuenta_por_cobrar", data as CuentaCobrar, cuenta.estado);
      await cargarDatos();
      toast.success("Cuenta por cobrar anulada.", { id: toastId });
    } catch (error) {
      console.error("Error anulando CxC:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  function cargarParaEditar(cuenta: CuentaCobrar) {
    if (esAuditorSoloLectura(cuenta.empresa_id)) {
      void bloquearAuditor("editar_cxc", cuenta.empresa_id, cuenta.id);
      return;
    }

    setCuentaEditandoId(cuenta.id);
    setForm({
      empresaId: String(cuenta.empresa_id),
      clienteId: String(cuenta.cliente_id),
      documentoContableId: cuenta.documento_contable_id ? String(cuenta.documento_contable_id) : "",
      serie: cuenta.serie || "",
      numeroDocumento: cuenta.numero_documento,
      fechaDocumento: cuenta.fecha_documento,
      fechaVencimiento: cuenta.fecha_vencimiento,
      moneda: cuenta.moneda,
      total: String(cuenta.total),
      saldoPendiente: String(cuenta.saldo_pendiente),
      estado: cuenta.estado,
      observaciones: cuenta.observaciones || "",
    });
  }

  function limpiarFormulario(empresaId = form.empresaId) {
    setCuentaEditandoId(null);
    setForm({
      empresaId,
      clienteId: "",
      documentoContableId: "",
      serie: "",
      numeroDocumento: "",
      fechaDocumento: fechaHoyISO(),
      fechaVencimiento: fechaHoyISO(),
      moneda: "GTQ",
      total: "",
      saldoPendiente: "",
      estado: "Pendiente",
      observaciones: "",
    });
  }

  const clientesDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return clientes.filter((cliente) => Number(cliente.empresa_id) === empresaId);
  }, [clientes, form.empresaId]);

  const documentosDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return documentos.filter((documento) => Number(documento.empresa_id) === empresaId);
  }, [documentos, form.empresaId]);

  const cuentasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return cuentasCobrar;

    return cuentasCobrar.filter((cuenta) => {
      const cliente = clientes.find((item) => String(item.id) === String(cuenta.cliente_id));
      return [
        cuenta.numero_documento,
        cuenta.serie,
        cuenta.estado,
        cuenta.moneda,
        cliente?.nombre,
        cliente?.nit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, clientes, cuentasCobrar]);

  const resumen = useMemo(
    () => ({
      total: cuentasCobrar.reduce((acc, cuenta) => acc + Number(cuenta.total || 0), 0),
      saldo: cuentasCobrar
        .filter((cuenta) => cuenta.estado !== "Anulado")
        .reduce((acc, cuenta) => acc + Number(cuenta.saldo_pendiente || 0), 0),
      vencidas: cuentasCobrar.filter(estaVencida).length,
    }),
    [cuentasCobrar]
  );

  function money(valor: number, moneda = "GTQ") {
    return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-GT", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "GTQ",
    }).format(Number(valor || 0));
  }

  if (validandoAcceso || !autorizado) {
    return (
      <div className="h-screen bg-[#020617] text-cyan-400 flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Toaster
        position="bottom-right"
        toastOptions={{ style: { background: "#0f172a", color: "#fff", border: "1px solid #1e293b" } }}
      />
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">Cuentas por Cobrar</h1>
              <p className="text-gray-400 mt-2">
                Facturas y documentos de clientes, saldos pendientes y base para pagos parciales
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Resumen titulo="Cartera" valor={money(resumen.total)} color="text-cyan-400" />
              <Resumen titulo="Saldo" valor={money(resumen.saldo)} color="text-green-400" />
              <Resumen titulo="Vencidas" valor={String(resumen.vencidas)} color="text-orange-400" />
            </div>
          </header>

          {cargando ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando cuentas por cobrar...
            </section>
          ) : (
            <>
              <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
                <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
                  <Plus size={16} className="text-cyan-500" />
                  {cuentaEditandoId ? "Editar cuenta por cobrar" : "Registrar cuenta por cobrar"}
                </h2>

                <div className="grid md:grid-cols-4 gap-4">
                  <select value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value, clienteId: "", documentoContableId: "" })} className="input-custom">
                    <option value="">Empresa...</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={String(empresa.id)}>{empresa.nombre}</option>
                    ))}
                  </select>
                  <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="input-custom">
                    <option value="">Cliente...</option>
                    {clientesDisponibles.map((cliente) => (
                      <option key={cliente.id} value={String(cliente.id)}>{cliente.nit} - {cliente.nombre}</option>
                    ))}
                  </select>
                  <select value={form.documentoContableId} onChange={(e) => aplicarDocumento(e.target.value)} className="input-custom">
                    <option value="">Documento contable opcional</option>
                    {documentosDisponibles.map((documento) => (
                      <option key={documento.id} value={String(documento.id)}>
                        {documento.serie || "-"} {documento.numero_documento} - {money(documento.total, documento.moneda)}
                      </option>
                    ))}
                  </select>
                  <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} className="input-custom">
                    {MONEDAS.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
                  </select>
                  <input value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="Serie" className="input-custom" />
                  <input value={form.numeroDocumento} onChange={(e) => setForm({ ...form, numeroDocumento: e.target.value })} placeholder="Numero documento" className="input-custom" />
                  <input type="date" value={form.fechaDocumento} onChange={(e) => setForm({ ...form, fechaDocumento: e.target.value })} className="input-custom" />
                  <input type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} className="input-custom" />
                  <input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value, saldoPendiente: form.saldoPendiente || e.target.value })} placeholder="Total" className="input-custom" />
                  <input type="number" value={form.saldoPendiente} onChange={(e) => setForm({ ...form, saldoPendiente: e.target.value })} placeholder="Saldo pendiente" className="input-custom" />
                  <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="input-custom">
                    {ESTADOS_CXC.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                  <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" className="input-custom" />

                  <button onClick={guardarCuentaCobrar} disabled={procesando} className="md:col-span-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-black font-black rounded-xl h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2">
                    {procesando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Guardar CxC
                  </button>
                  <button onClick={() => limpiarFormulario()} className="md:col-span-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-black rounded-xl h-[3.5rem] uppercase text-xs">
                    Limpiar
                  </button>
                </div>
              </section>

              <section className="mb-6 flex items-center gap-3">
                <div className="relative w-full md:w-[520px]">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por cliente, NIT, documento, moneda o estado..." className="input-custom w-full pl-10" />
                </div>
                <button onClick={() => cargarDatos()} className="h-14 px-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 font-bold">
                  <RefreshCcw size={18} />
                </button>
              </section>

              <section className="grid gap-4">
                {cuentasFiltradas.map((cuenta) => {
                  const cliente = clientes.find((item) => String(item.id) === String(cuenta.cliente_id));
                  const vencida = estaVencida(cuenta);
                  const pagosCuenta = pagosDeCuenta(cuenta.id);
                  const pagosCuentaTodos = pagos.filter(
                    (pago) => String(pago.cuenta_por_cobrar_id) === String(cuenta.id)
                  );
                  const totalPagado = pagosCuenta.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
                  return (
                    <div key={cuenta.id} className={`rounded-2xl border p-5 ${vencida ? "border-orange-400/40 bg-orange-400/10" : "border-white/10 bg-white/[0.03]"}`}>
                      <div className="grid lg:grid-cols-[1.4fr_1fr_auto] gap-4 items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-black">{cuenta.serie || "-"} {cuenta.numero_documento}</h3>
                            <EstadoPill estado={vencida ? "Vencido" : cuenta.estado} />
                            {vencida && <span className="inline-flex items-center gap-1 text-xs text-orange-200"><AlertTriangle size={14} /> Vencida</span>}
                          </div>
                          <p className="text-gray-400 text-sm mt-2">{cliente?.nombre || cuenta.cliente_id}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Documento: {cuenta.documento_contable_id || "Manual"} | Fecha: {cuenta.fecha_documento} | Vence: {cuenta.fecha_vencimiento}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Pagado: {money(totalPagado, cuenta.moneda)} | Asientos automáticos: no creados.
                          </p>
                        </div>
                        <div className="text-sm text-gray-300">
                          <p>Total: <span className="font-black text-cyan-200">{money(cuenta.total, cuenta.moneda)}</span></p>
                          <p>Saldo: <span className="font-black text-green-200">{money(cuenta.saldo_pendiente, cuenta.moneda)}</span></p>
                          <p>Moneda: {cuenta.moneda}</p>
                          <p>Obs: {cuenta.observaciones || "N/A"}</p>
                        </div>
                        <div className="flex flex-col gap-2 min-w-36">
                          {cuenta.estado !== "Anulado" && cuenta.estado !== "Pagado" && !esAuditorSoloLectura(cuenta.empresa_id) && (
                            <button onClick={() => abrirPago(cuenta)} className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 text-xs font-black">Registrar pago</button>
                          )}
                          {!esAuditorSoloLectura(cuenta.empresa_id) && (
                            <button onClick={() => cargarParaEditar(cuenta)} className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs font-black">Editar</button>
                          )}
                          {cuenta.estado !== "Anulado" && !esAuditorSoloLectura(cuenta.empresa_id) && (
                            <button onClick={() => anularCuenta(cuenta)} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-black">Anular</button>
                          )}
                        </div>
                      </div>

                      {String(cuentaPagoId || "") === String(cuenta.id) && (
                        <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-green-200">
                            Registrar abono o cobro
                          </h4>
                          <div className="grid md:grid-cols-6 gap-3">
                            <input type="date" value={formPago.fechaPago} onChange={(e) => setFormPago({ ...formPago, fechaPago: e.target.value })} className="input-custom" />
                            <select value={formPago.metodoPago} onChange={(e) => setFormPago({ ...formPago, metodoPago: e.target.value })} className="input-custom">
                              {METODOS_PAGO.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}
                            </select>
                            <input value={formPago.banco} onChange={(e) => setFormPago({ ...formPago, banco: e.target.value })} placeholder="Banco opcional" className="input-custom" />
                            <input value={formPago.referencia} onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })} placeholder="Referencia opcional" className="input-custom" />
                            <input type="number" min="0" step="0.01" value={formPago.monto} onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })} placeholder="Monto" className="input-custom" />
                            <input value={formPago.observaciones} onChange={(e) => setFormPago({ ...formPago, observaciones: e.target.value })} placeholder="Observaciones" className="input-custom" />
                            <button onClick={() => registrarPago(cuenta)} disabled={procesando} className="md:col-span-3 bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-black rounded-xl h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2">
                              {procesando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                              Aplicar pago
                            </button>
                            <button onClick={() => setCuentaPagoId(null)} className="md:col-span-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-black rounded-xl h-[3.5rem] uppercase text-xs">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {pagosCuentaTodos.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">
                            Historial de pagos
                          </h4>
                          <div className="space-y-2">
                            {pagosCuentaTodos.map((pago) => (
                              <div key={pago.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-gray-300 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                                <div>
                                  <p className="font-black text-white">{pago.fecha_pago} · {pago.metodo_pago}</p>
                                  <p className="text-gray-500">{pago.banco || "Sin banco"} | Ref: {pago.referencia || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Monto</p>
                                  <p className="font-black text-green-200">{money(pago.monto, pago.moneda)}</p>
                                </div>
                                <div>
                                  <EstadoPill estado={pago.estado} />
                                  {pago.motivo_anulacion && <p className="mt-1 text-red-200">{pago.motivo_anulacion}</p>}
                                </div>
                                {pago.estado !== "Anulado" && !esAuditorSoloLectura(pago.empresa_id) && (
                                  <button onClick={() => anularPago(pago)} disabled={procesando} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 font-black text-red-200">
                                    <Ban size={14} />
                                    Anular pago
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {cuentasFiltradas.length === 0 && (
                  <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                    <WalletCards className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-500">No hay cuentas por cobrar para mostrar.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        .input-custom {
          height: 3.5rem;
          padding: 0 1rem;
          border-radius: 0.9rem;
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
      `}</style>
    </div>
  );
}

function Resumen({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[150px]">
      <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">{titulo}</p>
      <h2 className={`text-xl font-black mt-1 ${color}`}>{valor}</h2>
    </div>
  );
}

function EstadoPill({ estado }: { estado: string }) {
  const color =
    estado === "Pagado"
      ? "bg-green-500/10 text-green-300 border-green-500/20"
      : estado === "Vencido" || estado === "Anulado"
        ? "bg-red-500/10 text-red-300 border-red-500/20"
        : estado === "Parcial"
          ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
          : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${color}`}>
      {estado}
    </span>
  );
}
