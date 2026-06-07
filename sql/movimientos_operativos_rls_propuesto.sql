BEGIN;

-- Propuesta revisable para public.movimientos. No ejecutar automaticamente.
-- Protege movimientos operativos sin cambiar contabilidad formal ni RPCs de asientos.
--
-- Compatibilidad prevista:
-- * SELECT: cualquier perfil activo con asignacion activa a la empresa.
-- * INSERT: perfil activo asignado, excepto auditor_solo_lectura.
-- * UPDATE: exclusivamente anulacion logica autorizada.
-- * DELETE: bloqueado.
-- * pagar_cheque_transaccional es SECURITY DEFINER y conserva su flujo validado.
--
-- Antes de ejecutar, revisar policies, triggers y defaults de estado/creado_por:
-- SELECT * FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'movimientos'
-- ORDER BY policyname;
--
-- SELECT trigger_name, action_timing, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public' AND event_object_table = 'movimientos'
-- ORDER BY trigger_name;

DO $$
DECLARE
  v_policy record;
  v_columna text;
  v_trigger record;
BEGIN
  IF to_regclass('public.movimientos') IS NULL THEN
    RAISE EXCEPTION 'No existe public.movimientos. Revisar el esquema antes de ejecutar.';
  END IF;

  FOREACH v_columna IN ARRAY ARRAY[
    'empresa_id', 'estado', 'creado_por', 'anulado_por', 'anulado_at',
    'motivo_anulacion', 'moneda', 'referencia', 'tipo_cambio', 'monto_gtq'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'movimientos'
        AND column_name = v_columna
    ) THEN
      RAISE EXCEPTION 'Falta la columna public.movimientos.%. Revisar esquema.', v_columna;
    END IF;
  END LOOP;

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

  FOR v_trigger IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'movimientos'
      AND action_timing = 'BEFORE'
      AND event_manipulation = 'UPDATE'
      AND trigger_name <> 'validar_anulacion_movimiento_operativo'
  LOOP
    RAISE EXCEPTION
      'Trigger BEFORE UPDATE no versionado encontrado en movimientos: %. Revisar antes de ejecutar.',
      v_trigger.trigger_name;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.movimientos_empresa_asignada(
  p_empresa_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    JOIN public.usuario_empresas ue
      ON ue.usuario_id = p.id
     AND ue.empresa_id = p_empresa_id
     AND ue.activo = true
    WHERE p.id = auth.uid()
      AND p.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.movimientos_puede_escribir(
  p_empresa_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.movimientos_empresa_asignada(p_empresa_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.usuario_funciones_operativas ufo
      WHERE ufo.usuario_id = auth.uid()
        AND ufo.empresa_id = p_empresa_id
        AND ufo.funcion = 'auditor_solo_lectura'
        AND ufo.activo = true
    );
$$;

CREATE OR REPLACE FUNCTION public.movimientos_puede_anular(
  p_empresa_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.movimientos_puede_escribir(p_empresa_id)
    AND EXISTS (
      SELECT 1
      FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.activo = true
        AND (
          lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe', 'contador')
          OR EXISTS (
            SELECT 1
            FROM public.usuario_funciones_operativas ufo
            WHERE ufo.usuario_id = auth.uid()
              AND ufo.empresa_id = p_empresa_id
              AND ufo.funcion = 'contador_revisor'
              AND ufo.activo = true
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.movimientos_empresa_asignada(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.movimientos_puede_escribir(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.movimientos_puede_anular(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.movimientos_empresa_asignada(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.movimientos_puede_escribir(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.movimientos_puede_anular(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_anulacion_movimiento_operativo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM 'activo'
    OR NEW.estado IS DISTINCT FROM 'anulado'
    OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.anulado_por IS DISTINCT FROM auth.uid()
    OR NEW.anulado_at IS NULL
    OR length(trim(coalesce(NEW.motivo_anulacion, ''))) < 5
    OR NOT public.movimientos_puede_anular(OLD.empresa_id)
  THEN
    RAISE EXCEPTION 'La actualizacion solicitada no es una anulacion operativa permitida.';
  END IF;

  IF (to_jsonb(NEW) - ARRAY['estado', 'anulado_por', 'anulado_at', 'motivo_anulacion']::text[])
    IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['estado', 'anulado_por', 'anulado_at', 'motivo_anulacion']::text[])
  THEN
    RAISE EXCEPTION 'La anulacion no puede modificar otros datos del movimiento.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_anulacion_movimiento_operativo() FROM PUBLIC, anon, authenticated;

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
FOR SELECT
TO authenticated
USING (public.movimientos_empresa_asignada(empresa_id));

CREATE POLICY "movimientos_insert_empresa"
ON public.movimientos
FOR INSERT
TO authenticated
WITH CHECK (
  estado = 'activo'
  AND creado_por = auth.uid()
  AND anulado_por IS NULL
  AND anulado_at IS NULL
  AND motivo_anulacion IS NULL
  AND public.movimientos_puede_escribir(empresa_id)
);

CREATE POLICY "movimientos_update_anulacion"
ON public.movimientos
FOR UPDATE
TO authenticated
USING (
  estado = 'activo'
  AND public.movimientos_puede_anular(empresa_id)
)
WITH CHECK (
  estado = 'anulado'
  AND anulado_por = auth.uid()
  AND anulado_at IS NOT NULL
  AND length(trim(coalesce(motivo_anulacion, ''))) >= 5
  AND public.movimientos_puede_anular(empresa_id)
);

CREATE POLICY "movimientos_delete_bloqueado"
ON public.movimientos
FOR DELETE
TO authenticated
USING (false);

DROP TRIGGER IF EXISTS validar_anulacion_movimiento_operativo
ON public.movimientos;

CREATE TRIGGER validar_anulacion_movimiento_operativo
BEFORE UPDATE ON public.movimientos
FOR EACH ROW
EXECUTE FUNCTION public.validar_anulacion_movimiento_operativo();

-- Verificacion posterior:
-- SELECT * FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'movimientos'
-- ORDER BY policyname;

COMMIT;
