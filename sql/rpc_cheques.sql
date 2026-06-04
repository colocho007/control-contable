-- RPCs transaccionales para operaciones criticas de Cheques.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Crea cheque, reserva cheque fisico, registra historial y auditoria en una sola operacion atomica.
-- No borra datos, no usa movimientos operativos y no crea asientos contables.
-- Requiere sql/seguridad_operativa.sql para idempotency_keys_operativas.
-- Permisos actuales de creacion:
-- - admin, jefe o supervisor pueden crear.
-- - usuarios con empresa activa asignada pueden crear si no son auditor solo lectura.
-- Pendiente futuro: crear funciones operativas de cheques como creador_cheque,
-- autorizador_cheque, pagador_cheque y supervisor_cheques; cuando existan,
-- esta RPC podra reforzarse para exigirlas sin bloquear el flujo actual.

create or replace function public.crear_cheque_transaccional(
  p_empresa_id bigint,
  p_fondo_empresa_id bigint,
  p_fecha_pago date,
  p_beneficiario text,
  p_concepto text,
  p_monto numeric,
  p_moneda text,
  p_tipo_cambio numeric,
  p_tipo_pago text,
  p_forma_pago text,
  p_prioridad text,
  p_creado_por uuid,
  p_chequera_id bigint default null,
  p_cheque_fisico_id bigint default null,
  p_borrador_id text default null,
  p_empresa_nombre text default null,
  p_fecha_limite_autorizacion timestamp with time zone default null,
  p_responsable_actual uuid default null,
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
  v_fondo fondos_empresa%rowtype;
  v_chequera chequeras%rowtype;
  v_cheque_fisico cheques_fisicos%rowtype;
  v_cheque cheques%rowtype;
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_moneda text := upper(trim(coalesce(p_moneda, '')));
  v_forma_pago text := nullif(trim(coalesce(p_forma_pago, '')), '');
  v_tipo_pago text := nullif(trim(coalesce(p_tipo_pago, '')), '');
  v_prioridad text := nullif(trim(coalesce(p_prioridad, '')), '');
  v_tipo_cambio numeric := round(coalesce(p_tipo_cambio, 1)::numeric, 6);
  v_monto numeric := round(coalesce(p_monto, 0)::numeric, 2);
  v_monto_gtq numeric;
  v_nombre_empresa text;
  v_nombre_busqueda text;
  v_estado_empresa text;
  v_resultado jsonb;
begin
  if v_usuario_id is null or v_usuario_id <> p_creado_por then
    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'sesion_no_valida',
      'mensaje', 'Sesion no valida para crear el cheque.'
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
      'mensaje', 'Usuario no activo para crear cheques.'
    );
  end if;

  if v_idempotency_key is not null then
    select *
      into v_idempotency
    from idempotency_keys_operativas
    where idempotency_key = v_idempotency_key
    for update;

    if found then
      if v_idempotency.usuario_id <> p_creado_por then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_usuario_distinto',
          'mensaje', 'La llave de idempotencia pertenece a otro usuario.'
        );
      end if;

      if v_idempotency.empresa_id is not null and v_idempotency.empresa_id <> p_empresa_id then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_empresa_distinta',
          'mensaje', 'La llave de idempotencia pertenece a otra empresa.'
        );
      end if;

      if v_idempotency.modulo <> 'cheques'
        or v_idempotency.accion <> 'crear_cheque_transaccional'
      then
        return jsonb_build_object(
          'ok', false,
          'permitido', false,
          'codigo', 'idempotency_operacion_distinta',
          'mensaje', 'La llave de idempotencia pertenece a otra operacion.'
        );
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
      'cheques',
      'crear_cheque_transaccional',
      'en_proceso',
      md5(concat_ws('|', p_empresa_id, p_fondo_empresa_id, p_chequera_id, p_cheque_fisico_id, p_fecha_pago, p_beneficiario, p_concepto, p_monto, v_moneda)),
      'cheque'
    )
    returning * into v_idempotency;
  end if;

  begin
    if p_empresa_id is null or p_empresa_id <= 0 then
      raise exception 'Debe indicar una empresa valida.';
    end if;

    if p_fondo_empresa_id is null or p_fondo_empresa_id <= 0 then
      raise exception 'Debe indicar un fondo valido.';
    end if;

    select *
      into v_empresa
    from empresas
    where id = p_empresa_id;

    if not found then
      raise exception 'La empresa no existe.';
    end if;

    v_estado_empresa := lower(coalesce(v_empresa.estado, ''));
    v_nombre_busqueda := lower(
      concat_ws(
        ' ',
        coalesce(v_empresa.nombre, ''),
        coalesce(v_empresa.razon_social, ''),
        coalesce(v_empresa.nombre_comercial, '')
      )
    );

    if v_estado_empresa in ('inactiva', 'inactivo', 'archivada', 'archivado', 'prueba', 'demo', 'testing')
      or v_nombre_busqueda like '%control plus%'
      or v_nombre_busqueda like '%prueba%'
      or v_nombre_busqueda like '%demo%'
      or v_nombre_busqueda like '%testing%'
    then
      raise exception 'La empresa no esta operativa para crear cheques.';
    end if;

    if lower(coalesce(v_perfil.rol, '')) not in ('admin', 'supervisor', 'jefe')
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

    if lower(coalesce(v_perfil.rol, '')) not in ('admin', 'supervisor', 'jefe')
      and exists (
        select 1
        from usuario_funciones_operativas ufo
        where ufo.usuario_id = v_usuario_id
          and ufo.empresa_id = p_empresa_id
          and ufo.activo = true
          and ufo.funcion = 'auditor_solo_lectura'
      )
    then
      raise exception 'El auditor solo lectura no puede crear cheques.';
    end if;

    if v_moneda not in ('GTQ', 'USD') then
      raise exception 'La moneda del cheque debe ser GTQ o USD.';
    end if;

    if v_monto <= 0 then
      raise exception 'El monto del cheque debe ser mayor a cero.';
    end if;

    if p_fecha_pago is null then
      raise exception 'Debe indicar fecha de pago.';
    end if;

    if v_moneda = 'GTQ' then
      v_tipo_cambio := 1;
    elsif v_tipo_cambio <= 0 then
      raise exception 'Debe indicar un tipo de cambio valido para USD.';
    end if;

    if length(trim(coalesce(p_beneficiario, ''))) < 2 then
      raise exception 'Debe indicar un beneficiario valido.';
    end if;

    if length(trim(coalesce(p_concepto, ''))) < 3 then
      raise exception 'Debe indicar un concepto valido.';
    end if;

    select *
      into v_fondo
    from fondos_empresa
    where id = p_fondo_empresa_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'El fondo no existe para la empresa indicada.';
    end if;

    if lower(coalesce(v_fondo.estado, 'activa')) in ('inactiva', 'inactivo', 'archivada', 'archivado', 'anulada', 'anulado') then
      raise exception 'El fondo no esta activo.';
    end if;

    if upper(coalesce(v_fondo.moneda, '')) <> v_moneda then
      raise exception 'La moneda del fondo no coincide con el cheque.';
    end if;

    if v_monto > round(coalesce(v_fondo.saldo_disponible, 0)::numeric, 2) then
      raise exception 'Fondos insuficientes para crear el cheque.';
    end if;

    if coalesce(v_forma_pago, '') = '' then
      v_forma_pago := 'Cheque';
    end if;

    if v_forma_pago = 'Cheque' then
      if p_chequera_id is null or p_cheque_fisico_id is null then
        raise exception 'Debe seleccionar chequera y numero de cheque.';
      end if;

      select *
        into v_chequera
      from chequeras
      where id = p_chequera_id
        and empresa_id = p_empresa_id
        and fondo_empresa_id = p_fondo_empresa_id
      for update;

      if not found then
        raise exception 'La chequera no existe para el fondo indicado.';
      end if;

      if lower(coalesce(v_chequera.estado, 'activa')) in ('inactiva', 'inactivo', 'archivada', 'archivado', 'anulada', 'anulado') then
        raise exception 'La chequera no esta activa.';
      end if;

      if upper(coalesce(v_chequera.moneda, '')) <> v_moneda then
        raise exception 'La moneda de la chequera no coincide con el cheque.';
      end if;

      select *
        into v_cheque_fisico
      from cheques_fisicos
      where id = p_cheque_fisico_id
        and empresa_id = p_empresa_id
        and fondo_empresa_id = p_fondo_empresa_id
        and chequera_id = p_chequera_id
      for update;

      if not found then
        raise exception 'El numero de cheque no existe para la chequera indicada.';
      end if;

      if v_cheque_fisico.estado <> 'Disponible' then
        raise exception 'El numero de cheque ya no esta disponible.';
      end if;

      if upper(coalesce(v_cheque_fisico.moneda, '')) <> v_moneda then
        raise exception 'La moneda del numero de cheque no coincide.';
      end if;
    else
      p_chequera_id := null;
      p_cheque_fisico_id := null;
    end if;

    v_monto_gtq := round(v_monto * v_tipo_cambio, 2);
    v_nombre_empresa := coalesce(
      nullif(trim(coalesce(p_empresa_nombre, '')), ''),
      nullif(trim(coalesce(v_empresa.nombre, '')), ''),
      nullif(trim(coalesce(v_empresa.razon_social, '')), ''),
      nullif(trim(coalesce(v_empresa.nombre_comercial, '')), '')
    );

    insert into cheques (
      borrador_id,
      empresa_id,
      empresa,
      fondo_empresa_id,
      chequera_id,
      cheque_fisico_id,
      numero_cheque,
      banco,
      cuenta_bancaria,
      beneficiario,
      concepto,
      monto,
      tipo_cambio,
      monto_gtq,
      tipo_pago,
      forma_pago,
      moneda,
      prioridad,
      fecha_pago,
      fecha_limite_autorizacion,
      estado,
      estado_fondo,
      creado_por,
      responsable_actual,
      enviado_at,
      movimiento_generado
    )
    values (
      nullif(trim(coalesce(p_borrador_id, '')), ''),
      p_empresa_id,
      v_nombre_empresa,
      p_fondo_empresa_id,
      p_chequera_id,
      p_cheque_fisico_id,
      case when v_forma_pago = 'Cheque' then v_cheque_fisico.numero_cheque::text else null end,
      v_fondo.banco,
      v_fondo.cuenta_bancaria,
      trim(p_beneficiario),
      trim(p_concepto),
      v_monto,
      v_tipo_cambio,
      v_monto_gtq,
      coalesce(v_tipo_pago, 'Proveedor'),
      v_forma_pago,
      v_moneda,
      coalesce(v_prioridad, 'Media'),
      p_fecha_pago,
      p_fecha_limite_autorizacion,
      'Pendiente de autorizaciÃ³n',
      'sin_comprometer',
      p_creado_por,
      p_responsable_actual,
      now(),
      false
    )
    returning * into v_cheque;

    if v_forma_pago = 'Cheque' and p_cheque_fisico_id is not null then
      update cheques_fisicos
      set estado = 'Reservado',
          cheque_pago_id = v_cheque.id
      where id = p_cheque_fisico_id
        and empresa_id = p_empresa_id
        and estado = 'Disponible'
      returning * into v_cheque_fisico;

      if not found then
        raise exception 'No se pudo reservar el numero de cheque.';
      end if;
    end if;

    insert into cheques_historial (
      cheque_id,
      modulo,
      accion,
      estado_anterior,
      estado_nuevo,
      comentario,
      usuario_id,
      sensible
    )
    values (
      v_cheque.id,
      'cheques',
      'Creado y enviado a autorizaciÃ³n',
      null,
      'Pendiente de autorizaciÃ³n',
      case
        when v_forma_pago = 'Cheque' then 'Cheque No. ' || coalesce(v_cheque.numero_cheque, '') || ' reservado para ' || trim(p_beneficiario)
        else v_forma_pago || ' creado para ' || trim(p_beneficiario)
      end,
      p_creado_por,
      false
    );

    insert into auditoria_eventos (
      usuario_id,
      usuario_nombre_snapshot,
      empresa_id,
      modulo,
      accion,
      entidad_tipo,
      entidad_id,
      estado_nuevo,
      descripcion,
      sensible,
      visible_calendario,
      metadatos,
      origen
    )
    values (
      p_creado_por,
      v_perfil.nombre,
      p_empresa_id,
      'cheques',
      'crear_cheque',
      'cheque',
      v_cheque.id::text,
      v_cheque.estado,
      'Cheque creado por RPC transaccional.',
      true,
      p_fecha_pago is not null,
      jsonb_build_object(
        'beneficiario', v_cheque.beneficiario,
        'monto', v_cheque.monto,
        'moneda', v_cheque.moneda,
        'forma_pago', v_cheque.forma_pago,
        'numero_cheque', v_cheque.numero_cheque,
        'fondo_id', v_cheque.fondo_empresa_id,
        'chequera_id', v_cheque.chequera_id,
        'cheque_fisico_id', v_cheque.cheque_fisico_id,
        'historial_especifico_registrado', true,
        'rpc_transaccional', true,
        'idempotency_key', v_idempotency_key
      ),
      'rpc_cheques'
    );

    v_resultado := jsonb_build_object(
      'ok', true,
      'cheque', to_jsonb(v_cheque),
      'cheque_fisico', case when v_forma_pago = 'Cheque' then to_jsonb(v_cheque_fisico) else null end
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          entidad_tipo = 'cheque',
          entidad_id = v_cheque.id::text,
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
      'codigo', 'crear_cheque_transaccional_fallido',
      'mensaje', left(sqlerrm, 500),
      'detalle_resumido', left(sqlerrm, 500),
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

grant execute on function public.crear_cheque_transaccional(
  bigint,
  bigint,
  date,
  text,
  text,
  numeric,
  text,
  numeric,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  text,
  text,
  timestamp with time zone,
  uuid,
  text
) to authenticated;
