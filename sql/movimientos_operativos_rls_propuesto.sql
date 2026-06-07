BEGIN;

-- Propuesta revisable por fases para public.movimientos.
-- No ejecutar hasta confirmar pg_policies y que las columnas listadas existen.
-- Conserva el flujo operativo actual, pero bloquea auditor_solo_lectura.

DO $$
DECLARE
  v_policy record;
BEGIN
  IF to_regclass('public.movimientos') IS NULL THEN
    RAISE EXCEPTION 'No existe public.movimientos. Revisar el esquema antes de ejecutar.';
  END IF;

  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'movimientos'
      AND policyname NOT IN (
        'movimientos_select_empresa',
        'movimientos_insert_empresa',
        'movimientos_update_anulacion',
        'movimientos_delete_bloqueado'
      )
  LOOP
    RAISE EXCEPTION
      'Policy no versionada encontrada en movimientos: %. Revisar pg_policies antes de ejecutar.',
      v_policy.policyname;
  END LOOP;
END;
$$;

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.movimientos FROM anon, public;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.movimientos FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.movimientos TO authenticated;

DROP POLICY IF EXISTS "movimientos_select_empresa" ON public.movimientos;
DROP POLICY IF EXISTS "movimientos_insert_empresa" ON public.movimientos;
DROP POLICY IF EXISTS "movimientos_update_anulacion" ON public.movimientos;
DROP POLICY IF EXISTS "movimientos_delete_bloqueado" ON public.movimientos;

CREATE POLICY "movimientos_select_empresa"
ON public.movimientos
FOR SELECT TO authenticated
USING (public.contabilidad_empresa_permitida(empresa_id));

CREATE POLICY "movimientos_insert_empresa"
ON public.movimientos
FOR INSERT TO authenticated
WITH CHECK (
  estado = 'activo'
  AND creado_por = auth.uid()
  AND public.contabilidad_empresa_permitida(empresa_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.usuario_funciones_operativas ufo
    WHERE ufo.usuario_id = auth.uid()
      AND ufo.empresa_id = movimientos.empresa_id
      AND ufo.funcion = 'auditor_solo_lectura'
      AND ufo.activo = true
  )
);

CREATE POLICY "movimientos_update_anulacion"
ON public.movimientos
FOR UPDATE TO authenticated
USING (
  estado = 'activo'
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY[]::text[],
    ARRAY['admin', 'jefe', 'supervisor']
  )
)
WITH CHECK (
  estado = 'anulado'
  AND anulado_por = auth.uid()
  AND anulado_at IS NOT NULL
  AND length(trim(coalesce(motivo_anulacion, ''))) >= 5
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY[]::text[],
    ARRAY['admin', 'jefe', 'supervisor']
  )
);

CREATE POLICY "movimientos_delete_bloqueado"
ON public.movimientos
FOR DELETE TO authenticated
USING (false);

COMMIT;
