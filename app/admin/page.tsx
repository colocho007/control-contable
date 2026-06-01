"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarUsuarioActivo } from "../../lib/validarUsuarioActivo";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import {
  registrarAuditoriaEvento,
  type RegistrarAuditoriaEventoParams,
} from "../../lib/auditoria";
import {
  FUNCIONES_OPERATIVAS,
  type FuncionOperativa,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import {
  Building2,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface Perfil {
  id: string;
  nombre: string;
  correo?: string | null;
  rol: string;
  activo?: boolean | null;
}

interface Empresa {
  id: number;
  nombre: string;
}

interface ModuloSistema {
  id: number;
  clave: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

interface UsuarioEmpresa {
  id: number;
  usuario_id: string;
  empresa_id: number;
  activo?: boolean | null;
  perfiles?: { nombre?: string | null; rol?: string | null } | null;
  empresas?: { nombre?: string | null } | null;
}

interface UsuarioModulo {
  id: number;
  usuario_id: string;
  modulo_clave: string;
  activo?: boolean | null;
}

interface TrabajoActivo {
  id: string | number;
  usuario_id: string;
  empresa_id: number | null;
  modulo: string;
  ruta: string | null;
  titulo: string | null;
  actualizado_at: string | null;
  perfiles?: { nombre?: string | null; rol?: string | null } | null;
  empresas?: { nombre?: string | null } | null;
}

interface AsignacionEmpresaExistente {
  id: number;
  empresa_id: number;
  activo?: boolean | null;
}

interface AsignacionModuloExistente {
  id: number;
  modulo_clave: string;
  activo?: boolean | null;
}

interface AsignacionFuncionExistente {
  id: number;
  empresa_id: number;
  funcion: string;
  activo?: boolean | null;
}

const ROLES_ADMIN_OPERATIVO = ["admin", "jefe", "supervisor"];
const ROLES_SISTEMA = [
  "admin",
  "jefe",
  "supervisor",
  "contador",
  "tesorero",
  "firmante",
  "firmante_oc",
  "iniciador",
  "iniciador_gestion",
  "empleado",
];
const MOTIVO_CAMBIO_PERMISOS = "Actualizacion desde Administrador Operativo";
const FUNCIONES_POR_MODULO: Record<string, FuncionOperativa[]> = {
  Cheques: ["firmante_cheque", "autorizador_cheque", "pagador_cheque", "revisor_cheque"],
  Ordenes: ["creador_orden", "firmante_orden", "autorizador_compra"],
  Contabilidad: ["auxiliar_contable", "contador_revisor"],
  Auditoria: ["auditor_solo_lectura"],
};

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function valoresUnicosNumericos(valores: number[]) {
  return Array.from(
    new Set(valores.map(Number).filter((valor) => Number.isFinite(valor)))
  );
}

function valoresUnicosTexto(valores: string[]) {
  return Array.from(
    new Set(valores.map((valor) => valor.trim()).filter(Boolean))
  );
}

function estadoPerfil(rol: string | null | undefined, activo: boolean | null | undefined) {
  return `rol=${rol || "sin_rol"};activo=${activo === false ? "inactivo" : "activo"}`;
}

function funcionOperativa(rol: string) {
  const normalizado = normalizarRol(rol);
  const funciones: Record<string, string> = {
    admin: "Administracion operativa completa",
    jefe: "Supervision y administracion operativa",
    supervisor: "Gestion operativa multiempresa",
    contador: "Registro y revision contable",
    tesorero: "Gestion financiera y pagos",
    firmante: "Firma y autorizacion",
    firmante_oc: "Firma de ordenes de compra",
    iniciador: "Inicio de gestiones",
    iniciador_gestion: "Inicio de ordenes y gestiones",
    empleado: "Operacion asignada",
  };
  return funciones[normalizado] || "Funcion operativa no definida";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function formatearFechaHora(valor: string | null | undefined) {
  if (!valor) return "-";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "-";

  return fecha.toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasPermitidasIds, setEmpresasPermitidasIds] = useState<number[]>([]);
  const [asignaciones, setAsignaciones] = useState<UsuarioEmpresa[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [usuarioModulos, setUsuarioModulos] = useState<UsuarioModulo[]>([]);
  const [usuarioFunciones, setUsuarioFunciones] = useState<UsuarioFuncionOperativa[]>([]);
  const [trabajosActivos, setTrabajosActivos] = useState<TrabajoActivo[]>([]);

  const [validandoAcceso, setValidandoAcceso] = useState(true);
  const [cargandoAdmin, setCargandoAdmin] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [usuarioEditando, setUsuarioEditando] = useState("");
  const [rolSeleccionado, setRolSeleccionado] = useState("");
  const [activoSeleccionado, setActivoSeleccionado] = useState(true);
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<number[]>([]);
  const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>([]);
  const [funcionesSeleccionadas, setFuncionesSeleccionadas] = useState<Record<number, string[]>>({});

  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: "",
    correo: "",
    uid: "",
    rol: "empleado",
  });

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    try {
      setValidandoAcceso(true);
      setCargandoAdmin(false);

      const validacion = await validarUsuarioActivo();

      if (!validacion.ok) {
        if (validacion.motivo === "usuario_inactivo") {
          toast.error("Tu usuario esta inactivo. Contacta al administrador.");
        }

        window.location.href = "/login";
        return;
      }

      const perfil = validacion.perfil!;
      const rolActual = normalizarRol(perfil.rol);

      if (!ROLES_ADMIN_OPERATIVO.includes(rolActual)) {
        toast.error("No tienes permiso para entrar al Administrador Operativo");
        window.location.href = "/dashboard";
        return;
      }

      const idsPermitidos = await obtenerEmpresasPermitidas(
        validacion.user!.id,
        perfil.rol || ""
      );

      setPerfilActual({ ...perfil, rol: rolActual });
      setEmpresasPermitidasIds(idsPermitidos);
      setAutorizado(true);
      setValidandoAcceso(false);
      setCargandoAdmin(true);
      await cargarDatos(idsPermitidos);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando Administrador Operativo");
    } finally {
      setCargandoAdmin(false);
      setValidandoAcceso(false);
    }
  }

  async function registrarAuditoriaAdmin(
    params: RegistrarAuditoriaEventoParams,
    contexto: string
  ) {
    try {
      await registrarAuditoriaEvento(params);
      return true;
    } catch (error) {
      console.error(
        `El cambio de ${contexto} se guardo, pero no se pudo registrar la auditoria:`,
        error
      );
      return false;
    }
  }

  async function cargarDatos(idsPermitidos = empresasPermitidasIds) {
    const ids = valoresUnicosNumericos(idsPermitidos);

    if (!ids.length) {
      setUsuarios([]);
      setEmpresas([]);
      setAsignaciones([]);
      setModulos([]);
      setUsuarioModulos([]);
      setUsuarioFunciones([]);
      setTrabajosActivos([]);
      return;
    }

    const [
      resUsuarios,
      resEmpresas,
      resAsignaciones,
      resModulos,
      resUsuarioModulos,
      resUsuarioFunciones,
      resTrabajos,
    ] = await Promise.all([
      supabase
        .from("perfiles")
        .select("id,nombre,correo,rol,activo")
        .order("nombre", { ascending: true }),
      supabase
        .from("empresas")
        .select("id,nombre")
        .in("id", ids)
        .order("nombre", { ascending: true }),
      supabase
        .from("usuario_empresas")
        .select(
          "id,usuario_id,empresa_id,activo,perfiles:usuario_id(nombre,rol),empresas:empresa_id(nombre)"
        )
        .in("empresa_id", ids)
        .order("id", { ascending: false }),
      supabase
        .from("modulos_sistema")
        .select("id,clave,nombre,activo,orden")
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("usuario_modulos")
        .select("id,usuario_id,modulo_clave,activo"),
      supabase
        .from("usuario_funciones_operativas")
        .select("id,usuario_id,empresa_id,funcion,activo")
        .in("empresa_id", ids),
      supabase
        .from("borradores_trabajo")
        .select(
          "id,usuario_id,empresa_id,modulo,ruta,titulo,actualizado_at,perfiles:usuario_id(nombre,rol),empresas:empresa_id(nombre)"
        )
        .in("empresa_id", ids)
        .eq("estado", "activo")
        .order("actualizado_at", { ascending: false })
        .limit(50),
    ]);

    if (resUsuarios.error) throw resUsuarios.error;
    if (resEmpresas.error) throw resEmpresas.error;
    if (resAsignaciones.error) throw resAsignaciones.error;
    if (resModulos.error) throw resModulos.error;
    if (resUsuarioModulos.error) throw resUsuarioModulos.error;
    if (resUsuarioFunciones.error) {
      console.warn("No se pudieron cargar funciones operativas:", resUsuarioFunciones.error);
      setUsuarioFunciones([]);
    } else {
      setUsuarioFunciones((resUsuarioFunciones.data || []) as UsuarioFuncionOperativa[]);
    }

    if (resTrabajos.error) {
      console.warn("No se pudieron cargar usuarios trabajando:", resTrabajos.error);
      setTrabajosActivos([]);
    } else {
      setTrabajosActivos((resTrabajos.data || []) as TrabajoActivo[]);
    }

    setUsuarios((resUsuarios.data || []) as Perfil[]);
    setEmpresas((resEmpresas.data || []) as Empresa[]);
    setAsignaciones((resAsignaciones.data || []) as UsuarioEmpresa[]);
    setModulos(((resModulos.data || []) as ModuloSistema[]).filter((m) => m.clave !== "admin"));
    setUsuarioModulos((resUsuarioModulos.data || []) as UsuarioModulo[]);
  }

  function cargarUsuarioParaEditar(usuarioId: string) {
    if (!usuarioId) {
      setUsuarioEditando("");
      setRolSeleccionado("");
      setActivoSeleccionado(true);
      setEmpresasSeleccionadas([]);
      setModulosSeleccionados([]);
      setFuncionesSeleccionadas({});
      return;
    }

    const usuario = usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return;

    const empresasDelUsuario = asignaciones
      .filter((a) => a.usuario_id === usuarioId && a.activo !== false)
      .map((a) => Number(a.empresa_id));

    const modulosDelUsuario = usuarioModulos
      .filter((m) => m.usuario_id === usuarioId && m.activo !== false)
      .map((m) => m.modulo_clave);
    const funcionesDelUsuario = usuarioFunciones
      .filter((f) => f.usuario_id === usuarioId && f.activo !== false)
      .reduce<Record<number, string[]>>((acc, funcion) => {
        const empresaId = Number(funcion.empresa_id);
        acc[empresaId] = [...(acc[empresaId] || []), funcion.funcion];
        return acc;
      }, {});

    setUsuarioEditando(usuario.id);
    setRolSeleccionado(normalizarRol(usuario.rol) || "empleado");
    setActivoSeleccionado(usuario.activo !== false);
    setEmpresasSeleccionadas(valoresUnicosNumericos(empresasDelUsuario));
    setModulosSeleccionados(valoresUnicosTexto(modulosDelUsuario));
    setFuncionesSeleccionadas(funcionesDelUsuario);
  }

  function toggleEmpresa(empresaId: number) {
    setEmpresasSeleccionadas((prev) =>
      prev.includes(empresaId)
        ? prev.filter((id) => id !== empresaId)
        : [...prev, empresaId]
    );
  }

  function toggleModulo(moduloClave: string) {
    setModulosSeleccionados((prev) =>
      prev.includes(moduloClave)
        ? prev.filter((clave) => clave !== moduloClave)
        : [...prev, moduloClave]
    );
  }

  function toggleFuncionOperativa(empresaId: number, funcion: string) {
    setFuncionesSeleccionadas((prev) => {
      const actuales = prev[empresaId] || [];
      const nuevos = actuales.includes(funcion)
        ? actuales.filter((item) => item !== funcion)
        : [...actuales, funcion];
      return { ...prev, [empresaId]: nuevos };
    });
  }

  async function crearUsuarioOperativo() {
    if (!nuevoUsuario.nombre.trim() || !nuevoUsuario.correo.trim() || !nuevoUsuario.uid.trim()) {
      toast.error("Completa nombre, correo y UID de Supabase Auth");
      return;
    }

    setProcesando(true);
    const toastId = toast.loading("Creando usuario operativo...");

    try {
      const respuesta = await fetch("/api/admin/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoUsuario),
      });

      const resultado = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        throw new Error(resultado?.error || "No se pudo crear el usuario.");
      }

      setNuevoUsuario({ nombre: "", correo: "", uid: "", rol: "empleado" });
      await cargarDatos();
      toast.success(resultado?.advertencia || "Usuario creado correctamente", {
        id: toastId,
      });
    } catch (error) {
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function guardarPermisosUsuario() {
    if (!usuarioEditando) {
      toast.error("Selecciona un usuario");
      return;
    }

    const rolNormalizado = normalizarRol(rolSeleccionado);
    if (!ROLES_SISTEMA.includes(rolNormalizado)) {
      toast.error("El rol seleccionado no es valido");
      return;
    }

    if (!perfilActual?.id) {
      toast.error("No se pudo identificar al operador actual");
      return;
    }

    if (
      usuarioEditando === perfilActual.id &&
      (!activoSeleccionado || rolNormalizado !== "admin")
    ) {
      toast.error("No puedes quitar tu propio acceso administrativo");
      return;
    }

    const empresasValidas = new Set(empresas.map((empresa) => Number(empresa.id)));
    const empresasUnicas = valoresUnicosNumericos(empresasSeleccionadas);
    const empresaInvalida = empresasUnicas.find((empresaId) => !empresasValidas.has(empresaId));
    if (empresaInvalida !== undefined) {
      toast.error("Hay una empresa seleccionada fuera del alcance permitido");
      return;
    }

    const modulosValidos = new Set(modulos.map((modulo) => modulo.clave));
    const modulosUnicos = valoresUnicosTexto(modulosSeleccionados);
    const moduloInvalido = modulosUnicos.find((moduloClave) => !modulosValidos.has(moduloClave));
    if (moduloInvalido) {
      toast.error("Hay un modulo seleccionado que no es valido");
      return;
    }

    const funcionesNormalizadas = Object.fromEntries(
      Object.entries(funcionesSeleccionadas)
        .map(([empresaId, funciones]) => [
          Number(empresaId),
          valoresUnicosTexto(funciones).filter((funcion) =>
            FUNCIONES_OPERATIVAS.includes(funcion as FuncionOperativa)
          ),
        ])
        .filter(([empresaId, funciones]) =>
          empresasUnicas.includes(Number(empresaId)) && (funciones as string[]).length > 0
        )
    ) as Record<number, string[]>;

    setProcesando(true);
    const toastId = toast.loading("Guardando usuario, empresas, modulos y funciones...");
    let auditoriaCompleta = true;

    try {
      const usuarioAnterior = usuarios.find((usuario) => usuario.id === usuarioEditando);
      const datosAuditoria = {
        actualizado_at: new Date().toISOString(),
        actualizado_por: perfilActual.id,
        motivo_cambio: MOTIVO_CAMBIO_PERMISOS,
      };

      const { error: perfilError } = await supabase
        .from("perfiles")
        .update({ rol: rolNormalizado, activo: activoSeleccionado })
        .eq("id", usuarioEditando);

      if (perfilError) throw perfilError;

      if (
        !usuarioAnterior ||
        normalizarRol(usuarioAnterior.rol) !== rolNormalizado ||
        usuarioAnterior.activo !== activoSeleccionado
      ) {
        auditoriaCompleta =
          (await registrarAuditoriaAdmin(
            {
              modulo: "admin-operativo",
              accion: "actualizar_usuario_operativo",
              entidad_tipo: "perfil",
              entidad_id: usuarioEditando,
              estado_anterior: usuarioAnterior
                ? estadoPerfil(usuarioAnterior.rol, usuarioAnterior.activo)
                : null,
              estado_nuevo: estadoPerfil(rolNormalizado, activoSeleccionado),
              descripcion: "Usuario actualizado desde Administrador Operativo",
              sensible: true,
              metadatos: {
                nombre: usuarioAnterior?.nombre ?? null,
                funcion_operativa: funcionOperativa(rolNormalizado),
              },
              origen: "admin_operativo",
            },
            "usuario operativo"
          )) && auditoriaCompleta;
      }

      await sincronizarEmpresasUsuario(
        usuarioEditando,
        empresasUnicas,
        datosAuditoria,
        (ok) => {
          auditoriaCompleta = auditoriaCompleta && ok;
        }
      );
      await sincronizarModulosUsuario(
        usuarioEditando,
        modulosUnicos,
        datosAuditoria,
        (ok) => {
          auditoriaCompleta = auditoriaCompleta && ok;
        }
      );
      await sincronizarFuncionesUsuario(
        usuarioEditando,
        empresasUnicas,
        funcionesNormalizadas,
        datosAuditoria,
        (ok) => {
          auditoriaCompleta = auditoriaCompleta && ok;
        }
      );

      await cargarDatos();
      setUsuarioEditando("");
      setRolSeleccionado("");
      setActivoSeleccionado(true);
      setEmpresasSeleccionadas([]);
      setModulosSeleccionados([]);
      setFuncionesSeleccionadas({});

      if (auditoriaCompleta) {
        toast.success("Administrador Operativo actualizado", { id: toastId });
      } else {
        toast.error("Cambios guardados, pero fallo parte de la auditoria", {
          id: toastId,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error), { id: toastId });
    } finally {
      setProcesando(false);
    }
  }

  async function sincronizarEmpresasUsuario(
    usuarioId: string,
    empresasSeleccionadasNormalizadas: number[],
    datosAuditoria: Record<string, string>,
    registrarResultado: (ok: boolean) => void
  ) {
    const { data, error } = await supabase
      .from("usuario_empresas")
      .select("id,empresa_id,activo")
      .eq("usuario_id", usuarioId)
      .in("empresa_id", empresasPermitidasIds);

    if (error) throw error;

    const existentes = (data || []) as AsignacionEmpresaExistente[];
    const seleccionadas = new Set(empresasSeleccionadasNormalizadas);
    const existentesPorEmpresa = new Map<number, AsignacionEmpresaExistente[]>();

    for (const asignacion of existentes) {
      const empresaId = Number(asignacion.empresa_id);
      const grupo = existentesPorEmpresa.get(empresaId) || [];
      grupo.push(asignacion);
      existentesPorEmpresa.set(empresaId, grupo);
    }

    const idsCanonicosSeleccionados = new Set<number>();
    for (const empresaId of seleccionadas) {
      const grupo = existentesPorEmpresa.get(empresaId) || [];
      const canonica = grupo.find((item) => item.activo === true) || grupo[0];
      if (canonica) idsCanonicosSeleccionados.add(canonica.id);
    }

    const activar = existentes.filter(
      (item) => item.activo !== true && idsCanonicosSeleccionados.has(item.id)
    );
    const desactivar = existentes.filter(
      (item) =>
        item.activo !== false &&
        (!seleccionadas.has(Number(item.empresa_id)) ||
          !idsCanonicosSeleccionados.has(item.id))
    );
    const nuevas = empresasSeleccionadasNormalizadas
      .filter((empresaId) => !existentesPorEmpresa.has(Number(empresaId)))
      .map((empresaId) => ({
        usuario_id: usuarioId,
        empresa_id: empresaId,
        activo: true,
        ...datosAuditoria,
      }));

    if (activar.length) {
      const { error: activarError } = await supabase
        .from("usuario_empresas")
        .update({ activo: true, ...datosAuditoria })
        .in("id", activar.map((item) => item.id));
      if (activarError) throw activarError;
    }

    if (desactivar.length) {
      const { error: desactivarError } = await supabase
        .from("usuario_empresas")
        .update({ activo: false, ...datosAuditoria })
        .in("id", desactivar.map((item) => item.id));
      if (desactivarError) throw desactivarError;
    }

    if (nuevas.length) {
      const { error: insertarError } = await supabase
        .from("usuario_empresas")
        .insert(nuevas);
      if (insertarError) throw insertarError;
    }

    if (activar.length || desactivar.length || nuevas.length) {
      const ok = await registrarAuditoriaAdmin(
        {
          modulo: "admin-operativo",
          accion: "sincronizar_empresas_usuario",
          entidad_tipo: "usuario_empresas",
          entidad_id: usuarioId,
          descripcion: "Empresas de usuario sincronizadas desde Administrador Operativo",
          sensible: true,
          metadatos: {
            activadas: activar.map((item) => Number(item.empresa_id)),
            desactivadas: desactivar.map((item) => Number(item.empresa_id)),
            insertadas: nuevas.map((item) => Number(item.empresa_id)),
          },
          origen: "admin_operativo",
        },
        "empresas de usuario"
      );
      registrarResultado(ok);
    }
  }

  async function sincronizarModulosUsuario(
    usuarioId: string,
    modulosSeleccionadosNormalizados: string[],
    datosAuditoria: Record<string, string>,
    registrarResultado: (ok: boolean) => void
  ) {
    const { data, error } = await supabase
      .from("usuario_modulos")
      .select("id,modulo_clave,activo")
      .eq("usuario_id", usuarioId);

    if (error) throw error;

    const existentes = (data || []) as AsignacionModuloExistente[];
    const seleccionados = new Set(modulosSeleccionadosNormalizados);
    const existentesPorClave = new Map<string, AsignacionModuloExistente[]>();

    for (const modulo of existentes) {
      const grupo = existentesPorClave.get(modulo.modulo_clave) || [];
      grupo.push(modulo);
      existentesPorClave.set(modulo.modulo_clave, grupo);
    }

    const idsCanonicosSeleccionados = new Set<number>();
    for (const moduloClave of seleccionados) {
      const grupo = existentesPorClave.get(moduloClave) || [];
      const canonico = grupo.find((item) => item.activo === true) || grupo[0];
      if (canonico) idsCanonicosSeleccionados.add(canonico.id);
    }

    const activar = existentes.filter(
      (item) => item.activo !== true && idsCanonicosSeleccionados.has(item.id)
    );
    const desactivar = existentes.filter(
      (item) =>
        item.activo !== false &&
        (!seleccionados.has(item.modulo_clave) ||
          !idsCanonicosSeleccionados.has(item.id))
    );
    const nuevos = modulosSeleccionadosNormalizados
      .filter((moduloClave) => !existentesPorClave.has(moduloClave))
      .map((moduloClave) => ({
        usuario_id: usuarioId,
        modulo_clave: moduloClave,
        activo: true,
        ...datosAuditoria,
      }));

    if (activar.length) {
      const { error: activarError } = await supabase
        .from("usuario_modulos")
        .update({ activo: true, ...datosAuditoria })
        .in("id", activar.map((item) => item.id));
      if (activarError) throw activarError;
    }

    if (desactivar.length) {
      const { error: desactivarError } = await supabase
        .from("usuario_modulos")
        .update({ activo: false, ...datosAuditoria })
        .in("id", desactivar.map((item) => item.id));
      if (desactivarError) throw desactivarError;
    }

    if (nuevos.length) {
      const { error: insertarError } = await supabase
        .from("usuario_modulos")
        .insert(nuevos);
      if (insertarError) throw insertarError;
    }

    if (activar.length || desactivar.length || nuevos.length) {
      const ok = await registrarAuditoriaAdmin(
        {
          modulo: "admin-operativo",
          accion: "sincronizar_modulos_usuario",
          entidad_tipo: "usuario_modulos",
          entidad_id: usuarioId,
          descripcion: "Modulos de usuario sincronizados desde Administrador Operativo",
          sensible: true,
          metadatos: {
            activados: activar.map((item) => item.modulo_clave),
            desactivados: desactivar.map((item) => item.modulo_clave),
            insertados: nuevos.map((item) => item.modulo_clave),
          },
          origen: "admin_operativo",
        },
        "modulos de usuario"
      );
      registrarResultado(ok);
    }
  }

  async function sincronizarFuncionesUsuario(
    usuarioId: string,
    empresasSeleccionadasNormalizadas: number[],
    funcionesPorEmpresa: Record<number, string[]>,
    datosAuditoria: Record<string, string>,
    registrarResultado: (ok: boolean) => void
  ) {
    const { data, error } = await supabase
      .from("usuario_funciones_operativas")
      .select("id,empresa_id,funcion,activo")
      .eq("usuario_id", usuarioId)
      .in("empresa_id", empresasPermitidasIds);

    if (error) throw error;

    const existentes = (data || []) as AsignacionFuncionExistente[];
    const empresasSeleccionadasSet = new Set(empresasSeleccionadasNormalizadas);
    const seleccionadas = new Set<string>();

    for (const [empresaIdTexto, funciones] of Object.entries(funcionesPorEmpresa)) {
      const empresaId = Number(empresaIdTexto);
      if (!empresasSeleccionadasSet.has(empresaId)) continue;
      for (const funcion of funciones) {
        seleccionadas.add(`${empresaId}:${funcion}`);
      }
    }

    const existentesPorClave = new Map<string, AsignacionFuncionExistente[]>();
    for (const item of existentes) {
      const clave = `${Number(item.empresa_id)}:${item.funcion}`;
      const grupo = existentesPorClave.get(clave) || [];
      grupo.push(item);
      existentesPorClave.set(clave, grupo);
    }

    const idsCanonicosSeleccionados = new Set<number>();
    for (const clave of seleccionadas) {
      const grupo = existentesPorClave.get(clave) || [];
      const canonico = grupo.find((item) => item.activo === true) || grupo[0];
      if (canonico) idsCanonicosSeleccionados.add(canonico.id);
    }

    const activar = existentes.filter(
      (item) => item.activo !== true && idsCanonicosSeleccionados.has(item.id)
    );
    const desactivar = existentes.filter((item) => {
      const clave = `${Number(item.empresa_id)}:${item.funcion}`;
      return (
        item.activo !== false &&
        (!seleccionadas.has(clave) || !idsCanonicosSeleccionados.has(item.id))
      );
    });
    const nuevas = Array.from(seleccionadas)
      .filter((clave) => !existentesPorClave.has(clave))
      .map((clave) => {
        const [empresaId, funcion] = clave.split(":");
        return {
          usuario_id: usuarioId,
          empresa_id: Number(empresaId),
          funcion,
          activo: true,
          ...datosAuditoria,
        };
      });

    if (activar.length) {
      const { error: activarError } = await supabase
        .from("usuario_funciones_operativas")
        .update({ activo: true, ...datosAuditoria })
        .in("id", activar.map((item) => item.id));
      if (activarError) throw activarError;
    }

    if (desactivar.length) {
      const { error: desactivarError } = await supabase
        .from("usuario_funciones_operativas")
        .update({ activo: false, ...datosAuditoria })
        .in("id", desactivar.map((item) => item.id));
      if (desactivarError) throw desactivarError;
    }

    if (nuevas.length) {
      const { error: insertarError } = await supabase
        .from("usuario_funciones_operativas")
        .insert(nuevas);
      if (insertarError) throw insertarError;
    }

    if (activar.length || desactivar.length || nuevas.length) {
      const ok = await registrarAuditoriaAdmin(
        {
          modulo: "admin-operativo",
          accion: "sincronizar_funciones_operativas_usuario",
          entidad_tipo: "usuario_funciones_operativas",
          entidad_id: usuarioId,
          descripcion: "Funciones operativas de usuario sincronizadas desde Administrador Operativo",
          sensible: true,
          metadatos: {
            activadas: activar.map((item) => `${item.empresa_id}:${item.funcion}`),
            desactivadas: desactivar.map((item) => `${item.empresa_id}:${item.funcion}`),
            insertadas: nuevas.map((item) => `${item.empresa_id}:${item.funcion}`),
          },
          origen: "admin_operativo",
        },
        "funciones operativas de usuario"
      );
      registrarResultado(ok);
    }
  }

  const usuariosActivos = usuarios.filter((usuario) => usuario.activo !== false);
  const usuariosInactivos = usuarios.filter((usuario) => usuario.activo === false);
  const asignacionesActivas = asignaciones.filter((item) => item.activo !== false);
  const modulosAsignadosActivos = usuarioModulos.filter((item) => item.activo !== false);
  const funcionesActivas = usuarioFunciones.filter((item) => item.activo !== false);

  const resumen = useMemo(
    () => ({
      activos: usuariosActivos.length,
      inactivos: usuariosInactivos.length,
      empresas: empresas.length,
      trabajando: trabajosActivos.length,
    }),
    [empresas.length, trabajosActivos.length, usuariosActivos.length, usuariosInactivos.length]
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
          <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500 flex items-center justify-center text-black">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h1 className="text-5xl font-black tracking-tight">
                    Administrador Operativo
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">
                    Usuarios, empresas asignadas, modulos asignados y estado operativo
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Operador: {perfilActual?.nombre} | Rol: {perfilActual?.rol?.toUpperCase()}
              </p>
            </div>
            {!cargandoAdmin && (
              <button
                onClick={() => cargarDatos()}
                disabled={procesando}
                className="h-12 px-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-sm font-bold text-gray-300 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCcw size={16} />
                Actualizar
              </button>
            )}
          </header>

          {cargandoAdmin ? (
            <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-10 flex items-center justify-center text-cyan-400">
              <Loader2 className="animate-spin mr-2" />
              Cargando Administrador Operativo...
            </section>
          ) : (
            <>
              <section className="grid md:grid-cols-4 gap-5 mb-10">
                <CardResumen icon={<Users size={22} />} label="Usuarios activos" value={resumen.activos} color="text-green-400" />
                <CardResumen icon={<XCircle size={22} />} label="Usuarios inactivos" value={resumen.inactivos} color="text-red-400" />
                <CardResumen icon={<Building2 size={22} />} label="Empresas permitidas" value={resumen.empresas} color="text-cyan-400" />
                <CardResumen icon={<UserCog size={22} />} label="Trabajando ahora" value={resumen.trabajando} color="text-yellow-400" />
              </section>

              <section className="mb-10">
                <PanelResumenUsuariosOperativos
                  usuarios={usuarios}
                  asignaciones={asignacionesActivas}
                  modulos={modulosAsignadosActivos}
                  funciones={funcionesActivas}
                  empresas={empresas}
                  catalogoModulos={modulos}
                  trabajos={trabajosActivos}
                  usuarioSeleccionado={usuarioEditando}
                  onSeleccionar={cargarUsuarioParaEditar}
                />
              </section>

              <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-10 border-l-4 border-l-green-500">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <Plus size={16} className="text-green-400" />
                      Crear usuario operativo
                    </h2>
                    <p className="text-xs text-gray-500 mt-2">
                      El UID y correo deben existir en Supabase Auth.
                    </p>
                  </div>
                  <Link
                    href="/usuarios"
                    className="text-xs font-black text-cyan-300 hover:text-cyan-200"
                  >
                    Ver modulo Usuarios
                  </Link>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <input
                    value={nuevoUsuario.nombre}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                    className="input-custom"
                    placeholder="Nombre completo"
                  />
                  <input
                    type="email"
                    value={nuevoUsuario.correo}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, correo: e.target.value })}
                    className="input-custom"
                    placeholder="Correo"
                  />
                  <input
                    value={nuevoUsuario.uid}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, uid: e.target.value })}
                    className="input-custom font-mono"
                    placeholder="UID Supabase Auth"
                  />
                  <select
                    value={nuevoUsuario.rol}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                    className="input-custom"
                  >
                    {ROLES_SISTEMA.filter((rol) => rol !== "admin").map((rol) => (
                      <option key={rol} value={rol}>{rol}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={crearUsuarioOperativo}
                  disabled={procesando}
                  className="mt-5 h-12 px-5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase disabled:opacity-50"
                >
                  Crear usuario
                </button>
              </section>

              <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-10 border-l-4 border-l-cyan-500">
                <div className="mb-6">
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-cyan-400" />
                    Editar usuario: rol, estado, empresas, modulos y funciones
                  </h2>
                  <p className="text-xs text-gray-500 mt-2">
                    El Administrador Operativo solo asigna acceso operativo. La activacion global de modulos y la salud tecnica viven en Monitoreo del Sistema.
                  </p>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <select
                    value={usuarioEditando}
                    onChange={(e) => cargarUsuarioParaEditar(e.target.value)}
                    className="input-custom"
                  >
                    <option value="">Seleccionar usuario...</option>
                    {usuarios.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nombre} - {usuario.rol} - {usuario.activo === false ? "inactivo" : "activo"}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rolSeleccionado}
                    onChange={(e) => setRolSeleccionado(e.target.value)}
                    className="input-custom"
                    disabled={!usuarioEditando}
                  >
                    <option value="">Seleccionar rol...</option>
                    {ROLES_SISTEMA.map((rol) => (
                      <option key={rol} value={rol}>{rol}</option>
                    ))}
                  </select>
                  <select
                    value={activoSeleccionado ? "activo" : "inactivo"}
                    onChange={(e) => setActivoSeleccionado(e.target.value === "activo")}
                    className="input-custom"
                    disabled={!usuarioEditando}
                  >
                    <option value="activo">Usuario activo</option>
                    <option value="inactivo">Usuario inactivo</option>
                  </select>
                </div>

                {usuarioEditando && (
                  <div className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4 mb-6">
                    <p className="text-xs text-gray-500 uppercase font-black mb-1">Rol del sistema</p>
                    <p className="text-cyan-200 text-sm">{funcionOperativa(rolSeleccionado)}</p>
                    <div className="mt-3 grid md:grid-cols-4 gap-2 text-xs">
                      <span className="chip">Empresas: {empresasSeleccionadas.length}</span>
                      <span className="chip">Modulos: {modulosSeleccionados.length}</span>
                      <span className="chip">
                        Funciones: {Object.values(funcionesSeleccionadas).flat().length}
                      </span>
                      <span className="chip">{activoSeleccionado ? "Activo" : "Inactivo"}</span>
                    </div>
                    <p className="text-cyan-400 text-xs font-mono break-all mt-3">{usuarioEditando}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mb-5">
                  <button type="button" onClick={() => setEmpresasSeleccionadas(empresas.map((empresa) => Number(empresa.id)))} disabled={!usuarioEditando || procesando} className="btn-lite">
                    Todas las empresas permitidas
                  </button>
                  <button type="button" onClick={() => setEmpresasSeleccionadas([])} disabled={!usuarioEditando || procesando} className="btn-lite">
                    Limpiar empresas
                  </button>
                  <span className="chip">Empresas seleccionadas: {empresasSeleccionadas.length}</span>
                </div>

                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 max-h-[320px] overflow-y-auto pr-2">
                  {empresas.map((empresa) => {
                    const activa = empresasSeleccionadas.includes(Number(empresa.id));
                    return (
                      <button
                        key={empresa.id}
                        type="button"
                        onClick={() => toggleEmpresa(Number(empresa.id))}
                        disabled={!usuarioEditando || procesando}
                        className={`option-card ${activa ? "option-card-active" : ""}`}
                      >
                        <p className="text-[10px] font-black uppercase mb-1">ID empresa: {empresa.id}</p>
                        <p className="text-sm font-black">{empresa.nombre}</p>
                        <p className="text-[10px] mt-2">{activa ? "Asignada" : "No asignada"}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3 mb-5">
                  <button type="button" onClick={() => setModulosSeleccionados(modulos.map((modulo) => modulo.clave))} disabled={!usuarioEditando || procesando} className="btn-lite">
                    Todos los modulos operativos
                  </button>
                  <button type="button" onClick={() => setModulosSeleccionados([])} disabled={!usuarioEditando || procesando} className="btn-lite">
                    Limpiar modulos
                  </button>
                  <span className="chip">Modulos seleccionados: {modulosSeleccionados.length}</span>
                </div>

                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 max-h-[320px] overflow-y-auto pr-2">
                  {modulos.map((modulo) => {
                    const activo = modulosSeleccionados.includes(modulo.clave);
                    return (
                      <button
                        key={modulo.clave}
                        type="button"
                        onClick={() => toggleModulo(modulo.clave)}
                        disabled={!usuarioEditando || procesando}
                        className={`option-card ${activo ? "option-card-active-purple" : ""}`}
                      >
                        <p className="text-[10px] font-black uppercase mb-1">{modulo.clave}</p>
                        <p className="text-sm font-black">{modulo.nombre}</p>
                        <p className="text-[10px] mt-2">{activo ? "Asignado" : "No asignado"}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    Funciones operativas reales por usuario y empresa
                  </h3>
                  <p className="text-xs text-gray-500">
                    Estas funciones controlan firma, autorizacion, pagos, revision y lectura. No sustituyen rol, empresa ni modulo: los complementan.
                  </p>
                </div>

                <div className="space-y-4 mb-6 max-h-[420px] overflow-y-auto pr-2">
                  {empresas
                    .filter((empresa) => empresasSeleccionadas.includes(Number(empresa.id)))
                    .map((empresa) => (
                      <div key={empresa.id} className="rounded-2xl border border-white/10 bg-[#0f172a]/70 p-4">
                        <p className="mb-3 text-sm font-black text-white">{empresa.nombre}</p>
                        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                          {Object.entries(FUNCIONES_POR_MODULO).map(([grupo, funciones]) => (
                            <div key={`${empresa.id}-${grupo}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">{grupo}</p>
                              <div className="space-y-2">
                                {funciones.map((funcion) => {
                                  const activa = (funcionesSeleccionadas[Number(empresa.id)] || []).includes(funcion);
                                  return (
                                    <button
                                      key={`${empresa.id}-${funcion}`}
                                      type="button"
                                      onClick={() => toggleFuncionOperativa(Number(empresa.id), funcion)}
                                      disabled={!usuarioEditando || procesando}
                                      className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] font-black ${
                                        activa
                                          ? "border-green-400/50 bg-green-500/10 text-green-200"
                                          : "border-white/10 bg-white/[0.02] text-gray-400"
                                      }`}
                                    >
                                      {funcion}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  {usuarioEditando && empresasSeleccionadas.length === 0 && (
                    <p className="text-sm text-gray-500">Selecciona al menos una empresa para asignar funciones operativas.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={guardarPermisosUsuario}
                  disabled={!usuarioEditando || procesando}
                  className="w-full h-14 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {procesando ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                  Guardar usuario, empresas, modulos y funciones
                </button>
              </section>

              <section className="grid xl:grid-cols-3 gap-8">
                <PanelUsuarios titulo="Usuarios activos" usuarios={usuariosActivos} />
                <PanelUsuarios titulo="Usuarios inactivos" usuarios={usuariosInactivos} />
                <PanelTrabajando trabajos={trabajosActivos} />
              </section>

              <section className="grid lg:grid-cols-2 gap-8 mt-8">
                <PanelAsignaciones asignaciones={asignacionesActivas} />
                <PanelModulos usuarios={usuarios} modulos={modulosAsignadosActivos} catalogo={modulos} />
              </section>

              <section className="mt-8">
                <PanelFunciones usuarios={usuarios} funciones={funcionesActivas} empresas={empresas} />
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
        .btn-lite {
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          background: rgba(6, 182, 212, 0.1);
          color: rgb(103, 232, 249);
          border: 1px solid rgba(6, 182, 212, 0.2);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .chip {
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
          color: rgb(156, 163, 175);
        }
        .option-card {
          text-align: left;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1rem;
          background: rgba(255, 255, 255, 0.02);
          color: rgb(156, 163, 175);
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .option-card-active {
          border-color: rgb(6, 182, 212);
          background: rgba(6, 182, 212, 0.1);
          color: rgb(103, 232, 249);
        }
        .option-card-active-purple {
          border-color: rgb(168, 85, 247);
          background: rgba(168, 85, 247, 0.1);
          color: rgb(216, 180, 254);
        }
      `}</style>
    </div>
  );
}

function CardResumen({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <div className={`flex items-center gap-3 ${color}`}>
        {icon}
        <p className="text-xs font-black uppercase tracking-widest">{label}</p>
      </div>
      <h2 className="text-4xl font-black mt-4">{value}</h2>
    </div>
  );
}

function PanelResumenUsuariosOperativos({
  usuarios,
  asignaciones,
  modulos,
  funciones,
  empresas,
  catalogoModulos,
  trabajos,
  usuarioSeleccionado,
  onSeleccionar,
}: {
  usuarios: Perfil[];
  asignaciones: UsuarioEmpresa[];
  modulos: UsuarioModulo[];
  funciones: UsuarioFuncionOperativa[];
  empresas: Empresa[];
  catalogoModulos: ModuloSistema[];
  trabajos: TrabajoActivo[];
  usuarioSeleccionado: string;
  onSeleccionar: (usuarioId: string) => void;
}) {
  const empresasPorId = new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre]));
  const modulosPorClave = new Map(catalogoModulos.map((modulo) => [modulo.clave, modulo.nombre]));
  const trabajosPorUsuario = new Map(trabajos.map((trabajo) => [trabajo.usuario_id, trabajo]));

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">
            Matriz operativa por usuario
          </h2>
          <p className="text-xs text-gray-500 mt-2">
            Vista rapida de rol, estado, empresas, modulos, funciones operativas y trabajo visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip">Sin modulos globales</span>
          <span className="chip">Sin salud tecnica</span>
          <span className="chip">Sin errores internos</span>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4 max-h-[620px] overflow-y-auto pr-2">
        {usuarios.map((usuario) => {
          const empresasUsuario = asignaciones
            .filter((item) => item.usuario_id === usuario.id)
            .map((item) => empresasPorId.get(Number(item.empresa_id)) || `Empresa ${item.empresa_id}`);
          const modulosUsuario = modulos
            .filter((item) => item.usuario_id === usuario.id)
            .map((item) => modulosPorClave.get(item.modulo_clave) || item.modulo_clave);
          const funcionesUsuario = funciones.filter((item) => item.usuario_id === usuario.id);
          const trabajo = trabajosPorUsuario.get(usuario.id);
          const seleccionado = usuarioSeleccionado === usuario.id;

          return (
            <article
              key={usuario.id}
              className={`rounded-2xl border p-4 bg-[#0f172a]/70 ${
                seleccionado ? "border-cyan-400/70" : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{usuario.nombre}</p>
                  <p className="text-xs text-gray-500 mt-1 break-all">{usuario.correo || usuario.id}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                    usuario.activo === false
                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                      : "border-green-400/30 bg-green-500/10 text-green-200"
                  }`}
                >
                  {usuario.activo === false ? "Inactivo" : "Activo"}
                </span>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-3 text-xs">
                <ResumenLista titulo="Rol" items={[usuario.rol || "sin_rol"]} color="text-cyan-200" />
                <ResumenLista
                  titulo="Funcion base"
                  items={[funcionOperativa(usuario.rol)]}
                  color="text-gray-300"
                />
                <ResumenLista titulo="Empresas" items={empresasUsuario} color="text-cyan-200" />
                <ResumenLista titulo="Modulos" items={modulosUsuario} color="text-purple-200" />
              </div>

              <div className="mt-3">
                <ResumenLista
                  titulo="Funciones operativas por empresa"
                  items={funcionesUsuario.map((item) => {
                    const empresa = empresasPorId.get(Number(item.empresa_id)) || `Empresa ${item.empresa_id}`;
                    return `${empresa}: ${item.funcion}`;
                  })}
                  color="text-green-200"
                />
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-xs">
                  <p className="font-black uppercase tracking-widest text-gray-500">
                    Trabajo actual
                  </p>
                  <p className={trabajo ? "text-yellow-200 mt-1" : "text-gray-500 mt-1"}>
                    {trabajo
                      ? `${trabajo.modulo} | ${trabajo.titulo || trabajo.ruta || "Activo"}`
                      : "Sin trabajo activo visible"}
                  </p>
                  {trabajo && (
                    <p className="text-gray-500 mt-1">{formatearFechaHora(trabajo.actualizado_at)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSeleccionar(usuario.id)}
                  className="h-10 px-4 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-xs font-black uppercase hover:bg-cyan-500/20"
                >
                  Editar permisos
                </button>
              </div>
            </article>
          );
        })}
        {usuarios.length === 0 && (
          <p className="text-gray-500 text-sm">No hay usuarios visibles para administrar.</p>
        )}
      </div>
    </div>
  );
}

function ResumenLista({
  titulo,
  items,
  color,
}: {
  titulo: string;
  items: string[];
  color: string;
}) {
  const visibles = items.filter(Boolean);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
        {titulo}
      </p>
      {visibles.length ? (
        <div className="flex flex-wrap gap-1.5">
          {visibles.slice(0, 8).map((item, index) => (
            <span
              key={`${titulo}-${item}-${index}`}
              className={`rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] font-bold ${color}`}
            >
              {item}
            </span>
          ))}
          {visibles.length > 8 && (
            <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-gray-400">
              +{visibles.length - 8}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600">Sin asignacion</p>
      )}
    </div>
  );
}

function PanelUsuarios({ titulo, usuarios }: { titulo: string; usuarios: Perfil[] }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
        {titulo}
      </h2>
      <div className="space-y-3">
        {usuarios.map((usuario) => (
          <div key={usuario.id} className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4">
            <p className="font-black text-white">{usuario.nombre}</p>
            <p className="text-xs text-cyan-300 mt-1">{usuario.rol}</p>
            <p className="text-xs text-gray-500 mt-1">{funcionOperativa(usuario.rol)}</p>
          </div>
        ))}
        {usuarios.length === 0 && <p className="text-gray-500 text-sm">No hay usuarios.</p>}
      </div>
    </div>
  );
}

function PanelTrabajando({ trabajos }: { trabajos: TrabajoActivo[] }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
        Usuarios trabajando
      </h2>
      <div className="space-y-3">
        {trabajos.map((trabajo) => (
          <div key={trabajo.id} className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4">
            <p className="font-black text-white">
              {trabajo.perfiles?.nombre || trabajo.usuario_id}
            </p>
            <p className="text-xs text-cyan-300 mt-1">
              {trabajo.modulo} | {trabajo.empresas?.nombre || "Empresa asignada"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {trabajo.titulo || trabajo.ruta || "Trabajo operativo activo"}
            </p>
          </div>
        ))}
        {trabajos.length === 0 && (
          <p className="text-gray-500 text-sm">No hay trabajos activos visibles.</p>
        )}
      </div>
    </div>
  );
}

function PanelAsignaciones({ asignaciones }: { asignaciones: UsuarioEmpresa[] }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
        Empresas asignadas
      </h2>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
        {asignaciones.map((asignacion) => (
          <div key={asignacion.id} className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4">
            <p className="font-black text-white">
              {asignacion.perfiles?.nombre || "Usuario sin nombre"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Rol: {asignacion.perfiles?.rol || "Sin rol"}
            </p>
            <p className="text-xs text-cyan-400 mt-1">
              Empresa: {asignacion.empresas?.nombre || `Empresa ${asignacion.empresa_id}`}
            </p>
          </div>
        ))}
        {asignaciones.length === 0 && (
          <p className="text-gray-500 text-sm">No hay empresas asignadas visibles.</p>
        )}
      </div>
    </div>
  );
}

function PanelModulos({
  usuarios,
  modulos,
  catalogo,
}: {
  usuarios: Perfil[];
  modulos: UsuarioModulo[];
  catalogo: ModuloSistema[];
}) {
  const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const modulosPorClave = new Map(catalogo.map((modulo) => [modulo.clave, modulo]));

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
        Modulos asignados
      </h2>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
        {modulos.map((modulo) => {
          const usuario = usuariosPorId.get(modulo.usuario_id);
          const moduloCatalogo = modulosPorClave.get(modulo.modulo_clave);
          return (
            <div key={modulo.id} className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4">
              <p className="font-black text-white">
                {usuario?.nombre || modulo.usuario_id}
              </p>
              <p className="text-xs text-purple-300 mt-1">
                {moduloCatalogo?.nombre || modulo.modulo_clave}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Clave: {modulo.modulo_clave}
              </p>
            </div>
          );
        })}
        {modulos.length === 0 && (
          <p className="text-gray-500 text-sm">No hay modulos asignados.</p>
        )}
      </div>
    </div>
  );
}

function PanelFunciones({
  usuarios,
  funciones,
  empresas,
}: {
  usuarios: Perfil[];
  funciones: UsuarioFuncionOperativa[];
  empresas: Empresa[];
}) {
  const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const empresasPorId = new Map(empresas.map((empresa) => [Number(empresa.id), empresa]));

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
        Funciones operativas asignadas
      </h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-2">
        {funciones.map((funcion) => {
          const usuario = usuariosPorId.get(funcion.usuario_id);
          const empresa = empresasPorId.get(Number(funcion.empresa_id));
          return (
            <div key={funcion.id} className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4">
              <p className="font-black text-white">{usuario?.nombre || funcion.usuario_id}</p>
              <p className="text-xs text-green-300 mt-1">{funcion.funcion}</p>
              <p className="text-xs text-gray-500 mt-1">
                {empresa?.nombre || `Empresa ${funcion.empresa_id}`}
              </p>
            </div>
          );
        })}
        {funciones.length === 0 && (
          <p className="text-gray-500 text-sm">No hay funciones operativas activas visibles.</p>
        )}
      </div>
    </div>
  );
}
