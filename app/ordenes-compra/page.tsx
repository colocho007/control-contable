"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Users,
  FileText,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

interface FirmaOC {
  id: number;
  orden_id: number;
  firmante_id: string;
  firmante_nombre: string | null;
  orden_firma: number;
  estado: string;
  firmado_at: string | null;
  rechazado_at: string | null;
  comentario: string | null;
  created_at: string | null;
}

interface OrdenCompra {
  id: number;
  empresa_id: number | null;
  empresa: string;
  proveedor: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  prioridad: string;
  fecha_orden: string | null;
  fecha_necesaria: string | null;
  estado: string;
  creado_por: string;
  firmas_requeridas: number;
  firmas_completadas: number;
  archivo_url: string | null;
  aprobada_at: string | null;
  rechazada_at: string | null;
  anulada_at: string | null;
  created_at: string | null;
  ordenes_compra_firmas?: FirmaOC[];
}

const ROLES_ADMIN = ["admin", "supervisor", "jefe"];
const ROLES_CREADORES = ["admin", "supervisor", "jefe", "iniciador_gestion"];
const ROLES_FIRMANTES = ["admin", "supervisor", "jefe", "firmante_oc"];

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

export default function OrdenesCompraPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("Todas");

  const [firmantesSeleccionados, setFirmantesSeleccionados] = useState<string[]>([]);

  const [form, setForm] = useState({
    empresaId: "",
    empresa: "",
    proveedor: "",
    concepto: "",
    descripcion: "",
    monto: "",
    prioridad: "Media",
    fechaNecesaria: "",
  });

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("id,nombre,rol")
        .eq("id", user.id)
        .single();

      if (perfilError) throw perfilError;

      setPerfilActual(perfil);

      await Promise.all([
        obtenerEmpresas(),
        obtenerUsuarios(),
        obtenerOrdenes(user.id, perfil?.rol || ""),
      ]);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando órdenes de compra");
    } finally {
      setLoading(false);
    }
  }

  async function obtenerEmpresas() {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre")
      .order("nombre", { ascending: true });

    if (error) throw error;
    setEmpresas(data || []);
  }

  async function obtenerUsuarios() {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre,rol")
      .order("nombre", { ascending: true });

    if (error) throw error;
    setUsuarios(data || []);
  }

  // 🚀 CORRECCIÓN APLICADA: Dejamos que Supabase traiga todo y el Frontend filtra inteligentemente
  async function obtenerOrdenes(usuarioId: string, rol: string) {
    const { data, error } = await supabase
      .from("ordenes_compra")
      .select("*, ordenes_compra_firmas(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const ordenesData = (data || []) as OrdenCompra[];

    if (!ROLES_ADMIN.includes(normalizarRol(rol))) {
      const filtradas = ordenesData.filter((orden) => {
        const esCreador = orden.creado_por === usuarioId;
        const esFirmante = orden.ordenes_compra_firmas?.some(
          (firma) => firma.firmante_id === usuarioId
        );

        return esCreador || esFirmante;
      });

      setOrdenes(filtradas);
      return;
    }

    setOrdenes(ordenesData);
  }

  async function refrescarOrdenes() {
    if (!userId || !perfilActual) return;
    await obtenerOrdenes(userId, perfilActual.rol);
  }

  function money(valor: number) {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: "GTQ",
    }).format(Number(valor || 0));
  }

  function toggleFirmante(id: string) {
    setFirmantesSeleccionados((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  async function crearOrden() {
    if (!userId) {
      toast.error("Sesión no válida");
      return;
    }

    if (!form.empresaId || !form.proveedor || !form.concepto || !form.monto) {
      toast.error("Completa empresa, proveedor, concepto y monto");
      return;
    }

    if (firmantesSeleccionados.length === 0) {
      toast.error("Selecciona al menos un firmante");
      return;
    }

    const toastId = toast.loading("Creando orden de compra...");

    try {
      const { data: ordenCreada, error: ordenError } = await supabase
        .from("ordenes_compra")
        .insert([
          {
            empresa_id: Number(form.empresaId),
            empresa: form.empresa,
            proveedor: form.proveedor,
            concepto: form.concepto,
            descripcion: form.descripcion || null,
            monto: Number(form.monto),
            prioridad: form.prioridad,
            fecha_necesaria: form.fechaNecesaria || null,
            estado: "Pendiente de firmas",
            creado_por: userId,
            firmas_requeridas: firmantesSeleccionados.length,
            firmas_completadas: 0,
          },
        ])
        .select()
        .single();

      if (ordenError) throw ordenError;

      const firmas = firmantesSeleccionados.map((firmanteId, index) => {
        const firmante = usuarios.find((u) => u.id === firmanteId);

        return {
          orden_id: ordenCreada.id,
          firmante_id: firmanteId,
          firmante_nombre: firmante?.nombre || "Firmante",
          orden_firma: index + 1,
          estado: "Pendiente",
        };
      });

      const { error: firmasError } = await supabase
        .from("ordenes_compra_firmas")
        .insert(firmas);

      if (firmasError) throw firmasError;

      await supabase.from("ordenes_compra_historial").insert([
        {
          orden_id: ordenCreada.id,
          accion: "Orden creada",
          estado_anterior: null,
          estado_nuevo: "Pendiente de firmas",
          comentario: `Orden enviada a ${firmantesSeleccionados.length} firmante(s)`,
          usuario_id: userId,
        },
      ]);

      setForm({
        empresaId: "",
        empresa: "",
        proveedor: "",
        concepto: "",
        descripcion: "",
        monto: "",
        prioridad: "Media",
        fechaNecesaria: "",
      });

      setFirmantesSeleccionados([]);
      await refrescarOrdenes();
      toast.success("Orden enviada a firmas", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al crear orden", { id: toastId });
    }
  }

  async function confirmarFirma(orden: OrdenCompra) {
    if (!userId) return;

    const firma = orden.ordenes_compra_firmas?.find(
      (f) => f.firmante_id === userId
    );

    if (!firma) {
      toast.error("Esta orden no está asignada a tu firma");
      return;
    }

    if (firma.estado === "Firmado") {
      toast.error("Ya confirmaste esta firma");
      return;
    }

    setProcesandoId(orden.id);
    const toastId = toast.loading("Confirmando firma...");

    try {
      const ahora = new Date().toISOString();

      const { error: firmaError } = await supabase
        .from("ordenes_compra_firmas")
        .update({
          estado: "Firmado",
          firmado_at: ahora,
          comentario: "Firma confirmada",
        })
        .eq("id", firma.id);

      if (firmaError) throw firmaError;

      const { count: firmasReales } = await supabase
        .from("ordenes_compra_firmas")
        .select("*", { count: "exact", head: true })
        .eq("orden_id", orden.id)
        .eq("estado", "Firmado");

      const nuevasFirmasCompletadas = firmasReales || 1;
      const estaAprobada = nuevasFirmasCompletadas >= orden.firmas_requeridas;

      const nuevoEstado = estaAprobada
        ? "Aprobada"
        : "Firmada parcialmente";

      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          firmas_completadas: nuevasFirmasCompletadas,
          estado: nuevoEstado,
          aprobada_at: estaAprobada ? ahora : null,
        })
        .eq("id", orden.id);

      if (ordenError) throw ordenError;

      await supabase.from("ordenes_compra_historial").insert([
        {
          orden_id: orden.id,
          accion: "Firma confirmada",
          estado_anterior: orden.estado,
          estado_nuevo: nuevoEstado,
          comentario: `Firmó ${perfilActual?.nombre || "usuario"}`,
          usuario_id: userId,
        },
      ]);

      await refrescarOrdenes();

      toast.success(
        estaAprobada ? "Orden aprobada completamente" : "Firma registrada",
        { id: toastId }
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al firmar", { id: toastId });
    } finally {
      setProcesandoId(null);
    }
  }

  async function observarOrden(orden: OrdenCompra) {
    if (!userId) return;

    const comentario = window.prompt("Escribe el motivo de la observación:");

    if (!comentario) {
      toast.error("Debes escribir un motivo");
      return;
    }

    const firma = orden.ordenes_compra_firmas?.find(
      (f) => f.firmante_id === userId
    );

    if (!firma) {
      toast.error("Esta orden no está asignada a tu firma");
      return;
    }

    setProcesandoId(orden.id);
    const toastId = toast.loading("Registrando observación...");

    try {
      const ahora = new Date().toISOString();

      const { error: firmaError } = await supabase
        .from("ordenes_compra_firmas")
        .update({
          estado: "Observada",
          rechazado_at: ahora,
          comentario,
        })
        .eq("id", firma.id);

      if (firmaError) throw firmaError;

      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          estado: "Observada",
          rechazada_at: ahora,
        })
        .eq("id", orden.id);

      if (ordenError) throw ordenError;

      await supabase.from("ordenes_compra_historial").insert([
        {
          orden_id: orden.id,
          accion: "Orden observada",
          estado_anterior: orden.estado,
          estado_nuevo: "Observada",
          comentario,
          usuario_id: userId,
        },
      ]);

      await refrescarOrdenes();

      toast.success("Orden observada", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al observar", { id: toastId });
    } finally {
      setProcesandoId(null);
    }
  }

  const puedeCrear = ROLES_CREADORES.includes(normalizarRol(perfilActual?.rol));

  const usuariosFirmantes = usuarios.filter((u) =>
    ROLES_FIRMANTES.includes(normalizarRol(u.rol))
  );

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((orden) => {
      const matchEstado =
        filtroEstado === "Todos" ? true : orden.estado === filtroEstado;

      const matchEmpresa =
        filtroEmpresa === "Todas" ? true : orden.empresa === filtroEmpresa;

      return matchEstado && matchEmpresa;
    });
  }, [ordenes, filtroEstado, filtroEmpresa]);

  const stats = useMemo(() => {
    return {
      pendientes: ordenes.filter((o) => o.estado === "Pendiente de firmas").length,
      parciales: ordenes.filter((o) => o.estado === "Firmada parcialmente").length,
      aprobadas: ordenes.filter((o) => o.estado === "Aprobada").length,
      observadas: ordenes.filter((o) => o.estado === "Observada").length,
    };
  }, [ordenes]);

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] text-cyan-400 flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        Cargando órdenes...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Toaster position="bottom-right" toastOptions={{ style: { background: "#0f172a", color: "#fff", border: "1px solid #1e293b" } }} />
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">
                Órdenes de compra
              </h1>
              <p className="text-gray-400 mt-2">
                Creación, revisión y confirmación de firmas
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Pendientes" value={stats.pendientes} color="text-yellow-400" />
              <Stat label="Parciales" value={stats.parciales} color="text-cyan-400" />
              <Stat label="Aprobadas" value={stats.aprobadas} color="text-green-400" />
              <Stat label="Observadas" value={stats.observadas} color="text-red-400" />
            </div>
          </header>

          {puedeCrear && (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
              <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
                <Plus size={16} className="text-cyan-500" />
                Crear orden de compra
              </h2>

              <div className="grid md:grid-cols-4 gap-4">
                <select
                  value={form.empresaId}
                  onChange={(e) => {
                    const empresa = empresas.find((emp) => String(emp.id) === e.target.value);
                    setForm({
                      ...form,
                      empresaId: e.target.value,
                      empresa: empresa ? empresa.nombre : "",
                    });
                  }}
                  className="input-custom"
                >
                  <option value="">Empresa...</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Proveedor"
                  value={form.proveedor}
                  onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                  className="input-custom"
                />

                <input
                  type="text"
                  placeholder="Concepto"
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  className="input-custom"
                />

                <input
                  type="number"
                  placeholder="Monto Q"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  className="input-custom"
                />

                <input
                  type="date"
                  value={form.fechaNecesaria}
                  onChange={(e) => setForm({ ...form, fechaNecesaria: e.target.value })}
                  className="input-custom"
                />

                <select
                  value={form.prioridad}
                  onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                  className="input-custom"
                >
                  <option value="Alta">Prioridad Alta</option>
                  <option value="Media">Prioridad Media</option>
                  <option value="Baja">Prioridad Baja</option>
                </select>

                <textarea
                  placeholder="Descripción adicional"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="input-custom md:col-span-2 h-28 py-4 resize-none"
                />

                <div className="md:col-span-4 border border-white/10 rounded-2xl p-4 bg-[#0f172a]/60">
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={16} className="text-cyan-400" />
                    <h3 className="text-sm font-black uppercase text-gray-300">
                      Seleccionar firmantes
                    </h3>
                  </div>

                  <div className="grid md:grid-cols-4 gap-3">
                    {usuariosFirmantes.map((usuario) => (
                      <label
                        key={usuario.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          firmantesSeleccionados.includes(usuario.id)
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                            : "border-white/10 bg-white/[0.02] text-gray-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={firmantesSeleccionados.includes(usuario.id)}
                          onChange={() => toggleFirmante(usuario.id)}
                        />
                        <span className="text-xs font-bold">
                          {usuario.nombre} — {usuario.rol}
                        </span>
                      </label>
                    ))}

                    {usuariosFirmantes.length === 0 && (
                      <p className="text-gray-500 text-sm md:col-span-4">
                        No hay usuarios firmantes registrados.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={crearOrden}
                  className="md:col-span-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Enviar orden a firma
                </button>
              </div>
            </section>
          )}

          <section className="flex flex-col md:flex-row gap-4 mb-6">
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="input-custom md:w-72"
            >
              <option value="Todas">Todas las empresas</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.nombre}>
                  {emp.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input-custom md:w-72"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Pendiente de firmas">Pendiente de firmas</option>
              <option value="Firmada parcialmente">Firmada parcialmente</option>
              <option value="Aprobada">Aprobada</option>
              <option value="Observada">Observada</option>
            </select>
          </section>

          <section className="grid gap-4">
            {ordenesFiltradas.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <p className="text-gray-500">No hay órdenes para mostrar.</p>
              </div>
            )}

            {ordenesFiltradas.map((orden) => (
              <OrdenCard
                key={orden.id}
                orden={orden}
                userId={userId}
                money={money}
                procesando={procesandoId === orden.id}
                onFirmar={() => confirmarFirma(orden)}
                onObservar={() => observarOrden(orden)}
              />
            ))}
          </section>
        </div>
      </main>

      <style jsx>{`
        .input-custom {
          height: 3.5rem;
          padding: 0 1rem;
          border-radius: 0.9rem;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255,255,255,0.1);
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

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[130px]">
      <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
        {label}
      </p>
      <h2 className={`text-2xl font-black mt-1 ${color}`}>{value}</h2>
    </div>
  );
}

function OrdenCard({
  orden,
  userId,
  money,
  procesando,
  onFirmar,
  onObservar,
}: {
  orden: OrdenCompra;
  userId: string | null;
  money: (valor: number) => string;
  procesando: boolean;
  onFirmar: () => void;
  onObservar: () => void;
}) {
  const firmas = orden.ordenes_compra_firmas || [];

  const miFirma = firmas.find((f) => f.firmante_id === userId);
  const puedeFirmar = miFirma && miFirma.estado === "Pendiente";

  return (
    <div className="rounded-[2rem] p-6 border border-white/10 bg-white/[0.03] hover:border-cyan-500/30 transition-all">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              #{orden.id}
            </span>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/10 text-white border border-white/10 uppercase">
              {orden.estado}
            </span>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Firmas: {orden.firmas_completadas}/{orden.firmas_requeridas}
            </span>
          </div>

          <h3 className="text-2xl font-black tracking-tight">
            {orden.proveedor}
          </h3>

          <p className="text-gray-400 mt-1">{orden.concepto}</p>

          {orden.descripcion && (
            <p className="text-gray-500 text-sm mt-2">{orden.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 mt-4 font-bold uppercase">
            <span className="flex items-center gap-1">
              <Building2 size={14} className="text-cyan-500" />
              {orden.empresa}
            </span>

            <span className="flex items-center gap-1">
              <DollarSign size={14} className="text-green-500" />
              {money(orden.monto)}
            </span>

            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-purple-500" />
              Necesaria: {orden.fecha_necesaria || "N/A"}
            </span>

            <span className="flex items-center gap-1">
              <FileText size={14} className="text-yellow-500" />
              Prioridad: {orden.prioridad}
            </span>
          </div>

          <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-4 gap-2">
            {firmas.map((firma) => (
              <div
                key={firma.id}
                className={`rounded-xl border p-3 ${
                  firma.estado === "Firmado"
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : firma.estado === "Observada"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                }`}
              >
                <p className="text-[10px] font-black uppercase">
                  {firma.firmante_nombre}
                </p>
                <p className="text-[10px] mt-1">
                  Estado: {firma.estado}
                </p>

                {firma.firmado_at && (
                  <p className="text-[9px] mt-1 text-gray-400">
                    Firmó: {new Date(firma.firmado_at).toLocaleString()}
                  </p>
                )}

                {firma.comentario && (
                  <p className="text-[9px] mt-1 text-gray-400">
                    {firma.comentario}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {puedeFirmar && (
          <div className="flex flex-wrap xl:flex-col gap-2 min-w-[180px]">
            <button
              onClick={onFirmar}
              disabled={procesando}
              className="bg-green-500 hover:bg-green-400 text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {procesando ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              Ya firmé
            </button>

            <button
              onClick={onObservar}
              disabled={procesando}
              className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <XCircle size={14} />
              Observar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}