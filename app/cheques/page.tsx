"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
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
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface Cheque {
  id: number;
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
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoCheques, setCargandoCheques] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("Todas");

 const [form, setForm] = useState({
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
});

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

  useEffect(() => {
    iniciar();
  }, []);

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
          toast.error("Tu usuario está inactivo. Contacta al administrador.");
        }

        window.location.href = "/login";
        return;
      }

      if (
        acceso.motivo === "modulo_inactivo" ||
        acceso.motivo === "modulo_no_encontrado"
      ) {
        toast.error("El módulo de Cheques está desactivado.");
      } else {
        toast.error("No tienes acceso al módulo de Cheques.");
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

    setEmpresasPermitidasIds(idsPermitidos);

    await Promise.all([
      obtenerEmpresas(idsPermitidos),
      obtenerUsuarios(),
      obtenerCheques(idsPermitidos, user.id, perfil.rol || ""),
      obtenerFondos(idsPermitidos),
      obtenerChequeras(idsPermitidos),
      obtenerChequesFisicos(idsPermitidos),
      obtenerResumenChequeras(idsPermitidos),
      obtenerHistorialCheques(idsPermitidos, user.id, perfil.rol || ""),
    ]);

  } catch (error) {
    console.error(error);
    toast.error("Error cargando módulo de cheques");
  } finally {
    setCargandoCheques(false);
  }
}
async function obtenerEmpresas(idsPermitidos: number[]) {
  if (!idsPermitidos.length) {
    setEmpresas([]);
    return;
  }

  const { data, error } = await supabase
    .from("empresas")
    .select("id,nombre")
    .in("id", idsPermitidos)
    .order("nombre", { ascending: true });

  if (error) throw error;

  setEmpresas(data || []);
}

  async function obtenerUsuarios() {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre,rol")
      .order("nombre", { ascending: true });

    if (error) throw error;
    setUsuarios(data || []);
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

  setFondos(data || []);
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

  setChequeras(data || []);
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

  setResumenChequeras(data || []);
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
    Number(f.empresa_id) === Number(form.empresaId) &&
    f.moneda === form.moneda &&
    f.estado !== "Inactiva"
  );
});

const chequerasDisponibles = chequeras.filter((c) => {
  if (!form.fondoEmpresaId) return false;

  return (
    Number(c.fondo_empresa_id) === Number(form.fondoEmpresaId) &&
    c.moneda === form.moneda &&
    c.estado === "Activa"
  );
});

const chequesFisicosDisponibles = chequesFisicos.filter((cf) => {
  if (!form.chequeraId) return false;

  return (
    Number(cf.chequera_id) === Number(form.chequeraId) &&
    cf.moneda === form.moneda &&
    cf.estado === "Disponible"
  );
});

async function crearFondo() {
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
    toast.error("Sesión no válida");
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
    toast.error("Sesión no válida");
    return;
  }

  const numeroInicial = Number(formChequera.numeroInicial);
  const numeroFinal = Number(formChequera.numeroFinal);

  if (numeroFinal < numeroInicial) {
    toast.error("El número final no puede ser menor al inicial");
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

 async function crearCheque() {
  if (
    !form.empresa ||
    !form.beneficiario ||
    !form.concepto ||
    !form.monto ||
    !form.fechaPago
  ) {
    toast.error("Completa empresa, beneficiario, concepto, monto y fecha de pago");
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
    (f) => String(f.id) === form.fondoEmpresaId
  );

  if (!fondoSeleccionado) {
    toast.error("El fondo seleccionado no existe");
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
      toast.error("Debes ingresar un tipo de cambio válido para USD");
      return;
    }
  }

  if (form.formaPago === "Cheque") {
    if (!form.chequeraId || !form.chequeFisicoId) {
      toast.error("Selecciona chequera y número de cheque");
      return;
    }

    const chequeFisico = chequesFisicos.find(
      (cf) => String(cf.id) === form.chequeFisicoId
    );

    if (!chequeFisico) {
      toast.error("El cheque físico no existe");
      return;
    }

    if (chequeFisico.estado !== "Disponible") {
      toast.error("Ese cheque ya no está disponible");
      return;
    }

    if (chequeFisico.moneda !== form.moneda) {
      toast.error("La moneda del cheque no coincide");
      return;
    }
  }

  if (!userId) {
    toast.error("Sesión no válida");
    return;
  }

  const toastId = toast.loading("Creando cheque...");

  try {
    const limite = calcularLimiteAutorizacion(form.fechaPago, form.prioridad);
    const tipoCambioFinal = form.moneda === "GTQ" ? 1 : Number(form.tipoCambio || 1);

    const { data, error } = await supabase
      .from("cheques")
      .insert([
        {
          empresa_id: form.empresaId ? Number(form.empresaId) : null,
          empresa: form.empresa,
          fondo_empresa_id: Number(form.fondoEmpresaId),
          chequera_id: form.chequeraId ? Number(form.chequeraId) : null,
          cheque_fisico_id: form.chequeFisicoId ? Number(form.chequeFisicoId) : null,
          numero_cheque: form.numeroCheque || null,
          banco: form.banco || null,
          cuenta_bancaria: form.cuentaBancaria || null,
          beneficiario: form.beneficiario,
          concepto: form.concepto,
          monto: montoCheque,
          tipo_cambio: tipoCambioFinal,
          monto_gtq: montoCheque * tipoCambioFinal,
          tipo_pago: form.tipoPago,
          forma_pago: form.formaPago,
          moneda: form.moneda,
          prioridad: form.prioridad,
          fecha_pago: form.fechaPago,
          fecha_limite_autorizacion: limite,
          estado: "Pendiente de autorización",
          estado_fondo: "sin_comprometer",
          creado_por: userId,
          responsable_actual: form.responsableActual || null,
          enviado_at: new Date().toISOString(),
          movimiento_generado: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    if (form.formaPago === "Cheque" && form.chequeFisicoId) {
      const { error: chequeFisicoError } = await supabase
        .from("cheques_fisicos")
        .update({
          estado: "Reservado",
          cheque_pago_id: data.id,
        })
        .eq("id", Number(form.chequeFisicoId));

      if (chequeFisicoError) throw chequeFisicoError;
    }

    await supabase.from("cheques_historial").insert([
      {
        cheque_id: data.id,
        modulo: "cheques",
        accion: "Creado y enviado a autorización",
        estado_anterior: null,
        estado_nuevo: "Pendiente de autorización",
        comentario:
          form.formaPago === "Cheque"
            ? `Cheque No. ${form.numeroCheque} reservado para ${form.beneficiario}`
            : `${form.formaPago} creado para ${form.beneficiario}`,
        usuario_id: userId,
      },
    ]);

    await refrescarModuloCheques();

    setForm({
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
    });

    toast.success("Cheque enviado a autorización", { id: toastId });
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al crear cheque", { id: toastId });
  }
}

  async function registrarHistorial(
    chequeId: number,
    accion: string,
    estadoAnterior: string,
    estadoNuevo: string,
    comentario?: string
  ) {
    await supabase.from("cheques_historial").insert([ 
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
  }

async function autorizarCheque(cheque: Cheque) {
  if (!userId) return;

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Autorizando cheque...");

  try {
    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("cheques")
      .update({
        estado: "Autorizado",
        estado_fondo: "comprometido",
        autorizado_por: userId,
        autorizado_at: ahora,
        comprometido_at: ahora,
      })
      .eq("id", cheque.id);

    if (error) throw error;

    if (cheque.cheque_fisico_id) {
      const { error: chequeFisicoError } = await supabase
        .from("cheques_fisicos")
        .update({
          estado: "Firmado",
        })
        .eq("id", cheque.cheque_fisico_id);

      if (chequeFisicoError) throw chequeFisicoError;
    }

    if (cheque.fondo_empresa_id) {
      const { error: recalculoError } = await supabase.rpc(
        "recalcular_fondo_empresa",
        {
          p_fondo_empresa_id: cheque.fondo_empresa_id,
        }
      );

      if (recalculoError) throw recalculoError;
    }

    await registrarHistorial(
      cheque.id,
      "Autorizado",
      cheque.estado,
      "Autorizado",
      "Cheque autorizado y fondos comprometidos"
    );

    setCheques((prev) =>
      prev.map((c) =>
        c.id === cheque.id
          ? {
              ...c,
              estado: "Autorizado",
              estado_fondo: "comprometido",
              autorizado_por: userId,
              autorizado_at: ahora,
              comprometido_at: ahora,
            }
          : c
      )
    );

  if (userId && perfilActual) {
  await obtenerFondos(empresasPermitidasIds);
  await obtenerChequesFisicos(empresasPermitidasIds);
  await obtenerResumenChequeras(empresasPermitidasIds);
}

    toast.success("Cheque autorizado y fondos comprometidos", { id: toastId });
  } catch (error: any) {
    toast.error(error.message || "Error al autorizar", { id: toastId });
  } finally {
    setProcesandoId(null);
  }
}

async function rechazarCheque(cheque: Cheque) {
  if (!userId) return;

  const motivo = window.prompt("Indica el motivo del rechazo:");

  if (!motivo) {
    toast.error("Debes indicar un motivo");
    return;
  }

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Rechazando cheque...");

  try {
    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("cheques")
      .update({
        estado: "Rechazado",
        estado_fondo: "liberado",
        rechazado_por: userId,
        rechazado_at: ahora,
        liberado_at: ahora,
        motivo_rechazo: motivo,
      })
      .eq("id", cheque.id);

    if (error) throw error;

    if (cheque.cheque_fisico_id) {
      const { error: chequeFisicoError } = await supabase
        .from("cheques_fisicos")
        .update({
          estado: "Rechazado",
        })
        .eq("id", cheque.cheque_fisico_id);

      if (chequeFisicoError) throw chequeFisicoError;
    }

    if (cheque.fondo_empresa_id) {
      const { error: recalculoError } = await supabase.rpc(
        "recalcular_fondo_empresa",
        {
          p_fondo_empresa_id: cheque.fondo_empresa_id,
        }
      );

      if (recalculoError) throw recalculoError;
    }

    await registrarHistorial(
      cheque.id,
      "Rechazado",
      cheque.estado,
      "Rechazado",
      motivo
    );

    setCheques((prev) =>
      prev.map((c) =>
        c.id === cheque.id
          ? {
              ...c,
              estado: "Rechazado",
              estado_fondo: "liberado",
              rechazado_por: userId,
              rechazado_at: ahora,
              liberado_at: ahora,
              motivo_rechazo: motivo,
            }
          : c
      )
    );

if (userId && perfilActual) {
  await obtenerFondos(empresasPermitidasIds);
  await obtenerChequesFisicos(empresasPermitidasIds);
  await obtenerResumenChequeras(empresasPermitidasIds);
}

    toast.success("Cheque rechazado y fondos liberados", { id: toastId });
  } catch (error: any) {
    toast.error(error.message || "Error al rechazar", { id: toastId });
  } finally {
    setProcesandoId(null);
  }
}

async function archivarCheque(cheque: Cheque) {
  if (!userId) return;

const motivo = window.prompt("Indica el motivo de anulación:");

  if (!motivo) {
    toast.error("Debes indicar un motivo");
    return;
  }

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Anulando cheque...");

  try {
    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("cheques")
      .update({
        estado: "Anulado",
        estado_fondo: "liberado",
        archivado_por: userId,
        archivado_at: ahora,
        liberado_at: ahora,
        motivo_archivo: motivo,
        motivo_anulacion: motivo,
      })
      .eq("id", cheque.id);

    if (error) throw error;

    if (cheque.cheque_fisico_id) {
      const { error: chequeFisicoError } = await supabase
        .from("cheques_fisicos")
        .update({
          estado: "Anulado",
        })
        .eq("id", cheque.cheque_fisico_id);

      if (chequeFisicoError) throw chequeFisicoError;
    }

    if (cheque.fondo_empresa_id) {
      const { error: recalculoError } = await supabase.rpc(
        "recalcular_fondo_empresa",
        {
          p_fondo_empresa_id: cheque.fondo_empresa_id,
        }
      );

      if (recalculoError) throw recalculoError;
    }

    await registrarHistorial(
      cheque.id,
      "Anulado",
      cheque.estado,
      "Anulado",
      motivo
    );

    setCheques((prev) =>
      prev.map((c) =>
        c.id === cheque.id
          ? {
              ...c,
              estado: "Anulado",
              estado_fondo: "liberado",
              archivado_por: userId,
              archivado_at: ahora,
              liberado_at: ahora,
              motivo_archivo: motivo,
              motivo_anulacion: motivo,
            }
          : c
      )
    );

if (userId && perfilActual) {
  await obtenerFondos(empresasPermitidasIds);
  await obtenerChequesFisicos(empresasPermitidasIds);
  await obtenerResumenChequeras(empresasPermitidasIds);
}
    toast.success("Cheque anulado y fondos liberados", { id: toastId });
  } catch (error: any) {
    toast.error(error.message || "Error al anular cheque", { id: toastId });
  } finally {
    setProcesandoId(null);
  }
}

async function marcarPagado(cheque: Cheque) {
  if (!userId) return;

  setProcesandoId(cheque.id);
  const toastId = toast.loading("Marcando como pagado...");

  try {
    const ahora = new Date().toISOString();

    if (!cheque.movimiento_generado) {
      const { error: movError } = await supabase.from("movimientos").insert([
        {
          tipo: "Egreso",
          descripcion: `${cheque.forma_pago || "Cheque"} ${
            cheque.numero_cheque ? `No. ${cheque.numero_cheque}` : ""
          } ${cheque.moneda || "GTQ"} - ${cheque.tipo_pago}: ${
            cheque.concepto
          } - ${cheque.beneficiario}`,
monto: Number(cheque.monto),
tipo_cambio: cheque.tipo_cambio || null,
monto_gtq: cheque.monto_gtq || Number(cheque.monto),
empresa: cheque.empresa,
empresa_id: cheque.empresa_id,
moneda: cheque.moneda || "GTQ",
fecha: new Date().toISOString().split("T")[0],
        },
      ]);

      if (movError) throw movError;
    }

    const { error } = await supabase
      .from("cheques")
      .update({
        estado: "Pagado",
        estado_fondo: "pagado",
        pagado_at: ahora,
        movimiento_generado: true,
      })
      .eq("id", cheque.id);

    if (error) throw error;

    if (cheque.cheque_fisico_id) {
      const { error: chequeFisicoError } = await supabase
        .from("cheques_fisicos")
        .update({
          estado: "Pagado",
        })
        .eq("id", cheque.cheque_fisico_id);

      if (chequeFisicoError) throw chequeFisicoError;
    }

    if (cheque.fondo_empresa_id) {
      const { error: recalculoError } = await supabase.rpc(
        "recalcular_fondo_empresa",
        {
          p_fondo_empresa_id: cheque.fondo_empresa_id,
        }
      );

      if (recalculoError) throw recalculoError;
    }

    await registrarHistorial(
      cheque.id,
      "Pagado",
      cheque.estado,
      "Pagado",
      "Cheque pagado y cargado a contabilidad"
    );

    setCheques((prev) =>
      prev.map((c) =>
        c.id === cheque.id
          ? {
              ...c,
              estado: "Pagado",
              estado_fondo: "pagado",
              pagado_at: ahora,
              movimiento_generado: true,
            }
          : c
      )
    );

if (userId && perfilActual) {
  await obtenerFondos(empresasPermitidasIds);
  await obtenerChequesFisicos(empresasPermitidasIds);
  await obtenerResumenChequeras(empresasPermitidasIds);
}

    toast.success("Cheque pagado y registrado en contabilidad", {
      id: toastId,
    });
  } catch (error: any) {
    toast.error(error.message || "Error al pagar cheque", { id: toastId });
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
        texto: "Sin límite",
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

const stats = useMemo(() => {
  const pendientes = chequesFiltrados.filter(
    (c) => c.estado === "Pendiente de autorización"
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
    if (c.estado !== "Pendiente de autorización") return false;
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
                Control de autorización, tiempos, atrasos y pagos
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
          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
            <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Plus size={16} className="text-cyan-500" />
              Crear cheque y enviar a autorización
            </h2>

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
                placeholder="Concepto / descripción"
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
                onChange={(e) =>
                  setForm({ ...form, formaPago: e.target.value })
                }
                className="input-custom"
              >
                <option value="Cheque">Cheque</option>
                <option value="Depósito">Depósito</option>
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
  <option value="USD">Dólares (USD)</option>
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
      {fondo.banco || "Banco"} — {fondo.cuenta_bancaria || "Sin cuenta"} —{" "}
      {fondo.moneda} — Disp: {money(Number(fondo.saldo_disponible || 0), fondo.moneda)}
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
      {chequera.banco || "Banco"} — {chequera.cuenta_bancaria || "Sin cuenta"} —{" "}
      {chequera.numero_inicial} a {chequera.numero_final} — {chequera.moneda}
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
      ? "Número de cheque..."
      : "No hay cheques disponibles"
    : "Primero selecciona chequera"}
</option>
{chequesFisicosDisponibles.map((cf) => (
    <option key={cf.id} value={String(cf.id)}>
      Cheque No. {cf.numero_cheque} — {cf.moneda}
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
                <option value="">Responsable autorización...</option>
                {usuarios
                  .filter((u) =>
                    ROLES_JEFATURA.includes(
                      (u.rol || "").trim().toLowerCase()
                    )
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} — {u.rol}
                    </option>
                  ))}
              </select>

              <button
                onClick={crearCheque}
                className="md:col-span-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Enviar cheque a autorización
              </button>
            </div>
          </section>

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-green-500">
  <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase">
    Registrar fondo / cuenta bancaria
  </h2>

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
      <option value="USD">Dólares USD</option>
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
</section>

<section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-yellow-500">
  <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase">
    Registrar chequera
  </h2>

  <div className="grid md:grid-cols-6 gap-4">
    <select
      value={formChequera.fondoEmpresaId}
      onChange={(e) => {
        const fondo = fondos.find((f) => String(f.id) === e.target.value);

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
      {fondos.map((fondo) => (
        <option key={fondo.id} value={String(fondo.id)}>
          {fondo.empresa} — {fondo.banco || "Banco"} —{" "}
          {fondo.cuenta_bancaria || "Sin cuenta"} — {fondo.moneda}
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
      Crear chequera y generar números
    </button>
  </div>
</section>

<section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8">
  <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase">
    Resumen de chequeras
  </h2>

  {resumenChequeras.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No hay chequeras registradas.
    </p>
  ) : (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {resumenChequeras.map((ch) => (
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

  {fondos.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No hay fondos o cuentas bancarias registradas.
    </p>
  ) : (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {fondos.map((fondo) => (
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
              <option value="Pendiente de autorización">
                Pendiente de autorización
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
              Límite:{" "}
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
    Motivo anulación: {cheque.motivo_anulacion}
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
  Estado: {item.estado_anterior || "Inicio"} → {item.estado_nuevo || "Sin estado"}
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

        {puedeAprobar && (
          <div className="flex flex-wrap xl:flex-col gap-2 min-w-[180px]">
            {cheque.estado === "Pendiente de autorización" && (
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

            {cheque.estado === "Autorizado" && (
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
    </div>
  );
}
