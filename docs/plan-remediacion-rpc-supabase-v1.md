# Plan de remediación de RPC y funciones de Supabase V1

- Proyecto: `control-contable`
- Rama: `fix/supabase-plan-remediacion-rpc-v1`
- Estado: diseño en construcción
- Cambios remotos: ninguno
- Producción: NO-GO

## 1. Objetivo

Diseñar una remediación reproducible y verificable para los permisos, roles, `search_path` y llamadas directas de las funciones y RPC de Supabase.

Este documento no autoriza SQL remoto, `GRANT`, `REVOKE` ni `supabase db push`.

## 2. Principios obligatorios

- Aplicar privilegio mínimo por función y firma exacta.
- No depender únicamente de RLS para proteger funciones privilegiadas.
- Separar funciones para cliente autenticado, sistema interno y backend confiable.
- Incluir pruebas positivas y negativas por rol.
- Preparar una reversión explícita para cada cambio.
- No modificar esquemas de respaldo.
- No volver a ejecutar la migración Maestro de Empleados V2.

## 3. Alcance inicial

- 20 funciones clasificadas como `AUTENTICADA`.
- 9 funciones clasificadas como `SISTEMA_CONTROLADA`.
- 11 funciones clasificadas como `CANDIDATA_REVOCACION`.
- 1 función clasificada como `INTERNA_SERVICE_ROLE`.
- 0 funciones clasificadas como `PUBLICA_APROBADA`.
- 0 funciones pendientes de auditoría.

La clasificación describe el canal previsto de uso, pero no constituye aprobación para producción.

## 4. Tratamiento por categoría

### 4.1 `AUTENTICADA`

- Revocar ejecución a `PUBLIC` y `anon`.
- Conservar `EXECUTE` para `authenticated` únicamente cuando la firma, el cuerpo y las validaciones internas estén aprobados.
- Verificar `auth.uid()`, empresa, rol operativo, auditoría, concurrencia e idempotencia según corresponda.

### 4.2 `SISTEMA_CONTROLADA`

- Impedir su uso como API pública general.
- Conservar únicamente los permisos necesarios para triggers, funciones internas o procesos controlados.
- Confirmar que ninguna llamada legítima dependa del acceso directo del cliente.

### 4.3 `CANDIDATA_REVOCACION`

- Cerrar la ejecución directa de `PUBLIC`, `anon` y `authenticated` hasta completar pruebas específicas.
- Mantener su uso interno solamente cuando exista una dependencia SQL comprobada.
- Sustituir llamadas directas por RPC operativas endurecidas cuando sea necesario.

### 4.4 `INTERNA_SERVICE_ROLE`

- Reservar la ejecución para backend confiable o `service_role`.
- Impedir que el cliente controle límites, ventanas, claves o alcances internos.
- Registrar auditoría y errores genéricos sin exponer detalles sensibles.


## 5. Validaciones obligatorias por función

Antes de modificar permisos, cada función deberá registrar:

- Nombre, esquema y firma exacta.
- Categoría asignada.
- `SECURITY DEFINER` o `SECURITY INVOKER`.
- `search_path` actual y propuesto.
- Roles con `EXECUTE` actualmente.
- Llamadas desde cliente, backend, triggers u otras funciones.
- Validación de `auth.uid()`, empresa, rol y alcance.
- Riesgos de concurrencia, doble envío e idempotencia.
- Cambio propuesto, prueba y reversión.

## 6. Matriz operativa de remediación

Se preparará una matriz única para las 41 funciones con las siguientes columnas:

| Función y firma | Categoría | Uso comprobado | Permiso objetivo | `search_path` | Dependencias | Cambio requerido | Pruebas | Reversión | Estado |
|---|---|---|---|---|---|---|---|---|---|

La matriz será el inventario obligatorio para construir la migración. No se aplicarán cambios generales por nombre incompleto ni sin firma exacta.

## 7. Diseño de la remediación SQL

La futura migración deberá:

- Aplicar `REVOKE` y `GRANT` por función y firma exacta.
- Evitar permisos implícitos para `PUBLIC`.
- Limitar `anon`, `authenticated` y `service_role` según la categoría aprobada.
- Endurecer el `search_path` cuando sea necesario.
- Conservar dependencias legítimas de triggers y procesos internos.
- No modificar esquemas de respaldo.
- No volver a ejecutar la migración Maestro de Empleados V2.
- Ser aditiva, reproducible y reversible.
- Incluir comentarios que relacionen cada cambio con la matriz operativa.

La preparación de esta migración no autoriza su ejecución remota.

## 8. Pruebas mínimas

Cada función modificada deberá contar, según corresponda, con pruebas para:

- Rechazar ejecución como `PUBLIC`.
- Rechazar ejecución como `anon`.
- Permitir o rechazar `authenticated` según su categoría.
- Permitir únicamente el uso interno o `service_role` autorizado.
- Rechazar acceso a otra empresa.
- Rechazar suplantación de usuario, empresa o rol.
- Confirmar que triggers y procesos internos continúan funcionando.
- Verificar concurrencia, doble envío e idempotencia.
- Confirmar que los errores no exponen información sensible.

Las pruebas deberán incluir casos positivos y negativos.

## 9. Reversión

La remediación deberá incluir una reversión explícita que:

- Restaure solamente los permisos anteriores comprobados.
- Use nombres y firmas exactas.
- Revierta cambios de `search_path` cuando corresponda.
- No conceda permisos generales como mecanismo de emergencia.
- Permita identificar qué función fue revertida y por qué.

La reversión deberá revisarse antes de autorizar cualquier ejecución.

## 10. Criterios para cambiar de NO-GO a GO

El estado continuará como `NO-GO` mientras exista cualquiera de estas condiciones:

- Funciones sin firma exacta o sin categoría.
- Dependencias sin comprobar.
- Permisos objetivo sin definir.
- Funciones privilegiadas sin validaciones internas suficientes.
- Migración o reversión incompletas.
- Pruebas negativas pendientes.
- Hallazgos críticos o altos abiertos.

Podrá declararse `GO CONTROLADO` cuando:

- Las 41 funciones estén incluidas en la matriz.
- Los permisos objetivo estén definidos por firma exacta.
- La migración y su reversión estén revisadas.
- Las pruebas locales o de entorno seguro sean satisfactorias.
- No existan hallazgos críticos abiertos.
- Exista aprobación humana para una ventana controlada de ejecución.

El `GO CONTROLADO` no equivale automáticamente a `GO PRODUCCIÓN`.

El `GO PRODUCCIÓN` requerirá además:

- Ejecución controlada y verificable.
- Validación posterior de permisos y funciones.
- Confirmación de que el cliente, los triggers y los procesos internos funcionan correctamente.
- Evidencia de auditoría y plan de respuesta ante incidentes.

## 11. Próximo artefacto

El siguiente artefacto será la matriz operativa de las 41 funciones, construida a partir de:

`docs/clasificacion-rpc-individual-supabase-v1.md`

Hasta completar y revisar esa matriz no se ejecutará SQL remoto, `GRANT`, `REVOKE` ni `supabase db push`.
