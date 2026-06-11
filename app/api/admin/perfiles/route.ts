import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const ROLES_CREACION = ["admin", "jefe", "supervisor"];
const ROLES_ASIGNABLES = ["jefe", "supervisor", "contador", "auxiliar", "auditor"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_VENTANA_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_IP = 20;
const RATE_LIMIT_MAX_USUARIO = 8;
const RATE_LIMIT_PERSISTENTE_VENTANA_SEGUNDOS = 5 * 60;
const RATE_LIMIT_PERSISTENTE_MAX_USUARIO = 8;
const IDEMPOTENCY_PREFIX_ADMIN = "controlplus_idempotency_admin";

type RegistroRateLimit = { conteo: number; reiniciaEn: number };

const rateLimitMemoria = globalThis as typeof globalThis & {
  __controlPlusRateLimitPerfiles?: Map<string, RegistroRateLimit>;
};

const rateLimitPerfiles =
  rateLimitMemoria.__controlPlusRateLimitPerfiles ||
  new Map<string, RegistroRateLimit>();

rateLimitMemoria.__controlPlusRateLimitPerfiles = rateLimitPerfiles;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function normalizarTexto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizarIdempotencyKey(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function obtenerIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "ip-desconocida"
  );
}

function hashIp(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

function consumirRateLimit(clave: string, maximo: number) {
  const ahora = Date.now();
  const registro = rateLimitPerfiles.get(clave);

  if (!registro || registro.reiniciaEn <= ahora) {
    rateLimitPerfiles.set(clave, {
      conteo: 1,
      reiniciaEn: ahora + RATE_LIMIT_VENTANA_MS,
    });
    return { permitido: true, restante: maximo - 1, reiniciaEn: ahora + RATE_LIMIT_VENTANA_MS };
  }

  if (registro.conteo >= maximo) {
    return { permitido: false, restante: 0, reiniciaEn: registro.reiniciaEn };
  }

  registro.conteo += 1;
  rateLimitPerfiles.set(clave, registro);
  return { permitido: true, restante: maximo - registro.conteo, reiniciaEn: registro.reiniciaEn };
}

function respuestaRateLimit(reiniciaEn: number) {
  const segundos = Math.max(1, Math.ceil((reiniciaEn - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Demasiados intentos. Espera antes de reintentar." },
    {
      status: 429,
      headers: {
        "Retry-After": String(segundos),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const ip = obtenerIp(request);
  const limiteIp = consumirRateLimit(`ip:${ip}`, RATE_LIMIT_MAX_IP);

  if (!limiteIp.permitido) {
    return respuestaRateLimit(limiteIp.reiniciaEn);
  }

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

  const limiteUsuario = consumirRateLimit(
    `usuario:${user.id}:ip:${ip}`,
    RATE_LIMIT_MAX_USUARIO
  );

  if (!limiteUsuario.permitido) {
    return respuestaRateLimit(limiteUsuario.reiniciaEn);
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

  const ipHash = hashIp(ip);
  const { data: rateLimitPersistente, error: rateLimitPersistenteError } =
    await supabaseSesion.rpc("registrar_rate_limit_operativo", {
      p_clave: `admin-perfiles:usuario:${user.id}:ip:${ipHash}`,
      p_alcance: "usuario",
      p_modulo: "admin-operativo",
      p_accion: "crear_usuario_operativo",
      p_limite: RATE_LIMIT_PERSISTENTE_MAX_USUARIO,
      p_ventana_segundos: RATE_LIMIT_PERSISTENTE_VENTANA_SEGUNDOS,
      p_empresa_id: null,
      p_ip_hash: ipHash,
      p_metadatos: {
        ruta: "/api/admin/perfiles",
        metodo: "POST",
        ip_real_guardada: false,
      },
    });

  if (rateLimitPersistenteError) {
    console.warn(
      "Rate limit persistente no disponible; se mantiene rate limit local:",
      rateLimitPersistenteError.message
    );
  }

  if (
    !rateLimitPersistenteError &&
    rateLimitPersistente &&
    typeof rateLimitPersistente === "object" &&
    "permitido" in rateLimitPersistente &&
    rateLimitPersistente.permitido === false
  ) {
    const retryAfter =
      "retry_after_segundos" in rateLimitPersistente &&
      typeof rateLimitPersistente.retry_after_segundos === "number"
        ? Math.max(1, Math.ceil(rateLimitPersistente.retry_after_segundos))
        : RATE_LIMIT_PERSISTENTE_VENTANA_SEGUNDOS;

    return NextResponse.json(
      { error: "Demasiados intentos. Espera antes de reintentar." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

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
  const idempotencyKey = normalizarIdempotencyKey(body.idempotency_key);

  if (!nombre) {
    return json(400, { error: "El nombre es obligatorio." });
  }

  if (!UUID_RE.test(uid)) {
    return json(400, { error: "El UID de Supabase Auth debe ser un UUID valido." });
  }

  if (!EMAIL_RE.test(correo)) {
    return json(400, { error: "Ingresa un correo valido." });
  }

  if (!ROLES_ASIGNABLES.includes(rol)) {
    return json(400, {
      error: "El rol seleccionado no puede asignarse desde la administracion operativa.",
    });
  }

  if (
    !idempotencyKey ||
    !idempotencyKey.startsWith(`${IDEMPOTENCY_PREFIX_ADMIN}:crear_usuario_operativo:`)
  ) {
    return json(400, {
      error: "Falta llave de idempotencia valida para crear el perfil.",
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let idempotencyId: string | null = null;

  async function marcarIdempotenciaFallida(error: unknown) {
    if (!idempotencyId) return;

    await supabaseAdmin
      .from("idempotency_keys_operativas")
      .update({
        estado: "fallida",
        error_resumen:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Error no identificado",
      })
      .eq("id", idempotencyId);
  }

  async function registrarIntentoBloqueado(motivo: string, mensaje: string) {
    await supabaseAdmin.from("intentos_bloqueados").insert({
      usuario_id: user.id,
      empresa_id: null,
      modulo: "admin-operativo",
      accion: "crear_usuario_operativo",
      motivo,
      severidad: "alta",
      entidad_tipo: "perfil",
      entidad_id: uid,
      mensaje,
      metadatos: {
        correo,
        rol,
        idempotency_key: idempotencyKey,
        datos_sensibles_completos_guardados: false,
      },
    });
  }

  const { data: idempotencyExistente, error: idempotencyConsultaError } =
    await supabaseAdmin
      .from("idempotency_keys_operativas")
      .select("id,estado,usuario_id,modulo,accion,resultado_resumen")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

  if (idempotencyConsultaError) {
    return json(500, { error: "No se pudo validar la idempotencia." });
  }

  if (idempotencyExistente) {
    if (
      idempotencyExistente.usuario_id !== user.id ||
      idempotencyExistente.modulo !== "admin-operativo" ||
      idempotencyExistente.accion !== "crear_usuario_operativo"
    ) {
      await registrarIntentoBloqueado(
        "idempotencia_invalida",
        "Llave de idempotencia usada en otro contexto."
      );
      return json(409, { error: "La llave de idempotencia pertenece a otra operacion." });
    }

    if (idempotencyExistente.estado === "completada") {
      return json(200, {
        ...(typeof idempotencyExistente.resultado_resumen === "object" &&
        idempotencyExistente.resultado_resumen
          ? idempotencyExistente.resultado_resumen
          : {}),
        idempotency_replay: true,
      });
    }

    if (idempotencyExistente.estado === "en_proceso") {
      await registrarIntentoBloqueado(
        "idempotencia_en_proceso",
        "Creacion de perfil ya en proceso."
      );
      return json(409, {
        error: "La creacion de este perfil ya esta en proceso.",
      });
    }

    return json(409, {
      error: "Esta llave de idempotencia ya fue usada. Genera una nueva operacion.",
    });
  }

  const { data: idempotencyCreada, error: idempotencyInsertError } =
    await supabaseAdmin
      .from("idempotency_keys_operativas")
      .insert({
        expira_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: idempotencyKey,
        usuario_id: user.id,
        empresa_id: null,
        modulo: "admin-operativo",
        accion: "crear_usuario_operativo",
        estado: "en_proceso",
        request_hash: [uid, correo, rol].join("|"),
        entidad_tipo: "perfil",
        entidad_id: uid,
      })
      .select("id")
      .single();

  if (idempotencyInsertError) {
    return json(500, { error: "No se pudo reservar la operacion administrativa." });
  }

  idempotencyId = String(idempotencyCreada.id);

  const { data: usuarioAuth, error: usuarioAuthError } =
    await supabaseAdmin.auth.admin.getUserById(uid);

  if (usuarioAuthError || !usuarioAuth.user) {
    await marcarIdempotenciaFallida(new Error("El UID no existe en Supabase Authentication."));
    await registrarIntentoBloqueado(
      "uid_auth_no_existe",
      "El UID no existe en Supabase Authentication."
    );
    return json(400, {
      error: "El UID no existe en Supabase Authentication.",
    });
  }

  const correoAuth = String(usuarioAuth.user.email || "").trim().toLowerCase();
  if (!correoAuth) {
    await marcarIdempotenciaFallida(new Error("Usuario Auth sin correo registrado."));
    return json(400, {
      error: "El usuario de Supabase Auth no tiene correo registrado.",
    });
  }

  if (correoAuth !== correo) {
    await marcarIdempotenciaFallida(new Error("El correo no coincide con Supabase Auth."));
    await registrarIntentoBloqueado(
      "correo_no_coincide_auth",
      "El correo no coincide con el usuario de Supabase Auth."
    );
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
    await marcarIdempotenciaFallida(perfilPorUidError);
    return json(500, {
      error: "No se pudo validar si el UID ya tiene perfil.",
    });
  }

  if (perfilPorUid) {
    await marcarIdempotenciaFallida(new Error("Ya existe un perfil para ese UID."));
    await registrarIntentoBloqueado(
      "perfil_uid_duplicado",
      "Ya existe un perfil para ese UID."
    );
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
    await marcarIdempotenciaFallida(perfilPorCorreoError);
    return json(500, {
      error:
        "No se pudo validar el correo en public.perfiles. Verifica que exista la columna correo.",
    });
  }

  if (perfilPorCorreo) {
    await marcarIdempotenciaFallida(new Error("Ya existe un perfil con ese correo."));
    await registrarIntentoBloqueado(
      "perfil_correo_duplicado",
      "Ya existe un perfil con ese correo."
    );
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
    await marcarIdempotenciaFallida(insertError);
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
    await supabaseAdmin
      .from("idempotency_keys_operativas")
      .update({
        estado: "completada",
        entidad_tipo: "perfil",
        entidad_id: uid,
        resultado_resumen: {
          perfil: perfilCreado,
          advertencia:
            "Perfil creado, pero no se pudo registrar la auditoria administrativa.",
        },
        error_resumen: null,
      })
      .eq("id", idempotencyId);

    return json(201, {
      perfil: perfilCreado,
      advertencia:
        "Perfil creado, pero no se pudo registrar la auditoria administrativa.",
    });
  }

  await supabaseAdmin
    .from("idempotency_keys_operativas")
    .update({
      estado: "completada",
      entidad_tipo: "perfil",
      entidad_id: uid,
      resultado_resumen: { perfil: perfilCreado },
      error_resumen: null,
    })
    .eq("id", idempotencyId);

  return json(201, { perfil: perfilCreado });
}
