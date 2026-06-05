BEGIN;

-- RLS base revisable para Proyectos / centros de costo.
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
-- * No se crean funciones SQL nuevas ni funciones propias de proyectos todavia.
--
-- Integraciones futuras no conectadas en esta rama:
-- cheques, fondos, planilla, CxP, CxC, contabilidad formal, reportes
-- y documentos_tramites.

ALTER TABLE public.proyectos_centros_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos_movimientos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.proyectos_centros_costo FROM anon, public;
REVOKE ALL ON TABLE public.proyectos_presupuestos FROM anon, public;
REVOKE ALL ON TABLE public.proyectos_movimientos FROM anon, public;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.proyectos_centros_costo
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.proyectos_presupuestos
FROM authenticated;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.proyectos_movimientos
FROM authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.proyectos_centros_costo
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.proyectos_presupuestos
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.proyectos_movimientos
TO authenticated;

DROP POLICY IF EXISTS "proyectos_centros_select_empresa"
ON public.proyectos_centros_costo;
DROP POLICY IF EXISTS "proyectos_centros_insert_empresa"
ON public.proyectos_centros_costo;
DROP POLICY IF EXISTS "proyectos_centros_update_empresa"
ON public.proyectos_centros_costo;
DROP POLICY IF EXISTS "proyectos_centros_delete_bloqueado"
ON public.proyectos_centros_costo;

DROP POLICY IF EXISTS "proyectos_presupuestos_select_empresa"
ON public.proyectos_presupuestos;
DROP POLICY IF EXISTS "proyectos_presupuestos_insert_empresa"
ON public.proyectos_presupuestos;
DROP POLICY IF EXISTS "proyectos_presupuestos_update_empresa"
ON public.proyectos_presupuestos;
DROP POLICY IF EXISTS "proyectos_presupuestos_delete_bloqueado"
ON public.proyectos_presupuestos;

DROP POLICY IF EXISTS "proyectos_movimientos_select_empresa"
ON public.proyectos_movimientos;
DROP POLICY IF EXISTS "proyectos_movimientos_insert_empresa"
ON public.proyectos_movimientos;
DROP POLICY IF EXISTS "proyectos_movimientos_update_empresa"
ON public.proyectos_movimientos;
DROP POLICY IF EXISTS "proyectos_movimientos_delete_bloqueado"
ON public.proyectos_movimientos;

CREATE POLICY "proyectos_centros_select_empresa"
ON public.proyectos_centros_costo
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
            AND ue.empresa_id = proyectos_centros_costo.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_centros_insert_empresa"
ON public.proyectos_centros_costo
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
            AND ue.empresa_id = proyectos_centros_costo.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_centros_costo.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_centros_costo.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_centros_update_empresa"
ON public.proyectos_centros_costo
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
            AND ue.empresa_id = proyectos_centros_costo.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_centros_costo.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_centros_costo.empresa_id
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
            AND ue.empresa_id = proyectos_centros_costo.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_centros_costo.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_centros_costo.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_centros_delete_bloqueado"
ON public.proyectos_centros_costo
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "proyectos_presupuestos_select_empresa"
ON public.proyectos_presupuestos
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
            AND ue.empresa_id = proyectos_presupuestos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_presupuestos_insert_empresa"
ON public.proyectos_presupuestos
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
            AND ue.empresa_id = proyectos_presupuestos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_presupuestos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_presupuestos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_presupuestos_update_empresa"
ON public.proyectos_presupuestos
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
            AND ue.empresa_id = proyectos_presupuestos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_presupuestos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_presupuestos.empresa_id
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
            AND ue.empresa_id = proyectos_presupuestos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_presupuestos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_presupuestos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_presupuestos_delete_bloqueado"
ON public.proyectos_presupuestos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "proyectos_movimientos_select_empresa"
ON public.proyectos_movimientos
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
            AND ue.empresa_id = proyectos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_movimientos_insert_empresa"
ON public.proyectos_movimientos
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
            AND ue.empresa_id = proyectos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_movimientos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_movimientos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_movimientos_update_empresa"
ON public.proyectos_movimientos
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
            AND ue.empresa_id = proyectos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_movimientos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_movimientos.empresa_id
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
            AND ue.empresa_id = proyectos_movimientos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = proyectos_movimientos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = proyectos_movimientos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "proyectos_movimientos_delete_bloqueado"
ON public.proyectos_movimientos
FOR DELETE
TO authenticated
USING (false);

COMMIT;
