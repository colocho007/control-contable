"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface TareaAuxiliar {
  id: number;
  nombre: string;
  estado: string;
  empleado: string | null;
  usuario_id: string | null;
  empresa: string | null;
  empresa_id: number | null;
  fecha_limite: string | null;
  prioridad: string | null;
  monto: number | null;
  moneda: string | null;
}

interface DocumentoAuxiliar {
  id: string | number;
  empresa_id: number;
  modulo: string;
  tipo_documento: string;
  titulo: string | null;
  descripcion: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  numero_documento: string | null;
  numero_factura: string | null;
  numero_cheque: string | null;
  proveedor_nombre_snapshot: string | null;
  monto: number | null;
  moneda: string | null;
  sensible: boolean | null;
  estado: string | null;
  creado_at: string | null;
}

interface ChequeAuxiliar {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  numero_cheque: string | null;
  beneficiario: string | null;
  monto: number | null;
  moneda: string | null;
  estado: string | null;
  fecha_pago: string | null;
  prioridad: string | null;
  responsable_actual: string | null;
  creado_por: string | null;
  created_at: string | null;
}

const ROLES_ADMIN = ["admin", "supervisor", "jefe"];
const ESTADOS_TAREAS_AUXILIAR = ["Pendiente"];
const ESTADOS_CHEQUES_AUXILIAR = ["Pendiente de autorización", "Autorizado"];
const LIMITE_TAREAS = 12;
const LIMITE_DOCUMENTOS = 12;
const LIMITE_CHEQUES = 12;

const proximosPasos = [
  "Tomar tarea",
  "Asignación automática al auxiliar",
  "Historial de preparación",
  "Envío al contador",
  "Corrección/rechazo",
  "Evidencia obligatoria",
  "Integración con documentos y cheques",
];

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function mostrarFecha(valor?: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;

  return fecha.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatoMonto(monto?: number | null, moneda?: string | null) {
  if (monto === null || monto === undefined) return "-";
  return `${moneda || "GTQ"} ${Number(monto || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function esProximoVencimiento(fechaLimite?: string | null) {
  if (!fechaLimite) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fechaLimite.slice(0, 10)}T00:00:00`);
  const sieteDias = new Date(hoy);
  sieteDias.setDate(hoy.getDate() + 7);
  return limite >= hoy && limite <= sieteDias;
}

function claseEstado(estado?: string | null) {
  const texto = (estado || "").toLowerCase();
  if (texto.includes("autor")) return "border-green-400/30 bg-green-400/10 text-green-200";
  if (texto.includes("pend")) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  if (texto.includes("activo")) return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  return "border-white/10 bg-white/5 text-gray-300";
}

function clasePrioridad(prioridad?: string | null) {
  const texto = (prioridad || "").toLowerCase();
  if (texto.includes("alta")) return "border-red-400/30 bg-red-400/10 text-red-200";
  if (texto.includes("media")) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  return "border-green-400/30 bg-green-400/10 text-green-200";
}

export default function AuxiliarPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<TareaAuxiliar[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoAuxiliar[]>([]);
  const [cheques, setCheques] = useState<ChequeAuxiliar[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoBandeja, setCargandoBandeja] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        setValidandoAcceso(true);
        setCargandoBandeja(false);

        const acceso = await validarAccesoModuloUsuario("auxiliar");

        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );

          if (volverLogin) {
            router.replace("/login");
            return;
          }

          setMensajeBloqueo("No tienes acceso al módulo Auxiliar.");
          setAutorizado(false);
          setValidandoAcceso(false);
          return;
        }

        const user = acceso.user!;
        const perfil = acceso.perfil as Perfil;
        const idsPermitidos = await obtenerEmpresasPermitidas(user.id, perfil.rol || "");
        const empresasOperativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const idsOperativos = empresasOperativas.ids;
        const funciones = await listarFuncionesOperativasUsuario(user.id, idsOperativos);

        if (!activo) return;

        setPerfilActual(perfil);
        setEmpresas(empresasOperativas.empresas);
        setEmpresasPermitidasIds(idsOperativos);
        setFuncionesOperativas(funciones);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!idsOperativos.length) {
          setAviso("No tienes empresas operativas asignadas para consultar la bandeja del auxiliar.");
          setTareas([]);
          setDocumentos([]);
          setCheques([]);
          return;
        }

        setCargandoBandeja(true);
        await Promise.all([
          cargarTareas(idsOperativos, perfil),
          cargarDocumentos(idsOperativos),
          cargarCheques(idsOperativos, user.id, perfil.rol || ""),
        ]);
        setAviso(null);
      } catch (error) {
        console.error("Error cargando bandeja de auxiliar:", error);
        if (activo) {
          setErrorCarga("No se pudo cargar la bandeja del auxiliar.");
          setTareas([]);
          setDocumentos([]);
          setCheques([]);
          setValidandoAcceso(false);
        }
      } finally {
        if (activo) {
          setCargandoBandeja(false);
        }
      }
    }

    void iniciar();

    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarTareas(idsPermitidos: number[], perfil: Perfil) {
    let query = supabase
      .from("tareas")
      .select("id,nombre,estado,empleado,usuario_id,empresa,empresa_id,fecha_limite,prioridad,monto,moneda")
      .in("empresa_id", idsPermitidos)
      .in("estado", ESTADOS_TAREAS_AUXILIAR)
      .is("cancelada_at", null)
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .limit(LIMITE_TAREAS);

    if (!ROLES_ADMIN.includes(normalizarRol(perfil.rol))) {
      query = query.eq("usuario_id", perfil.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    setTareas((data || []) as TareaAuxiliar[]);
  }

  async function cargarDocumentos(idsPermitidos: number[]) {
    const { data, error } = await supabase
      .from("documentos_tramites")
      .select(
        "id,empresa_id,modulo,tipo_documento,titulo,descripcion,fecha_documento,fecha_vencimiento,numero_documento,numero_factura,numero_cheque,proveedor_nombre_snapshot,monto,moneda,sensible,estado,creado_at"
      )
      .in("empresa_id", idsPermitidos)
      .eq("estado", "activo")
      .order("creado_at", { ascending: false })
      .limit(LIMITE_DOCUMENTOS);

    if (error) throw error;

    setDocumentos((data || []) as DocumentoAuxiliar[]);
  }

  async function cargarCheques(idsPermitidos: number[], usuarioId: string, rol: string) {
    let query = supabase
      .from("cheques")
      .select(
        "id,empresa_id,empresa,numero_cheque,beneficiario,monto,moneda,estado,fecha_pago,prioridad,responsable_actual,creado_por,created_at"
      )
      .in("empresa_id", idsPermitidos)
      .in("estado", ESTADOS_CHEQUES_AUXILIAR)
      .order("created_at", { ascending: false })
      .limit(LIMITE_CHEQUES);

    if (!ROLES_ADMIN.includes(normalizarRol(rol))) {
      query = query.or(`creado_por.eq.${usuarioId},responsable_actual.eq.${usuarioId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    setCheques((data || []) as ChequeAuxiliar[]);
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const resumen = useMemo(
    () => ({
      tareasPendientes: tareas.length,
      documentosRevision: documentos.length,
      chequesPendientes: cheques.length,
      vencimientosProximos: tareas.filter((tarea) => esProximoVencimiento(tarea.fecha_limite)).length,
    }),
    [tareas, documentos, cheques]
  );

  const auditorSoloLectura = esAuditorSoloLecturaLocal(
    funcionesOperativas,
    empresasPermitidasIds
  );

  if (validandoAcceso) {
    return <EstadoCentro>Validando acceso...</EstadoCentro>;
  }

  if (!autorizado) {
    return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este módulo."}</EstadoCentro>;
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-white font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <CheckSquare className="text-cyan-500" size={44} />
                <h1 className="text-4xl md:text-5xl font-black">Auxiliar</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">
                  Bandeja base
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-gray-400">
                Bandeja inicial para preparación, revisión y seguimiento de tareas, documentos y cheques.
              </p>
              {perfilActual && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Operador: {perfilActual.nombre} | Rol: {perfilActual.rol}
                </p>
              )}
            </div>
          </header>

          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-cyan-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0" size={20} />
              <p>
                Este módulo centralizará el trabajo operativo del auxiliar. Por ahora algunas acciones están deshabilitadas hasta conectar el flujo completo.
              </p>
            </div>
          </section>

          {auditorSoloLectura && (
            <section className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-yellow-100">
              Auditor solo lectura: esta bandeja permanece en modo consulta y no muestra acciones reales.
            </section>
          )}

          {aviso && (
            <section className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-yellow-100">
              {aviso}
            </section>
          )}

          {errorCarga && (
            <section className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
              {errorCarga}
            </section>
          )}

          {cargandoBandeja ? (
            <section className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-cyan-300">
              <Loader2 className="animate-spin" size={24} />
              Cargando bandeja del auxiliar...
            </section>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <TarjetaResumen
                  titulo="Tareas pendientes"
                  valor={resumen.tareasPendientes}
                  detalle={tareas.length ? "Solo lectura" : "Sin datos disponibles"}
                  icono={<ClipboardList size={22} />}
                />
                <TarjetaResumen
                  titulo="Documentos por revisar"
                  valor={resumen.documentosRevision}
                  detalle={documentos.length ? "Activos recientes" : "Sin datos disponibles"}
                  icono={<FileText size={22} />}
                />
                <TarjetaResumen
                  titulo="Cheques pendientes"
                  valor={resumen.chequesPendientes}
                  detalle={cheques.length ? "Pendientes o autorizados" : "Sin datos disponibles"}
                  icono={<Wallet size={22} />}
                />
                <TarjetaResumen
                  titulo="Vencimientos próximos"
                  valor={resumen.vencimientosProximos}
                  detalle={tareas.length ? "Próximos 7 días" : "Pendiente de conectar"}
                  icono={<Clock size={22} />}
                />
              </section>

              <Panel
                titulo="Bandeja de tareas"
                subtitulo="Tareas pendientes filtradas por empresas operativas permitidas."
              >
                <TablaTareas tareas={tareas} empresasPorId={empresasPorId} />
              </Panel>

              <Panel
                titulo="Documentos por revisar"
                subtitulo="Documentos activos recientes. No se muestran rutas privadas ni URLs firmadas."
              >
                <ListaDocumentos documentos={documentos} empresasPorId={empresasPorId} />
              </Panel>

              <Panel
                titulo="Cheques por preparar"
                subtitulo="Consulta de cheques pendientes o autorizados sin modificar flujos transaccionales."
              >
                <ListaCheques cheques={cheques} empresasPorId={empresasPorId} />
              </Panel>

              <Panel titulo="Próximos pasos" subtitulo="Funciones pendientes de conexión operativa.">
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {proximosPasos.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EstadoCentro({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-center text-white">
      {children}
    </div>
  );
}

function TarjetaResumen({
  titulo,
  valor,
  detalle,
  icono,
}: {
  titulo: string;
  valor: number;
  detalle: string;
  icono: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between text-cyan-400">
        <p className="text-sm font-semibold text-gray-400">{titulo}</p>
        {icono}
      </div>
      <h2 className="text-3xl font-black">{valor}</h2>
      <p className="mt-2 text-xs text-gray-500">{detalle}</p>
    </article>
  );
}

function Panel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5">
        <h2 className="text-xl font-black">{titulo}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitulo}</p>
      </div>
      {children}
    </section>
  );
}

function TablaTareas({
  tareas,
  empresasPorId,
}: {
  tareas: TareaAuxiliar[];
  empresasPorId: Map<number, string>;
}) {
  if (!tareas.length) {
    return <EmptyState texto="Sin datos disponibles con la estructura actual." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3 text-left">Empresa</th>
            <th className="px-4 py-3 text-left">Tarea</th>
            <th className="px-4 py-3 text-left">Responsable</th>
            <th className="px-4 py-3 text-left">Fecha límite</th>
            <th className="px-4 py-3 text-left">Monto</th>
            <th className="px-4 py-3 text-left">Estado</th>
            <th className="px-4 py-3 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {tareas.map((tarea) => (
            <tr key={tarea.id} className="align-top">
              <td className="px-4 py-4 text-gray-300">
                <EmpresaTexto
                  empresaId={tarea.empresa_id}
                  empresa={tarea.empresa}
                  empresasPorId={empresasPorId}
                />
              </td>
              <td className="px-4 py-4">
                <p className="font-semibold text-white">{tarea.nombre}</p>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-bold ${clasePrioridad(tarea.prioridad)}`}>
                  {tarea.prioridad || "Sin prioridad"}
                </span>
              </td>
              <td className="px-4 py-4 text-gray-300">{tarea.empleado || tarea.usuario_id || "-"}</td>
              <td className="px-4 py-4 text-gray-300">{mostrarFecha(tarea.fecha_limite)}</td>
              <td className="px-4 py-4 text-gray-300">{formatoMonto(tarea.monto, tarea.moneda)}</td>
              <td className="px-4 py-4">
                <EstadoPill estado={tarea.estado} />
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-col gap-2">
                  <BotonProximamente label="Tomar tarea" />
                  <BotonProximamente label="Enviar a contador" />
                  <BotonProximamente label="Marcar preparado" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaDocumentos({
  documentos,
  empresasPorId,
}: {
  documentos: DocumentoAuxiliar[];
  empresasPorId: Map<number, string>;
}) {
  if (!documentos.length) {
    return <EmptyState texto="Sin datos disponibles con la estructura actual." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {documentos.map((documento) => (
        <article key={String(documento.id)} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <EstadoPill estado={documento.estado || "activo"} />
            {documento.sensible && (
              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-xs font-bold text-yellow-200">
                Sensible
              </span>
            )}
          </div>
          <h3 className="text-lg font-black">{documento.titulo || documento.descripcion || documento.tipo_documento}</h3>
          <div className="mt-3 grid gap-2 text-sm text-gray-400">
            <LineaDato label="Empresa" valor={empresasPorId.get(Number(documento.empresa_id)) || `Empresa #${documento.empresa_id}`} />
            <LineaDato label="Módulo / tipo" valor={`${documento.modulo} / ${documento.tipo_documento}`} />
            <LineaDato label="Fecha" valor={mostrarFecha(documento.fecha_documento || documento.creado_at)} />
            <LineaDato label="Factura" valor={documento.numero_factura || "-"} />
            <LineaDato label="Cheque" valor={documento.numero_cheque || "-"} />
            <LineaDato label="Proveedor" valor={documento.proveedor_nombre_snapshot || "-"} />
            <LineaDato label="Monto" valor={formatoMonto(documento.monto, documento.moneda)} />
          </div>
          <div className="mt-4">
            <BotonProximamente label="Revisar documento" />
          </div>
        </article>
      ))}
    </div>
  );
}

function ListaCheques({
  cheques,
  empresasPorId,
}: {
  cheques: ChequeAuxiliar[];
  empresasPorId: Map<number, string>;
}) {
  if (!cheques.length) {
    return <EmptyState texto="Sin datos disponibles con la estructura actual." />;
  }

  return (
    <div className="grid gap-4">
      {cheques.map((cheque) => (
        <article key={cheque.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <EstadoPill estado={cheque.estado || "-"} />
                {cheque.prioridad && (
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${clasePrioridad(cheque.prioridad)}`}>
                    {cheque.prioridad}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black">{cheque.beneficiario || "Beneficiario pendiente"}</h3>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <Building2 size={14} className="text-cyan-400" />
                  <EmpresaTexto
                    empresaId={cheque.empresa_id}
                    empresa={cheque.empresa}
                    empresasPorId={empresasPorId}
                  />
                </span>
                <span>No. cheque: {cheque.numero_cheque || "-"}</span>
                <span>Fecha: {mostrarFecha(cheque.fecha_pago || cheque.created_at)}</span>
                <span className="font-semibold text-white">{formatoMonto(cheque.monto, cheque.moneda)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <BotonProximamente label="Preparar cheque" />
              <BotonProximamente label="Enviar a revisión" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmpresaTexto({
  empresaId,
  empresa,
  empresasPorId,
}: {
  empresaId: number | null;
  empresa?: string | null;
  empresasPorId: Map<number, string>;
}) {
  if (empresaId !== null && empresaId !== undefined) {
    return <span>{empresasPorId.get(Number(empresaId)) || empresa || `Empresa #${empresaId}`}</span>;
  }

  return <span>{empresa || "-"}</span>;
}

function EstadoPill({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${claseEstado(estado)}`}>
      {estado}
    </span>
  );
}

function BotonProximamente({ label }: { label: string }) {
  void label;
  return null;
}

function LineaDato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
      <span>{label}</span>
      <span className="text-right font-semibold text-gray-200">{valor}</span>
    </div>
  );
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-400">
      {texto}
    </div>
  );
}
