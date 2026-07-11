"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { obtenerEmpresasOperativasDesdeIds } from "../../lib/empresasOperativas";
import {
  esAuditorSoloLecturaLocal,
  listarFuncionesOperativasUsuario,
  tieneFuncionOperativaLocal,
  type UsuarioFuncionOperativa,
} from "../../lib/funcionesOperativas";
import { obtenerEmpresasPermitidas } from "../../lib/permisosEmpresas";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";

const TAMANO_PAGINA = 25;
const ROLES_ESCRITURA = ["admin", "jefe", "supervisor"];
const ROLES_SALARIO = ["admin", "jefe", "contador"];
const ROLES_BANCO_COMPLETO = ["admin", "jefe", "contador"];
const ESTADOS = ["Activo", "Inactivo", "Suspendido", "Egresado"];
const COLUMNAS =
  "id,empresa_id,codigo_empleado,nombres,apellidos,dpi,nit,igss_numero,fecha_ingreso,fecha_egreso,puesto,departamento,tipo_contrato,jornada,salario_base,bonificacion_incentivo,moneda,forma_pago,banco,cuenta_bancaria,activo,estado,observaciones,creado_at,actualizado_at";

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

interface Empresa {
  id: number;
  nombre: string;
}

interface Empleado {
  id: string;
  empresa_id: number;
  codigo_empleado: string | null;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  nit: string | null;
  igss_numero: string | null;
  fecha_ingreso: string;
  fecha_egreso: string | null;
  puesto: string | null;
  departamento: string | null;
  tipo_contrato: string | null;
  jornada: string | null;
  salario_base: number;
  bonificacion_incentivo: number;
  moneda: string;
  forma_pago: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  activo: boolean;
  estado: string;
  observaciones: string | null;
  creado_at: string | null;
  actualizado_at: string | null;
}

interface FormularioEmpleado {
  empresaId: string;
  codigoEmpleado: string;
  nombres: string;
  apellidos: string;
  dpi: string;
  nit: string;
  igssNumero: string;
  fechaIngreso: string;
  fechaEgreso: string;
  puesto: string;
  departamento: string;
  tipoContrato: string;
  jornada: string;
  salarioBase: string;
  bonificacionIncentivo: string;
  moneda: string;
  formaPago: string;
  banco: string;
  cuentaBancaria: string;
  estado: string;
  observaciones: string;
}

function formularioVacio(empresaId = ""): FormularioEmpleado {
  return {
    empresaId,
    codigoEmpleado: "",
    nombres: "",
    apellidos: "",
    dpi: "",
    nit: "",
    igssNumero: "",
    fechaIngreso: "",
    fechaEgreso: "",
    puesto: "",
    departamento: "",
    tipoContrato: "",
    jornada: "",
    salarioBase: "0",
    bonificacionIncentivo: "0",
    moneda: "GTQ",
    formaPago: "",
    banco: "",
    cuentaBancaria: "",
    estado: "Activo",
    observaciones: "",
  };
}

function formularioDesdeEmpleado(empleado: Empleado): FormularioEmpleado {
  return {
    empresaId: String(empleado.empresa_id),
    codigoEmpleado: empleado.codigo_empleado || "",
    nombres: empleado.nombres,
    apellidos: empleado.apellidos,
    dpi: empleado.dpi || "",
    nit: empleado.nit || "",
    igssNumero: empleado.igss_numero || "",
    fechaIngreso: empleado.fecha_ingreso || "",
    fechaEgreso: empleado.fecha_egreso || "",
    puesto: empleado.puesto || "",
    departamento: empleado.departamento || "",
    tipoContrato: empleado.tipo_contrato || "",
    jornada: empleado.jornada || "",
    salarioBase: String(empleado.salario_base ?? 0),
    bonificacionIncentivo: String(empleado.bonificacion_incentivo ?? 0),
    moneda: empleado.moneda || "GTQ",
    formaPago: empleado.forma_pago || "",
    banco: empleado.banco || "",
    cuentaBancaria: empleado.cuenta_bancaria || "",
    estado: empleado.estado,
    observaciones: empleado.observaciones || "",
  };
}

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function opcional(valor: string) {
  const limpio = valor.trim();
  return limpio || null;
}

function limpiarBusqueda(valor: string) {
  return valor.trim().replace(/[,%()"']/g, " ").replace(/\s+/g, " ");
}

function numeroNoNegativo(valor: string, nombre: string) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${nombre} debe ser un número no negativo.`);
  }
  return Math.round(numero * 100) / 100;
}

function enmascarar(valor?: string | null, visibles = 4) {
  const limpio = (valor || "").trim();
  if (!limpio) return "No registrado";
  if (limpio.length <= visibles) return "••••";
  return `${"•".repeat(Math.min(8, limpio.length - visibles))}${limpio.slice(-visibles)}`;
}

function fechaHumana(valor?: string | null) {
  if (!valor) return "No registrada";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(fecha.getTime())
    ? "Fecha no disponible"
    : fecha.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fechaHoraHumana(valor?: string | null) {
  if (!valor) return "No registrada";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "No disponible" : fecha.toLocaleString("es-GT");
}

function moneda(valor: number, codigo = "GTQ") {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: codigo === "USD" ? "USD" : "GTQ",
  }).format(Number(valor || 0));
}

function mensajeSeguro(error: unknown) {
  const texto = error instanceof Error ? error.message.toLowerCase() : "";
  if (texto.includes("duplicate") || texto.includes("23505")) {
    return "Ya existe un empleado con ese código o DPI en la empresa seleccionada.";
  }
  if (texto.includes("row-level security") || texto.includes("permission") || texto.includes("42501")) {
    return "No tienes permisos para completar esta acción en la empresa seleccionada.";
  }
  if (texto.includes("fecha") || texto.includes("salario") || texto.includes("obligatorio")) {
    return error instanceof Error ? error.message : "Revisa los datos obligatorios.";
  }
  return "No se pudo completar la operación. Revisa la información e intenta nuevamente.";
}

export default function EmpleadosPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasIds, setEmpresasIds] = useState<number[]>([]);
  const [funciones, setFunciones] = useState<UsuarioFuncionOperativa[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [puestoFiltro, setPuestoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargandoAcceso, setCargandoAcceso] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<"crear" | "editar" | "ficha" | null>(null);
  const [seleccionado, setSeleccionado] = useState<Empleado | null>(null);
  const [formulario, setFormulario] = useState<FormularioEmpleado>(formularioVacio());
  const [mostrarSensibles, setMostrarSensibles] = useState(false);

  useEffect(() => {
    let montado = true;
    async function iniciar() {
      try {
        const acceso = await validarAccesoModuloUsuario("planilla");
        if (!montado) return;
        if (!acceso.ok) {
          if (["sin_sesion", "sin_perfil", "usuario_inactivo"].includes(acceso.motivo || "")) {
            router.replace("/login");
          } else {
            setError("No tienes acceso al módulo de empleados.");
          }
          return;
        }
        const usuario = acceso.user!;
        const perfilActual = acceso.perfil as Perfil;
        const permitidas = await obtenerEmpresasPermitidas(usuario.id, perfilActual.rol);
        const operativas = await obtenerEmpresasOperativasDesdeIds(permitidas);
        const capacidades = await listarFuncionesOperativasUsuario(usuario.id, operativas.ids);
        if (!montado) return;
        setUserId(usuario.id);
        setPerfil(perfilActual);
        setEmpresas(operativas.empresas);
        setEmpresasIds(operativas.ids);
        setFunciones(capacidades);
        if (operativas.ids.length === 1) setEmpresaFiltro(String(operativas.ids[0]));
      } catch {
        if (montado) setError("No se pudo preparar el Maestro de Empleados.");
      } finally {
        if (montado) setCargandoAcceso(false);
      }
    }
    void iniciar();
    return () => {
      montado = false;
    };
  }, [router]);

  const cargarEmpleados = useCallback(async () => {
    if (cargandoAcceso || !empresasIds.length) {
      setEmpleados([]);
      setTotal(0);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const desde = (pagina - 1) * TAMANO_PAGINA;
      const hasta = desde + TAMANO_PAGINA - 1;
      let consulta = supabase
        .from("empleados_planilla")
        .select(COLUMNAS, { count: "exact" })
        .in("empresa_id", empresasIds)
        .order("apellidos", { ascending: true })
        .order("nombres", { ascending: true })
        .range(desde, hasta);
      if (empresaFiltro) consulta = consulta.eq("empresa_id", Number(empresaFiltro));
      if (estadoFiltro) consulta = consulta.eq("estado", estadoFiltro);
      if (puestoFiltro) consulta = consulta.eq("puesto", puestoFiltro);
      const texto = limpiarBusqueda(busquedaAplicada);
      if (texto) {
        consulta = consulta.or(
          `nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%,codigo_empleado.ilike.%${texto}%,puesto.ilike.%${texto}%`
        );
      }
      const { data, error: consultaError, count } = await consulta;
      if (consultaError) throw consultaError;
      setEmpleados((data || []) as Empleado[]);
      setTotal(count || 0);
    } catch {
      setEmpleados([]);
      setTotal(0);
      setError("No se pudo cargar el listado de empleados. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [busquedaAplicada, cargandoAcceso, empresaFiltro, empresasIds, estadoFiltro, pagina, puestoFiltro]);

  useEffect(() => {
    void cargarEmpleados();
  }, [cargarEmpleados]);

  useEffect(() => {
    setPagina(1);
  }, [empresaFiltro, estadoFiltro, puestoFiltro, busquedaAplicada]);

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [Number(empresa.id), empresa.nombre])),
    [empresas]
  );
  const puestos = useMemo(
    () => Array.from(new Set(empleados.map((item) => item.puesto).filter(Boolean) as string[])).sort(),
    [empleados]
  );
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const rol = normalizarRol(perfil?.rol);

  function auditorEmpresa(empresaId: string | number) {
    return esAuditorSoloLecturaLocal(funciones, [empresaId]);
  }

  function puedeEditar(empresaId: string | number) {
    if (!userId || auditorEmpresa(empresaId)) return false;
    return (
      ROLES_ESCRITURA.includes(rol) ||
      tieneFuncionOperativaLocal(funciones, userId, empresaId, ["auxiliar_contable", "contador_revisor"])
    );
  }

  function puedeVerSalario(empresaId: string | number) {
    return (
      ROLES_SALARIO.includes(rol) ||
      tieneFuncionOperativaLocal(funciones, userId, empresaId, ["contador_revisor"])
    );
  }

  function puedeVerBancoCompleto(empresaId: string | number) {
    return (
      ROLES_BANCO_COMPLETO.includes(rol) ||
      tieneFuncionOperativaLocal(funciones, userId, empresaId, ["contador_revisor"])
    );
  }

  function abrirCrear() {
    const empresaInicial = empresaFiltro || (empresasIds[0] ? String(empresasIds[0]) : "");
    setSeleccionado(null);
    setFormulario(formularioVacio(empresaInicial));
    setMostrarSensibles(false);
    setModal("crear");
    setError(null);
    setMensaje(null);
  }

  function abrirEmpleado(empleado: Empleado, modo: "ficha" | "editar") {
    setSeleccionado(empleado);
    setFormulario(formularioDesdeEmpleado(empleado));
    setMostrarSensibles(false);
    setModal(modo);
    setError(null);
    setMensaje(null);
  }

  function cerrarModal() {
    if (guardando) return;
    setModal(null);
    setSeleccionado(null);
    setMostrarSensibles(false);
  }

  function validarFormulario() {
    const empresaId = Number(formulario.empresaId);
    if (!Number.isInteger(empresaId) || !empresasIds.includes(empresaId)) {
      throw new Error("Selecciona una empresa autorizada.");
    }
    if (!formulario.nombres.trim() || !formulario.apellidos.trim()) {
      throw new Error("Nombres y apellidos son obligatorios.");
    }
    if (!formulario.fechaIngreso || Number.isNaN(new Date(formulario.fechaIngreso).getTime())) {
      throw new Error("Registra una fecha de ingreso válida.");
    }
    if (formulario.fechaEgreso && formulario.fechaEgreso < formulario.fechaIngreso) {
      throw new Error("La fecha de retiro no puede ser anterior a la fecha de ingreso.");
    }
    numeroNoNegativo(formulario.salarioBase, "El salario base");
    numeroNoNegativo(formulario.bonificacionIncentivo, "La bonificación incentivo");
    if (!ESTADOS.includes(formulario.estado)) throw new Error("Selecciona un estado laboral válido.");
    return empresaId;
  }

  async function guardarEmpleado() {
    if (guardando || !userId) return;
    setError(null);
    setMensaje(null);
    try {
      const empresaId = validarFormulario();
      if (!puedeEditar(empresaId)) throw new Error("No tienes permisos para modificar empleados en esta empresa.");
      setGuardando(true);
      const retirado = formulario.estado === "Egresado";
      const payload = {
        empresa_id: empresaId,
        codigo_empleado: opcional(formulario.codigoEmpleado),
        nombres: formulario.nombres.trim(),
        apellidos: formulario.apellidos.trim(),
        dpi: opcional(formulario.dpi),
        nit: opcional(formulario.nit),
        igss_numero: opcional(formulario.igssNumero),
        fecha_ingreso: formulario.fechaIngreso,
        fecha_egreso: formulario.fechaEgreso || null,
        puesto: opcional(formulario.puesto),
        departamento: opcional(formulario.departamento),
        tipo_contrato: opcional(formulario.tipoContrato),
        jornada: opcional(formulario.jornada),
        salario_base: numeroNoNegativo(formulario.salarioBase, "El salario base"),
        bonificacion_incentivo: numeroNoNegativo(formulario.bonificacionIncentivo, "La bonificación incentivo"),
        moneda: formulario.moneda,
        forma_pago: opcional(formulario.formaPago),
        banco: opcional(formulario.banco),
        cuenta_bancaria: opcional(formulario.cuentaBancaria),
        estado: formulario.estado,
        activo: formulario.estado === "Activo",
        observaciones: opcional(formulario.observaciones),
        actualizado_por: userId,
        actualizado_at: new Date().toISOString(),
      };
      let guardado: Empleado;
      if (seleccionado) {
        const { data, error: guardarError } = await supabase
          .from("empleados_planilla")
          .update(payload)
          .eq("id", seleccionado.id)
          .eq("empresa_id", seleccionado.empresa_id)
          .select(COLUMNAS)
          .single();
        if (guardarError || !data) throw guardarError || new Error("No se actualizó el empleado.");
        guardado = data as Empleado;
      } else {
        const { data, error: guardarError } = await supabase
          .from("empleados_planilla")
          .insert({ ...payload, creado_por: userId })
          .select(COLUMNAS)
          .single();
        if (guardarError || !data) throw guardarError || new Error("No se creó el empleado.");
        guardado = data as Empleado;
      }
      try {
        await registrarAuditoriaEvento({
          empresa_id: empresaId,
          modulo: "empleados",
          accion: seleccionado ? (retirado ? "registrar_retiro_empleado" : "actualizar_empleado") : "crear_empleado",
          entidad_tipo: "empleados_planilla",
          entidad_id: guardado.id,
          estado_anterior: seleccionado?.estado || null,
          estado_nuevo: guardado.estado,
          sensible: true,
          origen: "app_empleados",
          metadatos: {
            empresa_id: empresaId,
            empleado_id: guardado.id,
            codigo_empleado: guardado.codigo_empleado,
            campos_sensibles_incluidos: false,
          },
        });
      } catch {
        setMensaje("Empleado guardado. La auditoría central requiere revisión.");
      }
      setModal(null);
      setSeleccionado(null);
      setMensaje(seleccionado ? "La ficha del empleado fue actualizada." : "El empleado fue creado correctamente.");
      await cargarEmpleados();
    } catch (guardarError) {
      setError(mensajeSeguro(guardarError));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(empleado: Empleado, estado: "Inactivo" | "Egresado") {
    if (!puedeEditar(empleado.empresa_id) || guardando) return;
    const texto = estado === "Egresado" ? "registrar el retiro" : "inactivar al empleado";
    if (!window.confirm(`¿Confirmas que deseas ${texto}? El registro no será eliminado.`)) return;
    abrirEmpleado(empleado, "editar");
    setFormulario({
      ...formularioDesdeEmpleado(empleado),
      estado,
      fechaEgreso: estado === "Egresado" ? empleado.fecha_egreso || new Date().toISOString().slice(0, 10) : empleado.fecha_egreso || "",
    });
  }

  if (cargandoAcceso) {
    return <EstadoCentro texto="Validando acceso al Maestro de Empleados…" />;
  }

  return (
    <div className="empleados-maestro flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar />
      <main className="min-w-0 flex-1 p-5 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Users className="text-cyan-500" size={38} />
                <div>
                  <h1 className="text-3xl font-black md:text-4xl">Maestro de Empleados</h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Expediente laboral separado de los usuarios que acceden al sistema.
                  </p>
                </div>
              </div>
            </div>
            {empresasIds.some((id) => puedeEditar(id)) && (
              <button className="btn-primary inline-flex items-center justify-center gap-2" onClick={abrirCrear}>
                <Plus size={18} /> Nuevo empleado
              </button>
            )}
          </header>

          <section className="grid gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 md:grid-cols-2 xl:grid-cols-5">
            <Filtro label="Empresa">
              <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} className="input-custom">
                <option value="">Todas las empresas</option>
                {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
              </select>
            </Filtro>
            <Filtro label="Estado">
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="input-custom">
                <option value="">Todos</option>
                {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
              </select>
            </Filtro>
            <Filtro label="Puesto">
              <select value={puestoFiltro} onChange={(e) => setPuestoFiltro(e.target.value)} className="input-custom">
                <option value="">Todos los puestos visibles</option>
                {puestos.map((puesto) => <option key={puesto}>{puesto}</option>)}
              </select>
            </Filtro>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">Búsqueda</label>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setBusquedaAplicada(busqueda); }}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-strong)]" size={17} />
                  <input className="input-custom pl-10" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, código o puesto" />
                </div>
                <button className="btn-secondary" type="submit">Buscar</button>
              </form>
            </div>
          </section>

          {error && <Aviso tipo="error">{error}</Aviso>}
          {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
          {!empresasIds.length && <Aviso tipo="info">No tienes empresas operativas asignadas para consultar empleados.</Aviso>}

          <section className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)]">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
              <div>
                <h2 className="font-black">Empleados registrados</h2>
                <p className="text-xs text-[var(--muted)]">{total} registro{total === 1 ? "" : "s"}; máximo {TAMANO_PAGINA} por página.</p>
              </div>
              <ShieldCheck className="text-emerald-500" size={22} />
            </div>
            {cargando ? (
              <div className="flex min-h-64 items-center justify-center gap-3 text-[var(--muted)]"><Loader2 className="animate-spin" /> Cargando empleados…</div>
            ) : empleados.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-[var(--muted-strong)] dark:bg-white/5">
                    <tr>{["Código", "Empleado", "Empresa", "Puesto", "Estado", "Ingreso", "Salario", "Acciones"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr>
                  </thead>
                  <tbody>
                    {empleados.map((empleado) => (
                      <tr key={empleado.id} className="border-t border-[var(--card-border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-4 font-mono text-xs">{empleado.codigo_empleado || "Sin código"}</td>
                        <td className="px-4 py-4"><p className="font-bold">{empleado.nombres} {empleado.apellidos}</p><p className="text-xs text-[var(--muted)]">DPI {enmascarar(empleado.dpi)}</p></td>
                        <td className="px-4 py-4">{empresasPorId.get(empleado.empresa_id) || "Empresa autorizada"}</td>
                        <td className="px-4 py-4">{empleado.puesto || "Sin puesto"}</td>
                        <td className="px-4 py-4"><EstadoBadge estado={empleado.estado} /></td>
                        <td className="px-4 py-4">{fechaHumana(empleado.fecha_ingreso)}</td>
                        <td className="px-4 py-4">{puedeVerSalario(empleado.empresa_id) ? moneda(empleado.salario_base, empleado.moneda) : <span className="text-[var(--muted)]">Restringido</span>}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <BotonIcono titulo="Consultar ficha" onClick={() => abrirEmpleado(empleado, "ficha")}><Eye size={16} /></BotonIcono>
                            {puedeEditar(empleado.empresa_id) && <BotonIcono titulo="Editar" onClick={() => abrirEmpleado(empleado, "editar")}><Pencil size={16} /></BotonIcono>}
                            {puedeEditar(empleado.empresa_id) && empleado.estado === "Activo" && (
                              <BotonIcono titulo="Inactivar" onClick={() => void cambiarEstado(empleado, "Inactivo")}><UserRoundX size={16} /></BotonIcono>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <UserRoundCheck className="mb-3 text-cyan-500" size={42} />
                <h3 className="font-black">No hay empleados para estos filtros</h3>
                <p className="mt-1 max-w-md text-sm text-[var(--muted)]">Ajusta la búsqueda o registra el primer empleado de una empresa autorizada.</p>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[var(--card-border)] px-5 py-4 text-sm">
              <span className="text-[var(--muted)]">Página {pagina} de {totalPaginas}</span>
              <div className="flex gap-2">
                <button className="btn-secondary inline-flex items-center gap-1" disabled={pagina <= 1 || cargando} onClick={() => setPagina((actual) => Math.max(1, actual - 1))}><ChevronLeft size={16} /> Anterior</button>
                <button className="btn-secondary inline-flex items-center gap-1" disabled={pagina >= totalPaginas || cargando} onClick={() => setPagina((actual) => actual + 1)}>Siguiente <ChevronRight size={16} /></button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm md:p-8">
          <div className="w-full max-w-5xl rounded-3xl border border-[var(--card-border)] bg-[var(--background)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-[var(--card-border)] bg-[var(--background)] px-5 py-4">
              <div><h2 className="text-xl font-black">{modal === "crear" ? "Nuevo empleado" : modal === "editar" ? "Editar ficha" : "Ficha del empleado"}</h2><p className="text-xs text-[var(--muted)]">Los datos sensibles se mantienen ocultos hasta solicitar su visualización.</p></div>
              <button onClick={cerrarModal} aria-label="Cerrar ficha" className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/5"><X /></button>
            </div>
            <div className="space-y-6 p-5 md:p-7">
              {error && <Aviso tipo="error">{error}</Aviso>}
              <Seccion titulo="Identificación">
                <Campo label="Empresa" requerido><select className="input-custom" disabled={modal === "ficha" || Boolean(seleccionado)} value={formulario.empresaId} onChange={(e) => setFormulario({ ...formulario, empresaId: e.target.value })}><option value="">Seleccionar</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}</select></Campo>
                <Campo label="Código interno"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.codigoEmpleado} onChange={(e) => setFormulario({ ...formulario, codigoEmpleado: e.target.value })} /></Campo>
                <Campo label="Nombres" requerido><input className="input-custom" readOnly={modal === "ficha"} value={formulario.nombres} onChange={(e) => setFormulario({ ...formulario, nombres: e.target.value })} /></Campo>
                <Campo label="Apellidos" requerido><input className="input-custom" readOnly={modal === "ficha"} value={formulario.apellidos} onChange={(e) => setFormulario({ ...formulario, apellidos: e.target.value })} /></Campo>
                <Campo label="Nombre completo"><input className="input-custom" readOnly value={`${formulario.nombres} ${formulario.apellidos}`.trim()} /></Campo>
                <Campo label="DPI"><DatoSensible editable={modal !== "ficha"} visible={mostrarSensibles} value={formulario.dpi} onChange={(valor) => setFormulario({ ...formulario, dpi: valor })} /></Campo>
                <Campo label="NIT"><DatoSensible editable={modal !== "ficha"} visible={mostrarSensibles} value={formulario.nit} onChange={(valor) => setFormulario({ ...formulario, nit: valor })} /></Campo>
                <Campo label="Afiliación IGSS"><DatoSensible editable={modal !== "ficha"} visible={mostrarSensibles} value={formulario.igssNumero} onChange={(valor) => setFormulario({ ...formulario, igssNumero: valor })} /></Campo>
              </Seccion>

              <Seccion titulo="Información laboral">
                <Campo label="Puesto"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.puesto} onChange={(e) => setFormulario({ ...formulario, puesto: e.target.value })} /></Campo>
                <Campo label="Departamento / área"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.departamento} onChange={(e) => setFormulario({ ...formulario, departamento: e.target.value })} /></Campo>
                <Campo label="Tipo de contrato"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.tipoContrato} onChange={(e) => setFormulario({ ...formulario, tipoContrato: e.target.value })} /></Campo>
                <Campo label="Jornada"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.jornada} onChange={(e) => setFormulario({ ...formulario, jornada: e.target.value })} /></Campo>
                <Campo label="Fecha de ingreso" requerido><input type="date" className="input-custom" readOnly={modal === "ficha"} value={formulario.fechaIngreso} onChange={(e) => setFormulario({ ...formulario, fechaIngreso: e.target.value })} /></Campo>
                <Campo label="Fecha de retiro"><input type="date" className="input-custom" readOnly={modal === "ficha"} value={formulario.fechaEgreso} onChange={(e) => setFormulario({ ...formulario, fechaEgreso: e.target.value })} /></Campo>
                <Campo label="Estado laboral"><select className="input-custom" disabled={modal === "ficha"} value={formulario.estado} onChange={(e) => setFormulario({ ...formulario, estado: e.target.value })}>{ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}</select></Campo>
                <Campo label="Moneda"><select className="input-custom" disabled={modal === "ficha"} value={formulario.moneda} onChange={(e) => setFormulario({ ...formulario, moneda: e.target.value })}><option>GTQ</option><option>USD</option></select></Campo>
                {puedeVerSalario(formulario.empresaId) ? <><Campo label="Salario base"><input type="number" min="0" step="0.01" className="input-custom" readOnly={modal === "ficha"} value={formulario.salarioBase} onChange={(e) => setFormulario({ ...formulario, salarioBase: e.target.value })} /></Campo><Campo label="Bonificación incentivo"><input type="number" min="0" step="0.01" className="input-custom" readOnly={modal === "ficha"} value={formulario.bonificacionIncentivo} onChange={(e) => setFormulario({ ...formulario, bonificacionIncentivo: e.target.value })} /></Campo></> : <div className="md:col-span-2"><Aviso tipo="info">La información salarial está restringida para tu perfil.</Aviso></div>}
              </Seccion>

              <Seccion titulo="Información bancaria">
                <Campo label="Forma de pago"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.formaPago} onChange={(e) => setFormulario({ ...formulario, formaPago: e.target.value })} /></Campo>
                <Campo label="Banco"><input className="input-custom" readOnly={modal === "ficha"} value={formulario.banco} onChange={(e) => setFormulario({ ...formulario, banco: e.target.value })} /></Campo>
                <Campo label="Cuenta bancaria"><DatoSensible editable={modal !== "ficha" && puedeVerBancoCompleto(formulario.empresaId)} visible={mostrarSensibles && puedeVerBancoCompleto(formulario.empresaId)} value={formulario.cuentaBancaria} onChange={(valor) => setFormulario({ ...formulario, cuentaBancaria: valor })} /></Campo>
                <div className="flex items-end"><button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={!puedeVerBancoCompleto(formulario.empresaId)} onClick={() => setMostrarSensibles((actual) => !actual)}>{mostrarSensibles ? <EyeOff size={17} /> : <Eye size={17} />}{mostrarSensibles ? "Ocultar sensibles" : "Mostrar sensibles"}</button></div>
                {!formulario.cuentaBancaria && <div className="md:col-span-2"><Aviso tipo="info">Cuenta bancaria incompleta. Esto no impide crear la ficha, pero deberá completarse y validarse antes de preparar pagos.</Aviso></div>}
              </Seccion>

              <Seccion titulo="Control">
                <div className="md:col-span-2"><Campo label="Observaciones"><textarea className="input-custom min-h-24" readOnly={modal === "ficha"} value={formulario.observaciones} onChange={(e) => setFormulario({ ...formulario, observaciones: e.target.value })} /></Campo></div>
                {seleccionado && <><DatoControl label="Creado" valor={fechaHoraHumana(seleccionado.creado_at)} /><DatoControl label="Última actualización" valor={fechaHoraHumana(seleccionado.actualizado_at)} /></>}
              </Seccion>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--card-border)] px-5 py-4">
              {modal === "ficha" && seleccionado && puedeEditar(seleccionado.empresa_id) && <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setModal("editar")}><Pencil size={17} /> Editar ficha</button>}
              {modal === "editar" && seleccionado?.estado === "Activo" && <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setFormulario({ ...formulario, estado: "Egresado", fechaEgreso: formulario.fechaEgreso || new Date().toISOString().slice(0, 10) })}><BriefcaseBusiness size={17} /> Preparar retiro</button>}
              {modal !== "ficha" && <button className="btn-primary inline-flex items-center gap-2" disabled={guardando} onClick={() => void guardarEmpleado()}>{guardando ? <Loader2 className="animate-spin" size={18} /> : <UserRoundCheck size={18} />}{guardando ? "Guardando…" : "Guardar ficha"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoCentro({ texto }: { texto: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--muted)]"><Loader2 className="mr-3 animate-spin" />{texto}</div>;
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">{label}</span>{children}</label>;
}

function Aviso({ tipo, children }: { tipo: "error" | "exito" | "info"; children: React.ReactNode }) {
  const clase = tipo === "error" ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300" : tipo === "exito" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${clase}`}>{children}</div>;
}

function EstadoBadge({ estado }: { estado: string }) {
  const clase = estado === "Activo" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : estado === "Suspendido" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-600 dark:text-slate-300";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${clase}`}>{estado}</span>;
}

function BotonIcono({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={titulo} aria-label={titulo} onClick={onClick} className="rounded-lg border border-[var(--card-border)] p-2 text-[var(--muted)] hover:border-cyan-500/40 hover:text-cyan-500">{children}</button>;
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section><h3 className="mb-3 border-b border-[var(--card-border)] pb-2 font-black">{titulo}</h3><div className="grid gap-4 md:grid-cols-2">{children}</div></section>;
}

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-[var(--muted-strong)]">{label}{requerido ? " *" : ""}</span>{children}</label>;
}

function DatoSensible({ value, visible, editable, onChange }: { value: string; visible: boolean; editable: boolean; onChange: (valor: string) => void }) {
  if (!editable) return <input className="input-custom" readOnly value={visible ? value || "No registrado" : enmascarar(value)} />;
  return <input className="input-custom" type={visible ? "text" : "password"} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function DatoControl({ label, valor }: { label: string; valor: string }) {
  return <div className="rounded-xl border border-[var(--card-border)] p-3"><p className="text-xs font-bold text-[var(--muted-strong)]">{label}</p><p className="mt-1 text-sm">{valor}</p></div>;
}
