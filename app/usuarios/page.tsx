"use client";

import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";

import { supabase } from "../lib/supabase";

import { Users, Plus, Trash2 } from "lucide-react";

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
}

export default function UsuariosPage() {

  const [usuarios, setUsuarios] =
    useState<Usuario[]>([]);

  const [nombre, setNombre] =
    useState("");

  const [correo, setCorreo] =
    useState("");

  const [rol, setRol] =
    useState("trabajador");

  useEffect(() => {
    obtenerUsuarios();
  }, []);

  async function obtenerUsuarios() {

    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .order("creado_en", {
        ascending: false,
      });

    if (data) {
      setUsuarios(data);
    }
  }

  async function crearUsuario() {

    if (!nombre || !correo)
      return;

const { error } = await supabase
  .from("usuarios")
  .insert([
    {
      nombre,
      correo,
      rol,
    },
  ]);

if (error) {
  console.log(error);
}

    setNombre("");
    setCorreo("");
    setRol("trabajador");

    obtenerUsuarios();
  }

  async function eliminarUsuario(
    id: string
  ) {

    await supabase
      .from("usuarios")
      .delete()
      .eq("id", id);

    obtenerUsuarios();
  }

  return (

    <div className="flex bg-[#020617] min-h-screen text-white">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="max-w-7xl mx-auto">

          <div className="mb-10">

            <h1 className="text-5xl font-black">
              Usuarios
            </h1>

            <p className="text-gray-400 mt-2">
              Gestión de trabajadores y supervisores
            </p>

          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">

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
                type="email"
                placeholder="Correo"
                value={correo}
                onChange={(e) =>
                  setCorreo(e.target.value)
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

                <option value="trabajador">
                  Trabajador
                </option>

                <option value="supervisor">
                  Supervisor
                </option>

                <option value="jefe">
                  Jefe
                </option>

              </select>

            </div>

            <button
              onClick={crearUsuario}
              className="mt-5 bg-cyan-500 hover:bg-cyan-400 transition px-6 py-4 rounded-2xl flex items-center gap-2 font-bold text-black"
            >

              <Plus size={20} />

              Crear Usuario

            </button>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">

            {usuarios.map((usuario) => (

              <div
                key={usuario.id}
                className="bg-white/5 border border-white/10 rounded-3xl p-6"
              >

                <div className="flex justify-between items-start">

                  <div>

                    <div className="bg-cyan-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">

                      <Users className="text-cyan-400" />

                    </div>

                    <h2 className="text-2xl font-bold">
                      {usuario.nombre}
                    </h2>

                    <p className="text-gray-400 mt-2">
                      {usuario.correo}
                    </p>

                    <p className="text-cyan-400 mt-3 font-bold uppercase">
                      {usuario.rol}
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      eliminarUsuario(usuario.id)
                    }
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-3 rounded-2xl transition"
                  >

                    <Trash2 size={20} />

                  </button>

                </div>

              </div>

            ))}

          </div>

        </div>

      </main>

    </div>
  );
}