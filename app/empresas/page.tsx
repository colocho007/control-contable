"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import {
  registrarAuditoriaEvento,
  type ValorJsonAuditoria,
} from "../../lib/auditoria";
import {
  Archive,
  Building2,
  CheckCircle2,
  Edit3,
  Eye,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  XCircle,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type EstadoEmpresa = "Activa" | "Pendiente" | "Inactiva" | "Archivada";

interface Empresa {
  id: number;
  nit?: string | null;
  rtn?: string | null;
  razon_social?: string | null;
  nombre_comercial?: string | null;
  nombre?: string | null;
  direccion_fiscal?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  representante_legal?: string | null;
  actividad_economica?: string | null;
  estado?: string | null;
  observaciones?: string | null;
  cai?: string | null;
  isr?: number | string | null;
}

interface PerfilActual {
  id: string;
  nombre: string;
  rol: string;
}

interface DependenciaEmpresa {
  tabla: string;
  descripcion: string;
  conteo: number;
  critica: boolean;
}

interface FormEmpresa {
  nit: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  telefono: string;
  correo: string;
  representanteLegal: string;
  actividadEconomica: string;
  estado: EstadoEmpresa;
  observaciones: string;
}

const ESTADOS_EMPRESA: EstadoEmpresa[] = [
  "Activa",
  "Pendiente",
  "Inactiva",
  "Archivada",
];

const FORM_INICIAL: FormEmpresa = {
  nit: "",
  razonSocial: "",
  nombreComercial: "",
  direccionFiscal: "",
  telefono: "",
  correo: "",
  representanteLegal: "",
  actividadEconomica: "",
  estado: "Activa",
  observaciones: "",
};

const TABLAS_DEPENDENCIAS: Array<{
  tabla: string;
  descripcion: string;
  critica: boolean;
}> = [
  { tabla: "cheques", descripcion: "Cheques", critica: true },
  { tabla: "fondos_empresa", descripcion: "Fondos", critica: true },
  { tabla: "chequeras", descripcion: "Chequeras", critica: true },
  { tabla: "cheques_fisicos", descripcion: "Cheques fisicos", critica: true },
  { tabla: "ordenes_compra", descripcion: "Ordenes de compra", critica: true },
  { tabla: "tareas", descripcion: "Tareas", critica: true },
  { tabla: "movimientos", descripcion: "Movimientos operativos", critica: true },
  { tabla: "clientes", descripcion: "Clientes", critica: true },
  { tabla: "proveedores", descripcion: "Proveedores", critica: true },
  { tabla: "cuentas_por_pagar", descripcion: "Cuentas por pagar", critica: true },
  { tabla: "cuentas_por_cobrar", descripcion: "Cuentas por cobrar", critica: true },
  { tabla: "pagos_cuentas_por_pagar", descripcion: "Pagos CxP", critica: true },
  { tabla: "pagos_cuentas_por_cobrar", descripcion: "Pagos CxC", critica: true },
  { tabla: "documentos_tramites", descripcion: "Documentos", critica: true },
  { tabla: "documentos_contables_revision", descripcion: "Documentos contables", critica: true },
  { tabla: "calendario_eventos", descripcion: "Calendario operativo", critica: true },
  { tabla: "catalogo_cuentas", descripcion: "Catalogo contable", critica: true },
  { tabla: "periodos_contables", descripcion: "Periodos contables", critica: true },
  { tabla: "asientos_contables", descripcion: "Asientos contables", critica: true },
  { tabla: "usuario_empresas", descripcion: "Permisos de usuarios", critica: true },
  { tabla: "borradores_trabajo", descripcion: "Borradores de trabajo", critica: false },
  { tabla: "reinicios_controlados", descripcion: "Reinicios controlados", critica: true },
  { tabla: "auditoria_eventos", descripcion: "Auditoria", critica: true },
];

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function texto(valor?: string | null) {
  return (valor || "").trim();
}

function estadoNormalizado(valor?: string | null): EstadoEmpresa {
  const estado = texto(valor).toLowerCase();
  if (estado === "pendiente") return "Pendiente";
  if (estado === "inactiva" || estado === "inactivo") return "Inactiva";
  if (estado === "archivada" || estado === "archivado") return "Archivada";
  return "Activa";
}

function empresaNombre(empresa: Empresa) {
  return (
    texto(empresa.nombre_comercial) ||
    texto(empresa.nombre) ||
    texto(empresa.razon_social) ||
    `Empresa ${empresa.id}`
  );
}

function empresaRazonSocial(empresa: Empresa) {
  return texto(empresa.razon_social) || texto(empresa.nombre) || empresaNombre(empresa);
}

function empresaNit(empresa: Empresa) {
  return texto(empresa.nit) || texto(empresa.rtn);
}

function empresaDireccion(empresa: Empresa) {
  return texto(empresa.direccion_fiscal) || texto(empresa.direccion);
}

function motivosEmpresaPruebaOLimpieza(empresa: Empresa) {
  const nombre = [empresaNombre(empresa), empresaRazonSocial(empresa), texto(empresa.nombre)]
    .join(" ")
    .toLowerCase();
  const estado = estadoNormalizado(empresa.estado);
  const motivos: string[] = [];

  if (nombre.includes("control plus")) motivos.push("nombre_control_plus");
  if (nombre.includes("prueba")) motivos.push("nombre_prueba");
  if (nombre.includes("demo")) motivos.push("nombre_demo");
  if (nombre.includes("testing")) motivos.push("nombre_testing");
  if (estado === "Inactiva") motivos.push("estado_inactiva");
  if (estado === "Archivada") motivos.push("estado_archivada");

  return motivos;
}

function esEmpresaCandidataLimpieza(empresa: Empresa) {
  return motivosEmpresaPruebaOLimpieza(empresa).length > 0;
}

function limpiarForm(form: FormEmpresa) {
  return {
    nit: texto(form.nit),
    razonSocial: texto(form.razonSocial),
    nombreComercial: texto(form.nombreComercial),
    direccionFiscal: texto(form.direccionFiscal),
    telefono: texto(form.telefono),
    correo: texto(form.correo).toLowerCase(),
    representanteLegal: texto(form.representanteLegal),
    actividadEconomica: texto(form.actividadEconomica),
    estado: form.estado,
    observaciones: texto(form.observaciones),
  };
}

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

export default function EmpresasPage() {
  const router = useRouter();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [perfilActual, setPerfilActual] = useState<PerfilActual | null>(null);
  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("operativas");
  const [busqueda, setBusqueda] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormEmpresa>(FORM_INICIAL);
  const [dependencias, setDependencias] = useState<DependenciaEmpresa[]>([]);
  const [empresaPrevisualizada, setEmpresaPrevisualizada] =
    useState<Empresa | null>(null);

  useEffect(() => {
    async function iniciar() {
      try {
        setValidandoAcceso(true);
        const acceso = await validarAccesoModuloUsuario("empresas");

        if (!acceso.ok) {
          if (
            acceso.motivo === "sin_sesion" ||
            acceso.motivo === "sin_perfil" ||
            acceso.motivo === "usuario_inactivo"
          ) {
            if (acceso.motivo === "usuario_inactivo") {
              toast.error("Tu usuario esta inactivo. Contacta al administrador.");
            }

            router.replace("/login");
            return;
          }

          toast.error(
            acceso.motivo === "modulo_inactivo" ||
              acceso.motivo === "modulo_no_encontrado"
              ? "El modulo de Empresas esta desactivado."
              : "No tienes acceso al modulo de Empresas."
          );
          router.replace("/dashboard");
          return;
        }

        const perfil = acceso.perfil!;
        const rol = normalizarRol(perfil.rol);

        if (!["admin", "supervisor", "jefe"].includes(rol)) {
          router.replace("/dashboard");
          return;
        }

        const idsPermitidos = await obtenerEmpresasPermitidas(
          acceso.user!.id,
          perfil.rol || ""
        );

        setPerfilActual({
          id: perfil.id,
          nombre: perfil.nombre,
          rol,
        });
        setEmpresasPermitidasIds(idsPermitidos);
        await obtenerEmpresas(idsPermitidos);
        setAutorizado(true);
      } catch (error) {
        console.error("Error inicializando Empresas:", error);
        toast.error("No se pudo cargar el modulo de Empresas.");
      } finally {
        setValidandoAcceso(false);
      }
    }

    iniciar();
  }, [router]);

  const puedeCrearActualizar = ["admin", "jefe", "supervisor"].includes(
    perfilActual?.rol || ""
  );
  const puedeArchivar = ["admin", "jefe"].includes(perfilActual?.rol || "");

  async function auditarEmpresa(params: {
    empresaId?: number | null;
    accion: string;
    estadoAnterior?: string | null;
    estadoNuevo?: string | null;
    motivo?: string | null;
    descripcion: string;
    metadatos?: ValorJsonAuditoria | null;
  }) {
    try {
      await registrarAuditoriaEvento({
        empresa_id: params.empresaId ?? null,
        modulo: "empresas",
        accion: params.accion,
        entidad_tipo: "empresa",
        entidad_id: params.empresaId ?? null,
        estado_anterior: params.estadoAnterior,
        estado_nuevo: params.estadoNuevo,
        motivo: params.motivo,
        descripcion: params.descripcion,
        sensible: true,
        metadatos: params.metadatos || null,
        origen: "modulo_empresas",
      });
      return true;
    } catch (error) {
      console.error("La operacion de Empresas se guardo, pero fallo la auditoria:", error);
      return false;
    }
  }

  async function obtenerEmpresas(idsPermitidos = empresasPermitidasIds) {
    setMensaje("");

    if (!idsPermitidos.length) {
      setEmpresas([]);
      return;
    }

    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .in("id", idsPermitidos)
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    setEmpresas(data || []);
  }

  function validarEmpresaPermitida(id: number) {
    if (!empresasPermitidasIds.includes(Number(id))) {
      throw new Error("No tienes permiso para gestionar esta empresa.");
    }
  }

  function validarFormulario(formulario: FormEmpresa) {
    const limpio = limpiarForm(formulario);

    if (!limpio.razonSocial && !limpio.nombreComercial) {
      throw new Error("La razon social o el nombre comercial son obligatorios.");
    }

    if (limpio.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio.correo)) {
      throw new Error("El correo no tiene un formato valido.");
    }

    return limpio;
  }

  function payloadEmpresa(formulario: FormEmpresa) {
    const limpio = validarFormulario(formulario);
    const nombrePrincipal = limpio.nombreComercial || limpio.razonSocial;

    return {
      nit: limpio.nit || null,
      rtn: limpio.nit || null,
      razon_social: limpio.razonSocial || nombrePrincipal,
      nombre_comercial: limpio.nombreComercial || nombrePrincipal,
      nombre: nombrePrincipal,
      direccion_fiscal: limpio.direccionFiscal || null,
      direccion: limpio.direccionFiscal || null,
      telefono: limpio.telefono || null,
      correo: limpio.correo || null,
      representante_legal: limpio.representanteLegal || null,
      actividad_economica: limpio.actividadEconomica || null,
      estado: limpio.estado,
      observaciones: limpio.observaciones || null,
    };
  }

  async function guardarEmpresa() {
    if (!puedeCrearActualizar) {
      toast.error("No tienes permiso para guardar empresas.");
      return;
    }

    let payload: ReturnType<typeof payloadEmpresa>;

    try {
      payload = payloadEmpresa(form);
      if (editandoId !== null) validarEmpresaPermitida(editandoId);
    } catch (error) {
      toast.error(mensajeError(error));
      return;
    }

    setProcesando(true);
    setMensaje("");

    try {
      if (editandoId === null) {
        const { data, error } = await supabase
          .from("empresas")
          .insert([payload])
          .select("*")
          .single();

        if (error) throw error;

        const empresaCreada = data as Empresa;
        const auditoriaOk = await auditarEmpresa({
          empresaId: empresaCreada.id,
          accion: "crear_empresa",
          estadoNuevo: estadoNormalizado(empresaCreada.estado),
          descripcion: "Empresa creada desde modulo Empresas",
          metadatos: {
            nit: empresaNit(empresaCreada),
            razon_social: empresaRazonSocial(empresaCreada),
            nombre_comercial: empresaNombre(empresaCreada),
          },
        });

        setMensaje(
          auditoriaOk
            ? "Empresa creada correctamente."
            : "Empresa creada, pero fallo la auditoria administrativa."
        );
      } else {
        const empresaAnterior = empresas.find((empresa) => empresa.id === editandoId);
        const { data, error } = await supabase
          .from("empresas")
          .update(payload)
          .eq("id", editandoId)
          .select("*")
          .single();

        if (error) throw error;

        const empresaActualizada = data as Empresa;
        const auditoriaOk = await auditarEmpresa({
          empresaId: editandoId,
          accion: "actualizar_empresa",
          estadoAnterior: estadoNormalizado(empresaAnterior?.estado),
          estadoNuevo: estadoNormalizado(empresaActualizada.estado),
          descripcion: "Empresa actualizada desde modulo Empresas",
          metadatos: {
            anterior: empresaAnterior
              ? {
                  nit: empresaNit(empresaAnterior),
                  razon_social: empresaRazonSocial(empresaAnterior),
                  nombre_comercial: empresaNombre(empresaAnterior),
                  estado: estadoNormalizado(empresaAnterior.estado),
                }
              : null,
            nuevo: {
              nit: empresaNit(empresaActualizada),
              razon_social: empresaRazonSocial(empresaActualizada),
              nombre_comercial: empresaNombre(empresaActualizada),
              estado: estadoNormalizado(empresaActualizada.estado),
            },
          },
        });

        setMensaje(
          auditoriaOk
            ? "Empresa actualizada correctamente."
            : "Empresa actualizada, pero fallo la auditoria administrativa."
        );
      }

      limpiarEdicion();
      await obtenerEmpresas();
    } catch (error) {
      console.error("Error guardando empresa:", error);
      toast.error(mensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  function cargarParaEditar(empresa: Empresa) {
    validarEmpresaPermitida(empresa.id);
    setEditandoId(empresa.id);
    setForm({
      nit: empresaNit(empresa),
      razonSocial: empresaRazonSocial(empresa),
      nombreComercial: empresaNombre(empresa),
      direccionFiscal: empresaDireccion(empresa),
      telefono: texto(empresa.telefono),
      correo: texto(empresa.correo),
      representanteLegal: texto(empresa.representante_legal),
      actividadEconomica: texto(empresa.actividad_economica),
      estado: estadoNormalizado(empresa.estado),
      observaciones: texto(empresa.observaciones),
    });
    setDependencias([]);
    setEmpresaPrevisualizada(null);
  }

  function limpiarEdicion() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function cambiarEstadoEmpresa(
    empresa: Empresa,
    estadoNuevo: EstadoEmpresa,
    accion: string
  ) {
    if (estadoNuevo === "Archivada" && !puedeArchivar) {
      toast.error("Solo admin o jefe pueden archivar empresas.");
      return;
    }

    try {
      validarEmpresaPermitida(empresa.id);
    } catch (error) {
      toast.error(mensajeError(error));
      return;
    }

    const motivo = window.prompt(`Motivo para marcar la empresa como ${estadoNuevo}:`);

    if (!motivo || motivo.trim().length < 5) {
      toast.error("Debes escribir un motivo valido.");
      return;
    }

    const confirmar = window.confirm(
      `Confirmas cambiar el estado de ${empresaNombre(empresa)} a ${estadoNuevo}?`
    );

    if (!confirmar) return;

    setProcesando(true);
    setMensaje("");

    try {
      const estadoAnterior = estadoNormalizado(empresa.estado);
      const { error } = await supabase
        .from("empresas")
        .update({
          estado: estadoNuevo,
          observaciones:
            texto(empresa.observaciones) ||
            `Estado actualizado a ${estadoNuevo} desde modulo Empresas.`,
        })
        .eq("id", empresa.id);

      if (error) throw error;

      const auditoriaOk = await auditarEmpresa({
        empresaId: empresa.id,
        accion,
        estadoAnterior,
        estadoNuevo,
        motivo: motivo.trim(),
        descripcion: `Empresa marcada como ${estadoNuevo}`,
        metadatos: {
          nit: empresaNit(empresa),
          razon_social: empresaRazonSocial(empresa),
          nombre_comercial: empresaNombre(empresa),
        },
      });

      setMensaje(
        auditoriaOk
          ? `Empresa marcada como ${estadoNuevo}.`
          : `Empresa marcada como ${estadoNuevo}, pero fallo la auditoria.`
      );
      await obtenerEmpresas();
    } catch (error) {
      console.error("Error cambiando estado de empresa:", error);
      toast.error(mensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  async function contarDependencias(empresaId: number) {
    const resultados = await Promise.all(
      TABLAS_DEPENDENCIAS.map(async (dep) => {
        const { count, error } = await supabase
          .from(dep.tabla)
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId);

        if (error) {
          console.warn(`No se pudo previsualizar ${dep.tabla}:`, error.message);
          return { ...dep, conteo: 0 };
        }

        return { ...dep, conteo: count || 0 };
      })
    );

    return resultados;
  }

  async function previsualizarLimpieza(empresa: Empresa) {
    try {
      validarEmpresaPermitida(empresa.id);
    } catch (error) {
      toast.error(mensajeError(error));
      return;
    }

    setProcesando(true);
    setMensaje("");

    try {
      const deps = await contarDependencias(empresa.id);
      setDependencias(deps);
      setEmpresaPrevisualizada(empresa);

      const total = deps.reduce((acc, dep) => acc + dep.conteo, 0);
      const criticas = deps
        .filter((dep) => dep.critica)
        .reduce((acc, dep) => acc + dep.conteo, 0);

      await auditarEmpresa({
        empresaId: empresa.id,
        accion: "previsualizar_limpieza_empresa",
        estadoAnterior: estadoNormalizado(empresa.estado),
        descripcion: "Previsualizacion de limpieza segura de empresa",
        metadatos: {
          nombre: empresaNombre(empresa),
          candidata_limpieza: esEmpresaCandidataLimpieza(empresa),
          motivos_limpieza: motivosEmpresaPruebaOLimpieza(empresa),
          total_dependencias: total,
          dependencias_criticas: criticas,
          dependencias: deps.map((dep) => ({
            tabla: dep.tabla,
            descripcion: dep.descripcion,
            conteo: dep.conteo,
            critica: dep.critica,
          })),
          recomendacion:
            total > 0
              ? "No eliminar fisicamente; usar inactivacion o archivado."
              : "Sin dependencias visibles; preparar eliminacion segura con RPC administrativa si la politica lo permite.",
        },
      });

      setMensaje(
        total > 0
          ? "La empresa tiene dependencias. No se debe eliminar fisicamente; usa inactivar o archivar."
          : esEmpresaCandidataLimpieza(empresa)
            ? "No se detectaron dependencias visibles. Puedes eliminarla definitivamente con doble confirmacion."
            : "No se detectaron dependencias, pero no parece empresa de prueba/inactiva/archivada. No se permite eliminar fisicamente."
      );
    } catch (error) {
      console.error("Error previsualizando limpieza:", error);
      toast.error(mensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarEmpresaVacia(empresa: Empresa) {
    if (perfilActual?.rol !== "admin") {
      toast.error("Solo admin puede eliminar definitivamente una empresa vacia.");
      return;
    }

    try {
      validarEmpresaPermitida(empresa.id);
    } catch (error) {
      toast.error(mensajeError(error));
      return;
    }

    const deps =
      empresaPrevisualizada?.id === empresa.id && dependencias.length
        ? dependencias
        : await contarDependencias(empresa.id);
    const total = deps.reduce((acc, dep) => acc + dep.conteo, 0);
    const candidata = esEmpresaCandidataLimpieza(empresa);

    if (!candidata || estadoNormalizado(empresa.estado) === "Activa") {
      await auditarEmpresa({
        empresaId: empresa.id,
        accion: "bloquear_eliminacion_empresa",
        estadoAnterior: estadoNormalizado(empresa.estado),
        descripcion: "Eliminacion fisica bloqueada por empresa no candidata",
        metadatos: {
          nombre: empresaNombre(empresa),
          motivos_limpieza: motivosEmpresaPruebaOLimpieza(empresa),
          total_dependencias: total,
        },
      });
      toast.error("No se permite eliminar fisicamente empresas reales activas.");
      return;
    }

    if (total > 0) {
      await auditarEmpresa({
        empresaId: empresa.id,
        accion: "bloquear_eliminacion_empresa",
        estadoAnterior: estadoNormalizado(empresa.estado),
        descripcion: "Eliminacion fisica bloqueada por dependencias",
        metadatos: {
          nombre: empresaNombre(empresa),
          total_dependencias: total,
          dependencias: deps.map((dep) => ({
            tabla: dep.tabla,
            descripcion: dep.descripcion,
            conteo: dep.conteo,
            critica: dep.critica,
          })),
          instruccion: "Archivar o inactivar; no eliminar fisicamente.",
        },
      });
      toast.error("La empresa tiene dependencias. Solo se permite archivarla o inactivarla.");
      return;
    }

    const primera = window.confirm(
      `Vas a eliminar definitivamente "${empresaNombre(empresa)}". Esta accion solo es segura para empresas vacias. Deseas continuar?`
    );
    if (!primera) return;

    const confirmacion = window.prompt(
      'Escribe exactamente "ELIMINAR EMPRESA" para confirmar la eliminacion fisica:'
    );
    if (confirmacion !== "ELIMINAR EMPRESA") {
      toast.error("Confirmacion incorrecta. No se elimino la empresa.");
      return;
    }

    setProcesando(true);
    setMensaje("");

    try {
      const { data, error } = await supabase.rpc("eliminar_empresa_vacia_segura", {
        p_empresa_id: empresa.id,
        p_confirmacion: confirmacion,
      });

      if (error) throw error;
      if (data && typeof data === "object" && "ok" in data && data.ok === false) {
        toast.error(typeof data.mensaje === "string" ? data.mensaje : "No se pudo eliminar la empresa.");
        return;
      }

      setMensaje("Empresa vacia eliminada definitivamente de forma segura.");
      setEmpresaPrevisualizada(null);
      setDependencias([]);
      await obtenerEmpresas();
      console.info("Eliminacion segura de empresa:", data);
    } catch (error) {
      console.error("Error eliminando empresa vacia:", error);
      toast.error(mensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  const empresasFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    return empresas.filter((empresa) => {
      const estado = estadoNormalizado(empresa.estado);
      const coincideEstado =
        filtroEstado === "todas" ||
        (filtroEstado === "operativas" && estado !== "Archivada") ||
        (filtroEstado === "limpieza" && esEmpresaCandidataLimpieza(empresa)) ||
        estado.toLowerCase() === filtroEstado;

      if (!coincideEstado) return false;

      if (!textoBusqueda) return true;

      return [
        empresaNombre(empresa),
        empresaRazonSocial(empresa),
        empresaNit(empresa),
        empresa.correo || "",
        empresa.representante_legal || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda);
    });
  }, [busqueda, empresas, filtroEstado]);

  if (validandoAcceso || !autorizado) {
    return (
      <div className="flex bg-[#020617] min-h-screen items-center justify-center text-white">
        <Loader2 className="animate-spin mr-3 text-cyan-400" />
        Validando acceso...
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Sidebar />
      <Toaster position="top-right" />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-5xl font-black">Empresas</h1>
              <p className="text-gray-400 mt-2">
                Registro formal y control operativo por alcance autorizado
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Operador: {perfilActual?.nombre} | Rol: {perfilActual?.rol}
              </p>
            </div>

            <button
              onClick={() => obtenerEmpresas()}
              disabled={procesando}
              className="h-12 px-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-sm font-bold text-gray-300 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
          </header>

          {mensaje && (
            <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              {mensaje}
            </div>
          )}

          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black">
                  {editandoId === null ? "Nueva empresa" : `Editando #${editandoId}`}
                </h2>
                <p className="text-sm text-gray-500">
                  Datos fiscales y administrativos formales
                </p>
              </div>
              {editandoId !== null && (
                <button
                  onClick={limpiarEdicion}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Campo label="NIT">
                <input
                  value={form.nit}
                  onChange={(e) => setForm({ ...form, nit: e.target.value })}
                  className="input"
                  placeholder="NIT"
                />
              </Campo>

              <Campo label="Razon social">
                <input
                  value={form.razonSocial}
                  onChange={(e) =>
                    setForm({ ...form, razonSocial: e.target.value })
                  }
                  className="input"
                  placeholder="Razon social"
                />
              </Campo>

              <Campo label="Nombre comercial">
                <input
                  value={form.nombreComercial}
                  onChange={(e) =>
                    setForm({ ...form, nombreComercial: e.target.value })
                  }
                  className="input"
                  placeholder="Nombre comercial"
                />
              </Campo>

              <Campo label="Direccion fiscal" className="md:col-span-2">
                <input
                  value={form.direccionFiscal}
                  onChange={(e) =>
                    setForm({ ...form, direccionFiscal: e.target.value })
                  }
                  className="input"
                  placeholder="Direccion fiscal"
                />
              </Campo>

              <Campo label="Telefono">
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="input"
                  placeholder="Telefono"
                />
              </Campo>

              <Campo label="Correo">
                <input
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  className="input"
                  placeholder="correo@empresa.com"
                />
              </Campo>

              <Campo label="Representante legal">
                <input
                  value={form.representanteLegal}
                  onChange={(e) =>
                    setForm({ ...form, representanteLegal: e.target.value })
                  }
                  className="input"
                  placeholder="Representante legal"
                />
              </Campo>

              <Campo label="Actividad economica">
                <input
                  value={form.actividadEconomica}
                  onChange={(e) =>
                    setForm({ ...form, actividadEconomica: e.target.value })
                  }
                  className="input"
                  placeholder="Actividad economica"
                />
              </Campo>

              <Campo label="Estado">
                <select
                  value={form.estado}
                  onChange={(e) =>
                    setForm({ ...form, estado: e.target.value as EstadoEmpresa })
                  }
                  className="input"
                >
                  {ESTADOS_EMPRESA.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Observaciones" className="md:col-span-3">
                <textarea
                  value={form.observaciones}
                  onChange={(e) =>
                    setForm({ ...form, observaciones: e.target.value })
                  }
                  className="input min-h-24 py-4"
                  placeholder="Notas administrativas"
                />
              </Campo>
            </div>

            <button
              onClick={guardarEmpresa}
              disabled={procesando || !puedeCrearActualizar}
              className="mt-5 bg-cyan-500 hover:bg-cyan-400 transition px-6 py-4 rounded-2xl flex items-center gap-2 font-bold text-black disabled:opacity-50"
            >
              {editandoId === null ? <Plus size={20} /> : <Save size={20} />}
              {editandoId === null ? "Crear empresa" : "Guardar cambios"}
            </button>
          </section>

          <section className="mb-8 grid md:grid-cols-3 gap-4">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input md:col-span-2"
              placeholder="Buscar por NIT, razon social, nombre comercial o representante"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input"
            >
              <option value="operativas">Operativas</option>
              <option value="activa">Activas</option>
              <option value="pendiente">Pendientes</option>
              <option value="inactiva">Inactivas</option>
              <option value="archivada">Archivadas</option>
              <option value="limpieza">Candidatas a limpieza</option>
              <option value="todas">Todas</option>
            </select>
          </section>

          {empresaPrevisualizada && (
            <section className="mb-8 bg-orange-500/10 border border-orange-500/20 rounded-3xl p-6">
              {(() => {
                const totalDependencias = dependencias.reduce(
                  (acc, dep) => acc + dep.conteo,
                  0
                );
                const candidata = esEmpresaCandidataLimpieza(empresaPrevisualizada);
                const estado = estadoNormalizado(empresaPrevisualizada.estado);
                const puedeEliminarFisicamente =
                  perfilActual?.rol === "admin" &&
                  candidata &&
                  estado !== "Activa" &&
                  totalDependencias === 0;

                return (
                  <>
              <h2 className="text-orange-200 font-black mb-2">
                Previsualizacion de limpieza: {empresaNombre(empresaPrevisualizada)}
              </h2>
              <p className="text-sm text-gray-300 mb-4">
                Si existe cualquier dependencia, la limpieza permitida es inactivar o
                archivar. Auditoria, documentos, usuarios y permisos no se tocan.
              </p>
              <div className="mb-4 grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gray-500 text-xs uppercase font-black">Candidata</p>
                  <p className="font-bold">
                    {candidata ? "Si, prueba/inactiva/archivada" : "No, parece real/activa"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gray-500 text-xs uppercase font-black">Dependencias</p>
                  <p className="font-bold">{totalDependencias}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gray-500 text-xs uppercase font-black">Accion segura</p>
                  <p className="font-bold">
                    {totalDependencias > 0
                      ? "Archivar / inactivar"
                      : puedeEliminarFisicamente
                        ? "Eliminar con doble confirmacion"
                        : "No eliminar fisicamente"}
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {dependencias.map((dep) => (
                  <div
                    key={dep.tabla}
                    className={`rounded-2xl border p-4 ${
                      dep.conteo > 0
                        ? "border-orange-500/30 bg-orange-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="font-black text-sm">{dep.descripcion}</p>
                    <p className="text-xs text-gray-500">{dep.tabla}</p>
                    <p className="text-2xl font-black mt-2">{dep.conteo}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {estado !== "Archivada" && (
                  <button
                    onClick={() =>
                      cambiarEstadoEmpresa(
                        empresaPrevisualizada,
                        "Archivada",
                        "archivar_empresa_limpieza"
                      )
                    }
                    disabled={procesando || !puedeArchivar}
                    className="rounded-2xl bg-orange-500 px-5 py-3 font-black text-black disabled:opacity-50"
                  >
                    Archivar empresa
                  </button>
                )}
                <button
                  onClick={() => eliminarEmpresaVacia(empresaPrevisualizada)}
                  disabled={procesando || !puedeEliminarFisicamente}
                  className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-black text-red-200 disabled:opacity-40"
                >
                  Eliminar definitivamente
                </button>
              </div>
                  </>
                );
              })()}
            </section>
          )}

          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {empresasFiltradas.map((empresa) => {
              const estado = estadoNormalizado(empresa.estado);
              const candidataLimpieza = esEmpresaCandidataLimpieza(empresa);

              return (
                <div
                  key={empresa.id}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="bg-cyan-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                        <Building2 className="text-cyan-400" />
                      </div>
                      <h2 className="text-2xl font-bold truncate">
                        {empresaNombre(empresa)}
                      </h2>
                      <p className="text-gray-400 mt-2 text-sm">
                        Razon social: {empresaRazonSocial(empresa)}
                      </p>
                      <p className="text-gray-400 text-sm">
                        NIT: {empresaNit(empresa) || "Pendiente"}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Tel: {texto(empresa.telefono) || "N/A"}
                      </p>
                      <p className="text-gray-400 text-sm truncate">
                        {texto(empresa.correo) || "Sin correo"}
                      </p>
                      <p className="text-gray-500 mt-3 text-sm">
                        {empresaDireccion(empresa) || "Sin direccion fiscal"}
                      </p>
                      <p className="text-gray-500 mt-2 text-xs">
                        Representante:{" "}
                        {texto(empresa.representante_legal) || "Pendiente"}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <EstadoPill estado={estado} />
                        {candidataLimpieza && (
                          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase text-orange-300">
                            Candidata limpieza
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <BotonAccion
                      onClick={() => cargarParaEditar(empresa)}
                      disabled={procesando}
                      icon={<Edit3 size={16} />}
                      label="Editar"
                    />
                    <BotonAccion
                      onClick={() => previsualizarLimpieza(empresa)}
                      disabled={procesando}
                      icon={<Eye size={16} />}
                      label="Previsualizar"
                    />
                    {estado !== "Inactiva" && (
                      <BotonAccion
                        onClick={() =>
                          cambiarEstadoEmpresa(
                            empresa,
                            "Inactiva",
                            "inactivar_empresa"
                          )
                        }
                        disabled={procesando}
                        icon={<XCircle size={16} />}
                        label="Inactivar"
                      />
                    )}
                    {estado !== "Activa" && (
                      <BotonAccion
                        onClick={() =>
                          cambiarEstadoEmpresa(empresa, "Activa", "activar_empresa")
                        }
                        disabled={procesando}
                        icon={<CheckCircle2 size={16} />}
                        label="Activar"
                      />
                    )}
                    {estado !== "Archivada" && (
                      <BotonAccion
                        onClick={() =>
                          cambiarEstadoEmpresa(
                            empresa,
                            "Archivada",
                            "archivar_empresa"
                          )
                        }
                        disabled={procesando || !puedeArchivar}
                        icon={<Archive size={16} />}
                        label="Archivar"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {empresasFiltradas.length === 0 && (
              <div className="text-gray-500">No hay empresas para mostrar.</div>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .input {
          min-height: 3.5rem;
          width: 100%;
          border-radius: 1rem;
          background: #0b1120;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0 1.25rem;
          outline: none;
          color: white;
        }
        .input:focus {
          border-color: #06b6d4;
        }
        .input option {
          background: #0b1120;
          color: white;
        }
      `}</style>
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
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[10px] font-black text-gray-500 uppercase ml-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function EstadoPill({ estado }: { estado: EstadoEmpresa }) {
  const color =
    estado === "Activa"
      ? "bg-green-500/10 text-green-300 border-green-500/20"
      : estado === "Archivada"
        ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
        : estado === "Inactiva"
          ? "bg-red-500/10 text-red-300 border-red-500/20"
          : "bg-orange-500/10 text-orange-300 border-orange-500/20";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${color}`}
    >
      {estado}
    </span>
  );
}

function BotonAccion({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 text-xs font-black text-gray-300 flex items-center justify-center gap-2 disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}
