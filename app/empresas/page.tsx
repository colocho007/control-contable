"use client";
import { useRouter } from "next/navigation";
import { verificarRol } from "../../lib/auth";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";

import {
  Building2,
  Plus,
  Trash2,
} from "lucide-react";

interface Empresa {

  id: number;
  nombre: string;
  rtn: string;
  telefono: string;
  correo: string;
  direccion: string;

  cai: string;
  isr: string;
  estado: string;
}

export default function EmpresasPage() {
  const router = useRouter();

  const [empresas, setEmpresas] =
    useState<Empresa[]>([]);

  const [nombre, setNombre] =
    useState("");

  const [rtn, setRtn] =
    useState("");

  const [telefono, setTelefono] =
    useState("");

  const [correo, setCorreo] =
    useState("");

  const [direccion, setDireccion] =
    useState("");
  
  const [cai, setCai] =
  useState("");

const [isr, setIsr] =
  useState(0);

  const [estado, setEstado] =
  useState("Activa");

  useEffect(() => {
  async function iniciar() {
    const acceso = await verificarRol([
      "admin",
      "supervisor"
    ]);

    if (!acceso.autorizado) {
      router.replace("/dashboard");
      return;
    }

    obtenerEmpresas();
  }

  iniciar();
}, []);



  async function obtenerEmpresas() {

    const { data } = await supabase
      .from("empresas")
      .select("*")
      .order("id", { ascending: false });

    if (data) {
      setEmpresas(data);
    }
  }

async function crearEmpresa() {

  if (!nombre) return;

  const { error } = await supabase
    .from("empresas")
    .insert([
      {
        nombre,
        rtn,
        telefono,
        correo,
        direccion,
        cai,
        isr,
        estado,
      },
    ]);

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  setNombre("");
  setRtn("");
  setTelefono("");
  setCorreo("");
  setDireccion("");
  setCai("");
setIsr(0);
  setEstado("Activa");

  obtenerEmpresas();
}

  async function eliminarEmpresa(id: number) {

    await supabase
      .from("empresas")
      .delete()
      .eq("id", id);

    obtenerEmpresas();
  }

  return (

    <div className="flex bg-[#020617] min-h-screen text-white">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="max-w-7xl mx-auto">

          {/* HEADER */}
          <div className="mb-10">

            <h1 className="text-5xl font-black">
              Empresas
            </h1>

            <p className="text-gray-400 mt-2">
              Gestión empresarial contable
            </p>

          </div>

          {/* FORM */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">

            <div className="grid md:grid-cols-2 gap-4">

              <input
                type="text"
                placeholder="Nombre empresa"
                value={nombre}
                onChange={(e) =>
                  setNombre(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="text"
                placeholder="RTN"
                value={rtn}
                onChange={(e) =>
                  setRtn(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="text"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) =>
                  setTelefono(e.target.value)
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

<input
  type="text"
  placeholder="Dirección"
  value={direccion}
  onChange={(e) =>
    setDireccion(e.target.value)
  }
  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none md:col-span-2"
/>

<input
  type="text"
  placeholder="CAI"
  value={cai}
  onChange={(e) =>
    setCai(e.target.value)
  }
  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
/>


<select
  value={estado}
  onChange={(e) =>
    setEstado(e.target.value)
  }
  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
>

  <option value="Activa">
    Activa
  </option>

  <option value="Pendiente">
    Pendiente
  </option>

  <option value="Suspendida">
    Suspendida
  </option>

</select>

<input
  type="number"
  placeholder="ISR"
  value={isr}
  onChange={(e) =>
setIsr(Number(e.target.value))
  }
  className="bg-[#0B1120] border border-white/10 rounded-2xl p-4 outline-none"
/>
</div>

<button
  onClick={crearEmpresa} 
              className="mt-5 bg-cyan-500 hover:bg-cyan-400 transition px-6 py-4 rounded-2xl flex items-center gap-2 font-bold text-black"
            >

              <Plus size={20} />

              Crear Empresa

            </button>

          </div>

          {/* LISTA */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">

            {empresas.map((empresa) => (

              <div
                key={empresa.id}
                className="bg-white/5 border border-white/10 rounded-3xl p-6"
              >

                <div className="flex justify-between items-start">

                  <div>

                    <div className="bg-cyan-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">

                      <Building2 className="text-cyan-400" />

                    </div>

                    <h2 className="text-2xl font-bold">
                      {empresa.nombre}
                    </h2>

                    <p className="text-gray-400 mt-3">
                      RTN: {empresa.rtn}
                    </p>

                    <p className="text-gray-400">
                      {empresa.telefono}
                    </p>

                    <p className="text-gray-400">
                      {empresa.correo}
                    </p>

                    <p className="text-gray-500 mt-3 text-sm">
                      {empresa.direccion}
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      eliminarEmpresa(empresa.id)
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