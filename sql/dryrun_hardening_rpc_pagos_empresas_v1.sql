
-- Hardening RPC pagos y empresas V1.
-- Delta one-shot: exige el estado remoto exacto auditado y falla cerrado.
-- Produccion continua NO-GO hasta ejecutar preflight, dry-run, pruebas y postflight
-- en un proyecto Supabase aislado con snapshot reconciliado.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL idle_in_transaction_session_timeout = '5min';

DO $precondition$
DECLARE
  v_expected record;
  v_proc record;
  v_oid oid;
  v_bad text;
  v_role name;
  v_actual_type oid;
  v_acl record;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation')
       IS DISTINCT FROM 'read committed' THEN
    RAISE EXCEPTION
      'La migracion exige transaction_isolation=read committed para el cutover.';
  END IF;

  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'control-contable:hardening-rpc-pagos-empresas-v1',
      0
    )
  ) THEN
    RAISE EXCEPTION
      'Otra sesion esta ejecutando hardening-rpc-pagos-empresas-v1.';
  END IF;

  FOREACH v_role IN ARRAY ARRAY[
    'anon'::name,
    'authenticated'::name,
    'service_role'::name,
    'authenticator'::name
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles r
      WHERE r.rolname = v_role
    ) THEN
      RAISE EXCEPTION 'Falta el rol requerido: %.', v_role;
    END IF;
  END LOOP;

  IF CURRENT_USER IN (
    'anon',
    'authenticated',
    'service_role',
    'authenticator'
  ) THEN
    RAISE EXCEPTION
      'El ejecutor de la migracion no puede ser un rol API: %.',
      CURRENT_USER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles r
    WHERE r.rolname = CURRENT_USER
      AND (r.rolsuper OR r.rolbypassrls)
  ) THEN
    RAISE EXCEPTION
      'El ejecutor debe ser superuser o BYPASSRLS para fijar definers seguros.';
  END IF;

  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL
     OR pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('auth.uid()')
     ) <> 'uuid' THEN
    RAISE EXCEPTION 'Falta auth.uid() con retorno uuid.';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    CURRENT_USER,
    pg_catalog.to_regprocedure('auth.uid()'),
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'El ejecutor no puede invocar auth.uid().';
  END IF;

  IF NOT pg_catalog.has_schema_privilege(
    CURRENT_USER,
    'auth',
    'USAGE'
  ) THEN
    RAISE EXCEPTION
      'El ejecutor no tiene USAGE sobre el esquema auth.';
  END IF;

  IF NOT pg_catalog.has_schema_privilege(
       'authenticated',
       'auth',
       'USAGE'
     )
     OR pg_catalog.has_function_privilege(
       'authenticated',
       pg_catalog.to_regprocedure('auth.uid()'),
       'EXECUTE'
     ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'authenticated no puede resolver auth.uid() para evaluar RLS.';
  END IF;

  IF pg_catalog.to_regclass('public.empresas') IS NULL
     OR pg_catalog.to_regclass('public.perfiles') IS NULL
     OR pg_catalog.to_regclass('public.modulos_sistema') IS NULL
     OR pg_catalog.to_regclass('public.usuario_modulos') IS NULL
     OR pg_catalog.to_regclass('public.usuario_empresas') IS NULL
     OR pg_catalog.to_regclass(
       'public.usuario_funciones_operativas'
     ) IS NULL
     OR pg_catalog.to_regclass('public.intentos_bloqueados') IS NULL
     OR pg_catalog.to_regclass(
       'public.idempotency_keys_operativas'
     ) IS NULL
     OR pg_catalog.to_regclass('public.auditoria_eventos') IS NULL
     OR pg_catalog.to_regclass('public.cuentas_por_cobrar') IS NULL
     OR pg_catalog.to_regclass(
       'public.pagos_cuentas_por_cobrar'
     ) IS NULL
     OR pg_catalog.to_regclass('public.cuentas_por_pagar') IS NULL
     OR pg_catalog.to_regclass(
       'public.pagos_cuentas_por_pagar'
     ) IS NULL THEN
    RAISE EXCEPTION
      'Faltan una o mas tablas requeridas por los RPC auditados.';
  END IF;

  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('empresas', 'id', 'bigint'),
        ('empresas', 'nombre', 'text'),
        ('empresas', 'razon_social', 'text'),
        ('empresas', 'nombre_comercial', 'text'),
        ('empresas', 'estado', 'text'),
        ('perfiles', 'id', 'uuid'),
        ('perfiles', 'nombre', 'text'),
        ('perfiles', 'rol', 'text'),
        ('perfiles', 'activo', 'boolean'),
        ('modulos_sistema', 'clave', 'text'),
        ('modulos_sistema', 'activo', 'boolean'),
        ('usuario_modulos', 'usuario_id', 'uuid'),
        ('usuario_modulos', 'modulo_clave', 'text'),
        ('usuario_modulos', 'activo', 'boolean'),
        ('usuario_empresas', 'usuario_id', 'uuid'),
        ('usuario_empresas', 'empresa_id', 'bigint'),
        ('usuario_empresas', 'activo', 'boolean'),
        ('usuario_funciones_operativas', 'usuario_id', 'uuid'),
        ('usuario_funciones_operativas', 'empresa_id', 'bigint'),
        ('usuario_funciones_operativas', 'funcion', 'text'),
        ('usuario_funciones_operativas', 'activo', 'boolean'),
        ('intentos_bloqueados', 'usuario_id', 'uuid'),
        ('intentos_bloqueados', 'empresa_id', 'bigint'),
        ('intentos_bloqueados', 'modulo', 'text'),
        ('intentos_bloqueados', 'accion', 'text'),
        ('intentos_bloqueados', 'motivo', 'text'),
        ('intentos_bloqueados', 'severidad', 'text'),
        ('intentos_bloqueados', 'entidad_tipo', 'text'),
        ('intentos_bloqueados', 'entidad_id', 'text'),
        ('intentos_bloqueados', 'mensaje', 'text'),
        ('intentos_bloqueados', 'metadatos', 'jsonb'),
        ('idempotency_keys_operativas', 'idempotency_key', 'text'),
        ('idempotency_keys_operativas', 'usuario_id', 'uuid'),
        ('idempotency_keys_operativas', 'empresa_id', 'bigint'),
        ('idempotency_keys_operativas', 'modulo', 'text'),
        ('idempotency_keys_operativas', 'accion', 'text'),
        ('idempotency_keys_operativas', 'estado', 'text'),
        ('idempotency_keys_operativas', 'expira_at', 'timestamptz'),
        ('idempotency_keys_operativas', 'actualizado_at', 'timestamptz'),
        ('idempotency_keys_operativas', 'request_hash', 'text'),
        ('idempotency_keys_operativas', 'resultado_resumen', 'jsonb'),
        ('idempotency_keys_operativas', 'id', 'uuid'),
        ('idempotency_keys_operativas', 'entidad_tipo', 'text'),
        ('idempotency_keys_operativas', 'entidad_id', 'text'),
        ('idempotency_keys_operativas', 'error_resumen', 'text'),
        ('cuentas_por_cobrar', 'id', NULL::text),
        ('cuentas_por_cobrar', 'empresa_id', 'bigint'),
        ('cuentas_por_cobrar', 'cliente_id', NULL::text),
        ('cuentas_por_cobrar', 'estado', 'text'),
        ('cuentas_por_cobrar', 'moneda', 'text'),
        ('cuentas_por_cobrar', 'saldo_pendiente', 'numeric'),
        ('cuentas_por_cobrar', 'total', 'numeric'),
        ('cuentas_por_cobrar', 'actualizado_at', 'timestamptz'),
        ('cuentas_por_cobrar', 'actualizado_por', 'uuid'),
        ('pagos_cuentas_por_cobrar', 'id', NULL::text),
        ('pagos_cuentas_por_cobrar', 'cuenta_por_cobrar_id', NULL::text),
        ('pagos_cuentas_por_cobrar', 'empresa_id', 'bigint'),
        ('pagos_cuentas_por_cobrar', 'cliente_id', NULL::text),
        ('pagos_cuentas_por_cobrar', 'fecha_pago', 'date'),
        ('pagos_cuentas_por_cobrar', 'metodo_pago', 'text'),
        ('pagos_cuentas_por_cobrar', 'banco', 'text'),
        ('pagos_cuentas_por_cobrar', 'referencia', 'text'),
        ('pagos_cuentas_por_cobrar', 'moneda', 'text'),
        ('pagos_cuentas_por_cobrar', 'monto', 'numeric'),
        ('pagos_cuentas_por_cobrar', 'observaciones', 'text'),
        ('pagos_cuentas_por_cobrar', 'estado', 'text'),
        ('pagos_cuentas_por_cobrar', 'creado_por', 'uuid'),
        ('pagos_cuentas_por_cobrar', 'metadatos', 'jsonb'),
        ('pagos_cuentas_por_cobrar', 'anulado_por', 'uuid'),
        ('pagos_cuentas_por_cobrar', 'anulado_at', 'timestamptz'),
        ('pagos_cuentas_por_cobrar', 'motivo_anulacion', 'text'),
        ('cuentas_por_pagar', 'id', NULL::text),
        ('cuentas_por_pagar', 'empresa_id', 'bigint'),
        ('cuentas_por_pagar', 'proveedor_id', NULL::text),
        ('cuentas_por_pagar', 'estado', 'text'),
        ('cuentas_por_pagar', 'moneda', 'text'),
        ('cuentas_por_pagar', 'saldo_pendiente', 'numeric'),
        ('cuentas_por_pagar', 'total', 'numeric'),
        ('cuentas_por_pagar', 'actualizado_at', 'timestamptz'),
        ('cuentas_por_pagar', 'actualizado_por', 'uuid'),
        ('pagos_cuentas_por_pagar', 'id', NULL::text),
        ('pagos_cuentas_por_pagar', 'cuenta_por_pagar_id', NULL::text),
        ('pagos_cuentas_por_pagar', 'empresa_id', 'bigint'),
        ('pagos_cuentas_por_pagar', 'proveedor_id', NULL::text),
        ('pagos_cuentas_por_pagar', 'fecha_pago', 'date'),
        ('pagos_cuentas_por_pagar', 'metodo_pago', 'text'),
        ('pagos_cuentas_por_pagar', 'banco', 'text'),
        ('pagos_cuentas_por_pagar', 'referencia', 'text'),
        ('pagos_cuentas_por_pagar', 'moneda', 'text'),
        ('pagos_cuentas_por_pagar', 'monto', 'numeric'),
        ('pagos_cuentas_por_pagar', 'observaciones', 'text'),
        ('pagos_cuentas_por_pagar', 'estado', 'text'),
        ('pagos_cuentas_por_pagar', 'creado_por', 'uuid'),
        ('pagos_cuentas_por_pagar', 'metadatos', 'jsonb'),
        ('pagos_cuentas_por_pagar', 'anulado_por', 'uuid'),
        ('pagos_cuentas_por_pagar', 'anulado_at', 'timestamptz'),
        ('pagos_cuentas_por_pagar', 'motivo_anulacion', 'text'),
        ('auditoria_eventos', 'usuario_id', 'uuid'),
        ('auditoria_eventos', 'usuario_nombre_snapshot', 'text'),
        ('auditoria_eventos', 'empresa_id', 'bigint'),
        ('auditoria_eventos', 'modulo', 'text'),
        ('auditoria_eventos', 'accion', 'text'),
        ('auditoria_eventos', 'entidad_tipo', 'text'),
        ('auditoria_eventos', 'entidad_id', NULL::text),
        ('auditoria_eventos', 'estado_anterior', 'text'),
        ('auditoria_eventos', 'estado_nuevo', 'text'),
        ('auditoria_eventos', 'descripcion', 'text'),
        ('auditoria_eventos', 'sensible', 'boolean'),
        ('auditoria_eventos', 'metadatos', 'jsonb'),
        ('auditoria_eventos', 'origen', 'text')
    ) AS required(table_name, column_name, type_name)
  LOOP
    SELECT a.atttypid
      INTO v_actual_type
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attname = v_expected.column_name
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF NOT FOUND
       OR (
         v_expected.type_name IS NOT NULL
         AND v_actual_type <> v_expected.type_name::pg_catalog.regtype
       ) THEN
      RAISE EXCEPTION
        'Columna requerida ausente o con tipo inesperado: public.%.% (%).',
        v_expected.table_name,
        v_expected.column_name,
        COALESCE(v_expected.type_name, 'tipo relacional auditado');
    END IF;
  END LOOP;

  -- Los cores comparan/asignan estas claves sin casts de dominio. Validar la
  -- igualdad exacta evita que un prosrc historico compile pero falle al entrar
  -- por una ruta de pago despues de una deriva de esquema.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'cuentas_por_cobrar', 'id',
          'pagos_cuentas_por_cobrar', 'cuenta_por_cobrar_id'
        ),
        (
          'cuentas_por_cobrar', 'cliente_id',
          'pagos_cuentas_por_cobrar', 'cliente_id'
        ),
        (
          'cuentas_por_pagar', 'id',
          'pagos_cuentas_por_pagar', 'cuenta_por_pagar_id'
        ),
        (
          'cuentas_por_pagar', 'proveedor_id',
          'pagos_cuentas_por_pagar', 'proveedor_id'
        )
    ) AS related(
      left_table,
      left_column,
      right_table,
      right_column
    )
  LOOP
    SELECT left_attribute.atttypid, right_attribute.atttypid
      INTO v_oid, v_actual_type
    FROM pg_catalog.pg_attribute left_attribute
    JOIN pg_catalog.pg_attribute right_attribute
      ON right_attribute.attrelid = pg_catalog.to_regclass(
           pg_catalog.format('public.%I', v_expected.right_table)
         )
     AND right_attribute.attname = v_expected.right_column
     AND right_attribute.attnum > 0
     AND NOT right_attribute.attisdropped
    WHERE left_attribute.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.left_table)
      )
      AND left_attribute.attname = v_expected.left_column
      AND left_attribute.attnum > 0
      AND NOT left_attribute.attisdropped;

    IF NOT FOUND OR v_oid <> v_actual_type THEN
      RAISE EXCEPTION
        'Tipos incompatibles entre public.%.% y public.%.%.',
        v_expected.left_table,
        v_expected.left_column,
        v_expected.right_table,
        v_expected.right_column;
    END IF;
  END LOOP;

  -- Toda columna NOT NULL omitida por alguno de los INSERT de los cores debe
  -- resolverse mediante DEFAULT, identidad o generacion. Las listas son la
  -- interseccion de columnas suministradas por todas las rutas de cada tabla.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'intentos_bloqueados',
          ARRAY[
            'usuario_id', 'empresa_id', 'modulo', 'accion', 'motivo',
            'severidad', 'entidad_tipo', 'entidad_id', 'mensaje', 'metadatos'
          ]::text[]
        ),
        (
          'idempotency_keys_operativas',
          ARRAY[
            'expira_at', 'idempotency_key', 'usuario_id', 'empresa_id',
            'modulo', 'accion', 'estado', 'request_hash', 'entidad_tipo'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_cobrar',
          ARRAY[
            'cuenta_por_cobrar_id', 'empresa_id', 'cliente_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_pagar',
          ARRAY[
            'cuenta_por_pagar_id', 'empresa_id', 'proveedor_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'auditoria_eventos',
          ARRAY[
            'usuario_id', 'usuario_nombre_snapshot', 'empresa_id', 'modulo',
            'accion', 'entidad_tipo', 'entidad_id', 'estado_anterior',
            'descripcion', 'sensible', 'metadatos', 'origen'
          ]::text[]
        )
    ) AS insert_contract(table_name, common_supplied_columns)
  LOOP
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attnum)
      INTO v_bad
    FROM pg_catalog.pg_attribute a
    LEFT JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid
     AND d.adnum = a.attnum
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
      AND d.oid IS NULL
      AND a.attidentity = ''
      AND a.attgenerated = ''
      AND NOT (a.attname = ANY (v_expected.common_supplied_columns));

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'public.% tiene columnas NOT NULL omitidas sin default: %.',
        v_expected.table_name,
        v_bad;
    END IF;

    SELECT pg_catalog.string_agg(
             unsafe_default.function_name,
             ', ' ORDER BY unsafe_default.function_name
           )
      INTO v_bad
    FROM (
      SELECT DISTINCT
        p.oid::pg_catalog.regprocedure::text AS function_name
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid
       AND d.adnum = a.attnum
      JOIN pg_catalog.pg_depend dependency
        ON dependency.classid = 'pg_catalog.pg_attrdef'::pg_catalog.regclass
       AND dependency.objid = d.oid
       AND dependency.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
      JOIN pg_catalog.pg_proc p
        ON p.oid = dependency.refobjid
      JOIN pg_catalog.pg_namespace n
        ON n.oid = p.pronamespace
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND NOT (a.attname = ANY (v_expected.common_supplied_columns))
        AND (
          pg_catalog.has_schema_privilege(
            CURRENT_USER,
            n.oid,
            'USAGE'
          ) IS DISTINCT FROM true
          OR pg_catalog.has_function_privilege(
            CURRENT_USER,
            p.oid,
            'EXECUTE'
          ) IS DISTINCT FROM true
        )
    ) unsafe_default;

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'Defaults de public.% invocan funciones inaccesibles: %.',
        v_expected.table_name,
        v_bad;
    END IF;

    SELECT pg_catalog.string_agg(
             unsafe_sequence.sequence_name,
             ', ' ORDER BY unsafe_sequence.sequence_name
           )
      INTO v_bad
    FROM (
      SELECT DISTINCT pg_catalog.format(
        '%I.%I',
        sequence_namespace.nspname,
        sequence_class.relname
      ) AS sequence_name
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid
       AND d.adnum = a.attnum
      CROSS JOIN LATERAL (
        SELECT dependency.refobjid AS sequence_oid
        FROM pg_catalog.pg_depend dependency
        JOIN pg_catalog.pg_class dependency_class
          ON dependency_class.oid = dependency.refobjid
         AND dependency_class.relkind = 'S'
        WHERE d.oid IS NOT NULL
          AND dependency.classid =
              'pg_catalog.pg_attrdef'::pg_catalog.regclass
          AND dependency.objid = d.oid
          AND dependency.refclassid =
              'pg_catalog.pg_class'::pg_catalog.regclass

        UNION

        SELECT pg_catalog.to_regclass(
          pg_catalog.pg_get_serial_sequence(
            pg_catalog.format('public.%I', v_expected.table_name),
            a.attname
          )
        ) AS sequence_oid
        WHERE pg_catalog.pg_get_serial_sequence(
          pg_catalog.format('public.%I', v_expected.table_name),
          a.attname
        ) IS NOT NULL
      ) sequence_dependency
      JOIN pg_catalog.pg_class sequence_class
        ON sequence_class.oid = sequence_dependency.sequence_oid
       AND sequence_class.relkind = 'S'
      JOIN pg_catalog.pg_namespace sequence_namespace
        ON sequence_namespace.oid = sequence_class.relnamespace
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND NOT (a.attname = ANY (v_expected.common_supplied_columns))
        AND (
          pg_catalog.has_schema_privilege(
            CURRENT_USER,
            sequence_namespace.oid,
            'USAGE'
          ) IS DISTINCT FROM true
          OR (
            pg_catalog.has_sequence_privilege(
              CURRENT_USER,
              sequence_class.oid,
              'USAGE'
            ) IS DISTINCT FROM true
            AND pg_catalog.has_sequence_privilege(
              CURRENT_USER,
              sequence_class.oid,
              'UPDATE'
            ) IS DISTINCT FROM true
          )
        )
    ) unsafe_sequence;

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'Defaults de public.% usan secuencias inaccesibles: %.',
        v_expected.table_name,
        v_bad;
    END IF;
  END LOOP;

  -- Ninguna columna que los cores suministran explicitamente puede ser una
  -- columna generada ni una identidad ALWAYS.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'intentos_bloqueados',
          ARRAY[
            'usuario_id', 'empresa_id', 'modulo', 'accion', 'motivo',
            'severidad', 'entidad_tipo', 'entidad_id', 'mensaje', 'metadatos'
          ]::text[]
        ),
        (
          'idempotency_keys_operativas',
          ARRAY[
            'expira_at', 'idempotency_key', 'usuario_id', 'empresa_id',
            'modulo', 'accion', 'estado', 'request_hash', 'entidad_tipo',
            'entidad_id'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_cobrar',
          ARRAY[
            'cuenta_por_cobrar_id', 'empresa_id', 'cliente_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_pagar',
          ARRAY[
            'cuenta_por_pagar_id', 'empresa_id', 'proveedor_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'auditoria_eventos',
          ARRAY[
            'usuario_id', 'usuario_nombre_snapshot', 'empresa_id', 'modulo',
            'accion', 'entidad_tipo', 'entidad_id', 'estado_anterior',
            'estado_nuevo', 'descripcion', 'sensible', 'metadatos', 'origen'
          ]::text[]
        )
    ) AS insert_contract(table_name, supplied_columns)
  LOOP
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attnum)
      INTO v_bad
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname = ANY (v_expected.supplied_columns)
      AND (a.attgenerated <> '' OR a.attidentity = 'a');

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'public.% genera o fuerza identidad en columnas suministradas: %.',
        v_expected.table_name,
        v_bad;
    END IF;
  END LOOP;

  -- Los targets escritos por UPDATE tampoco pueden convertirse en columnas
  -- generadas o identidades ALWAYS sin romper rutas que PL/pgSQL compila tarde.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'idempotency_keys_operativas',
          ARRAY[
            'estado', 'entidad_tipo', 'entidad_id', 'resultado_resumen',
            'error_resumen', 'request_hash'
          ]::text[]
        ),
        (
          'cuentas_por_cobrar',
          ARRAY[
            'saldo_pendiente', 'estado', 'actualizado_at', 'actualizado_por'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_cobrar',
          ARRAY[
            'estado', 'anulado_por', 'anulado_at', 'motivo_anulacion'
          ]::text[]
        ),
        (
          'cuentas_por_pagar',
          ARRAY[
            'saldo_pendiente', 'estado', 'actualizado_at', 'actualizado_por'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_pagar',
          ARRAY[
            'estado', 'anulado_por', 'anulado_at', 'motivo_anulacion'
          ]::text[]
        )
    ) AS update_contract(table_name, updated_columns)
  LOOP
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attnum)
      INTO v_bad
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname = ANY (v_expected.updated_columns)
      AND (a.attgenerated <> '' OR a.attidentity = 'a');

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'public.% genera o fuerza identidad en columnas actualizadas: %.',
        v_expected.table_name,
        v_bad;
    END IF;
  END LOOP;

  -- Los identificadores usados para localizar o actualizar una sola fila deben
  -- ser NOT NULL y unicos. Los tres INSERT que omiten id requieren ademas un
  -- valor automatico; de otro modo el core puede devolver/actualizar un id NULL.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('empresas', 'id', false),
        ('perfiles', 'id', false),
        ('idempotency_keys_operativas', 'id', true),
        ('cuentas_por_cobrar', 'id', false),
        ('pagos_cuentas_por_cobrar', 'id', true),
        ('cuentas_por_pagar', 'id', false),
        ('pagos_cuentas_por_pagar', 'id', true)
    ) AS key_contract(table_name, column_name, requires_automatic_value)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid
       AND d.adnum = a.attnum
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND a.attname = v_expected.column_name
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attnotnull
        AND (
          NOT v_expected.requires_automatic_value
          OR d.oid IS NOT NULL
          OR a.attidentity <> ''
          OR a.attgenerated <> ''
        )
    ) THEN
      RAISE EXCEPTION
        'Identificador public.%.% no es NOT NULL o carece de generador.',
        v_expected.table_name,
        v_expected.column_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = i.indrelid
       AND a.attname = v_expected.column_name
       AND a.attnum > 0
       AND NOT a.attisdropped
      WHERE i.indrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indimmediate
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts = 1
        AND i.indkey[0] = a.attnum
    ) THEN
      RAISE EXCEPTION
        'Identificador public.%.% no tiene unicidad simple valida.',
        v_expected.table_name,
        v_expected.column_name;
    END IF;
  END LOOP;

  -- Estas columnas forman el namespace/estado de idempotencia. NULL introduce
  -- logica ternaria y podria dejar escapar filas reservadas del cutover.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('expira_at'),
        ('idempotency_key'),
        ('usuario_id'),
        ('modulo'),
        ('accion'),
        ('estado')
    ) AS required(column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid =
          'public.idempotency_keys_operativas'::pg_catalog.regclass
        AND a.attname = v_expected.column_name
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attnotnull
    ) THEN
      RAISE EXCEPTION
        'idempotency_keys_operativas.% debe ser NOT NULL.',
        v_expected.column_name;
    END IF;
  END LOOP;

  -- SECURITY DEFINER cambia la identidad efectiva, pero BYPASSRLS no concede
  -- ACL de tabla. Se prueba cada operacion que helpers y cores ejecutan.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('perfiles', 'SELECT'),
        ('perfiles', 'UPDATE'),
        ('modulos_sistema', 'SELECT'),
        ('modulos_sistema', 'UPDATE'),
        ('usuario_modulos', 'SELECT'),
        ('usuario_modulos', 'UPDATE'),
        ('usuario_empresas', 'SELECT'),
        ('usuario_empresas', 'UPDATE'),
        ('usuario_funciones_operativas', 'SELECT'),
        ('usuario_funciones_operativas', 'UPDATE'),
        ('intentos_bloqueados', 'INSERT'),
        ('auditoria_eventos', 'INSERT'),
        ('empresas', 'SELECT'),
        ('empresas', 'UPDATE'),
        ('empresas', 'DELETE'),
        ('idempotency_keys_operativas', 'SELECT'),
        ('idempotency_keys_operativas', 'INSERT'),
        ('idempotency_keys_operativas', 'UPDATE'),
        ('cuentas_por_cobrar', 'SELECT'),
        ('cuentas_por_cobrar', 'UPDATE'),
        ('pagos_cuentas_por_cobrar', 'SELECT'),
        ('pagos_cuentas_por_cobrar', 'INSERT'),
        ('pagos_cuentas_por_cobrar', 'UPDATE'),
        ('cuentas_por_pagar', 'SELECT'),
        ('cuentas_por_pagar', 'UPDATE'),
        ('pagos_cuentas_por_pagar', 'SELECT'),
        ('pagos_cuentas_por_pagar', 'INSERT'),
        ('pagos_cuentas_por_pagar', 'UPDATE')
    ) AS required(table_name, privilege_name)
  LOOP
    IF NOT pg_catalog.has_table_privilege(
      CURRENT_USER,
      pg_catalog.format('public.%I', v_expected.table_name),
      v_expected.privilege_name
    ) THEN
      RAISE EXCEPTION
        'El owner SECURITY DEFINER carece de % sobre public.%.',
        v_expected.privilege_name,
        v_expected.table_name;
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_schema_privilege(
       CURRENT_USER,
       'information_schema',
       'USAGE'
     )
     OR NOT pg_catalog.has_table_privilege(
       CURRENT_USER,
       'information_schema.columns',
       'SELECT'
     ) THEN
    RAISE EXCEPTION
      'El core de empresas no puede consultar information_schema.columns.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    WHERE c.oid = 'public.empresas'::pg_catalog.regclass
      AND c.relowner = CURRENT_USER::pg_catalog.regrole
      AND c.relkind = 'r'
      AND NOT c.relispartition
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_inherits i
        WHERE i.inhrelid = c.oid
           OR i.inhparent = c.oid
      )
  ) THEN
    RAISE EXCEPTION
      'empresas debe ser tabla raiz ordinaria y pertenecer directamente al ejecutor.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    WHERE c.oid =
        'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND c.relowner = CURRENT_USER::pg_catalog.regrole
      AND c.relkind = 'r'
      AND NOT c.relispartition
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_inherits i
        WHERE i.inhrelid = c.oid
           OR i.inhparent = c.oid
      )
  ) THEN
    RAISE EXCEPTION
      'idempotency_keys_operativas debe ser tabla raiz ordinaria del ejecutor.';
  END IF;

  FOR v_expected IN
    SELECT required.table_name
    FROM (
      VALUES
        ('pagos_cuentas_por_cobrar'),
        ('pagos_cuentas_por_pagar')
    ) AS required(table_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      WHERE c.oid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND c.relowner = CURRENT_USER::pg_catalog.regrole
        AND c.relkind = 'r'
        AND NOT c.relispartition
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_inherits i
          WHERE i.inhrelid = c.oid
             OR i.inhparent = c.oid
        )
    ) THEN
      RAISE EXCEPTION
        'public.% debe ser tabla raiz ordinaria del ejecutor para cerrar su ACL.',
        v_expected.table_name;
    END IF;
  END LOOP;

END;
$precondition$;

-- Sentencia top-level: en READ COMMITTED, el DO siguiente obtiene un snapshot
-- posterior al lock y ve cualquier writer que haya terminado antes de cederlo.
-- ACCESS EXCLUSIVE espera llamadas legacy que ya tocaron idempotencia y evita
-- que otras entren a esa tabla durante el corte. No sustituye detener trafico y
-- drenar TODAS las RPC legacy antes de BEGIN: una llamada cuyo cuerpo ya fue
-- resuelto podria continuar despues del COMMIT. lock_timeout=5s hace fail-closed.
LOCK TABLE public.idempotency_keys_operativas
  IN ACCESS EXCLUSIVE MODE;

DO $idempotency_cutover$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.idempotency_keys_operativas i
    WHERE (
      i.accion IN (
        'registrar_pago_cxc',
        'registrar_pago_cxp',
        'anular_pago_cxc',
        'anular_pago_cxp'
      )
      OR i.idempotency_key LIKE 'cxc-%'
      OR i.idempotency_key LIKE 'cxp-%'
    )
      AND (
        i.expira_at IS NULL
        OR i.request_hash IS NULL
        OR i.idempotency_key IS NULL
        OR i.usuario_id IS NULL
        OR i.empresa_id IS NULL
        OR i.modulo IS NULL
        OR i.accion IS NULL
        OR i.estado IS NULL
        OR pg_catalog.char_length(i.idempotency_key) > 200
        OR i.estado NOT IN ('completada', 'fallida', 'expirada')
        OR i.expira_at > pg_catalog.statement_timestamp()
        OR NOT (
          (
            i.accion IN ('registrar_pago_cxc', 'anular_pago_cxc')
            AND i.modulo = 'cuentas-cobrar'
            AND i.idempotency_key LIKE 'cxc-%'
          ) OR (
            i.accion IN ('registrar_pago_cxp', 'anular_pago_cxp')
            AND i.modulo = 'cuentas-pagar'
            AND i.idempotency_key LIKE 'cxp-%'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION
      'Hay idempotencias legacy activas o no verificables; drenar y reconciliar antes del hardening.';
  END IF;
END;
$idempotency_cutover$;

-- El frontend solo lee las tablas de pagos y escribe por los cuatro wrappers.
-- Se retiran tanto ACL de tabla como grants historicos por columna; SELECT se
-- conserva. service_role queda tambien fuera de esta ruta mutable deliberadamente.
DO $pagos_acl$
DECLARE
  v_table name;
  v_columns text;
  v_grantee text;
  v_grantee_sql text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'pagos_cuentas_por_cobrar'::name,
    'pagos_cuentas_por_pagar'::name
  ]
  LOOP
    SELECT pg_catalog.string_agg(
             pg_catalog.format('%I', a.attname),
             ', ' ORDER BY a.attnum
           )
      INTO v_columns
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_table)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF v_columns IS NULL THEN
      RAISE EXCEPTION 'public.% no tiene columnas auditables.', v_table;
    END IF;

    FOREACH v_grantee IN ARRAY ARRAY[
      'PUBLIC',
      'anon',
      'authenticated',
      'service_role',
      'authenticator'
    ]
    LOOP
      v_grantee_sql := CASE
        WHEN v_grantee = 'PUBLIC' THEN 'PUBLIC'
        ELSE pg_catalog.format('%I', v_grantee)
      END;

      EXECUTE pg_catalog.format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON TABLE public.%I FROM %s',
        v_table,
        v_grantee_sql
      );
      EXECUTE pg_catalog.format(
        'REVOKE INSERT (%s), UPDATE (%s) ON TABLE public.%I FROM %s',
        v_columns,
        v_columns,
        v_table,
        v_grantee_sql
      );
    END LOOP;
  END LOOP;
END;
$pagos_acl$;

-- Matriz ACL final de idempotencia. PUBLIC, anon y authenticator quedan sin
-- privilegios; authenticated conserva solo SELECT/INSERT/UPDATE; service_role
-- conserva DELETE para mantenimiento controlado, pero no TRUNCATE/TRIGGER.
REVOKE ALL PRIVILEGES ON TABLE public.idempotency_keys_operativas
  FROM PUBLIC, anon, authenticator;
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES, MAINTAIN
  ON TABLE public.idempotency_keys_operativas
  FROM authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN
  ON TABLE public.idempotency_keys_operativas
  FROM service_role;

DO $idempotency_column_acl$
DECLARE
  v_columns text;
BEGIN
  SELECT pg_catalog.string_agg(
           pg_catalog.format('%I', a.attname),
           ', ' ORDER BY a.attnum
         )
    INTO v_columns
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_columns IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'REVOKE REFERENCES (%s) ON TABLE public.idempotency_keys_operativas FROM PUBLIC, anon, authenticator, authenticated, service_role',
      v_columns
    );
  END IF;
END;
$idempotency_column_acl$;

-- Defensa adicional frente a RPC SECURITY DEFINER genericos: aunque el rol API
-- no tenga privilegio de columna, tampoco puede cambiar el marcador a traves de
-- una funcion que escriba la fila completa. El owner conserva el alta gobernada.
-- Las policies restrictivas preservan los flujos directos de otros modulos,
-- pero reservan las acciones y prefijos de estos cuatro RPC al definer.
CREATE POLICY hardening_pagos_idempotency_insert_v1
ON public.idempotency_keys_operativas
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  accion NOT IN (
    'registrar_pago_cxc',
    'registrar_pago_cxp',
    'anular_pago_cxc',
    'anular_pago_cxp'
  )
  AND idempotency_key NOT LIKE 'cxc-%'
  AND idempotency_key NOT LIKE 'cxp-%'
);

CREATE POLICY hardening_pagos_idempotency_update_v1
ON public.idempotency_keys_operativas
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  accion NOT IN (
    'registrar_pago_cxc',
    'registrar_pago_cxp',
    'anular_pago_cxc',
    'anular_pago_cxp'
  )
  AND idempotency_key NOT LIKE 'cxc-%'
  AND idempotency_key NOT LIKE 'cxp-%'
)
WITH CHECK (
  accion NOT IN (
    'registrar_pago_cxc',
    'registrar_pago_cxp',
    'anular_pago_cxc',
    'anular_pago_cxp'
  )
  AND idempotency_key NOT LIKE 'cxc-%'
  AND idempotency_key NOT LIKE 'cxp-%'
);

-- RENAME conserva OID, cuerpo, defaults, owner y dependencias. El preflight
-- anterior exige cero dependientes; luego se fijan configuracion y ACL.
ALTER FUNCTION public.registrar_pago_cxc(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) RENAME TO registrar_pago_cxc_core_v1;

ALTER FUNCTION public.registrar_pago_cxp(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) RENAME TO registrar_pago_cxp_core_v1;

ALTER FUNCTION public.anular_pago_cxc(
  text, bigint, uuid, text, text
) RENAME TO anular_pago_cxc_core_v1;

ALTER FUNCTION public.anular_pago_cxp(
  text, bigint, uuid, text, text
) RENAME TO anular_pago_cxp_core_v1;


ALTER FUNCTION public.registrar_pago_cxc_core_v1(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.registrar_pago_cxc_core_v1(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) SET row_security = off;

ALTER FUNCTION public.registrar_pago_cxp_core_v1(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.registrar_pago_cxp_core_v1(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) SET row_security = off;

ALTER FUNCTION public.anular_pago_cxc_core_v1(
  text, bigint, uuid, text, text
) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.anular_pago_cxc_core_v1(
  text, bigint, uuid, text, text
) SET row_security = off;

ALTER FUNCTION public.anular_pago_cxp_core_v1(
  text, bigint, uuid, text, text
) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.anular_pago_cxp_core_v1(
  text, bigint, uuid, text, text
) SET row_security = off;

CREATE FUNCTION public.autorizar_rpc_escritura_empresa_v1(
  p_modulo text,
  p_empresa_id bigint,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_rol text;
BEGIN
  IF v_usuario_id IS NULL
     OR p_actor_id IS NULL
     OR v_usuario_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Sesion no valida para realizar la operacion.';
  END IF;

  IF p_empresa_id IS NULL OR p_empresa_id <= 0 THEN
    RAISE EXCEPTION 'Debe indicar una empresa valida.';
  END IF;

  IF p_modulo NOT IN ('cuentas-cobrar', 'cuentas-pagar') THEN
    RAISE EXCEPTION 'Modulo no permitido para este validador.';
  END IF;

  -- Los cuatro cores historicos comparan lower(coalesce(rol, '')) sin trim.
  -- Usar la misma regla impide que el helper conceda un bypass de admin que
  -- el core posterior rechazaria por falta de asignacion de empresa.
  SELECT pg_catalog.lower(COALESCE(p.rol, ''))
    INTO v_rol
  FROM public.perfiles p
  WHERE p.id = v_usuario_id
    AND p.activo IS TRUE
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El perfil del usuario no existe o esta inactivo.';
  END IF;

  IF v_rol NOT IN (
    'admin',
    'jefe',
    'supervisor',
    'contador',
    'auxiliar'
  ) THEN
    RAISE EXCEPTION 'El rol del usuario no permite operaciones de escritura.';
  END IF;

  PERFORM 1
  FROM public.modulos_sistema ms
  WHERE ms.clave = p_modulo
    AND ms.activo IS TRUE
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El modulo solicitado esta desactivado.';
  END IF;

  IF v_rol IS DISTINCT FROM 'admin' THEN
    PERFORM 1
    FROM public.usuario_modulos um
    WHERE um.usuario_id = v_usuario_id
      AND um.modulo_clave = p_modulo
      AND um.activo IS TRUE
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No tienes asignado el modulo solicitado.';
    END IF;

    PERFORM 1
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = v_usuario_id
      AND ue.empresa_id = p_empresa_id
      AND ue.activo IS TRUE
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No tienes permiso para operar esta empresa.';
    END IF;
  END IF;

  PERFORM 1
  FROM public.usuario_funciones_operativas ufo
  WHERE ufo.usuario_id = v_usuario_id
    AND ufo.empresa_id = p_empresa_id
    AND ufo.funcion = 'auditor_solo_lectura'
    AND ufo.activo IS TRUE
  FOR SHARE;

  IF FOUND THEN
    RAISE EXCEPTION
      'El usuario tiene acceso de solo lectura para esta empresa.';
  END IF;
END;
$function$;

CREATE FUNCTION public.anular_pago_cxc(
  p_pago_id text,
  p_empresa_id bigint,
  p_anulado_por uuid,
  p_motivo_anulacion text,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_clave text;
  v_hash text;
  v_hash_legacy text;
  v_idempotencia public.idempotency_keys_operativas%ROWTYPE;
  v_idempotencia_existia boolean := false;
  v_resultado jsonb;
BEGIN
  PERFORM public.autorizar_rpc_escritura_empresa_v1(
    'cuentas-cobrar',
    p_empresa_id,
    p_anulado_por
  );

  IF p_pago_id IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_pago_id, '')),
       ''
     ) IS NULL THEN
    RAISE EXCEPTION 'Debe indicar un pago CxC valido.';
  END IF;

  IF pg_catalog.char_length(
       pg_catalog.btrim(COALESCE(p_motivo_anulacion, ''))
     ) < 5 THEN
    RAISE EXCEPTION 'Debe indicar un motivo valido para anular el pago.';
  END IF;

  v_clave := NULLIF(
    pg_catalog.btrim(COALESCE(p_idempotency_key, '')),
    ''
  );

  IF v_clave IS NULL
     OR pg_catalog.char_length(v_clave) > 200
     OR v_clave NOT LIKE 'cxc-%' THEN
    RAISE EXCEPTION
      'Debe indicar una llave cxc- valida de hasta 200 caracteres.';
  END IF;

  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pago-idempotencia:' || v_clave,
      0
    )
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'operacion_en_proceso',
      'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
    );
  END IF;

  v_hash := pg_catalog.md5(
    pg_catalog.jsonb_build_array(
      'hardening-v1',
      'anular_pago_cxc',
      p_pago_id,
      p_empresa_id,
      p_anulado_por,
      p_motivo_anulacion
    )::text
  );
  v_hash_legacy := pg_catalog.md5(
    pg_catalog.concat_ws(
      '|',
      p_pago_id,
      p_empresa_id,
      pg_catalog.left(
        pg_catalog.btrim(
          COALESCE(p_motivo_anulacion, '')
        ),
        120
      )
    )
  );

  SELECT *
    INTO v_idempotencia
  FROM public.idempotency_keys_operativas i
  WHERE i.idempotency_key = v_clave
  FOR UPDATE;

  v_idempotencia_existia := FOUND;

  IF v_idempotencia_existia THEN
    IF v_idempotencia.usuario_id IS DISTINCT FROM p_anulado_por
       OR v_idempotencia.empresa_id IS DISTINCT FROM p_empresa_id
       OR v_idempotencia.modulo IS DISTINCT FROM 'cuentas-cobrar'
       OR v_idempotencia.accion IS DISTINCT FROM 'anular_pago_cxc' THEN
      RAISE EXCEPTION
        'La llave de idempotencia pertenece a otro alcance u operacion.';
    END IF;

    IF v_idempotencia.request_hash IS DISTINCT FROM v_hash THEN
      IF v_idempotencia.request_hash IS NOT DISTINCT FROM v_hash_legacy THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_legacy_no_verificable',
          'mensaje', 'La operacion historica permanece en proceso de conciliacion manual; no genere otra llave.'
        );
      END IF;

      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_payload_distinto',
        'mensaje', 'La llave de idempotencia ya fue usada con otra solicitud.'
      );
    END IF;
  END IF;

  v_resultado := public.anular_pago_cxc_core_v1(
    p_pago_id,
    p_empresa_id,
    p_anulado_por,
    p_motivo_anulacion,
    v_clave
  );

  IF NOT v_idempotencia_existia THEN
    UPDATE public.idempotency_keys_operativas i
    SET request_hash = v_hash
    WHERE i.idempotency_key = v_clave
      AND i.usuario_id = p_anulado_por
      AND i.empresa_id = p_empresa_id
      AND i.modulo = 'cuentas-cobrar'
      AND i.accion = 'anular_pago_cxc';
  END IF;

  RETURN v_resultado;
END;
$function$;

CREATE FUNCTION public.anular_pago_cxp(
  p_pago_id text,
  p_empresa_id bigint,
  p_anulado_por uuid,
  p_motivo_anulacion text,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_clave text;
  v_hash text;
  v_hash_legacy text;
  v_idempotencia public.idempotency_keys_operativas%ROWTYPE;
  v_idempotencia_existia boolean := false;
  v_resultado jsonb;
BEGIN
  PERFORM public.autorizar_rpc_escritura_empresa_v1(
    'cuentas-pagar',
    p_empresa_id,
    p_anulado_por
  );

  IF p_pago_id IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_pago_id, '')),
       ''
     ) IS NULL THEN
    RAISE EXCEPTION 'Debe indicar un pago CxP valido.';
  END IF;

  IF pg_catalog.char_length(
       pg_catalog.btrim(COALESCE(p_motivo_anulacion, ''))
     ) < 5 THEN
    RAISE EXCEPTION 'Debe indicar un motivo valido para anular el pago.';
  END IF;

  v_clave := NULLIF(
    pg_catalog.btrim(COALESCE(p_idempotency_key, '')),
    ''
  );

  IF v_clave IS NULL
     OR pg_catalog.char_length(v_clave) > 200
     OR v_clave NOT LIKE 'cxp-%' THEN
    RAISE EXCEPTION
      'Debe indicar una llave cxp- valida de hasta 200 caracteres.';
  END IF;

  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pago-idempotencia:' || v_clave,
      0
    )
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'operacion_en_proceso',
      'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
    );
  END IF;

  v_hash := pg_catalog.md5(
    pg_catalog.jsonb_build_array(
      'hardening-v1',
      'anular_pago_cxp',
      p_pago_id,
      p_empresa_id,
      p_anulado_por,
      p_motivo_anulacion
    )::text
  );
  v_hash_legacy := pg_catalog.md5(
    pg_catalog.concat_ws(
      '|',
      p_pago_id,
      p_empresa_id,
      pg_catalog.left(
        pg_catalog.btrim(
          COALESCE(p_motivo_anulacion, '')
        ),
        120
      )
    )
  );

  SELECT *
    INTO v_idempotencia
  FROM public.idempotency_keys_operativas i
  WHERE i.idempotency_key = v_clave
  FOR UPDATE;

  v_idempotencia_existia := FOUND;

  IF v_idempotencia_existia THEN
    IF v_idempotencia.usuario_id IS DISTINCT FROM p_anulado_por
       OR v_idempotencia.empresa_id IS DISTINCT FROM p_empresa_id
       OR v_idempotencia.modulo IS DISTINCT FROM 'cuentas-pagar'
       OR v_idempotencia.accion IS DISTINCT FROM 'anular_pago_cxp' THEN
      RAISE EXCEPTION
        'La llave de idempotencia pertenece a otro alcance u operacion.';
    END IF;

    IF v_idempotencia.request_hash IS DISTINCT FROM v_hash THEN
      IF v_idempotencia.request_hash IS NOT DISTINCT FROM v_hash_legacy THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_legacy_no_verificable',
          'mensaje', 'La operacion historica permanece en proceso de conciliacion manual; no genere otra llave.'
        );
      END IF;

      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_payload_distinto',
        'mensaje', 'La llave de idempotencia ya fue usada con otra solicitud.'
      );
    END IF;
  END IF;

  v_resultado := public.anular_pago_cxp_core_v1(
    p_pago_id,
    p_empresa_id,
    p_anulado_por,
    p_motivo_anulacion,
    v_clave
  );

  IF NOT v_idempotencia_existia THEN
    UPDATE public.idempotency_keys_operativas i
    SET request_hash = v_hash
    WHERE i.idempotency_key = v_clave
      AND i.usuario_id = p_anulado_por
      AND i.empresa_id = p_empresa_id
      AND i.modulo = 'cuentas-pagar'
      AND i.accion = 'anular_pago_cxp';
  END IF;

  RETURN v_resultado;
END;
$function$;

CREATE FUNCTION public.registrar_pago_cxc(
  p_cuenta_id text,
  p_empresa_id bigint,
  p_fecha_pago date,
  p_metodo_pago text,
  p_banco text,
  p_referencia text,
  p_moneda text,
  p_monto numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_clave text;
  v_hash text;
  v_hash_legacy text;
  v_idempotencia public.idempotency_keys_operativas%ROWTYPE;
  v_idempotencia_existia boolean := false;
  v_resultado jsonb;
BEGIN
  PERFORM public.autorizar_rpc_escritura_empresa_v1(
    'cuentas-cobrar',
    p_empresa_id,
    p_creado_por
  );

  IF p_cuenta_id IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_cuenta_id, '')),
       ''
     ) IS NULL THEN
    RAISE EXCEPTION 'Debe indicar una CxC valida.';
  END IF;

  IF p_fecha_pago IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_metodo_pago, '')),
       ''
     ) IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_moneda, '')),
       ''
     ) IS NULL
     OR p_monto IS NULL
     OR p_monto <= 0 THEN
    RAISE EXCEPTION 'Los datos obligatorios del pago CxC son invalidos.';
  END IF;

  v_clave := NULLIF(
    pg_catalog.btrim(COALESCE(p_idempotency_key, '')),
    ''
  );

  IF v_clave IS NULL
     OR pg_catalog.char_length(v_clave) > 200
     OR v_clave NOT LIKE 'cxc-%' THEN
    RAISE EXCEPTION
      'Debe indicar una llave cxc- valida de hasta 200 caracteres.';
  END IF;

  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pago-idempotencia:' || v_clave,
      0
    )
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'operacion_en_proceso',
      'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
    );
  END IF;

  v_hash := pg_catalog.md5(
    pg_catalog.jsonb_build_array(
      'hardening-v1',
      'registrar_pago_cxc',
      p_cuenta_id,
      p_empresa_id,
      p_fecha_pago,
      p_metodo_pago,
      p_banco,
      p_referencia,
      p_moneda,
      p_monto,
      p_observaciones,
      p_creado_por
    )::text
  );
  v_hash_legacy := pg_catalog.md5(
    pg_catalog.concat_ws(
      '|',
      p_cuenta_id,
      p_empresa_id,
      p_fecha_pago,
      p_metodo_pago,
      p_moneda,
      p_monto,
      COALESCE(p_referencia, '')
    )
  );

  SELECT *
    INTO v_idempotencia
  FROM public.idempotency_keys_operativas i
  WHERE i.idempotency_key = v_clave
  FOR UPDATE;

  v_idempotencia_existia := FOUND;

  IF v_idempotencia_existia THEN
    IF v_idempotencia.usuario_id IS DISTINCT FROM p_creado_por
       OR v_idempotencia.empresa_id IS DISTINCT FROM p_empresa_id
       OR v_idempotencia.modulo IS DISTINCT FROM 'cuentas-cobrar'
       OR v_idempotencia.accion IS DISTINCT FROM 'registrar_pago_cxc' THEN
      RAISE EXCEPTION
        'La llave de idempotencia pertenece a otro alcance u operacion.';
    END IF;

    IF v_idempotencia.request_hash IS DISTINCT FROM v_hash THEN
      IF v_idempotencia.request_hash IS NOT DISTINCT FROM v_hash_legacy THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_legacy_no_verificable',
          'mensaje', 'La operacion historica permanece en proceso de conciliacion manual; no genere otra llave.'
        );
      END IF;

      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_payload_distinto',
        'mensaje', 'La llave de idempotencia ya fue usada con otra solicitud.'
      );
    END IF;
  END IF;

  v_resultado := public.registrar_pago_cxc_core_v1(
    p_cuenta_id,
    p_empresa_id,
    p_fecha_pago,
    p_metodo_pago,
    p_banco,
    p_referencia,
    p_moneda,
    p_monto,
    p_observaciones,
    p_creado_por,
    v_clave
  );

  IF NOT v_idempotencia_existia THEN
    UPDATE public.idempotency_keys_operativas i
    SET request_hash = v_hash
    WHERE i.idempotency_key = v_clave
      AND i.usuario_id = p_creado_por
      AND i.empresa_id = p_empresa_id
      AND i.modulo = 'cuentas-cobrar'
      AND i.accion = 'registrar_pago_cxc';
  END IF;

  RETURN v_resultado;
END;
$function$;

CREATE FUNCTION public.registrar_pago_cxp(
  p_cuenta_id text,
  p_empresa_id bigint,
  p_fecha_pago date,
  p_metodo_pago text,
  p_banco text,
  p_referencia text,
  p_moneda text,
  p_monto numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = off
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_clave text;
  v_hash text;
  v_hash_legacy text;
  v_idempotencia public.idempotency_keys_operativas%ROWTYPE;
  v_idempotencia_existia boolean := false;
  v_resultado jsonb;
BEGIN
  PERFORM public.autorizar_rpc_escritura_empresa_v1(
    'cuentas-pagar',
    p_empresa_id,
    p_creado_por
  );

  IF p_cuenta_id IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_cuenta_id, '')),
       ''
     ) IS NULL THEN
    RAISE EXCEPTION 'Debe indicar una CxP valida.';
  END IF;

  IF p_fecha_pago IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_metodo_pago, '')),
       ''
     ) IS NULL
     OR NULLIF(
       pg_catalog.btrim(COALESCE(p_moneda, '')),
       ''
     ) IS NULL
     OR p_monto IS NULL
     OR p_monto <= 0 THEN
    RAISE EXCEPTION 'Los datos obligatorios del pago CxP son invalidos.';
  END IF;

  v_clave := NULLIF(
    pg_catalog.btrim(COALESCE(p_idempotency_key, '')),
    ''
  );

  IF v_clave IS NULL
     OR pg_catalog.char_length(v_clave) > 200
     OR v_clave NOT LIKE 'cxp-%' THEN
    RAISE EXCEPTION
      'Debe indicar una llave cxp- valida de hasta 200 caracteres.';
  END IF;

  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pago-idempotencia:' || v_clave,
      0
    )
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'operacion_en_proceso',
      'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
    );
  END IF;

  v_hash := pg_catalog.md5(
    pg_catalog.jsonb_build_array(
      'hardening-v1',
      'registrar_pago_cxp',
      p_cuenta_id,
      p_empresa_id,
      p_fecha_pago,
      p_metodo_pago,
      p_banco,
      p_referencia,
      p_moneda,
      p_monto,
      p_observaciones,
      p_creado_por
    )::text
  );
  v_hash_legacy := pg_catalog.md5(
    pg_catalog.concat_ws(
      '|',
      p_cuenta_id,
      p_empresa_id,
      p_fecha_pago,
      p_metodo_pago,
      p_moneda,
      p_monto,
      COALESCE(p_referencia, '')
    )
  );

  SELECT *
    INTO v_idempotencia
  FROM public.idempotency_keys_operativas i
  WHERE i.idempotency_key = v_clave
  FOR UPDATE;

  v_idempotencia_existia := FOUND;

  IF v_idempotencia_existia THEN
    IF v_idempotencia.usuario_id IS DISTINCT FROM p_creado_por
       OR v_idempotencia.empresa_id IS DISTINCT FROM p_empresa_id
       OR v_idempotencia.modulo IS DISTINCT FROM 'cuentas-pagar'
       OR v_idempotencia.accion IS DISTINCT FROM 'registrar_pago_cxp' THEN
      RAISE EXCEPTION
        'La llave de idempotencia pertenece a otro alcance u operacion.';
    END IF;

    IF v_idempotencia.request_hash IS DISTINCT FROM v_hash THEN
      IF v_idempotencia.request_hash IS NOT DISTINCT FROM v_hash_legacy THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_legacy_no_verificable',
          'mensaje', 'La operacion historica permanece en proceso de conciliacion manual; no genere otra llave.'
        );
      END IF;

      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_payload_distinto',
        'mensaje', 'La llave de idempotencia ya fue usada con otra solicitud.'
      );
    END IF;
  END IF;

  v_resultado := public.registrar_pago_cxp_core_v1(
    p_cuenta_id,
    p_empresa_id,
    p_fecha_pago,
    p_metodo_pago,
    p_banco,
    p_referencia,
    p_moneda,
    p_monto,
    p_observaciones,
    p_creado_por,
    v_clave
  );

  IF NOT v_idempotencia_existia THEN
    UPDATE public.idempotency_keys_operativas i
    SET request_hash = v_hash
    WHERE i.idempotency_key = v_clave
      AND i.usuario_id = p_creado_por
      AND i.empresa_id = p_empresa_id
      AND i.modulo = 'cuentas-pagar'
      AND i.accion = 'registrar_pago_cxp';
  END IF;

  RETURN v_resultado;
END;
$function$;

-- Elimina cualquier ACL directa heredada de ALTER DEFAULT PRIVILEGES y
-- cualquier grant residual conservado por RENAME. El owner se conserva.
DO $acl$
DECLARE
  v_target record;
  v_grantee record;
  v_signature text;
BEGIN
  FOR v_target IN
    SELECT
      p.oid,
      p.proowner,
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args,
      p.proacl
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'autorizar_rpc_escritura_empresa_v1',
        'registrar_pago_cxc',
        'registrar_pago_cxp',
        'anular_pago_cxc',
        'anular_pago_cxp',
        'registrar_pago_cxc_core_v1',
        'registrar_pago_cxp_core_v1',
        'anular_pago_cxc_core_v1',
        'anular_pago_cxp_core_v1'
      )
    ORDER BY p.proname
  LOOP
    v_signature := pg_catalog.format(
      '%I.%I(%s)',
      v_target.nspname,
      v_target.proname,
      v_target.identity_args
    );

    EXECUTE pg_catalog.format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC',
      v_signature
    );

    FOR v_grantee IN
      SELECT DISTINCT r.rolname
      FROM pg_catalog.aclexplode(
        COALESCE(
          v_target.proacl,
          pg_catalog.acldefault('f', v_target.proowner)
        )
      ) acl
      JOIN pg_catalog.pg_roles r
        ON r.oid = acl.grantee
      WHERE acl.grantee <> v_target.proowner
      ORDER BY r.rolname
    LOOP
      EXECUTE pg_catalog.format(
        'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I',
        v_signature,
        v_grantee.rolname
      );
    END LOOP;
  END LOOP;
END;
$acl$;

GRANT EXECUTE ON FUNCTION public.registrar_pago_cxc(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cxp(
  text, bigint, date, text, text, text, text, numeric, text, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_pago_cxc(
  text, bigint, uuid, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_pago_cxp(
  text, bigint, uuid, text, text
) TO authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.eliminar_empresa_vacia_segura(
  bigint, text
) FROM PUBLIC, anon, authenticated, service_role, authenticator;

DO $postcondition$
DECLARE
  v_expected record;
  v_proc record;
  v_normalized_source text;
  v_actual_source_md5_lf text;
  v_core_hash_diagnostics text := '';
  v_core_hash_mismatch boolean := false;
  v_oid oid;
  v_actual_type oid;
  v_bad text;
  v_role name;
BEGIN
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL
     OR pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('auth.uid()')
     ) <> 'uuid'
     OR NOT pg_catalog.has_schema_privilege(
       CURRENT_USER,
       'auth',
       'USAGE'
     )
     OR pg_catalog.has_function_privilege(
       CURRENT_USER,
       pg_catalog.to_regprocedure('auth.uid()'),
       'EXECUTE'
     ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Postcondicion: owner no puede resolver e invocar auth.uid().';
  END IF;

  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('empresas', 'id', 'bigint'),
        ('empresas', 'nombre', 'text'),
        ('empresas', 'razon_social', 'text'),
        ('empresas', 'nombre_comercial', 'text'),
        ('empresas', 'estado', 'text'),
        ('perfiles', 'id', 'uuid'),
        ('perfiles', 'nombre', 'text'),
        ('perfiles', 'rol', 'text'),
        ('perfiles', 'activo', 'boolean'),
        ('modulos_sistema', 'clave', 'text'),
        ('modulos_sistema', 'activo', 'boolean'),
        ('usuario_modulos', 'usuario_id', 'uuid'),
        ('usuario_modulos', 'modulo_clave', 'text'),
        ('usuario_modulos', 'activo', 'boolean'),
        ('usuario_empresas', 'usuario_id', 'uuid'),
        ('usuario_empresas', 'empresa_id', 'bigint'),
        ('usuario_empresas', 'activo', 'boolean'),
        ('usuario_funciones_operativas', 'usuario_id', 'uuid'),
        ('usuario_funciones_operativas', 'empresa_id', 'bigint'),
        ('usuario_funciones_operativas', 'funcion', 'text'),
        ('usuario_funciones_operativas', 'activo', 'boolean'),
        ('intentos_bloqueados', 'usuario_id', 'uuid'),
        ('intentos_bloqueados', 'empresa_id', 'bigint'),
        ('intentos_bloqueados', 'modulo', 'text'),
        ('intentos_bloqueados', 'accion', 'text'),
        ('intentos_bloqueados', 'motivo', 'text'),
        ('intentos_bloqueados', 'severidad', 'text'),
        ('intentos_bloqueados', 'entidad_tipo', 'text'),
        ('intentos_bloqueados', 'entidad_id', 'text'),
        ('intentos_bloqueados', 'mensaje', 'text'),
        ('intentos_bloqueados', 'metadatos', 'jsonb'),
        ('idempotency_keys_operativas', 'idempotency_key', 'text'),
        ('idempotency_keys_operativas', 'usuario_id', 'uuid'),
        ('idempotency_keys_operativas', 'empresa_id', 'bigint'),
        ('idempotency_keys_operativas', 'modulo', 'text'),
        ('idempotency_keys_operativas', 'accion', 'text'),
        ('idempotency_keys_operativas', 'estado', 'text'),
        ('idempotency_keys_operativas', 'expira_at', 'timestamptz'),
        ('idempotency_keys_operativas', 'actualizado_at', 'timestamptz'),
        ('idempotency_keys_operativas', 'request_hash', 'text'),
        ('idempotency_keys_operativas', 'resultado_resumen', 'jsonb'),
        ('idempotency_keys_operativas', 'id', 'uuid'),
        ('idempotency_keys_operativas', 'entidad_tipo', 'text'),
        ('idempotency_keys_operativas', 'entidad_id', 'text'),
        ('idempotency_keys_operativas', 'error_resumen', 'text'),
        ('cuentas_por_cobrar', 'id', NULL::text),
        ('cuentas_por_cobrar', 'empresa_id', 'bigint'),
        ('cuentas_por_cobrar', 'cliente_id', NULL::text),
        ('cuentas_por_cobrar', 'estado', 'text'),
        ('cuentas_por_cobrar', 'moneda', 'text'),
        ('cuentas_por_cobrar', 'saldo_pendiente', 'numeric'),
        ('cuentas_por_cobrar', 'total', 'numeric'),
        ('cuentas_por_cobrar', 'actualizado_at', 'timestamptz'),
        ('cuentas_por_cobrar', 'actualizado_por', 'uuid'),
        ('pagos_cuentas_por_cobrar', 'id', NULL::text),
        ('pagos_cuentas_por_cobrar', 'cuenta_por_cobrar_id', NULL::text),
        ('pagos_cuentas_por_cobrar', 'empresa_id', 'bigint'),
        ('pagos_cuentas_por_cobrar', 'cliente_id', NULL::text),
        ('pagos_cuentas_por_cobrar', 'fecha_pago', 'date'),
        ('pagos_cuentas_por_cobrar', 'metodo_pago', 'text'),
        ('pagos_cuentas_por_cobrar', 'banco', 'text'),
        ('pagos_cuentas_por_cobrar', 'referencia', 'text'),
        ('pagos_cuentas_por_cobrar', 'moneda', 'text'),
        ('pagos_cuentas_por_cobrar', 'monto', 'numeric'),
        ('pagos_cuentas_por_cobrar', 'observaciones', 'text'),
        ('pagos_cuentas_por_cobrar', 'estado', 'text'),
        ('pagos_cuentas_por_cobrar', 'creado_por', 'uuid'),
        ('pagos_cuentas_por_cobrar', 'metadatos', 'jsonb'),
        ('pagos_cuentas_por_cobrar', 'anulado_por', 'uuid'),
        ('pagos_cuentas_por_cobrar', 'anulado_at', 'timestamptz'),
        ('pagos_cuentas_por_cobrar', 'motivo_anulacion', 'text'),
        ('cuentas_por_pagar', 'id', NULL::text),
        ('cuentas_por_pagar', 'empresa_id', 'bigint'),
        ('cuentas_por_pagar', 'proveedor_id', NULL::text),
        ('cuentas_por_pagar', 'estado', 'text'),
        ('cuentas_por_pagar', 'moneda', 'text'),
        ('cuentas_por_pagar', 'saldo_pendiente', 'numeric'),
        ('cuentas_por_pagar', 'total', 'numeric'),
        ('cuentas_por_pagar', 'actualizado_at', 'timestamptz'),
        ('cuentas_por_pagar', 'actualizado_por', 'uuid'),
        ('pagos_cuentas_por_pagar', 'id', NULL::text),
        ('pagos_cuentas_por_pagar', 'cuenta_por_pagar_id', NULL::text),
        ('pagos_cuentas_por_pagar', 'empresa_id', 'bigint'),
        ('pagos_cuentas_por_pagar', 'proveedor_id', NULL::text),
        ('pagos_cuentas_por_pagar', 'fecha_pago', 'date'),
        ('pagos_cuentas_por_pagar', 'metodo_pago', 'text'),
        ('pagos_cuentas_por_pagar', 'banco', 'text'),
        ('pagos_cuentas_por_pagar', 'referencia', 'text'),
        ('pagos_cuentas_por_pagar', 'moneda', 'text'),
        ('pagos_cuentas_por_pagar', 'monto', 'numeric'),
        ('pagos_cuentas_por_pagar', 'observaciones', 'text'),
        ('pagos_cuentas_por_pagar', 'estado', 'text'),
        ('pagos_cuentas_por_pagar', 'creado_por', 'uuid'),
        ('pagos_cuentas_por_pagar', 'metadatos', 'jsonb'),
        ('pagos_cuentas_por_pagar', 'anulado_por', 'uuid'),
        ('pagos_cuentas_por_pagar', 'anulado_at', 'timestamptz'),
        ('pagos_cuentas_por_pagar', 'motivo_anulacion', 'text'),
        ('auditoria_eventos', 'usuario_id', 'uuid'),
        ('auditoria_eventos', 'usuario_nombre_snapshot', 'text'),
        ('auditoria_eventos', 'empresa_id', 'bigint'),
        ('auditoria_eventos', 'modulo', 'text'),
        ('auditoria_eventos', 'accion', 'text'),
        ('auditoria_eventos', 'entidad_tipo', 'text'),
        ('auditoria_eventos', 'entidad_id', NULL::text),
        ('auditoria_eventos', 'estado_anterior', 'text'),
        ('auditoria_eventos', 'estado_nuevo', 'text'),
        ('auditoria_eventos', 'descripcion', 'text'),
        ('auditoria_eventos', 'sensible', 'boolean'),
        ('auditoria_eventos', 'metadatos', 'jsonb'),
        ('auditoria_eventos', 'origen', 'text')
    ) AS required(table_name, column_name, type_name)
  LOOP
    SELECT a.atttypid
      INTO v_actual_type
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attname = v_expected.column_name
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF NOT FOUND
       OR (
         v_expected.type_name IS NOT NULL
         AND v_actual_type <> v_expected.type_name::pg_catalog.regtype
       ) THEN
      RAISE EXCEPTION
        'Columna requerida ausente o con tipo inesperado: public.%.% (%).',
        v_expected.table_name,
        v_expected.column_name,
        COALESCE(v_expected.type_name, 'tipo relacional auditado');
    END IF;
  END LOOP;

  -- Los cores comparan/asignan estas claves sin casts de dominio. Validar la
  -- igualdad exacta evita que un prosrc historico compile pero falle al entrar
  -- por una ruta de pago despues de una deriva de esquema.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'cuentas_por_cobrar', 'id',
          'pagos_cuentas_por_cobrar', 'cuenta_por_cobrar_id'
        ),
        (
          'cuentas_por_cobrar', 'cliente_id',
          'pagos_cuentas_por_cobrar', 'cliente_id'
        ),
        (
          'cuentas_por_pagar', 'id',
          'pagos_cuentas_por_pagar', 'cuenta_por_pagar_id'
        ),
        (
          'cuentas_por_pagar', 'proveedor_id',
          'pagos_cuentas_por_pagar', 'proveedor_id'
        )
    ) AS related(
      left_table,
      left_column,
      right_table,
      right_column
    )
  LOOP
    SELECT left_attribute.atttypid, right_attribute.atttypid
      INTO v_oid, v_actual_type
    FROM pg_catalog.pg_attribute left_attribute
    JOIN pg_catalog.pg_attribute right_attribute
      ON right_attribute.attrelid = pg_catalog.to_regclass(
           pg_catalog.format('public.%I', v_expected.right_table)
         )
     AND right_attribute.attname = v_expected.right_column
     AND right_attribute.attnum > 0
     AND NOT right_attribute.attisdropped
    WHERE left_attribute.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.left_table)
      )
      AND left_attribute.attname = v_expected.left_column
      AND left_attribute.attnum > 0
      AND NOT left_attribute.attisdropped;

    IF NOT FOUND OR v_oid <> v_actual_type THEN
      RAISE EXCEPTION
        'Tipos incompatibles entre public.%.% y public.%.%.',
        v_expected.left_table,
        v_expected.left_column,
        v_expected.right_table,
        v_expected.right_column;
    END IF;
  END LOOP;

  -- Toda columna NOT NULL omitida por alguno de los INSERT de los cores debe
  -- resolverse mediante DEFAULT, identidad o generacion. Las listas son la
  -- interseccion de columnas suministradas por todas las rutas de cada tabla.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'intentos_bloqueados',
          ARRAY[
            'usuario_id', 'empresa_id', 'modulo', 'accion', 'motivo',
            'severidad', 'entidad_tipo', 'entidad_id', 'mensaje', 'metadatos'
          ]::text[]
        ),
        (
          'idempotency_keys_operativas',
          ARRAY[
            'expira_at', 'idempotency_key', 'usuario_id', 'empresa_id',
            'modulo', 'accion', 'estado', 'request_hash', 'entidad_tipo'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_cobrar',
          ARRAY[
            'cuenta_por_cobrar_id', 'empresa_id', 'cliente_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_pagar',
          ARRAY[
            'cuenta_por_pagar_id', 'empresa_id', 'proveedor_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'auditoria_eventos',
          ARRAY[
            'usuario_id', 'usuario_nombre_snapshot', 'empresa_id', 'modulo',
            'accion', 'entidad_tipo', 'entidad_id', 'estado_anterior',
            'descripcion', 'sensible', 'metadatos', 'origen'
          ]::text[]
        )
    ) AS insert_contract(table_name, common_supplied_columns)
  LOOP
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attnum)
      INTO v_bad
    FROM pg_catalog.pg_attribute a
    LEFT JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid
     AND d.adnum = a.attnum
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
      AND d.oid IS NULL
      AND a.attidentity = ''
      AND a.attgenerated = ''
      AND NOT (a.attname = ANY (v_expected.common_supplied_columns));

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'public.% tiene columnas NOT NULL omitidas sin default: %.',
        v_expected.table_name,
        v_bad;
    END IF;

    SELECT pg_catalog.string_agg(
             unsafe_default.function_name,
             ', ' ORDER BY unsafe_default.function_name
           )
      INTO v_bad
    FROM (
      SELECT DISTINCT
        p.oid::pg_catalog.regprocedure::text AS function_name
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid
       AND d.adnum = a.attnum
      JOIN pg_catalog.pg_depend dependency
        ON dependency.classid = 'pg_catalog.pg_attrdef'::pg_catalog.regclass
       AND dependency.objid = d.oid
       AND dependency.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
      JOIN pg_catalog.pg_proc p
        ON p.oid = dependency.refobjid
      JOIN pg_catalog.pg_namespace n
        ON n.oid = p.pronamespace
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND NOT (a.attname = ANY (v_expected.common_supplied_columns))
        AND (
          pg_catalog.has_schema_privilege(
            CURRENT_USER,
            n.oid,
            'USAGE'
          ) IS DISTINCT FROM true
          OR pg_catalog.has_function_privilege(
            CURRENT_USER,
            p.oid,
            'EXECUTE'
          ) IS DISTINCT FROM true
        )
    ) unsafe_default;

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'Defaults de public.% invocan funciones inaccesibles: %.',
        v_expected.table_name,
        v_bad;
    END IF;

    SELECT pg_catalog.string_agg(
             unsafe_sequence.sequence_name,
             ', ' ORDER BY unsafe_sequence.sequence_name
           )
      INTO v_bad
    FROM (
      SELECT DISTINCT pg_catalog.format(
        '%I.%I',
        sequence_namespace.nspname,
        sequence_class.relname
      ) AS sequence_name
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid
       AND d.adnum = a.attnum
      CROSS JOIN LATERAL (
        SELECT dependency.refobjid AS sequence_oid
        FROM pg_catalog.pg_depend dependency
        JOIN pg_catalog.pg_class dependency_class
          ON dependency_class.oid = dependency.refobjid
         AND dependency_class.relkind = 'S'
        WHERE d.oid IS NOT NULL
          AND dependency.classid =
              'pg_catalog.pg_attrdef'::pg_catalog.regclass
          AND dependency.objid = d.oid
          AND dependency.refclassid =
              'pg_catalog.pg_class'::pg_catalog.regclass

        UNION

        SELECT pg_catalog.to_regclass(
          pg_catalog.pg_get_serial_sequence(
            pg_catalog.format('public.%I', v_expected.table_name),
            a.attname
          )
        ) AS sequence_oid
        WHERE pg_catalog.pg_get_serial_sequence(
          pg_catalog.format('public.%I', v_expected.table_name),
          a.attname
        ) IS NOT NULL
      ) sequence_dependency
      JOIN pg_catalog.pg_class sequence_class
        ON sequence_class.oid = sequence_dependency.sequence_oid
       AND sequence_class.relkind = 'S'
      JOIN pg_catalog.pg_namespace sequence_namespace
        ON sequence_namespace.oid = sequence_class.relnamespace
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND NOT (a.attname = ANY (v_expected.common_supplied_columns))
        AND (
          pg_catalog.has_schema_privilege(
            CURRENT_USER,
            sequence_namespace.oid,
            'USAGE'
          ) IS DISTINCT FROM true
          OR (
            pg_catalog.has_sequence_privilege(
              CURRENT_USER,
              sequence_class.oid,
              'USAGE'
            ) IS DISTINCT FROM true
            AND pg_catalog.has_sequence_privilege(
              CURRENT_USER,
              sequence_class.oid,
              'UPDATE'
            ) IS DISTINCT FROM true
          )
        )
    ) unsafe_sequence;

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'Defaults de public.% usan secuencias inaccesibles: %.',
        v_expected.table_name,
        v_bad;
    END IF;
  END LOOP;

  -- Ninguna columna que los cores suministran explicitamente puede ser una
  -- columna generada ni una identidad ALWAYS.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'intentos_bloqueados',
          ARRAY[
            'usuario_id', 'empresa_id', 'modulo', 'accion', 'motivo',
            'severidad', 'entidad_tipo', 'entidad_id', 'mensaje', 'metadatos'
          ]::text[]
        ),
        (
          'idempotency_keys_operativas',
          ARRAY[
            'expira_at', 'idempotency_key', 'usuario_id', 'empresa_id',
            'modulo', 'accion', 'estado', 'request_hash', 'entidad_tipo',
            'entidad_id'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_cobrar',
          ARRAY[
            'cuenta_por_cobrar_id', 'empresa_id', 'cliente_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_pagar',
          ARRAY[
            'cuenta_por_pagar_id', 'empresa_id', 'proveedor_id', 'fecha_pago',
            'metodo_pago', 'banco', 'referencia', 'moneda', 'monto',
            'observaciones', 'estado', 'creado_por', 'metadatos'
          ]::text[]
        ),
        (
          'auditoria_eventos',
          ARRAY[
            'usuario_id', 'usuario_nombre_snapshot', 'empresa_id', 'modulo',
            'accion', 'entidad_tipo', 'entidad_id', 'estado_anterior',
            'estado_nuevo', 'descripcion', 'sensible', 'metadatos', 'origen'
          ]::text[]
        )
    ) AS insert_contract(table_name, supplied_columns)
  LOOP
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attnum)
      INTO v_bad
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname = ANY (v_expected.supplied_columns)
      AND (a.attgenerated <> '' OR a.attidentity = 'a');

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'public.% genera o fuerza identidad en columnas suministradas: %.',
        v_expected.table_name,
        v_bad;
    END IF;
  END LOOP;


  -- Los identificadores usados para localizar o actualizar una sola fila deben
  -- ser NOT NULL y unicos. Los tres INSERT que omiten id requieren ademas un
  -- valor automatico; de otro modo el core puede devolver/actualizar un id NULL.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('empresas', 'id', false),
        ('perfiles', 'id', false),
        ('idempotency_keys_operativas', 'id', true),
        ('cuentas_por_cobrar', 'id', false),
        ('pagos_cuentas_por_cobrar', 'id', true),
        ('cuentas_por_pagar', 'id', false),
        ('pagos_cuentas_por_pagar', 'id', true)
    ) AS key_contract(table_name, column_name, requires_automatic_value)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid
       AND d.adnum = a.attnum
      WHERE a.attrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND a.attname = v_expected.column_name
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attnotnull
        AND (
          NOT v_expected.requires_automatic_value
          OR d.oid IS NOT NULL
          OR a.attidentity <> ''
          OR a.attgenerated <> ''
        )
    ) THEN
      RAISE EXCEPTION
        'Identificador public.%.% no es NOT NULL o carece de generador.',
        v_expected.table_name,
        v_expected.column_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = i.indrelid
       AND a.attname = v_expected.column_name
       AND a.attnum > 0
       AND NOT a.attisdropped
      WHERE i.indrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indimmediate
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts = 1
        AND i.indkey[0] = a.attnum
    ) THEN
      RAISE EXCEPTION
        'Identificador public.%.% no tiene unicidad simple valida.',
        v_expected.table_name,
        v_expected.column_name;
    END IF;
  END LOOP;

  -- Los targets escritos por UPDATE tampoco pueden convertirse en columnas
  -- generadas o identidades ALWAYS sin romper rutas que PL/pgSQL compila tarde.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        (
          'idempotency_keys_operativas',
          ARRAY[
            'estado', 'entidad_tipo', 'entidad_id', 'resultado_resumen',
            'error_resumen', 'request_hash'
          ]::text[]
        ),
        (
          'cuentas_por_cobrar',
          ARRAY[
            'saldo_pendiente', 'estado', 'actualizado_at', 'actualizado_por'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_cobrar',
          ARRAY[
            'estado', 'anulado_por', 'anulado_at', 'motivo_anulacion'
          ]::text[]
        ),
        (
          'cuentas_por_pagar',
          ARRAY[
            'saldo_pendiente', 'estado', 'actualizado_at', 'actualizado_por'
          ]::text[]
        ),
        (
          'pagos_cuentas_por_pagar',
          ARRAY[
            'estado', 'anulado_por', 'anulado_at', 'motivo_anulacion'
          ]::text[]
        )
    ) AS update_contract(table_name, updated_columns)
  LOOP
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attnum)
      INTO v_bad
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', v_expected.table_name)
      )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname = ANY (v_expected.updated_columns)
      AND (a.attgenerated <> '' OR a.attidentity = 'a');

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION
        'public.% genera o fuerza identidad en columnas actualizadas: %.',
        v_expected.table_name,
        v_bad;
    END IF;
  END LOOP;

  -- Matriz ACL estricta de idempotencia despues del cutover. service_role no
  -- usa RLS como frontera, pero conserva DELETE de mantenimiento controlado.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    LEFT JOIN pg_catalog.pg_roles r
      ON r.oid = acl.grantee
    WHERE c.oid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND (acl.grantee = 0 OR r.rolname IN (
        'anon', 'authenticated', 'authenticator', 'service_role'
      ))
      AND acl.is_grantable
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: GRANT OPTION inesperado sobre idempotencia.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
    LEFT JOIN pg_catalog.pg_roles r
      ON r.oid = acl.grantee
    WHERE a.attrelid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND (acl.grantee = 0 OR r.rolname IN (
        'anon', 'authenticated', 'authenticator', 'service_role'
      ))
      AND acl.is_grantable
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: GRANT OPTION de columna inesperado sobre idempotencia.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    WHERE c.oid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: PUBLIC conserva privilegios sobre idempotencia.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
    WHERE a.attrelid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: PUBLIC conserva privilegios de columna sobre idempotencia.';
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
       )
       OR pg_catalog.has_table_privilege(
         v_role, 'public.idempotency_keys_operativas', 'MAINTAIN'
       )
       OR pg_catalog.has_any_column_privilege(
         v_role, 'public.idempotency_keys_operativas', 'SELECT'
       )
       OR pg_catalog.has_any_column_privilege(
         v_role, 'public.idempotency_keys_operativas', 'INSERT'
       )
       OR pg_catalog.has_any_column_privilege(
         v_role, 'public.idempotency_keys_operativas', 'UPDATE'
       )
       OR pg_catalog.has_any_column_privilege(
         v_role, 'public.idempotency_keys_operativas', 'REFERENCES'
       ) THEN
      RAISE EXCEPTION
        'Postcondicion: % conserva privilegios sobre idempotencia.',
        v_role;
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
     )
     OR pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'REFERENCES'
     )
     OR pg_catalog.has_table_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'MAINTAIN'
     )
     OR pg_catalog.has_any_column_privilege(
       'authenticated', 'public.idempotency_keys_operativas', 'REFERENCES'
     ) THEN
    RAISE EXCEPTION
      'Postcondicion: matriz authenticated de idempotencia invalida.';
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
     )
     OR pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'REFERENCES'
     )
     OR pg_catalog.has_table_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'MAINTAIN'
     )
     OR pg_catalog.has_any_column_privilege(
       'service_role', 'public.idempotency_keys_operativas', 'REFERENCES'
     ) THEN
    RAISE EXCEPTION
      'Postcondicion: matriz service_role de idempotencia invalida.';
  END IF;

  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('expira_at'),
        ('idempotency_key'),
        ('usuario_id'),
        ('modulo'),
        ('accion'),
        ('estado')
    ) AS required(column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid =
          'public.idempotency_keys_operativas'::pg_catalog.regclass
        AND a.attname = v_expected.column_name
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attnotnull
    ) THEN
      RAISE EXCEPTION
        'Postcondicion: idempotency_keys_operativas.% debe ser NOT NULL.',
        v_expected.column_name;
    END IF;
  END LOOP;

  -- El mismo contrato runtime se revalida despues del cutover.
  FOR v_expected IN
    SELECT *
    FROM (
      VALUES
        ('registrar_pago_cxc_core_v1', 'public.registrar_pago_cxc_core_v1(text, bigint, date, text, text, text, text, numeric, text, uuid, text)', 'p_cuenta_id,p_empresa_id,p_fecha_pago,p_metodo_pago,p_banco,p_referencia,p_moneda,p_monto,p_observaciones,p_creado_por,p_idempotency_key', 'jsonb', 'a4b67bf863a6dc403a584ef5b2ec01b6', NULL::text),
        ('registrar_pago_cxp_core_v1', 'public.registrar_pago_cxp_core_v1(text, bigint, date, text, text, text, text, numeric, text, uuid, text)', 'p_cuenta_id,p_empresa_id,p_fecha_pago,p_metodo_pago,p_banco,p_referencia,p_moneda,p_monto,p_observaciones,p_creado_por,p_idempotency_key', 'jsonb', 'e4a9b49d10283e8cdfbb82a272300e23', NULL::text),
        ('anular_pago_cxc_core_v1', 'public.anular_pago_cxc_core_v1(text, bigint, uuid, text, text)', 'p_pago_id,p_empresa_id,p_anulado_por,p_motivo_anulacion,p_idempotency_key', 'jsonb', '88d708eee3ec75bbbb26bf7fd3e97f57', NULL::text),
        ('anular_pago_cxp_core_v1', 'public.anular_pago_cxp_core_v1(text, bigint, uuid, text, text)', 'p_pago_id,p_empresa_id,p_anulado_por,p_motivo_anulacion,p_idempotency_key', 'jsonb', '8c12d51c1fef627d6e642d5b197d9e03', NULL::text)
    ) AS expected(function_name, signature, argument_names, result_type, source_md5_lf, required_body_reference)
  LOOP
    v_oid := pg_catalog.to_regprocedure(v_expected.signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Postcondicion: falta core %. ', v_expected.signature;
    END IF;

    SELECT p.*
      INTO v_proc
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.oid = v_oid
      AND n.nspname = 'public';

    IF v_proc.prokind <> 'f'
       OR v_proc.prosecdef IS DISTINCT FROM true
       OR v_proc.proconfig IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.unnest(v_proc.proconfig) cfg
         WHERE cfg = 'search_path=pg_catalog, public, pg_temp'
       ) THEN
      RAISE EXCEPTION 'Postcondicion: configuracion invalida para core %.', v_expected.signature;
    END IF;

    v_normalized_source := pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          v_proc.prosrc,
          E'\\r\\n?',
          E'\\n',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    );
    v_actual_source_md5_lf := pg_catalog.md5(v_normalized_source);

    IF v_actual_source_md5_lf IS DISTINCT FROM v_expected.source_md5_lf THEN
      v_core_hash_mismatch := true;
      v_core_hash_diagnostics := v_core_hash_diagnostics
        || pg_catalog.format(
          E'\n- %s | esperado=%s | real=%s | longitud=%s',
          v_expected.signature,
          v_expected.source_md5_lf,
          v_actual_source_md5_lf,
          pg_catalog.length(v_normalized_source)
        );
    END IF;

    IF v_proc.pronargs IS DISTINCT FROM pg_catalog.cardinality(
         pg_catalog.string_to_array(v_expected.argument_names, ',')
       )
       OR v_proc.proargnames[1:v_proc.pronargs] IS DISTINCT FROM
          pg_catalog.string_to_array(v_expected.argument_names, ',') THEN
      RAISE EXCEPTION
        'Postcondicion: nombres o cantidad de argumentos inesperados para core %.',
        v_expected.signature;
    END IF;

    IF pg_catalog.format_type(v_proc.prorettype, NULL)
       IS DISTINCT FROM v_expected.result_type THEN
      RAISE EXCEPTION
        'Postcondicion: tipo de retorno inesperado para core %.',
        v_expected.signature;
    END IF;

    IF v_expected.required_body_reference IS NOT NULL
       AND pg_catalog.strpos(v_proc.prosrc, v_expected.required_body_reference) = 0 THEN
      RAISE EXCEPTION 'Postcondicion: core sin referencia requerida: %.', v_expected.signature;
    END IF;
  END LOOP;

  IF v_core_hash_mismatch THEN
    RAISE EXCEPTION
      'Postcondicion: hashes de cores distintos:%',
      v_core_hash_diagnostics;
  END IF;

  FOR v_expected IN
    SELECT required.table_name
    FROM (
      VALUES
        ('pagos_cuentas_por_cobrar'),
        ('pagos_cuentas_por_pagar')
    ) AS required(table_name)
  LOOP
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
          'Postcondicion: % conserva DML directo sobre public.%.',
          v_role,
          v_expected.table_name;
      END IF;
    END LOOP;
  END LOOP;

  FOREACH v_role IN ARRAY ARRAY[
    'anon'::name,
    'authenticated'::name,
    'service_role'::name,
    'authenticator'::name
  ]
  LOOP
    IF pg_catalog.has_table_privilege(
      v_role,
      'public.idempotency_keys_operativas',
      'TRIGGER'
    ) THEN
      RAISE EXCEPTION
        'Postcondicion: % conserva TRIGGER sobre idempotencia.',
        v_role;
    END IF;
  END LOOP;

  FOR v_expected IN
    SELECT required.table_name
    FROM (
      VALUES
        ('cuentas_por_cobrar'),
        ('pagos_cuentas_por_cobrar'),
        ('cuentas_por_pagar'),
        ('pagos_cuentas_por_pagar')
    ) AS required(table_name)
  LOOP
    FOREACH v_role IN ARRAY ARRAY[
      'anon'::name,
      'authenticated'::name,
      'authenticator'::name
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        CROSS JOIN pg_catalog.pg_roles r
        WHERE c.oid = pg_catalog.to_regclass(
            pg_catalog.format('public.%I', v_expected.table_name)
          )
          AND r.rolname = v_role
          AND c.relkind IN ('r', 'p')
          AND c.relrowsecurity
          AND NOT r.rolsuper
          AND NOT r.rolbypassrls
          AND c.relowner <> r.oid
          AND NOT pg_catalog.pg_has_role(r.oid, c.relowner, 'MEMBER')
      ) THEN
        RAISE EXCEPTION
          'Postcondicion: % puede omitir RLS de public.%.',
          v_role,
          v_expected.table_name;
      END IF;
    END LOOP;
  END LOOP;

  v_oid := pg_catalog.to_regprocedure(
    'public.seguridad_operativa_set_actualizado_at()'
  );

  IF v_oid IS NULL THEN
    RAISE EXCEPTION
      'Postcondicion: falta seguridad_operativa_set_actualizado_at().';
  END IF;

  SELECT
    p.*,
    l.lanname,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner_name
    INTO v_proc
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_language l
    ON l.oid = p.prolang
  WHERE p.oid = v_oid;

  IF v_proc.prokind <> 'f'
     OR v_proc.lanname <> 'plpgsql'
     OR v_proc.prorettype <> 'trigger'::pg_catalog.regtype
     OR v_proc.prosecdef
     OR v_proc.pronargs <> 0
     OR v_proc.owner_name <> CURRENT_USER
     OR pg_catalog.md5(
       pg_catalog.btrim(
         pg_catalog.replace(
           v_proc.prosrc,
           pg_catalog.chr(13) || pg_catalog.chr(10),
           pg_catalog.chr(10)
         ),
         ' ' || pg_catalog.chr(9) || pg_catalog.chr(10)
           || pg_catalog.chr(13)
       )
     ) <> '1ccab45c7338257f8a1517869dfd0ab2' THEN
    RAISE EXCEPTION
      'Postcondicion: funcion actualizado_at difiere del baseline.';
  END IF;

  FOREACH v_role IN ARRAY ARRAY[
    'anon'::name,
    'authenticated'::name,
    'service_role'::name,
    'authenticator'::name
  ]
  LOOP
    IF pg_catalog.has_schema_privilege(v_role, 'public', 'CREATE') THEN
      RAISE EXCEPTION
        'Postcondicion: % conserva CREATE efectivo sobre public.',
        v_role;
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_schema_privilege(
       'authenticated',
       'public',
       'USAGE'
     ) THEN
    RAISE EXCEPTION
      'Postcondicion: authenticated no puede usar el esquema public.';
  END IF;

  IF NOT pg_catalog.has_schema_privilege(CURRENT_USER, 'public', 'USAGE')
     OR NOT pg_catalog.has_schema_privilege(
       CURRENT_USER,
       'public',
       'CREATE'
     ) THEN
    RAISE EXCEPTION
      'Postcondicion: owner no puede usar/crear en el esquema public.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    WHERE (
      (
        a.attrelid = 'public.intentos_bloqueados'::pg_catalog.regclass
        AND a.attname IN ('usuario_id', 'empresa_id')
      ) OR (
        a.attrelid = 'public.auditoria_eventos'::pg_catalog.regclass
        AND a.attname = 'empresa_id'
      ) OR (
        a.attrelid =
            'public.pagos_cuentas_por_cobrar'::pg_catalog.regclass
        AND a.attname IN ('banco', 'referencia', 'observaciones')
      ) OR (
        a.attrelid =
            'public.pagos_cuentas_por_pagar'::pg_catalog.regclass
        AND a.attname IN ('banco', 'referencia', 'observaciones')
      )
    )
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: una columna usada con NULL por los cores es NOT NULL.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    WHERE c.oid = 'public.empresas'::pg_catalog.regclass
      AND c.relowner = CURRENT_USER::pg_catalog.regrole
      AND c.relkind = 'r'
      AND NOT c.relispartition
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_inherits i
        WHERE i.inhrelid = c.oid
           OR i.inhparent = c.oid
      )
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: empresas dejo de ser tabla raiz ordinaria del owner.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    WHERE c.oid =
        'public.idempotency_keys_operativas'::pg_catalog.regclass
      AND c.relowner = CURRENT_USER::pg_catalog.regrole
      AND c.relkind = 'r'
      AND NOT c.relispartition
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_inherits i
        WHERE i.inhrelid = c.oid
           OR i.inhparent = c.oid
      )
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: idempotencia dejo de ser tabla raiz ordinaria del owner.';
  END IF;

  FOR v_expected IN
    SELECT required.table_name
    FROM (
      VALUES
        ('pagos_cuentas_por_cobrar'),
        ('pagos_cuentas_por_pagar')
    ) AS required(table_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      WHERE c.oid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', v_expected.table_name)
        )
        AND c.relowner = CURRENT_USER::pg_catalog.regrole
        AND c.relkind = 'r'
        AND NOT c.relispartition
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_inherits i
          WHERE i.inhrelid = c.oid
             OR i.inhparent = c.oid
        )
    ) THEN
      RAISE EXCEPTION
        'Postcondicion: public.% no conserva ownership/forma para cerrar ACL.',
        v_expected.table_name;
    END IF;
  END LOOP;




  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    WHERE p.oid = pg_catalog.to_regprocedure(
      'public.eliminar_empresa_vacia_segura(bigint, text)'
    )
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'Postcondicion: PUBLIC conserva EXECUTE sobre eliminar_empresa_vacia_segura.';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon'::name, 'authenticated'::name, 'service_role'::name, 'authenticator'::name]
  LOOP
    IF pg_catalog.has_function_privilege(v_role, 'public.eliminar_empresa_vacia_segura(bigint, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'Postcondicion: % conserva EXECUTE sobre eliminar_empresa_vacia_segura.', v_role;
    END IF;
  END LOOP;
END;
$postcondition$;

ROLLBACK;
-- ROLLBACK OPERATIVO (manual; no ejecutar a ciegas)
-- 1. Detener trafico y demostrar que no hay nuevos dependientes de wrappers.
-- 2. Capturar ACL/owners actuales y ejecutar todo en una sola transaccion.
-- 3. REVOKE wrappers; DROP del trigger hardening_empresas_es_prueba_guard_v1,
--    de su funcion, de los cinco wrappers y del helper; DROP de las dos
--    policies hardening_pagos_idempotency_*_v1.
-- 4. RENAME de cada *_core_v1 a su nombre original y conservar search_path
--    pg_catalog, public, pg_temp con row_security=off.
-- 5. Restaurar desde la salida del preflight las ACL exactas de funciones y
--    empresas. La migracion convierte INSERT/UPDATE de tabla en grants de
--    columnas sin es_prueba; no reconstruir grants de tabla sin excluirla.
-- 6. Mantener es_prueba por defecto. Solo se puede DROP COLUMN si todas las
--    filas siguen false, no existen dependencias y se acepta perder el dato.
--
-- No es reversible automaticamente:
-- * una empresa eliminada fisicamente despues del despliegue;
-- * pagos/anulaciones ya confirmados;
-- * hashes de idempotencia fortalecidos por llamadas posteriores;
-- * dependencias creadas por otros despliegues contra los wrappers.
--
-- Riesgo operativo deliberado: columnas futuras de empresas no heredaran los
-- antiguos grants INSERT/UPDATE de tabla; cada nueva columna exigira un grant
-- explicito y una revision de seguridad.
