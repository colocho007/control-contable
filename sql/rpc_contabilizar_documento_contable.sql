-- RPC transaccional revisable para marcar un documento como Contabilizado.
-- Valida respaldo documental y distribucion, pero no crea asientos automaticos.

create or replace function public.contabilizar_documento_contable(
  p_documento_id uuid,
  p_empresa_id bigint,
  p_contabilizado_por uuid,
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
  v_documento documentos_contables_revision%rowtype;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_lineas integer := 0;
  v_debito numeric := 0;
  v_credito numeric := 0;
  v_estado_anterior text;
  v_resultado jsonb;
begin
  if v_usuario_id is null or v_usuario_id <> p_contabilizado_por then
    return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'sesion_no_valida', 'mensaje', 'Sesion no valida para contabilizar el documento.');
  end if;
  select * into v_perfil from perfiles where id = v_usuario_id and activo = true;
  if not found then
    return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'usuario_inactivo', 'mensaje', 'Usuario no activo para contabilizar documentos.');
  end if;

  if v_idempotency_key is not null then
    select * into v_idempotency from idempotency_keys_operativas where idempotency_key = v_idempotency_key for update;
    if found then
      if v_idempotency.usuario_id <> p_contabilizado_por
        or v_idempotency.empresa_id is distinct from p_empresa_id
        or v_idempotency.modulo <> 'contabilidad'
        or v_idempotency.accion <> 'contabilizar_documento_contable'
      then return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'idempotency_operacion_distinta', 'mensaje', 'La llave de idempotencia pertenece a otra operacion.'); end if;
      if v_idempotency.estado = 'completada' and v_idempotency.resultado_resumen is not null then
        return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
      end if;
      return jsonb_build_object('ok', false, 'permitido', false, 'codigo', 'idempotency_key_usada', 'mensaje', 'La operacion ya esta en proceso o utilizo esta llave.');
    end if;
    insert into idempotency_keys_operativas (
      expira_at, idempotency_key, usuario_id, empresa_id, modulo, accion, estado,
      request_hash, entidad_tipo, entidad_id
    ) values (
      now() + interval '24 hours', v_idempotency_key, p_contabilizado_por, p_empresa_id,
      'contabilidad', 'contabilizar_documento_contable', 'en_proceso',
      md5(concat_ws('|', p_documento_id, p_empresa_id, p_contabilizado_por)),
      'documento_contable_revision', p_documento_id::text
    ) returning * into v_idempotency;
  end if;

  begin
    if not exists (
      select 1 from usuario_empresas ue where ue.usuario_id = v_usuario_id and ue.empresa_id = p_empresa_id and ue.activo = true
    ) then raise exception 'No tienes asignacion activa para operar esta empresa.'; end if;
    if exists (
      select 1 from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id and ufo.empresa_id = p_empresa_id and ufo.funcion = 'auditor_solo_lectura' and ufo.activo = true
    ) then raise exception 'El auditor de solo lectura no puede contabilizar documentos.'; end if;
    if not exists (
      select 1 from usuario_funciones_operativas ufo
      where ufo.usuario_id = v_usuario_id and ufo.empresa_id = p_empresa_id and ufo.funcion = 'contador_revisor' and ufo.activo = true
    ) then raise exception 'Solo contador_revisor puede contabilizar documentos.'; end if;

    select * into v_documento from documentos_contables_revision
    where id = p_documento_id and empresa_id = p_empresa_id for update;
    if not found then raise exception 'No se encontro el documento contable para la empresa indicada.'; end if;
    if v_documento.estado in ('Contabilizado', 'Rechazado') then raise exception 'El documento ya esta cerrado y no puede contabilizarse.'; end if;
    v_estado_anterior := v_documento.estado;

    if not exists (
      select 1 from documentos_tramites dt
      where dt.empresa_id = p_empresa_id and dt.modulo = 'contabilidad'
        and dt.entidad_tipo = 'documento_contable_revision'
        and dt.entidad_id = p_documento_id::text and dt.estado = 'activo'
    ) then raise exception 'Debe existir al menos un respaldo documental activo antes de contabilizar.'; end if;

    select count(*), round(coalesce(sum(d.debito), 0), 2), round(coalesce(sum(d.credito), 0), 2)
    into v_lineas, v_debito, v_credito
    from distribuciones_documentos_contables d
    join catalogo_cuentas c on c.id = d.cuenta_id
    where d.documento_contable_id = p_documento_id and d.empresa_id = p_empresa_id and d.activo = true
      and c.activo = true and c.permite_movimientos = true
      and (c.empresa_id is null or c.empresa_id = p_empresa_id)
      and upper(coalesce(d.moneda, '')) = upper(coalesce(v_documento.moneda, ''));

    if v_lineas < 2 or abs(v_debito - v_credito) > 0.005 then
      raise exception 'La distribucion contable debe tener al menos dos lineas validas y estar balanceada.';
    end if;
    if exists (
      select 1 from distribuciones_documentos_contables d
      left join catalogo_cuentas c on c.id = d.cuenta_id
      where d.documento_contable_id = p_documento_id and d.empresa_id = p_empresa_id and d.activo = true
        and (c.id is null or c.activo is not true or c.permite_movimientos is not true
          or (c.empresa_id is not null and c.empresa_id <> p_empresa_id)
          or upper(coalesce(d.moneda, '')) <> upper(coalesce(v_documento.moneda, '')))
    ) then raise exception 'La distribucion contiene cuentas o monedas no validas para la empresa.'; end if;

    update documentos_contables_revision
    set estado = 'Contabilizado', contabilizado_por = p_contabilizado_por, contabilizado_at = now(),
        revisado_por = coalesce(revisado_por, p_contabilizado_por), revisado_at = coalesce(revisado_at, now()),
        actualizado_at = now(),
        metadatos = coalesce(metadatos, '{}'::jsonb) || jsonb_build_object(
          'contabilizado_por_rpc', true, 'distribucion_total_debito', v_debito,
          'distribucion_total_credito', v_credito, 'asiento_automatico_creado', false
        )
    where id = p_documento_id and empresa_id = p_empresa_id
    returning * into v_documento;

    insert into auditoria_eventos (
      usuario_id, usuario_nombre_snapshot, empresa_id, modulo, accion, entidad_tipo, entidad_id,
      estado_anterior, estado_nuevo, descripcion, sensible, visible_calendario, metadatos, origen
    ) values (
      p_contabilizado_por, v_perfil.nombre, p_empresa_id, 'contabilidad', 'contabilizar_documento_contable',
      'documento_contable_revision', v_documento.id::text, v_estado_anterior, 'Contabilizado',
      'Documento contable contabilizado por RPC transaccional.', true, false,
      jsonb_build_object('lineas_distribucion', v_lineas, 'total_debito', v_debito, 'total_credito', v_credito, 'idempotency_key', v_idempotency_key),
      'rpc_contabilizar_documento_contable'
    );

    v_resultado := jsonb_build_object('ok', true, 'documento', to_jsonb(v_documento));
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
      'codigo', 'contabilizar_documento_contable_fallido',
      'mensaje', 'No se pudo contabilizar el documento. Revise permisos, respaldo y distribucion.',
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

revoke all on function public.contabilizar_documento_contable(uuid, bigint, uuid, text) from public, anon;
grant execute on function public.contabilizar_documento_contable(uuid, bigint, uuid, text) to authenticated;
