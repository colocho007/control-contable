"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { toast, Toaster } from "react-hot-toast";

import {
  Activity,
  CheckCircle2,
  Clock3,
  LogOut,
  TrendingUp,
  Wallet,
  ArrowUpRight,
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
  CartesianGrid,
} from "recharts";

interface Tarea {
  id: number;
  nombre?: string;
  titulo?: string;
  estado: string;
  empresa_id?: number;
}

interface Movimiento {
  id: number;
  monto: number;
  tipo: string;
  fecha: string;
  empresa_id?: number;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [perfil, setPerfil] = useState({ nombre: "", rol: "" });
  const [autorizado, setAutorizado] = useState(false);
  const [empresasPermitidas, setEmpresasPermitidas] = useState<number[]>([]);
  const [esAdmin, setEsAdmin] = useState(false);

  // Referencias para evitar re-suscripciones innecesarias en Realtime
  const esAdminRef = useRef(esAdmin);
  const empresasRef = useRef(empresasPermitidas);

  esAdminRef.current = esAdmin;
  empresasRef.current = empresasPermitidas;

  useEffect(() => {
    inicializarDashboard();
  }, [router]);

  useEffect(() => {
    if (!autorizado) return;

    const channel = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tareas" },
        () => obtenerTareas(esAdminRef.current, empresasRef.current)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimientos" },
        () => obtenerFinanzas(esAdminRef.current, empresasRef.current)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autorizado]);

  async function inicializarDashboard() {
    setLoading(true);

    const acceso = await validarAccesoModuloUsuario("dashboard");

    if (!acceso.ok) {
      if (
        acceso.motivo === "sin_sesion" ||
        acceso.motivo === "sin_perfil" ||
        acceso.motivo === "usuario_inactivo"
      ) {
        if (acceso.motivo === "usuario_inactivo") {
          alert("Tu usuario está inactivo. Contacta al administrador.");
        }
      } else if (
        acceso.motivo === "modulo_inactivo" ||
        acceso.motivo === "modulo_no_encontrado"
      ) {
        alert("El módulo Dashboard está desactivado.");
      } else {
        alert("No tienes acceso al módulo Dashboard.");
      }

      setAutorizado(false);
      setLoading(false);
      router.replace("/login");
      return;
    }

    const user = acceso.user!;
    const p = acceso.perfil!;

    // Admin normalizado para evitar errores si viene como Admin, ADMIN o con espacios
    const admin = (p.rol || "").trim().toLowerCase() === "admin";

    setPerfil({
      nombre: p.nombre || "Usuario",
      rol: p.rol || "sin rol",
    });

    setEsAdmin(admin);

    const empresas = await obtenerEmpresasPermitidas(user.id, p.rol);

    setEmpresasPermitidas(empresas);
    setAutorizado(true);

    await Promise.all([
      obtenerTareas(admin, empresas),
      obtenerFinanzas(admin, empresas),
    ]);

    setLoading(false);
  }

  async function obtenerTareas(
    adminParam = esAdminRef.current,
    empresasParam = empresasRef.current
  ) {
    let query = supabase
      .from("tareas")
      .select("*")
      .order("id", { ascending: false });

    if (!adminParam) {
      if (!empresasParam.length) {
        setTareas([]);
        return;
      }

      query = query.in("empresa_id", empresasParam);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error obteniendo tareas:", error);
      toast.error("Error cargando tareas");
      return;
    }

    if (data) setTareas(data);
  }

  async function obtenerFinanzas(
    adminParam = esAdminRef.current,
    empresasParam = empresasRef.current
  ) {
    let query = supabase
      .from("movimientos")
      .select("*")
      .order("fecha", { ascending: true });

    if (!adminParam) {
      if (!empresasParam.length) {
        setMovimientos([]);
        return;
      }

      query = query.in("empresa_id", empresasParam);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error obteniendo movimientos:", error);
      toast.error("Error cargando movimientos");
      return;
    }

    if (data) setMovimientos(data);
  }

  const stats = useMemo(() => {
    const completadas = tareas.filter(
      (t) => t.estado === "Completado"
    ).length;

    const ingresos = movimientos
      .filter((m) => m.tipo === "Ingreso")
      .reduce((acc, cur) => acc + Number(cur.monto || 0), 0);

    const egresos = movimientos
      .filter((m) => m.tipo === "Egreso")
      .reduce((acc, cur) => acc + Number(cur.monto || 0), 0);

    return {
      completadas,
      pendientes: tareas.length - completadas,
      totalTareas: tareas.length,
      progreso:
        tareas.length > 0 ? Math.floor((completadas / tareas.length) * 100) : 0,
      balance: ingresos - egresos,
      ingresos,
      egresos,
    };
  }, [tareas, movimientos]);

  const pieData = [
    { name: "Completadas", value: stats.completadas },
    { name: "Pendientes", value: stats.pendientes },
  ];

  const COLORS = ["#06b6d4", "#1e293b"];

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#020617] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-cyan-500/20 rounded-full mb-4"></div>
          <p className="text-cyan-500 font-mono tracking-widest">
            CARGANDO SISTEMA...
          </p>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="h-screen w-full bg-[#020617] flex items-center justify-center text-white">
        Sin acceso autorizado.
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] text-white min-h-screen">
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
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h1 className="text-6xl font-black tracking-tighter">
                Hola,{" "}
                <span className="text-cyan-500">
                  {perfil.nombre.split(" ")[0]}
                </span>{" "}
                👋
              </h1>

              <p className="text-gray-400 text-lg mt-2 font-medium">
                {new Intl.DateTimeFormat("es-GT", {
                  dateStyle: "full",
                }).format(new Date())}
              </p>

              <p className="text-xs text-gray-500 mt-2">
                {esAdmin
                  ? "Vista global de todas las empresas"
                  : `Vista filtrada por ${empresasPermitidas.length} empresa(s) asignada(s)`}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/10">
              <div className="flex items-center gap-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black shadow-lg shadow-cyan-500/20">
                  {perfil.nombre.charAt(0)}
                </div>

                <div>
                  <p className="text-sm font-bold leading-none">
                    {perfil.nombre}
                  </p>
                  <p className="text-[10px] text-cyan-500 uppercase font-black tracking-widest mt-1">
                    {perfil.rol}
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();

                  if (!error) {
                    router.push("/login");
                  } else {
                    console.error("Error al cerrar sesión:", error);
                    toast.error("Error al cerrar sesión");
                  }
                }}
                className="p-4 hover:bg-red-500/20 text-red-400 rounded-2xl transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* STATS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard
              title="Balance Neto"
              value={`Q${stats.balance.toLocaleString("es-GT")}`}
              icon={<Wallet />}
              color="text-white"
            />

            <StatCard
              title="Ingresos Totales"
              value={`Q${stats.ingresos.toLocaleString("es-GT")}`}
              icon={<TrendingUp />}
              color="text-green-400"
            />

            <StatCard
              title="Tareas"
              value={stats.totalTareas}
              icon={<Activity />}
              color="text-cyan-400"
            />

            <StatCard
              title="Cumplimiento"
              value={`${stats.progreso}%`}
              icon={<CheckCircle2 />}
              color="text-purple-400"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* GRÁFICO */}
            <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold">Flujo de Efectivo</h3>
                  <p className="text-gray-500 text-sm italic">
                    Historial de movimientos registrados
                  </p>
                </div>

                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-xs font-bold">
                  <ArrowUpRight size={14} /> Control+
                </div>
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={movimientos}>
                    <defs>
                      <linearGradient
                        id="colorCash"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#06b6d4"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#06b6d4"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff05"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="fecha"
                      stroke="#475569"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) =>
                        new Date(val).toLocaleDateString("es-GT", {
                          day: "2-digit",
                          month: "short",
                        })
                      }
                    />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderRadius: "16px",
                        border: "1px solid #334155",
                      }}
                      itemStyle={{ color: "#06b6d4" }}
                      formatter={(value) => [
                        `Q${Number(value).toLocaleString("es-GT")}`,
                        "Monto",
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="monto"
                      stroke="#06b6d4"
                      strokeWidth={4}
                      fill="url(#colorCash)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DISTRIBUCIÓN Y TAREAS */}
            <div className="space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                <h3 className="text-xl font-bold mb-4">
                  Estado de Operaciones
                </h3>

                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} stroke="none" />
                        ))}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 bg-cyan-500 rounded-full" />{" "}
                    Completadas
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 bg-slate-800 rounded-full" />{" "}
                    Pendientes
                  </div>
                </div>
              </div>

              {/* LISTA RÁPIDA */}
              <div className="bg-cyan-500 rounded-[2.5rem] p-8 text-black">
                <h3 className="text-xl font-black mb-4">Próximos Pasos</h3>

                <div className="space-y-3">
                  {tareas.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3"
                    >
                      <div className="bg-white rounded-lg p-1">
                        {t.estado === "Completado" ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Clock3 size={16} />
                        )}
                      </div>

                      <p className="text-sm font-bold truncate">
                        {t.nombre || t.titulo || "Tarea sin nombre"}
                      </p>
                    </div>
                  ))}

                  {tareas.length === 0 && (
                    <p className="text-sm font-bold text-black/70">
                      No hay tareas disponibles para tus empresas asignadas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex flex-col gap-4 shadow-lg shadow-black/20"
    >
      <div className="bg-white/5 w-12 h-12 rounded-2xl flex items-center justify-center text-cyan-400">
        {icon}
      </div>

      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
          {title}
        </p>
        <h2 className={`text-3xl font-black mt-1 ${color}`}>{value}</h2>
      </div>
    </motion.div>
  );
}
