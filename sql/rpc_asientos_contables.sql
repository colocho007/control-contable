-- RPC transaccional para registrar asientos contables completos.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Crea encabezado y detalle en una sola operacion atomica.
-- No crea asientos automaticos desde cheques/ordenes ni toca movimientos operativos.
-- Requiere sql/seguridad_operativa.sql para idempotency_keys_operativas.

create or replace function public.registrar_asiento_completo(
  p_empresa_id bigint,
  p_periodo_id uuid,
  p_fecha date,
  p_descripcion text,
  p_moneda text,
  p_tipo text,
  p_lineas jsonb,
  p_creado_por uuid,
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
  v_idempotency idempotency_keys_operativas%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_moneda text := upper(trim(coalesce(p_moneda, '')));
  v_tipo text := lower(trim(coalesce(p_tipo, 'asiento_manual')));
  v_estado_asiento text := 'borrador';
  v_total_debe numeric := 0;
  v_total_haber numeric := 0;
  v_linea record;
  v_linea_numero integer;
  v_cuenta_id uuid;
  v_cuenta catalogo_cuentas%rowtype;
  v_debe numeric;
  v_haber numeric;
  v_linea_moneda text;
  v_tipo_cambio numeric;
  v_monto_base numeric;
  v_detalle movimientos_contables_detalle%rowtype;
  v_detalles jsonb := '[]'::jsonb;
  v_resultado jsonb;
begin
  if v_usuario_id is null or v_usuario_id <> p_creado_por then
    return jsonb_build_object(
      'ok', false,
      'permitido', false,
      'codigo', 'sesion_no_valida',
      'mensaje', 'Sesion no valida para registrar el asiento.'
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
      'mensaje', 'Usuario no activo para registrar asientos.'
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

      if v_idempotency.modulo <> 'contabilidad'
        or v_idempotency.accion <> 'registrar_asiento_completo'
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
      'contabilidad',
      'registrar_asiento_completo',
      'en_proceso',
      md5(concat_ws('|', p_empresa_id, p_periodo_id, p_fecha, p_descripcion, v_moneda, v_tipo, p_lineas::text)),
      'asiento_contable'
    )
    returning * into v_idempotency;
  end if;

  begin
    if p_empresa_id is null or p_empresa_id <= 0 then
      raise exception 'Debe indicar una empresa valida.';
    end if;

    select *
      into v_empresa
    from empresas
    where id = p_empresa_id;

    if not found then
      raise exception 'La empresa no existe.';
    end if;

    if lower(coalesce(v_empresa.estado, '')) in ('inactiva', 'inactivo', 'archivada', 'archivado', 'prueba', 'demo', 'testing') then
      raise exception 'La empresa no esta operativa para registrar asientos.';
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

    if v_tipo in ('registrado', 'finalizar', 'finalizado') then
      v_estado_asiento := 'registrado';
    else
      v_estado_asiento := 'borrador';
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
      raise exception 'El auditor de solo lectura no puede crear ni registrar asientos contables.';
    end if;

    if lower(coalesce(v_perfil.rol, '')) <> 'admin'
      and not exists (
        select 1
        from usuario_funciones_operativas ufo
        where ufo.usuario_id = v_usuario_id
          and ufo.empresa_id = p_empresa_id
          and ufo.activo = true
          and ufo.funcion in ('auxiliar_contable', 'contador_revisor')
      )
    then
      raise exception 'No tienes funcion operativa contable para crear asientos.';
    end if;

    if v_estado_asiento = 'registrado'
      and lower(coalesce(v_perfil.rol, '')) <> 'admin'
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
      into v_periodo
    from periodos_contables
    where id = p_periodo_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception 'Periodo contable no encontrado para la empresa indicada.';
    end if;

    if v_periodo.estado in ('cerrado', 'bloqueado') then
      raise exception 'No se pueden crear asientos en un periodo cerrado o bloqueado.';
    end if;

    if p_fecha < v_periodo.fecha_inicio or p_fecha > v_periodo.fecha_fin then
      raise exception 'La fecha del asiento no pertenece al periodo contable indicado.';
    end if;

    if v_moneda not in ('GTQ', 'USD') then
      raise exception 'La moneda contable debe ser GTQ o USD.';
    end if;

    if length(trim(coalesce(p_descripcion, ''))) < 3 then
      raise exception 'La descripcion del asiento es obligatoria.';
    end if;

    if coalesce(jsonb_typeof(p_lineas), '') <> 'array' or jsonb_array_length(p_lineas) < 2 then
      raise exception 'El asiento debe tener al menos dos lineas.';
    end if;

    for v_linea in
      select value, ordinality
      from jsonb_array_elements(p_lineas) with ordinality
    loop
      v_linea_numero := v_linea.ordinality::integer;

      if nullif(trim(coalesce(v_linea.value->>'cuenta_id', '')), '') is null then
        raise exception 'La linea % no tiene cuenta contable.', v_linea_numero;
      end if;

      v_cuenta_id := (v_linea.value->>'cuenta_id')::uuid;
      v_debe := round(coalesce(nullif(v_linea.value->>'debe', '')::numeric, 0), 2);
      v_haber := round(coalesce(nullif(v_linea.value->>'haber', '')::numeric, 0), 2);
      v_linea_moneda := upper(trim(coalesce(v_linea.value->>'moneda', v_moneda)));

      if v_debe < 0 or v_haber < 0 then
        raise exception 'La linea % no puede tener montos negativos.', v_linea_numero;
      end if;

      if v_debe > 0 and v_haber > 0 then
        raise exception 'La linea % no puede tener debe y haber al mismo tiempo.', v_linea_numero;
      end if;

      if v_debe = 0 and v_haber = 0 then
        raise exception 'La linea % debe tener monto en debe o haber.', v_linea_numero;
      end if;

      if v_linea_moneda <> v_moneda then
        raise exception 'La linea % usa una moneda distinta a la del asiento.', v_linea_numero;
      end if;

      select *
        into v_cuenta
      from catalogo_cuentas
      where id = v_cuenta_id
        and (empresa_id is null or empresa_id = p_empresa_id);

      if not found then
        raise exception 'La cuenta de la linea % no existe para esta empresa.', v_linea_numero;
      end if;

      if v_cuenta.activo is not true or v_cuenta.permite_movimientos is not true then
        raise exception 'La cuenta de la linea % no permite movimientos.', v_linea_numero;
      end if;

      v_total_debe := round(v_total_debe + v_debe, 2);
      v_total_haber := round(v_total_haber + v_haber, 2);
    end loop;

    if abs(v_total_debe - v_total_haber) > 0.005 then
      raise exception 'Asiento desbalanceado. Debe: %, Haber: %.', v_total_debe, v_total_haber;
    end if;

    insert into asientos_contables (
      empresa_id,
      periodo_id,
      fecha,
      descripcion,
      origen_modulo,
      entidad_tipo,
      entidad_id,
      estado,
      moneda_base,
      total_debe,
      total_haber,
      creado_por,
      metadatos,
      actualizado_at
    )
    values (
      p_empresa_id,
      p_periodo_id,
      p_fecha,
      trim(p_descripcion),
      'contabilidad',
      nullif(v_tipo, ''),
      null,
      v_estado_asiento,
      v_moneda,
      v_total_debe,
      v_total_haber,
      p_creado_por,
      jsonb_build_object(
        'rpc_transaccional', true,
        'idempotency_key', v_idempotency_key,
        'tipo', v_tipo,
        'lineas', jsonb_array_length(p_lineas),
        'asiento_automatico_creado', false
      ),
      now()
    )
    returning * into v_asiento;

    for v_linea in
      select value, ordinality
      from jsonb_array_elements(p_lineas) with ordinality
    loop
      v_cuenta_id := (v_linea.value->>'cuenta_id')::uuid;
      v_debe := round(coalesce(nullif(v_linea.value->>'debe', '')::numeric, 0), 2);
      v_haber := round(coalesce(nullif(v_linea.value->>'haber', '')::numeric, 0), 2);
      v_linea_moneda := upper(trim(coalesce(v_linea.value->>'moneda', v_moneda)));
      v_tipo_cambio := case
        when nullif(v_linea.value->>'tipo_cambio', '') is null then null
        else round((v_linea.value->>'tipo_cambio')::numeric, 6)
      end;
      v_monto_base := case
        when nullif(v_linea.value->>'monto_base', '') is null then null
        else round((v_linea.value->>'monto_base')::numeric, 2)
      end;

      insert into movimientos_contables_detalle (
        asiento_id,
        cuenta_id,
        descripcion,
        debe,
        haber,
        moneda,
        tipo_cambio,
        monto_base
      )
      values (
        v_asiento.id,
        v_cuenta_id,
        nullif(trim(coalesce(v_linea.value->>'descripcion', '')), ''),
        v_debe,
        v_haber,
        v_linea_moneda,
        v_tipo_cambio,
        v_monto_base
      )
      returning * into v_detalle;

      v_detalles := v_detalles || jsonb_build_array(to_jsonb(v_detalle));
    end loop;

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
      'contabilidad',
      'crear_asiento_contable',
      'asiento_contable',
      v_asiento.id::text,
      v_asiento.estado,
      'Asiento contable creado por RPC transaccional.',
      true,
      true,
      jsonb_build_object(
        'fecha', p_fecha,
        'periodo_id', p_periodo_id,
        'total_debe', v_total_debe,
        'total_haber', v_total_haber,
        'lineas', jsonb_array_length(p_lineas),
        'tipo', v_tipo,
        'rpc_transaccional', true,
        'idempotency_key', v_idempotency_key,
        'asiento_automatico_creado', false
      ),
      'rpc_asientos_contables'
    );

    v_resultado := jsonb_build_object(
      'ok', true,
      'asiento', to_jsonb(v_asiento) || jsonb_build_object('movimientos_contables_detalle', v_detalles),
      'movimientos_contables_detalle', v_detalles
    );

    if v_idempotency_key is not null then
      update idempotency_keys_operativas
      set estado = 'completada',
          entidad_tipo = 'asiento_contable',
          entidad_id = v_asiento.id::text,
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
      'codigo', 'registrar_asiento_completo_fallido',
      'mensaje', 'No se pudo registrar el asiento contable. Revise los datos e intente de nuevo.',
      'detalle_resumido', null,
      'idempotency_key', v_idempotency_key
    );
  end;
end;
$$;

grant execute on function public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text) to authenticated;
