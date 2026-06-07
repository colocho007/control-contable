-- RPC transaccional revisable para anular un asiento contable.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Requiere sql/seguridad_operativa.sql para idempotency_keys_operativas.

create or replace function public.anular_asiento_contable(
  p_asiento_id uuid,
  p_empresa_id bigint,
  p_motivo text,
  p_anulado_por uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_perfil perfiles%rowtype;
  v_asiento asientos_contables%rowtype;
  v_periodo periodos_contables%rowtype;
  v_estado_anterior text;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_resultado jsonb;
begin
  if v_usuario_id is null or v_usuario_id <> p_anulado_por then
    return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'sesion_no_valida', 'mensaje', 'Sesion no valida para anular el asiento.');
  end if;

  select * into v_perfil from perfiles where id = v_usuario_id and activo = true;
  if not found then
    return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'usuario_inactivo', 'mensaje', 'Usuario no activo para anular asientos.');
  end if;

  if v_idempotency_key is not null then
    select * into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_anulado_por
        or v_idempotency.empresa_id is distinct from p_empresa_id
        or v_idempotency.modulo <> 'contabilidad'
        or v_idempotency.accion <> 'anular_asiento_contable'
      then
        return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'idempotency_operacion_distinta', 'mensaje', 'La llave de idempotencia pertenece a otra operacion.');
      end if;
      if v_idempotency.estado = 'completada' and v_idempotency.resultado_resumen is not null then
        return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
      end if;
      return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'idempotency_key_usada', 'mensaje', 'La operacion ya esta en proceso o utilizo esta llave.');
    end if;

    insert into idempotency_keys_operativas (
      expira_at, idempotency_key, usuario_id, empresa_id, modulo, accion,
      estado, request_hash, entidad_tipo, entidad_id
    )
    values (
      now() + interval '24 hours', v_idempotency_key, p_anulado_por, p_empresa_id,
      'contabilidad', 'anular_asiento_contable', 'en_proceso',
      md5(concat_ws('|', p_asiento_id, p_empresa_id, v_motivo, p_anulado_por)),
      'asiento_contable', p_asiento_id::text
    )
    returning * into v_idempotency;
  end if;

  begin
    if v_motivo is null or length(v_motivo) < 5 then
      raise exception 'Debe indicar un motivo de anulacion de al menos 5 caracteres.';
    end if;

    if not exists (
      select 1 from usuario_empresas ue
      where ue.usuario_id = v_usuario_id and ue.empresa_id = p_empresa_id and ue.activo = true
    ) then
      raise exception 'No tienes asignacion activa para operar esta empresa.';
    end if;

    if exists (
      select 1 from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id and ufo.empresa_id = p_empresa_id
        and ufo.funcion = 'auditor_solo_lectura' and ufo.activo = true
    ) then
      raise exception 'El auditor de solo lectura no puede anular asientos contables.';
    end if;

    if not exists (
      select 1 from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id and ufo.empresa_id = p_empresa_id
        and ufo.funcion = 'contador_revisor' and ufo.activo = true
    ) then
      raise exception 'Solo contador_revisor puede anular asientos contables.';
    end if;

    select * into v_asiento
    from asientos_contables
    where id = p_asiento_id and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'No se encontro el asiento contable para la empresa indicada.';
    end if;
    if lower(coalesce(v_asiento.estado, '')) not in ('borrador', 'requiere_revision', 'registrado') then
      raise exception 'El estado actual del asiento no permite anulacion.';
    end if;
    v_estado_anterior := v_asiento.estado;

    select * into v_periodo
    from periodos_contables
    where id = v_asiento.periodo_id and empresa_id = p_empresa_id
    for update;

    if not found or lower(coalesce(v_periodo.estado, '')) <> 'abierto' then
      raise exception 'No se puede anular un asiento de un periodo cerrado o bloqueado.';
    end if;

    update asientos_contables
    set estado = 'anulado',
        anulado_por = p_anulado_por,
        anulado_at = now(),
        motivo_anulacion = v_motivo,
        actualizado_at = now(),
        metadatos = coalesce(metadatos, '{}'::jsonb) || jsonb_build_object('anulado_por_rpc', true)
    where id = p_asiento_id and empresa_id = p_empresa_id
    returning * into v_asiento;

    insert into auditoria_eventos (
      usuario_id, usuario_nombre_snapshot, empresa_id, modulo, accion, entidad_tipo,
      entidad_id, estado_anterior, estado_nuevo, motivo, descripcion, sensible,
      visible_calendario, metadatos, origen
    )
    values (
      p_anulado_por, v_perfil.nombre, p_empresa_id, 'contabilidad',
      'anular_asiento_contable', 'asiento_contable', v_asiento.id::text,
      v_estado_anterior, 'anulado', v_motivo, 'Asiento contable anulado por RPC transaccional.',
      true, true, jsonb_build_object('periodo_id', v_asiento.periodo_id, 'idempotency_key', v_idempotency_key),
      'rpc_anular_asiento_contable'
    );

    v_resultado := jsonb_build_object('ok', true, 'asiento', to_jsonb(v_asiento));
    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada', resultado_resumen = v_resultado, error_resumen = null
      where id = v_idempotency.id;
    end if;
    return v_resultado;
  exception when others then
    if v_idempotency_key is not null and v_idempotency.id is not null then
      update idempotency_keys_operativas set estado = 'fallida', error_resumen = left(sqlerrm, 500)
      where id = v_idempotency.id;
    end if;
    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'anular_asiento_contable_fallido',
      'mensaje', 'No se pudo anular el asiento contable. Revise permisos, estado y periodo.',
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

revoke all on function public.anular_asiento_contable(uuid, bigint, text, uuid, text) from public, anon;
grant execute on function public.anular_asiento_contable(uuid, bigint, text, uuid, text) to authenticated;
