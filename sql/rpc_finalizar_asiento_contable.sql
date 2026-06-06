-- RPC transaccional para finalizar un asiento contable existente.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- No modifica detalle ni crea asientos nuevos; valida y registra un borrador.
-- Requiere sql/seguridad_operativa.sql para idempotency_keys_operativas.

create or replace function public.finalizar_asiento_contable(
  p_asiento_id uuid,
  p_empresa_id bigint,
  p_finalizado_por uuid,
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
  v_empresa empresas%rowtype;
  v_periodo periodos_contables%rowtype;
  v_asiento asientos_contables%rowtype;
  v_asiento_anterior asientos_contables%rowtype;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_detalle record;
  v_lineas integer := 0;
  v_total_debe numeric := 0;
  v_total_haber numeric := 0;
  v_resultado jsonb;
begin
  if v_usuario_id is null or v_usuario_id <> p_finalizado_por then
    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'sesion_no_valida',
      'mensaje', 'Sesion no valida para finalizar el asiento.'
    );
  end if;

  select *
    into v_perfil
  from perfiles
  where id = v_usuario_id
    and activo = true;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'usuario_inactivo',
      'mensaje', 'Usuario no activo para finalizar asientos.'
    );
  end if;

  if v_idempotency_key is not null then
    select *
      into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_finalizado_por
        or v_idempotency.empresa_id is distinct from p_empresa_id
        or v_idempotency.modulo <> 'contabilidad'
        or v_idempotency.accion <> 'finalizar_asiento_contable'
      then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_operacion_distinta',
          'mensaje', 'La llave de idempotencia pertenece a otra operacion.'
        );
      end if;

      if v_idempotency.estado = 'completada' and v_idempotency.resultado_resumen is not null then
        return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
      end if;

      return jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_key_usada',
        'mensaje', 'La operacion ya esta en proceso o utilizo esta llave.'
      );
    end if;

    insert into idempotency_keys_operativas (
      expira_at,
      idempotency_key,
      usuario_id,
      empresa_id,
      modulo,
      accion,
      estado,
      request_hash,
      entidad_tipo,
      entidad_id
    )
    values (
      now() + interval '24 hours',
      v_idempotency_key,
      p_finalizado_por,
      p_empresa_id,
      'contabilidad',
      'finalizar_asiento_contable',
      'en_proceso',
      md5(concat_ws('|', p_asiento_id, p_empresa_id, p_finalizado_por)),
      'asiento_contable',
      p_asiento_id::text
    )
    returning * into v_idempotency;
  end if;

  begin
    select *
      into v_empresa
    from empresas
    where id = p_empresa_id;

    if not found
      or lower(coalesce(v_empresa.estado, '')) in (
        'inactiva', 'inactivo', 'archivada', 'archivado', 'prueba', 'demo', 'testing'
      )
    then
      raise exception 'La empresa no esta operativa para finalizar asientos.';
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
      raise exception 'No tienes permiso para operar esta empresa.';
    end if;

    if exists (
      select 1
      from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id
        and ufo.empresa_id = p_empresa_id
        and ufo.activo = true
        and ufo.funcion = 'auditor_solo_lectura'
    )
    then
      raise exception 'El auditor de solo lectura no puede finalizar asientos contables.';
    end if;

    if lower(coalesce(v_perfil.rol, '')) <> 'admin'
      and not exists (
        select 1
        from usuario_funciones_operativas ufo
        where ufo.usuario_id = v_usuario_id
          and ufo.empresa_id = p_empresa_id
          and ufo.activo = true
          and ufo.funcion = 'contador_revisor'
      )
    then
      raise exception 'Solo contador_revisor puede finalizar asientos contables.';
    end if;

    select *
      into v_asiento
    from asientos_contables
    where id = p_asiento_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'No se encontro el asiento contable para la empresa indicada.';
    end if;

    if lower(coalesce(v_asiento.estado, '')) not in ('borrador', 'requiere_revision') then
      raise exception 'Solo se pueden finalizar asientos en borrador o que requieren revision.';
    end if;

    v_asiento_anterior := v_asiento;

    select *
      into v_periodo
    from periodos_contables
    where id = v_asiento.periodo_id
      and empresa_id = p_empresa_id
    for update;

    if not found or lower(coalesce(v_periodo.estado, '')) <> 'abierto' then
      raise exception 'El periodo contable no permite finalizar asientos.';
    end if;

    for v_detalle in
      select
        d.cuenta_id,
        round(coalesce(d.debe, 0), 2) as debe,
        round(coalesce(d.haber, 0), 2) as haber,
        upper(trim(coalesce(d.moneda, ''))) as moneda,
        c.empresa_id as cuenta_empresa_id,
        c.activo as cuenta_activa,
        c.permite_movimientos
      from movimientos_contables_detalle d
      join catalogo_cuentas c on c.id = d.cuenta_id
      where d.asiento_id = v_asiento.id
    loop
      v_lineas := v_lineas + 1;

      if v_detalle.cuenta_activa is not true
        or v_detalle.permite_movimientos is not true
        or (
          v_detalle.cuenta_empresa_id is not null
          and v_detalle.cuenta_empresa_id <> p_empresa_id
        )
      then
        raise exception 'Una cuenta del asiento no permite movimientos para esta empresa.';
      end if;

      if v_detalle.debe < 0
        or v_detalle.haber < 0
        or (v_detalle.debe > 0 and v_detalle.haber > 0)
        or (v_detalle.debe = 0 and v_detalle.haber = 0)
      then
        raise exception 'El detalle del asiento contiene montos no validos.';
      end if;

      if v_detalle.moneda <> upper(trim(coalesce(v_asiento.moneda_base, ''))) then
        raise exception 'Todas las lineas deben usar la moneda base del asiento.';
      end if;

      v_total_debe := round(v_total_debe + v_detalle.debe, 2);
      v_total_haber := round(v_total_haber + v_detalle.haber, 2);
    end loop;

    if v_lineas < 2 then
      raise exception 'El asiento debe tener al menos dos lineas.';
    end if;

    if abs(v_total_debe - v_total_haber) > 0.005
      or abs(v_total_debe - round(coalesce(v_asiento.total_debe, 0), 2)) > 0.005
      or abs(v_total_haber - round(coalesce(v_asiento.total_haber, 0), 2)) > 0.005
    then
      raise exception 'El asiento no esta balanceado o no coincide con su detalle.';
    end if;

    update asientos_contables
    set estado = 'registrado',
        actualizado_at = now(),
        metadatos = coalesce(metadatos, '{}'::jsonb) || jsonb_build_object(
          'finalizado_por', p_finalizado_por,
          'finalizado_at', now(),
          'finalizado_por_rpc', true
        )
    where id = v_asiento.id
      and empresa_id = p_empresa_id
      and lower(coalesce(estado, '')) in ('borrador', 'requiere_revision')
    returning * into v_asiento;

    if not found then
      raise exception 'El asiento cambio de estado antes de finalizar.';
    end if;

    insert into auditoria_eventos (
      usuario_id,
      usuario_nombre_snapshot,
      empresa_id,
      modulo,
      accion,
      entidad_tipo,
      entidad_id,
      estado_anterior,
      estado_nuevo,
      descripcion,
      sensible,
      visible_calendario,
      metadatos,
      origen
    )
    values (
      p_finalizado_por,
      v_perfil.nombre,
      p_empresa_id,
      'contabilidad',
      'finalizar_asiento_contable',
      'asiento_contable',
      v_asiento.id::text,
      v_asiento_anterior.estado,
      v_asiento.estado,
      'Asiento contable finalizado por RPC transaccional.',
      true,
      true,
      jsonb_build_object(
        'periodo_id', v_asiento.periodo_id,
        'fecha', v_asiento.fecha,
        'total_debe', v_total_debe,
        'total_haber', v_total_haber,
        'lineas', v_lineas,
        'idempotency_key', v_idempotency_key
      ),
      'rpc_finalizar_asiento_contable'
    );

    v_resultado := jsonb_build_object(
      'ok', true,
      'asiento', to_jsonb(v_asiento)
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          resultado_resumen = v_resultado,
          error_resumen = null
      where id = v_idempotency.id;
    end if;

    return v_resultado;
  exception when others then
    if v_idempotency_key is not null and v_idempotency.id is not null then
      update idempotency_keys_operativas
      set estado = 'fallida',
          error_resumen = left(sqlerrm, 500)
      where id = v_idempotency.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'finalizar_asiento_contable_fallido',
      'mensaje', 'No se pudo finalizar el asiento contable. Revise su estado y detalle.',
      'detalle_resumido', null,
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

grant execute on function public.finalizar_asiento_contable(uuid, bigint, uuid, text) to authenticated;
