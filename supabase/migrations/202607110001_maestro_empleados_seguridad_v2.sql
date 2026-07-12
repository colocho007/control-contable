-- Control ERPM - Maestro de Empleados seguridad e importacion V2
-- NO EJECUTADA. Migracion aditiva; requiere auditoria de drift y staging.
begin;

alter table public.empleados_planilla
  add column if not exists fecha_nacimiento date,
  add column if not exists nacionalidad text,
  add column if not exists estado_civil text,
  add column if not exists sexo text,
  add column if not exists telefono text,
  add column if not exists correo text,
  add column if not exists direccion text,
  add column if not exists departamento_residencia text,
  add column if not exists municipio_residencia text,
  add column if not exists ocupacion text,
  add column if not exists centro_trabajo text,
  add column if not exists motivo_retiro text,
  add column if not exists version integer not null default 1,
  add column if not exists origen_registro text not null default 'manual',
  add column if not exists importacion_id uuid;

create unique index if not exists idx_empleados_planilla_id_empresa
  on public.empleados_planilla (id, empresa_id);
create index if not exists idx_empleados_busqueda_v2
  on public.empleados_planilla (empresa_id, estado, apellidos, nombres);
create index if not exists idx_empleados_nit_v2
  on public.empleados_planilla (empresa_id, nit)
  where nullif(pg_catalog.btrim(nit), '') is not null;
create index if not exists idx_empleados_igss_v2
  on public.empleados_planilla (empresa_id, igss_numero)
  where nullif(pg_catalog.btrim(igss_numero), '') is not null;

do $preflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'empleados_version_positiva_v2'
      and conrelid = 'public.empleados_planilla'::pg_catalog.regclass
  ) then
    alter table public.empleados_planilla
      add constraint empleados_version_positiva_v2 check (version > 0);
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'empleados_correo_formato_v2'
      and conrelid = 'public.empleados_planilla'::pg_catalog.regclass
  ) then
    alter table public.empleados_planilla
      add constraint empleados_correo_formato_v2
      check (correo is null or correo = '' or correo ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid;
  end if;
end
$preflight$;

create table if not exists public.importaciones_empleados (
  id uuid primary key default gen_random_uuid(),
  archivo_nombre text not null,
  archivo_hash text not null,
  archivo_tamano bigint not null,
  plantilla_version text not null,
  usuario_id uuid not null references public.perfiles(id),
  ambito_hash text not null,
  empresa_ids bigint[] not null default '{}',
  estado text not null default 'reservada',
  total_filas integer not null default 0,
  creados integer not null default 0,
  actualizados integer not null default 0,
  omitidos integer not null default 0,
  rechazados integer not null default 0,
  resultado jsonb not null default '{}'::jsonb,
  creado_at timestamptz not null default pg_catalog.now(),
  completado_at timestamptz,
  constraint importaciones_estado_v2
    check (estado in ('reservada', 'completada', 'parcial', 'fallida', 'revertida')),
  constraint importaciones_archivo_v2
    check (archivo_tamano between 1 and 5242880 and total_filas between 0 and 1000)
);

create unique index if not exists importaciones_empleados_hash_ambito_uidx
  on public.importaciones_empleados (usuario_id, ambito_hash, archivo_hash, plantilla_version);

create table if not exists public.empleados_operaciones_idempotentes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id),
  tipo_operacion text not null,
  ambito_hash text not null,
  idempotency_key text not null,
  request_hash text not null,
  estado text not null default 'reservada',
  resultado jsonb,
  creado_at timestamptz not null default pg_catalog.now(),
  completado_at timestamptz,
  constraint empleados_operacion_estado_v2 check (estado in ('reservada', 'completada', 'fallida')),
  unique (usuario_id, tipo_operacion, ambito_hash, idempotency_key)
);

create table if not exists public.importaciones_empleados_filas (
  id bigint generated always as identity primary key,
  importacion_id uuid not null references public.importaciones_empleados(id),
  fila integer not null,
  fila_origen integer,
  empresa_id bigint,
  empleado_id uuid,
  version_esperada integer,
  accion text not null,
  estado text not null,
  errores text[] not null default '{}',
  advertencias text[] not null default '{}',
  creado_at timestamptz not null default pg_catalog.now(),
  unique (importacion_id, fila),
  constraint import_fila_accion_v2 check (accion in ('crear', 'actualizar', 'ignorar', 'rechazar'))
);

create table if not exists public.empleados_historial (
  id bigint generated always as identity primary key,
  empleado_id uuid not null,
  empresa_id bigint not null,
  tipo_cambio text not null,
  grupo_afectado text not null,
  campos_modificados text[] not null default '{}',
  valores_anteriores_protegidos jsonb not null default '{}'::jsonb,
  valores_nuevos_protegidos jsonb not null default '{}'::jsonb,
  motivo text,
  usuario_id uuid not null references public.perfiles(id),
  origen text not null,
  operacion_id uuid,
  version_anterior integer,
  version_nueva integer,
  creado_at timestamptz not null default pg_catalog.now(),
  foreign key (empleado_id, empresa_id)
    references public.empleados_planilla (id, empresa_id)
);
create index if not exists empleados_historial_empleado_fecha_v2
  on public.empleados_historial (empresa_id, empleado_id, creado_at desc);

-- No contiene la cuenta completa. secreto_referencia debe apuntar a KMS/Vault del servidor.
create table if not exists public.empleados_cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null,
  empresa_id bigint not null,
  banco text not null,
  tipo_cuenta text,
  cuenta_enmascarada text not null,
  secreto_referencia text not null,
  titular text,
  estado_validacion text not null default 'pendiente',
  validado_por uuid references public.perfiles(id),
  validado_at timestamptz,
  activo boolean not null default true,
  version integer not null default 1,
  creado_por uuid not null references public.perfiles(id),
  creado_at timestamptz not null default pg_catalog.now(),
  actualizado_por uuid references public.perfiles(id),
  actualizado_at timestamptz,
  foreign key (empleado_id, empresa_id)
    references public.empleados_planilla (id, empresa_id),
  constraint cuenta_estado_v2 check (estado_validacion in ('pendiente', 'confirmada', 'rechazada'))
);
create unique index if not exists empleado_cuenta_activa_v2
  on public.empleados_cuentas_bancarias (empleado_id) where activo = true;

alter table public.empleados_planilla
  add constraint empleados_planilla_importacion_fk_v2
  foreign key (importacion_id) references public.importaciones_empleados(id) not valid;

-- Casts seguros: devuelven NULL y nunca abortan una validacion por fila.
create or replace function public.empleados_try_bigint_v2(p_text text) returns bigint
language plpgsql immutable set search_path = '' as $$ begin return nullif(pg_catalog.btrim(p_text), '')::bigint; exception when others then return null; end $$;
create or replace function public.empleados_try_integer_v2(p_text text) returns integer
language plpgsql immutable set search_path = '' as $$ begin return nullif(pg_catalog.btrim(p_text), '')::integer; exception when others then return null; end $$;
create or replace function public.empleados_try_numeric_v2(p_text text) returns numeric
language plpgsql immutable set search_path = '' as $$ begin return nullif(pg_catalog.btrim(p_text), '')::numeric; exception when others then return null; end $$;
create or replace function public.empleados_try_date_v2(p_text text) returns date
language plpgsql immutable set search_path = '' as $$ begin return nullif(pg_catalog.btrim(p_text), '')::date; exception when others then return null; end $$;
create or replace function public.empleados_try_uuid_v2(p_text text) returns uuid
language plpgsql immutable set search_path = '' as $$ begin return nullif(pg_catalog.btrim(p_text), '')::uuid; exception when others then return null; end $$;

create or replace function public.empleados_empresa_permitida_v2(p_empresa_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo = true
      and (pg_catalog.lower(coalesce(p.rol, '')) = 'admin'
        or exists (select 1 from public.usuario_empresas ue
          where ue.usuario_id = auth.uid() and ue.empresa_id = p_empresa_id and ue.activo = true))
  )
$$;

create or replace function public.empleados_puede_escribir_v2(p_empresa_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.empleados_empresa_permitida_v2(p_empresa_id)
    and exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.activo = true
        and not exists (select 1 from public.usuario_funciones_operativas f
          where f.usuario_id = auth.uid() and f.empresa_id = p_empresa_id
            and f.activo = true and f.funcion = 'auditor_solo_lectura')
        and (pg_catalog.lower(coalesce(p.rol, '')) in ('admin', 'jefe', 'supervisor')
          or exists (select 1 from public.usuario_funciones_operativas f
            where f.usuario_id = auth.uid() and f.empresa_id = p_empresa_id and f.activo = true
              and f.funcion in ('auxiliar_contable', 'contador_revisor')))
    )
$$;

create or replace function public.empleados_puede_sensible_v2(p_empresa_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.empleados_empresa_permitida_v2(p_empresa_id)
    and exists (
      select 1 from public.perfiles p
      where p.id = auth.uid() and p.activo = true
        and (pg_catalog.lower(coalesce(p.rol, '')) in ('admin', 'jefe')
          or exists (select 1 from public.usuario_funciones_operativas f
            where f.usuario_id = auth.uid() and f.empresa_id = p_empresa_id
              and f.activo = true and f.funcion = 'contador_revisor'))
    )
$$;

create or replace function public.empleados_puede_estado_v2(p_empresa_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.empleados_empresa_permitida_v2(p_empresa_id)
    and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true
      and pg_catalog.lower(coalesce(p.rol, '')) in ('admin', 'jefe', 'supervisor'))
$$;

-- Lista permitida para historial; nunca serializa la fila completa.
create or replace function public.empleados_snapshot_auditable_v2(p public.empleados_planilla) returns jsonb
language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'codigo_empleado', p.codigo_empleado,
    'nombre', pg_catalog.concat_ws(' ', p.nombres, p.apellidos),
    'puesto', p.puesto,
    'departamento_area', p.departamento,
    'tipo_contrato', p.tipo_contrato,
    'jornada', p.jornada,
    'fecha_ingreso', p.fecha_ingreso,
    'fecha_egreso', p.fecha_egreso,
    'estado', p.estado,
    'activo', p.activo,
    'moneda', p.moneda,
    'salario_modificado', p.salario_base is not null,
    'bonificacion_modificada', p.bonificacion_incentivo is not null
  )
$$;

alter table public.importaciones_empleados enable row level security;
alter table public.empleados_operaciones_idempotentes enable row level security;
alter table public.importaciones_empleados_filas enable row level security;
alter table public.empleados_historial enable row level security;
alter table public.empleados_cuentas_bancarias enable row level security;
revoke all on table public.importaciones_empleados, public.empleados_operaciones_idempotentes,
  public.importaciones_empleados_filas, public.empleados_historial,
  public.empleados_cuentas_bancarias from anon, public, authenticated;
grant select on table public.importaciones_empleados, public.importaciones_empleados_filas,
  public.empleados_historial to authenticated;
grant select (id, empleado_id, empresa_id, banco, tipo_cuenta, cuenta_enmascarada,
  titular, estado_validacion, validado_at, activo, version, creado_at, actualizado_at)
  on public.empleados_cuentas_bancarias to authenticated;

drop policy if exists importaciones_empleados_select_v2 on public.importaciones_empleados;
create policy importaciones_empleados_select_v2 on public.importaciones_empleados
for select to authenticated using (
  usuario_id = auth.uid()
  or exists (select 1 from pg_catalog.unnest(empresa_ids) e
    where public.empleados_empresa_permitida_v2(e))
);
drop policy if exists importaciones_filas_select_v2 on public.importaciones_empleados_filas;
create policy importaciones_filas_select_v2 on public.importaciones_empleados_filas
for select to authenticated using (exists (
  select 1 from public.importaciones_empleados i
  where i.id = importacion_id and (i.usuario_id = auth.uid()
    or exists (select 1 from pg_catalog.unnest(i.empresa_ids) e
      where public.empleados_empresa_permitida_v2(e)))
));
drop policy if exists empleados_historial_select_v2 on public.empleados_historial;
create policy empleados_historial_select_v2 on public.empleados_historial
for select to authenticated using (public.empleados_empresa_permitida_v2(empresa_id));
drop policy if exists empleados_cuentas_select_v2 on public.empleados_cuentas_bancarias;
create policy empleados_cuentas_select_v2 on public.empleados_cuentas_bancarias
for select to authenticated using (public.empleados_empresa_permitida_v2(empresa_id));

-- Reserva idempotente atomica. NULL significa conflicto; resultado permite replay.
create or replace function public.empleados_reservar_operacion_v2(
  p_tipo text, p_ambito text, p_key text, p_request_hash text
) returns public.empleados_operaciones_idempotentes
language plpgsql security definer set search_path = '' as $$
declare v public.empleados_operaciones_idempotentes;
begin
    insert into public.empleados_operaciones_idempotentes
    (usuario_id, tipo_operacion, ambito_hash, idempotency_key, request_hash)
  values (auth.uid(), p_tipo, p_ambito, p_key, p_request_hash)
  on conflict (usuario_id, tipo_operacion, ambito_hash, idempotency_key) do nothing
  returning * into v;
  if v.id is null then
    select * into v from public.empleados_operaciones_idempotentes o
    where o.usuario_id = auth.uid() and o.tipo_operacion = p_tipo
      and o.ambito_hash = p_ambito and o.idempotency_key = p_key;
    if v.request_hash = p_request_hash and (
      v.estado = 'fallida' or (v.estado = 'reservada' and v.creado_at < pg_catalog.now() - interval '10 minutes')
    ) then
      update public.empleados_operaciones_idempotentes
      set estado = 'reservada', resultado = null, creado_at = pg_catalog.now(), completado_at = null
      where id = v.id returning * into v;
    end if;
  end if;
  return v;
end
$$;

create or replace function public.empleados_fallar_operacion_v2(p_operacion_id uuid, p_mensaje text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  v_resultado := pg_catalog.jsonb_build_object('ok', false, 'mensaje', pg_catalog.left(coalesce(p_mensaje, 'La operacion no pudo completarse.'), 300));
  update public.empleados_operaciones_idempotentes
  set estado = 'fallida', resultado = v_resultado, completado_at = pg_catalog.now()
  where id = p_operacion_id and usuario_id = auth.uid();
  return v_resultado;
end
$$;

create or replace function public.crear_empleado_v2(p_datos jsonb, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa bigint := public.empleados_try_bigint_v2(p_datos->>'empresa_id');
  v_ingreso date := public.empleados_try_date_v2(p_datos->>'fecha_ingreso');
  v_retiro date := public.empleados_try_date_v2(p_datos->>'fecha_egreso');
  v_salario numeric := public.empleados_try_numeric_v2(p_datos->>'salario_base');
  v_bono numeric := public.empleados_try_numeric_v2(p_datos->>'bonificacion_incentivo');
  v_estado text := p_datos->>'estado';
  v_op public.empleados_operaciones_idempotentes;
  v_id uuid;
  v_hash text;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Sesion no valida.'); end if;
  if v_empresa is null or not public.empleados_puede_escribir_v2(v_empresa) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Empresa no autorizada.');
  end if;
  if nullif(pg_catalog.btrim(p_idempotency_key), '') is null then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Falta la llave de idempotencia.');
  end if;
  if nullif(pg_catalog.btrim(p_datos->>'nombres'), '') is null
    or nullif(pg_catalog.btrim(p_datos->>'apellidos'), '') is null or v_ingreso is null
    or v_salario is null or v_salario < 0 or v_bono is null or v_bono < 0
    or p_datos->>'moneda' not in ('GTQ', 'USD') or v_estado not in ('Activo', 'Inactivo', 'Suspendido', 'Egresado')
    or (v_retiro is not null and v_retiro < v_ingreso) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Los datos obligatorios no son validos.');
  end if;
  if not public.empleados_puede_sensible_v2(v_empresa) and (v_salario <> 0 or v_bono <> 0 or v_estado <> 'Activo') then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'No tienes autorizacion para salario o estado sensible.');
  end if;
  if not public.empleados_puede_sensible_v2(v_empresa)
    and (nullif(p_datos->>'dpi','') is not null
      or nullif(p_datos->>'nit','') is not null
      or nullif(p_datos->>'igss_numero','') is not null) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'No tienes autorizacion para identificadores sensibles.');
  end if;
  v_hash := pg_catalog.md5(p_datos::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.concat_ws('|', auth.uid(), 'crear_empleado', v_empresa, p_idempotency_key), 0));
  v_op := public.empleados_reservar_operacion_v2('crear_empleado', v_empresa::text, p_idempotency_key, v_hash);
  if v_op.request_hash <> v_hash then return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'La llave pertenece a otra solicitud.'); end if;
  if v_op.estado = 'completada' then return v_op.resultado || pg_catalog.jsonb_build_object('idempotency_replay', true); end if;
  if v_op.estado <> 'reservada' then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'La operacion ya fue utilizada y requiere revision.');
  end if;
  insert into public.empleados_planilla (
    empresa_id, codigo_empleado, nombres, apellidos, dpi, nit, igss_numero,
    fecha_ingreso, fecha_egreso, puesto, departamento, tipo_contrato, jornada,
    salario_base, bonificacion_incentivo, moneda, estado, activo, observaciones,
    creado_por, actualizado_por, actualizado_at, version, origen_registro
  ) values (
    v_empresa, nullif(p_datos->>'codigo_empleado',''), pg_catalog.btrim(p_datos->>'nombres'),
    pg_catalog.btrim(p_datos->>'apellidos'), nullif(p_datos->>'dpi',''), nullif(p_datos->>'nit',''),
    nullif(p_datos->>'igss_numero',''), v_ingreso, v_retiro, nullif(p_datos->>'puesto',''),
    nullif(p_datos->>'departamento',''), nullif(p_datos->>'tipo_contrato',''),
    nullif(p_datos->>'jornada',''), v_salario, v_bono, p_datos->>'moneda', v_estado,
    v_estado = 'Activo', nullif(p_datos->>'observaciones',''), auth.uid(), auth.uid(), pg_catalog.now(), 1, 'manual'
  ) returning id into v_id;
  insert into public.empleados_historial
    (empleado_id, empresa_id, tipo_cambio, grupo_afectado, campos_modificados, usuario_id, origen, operacion_id, version_nueva)
  values (v_id, v_empresa, 'creacion', 'maestro', array['registro'], auth.uid(), 'manual', v_op.id, 1);
  update public.empleados_operaciones_idempotentes set estado = 'completada', completado_at = pg_catalog.now(),
    resultado = pg_catalog.jsonb_build_object('ok', true, 'mensaje', 'Empleado creado correctamente.', 'empleado_id', v_id, 'version', 1)
  where id = v_op.id returning resultado into v_op.resultado;
  return v_op.resultado;
exception when unique_violation then
  update public.empleados_operaciones_idempotentes set estado = 'fallida', completado_at = pg_catalog.now() where id = v_op.id;
  return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Existe un empleado con identificadores coincidentes en la empresa.');
end
$$;

create or replace function public.actualizar_empleado_v2(
  p_empleado_id uuid, p_version_esperada integer, p_datos jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old public.empleados_planilla%rowtype;
  v_new public.empleados_planilla%rowtype;
  v_ingreso date := public.empleados_try_date_v2(p_datos->>'fecha_ingreso');
  v_retiro date := public.empleados_try_date_v2(p_datos->>'fecha_egreso');
  v_salario numeric := public.empleados_try_numeric_v2(p_datos->>'salario_base');
  v_bono numeric := public.empleados_try_numeric_v2(p_datos->>'bonificacion_incentivo');
  v_estado text := p_datos->>'estado';
  v_op public.empleados_operaciones_idempotentes;
  v_hash text;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Sesion no valida.'); end if;
  select * into v_old from public.empleados_planilla where id = p_empleado_id;
  if not found or not public.empleados_puede_escribir_v2(v_old.empresa_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Empleado no disponible o sin permiso.');
  end if;
  if nullif(pg_catalog.btrim(p_idempotency_key), '') is null then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Falta la llave de idempotencia.');
  end if;
  if nullif(pg_catalog.btrim(p_datos->>'nombres'),'') is null
    or nullif(pg_catalog.btrim(p_datos->>'apellidos'),'') is null or v_ingreso is null
    or v_salario is null or v_salario < 0 or v_bono is null or v_bono < 0
    or p_datos->>'moneda' not in ('GTQ','USD') or v_estado not in ('Activo','Inactivo','Suspendido','Egresado')
    or (v_retiro is not null and v_retiro < v_ingreso) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'Los datos obligatorios no son validos.');
  end if;
  if (v_salario is distinct from v_old.salario_base or v_bono is distinct from v_old.bonificacion_incentivo)
    and not public.empleados_puede_sensible_v2(v_old.empresa_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'No tienes autorizacion para modificar salario.');
  end if;
  if v_estado is distinct from v_old.estado and not public.empleados_puede_estado_v2(v_old.empresa_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'No tienes autorizacion para cambiar el estado laboral.');
  end if;
  if (nullif(p_datos->>'dpi','') is distinct from v_old.dpi
      or nullif(p_datos->>'nit','') is distinct from v_old.nit
      or nullif(p_datos->>'igss_numero','') is distinct from v_old.igss_numero)
    and not public.empleados_puede_sensible_v2(v_old.empresa_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'No tienes autorizacion para modificar identificadores sensibles.');
  end if;
  v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', p_empleado_id, p_version_esperada, p_datos::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.concat_ws('|', auth.uid(), 'actualizar_empleado', v_old.empresa_id, p_empleado_id, p_idempotency_key), 0));
  v_op := public.empleados_reservar_operacion_v2('actualizar_empleado', pg_catalog.concat_ws(':',v_old.empresa_id,p_empleado_id), p_idempotency_key, v_hash);
  if v_op.request_hash <> v_hash then return pg_catalog.jsonb_build_object('ok', false, 'mensaje', 'La llave pertenece a otra solicitud.'); end if;
  if v_op.estado = 'completada' then return v_op.resultado || pg_catalog.jsonb_build_object('idempotency_replay', true); end if;
  update public.empleados_planilla set
    codigo_empleado=nullif(p_datos->>'codigo_empleado',''), nombres=pg_catalog.btrim(p_datos->>'nombres'),
    apellidos=pg_catalog.btrim(p_datos->>'apellidos'), dpi=nullif(p_datos->>'dpi',''),
    nit=nullif(p_datos->>'nit',''), igss_numero=nullif(p_datos->>'igss_numero',''),
    fecha_ingreso=v_ingreso, fecha_egreso=v_retiro, puesto=nullif(p_datos->>'puesto',''),
    departamento=nullif(p_datos->>'departamento',''), tipo_contrato=nullif(p_datos->>'tipo_contrato',''),
    jornada=nullif(p_datos->>'jornada',''), salario_base=v_salario, bonificacion_incentivo=v_bono,
    moneda=p_datos->>'moneda', estado=v_estado, activo=v_estado='Activo', observaciones=nullif(p_datos->>'observaciones',''),
    actualizado_por=auth.uid(), actualizado_at=pg_catalog.now(), version=version+1
  where id=p_empleado_id and empresa_id=v_old.empresa_id and version=p_version_esperada returning * into v_new;
  if not found then return public.empleados_fallar_operacion_v2(v_op.id, 'La ficha cambio. Recarga antes de guardar.'); end if;
  insert into public.empleados_historial
    (empleado_id,empresa_id,tipo_cambio,grupo_afectado,campos_modificados,valores_anteriores_protegidos,
     valores_nuevos_protegidos,usuario_id,origen,operacion_id,version_anterior,version_nueva)
  values (v_new.id,v_new.empresa_id,case when v_new.estado='Egresado' then 'retiro' when v_new.estado='Inactivo' then 'inactivacion'
    when v_old.estado<>v_new.estado and v_new.estado='Activo' then 'reactivacion' else 'actualizacion' end,
    'maestro',array['ficha'],public.empleados_snapshot_auditable_v2(v_old),public.empleados_snapshot_auditable_v2(v_new),
    auth.uid(),'manual',v_op.id,v_old.version,v_new.version);
  update public.empleados_operaciones_idempotentes set estado='completada',completado_at=pg_catalog.now(),
    resultado=pg_catalog.jsonb_build_object('ok',true,'mensaje','Ficha actualizada correctamente.','empleado_id',v_new.id,'version',v_new.version)
  where id=v_op.id returning resultado into v_op.resultado;
  return v_op.resultado;
exception when unique_violation then return public.empleados_fallar_operacion_v2(v_op.id, 'Los identificadores coinciden con otro empleado.'); end
$$;

-- Valida una fila y determina coincidencia sin confiar en decisiones del cliente.
create or replace function public.empleados_validar_fila_v2(p_fila jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa bigint := public.empleados_try_bigint_v2(p_fila->>'empresa_id');
  v_ingreso date := public.empleados_try_date_v2(p_fila->>'fecha_ingreso');
  v_nacimiento date := public.empleados_try_date_v2(p_fila->>'fecha_nacimiento');
  v_retiro date := public.empleados_try_date_v2(p_fila->>'fecha_retiro');
  v_salario numeric := public.empleados_try_numeric_v2(p_fila->>'salario_base');
  v_bono numeric := public.empleados_try_numeric_v2(p_fila->>'bonificacion_incentivo');
  v_ids uuid[] := '{}'; v_id uuid; v_version integer; v_errores text[] := '{}'; v_advertencias text[] := '{}';
begin
  if v_empresa is null or not public.empleados_puede_sensible_v2(v_empresa) then v_errores:=array_append(v_errores,'Empresa no autorizada para importacion.'); end if;
  if nullif(pg_catalog.btrim(p_fila->>'nombres'),'') is null then v_errores:=array_append(v_errores,'Nombres obligatorios.'); end if;
  if nullif(pg_catalog.btrim(p_fila->>'apellidos'),'') is null then v_errores:=array_append(v_errores,'Apellidos obligatorios.'); end if;
  if v_ingreso is null then v_errores:=array_append(v_errores,'Fecha de ingreso invalida.'); end if;
  if nullif(p_fila->>'fecha_nacimiento','') is not null and v_nacimiento is null then v_errores:=array_append(v_errores,'Fecha de nacimiento invalida.'); end if;
  if nullif(p_fila->>'fecha_retiro','') is not null and v_retiro is null then v_errores:=array_append(v_errores,'Fecha de retiro invalida.'); end if;
  if v_retiro is not null and v_ingreso is not null and v_retiro<v_ingreso then v_errores:=array_append(v_errores,'Retiro anterior al ingreso.'); end if;
  if v_salario is null or v_salario<0 or v_bono is null or v_bono<0 then v_errores:=array_append(v_errores,'Monto invalido.'); end if;
  if p_fila->>'moneda' not in('GTQ','USD') then v_errores:=array_append(v_errores,'Moneda invalida.'); end if;
  if p_fila->>'estado_laboral' not in('Activo','Inactivo','Suspendido','Egresado') then v_errores:=array_append(v_errores,'Estado laboral invalido.'); end if;
  if nullif(p_fila->>'correo','') is not null and p_fila->>'correo' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then v_errores:=array_append(v_errores,'Correo invalido.'); end if;
  if v_empresa is not null then
    select coalesce(pg_catalog.array_agg(distinct e.id),'{}') into v_ids
    from public.empleados_planilla e where e.empresa_id=v_empresa and (
      (nullif(p_fila->>'codigo_interno','') is not null and e.codigo_empleado=p_fila->>'codigo_interno') or
      (nullif(p_fila->>'dpi','') is not null and e.dpi=p_fila->>'dpi') or
      (nullif(p_fila->>'nit','') is not null and e.nit=p_fila->>'nit') or
      (nullif(p_fila->>'afiliacion_igss','') is not null and e.igss_numero=p_fila->>'afiliacion_igss') or
      (v_nacimiento is not null and pg_catalog.lower(pg_catalog.concat_ws(' ',e.nombres,e.apellidos))=
        pg_catalog.lower(pg_catalog.concat_ws(' ',p_fila->>'nombres',p_fila->>'apellidos')) and e.fecha_nacimiento=v_nacimiento));
  end if;
  if pg_catalog.cardinality(v_ids)>1 then v_errores:=array_append(v_errores,'Identificadores ambiguos coinciden con empleados distintos.');
  elsif pg_catalog.cardinality(v_ids)=1 then v_id=v_ids[1]; select version into v_version from public.empleados_planilla where id=v_id and empresa_id=v_empresa;
    v_advertencias:=array_append(v_advertencias,'Coincide con un empleado existente.'); end if;
  if nullif(p_fila->>'dpi','') is null then v_advertencias:=array_append(v_advertencias,'DPI no informado.'); end if;
  return p_fila || pg_catalog.jsonb_build_object(
    'estado_validacion',case when pg_catalog.cardinality(v_errores)>0 then 'rechazada' when v_id is not null then 'duplicada' when pg_catalog.cardinality(v_advertencias)>0 then 'advertencia' else 'valida' end,
    'accion_propuesta',case when pg_catalog.cardinality(v_errores)>0 then 'corregir' when v_id is not null then 'actualizar' else 'crear' end,
    'empleado_existente_id',v_id,'version_esperada',v_version,'errores',pg_catalog.to_jsonb(v_errores),'advertencias',pg_catalog.to_jsonb(v_advertencias));
end
$$;

create or replace function public.validar_importacion_empleados_v2(p_archivo_hash text,p_plantilla_version text,p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f jsonb; v jsonb; v_ordinal bigint; salida jsonb:='[]'; total integer:=0; validas integer:=0; incompletas integer:=0; duplicadas integer:=0; advertencias integer:=0; rechazadas integer:=0;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok',false,'mensaje','Sesion no valida.'); end if;
  if nullif(pg_catalog.btrim(p_archivo_hash),'') is null or p_archivo_hash !~ '^[0-9a-fA-F]{64}$'
    or nullif(pg_catalog.btrim(p_plantilla_version),'') is null then return pg_catalog.jsonb_build_object('ok',false,'mensaje','Hash o version de plantilla invalidos.'); end if;
  if pg_catalog.jsonb_typeof(p_filas) is distinct from 'array' then return pg_catalog.jsonb_build_object('ok',false,'mensaje','Las filas deben ser un arreglo JSON.'); end if;
  total:=pg_catalog.jsonb_array_length(p_filas); if total<1 or total>1000 then return pg_catalog.jsonb_build_object('ok',false,'mensaje','Cantidad de filas fuera del limite.'); end if;
  for f, v_ordinal in select value, ordinality from pg_catalog.jsonb_array_elements(p_filas) with ordinality loop
    v:=public.empleados_validar_fila_v2(f) || pg_catalog.jsonb_build_object('fila', v_ordinal + 1, 'fila_origen', public.empleados_try_integer_v2(f->>'fila'));
    salida:=salida||v;
    case v->>'estado_validacion' when 'valida' then validas:=validas+1; when 'advertencia' then validas:=validas+1;advertencias:=advertencias+1;
      when 'duplicada' then duplicadas:=duplicadas+1;advertencias:=advertencias+1; else rechazadas:=rechazadas+1;incompletas:=incompletas+1; end case;
  end loop;
  return pg_catalog.jsonb_build_object('ok',true,'filas',salida,'resumen',pg_catalog.jsonb_build_object('total',total,'validas',validas,'incompletas',incompletas,'duplicadas',duplicadas,'advertencias',advertencias,'rechazadas',rechazadas));
end
$$;

create or replace function public.importar_empleados_v2(p_archivo_nombre text,p_archivo_hash text,p_archivo_tamano bigint,p_plantilla_version text,p_idempotency_key text,p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f jsonb; v jsonb; v_ordinal bigint; v_decision text; v_empresas bigint[]:='{}'; v_empresa bigint; v_ambito text; v_hash text;
  v_op public.empleados_operaciones_idempotentes; v_imp public.importaciones_empleados%rowtype;
  v_id uuid; v_version integer; v_affected integer; v_old public.empleados_planilla%rowtype;
  v_new public.empleados_planilla%rowtype; v_campos text[];
  creados integer:=0; actualizados integer:=0; omitidos integer:=0; rechazados integer:=0;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok',false,'mensaje','Sesion no valida.'); end if;
  if pg_catalog.jsonb_typeof(p_filas) is distinct from 'array' then return pg_catalog.jsonb_build_object('ok',false,'mensaje','Las filas deben ser un arreglo JSON.'); end if;
  if pg_catalog.jsonb_array_length(p_filas) not between 1 and 1000 or p_archivo_tamano not between 1 and 5242880
    or nullif(pg_catalog.btrim(p_archivo_nombre),'') is null or pg_catalog.lower(p_archivo_nombre) not like '%.xlsx'
    or nullif(pg_catalog.btrim(p_archivo_hash),'') is null or p_archivo_hash !~ '^[0-9a-fA-F]{64}$'
    or nullif(pg_catalog.btrim(p_plantilla_version),'') is null or nullif(pg_catalog.btrim(p_idempotency_key),'') is null then
    return pg_catalog.jsonb_build_object('ok',false,'mensaje','Metadatos de importacion invalidos.');
  end if;
  for f in select value from pg_catalog.jsonb_array_elements(p_filas) loop
    v_empresa:=public.empleados_try_bigint_v2(f->>'empresa_id');
    if v_empresa is not null and public.empleados_puede_sensible_v2(v_empresa) then v_empresas:=array_append(v_empresas,v_empresa); end if;
  end loop;
  select coalesce(pg_catalog.array_agg(distinct x order by x),'{}') into v_empresas from pg_catalog.unnest(v_empresas) x;
  if pg_catalog.cardinality(v_empresas)=0 then return pg_catalog.jsonb_build_object('ok',false,'mensaje','No hay empresas autorizadas para importar.'); end if;
  v_ambito:=pg_catalog.array_to_string(v_empresas,',');
  v_hash:=pg_catalog.md5(pg_catalog.concat_ws('|',p_archivo_hash,p_plantilla_version,p_filas::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.concat_ws('|', auth.uid(), 'importar_empleados', v_ambito, p_idempotency_key), 0));
  v_op:=public.empleados_reservar_operacion_v2('importar_empleados',v_ambito,p_idempotency_key,v_hash);
  if v_op.request_hash<>v_hash then return pg_catalog.jsonb_build_object('ok',false,'mensaje','La llave pertenece a otra importacion.'); end if;
  if v_op.estado='completada' then return v_op.resultado||pg_catalog.jsonb_build_object('idempotency_replay',true); end if;
  if v_op.estado<>'reservada' then return coalesce(v_op.resultado,pg_catalog.jsonb_build_object('ok',false,'mensaje','La importacion requiere una nueva llave.')); end if;
  insert into public.importaciones_empleados(archivo_nombre,archivo_hash,archivo_tamano,plantilla_version,usuario_id,ambito_hash,empresa_ids,total_filas)
  values(pg_catalog.left(p_archivo_nombre,255),p_archivo_hash,p_archivo_tamano,p_plantilla_version,auth.uid(),v_ambito,v_empresas,pg_catalog.jsonb_array_length(p_filas))
  on conflict(usuario_id,ambito_hash,archivo_hash,plantilla_version) do nothing returning * into v_imp;
  if v_imp.id is null then return public.empleados_fallar_operacion_v2(v_op.id, 'Este archivo ya fue procesado en el mismo ambito.'); end if;
  for f, v_ordinal in select value, ordinality from pg_catalog.jsonb_array_elements(p_filas) with ordinality loop
    begin
    v:=public.empleados_validar_fila_v2(f); v_empresa:=public.empleados_try_bigint_v2(v->>'empresa_id'); v_id:=public.empleados_try_uuid_v2(v->>'empleado_existente_id'); v_version:=public.empleados_try_integer_v2(v->>'version_esperada');
    v_decision:=pg_catalog.lower(coalesce(f->>'decision_usuario',''));
    if v_decision='ignorar' then
      omitidos:=omitidos+1;
      insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,accion,estado)
      values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,'ignorar','omitida');
      continue;
    end if;
    if v_decision='corregir' then
      rechazados:=rechazados+1;
      insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,accion,estado,errores)
      values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,'rechazar','pendiente',array['El usuario decidio corregir la fila antes de importar.']);
      continue;
    end if;
    if v_decision not in('crear','actualizar') then
      rechazados:=rechazados+1;
      insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,accion,estado,errores)
      values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,'rechazar','rechazada',array['Decision de usuario invalida.']);
      continue;
    end if;
    if v->>'estado_validacion'='rechazada' then rechazados:=rechazados+1;
      insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,accion,estado,errores,advertencias) values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,'rechazar','rechazada',array(select pg_catalog.jsonb_array_elements_text(v->'errores')),array(select pg_catalog.jsonb_array_elements_text(v->'advertencias'))); continue; end if;
    if (v_decision='crear' and v_id is not null) or (v_decision='actualizar' and v_id is null) then
      rechazados:=rechazados+1;
      insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,accion,estado,errores)
      values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,'rechazar','rechazada',array['La decision no es compatible con la coincidencia calculada por el servidor.']);
      continue;
    end if;
      if v_decision='crear' then
        insert into public.empleados_planilla(empresa_id,codigo_empleado,nombres,apellidos,dpi,nit,igss_numero,fecha_nacimiento,nacionalidad,estado_civil,telefono,correo,direccion,departamento_residencia,municipio_residencia,puesto,ocupacion,departamento,centro_trabajo,tipo_contrato,jornada,fecha_ingreso,fecha_egreso,motivo_retiro,estado,activo,salario_base,bonificacion_incentivo,moneda,observaciones,creado_por,actualizado_por,actualizado_at,version,origen_registro,importacion_id)
        values(v_empresa,nullif(v->>'codigo_interno',''),v->>'nombres',v->>'apellidos',nullif(v->>'dpi',''),nullif(v->>'nit',''),nullif(v->>'afiliacion_igss',''),public.empleados_try_date_v2(v->>'fecha_nacimiento'),nullif(v->>'nacionalidad',''),nullif(v->>'estado_civil',''),nullif(v->>'telefono',''),nullif(v->>'correo',''),nullif(v->>'direccion',''),nullif(v->>'departamento_residencia',''),nullif(v->>'municipio_residencia',''),nullif(v->>'puesto',''),nullif(v->>'ocupacion',''),nullif(v->>'departamento_area',''),nullif(v->>'centro_trabajo',''),nullif(v->>'tipo_contrato',''),nullif(v->>'jornada',''),public.empleados_try_date_v2(v->>'fecha_ingreso'),public.empleados_try_date_v2(v->>'fecha_retiro'),nullif(v->>'motivo_retiro',''),v->>'estado_laboral',(v->>'estado_laboral')='Activo',public.empleados_try_numeric_v2(v->>'salario_base'),public.empleados_try_numeric_v2(v->>'bonificacion_incentivo'),v->>'moneda',nullif(v->>'observaciones',''),auth.uid(),auth.uid(),pg_catalog.now(),1,'importacion',v_imp.id) returning id into v_id;
        creados:=creados+1; v_version:=1;
      else
        select * into v_old from public.empleados_planilla where id=v_id and empresa_id=v_empresa;
        v_campos:=pg_catalog.array_remove(array[
          case when v_old.nombres is distinct from v->>'nombres' then 'nombres' end,
          case when v_old.apellidos is distinct from v->>'apellidos' then 'apellidos' end,
          case when v_old.puesto is distinct from nullif(v->>'puesto','') then 'puesto' end,
          case when v_old.departamento is distinct from nullif(v->>'departamento_area','') then 'departamento_area' end,
          case when v_old.tipo_contrato is distinct from nullif(v->>'tipo_contrato','') then 'tipo_contrato' end,
          case when v_old.jornada is distinct from nullif(v->>'jornada','') then 'jornada' end,
          case when v_old.fecha_ingreso is distinct from public.empleados_try_date_v2(v->>'fecha_ingreso') then 'fecha_ingreso' end,
          case when v_old.fecha_egreso is distinct from public.empleados_try_date_v2(v->>'fecha_retiro') then 'fecha_retiro' end,
          case when v_old.estado is distinct from v->>'estado_laboral' then 'estado' end,
          case when v_old.salario_base is distinct from public.empleados_try_numeric_v2(v->>'salario_base') then 'salario_base' end,
          case when v_old.bonificacion_incentivo is distinct from public.empleados_try_numeric_v2(v->>'bonificacion_incentivo') then 'bonificacion_incentivo' end,
          case when v_old.telefono is distinct from nullif(v->>'telefono','') then 'telefono' end,
          case when v_old.correo is distinct from nullif(v->>'correo','') then 'correo' end
        ],null);
        if pg_catalog.cardinality(v_campos)=0 then
          omitidos:=omitidos+1;
          insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,empleado_id,version_esperada,accion,estado,advertencias)
          values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,v_id,v_version,'ignorar','sin_cambios',array['La fila no contiene cambios permitidos.']);
          continue;
        end if;
        if 'estado'=any(v_campos) and not public.empleados_puede_estado_v2(v_empresa) then
          raise exception using errcode='42501';
        end if;
        update public.empleados_planilla set
          nombres=v->>'nombres',apellidos=v->>'apellidos',puesto=nullif(v->>'puesto',''),
          departamento=nullif(v->>'departamento_area',''),tipo_contrato=nullif(v->>'tipo_contrato',''),
          jornada=nullif(v->>'jornada',''),fecha_ingreso=public.empleados_try_date_v2(v->>'fecha_ingreso'),
          fecha_egreso=public.empleados_try_date_v2(v->>'fecha_retiro'),motivo_retiro=nullif(v->>'motivo_retiro',''),
          estado=v->>'estado_laboral',activo=(v->>'estado_laboral')='Activo',
          salario_base=public.empleados_try_numeric_v2(v->>'salario_base'),
          bonificacion_incentivo=public.empleados_try_numeric_v2(v->>'bonificacion_incentivo'),
          telefono=nullif(v->>'telefono',''),correo=nullif(v->>'correo',''),
          actualizado_por=auth.uid(),actualizado_at=pg_catalog.now(),version=version+1,importacion_id=v_imp.id
        where id=v_id and empresa_id=v_empresa and version=v_version returning * into v_new;
        get diagnostics v_affected = row_count;
        if v_affected<>1 then raise exception using errcode='40001'; end if;
        actualizados:=actualizados+1; v_version:=v_version+1;
      end if;
      insert into public.empleados_historial(empleado_id,empresa_id,tipo_cambio,grupo_afectado,campos_modificados,valores_anteriores_protegidos,valores_nuevos_protegidos,usuario_id,origen,operacion_id,version_anterior,version_nueva)
      values(v_id,v_empresa,case when v_version=1 then 'creacion' else 'actualizacion' end,'importacion',case when v_version=1 then array['registro'] else v_campos end,
        case when v_version=1 then '{}'::jsonb else public.empleados_snapshot_auditable_v2(v_old) end,
        case when v_version=1 then '{}'::jsonb else public.empleados_snapshot_auditable_v2(v_new) end,
        auth.uid(),'excel',v_imp.id,case when v_version=1 then null else v_version-1 end,v_version);
      insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,empleado_id,version_esperada,accion,estado,advertencias)
      values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,v_id,public.empleados_try_integer_v2(v->>'version_esperada'),case when v_version=1 then 'crear' else 'actualizar' end,'completada',array(select pg_catalog.jsonb_array_elements_text(v->'advertencias')));
    exception when serialization_failure then rechazados:=rechazados+1; insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,empleado_id,version_esperada,accion,estado,errores) values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,v_id,v_version,'rechazar','rechazada',array['Conflicto de concurrencia; recargue y valide nuevamente.']);
    when unique_violation then rechazados:=rechazados+1; insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,empleado_id,accion,estado,errores) values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,v_id,'rechazar','rechazada',array['Duplicado detectado durante la importacion.']);
    when insufficient_privilege then rechazados:=rechazados+1; insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,empleado_id,accion,estado,errores) values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,v_id,'rechazar','rechazada',array['No tienes permiso para cambiar el estado laboral.']);
    when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation then rechazados:=rechazados+1; insert into public.importaciones_empleados_filas(importacion_id,fila,fila_origen,empresa_id,empleado_id,accion,estado,errores) values(v_imp.id,v_ordinal,public.empleados_try_integer_v2(f->>'fila'),v_empresa,v_id,'rechazar','rechazada',array['La fila contiene datos incompatibles.']); end;
  end loop;
  update public.importaciones_empleados set
    empresa_ids=v_empresas,
    estado=case when rechazados>0 then 'parcial' else 'completada' end,
    creados=creados,
    actualizados=actualizados,
    omitidos=omitidos,
    rechazados=rechazados,
    completado_at=pg_catalog.now(),
    resultado=pg_catalog.jsonb_build_object('ok',true,'importacion_id',v_imp.id,'creados',creados,'actualizados',actualizados,'omitidos',omitidos,'rechazados',rechazados)
  where id=v_imp.id returning * into v_imp;
  update public.empleados_operaciones_idempotentes set estado='completada',completado_at=pg_catalog.now(),resultado=v_imp.resultado where id=v_op.id;
  return v_imp.resultado;
end
$$;

-- SECURITY DEFINER: revocacion explicita, incluidos helpers de autorizacion.
revoke all on function public.empleados_empresa_permitida_v2(bigint) from public, anon;
revoke all on function public.empleados_puede_escribir_v2(bigint) from public, anon;
revoke all on function public.empleados_puede_sensible_v2(bigint) from public, anon;
revoke all on function public.empleados_puede_estado_v2(bigint) from public, anon;
revoke all on function public.empleados_reservar_operacion_v2(text,text,text,text) from public, anon;
revoke all on function public.empleados_fallar_operacion_v2(uuid,text) from public, anon;
revoke all on function public.empleados_validar_fila_v2(jsonb) from public, anon;
revoke all on function public.crear_empleado_v2(jsonb,text) from public, anon;
revoke all on function public.actualizar_empleado_v2(uuid,integer,jsonb,text) from public, anon;
revoke all on function public.validar_importacion_empleados_v2(text,text,jsonb) from public, anon;
revoke all on function public.importar_empleados_v2(text,text,bigint,text,text,jsonb) from public, anon;
grant execute on function public.crear_empleado_v2(jsonb,text),
  public.actualizar_empleado_v2(uuid,integer,jsonb,text),
  public.validar_importacion_empleados_v2(text,text,jsonb),
  public.importar_empleados_v2(text,text,bigint,text,text,jsonb) to authenticated;
grant execute on function public.empleados_empresa_permitida_v2(bigint) to authenticated;

-- Cierre de escrituras directas. Fallar de forma segura si Supabase contiene una
-- policy de escritura no versionada que deba auditarse antes de aplicar.
do $policies_empleados$
declare v_policy text;
begin
  select pg_catalog.string_agg(p.policyname, ', ' order by p.policyname) into v_policy
  from pg_catalog.pg_policies p
  where p.schemaname = 'public' and p.tablename = 'empleados_planilla'
    and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and p.policyname not in (
      'planilla_empleados_insert_empresa',
      'planilla_empleados_update_empresa',
      'planilla_empleados_delete_bloqueado'
    );
  if v_policy is not null then
    raise exception 'Policies de escritura no versionadas en empleados_planilla: %', v_policy;
  end if;
end
$policies_empleados$;

alter table public.empleados_planilla enable row level security;

drop policy if exists "planilla_empleados_insert_empresa" on public.empleados_planilla;
drop policy if exists "planilla_empleados_update_empresa" on public.empleados_planilla;
drop policy if exists "planilla_empleados_delete_bloqueado" on public.empleados_planilla;
drop policy if exists "planilla_empleados_select_empresa" on public.empleados_planilla;
drop policy if exists "empleados_select_empresa_v2" on public.empleados_planilla;
drop policy if exists "empleados_delete_bloqueado_v2" on public.empleados_planilla;

revoke insert, update, delete on table public.empleados_planilla from authenticated;
grant select on table public.empleados_planilla to authenticated;

create policy "empleados_select_empresa_v2"
on public.empleados_planilla
for select to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo = true
      and (
        pg_catalog.lower(coalesce(p.rol, '')) = 'admin'
        or exists (
          select 1 from public.usuario_empresas ue
          where ue.usuario_id = auth.uid()
            and ue.empresa_id = empleados_planilla.empresa_id
            and ue.activo = true
        )
      )
  )
);

create policy "empleados_delete_bloqueado_v2"
on public.empleados_planilla
for delete to authenticated
using (false);

-- service_role y el propietario no se revocan. No volver a ejecutar despues
-- sql/planilla_rls_base.sql, porque ese script restaura grants/policies directas.

commit;
