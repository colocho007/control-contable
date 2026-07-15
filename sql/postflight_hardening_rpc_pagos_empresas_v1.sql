-- Postflight READ ONLY.
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ ONLY;

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
