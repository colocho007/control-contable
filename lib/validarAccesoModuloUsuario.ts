import { supabase } from "./supabase";
import { validarModuloActivo } from "./validarModuloActivo";
import { validarUsuarioActivo } from "./validarUsuarioActivo";

export async function validarAccesoModuloUsuario(clave: string) {
  const validacion = await validarUsuarioActivo();

  if (!validacion.ok) {
    return {
      ok: false,
      user: validacion.user,
      perfil: validacion.perfil,
      modulo: null,
      motivo: validacion.motivo,
    };
  }

  const modulo = await validarModuloActivo(clave);

  if (!modulo.ok) {
    return {
      ok: false,
      user: validacion.user,
      perfil: validacion.perfil,
      modulo: modulo.modulo,
      motivo: modulo.motivo,
    };
  }

  const rolNormalizado = (validacion.perfil?.rol || "").trim().toLowerCase();

  // Sidebar permite a admin acceder a cualquier modulo globalmente activo.
  if (rolNormalizado === "admin") {
    return {
      ok: true,
      user: validacion.user,
      perfil: validacion.perfil,
      modulo: modulo.modulo,
      motivo: null,
    };
  }

  const { data: modulosUsuario, error } = await supabase
    .from("usuario_modulos")
    .select("modulo_clave,activo")
    .eq("usuario_id", validacion.user!.id)
    .eq("modulo_clave", clave)
    .eq("activo", true)
    .limit(1);

  if (error) {
    console.error("Error validando acceso al modulo del usuario:", error);

    return {
      ok: false,
      user: validacion.user,
      perfil: validacion.perfil,
      modulo: modulo.modulo,
      motivo: "error_validando_modulo_usuario",
    };
  }

  if (!modulosUsuario?.length) {
    return {
      ok: false,
      user: validacion.user,
      perfil: validacion.perfil,
      modulo: modulo.modulo,
      motivo: "modulo_no_asignado",
    };
  }

  return {
    ok: true,
    user: validacion.user,
    perfil: validacion.perfil,
    modulo: modulo.modulo,
    motivo: null,
  };
}
