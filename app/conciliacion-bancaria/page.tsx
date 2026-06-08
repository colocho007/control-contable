"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarDays,
  ClipboardList,
  FileText,
  GitBranch,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
} from "../../lib/auditoria";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

type Tab =
  | "resumen"
  | "cuentas"
  | "estados"
  | "movimientos"
  | "vinculos"
  | "ajustes"
  | "fase_posterior";
type Moneda = "GTQ" | "USD";

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
}

interface CuentaBancaria {
  id: string;
  empresa_id: number;
  banco: string;
  nombre_cuenta: string;
  numero_cuenta: string | null;
  tipo_cuenta: string | null;
  moneda: string;
  saldo_inicial: number;
  fecha_saldo_inicial: string | null;
  activo: boolean;
  estado: string;
  observaciones: string | null;
}

interface EstadoCuenta {
  id: string;
  empresa_id: number;
  cuenta_bancaria_id: string;
  periodo_anio: number;
  periodo_mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  saldo_inicial: number;
  saldo_final: number;
  moneda: string;
  estado: string;
  observaciones: string | null;
}

interface MovimientoBanco {
  id: string;
  empresa_id: number;
  estado_cuenta_id: string;
  cuenta_bancaria_id: string;
  fecha_movimiento: string;
  descripcion: string | null;
  referencia: string | null;
  tipo_movimiento: string;
  debito: number;
  credito: number;
  saldo_banco: number | null;
  moneda: string;
  estado: string;
  conciliado: boolean;
  observaciones: string | null;
}

interface VinculoConciliacion {
  id: string;
  empresa_id: number;
  movimiento_banco_id: string;
  modulo_origen: string;
  entidad_origen_id: string | null;
  entidad_origen_texto: string | null;
  tipo_vinculo: string;
  monto_vinculado: number;
  moneda: string;
  estado: string;
  observaciones: string | null;
}

interface AjusteConciliacion {
  id: string;
  empresa_id: number;
  cuenta_bancaria_id: string;
  estado_cuenta_id: string | null;
  movimiento_banco_id: string | null;
  tipo_ajuste: string;
  descripcion: string;
  monto: number;
  moneda: string;
  estado: string;
  requiere_contabilidad: boolean;
  observaciones: string | null;
}

const ROLES_ESCRITURA = ["admin", "supervisor", "jefe"];
const FUNCIONES_ESCRITURA: Array<"auxiliar_contable" | "contador_revisor"> = [
  "auxiliar_contable",
  "contador_revisor",
];
const MONEDAS: Moneda[] = ["GTQ", "USD"];
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const TIPOS_MOVIMIENTO = [
  "DEBITO",
  "CREDITO",
  "CHEQUE",
  "DEPOSITO",
  "TRANSFERENCIA",
  "COMISION",
  "INTERES",
  "AJUSTE",
  "OTRO",
];
const TIPOS_VINCULO = [
  "CHEQUE",
  "PAGO_CXP",
  "COBRO_CXC",
  "MOVIMIENTO_FINANZAS",
  "AJUSTE",
  "OTRO",
];
const TIPOS_AJUSTE = [
  "COMISION_BANCARIA",
  "NOTA_DEBITO",
  "NOTA_CREDITO",
  "DIFERENCIA",
  "ERROR_BANCO",
  "ERROR_INTERNO",
  "AJUSTE_CONTABLE",
  "OTRO",
];

const COLUMNAS_CUENTAS =
  "id,empresa_id,banco,nombre_cuenta,numero_cuenta,tipo_cuenta,moneda,saldo_inicial,fecha_saldo_inicial,activo,estado,observaciones";
const COLUMNAS_ESTADOS =
  "id,empresa_id,cuenta_bancaria_id,periodo_anio,periodo_mes,fecha_inicio,fecha_fin,saldo_inicial,saldo_final,moneda,estado,observaciones";
const COLUMNAS_MOVIMIENTOS =
  "id,empresa_id,estado_cuenta_id,cuenta_bancaria_id,fecha_movimiento,descripcion,referencia,tipo_movimiento,debito,credito,saldo_banco,moneda,estado,conciliado,observaciones";
const COLUMNAS_VINCULOS =
  "id,empresa_id,movimiento_banco_id,modulo_origen,entidad_origen_id,entidad_origen_texto,tipo_vinculo,monto_vinculado,moneda,estado,observaciones";
const COLUMNAS_AJUSTES =
  "id,empresa_id,cuenta_bancaria_id,estado_cuenta_id,movimiento_banco_id,tipo_ajuste,descripcion,monto,moneda,estado,requiere_contabilidad,observaciones";

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function textoOpcional(valor: string) {
  const texto = valor.trim();
  return texto ? texto : null;
}

function numeroNoNegativo(valor: string, campo: string) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${campo} debe ser un numero no negativo.`);
  }
  return Math.round(numero * 100) / 100;
}

function uuidOpcional(valor: string, campo: string) {
  const texto = textoOpcional(valor);
  if (!texto) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(texto)) {
    throw new Error(`${campo} debe ser UUID valido o dejarse vacio.`);
  }
  return texto;
}

function validarMoneda(valor: string): Moneda {
  const moneda = valor.trim().toUpperCase();
  if (moneda !== "GTQ" && moneda !== "USD") throw new Error("La moneda debe ser GTQ o USD.");
  return moneda;
}

function fechaMostrar(valor?: string | null) {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function monto(valor?: number | null, moneda = "GTQ") {
  if (valor === null || valor === undefined) return "-";
  return `${moneda} ${Number(valor || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function validarRangoFechas(inicio: string, fin: string) {
  if (inicio && fin && fin < inicio) {
    throw new Error("La fecha final no puede ser anterior a la fecha inicial.");
  }
}

function errorSeguro(error: unknown) {
  const texto = [
    error instanceof Error ? error.message : "",
    typeof error === "object" && error && "message" in error ? String(error.message) : "",
    typeof error === "object" && error && "details" in error ? String(error.details) : "",
    typeof error === "object" && error && "code" in error ? String(error.code) : "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    texto.includes("duplicate key") ||
    texto.includes("unique constraint") ||
    texto.includes("23505") ||
    texto.includes("already exists")
  ) {
    return "Ya existe un registro con esos datos. Revise la informacion e intente nuevamente.";
  }
  if (
    texto.includes("foreign key") ||
    texto.includes("violates foreign key constraint") ||
    texto.includes("23503") ||
    texto.includes("not present in table")
  ) {
    return "Uno de los datos relacionados no es valido o no pertenece a la empresa seleccionada.";
  }
  if (
    texto.includes("check constraint") ||
    texto.includes("violates check constraint") ||
    texto.includes("23514")
  ) {
    return "Los datos no cumplen las reglas de validacion. Revise montos, fechas, moneda y estado.";
  }
  if (
    texto.includes("null value") ||
    texto.includes("not-null constraint") ||
    texto.includes("23502")
  ) {
    return "Faltan datos obligatorios para guardar el registro.";
  }
  if (
    texto.includes("row-level security") ||
    texto.includes("permission denied") ||
    texto.includes("insufficient privilege") ||
    texto.includes("42501") ||
    texto.includes("403") ||
    texto.includes("not authorized")
  ) {
    return "No tiene permisos para realizar esta accion o la empresa no esta autorizada.";
  }
  if (texto.includes("invalid input syntax for type uuid") || texto.includes("22p02")) {
    return "Uno de los identificadores seleccionados no es valido.";
  }
  if (
    texto.includes("failed to fetch") ||
    texto.includes("network") ||
    texto.includes("timeout")
  ) {
    return "No se pudo conectar con el servidor. Intente nuevamente.";
  }

  return "No se pudo completar la operacion. Revisa los datos e intenta de nuevo.";
}

function formularioCuentaInicial(empresaId = "") {
  return {
    empresaId,
    banco: "",
    nombreCuenta: "",
    numeroCuenta: "",
    tipoCuenta: "",
    moneda: "GTQ" as Moneda,
    saldoInicial: "0",
    fechaSaldoInicial: "",
    observaciones: "",
  };
}

function formularioEstadoInicial(empresaId = "") {
  const hoy = new Date();
  return {
    empresaId,
    cuentaBancariaId: "",
    periodoAnio: String(hoy.getFullYear()),
    periodoMes: String(hoy.getMonth() + 1),
    fechaInicio: "",
    fechaFin: "",
    saldoInicial: "0",
    saldoFinal: "0",
    moneda: "GTQ" as Moneda,
    observaciones: "",
  };
}

function formularioMovimientoInicial(empresaId = "") {
  return {
    empresaId,
    cuentaBancariaId: "",
    estadoCuentaId: "",
    fechaMovimiento: "",
    descripcion: "",
    referencia: "",
    tipoMovimiento: "DEBITO",
    debito: "0",
    credito: "0",
    saldoBanco: "",
    moneda: "GTQ" as Moneda,
    observaciones: "",
  };
}

function formularioVinculoInicial(empresaId = "") {
  return {
    empresaId,
    movimientoBancoId: "",
    moduloOrigen: "",
    entidadOrigenId: "",
    entidadOrigenTexto: "",
    tipoVinculo: "OTRO",
    montoVinculado: "0",
    moneda: "GTQ" as Moneda,
    observaciones: "",
  };
}

function formularioAjusteInicial(empresaId = "") {
  return {
    empresaId,
    cuentaBancariaId: "",
    estadoCuentaId: "",
    movimientoBancoId: "",
    tipoAjuste: "DIFERENCIA",
    descripcion: "",
    monto: "0",
    moneda: "GTQ" as Moneda,
    requiereContabilidad: true,
    observaciones: "",
  };
}

export default function ConciliacionBancariaPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasOperativasIds, setEmpresasOperativasIds] = useState<number[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [estados, setEstados] = useState<EstadoCuenta[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoBanco[]>([]);
  const [vinculos, setVinculos] = useState<VinculoConciliacion[]>([]);
  const [ajustes, setAjustes] = useState<AjusteConciliacion[]>([]);
  const [formCuenta, setFormCuenta] = useState(formularioCuentaInicial());
  const [formEstado, setFormEstado] = useState(formularioEstadoInicial());
  const [formMovimiento, setFormMovimiento] = useState(formularioMovimientoInicial());
  const [formVinculo, setFormVinculo] = useState(formularioVinculoInicial());
  const [formAjuste, setFormAjuste] = useState(formularioAjusteInicial());

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        setValidandoAcceso(true);
        const acceso = await validarAccesoModuloUsuario("conciliacion-bancaria");
        if (!activo) return;

        if (!acceso.ok) {
          const volverLogin = ["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(
            acceso.motivo || ""
          );
          if (volverLogin) {
            router.replace("/login");
            return;
          }
          setMensajeBloqueo("No tienes acceso al modulo Conciliacion bancaria.");
          setAutorizado(false);
          setValidandoAcceso(false);
          return;
        }

        const user = acceso.user!;
        const perfil = acceso.perfil as Perfil;
        const idsPermitidos = await obtenerEmpresasPermitidas(user.id, perfil.rol || "");
        const operativas = await obtenerEmpresasOperativasDesdeIds(idsPermitidos);
        const funciones = await listarFuncionesOperativasUsuario(user.id, operativas.ids);
        if (!activo) return;

        const empresaInicial = operativas.ids.length ? String(operativas.ids[0]) : "";
        setUserId(user.id);
        setPerfilActual(perfil);
        setEmpresas(operativas.empresas);
        setEmpresasOperativasIds(operativas.ids);
        setFuncionesOperativas(funciones);
        setFormCuenta(formularioCuentaInicial(empresaInicial));
        setFormEstado(formularioEstadoInicial(empresaInicial));
        setFormMovimiento(formularioMovimientoInicial(empresaInicial));
        setFormVinculo(formularioVinculoInicial(empresaInicial));
        setFormAjuste(formularioAjusteInicial(empresaInicial));
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!operativas.ids.length) {
          setAviso("No tienes empresas operativas asignadas para consultar Conciliacion bancaria.");
          return;
        }

        setCargando(true);
        await cargarDatos(operativas.ids);
      } catch (error) {
        console.error("Error cargando Conciliacion bancaria:", error);
        if (activo) {
          setErrorCarga("No se pudo cargar la pantalla de Conciliacion bancaria.");
          setValidandoAcceso(false);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    void iniciar();
    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarDatos(ids = empresasOperativasIds) {
    const idsValidos = ids.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!idsValidos.length) {
      setCuentas([]);
      setEstados([]);
      setMovimientos([]);
      setVinculos([]);
      setAjustes([]);
      return;
    }

    const [resCuentas, resEstados, resMovimientos, resVinculos, resAjustes] =
      await Promise.all([
        supabase
          .from("conciliacion_cuentas_bancarias")
          .select(COLUMNAS_CUENTAS)
          .in("empresa_id", idsValidos)
          .order("banco", { ascending: true }),
        supabase
          .from("conciliacion_estados_cuenta")
          .select(COLUMNAS_ESTADOS)
          .in("empresa_id", idsValidos)
          .order("periodo_anio", { ascending: false })
          .order("periodo_mes", { ascending: false }),
        supabase
          .from("conciliacion_movimientos_banco")
          .select(COLUMNAS_MOVIMIENTOS)
          .in("empresa_id", idsValidos)
          .order("fecha_movimiento", { ascending: false }),
        supabase
          .from("conciliacion_vinculos")
          .select(COLUMNAS_VINCULOS)
          .in("empresa_id", idsValidos)
          .order("tipo_vinculo", { ascending: true }),
        supabase
          .from("conciliacion_ajustes")
          .select(COLUMNAS_AJUSTES)
          .in("empresa_id", idsValidos)
          .order("estado", { ascending: true }),
      ]);

    if (resCuentas.error) {
      console.error("Error cargando cuentas de conciliacion:", resCuentas.error);
      throw new Error("No se pudieron cargar las cuentas bancarias.");
    }
    if (resEstados.error) {
      console.error("Error cargando estados de cuenta:", resEstados.error);
      throw new Error("No se pudieron cargar los estados de cuenta.");
    }
    if (resMovimientos.error) {
      console.error("Error cargando movimientos banco:", resMovimientos.error);
      throw new Error("No se pudieron cargar los movimientos bancarios.");
    }
    if (resVinculos.error) {
      console.error("Error cargando vinculos de conciliacion:", resVinculos.error);
      throw new Error("No se pudieron cargar los vinculos de conciliacion.");
    }
    if (resAjustes.error) {
      console.error("Error cargando ajustes de conciliacion:", resAjustes.error);
      throw new Error("No se pudieron cargar los ajustes de conciliacion.");
    }

    setCuentas((resCuentas.data || []) as CuentaBancaria[]);
    setEstados((resEstados.data || []) as EstadoCuenta[]);
    setMovimientos((resMovimientos.data || []) as MovimientoBanco[]);
    setVinculos((resVinculos.data || []) as VinculoConciliacion[]);
    setAjustes((resAjustes.data || []) as AjusteConciliacion[]);
  }

  function validarEmpresa(valor: string | number) {
    const empresaId = Number(valor);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error("Selecciona una empresa valida.");
    }
    if (!empresasOperativasIds.includes(empresaId)) {
      throw new Error("La empresa no esta dentro de tus empresas permitidas y operativas.");
    }
    return empresaId;
  }

  function esAuditorSoloLectura(empresaId?: string | number | null) {
    return esAuditorSoloLecturaLocal(
      funcionesOperativas,
      empresaId ? [empresaId] : empresasOperativasIds
    );
  }

  function puedeEscribir(empresaId?: string | number | null) {
    if (!empresaId || !userId || esAuditorSoloLectura(empresaId)) return false;
    const rol = normalizarRol(perfilActual?.rol);
    return (
      ROLES_ESCRITURA.includes(rol) ||
      tieneFuncionOperativaLocal(funcionesOperativas, userId, empresaId, FUNCIONES_ESCRITURA)
    );
  }

  function puedeEscribirAlgunaEmpresa() {
    return empresasOperativasIds.some((empresaId) => puedeEscribir(empresaId));
  }

  function cuentaDeEmpresa(cuentaId: string, empresaId: number) {
    const cuenta = cuentas.find((item) => item.id === cuentaId);
    if (!cuenta || Number(cuenta.empresa_id) !== empresaId) {
      throw new Error("La cuenta bancaria debe pertenecer a la misma empresa.");
    }
    return cuenta;
  }

  function estadoDeEmpresa(estadoId: string, empresaId: number) {
    const estado = estados.find((item) => item.id === estadoId);
    if (!estado || Number(estado.empresa_id) !== empresaId) {
      throw new Error("El estado de cuenta debe pertenecer a la misma empresa.");
    }
    return estado;
  }

  function movimientoDeEmpresa(movimientoId: string, empresaId: number) {
    const movimiento = movimientos.find((item) => item.id === movimientoId);
    if (!movimiento || Number(movimiento.empresa_id) !== empresaId) {
      throw new Error("El movimiento bancario debe pertenecer a la misma empresa.");
    }
    return movimiento;
  }

  async function auditar(params: RegistrarAuditoriaEventoParams) {
    try {
      await registrarAuditoriaEvento(params);
      return true;
    } catch (error) {
      console.warn("No se pudo registrar auditoria de Conciliacion bancaria:", error);
      setAviso("El registro se guardo, pero no se pudo registrar la auditoria central.");
      return false;
    }
  }

  async function guardarCuenta() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);
    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formCuenta.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar conciliacion bancaria.");
        return;
      }
      if (!formCuenta.banco.trim() || !formCuenta.nombreCuenta.trim()) {
        throw new Error("Banco y nombre de cuenta son obligatorios.");
      }

      const payload = {
        empresa_id: empresaId,
        banco: formCuenta.banco.trim(),
        nombre_cuenta: formCuenta.nombreCuenta.trim(),
        numero_cuenta: textoOpcional(formCuenta.numeroCuenta),
        tipo_cuenta: textoOpcional(formCuenta.tipoCuenta),
        moneda: validarMoneda(formCuenta.moneda),
        saldo_inicial: numeroNoNegativo(formCuenta.saldoInicial, "Saldo inicial"),
        fecha_saldo_inicial: textoOpcional(formCuenta.fechaSaldoInicial),
        observaciones: textoOpcional(formCuenta.observaciones),
        creado_por: userId,
      };

      setProcesando(true);
      const { data, error } = await supabase
        .from("conciliacion_cuentas_bancarias")
        .insert(payload)
        .select(COLUMNAS_CUENTAS)
        .single();
      if (error) {
        console.error("Error creando cuenta bancaria de conciliacion:", error);
        throw new Error("No se pudo guardar la cuenta bancaria.");
      }

      const registro = data as CuentaBancaria;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "conciliacion-bancaria",
        accion: "crear_cuenta_conciliacion",
        entidad_tipo: "conciliacion_cuentas_bancarias",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Cuenta de conciliacion creada: ${registro.banco} ${registro.nombre_cuenta}`,
        metadatos: {
          empresa_id: empresaId,
          banco: registro.banco,
          nombre_cuenta: registro.nombre_cuenta,
          numero_cuenta: registro.numero_cuenta,
          tipo_cuenta: registro.tipo_cuenta,
          moneda: registro.moneda,
          saldo_inicial: Number(registro.saldo_inicial || 0),
          estado: registro.estado,
          activo: Boolean(registro.activo),
        },
        origen: "app_conciliacion_bancaria",
      });

      setFormCuenta(formularioCuentaInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Cuenta bancaria registrada." : "Cuenta registrada; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando cuenta de conciliacion:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarEstado() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);
    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formEstado.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar conciliacion bancaria.");
        return;
      }
      const cuenta = cuentaDeEmpresa(formEstado.cuentaBancariaId, empresaId);
      if (!formEstado.fechaInicio || !formEstado.fechaFin) {
        throw new Error("Fecha inicio y fecha fin son obligatorias.");
      }
      validarRangoFechas(formEstado.fechaInicio, formEstado.fechaFin);
      const periodoMes = Number(formEstado.periodoMes);
      const periodoAnio = Number(formEstado.periodoAnio);
      if (!Number.isInteger(periodoAnio) || periodoAnio < 2000 || periodoAnio > 2100) {
        throw new Error("Anio no valido.");
      }
      if (!Number.isInteger(periodoMes) || periodoMes < 1 || periodoMes > 12) {
        throw new Error("Mes no valido.");
      }

      const payload = {
        empresa_id: empresaId,
        cuenta_bancaria_id: formEstado.cuentaBancariaId,
        periodo_anio: periodoAnio,
        periodo_mes: periodoMes,
        fecha_inicio: formEstado.fechaInicio,
        fecha_fin: formEstado.fechaFin,
        saldo_inicial: numeroNoNegativo(formEstado.saldoInicial, "Saldo inicial"),
        saldo_final: numeroNoNegativo(formEstado.saldoFinal, "Saldo final"),
        moneda: validarMoneda(formEstado.moneda),
        observaciones: textoOpcional(formEstado.observaciones),
        creado_por: userId,
      };

      setProcesando(true);
      const { data, error } = await supabase
        .from("conciliacion_estados_cuenta")
        .insert(payload)
        .select(COLUMNAS_ESTADOS)
        .single();
      if (error) {
        console.error("Error creando estado de cuenta de conciliacion:", error);
        throw new Error("No se pudo guardar el estado de cuenta.");
      }

      const registro = data as EstadoCuenta;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "conciliacion-bancaria",
        accion: "crear_estado_cuenta_conciliacion",
        entidad_tipo: "conciliacion_estados_cuenta",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Estado de cuenta creado para ${cuenta.banco} ${cuenta.nombre_cuenta}`,
        metadatos: {
          empresa_id: empresaId,
          cuenta_bancaria_id: registro.cuenta_bancaria_id,
          banco: cuenta.banco,
          periodo_anio: registro.periodo_anio,
          periodo_mes: registro.periodo_mes,
          fecha_inicio: registro.fecha_inicio,
          fecha_fin: registro.fecha_fin,
          saldo_inicial: Number(registro.saldo_inicial || 0),
          saldo_final: Number(registro.saldo_final || 0),
          moneda: registro.moneda,
          estado: registro.estado,
        },
        origen: "app_conciliacion_bancaria",
      });

      setFormEstado(formularioEstadoInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Estado de cuenta registrado." : "Estado registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando estado de cuenta:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarMovimiento() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);
    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formMovimiento.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar conciliacion bancaria.");
        return;
      }
      const cuenta = cuentaDeEmpresa(formMovimiento.cuentaBancariaId, empresaId);
      const estado = estadoDeEmpresa(formMovimiento.estadoCuentaId, empresaId);
      if (estado.cuenta_bancaria_id !== cuenta.id) {
        throw new Error("El estado de cuenta debe corresponder a la cuenta bancaria seleccionada.");
      }
      if (!formMovimiento.fechaMovimiento) throw new Error("La fecha del movimiento es obligatoria.");
      const debito = numeroNoNegativo(formMovimiento.debito, "Debito");
      const credito = numeroNoNegativo(formMovimiento.credito, "Credito");
      if ((debito > 0 && credito > 0) || (debito === 0 && credito === 0)) {
        throw new Error("Debito y credito no pueden ser ambos mayores a cero; uno debe ser mayor a cero.");
      }

      const payload = {
        empresa_id: empresaId,
        cuenta_bancaria_id: cuenta.id,
        estado_cuenta_id: estado.id,
        fecha_movimiento: formMovimiento.fechaMovimiento,
        descripcion: textoOpcional(formMovimiento.descripcion),
        referencia: textoOpcional(formMovimiento.referencia),
        tipo_movimiento: formMovimiento.tipoMovimiento,
        debito,
        credito,
        saldo_banco: textoOpcional(formMovimiento.saldoBanco)
          ? numeroNoNegativo(formMovimiento.saldoBanco, "Saldo banco")
          : null,
        moneda: validarMoneda(formMovimiento.moneda),
        observaciones: textoOpcional(formMovimiento.observaciones),
        creado_por: userId,
      };

      setProcesando(true);
      const { data, error } = await supabase
        .from("conciliacion_movimientos_banco")
        .insert(payload)
        .select(COLUMNAS_MOVIMIENTOS)
        .single();
      if (error) {
        console.error("Error creando movimiento bancario:", error);
        throw new Error("No se pudo guardar el movimiento bancario.");
      }

      const registro = data as MovimientoBanco;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "conciliacion-bancaria",
        accion: "crear_movimiento_banco_conciliacion",
        entidad_tipo: "conciliacion_movimientos_banco",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Movimiento bancario creado: ${registro.tipo_movimiento}`,
        metadatos: {
          empresa_id: empresaId,
          cuenta_bancaria_id: registro.cuenta_bancaria_id,
          estado_cuenta_id: registro.estado_cuenta_id,
          banco: cuenta.banco,
          fecha_movimiento: registro.fecha_movimiento,
          referencia: registro.referencia,
          tipo: registro.tipo_movimiento,
          debito: Number(registro.debito || 0),
          credito: Number(registro.credito || 0),
          moneda: registro.moneda,
          estado: registro.estado,
          conciliado: Boolean(registro.conciliado),
        },
        origen: "app_conciliacion_bancaria",
      });

      setFormMovimiento(formularioMovimientoInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Movimiento bancario registrado." : "Movimiento registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando movimiento bancario:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarVinculo() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);
    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formVinculo.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar conciliacion bancaria.");
        return;
      }
      const movimiento = movimientoDeEmpresa(formVinculo.movimientoBancoId, empresaId);
      if (!formVinculo.moduloOrigen.trim()) throw new Error("Modulo origen es obligatorio.");

      const payload = {
        empresa_id: empresaId,
        movimiento_banco_id: movimiento.id,
        modulo_origen: formVinculo.moduloOrigen.trim(),
        entidad_origen_id: uuidOpcional(formVinculo.entidadOrigenId, "Entidad origen ID"),
        entidad_origen_texto: textoOpcional(formVinculo.entidadOrigenTexto),
        tipo_vinculo: formVinculo.tipoVinculo,
        monto_vinculado: numeroNoNegativo(formVinculo.montoVinculado, "Monto vinculado"),
        moneda: validarMoneda(formVinculo.moneda),
        observaciones: textoOpcional(formVinculo.observaciones),
        creado_por: userId,
      };

      setProcesando(true);
      const { data, error } = await supabase
        .from("conciliacion_vinculos")
        .insert(payload)
        .select(COLUMNAS_VINCULOS)
        .single();
      if (error) {
        console.error("Error creando vinculo de conciliacion:", error);
        throw new Error("No se pudo guardar el vinculo manual.");
      }

      const registro = data as VinculoConciliacion;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "conciliacion-bancaria",
        accion: "crear_vinculo_conciliacion",
        entidad_tipo: "conciliacion_vinculos",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Vinculo manual creado: ${registro.tipo_vinculo}`,
        metadatos: {
          empresa_id: empresaId,
          movimiento_banco_id: registro.movimiento_banco_id,
          modulo_origen: registro.modulo_origen,
          entidad_origen_id: registro.entidad_origen_id,
          entidad_origen_texto: registro.entidad_origen_texto,
          tipo: registro.tipo_vinculo,
          monto: Number(registro.monto_vinculado || 0),
          moneda: registro.moneda,
          estado: registro.estado,
          referencia: movimiento.referencia,
        },
        origen: "app_conciliacion_bancaria",
      });

      setFormVinculo(formularioVinculoInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Vinculo manual registrado." : "Vinculo registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando vinculo de conciliacion:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  async function guardarAjuste() {
    setErrorCarga(null);
    setExito(null);
    setAviso(null);
    if (!userId) {
      setErrorCarga("Sesion no valida.");
      return;
    }

    try {
      const empresaId = validarEmpresa(formAjuste.empresaId);
      if (!puedeEscribir(empresaId)) {
        setErrorCarga("No tiene funcion operativa para modificar conciliacion bancaria.");
        return;
      }
      const cuenta = cuentaDeEmpresa(formAjuste.cuentaBancariaId, empresaId);
      const estado = textoOpcional(formAjuste.estadoCuentaId)
        ? estadoDeEmpresa(formAjuste.estadoCuentaId, empresaId)
        : null;
      const movimiento = textoOpcional(formAjuste.movimientoBancoId)
        ? movimientoDeEmpresa(formAjuste.movimientoBancoId, empresaId)
        : null;
      if (estado && estado.cuenta_bancaria_id !== cuenta.id) {
        throw new Error("El estado de cuenta del ajuste debe corresponder a la cuenta seleccionada.");
      }
      if (movimiento && movimiento.cuenta_bancaria_id !== cuenta.id) {
        throw new Error("El movimiento del ajuste debe corresponder a la cuenta seleccionada.");
      }
      if (!formAjuste.descripcion.trim()) throw new Error("La descripcion del ajuste es obligatoria.");

      const payload = {
        empresa_id: empresaId,
        cuenta_bancaria_id: cuenta.id,
        estado_cuenta_id: estado?.id || null,
        movimiento_banco_id: movimiento?.id || null,
        tipo_ajuste: formAjuste.tipoAjuste,
        descripcion: formAjuste.descripcion.trim(),
        monto: numeroNoNegativo(formAjuste.monto, "Monto"),
        moneda: validarMoneda(formAjuste.moneda),
        requiere_contabilidad: formAjuste.requiereContabilidad,
        observaciones: textoOpcional(formAjuste.observaciones),
        creado_por: userId,
      };

      setProcesando(true);
      const { data, error } = await supabase
        .from("conciliacion_ajustes")
        .insert(payload)
        .select(COLUMNAS_AJUSTES)
        .single();
      if (error) {
        console.error("Error creando ajuste de conciliacion:", error);
        throw new Error("No se pudo guardar el ajuste.");
      }

      const registro = data as AjusteConciliacion;
      const auditoriaOk = await auditar({
        empresa_id: empresaId,
        modulo: "conciliacion-bancaria",
        accion: "crear_ajuste_conciliacion",
        entidad_tipo: "conciliacion_ajustes",
        entidad_id: registro.id,
        estado_nuevo: registro.estado,
        descripcion: `Ajuste de conciliacion creado: ${registro.tipo_ajuste}`,
        metadatos: {
          empresa_id: empresaId,
          cuenta_bancaria_id: registro.cuenta_bancaria_id,
          estado_cuenta_id: registro.estado_cuenta_id,
          movimiento_banco_id: registro.movimiento_banco_id,
          banco: cuenta.banco,
          tipo: registro.tipo_ajuste,
          monto: Number(registro.monto || 0),
          moneda: registro.moneda,
          estado: registro.estado,
          requiere_contabilidad: Boolean(registro.requiere_contabilidad),
        },
        origen: "app_conciliacion_bancaria",
      });

      setFormAjuste(formularioAjusteInicial(String(empresaId)));
      await cargarDatos();
      setExito(auditoriaOk ? "Ajuste registrado sin crear asiento contable." : "Ajuste registrado; auditoria pendiente de revision.");
    } catch (error) {
      console.error("Error guardando ajuste de conciliacion:", error);
      setErrorCarga(errorSeguro(error));
    } finally {
      setProcesando(false);
    }
  }

  const empresasPorId = useMemo(() => {
    const mapa = new Map<number, string>();
    empresas.forEach((empresa) => mapa.set(Number(empresa.id), empresa.nombre));
    return mapa;
  }, [empresas]);

  const cuentasPorId = useMemo(() => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])), [cuentas]);
  const estadosPorId = useMemo(() => new Map(estados.map((estado) => [estado.id, estado])), [estados]);
  const movimientosPorId = useMemo(
    () => new Map(movimientos.map((movimiento) => [movimiento.id, movimiento])),
    [movimientos]
  );

  const cuentasPorEmpresa = useMemo(() => agruparPorEmpresa(cuentas), [cuentas]);
  const estadosPorEmpresa = useMemo(() => agruparPorEmpresa(estados), [estados]);
  const movimientosPorEmpresa = useMemo(() => agruparPorEmpresa(movimientos), [movimientos]);

  const resumen = useMemo(() => {
    const debitos = movimientos.reduce((total, item) => total + Number(item.debito || 0), 0);
    const creditos = movimientos.reduce((total, item) => total + Number(item.credito || 0), 0);
    return {
      cuentasActivas: cuentas.filter((item) => item.activo).length,
      estadosAbiertos: estados.filter((item) => ["Borrador", "En revision"].includes(item.estado)).length,
      movimientosPendientes: movimientos.filter((item) => item.estado === "Pendiente").length,
      movimientosConciliados: movimientos.filter((item) => item.conciliado).length,
      vinculosRegistrados: vinculos.length,
      ajustesPendientes: ajustes.filter((item) => item.estado === "Pendiente").length,
      debitos,
      creditos,
    };
  }, [cuentas, estados, movimientos, vinculos, ajustes]);

  const escrituraHabilitada = puedeEscribirAlgunaEmpresa();
  const auditorSoloLectura = esAuditorSoloLectura();

  if (validandoAcceso) return <EstadoCentro>Validando acceso a Conciliacion bancaria...</EstadoCentro>;
  if (!autorizado) return <EstadoCentro>{mensajeBloqueo || "No tienes acceso a este modulo."}</EstadoCentro>;

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Wallet className="text-cyan-500" size={42} />
                <h1 className="text-4xl font-black md:text-5xl">Conciliacion bancaria</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-200">
                  Base operativa
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-[var(--muted)]">
                Pantalla inicial para cuentas, estados de cuenta, movimientos, vinculos y ajustes.
                No importa archivos, no concilia automaticamente y no conecta flujos financieros.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargarDatos()}
              disabled={cargando || !empresasOperativasIds.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-3 text-sm font-black text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              Actualizar datos
            </button>
          </header>

          <Avisos
            aviso={aviso}
            error={errorCarga}
            exito={exito}
            auditorSoloLectura={auditorSoloLectura}
            escrituraHabilitada={escrituraHabilitada}
          />

          <ResumenGeneral resumen={resumen} />
          <Tabs tab={tab} setTab={setTab} />

          {cargando ? (
            <section className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-10 text-cyan-300">
              <Loader2 className="animate-spin" size={24} />
              Cargando conciliacion bancaria...
            </section>
          ) : (
            <>
              {tab === "resumen" && (
                <Panel titulo="Resumen" subtitulo="Conteos conectados a Supabase, sin conciliacion automatica.">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <TablaMovimientos
                      movimientos={movimientos.slice(0, 8)}
                      empresasPorId={empresasPorId}
                      cuentasPorId={cuentasPorId}
                      estadosPorId={estadosPorId}
                    />
                    <TablaAjustes
                      ajustes={ajustes.slice(0, 8)}
                      empresasPorId={empresasPorId}
                      cuentasPorId={cuentasPorId}
                      estadosPorId={estadosPorId}
                      movimientosPorId={movimientosPorId}
                    />
                  </div>
                </Panel>
              )}

              {tab === "cuentas" && (
                <Panel titulo="Cuentas bancarias" subtitulo="Registro base de cuentas conciliables sin conectar fondos.">
                  {escrituraHabilitada ? (
                    <FormularioCuenta
                      form={formCuenta}
                      setForm={setFormCuenta}
                      empresas={empresas}
                      procesando={procesando}
                      onGuardar={guardarCuenta}
                    />
                  ) : (
                    <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
                  )}
                  <TablaCuentas cuentas={cuentas} empresasPorId={empresasPorId} />
                </Panel>
              )}

              {tab === "estados" && (
                <Panel titulo="Estados de cuenta" subtitulo="Altas manuales sin archivo_documento_id ni cierre.">
                  {escrituraHabilitada ? (
                    <FormularioEstado
                      form={formEstado}
                      setForm={setFormEstado}
                      empresas={empresas}
                      cuentasPorEmpresa={cuentasPorEmpresa}
                      procesando={procesando}
                      onGuardar={guardarEstado}
                    />
                  ) : (
                    <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
                  )}
                  <TablaEstados estados={estados} empresasPorId={empresasPorId} cuentasPorId={cuentasPorId} />
                </Panel>
              )}

              {tab === "movimientos" && (
                <Panel titulo="Movimientos banco" subtitulo="Carga manual inicial; no marca conciliado automaticamente.">
                  {escrituraHabilitada ? (
                    <FormularioMovimiento
                      form={formMovimiento}
                      setForm={setFormMovimiento}
                      empresas={empresas}
                      cuentasPorEmpresa={cuentasPorEmpresa}
                      estadosPorEmpresa={estadosPorEmpresa}
                      procesando={procesando}
                      onGuardar={guardarMovimiento}
                    />
                  ) : (
                    <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
                  )}
                  <TablaMovimientos
                    movimientos={movimientos}
                    empresasPorId={empresasPorId}
                    cuentasPorId={cuentasPorId}
                    estadosPorId={estadosPorId}
                  />
                </Panel>
              )}

              {tab === "vinculos" && (
                <Panel titulo="Vinculos manuales" subtitulo="Vinculo base por referencia manual, sin buscar flujos externos.">
                  {escrituraHabilitada ? (
                    <FormularioVinculo
                      form={formVinculo}
                      setForm={setFormVinculo}
                      empresas={empresas}
                      movimientosPorEmpresa={movimientosPorEmpresa}
                      procesando={procesando}
                      onGuardar={guardarVinculo}
                    />
                  ) : (
                    <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
                  )}
                  <TablaVinculos vinculos={vinculos} empresasPorId={empresasPorId} movimientosPorId={movimientosPorId} />
                </Panel>
              )}

              {tab === "ajustes" && (
                <Panel titulo="Ajustes" subtitulo="Diferencias y cargos revisables, sin crear asientos contables.">
                  {escrituraHabilitada ? (
                    <FormularioAjuste
                      form={formAjuste}
                      setForm={setFormAjuste}
                      empresas={empresas}
                      cuentasPorEmpresa={cuentasPorEmpresa}
                      estadosPorEmpresa={estadosPorEmpresa}
                      movimientosPorEmpresa={movimientosPorEmpresa}
                      procesando={procesando}
                      onGuardar={guardarAjuste}
                    />
                  ) : (
                    <FormularioBloqueado auditorSoloLectura={auditorSoloLectura} />
                  )}
                  <TablaAjustes
                    ajustes={ajustes}
                    empresasPorId={empresasPorId}
                    cuentasPorId={cuentasPorId}
                    estadosPorId={estadosPorId}
                    movimientosPorId={movimientosPorId}
                  />
                </Panel>
              )}

              {tab === "fase_posterior" && (
                <Panel titulo="Fase posterior" subtitulo="Funciones no incluidas en el alcance operativo inicial.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      "Importacion Excel/PDF",
                      "Conciliacion automatica",
                      "Conectar fondos",
                      "Conectar cheques",
                      "Conectar CxP/CxC",
                      "Crear asiento contable",
                      "Calendario operativo",
                    ].map((item) => (
                      <AccionFasePosterior key={item} label={item} />
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function agruparPorEmpresa<T extends { empresa_id: number }>(items: T[]) {
  const mapa = new Map<number, T[]>();
  items.forEach((item) => {
    const empresaId = Number(item.empresa_id);
    mapa.set(empresaId, [...(mapa.get(empresaId) || []), item]);
  });
  return mapa;
}

function EstadoCentro({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">
      {children}
    </div>
  );
}

function Avisos({
  aviso,
  error,
  exito,
  auditorSoloLectura,
  escrituraHabilitada,
}: {
  aviso: string | null;
  error: string | null;
  exito: string | null;
  auditorSoloLectura: boolean;
  escrituraHabilitada: boolean;
}) {
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-cyan-100">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={18} />
          <p className="text-sm">
            Base conectada a Supabase. No importa archivos, no concilia automaticamente,
            no genera pagos, CxP/CxC ni asientos contables.
          </p>
        </div>
      </section>
      {auditorSoloLectura && (
        <Banner tipo="info">Auditor solo lectura: puedes consultar, pero no crear registros.</Banner>
      )}
      {!escrituraHabilitada && !auditorSoloLectura && (
        <Banner tipo="info">No tiene funcion operativa para modificar conciliacion bancaria.</Banner>
      )}
      {aviso && <Banner tipo="info">{aviso}</Banner>}
      {error && <Banner tipo="error">{error}</Banner>}
      {exito && <Banner tipo="exito">{exito}</Banner>}
    </div>
  );
}

function Banner({ tipo, children }: { tipo: "info" | "error" | "exito"; children: ReactNode }) {
  const clase =
    tipo === "error"
      ? "border-red-400/30 bg-red-400/10 text-red-100"
      : tipo === "exito"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return <div className={`rounded-xl border p-3 text-sm font-semibold ${clase}`}>{children}</div>;
}

function ResumenGeneral({
  resumen,
}: {
  resumen: {
    cuentasActivas: number;
    estadosAbiertos: number;
    movimientosPendientes: number;
    movimientosConciliados: number;
    vinculosRegistrados: number;
    ajustesPendientes: number;
    debitos: number;
    creditos: number;
  };
}) {
  const items = [
    { titulo: "Cuentas activas", valor: String(resumen.cuentasActivas) },
    { titulo: "Estados abiertos", valor: String(resumen.estadosAbiertos) },
    { titulo: "Movimientos pendientes", valor: String(resumen.movimientosPendientes) },
    { titulo: "Movimientos conciliados", valor: String(resumen.movimientosConciliados) },
    { titulo: "Vinculos registrados", valor: String(resumen.vinculosRegistrados) },
    { titulo: "Ajustes pendientes", valor: String(resumen.ajustesPendientes) },
    { titulo: "Debitos", valor: monto(resumen.debitos) },
    { titulo: "Creditos", valor: monto(resumen.creditos) },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.titulo} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">{item.titulo}</p>
          <h2 className="mt-3 text-2xl font-black">{item.valor}</h2>
        </article>
      ))}
    </section>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "resumen", label: "Resumen", icon: <ClipboardList size={15} /> },
    { id: "cuentas", label: "Cuentas", icon: <Wallet size={15} /> },
    { id: "estados", label: "Estados", icon: <CalendarDays size={15} /> },
    { id: "movimientos", label: "Movimientos", icon: <FileText size={15} /> },
    { id: "vinculos", label: "Vinculos", icon: <GitBranch size={15} /> },
    { id: "ajustes", label: "Ajustes", icon: <BadgeDollarSign size={15} /> },
    { id: "fase_posterior", label: "Fase posterior", icon: <Lock size={15} /> },
  ];
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-2">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setTab(item.id)}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
            tab === item.id
              ? "bg-cyan-500 text-slate-950"
              : "text-[var(--muted-strong)] hover:bg-white/10 hover:text-[var(--foreground)]"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <h2 className="text-xl font-black">{titulo}</h2>
      <p className="mt-1 text-sm text-[var(--muted-strong)]">{subtitulo}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function FormularioBloqueado({ auditorSoloLectura }: { auditorSoloLectura: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
      {auditorSoloLectura
        ? "Modo auditor solo lectura: puedes consultar, pero no crear registros."
        : "No tiene funcion operativa para modificar conciliacion bancaria."}
    </div>
  );
}

function FormularioCuenta({
  form,
  setForm,
  empresas,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioCuentaInicial>;
  setForm: (form: ReturnType<typeof formularioCuentaInicial>) => void;
  empresas: Empresa[];
  procesando: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Registrar cuenta bancaria</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId })} />
        <input className="input-custom" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Banco" />
        <input className="input-custom" value={form.nombreCuenta} onChange={(e) => setForm({ ...form, nombreCuenta: e.target.value })} placeholder="Nombre cuenta" />
        <input className="input-custom" value={form.numeroCuenta} onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })} placeholder="Numero cuenta" />
        <input className="input-custom" value={form.tipoCuenta} onChange={(e) => setForm({ ...form, tipoCuenta: e.target.value })} placeholder="Tipo cuenta" />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.saldoInicial} onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })} placeholder="Saldo inicial" />
        <input className="input-custom" type="date" value={form.fechaSaldoInicial} onChange={(e) => setForm({ ...form, fechaSaldoInicial: e.target.value })} />
        <input className="input-custom md:col-span-3" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length} onGuardar={onGuardar} label="Guardar cuenta" />
      </div>
    </div>
  );
}

function FormularioEstado({
  form,
  setForm,
  empresas,
  cuentasPorEmpresa,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioEstadoInicial>;
  setForm: (form: ReturnType<typeof formularioEstadoInicial>) => void;
  empresas: Empresa[];
  cuentasPorEmpresa: Map<number, CuentaBancaria[]>;
  procesando: boolean;
  onGuardar: () => void;
}) {
  const cuentas = cuentasPorEmpresa.get(Number(form.empresaId)) || [];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Registrar estado de cuenta</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, cuentaBancariaId: "" })} />
        <SelectCuenta value={form.cuentaBancariaId} cuentas={cuentas} onChange={(cuentaBancariaId) => setForm({ ...form, cuentaBancariaId })} />
        <input className="input-custom" type="number" value={form.periodoAnio} onChange={(e) => setForm({ ...form, periodoAnio: e.target.value })} placeholder="Anio" />
        <select className="input-custom" value={form.periodoMes} onChange={(e) => setForm({ ...form, periodoMes: e.target.value })}>
          {MESES.map((mes, index) => <option key={mes} value={String(index + 1)}>{mes}</option>)}
        </select>
        <input className="input-custom" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
        <input className="input-custom" type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.saldoInicial} onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })} placeholder="Saldo inicial" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.saldoFinal} onChange={(e) => setForm({ ...form, saldoFinal: e.target.value })} placeholder="Saldo final" />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length || !cuentas.length} onGuardar={onGuardar} label="Guardar estado" />
      </div>
    </div>
  );
}

function FormularioMovimiento({
  form,
  setForm,
  empresas,
  cuentasPorEmpresa,
  estadosPorEmpresa,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioMovimientoInicial>;
  setForm: (form: ReturnType<typeof formularioMovimientoInicial>) => void;
  empresas: Empresa[];
  cuentasPorEmpresa: Map<number, CuentaBancaria[]>;
  estadosPorEmpresa: Map<number, EstadoCuenta[]>;
  procesando: boolean;
  onGuardar: () => void;
}) {
  const empresaId = Number(form.empresaId);
  const cuentas = cuentasPorEmpresa.get(empresaId) || [];
  const estados = (estadosPorEmpresa.get(empresaId) || []).filter((estado) =>
    form.cuentaBancariaId ? estado.cuenta_bancaria_id === form.cuentaBancariaId : true
  );
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Registrar movimiento banco</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, cuentaBancariaId: "", estadoCuentaId: "" })} />
        <SelectCuenta value={form.cuentaBancariaId} cuentas={cuentas} onChange={(cuentaBancariaId) => setForm({ ...form, cuentaBancariaId, estadoCuentaId: "" })} />
        <SelectEstado value={form.estadoCuentaId} estados={estados} onChange={(estadoCuentaId) => setForm({ ...form, estadoCuentaId })} />
        <input className="input-custom" type="date" value={form.fechaMovimiento} onChange={(e) => setForm({ ...form, fechaMovimiento: e.target.value })} />
        <input className="input-custom" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripcion" />
        <input className="input-custom" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Referencia" />
        <select className="input-custom" value={form.tipoMovimiento} onChange={(e) => setForm({ ...form, tipoMovimiento: e.target.value })}>
          {TIPOS_MOVIMIENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.debito} onChange={(e) => setForm({ ...form, debito: e.target.value })} placeholder="Debito" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.credito} onChange={(e) => setForm({ ...form, credito: e.target.value })} placeholder="Credito" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.saldoBanco} onChange={(e) => setForm({ ...form, saldoBanco: e.target.value })} placeholder="Saldo banco" />
        <input className="input-custom" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length || !cuentas.length || !estados.length} onGuardar={onGuardar} label="Guardar movimiento" />
      </div>
    </div>
  );
}

function FormularioVinculo({
  form,
  setForm,
  empresas,
  movimientosPorEmpresa,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioVinculoInicial>;
  setForm: (form: ReturnType<typeof formularioVinculoInicial>) => void;
  empresas: Empresa[];
  movimientosPorEmpresa: Map<number, MovimientoBanco[]>;
  procesando: boolean;
  onGuardar: () => void;
}) {
  const movimientos = movimientosPorEmpresa.get(Number(form.empresaId)) || [];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear vinculo manual</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, movimientoBancoId: "" })} />
        <SelectMovimiento value={form.movimientoBancoId} movimientos={movimientos} onChange={(movimientoBancoId) => setForm({ ...form, movimientoBancoId })} />
        <input className="input-custom" value={form.moduloOrigen} onChange={(e) => setForm({ ...form, moduloOrigen: e.target.value })} placeholder="Modulo origen" />
        <select className="input-custom" value={form.tipoVinculo} onChange={(e) => setForm({ ...form, tipoVinculo: e.target.value })}>
          {TIPOS_VINCULO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <input className="input-custom" value={form.entidadOrigenId} onChange={(e) => setForm({ ...form, entidadOrigenId: e.target.value })} placeholder="Entidad UUID opcional" />
        <input className="input-custom" value={form.entidadOrigenTexto} onChange={(e) => setForm({ ...form, entidadOrigenTexto: e.target.value })} placeholder="Entidad texto opcional" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.montoVinculado} onChange={(e) => setForm({ ...form, montoVinculado: e.target.value })} placeholder="Monto vinculado" />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <input className="input-custom md:col-span-3" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length || !movimientos.length} onGuardar={onGuardar} label="Guardar vinculo" />
      </div>
    </div>
  );
}

function FormularioAjuste({
  form,
  setForm,
  empresas,
  cuentasPorEmpresa,
  estadosPorEmpresa,
  movimientosPorEmpresa,
  procesando,
  onGuardar,
}: {
  form: ReturnType<typeof formularioAjusteInicial>;
  setForm: (form: ReturnType<typeof formularioAjusteInicial>) => void;
  empresas: Empresa[];
  cuentasPorEmpresa: Map<number, CuentaBancaria[]>;
  estadosPorEmpresa: Map<number, EstadoCuenta[]>;
  movimientosPorEmpresa: Map<number, MovimientoBanco[]>;
  procesando: boolean;
  onGuardar: () => void;
}) {
  const empresaId = Number(form.empresaId);
  const cuentas = cuentasPorEmpresa.get(empresaId) || [];
  const estados = (estadosPorEmpresa.get(empresaId) || []).filter((estado) =>
    form.cuentaBancariaId ? estado.cuenta_bancaria_id === form.cuentaBancariaId : true
  );
  const movimientos = (movimientosPorEmpresa.get(empresaId) || []).filter((movimiento) =>
    form.cuentaBancariaId ? movimiento.cuenta_bancaria_id === form.cuentaBancariaId : true
  );
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-gray-400">Crear ajuste</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectEmpresa value={form.empresaId} empresas={empresas} onChange={(empresaId) => setForm({ ...form, empresaId, cuentaBancariaId: "", estadoCuentaId: "", movimientoBancoId: "" })} />
        <SelectCuenta value={form.cuentaBancariaId} cuentas={cuentas} onChange={(cuentaBancariaId) => setForm({ ...form, cuentaBancariaId, estadoCuentaId: "", movimientoBancoId: "" })} />
        <SelectEstado value={form.estadoCuentaId} estados={estados} onChange={(estadoCuentaId) => setForm({ ...form, estadoCuentaId })} opcional />
        <SelectMovimiento value={form.movimientoBancoId} movimientos={movimientos} onChange={(movimientoBancoId) => setForm({ ...form, movimientoBancoId })} opcional />
        <select className="input-custom" value={form.tipoAjuste} onChange={(e) => setForm({ ...form, tipoAjuste: e.target.value })}>
          {TIPOS_AJUSTE.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <input className="input-custom" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripcion" />
        <input className="input-custom" type="number" min="0" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="Monto" />
        <SelectMoneda value={form.moneda} onChange={(moneda) => setForm({ ...form, moneda })} />
        <Checkbox label="Requiere contabilidad" checked={form.requiereContabilidad} onChange={(valor) => setForm({ ...form, requiereContabilidad: valor })} />
        <input className="input-custom md:col-span-2" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" />
        <BotonGuardar procesando={procesando} disabled={!empresas.length || !cuentas.length} onGuardar={onGuardar} label="Guardar ajuste" />
      </div>
    </div>
  );
}

function SelectEmpresa({ value, empresas, onChange }: { value: string; empresas: Empresa[]; onChange: (value: string) => void }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Empresa...</option>
      {empresas.map((empresa) => <option key={empresa.id} value={String(empresa.id)}>{empresa.nombre}</option>)}
    </select>
  );
}

function SelectCuenta({ value, cuentas, onChange }: { value: string; cuentas: CuentaBancaria[]; onChange: (value: string) => void }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Cuenta bancaria...</option>
      {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} / {cuenta.nombre_cuenta}</option>)}
    </select>
  );
}

function SelectEstado({ value, estados, onChange, opcional = false }: { value: string; estados: EstadoCuenta[]; onChange: (value: string) => void; opcional?: boolean }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{opcional ? "Sin estado..." : "Estado cuenta..."}</option>
      {estados.map((estado) => <option key={estado.id} value={estado.id}>{estado.periodo_anio} / {MESES[estado.periodo_mes - 1] || estado.periodo_mes}</option>)}
    </select>
  );
}

function SelectMovimiento({ value, movimientos, onChange, opcional = false }: { value: string; movimientos: MovimientoBanco[]; onChange: (value: string) => void; opcional?: boolean }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{opcional ? "Sin movimiento..." : "Movimiento banco..."}</option>
      {movimientos.map((movimiento) => (
        <option key={movimiento.id} value={movimiento.id}>
          {fechaMostrar(movimiento.fecha_movimiento)} / {movimiento.referencia || movimiento.tipo_movimiento}
        </option>
      ))}
    </select>
  );
}

function SelectMoneda({ value, onChange }: { value: Moneda; onChange: (value: Moneda) => void }) {
  return (
    <select className="input-custom" value={value} onChange={(e) => onChange(e.target.value as Moneda)}>
      {MONEDAS.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
    </select>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-[3.25rem] items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function BotonGuardar({ procesando, disabled, onGuardar, label }: { procesando: boolean; disabled: boolean; onGuardar: () => void; label: string }) {
  return (
    <button type="button" onClick={onGuardar} disabled={procesando || disabled} className="btn-primary inline-flex items-center justify-center gap-2">
      {procesando ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
      {label}
    </button>
  );
}

function TablaCuentas({ cuentas, empresasPorId }: { cuentas: CuentaBancaria[]; empresasPorId: Map<number, string> }) {
  if (!cuentas.length) return <EmptyState texto="No hay cuentas bancarias para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400"><tr>{["Empresa", "Banco", "Cuenta", "Moneda", "Saldo inicial", "Estado", "Observaciones", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/10">
        {cuentas.map((cuenta) => (
          <tr key={cuenta.id} className="align-top text-sm">
            <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(cuenta.empresa_id)) || `Empresa #${cuenta.empresa_id}`}</td>
            <td className="px-4 py-4 font-bold">{cuenta.banco}</td>
            <td className="px-4 py-4 text-gray-300">{cuenta.nombre_cuenta}<br />{cuenta.numero_cuenta || "-"}<br />{cuenta.tipo_cuenta || "-"}</td>
            <td className="px-4 py-4 text-gray-300">{cuenta.moneda}</td>
            <td className="px-4 py-4 text-gray-300">{monto(cuenta.saldo_inicial, cuenta.moneda)}<br />{fechaMostrar(cuenta.fecha_saldo_inicial)}</td>
            <td className="px-4 py-4"><Badge estado={cuenta.activo ? cuenta.estado : "Inactiva"} /></td>
            <td className="px-4 py-4 text-gray-300">{cuenta.observaciones || "-"}</td>
            <td className="px-4 py-4"><div className="flex flex-col gap-2"><AccionFasePosterior label="Editar" /><AccionFasePosterior label="Inactivar" /></div></td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaEstados({ estados, empresasPorId, cuentasPorId }: { estados: EstadoCuenta[]; empresasPorId: Map<number, string>; cuentasPorId: Map<string, CuentaBancaria> }) {
  if (!estados.length) return <EmptyState texto="No hay estados de cuenta para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400"><tr>{["Empresa", "Cuenta", "Periodo", "Fechas", "Saldos", "Estado", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/10">
        {estados.map((estado) => {
          const cuenta = cuentasPorId.get(estado.cuenta_bancaria_id);
          return (
            <tr key={estado.id} className="align-top text-sm">
              <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(estado.empresa_id)) || `Empresa #${estado.empresa_id}`}</td>
              <td className="px-4 py-4 text-gray-300">{cuenta ? `${cuenta.banco} / ${cuenta.nombre_cuenta}` : estado.cuenta_bancaria_id}</td>
              <td className="px-4 py-4 font-bold">{estado.periodo_anio} / {MESES[estado.periodo_mes - 1] || estado.periodo_mes}</td>
              <td className="px-4 py-4 text-gray-300">{fechaMostrar(estado.fecha_inicio)} - {fechaMostrar(estado.fecha_fin)}</td>
              <td className="px-4 py-4 text-gray-300">Inicial {monto(estado.saldo_inicial, estado.moneda)}<br />Final {monto(estado.saldo_final, estado.moneda)}</td>
              <td className="px-4 py-4"><Badge estado={estado.estado} /></td>
              <td className="px-4 py-4"><div className="flex flex-col gap-2"><AccionFasePosterior label="Cerrar" /><AccionFasePosterior label="Conciliar" /><AccionFasePosterior label="Anular" /></div></td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function TablaMovimientos({ movimientos, empresasPorId, cuentasPorId, estadosPorId }: { movimientos: MovimientoBanco[]; empresasPorId: Map<number, string>; cuentasPorId: Map<string, CuentaBancaria>; estadosPorId: Map<string, EstadoCuenta> }) {
  if (!movimientos.length) return <EmptyState texto="No hay movimientos bancarios para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400"><tr>{["Empresa", "Cuenta / Estado", "Movimiento", "Referencia", "Montos", "Estado", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/10">
        {movimientos.map((movimiento) => {
          const cuenta = cuentasPorId.get(movimiento.cuenta_bancaria_id);
          const estado = estadosPorId.get(movimiento.estado_cuenta_id);
          return (
            <tr key={movimiento.id} className="align-top text-sm">
              <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(movimiento.empresa_id)) || `Empresa #${movimiento.empresa_id}`}</td>
              <td className="px-4 py-4 text-gray-300">{cuenta ? `${cuenta.banco} / ${cuenta.nombre_cuenta}` : movimiento.cuenta_bancaria_id}<br />{estado ? `${estado.periodo_anio}/${estado.periodo_mes}` : movimiento.estado_cuenta_id}</td>
              <td className="px-4 py-4"><p className="font-bold">{movimiento.tipo_movimiento}</p><p className="text-xs text-gray-500">{fechaMostrar(movimiento.fecha_movimiento)} / {movimiento.descripcion || "-"}</p></td>
              <td className="px-4 py-4 text-gray-300">{movimiento.referencia || "-"}</td>
              <td className="px-4 py-4 text-gray-300">Debito {monto(movimiento.debito, movimiento.moneda)}<br />Credito {monto(movimiento.credito, movimiento.moneda)}<br />Saldo {monto(movimiento.saldo_banco, movimiento.moneda)}</td>
              <td className="px-4 py-4"><Badge estado={movimiento.conciliado ? "Conciliado" : movimiento.estado} /></td>
              <td className="px-4 py-4"><AccionFasePosterior label="Conciliar" /></td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function TablaVinculos({ vinculos, empresasPorId, movimientosPorId }: { vinculos: VinculoConciliacion[]; empresasPorId: Map<number, string>; movimientosPorId: Map<string, MovimientoBanco> }) {
  if (!vinculos.length) return <EmptyState texto="No hay vinculos manuales para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400"><tr>{["Empresa", "Movimiento", "Origen", "Tipo", "Monto", "Estado", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/10">
        {vinculos.map((vinculo) => {
          const movimiento = movimientosPorId.get(vinculo.movimiento_banco_id);
          return (
            <tr key={vinculo.id} className="align-top text-sm">
              <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(vinculo.empresa_id)) || `Empresa #${vinculo.empresa_id}`}</td>
              <td className="px-4 py-4 text-gray-300">{movimiento ? `${fechaMostrar(movimiento.fecha_movimiento)} / ${movimiento.referencia || movimiento.tipo_movimiento}` : vinculo.movimiento_banco_id}</td>
              <td className="px-4 py-4 text-gray-300">{vinculo.modulo_origen}<br />{vinculo.entidad_origen_id || vinculo.entidad_origen_texto || "-"}</td>
              <td className="px-4 py-4 font-bold">{vinculo.tipo_vinculo}</td>
              <td className="px-4 py-4 text-gray-300">{monto(vinculo.monto_vinculado, vinculo.moneda)}</td>
              <td className="px-4 py-4"><Badge estado={vinculo.estado} /></td>
              <td className="px-4 py-4"><AccionFasePosterior label="Revertir" /></td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function TablaAjustes({ ajustes, empresasPorId, cuentasPorId, estadosPorId, movimientosPorId }: { ajustes: AjusteConciliacion[]; empresasPorId: Map<number, string>; cuentasPorId: Map<string, CuentaBancaria>; estadosPorId: Map<string, EstadoCuenta>; movimientosPorId: Map<string, MovimientoBanco> }) {
  if (!ajustes.length) return <EmptyState texto="No hay ajustes para mostrar." />;
  return (
    <Tabla>
      <thead className="bg-white/5 text-xs uppercase text-gray-400"><tr>{["Empresa", "Cuenta", "Estado / Movimiento", "Tipo", "Monto", "Contabilidad", "Estado", "Acciones"].map((col) => <th key={col} className="px-4 py-3 text-left">{col}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/10">
        {ajustes.map((ajuste) => {
          const cuenta = cuentasPorId.get(ajuste.cuenta_bancaria_id);
          const estado = ajuste.estado_cuenta_id ? estadosPorId.get(ajuste.estado_cuenta_id) : null;
          const movimiento = ajuste.movimiento_banco_id ? movimientosPorId.get(ajuste.movimiento_banco_id) : null;
          return (
            <tr key={ajuste.id} className="align-top text-sm">
              <td className="px-4 py-4 text-gray-300">{empresasPorId.get(Number(ajuste.empresa_id)) || `Empresa #${ajuste.empresa_id}`}</td>
              <td className="px-4 py-4 text-gray-300">{cuenta ? `${cuenta.banco} / ${cuenta.nombre_cuenta}` : ajuste.cuenta_bancaria_id}</td>
              <td className="px-4 py-4 text-gray-300">Estado {estado ? `${estado.periodo_anio}/${estado.periodo_mes}` : "-"}<br />Mov. {movimiento ? movimiento.referencia || movimiento.tipo_movimiento : "-"}</td>
              <td className="px-4 py-4"><p className="font-bold">{ajuste.tipo_ajuste}</p><p className="text-xs text-gray-500">{ajuste.descripcion}</p></td>
              <td className="px-4 py-4 text-gray-300">{monto(ajuste.monto, ajuste.moneda)}</td>
              <td className="px-4 py-4 text-gray-300">{ajuste.requiere_contabilidad ? "Si" : "No"}</td>
              <td className="px-4 py-4"><Badge estado={ajuste.estado} /></td>
              <td className="px-4 py-4"><div className="flex flex-col gap-2"><AccionFasePosterior label="Aprobar" /><AccionFasePosterior label="Contabilizar" /><AccionFasePosterior label="Anular" /></div></td>
            </tr>
          );
        })}
      </tbody>
    </Tabla>
  );
}

function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-left">{children}</table>
    </div>
  );
}

function Badge({ estado }: { estado: string }) {
  const texto = estado.toLowerCase();
  const clase = texto.includes("pendiente") || texto.includes("borrador") || texto.includes("revision")
    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
    : texto.includes("anulado") || texto.includes("duplicado")
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : texto.includes("conciliado") || texto.includes("cerrado") || texto.includes("aprobado")
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
        : "border-white/10 bg-white/5 text-gray-300";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${clase}`}>{estado}</span>;
}

function AccionFasePosterior({ label }: { label: string }) {
  void label;
  return null;
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-400">
      {texto}
    </div>
  );
}
