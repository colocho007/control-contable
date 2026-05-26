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
  Truck,
  LogOut,
  Loader2,
  FileText,
  ClipboardList,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { validarUsuarioActivo } from "../lib/validarUsuarioActivo";

const ROLES_ADMIN = ["admin", "supervisor", "jefe"];
const ROLES_SOLO_ORDENES = ["iniciador_gestion", "firmante_oc"];

interface ModuloSistema {
  clave: string;
  activo: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [rol, setRol] = useState<string | null>(null);
  const [loadingRol, setLoadingRol] = useState(true);
  const [modulosActivos, setModulosActivos] = useState<string[]>([]);
  const [modulosUsuario, setModulosUsuario] = useState<string[]>([]);

  useEffect(() => {
    async function obtenerPerfilYModulos() {
      try {
        const validacion = await validarUsuarioActivo();

        if (!validacion.ok) {
          setRol(null);
          setModulosActivos([]);
          setModulosUsuario([]);
          return;
        }

        const user = validacion.user!;
        const perfil = validacion.perfil!;

        setRol(perfil.rol);

        const { data: modulosData, error: modulosError } = await supabase
          .from("modulos_sistema")
          .select("clave,activo")
          .eq("activo", true);
        

        if (modulosError) {
          console.error("Error cargando módulos en Sidebar:", modulosError);
        } else {
          setModulosActivos(
            (modulosData || []).map((modulo: ModuloSistema) => modulo.clave)
          );
          const { data: usuarioModulosData, error: usuarioModulosError } =
  await supabase
    .from("usuario_modulos")
    .select("modulo_clave,activo")
    .eq("usuario_id", user.id)
    .eq("activo", true);

if (usuarioModulosError) {
  console.error("Error cargando módulos del usuario:", usuarioModulosError);
} else {
  setModulosUsuario(
    (usuarioModulosData || []).map((modulo) => modulo.modulo_clave)
  );
}
        }
      } catch (error) {
        console.error("Error cargando perfil en Sidebar:", error);
      } finally {
        setLoadingRol(false);
      }
    }

    obtenerPerfilYModulos();
  }, []);

  async function cerrarSesion() {
    if (!window.confirm("¿Seguro que deseas cerrar sesión?")) return;

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const rolNormalizado = (rol || "").trim().toLowerCase();

 function moduloActivo(clave: string) {
  if (clave === "admin") return rolNormalizado === "admin";

  if (rolNormalizado === "admin") {
    return modulosActivos.includes(clave);
  }

  return modulosActivos.includes(clave) && modulosUsuario.includes(clave);
}

  // Rutas base
 const menusBase = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    clave: "dashboard",
  },
  {
    name: "Tareas",
    path: "/tareas",
    icon: CheckSquare,
    clave: "tareas",
  },
  {
    name: "Cheques",
    path: "/cheques",
    icon: FileText,
    clave: "cheques",
  },
  {
    name: "Órdenes",
    path: "/ordenes-compra",
    icon: ClipboardList,
    clave: "ordenes",
  },
  {
    name: "Contabilidad",
    path: "/contabilidad",
    icon: Receipt,
    clave: "contabilidad",
  },
  {
  name: "Proveedores",
  path: "/proveedores",
  icon: Truck,
  clave: "proveedores",
},
  {
  name: "Importaciones",
  path: "/importaciones",
  icon: FileSpreadsheet,
  clave: "importaciones",
},
];

  // Rutas administrativas normales
const menusAdmin = [
  {
    name: "Empresas",
    path: "/empresas",
    icon: Building2,
    clave: "empresas",
  },
  {
    name: "Finanzas",
    path: "/finanzas",
    icon: Wallet,
    clave: "finanzas",
  },
  {
    name: "Empleados",
    path: "/empleados",
    icon: Users,
    clave: "empleados",
  },
  {
    name: "Usuarios",
    path: "/usuarios",
    icon: Users,
    clave: "usuarios",
  },
];

  // Ruta exclusiva del admin principal
  const menusSoloAdmin = [
    {
      name: "Admin",
      path: "/admin",
      icon: ShieldCheck,
      clave: "admin",
    },
  ];

  // Rutas para usuarios que solo trabajan órdenes
  const menusOrdenes = [
    {
      name: "Órdenes",
      path: "/ordenes-compra",
      icon: ClipboardList,
      clave: "ordenes",
    },
  ];

  const menus = ROLES_SOLO_ORDENES.includes(rolNormalizado)
    ? menusOrdenes
    : rolNormalizado === "admin"
    ? [...menusBase, ...menusAdmin, ...menusSoloAdmin]
    : ROLES_ADMIN.includes(rolNormalizado)
    ? [...menusBase, ...menusAdmin]
    : menusBase;

  const menusFiltrados = menus.filter((menu) =>
  menu.clave === "admin" ? true : moduloActivo(menu.clave)
);

  return (
    <aside className="hidden md:flex w-[280px] h-screen bg-[#020617] border-r border-white/10 p-6 flex-col sticky top-0">
      <div className="mb-10 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-black text-black">
            C+
          </div>

          <h1 className="text-2xl font-black text-white tracking-tighter">
            Control+
          </h1>
        </div>

        {rol && (
          <p className="text-[10px] text-gray-500 uppercase font-bold mt-2 ml-1">
            Rol: {rolNormalizado}
          </p>
        )}
      </div>

      <nav className="flex-1 space-y-2">
        {menusFiltrados.map((menu) => {
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

              {active && (
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
              )}
            </Link>
          );
        })}

        {loadingRol && (
          <div className="flex items-center gap-3 p-4 text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs italic">Cargando módulos...</span>
          </div>
        )}

        {!loadingRol && menusFiltrados.length === 0 && (
          <div className="p-4 text-gray-600 text-xs italic">
            No hay módulos activos disponibles.
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
