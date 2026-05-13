"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Wallet,
  Users,
  Receipt,
  LogOut,
  Loader2 
} from "lucide-react";
import { supabase } from "../lib/supabase";

const ROLES_ADMIN = ["admin", "supervisor", "jefe"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [rol, setRol] = useState<string | null>(null);
  const [loadingRol, setLoadingRol] = useState(true);

  useEffect(() => {
    async function obtenerPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
  setLoadingRol(false);
  return;
}

        const { data } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .single();

        if (data) setRol(data.rol);
      } catch (error) {
        console.error("Error cargando perfil en Sidebar:", error);
      } finally {
        setLoadingRol(false); 
      }
    }
    obtenerPerfil();
  }, []);

  async function cerrarSesion() {
    if (!window.confirm("¿Seguro que deseas cerrar sesión?")) return;
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh(); 
  }

  // Rutas base que todos (incluyendo empleados) pueden ver
  const menusBase = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Tareas", path: "/tareas", icon: CheckSquare },
  ];

  // Rutas que solo ven los altos mandos
  const menusAdmin = [
    { name: "Empresas", path: "/empresas", icon: Building2 },
    { name: "Finanzas", path: "/finanzas", icon: Wallet },
    { name: "Empleados", path: "/empleados", icon: Users },
    { name: "Contabilidad", path: "/contabilidad", icon: Receipt },
  ];

  // Unimos los menús basándonos en la validación segura del rol
  const menus = ROLES_ADMIN.includes(rol || "") 
    ? [...menusBase, ...menusAdmin] 
    : menusBase;

  return (
    <aside className="hidden md:flex w-[280px] h-screen bg-[#020617] border-r border-white/10 p-6 flex-col sticky top-0">
      
      <div className="mb-10 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-black text-black">C+</div>
          <h1 className="text-2xl font-black text-white tracking-tighter">Control+</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {menus.map((menu) => {
          const Icon = menu.icon;
          const active = pathname.startsWith(menu.path);

          return (
            <Link
              key={menu.path}
              href={menu.path}
              className={`group flex items-center justify-between p-4 rounded-2xl transition-all ${
                active
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-400 hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} />
                <span className="font-semibold text-sm">{menu.name}</span>
              </div>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />}
            </Link>
          );
        })}

        {loadingRol && (
          <div className="flex items-center gap-3 p-4 text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs italic">Cargando módulos...</span>
          </div>
        )}
      </nav>

      <div className="pt-6 border-t border-white/5">
        <button
          onClick={cerrarSesion}
          className="w-full flex items-center gap-3 p-4 rounded-2xl text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={20} />
          <span className="font-bold text-sm">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}