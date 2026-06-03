-- RPC persistente de rate limit operativo para Control+.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Requiere sql/seguridad_operativa.sql.
-- No borra filas ni modifica RLS de otras tablas.
-- Si se excede el limite, registra intentos_bloqueados y devuelve permitido=false.
-- Las excepciones se reservan para sesion invalida, parametros invalidos o empresa ajena,
-- antes de escribir evidencia operativa que deba persistir.

create or replace function public.registrar_rate_limit_operativo(
  p_clave text,
  p_alcance text,
  p_modulo text,
  p_accion text,
  p_limite integer,
  p_ventana_segundos integer,
  p_empresa_id bigint default null,
  p_ip_hash text default null,
  p_metadatos jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_perfil perfiles%rowtype;
  v_clave text := nullif(trim(coalesce(p_clave, '')), '');
  v_alcance text := lower(nullif(trim(coalesce(p_alcance, '')), ''));
  v_modulo text := nullif(trim(coalesce(p_modulo, '')), '');
  v_accion text := nullif(trim(coalesce(p_accion, '')), '');
  v_ip_hash text := nullif(trim(coalesce(p_ip_hash, '')), '');
  v_ahora timestamptz := now();
  v_ventana_inicio timestamptz;
  v_ventana_fin timestamptz;
  v_rate_limit rate_limits_operativos%rowtype;
  v_permitido boolean;
  v_retry_after integer;
begin
  if v_usuario_id is null then
    raise exception 'Sesion no valida para aplicar rate limit.';
  end if;

  select *
    into v_perfil
  from perfiles
  where id = v_usuario_id
    and activo = true;

  if not found then
    raise exception 'Usuario no autorizado para aplicar rate limit.';
  end if;

  if v_clave is null or length(v_clave) > 250 then
    raise exception 'La clave de rate limit es obligatoria y debe ser menor a 250 caracteres.';
  end if;

  if v_alcance not in ('ip', 'usuario', 'empresa', 'usuario_empresa', 'assist') then
    raise exception 'El alcance de rate limit no es valido.';
  end if;

  if v_modulo is null or length(v_modulo) > 120 then
    raise exception 'El modulo de rate limit es obligatorio.';
  end if;

  if v_accion is null or length(v_accion) > 120 then
    raise exception 'La accion de rate limit es obligatoria.';
  end if;

  if p_limite is null or p_limite <= 0 then
    raise exception 'El limite de rate limit debe ser mayor a cero.';
  end if;

  if p_ventana_segundos is null or p_ventana_segundos <= 0 then
    raise exception 'La ventana de rate limit debe ser mayor a cero.';
  end if;

  if p_ventana_segundos > 86400 then
    raise exception 'La ventana de rate limit no puede ser mayor a 24 horas.';
  end if;

  if p_empresa_id is not null then
    if not exists (select 1 from empresas e where e.id = p_empresa_id) then
      raise exception 'La empresa indicada no existe.';
    end if;

    if lower(coalesce(v_perfil.rol, '')) <> 'admin'
      and not exists (
        select 1
        from usuario_empresas ue
        where ue.usuario_id = v_usuario_id
          and ue.empresa_id = p_empresa_id
          and ue.activo = true
      )
    then
      raise exception 'No tienes permiso para aplicar rate limit a esta empresa.';
    end if;
  end if;

  if v_alcance in ('ip', 'assist') and v_ip_hash is null then
    raise exception 'El ip_hash es obligatorio para este alcance.';
  end if;

  v_ventana_inicio := to_timestamp(
    floor(extract(epoch from v_ahora) / p_ventana_segundos) * p_ventana_segundos
  );
  v_ventana_fin := v_ventana_inicio + make_interval(secs => p_ventana_segundos);

  insert into rate_limits_operativos (
    clave,
    alcance,
    usuario_id,
    empresa_id,
    ip_hash,
    modulo,
    accion,
    ventana_inicio,
    ventana_fin,
    contador,
    limite,
    bloqueado,
    ultimo_intento_at,
    metadatos
  )
  values (
    v_clave,
    v_alcance,
    v_usuario_id,
    p_empresa_id,
    v_ip_hash,
    v_modulo,
    v_accion,
    v_ventana_inicio,
    v_ventana_fin,
    1,
    p_limite,
    false,
    v_ahora,
    coalesce(p_metadatos, '{}'::jsonb)
  )
  on conflict (clave, ventana_inicio, ventana_fin)
  do update
    set contador = rate_limits_operativos.contador + 1,
        limite = excluded.limite,
        bloqueado = (rate_limits_operativos.contador + 1) > excluded.limite,
        ultimo_intento_at = excluded.ultimo_intento_at,
        usuario_id = excluded.usuario_id,
        empresa_id = excluded.empresa_id,
        ip_hash = excluded.ip_hash,
        modulo = excluded.modulo,
        accion = excluded.accion,
        alcance = excluded.alcance,
        metadatos = coalesce(rate_limits_operativos.metadatos, '{}'::jsonb)
          || jsonb_build_object(
            'ultimo_intento_at', v_ahora,
            'ultimo_metadatos', coalesce(p_metadatos, '{}'::jsonb)
          )
  returning * into v_rate_limit;

  v_permitido := v_rate_limit.contador <= v_rate_limit.limite;
  v_retry_after := greatest(
    0,
    ceil(extract(epoch from (v_rate_limit.ventana_fin - v_ahora)))::integer
  );

  if not v_permitido then
    insert into intentos_bloqueados (
      usuario_id,
      empresa_id,
      ip_hash,
      modulo,
      accion,
      motivo,
      severidad,
      entidad_tipo,
      entidad_id,
      mensaje,
      metadatos
    )
    values (
      v_usuario_id,
      p_empresa_id,
      v_ip_hash,
      v_modulo,
      v_accion,
      'rate_limit_excedido',
      case when v_rate_limit.contador >= (v_rate_limit.limite * 2) then 'alta' else 'media' end,
      'rate_limits_operativos',
      v_rate_limit.id::text,
      'Rate limit operativo excedido.',
      jsonb_build_object(
        'clave', v_clave,
        'alcance', v_alcance,
        'contador', v_rate_limit.contador,
        'limite', v_rate_limit.limite,
        'ventana_inicio', v_rate_limit.ventana_inicio,
        'ventana_fin', v_rate_limit.ventana_fin,
        'retry_after_segundos', v_retry_after,
        'metadatos', coalesce(p_metadatos, '{}'::jsonb),
        'ip_real_guardada', false
      )
    );
  end if;

  return jsonb_build_object(
    'permitido', v_permitido,
    'contador', v_rate_limit.contador,
    'limite', v_rate_limit.limite,
    'bloqueado', not v_permitido,
    'retry_after_segundos', case when v_permitido then 0 else v_retry_after end,
    'ventana_fin', v_rate_limit.ventana_fin
  );
end;
$$;

grant execute on function public.registrar_rate_limit_operativo(
  text,
  text,
  text,
  text,
  integer,
  integer,
  bigint,
  text,
  jsonb
) to authenticated;
