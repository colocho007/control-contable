"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { Users, Plus, Trash2, ShieldAlert, Loader2 } from "lucide-react";

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfilActual, setPerfilActual] = useState<any>(null);
  
  // Estado del formulario unificado
  const [form, setForm] = useState({ nombre: "", correo: "", rol: "trabajador" });

  // 1. Verificación de Seguridad y Carga de Datos
  useEffect(() => {
    const inicializar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Obtener rol del usuario actual para seguridad en frontend
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .single();

        setPerfilActual(perfil);
        
        if (perfil?.rol === "jefe" || perfil?.rol === "supervisor") {
          await obtenerUsuarios();
        }
      } catch (error) {
        console.error("Error de inicialización:", error);
      } finally {
        setLoading(false);
      }
    };
    inicializar();
  }, []);

  const obtenerUsuarios = async () => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .order("creado_en", { ascending: false });

    if (error) console.error("Error al obtener usuarios:", error.message);
    else setUsuarios(data || []);
  };

  // 2. Validación y Creación (Optimista)
  async function crearUsuario() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!form.nombre || !form.correo) return alert("Completa todos los campos");
    if (!emailRegex.test(form.correo)) return alert("Correo no válido");

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .insert([form])
        .select();

      if (error) throw error;

      // Actualización optimista: añadir al estado sin recargar de la DB
      if (data) {
        setUsuarios([data[0], ...usuarios]);
        setForm({ nombre: "", correo: "", rol: "trabajador" });
      }
    } catch (error: any) {
      alert("Error al crear: " + error.message);
    }
  }

  // 3. Eliminación (Optimista)
  async function eliminarUsuario(id: string) {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;

    try {
      // Quitar de la UI inmediatamente
      setUsuarios(usuarios.filter(u => u.id !== id));

      const { error } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } catch (error: any) {
      alert("No se pudo eliminar: " + error.message);
      obtenerUsuarios(); // Si falla, revertir y sincronizar con la DB
    }
  }

  // Pantalla de Carga
  if (loading) return (
    <div className="flex h-screen bg-[#020617] items-center justify-center text-white">
      <Loader2 className="animate-spin text-cyan-500" size={48} />
    </div>
  );

  // Pantalla de Seguridad (Acceso Denegado)
  if (perfilActual?.rol !== "jefe" && perfilActual?.rol !== "supervisor") {
    return (
      <div className="flex bg-[#020617] min-h-screen text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <ShieldAlert size={80} className="text-red-500 mb-4" />
          <h1 className="text-3xl font-bold">Acceso Restringido</h1>
          <p className="text-gray-400 mt-2">No tienes permisos para gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10">
            <h1 className="text-5xl font-black italic tracking-tighter">USUARIOS</h1>
            <p className="text-gray-400 mt-2">Panel de administración de personal</p>
          </header>

          {/* Formulario */}
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
                placeholder="correo@empresa.com"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                className="input-style"
              />
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className="input-style"
              >
                <option value="trabajador">Trabajador</option>
                <option value="supervisor">Supervisor</option>
                <option value="jefe">Jefe / Admin</option>
              </select>
            </div>
            <button
              onClick={crearUsuario}
              className="mt-5 bg-cyan-500 hover:bg-cyan-400 transition-all hover:scale-[1.02] active:scale-95 px-8 py-4 rounded-2xl flex items-center gap-2 font-bold text-black"
            >
              <Plus size={20} /> Crear Nuevo Usuario
            </button>
          </section>

          {/* Grid de Usuarios */}
          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {usuarios.map((usuario) => (
              <div key={usuario.id} className="group bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-cyan-500/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="bg-cyan-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                      <Users className="text-cyan-400" size={24} />
                    </div>
                    <h2 className="text-xl font-bold truncate">{usuario.nombre}</h2>
                    <p className="text-gray-400 text-sm mt-1 truncate">{usuario.correo}</p>
                    <span className="inline-block bg-cyan-500/20 text-cyan-400 text-xs mt-4 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                      {usuario.rol}
                    </span>
                  </div>
                  <button
                    onClick={() => eliminarUsuario(usuario.id)}
                    className="bg-red-500/10 hover:bg-red-500/30 text-red-400 p-3 rounded-2xl transition-all"
                    title="Eliminar usuario"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      <style jsx>{`
        .input-style {
          height: 3.5rem;
          padding: 0 1.25rem;
          border-radius: 1rem;
          background: #0B1120;
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