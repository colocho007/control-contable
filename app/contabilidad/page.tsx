"use client";
import { useRouter } from "next/navigation";
import { verificarRol } from "../../lib/auth";


import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Calendar
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
    const router = useRouter();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [listaEmpresas, setListaEmpresas] = useState<{ nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado unificado para el formulario
  const [form, setForm] = useState({
    tipo: "Ingreso",
    descripcion: "",
    monto: "",
    empresa: "",
    fecha: new Date().toISOString().split('T')[0] // Fecha de hoy por defecto
  });

useEffect(() => {
  async function iniciar() {
    const acceso = await verificarRol(["admin"]);

    if (!acceso.autorizado) {
      router.replace("/dashboard");
      return;
    }

    obtenerMovimientos();
    obtenerEmpresas();
  }

  iniciar();
}, []);

async function iniciarPagina() {
  const auth = await verificarRol(["admin"]);

  if (!auth.autorizado) {
    alert(auth.error);
    window.location.href = "/dashboard";
    return;
  }

  obtenerMovimientos();
  obtenerEmpresas();
}

  async function obtenerEmpresas() {
    const { data } = await supabase.from("empresas").select("nombre");
    if (data) setListaEmpresas(data);
  }

  async function obtenerMovimientos() {
    const { data } = await supabase
      .from("movimientos")
      .select("*")
      .order("fecha", { ascending: false });

    if (data) setMovimientos(data);
  }

  async function crearMovimiento() {
    if (!form.descripcion || !form.monto || !form.empresa) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("movimientos").insert([
      {
        ...form,
        monto: Number(form.monto),
      },
    ]);

    if (!error) {
      setForm({ ...form, descripcion: "", monto: "" });
      obtenerMovimientos();
    }
    setLoading(false);
  }

  async function eliminarMovimiento(id: number) {
    if (!confirm("¿Eliminar este registro contable?")) return;
    await supabase.from("movimientos").delete().eq("id", id);
    obtenerMovimientos();
  }

  // Formateador de Moneda
  const money = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  // Cálculos
  const ingresos = movimientos.filter(m => m.tipo === "Ingreso").reduce((acc, m) => acc + Number(m.monto), 0);
  const egresos = movimientos.filter(m => m.tipo === "Egreso").reduce((acc, m) => acc + Number(m.monto), 0);
  const balance = ingresos - egresos;

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10">
            <h1 className="text-5xl font-black tracking-tight">Contabilidad</h1>
            <p className="text-gray-400 mt-2">Libro diario y control de flujos de caja</p>
          </header>

          {/* INDICADORES FINANCIEROS */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <div className="bg-green-500/10 border border-green-500/20 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center gap-3 text-green-400 opacity-80">
                <TrendingUp size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Ingresos</span>
              </div>
              <p className="text-4xl font-black text-green-400 mt-4">{money(ingresos)}</p>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center gap-3 text-red-400 opacity-80">
                <TrendingDown size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Egresos</span>
              </div>
              <p className="text-4xl font-black text-red-400 mt-4">{money(egresos)}</p>
            </div>

            <div className={`border rounded-[2.5rem] p-8 shadow-xl transition-colors ${balance >= 0 ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
              <div className={`flex items-center gap-3 opacity-80 ${balance >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>
                <Wallet size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Balance Neto</span>
              </div>
              <p className={`text-4xl font-black mt-4 ${balance >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>
                {money(balance)}
              </p>
            </div>
          </div>

          {/* REGISTRO DE MOVIMIENTO */}
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Plus className="text-cyan-500" /> Nuevo Registro
            </h2>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer"
                >
                  <option value="Ingreso">🟢 Ingreso</option>
                  <option value="Egreso">🔴 Egreso</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">Descripción del concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Pago de Honorarios - Cliente X"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">Monto ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">Empresa Relacionada</label>
                <select
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer"
                >
                  <option value="">Seleccionar empresa...</option>
                  {listaEmpresas.map((emp, i) => (
                    <option key={i} value={emp.nombre}>{emp.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">Fecha del Movimiento</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <button
              onClick={crearMovimiento}
              disabled={loading}
              className="mt-8 w-full md:w-auto bg-white text-black font-black px-10 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all active:scale-95"
            >
              {loading ? "Registrando..." : "REGISTRAR MOVIMIENTO"}
            </button>
          </div>

          {/* LISTADO DE MOVIMIENTOS */}
          <div className="grid gap-4">
            {movimientos.map((mov) => (
              <div
                key={mov.id}
                className="group bg-[#0B1120] border border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-white/20 transition-all"
              >
                <div className="flex gap-6 items-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl ${mov.tipo === 'Ingreso' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {mov.tipo === 'Ingreso' ? '+' : '-'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">{mov.descripcion}</h3>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                        <Building2 size={14} className="text-cyan-500" /> {mov.empresa}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                        <Calendar size={14} className="text-purple-500" /> {mov.fecha}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 flex items-center gap-6 w-full md:w-auto justify-between">
                  <span className={`text-2xl font-black ${mov.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                    {money(mov.monto)}
                  </span>
                  <button
                    onClick={() => eliminarMovimiento(mov.id)}
                    className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
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