BEGIN;

-- RLS base revisable para Activos fijos.
-- No crea tablas, no toca pantallas, no modifica RPCs y no cambia datos.
-- Este script es idempotente: habilita RLS y reemplaza definiciones de policies.
-- DROP POLICY IF EXISTS no borra datos; solo elimina una definicion de policy
-- para volver a crearla con el mismo criterio revisable.
--
-- Patron aplicado, alineado con Planilla, Impuestos y Conciliacion bancaria:
-- * Usuario autenticado con perfil activo.
-- * Acceso a empresa por admin global o usuario_empresas activo.
-- * Escritura para admin, supervisor, jefe, auxiliar_contable o contador_revisor.
-- * auditor_solo_lectura puede leer por empresa, pero no insertar ni actualizar.
-- * Borrado fisico bloqueado con policies FOR DELETE USING (false).
-- * No se crean funciones SQL nuevas ni funciones propias de activos fijos todavia.
--
-- Integraciones futuras no conectadas en esta rama:
-- documentos_tramites, proyectos, contabilidad formal, reportes, asientos
-- contables, bajas automaticas y depreciaciones automaticas.

ALTER TABLE public.activos_fijos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_fijos_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_fijos_depreciaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.activos_fijos FROM anon, public;
REVOKE ALL ON TABLE public.activos_fijos_movimientos FROM anon, public;
REVOKE ALL ON TABLE public.activos_fijos_depreciaciones FROM anon, public;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.activos_fijos
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.activos_fijos_movimientos
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.activos_fijos_depreciaciones
FROM authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.activos_fijos
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.activos_fijos_movimientos
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.activos_fijos_depreciaciones
TO authenticated;

DROP POLICY IF EXISTS "activos_fijos_select_empresa"
ON public.activos_fijos;
DROP POLICY IF EXISTS "activos_fijos_insert_empresa"
ON public.activos_fijos;
DROP POLICY IF EXISTS "activos_fijos_update_empresa"
ON public.activos_fijos;
DROP POLICY IF EXISTS "activos_fijos_delete_bloqueado"
ON public.activos_fijos;

DROP POLICY IF EXISTS "activos_movimientos_select_empresa"
ON public.activos_fijos_movimientos;
DROP POLICY IF EXISTS "activos_movimientos_insert_empresa"
ON public.activos_fijos_movimientos;
DROP POLICY IF EXISTS "activos_movimientos_update_empresa"
ON public.activos_fijos_movimientos;
DROP POLICY IF EXISTS "activos_movimientos_delete_bloqueado"
ON public.activos_fijos_movimientos;

DROP POLICY IF EXISTS "activos_depreciaciones_select_empresa"
ON public.activos_fijos_depreciaciones;
DROP POLICY IF EXISTS "activos_depreciaciones_insert_empresa"
ON public.activos_fijos_depreciaciones;
DROP POLICY IF EXISTS "activos_depreciaciones_update_empresa"
ON public.activos_fijos_depreciaciones;
DROP POLICY IF EXISTS "activos_depreciaciones_delete_bloqueado"
ON public.activos_fijos_depreciaciones;

CREATE POLICY "activos_fijos_select_empresa"
ON public.activos_fijos
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "activos_fijos_insert_empresa"
ON public.activos_fijos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "activos_fijos_update_empresa"
ON public.activos_fijos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
)
WITH CHECK (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "activos_fijos_delete_bloqueado"
ON public.activos_fijos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "activos_movimientos_select_empresa"
ON public.activos_fijos_movimientos
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "activos_movimientos_insert_empresa"
ON public.activos_fijos_movimientos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos_movimientos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos_movimientos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "activos_movimientos_update_empresa"
ON public.activos_fijos_movimientos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos_movimientos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos_movimientos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
)
WITH CHECK (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos_movimientos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos_movimientos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "activos_movimientos_delete_bloqueado"
ON public.activos_fijos_movimientos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "activos_depreciaciones_select_empresa"
ON public.activos_fijos_depreciaciones
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "activos_depreciaciones_insert_empresa"
ON public.activos_fijos_depreciaciones
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos_depreciaciones.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "activos_depreciaciones_update_empresa"
ON public.activos_fijos_depreciaciones
FOR UPDATE
TO authenticated
USING (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos_depreciaciones.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
)
WITH CHECK (
  EXISTS (
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
            AND ue.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = activos_fijos_depreciaciones.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = activos_fijos_depreciaciones.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "activos_depreciaciones_delete_bloqueado"
ON public.activos_fijos_depreciaciones
FOR DELETE
TO authenticated
USING (false);

COMMIT;
