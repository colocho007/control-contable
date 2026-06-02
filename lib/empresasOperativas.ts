import { supabase } from "./supabase";

export interface EmpresaOperativaBasica {
  id: number;
  nombre: string;
  estado?: string | null;
}

function texto(valor?: string | null) {
  return (valor || "").trim().toLowerCase();
}

export function esEmpresaOperativaVisible(empresa: EmpresaOperativaBasica) {
  const nombre = texto(empresa.nombre);
  const estado = texto(empresa.estado);

  if (["inactiva", "inactivo", "archivada", "archivado"].includes(estado)) {
    return false;
  }

  return !(
    nombre.includes("control plus") ||
    nombre.includes("prueba") ||
    nombre.includes("demo") ||
    nombre.includes("testing")
  );
}

export async function obtenerEmpresasOperativasDesdeIds(idsPermitidos: number[]) {
  const ids = Array.from(
    new Set(
      idsPermitidos
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  if (!ids.length) {
    return {
      ids: [] as number[],
      empresas: [] as EmpresaOperativaBasica[],
      excluidas: [] as EmpresaOperativaBasica[],
    };
  }

  const { data, error } = await supabase
    .from("empresas")
    .select("id,nombre,estado")
    .in("id", ids)
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(
      `No se pudieron validar empresas operativas: ${error.message || "Error de Supabase."}`
    );
  }

  const empresas = ((data || []) as EmpresaOperativaBasica[]).filter((empresa) =>
    esEmpresaOperativaVisible(empresa)
  );
  const excluidas = ((data || []) as EmpresaOperativaBasica[]).filter(
    (empresa) => !esEmpresaOperativaVisible(empresa)
  );

  return {
    ids: empresas.map((empresa) => Number(empresa.id)),
    empresas,
    excluidas,
  };
}
