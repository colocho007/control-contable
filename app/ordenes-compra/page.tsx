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
  marcarBorradorCompletado,
  obtenerBorradorActivo,
  type BorradorTrabajo,
} from "../../lib/borradoresTrabajo";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
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

interface FirmaOC {
  id: number;
  orden_id: number;
  firmante_id: string;
  firmante_nombre: string | null;
  orden_firma: number;
  tipo_firma: string | null;
  estado: string;
  firmado_at: string | null;
  rechazado_at: string | null;
  comentario: string | null;
  created_at: string | null;
}

interface OrdenCompra {
  id: number;
  borrador_id: string | null;
  empresa_id: number | null;
  empresa: string;

  proveedor: string;
  proveedor_telefono: string | null;
  proveedor_contacto: string | null;

  numero_orden: string | null;
  anio_orden: number | null;
  fecha_oc: string | null;
  codigo_solicitante: string | null;
  encargado: string | null;
  forma_pago: string | null;

  concepto: string;
  descripcion: string | null;

  fecha_factura: string | null;
  numero_factura: string | null;
  precio_unitario: number | null;
  subtotal: number | null;
  isr: number | null;
  total_final: number | null;

  monto: number;
  moneda: string | null;
  prioridad: string;
  fecha_orden: string | null;
  fecha_necesaria: string | null;
  estado: string;
  creado_por: string;
  firmas_requeridas: number;
  firmas_completadas: number;
  archivo_url: string | null;
  aprobada_at: string | null;
  rechazada_at: string | null;
  anulada_at: string | null;
  created_at: string | null;
  ordenes_compra_firmas?: FirmaOC[];
}

const ROLES_ADMIN = ["admin", "supervisor", "jefe"];
const ROLES_CREADORES = ["admin", "supervisor", "jefe", "iniciador_gestion"];
const ROLES_FIRMANTES = ["firmante_oc"];
const TIPOS_DOCUMENTO_ORDENES = [
  "Factura",
  "Cotización",
  "Orden firmada",
  "Comprobante",
  "Documento proveedor",
  "Otro",
];
const REFERENCIA_BORRADOR_ORDEN = "nueva-orden";
const TITULO_BORRADOR_ORDEN = "Borrador de orden de compra";
const IDEMPOTENCY_PREFIX_ORDENES = "controlplus_idempotency_ordenes";
const COLUMNAS_BORRADOR_ORDEN =
  "id,usuario_id,empresa_id,modulo,ruta,titulo,referencia_temporal,datos,estado,creado_at,actualizado_at,expira_at";

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function crearFormularioOrdenVacio() {
  return {
    empresaId: "",
    empresa: "",
    proveedor: "",
    proveedorTelefono: "",
    proveedorContacto: "",
    numeroOrden: "",
    anioOrden: String(new Date().getFullYear()),
    fechaOc: new Date().toISOString().split("T")[0],
    codigoSolicitante: "",
    encargado: "",
    formaPago: "",
    concepto: "",
    descripcion: "",
    fechaFactura: "",
    numeroFactura: "",
    precioUnitario: "",
    subtotal: "",
    isr: "",
    totalFinal: "",
    monto: "",
    moneda: "GTQ",
    prioridad: "Media",
    fechaNecesaria: "",
  };
}

type FormularioOrden = ReturnType<typeof crearFormularioOrdenVacio>;

function formularioTieneContenido(
  formulario: FormularioOrden,
  firmantes: string[]
) {
  const vacio = crearFormularioOrdenVacio();

  return (
    firmantes.length > 0 ||
    (Object.keys(vacio) as Array<keyof FormularioOrden>).some(
      (campo) => formulario[campo] !== vacio[campo]
    )
  );
}

export default function OrdenesCompraPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("Todas");

  const [firmantesSeleccionados, setFirmantesSeleccionados] = useState<string[]>([]);
  const [form, setForm] = useState<FormularioOrden>(crearFormularioOrdenVacio);
  const [borradorActivo, setBorradorActivo] =
    useState<BorradorTrabajo | null>(null);
  const [borradorRevisado, setBorradorRevisado] = useState(false);
  const [procesandoBorrador, setProcesandoBorrador] = useState(false);
  const [mensajeBorradorBloqueado, setMensajeBorradorBloqueado] =
    useState<string | null>(null);
  const formActualRef = useRef(form);
  const firmantesActualesRef = useRef(firmantesSeleccionados);
  const ordenCreadaIdRef = useRef<number | null>(null);
  const borradorOrigenIdRef = useRef<string | number | null>(null);
  const borradorConsumidoRef = useRef(false);
  const autoguardadoSuspendidoRef = useRef(false);
  const timeoutBorradorRef = useRef<number | null>(null);
  const guardadoEnCursoRef = useRef<Promise<void> | null>(null);
  const guardadoPendienteRef = useRef(false);

  useEffect(() => {
    iniciar();
  }, []);

  useEffect(() => {
    formActualRef.current = form;
  }, [form]);

  useEffect(() => {
    firmantesActualesRef.current = firmantesSeleccionados;
  }, [firmantesSeleccionados]);

 async function iniciar() {
  try {
    setValidandoAcceso(true);
    setCargandoOrdenes(false);

    const acceso = await validarAccesoModuloUsuario("ordenes");

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
        toast.error("El módulo de Órdenes de compra está desactivado.");
      } else {
        toast.error("No tienes acceso al módulo de Órdenes de compra.");
      }

      window.location.href = "/dashboard";
      return;
    }

    const user = acceso.user!;
    const perfil = acceso.perfil!;

    setUserId(user.id);
    setPerfilActual(perfil);
    setCargandoOrdenes(true);
    setAutorizado(true);
    setValidandoAcceso(false);

    const idsPermitidos = await obtenerEmpresasPermitidas(
      user.id,
      perfil.rol || ""
    );

    setEmpresasPermitidasIds(idsPermitidos);

    const cargasIniciales: Promise<void>[] = [
      obtenerEmpresas(idsPermitidos),
      obtenerFuncionesOperativas(idsPermitidos),
      obtenerUsuarios(perfil.rol || ""),
      obtenerOrdenes(idsPermitidos, user.id, perfil.rol || ""),
    ];

    if (ROLES_CREADORES.includes(normalizarRol(perfil.rol))) {
      cargasIniciales.push(recuperarBorradorOrden());
    } else {
      setBorradorRevisado(true);
    }

    await Promise.all(cargasIniciales);
  } catch (error) {
    console.error(error);
    toast.error("Error cargando órdenes de compra");
  } finally {
    setCargandoOrdenes(false);
  }
}

async function obtenerOrdenCreadaDesdeBorrador(borradorId: string | number) {
  const { data, error } = await supabase
    .from("ordenes_compra")
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
      detalle.includes("idx_ordenes_compra_borrador_unico"))
  );
}

async function recuperarBorradorOrden() {
  try {
    const borrador = await obtenerBorradorActivo({
      modulo: "ordenes",
      referencia_temporal: REFERENCIA_BORRADOR_ORDEN,
    });

    if (borrador) {
      const ordenCreada = await obtenerOrdenCreadaDesdeBorrador(borrador.id);

      if (ordenCreada) {
        let borradorCerrado = false;

        try {
          await marcarBorradorCompletado(borrador.id);
          borradorCerrado = true;
        } catch (error) {
          console.error("Error completando borrador ya utilizado:", error);

          try {
            await marcarBorradorRequiereRevision(
              Number(ordenCreada.id),
              "El borrador ya genero una orden registrada.",
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
            "Este borrador ya genero una orden y no puede reutilizarse."
          );
        }

        toast.error(
          "Este borrador ya genero una orden y no puede reutilizarse."
        );
        return;
      }
    }

    setBorradorActivo(borrador);
    setBorradorRevisado(!borrador);
  } catch (error: any) {
    console.error("Error recuperando borrador de orden:", error);
    toast.error("No se pudo recuperar el borrador pendiente.");
    setBorradorRevisado(true);
  }
}

function continuarConBorrador() {
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
  const formularioRecuperado = crearFormularioOrdenVacio();

  (Object.keys(formularioRecuperado) as Array<keyof FormularioOrden>).forEach(
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
      "El borrador tiene una empresa invalida. Descartalo para iniciar una nueva orden."
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

  const firmantesPermitidos = new Set(
    usuarios
      .filter(
        (usuario) =>
          usuario.activo !== false &&
          formularioRecuperado.empresaId &&
          tieneFuncionOrden(usuario.id, formularioRecuperado.empresaId, [
            "firmante_orden",
            "autorizador_compra",
          ])
      )
      .map((usuario) => usuario.id)
  );
  const firmantes = Array.isArray(datos.firmantesSeleccionados)
    ? datos.firmantesSeleccionados.filter(
        (firmante): firmante is string =>
          typeof firmante === "string" && firmantesPermitidos.has(firmante)
      )
    : [];

  borradorOrigenIdRef.current = borradorActivo.id;
  setForm(formularioRecuperado);
  setFirmantesSeleccionados(firmantes);
  setBorradorRevisado(true);
  toast.success("Borrador de orden cargado.");
}

async function descartarBorradorPendiente() {
  if (!borradorActivo) return;

  setProcesandoBorrador(true);

  try {
    await descartarBorrador(borradorActivo.id);
    borradorOrigenIdRef.current = null;
    setBorradorActivo(null);
    setBorradorRevisado(true);
    toast.success("Borrador descartado.");
  } catch (error: any) {
    console.error("Error descartando borrador de orden:", error);
    toast.error("No se pudo descartar el borrador.");
  } finally {
    setProcesandoBorrador(false);
  }
}

async function guardarBorradorActual(
  formulario = formActualRef.current,
  firmantes = firmantesActualesRef.current
) {
  if (
    ordenCreadaIdRef.current !== null ||
    borradorConsumidoRef.current ||
    autoguardadoSuspendidoRef.current ||
    !autorizado ||
    !ROLES_CREADORES.includes(normalizarRol(perfilActual?.rol)) ||
    !borradorRevisado ||
    !formularioTieneContenido(formulario, firmantes)
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
        formulario.empresaId && Number.isFinite(empresaId)
          ? empresaId
          : null;
      const datosBorrador = {
        ...formulario,
        firmantesSeleccionados: firmantes,
      };
      const borradorOrigenId = borradorOrigenIdRef.current;

      if (borradorOrigenId !== null) {
        const ordenExistente = await obtenerOrdenCreadaDesdeBorrador(
          borradorOrigenId
        );

        if (ordenExistente) {
          bloquearBorradorConsumido(
            "Esta orden ya fue creada desde este borrador."
          );
          toast.error("Esta orden ya fue creada desde este borrador.");
          return;
        }

        const { data: borradorActualizado, error } = await supabase
          .from("borradores_trabajo")
          .update({
            empresa_id: empresaIdBorrador,
            ruta: "/ordenes-compra",
            titulo: TITULO_BORRADOR_ORDEN,
            datos: datosBorrador,
            actualizado_at: new Date().toISOString(),
          })
          .eq("id", borradorOrigenId)
          .eq("usuario_id", userId!)
          .eq("estado", "borrador")
          .select(COLUMNAS_BORRADOR_ORDEN)
          .maybeSingle();

        if (error) throw error;

        if (!borradorActualizado) {
          const ordenCreada = await obtenerOrdenCreadaDesdeBorrador(
            borradorOrigenId
          );

          if (ordenCreada) {
            bloquearBorradorConsumido(
              "Esta orden ya fue creada desde este borrador."
            );
            toast.error("Esta orden ya fue creada desde este borrador.");
          }

          return;
        }

        setBorradorActivo(borradorActualizado as BorradorTrabajo);
        return;
      }

      const borrador = await guardarBorradorTrabajo({
        modulo: "ordenes",
        ruta: "/ordenes-compra",
        titulo: TITULO_BORRADOR_ORDEN,
        empresa_id: empresaIdBorrador,
        referencia_temporal: REFERENCIA_BORRADOR_ORDEN,
        datos: datosBorrador,
      });

      if (borrador.id && borradorOrigenIdRef.current === null) {
        borradorOrigenIdRef.current = borrador.id;
      }

      setBorradorActivo(borrador);
    } catch (error: any) {
      console.error("Error autoguardando borrador de orden:", error);
      toast.error("No se pudo guardar el borrador.");
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
      void guardarBorradorActual();
    }
  }
}

async function marcarBorradorRequiereRevision(
  ordenId: number,
  motivoRevision: string,
  borradorConocido?: BorradorTrabajo
) {
  let borrador = borradorConocido || borradorActivo;

  try {
    borrador =
      (await obtenerBorradorActivo({
        modulo: "ordenes",
        referencia_temporal: REFERENCIA_BORRADOR_ORDEN,
      })) || borrador;
  } catch (error) {
    if (!borrador) throw error;
  }

  if (!borrador) return;
  const usuarioBorradorId = userId || borrador.usuario_id;

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
        ordenCreadaId: ordenId,
        requiereRevision: true,
        motivoRevision,
      },
    })
    .eq("id", borrador.id)
    .eq("usuario_id", usuarioBorradorId)
    .eq("estado", "borrador");

  if (error) throw error;

  setBorradorActivo(null);
}

function bloquearBorradorConsumido(mensaje: string) {
  borradorOrigenIdRef.current = null;
  borradorConsumidoRef.current = true;
  suspenderAutoguardado();
  setMensajeBorradorBloqueado(mensaje);
  setBorradorActivo(null);
  setBorradorRevisado(true);
}

function bloquearOrdenCreadaParaRevision(ordenId: number) {
  bloquearBorradorConsumido(
    `La orden #${ordenId} fue creada, pero requiere revisión. No se debe reutilizar este formulario para crear otra orden.`
  );
}

async function completarBorradorOrdenCreada(ordenId: number) {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const borrador = await obtenerBorradorActivo({
        modulo: "ordenes",
        referencia_temporal: REFERENCIA_BORRADOR_ORDEN,
      });

      if (!borrador) {
        setBorradorActivo(null);
        return true;
      }

      await marcarBorradorCompletado(borrador.id);
      setBorradorActivo(null);
      return true;
    } catch (error) {
      console.error("Error completando borrador de orden creada:", error);
    }
  }

  try {
    await marcarBorradorRequiereRevision(
      ordenId,
      "No fue posible completar el borrador luego de crear la orden."
    );
  } catch (error) {
    console.error("Error marcando borrador para revision:", error);
  }

  bloquearOrdenCreadaParaRevision(ordenId);
  return false;
}

async function registrarCreacionParcialParaRevision(
  ordenId: number,
  motivoRevision: string
) {
  try {
    await marcarBorradorRequiereRevision(ordenId, motivoRevision);
  } catch (error) {
    console.error("Error marcando borrador de orden parcial:", error);
  }

  bloquearOrdenCreadaParaRevision(ordenId);
}

function suspenderAutoguardado() {
  autoguardadoSuspendidoRef.current = true;
  guardadoPendienteRef.current = false;

  if (timeoutBorradorRef.current !== null) {
    window.clearTimeout(timeoutBorradorRef.current);
    timeoutBorradorRef.current = null;
  }
}

async function esperarAutoguardadoEnCurso() {
  const guardadoEnCurso = guardadoEnCursoRef.current;

  if (guardadoEnCurso) {
    await guardadoEnCurso;
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
 

  async function obtenerUsuarios(rol: string) {
    if (!ROLES_CREADORES.includes(normalizarRol(rol))) {
      setUsuarios([]);
      return;
    }

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

function tieneFuncionOrden(
  usuarioId: string | null | undefined,
  empresaId: number | string | null | undefined,
  funciones: Array<"creador_orden" | "firmante_orden" | "autorizador_compra">
) {
  return tieneFuncionOperativaLocal(funcionesOperativas, usuarioId, empresaId, funciones);
}

function usuarioPuedeFirmarOrden(usuario: Perfil, empresaId?: number | string | null) {
  return Boolean(
    empresaId &&
      tieneFuncionOrden(usuario.id, empresaId, ["firmante_orden", "autorizador_compra"])
  );
}

function usuarioActualPuedeCrearOrden(empresaId: number | string | null | undefined) {
  if (tieneFuncionOrden(userId, empresaId, ["creador_orden"])) return true;
  return ROLES_CREADORES.includes(normalizarRol(perfilActual?.rol));
}

function esAuditorSoloLecturaOrden(empresaId?: number | string | null) {
  return esAuditorSoloLecturaLocal(
    funcionesOperativas,
    empresaId ? [empresaId] : empresasPermitidasIds
  );
}

 async function obtenerOrdenes(
  idsPermitidos: number[],
  usuarioId: string,
  rol: string
) {
  const rolNormalizado = normalizarRol(rol);

  if (!idsPermitidos.length) {
    setOrdenes([]);
    return;
  }

  if (rolNormalizado === "firmante_oc") {
    const { data: ordenesAsignadas, error: firmasError } = await supabase
      .from("ordenes_compra")
      .select("id, firmas_asignadas:ordenes_compra_firmas!inner(firmante_id)")
      .in("empresa_id", idsPermitidos)
      .eq("firmas_asignadas.firmante_id", usuarioId);

    if (firmasError) throw firmasError;

    const idsOrdenesAsignadas = Array.from(
      new Set(
        (ordenesAsignadas || [])
          .map((orden) => Number(orden.id))
          .filter((id) => Number.isFinite(id))
      )
    );

    if (!idsOrdenesAsignadas.length) {
      setOrdenes([]);
      return;
    }

    const { data, error } = await supabase
      .from("ordenes_compra")
      .select("*, ordenes_compra_firmas(*)")
      .in("empresa_id", idsPermitidos)
      .in("id", idsOrdenesAsignadas)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setOrdenes((data || []) as OrdenCompra[]);
    return;
  }

  if (
    !ROLES_ADMIN.includes(rolNormalizado) &&
    rolNormalizado !== "empleado" &&
    rolNormalizado !== "iniciador_gestion"
  ) {
    setOrdenes([]);
    return;
  }

  let query = supabase
    .from("ordenes_compra")
    .select("*, ordenes_compra_firmas(*)")
    .in("empresa_id", idsPermitidos);

  if (rolNormalizado === "iniciador_gestion") {
    query = query.eq("creado_por", usuarioId);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) throw error;

  setOrdenes((data || []) as OrdenCompra[]);
}

  async function refrescarOrdenes() {
    if (!userId || !perfilActual) return;
    await obtenerOrdenes(empresasPermitidasIds, userId, perfilActual.rol);
  }

 function money(valor: number, moneda: string | null = "GTQ") {
  return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-GT", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "GTQ",
  }).format(Number(valor || 0));
}

  function toggleFirmante(id: string) {
    setFirmantesSeleccionados((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  function generarIdempotencyKeyOrden(accion: string) {
    const aleatorio =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return `${IDEMPOTENCY_PREFIX_ORDENES}:${accion}:${aleatorio}`;
  }

  function obtenerIdempotencyKeyOrden(alcance: string, accion: string) {
    const storageKey = `${IDEMPOTENCY_PREFIX_ORDENES}:${alcance}`;
    const existente = window.localStorage.getItem(storageKey);
    if (existente) return { key: existente, storageKey };

    const key = generarIdempotencyKeyOrden(accion);
    window.localStorage.setItem(storageKey, key);
    return { key, storageKey };
  }

  function liberarIdempotencyKeyOrden(storageKey: string) {
    window.localStorage.removeItem(storageKey);
  }

  async function iniciarOperacionIdempotenteOrden({
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

    const { key, storageKey } = obtenerIdempotencyKeyOrden(alcance, accion);

    try {
      const { data: existente, error: consultaError } = await supabase
        .from("idempotency_keys_operativas")
        .select("id,estado,resultado_resumen,usuario_id,empresa_id,modulo,accion")
        .eq("idempotency_key", key)
        .maybeSingle();

      if (consultaError) throw consultaError;

      if (existente) {
        if (existente.usuario_id !== userId) {
          return {
            ok: false,
            mensaje: "La llave de idempotencia pertenece a otro usuario.",
            key,
            storageKey,
            persistidaId: String(existente.id),
          };
        }

        if (
          existente.empresa_id !== null &&
          existente.empresa_id !== empresaId
        ) {
          return {
            ok: false,
            mensaje: "La llave de idempotencia pertenece a otra empresa.",
            key,
            storageKey,
            persistidaId: String(existente.id),
          };
        }

        if (existente.modulo !== "ordenes" || existente.accion !== accion) {
          return {
            ok: false,
            mensaje: "La llave de idempotencia pertenece a otra operacion.",
            key,
            storageKey,
            persistidaId: String(existente.id),
          };
        }

        if (existente.estado === "completada") {
          return {
            ok: false,
            mensaje: "Esta operacion ya fue procesada. No se duplicara historial ni auditoria.",
            key,
            storageKey,
            persistidaId: String(existente.id),
            replay: true,
          };
        }

        if (existente.estado === "en_proceso") {
          return {
            ok: false,
            mensaje: "La operacion ya esta en proceso. Espera antes de reintentar.",
            key,
            storageKey,
            persistidaId: String(existente.id),
          };
        }

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
          modulo: "ordenes",
          accion,
          estado: "en_proceso",
          request_hash: requestHash || alcance,
          entidad_tipo: entidadTipo,
          entidad_id:
            entidadId !== null && entidadId !== undefined ? String(entidadId) : null,
        })
        .select("id")
        .single();

      if (insertError) {
        const { data: creadaPorOtroIntento, error: reconsultaError } =
          await supabase
            .from("idempotency_keys_operativas")
            .select("id,estado,resultado_resumen,usuario_id,empresa_id,modulo,accion")
            .eq("idempotency_key", key)
            .maybeSingle();

        if (!reconsultaError && creadaPorOtroIntento) {
          if (creadaPorOtroIntento.estado === "completada") {
            return {
              ok: false,
              mensaje: "Esta operacion ya fue procesada. No se duplicara historial ni auditoria.",
              key,
              storageKey,
              persistidaId: String(creadaPorOtroIntento.id),
              replay: true,
            };
          }

          if (creadaPorOtroIntento.estado === "en_proceso") {
            return {
              ok: false,
              mensaje: "La operacion ya esta en proceso. Espera antes de reintentar.",
              key,
              storageKey,
              persistidaId: String(creadaPorOtroIntento.id),
            };
          }

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
      console.warn("Idempotencia persistente de ordenes no disponible:", error);
      return {
        ok: true,
        key,
        storageKey,
        persistidaId: null as string | null,
        modoTemporal: true,
      };
    }
  }

  async function completarOperacionIdempotenteOrden(
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
          entidad_id:
            entidadId !== null && entidadId !== undefined ? String(entidadId) : null,
          resultado_resumen: resultadoResumen,
          error_resumen: null,
        })
        .eq("id", persistidaId);

      if (error) {
        console.warn("No se pudo completar idempotencia de ordenes:", error);
      }
    }

    liberarIdempotencyKeyOrden(storageKey);
  }

  async function fallarOperacionIdempotenteOrden(
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
        console.warn("No se pudo marcar idempotencia fallida de ordenes:", updateError);
      }
    }

    liberarIdempotencyKeyOrden(storageKey);
  }

  async function registrarAuditoriaOrden(
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

  async function registrarHistorialOrden(
    evento: {
      orden_id: number;
      accion: string;
      estado_anterior: string | null;
      estado_nuevo: string;
      comentario: string;
      usuario_id: string;
    },
    contexto: string
  ) {
    const { error } = await supabase
      .from("ordenes_compra_historial")
      .insert([evento]);

    if (error) {
      console.error(`No se pudo registrar historial de ${contexto}:`, error);
      return false;
    }

    return true;
  }

  async function crearOrden() {
    if (procesandoId !== null) {
      toast.error("Ya hay una operacion de ordenes en proceso.");
      return;
    }

    if (!userId) {
      toast.error("Sesión no válida");
      return;
    }

    if (esAuditorSoloLecturaOrden(form.empresaId)) {
      toast.error("El auditor solo lectura no puede crear ordenes.");
      return;
    }

    if (!form.empresaId || !form.proveedor || !form.concepto || !form.monto) {
      toast.error("Completa empresa, proveedor, concepto y monto");
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

    if (!usuarioActualPuedeCrearOrden(form.empresaId)) {
      toast.error("No tienes funcion operativa para crear ordenes en esta empresa.");
      return;
    }

    if (firmantesSeleccionados.length === 0) {
      toast.error("Selecciona al menos un firmante");
      return;
    }

    const firmantesValidos = firmantesSeleccionados.every((firmanteId) =>
      usuarios.some(
        (usuario) =>
          usuario.id === firmanteId &&
          usuario.activo !== false &&
          usuarioPuedeFirmarOrden(usuario, form.empresaId)
      )
    );

    if (!firmantesValidos) {
      toast.error("Selecciona solamente firmantes activos y autorizados.");
      return;
    }

    const idempotency = await iniciarOperacionIdempotenteOrden({
      alcance: [
        "crear_orden",
        userId,
        form.empresaId,
        borradorOrigenIdRef.current || REFERENCIA_BORRADOR_ORDEN,
        form.proveedor,
        form.concepto,
        form.monto,
        firmantesSeleccionados.join(","),
      ].join(":"),
      accion: "crear_orden",
      empresaId: Number(form.empresaId),
      entidadTipo: "orden_compra",
      entidadId: null,
      requestHash: [
        form.empresaId,
        form.proveedor,
        form.concepto,
        form.monto,
        form.moneda,
        form.fechaNecesaria,
        firmantesSeleccionados.join(","),
      ].join("|"),
    });

    if (!idempotency.ok) {
      if (idempotency.replay) {
        await refrescarOrdenes();
      }

      toast.error(idempotency.mensaje || "No se puede repetir esta operacion.");
      return;
    }

    suspenderAutoguardado();
    setProcesandoId(-1);
    const toastId = toast.loading("Creando orden de compra...");
    let ordenFinalizada = false;
    let auditoriaCentralRegistrada = true;
    let historialCreacionRegistrado = true;
    let etapaCreacion = "insertar_orden";
    let borradorParaOrden: BorradorTrabajo | null = null;
    let borradorIdParaOrden: string | number | null = null;

    try {
      await esperarAutoguardadoEnCurso();
      borradorIdParaOrden = borradorOrigenIdRef.current;

      const borradorActivoActual = await obtenerBorradorActivo({
        modulo: "ordenes",
        referencia_temporal: REFERENCIA_BORRADOR_ORDEN,
      });

      if (borradorIdParaOrden === null) {
        borradorParaOrden = borradorActivoActual;
        borradorIdParaOrden = borradorActivoActual?.id ?? null;
      } else if (
        borradorActivoActual &&
        String(borradorActivoActual.id) === String(borradorIdParaOrden)
      ) {
        borradorParaOrden = borradorActivoActual;
      }

      if (borradorIdParaOrden !== null) {
        const ordenExistente = await obtenerOrdenCreadaDesdeBorrador(
          borradorIdParaOrden
        );

        if (ordenExistente) {
          if (borradorParaOrden) {
            try {
              await marcarBorradorCompletado(borradorIdParaOrden);
            } catch (error) {
              console.error("Error cerrando borrador ya consumido:", error);

              try {
                await marcarBorradorRequiereRevision(
                  Number(ordenExistente.id),
                  "Se intento reutilizar un borrador que ya genero una orden.",
                  borradorParaOrden
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
            "Esta orden ya fue creada desde este borrador."
          );
          await completarOperacionIdempotenteOrden(
            idempotency.persistidaId,
            idempotency.storageKey,
            "orden_compra",
            ordenExistente.id,
            {
              orden_id: ordenExistente.id,
              accion: "crear_orden",
              resultado: "borrador_ya_consumido",
            }
          );
          toast.error("Esta orden ya fue creada desde este borrador.", {
            id: toastId,
          });
          return;
        }
      }

      const { data: ordenCreada, error: ordenError } = await supabase
  .from("ordenes_compra")
  .insert([
    {
      borrador_id:
        borradorIdParaOrden !== null ? String(borradorIdParaOrden) : null,
      empresa_id: Number(form.empresaId),
      empresa: empresaSeleccionada.nombre,

      proveedor: form.proveedor,
      proveedor_telefono: form.proveedorTelefono || null,
      proveedor_contacto: form.proveedorContacto || null,

      numero_orden: form.numeroOrden || null,
      anio_orden: form.anioOrden
        ? Number(form.anioOrden)
        : new Date().getFullYear(),

      fecha_oc: form.fechaOc || null,
      codigo_solicitante: form.codigoSolicitante || null,
      encargado: form.encargado || null,
      forma_pago: form.formaPago || null,

      concepto: form.concepto,
      descripcion: form.descripcion || null,

      fecha_factura: form.fechaFactura || null,
      numero_factura: form.numeroFactura || null,

      precio_unitario: form.precioUnitario
        ? Number(form.precioUnitario)
        : 0,

      subtotal: form.subtotal
        ? Number(form.subtotal)
        : Number(form.monto),

      isr: form.isr ? Number(form.isr) : 0,

      total_final: form.totalFinal
        ? Number(form.totalFinal)
        : Number(form.monto),

      monto: Number(form.monto),
      moneda: form.moneda,
      prioridad: form.prioridad,
      fecha_necesaria: form.fechaNecesaria || null,

      estado: "Pendiente de firmas",
      creado_por: userId,
      firmas_requeridas: firmantesSeleccionados.length,
      firmas_completadas: 0,
    },
  ])
  .select()
  .single();

      if (ordenError) {
        if (
          borradorIdParaOrden !== null &&
          esErrorDeBorradorDuplicado(ordenError)
        ) {
          let ordenExistente: { id: number } | null = null;

          try {
            ordenExistente = await obtenerOrdenCreadaDesdeBorrador(
              borradorIdParaOrden
            );
          } catch (error) {
            console.error(
              "Error verificando la orden ya creada desde el borrador:",
              error
            );
          }

          try {
            await marcarBorradorCompletado(borradorIdParaOrden);
          } catch (error) {
            console.error("Error completando borrador duplicado:", error);

            try {
              if (!ordenExistente) {
                throw new Error(
                  "No fue posible identificar la orden creada desde el borrador."
                );
              }

              await marcarBorradorRequiereRevision(
                Number(ordenExistente.id),
                "Se intento reutilizar un borrador que ya genero una orden.",
                borradorParaOrden || undefined
              );
            } catch (errorRevision) {
              console.error("Error cerrando borrador duplicado:", errorRevision);
            }
          }

          bloquearBorradorConsumido(
            "Esta orden ya fue creada desde este borrador."
          );
          await completarOperacionIdempotenteOrden(
            idempotency.persistidaId,
            idempotency.storageKey,
            "orden_compra",
            ordenExistente?.id ?? null,
            {
              orden_id: ordenExistente?.id ?? null,
              accion: "crear_orden",
              resultado: "borrador_duplicado",
            }
          );
          toast.error("Esta orden ya fue creada desde este borrador.", {
            id: toastId,
          });
          return;
        }

        throw ordenError;
      }

      ordenCreadaIdRef.current = Number(ordenCreada.id);
      etapaCreacion = "insertar_firmas";

      const obtenerTipoFirma = (index: number) => {
  if (index === 0) return "responsable_servicio";
  if (index === 1) return "autorizador";
  return "autorizador_final";
};

const firmas = firmantesSeleccionados.map((firmanteId, index) => {
  const firmante = usuarios.find((u) => u.id === firmanteId);

  return {
    orden_id: ordenCreada.id,
    firmante_id: firmanteId,
    firmante_nombre: firmante?.nombre || "Firmante",
    orden_firma: index + 1,
    tipo_firma: obtenerTipoFirma(index),
    estado: "Pendiente",
  };
});

      const { error: firmasError } = await supabase
        .from("ordenes_compra_firmas")
        .insert(firmas);

      if (firmasError) throw firmasError;

      etapaCreacion = "registrar_historial_orden";
      historialCreacionRegistrado = await registrarHistorialOrden(
        {
          orden_id: ordenCreada.id,
          accion: "Orden creada",
          estado_anterior: null,
          estado_nuevo: "Pendiente de firmas",
          comentario: `Orden enviada a ${firmantesSeleccionados.length} firmante(s)`,
          usuario_id: userId,
        },
        "creacion de orden"
      );

      auditoriaCentralRegistrada = await registrarAuditoriaOrden(
        {
          empresa_id: ordenCreada.empresa_id,
          modulo: "ordenes",
          accion: "crear_orden",
          entidad_tipo: "orden_compra",
          entidad_id: ordenCreada.id,
          estado_nuevo: ordenCreada.estado,
          descripcion: "Orden de compra creada",
          sensible: true,
          visible_calendario: Boolean(ordenCreada.fecha_necesaria),
          origen: "modulo_ordenes",
          metadatos: {
            proveedor: ordenCreada.proveedor,
            monto: Number(ordenCreada.monto),
            moneda: ordenCreada.moneda,
            fecha_necesaria: ordenCreada.fecha_necesaria,
            cantidad_firmantes: firmantesSeleccionados.length,
            borrador_id:
              borradorIdParaOrden !== null ? String(borradorIdParaOrden) : null,
            historial_especifico_registrado: historialCreacionRegistrado,
          },
        },
        "creacion de la orden"
      );

      const borradorCerrado = await completarBorradorOrdenCreada(
        ordenCreadaIdRef.current
      );

      if (!borradorCerrado) {
        try {
          await refrescarOrdenes();
        } catch (error) {
          console.error("Error actualizando listado de orden en revision:", error);
        }

        toast.error(
          "La orden fue creada, pero el borrador requiere revisión. No se debe reutilizar para crear otra orden.",
          { id: toastId }
        );
        return;
      }

      const formularioVacio = crearFormularioOrdenVacio();
      formActualRef.current = formularioVacio;
      firmantesActualesRef.current = [];
      borradorOrigenIdRef.current = null;
      setForm(formularioVacio);
      setFirmantesSeleccionados([]);
      ordenFinalizada = true;

      await completarOperacionIdempotenteOrden(
        idempotency.persistidaId,
        idempotency.storageKey,
        "orden_compra",
        ordenCreada.id,
        {
          orden_id: ordenCreada.id,
          estado: ordenCreada.estado,
          accion: "crear_orden",
          firmas_requeridas: firmantesSeleccionados.length,
        }
      );

      try {
        await refrescarOrdenes();
      } catch (error) {
        console.error("Error actualizando listado despues de crear orden:", error);
        toast.error("La orden fue creada, pero no se pudo actualizar el listado.");
      }

      if (!historialCreacionRegistrado) {
        toast.error(
          "Orden creada, pero no se pudo registrar su historial especifico.",
          { id: toastId }
        );
      } else if (auditoriaCentralRegistrada) {
        toast.success("Orden enviada a firmas", { id: toastId });
      } else {
        toast.error(
          "Orden creada, pero no se pudo registrar la auditoria central.",
          { id: toastId }
        );
      }
    } catch (error: any) {
      console.error(error);

      if (ordenCreadaIdRef.current !== null) {
        await registrarAuditoriaOrden(
          {
            empresa_id: Number(form.empresaId),
            modulo: "ordenes",
            accion: "creacion_orden_parcial",
            entidad_tipo: "orden_compra",
            entidad_id: ordenCreadaIdRef.current,
            estado_nuevo: "pendiente_revision",
            descripcion: "Creacion de orden quedo parcialmente aplicada",
            sensible: true,
            visible_calendario: Boolean(form.fechaNecesaria),
            origen: "modulo_ordenes",
            metadatos: {
              proveedor: form.proveedor,
              monto: Number(form.monto),
              moneda: form.moneda,
              fecha_necesaria: form.fechaNecesaria || null,
              cantidad_firmantes: firmantesSeleccionados.length,
              borrador_id:
                borradorIdParaOrden !== null
                  ? String(borradorIdParaOrden)
                  : null,
              etapa_fallida: etapaCreacion,
              motivo_error: error.message || "Error no identificado",
            },
          },
          "creacion parcial de la orden"
        );
        await registrarCreacionParcialParaRevision(
          ordenCreadaIdRef.current,
          "La orden fue creada, pero fallo el registro de firmas o historial."
        );
        toast.error(
          "La orden fue creada parcialmente y requiere revisión. No la reintentes desde el borrador.",
          { id: toastId }
        );
      } else {
        toast.error("No se pudo crear la orden.", { id: toastId });
      }

      if (!ordenFinalizada) {
        await fallarOperacionIdempotenteOrden(
          idempotency.persistidaId,
          idempotency.storageKey,
          error
        );
      }
    } finally {
      setProcesandoId(null);
      if (ordenFinalizada) {
        ordenCreadaIdRef.current = null;
        borradorConsumidoRef.current = false;
        autoguardadoSuspendidoRef.current = false;
        setMensajeBorradorBloqueado(null);
      } else if (
        ordenCreadaIdRef.current === null &&
        !borradorConsumidoRef.current
      ) {
        autoguardadoSuspendidoRef.current = false;
        void guardarBorradorActual();
      }
    }
  }

  async function confirmarFirma(orden: OrdenCompra) {
    if (procesandoId !== null) {
      toast.error("Ya hay una operacion de ordenes en proceso.");
      return;
    }

    if (!userId) return;

    if (esAuditorSoloLecturaOrden(orden.empresa_id)) {
      toast.error("El auditor solo lectura no puede firmar ni aprobar ordenes.");
      return;
    }

    const firma = orden.ordenes_compra_firmas?.find(
      (f) => f.firmante_id === userId
    );

    if (!firma) {
      toast.error("Esta orden no está asignada a tu firma");
      return;
    }

    if (firma.estado === "Firmado") {
      toast.error("Ya confirmaste esta firma");
      return;
    }

    if (
      !tieneFuncionOrden(userId, orden.empresa_id, ["firmante_orden", "autorizador_compra"]) &&
      !ROLES_FIRMANTES.includes(normalizarRol(perfilActual?.rol))
    ) {
      toast.error("No tienes funcion operativa para firmar o autorizar compras en esta empresa.");
      return;
    }

    const firmasYaCompletadas =
      orden.ordenes_compra_firmas?.filter((f) => f.estado === "Firmado").length || 0;
    const estaFirmaAprueba = firmasYaCompletadas + 1 >= orden.firmas_requeridas;
    const accionIdempotente = estaFirmaAprueba ? "aprobar_orden" : "firmar_orden";

    if (estaFirmaAprueba) {
      if (!orden.empresa_id) {
        toast.error("No se puede aprobar una orden sin empresa asociada.");
        return;
      }

      try {
        await validarRespaldoDocumentalActivo({
          empresa_id: orden.empresa_id,
          modulo: "ordenes",
          entidad_tipo: "orden_compra",
          entidad_id: orden.id,
          operacion: "aprobar/finalizar orden de compra",
          tipos_documento: ["factura", "comprobante", "documento soporte"],
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falta respaldo documental activo.");
        return;
      }
    }

    const idempotency = await iniciarOperacionIdempotenteOrden({
      alcance: [
        accionIdempotente,
        userId,
        orden.id,
        firma.id,
        orden.estado,
        firmasYaCompletadas,
      ].join(":"),
      accion: accionIdempotente,
      empresaId: orden.empresa_id,
      entidadTipo: "orden_compra",
      entidadId: orden.id,
      requestHash: [
        orden.id,
        firma.id,
        userId,
        orden.estado,
        firmasYaCompletadas,
        orden.firmas_requeridas,
      ].join("|"),
    });

    if (!idempotency.ok) {
      if (idempotency.replay) {
        await refrescarOrdenes();
      }

      toast.error(idempotency.mensaje || "No se puede repetir esta operacion.");
      return;
    }

    setProcesandoId(orden.id);
    const toastId = toast.loading("Confirmando firma...");
    let firmaActualizada = false;
    let ordenActualizada = false;
    let operacionCompletada = false;
    let etapaFallida = "actualizar_firma";
    let estadoCalculado: string | null = null;

    try {
      const ahora = new Date().toISOString();

      const { data: firmaProcesada, error: firmaError } = await supabase
        .from("ordenes_compra_firmas")
        .update({
          estado: "Firmado",
          firmado_at: ahora,
          comentario: "Firma confirmada",
        })
        .eq("id", firma.id)
        .eq("estado", "Pendiente")
        .select("id")
        .maybeSingle();

      if (firmaError) throw firmaError;
      if (!firmaProcesada) {
        throw new Error("Esta firma ya fue procesada.");
      }
      firmaActualizada = true;
      etapaFallida = "contar_firmas";

      const { count: firmasReales, error: firmasConteoError } = await supabase
        .from("ordenes_compra_firmas")
        .select("*", { count: "exact", head: true })
        .eq("orden_id", orden.id)
        .eq("estado", "Firmado");

      if (firmasConteoError) throw firmasConteoError;

      const nuevasFirmasCompletadas = firmasReales || 1;
      const estaAprobada = nuevasFirmasCompletadas >= orden.firmas_requeridas;

      const nuevoEstado = estaAprobada
        ? "Aprobada"
        : "Firmada parcialmente";
      estadoCalculado = nuevoEstado;

      etapaFallida = "actualizar_orden";
      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          firmas_completadas: nuevasFirmasCompletadas,
          estado: nuevoEstado,
          aprobada_at: estaAprobada ? ahora : null,
        })
        .eq("id", orden.id);

      if (ordenError) throw ordenError;
      ordenActualizada = true;

      const historialRegistrado = await registrarHistorialOrden(
        {
          orden_id: orden.id,
          accion: "Firma confirmada",
          estado_anterior: orden.estado,
          estado_nuevo: nuevoEstado,
          comentario: `Firmó ${perfilActual?.nombre || "usuario"}`,
          usuario_id: userId,
        },
        "firma de orden"
      );

      const auditoriaCentralRegistrada = await registrarAuditoriaOrden(
        {
          empresa_id: orden.empresa_id,
          modulo: "ordenes",
          accion: "firmar_orden",
          entidad_tipo: "orden_compra",
          entidad_id: orden.id,
          estado_anterior: orden.estado,
          estado_nuevo: nuevoEstado,
          descripcion: "Firma de orden registrada",
          sensible: true,
          visible_calendario: Boolean(orden.fecha_necesaria),
          origen: "modulo_ordenes",
          metadatos: {
            firmante_id: userId,
            rol_firmante: perfilActual?.rol || null,
            firmas_completadas: nuevasFirmasCompletadas,
            firmas_requeridas: orden.firmas_requeridas,
            historial_especifico_registrado: historialRegistrado,
          },
        },
        "firma de la orden"
      );
      operacionCompletada = true;

      await completarOperacionIdempotenteOrden(
        idempotency.persistidaId,
        idempotency.storageKey,
        "orden_compra",
        orden.id,
        {
          orden_id: orden.id,
          firma_id: firma.id,
          accion: accionIdempotente,
          estado: nuevoEstado,
          firmas_completadas: nuevasFirmasCompletadas,
          aprobada: estaAprobada,
        }
      );

      await refrescarOrdenes();

      if (!historialRegistrado) {
        toast.error(
          "Firma aplicada, pero no se pudo registrar su historial especifico.",
          { id: toastId }
        );
      } else if (auditoriaCentralRegistrada) {
        toast.success(
          estaAprobada ? "Orden aprobada completamente" : "Firma registrada",
          { id: toastId }
        );
      } else {
        toast.error(
          "Firma aplicada, pero no se pudo registrar la auditoria central.",
          { id: toastId }
        );
      }
    } catch (error: any) {
      console.error(error);
      if (firmaActualizada && !ordenActualizada) {
        await registrarAuditoriaOrden(
          {
            empresa_id: orden.empresa_id,
            modulo: "ordenes",
            accion: "firma_orden_parcial",
            entidad_tipo: "orden_compra",
            entidad_id: orden.id,
            descripcion: "Firma de orden quedo parcialmente aplicada",
            sensible: true,
            visible_calendario: Boolean(orden.fecha_necesaria),
            origen: "modulo_ordenes",
            metadatos: {
              firmante_id: userId,
              etapa_fallida: etapaFallida,
              estado_calculado: estadoCalculado,
              motivo_error: error.message || "Error no identificado",
            },
          },
          "firma parcial de la orden"
        );
        toast.error(
          "La firma fue aplicada parcialmente y la orden requiere revision.",
          { id: toastId }
        );
      } else if (operacionCompletada) {
        toast.error("Firma aplicada, pero no se pudo actualizar el listado.", {
          id: toastId,
        });
      } else {
        toast.error("No se pudo firmar la orden.", { id: toastId });
      }

      if (!operacionCompletada) {
        await fallarOperacionIdempotenteOrden(
          idempotency.persistidaId,
          idempotency.storageKey,
          error
        );
      }
    } finally {
      setProcesandoId(null);
    }
  }

  async function observarOrden(orden: OrdenCompra) {
    if (procesandoId !== null) {
      toast.error("Ya hay una operacion de ordenes en proceso.");
      return;
    }

    if (!userId) return;

    if (esAuditorSoloLecturaOrden(orden.empresa_id)) {
      toast.error("El auditor solo lectura no puede observar ordenes.");
      return;
    }

    const comentario = window.prompt("Escribe el motivo de la observación:");

    if (!comentario) {
      toast.error("Debes escribir un motivo");
      return;
    }

    const comentarioNormalizado = comentario.trim();

    if (!comentarioNormalizado) {
      toast.error("Debes escribir un motivo");
      return;
    }

    const firma = orden.ordenes_compra_firmas?.find(
      (f) => f.firmante_id === userId
    );

    if (!firma) {
      toast.error("Esta orden no está asignada a tu firma");
      return;
    }

    if (firma.estado === "Observada") {
      toast.error("Ya observaste esta orden.");
      return;
    }

    if (firma.estado === "Firmado") {
      toast.error("No puedes observar una firma ya confirmada.");
      return;
    }

    if (
      !tieneFuncionOrden(userId, orden.empresa_id, ["firmante_orden", "autorizador_compra"]) &&
      !ROLES_FIRMANTES.includes(normalizarRol(perfilActual?.rol))
    ) {
      toast.error("No tienes funcion operativa para observar ordenes en esta empresa.");
      return;
    }

    const idempotency = await iniciarOperacionIdempotenteOrden({
      alcance: [
        "observar_orden",
        userId,
        orden.id,
        firma.id,
        orden.estado,
        comentarioNormalizado,
      ].join(":"),
      accion: "observar_orden",
      empresaId: orden.empresa_id,
      entidadTipo: "orden_compra",
      entidadId: orden.id,
      requestHash: [
        orden.id,
        firma.id,
        userId,
        orden.estado,
        comentarioNormalizado,
      ].join("|"),
    });

    if (!idempotency.ok) {
      if (idempotency.replay) {
        await refrescarOrdenes();
      }

      toast.error(idempotency.mensaje || "No se puede repetir esta operacion.");
      return;
    }

    setProcesandoId(orden.id);
    const toastId = toast.loading("Registrando observación...");
    let firmaActualizada = false;
    let ordenActualizada = false;
    let operacionCompletada = false;
    let etapaFallida = "actualizar_firma";

    try {
      const ahora = new Date().toISOString();

      const { data: firmaProcesada, error: firmaError } = await supabase
        .from("ordenes_compra_firmas")
        .update({
          estado: "Observada",
          rechazado_at: ahora,
          comentario: comentarioNormalizado,
        })
        .eq("id", firma.id)
        .eq("estado", "Pendiente")
        .select("id")
        .maybeSingle();

      if (firmaError) throw firmaError;
      if (!firmaProcesada) {
        throw new Error("Esta firma ya fue procesada.");
      }
      firmaActualizada = true;
      etapaFallida = "actualizar_orden";

      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          estado: "Observada",
          rechazada_at: ahora,
        })
        .eq("id", orden.id);

      if (ordenError) throw ordenError;
      ordenActualizada = true;

      const historialRegistrado = await registrarHistorialOrden(
        {
          orden_id: orden.id,
          accion: "Orden observada",
          estado_anterior: orden.estado,
          estado_nuevo: "Observada",
          comentario: comentarioNormalizado,
          usuario_id: userId,
        },
        "observacion de orden"
      );

      const auditoriaCentralRegistrada = await registrarAuditoriaOrden(
        {
          empresa_id: orden.empresa_id,
          modulo: "ordenes",
          accion: "observar_orden",
          entidad_tipo: "orden_compra",
          entidad_id: orden.id,
          estado_anterior: orden.estado,
          estado_nuevo: "Observada",
          motivo: comentarioNormalizado,
          descripcion: "Orden de compra observada",
          sensible: true,
          visible_calendario: Boolean(orden.fecha_necesaria),
          origen: "modulo_ordenes",
          metadatos: {
            firmante_id: userId,
            rol_firmante: perfilActual?.rol || null,
            historial_especifico_registrado: historialRegistrado,
          },
        },
        "observacion de la orden"
      );
      operacionCompletada = true;

      await completarOperacionIdempotenteOrden(
        idempotency.persistidaId,
        idempotency.storageKey,
        "orden_compra",
        orden.id,
        {
          orden_id: orden.id,
          firma_id: firma.id,
          accion: "observar_orden",
          estado: "Observada",
        }
      );

      await refrescarOrdenes();

      if (!historialRegistrado) {
        toast.error(
          "Orden observada, pero no se pudo registrar su historial especifico.",
          { id: toastId }
        );
      } else if (auditoriaCentralRegistrada) {
        toast.success("Orden observada", { id: toastId });
      } else {
        toast.error(
          "Orden observada, pero no se pudo registrar la auditoria central.",
          { id: toastId }
        );
      }
    } catch (error: any) {
      console.error(error);
      if (firmaActualizada && !ordenActualizada) {
        await registrarAuditoriaOrden(
          {
            empresa_id: orden.empresa_id,
            modulo: "ordenes",
            accion: "observacion_orden_parcial",
            entidad_tipo: "orden_compra",
            entidad_id: orden.id,
            descripcion: "Observacion de orden quedo parcialmente aplicada",
            sensible: true,
            visible_calendario: Boolean(orden.fecha_necesaria),
            origen: "modulo_ordenes",
            metadatos: {
              firmante_id: userId,
              comentario: comentarioNormalizado,
              etapa_fallida: etapaFallida,
              motivo_error: error.message || "Error no identificado",
            },
          },
          "observacion parcial de la orden"
        );
        toast.error(
          "La observacion fue aplicada parcialmente y la orden requiere revision.",
          { id: toastId }
        );
      } else if (operacionCompletada) {
        toast.error(
          "Orden observada, pero no se pudo actualizar el listado.",
          { id: toastId }
        );
      } else {
        toast.error("No se pudo observar la orden.", { id: toastId });
      }

      if (!operacionCompletada) {
        await fallarOperacionIdempotenteOrden(
          idempotency.persistidaId,
          idempotency.storageKey,
          error
        );
      }
    } finally {
      setProcesandoId(null);
    }
  }

 const rolActual = normalizarRol(perfilActual?.rol);

const esAdminOrdenes = ROLES_ADMIN.includes(rolActual);
const esIniciadorGestion = rolActual === "iniciador_gestion";
const esFirmanteOC = rolActual === "firmante_oc";
const esEmpleado = rolActual === "empleado";

const puedeCrear = ROLES_CREADORES.includes(rolActual);

useEffect(() => {
  if (
    ordenCreadaIdRef.current !== null ||
    autoguardadoSuspendidoRef.current ||
    !autorizado ||
    !puedeCrear ||
    !borradorRevisado ||
    !formularioTieneContenido(form, firmantesSeleccionados)
  ) {
    return;
  }

  timeoutBorradorRef.current = window.setTimeout(() => {
    timeoutBorradorRef.current = null;
    void guardarBorradorActual(form, firmantesSeleccionados);
  }, 1500);

  return () => {
    if (timeoutBorradorRef.current !== null) {
      window.clearTimeout(timeoutBorradorRef.current);
      timeoutBorradorRef.current = null;
    }
  };
}, [autorizado, puedeCrear, borradorRevisado, form, firmantesSeleccionados]);

useEffect(() => {
  if (
    ordenCreadaIdRef.current !== null ||
    autoguardadoSuspendidoRef.current ||
    !autorizado ||
    !puedeCrear ||
    !borradorRevisado
  ) {
    return;
  }

  const intervalo = window.setInterval(() => {
    void guardarBorradorActual();
  }, 15 * 60 * 1000);

  return () => window.clearInterval(intervalo);
}, [autorizado, puedeCrear, borradorRevisado]);

  const usuariosFirmantes = usuarios.filter(
    (u) => u.activo !== false && usuarioPuedeFirmarOrden(u, form.empresaId)
  );
const ordenesFiltradas = useMemo(() => {
  return ordenes.filter((orden) => {
    const perteneceAEmpresaPermitida =
      orden.empresa_id !== null &&
      empresasPermitidasIds.includes(Number(orden.empresa_id));

    const matchEstado =
      filtroEstado === "Todos" ? true : orden.estado === filtroEstado;

    const matchEmpresa =
      filtroEmpresa === "Todas"
        ? true
        : Number(orden.empresa_id) === Number(filtroEmpresa);

    return perteneceAEmpresaPermitida && matchEstado && matchEmpresa;
  });
}, [ordenes, filtroEstado, filtroEmpresa, empresasPermitidasIds]);

const ordenesDashboard = useMemo(() => {
  const base = ordenes.filter(
    (o) =>
      o.empresa_id !== null &&
      empresasPermitidasIds.includes(Number(o.empresa_id))
  );

  if (esAdminOrdenes) {
    return base;
  }

  if (esEmpleado) {
    return base;
  }

  if (esIniciadorGestion) {
    return base.filter((o) => o.creado_por === userId);
  }

  if (esFirmanteOC) {
    return base.filter((o) =>
      o.ordenes_compra_firmas?.some((f) => f.firmante_id === userId)
    );
  }

  return [];
}, [
  ordenes,
  userId,
  esAdminOrdenes,
  esEmpleado,
  esIniciadorGestion,
  esFirmanteOC,
  empresasPermitidasIds,
]);
const stats = useMemo(() => {
  if (esFirmanteOC) {
    return {
      pendientes: ordenesDashboard.filter((o) =>
        o.ordenes_compra_firmas?.some(
          (f) => f.firmante_id === userId && f.estado === "Pendiente"
        )
      ).length,

      parciales: ordenesDashboard.filter((o) =>
        o.ordenes_compra_firmas?.some(
          (f) => f.firmante_id === userId && f.estado === "Firmado"
        )
      ).length,

      aprobadas: ordenesDashboard.filter((o) => o.estado === "Aprobada").length,

      observadas: ordenesDashboard.filter((o) =>
        o.ordenes_compra_firmas?.some(
          (f) => f.firmante_id === userId && f.estado === "Observada"
        )
      ).length,
    };
  }

  return {
    pendientes: ordenesDashboard.filter((o) => o.estado === "Pendiente de firmas").length,
    parciales: ordenesDashboard.filter((o) => o.estado === "Firmada parcialmente").length,
    aprobadas: ordenesDashboard.filter((o) => o.estado === "Aprobada").length,
    observadas: ordenesDashboard.filter((o) => o.estado === "Observada").length,
  };
}, [ordenesDashboard, esFirmanteOC, userId]);

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
      <Toaster position="bottom-right" toastOptions={{ style: { background: "#0f172a", color: "#fff", border: "1px solid #1e293b" } }} />
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
<h1 className="text-5xl font-black tracking-tight">
  {esFirmanteOC
    ? "Dashboard de firmante"
    : esIniciadorGestion
    ? "Dashboard de iniciador"
    : esEmpleado
    ? "Seguimiento de órdenes"
    : "Órdenes de compra"}
</h1>

<p className="text-gray-400 mt-2">
  {esFirmanteOC
    ? "Órdenes pendientes de firma y confirmaciones realizadas"
    : esIniciadorGestion
    ? "Control de órdenes creadas y estado de firmas"
    : esEmpleado
    ? "Consulta del avance de órdenes de compra por empresa asignada"
    : "Creación, revisión y confirmación de firmas"}
</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <Stat
  label={esFirmanteOC ? "Por firmar" : "Pendientes"}
  value={stats.pendientes}
  color="text-yellow-400"
  loading={cargandoOrdenes}
/>

<Stat
  label={esFirmanteOC ? "Firmadas por mí" : "Parciales"}
  value={stats.parciales}
  color="text-cyan-400"
  loading={cargandoOrdenes}
/>

<Stat
  label="Aprobadas"
  value={stats.aprobadas}
  color="text-green-400"
  loading={cargandoOrdenes}
/>

<Stat
  label={esFirmanteOC ? "Observadas por mí" : "Observadas"}
  value={stats.observadas}
  color="text-red-400"
  loading={cargandoOrdenes}
/>
            </div>
          </header>
          {cargandoOrdenes ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando ordenes de compra...
            </section>
          ) : (
            <>
          {esFirmanteOC && (
  <div className="mb-8 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-5">
    <h2 className="text-cyan-400 font-black text-sm uppercase">
      Panel de firmante
    </h2>
    <p className="text-gray-400 text-sm mt-1">
      Aquí solo verás las órdenes de compra asignadas a tu firma. 
      Puedes confirmar cuando ya firmaste físicamente el documento o marcarla como observada.
    </p>
  </div>
)}

{esIniciadorGestion && (
  <div className="mb-8 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5">
    <h2 className="text-purple-400 font-black text-sm uppercase">
      Panel de iniciador de gestión
    </h2>
    <p className="text-gray-400 text-sm mt-1">
      Aquí puedes crear órdenes de compra, seleccionar firmantes y dar seguimiento al avance de firmas.
    </p>
  </div>
)}
{esEmpleado && (
  <div className="mb-8 bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
    <h2 className="text-green-400 font-black text-sm uppercase">
      Vista de seguimiento
    </h2>
    <p className="text-gray-400 text-sm mt-1">
      Aquí puedes consultar las órdenes de compra de tus empresas asignadas.
      Puedes ver el estado de la orden, quién ya firmó y quién está pendiente.
      Esta vista es solo de lectura.
    </p>
  </div>
)}

{puedeCrear && mensajeBorradorBloqueado && (
  <section className="mb-8 bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
    <h2 className="text-red-400 font-black text-sm uppercase">
      Orden pendiente de revisión
    </h2>
    <p className="text-gray-200 mt-2">
      {mensajeBorradorBloqueado}
    </p>
  </section>
)}

{puedeCrear &&
  !mensajeBorradorBloqueado &&
  borradorActivo &&
  !borradorRevisado && (
  <section className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6">
    <h2 className="text-yellow-400 font-black text-sm uppercase">
      Borrador pendiente
    </h2>
    <p className="text-gray-200 mt-2">
      Tienes una orden de compra pendiente. ¿Deseas continuar donde quedaste?
    </p>
    <div className="flex flex-wrap gap-3 mt-5">
      <button
        type="button"
        onClick={continuarConBorrador}
        disabled={procesandoBorrador}
        className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase disabled:opacity-50"
      >
        Continuar orden
      </button>
      <button
        type="button"
        onClick={descartarBorradorPendiente}
        disabled={procesandoBorrador}
        className="px-5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-black uppercase disabled:opacity-50"
      >
        Descartar borrador
      </button>
    </div>
  </section>
)}

{puedeCrear && !mensajeBorradorBloqueado && borradorRevisado && (
  <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
    <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
      <Plus size={16} className="text-cyan-500" />
      Crear orden de compra
    </h2>

    {(borradorActivo || procesandoBorrador) && (
      <p className="text-xs text-cyan-400 mb-5">
        {procesandoBorrador
          ? "Guardando borrador..."
          : "Borrador guardado automaticamente."}
      </p>
    )}

    <div className="grid md:grid-cols-4 gap-4">
      <select
        value={form.empresaId}
        onChange={(e) => {
          const empresa = empresas.find(
            (emp) => String(emp.id) === e.target.value
          );

          setForm({
            ...form,
            empresaId: e.target.value,
            empresa: empresa ? empresa.nombre : "",
          });
        }}
        className="input-custom"
      >
        <option value="">Empresa...</option>
        {empresas.map((emp) => (
          <option key={emp.id} value={String(emp.id)}>
            {emp.nombre}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Número de orden"
        value={form.numeroOrden}
        onChange={(e) => setForm({ ...form, numeroOrden: e.target.value })}
        className="input-custom"
      />

      <input
        type="number"
        placeholder="Año"
        value={form.anioOrden}
        onChange={(e) => setForm({ ...form, anioOrden: e.target.value })}
        className="input-custom"
      />

      <input
        type="date"
        value={form.fechaOc}
        onChange={(e) => setForm({ ...form, fechaOc: e.target.value })}
        className="input-custom"
      />

      <input
        type="text"
        placeholder="Código solicitante"
        value={form.codigoSolicitante}
        onChange={(e) =>
          setForm({ ...form, codigoSolicitante: e.target.value })
        }
        className="input-custom"
      />

      <input
        type="text"
        placeholder="Encargado / responsable"
        value={form.encargado}
        onChange={(e) => setForm({ ...form, encargado: e.target.value })}
        className="input-custom"
      />

      <select
        value={form.formaPago}
        onChange={(e) => setForm({ ...form, formaPago: e.target.value })}
        className="input-custom"
      >
        <option value="">Forma de pago...</option>
        <option value="Cheque">Cheque</option>
        <option value="Transferencia">Transferencia</option>
        <option value="Depósito">Depósito</option>
        <option value="Efectivo">Efectivo</option>
        <option value="Crédito">Crédito</option>
      </select>

      <input
        type="text"
        placeholder="Proveedor"
        value={form.proveedor}
        onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
        className="input-custom"
      />

      <input
        type="text"
        placeholder="Teléfono proveedor"
        value={form.proveedorTelefono}
        onChange={(e) =>
          setForm({ ...form, proveedorTelefono: e.target.value })
        }
        className="input-custom"
      />

      <input
        type="text"
        placeholder="Contacto proveedor"
        value={form.proveedorContacto}
        onChange={(e) =>
          setForm({ ...form, proveedorContacto: e.target.value })
        }
        className="input-custom"
      />

      <input
        type="text"
        placeholder="Concepto"
        value={form.concepto}
        onChange={(e) => setForm({ ...form, concepto: e.target.value })}
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
        value={form.moneda}
        onChange={(e) => setForm({ ...form, moneda: e.target.value })}
        className="input-custom"
      >
        <option value="GTQ">Quetzales (GTQ)</option>
        <option value="USD">Dólares (USD)</option>
      </select>

      <input
        type="date"
        value={form.fechaNecesaria}
        onChange={(e) =>
          setForm({ ...form, fechaNecesaria: e.target.value })
        }
        className="input-custom"
      />

      <select
        value={form.prioridad}
        onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
        className="input-custom"
      >
        <option value="Alta">Prioridad Alta</option>
        <option value="Media">Prioridad Media</option>
        <option value="Baja">Prioridad Baja</option>
      </select>

      <input
        type="date"
        value={form.fechaFactura}
        onChange={(e) => setForm({ ...form, fechaFactura: e.target.value })}
        className="input-custom"
      />

      <input
        type="text"
        placeholder="Número de factura"
        value={form.numeroFactura}
        onChange={(e) => setForm({ ...form, numeroFactura: e.target.value })}
        className="input-custom"
      />

      <input
        type="number"
        placeholder="Precio unitario"
        value={form.precioUnitario}
        onChange={(e) =>
          setForm({ ...form, precioUnitario: e.target.value })
        }
        className="input-custom"
      />

      <input
        type="number"
        placeholder="Subtotal"
        value={form.subtotal}
        onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
        className="input-custom"
      />

      <input
        type="number"
        placeholder="ISR"
        value={form.isr}
        onChange={(e) => setForm({ ...form, isr: e.target.value })}
        className="input-custom"
      />

      <input
        type="number"
        placeholder="Total final"
        value={form.totalFinal}
        onChange={(e) => setForm({ ...form, totalFinal: e.target.value })}
        className="input-custom"
      />

      <textarea
        placeholder="Descripción adicional"
        value={form.descripcion}
        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        className="input-custom md:col-span-4 h-28 py-4 resize-none"
      />

      <div className="md:col-span-4 border border-white/10 rounded-2xl p-4 bg-[#0f172a]/60">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-cyan-400" />
          <h3 className="text-sm font-black uppercase text-gray-300">
            Seleccionar firmantes
          </h3>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {usuariosFirmantes.map((usuario) => (
            <label
              key={usuario.id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                firmantesSeleccionados.includes(usuario.id)
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-white/[0.02] text-gray-400"
              }`}
            >
              <input
                type="checkbox"
                checked={firmantesSeleccionados.includes(usuario.id)}
                onChange={() => toggleFirmante(usuario.id)}
              />
              <span className="text-xs font-bold">
                {usuario.nombre} — {usuario.rol}
              </span>
            </label>
          ))}

          {usuariosFirmantes.length === 0 && (
            <p className="text-gray-500 text-sm md:col-span-4">
              No hay usuarios autorizados configurados para esta accion.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={crearOrden}
        className="md:col-span-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Enviar orden a firma
      </button>
    </div>
  </section>
)}

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
              <option value="Pendiente de firmas">Pendiente de firmas</option>
              <option value="Firmada parcialmente">Firmada parcialmente</option>
              <option value="Aprobada">Aprobada</option>
              <option value="Observada">Observada</option>
            </select>
          </section>

          <section className="grid gap-4">
            {ordenesFiltradas.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <p className="text-gray-500">No hay órdenes para mostrar.</p>
              </div>
            )}

            {ordenesFiltradas.map((orden) => (
           <OrdenCard
  key={orden.id}
  orden={orden}
  userId={userId}
  money={money}
  puedeAccionar={esFirmanteOC || esAdminOrdenes}
  procesando={procesandoId === orden.id}
  onFirmar={() => confirmarFirma(orden)}
  onObservar={() => observarOrden(orden)}
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
          border: 1px solid rgba(255,255,255,0.1);
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

function OrdenCard({
  orden,
  userId,
  money,
  puedeAccionar,
  procesando,
  onFirmar,
  onObservar,
}: {
  orden: OrdenCompra;
  userId: string | null;
  money: (valor: number, moneda?: string | null) => string;
  puedeAccionar: boolean;
  procesando: boolean;
  onFirmar: () => void;
  onObservar: () => void;
}) {
  const firmas = orden.ordenes_compra_firmas || [];

  const miFirma = firmas.find((f) => f.firmante_id === userId);
 const puedeFirmar = puedeAccionar && miFirma && miFirma.estado === "Pendiente";

  return (
    <div className="rounded-[2rem] p-6 border border-white/10 bg-white/[0.03] hover:border-cyan-500/30 transition-all">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              #{orden.id}
            </span>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/10 text-white border border-white/10 uppercase">
              {orden.estado}
            </span>

            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Firmas: {orden.firmas_completadas}/{orden.firmas_requeridas}
            </span>
          </div>

          <h3 className="text-2xl font-black tracking-tight">
            {orden.proveedor}
          </h3>

          <p className="text-gray-400 mt-1">{orden.concepto}</p>

          {orden.descripcion && (
            <p className="text-gray-500 text-sm mt-2">{orden.descripcion}</p>
          )}


<div className="mt-5 grid md:grid-cols-3 gap-3">
  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <p className="text-[10px] font-black uppercase text-cyan-400 mb-3">
      Datos de la orden
    </p>

    <div className="space-y-2 text-[11px] text-gray-400 font-bold uppercase">
      <p>O/C: {orden.numero_orden || orden.id}</p>
      <p>Año: {orden.anio_orden || "N/A"}</p>
      <p>Fecha O/C: {orden.fecha_oc || "N/A"}</p>
      <p>Código solicitante: {orden.codigo_solicitante || "N/A"}</p>
      <p>Encargado: {orden.encargado || "N/A"}</p>
      <p>Forma pago: {orden.forma_pago || "N/A"}</p>
    </div>
  </div>

  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <p className="text-[10px] font-black uppercase text-purple-400 mb-3">
      Datos de factura
    </p>

    <div className="space-y-2 text-[11px] text-gray-400 font-bold uppercase">
      <p>Factura: {orden.numero_factura || "N/A"}</p>
      <p>Fecha factura: {orden.fecha_factura || "N/A"}</p>
      <p>Fecha documento: {orden.fecha_necesaria || "N/A"}</p>
      <p>Tel. proveedor: {orden.proveedor_telefono || "N/A"}</p>
      <p>Contacto: {orden.proveedor_contacto || "N/A"}</p>
    </div>
  </div>

  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <p className="text-[10px] font-black uppercase text-green-400 mb-3">
      Montos
    </p>

    <div className="space-y-2 text-[11px] text-gray-400 font-bold uppercase">
      <p>
        Precio unitario:{" "}
        {money(Number(orden.precio_unitario || 0), orden.moneda)}
      </p>
      <p>
        Subtotal: {money(Number(orden.subtotal || 0), orden.moneda)}
      </p>
      <p>ISR: {money(Number(orden.isr || 0), orden.moneda)}</p>
      <p className="text-white">
        Total final:{" "}
        {money(Number(orden.total_final || orden.monto || 0), orden.moneda)}
      </p>
    </div>
  </div>
</div>

<div className="mt-5">
  <p className="text-[10px] font-black uppercase text-gray-500 mb-3">
    Flujo de firmas
  </p>
</div>

          <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-4 gap-2">
            {firmas.map((firma) => (
              <div
                key={firma.id}
                className={`rounded-xl border p-3 ${
                  firma.estado === "Firmado"
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : firma.estado === "Observada"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                }`}
              >
                <p className="text-[10px] font-black uppercase">
                  {firma.firmante_nombre}
                </p>
                <p className="text-[9px] mt-1 opacity-70 uppercase">
  {firma.tipo_firma === "responsable_servicio"
    ? "Responsable del servicio"
    : firma.tipo_firma === "autorizador"
    ? "Autorizador"
    : firma.tipo_firma === "autorizador_final"
    ? "Autorizador final"
    : "Firmante"}
</p>
                <p className="text-[10px] mt-1">
                  Estado: {firma.estado}
                </p>

                {firma.firmado_at && (
                  <p className="text-[9px] mt-1 text-gray-400">
                    Firmó: {new Date(firma.firmado_at).toLocaleString()}
                  </p>
                )}

                {firma.comentario && (
                  <p className="text-[9px] mt-1 text-gray-400">
                    {firma.comentario}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>


        {puedeFirmar && (
          <div className="flex flex-wrap xl:flex-col gap-2 min-w-[180px]">
            <button
              onClick={onFirmar}
              disabled={procesando}
              className="bg-green-500 hover:bg-green-400 text-black font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {procesando ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              Ya firmé
            </button>

            <button
              onClick={onObservar}
              disabled={procesando}
              className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-black px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <XCircle size={14} />
              Observar
            </button>
          </div>
        )}
      </div>

      <DocumentosEntidad
        empresaId={orden.empresa_id}
        modulo="ordenes"
        entidadTipo="orden_compra"
        entidadId={orden.id}
        titulo="Documentos de la orden"
        numeroFactura={orden.numero_factura}
        proveedorNombre={orden.proveedor}
        monto={orden.total_final ?? orden.monto}
        moneda={orden.moneda}
        tiposDocumento={TIPOS_DOCUMENTO_ORDENES}
        disabled={!orden.empresa_id || !orden.id}
      />
    </div>
  );
}
