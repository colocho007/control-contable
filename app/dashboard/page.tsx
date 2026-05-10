"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import Sidebar from "../components/Sidebar";

import {
  Activity,
  CheckCircle2,
  Clock3,
  LogOut,
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
} from "recharts";

import { supabase } from "../lib/supabase";

interface Tarea {
  id: number;
  titulo: string;
  estado: string;
}

export default function DashboardPage() {

  const router = useRouter();

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [rol, setRol] = useState("");
  const [nombre, setNombre] = useState("");

  useEffect(() => {

    verificarUsuario();

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tareas",
        },
        () => {
          obtenerTareas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, []);

  async function verificarUsuario() {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {

      router.push("/login");

      return;
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", user.id)
      .single();

   if (perfil) {

  setRol(perfil.rol);

  setNombre(
    perfil.nombre || "Usuario"
  );

}

    obtenerTareas();
  }

  async function obtenerTareas() {

    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .order("id", { ascending: false });

    if (!error && data) {

      setTareas(data);
    }
  }

  const completadas = tareas.filter(
    (t) => t.estado === "Completado"
  ).length;

  const pendientes = tareas.filter(
    (t) => t.estado === "Pendiente"
  ).length;

  const progreso =
    tareas.length > 0
      ? Math.floor((completadas / tareas.length) * 100)
      : 0;

  const progressData = [
    {
      day: "Pendientes",
      value: pendientes,
    },
    {
      day: "Completadas",
      value: completadas,
    },
  ];

  const pieData = [
    {
      name: "Completadas",
      value: completadas,
    },
    {
      name: "Pendientes",
      value: pendientes,
    },
  ];

  const COLORS = [
    "#06b6d4",
    "#8b5cf6",
  ];

  return (

    <div className="flex bg-[#020617] text-white">

      <Sidebar />

      <main className="flex-1 min-h-screen p-8">

        <div className="max-w-7xl mx-auto">

          {/* HEADER */}
          <div className="flex justify-between items-center mb-10">

            <div>

  <h1 className="text-5xl font-black">

  Hola, {nombre} 👋

</h1>

              <p className="text-gray-400 mt-2">
                Sistema operativo contable
              </p>
              <p className="text-gray-500 mt-2">

  {new Date().toLocaleDateString(
    "es-ES",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  )}

</p>

              <p className="text-cyan-400 mt-2 capitalize font-semibold">
  {rol}
</p>

            </div>

  <div className="flex items-center gap-4">

  <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">

    <div className="relative">

      <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-black font-black text-lg">

        {nombre.charAt(0)}

      </div>

      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#020617] rounded-full" />

    </div>

    <div>

      <p className="font-bold">
        {nombre}
      </p>

      <p className="text-sm text-gray-400 capitalize">
        {rol}
      </p>

    </div>

  </div>

  <div className="bg-cyan-500/20 text-cyan-300 px-5 py-3 rounded-2xl">

    Tiempo Real

  </div>

  <button
    onClick={async () => {

      await supabase.auth.signOut();

      router.push("/login");

    }}
    className="bg-red-500/20 hover:bg-red-500/30 transition text-red-300 px-5 py-3 rounded-2xl flex items-center gap-2"
  >

    <LogOut size={18} />

    Salir

  </button>

</div>

          </div>

          {/* CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            <motion.div
              whileHover={{ scale: 1.03 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >

              <div className="flex justify-between items-center">

                <div>

                  <p className="text-gray-400">
                    Tareas Totales
                  </p>

                  <h2 className="text-5xl font-black mt-3">
                    {tareas.length}
                  </h2>

                </div>

                <div className="bg-cyan-500/20 p-4 rounded-2xl">
                  <Activity className="text-cyan-400" />
                </div>

              </div>

            </motion.div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >

              <div className="flex justify-between items-center">

                <div>

                  <p className="text-gray-400">
                    Completadas
                  </p>

                  <h2 className="text-5xl font-black mt-3 text-green-400">
                    {completadas}
                  </h2>

                </div>

                <div className="bg-green-500/20 p-4 rounded-2xl">
                  <CheckCircle2 className="text-green-400" />
                </div>

              </div>

            </motion.div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >

              <div className="flex justify-between items-center">

                <div>

                  <p className="text-gray-400">
                    Progreso
                  </p>

                  <h2 className="text-5xl font-black mt-3 text-purple-400">
                    {progreso}%
                  </h2>

                </div>

                <div className="bg-purple-500/20 p-4 rounded-2xl">
                  <Clock3 className="text-purple-400" />
                </div>

              </div>

            </motion.div>

          </div>

          {/* GRAFICOS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* AREA */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <div className="flex justify-between items-center mb-6">

                <div>

                  <h3 className="text-2xl font-bold">
                    Rendimiento General
                  </h3>

                  <p className="text-gray-400 text-sm mt-1">
                    Estado de productividad
                  </p>

                </div>

              </div>

              <div className="h-[300px]">

                <ResponsiveContainer width="100%" height="100%">

                  <AreaChart data={progressData}>

                    <defs>

                      <linearGradient
                        id="colorUv"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >

                        <stop
                          offset="5%"
                          stopColor="#06b6d4"
                          stopOpacity={0.8}
                        />

                        <stop
                          offset="95%"
                          stopColor="#06b6d4"
                          stopOpacity={0}
                        />

                      </linearGradient>

                    </defs>

                    <XAxis
                      dataKey="day"
                      stroke="#94a3b8"
                    />

                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#06b6d4"
                      fillOpacity={1}
                      fill="url(#colorUv)"
                      strokeWidth={4}
                    />

                  </AreaChart>

                </ResponsiveContainer>

              </div>

            </div>

            {/* PIE */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <div className="flex justify-between items-center mb-6">

                <div>

                  <h3 className="text-2xl font-bold">
                    Estado General
                  </h3>

                  <p className="text-gray-400 text-sm mt-1">
                    Distribución de tareas
                  </p>

                </div>

                <Activity className="text-cyan-400" />

              </div>

              <div className="h-[260px]">

                <ResponsiveContainer width="100%" height="100%">

                  <PieChart>

                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label
                    >

                      {pieData.map((entry, index) => (

                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />

                      ))}

                    </Pie>

                    <Tooltip />

                  </PieChart>

                </ResponsiveContainer>

              </div>

            </div>

          </div>

          {/* ULTIMAS TAREAS */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-6">

            <h3 className="text-2xl font-bold mb-6">
              Últimas Tareas
            </h3>

            <div className="space-y-4">

              {tareas.slice(0, 5).map((tarea) => (

                <div
                  key={tarea.id}
                  className="flex items-center justify-between bg-[#0B1120] rounded-2xl p-4"
                >

                  <div>

                    <p className="font-semibold text-lg">
                      {tarea.titulo}
                    </p>

                    <p className="text-gray-400 text-sm">
                      Estado: {tarea.estado}
                    </p>

                  </div>

                  <div>

                    {tarea.estado === "Completado" ? (

                      <span className="text-green-400 text-2xl">
                        ✔
                      </span>

                    ) : (

                      <span className="text-yellow-400 text-2xl">
                        ⏳
                      </span>

                    )}

                  </div>

                </div>

              ))}

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}