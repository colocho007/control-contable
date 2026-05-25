"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarUsuarioActivo } from "../../lib/validarUsuarioActivo";
import {
  Loader2,
  ShieldCheck,
  Users,
  Building2,
  Plus,
  Trash2,
  RefreshCcw,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  activo?: boolean | null;
}

interface Empresa {
  id: number;
  nombre: string;
}

interface UsuarioEmpresa {
  id: number;
  usuario_id: string;
  empresa_id: number;
  usuario?: string | null;
  rol?: string | null;
  empresa?: string | null;
}

interface ModuloSistema {
  id: number;
  clave: string;
  nombre: string;
  activo: boolean;
  orden: number;
}
interface UsuarioModulo {
  id: number;
  usuario_id: string;
  modulo_clave: string;
  activo: boolean;
}

const ROLES_ADMIN = ["admin"];
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

export default function AdminPage() {
  const [perfilActual, setPerfilActual] = useState<Perfil | null>(null);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [asignaciones, setAsignaciones] = useState<UsuarioEmpresa[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);

  const [usuarioModulos, setUsuarioModulos] = useState<UsuarioModulo[]>([]);
const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

const [usuarioEditando, setUsuarioEditando] = useState("");
const [rolSeleccionado, setRolSeleccionado] = useState("");
const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<number[]>([]);
const [activoSeleccionado, setActivoSeleccionado] = useState(true);


  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    try {
      setLoading(true);

     const validacion = await validarUsuarioActivo();

if (!validacion.ok) {
  if (validacion.motivo === "usuario_inactivo") {
    toast.error("Tu usuario está inactivo. Contacta al administrador.");
  }

  window.location.href = "/login";
  return;
}

const perfil = validacion.perfil!;

setPerfilActual(perfil);

const rolActual = (perfil?.rol || "").trim().toLowerCase();

if (!ROLES_ADMIN.includes(rolActual)) {
  toast.error("No tienes permiso para entrar al panel administrador");
  window.location.href = "/dashboard";
  return;
}

await cargarDatos();
    } catch (error) {
      console.error(error);
      toast.error("Error cargando panel administrador");
    } finally {
      setLoading(false);
    }
  }

function cargarUsuarioParaEditar(usuarioId: string) {
  const usuario = usuarios.find((u) => u.id === usuarioId);

  if (!usuario) return;

  const empresasDelUsuario = asignaciones
    .filter((a) => a.usuario_id === usuarioId)
    .map((a) => Number(a.empresa_id));

  setUsuarioEditando(usuario.id);
  setRolSeleccionado(usuario.rol || "empleado");
  setActivoSeleccionado(usuario.activo !== false);
  setEmpresasSeleccionadas(empresasDelUsuario);
 const modulosDelUsuario = usuarioModulos
  .filter((m) => m.usuario_id === usuarioId && m.activo)
  .map((m) => m.modulo_clave);

setModulosSeleccionados(modulosDelUsuario); 
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

function seleccionarTodosLosModulos() {
  setModulosSeleccionados(
    modulos
      .filter((m) => m.clave !== "admin" && m.activo)
      .map((m) => m.clave)
  );
}

function limpiarModulosSeleccionados() {
  setModulosSeleccionados([]);
}
function seleccionarTodasLasEmpresas() {
  setEmpresasSeleccionadas(empresas.map((empresa) => Number(empresa.id)));
}

function limpiarEmpresasSeleccionadas() {
  setEmpresasSeleccionadas([]);
}
async function guardarPermisosUsuario() {
  if (!usuarioEditando) {
    toast.error("Selecciona un usuario");
    return;
  }

  if (!rolSeleccionado) {
    toast.error("Selecciona un rol");
    return;
  }

  setProcesando(true);
  const toastId = toast.loading("Guardando permisos del usuario...");

  try {
 const { error: rolError } = await supabase
  .from("perfiles")
  .update({
    rol: rolSeleccionado,
    activo: activoSeleccionado,
  })
  .eq("id", usuarioEditando);

    if (rolError) throw rolError;

    const { error: deleteError } = await supabase
      .from("usuario_empresas")
      .delete()
      .eq("usuario_id", usuarioEditando);

    if (deleteError) throw deleteError;

    if (empresasSeleccionadas.length > 0) {
      const nuevasAsignaciones = empresasSeleccionadas.map((empresaId) => ({
        usuario_id: usuarioEditando,
        empresa_id: empresaId,
      }));

      const { error: insertError } = await supabase
        .from("usuario_empresas")
        .insert(nuevasAsignaciones);

      if (insertError) throw insertError;
    }
    const { error: deleteModulosError } = await supabase
  .from("usuario_modulos")
  .delete()
  .eq("usuario_id", usuarioEditando);

if (deleteModulosError) throw deleteModulosError;

if (modulosSeleccionados.length > 0) {
  const nuevosModulos = modulosSeleccionados.map((moduloClave) => ({
    usuario_id: usuarioEditando,
    modulo_clave: moduloClave,
    activo: true,
  }));

  const { error: insertModulosError } = await supabase
    .from("usuario_modulos")
    .insert(nuevosModulos);

  if (insertModulosError) throw insertModulosError;
}

    await cargarDatos();

   setUsuarioEditando("");
setRolSeleccionado("");
setActivoSeleccionado(true);
setEmpresasSeleccionadas([]);
setModulosSeleccionados([]);

    toast.success("Permisos actualizados correctamente", { id: toastId });
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al guardar permisos", { id: toastId });
  } finally {
    setProcesando(false);
  }
}


  async function cargarDatos() {
 const [
  resUsuarios,
  resEmpresas,
  resAsignaciones,
  resModulos,
  resUsuarioModulos,
] = await Promise.all([
  supabase
  .from("perfiles")
  .select("id,nombre,rol,activo")
  .order("nombre", { ascending: true }),

      supabase
        .from("empresas")
        .select("id,nombre")
        .order("nombre", { ascending: true }),

      supabase
        .from("usuario_empresas")
        .select(`
          id,
          usuario_id,
          empresa_id,
          perfiles:usuario_id (
            nombre,
            rol
          ),
          empresas:empresa_id (
            nombre
          )
        `)
        .order("id", { ascending: false }),
        supabase
  .from("modulos_sistema")
  .select("id,clave,nombre,activo,orden")
  .order("orden", { ascending: true }),

  supabase
  .from("usuario_modulos")
  .select("id,usuario_id,modulo_clave,activo"),
    ]);

    if (resUsuarios.error) throw resUsuarios.error;
    
    if (resEmpresas.error) throw resEmpresas.error;
    if (resAsignaciones.error) throw resAsignaciones.error;
    if (resModulos.error) throw resModulos.error;
    if (resUsuarioModulos.error) throw resUsuarioModulos.error;

    setUsuarios(resUsuarios.data || []);
    setEmpresas(resEmpresas.data || []);
    setModulos(resModulos.data || []);
    setUsuarioModulos(resUsuarioModulos.data || []);

    const limpias = (resAsignaciones.data || []).map((item: any) => ({
      id: item.id,
      usuario_id: item.usuario_id,
      empresa_id: item.empresa_id,
      usuario: item.perfiles?.nombre || "Usuario sin nombre",
      rol: item.perfiles?.rol || "Sin rol",
      empresa: item.empresas?.nombre || "Empresa sin nombre",
    }));

    setAsignaciones(limpias);
  }
async function quitarAsignacion(id: number) {
  const confirmar = window.confirm("¿Quitar esta empresa del usuario?");

  if (!confirmar) return;

  setProcesando(true);
  const toastId = toast.loading("Quitando asignación...");

  try {
    const { error } = await supabase
      .from("usuario_empresas")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await cargarDatos();

    toast.success("Asignación eliminada", { id: toastId });
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al quitar asignación", {
      id: toastId,
    });
  } finally {
    setProcesando(false);
  }
}
 async function cambiarEstadoModulo(modulo: ModuloSistema) {
  setProcesando(true);

  const nuevoEstado = !modulo.activo;
  const toastId = toast.loading(
    nuevoEstado ? "Activando módulo..." : "Desactivando módulo..."
  );

  try {
    const { error } = await supabase
      .from("modulos_sistema")
      .update({ activo: nuevoEstado })
      .eq("id", modulo.id);

    if (error) throw error;

    setModulos((prev) =>
      prev.map((m) =>
        m.id === modulo.id ? { ...m, activo: nuevoEstado } : m
      )
    );

    toast.success(
      nuevoEstado
        ? "Módulo activado correctamente"
        : "Módulo desactivado correctamente",
      { id: toastId }
    );
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Error al cambiar estado del módulo", {
      id: toastId,
    });
  } finally {
    setProcesando(false);
  }
}

  const resumen = useMemo(() => {
    return {
      usuarios: usuarios.length,
      empresas: empresas.length,
      asignaciones: asignaciones.length,
    };
  }, [usuarios, empresas, asignaciones]);

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] text-cyan-400 flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        Cargando panel administrador...
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
                    Panel Administrador
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">
                    Gestión de usuarios, empresas y permisos multiempresa
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Operador: {perfilActual?.nombre} | Rol:{" "}
                {perfilActual?.rol?.toUpperCase()}
              </p>
            </div>

            <button
              onClick={cargarDatos}
              disabled={procesando}
              className="h-12 px-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-sm font-bold text-gray-300 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw size={16} />
              Actualizar
            </button>
          </header>

          <section className="grid md:grid-cols-4 gap-5 mb-10">
            <CardResumen
              icon={<Users size={22} />}
              label="Usuarios"
              value={resumen.usuarios}
              color="text-cyan-400"
            />
<CardResumen
  icon={<Building2 size={22} />}
  label="Módulos activos"
  value={modulos.filter((m) => m.clave !== "admin" && m.activo).length}
  color="text-purple-400"
/>

            <CardResumen
              icon={<Building2 size={22} />}
              label="Empresas"
              value={resumen.empresas}
              color="text-green-400"
            />

            <CardResumen
              icon={<ShieldCheck size={22} />}
              label="Asignaciones"
              value={resumen.asignaciones}
              color="text-yellow-400"
            />
          </section>

          <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-10 border-l-4 border-l-purple-500">
  <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
    <ShieldCheck size={16} className="text-purple-400" />
    Activar / desactivar módulos del sistema
  </h2>

  <p className="text-sm text-gray-500 mb-6">
   Estos módulos controlan qué partes comerciales de Control+ estarán disponibles.
El Panel Admin no se puede desactivar desde aquí para evitar perder el acceso.
  </p>

  <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
    {modulos
  .filter((modulo) => modulo.clave !== "admin")
  .map((modulo) => (
      <button
        key={modulo.id}
        type="button"
        onClick={() => cambiarEstadoModulo(modulo)}
        disabled={procesando}
        className={`text-left rounded-2xl border p-5 transition-all disabled:opacity-50 ${
          modulo.activo
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}
      >
        <p className="text-[10px] font-black uppercase mb-2 opacity-70">
          {modulo.clave}
        </p>

        <h3 className="text-lg font-black text-white">
          {modulo.nombre}
        </h3>

        <p className="text-xs mt-3 font-bold">
          Estado: {modulo.activo ? "Activo" : "Inactivo"}
        </p>

        <p className="text-[10px] mt-2 opacity-60">
          Click para {modulo.activo ? "desactivar" : "activar"}
        </p>
      </button>
    ))}

   {modulos.filter((modulo) => modulo.clave !== "admin").length === 0 && (
  <p className="text-gray-500 text-sm">
    No hay módulos comerciales registrados.
  </p>
)}
  </div>
</section>

         <section className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 mb-10 border-l-4 border-l-cyan-500">
  <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
    <ShieldCheck size={16} className="text-cyan-400" />
    Editar usuario, rol y empresas
  </h2>

  <div className="grid md:grid-cols-3 gap-4 mb-6">
    <select
      value={usuarioEditando}
      onChange={(e) => cargarUsuarioParaEditar(e.target.value)}
      className="input-custom"
    >
      <option value="">Seleccionar usuario...</option>
      {usuarios.map((usuario) => (
        <option key={usuario.id} value={usuario.id}>
          {usuario.nombre} — {usuario.rol}
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
    <option key={rol} value={rol}>
      {rol}
    </option>
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
      <p className="text-xs text-gray-500 uppercase font-black mb-1">
        ID del trabajador / usuario
      </p>

      <p className="text-cyan-400 text-xs font-mono break-all">
        {usuarioEditando}
      </p>
    </div>
  )}

  <div className="flex flex-wrap gap-3 mb-5">
    <button
      type="button"
      onClick={seleccionarTodasLasEmpresas}
      disabled={!usuarioEditando || procesando}
      className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-black uppercase disabled:opacity-50"
    >
      Seleccionar todas
    </button>

    <button
      type="button"
      onClick={limpiarEmpresasSeleccionadas}
      disabled={!usuarioEditando || procesando}
      className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-black uppercase disabled:opacity-50"
    >
      Limpiar selección
    </button>

    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase text-gray-400">
      Empresas seleccionadas: {empresasSeleccionadas.length}
    </div>
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
          className={`text-left rounded-2xl border p-4 transition-all disabled:opacity-50 ${
            activa
              ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
              : "border-white/10 bg-white/[0.02] text-gray-400 hover:border-cyan-500/30"
          }`}
        >
          <p className="text-[10px] font-black uppercase mb-1">
            ID empresa: {empresa.id}
          </p>

          <p className="text-sm font-black">{empresa.nombre}</p>

          <p className="text-[10px] mt-2">
            {activa ? "Asignada" : "No asignada"}
          </p>
        </button>
      );
    })}
  </div>

  <div className="flex flex-wrap gap-3 mb-5">
  <button
    type="button"
    onClick={seleccionarTodosLosModulos}
    disabled={!usuarioEditando || procesando}
    className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-black uppercase disabled:opacity-50"
  >
    Seleccionar módulos
  </button>

  <button
    type="button"
    onClick={limpiarModulosSeleccionados}
    disabled={!usuarioEditando || procesando}
    className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-black uppercase disabled:opacity-50"
  >
    Limpiar módulos
  </button>

  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase text-gray-400">
    Módulos seleccionados: {modulosSeleccionados.length}
  </div>
</div>

<div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 max-h-[320px] overflow-y-auto pr-2">
  {modulos
    .filter((modulo) => modulo.clave !== "admin" && modulo.activo)
    .map((modulo) => {
      const activo = modulosSeleccionados.includes(modulo.clave);

      return (
        <button
          key={modulo.clave}
          type="button"
          onClick={() => toggleModulo(modulo.clave)}
          disabled={!usuarioEditando || procesando}
          className={`text-left rounded-2xl border p-4 transition-all disabled:opacity-50 ${
            activo
              ? "border-purple-500 bg-purple-500/10 text-purple-300"
              : "border-white/10 bg-white/[0.02] text-gray-400 hover:border-purple-500/30"
          }`}
        >
          <p className="text-[10px] font-black uppercase mb-1">
            {modulo.clave}
          </p>

          <p className="text-sm font-black">{modulo.nombre}</p>

          <p className="text-[10px] mt-2">
            {activo ? "Asignado" : "No asignado"}
          </p>
        </button>
      );
    })}
</div>

  <button
    type="button"
    onClick={guardarPermisosUsuario}
    disabled={!usuarioEditando || procesando}
    className="w-full h-14 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50"
  >
    {procesando ? (
      <Loader2 className="animate-spin" size={16} />
    ) : (
      <ShieldCheck size={16} />
    )}
    Guardar rol, empresas y módulos
  </button>
</section>

          <section className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
                Usuarios del sistema
              </h2>

              <div className="space-y-3">
                {usuarios.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between gap-4 bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4"
                  >
                    <div>
                      <p className="font-black text-white">{usuario.nombre}</p>
                      <p className="text-[10px] text-gray-500 uppercase mt-1">
  ID trabajador:
</p>

<p className="text-xs text-cyan-400 font-mono break-all">
  {usuario.id}
</p>
                    </div>

                   <div className="flex flex-col items-end gap-2">
  <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
    {usuario.rol}
  </span>

  <span
    className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
      usuario.activo === false
        ? "bg-red-500/10 text-red-400 border-red-500/20"
        : "bg-green-500/10 text-green-400 border-green-500/20"
    }`}
  >
    {usuario.activo === false ? "Inactivo" : "Activo"}
  </span>
</div>
                  </div>
                ))}

                {usuarios.length === 0 && (
                  <p className="text-gray-500 text-sm">
                    No hay usuarios registrados.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
                Empresas asignadas
              </h2>

              <div className="space-y-3">
                {asignaciones.map((asignacion) => (
                  <div
                    key={asignacion.id}
                    className="bg-[#0f172a]/70 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-black text-white">
                        {asignacion.usuario}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        Rol: {asignacion.rol}
                      </p>

                      <p className="text-xs text-cyan-400 mt-1">
                        Empresa: {asignacion.empresa}
                      </p>
                    </div>

                    <button
                      onClick={() => quitarAsignacion(asignacion.id)}
                      disabled={procesando}
                      className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center disabled:opacity-50"
                      title="Quitar empresa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {asignaciones.length === 0 && (
                  <p className="text-gray-500 text-sm">
                    No hay empresas asignadas todavía.
                  </p>
                )}
              </div>
            </div>
          </section>
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