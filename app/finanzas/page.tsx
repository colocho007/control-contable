"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

import {
  Ban,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Wallet,
} from "lucide-react";

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface Movimiento {
  id: number;
  tipo: "Ingreso" | "Egreso" | string;
  descripcion: string;
  monto: number;
  empresa: string;
  empresa_id: number | null;
  moneda: "GTQ" | "USD" | string | null;
  categoria?: string | null;
  fecha: string;
  estado?: string | null;
  creado_por?: string | null;
  anulado_por?: string | null;
  anulado_at?: string | null;
  motivo_anulacion?: string | null;
}

const MONEDAS = ["GTQ", "USD"] as const;
const TIPOS_MOVIMIENTO = ["Ingreso", "Egreso"] as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function fechaHoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function numero(valor: string | number) {
  const resultado = Number(valor);
  if (!Number.isFinite(resultado)) throw new Error("El monto debe ser numerico.");
  return Math.round(resultado * 100) / 100;
}

function formatoMonto(valor: number, moneda: string) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "GTQ",
  }).format(Number(valor || 0));
}

export default function FinanzasPage() {
  const router = useRouter();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);

  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [rolActual, setRolActual] = useState("");

  const [empresaFiltro, setEmpresaFiltro] = useState("Todas");
  const [form, setForm] = useState({
    empresaId: "",
    tipo: "Ingreso",
    descripcion: "",
    monto: "",
    moneda: "GTQ",
    fecha: fechaHoyISO(),
  });

  useEffect(() => {
    async function iniciarPagina() {
      const acceso = await validarAccesoModuloUsuario("finanzas");

      if (!acceso.ok) {
        if (
          acceso.motivo === "sin_sesion" ||
          acceso.motivo === "sin_perfil" ||
          acceso.motivo === "usuario_inactivo"
        ) {
          if (acceso.motivo === "usuario_inactivo") {
            alert("Tu usuario esta inactivo. Contacta al administrador.");
          }

          router.replace("/login");
          return;
        }

        if (
          acceso.motivo === "modulo_inactivo" ||
          acceso.motivo === "modulo_no_encontrado"
        ) {
          alert("El modulo de Finanzas esta desactivado.");
        } else {
          alert("No tienes acceso al modulo de Finanzas.");
        }

        router.replace("/dashboard");
        return;
      }

      const usuario = acceso.user!;
      const rol = normalizarRol(acceso.perfil?.rol);

      if (!["admin", "supervisor", "jefe", "contador", "auxiliar", "auditor"].includes(rol)) {
        router.replace("/dashboard");
        return;
      }

      setUserId(usuario.id);
      setRolActual(rol);
      setAutorizado(true);
      setCargando(true);

      try {
        const idsPermitidos = await obtenerEmpresasPermitidas(
          usuario.id,
          acceso.perfil?.rol || ""
        );
        const operativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const idsOperativos = operativas.ids;

        setEmpresasPermitidasIds(idsOperativos);
        setEmpresas(operativas.empresas);
        setFuncionesOperativas(
          await listarFuncionesOperativasUsuario(usuario.id, idsOperativos)
        );

        if (idsOperativos.length) {
          const empresaInicial = String(idsOperativos[0]);
          setForm((actual) => ({ ...actual, empresaId: actual.empresaId || empresaInicial }));
          await obtenerMovimientos(idsOperativos);
        } else {
          setMovimientos([]);
        }
      } catch (error) {
        console.error("Error cargando Finanzas:", error);
        alert("Error al cargar datos de Finanzas.");
      } finally {
        setCargando(false);
        setValidandoAcceso(false);
      }
    }

    iniciarPagina();
  }, [router]);

  async function obtenerMovimientos(idsPermitidos = empresasPermitidasIds) {
    const ids = Array.from(new Set(idsPermitidos.map(Number).filter(Number.isFinite)));

    if (!ids.length) {
      setMovimientos([]);
      return;
    }

    const { data, error } = await supabase
      .from("movimientos")
      .select(
        "id,tipo,descripcion,monto,empresa,empresa_id,moneda,categoria,fecha,estado,creado_por,anulado_por,anulado_at,motivo_anulacion"
      )
      .in("empresa_id", ids)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false });

    if (error) throw error;

    setMovimientos((data || []) as Movimiento[]);
  }

  function validarEmpresaPermitida(valor: string | number, accion: string) {
    const empresaId = Number(valor);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error(`Debe seleccionar una empresa valida para ${accion}.`);
    }

    if (!empresasPermitidasIds.includes(empresaId)) {
      throw new Error("No tienes permiso para operar sobre esa empresa.");
    }

    return empresaId;
  }

  function esAuditorSoloLectura(empresaId: string | number | null | undefined) {
    return esAuditorSoloLecturaLocal(funcionesOperativas, [empresaId]);
  }

  function tieneFuncionFinanzas(
    empresaId: string | number | null | undefined,
    funciones: Array<"auxiliar_contable" | "contador_revisor">
  ) {
    return tieneFuncionOperativaLocal(funcionesOperativas, userId, empresaId, funciones);
  }

  function puedeCrearMovimiento(empresaId: string | number | null | undefined) {
    if (esAuditorSoloLectura(empresaId)) return false;
    return (
      tieneFuncionFinanzas(empresaId, ["auxiliar_contable", "contador_revisor"]) ||
      ["admin", "supervisor", "jefe", "contador", "auxiliar"].includes(rolActual)
    );
  }

  function puedeAnularMovimiento(movimiento: Movimiento) {
    if (!movimiento.empresa_id || esAuditorSoloLectura(movimiento.empresa_id)) return false;
    return (
      tieneFuncionFinanzas(movimiento.empresa_id, ["contador_revisor"]) ||
      ["admin", "supervisor", "jefe", "contador"].includes(rolActual)
    );
  }

  async function auditarBloqueoAuditor(accion: string, empresaId: number, entidadId?: number) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: empresaId,
        modulo: "finanzas",
        accion: "intento_bloqueado_auditor_solo_lectura",
        entidad_tipo: entidadId ? "movimiento" : "empresa",
        entidad_id: entidadId || empresaId,
        descripcion: "Auditor solo lectura intento modificar Finanzas.",
        sensible: true,
        origen: "modulo_finanzas",
        metadatos: { accion_intentada: accion },
      });
    } catch (error) {
      console.warn("No se pudo auditar bloqueo de auditor en Finanzas:", error);
    }
  }

  async function crearMovimiento() {
    if (procesando) {
      alert("Ya hay una operacion en proceso.");
      return;
    }

    if (!userId) {
      alert("Sesion no valida.");
      return;
    }

    let empresaId: number;
    let montoValidado: number;

    try {
      empresaId = validarEmpresaPermitida(form.empresaId, "crear movimientos");
      montoValidado = numero(form.monto);
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    if (!puedeCrearMovimiento(empresaId)) {
      if (esAuditorSoloLectura(empresaId)) {
        await auditarBloqueoAuditor("crear_movimiento", empresaId);
      }
      alert("No tienes permiso para crear movimientos en esta empresa.");
      return;
    }

    if (!TIPOS_MOVIMIENTO.includes(form.tipo as (typeof TIPOS_MOVIMIENTO)[number])) {
      alert("El tipo de movimiento no es valido.");
      return;
    }

    if (!form.descripcion.trim()) {
      alert("La descripcion es obligatoria.");
      return;
    }

    if (montoValidado <= 0) {
      alert("El monto debe ser mayor a cero.");
      return;
    }

    if (!MONEDAS.includes(form.moneda as (typeof MONEDAS)[number])) {
      alert("La moneda debe ser GTQ o USD.");
      return;
    }

    if (!form.fecha) {
      alert("La fecha es obligatoria.");
      return;
    }

    const empresaSeleccionada = empresas.find((item) => item.id === empresaId);

    setProcesando(true);

    try {
      const { data: movimientoCreado, error } = await supabase
        .from("movimientos")
        .insert([
          {
            tipo: form.tipo,
            descripcion: form.descripcion.trim(),
            monto: montoValidado,
            empresa: empresaSeleccionada?.nombre || `Empresa ${empresaId}`,
            empresa_id: empresaId,
            moneda: form.moneda,
            fecha: form.fecha,
            estado: "activo",
            creado_por: userId,
          },
        ])
        .select("id,tipo,descripcion,monto,empresa,empresa_id,moneda,fecha,estado")
        .single();

      if (error || !movimientoCreado) {
        throw error || new Error("No se pudo crear el movimiento.");
      }

      let auditoriaRegistrada = true;

      try {
        await registrarAuditoriaEvento({
          empresa_id: movimientoCreado.empresa_id,
          modulo: "finanzas",
          accion: "crear_movimiento",
          entidad_tipo: "movimiento",
          entidad_id: movimientoCreado.id,
          estado_nuevo: movimientoCreado.estado || "activo",
          descripcion: "Movimiento financiero operativo creado",
          sensible: true,
          visible_calendario: Boolean(movimientoCreado.fecha),
          origen: "modulo_finanzas",
          metadatos: {
            tipo: movimientoCreado.tipo,
            monto: Number(movimientoCreado.monto),
            moneda: movimientoCreado.moneda,
            fecha: movimientoCreado.fecha,
          },
        });
      } catch (auditoriaError) {
        auditoriaRegistrada = false;
        console.error(
          "El movimiento fue creado, pero no se pudo registrar la auditoria:",
          auditoriaError
        );
      }

      setForm((actual) => ({
        ...actual,
        descripcion: "",
        monto: "",
      }));

      await obtenerMovimientos();

      alert(
        auditoriaRegistrada
          ? "Movimiento creado correctamente."
          : "Movimiento creado, pero no se pudo registrar la auditoria central."
      );
    } catch (error) {
      console.error("Error creando movimiento:", error);
      alert(`Error al registrar movimiento: ${getErrorMessage(error)}`);
    } finally {
      setProcesando(false);
    }
  }

  async function anularMovimiento(movimiento: Movimiento) {
    if (procesando) {
      alert("Ya hay una operacion en proceso.");
      return;
    }

    if (!userId) {
      alert("Sesion no valida.");
      return;
    }

    if (!movimiento.empresa_id) {
      alert("No se encontro una empresa valida para este movimiento.");
      return;
    }

    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(movimiento.empresa_id, "anular movimientos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    if (!puedeAnularMovimiento(movimiento)) {
      if (esAuditorSoloLectura(empresaId)) {
        await auditarBloqueoAuditor("anular_movimiento", empresaId, movimiento.id);
      }
      alert("No tienes permiso para anular movimientos en esta empresa.");
      return;
    }

    if ((movimiento.estado || "activo") === "anulado") {
      alert("El movimiento ya esta anulado.");
      return;
    }

    const motivo = window.prompt("Indica el motivo de anulacion:");

    if (!motivo || motivo.trim().length < 5) {
      alert("Debes escribir un motivo valido para anular.");
      return;
    }

    const confirmar = window.confirm(
      "Seguro que deseas anular este movimiento? No se borrara, quedara como anulado."
    );

    if (!confirmar) return;

    setProcesando(true);

    try {
      const { error } = await supabase
        .from("movimientos")
        .update({
          estado: "anulado",
          anulado_por: userId,
          anulado_at: new Date().toISOString(),
          motivo_anulacion: motivo.trim(),
        })
        .eq("id", movimiento.id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      let auditoriaRegistrada = true;
      let historialRegistrado = true;

      try {
        await registrarAuditoriaEvento({
          empresa_id: empresaId,
          modulo: "finanzas",
          accion: "anular_movimiento",
          entidad_tipo: "movimiento",
          entidad_id: movimiento.id,
          estado_anterior: movimiento.estado || "activo",
          estado_nuevo: "anulado",
          motivo: motivo.trim(),
          descripcion: "Movimiento financiero operativo anulado",
          sensible: true,
          visible_calendario: true,
          origen: "modulo_finanzas",
          metadatos: {
            tipo: movimiento.tipo,
            monto: Number(movimiento.monto),
            moneda: movimiento.moneda,
            fecha: movimiento.fecha,
          },
        });
      } catch (auditoriaError) {
        auditoriaRegistrada = false;
        console.error(
          "El movimiento fue anulado, pero no se pudo registrar la auditoria:",
          auditoriaError
        );
      }

      const { error: historialError } = await supabase
        .from("movimientos_historial")
        .insert([
          {
            movimiento_id: movimiento.id,
            accion: "Movimiento anulado",
            comentario: motivo.trim(),
            usuario_id: userId,
          },
        ]);

      if (historialError) {
        historialRegistrado = false;
        console.error(
          "El movimiento fue anulado, pero no se pudo registrar historial:",
          historialError
        );
      }

      await obtenerMovimientos();

      alert(
        auditoriaRegistrada && historialRegistrado
          ? "Movimiento anulado correctamente."
          : "Movimiento anulado, pero hubo un problema registrando auditoria o historial."
      );
    } catch (error) {
      console.error("Error anulando movimiento:", error);
      alert(`Error al anular movimiento: ${getErrorMessage(error)}`);
    } finally {
      setProcesando(false);
    }
  }

  const movimientosActivos = useMemo(
    () =>
      movimientos.filter(
        (movimiento) =>
          movimiento.empresa_id !== null &&
          empresasPermitidasIds.includes(Number(movimiento.empresa_id)) &&
          (movimiento.estado || "activo") !== "anulado"
      ),
    [empresasPermitidasIds, movimientos]
  );

  const movimientosFiltrados = useMemo(
    () =>
      empresaFiltro === "Todas"
        ? movimientosActivos
        : movimientosActivos.filter(
            (movimiento) => Number(movimiento.empresa_id) === Number(empresaFiltro)
          ),
    [empresaFiltro, movimientosActivos]
  );

  const resumenPorMoneda = useMemo(
    () =>
      MONEDAS.map((moneda) => {
        const ingresos = movimientosFiltrados
          .filter((movimiento) => movimiento.tipo === "Ingreso" && movimiento.moneda === moneda)
          .reduce((total, movimiento) => total + Number(movimiento.monto), 0);
        const egresos = movimientosFiltrados
          .filter((movimiento) => movimiento.tipo === "Egreso" && movimiento.moneda === moneda)
          .reduce((total, movimiento) => total + Number(movimiento.monto), 0);

        return {
          moneda,
          ingresos,
          egresos,
          balance: ingresos - egresos,
        };
      }),
    [movimientosFiltrados]
  );

  const empresaFormId = Number(form.empresaId || 0);
  const auditorSoloLecturaForm =
    empresaFormId > 0 && esAuditorSoloLectura(empresaFormId);
  const puedeCrearForm =
    empresaFormId > 0 && puedeCrearMovimiento(empresaFormId) && !procesando;

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
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-5xl font-black">Finanzas</h1>
              <p className="text-gray-400 mt-2">
                Movimientos operativos V1 por empresa. No crea asientos contables
                automaticos ni modifica Contabilidad V2 formal.
              </p>
            </div>

            <button
              type="button"
              onClick={() => obtenerMovimientos()}
              disabled={cargando || !empresasPermitidasIds.length}
              className="h-12 px-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 font-bold hover:bg-cyan-500/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCcw size={18} />
              Actualizar
            </button>
          </div>

          {!empresas.length && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-8 text-yellow-100">
              No tienes empresas operativas disponibles para Finanzas. Las empresas
              archivadas, inactivas o de prueba no se muestran aqui.
            </div>
          )}

          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-5 mb-8">
            <h2 className="text-cyan-300 font-black text-sm uppercase">
              Alcance seguro
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Todas las consultas y anulaciones filtran por `empresa_id` dentro
              de tus empresas permitidas y operativas. GTQ y USD se resumen por
              separado.
            </p>
          </div>

          <div className="mb-8 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <select
              value={empresaFiltro}
              onChange={(event) => setEmpresaFiltro(event.target.value)}
              className="h-12 px-4 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 text-white min-w-[260px]"
            >
              <option value="Todas" style={{ backgroundColor: "#0B1120", color: "white" }}>
                Todas las empresas operativas
              </option>
              {empresas.map((empresa) => (
                <option
                  key={empresa.id}
                  value={String(empresa.id)}
                  style={{ backgroundColor: "#0B1120", color: "white" }}
                >
                  {empresa.nombre}
                </option>
              ))}
            </select>

            {cargando && (
              <div className="flex items-center gap-2 text-cyan-200">
                <Loader2 className="animate-spin" size={18} />
                Cargando movimientos...
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-5 mb-10">
            {resumenPorMoneda.map((fila) => (
              <div
                key={`ingresos-${fila.moneda}`}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Ingresos {fila.moneda}
                </p>
                <p className="text-2xl font-black text-green-400 mt-3">
                  {formatoMonto(fila.ingresos, fila.moneda)}
                </p>
              </div>
            ))}

            {resumenPorMoneda.map((fila) => (
              <div
                key={`egresos-${fila.moneda}`}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Egresos {fila.moneda}
                </p>
                <p className="text-2xl font-black text-red-400 mt-3">
                  {formatoMonto(fila.egresos, fila.moneda)}
                </p>
              </div>
            ))}

            {resumenPorMoneda.map((fila) => (
              <div
                key={`balance-${fila.moneda}`}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Balance {fila.moneda}
                </p>
                <p className="text-2xl font-black text-cyan-300 mt-3">
                  {formatoMonto(fila.balance, fila.moneda)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10">
            <div className="flex items-center gap-3 mb-6">
              <Wallet className="text-cyan-300" />
              <h2 className="text-2xl font-bold">Nuevo Movimiento</h2>
            </div>

            {auditorSoloLecturaForm && (
              <div className="mb-5 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-yellow-100 flex gap-3">
                <Ban size={20} />
                Auditor solo lectura: puedes consultar movimientos, pero no crear ni anular.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <select
                value={form.empresaId}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, empresaId: event.target.value }))
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              >
                <option value="" style={{ backgroundColor: "#0B1120", color: "white" }}>
                  Seleccionar empresa...
                </option>
                {empresas.map((empresa) => (
                  <option
                    key={empresa.id}
                    value={String(empresa.id)}
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    {empresa.nombre}
                  </option>
                ))}
              </select>

              <select
                value={form.tipo}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, tipo: event.target.value }))
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              >
                {TIPOS_MOVIMIENTO.map((tipoMovimiento) => (
                  <option
                    key={tipoMovimiento}
                    value={tipoMovimiento}
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    {tipoMovimiento}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Descripcion"
                value={form.descripcion}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, descripcion: event.target.value }))
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto"
                value={form.monto}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, monto: event.target.value }))
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />

              <select
                value={form.moneda}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, moneda: event.target.value }))
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              >
                {MONEDAS.map((moneda) => (
                  <option
                    key={moneda}
                    value={moneda}
                    style={{ backgroundColor: "#0B1120", color: "white" }}
                  >
                    {moneda}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={form.fecha}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, fecha: event.target.value }))
                }
                className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={crearMovimiento}
              disabled={!puedeCrearForm || !empresas.length}
              className="mt-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-4 rounded-2xl flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {procesando ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              Crear Movimiento
            </button>
          </div>

          <div className="space-y-4">
            {!movimientosFiltrados.length && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-gray-400">
                No hay movimientos activos para el filtro seleccionado.
              </div>
            )}

            {movimientosFiltrados.map((movimiento) => (
              <div
                key={movimiento.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:justify-between md:items-center gap-4"
              >
                <div>
                  <h2 className="text-2xl font-bold">{movimiento.descripcion}</h2>
                  <p
                    className={`mt-2 font-bold ${
                      movimiento.tipo === "Ingreso" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {movimiento.tipo}
                  </p>
                  <p className="text-cyan-400 mt-1">
                    {formatoMonto(Number(movimiento.monto), movimiento.moneda || "GTQ")}
                  </p>
                  <p className="text-gray-400 mt-1">
                    {movimiento.empresa || `Empresa ${movimiento.empresa_id}`}
                  </p>
                  <p className="text-gray-500 mt-1 text-sm">{movimiento.fecha}</p>
                </div>

                <button
                  type="button"
                  onClick={() => anularMovimiento(movimiento)}
                  disabled={!puedeAnularMovimiento(movimiento) || procesando}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 p-4 rounded-2xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    puedeAnularMovimiento(movimiento)
                      ? "Anular movimiento"
                      : "No tienes permiso para anular este movimiento"
                  }
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
