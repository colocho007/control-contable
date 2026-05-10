"use client";

import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";

interface Movimiento {
  id: number;
  tipo: string;
  descripcion: string;
  monto: number;
  empresa: string;
  fecha: string;
}

export default function ContabilidadPage() {

  const [movimientos, setMovimientos] =
    useState<Movimiento[]>([]);

  const [tipo, setTipo] =
    useState("Ingreso");

  const [descripcion, setDescripcion] =
    useState("");

  const [monto, setMonto] =
    useState("");

  const [empresa, setEmpresa] =
    useState("");

  const [fecha, setFecha] =
    useState("");

  useEffect(() => {
    obtenerMovimientos();
  }, []);

  async function obtenerMovimientos() {

    const { data } = await supabase
      .from("movimientos")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (data) {
      setMovimientos(data);
    }
  }

  async function crearMovimiento() {

    if (
      !descripcion ||
      !monto
    )
      return;

    const { error } = await supabase
      .from("movimientos")
      .insert([
        {
          tipo,
          descripcion,
          monto: Number(monto),
          empresa,
          fecha,
        },
      ]);

    console.log(error);

    setDescripcion("");
    setMonto("");
    setEmpresa("");
    setFecha("");

    obtenerMovimientos();
  }

  async function eliminarMovimiento(
    id: number
  ) {

    await supabase
      .from("movimientos")
      .delete()
      .eq("id", id);

    obtenerMovimientos();
  }

  // ESTADÍSTICAS

  const ingresos =
    movimientos
      .filter(
        (m) =>
          m.tipo === "Ingreso"
      )
      .reduce(
        (acc, mov) =>
          acc + Number(mov.monto),
        0
      );

  const egresos =
    movimientos
      .filter(
        (m) =>
          m.tipo === "Egreso"
      )
      .reduce(
        (acc, mov) =>
          acc + Number(mov.monto),
        0
      );

  const balance =
    ingresos - egresos;

  return (

    <div className="flex bg-[#020617] min-h-screen text-white">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="max-w-6xl mx-auto">

          <h1 className="text-5xl font-black mb-8">
            Contabilidad
          </h1>

          {/* ESTADÍSTICAS */}

          <div className="grid md:grid-cols-3 gap-5 mb-8">

            <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6">

              <div className="flex items-center gap-3">

                <TrendingUp className="text-green-400" />

                <h2 className="text-xl font-bold">
                  Ingresos
                </h2>

              </div>

              <p className="text-4xl font-black text-green-400 mt-4">
                ${ingresos}
              </p>

            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6">

              <div className="flex items-center gap-3">

                <TrendingDown className="text-red-400" />

                <h2 className="text-xl font-bold">
                  Egresos
                </h2>

              </div>

              <p className="text-4xl font-black text-red-400 mt-4">
                ${egresos}
              </p>

            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-3xl p-6">

              <div className="flex items-center gap-3">

                <Wallet className="text-cyan-400" />

                <h2 className="text-xl font-bold">
                  Balance
                </h2>

              </div>

              <p className="text-4xl font-black text-cyan-400 mt-4">
                ${balance}
              </p>

            </div>

          </div>

          {/* FORMULARIO */}

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">

            <h2 className="text-2xl font-bold mb-6">
              Nuevo Movimiento
            </h2>

            <div className="grid md:grid-cols-2 gap-4">

              <select
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              >

                <option value="Ingreso">
                  Ingreso
                </option>

                <option value="Egreso">
                  Egreso
                </option>

              </select>

              <input
                type="text"
                placeholder="Descripción"
                value={descripcion}
                onChange={(e) =>
                  setDescripcion(
                    e.target.value
                  )
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="number"
                placeholder="Monto"
                value={monto}
                onChange={(e) =>
                  setMonto(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="text"
                placeholder="Empresa"
                value={empresa}
                onChange={(e) =>
                  setEmpresa(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="date"
                value={fecha}
                onChange={(e) =>
                  setFecha(e.target.value)
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

            </div>

            <button
              onClick={crearMovimiento}
              className="mt-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-4 rounded-2xl flex items-center gap-2 transition"
            >

              <Plus size={20} />

              Crear Movimiento

            </button>

          </div>

          {/* LISTA */}

          <div className="space-y-4">

            {movimientos.map((mov) => (

              <div
                key={mov.id}
                className="bg-white/5 border border-white/10 rounded-3xl p-5 flex justify-between items-center"
              >

                <div>

                  <h2 className="text-2xl font-bold">
                    {mov.descripcion}
                  </h2>

                  <p className="text-gray-400 mt-1">
                    Empresa: {mov.empresa}
                  </p>

                  <p className="text-gray-500 mt-1">
                    Fecha: {mov.fecha}
                  </p>

                  <p
                    className={`mt-2 font-bold ${
                      mov.tipo === "Ingreso"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {mov.tipo}: ${mov.monto}
                  </p>

                </div>

                <button
                  onClick={() =>
                    eliminarMovimiento(
                      mov.id
                    )
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