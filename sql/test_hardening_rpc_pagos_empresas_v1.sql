-- Pruebas transaccionales para hardening RPC pagos/empresas V1.
--
-- NO ejecutar en produccion. Este archivo exige un proyecto Supabase aislado,
-- fixtures preexistentes con nombres reservados y dos confirmaciones de sesion.
-- No crea usuarios ni empresas. Crea solo filas transaccionales controladas de
-- prueba (idempotencia, bloqueo y auditoria) y todo finaliza con ROLLBACK.
--
-- Antes de ejecutar, en la MISMA sesion y fuera de este archivo:
--   SET hardening_test.proyecto_aislado = 'CONFIRMO_PROYECTO_AISLADO';
--   SET hardening_test.rollback_obligatorio = 'CONFIRMO_ROLLBACK_OBLIGATORIO';
--
-- Fixtures de perfiles, todos activos y con rol canonico sin espacios:
--   __HARDENING_TEST_USUARIO_VALIDO__
--     rol jefe/supervisor/contador/auxiliar; modulos CxC/CxP y empresa asignados.
--   __HARDENING_TEST_ADMIN__
--     rol admin; sin asignacion CxP ni empresa no-asignada (prueba el bypass admin).
--   __HARDENING_TEST_AUDITOR_SOLO_LECTURA__
--     rol de escritura permitido, asignaciones activas y flag
--     auditor_solo_lectura activo para la empresa asignada.
--
-- Fixtures de empresas, identificadas por empresas.nombre exacto:
--   __HARDENING_TEST_EMPRESA_ASIGNADA__
--   __HARDENING_TEST_EMPRESA_NO_ASIGNADA__
--   __HARDENING_TEST_EMPRESA_REAL__          es_prueba=false
--   __HARDENING_TEST_EMPRESA_ACTIVA__        es_prueba=true, estado Activa
--   __HARDENING_TEST_EMPRESA_DEPENDENCIA__   es_prueba=true, Inactiva/Archivada;
--                                             inicia vacia y recibe una dependencia controlada
--   __HARDENING_TEST_EMPRESA_VACIA__         es_prueba=true, Inactiva/Archivada, vacia
--
-- Preparar/marcar estos fixtures exclusivamente con el owner gobernado despues
-- de aplicar la migracion en el proyecto aislado. Si cualquier supuesto falla,
-- el script aborta antes de las pruebas destructivas. Ante un error, ejecutar
-- ROLLBACK manualmente si el cliente no procesa la ultima sentencia.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL idle_in_transaction_session_timeout = '5min';
SET LOCAL row_security = on;
SET LOCAL search_path = pg_catalog;

DO $guard$
DECLARE
  v_expected record;
  v_count bigint;
  v_uuid uuid;
  v_empresa_id bigint;
  v_usuario_valido uuid;
  v_admin uuid;
  v_auditor uuid;
  v_empresa_asignada bigint;
  v_empresa_no_asignada bigint;
  v_empresa_real bigint;
  v_empresa_activa bigint;
  v_empresa_dependencia bigint;
  v_empresa_vacia bigint;
  v_rol text;
  v_activo boolean;
  v_es_prueba boolean;
  v_estado text;
  v_fk record;
  v_has_dependency boolean;
  v_role name;
  v_is_super boolean;
  v_is_privileged boolean;
  v_owner name;
  v_oid oid;
BEGIN
  IF pg_catalog.current_setting(
       'hardening_test.proyecto_aislado',
       true
     ) IS DISTINCT FROM 'CONFIRMO_PROYECTO_AISLADO'
     OR pg_catalog.current_setting(
       'hardening_test.rollback_obligatorio',
       true
     ) IS DISTINCT FROM 'CONFIRMO_ROLLBACK_OBLIGATORIO' THEN
    RAISE EXCEPTION
      'Faltan las dos confirmaciones GUC del proyecto aislado y ROLLBACK.';
  END IF;

  IF CURRENT_USER IS DISTINCT FROM SESSION_USER THEN
    RAISE EXCEPTION
      'La prueba debe iniciar sin un SET ROLE previo (current_user=% session_user=%).',
      CURRENT_USER,
      SESSION_USER;
  END IF;

  SELECT r.rolsuper, (r.rolsuper OR r.rolbypassrls)
    INTO v_is_super, v_is_privileged
  FROM pg_catalog.pg_roles r
  WHERE r.rolname = CURRENT_USER;

  IF NOT FOUND OR NOT v_is_privileged THEN
    RAISE EXCEPTION
      'El ejecutor de pruebas debe ser superuser o BYPASSRLS.';
  END IF;

  FOREACH v_role IN ARRAY ARRAY[
    'anon'::name,
    'authenticated'::name,
    'service_role'::name,
    'authenticator'::name
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = v_role
    ) THEN
      RAISE EXCEPTION 'Falta el rol requerido para pruebas: %.', v_role;
    END IF;

    IF NOT v_is_super
       AND NOT pg_catalog.pg_has_role(
         SESSION_USER,
         v_role,
         'MEMBER'
       ) THEN
      RAISE EXCEPTION
        'El ejecutor no puede SET ROLE al rol de prueba %.', v_role;
    END IF;
  END LOOP;

  SELECT pg_catalog.pg_get_userbyid(p.proowner)
    INTO v_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)'
  );

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'No esta aplicada la wrapper registrar_pago_cxc exacta.';
  END IF;

  IF NOT v_is_super AND v_owner IS DISTINCT FROM CURRENT_USER THEN
    RAISE EXCEPTION
      'La prueba debe ejecutarse como owner de wrappers o superuser (owner=%).',
      v_owner;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid
     AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.empresas'::pg_catalog.regclass
      AND a.attname = 'es_prueba'
      AND a.atttypid = 'boolean'::pg_catalog.regtype
      AND a.attnotnull
      AND pg_catalog.pg_get_expr(d.adbin, d.adrelid) = 'false'
  ) THEN
    RAISE EXCEPTION
      'La columna empresas.es_prueba no tiene el contrato del hardening.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.empresas'::pg_catalog.regclass
      AND t.tgname = 'hardening_empresas_es_prueba_guard_v1'
      AND NOT t.tgisinternal
      AND t.tgenabled = 'O'
      AND t.tgtype = 21
      AND t.tgfoid = pg_catalog.to_regprocedure(
        'public.proteger_empresas_es_prueba_v1()'
      )
  ) THEN
    RAISE EXCEPTION 'Falta el trigger AFTER de proteccion de es_prueba.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_roles r
      ON r.oid = ANY (p.polroles)
    WHERE p.polrelid =
        'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND p.polname = 'hardening_pagos_idempotency_insert_v1'
      AND NOT p.polpermissive
      AND p.polcmd = 'a'
      AND pg_catalog.cardinality(p.polroles) = 1
      AND r.rolname = 'authenticated'
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'cxc-%'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'cxp-%'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'registrar_pago_cxc'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'registrar_pago_cxp'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'anular_pago_cxc'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'anular_pago_cxp'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'modulo'
      ) = 0
  ) THEN
    RAISE EXCEPTION 'Policy restrictiva INSERT de idempotencia invalida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_roles r
      ON r.oid = ANY (p.polroles)
    WHERE p.polrelid =
        'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND p.polname = 'hardening_pagos_idempotency_update_v1'
      AND NOT p.polpermissive
      AND p.polcmd = 'w'
      AND pg_catalog.cardinality(p.polroles) = 1
      AND r.rolname = 'authenticated'
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'cxc-%'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'cxp-%'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'registrar_pago_cxc'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'registrar_pago_cxp'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'anular_pago_cxc'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'anular_pago_cxp'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'registrar_pago_cxc'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'registrar_pago_cxp'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'anular_pago_cxc'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'anular_pago_cxp'
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'modulo'
      ) = 0
      AND pg_catalog.strpos(
        pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid),
        'modulo'
      ) = 0
  ) THEN
    RAISE EXCEPTION 'Policy restrictiva UPDATE de idempotencia invalida.';
  END IF;

  -- Contratos y ACL de las funciones publicadas e internas.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
          true
        ),
        (
          'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
          true
        ),
        ('public.anular_pago_cxc(text,bigint,uuid,text,text)', true),
        ('public.anular_pago_cxp(text,bigint,uuid,text,text)', true),
        ('public.autorizar_rpc_escritura_empresa_v1(text,bigint,uuid)', false),
        (
          'public.registrar_pago_cxc_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
          false
        ),
        (
          'public.registrar_pago_cxp_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)',
          false
        ),
        ('public.anular_pago_cxc_core_v1(text,bigint,uuid,text,text)', false),
        ('public.anular_pago_cxp_core_v1(text,bigint,uuid,text,text)', false)
    ) AS expected(signature, authenticated_execute)
  LOOP
    v_oid := pg_catalog.to_regprocedure(v_expected.signature);

    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Falta funcion exacta: %.', v_expected.signature;
    END IF;

    IF pg_catalog.has_function_privilege(
         'authenticated',
         v_oid,
         'EXECUTE'
       ) IS DISTINCT FROM v_expected.authenticated_execute THEN
      RAISE EXCEPTION
        'ACL authenticated inesperada para %.', v_expected.signature;
    END IF;

    FOREACH v_role IN ARRAY ARRAY[
      'anon'::name,
      'service_role'::name,
      'authenticator'::name
    ]
    LOOP
      IF pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION
          'El rol % conserva EXECUTE inesperado sobre %.',
          v_role,
          v_expected.signature;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_expected IN
    SELECT required.table_name
    FROM (
      VALUES
        ('pagos_cuentas_por_cobrar'),
        ('pagos_cuentas_por_pagar')
    ) AS required(table_name)
  LOOP
    IF NOT pg_catalog.has_any_column_privilege(
      'authenticated',
      pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      ),
      'SELECT'
    ) THEN
      RAISE EXCEPTION
        'authenticated perdio lectura sobre public.%.',
        v_expected.table_name;
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
           pg_catalog.format('public.%I', v_expected.table_name),
           'INSERT'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_expected.table_name),
           'UPDATE'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_expected.table_name),
           'DELETE'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_expected.table_name),
           'TRUNCATE'
         )
         OR pg_catalog.has_table_privilege(
           v_role,
           pg_catalog.format('public.%I', v_expected.table_name),
           'TRIGGER'
         )
         OR pg_catalog.has_any_column_privilege(
           v_role,
           pg_catalog.to_regclass(
             pg_catalog.format('public.%I', v_expected.table_name)
           ),
           'INSERT'
         )
         OR pg_catalog.has_any_column_privilege(
           v_role,
           pg_catalog.to_regclass(
             pg_catalog.format('public.%I', v_expected.table_name)
           ),
           'UPDATE'
         ) THEN
        RAISE EXCEPTION
          'El rol % conserva DML directo sobre public.%.',
          v_role,
          v_expected.table_name;
      END IF;
    END LOOP;
  END LOOP;

  -- Matriz ACL de idempotencia: authenticated conserva el DML operativo;
  -- service_role conserva DELETE controlado; ningun rol API puede TRUNCATE
  -- o instalar triggers.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    WHERE c.oid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'PUBLIC conserva privilegios sobre idempotencia.';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon'::name, 'authenticator'::name]
  LOOP
    IF pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'SELECT'
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'INSERT'
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'UPDATE'
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'DELETE'
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'TRUNCATE'
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'TRIGGER'
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'REFERENCES'
       ) THEN
      RAISE EXCEPTION 'El rol % conserva privilegios sobre idempotencia.', v_role;
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'SELECT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'INSERT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'UPDATE'
     )
     OR pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'DELETE'
     )
     OR pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'TRUNCATE'
     )
     OR pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'TRIGGER'
     ) THEN
    RAISE EXCEPTION 'Matriz authenticated de idempotencia invalida.';
  END IF;

  IF NOT pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'SELECT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'INSERT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'UPDATE'
     )
     OR NOT pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'DELETE'
     )
     OR pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'TRUNCATE'
     )
     OR pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'TRIGGER'
     ) THEN
    RAISE EXCEPTION 'Matriz service_role de idempotencia invalida.';
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
         'public.empresas',
         'DELETE'
       )
       OR pg_catalog.has_table_privilege(
         v_role,
         'public.empresas',
         'TRUNCATE'
       )
       OR pg_catalog.has_table_privilege(
         v_role,
         'public.empresas',
         'TRIGGER'
       )
       OR pg_catalog.has_table_privilege(
         v_role,
         'public.idempotency_keys_operativas',
         'TRIGGER'
       ) THEN
      RAISE EXCEPTION
        'El rol % conserva una ACL de tabla peligrosa tras hardening.',
        v_role;
    END IF;
  END LOOP;

  -- Resolver perfiles reservados y exportar IDs como GUC transaccionales.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('hardening_test.usuario_valido', '__HARDENING_TEST_USUARIO_VALIDO__'),
        ('hardening_test.admin', '__HARDENING_TEST_ADMIN__'),
        (
          'hardening_test.auditor',
          '__HARDENING_TEST_AUDITOR_SOLO_LECTURA__'
        )
    ) AS expected(guc_name, fixture_name)
  LOOP
    SELECT pg_catalog.count(*)
      INTO v_count
    FROM public.perfiles p
    WHERE p.nombre = v_expected.fixture_name;

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'Se esperaba un perfil fixture exacto %, encontrados %.',
        v_expected.fixture_name,
        v_count;
    END IF;

    SELECT p.id
      INTO v_uuid
    FROM public.perfiles p
    WHERE p.nombre = v_expected.fixture_name;

    PERFORM pg_catalog.set_config(
      v_expected.guc_name,
      v_uuid::text,
      true
    );
  END LOOP;

  -- Resolver empresas reservadas y exportar IDs como GUC transaccionales.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'hardening_test.empresa_asignada',
          '__HARDENING_TEST_EMPRESA_ASIGNADA__'
        ),
        (
          'hardening_test.empresa_no_asignada',
          '__HARDENING_TEST_EMPRESA_NO_ASIGNADA__'
        ),
        ('hardening_test.empresa_real', '__HARDENING_TEST_EMPRESA_REAL__'),
        ('hardening_test.empresa_activa', '__HARDENING_TEST_EMPRESA_ACTIVA__'),
        (
          'hardening_test.empresa_dependencia',
          '__HARDENING_TEST_EMPRESA_DEPENDENCIA__'
        ),
        ('hardening_test.empresa_vacia', '__HARDENING_TEST_EMPRESA_VACIA__')
    ) AS expected(guc_name, fixture_name)
  LOOP
    SELECT pg_catalog.count(*)
      INTO v_count
    FROM public.empresas e
    WHERE e.nombre = v_expected.fixture_name;

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'Se esperaba una empresa fixture exacta %, encontradas %.',
        v_expected.fixture_name,
        v_count;
    END IF;

    SELECT e.id
      INTO v_empresa_id
    FROM public.empresas e
    WHERE e.nombre = v_expected.fixture_name;

    IF v_empresa_id IS NULL OR v_empresa_id <= 0 THEN
      RAISE EXCEPTION 'ID invalido para fixture %.', v_expected.fixture_name;
    END IF;

    PERFORM pg_catalog.set_config(
      v_expected.guc_name,
      v_empresa_id::text,
      true
    );
  END LOOP;

  v_usuario_valido := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_admin := pg_catalog.current_setting('hardening_test.admin')::uuid;
  v_auditor := pg_catalog.current_setting('hardening_test.auditor')::uuid;
  v_empresa_asignada := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_empresa_no_asignada := pg_catalog.current_setting(
    'hardening_test.empresa_no_asignada'
  )::bigint;
  v_empresa_real := pg_catalog.current_setting(
    'hardening_test.empresa_real'
  )::bigint;
  v_empresa_activa := pg_catalog.current_setting(
    'hardening_test.empresa_activa'
  )::bigint;
  v_empresa_dependencia := pg_catalog.current_setting(
    'hardening_test.empresa_dependencia'
  )::bigint;
  v_empresa_vacia := pg_catalog.current_setting(
    'hardening_test.empresa_vacia'
  )::bigint;

  SELECT pg_catalog.count(DISTINCT x)
    INTO v_count
  FROM pg_catalog.unnest(
    ARRAY[v_usuario_valido, v_admin, v_auditor]
  ) AS ids(x);

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Los tres perfiles fixture deben ser distintos.';
  END IF;

  SELECT pg_catalog.count(DISTINCT x)
    INTO v_count
  FROM pg_catalog.unnest(
    ARRAY[
      v_empresa_asignada,
      v_empresa_no_asignada,
      v_empresa_real,
      v_empresa_activa,
      v_empresa_dependencia,
      v_empresa_vacia
    ]
  ) AS ids(x);

  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Las seis empresas fixture deben ser distintas.';
  END IF;

  SELECT pg_catalog.lower(COALESCE(p.rol, '')), p.activo
    INTO v_rol, v_activo
  FROM public.perfiles p
  WHERE p.id = v_usuario_valido;

  IF v_activo IS DISTINCT FROM true
     OR v_rol NOT IN ('jefe', 'supervisor', 'contador', 'auxiliar') THEN
    RAISE EXCEPTION
      'El usuario valido debe estar activo y tener rol de escritura no-admin.';
  END IF;

  SELECT pg_catalog.lower(COALESCE(p.rol, '')), p.activo
    INTO v_rol, v_activo
  FROM public.perfiles p
  WHERE p.id = v_admin;

  IF v_activo IS DISTINCT FROM true OR v_rol IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'El fixture admin debe ser admin activo canonico.';
  END IF;

  SELECT pg_catalog.lower(COALESCE(p.rol, '')), p.activo
    INTO v_rol, v_activo
  FROM public.perfiles p
  WHERE p.id = v_auditor;

  IF v_activo IS DISTINCT FROM true
     OR v_rol NOT IN ('jefe', 'supervisor', 'contador', 'auxiliar') THEN
    RAISE EXCEPTION
      'El fixture solo-lectura debe tener rol de escritura para aislar el flag.';
  END IF;

  FOR v_expected IN
    SELECT required.module_key
    FROM (
      VALUES ('cuentas-cobrar'), ('cuentas-pagar'), ('empresas')
    ) AS required(module_key)
  LOOP
    SELECT pg_catalog.count(*)
      INTO v_count
    FROM public.modulos_sistema ms
    WHERE ms.clave = v_expected.module_key
      AND ms.activo IS TRUE;

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'Modulo fixture % debe existir una vez y estar activo.',
        v_expected.module_key;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = v_usuario_valido
      AND ue.empresa_id = v_empresa_asignada
      AND ue.activo IS TRUE
  ) OR EXISTS (
    SELECT 1
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = v_usuario_valido
      AND ue.empresa_id = v_empresa_no_asignada
      AND ue.activo IS TRUE
  ) THEN
    RAISE EXCEPTION
      'Asignaciones de empresa del usuario valido no aislan el caso negativo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = v_auditor
      AND ue.empresa_id = v_empresa_asignada
      AND ue.activo IS TRUE
  ) THEN
    RAISE EXCEPTION 'El fixture solo-lectura requiere empresa asignada.';
  END IF;

  FOR v_expected IN
    SELECT required.usuario_id, required.module_key
    FROM (
      VALUES
        (v_usuario_valido, 'cuentas-cobrar'),
        (v_usuario_valido, 'cuentas-pagar'),
        (v_auditor, 'cuentas-cobrar'),
        (v_auditor, 'cuentas-pagar')
    ) AS required(usuario_id, module_key)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.usuario_modulos um
      WHERE um.usuario_id = v_expected.usuario_id
        AND um.modulo_clave = v_expected.module_key
        AND um.activo IS TRUE
    ) THEN
      RAISE EXCEPTION
        'Falta asignacion de modulo % para fixture %.',
        v_expected.module_key,
        v_expected.usuario_id;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = v_admin
      AND ue.empresa_id = v_empresa_no_asignada
      AND ue.activo IS TRUE
  ) OR EXISTS (
    SELECT 1
    FROM public.usuario_modulos um
    WHERE um.usuario_id = v_admin
      AND um.modulo_clave = 'cuentas-pagar'
      AND um.activo IS TRUE
  ) THEN
    RAISE EXCEPTION
      'Admin debe carecer de asignaciones CxP/empresa para probar su bypass.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_funciones_operativas ufo
    WHERE ufo.usuario_id = v_usuario_valido
      AND ufo.empresa_id = v_empresa_asignada
      AND ufo.funcion = 'auditor_solo_lectura'
      AND ufo.activo IS TRUE
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.usuario_funciones_operativas ufo
    WHERE ufo.usuario_id = v_auditor
      AND ufo.empresa_id = v_empresa_asignada
      AND ufo.funcion = 'auditor_solo_lectura'
      AND ufo.activo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Flags auditor_solo_lectura de fixtures son invalidos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_funciones_operativas ufo
    WHERE ufo.usuario_id = v_admin
      AND ufo.empresa_id = ANY (
        ARRAY[
          v_empresa_no_asignada,
          v_empresa_real,
          v_empresa_activa,
          v_empresa_dependencia,
          v_empresa_vacia
        ]
      )
      AND ufo.funcion = 'auditor_solo_lectura'
      AND ufo.activo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Admin fixture no debe tener flags solo-lectura.';
  END IF;

  SELECT e.es_prueba, pg_catalog.lower(COALESCE(e.estado, ''))
    INTO v_es_prueba, v_estado
  FROM public.empresas e
  WHERE e.id = v_empresa_real;

  IF v_es_prueba IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'EMPRESA_REAL debe tener es_prueba=false.';
  END IF;

  SELECT e.es_prueba, pg_catalog.lower(COALESCE(e.estado, ''))
    INTO v_es_prueba, v_estado
  FROM public.empresas e
  WHERE e.id = v_empresa_activa;

  IF v_es_prueba IS DISTINCT FROM true OR v_estado IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'EMPRESA_ACTIVA debe ser prueba y estado Activa.';
  END IF;

  FOREACH v_empresa_id IN ARRAY ARRAY[
    v_empresa_dependencia,
    v_empresa_vacia
  ]
  LOOP
    SELECT e.es_prueba, pg_catalog.lower(COALESCE(e.estado, ''))
      INTO v_es_prueba, v_estado
    FROM public.empresas e
    WHERE e.id = v_empresa_id;

    IF v_es_prueba IS DISTINCT FROM true
       OR v_estado NOT IN ('inactiva', 'archivada') THEN
      RAISE EXCEPTION
        'Empresa eliminable fixture % debe ser prueba Inactiva/Archivada.',
        v_empresa_id;
    END IF;
  END LOOP;

  -- Ambas empresas destructivas deben iniciar sin ninguna FK dependiente.
  FOR v_fk IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      source.attname AS column_name
    FROM pg_catalog.pg_constraint fk
    JOIN pg_catalog.pg_class c
      ON c.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute source
      ON source.attrelid = fk.conrelid
     AND source.attnum = fk.conkey[1]
     AND NOT source.attisdropped
    JOIN pg_catalog.pg_attribute target
      ON target.attrelid = fk.confrelid
     AND target.attname = 'id'
     AND target.attnum > 0
     AND NOT target.attisdropped
    WHERE fk.contype = 'f'
      AND fk.confrelid = 'public.empresas'::pg_catalog.regclass
      AND fk.conparentid = 0
      AND fk.convalidated
      AND fk.confdeltype IN ('a', 'r')
      AND pg_catalog.cardinality(fk.conkey) = 1
      AND pg_catalog.cardinality(fk.confkey) = 1
      AND fk.confkey[1] = target.attnum
    ORDER BY n.nspname, c.relname, fk.conname
  LOOP
    FOREACH v_empresa_id IN ARRAY ARRAY[
      v_empresa_dependencia,
      v_empresa_vacia
    ]
    LOOP
      EXECUTE pg_catalog.format(
        'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
        v_fk.schema_name,
        v_fk.table_name,
        v_fk.column_name
      )
        INTO v_has_dependency
        USING v_empresa_id;

      IF v_has_dependency THEN
        RAISE EXCEPTION
          'Fixture % ya tiene dependencia en %.%.',
          v_empresa_id,
          v_fk.schema_name,
          v_fk.table_name;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.cuentas_por_cobrar c
    WHERE c.id::text = '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__'
  ) OR EXISTS (
    SELECT 1 FROM public.cuentas_por_pagar c
    WHERE c.id::text = '__HARDENING_TEST_CUENTA_CXP_INEXISTENTE__'
  ) OR EXISTS (
    SELECT 1 FROM public.pagos_cuentas_por_cobrar p
    WHERE p.id::text = '__HARDENING_TEST_PAGO_CXC_INEXISTENTE__'
  ) OR EXISTS (
    SELECT 1 FROM public.pagos_cuentas_por_pagar p
    WHERE p.id::text = '__HARDENING_TEST_PAGO_CXP_INEXISTENTE__'
  ) THEN
    RAISE EXCEPTION 'Un ID reservado como inexistente ya existe.';
  END IF;

  PERFORM pg_catalog.set_config(
    'hardening_test.key_cxc_registro',
    'cxc-hardening-test-reg-' || pg_catalog.txid_current()::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'hardening_test.key_cxp_registro',
    'cxp-hardening-test-reg-' || pg_catalog.txid_current()::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'hardening_test.key_cxc_anulacion',
    'cxc-hardening-test-anul-' || pg_catalog.txid_current()::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'hardening_test.key_cxp_anulacion',
    'cxp-hardening-test-anul-' || pg_catalog.txid_current()::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'hardening_test.key_cxc_directa',
    'cxc-hardening-test-direct-' || pg_catalog.txid_current()::text,
    true
  );

  RAISE NOTICE 'Guardas, contratos, ACL y fixtures: OK';
END;
$guard$;

-- Las comprobaciones siguientes usan SET LOCAL ROLE real; no simulan el rol
-- pasando su nombre como dato.
SET LOCAL ROLE anon;

DO $acl_anon$
BEGIN
  IF CURRENT_USER IS DISTINCT FROM 'anon'
     OR pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure(
         'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)'
       ),
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'ACL real de anon no coincide con el hardening.';
  END IF;
END;
$acl_anon$;

RESET ROLE;

-- Aislar la prueba de RLS de una denegacion causada solamente por ACL.
DO $rls_guard$
DECLARE
  v_relrowsecurity boolean;
BEGIN
  SELECT c.relrowsecurity
    INTO v_relrowsecurity
  FROM pg_catalog.pg_class c
  WHERE c.oid =
    'public.idempotency_keys_operativas'::pg_catalog.regclass;

  IF v_relrowsecurity IS DISTINCT FROM true
     OR NOT pg_catalog.has_table_privilege(
       'authenticated',
       'public.idempotency_keys_operativas',
       'SELECT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'authenticated',
       'public.idempotency_keys_operativas',
       'INSERT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'authenticated',
       'public.idempotency_keys_operativas',
       'UPDATE'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_roles r
       WHERE r.rolname = 'authenticated'
         AND (r.rolsuper OR r.rolbypassrls)
     ) THEN
    RAISE EXCEPTION
      'No se puede aislar la prueba RLS de idempotencia con authenticated.';
  END IF;
END;
$rls_guard$;

-- Rechazos de autorizacion: todos se ejecutan bajo el rol API real.
SET LOCAL ROLE authenticated;

DO $test_sesion_invalida_pago$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
  PERFORM pg_catalog.set_config('request.jwt.claims', '{}', true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_usuario,
      pg_catalog.current_setting('hardening_test.key_cxc_registro')
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'Sesion no valida para realizar la operacion.' THEN
    RAISE EXCEPTION
      'TEST sesion invalida: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_sesion_invalida_pago$;

DO $test_actor_distinto$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_actor_distinto uuid := pg_catalog.current_setting(
    'hardening_test.admin'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_actor_distinto,
      pg_catalog.current_setting('hardening_test.key_cxc_registro')
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'Sesion no valida para realizar la operacion.' THEN
    RAISE EXCEPTION
      'TEST actor distinto: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_actor_distinto$;

DO $test_empresa_no_asignada$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_no_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_usuario,
      pg_catalog.current_setting('hardening_test.key_cxc_registro')
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'No tienes permiso para operar esta empresa.' THEN
    RAISE EXCEPTION
      'TEST empresa no asignada: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_empresa_no_asignada$;

RESET ROLE;

-- Alteraciones temporales y reversibles para probar las dos capas de modulo.
SAVEPOINT fixture_modulo_usuario;

UPDATE public.usuario_modulos
SET activo = false
WHERE usuario_id = pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid
  AND modulo_clave = 'cuentas-cobrar'
  AND activo IS TRUE;

DO $guard_fixture_modulo_usuario$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.usuario_modulos um
    WHERE um.usuario_id = pg_catalog.current_setting(
        'hardening_test.usuario_valido'
      )::uuid
      AND um.modulo_clave = 'cuentas-cobrar'
      AND um.activo IS TRUE
  ) THEN
    RAISE EXCEPTION
      'No fue posible desactivar temporalmente el modulo del usuario.';
  END IF;
END;
$guard_fixture_modulo_usuario$;

SET LOCAL ROLE authenticated;

DO $test_modulo_usuario_inactivo$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_usuario,
      pg_catalog.current_setting('hardening_test.key_cxc_registro')
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'No tienes asignado el modulo solicitado.' THEN
    RAISE EXCEPTION
      'TEST modulo usuario: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_modulo_usuario_inactivo$;

RESET ROLE;
ROLLBACK TO SAVEPOINT fixture_modulo_usuario;
RELEASE SAVEPOINT fixture_modulo_usuario;

SAVEPOINT fixture_modulo_global;

UPDATE public.modulos_sistema
SET activo = false
WHERE clave = 'cuentas-cobrar'
  AND activo IS TRUE;

DO $guard_fixture_modulo_global$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.modulos_sistema ms
    WHERE ms.clave = 'cuentas-cobrar'
      AND ms.activo IS TRUE
  ) THEN
    RAISE EXCEPTION
      'No fue posible desactivar temporalmente el modulo global.';
  END IF;
END;
$guard_fixture_modulo_global$;

SET LOCAL ROLE authenticated;

DO $test_modulo_global_inactivo$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_usuario,
      pg_catalog.current_setting('hardening_test.key_cxc_registro')
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'El modulo solicitado esta desactivado.' THEN
    RAISE EXCEPTION
      'TEST modulo global: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_modulo_global_inactivo$;

RESET ROLE;
ROLLBACK TO SAVEPOINT fixture_modulo_global;
RELEASE SAVEPOINT fixture_modulo_global;

SET LOCAL ROLE authenticated;

DO $test_auditor_solo_lectura$
DECLARE
  v_auditor uuid := pg_catalog.current_setting(
    'hardening_test.auditor'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_auditor::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_auditor::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_auditor,
      pg_catalog.current_setting('hardening_test.key_cxc_registro')
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'El usuario tiene acceso de solo lectura para esta empresa.' THEN
    RAISE EXCEPTION
      'TEST auditor solo lectura: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_auditor_solo_lectura$;

DO $test_llave_ausente$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  BEGIN
    PERFORM public.registrar_pago_cxc(
      '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_usuario,
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'Debe indicar una llave cxc- valida de hasta 200 caracteres.' THEN
    RAISE EXCEPTION
      'TEST llave ausente: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_llave_ausente$;

DO $test_llave_invalida$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_llave text := 'cxp-' || pg_catalog.repeat('x', 197);
  v_fallo boolean := false;
  v_mensaje text;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  IF pg_catalog.char_length(v_llave) <> 201
     OR v_llave NOT LIKE 'cxp-%' THEN
    RAISE EXCEPTION 'El fixture de llave invalida no conserva su contrato.';
  END IF;

  BEGIN
    PERFORM public.registrar_pago_cxp(
      '__HARDENING_TEST_CUENTA_CXP_INEXISTENTE__',
      v_empresa,
      CURRENT_DATE,
      'Transferencia',
      NULL,
      'REF-HARDENING',
      'GTQ',
      1::numeric,
      'Prueba hardening',
      v_usuario,
      v_llave
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_fallo := true;
      v_mensaje := SQLERRM;
  END;

  IF NOT v_fallo
     OR v_mensaje IS DISTINCT FROM
       'Debe indicar una llave cxp- valida de hasta 200 caracteres.' THEN
    RAISE EXCEPTION
      'TEST llave invalida: resultado inesperado (fallo=%, mensaje=%).',
      v_fallo,
      v_mensaje;
  END IF;
END;
$test_llave_invalida$;

RESET ROLE;
SET LOCAL ROLE service_role;

DO $acl_service$
BEGIN
  IF CURRENT_USER IS DISTINCT FROM 'service_role'
     OR pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure(
         'public.eliminar_empresa_vacia_segura(bigint,text)'
       ),
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'ACL real de service_role no coincide con el hardening.';
  END IF;
END;
$acl_service$;

RESET ROLE;
SET LOCAL ROLE authenticator;

DO $acl_authenticator$
BEGIN
  IF CURRENT_USER IS DISTINCT FROM 'authenticator'
     OR pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure(
         'public.registrar_pago_cxp(text,bigint,date,text,text,text,text,numeric,text,uuid,text)'
       ),
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'ACL real de authenticator no coincide con el hardening.';
  END IF;
END;
$acl_authenticator$;

RESET ROLE;
SET LOCAL ROLE authenticated;

DO $acl_authenticated$
BEGIN
  IF CURRENT_USER IS DISTINCT FROM 'authenticated'
     OR NOT pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure(
         'public.registrar_pago_cxc(text,bigint,date,text,text,text,text,numeric,text,uuid,text)'
       ),
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure(
         'public.autorizar_rpc_escritura_empresa_v1(text,bigint,uuid)'
       ),
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure(
         'public.registrar_pago_cxc_core_v1(text,bigint,date,text,text,text,text,numeric,text,uuid,text)'
       ),
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'ACL real de authenticated no coincide con el hardening.';
  END IF;
END;
$acl_authenticated$;

RESET ROLE;

-- Cores funcionales: la autorizacion debe pasar y el ID reservado inexistente
-- debe producir el fallo controlado del core, nunca un fallo de autorizacion.
SET LOCAL ROLE authenticated;

DO $test_core_registrar_cxc_y_rls$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_key text := pg_catalog.current_setting(
    'hardening_test.key_cxc_registro'
  );
  v_key_directa text := pg_catalog.current_setting(
    'hardening_test.key_cxc_directa'
  );
  v_resultado jsonb;
  v_filas bigint;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  v_resultado := public.registrar_pago_cxc(
    '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
    v_empresa,
    CURRENT_DATE,
    'Transferencia',
    NULL,
    'REF-HARDENING',
    'GTQ',
    1::numeric,
    'Prueba hardening',
    v_usuario,
    v_key
  );

  IF (v_resultado ->> 'ok')::boolean IS DISTINCT FROM false
     OR v_resultado ->> 'codigo' IS DISTINCT FROM
       'registrar_pago_cxc_fallido'
     OR v_resultado ->> 'mensaje' IS DISTINCT FROM
       'CxC no encontrada para la empresa indicada.'
     OR v_resultado ->> 'idempotency_key' IS DISTINCT FROM v_key THEN
    RAISE EXCEPTION
      'TEST core registrar CxC: JSON inesperado: %.',
      v_resultado;
  END IF;

  -- La misma llave con un payload distinto debe cerrarse antes del core.
  v_resultado := public.registrar_pago_cxc(
    '__HARDENING_TEST_CUENTA_CXC_INEXISTENTE__',
    v_empresa,
    CURRENT_DATE,
    'Transferencia',
    NULL,
    'REF-HARDENING',
    'GTQ',
    2::numeric,
    'Prueba hardening',
    v_usuario,
    v_key
  );

  IF (v_resultado ->> 'ok')::boolean IS DISTINCT FROM false
     OR v_resultado ->> 'codigo' IS DISTINCT FROM
       'idempotency_payload_distinto' THEN
    RAISE EXCEPTION
      'TEST payload idempotente distinto: JSON inesperado: %.',
      v_resultado;
  END IF;

  -- La policy UPDATE restrictiva debe ocultar la fila reservada al rol API.
  UPDATE public.idempotency_keys_operativas i
  SET error_resumen = 'MUTACION_DIRECTA_NO_DEBE_OCURRIR'
  WHERE i.idempotency_key = v_key;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas <> 0 THEN
    RAISE EXCEPTION
      'TEST RLS UPDATE: authenticated modifico % fila(s) reservada(s).',
      v_filas;
  END IF;

  -- La policy INSERT restrictiva debe rechazar tanto el prefijo como la
  -- accion reservada, aun con usuario/empresa coincidentes con el JWT.
  BEGIN
    INSERT INTO public.idempotency_keys_operativas (
      expira_at,
      idempotency_key,
      usuario_id,
      empresa_id,
      modulo,
      accion,
      estado,
      request_hash,
      entidad_tipo
    )
    VALUES (
      CURRENT_TIMESTAMP + INTERVAL '24 hours',
      v_key_directa,
      v_usuario,
      v_empresa,
      'cuentas-cobrar',
      'registrar_pago_cxc',
      'en_proceso',
      pg_catalog.md5('hardening-test-directo'),
      'hardening_test'
    );

    RAISE EXCEPTION
      'TEST RLS INSERT: authenticated inserto una llave reservada.';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      NULL;
  END;
END;
$test_core_registrar_cxc_y_rls$;

DO $test_core_registrar_cxp_admin$
DECLARE
  v_admin uuid := pg_catalog.current_setting(
    'hardening_test.admin'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_no_asignada'
  )::bigint;
  v_key text := pg_catalog.current_setting(
    'hardening_test.key_cxp_registro'
  );
  v_resultado jsonb;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_admin::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_admin::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  v_resultado := public.registrar_pago_cxp(
    '__HARDENING_TEST_CUENTA_CXP_INEXISTENTE__',
    v_empresa,
    CURRENT_DATE,
    'Transferencia',
    NULL,
    'REF-HARDENING',
    'GTQ',
    1::numeric,
    'Prueba hardening',
    v_admin,
    v_key
  );

  IF (v_resultado ->> 'ok')::boolean IS DISTINCT FROM false
     OR v_resultado ->> 'codigo' IS DISTINCT FROM
       'registrar_pago_cxp_fallido'
     OR v_resultado ->> 'mensaje' IS DISTINCT FROM
       'CxP no encontrada para la empresa indicada.'
     OR v_resultado ->> 'idempotency_key' IS DISTINCT FROM v_key THEN
    RAISE EXCEPTION
      'TEST core registrar CxP y bypass admin: JSON inesperado: %.',
      v_resultado;
  END IF;
END;
$test_core_registrar_cxp_admin$;

DO $test_core_anular_cxc$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_key text := pg_catalog.current_setting(
    'hardening_test.key_cxc_anulacion'
  );
  v_resultado jsonb;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  v_resultado := public.anular_pago_cxc(
    '__HARDENING_TEST_PAGO_CXC_INEXISTENTE__',
    v_empresa,
    v_usuario,
    'Anulacion controlada de hardening',
    v_key
  );

  IF (v_resultado ->> 'ok')::boolean IS DISTINCT FROM false
     OR v_resultado ->> 'codigo' IS DISTINCT FROM
       'anular_pago_cxc_fallido'
     OR v_resultado ->> 'mensaje' IS DISTINCT FROM
       'Pago CxC no encontrado para la empresa indicada.'
     OR v_resultado ->> 'idempotency_key' IS DISTINCT FROM v_key THEN
    RAISE EXCEPTION
      'TEST core anular CxC: JSON inesperado: %.',
      v_resultado;
  END IF;
END;
$test_core_anular_cxc$;

DO $test_core_anular_cxp$
DECLARE
  v_usuario uuid := pg_catalog.current_setting(
    'hardening_test.usuario_valido'
  )::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_asignada'
  )::bigint;
  v_key text := pg_catalog.current_setting(
    'hardening_test.key_cxp_anulacion'
  );
  v_resultado jsonb;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_usuario::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_usuario::text,
      'role', 'authenticated'
    )::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  v_resultado := public.anular_pago_cxp(
    '__HARDENING_TEST_PAGO_CXP_INEXISTENTE__',
    v_empresa,
    v_usuario,
    'Anulacion controlada de hardening',
    v_key
  );

  IF (v_resultado ->> 'ok')::boolean IS DISTINCT FROM false
     OR v_resultado ->> 'codigo' IS DISTINCT FROM
       'anular_pago_cxp_fallido'
     OR v_resultado ->> 'mensaje' IS DISTINCT FROM
       'Pago CxP no encontrado para la empresa indicada.'
     OR v_resultado ->> 'idempotency_key' IS DISTINCT FROM v_key THEN
    RAISE EXCEPTION
      'TEST core anular CxP: JSON inesperado: %.',
      v_resultado;
  END IF;
END;
$test_core_anular_cxp$;

RESET ROLE;

-- Confirmar bajo el ejecutor privilegiado que las filas reservadas existen.
-- Esto evita que las aserciones UPDATE de RLS pasen por ausencia de fixture.
DO $assert_idempotencia_fisica$
DECLARE
  v_expected record;
  v_count bigint;
BEGIN
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'hardening_test.key_cxc_registro',
          'hardening_test.usuario_valido',
          'hardening_test.empresa_asignada',
          'cuentas-cobrar',
          'registrar_pago_cxc'
        ),
        (
          'hardening_test.key_cxp_registro',
          'hardening_test.admin',
          'hardening_test.empresa_no_asignada',
          'cuentas-pagar',
          'registrar_pago_cxp'
        ),
        (
          'hardening_test.key_cxc_anulacion',
          'hardening_test.usuario_valido',
          'hardening_test.empresa_asignada',
          'cuentas-cobrar',
          'anular_pago_cxc'
        ),
        (
          'hardening_test.key_cxp_anulacion',
          'hardening_test.usuario_valido',
          'hardening_test.empresa_asignada',
          'cuentas-pagar',
          'anular_pago_cxp'
        )
    ) AS expected(
      key_guc,
      actor_guc,
      empresa_guc,
      modulo,
      accion
    )
  LOOP
    SELECT pg_catalog.count(*)
      INTO v_count
    FROM public.idempotency_keys_operativas i
    WHERE i.idempotency_key = pg_catalog.current_setting(
        v_expected.key_guc
      )
      AND i.usuario_id = pg_catalog.current_setting(
        v_expected.actor_guc
      )::uuid
      AND i.empresa_id = pg_catalog.current_setting(
        v_expected.empresa_guc
      )::bigint
      AND i.modulo = v_expected.modulo
      AND i.accion = v_expected.accion
      AND i.request_hash IS NOT NULL
      AND i.estado = 'fallida';

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'Fixture idempotente fisico invalido para %: % fila(s).',
        v_expected.accion,
        v_count;
    END IF;
  END LOOP;
END;
$assert_idempotencia_fisica$;

-- Crear una dependencia FK unica, marcada y enteramente transaccional.
DO $fixture_empresa_dependencia$
DECLARE
  v_admin uuid := pg_catalog.current_setting('hardening_test.admin')::uuid;
  v_empresa bigint := pg_catalog.current_setting(
    'hardening_test.empresa_dependencia'
  )::bigint;
  v_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
    INTO v_count
  FROM public.intentos_bloqueados i
  WHERE i.empresa_id = v_empresa
    AND i.accion = 'hardening_test_dependencia_empresa'
    AND i.mensaje = '__HARDENING_TEST_DEPENDENCIA_CONTROLADA__';

  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'La dependencia controlada ya existia antes de crear el fixture.';
  END IF;

  INSERT INTO public.intentos_bloqueados (
    usuario_id,
    empresa_id,
    modulo,
    accion,
    motivo,
    severidad,
    entidad_tipo,
    entidad_id,
    mensaje,
    metadatos
  )
  VALUES (
    v_admin,
    v_empresa,
    'empresas',
    'hardening_test_dependencia_empresa',
    'fixture_transaccional',
    'baja',
    'empresa',
    v_empresa::text,
    '__HARDENING_TEST_DEPENDENCIA_CONTROLADA__',
    pg_catalog.jsonb_build_object(
      'hardening_test', true,
      'rollback_obligatorio', true
    )
  );

  SELECT pg_catalog.count(*)
    INTO v_count
  FROM public.intentos_bloqueados i
  WHERE i.empresa_id = v_empresa
    AND i.accion = 'hardening_test_dependencia_empresa'
    AND i.mensaje = '__HARDENING_TEST_DEPENDENCIA_CONTROLADA__';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'No se creo exactamente una dependencia controlada: %.',
      v_count;
  END IF;
END;
$fixture_empresa_dependencia$;

SET LOCAL ROLE authenticated;

-- Cobertura defensiva completa del unico wrapper destructivo. La empresa
-- vacia se elimina al final y reaparece al cerrar la transaccion con ROLLBACK.

RESET ROLE;

ROLLBACK;
