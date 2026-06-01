"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Plus,
  RefreshCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import {
  anularAsientoContable,
  calcularBalanceComprobacion,
  cambiarEstadoDocumentoContable,
  corregirDocumentoContableRevision,
  crearAsientoContable,
  crearCuentaContable,
  crearDocumentoContableRevision,
  documentoContableRequiereAlerta24h,
  guardarDistribucionDocumentoContable,
  listarAsientosContables,
  listarCatalogoCuentas,
  listarDistribucionDocumentoContable,
  listarDocumentosContablesRevision,
  listarPeriodosContables,
  obtenerOCrearPeriodoContable,
  type AsientoContable,
  type BalanceComprobacionFila,
  type CatalogoCuenta,
  type DistribucionDocumentoContable,
  type DocumentoContableRevision,
  type MovimientoDetalleInput,
  type NaturalezaCuenta,
  type PeriodoContable,
} from "../../lib/contabilidadV2";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

interface Movimiento {
  id: number;
  tipo: string;
  descripcion: string;
  monto: number;
  empresa: string;
  empresa_id: number | null;
  moneda: string | null;
  fecha: string;
  estado?: string | null;
  creado_por?: string | null;
  anulado_por?: string | null;
  anulado_at?: string | null;
  motivo_anulacion?: string | null;
}

interface Empresa {
  id: number;
  nombre: string;
}

type TabContabilidad =
  | "movimientos"
  | "catalogo"
  | "documentos_revision"
  | "periodos"
  | "asientos"
  | "crear_asiento"
  | "balance";

interface LineaAsientoForm {
  id: string;
  cuentaId: string;
  descripcion: string;
  debe: string;
  haber: string;
  moneda: string;
  tipoCambio: string;
}

interface LineaDistribucionForm {
  id: string;
  cuentaId: string;
  descripcion: string;
  debito: string;
  credito: string;
  moneda: string;
}

const TABS: Array<{
  id: TabContabilidad;
  nombre: string;
  descripcion: string;
}> = [
  {
    id: "movimientos",
    nombre: "Movimientos operativos",
    descripcion: "Ingresos y egresos usados por Reportes V1",
  },
  {
    id: "catalogo",
    nombre: "Catalogo de cuentas",
    descripcion: "Cuentas globales y por empresa",
  },
  {
    id: "documentos_revision",
    nombre: "Documentos pendientes",
    descripcion: "Facturas y documentos antes de contabilizar",
  },
  {
    id: "periodos",
    nombre: "Periodos contables",
    descripcion: "Meses abiertos, cerrados o bloqueados",
  },
  {
    id: "asientos",
    nombre: "Asientos contables",
    descripcion: "Partida doble registrada",
  },
  {
    id: "crear_asiento",
    nombre: "Crear asiento",
    descripcion: "Registro manual balanceado",
  },
  {
    id: "balance",
    nombre: "Balance de comprobacion",
    descripcion: "Solo asientos registrados",
  },
];

const TIPOS_CUENTA = [
  "activo",
  "pasivo",
  "patrimonio",
  "ingreso",
  "gasto",
  "costo",
];

function fechaHoyISO() {
  return new Date().toISOString().split("T")[0];
}

function nuevaLineaAsiento(): LineaAsientoForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    cuentaId: "",
    descripcion: "",
    debe: "",
    haber: "",
    moneda: "GTQ",
    tipoCambio: "",
  };
}

function nuevaLineaDistribucion(moneda = "GTQ"): LineaDistribucionForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    cuentaId: "",
    descripcion: "",
    debito: "",
    credito: "",
    moneda,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado.";
}

function numero(valor: string | number | null | undefined) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

function textoEstado(valor?: string | null) {
  return valor || "Sin estado";
}

export default function ContabilidadPage() {
  const router = useRouter();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [listaEmpresas, setListaEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoContabilidad, setCargandoContabilidad] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [empresaFiltro, setEmpresaFiltro] = useState("Todas");
  const [rolActual, setRolActual] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [tabActiva, setTabActiva] = useState<TabContabilidad>("movimientos");
  const [cargandoV2, setCargandoV2] = useState(false);
  const [mensajeV2, setMensajeV2] = useState("");
  const [empresaContableId, setEmpresaContableId] = useState("");

  const [catalogoCuentas, setCatalogoCuentas] = useState<CatalogoCuenta[]>([]);
  const [documentosRevision, setDocumentosRevision] = useState<
    DocumentoContableRevision[]
  >([]);
  const [distribucionesDocumento, setDistribucionesDocumento] = useState<
    DistribucionDocumentoContable[]
  >([]);
  const [periodosContables, setPeriodosContables] = useState<PeriodoContable[]>([]);
  const [asientosContables, setAsientosContables] = useState<AsientoContable[]>([]);
  const [balanceComprobacion, setBalanceComprobacion] = useState<
    BalanceComprobacionFila[]
  >([]);
  const [detalleAbiertoId, setDetalleAbiertoId] = useState<string | number | null>(null);

  const [form, setForm] = useState({
    tipo: "Ingreso",
    descripcion: "",
    monto: "",
    empresa: "",
    empresaId: "",
    moneda: "GTQ",
    fecha: fechaHoyISO(),
  });

  const [cuentaForm, setCuentaForm] = useState({
    empresaId: "",
    codigo: "",
    nombre: "",
    tipo: "activo",
    subtipo: "",
    naturaleza: "deudora" as NaturalezaCuenta,
    permiteMovimientos: true,
    descripcion: "",
  });

  const [documentoForm, setDocumentoForm] = useState({
    empresaId: "",
    proveedorId: "",
    clienteId: "",
    tipoDocumento: "Factura proveedor",
    serie: "",
    numeroDocumento: "",
    fechaDocumento: fechaHoyISO(),
    fechaVencimiento: "",
    moneda: "GTQ",
    subtotal: "",
    iva: "",
    isr: "",
    total: "",
    descripcion: "",
  });

  const [documentosFiltroEstado, setDocumentosFiltroEstado] = useState("");
  const [documentoDistribucionId, setDocumentoDistribucionId] = useState<
    string | number | null
  >(null);
  const [lineasDistribucion, setLineasDistribucion] = useState<
    LineaDistribucionForm[]
  >([nuevaLineaDistribucion()]);

  const [periodoForm, setPeriodoForm] = useState({
    empresaId: "",
    fecha: fechaHoyISO(),
  });

  const [asientosFiltros, setAsientosFiltros] = useState({
    fechaDesde: "",
    fechaHasta: "",
    estado: "",
    origenModulo: "",
  });

  const [asientoForm, setAsientoForm] = useState({
    empresaId: "",
    fecha: fechaHoyISO(),
    descripcion: "",
    monedaBase: "GTQ",
  });
  const [lineasAsiento, setLineasAsiento] = useState<LineaAsientoForm[]>([
    nuevaLineaAsiento(),
    nuevaLineaAsiento(),
  ]);

  const [balanceFiltros, setBalanceFiltros] = useState({
    empresaId: "",
    fechaDesde: "",
    fechaHasta: "",
    moneda: "",
  });

  useEffect(() => {
    async function iniciar() {
      const acceso = await validarAccesoModuloUsuario("contabilidad");

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
          alert("El modulo de Contabilidad esta desactivado.");
        } else {
          alert("No tienes acceso al modulo de Contabilidad.");
        }

        router.replace("/dashboard");
        return;
      }

      const user = acceso.user!;
      const perfil = acceso.perfil!;
      const rolNormalizado = (perfil.rol || "").trim().toLowerCase();

      if (
        !["admin", "supervisor", "jefe", "contador", "auxiliar", "empleado"].includes(
          rolNormalizado
        )
      ) {
        router.replace("/dashboard");
        return;
      }

      setRolActual(rolNormalizado);
      setUserId(user.id);
      setCargandoContabilidad(true);
      setAutorizado(true);
      setValidandoAcceso(false);

      try {
        const idsPermitidos = await obtenerEmpresasPermitidas(
          user.id,
          perfil.rol || ""
        );

        setEmpresasPermitidasIds(idsPermitidos);

        await Promise.all([
          obtenerEmpresas(idsPermitidos),
          obtenerMovimientos(idsPermitidos),
        ]);
      } catch (error) {
        console.error("Error cargando datos de Contabilidad:", error);
        alert("Error al cargar datos de Contabilidad.");
      } finally {
        setCargandoContabilidad(false);
      }
    }

    iniciar();
  }, [router]);

  async function obtenerEmpresas(idsPermitidos: number[]) {
    if (!idsPermitidos.length) {
      setListaEmpresas([]);
      return idsPermitidos;
    }

    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) throw error;

    const empresas = data || [];
    setListaEmpresas(empresas);

    if (empresas.length) {
      const empresaInicial = String(empresas[0].id);
      setEmpresaContableId((actual) => actual || empresaInicial);
      setCuentaForm((actual) => ({
        ...actual,
        empresaId: actual.empresaId || empresaInicial,
      }));
      setDocumentoForm((actual) => ({
        ...actual,
        empresaId: actual.empresaId || empresaInicial,
      }));
      setPeriodoForm((actual) => ({
        ...actual,
        empresaId: actual.empresaId || empresaInicial,
      }));
      setAsientoForm((actual) => ({
        ...actual,
        empresaId: actual.empresaId || empresaInicial,
      }));
      setBalanceFiltros((actual) => ({
        ...actual,
        empresaId: actual.empresaId || empresaInicial,
      }));
    }

    return idsPermitidos;
  }

  async function obtenerMovimientos(idsPermitidos?: number[]) {
    const ids = idsPermitidos || empresasPermitidasIds;

    if (!ids.length) {
      setMovimientos([]);
      return;
    }

    const { data, error } = await supabase
      .from("movimientos")
      .select(
        "id,tipo,descripcion,monto,empresa,empresa_id,moneda,fecha,estado,creado_por,anulado_por,anulado_at,motivo_anulacion"
      )
      .in("empresa_id", ids)
      .order("fecha", { ascending: false });

    if (error) throw error;

    setMovimientos(data || []);
  }

  function validarEmpresaPermitida(valor: string | number, accion = "operar") {
    const empresaId = Number(valor);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new Error(`Debe seleccionar una empresa valida para ${accion}.`);
    }

    if (!empresasPermitidasIds.includes(empresaId)) {
      throw new Error("No tienes permiso para operar sobre esa empresa.");
    }

    return empresaId;
  }

  function empresaNombre(empresaId: string | number | null | undefined) {
    if (empresaId === null || empresaId === undefined || empresaId === "") {
      return "Global";
    }

    return (
      listaEmpresas.find((empresa) => Number(empresa.id) === Number(empresaId))
        ?.nombre || `Empresa ${empresaId}`
    );
  }

  async function crearMovimiento() {
    if (!userId) {
      alert("Sesion no valida.");
      return;
    }

    if (!form.descripcion || !form.monto || !form.empresa || !form.empresaId) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(form.empresaId, "crear movimientos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    const empresaSeleccionada = listaEmpresas.find((emp) => emp.id === empresaId);

    setLoading(true);

    try {
      const { data: movimientoCreado, error } = await supabase
        .from("movimientos")
        .insert([
          {
            tipo: form.tipo,
            descripcion: form.descripcion,
            monto: Number(form.monto),
            empresa: empresaSeleccionada?.nombre || form.empresa,
            empresa_id: empresaId,
            moneda: form.moneda,
            fecha: form.fecha,
            estado: "activo",
            creado_por: userId,
          },
        ])
        .select("id,tipo,descripcion,monto,empresa,empresa_id,moneda,fecha,estado")
        .single();

      if (error) throw error;

      let auditoriaRegistrada = true;

      try {
        await registrarAuditoriaEvento({
          empresa_id: movimientoCreado.empresa_id,
          modulo: "contabilidad",
          accion: "crear_movimiento",
          entidad_tipo: "movimiento",
          entidad_id: movimientoCreado.id,
          estado_nuevo: movimientoCreado.estado || "activo",
          descripcion: "Movimiento contable creado",
          sensible: true,
          visible_calendario: Boolean(movimientoCreado.fecha),
          origen: "modulo_contabilidad",
          metadatos: {
            tipo: movimientoCreado.tipo,
            monto: Number(movimientoCreado.monto),
            moneda: movimientoCreado.moneda,
            fecha: movimientoCreado.fecha,
            descripcion: movimientoCreado.descripcion,
          },
        });
      } catch (auditoriaError) {
        auditoriaRegistrada = false;
        console.error(
          "El movimiento fue creado, pero no se pudo registrar la auditoria:",
          auditoriaError
        );
      }

      setForm({
        ...form,
        descripcion: "",
        monto: "",
      });

      await obtenerMovimientos();

      if (!auditoriaRegistrada) {
        alert("Movimiento creado, pero no se pudo registrar la auditoria central.");
      }
    } catch (error) {
      console.error("Error creando movimiento:", error);
      alert(`Error al registrar movimiento: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function anularMovimiento(id: number) {
    if (!puedeAnularMovimiento) {
      alert("No tienes permiso para anular movimientos.");
      return;
    }

    if (!userId) {
      alert("Sesion no valida.");
      return;
    }

    const movimientoAnulado = movimientos.find((movimiento) => movimiento.id === id);

    if (!movimientoAnulado?.empresa_id) {
      alert("No se encontro un movimiento valido para anular.");
      return;
    }

    try {
      validarEmpresaPermitida(movimientoAnulado.empresa_id, "anular movimientos");
    } catch (error) {
      alert(getErrorMessage(error));
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

    const { error } = await supabase
      .from("movimientos")
      .update({
        estado: "anulado",
        anulado_por: userId,
        anulado_at: new Date().toISOString(),
        motivo_anulacion: motivo.trim(),
      })
      .eq("id", id)
      .eq("empresa_id", movimientoAnulado.empresa_id);

    if (error) {
      console.error("Error anulando movimiento:", error);
      alert("Error al anular movimiento.");
      return;
    }

    let auditoriaRegistrada = true;
    let historialRegistrado = true;

    try {
      await registrarAuditoriaEvento({
        empresa_id: movimientoAnulado.empresa_id,
        modulo: "contabilidad",
        accion: "anular_movimiento",
        entidad_tipo: "movimiento",
        entidad_id: id,
        estado_anterior: movimientoAnulado.estado || "activo",
        estado_nuevo: "anulado",
        motivo: motivo.trim(),
        descripcion: "Movimiento contable anulado",
        sensible: true,
        visible_calendario: true,
        origen: "modulo_contabilidad",
        metadatos: {
          tipo: movimientoAnulado.tipo,
          monto: Number(movimientoAnulado.monto),
          moneda: movimientoAnulado.moneda,
          fecha: movimientoAnulado.fecha,
          descripcion: movimientoAnulado.descripcion,
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
          movimiento_id: id,
          accion: "Movimiento anulado",
          comentario: motivo.trim(),
          usuario_id: userId,
        },
      ]);

    if (historialError) {
      historialRegistrado = false;
      console.error(
        "El movimiento fue anulado, pero no se pudo registrar el historial especifico:",
        historialError
      );
    }

    await obtenerMovimientos();

    if (!auditoriaRegistrada || !historialRegistrado) {
      alert(
        "Movimiento anulado, pero hubo un problema registrando auditoria o historial."
      );
    }
  }

  async function cargarCatalogo(empresaIdValor = empresaContableId) {
    try {
      const empresaId = validarEmpresaPermitida(empresaIdValor, "listar catalogo");
      setCargandoV2(true);
      setMensajeV2("");
      const cuentas = await listarCatalogoCuentas({
        empresa_id: empresaId,
        incluir_globales: true,
      });
      setCatalogoCuentas(cuentas);
    } catch (error) {
      console.error("Error cargando catalogo:", error);
      setMensajeV2(getErrorMessage(error));
    } finally {
      setCargandoV2(false);
    }
  }

  async function cargarPeriodos(empresaIdValor = empresaContableId) {
    try {
      const empresaId = validarEmpresaPermitida(empresaIdValor, "listar periodos");
      setCargandoV2(true);
      setMensajeV2("");
      const periodos = await listarPeriodosContables({ empresa_id: empresaId });
      setPeriodosContables(periodos);
    } catch (error) {
      console.error("Error cargando periodos:", error);
      setMensajeV2(getErrorMessage(error));
    } finally {
      setCargandoV2(false);
    }
  }

  async function cargarAsientos(empresaIdValor = empresaContableId) {
    try {
      const empresaId = validarEmpresaPermitida(empresaIdValor, "listar asientos");
      setCargandoV2(true);
      setMensajeV2("");
      const asientos = await listarAsientosContables({
        empresa_id: empresaId,
        fecha_desde: asientosFiltros.fechaDesde || undefined,
        fecha_hasta: asientosFiltros.fechaHasta || undefined,
        estado: asientosFiltros.estado || undefined,
        origen_modulo: asientosFiltros.origenModulo || undefined,
        incluir_detalles: true,
        limite: 200,
      });
      setAsientosContables(asientos);
    } catch (error) {
      console.error("Error cargando asientos:", error);
      setMensajeV2(getErrorMessage(error));
    } finally {
      setCargandoV2(false);
    }
  }

  async function cargarDocumentosRevision(empresaIdValor = empresaContableId) {
    try {
      const empresaId = validarEmpresaPermitida(
        empresaIdValor,
        "listar documentos para revision"
      );
      setCargandoV2(true);
      setMensajeV2("");
      const documentos = await listarDocumentosContablesRevision({
        empresa_id: empresaId,
        estado: documentosFiltroEstado || undefined,
        limite: 200,
      });
      const [distribuciones, cuentas] = await Promise.all([
        listarDistribucionDocumentoContable({ empresa_id: empresaId }),
        listarCatalogoCuentas({ empresa_id: empresaId, incluir_globales: true }),
      ]);
      setDocumentosRevision(documentos);
      setDistribucionesDocumento(distribuciones);
      setCatalogoCuentas(cuentas);
    } catch (error) {
      console.error("Error cargando documentos para revision:", error);
      setMensajeV2(getErrorMessage(error));
      setDocumentosRevision([]);
      setDistribucionesDocumento([]);
    } finally {
      setCargandoV2(false);
    }
  }

  async function cargarDatosTab(tab: TabContabilidad, empresaIdValor = empresaContableId) {
    if (tab === "catalogo" || tab === "crear_asiento") {
      await cargarCatalogo(empresaIdValor);
      return;
    }

    if (tab === "documentos_revision") {
      await cargarDocumentosRevision(empresaIdValor);
      return;
    }

    if (tab === "periodos") {
      await cargarPeriodos(empresaIdValor);
      return;
    }

    if (tab === "asientos") {
      await cargarAsientos(empresaIdValor);
      return;
    }

    if (tab === "balance") {
      await calcularBalance(empresaIdValor);
    }
  }

  async function cambiarTab(tab: TabContabilidad) {
    setTabActiva(tab);
    setMensajeV2("");
    if (tab !== "movimientos") {
      await cargarDatosTab(tab);
    }
  }

  async function cambiarEmpresaContable(valor: string) {
    setEmpresaContableId(valor);
    setCuentaForm((actual) => ({ ...actual, empresaId: valor }));
    setDocumentoForm((actual) => ({ ...actual, empresaId: valor }));
    setPeriodoForm((actual) => ({ ...actual, empresaId: valor }));
    setAsientoForm((actual) => ({ ...actual, empresaId: valor }));
    setBalanceFiltros((actual) => ({ ...actual, empresaId: valor }));

    if (tabActiva !== "movimientos") {
      await cargarDatosTab(tabActiva, valor);
    }
  }

  async function crearCuenta() {
    const esGlobal = cuentaForm.empresaId === "global";

    if (esGlobal && !["admin", "jefe"].includes(rolActual)) {
      alert("Solo admin o jefe pueden crear cuentas globales.");
      return;
    }

    let empresaId: number | null = null;

    try {
      empresaId = esGlobal
        ? null
        : validarEmpresaPermitida(cuentaForm.empresaId, "crear cuentas");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    if (!cuentaForm.codigo.trim() || !cuentaForm.nombre.trim() || !cuentaForm.tipo.trim()) {
      alert("Codigo, nombre y tipo son obligatorios.");
      return;
    }

    try {
      setLoading(true);
      await crearCuentaContable({
        empresa_id: empresaId,
        codigo: cuentaForm.codigo,
        nombre: cuentaForm.nombre,
        tipo: cuentaForm.tipo,
        subtipo: cuentaForm.subtipo || null,
        naturaleza: cuentaForm.naturaleza,
        permite_movimientos: cuentaForm.permiteMovimientos,
        descripcion: cuentaForm.descripcion || null,
      });

      setCuentaForm((actual) => ({
        ...actual,
        codigo: "",
        nombre: "",
        subtipo: "",
        descripcion: "",
      }));

      await cargarCatalogo(empresaContableId);
      alert("Cuenta contable creada.");
    } catch (error) {
      console.error("Error creando cuenta contable:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function registrarDocumentoRevision() {
    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(
        documentoForm.empresaId,
        "registrar documentos para revision"
      );
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    if (
      !documentoForm.tipoDocumento.trim() ||
      !documentoForm.numeroDocumento.trim() ||
      !documentoForm.fechaDocumento ||
      !documentoForm.total
    ) {
      alert("Tipo, numero, fecha y total son obligatorios.");
      return;
    }

    try {
      setLoading(true);
      await crearDocumentoContableRevision({
        empresa_id: empresaId,
        proveedor_id: documentoForm.proveedorId.trim() || null,
        cliente_id: documentoForm.clienteId.trim() || null,
        tipo_documento: documentoForm.tipoDocumento,
        serie: documentoForm.serie || null,
        numero_documento: documentoForm.numeroDocumento,
        fecha_documento: documentoForm.fechaDocumento,
        fecha_vencimiento: documentoForm.fechaVencimiento || null,
        moneda: documentoForm.moneda,
        subtotal: numero(documentoForm.subtotal),
        iva: numero(documentoForm.iva),
        isr: numero(documentoForm.isr),
        total: numero(documentoForm.total),
        descripcion: documentoForm.descripcion || null,
        metadatos: {
          origen: "cola_revision_contable",
          conexion_futura: [
            "distribucion_contable",
            "cuentas_por_pagar",
            "cuentas_por_cobrar",
            "impuestos",
          ],
        },
      });

      setDocumentoForm((actual) => ({
        ...actual,
        proveedorId: "",
        clienteId: "",
        serie: "",
        numeroDocumento: "",
        fechaDocumento: fechaHoyISO(),
        fechaVencimiento: "",
        subtotal: "",
        iva: "",
        isr: "",
        total: "",
        descripcion: "",
      }));

      await cargarDocumentosRevision(String(empresaId));
      alert("Documento registrado como Pendiente.");
    } catch (error) {
      console.error("Error registrando documento para revision:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function cambiarEstadoDocumentoRevision(
    documento: DocumentoContableRevision,
    estado: "En revision" | "Observado" | "Contabilizado" | "Rechazado" | "Vencido"
  ) {
    try {
      validarEmpresaPermitida(documento.empresa_id, "revisar documentos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    let observacion: string | null = null;
    if (estado === "Observado" || estado === "Rechazado") {
      observacion = window.prompt("Escribe la observacion del contador:") || "";
      if (observacion.trim().length < 5) {
        alert("La observacion debe tener al menos 5 caracteres.");
        return;
      }
    }

    const confirmar =
      estado === "Contabilizado"
        ? window.confirm(
            "Se marcara como Contabilizado sin crear asiento automatico. Debe existir adjunto y quedara listo para distribucion contable futura."
          )
        : true;

    if (!confirmar) return;

    try {
      setLoading(true);
      await cambiarEstadoDocumentoContable({
        id: documento.id,
        empresa_id: documento.empresa_id,
        estado,
        observacion,
      });
      await cargarDocumentosRevision(String(documento.empresa_id));
      alert(`Documento actualizado a ${estado}.`);
    } catch (error) {
      console.error("Error actualizando documento de revision:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function corregirDocumentoRevision(documento: DocumentoContableRevision) {
    try {
      validarEmpresaPermitida(documento.empresa_id, "corregir documentos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    const observacion = window.prompt("Motivo de la correccion:") || "";
    if (observacion.trim().length < 5) {
      alert("El motivo debe tener al menos 5 caracteres.");
      return;
    }

    const totalTexto = window.prompt(
      "Total corregido:",
      String(documento.total)
    );
    if (totalTexto === null) return;

    const descripcion = window.prompt(
      "Descripcion corregida:",
      documento.descripcion || ""
    );
    if (descripcion === null) return;

    try {
      setLoading(true);
      await corregirDocumentoContableRevision({
        id: documento.id,
        empresa_id: documento.empresa_id,
        total: numero(totalTexto),
        descripcion,
        observacion,
      });
      await cargarDocumentosRevision(String(documento.empresa_id));
      alert("Documento corregido y auditado.");
    } catch (error) {
      console.error("Error corrigiendo documento:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function abrirDistribucionDocumento(documento: DocumentoContableRevision) {
    const existentes = distribucionesDocumento.filter(
      (linea) => String(linea.documento_contable_id) === String(documento.id)
    );

    setDocumentoDistribucionId(documento.id);
    setLineasDistribucion(
      existentes.length
        ? existentes.map((linea) => ({
            id: String(linea.id),
            cuentaId: String(linea.cuenta_id),
            descripcion: linea.descripcion || "",
            debito: linea.debito ? String(linea.debito) : "",
            credito: linea.credito ? String(linea.credito) : "",
            moneda: linea.moneda || documento.moneda,
          }))
        : [nuevaLineaDistribucion(documento.moneda), nuevaLineaDistribucion(documento.moneda)]
    );
  }

  function actualizarLineaDistribucion(
    id: string,
    cambios: Partial<LineaDistribucionForm>
  ) {
    setLineasDistribucion((lineas) =>
      lineas.map((linea) => (linea.id === id ? { ...linea, ...cambios } : linea))
    );
  }

  async function guardarDistribucionDocumento(documento: DocumentoContableRevision) {
    try {
      validarEmpresaPermitida(documento.empresa_id, "guardar distribucion contable");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    const motivo = window.prompt(
      "Motivo o referencia de la distribucion:",
      "Distribucion contable del documento"
    );
    if (motivo === null) return;

    try {
      setLoading(true);
      await guardarDistribucionDocumentoContable({
        empresa_id: documento.empresa_id,
        documento_contable_id: documento.id,
        motivo,
        lineas: lineasDistribucion.map((linea) => ({
          cuenta_id: linea.cuentaId,
          descripcion: linea.descripcion || null,
          debito: numero(linea.debito),
          credito: numero(linea.credito),
          moneda: linea.moneda,
        })),
      });
      await cargarDocumentosRevision(String(documento.empresa_id));
      abrirDistribucionDocumento(documento);
      alert("Distribucion guardada y validada.");
    } catch (error) {
      console.error("Error guardando distribucion:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function obtenerOCrearPeriodo() {
    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(periodoForm.empresaId, "crear periodos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    try {
      setLoading(true);
      const periodo = await obtenerOCrearPeriodoContable({
        empresa_id: empresaId,
        fecha: periodoForm.fecha,
      });
      await cargarPeriodos(String(empresaId));
      alert(`Periodo ${periodo.mes}/${periodo.anio} listo.`);
    } catch (error) {
      console.error("Error creando periodo contable:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function actualizarLineaAsiento(
    id: string,
    cambios: Partial<LineaAsientoForm>
  ) {
    setLineasAsiento((lineas) =>
      lineas.map((linea) => (linea.id === id ? { ...linea, ...cambios } : linea))
    );
  }

  function erroresAsientoManual() {
    const errores: string[] = [];
    const monedaBase = asientoForm.monedaBase;

    if (!asientoForm.empresaId) errores.push("Debe seleccionar empresa.");
    if (!asientoForm.fecha) errores.push("Debe indicar fecha.");
    if (!asientoForm.descripcion.trim()) errores.push("Debe indicar descripcion.");

    if (lineasAsiento.length < 2) {
      errores.push("El asiento debe tener al menos dos lineas.");
    }

    lineasAsiento.forEach((linea, index) => {
      const debe = numero(linea.debe);
      const haber = numero(linea.haber);

      if (!linea.cuentaId) {
        errores.push(`Linea ${index + 1}: debe seleccionar cuenta.`);
      }

      const cuenta = catalogoCuentas.find(
        (item) => String(item.id) === String(linea.cuentaId)
      );

      if (cuenta) {
        const cuentaEmpresaId =
          cuenta.empresa_id === null || cuenta.empresa_id === undefined
            ? null
            : Number(cuenta.empresa_id);

        if (
          cuentaEmpresaId !== null &&
          cuentaEmpresaId !== Number(asientoForm.empresaId)
        ) {
          errores.push(
            `Linea ${index + 1}: la cuenta no pertenece a la empresa seleccionada.`
          );
        }

        if (!cuenta.activo || !cuenta.permite_movimientos) {
          errores.push(`Linea ${index + 1}: la cuenta no permite movimientos.`);
        }
      }

      if (linea.moneda !== monedaBase) {
        errores.push(
          `Linea ${index + 1}: la moneda debe coincidir con la moneda base ${monedaBase}.`
        );
      }

      if (debe > 0 && haber > 0) {
        errores.push(`Linea ${index + 1}: no puede tener debe y haber.`);
      }

      if (debe <= 0 && haber <= 0) {
        errores.push(`Linea ${index + 1}: debe tener monto en debe o haber.`);
      }
    });

    if (Math.abs(totalDebeAsiento - totalHaberAsiento) > 0.005) {
      errores.push(
        `Asiento descuadrado. Debe ${totalDebeAsiento.toFixed(2)} y haber ${totalHaberAsiento.toFixed(2)}.`
      );
    }

    return errores;
  }

  async function crearAsientoManual() {
    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(asientoForm.empresaId, "crear asientos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    const errores = erroresAsientoManual();
    if (errores.length) {
      alert(errores.join("\n"));
      return;
    }

    const detalles: MovimientoDetalleInput[] = lineasAsiento.map((linea) => ({
      cuenta_id: linea.cuentaId,
      descripcion: linea.descripcion || null,
      debe: numero(linea.debe),
      haber: numero(linea.haber),
      moneda: linea.moneda,
      tipo_cambio: linea.tipoCambio ? numero(linea.tipoCambio) : null,
    }));

    try {
      setLoading(true);
      await crearAsientoContable({
        empresa_id: empresaId,
        fecha: asientoForm.fecha,
        descripcion: asientoForm.descripcion,
        moneda_base: asientoForm.monedaBase,
        origen_modulo: "contabilidad",
        entidad_tipo: "asiento_manual",
        detalles,
      });

      setAsientoForm((actual) => ({
        ...actual,
        descripcion: "",
      }));
      setLineasAsiento([nuevaLineaAsiento(), nuevaLineaAsiento()]);
      await Promise.all([cargarAsientos(String(empresaId)), cargarPeriodos(String(empresaId))]);
      alert("Asiento contable creado.");
    } catch (error) {
      console.error("Error creando asiento contable:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function anularAsiento(asiento: AsientoContable) {
    try {
      validarEmpresaPermitida(asiento.empresa_id, "anular asientos");
    } catch (error) {
      alert(getErrorMessage(error));
      return;
    }

    const motivo = window.prompt("Indica el motivo de anulacion del asiento:");

    if (!motivo || motivo.trim().length < 5) {
      alert("Debes escribir un motivo valido para anular.");
      return;
    }

    const confirmar = window.confirm(
      "Seguro que deseas anular este asiento? No se borrara fisicamente."
    );

    if (!confirmar) return;

    try {
      setLoading(true);
      await anularAsientoContable(asiento.id, motivo.trim());
      await cargarAsientos(String(asiento.empresa_id));
      alert("Asiento anulado.");
    } catch (error) {
      console.error("Error anulando asiento:", error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function calcularBalance(empresaIdValor = balanceFiltros.empresaId) {
    let empresaId: number;

    try {
      empresaId = validarEmpresaPermitida(empresaIdValor, "calcular balance");
    } catch (error) {
      setMensajeV2(getErrorMessage(error));
      return;
    }

    try {
      setCargandoV2(true);
      setMensajeV2("");
      const resultado = await calcularBalanceComprobacion({
        empresa_id: empresaId,
        fecha_desde: balanceFiltros.fechaDesde || undefined,
        fecha_hasta: balanceFiltros.fechaHasta || undefined,
        moneda: balanceFiltros.moneda || undefined,
      });
      setBalanceComprobacion(resultado);
    } catch (error) {
      console.error("Error calculando balance de comprobacion:", error);
      setMensajeV2(getErrorMessage(error));
    } finally {
      setCargandoV2(false);
    }
  }

  const money = (val: number, moneda: string | null = "GTQ") =>
    new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-GT", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "GTQ",
    }).format(Number(val || 0));

  const movimientosPermitidos = movimientos.filter(
    (m) =>
      m.empresa_id !== null &&
      empresasPermitidasIds.includes(Number(m.empresa_id)) &&
      (m.estado || "activo") !== "anulado"
  );

  const movimientosFiltrados =
    empresaFiltro === "Todas"
      ? movimientosPermitidos
      : movimientosPermitidos.filter(
          (m) => Number(m.empresa_id) === Number(empresaFiltro)
        );

  const ingresosGTQ = movimientosFiltrados
    .filter((m) => m.tipo === "Ingreso" && (m.moneda || "GTQ") === "GTQ")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const egresosGTQ = movimientosFiltrados
    .filter((m) => m.tipo === "Egreso" && (m.moneda || "GTQ") === "GTQ")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const balanceGTQ = ingresosGTQ - egresosGTQ;

  const ingresosUSD = movimientosFiltrados
    .filter((m) => m.tipo === "Ingreso" && m.moneda === "USD")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const egresosUSD = movimientosFiltrados
    .filter((m) => m.tipo === "Egreso" && m.moneda === "USD")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const balanceUSD = ingresosUSD - egresosUSD;

  const totalDebeAsiento = redondear(
    lineasAsiento.reduce((acc, linea) => acc + numero(linea.debe), 0)
  );
  const totalHaberAsiento = redondear(
    lineasAsiento.reduce((acc, linea) => acc + numero(linea.haber), 0)
  );

  const puedeAnularMovimiento = ["admin", "supervisor", "jefe"].includes(
    rolActual
  );

  const puedeGestionarGlobales = ["admin", "jefe"].includes(rolActual);
  const puedeRevisarDocumentos = ["admin", "supervisor", "jefe", "contador"].includes(
    rolActual
  );

  const nombreEmpresaFiltro =
    empresaFiltro === "Todas"
      ? "Todas las empresas"
      : listaEmpresas.find((emp) => String(emp.id) === empresaFiltro)?.nombre ||
        "empresa seleccionada";

  const cuentasParaMovimiento = catalogoCuentas.filter(
    (cuenta) => cuenta.activo && cuenta.permite_movimientos
  );

  function renderSelectorEmpresaV2() {
    if (tabActiva === "movimientos") return null;

    return (
      <div className="mb-6 bg-white/5 border border-white/10 rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-black">
            Alcance contable V2
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Catalogo, documentos en revision, periodos, asientos y balance trabajan por empresa.
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={empresaContableId}
            onChange={(e) => cambiarEmpresaContable(e.target.value)}
            className="h-12 px-4 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 text-white min-w-[240px]"
          >
            <option value="" style={{ backgroundColor: "#0B1120", color: "white" }}>
              Seleccionar empresa...
            </option>
            {listaEmpresas.map((empresa) => (
              <option
                key={empresa.id}
                value={String(empresa.id)}
                style={{ backgroundColor: "#0B1120", color: "white" }}
              >
                {empresa.nombre}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => cargarDatosTab(tabActiva)}
            className="h-12 px-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 font-bold hover:bg-cyan-500/20 transition"
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>
    );
  }

  function renderMovimientosOperativos() {
    return (
      <>
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-5 mb-8">
          <h2 className="text-cyan-300 font-black text-sm uppercase">
            Capa operativa
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Estos movimientos siguen alimentando Reportes Operativos V1. No se
            mezclan con asientos contables V2 ni con balance de comprobacion.
          </p>
        </div>

        {rolActual === "empleado" && (
          <div className="mb-8 bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
            <h2 className="text-green-400 font-black text-sm uppercase">
              Vista operativa contable
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Puedes registrar ingresos o egresos de las empresas asignadas y dar
              seguimiento a los movimientos. No puedes anular ni eliminar registros.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
          <ResumenCard
            icon={<TrendingUp size={20} />}
            label="Ingresos GTQ"
            value={money(ingresosGTQ, "GTQ")}
            color="green"
          />
          <ResumenCard
            icon={<TrendingDown size={20} />}
            label="Egresos GTQ"
            value={money(egresosGTQ, "GTQ")}
            color="red"
          />
          <ResumenCard
            icon={<Wallet size={20} />}
            label="Balance GTQ"
            value={money(balanceGTQ, "GTQ")}
            color={balanceGTQ >= 0 ? "cyan" : "orange"}
          />
          <ResumenCard
            icon={<TrendingUp size={20} />}
            label="Ingresos USD"
            value={money(ingresosUSD, "USD")}
            color="green"
          />
          <ResumenCard
            icon={<TrendingDown size={20} />}
            label="Egresos USD"
            value={money(egresosUSD, "USD")}
            color="red"
          />
          <ResumenCard
            icon={<Wallet size={20} />}
            label="Balance USD"
            value={money(balanceUSD, "USD")}
            color={balanceUSD >= 0 ? "cyan" : "orange"}
          />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="text-cyan-500" /> Nuevo movimiento operativo
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            <Campo label="Tipo">
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="input-control"
              >
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
              </select>
            </Campo>

            <Campo label="Descripcion del concepto" className="md:col-span-2">
              <input
                type="text"
                placeholder="Ej: Pago de honorarios"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="input-control"
              />
            </Campo>

            <Campo label={`Monto (${form.moneda})`}>
              <input
                type="number"
                placeholder="0.00"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className="input-control font-mono"
              />
            </Campo>

            <Campo label="Moneda">
              <select
                value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                className="input-control"
              >
                <option value="GTQ">Quetzales GTQ</option>
                <option value="USD">Dolares USD</option>
              </select>
            </Campo>

            <Campo label="Empresa relacionada">
              <select
                value={form.empresaId}
                onChange={(e) => {
                  const empresaSeleccionada = listaEmpresas.find(
                    (emp) => String(emp.id) === e.target.value
                  );

                  setForm({
                    ...form,
                    empresaId: e.target.value,
                    empresa: empresaSeleccionada?.nombre || "",
                  });
                }}
                className="input-control"
              >
                <option value="">Seleccionar empresa...</option>
                {listaEmpresas.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Fecha del movimiento">
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="input-control"
              />
            </Campo>
          </div>

          <button
            onClick={crearMovimiento}
            disabled={loading}
            className="mt-8 w-full md:w-auto bg-white text-black font-black px-10 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all active:scale-95 disabled:opacity-60"
          >
            {loading ? "Registrando..." : "Registrar movimiento"}
          </button>
        </div>

        <div className="grid gap-4">
          {movimientosFiltrados.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
              <p className="text-gray-500 font-medium">
                {empresaFiltro === "Todas"
                  ? "No hay movimientos registrados todavia."
                  : `No hay movimientos registrados para ${nombreEmpresaFiltro}.`}
              </p>
            </div>
          )}

          {movimientosFiltrados.map((mov) => (
            <div
              key={mov.id}
              className="group bg-[#0B1120] border border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-white/20 transition-all"
            >
              <div className="flex gap-6 items-center">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl ${
                    mov.tipo === "Ingreso"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {mov.tipo === "Ingreso" ? "+" : "-"}
                </div>

                <div>
                  <h3 className="text-xl font-bold tracking-tight">
                    {mov.descripcion}
                  </h3>

                  <div className="flex flex-wrap gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                      <Building2 size={14} className="text-cyan-500" /> {mov.empresa}
                    </span>

                    <span className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                      <Calendar size={14} className="text-purple-500" /> {mov.fecha}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 md:mt-0 flex items-center gap-6 w-full md:w-auto justify-between">
                <span
                  className={`text-2xl font-black ${
                    mov.tipo === "Ingreso" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {money(mov.monto, mov.moneda)}
                </span>

                {puedeAnularMovimiento && (
                  <button
                    onClick={() => anularMovimiento(mov.id)}
                    className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Anular movimiento"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderCatalogo() {
    return (
      <div className="grid gap-8">
        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <BookOpen className="text-cyan-400" /> Nueva cuenta contable
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            <Campo label="Alcance">
              <select
                value={cuentaForm.empresaId}
                onChange={(e) =>
                  setCuentaForm({ ...cuentaForm, empresaId: e.target.value })
                }
                className="input-control"
              >
                {puedeGestionarGlobales && <option value="global">Global</option>}
                {listaEmpresas.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Codigo">
              <input
                value={cuentaForm.codigo}
                onChange={(e) =>
                  setCuentaForm({ ...cuentaForm, codigo: e.target.value })
                }
                className="input-control"
                placeholder="Ej: 1.01.01"
              />
            </Campo>

            <Campo label="Nombre">
              <input
                value={cuentaForm.nombre}
                onChange={(e) =>
                  setCuentaForm({ ...cuentaForm, nombre: e.target.value })
                }
                className="input-control"
                placeholder="Caja general"
              />
            </Campo>

            <Campo label="Tipo">
              <select
                value={cuentaForm.tipo}
                onChange={(e) =>
                  setCuentaForm({ ...cuentaForm, tipo: e.target.value })
                }
                className="input-control"
              >
                {TIPOS_CUENTA.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Subtipo">
              <input
                value={cuentaForm.subtipo}
                onChange={(e) =>
                  setCuentaForm({ ...cuentaForm, subtipo: e.target.value })
                }
                className="input-control"
                placeholder="Opcional"
              />
            </Campo>

            <Campo label="Naturaleza">
              <select
                value={cuentaForm.naturaleza}
                onChange={(e) =>
                  setCuentaForm({
                    ...cuentaForm,
                    naturaleza: e.target.value as NaturalezaCuenta,
                  })
                }
                className="input-control"
              >
                <option value="deudora">Deudora</option>
                <option value="acreedora">Acreedora</option>
              </select>
            </Campo>

            <Campo label="Descripcion" className="md:col-span-2">
              <input
                value={cuentaForm.descripcion}
                onChange={(e) =>
                  setCuentaForm({ ...cuentaForm, descripcion: e.target.value })
                }
                className="input-control"
                placeholder="Uso de la cuenta"
              />
            </Campo>

            <label className="flex items-center gap-3 text-sm text-gray-300 mt-8">
              <input
                type="checkbox"
                checked={cuentaForm.permiteMovimientos}
                onChange={(e) =>
                  setCuentaForm({
                    ...cuentaForm,
                    permiteMovimientos: e.target.checked,
                  })
                }
              />
              Permite movimientos
            </label>
          </div>

          <button
            onClick={crearCuenta}
            disabled={loading}
            className="mt-8 bg-white text-black font-black px-8 py-4 rounded-2xl hover:bg-cyan-400 transition disabled:opacity-60"
          >
            Crear cuenta
          </button>
        </section>

        <section className="bg-[#0B1120] border border-white/10 rounded-[2.5rem] p-6">
          <h2 className="text-xl font-black mb-5">Catalogo visible</h2>
          <TablaVacia visible={catalogoCuentas.length === 0} texto="No hay cuentas cargadas." />
          <div className="grid gap-3">
            {catalogoCuentas.map((cuenta) => (
              <div
                key={cuenta.id}
                className="border border-white/10 rounded-2xl p-4 grid md:grid-cols-6 gap-3 items-center"
              >
                <div>
                  <p className="font-black text-cyan-200">{cuenta.codigo}</p>
                  <p className="text-sm text-gray-300">{cuenta.nombre}</p>
                </div>
                <p className="text-sm text-gray-400">{cuenta.tipo}</p>
                <p className="text-sm text-gray-400">{cuenta.naturaleza}</p>
                <p className="text-sm text-gray-400">{empresaNombre(cuenta.empresa_id)}</p>
                <p className="text-sm text-gray-400">
                  {cuenta.permite_movimientos ? "Permite movimientos" : "No mueve"}
                </p>
                <EstadoPill estado={cuenta.activo ? "activo" : "inactivo"} />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderDocumentosRevision() {
    const documentosConAlerta = documentosRevision.filter(
      documentoContableRequiereAlerta24h
    );

    return (
      <div className="grid gap-8">
        <section className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
          <h2 className="text-orange-300 font-black text-sm uppercase flex items-center gap-2">
            <AlertTriangle size={18} />
            Revision previa obligatoria
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Esta cola no crea asientos automaticos. El documento solo puede
            marcarse como Contabilizado si tiene adjuntos activos y luego queda
            preparado para distribucion contable balanceada.
          </p>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <FileText className="text-cyan-400" /> Registrar documento o factura
          </h2>

          <div className="grid md:grid-cols-4 gap-5">
            <Campo label="Empresa">
              <select
                value={documentoForm.empresaId}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, empresaId: e.target.value })
                }
                className="input-control"
              >
                <option value="">Seleccionar empresa...</option>
                {listaEmpresas.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Proveedor ID opcional">
              <input
                value={documentoForm.proveedorId}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, proveedorId: e.target.value })
                }
                className="input-control"
                placeholder="Opcional"
              />
            </Campo>

            <Campo label="Cliente ID opcional">
              <input
                value={documentoForm.clienteId}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, clienteId: e.target.value })
                }
                className="input-control"
                placeholder="Opcional"
              />
            </Campo>

            <Campo label="Tipo documento">
              <select
                value={documentoForm.tipoDocumento}
                onChange={(e) =>
                  setDocumentoForm({
                    ...documentoForm,
                    tipoDocumento: e.target.value,
                  })
                }
                className="input-control"
              >
                <option value="Factura proveedor">Factura proveedor</option>
                <option value="Factura cliente">Factura cliente</option>
                <option value="Nota credito">Nota credito</option>
                <option value="Nota debito">Nota debito</option>
                <option value="Recibo">Recibo</option>
                <option value="Otro">Otro</option>
              </select>
            </Campo>

            <Campo label="Serie">
              <input
                value={documentoForm.serie}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, serie: e.target.value })
                }
                className="input-control"
                placeholder="Opcional"
              />
            </Campo>

            <Campo label="Numero documento">
              <input
                value={documentoForm.numeroDocumento}
                onChange={(e) =>
                  setDocumentoForm({
                    ...documentoForm,
                    numeroDocumento: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Fecha documento">
              <input
                type="date"
                value={documentoForm.fechaDocumento}
                onChange={(e) =>
                  setDocumentoForm({
                    ...documentoForm,
                    fechaDocumento: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Fecha vencimiento">
              <input
                type="date"
                value={documentoForm.fechaVencimiento}
                onChange={(e) =>
                  setDocumentoForm({
                    ...documentoForm,
                    fechaVencimiento: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Moneda">
              <select
                value={documentoForm.moneda}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, moneda: e.target.value })
                }
                className="input-control"
              >
                <option value="GTQ">GTQ</option>
                <option value="USD">USD</option>
              </select>
            </Campo>

            <Campo label="Subtotal">
              <input
                type="number"
                value={documentoForm.subtotal}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, subtotal: e.target.value })
                }
                className="input-control font-mono"
              />
            </Campo>

            <Campo label="IVA">
              <input
                type="number"
                value={documentoForm.iva}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, iva: e.target.value })
                }
                className="input-control font-mono"
              />
            </Campo>

            <Campo label="ISR">
              <input
                type="number"
                value={documentoForm.isr}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, isr: e.target.value })
                }
                className="input-control font-mono"
              />
            </Campo>

            <Campo label="Total">
              <input
                type="number"
                value={documentoForm.total}
                onChange={(e) =>
                  setDocumentoForm({ ...documentoForm, total: e.target.value })
                }
                className="input-control font-mono"
              />
            </Campo>

            <Campo label="Descripcion" className="md:col-span-4">
              <input
                value={documentoForm.descripcion}
                onChange={(e) =>
                  setDocumentoForm({
                    ...documentoForm,
                    descripcion: e.target.value,
                  })
                }
                className="input-control"
                placeholder="Detalle para revision contable"
              />
            </Campo>
          </div>

          <button
            onClick={registrarDocumentoRevision}
            disabled={loading}
            className="mt-8 bg-white text-black font-black px-8 py-4 rounded-2xl hover:bg-cyan-400 transition disabled:opacity-60"
          >
            Registrar como Pendiente
          </button>
        </section>

        <section className="bg-[#0B1120] border border-white/10 rounded-[2.5rem] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                <ClipboardCheck className="text-cyan-300" />
                Cola de revision
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Alertas 24h: {documentosConAlerta.length}
              </p>
            </div>

            <div className="flex gap-3">
              <select
                value={documentosFiltroEstado}
                onChange={(e) => setDocumentosFiltroEstado(e.target.value)}
                className="h-12 px-4 rounded-2xl bg-[#020617] border border-white/10 outline-none focus:border-cyan-500 text-white"
              >
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En revision">En revision</option>
                <option value="Observado">Observado</option>
                <option value="Contabilizado">Contabilizado</option>
                <option value="Rechazado">Rechazado</option>
                <option value="Vencido">Vencido</option>
              </select>
              <button
                type="button"
                onClick={() => cargarDocumentosRevision()}
                className="h-12 px-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 font-bold"
              >
                <RefreshCcw size={18} />
              </button>
            </div>
          </div>

          <TablaVacia
            visible={documentosRevision.length === 0}
            texto="No hay documentos en revision para esta empresa."
          />

          <div className="grid gap-4">
            {documentosRevision.map((documento) => {
              const alerta24h = documentoContableRequiereAlerta24h(documento);
              const cerrado = ["Contabilizado", "Rechazado"].includes(
                documento.estado
              );
              const distribucion = distribucionesDocumento.filter(
                (linea) => String(linea.documento_contable_id) === String(documento.id)
              );
              const totalDebitoDistribucion = redondear(
                distribucion.reduce((total, linea) => total + numero(linea.debito), 0)
              );
              const totalCreditoDistribucion = redondear(
                distribucion.reduce((total, linea) => total + numero(linea.credito), 0)
              );
              const distribucionBalanceada =
                distribucion.length >= 2 &&
                Math.abs(totalDebitoDistribucion - totalCreditoDistribucion) <= 0.005;
              const editandoDistribucion =
                String(documentoDistribucionId) === String(documento.id);
              const totalDebitoEdicion = redondear(
                lineasDistribucion.reduce((total, linea) => total + numero(linea.debito), 0)
              );
              const totalCreditoEdicion = redondear(
                lineasDistribucion.reduce((total, linea) => total + numero(linea.credito), 0)
              );

              return (
                <div
                  key={documento.id}
                  className={`border rounded-2xl p-5 ${
                    alerta24h
                      ? "border-orange-400/40 bg-orange-400/10"
                      : "border-white/10"
                  }`}
                >
                  <div className="grid lg:grid-cols-[1.4fr_1fr_auto] gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-black">
                          {documento.tipo_documento} {documento.serie || ""}-
                          {documento.numero_documento}
                        </h3>
                        <EstadoPill estado={documento.estado} />
                        {alerta24h && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-black text-orange-200">
                            <AlertTriangle size={13} />
                            +24h sin revision
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-2">
                        {documento.descripcion || "Sin descripcion"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Empresa: {empresaNombre(documento.empresa_id)} | Fecha:{" "}
                        {documento.fecha_documento} | Vence:{" "}
                        {documento.fecha_vencimiento || "N/A"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Creado por: {documento.creado_por || "N/A"} | Revisado:{" "}
                        {documento.revisado_at || "pendiente"} | Contabilizado:{" "}
                        {documento.contabilizado_at || "pendiente"}
                      </p>
                        {documento.observacion && (
                        <p className="text-sm text-orange-200 mt-3">
                          Observacion: {documento.observacion}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                            distribucionBalanceada
                              ? "border-green-400/30 bg-green-400/10 text-green-200"
                              : "border-orange-400/30 bg-orange-400/10 text-orange-200"
                          }`}
                        >
                          Distribucion:{" "}
                          {distribucionBalanceada ? "balanceada" : "pendiente/descuadrada"}
                        </span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">
                          Debito {money(totalDebitoDistribucion, documento.moneda)}
                        </span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">
                          Credito {money(totalCreditoDistribucion, documento.moneda)}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-300">
                      <p>Subtotal: {money(documento.subtotal, documento.moneda)}</p>
                      <p>IVA: {money(documento.iva, documento.moneda)}</p>
                      <p>ISR: {money(documento.isr, documento.moneda)}</p>
                      <p className="text-xl font-black text-cyan-200 mt-2">
                        Total: {money(documento.total, documento.moneda)}
                      </p>
                    </div>

                    {puedeRevisarDocumentos && !cerrado && (
                      <div className="flex flex-col gap-2 min-w-44">
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEstadoDocumentoRevision(documento, "En revision")
                          }
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs font-black"
                        >
                          En revision
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEstadoDocumentoRevision(documento, "Observado")
                          }
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs font-black"
                        >
                          Observar
                        </button>
                        <button
                          type="button"
                          onClick={() => corregirDocumentoRevision(documento)}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs font-black"
                        >
                          Corregir
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirDistribucionDocumento(documento)}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs font-black"
                        >
                          Distribuir
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEstadoDocumentoRevision(documento, "Contabilizado")
                          }
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 text-xs font-black"
                        >
                          Contabilizar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEstadoDocumentoRevision(documento, "Rechazado")
                          }
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-black"
                        >
                          Rechazar
                        </button>
                        {alerta24h && (
                          <button
                            type="button"
                            onClick={() =>
                              cambiarEstadoDocumentoRevision(documento, "Vencido")
                            }
                            disabled={loading}
                            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-black"
                          >
                            Marcar vencido
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {distribucion.length > 0 && !editandoDistribucion && (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="text-xs uppercase font-black text-gray-500 mb-3">
                        Distribucion contable activa
                      </p>
                      <div className="grid gap-2">
                        {distribucion.map((linea) => (
                          <div
                            key={linea.id}
                            className="grid md:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"
                          >
                            <p className="font-black text-cyan-200">
                              {linea.catalogo_cuentas?.codigo || linea.cuenta_id}
                            </p>
                            <p className="md:col-span-2 text-gray-300">
                              {linea.descripcion ||
                                linea.catalogo_cuentas?.nombre ||
                                "Sin descripcion"}
                            </p>
                            <p className="text-green-200">
                              Debito {money(linea.debito, linea.moneda)}
                            </p>
                            <p className="text-red-200">
                              Credito {money(linea.credito, linea.moneda)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editandoDistribucion && !cerrado && (
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                          <p className="text-xs uppercase font-black text-blue-200">
                            Distribucion contable del documento
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Ej. proveedor: gasto/compra e IVA al debe; proveedores locales al haber.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-black">
                          <span className="rounded-xl bg-green-500/10 text-green-200 px-3 py-2">
                            Debito {money(totalDebitoEdicion, documento.moneda)}
                          </span>
                          <span className="rounded-xl bg-red-500/10 text-red-200 px-3 py-2">
                            Credito {money(totalCreditoEdicion, documento.moneda)}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {lineasDistribucion.map((linea, index) => (
                          <div
                            key={linea.id}
                            className="grid md:grid-cols-7 gap-3 rounded-xl border border-white/10 bg-[#020617] p-3"
                          >
                            <Campo label={`Cuenta ${index + 1}`} className="md:col-span-2">
                              <select
                                value={linea.cuentaId}
                                onChange={(e) =>
                                  actualizarLineaDistribucion(linea.id, {
                                    cuentaId: e.target.value,
                                  })
                                }
                                className="input-control"
                              >
                                <option value="">Seleccionar cuenta...</option>
                                {cuentasParaMovimiento.map((cuenta) => (
                                  <option key={cuenta.id} value={String(cuenta.id)}>
                                    {cuenta.codigo} - {cuenta.nombre}
                                  </option>
                                ))}
                              </select>
                            </Campo>
                            <Campo label="Descripcion" className="md:col-span-2">
                              <input
                                value={linea.descripcion}
                                onChange={(e) =>
                                  actualizarLineaDistribucion(linea.id, {
                                    descripcion: e.target.value,
                                  })
                                }
                                className="input-control"
                              />
                            </Campo>
                            <Campo label="Debito">
                              <input
                                type="number"
                                value={linea.debito}
                                onChange={(e) =>
                                  actualizarLineaDistribucion(linea.id, {
                                    debito: e.target.value,
                                  })
                                }
                                className="input-control font-mono"
                              />
                            </Campo>
                            <Campo label="Credito">
                              <input
                                type="number"
                                value={linea.credito}
                                onChange={(e) =>
                                  actualizarLineaDistribucion(linea.id, {
                                    credito: e.target.value,
                                  })
                                }
                                className="input-control font-mono"
                              />
                            </Campo>
                            <Campo label="Moneda">
                              <select
                                value={linea.moneda}
                                onChange={(e) =>
                                  actualizarLineaDistribucion(linea.id, {
                                    moneda: e.target.value,
                                  })
                                }
                                className="input-control"
                              >
                                <option value="GTQ">GTQ</option>
                                <option value="USD">USD</option>
                              </select>
                            </Campo>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() =>
                            setLineasDistribucion((lineas) => [
                              ...lineas,
                              nuevaLineaDistribucion(documento.moneda),
                            ])
                          }
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-black"
                        >
                          Agregar linea
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLineasDistribucion((lineas) =>
                              lineas.length <= 2 ? lineas : lineas.slice(0, -1)
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-black"
                        >
                          Quitar ultima
                        </button>
                        <button
                          type="button"
                          onClick={() => guardarDistribucionDocumento(documento)}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 text-xs font-black"
                        >
                          Guardar distribucion
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocumentoDistribucionId(null)}
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-black"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderPeriodos() {
    return (
      <div className="grid gap-8">
        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="text-cyan-400" /> Obtener o crear periodo
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            <Campo label="Empresa">
              <select
                value={periodoForm.empresaId}
                onChange={(e) =>
                  setPeriodoForm({ ...periodoForm, empresaId: e.target.value })
                }
                className="input-control"
              >
                <option value="">Seleccionar empresa...</option>
                {listaEmpresas.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Fecha dentro del periodo">
              <input
                type="date"
                value={periodoForm.fecha}
                onChange={(e) =>
                  setPeriodoForm({ ...periodoForm, fecha: e.target.value })
                }
                className="input-control"
              />
            </Campo>
          </div>

          <button
            onClick={obtenerOCrearPeriodo}
            disabled={loading}
            className="mt-8 bg-white text-black font-black px-8 py-4 rounded-2xl hover:bg-cyan-400 transition disabled:opacity-60"
          >
            Obtener o crear periodo
          </button>
        </section>

        <section className="bg-[#0B1120] border border-white/10 rounded-[2.5rem] p-6">
          <h2 className="text-xl font-black mb-5">Periodos contables</h2>
          <TablaVacia visible={periodosContables.length === 0} texto="No hay periodos cargados." />
          <div className="grid gap-3">
            {periodosContables.map((periodo) => (
              <div
                key={periodo.id}
                className="border border-white/10 rounded-2xl p-4 grid md:grid-cols-6 gap-3 items-center"
              >
                <p className="font-black text-cyan-200">{empresaNombre(periodo.empresa_id)}</p>
                <p className="text-sm text-gray-300">
                  {periodo.mes}/{periodo.anio}
                </p>
                <p className="text-sm text-gray-400">{periodo.fecha_inicio}</p>
                <p className="text-sm text-gray-400">{periodo.fecha_fin}</p>
                <EstadoPill estado={periodo.estado} />
                <p className="text-xs text-gray-500">Sin cierre/reapertura en V1</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderAsientos() {
    return (
      <div className="grid gap-8">
        <section className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
          <div className="grid md:grid-cols-5 gap-4">
            <Campo label="Desde">
              <input
                type="date"
                value={asientosFiltros.fechaDesde}
                onChange={(e) =>
                  setAsientosFiltros({
                    ...asientosFiltros,
                    fechaDesde: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Hasta">
              <input
                type="date"
                value={asientosFiltros.fechaHasta}
                onChange={(e) =>
                  setAsientosFiltros({
                    ...asientosFiltros,
                    fechaHasta: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Estado">
              <select
                value={asientosFiltros.estado}
                onChange={(e) =>
                  setAsientosFiltros({ ...asientosFiltros, estado: e.target.value })
                }
                className="input-control"
              >
                <option value="">Todos</option>
                <option value="registrado">Registrado</option>
                <option value="anulado">Anulado</option>
                <option value="requiere_revision">Requiere revision</option>
                <option value="borrador">Borrador</option>
              </select>
            </Campo>

            <Campo label="Origen">
              <input
                value={asientosFiltros.origenModulo}
                onChange={(e) =>
                  setAsientosFiltros({
                    ...asientosFiltros,
                    origenModulo: e.target.value,
                  })
                }
                className="input-control"
                placeholder="contabilidad"
              />
            </Campo>

            <button
              onClick={() => cargarAsientos()}
              className="h-14 mt-6 bg-white text-black font-black px-6 rounded-2xl hover:bg-cyan-400 transition"
            >
              Aplicar
            </button>
          </div>
        </section>

        <section className="bg-[#0B1120] border border-white/10 rounded-[2.5rem] p-6">
          <h2 className="text-xl font-black mb-5">Asientos contables</h2>
          <TablaVacia visible={asientosContables.length === 0} texto="No hay asientos cargados." />
          <div className="grid gap-4">
            {asientosContables.map((asiento) => (
              <div key={asiento.id} className="border border-white/10 rounded-2xl p-5">
                <div className="grid md:grid-cols-7 gap-3 items-center">
                  <div className="md:col-span-2">
                    <p className="font-black text-white">{asiento.descripcion}</p>
                    <p className="text-xs text-gray-500">{asiento.fecha}</p>
                  </div>
                  <EstadoPill estado={asiento.estado} />
                  <p className="text-sm text-gray-300">{asiento.moneda_base}</p>
                  <p className="text-sm text-green-300">
                    Debe {money(asiento.total_debe, asiento.moneda_base)}
                  </p>
                  <p className="text-sm text-red-300">
                    Haber {money(asiento.total_haber, asiento.moneda_base)}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() =>
                        setDetalleAbiertoId(
                          detalleAbiertoId === asiento.id ? null : asiento.id
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold"
                    >
                      Detalle
                    </button>
                    {asiento.estado !== "anulado" && (
                      <button
                        onClick={() => anularAsiento(asiento)}
                        className="p-2 text-red-300 hover:bg-red-500/10 rounded-xl"
                        title="Anular asiento"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {detalleAbiertoId === asiento.id && (
                  <div className="mt-5 border-t border-white/10 pt-4 grid gap-2">
                    {(asiento.movimientos_contables_detalle || []).map((detalle) => (
                      <div
                        key={detalle.id}
                        className="grid md:grid-cols-5 gap-2 text-sm bg-white/[0.03] rounded-xl p-3"
                      >
                        <span className="text-cyan-200">
                          {detalle.catalogo_cuentas?.codigo || detalle.cuenta_id} -{" "}
                          {detalle.catalogo_cuentas?.nombre || "Cuenta"}
                        </span>
                        <span className="text-gray-400">{detalle.descripcion || "-"}</span>
                        <span className="text-green-300">
                          Debe {money(detalle.debe, detalle.moneda)}
                        </span>
                        <span className="text-red-300">
                          Haber {money(detalle.haber, detalle.moneda)}
                        </span>
                        <span className="text-gray-500">{detalle.moneda}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderCrearAsiento() {
    const errores = erroresAsientoManual();
    const asientoBalanceado =
      errores.length === 0 && Math.abs(totalDebeAsiento - totalHaberAsiento) <= 0.005;

    return (
      <div className="grid gap-8">
        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <FileText className="text-cyan-400" /> Crear asiento manual
          </h2>

          <div className="grid md:grid-cols-4 gap-5">
            <Campo label="Empresa">
              <select
                value={asientoForm.empresaId}
                onChange={(e) =>
                  setAsientoForm({ ...asientoForm, empresaId: e.target.value })
                }
                className="input-control"
              >
                <option value="">Seleccionar empresa...</option>
                {listaEmpresas.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Fecha">
              <input
                type="date"
                value={asientoForm.fecha}
                onChange={(e) =>
                  setAsientoForm({ ...asientoForm, fecha: e.target.value })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Moneda base">
              <select
                value={asientoForm.monedaBase}
                onChange={(e) => {
                  const monedaBase = e.target.value;
                  setAsientoForm({ ...asientoForm, monedaBase });
                  setLineasAsiento((lineas) =>
                    lineas.map((linea) => ({ ...linea, moneda: monedaBase }))
                  );
                }}
                className="input-control"
              >
                <option value="GTQ">GTQ</option>
                <option value="USD">USD</option>
              </select>
            </Campo>

            <Campo label="Descripcion" className="md:col-span-4">
              <input
                value={asientoForm.descripcion}
                onChange={(e) =>
                  setAsientoForm({ ...asientoForm, descripcion: e.target.value })
                }
                className="input-control"
                placeholder="Descripcion del asiento"
              />
            </Campo>
          </div>

          <div className="mt-8 grid gap-4">
            {lineasAsiento.map((linea, index) => (
              <div
                key={linea.id}
                className="grid md:grid-cols-8 gap-3 bg-[#0B1120] border border-white/10 rounded-2xl p-4"
              >
                <Campo label={`Cuenta ${index + 1}`} className="md:col-span-2">
                  <select
                    value={linea.cuentaId}
                    onChange={(e) =>
                      actualizarLineaAsiento(linea.id, { cuentaId: e.target.value })
                    }
                    className="input-control"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasParaMovimiento.map((cuenta) => (
                      <option key={cuenta.id} value={String(cuenta.id)}>
                        {cuenta.codigo} - {cuenta.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo label="Descripcion">
                  <input
                    value={linea.descripcion}
                    onChange={(e) =>
                      actualizarLineaAsiento(linea.id, {
                        descripcion: e.target.value,
                      })
                    }
                    className="input-control"
                  />
                </Campo>

                <Campo label="Debe">
                  <input
                    type="number"
                    value={linea.debe}
                    onChange={(e) =>
                      actualizarLineaAsiento(linea.id, { debe: e.target.value })
                    }
                    className="input-control font-mono"
                  />
                </Campo>

                <Campo label="Haber">
                  <input
                    type="number"
                    value={linea.haber}
                    onChange={(e) =>
                      actualizarLineaAsiento(linea.id, { haber: e.target.value })
                    }
                    className="input-control font-mono"
                  />
                </Campo>

                <Campo label="Moneda">
                  <select
                    value={linea.moneda}
                    onChange={(e) =>
                      actualizarLineaAsiento(linea.id, { moneda: e.target.value })
                    }
                    className="input-control"
                  >
                    <option value="GTQ">GTQ</option>
                    <option value="USD">USD</option>
                  </select>
                </Campo>

                <Campo label="Tipo cambio">
                  <input
                    type="number"
                    value={linea.tipoCambio}
                    onChange={(e) =>
                      actualizarLineaAsiento(linea.id, {
                        tipoCambio: e.target.value,
                      })
                    }
                    className="input-control font-mono"
                    placeholder="Opcional"
                  />
                </Campo>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      setLineasAsiento((lineas) =>
                        lineas.length <= 2
                          ? lineas
                          : lineas.filter((item) => item.id !== linea.id)
                      )
                    }
                    className="h-14 px-4 rounded-2xl bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => setLineasAsiento((lineas) => [...lineas, nuevaLineaAsiento()])}
              className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold"
            >
              Agregar linea
            </button>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-300">
                Debe: {money(totalDebeAsiento, asientoForm.monedaBase)}
              </span>
              <span className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300">
                Haber: {money(totalHaberAsiento, asientoForm.monedaBase)}
              </span>
              <span
                className={`px-4 py-2 rounded-xl ${
                  asientoBalanceado
                    ? "bg-cyan-500/10 text-cyan-300"
                    : "bg-orange-500/10 text-orange-300"
                }`}
              >
                {asientoBalanceado ? "Balanceado" : "Pendiente de cuadrar"}
              </span>
            </div>
          </div>

          <button
            onClick={crearAsientoManual}
            disabled={loading}
            className="mt-8 bg-white text-black font-black px-8 py-4 rounded-2xl hover:bg-cyan-400 transition disabled:opacity-60"
          >
            Crear asiento contable
          </button>
        </section>
      </div>
    );
  }

  function renderBalance() {
    const totalDebe = balanceComprobacion.reduce((acc, fila) => acc + fila.debe, 0);
    const totalHaber = balanceComprobacion.reduce((acc, fila) => acc + fila.haber, 0);

    return (
      <div className="grid gap-8">
        <section className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
          <div className="grid md:grid-cols-5 gap-4">
            <Campo label="Empresa">
              <select
                value={balanceFiltros.empresaId}
                onChange={(e) =>
                  setBalanceFiltros({
                    ...balanceFiltros,
                    empresaId: e.target.value,
                  })
                }
                className="input-control"
              >
                <option value="">Seleccionar empresa...</option>
                {listaEmpresas.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Desde">
              <input
                type="date"
                value={balanceFiltros.fechaDesde}
                onChange={(e) =>
                  setBalanceFiltros({
                    ...balanceFiltros,
                    fechaDesde: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Hasta">
              <input
                type="date"
                value={balanceFiltros.fechaHasta}
                onChange={(e) =>
                  setBalanceFiltros({
                    ...balanceFiltros,
                    fechaHasta: e.target.value,
                  })
                }
                className="input-control"
              />
            </Campo>

            <Campo label="Moneda">
              <select
                value={balanceFiltros.moneda}
                onChange={(e) =>
                  setBalanceFiltros({ ...balanceFiltros, moneda: e.target.value })
                }
                className="input-control"
              >
                <option value="">Todas</option>
                <option value="GTQ">GTQ</option>
                <option value="USD">USD</option>
              </select>
            </Campo>

            <button
              onClick={() => calcularBalance(balanceFiltros.empresaId)}
              className="h-14 mt-6 bg-white text-black font-black px-6 rounded-2xl hover:bg-cyan-400 transition"
            >
              Calcular
            </button>
          </div>
        </section>

        <section className="bg-[#0B1120] border border-white/10 rounded-[2.5rem] p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-black">Balance de comprobacion</h2>
              <p className="text-gray-500 text-sm">
                Calculado solo con asientos en estado registrado.
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-300">
                Debe {money(totalDebe, balanceFiltros.moneda || "GTQ")}
              </span>
              <span className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300">
                Haber {money(totalHaber, balanceFiltros.moneda || "GTQ")}
              </span>
            </div>
          </div>

          <TablaVacia visible={balanceComprobacion.length === 0} texto="No hay balance calculado." />
          <div className="grid gap-3">
            {balanceComprobacion.map((fila) => (
              <div
                key={fila.cuenta_id}
                className="border border-white/10 rounded-2xl p-4 grid md:grid-cols-6 gap-3 items-center"
              >
                <p className="font-black text-cyan-200">{fila.codigo}</p>
                <p className="text-sm text-gray-300 md:col-span-2">{fila.nombre}</p>
                <p className="text-sm text-gray-400">{fila.tipo}</p>
                <p className="text-sm text-green-300">
                  {money(fila.debe, balanceFiltros.moneda || "GTQ")}
                </p>
                <p className="text-sm text-red-300">
                  {money(fila.haber, balanceFiltros.moneda || "GTQ")} / Saldo{" "}
                  {money(fila.saldo, balanceFiltros.moneda || "GTQ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderContenidoTab() {
    if (cargandoV2) {
      return (
        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-center text-cyan-400">
          Cargando datos contables V2...
        </section>
      );
    }

    if (tabActiva === "movimientos") return renderMovimientosOperativos();
    if (tabActiva === "catalogo") return renderCatalogo();
    if (tabActiva === "documentos_revision") return renderDocumentosRevision();
    if (tabActiva === "periodos") return renderPeriodos();
    if (tabActiva === "asientos") return renderAsientos();
    if (tabActiva === "crear_asiento") return renderCrearAsiento();
    return renderBalance();
  }

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
        <style>{`
          .input-control {
            height: 3.5rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: #0B1120;
            color: white;
            outline: none;
            padding: 0 1.25rem;
            transition: border-color 150ms ease, background-color 150ms ease;
            width: 100%;
          }

          .input-control:focus {
            border-color: rgb(6, 182, 212);
          }

          .input-control option {
            background: #0B1120;
            color: white;
          }
        `}</style>
        <div className="max-w-7xl mx-auto">
          <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight">Contabilidad</h1>

              <p className="text-gray-400 mt-2">
                {tabActiva === "movimientos"
                  ? empresaFiltro === "Todas"
                    ? "Movimientos operativos de todas las empresas"
                    : `Movimientos operativos de ${nombreEmpresaFiltro}`
                  : "Contabilidad formal V2 dentro del mismo modulo"}
              </p>
            </div>

            {tabActiva === "movimientos" &&
              (cargandoContabilidad ? (
                <div className="text-sm text-cyan-400">Cargando empresas...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
                    Ver empresa
                  </label>

                  <select
                    value={empresaFiltro}
                    onChange={(e) => setEmpresaFiltro(e.target.value)}
                    className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all cursor-pointer text-white min-w-[260px]"
                  >
                    <option value="Todas">Todas las empresas</option>
                    {listaEmpresas.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </header>

          {cargandoContabilidad ? (
            <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-center text-cyan-400">
              Cargando datos de contabilidad...
            </section>
          ) : (
            <>
              {listaEmpresas.length === 0 && (
                <div className="mb-8 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
                  <h2 className="text-orange-300 font-black text-sm uppercase">
                    Sin empresas permitidas
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    No hay empresas disponibles para operar este modulo.
                  </p>
                </div>
              )}

              <nav className="grid md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => cambiarTab(tab.id)}
                    className={`text-left rounded-2xl border p-4 transition ${
                      tabActiva === tab.id
                        ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-100"
                        : "bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <p className="font-black text-sm">{tab.nombre}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{tab.descripcion}</p>
                  </button>
                ))}
              </nav>

              {renderSelectorEmpresaV2()}

              {mensajeV2 && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-200 text-sm">
                  {mensajeV2}
                </div>
              )}

              {renderContenidoTab()}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Campo({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-[10px] font-black text-gray-500 uppercase ml-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function EstadoPill({ estado }: { estado: string | null | undefined }) {
  const normalizado = textoEstado(estado).toLowerCase();
  const color =
    normalizado === "activo" ||
    normalizado === "registrado" ||
    normalizado === "abierto"
      ? "bg-green-500/10 text-green-300 border-green-500/20"
      : normalizado === "anulado" ||
          normalizado === "cerrado" ||
          normalizado === "bloqueado"
        ? "bg-red-500/10 text-red-300 border-red-500/20"
        : "bg-orange-500/10 text-orange-300 border-orange-500/20";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${color}`}
    >
      {textoEstado(estado)}
    </span>
  );
}

function TablaVacia({ visible, texto }: { visible: boolean; texto: string }) {
  if (!visible) return null;

  return (
    <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-[2rem]">
      <p className="text-gray-500 font-medium">{texto}</p>
    </div>
  );
}

function ResumenCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "green" | "red" | "cyan" | "orange";
}) {
  const styles = {
    green: "bg-green-500/10 border-green-500/20 text-green-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  }[color];

  return (
    <div className={`border rounded-[2.5rem] p-6 shadow-xl ${styles}`}>
      <div className="flex items-center gap-3 opacity-80">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>

      <p className="text-2xl font-black mt-4">{value}</p>
    </div>
  );
}
