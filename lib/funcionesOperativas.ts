import { supabase } from "./supabase";

export const FUNCIONES_OPERATIVAS = [
  "firmante_cheque",
  "autorizador_cheque",
  "pagador_cheque",
  "revisor_cheque",
  "creador_orden",
  "firmante_orden",
  "autorizador_compra",
  "auxiliar_contable",
  "contador_revisor",
  "contabilidad_catalogo_admin",
  "contabilidad_configuracion",
  "contabilidad_cierre_periodo",
  "auditor_solo_lectura",
] as const;

export type FuncionOperativa = (typeof FUNCIONES_OPERATIVAS)[number];

export const DESCRIPCIONES_FUNCIONES_OPERATIVAS: Partial<
  Record<FuncionOperativa, string>
> = {
  contabilidad_catalogo_admin: "Administra el catalogo de cuentas contables.",
  contabilidad_configuracion: "Administra configuracion contable y fiscal futura.",
  contabilidad_cierre_periodo:
    "Puede preparar, revisar, cerrar o gestionar cierres de periodos contables.",
};

export interface UsuarioFuncionOperativa {
  id: string | number;
  usuario_id: string;
  empresa_id: number;
  funcion: FuncionOperativa | string;
  activo: boolean | null;
}

export function esFuncionOperativa(valor: string): valor is FuncionOperativa {
  return FUNCIONES_OPERATIVAS.includes(valor as FuncionOperativa);
}

export async function listarFuncionesOperativasUsuario(
  usuarioId: string,
  empresasIds: number[]
): Promise<UsuarioFuncionOperativa[]> {
  const ids = Array.from(
    new Set(empresasIds.map(Number).filter((id) => Number.isFinite(id)))
  );

  if (!usuarioId || !ids.length) return [];

  const { data, error } = await supabase
    .from("usuario_funciones_operativas")
    .select("id,usuario_id,empresa_id,funcion,activo")
    .eq("usuario_id", usuarioId)
    .in("empresa_id", ids)
    .eq("activo", true);

  if (error) {
    console.warn("No se pudieron cargar funciones operativas:", error.message);
    return [];
  }

  return (data || []) as UsuarioFuncionOperativa[];
}

export async function listarFuncionesOperativasEmpresas(
  empresasIds: number[]
): Promise<UsuarioFuncionOperativa[]> {
  const ids = Array.from(
    new Set(empresasIds.map(Number).filter((id) => Number.isFinite(id)))
  );

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("usuario_funciones_operativas")
    .select("id,usuario_id,empresa_id,funcion,activo")
    .in("empresa_id", ids);

  if (error) {
    console.warn("No se pudieron cargar funciones operativas:", error.message);
    return [];
  }

  return (data || []) as UsuarioFuncionOperativa[];
}

export function tieneFuncionOperativaLocal(
  funciones: UsuarioFuncionOperativa[],
  usuarioId: string | null | undefined,
  empresaId: number | string | null | undefined,
  funcionesRequeridas: FuncionOperativa[]
) {
  if (!usuarioId || !empresaId || !funcionesRequeridas.length) return false;
  const empresaNumero = Number(empresaId);
  if (!Number.isFinite(empresaNumero)) return false;

  return funciones.some(
    (item) =>
      item.activo !== false &&
      item.usuario_id === usuarioId &&
      Number(item.empresa_id) === empresaNumero &&
      funcionesRequeridas.includes(item.funcion as FuncionOperativa)
  );
}

export function esAuditorSoloLecturaLocal(
  funciones: UsuarioFuncionOperativa[],
  empresasIds?: Array<number | string | null | undefined>
) {
  const empresasValidas = new Set(
    (empresasIds || [])
      .map((empresaId) => Number(empresaId))
      .filter((empresaId) => Number.isFinite(empresaId))
  );

  return funciones.some(
    (item) =>
      item.activo !== false &&
      item.funcion === "auditor_solo_lectura" &&
      (!empresasValidas.size || empresasValidas.has(Number(item.empresa_id)))
  );
}
