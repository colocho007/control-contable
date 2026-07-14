-- Propuesta de remediacion search_path RPC Supabase V1
-- EJECUTADO CONTROLADAMENTE EN SUPABASE EL 2026-07-14 Y VERIFICADO CON PREFLIGHT.
-- No modifica cuerpos, propietarios, datos ni permisos EXECUTE.

BEGIN;

DO $search_path_remediation$
BEGIN
  IF to_regprocedure('public.contabilidad_autorizado(bigint, text[], text[])') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.contabilidad_autorizado(bigint, text[], text[])';
  END IF;
  IF to_regprocedure('public.contabilidad_empresa_permitida(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.contabilidad_empresa_permitida(bigint)';
  END IF;
  IF to_regprocedure('public.monitoreo_alertas_set_actualizado_at()') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.monitoreo_alertas_set_actualizado_at()';
  END IF;
  IF to_regprocedure('public.movimientos_empresa_asignada(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.movimientos_empresa_asignada(bigint)';
  END IF;
  IF to_regprocedure('public.movimientos_puede_anular(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.movimientos_puede_anular(bigint)';
  END IF;
  IF to_regprocedure('public.movimientos_puede_escribir(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.movimientos_puede_escribir(bigint)';
  END IF;
  IF to_regprocedure('public.validar_anulacion_movimiento_operativo()') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.validar_anulacion_movimiento_operativo()';
  END IF;
  IF to_regprocedure('public.anular_asiento_contable(uuid, bigint, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.anular_asiento_contable(uuid, bigint, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text)';
  END IF;
  IF to_regprocedure('public.cerrar_periodo_contable(uuid, bigint, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.cerrar_periodo_contable(uuid, bigint, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.anular_cheque_transaccional(bigint, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.anular_cheque_transaccional(bigint, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.autorizar_cheque_transaccional(bigint, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.autorizar_cheque_transaccional(bigint, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text)';
  END IF;
  IF to_regprocedure('public.pagar_cheque_transaccional(bigint, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.pagar_cheque_transaccional(bigint, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.contabilizar_documento_contable(uuid, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.contabilizar_documento_contable(uuid, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.finalizar_asiento_contable(uuid, bigint, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.finalizar_asiento_contable(uuid, bigint, uuid, text)';
  END IF;
  IF to_regprocedure('public.eliminar_empresa_vacia_segura(bigint, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.eliminar_empresa_vacia_segura(bigint, text)';
  END IF;
  IF to_regprocedure('public.anular_pago_cxc(text, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.anular_pago_cxc(text, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.anular_pago_cxp(text, bigint, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.anular_pago_cxp(text, bigint, uuid, text, text)';
  END IF;
  IF to_regprocedure('public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text)';
  END IF;
  IF to_regprocedure('public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb)';
  END IF;
  IF to_regprocedure('public.seguridad_operativa_set_actualizado_at()') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.seguridad_operativa_set_actualizado_at()';
  END IF;
  IF to_regprocedure('public.actualizar_empleado_v2(uuid, integer, jsonb, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.actualizar_empleado_v2(uuid, integer, jsonb, text)';
  END IF;
  IF to_regprocedure('public.crear_empleado_v2(jsonb, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.crear_empleado_v2(jsonb, text)';
  END IF;
  IF to_regprocedure('public.empleados_empresa_permitida_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_empresa_permitida_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_fallar_operacion_v2(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_fallar_operacion_v2(uuid, text)';
  END IF;
  IF to_regprocedure('public.empleados_puede_escribir_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_puede_escribir_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_puede_estado_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_puede_estado_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_puede_sensible_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_puede_sensible_v2(bigint)';
  END IF;
  IF to_regprocedure('public.empleados_reservar_operacion_v2(text, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_reservar_operacion_v2(text, text, text, text)';
  END IF;
  IF to_regprocedure('public.empleados_snapshot_auditable_v2(public.empleados_planilla)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_snapshot_auditable_v2(public.empleados_planilla)';
  END IF;
  IF to_regprocedure('public.empleados_try_bigint_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_try_bigint_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_date_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_try_date_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_integer_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_try_integer_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_numeric_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_try_numeric_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_try_uuid_v2(text)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_try_uuid_v2(text)';
  END IF;
  IF to_regprocedure('public.empleados_validar_fila_v2(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.empleados_validar_fila_v2(jsonb)';
  END IF;
  IF to_regprocedure('public.importar_empleados_v2(text, text, bigint, text, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.importar_empleados_v2(text, text, bigint, text, text, jsonb)';
  END IF;
  IF to_regprocedure('public.validar_importacion_empleados_v2(text, text, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Funcion no encontrada: public.validar_importacion_empleados_v2(text, text, jsonb)';
  END IF;
END;
$search_path_remediation$;

ALTER FUNCTION public.contabilidad_autorizado(bigint, text[], text[]) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.contabilidad_empresa_permitida(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.monitoreo_alertas_set_actualizado_at() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.movimientos_empresa_asignada(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.movimientos_puede_anular(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.movimientos_puede_escribir(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validar_anulacion_movimiento_operativo() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.anular_asiento_contable(uuid, bigint, text, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.registrar_asiento_completo(bigint, uuid, date, text, text, text, jsonb, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.cerrar_periodo_contable(uuid, bigint, text, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.anular_cheque_transaccional(bigint, bigint, uuid, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.autorizar_cheque_transaccional(bigint, bigint, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.crear_cheque_transaccional(bigint, bigint, date, text, text, numeric, text, numeric, text, text, text, uuid, bigint, bigint, text, text, timestamp with time zone, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.pagar_cheque_transaccional(bigint, bigint, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.rechazar_cheque_transaccional(bigint, bigint, uuid, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.contabilizar_documento_contable(uuid, bigint, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.finalizar_asiento_contable(uuid, bigint, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.eliminar_empresa_vacia_segura(bigint, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.anular_pago_cxc(text, bigint, uuid, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.anular_pago_cxp(text, bigint, uuid, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.registrar_pago_cxc(text, bigint, date, text, text, text, text, numeric, text, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.registrar_pago_cxp(text, bigint, date, text, text, text, text, numeric, text, uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.registrar_rate_limit_operativo(text, text, text, text, integer, integer, bigint, text, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.seguridad_operativa_set_actualizado_at() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.actualizar_empleado_v2(uuid, integer, jsonb, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.crear_empleado_v2(jsonb, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_empresa_permitida_v2(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_fallar_operacion_v2(uuid, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_puede_escribir_v2(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_puede_estado_v2(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_puede_sensible_v2(bigint) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_reservar_operacion_v2(text, text, text, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_snapshot_auditable_v2(public.empleados_planilla) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_try_bigint_v2(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_try_date_v2(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_try_integer_v2(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_try_numeric_v2(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_try_uuid_v2(text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.empleados_validar_fila_v2(jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.importar_empleados_v2(text, text, bigint, text, text, jsonb) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validar_importacion_empleados_v2(text, text, jsonb) SET search_path = pg_catalog, public, pg_temp;

COMMIT;

-- Produccion continua NO-GO.