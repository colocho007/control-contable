"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation"; 
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { Trash2, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

// 🚀 1. y 2. Tipos importados globalmente (ya incluyen string | null para fecha y archivo)
import type {
  Estado,
  Prioridad,
  Tarea,
  TareaRowProps,
  Perfil,
  Empresa
} from "../../types";

const COLORS = ["#ef4444", "#eab308", "#22c55e"];
const ROLES_ADMIN = ["admin", "supervisor", "jefe"];

export default function TareasPage() {
  const router = useRouter();
  
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [userProfile, setUserProfile] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todas");
  const [archivos, setArchivos] = useState<{ [key: number]: File }>({});

  const [form, setForm] = useState({
    titulo: "",
    usuarioId: "",
    empresa: "",
    fechaLimite: "",
    prioridad: "Media" as Prioridad,
  });

  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile, error: pError } = await supabase
          .from("perfiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (pError) throw pError;
        setUserProfile(profile);

        let query = supabase.from("tareas").select("*").order("id", { ascending: false });
        
        // 🚀 3. OPTIONAL CHAINING APLICADO
        if (!ROLES_ADMIN.includes(profile?.rol || "")) {
          query = query.eq("usuario_id", profile.id);
        }

        const { data: tData, error: tError } = await query;
        if (tError) throw tError;
        setTareas(tData || []);

        await fetchCatalogos();
      } catch (error) {
        toast.error("Error al sincronizar datos iniciales");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [router]);

  useEffect(() => {
    if (!userProfile) return;

    const channel = supabase
      .channel(`tareas-safe-channel`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tareas" },
        (payload) => {
          const nueva = payload.new as Tarea;
          // 🚀 También protegido aquí por si acaso
          if (ROLES_ADMIN.includes(userProfile?.rol || "") || nueva.usuario_id === userProfile?.id) {
            setTareas((prev) => (prev.some(t => t.id === nueva.id) ? prev : [nueva, ...prev]));
            toast.success("Nueva tarea detectada");
          }
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tareas" }, (payload) => {
        setTareas((prev) => prev.map(t => t.id === payload.new.id ? (payload.new as Tarea) : t));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tareas" }, (payload) => {
        setTareas((prev) => prev.filter(t => t.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userProfile]);

  const fetchCatalogos = async () => {
    const [resU, resE] = await Promise.all([
      supabase.from("perfiles").select("*"),
      supabase.from("empresas").select("*")
    ]);
    if (resU.data) setUsuarios(resU.data);
    if (resE.data) setEmpresas(resE.data);
  };

 const completarTarea = async (id: number) => {
  if (processingId) return;

  setProcessingId(id);
  const toastId = toast.loading("Subiendo evidencia...");

  try {
    let archivoUrl: string | null = null;
    const archivo = archivos[id];

    if (archivo) {
      const tiposPermitidos = [
        "application/pdf",
        "image/png",
        "image/jpeg",
      ];

      if (!tiposPermitidos.includes(archivo.type)) {
        toast.error("Archivo no permitido", { id: toastId });
        setProcessingId(null);
        return;
      }

      if (archivo.size > 5 * 1024 * 1024) {
        toast.error("Máximo 5MB", { id: toastId });
        setProcessingId(null);
        return;
      }

      const extension = archivo.name.split(".").pop() || "file";
      const nombreArchivo = `${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("evidencias")
        .upload(nombreArchivo, archivo);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("evidencias")
        .getPublicUrl(nombreArchivo);

      archivoUrl = data.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("tareas")
      .update({
        estado: "Completado",
        archivo: archivoUrl,
      })
      .eq("id", id);

    if (updateError) throw updateError;
    setTareas((prev) =>
  prev.map((t) =>
    t.id === id
      ? { ...t, estado: "Completado", archivo: archivoUrl || t.archivo }
      : t
  )
);

    setTareas((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              estado: "Completado",
              archivo: archivoUrl || t.archivo,
            }
          : t
      )
    );

    setArchivos((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });

    toast.success("¡Tarea finalizada!", { id: toastId });
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al actualizar tarea", { id: toastId });
  } finally {
    setProcessingId(null);
  }
};

  const eliminarTarea = async (id: number) => {
    if (!window.confirm("¿Eliminar permanentemente?")) return;
    try {
      const { error } = await supabase.from("tareas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tarea eliminada");
    } catch (error) {
      toast.error("No se pudo eliminar la tarea");
    }
  };

  const crearTarea = async () => {
    const { titulo, usuarioId, empresa, fechaLimite, prioridad } = form;
    if (!titulo || !usuarioId || !empresa) return toast.error("Completa los campos");

    const empleado = usuarios.find(u => u.id === usuarioId)?.nombre || "Empleado";

    try {
      const { error } = await supabase.from("tareas").insert([{
        nombre: titulo,
        estado: "Pendiente",
        usuario_id: usuarioId,
        empleado,
        empresa,
        fecha_limite: fechaLimite,
        prioridad,
        creado_por: userProfile?.id,
      }]);

      if (error) throw error;
      
      setForm({ titulo: "", usuarioId: "", empresa: "", fechaLimite: "", prioridad: "Media" });
      toast.success("Tarea asignada");
    } catch (error) {
      toast.error("Error al crear la tarea");
    }
  };

  const stats = useMemo(() => {
    const completadas = tareas.filter(t => t.estado === "Completado").length;
    const pendientes = tareas.filter(t => t.estado === "Pendiente").length;
    const vencidas = tareas.filter(t => {
      if (!t.fecha_limite || t.estado === "Completado") return false;
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      return new Date(t.fecha_limite) < hoy;
    }).length;

    return {
      pendientes, completadas, vencidas,
      progreso: tareas.length ? Math.round((completadas / tareas.length) * 100) : 0,
      dataEstados: [
        { nombre: "Pendientes", cantidad: pendientes },
        { nombre: "Completadas", cantidad: completadas },
        { nombre: "Vencidas", cantidad: vencidas }
      ],
      dataPrioridad: [
        { nombre: "Alta", valor: tareas.filter(t => t.prioridad === "Alta").length },
        { nombre: "Media", valor: tareas.filter(t => t.prioridad === "Media").length },
        { nombre: "Baja", valor: tareas.filter(t => t.prioridad === "Baja").length }
      ]
    };
  }, [tareas]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      const matchBusqueda = t.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                            t.empleado.toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === "Todas" ? true :
                         filtroEstado === "Vencidas" ? (t.fecha_limite && new Date(t.fecha_limite) < new Date() && t.estado !== "Completado") :
                         t.estado === filtroEstado;
      return matchBusqueda && matchEstado;
    });
  }, [tareas, busqueda, filtroEstado]);

  if (loading) return <div className="flex h-screen bg-[#020617] items-center justify-center text-cyan-400 font-mono italic">BOOTING_SYSTEM...</div>;

  return (
    <div className="flex bg-[#020617] min-h-screen text-white font-sans">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b'} }} />
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-8">
            <h1 className="text-4xl font-black tracking-tighter italic">CORE_TASKS</h1>
            <p className="text-gray-500 text-sm">Operador: {userProfile?.nombre?.toUpperCase()} | Rol: {userProfile?.rol?.toUpperCase()}</p>
          </header>

          <section className="grid md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Pendientes" value={stats.pendientes} color="text-yellow-400" />
            <StatCard label="Completadas" value={stats.completadas} color="text-green-400" />
            <StatCard label="Vencidas" value={stats.vencidas} color="text-red-400" />
            <StatCard label="Eficiencia" value={`${stats.progreso}%`} color="text-cyan-400" />
          </section>

          <section className="grid md:grid-cols-2 gap-6 mb-10">
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 h-80 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dataEstados}>
                  <XAxis dataKey="nombre" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }} />
                  <Bar dataKey="cantidad" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 h-80 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.dataPrioridad} dataKey="valor" outerRadius={70} stroke="none">
                    {stats.dataPrioridad.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {userProfile?.rol && ROLES_ADMIN.includes(userProfile.rol) && (
            <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 mb-8 border-l-4 border-l-cyan-500">
              <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase italic">Comando de Asignación</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <input type="text" placeholder="Título Tarea" className="input-custom" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                
                <select className="input-custom" value={form.usuarioId} onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}>
                  <option value="">Asignar a empleado / supervisor / jefe</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} — {u.rol}
                    </option>
                  ))}
                </select>

                <select className="input-custom" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })}>
                  <option value="">Empresa...</option>
                  {empresas.map((emp) => <option key={emp.id} value={emp.nombre}>{emp.nombre}</option>)}
                </select>
                <input type="date" className="input-custom" value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} />
                <select className="input-custom" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })}>
                  <option value="Alta">Prioridad Alta</option>
                  <option value="Media">Prioridad Media</option>
                  <option value="Baja">Prioridad Baja</option>
                </select>
                <button onClick={crearTarea} className="bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs">Desplegar Tarea</button>
              </div>
            </section>
          )}

          <div className="flex gap-4 mb-6">
            <input type="text" placeholder="Filtrar por nombre o empleado..." className="flex-1 input-custom" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <select className="input-custom w-48" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="Todas">Estados: Todos</option>
              <option value="Pendiente">Pendientes</option>
              <option value="Completado">Completadas</option>
              <option value="Vencidas">Vencidas</option>
            </select>
          </div>

          <div className="space-y-4">
            {tareasFiltradas.map(tarea => (
              <TareaRow 
                key={tarea.id} 
                tarea={tarea} 
                rol={userProfile?.rol || ""}
                isProcessing={processingId === tarea.id}
                onCompletar={completarTarea}
                onEliminar={eliminarTarea}
                onFileChange={(id, file) => setArchivos(prev => ({...prev, [id]: file}))}
              />
            ))}
          </div>
        </div>
      </main>

      <style jsx>{`
        .input-custom {
          height: 3.5rem;
          padding: 0 1.25rem;
          border-radius: 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          outline: none;
          font-size: 0.8rem;
          transition: border 0.2s;
        }
        .input-custom:focus { border-color: #06b6d4; }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{label}</p>
      <h2 className={`text-2xl font-black mt-1 ${color}`}>{value}</h2>
    </div>
  );
}

function TareaRow({ tarea, rol, isProcessing, onCompletar, onEliminar, onFileChange }: TareaRowProps) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const esVencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < hoy && tarea.estado !== "Completado";

  const prioColor: Record<Prioridad, string> = {
    Alta: "bg-red-500/10 text-red-500 border-red-500/20",
    Media: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Baja: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  return (
    <div className={`rounded-2xl p-6 border transition-all ${esVencida ? "bg-red-900/10 border-red-500/40" : "bg-white/[0.02] border-white/10"}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[9px] font-bold px-2 py-1 rounded border ${prioColor[tarea.prioridad]}`}>
              {tarea.prioridad.toUpperCase()}
            </span>
            {esVencida && <span className="text-[9px] text-red-500 font-black flex items-center gap-1 animate-pulse uppercase"><AlertCircle size={10}/> Sistema Vencido</span>}
          </div>
          <h3 className="text-lg font-bold tracking-tight">{tarea.nombre}</h3>
          <div className="flex flex-wrap gap-4 text-[10px] text-gray-500 mt-2 font-mono uppercase">
            <span>Empleado: {tarea.empleado}</span>
            <span className="text-cyan-600">Client: {tarea.empresa}</span>
            <span>Deadline: {tarea.fecha_limite || "N/A"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-end w-full md:w-auto">
          {tarea.estado === "Pendiente" ? (
            <div className="flex flex-col gap-2 w-full">
              <input 
                type="file" 
                className="text-[10px] text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-[10px] file:bg-white/10 file:text-white disabled:opacity-50" 
                onChange={e => e.target.files?.[0] && onFileChange(tarea.id, e.target.files[0])} 
                disabled={isProcessing}
              />
              <button 
                onClick={() => onCompletar(tarea.id)} 
                disabled={isProcessing}
                className={`bg-green-500 text-black px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${isProcessing ? 'opacity-50' : 'hover:bg-green-400'}`}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={12}/> : <CheckCircle2 size={12}/>}
                Confirmar Ejecución
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-green-500/5">
              <CheckCircle2 size={12}/> Operación Exitosa
            </div>
          )}
          
          <div className="flex items-center gap-4">
            {tarea.archivo && <a href={tarea.archivo} target="_blank" rel="noreferrer" className="text-cyan-500 text-[9px] font-black hover:underline tracking-tighter">DATA_STREAM (ARCHIVO)</a>}
            {ROLES_ADMIN.includes(rol) && (
              <button onClick={() => onEliminar(tarea.id)} className="text-gray-600 hover:text-red-500 transition-colors">
                <Trash2 size={16}/>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}