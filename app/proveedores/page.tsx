"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { Loader2, Plus, Search, Truck } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
}

interface Proveedor {
  id: number;
  empresa_id: number;
  empresa: string;
  nombre: string;
  nombre_comercial: string | null;
  nit: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  tipo_cuenta: string | null;
  moneda: string;
  tipo_proveedor: string | null;
  observaciones: string | null;
  saldo_pendiente: number | null;
  estado: string | null;
  created_at: string | null;
}

export default function ProveedoresPage() {
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rolActual, setRolActual] = useState("");

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [form, setForm] = useState({
    empresaId: "",
    empresa: "",
    nombre: "",
    nombreComercial: "",
    nit: "",
    telefono: "",
    correo: "",
    direccion: "",
    banco: "",
    cuentaBancaria: "",
    tipoCuenta: "",
    moneda: "GTQ",
    tipoProveedor: "",
    observaciones: "",
    saldoPendiente: "0",
    estado: "Activo",
  });

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    try {
      setLoading(true);

      const acceso = await validarAccesoModuloUsuario("proveedores");

      if (!acceso.ok) {
        if (
          acceso.motivo === "sin_sesion" ||
          acceso.motivo === "sin_perfil" ||
          acceso.motivo === "usuario_inactivo"
        ) {
          if (acceso.motivo === "usuario_inactivo") {
            toast.error("Tu usuario está inactivo. Contacta al administrador.");
          }

          window.location.href = "/login";
          return;
        }

        if (
          acceso.motivo === "modulo_inactivo" ||
          acceso.motivo === "modulo_no_encontrado"
        ) {
          toast.error("El módulo de Proveedores está desactivado.");
        } else {
          toast.error("No tienes acceso al módulo de Proveedores.");
        }

        window.location.href = "/dashboard";
        return;
      }

      const user = acceso.user!;
      const perfil = acceso.perfil!;

      setUserId(user.id);
      setRolActual(perfil.rol || "");

      await obtenerEmpresas(user.id, perfil.rol || "");
      await obtenerProveedores(user.id, perfil.rol || "");
      setAutorizado(true);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }

  async function obtenerEmpresas(usuarioId: string, rol: string) {
    const idsPermitidos = await obtenerEmpresasPermitidas(usuarioId, rol);

    if (!idsPermitidos.length) {
      setEmpresas([]);
      return;
    }

    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) throw error;

    setEmpresas(data || []);
  }

  async function obtenerProveedores(usuarioId: string, rol: string) {
    const idsPermitidos = await obtenerEmpresasPermitidas(usuarioId, rol);

    if (!idsPermitidos.length) {
      setProveedores([]);
      return;
    }

    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .in("empresa_id", idsPermitidos)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setProveedores(data || []);
  }

  async function crearProveedor() {
    if (!form.empresaId || !form.empresa || !form.nombre.trim()) {
      toast.error("Selecciona empresa y escribe el nombre del proveedor");
      return;
    }

    if (!userId) {
      toast.error("Sesión no válida");
      return;
    }

    const saldo = Number(form.saldoPendiente || 0);

    if (Number.isNaN(saldo) || saldo < 0) {
      toast.error("El saldo pendiente no puede ser negativo");
      return;
    }

    if (!['GTQ', 'USD'].includes(form.moneda)) {
      toast.error("Selecciona una moneda válida");
      return;
    }

    const nitLimpio = form.nit.trim();

    if (nitLimpio) {
      const proveedorDuplicado = proveedores.find(
        (p) =>
          Number(p.empresa_id) === Number(form.empresaId) &&
          (p.nit || "").trim().toLowerCase() === nitLimpio.toLowerCase()
      );

      if (proveedorDuplicado) {
        toast.error("Ya existe un proveedor con ese NIT en esta empresa");
        return;
      }
    }

    const toastId = toast.loading("Creando proveedor...");
    setProcesando(true);

    try {
      const { error } = await supabase.from("proveedores").insert([
        {
          empresa_id: Number(form.empresaId),
          empresa: form.empresa,
          nombre: form.nombre.trim(),
          nombre_comercial: form.nombreComercial.trim() || null,
          nit: nitLimpio || null,
          telefono: form.telefono.trim() || null,
          correo: form.correo.trim() || null,
          direccion: form.direccion.trim() || null,
          banco: form.banco.trim() || null,
          cuenta_bancaria: form.cuentaBancaria.trim() || null,
          tipo_cuenta: form.tipoCuenta.trim() || null,
          moneda: form.moneda,
          tipo_proveedor: form.tipoProveedor.trim() || null,
          observaciones: form.observaciones.trim() || null,
          saldo_pendiente: saldo,
          estado: form.estado,
        },
      ]);

      if (error) throw error;

      await obtenerProveedores(userId, rolActual);

      setForm({
        empresaId: "",
        empresa: "",
        nombre: "",
        nombreComercial: "",
        nit: "",
        telefono: "",
        correo: "",
        direccion: "",
        banco: "",
        cuentaBancaria: "",
        tipoCuenta: "",
        moneda: "GTQ",
        tipoProveedor: "",
        observaciones: "",
        saldoPendiente: "0",
        estado: "Activo",
      });

      toast.success("Proveedor creado correctamente", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al crear proveedor", { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  function money(valor: number, moneda: string = "GTQ") {
    return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-GT", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "GTQ",
    }).format(Number(valor || 0));
  }

  function colorEstado(estado: string | null) {
    if (estado === "Activo") return "text-green-300 bg-green-500/10 border-green-500/20";
    if (estado === "Suspendido") return "text-yellow-300 bg-yellow-500/10 border-yellow-500/20";
    return "text-red-300 bg-red-500/10 border-red-500/20";
  }

  const proveedoresFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    if (!texto) return proveedores;

    return proveedores.filter((p) =>
      [
        p.nombre,
        p.nombre_comercial,
        p.nit,
        p.empresa,
        p.banco,
        p.cuenta_bancaria,
        p.correo,
        p.tipo_proveedor,
        p.estado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [proveedores, busqueda]);

  if (loading || !autorizado) {
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
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">Proveedores</h1>
              <p className="text-gray-400 mt-2">
                Registro de proveedores, cuentas bancarias, moneda y datos fiscales
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[150px]">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
                  Total
                </p>
                <h2 className="text-2xl font-black mt-1 text-cyan-400">
                  {proveedores.length}
                </h2>
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[150px]">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
                  Activos
                </p>
                <h2 className="text-2xl font-black mt-1 text-green-400">
                  {proveedores.filter((p) => p.estado === "Activo").length}
                </h2>
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[150px]">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
                  Suspendidos
                </p>
                <h2 className="text-2xl font-black mt-1 text-yellow-400">
                  {proveedores.filter((p) => p.estado === "Suspendido").length}
                </h2>
              </div>
            </div>
          </header>

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
            <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Plus size={16} className="text-cyan-500" />
              Registrar proveedor
            </h2>

            <div className="grid md:grid-cols-4 gap-4">
              <select
                value={form.empresa}
                onChange={(e) => {
                  const empresa = empresas.find((emp) => emp.nombre === e.target.value);

                  setForm({
                    ...form,
                    empresa: e.target.value,
                    empresaId: empresa ? String(empresa.id) : "",
                  });
                }}
                className="input-custom"
              >
                <option value="">Empresa...</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.nombre}>
                    {emp.nombre}
                  </option>
                ))}
              </select>

              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre / razón social"
                className="input-custom"
              />

              <input
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                placeholder="Nombre comercial"
                className="input-custom"
              />

              <input
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                placeholder="NIT"
                className="input-custom"
              />

              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="Teléfono"
                className="input-custom"
              />

              <input
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                placeholder="Correo"
                className="input-custom"
              />

              <input
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección"
                className="input-custom"
              />

              <select
                value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                className="input-custom"
              >
                <option value="GTQ">Quetzales GTQ</option>
                <option value="USD">Dólares USD</option>
              </select>

              <input
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                placeholder="Banco"
                className="input-custom"
              />

              <input
                value={form.cuentaBancaria}
                onChange={(e) => setForm({ ...form, cuentaBancaria: e.target.value })}
                placeholder="Cuenta bancaria"
                className="input-custom"
              />

              <input
                value={form.tipoCuenta}
                onChange={(e) => setForm({ ...form, tipoCuenta: e.target.value })}
                placeholder="Tipo cuenta"
                className="input-custom"
              />

              <input
                value={form.tipoProveedor}
                onChange={(e) => setForm({ ...form, tipoProveedor: e.target.value })}
                placeholder="Tipo proveedor"
                className="input-custom"
              />

              <input
                type="number"
                value={form.saldoPendiente}
                onChange={(e) => setForm({ ...form, saldoPendiente: e.target.value })}
                placeholder="Saldo pendiente"
                className="input-custom"
              />

              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="input-custom"
              >
                <option value="Activo">Activo</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Inactivo">Inactivo</option>
              </select>

              <input
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Observaciones"
                className="input-custom md:col-span-2"
              />

              <button
                onClick={crearProveedor}
                disabled={procesando}
                className="md:col-span-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black rounded-xl h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
              >
                {procesando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Crear proveedor
              </button>
            </div>
          </section>

          <section className="mb-6 flex items-center gap-3">
            <div className="relative w-full md:w-[520px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por proveedor, NIT, empresa, banco, cuenta, correo o estado..."
                className="input-custom w-full pl-10"
              />
            </div>
          </section>

          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {proveedoresFiltrados.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                      {p.empresa}
                    </p>
                    <h3 className="text-xl font-black mt-1">{p.nombre}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {p.nombre_comercial || "Sin nombre comercial"}
                    </p>
                  </div>

                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {p.moneda}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-gray-400">
                  <p>NIT: {p.nit || "N/A"}</p>
                  <p>Teléfono: {p.telefono || "N/A"}</p>
                  <p>Correo: {p.correo || "N/A"}</p>
                  <p>Banco: {p.banco || "N/A"}</p>
                  <p>Cuenta: {p.cuenta_bancaria || "N/A"}</p>
                  <p>Tipo proveedor: {p.tipo_proveedor || "N/A"}</p>
                  <p>Observaciones: {p.observaciones || "N/A"}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">
                      Saldo pendiente
                    </p>
                    <p className="text-sm font-black text-yellow-300 mt-1">
                      {money(Number(p.saldo_pendiente || 0), p.moneda)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">
                      Estado
                    </p>
                    <p className={`text-[10px] font-black mt-1 px-2 py-1 rounded-full border inline-block ${colorEstado(p.estado)}`}>
                      {p.estado || "Activo"}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {proveedoresFiltrados.length === 0 && (
              <div className="md:col-span-2 xl:col-span-3 text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <Truck className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500">No hay proveedores para mostrar.</p>
              </div>
            )}
          </section>
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
