BEGIN;

-- Refuerzo revisable de integridad empresa-relacion para Impuestos y Conciliacion bancaria.
-- Objetivo: evitar que registros relacionados apunten a filas de otra empresa.
-- No toca RLS, policies, grants, pantallas, RPCs ni datos existentes.
-- No cambia tipos de columnas, no crea triggers y no crea funciones nuevas.
--
-- Verificaciones previas sugeridas:
--
-- Impuestos: resumen con periodo de otra empresa.
-- SELECT r.id, r.empresa_id AS empresa_resumen, p.empresa_id AS empresa_periodo, r.periodo_id
-- FROM public.impuestos_resumen_periodo r
-- JOIN public.impuestos_periodos p ON p.id = r.periodo_id
-- WHERE r.empresa_id <> p.empresa_id;
--
-- Impuestos: calendario con periodo de otra empresa.
-- SELECT c.id, c.empresa_id AS empresa_calendario, p.empresa_id AS empresa_periodo, c.periodo_id
-- FROM public.impuestos_calendario c
-- JOIN public.impuestos_periodos p ON p.id = c.periodo_id
-- WHERE c.periodo_id IS NOT NULL
--   AND c.empresa_id <> p.empresa_id;
--
-- Conciliacion: estados con cuenta de otra empresa.
-- SELECT e.id, e.empresa_id AS empresa_estado, cb.empresa_id AS empresa_cuenta, e.cuenta_bancaria_id
-- FROM public.conciliacion_estados_cuenta e
-- JOIN public.conciliacion_cuentas_bancarias cb ON cb.id = e.cuenta_bancaria_id
-- WHERE e.empresa_id <> cb.empresa_id;
--
-- Conciliacion: movimientos con cuenta o estado de otra empresa.
-- SELECT m.id, m.empresa_id AS empresa_movimiento, cb.empresa_id AS empresa_cuenta, ec.empresa_id AS empresa_estado
-- FROM public.conciliacion_movimientos_banco m
-- JOIN public.conciliacion_cuentas_bancarias cb ON cb.id = m.cuenta_bancaria_id
-- JOIN public.conciliacion_estados_cuenta ec ON ec.id = m.estado_cuenta_id
-- WHERE m.empresa_id <> cb.empresa_id
--    OR m.empresa_id <> ec.empresa_id;
--
-- Conciliacion: vinculos con movimiento de otra empresa.
-- SELECT v.id, v.empresa_id AS empresa_vinculo, m.empresa_id AS empresa_movimiento, v.movimiento_banco_id
-- FROM public.conciliacion_vinculos v
-- JOIN public.conciliacion_movimientos_banco m ON m.id = v.movimiento_banco_id
-- WHERE v.empresa_id <> m.empresa_id;
--
-- Conciliacion: ajustes con cuenta, estado o movimiento de otra empresa.
-- SELECT a.id,
--        a.empresa_id AS empresa_ajuste,
--        cb.empresa_id AS empresa_cuenta,
--        ec.empresa_id AS empresa_estado,
--        m.empresa_id AS empresa_movimiento
-- FROM public.conciliacion_ajustes a
-- JOIN public.conciliacion_cuentas_bancarias cb ON cb.id = a.cuenta_bancaria_id
-- LEFT JOIN public.conciliacion_estados_cuenta ec ON ec.id = a.estado_cuenta_id
-- LEFT JOIN public.conciliacion_movimientos_banco m ON m.id = a.movimiento_banco_id
-- WHERE a.empresa_id <> cb.empresa_id
--    OR (a.estado_cuenta_id IS NOT NULL AND a.empresa_id <> ec.empresa_id)
--    OR (a.movimiento_banco_id IS NOT NULL AND a.empresa_id <> m.empresa_id);
--
-- Si cualquiera de estas consultas devuelve filas, primero deben corregirse
-- manualmente antes de ejecutar las constraints compuestas.

CREATE UNIQUE INDEX IF NOT EXISTS idx_impuestos_periodos_id_empresa
  ON public.impuestos_periodos (id, empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacion_cuentas_id_empresa
  ON public.conciliacion_cuentas_bancarias (id, empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacion_estados_id_empresa
  ON public.conciliacion_estados_cuenta (id, empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacion_movimientos_id_empresa
  ON public.conciliacion_movimientos_banco (id, empresa_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impuestos_resumen_periodo_periodo_empresa_fk'
      AND conrelid = 'public.impuestos_resumen_periodo'::regclass
  ) THEN
    ALTER TABLE public.impuestos_resumen_periodo
      ADD CONSTRAINT impuestos_resumen_periodo_periodo_empresa_fk
      FOREIGN KEY (periodo_id, empresa_id)
      REFERENCES public.impuestos_periodos (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impuestos_calendario_periodo_empresa_fk'
      AND conrelid = 'public.impuestos_calendario'::regclass
  ) THEN
    ALTER TABLE public.impuestos_calendario
      ADD CONSTRAINT impuestos_calendario_periodo_empresa_fk
      FOREIGN KEY (periodo_id, empresa_id)
      REFERENCES public.impuestos_periodos (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_estados_cuenta_empresa_fk'
      AND conrelid = 'public.conciliacion_estados_cuenta'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_estados_cuenta
      ADD CONSTRAINT conciliacion_estados_cuenta_empresa_fk
      FOREIGN KEY (cuenta_bancaria_id, empresa_id)
      REFERENCES public.conciliacion_cuentas_bancarias (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_movimientos_cuenta_empresa_fk'
      AND conrelid = 'public.conciliacion_movimientos_banco'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_movimientos_banco
      ADD CONSTRAINT conciliacion_movimientos_cuenta_empresa_fk
      FOREIGN KEY (cuenta_bancaria_id, empresa_id)
      REFERENCES public.conciliacion_cuentas_bancarias (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_movimientos_estado_empresa_fk'
      AND conrelid = 'public.conciliacion_movimientos_banco'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_movimientos_banco
      ADD CONSTRAINT conciliacion_movimientos_estado_empresa_fk
      FOREIGN KEY (estado_cuenta_id, empresa_id)
      REFERENCES public.conciliacion_estados_cuenta (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_vinculos_movimiento_empresa_fk'
      AND conrelid = 'public.conciliacion_vinculos'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_vinculos
      ADD CONSTRAINT conciliacion_vinculos_movimiento_empresa_fk
      FOREIGN KEY (movimiento_banco_id, empresa_id)
      REFERENCES public.conciliacion_movimientos_banco (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_ajustes_cuenta_empresa_fk'
      AND conrelid = 'public.conciliacion_ajustes'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_ajustes
      ADD CONSTRAINT conciliacion_ajustes_cuenta_empresa_fk
      FOREIGN KEY (cuenta_bancaria_id, empresa_id)
      REFERENCES public.conciliacion_cuentas_bancarias (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_ajustes_estado_empresa_fk'
      AND conrelid = 'public.conciliacion_ajustes'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_ajustes
      ADD CONSTRAINT conciliacion_ajustes_estado_empresa_fk
      FOREIGN KEY (estado_cuenta_id, empresa_id)
      REFERENCES public.conciliacion_estados_cuenta (id, empresa_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conciliacion_ajustes_movimiento_empresa_fk'
      AND conrelid = 'public.conciliacion_ajustes'::regclass
  ) THEN
    ALTER TABLE public.conciliacion_ajustes
      ADD CONSTRAINT conciliacion_ajustes_movimiento_empresa_fk
      FOREIGN KEY (movimiento_banco_id, empresa_id)
      REFERENCES public.conciliacion_movimientos_banco (id, empresa_id);
  END IF;
END
$$;

COMMIT;
