-- Smoke test no destructivo para el hardening RPC de pagos V1.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';
SET LOCAL row_security = on;
SET LOCAL search_path = pg_catalog, public;

DO $smoke_functions$
DECLARE
  v_signature text;
  v_oid oid;
  v_role name;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp(text,bigint,uuid,text,text)',
    'public.registrar_pago_cxc_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc_core_v1(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp_core_v1(text,bigint,uuid,text,text)',
    'public.autorizar_rpc_escritura_empresa_v1(text,bigint,uuid)'
  ]
  LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Falta funcion exacta: %.', v_signature;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      WHERE p.oid = v_oid
        AND p.prokind = 'f'
        AND p.prosecdef
        AND (
          (
            v_signature LIKE '%\_core\_v1(%' ESCAPE '\'
            AND p.proconfig @>
                ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
          )
          OR (
            v_signature NOT LIKE '%\_core\_v1(%' ESCAPE '\'
            AND p.proconfig @> ARRAY['search_path=pg_catalog']::text[]
          )
        )
    ) THEN
      RAISE EXCEPTION 'Contrato SECURITY DEFINER/search_path invalido: %.', v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp(text,bigint,uuid,text,text)'
  ]
  LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticator', v_oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc p
         CROSS JOIN LATERAL pg_catalog.aclexplode(
           COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
         ) acl
         WHERE p.oid = v_oid
           AND acl.grantee = 0
           AND acl.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION 'ACL wrapper invalida: %.', v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc_core_v1(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp_core_v1(text,bigint,uuid,text,text)',
    'public.autorizar_rpc_escritura_empresa_v1(text,bigint,uuid)'
  ]
  LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    FOREACH v_role IN ARRAY ARRAY[
      'anon'::name,
      'authenticated'::name,
      'service_role'::name,
      'authenticator'::name
    ]
    LOOP
      IF pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ACL inesperada para % sobre %. ', v_role, v_signature;
      END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
      WHERE p.oid = v_oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'PUBLIC conserva EXECUTE sobre %. ', v_signature;
    END IF;
  END LOOP;

  v_signature := 'public.eliminar_empresa_vacia_segura(bigint,text)';
  v_oid := pg_catalog.to_regprocedure(v_signature);
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Falta funcion exacta: %.', v_signature;
  END IF;

  FOREACH v_role IN ARRAY ARRAY[
    'anon'::name,
    'authenticated'::name,
    'service_role'::name,
    'authenticator'::name
  ]
  LOOP
    IF pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'ACL inesperada para % sobre %. ', v_role, v_signature;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    WHERE p.oid = v_oid
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC conserva EXECUTE sobre %. ', v_signature;
  END IF;
END;
$smoke_functions$;

DO $smoke_idempotency$
DECLARE
  v_role name;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    WHERE c.oid = 'public.idempotency_keys_operativas'::regclass
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'PUBLIC conserva privilegios de tabla sobre idempotencia.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
    WHERE a.attrelid = 'public.idempotency_keys_operativas'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attacl IS NOT NULL
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'PUBLIC conserva privilegios de columna sobre idempotencia.';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon'::name, 'authenticator'::name]
  LOOP
    IF pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'SELECT')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'INSERT')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'UPDATE')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'DELETE')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'TRUNCATE')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'TRIGGER')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'REFERENCES')
       OR pg_catalog.has_table_privilege(v_role, 'public.idempotency_keys_operativas', 'MAINTAIN')
       OR pg_catalog.has_any_column_privilege(v_role, 'public.idempotency_keys_operativas', 'SELECT')
       OR pg_catalog.has_any_column_privilege(v_role, 'public.idempotency_keys_operativas', 'INSERT')
       OR pg_catalog.has_any_column_privilege(v_role, 'public.idempotency_keys_operativas', 'UPDATE')
       OR pg_catalog.has_any_column_privilege(v_role, 'public.idempotency_keys_operativas', 'REFERENCES') THEN
      RAISE EXCEPTION 'ACL invalida para % sobre idempotencia.', v_role;
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'INSERT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'DELETE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'TRUNCATE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'TRIGGER')
     OR pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'REFERENCES')
     OR pg_catalog.has_table_privilege('authenticated', 'public.idempotency_keys_operativas', 'MAINTAIN')
     OR pg_catalog.has_any_column_privilege('authenticated', 'public.idempotency_keys_operativas', 'REFERENCES') THEN
    RAISE EXCEPTION 'Matriz authenticated invalida sobre idempotencia.';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'INSERT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'DELETE')
     OR pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'TRUNCATE')
     OR pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'TRIGGER')
     OR pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'REFERENCES')
     OR pg_catalog.has_table_privilege('service_role', 'public.idempotency_keys_operativas', 'MAINTAIN')
     OR pg_catalog.has_any_column_privilege('service_role', 'public.idempotency_keys_operativas', 'REFERENCES') THEN
    RAISE EXCEPTION 'Matriz service_role invalida sobre idempotencia.';
  END IF;
END;
$smoke_idempotency$;

DO $smoke_payments$
DECLARE
  v_table name;
  v_role name;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'pagos_cuentas_por_cobrar'::name,
    'pagos_cuentas_por_pagar'::name
  ]
  LOOP
    IF NOT pg_catalog.has_table_privilege(
      'authenticated',
      pg_catalog.format('public.%I', v_table),
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'authenticated no conserva SELECT sobre public.%.', v_table;
    END IF;

    FOREACH v_role IN ARRAY ARRAY[
      'anon'::name,
      'authenticated'::name,
      'service_role'::name,
      'authenticator'::name
    ]
    LOOP
      IF pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_table),
           'INSERT'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_table),
           'UPDATE'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_table),
           'DELETE'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_table),
           'TRUNCATE'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_table),
           'TRIGGER'
         )
         OR pg_catalog.has_any_column_privilege(
           v_role,
           pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table)),
           'INSERT'
         )
         OR pg_catalog.has_any_column_privilege(
           v_role,
           pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table)),
           'UPDATE'
         ) THEN
        RAISE EXCEPTION 'El rol % conserva DML directo sobre public.%.', v_role, v_table;
      END IF;
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
      ) acl
      WHERE c.oid = pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table))
        AND acl.grantee = 0
        AND acl.privilege_type IN (
          'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER'
        )
    ) THEN
      RAISE EXCEPTION 'PUBLIC conserva DML de tabla sobre public.%.', v_table;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute a
      CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_table)
        )
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attacl IS NOT NULL
        AND acl.grantee = 0
        AND acl.privilege_type IN ('INSERT', 'UPDATE')
    ) THEN
      RAISE EXCEPTION 'PUBLIC conserva DML por columna sobre public.%.', v_table;
    END IF;
  END LOOP;
END;
$smoke_payments$;

SET LOCAL ROLE anon;
DO $smoke_role_anon$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp(text,bigint,uuid,text,text)'
  ]
  LOOP
    IF pg_catalog.has_function_privilege(CURRENT_USER, v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon conserva EXECUTE sobre wrapper de pagos: %.', v_signature;
    END IF;
  END LOOP;
END;
$smoke_role_anon$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $smoke_role_authenticated$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp(text,bigint,uuid,text,text)'
  ]
  LOOP
    IF NOT pg_catalog.has_function_privilege(CURRENT_USER, v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated no puede ejecutar wrapper de pagos: %.', v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc_core_v1(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp_core_v1(text,bigint,uuid,text,text)',
    'public.autorizar_rpc_escritura_empresa_v1(text,bigint,uuid)'
  ]
  LOOP
    IF pg_catalog.has_function_privilege(CURRENT_USER, v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated conserva EXECUTE interno: %.', v_signature;
    END IF;
  END LOOP;
END;
$smoke_role_authenticated$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $smoke_role_service$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp(text,bigint,uuid,text,text)',
    'public.registrar_pago_cxc_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc_core_v1(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp_core_v1(text,bigint,uuid,text,text)',
    'public.autorizar_rpc_escritura_empresa_v1(text,bigint,uuid)',
    'public.eliminar_empresa_vacia_segura(bigint,text)'
  ]
  LOOP
    IF pg_catalog.has_function_privilege(CURRENT_USER, v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role conserva EXECUTE sobre %.', v_signature;
    END IF;
  END LOOP;
END;
$smoke_role_service$;
RESET ROLE;

SET LOCAL ROLE authenticator;
DO $smoke_role_authenticator$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
    'public.anular_pago_cxc(text,bigint,uuid,text,text)',
    'public.anular_pago_cxp(text,bigint,uuid,text,text)'
  ]
  LOOP
    IF pg_catalog.has_function_privilege(CURRENT_USER, v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticator conserva EXECUTE sobre wrapper: %.', v_signature;
    END IF;
  END LOOP;
END;
$smoke_role_authenticator$;
RESET ROLE;

ROLLBACK;

SELECT 'SMOKE_HARDENING_RPC_PAGOS_OK' AS resultado;
