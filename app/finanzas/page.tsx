"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

import {
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Movimiento {
  id: number;
  tipo: string;
  descripcion: string;
  monto: number;
  empresa: string;
  empresa_id?: number | null;
  moneda?: string | null;
  categoria?: string | null;
  fecha: string;
  estado?: string | null;
  anulado_por?: string | null;
  anulado_at?: string | null;
  motivo_anulacion?: string | null;
}

export default function FinanzasPage() {
    const router = useRouter();

  const [movimientos, setMovimientos] =
    useState<Movimiento[]>([]);

  const [validandoAcceso, setValidandoAcceso] =
    useState(true);

  const [autorizado, setAutorizado] =
    useState(false);

  const [userId, setUserId] =
    useState<string | null>(null);

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
  iniciarPagina();
}, [router]);

async function iniciarPagina() {
  const acceso = await validarAccesoModuloUsuario("finanzas");

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
      alert("El módulo de Finanzas está desactivado.");
    } else {
      alert("No tienes acceso al módulo de Finanzas.");
    }

    router.replace("/dashboard");
    return;
  }

  const perfil = acceso.perfil!;
  const rolNormalizado = (perfil.rol || "").trim().toLowerCase();

  if (rolNormalizado !== "admin") {
    router.replace("/dashboard");
    return;
  }

  setUserId(acceso.user!.id);
  await obtenerMovimientos();
  setAutorizado(true);
  setValidandoAcceso(false);
}

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

    const { data: movimientoCreado, error } = await supabase
      .from("movimientos")
      .insert([
        {
          tipo,
          descripcion,
          monto:
            Number(monto),
          empresa,
          fecha,
        },
      ])
      .select("id,tipo,descripcion,monto,empresa,empresa_id,moneda,fecha,estado")
      .single();

    if (error || !movimientoCreado) {
      console.error("Error creando movimiento:", error);
      alert("Error al registrar movimiento.");
      return;
    }

    let auditoriaRegistrada = true;

    try {
      await registrarAuditoriaEvento({
        empresa_id: movimientoCreado.empresa_id ?? null,
        modulo: "finanzas",
        accion: "crear_movimiento",
        entidad_tipo: "movimiento",
        entidad_id: movimientoCreado.id,
        estado_nuevo: movimientoCreado.estado || "activo",
        descripcion: "Movimiento financiero creado",
        sensible: true,
        visible_calendario: Boolean(movimientoCreado.fecha),
        origen: "modulo_finanzas",
        metadatos: {
          tipo: movimientoCreado.tipo,
          monto: Number(movimientoCreado.monto),
          moneda: movimientoCreado.moneda ?? null,
          fecha: movimientoCreado.fecha,
          descripcion: movimientoCreado.descripcion,
        },
      });
    } catch (auditoriaError) {
      auditoriaRegistrada = false;
      console.error(
        "El movimiento fue creado, pero no se pudo registrar la auditoría:",
        auditoriaError
      );
    }

    setDescripcion("");
    setMonto("");
    setEmpresa("");
    setFecha("");

    await obtenerMovimientos();

    if (!auditoriaRegistrada) {
      alert(
        "Movimiento creado, pero no se pudo registrar la auditoría central."
      );
    }
  }

  async function eliminarMovimiento(
    id: number
  ) {
    if (!userId) {
      alert("Sesion no valida.");
      return;
    }

    const confirmar = window.confirm(
      "Seguro que deseas anular este movimiento? No se borrara, quedara como anulado."
    );

    if (!confirmar) return;

    const motivo = "Anulado desde Finanzas";
    const movimientoAnulado = movimientos.find((movimiento) => movimiento.id === id);

    const { error } = await supabase
      .from("movimientos")
      .update({
        estado: "anulado",
        anulado_por: userId,
        anulado_at: new Date().toISOString(),
        motivo_anulacion: motivo,
      })
      .eq("id", id);

    if (error) {
      alert("Error al anular movimiento.");
      return;
    }

    let auditoriaRegistrada = true;

    try {
      await registrarAuditoriaEvento({
        empresa_id: movimientoAnulado?.empresa_id ?? null,
        modulo: "finanzas",
        accion: "anular_movimiento",
        entidad_tipo: "movimiento",
        entidad_id: id,
        estado_anterior: movimientoAnulado?.estado || "activo",
        estado_nuevo: "anulado",
        motivo,
        descripcion: "Movimiento financiero anulado",
        sensible: true,
        visible_calendario: true,
        origen: "modulo_finanzas",
        metadatos: {
          tipo: movimientoAnulado?.tipo ?? null,
          monto: movimientoAnulado ? Number(movimientoAnulado.monto) : null,
          moneda: movimientoAnulado?.moneda ?? null,
          fecha: movimientoAnulado?.fecha ?? null,
          descripcion: movimientoAnulado?.descripcion ?? null,
        },
      });
    } catch (auditoriaError) {
      auditoriaRegistrada = false;
      console.error(
        "El movimiento fue anulado, pero no se pudo registrar la auditoría:",
        auditoriaError
      );
    }

    await supabase.from("movimientos_historial").insert([
      {
        movimiento_id: id,
        accion: "Movimiento anulado",
        comentario: motivo,
        usuario_id: userId,
      },
    ]);

    alert(
      auditoriaRegistrada
        ? "Movimiento anulado correctamente."
        : "Movimiento anulado, pero no se pudo registrar la auditoría central."
    );
    await obtenerMovimientos();
  }

  // KPIs

  const movimientosActivos =
    movimientos.filter(
      (m) =>
        (m.estado || "activo") !== "anulado"
    );

  const ingresos =
    movimientosActivos
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
    movimientosActivos
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

          {/* HEADER */}

          <div className="mb-10">

            <h1 className="text-5xl font-black">
              Finanzas
            </h1>

            <p className="text-gray-400 mt-2">
              Control financiero empresarial
            </p>

          </div>

          {/* KPIs */}

          <div className="grid md:grid-cols-3 gap-5 mb-10">

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <div className="flex items-center gap-3">

                <TrendingUp className="text-green-400" />

                <h2 className="font-bold">
                  Ingresos
                </h2>

              </div>

              <p className="text-4xl font-black text-green-400 mt-5">
                ${ingresos}
              </p>

            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <div className="flex items-center gap-3">

                <TrendingDown className="text-red-400" />

                <h2 className="font-bold">
                  Egresos
                </h2>

              </div>

              <p className="text-4xl font-black text-red-400 mt-5">
                ${egresos}
              </p>

            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <div className="flex items-center gap-3">

                <Wallet className="text-cyan-400" />

                <h2 className="font-bold">
                  Balance
                </h2>

              </div>

              <p className="text-4xl font-black text-cyan-400 mt-5">
                ${balance}
              </p>

            </div>

          </div>

          {/* FORMULARIO */}

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-10">

            <h2 className="text-2xl font-bold mb-6">
              Nuevo Movimiento
            </h2>

            <div className="grid md:grid-cols-2 gap-4">

              <select
                value={tipo}
                onChange={(e) =>
                  setTipo(
                    e.target.value
                  )
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
                  setMonto(
                    e.target.value
                  )
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="text"
                placeholder="Empresa"
                value={empresa}
                onChange={(e) =>
                  setEmpresa(
                    e.target.value
                  )
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="date"
                value={fecha}
                onChange={(e) =>
                  setFecha(
                    e.target.value
                  )
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

            {movimientosActivos.map((mov) => (

              <div
                key={mov.id}
                className="bg-white/5 border border-white/10 rounded-3xl p-5 flex justify-between items-center"
              >

                <div>

                  <h2 className="text-2xl font-bold">
                    {mov.descripcion}
                  </h2>

                  <p
                    className={`mt-2 font-bold ${
                      mov.tipo ===
                      "Ingreso"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {mov.tipo}
                  </p>

                  <p className="text-cyan-400 mt-1">
                    ${mov.monto}
                  </p>

                  <p className="text-gray-400 mt-1">
                    {mov.empresa}
                  </p>

                  <p className="text-gray-500 mt-1 text-sm">
                    {mov.fecha}
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
