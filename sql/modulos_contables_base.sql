BEGIN;

-- Registra o reactiva los modulos contables/administrativos base.
-- Script idempotente: puede ejecutarse mas de una vez sin duplicar claves.
-- No borra datos, no cambia estructura de tablas y no modifica reglas de seguridad.
-- Las asignaciones a usuarios deben hacerse desde Admin Operativo si aplica.

WITH modulos_nuevos (clave, nombre, orden_relativo) AS (
  VALUES
    ('auxiliar', 'Auxiliar', 1),
    ('planilla', 'Planilla / IGSS / IRTRA / INTECAP', 2),
    ('impuestos', 'Impuestos', 3),
    ('conciliacion-bancaria', 'Conciliacion bancaria', 4),
    ('flujo-efectivo', 'Flujo de efectivo y fondos', 5),
    ('proyectos', 'Proyectos / centros de costo', 6),
    ('activos-fijos', 'Activos fijos', 7)
),
orden_base AS (
  SELECT COALESCE(MAX(orden), 0) AS max_orden
  FROM public.modulos_sistema
),
modulos_preparados AS (
  SELECT
    mn.clave,
    mn.nombre,
    ob.max_orden + mn.orden_relativo AS orden_sugerido
  FROM modulos_nuevos mn
  CROSS JOIN orden_base ob
),
modulos_reactivados AS (
  UPDATE public.modulos_sistema ms
  SET
    nombre = mp.nombre,
    activo = true,
    orden = COALESCE(ms.orden, mp.orden_sugerido)
  FROM modulos_preparados mp
  WHERE ms.clave = mp.clave
  RETURNING ms.clave
)
INSERT INTO public.modulos_sistema (clave, nombre, activo, orden)
SELECT
  mp.clave,
  mp.nombre,
  true,
  mp.orden_sugerido
FROM modulos_preparados mp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.modulos_sistema ms
  WHERE ms.clave = mp.clave
);

-- Asignaciones de usuario:
-- Pendiente asignar modulos desde Admin Operativo.
-- Si en una fase posterior se requiere una asignacion masiva, revisar primero
-- el patron vigente de public.usuario_modulos y sus controles de auditoria.

COMMIT;
