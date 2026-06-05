BEGIN;

-- Refuerzo revisable de grants e integridad empresa-relacion para Planilla.
-- No crea tablas, no modifica datos, no toca policies y no cambia pantallas.
-- Las policies FOR DELETE USING (false) existentes se mantienen como doble
-- candado junto con la revocacion explicita de privilegios a authenticated.
--
-- Verificacion previa 1: detalle con periodo de otra empresa.
-- SELECT
--   pd.id,
--   pd.empresa_id AS empresa_detalle,
--   pp.empresa_id AS empresa_periodo,
--   pd.periodo_id
-- FROM public.planilla_detalle pd
-- JOIN public.planillas_periodos pp ON pp.id = pd.periodo_id
-- WHERE pd.empresa_id <> pp.empresa_id;
--
-- Verificacion previa 2: detalle con empleado de otra empresa.
-- SELECT
--   pd.id,
--   pd.empresa_id AS empresa_detalle,
--   ep.empresa_id AS empresa_empleado,
--   pd.empleado_id
-- FROM public.planilla_detalle pd
-- JOIN public.empleados_planilla ep ON ep.id = pd.empleado_id
-- WHERE pd.empresa_id <> ep.empresa_id;
--
-- Si alguna consulta devuelve filas, deben corregirse manualmente antes de
-- ejecutar este script. Las constraints compuestas rechazaran relaciones
-- existentes que no respeten la empresa del detalle.

REVOKE ALL ON TABLE public.empleados_planilla FROM anon, public;
REVOKE ALL ON TABLE public.planillas_periodos FROM anon, public;
REVOKE ALL ON TABLE public.planilla_detalle FROM anon, public;
REVOKE ALL ON TABLE public.planilla_configuracion_tasas FROM anon, public;
REVOKE ALL ON TABLE public.planilla_prestamos_descuentos FROM anon, public;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.empleados_planilla
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.planillas_periodos
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.planilla_detalle
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.planilla_configuracion_tasas
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.planilla_prestamos_descuentos
FROM authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.empleados_planilla
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.planillas_periodos
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.planilla_detalle
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.planilla_configuracion_tasas
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.planilla_prestamos_descuentos
TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planillas_periodos_id_empresa
  ON public.planillas_periodos (id, empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_planilla_id_empresa
  ON public.empleados_planilla (id, empresa_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planilla_detalle_periodo_empresa_fk'
      AND conrelid = 'public.planilla_detalle'::regclass
  ) THEN
    ALTER TABLE public.planilla_detalle
      ADD CONSTRAINT planilla_detalle_periodo_empresa_fk
      FOREIGN KEY (periodo_id, empresa_id)
      REFERENCES public.planillas_periodos (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planilla_detalle_empleado_empresa_fk'
      AND conrelid = 'public.planilla_detalle'::regclass
  ) THEN
    ALTER TABLE public.planilla_detalle
      ADD CONSTRAINT planilla_detalle_empleado_empresa_fk
      FOREIGN KEY (empleado_id, empresa_id)
      REFERENCES public.empleados_planilla (id, empresa_id);
  END IF;
END
$$;

COMMIT;
