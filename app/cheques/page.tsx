"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  FileText,
  Plus,
  CheckCircle2,
  Archive,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Building2,
  Calendar,
  Loader2,
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

interface Cheque {
  id: number;
  empresa_id: number | null;
  empresa: string;
  beneficiario: string;
  concepto: string;
  monto: number;
  tipo_pago: string;
  prioridad: string;
  fecha_pago: string;
  fecha_limite_autorizacion: string | null;
  estado: string;
  creado_por: string | null;
  responsable_actual: string | null;
  enviado_at: string | null;
  autorizado_por: string | null;
  autorizado_at: string | null;
  rechazado_por: string | null;
  rechazado_at: string | null;
  motivo_rechazo: string | null;
  archivado_por: string | null;
  archivado_at: string | null;
  motivo_archivo: string | null;
  pagado_at: string | null;
  movimiento_generado: boolean | null;
  created_at: string | null;
}

const ROLES_JEFATURA = ["admin", "supervisor", "jefe"];

export default function ChequesPage() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("Todas");

  const [form, setForm] = useState({
    empresaId: "",
    empresa: "",
    beneficiario: "",
    concepto: "",
    monto: "",
    tipoPago: "Proveedor",
    prioridad: "Media",
    fechaPago: "",
    responsableActual: "",
  });

  useEffect(() => {
    iniciar();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(timer);
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

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setPerfilActual(perfil);

      await Promise.all([
        obtenerEmpresas(),
        obtenerUsuarios(),
        obtenerCheques(user.id, perfil?.rol || ""),
      ]);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando módulo de cheques");
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

  async function obtenerCheques(usuarioId: string, rol: string) {
    let query = supabase
      .from("cheques")
      .select("*")
      .order("created_at", { ascending: false });

    if (!ROLES_JEFATURA.includes(rol)) {
      query = query.or(`creado_por.eq.${usuarioId},responsable_actual.eq.${usuarioId}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    setCheques(data || []);
  }

  function calcularLimiteAutorizacion(fechaPago: string, prioridad: string) {
    const ahora = new Date();

    if (!fechaPago) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 4);
      return limite.toISOString();
    }

    const fecha = new Date(`${fechaPago}T12:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaBase = new Date(fecha);
    fechaBase.setHours(0, 0, 0, 0);

    const diferenciaDias = Math.round(
      (fechaBase.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (prioridad === "Alta" || diferenciaDias <= 0) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 2);
      return limite.toISOString();
    }

    if (diferenciaDias === 1) {
      const limite = new Date();
      limite.setHours(17, 0, 0, 0);
      return limite.toISOString();
    }

    const limite = new Date(fecha);
    limite.setDate(limite.getDate() - 1);
    limite.setHours(17, 0, 0, 0);
    return limite.toISOString();
  }

  async function crearCheque() {
    if (!form.empresa || !form.beneficiario || !form.concepto || !form.monto || !form.fechaPago) {
      toast.error("Completa empresa, beneficiario, concepto, monto y fecha de pago");
      return;
    }

    if (!userId) {
      toast.error("Sesión no válida");
      return;
    }

    const toastId = toast.loading("Creando cheque...");

    try {
      const limite = calcularLimiteAutorizacion(form.fechaPago, form.prioridad);

      const { data, error } = await supabase
        .from("cheques")
        .insert([
          {
            empresa_id: form.empresaId ? Number(form.empresaId) : null,
            empresa: form.empresa,
            beneficiario: form.beneficiario,
            concepto: form.concepto,
            monto: Number(form.monto),
            tipo_pago: form.tipoPago,
            prioridad: form.prioridad,
            fecha_pago: form.fechaPago,
            fecha_limite_autorizacion: limite,
            estado: "Pendiente de autorización",
            creado_por: userId,
            responsable_actual: form.responsableActual || null,
            enviado_at: new Date().toISOString(),
            movimiento_generado: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await supabase.from("cheques_historial").insert([
        {
          cheque_id: data.id,
          accion: "Creado y enviado a autorización",
          estado_anterior: null,
          estado_nuevo: "Pendiente de autorización",
          comentario: "Cheque creado desde el sistema",
          usuario_id: userId,
        },
      ]);

      setCheques((prev) => [data, ...prev]);

      setForm({
        empresaId: "",
        empresa: "",
        beneficiario: "",
        concepto: "",
        monto: "",
        tipoPago: "Proveedor",
        prioridad: "Media",
        fechaPago: "",
        responsableActual: "",
      });

      toast.success("Cheque enviado a autorización", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al crear cheque", { id: toastId });
    }
  }

  async function registrarHistorial(
    chequeId: number,
    accion: string,
    estadoAnterior: string,
    estadoNuevo: string,
    comentario?: string
  ) {
    await supabase.from("cheques_historial").insert([
      {
        cheque_id: chequeId,
        accion,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        comentario: comentario || null,
        usuario_id: userId,
      },
    ]);
  }

  async function autorizarCheque(cheque: Cheque) {
    if (!userId) return;

    setProcesandoId(cheque.id);
    const toastId = toast.loading("Autorizando cheque...");

    try {
      const { error } = await supabase
        .from("cheques")
        .update({
          estado: "Autorizado",
          autorizado_por: userId,
          autorizado_at: new Date().toISOString(),
        })
        .eq("id", cheque.id);

      if (error) throw error;

      await registrarHistorial(
        cheque.id,
        "Autorizado",
        cheque.estado,
        "Autorizado",
        "Cheque autorizado"
      );

      setCheques((prev) =>
        prev.map((c) =>
          c.id === cheque.id
            ? {
                ...c,
                estado: "Autorizado",
                autorizado_por: userId,
                autorizado_at: new Date().toISOString(),
              }
            : c
        )
      );

      toast.success("Cheque autorizado", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Error al autorizar", { id: toastId });
    } finally {
      setProcesandoId(null);
    }
  }

  async function rechazarCheque(cheque: Cheque) {
    if (!userId) return;

    const motivo = window.prompt("Indica el motivo del rechazo:");

    if (!motivo) {
      toast.error("Debes indicar un motivo");
      return;
    }

    setProcesandoId(cheque.id);
    const toastId = toast.loading("Rechazando cheque...");

    try {
      const { error } = await supabase
        .from("cheques")
        .update({
          estado: "Rechazado",
          rechazado_por: userId,
          rechazado_at: new Date().toISOString(),
          motivo_rechazo: motivo,
        })
        .eq("id", cheque.id);

      if (error) throw error;

      await registrarHistorial(
        cheque.id,
        "Rechazado",
        cheque.estado,
        "Rechazado",
        motivo
      );

      setCheques((prev) =>
        prev.map((c) =>
          c.id === cheque.id
            ? {
                ...c,
                estado: "Rechazado",
                rechazado_por: userId,
                rechazado_at: new Date().toISOString(),
                motivo_rechazo: motivo,
              }
            : c
        )
      );

      toast.success("Cheque rechazado", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Error al rechazar", { id: toastId });
    } finally {
      setProcesandoId(null);
    }
  }

  async function archivarCheque(cheque: Cheque) {
    if (!userId) return;

    const motivo = window.prompt("Indica el motivo del archivo o pausa:");

    if (!motivo) {
      toast.error("Debes indicar un motivo");
      return;
    }

    setProcesandoId(cheque.id);
    const toastId = toast.loading("Archivando cheque...");

    try {
      const { error } = await supabase
        .from("cheques")
        .update({
          estado: "Archivado",
          archivado_por: userId,
          archivado_at: new Date().toISOString(),
          motivo_archivo: motivo,
        })
        .eq("id", cheque.id);

      if (error) throw error;

      await registrarHistorial(
        cheque.id,
        "Archivado",
        cheque.estado,
        "Archivado",
        motivo
      );

      setCheques((prev) =>
        prev.map((c) =>
          c.id === cheque.id
            ? {
                ...c,
                estado: "Archivado",
                archivado_por: userId,
                archivado_at: new Date().toISOString(),
                motivo_archivo: motivo,
              }
            : c
        )
      );

      toast.success("Cheque archivado", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Error al archivar", { id: toastId });
    } finally {
      setProcesandoId(null);
    }
  }

  async function marcarPagado(cheque: Cheque) {
    if (!userId) return;

    setProcesandoId(cheque.id);
    const toastId = toast.loading("Marcando como pagado...");

    try {
      if (!cheque.movimiento_generado) {
        const { error: movError } = await supabase.from("movimientos").insert([
          {
            tipo: "Egreso",
            descripcion: `${cheque.tipo_pago}: ${cheque.concepto} - ${cheque.beneficiario}`,
            monto: Number(cheque.monto),
            empresa: cheque.empresa,
            fecha: new Date().toISOString().split("T")[0],
          },
        ]);

        if (movError) throw movError;
      }

      const { error } = await supabase
        .from("cheques")
        .update({
          estado: "Pagado",
          pagado_at: new Date().toISOString(),
          movimiento_generado: true,
        })
        .eq("id", cheque.id);

      if (error) throw error;

      await registrarHistorial(
        cheque.id,
        "Pagado",
        cheque.estado,
        "Pagado",
        "Cheque pagado y cargado a contabilidad"
      );

      setCheques((prev) =>
        prev.map((c) =>
          c.id === cheque.id
            ? {
                ...c,
                estado: "Pagado",
                pagado_at: new Date().toISOString(),
                movimiento_generado: true,
              }
            : c
        )
      );

      toast.success("Cheque pagado y registrado en contabilidad", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Error al pagar cheque", { id: toastId });
    } finally {
      setProcesandoId(null);
    }
  }

  function money(valor: number) {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: "GTQ",
    }).format(Number(valor || 0));
  }

  function formatoTiempo(ms: number) {
    const abs = Math.abs(ms);
    const minutos = Math.floor(abs / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (dias > 0) return `${dias}d ${horas % 24}h`;
    if (horas > 0) return `${horas}h ${minutos % 60}m`;
    return `${minutos}m`;
  }

  function estadoTiempo(cheque: Cheque) {
    if (
      cheque.estado === "Autorizado" ||
      cheque.estado === "Pagado" ||
      cheque.estado === "Rechazado"
    ) {
      return {
        texto: "Proceso cerrado",
        color: "text-gray-400",
        borde: "border-white/10",
        fondo: "bg-white/5",
      };
    }

    if (!cheque.fecha_limite_autorizacion) {
      return {
        texto: "Sin límite",
        color: "text-gray-400",
        borde: "border-white/10",
        fondo: "bg-white/5",
      };
    }

    const limite = new Date(cheque.fecha_limite_autorizacion);
    const diff = limite.getTime() - now.getTime();

    if (diff < 0) {
      return {
        texto: `Vencido hace ${formatoTiempo(diff)}`,
        color: "text-red-400",
        borde: "border-red-500/30",
        fondo: "bg-red-500/10",
      };
    }

    if (diff <= 1000 * 60 * 60 * 2) {
      return {
        texto: `Por vencer en ${formatoTiempo(diff)}`,
        color: "text-yellow-400",
        borde: "border-yellow-500/30",
        fondo: "bg-yellow-500/10",
      };
    }

    return {
      texto: `En tiempo: ${formatoTiempo(diff)} restantes`,
      color: "text-green-400",
      borde: "border-green-500/30",
      fondo: "bg-green-500/10",
    };
  }

  const chequesFiltrados = useMemo(() => {
    return cheques.filter((c) => {
      const matchEstado =
        filtroEstado === "Todos" ? true : c.estado === filtroEstado;

      const matchEmpresa =
        filtroEmpresa === "Todas" ? true : c.empresa === filtroEmpresa;

      return matchEstado && matchEmpresa;
    });
  }, [cheques, filtroEstado, filtroEmpresa]);

  const stats = useMemo(() => {
    const pendientes = cheques.filter((c) => c.estado === "Pendiente de autorización").length;
    const autorizados = cheques.filter((c) => c.estado === "Autorizado").length;
    const pagados = cheques.filter((c) => c.estado === "Pagado").length;
    const vencidos = cheques.filter((c) => {
      if (!c.fecha_limite_autorizacion) return false;
      if (c.estado !== "Pendiente de autorización") return false;
      return new Date(c.fecha_limite_autorizacion) < now;
    }).length;

    return { pendientes, autorizados, pagados, vencidos };
  }, [cheques, now]);

  const puedeAprobar = ROLES_JEFATURA.includes(perfilActual?.rol || "");

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] text-cyan-400 flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        Cargando cheques...
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
              <h1 className="text-5xl font-black tracking-tight">Cheques</h1>
              <p className="text-gray-400 mt-2">
                Control de autorización, tiempos, atrasos y pagos
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Pendientes" value={stats.pendientes} color="text-yellow-400" />
              <Stat label="Vencidos" value={stats.vencidos} color="text-red-400" />
              <Stat label="Autorizados" value={stats.autorizados} color="text-cyan-400" />
              <Stat label="Pagados" value={stats.pagados} color="text-green-400" />
            </div>
          </header>

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
            <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Plus size={16} className="text-cyan-500" />
              Crear cheque y enviar a autorización
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
                type="text"
                placeholder="Beneficiario"
                value={form.beneficiario}
                onChange={(e) => setForm({ ...form, beneficiario: e.target.value })}
                className="input-custom"
              />

              <input
                type="text"
                placeholder="Concepto / descripción"
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

              <select
                value={form.tipoPago}
                onChange={(e) => setForm({ ...form, tipoPago: e.target.value })}
                className="input-custom"
              >
                <option value="Proveedor">Proveedor</option>
                <option value="Planilla">Planilla</option>
                <option value="Servicios">Servicios</option>
                <option value="Impuestos">Impuestos</option>
                <option value="Otro">Otro</option>
              </select>

              <select
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                className="input-custom"
              >
                <option value="Alta">Prioridad Alta</option>
                <option value="Media">Prioridad Media</option>
                <option value="Baja">Prioridad Baja</option>
              </select>

              <input
                type="date"
                value={form.fechaPago}
                onChange={(e) => setForm({ ...form, fechaPago: e.target.value })}
                className="input-custom"
              />

              <select
                value={form.responsableActual}
                onChange={(e) => setForm({ ...form, responsableActual: e.target.value })}
                className="input-custom"
              >
                <option value="">Responsable autorización...</option>
                {usuarios
                  .filter((u) => ROLES_JEFATURA.includes(u.rol))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} — {u.rol}
                    </option>
                  ))}
              </select>

              <button
                onClick={crearCheque}
                className="md:col-span-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Enviar cheque a autorización
              </button>
            </div>
          </section>

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
              <option value="Pendiente de autorización">Pendiente de autorización</option>
              <option value="Autorizado">Autorizado</option>
              <option value="Archivado">Archivado</option>
              <option value="Rechazado">Rechazado</option>
              <option value="Pagado">Pagado</option>
            </select>
          </section>

          <section className="grid gap-4">
            {chequesFiltrados.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <p className="text-gray-500">No hay cheques para mostrar.</p>
              </div>
            )}

            {chequesFiltrados.map((cheque) => (
              <ChequeCard
                key={cheque.id}
                cheque={cheque}
                tiempo={estadoTiempo(cheque)}
                money={money}
                puedeAprobar={puedeAprobar}
                procesando={procesandoId === cheque.id}
                onAutorizar={() => autorizarCheque(cheque)}
                onRechazar={() => rechazarCheque(cheque)}
                onArchivar={() => archivarCheque(cheque)}
                onPagado={() => marcarPagado(cheque)}
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

function ChequeCard({
  cheque,
  tiempo,
  money,
  puedeAprobar,
  procesando,
  onAutorizar,
  onRechazar,
  onArchivar,
  onPagado,
}: {
  cheque: Cheque;
  tiempo: {
    texto: string;
    color: string;
    borde: string;
    fondo: string;
  };
  money: (valor: number) => string;
  puedeAprobar: boolean;
  procesando: boolean;
  onAutorizar: () => void;
  onRechazar: () => void;
  onArchivar: () => void;
  onPagado: () => void;
}) {
  return (
    <div className={`rounded-[2rem] p-6 border ${tiempo.borde} ${tiempo.fondo}`}>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              #{cheque.id}
            </span>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/10 text-white border border-white/10 uppercase">
              {cheque.estado}
            </span>

            <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${tiempo.borde} ${tiempo.color}`}>
              {tiempo.texto}
            </span>
          </div>

          <h3 className="text-2xl font-black tracking-tight">
            {cheque.beneficiario}
          </h3>

          <p className="text-gray-400 mt-1">{cheque.concepto}</p>

          <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 mt-4 font-bold uppercase">
            <span className="flex items-center gap-1">
              <Building2 size={14} className="text-cyan-500" />
              {cheque.empresa}
            </span>

            <span className="flex items-center gap-1">
              <DollarSign size={14} className="text-green-500" />
              {money(cheque.monto)}
            </span>

            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-purple-500" />
              Pago: {cheque.fecha_pago}
            </span>

            <span className="flex items-center gap-1">
              <Clock size={14} className="text-yellow-500" />
              Límite:{" "}
              {cheque.fecha_limite_autorizacion
                ? new Date(cheque.fecha_limite_autorizacion).toLocaleString()
                : "N/A"}
            </span>
          </div>

          {cheque.motivo_archivo && (
            <p className="text-yellow-400 text-xs mt-3">
              Motivo archivo: {cheque.motivo_archivo}
            </p>
          )}

          {cheque.motivo_rechazo && (
            <p className="text-red-400 text-xs mt-3">
              Motivo rechazo: {cheque.motivo_rechazo}
            </p>
          )}
        </div>

        {puedeAprobar && (
          <div className="flex flex-wrap xl:flex-col gap-2 min-w-[180px]">
            {cheque.estado === "Pendiente de autorización" && (
              <>
                <button
                  onClick={onAutorizar}
                  disabled={procesando}
                  className="bg-green-500 hover:bg-green-400 text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {procesando ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  Autorizar
                </button>

                <button
                  onClick={onRechazar}
                  disabled={procesando}
                  className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Rechazar
                </button>

                <button
                  onClick={onArchivar}
                  disabled={procesando}
                  className="bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Archive size={14} />
                  Archivar
                </button>
              </>
            )}

            {cheque.estado === "Autorizado" && (
              <button
                onClick={onPagado}
                disabled={procesando}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {procesando ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                Marcar pagado
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}