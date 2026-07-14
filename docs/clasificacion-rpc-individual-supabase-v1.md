# Clasificación individual de RPC y funciones de Supabase V1

- Proyecto: `control-contable`
- Rama: `fix/supabase-clasificacion-rpc-individual-v1`
- Estado: clasificación individual completada
- Evidencia: repositorio local y snapshot remoto R01–R37
- Cambios remotos: ninguno
- Producción: NO-GO

## 1. Objetivo

Clasificar las funciones y RPC de `public` según el acceso efectivo de `anon`, `authenticated`, `service_role` y `PUBLIC`.

Este documento no autoriza cambios de `EXECUTE`, modificaciones de funciones ni ejecución de SQL remoto.

## 2. Estados de clasificación

- `PUBLICA_APROBADA`: puede ser ejecutada sin autenticación y su exposición está justificada.
- `AUTENTICADA`: requiere usuario autenticado y validaciones internas de usuario, empresa y rol.
- `INTERNA_SERVICE_ROLE`: reservada para backend o automatizaciones confiables.
- `SISTEMA_CONTROLADA`: pertenece a procesos internos de autenticación o mantenimiento y requiere revisión especial.
- `CANDIDATA_REVOCACION`: posee acceso más amplio de lo necesario, pendiente de pruebas antes de modificarlo.
- `PENDIENTE_AUDITORIA`: falta revisar cuerpo, parámetros, propietario, dependencias o uso real.

## 3. Criterios obligatorios de revisión

Para cada función deben registrarse:

- schema, nombre y firma completa;
- propietario;
- uso de `SECURITY DEFINER` o `SECURITY INVOKER`;
- configuración de `search_path`;
- roles con `EXECUTE` efectivo;
- validación de `auth.uid()`;
- validación de empresa y rol operativo;
- protección contra llamadas directas;
- idempotencia y concurrencia cuando aplique;
- referencias desde la aplicación o desde otras funciones;
- clasificación propuesta y decisión pendiente.

La existencia de RLS no vuelve segura automáticamente una función privilegiada.

## 4. Resumen de exposición observada

- Se detectaron 32 funciones de `public` ejecutables efectivamente por `anon`.
- Se detectaron 22 funciones `SECURITY DEFINER` ejecutables por `PUBLIC`.
- Se detectaron 32 funciones privilegiadas con `search_path=public`.
- La función `handle_new_user()` no tiene un `search_path` explícito.
- Las funciones V2 de empleados tienen una ruta vacía explícita como control positivo.

Estos conteos no significan que todas las funciones sean inseguras, pero requieren clasificación individual antes de conservar o retirar permisos.

Restricciones de esta fase:

- No ejecutar `GRANT` ni `REVOKE`.
- No modificar funciones.
- No cambiar propietarios ni `search_path`.
- No ejecutar SQL remoto.
- No asumir que una función necesita acceso anónimo únicamente porque actualmente lo posee.

## 5. Grupos prioritarios de auditoría

### 5.1 Autenticación y creación de usuarios

- Incluye `handle_new_user()` y funciones relacionadas con onboarding.
- Prioridad: crítica.
- Motivo: pueden ejecutarse durante procesos de autenticación y crear relaciones iniciales.
- Validar: `search_path`, datos derivados del usuario y protección contra asignación indebida de empresas o roles.

### 5.2 Empresas, roles y autorizaciones

- Incluye funciones que asignan empresas, roles o capacidades operativas.
- Prioridad: crítica.
- Validar: `auth.uid()`, pertenencia multiempresa, rol administrador y prevención de autoasignación de privilegios.

### 5.3 Pagos, cheques y órdenes

- Incluye funciones relacionadas con cuentas por pagar, cuentas por cobrar, cheques y órdenes de compra.
- Prioridad: crítica.
- Validar: empresa autorizada, estado previo, doble envío, concurrencia, idempotencia y auditoría.

### 5.4 Empleados y planillas

- Incluye funciones del Maestro de Empleados, importaciones y operaciones de planilla.
- Prioridad: alta.
- Validar: empresa, permisos laborales, compatibilidad con `empleados_planilla` y resistencia a llamadas directas.

### 5.5 Rate limiting, monitoreo e idempotencia

- Incluye funciones auxiliares de seguridad, límites, alertas e identificadores operativos.
- Prioridad: alta.
- Validar: que no puedan alterarse desde clientes API y que conserven registros de auditoría.

La clasificación individual se realizará después de reunir la firma, permisos y evidencia de uso de cada función.

## 6. Ficha obligatoria por función

Cada función deberá documentarse con esta estructura:

### `schema.nombre_funcion(firma)`

- Propietario: pendiente.
- Seguridad: `SECURITY DEFINER`, `SECURITY INVOKER` o pendiente.
- `search_path`: pendiente.
- `EXECUTE` por `anon`: sí, no o pendiente.
- `EXECUTE` por `authenticated`: sí, no o pendiente.
- `EXECUTE` por `service_role`: sí, no o pendiente.
- Uso desde la aplicación: confirmado, no detectado o pendiente.
- Validación de `auth.uid()`: confirmada, ausente o pendiente.
- Validación multiempresa: confirmada, ausente o pendiente.
- Validación de rol operativo: confirmada, ausente o pendiente.
- Idempotencia y concurrencia: aplica, no aplica o pendiente.
- Clasificación propuesta: `PUBLICA_APROBADA`, `AUTENTICADA`, `INTERNA_SERVICE_ROLE`, `SISTEMA_CONTROLADA`, `CANDIDATA_REVOCACION` o `PENDIENTE_AUDITORIA`.
- Evidencia: pendiente.
- Decisión pendiente: pendiente.

No se aprobará ningún cambio de permisos sin completar esta ficha y sus pruebas correspondientes.

## 7. Criterio de cierre y siguiente fase

Esta fase deja preparada la estructura de clasificación, pero todavía no autoriza cambios de permisos.

Antes de diseñar cualquier `REVOKE` o `GRANT` debe incorporarse:

- el listado exacto de funciones ejecutables por `anon`;
- el listado exacto de funciones ejecutables por `authenticated`;
- la firma completa de cada función;
- su propietario, seguridad y `search_path`;
- evidencia de uso desde la aplicación;
- revisión del cuerpo de cada función sensible;
- pruebas positivas y negativas por rol.

El inventario individual quedó completado utilizando únicamente evidencia del snapshot remoto R01–R37 y del repositorio.

Producción continúa en estado NO-GO.

## 8. Evidencia local consolidada

La revisión del repositorio identificó:

- 41 definiciones locales de funciones;
- 41 firmas únicas;
- 0 firmas duplicadas;
- 33 funciones `SECURITY DEFINER`;
- 8 funciones `SECURITY INVOKER` por comportamiento predeterminado;
- 22 funciones con `search_path = public`;
- 17 funciones con `search_path` vacío;
- 2 funciones `INVOKER` sin `search_path` explícito;
- 23 sentencias locales de `GRANT EXECUTE`;
- 26 funciones con `GRANT EXECUTE` explícito para `authenticated`;
- 15 funciones sin `GRANT EXECUTE` explícito para `authenticated`;
- 0 sentencias locales con la forma exacta `REVOKE EXECUTE`; sí se detectaron revocaciones mediante `REVOKE ALL ON FUNCTION`;
- 0 correcciones locales de privilegios predeterminados sobre funciones;
- 20 funciones referenciadas directamente desde la aplicación;
- 21 funciones sin referencia directa desde la aplicación, pero con uso interno detectado en SQL;
- 0 funciones locales sin uso detectado entre aplicación y SQL.

Estos resultados no prueban los permisos efectivos remotos de cada función. La clasificación definitiva debe combinar esta evidencia local con el snapshot remoto R01–R37.

No se autoriza eliminar, modificar, revocar ni conceder permisos sobre ninguna función durante esta fase.

## 9. Clasificación individual de funciones locales

La siguiente tabla consolida la clasificación basada únicamente en evidencia verificable del repositorio y del snapshot remoto R01–R37.

| Función | Archivo local | Seguridad | search_path | Grant authenticated | Uso aplicación | Uso interno SQL | Clasificación |
|---|---|---|---|---|---|---|---|
| `public.contabilidad_autorizado` | `sql/contabilidad_formal_rls_revisable.sql` | SECURITY DEFINER | `public` | SI | NO_DIRECTO | SI | `AUTENTICADA` |
| `public.contabilidad_empresa_permitida` | `sql/contabilidad_formal_rls_revisable.sql` | SECURITY DEFINER | `public` | SI | NO_DIRECTO | SI | `AUTENTICADA` |
| `public.monitoreo_alertas_set_actualizado_at` | `sql/monitoreo_alertas.sql` | SECURITY INVOKER | `SIN_EXPLICITO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.movimientos_empresa_asignada` | `sql/movimientos_operativos_rls_propuesto.sql` | SECURITY DEFINER | `public` | SI | NO_DIRECTO | SI | `AUTENTICADA` |
| `public.movimientos_puede_anular` | `sql/movimientos_operativos_rls_propuesto.sql` | SECURITY DEFINER | `public` | SI | NO_DIRECTO | SI | `AUTENTICADA` |
| `public.movimientos_puede_escribir` | `sql/movimientos_operativos_rls_propuesto.sql` | SECURITY DEFINER | `public` | SI | NO_DIRECTO | SI | `AUTENTICADA` |
| `public.validar_anulacion_movimiento_operativo` | `sql/movimientos_operativos_rls_propuesto.sql` | SECURITY DEFINER | `public` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.anular_asiento_contable` | `sql/rpc_anular_asiento_contable.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.registrar_asiento_completo` | `sql/rpc_asientos_contables.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.cerrar_periodo_contable` | `sql/rpc_cerrar_periodo_contable.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.anular_cheque_transaccional` | `sql/rpc_cheques.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.autorizar_cheque_transaccional` | `sql/rpc_cheques.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.crear_cheque_transaccional` | `sql/rpc_cheques.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.pagar_cheque_transaccional` | `sql/rpc_cheques.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.rechazar_cheque_transaccional` | `sql/rpc_cheques.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.contabilizar_documento_contable` | `sql/rpc_contabilizar_documento_contable.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.finalizar_asiento_contable` | `sql/rpc_finalizar_asiento_contable.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `AUTENTICADA` |
| `public.eliminar_empresa_vacia_segura` | `sql/rpc_limpieza_empresas.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `CANDIDATA_REVOCACION` |
| `public.anular_pago_cxc` | `sql/rpc_pagos_cxp_cxc.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `CANDIDATA_REVOCACION` |
| `public.anular_pago_cxp` | `sql/rpc_pagos_cxp_cxc.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `CANDIDATA_REVOCACION` |
| `public.registrar_pago_cxc` | `sql/rpc_pagos_cxp_cxc.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `CANDIDATA_REVOCACION` |
| `public.registrar_pago_cxp` | `sql/rpc_pagos_cxp_cxc.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `CANDIDATA_REVOCACION` |
| `public.registrar_rate_limit_operativo` | `sql/rpc_rate_limit_operativo.sql` | SECURITY DEFINER | `public` | SI | SI | SI | `INTERNA_SERVICE_ROLE` |
| `public.seguridad_operativa_set_actualizado_at` | `sql/seguridad_operativa.sql` | SECURITY INVOKER | `SIN_EXPLICITO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.actualizar_empleado_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | SI | SI | SI | `AUTENTICADA` |
| `public.crear_empleado_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | SI | SI | SI | `AUTENTICADA` |
| `public.empleados_empresa_permitida_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | SI | NO_DIRECTO | SI | `AUTENTICADA` |
| `public.empleados_fallar_operacion_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.empleados_puede_escribir_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.empleados_puede_estado_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.empleados_puede_sensible_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.empleados_reservar_operacion_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.empleados_snapshot_auditable_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY INVOKER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `CANDIDATA_REVOCACION` |
| `public.empleados_try_bigint_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY INVOKER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `CANDIDATA_REVOCACION` |
| `public.empleados_try_date_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY INVOKER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `CANDIDATA_REVOCACION` |
| `public.empleados_try_integer_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY INVOKER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `CANDIDATA_REVOCACION` |
| `public.empleados_try_numeric_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY INVOKER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `CANDIDATA_REVOCACION` |
| `public.empleados_try_uuid_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY INVOKER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `CANDIDATA_REVOCACION` |
| `public.empleados_validar_fila_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | NO_EXPLICITO | NO_DIRECTO | SI | `SISTEMA_CONTROLADA` |
| `public.importar_empleados_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | SI | SI | SI | `AUTENTICADA` |
| `public.validar_importacion_empleados_v2` | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql` | SECURITY DEFINER | `VACIO` | SI | SI | SI | `AUTENTICADA` |





## 10. Resultado consolidado de clasificación

Se clasificaron las 41 funciones locales identificadas:

- 20 funciones `AUTENTICADA`;
- 9 funciones `SISTEMA_CONTROLADA`;
- 11 funciones `CANDIDATA_REVOCACION`;
- 1 función `INTERNA_SERVICE_ROLE`;
- 0 funciones `PUBLICA_APROBADA`;
- 0 funciones `PENDIENTE_AUDITORIA`.

La categoría `AUTENTICADA` describe el canal de uso previsto y la existencia de validaciones internas. No constituye aprobación para producción ni confirma que los privilegios remotos actuales sean seguros.

Las funciones `SISTEMA_CONTROLADA` corresponden a helpers internos, validadores o procesos controlados que no deben convertirse en una API pública general.

Las funciones `CANDIDATA_REVOCACION` conservan utilidad interna, pero su ejecución directa debe cerrarse o restringirse durante la remediación.

La función `public.registrar_rate_limit_operativo` queda clasificada como `INTERNA_SERVICE_ROLE` porque los límites, ventanas, claves y alcances deben ser definidos por un backend confiable y no por el cliente autenticado.

## 11. Prioridades derivadas

1. Restringir `public.registrar_rate_limit_operativo` a un backend confiable o `service_role`.
2. Revisar y cerrar la ejecución directa de las 11 funciones `CANDIDATA_REVOCACION`.
3. Endurecer las RPC de pagos CxP/CxC con funciones operativas específicas, bloqueo explícito de auditor, auditoría y errores genéricos.
4. Revisar `public.eliminar_empresa_vacia_segura` por tratarse de una operación de borrado físico.
5. Fijar un `search_path` seguro y privilegios explícitos en las funciones que todavía usan `public`.
6. Corregir los errores sintácticos y de codificación de la migración Maestro de Empleados V2 antes de cualquier validación ejecutable.
7. Mantener producción en estado **NO-GO** hasta completar migraciones reproducibles, privilegios mínimos y pruebas positivas y negativas por rol.

## 12. Estado de esta fase

- Documento de clasificación: completo.
- Funciones pendientes de clasificar: 0.
- Cambios remotos en Supabase: ninguno.
- Permisos remotos modificados: ninguno.
- Migraciones ejecutadas: ninguna.
- Autorización para despliegue: no concedida.
- Estado de producción: **NO-GO**.
