"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Activity,
  CheckCircle2,
  Clock3,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  CartesianGrid
} from "recharts";

// Interfaces
interface Tarea { id: number; titulo: string; estado: string; }
interface Movimiento { id: number; monto: number; tipo: string; fecha: string; }

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [perfil, setPerfil] = useState({ nombre: "", rol: "" });
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    inicializarDashboard();

    // Suscripción Realtime para Tareas
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, () => obtenerTareas())
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos" }, () => obtenerFinanzas())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function inicializarDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: p } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
    if (p) {
  setPerfil({
    nombre: p.nombre || "Usuario",
    rol: p.rol,
  });

  setAutorizado(true);
}

    await Promise.all([obtenerTareas(), obtenerFinanzas()]);
    setLoading(false);
  }

  async function obtenerTareas() {
    const { data } = await supabase.from("tareas").select("*").order("id", { ascending: false });
    if (data) setTareas(data);
  }

  async function obtenerFinanzas() {
    const { data } = await supabase.from("movimientos").select("*").order("fecha", { ascending: true });
    if (data) setMovimientos(data);
  }

  // Cálculos Derivados (useMemo para rendimiento)
  const stats = useMemo(() => {
    const completadas = tareas.filter(t => t.estado === "Completado").length;
    const ingresos = movimientos.filter(m => m.tipo === "Ingreso").reduce((acc, cur) => acc + cur.monto, 0);
    const egresos = movimientos.filter(m => m.tipo === "Egreso").reduce((acc, cur) => acc + cur.monto, 0);
    
    return {
      completadas,
      pendientes: tareas.length - completadas,
      totalTareas: tareas.length,
      progreso: tareas.length > 0 ? Math.floor((completadas / tareas.length) * 100) : 0,
      balance: ingresos - egresos,
      ingresos
    };
  }, [tareas, movimientos]);

  const pieData = [
    { name: "Completadas", value: stats.completadas },
    { name: "Pendientes", value: stats.pendientes },
  ];

  const COLORS = ["#06b6d4", "#1e293b"];
  if (!autorizado) {
  return (
    <div className="h-screen w-full bg-[#020617] flex items-center justify-center text-white">
      Verificando permisos...
    </div>
  );
}

  if (loading) return (
    <div className="h-screen w-full bg-[#020617] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-full mb-4"></div>
        <p className="text-cyan-500 font-mono tracking-widest">CARGANDO SISTEMA...</p>
      </div>
    </div>
  );

  return (
    <div className="flex bg-[#020617] text-white min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          {/* HEADER SUPERIOR */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h1 className="text-6xl font-black tracking-tighter">
                Hola, <span className="text-cyan-500">{perfil.nombre.split(" ")[0]}</span> 👋
              </h1>
              <p className="text-gray-400 text-lg mt-2 font-medium">
                {new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' }).format(new Date())}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/10">
              <div className="flex items-center gap-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black shadow-lg shadow-cyan-500/20">
                  {perfil.nombre.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">{perfil.nombre}</p>
                  <p className="text-[10px] text-cyan-500 uppercase font-black tracking-widest mt-1">{perfil.rol}</p>
                </div>
              </div>
              <button 
                onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
                className="p-4 hover:bg-red-500/20 text-red-400 rounded-2xl transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* INDICADORES FINANCIEROS Y TAREAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard title="Balance Neto" value={`$${stats.balance}`} icon={<Wallet />} color="text-white" />
            <StatCard title="Ingresos Totales" value={`$${stats.ingresos}`} icon={<TrendingUp />} color="text-green-400" />
            <StatCard title="Tareas Hoy" value={stats.totalTareas} icon={<Activity />} color="text-cyan-400" />
            <StatCard title="Cumplimiento" value={`${stats.progreso}%`} icon={<CheckCircle2 />} color="text-purple-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* GRÁFICO DE CRECIMIENTO */}
            <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold">Flujo de Efectivo</h3>
                  <p className="text-gray-500 text-sm italic">Historial de movimientos registrados</p>
                </div>
                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-xs font-bold">
                  <ArrowUpRight size={14} /> +12.5% 
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer>
                  <AreaChart data={movimientos}>
                    <defs>
                      <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="fecha" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #334155' }}
                      itemStyle={{ color: '#06b6d4' }}
                    />
                    <Area type="monotone" dataKey="monto" stroke="#06b6d4" strokeWidth={4} fill="url(#colorCash)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DISTRIBUCIÓN Y TAREAS */}
            <div className="space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                <h3 className="text-xl font-bold mb-4">Estado de Operaciones</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="none" />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 bg-cyan-500 rounded-full" /> Completadas
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 bg-slate-800 rounded-full" /> Pendientes
                  </div>
                </div>
              </div>

              {/* LISTA RAPIDA */}
              <div className="bg-cyan-500 rounded-[2.5rem] p-8 text-black">
                <h3 className="text-xl font-black mb-4">Próximos Pasos</h3>
                <div className="space-y-3">
                  {tareas.slice(0, 3).map(t => (
                    <div key={t.id} className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
                      <div className="bg-white rounded-lg p-1">
                        {t.estado === 'Completado' ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                      </div>
                      <p className="text-sm font-bold truncate">{t.titulo}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponente de Tarjeta
function StatCard({ title, value, icon, color }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex flex-col gap-4 shadow-lg shadow-black/20"
    >
      <div className="bg-white/5 w-12 h-12 rounded-2xl flex items-center justify-center text-cyan-400">
        {icon}
      </div>
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{title}</p>
        <h2 className={`text-3xl font-black mt-1 ${color}`}>{value}</h2>
      </div>
    </motion.div>
  );
}