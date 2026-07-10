"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { validarAccesoModuloUsuario } from "../../lib/validarAccesoModuloUsuario";
import { registrarAuditoriaEvento } from "../../lib/auditoria";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const ROLES_PERMITIDOS = ["admin", "jefe", "supervisor"];
const ROLES_VISIBLES = ["jefe", "supervisor", "contador", "auxiliar", "auditor"] as const;
const ETIQUETAS_ROL: Record<(typeof ROLES_VISIBLES)[number], string> = {
  jefe: "Jefe",
  supervisor: "Supervisor",
  contador: "Contador",
  auxiliar: "Auxiliar",
  auditor: "Auditor",
};
const MOTIVO_DESACTIVACION = "Desactivado desde modulo Usuarios";
const IDEMPOTENCY_PREFIX_ADMIN = "controlplus_idempotency_admin";

function normalizarRol(rol?: string | null) {
  return (rol || "").trim().toLowerCase();
}

function obtenerMensajeError(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function generarIdempotencyKeyCrearUsuario() {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${IDEMPOTENCY_PREFIX_ADMIN}:crear_usuario_operativo:${aleatorio}`;
}

interface Perfil {
  id: string;
  nombre: string;
  correo: string | null;
  rol: string;
  activo: boolean | null;
  created_at: string | null;
}

export default function UsuariosPage() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: "",
    uid: "",
    correo: "",
    rol: "auxiliar",
  });

  useEffect(() => {
    const inicializar = async () => {
      try {
        const acceso = await validarAccesoModuloUsuario("usuarios");

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

          if (
            acceso.motivo === "modulo_inactivo" ||
            acceso.motivo === "modulo_no_encontrado"
          ) {
            toast.error("El modulo de Usuarios esta desactivado.");
          } else {
            toast.error("No tienes acceso al modulo de Usuarios.");
          }

          router.replace("/dashboard");
          return;
        }

        const rolNormalizado = normalizarRol(acceso.perfil?.rol);

        if (!ROLES_PERMITIDOS.includes(rolNormalizado)) {
          router.replace("/dashboard");
          return;
        }

        setCurrentUserId(acceso.user!.id);
        await obtenerPerfiles();
        setAutorizado(true);
      } catch (error) {
        console.error("Error de inicializacion:", error);
      } finally {
        setLoading(false);
      }
    };

    inicializar();
  }, [router]);

  async function obtenerPerfiles() {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre,correo,rol,activo,created_at")
      .eq("activo", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al obtener perfiles:", error.message);
      return;
    }

    setPerfiles((data || []).filter((perfil) => normalizarRol(perfil.rol) !== "admin"));
  }

  async function crearPerfil() {
    if (!form.nombre.trim() || !form.uid.trim() || !form.correo.trim()) {
      toast.error("Completa el nombre, correo e identificador interno existente.");
      return;
    }

    if (!ROLES_VISIBLES.includes(form.rol as (typeof ROLES_VISIBLES)[number])) {
      toast.error("Selecciona un rol operativo permitido.");
      return;
    }

    setProcesando(true);

    try {
      const respuesta = await fetch("/api/admin/perfiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: form.nombre,
          uid: form.uid,
          correo: form.correo,
          rol: form.rol,
          idempotency_key: generarIdempotencyKeyCrearUsuario(),
        }),
      });

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado?.error || "No se pudo crear el perfil de usuario."
        );
      }

      setForm({ nombre: "", uid: "", correo: "", rol: "auxiliar" });
      await obtenerPerfiles();
      toast.success(resultado?.advertencia || "Perfil de usuario creado correctamente.");
    } catch (error: unknown) {
      toast.error("Error al crear perfil de usuario: " + obtenerMensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  async function desactivarPerfil(id: string) {
    if (id === currentUserId) {
      toast.error("No puedes desactivar tu propio perfil de usuario.");
      return;
    }

    if (
      !window.confirm(
        "Estas seguro de desactivar este perfil de usuario? Perdera acceso al sistema."
      )
    ) {
      return;
    }

    setProcesando(true);

    try {
      const perfilDesactivado = perfiles.find((perfil) => perfil.id === id);
      const { error } = await supabase
        .from("perfiles")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;

      let auditoriaRegistrada = true;

      try {
        await registrarAuditoriaEvento({
          modulo: "usuarios",
          accion: "desactivar_perfil",
          entidad_tipo: "perfil",
          entidad_id: id,
          estado_anterior: "activo",
          estado_nuevo: "inactivo",
          motivo: MOTIVO_DESACTIVACION,
          descripcion: "Perfil de usuario desactivado",
          sensible: true,
          metadatos: {
            nombre: perfilDesactivado?.nombre ?? null,
            correo: perfilDesactivado?.correo ?? null,
            rol: perfilDesactivado?.rol ?? null,
          },
          origen: "modulo_usuarios",
        });
      } catch (auditoriaError) {
        auditoriaRegistrada = false;
        console.error(
          "El perfil fue desactivado, pero no se pudo registrar la auditoria:",
          auditoriaError
        );
      }

      await obtenerPerfiles();
      toast.success(
        auditoriaRegistrada
          ? "Perfil de usuario desactivado correctamente."
          : "Perfil desactivado, pero no se pudo registrar la auditoria. Contacta al administrador."
      );
    } catch (error: unknown) {
      toast.error("No se pudo desactivar el perfil: " + obtenerMensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  if (loading || !autorizado) {
    return (
      <div className="flex h-screen bg-[#020617] items-center justify-center text-white">
        <Loader2 className="animate-spin text-cyan-500" size={48} />
        <span className="ml-3">Validando acceso...</span>
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Sidebar />
      <Toaster position="top-right" />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10">
            <h1 className="text-5xl font-black italic tracking-tighter">
              USUARIOS
            </h1>
            <p className="text-gray-400 mt-2">
              Administracion de perfiles de usuario del sistema
            </p>
          </header>

          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
            <div className="grid md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="input-style"
              />
              <input
                type="email"
                placeholder="Correo registrado"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                className="input-style"
              />
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className="input-style"
              >
                {ROLES_VISIBLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {ETIQUETAS_ROL[rol]}
                  </option>
                ))}
              </select>
            </div>
            <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-gray-400">
                Detalle técnico
              </summary>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Identificador interno existente"
                  value={form.uid}
                  onChange={(e) => setForm({ ...form, uid: e.target.value })}
                  className="input-style font-mono w-full"
                />
                <p className="text-xs text-cyan-500/70 mt-3">
                  El identificador y el correo deben existir previamente en el sistema de autenticacion.
                </p>
              </div>
            </details>
            <button
              onClick={crearPerfil}
              disabled={procesando}
              className="mt-5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95 px-8 py-4 rounded-2xl flex items-center gap-2 font-bold text-black"
            >
              <Plus size={20} /> Crear Perfil de Usuario
            </button>
          </section>

          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {perfiles.map((perfil) => (
              <div
                key={perfil.id}
                className="group bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-cyan-500/50 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="bg-cyan-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                      <Users className="text-cyan-400" size={24} />
                    </div>
                    <h2 className="text-xl font-bold truncate">
                      {perfil.nombre}
                    </h2>
                    {perfil.correo && (
                      <p className="text-gray-400 text-xs mt-1 truncate">
                        {perfil.correo}
                      </p>
                    )}
                    {perfil.created_at && (
                      <p className="text-gray-500 text-xs mt-2">
                        Creado:{" "}
                        {new Date(perfil.created_at).toLocaleDateString("es-GT")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="inline-block bg-cyan-500/20 text-cyan-400 text-xs px-3 py-1 rounded-full font-black uppercase tracking-wider">
                        {perfil.rol}
                      </span>
                      <span className="inline-block bg-green-500/10 text-green-400 text-xs px-3 py-1 rounded-full font-black uppercase tracking-wider">
                        Activo
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => desactivarPerfil(perfil.id)}
                    disabled={procesando || perfil.id === currentUserId}
                    className="bg-red-500/10 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed text-red-400 p-3 rounded-2xl transition-all"
                    title={
                      perfil.id === currentUserId
                        ? "No puedes desactivar tu propio perfil"
                        : "Desactivar perfil de usuario"
                    }
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}

            {perfiles.length === 0 && (
              <p className="text-gray-500">No hay perfiles activos registrados.</p>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .input-style {
          height: 3.5rem;
          padding: 0 1.25rem;
          border-radius: 1rem;
          background: #0b1120;
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
          transition: border-color 0.2s;
        }
        .input-style:focus {
          border-color: #06b6d4;
        }
      `}</style>
    </div>
  );
}
