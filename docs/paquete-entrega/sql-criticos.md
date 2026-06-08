# SQL criticos para entrega operativa Control+

## Reglas de ejecucion

- Ejecutar solamente en el proyecto Supabase productivo confirmado.
- Crear un backup verificable antes de iniciar.
- Revisar cada script antes de ejecutarlo.
- Detenerse ante policies, triggers, tablas o columnas no esperadas.
- Conservar fecha, responsable, resultado y evidencia.
- Probar permisos con sesiones `authenticated`, sin `service_role`.

## Orden recomendado

El orden siguiente instala primero las RPCs seguras y despues aplica las capas
RLS que restringen las rutas directas. Si el entorno tiene dependencias
adicionales, deben revisarse antes de ejecutar.

| Orden | SQL | Proposito |
|---:|---|---|
| 1 | `sql/rpc_asientos_contables.sql` | Instala `registrar_asiento_completo`, que crea asientos solamente como borrador. |
| 2 | `sql/rpc_finalizar_asiento_contable.sql` | Instala la unica transicion segura de un asiento existente a registrado. |
| 3 | `sql/rpc_anular_asiento_contable.sql` | Instala anulacion segura con motivo, permisos, auditoria e idempotencia. |
| 4 | `sql/rpc_contabilizar_documento_contable.sql` | Instala contabilizacion documental validada. |
| 5 | `sql/rpc_cerrar_periodo_contable.sql` | Instala cierre de periodo con permisos, bloqueos, balance y auditoria. |
| 6 | `sql/rpc_cheques.sql` | Instala operaciones transaccionales de cheques; el pago exige `pagador_cheque`. |
| 7 | `sql/contabilidad_formal_rls_revisable.sql` | Restringe tablas contables y bloquea transiciones directas peligrosas. |
| 8 | `sql/movimientos_operativos_rls_propuesto.sql` | Protege consulta, creacion y anulacion logica de movimientos. |
| 9 | `sql/impuestos_configuracion_contabilidad_rls.sql` | Exige `contabilidad_configuracion` para escritura fiscal. |

## Verificacion por script

### `sql/rpc_asientos_contables.sql`

- Confirmar que la funcion existe y tiene grant para `authenticated`.
- Probar que `asiento_manual` crea borrador.
- Probar que `registrado`, `finalizar` y `finalizado` son rechazados.
- Confirmar auditoria e idempotencia.

### `sql/rpc_finalizar_asiento_contable.sql`

- Confirmar que solo `contador_revisor` finaliza.
- Probar periodo abierto, asiento balanceado y estado permitido.
- Confirmar estado registrado y auditoria.
- Probar rechazo de auditor y usuario sin empresa.

### `sql/rpc_anular_asiento_contable.sql`

- Confirmar que exige `contador_revisor` y motivo.
- Probar estado permitido y periodo abierto.
- Confirmar anulacion logica, auditoria e idempotencia.

### `sql/rpc_contabilizar_documento_contable.sql`

- Confirmar que exige revisor autorizado.
- Probar respaldo y distribucion valida y balanceada.
- Confirmar rechazo de documentos pendientes de requisitos.
- Confirmar auditoria.

### `sql/rpc_cerrar_periodo_contable.sql`

- Confirmar que exige `contabilidad_cierre_periodo`.
- Probar rechazo de auditor y periodo no abierto.
- Probar bloqueos por asientos, documentos, diferencia y moneda.
- Confirmar `cerrado_por`, `cerrado_at` y auditoria.

### `sql/rpc_cheques.sql`

- Confirmar funciones transaccionales y grants.
- Probar que `pagar_cheque_transaccional` exige `pagador_cheque`.
- Probar que solo paga cheque autorizado con fondo y moneda validos.
- Confirmar movimiento activo, `creado_por`, auditoria e idempotencia.

### `sql/contabilidad_formal_rls_revisable.sql`

- Revisar todas las policies resultantes en `pg_policies`.
- Confirmar SELECT por empresa asignada y auditor solo lectura.
- Confirmar que transiciones criticas no pasan por update directo.
- Confirmar DELETE bloqueado donde corresponde.

### `sql/movimientos_operativos_rls_propuesto.sql`

- Revisar policies y triggers actuales antes de ejecutar.
- Confirmar SELECT por empresa asignada.
- Confirmar INSERT bloqueado para auditor.
- Confirmar UPDATE limitado a anulacion logica autorizada.
- Confirmar DELETE bloqueado y compatibilidad con pago de cheque.

### `sql/impuestos_configuracion_contabilidad_rls.sql`

- Revisar policies existentes antes de ejecutar.
- Confirmar SELECT por empresa asignada.
- Confirmar escritura solamente con `contabilidad_configuracion`.
- Confirmar auditor solo lectura y DELETE bloqueado.

## Recarga de esquema

Despues de aplicar y verificar los scripts, ejecutar en Supabase SQL Editor:

```sql
notify pgrst, 'reload schema';
```

La recarga no sustituye la verificacion de funciones, grants, policies ni
pruebas con usuarios reales.

## Verificacion posterior general

1. Consultar funciones instaladas y sus grants.
2. Consultar `pg_policies` para las tablas afectadas.
3. Consultar triggers de movimientos y tablas contables.
4. Confirmar ausencia de policies no versionadas.
5. Ejecutar pruebas positivas con usuarios autorizados.
6. Ejecutar pruebas negativas con auditor, usuario sin empresa y usuario sin funcion.
7. Revisar `auditoria_eventos`.
8. Registrar resultados en el checklist y las actas.
