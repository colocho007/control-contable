"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileCheck2, FileSpreadsheet, History, Loader2, Upload, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { descargarPlantillaEmpleados, leerArchivoEmpleados, VERSION_PLANTILLA_EMPLEADOS, type FilaEmpleadoExcel } from "../lib/empleadosExcel";

type Estado = "valida" | "incompleta" | "duplicada" | "advertencia" | "rechazada";
type Accion = "crear" | "actualizar" | "ignorar" | "corregir";
interface FilaValidada extends FilaEmpleadoExcel { estado_validacion: Estado; accion_propuesta: Accion; empleado_existente_id?: string | null; errores: string[]; advertencias: string[] }
interface Resumen { total: number; validas: number; incompletas: number; duplicadas: number; advertencias: number; rechazadas: number }
interface Historial { id: string; archivo_nombre: string; estado: string; total_filas: number; creados: number; actualizados: number; omitidos: number; rechazados: number; creado_at: string }

export default function ImportarEmpleadosExcel({ empresas, habilitado, onImportado }: { empresas: Array<{ id: number; nombre: string }>; habilitado: boolean; onImportado: () => Promise<void> | void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<{ nombre: string; hash: string; tamano: number } | null>(null);
  const [filas, setFilas] = useState<FilaValidada[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  async function cargarHistorial() {
    const { data, error: e } = await supabase.from("importaciones_empleados").select("id,archivo_nombre,estado,total_filas,creados,actualizados,omitidos,rechazados,creado_at").order("creado_at", { ascending: false }).limit(10);
    if (!e) setHistorial((data || []) as Historial[]);
  }
  useEffect(() => { if (abierto) void cargarHistorial(); }, [abierto]);

  async function seleccionar(file?: File) {
    if (!file || procesando) return;
    setProcesando(true); setError(null); setResultado(null); setFilas([]); setResumen(null);
    try {
      const leido = await leerArchivoEmpleados(file);
      const { data, error: e } = await supabase.rpc("validar_importacion_empleados_v2", { p_archivo_hash: leido.hash, p_plantilla_version: VERSION_PLANTILLA_EMPLEADOS, p_filas: leido.filas });
      if (e) throw new Error("La validación segura requiere aplicar la migración V2 en Supabase.");
      const r = data as { ok?: boolean; mensaje?: string; filas?: FilaValidada[]; resumen?: Resumen };
      if (!r.ok || !r.filas || !r.resumen) throw new Error(r.mensaje || "El archivo no pudo validarse.");
      setArchivo({ nombre: leido.nombre, hash: leido.hash, tamano: leido.tamano }); setFilas(r.filas); setResumen(r.resumen);
    } catch (e) { setArchivo(null); setError(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
    finally { if (inputRef.current) inputRef.current.value = ""; setProcesando(false); }
  }

  async function confirmar() {
    if (!archivo || !filas.length || procesando) return;
    const procesables = filas.filter((f) => f.accion_propuesta === "crear" || f.accion_propuesta === "actualizar").length;
    if (!procesables) { setError("No hay filas válidas para importar."); return; }
    if (!window.confirm(`Se procesarán ${procesables} filas. ¿Deseas continuar?`)) return;
    setProcesando(true); setError(null); setResultado(null);
    try {
      const { data, error: e } = await supabase.rpc("importar_empleados_v2", {
        p_archivo_nombre: archivo.nombre, p_archivo_hash: archivo.hash, p_archivo_tamano: archivo.tamano,
        p_plantilla_version: VERSION_PLANTILLA_EMPLEADOS,
        p_idempotency_key: `empleados-importacion:${archivo.hash}:${VERSION_PLANTILLA_EMPLEADOS}`,
        p_filas: filas.map(({ errores: _e, advertencias: _a, estado_validacion: _v, accion_propuesta, ...fila }) => ({
          ...fila,
          decision_usuario: accion_propuesta,
        })),
      });
      if (e) throw new Error("No se pudo completar la importación segura.");
      const r = data as { ok?: boolean; mensaje?: string; creados?: number; actualizados?: number; omitidos?: number; rechazados?: number };
      if (!r.ok) throw new Error(r.mensaje || "La importación fue rechazada.");
      setResultado(`Resultado: ${r.creados || 0} creados, ${r.actualizados || 0} actualizados, ${r.omitidos || 0} omitidos y ${r.rechazados || 0} rechazados.`);
      await Promise.all([cargarHistorial(), onImportado()]);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo importar."); }
    finally { setProcesando(false); }
  }

  return <>
    <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setAbierto(true)}><FileSpreadsheet size={18} /> Importar empleados</button>
    {abierto && <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm md:p-8"><div className="mx-auto max-w-7xl rounded-3xl border border-[var(--card-border)] bg-[var(--background)] shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-[var(--card-border)] bg-[var(--background)] p-5"><div><h2 className="text-xl font-black">Importación controlada por Excel</h2><p className="text-sm text-[var(--muted)]">Nada se guarda hasta confirmar.</p></div><button aria-label="Cerrar" onClick={() => !procesando && setAbierto(false)}><X /></button></header>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-3"><button className="btn-secondary inline-flex items-center gap-2" onClick={() => descargarPlantillaEmpleados(empresas)}><Download size={17} /> Descargar plantilla de empleados</button><button className="btn-primary inline-flex items-center gap-2" disabled={!habilitado || procesando} onClick={() => inputRef.current?.click()}>{procesando ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />} Subir .xlsx</button><input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void seleccionar(e.target.files?.[0])} /></div>
        {!habilitado && <Aviso error>Tu perfil no puede importar empleados.</Aviso>}{error && <Aviso error>{error}</Aviso>}{resultado && <Aviso>{resultado}</Aviso>}
        {archivo && <p className="text-sm text-[var(--muted)]">{archivo.nombre} · SHA-256 {archivo.hash.slice(0, 12)}…</p>}
        {resumen && <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Object.entries(resumen).map(([k,v]) => <div key={k} className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3"><p className="text-xs capitalize text-[var(--muted)]">{k}</p><p className="text-xl font-black">{v}</p></div>)}</div>}
        {!!filas.length && <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]"><table className="w-full min-w-[1050px] text-sm"><thead><tr>{["Fila","Empleado","Empresa","Estado","Errores","Advertencias","Acción"].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{filas.map(f => <tr key={f.fila} className="border-t border-[var(--card-border)]"><td className="p-3">{f.fila}</td><td className="p-3 font-bold">{f.nombres} {f.apellidos}</td><td className="p-3">{empresas.find(e => e.id === f.empresa_id)?.nombre || f.empresa_id || "—"}</td><td className="p-3">{f.estado_validacion}</td><td className="p-3 text-red-400">{f.errores.join(" · ") || "—"}</td><td className="p-3 text-amber-300">{f.advertencias.join(" · ") || "—"}</td><td className="p-3"><select className="input-custom" value={f.accion_propuesta} disabled={!!f.errores.length} onChange={e => setFilas(xs => xs.map(x => x.fila === f.fila ? {...x, accion_propuesta:e.target.value as Accion}:x))}>{f.empleado_existente_id ? <option value="actualizar">Actualizar</option>:<option value="crear">Crear</option>}<option value="ignorar">Ignorar</option><option value="corregir">Corregir</option></select></td></tr>)}</tbody></table></div>}
        {!!filas.length && <div className="flex justify-end"><button className="btn-primary inline-flex items-center gap-2" disabled={procesando || !habilitado} onClick={() => void confirmar()}><FileCheck2 size={18} /> Confirmar importación</button></div>}
        <section><h3 className="mb-3 flex items-center gap-2 font-black"><History size={18} /> Historial de importaciones</h3>{historial.length ? historial.map(h => <div key={h.id} className="mb-2 grid gap-2 rounded-xl border border-[var(--card-border)] p-3 text-sm md:grid-cols-4"><b>{h.archivo_nombre}</b><span>{new Date(h.creado_at).toLocaleString("es-GT")}</span><span>{h.estado}</span><span>{h.creados} creados · {h.actualizados} actualizados · {h.rechazados} rechazados</span></div>):<p className="text-sm text-[var(--muted)]">Sin historial disponible o migración pendiente.</p>}</section>
      </div>
    </div></div>}
  </>;
}

function Aviso({ error, children }: { error?: boolean; children: React.ReactNode }) { return <div className={`rounded-xl border p-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-300":"border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>{children}</div>; }
