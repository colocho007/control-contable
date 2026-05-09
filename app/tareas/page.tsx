"use client";

import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

import {
  Plus,
  Trash2,
  CheckCircle2,
  Clock3,
  BellRing,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Tarea {
  id: number;
  nombre: string;
  estado: string;
  empleado: string;
  usuario_id: string;

  empresa?: string;
  fecha_limite?: string;
  prioridad?: string;
  archivo?: string;
}

interface Empresa {
  id: number;
  nombre: string;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

export default function TareasPage() {

  const [tareas, setTareas] =
    useState<Tarea[]>([]);

  const [empresas, setEmpresas] =
    useState<Empresa[]>([]);

  const [usuarios, setUsuarios] =
    useState<Perfil[]>([]);

  const [titulo, setTitulo] =
    useState("");

  const [usuarioId, setUsuarioId] =
    useState("");

  const [empresa, setEmpresa] =
    useState("");

  const [fechaLimite, setFechaLimite] =
    useState("");

  const [prioridad, setPrioridad] =
    useState("Media");

  const [archivo, setArchivo] =
    useState<File | null>(null);

  const [rol, setRol] =
    useState("");

  const [userId, setUserId] =
    useState("");
    const [busqueda, setBusqueda] =
  useState("");

const [filtroEstado, setFiltroEstado] =
  useState("Todas");

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {

    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("USER:", user)

    if (!user) return;

    console.log(user);

    setUserId(user.id);

const { data: perfil, error } = await supabase
  .from("perfiles")
  .select("*")
  .eq("id", user.id)
  .maybeSingle();

console.log("USER ID:", user.id);
console.log("PERFIL:", perfil);

if (!perfil) {
  console.log("No existe perfil");
  return;
}

setRol(perfil.rol);

obtenerTareas(
  perfil.rol,
  user.id
);

    obtenerUsuarios();
    obtenerEmpresas();
  }

async function obtenerUsuarios() {

  const { data, error } = await supabase
    .from("perfiles")
    .select("*");

  console.log("USUARIOS:", data);
  console.log("ERROR USUARIOS:", error);

  if (data) {
    setUsuarios(data);
  }
}

  async function obtenerEmpresas() {

    const { data } = await supabase
      .from("empresas")
      .select("*");

    if (data) {
      setEmpresas(data);
    }
  }

  async function obtenerTareas(
    rolUsuario: string,
    idUsuario: string
  ) {

    if (
      rolUsuario === "admin" ||
      rolUsuario === "supervisor"
    ) {

      const { data } = await supabase
        .from("tareas")
        .select("*")
        .order("id", {
          ascending: false,
        });

      if (data) {
        setTareas(data);
      }

    } else {

      const { data } = await supabase
        .from("tareas")
        .select("*")
        .eq("usuario_id", idUsuario)
        .order("id", {
          ascending: false,
        });

      if (data) {
        setTareas(data);
      }
    }
  }

async function crearTarea() {

  if (!titulo) return;

  const usuario = usuarios.find(
    (u) => u.id === usuarioId
  );

  console.log("usuarioId:", usuarioId);
  console.log("userId:", userId);

  const { data, error } = await supabase
    .from("tareas")
    .insert([
      {
        nombre: titulo,
        estado: "Pendiente",

        usuario_id: usuarioId,

        empleado:
          usuario?.nombre ||
          "Empleado",

        empresa,
        fecha_limite: fechaLimite,
        prioridad,

        creado_por: userId,

        asignado_a: usuarioId,
      },
    ]);

  console.log("DATA:", data);
  console.log("ERROR:", error);

  setTitulo("");
  setUsuarioId("");

  obtenerTareas(rol, userId);
}
  async function completarTarea(
    id: number
  ) {

    let archivoUrl = null;

    if (archivo) {

      const nombreArchivo =
        `${Date.now()}-${archivo.name}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("evidencias")
        .upload(
          nombreArchivo,
          archivo
        );

      if (!uploadError) {

        const { data } =
          supabase.storage
            .from("evidencias")
            .getPublicUrl(
              nombreArchivo
            );

        archivoUrl =
          data.publicUrl;
      }
    }

    await supabase
      .from("tareas")
      .update({
        estado: "Completado",
        archivo: archivoUrl,
      })
      .eq("id", id);

    setArchivo(null);

    obtenerTareas(rol, userId);
  }

  async function eliminarTarea(
    id: number
  ) {

    await supabase
      .from("tareas")
      .delete()
      .eq("id", id);

    obtenerTareas(rol, userId);
  }

  // ESTADÍSTICAS

  const tareasPendientes =
    tareas.filter(
      (t) =>
        t.estado === "Pendiente"
    ).length;

  const tareasCompletadas =
    tareas.filter(
      (t) =>
        t.estado === "Completado"
    ).length;

  const tareasVencidas =
    tareas.filter(
      (t) =>
        t.fecha_limite &&
        new Date(
          t.fecha_limite
        ) < new Date() &&
        t.estado !==
          "Completado"
    ).length;

const progreso =
  tareas.length > 0
    ? Math.round(
        (tareasCompletadas /
          tareas.length) *
          100
      )
    : 0;

const tareasFiltradas = tareas.filter(
  (tarea) => {

    const coincideBusqueda =
      tarea.nombre
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        ) ||
      tarea.empleado
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        );

   const coincideEstado =
  filtroEstado === "Todas"
    ? true
    : filtroEstado === "Vencidas"
    ? tarea.fecha_limite &&
      new Date(tarea.fecha_limite) <
        new Date() &&
      tarea.estado !== "Completado"
    : tarea.estado ===
      filtroEstado;

    return (
      coincideBusqueda &&
      coincideEstado
    );
  }
);

const dataEstados = [
  {
    nombre: "Pendientes",
    cantidad: tareasPendientes,
  },
  {
    nombre: "Completadas",
    cantidad: tareasCompletadas,
  },
  {
    nombre: "Vencidas",
    cantidad: tareasVencidas,
  },
];

const dataPrioridad = [
  {
    nombre: "Alta",
    valor: tareas.filter(
      (t) => t.prioridad === "Alta"
    ).length,
  },
  {
    nombre: "Media",
    valor: tareas.filter(
      (t) => t.prioridad === "Media"
    ).length,
  },
  {
    nombre: "Baja",
    valor: tareas.filter(
      (t) => t.prioridad === "Baja"
    ).length,
  },
];

const COLORS = [
  "#ef4444",
  "#eab308",
  "#22c55e",
];
  return (

    <div className="flex bg-[#020617] min-h-screen text-white">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="max-w-6xl mx-auto">

          {/* ESTADÍSTICAS */}

          <div className="grid md:grid-cols-4 gap-4 mb-8">

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <p className="text-gray-400">
                Pendientes
              </p>

              <h2 className="text-4xl font-black text-yellow-400 mt-2">
                {tareasPendientes}
              </h2>

            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <p className="text-gray-400">
                Completadas
              </p>

              <h2 className="text-4xl font-black text-green-400 mt-2">
                {tareasCompletadas}
              </h2>

            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <p className="text-gray-400">
                Vencidas
              </p>

              <h2 className="text-4xl font-black text-red-400 mt-2">
                {tareasVencidas}
              </h2>

            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <p className="text-gray-400">
                Progreso
              </p>

              <h2 className="text-4xl font-black text-cyan-400 mt-2">
                {progreso}%
              </h2>

            </div>

          </div>

         {/* HEADER */}

<div className="mb-10">

  <h1 className="text-5xl font-black">
    Gestión de Tareas
  </h1>

  <p className="text-gray-400 mt-2">
    Administración empresarial
  </p>

  <p className="text-cyan-400 mt-2 capitalize">
    Rol: {rol}
  </p>

</div>

{/* ALERTAS */}

{tareasVencidas > 0 && (

  <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-3xl p-5 flex items-center gap-4">

    <BellRing className="text-red-400" />

    <div>

      <h2 className="text-red-400 font-bold text-lg">
        Atención
      </h2>

      <p className="text-gray-300">
        Hay {tareasVencidas} tareas vencidas.
      </p>

    </div>

  </div>

)}
    {/* CREAR TAREA */}

{(rol === "admin" ||
  rol === "supervisor") && (

  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">

    <h2 className="text-2xl font-bold mb-6">
      Nueva Tarea
    </h2>

    <div className="grid md:grid-cols-2 gap-4">

      <input
        type="text"
        placeholder="Título"
        value={titulo}
        onChange={(e) =>
          setTitulo(e.target.value)
        }
        className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
      />

      <select
        value={usuarioId}
        onChange={(e) =>
          setUsuarioId(e.target.value)
        }
        className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
      >

        <option value="">
          Seleccionar empleado
        </option>

        {usuarios.map((u) => (

          <option
            key={u.id}
            value={u.id}
          >
            {u.nombre}
          </option>

        ))}

      </select>

      <select
        value={empresa}
        onChange={(e) =>
          setEmpresa(e.target.value)
        }
        className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
      >

        <option value="">
          Seleccionar empresa
        </option>

        {empresas.map((emp) => (

          <option
            key={emp.id}
            value={emp.nombre}
          >
            {emp.nombre}
          </option>

        ))}

      </select>

      <input
        type="date"
        value={fechaLimite}
        onChange={(e) =>
          setFechaLimite(
            e.target.value
          )
        }
        className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
      />

      <select
        value={prioridad}
        onChange={(e) =>
          setPrioridad(
            e.target.value
          )
        }
        className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
      >

        <option value="Alta">
          Alta
        </option>

        <option value="Media">
          Media
        </option>

        <option value="Baja">
          Baja
        </option>

      </select>

    </div>

    <button
      onClick={crearTarea}
      className="mt-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-4 rounded-2xl flex items-center gap-2 transition"
    >

      <Plus size={20} />

      Crear Tarea

    </button>

  </div>

)}
        <div className="flex flex-col md:flex-row gap-4 mb-8">

  <input
    type="text"
    placeholder="Buscar tarea o empleado..."
    value={busqueda}
    onChange={(e) =>
      setBusqueda(e.target.value)
    }
    className="flex-1 h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
  />

  <select
    value={filtroEstado}
    onChange={(e) =>
      setFiltroEstado(e.target.value)
    }
    className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
  >

    <option value="Todas">
      Todas
    </option>

    <option value="Pendiente">
      Pendientes
    </option>

    <option value="Completado">
      Completadas
    </option>

    <option value="Vencidas">
      Vencidas
    </option>

  </select>

</div>


      {/* LISTA DE TAREAS */}

<div className="space-y-5 mt-8">

{tareasFiltradas.map((tarea) => {

    const vencida =
      tarea.fecha_limite &&
      new Date(tarea.fecha_limite) < new Date() &&
      tarea.estado !== "Completado";

    return (

      <div
        key={tarea.id}
        className={`rounded-3xl p-6 flex items-center justify-between border ${
          vencida
            ? "bg-red-500/10 border-red-500/30"
            : "bg-white/5 border-white/10"
        }`}
      >

        <div>

          <h2 className="text-2xl font-bold">
            {tarea.nombre}
          </h2>

          <p className="text-gray-400 mt-2">
            Empleado: {tarea.empleado}
          </p>

          <p className="text-cyan-400 mt-1">
            Empresa: {tarea.empresa}
          </p>

          <p className="text-yellow-400 mt-1">
            Fecha límite: {tarea.fecha_limite}
          </p>

          <p
            className={`mt-1 font-bold ${
              tarea.prioridad === "Alta"
                ? "text-red-400"
                : tarea.prioridad === "Media"
                ? "text-yellow-400"
                : "text-green-400"
            }`}
          >
            Prioridad: {tarea.prioridad}
          </p>

          <div className="mt-3">

            {tarea.estado === "Pendiente" ? (

              <div className="flex items-center gap-2 text-yellow-400">

                <Clock3 size={18} />

                Pendiente

              </div>

            ) : (

              <div className="flex items-center gap-2 text-green-400">

                <CheckCircle2 size={18} />

                Completado

              </div>

            )}

          </div>

          {tarea.archivo && (

            <a
              href={tarea.archivo}
              target="_blank"
              className="text-cyan-400 underline mt-3 block"
            >
              Ver Evidencia
            </a>

          )}

        </div>

        <div className="flex flex-col gap-3">

          {tarea.estado === "Pendiente" && (

            <>

              <input
                type="file"
                onChange={(e) => {

                  if (e.target.files?.[0]) {

                    setArchivo(
                      e.target.files[0]
                    );

                  }

                }}
                className="text-sm text-gray-400"
              />

              <button
                onClick={() =>
                  completarTarea(tarea.id)
                }
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-5 py-3 rounded-2xl transition"
              >

                Completar

              </button>

            </>

          )}

          {(rol === "admin" ||
            rol === "supervisor") && (

            <button
              onClick={() =>
                eliminarTarea(tarea.id)
              }
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-3 rounded-2xl transition"
            >

              <Trash2 size={20} />

            </button>

          )}

        </div>

      </div>

    );

  })}

</div>

        </div>

      </main>

    </div>
  );
}