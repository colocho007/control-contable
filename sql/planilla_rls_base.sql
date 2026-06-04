BEGIN;

-- RLS base revisable para Planilla / IGSS / IRTRA / INTECAP.
-- No ejecuta pagos, no genera CxP/CxC y no genera asientos contables.
-- No crea tablas, no toca RPCs y no modifica pantallas ni Sidebar.
-- Este script es idempotente: habilita RLS y reemplaza definiciones de policies.
-- DROP POLICY IF EXISTS no borra datos; solo elimina una definicion de policy
-- para volver a crearla con el mismo criterio revisable.
--
-- Patron aplicado desde scripts existentes:
-- * Usuario autenticado con perfil activo.
-- * Acceso a empresa por admin global o usuario_empresas activo.
-- * Escritura para jefatura operativa o funciones auxiliar_contable/contador_revisor.
-- * auditor_solo_lectura puede leer por empresa, pero no insertar ni actualizar.
-- * Borrado fisico bloqueado con policies FOR DELETE USING (false).

ALTER TABLE public.empleados_planilla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planillas_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_configuracion_tasas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_prestamos_descuentos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.empleados_planilla FROM anon, public;
REVOKE ALL ON TABLE public.planillas_periodos FROM anon, public;
REVOKE ALL ON TABLE public.planilla_detalle FROM anon, public;
REVOKE ALL ON TABLE public.planilla_configuracion_tasas FROM anon, public;
REVOKE ALL ON TABLE public.planilla_prestamos_descuentos FROM anon, public;

GRANT SELECT, INSERT, UPDATE ON TABLE public.empleados_planilla TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planillas_periodos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planilla_detalle TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planilla_configuracion_tasas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planilla_prestamos_descuentos TO authenticated;

DROP POLICY IF EXISTS "planilla_empleados_select_empresa" ON public.empleados_planilla;
DROP POLICY IF EXISTS "planilla_empleados_insert_empresa" ON public.empleados_planilla;
DROP POLICY IF EXISTS "planilla_empleados_update_empresa" ON public.empleados_planilla;
DROP POLICY IF EXISTS "planilla_empleados_delete_bloqueado" ON public.empleados_planilla;

DROP POLICY IF EXISTS "planilla_periodos_select_empresa" ON public.planillas_periodos;
DROP POLICY IF EXISTS "planilla_periodos_insert_empresa" ON public.planillas_periodos;
DROP POLICY IF EXISTS "planilla_periodos_update_empresa" ON public.planillas_periodos;
DROP POLICY IF EXISTS "planilla_periodos_delete_bloqueado" ON public.planillas_periodos;

DROP POLICY IF EXISTS "planilla_detalle_select_empresa" ON public.planilla_detalle;
DROP POLICY IF EXISTS "planilla_detalle_insert_empresa" ON public.planilla_detalle;
DROP POLICY IF EXISTS "planilla_detalle_update_empresa" ON public.planilla_detalle;
DROP POLICY IF EXISTS "planilla_detalle_delete_bloqueado" ON public.planilla_detalle;

DROP POLICY IF EXISTS "planilla_tasas_select_empresa" ON public.planilla_configuracion_tasas;
DROP POLICY IF EXISTS "planilla_tasas_insert_empresa" ON public.planilla_configuracion_tasas;
DROP POLICY IF EXISTS "planilla_tasas_update_empresa" ON public.planilla_configuracion_tasas;
DROP POLICY IF EXISTS "planilla_tasas_delete_bloqueado" ON public.planilla_configuracion_tasas;

DROP POLICY IF EXISTS "planilla_descuentos_select_empresa" ON public.planilla_prestamos_descuentos;
DROP POLICY IF EXISTS "planilla_descuentos_insert_empresa" ON public.planilla_prestamos_descuentos;
DROP POLICY IF EXISTS "planilla_descuentos_update_empresa" ON public.planilla_prestamos_descuentos;
DROP POLICY IF EXISTS "planilla_descuentos_delete_bloqueado" ON public.planilla_prestamos_descuentos;

CREATE POLICY "planilla_empleados_select_empresa"
ON public.empleados_planilla
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
            AND ue.empresa_id = empleados_planilla.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_empleados_insert_empresa"
ON public.empleados_planilla
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
            AND ue.empresa_id = empleados_planilla.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = empleados_planilla.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = empleados_planilla.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_empleados_update_empresa"
ON public.empleados_planilla
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
            AND ue.empresa_id = empleados_planilla.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = empleados_planilla.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = empleados_planilla.empresa_id
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
            AND ue.empresa_id = empleados_planilla.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = empleados_planilla.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = empleados_planilla.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_empleados_delete_bloqueado"
ON public.empleados_planilla
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "planilla_periodos_select_empresa"
ON public.planillas_periodos
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
            AND ue.empresa_id = planillas_periodos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_periodos_insert_empresa"
ON public.planillas_periodos
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
            AND ue.empresa_id = planillas_periodos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planillas_periodos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planillas_periodos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_periodos_update_empresa"
ON public.planillas_periodos
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
            AND ue.empresa_id = planillas_periodos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planillas_periodos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planillas_periodos.empresa_id
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
            AND ue.empresa_id = planillas_periodos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planillas_periodos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planillas_periodos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_periodos_delete_bloqueado"
ON public.planillas_periodos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "planilla_detalle_select_empresa"
ON public.planilla_detalle
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
            AND ue.empresa_id = planilla_detalle.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_detalle_insert_empresa"
ON public.planilla_detalle
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
            AND ue.empresa_id = planilla_detalle.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_detalle.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_detalle.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_detalle_update_empresa"
ON public.planilla_detalle
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
            AND ue.empresa_id = planilla_detalle.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_detalle.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_detalle.empresa_id
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
            AND ue.empresa_id = planilla_detalle.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_detalle.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_detalle.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_detalle_delete_bloqueado"
ON public.planilla_detalle
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "planilla_tasas_select_empresa"
ON public.planilla_configuracion_tasas
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
            AND ue.empresa_id = planilla_configuracion_tasas.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_tasas_insert_empresa"
ON public.planilla_configuracion_tasas
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
            AND ue.empresa_id = planilla_configuracion_tasas.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_configuracion_tasas.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_configuracion_tasas.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_tasas_update_empresa"
ON public.planilla_configuracion_tasas
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
            AND ue.empresa_id = planilla_configuracion_tasas.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_configuracion_tasas.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_configuracion_tasas.empresa_id
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
            AND ue.empresa_id = planilla_configuracion_tasas.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_configuracion_tasas.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_configuracion_tasas.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_tasas_delete_bloqueado"
ON public.planilla_configuracion_tasas
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "planilla_descuentos_select_empresa"
ON public.planilla_prestamos_descuentos
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
            AND ue.empresa_id = planilla_prestamos_descuentos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_descuentos_insert_empresa"
ON public.planilla_prestamos_descuentos
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
            AND ue.empresa_id = planilla_prestamos_descuentos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_prestamos_descuentos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_prestamos_descuentos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_descuentos_update_empresa"
ON public.planilla_prestamos_descuentos
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
            AND ue.empresa_id = planilla_prestamos_descuentos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_prestamos_descuentos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_prestamos_descuentos.empresa_id
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
            AND ue.empresa_id = planilla_prestamos_descuentos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = planilla_prestamos_descuentos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = planilla_prestamos_descuentos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "planilla_descuentos_delete_bloqueado"
ON public.planilla_prestamos_descuentos
FOR DELETE
TO authenticated
USING (false);

COMMIT;
