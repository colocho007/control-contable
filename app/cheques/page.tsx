"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import DocumentosEntidad from "../../components/DocumentosEntidad";
import { supabase } from "../../lib/supabase";
import { registrarAuditoriaEvento, type RegistrarAuditoriaEventoParams } from "../../lib/auditoria";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { validarRespaldoDocumentalActivo } from "../../lib/documentosTramites";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasEmpresas,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import {
  descartarBorrador,
  guardarBorradorTrabajo,
  listarBorradoresActivos,
  marcarBorradorCompletado,
  obtenerBorradorActivo,
  type BorradorTrabajo,
} from "../../lib/borradoresTrabajo";
import {
  Plus,
  CheckCircle2,
  Archive,
  XCircle,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Loader2,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
  razon_social?: string | null;
  nombre_comercial?: string | null;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface Cheque {
  id: number;
  borrador_id: string | null;
  fondo_empresa_id: number | null;
  chequera_id: number | null;
  cheque_fisico_id: number | null;
  numero_cheque: string | null;
  estado_fondo: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  comprometido_at: string | null;
  liberado_at: string | null;
  motivo_anulacion: string | null;
  empresa_id: number | null;
  empresa: string;
  beneficiario: string;
  concepto: string;
  monto: number;
  tipo_cambio: number | null;
monto_gtq: number | null;
  tipo_pago: string;
  forma_pago: string | null;
  moneda: string | null;
  prioridad: string;
  fecha_pago: string;
  fecha_limite_autorizacion: string | null;
  estado: string;
  creado_por: string | null;
  responsable_actual: string | null;
  enviado_at: string | null;
  autorizado_por: string | null;
  autorizado_at: string | null;
  rechazado_por: string | null;
  rechazado_at: string | null;
  motivo_rechazo: string | null;
  archivado_por: string | null;
  archivado_at: string | null;
  motivo_archivo: string | null;
  pagado_at: string | null;
  movimiento_generado: boolean | null;
  created_at: string | null;
}

interface FondoEmpresa {
  id: number;
  empresa_id: number;
  empresa: string;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string;
  saldo_base: number;
  saldo_comprometido: number | null;
  saldo_disponible: number | null;
  estado: string | null;
}

interface Chequera {
  id: number;
  fondo_empresa_id: number | null;
  empresa_id: number;
  empresa: string;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string;
  numero_inicial: number;
  numero_final: number;
  cantidad_total: number;
  estado: string | null;
}

interface ChequeFisico {
  id: number;
  chequera_id: number;
  fondo_empresa_id: number | null;
  empresa_id: number;
  empresa: string;
  banco: string | null;
  cuenta_bancaria: string | null;
  numero_cheque: number;
  moneda: string;
  estado: string;
}

interface HistorialCheque {
  id: number;
  cheque_id: number;
  modulo: string | null;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  comentario: string | null;
  usuario_id: string | null;
  visible_usuario: boolean | null;
  visible_exportacion: boolean | null;
  sensible: boolean | null;
  created_at: string | null;
}


interface ResumenChequera {
  chequera_id: number;
  fondo_empresa_id: number | null;
  empresa_id: number;
  empresa: string;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string;
  numero_inicial: number;
  numero_final: number;
  cantidad_total: number;
  estado: string | null;
  cheques_generados: number;
  disponibles: number;
  reservados: number;
  emitidos: number;
  firmados: number;
  pagados: number;
  rechazados: number;
  anulados: number;
}

const ROLES_JEFATURA = ["admin", "supervisor", "jefe"];
const TIPOS_DOCUMENTO_CHEQUES = [
  "Cheque escaneado",
  "Voucher",
  "Comprobante de pago",
  "Transferencia",
  "DepÃ³sito",
  "Recibo",
  "Otro",
];
const TITULO_BORRADOR_CHEQUE = "Borrador de cheque";
const IDEMPOTENCY_PREFIX_CHEQUES = "controlplus_idempotency_cheques";
const COLUMNAS_BORRADOR_CHEQUE =
  "id,usuario_id,empresa_id,modulo,ruta,titulo,referencia_temporal,datos,estado,creado_at,actualizado_at,expira_at";

function normalizarTexto(valor?: string | null) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function esEstadoOperativo(valor?: string | null) {
  const estado = normalizarTexto(valor || "Activa");
  return !["inactiva", "inactivo", "archivada", "archivado", "anulada", "anulado"].includes(estado);
}

function esEmpresaDePrueba(empresa: Empresa) {
  const texto = normalizarTexto(
    [empresa.nombre, empresa.razon_social, empresa.nombre_comercial]
      .filter(Boolean)
      .join(" ")
  );

  return texto.includes("control plus") || texto.includes("prueba") || texto.includes("demo");
}

function esEmpresaOperativa(empresa: Empresa) {
  return esEstadoOperativo(empresa.estado) && !esEmpresaDePrueba(empresa);
}

function crearReferenciaTemporalCheque() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `nuevo-cheque-${crypto.randomUUID()}`;
  }

  return `nuevo-cheque-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function crearFormularioChequeVacio() {
  return {
    empresaId: "",
    empresa: "",
    fondoEmpresaId: "",
    chequeraId: "",
    chequeFisicoId: "",
    numeroCheque: "",
    banco: "",
    cuentaBancaria: "",
    beneficiario: "",
    concepto: "",
    monto: "",
    tipoCambio: "1",
    tipoPago: "Proveedor",
    formaPago: "Cheque",
    moneda: "GTQ",
    prioridad: "Media",
    fechaPago: "",
    responsableActual: "",
  };
}

type FormularioCheque = ReturnType<typeof crearFormularioChequeVacio>;

function formularioChequeTieneContenido(formulario: FormularioCheque) {
  const formularioVacio = crearFormularioChequeVacio();

  return (Object.keys(formularioVacio) as Array<keyof FormularioCheque>).some(
    (campo) => formulario[campo] !== formularioVacio[campo]
  );
}

export default function ChequesPage() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fondos, setFondos] = useState<FondoEmpresa[]>([]);
const [chequeras, setChequeras] = useState<Chequera[]>([]);
const [chequesFisicos, setChequesFisicos] = useState<ChequeFisico[]>([]);
const [resumenChequeras, setResumenChequeras] = useState<ResumenChequera[]>([]);
const [historialCheques, setHistorialCheques] = useState<
  HistorialCheque[]
>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoCheques, setCargandoCheques] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("Todas");

 const [form, setForm] = useState<FormularioCheque>(crearFormularioChequeVacio);
 const [borradorActivo, setBorradorActivo] = useState<BorradorTrabajo | null>(null);
 const [borradorRevisado, setBorradorRevisado] = useState(false);
 const [procesandoBorrador, setProcesandoBorrador] = useState(false);
 const [mensajeBorradorBloqueado, setMensajeBorradorBloqueado] = useState<string | null>(null);
 const formActualRef = useRef(form);
 const chequeCreadoIdRef = useRef<number | null>(null);
 const borradorOrigenIdRef = useRef<string | number | null>(null);
 const referenciaTemporalChequeRef = useRef(crearReferenciaTemporalCheque());
 const borradorConsumidoRef = useRef(false);
 const autoguardadoSuspendidoRef = useRef(false);
 const timeoutBorradorRef = useRef<number | null>(null);
 const guardadoEnCursoRef = useRef<Promise<void> | null>(null);
 const guardadoPendienteRef = useRef(false);

const [formFondo, setFormFondo] = useState({
  empresaId: "",
  empresa: "",
  banco: "",
  cuentaBancaria: "",
  moneda: "GTQ",
  saldoBase: "",
});

const [formChequera, setFormChequera] = useState({
  fondoEmpresaId: "",
  empresaId: "",
  empresa: "",
  banco: "",
  cuentaBancaria: "",
  moneda: "GTQ",
  numeroInicial: "",
  numeroFinal: "",
});
const [seccionesChequesAbiertas, setSeccionesChequesAbiertas] = useState({
  cheque: true,
  fondo: false,
  chequera: false,
});

function alternarSeccionCheques(seccion: "cheque" | "fondo" | "chequera") {
  setSeccionesChequesAbiertas((actual) => ({
    ...actual,
    [seccion]: !actual[seccion],
  }));
}

function generarIdempotencyKeyCheque() {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `cheques-${aleatorio}`;
}

function obtenerIdempotencyKeyCheque(alcance: string) {
  const storageKey = `${IDEMPOTENCY_PREFIX_CHEQUES}:${alcance}`;
  const existente = window.localStorage.getItem(storageKey);
  if (existente) return { key: existente, storageKey };

  const key = generarIdempotencyKeyCheque();
  window.localStorage.setItem(storageKey, key);
  return { key, storageKey };
}

function liberarIdempotencyKeyCheque(storageKey: string) {
  window.localStorage.removeItem(storageKey);
}

async function iniciarOperacionIdempotente({
  alcance,
  accion,
  empresaId,
  entidadTipo,
  entidadId,
  requestHash,
}: {
  alcance: string;
  accion: string;
  empresaId: number | null;
  entidadTipo: string;
  entidadId: string | number | null;
  requestHash?: string | null;
}) {
  if (!userId) {
    return {
      ok: false,
      mensaje: "Sesion no valida.",
      key: "",
      storageKey: "",
      persistidaId: null as string | null,
    };
  }

  const { key, storageKey } = obtenerIdempotencyKeyCheque(alcance);

  try {
    const { data: existente, error: consultaError } = await supabase
      .from("idempotency_keys_operativas")
      .select("id,estado,resultado_resumen")
      .eq("idempotency_key", key)
      .maybeSingle();

    if (consultaError) throw consultaError;

    if (existente?.estado === "completada") {
      return {
        ok: false,
        mensaje: "Esta operacion ya fue procesada. No se duplicara historial ni auditoria.",
        key,
        storageKey,
        persistidaId: String(existente.id),
        replay: true,
      };
    }

    if (existente?.estado === "en_proceso") {
      return {
        ok: false,
        mensaje: "La operacion ya esta en proceso. Espera antes de reintentar.",
        key,
        storageKey,
        persistidaId: String(existente.id),
      };
    }

    if (existente) {
      return {
        ok: false,
        mensaje: "La llave de idempotencia ya fue usada. Inicia una nueva operacion.",
        key,
        storageKey,
        persistidaId: String(existente.id),
      };
    }

    const { data: creada, error: insertError } = await supabase
      .from("idempotency_keys_operativas")
      .insert({
        expira_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: key,
        usuario_id: userId,
        empresa_id: empresaId,
        modulo: "cheques",
        accion,
        estado: "en_proceso",
        request_hash: requestHash || alcance,
        entidad_tipo: entidadTipo,
        entidad_id: entidadId !== null && entidadId !== undefined ? String(entidadId) : null,
      })
      .select("id")
      .single();

    if (insertError) {
      const { data: creadaPorOtroIntento, error: reconsultaError } = await supabase
        .from("idempotency_keys_operativas")
        .select("id,estado,resultado_resumen")
        .eq("idempotency_key", key)
        .maybeSingle();

      if (!reconsultaError && creadaPorOtroIntento?.estado === "completada") {
        return {
          ok: false,
          mensaje: "Esta operacion ya fue procesada. No se duplicara historial ni auditoria.",
          key,
          storageKey,
          persistidaId: String(creadaPorOtroIntento.id),
          replay: true,
        };
      }

      if (!reconsultaError && creadaPorOtroIntento?.estado === "en_proceso") {
        return {
          ok: false,
          mensaje: "La operacion ya esta en proceso. Espera antes de reintentar.",
          key,
          storageKey,
          persistidaId: String(creadaPorOtroIntento.id),
        };
      }

      if (!reconsultaError && creadaPorOtroIntento) {
        return {
          ok: false,
          mensaje: "La llave de idempotencia ya fue usada. Inicia una nueva operacion.",
          key,
          storageKey,
          persistidaId: String(creadaPorOtroIntento.id),
        };
      }

      throw insertError;
    }

    return {
      ok: true,
      key,
      storageKey,
      persistidaId: String(creada.id),
    };
  } catch (error) {
    console.warn("Idempotencia persistente de cheques no disponible:", error);
    return {
      ok: true,
      key,
      storageKey,
      persistidaId: null as string | null,
      modoTemporal: true,
    };
  }
}

async function completarOperacionIdempotente(
  persistidaId: string | null,
  storageKey: string,
  entidadTipo: string,
  entidadId: string | number | null,
  resultadoResumen: Record<string, unknown>
) {
  if (persistidaId) {
    const { error } = await supabase
      .from("idempotency_keys_operativas")
      .update({
        estado: "completada",
        entidad_tipo: entidadTipo,
        entidad_id: entidadId !== null && entidadId !== undefined ? String(entidadId) : null,
        resultado_resumen: resultadoResumen,
        error_resumen: null,
      })
      .eq("id", persistidaId);

    if (error) {
      console.warn("No se pudo completar idempotencia de cheques:", error);
    }
  }

  liberarIdempotencyKeyCheque(storageKey);
}

async function fallarOperacionIdempotente(
  persistidaId: string | null,
  storageKey: string,
  error: unknown
) {
  if (persistidaId) {
    const { error: updateError } = await supabase
      .from("idempotency_keys_operativas")
      .update({
        estado: "fallida",
        error_resumen:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Error no identificado",
      })
      .eq("id", persistidaId);

    if (updateError) {
      console.warn("No se pudo marcar idempotencia fallida de cheques:", updateError);
    }
  }

  liberarIdempotencyKeyCheque(storageKey);
}

  useEffect(() => {
    iniciar();
  }, []);

  useEffect(() => {
    formActualRef.current = form;
  }, [form]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

async function iniciar() {
  try {
    setValidandoAcceso(true);
    setCargandoCheques(false);

    const acceso = await validarAccesoModuloUsuario("cheques");

    if (!acceso.ok) {
      if (
        acceso.motivo === "sin_sesion" ||
        acceso.motivo === "sin_perfil" ||
        acceso.motivo === "usuario_inactivo"
      ) {
        if (acceso.motivo === "usuario_inactivo") {
          toast.error("Tu usuario estÃ¡ inactivo. Contacta al administrador.");
        }

        window.location.href = "/login";
        return;
      }

      if (
        acceso.motivo === "modulo_inactivo" ||
        acceso.motivo === "modulo_no_encontrado"
      ) {
        toast.error("El mÃ³dulo de Cheques estÃ¡ desactivado.");
      } else {
        toast.error("No tienes acceso al mÃ³dulo de Cheques.");
      }

      window.location.href = "/dashboard";
      return;
    }

    const user = acceso.user!;
    const perfil = acceso.perfil!;

    setUserId(user.id);
    setPerfilActual(perfil);
    setCargandoCheques(true);
    setAutorizado(true);
    setValidandoAcceso(false);

    const idsPermitidos = await obtenerEmpresasPermitidas(
      user.id,
      perfil.rol || ""
    );

    const empresasOperativas = await obtenerEmpresas(idsPermitidos);
    const idsOperativos = empresasOperativas.map((empresa) => Number(empresa.id));

    setEmpresasPermitidasIds(idsOperativos);

    await Promise.all([
      obtenerUsuarios(),
      obtenerFuncionesOperativas(idsOperativos),
      obtenerCheques(idsOperativos, user.id, perfil.rol || ""),
      obtenerFondos(idsOperativos),
      obtenerChequeras(idsOperativos),
      obtenerChequesFisicos(idsOperativos),
      obtenerResumenChequeras(idsOperativos),
      obtenerHistorialCheques(idsOperativos, user.id, perfil.rol || ""),
      recuperarBorradorCheque(),
    ]);

  } catch (error) {
    console.error(error);
    toast.error("Error cargando mÃ³dulo de cheques");
  } finally {
    setCargandoCheques(false);
  }
}

async function obtenerChequeCreadoDesdeBorrador(borradorId: string | number) {
  const { data, error } = await supabase
    .from("cheques")
    .select("id")
    .eq("borrador_id", String(borradorId))
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data as { id: number } | null;
}

function esErrorDeBorradorDuplicado(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}) {
  const detalle = `${error.message || ""} ${error.details || ""}`;

  return (
    error.code === "23505" &&
    (detalle.includes("borrador_id") ||
      detalle.includes("idx_cheques_borrador_unico"))
  );
}

async function recuperarBorradorCheque() {
  try {
    const borradores = await listarBorradoresActivos({ modulo: "cheques" });
    const borrador = borradores[0] || null;

    if (borrador) {
      const chequeCreado = await obtenerChequeCreadoDesdeBorrador(borrador.id);

      if (chequeCreado) {
        let borradorCerrado = false;

        try {
          await marcarBorradorCompletado(borrador.id);
          borradorCerrado = true;
        } catch (error) {
          console.error("Error completando borrador ya utilizado:", error);

          try {
            await marcarBorradorRequiereRevision(
              Number(chequeCreado.id),
              "El borrador ya genero un cheque registrado.",
              borrador
            );
            borradorCerrado = true;
          } catch (errorRevision) {
            console.error(
              "Error marcando para revision borrador ya utilizado:",
              errorRevision
            );
          }
        }

        setBorradorActivo(null);
        setBorradorRevisado(true);

        if (!borradorCerrado) {
          bloquearBorradorConsumido(
            "Este cheque ya fue creado desde este borrador."
          );
        }

        toast.error("Este cheque ya fue creado desde este borrador.");
        return;
      }
    }

    setBorradorActivo(borrador);
    setBorradorRevisado(!borrador);
  } catch (error: any) {
    console.error("Error recuperando borrador de cheque:", error);
    toast.error(error.message || "No se pudo recuperar el borrador pendiente");
    setBorradorRevisado(true);
  }
}

function prepararNuevoBorradorCheque() {
  borradorOrigenIdRef.current = null;
  referenciaTemporalChequeRef.current = crearReferenciaTemporalCheque();
}

async function obtenerEmpresas(idsPermitidos: number[]) {
  if (!idsPermitidos.length) {
    setEmpresas([]);
    return [];
  }

  const { data, error } = await supabase
    .from("empresas")
    .select("id,nombre,estado,razon_social,nombre_comercial")
    .in("id", idsPermitidos)
    .order("nombre", { ascending: true });

  if (error) throw error;

  const empresasOperativas = ((data || []) as Empresa[]).filter(esEmpresaOperativa);
  setEmpresas(empresasOperativas);
  return empresasOperativas;
}

  async function obtenerUsuarios() {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre,rol,activo")
      .order("nombre", { ascending: true });

    if (error) throw error;
    setUsuarios(data || []);
  }

async function obtenerFuncionesOperativas(idsPermitidos: number[]) {
  const funciones = await listarFuncionesOperativasEmpresas(idsPermitidos);
  setFuncionesOperativas(funciones);
}

function tieneFuncionCheque(
  usuarioId: string | null | undefined,
  empresaId: number | string | null | undefined,
  funciones: Array<"firmante_cheque" | "autorizador_cheque" | "pagador_cheque" | "revisor_cheque">
) {
  return tieneFuncionOperativaLocal(funcionesOperativas, usuarioId, empresaId, funciones);
}

function usuarioPuedeAutorizarCheque(usuario: Perfil, empresaId?: number | string | null) {
  if (empresaId && tieneFuncionCheque(usuario.id, empresaId, ["autorizador_cheque", "firmante_cheque"])) {
    return true;
  }
  return ROLES_JEFATURA.includes((usuario.rol || "").trim().toLowerCase());
}

function usuarioActualPuedePagarCheque(cheque: Cheque) {
  return tieneFuncionCheque(userId, cheque.empresa_id, ["pagador_cheque"]);
}

function esAuditorSoloLecturaCheque(empresaId?: number | string | null) {
  return esAuditorSoloLecturaLocal(
    funcionesOperativas,
    empresaId ? [empresaId] : empresasPermitidasIds
  );
}

  async function obtenerCheques(
    idsPermitidos: number[],
    usuarioId: string,
    rol: string
  ) {
    const rolNormalizado = (rol || "").trim().toLowerCase();

    let query = supabase
      .from("cheques")
      .select("*")
      .order("created_at", { ascending: false });

    if (!idsPermitidos.length) {
      setCheques([]);
      return;
    }

    query = query.in("empresa_id", idsPermitidos);

    if (!ROLES_JEFATURA.includes(rolNormalizado)) {
      query = query.or(
        `creado_por.eq.${usuarioId},responsable_actual.eq.${usuarioId}`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    setCheques(data || []);
  }

  async function obtenerFondos(idsPermitidos: number[]) {
  if (!idsPermitidos.length) {
    setFondos([]);
    return;
  }

  const { data, error } = await supabase
    .from("fondos_empresa")
    .select("*")
    .in("empresa_id", idsPermitidos)
    .neq("estado", "Inactiva")
    .order("empresa", { ascending: true });

  if (error) throw error;

  setFondos(((data || []) as FondoEmpresa[]).filter((fondo) => esEstadoOperativo(fondo.estado)));
}

async function obtenerChequeras(idsPermitidos: number[]) {
  if (!idsPermitidos.length) {
    setChequeras([]);
    return;
  }

  const { data, error } = await supabase
    .from("chequeras")
    .select("*")
    .in("empresa_id", idsPermitidos)
    .eq("estado", "Activa")
    .order("id", { ascending: false });

  if (error) throw error;

  setChequeras(((data || []) as Chequera[]).filter((chequera) => esEstadoOperativo(chequera.estado)));
}

async function obtenerChequesFisicos(idsPermitidos: number[]) {
  if (!idsPermitidos.length) {
    setChequesFisicos([]);
    return;
  }

  const { data, error } = await supabase
    .from("cheques_fisicos")
    .select("*")
    .in("empresa_id", idsPermitidos)
    .eq("estado", "Disponible")
    .order("numero_cheque", { ascending: true });

  if (error) throw error;

  setChequesFisicos(data || []);
}

async function obtenerResumenChequeras(idsPermitidos: number[]) {
  if (!idsPermitidos.length) {
    setResumenChequeras([]);
    return;
  }

  const { data, error } = await supabase
    .from("vista_resumen_chequeras")
    .select("*")
    .in("empresa_id", idsPermitidos)
    .order("chequera_id", { ascending: false });

  if (error) throw error;

  setResumenChequeras(
    ((data || []) as ResumenChequera[]).filter((chequera) =>
      esEstadoOperativo(chequera.estado)
    )
  );
}

async function obtenerHistorialCheques(
  idsPermitidos: number[],
  usuarioId: string,
  rol: string
) {
  const rolNormalizado = (rol || "").trim().toLowerCase();

  if (!idsPermitidos.length) {
    setHistorialCheques([]);
    return;
  }

  let queryChequesPermitidos = supabase
    .from("cheques")
    .select("id")
    .in("empresa_id", idsPermitidos);

  if (!ROLES_JEFATURA.includes(rolNormalizado)) {
    queryChequesPermitidos = queryChequesPermitidos.or(
      `creado_por.eq.${usuarioId},responsable_actual.eq.${usuarioId}`
    );
  }

  const { data: chequesPermitidos, error: chequesError } =
    await queryChequesPermitidos;

  if (chequesError) throw chequesError;

  const idsChequesPermitidos = (chequesPermitidos || []).map((cheque) => cheque.id);

  if (!idsChequesPermitidos.length) {
    setHistorialCheques([]);
    return;
  }

  const { data, error } = await supabase
    .from("cheques_historial")
    .select("*")
    .in("cheque_id", idsChequesPermitidos)
    .order("created_at", { ascending: false });

  if (error) throw error;

  setHistorialCheques(data || []);
}

async function refrescarModuloCheques() {
  if (!userId || !perfilActual) return;

  await Promise.all([
    obtenerCheques(empresasPermitidasIds, userId, perfilActual.rol || ""),
    obtenerFondos(empresasPermitidasIds),
    obtenerChequeras(empresasPermitidasIds),
    obtenerChequesFisicos(empresasPermitidasIds),
    obtenerResumenChequeras(empresasPermitidasIds),
    obtenerHistorialCheques(empresasPermitidasIds, userId, perfilActual.rol || ""),
  ]);
}

  function calcularLimiteAutorizacion(fechaPago: string, prioridad: string) {
    if (!fechaPago) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 4);
      return limite.toISOString();
    }

    const fecha = new Date(`${fechaPago}T12:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaBase = new Date(fecha);
    fechaBase.setHours(0, 0, 0, 0);

    const diferenciaDias = Math.round(
      (fechaBase.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (prioridad === "Alta" || diferenciaDias <= 0) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 2);
      return limite.toISOString();
    }

    if (diferenciaDias === 1) {
      const limite = new Date();
      limite.setHours(17, 0, 0, 0);
      return limite.toISOString();
    }

    const limite = new Date(fecha);
    limite.setDate(limite.getDate() - 1);
    limite.setHours(17, 0, 0, 0);
    return limite.toISOString();
  }

  const fondosDisponibles = fondos.filter((f) => {
  if (!form.empresaId) return false;

  return (
    empresasPermitidasIds.includes(Number(f.empresa_id)) &&
    Number(f.empresa_id) === Number(form.empresaId) &&
    f.moneda === form.moneda &&
    esEstadoOperativo(f.estado)
  );
});

const chequerasDisponibles = chequeras.filter((c) => {
  if (!form.fondoEmpresaId) return false;

  return (
    empresasPermitidasIds.includes(Number(c.empresa_id)) &&
    Number(c.empresa_id) === Number(form.empresaId) &&
    Number(c.fondo_empresa_id) === Number(form.fondoEmpresaId) &&
    c.moneda === form.moneda &&
    esEstadoOperativo(c.estado)
  );
});

const chequesFisicosDisponibles = chequesFisicos.filter((cf) => {
  if (!form.chequeraId) return false;

  return (
    empresasPermitidasIds.includes(Number(cf.empresa_id)) &&
    Number(cf.empresa_id) === Number(form.empresaId) &&
    Number(cf.chequera_id) === Number(form.chequeraId) &&
    cf.moneda === form.moneda &&
    cf.estado === "Disponible"
  );
});

function continuarConBorradorCheque() {
  if (!borradorActivo) return;

  if (
    !borradorActivo.datos ||
    typeof borradorActivo.datos !== "object" ||
    Array.isArray(borradorActivo.datos)
  ) {
    toast.error("El borrador pendiente no contiene datos recuperables.");
    return;
  }

  const datos = borradorActivo.datos as Record<string, unknown>;
  const formularioRecuperado = crearFormularioChequeVacio();

  (Object.keys(formularioRecuperado) as Array<keyof FormularioCheque>).forEach(
    (campo) => {
      if (typeof datos[campo] === "string") {
        formularioRecuperado[campo] = datos[campo] as string;
      }
    }
  );

  const empresaIdDatos = formularioRecuperado.empresaId
    ? Number(formularioRecuperado.empresaId)
    : null;
  const empresaIdRegistro =
    borradorActivo.empresa_id === null ? null : Number(borradorActivo.empresa_id);

  if (
    (empresaIdDatos !== null && !Number.isFinite(empresaIdDatos)) ||
    (empresaIdRegistro !== null && !Number.isFinite(empresaIdRegistro)) ||
    (empresaIdDatos !== null &&
      empresaIdRegistro !== null &&
      empresaIdDatos !== empresaIdRegistro)
  ) {
    toast.error(
      "El borrador tiene una empresa invalida. Descartalo para iniciar un nuevo cheque."
    );
    return;
  }

  const empresaIdBorrador = empresaIdDatos ?? empresaIdRegistro;

  if (empresaIdBorrador !== null) {
    const empresaPermitida = empresas.find(
      (empresa) => Number(empresa.id) === empresaIdBorrador
    );

    if (
      !empresaPermitida ||
      !empresasPermitidasIds.includes(empresaIdBorrador)
    ) {
      toast.error(
        "La empresa de este borrador ya no esta asignada. Descartalo para continuar."
      );
      return;
    }

    formularioRecuperado.empresaId = String(empresaPermitida.id);
    formularioRecuperado.empresa = empresaPermitida.nombre;
  } else {
    formularioRecuperado.empresa = "";
  }

  if (formularioRecuperado.fondoEmpresaId) {
    const fondoValido = fondos.find(
      (fondo) =>
        String(fondo.id) === formularioRecuperado.fondoEmpresaId &&
        empresaIdBorrador !== null &&
        Number(fondo.empresa_id) === empresaIdBorrador &&
        fondo.moneda === formularioRecuperado.moneda &&
        empresasPermitidasIds.includes(Number(fondo.empresa_id)) &&
        esEstadoOperativo(fondo.estado)
    );

    if (!fondoValido) {
      toast.error(
        "La cuenta o fondo del borrador ya no esta disponible. Descarta el borrador para continuar."
      );
      return;
    }

    formularioRecuperado.banco = fondoValido.banco || "";
    formularioRecuperado.cuentaBancaria = fondoValido.cuenta_bancaria || "";
  }

  if (formularioRecuperado.formaPago !== "Cheque") {
    formularioRecuperado.chequeraId = "";
    formularioRecuperado.chequeFisicoId = "";
    formularioRecuperado.numeroCheque = "";
  }

  if (formularioRecuperado.chequeraId) {
    const chequeraValida = chequeras.find(
      (chequera) =>
        String(chequera.id) === formularioRecuperado.chequeraId &&
        String(chequera.fondo_empresa_id) === formularioRecuperado.fondoEmpresaId &&
        empresaIdBorrador !== null &&
        Number(chequera.empresa_id) === empresaIdBorrador &&
        chequera.moneda === formularioRecuperado.moneda &&
        empresasPermitidasIds.includes(Number(chequera.empresa_id)) &&
        esEstadoOperativo(chequera.estado)
    );

    if (!chequeraValida) {
      toast.error(
        "La chequera del borrador ya no esta disponible. Descarta el borrador para continuar."
      );
      return;
    }
  }

  if (formularioRecuperado.chequeFisicoId) {
    const chequeFisicoValido = chequesFisicos.find(
      (chequeFisico) =>
        String(chequeFisico.id) === formularioRecuperado.chequeFisicoId &&
        String(chequeFisico.chequera_id) === formularioRecuperado.chequeraId &&
        String(chequeFisico.fondo_empresa_id) ===
          formularioRecuperado.fondoEmpresaId &&
        empresaIdBorrador !== null &&
        Number(chequeFisico.empresa_id) === empresaIdBorrador &&
        empresasPermitidasIds.includes(Number(chequeFisico.empresa_id)) &&
        chequeFisico.moneda === formularioRecuperado.moneda &&
        chequeFisico.estado === "Disponible"
    );

    if (!chequeFisicoValido) {
      toast.error(
        "El numero de cheque del borrador ya no esta disponible. Descarta el borrador para continuar."
      );
      return;
    }

    formularioRecuperado.numeroCheque = String(
      chequeFisicoValido.numero_cheque
    );
  }

  if (
    typeof borradorActivo.referencia_temporal === "string" &&
    borradorActivo.referencia_temporal.trim()
  ) {
    referenciaTemporalChequeRef.current = borradorActivo.referencia_temporal;
  }

  borradorOrigenIdRef.current = borradorActivo.id;
  setForm(formularioRecuperado);
  setBorradorRevisado(true);
  toast.success("Borrador de cheque cargado.");
}

async function descartarBorradorChequePendiente() {
  if (!borradorActivo) return;

  setProcesandoBorrador(true);

  try {
    await descartarBorrador(borradorActivo.id);
    prepararNuevoBorradorCheque();
    setBorradorActivo(null);
    setBorradorRevisado(true);
    toast.success("Borrador descartado.");
  } catch (error: any) {
    console.error("Error descartando borrador de cheque:", error);
    toast.error(error.message || "No se pudo descartar el borrador");
  } finally {
    setProcesandoBorrador(false);
  }
}

async function guardarBorradorChequeActual(
  formulario = formActualRef.current
) {
  if (
    chequeCreadoIdRef.current !== null ||
    borradorConsumidoRef.current ||
    autoguardadoSuspendidoRef.current ||
    !autorizado ||
    !userId ||
    !borradorRevisado ||
    !formularioChequeTieneContenido(formulario)
  ) {
    return;
  }

  if (guardadoEnCursoRef.current) {
    guardadoPendienteRef.current = true;
    return;
  }

  setProcesandoBorrador(true);

  const operacion = (async () => {
    try {
      const empresaId = Number(formulario.empresaId);
      const empresaIdBorrador =
        formulario.empresaId && Number.isFinite(empresaId) ? empresaId : null;
      const borradorOrigenId = borradorOrigenIdRef.current;

      if (borradorOrigenId !== null) {
        const chequeExistente = await obtenerChequeCreadoDesdeBorrador(
          borradorOrigenId
        );

        if (chequeExistente) {
          bloquearBorradorConsumido(
            "Este cheque ya fue creado desde este borrador."
          );
          toast.error("Este cheque ya fue creado desde este borrador.");
          return;
        }

        const { data: borradorActualizado, error } = await supabase
          .from("borradores_trabajo")
          .update({
            empresa_id: empresaIdBorrador,
            ruta: "/cheques",
            titulo: TITULO_BORRADOR_CHEQUE,
            referencia_temporal: referenciaTemporalChequeRef.current,
            datos: formulario,
            actualizado_at: new Date().toISOString(),
          })
          .eq("id", borradorOrigenId)
          .eq("usuario_id", userId)
          .eq("estado", "borrador")
          .select(COLUMNAS_BORRADOR_CHEQUE)
          .maybeSingle();

        if (error) throw error;

        if (!borradorActualizado) {
          const chequeCreado = await obtenerChequeCreadoDesdeBorrador(
            borradorOrigenId
          );

          if (chequeCreado) {
            bloquearBorradorConsumido(
              "Este cheque ya fue creado desde este borrador."
            );
            toast.error("Este cheque ya fue creado desde este borrador.");
          }

          return;
        }

        const borrador = borradorActualizado as BorradorTrabajo;

        if (
          typeof borrador.referencia_temporal === "string" &&
          borrador.referencia_temporal.trim()
        ) {
          referenciaTemporalChequeRef.current = borrador.referencia_temporal;
        }

        setBorradorActivo(borrador);
        return;
      }

      const borrador = await guardarBorradorTrabajo({
        modulo: "cheques",
        ruta: "/cheques",
        titulo: TITULO_BORRADOR_CHEQUE,
        empresa_id: empresaIdBorrador,
        referencia_temporal: referenciaTemporalChequeRef.current,
        datos: formulario,
      });

      if (borrador.id && borradorOrigenIdRef.current === null) {
        borradorOrigenIdRef.current = borrador.id;
      }

      if (
        typeof borrador.referencia_temporal === "string" &&
        borrador.referencia_temporal.trim()
      ) {
        referenciaTemporalChequeRef.current = borrador.referencia_temporal;
      }

      setBorradorActivo(borrador);
    } catch (error: any) {
      console.error("Error autoguardando borrador de cheque:", error);
      toast.error(error.message || "No se pudo guardar el borrador");
    } finally {
      setProcesandoBorrador(false);
    }
  })();

  guardadoEnCursoRef.current = operacion;

  await operacion;

  if (guardadoEnCursoRef.current === operacion) {
    guardadoEnCursoRef.current = null;
  }

  if (guardadoPendienteRef.current) {
    guardadoPendienteRef.current = false;

    if (!autoguardadoSuspendidoRef.current) {
      void guardarBorradorChequeActual();
    }
  }
}

async function marcarBorradorRequiereRevision(
  chequeId: number,
  motivoRevision: string,
  borradorConocido?: BorradorTrabajo
) {
  let borrador = borradorConocido || borradorActivo;

  try {
    borrador =
      (await obtenerBorradorActivo({
        modulo: "cheques",
        referencia_temporal: referenciaTemporalChequeRef.current,
      })) || borrador;
  } catch (error) {
    if (!borrador) throw error;
  }

  if (!borrador) return;

  const datosAnteriores =
    borrador.datos &&
    typeof borrador.datos === "object" &&
    !Array.isArray(borrador.datos)
      ? borrador.datos
      : {};

  const { error } = await supabase
    .from("borradores_trabajo")
    .update({
      estado: "requiere_revision",
      actualizado_at: new Date().toISOString(),
      datos: {
        ...datosAnteriores,
        chequeCreadoId: chequeId,
        requiereRevision: true,
        motivoRevision,
      },
    })
    .eq("id", borrador.id)
    .eq("usuario_id", borrador.usuario_id)
    .eq("estado", "borrador");

  if (error) throw error;

  setBorradorActivo(null);
}

function suspenderAutoguardado() {
  autoguardadoSuspendidoRef.current = true;
  guardadoPendienteRef.current = false;

  if (timeoutBorradorRef.current !== null) {
    window.clearTimeout(timeoutBorradorRef.current);
    timeoutBorradorRef.current = null;
  }
}

function bloquearBorradorConsumido(mensaje: string) {
  prepararNuevoBorradorCheque();
  borradorConsumidoRef.current = true;
  suspenderAutoguardado();
  setMensajeBorradorBloqueado(mensaje);
  setBorradorActivo(null);
  setBorradorRevisado(true);
}

function bloquearChequeCreadoParaRevision(chequeId: number) {
  bloquearBorradorConsumido(
    `El cheque #${chequeId} fue creado, pero requiere revision. No se debe reutilizar este formulario para crear otro cheque.`
  );
}

async function completarBorradorChequeCreado(
  chequeId: number,
  borradorId: string | number | null,
  borradorConocido?: BorradorTrabajo
) {
  if (borradorId === null) return true;

  for (let intento = 0; intento < 2; intento += 1) {
    try {
      await marcarBorradorCompletado(borradorId);
      setBorradorActivo(null);
      return true;
    } catch (error) {
      console.error("Error completando borrador de cheque creado:", error);
    }
  }

  try {
    await marcarBorradorRequiereRevision(
      chequeId,
      "No fue posible completar el borrador luego de crear el cheque.",
      borradorConocido
    );
  } catch (error) {
    console.error("Error marcando borrador para revision:", error);
  }

  bloquearChequeCreadoParaRevision(chequeId);
  return false;
}

async function registrarCreacionParcialParaRevision(
  chequeId: number,
  motivoRevision: string,
  borradorConocido?: BorradorTrabajo
) {
  try {
    await marcarBorradorRequiereRevision(
      chequeId,
      motivoRevision,
      borradorConocido
    );
  } catch (error) {
    console.error("Error marcando borrador de cheque parcial:", error);
  }

  bloquearChequeCreadoParaRevision(chequeId);
}

async function esperarAutoguardadoEnCurso() {
  const guardadoEnCurso = guardadoEnCursoRef.current;

  if (guardadoEnCurso) {
    await guardadoEnCurso;
  }
}

async function crearFondo() {
  if (esAuditorSoloLecturaCheque(formFondo.empresaId)) {
    toast.error("El auditor solo lectura no puede crear fondos.");
    return;
  }

  if (
    !formFondo.empresaId ||
    !formFondo.empresa ||
    !formFondo.banco ||
    !formFondo.cuentaBancaria ||
    !formFondo.saldoBase
  ) {
    toast.error("Completa empresa, banco, cuenta y saldo base");
    return;
  }

  if (!userId || !perfilActual) {
    toast.error("SesiÃ³n no vÃ¡lida");
    return;
  }

  const toastId = toast.loading("Creando fondo...");

  try {
    const saldoBase = Number(formFondo.saldoBase);

    const { error } = await supabase.from("fondos_empresa").insert([
      {
        empresa_id: Number(formFondo.empresaId),
        empresa: formFondo.empresa,
        banco: formFondo.banco,
        cuenta_bancaria: formFondo.cuentaBancaria,
        moneda: formFondo.moneda,
        saldo_base: saldoBase,
        saldo_comprometido: 0,
        saldo_disponible: saldoBase,
        estado: "Activa",
      },
    ]);

    if (error) throw error;

    await obtenerFondos(empresasPermitidasIds);

    setFormFondo({
      empresaId: "",
      empresa: "",
      banco: "",
      cuentaBancaria: "",
      moneda: "GTQ",
      saldoBase: "",
    });

    toast.success("Fondo/cuenta bancaria creada", { id: toastId });
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al crear fondo", { id: toastId });
  }
}

async function crearChequera() {
  if (esAuditorSoloLecturaCheque(formChequera.empresaId)) {
    toast.error("El auditor solo lectura no puede crear chequeras.");
    return;
  }

  if (
    !formChequera.fondoEmpresaId ||
    !formChequera.empresaId ||
    !formChequera.empresa ||
    !formChequera.banco ||
    !formChequera.cuentaBancaria ||
    !formChequera.moneda ||
    !formChequera.numeroInicial ||
    !formChequera.numeroFinal
  ) {
    toast.error("Completa cuenta, banco, moneda y rango de cheques");
    return;
  }

  if (!userId || !perfilActual) {
    toast.error("SesiÃ³n no vÃ¡lida");
    return;
  }

  const numeroInicial = Number(formChequera.numeroInicial);
  const numeroFinal = Number(formChequera.numeroFinal);

  if (numeroFinal < numeroInicial) {
    toast.error("El nÃºmero final no puede ser menor al inicial");
    return;
  }

  const fondoSeleccionado = fondos.find(
    (fondo) =>
      String(fondo.id) === formChequera.fondoEmpresaId &&
      Number(fondo.empresa_id) === Number(formChequera.empresaId) &&
      empresasPermitidasIds.includes(Number(fondo.empresa_id)) &&
      esEstadoOperativo(fondo.estado)
  );

  if (!fondoSeleccionado) {
    toast.error("La cuenta o fondo seleccionado ya no esta disponible para crear chequera.");
    return;
  }

  const cantidadTotal = numeroFinal - numeroInicial + 1;
  const toastId = toast.loading("Creando chequera...");

  try {
    const { data, error } = await supabase
      .from("chequeras")
      .insert([
        {
          fondo_empresa_id: Number(formChequera.fondoEmpresaId),
          empresa_id: Number(formChequera.empresaId),
          empresa: formChequera.empresa,
          banco: formChequera.banco,
          cuenta_bancaria: formChequera.cuentaBancaria,
          moneda: formChequera.moneda,
          numero_inicial: numeroInicial,
          numero_final: numeroFinal,
          cantidad_total: cantidadTotal,
          estado: "Activa",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    const { error: rpcError } = await supabase.rpc(
      "generar_cheques_de_chequera",
      {
        p_chequera_id: data.id,
      }
    );

    if (rpcError) throw rpcError;

    await obtenerChequeras(empresasPermitidasIds);
    await obtenerChequesFisicos(empresasPermitidasIds);
    await obtenerResumenChequeras(empresasPermitidasIds);
    await obtenerHistorialCheques(
      empresasPermitidasIds,
      userId,
      perfilActual.rol || ""
    );
   

    setFormChequera({
      fondoEmpresaId: "",
      empresaId: "",
      empresa: "",
      banco: "",
      cuentaBancaria: "",
      moneda: "GTQ",
      numeroInicial: "",
      numeroFinal: "",
    });

    toast.success(`Chequera creada con ${cantidadTotal} cheques`, {
      id: toastId,
    });
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al crear chequera", { id: toastId });
  }
}

 async function registrarAuditoriaCheque(
  params: RegistrarAuditoriaEventoParams,
  contexto: string
 ) {
  try {
    await registrarAuditoriaEvento(params);
    return true;
  } catch (error) {
    console.error(
      `El cambio de ${contexto} se guardo, pero no se pudo registrar la auditoria central:`,
      error
    );
    return false;
  }
 }

 function metadatosAuditoriaCheque(cheque: Cheque) {
  const esCheque = cheque.forma_pago === "Cheque";

  return {
    beneficiario: cheque.beneficiario,
    monto: Number(cheque.monto),
    moneda: cheque.moneda,
    forma_pago: cheque.forma_pago,
    numero_cheque: esCheque ? cheque.numero_cheque : null,
    fondo_id: cheque.fondo_empresa_id,
    chequera_id: esCheque ? cheque.chequera_id : null,
    cheque_fisico_id: esCheque ? cheque.cheque_fisico_id : null,
  };
 }

 async function crearCheque() {
  if (procesandoId !== null) {
    toast.error("Ya hay una operacion de cheques en proceso.");
    return;
  }

  if (esAuditorSoloLecturaCheque(form.empresaId)) {
    toast.error("El auditor solo lectura no puede crear cheques.");
    return;
  }

  if (
    !form.empresa ||
    !form.empresaId ||
    !form.beneficiario ||
    !form.concepto ||
    !form.monto ||
    !form.fechaPago
  ) {
    toast.error("Completa empresa, beneficiario, concepto, monto y fecha de pago");
    return;
  }

  const empresaSeleccionada = empresas.find(
    (empresa) => String(empresa.id) === form.empresaId
  );

  if (
    !empresaSeleccionada ||
    !empresasPermitidasIds.includes(Number(form.empresaId))
  ) {
    toast.error("La empresa seleccionada ya no esta disponible para tu usuario.");
    return;
  }

  const montoCheque = Number(form.monto);

  if (Number.isNaN(montoCheque) || montoCheque <= 0) {
    toast.error("El monto debe ser mayor a 0");
    return;
  }

  if (!form.fondoEmpresaId) {
    toast.error("Selecciona una cuenta/fondo para registrar el pago");
    return;
  }

  const fondoSeleccionado = fondos.find(
    (fondo) =>
      String(fondo.id) === form.fondoEmpresaId &&
      Number(fondo.empresa_id) === Number(form.empresaId) &&
      empresasPermitidasIds.includes(Number(fondo.empresa_id)) &&
      esEstadoOperativo(fondo.estado)
  );

  if (!fondoSeleccionado) {
    toast.error("La cuenta o fondo seleccionado ya no esta disponible");
    return;
  }

  const saldoDisponible = Number(fondoSeleccionado.saldo_disponible || 0);

  if (montoCheque > saldoDisponible) {
    toast.error(
      `Fondos insuficientes. Disponible: ${money(
        saldoDisponible,
        fondoSeleccionado.moneda
      )}`
    );
    return;
  }

  if (fondoSeleccionado.moneda !== form.moneda) {
    toast.error("La moneda del fondo no coincide con la moneda del pago");
    return;
  }

  if (form.moneda === "USD") {
    const tipoCambio = Number(form.tipoCambio);

    if (Number.isNaN(tipoCambio) || tipoCambio <= 0) {
      toast.error("Debes ingresar un tipo de cambio valido para USD");
      return;
    }
  }

  if (form.formaPago === "Cheque") {
    if (!form.chequeraId || !form.chequeFisicoId) {
      toast.error("Selecciona chequera y numero de cheque");
      return;
    }

    const chequeraSeleccionada = chequeras.find(
      (chequera) =>
        String(chequera.id) === form.chequeraId &&
        String(chequera.fondo_empresa_id) === form.fondoEmpresaId &&
        Number(chequera.empresa_id) === Number(form.empresaId) &&
        empresasPermitidasIds.includes(Number(chequera.empresa_id)) &&
        chequera.moneda === form.moneda &&
        esEstadoOperativo(chequera.estado)
    );

    if (!chequeraSeleccionada) {
      toast.error("La chequera seleccionada ya no esta disponible");
      return;
    }

    const chequeFisico = chequesFisicos.find(
      (cf) =>
        String(cf.id) === form.chequeFisicoId &&
        String(cf.chequera_id) === form.chequeraId &&
        String(cf.fondo_empresa_id) === form.fondoEmpresaId &&
        Number(cf.empresa_id) === Number(form.empresaId) &&
        empresasPermitidasIds.includes(Number(cf.empresa_id))
    );

    if (!chequeFisico || chequeFisico.estado !== "Disponible") {
      toast.error("Ese cheque ya no esta disponible");
      return;
    }

    if (chequeFisico.moneda !== form.moneda) {
      toast.error("La moneda del cheque no coincide");
      return;
    }
  }

  if (!userId) {
    toast.error("Sesion no valida");
    return;
  }

  const idempotency = obtenerIdempotencyKeyCheque(
    [
      "crear_cheque_rpc",
      userId,
      form.empresaId,
      form.fondoEmpresaId,
      form.chequeFisicoId || "sin-cheque-fisico",
      form.beneficiario,
      form.monto,
      form.fechaPago,
      referenciaTemporalChequeRef.current,
    ].join(":")
  );

  suspenderAutoguardado();
  setProcesandoId(-1);
  const toastId = toast.loading("Creando cheque...");
  let chequeFinalizado = false;
  let etapaCreacion = "insertar_cheque";
  let borradorParaCheque: BorradorTrabajo | null = null;
  let borradorIdParaCheque: string | number | null = null;
  let rpcEjecutada = false;
  let rpcCreoCheque = false;

  try {
    await esperarAutoguardadoEnCurso();
    borradorIdParaCheque = borradorOrigenIdRef.current;

    if (borradorIdParaCheque !== null) {
      if (
        borradorActivo &&
        String(borradorActivo.id) === String(borradorIdParaCheque)
      ) {
        borradorParaCheque = borradorActivo;
      } else {
        const borradorActual = await obtenerBorradorActivo({
          modulo: "cheques",
          referencia_temporal: referenciaTemporalChequeRef.current,
        });

        if (
          borradorActual &&
          String(borradorActual.id) === String(borradorIdParaCheque)
        ) {
          borradorParaCheque = borradorActual;
        }
      }

      const chequeExistente = await obtenerChequeCreadoDesdeBorrador(
        borradorIdParaCheque
      );

      if (chequeExistente) {
        if (borradorParaCheque) {
          try {
            await marcarBorradorCompletado(borradorIdParaCheque);
          } catch (error) {
            console.error("Error cerrando borrador ya consumido:", error);

            try {
              await marcarBorradorRequiereRevision(
                Number(chequeExistente.id),
                "Se intento reutilizar un borrador que ya genero un cheque.",
                borradorParaCheque
              );
            } catch (errorRevision) {
              console.error(
                "Error marcando borrador consumido para revision:",
                errorRevision
              );
            }
          }
        }

        bloquearBorradorConsumido(
          "Este cheque ya fue creado desde este borrador."
        );
        toast.error("Este cheque ya fue creado desde este borrador.", {
          id: toastId,
        });
        liberarIdempotencyKeyCheque(idempotency.storageKey);
        return;
      }
    }

    const limite = calcularLimiteAutorizacion(form.fechaPago, form.prioridad);
    const tipoCambioFinal =
      form.moneda === "GTQ" ? 1 : Number(form.tipoCambio || 1);
    const esPagoConCheque = form.formaPago === "Cheque";

    etapaCreacion = "crear_cheque_transaccional";
    rpcEjecutada = true;
    const { data: resultadoRpc, error: rpcError } = await supabase.rpc(
      "crear_cheque_transaccional",
      {
        p_empresa_id: Number(form.empresaId),
        p_fondo_empresa_id: Number(form.fondoEmpresaId),
        p_fecha_pago: form.fechaPago,
        p_beneficiario: form.beneficiario,
        p_concepto: form.concepto,
        p_monto: montoCheque,
        p_moneda: form.moneda,
        p_tipo_cambio: tipoCambioFinal,
        p_tipo_pago: form.tipoPago,
        p_forma_pago: form.formaPago,
        p_prioridad: form.prioridad,
        p_creado_por: userId,
        p_chequera_id:
          esPagoConCheque && form.chequeraId ? Number(form.chequeraId) : null,
        p_cheque_fisico_id:
          esPagoConCheque && form.chequeFisicoId
            ? Number(form.chequeFisicoId)
            : null,
        p_borrador_id:
          borradorIdParaCheque !== null ? String(borradorIdParaCheque) : null,
        p_empresa_nombre: empresaSeleccionada.nombre,
        p_fecha_limite_autorizacion: limite,
        p_responsable_actual: form.responsableActual || null,
        p_idempotency_key: idempotency.key,
      }
    );

    if (rpcError) throw rpcError;

    const resultadoCheque = resultadoRpc as
      | { ok?: boolean; mensaje?: string; cheque?: Cheque; idempotency_replay?: boolean }
      | null;

    if (!resultadoCheque?.ok || !resultadoCheque.cheque) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
      throw new Error(
        resultadoCheque?.mensaje || "No se pudo crear el cheque de forma segura."
      );
    }

    const chequeCreado = resultadoCheque.cheque;
    chequeCreadoIdRef.current = Number(chequeCreado.id);
    rpcCreoCheque = true;


    const borradorCerrado = await completarBorradorChequeCreado(
      chequeCreadoIdRef.current,
      borradorIdParaCheque,
      borradorParaCheque || undefined
    );

    if (!borradorCerrado) {
      try {
        await refrescarModuloCheques();
      } catch (error) {
        console.error("Error actualizando listado de cheque en revision:", error);
      }

      toast.error(
        "El cheque fue creado, pero el borrador requiere revision. No se debe reutilizar para crear otro cheque.",
        { id: toastId }
      );
      liberarIdempotencyKeyCheque(idempotency.storageKey);
      return;
    }

    const formularioVacio = crearFormularioChequeVacio();
    formActualRef.current = formularioVacio;
    prepararNuevoBorradorCheque();
    setForm(formularioVacio);
    chequeFinalizado = true;

    liberarIdempotencyKeyCheque(idempotency.storageKey);

    try {
      await refrescarModuloCheques();
    } catch (error) {
      console.error("Error actualizando listado despues de crear cheque:", error);
      toast.error("El cheque fue creado, pero no se pudo actualizar el listado.");
    }

    toast.success("Cheque enviado a autorizacion", { id: toastId });
  } catch (error: any) {
    console.error(error);

    if (chequeCreadoIdRef.current !== null && !rpcCreoCheque) {
      await registrarAuditoriaCheque(
        {
          empresa_id: Number(form.empresaId),
          modulo: "cheques",
          accion: "creacion_cheque_parcial",
          entidad_tipo: "cheque",
          entidad_id: chequeCreadoIdRef.current,
          estado_nuevo: "pendiente_revision",
          descripcion: "Creacion de cheque quedo parcialmente aplicada",
          sensible: true,
          visible_calendario: Boolean(form.fechaPago),
          origen: "modulo_cheques",
          metadatos: {
            beneficiario: form.beneficiario,
            monto: Number(form.monto),
            moneda: form.moneda,
            forma_pago: form.formaPago,
            etapa_fallida: etapaCreacion,
            motivo_error: error.message || "Error no identificado",
          },
        },
        "creacion parcial del cheque"
      );
      await registrarCreacionParcialParaRevision(
        chequeCreadoIdRef.current,
        "El cheque fue creado, pero fallo la reserva del cheque fisico o el historial.",
        borradorParaCheque || undefined
      );
      toast.error(
        "El cheque fue creado parcialmente y requiere revision. No lo reintentes desde el borrador.",
        { id: toastId }
      );
    } else {
      toast.error(error.message || "Error al crear cheque", { id: toastId });
    }

    if (!chequeFinalizado && !rpcEjecutada) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
    }
  } finally {
    setProcesandoId(null);
    if (chequeFinalizado) {
      chequeCreadoIdRef.current = null;
      borradorConsumidoRef.current = false;
      autoguardadoSuspendidoRef.current = false;
      setMensajeBorradorBloqueado(null);
    } else if (
      chequeCreadoIdRef.current === null &&
      !borradorConsumidoRef.current
    ) {
      autoguardadoSuspendidoRef.current = false;
      void guardarBorradorChequeActual();
    }
  }
}

  async function registrarHistorial(
    chequeId: number,
    accion: string,
    estadoAnterior: string | null,
    estadoNuevo: string,
    comentario?: string
  ) {
    const { error } = await supabase.from("cheques_historial").insert([
      {
        cheque_id: chequeId,
        modulo: "cheques",
        accion,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        comentario: comentario || null,
        usuario_id: userId,

        sensible:
  accion === "Anulado" ||
  accion === "Pagado" ||
  accion === "Rechazado",

      },
    ]);

    if (error) {
      console.error("No se pudo registrar cheques_historial:", error);
      return false;
    }

    return true;
  }

async function autorizarCheque(cheque: Cheque) {
  if (procesandoId !== null) {
    toast.error("Ya hay una operacion de cheques en proceso.");
    return;
  }

  if (!userId) return;
  if (esAuditorSoloLecturaCheque(cheque.empresa_id)) {
    toast.error("El auditor solo lectura no puede autorizar cheques.");
    return;
  }
  if (!tieneFuncionCheque(userId, cheque.empresa_id, ["autorizador_cheque", "firmante_cheque"]) && !puedeAprobar) {
    toast.error("No tienes funcion operativa para autorizar cheques en esta empresa.");
    return;
  }

  const idempotency = obtenerIdempotencyKeyCheque(
    ["autorizar_cheque_rpc", userId, cheque.id, cheque.estado].join(":")
  );

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Autorizando cheque...");
  let rpcEjecutada = false;

  try {
    rpcEjecutada = true;
    const { data, error } = await supabase.rpc(
      "autorizar_cheque_transaccional",
      {
        p_cheque_id: cheque.id,
        p_empresa_id: cheque.empresa_id,
        p_autorizado_por: userId,
        p_idempotency_key: idempotency.key,
      }
    );

    if (error) throw error;

    const resultado = data as { ok?: boolean; mensaje?: string; cheque?: Cheque } | null;

    if (!resultado?.ok || !resultado.cheque) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
      throw new Error(resultado?.mensaje || "No se pudo autorizar el cheque.");
    }

    liberarIdempotencyKeyCheque(idempotency.storageKey);

    try {
      await refrescarModuloCheques();
    } catch (refreshError) {
      console.error("Error actualizando listado despues de autorizar cheque:", refreshError);
      toast.error("Cheque autorizado, pero no se pudo actualizar el listado.", {
        id: toastId,
      });
      return;
    }

    toast.success("Cheque autorizado y fondos comprometidos", { id: toastId });
  } catch (error: any) {
    toast.error(error.message || "Error al autorizar", { id: toastId });

    if (!rpcEjecutada) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
    }
  } finally {
    setProcesandoId(null);
  }
}

async function rechazarCheque(cheque: Cheque) {
  if (procesandoId !== null) {
    toast.error("Ya hay una operacion de cheques en proceso.");
    return;
  }

  if (esAuditorSoloLecturaCheque(cheque.empresa_id)) {
    toast.error("El auditor solo lectura no puede rechazar cheques.");
    return;
  }

  if (!userId) return;

  const motivo = window.prompt("Indica el motivo del rechazo:");

  if (!motivo) {
    toast.error("Debes indicar un motivo");
    return;
  }

  const idempotency = obtenerIdempotencyKeyCheque(
    ["rechazar_cheque_rpc", userId, cheque.id, cheque.estado, motivo.trim()].join(":")
  );

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Rechazando cheque...");
  let rpcEjecutada = false;

  try {
    rpcEjecutada = true;
    const { data, error } = await supabase.rpc(
      "rechazar_cheque_transaccional",
      {
        p_cheque_id: cheque.id,
        p_empresa_id: cheque.empresa_id,
        p_rechazado_por: userId,
        p_motivo_rechazo: motivo.trim(),
        p_idempotency_key: idempotency.key,
      }
    );

    if (error) throw error;

    const resultado = data as { ok?: boolean; mensaje?: string; cheque?: Cheque } | null;

    if (!resultado?.ok || !resultado.cheque) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
      throw new Error(resultado?.mensaje || "No se pudo rechazar el cheque.");
    }

    liberarIdempotencyKeyCheque(idempotency.storageKey);

    try {
      await refrescarModuloCheques();
    } catch (refreshError) {
      console.error("Error actualizando listado despues de rechazar cheque:", refreshError);
      toast.error("Cheque rechazado, pero no se pudo actualizar el listado.", {
        id: toastId,
      });
      return;
    }

    toast.success("Cheque rechazado y fondos liberados", { id: toastId });
  } catch (error: any) {
    toast.error(error.message || "Error al rechazar", { id: toastId });

    if (!rpcEjecutada) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
    }
  } finally {
    setProcesandoId(null);
  }
}

async function archivarCheque(cheque: Cheque) {
  if (procesandoId !== null) {
    toast.error("Ya hay una operacion de cheques en proceso.");
    return;
  }

  if (esAuditorSoloLecturaCheque(cheque.empresa_id)) {
    toast.error("El auditor solo lectura no puede archivar cheques.");
    return;
  }

  if (!userId) return;

const motivo = window.prompt("Indica el motivo de anulaciÃ³n:");

  if (!motivo) {
    toast.error("Debes indicar un motivo");
    return;
  }

  const idempotency = obtenerIdempotencyKeyCheque(
    ["anular_cheque_rpc", userId, cheque.id, cheque.estado, motivo.trim()].join(":")
  );

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Anulando cheque...");
  let rpcEjecutada = false;

  try {
    rpcEjecutada = true;
    const { data, error } = await supabase.rpc(
      "anular_cheque_transaccional",
      {
        p_cheque_id: cheque.id,
        p_empresa_id: cheque.empresa_id,
        p_anulado_por: userId,
        p_motivo_anulacion: motivo.trim(),
        p_idempotency_key: idempotency.key,
      }
    );

    if (error) throw error;

    const resultado = data as { ok?: boolean; mensaje?: string; cheque?: Cheque } | null;

    if (!resultado?.ok || !resultado.cheque) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
      throw new Error(resultado?.mensaje || "No se pudo anular el cheque.");
    }

    liberarIdempotencyKeyCheque(idempotency.storageKey);

    try {
      await refrescarModuloCheques();
    } catch (refreshError) {
      console.error("Error actualizando listado despues de anular cheque:", refreshError);
      toast.error("Cheque anulado, pero no se pudo actualizar el listado.", {
        id: toastId,
      });
      return;
    }

    toast.success("Cheque anulado y fondos liberados", { id: toastId });
  } catch (error: any) {
    toast.error(error.message || "Error al anular cheque", { id: toastId });

    if (!rpcEjecutada) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
    }
  } finally {
    setProcesandoId(null);
  }
}

async function marcarPagado(cheque: Cheque) {
  if (procesandoId !== null) {
    toast.error("Ya hay una operacion de cheques en proceso.");
    return;
  }

  if (!userId) return;
  if (esAuditorSoloLecturaCheque(cheque.empresa_id)) {
    toast.error("El auditor solo lectura no puede pagar cheques.");
    return;
  }
  if (!cheque.empresa_id) {
    toast.error("No se puede pagar un cheque sin empresa asociada.");
    return;
  }
  if (!usuarioActualPuedePagarCheque(cheque)) {
    toast.error("No tienes funcion operativa de pagador de cheques para esta empresa.");
    return;
  }

  const idempotency = obtenerIdempotencyKeyCheque(
    [
      "pagar_cheque_rpc",
      userId,
      cheque.id,
      cheque.estado,
      cheque.monto,
      cheque.fondo_empresa_id,
      cheque.movimiento_generado,
    ].join(":")
  );

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Marcando como pagado...");
  let rpcEjecutada = false;

  try {
    await validarRespaldoDocumentalActivo({
      empresa_id: cheque.empresa_id,
      modulo: "cheques",
      entidad_tipo: "cheque",
      entidad_id: cheque.id,
      operacion: "pagar/finalizar cheque",
      tipos_documento: [
        "cheque escaneado",
        "recibo",
        "voucher",
        "transferencia",
        "depÃ³sito",
        "deposito",
        "comprobante",
        "documento soporte",
      ],
    });

    rpcEjecutada = true;
    const { data, error } = await supabase.rpc(
      "pagar_cheque_transaccional",
      {
        p_cheque_id: cheque.id,
        p_empresa_id: cheque.empresa_id,
        p_pagado_por: userId,
        p_idempotency_key: idempotency.key,
      }
    );

    if (error) throw error;

    const resultado = data as { ok?: boolean; mensaje?: string; cheque?: Cheque } | null;

    if (!resultado?.ok || !resultado.cheque) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
      throw new Error(resultado?.mensaje || "No se pudo pagar el cheque.");
    }

    liberarIdempotencyKeyCheque(idempotency.storageKey);

    try {
      await refrescarModuloCheques();
    } catch (refreshError) {
      console.error("Error actualizando listado despues de pagar cheque:", refreshError);
      toast.error("Cheque pagado, pero no se pudo actualizar el listado.", {
        id: toastId,
      });
      return;
    }

    toast.success("Cheque pagado y registrado en contabilidad", {
      id: toastId,
    });
  } catch (error: any) {
    toast.error(error.message || "Error al pagar cheque", { id: toastId });

    if (!rpcEjecutada) {
      liberarIdempotencyKeyCheque(idempotency.storageKey);
    }
  } finally {
    setProcesandoId(null);
  }
}

  function money(valor: number, moneda: string | null = "GTQ") {
    return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-GT", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "GTQ",
    }).format(Number(valor || 0));
  }

  function formatoTiempo(ms: number) {
    const abs = Math.abs(ms);
    const minutos = Math.floor(abs / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (dias > 0) return `${dias}d ${horas % 24}h`;
    if (horas > 0) return `${horas}h ${minutos % 60}m`;
    return `${minutos}m`;
  }

  function estadoTiempo(cheque: Cheque) {
   if (
  cheque.estado === "Autorizado" ||
  cheque.estado === "Pagado" ||
  cheque.estado === "Rechazado" ||
  cheque.estado === "Anulado"
) {
      return {
        texto: "Proceso cerrado",
        color: "text-gray-400",
        borde: "border-white/10",
        fondo: "bg-white/5",
      };
    }

    if (!cheque.fecha_limite_autorizacion) {
      return {
        texto: "Sin lÃ­mite",
        color: "text-gray-400",
        borde: "border-white/10",
        fondo: "bg-white/5",
      };
    }

    const limite = new Date(cheque.fecha_limite_autorizacion);
    const diff = limite.getTime() - now.getTime();

    if (diff < 0) {
      return {
        texto: `Vencido hace ${formatoTiempo(diff)}`,
        color: "text-red-400",
        borde: "border-red-500/30",
        fondo: "bg-red-500/10",
      };
    }

    if (diff <= 1000 * 60 * 60 * 2) {
      return {
        texto: `Por vencer en ${formatoTiempo(diff)}`,
        color: "text-yellow-400",
        borde: "border-yellow-500/30",
        fondo: "bg-yellow-500/10",
      };
    }

    return {
      texto: `En tiempo: ${formatoTiempo(diff)} restantes`,
      color: "text-green-400",
      borde: "border-green-500/30",
      fondo: "bg-green-500/10",
    };
  }

  const chequesFiltrados = useMemo(() => {
    return cheques.filter((c) => {
      const perteneceAEmpresaPermitida =
        c.empresa_id !== null &&
        empresasPermitidasIds.includes(Number(c.empresa_id));

      const matchEstado =
        filtroEstado === "Todos" ? true : c.estado === filtroEstado;

      const matchEmpresa =
        filtroEmpresa === "Todas"
          ? true
          : Number(c.empresa_id) === Number(filtroEmpresa);

      return perteneceAEmpresaPermitida && matchEstado && matchEmpresa;
    });
  }, [cheques, filtroEstado, filtroEmpresa, empresasPermitidasIds]);

  const resumenChequerasVisibles = useMemo(() => {
    return resumenChequeras.filter((chequera) => {
      const perteneceAEmpresaOperativa = empresasPermitidasIds.includes(
        Number(chequera.empresa_id)
      );
      const matchEmpresa =
        filtroEmpresa === "Todas"
          ? true
          : Number(chequera.empresa_id) === Number(filtroEmpresa);

      return (
        perteneceAEmpresaOperativa &&
        matchEmpresa &&
        esEstadoOperativo(chequera.estado)
      );
    });
  }, [resumenChequeras, filtroEmpresa, empresasPermitidasIds]);

  const fondosVisibles = useMemo(() => {
    return fondos.filter((fondo) => {
      const perteneceAEmpresaOperativa = empresasPermitidasIds.includes(
        Number(fondo.empresa_id)
      );
      const matchEmpresa =
        filtroEmpresa === "Todas"
          ? true
          : Number(fondo.empresa_id) === Number(filtroEmpresa);

      return (
        perteneceAEmpresaOperativa &&
        matchEmpresa &&
        esEstadoOperativo(fondo.estado)
      );
    });
  }, [fondos, filtroEmpresa, empresasPermitidasIds]);

  useEffect(() => {
    if (
      filtroEmpresa !== "Todas" &&
      !empresas.some((empresa) => Number(empresa.id) === Number(filtroEmpresa))
    ) {
      setFiltroEmpresa("Todas");
    }
  }, [empresas, filtroEmpresa]);

const stats = useMemo(() => {
  const pendientes = chequesFiltrados.filter(
    (c) => c.estado === "Pendiente de autorizaciÃ³n"
  ).length;

  const autorizados = chequesFiltrados.filter(
    (c) => c.estado === "Autorizado"
  ).length;

  const pagados = chequesFiltrados.filter(
    (c) => c.estado === "Pagado"
  ).length;

  const rechazados = chequesFiltrados.filter(
    (c) => c.estado === "Rechazado"
  ).length;

  const anulados = chequesFiltrados.filter(
    (c) => c.estado === "Anulado"
  ).length;

  const vencidos = chequesFiltrados.filter((c) => {
    if (!c.fecha_limite_autorizacion) return false;
    if (c.estado !== "Pendiente de autorizaciÃ³n") return false;
    return new Date(c.fecha_limite_autorizacion) < now;
  }).length;

  const comprometidoGTQ = chequesFiltrados
    .filter(
      (c) =>
        c.estado_fondo === "comprometido" &&
        (c.moneda || "GTQ") === "GTQ"
    )
    .reduce((total, c) => total + Number(c.monto || 0), 0);

  const comprometidoUSD = chequesFiltrados
    .filter(
      (c) =>
        c.estado_fondo === "comprometido" &&
        (c.moneda || "GTQ") === "USD"
    )
    .reduce((total, c) => total + Number(c.monto || 0), 0);

  return {
    pendientes,
    autorizados,
    pagados,
    rechazados,
    anulados,
    vencidos,
    comprometidoGTQ,
    comprometidoUSD,
  };
}, [chequesFiltrados, now]);

const usuariosMap = useMemo(() => {
  return usuarios.reduce((acc, usuario) => {
    acc[usuario.id] = usuario.nombre;
    return acc;
  }, {} as Record<string, string>);
}, [usuarios]);


const puedeAprobar = ROLES_JEFATURA.includes(
  (perfilActual?.rol || "").trim().toLowerCase()
);

useEffect(() => {
  if (
    chequeCreadoIdRef.current !== null ||
    autoguardadoSuspendidoRef.current ||
    !autorizado ||
    !borradorRevisado ||
    mensajeBorradorBloqueado ||
    !formularioChequeTieneContenido(form)
  ) {
    return;
  }

  timeoutBorradorRef.current = window.setTimeout(() => {
    timeoutBorradorRef.current = null;
    void guardarBorradorChequeActual(form);
  }, 1500);

  return () => {
    if (timeoutBorradorRef.current !== null) {
      window.clearTimeout(timeoutBorradorRef.current);
      timeoutBorradorRef.current = null;
    }
  };
}, [autorizado, borradorRevisado, form, mensajeBorradorBloqueado]);

useEffect(() => {
  if (
    chequeCreadoIdRef.current !== null ||
    autoguardadoSuspendidoRef.current ||
    !autorizado ||
    !borradorRevisado ||
    mensajeBorradorBloqueado
  ) {
    return;
  }

  const intervalo = window.setInterval(() => {
    void guardarBorradorChequeActual();
  }, 15 * 60 * 1000);

  return () => window.clearInterval(intervalo);
}, [autorizado, borradorRevisado, mensajeBorradorBloqueado]);

  if (validandoAcceso || !autorizado) {
    return (
      <div className="h-screen bg-[#020617] text-cyan-400 flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
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
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">Cheques</h1>

              <p className="text-gray-400 mt-2">
                Control de autorizaciÃ³n, tiempos, atrasos y pagos
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
  <Stat
    label="Pendientes"
    value={stats.pendientes}
    color="text-yellow-400"
    loading={cargandoCheques}
  />

  <Stat
    label="Vencidos"
    value={stats.vencidos}
    color="text-red-400"
    loading={cargandoCheques}
  />

  <Stat
    label="Autorizados"
    value={stats.autorizados}
    color="text-cyan-400"
    loading={cargandoCheques}
  />

  <Stat
    label="Pagados"
    value={stats.pagados}
    color="text-green-400"
    loading={cargandoCheques}
  />

  <Stat
    label="Rechazados"
    value={stats.rechazados}
    color="text-red-400"
    loading={cargandoCheques}
  />

  <Stat
    label="Anulados"
    value={stats.anulados}
    color="text-yellow-400"
    loading={cargandoCheques}
  />

  <StatMoney
    label="Comp. GTQ"
    value={money(stats.comprometidoGTQ, "GTQ")}
    color="text-cyan-300"
    loading={cargandoCheques}
  />

  <StatMoney
    label="Comp. USD"
    value={money(stats.comprometidoUSD, "USD")}
    color="text-green-300"
    loading={cargandoCheques}
  />
</div>
          </header>

          {cargandoCheques ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando datos de cheques...
            </section>
          ) : (
            <>
          {mensajeBorradorBloqueado && (
            <section className="bg-red-500/10 border border-red-500/30 rounded-[2rem] p-6 mb-8 text-red-200">
              <p className="font-bold">{mensajeBorradorBloqueado}</p>
            </section>
          )}

          {!mensajeBorradorBloqueado && borradorActivo && !borradorRevisado && (
            <section className="bg-cyan-500/10 border border-cyan-500/30 rounded-[2rem] p-6 mb-8">
              <h2 className="font-bold text-cyan-200 mb-2">
                Tienes un cheque pendiente. Â¿Deseas continuar donde quedaste?
              </h2>
              <p className="text-sm text-gray-400 mb-5">
                Puedes recuperar el formulario guardado o descartarlo para comenzar de nuevo.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={continuarConBorradorCheque}
                  disabled={procesandoBorrador}
                  className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase disabled:opacity-50"
                >
                  Continuar cheque
                </button>
                <button
                  type="button"
                  onClick={descartarBorradorChequePendiente}
                  disabled={procesandoBorrador}
                  className="px-5 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-xs font-black uppercase disabled:opacity-50"
                >
                  Descartar borrador
                </button>
              </div>
            </section>
          )}

          {!mensajeBorradorBloqueado && borradorRevisado && (
          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
            <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Plus size={16} className="text-cyan-500" />
              Crear cheque y enviar a autorizaciÃ³n
            </h2>

            <button
              type="button"
              onClick={() => alternarSeccionCheques("cheque")}
              className="mb-4 inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-[11px] font-black uppercase text-cyan-200"
            >
              {seccionesChequesAbiertas.cheque ? "Ocultar formulario" : "Abrir formulario"}
            </button>

            {procesandoBorrador && (
              <p className="mb-4 text-xs text-cyan-300">
                Guardando borrador...
              </p>
            )}

            {seccionesChequesAbiertas.cheque && (
            <div className="grid md:grid-cols-4 gap-4">
              <select
                value={form.empresa}
                onChange={(e) => {
                  const empresa = empresas.find(
                    (emp) => emp.nombre === e.target.value
                  );

                  setForm({
                    ...form,
                    empresa: e.target.value,
                    empresaId: empresa ? String(empresa.id) : "",
                    fondoEmpresaId: "",
                    chequeraId: "",
                    chequeFisicoId: "",
                    numeroCheque: "",
                    banco: "",
                    cuentaBancaria: "",
                  });
                }}
                className="input-custom"
              >
                <option value="">Empresa...</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.nombre}>
                    {emp.nombre}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Beneficiario"
                value={form.beneficiario}
                onChange={(e) =>
                  setForm({ ...form, beneficiario: e.target.value })
                }
                className="input-custom"
              />

              <input
                type="text"
                placeholder="Concepto / descripciÃ³n"
                value={form.concepto}
                onChange={(e) =>
                  setForm({ ...form, concepto: e.target.value })
                }
                className="input-custom"
              />

              <input
                type="number"
                placeholder={`Monto en ${form.moneda}`}
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className="input-custom"
              />

              <select
                value={form.tipoPago}
                onChange={(e) =>
                  setForm({ ...form, tipoPago: e.target.value })
                }
                className="input-custom"
              >
                <option value="Proveedor">Proveedor</option>
                <option value="Planilla">Planilla</option>
                <option value="Servicios">Servicios</option>
                <option value="Impuestos">Impuestos</option>
                <option value="Otro">Otro</option>
              </select>

              <select
                value={form.formaPago}
                onChange={(e) => {
                  const formaPago = e.target.value;

                  setForm({
                    ...form,
                    formaPago,
                    ...(formaPago === "Cheque"
                      ? {}
                      : {
                          chequeraId: "",
                          chequeFisicoId: "",
                          numeroCheque: "",
                        }),
                  });
                }}
                className="input-custom"
              >
                <option value="Cheque">Cheque</option>
                <option value="DepÃ³sito">DepÃ³sito</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
              </select>

<select
  value={form.moneda}
  onChange={(e) =>
    setForm({
      ...form,
      moneda: e.target.value,
      fondoEmpresaId: "",
      chequeraId: "",
      chequeFisicoId: "",
      numeroCheque: "",
      banco: "",
      cuentaBancaria: "",
    })
  }
  className="input-custom"
>
  <option value="GTQ">Quetzales (GTQ)</option>
  <option value="USD">DÃ³lares (USD)</option>
</select>

<select
  value={form.fondoEmpresaId}
  onChange={(e) => {
    const fondo = fondosDisponibles.find(
      (f) => String(f.id) === e.target.value
    );

    setForm({
      ...form,
      fondoEmpresaId: e.target.value,
      chequeraId: "",
      chequeFisicoId: "",
      numeroCheque: "",
      banco: fondo?.banco || "",
      cuentaBancaria: fondo?.cuenta_bancaria || "",
      moneda: fondo?.moneda || form.moneda,
    });
  }}
  className="input-custom"
>
  <option value="">Cuenta / fondo...</option>
  {fondosDisponibles.map((fondo) => (
    <option key={fondo.id} value={String(fondo.id)}>
      {fondo.banco || "Banco"} â€” {fondo.cuenta_bancaria || "Sin cuenta"} â€”{" "}
      {fondo.moneda} â€” Disp: {money(Number(fondo.saldo_disponible || 0), fondo.moneda)}
    </option>
  ))}
</select>
{form.formaPago === "Cheque" && (
  <>
<select
  value={form.chequeraId}
  onChange={(e) => {
    setForm({
      ...form,
      chequeraId: e.target.value,
      chequeFisicoId: "",
      numeroCheque: "",
    });
  }}
  className="input-custom"
  disabled={form.formaPago !== "Cheque" || !form.fondoEmpresaId}
>
<option value="">
  {form.fondoEmpresaId
    ? chequerasDisponibles.length > 0
      ? "Chequera..."
      : "No hay chequeras para esta cuenta/moneda"
    : "Primero selecciona cuenta/fondo"}
</option>
{chequerasDisponibles.map((chequera) => (
    <option key={chequera.id} value={String(chequera.id)}>
      {chequera.banco || "Banco"} â€” {chequera.cuenta_bancaria || "Sin cuenta"} â€”{" "}
      {chequera.numero_inicial} a {chequera.numero_final} â€” {chequera.moneda}
    </option>
  ))}
</select>

<select
  value={form.chequeFisicoId}
  onChange={(e) => {
    const chequeFisico = chequesFisicosDisponibles.find(
      (cf) => String(cf.id) === e.target.value
    );

    setForm({
      ...form,
      chequeFisicoId: e.target.value,
      numeroCheque: chequeFisico ? String(chequeFisico.numero_cheque) : "",
    });
  }}
  className="input-custom"
  disabled={form.formaPago !== "Cheque" || !form.chequeraId}
>
<option value="">
  {form.chequeraId
    ? chequesFisicosDisponibles.length > 0
      ? "NÃºmero de cheque..."
      : "No hay cheques disponibles"
    : "Primero selecciona chequera"}
</option>
{chequesFisicosDisponibles.map((cf) => (
    <option key={cf.id} value={String(cf.id)}>
      Cheque No. {cf.numero_cheque} â€” {cf.moneda}
    </option>
  ))}
</select>
  </>
)}

              <select
                value={form.prioridad}
                onChange={(e) =>
                  setForm({ ...form, prioridad: e.target.value })
                }
                className="input-custom"
              >
                <option value="Alta">Prioridad Alta</option>
                <option value="Media">Prioridad Media</option>
                <option value="Baja">Prioridad Baja</option>
              </select>

              <input
                type="date"
                value={form.fechaPago}
                onChange={(e) =>
                  setForm({ ...form, fechaPago: e.target.value })
                }
                className="input-custom"
              />

              <select
                value={form.responsableActual}
                onChange={(e) =>
                  setForm({ ...form, responsableActual: e.target.value })
                }
                className="input-custom"
              >
                <option value="">Responsable autorizaciÃ³n...</option>
                {usuarios
                  .filter((u) =>
                    u.activo !== false &&
                    usuarioPuedeAutorizarCheque(u, Number(form.empresaId || 0))
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} â€” {u.rol}
                    </option>
                  ))}
              </select>

              <button
                onClick={crearCheque}
                className="md:col-span-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Enviar cheque a autorizaciÃ³n
              </button>
            </div>
            )}
          </section>
          )}

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-green-500">
  <div className="mb-6 flex items-center justify-between gap-4">
    <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase">
      Registrar fondo / cuenta bancaria
    </h2>
    <button
      type="button"
      onClick={() => alternarSeccionCheques("fondo")}
      className="rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-[11px] font-black uppercase text-green-200"
    >
      {seccionesChequesAbiertas.fondo ? "Ocultar formulario" : "Abrir formulario"}
    </button>
  </div>

  {seccionesChequesAbiertas.fondo && (
  <div className="grid md:grid-cols-6 gap-4">
    <select
      value={formFondo.empresa}
      onChange={(e) => {
        const empresa = empresas.find(
          (emp) => emp.nombre === e.target.value
        );

        setFormFondo({
          ...formFondo,
          empresa: e.target.value,
          empresaId: empresa ? String(empresa.id) : "",
        });
      }}
      className="input-custom"
    >
      <option value="">Empresa...</option>
      {empresas.map((emp) => (
        <option key={emp.id} value={emp.nombre}>
          {emp.nombre}
        </option>
      ))}
    </select>

    <input
      type="text"
      placeholder="Banco"
      value={formFondo.banco}
      onChange={(e) =>
        setFormFondo({ ...formFondo, banco: e.target.value })
      }
      className="input-custom"
    />

    <input
      type="text"
      placeholder="Cuenta bancaria"
      value={formFondo.cuentaBancaria}
      onChange={(e) =>
        setFormFondo({ ...formFondo, cuentaBancaria: e.target.value })
      }
      className="input-custom"
    />

    <select
      value={formFondo.moneda}
      onChange={(e) =>
        setFormFondo({ ...formFondo, moneda: e.target.value })
      }
      className="input-custom"
    >
      <option value="GTQ">Quetzales GTQ</option>
      <option value="USD">DÃ³lares USD</option>
    </select>

    <input
      type="number"
      placeholder="Saldo base"
      value={formFondo.saldoBase}
      onChange={(e) =>
        setFormFondo({ ...formFondo, saldoBase: e.target.value })
      }
      className="input-custom"
    />

    <button
      onClick={crearFondo}
      className="bg-green-500 hover:bg-green-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
    >
      <Plus size={16} />
      Crear fondo
    </button>
  </div>
  )}
</section>

<section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-yellow-500">
  <div className="mb-6 flex items-center justify-between gap-4">
    <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase">
      Registrar chequera
    </h2>
    <button
      type="button"
      onClick={() => alternarSeccionCheques("chequera")}
      className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-[11px] font-black uppercase text-yellow-200"
    >
      {seccionesChequesAbiertas.chequera ? "Ocultar formulario" : "Abrir formulario"}
    </button>
  </div>

  {seccionesChequesAbiertas.chequera && (
  <div className="grid md:grid-cols-6 gap-4">
    <select
      value={formChequera.fondoEmpresaId}
      onChange={(e) => {
        const fondo = fondosVisibles.find((f) => String(f.id) === e.target.value);

        setFormChequera({
          ...formChequera,
          fondoEmpresaId: e.target.value,
          empresaId: fondo ? String(fondo.empresa_id) : "",
          empresa: fondo?.empresa || "",
          banco: fondo?.banco || "",
          cuentaBancaria: fondo?.cuenta_bancaria || "",
          moneda: fondo?.moneda || "GTQ",
        });
      }}
      className="input-custom"
    >
      <option value="">Cuenta / fondo...</option>
      {fondosVisibles.map((fondo) => (
        <option key={fondo.id} value={String(fondo.id)}>
          {fondo.empresa} â€” {fondo.banco || "Banco"} â€”{" "}
          {fondo.cuenta_bancaria || "Sin cuenta"} â€” {fondo.moneda}
        </option>
      ))}
    </select>



    <input
      type="text"
      placeholder="Banco"
      value={formChequera.banco}
      readOnly
      className="input-custom opacity-70"
    />

    <input
      type="text"
      placeholder="Cuenta bancaria"
      value={formChequera.cuentaBancaria}
      readOnly
      className="input-custom opacity-70"
    />

    <input
      type="text"
      placeholder="Moneda"
      value={formChequera.moneda}
      readOnly
      className="input-custom opacity-70"
    />

    <input
      type="number"
      placeholder="No. inicial"
      value={formChequera.numeroInicial}
      onChange={(e) =>
        setFormChequera({
          ...formChequera,
          numeroInicial: e.target.value,
        })
      }
      className="input-custom"
    />

    <input
      type="number"
      placeholder="No. final"
      value={formChequera.numeroFinal}
      onChange={(e) =>
        setFormChequera({
          ...formChequera,
          numeroFinal: e.target.value,
        })
      }
      className="input-custom"
    />

    <button
      onClick={crearChequera}
      className="md:col-span-6 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
    >
      <Plus size={16} />
      Crear chequera y generar nÃºmeros
    </button>
  </div>
  )}
</section>

<section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8">
  <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase">
    Resumen de chequeras
  </h2>

  {resumenChequerasVisibles.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No hay chequeras registradas.
    </p>
  ) : (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {resumenChequerasVisibles.map((ch) => (
        <div
          key={ch.chequera_id}
          className="rounded-2xl border border-white/10 bg-black/20 p-5"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                {ch.empresa}
              </p>

              <h3 className="text-lg font-black mt-1">
                {ch.banco || "Banco no registrado"}
              </h3>

              <p className="text-xs text-gray-400 mt-1">
                Cuenta: {ch.cuenta_bancaria || "Sin cuenta"}
              </p>

              <p className="text-xs text-cyan-300 mt-2 font-bold">
                Chequera {ch.numero_inicial} - {ch.numero_final}
              </p>
            </div>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
              {ch.moneda}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
          <MiniStat label="Total" value={ch.cheques_generados} />
          <MiniStat label="Disponibles" value={ch.disponibles} />
          <MiniStat label="Reservados" value={ch.reservados} />
          <MiniStat label="Emitidos" value={ch.emitidos} />
          <MiniStat label="Firmados" value={ch.firmados} />
          <MiniStat label="Pagados" value={ch.pagados} />
          <MiniStat label="Rechazados" value={ch.rechazados} />
          <MiniStat label="Anulados" value={ch.anulados} />
          </div>
        </div>
      ))}
    </div>
  )}
</section>

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8">
  <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase">
    Fondos por cuenta bancaria
  </h2>

  {fondosVisibles.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No hay fondos o cuentas bancarias registradas.
    </p>
  ) : (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {fondosVisibles.map((fondo) => (
        <div
          key={fondo.id}
          className="rounded-2xl border border-white/10 bg-black/20 p-5"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                {fondo.empresa}
              </p>

              <h3 className="text-lg font-black mt-1">
                {fondo.banco || "Banco no registrado"}
              </h3>

              <p className="text-xs text-gray-400 mt-1">
                Cuenta: {fondo.cuenta_bancaria || "Sin cuenta"}
              </p>
            </div>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {fondo.moneda}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
              <p className="text-[9px] text-gray-500 uppercase font-bold">
                Base
              </p>
              <p className="text-sm font-black text-white mt-1">
                {money(Number(fondo.saldo_base || 0), fondo.moneda)}
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
              <p className="text-[9px] text-gray-500 uppercase font-bold">
                Comprometido
              </p>
              <p className="text-sm font-black text-yellow-300 mt-1">
                {money(Number(fondo.saldo_comprometido || 0), fondo.moneda)}
              </p>  
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
              <p className="text-[9px] text-gray-500 uppercase font-bold">
                Disponible
              </p>
              <p className="text-sm font-black text-green-300 mt-1">
                {money(Number(fondo.saldo_disponible || 0), fondo.moneda)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

          <section className="flex flex-col md:flex-row gap-4 mb-6">
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="input-custom md:w-72"
            >
              <option value="Todas">Todas las empresas</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input-custom md:w-72"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Pendiente de autorizaciÃ³n">
                Pendiente de autorizaciÃ³n
              </option>
              <option value="Autorizado">Autorizado</option>
             <option value="Anulado">Anulado</option>
<option value="Rechazado">Rechazado</option>
<option value="Pagado">Pagado</option>
            </select>
          </section>

          <section className="grid gap-4">
            {chequesFiltrados.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <p className="text-gray-500">No hay cheques para mostrar.</p>
              </div>
            )}

            {chequesFiltrados.map((cheque) => (
              <ChequeCard
                key={cheque.id}
                cheque={cheque}
                historialCheques={historialCheques}
                rolActual={perfilActual?.rol || ""}
                usuariosMap={usuariosMap}
                tiempo={estadoTiempo(cheque)}
                money={money}
                puedeAprobar={puedeAprobar}
                puedePagar={usuarioActualPuedePagarCheque(cheque)}
                procesando={procesandoId === cheque.id}
                onAutorizar={() => autorizarCheque(cheque)}
                onRechazar={() => rechazarCheque(cheque)}
                onArchivar={() => archivarCheque(cheque)}
                onPagado={() => marcarPagado(cheque)}
              />
            ))}
          </section>
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        .input-custom {
          height: 3.5rem;
          padding: 0 1rem;
          border-radius: 0.9rem;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          outline: none;
          font-size: 0.82rem;
        }

        .input-custom option {
          background: #0f172a;
          color: white;
        }

        .input-custom:focus {
          border-color: #06b6d4;
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  loading = false,
}: {
  label: string;
  value: number;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[130px]">
      <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
        {label}
      </p>
      <h2 className={`text-2xl font-black mt-1 ${color}`}>
        {loading ? (
          <span className="text-xs text-gray-500">Cargando...</span>
        ) : (
          value
        )}
      </h2>
    </div>
  );
}

function StatMoney({
  label,
  value,
  color,
  loading = false,
}: {
  label: string;
  value: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 min-w-[130px]">
      <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">
        {label}
      </p>
      <h2 className={`text-lg font-black mt-1 ${color}`}>
        {loading ? (
          <span className="text-xs text-gray-500">Cargando...</span>
        ) : (
          value
        )}
      </h2>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
      <p className="text-[9px] text-gray-500 uppercase font-bold">
        {label}
      </p>
      <p className="text-sm font-black text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function ChequeCard({
  cheque,
  historialCheques,
  rolActual,
  usuariosMap,
  tiempo,
  money,
  puedeAprobar,
  puedePagar,
  procesando,
  onAutorizar,
  onRechazar,
  onArchivar,
  onPagado,
}: {
  cheque: Cheque;
  historialCheques: HistorialCheque[];
  rolActual: string;
  usuariosMap: Record<string, string>;
  tiempo: {
    texto: string;
    color: string;
    borde: string;
    fondo: string;
  };
  money: (valor: number, moneda?: string | null) => string;
  puedeAprobar: boolean;
  puedePagar: boolean;
  procesando: boolean;
  onAutorizar: () => void;
  onRechazar: () => void;
  onArchivar: () => void;
  onPagado: () => void;
}) {

  const esAdmin = ROLES_JEFATURA.includes(
  (rolActual || "").trim().toLowerCase()
);

const historial = historialCheques.filter((h) => {
  if (Number(h.cheque_id) !== Number(cheque.id)) return false;

  if (esAdmin) return true;

  return h.visible_usuario !== false && h.sensible !== true;
});

  return (
    <div
      className={`rounded-[2rem] p-6 border ${tiempo.borde} ${tiempo.fondo}`}
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              #{cheque.id}
            </span>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/10 text-white border border-white/10 uppercase">
              {cheque.estado}
            </span>

            <span
              className={`text-[10px] font-black px-3 py-1 rounded-full border ${tiempo.borde} ${tiempo.color}`}
            >
              {tiempo.texto}
            </span>
          </div>

          <h3 className="text-2xl font-black tracking-tight">
            {cheque.beneficiario}
          </h3>

          <p className="text-gray-400 mt-1">{cheque.concepto}</p>

          <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 mt-4 font-bold uppercase">
            <span className="flex items-center gap-1">
              <Building2 size={14} className="text-cyan-500" />
              {cheque.empresa}
            </span>

            <span className="flex items-center gap-1">
              <DollarSign size={14} className="text-green-500" />
              {money(cheque.monto, cheque.moneda)}
            </span>

            <span className="flex items-center gap-1">
              <DollarSign size={14} className="text-cyan-500" />
              Forma: {cheque.forma_pago || "Cheque"}
            </span>

            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-purple-500" />
              Pago: {cheque.fecha_pago}
            </span>

            <span className="flex items-center gap-1">
              <Clock size={14} className="text-yellow-500" />
              LÃ­mite:{" "}
              {cheque.fecha_limite_autorizacion
                ? new Date(cheque.fecha_limite_autorizacion).toLocaleString()
                : "N/A"}
            </span>
          </div>
          <div className="mt-4 grid md:grid-cols-4 gap-3 text-[11px] font-bold uppercase">
  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-gray-500 text-[9px] mb-1">No. cheque</p>
    <p className="text-cyan-300">
      {cheque.numero_cheque || "N/A"}
    </p>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
  <p className="text-gray-500 text-[9px] mb-1">Tipo cambio</p>
  <p className="text-yellow-300">
    {cheque.tipo_cambio ? cheque.tipo_cambio : "N/A"}
  </p>
</div>

<div className="rounded-xl border border-white/10 bg-black/20 p-3">
  <p className="text-gray-500 text-[9px] mb-1">Equiv. GTQ</p>
  <p className="text-green-300">
    {cheque.monto_gtq
  ? money(cheque.monto_gtq, "GTQ")
  : cheque.tipo_cambio
  ? money(Number(cheque.monto) * Number(cheque.tipo_cambio), "GTQ")
  : "N/A"}
  </p>
</div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-gray-500 text-[9px] mb-1">Banco</p>
    <p className="text-white">
      {cheque.banco || "N/A"}
    </p>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-gray-500 text-[9px] mb-1">Cuenta bancaria</p>
    <p className="text-white">
      {cheque.cuenta_bancaria || "N/A"}
    </p>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-gray-500 text-[9px] mb-1">Estado fondo</p>
    <p className="text-green-300">
      {cheque.estado_fondo || "N/A"}
    </p>
  </div>
</div>

{cheque.motivo_archivo && !cheque.motivo_anulacion && (
  <p className="text-yellow-400 text-xs mt-3">
    Motivo archivo: {cheque.motivo_archivo}
  </p>
)}

{cheque.motivo_rechazo && (
  <p className="text-red-400 text-xs mt-3">
    Motivo rechazo: {cheque.motivo_rechazo}
  </p>
)}

{cheque.motivo_anulacion && (
  <p className="text-yellow-400 text-xs mt-3">
    Motivo anulaciÃ³n: {cheque.motivo_anulacion}
  </p>
)}

{historial.length > 0 && (
  <div className="mt-4 border-t border-white/10 pt-4">
    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black mb-3">
      Historial del cheque
    </p>

    <div className="space-y-2">
      {[...historial]
  .sort(
    (a, b) =>
      new Date(b.created_at || "").getTime() -
      new Date(a.created_at || "").getTime()
  )
  .map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div className="flex items-center justify-between gap-2">
  <p className="text-xs font-black text-cyan-300">
    {item.accion}
  </p>

  {item.sensible && (
    <span className="text-[9px] uppercase font-black px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
      Sensible
    </span>
  )}
</div>

          <p className="text-[10px] text-gray-500 mt-1">
  Estado: {item.estado_anterior || "Inicio"} â†’ {item.estado_nuevo || "Sin estado"}
</p>

          <p className="text-[11px] text-gray-400 mt-1">
            {item.comentario || "Sin comentario"}
          </p>


        <p className="text-[10px] text-gray-500 mt-2">
  Por: {item.usuario_id ? usuariosMap[item.usuario_id] || item.usuario_id : "Sistema"}
</p>

          <p className="text-[10px] text-gray-500 mt-2">
            {item.created_at
              ? new Date(item.created_at).toLocaleString()
              : "Sin fecha"}
          </p>
        </div>
      ))}
    </div>
  </div>
)}

        </div>

        {(puedeAprobar || puedePagar) && (
          <div className="flex flex-wrap xl:flex-col gap-2 min-w-[180px]">
            {puedeAprobar && cheque.estado === "Pendiente de autorizaciÃ³n" && (
              <>
                <button
                  onClick={onAutorizar}
                  disabled={procesando}
                  className="bg-green-500 hover:bg-green-400 text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {procesando ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Autorizar
                </button>

                <button
                  onClick={onRechazar}
                  disabled={procesando}
                  className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Rechazar
                </button>

                <button
                  onClick={onArchivar}
                  disabled={procesando}
                  className="bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                 <Archive size={14} />
                Anular
                </button>
              </>
            )}

            {cheque.estado === "Autorizado" && puedePagar && (
              <button
                onClick={onPagado}
                disabled={procesando}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {procesando ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Marcar pagado
              </button>
            )}
          </div>
        )}
      </div>

      <DocumentosEntidad
        empresaId={cheque.empresa_id}
        modulo="cheques"
        entidadTipo="cheque"
        entidadId={cheque.id}
        titulo="Documentos del cheque"
        numeroCheque={cheque.numero_cheque}
        monto={cheque.monto}
        moneda={cheque.moneda}
        tiposDocumento={TIPOS_DOCUMENTO_CHEQUES}
        disabled={!cheque.empresa_id || !cheque.id}
      />
    </div>
  );
}
