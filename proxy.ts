import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/admin",
  "/usuarios",
  "/monitoreo-sistema",
  "/empresas",
  "/clientes",
  "/proveedores",
  "/cheques",
  "/ordenes-compra",
  "/activos-fijos",
  "/auxiliar",
  "/conciliacion-bancaria",
  "/contabilidad",
  "/cuentas-cobrar",
  "/cuentas-pagar",
  "/documentos",
  "/flujo-efectivo",
  "/historial",
  "/impuestos",
  "/reportes",
  "/importaciones",
  "/calendario",
  "/planilla",
  "/proyectos",
  "/reinicio-controlado",
  "/tareas",
  "/finanzas",
  "/empleados",
];

export async function proxy(req: NextRequest) {
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

  const redirectSafe = (path: string) => {
    const redirectResponse = NextResponse.redirect(new URL(path, req.url));
    res.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  if (req.nextUrl.pathname === "/") {
    return redirectSafe(user ? "/dashboard" : "/login");
  }

  if (req.nextUrl.pathname === "/login" && user && !error) {
    return redirectSafe("/dashboard");
  }

  const isProtected = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  if (isProtected && (!user || error)) {
    return redirectSafe("/login");
  }

  return res;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/admin/:path*",
    "/usuarios/:path*",
    "/monitoreo-sistema/:path*",
    "/empresas/:path*",
    "/clientes/:path*",
    "/proveedores/:path*",
    "/cheques/:path*",
    "/ordenes-compra/:path*",
    "/activos-fijos/:path*",
    "/auxiliar/:path*",
    "/conciliacion-bancaria/:path*",
    "/contabilidad/:path*",
    "/cuentas-cobrar/:path*",
    "/cuentas-pagar/:path*",
    "/documentos/:path*",
    "/flujo-efectivo/:path*",
    "/historial/:path*",
    "/impuestos/:path*",
    "/reportes/:path*",
    "/importaciones/:path*",
    "/calendario/:path*",
    "/planilla/:path*",
    "/proyectos/:path*",
    "/reinicio-controlado/:path*",
    "/tareas/:path*",
    "/finanzas/:path*",
    "/empleados/:path*",
    "/login",
  ],
};
