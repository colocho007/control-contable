BEGIN;

-- RLS base revisable para Conciliacion bancaria.
-- No crea tablas, no toca pantallas, no modifica RPCs y no cambia datos.
-- Este script es idempotente: habilita RLS y reemplaza definiciones de policies.
-- DROP POLICY IF EXISTS no borra datos; solo elimina una definicion de policy
-- para volver a crearla con el mismo criterio revisable.
--
-- Patron aplicado, alineado con Planilla e Impuestos:
-- * Usuario autenticado con perfil activo.
-- * Acceso a empresa por admin global o usuario_empresas activo.
-- * Escritura para admin, supervisor, jefe, auxiliar_contable o contador_revisor.
-- * auditor_solo_lectura puede leer por empresa, pero no insertar ni actualizar.
-- * Borrado fisico bloqueado con policies FOR DELETE USING (false).
-- * No se crean funciones SQL nuevas ni funciones propias de conciliacion todavia.
--
-- Integraciones futuras no conectadas en esta rama:
-- fondos_empresa, cheques, movimientos, pagos, CxP, CxC, contabilidad formal,
-- documentos_tramites e importaciones Excel/PDF.

ALTER TABLE public.conciliacion_cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_estados_cuenta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_movimientos_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacion_ajustes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.conciliacion_cuentas_bancarias FROM anon, public;
REVOKE ALL ON TABLE public.conciliacion_estados_cuenta FROM anon, public;
REVOKE ALL ON TABLE public.conciliacion_movimientos_banco FROM anon, public;
REVOKE ALL ON TABLE public.conciliacion_vinculos FROM anon, public;
REVOKE ALL ON TABLE public.conciliacion_ajustes FROM anon, public;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.conciliacion_cuentas_bancarias FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.conciliacion_estados_cuenta FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.conciliacion_movimientos_banco FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.conciliacion_vinculos FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.conciliacion_ajustes FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.conciliacion_cuentas_bancarias TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conciliacion_estados_cuenta TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conciliacion_movimientos_banco TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conciliacion_vinculos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conciliacion_ajustes TO authenticated;

DROP POLICY IF EXISTS "conciliacion_cuentas_select_empresa" ON public.conciliacion_cuentas_bancarias;
DROP POLICY IF EXISTS "conciliacion_cuentas_insert_empresa" ON public.conciliacion_cuentas_bancarias;
DROP POLICY IF EXISTS "conciliacion_cuentas_update_empresa" ON public.conciliacion_cuentas_bancarias;
DROP POLICY IF EXISTS "conciliacion_cuentas_delete_bloqueado" ON public.conciliacion_cuentas_bancarias;

DROP POLICY IF EXISTS "conciliacion_estados_select_empresa" ON public.conciliacion_estados_cuenta;
DROP POLICY IF EXISTS "conciliacion_estados_insert_empresa" ON public.conciliacion_estados_cuenta;
DROP POLICY IF EXISTS "conciliacion_estados_update_empresa" ON public.conciliacion_estados_cuenta;
DROP POLICY IF EXISTS "conciliacion_estados_delete_bloqueado" ON public.conciliacion_estados_cuenta;

DROP POLICY IF EXISTS "conciliacion_movimientos_select_empresa" ON public.conciliacion_movimientos_banco;
DROP POLICY IF EXISTS "conciliacion_movimientos_insert_empresa" ON public.conciliacion_movimientos_banco;
DROP POLICY IF EXISTS "conciliacion_movimientos_update_empresa" ON public.conciliacion_movimientos_banco;
DROP POLICY IF EXISTS "conciliacion_movimientos_delete_bloqueado" ON public.conciliacion_movimientos_banco;

DROP POLICY IF EXISTS "conciliacion_vinculos_select_empresa" ON public.conciliacion_vinculos;
DROP POLICY IF EXISTS "conciliacion_vinculos_insert_empresa" ON public.conciliacion_vinculos;
DROP POLICY IF EXISTS "conciliacion_vinculos_update_empresa" ON public.conciliacion_vinculos;
DROP POLICY IF EXISTS "conciliacion_vinculos_delete_bloqueado" ON public.conciliacion_vinculos;

DROP POLICY IF EXISTS "conciliacion_ajustes_select_empresa" ON public.conciliacion_ajustes;
DROP POLICY IF EXISTS "conciliacion_ajustes_insert_empresa" ON public.conciliacion_ajustes;
DROP POLICY IF EXISTS "conciliacion_ajustes_update_empresa" ON public.conciliacion_ajustes;
DROP POLICY IF EXISTS "conciliacion_ajustes_delete_bloqueado" ON public.conciliacion_ajustes;

CREATE POLICY "conciliacion_cuentas_select_empresa"
ON public.conciliacion_cuentas_bancarias
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
            AND ue.empresa_id = conciliacion_cuentas_bancarias.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_cuentas_insert_empresa"
ON public.conciliacion_cuentas_bancarias
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
            AND ue.empresa_id = conciliacion_cuentas_bancarias.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_cuentas_bancarias.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_cuentas_bancarias.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_cuentas_update_empresa"
ON public.conciliacion_cuentas_bancarias
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
            AND ue.empresa_id = conciliacion_cuentas_bancarias.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_cuentas_bancarias.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_cuentas_bancarias.empresa_id
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
            AND ue.empresa_id = conciliacion_cuentas_bancarias.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_cuentas_bancarias.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_cuentas_bancarias.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_cuentas_delete_bloqueado"
ON public.conciliacion_cuentas_bancarias
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "conciliacion_estados_select_empresa"
ON public.conciliacion_estados_cuenta
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
            AND ue.empresa_id = conciliacion_estados_cuenta.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_estados_insert_empresa"
ON public.conciliacion_estados_cuenta
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
            AND ue.empresa_id = conciliacion_estados_cuenta.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_estados_cuenta.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_estados_cuenta.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_estados_update_empresa"
ON public.conciliacion_estados_cuenta
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
            AND ue.empresa_id = conciliacion_estados_cuenta.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_estados_cuenta.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_estados_cuenta.empresa_id
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
            AND ue.empresa_id = conciliacion_estados_cuenta.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_estados_cuenta.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_estados_cuenta.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_estados_delete_bloqueado"
ON public.conciliacion_estados_cuenta
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "conciliacion_movimientos_select_empresa"
ON public.conciliacion_movimientos_banco
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
            AND ue.empresa_id = conciliacion_movimientos_banco.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_movimientos_insert_empresa"
ON public.conciliacion_movimientos_banco
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
            AND ue.empresa_id = conciliacion_movimientos_banco.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_movimientos_banco.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_movimientos_banco.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_movimientos_update_empresa"
ON public.conciliacion_movimientos_banco
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
            AND ue.empresa_id = conciliacion_movimientos_banco.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_movimientos_banco.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_movimientos_banco.empresa_id
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
            AND ue.empresa_id = conciliacion_movimientos_banco.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_movimientos_banco.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_movimientos_banco.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_movimientos_delete_bloqueado"
ON public.conciliacion_movimientos_banco
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "conciliacion_vinculos_select_empresa"
ON public.conciliacion_vinculos
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
            AND ue.empresa_id = conciliacion_vinculos.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_vinculos_insert_empresa"
ON public.conciliacion_vinculos
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
            AND ue.empresa_id = conciliacion_vinculos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_vinculos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_vinculos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_vinculos_update_empresa"
ON public.conciliacion_vinculos
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
            AND ue.empresa_id = conciliacion_vinculos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_vinculos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_vinculos.empresa_id
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
            AND ue.empresa_id = conciliacion_vinculos.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_vinculos.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_vinculos.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_vinculos_delete_bloqueado"
ON public.conciliacion_vinculos
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "conciliacion_ajustes_select_empresa"
ON public.conciliacion_ajustes
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
            AND ue.empresa_id = conciliacion_ajustes.empresa_id
            AND ue.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_ajustes_insert_empresa"
ON public.conciliacion_ajustes
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
            AND ue.empresa_id = conciliacion_ajustes.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_ajustes.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_ajustes.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_ajustes_update_empresa"
ON public.conciliacion_ajustes
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
            AND ue.empresa_id = conciliacion_ajustes.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_ajustes.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_ajustes.empresa_id
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
            AND ue.empresa_id = conciliacion_ajustes.empresa_id
            AND ue.activo = true
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_funciones_operativas ufo
        WHERE ufo.usuario_id = auth.uid()
          AND ufo.empresa_id = conciliacion_ajustes.empresa_id
          AND ufo.funcion = 'auditor_solo_lectura'
          AND ufo.activo = true
      )
      AND (
        lower(coalesce(p.rol, '')) IN ('admin', 'supervisor', 'jefe')
        OR EXISTS (
          SELECT 1
          FROM public.usuario_funciones_operativas ufo
          WHERE ufo.usuario_id = auth.uid()
            AND ufo.empresa_id = conciliacion_ajustes.empresa_id
            AND ufo.funcion IN ('auxiliar_contable', 'contador_revisor')
            AND ufo.activo = true
        )
      )
  )
);

CREATE POLICY "conciliacion_ajustes_delete_bloqueado"
ON public.conciliacion_ajustes
FOR DELETE
TO authenticated
USING (false);

COMMIT;
