"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import {
  esEmpresaOperativaVisible,
  obtenerEmpresasOperativasDesdeIds,
} from "../../lib/empresasOperativas";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { toast, Toaster } from "react-hot-toast";

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  LogOut,
  TrendingUp,
  UserRound,
  Wallet,
  ArrowUpRight,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  CartesianGrid,
} from "recharts";

interface Tarea {
  id: number;
  nombre?: string;
  titulo?: string;
  estado: string;
  empresa_id: number | null;
  empresa?: string | null;
  empleado?: string | null;
  fecha_limite?: string | null;
}

interface Movimiento {
  id: number;
  monto: number;
  tipo: string;
  fecha: string;
  empresa_id: number | null;
  empresa?: string | null;
  estado?: string | null;
}

interface OrdenCompra {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  numero_orden: string | null;
  proveedor: string | null;
  encargado: string | null;
  fecha_necesaria: string | null;
  estado: string;
}

interface Cheque {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  numero_cheque: string | null;
  beneficiario: string | null;
  responsable_actual: string | null;
  fecha_pago: string | null;
  estado: string;
}

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

type Semaforo = "verde" | "amarillo" | "rojo";

interface AlertaProceso {
  id: string;
  tipo: string;
  descripcion: string;
  empresaId: number | null;
  empresa: string;
  responsable: string;
  fecha: string;
  semaforo: Semaforo;
}

function estadoNormalizado(estado?: string | null) {
  return (estado || "").trim().toLowerCase();
}

function tareaPendiente(tarea: Tarea) {
  return !["completado", "cancelada", "anulado", "anulada"].includes(
    estadoNormalizado(tarea.estado)
  );
}

function ordenPendiente(orden: OrdenCompra) {
  return !["aprobada", "anulada", "cancelada", "rechazada"].includes(
    estadoNormalizado(orden.estado)
  );
}

function chequePendiente(cheque: Cheque) {
  return !["pagado", "anulado", "rechazado"].includes(
    estadoNormalizado(cheque.estado)
  );
}

function obtenerSemaforo(fecha?: string | null): Semaforo | null {
  if (!fecha) return null;

  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);

  if (!anio || !mes || !dia) return null;

  const fechaProceso = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil(
    (fechaProceso.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diasRestantes < 0) return "rojo";
  if (diasRestantes <= 3) return "amarillo";
  return "verde";
}

export default function DashboardPage() {
  const router = useRouter();

  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoDashboard, setCargandoDashboard] = useState(false);
  const [tiempoAgotado, setTiempoAgotado] = useState(false);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [perfil, setPerfil] = useState({ nombre: "", rol: "" });
  const [autorizado, setAutorizado] = useState(false);
  const [empresasPermitidas, setEmpresasPermitidas] = useState<number[]>([]);
  const [esAdmin, setEsAdmin] = useState(false);

  // Referencias para evitar re-suscripciones innecesarias en Realtime
  const empresasRef = useRef(empresasPermitidas);

  empresasRef.current = empresasPermitidas;

  useEffect(() => {
    inicializarDashboard();
  }, [router]);

  useEffect(() => {
    if (!autorizado || !empresasPermitidas.length) return;

    const filtroEmpresas = `empresa_id=in.(${empresasPermitidas.join(",")})`;

    const channel = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tareas", filter: filtroEmpresas },
        () => obtenerTareas(empresasPermitidas)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimientos", filter: filtroEmpresas },
        () => obtenerFinanzas(empresasPermitidas)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordenes_compra", filter: filtroEmpresas },
        () => obtenerOrdenes(empresasPermitidas)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cheques", filter: filtroEmpresas },
        () => obtenerCheques(empresasPermitidas)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autorizado, empresasPermitidas]);

  async function inicializarDashboard() {
    setValidandoAcceso(true);
    setCargandoDashboard(false);

    const acceso = await validarAccesoModuloUsuario("dashboard");

    if (!acceso.ok) {
      if (
        acceso.motivo === "sin_sesion" ||
        acceso.motivo === "sin_perfil" ||
        acceso.motivo === "usuario_inactivo"
      ) {
        if (acceso.motivo === "usuario_inactivo") {
          toast.error("Tu usuario está inactivo. Contacta al administrador.");
        }
      } else if (
        acceso.motivo === "modulo_inactivo" ||
        acceso.motivo === "modulo_no_encontrado"
      ) {
        toast.error("El módulo Dashboard está desactivado.");
      } else {
        toast.error("No tienes acceso al módulo Dashboard.");
      }

      setAutorizado(false);
      setValidandoAcceso(false);
      router.replace("/login");
      return;
    }

    const user = acceso.user!;
    const p = acceso.perfil!;

    // Admin normalizado para evitar errores si viene como Admin, ADMIN o con espacios
    const admin = (p.rol || "").trim().toLowerCase() === "admin";

    setPerfil({
      nombre: p.nombre || "Usuario",
      rol: p.rol || "sin rol",
    });

    setEsAdmin(admin);
    setCargandoDashboard(true);
    setAutorizado(true);
    setValidandoAcceso(false);

    try {
      const idsPermitidos = await obtenerEmpresasPermitidas(user.id, p.rol);
      const empresasOperativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
      const empresas = empresasOperativas.ids;

      setEmpresasPermitidas(empresas);
      setEmpresas(empresasOperativas.empresas);

      await Promise.all([
        obtenerTareas(empresas),
        obtenerFinanzas(empresas),
        obtenerOrdenes(empresas),
        obtenerCheques(empresas),
      ]);
    } catch (error) {
      console.error("Error cargando datos del dashboard:", error);
      toast.error("Error cargando datos del dashboard");
    } finally {
      setCargandoDashboard(false);
    }
  }

  async function obtenerTareas(empresasParam = empresasRef.current) {
    if (!empresasParam.length) {
      setTareas([]);
      return;
    }

    const { data, error } = await supabase
      .from("tareas")
      .select("id,nombre,estado,empresa_id,empresa,empleado,fecha_limite")
      .in("empresa_id", empresasParam)
      .order("id", { ascending: false });

    if (error) {
      console.error("Error obteniendo tareas:", error);
      toast.error("Error cargando tareas");
      return;
    }

    if (data) setTareas(data);
  }

  async function obtenerFinanzas(empresasParam = empresasRef.current) {
    if (!empresasParam.length) {
      setMovimientos([]);
      return;
    }

    const { data, error } = await supabase
      .from("movimientos")
      .select("id,monto,tipo,fecha,empresa_id,empresa,estado")
      .in("empresa_id", empresasParam)
      .order("fecha", { ascending: true });

    if (error) {
      console.error("Error obteniendo movimientos:", error);
      toast.error("Error cargando movimientos");
      return;
    }

    if (data) setMovimientos(data);
  }

  async function obtenerOrdenes(empresasParam = empresasRef.current) {
    if (!empresasParam.length) {
      setOrdenes([]);
      return;
    }

    const { data, error } = await supabase
      .from("ordenes_compra")
      .select(
        "id,empresa_id,empresa,numero_orden,proveedor,encargado,fecha_necesaria,estado"
      )
      .in("empresa_id", empresasParam)
      .order("id", { ascending: false });

    if (error) {
      console.error("Error obteniendo ordenes:", error);
      toast.error("Error cargando ordenes de compra");
      return;
    }

    setOrdenes(data || []);
  }

  async function obtenerCheques(empresasParam = empresasRef.current) {
    if (!empresasParam.length) {
      setCheques([]);
      return;
    }

    const { data, error } = await supabase
      .from("cheques")
      .select(
        "id,empresa_id,empresa,numero_cheque,beneficiario,responsable_actual,fecha_pago,estado"
      )
      .in("empresa_id", empresasParam)
      .order("id", { ascending: false });

    if (error) {
      console.error("Error obteniendo cheques:", error);
      toast.error("Error cargando cheques");
      return;
    }

    setCheques(data || []);
  }

  async function obtenerNombresEmpresas(empresasParam = empresasRef.current) {
    if (!empresasParam.length) {
      setEmpresas([]);
      return;
    }

    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre,estado")
      .in("id", empresasParam)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error obteniendo empresas:", error);
      toast.error("Error cargando empresas");
      return;
    }

    setEmpresas(((data || []) as Empresa[]).filter(esEmpresaOperativaVisible));
  }

  const movimientosActivos = useMemo(
    () =>
      movimientos.filter(
        (movimiento) => estadoNormalizado(movimiento.estado) !== "anulado"
      ),
    [movimientos]
  );

  const tareasVigentes = useMemo(
    () =>
      tareas.filter(
        (tarea) =>
          !["cancelada", "anulado", "anulada"].includes(
            estadoNormalizado(tarea.estado)
          )
      ),
    [tareas]
  );

  const tareasPendientesActivas = useMemo(
    () => tareasVigentes.filter(tareaPendiente),
    [tareasVigentes]
  );

  const ordenesPendientesActivas = useMemo(
    () => ordenes.filter(ordenPendiente),
    [ordenes]
  );

  const chequesPendientesActivos = useMemo(
    () => cheques.filter(chequePendiente),
    [cheques]
  );

  const procesosConFecha = useMemo(() => {
    const alertas: AlertaProceso[] = [];

    tareasPendientesActivas.forEach((tarea) => {
      const semaforo = obtenerSemaforo(tarea.fecha_limite);

      if (!semaforo || !tarea.fecha_limite) return;

      alertas.push({
        id: `tarea-${tarea.id}`,
        tipo: "Tarea",
        descripcion: tarea.nombre || tarea.titulo || "Tarea sin nombre",
        empresaId: tarea.empresa_id,
        empresa: tarea.empresa || "Empresa no identificada",
        responsable: tarea.empleado || "Sin responsable",
        fecha: tarea.fecha_limite,
        semaforo,
      });
    });

    ordenesPendientesActivas.forEach((orden) => {
      const semaforo = obtenerSemaforo(orden.fecha_necesaria);

      if (!semaforo || !orden.fecha_necesaria) return;

      alertas.push({
        id: `orden-${orden.id}`,
        tipo: "Orden",
        descripcion:
          orden.numero_orden || orden.proveedor || `Orden #${orden.id}`,
        empresaId: orden.empresa_id,
        empresa: orden.empresa || "Empresa no identificada",
        responsable: orden.encargado || "Sin responsable",
        fecha: orden.fecha_necesaria,
        semaforo,
      });
    });

    chequesPendientesActivos.forEach((cheque) => {
      const semaforo = obtenerSemaforo(cheque.fecha_pago);

      if (!semaforo || !cheque.fecha_pago) return;

      alertas.push({
        id: `cheque-${cheque.id}`,
        tipo: "Cheque",
        descripcion:
          cheque.numero_cheque || cheque.beneficiario || `Cheque #${cheque.id}`,
        empresaId: cheque.empresa_id,
        empresa: cheque.empresa || "Empresa no identificada",
        responsable: cheque.responsable_actual || "Sin responsable",
        fecha: cheque.fecha_pago,
        semaforo,
      });
    });

    const prioridad: Record<Semaforo, number> = {
      rojo: 0,
      amarillo: 1,
      verde: 2,
    };

    return alertas.sort(
      (a, b) =>
        prioridad[a.semaforo] - prioridad[b.semaforo] ||
        a.fecha.localeCompare(b.fecha)
    );
  }, [tareasPendientesActivas, ordenesPendientesActivas, chequesPendientesActivos]);

  const procesosVencidos = procesosConFecha.filter(
    (proceso) => proceso.semaforo === "rojo"
  );
  const procesosPorVencer = procesosConFecha.filter(
    (proceso) => proceso.semaforo === "amarillo"
  );
  const procesosEnTiempo = procesosConFecha.filter(
    (proceso) => proceso.semaforo === "verde"
  );
  const alertasCriticas = procesosConFecha.filter(
    (proceso) => proceso.semaforo !== "verde"
  );
  const tareasVencidas = procesosVencidos.filter(
    (proceso) => proceso.tipo === "Tarea"
  );
  const pagosPorVencer = procesosPorVencer.filter(
    (proceso) => proceso.tipo === "Cheque"
  );

  const responsablesAtrasados = useMemo(() => {
    const resumen = new Map<
      string,
      { responsable: string; total: number; tareas: number; ordenes: number; cheques: number }
    >();

    procesosVencidos.forEach((proceso) => {
      const actual = resumen.get(proceso.responsable) || {
        responsable: proceso.responsable,
        total: 0,
        tareas: 0,
        ordenes: 0,
        cheques: 0,
      };

      actual.total += 1;

      if (proceso.tipo === "Tarea") actual.tareas += 1;
      if (proceso.tipo === "Orden") actual.ordenes += 1;
      if (proceso.tipo === "Cheque") actual.cheques += 1;

      resumen.set(proceso.responsable, actual);
    });

    return Array.from(resumen.values()).sort((a, b) => b.total - a.total);
  }, [procesosVencidos]);

  const resumenPorEmpresa = useMemo(() => {
    return empresas
      .map((empresa) => {
        const movimientosEmpresa = movimientosActivos.filter(
          (movimiento) => Number(movimiento.empresa_id) === empresa.id
        );
        const ingresos = movimientosEmpresa
          .filter((movimiento) => movimiento.tipo === "Ingreso")
          .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);
        const egresos = movimientosEmpresa
          .filter((movimiento) => movimiento.tipo === "Egreso")
          .reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0);

        return {
          id: empresa.id,
          nombre: empresa.nombre,
          movimientos: movimientosEmpresa.length,
          balance: ingresos - egresos,
          tareas: tareasPendientesActivas.filter(
            (tarea) => Number(tarea.empresa_id) === empresa.id
          ).length,
          ordenes: ordenesPendientesActivas.filter(
            (orden) => Number(orden.empresa_id) === empresa.id
          ).length,
          cheques: chequesPendientesActivos.filter(
            (cheque) => Number(cheque.empresa_id) === empresa.id
          ).length,
          vencidos: procesosVencidos.filter(
            (proceso) => Number(proceso.empresaId) === empresa.id
          ).length,
        };
      })
      .sort(
        (a, b) =>
          b.movimientos - a.movimientos ||
          b.vencidos - a.vencidos ||
          a.nombre.localeCompare(b.nombre)
      );
  }, [
    empresas,
    movimientosActivos,
    tareasPendientesActivas,
    ordenesPendientesActivas,
    chequesPendientesActivos,
    procesosVencidos,
  ]);

  const empresaConMasMovimientos = resumenPorEmpresa[0];

  const stats = useMemo(() => {
    const completadas = tareasVigentes.filter(
      (t) => t.estado === "Completado"
    ).length;

    const ingresos = movimientosActivos
      .filter((m) => m.tipo === "Ingreso")
      .reduce((acc, cur) => acc + Number(cur.monto || 0), 0);

    const egresos = movimientosActivos
      .filter((m) => m.tipo === "Egreso")
      .reduce((acc, cur) => acc + Number(cur.monto || 0), 0);

    return {
      completadas,
      pendientes: tareasPendientesActivas.length,
      totalTareas: tareasVigentes.length,
      progreso:
        tareasVigentes.length > 0
          ? Math.floor((completadas / tareasVigentes.length) * 100)
          : 0,
      balance: ingresos - egresos,
      ingresos,
      egresos,
    };
  }, [tareasVigentes, tareasPendientesActivas, movimientosActivos]);

  const pieData = [
    { name: "Completadas", value: stats.completadas },
    { name: "Pendientes", value: stats.pendientes },
  ];

  const COLORS = ["#06b6d4", "#1e293b"];

  if (validandoAcceso) {
    return (
      <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        {!tiempoAgotado ? (
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 bg-cyan-500/20 rounded-full mb-6 flex items-center justify-center border border-cyan-500/30">
               <Clock3 className="text-cyan-500 animate-spin" size={32} />
            </div>
            <p className="text-cyan-500 font-mono tracking-widest uppercase text-sm">
              Validando credenciales de acceso...
            </p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md bg-white/5 border border-white/10 p-8 rounded-[2rem] backdrop-blur-xl"
          >
            <AlertTriangle className="text-amber-400 mx-auto mb-4" size={48} />
            <h2 className="text-xl font-bold mb-2">La validación está tardando más de lo esperado</h2>
            <p className="text-gray-400 text-sm mb-6">
              Esto puede deberse a una conexión lenta o un problema temporal con los servicios.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors"
              >
                Reintentar carga
              </button>
              <button
                onClick={() => router.push("/login")}
                className="w-full h-12 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-colors border border-white/10"
              >
                Volver al login
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="h-screen w-full bg-[#020617] flex items-center justify-center text-white">
        Sin acceso autorizado.
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] text-white min-h-screen">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#fff",
            border: "1px solid #1e293b",
          },
        }}
      />

      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h1 className="text-6xl font-black tracking-tighter">
                Hola,{" "}
                <span className="text-cyan-500">
                  {perfil.nombre.split(" ")[0]}
                </span>{" "}
                👋
              </h1>

              <p className="text-gray-400 text-lg mt-2 font-medium">
                {new Intl.DateTimeFormat("es-GT", {
                  dateStyle: "full",
                }).format(new Date())}
              </p>

              <p className="text-xs text-gray-500 mt-2">
                {cargandoDashboard
                  ? "Cargando alcance de datos..."
                  : esAdmin
                  ? "Vista global de todas las empresas"
                  : `Vista filtrada por ${empresasPermitidas.length} empresa(s) asignada(s)`}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/10">
              <div className="flex items-center gap-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black shadow-lg shadow-cyan-500/20">
                  {perfil.nombre.charAt(0)}
                </div>

                <div>
                  <p className="text-sm font-bold leading-none">
                    {perfil.nombre}
                  </p>
                  <p className="text-[10px] text-cyan-500 uppercase font-black tracking-widest mt-1">
                    {perfil.rol}
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();

                  if (!error) {
                    router.push("/login");
                  } else {
                    console.error("Error al cerrar sesión:", error);
                    toast.error("Error al cerrar sesión");
                  }
                }}
                className="p-4 hover:bg-red-500/20 text-red-400 rounded-2xl transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* RESUMEN EJECUTIVO */}
          <section className="mb-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Resumen ejecutivo</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Plazos calculados sobre tareas, órdenes y fechas de pago de cheques.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs font-bold">
                <SemaforoBadge estado="verde" texto="En tiempo" />
                <SemaforoBadge estado="amarillo" texto="Por vencer" />
                <SemaforoBadge estado="rojo" texto="Vencido" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              <ExecutiveCard
                title="Cheques pendientes"
                value={chequesPendientesActivos.length}
                icon={<CreditCard size={18} />}
                color="text-cyan-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="Órdenes pendientes"
                value={ordenesPendientesActivas.length}
                icon={<FileText size={18} />}
                color="text-purple-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="Tareas pendientes"
                value={tareasPendientesActivas.length}
                icon={<Activity size={18} />}
                color="text-cyan-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="Tareas vencidas"
                value={tareasVencidas.length}
                icon={<AlertTriangle size={18} />}
                color="text-red-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="Pagos por vencer"
                value={pagosPorVencer.length}
                icon={<Clock3 size={18} />}
                color="text-yellow-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="Procesos vencidos"
                value={procesosVencidos.length}
                icon={<AlertTriangle size={18} />}
                color="text-red-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="Por vencer"
                value={procesosPorVencer.length}
                icon={<Clock3 size={18} />}
                color="text-yellow-400"
                loading={cargandoDashboard}
              />
              <ExecutiveCard
                title="En tiempo"
                value={procesosEnTiempo.length}
                icon={<CheckCircle2 size={18} />}
                color="text-green-400"
                loading={cargandoDashboard}
              />
            </div>
          </section>

          {/* STATS FINANCIERAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard
              title="Balance Neto"
              value={`Q${stats.balance.toLocaleString("es-GT")}`}
              icon={<Wallet />}
              color="text-white"
              loading={cargandoDashboard}
            />

            <StatCard
              title="Ingresos Totales"
              value={`Q${stats.ingresos.toLocaleString("es-GT")}`}
              icon={<TrendingUp />}
              color="text-green-400"
              loading={cargandoDashboard}
            />

            <StatCard
              title="Movimientos"
              value={movimientosActivos.length}
              icon={<Activity />}
              color="text-cyan-400"
              loading={cargandoDashboard}
            />

            <StatCard
              title="Cumplimiento"
              value={`${stats.progreso}%`}
              icon={<CheckCircle2 />}
              color="text-purple-400"
              loading={cargandoDashboard}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* GRÁFICO */}
            <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold">Flujo de Efectivo</h3>
                  <p className="text-gray-500 text-sm italic">
                    Historial de movimientos registrados
                  </p>
                </div>

                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-xs font-bold">
                  <ArrowUpRight size={14} /> Control+
                </div>
              </div>

              <div className="min-h-[350px] w-full flex items-center justify-center">
                {cargandoDashboard ? (
                  <CargandoDatos mensaje="Cargando historial de flujo..." />
                ) : movimientosActivos.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">
                    Sin movimientos registrados en este periodo.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={movimientosActivos}>
                    <defs>
                      <linearGradient
                        id="colorCash"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#06b6d4"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#06b6d4"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff05"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="fecha"
                      stroke="#475569"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) =>
                        new Date(val).toLocaleDateString("es-GT", {
                          day: "2-digit",
                          month: "short",
                        })
                      }
                    />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderRadius: "16px",
                        border: "1px solid #334155",
                      }}
                      itemStyle={{ color: "#06b6d4" }}
                      formatter={(value) => [
                        `Q${Number(value).toLocaleString("es-GT")}`,
                        "Monto",
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="monto"
                      stroke="#06b6d4"
                      strokeWidth={4}
                      fill="url(#colorCash)"
                    />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* DISTRIBUCIÓN Y TAREAS */}
            <div className="space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                <h3 className="text-xl font-bold mb-4">
                  Estado de Operaciones
                </h3>

                <div className="min-h-[200px] flex items-center justify-center">
                  {cargandoDashboard ? (
                    <CargandoDatos mensaje="Analizando tareas..." />
                  ) : stats.totalTareas === 0 ? (
                    <p className="text-gray-500 text-xs italic text-center">
                      No hay tareas vigentes <br /> asignadas.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i]} stroke="none" />
                          ))}
                        </Pie>

                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {!cargandoDashboard && stats.totalTareas > 0 && (
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 bg-cyan-500 rounded-full" />{" "}
                      Completadas
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 bg-slate-800 rounded-full" />{" "}
                      Pendientes
                    </div>
                  </div>
                )}
              </div>

              {/* LISTA RÁPIDA */}
              <div className="bg-cyan-500 rounded-[2.5rem] p-8 text-black">
                <h3 className="text-xl font-black mb-4">Próximos Pasos</h3>

                <div className="space-y-3">
                  {cargandoDashboard && (
                    <p className="text-sm font-bold text-black/70">
                      Cargando datos...
                    </p>
                  )}

                  {!cargandoDashboard && (
                    <>
                      {tareasPendientesActivas.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3"
                    >
                      <div className="bg-white rounded-lg p-1">
                        {t.estado === "Completado" ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Clock3 size={16} />
                        )}
                      </div>

                      <p className="text-sm font-bold truncate">
                        {t.nombre || t.titulo || "Tarea sin nombre"}
                      </p>
                    </div>
                  ))}

                      {tareasPendientesActivas.length === 0 && (
                    <p className="text-sm font-bold text-black/70">
                      No hay tareas pendientes para tus empresas asignadas.
                    </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-10">
            <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold">Alertas críticas</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Procesos vencidos o con vencimiento en los próximos 3 días.
                  </p>
                </div>
                <AlertTriangle className="text-red-400" size={24} />
              </div>

              <div className="space-y-3">
                {cargandoDashboard ? (
                  <CargandoDatos />
                ) : (
                  <>
                    {alertasCriticas.slice(0, 10).map((alerta) => (
                  <div
                    key={alerta.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a]/80 border border-white/10 rounded-2xl p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <SemaforoBadge
                          estado={alerta.semaforo}
                          texto={alerta.semaforo === "rojo" ? "Vencido" : "Por vencer"}
                        />
                        <span className="text-[10px] text-gray-500 uppercase font-black">
                          {alerta.tipo}
                        </span>
                      </div>
                      <p className="font-bold truncate">{alerta.descripcion}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {alerta.empresa} | Responsable: {alerta.responsable}
                      </p>
                    </div>

                    <div className="text-sm text-gray-300 shrink-0">
                      {formatearFecha(alerta.fecha)}
                    </div>
                  </div>
                ))}

                    {alertasCriticas.length === 0 && (
                  <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-5 text-green-400 text-sm font-bold">
                    No hay procesos vencidos ni próximos a vencer.
                  </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3 mb-6">
                <UserRound className="text-red-400" size={22} />
                <div>
                  <h3 className="text-xl font-bold">Responsables con pendientes</h3>
                  <p className="text-xs text-gray-500">Procesos vencidos</p>
                </div>
              </div>

              <div className="space-y-3">
                {cargandoDashboard ? (
                  <CargandoDatos />
                ) : (
                  <>
                    {responsablesAtrasados.slice(0, 8).map((responsable) => (
                  <div
                    key={responsable.responsable}
                    className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="font-bold text-sm truncate">
                        {responsable.responsable}
                      </p>
                      <span className="text-red-400 font-black">
                        {responsable.total}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Tareas: {responsable.tareas} | Órdenes: {responsable.ordenes} | Cheques: {responsable.cheques}
                    </p>
                  </div>
                ))}

                    {responsablesAtrasados.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No hay responsables con procesos vencidos.
                  </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mt-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <Building2 className="text-cyan-400" size={22} />
                  <h3 className="text-2xl font-bold">Resumen por empresa</h3>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Empresas ordenadas por cantidad de movimientos registrados.
                </p>
              </div>

              {!cargandoDashboard && empresaConMasMovimientos && (
                <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 text-sm">
                  <p className="text-[10px] uppercase font-black text-gray-500">
                    Mayor actividad
                  </p>
                  <p className="font-bold text-cyan-400">
                    {empresaConMasMovimientos.nombre} ({empresaConMasMovimientos.movimientos})
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {cargandoDashboard ? (
                <CargandoDatos />
              ) : (
                <>
                  {resumenPorEmpresa.map((empresa) => (
                <div
                  key={empresa.id}
                  className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center rounded-2xl border border-white/10 bg-[#0f172a]/80 p-4"
                >
                  <div className="col-span-2">
                    <p className="font-bold">{empresa.nombre}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Balance: Q{empresa.balance.toLocaleString("es-GT")}
                    </p>
                  </div>
                  <ResumenDato label="Movimientos" value={empresa.movimientos} />
                  <ResumenDato label="Tareas" value={empresa.tareas} />
                  <ResumenDato label="Órdenes" value={empresa.ordenes} />
                  <ResumenDato
                    label="Cheques / Vencidos"
                    value={`${empresa.cheques} / ${empresa.vencidos}`}
                    alerta={empresa.vencidos > 0}
                  />
                </div>
              ))}

                  {resumenPorEmpresa.length === 0 && (
                <p className="text-sm text-gray-500">
                  No hay empresas asignadas para mostrar resumen.
                </p>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);

  if (!anio || !mes || !dia) return fecha;

  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(anio, mes - 1, dia));
}

function SemaforoBadge({
  estado,
  texto,
}: {
  estado: Semaforo;
  texto: string;
}) {
  const estilos = {
    verde: "bg-green-500/10 border-green-500/30 text-green-400",
    amarillo: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    rojo: "bg-red-500/10 border-red-500/30 text-red-400",
  };

  const puntos = {
    verde: "bg-green-400",
    amarillo: "bg-yellow-400",
    rojo: "bg-red-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${estilos[estado]}`}
    >
      <span className={`h-2 w-2 rounded-full ${puntos[estado]}`} />
      {texto}
    </span>
  );
}

function CargandoDatos({ mensaje = "Cargando datos..." }: { mensaje?: string }) {
  return (
    <div className="min-h-[100px] h-full flex flex-col items-center justify-center gap-3 text-sm font-medium text-gray-500">
      <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      <span>{mensaje}</span>
    </div>
  );
}

function ExecutiveCard({
  title,
  value,
  icon,
  color,
  loading = false,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-gray-500 mb-3">
        {icon}
      </div>
      <p className="text-[10px] uppercase font-black tracking-wider text-gray-500 min-h-[2rem]">
        {title}
      </p>
      <p className={`text-3xl font-black mt-1 ${color}`}>
        {loading ? (
          <span className="text-sm text-gray-500">Cargando...</span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

function ResumenDato({
  label,
  value,
  alerta = false,
}: {
  label: string;
  value: string | number;
  alerta?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase font-black">{label}</p>
      <p className={`font-bold mt-1 ${alerta ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  loading = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex flex-col gap-4 shadow-lg shadow-black/20"
    >
      <div className="bg-white/5 w-12 h-12 rounded-2xl flex items-center justify-center text-cyan-400">
        {icon}
      </div>

      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
          {title}
        </p>
        <h2 className={`text-3xl font-black mt-1 ${color}`}>
          {loading ? (
            <span className="text-sm text-gray-500">Cargando...</span>
          ) : (
            value
          )}
        </h2>
      </div>
    </motion.div>
  );
}
