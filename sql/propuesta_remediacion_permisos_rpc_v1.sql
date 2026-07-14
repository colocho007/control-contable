-- Propuesta de remediación de permisos RPC Supabase V1
-- Generada desde la matriz documental de 41 funciones.
-- NO EJECUTAR EN REMOTO SIN REVISIÓN Y APROBACIÓN.
-- No modifica cuerpos, propietarios ni search_path.

BEGIN;

-- Verificación previa: todas las firmas deben existir.
DO $remediation$
BEGIN
  IF to_regprocedure('public.contabilidad_autorizado(bigint, text[], text[])') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.contabilidad_autorizado(bigint, text[], text[])';
  END IF;
  IF to_regprocedure('public.contabilidad_empresa_permitida(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.contabilidad_empresa_permitida(bigint)';
  END IF;
  IF to_regprocedure('public.monitoreo_alertas_set_actualizado_at()') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.monitoreo_alertas_set_actualizado_at()';
  END IF;
  IF to_regprocedure('public.movimientos_empresa_asignada(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.movimientos_empresa_asignada(bigint)';
  END IF;
  IF to_regprocedure('public.movimientos_puede_anular(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.movimientos_puede_anular(bigint)';
  END IF;
  IF to_regprocedure('public.movimientos_puede_escribir(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.movimientos_puede_escribir(bigint)';
  END IF;
  IF to_regprocedure('public.validar_anulacion_movimiento_operativo()') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.validar_anulacion_movimiento_operativo()';
  END IF;
  IF to_regprocedure('public.anular_asiento_contable(uuid, bigint, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.anular_asiento_contable(uuid, bigint, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text)';
  END IF;
  IF to_regprocedure('public.cerrar_periodo_contable(uuid, bigint, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.cerrar_periodo_contable(uuid, bigint, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.anular_cheque_transaccional(bigint, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.anular_cheque_transaccional(bigint, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.autorizar_cheque_transaccional(bigint, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.autorizar_cheque_transaccional(bigint, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text)';
  END IF;
  IF to_regprocedure('public.pagar_cheque_transaccional(bigint, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.pagar_cheque_transaccional(bigint, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.contabilizar_documento_contable(uuid, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.contabilizar_documento_contable(uuid, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.finalizar_asiento_contable(uuid, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.finalizar_asiento_contable(uuid, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.eliminar_empresa_vacia_segura(bigint, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.eliminar_empresa_vacia_segura(bigint, text)';
  END IF;
  IF to_regprocedure('public.anular_pago_cxc(text, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.anular_pago_cxc(text, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.anular_pago_cxp(text, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.anular_pago_cxp(text, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb)';
  END IF;
  IF to_regprocedure('public.seguridad_operativa_set_actualizado_at()') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.seguridad_operativa_set_actualizado_at()';
  END IF;
  IF to_regprocedure('public.actualizar_empleado_v2(uuid, integer, jsonb, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.actualizar_empleado_v2(uuid, integer, jsonb, text)';
  END IF;
  IF to_regprocedure('public.crear_empleado_v2(jsonb, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.crear_empleado_v2(jsonb, text)';
  END IF;
  IF to_regprocedure('public.empleados_empresa_permitida_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_empresa_permitida_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_fallar_operacion_v2(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_fallar_operacion_v2(uuid, text)';
  END IF;
  IF to_regprocedure('public.empleados_puede_escribir_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_puede_escribir_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_puede_estado_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_puede_estado_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_puede_sensible_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_puede_sensible_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_reservar_operacion_v2(text, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_reservar_operacion_v2(text, text, text, text)';
  END IF;
  IF to_regprocedure('public.empleados_snapshot_auditable_v2(public.empleados_planilla)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_snapshot_auditable_v2(public.empleados_planilla)';
  END IF;
  IF to_regprocedure('public.empleados_try_bigint_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_try_bigint_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_date_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_try_date_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_integer_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_try_integer_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_numeric_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_try_numeric_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_uuid_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_try_uuid_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_validar_fila_v2(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.empleados_validar_fila_v2(jsonb)';
  END IF;
  IF to_regprocedure('public.importar_empleados_v2(text, text, bigint, text, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.importar_empleados_v2(text, text, bigint, text, text, jsonb)';
  END IF;
  IF to_regprocedure('public.validar_importacion_empleados_v2(text, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Función no encontrada: public.validar_importacion_empleados_v2(text, text, jsonb)';
  END IF;
END;
$remediation$;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.contabilidad_autorizado(bigint, text[], text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contabilidad_autorizado(bigint, text[], text[]) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.contabilidad_empresa_permitida(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contabilidad_empresa_permitida(bigint) TO authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.monitoreo_alertas_set_actualizado_at() FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.movimientos_empresa_asignada(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.movimientos_empresa_asignada(bigint) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.movimientos_puede_anular(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.movimientos_puede_anular(bigint) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.movimientos_puede_escribir(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.movimientos_puede_escribir(bigint) TO authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.validar_anulacion_movimiento_operativo() FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.anular_asiento_contable(uuid, bigint, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anular_asiento_contable(uuid, bigint, text, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.cerrar_periodo_contable(uuid, bigint, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cerrar_periodo_contable(uuid, bigint, text, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.anular_cheque_transaccional(bigint, bigint, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anular_cheque_transaccional(bigint, bigint, uuid, text, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.autorizar_cheque_transaccional(bigint, bigint, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.autorizar_cheque_transaccional(bigint, bigint, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.pagar_cheque_transaccional(bigint, bigint, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pagar_cheque_transaccional(bigint, bigint, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.contabilizar_documento_contable(uuid, bigint, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contabilizar_documento_contable(uuid, bigint, uuid, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.finalizar_asiento_contable(uuid, bigint, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_asiento_contable(uuid, bigint, uuid, text) TO authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.eliminar_empresa_vacia_segura(bigint, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.anular_pago_cxc(text, bigint, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.anular_pago_cxp(text, bigint, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: INTERNA_SERVICE_ROLE
REVOKE EXECUTE ON FUNCTION public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb) TO service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.seguridad_operativa_set_actualizado_at() FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.actualizar_empleado_v2(uuid, integer, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.actualizar_empleado_v2(uuid, integer, jsonb, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.crear_empleado_v2(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_empleado_v2(jsonb, text) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.empleados_empresa_permitida_v2(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.empleados_empresa_permitida_v2(bigint) TO authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.empleados_fallar_operacion_v2(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.empleados_puede_escribir_v2(bigint) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.empleados_puede_estado_v2(bigint) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.empleados_puede_sensible_v2(bigint) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.empleados_reservar_operacion_v2(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.empleados_snapshot_auditable_v2(public.empleados_planilla) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.empleados_try_bigint_v2(text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.empleados_try_date_v2(text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.empleados_try_integer_v2(text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.empleados_try_numeric_v2(text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: CANDIDATA_REVOCACION
REVOKE EXECUTE ON FUNCTION public.empleados_try_uuid_v2(text) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: SISTEMA_CONTROLADA
REVOKE EXECUTE ON FUNCTION public.empleados_validar_fila_v2(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.importar_empleados_v2(text, text, bigint, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.importar_empleados_v2(text, text, bigint, text, text, jsonb) TO authenticated, service_role;

-- Categoría: AUTENTICADA
REVOKE EXECUTE ON FUNCTION public.validar_importacion_empleados_v2(text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_importacion_empleados_v2(text, text, jsonb) TO authenticated, service_role;

COMMIT;

-- Fin de la propuesta. Producción continúa NO-GO.
