-- RPC de limpieza segura de empresas vacias de prueba/no operativas.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Esta es la unica excepcion permitida de borrado fisico sobre public.empresas.
-- La excepcion aplica solo cuando la empresa esta 100% vacia y fue detectada
-- como prueba/no operativa por nombre o estado.
-- No borra usuarios, perfiles, usuario_empresas, usuario_modulos,
-- usuario_funciones_operativas, auditoria_eventos, documentos ni storage.
-- Si existe cualquier dependencia, incluyendo usuario_empresas o auditoria_eventos,
-- la operacion queda bloqueada y la accion segura es archivar o inactivar.

create or replace function public.eliminar_empresa_vacia_segura(
  p_empresa_id bigint,
  p_confirmacion text
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
  v_nombre text;
  v_estado text;
  v_motivos text[] := array[]::text[];
  v_tablas text[] := array[
    'cheques',
    'fondos_empresa',
    'chequeras',
    'cheques_fisicos',
    'ordenes_compra',
    'tareas',
    'movimientos',
    'clientes',
    'proveedores',
    'cuentas_por_pagar',
    'cuentas_por_cobrar',
    'pagos_cuentas_por_pagar',
    'pagos_cuentas_por_cobrar',
    'documentos_tramites',
    'documentos_contables_revision',
    'calendario_eventos',
    'catalogo_cuentas',
    'periodos_contables',
    'asientos_contables',
    'usuario_empresas',
    'borradores_trabajo',
    'reinicios_controlados',
    'auditoria_eventos'
  ];
  v_tabla text;
  v_count bigint;
  v_dependencias jsonb := '{}'::jsonb;
  v_total bigint := 0;
begin
  if v_usuario_id is null then
    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'sesion_no_valida',
      'mensaje', 'Sesion no valida para eliminar empresa.'
    );
  end if;

  if p_confirmacion <> 'ELIMINAR EMPRESA' then
    insert into intentos_bloqueados (
      usuario_id,
      empresa_id,
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
      null,
      'empresas',
      'eliminar_empresa_vacia',
      'confirmacion_invalida',
      'media',
      'empresa',
      case when p_empresa_id is null then null else p_empresa_id::text end,
      'Confirmacion invalida para eliminar empresa vacia.',
      jsonb_build_object('confirmacion_requerida', 'ELIMINAR EMPRESA')
    );

    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'confirmacion_invalida',
      'mensaje', 'Confirmacion invalida para eliminar empresa.'
    );
  end if;

  if p_empresa_id is null or p_empresa_id <= 0 then
    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'empresa_invalida',
      'mensaje', 'Debe indicar una empresa valida.'
    );
  end if;

  select *
    into v_perfil
  from perfiles
  where id = v_usuario_id
    and activo = true;

  if not found or lower(coalesce(v_perfil.rol, '')) <> 'admin' then
    insert into intentos_bloqueados (
      usuario_id,
      empresa_id,
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
      null,
      'empresas',
      'eliminar_empresa_vacia',
      'usuario_no_admin',
      'alta',
      'empresa',
      p_empresa_id::text,
      'Usuario no autorizado intento eliminar empresa vacia.',
      jsonb_build_object('requiere_rol', 'admin')
    );

    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'usuario_no_autorizado',
      'mensaje', 'Solo admin activo puede eliminar empresas vacias.'
    );
  end if;

  select *
    into v_empresa
  from empresas
  where id = p_empresa_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'empresa_no_existe',
      'mensaje', 'La empresa no existe.'
    );
  end if;

  v_nombre := lower(
    concat_ws(
      ' ',
      coalesce(v_empresa.nombre, ''),
      coalesce(v_empresa.razon_social, ''),
      coalesce(v_empresa.nombre_comercial, '')
    )
  );
  v_estado := lower(coalesce(v_empresa.estado, ''));

  if v_nombre like '%control plus%' then
    v_motivos := array_append(v_motivos, 'nombre_control_plus');
  end if;
  if v_nombre like '%prueba%' then
    v_motivos := array_append(v_motivos, 'nombre_prueba');
  end if;
  if v_nombre like '%demo%' then
    v_motivos := array_append(v_motivos, 'nombre_demo');
  end if;
  if v_nombre like '%testing%' then
    v_motivos := array_append(v_motivos, 'nombre_testing');
  end if;
  if v_estado in ('inactiva', 'inactivo') then
    v_motivos := array_append(v_motivos, 'estado_inactiva');
  end if;
  if v_estado in ('archivada', 'archivado') then
    v_motivos := array_append(v_motivos, 'estado_archivada');
  end if;

  if coalesce(array_length(v_motivos, 1), 0) = 0 or v_estado = 'activa' then
    insert into auditoria_eventos (
      usuario_id,
      usuario_nombre_snapshot,
      empresa_id,
      modulo,
      accion,
      entidad_tipo,
      entidad_id,
      estado_anterior,
      descripcion,
      sensible,
      metadatos,
      origen
    )
    values (
      v_usuario_id,
      v_perfil.nombre,
      p_empresa_id,
      'empresas',
      'bloquear_eliminacion_empresa',
      'empresa',
      p_empresa_id,
      v_empresa.estado,
      'Eliminacion fisica bloqueada porque la empresa no es candidata de limpieza.',
      true,
      jsonb_build_object(
        'motivos_limpieza', v_motivos,
        'estado', v_empresa.estado,
        'accion_segura', 'archivar_o_inactivar'
      ),
      'rpc_limpieza_empresas'
    );

    insert into intentos_bloqueados (
      usuario_id,
      empresa_id,
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
      'empresas',
      'eliminar_empresa_vacia',
      'empresa_real_activa',
      'alta',
      'empresa',
      p_empresa_id::text,
      'Eliminacion fisica bloqueada para empresa real activa.',
      jsonb_build_object(
        'estado', v_empresa.estado,
        'motivos_limpieza', v_motivos,
        'accion_segura', 'archivar_o_inactivar'
      )
    );

    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'empresa_real_activa',
      'mensaje', 'No se permite eliminar fisicamente empresas reales activas.',
      'empresa_id', p_empresa_id,
      'nombre', coalesce(v_empresa.nombre, v_empresa.razon_social, v_empresa.nombre_comercial),
      'estado', v_empresa.estado,
      'motivos_limpieza', v_motivos
    );
  end if;

  foreach v_tabla in array v_tablas loop
    if to_regclass('public.' || v_tabla) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_tabla
          and column_name = 'empresa_id'
      )
    then
      execute format('select count(*) from public.%I where empresa_id = $1', v_tabla)
        into v_count
        using p_empresa_id;
      v_dependencias := v_dependencias || jsonb_build_object(v_tabla, v_count);
      v_total := v_total + coalesce(v_count, 0);
    else
      v_dependencias := v_dependencias || jsonb_build_object(v_tabla, null);
    end if;
  end loop;

  if v_total > 0 then
    insert into auditoria_eventos (
      usuario_id,
      usuario_nombre_snapshot,
      empresa_id,
      modulo,
      accion,
      entidad_tipo,
      entidad_id,
      estado_anterior,
      descripcion,
      sensible,
      metadatos,
      origen
    )
    values (
      v_usuario_id,
      v_perfil.nombre,
      p_empresa_id,
      'empresas',
      'bloquear_eliminacion_empresa',
      'empresa',
      p_empresa_id,
      v_empresa.estado,
      'Eliminacion fisica bloqueada por dependencias.',
      true,
      jsonb_build_object(
        'total_dependencias', v_total,
        'dependencias', v_dependencias,
        'motivos_limpieza', v_motivos,
        'accion_segura', 'archivar_o_inactivar'
      ),
      'rpc_limpieza_empresas'
    );

    insert into intentos_bloqueados (
      usuario_id,
      empresa_id,
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
      'empresas',
      'eliminar_empresa_vacia',
      'dependencias_detectadas',
      'alta',
      'empresa',
      p_empresa_id::text,
      'Eliminacion fisica de empresa bloqueada por dependencias.',
      jsonb_build_object(
        'total_dependencias', v_total,
        'dependencias', v_dependencias,
        'motivos_limpieza', v_motivos,
        'accion_segura', 'archivar_o_inactivar',
        'no_borro_usuarios', true,
        'no_borro_permisos', true,
        'no_borro_auditoria', true,
        'no_borro_documentos_storage', true
      )
    );
    return jsonb_build_object(
      'ok', false,
      'eliminada', false,
      'codigo', 'empresa_con_dependencias',
      'mensaje', 'La empresa tiene dependencias. Solo se permite archivar o inactivar.',
      'empresa_id', p_empresa_id,
      'nombre', coalesce(v_empresa.nombre, v_empresa.razon_social, v_empresa.nombre_comercial),
      'estado', v_empresa.estado,
      'dependencias', v_dependencias,
      'total_dependencias', v_total,
      'motivos_limpieza', v_motivos
    );
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
    metadatos,
    origen
  )
  values (
    v_usuario_id,
    v_perfil.nombre,
    null,
    'empresas',
    'eliminar_empresa_vacia',
    'empresa',
    p_empresa_id,
    v_empresa.estado,
    'eliminada',
    'Empresa vacia de prueba/no operativa eliminada fisicamente.',
    true,
    jsonb_build_object(
      'empresa_id_eliminada', p_empresa_id,
      'nombre', coalesce(v_empresa.nombre, v_empresa.razon_social, v_empresa.nombre_comercial),
      'estado', v_empresa.estado,
      'motivos_limpieza', v_motivos,
      'dependencias', v_dependencias,
      'no_borro_usuarios', true,
      'no_borro_permisos', true,
      'no_borro_auditoria', true,
      'no_borro_documentos_storage', true
    ),
    'rpc_limpieza_empresas'
  );

  delete from empresas
  where id = p_empresa_id;

  return jsonb_build_object(
    'ok', true,
    'eliminada', true,
    'empresa_id', p_empresa_id,
    'nombre', coalesce(v_empresa.nombre, v_empresa.razon_social, v_empresa.nombre_comercial),
    'estado', v_empresa.estado,
    'dependencias', v_dependencias,
    'motivos_limpieza', v_motivos
  );
end;
$$;

grant execute on function public.eliminar_empresa_vacia_segura(bigint, text) to authenticated;
