-- RPC transaccional revisable para cerrar periodos contables.
-- Repite en servidor los bloqueos duros de la previsualizacion del frontend.
-- No crea asientos automaticos.

create or replace function public.cerrar_periodo_contable(
  p_periodo_id uuid,
  p_empresa_id bigint,
  p_observaciones text,
  p_cerrado_por uuid,
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
  v_periodo periodos_contables%rowtype;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_documentos_pendientes integer := 0;
  v_asientos_pendientes integer := 0;
  v_asientos_descuadrados integer := 0;
  v_asientos_moneda_mezclada integer := 0;
  v_resultado jsonb;
begin
  if v_usuario_id is null or v_usuario_id <> p_cerrado_por then
    return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'sesion_no_valida', 'mensaje', 'Sesion no valida para cerrar el periodo.');
  end if;
  select * into v_perfil from perfiles where id = v_usuario_id and activo = true;
  if not found then
    return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'usuario_inactivo', 'mensaje', 'Usuario no activo para cerrar periodos.');
  end if;

  if v_idempotency_key is not null then
    select * into v_idempotency from idempotency_keys_operativas where idempotency_key = v_idempotency_key for update;
    if found then
      if v_idempotency.usuario_id <> p_cerrado_por
        or v_idempotency.empresa_id is distinct from p_empresa_id
        or v_idempotency.modulo <> 'contabilidad'
        or v_idempotency.accion <> 'cerrar_periodo_contable'
      then
        return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'idempotency_operacion_distinta', 'mensaje', 'La llave de idempotencia pertenece a otra operacion.');
      end if;
      if v_idempotency.estado = 'completada' and v_idempotency.resultado_resumen is not null then
        return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
      end if;
      return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'idempotency_key_usada', 'mensaje', 'La operacion ya esta en proceso o utilizo esta llave.');
    end if;
    insert into idempotency_keys_operativas (
      expira_at, idempotency_key, usuario_id, empresa_id, modulo, accion, estado,
      request_hash, entidad_tipo, entidad_id
    ) values (
      now() + interval '24 hours', v_idempotency_key, p_cerrado_por, p_empresa_id,
      'contabilidad', 'cerrar_periodo_contable', 'en_proceso',
      md5(concat_ws('|', p_periodo_id, p_empresa_id, p_observaciones, p_cerrado_por)),
      'periodo_contable', p_periodo_id::text
    ) returning * into v_idempotency;
  end if;

  begin
    if not exists (
      select 1 from usuario_empresas ue
      where ue.usuario_id = v_usuario_id and ue.empresa_id = p_empresa_id and ue.activo = true
    ) then raise exception 'No tienes asignacion activa para operar esta empresa.'; end if;
    if exists (
      select 1 from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id and ufo.empresa_id = p_empresa_id
        and ufo.funcion = 'auditor_solo_lectura' and ufo.activo = true
    ) then raise exception 'El auditor de solo lectura no puede cerrar periodos contables.'; end if;
    if not exists (
      select 1 from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id and ufo.empresa_id = p_empresa_id
        and ufo.funcion = 'contabilidad_cierre_periodo' and ufo.activo = true
    ) then raise exception 'Se requiere la funcion contabilidad_cierre_periodo.'; end if;

    select * into v_periodo from periodos_contables
    where id = p_periodo_id and empresa_id = p_empresa_id for update;
    if not found or lower(coalesce(v_periodo.estado, '')) <> 'abierto' then
      raise exception 'El periodo no esta abierto para cierre.';
    end if;

    select count(*) into v_documentos_pendientes
    from documentos_contables_revision
    where empresa_id = p_empresa_id
      and estado in ('Pendiente', 'En revision', 'Observado', 'Vencido')
      and fecha_documento between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    select count(*) into v_asientos_pendientes
    from asientos_contables
    where empresa_id = p_empresa_id and periodo_id = p_periodo_id
      and lower(coalesce(estado, '')) in ('borrador', 'requiere_revision');

    select count(*) into v_asientos_descuadrados
    from asientos_contables a
    where a.empresa_id = p_empresa_id and a.periodo_id = p_periodo_id
      and (
        abs(round(coalesce(a.total_debe, 0), 2) - round(coalesce(a.total_haber, 0), 2)) > 0.005
        or exists (
          select 1
          from movimientos_contables_detalle d
          where d.asiento_id = a.id
          group by d.asiento_id
          having abs(round(sum(coalesce(d.debe, 0)), 2) - round(sum(coalesce(d.haber, 0)), 2)) > 0.005
             or abs(round(sum(coalesce(d.debe, 0)), 2) - round(coalesce(a.total_debe, 0), 2)) > 0.005
             or abs(round(sum(coalesce(d.haber, 0)), 2) - round(coalesce(a.total_haber, 0), 2)) > 0.005
        )
      );

    select count(*) into v_asientos_moneda_mezclada
    from asientos_contables a
    where a.empresa_id = p_empresa_id and a.periodo_id = p_periodo_id
      and exists (
        select 1 from movimientos_contables_detalle d
        where d.asiento_id = a.id
          and upper(trim(coalesce(d.moneda, ''))) <> upper(trim(coalesce(a.moneda_base, '')))
      );

    if v_documentos_pendientes > 0 or v_asientos_pendientes > 0
      or v_asientos_descuadrados > 0 or v_asientos_moneda_mezclada > 0
    then
      raise exception 'El periodo tiene bloqueos: documentos pendientes %, asientos pendientes %, asientos descuadrados %, moneda mezclada %.',
        v_documentos_pendientes, v_asientos_pendientes, v_asientos_descuadrados, v_asientos_moneda_mezclada;
    end if;

    update periodos_contables
    set estado = 'cerrado', cerrado_por = p_cerrado_por, cerrado_at = now(), actualizado_at = now(),
        metadatos = coalesce(metadatos, '{}'::jsonb) || jsonb_build_object(
          'cerrado_por_rpc', true, 'observaciones_cierre', nullif(trim(coalesce(p_observaciones, '')), ''),
          'documentos_pendientes', v_documentos_pendientes, 'asientos_pendientes', v_asientos_pendientes,
          'asientos_descuadrados', v_asientos_descuadrados, 'asientos_moneda_mezclada', v_asientos_moneda_mezclada,
          'asiento_automatico_creado', false
        )
    where id = p_periodo_id and empresa_id = p_empresa_id and estado = 'abierto'
    returning * into v_periodo;
    if not found then raise exception 'El periodo cambio de estado antes de cerrar.'; end if;

    insert into auditoria_eventos (
      usuario_id, usuario_nombre_snapshot, empresa_id, modulo, accion, entidad_tipo, entidad_id,
      estado_anterior, estado_nuevo, motivo, descripcion, sensible, visible_calendario, metadatos, origen
    ) values (
      p_cerrado_por, v_perfil.nombre, p_empresa_id, 'contabilidad', 'cerrar_periodo_contable',
      'periodo_contable', v_periodo.id::text, 'abierto', 'cerrado',
      nullif(trim(coalesce(p_observaciones, '')), ''), 'Periodo contable cerrado por RPC transaccional.',
      true, true, jsonb_build_object('idempotency_key', v_idempotency_key, 'asiento_automatico_creado', false),
      'rpc_cerrar_periodo_contable'
    );

    v_resultado := jsonb_build_object('ok', true, 'periodo', to_jsonb(v_periodo));
    if v_idempotency_key is not null then
      update idempotency_keys_operativas set estado = 'completada', resultado_resumen = v_resultado, error_resumen = null where id = v_idempotency.id;
    end if;
    return v_resultado;
  exception when others then
    if v_idempotency_key is not null and v_idempotency.id is not null then
      update idempotency_keys_operativas set estado = 'fallida', error_resumen = left(sqlerrm, 500) where id = v_idempotency.id;
    end if;
    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'cerrar_periodo_contable_fallido',
      'mensaje', 'No se pudo cerrar el periodo contable. Revise permisos y bloqueos.',
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

revoke all on function public.cerrar_periodo_contable(uuid, bigint, text, uuid, text) from public, anon;
grant execute on function public.cerrar_periodo_contable(uuid, bigint, text, uuid, text) to authenticated;
