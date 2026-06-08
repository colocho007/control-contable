export type FilaExportacion = Record<string, unknown>;

export interface ColumnaExportacion<T extends FilaExportacion = FilaExportacion> {
  clave: keyof T | string;
  titulo: string;
  render?: (fila: T) => unknown;
}

export interface SeccionExportacion<T extends FilaExportacion = FilaExportacion> {
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaExportacion<T>[];
  filas: T[];
  resumen?: Record<string, unknown>;
}

export interface DocumentoExportacionInfo {
  encabezado?: Record<string, unknown>;
  notaPie?: string;
}

function obtenerValor<T extends FilaExportacion>(
  fila: T,
  columna: ColumnaExportacion<T>
) {
  if (columna.render) return columna.render(fila);
  return fila[columna.clave as keyof T];
}

function esFechaIso(valor: string) {
  return /^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(valor);
}

function formatearFechaIso(valor: string) {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const fecha = new Date(soloFecha ? `${valor}T00:00:00` : valor);

  if (Number.isNaN(fecha.getTime())) return valor;

  return fecha.toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(soloFecha ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

export function formatearValorExportacion(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) {
    return valor.toLocaleString("es-GT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (typeof valor === "boolean") return valor ? "Si" : "No";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "string") return esFechaIso(valor) ? formatearFechaIso(valor) : valor;
  if (Array.isArray(valor)) {
    return valor.every(
      (item) =>
        item === null ||
        item === undefined ||
        ["string", "number", "boolean"].includes(typeof item)
    )
      ? valor.map((item) => formatearValorExportacion(item)).join(" | ")
      : "[Contenido estructurado no exportado]";
  }
  if (typeof valor === "object") {
    return "[Contenido estructurado no exportado]";
  }

  return String(valor);
}

function sanitizarValorCsv(valor: unknown) {
  const texto = formatearValorExportacion(valor);

  if (!texto || typeof valor === "number") return texto;

  const textoSinEspaciosIniciales = texto.replace(/^ +/, "");
  const iniciaFormula = /^[=+\-@]/.test(textoSinEspaciosIniciales);
  const iniciaControl = /^[\u0000-\u001F\u007F]/.test(
    textoSinEspaciosIniciales
  );

  return iniciaFormula || iniciaControl ? `'${texto}` : texto;
}

function escaparCsv(valor: unknown) {
  const texto = sanitizarValorCsv(valor);
  const escapado = texto.replaceAll('"', '""');

  if (/[",\r\n]/.test(escapado)) {
    return `"${escapado}"`;
  }

  return escapado;
}

function limpiarNombreArchivo(nombreArchivo: string) {
  const nombre =
    nombreArchivo
      .trim()
      .replaceAll("\\", "-")
      .replaceAll("/", "-")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "exportacion.csv";
  return nombre.endsWith(".csv") ? nombre : `${nombre}.csv`;
}

function descargarTexto(nombreArchivo: string, contenido: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("La exportacion solo esta disponible en el navegador.");
  }

  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = limpiarNombreArchivo(nombreArchivo);
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(url);
}

function crearLineasCsv<T extends FilaExportacion>(
  columnas: ColumnaExportacion<T>[],
  filas: T[]
) {
  return [
    columnas.map((columna) => escaparCsv(columna.titulo)).join(","),
    ...filas.map((fila) =>
      columnas.map((columna) => escaparCsv(obtenerValor(fila, columna))).join(",")
    ),
  ];
}

export function descargarCsv<T extends FilaExportacion>(
  nombreArchivo: string,
  columnas: ColumnaExportacion<T>[],
  filas: T[]
) {
  const contenido = `\uFEFF${crearLineasCsv(columnas, filas).join("\r\n")}`;
  descargarTexto(nombreArchivo, contenido);
}

export function descargarCsvSecciones(
  nombreArchivo: string,
  secciones: SeccionExportacion[],
  info?: DocumentoExportacionInfo
) {
  const lineas: string[] = [];

  if (info?.encabezado) {
    Object.entries(info.encabezado).forEach(([clave, valor]) => {
      lineas.push([escaparCsv(clave), escaparCsv(valor)].join(","));
    });
    lineas.push("");
  }

  secciones.forEach((seccion, index) => {
    if (index > 0) lineas.push("");
    lineas.push(escaparCsv(seccion.titulo));

    if (seccion.subtitulo) {
      lineas.push(escaparCsv(seccion.subtitulo));
    }

    if (seccion.resumen) {
      Object.entries(seccion.resumen).forEach(([clave, valor]) => {
        lineas.push([escaparCsv(clave), escaparCsv(valor)].join(","));
      });
      lineas.push("");
    }

    lineas.push(...crearLineasCsv(seccion.columnas, seccion.filas));
  });

  if (info?.notaPie) {
    lineas.push("", escaparCsv(info.notaPie));
  }

  descargarTexto(nombreArchivo, `\uFEFF${lineas.join("\r\n")}`);
}

function escaparHtml(valor: unknown) {
  return formatearValorExportacion(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTabla<T extends FilaExportacion>(
  columnas: ColumnaExportacion<T>[],
  filas: T[]
) {
  const encabezados = columnas
    .map((columna) => `<th>${escaparHtml(columna.titulo)}</th>`)
    .join("");
  const cuerpo = filas
    .map(
      (fila) =>
        `<tr>${columnas
          .map((columna) => `<td>${escaparHtml(obtenerValor(fila, columna))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return `<table><thead><tr>${encabezados}</tr></thead><tbody>${cuerpo}</tbody></table>`;
}

function renderResumen(resumen?: Record<string, unknown>) {
  if (!resumen || !Object.keys(resumen).length) return "";

  return `<section class="resumen">${Object.entries(resumen)
    .map(
      ([clave, valor]) =>
        `<div><strong>${escaparHtml(clave)}:</strong> ${escaparHtml(valor)}</div>`
    )
    .join("")}</section>`;
}

function abrirHtmlImprimible(html: string) {
  if (typeof window === "undefined") {
    throw new Error("La vista imprimible solo esta disponible en el navegador.");
  }

  const ventana = window.open("", "_blank", "noopener,noreferrer");
  if (!ventana) {
    throw new Error("Permite ventanas emergentes para abrir la vista imprimible.");
  }

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
}

function plantillaImprimible(
  titulo: string,
  subtitulo: string | undefined,
  contenido: string,
  info?: DocumentoExportacionInfo
) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtml(titulo)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0; font-size: 26px; }
    h2 { margin-top: 28px; font-size: 18px; }
    p { color: #475569; }
    .acciones { margin: 16px 0 24px; }
    button { background: #06b6d4; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #e2e8f0; }
    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 16px 0; font-size: 13px; }
    .seccion { break-inside: avoid; margin-bottom: 28px; }
    footer { border-top: 1px solid #cbd5e1; color: #64748b; margin-top: 28px; padding-top: 12px; font-size: 11px; }
    @media print {
      body { margin: 18mm; }
      .acciones { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escaparHtml(titulo)}</h1>
    ${subtitulo ? `<p>${escaparHtml(subtitulo)}</p>` : ""}
    <p>Generado: ${escaparHtml(new Date())}</p>
    ${renderResumen(info?.encabezado)}
    <div class="acciones"><button onclick="window.print()">Imprimir / guardar PDF</button></div>
  </header>
  ${contenido}
  ${info?.notaPie ? `<footer>${escaparHtml(info.notaPie)}</footer>` : ""}
</body>
</html>`;
}

export function abrirVistaImprimible<T extends FilaExportacion>(
  titulo: string,
  subtitulo: string,
  columnas: ColumnaExportacion<T>[],
  filas: T[],
  resumen?: Record<string, unknown>
) {
  const contenido = `${renderResumen(resumen)}${renderTabla(columnas, filas)}`;
  abrirHtmlImprimible(plantillaImprimible(titulo, subtitulo, contenido));
}

export function abrirVistaImprimibleSecciones(
  titulo: string,
  subtitulo: string,
  secciones: SeccionExportacion[],
  info?: DocumentoExportacionInfo
) {
  const contenido = secciones
    .map(
      (seccion) => `<section class="seccion">
        <h2>${escaparHtml(seccion.titulo)}</h2>
        ${seccion.subtitulo ? `<p>${escaparHtml(seccion.subtitulo)}</p>` : ""}
        ${renderResumen(seccion.resumen)}
        ${renderTabla(seccion.columnas, seccion.filas)}
      </section>`
    )
    .join("");

  abrirHtmlImprimible(plantillaImprimible(titulo, subtitulo, contenido, info));
}
