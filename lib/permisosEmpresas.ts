import { supabase } from "./supabase";

export async function obtenerEmpresasPermitidas(
  usuarioId: string,
  rol: string
): Promise<number[]> {
  const rolNormalizado = (rol || "").trim().toLowerCase();

  // Admin ve todas las empresas
  if (rolNormalizado === "admin") {
    const { data, error } = await supabase
      .from("empresas")
      .select("id")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error obteniendo empresas (admin):", error);
      return [];
    }

    return (data || [])
      .map((empresa: any) => Number(empresa.id))
      .filter((id) => Number.isFinite(id));
  }

  // Otros roles: solo asignaciones actualmente activas.
  const { data, error } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("usuario_id", usuarioId)
    .eq("activo", true);

  if (error) {
    console.error("Error obteniendo empresas del usuario:", error);
    return [];
  }

  return (data || [])
    .map((item: any) => Number(item.empresa_id))
    .filter((id) => Number.isFinite(id));
}
