-- RPC transaccionales para pagos parciales de CxP/CxC.
-- Ejecutar en Supabase SQL Editor. No borra datos ni crea asientos contables.

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
  p_creado_por uuid
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
      'asiento_automatico_creado', false
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

  return jsonb_build_object(
    'pago', to_jsonb(v_pago),
    'cuenta', to_jsonb(v_cuenta)
  );
end;
$$;

create or replace function public.anular_pago_cxp(
  p_pago_id text,
  p_empresa_id bigint,
  p_anulado_por uuid,
  p_motivo_anulacion text
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

  return jsonb_build_object(
    'pago', to_jsonb(v_pago),
    'cuenta', to_jsonb(v_cuenta)
  );
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
  p_creado_por uuid
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
      'asiento_automatico_creado', false
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

  return jsonb_build_object(
    'pago', to_jsonb(v_pago),
    'cuenta', to_jsonb(v_cuenta)
  );
end;
$$;

create or replace function public.anular_pago_cxc(
  p_pago_id text,
  p_empresa_id bigint,
  p_anulado_por uuid,
  p_motivo_anulacion text
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

  return jsonb_build_object(
    'pago', to_jsonb(v_pago),
    'cuenta', to_jsonb(v_cuenta)
  );
end;
$$;

grant execute on function public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid) to authenticated;
grant execute on function public.anular_pago_cxp(text, bigint, uuid, text) to authenticated;
grant execute on function public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid) to authenticated;
grant execute on function public.anular_pago_cxc(text, bigint, uuid, text) to authenticated;
