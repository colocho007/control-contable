-- Auditoria de RLS para Control+.
-- Ejecutar en Supabase SQL Editor. Este archivo NO cambia politicas ni datos.

with tablas_objetivo(tabla) as (
  values
    ('perfiles'),
    ('empresas'),
    ('usuario_empresas'),
    ('usuario_modulos'),
    ('usuario_funciones_operativas'),
    ('modulos_sistema'),
    ('clientes'),
    ('proveedores'),
    ('cuentas_por_cobrar'),
    ('pagos_cuentas_por_cobrar'),
    ('cuentas_por_pagar'),
    ('pagos_cuentas_por_pagar'),
    ('documentos_contables_revision'),
    ('distribuciones_documentos_contables'),
    ('impuestos_configuracion'),
    ('documentos_tramites'),
    ('auditoria_eventos'),
    ('fondos_empresa'),
    ('chequeras'),
    ('cheques'),
    ('ordenes_compra'),
    ('catalogo_cuentas'),
    ('periodos_contables'),
    ('asientos_contables'),
    ('movimientos_contables_detalle'),
    ('calendario_eventos'),
    ('reinicios_controlados'),
    ('movimientos'),
    ('tareas'),
    ('borradores_trabajo'),
    ('cheques_fisicos'),
    ('cheques_historial'),
    ('ordenes_compra_firmas'),
    ('ordenes_compra_historial'),
    ('movimientos_historial')
)
select
  t.tabla,
  c.oid::regclass as objeto,
  c.relrowsecurity as rls_activado,
  c.relforcerowsecurity as rls_forzado,
  case
    when c.oid is null then 'NO_EXISTE'
    when c.relrowsecurity then 'OK_RLS_ACTIVO'
    else 'RIESGO_RLS_DESACTIVADO'
  end as diagnostico
from tablas_objetivo t
left join pg_class c
  on c.relname = t.tabla
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by t.tabla;

-- Politicas existentes por tabla/operacion.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in (
    'perfiles',
    'empresas',
    'usuario_empresas',
    'usuario_modulos',
    'usuario_funciones_operativas',
    'modulos_sistema',
    'clientes',
    'proveedores',
    'cuentas_por_cobrar',
    'pagos_cuentas_por_cobrar',
    'cuentas_por_pagar',
    'pagos_cuentas_por_pagar',
    'documentos_contables_revision',
    'distribuciones_documentos_contables',
    'impuestos_configuracion',
    'documentos_tramites',
    'auditoria_eventos',
    'fondos_empresa',
    'chequeras',
    'cheques',
    'ordenes_compra',
    'catalogo_cuentas',
    'periodos_contables',
    'asientos_contables',
    'movimientos_contables_detalle',
    'calendario_eventos',
    'reinicios_controlados',
    'movimientos',
    'tareas',
    'borradores_trabajo',
    'cheques_fisicos',
    'cheques_historial',
    'ordenes_compra_firmas',
    'ordenes_compra_historial',
    'movimientos_historial'
  )
order by tablename, cmd, policyname;

-- Politicas potencialmente peligrosas: true, public, anon o expresiones vacias.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    roles::text ilike '%public%'
    or roles::text ilike '%anon%'
    or coalesce(qual, '') in ('', 'true', '(true)')
    or coalesce(with_check, '') in ('true', '(true)')
  )
order by tablename, cmd, policyname;

-- DELETE habilitado por politicas.
select
  schemaname,
  tablename,
  policyname,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and cmd = 'DELETE'
order by tablename, policyname;

-- Grants directos peligrosos sobre tablas publicas.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
  and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES')
order by table_name, grantee, privilege_type;

-- Grants de INSERT/UPDATE/SELECT para revisar con RLS.
select
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
group by table_schema, table_name, grantee
order by table_name, grantee;

-- Buckets y politicas de Storage para documentos.
select
  id,
  name,
  public as bucket_publico,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('documentos-tramites');

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by cmd, policyname;
