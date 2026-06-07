"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { registrarAuditoriaEvento, type ValorJsonAuditoria } from "../../lib/auditoria";
import { registrarRateLimitOperativo } from "../../lib/rateLimitOperativo";
import * as XLSX from "xlsx";
import { toast, Toaster } from "react-hot-toast";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
} from "lucide-react";

const IMPORTACION_MAX_BYTES = 5 * 1024 * 1024;
const IMPORTACION_MAX_FILAS = 1000;
const IMPORTACION_RATE_LIMIT_MAX = 5;
const IMPORTACION_RATE_LIMIT_VENTANA_SEGUNDOS = 30 * 60;
const IMPORTACION_ACTIVA_KEY = "controlplus_importacion_activa";
const IDEMPOTENCY_PREFIX_IMPORTACIONES = "controlplus_idempotency_importaciones";
const EXTENSIONES_IMPORTACION_PERMITIDAS = [".xlsx", ".xls", ".csv"];

interface Empresa {
  id: number;
  nombre: string;
  estado?: string | null;
  razon_social?: string | null;
  nombre_comercial?: string | null;
}
 
interface FondoEmpresa {
  id: number;
  empresa_id: number;
  empresa: string;
  banco: string | null;
  cuenta_bancaria: string | null;
  moneda: string;
  saldo_base?: number | null;
  saldo_comprometido?: number | null;
  saldo_disponible?: number | null;
  estado?: string | null;
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

type TipoImportacion =
  | "proveedores"
  | "ordenes_compra"
  | "cheques"
  | "movimientos"
  | "planillas";

interface FilaPreview {
  fila: number;
  valido: boolean;
  errores: string[];
  data: any;
}

interface ResultadoDuplicados {
  importables: FilaPreview[];
  excluidas: FilaPreview[];
  errores: string[];
}

const TIPOS_IMPORTACION: {
  value: TipoImportacion;
  label: string;
  tabla: string;
  descripcion: string;
  columnas: string[];
}[] = [
  {
    value: "proveedores",
    label: "Proveedores",
    tabla: "proveedores",
    descripcion: "Carga de proveedores, NIT, contactos, banco y cuenta.",
    columnas: [
      "Empresa",
      "Nombre Proveedor",
      "NIT",
      "Telefono",
      "Correo",
      "Direccion",
      "Banco",
      "Cuenta Bancaria",
      "Moneda",
    ],
  },
  {
    value: "ordenes_compra",
    label: "Órdenes de compra",
    tabla: "ordenes_compra",
    descripcion: "Carga de órdenes, facturas, fechas, proveedor y montos.",
    columnas: [
      "Empresa",
      "Proveedor",
      "Numero Orden",
      "Fecha Orden",
      "Fecha Documento",
      "Fecha Factura",
      "Numero Factura",
      "Descripcion",
      "Cantidad",
      "Precio Unitario",
      "Total",
      "Moneda",
    ],
  },
  {
    value: "cheques",
    label: "Cheques / pagos",
    tabla: "cheques",
    descripcion: "Carga de pagos, beneficiarios, montos, forma de pago y moneda.",
    columnas: [
      "Empresa",
      "Beneficiario",
      "Concepto",
      "Monto",
      "Tipo Pago",
      "Forma Pago",
      "Moneda",
      "Tipo Cambio",
      "Fecha Pago",
      "Prioridad",
      "Banco",
      "Cuenta Bancaria",
      "Numero Cheque",
    ],
  },
  {
    value: "movimientos",
    label: "Contabilidad / movimientos",
    tabla: "movimientos",
    descripcion: "Carga de ingresos, egresos y movimientos contables.",
    columnas: [
      "Empresa",
      "Fecha",
      "Tipo",
      "Descripcion",
      "Monto",
      "Moneda",
      "Referencia",
    ],
  },
  {
    value: "planillas",
    label: "Planillas / nómina",
    tabla: "planillas",
    descripcion: "Carga de empleados, sueldos, descuentos, ISR e IGSS.",
    columnas: [
      "Empresa",
      "Empleado",
      "DPI",
      "Puesto",
      "Sueldo Base",
      "Bonificacion",
      "Descuentos",
      "ISR",
      "IGSS",
      "Total Pagar",
      "Fecha",
      "Moneda",
    ],
  },
];

const COLUMNAS_OBLIGATORIAS: Record<TipoImportacion, string[]> = {
  proveedores: ["Empresa", "Nombre Proveedor", "NIT"],
  ordenes_compra: ["Empresa", "Proveedor", "Total", "Moneda"],
  cheques: ["Empresa", "Beneficiario", "Concepto", "Monto", "Forma Pago", "Moneda", "Fecha Pago"],
  movimientos: ["Empresa", "Fecha", "Tipo", "Descripcion", "Monto", "Moneda", "Referencia"],
  planillas: ["Empresa", "Empleado", "Total Pagar", "Fecha", "Moneda"],
};

const ALIAS_COLUMNAS: Record<TipoImportacion, Record<string, string[]>> = {
  proveedores: {
    "Empresa": ["Empresa", "empresa", "EMPRESA"],
    "Nombre Proveedor": ["Nombre Proveedor", "Proveedor", "proveedor", "Nombre", "nombre"],
    "NIT": ["NIT", "nit"],
    "Telefono": ["Telefono", "Teléfono", "telefono"],
    "Correo": ["Correo", "correo", "Email"],
    "Direccion": ["Direccion", "Dirección", "direccion"],
    "Banco": ["Banco", "banco"],
    "Cuenta Bancaria": ["Cuenta Bancaria", "Cuenta", "cuenta_bancaria"],
    "Moneda": ["Moneda", "moneda"],
  },
  ordenes_compra: {
    "Empresa": ["Empresa", "empresa", "EMPRESA"],
    "Proveedor": ["Proveedor", "proveedor", "Beneficiario"],
    "Numero Orden": ["Numero Orden", "Número Orden", "OC"],
    "Fecha Orden": ["Fecha Orden", "fecha_orden"],
    "Fecha Documento": ["Fecha Documento", "fecha_documento"],
    "Fecha Factura": ["Fecha Factura", "fecha_factura"],
    "Numero Factura": ["Numero Factura", "Número Factura", "Factura"],
    "Descripcion": ["Descripcion", "Descripción", "Concepto"],
    "Cantidad": ["Cantidad", "cantidad"],
    "Precio Unitario": ["Precio Unitario", "precio_unitario"],
    "Total": ["Total", "total"],
    "Moneda": ["Moneda", "moneda"],
  },
  cheques: {
    "Empresa": ["Empresa", "empresa", "EMPRESA"],
    "Beneficiario": ["Beneficiario", "beneficiario", "Proveedor"],
    "Concepto": ["Concepto", "Descripcion", "Descripción"],
    "Monto": ["Monto", "monto"],
    "Tipo Pago": ["Tipo Pago", "tipo_pago"],
    "Forma Pago": ["Forma Pago", "forma_pago"],
    "Moneda": ["Moneda", "moneda"],
    "Tipo Cambio": ["Tipo Cambio", "tipo_cambio", "TipoCambio"],
    "Fecha Pago": ["Fecha Pago", "fecha_pago", "Fecha"],
    "Prioridad": ["Prioridad", "prioridad"],
    "Banco": ["Banco", "banco"],
    "Cuenta Bancaria": ["Cuenta Bancaria", "Cuenta", "cuenta_bancaria"],
    "Numero Cheque": ["Numero Cheque", "Número Cheque", "No Cheque"],
  },
  movimientos: {
    "Empresa": ["Empresa", "empresa", "EMPRESA"],
    "Fecha": ["Fecha", "fecha"],
    "Tipo": ["Tipo", "tipo"],
    "Descripcion": ["Descripcion", "Descripción", "Concepto"],
    "Monto": ["Monto", "monto"],
    "Moneda": ["Moneda", "moneda"],
    "Referencia": ["Referencia", "referencia"],
  },
  planillas: {
    "Empresa": ["Empresa", "empresa", "EMPRESA"],
    "Empleado": ["Empleado", "empleado"],
    "DPI": ["DPI", "dpi"],
    "Puesto": ["Puesto", "puesto"],
    "Sueldo Base": ["Sueldo Base", "sueldo_base"],
    "Bonificacion": ["Bonificacion", "Bonificación"],
    "Descuentos": ["Descuentos", "descuentos"],
    "ISR": ["ISR", "isr"],
    "IGSS": ["IGSS", "igss"],
    "Total Pagar": ["Total Pagar", "total_pagar"],
    "Fecha": ["Fecha", "fecha"],
    "Moneda": ["Moneda", "moneda"],
  },
};

export default function ImportacionesPage() {
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoImportaciones, setCargandoImportaciones] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [rolActual, setRolActual] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [fondos, setFondos] = useState<FondoEmpresa[]>([]);
  const [chequeras, setChequeras] = useState<Chequera[]>([]);
  const [chequesFisicos, setChequesFisicos] = useState<ChequeFisico[]>([]);
  const [catalogosChequesCargados, setCatalogosChequesCargados] = useState(false);

  const [tipo, setTipo] = useState<TipoImportacion>("proveedores");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [archivoHash, setArchivoHash] = useState("");
  const [columnasArchivo, setColumnasArchivo] = useState<string[]>([]);
  const [preview, setPreview] = useState<FilaPreview[]>([]);

  const configActual = useMemo(
    () => TIPOS_IMPORTACION.find((t) => t.value === tipo)!,
    [tipo]
  );

  const filasValidas = preview.filter((f) => f.valido);
  const filasConError = preview.filter((f) => !f.valido);

  async function registrarIntentoImportacionBloqueado(
    motivo: string,
    metadatos: Record<string, unknown>
  ) {
    const metadatosSeguros = {
      ...metadatos,
      archivo_hash: archivoHash || metadatos.archivo_hash || null,
      archivo_contenido_guardado: false,
    };

    try {
      await registrarAuditoriaEvento({
        modulo: "importaciones",
        accion: "bloquear_importacion",
        descripcion: "Intento de importacion bloqueado por limite operativo",
        sensible: true,
        origen: "modulo_importaciones",
        metadatos: {
          motivo,
          ...metadatosSeguros,
        } as ValorJsonAuditoria,
      });
    } catch (error) {
      console.warn("No se pudo auditar intento de importacion bloqueado:", error);
    }

    if (!userId) return;

    try {
      const empresaId =
        typeof metadatos.empresa_id === "number" &&
        Number.isFinite(metadatos.empresa_id)
          ? metadatos.empresa_id
          : null;

      const { error } = await supabase.from("intentos_bloqueados").insert({
        usuario_id: userId,
        empresa_id: empresaId,
        modulo: "importaciones",
        accion: "confirmar_importacion",
        motivo,
        severidad: "media",
        entidad_tipo: String(metadatos.tipo_importacion || tipo),
        mensaje: "Intento de importacion bloqueado por validacion operativa.",
        metadatos: metadatosSeguros,
      });

      if (error) {
        console.warn("No se pudo registrar intento bloqueado de importacion:", error.message);
      }
    } catch (error) {
      console.warn("Intento bloqueado de importacion no persistido:", error);
    }
  }

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    try {
      setValidandoAcceso(true);
      setCargandoImportaciones(false);

      const acceso = await validarAccesoModuloUsuario("importaciones");

      if (!acceso.ok) {
        if (
          acceso.motivo === "sin_sesion" ||
          acceso.motivo === "usuario_inactivo" ||
          acceso.motivo === "sin_perfil"
        ) {
          toast.error("Sesión no válida");
          window.location.href = "/login";
          return;
        }

        if (
          acceso.motivo === "modulo_inactivo" ||
          acceso.motivo === "modulo_no_encontrado"
        ) {
          toast.error("El módulo de Importaciones está desactivado.");
          window.location.href = "/dashboard";
          return;
        }

        toast.error("No tienes acceso al módulo de Importaciones.");
        window.location.href = "/dashboard";
        return;
      }

      const user = acceso.user!;
      const perfil = acceso.perfil!;

      setAutorizado(true);
      setValidandoAcceso(false);
      setCargandoImportaciones(true);
      setUserId(user.id);
      setRolActual(perfil.rol || "");

      const idsPermitidos = await obtenerEmpresasPermitidas(
        user.id,
        perfil.rol || ""
      );

      setEmpresasPermitidasIds(idsPermitidos);

      if (!idsPermitidos.length) {
        setEmpresas([]);
        return;
      }

      const { data, error } = await supabase
        .from("empresas")
        .select("id,nombre,estado,razon_social,nombre_comercial")
        .in("id", idsPermitidos)
        .order("nombre", { ascending: true });

      if (error) throw error;

      setEmpresas(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error cargando importaciones");
    } finally {
      setCargandoImportaciones(false);
    }
  }

  async function cargarDatosCheques(idsPermitidos: number[]) {
    if (!idsPermitidos.length) {
      setFondos([]);
      setChequeras([]);
      setChequesFisicos([]);
      setCatalogosChequesCargados(true);
      return { fondos: [], chequeras: [], chequesFisicos: [] };
    }

    const [fondosRes, chequerasRes, chequesFisicosRes] = await Promise.all([
      supabase
        .from("fondos_empresa")
        .select("*")
        .in("empresa_id", idsPermitidos)
        .neq("estado", "Inactiva"),

      supabase
        .from("chequeras")
        .select("*")
        .in("empresa_id", idsPermitidos)
        .eq("estado", "Activa"),

      supabase
        .from("cheques_fisicos")
        .select("*")
        .in("empresa_id", idsPermitidos)
        .eq("estado", "Disponible"),
    ]);

    if (fondosRes.error) throw fondosRes.error;
    if (chequerasRes.error) throw chequerasRes.error;
    if (chequesFisicosRes.error) throw chequesFisicosRes.error;

    const nuevosFondos = fondosRes.data || [];
    const nuevasChequeras = chequerasRes.data || [];
    const nuevosChequesFisicos = chequesFisicosRes.data || [];

    setFondos(nuevosFondos);
    setChequeras(nuevasChequeras);
    setChequesFisicos(nuevosChequesFisicos);
    setCatalogosChequesCargados(true);

    return {
      fondos: nuevosFondos,
      chequeras: nuevasChequeras,
      chequesFisicos: nuevosChequesFisicos,
    };
  }

  async function asegurarDatosCheques() {
    if (catalogosChequesCargados) {
      return { fondos, chequeras, chequesFisicos };
    }

    setCargandoCatalogos(true);

    try {
      return await cargarDatosCheques(empresasPermitidasIds);
    } finally {
      setCargandoCatalogos(false);
    }
  }

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

  function normalizarClave(valor: unknown) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function extensionArchivo(nombre: string) {
    const limpio = nombre.trim().toLowerCase();
    const punto = limpio.lastIndexOf(".");
    return punto >= 0 ? limpio.slice(punto) : "";
  }

  async function calcularHashArchivo(buffer: ArrayBuffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function columnasPermitidasParaTipo(tipoImportacion: TipoImportacion) {
    return new Set(
      Object.values(ALIAS_COLUMNAS[tipoImportacion])
        .flat()
        .map(normalizarClave)
    );
  }

  function columnaPresente(columnas: string[], tipoImportacion: TipoImportacion, columna: string) {
    const columnasNormalizadas = new Set(columnas.map(normalizarClave));
    const aliases = ALIAS_COLUMNAS[tipoImportacion][columna] || [columna];
    return aliases.some((alias) => columnasNormalizadas.has(normalizarClave(alias)));
  }

  function validarColumnasArchivo(columnas: string[], tipoImportacion: TipoImportacion) {
    const columnasLimpias = columnas.map((columna) => columna.trim()).filter(Boolean);
    const permitidas = columnasPermitidasParaTipo(tipoImportacion);
    const faltantes = COLUMNAS_OBLIGATORIAS[tipoImportacion].filter(
      (columna) => !columnaPresente(columnasLimpias, tipoImportacion, columna)
    );
    const sobrantes = columnasLimpias.filter(
      (columna) => !permitidas.has(normalizarClave(columna))
    );

    return { faltantes, sobrantes };
  }

  function limpiarTexto(valor: any) {
    return String(valor ?? "").trim();
  }

  function leerCampo(fila: any, nombres: string[]) {
    for (const nombre of nombres) {
      if (fila[nombre] !== undefined && fila[nombre] !== null) {
        return fila[nombre];
      }
    }
    return "";
  }

  function leerNumero(fila: any, nombres: string[]) {
    const valor = leerCampo(fila, nombres);
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }

  function leerFecha(fila: any, nombres: string[]) {
    const valor = leerCampo(fila, nombres);

    if (!valor) {
      return new Date().toISOString().split("T")[0];
    }

    if (valor instanceof Date) {
      return valor.toISOString().split("T")[0];
    }

    if (typeof valor === "number") {
      const fecha = XLSX.SSF.parse_date_code(valor);
      if (fecha) {
        const yyyy = fecha.y;
        const mm = String(fecha.m).padStart(2, "0");
        const dd = String(fecha.d).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    const texto = String(valor).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      return texto;
    }

    const fecha = new Date(texto);
    if (!Number.isNaN(fecha.getTime())) {
      return fecha.toISOString().split("T")[0];
    }

    return "";
  }

  function buscarEmpresa(nombreEmpresa: string) {
    const normalizado = normalizarClave(nombreEmpresa);

    return empresas.find(
      (empresa) => normalizarClave(empresa.nombre) === normalizado
    );
  }

  function validarEmpresa(nombreEmpresa: string, errores: string[]) {
    if (!nombreEmpresa) {
      errores.push("Falta empresa");
      return null;
    }

    const empresa = buscarEmpresa(nombreEmpresa);

    if (!empresa) {
      errores.push(`Empresa no encontrada: ${nombreEmpresa}`);
      return null;
    }

    if (!empresasPermitidasIds.includes(Number(empresa.id))) {
      errores.push(`Empresa no permitida para tu usuario: ${nombreEmpresa}`);
      return null;
    }

    if (!esEstadoOperativo(empresa.estado)) {
      errores.push(`Empresa inactiva o archivada: ${nombreEmpresa}`);
      return null;
    }

    if (esEmpresaDePrueba(empresa)) {
      errores.push(`No se permite importar a empresas de prueba/demo: ${nombreEmpresa}`);
      return null;
    }

    return empresa;
  }

  function normalizarMoneda(valor: any) {
    const moneda = limpiarTexto(valor || "GTQ").toUpperCase();
    return moneda === "USD" ? "USD" : "GTQ";
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

  function transformarFila(
    tipoImportacion: TipoImportacion,
    fila: any,
    indice: number,
    catalogosCheques?: {
      fondos: FondoEmpresa[];
      chequesFisicos: ChequeFisico[];
    }
  ): FilaPreview {
    const errores: string[] = [];

    const nombreEmpresa = limpiarTexto(
      leerCampo(fila, ["Empresa", "empresa", "EMPRESA"])
    );

    const empresa = validarEmpresa(nombreEmpresa, errores);

    if (tipoImportacion === "proveedores") {
      const nombre = limpiarTexto(
        leerCampo(fila, [
          "Nombre Proveedor",
          "Proveedor",
          "proveedor",
          "Nombre",
          "nombre",
        ])
      );

      if (!nombre) errores.push("Falta nombre del proveedor");
      const nit = limpiarTexto(leerCampo(fila, ["NIT", "nit"]));
      if (!nit) errores.push("Falta NIT del proveedor");

      return {
        fila: indice + 2,
        valido: errores.length === 0,
        errores,
        data: {
          empresa_id: empresa?.id || null,
          empresa: empresa?.nombre || nombreEmpresa,
          nombre,
          nit: nit || null,
          telefono:
            limpiarTexto(leerCampo(fila, ["Telefono", "Teléfono", "telefono"])) ||
            null,
          correo: limpiarTexto(leerCampo(fila, ["Correo", "correo", "Email"])) || null,
          direccion:
            limpiarTexto(leerCampo(fila, ["Direccion", "Dirección", "direccion"])) ||
            null,
          banco: limpiarTexto(leerCampo(fila, ["Banco", "banco"])) || null,
          cuenta_bancaria:
            limpiarTexto(
              leerCampo(fila, ["Cuenta Bancaria", "Cuenta", "cuenta_bancaria"])
            ) || null,
          moneda: normalizarMoneda(leerCampo(fila, ["Moneda", "moneda"])),
          estado: "Activo",
        },
      };
    }

    if (tipoImportacion === "ordenes_compra") {
      const proveedor = limpiarTexto(
        leerCampo(fila, ["Proveedor", "proveedor", "Beneficiario"])
      );

      const total =
        leerNumero(fila, ["Total", "total"]) ||
        leerNumero(fila, ["Cantidad", "cantidad"]) *
          leerNumero(fila, ["Precio Unitario", "precio_unitario"]);

      if (!proveedor) errores.push("Falta proveedor");
      if (total <= 0) errores.push("Total inválido");

      return {
        fila: indice + 2,
        valido: errores.length === 0,
        errores,
        data: {
          empresa_id: empresa?.id || null,
          empresa: empresa?.nombre || nombreEmpresa,
          proveedor,
          numero_orden:
            limpiarTexto(leerCampo(fila, ["Numero Orden", "Número Orden", "OC"])) ||
            null,
          fecha_orden: leerFecha(fila, ["Fecha Orden", "fecha_orden"]),
          fecha_documento: leerFecha(fila, [
            "Fecha Documento",
            "fecha_documento",
          ]),
          fecha_factura: leerFecha(fila, ["Fecha Factura", "fecha_factura"]),
          numero_factura:
            limpiarTexto(
              leerCampo(fila, ["Numero Factura", "Número Factura", "Factura"])
            ) || null,
          descripcion:
            limpiarTexto(
              leerCampo(fila, ["Descripcion", "Descripción", "Concepto"])
            ) || null,
          cantidad: leerNumero(fila, ["Cantidad", "cantidad"]) || 1,
          precio_unitario: leerNumero(fila, [
            "Precio Unitario",
            "precio_unitario",
          ]),
          total,
          moneda: normalizarMoneda(leerCampo(fila, ["Moneda", "moneda"])),
          estado: "Pendiente",
        },
      };
    }

if (tipoImportacion === "cheques") {
  const fondosDisponibles = catalogosCheques?.fondos || fondos;
  const chequesFisicosDisponibles =
    catalogosCheques?.chequesFisicos || chequesFisicos;
  const beneficiario = limpiarTexto(
    leerCampo(fila, ["Beneficiario", "beneficiario", "Proveedor"])
  );

  const concepto = limpiarTexto(
    leerCampo(fila, ["Concepto", "Descripcion", "Descripción"])
  );

  const monto = leerNumero(fila, ["Monto", "monto"]);
  const tipoCambio = leerNumero(fila, [
  "Tipo Cambio",
  "tipo_cambio",
  "TipoCambio",
]);

const montoGtq = tipoCambio > 0 ? monto * tipoCambio : monto;

  const fechaPago = leerFecha(fila, ["Fecha Pago", "fecha_pago", "Fecha"]);

  const prioridad =
    limpiarTexto(leerCampo(fila, ["Prioridad", "prioridad"])) || "Media";

  const formaPago =
    limpiarTexto(leerCampo(fila, ["Forma Pago", "forma_pago"])) ||
    "Cheque";

  const moneda = normalizarMoneda(leerCampo(fila, ["Moneda", "moneda"]));

  const bancoExcel =
    limpiarTexto(leerCampo(fila, ["Banco", "banco"])) || null;

  const cuentaExcel =
    limpiarTexto(
      leerCampo(fila, ["Cuenta Bancaria", "Cuenta", "cuenta_bancaria"])
    ) || null;

  const numeroChequeExcel =
    limpiarTexto(
      leerCampo(fila, ["Numero Cheque", "Número Cheque", "No Cheque"])
    ) || null;

  let fondoEmpresaId: number | null = null;
  let chequeraId: number | null = null;
  let chequeFisicoId: number | null = null;
  let bancoFinal = bancoExcel;
  let cuentaFinal = cuentaExcel;

  if (!beneficiario) errores.push("Falta beneficiario");
  if (!concepto) errores.push("Falta concepto");
  if (monto <= 0) errores.push("Monto inválido");
  if (!fechaPago) errores.push("Fecha de pago inválida");

  if (formaPago.trim().toLowerCase() === "cheque") {
    if (!numeroChequeExcel) errores.push("Falta número de cheque");
    if (!bancoExcel) errores.push("Falta banco");
    if (!cuentaExcel) errores.push("Falta cuenta bancaria");

    if (empresa && numeroChequeExcel) {
      const fondoEncontrado = fondosDisponibles.find((fondo) => {
        const mismaEmpresa = Number(fondo.empresa_id) === Number(empresa.id);
        const mismaMoneda = fondo.moneda === moneda;
        const mismaCuenta =
          String(fondo.cuenta_bancaria || "").trim().toLowerCase() ===
          String(cuentaExcel || "").trim().toLowerCase();

        const mismoBanco = bancoExcel
          ? String(fondo.banco || "").trim().toLowerCase() ===
            String(bancoExcel).trim().toLowerCase()
          : true;

        return mismaEmpresa && mismaMoneda && mismaCuenta && mismoBanco;
      });

      if (!fondoEncontrado) {
        errores.push(
          `No se encontró fondo/cuenta para ${bancoExcel} ${cuentaExcel} ${moneda}`
        );
      } else {
        fondoEmpresaId = fondoEncontrado.id;
        bancoFinal = fondoEncontrado.banco || bancoExcel;
        cuentaFinal = fondoEncontrado.cuenta_bancaria || cuentaExcel;
      }

      const chequeFisicoEncontrado = chequesFisicosDisponibles.find((cf) => {
        const mismoNumero =
          Number(cf.numero_cheque) === Number(numeroChequeExcel);

        const mismaEmpresa = Number(cf.empresa_id) === Number(empresa.id);
        const mismaMoneda = cf.moneda === moneda;
        const disponible = cf.estado === "Disponible";

        const mismoFondo = fondoEmpresaId
          ? Number(cf.fondo_empresa_id) === Number(fondoEmpresaId)
          : true;

        return (
          mismoNumero &&
          mismaEmpresa &&
          mismaMoneda &&
          disponible &&
          mismoFondo
        );
      });

      if (!chequeFisicoEncontrado) {
        errores.push(
          `Cheque físico No. ${numeroChequeExcel} no existe o no está disponible`
        );
      } else {
        chequeFisicoId = chequeFisicoEncontrado.id;
        chequeraId = chequeFisicoEncontrado.chequera_id;
        fondoEmpresaId =
          chequeFisicoEncontrado.fondo_empresa_id || fondoEmpresaId;
        bancoFinal = chequeFisicoEncontrado.banco || bancoFinal;
        cuentaFinal = chequeFisicoEncontrado.cuenta_bancaria || cuentaFinal;
      }
    }
  }

  return {
    fila: indice + 2,
    valido: errores.length === 0,
    errores,
    data: {
      empresa_id: empresa?.id || null,
      empresa: empresa?.nombre || nombreEmpresa,

      fondo_empresa_id: fondoEmpresaId,
      chequera_id: chequeraId,
      cheque_fisico_id: chequeFisicoId,

      numero_cheque: numeroChequeExcel,
      banco: bancoFinal,
      cuenta_bancaria: cuentaFinal,

      beneficiario,
      concepto,
      monto,
      tipo_cambio: tipoCambio > 0 ? tipoCambio : null,
monto_gtq: montoGtq,

      tipo_pago:
        limpiarTexto(leerCampo(fila, ["Tipo Pago", "tipo_pago"])) ||
        "Proveedor",

      forma_pago: formaPago,
      moneda,
      prioridad,
      fecha_pago: fechaPago,

      fecha_limite_autorizacion: calcularLimiteAutorizacion(
        fechaPago,
        prioridad
      ),

      estado: "Pendiente de autorización",
      estado_fondo: "sin_comprometer",
      creado_por: userId,
      responsable_actual: null,
      enviado_at: new Date().toISOString(),
      movimiento_generado: false,
    },
  };
}

    if (tipoImportacion === "movimientos") {
      const tipoMovimiento =
        limpiarTexto(leerCampo(fila, ["Tipo", "tipo"])) || "Egreso";
      const descripcion = limpiarTexto(
        leerCampo(fila, ["Descripcion", "Descripción", "Concepto"])
      );
      const monto = leerNumero(fila, ["Monto", "monto"]);
      const fecha = leerFecha(fila, ["Fecha", "fecha"]);

      if (!descripcion) errores.push("Falta descripción");
      if (monto <= 0) errores.push("Monto inválido");
      if (!fecha) errores.push("Fecha inválida");

      return {
        fila: indice + 2,
        valido: errores.length === 0,
        errores,
        data: {
          empresa_id: empresa?.id || null,
          empresa: empresa?.nombre || nombreEmpresa,
          tipo: tipoMovimiento,
          descripcion,
          monto,
          moneda: normalizarMoneda(leerCampo(fila, ["Moneda", "moneda"])),
          fecha,
          estado: "activo",
          creado_por: userId,
          referencia:
            limpiarTexto(leerCampo(fila, ["Referencia", "referencia"])) || null,
        },
      };
    }

    const empleado = limpiarTexto(leerCampo(fila, ["Empleado", "empleado"]));
    const totalPagar = leerNumero(fila, ["Total Pagar", "total_pagar"]);

    if (!empleado) errores.push("Falta empleado");
    if (totalPagar <= 0) errores.push("Total a pagar inválido");

    return {
      fila: indice + 2,
      valido: errores.length === 0,
      errores,
      data: {
        empresa_id: empresa?.id || null,
        empresa: empresa?.nombre || nombreEmpresa,
        empleado,
        dpi: limpiarTexto(leerCampo(fila, ["DPI", "dpi"])) || null,
        puesto: limpiarTexto(leerCampo(fila, ["Puesto", "puesto"])) || null,
        sueldo_base: leerNumero(fila, ["Sueldo Base", "sueldo_base"]),
        bonificacion: leerNumero(fila, ["Bonificacion", "Bonificación"]),
        descuentos: leerNumero(fila, ["Descuentos", "descuentos"]),
        isr: leerNumero(fila, ["ISR", "isr"]),
        igss: leerNumero(fila, ["IGSS", "igss"]),
        total_pagar: totalPagar,
        fecha: leerFecha(fila, ["Fecha", "fecha"]),
        moneda: normalizarMoneda(leerCampo(fila, ["Moneda", "moneda"])),
        estado: "Pendiente",
      },
    };
  }

  async function leerExcel(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];

    if (!archivo) return;

    const extension = extensionArchivo(archivo.name);

    if (!EXTENSIONES_IMPORTACION_PERMITIDAS.includes(extension)) {
      toast.error("Formato no permitido. Usa .xlsx, .xls o .csv.");
      await registrarIntentoImportacionBloqueado("extension_no_permitida", {
        archivo: archivo.name,
        extension,
        extensiones_permitidas: EXTENSIONES_IMPORTACION_PERMITIDAS,
        tipo_importacion: tipo,
      });
      e.target.value = "";
      return;
    }

    if (archivo.size <= 0) {
      toast.error("El archivo esta vacio.");
      await registrarIntentoImportacionBloqueado("archivo_vacio", {
        archivo: archivo.name,
        bytes: archivo.size,
        tipo_importacion: tipo,
      });
      e.target.value = "";
      return;
    }

    if (archivo.size > IMPORTACION_MAX_BYTES) {
      toast.error("El archivo supera el limite de 5 MB.");
      await registrarIntentoImportacionBloqueado("archivo_excede_tamano", {
        archivo: archivo.name,
        bytes: archivo.size,
        limite_bytes: IMPORTACION_MAX_BYTES,
        tipo_importacion: tipo,
      });
      e.target.value = "";
      return;
    }

    setNombreArchivo(archivo.name);
    setArchivoHash("");
    setColumnasArchivo([]);
    setPreview([]);

    try {
      const buffer = await archivo.arrayBuffer();
      const hash = await calcularHashArchivo(buffer);
      setArchivoHash(hash);

      const catalogosCheques =
        tipo === "cheques" ? await asegurarDatosCheques() : undefined;
      const workbook = XLSX.read(buffer, { type: "array" });

      if (!workbook.SheetNames.length) {
        toast.error("El archivo no contiene hojas validas.");
        await registrarIntentoImportacionBloqueado("archivo_sin_hojas_validas", {
          archivo: archivo.name,
          archivo_hash: hash,
          tipo_importacion: tipo,
        });
        setNombreArchivo("");
        e.target.value = "";
        return;
      }

      const hoja = workbook.Sheets[workbook.SheetNames[0]];

      if (!hoja || !hoja["!ref"]) {
        toast.error("La primera hoja no contiene datos validos.");
        await registrarIntentoImportacionBloqueado("hoja_sin_datos_validos", {
          archivo: archivo.name,
          archivo_hash: hash,
          tipo_importacion: tipo,
        });
        setNombreArchivo("");
        e.target.value = "";
        return;
      }

      const filas: any[] = XLSX.utils.sheet_to_json(hoja, {
        defval: "",
      });
      const columnas = filas.length ? Object.keys(filas[0]) : [];
      setColumnasArchivo(columnas);

      const columnasInvalidas = validarColumnasArchivo(columnas, tipo);

      if (columnasInvalidas.faltantes.length || columnasInvalidas.sobrantes.length) {
        const partes = [
          columnasInvalidas.faltantes.length
            ? `Faltan: ${columnasInvalidas.faltantes.join(", ")}`
            : "",
          columnasInvalidas.sobrantes.length
            ? `Sobran/no reconocidas: ${columnasInvalidas.sobrantes.join(", ")}`
            : "",
        ].filter(Boolean);

        toast.error(`Columnas invalidas. ${partes.join(". ")}`);
        await registrarIntentoImportacionBloqueado("columnas_invalidas", {
          archivo: archivo.name,
          archivo_hash: hash,
          tipo_importacion: tipo,
          columnas_faltantes: columnasInvalidas.faltantes,
          columnas_sobrantes: columnasInvalidas.sobrantes,
        });
        setNombreArchivo("");
        setPreview([]);
        e.target.value = "";
        return;
      }

      if (!filas.length) {
        toast.error("El archivo esta vacio.");
        await registrarIntentoImportacionBloqueado("archivo_sin_filas", {
          archivo: archivo.name,
          archivo_hash: hash,
          tipo_importacion: tipo,
        });
        setNombreArchivo("");
        e.target.value = "";
        return;
      }

      if (filas.length > IMPORTACION_MAX_FILAS) {
        toast.error(`El archivo supera el limite de ${IMPORTACION_MAX_FILAS} filas.`);
        await registrarIntentoImportacionBloqueado("archivo_excede_filas", {
          archivo: archivo.name,
          archivo_hash: hash,
          filas: filas.length,
          limite_filas: IMPORTACION_MAX_FILAS,
          tipo_importacion: tipo,
        });
        setNombreArchivo("");
        e.target.value = "";
        return;
      }

      const resultado = filas.map((fila, index) =>
        transformarFila(tipo, fila, index, catalogosCheques)
      );

      setPreview(resultado);
      toast.success("Archivo leido correctamente");
    } catch (error: any) {
      console.error("Error leyendo archivo de importacion:", error?.message || error);
      toast.error(error.message || "Error leyendo Excel");
    }
  }

  function idempotencyKeyImportacion(hash = archivoHash) {
    return `${IDEMPOTENCY_PREFIX_IMPORTACIONES}:${tipo}:${hash}`;
  }

  function empresaUnicaImportacion() {
    const empresasValidas = Array.from(
      new Set(
        filasValidas
          .map((fila) => Number((fila.data as Record<string, unknown>).empresa_id))
          .filter((empresaId) =>
            Number.isInteger(empresaId) && empresasPermitidasIds.includes(empresaId)
          )
      )
    );

    return empresasValidas.length === 1 ? empresasValidas[0] : null;
  }

  async function validarRateLimitImportacion() {
    if (!userId) {
      return {
        permitido: true,
        mensaje: "",
        retry_after_segundos: 0,
        rpc_disponible: false,
      };
    }

    const empresaId = empresaUnicaImportacion();
    const resultado = await registrarRateLimitOperativo({
      usuarioId: userId,
      modulo: "importaciones",
      accion: "importar_excel",
      limite: IMPORTACION_RATE_LIMIT_MAX,
      ventanaSegundos: IMPORTACION_RATE_LIMIT_VENTANA_SEGUNDOS,
      alcance: empresaId ? "usuario_empresa" : "usuario",
      empresaId,
      claveSufijo: tipo,
      metadatos: {
        tipo_importacion: tipo,
        archivo_hash: archivoHash || null,
        archivo_nombre: nombreArchivo || null,
        filas_totales: preview.length,
        filas_validas: filasValidas.length,
        empresa_id: empresaId,
      },
    });

    if (!resultado.rpc_disponible) {
      console.warn(resultado.mensaje);
    }

    return resultado;
  }

  async function iniciarIdempotenciaImportacion() {
    if (!userId) {
      return {
        ok: false,
        mensaje: "Sesion no valida.",
        persistidaId: null as string | null,
      };
    }

    if (!archivoHash) {
      return {
        ok: false,
        mensaje: "No se pudo calcular el hash del archivo. Vuelve a cargarlo.",
        persistidaId: null as string | null,
      };
    }

    const key = idempotencyKeyImportacion();

    try {
      const { data: existente, error: consultaError } = await supabase
        .from("idempotency_keys_operativas")
        .select("id,estado,usuario_id,modulo,accion,resultado_resumen")
        .eq("idempotency_key", key)
        .maybeSingle();

      if (consultaError) throw consultaError;

      if (existente) {
        if (existente.usuario_id !== userId) {
          return {
            ok: false,
            mensaje: "Este archivo ya fue registrado por otro usuario.",
            persistidaId: String(existente.id),
          };
        }

        if (existente.modulo !== "importaciones" || existente.accion !== `importar_${tipo}`) {
          return {
            ok: false,
            mensaje: "La llave de idempotencia pertenece a otra operacion.",
            persistidaId: String(existente.id),
          };
        }

        if (existente.estado === "completada") {
          return {
            ok: false,
            mensaje: "Este archivo ya fue importado. No se repetira la carga.",
            persistidaId: String(existente.id),
            replay: true,
          };
        }

        if (existente.estado === "en_proceso") {
          return {
            ok: false,
            mensaje: "Esta importacion ya esta en proceso. Espera antes de reintentar.",
            persistidaId: String(existente.id),
          };
        }

        return {
          ok: false,
          mensaje: "Este archivo ya fue usado en una importacion previa. Revisa el historial antes de reintentar.",
          persistidaId: String(existente.id),
        };
      }

      const { data: creada, error: insertError } = await supabase
        .from("idempotency_keys_operativas")
        .insert({
          expira_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          idempotency_key: key,
          usuario_id: userId,
          empresa_id: null,
          modulo: "importaciones",
          accion: `importar_${tipo}`,
          estado: "en_proceso",
          request_hash: archivoHash,
          entidad_tipo: configActual.tabla,
          entidad_id: null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      return {
        ok: true,
        persistidaId: String(creada.id),
      };
    } catch (error) {
      console.warn("Idempotencia persistente de importaciones no disponible:", error);
      return {
        ok: true,
        persistidaId: null as string | null,
        modoTemporal: true,
      };
    }
  }

  async function completarIdempotenciaImportacion(
    persistidaId: string | null,
    resultadoResumen: Record<string, unknown>
  ) {
    if (!persistidaId) return;

    const { error } = await supabase
      .from("idempotency_keys_operativas")
      .update({
        estado: "completada",
        entidad_tipo: configActual.tabla,
        resultado_resumen: resultadoResumen,
        error_resumen: null,
      })
      .eq("id", persistidaId);

    if (error) {
      console.warn("No se pudo completar idempotencia de importacion:", error.message);
    }
  }

  async function fallarIdempotenciaImportacion(
    persistidaId: string | null,
    error: unknown
  ) {
    if (!persistidaId) return;

    const { error: updateError } = await supabase
      .from("idempotency_keys_operativas")
      .update({
        estado: "fallida",
        error_resumen:
          error instanceof Error ? error.message.slice(0, 500) : "Error no identificado",
      })
      .eq("id", persistidaId);

    if (updateError) {
      console.warn("No se pudo marcar idempotencia fallida de importacion:", updateError.message);
    }
  }

  function separarDuplicadosInternos(
    filas: FilaPreview[],
    obtenerClave: (fila: FilaPreview) => string | null
  ) {
    const vistas = new Set<string>();
    const importables: FilaPreview[] = [];
    const excluidas: FilaPreview[] = [];

    filas.forEach((fila) => {
      const clave = obtenerClave(fila);
      if (!clave) {
        importables.push(fila);
        return;
      }

      if (vistas.has(clave)) {
        excluidas.push({
          ...fila,
          valido: false,
          errores: [...fila.errores, "Duplicado dentro del archivo"],
        });
        return;
      }

      vistas.add(clave);
      importables.push(fila);
    });

    return { importables, excluidas };
  }

  async function detectarDuplicadosImportacion(filas: FilaPreview[]): Promise<ResultadoDuplicados> {
    const errores: string[] = [];
    let resultado: ResultadoDuplicados = { importables: filas, excluidas: [], errores };
    const empresasIds = Array.from(
      new Set(
        filas
          .map((fila) => Number(fila.data.empresa_id))
          .filter((empresaId) => Number.isFinite(empresaId) && empresaId > 0)
      )
    );

    if (!empresasIds.length) {
      return {
        importables: [],
        excluidas: filas.map((fila) => ({
          ...fila,
          valido: false,
          errores: [...fila.errores, "No hay empresa valida para importar"],
        })),
        errores: ["No hay empresas validas para importar."],
      };
    }

    if (tipo === "proveedores") {
      const separados = separarDuplicadosInternos(
        filas,
        (fila) => `${fila.data.empresa_id}:${normalizarClave(fila.data.nit)}`
      );
      resultado = { ...resultado, ...separados };

      const { data, error } = await supabase
        .from("proveedores")
        .select("empresa_id,nit")
        .in("empresa_id", empresasIds);

      if (error) throw error;

      const existentes = new Set(
        (data || []).map((item) => `${item.empresa_id}:${normalizarClave(item.nit)}`)
      );
      const importables = resultado.importables.filter(
        (fila) => !existentes.has(`${fila.data.empresa_id}:${normalizarClave(fila.data.nit)}`)
      );
      const excluidas = [
        ...resultado.excluidas,
        ...resultado.importables
          .filter((fila) => existentes.has(`${fila.data.empresa_id}:${normalizarClave(fila.data.nit)}`))
          .map((fila) => ({
            ...fila,
            valido: false,
            errores: [...fila.errores, "Proveedor duplicado por empresa + NIT"],
          })),
      ];

      return { importables, excluidas, errores };
    }

    if (tipo === "cheques") {
      const claveCheque = (fila: FilaPreview) => {
        if (normalizarClave(fila.data.forma_pago) !== "cheque") return null;
        return [
          fila.data.empresa_id,
          fila.data.fondo_empresa_id || "sin-fondo",
          fila.data.chequera_id || "sin-chequera",
          normalizarClave(fila.data.numero_cheque),
        ].join(":");
      };
      const separados = separarDuplicadosInternos(filas, claveCheque);
      resultado = { ...resultado, ...separados };

      const { data, error } = await supabase
        .from("cheques")
        .select("empresa_id,fondo_empresa_id,chequera_id,numero_cheque,estado")
        .in("empresa_id", empresasIds);

      if (error) throw error;

      const existentes = new Set(
        (data || [])
          .filter((item) => !["Anulado", "Rechazado"].includes(String(item.estado || "")))
          .map((item) =>
            [
              item.empresa_id,
              item.fondo_empresa_id || "sin-fondo",
              item.chequera_id || "sin-chequera",
              normalizarClave(item.numero_cheque),
            ].join(":")
          )
      );

      const importables = resultado.importables.filter((fila) => {
        const clave = claveCheque(fila);
        return !clave || !existentes.has(clave);
      });
      const excluidas = [
        ...resultado.excluidas,
        ...resultado.importables
          .filter((fila) => {
            const clave = claveCheque(fila);
            return Boolean(clave && existentes.has(clave));
          })
          .map((fila) => ({
            ...fila,
            valido: false,
            errores: [...fila.errores, "Cheque duplicado por empresa + fondo + chequera + numero"],
          })),
      ];

      return { importables, excluidas, errores };
    }

    if (tipo === "ordenes_compra") {
      const claveOrden = (fila: FilaPreview) => {
        const numeroOrden = normalizarClave(fila.data.numero_orden);
        if (numeroOrden) return `${fila.data.empresa_id}:orden:${numeroOrden}`;
        return `${fila.data.empresa_id}:factura:${normalizarClave(fila.data.proveedor)}:${normalizarClave(fila.data.numero_factura)}`;
      };
      const separados = separarDuplicadosInternos(filas, claveOrden);
      resultado = { ...resultado, ...separados };

      const { data, error } = await supabase
        .from("ordenes_compra")
        .select("empresa_id,numero_orden,numero_factura,proveedor")
        .in("empresa_id", empresasIds);

      if (error) throw error;

      const existentes = new Set(
        (data || []).flatMap((item) => {
          const claves: string[] = [];
          const numeroOrden = normalizarClave(item.numero_orden);
          const numeroFactura = normalizarClave(item.numero_factura);
          if (numeroOrden) claves.push(`${item.empresa_id}:orden:${numeroOrden}`);
          if (numeroFactura) {
            claves.push(`${item.empresa_id}:factura:${normalizarClave(item.proveedor)}:${numeroFactura}`);
          }
          return claves;
        })
      );

      const importables = resultado.importables.filter((fila) => !existentes.has(claveOrden(fila)));
      const excluidas = [
        ...resultado.excluidas,
        ...resultado.importables
          .filter((fila) => existentes.has(claveOrden(fila)))
          .map((fila) => ({
            ...fila,
            valido: false,
            errores: [...fila.errores, "Orden duplicada por numero de orden o factura/proveedor"],
          })),
      ];

      return { importables, excluidas, errores };
    }

    if (tipo === "movimientos") {
      const claveMovimiento = (fila: FilaPreview) => {
        const referencia = normalizarClave(fila.data.referencia);
        return referencia ? `${fila.data.empresa_id}:${referencia}` : null;
      };
      const separados = separarDuplicadosInternos(filas, claveMovimiento);
      resultado = { ...resultado, ...separados };

      const { data, error } = await supabase
        .from("movimientos")
        .select("empresa_id,referencia")
        .in("empresa_id", empresasIds);

      if (error) throw error;

      const existentes = new Set(
        (data || [])
          .filter((item) => normalizarClave(item.referencia))
          .map((item) => `${item.empresa_id}:${normalizarClave(item.referencia)}`)
      );
      const importables = resultado.importables.filter((fila) => {
        const clave = claveMovimiento(fila);
        return !clave || !existentes.has(clave);
      });
      const excluidas = [
        ...resultado.excluidas,
        ...resultado.importables
          .filter((fila) => {
            const clave = claveMovimiento(fila);
            return Boolean(clave && existentes.has(clave));
          })
          .map((fila) => ({
            ...fila,
            valido: false,
            errores: [...fila.errores, "Movimiento duplicado por empresa + referencia"],
          })),
      ];

      return { importables, excluidas, errores };
    }

    const clavePlanilla = (fila: FilaPreview) =>
      [
        fila.data.empresa_id,
        normalizarClave(fila.data.dpi || fila.data.empleado),
        normalizarClave(fila.data.fecha),
      ].join(":");
    const separados = separarDuplicadosInternos(filas, clavePlanilla);
    resultado = { ...resultado, ...separados };

    try {
      const { data, error } = await supabase
        .from("planillas")
        .select("empresa_id,dpi,empleado,fecha")
        .in("empresa_id", empresasIds);

      if (error) throw error;

      const existentes = new Set(
        (data || []).map((item) =>
          [
            item.empresa_id,
            normalizarClave(item.dpi || item.empleado),
            normalizarClave(item.fecha),
          ].join(":")
        )
      );
      const importables = resultado.importables.filter((fila) => !existentes.has(clavePlanilla(fila)));
      const excluidas = [
        ...resultado.excluidas,
        ...resultado.importables
          .filter((fila) => existentes.has(clavePlanilla(fila)))
          .map((fila) => ({
            ...fila,
            valido: false,
            errores: [...fila.errores, "Planilla duplicada por empleado/DPI + fecha"],
          })),
      ];

      return { importables, excluidas, errores };
    } catch (error) {
      console.warn("No se pudo validar duplicados de planillas:", error);
      return resultado;
    }
  }

  async function registrarAuditoriaImportacion(
    filasInsertadas: FilaPreview[],
    resultado: "confirmada" | "parcial" = "confirmada",
    opciones: {
      filasExcluidas?: FilaPreview[];
      erroresResumen?: string[];
      idempotencyKey?: string | null;
    } = {}
  ) {
    const empresasAfectadas = Array.from(
      new Set(
        filasInsertadas
          .map((fila) => Number(fila.data.empresa_id))
          .filter((empresaId) => Number.isFinite(empresaId) && empresaId > 0)
      )
    );

    try {
      await registrarAuditoriaEvento({
        empresa_id: empresasAfectadas.length === 1 ? empresasAfectadas[0] : null,
        modulo: "importaciones",
        accion:
          resultado === "confirmada"
            ? "confirmar_importacion"
            : "importacion_parcial",
        entidad_tipo: configActual.tabla,
        descripcion:
          resultado === "confirmada"
            ? "Importación confirmada"
            : "Importación ejecutada parcialmente",
        sensible: true,
        visible_usuario: true,
        origen: "modulo_importaciones",
        metadatos: {
          tipo_importacion: tipo,
          tabla_afectada: configActual.tabla,
          resultado,
          empresas_afectadas: empresasAfectadas,
          filas_totales: preview.length,
          filas_exitosas: filasInsertadas.length,
          filas_insertadas: filasInsertadas.length,
          filas_con_error: filasConError.length,
          filas_excluidas: opciones.filasExcluidas?.length || 0,
          filas_pendientes_ejecucion:
            resultado === "parcial"
              ? Math.max(filasValidas.length - filasInsertadas.length, 0)
              : 0,
          archivo_origen: nombreArchivo || null,
          archivo_hash: archivoHash || null,
          idempotency_key: opciones.idempotencyKey || null,
          columnas_configuradas: configActual.columnas,
          columnas_detectadas: columnasArchivo,
          resumen_errores:
            opciones.erroresResumen?.length
              ? opciones.erroresResumen.slice(0, 20)
              : filasConError.length > 0
                ? ["Se excluyeron filas por errores de validacion."]
                : null,
          contenido_excel_guardado: false,
        },
      });

      return true;
    } catch (auditoriaError) {
      console.error(
        "La importación fue ejecutada, pero no se pudo registrar la auditoría:",
        auditoriaError
      );
      return false;
    }
  }

async function confirmarImportacion() {
  if (procesando) {
    toast.error("Ya hay una importacion en proceso.");
    return;
  }

  if (!userId) {
    toast.error("Sesion no valida");
    return;
  }

  if (!filasValidas.length) {
    toast.error("No hay filas validas para importar");
    return;
  }

  if (!archivoHash) {
    toast.error("Vuelve a cargar el archivo para calcular su hash de seguridad.");
    return;
  }

  const importacionActiva = window.localStorage.getItem(IMPORTACION_ACTIVA_KEY);
  if (importacionActiva && importacionActiva !== userId) {
    toast.error("Hay una importacion activa en este navegador.");
    await registrarIntentoImportacionBloqueado("importacion_activa_en_navegador", {
      tipo_importacion: tipo,
      usuario_actual: userId,
      archivo_hash: archivoHash,
    });
    return;
  }

  const rateLimit = await validarRateLimitImportacion();

  if (!rateLimit.permitido) {
    await registrarIntentoImportacionBloqueado("rate_limit_excedido", {
      tipo_importacion: tipo,
      archivo: nombreArchivo || null,
      archivo_hash: archivoHash,
      filas_totales: preview.length,
      filas_validas: filasValidas.length,
      retry_after_segundos: rateLimit.retry_after_segundos,
      rpc_registro_intento_bloqueado: rateLimit.rpc_disponible,
    });
    toast.error(rateLimit.mensaje || "Demasiados intentos. Espera antes de reintentar.");
    return;
  }

  const idempotency = await iniciarIdempotenciaImportacion();

  if (!idempotency.ok) {
    await registrarIntentoImportacionBloqueado("idempotencia_bloqueada", {
      tipo_importacion: tipo,
      archivo: nombreArchivo || null,
      archivo_hash: archivoHash,
      mensaje: idempotency.mensaje,
    });
    toast.error(idempotency.mensaje || "No se puede repetir esta importacion.");
    return;
  }

  window.localStorage.setItem(IMPORTACION_ACTIVA_KEY, userId);
  setProcesando(true);
  const toastId = toast.loading("Importando datos...");
  let operacionFinalizada = false;

  try {
    const tabla = configActual.tabla;
    const duplicados = await detectarDuplicadosImportacion(filasValidas);
    const filasParaImportar = duplicados.importables;
    const filasExcluidas = duplicados.excluidas;
    const erroresResumen = [
      ...duplicados.errores,
      ...filasExcluidas.slice(0, 20).map((fila) =>
        `Fila ${fila.fila}: ${fila.errores.join("; ")}`
      ),
    ];

    if (!filasParaImportar.length) {
      await registrarIntentoImportacionBloqueado("importacion_sin_filas_insertables", {
        tipo_importacion: tipo,
        archivo: nombreArchivo || null,
        archivo_hash: archivoHash,
        filas_totales: preview.length,
        filas_validas: filasValidas.length,
        filas_excluidas: filasExcluidas.length,
        errores_resumen: erroresResumen.slice(0, 20),
      });
      await fallarIdempotenciaImportacion(
        idempotency.persistidaId,
        new Error("La importacion no tiene filas insertables.")
      );
      toast.error("No hay filas insertables. Todas fueron excluidas por duplicados o validaciones.", {
        id: toastId,
      });
      return;
    }

    if (tipo === "cheques") {
      const filasImportadas: FilaPreview[] = [];

      try {
        for (const fila of filasParaImportar) {
          const registro = fila.data;

          const { data, error } = await supabase
            .from("cheques")
            .insert([registro])
            .select()
            .single();

          if (error) throw error;

          filasImportadas.push(fila);

          if (
            String(registro.forma_pago || "").trim().toLowerCase() ===
              "cheque" &&
            registro.cheque_fisico_id
          ) {
            const { error: chequeFisicoError } = await supabase
              .from("cheques_fisicos")
              .update({
                estado: "Reservado",
                cheque_pago_id: data.id,
              })
              .eq("id", Number(registro.cheque_fisico_id))
              .eq("estado", "Disponible");

            if (chequeFisicoError) throw chequeFisicoError;
          }
        }
      } catch (error) {
        if (filasImportadas.length > 0) {
          await registrarAuditoriaImportacion(filasImportadas, "parcial", {
            filasExcluidas,
            erroresResumen,
            idempotencyKey: idempotencyKeyImportacion(),
          });
        }

        throw error;
      }

      const resultadoAuditoria = filasExcluidas.length ? "parcial" : "confirmada";
      const auditoriaRegistrada = await registrarAuditoriaImportacion(
        filasImportadas,
        resultadoAuditoria,
        {
          filasExcluidas,
          erroresResumen,
          idempotencyKey: idempotencyKeyImportacion(),
        }
      );

      await completarIdempotenciaImportacion(idempotency.persistidaId, {
        tipo_importacion: tipo,
        archivo_hash: archivoHash,
        filas_totales: preview.length,
        filas_insertadas: filasImportadas.length,
        filas_excluidas: filasExcluidas.length,
        resultado: resultadoAuditoria,
      });
      operacionFinalizada = true;

      await cargarDatosCheques(empresasPermitidasIds);

      if (auditoriaRegistrada) {
        toast.success(
          `Se importaron ${filasImportadas.length} cheques / pagos${filasExcluidas.length ? `; ${filasExcluidas.length} excluidos` : ""}`,
          { id: toastId }
        );
      } else {
        toast.error(
          "Cheques importados, pero no se pudo registrar la auditoria.",
          { id: toastId }
        );
      }

      setPreview([]);
      setNombreArchivo("");
      setArchivoHash("");
      setColumnasArchivo([]);
      return;
    }

    const registros = filasParaImportar.map((fila) => fila.data);

    const { error } = await supabase.from(tabla).insert(registros);

    if (error) throw error;

    const resultadoAuditoria = filasExcluidas.length ? "parcial" : "confirmada";
    const auditoriaRegistrada = await registrarAuditoriaImportacion(
      filasParaImportar,
      resultadoAuditoria,
      {
        filasExcluidas,
        erroresResumen,
        idempotencyKey: idempotencyKeyImportacion(),
      }
    );

    await completarIdempotenciaImportacion(idempotency.persistidaId, {
      tipo_importacion: tipo,
      archivo_hash: archivoHash,
      filas_totales: preview.length,
      filas_insertadas: filasParaImportar.length,
      filas_excluidas: filasExcluidas.length,
      resultado: resultadoAuditoria,
    });
    operacionFinalizada = true;

    if (auditoriaRegistrada) {
      toast.success(
        `Se importaron ${filasParaImportar.length} registros en ${configActual.label}${filasExcluidas.length ? `; ${filasExcluidas.length} excluidos` : ""}`,
        { id: toastId }
      );
    } else {
      toast.error(
        "Datos importados, pero no se pudo registrar la auditoria.",
        { id: toastId }
      );
    }

    setPreview([]);
    setNombreArchivo("");
    setArchivoHash("");
    setColumnasArchivo([]);
  } catch (error: any) {
    console.error("Error confirmando importacion:", error?.message || error);
    if (!operacionFinalizada) {
      await fallarIdempotenciaImportacion(idempotency.persistidaId, error);
    }
    toast.error(error.message || "Error importando datos", { id: toastId });
  } finally {
    window.localStorage.removeItem(IMPORTACION_ACTIVA_KEY);
    setProcesando(false);
  }
}

  function descargarPlantilla() {
    const columnas = configActual.columnas;
    const ejemplo: Record<string, any> = {};

    columnas.forEach((columna) => {
      ejemplo[columna] = "";
    });

    ejemplo.Empresa = empresas[0]?.nombre || "Nombre exacto de la empresa";

    const hoja = XLSX.utils.json_to_sheet([ejemplo]);
    const libro = XLSX.utils.book_new();

   const nombreHoja = configActual.label
  .replace(/[:\\/?*\[\]]/g, "-")
  .slice(0, 31);

XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
XLSX.writeFile(libro, `plantilla_${tipo}.xlsx`);
  }

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
          <header className="mb-8">
            <h1 className="text-5xl font-black tracking-tight">
              Importaciones
            </h1>
            <p className="text-gray-400 mt-2">
              Carga masiva desde Excel para proveedores, órdenes, cheques,
              contabilidad y planillas.
            </p>
          </header>

          {cargandoImportaciones ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando empresas permitidas...
            </section>
          ) : (
            <>
          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8 border-l-4 border-l-cyan-500">
            <h2 className="text-sm font-bold mb-6 text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Upload size={16} className="text-cyan-500" />
              Fase 1 y 2: seleccionar tipo y subir Excel
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              <select
                value={tipo}
                onChange={(e) => {
                  const nuevoTipo = e.target.value as TipoImportacion;

                  setTipo(nuevoTipo);
                  setPreview([]);
                  setNombreArchivo("");

                  if (nuevoTipo === "cheques") {
                    asegurarDatosCheques().catch((error) => {
                      console.error(error);
                      toast.error("Error cargando catálogos de cheques");
                    });
                  }
                }}
                className="input-custom"
              >
                {TIPOS_IMPORTACION.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <button
                onClick={descargarPlantilla}
                className="bg-white/10 hover:bg-white/20 text-white font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2"
              >
                <FileSpreadsheet size={16} />
                Descargar plantilla
              </button>

              <label
                className={`bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all h-[3.5rem] uppercase text-xs flex items-center justify-center gap-2 ${
                  cargandoCatalogos
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <Upload size={16} />
                Subir Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={leerExcel}
                  disabled={cargandoCatalogos}
                  className="hidden"
                />
              </label>
            </div>

            {tipo === "cheques" && cargandoCatalogos && (
              <p className="text-xs text-cyan-300 mt-5 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Cargando fondos y cheques disponibles para validar la plantilla...
              </p>
            )}

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-black text-white">
                {configActual.label}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {configActual.descripcion}
              </p>
              <p className="text-[11px] text-gray-500 mt-3">
                Columnas sugeridas: {configActual.columnas.join(", ")}
              </p>
              {nombreArchivo && (
                <p className="text-[11px] text-cyan-300 mt-3 font-bold">
                  Archivo cargado: {nombreArchivo}
                </p>
              )}
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-4 mb-8">
            <ResumenCard
              label="Total filas"
              value={preview.length}
              color="text-cyan-300"
            />
            <ResumenCard
              label="Filas válidas"
              value={filasValidas.length}
              color="text-green-300"
            />
            <ResumenCard
              label="Filas con error"
              value={filasConError.length}
              color="text-red-300"
            />
          </section>

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2">
                <Database size={16} className="text-green-500" />
                Fase 3: vista previa y validación
              </h2>

              <button
                onClick={confirmarImportacion}
                disabled={procesando || cargandoCatalogos || !filasValidas.length}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-black rounded-xl transition-all px-6 h-[3.2rem] uppercase text-xs flex items-center justify-center gap-2"
              >
                {procesando ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Fase 4: confirmar importación
              </button>
            </div>

            {preview.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-[2rem]">
                <p className="text-gray-500">
                  Sube un Excel para ver la vista previa.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-white/10">
                      <th className="py-3 px-3">Fila</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3">Empresa</th>
                      <th className="py-3 px-3">Detalle</th>
                      <th className="py-3 px-3">Errores</th>
                    </tr>
                  </thead>

                  <tbody>
                    {preview.slice(0, 200).map((fila) => (
                      <tr
                        key={fila.fila}
                        className="border-b border-white/5 text-gray-300"
                      >
                        <td className="py-3 px-3 font-bold">{fila.fila}</td>

                        <td className="py-3 px-3">
                          {fila.valido ? (
                            <span className="text-green-300 font-bold flex items-center gap-1">
                              <CheckCircle2 size={14} />
                              Válida
                            </span>
                          ) : (
                            <span className="text-red-300 font-bold flex items-center gap-1">
                              <AlertTriangle size={14} />
                              Error
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {fila.data.empresa || "N/A"}
                        </td>

                        <td className="py-3 px-3">
                          {fila.data.nombre ||
                            fila.data.proveedor ||
                            fila.data.beneficiario ||
                            fila.data.descripcion ||
                            fila.data.empleado ||
                            "Registro"}
                        </td>

                        <td className="py-3 px-3 text-red-300">
                          {fila.errores.length
                            ? fila.errores.join(" | ")
                            : "Sin errores"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {preview.length > 200 && (
                  <p className="text-[11px] text-gray-500 mt-4">
                    Mostrando solo las primeras 200 filas en vista previa.
                  </p>
                )}
              </div>
            )}
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

function ResumenCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">
        {label}
      </p>
      <h2 className={`text-3xl font-black mt-2 ${color}`}>{value}</h2>
    </div>
  );
}
