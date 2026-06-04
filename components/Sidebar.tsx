"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Wallet,
  WalletCards,
  Users,
  Receipt,
  Truck,
  LogOut,
  Loader2,
  CalendarDays,
  FileText,
  ClipboardList,
  ShieldCheck,
  FileSpreadsheet,
  History,
  FolderOpen,
  BarChart3,
  RotateCcw,
  ServerCog,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { validarUsuarioActivo } from "../lib/validarUsuarioActivo";

const ROLES_ADMIN = ["admin", "supervisor", "jefe"];
const ROLES_SOLO_ORDENES = ["iniciador_gestion", "firmante_oc"];
const SIDEBAR_COLAPSADO_KEY = "controlplus_sidebar_colapsado";
const THEME_KEY = "controlplus_theme";
type Theme = "dark" | "light";

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
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [preferenciaCargada, setPreferenciaCargada] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  function aplicarTema(siguienteTema: Theme) {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(siguienteTema);
    document.documentElement.dataset.theme = siguienteTema;
    document.documentElement.style.colorScheme = siguienteTema;
  }

  useEffect(() => {
    const preferenciaGuardada = window.localStorage.getItem(
      SIDEBAR_COLAPSADO_KEY
    );
    const temaGuardado = window.localStorage.getItem(THEME_KEY);
    const temaInicial = temaGuardado === "light" ? "light" : "dark";

    setSidebarColapsado(preferenciaGuardada === "true");
    setTheme(temaInicial);
    aplicarTema(temaInicial);
    setPreferenciaCargada(true);
  }, []);

  useEffect(() => {
    if (!preferenciaCargada) return;

    window.localStorage.setItem(
      SIDEBAR_COLAPSADO_KEY,
      String(sidebarColapsado)
    );
  }, [preferenciaCargada, sidebarColapsado]);

  function cambiarTema() {
    const siguienteTema = theme === "dark" ? "light" : "dark";
    setTheme(siguienteTema);
    aplicarTema(siguienteTema);
    window.localStorage.setItem(THEME_KEY, siguienteTema);
  }

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
        const rolPerfilNormalizado = (perfil.rol || "").trim().toLowerCase();

        setRol(perfil.rol);

        const consultaModulosActivos = supabase
          .from("modulos_sistema")
          .select("clave,activo")
          .eq("activo", true);

        if (rolPerfilNormalizado === "admin") {
          const { data: modulosData, error: modulosError } =
            await consultaModulosActivos;

          if (modulosError) {
            console.error("Error cargando módulos en Sidebar:", modulosError);
            setModulosActivos([]);
          } else {
            setModulosActivos(
              (modulosData || []).map((modulo: ModuloSistema) => modulo.clave)
            );
          }

          setModulosUsuario([]);
          return;
        }

        const [modulosResultado, usuarioModulosResultado] = await Promise.all([
          consultaModulosActivos,
          supabase
            .from("usuario_modulos")
            .select("modulo_clave,activo")
            .eq("usuario_id", user.id)
            .eq("activo", true),
        ]);

        if (modulosResultado.error) {
          console.error(
            "Error cargando módulos en Sidebar:",
            modulosResultado.error
          );
          setModulosActivos([]);
        } else {
          setModulosActivos(
            (modulosResultado.data || []).map(
              (modulo: ModuloSistema) => modulo.clave
            )
          );
        }

        if (usuarioModulosResultado.error) {
          console.error(
            "Error cargando módulos del usuario:",
            usuarioModulosResultado.error
          );
          setModulosUsuario([]);
        } else {
          setModulosUsuario(
            (usuarioModulosResultado.data || []).map(
              (modulo) => modulo.modulo_clave
            )
          );
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
  if (clave === "admin") return ROLES_ADMIN.includes(rolNormalizado);

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
    name: "Calendario",
    path: "/calendario",
    icon: CalendarDays,
    clave: "calendario",
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
    name: "Auxiliar",
    path: "/auxiliar",
    icon: CheckSquare,
    clave: "auxiliar",
  },
  {
    name: "Planilla",
    path: "/planilla",
    icon: Users,
    clave: "planilla",
  },
  {
    name: "Impuestos",
    path: "/impuestos",
    icon: Receipt,
    clave: "impuestos",
  },
  {
    name: "Conciliación bancaria",
    path: "/conciliacion-bancaria",
    icon: Wallet,
    clave: "conciliacion-bancaria",
  },
  {
    name: "Flujo de efectivo",
    path: "/flujo-efectivo",
    icon: BarChart3,
    clave: "flujo-efectivo",
  },
  {
    name: "Proyectos",
    path: "/proyectos",
    icon: Building2,
    clave: "proyectos",
  },
  {
    name: "Activos fijos",
    path: "/activos-fijos",
    icon: FileSpreadsheet,
    clave: "activos-fijos",
  },
  {
    name: "Cuentas por Cobrar",
    path: "/cuentas-cobrar",
    icon: WalletCards,
    clave: "cuentas-cobrar",
  },
  {
    name: "Cuentas por Pagar",
    path: "/cuentas-pagar",
    icon: WalletCards,
    clave: "cuentas-pagar",
  },
  {
    name: "Reportes",
    path: "/reportes",
    icon: BarChart3,
    clave: "reportes",
  },
  {
    name: "Reinicio Controlado",
    path: "/reinicio-controlado",
    icon: RotateCcw,
    clave: "reinicio-controlado",
  },
  {
  name: "Proveedores",
  path: "/proveedores",
  icon: Truck,
  clave: "proveedores",
},
  {
  name: "Clientes",
  path: "/clientes",
  icon: Users,
  clave: "clientes",
},
  {
  name: "Importaciones",
  path: "/importaciones",
  icon: FileSpreadsheet,
  clave: "importaciones",
},
  {
    name: "Documentos",
    path: "/documentos",
    icon: FolderOpen,
    clave: "documentos",
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
    name: "Usuarios",
    path: "/usuarios",
    icon: Users,
    clave: "usuarios",
  },
  {
    name: "Historial",
    path: "/historial",
    icon: History,
    clave: "historial",
  },
];

  // Administracion operativa: usuarios, empresas asignadas y modulos por usuario.
  const menusSoloAdmin = [
    {
      name: "Admin Operativo",
      path: "/admin",
      icon: ShieldCheck,
      clave: "admin",
    },
    {
      name: "Monitoreo Sistema",
      path: "/monitoreo-sistema",
      icon: ServerCog,
      clave: "monitoreo-sistema",
    },
  ];

  // Rutas para usuarios que solo trabajan órdenes
  const menusOrdenes = [
    {
      name: "Calendario",
      path: "/calendario",
      icon: CalendarDays,
      clave: "calendario",
    },
    {
      name: "Órdenes",
      path: "/ordenes-compra",
      icon: ClipboardList,
      clave: "ordenes",
    },
    {
      name: "Documentos",
      path: "/documentos",
      icon: FolderOpen,
      clave: "documentos",
    },
    {
      name: "Reportes",
      path: "/reportes",
      icon: BarChart3,
      clave: "reportes",
    },
  ];

  const menus = ROLES_SOLO_ORDENES.includes(rolNormalizado)
    ? menusOrdenes
    : rolNormalizado === "admin"
    ? [...menusBase, ...menusAdmin, ...menusSoloAdmin]
    : ROLES_ADMIN.includes(rolNormalizado)
    ? [...menusBase, ...menusAdmin, menusSoloAdmin[0]]
    : menusBase;

  const menusFiltrados = menus.filter((menu) =>
  menu.clave === "admin" || menu.clave === "monitoreo-sistema" ? true : moduloActivo(menu.clave)
);

  const gruposSidebar = [
    {
      titulo: "Operacion",
      rutas: ["/dashboard", "/calendario", "/tareas", "/cheques", "/ordenes-compra"],
    },
    {
      titulo: "Contabilidad y Finanzas",
      rutas: [
        "/contabilidad",
        "/auxiliar",
        "/planilla",
        "/impuestos",
        "/conciliacion-bancaria",
        "/flujo-efectivo",
        "/proyectos",
        "/activos-fijos",
        "/cuentas-cobrar",
        "/cuentas-pagar",
        "/reportes",
        "/finanzas",
      ],
    },
    {
      titulo: "Administracion",
      rutas: ["/clientes", "/proveedores", "/empresas", "/importaciones", "/documentos"],
    },
    {
      titulo: "Seguridad y Control",
      rutas: [
        "/usuarios",
        "/historial",
        "/admin",
        "/monitoreo-sistema",
        "/reinicio-controlado",
      ],
    },
  ].map((grupo) => ({
    ...grupo,
    menus: grupo.rutas
      .map((ruta) => menusFiltrados.find((menu) => menu.path === ruta))
      .filter((menu) => Boolean(menu)),
  }));

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [pathname, menusFiltrados.length]);

  return (
    <aside
      className={`hidden md:flex h-screen max-h-screen bg-[var(--sidebar)] text-[var(--sidebar-foreground)] border-r border-[var(--card-border)] flex-col sticky top-0 overflow-hidden transition-[width,padding] duration-200 ${
        sidebarColapsado ? "w-[88px] p-3" : "w-[280px] p-6"
      }`}
    >
      <div className={`shrink-0 mb-6 ${sidebarColapsado ? "px-0" : "px-2"}`}>
        <div
          className={`flex gap-2 ${
            sidebarColapsado
              ? "flex-col items-center"
              : "items-center justify-between"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-black text-black shrink-0">
              C+
            </div>

            {!sidebarColapsado && (
              <h1 className="text-2xl font-black text-[var(--sidebar-foreground)] tracking-tighter truncate">
                Control+
              </h1>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarColapsado((valorActual) => !valorActual)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--muted-strong)] hover:text-[var(--sidebar-foreground)] hover:bg-[var(--card)] transition-all"
            aria-label={
              sidebarColapsado ? "Expandir menu lateral" : "Contraer menu lateral"
            }
            title={
              sidebarColapsado ? "Expandir menu lateral" : "Contraer menu lateral"
            }
          >
            {sidebarColapsado ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        {rol && !sidebarColapsado && (
          <p className="text-[10px] text-[var(--muted-strong)] uppercase font-bold mt-2 ml-1">
            Rol: {rolNormalizado}
          </p>
        )}
      </div>

      <nav
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent ${
          sidebarColapsado ? "space-y-3 pr-0" : "space-y-5 pr-2"
        }`}
      >
        {gruposSidebar.map((grupo) =>
          grupo.menus.length > 0 ? (
            <section
              key={grupo.titulo}
              className={
                sidebarColapsado
                  ? "space-y-2 border-t border-[var(--card-border)] pt-3 first:border-t-0 first:pt-0"
                  : "space-y-2"
              }
            >
              {!sidebarColapsado && (
                <h2 className="px-4 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                  {grupo.titulo}
                </h2>
              )}

              <div className="space-y-2">
                {grupo.menus.map((menu) => {
                  if (!menu) return null;

                  const Icon = menu.icon;
                  const active = pathname.startsWith(menu.path);

                  return (
                    <Link
                      ref={active ? activeLinkRef : null}
                      key={menu.path}
                      href={menu.path}
                      title={sidebarColapsado ? menu.name : undefined}
                      aria-label={menu.name}
                      className={`group flex items-center rounded-2xl transition-all ${
                        sidebarColapsado
                          ? "w-12 h-12 justify-center"
                          : "justify-between p-4"
                      } ${
                        active
                          ? "bg-cyan-500/10 text-cyan-400"
                          : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--sidebar-foreground)]"
                      }`}
                    >
                      <div
                        className={`flex items-center ${
                          sidebarColapsado ? "justify-center" : "gap-3"
                        }`}
                      >
                        <Icon size={20} className="shrink-0" />

                        {!sidebarColapsado && (
                          <span className="font-semibold text-sm">
                            {menu.name}
                          </span>
                        )}
                      </div>

                      {active && !sidebarColapsado && (
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null
        )}

        {loadingRol && (
          <div
            className={`flex items-center text-[var(--muted-strong)] ${
              sidebarColapsado ? "justify-center p-3 [&>span]:hidden" : "gap-3 p-4"
            }`}
          >
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs italic">Cargando módulos...</span>
          </div>
        )}

        {!loadingRol && menusFiltrados.length === 0 && !sidebarColapsado && (
          <div className="p-4 text-[var(--muted-strong)] text-xs italic">
            No hay módulos activos disponibles.
          </div>
        )}
      </nav>

      <div className="shrink-0 pt-4 mt-4 border-t border-[var(--card-border)] space-y-2">
        <button
          type="button"
          onClick={cambiarTema}
          className={`w-full flex items-center rounded-2xl text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--sidebar-foreground)] transition-all ${
            sidebarColapsado ? "h-12 justify-center [&>span]:hidden" : "gap-3 p-4"
          }`}
          aria-label={
            theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
          }
          title={
            sidebarColapsado
              ? theme === "dark"
                ? "Tema claro"
                : "Tema oscuro"
              : undefined
          }
        >
          {theme === "dark" ? (
            <Sun size={20} className="shrink-0" />
          ) : (
            <Moon size={20} className="shrink-0" />
          )}

          <span className="font-bold text-sm">
            {theme === "dark" ? "Tema claro" : "Tema oscuro"}
          </span>
        </button>

        <button
          onClick={cerrarSesion}
          className={`w-full flex items-center rounded-2xl text-[var(--muted-strong)] hover:bg-red-500/10 hover:text-red-400 transition-all ${
            sidebarColapsado ? "h-12 justify-center [&>span]:hidden" : "gap-3 p-4"
          }`}
          aria-label="Cerrar sesion"
          title={sidebarColapsado ? "Cerrar sesion" : undefined}
        >
          <LogOut size={20} className="shrink-0" />

          <span className="font-bold text-sm">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
