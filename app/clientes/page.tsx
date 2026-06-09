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
import { Loader2, Plus, Search, UserRound } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

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

interface ImpuestoConfig {
  id: string | number;
  empresa_id: number;
  nombre: string;
  tipo: string;
  porcentaje: number;
  activo: boolean;
  aplica_venta: boolean;
}

interface Cliente {
  id: string | number;
  empresa_id: number;
  nit: string;
  nombre: string;
  razon_social: string | null;
  nombre_comercial: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  contacto: string | null;
  estado: string;
  observaciones: string | null;
  cuenta_por_cobrar_id: string | number | null;
  plan_impuesto_id: string | number | null;
  limite_credito: number | null;
  dias_credito: number | null;
  creado_at?: string | null;
  actualizado_at?: string | null;
}

interface CuentaPorCobrarResumen {
  id: string;
  empresa_id: number;
  cliente_id: string;
  numero_documento: string;
  fecha_documento: string;
  fecha_vencimiento: string;
  moneda: string;
  saldo_pendiente: number;
  estado: string;
}

interface ResumenCxCCliente {
  cantidad: number;
  vencidas: number;
  saldoPendiente: number;
  moneda: string;
  ultimaCuenta: CuentaPorCobrarResumen | null;
  estadoGeneral: string;
}

const ESTADOS_CLIENTE = ["Activo", "Inactivo", "Suspendido"];
const COLUMNAS_CLIENTE =
  "id,empresa_id,nit,nombre,razon_social,nombre_comercial,direccion,telefono,correo,contacto,estado,observaciones,cuenta_por_cobrar_id,plan_impuesto_id,limite_credito,dias_credito,creado_at,actualizado_at";
const COLUMNAS_RESUMEN_CXC =
  "id,empresa_id,cliente_id,numero_documento,fecha_documento,fecha_vencimiento,moneda,saldo_pendiente,estado";

function limpiarTexto(valor: string) {
  const texto = valor.trim();
  return texto ? texto : null;
}

function numeroOpcional(valor: string) {
  if (!valor.trim()) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error("Los valores numericos no pueden ser negativos.");
  }
  return numero;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Los valores numericos no pueden ser negativos.") {
    return error.message;
  }
  if (
    error instanceof Error &&
    ["Selecciona una empresa valida.", "No tienes permiso para operar sobre esa empresa."].includes(
      error.message
    )
  ) {
    return error.message;
  }
  return "No se pudo completar la operacion de Clientes. Revisa la conexion y los permisos e intenta nuevamente.";
}

export default function ClientesPage() {
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<CuentaPorCobrarResumen[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [impuestos, setImpuestos] = useState<ImpuestoConfig[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [clienteEditandoId, setClienteEditandoId] = useState<string | number | null>(null);

  const [form, setForm] = useState({
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
    cuentaPorCobrarId: "",
    planImpuestoId: "",
    limiteCredito: "",
    diasCredito: "",
  });

  useEffect(() => {
    void iniciar();
  }, []);

  async function iniciar() {
    try {
      setValidandoAcceso(true);
      const acceso = await validarAccesoModuloUsuario("clientes");

      if (!acceso.ok) {
        if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
          window.location.href = "/login";
          return;
        }

        toast.error("No tienes acceso al modulo Clientes.");
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
      console.error("Error cargando clientes:", error);
      setErrorCarga(
        "No se pudo cargar Clientes. Revisa la conexion y los permisos de las empresas asignadas."
      );
    } finally {
      setCargando(false);
      setValidandoAcceso(false);
    }
  }

  async function cargarDatos(idsPermitidos = empresasPermitidasIds) {
    if (!idsPermitidos.length) {
      setEmpresas([]);
      setClientes([]);
      setCuentasPorCobrar([]);
      setCuentas([]);
      setImpuestos([]);
      setErrorCarga(null);
      return;
    }

    setErrorCarga(null);
    const [resEmpresas, resClientes, resCuentasPorCobrar, resCuentas, resImpuestos] = await Promise.all([
      supabase
        .from("empresas")
        .select("id,nombre")
        .in("id", idsPermitidos)
        .order("nombre", { ascending: true }),
      supabase
        .from("clientes")
        .select(COLUMNAS_CLIENTE)
        .in("empresa_id", idsPermitidos)
        .order("nombre", { ascending: true }),
      supabase
        .from("cuentas_por_cobrar")
        .select(COLUMNAS_RESUMEN_CXC)
        .in("empresa_id", idsPermitidos)
        .order("fecha_documento", { ascending: false }),
      supabase
        .from("catalogo_cuentas")
        .select("id,empresa_id,codigo,nombre,activo,permite_movimientos")
        .or(`empresa_id.is.null,empresa_id.in.(${idsPermitidos.join(",")})`)
        .eq("activo", true)
        .eq("permite_movimientos", true)
        .order("codigo", { ascending: true }),
      supabase
        .from("impuestos_configuracion")
        .select("id,empresa_id,nombre,tipo,porcentaje,activo,aplica_venta")
        .in("empresa_id", idsPermitidos)
        .eq("activo", true)
        .eq("aplica_venta", true)
        .order("nombre", { ascending: true }),
    ]);

    const errores = [
      resEmpresas.error,
      resClientes.error,
      resCuentasPorCobrar.error,
      resCuentas.error,
      resImpuestos.error,
    ].filter(Boolean);
    if (errores.length) {
      console.error("Consultas incompletas en Clientes:", errores);
      setErrorCarga(
        "Algunos datos de Clientes no pudieron cargarse. Revisa la conexion y los permisos configurados."
      );
    }

    setEmpresas((resEmpresas.data || []) as Empresa[]);
    setClientes((resClientes.data || []) as Cliente[]);
    setCuentasPorCobrar((resCuentasPorCobrar.data || []) as CuentaPorCobrarResumen[]);
    setCuentas((resCuentas.data || []) as CuentaContable[]);
    setImpuestos((resImpuestos.data || []) as ImpuestoConfig[]);

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
    const mensaje = "El auditor solo lectura no puede modificar clientes.";
    toast.error(mensaje);
    try {
      await registrarAuditoriaEvento({
        empresa_id: Number.isFinite(empresaNumero) && empresaNumero > 0 ? empresaNumero : null,
        modulo: "clientes",
        accion: "intento_bloqueado_auditor_solo_lectura",
        entidad_tipo: "cliente",
        entidad_id: entidadId || null,
        descripcion: mensaje,
        sensible: true,
        metadatos: { accion_intentada: accion },
        origen: "modulo_clientes",
      });
    } catch (error) {
      console.warn("No se pudo auditar bloqueo de auditor:", error);
    }
  }

  function validarReferencias(empresaId: number) {
    const cuentaId = form.cuentaPorCobrarId || null;
    const impuestoId = form.planImpuestoId || null;

    if (cuentaId) {
      const cuenta = cuentas.find((item) => String(item.id) === String(cuentaId));
      if (!cuenta || !cuenta.activo || !cuenta.permite_movimientos) {
        throw new Error("La cuenta por cobrar no es valida o no permite movimientos.");
      }
      if (cuenta.empresa_id !== null && Number(cuenta.empresa_id) !== empresaId) {
        throw new Error("La cuenta por cobrar no pertenece a la empresa del cliente.");
      }
    }

    if (impuestoId) {
      const impuesto = impuestos.find((item) => String(item.id) === String(impuestoId));
      if (!impuesto || !impuesto.activo || !impuesto.aplica_venta) {
        throw new Error("El plan de impuesto no es valido para ventas.");
      }
      if (Number(impuesto.empresa_id) !== empresaId) {
        throw new Error("El plan de impuesto no pertenece a la empresa del cliente.");
      }
    }
  }

  async function auditarCliente(
    accion: string,
    cliente: Cliente,
    estadoAnterior?: string | null,
    motivo?: string | null
  ) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: cliente.empresa_id,
        modulo: "clientes",
        accion,
        entidad_tipo: "cliente",
        entidad_id: cliente.id,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: cliente.estado,
        motivo: motivo || null,
        descripcion: "Cliente actualizado desde modulo Clientes",
        sensible: true,
        metadatos: {
          nit: cliente.nit,
          nombre: cliente.nombre,
          cuenta_por_cobrar_id: cliente.cuenta_por_cobrar_id,
          plan_impuesto_id: cliente.plan_impuesto_id,
          relacion_cxc_impuestos: "fase_posterior",
        },
        origen: "modulo_clientes",
      });
    } catch (error) {
      console.error("El cambio de cliente se guardo, pero fallo la auditoria:", error);
      toast.error("Cambio guardado, pero fallo la auditoria.");
    }
  }

  async function guardarCliente() {
    if (!userId) {
      toast.error("Sesion no valida.");
      return;
    }

    const nit = form.nit.trim();
    const nombre = form.nombre.trim();
    if (!nit || !nombre) {
      toast.error("NIT y nombre son obligatorios.");
      return;
    }

    let empresaId: number;
    let limiteCredito: number | null;
    let diasCredito: number | null;

    try {
      empresaId = validarEmpresaPermitida(form.empresaId);
      validarReferencias(empresaId);
      limiteCredito = numeroOpcional(form.limiteCredito);
      diasCredito = numeroOpcional(form.diasCredito);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    if (esAuditorSoloLectura(empresaId)) {
      await bloquearAuditor("guardar_cliente", empresaId, clienteEditandoId || null);
      return;
    }

    const duplicado = clientes.find(
      (cliente) =>
        Number(cliente.empresa_id) === empresaId &&
        cliente.nit.trim().toLowerCase() === nit.toLowerCase() &&
        String(cliente.id) !== String(clienteEditandoId || "")
    );

    if (duplicado) {
      toast.error("Ya existe un cliente con ese NIT en esta empresa.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nit,
      nombre,
      razon_social: limpiarTexto(form.razonSocial),
      nombre_comercial: limpiarTexto(form.nombreComercial),
      direccion: limpiarTexto(form.direccion),
      telefono: limpiarTexto(form.telefono),
      correo: limpiarTexto(form.correo),
      contacto: limpiarTexto(form.contacto),
      estado: form.estado,
      observaciones: limpiarTexto(form.observaciones),
      cuenta_por_cobrar_id: form.cuentaPorCobrarId || null,
      plan_impuesto_id: form.planImpuestoId || null,
      limite_credito: limiteCredito,
      dias_credito: diasCredito,
      actualizado_at: new Date().toISOString(),
      actualizado_por: userId,
    };

    const toastId = toast.loading(clienteEditandoId ? "Actualizando cliente..." : "Creando cliente...");
    setProcesando(true);

    try {
      const clienteAnterior = clientes.find(
        (cliente) => String(cliente.id) === String(clienteEditandoId)
      );
      const query = clienteEditandoId
        ? supabase
            .from("clientes")
            .update(payload)
            .eq("id", clienteEditandoId)
            .eq("empresa_id", empresaId)
        : supabase.from("clientes").insert({
            ...payload,
            creado_por: userId,
          });

      const { data, error } = await query.select(COLUMNAS_CLIENTE).single();
      if (error) throw error;

      const cliente = data as Cliente;
      await auditarCliente(
        clienteEditandoId ? "actualizar_cliente" : "crear_cliente",
        cliente,
        clienteAnterior?.estado || null
      );
      limpiarFormulario(String(empresaId));
      await cargarDatos();
      toast.success("Cliente guardado.", { id: toastId });
    } catch (error) {
      console.error("Error guardando cliente:", error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  function cargarClienteParaEditar(cliente: Cliente) {
    if (esAuditorSoloLectura(cliente.empresa_id)) {
      void bloquearAuditor("editar_cliente", cliente.empresa_id, cliente.id);
      return;
    }

    setClienteEditandoId(cliente.id);
    setForm({
      empresaId: String(cliente.empresa_id),
      nit: cliente.nit,
      nombre: cliente.nombre,
      razonSocial: cliente.razon_social || "",
      nombreComercial: cliente.nombre_comercial || "",
      direccion: cliente.direccion || "",
      telefono: cliente.telefono || "",
      correo: cliente.correo || "",
      contacto: cliente.contacto || "",
      estado: cliente.estado || "Activo",
      observaciones: cliente.observaciones || "",
      cuentaPorCobrarId: cliente.cuenta_por_cobrar_id ? String(cliente.cuenta_por_cobrar_id) : "",
      planImpuestoId: cliente.plan_impuesto_id ? String(cliente.plan_impuesto_id) : "",
      limiteCredito: cliente.limite_credito !== null ? String(cliente.limite_credito) : "",
      diasCredito: cliente.dias_credito !== null ? String(cliente.dias_credito) : "",
    });
  }

  function limpiarFormulario(empresaId = form.empresaId) {
    setClienteEditandoId(null);
    setForm({
      empresaId,
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
      cuentaPorCobrarId: "",
      planImpuestoId: "",
      limiteCredito: "",
      diasCredito: "",
    });
  }

  const cuentasDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return cuentas.filter(
      (cuenta) =>
        cuenta.empresa_id === null ||
        (Number.isFinite(empresaId) && Number(cuenta.empresa_id) === empresaId)
    );
  }, [cuentas, form.empresaId]);

  const impuestosDisponibles = useMemo(() => {
    const empresaId = Number(form.empresaId);
    return impuestos.filter(
      (impuesto) => Number.isFinite(empresaId) && Number(impuesto.empresa_id) === empresaId
    );
  }, [impuestos, form.empresaId]);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const empresaId = Number(form.empresaId);
    const clientesEmpresa = Number.isFinite(empresaId)
      ? clientes.filter((cliente) => Number(cliente.empresa_id) === empresaId)
      : [];
    if (!texto) return clientesEmpresa;

    return clientesEmpresa.filter((cliente) =>
      [
        cliente.nit,
        cliente.nombre,
        cliente.razon_social,
        cliente.nombre_comercial,
        cliente.correo,
        cliente.telefono,
        cliente.contacto,
        cliente.estado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, clientes, form.empresaId]);

  const resumenCxCPorCliente = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const resumenes = new Map<string, ResumenCxCCliente>();

    clientes.forEach((cliente) => {
      const relacionadas = cuentasPorCobrar
        .filter(
          (cuenta) =>
            String(cuenta.cliente_id) === String(cliente.id) &&
            Number(cuenta.empresa_id) === Number(cliente.empresa_id)
        )
        .sort((a, b) => b.fecha_documento.localeCompare(a.fecha_documento));
      const saldoPendiente = relacionadas.reduce(
        (total, cuenta) => total + Number(cuenta.saldo_pendiente || 0),
        0
      );
      const vencidas = relacionadas.filter(
        (cuenta) =>
          cuenta.fecha_vencimiento < hoy &&
          Number(cuenta.saldo_pendiente || 0) > 0 &&
          cuenta.estado !== "Anulado"
      ).length;

      resumenes.set(String(cliente.id), {
        cantidad: relacionadas.length,
        vencidas,
        saldoPendiente,
        moneda: relacionadas[0]?.moneda || "GTQ",
        ultimaCuenta: relacionadas[0] || null,
        estadoGeneral: vencidas > 0 ? "Con cuentas vencidas" : saldoPendiente > 0 ? "Pendiente" : relacionadas.length ? "Al día" : "Sin cuentas",
      });
    });

    return resumenes;
  }, [clientes, cuentasPorCobrar]);

  if (validandoAcceso) {
    return (
      <div className="h-screen bg-[#020617] text-cyan-400 flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        Validando acceso...
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="flex min-h-screen bg-[#020617] text-white">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-100">
            {errorCarga || "No se pudo validar el acceso a Clientes."}
          </div>
        </main>
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

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">Clientes</h1>
              <p className="text-gray-400 mt-2">
                Fase posterior: cobros, impuestos y contabilidad con validación.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Resumen titulo="Total" valor={clientes.length} color="text-cyan-400" />
              <Resumen
                titulo="Activos"
                valor={clientes.filter((cliente) => cliente.estado === "Activo").length}
                color="text-green-400"
              />
              <Resumen
                titulo="Inactivos"
                valor={clientes.filter((cliente) => cliente.estado !== "Activo").length}
                color="text-red-400"
              />
            </div>
          </header>

          {errorCarga && (
            <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
              {errorCarga}
            </section>
          )}

          {!empresas.length && !cargando && (
            <section className="mb-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-gray-400">
              No hay empresas operativas asignadas para gestionar clientes.
            </section>
          )}

          {cargando ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando clientes...
            </section>
          ) : (
            <>
              {!!empresas.length && !esAuditorSoloLectura(form.empresaId) && <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
                <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
                  <Plus size={16} className="text-cyan-500" />
                  {clienteEditandoId ? "Editar cliente" : "Registrar cliente"}
                </h2>

                <div className="grid md:grid-cols-4 gap-4">
                  <select
                    value={form.empresaId}
                    onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
                    className="input-custom"
                  >
                    <option value="">Empresa...</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={String(empresa.id)}>
                        {empresa.nombre}
                      </option>
                    ))}
                  </select>
                  <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} placeholder="NIT obligatorio" className="input-custom" />
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" className="input-custom" />
                  <input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} placeholder="Razon social" className="input-custom" />
                  <input value={form.nombreComercial} onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })} placeholder="Nombre comercial" className="input-custom" />
                  <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Direccion" className="input-custom" />
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Telefono" className="input-custom" />
                  <input value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} placeholder="Correo" className="input-custom" />
                  <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Contacto" className="input-custom" />
                  <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="input-custom">
                    {ESTADOS_CLIENTE.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                  <select value={form.cuentaPorCobrarId} onChange={(e) => setForm({ ...form, cuentaPorCobrarId: e.target.value })} className="input-custom">
                    <option value="">Cuenta por cobrar opcional</option>
                    {cuentasDisponibles.map((cuenta) => (
                      <option key={cuenta.id} value={String(cuenta.id)}>
                        {cuenta.codigo} - {cuenta.nombre}
                      </option>
                    ))}
                  </select>
                  <select value={form.planImpuestoId} onChange={(e) => setForm({ ...form, planImpuestoId: e.target.value })} className="input-custom">
                    <option value="">Plan impuesto opcional</option>
                    {impuestosDisponibles.map((impuesto) => (
                      <option key={impuesto.id} value={String(impuesto.id)}>
                        {impuesto.nombre} - {impuesto.porcentaje}%
                      </option>
                    ))}
                  </select>
                  <input type="number" value={form.limiteCredito} onChange={(e) => setForm({ ...form, limiteCredito: e.target.value })} placeholder="Limite credito" className="input-custom" />
                  <input type="number" value={form.diasCredito} onChange={(e) => setForm({ ...form, diasCredito: e.target.value })} placeholder="Dias credito" className="input-custom" />
                  <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" className="input-custom md:col-span-2" />

                  <button
                    onClick={guardarCliente}
                    disabled={procesando}
                    className="md:col-span-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-black font-black rounded-xl h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
                  >
                    {procesando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Guardar cliente
                  </button>
                  {clienteEditandoId && (
                    <button
                      onClick={() => limpiarFormulario()}
                      className="md:col-span-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-black rounded-xl h-[3.5rem] uppercase text-xs"
                    >
                      Cancelar edicion
                    </button>
                  )}
                </div>
              </section>}

              <section className="mb-6 flex items-center gap-3">
                <div className="relative w-full md:w-[520px]">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por NIT, cliente, correo, contacto o estado..."
                    className="input-custom w-full pl-10"
                  />
                </div>
              </section>

              <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {clientesFiltrados.map((cliente) => {
                  const resumenCxC = resumenCxCPorCliente.get(String(cliente.id));

                  return (
                  <div key={cliente.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                          {empresas.find((empresa) => empresa.id === cliente.empresa_id)?.nombre || `Empresa ${cliente.empresa_id}`}
                        </p>
                        <h3 className="text-xl font-black mt-1">{cliente.nombre}</h3>
                        <p className="text-xs text-gray-400 mt-1">{cliente.nombre_comercial || cliente.razon_social || "Sin nombre comercial"}</p>
                      </div>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${cliente.estado === "Activo" ? "bg-green-500/10 text-green-300 border-green-500/20" : "bg-red-500/10 text-red-300 border-red-500/20"}`}>
                        {cliente.estado}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-gray-400">
                      <p>NIT: {cliente.nit}</p>
                      <p>Telefono: {cliente.telefono || "N/A"}</p>
                      <p>Correo: {cliente.correo || "N/A"}</p>
                      <p>Contacto: {cliente.contacto || "N/A"}</p>
                      <p>Limite credito: {cliente.limite_credito ?? "N/A"}</p>
                      <p>Dias credito: {cliente.dias_credito ?? "N/A"}</p>
                      <p>Observaciones: {cliente.observaciones || "N/A"}</p>
                    </div>

                    <section className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-200">
                          Resumen de cuentas por cobrar
                        </h4>
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-100">
                          {resumenCxC?.estadoGeneral || "Sin cuentas"}
                        </span>
                      </div>
                      {!resumenCxC?.cantidad ? (
                        <p className="text-xs text-cyan-100/80">
                          Este cliente aún no tiene cuentas por cobrar registradas.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-xs text-gray-300">
                          <DatoCxC etiqueta="Saldo por cobrar" valor={`${resumenCxC.moneda} ${formatoMonto(resumenCxC.saldoPendiente)}`} />
                          <DatoCxC etiqueta="Cuentas registradas" valor={resumenCxC.cantidad} />
                          <DatoCxC etiqueta="Cuentas vencidas" valor={resumenCxC.vencidas} />
                          <DatoCxC
                            etiqueta="Última cuenta"
                            valor={`${resumenCxC.ultimaCuenta?.numero_documento || "Sin número"} | ${resumenCxC.ultimaCuenta?.fecha_documento || "Sin fecha"}`}
                          />
                        </div>
                      )}
                    </section>

                    <div className="flex gap-2 mt-5">
                      {!esAuditorSoloLectura(cliente.empresa_id) && (
                        <button onClick={() => cargarClienteParaEditar(cliente)} className="flex-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs font-black py-3">
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}

                {clientesFiltrados.length === 0 && (
                  <div className="md:col-span-2 xl:col-span-3 text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                    <UserRound className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-500">
                      {busqueda.trim()
                        ? "No hay clientes para los filtros seleccionados."
                        : "No hay clientes registrados para esta empresa."}
                    </p>
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

function Resumen({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[130px]">
      <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
        {titulo}
      </p>
      <h2 className={`text-2xl font-black mt-1 ${color}`}>{valor}</h2>
    </div>
  );
}

function DatoCxC({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | number;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{etiqueta}</p>
      <p className="mt-1 break-words text-cyan-50">{valor}</p>
    </div>
  );
}

function formatoMonto(valor: number) {
  return Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
