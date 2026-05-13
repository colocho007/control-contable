"use client";
import { useRouter } from "next/navigation";
import { verificarRol } from "../../lib/auth";

import { useEffect, useState } from "react";
// ✅ CORRECCIÓN: Import limpio y correcto
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Trash2,
  UserPlus,
  ShieldCheck,
  UserCircle,
  Users,
  AlertCircle,
  Info
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  created_at?: string;
}

export default function EmpleadosPage() {
  const router = useRouter();
  const [empleados, setEmpleados] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // ✅ NUEVO: Estado para proteger la interfaz según el rol
  const [rolActual, setRolActual] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    nombre: "",
    uid: "",
    rol: "empleado"
  });

  useEffect(() => {
    async function iniciar() {
      // ✅ CORRECCIÓN: Ahora supervisor y jefe también pueden entrar
      const acceso = await verificarRol(["admin", "supervisor", "jefe"]);

      if (!acceso.autorizado) {
        router.replace("/dashboard");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      // ✅ NUEVO: Obtenemos el rol exacto del usuario que está navegando
      if (user) {
        setCurrentUserId(user.id);
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .single();

        setRolActual(perfil?.rol || null);
      }

      obtenerEmpleados();
    }

    iniciar();
  }, [router]);

  async function obtenerEmpleados() {
    const { data } = await supabase
      .from("perfiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setEmpleados(data);
  }

  async function crearEmpleado() {
    if (!form.nombre.trim() || !form.uid.trim()) {
      toast.error("Por favor completa el nombre y el UID del usuario.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Registrando acceso...");

    try {
      const { error } = await supabase
        .from("perfiles")
        .insert([
          {
            id: form.uid.trim(), 
            nombre: form.nombre.trim(),
            rol: form.rol,
          },
        ]);

      if (error) throw error;

      setForm({ nombre: "", uid: "", rol: "empleado" });
      obtenerEmpleados();
      toast.success("Usuario registrado exitosamente", { id: toastId });
    } catch (error: any) {
      toast.error("Error al crear empleado: " + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  async function eliminarEmpleado(id: string) {
    if (id === currentUserId) {
      toast.error("Acción denegada: No puedes eliminar tu propio perfil.");
      return;
    }

    if (!window.confirm("¿Estás seguro de eliminar este acceso? El usuario perderá sus permisos.")) return;
    
    const toastId = toast.loading("Eliminando credenciales...");

    try {
      const { error } = await supabase
        .from("perfiles")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Acceso revocado", { id: toastId });
      obtenerEmpleados();
    } catch (error: any) {
      toast.error("Error al eliminar", { id: toastId });
    }
  }

  return (
    <div className="flex bg-[#020617] min-h-screen text-white">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b'} }} />
      
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* HEADER */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <h1 className="text-5xl font-black tracking-tight">Empleados</h1>
              <p className="text-gray-400 mt-2 flex items-center gap-2">
                <Users size={18} className="text-cyan-500" />
                Control de acceso y jerarquía de personal
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
              <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">Total: </span>
              <span className="text-xl font-black text-cyan-400">{empleados.length}</span>
            </div>
          </div>

          {/* FORMULARIO DE REGISTRO */}
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <UserPlus size={120} />
            </div>

            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ShieldCheck className="text-cyan-500" /> Registrar Nuevo Acceso
            </h2>

            <div className="grid md:grid-cols-3 gap-5 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase ml-2">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase ml-2">Supabase UID</label>
                <input
                  type="text"
                  placeholder="ID de Authentication"
                  value={form.uid}
                  onChange={(e) => setForm({ ...form, uid: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all font-mono text-sm"
                />
                <span className="text-[10px] text-cyan-500/70 ml-2 flex items-center gap-1 font-mono">
                  <Info size={10} /> Copia este ID desde el panel Auth de Supabase
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase ml-2">Nivel de Rango</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  className="h-14 px-5 rounded-2xl bg-[#0B1120] border border-white/10 outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="admin">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="jefe">Jefe</option>
                  <option value="empleado">Empleado Estándar</option>
                </select>
              </div>
            </div>

            <button
              onClick={crearEmpleado}
              disabled={loading}
              className="mt-8 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 transition-all active:scale-95"
            >
              {loading ? "Procesando..." : <><UserPlus size={20} /> DAR DE ALTA</>}
            </button>
          </div>

          {/* LISTA DE PERSONAL */}
          <div className="grid gap-4">
            {empleados.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-[3rem]">
                <AlertCircle className="mx-auto text-gray-600 mb-4" size={48} />
                <p className="text-gray-500 font-medium">No hay empleados registrados todavía.</p>
              </div>
            )}

            {empleados.map((emp) => {
              const isMe = emp.id === currentUserId;

              return (
                <div
                  key={emp.id}
                  className={`group bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center transition-all ${isMe ? 'border-cyan-500/30 bg-cyan-900/10' : 'hover:bg-white/[0.08]'}`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 ${getRolStyles(emp.rol).border}`}>
                      <UserCircle size={32} className={getRolStyles(emp.rol).text} />
                    </div>
                    
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        {emp.nombre}
                        {isMe && <span className="text-[10px] bg-cyan-500 text-black px-2 py-0.5 rounded-full uppercase font-black">Tú</span>}
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${getRolStyles(emp.rol).badge}`}>
                          {emp.rol}
                        </span>
                        <span className="text-gray-600 font-mono text-xs">
                          ID: {emp.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ✅ CORRECCIÓN: Botón de eliminar bloqueado por rolActual y verificando que no sea el mismo usuario */}
                  {["admin", "supervisor", "jefe"].includes(rolActual || "") && (
                    <button
                      onClick={() => eliminarEmpleado(emp.id)}
                      disabled={isMe}
                      className={`p-4 rounded-2xl transition-all ${isMe ? 'opacity-20 cursor-not-allowed text-gray-500' : 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white'}`}
                      title={isMe ? "No puedes eliminarte a ti mismo" : "Eliminar acceso"}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

// Función auxiliar para estilos de roles
function getRolStyles(rol: string) {
  switch (rol) {
    case 'admin':
      return { 
        text: 'text-cyan-400', 
        border: 'border-cyan-500/30', 
        badge: 'bg-cyan-500/20 text-cyan-400' 
      };
    case 'supervisor':
    case 'jefe':
      return { 
        text: 'text-purple-400', 
        border: 'border-purple-500/30', 
        badge: 'bg-purple-500/20 text-purple-400' 
      };
    default:
      return { 
        text: 'text-gray-400', 
        border: 'border-white/10', 
        badge: 'bg-white/10 text-gray-400' 
      };
  }
}