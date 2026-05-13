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
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    async function obtenerPerfil() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("perfiles") // Asegúrate de que tu tabla se llame 'perfiles' o 'profiles'
        .select("rol")
        .eq("id", user.id)
        .single();

      if (data) setRol(data.rol);
    }
    obtenerPerfil();
  }, []);

  async function cerrarSesion() {
    if (!confirm("¿Cerrar sesión ahora?")) return;
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh(); // Limpia caché de Next.js
  }

  // Definición de menús con lógica de roles
  const menus = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Tareas", path: "/tareas", icon: CheckSquare },
    { name: "Empresas", path: "/empresas", icon: Building2 },
    // Solo admins ven Finanzas y Empleados
    ...(rol === "admin" ? [
      { name: "Finanzas", path: "/finanzas", icon: Wallet },
      { name: "Empleados", path: "/empleados", icon: Users },
      { name: "Contabilidad", path: "/contabilidad", icon: Receipt },
    ] : []),
  ];

  return (
    // 'hidden md:flex' hace que desaparezca en móviles para no romper la UI
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
          // Mejora: startsWith permite que /tareas/123 mantenga activo el botón 'Tareas'
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