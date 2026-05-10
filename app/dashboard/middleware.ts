import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {

  const isLogged =
    request.cookies.get(
      "sb-access-token"
    );

  const protectedRoutes = [
    "/dashboard",
    "/tareas",
    "/finanzas",
    "/empleados",
    "/contabilidad",
    "/empresas",
  ];

  const isProtected =
    protectedRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

  if (
    isProtected &&
    !isLogged
  ) {

    return NextResponse.redirect(
      new URL(
        "/login",
        request.url
      )
    );

  }

  return NextResponse.next();

}

export const config = {

  matcher: [
    "/dashboard/:path*",
    "/tareas/:path*",
    "/finanzas/:path*",
    "/empleados/:path*",
    "/contabilidad/:path*",
    "/empresas/:path*",
  ],

};