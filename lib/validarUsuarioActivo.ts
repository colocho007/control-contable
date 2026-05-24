import { supabase } from "./supabase";

export async function validarUsuarioActivo() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      user: null,
      perfil: null,
      motivo: "sin_sesion",
    };
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("id,nombre,rol,activo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return {
      ok: false,
      user,
      perfil: null,
      motivo: "sin_perfil",
    };
  }

  if (perfil.activo === false) {
    await supabase.auth.signOut();

    return {
      ok: false,
      user,
      perfil,
      motivo: "usuario_inactivo",
    };
  }

  return {
    ok: true,
    user,
    perfil,
    motivo: null,
  };
}