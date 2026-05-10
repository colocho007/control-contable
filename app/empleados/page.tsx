"use client";

import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

import {
  Trash2,
  UserPlus,
} from "lucide-react";

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

export default function EmpleadosPage() {

  const [empleados, setEmpleados] =
    useState<Perfil[]>([]);

  const [nombre, setNombre] =
    useState("");

  const [rol, setRol] =
    useState("empleado");

  const [uid, setUid] =
    useState("");

  useEffect(() => {
    obtenerEmpleados();
  }, []);

  async function obtenerEmpleados() {

    const { data } = await supabase
      .from("perfiles")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (data) {
      setEmpleados(data);
    }
  }

  async function crearEmpleado() {

    if (!nombre || !uid)
      return;

    const { error } = await supabase
      .from("perfiles")
      .insert([
        {
          id: uid,
          nombre,
          rol,
        },
      ]);

    console.log(error);

    setNombre("");
    setUid("");
    setRol("empleado");

    obtenerEmpleados();
  }

  async function eliminarEmpleado(
    id: string
  ) {

    await supabase
      .from("perfiles")
      .delete()
      .eq("id", id);

    obtenerEmpleados();
  }

  return (

    <div className="flex bg-[#020617] min-h-screen text-white">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="max-w-5xl mx-auto">

          <h1 className="text-5xl font-black mb-8">
            Empleados
          </h1>

          {/* FORMULARIO */}

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">

            <h2 className="text-2xl font-bold mb-6">
              Nuevo Empleado
            </h2>

            <div className="grid md:grid-cols-3 gap-4">

              <input
                type="text"
                placeholder="Nombre"
                value={nombre}
                onChange={(e) =>
                  setNombre(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="text"
                placeholder="UID del usuario"
                value={uid}
                onChange={(e) =>
                  setUid(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <select
                value={rol}
                onChange={(e) =>
                  setRol(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              >

                <option value="admin">
                  Admin
                </option>

                <option value="supervisor">
                  Supervisor
                </option>

                <option value="empleado">
                  Empleado
                </option>

              </select>

            </div>

            <button
              onClick={crearEmpleado}
              className="mt-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-4 rounded-2xl flex items-center gap-2 transition"
            >

              <UserPlus size={20} />

              Crear Empleado

            </button>

          </div>

          {/* LISTA */}

          <div className="space-y-4">

            {empleados.map((emp) => (

              <div
                key={emp.id}
                className="bg-white/5 border border-white/10 rounded-3xl p-5 flex justify-between items-center"
              >

                <div>

                  <h2 className="text-2xl font-bold">
                    {emp.nombre}
                  </h2>

                  <p className="text-cyan-400 mt-1 capitalize">
                    {emp.rol}
                  </p>

                  <p className="text-gray-500 text-sm mt-1">
                    {emp.id}
                  </p>

                </div>

                <button
                  onClick={() =>
                    eliminarEmpleado(emp.id)
                  }
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-4 rounded-2xl transition"
                >

                  <Trash2 size={20} />

                </button>

              </div>

            ))}

          </div>

        </div>

      </main>

    </div>
  );
}