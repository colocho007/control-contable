"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
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

interface Empresa {
  id: number;
  nombre: string;
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
  const [preview, setPreview] = useState<FilaPreview[]>([]);

  const configActual = useMemo(
    () => TIPOS_IMPORTACION.find((t) => t.value === tipo)!,
    [tipo]
  );

  const filasValidas = preview.filter((f) => f.valido);
  const filasConError = preview.filter((f) => !f.valido);

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
        .select("id,nombre")
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
    const normalizado = nombreEmpresa.trim().toLowerCase();

    return empresas.find(
      (empresa) => empresa.nombre.trim().toLowerCase() === normalizado
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

      return {
        fila: indice + 2,
        valido: errores.length === 0,
        errores,
        data: {
          empresa_id: empresa?.id || null,
          empresa: empresa?.nombre || nombreEmpresa,
          nombre,
          nit: limpiarTexto(leerCampo(fila, ["NIT", "nit"])) || null,
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

    setNombreArchivo(archivo.name);
    setPreview([]);

    try {
      const catalogosCheques =
        tipo === "cheques" ? await asegurarDatosCheques() : undefined;
      const buffer = await archivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const filas: any[] = XLSX.utils.sheet_to_json(hoja, {
        defval: "",
      });

      if (!filas.length) {
        toast.error("El archivo está vacío");
        return;
      }

      const resultado = filas.map((fila, index) =>
        transformarFila(tipo, fila, index, catalogosCheques)
      );

      setPreview(resultado);
      toast.success("Archivo leído correctamente");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error leyendo Excel");
    }
  }

  async function registrarAuditoriaImportacion(
    filasInsertadas: FilaPreview[],
    resultado: "confirmada" | "parcial" = "confirmada"
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
          filas_pendientes_ejecucion:
            resultado === "parcial"
              ? Math.max(filasValidas.length - filasInsertadas.length, 0)
              : 0,
          archivo_origen: nombreArchivo || null,
          columnas_configuradas: configActual.columnas,
          resumen_errores:
            filasConError.length > 0
              ? "Se excluyeron filas por errores de validacion."
              : null,
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
  if (!userId) {
    toast.error("Sesión no válida");
    return;
  }

  if (!filasValidas.length) {
    toast.error("No hay filas válidas para importar");
    return;
  }

  setProcesando(true);
  const toastId = toast.loading("Importando datos...");

  try {
    const tabla = configActual.tabla;

    if (tipo === "cheques") {
      const filasImportadas: FilaPreview[] = [];

      try {
        for (const fila of filasValidas) {
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
              .eq("id", Number(registro.cheque_fisico_id));

            if (chequeFisicoError) throw chequeFisicoError;
          }
        }
      } catch (error) {
        if (filasImportadas.length > 0) {
          await registrarAuditoriaImportacion(filasImportadas, "parcial");
        }

        throw error;
      }

      const auditoriaRegistrada = await registrarAuditoriaImportacion(
        filasImportadas
      );

      await cargarDatosCheques(empresasPermitidasIds);

      if (auditoriaRegistrada) {
        toast.success(`Se importaron ${filasImportadas.length} cheques / pagos`, {
          id: toastId,
        });
      } else {
        toast.error(
          "Cheques importados, pero no se pudo registrar la auditoría.",
          { id: toastId }
        );
      }

      setPreview([]);
      setNombreArchivo("");
      return;
    }

    const registros = filasValidas.map((fila) => fila.data);

    const { error } = await supabase.from(tabla).insert(registros);

    if (error) throw error;

    const auditoriaRegistrada = await registrarAuditoriaImportacion(filasValidas);

    if (auditoriaRegistrada) {
      toast.success(
        `Se importaron ${filasValidas.length} registros en ${configActual.label}`,
        { id: toastId }
      );
    } else {
      toast.error(
        "Datos importados, pero no se pudo registrar la auditoría.",
        { id: toastId }
      );
    }

    setPreview([]);
    setNombreArchivo("");
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error importando datos", { id: toastId });
  } finally {
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
