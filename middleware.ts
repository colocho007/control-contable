import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/tareas",
  "/finanzas",
  "/empleados",
  "/contabilidad",
  "/empresas",
];

const adminRoutes = [
  "/finanzas",
  "/contabilidad",
  "/empleados",
  "/empresas",
];

const rolesPermitidos = [
  "admin",
  "supervisor",
  "jefe",
];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 🚀 MEJORA 1: Función para redirigir SIN perder las cookies de sesión
  const redirectSafe = (path: string) => {
    const redirectResponse = NextResponse.redirect(new URL(path, req.url));
    res.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  // 🚀 MEJORA 2: Atrapar a los que entran a la raíz (tudominio.com/)
  if (req.nextUrl.pathname === "/") {
    return redirectSafe(user ? "/dashboard" : "/login");
  }

  const isProtected = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  if (isProtected && (!user || error)) {
    return redirectSafe("/login");
  }

  if (req.nextUrl.pathname === "/login" && user) {
    return redirectSafe("/dashboard");
  }

  if (user) {
    const isAdminRoute = adminRoutes.some((route) =>
      req.nextUrl.pathname.startsWith(route)
    );

    if (isAdminRoute) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();

      if (!perfil?.rol || !rolesPermitidos.includes(perfil.rol)) {
        return redirectSafe("/dashboard"); // Usamos la redirección segura aquí también
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/", // <-- 🚀 Agregado para atrapar la raíz
    "/dashboard/:path*",
    "/tareas/:path*",
    "/finanzas/:path*",
    "/empleados/:path*",
    "/contabilidad/:path*",
    "/empresas/:path*",
    "/login",
  ],
};