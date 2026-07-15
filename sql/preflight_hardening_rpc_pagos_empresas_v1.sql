-- Preflight READ ONLY.
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ ONLY;

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

-- Evidencia informativa de ACL de idempotencia.
SELECT CASE WHEN acl.grantee = 0 THEN 'PUBLIC'::name ELSE grantee_role.rolname END AS grantee,
       acl.privilege_type, grantor_role.rolname AS grantor, acl.is_grantable
FROM pg_catalog.pg_class c
CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
LEFT JOIN pg_catalog.pg_roles grantee_role ON grantee_role.oid = acl.grantee
LEFT JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = acl.grantor
WHERE c.oid = 'public.idempotency_keys_operativas'::pg_catalog.regclass
ORDER BY 1, 2;

ROLLBACK;