# Evidencia de remediación search_path RPC V1

- Proyecto: control-contable
- Fecha de ejecución remota: 2026-07-14
- Rama: fix/supabase-remediacion-search-path-v1
- Producción: NO-GO
- Cambios remotos: aplicados y verificados

## Resultado

- 41 funciones encontradas.
- 41 funciones actualizadas.
- search_path aplicado: pg_catalog, public, pg_temp.
- 41 de 41 funciones verificadas correctamente.
- No se modificaron cuerpos, firmas, propietarios, datos ni permisos EXECUTE.

## Seguridad del esquema public

PUBLIC, anon, authenticated y service_role tienen USAGE.
Ninguno de esos roles tiene permiso CREATE en public.

## Archivos

- sql/preflight_search_path_rpc_v1.sql
- sql/propuesta_remediacion_search_path_rpc_v1.sql

## Pendientes antes de GO

- Pruebas funcionales de RPC.
- Pruebas de permisos y llamadas revocadas.
- Pruebas multiempresa.
- Verificación de triggers.
- Checklist final y plan de rollback.

Producción permanece NO-GO hasta completar las pruebas.