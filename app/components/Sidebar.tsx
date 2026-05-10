"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Wallet,
  Users,
  Receipt,
  LogIn,
} from "lucide-react";

export default function Sidebar() {

  const pathname = usePathname();

  const menus = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Tareas",
      path: "/tareas",
      icon: CheckSquare,
    },
    {
      name: "Finanzas",
      path: "/finanzas",
      icon: Wallet,
    },
    {
      name: "Empresas",
      path: "/empresas",
      icon: Building2,
    },
    {
      name: "Empleados",
      path: "/empleados",
      icon: Users,
    },
    {
      name: "Contabilidad",
      path: "/contabilidad",
      icon: Receipt,
    },
    {
      name: "Login",
      path: "/login",
      icon: LogIn,
    },
  ];

  return (

    <aside className="w-[260px] min-h-screen bg-[#020617] border-r border-white/10 p-6">

      <div className="mb-10">

        <h1 className="text-3xl font-black text-white">
          Control+
        </h1>

        <p className="text-gray-400 text-sm mt-1">
          ERP Empresarial
        </p>

      </div>

      <div className="space-y-3">

        {menus.map((menu, index) => {

          const Icon = menu.icon;

          const active =
            pathname === menu.path;

          return (

            <Link
              key={index}
              href={menu.path}
              className={`flex items-center gap-3 p-4 rounded-2xl transition ${
                active
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >

              <Icon size={20} />

              {menu.name}

            </Link>

          );
        })}

      </div>

    </aside>

  );

}