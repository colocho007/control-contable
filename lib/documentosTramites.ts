import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
  type ValorJsonAuditoria,
} from "./auditoria";
import { supabase } from "./supabase";

export type MetadatosDocumento = ValorJsonAuditoria;

export interface DocumentoTramite {
  id: string | number;
  empresa_id: number;
  modulo: string;
  tipo_documento: string;
  entidad_tipo: string | null;
  entidad_id: string | number | null;
  titulo: string | null;
  descripcion: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  numero_documento: string | null;
  numero_factura: string | null;
  numero_cheque: string | null;
  proveedor_id: string | number | null;
  proveedor_nombre_snapshot: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  monto: number | null;
  moneda: string | null;
  sensible: boolean;
  metadatos: MetadatosDocumento | null;
  archivo_bucket: string;
  archivo_path: string;
  archivo_nombre: string;
  archivo_mime: string | null;
  archivo_size: number;
  estado: string;
  creado_at: string | null;
  actualizado_at: string | null;
}

export interface SubirDocumentoTramiteParams {
  archivo: File;
  empresa_id: number;
  modulo: string;
  tipo_documento: string;
  entidad_tipo?: string | null;
  entidad_id?: string | number | null;
  titulo?: string | null;
  descripcion?: string | null;
  fecha_documento?: string | null;
  fecha_vencimiento?: string | null;
  numero_documento?: string | null;
  numero_factura?: string | null;
  numero_cheque?: string | null;
  proveedor_id?: string | number | null;
  proveedor_nombre_snapshot?: string | null;
  banco?: string | null;
  cuenta_bancaria?: string | null;
  monto?: number | null;
  moneda?: string | null;
  sensible?: boolean;
  metadatos?: MetadatosDocumento | null;
}

export interface BuscarDocumentosTramiteParams {
  empresa_id?: number;
  modulo?: string;
  entidad_tipo?: string;
  entidad_id?: string | number;
  tipo_documento?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  numero_factura?: string;
  numero_cheque?: string;
  proveedor_id?: string | number;
  texto?: string;
  sensible?: boolean;
  limite?: number;
}

export type ListarDocumentosTramiteParams = BuscarDocumentosTramiteParams;

interface RegistrarDocumentoManualParams
  extends Omit<SubirDocumentoTramiteParams, "archivo"> {
  archivo_bucket: string;
  archivo_path: string;
  archivo_nombre: string;
  archivo_mime: string | null;
  archivo_size: number;
}

const BUCKET_DOCUMENTOS = "documentos-tramites";
const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 500;
const DURACION_URL_SEGUNDOS = 300;
const COLUMNAS_DOCUMENTO =
  "id,empresa_id,modulo,tipo_documento,entidad_tipo,entidad_id,titulo,descripcion,fecha_documento,fecha_vencimiento,numero_documento,numero_factura,numero_cheque,proveedor_id,proveedor_nombre_snapshot,banco,cuenta_bancaria,monto,moneda,sensible,metadatos,archivo_bucket,archivo_path,archivo_nombre,archivo_mime,archivo_size,estado,creado_at,actualizado_at";

function requerirTexto(valor: string, campo: string) {
  if (!valor?.trim()) {
    throw new Error(`El campo ${campo} es obligatorio para gestionar documentos.`);
  }
}

function validarEmpresaId(empresaId: number) {
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error("Debe indicar una empresa valida para gestionar documentos.");
  }
}

function errorSupabase(accion: string, error: { message?: string } | null) {
  return new Error(
    `${accion}: ${error?.message || "Error desconocido de Supabase."}`
  );
}

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido.";
}

function textoONull(valor?: string | null) {
  const texto = valor?.trim();
  return texto ? texto : null;
}

function limpiarSegmentoRuta(valor: string, campo: string) {
  requerirTexto(valor, campo);

  const limpio = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  if (!limpio) {
    throw new Error(`El campo ${campo} no permite generar una ruta de archivo valida.`);
  }

  return limpio;
}

function limpiarNombreArchivo(nombre: string) {
  const normalizado = (nombre || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const punto = normalizado.lastIndexOf(".");
  const tieneExtension = punto > 0 && punto < normalizado.length - 1;
  const baseOriginal = tieneExtension ? normalizado.slice(0, punto) : normalizado;
  const extensionOriginal = tieneExtension ? normalizado.slice(punto + 1) : "";
  const base =
    baseOriginal
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "archivo";
  const extension = extensionOriginal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 15);

  return extension ? `${base}.${extension}` : base;
}

function generarIdentificadorArchivo() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function construirPathArchivo(
  empresaId: number,
  modulo: string,
  nombreArchivo: string
) {
  validarEmpresaId(empresaId);
  const segmentoModulo = limpiarSegmentoRuta(modulo, "modulo");
  const nombreLimpio = limpiarNombreArchivo(nombreArchivo);

  return `${empresaId}/${segmentoModulo}/${generarIdentificadorArchivo()}-${nombreLimpio}`;
}

function resolverLimite(limite?: number) {
  if (limite === undefined) return LIMITE_PREDETERMINADO;

  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error("El limite de documentos debe ser un numero entero positivo.");
  }

  return Math.min(limite, LIMITE_MAXIMO);
}

function prepararTextoBusqueda(texto: string) {
  return texto
    .trim()
    .replace(/[,%()"'\\]/g, " ")
    .replace(/\s+/g, " ");
}

async function auditarSinBloquear(params: RegistrarAuditoriaEventoParams) {
  try {
    await registrarAuditoriaEvento(params);
  } catch (error) {
    console.error("La operacion de documento se completo, pero fallo la auditoria:", error);
  }
}

async function registrarDocumentoManual(
  params: RegistrarDocumentoManualParams
): Promise<DocumentoTramite> {
  validarEmpresaId(params.empresa_id);
  requerirTexto(params.modulo, "modulo");
  requerirTexto(params.tipo_documento, "tipo_documento");

  const { data, error } = await supabase
    .from("documentos_tramites")
    .insert({
      empresa_id: params.empresa_id,
      modulo: params.modulo.trim(),
      tipo_documento: params.tipo_documento.trim(),
      entidad_tipo: textoONull(params.entidad_tipo),
      entidad_id: params.entidad_id ?? null,
      titulo: textoONull(params.titulo),
      descripcion: textoONull(params.descripcion),
      fecha_documento: params.fecha_documento ?? null,
      fecha_vencimiento: params.fecha_vencimiento ?? null,
      numero_documento: textoONull(params.numero_documento),
      numero_factura: textoONull(params.numero_factura),
      numero_cheque: textoONull(params.numero_cheque),
      proveedor_id: params.proveedor_id ?? null,
      proveedor_nombre_snapshot: textoONull(params.proveedor_nombre_snapshot),
      banco: textoONull(params.banco),
      cuenta_bancaria: textoONull(params.cuenta_bancaria),
      monto: params.monto ?? null,
      moneda: textoONull(params.moneda),
      sensible: params.sensible ?? false,
      metadatos: params.metadatos ?? null,
      archivo_bucket: params.archivo_bucket,
      archivo_path: params.archivo_path,
      archivo_nombre: params.archivo_nombre,
      archivo_mime: params.archivo_mime,
      archivo_size: params.archivo_size,
      estado: "activo",
      actualizado_at: new Date().toISOString(),
    })
    .select(COLUMNAS_DOCUMENTO)
    .single();

  if (error) {
    throw errorSupabase("No se pudo registrar la metadata del documento", error);
  }

  return data as DocumentoTramite;
}

export async function subirDocumentoTramite(
  params: SubirDocumentoTramiteParams
): Promise<DocumentoTramite> {
  validarEmpresaId(params.empresa_id);
  requerirTexto(params.modulo, "modulo");
  requerirTexto(params.tipo_documento, "tipo_documento");

  if (!params.archivo?.name) {
    throw new Error("Debe seleccionar un archivo para subir el documento.");
  }

  const archivoPath = construirPathArchivo(
    params.empresa_id,
    params.modulo,
    params.archivo.name
  );

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(archivoPath, params.archivo, {
      contentType: params.archivo.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw errorSupabase("No se pudo subir el archivo del documento", uploadError);
  }

  let documento: DocumentoTramite;

  try {
    documento = await registrarDocumentoManual({
      ...params,
      archivo_bucket: BUCKET_DOCUMENTOS,
      archivo_path: archivoPath,
      archivo_nombre: params.archivo.name,
      archivo_mime: params.archivo.type || null,
      archivo_size: params.archivo.size,
    });
  } catch (error) {
    await auditarSinBloquear({
      empresa_id: params.empresa_id,
      modulo: "documentos",
      accion: "archivo_subido_sin_metadata",
      entidad_tipo: "documento_tramite",
      descripcion: "Archivo subido sin registro de metadata",
      sensible: params.sensible ?? false,
      metadatos: {
        modulo_origen: params.modulo,
        tipo_documento: params.tipo_documento,
        archivo_bucket: BUCKET_DOCUMENTOS,
        archivo_path: archivoPath,
        motivo_error: mensajeError(error),
      },
    });

    throw new Error(
      `El archivo fue subido, pero no se pudo registrar el documento. ` +
        `Se conserva el archivo para revision en ${archivoPath}. ${mensajeError(error)}`
    );
  }

  await auditarSinBloquear({
    empresa_id: documento.empresa_id,
    modulo: "documentos",
    accion: "subir_documento",
    entidad_tipo: "documento_tramite",
    entidad_id: documento.id,
    estado_nuevo: "activo",
    descripcion: "Documento de tramite subido",
    sensible: documento.sensible,
    metadatos: {
      modulo_origen: documento.modulo,
      tipo_documento: documento.tipo_documento,
      archivo_nombre: documento.archivo_nombre,
      archivo_mime: documento.archivo_mime,
      archivo_size: documento.archivo_size,
    },
  });

  return documento;
}

export async function listarDocumentosTramite(
  params: ListarDocumentosTramiteParams = {}
): Promise<DocumentoTramite[]> {
  if (params.empresa_id !== undefined) {
    validarEmpresaId(params.empresa_id);
  }

  let query = supabase
    .from("documentos_tramites")
    .select(COLUMNAS_DOCUMENTO)
    .eq("estado", "activo");

  if (params.empresa_id !== undefined) {
    query = query.eq("empresa_id", params.empresa_id);
  }

  if (params.modulo?.trim()) {
    query = query.eq("modulo", params.modulo.trim());
  }

  if (params.entidad_tipo?.trim()) {
    query = query.eq("entidad_tipo", params.entidad_tipo.trim());
  }

  if (params.entidad_id !== undefined) {
    query = query.eq("entidad_id", params.entidad_id);
  }

  if (params.tipo_documento?.trim()) {
    query = query.eq("tipo_documento", params.tipo_documento.trim());
  }

  if (params.fecha_desde?.trim()) {
    query = query.gte("fecha_documento", params.fecha_desde.trim());
  }

  if (params.fecha_hasta?.trim()) {
    query = query.lte("fecha_documento", params.fecha_hasta.trim());
  }

  if (params.numero_factura?.trim()) {
    query = query.eq("numero_factura", params.numero_factura.trim());
  }

  if (params.numero_cheque?.trim()) {
    query = query.eq("numero_cheque", params.numero_cheque.trim());
  }

  if (params.proveedor_id !== undefined) {
    query = query.eq("proveedor_id", params.proveedor_id);
  }

  if (params.sensible !== undefined) {
    query = query.eq("sensible", params.sensible);
  }

  if (params.texto?.trim()) {
    const texto = prepararTextoBusqueda(params.texto);

    if (!texto) {
      throw new Error("El texto de busqueda no contiene caracteres validos.");
    }

    query = query.or(
      [
        "titulo",
        "descripcion",
        "numero_documento",
        "numero_factura",
        "numero_cheque",
        "proveedor_nombre_snapshot",
        "banco",
      ]
        .map((campo) => `${campo}.ilike.%${texto}%`)
        .join(",")
    );
  }

  const { data, error } = await query
    .order("fecha_documento", { ascending: false, nullsFirst: false })
    .order("creado_at", { ascending: false })
    .limit(resolverLimite(params.limite));

  if (error) {
    throw errorSupabase("No se pudieron listar los documentos", error);
  }

  return (data || []) as DocumentoTramite[];
}

export async function buscarDocumentosTramite(
  params: BuscarDocumentosTramiteParams = {}
): Promise<DocumentoTramite[]> {
  return listarDocumentosTramite(params);
}

export async function obtenerUrlDocumento(
  documento: DocumentoTramite,
  duracionSegundos: number = DURACION_URL_SEGUNDOS
): Promise<string> {
  validarEmpresaId(documento.empresa_id);

  if (
    !Number.isInteger(duracionSegundos) ||
    duracionSegundos <= 0 ||
    duracionSegundos > 3600
  ) {
    throw new Error("La duracion de la URL debe estar entre 1 y 3600 segundos.");
  }

  const { data: documentoActual, error: documentoError } = await supabase
    .from("documentos_tramites")
    .select("id,empresa_id,archivo_bucket,archivo_path,estado")
    .eq("id", documento.id)
    .maybeSingle();

  if (documentoError || !documentoActual) {
    throw new Error("No se pudo acceder al documento o ya no está disponible.");
  }

  if (documentoActual.estado !== "activo") {
    throw new Error("El documento ya no está activo o fue desactivado.");
  }

  validarEmpresaId(Number(documentoActual.empresa_id));

  if (documentoActual.archivo_bucket !== BUCKET_DOCUMENTOS) {
    throw new Error("El documento no pertenece al bucket privado esperado.");
  }

  if (documentoActual.archivo_path !== documento.archivo_path) {
    throw new Error("El archivo del documento cambio y debe volver a consultarse.");
  }

  if (
    !documentoActual.archivo_path?.startsWith(
      `${Number(documentoActual.empresa_id)}/`
    )
  ) {
    throw new Error("La ruta del documento no coincide con su empresa.");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(documentoActual.archivo_path, duracionSegundos);

  if (error || !data?.signedUrl) {
    throw errorSupabase("No se pudo generar la URL segura del documento", error);
  }

  return data.signedUrl;
}

export async function desactivarDocumento(
  id: string | number,
  motivo?: string
): Promise<DocumentoTramite> {
  if (id === "" || id === null || id === undefined) {
    throw new Error("Debe indicar el documento que desea desactivar.");
  }

  const { data, error } = await supabase
    .from("documentos_tramites")
    .update({
      estado: "inactivo",
      actualizado_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("estado", "activo")
    .select(COLUMNAS_DOCUMENTO)
    .maybeSingle();

  if (error) {
    throw errorSupabase("No se pudo desactivar el documento", error);
  }

  if (!data) {
    throw new Error("No se encontro un documento activo con ese id.");
  }

  const documento = data as DocumentoTramite;

  await auditarSinBloquear({
    empresa_id: documento.empresa_id,
    modulo: "documentos",
    accion: "desactivar_documento",
    entidad_tipo: "documento_tramite",
    entidad_id: documento.id,
    estado_anterior: "activo",
    estado_nuevo: "inactivo",
    motivo: textoONull(motivo),
    descripcion: "Documento de tramite desactivado",
    sensible: documento.sensible,
    metadatos: {
      modulo_origen: documento.modulo,
      tipo_documento: documento.tipo_documento,
      archivo_nombre: documento.archivo_nombre,
    },
  });

  return documento;
}
