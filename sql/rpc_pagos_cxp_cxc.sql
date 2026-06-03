-- RPC transaccionales para pagos parciales de CxP/CxC.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- No borra datos ni crea asientos contables.
-- Requiere ejecutar primero sql/seguridad_operativa.sql para crear idempotency_keys_operativas.
--
-- Cambio de contrato:
-- - Se agrega p_idempotency_key text default null a cada RPC.
-- - El frontend debe enviarlo siempre en operaciones criticas.
-- - Se eliminan firmas anteriores para evitar sobrecargas ambiguas en Supabase RPC.
-- - Si una operacion falla despues de reservar idempotencia, devuelve ok=false
--   para conservar la marca fallida en idempotency_keys_operativas.

drop function if exists public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid);
drop function if exists public.anular_pago_cxp(text, bigint, uuid, text);
drop function if exists public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid);
drop function if exists public.anular_pago_cxc(text, bigint, uuid, text);

create or replace function public.registrar_pago_cxp(
  p_cuenta_id text,
  p_empresa_id bigint,
  p_fecha_pago date,
  p_metodo_pago text,
  p_banco text,
  p_referencia text,
  p_moneda text,
  p_monto numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta cuentas_por_pagar%rowtype;
  v_pago pagos_cuentas_por_pagar%rowtype;
  v_nuevo_saldo numeric;
  v_nuevo_estado text;
  v_resultado jsonb;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if auth.uid() is null or auth.uid() <> p_creado_por then
    raise exception 'Sesion no valida para registrar el pago.';
  end if;

  if not exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and (
        lower(coalesce(p.rol, '')) = 'admin'
        or exists (
          select 1
          from usuario_empresas ue
          where ue.usuario_id = auth.uid()
            and ue.empresa_id = p_empresa_id
            and ue.activo = true
        )
      )
  ) then
    raise exception 'No tienes permiso para operar esta empresa.';
  end if;

  if v_idempotency_key is not null then
    select *
      into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_creado_por then
        raise exception 'La llave de idempotencia pertenece a otro usuario.';
      end if;
      if v_idempotency.empresa_id is not null and v_idempotency.empresa_id <> p_empresa_id then
        raise exception 'La llave de idempotencia pertenece a otra empresa.';
      end if;
      if v_idempotency.modulo <> 'cuentas-pagar' or v_idempotency.accion <> 'registrar_pago_cxp' then
        raise exception 'La llave de idempotencia pertenece a otra operacion.';
      end if;
      if v_idempotency.estado = 'completada' then
        if v_idempotency.resultado_resumen is not null then
          return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
        end if;
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_ya_procesada',
          'mensaje', 'La operacion ya fue procesada.'
        );
      end if;
      if v_idempotency.estado = 'en_proceso' then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_en_proceso',
          'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_key_usada',
        'mensaje', 'La llave de idempotencia ya fue usada con otro estado. Genera una nueva operacion.',
        'estado', v_idempotency.estado
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
      entidad_tipo
    )
    values (
      now() + interval '24 hours',
      v_idempotency_key,
      p_creado_por,
      p_empresa_id,
      'cuentas-pagar',
      'registrar_pago_cxp',
      'en_proceso',
      md5(concat_ws('|', p_cuenta_id, p_empresa_id, p_fecha_pago, p_metodo_pago, p_moneda, p_monto, coalesce(p_referencia, ''))),
      'cuenta_por_pagar'
    )
    returning * into v_idempotency;
  end if;

  begin
    select *
      into v_cuenta
    from cuentas_por_pagar
    where id::text = p_cuenta_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'CxP no encontrada para la empresa indicada.';
    end if;

    if v_cuenta.estado in ('Anulado', 'Pagado') then
      raise exception 'La CxP no acepta nuevos pagos.';
    end if;

    if p_monto <= 0 then
      raise exception 'El monto del pago debe ser mayor a cero.';
    end if;

    if v_cuenta.moneda <> p_moneda then
      raise exception 'La moneda del pago no coincide con la CxP.';
    end if;

    if p_monto > coalesce(v_cuenta.saldo_pendiente, 0) then
      raise exception 'El pago no puede ser mayor al saldo pendiente.';
    end if;

    v_nuevo_saldo := round((coalesce(v_cuenta.saldo_pendiente, 0) - p_monto)::numeric, 2);
    v_nuevo_estado := case when v_nuevo_saldo = 0 then 'Pagado' else 'Parcial' end;

    insert into pagos_cuentas_por_pagar (
      cuenta_por_pagar_id,
      empresa_id,
      proveedor_id,
      fecha_pago,
      metodo_pago,
      banco,
      referencia,
      moneda,
      monto,
      observaciones,
      estado,
      creado_por,
      metadatos
    )
    values (
      v_cuenta.id,
      p_empresa_id,
      v_cuenta.proveedor_id,
      p_fecha_pago,
      p_metodo_pago,
      nullif(trim(coalesce(p_banco, '')), ''),
      nullif(trim(coalesce(p_referencia, '')), ''),
      v_cuenta.moneda,
      p_monto,
      nullif(trim(coalesce(p_observaciones, '')), ''),
      'Registrado',
      p_creado_por,
      jsonb_build_object(
        'cheques_preparados', true,
        'transferencias_preparadas', true,
        'depositos_preparados', true,
        'comprobantes_adjuntos_preparados', true,
        'asiento_automatico_creado', false,
        'idempotency_key', v_idempotency_key
      )
    )
    returning * into v_pago;

    update cuentas_por_pagar
    set saldo_pendiente = v_nuevo_saldo,
        estado = v_nuevo_estado,
        actualizado_at = now(),
        actualizado_por = p_creado_por
    where id = v_cuenta.id
      and empresa_id = p_empresa_id
    returning * into v_cuenta;

    v_resultado := jsonb_build_object(
      'pago', to_jsonb(v_pago),
      'cuenta', to_jsonb(v_cuenta)
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          entidad_tipo = 'pago_cuenta_por_pagar',
          entidad_id = v_pago.id::text,
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
      'codigo', 'registrar_pago_cxp_fallido',
      'mensaje', left(sqlerrm, 500),
      'detalle_resumido', left(sqlerrm, 500),
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

create or replace function public.anular_pago_cxp(
  p_pago_id text,
  p_empresa_id bigint,
  p_anulado_por uuid,
  p_motivo_anulacion text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago pagos_cuentas_por_pagar%rowtype;
  v_cuenta cuentas_por_pagar%rowtype;
  v_nuevo_saldo numeric;
  v_nuevo_estado text;
  v_resultado jsonb;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if auth.uid() is null or auth.uid() <> p_anulado_por then
    raise exception 'Sesion no valida para anular el pago.';
  end if;

  if not exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and (
        lower(coalesce(p.rol, '')) = 'admin'
        or exists (
          select 1
          from usuario_empresas ue
          where ue.usuario_id = auth.uid()
            and ue.empresa_id = p_empresa_id
            and ue.activo = true
        )
      )
  ) then
    raise exception 'No tienes permiso para operar esta empresa.';
  end if;

  if v_idempotency_key is not null then
    select *
      into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_anulado_por then
        raise exception 'La llave de idempotencia pertenece a otro usuario.';
      end if;
      if v_idempotency.empresa_id is not null and v_idempotency.empresa_id <> p_empresa_id then
        raise exception 'La llave de idempotencia pertenece a otra empresa.';
      end if;
      if v_idempotency.modulo <> 'cuentas-pagar' or v_idempotency.accion <> 'anular_pago_cxp' then
        raise exception 'La llave de idempotencia pertenece a otra operacion.';
      end if;
      if v_idempotency.estado = 'completada' then
        if v_idempotency.resultado_resumen is not null then
          return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
        end if;
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_ya_procesada',
          'mensaje', 'La operacion ya fue procesada.'
        );
      end if;
      if v_idempotency.estado = 'en_proceso' then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_en_proceso',
          'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_key_usada',
        'mensaje', 'La llave de idempotencia ya fue usada con otro estado. Genera una nueva operacion.',
        'estado', v_idempotency.estado
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
      p_anulado_por,
      p_empresa_id,
      'cuentas-pagar',
      'anular_pago_cxp',
      'en_proceso',
      md5(concat_ws('|', p_pago_id, p_empresa_id, left(trim(coalesce(p_motivo_anulacion, '')), 120))),
      'pago_cuenta_por_pagar',
      p_pago_id
    )
    returning * into v_idempotency;
  end if;

  begin
    if length(trim(coalesce(p_motivo_anulacion, ''))) < 5 then
      raise exception 'Debe indicar un motivo valido para anular el pago.';
    end if;

    select *
      into v_pago
    from pagos_cuentas_por_pagar
    where id::text = p_pago_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'Pago CxP no encontrado para la empresa indicada.';
    end if;

    if v_pago.estado = 'Anulado' then
      raise exception 'El pago ya esta anulado.';
    end if;

    select *
      into v_cuenta
    from cuentas_por_pagar
    where id = v_pago.cuenta_por_pagar_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'CxP asociada al pago no encontrada.';
    end if;

    if v_cuenta.estado = 'Anulado' then
      raise exception 'No se puede devolver saldo a una CxP anulada.';
    end if;

    if v_cuenta.moneda <> v_pago.moneda then
      raise exception 'El pago y la CxP tienen monedas diferentes.';
    end if;

    v_nuevo_saldo := round((coalesce(v_cuenta.saldo_pendiente, 0) + coalesce(v_pago.monto, 0))::numeric, 2);

    if v_nuevo_saldo > coalesce(v_cuenta.total, 0) then
      raise exception 'La anulacion excederia el total de la CxP.';
    end if;

    v_nuevo_estado := case
      when v_nuevo_saldo >= coalesce(v_cuenta.total, 0) then 'Pendiente'
      when v_nuevo_saldo > 0 then 'Parcial'
      else 'Pagado'
    end;

    update pagos_cuentas_por_pagar
    set estado = 'Anulado',
        anulado_por = p_anulado_por,
        anulado_at = now(),
        motivo_anulacion = trim(p_motivo_anulacion)
    where id = v_pago.id
      and empresa_id = p_empresa_id
    returning * into v_pago;

    update cuentas_por_pagar
    set saldo_pendiente = v_nuevo_saldo,
        estado = v_nuevo_estado,
        actualizado_at = now(),
        actualizado_por = p_anulado_por
    where id = v_cuenta.id
      and empresa_id = p_empresa_id
    returning * into v_cuenta;

    v_resultado := jsonb_build_object(
      'pago', to_jsonb(v_pago),
      'cuenta', to_jsonb(v_cuenta)
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          entidad_tipo = 'pago_cuenta_por_pagar',
          entidad_id = v_pago.id::text,
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
      'codigo', 'anular_pago_cxp_fallido',
      'mensaje', left(sqlerrm, 500),
      'detalle_resumido', left(sqlerrm, 500),
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

create or replace function public.registrar_pago_cxc(
  p_cuenta_id text,
  p_empresa_id bigint,
  p_fecha_pago date,
  p_metodo_pago text,
  p_banco text,
  p_referencia text,
  p_moneda text,
  p_monto numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta cuentas_por_cobrar%rowtype;
  v_pago pagos_cuentas_por_cobrar%rowtype;
  v_nuevo_saldo numeric;
  v_nuevo_estado text;
  v_resultado jsonb;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if auth.uid() is null or auth.uid() <> p_creado_por then
    raise exception 'Sesion no valida para registrar el pago.';
  end if;

  if not exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and (
        lower(coalesce(p.rol, '')) = 'admin'
        or exists (
          select 1
          from usuario_empresas ue
          where ue.usuario_id = auth.uid()
            and ue.empresa_id = p_empresa_id
            and ue.activo = true
        )
      )
  ) then
    raise exception 'No tienes permiso para operar esta empresa.';
  end if;

  if v_idempotency_key is not null then
    select *
      into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_creado_por then
        raise exception 'La llave de idempotencia pertenece a otro usuario.';
      end if;
      if v_idempotency.empresa_id is not null and v_idempotency.empresa_id <> p_empresa_id then
        raise exception 'La llave de idempotencia pertenece a otra empresa.';
      end if;
      if v_idempotency.modulo <> 'cuentas-cobrar' or v_idempotency.accion <> 'registrar_pago_cxc' then
        raise exception 'La llave de idempotencia pertenece a otra operacion.';
      end if;
      if v_idempotency.estado = 'completada' then
        if v_idempotency.resultado_resumen is not null then
          return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
        end if;
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_ya_procesada',
          'mensaje', 'La operacion ya fue procesada.'
        );
      end if;
      if v_idempotency.estado = 'en_proceso' then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_en_proceso',
          'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_key_usada',
        'mensaje', 'La llave de idempotencia ya fue usada con otro estado. Genera una nueva operacion.',
        'estado', v_idempotency.estado
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
      entidad_tipo
    )
    values (
      now() + interval '24 hours',
      v_idempotency_key,
      p_creado_por,
      p_empresa_id,
      'cuentas-cobrar',
      'registrar_pago_cxc',
      'en_proceso',
      md5(concat_ws('|', p_cuenta_id, p_empresa_id, p_fecha_pago, p_metodo_pago, p_moneda, p_monto, coalesce(p_referencia, ''))),
      'cuenta_por_cobrar'
    )
    returning * into v_idempotency;
  end if;

  begin
    select *
      into v_cuenta
    from cuentas_por_cobrar
    where id::text = p_cuenta_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'CxC no encontrada para la empresa indicada.';
    end if;

    if v_cuenta.estado in ('Anulado', 'Pagado') then
      raise exception 'La CxC no acepta nuevos pagos.';
    end if;

    if p_monto <= 0 then
      raise exception 'El monto del pago debe ser mayor a cero.';
    end if;

    if v_cuenta.moneda <> p_moneda then
      raise exception 'La moneda del pago no coincide con la CxC.';
    end if;

    if p_monto > coalesce(v_cuenta.saldo_pendiente, 0) then
      raise exception 'El pago no puede ser mayor al saldo pendiente.';
    end if;

    v_nuevo_saldo := round((coalesce(v_cuenta.saldo_pendiente, 0) - p_monto)::numeric, 2);
    v_nuevo_estado := case when v_nuevo_saldo = 0 then 'Pagado' else 'Parcial' end;

    insert into pagos_cuentas_por_cobrar (
      cuenta_por_cobrar_id,
      empresa_id,
      cliente_id,
      fecha_pago,
      metodo_pago,
      banco,
      referencia,
      moneda,
      monto,
      observaciones,
      estado,
      creado_por,
      metadatos
    )
    values (
      v_cuenta.id,
      p_empresa_id,
      v_cuenta.cliente_id,
      p_fecha_pago,
      p_metodo_pago,
      nullif(trim(coalesce(p_banco, '')), ''),
      nullif(trim(coalesce(p_referencia, '')), ''),
      v_cuenta.moneda,
      p_monto,
      nullif(trim(coalesce(p_observaciones, '')), ''),
      'Registrado',
      p_creado_por,
      jsonb_build_object(
        'comprobantes_adjuntos_preparados', true,
        'asiento_automatico_creado', false,
        'idempotency_key', v_idempotency_key
      )
    )
    returning * into v_pago;

    update cuentas_por_cobrar
    set saldo_pendiente = v_nuevo_saldo,
        estado = v_nuevo_estado,
        actualizado_at = now(),
        actualizado_por = p_creado_por
    where id = v_cuenta.id
      and empresa_id = p_empresa_id
    returning * into v_cuenta;

    v_resultado := jsonb_build_object(
      'pago', to_jsonb(v_pago),
      'cuenta', to_jsonb(v_cuenta)
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          entidad_tipo = 'pago_cuenta_por_cobrar',
          entidad_id = v_pago.id::text,
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
      'codigo', 'registrar_pago_cxc_fallido',
      'mensaje', left(sqlerrm, 500),
      'detalle_resumido', left(sqlerrm, 500),
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

create or replace function public.anular_pago_cxc(
  p_pago_id text,
  p_empresa_id bigint,
  p_anulado_por uuid,
  p_motivo_anulacion text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago pagos_cuentas_por_cobrar%rowtype;
  v_cuenta cuentas_por_cobrar%rowtype;
  v_nuevo_saldo numeric;
  v_nuevo_estado text;
  v_resultado jsonb;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if auth.uid() is null or auth.uid() <> p_anulado_por then
    raise exception 'Sesion no valida para anular el pago.';
  end if;

  if not exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and (
        lower(coalesce(p.rol, '')) = 'admin'
        or exists (
          select 1
          from usuario_empresas ue
          where ue.usuario_id = auth.uid()
            and ue.empresa_id = p_empresa_id
            and ue.activo = true
        )
      )
  ) then
    raise exception 'No tienes permiso para operar esta empresa.';
  end if;

  if v_idempotency_key is not null then
    select *
      into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_anulado_por then
        raise exception 'La llave de idempotencia pertenece a otro usuario.';
      end if;
      if v_idempotency.empresa_id is not null and v_idempotency.empresa_id <> p_empresa_id then
        raise exception 'La llave de idempotencia pertenece a otra empresa.';
      end if;
      if v_idempotency.modulo <> 'cuentas-cobrar' or v_idempotency.accion <> 'anular_pago_cxc' then
        raise exception 'La llave de idempotencia pertenece a otra operacion.';
      end if;
      if v_idempotency.estado = 'completada' then
        if v_idempotency.resultado_resumen is not null then
          return v_idempotency.resultado_resumen || jsonb_build_object('idempotency_replay', true);
        end if;
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_ya_procesada',
          'mensaje', 'La operacion ya fue procesada.'
        );
      end if;
      if v_idempotency.estado = 'en_proceso' then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'operacion_en_proceso',
          'mensaje', 'La operacion ya esta en proceso. Espera antes de reintentar.'
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'permitido', false,
        'codigo', 'idempotency_key_usada',
        'mensaje', 'La llave de idempotencia ya fue usada con otro estado. Genera una nueva operacion.',
        'estado', v_idempotency.estado
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
      p_anulado_por,
      p_empresa_id,
      'cuentas-cobrar',
      'anular_pago_cxc',
      'en_proceso',
      md5(concat_ws('|', p_pago_id, p_empresa_id, left(trim(coalesce(p_motivo_anulacion, '')), 120))),
      'pago_cuenta_por_cobrar',
      p_pago_id
    )
    returning * into v_idempotency;
  end if;

  begin
    if length(trim(coalesce(p_motivo_anulacion, ''))) < 5 then
      raise exception 'Debe indicar un motivo valido para anular el pago.';
    end if;

    select *
      into v_pago
    from pagos_cuentas_por_cobrar
    where id::text = p_pago_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'Pago CxC no encontrado para la empresa indicada.';
    end if;

    if v_pago.estado = 'Anulado' then
      raise exception 'El pago ya esta anulado.';
    end if;

    select *
      into v_cuenta
    from cuentas_por_cobrar
    where id = v_pago.cuenta_por_cobrar_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'CxC asociada al pago no encontrada.';
    end if;

    if v_cuenta.estado = 'Anulado' then
      raise exception 'No se puede devolver saldo a una CxC anulada.';
    end if;

    if v_cuenta.moneda <> v_pago.moneda then
      raise exception 'El pago y la CxC tienen monedas diferentes.';
    end if;

    v_nuevo_saldo := round((coalesce(v_cuenta.saldo_pendiente, 0) + coalesce(v_pago.monto, 0))::numeric, 2);

    if v_nuevo_saldo > coalesce(v_cuenta.total, 0) then
      raise exception 'La anulacion excederia el total de la CxC.';
    end if;

    v_nuevo_estado := case
      when v_nuevo_saldo >= coalesce(v_cuenta.total, 0) then 'Pendiente'
      when v_nuevo_saldo > 0 then 'Parcial'
      else 'Pagado'
    end;

    update pagos_cuentas_por_cobrar
    set estado = 'Anulado',
        anulado_por = p_anulado_por,
        anulado_at = now(),
        motivo_anulacion = trim(p_motivo_anulacion)
    where id = v_pago.id
      and empresa_id = p_empresa_id
    returning * into v_pago;

    update cuentas_por_cobrar
    set saldo_pendiente = v_nuevo_saldo,
        estado = v_nuevo_estado,
        actualizado_at = now(),
        actualizado_por = p_anulado_por
    where id = v_cuenta.id
      and empresa_id = p_empresa_id
    returning * into v_cuenta;

    v_resultado := jsonb_build_object(
      'pago', to_jsonb(v_pago),
      'cuenta', to_jsonb(v_cuenta)
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          entidad_tipo = 'pago_cuenta_por_cobrar',
          entidad_id = v_pago.id::text,
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
      'codigo', 'anular_pago_cxc_fallido',
      'mensaje', left(sqlerrm, 500),
      'detalle_resumido', left(sqlerrm, 500),
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

grant execute on function public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text) to authenticated;
grant execute on function public.anular_pago_cxp(text, bigint, uuid, text, text) to authenticated;
grant execute on function public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text) to authenticated;
grant execute on function public.anular_pago_cxc(text, bigint, uuid, text, text) to authenticated;
