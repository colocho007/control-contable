"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { AlertTriangle, Ban, Loader2, Plus, RefreshCcw, Search, WalletCards } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
}

interface Proveedor {
  id: string | number;
  empresa_id: number;
  nombre: string;
  nit: string | null;
  estado: string | null;
  moneda: string | null;
}

interface DocumentoContable {
  id: string | number;
  empresa_id: number;
  proveedor_id: string | number | null;
  tipo_documento: string;
  serie: string | null;
  numero_documento: string;
  fecha_documento: string;
  fecha_vencimiento: string | null;
  moneda: string;
  total: number;
  estado: string;
}

interface CuentaPagar {
  id: string | number;
  creado_at: string | null;
  actualizado_at: string | null;
  empresa_id: number;
  proveedor_id: string | number | null;
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

interface PagoCuentaPagar {
  id: string | number;
  cuenta_por_pagar_id: string | number;
  empresa_id: number;
  proveedor_id: string | number | null;
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

const ESTADOS_CXP = ["Pendiente", "Parcial", "Pagado", "Vencido", "Anulado"];
const MONEDAS = ["GTQ", "USD"];
const METODOS_PAGO = ["Efectivo", "Transferencia", "Depósito", "Cheque", "Otro"];
const COLUMNAS_CXP =
  "id,creado_at,actualizado_at,empresa_id,proveedor_id,documento_contable_id,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,total,saldo_pendiente,estado,observaciones,creado_por,actualizado_por";
const COLUMNAS_PAGOS_CXP =
  "id,cuenta_por_pagar_id,empresa_id,proveedor_id,fecha_pago,metodo_pago,banco,referencia,moneda,monto,observaciones,estado,creado_por,creado_at,anulado_por,anulado_at,motivo_anulacion";

function textoONull(valor: string) {
  const texto = valor.trim();
  return texto ? texto : null;
}

function numero(valor: string | number | null | undefined) {
  const resultado = Number(valor || 0);
  if (!Number.isFinite(resultado)) throw new Error("El monto debe ser numerico.");
  return Math.round(resultado * 100) / 100;
}

function fechaHoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function estaVencida(cuenta: CuentaPagar) {
  if (["Pagado", "Anulado"].includes(cuenta.estado)) return false;
  return new Date(`${cuenta.fecha_vencimiento}T23:59:59`).getTime() < Date.now();
}

export default function CuentasPagarPage() {
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoContable[]>([]);
  const [cuentasPagar, setCuentasPagar] = useState<CuentaPagar[]>([]);
  const [pagos, setPagos] = useState<PagoCuentaPagar[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cuentaEditandoId, setCuentaEditandoId] = useState<string | number | null>(null);
  const [cuentaPagoId, setCuentaPagoId] = useState<string | number | null>(null);

  const [form, setForm] = useState({
    empresaId: "",
    proveedorId: "",
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
      const acceso = await validarAccesoModuloUsuario("cuentas-pagar");

      if (!acceso.ok) {
        if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
          window.location.href = "/login";
          return;
        }
        toast.error("No tienes acceso a Cuentas por Pagar.");
        window.location.href = "/dashboard";
        return;
      }

      const idsPermitidos = await obtenerEmpresasPermitidas(
        acceso.user!.id,
        acceso.perfil?.rol || ""
      );

      setUserId(acceso.user!.id);
      setEmpresasPermitidasIds(idsPermitidos);
      setAutorizado(true);
      setValidandoAcceso(false);
      setCargando(true);
      await cargarDatos(idsPermitidos);
    } catch (error) {
      console.error("Error cargando CxP:", error);
      toast.error("Error cargando Cuentas por Pagar.");
    } finally {
      setCargando(false);
      setValidandoAcceso(false);
    }
  }

  async function cargarDatos(idsPermitidos = empresasPermitidasIds) {
    if (!idsPermitidos.length) {
      setEmpresas([]);
      setProveedores([]);
      setDocumentos([]);
      setCuentasPagar([]);
      setPagos([]);
      return;
    }

    const [resEmpresas, resProveedores, resDocumentos, resCxp, resPagos] = await Promise.all([
      supabase.from("empresas").select("id,nombre").in("id", idsPermitidos).order("nombre"),
      supabase
        .from("proveedores")
        .select("id,empresa_id,nombre,nit,estado,moneda")
        .in("empresa_id", idsPermitidos)
        .order("nombre"),
      supabase
        .from("documentos_contables_revision")
        .select("id,empresa_id,proveedor_id,tipo_documento,serie,numero_documento,fecha_documento,fecha_vencimiento,moneda,total,estado")
        .in("empresa_id", idsPermitidos)
        .not("proveedor_id", "is", null)
        .order("fecha_documento", { ascending: false }),
      supabase
        .from("cuentas_por_pagar")
        .select(COLUMNAS_CXP)
        .in("empresa_id", idsPermitidos)
        .order("fecha_vencimiento", { ascending: true }),
      supabase
        .from("pagos_cuentas_por_pagar")
        .select(COLUMNAS_PAGOS_CXP)
        .in("empresa_id", idsPermitidos)
        .order("fecha_pago", { ascending: false }),
    ]);

    if (resEmpresas.error) throw resEmpresas.error;
    if (resProveedores.error) throw resProveedores.error;
    if (resDocumentos.error) throw resDocumentos.error;
    if (resCxp.error) throw resCxp.error;
    if (resPagos.error) throw resPagos.error;

    setEmpresas((resEmpresas.data || []) as Empresa[]);
    setProveedores((resProveedores.data || []) as Proveedor[]);
    setDocumentos((resDocumentos.data || []) as DocumentoContable[]);
    setCuentasPagar((resCxp.data || []) as CuentaPagar[]);
    setPagos((resPagos.data || []) as PagoCuentaPagar[]);

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

  function proveedorSeleccionado() {
    return proveedores.find((proveedor) => String(proveedor.id) === String(form.proveedorId));
  }

  function documentoSeleccionado() {
    return documentos.find((documento) => String(documento.id) === String(form.documentoContableId));
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
      proveedorId: documento.proveedor_id ? String(documento.proveedor_id) : "",
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

  async function auditarCxP(accion: string, cuenta: CuentaPagar, estadoAnterior?: string | null) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: cuenta.empresa_id,
        modulo: "cuentas-pagar",
        accion,
        entidad_tipo: "cuenta_por_pagar",
        entidad_id: cuenta.id,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: cuenta.estado,
        descripcion: "Cuenta por pagar actualizada",
        sensible: true,
        metadatos: {
          proveedor_id: cuenta.proveedor_id,
          documento_contable_id: cuenta.documento_contable_id,
          numero_documento: cuenta.numero_documento,
          moneda: cuenta.moneda,
          total: cuenta.total,
          saldo_pendiente: cuenta.saldo_pendiente,
          pagos_parciales_preparados: true,
          cheques_preparados: true,
          transferencias_preparadas: true,
          depositos_preparados: true,
          asiento_automatico_creado: false,
        },
        origen: "modulo_cuentas_pagar",
      });
    } catch (error) {
      console.error("CxP guardada, pero fallo auditoria:", error);
      toast.error("Cambio guardado, pero fallo la auditoria.");
    }
  }

  async function auditarPagoCxP(
    accion: string,
    pago: PagoCuentaPagar,
    cuenta: CuentaPagar,
    estadoAnterior?: string | null
  ) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: pago.empresa_id,
        modulo: "cuentas-pagar",
        accion,
        entidad_tipo: "pago_cuenta_por_pagar",
        entidad_id: pago.id,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: pago.estado,
        descripcion: "Pago de cuenta por pagar actualizado",
        sensible: true,
        metadatos: {
          cuenta_por_pagar_id: pago.cuenta_por_pagar_id,
          proveedor_id: pago.proveedor_id,
          fecha_pago: pago.fecha_pago,
          metodo_pago: pago.metodo_pago,
          banco: pago.banco,
          referencia: pago.referencia,
          moneda: pago.moneda,
          monto: pago.monto,
          saldo_cxp_resultante: cuenta.saldo_pendiente,
          estado_cxp_resultante: cuenta.estado,
          cheques_preparados: true,
          transferencias_preparadas: true,
          depositos_preparados: true,
          comprobantes_adjuntos_preparados: true,
          asiento_automatico_creado: false,
        },
        origen: "modulo_cuentas_pagar",
      });
    } catch (error) {
      console.error("Pago CxP guardado, pero fallo auditoria:", error);
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
        String(pago.cuenta_por_pagar_id) === String(cuentaId) &&
        pago.estado !== "Anulado"
    );
  }

  function abrirPago(cuenta: CuentaPagar) {
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

  async function registrarPago(cuenta: CuentaPagar) {
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

    if (cuenta.estado === "Anulado" || cuenta.estado === "Pagado") {
      toast.error("La cuenta por pagar no acepta nuevos pagos.");
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
    if (!MONEDAS.includes(cuenta.moneda)) {
      toast.error("La moneda de la CxP no es valida.");
      return;
    }

    if (cuenta.proveedor_id) {
      const proveedor = proveedores.find((item) => String(item.id) === String(cuenta.proveedor_id));
      if (!proveedor || Number(proveedor.empresa_id) !== empresaId) {
        toast.error("El proveedor de la CxP no pertenece a la empresa seleccionada.");
        return;
      }
      if (proveedor.moneda && proveedor.moneda !== cuenta.moneda) {
        toast.error("El proveedor y la CxP tienen monedas diferentes.");
        return;
      }
    }

    const nuevoSaldo = Math.round((Number(cuenta.saldo_pendiente || 0) - monto) * 100) / 100;
    const nuevoEstado = calcularEstadoConSaldo(nuevoSaldo);

    setProcesando(true);
    const toastId = toast.loading("Registrando pago...");

    try {
      const { data: pagoData, error: pagoError } = await supabase
        .from("pagos_cuentas_por_pagar")
        .insert({
          cuenta_por_pagar_id: cuenta.id,
          empresa_id: empresaId,
          proveedor_id: cuenta.proveedor_id || null,
          fecha_pago: formPago.fechaPago,
          metodo_pago: formPago.metodoPago,
          banco: textoONull(formPago.banco),
          referencia: textoONull(formPago.referencia),
          moneda: cuenta.moneda,
          monto,
          observaciones: textoONull(formPago.observaciones),
          estado: "Registrado",
          creado_por: userId,
          metadatos: {
            cheques_preparados: true,
            transferencias_preparadas: true,
            depositos_preparados: true,
            comprobantes_adjuntos_preparados: true,
            asiento_automatico_creado: false,
          },
        })
        .select(COLUMNAS_PAGOS_CXP)
        .single();

      if (pagoError) throw pagoError;

      const { data: cuentaData, error: cuentaError } = await supabase
        .from("cuentas_por_pagar")
        .update({
          saldo_pendiente: nuevoSaldo,
          estado: nuevoEstado,
          actualizado_at: new Date().toISOString(),
          actualizado_por: userId,
        })
        .eq("id", cuenta.id)
        .eq("empresa_id", empresaId)
        .select(COLUMNAS_CXP)
        .single();

      if (cuentaError) throw cuentaError;

      await auditarPagoCxP(
        "registrar_pago_cuenta_por_pagar",
        pagoData as PagoCuentaPagar,
        cuentaData as CuentaPagar,
        null
      );

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
      toast.success("Pago registrado.", { id: toastId });
    } catch (error) {
      console.error("Error registrando pago CxP:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function anularPago(pago: PagoCuentaPagar) {
    if (!userId) {
      toast.error("Sesion no valida.");
      return;
    }

    const cuenta = cuentasPagar.find(
      (item) => String(item.id) === String(pago.cuenta_por_pagar_id)
    );
    if (!cuenta) {
      toast.error("No se encontro la cuenta por pagar del pago.");
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

    if (pago.estado === "Anulado") {
      toast.error("El pago ya esta anulado.");
      return;
    }
    if (cuenta.estado === "Anulado") {
      toast.error("No se puede devolver saldo a una CxP anulada.");
      return;
    }
    if (Number(cuenta.empresa_id) !== empresaId || Number(pago.empresa_id) !== empresaId) {
      toast.error("El pago y la CxP no pertenecen a la misma empresa.");
      return;
    }
    if (String(cuenta.proveedor_id || "") !== String(pago.proveedor_id || "")) {
      toast.error("El pago no pertenece al proveedor de la CxP.");
      return;
    }
    if (cuenta.moneda !== pago.moneda) {
      toast.error("El pago y la CxP tienen monedas diferentes.");
      return;
    }

    const saldoDevuelto = Math.round((Number(cuenta.saldo_pendiente || 0) + Number(pago.monto || 0)) * 100) / 100;
    if (saldoDevuelto > Number(cuenta.total || 0)) {
      toast.error("La anulacion excederia el total de la CxP.");
      return;
    }
    const nuevoEstado = saldoDevuelto >= Number(cuenta.total || 0) ? "Pendiente" : "Parcial";

    setProcesando(true);
    const toastId = toast.loading("Anulando pago...");

    try {
      const { data: pagoData, error: pagoError } = await supabase
        .from("pagos_cuentas_por_pagar")
        .update({
          estado: "Anulado",
          anulado_por: userId,
          anulado_at: new Date().toISOString(),
          motivo_anulacion: motivo.trim(),
        })
        .eq("id", pago.id)
        .eq("empresa_id", empresaId)
        .select(COLUMNAS_PAGOS_CXP)
        .single();

      if (pagoError) throw pagoError;

      const { data: cuentaData, error: cuentaError } = await supabase
        .from("cuentas_por_pagar")
        .update({
          saldo_pendiente: saldoDevuelto,
          estado: nuevoEstado,
          actualizado_at: new Date().toISOString(),
          actualizado_por: userId,
        })
        .eq("id", cuenta.id)
        .eq("empresa_id", empresaId)
        .select(COLUMNAS_CXP)
        .single();

      if (cuentaError) throw cuentaError;

      await auditarPagoCxP(
        "anular_pago_cuenta_por_pagar",
        pagoData as PagoCuentaPagar,
        cuentaData as CuentaPagar,
        pago.estado
      );

      await cargarDatos();
      toast.success("Pago anulado y saldo devuelto.", { id: toastId });
    } catch (error) {
      console.error("Error anulando pago CxP:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function guardarCuentaPagar() {
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

    if (!form.numeroDocumento.trim() || !form.fechaDocumento || !form.fechaVencimiento) {
      toast.error("Numero, fecha y vencimiento son obligatorios.");
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

    const proveedor = proveedorSeleccionado();
    if (form.proveedorId && (!proveedor || Number(proveedor.empresa_id) !== empresaId)) {
      toast.error("El proveedor no pertenece a la empresa seleccionada.");
      return;
    }

    if (proveedor?.moneda && proveedor.moneda !== form.moneda) {
      toast.error("No se puede mezclar moneda entre proveedor y CxP.");
      return;
    }

    const documento = documentoSeleccionado();
    if (documento) {
      if (Number(documento.empresa_id) !== empresaId) {
        toast.error("El documento contable pertenece a otra empresa.");
        return;
      }
      if (documento.proveedor_id && form.proveedorId && String(documento.proveedor_id) !== String(form.proveedorId)) {
        toast.error("El documento contable pertenece a otro proveedor.");
        return;
      }
      if (documento.moneda !== form.moneda) {
        toast.error("No se puede mezclar moneda entre documento y CxP.");
        return;
      }
    }

    const payload = {
      empresa_id: empresaId,
      proveedor_id: form.proveedorId || null,
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
        preparado_cheques: true,
        preparado_transferencias: true,
        preparado_depositos: true,
        preparado_reportes: true,
        preparado_balance: true,
        asiento_automatico_creado: false,
      },
    };

    setProcesando(true);
    const toastId = toast.loading(cuentaEditandoId ? "Actualizando CxP..." : "Creando CxP...");

    try {
      const anterior = cuentasPagar.find((cuenta) => String(cuenta.id) === String(cuentaEditandoId));
      const query = cuentaEditandoId
        ? supabase
            .from("cuentas_por_pagar")
            .update(payload)
            .eq("id", cuentaEditandoId)
            .eq("empresa_id", empresaId)
        : supabase.from("cuentas_por_pagar").insert({
            ...payload,
            creado_por: userId,
          });

      const { data, error } = await query.select(COLUMNAS_CXP).single();
      if (error) throw error;

      const cuenta = data as CuentaPagar;
      await auditarCxP(cuentaEditandoId ? "actualizar_cuenta_por_pagar" : "crear_cuenta_por_pagar", cuenta, anterior?.estado || null);
      limpiarFormulario(String(empresaId));
      await cargarDatos();
      toast.success("Cuenta por pagar guardada.", { id: toastId });
    } catch (error) {
      console.error("Error guardando CxP:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function anularCuenta(cuenta: CuentaPagar) {
    const motivo = window.prompt("Motivo para anular la cuenta por pagar:");
    if (!motivo || motivo.trim().length < 5) {
      toast.error("Debes indicar un motivo valido.");
      return;
    }

    setProcesando(true);
    const toastId = toast.loading("Anulando CxP...");

    try {
      const { data, error } = await supabase
        .from("cuentas_por_pagar")
        .update({
          estado: "Anulado",
          observaciones: motivo.trim(),
          actualizado_at: new Date().toISOString(),
          actualizado_por: userId,
        })
        .eq("id", cuenta.id)
        .eq("empresa_id", cuenta.empresa_id)
        .select(COLUMNAS_CXP)
        .single();

      if (error) throw error;

      await auditarCxP("anular_cuenta_por_pagar", data as CuentaPagar, cuenta.estado);
      await cargarDatos();
      toast.success("Cuenta por pagar anulada.", { id: toastId });
    } catch (error) {
      console.error("Error anulando CxP:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  function cargarParaEditar(cuenta: CuentaPagar) {
    setCuentaEditandoId(cuenta.id);
    setForm({
      empresaId: String(cuenta.empresa_id),
      proveedorId: cuenta.proveedor_id ? String(cuenta.proveedor_id) : "",
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
      proveedorId: "",
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

  const proveedoresDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return proveedores.filter((proveedor) => Number(proveedor.empresa_id) === empresaId);
  }, [form.empresaId, proveedores]);

  const documentosDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return documentos.filter((documento) => Number(documento.empresa_id) === empresaId);
  }, [documentos, form.empresaId]);

  const cuentasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return cuentasPagar;

    return cuentasPagar.filter((cuenta) => {
      const proveedor = proveedores.find((item) => String(item.id) === String(cuenta.proveedor_id));
      return [
        cuenta.numero_documento,
        cuenta.serie,
        cuenta.estado,
        cuenta.moneda,
        proveedor?.nombre,
        proveedor?.nit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, cuentasPagar, proveedores]);

  const resumen = useMemo(
    () => ({
      total: cuentasPagar.reduce((acc, cuenta) => acc + Number(cuenta.total || 0), 0),
      saldo: cuentasPagar
        .filter((cuenta) => cuenta.estado !== "Anulado")
        .reduce((acc, cuenta) => acc + Number(cuenta.saldo_pendiente || 0), 0),
      vencidas: cuentasPagar.filter(estaVencida).length,
    }),
    [cuentasPagar]
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
              <h1 className="text-5xl font-black tracking-tight">Cuentas por Pagar</h1>
              <p className="text-gray-400 mt-2">
                Facturas de proveedores, saldos pendientes y base para cheques, transferencias y depositos
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Resumen titulo="Compromisos" valor={money(resumen.total)} color="text-cyan-400" />
              <Resumen titulo="Saldo" valor={money(resumen.saldo)} color="text-green-400" />
              <Resumen titulo="Vencidas" valor={String(resumen.vencidas)} color="text-orange-400" />
            </div>
          </header>

          {cargando ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando cuentas por pagar...
            </section>
          ) : (
            <>
              <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
                <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
                  <Plus size={16} className="text-cyan-500" />
                  {cuentaEditandoId ? "Editar cuenta por pagar" : "Registrar cuenta por pagar"}
                </h2>

                <div className="grid md:grid-cols-4 gap-4">
                  <select value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value, proveedorId: "", documentoContableId: "" })} className="input-custom">
                    <option value="">Empresa...</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={String(empresa.id)}>{empresa.nombre}</option>
                    ))}
                  </select>
                  <select value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })} className="input-custom">
                    <option value="">Proveedor opcional...</option>
                    {proveedoresDisponibles.map((proveedor) => (
                      <option key={proveedor.id} value={String(proveedor.id)}>
                        {proveedor.nit || "S/N"} - {proveedor.nombre}
                      </option>
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
                    {ESTADOS_CXP.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                  <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" className="input-custom" />

                  <button onClick={guardarCuentaPagar} disabled={procesando} className="md:col-span-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-black font-black rounded-xl h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2">
                    {procesando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Guardar CxP
                  </button>
                  <button onClick={() => limpiarFormulario()} className="md:col-span-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-black rounded-xl h-[3.5rem] uppercase text-xs">
                    Limpiar
                  </button>
                </div>
              </section>

              <section className="mb-6 flex items-center gap-3">
                <div className="relative w-full md:w-[520px]">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por proveedor, NIT, documento, moneda o estado..." className="input-custom w-full pl-10" />
                </div>
                <button onClick={() => cargarDatos()} className="h-14 px-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 font-bold">
                  <RefreshCcw size={18} />
                </button>
              </section>

              <section className="grid gap-4">
                {cuentasFiltradas.map((cuenta) => {
                  const proveedor = proveedores.find((item) => String(item.id) === String(cuenta.proveedor_id));
                  const vencida = estaVencida(cuenta);
                  const pagosCuenta = pagosDeCuenta(cuenta.id);
                  const pagosCuentaTodos = pagos.filter(
                    (pago) => String(pago.cuenta_por_pagar_id) === String(cuenta.id)
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
                          <p className="text-gray-400 text-sm mt-2">{proveedor?.nombre || cuenta.proveedor_id || "Proveedor no asociado"}</p>
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
                          {cuenta.estado !== "Anulado" && cuenta.estado !== "Pagado" && (
                            <button onClick={() => abrirPago(cuenta)} className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 text-xs font-black">Registrar pago</button>
                          )}
                          <button onClick={() => cargarParaEditar(cuenta)} className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs font-black">Editar</button>
                          {cuenta.estado !== "Anulado" && (
                            <button onClick={() => anularCuenta(cuenta)} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-black">Anular</button>
                          )}
                        </div>
                      </div>

                      {String(cuentaPagoId || "") === String(cuenta.id) && (
                        <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-green-200">
                            Registrar pago o abono
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
                                {pago.estado !== "Anulado" && (
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
                    <p className="text-gray-500">No hay cuentas por pagar para mostrar.</p>
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
