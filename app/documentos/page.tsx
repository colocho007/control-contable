"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Printer,
  Receipt,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import {
  abrirVistaImprimible,
  descargarCsv,
  type ColumnaExportacion,
  type FilaExportacion,
} from "../../lib/exportaciones";
import {
  buscarDocumentosTramite,
  desactivarDocumento,
  listarDocumentosTramite,
  obtenerUrlDocumento,
  type BuscarDocumentosTramiteParams,
  type DocumentoTramite,
} from "../../lib/documentosTramites";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";

interface Empresa {
  id: number;
  nombre: string;
}

interface FiltrosDocumentos {
  empresaId: string;
  fechaDesde: string;
  fechaHasta: string;
  modulo: string;
  tipoDocumento: string;
  numeroFactura: string;
  numeroCheque: string;
  texto: string;
  sensible: string;
}

const LIMITE_DOCUMENTOS = 200;
const FILTROS_INICIALES: FiltrosDocumentos = {
  empresaId: "",
  fechaDesde: "",
  fechaHasta: "",
  modulo: "",
  tipoDocumento: "",
  numeroFactura: "",
  numeroCheque: "",
  texto: "",
  sensible: "",
};

function textoLegible(valor: string | null) {
  return valor ? valor.replaceAll("_", " ") : "-";
}

function fechaDocumento(documento: DocumentoTramite) {
  return documento.fecha_documento || documento.creado_at;
}

function mostrarFecha(valor: string | null) {
  return valor
    ? new Date(valor).toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";
}

function formatoMonto(documento: DocumentoTramite) {
  if (documento.monto === null || documento.monto === undefined) return "-";

  return `${documento.moneda || ""} ${Number(documento.monto).toLocaleString(
    "es-GT",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`.trim();
}

function compararDocumentos(a: DocumentoTramite, b: DocumentoTramite) {
  const fechaA = new Date(fechaDocumento(a) || 0).getTime();
  const fechaB = new Date(fechaDocumento(b) || 0).getTime();
  return fechaB - fechaA;
}

function contieneChequeOVoucher(documento: DocumentoTramite) {
  const tipo = documento.tipo_documento.toLowerCase();
  return Boolean(documento.numero_cheque) || tipo.includes("cheque") || tipo.includes("voucher");
}

export default function DocumentosPage() {
  const router = useRouter();
  const [documentos, setDocumentos] = useState<DocumentoTramite[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [filtros, setFiltros] =
    useState<FiltrosDocumentos>(FILTROS_INICIALES);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | number | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [funcionesOperativas, setFuncionesOperativas] = useState<UsuarioFuncionOperativa[]>([]);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("documentos");

        if (!activo) return;

        if (!acceso.ok) {
          const debeVolverAlLogin = [
            "sin_sesion",
            "sin_perfil",
            "usuario_inactivo",
          ].includes(acceso.motivo || "");

          if (!debeVolverAlLogin) {
            window.alert("No tienes acceso al modulo Documentos.");
          }

          router.replace(debeVolverAlLogin ? "/login" : "/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          acceso.perfil?.rol || ""
        );
        const funciones = await listarFuncionesOperativasUsuario(acceso.user!.id, idsPermitidos);

        if (!activo) return;

        setEmpresasPermitidasIds(idsPermitidos);
        setFuncionesOperativas(funciones);
        setAutorizado(true);
        setValidandoAcceso(false);

        if (!idsPermitidos.length) {
          setDocumentos([]);
          setEmpresas([]);
          setAviso("No tienes empresas asignadas para consultar documentos.");
          return;
        }

        await Promise.all([
          cargarEmpresas(idsPermitidos),
          cargarDocumentos(idsPermitidos, FILTROS_INICIALES),
        ]);
      } catch (error) {
        console.error("Error validando acceso a documentos:", error);

        if (activo) {
          setValidandoAcceso(false);
          router.replace("/dashboard");
        }
      }
    }

    void iniciar();

    return () => {
      activo = false;
    };
  }, [router]);

  async function cargarEmpresas(idsPermitidos: number[]) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id,nombre")
      .in("id", idsPermitidos)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando empresas para documentos:", error);
      setAviso("No se pudo cargar el catalogo de empresas para filtros.");
      return;
    }

    setEmpresas((data || []) as Empresa[]);
  }

  async function cargarDocumentos(
    idsPermitidos: number[],
    filtrosAplicados: FiltrosDocumentos
  ) {
    setCargandoDocumentos(true);
    setErrorCarga(null);

    try {
      if (!idsPermitidos.length) {
        setDocumentos([]);
        setAviso("No tienes empresas asignadas para consultar documentos.");
        return;
      }

      let idsConsulta = idsPermitidos;

      if (filtrosAplicados.empresaId) {
        const empresaId = Number(filtrosAplicados.empresaId);

        if (
          !Number.isFinite(empresaId) ||
          !idsPermitidos.includes(empresaId)
        ) {
          setDocumentos([]);
          setErrorCarga("La empresa seleccionada no esta autorizada.");
          return;
        }

        idsConsulta = [empresaId];
      }

      const paramsBase: Omit<BuscarDocumentosTramiteParams, "empresa_id"> = {
        fecha_desde: filtrosAplicados.fechaDesde || undefined,
        fecha_hasta: filtrosAplicados.fechaHasta || undefined,
        modulo: filtrosAplicados.modulo || undefined,
        tipo_documento: filtrosAplicados.tipoDocumento || undefined,
        numero_factura: filtrosAplicados.numeroFactura.trim() || undefined,
        numero_cheque: filtrosAplicados.numeroCheque.trim() || undefined,
        texto: filtrosAplicados.texto.trim() || undefined,
        sensible:
          filtrosAplicados.sensible === ""
            ? undefined
            : filtrosAplicados.sensible === "true",
        limite: LIMITE_DOCUMENTOS,
      };
      const tieneFiltros = Object.entries(paramsBase).some(
        ([clave, valor]) => clave !== "limite" && valor !== undefined
      );

      const resultados = await Promise.all(
        idsConsulta.map((empresaId) =>
          tieneFiltros
            ? buscarDocumentosTramite({
                ...paramsBase,
                empresa_id: empresaId,
              })
            : listarDocumentosTramite({
                empresa_id: empresaId,
                limite: LIMITE_DOCUMENTOS,
              })
        )
      );

      const documentosUnicos = Array.from(
        new Map(
          resultados
            .flat()
            .filter((documento) =>
              idsPermitidos.includes(Number(documento.empresa_id))
            )
            .map((documento) => [String(documento.id), documento])
        ).values()
      )
        .sort(compararDocumentos)
        .slice(0, LIMITE_DOCUMENTOS);

      setDocumentos(documentosUnicos);
      setAviso(null);
    } catch (error) {
      console.error("Error cargando documentos:", error);
      setDocumentos([]);
      setErrorCarga(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los documentos."
      );
    } finally {
      setCargandoDocumentos(false);
    }
  }

  function aplicarFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void cargarDocumentos(empresasPermitidasIds, filtros);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES);
    void cargarDocumentos(empresasPermitidasIds, FILTROS_INICIALES);
  }

  async function abrirDocumento(documento: DocumentoTramite) {
    if (
      documento.estado !== "activo" ||
      !empresasPermitidasIds.includes(Number(documento.empresa_id))
    ) {
      window.alert("Este documento ya no esta disponible para consulta.");
      return;
    }

    setProcesandoId(documento.id);

    try {
      const url = await obtenerUrlDocumento(documento);
      await auditarLectura("abrir_documento", {
        documento_id: documento.id,
        modulo_origen: documento.modulo,
        entidad_tipo: documento.entidad_tipo,
        entidad_id: documento.entidad_id,
        tipo_documento: documento.tipo_documento,
        archivo_nombre: documento.archivo_nombre,
      }, documento.empresa_id);
      const ventana = window.open(url, "_blank", "noopener,noreferrer");

      if (!ventana) {
        window.alert("Permite ventanas emergentes para abrir el documento.");
      }
    } catch (error) {
      console.error("Error abriendo documento:", error);
      const mensaje =
        error instanceof Error ? error.message : "No se pudo abrir el documento.";
      window.alert(mensaje);

      if (
        mensaje === "El documento ya no está activo o fue desactivado." ||
        mensaje === "No se pudo acceder al documento o ya no está disponible."
      ) {
        void cargarDocumentos(empresasPermitidasIds, filtros);
      }
    } finally {
      setProcesandoId(null);
    }
  }

  async function inactivarDocumento(documento: DocumentoTramite) {
    if (esAuditorSoloLecturaLocal(funcionesOperativas, [documento.empresa_id])) {
      window.alert("El auditor solo lectura no puede desactivar documentos.");
      return;
    }

    if (!empresasPermitidasIds.includes(Number(documento.empresa_id))) {
      window.alert("No tienes acceso para desactivar este documento.");
      return;
    }

    if (
      !window.confirm(
        `Deseas desactivar el documento "${documento.titulo || documento.archivo_nombre}"?`
      )
    ) {
      return;
    }

    const motivo = window.prompt(
      "Indica el motivo de la desactivacion (opcional):",
      ""
    );

    if (motivo === null) return;

    setProcesandoId(documento.id);

    try {
      await desactivarDocumento(documento.id, motivo.trim() || undefined);
      setAviso("Documento desactivado correctamente.");
      setDocumentos((actuales) =>
        actuales.filter((item) => item.id !== documento.id)
      );
    } catch (error) {
      console.error("Error desactivando documento:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar el documento."
      );
    } finally {
      setProcesandoId(null);
    }
  }

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );

  const modulos = useMemo(() => {
    const valores = new Set(documentos.map((documento) => documento.modulo));
    if (filtros.modulo) valores.add(filtros.modulo);
    return Array.from(valores).sort();
  }, [documentos, filtros.modulo]);

  const tiposDocumento = useMemo(() => {
    const valores = new Set(
      documentos.map((documento) => documento.tipo_documento)
    );
    if (filtros.tipoDocumento) valores.add(filtros.tipoDocumento);
    return Array.from(valores).sort();
  }, [documentos, filtros.tipoDocumento]);

  const resumen = useMemo(
    () => ({
      total: documentos.length,
      sensibles: documentos.filter((documento) => documento.sensible).length,
      facturas: documentos.filter(
        (documento) =>
          Boolean(documento.numero_factura) ||
          documento.tipo_documento.toLowerCase().includes("factura")
      ).length,
      cheques: documentos.filter(contieneChequeOVoucher).length,
    }),
    [documentos]
  );

  const columnasExportacion: ColumnaExportacion[] = [
    { clave: "fecha", titulo: "Fecha" },
    { clave: "empresa", titulo: "Empresa" },
    { clave: "modulo", titulo: "Modulo" },
    { clave: "tipo_documento", titulo: "Tipo documento" },
    { clave: "titulo", titulo: "Titulo" },
    { clave: "factura", titulo: "Factura" },
    { clave: "cheque", titulo: "Cheque" },
    { clave: "proveedor", titulo: "Proveedor" },
    { clave: "monto", titulo: "Monto" },
    { clave: "moneda", titulo: "Moneda" },
    { clave: "sensible", titulo: "Sensible" },
    { clave: "estado", titulo: "Estado" },
  ];

  function filasExportacion(): FilaExportacion[] {
    return documentos.map((documento) => ({
      fecha: fechaDocumento(documento),
      empresa:
        empresasPorId.get(Number(documento.empresa_id)) ||
        `Empresa #${documento.empresa_id}`,
      modulo: documento.modulo,
      tipo_documento: documento.tipo_documento,
      titulo: documento.titulo || documento.descripcion || documento.archivo_nombre,
      factura: documento.numero_factura || "",
      cheque: documento.numero_cheque || "",
      proveedor: documento.proveedor_nombre_snapshot || "",
      monto: documento.monto ?? "",
      moneda: documento.moneda || "",
      sensible: documento.sensible,
      estado: documento.estado,
    }));
  }

  function exportarCsv() {
    const filas = filasExportacion();
    if (!filas.length) {
      window.alert("No hay documentos para exportar.");
      return;
    }

    void auditarLectura("exportar_documentos", {
      formato: "csv",
      cantidad: filas.length,
      filtros,
    });
    descargarCsv("documentos.csv", columnasExportacion, filas);
  }

  function imprimirPdf() {
    const filas = filasExportacion();
    if (!filas.length) {
      window.alert("No hay documentos para imprimir.");
      return;
    }

    void auditarLectura("imprimir_documentos", {
      formato: "pdf_vista_imprimible",
      cantidad: filas.length,
      filtros,
    });
    abrirVistaImprimible(
      "Documentos",
      "Busqueda y respaldo de documentos de tramites",
      columnasExportacion,
      filas,
      {
        "Total documentos": resumen.total,
        Sensibles: resumen.sensibles,
        Facturas: resumen.facturas,
        "Cheques / vouchers": resumen.cheques,
      }
    );
  }

  async function auditarLectura(
    accion: string,
    metadatos: Record<string, unknown>,
    empresaId?: number | null
  ) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: empresaId ?? null,
        modulo: "documentos",
        accion,
        entidad_tipo: "documento_tramite",
        entidad_id:
          typeof metadatos.documento_id === "string" || typeof metadatos.documento_id === "number"
            ? metadatos.documento_id
            : null,
        descripcion: "Consulta de documentos auditada",
        sensible: true,
        metadatos: {
          ...metadatos,
          auditor_solo_lectura: esAuditorSoloLecturaLocal(funcionesOperativas),
        },
        origen: "modulo_documentos",
      });
    } catch (error) {
      console.warn("No se pudo auditar consulta de documentos:", error);
    }
  }

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex bg-[#020617] min-h-screen items-center justify-center text-white">
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white font-sans">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black flex items-center gap-4">
                <FolderOpen className="text-cyan-500" size={46} />
                Documentos
              </h1>
              <p className="text-gray-400 mt-2">
                Busqueda y respaldo de documentos de tramites
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportarCsv}
                disabled={!documentos.length}
                className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-bold disabled:opacity-50"
              >
                <Download size={18} />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={imprimirPdf}
                disabled={!documentos.length}
                className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-bold disabled:opacity-50"
              >
                <Printer size={18} />
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => void cargarDocumentos(empresasPermitidasIds, filtros)}
                disabled={cargandoDocumentos}
                className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-3 font-bold disabled:opacity-50"
              >
                <RefreshCcw
                  size={18}
                  className={cargandoDocumentos ? "animate-spin" : ""}
                />
                Actualizar
              </button>
            </div>
          </header>

          <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <TarjetaResumen
              titulo="Total documentos"
              valor={resumen.total}
              icono={<FileText size={22} />}
            />
            <TarjetaResumen
              titulo="Documentos sensibles"
              valor={resumen.sensibles}
              icono={<ShieldAlert size={22} />}
            />
            <TarjetaResumen
              titulo="Facturas"
              valor={resumen.facturas}
              icono={<Receipt size={22} />}
            />
            <TarjetaResumen
              titulo="Cheques / vouchers"
              valor={resumen.cheques}
              icono={<Archive size={22} />}
            />
          </section>

          <form
            onSubmit={aplicarFiltros}
            className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-8"
          >
            <h2 className="font-bold text-lg mb-5">Filtros</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
              <Campo label="Empresa">
                <select
                  value={filtros.empresaId}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      empresaId: event.target.value,
                    }))
                  }
                  className="campo-documentos"
                >
                  <option value="">Todas las permitidas</option>
                  {empresas.map((empresa) => (
                    <option value={empresa.id} key={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Fecha desde">
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      fechaDesde: event.target.value,
                    }))
                  }
                  className="campo-documentos"
                />
              </Campo>

              <Campo label="Fecha hasta">
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      fechaHasta: event.target.value,
                    }))
                  }
                  className="campo-documentos"
                />
              </Campo>

              <Campo label="Modulo">
                <select
                  value={filtros.modulo}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      modulo: event.target.value,
                    }))
                  }
                  className="campo-documentos"
                >
                  <option value="">Todos</option>
                  {modulos.map((modulo) => (
                    <option value={modulo} key={modulo}>
                      {textoLegible(modulo)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Tipo documento">
                <select
                  value={filtros.tipoDocumento}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      tipoDocumento: event.target.value,
                    }))
                  }
                  className="campo-documentos"
                >
                  <option value="">Todos</option>
                  {tiposDocumento.map((tipo) => (
                    <option value={tipo} key={tipo}>
                      {textoLegible(tipo)}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Numero factura">
                <input
                  value={filtros.numeroFactura}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      numeroFactura: event.target.value,
                    }))
                  }
                  placeholder="Factura"
                  className="campo-documentos"
                />
              </Campo>

              <Campo label="Numero cheque">
                <input
                  value={filtros.numeroCheque}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      numeroCheque: event.target.value,
                    }))
                  }
                  placeholder="Cheque"
                  className="campo-documentos"
                />
              </Campo>

              <Campo label="Proveedor / texto">
                <input
                  value={filtros.texto}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      texto: event.target.value,
                    }))
                  }
                  placeholder="Buscar documento"
                  className="campo-documentos"
                />
              </Campo>

              <Campo label="Sensible">
                <select
                  value={filtros.sensible}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      sensible: event.target.value,
                    }))
                  }
                  className="campo-documentos"
                >
                  <option value="">Todos</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </Campo>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="submit"
                disabled={cargandoDocumentos}
                className="bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limpiarFiltros}
                disabled={cargandoDocumentos}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-gray-200 disabled:opacity-50"
              >
                Limpiar filtros
              </button>
              <span className="text-xs text-gray-500 self-center">
                Maximo {LIMITE_DOCUMENTOS} documentos por consulta
              </span>
            </div>
          </form>

          {aviso && (
            <div className="border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 rounded-2xl px-5 py-4 mb-5">
              {aviso}
            </div>
          )}

          {errorCarga && (
            <div className="border border-red-400/30 bg-red-400/10 text-red-200 rounded-2xl px-5 py-4 mb-5">
              {errorCarga}
            </div>
          )}

          <section className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            {cargandoDocumentos ? (
              <div className="flex items-center justify-center gap-3 py-20 text-gray-300">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
                Cargando documentos...
              </div>
            ) : documentos.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                No se encontraron documentos activos para el alcance y filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="text-left px-5 py-4">Fecha</th>
                      <th className="text-left px-5 py-4">Empresa</th>
                      <th className="text-left px-5 py-4">Modulo / tipo</th>
                      <th className="text-left px-5 py-4">Documento</th>
                      <th className="text-left px-5 py-4">Referencias</th>
                      <th className="text-left px-5 py-4">Proveedor / monto</th>
                      <th className="text-left px-5 py-4">Archivo</th>
                      <th className="text-left px-5 py-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {documentos.map((documento) => (
                      <tr key={documento.id} className="align-top hover:bg-white/[0.03]">
                        <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                          {mostrarFecha(fechaDocumento(documento))}
                        </td>
                        <td className="px-5 py-4 text-gray-200">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-gray-400" />
                            {empresasPorId.get(Number(documento.empresa_id)) ||
                              `Empresa #${documento.empresa_id}`}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-cyan-300 capitalize">
                            {textoLegible(documento.modulo)}
                          </div>
                          <div className="text-gray-300 capitalize">
                            {textoLegible(documento.tipo_documento)}
                          </div>
                          {documento.sensible && (
                            <span className="inline-block mt-2 text-[11px] rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 px-2 py-0.5">
                              Sensible
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 min-w-56">
                          <p className="text-gray-100 font-semibold">
                            {documento.titulo || documento.archivo_nombre}
                          </p>
                          {documento.descripcion && (
                            <p className="text-xs text-gray-400 mt-1">
                              {documento.descripcion}
                            </p>
                          )}
                          {documento.metadatos !== null && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-cyan-300 text-xs">
                                Ver detalles
                              </summary>
                              <pre className="text-xs text-gray-300 bg-black/20 border border-white/10 rounded-xl p-3 mt-2 max-w-xs overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(documento.metadatos, null, 2)}
                              </pre>
                            </details>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-300 whitespace-nowrap">
                          <div>Factura: {documento.numero_factura || "-"}</div>
                          <div>Cheque: {documento.numero_cheque || "-"}</div>
                          <div>Doc.: {documento.numero_documento || "-"}</div>
                        </td>
                        <td className="px-5 py-4 text-gray-300">
                          <div>{documento.proveedor_nombre_snapshot || "-"}</div>
                          <div className="font-semibold text-white mt-1">
                            {formatoMonto(documento)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-300">
                          <div className="max-w-44 break-words">
                            {documento.archivo_nombre}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(documento.archivo_size / 1024).toFixed(1)} KB
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => void abrirDocumento(documento)}
                              disabled={procesandoId === documento.id}
                              className="inline-flex items-center justify-center gap-2 bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/20 rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                            >
                              <ExternalLink size={14} />
                              Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => void inactivarDocumento(documento)}
                              disabled={
                                procesandoId === documento.id ||
                                esAuditorSoloLecturaLocal(funcionesOperativas, [documento.empresa_id])
                              }
                              className="inline-flex items-center justify-center gap-2 bg-red-500/10 border border-red-400/30 text-red-200 hover:bg-red-500/20 rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
                            >
                              <Archive size={14} />
                              Desactivar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .campo-documentos {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.65rem 0.75rem;
          color: white;
          outline: none;
        }
        .campo-documentos:focus {
          border-color: rgba(6, 182, 212, 0.6);
        }
        .campo-documentos option {
          background: #0f172a;
        }
      `}</style>
    </div>
  );
}

function TarjetaResumen({
  titulo,
  valor,
  icono,
}: {
  titulo: string;
  valor: number;
  icono: ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between text-cyan-400 mb-3">
        <span className="text-sm font-semibold text-gray-400">{titulo}</span>
        {icono}
      </div>
      <div className="text-3xl font-black">{valor}</div>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
      {label}
      {children}
    </label>
  );
}
