"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ExternalLink, FileText, Loader2, Paperclip, RefreshCcw, UploadCloud } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  desactivarDocumento,
  listarDocumentosTramite,
  obtenerUrlDocumento,
  subirDocumentoTramite,
  type DocumentoTramite,
} from "../lib/documentosTramites";
import { registrarAuditoriaEvento } from "../lib/auditoria";

type DocumentosEntidadProps = {
  empresaId?: number | null;
  modulo: string;
  entidadTipo: string;
  entidadId?: string | number | null;
  titulo?: string;
  numeroFactura?: string | null;
  numeroCheque?: string | null;
  proveedorNombre?: string | null;
  monto?: number | null;
  moneda?: string | null;
  tiposDocumento?: string[];
  disabled?: boolean;
  soloLectura?: boolean;
};

const TIPOS_DEFAULT = ["Documento", "Otro"];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}

function formatFecha(fecha?: string | null) {
  if (!fecha) return "Sin fecha";
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return fecha;
  return parsed.toLocaleDateString("es-GT");
}

function formatMonto(monto?: number | null, moneda?: string | null) {
  if (monto === null || monto === undefined || Number.isNaN(Number(monto))) return null;
  return `${moneda || "GTQ"} ${Number(monto).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DocumentosEntidad({
  empresaId,
  modulo,
  entidadTipo,
  entidadId,
  titulo = "Documentos",
  numeroFactura,
  numeroCheque,
  proveedorNombre,
  monto,
  moneda,
  tiposDocumento,
  disabled = false,
  soloLectura = false,
}: DocumentosEntidadProps) {
  const tiposDisponibles = useMemo(
    () => (tiposDocumento && tiposDocumento.length > 0 ? tiposDocumento : TIPOS_DEFAULT),
    [tiposDocumento],
  );

  const [documentos, setDocumentos] = useState<DocumentoTramite[]>([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | number | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState(tiposDisponibles[0] || "Documento");
  const [tituloDocumento, setTituloDocumento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [sensible, setSensible] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const empresaIdValida = typeof empresaId === "number" && Number.isFinite(empresaId) && empresaId > 0;
  const entidadIdValida = entidadId !== null && entidadId !== undefined && String(entidadId).trim() !== "";
  const puedeGestionar = !disabled && !soloLectura && empresaIdValida && entidadIdValida;
  const montoFormateado = formatMonto(monto, moneda);

  useEffect(() => {
    if (!tiposDisponibles.includes(tipoDocumento)) {
      setTipoDocumento(tiposDisponibles[0] || "Documento");
    }
  }, [tipoDocumento, tiposDisponibles]);

  const cargarDocumentos = useCallback(async () => {
    if (!puedeGestionar) {
      setDocumentos([]);
      return;
    }

    setCargando(true);
    try {
      const entidadIdActual = entidadId as string | number;
      const data = await listarDocumentosTramite({
        empresa_id: Number(empresaId),
        modulo,
        entidad_tipo: entidadTipo,
        entidad_id: entidadIdActual,
        limite: 50,
      });
      setDocumentos(data);
    } catch (error) {
      console.error("Error al cargar documentos relacionados:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setCargando(false);
    }
  }, [empresaId, entidadId, entidadTipo, modulo, puedeGestionar]);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  const limpiarFormulario = () => {
    setArchivo(null);
    setTituloDocumento("");
    setDescripcion("");
    setFechaDocumento("");
    setSensible(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const subirDocumento = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!puedeGestionar) {
      toast.error("Guarda primero el registro antes de adjuntar documentos.");
      return;
    }

    if (!archivo) {
      toast.error("Selecciona un archivo para subir.");
      return;
    }

    if (!tipoDocumento.trim()) {
      toast.error("Selecciona el tipo de documento.");
      return;
    }

    setSubiendo(true);
    try {
      const entidadIdActual = entidadId as string | number;
      await subirDocumentoTramite({
        archivo,
        empresa_id: Number(empresaId),
        modulo,
        entidad_tipo: entidadTipo,
        entidad_id: entidadIdActual,
        tipo_documento: tipoDocumento.trim(),
        titulo: tituloDocumento.trim() || archivo.name,
        descripcion: descripcion.trim() || null,
        fecha_documento: fechaDocumento || null,
        numero_factura: numeroFactura || null,
        numero_cheque: numeroCheque || null,
        proveedor_nombre_snapshot: proveedorNombre || null,
        monto: monto ?? null,
        moneda: moneda || null,
        sensible,
        metadatos: {
          origen: "modulo_relacionado",
          modulo,
          entidad_tipo: entidadTipo,
          entidad_id: String(entidadIdActual),
        },
      });

      toast.success("Documento adjuntado correctamente.");
      limpiarFormulario();
      setMostrarFormulario(false);
      await cargarDocumentos();
    } catch (error) {
      console.error("Error al subir documento relacionado:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setSubiendo(false);
    }
  };

  const abrirDocumento = async (documento: DocumentoTramite) => {
    setProcesandoId(documento.id);
    try {
      const url = await obtenerUrlDocumento(documento);
      await registrarAuditoriaEvento({
        empresa_id: documento.empresa_id,
        modulo: documento.modulo,
        accion: "abrir_documento_relacionado",
        entidad_tipo: documento.entidad_tipo || "documento_tramite",
        entidad_id: documento.entidad_id || documento.id,
        descripcion: "Documento relacionado abierto con URL temporal segura",
        sensible: true,
        metadatos: {
          documento_id: documento.id,
          tipo_documento: documento.tipo_documento,
          archivo_nombre: documento.archivo_nombre,
          bucket_privado: documento.archivo_bucket,
          usa_signed_url: true,
        },
        origen: "componente_documentos_entidad",
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const mensaje = getErrorMessage(error);
      console.error("Error al abrir documento:", error);
      toast.error(mensaje);
      if (mensaje.toLowerCase().includes("desactivado") || mensaje.toLowerCase().includes("no está disponible")) {
        await cargarDocumentos();
      }
    } finally {
      setProcesandoId(null);
    }
  };

  const desactivar = async (documento: DocumentoTramite) => {
    if (soloLectura) {
      toast.error("El auditor solo lectura no puede desactivar documentos.");
      return;
    }

    const confirmar = window.confirm("¿Deseas desactivar este documento? No se borrará físicamente.");
    if (!confirmar) return;

    const motivo = window.prompt("Motivo de desactivación (opcional):") || undefined;
    setProcesandoId(documento.id);
    try {
      await desactivarDocumento(documento.id, motivo?.trim() || undefined);
      toast.success("Documento desactivado.");
      await cargarDocumentos();
    } catch (error) {
      console.error("Error al desactivar documento:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Paperclip className="h-4 w-4 text-cyan-300" />
            <h4 className="font-semibold">{titulo}</h4>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300">
              {documentos.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Evidencia relacionada con este trámite. Se abre con URL temporal segura.
          </p>
          {(numeroFactura || numeroCheque || proveedorNombre || montoFormateado) && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
              {numeroFactura && <span className="rounded-full bg-white/5 px-2 py-1">Factura: {numeroFactura}</span>}
              {numeroCheque && <span className="rounded-full bg-white/5 px-2 py-1">Cheque: {numeroCheque}</span>}
              {proveedorNombre && <span className="rounded-full bg-white/5 px-2 py-1">Proveedor: {proveedorNombre}</span>}
              {montoFormateado && <span className="rounded-full bg-white/5 px-2 py-1">{montoFormateado}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={cargarDocumentos}
            disabled={!puedeGestionar || cargando}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setMostrarFormulario((actual) => !actual)}
            disabled={!puedeGestionar}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Adjuntar
          </button>
        </div>
      </div>

      {!puedeGestionar && (
        <p className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
          Guarda primero el cheque u orden para poder adjuntar documentos.
        </p>
      )}

      {mostrarFormulario && puedeGestionar && (
        <form onSubmit={subirDocumento} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-300">
              Archivo
              <input
                ref={fileInputRef}
                type="file"
                onChange={(event) => setArchivo(event.target.files?.[0] || null)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-100"
              />
            </label>
            <label className="text-xs font-semibold text-slate-300">
              Tipo de documento
              <select
                value={tipoDocumento}
                onChange={(event) => setTipoDocumento(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
              >
                {tiposDisponibles.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-300">
              Título
              <input
                type="text"
                value={tituloDocumento}
                onChange={(event) => setTituloDocumento(event.target.value)}
                placeholder="Ej. Voucher de pago"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </label>
            <label className="text-xs font-semibold text-slate-300">
              Fecha del documento
              <input
                type="date"
                value={fechaDocumento}
                onChange={(event) => setFechaDocumento(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
              />
            </label>
          </div>
          <label className="text-xs font-semibold text-slate-300">
            Descripción
            <textarea
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              rows={2}
              placeholder="Notas breves sobre el documento"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={sensible}
                onChange={(event) => setSensible(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-slate-950"
              />
              Documento sensible
            </label>
            <button
              type="submit"
              disabled={subiendo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Subir documento
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {cargando && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando documentos...
          </div>
        )}

        {!cargando && documentos.length === 0 && puedeGestionar && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-400">
            No hay documentos adjuntos para este registro.
          </div>
        )}

        {!cargando &&
          documentos.map((documento) => (
            <div
              key={documento.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-300" />
                  <p className="truncate text-sm font-semibold text-white">
                    {documento.titulo || documento.archivo_nombre || "Documento"}
                  </p>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                    {documento.tipo_documento}
                  </span>
                  {documento.sensible && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200">
                      Sensible
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {documento.archivo_nombre} · {formatFecha(documento.fecha_documento || documento.creado_at)}
                </p>
                {documento.descripcion && <p className="mt-1 text-xs text-slate-300">{documento.descripcion}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => abrirDocumento(documento)}
                  disabled={procesandoId === documento.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesandoId === documento.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => desactivar(documento)}
                  disabled={procesandoId === documento.id || soloLectura}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Desactivar
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
