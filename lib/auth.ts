import { supabase } from "./supabase";

/**
 * Interface para la respuesta de verificación
 * Proporciona claridad al frontend sobre qué falló exactamente
 */
interface RespuestaRol {
  autorizado: boolean;
  rol?: string;
  error?: string;
}

/**
 * Función Maestra de Verificación de Roles
 * Verifica sesión, consulta el perfil y valida permisos en una sola llamada.
 */
export async function verificarRol(
  rolesPermitidos: string[]
): Promise<RespuestaRol> {
  try {
    // 1. Obtener el usuario de la sesión actual (Capa de Autenticación)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { 
        autorizado: false, 
        error: "Sesión no válida o expirada" 
      };
    }

    // 2. Consultar el perfil en la base de datos (Capa de Base de Datos)
    // Usamos .single() porque cada ID de usuario es único
    const { data: perfil, error: dbError } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (dbError || !perfil) {
      console.error("Error al obtener perfil:", dbError);
      return { 
        autorizado: false, 
        error: "No se encontró un perfil asociado a este usuario" 
      };
    }

    // 3. Validar si el rol del usuario está dentro de los permitidos (Capa de Autorización)
    const tienePermiso = rolesPermitidos.includes(perfil.rol);

    if (!tienePermiso) {
      return {
        autorizado: false,
        rol: perfil.rol,
        error: `Acceso denegado. Se requiere: ${rolesPermitidos.join(", ")}`
      };
    }

    // Si todo sale bien, retornamos éxito y el rol por si se necesita en la UI
    return {
      autorizado: true,
      rol: perfil.rol
    };

  } catch (err) {
    // Captura errores críticos de red o fallos inesperados
    console.error("Fallo crítico en verificarRol:", err);
    return { 
      autorizado: false, 
      error: "Error inesperado de conexión con el servidor" 
    };
  }
}