BEGIN;

-- Coordinacion RLS revisable entre Contabilidad e impuestos_configuracion.
-- No cambia datos, no toca otras tablas de Impuestos y no ejecuta RPCs.
-- Escritura permitida unicamente cuando:
-- * El perfil autenticado esta activo.
-- * El usuario tiene asignacion activa a la empresa.
-- * Tiene contabilidad_configuracion activa para esa empresa.
-- * No tiene auditor_solo_lectura activo para esa empresa.
-- No se conserva fallback por rol para escritura de configuracion fiscal.
--
-- Verificacion previa recomendada:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'impuestos_configuracion'
-- ORDER BY policyname;

DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'impuestos_configuracion'
      AND policyname NOT IN (
        'impuestos_configuracion_select_empresa',
        'impuestos_configuracion_insert_empresa',
        'impuestos_configuracion_update_empresa',
        'impuestos_configuracion_delete_bloqueado'
      )
  LOOP
    RAISE EXCEPTION
      'Policy no versionada encontrada en impuestos_configuracion: %. Revisar pg_policies antes de ejecutar.',
      v_policy.policyname;
  END LOOP;
END;
$$;

ALTER TABLE public.impuestos_configuracion ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.impuestos_configuracion FROM anon, public;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.impuestos_configuracion
FROM authenticated;
GRANT SELECT, INSERT, UPDATE
ON TABLE public.impuestos_configuracion
TO authenticated;

DROP POLICY IF EXISTS "impuestos_configuracion_select_empresa"
ON public.impuestos_configuracion;
DROP POLICY IF EXISTS "impuestos_configuracion_insert_empresa"
ON public.impuestos_configuracion;
DROP POLICY IF EXISTS "impuestos_configuracion_update_empresa"
ON public.impuestos_configuracion;
DROP POLICY IF EXISTS "impuestos_configuracion_delete_bloqueado"
ON public.impuestos_configuracion;

CREATE POLICY "impuestos_configuracion_select_empresa"
ON public.impuestos_configuracion
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.activo = true
      AND EXISTS (
        SELECT 1
        FROM public.usuario_empresas ue
        WHERE ue.usuario_id = auth.uid()
          AND ue.empresa_id = impuestos_configuracion.empresa_id
          AND ue.activo = true
      )
  )
);

CREATE POLICY "impuestos_configuracion_insert_empresa"
ON public.impuestos_configuracion
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.activo = true
      AND EXISTS (
        SELECT 1
        FROM public.usuario_empresas ue
        WHERE ue.usuario_id = auth.uid()
          AND ue.empresa_id = impuestos_configuracion.empresa_id
          AND ue.activo = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'contabilidad_configuracion'
          AND ufo.activo = true
      )
  )
);

CREATE POLICY "impuestos_configuracion_update_empresa"
ON public.impuestos_configuracion
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.activo = true
      AND EXISTS (
        SELECT 1
        FROM public.usuario_empresas ue
        WHERE ue.usuario_id = auth.uid()
          AND ue.empresa_id = impuestos_configuracion.empresa_id
          AND ue.activo = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'contabilidad_configuracion'
          AND ufo.activo = true
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.activo = true
      AND EXISTS (
        SELECT 1
        FROM public.usuario_empresas ue
        WHERE ue.usuario_id = auth.uid()
          AND ue.empresa_id = impuestos_configuracion.empresa_id
          AND ue.activo = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'contabilidad_configuracion'
          AND ufo.activo = true
      )
  )
);

CREATE POLICY "impuestos_configuracion_delete_bloqueado"
ON public.impuestos_configuracion
FOR DELETE
TO authenticated
USING (false);

-- Verificacion posterior:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'impuestos_configuracion'
-- ORDER BY policyname;

COMMIT;
