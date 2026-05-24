import { supabase } from "./supabase";

export async function validarModuloActivo(clave: string) {
  const { data, error } = await supabase
    .from("modulos_sistema")
    .select("clave,nombre,activo")
    .eq("clave", clave)
    .single();

  if (error || !data) {
    return {
      ok: false,
      modulo: null,
      motivo: "modulo_no_encontrado",
    };
  }

  if (data.activo === false) {
    return {
      ok: false,
      modulo: data,
      motivo: "modulo_inactivo",
    };
  }

  return {
    ok: true,
    modulo: data,
    motivo: null,
  };
}