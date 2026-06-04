BEGIN;

-- Refuerzo revisable de integridad para Planilla.
-- Objetivo: evitar que un prestamo/descuento apunte a un empleado de otra empresa.
-- No toca RLS, policies, grants, pantallas, RPCs ni datos existentes.
-- No borra datos y no cambia columnas.
--
-- Verificacion previa sugerida:
-- SELECT
--   ppd.id,
--   ppd.empresa_id AS empresa_descuento,
--   ep.empresa_id AS empresa_empleado,
--   ppd.empleado_id
-- FROM public.planilla_prestamos_descuentos ppd
-- JOIN public.empleados_planilla ep ON ep.id = ppd.empleado_id
-- WHERE ppd.empresa_id <> ep.empresa_id;
--
-- Si la consulta anterior devuelve filas, primero deben corregirse manualmente
-- antes de ejecutar este script, porque la FK compuesta validara la coherencia
-- entre empleado_id y empresa_id.

CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_planilla_id_empresa
  ON public.empleados_planilla (id, empresa_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planilla_prestamos_descuentos_empleado_empresa_fk'
      AND conrelid = 'public.planilla_prestamos_descuentos'::regclass
  ) THEN
    ALTER TABLE public.planilla_prestamos_descuentos
      ADD CONSTRAINT planilla_prestamos_descuentos_empleado_empresa_fk
      FOREIGN KEY (empleado_id, empresa_id)
      REFERENCES public.empleados_planilla (id, empresa_id);
  END IF;
END
$$;

COMMIT;
