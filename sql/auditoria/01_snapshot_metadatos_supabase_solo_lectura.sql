-- Snapshot estructural para reconciliacion de Supabase.
-- Cada bloque es independiente y devuelve un resultado identificado.
-- El archivo consulta catalogos y metadatos; no invoca rutinas de negocio.
-- Ejecutar un bloque por vez y conservar la salida en un medio restringido.

-- 01. Version PostgreSQL e identidad del contexto de lectura.
select
  '01_version_postgresql'::text as resultado,
  pg_catalog.current_database() as base_datos,
  current_user as rol_ejecutor,
  pg_catalog.current_setting('server_version') as version_postgresql,
  pg_catalog.current_setting('server_version_num')::integer as version_numero;

-- 02. Esquemas no internos, propietario y ACL directa/predeterminada.
select
  '02_esquemas_relevantes'::text as resultado,
  n.oid as esquema_oid,
  n.nspname as esquema,
  pg_catalog.pg_get_userbyid(n.nspowner) as propietario,
  pg_catalog.to_regclass('storage.buckets') is not null
    as storage_buckets_disponible,
  pg_catalog.to_regclass(
    'supabase_migrations.schema_migrations'
  ) is not null as historial_migraciones_disponible,
  case
    when a.grantee = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(a.grantee)
  end as beneficiario,
  a.privilege_type as privilegio,
  a.is_grantable as delegable
from pg_catalog.pg_namespace n
left join lateral pg_catalog.aclexplode(
  coalesce(
    n.nspacl,
    pg_catalog.acldefault('n', n.nspowner)
  )
) a on true
where n.nspname !~ '^pg_'
  and n.nspname <> 'information_schema'
order by n.nspname, beneficiario, a.privilege_type;

-- 03. Tablas y vistas del esquema public.
select
  '03_relaciones_public'::text as resultado,
  n.nspname as esquema,
  c.relname as objeto,
  case c.relkind
    when 'r' then 'tabla'
    when 'p' then 'tabla_particionada'
    when 'f' then 'tabla_externa'
    when 'v' then 'vista'
    when 'm' then 'vista_materializada'
  end as clase,
  pg_catalog.pg_get_userbyid(c.relowner) as propietario,
  c.relpersistence as persistencia,
  c.relispartition as es_particion,
  c.relrowsecurity as rls_habilitado,
  c.relforcerowsecurity as rls_forzado
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'f', 'v', 'm')
order by c.relname;

-- 04. Columnas, tipos, nulabilidad y expresiones predeterminadas de public.
select
  '04_columnas_public'::text as resultado,
  n.nspname as esquema,
  c.relname as objeto,
  a.attnum as posicion,
  a.attname as columna,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as tipo,
  not a.attnotnull as permite_nulo,
  a.atthasdef as tiene_expresion_predeterminada,
  nullif(a.attidentity, '') as identidad,
  nullif(a.attgenerated, '') as generada,
  cn.nspname as esquema_collation,
  co.collname as collation,
  case
    when d.adbin is null then null
    when a.attname ~* '(password|passwd|secret|token|credential|api.?key|service.?role)'
      then '[REDACTADO: revisar solamente dentro del editor]'
    when pg_catalog.pg_get_expr(d.adbin, d.adrelid, true)
         ~* '(private[ _-]?key|service[ _-]?role|password|secret|token)'
      then '[REDACTADO: revisar solamente dentro del editor]'
    else pg_catalog.pg_get_expr(d.adbin, d.adrelid, true)
  end as expresion_predeterminada
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d
  on d.adrelid = a.attrelid
 and d.adnum = a.attnum
left join pg_catalog.pg_collation co
  on co.oid = a.attcollation
 and a.attcollation <> 0
left join pg_catalog.pg_namespace cn on cn.oid = co.collnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'f', 'v', 'm')
  and a.attnum > 0
  and not a.attisdropped
order by c.relname, a.attnum;

-- 05. Claves primarias de public.
select
  '05_claves_primarias'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  con.conname as restriccion,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definicion,
  con.convalidated as validada,
  con.condeferrable as diferible,
  con.condeferred as inicialmente_diferida
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and con.contype = 'p'
order by c.relname, con.conname;

-- 06. Claves foraneas de public.
select
  '06_claves_foraneas'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  con.conname as restriccion,
  rn.nspname as esquema_referenciado,
  rc.relname as tabla_referenciada,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definicion,
  con.convalidated as validada,
  con.condeferrable as diferible,
  con.condeferred as inicialmente_diferida
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_class rc on rc.oid = con.confrelid
join pg_catalog.pg_namespace rn on rn.oid = rc.relnamespace
where n.nspname = 'public'
  and con.contype = 'f'
order by c.relname, con.conname;

-- 07. Restricciones de unicidad de public.
select
  '07_restricciones_unicas'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  con.conname as restriccion,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definicion,
  con.convalidated as validada,
  con.condeferrable as diferible,
  con.condeferred as inicialmente_diferida
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and con.contype = 'u'
order by c.relname, con.conname;

-- 08. Restricciones de control de public.
select
  '08_restricciones_control'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  con.conname as restriccion,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definicion,
  con.convalidated as validada,
  con.connoinherit as no_heredada
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and con.contype = 'c'
order by c.relname, con.conname;

-- 09. Indices de public y sus definiciones.
select
  '09_indices_public'::text as resultado,
  n.nspname as esquema,
  tc.relname as tabla,
  ic.relname as indice,
  pg_catalog.pg_get_userbyid(ic.relowner) as propietario,
  i.indisprimary as primario,
  i.indisunique as unico,
  i.indisexclusion as exclusion,
  i.indisvalid as valido,
  i.indisready as listo,
  i.indislive as activo,
  pg_catalog.pg_get_expr(i.indpred, i.indrelid, true) as predicado,
  pg_catalog.pg_get_indexdef(i.indexrelid, 0, true) as definicion
from pg_catalog.pg_index i
join pg_catalog.pg_class tc on tc.oid = i.indrelid
join pg_catalog.pg_class ic on ic.oid = i.indexrelid
join pg_catalog.pg_namespace n on n.oid = tc.relnamespace
where n.nspname = 'public'
order by tc.relname, ic.relname;

-- 10. Triggers de public y storage.
select
  '10_triggers'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  t.tgname as trigger,
  t.tgenabled as estado,
  t.tgisinternal as interno,
  pn.nspname as esquema_funcion,
  p.proname as funcion,
  pg_catalog.pg_get_triggerdef(t.oid, true) as definicion
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_proc p on p.oid = t.tgfoid
join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
where n.nspname in ('public', 'storage')
order by n.nspname, c.relname, t.tgname;

-- 11. Funciones y procedimientos relevantes, sin cuerpo de codigo.
select
  '11_rutinas'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  case p.prokind
    when 'f' then 'funcion'
    when 'p' then 'procedimiento'
    when 'a' then 'agregado'
    when 'w' then 'funcion_ventana'
  end as clase,
  l.lanname as lenguaje,
  p.provolatile as volatilidad,
  p.proisstrict as estricta,
  p.proleakproof as sin_fugas_declarada,
  p.proparallel as paralelismo,
  case
    when p.prokind in ('f', 'p', 'w')
      then pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))
    else null
  end as huella_definicion,
  case
    when p.prokind in ('f', 'p', 'w')
      then pg_catalog.octet_length(pg_catalog.pg_get_functiondef(p.oid))
    else null
  end as longitud_definicion
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
where n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid);

-- 12. Argumentos y tipo de retorno de funciones y procedimientos.
select
  '12_argumentos_y_retorno'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  pg_catalog.pg_get_function_result(p.oid) as tipo_retorno,
  p.pronargs as cantidad_argumentos,
  p.pronargdefaults as argumentos_con_valor_predeterminado
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid);

-- 13. Propietarios de funciones y procedimientos.
select
  '13_propietarios_rutinas'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  pg_catalog.pg_get_userbyid(p.proowner) as propietario
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid);

-- 14. Modo de seguridad de funciones y procedimientos.
select
  '14_modo_seguridad_rutinas'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  p.prosecdef as ejecuta_como_propietario,
  case
    when p.prosecdef then 'definidor'
    else 'invocador'
  end as modo_seguridad
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid);

-- 15. proconfig; solo revela valores de controles conocidos.
select
  '15_proconfig_y_ruta'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  cfg.ordinalidad,
  case
    when cfg.entrada is null then null
    else pg_catalog.split_part(cfg.entrada, '=', 1)
  end as parametro,
  case
    when cfg.entrada is null then null
    when pg_catalog.split_part(cfg.entrada, '=', 1)
         in ('search_path', 'role', 'row_security')
      then pg_catalog.substring(
        cfg.entrada,
        pg_catalog.strpos(cfg.entrada, '=') + 1
      )
    else '[REDACTADO]'
  end as valor
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
left join lateral pg_catalog.unnest(
  coalesce(p.proconfig, array[]::text[])
) with ordinality cfg(entrada, ordinalidad) on true
where n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid), cfg.ordinalidad;

-- 16. ACL directa/predeterminada de funciones y procedimientos.
select
  '16_privilegios_rutinas'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  case
    when a.grantor = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(a.grantor)
  end as otorgante,
  case
    when a.grantee = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(a.grantee)
  end as beneficiario,
  a.privilege_type as privilegio,
  a.is_grantable as delegable
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(
    p.proacl,
    pg_catalog.acldefault('f', p.proowner)
  )
) a
where n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid), beneficiario;

-- 17. ACL directa/predeterminada de tablas, vistas y secuencias.
with permisos_objeto as (
  select
    n.nspname as esquema,
    c.relname as objeto,
    c.relkind,
    a.grantor,
    a.grantee,
    a.privilege_type,
    a.is_grantable
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      c.relacl,
      pg_catalog.acldefault(
        (case when c.relkind = 'S' then 's' else 'r' end)::"char",
        c.relowner
      )
    )
  ) a
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p', 'f', 'v', 'm', 'S')
)
select
  '17_privilegios_relaciones_secuencias'::text as resultado,
  esquema,
  objeto,
  case relkind
    when 'S' then 'secuencia'
    when 'v' then 'vista'
    when 'm' then 'vista_materializada'
    else 'tabla'
  end as clase,
  case
    when grantor = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(grantor)
  end as otorgante,
  case
    when grantee = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(grantee)
  end as beneficiario,
  privilege_type as privilegio,
  is_grantable as delegable
from permisos_objeto
order by esquema, objeto, beneficiario, privilegio;

-- 18. Estado RLS y cantidad de policies.
select
  '18_estado_rls'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  case c.relkind
    when 'p' then 'tabla_particionada'
    else 'tabla'
  end as clase,
  pg_catalog.pg_get_userbyid(c.relowner) as propietario,
  c.relrowsecurity as rls_habilitado,
  c.relforcerowsecurity as rls_forzado,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policy p
    where p.polrelid = c.oid
  ) as cantidad_policies
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

-- 19. Policies completas de public y storage.
select
  '19_policies_completas'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  p.polname as policy,
  case p.polcmd
    when '*' then 'todos'
    when 'r' then 'lectura'
    when 'a' then 'alta'
    when 'w' then 'cambio'
    when 'd' then 'baja'
  end as comando,
  array(
    select case
      when rol_oid = 0 then 'PUBLIC'
      else pg_catalog.pg_get_userbyid(rol_oid)
    end
    from pg_catalog.unnest(p.polroles) rol_oid
    order by 1
  ) as roles,
  p.polpermissive as permisiva,
  pg_catalog.pg_get_expr(p.polqual, p.polrelid, true) as expresion_uso,
  pg_catalog.pg_get_expr(
    p.polwithcheck,
    p.polrelid,
    true
  ) as expresion_control_escritura
from pg_catalog.pg_policy p
join pg_catalog.pg_class c on c.oid = p.polrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
order by n.nspname, c.relname, p.polname;

-- 20. Vistas: definicion, propietario, opciones y privilegios.
select
  '20_vistas'::text as resultado,
  n.nspname as esquema,
  c.relname as vista,
  case c.relkind
    when 'v' then 'vista'
    when 'm' then 'vista_materializada'
  end as clase,
  pg_catalog.pg_get_userbyid(c.relowner) as propietario,
  pg_catalog.pg_get_viewdef(c.oid, true) as definicion,
  coalesce(
    'security_invoker=true' = any(c.reloptions),
    false
  ) as invocador_seguridad,
  coalesce(
    'security_barrier=true' = any(c.reloptions),
    false
  ) as barrera_seguridad,
  case
    when a.grantee = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(a.grantee)
  end as beneficiario,
  a.privilege_type as privilegio,
  a.is_grantable as delegable
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(
    c.relacl,
    pg_catalog.acldefault('r', c.relowner)
  )
) a
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
order by c.relname, beneficiario, a.privilege_type;

-- 21. Secuencias sin leer su valor actual.
select
  '21_secuencias'::text as resultado,
  n.nspname as esquema,
  c.relname as secuencia,
  pg_catalog.pg_get_userbyid(c.relowner) as propietario,
  pg_catalog.format_type(s.seqtypid, null) as tipo,
  s.seqstart as inicio,
  s.seqincrement as incremento,
  s.seqmin as minimo,
  s.seqmax as maximo,
  s.seqcache as cache,
  s.seqcycle as ciclica
from pg_catalog.pg_sequence s
join pg_catalog.pg_class c on c.oid = s.seqrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
order by n.nspname, c.relname;

-- 22. Extensiones instaladas.
select
  '22_extensiones'::text as resultado,
  e.extname as extension,
  e.extversion as version,
  n.nspname as esquema,
  pg_catalog.pg_get_userbyid(e.extowner) as propietario,
  e.extrelocatable as reubicable
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- 23. Tipos ENUM y sus etiquetas.
select
  '23_tipos_enum'::text as resultado,
  n.nspname as esquema,
  t.typname as tipo_enum,
  pg_catalog.pg_get_userbyid(t.typowner) as propietario,
  e.enumsortorder as orden,
  e.enumlabel as etiqueta
from pg_catalog.pg_type t
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
join pg_catalog.pg_enum e on e.enumtypid = t.oid
where n.nspname !~ '^pg_'
  and n.nspname <> 'information_schema'
order by n.nspname, t.typname, e.enumsortorder;

-- 24. Storage: ejecutar solo si R02 confirma storage.buckets.
-- Devuelve buckets, limites, policies y ACL sin rutas de objetos.
with buckets as (
  select
    'bucket'::text as clase,
    coalesce(
      pg_catalog.to_jsonb(b) ->> 'id',
      pg_catalog.to_jsonb(b) ->> 'name'
    ) as objeto,
    pg_catalog.jsonb_build_object(
      'nombre', pg_catalog.to_jsonb(b) ->> 'name',
      'publico', pg_catalog.to_jsonb(b) -> 'public',
      'limite_bytes', pg_catalog.to_jsonb(b) -> 'file_size_limit',
      'mime_permitidos', pg_catalog.to_jsonb(b) -> 'allowed_mime_types'
    ) as detalle
  from storage.buckets b
), policies_storage as (
  select
    'policy'::text as clase,
    c.relname || '.' || p.polname as objeto,
    pg_catalog.jsonb_build_object(
      'tabla', c.relname,
      'comando_codigo', p.polcmd,
      'permisiva', p.polpermissive,
      'roles', array(
        select case
          when rol_oid = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(rol_oid)
        end
        from pg_catalog.unnest(p.polroles) rol_oid
        order by 1
      ),
      'expresion_uso', pg_catalog.pg_get_expr(
        p.polqual,
        p.polrelid,
        true
      ),
      'expresion_control', pg_catalog.pg_get_expr(
        p.polwithcheck,
        p.polrelid,
        true
      )
    ) as detalle
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage'
    and c.relname in ('objects', 'buckets')
), permisos_storage as (
  select
    'permiso'::text as clase,
    c.relname as objeto,
    pg_catalog.jsonb_build_object(
      'beneficiario', case
        when a.grantee = 0 then 'PUBLIC'
        else pg_catalog.pg_get_userbyid(a.grantee)
      end,
      'privilegio', a.privilege_type,
      'delegable', a.is_grantable
    ) as detalle
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      c.relacl,
      pg_catalog.acldefault('r', c.relowner)
    )
  ) a
  where n.nspname = 'storage'
    and c.relname in ('objects', 'buckets')
)
select
  '24_storage'::text as resultado,
  clase,
  objeto,
  detalle
from buckets
union all
select '24_storage', clase, objeto, detalle from policies_storage
union all
select '24_storage', clase, objeto, detalle from permisos_storage
order by clase, objeto;

-- 25. Ejecutar solo si R02 confirma el historial de migraciones.
-- Devuelve historial estructural sin cuerpos de sentencias.
select
  '25_historial_migraciones_supabase'::text as resultado,
  pg_catalog.to_jsonb(m) ->> 'version' as version,
  nullif(pg_catalog.to_jsonb(m) ->> 'name', '') as nombre,
  case
    when pg_catalog.jsonb_typeof(
      pg_catalog.to_jsonb(m) -> 'statements'
    ) = 'array'
      then pg_catalog.jsonb_array_length(
        pg_catalog.to_jsonb(m) -> 'statements'
      )
    else null
  end as cantidad_sentencias,
  nullif(pg_catalog.to_jsonb(m) ->> 'inserted_at', '') as fecha_registro
from supabase_migrations.schema_migrations m
order by pg_catalog.to_jsonb(m) ->> 'version';

-- 26. Relaciones y RPC esperadas por la aplicacion pero ausentes en public.
with relaciones_esperadas as (
  select pg_catalog.unnest(array[
    'activos_fijos',
    'activos_fijos_depreciaciones',
    'activos_fijos_movimientos',
    'asientos_contables',
    'auditoria_eventos',
    'borradores_trabajo',
    'calendario_eventos',
    'catalogo_cuentas',
    'chequeras',
    'cheques',
    'cheques_fisicos',
    'cheques_historial',
    'clientes',
    'conciliacion_ajustes',
    'conciliacion_cuentas_bancarias',
    'conciliacion_estados_cuenta',
    'conciliacion_movimientos_banco',
    'conciliacion_vinculos',
    'cuentas_por_cobrar',
    'cuentas_por_pagar',
    'distribuciones_documentos_contables',
    'documentos_contables_revision',
    'documentos_tramites',
    'empleados_planilla',
    'empresas',
    'fondos_empresa',
    'idempotency_keys_operativas',
    'importaciones_empleados',
    'impuestos_calendario',
    'impuestos_configuracion',
    'impuestos_documentos',
    'impuestos_periodos',
    'impuestos_resumen_periodo',
    'intentos_bloqueados',
    'logs',
    'modulos_sistema',
    'monitoreo_alertas',
    'movimientos',
    'movimientos_historial',
    'ordenes_compra',
    'ordenes_compra_firmas',
    'ordenes_compra_historial',
    'pagos_cuentas_por_cobrar',
    'pagos_cuentas_por_pagar',
    'perfiles',
    'periodos_contables',
    'planilla_configuracion_tasas',
    'planilla_prestamos_descuentos',
    'planillas',
    'planillas_periodos',
    'proveedores',
    'proyectos_centros_costo',
    'proyectos_movimientos',
    'proyectos_presupuestos',
    'reinicios_controlados',
    'tareas',
    'usuario_empresas',
    'usuario_funciones_operativas',
    'usuario_modulos',
    'vista_resumen_chequeras'
  ]::text[]) as objeto
), rutinas_esperadas as (
  select
    'actualizar_empleado_v2'::text as objeto,
    'uuid, integer, jsonb, text'::text as tipos_argumentos
  union all
  select 'anular_asiento_contable', 'uuid, bigint, text, uuid, text'
  union all
  select 'anular_cheque_transaccional', 'bigint, bigint, uuid, text, text'
  union all
  select 'anular_pago_cxc', 'text, bigint, uuid, text, text'
  union all
  select 'anular_pago_cxp', 'text, bigint, uuid, text, text'
  union all
  select 'autorizar_cheque_transaccional', 'bigint, bigint, uuid, text'
  union all
  select 'cerrar_periodo_contable', 'uuid, bigint, text, uuid, text'
  union all
  select 'contabilizar_documento_contable', 'uuid, bigint, uuid, text'
  union all
  select
    'crear_cheque_transaccional',
    'bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text'
  union all
  select 'crear_empleado_v2', 'jsonb, text'
  union all
  select 'eliminar_empresa_vacia_segura', 'bigint, text'
  union all
  select 'finalizar_asiento_contable', 'uuid, bigint, uuid, text'
  union all
  select 'generar_cheques_de_chequera', null::text
  union all
  select 'importar_empleados_v2', 'text, text, bigint, text, text, jsonb'
  union all
  select 'pagar_cheque_transaccional', 'bigint, bigint, uuid, text'
  union all
  select 'rechazar_cheque_transaccional', 'bigint, bigint, uuid, text, text'
  union all
  select
    'registrar_asiento_completo',
    'bigint, uuid, date, text, text, text, jsonb, uuid, text'
  union all
  select
    'registrar_pago_cxc',
    'text, bigint, date, text, text, text, text, numeric, text, uuid, text'
  union all
  select
    'registrar_pago_cxp',
    'text, bigint, date, text, text, text, text, numeric, text, uuid, text'
  union all
  select
    'registrar_rate_limit_operativo',
    'text, text, text, text, integer, integer, bigint, text, jsonb'
  union all
  select 'validar_importacion_empleados_v2', 'text, text, jsonb'
), diagnostico as (
  select
    'relacion'::text as clase,
    e.objeto,
    null::text as firma_esperada
  from relaciones_esperadas e
  where not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = e.objeto
      and c.relkind in ('r', 'p', 'f', 'v', 'm')
  )
  union all
  select
    'rutina'::text as clase,
    e.objeto,
    e.tipos_argumentos as firma_esperada
  from rutinas_esperadas e
  where not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = e.objeto
      and p.prokind = 'f'
      and (
        e.tipos_argumentos is null
        or pg_catalog.oidvectortypes(p.proargtypes) = e.tipos_argumentos
      )
  )
  union all
  select
    'rutina_sin_firma_local'::text as clase,
    e.objeto,
    e.tipos_argumentos as firma_esperada
  from rutinas_esperadas e
  where e.tipos_argumentos is null
    and exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = e.objeto
        and p.prokind = 'f'
    )
)
select
  '26_objetos_esperados_ausentes'::text as resultado,
  clase,
  objeto,
  firma_esperada,
  case
    when clase = 'rutina_sin_firma_local'
      then 'nombre_presente_firma_no_versionada'
    when clase = 'rutina' and firma_esperada is not null
      then 'firma_esperada_ausente_en_public'
    else 'objeto_ausente_en_public'
  end as diagnostico
from diagnostico
order by clase, objeto;

-- 27. Policies semanticamente duplicadas o con nombre posiblemente historico.
with detalle_policy as (
  select
    n.nspname as esquema,
    c.relname as tabla,
    p.polname as policy,
    p.polcmd,
    p.polpermissive,
    p.polroles,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid, false) as expresion_uso,
    pg_catalog.pg_get_expr(
      p.polwithcheck,
      p.polrelid,
      false
    ) as expresion_control
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
), clasificada as (
  select
    d.*,
    pg_catalog.count(*) over (
      partition by
        esquema,
        tabla,
        polcmd,
        polpermissive,
        polroles,
        expresion_uso,
        expresion_control
    ) as cantidad_semantica
  from detalle_policy d
)
select
  '27_policies_duplicadas_o_historicas'::text as resultado,
  esquema,
  tabla,
  policy,
  cantidad_semantica,
  case
    when cantidad_semantica > 1
         and policy ~* '(^|_)(legacy|deprecated|old|backup|temp)($|_)'
      then 'duplicada_y_nombre_historico_posible'
    when cantidad_semantica > 1 then 'duplicada_semantica_posible'
    else 'nombre_historico_posible'
  end as diagnostico
from clasificada
where cantidad_semantica > 1
   or policy ~* '(^|_)(legacy|deprecated|old|backup|temp)($|_)'
order by esquema, tabla, policy;

-- 28. Grants actuales y predeterminados para roles de API relevantes.
with permisos as (
  select
    case c.relkind
      when 'S' then 'secuencia'
      when 'v' then 'vista'
      when 'm' then 'vista_materializada'
      else 'tabla'
    end::text as clase,
    n.nspname::text as esquema,
    c.relname::text as objeto,
    a.grantee,
    a.privilege_type,
    a.is_grantable
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      c.relacl,
      pg_catalog.acldefault(
        (case when c.relkind = 'S' then 's' else 'r' end)::"char",
        c.relowner
      )
    )
  ) a
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p', 'f', 'v', 'm', 'S')

  union all

  select
    'rutina'::text,
    n.nspname::text,
    p.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    a.grantee,
    a.privilege_type,
    a.is_grantable
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      p.proacl,
      pg_catalog.acldefault('f', p.proowner)
    )
  ) a
  where n.nspname in ('public', 'storage')

  union all

  select
    'esquema'::text,
    n.nspname::text,
    n.nspname::text,
    a.grantee,
    a.privilege_type,
    a.is_grantable
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      n.nspacl,
      pg_catalog.acldefault('n', n.nspowner)
    )
  ) a
  where n.nspname in ('public', 'storage')

  union all

  select
    'privilegio_predeterminado'::text,
    case
      when d.defaclnamespace = 0 then null
      else n.nspname::text
    end,
    pg_catalog.pg_get_userbyid(d.defaclrole) || ':' || d.defaclobjtype,
    a.grantee,
    a.privilege_type,
    a.is_grantable
  from pg_catalog.pg_default_acl d
  left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral pg_catalog.aclexplode(d.defaclacl) a
)
select
  '28_grants_roles_api'::text as resultado,
  clase,
  esquema,
  objeto,
  case
    when grantee = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(grantee)
  end as beneficiario,
  privilege_type as privilegio,
  is_grantable as delegable
from permisos
where grantee = 0
   or pg_catalog.pg_get_userbyid(grantee)
      in ('anon', 'authenticated', 'service_role')
order by clase, esquema, objeto, beneficiario, privilegio;

-- 29. Funciones con privilegio efectivo para PUBLIC.
select
  '29_rutinas_publicas'::text as resultado,
  n.nspname as esquema,
  p.proname as rutina,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos_identidad,
  p.prosecdef as ejecuta_como_propietario,
  pg_catalog.pg_get_userbyid(p.proowner) as propietario,
  a.privilege_type as privilegio,
  a.is_grantable as delegable
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(
    p.proacl,
    pg_catalog.acldefault('f', p.proowner)
  )
) a
where a.grantee = 0
  and n.nspname in ('public', 'auth', 'storage', 'extensions')
order by n.nspname, p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid);

-- 30. Funciones privilegiadas y evaluacion conservadora de search_path.
with funciones_privilegiadas as (
  select
    n.nspname as esquema,
    p.proname as rutina,
    p.oid,
    p.proowner,
    (
      select cfg.entrada
      from pg_catalog.unnest(
        coalesce(p.proconfig, array[]::text[])
      ) cfg(entrada)
      where pg_catalog.split_part(cfg.entrada, '=', 1) = 'search_path'
      limit 1
    ) as ruta_configurada
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and n.nspname in ('public', 'auth', 'storage', 'extensions')
)
select
  '30_rutinas_privilegiadas_ruta'::text as resultado,
  esquema,
  rutina,
  pg_catalog.pg_get_function_identity_arguments(oid) as argumentos_identidad,
  pg_catalog.pg_get_userbyid(proowner) as propietario,
  ruta_configurada,
  case
    when ruta_configurada is null then 'sin_configuracion_explicita'
    when pg_catalog.replace(ruta_configurada, ' ', '')
         in ('search_path=', 'search_path=""')
      then 'vacia_explicita'
    when ruta_configurada ~* '(^|[=,[:space:]])(public|\$user)([,[:space:]]|$)'
      then 'incluye_esquema_no_confiable'
    else 'configurada_requiere_revision_manual'
  end as diagnostico
from funciones_privilegiadas
where ruta_configurada is null
   or pg_catalog.replace(ruta_configurada, ' ', '')
      not in ('search_path=', 'search_path=""')
order by esquema, rutina,
  pg_catalog.pg_get_function_identity_arguments(oid);

-- 31. Tablas accesibles para roles API sin RLS.
with roles_api as (
  select r.oid, r.rolname
  from pg_catalog.pg_roles r
  where r.rolname in ('anon', 'authenticated')
), tablas_sin_rls as (
  select
    c.oid,
    n.nspname as esquema,
    c.relname as tabla,
    c.relowner
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity
)
select
  '31_tablas_expuestas_sin_rls'::text as resultado,
  t.esquema,
  t.tabla,
  pg_catalog.pg_get_userbyid(t.relowner) as propietario,
  r.rolname as rol_api,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'SELECT') as lectura_tabla,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'INSERT') as alta_tabla,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'UPDATE') as cambio_tabla,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'DELETE') as baja_tabla,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'TRUNCATE') as vaciado_tabla,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'REFERENCES') as referencias_tabla,
  pg_catalog.has_table_privilege(r.oid, t.oid, 'TRIGGER') as trigger_tabla,
  pg_catalog.has_any_column_privilege(r.oid, t.oid, 'SELECT')
    as lectura_columna,
  pg_catalog.has_any_column_privilege(r.oid, t.oid, 'INSERT')
    as alta_columna,
  pg_catalog.has_any_column_privilege(r.oid, t.oid, 'UPDATE')
    as cambio_columna,
  pg_catalog.has_any_column_privilege(r.oid, t.oid, 'REFERENCES')
    as referencias_columna
from tablas_sin_rls t
cross join roles_api r
where pg_catalog.has_table_privilege(r.oid, t.oid, 'SELECT')
   or pg_catalog.has_table_privilege(r.oid, t.oid, 'INSERT')
   or pg_catalog.has_table_privilege(r.oid, t.oid, 'UPDATE')
   or pg_catalog.has_table_privilege(r.oid, t.oid, 'DELETE')
   or pg_catalog.has_table_privilege(r.oid, t.oid, 'TRUNCATE')
   or pg_catalog.has_table_privilege(r.oid, t.oid, 'REFERENCES')
   or pg_catalog.has_table_privilege(r.oid, t.oid, 'TRIGGER')
   or pg_catalog.has_any_column_privilege(r.oid, t.oid, 'SELECT')
   or pg_catalog.has_any_column_privilege(r.oid, t.oid, 'INSERT')
   or pg_catalog.has_any_column_privilege(r.oid, t.oid, 'UPDATE')
   or pg_catalog.has_any_column_privilege(r.oid, t.oid, 'REFERENCES')
order by t.esquema, t.tabla, r.rolname;

-- 32. Tablas con RLS habilitado pero sin policies.
select
  '32_rls_sin_policies'::text as resultado,
  n.nspname as esquema,
  c.relname as tabla,
  pg_catalog.pg_get_userbyid(c.relowner) as propietario,
  c.relforcerowsecurity as rls_forzado,
  'revisar_si_deny_all_es_intencional'::text as diagnostico
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
  and c.relrowsecurity
  and not exists (
    select 1
    from pg_catalog.pg_policy p
    where p.polrelid = c.oid
  )
order by n.nspname, c.relname;

-- 33. Objetos cuyo propietario no coincide con la allowlist inicial.
with propietarios_permitidos as (
  select 'public'::name as esquema, 'postgres'::name as propietario
  union all
  select 'public'::name, 'supabase_admin'::name
  union all
  select 'auth'::name, 'supabase_auth_admin'::name
  union all
  select 'storage'::name, 'supabase_storage_admin'::name
  union all
  select 'supabase_migrations'::name, 'postgres'::name
  union all
  select 'supabase_migrations'::name, 'supabase_admin'::name
), objetos as (
  select
    'esquema'::text as clase,
    n.nspname as esquema,
    n.nspname::text as objeto,
    pg_catalog.pg_get_userbyid(n.nspowner) as propietario
  from pg_catalog.pg_namespace n
  where n.nspname in (
    'public', 'auth', 'storage', 'supabase_migrations'
  )

  union all

  select
    case c.relkind
      when 'S' then 'secuencia'
      when 'v' then 'vista'
      when 'm' then 'vista_materializada'
      else 'tabla'
    end,
    n.nspname,
    c.relname,
    pg_catalog.pg_get_userbyid(c.relowner)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in (
    'public', 'auth', 'storage', 'supabase_migrations'
  )
    and c.relkind in ('r', 'p', 'f', 'v', 'm', 'S')

  union all

  select
    'rutina',
    n.nspname,
    p.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    pg_catalog.pg_get_userbyid(p.proowner)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in (
    'public', 'auth', 'storage', 'supabase_migrations'
  )

  union all

  select
    'tipo',
    n.nspname,
    t.typname,
    pg_catalog.pg_get_userbyid(t.typowner)
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname in (
    'public', 'auth', 'storage', 'supabase_migrations'
  )
    and t.typtype in ('e', 'd')
)
select
  '33_propietarios_inesperados'::text as resultado,
  o.clase,
  o.esquema,
  o.objeto,
  o.propietario,
  'fuera_de_allowlist_inicial'::text as diagnostico
from objetos o
where not exists (
  select 1
  from propietarios_permitidos p
  where p.esquema = o.esquema
    and p.propietario = o.propietario
)
order by o.esquema, o.clase, o.objeto;

-- 34. Privilegios concedidos directamente sobre columnas.
select
  '34_privilegios_columnas'::text as resultado,
  n.nspname as esquema,
  case c.relkind
    when 'v' then 'vista'
    when 'm' then 'vista_materializada'
    else 'tabla'
  end as clase_objeto,
  c.relname as tabla_o_vista,
  a.attname as columna,
  case
    when acl.grantor = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(acl.grantor)
  end as otorgante,
  case
    when acl.grantee = 0 then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(acl.grantee)
  end as beneficiario,
  acl.privilege_type as privilegio,
  acl.is_grantable as delegable
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join lateral pg_catalog.aclexplode(a.attacl) acl
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p', 'f', 'v', 'm')
  and a.attnum > 0
  and not a.attisdropped
  and a.attacl is not null
order by
  n.nspname,
  c.relname,
  a.attnum,
  beneficiario,
  privilegio,
  otorgante;

-- 35. Membresias directas y transitivas de roles API.
with recursive roles_solicitados as (
  select 'anon'::text as rol_origen
  union all
  select 'authenticated'::text
  union all
  select 'service_role'::text
  union all
  select 'authenticator'::text
), roles_origen as (
  select
    r.oid as rol_origen_oid,
    solicitado.rol_origen,
    r.rolinherit as rol_origen_rolinherit
  from roles_solicitados solicitado
  left join pg_catalog.pg_roles r
    on r.rolname::text = solicitado.rol_origen
), aristas as (
  select
    m.member as rol_miembro_oid,
    miembro.rolname::text as rol_miembro,
    m.roleid as rol_concedido_oid,
    concedido.rolname::text as rol_concedido,
    pg_catalog.bool_or(m.admin_option) as admin_option,
    miembro.rolinherit as rolinherit_del_miembro,
    concedido.rolinherit as rolinherit_del_rol_concedido,
    pg_catalog.bool_or(
      coalesce(
        (pg_catalog.to_jsonb(m)->>'inherit_option')::boolean,
        miembro.rolinherit
      )
    ) as inherit_option_del_tramo,
    count(*) as registros_grant
  from pg_catalog.pg_auth_members m
  join pg_catalog.pg_roles miembro on miembro.oid = m.member
  join pg_catalog.pg_roles concedido on concedido.oid = m.roleid
  group by
    m.member,
    miembro.rolname,
    miembro.rolinherit,
    m.roleid,
    concedido.rolname,
    concedido.rolinherit
), membresias as (
  select
    o.rol_origen_oid,
    o.rol_origen,
    a.rol_miembro_oid,
    a.rol_miembro,
    a.rol_concedido_oid,
    a.rol_concedido,
    1 as profundidad,
    array[o.rol_origen_oid, a.rol_concedido_oid]::oid[] as ruta_oids,
    array[o.rol_origen, a.rol_concedido]::text[] as ruta_roles,
    a.admin_option,
    a.rolinherit_del_miembro,
    a.rolinherit_del_rol_concedido,
    a.inherit_option_del_tramo,
    a.inherit_option_del_tramo as herencia_automatica_en_ruta,
    a.registros_grant,
    a.rol_concedido_oid = o.rol_origen_oid as posible_ciclo
  from roles_origen o
  join aristas a on a.rol_miembro_oid = o.rol_origen_oid

  union all

  select
    anterior.rol_origen_oid,
    anterior.rol_origen,
    a.rol_miembro_oid,
    a.rol_miembro,
    a.rol_concedido_oid,
    a.rol_concedido,
    anterior.profundidad + 1,
    anterior.ruta_oids || a.rol_concedido_oid,
    anterior.ruta_roles || a.rol_concedido,
    a.admin_option,
    a.rolinherit_del_miembro,
    a.rolinherit_del_rol_concedido,
    a.inherit_option_del_tramo,
    anterior.herencia_automatica_en_ruta
      and a.inherit_option_del_tramo,
    a.registros_grant,
    a.rol_concedido_oid = any(anterior.ruta_oids)
  from membresias anterior
  join aristas a on a.rol_miembro_oid = anterior.rol_concedido_oid
  where not anterior.posible_ciclo
    and anterior.profundidad < 16
)
select
  '35_membresias_roles_api'::text as resultado,
  o.rol_origen,
  o.rol_origen_oid is not null as rol_origen_existe,
  o.rol_origen_rolinherit,
  case
    when o.rol_origen_oid is null then 'rol_origen_ausente'
    when m.profundidad is null then 'sin_membresias'
    when m.profundidad = 1 then 'directa'
    else 'transitiva'
  end as alcance,
  m.rol_concedido,
  m.profundidad,
  pg_catalog.array_to_string(m.ruta_roles, ' -> ') as ruta_herencia,
  m.admin_option,
  m.rol_miembro,
  m.rolinherit_del_miembro,
  m.rolinherit_del_rol_concedido,
  m.inherit_option_del_tramo,
  m.herencia_automatica_en_ruta,
  m.registros_grant,
  coalesce(m.posible_ciclo, false) as posible_ciclo,
  case
    when m.profundidad = 16 and not m.posible_ciclo then exists (
      select 1
      from aristas siguiente
      where siguiente.rol_miembro_oid = m.rol_concedido_oid
        and not siguiente.rol_concedido_oid = any(m.ruta_oids)
    )
    else false
  end as truncada_por_limite
from roles_origen o
left join membresias m on m.rol_origen_oid = o.rol_origen_oid
order by o.rol_origen, m.profundidad nulls first, ruta_herencia;

-- 36. Privilegios efectivos de roles API sobre objetos expuestos.
with roles_api as (
  select r.oid as rol_oid, r.rolname::text as rol_api
  from pg_catalog.pg_roles r
  where r.rolname in ('anon', 'authenticated', 'service_role')
), privilegios_relaciones as (
  select
    r.rol_api,
    n.nspname::text as esquema,
    c.relname::text as objeto,
    null::text as argumentos_identidad,
    case c.relkind
      when 'v' then 'vista'
      when 'm' then 'vista_materializada'
      else 'tabla'
    end::text as clase_objeto,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'SELECT')
      as tabla_select,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'INSERT')
      as tabla_insert,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'UPDATE')
      as tabla_update,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'DELETE')
      as tabla_delete,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'TRUNCATE')
      as tabla_truncate,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'REFERENCES')
      as tabla_references,
    pg_catalog.has_table_privilege(r.rol_oid, c.oid, 'TRIGGER')
      as tabla_trigger,
    pg_catalog.has_any_column_privilege(r.rol_oid, c.oid, 'SELECT')
      as columna_select,
    pg_catalog.has_any_column_privilege(r.rol_oid, c.oid, 'INSERT')
      as columna_insert,
    pg_catalog.has_any_column_privilege(r.rol_oid, c.oid, 'UPDATE')
      as columna_update,
    pg_catalog.has_any_column_privilege(r.rol_oid, c.oid, 'REFERENCES')
      as columna_references,
    null::boolean as secuencia_usage,
    null::boolean as secuencia_select,
    null::boolean as secuencia_update,
    null::boolean as rutina_execute
  from roles_api r
  cross join pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind in ('r', 'p', 'f', 'v', 'm')
), privilegios_secuencias as (
  select
    r.rol_api,
    n.nspname::text,
    c.relname::text,
    null::text,
    'secuencia'::text,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    pg_catalog.has_sequence_privilege(r.rol_oid, c.oid, 'USAGE'),
    pg_catalog.has_sequence_privilege(r.rol_oid, c.oid, 'SELECT'),
    pg_catalog.has_sequence_privilege(r.rol_oid, c.oid, 'UPDATE'),
    null::boolean
  from roles_api r
  cross join pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and c.relkind = 'S'
), privilegios_rutinas as (
  select
    r.rol_api,
    n.nspname::text,
    p.proname::text,
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    case p.prokind
      when 'p' then 'procedimiento'
      else 'funcion'
    end::text,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    null::boolean,
    pg_catalog.has_function_privilege(r.rol_oid, p.oid, 'EXECUTE')
  from roles_api r
  cross join pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'storage')
    and p.prokind in ('f', 'p')
), privilegios_combinados as (
  select * from privilegios_relaciones
  union all
  select * from privilegios_secuencias
  union all
  select * from privilegios_rutinas
)
select
  '36_privilegios_efectivos_roles_api'::text as resultado,
  rol_api,
  esquema,
  objeto,
  argumentos_identidad,
  clase_objeto,
  tabla_select,
  tabla_insert,
  tabla_update,
  tabla_delete,
  tabla_truncate,
  tabla_references,
  tabla_trigger,
  columna_select,
  columna_insert,
  columna_update,
  columna_references,
  secuencia_usage,
  secuencia_select,
  secuencia_update,
  rutina_execute
from privilegios_combinados
where coalesce(tabla_select, false)
   or coalesce(tabla_insert, false)
   or coalesce(tabla_update, false)
   or coalesce(tabla_delete, false)
   or coalesce(tabla_truncate, false)
   or coalesce(tabla_references, false)
   or coalesce(tabla_trigger, false)
   or coalesce(columna_select, false)
   or coalesce(columna_insert, false)
   or coalesce(columna_update, false)
   or coalesce(columna_references, false)
   or coalesce(secuencia_usage, false)
   or coalesce(secuencia_select, false)
   or coalesce(secuencia_update, false)
   or coalesce(rutina_execute, false)
order by
  rol_api,
  esquema,
  clase_objeto,
  objeto,
  argumentos_identidad nulls first;

-- 37. Settings no sensibles de esquemas PostgREST visibles en la sesion.
with configuracion_allowlist as (
  select
    'pgrst.db_schemas'::text as parametro,
    pg_catalog.current_setting('pgrst.db_schemas', true) as valor

  union all

  select
    'pgrst.db_extra_search_path'::text,
    pg_catalog.current_setting('pgrst.db_extra_search_path', true)
)
select
  '37_esquemas_postgrest_expuestos'::text as resultado,
  parametro,
  valor is not null as disponible,
  valor,
  case
    when valor is null
      then 'configuracion_no_visible_desde_sql_editor'
    else 'configuracion_visible_requiere_contraste_con_postgrest'
  end as diagnostico
from configuracion_allowlist
order by parametro;
