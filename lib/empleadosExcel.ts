import * as XLSX from "xlsx";

export const VERSION_PLANTILLA_EMPLEADOS = "CONTROL-ERPM-EMPLEADOS-V2-2026-07";
export const LIMITE_FILAS_EMPLEADOS = 1000;
export const LIMITE_ARCHIVO_EMPLEADOS = 5 * 1024 * 1024;

export interface FilaEmpleadoExcel {
  fila: number;
  empresa_id: number | null;
  codigo_interno: string;
  nombres: string;
  apellidos: string;
  dpi: string;
  nit: string;
  afiliacion_igss: string;
  fecha_nacimiento: string;
  nacionalidad: string;
  estado_civil: string;
  telefono: string;
  correo: string;
  direccion: string;
  departamento_residencia: string;
  municipio_residencia: string;
  puesto: string;
  ocupacion: string;
  departamento_area: string;
  centro_trabajo: string;
  tipo_contrato: string;
  jornada: string;
  fecha_ingreso: string;
  fecha_retiro: string;
  motivo_retiro: string;
  estado_laboral: string;
  salario_base: number | null;
  bonificacion_incentivo: number | null;
  moneda: string;
  observaciones: string;
}

const ENCABEZADOS = [
  "empresa_id*", "codigo_interno", "nombres*", "apellidos*", "dpi", "nit",
  "afiliacion_igss", "fecha_nacimiento", "nacionalidad", "estado_civil", "telefono",
  "correo", "direccion", "departamento_residencia", "municipio_residencia", "puesto",
  "ocupacion", "departamento_area", "centro_trabajo", "tipo_contrato", "jornada",
  "fecha_ingreso*", "fecha_retiro", "motivo_retiro", "estado_laboral*", "salario_base*",
  "bonificacion_incentivo", "moneda*", "observaciones",
] as const;

function textoSeguro(valor: unknown, limite = 500) {
  const texto = String(valor ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return /^[=+\-@]/.test(texto) ? `'${texto.slice(0, limite - 1)}` : texto.slice(0, limite);
}

function numeroSeguro(valor: unknown) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(String(valor).replace(/,/g, ""));
  return Number.isFinite(numero) ? numero : null;
}

function fechaIso(valor: unknown) {
  if (!valor) return "";
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (fecha) return `${fecha.y}-${String(fecha.m).padStart(2, "0")}-${String(fecha.d).padStart(2, "0")}`;
  }
  const texto = textoSeguro(valor, 30);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : "";
  return iso;
}

export function descargarPlantillaEmpleados(empresas: Array<{ id: number; nombre: string }>) {
  const ejemplo = [
    empresas[0]?.id || "ID_EMPRESA",
    "EMP-EJEMPLO-001",
    "NOMBRE DE EJEMPLO",
    "APELLIDO DE EJEMPLO",
    "",
    "",
    "",
    "",
    "Guatemalteca",
    "",
    "",
    "",
    "",
    "",
    "",
    "Puesto de ejemplo",
    "",
    "Administración",
    "",
    "",
    "",
    new Date().toISOString().slice(0, 10),
    "",
    "",
    "Activo",
    0,
    0,
    "GTQ",
    "FILA DE EJEMPLO: eliminar o reemplazar antes de importar",
  ];
  const hojaDatos = XLSX.utils.aoa_to_sheet([[...ENCABEZADOS], ejemplo]);
  hojaDatos["!cols"] = ENCABEZADOS.map((encabezado) => ({ wch: Math.max(14, encabezado.length + 2) }));
  const instrucciones = [
    ["Plantilla", VERSION_PLANTILLA_EMPLEADOS],
    ["Generada", new Date().toISOString()],
    ["Regla", "Solo se procesa .xlsx. Máximo 5 MB y 1,000 filas."],
    ["Obligatorios", "empresa_id, nombres, apellidos, fecha_ingreso, estado_laboral, salario_base, moneda"],
    ["Fechas", "Usar AAAA-MM-DD."],
    ["Estados", "Activo, Inactivo, Suspendido o Egresado."],
    ["Monedas", "GTQ o USD."],
    ["Seguridad", "No incluir cuentas bancarias, contraseñas, macros ni fórmulas."],
    ["Ejemplo", "La fila 2 es solo ejemplo y debe eliminarse o reemplazarse."],
  ];
  const hojaInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
  const hojaCatalogos = XLSX.utils.aoa_to_sheet([
    ["empresa_id", "empresa"],
    ...empresas.map((empresa) => [empresa.id, textoSeguro(empresa.nombre, 150)]),
    [],
    ["estado_laboral"], ["Activo"], ["Inactivo"], ["Suspendido"], ["Egresado"],
    [],
    ["moneda"], ["GTQ"], ["USD"],
  ]);
  const libro = XLSX.utils.book_new();
  libro.Props = { Title: "Plantilla de empleados Control ERPM", Comments: VERSION_PLANTILLA_EMPLEADOS };
  XLSX.utils.book_append_sheet(libro, hojaDatos, "Empleados");
  XLSX.utils.book_append_sheet(libro, hojaInstrucciones, "Instrucciones");
  XLSX.utils.book_append_sheet(libro, hojaCatalogos, "Catalogos");
  XLSX.writeFile(libro, `plantilla_empleados_${new Date().toISOString().slice(0, 10)}.xlsx`, {
    bookType: "xlsx",
    compression: true,
  });
}

export async function leerArchivoEmpleados(archivo: File) {
  if (!archivo.name.toLowerCase().endsWith(".xlsx")) throw new Error("Selecciona un archivo .xlsx válido.");
  if (archivo.size <= 0 || archivo.size > LIMITE_ARCHIVO_EMPLEADOS) throw new Error("El archivo debe pesar entre 1 byte y 5 MB.");
  const buffer = await archivo.arrayBuffer();
  const hashBytes = await crypto.subtle.digest("SHA-256", buffer);
  const hash = Array.from(new Uint8Array(hashBytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const libro = XLSX.read(buffer, { type: "array", cellDates: true, cellFormula: true, cellHTML: false, dense: false });
  if (libro.vbaraw) throw new Error("El archivo contiene macros y no puede procesarse.");
  const hoja = libro.Sheets.Empleados;
  if (!hoja) throw new Error('El archivo debe contener la hoja "Empleados".');
  for (const clave of Object.keys(hoja)) {
    if (!clave.startsWith("!") && hoja[clave]?.f) throw new Error("El archivo contiene fórmulas. Reemplázalas por valores antes de importar.");
  }
  const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "", raw: true });
  if (!filasCrudas.length) throw new Error("La hoja Empleados no contiene filas para validar.");
  if (filasCrudas.length > LIMITE_FILAS_EMPLEADOS) throw new Error(`El archivo supera el límite de ${LIMITE_FILAS_EMPLEADOS} filas.`);
  const filas: FilaEmpleadoExcel[] = filasCrudas.map((fila, indice) => ({
    fila: indice + 2,
    empresa_id: numeroSeguro(fila["empresa_id*"]),
    codigo_interno: textoSeguro(fila.codigo_interno, 80),
    nombres: textoSeguro(fila["nombres*"], 150),
    apellidos: textoSeguro(fila["apellidos*"], 150),
    dpi: textoSeguro(fila.dpi, 30),
    nit: textoSeguro(fila.nit, 30),
    afiliacion_igss: textoSeguro(fila.afiliacion_igss, 40),
    fecha_nacimiento: fechaIso(fila.fecha_nacimiento),
    nacionalidad: textoSeguro(fila.nacionalidad, 80),
    estado_civil: textoSeguro(fila.estado_civil, 40),
    telefono: textoSeguro(fila.telefono, 40),
    correo: textoSeguro(fila.correo, 160),
    direccion: textoSeguro(fila.direccion, 300),
    departamento_residencia: textoSeguro(fila.departamento_residencia, 100),
    municipio_residencia: textoSeguro(fila.municipio_residencia, 100),
    puesto: textoSeguro(fila.puesto, 120),
    ocupacion: textoSeguro(fila.ocupacion, 120),
    departamento_area: textoSeguro(fila.departamento_area, 120),
    centro_trabajo: textoSeguro(fila.centro_trabajo, 160),
    tipo_contrato: textoSeguro(fila.tipo_contrato, 80),
    jornada: textoSeguro(fila.jornada, 80),
    fecha_ingreso: fechaIso(fila["fecha_ingreso*"]),
    fecha_retiro: fechaIso(fila.fecha_retiro),
    motivo_retiro: textoSeguro(fila.motivo_retiro, 300),
    estado_laboral: textoSeguro(fila["estado_laboral*"], 30),
    salario_base: numeroSeguro(fila["salario_base*"]),
    bonificacion_incentivo: numeroSeguro(fila.bonificacion_incentivo) ?? 0,
    moneda: textoSeguro(fila["moneda*"], 3).toUpperCase(),
    observaciones: textoSeguro(fila.observaciones, 500),
  }));
  return { filas, hash, nombre: textoSeguro(archivo.name, 255), tamano: archivo.size };
}
