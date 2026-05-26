"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Calendar,
} from "lucide-react";

interface Movimiento {
  id: number;
  tipo: string;
  descripcion: string;
  monto: number;
  empresa: string;
  empresa_id: number | null;
  moneda: string | null;
  fecha: string;
  estado?: string | null;
  creado_por?: string | null;
  anulado_por?: string | null;
  anulado_at?: string | null;
  motivo_anulacion?: string | null;
}

interface Empresa {
  id: number;
  nombre: string;
}

export default function ContabilidadPage() {
  const router = useRouter();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoContabilidad, setCargandoContabilidad] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [empresaFiltro, setEmpresaFiltro] = useState("Todas");
  const [rolActual, setRolActual] = useState("");
const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tipo: "Ingreso",
    descripcion: "",
    monto: "",
    empresa: "",
    empresaId: "",
    moneda: "GTQ",
    fecha: new Date().toISOString().split("T")[0],
  });

useEffect(() => {
  async function iniciar() {
    const acceso = await validarAccesoModuloUsuario("contabilidad");

    if (!acceso.ok) {
      if (
        acceso.motivo === "sin_sesion" ||
        acceso.motivo === "sin_perfil" ||
        acceso.motivo === "usuario_inactivo"
      ) {
        if (acceso.motivo === "usuario_inactivo") {
          alert("Tu usuario está inactivo. Contacta al administrador.");
        }

        router.replace("/login");
        return;
      }

      if (
        acceso.motivo === "modulo_inactivo" ||
        acceso.motivo === "modulo_no_encontrado"
      ) {
        alert("El módulo de Contabilidad está desactivado.");
      } else {
        alert("No tienes acceso al módulo de Contabilidad.");
      }

      router.replace("/dashboard");
      return;
    }

const user = acceso.user!;
const perfil = acceso.perfil!;

const rolNormalizado = (perfil.rol || "").trim().toLowerCase();

if (!["admin", "supervisor", "jefe", "empleado"].includes(rolNormalizado)) {
  router.replace("/dashboard");
  return;
}

setRolActual(rolNormalizado);
setUserId(user.id);
    setCargandoContabilidad(true);
    setAutorizado(true);
    setValidandoAcceso(false);

    try {
      const idsPermitidos = await obtenerEmpresasPermitidas(
        user.id,
        perfil.rol || ""
      );

      setEmpresasPermitidasIds(idsPermitidos);

      await Promise.all([
        obtenerEmpresas(idsPermitidos),
        obtenerMovimientos(idsPermitidos),
      ]);
    } catch (error) {
      console.error("Error cargando datos de Contabilidad:", error);
      alert("Error al cargar datos de Contabilidad.");
    } finally {
      setCargandoContabilidad(false);
    }
  }

  iniciar();
}, [router]);

  async function obtenerEmpresas(idsPermitidos: number[]) {
    if (!idsPermitidos.length) {
      setListaEmpresas([]);
      return idsPermitidos;
    }

    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) throw error;

    setListaEmpresas(data || []);

    return idsPermitidos;
  }

  async function obtenerMovimientos(idsPermitidos?: number[]) {
    const ids = idsPermitidos || empresasPermitidasIds;

    if (!ids.length) {
      setMovimientos([]);
      return;
    }

    const { data, error } = await supabase
      .from("movimientos")
      .select("*")
      .in("empresa_id", ids)
      .order("fecha", { ascending: false });

    if (error) throw error;

    setMovimientos(data || []);
  }

  async function crearMovimiento() {
  if (!userId) {
    alert("Sesión no válida.");
    return;
  }

  if (!form.descripcion || !form.monto || !form.empresa || !form.empresaId) {
    alert("Por favor completa todos los campos obligatorios.");
    return;
  }

    setLoading(true);

   const { error } = await supabase.from("movimientos").insert([
{
  tipo: form.tipo,
  descripcion: form.descripcion,
  monto: Number(form.monto),
  empresa: form.empresa,
  empresa_id: Number(form.empresaId),
  moneda: form.moneda,
  fecha: form.fecha,
  estado: "activo",
  creado_por: userId,
}
]);

    if (!error) {
      setForm({
        ...form,
        descripcion: "",
        monto: "",
      });

      await obtenerMovimientos();
    } else {
      console.error("Error creando movimiento:", error);
      alert("Error al registrar movimiento.");
    }

    setLoading(false);
  }

  async function anularMovimiento(id: number) {
  if (!puedeAnularMovimiento) {
    alert("No tienes permiso para anular movimientos.");
    return;
  }

  if (!userId) {
    alert("Sesión no válida.");
    return;
  }

  const motivo = window.prompt("Indica el motivo de anulación:");

  if (!motivo || motivo.trim().length < 5) {
    alert("Debes escribir un motivo válido para anular.");
    return;
  }

  const confirmar = window.confirm(
    "¿Seguro que deseas anular este movimiento? No se borrará, quedará como anulado."
  );

  if (!confirmar) return;

  const { error } = await supabase
    .from("movimientos")
    .update({
      estado: "anulado",
      anulado_por: userId,
      anulado_at: new Date().toISOString(),
      motivo_anulacion: motivo.trim(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error anulando movimiento:", error);
    alert("Error al anular movimiento.");
    return;
  }

  await supabase.from("movimientos_historial").insert([
    {
      movimiento_id: id,
      accion: "Movimiento anulado",
      comentario: motivo.trim(),
      usuario_id: userId,
    },
  ]);

  await obtenerMovimientos();
}

 const money = (val: number, moneda: string | null = "GTQ") =>
  new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-GT", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "GTQ",
  }).format(Number(val || 0));

 const movimientosPermitidos = movimientos.filter(
  (m) =>
    m.empresa_id !== null &&
    empresasPermitidasIds.includes(Number(m.empresa_id)) &&
    (m.estado || "activo") !== "anulado"
);

  const movimientosFiltrados =
    empresaFiltro === "Todas"
      ? movimientosPermitidos
      : movimientosPermitidos.filter(
          (m) => Number(m.empresa_id) === Number(empresaFiltro)
        );

const ingresosGTQ = movimientosFiltrados
  .filter((m) => m.tipo === "Ingreso" && (m.moneda || "GTQ") === "GTQ")
  .reduce((acc, m) => acc + Number(m.monto), 0);

const egresosGTQ = movimientosFiltrados
  .filter((m) => m.tipo === "Egreso" && (m.moneda || "GTQ") === "GTQ")
  .reduce((acc, m) => acc + Number(m.monto), 0);

const balanceGTQ = ingresosGTQ - egresosGTQ;

const ingresosUSD = movimientosFiltrados
  .filter((m) => m.tipo === "Ingreso" && m.moneda === "USD")
  .reduce((acc, m) => acc + Number(m.monto), 0);

const egresosUSD = movimientosFiltrados
  .filter((m) => m.tipo === "Egreso" && m.moneda === "USD")
  .reduce((acc, m) => acc + Number(m.monto), 0);

const balanceUSD = ingresosUSD - egresosUSD;

const puedeAnularMovimiento = ["admin", "supervisor", "jefe"].includes(
  rolActual
);

  const nombreEmpresaFiltro =
    empresaFiltro === "Todas"
      ? "Todas las empresas"
      : listaEmpresas.find((emp) => String(emp.id) === empresaFiltro)?.nombre ||
        "empresa seleccionada";

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex bg-[#020617] min-h-screen items-center justify-center text-white">
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">
                Contabilidad
              </h1>

              <p className="text-gray-400 mt-2">
                {empresaFiltro === "Todas"
                  ? "Libro diario general de todas las empresas"
                  : `Contabilidad específica de ${nombreEmpresaFiltro}`}
              </p>
            </div>

            {cargandoContabilidad ? (
              <div className="text-sm text-cyan-400">Cargando empresas...</div>
            ) : (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                Ver empresa
              </label>

              <select
                value={empresaFiltro}
                onChange={(e) => setEmpresaFiltro(e.target.value)}
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer text-white min-w-[260px]"
              >
                <option
                  value="Todas"
                  style={{ backgroundColor: "#0B1120", color: "white" }}
                >
                  Todas las empresas
                </option>

                {listaEmpresas.map((emp) => (
                  <option
                    key={emp.id}
                    value={String(emp.id)}
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    {emp.nombre}
                  </option>
                ))}
              </select>
            </div>
            )}
          </header>

          {cargandoContabilidad ? (
            <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-center text-cyan-400">
              Cargando datos de contabilidad...
            </section>
          ) : (
            <>
          {rolActual === "empleado" && (
  <div className="mb-8 bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
    <h2 className="text-green-400 font-black text-sm uppercase">
      Vista operativa contable
    </h2>
    <p className="text-gray-400 text-sm mt-1">
      Puedes registrar ingresos o egresos de las empresas asignadas y dar seguimiento
      a los movimientos. No puedes anular ni eliminar registros.
    </p>
  </div>
)}

        

          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
  <div className="bg-green-500/10 border border-green-500/20 rounded-[2.5rem] p-6 shadow-xl">
    <div className="flex items-center gap-3 text-green-400 opacity-80">
      <TrendingUp size={20} />
      <span className="text-xs font-bold uppercase tracking-widest">
        Ingresos GTQ
      </span>
    </div>

    <p className="text-2xl font-black text-green-400 mt-4">
      {money(ingresosGTQ, "GTQ")}
    </p>
  </div>

  <div className="bg-red-500/10 border border-red-500/20 rounded-[2.5rem] p-6 shadow-xl">
    <div className="flex items-center gap-3 text-red-400 opacity-80">
      <TrendingDown size={20} />
      <span className="text-xs font-bold uppercase tracking-widest">
        Egresos GTQ
      </span>
    </div>

    <p className="text-2xl font-black text-red-400 mt-4">
      {money(egresosGTQ, "GTQ")}
    </p>
  </div>

  <div
    className={`border rounded-[2.5rem] p-6 shadow-xl transition-colors ${
      balanceGTQ >= 0
        ? "bg-cyan-500/10 border-cyan-500/20"
        : "bg-orange-500/10 border-orange-500/20"
    }`}
  >
    <div
      className={`flex items-center gap-3 opacity-80 ${
        balanceGTQ >= 0 ? "text-cyan-400" : "text-orange-400"
      }`}
    >
      <Wallet size={20} />
      <span className="text-xs font-bold uppercase tracking-widest">
        Balance GTQ
      </span>
    </div>

    <p
      className={`text-2xl font-black mt-4 ${
        balanceGTQ >= 0 ? "text-cyan-400" : "text-orange-400"
      }`}
    >
      {money(balanceGTQ, "GTQ")}
    </p>
  </div>

  <div className="bg-green-500/10 border border-green-500/20 rounded-[2.5rem] p-6 shadow-xl">
    <div className="flex items-center gap-3 text-green-400 opacity-80">
      <TrendingUp size={20} />
      <span className="text-xs font-bold uppercase tracking-widest">
        Ingresos USD
      </span>
    </div>

    <p className="text-2xl font-black text-green-400 mt-4">
      {money(ingresosUSD, "USD")}
    </p>
  </div>

  <div className="bg-red-500/10 border border-red-500/20 rounded-[2.5rem] p-6 shadow-xl">
    <div className="flex items-center gap-3 text-red-400 opacity-80">
      <TrendingDown size={20} />
      <span className="text-xs font-bold uppercase tracking-widest">
        Egresos USD
      </span>
    </div>

    <p className="text-2xl font-black text-red-400 mt-4">
      {money(egresosUSD, "USD")}
    </p>
  </div>

  <div
    className={`border rounded-[2.5rem] p-6 shadow-xl transition-colors ${
      balanceUSD >= 0
        ? "bg-cyan-500/10 border-cyan-500/20"
        : "bg-orange-500/10 border-orange-500/20"
    }`}
  >
    <div
      className={`flex items-center gap-3 opacity-80 ${
        balanceUSD >= 0 ? "text-cyan-400" : "text-orange-400"
      }`}
    >
      <Wallet size={20} />
      <span className="text-xs font-bold uppercase tracking-widest">
        Balance USD
      </span>
    </div>

    <p
      className={`text-2xl font-black mt-4 ${
        balanceUSD >= 0 ? "text-cyan-400" : "text-orange-400"
      }`}
    >
      {money(balanceUSD, "USD")}
    </p>
  </div>
</div>
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Plus className="text-cyan-500" /> Nuevo Registro
            </h2>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                  Tipo
                </label>

                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer text-white"
                >
                  <option
                    value="Ingreso"
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    🟢 Ingreso
                  </option>

                  <option
                    value="Egreso"
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    🔴 Egreso
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                  Descripción del concepto
                </label>

                <input
                  type="text"
                  placeholder="Ej: Pago de Honorarios - Cliente X"
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                 Monto ({form.moneda})
                </label>

                <input
                  type="number"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={(e) =>
                    setForm({ ...form, monto: e.target.value })
                  }
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
  <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
    Moneda
  </label>

  <select
    value={form.moneda}
    onChange={(e) => setForm({ ...form, moneda: e.target.value })}
    className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer text-white"
  >
    <option value="GTQ" style={{ backgroundColor: "#0B1120", color: "white" }}>
      Quetzales GTQ
    </option>

    <option value="USD" style={{ backgroundColor: "#0B1120", color: "white" }}>
      Dólares USD
    </option>
  </select>
</div>


              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                  Empresa Relacionada
                </label>

                <select
                  value={form.empresaId}
                  onChange={(e) => {
                    const empresaSeleccionada = listaEmpresas.find(
                      (emp) => String(emp.id) === e.target.value
                    );

                    setForm({
                      ...form,
                      empresaId: e.target.value,
                      empresa: empresaSeleccionada?.nombre || "",
                    });
                  }}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer text-white"
                >
                  <option
                    value=""
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    Seleccionar empresa...
                  </option>

                  {listaEmpresas.map((emp) => (
                    <option
                      key={emp.id}
                      value={String(emp.id)}
                      style={{ backgroundColor: "#0B1120", color: "white" }}
                    >
                      {emp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                  Fecha del Movimiento
                </label>

                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) =>
                    setForm({ ...form, fecha: e.target.value })
                  }
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

          <div className="grid gap-4">
            {movimientosFiltrados.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <p className="text-gray-500 font-medium">
                  {empresaFiltro === "Todas"
                    ? "No hay movimientos registrados todavía."
                    : `No hay movimientos registrados para ${nombreEmpresaFiltro}.`}
                </p>
              </div>
            )}

            {movimientosFiltrados.map((mov) => (
              <div
                key={mov.id}
                className="group bg-[#0B1120] border border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-white/20 transition-all"
              >
                <div className="flex gap-6 items-center">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl ${
                      mov.tipo === "Ingreso"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {mov.tipo === "Ingreso" ? "+" : "-"}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      {mov.descripcion}
                    </h3>

                    <div className="flex flex-wrap gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                        <Building2 size={14} className="text-cyan-500" />{" "}
                        {mov.empresa}
                      </span>

                      <span className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                        <Calendar size={14} className="text-purple-500" />{" "}
                        {mov.fecha}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 flex items-center gap-6 w-full md:w-auto justify-between">
                  <span
                    className={`text-2xl font-black ${
                      mov.tipo === "Ingreso"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                 {money(mov.monto, mov.moneda)}
                  </span>

                 {puedeAnularMovimiento && (
  <button
    onClick={() => anularMovimiento(mov.id)}
    className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
    title="Anular movimiento"
  >
    <Trash2 size={18} />
  </button>
)}
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
