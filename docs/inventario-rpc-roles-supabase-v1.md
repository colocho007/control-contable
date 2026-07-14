# Inventario de RPC y funciones por rol de Supabase V1

- Proyecto: `control-contable`
- Rama: `fix/supabase-inventario-rpc-roles-v1`
- Estado: clasificación y revisión
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

La siguiente fase será completar el inventario individual utilizando únicamente evidencia del snapshot remoto y del repositorio.

Producción continúa en estado NO-GO.