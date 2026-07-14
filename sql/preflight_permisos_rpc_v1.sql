-- Preflight de permisos RPC Supabase V1
-- CONSULTA DE SOLO LECTURA.
-- No modifica permisos, funciones ni datos.

WITH objetivo(firma_esperada) AS (
  VALUES
    ('public.contabilidad_autorizado(bigint, text[], text[])'),
    ('public.contabilidad_empresa_permitida(bigint)'),
    ('public.monitoreo_alertas_set_actualizado_at()'),
    ('public.movimientos_empresa_asignada(bigint)'),
    ('public.movimientos_puede_anular(bigint)'),
    ('public.movimientos_puede_escribir(bigint)'),
    ('public.validar_anulacion_movimiento_operativo()'),
    ('public.anular_asiento_contable(uuid, bigint, text, uuid, text)'),
    ('public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text)'),
    ('public.cerrar_periodo_contable(uuid, bigint, text, uuid, text)'),
    ('public.anular_cheque_transaccional(bigint, bigint, uuid, text, text)'),
    ('public.autorizar_cheque_transaccional(bigint, bigint, uuid, text)'),
    ('public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text)'),
    ('public.pagar_cheque_transaccional(bigint, bigint, uuid, text)'),
    ('public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text)'),
    ('public.contabilizar_documento_contable(uuid, bigint, uuid, text)'),
    ('public.finalizar_asiento_contable(uuid, bigint, uuid, text)'),
    ('public.eliminar_empresa_vacia_segura(bigint, text)'),
    ('public.anular_pago_cxc(text, bigint, uuid, text, text)'),
    ('public.anular_pago_cxp(text, bigint, uuid, text, text)'),
    ('public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text)'),
    ('public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text)'),
    ('public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb)'),
    ('public.seguridad_operativa_set_actualizado_at()'),
    ('public.actualizar_empleado_v2(uuid, integer, jsonb, text)'),
    ('public.crear_empleado_v2(jsonb, text)'),
    ('public.empleados_empresa_permitida_v2(bigint)'),
    ('public.empleados_fallar_operacion_v2(uuid, text)'),
    ('public.empleados_puede_escribir_v2(bigint)'),
    ('public.empleados_puede_estado_v2(bigint)'),
    ('public.empleados_puede_sensible_v2(bigint)'),
    ('public.empleados_reservar_operacion_v2(text, text, text, text)'),
    ('public.empleados_snapshot_auditable_v2(public.empleados_planilla)'),
    ('public.empleados_try_bigint_v2(text)'),
    ('public.empleados_try_date_v2(text)'),
    ('public.empleados_try_integer_v2(text)'),
    ('public.empleados_try_numeric_v2(text)'),
    ('public.empleados_try_uuid_v2(text)'),
    ('public.empleados_validar_fila_v2(jsonb)'),
    ('public.importar_empleados_v2(text, text, bigint, text, text, jsonb)'),
    ('public.validar_importacion_empleados_v2(text, text, jsonb)')
),
inventario AS (
  SELECT
    o.firma_esperada,
    p.oid,
    CASE
      WHEN p.oid IS NULL THEN NULL
      ELSE format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      )
    END AS firma_real,
    propietario.rolname AS propietario,
    p.prosecdef AS security_definer,
    COALESCE(
      (
        SELECT configuracion
        FROM unnest(p.proconfig) AS configuracion
        WHERE configuracion LIKE 'search_path=%'
        LIMIT 1
      ),
      'SIN_EXPLICITO'
    ) AS search_path,
    CASE
      WHEN p.oid IS NULL THEN NULL
      ELSE EXISTS (
        SELECT 1
        FROM aclexplode(
          COALESCE(p.proacl, acldefault('f', p.proowner))
        ) acl
        WHERE acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      )
    END AS public_execute,
    CASE WHEN p.oid IS NULL THEN NULL
      ELSE has_function_privilege('anon', p.oid, 'EXECUTE')
    END AS anon_execute,
    CASE WHEN p.oid IS NULL THEN NULL
      ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE')
    END AS authenticated_execute,
    CASE WHEN p.oid IS NULL THEN NULL
      ELSE has_function_privilege('service_role', p.oid, 'EXECUTE')
    END AS service_role_execute,
    p.proacl::text AS acl_directa
  FROM objetivo o
  LEFT JOIN pg_proc p
    ON p.oid = to_regprocedure(o.firma_esperada)
  LEFT JOIN pg_namespace n
    ON n.oid = p.pronamespace
  LEFT JOIN pg_roles propietario
    ON propietario.oid = p.proowner
)
SELECT *
FROM inventario
ORDER BY firma_esperada;