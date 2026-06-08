"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Building2,
  Landmark,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

interface Empresa {
  id: number;
  nombre: string;
}

interface Movimiento {
  id: number;
  tipo: string | null;
  descripcion: string | null;
  monto: number | null;
  empresa: string | null;
  empresa_id: number | null;
  moneda: string | null;
  fecha: string | null;
  estado: string | null;
}

interface Fondo {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string | null;
  saldo_base: number | null;
  saldo_comprometido: number | null;
  saldo_disponible: number | null;
  estado: string | null;
}

const MONEDAS = ["GTQ", "USD"] as const;
const LIMITE_MOVIMIENTOS = 200;

function normalizarTexto(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

function normalizarMoneda(valor?: string | null) {
  return (valor || "GTQ").trim().toUpperCase() === "USD" ? "USD" : "GTQ";
}

function monto(valor?: number | null) {
  return Number(valor || 0);
}

function formatoMonto(valor: number, moneda: string) {
  return `${moneda} ${Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mostrarFecha(valor?: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString("es-GT");
}

function inicioMesActual() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function FlujoEfectivoPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasIds, setEmpresasIds] = useState<number[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [funciones, setFunciones] = useState<UsuarioFuncionOperativa[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState("todas");
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("flujo-efectivo");
        if (!activo) return;

        if (!acceso.ok) {
          if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
            router.replace("/login");
            return;
          }
          setMensajeBloqueo("No tienes acceso al módulo Flujo de efectivo.");
          setValidandoAcceso(false);
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          acceso.perfil?.rol || ""
        );
        const operativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const funcionesUsuario = await listarFuncionesOperativasUsuario(
          acceso.user!.id,
          operativas.ids
        );

        if (!activo) return;
        setEmpresas(operativas.empresas);
        setEmpresasIds(operativas.ids);
        setFunciones(funcionesUsuario);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!operativas.ids.length) {
          setAviso("No tienes empresas operativas disponibles para consultar flujo de efectivo.");
          return;
        }

        await cargarDatos(operativas.ids, activo);
      } catch (error) {
        console.error("Error cargando flujo de efectivo:", error);
        if (activo) {
          setErrorCarga("No se pudo cargar la información de flujo de efectivo.");
          setValidandoAcceso(false);
        }
      }
    }

    void iniciar();
    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarDatos(ids = empresasIds, componenteActivo = true) {
    if (!ids.length) return;
    setCargando(true);
    setErrorCarga(null);

    try {
      const [movimientosResultado, fondosResultado] = await Promise.all([
        supabase
          .from("movimientos")
          .select("id,tipo,descripcion,monto,empresa,empresa_id,moneda,fecha,estado")
          .in("empresa_id", ids)
          .gte("fecha", inicioMesActual())
          .order("fecha", { ascending: false })
          .order("id", { ascending: false })
          .limit(LIMITE_MOVIMIENTOS),
        supabase
          .from("fondos_empresa")
          .select(
            "id,empresa_id,empresa,banco,cuenta_bancaria,moneda,saldo_base,saldo_comprometido,saldo_disponible,estado"
          )
          .in("empresa_id", ids)
          .order("empresa", { ascending: true }),
      ]);

      if (movimientosResultado.error || fondosResultado.error) {
        throw movimientosResultado.error || fondosResultado.error;
      }

      if (!componenteActivo) return;
      setMovimientos((movimientosResultado.data || []) as Movimiento[]);
      setFondos((fondosResultado.data || []) as Fondo[]);
      setAviso(null);
    } catch (error) {
      console.error("Error consultando movimientos y fondos:", error);
      if (componenteActivo) {
        setErrorCarga("No se pudieron consultar los movimientos y fondos disponibles.");
        setMovimientos([]);
        setFondos([]);
      }
    } finally {
      if (componenteActivo) setCargando(false);
    }
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const movimientosFiltrados = useMemo(
    () =>
      movimientos.filter(
        (item) =>
          normalizarTexto(item.estado || "activo") !== "anulado" &&
          (empresaFiltro === "todas" || Number(item.empresa_id) === Number(empresaFiltro))
      ),
    [empresaFiltro, movimientos]
  );

  const fondosFiltrados = useMemo(
    () =>
      fondos.filter(
        (item) =>
          normalizarTexto(item.estado || "activo") !== "inactivo" &&
          normalizarTexto(item.estado || "activo") !== "inactiva" &&
          (empresaFiltro === "todas" || Number(item.empresa_id) === Number(empresaFiltro))
      ),
    [empresaFiltro, fondos]
  );

  const resumenMonedas = useMemo(
    () =>
      MONEDAS.map((moneda) => {
        const movimientosMoneda = movimientosFiltrados.filter(
          (item) => normalizarMoneda(item.moneda) === moneda
        );
        const ingresos = movimientosMoneda
          .filter((item) => normalizarTexto(item.tipo) === "ingreso")
          .reduce((total, item) => total + monto(item.monto), 0);
        const egresos = movimientosMoneda
          .filter((item) => normalizarTexto(item.tipo) === "egreso")
          .reduce((total, item) => total + monto(item.monto), 0);
        const fondosMoneda = fondosFiltrados.filter(
          (item) => normalizarMoneda(item.moneda) === moneda
        );

        return {
          moneda,
          ingresos,
          egresos,
          neto: ingresos - egresos,
          movimientos: movimientosMoneda.length,
          fondos: fondosMoneda.length,
          saldoDisponible: fondosMoneda.reduce(
            (total, item) => total + monto(item.saldo_disponible),
            0
          ),
        };
      }),
    [fondosFiltrados, movimientosFiltrados]
  );

  const flujoEmpresas = useMemo(
    () =>
      empresas
        .filter(
          (empresa) => empresaFiltro === "todas" || Number(empresa.id) === Number(empresaFiltro)
        )
        .flatMap((empresa) =>
          MONEDAS.map((moneda) => {
            const filas = movimientosFiltrados.filter(
              (item) =>
                Number(item.empresa_id) === Number(empresa.id) &&
                normalizarMoneda(item.moneda) === moneda
            );
            const ingresos = filas
              .filter((item) => normalizarTexto(item.tipo) === "ingreso")
              .reduce((total, item) => total + monto(item.monto), 0);
            const egresos = filas
              .filter((item) => normalizarTexto(item.tipo) === "egreso")
              .reduce((total, item) => total + monto(item.monto), 0);
            return { empresa, moneda, ingresos, egresos, neto: ingresos - egresos };
          })
        )
        .filter((fila) => fila.ingresos !== 0 || fila.egresos !== 0),
    [empresaFiltro, empresas, movimientosFiltrados]
  );

  const ingresos = movimientosFiltrados.filter((item) => normalizarTexto(item.tipo) === "ingreso");
  const egresos = movimientosFiltrados.filter((item) => normalizarTexto(item.tipo) === "egreso");
  const auditorSoloLectura = esAuditorSoloLecturaLocal(funciones, empresasIds);

  if (validandoAcceso) return <EstadoCentro>Validando acceso...</EstadoCentro>;
  if (!autorizado) return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este módulo."}</EstadoCentro>;

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <BarChart3 className="text-cyan-500" size={42} />
                <h1 className="text-4xl font-black md:text-5xl">Flujo de efectivo y fondos</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">
                  Base operativa
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-[var(--muted)]">
                Consulta mensual de movimientos y saldos por empresa y moneda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => cargarDatos()}
              disabled={cargando || !empresasIds.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-200 disabled:opacity-50"
            >
              {cargando ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
              Actualizar
            </button>
          </header>

          <Banner />

          {auditorSoloLectura && (
            <Aviso tono="amarillo">
              Auditor solo lectura: puedes consultar la información, pero este módulo no muestra acciones de escritura.
            </Aviso>
          )}
          {aviso && <Aviso tono="amarillo">{aviso}</Aviso>}
          {errorCarga && <Aviso tono="rojo">{errorCarga}</Aviso>}

          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black">Filtro operativo</h2>
              <p className="text-sm text-[var(--muted)]">Movimientos del mes actual, sin mezclar monedas.</p>
            </div>
            <select
              value={empresaFiltro}
              onChange={(event) => setEmpresaFiltro(event.target.value)}
              className="min-w-64 rounded-xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3"
            >
              <option value="todas">Todas las empresas operativas</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          </section>

          <Panel titulo="Resumen" subtitulo="Ingresos, egresos, saldo neto, movimientos del mes y fondos activos por moneda.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {resumenMonedas.flatMap((fila) => [
                <Tarjeta key={`${fila.moneda}-ingresos`} titulo={`Ingresos ${fila.moneda}`} valor={formatoMonto(fila.ingresos, fila.moneda)} icono={<ArrowUpCircle />} />,
                <Tarjeta key={`${fila.moneda}-egresos`} titulo={`Egresos ${fila.moneda}`} valor={formatoMonto(fila.egresos, fila.moneda)} icono={<ArrowDownCircle />} />,
                <Tarjeta key={`${fila.moneda}-neto`} titulo={`Saldo neto ${fila.moneda}`} valor={formatoMonto(fila.neto, fila.moneda)} icono={<BarChart3 />} />,
                <Tarjeta key={`${fila.moneda}-fondos`} titulo={`Fondos activos ${fila.moneda}`} valor={String(fila.fondos)} detalle={`${fila.movimientos} movimientos | Disponible ${formatoMonto(fila.saldoDisponible, fila.moneda)}`} icono={<Wallet />} />,
              ])}
            </div>
          </Panel>

          <Panel titulo="Flujo por empresa" subtitulo="Resumen mensual por empresa y moneda.">
            <TablaFlujo filas={flujoEmpresas} />
          </Panel>

          <Panel titulo="Ingresos" subtitulo="Movimientos activos de ingreso registrados durante el mes actual.">
            <TablaMovimientos movimientos={ingresos} empresasPorId={empresasPorId} />
          </Panel>

          <Panel titulo="Egresos" subtitulo="Movimientos activos de egreso registrados durante el mes actual.">
            <TablaMovimientos movimientos={egresos} empresasPorId={empresasPorId} />
          </Panel>

          <Panel titulo="Fondos / cuentas" subtitulo="Consulta de saldos existentes. Estos fondos no se modifican porque pueden estar vinculados con cheques.">
            <TablaFondos fondos={fondosFiltrados} empresasPorId={empresasPorId} />
          </Panel>

          <Panel titulo="Fase posterior" subtitulo="Conexiones no incluidas en el alcance operativo inicial.">
            <p className="text-sm text-[var(--muted)]">
              Las acciones de registro, proyeccion y conciliacion se habilitaran solo despues de su validacion operativa.
            </p>
          </Panel>
        </div>
      </main>
    </div>
  );
}

function Banner() {
  return (
    <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-cyan-100">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0" size={20} />
        <p>
          Flujo de efectivo está en fase base operativa. Muestra ingresos, egresos y saldos por empresa/moneda. La conexión con pagos, cheques, conciliación y contabilidad formal se realizará en fases posteriores.
        </p>
      </div>
    </section>
  );
}

function EstadoCentro({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">{children}</div>;
}

function Aviso({ children, tono }: { children: ReactNode; tono: "amarillo" | "rojo" }) {
  const clase = tono === "rojo" ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return <section className={`rounded-2xl border p-4 ${clase}`}>{children}</section>;
}

function Panel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5"><h2 className="text-xl font-black">{titulo}</h2><p className="mt-1 text-sm text-[var(--muted)]">{subtitulo}</p><div className="mt-5">{children}</div></section>;
}

function Tarjeta({ titulo, valor, detalle, icono }: { titulo: string; valor: string; detalle?: string; icono: ReactNode }) {
  return <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between gap-3 text-cyan-400"><p className="text-sm font-semibold text-[var(--muted)]">{titulo}</p>{icono}</div><p className="mt-3 text-2xl font-black">{valor}</p>{detalle && <p className="mt-2 text-xs text-[var(--muted)]">{detalle}</p>}</article>;
}

function TablaFlujo({ filas }: { filas: Array<{ empresa: Empresa; moneda: string; ingresos: number; egresos: number; neto: number }> }) {
  if (!filas.length) return <EmptyState texto="No hay movimientos activos del mes para mostrar por empresa." />;
  return <Tabla cabeceras={["Empresa", "Moneda", "Ingresos", "Egresos", "Saldo neto"]}>{filas.map((fila) => <tr key={`${fila.empresa.id}-${fila.moneda}`}><Celda><span className="inline-flex items-center gap-2"><Building2 size={14} className="text-cyan-400" />{fila.empresa.nombre}</span></Celda><Celda>{fila.moneda}</Celda><Celda>{formatoMonto(fila.ingresos, fila.moneda)}</Celda><Celda>{formatoMonto(fila.egresos, fila.moneda)}</Celda><Celda>{formatoMonto(fila.neto, fila.moneda)}</Celda></tr>)}</Tabla>;
}

function TablaMovimientos({ movimientos, empresasPorId }: { movimientos: Movimiento[]; empresasPorId: Map<number, string> }) {
  if (!movimientos.length) return <EmptyState texto="No hay movimientos activos del mes en esta sección." />;
  return <Tabla cabeceras={["Fecha", "Empresa", "Descripción", "Moneda", "Monto", "Estado"]}>{movimientos.map((item) => <tr key={item.id}><Celda>{mostrarFecha(item.fecha)}</Celda><Celda>{empresasPorId.get(Number(item.empresa_id)) || item.empresa || "-"}</Celda><Celda>{item.descripcion || "-"}</Celda><Celda>{normalizarMoneda(item.moneda)}</Celda><Celda>{formatoMonto(monto(item.monto), normalizarMoneda(item.moneda))}</Celda><Celda>{item.estado || "activo"}</Celda></tr>)}</Tabla>;
}

function TablaFondos({ fondos, empresasPorId }: { fondos: Fondo[]; empresasPorId: Map<number, string> }) {
  if (!fondos.length) return <EmptyState texto="No hay fondos activos disponibles para el filtro seleccionado." />;
  return <Tabla cabeceras={["Empresa", "Banco / cuenta", "Moneda", "Saldo base", "Comprometido", "Disponible", "Estado"]}>{fondos.map((item) => { const moneda = normalizarMoneda(item.moneda); return <tr key={item.id}><Celda>{empresasPorId.get(Number(item.empresa_id)) || item.empresa || "-"}</Celda><Celda><span className="inline-flex items-center gap-2"><Landmark size={14} className="text-cyan-400" />{item.banco || "-"} / {item.cuenta_bancaria || "-"}</span></Celda><Celda>{moneda}</Celda><Celda>{formatoMonto(monto(item.saldo_base), moneda)}</Celda><Celda>{formatoMonto(monto(item.saldo_comprometido), moneda)}</Celda><Celda>{formatoMonto(monto(item.saldo_disponible), moneda)}</Celda><Celda>{item.estado || "activo"}</Celda></tr>; })}</Tabla>;
}

function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[var(--surface)] text-xs uppercase text-[var(--muted)]"><tr>{cabeceras.map((item) => <th key={item} className="px-4 py-3 text-left">{item}</th>)}</tr></thead><tbody className="divide-y divide-[var(--card-border)]">{children}</tbody></table></div>;
}

function Celda({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 text-[var(--muted-strong)]">{children}</td>;
}

function EmptyState({ texto }: { texto: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{texto}</div>;
}
