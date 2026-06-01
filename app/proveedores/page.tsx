"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import { Loader2, Plus, Search, Truck } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
}

interface CuentaContable {
  id: string | number;
  empresa_id: number | null;
  codigo: string;
  nombre: string;
  activo: boolean;
  permite_movimientos: boolean;
}

interface ImpuestoConfiguracion {
  id: string | number;
  empresa_id: number;
  nombre: string;
  tipo: string;
  porcentaje: number;
  activo: boolean;
  aplica_compra: boolean;
}

interface Proveedor {
  id: string | number;
  empresa_id: number;
  empresa?: string | null;
  nit: string;
  nombre: string;
  razon_social: string | null;
  nombre_comercial: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  contacto: string | null;
  estado: string | null;
  observaciones: string | null;
  cuenta_por_pagar_id: string | number | null;
  plan_impuesto_id: string | number | null;
  dias_credito: number | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  tipo_cuenta: string | null;
  moneda: string;
  tipo_proveedor: string | null;
  saldo_pendiente: number | null;
  created_at?: string | null;
  actualizado_at?: string | null;
}

const COLUMNAS_PROVEEDOR =
  "id,empresa_id,empresa,nit,nombre,razon_social,nombre_comercial,direccion,telefono,correo,contacto,estado,observaciones,cuenta_por_pagar_id,plan_impuesto_id,dias_credito,banco,cuenta_bancaria,tipo_cuenta,moneda,tipo_proveedor,saldo_pendiente,created_at,actualizado_at";

const ESTADOS_PROVEEDOR = ["Activo", "Inactivo"];
const MONEDAS = ["GTQ", "USD"];

const formularioInicial = {
  empresaId: "",
  nit: "",
  nombre: "",
  razonSocial: "",
  nombreComercial: "",
  direccion: "",
  telefono: "",
  correo: "",
  contacto: "",
  estado: "Activo",
  observaciones: "",
  cuentaPorPagarId: "",
  planImpuestoId: "",
  diasCredito: "",
  banco: "",
  cuentaBancaria: "",
  tipoCuenta: "",
  moneda: "GTQ",
  tipoProveedor: "",
  saldoPendiente: "0",
};

export default function ProveedoresPage() {
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [impuestos, setImpuestos] = useState<ImpuestoConfiguracion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [proveedorEditandoId, setProveedorEditandoId] = useState<string | number | null>(null);
  const [form, setForm] = useState(formularioInicial);

  useEffect(() => {
    iniciar();
  }, []);

  const proveedoresFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return proveedores;

    return proveedores.filter((proveedor) =>
      [
        proveedor.nit,
        proveedor.nombre,
        proveedor.razon_social,
        proveedor.nombre_comercial,
        proveedor.correo,
        proveedor.contacto,
        proveedor.empresa,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termino))
    );
  }, [busqueda, proveedores]);

  const cuentasDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return cuentas.filter(
      (cuenta) =>
        cuenta.activo &&
        cuenta.permite_movimientos &&
        (!cuenta.empresa_id || Number(cuenta.empresa_id) === empresaId)
    );
  }, [cuentas, form.empresaId]);

  const impuestosDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return impuestos.filter(
      (impuesto) =>
        impuesto.activo &&
        impuesto.aplica_compra &&
        Number(impuesto.empresa_id) === empresaId
    );
  }, [impuestos, form.empresaId]);

  async function iniciar() {
    setValidandoAcceso(true);
    setCargando(true);

    const acceso = await validarAccesoModuloUsuario("proveedores");
    if (!acceso.ok) {
      if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
        window.location.href = "/login";
        return;
      }
      window.location.href = "/dashboard";
      return;
    }

    const usuarioId = acceso.user?.id || null;
    setUserId(usuarioId);
    const ids = usuarioId
      ? await obtenerEmpresasPermitidas(usuarioId, acceso.perfil?.rol || "")
      : [];
    const funciones = usuarioId ? await listarFuncionesOperativasUsuario(usuarioId, ids) : [];
    setEmpresasPermitidasIds(ids);
    setFuncionesOperativas(funciones);
    setAutorizado(true);
    setValidandoAcceso(false);
    await cargarDatos(ids);
  }

  async function cargarDatos(ids = empresasPermitidasIds) {
    if (!ids.length) {
      setEmpresas([]);
      setProveedores([]);
      setCuentas([]);
      setImpuestos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    const filtroEmpresas = ids.join(",");

    const [empresasRes, proveedoresRes, cuentasRes, impuestosRes] = await Promise.all([
      supabase
        .from("empresas")
        .select("id,nombre")
        .in("id", ids)
        .order("nombre", { ascending: true }),
      supabase
        .from("proveedores")
        .select(COLUMNAS_PROVEEDOR)
        .in("empresa_id", ids)
        .order("nombre", { ascending: true }),
      supabase
        .from("catalogo_cuentas")
        .select("id,empresa_id,codigo,nombre,activo,permite_movimientos")
        .or(`empresa_id.is.null,empresa_id.in.(${filtroEmpresas})`)
        .eq("activo", true)
        .eq("permite_movimientos", true)
        .order("codigo", { ascending: true }),
      supabase
        .from("impuestos_configuracion")
        .select("id,empresa_id,nombre,tipo,porcentaje,activo,aplica_compra")
        .in("empresa_id", ids)
        .eq("activo", true)
        .eq("aplica_compra", true)
        .order("nombre", { ascending: true }),
    ]);

    if (empresasRes.error) toast.error(empresasRes.error.message);
    if (proveedoresRes.error) toast.error(proveedoresRes.error.message);
    if (cuentasRes.error) toast.error(cuentasRes.error.message);
    if (impuestosRes.error) toast.error(impuestosRes.error.message);

    const empresasData = (empresasRes.data || []) as Empresa[];
    setEmpresas(empresasData);
    setProveedores(((proveedoresRes.data || []) as Proveedor[]).map(normalizarProveedor));
    setCuentas((cuentasRes.data || []) as CuentaContable[]);
    setImpuestos((impuestosRes.data || []) as ImpuestoConfiguracion[]);

    setForm((actual) => ({
      ...actual,
      empresaId: actual.empresaId || String(empresasData[0]?.id || ""),
    }));
    setCargando(false);
  }

  function normalizarProveedor(proveedor: Proveedor): Proveedor {
    return {
      ...proveedor,
      nit: proveedor.nit || "",
      nombre: proveedor.nombre || "",
      moneda: proveedor.moneda || "GTQ",
      estado: proveedor.estado || "Activo",
      saldo_pendiente: Number(proveedor.saldo_pendiente || 0),
    };
  }

  function validarEmpresaPermitida(empresaId: number) {
    return empresaId > 0 && empresasPermitidasIds.includes(empresaId);
  }

  function esAuditorSoloLectura(empresaId?: string | number | null) {
    return esAuditorSoloLecturaLocal(
      funcionesOperativas,
      empresaId ? [empresaId] : empresasPermitidasIds
    );
  }

  async function bloquearAuditor(accion: string, empresaId?: string | number | null, entidadId?: string | number | null) {
    const empresaNumero = Number(empresaId || 0);
    const mensaje = "El auditor solo lectura no puede modificar proveedores.";
    toast.error(mensaje);
    try {
      await registrarAuditoriaEvento({
        empresa_id: Number.isFinite(empresaNumero) && empresaNumero > 0 ? empresaNumero : null,
        modulo: "proveedores",
        accion: "intento_bloqueado_auditor_solo_lectura",
        entidad_tipo: "proveedor",
        entidad_id: entidadId || null,
        descripcion: mensaje,
        sensible: true,
        metadatos: { accion_intentada: accion },
        origen: "modulo_proveedores",
      });
    } catch (error) {
      console.warn("No se pudo auditar bloqueo de auditor:", error);
    }
  }

  function validarReferencias(empresaId: number) {
    if (form.cuentaPorPagarId) {
      const cuenta = cuentas.find((item) => String(item.id) === String(form.cuentaPorPagarId));
      if (!cuenta || !cuenta.activo || !cuenta.permite_movimientos) {
        toast.error("La cuenta por pagar seleccionada no permite movimientos.");
        return false;
      }
      if (cuenta.empresa_id && Number(cuenta.empresa_id) !== empresaId) {
        toast.error("La cuenta por pagar no pertenece a la empresa seleccionada.");
        return false;
      }
    }

    if (form.planImpuestoId) {
      const impuesto = impuestos.find((item) => String(item.id) === String(form.planImpuestoId));
      if (!impuesto || !impuesto.activo || !impuesto.aplica_compra) {
        toast.error("El plan de impuestos seleccionado no aplica para compras.");
        return false;
      }
      if (Number(impuesto.empresa_id) !== empresaId) {
        toast.error("El plan de impuestos no pertenece a la empresa seleccionada.");
        return false;
      }
    }

    return true;
  }

  function limpiarFormulario(empresaId = form.empresaId) {
    setProveedorEditandoId(null);
    setForm({ ...formularioInicial, empresaId });
  }

  function cargarProveedorParaEditar(proveedor: Proveedor) {
    if (esAuditorSoloLectura(proveedor.empresa_id)) {
      void bloquearAuditor("editar_proveedor", proveedor.empresa_id, proveedor.id);
      return;
    }

    setProveedorEditandoId(proveedor.id);
    setForm({
      empresaId: String(proveedor.empresa_id),
      nit: proveedor.nit || "",
      nombre: proveedor.nombre || "",
      razonSocial: proveedor.razon_social || "",
      nombreComercial: proveedor.nombre_comercial || "",
      direccion: proveedor.direccion || "",
      telefono: proveedor.telefono || "",
      correo: proveedor.correo || "",
      contacto: proveedor.contacto || "",
      estado: proveedor.estado || "Activo",
      observaciones: proveedor.observaciones || "",
      cuentaPorPagarId: proveedor.cuenta_por_pagar_id ? String(proveedor.cuenta_por_pagar_id) : "",
      planImpuestoId: proveedor.plan_impuesto_id ? String(proveedor.plan_impuesto_id) : "",
      diasCredito: proveedor.dias_credito != null ? String(proveedor.dias_credito) : "",
      banco: proveedor.banco || "",
      cuentaBancaria: proveedor.cuenta_bancaria || "",
      tipoCuenta: proveedor.tipo_cuenta || "",
      moneda: proveedor.moneda || "GTQ",
      tipoProveedor: proveedor.tipo_proveedor || "",
      saldoPendiente: String(proveedor.saldo_pendiente || 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function autollenarPorNit() {
    const empresaId = Number(form.empresaId);
    const nit = form.nit.trim().toLowerCase();
    if (!empresaId || !nit) return;

    const existente = proveedores.find(
      (proveedor) =>
        Number(proveedor.empresa_id) === empresaId &&
        proveedor.nit.trim().toLowerCase() === nit &&
        String(proveedor.id) !== String(proveedorEditandoId || "")
    );

    if (existente) {
      cargarProveedorParaEditar(existente);
      toast("Proveedor existente cargado por NIT.");
    }
  }

  async function guardarProveedor() {
    const empresaId = Number(form.empresaId);
    const nit = form.nit.trim();
    const nombre = form.nombre.trim();
    const diasCredito = form.diasCredito === "" ? null : Number(form.diasCredito);
    const saldoPendiente = form.saldoPendiente === "" ? 0 : Number(form.saldoPendiente);

    if (!validarEmpresaPermitida(empresaId)) {
      toast.error("Empresa no permitida para este usuario.");
      return;
    }
    if (esAuditorSoloLectura(empresaId)) {
      await bloquearAuditor("guardar_proveedor", empresaId, proveedorEditandoId || null);
      return;
    }
    if (!nit) {
      toast.error("El NIT es obligatorio.");
      return;
    }
    if (!nombre) {
      toast.error("El nombre del proveedor es obligatorio.");
      return;
    }
    if (!MONEDAS.includes(form.moneda)) {
      toast.error("Moneda no válida.");
      return;
    }
    if (diasCredito != null && (!Number.isFinite(diasCredito) || diasCredito < 0)) {
      toast.error("Los días de crédito deben ser un número válido.");
      return;
    }
    if (!Number.isFinite(saldoPendiente) || saldoPendiente < 0) {
      toast.error("El saldo pendiente debe ser un número válido.");
      return;
    }
    if (!validarReferencias(empresaId)) return;

    const duplicado = proveedores.find(
      (proveedor) =>
        Number(proveedor.empresa_id) === empresaId &&
        proveedor.nit.trim().toLowerCase() === nit.toLowerCase() &&
        String(proveedor.id) !== String(proveedorEditandoId || "")
    );
    if (duplicado) {
      toast.error("Ya existe un proveedor con ese NIT en la empresa seleccionada.");
      return;
    }

    const empresa = empresas.find((item) => Number(item.id) === empresaId);
    const proveedorAnterior = proveedorEditandoId
      ? proveedores.find((item) => String(item.id) === String(proveedorEditandoId))
      : null;

    const payload = {
      empresa_id: empresaId,
      empresa: empresa?.nombre || null,
      nit,
      nombre,
      razon_social: form.razonSocial.trim() || null,
      nombre_comercial: form.nombreComercial.trim() || null,
      direccion: form.direccion.trim() || null,
      telefono: form.telefono.trim() || null,
      correo: form.correo.trim() || null,
      contacto: form.contacto.trim() || null,
      estado: form.estado,
      observaciones: form.observaciones.trim() || null,
      cuenta_por_pagar_id: form.cuentaPorPagarId || null,
      plan_impuesto_id: form.planImpuestoId || null,
      dias_credito: diasCredito,
      banco: form.banco.trim() || null,
      cuenta_bancaria: form.cuentaBancaria.trim() || null,
      tipo_cuenta: form.tipoCuenta.trim() || null,
      moneda: form.moneda,
      tipo_proveedor: form.tipoProveedor.trim() || null,
      saldo_pendiente: saldoPendiente,
      actualizado_at: new Date().toISOString(),
      actualizado_por: userId,
    };

    setProcesando(true);
    const consulta = proveedorEditandoId
      ? supabase
          .from("proveedores")
          .update(payload)
          .eq("id", proveedorEditandoId)
          .eq("empresa_id", empresaId)
          .select(COLUMNAS_PROVEEDOR)
          .single()
      : supabase
          .from("proveedores")
          .insert({ ...payload, creado_por: userId })
          .select(COLUMNAS_PROVEEDOR)
          .single();

    const { data, error } = await consulta;
    if (error) {
      toast.error(error.message);
      setProcesando(false);
      return;
    }

    const proveedorGuardado = normalizarProveedor(data as Proveedor);
    setProveedores((actuales) => {
      if (proveedorEditandoId) {
        return actuales.map((proveedor) =>
          String(proveedor.id) === String(proveedorEditandoId) ? proveedorGuardado : proveedor
        );
      }
      return [proveedorGuardado, ...actuales];
    });

    await registrarAuditoriaEvento({
      empresa_id: empresaId,
      modulo: "proveedores",
      accion: proveedorEditandoId ? "actualizar_proveedor" : "crear_proveedor",
      entidad_tipo: "proveedor",
      entidad_id: String(proveedorGuardado.id),
      estado_anterior: proveedorAnterior?.estado || null,
      estado_nuevo: proveedorGuardado.estado || "Activo",
      sensible: true,
      descripcion: proveedorEditandoId
        ? "Proveedor actualizado desde el modulo Proveedores."
        : "Proveedor creado desde el modulo Proveedores.",
      metadatos: {
        nit,
        nombre,
        cuenta_por_pagar_id: payload.cuenta_por_pagar_id,
        plan_impuesto_id: payload.plan_impuesto_id,
        dias_credito: payload.dias_credito,
        preparado_cxp: true,
        preparado_documentos_contables: true,
        preparado_cheques: true,
        preparado_impuestos: true,
        preparado_sat_rtu: true,
        depende_sat: false,
      },
      origen: "modulo_proveedores",
    });

    toast.success(proveedorEditandoId ? "Proveedor actualizado." : "Proveedor creado.");
    limpiarFormulario(String(empresaId));
    setProcesando(false);
  }

  async function inactivarProveedor(proveedor: Proveedor) {
    const empresaId = Number(proveedor.empresa_id);
    if (!validarEmpresaPermitida(empresaId)) {
      toast.error("Empresa no permitida para este usuario.");
      return;
    }
    if (esAuditorSoloLectura(empresaId)) {
      await bloquearAuditor("inactivar_proveedor", empresaId, proveedor.id);
      return;
    }

    const motivo = window.prompt("Motivo de inactivación del proveedor:");
    if (!motivo || motivo.trim().length < 5) {
      toast.error("Indica un motivo válido para inactivar.");
      return;
    }

    setProcesando(true);
    const { data, error } = await supabase
      .from("proveedores")
      .update({
        estado: "Inactivo",
        observaciones: motivo.trim(),
        actualizado_at: new Date().toISOString(),
        actualizado_por: userId,
      })
      .eq("id", proveedor.id)
      .eq("empresa_id", empresaId)
      .select(COLUMNAS_PROVEEDOR)
      .single();

    if (error) {
      toast.error(error.message);
      setProcesando(false);
      return;
    }

    const actualizado = normalizarProveedor(data as Proveedor);
    setProveedores((actuales) =>
      actuales.map((item) => (String(item.id) === String(actualizado.id) ? actualizado : item))
    );

    await registrarAuditoriaEvento({
      empresa_id: empresaId,
      modulo: "proveedores",
      accion: "inactivar_proveedor",
      entidad_tipo: "proveedor",
      entidad_id: String(proveedor.id),
      estado_anterior: proveedor.estado || "Activo",
      estado_nuevo: "Inactivo",
      sensible: true,
      descripcion: "Proveedor inactivado sin borrado fisico.",
      metadatos: {
        nit: proveedor.nit,
        nombre: proveedor.nombre,
        motivo: motivo.trim(),
        conserva_cxp: true,
        conserva_documentos_contables: true,
        conserva_cheques: true,
      },
      origen: "modulo_proveedores",
    });

    toast.success("Proveedor inactivado.");
    if (String(proveedorEditandoId || "") === String(proveedor.id)) limpiarFormulario();
    setProcesando(false);
  }

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 rounded-lg border bg-white px-5 py-4 text-gray-700 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Validando acceso a proveedores...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Toaster position="top-right" />
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Proveedores</p>
            <h1 className="text-3xl font-bold text-gray-900">Registro formal por NIT</h1>
            <p className="mt-1 text-sm text-gray-600">
              Base para CxP, documentos contables, impuestos, cheques y reportes sin dependencia SAT.
            </p>
          </div>
          <button
            type="button"
            onClick={() => limpiarFormulario()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Resumen titulo="Total" valor={proveedores.length} />
          <Resumen titulo="Activos" valor={proveedores.filter((p) => p.estado !== "Inactivo").length} />
          <Resumen titulo="Inactivos" valor={proveedores.filter((p) => p.estado === "Inactivo").length} />
          <Resumen titulo="Empresas" valor={empresas.length} />
        </div>

        <section className="mb-6 rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {proveedorEditandoId ? "Editar proveedor" : "Crear proveedor"}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Empresa
              <select
                className="input-custom mt-1"
                value={form.empresaId}
                onChange={(e) =>
                  setForm((actual) => ({
                    ...actual,
                    empresaId: e.target.value,
                    cuentaPorPagarId: "",
                    planImpuestoId: "",
                  }))
                }
              >
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              NIT *
              <input
                className="input-custom mt-1"
                value={form.nit}
                onChange={(e) => setForm((actual) => ({ ...actual, nit: e.target.value }))}
                onBlur={autollenarPorNit}
                placeholder="NIT del proveedor"
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Nombre *
              <input
                className="input-custom mt-1"
                value={form.nombre}
                onChange={(e) => setForm((actual) => ({ ...actual, nombre: e.target.value }))}
                placeholder="Nombre principal"
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Razón social
              <input
                className="input-custom mt-1"
                value={form.razonSocial}
                onChange={(e) => setForm((actual) => ({ ...actual, razonSocial: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Nombre comercial
              <input
                className="input-custom mt-1"
                value={form.nombreComercial}
                onChange={(e) => setForm((actual) => ({ ...actual, nombreComercial: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Contacto
              <input
                className="input-custom mt-1"
                value={form.contacto}
                onChange={(e) => setForm((actual) => ({ ...actual, contacto: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Teléfono
              <input
                className="input-custom mt-1"
                value={form.telefono}
                onChange={(e) => setForm((actual) => ({ ...actual, telefono: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Correo
              <input
                className="input-custom mt-1"
                type="email"
                value={form.correo}
                onChange={(e) => setForm((actual) => ({ ...actual, correo: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Dirección
              <input
                className="input-custom mt-1"
                value={form.direccion}
                onChange={(e) => setForm((actual) => ({ ...actual, direccion: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Cuenta por pagar
              <select
                className="input-custom mt-1"
                value={form.cuentaPorPagarId}
                onChange={(e) => setForm((actual) => ({ ...actual, cuentaPorPagarId: e.target.value }))}
              >
                <option value="">Sin cuenta asignada</option>
                {cuentasDisponibles.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.codigo} - {cuenta.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Plan de impuestos
              <select
                className="input-custom mt-1"
                value={form.planImpuestoId}
                onChange={(e) => setForm((actual) => ({ ...actual, planImpuestoId: e.target.value }))}
              >
                <option value="">Sin plan asignado</option>
                {impuestosDisponibles.map((impuesto) => (
                  <option key={impuesto.id} value={impuesto.id}>
                    {impuesto.nombre} ({impuesto.tipo} {Number(impuesto.porcentaje || 0)}%)
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Días crédito
              <input
                className="input-custom mt-1"
                type="number"
                min="0"
                value={form.diasCredito}
                onChange={(e) => setForm((actual) => ({ ...actual, diasCredito: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Banco
              <input
                className="input-custom mt-1"
                value={form.banco}
                onChange={(e) => setForm((actual) => ({ ...actual, banco: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Cuenta bancaria
              <input
                className="input-custom mt-1"
                value={form.cuentaBancaria}
                onChange={(e) => setForm((actual) => ({ ...actual, cuentaBancaria: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Tipo de cuenta
              <input
                className="input-custom mt-1"
                value={form.tipoCuenta}
                onChange={(e) => setForm((actual) => ({ ...actual, tipoCuenta: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Moneda
              <select
                className="input-custom mt-1"
                value={form.moneda}
                onChange={(e) => setForm((actual) => ({ ...actual, moneda: e.target.value }))}
              >
                {MONEDAS.map((moneda) => (
                  <option key={moneda} value={moneda}>
                    {moneda}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Tipo proveedor
              <input
                className="input-custom mt-1"
                value={form.tipoProveedor}
                onChange={(e) => setForm((actual) => ({ ...actual, tipoProveedor: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Saldo pendiente
              <input
                className="input-custom mt-1"
                type="number"
                min="0"
                step="0.01"
                value={form.saldoPendiente}
                onChange={(e) => setForm((actual) => ({ ...actual, saldoPendiente: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Estado
              <select
                className="input-custom mt-1"
                value={form.estado}
                onChange={(e) => setForm((actual) => ({ ...actual, estado: e.target.value }))}
              >
                {ESTADOS_PROVEEDOR.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700 md:col-span-3">
              Observaciones
              <textarea
                className="input-custom mt-1 min-h-20"
                value={form.observaciones}
                onChange={(e) => setForm((actual) => ({ ...actual, observaciones: e.target.value }))}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={guardarProveedor}
              disabled={procesando}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {procesando && <Loader2 className="h-4 w-4 animate-spin" />}
              {proveedorEditandoId ? "Guardar cambios" : "Crear proveedor"}
            </button>
            {proveedorEditandoId && (
              <button
                type="button"
                onClick={() => limpiarFormulario()}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Proveedores registrados</h2>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className="input-custom pl-9"
                placeholder="Buscar por NIT, nombre, empresa o contacto"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center py-12 text-gray-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando proveedores...
            </div>
          ) : proveedoresFiltrados.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-gray-500">
              No hay proveedores para los filtros seleccionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {proveedoresFiltrados.map((proveedor) => (
                <article key={proveedor.id} className="rounded-lg border p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{proveedor.nombre}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            proveedor.estado === "Inactivo"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {proveedor.estado || "Activo"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">NIT: {proveedor.nit}</p>
                      <p className="text-sm text-gray-600">{proveedor.empresa || "Empresa sin nombre"}</p>
                    </div>
                    <div className="flex gap-2">
                      {!esAuditorSoloLectura(proveedor.empresa_id) && (
                        <button
                          type="button"
                          onClick={() => cargarProveedorParaEditar(proveedor)}
                          className="rounded-md border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Editar
                        </button>
                      )}
                      {proveedor.estado !== "Inactivo" && !esAuditorSoloLectura(proveedor.empresa_id) && (
                        <button
                          type="button"
                          onClick={() => inactivarProveedor(proveedor)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Inactivar
                        </button>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
                    <Dato etiqueta="Razón social" valor={proveedor.razon_social} />
                    <Dato etiqueta="Nombre comercial" valor={proveedor.nombre_comercial} />
                    <Dato etiqueta="Contacto" valor={proveedor.contacto} />
                    <Dato etiqueta="Teléfono" valor={proveedor.telefono} />
                    <Dato etiqueta="Correo" valor={proveedor.correo} />
                    <Dato etiqueta="Dirección" valor={proveedor.direccion} />
                    <Dato etiqueta="Moneda" valor={proveedor.moneda} />
                    <Dato etiqueta="Días crédito" valor={proveedor.dias_credito ?? "Sin definir"} />
                    <Dato etiqueta="Banco" valor={proveedor.banco} />
                    <Dato etiqueta="Cuenta bancaria" valor={proveedor.cuenta_bancaria} />
                    <Dato etiqueta="Tipo proveedor" valor={proveedor.tipo_proveedor} />
                    <Dato
                      etiqueta="Saldo pendiente"
                      valor={`${proveedor.moneda || "GTQ"} ${Number(
                        proveedor.saldo_pendiente || 0
                      ).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`}
                    />
                  </dl>
                  {proveedor.observaciones && (
                    <p className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                      {proveedor.observaciones}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-gray-800">{valor || "No definido"}</dd>
    </div>
  );
}
