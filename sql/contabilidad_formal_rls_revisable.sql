BEGIN;

-- RLS formal revisable para Contabilidad.
-- No crea ni modifica datos contables, no ejecuta RPCs y no cambia calculos.
-- Las transiciones finales usan RPCs SECURITY DEFINER revisables:
-- registrar_asiento_completo, finalizar_asiento_contable, anular_asiento_contable,
-- cerrar_periodo_contable y contabilizar_documento_contable.
--
-- Modelo transitorio:
-- * SELECT por empresa permitida; catalogo global visible a perfiles activos.
-- * auditor_solo_lectura solo consulta.
-- * auxiliar_contable prepara borradores, documentos y distribuciones.
-- * contador_revisor revisa borradores; finalizar, anular y contabilizar usan RPCs.
-- * Las escrituras formales exigen funciones operativas por empresa, sin fallback por rol.
-- * Se usan las funciones operativas:
--   contabilidad_catalogo_admin, contabilidad_configuracion y
--   contabilidad_cierre_periodo.
-- * DELETE fisico queda bloqueado.
--
-- impuestos_configuracion no se modifica aqui: ya esta cubierta por
-- sql/impuestos_rls_base.sql. Su futura separacion por
-- contabilidad_configuracion debe hacerse en una rama coordinada con Impuestos.
--
-- Verificacion previa recomendada en Supabase:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'catalogo_cuentas',
--     'periodos_contables',
--     'asientos_contables',
--     'movimientos_contables_detalle',
--     'documentos_contables_revision',
--     'distribuciones_documentos_contables'
--   )
-- ORDER BY tablename, policyname;
--
-- El bloque siguiente aborta antes de cambiar policies si encuentra una policy
-- contable no versionada por este archivo. Revisarla y agregar un DROP POLICY
-- explicito solo despues de confirmar que puede reemplazarse.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'catalogo_cuentas',
        'periodos_contables',
        'asientos_contables',
        'movimientos_contables_detalle',
        'documentos_contables_revision',
        'distribuciones_documentos_contables'
      )
      AND policyname NOT IN (
        'contabilidad_catalogo_select',
        'contabilidad_catalogo_insert',
        'contabilidad_catalogo_update',
        'contabilidad_catalogo_delete_bloqueado',
        'contabilidad_periodos_select',
        'contabilidad_periodos_insert',
        'contabilidad_periodos_update_auxiliar',
        'contabilidad_periodos_update_cierre',
        'contabilidad_periodos_update_final_bloqueado',
        'contabilidad_periodos_delete_bloqueado',
        'contabilidad_asientos_select',
        'contabilidad_asientos_insert_borrador',
        'contabilidad_asientos_update_borrador',
        'contabilidad_asientos_update_revision',
        'contabilidad_asientos_delete_bloqueado',
        'contabilidad_detalle_select',
        'contabilidad_detalle_insert_borrador',
        'contabilidad_detalle_update_borrador',
        'contabilidad_detalle_update_revision',
        'contabilidad_detalle_delete_bloqueado',
        'contabilidad_documentos_select',
        'contabilidad_documentos_insert',
        'contabilidad_documentos_update_auxiliar',
        'contabilidad_documentos_update_revision',
        'contabilidad_documentos_delete_bloqueado',
        'contabilidad_distribuciones_select',
        'contabilidad_distribuciones_insert',
        'contabilidad_distribuciones_update',
        'contabilidad_distribuciones_delete_bloqueado'
      )
  LOOP
    RAISE EXCEPTION
      'Policy no versionada encontrada: %.%. Revisar pg_policies antes de ejecutar.',
      v_policy.tablename,
      v_policy.policyname;
  END LOOP;
END;
$$;

-- Helpers booleanos para evitar duplicar reglas sensibles en cada policy.
-- Solo exponen respuestas booleanas y no datos de perfiles o asignaciones.
CREATE OR REPLACE FUNCTION public.contabilidad_empresa_permitida(
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
    WHERE p.id = auth.uid()
      AND p.activo = true
      AND (
        lower(coalesce(p.rol, '')) = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.usuario_empresas ue
          WHERE ue.usuario_id = auth.uid()
            AND ue.empresa_id = p_empresa_id
            AND ue.activo = true
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.contabilidad_autorizado(
  p_empresa_id bigint,
  p_funciones text[],
  p_roles_fallback text[]
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
    WHERE p.id = auth.uid()
      AND p.activo = true
      AND public.contabilidad_empresa_permitida(p_empresa_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = p_empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) = ANY (p_roles_fallback)
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = p_empresa_id
            AND ufo.funcion = ANY (p_funciones)
            AND ufo.activo = true
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.contabilidad_empresa_permitida(bigint)
FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.contabilidad_autorizado(bigint, text[], text[])
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.contabilidad_empresa_permitida(bigint)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.contabilidad_autorizado(bigint, text[], text[])
TO authenticated;

ALTER TABLE public.catalogo_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asientos_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_contables_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_contables_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuciones_documentos_contables ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.catalogo_cuentas FROM anon, public;
REVOKE ALL ON TABLE public.periodos_contables FROM anon, public;
REVOKE ALL ON TABLE public.asientos_contables FROM anon, public;
REVOKE ALL ON TABLE public.movimientos_contables_detalle FROM anon, public;
REVOKE ALL ON TABLE public.documentos_contables_revision FROM anon, public;
REVOKE ALL ON TABLE public.distribuciones_documentos_contables FROM anon, public;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.catalogo_cuentas
FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.periodos_contables
FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.asientos_contables
FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.movimientos_contables_detalle
FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.documentos_contables_revision
FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.distribuciones_documentos_contables
FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.catalogo_cuentas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.periodos_contables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.asientos_contables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.movimientos_contables_detalle TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.documentos_contables_revision TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.distribuciones_documentos_contables TO authenticated;

DROP POLICY IF EXISTS "contabilidad_catalogo_select" ON public.catalogo_cuentas;
DROP POLICY IF EXISTS "contabilidad_catalogo_insert" ON public.catalogo_cuentas;
DROP POLICY IF EXISTS "contabilidad_catalogo_update" ON public.catalogo_cuentas;
DROP POLICY IF EXISTS "contabilidad_catalogo_delete_bloqueado" ON public.catalogo_cuentas;

CREATE POLICY "contabilidad_catalogo_select"
ON public.catalogo_cuentas
FOR SELECT
TO authenticated
USING (
  (
    empresa_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.activo = true
    )
  )
  OR public.contabilidad_empresa_permitida(empresa_id)
);

CREATE POLICY "contabilidad_catalogo_insert"
ON public.catalogo_cuentas
FOR INSERT
TO authenticated
WITH CHECK (
  (
    empresa_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.activo = true
        AND lower(coalesce(p.rol, '')) IN ('admin', 'jefe')
        AND NOT EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.funcion = 'auditor_solo_lectura'
            AND ufo.activo = true
        )
    )
  )
  OR public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contabilidad_catalogo_admin'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_catalogo_update"
ON public.catalogo_cuentas
FOR UPDATE
TO authenticated
USING (
  (
    empresa_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.activo = true
        AND lower(coalesce(p.rol, '')) IN ('admin', 'jefe')
        AND NOT EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.funcion = 'auditor_solo_lectura'
            AND ufo.activo = true
        )
    )
  )
  OR public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contabilidad_catalogo_admin'],
    ARRAY[]::text[]
  )
)
WITH CHECK (
  (
    empresa_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.activo = true
        AND lower(coalesce(p.rol, '')) IN ('admin', 'jefe')
        AND NOT EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.funcion = 'auditor_solo_lectura'
            AND ufo.activo = true
        )
    )
  )
  OR public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contabilidad_catalogo_admin'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_catalogo_delete_bloqueado"
ON public.catalogo_cuentas
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "contabilidad_periodos_select" ON public.periodos_contables;
DROP POLICY IF EXISTS "contabilidad_periodos_insert" ON public.periodos_contables;
DROP POLICY IF EXISTS "contabilidad_periodos_update_auxiliar" ON public.periodos_contables;
DROP POLICY IF EXISTS "contabilidad_periodos_update_cierre" ON public.periodos_contables;
DROP POLICY IF EXISTS "contabilidad_periodos_update_final_bloqueado" ON public.periodos_contables;
DROP POLICY IF EXISTS "contabilidad_periodos_delete_bloqueado" ON public.periodos_contables;

CREATE POLICY "contabilidad_periodos_select"
ON public.periodos_contables
FOR SELECT
TO authenticated
USING (public.contabilidad_empresa_permitida(empresa_id));

CREATE POLICY "contabilidad_periodos_insert"
ON public.periodos_contables
FOR INSERT
TO authenticated
WITH CHECK (
  estado = 'abierto'
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable', 'contador_revisor', 'contabilidad_cierre_periodo'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_periodos_update_auxiliar"
ON public.periodos_contables
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- El cierre final solo puede ejecutarse mediante cerrar_periodo_contable.
CREATE POLICY "contabilidad_periodos_update_final_bloqueado"
ON public.periodos_contables
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "contabilidad_periodos_delete_bloqueado"
ON public.periodos_contables
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "contabilidad_asientos_select" ON public.asientos_contables;
DROP POLICY IF EXISTS "contabilidad_asientos_insert_borrador" ON public.asientos_contables;
DROP POLICY IF EXISTS "contabilidad_asientos_update_borrador" ON public.asientos_contables;
DROP POLICY IF EXISTS "contabilidad_asientos_update_revision" ON public.asientos_contables;
DROP POLICY IF EXISTS "contabilidad_asientos_delete_bloqueado" ON public.asientos_contables;

CREATE POLICY "contabilidad_asientos_select"
ON public.asientos_contables
FOR SELECT
TO authenticated
USING (public.contabilidad_empresa_permitida(empresa_id));

CREATE POLICY "contabilidad_asientos_insert_borrador"
ON public.asientos_contables
FOR INSERT
TO authenticated
WITH CHECK (
  estado IN ('borrador', 'requiere_revision')
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable', 'contador_revisor'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_asientos_update_borrador"
ON public.asientos_contables
FOR UPDATE
TO authenticated
USING (
  estado IN ('borrador', 'requiere_revision')
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable'],
    ARRAY[]::text[]
  )
)
WITH CHECK (
  estado IN ('borrador', 'requiere_revision')
  AND anulado_por IS NULL
  AND anulado_at IS NULL
  AND motivo_anulacion IS NULL
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_asientos_update_revision"
ON public.asientos_contables
FOR UPDATE
TO authenticated
USING (
  estado IN ('borrador', 'requiere_revision')
  AND
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contador_revisor'],
    ARRAY[]::text[]
  )
)
WITH CHECK (
  -- registrado y anulado son transiciones exclusivas de RPCs SECURITY DEFINER.
  estado IN ('borrador', 'requiere_revision')
  AND anulado_por IS NULL
  AND anulado_at IS NULL
  AND motivo_anulacion IS NULL
  AND
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contador_revisor'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_asientos_delete_bloqueado"
ON public.asientos_contables
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "contabilidad_detalle_select" ON public.movimientos_contables_detalle;
DROP POLICY IF EXISTS "contabilidad_detalle_insert_borrador" ON public.movimientos_contables_detalle;
DROP POLICY IF EXISTS "contabilidad_detalle_update_borrador" ON public.movimientos_contables_detalle;
DROP POLICY IF EXISTS "contabilidad_detalle_update_revision" ON public.movimientos_contables_detalle;
DROP POLICY IF EXISTS "contabilidad_detalle_delete_bloqueado" ON public.movimientos_contables_detalle;

CREATE POLICY "contabilidad_detalle_select"
ON public.movimientos_contables_detalle
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.asientos_contables a
    WHERE a.id = movimientos_contables_detalle.asiento_id
      AND public.contabilidad_empresa_permitida(a.empresa_id)
  )
);

CREATE POLICY "contabilidad_detalle_insert_borrador"
ON public.movimientos_contables_detalle
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.asientos_contables a
    WHERE a.id = movimientos_contables_detalle.asiento_id
      AND a.estado IN ('borrador', 'requiere_revision')
      AND public.contabilidad_autorizado(
        a.empresa_id,
        ARRAY['auxiliar_contable', 'contador_revisor'],
        ARRAY[]::text[]
      )
  )
);

CREATE POLICY "contabilidad_detalle_update_borrador"
ON public.movimientos_contables_detalle
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.asientos_contables a
    WHERE a.id = movimientos_contables_detalle.asiento_id
      AND a.estado IN ('borrador', 'requiere_revision')
      AND public.contabilidad_autorizado(
        a.empresa_id,
        ARRAY['auxiliar_contable'],
        ARRAY[]::text[]
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.asientos_contables a
    WHERE a.id = movimientos_contables_detalle.asiento_id
      AND a.estado IN ('borrador', 'requiere_revision')
      AND public.contabilidad_autorizado(
        a.empresa_id,
        ARRAY['auxiliar_contable'],
        ARRAY[]::text[]
      )
  )
);

CREATE POLICY "contabilidad_detalle_update_revision"
ON public.movimientos_contables_detalle
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.asientos_contables a
    WHERE a.id = movimientos_contables_detalle.asiento_id
      AND a.estado IN ('borrador', 'requiere_revision')
      AND public.contabilidad_autorizado(
        a.empresa_id,
        ARRAY['contador_revisor'],
        ARRAY[]::text[]
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.asientos_contables a
    WHERE a.id = movimientos_contables_detalle.asiento_id
      AND a.estado IN ('borrador', 'requiere_revision')
      AND public.contabilidad_autorizado(
        a.empresa_id,
        ARRAY['contador_revisor'],
        ARRAY[]::text[]
      )
  )
);

CREATE POLICY "contabilidad_detalle_delete_bloqueado"
ON public.movimientos_contables_detalle
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "contabilidad_documentos_select" ON public.documentos_contables_revision;
DROP POLICY IF EXISTS "contabilidad_documentos_insert" ON public.documentos_contables_revision;
DROP POLICY IF EXISTS "contabilidad_documentos_update_auxiliar" ON public.documentos_contables_revision;
DROP POLICY IF EXISTS "contabilidad_documentos_update_revision" ON public.documentos_contables_revision;
DROP POLICY IF EXISTS "contabilidad_documentos_delete_bloqueado" ON public.documentos_contables_revision;

CREATE POLICY "contabilidad_documentos_select"
ON public.documentos_contables_revision
FOR SELECT
TO authenticated
USING (public.contabilidad_empresa_permitida(empresa_id));

CREATE POLICY "contabilidad_documentos_insert"
ON public.documentos_contables_revision
FOR INSERT
TO authenticated
WITH CHECK (
  estado = 'Pendiente'
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable', 'contador_revisor'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_documentos_update_auxiliar"
ON public.documentos_contables_revision
FOR UPDATE
TO authenticated
USING (
  estado IN ('Pendiente', 'En revision', 'Observado', 'Vencido')
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable'],
    ARRAY[]::text[]
  )
)
WITH CHECK (
  estado IN ('Pendiente', 'En revision', 'Observado', 'Vencido')
  AND contabilizado_por IS NULL
  AND contabilizado_at IS NULL
  AND public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_documentos_update_revision"
ON public.documentos_contables_revision
FOR UPDATE
TO authenticated
USING (
  estado NOT IN ('Contabilizado', 'Rechazado')
  AND
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contador_revisor'],
    ARRAY[]::text[]
  )
)
WITH CHECK (
  -- Contabilizado es una transicion exclusiva de contabilizar_documento_contable.
  estado IN ('Pendiente', 'En revision', 'Observado', 'Rechazado', 'Vencido')
  AND contabilizado_por IS NULL
  AND contabilizado_at IS NULL
  AND
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['contador_revisor'],
    ARRAY[]::text[]
  )
);

CREATE POLICY "contabilidad_documentos_delete_bloqueado"
ON public.documentos_contables_revision
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "contabilidad_distribuciones_select" ON public.distribuciones_documentos_contables;
DROP POLICY IF EXISTS "contabilidad_distribuciones_insert" ON public.distribuciones_documentos_contables;
DROP POLICY IF EXISTS "contabilidad_distribuciones_update" ON public.distribuciones_documentos_contables;
DROP POLICY IF EXISTS "contabilidad_distribuciones_delete_bloqueado" ON public.distribuciones_documentos_contables;

CREATE POLICY "contabilidad_distribuciones_select"
ON public.distribuciones_documentos_contables
FOR SELECT
TO authenticated
USING (public.contabilidad_empresa_permitida(empresa_id));

CREATE POLICY "contabilidad_distribuciones_insert"
ON public.distribuciones_documentos_contables
FOR INSERT
TO authenticated
WITH CHECK (
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable', 'contador_revisor'],
    ARRAY[]::text[]
  )
  AND EXISTS (
    SELECT 1
    FROM public.documentos_contables_revision d
    WHERE d.id = distribuciones_documentos_contables.documento_contable_id
      AND d.empresa_id = distribuciones_documentos_contables.empresa_id
      AND d.estado NOT IN ('Contabilizado', 'Rechazado')
  )
);

CREATE POLICY "contabilidad_distribuciones_update"
ON public.distribuciones_documentos_contables
FOR UPDATE
TO authenticated
USING (
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable', 'contador_revisor'],
    ARRAY[]::text[]
  )
  AND EXISTS (
    SELECT 1
    FROM public.documentos_contables_revision d
    WHERE d.id = distribuciones_documentos_contables.documento_contable_id
      AND d.empresa_id = distribuciones_documentos_contables.empresa_id
      AND d.estado NOT IN ('Contabilizado', 'Rechazado')
  )
)
WITH CHECK (
  public.contabilidad_autorizado(
    empresa_id,
    ARRAY['auxiliar_contable', 'contador_revisor'],
    ARRAY[]::text[]
  )
  AND EXISTS (
    SELECT 1
    FROM public.documentos_contables_revision d
    WHERE d.id = distribuciones_documentos_contables.documento_contable_id
      AND d.empresa_id = distribuciones_documentos_contables.empresa_id
      AND d.estado NOT IN ('Contabilizado', 'Rechazado')
  )
);

CREATE POLICY "contabilidad_distribuciones_delete_bloqueado"
ON public.distribuciones_documentos_contables
FOR DELETE
TO authenticated
USING (false);

-- Verificacion posterior:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'catalogo_cuentas',
--     'periodos_contables',
--     'asientos_contables',
--     'movimientos_contables_detalle',
--     'documentos_contables_revision',
--     'distribuciones_documentos_contables'
--   )
-- ORDER BY tablename, policyname;

COMMIT;
