BEGIN;

-- RLS base revisable para Impuestos / IVA / ISR / retenciones.
-- No crea tablas, no toca pantallas, no modifica RPCs y no cambia datos.
-- Este script es idempotente: habilita RLS y reemplaza definiciones de policies.
-- DROP POLICY IF EXISTS no borra datos; solo elimina una definicion de policy
-- para volver a crearla con el mismo criterio revisable.
--
-- Patron aplicado, alineado con Planilla:
-- * Usuario autenticado con perfil activo.
-- * Acceso a empresa por admin global o usuario_empresas activo.
-- * Escritura para admin, supervisor, jefe, auxiliar_contable o contador_revisor.
-- * auditor_solo_lectura puede leer por empresa, pero no insertar ni actualizar.
-- * Borrado fisico bloqueado con policies FOR DELETE USING (false).
-- * No se crean funciones SQL nuevas ni funciones propias de impuestos todavia.

ALTER TABLE public.impuestos_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_resumen_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impuestos_calendario ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.impuestos_configuracion FROM anon, public;
REVOKE ALL ON TABLE public.impuestos_documentos FROM anon, public;
REVOKE ALL ON TABLE public.impuestos_periodos FROM anon, public;
REVOKE ALL ON TABLE public.impuestos_resumen_periodo FROM anon, public;
REVOKE ALL ON TABLE public.impuestos_calendario FROM anon, public;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.impuestos_configuracion FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.impuestos_documentos FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.impuestos_periodos FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.impuestos_resumen_periodo FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.impuestos_calendario FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.impuestos_configuracion TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.impuestos_documentos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.impuestos_periodos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.impuestos_resumen_periodo TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.impuestos_calendario TO authenticated;

DROP POLICY IF EXISTS "impuestos_configuracion_select_empresa" ON public.impuestos_configuracion;
DROP POLICY IF EXISTS "impuestos_configuracion_insert_empresa" ON public.impuestos_configuracion;
DROP POLICY IF EXISTS "impuestos_configuracion_update_empresa" ON public.impuestos_configuracion;
DROP POLICY IF EXISTS "impuestos_configuracion_delete_bloqueado" ON public.impuestos_configuracion;

DROP POLICY IF EXISTS "impuestos_documentos_select_empresa" ON public.impuestos_documentos;
DROP POLICY IF EXISTS "impuestos_documentos_insert_empresa" ON public.impuestos_documentos;
DROP POLICY IF EXISTS "impuestos_documentos_update_empresa" ON public.impuestos_documentos;
DROP POLICY IF EXISTS "impuestos_documentos_delete_bloqueado" ON public.impuestos_documentos;

DROP POLICY IF EXISTS "impuestos_periodos_select_empresa" ON public.impuestos_periodos;
DROP POLICY IF EXISTS "impuestos_periodos_insert_empresa" ON public.impuestos_periodos;
DROP POLICY IF EXISTS "impuestos_periodos_update_empresa" ON public.impuestos_periodos;
DROP POLICY IF EXISTS "impuestos_periodos_delete_bloqueado" ON public.impuestos_periodos;

DROP POLICY IF EXISTS "impuestos_resumen_select_empresa" ON public.impuestos_resumen_periodo;
DROP POLICY IF EXISTS "impuestos_resumen_insert_empresa" ON public.impuestos_resumen_periodo;
DROP POLICY IF EXISTS "impuestos_resumen_update_empresa" ON public.impuestos_resumen_periodo;
DROP POLICY IF EXISTS "impuestos_resumen_delete_bloqueado" ON public.impuestos_resumen_periodo;

DROP POLICY IF EXISTS "impuestos_calendario_select_empresa" ON public.impuestos_calendario;
DROP POLICY IF EXISTS "impuestos_calendario_insert_empresa" ON public.impuestos_calendario;
DROP POLICY IF EXISTS "impuestos_calendario_update_empresa" ON public.impuestos_calendario;
DROP POLICY IF EXISTS "impuestos_calendario_delete_bloqueado" ON public.impuestos_calendario;

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
      AND (
        lower(coalesce(p.rol, '')) = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.usuario_empresas ue
          WHERE ue.usuario_id = auth.uid()
            AND ue.empresa_id = impuestos_configuracion.empresa_id
            AND ue.activo = true
        )
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
      AND (
        lower(coalesce(p.rol, '')) = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.usuario_empresas ue
          WHERE ue.usuario_id = auth.uid()
            AND ue.empresa_id = impuestos_configuracion.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_configuracion.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
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
      AND (
        lower(coalesce(p.rol, '')) = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.usuario_empresas ue
          WHERE ue.usuario_id = auth.uid()
            AND ue.empresa_id = impuestos_configuracion.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_configuracion.empresa_id
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
            AND ue.empresa_id = impuestos_configuracion.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_configuracion.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_configuracion.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_configuracion_delete_bloqueado"
ON public.impuestos_configuracion
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "impuestos_documentos_select_empresa"
ON public.impuestos_documentos
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
            AND ue.empresa_id = impuestos_documentos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_documentos_insert_empresa"
ON public.impuestos_documentos
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
            AND ue.empresa_id = impuestos_documentos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_documentos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_documentos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_documentos_update_empresa"
ON public.impuestos_documentos
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
            AND ue.empresa_id = impuestos_documentos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_documentos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_documentos.empresa_id
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
            AND ue.empresa_id = impuestos_documentos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_documentos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_documentos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_documentos_delete_bloqueado"
ON public.impuestos_documentos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "impuestos_periodos_select_empresa"
ON public.impuestos_periodos
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
            AND ue.empresa_id = impuestos_periodos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_periodos_insert_empresa"
ON public.impuestos_periodos
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
            AND ue.empresa_id = impuestos_periodos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_periodos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_periodos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_periodos_update_empresa"
ON public.impuestos_periodos
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
            AND ue.empresa_id = impuestos_periodos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_periodos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_periodos.empresa_id
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
            AND ue.empresa_id = impuestos_periodos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_periodos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_periodos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_periodos_delete_bloqueado"
ON public.impuestos_periodos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "impuestos_resumen_select_empresa"
ON public.impuestos_resumen_periodo
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
            AND ue.empresa_id = impuestos_resumen_periodo.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_resumen_insert_empresa"
ON public.impuestos_resumen_periodo
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
            AND ue.empresa_id = impuestos_resumen_periodo.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_resumen_periodo.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_resumen_periodo.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_resumen_update_empresa"
ON public.impuestos_resumen_periodo
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
            AND ue.empresa_id = impuestos_resumen_periodo.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_resumen_periodo.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_resumen_periodo.empresa_id
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
            AND ue.empresa_id = impuestos_resumen_periodo.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_resumen_periodo.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_resumen_periodo.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_resumen_delete_bloqueado"
ON public.impuestos_resumen_periodo
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "impuestos_calendario_select_empresa"
ON public.impuestos_calendario
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
            AND ue.empresa_id = impuestos_calendario.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_calendario_insert_empresa"
ON public.impuestos_calendario
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
            AND ue.empresa_id = impuestos_calendario.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_calendario.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_calendario.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_calendario_update_empresa"
ON public.impuestos_calendario
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
            AND ue.empresa_id = impuestos_calendario.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_calendario.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_calendario.empresa_id
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
            AND ue.empresa_id = impuestos_calendario.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = impuestos_calendario.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = impuestos_calendario.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "impuestos_calendario_delete_bloqueado"
ON public.impuestos_calendario
FOR DELETE
TO authenticated
USING (false);

COMMIT;
