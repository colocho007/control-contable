import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const ROLES_CREACION = ["admin", "jefe", "supervisor"];
const ROLES_SISTEMA = [
  "admin",
  "jefe",
  "supervisor",
  "contador",
  "tesorero",
  "firmante",
  "firmante_oc",
  "iniciador",
  "iniciador_gestion",
  "empleado",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function normalizarTexto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { error: "Faltan variables publicas de Supabase." });
  }

  if (!serviceRoleKey) {
    return json(500, {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY para validar usuarios de Supabase Auth desde el servidor.",
    });
  }

  const supabaseSesion = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseSesion.auth.getUser();

  if (userError || !user) {
    return json(401, { error: "Sesion no valida." });
  }

  const { data: perfilActual, error: perfilActualError } = await supabaseSesion
    .from("perfiles")
    .select("id,nombre,rol,activo")
    .eq("id", user.id)
    .single();

  if (perfilActualError || !perfilActual || perfilActual.activo === false) {
    return json(403, { error: "Usuario administrativo no autorizado." });
  }

  const rolActual = String(perfilActual.rol || "").trim().toLowerCase();
  if (!ROLES_CREACION.includes(rolActual)) {
    return json(403, { error: "No tienes permiso para crear perfiles." });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Solicitud invalida." });
  }

  const nombre = normalizarTexto(body.nombre);
  const uid = normalizarTexto(body.uid).toLowerCase();
  const correo = normalizarTexto(body.correo).toLowerCase();
  const rol = normalizarTexto(body.rol).toLowerCase();

  if (!nombre) {
    return json(400, { error: "El nombre es obligatorio." });
  }

  if (!UUID_RE.test(uid)) {
    return json(400, { error: "El UID de Supabase Auth debe ser un UUID valido." });
  }

  if (!EMAIL_RE.test(correo)) {
    return json(400, { error: "Ingresa un correo valido." });
  }

  if (!ROLES_SISTEMA.includes(rol)) {
    return json(400, { error: "El rol seleccionado no es valido." });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: usuarioAuth, error: usuarioAuthError } =
    await supabaseAdmin.auth.admin.getUserById(uid);

  if (usuarioAuthError || !usuarioAuth.user) {
    return json(400, {
      error: "El UID no existe en Supabase Authentication.",
    });
  }

  const correoAuth = String(usuarioAuth.user.email || "").trim().toLowerCase();
  if (!correoAuth) {
    return json(400, {
      error: "El usuario de Supabase Auth no tiene correo registrado.",
    });
  }

  if (correoAuth !== correo) {
    return json(400, {
      error: "El correo no coincide con el usuario de Supabase Auth.",
    });
  }

  const { data: perfilPorUid, error: perfilPorUidError } = await supabaseAdmin
    .from("perfiles")
    .select("id,correo,activo")
    .eq("id", uid)
    .maybeSingle();

  if (perfilPorUidError) {
    return json(500, {
      error: "No se pudo validar si el UID ya tiene perfil.",
    });
  }

  if (perfilPorUid) {
    return json(409, {
      error: "Ya existe un perfil para ese UID.",
    });
  }

  const { data: perfilPorCorreo, error: perfilPorCorreoError } =
    await supabaseAdmin
      .from("perfiles")
      .select("id,correo,activo")
      .eq("correo", correo)
      .maybeSingle();

  if (perfilPorCorreoError) {
    return json(500, {
      error:
        "No se pudo validar el correo en public.perfiles. Verifica que exista la columna correo.",
    });
  }

  if (perfilPorCorreo) {
    return json(409, {
      error: "Ya existe un perfil con ese correo.",
    });
  }

  const perfilCreado = {
    id: uid,
    nombre,
    correo,
    rol,
    activo: true,
  };

  const { error: insertError } = await supabaseAdmin
    .from("perfiles")
    .insert(perfilCreado);

  if (insertError) {
    return json(500, {
      error: `No se pudo crear el perfil: ${insertError.message}`,
    });
  }

  const { error: auditoriaError } = await supabaseAdmin
    .from("auditoria_eventos")
    .insert({
      usuario_id: user.id,
      usuario_nombre_snapshot: perfilActual.nombre ?? null,
      modulo: "usuarios",
      accion: "crear_perfil",
      entidad_tipo: "perfil",
      entidad_id: uid,
      estado_nuevo: "activo",
      descripcion: "Perfil de usuario creado",
      sensible: true,
      metadatos: {
        nombre,
        correo,
        rol,
        activo: true,
      },
      origen: "modulo_usuarios",
    });

  if (auditoriaError) {
    return json(201, {
      perfil: perfilCreado,
      advertencia:
        "Perfil creado, pero no se pudo registrar la auditoria administrativa.",
    });
  }

  return json(201, { perfil: perfilCreado });
}
