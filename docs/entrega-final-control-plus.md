# Entrega final operativa Control+

## 1. Objetivo y estado general

Este documento concentra la verificacion final necesaria antes de habilitar
Control+ para operacion productiva.

Estado del repositorio al preparar este documento:

- Rama de entrega: `feature/checklist-final-produccion-control-plus`.
- Arbol de trabajo: limpio antes de crear este documento.
- Build de produccion: aprobado con `npm run build`.
- Revision de diferencias: aprobada con `git diff --check`.
- SQL critico requerido: presente en el repositorio.
- Documentacion de usuario, administracion, permisos, produccion y prueba
  integral: presente.

Estado recomendado: **listo para validacion final de produccion**.

Este estado no confirma que los scripts SQL ya esten aplicados en Supabase ni
que los usuarios productivos ya esten configurados. Esas verificaciones deben
completarse con evidencia antes de declarar la entrega aprobada.

## 2. Documentacion de entrega

| Documento | Estado en repositorio | Uso |
|---|---|---|
| [Paquete formal de entrega](paquete-entrega/README.md) | Disponible | Orden de despliegue, SQL, checklist y acta de cierre |
| [Manual de usuario](manual-usuario-control-plus.md) | Disponible | Operacion diaria y errores comunes |
| [Manual administrativo](manual-admin-control-plus.md) | Disponible | Usuarios, empresas, roles, funciones y auditoria |
| [Checklist de produccion](checklist-produccion-control-plus.md) | Disponible | Verificacion detallada y firmas |
| [Matriz de permisos](matriz-permisos-control-plus.md) | Disponible | Alcance por funcion operativa |
| [Prueba integral](prueba-integral-contabilidad-operativa.md) | Disponible | Pruebas positivas, negativas y de coherencia |

## 3. Estado final por modulo

Los estados de esta seccion describen evidencia disponible en el repositorio.
Las pruebas con usuarios y datos productivos siguen siendo obligatorias.

| Modulo | Estado de entrega | Evidencia y verificacion pendiente |
|---|---|---|
| Admin | Listo para validacion operativa | Gestiona roles, empresas, modulos y funciones por empresa; bloquea combinar auditor con funciones de escritura. Probar cambios y auditoria con administrador real. |
| Empresas | Listo para validacion operativa | Los flujos revisados filtran y validan empresa asignada. Confirmar empresas activas y asignaciones productivas. |
| Usuarios | Listo para configuracion final | Perfiles activos, roles y asignaciones estan contemplados. Crear o confirmar usuarios base y probar inicio de sesion. |
| Permisos | Listo en codigo y documentacion | Funciones contables especializadas, auditor y `pagador_cheque` estan alineados. Confirmar funciones activas por empresa en Supabase. |
| Contabilidad | Listo para prueba integral | Creacion en borrador, finalizacion, anulacion, documentos, distribuciones y cierre usan flujos controlados. Ejecutar casos positivos y negativos con usuarios reales. |
| Cheques | Listo para prueba integral | Pago usa RPC transaccional y exige `pagador_cheque`. Confirmar autorizacion, fondo, pago, movimiento y auditoria. |
| Movimientos | SQL revisable disponible | RLS propuesto limita consulta por empresa, escritura de auditor, anulacion logica y DELETE. Confirmar aplicacion y compatibilidad productiva. |
| Impuestos | Listo para prueba integral | Configuracion exige `contabilidad_configuracion`; auditor solo consulta. Confirmar RLS aplicado y empresas visibles. |
| Reportes | Listo para validacion contable | Incluye balance de comprobacion, diario, mayor, resultados base, movimientos y cierres. Confirmar filtros y clasificacion de catalogo. |
| Exportaciones | Listo para validacion operativa | CSV compatible con Excel y vistas imprimibles usan filtros cargados. Probar caracteres especiales, formulas CSV y guardado PDF. |
| Auditoria | Lista para validacion operativa | Operaciones criticas e intentos bloqueados contemplan auditoria. Revisar eventos reales en Historial y Monitoreo. |

## 4. SQL critico requerido en Supabase

Los siguientes archivos existen en `/sql`. Deben revisarse y aplicarse en el
proyecto Supabase correcto. La presencia en el repositorio no confirma su
ejecucion.

| Orden recomendado | Archivo | Objetivo | Confirmado en Supabase |
|---:|---|---|---|
| 1 | `sql/rpc_asientos_contables.sql` | Crear asientos completos solamente como borrador | [ ] |
| 2 | `sql/rpc_finalizar_asiento_contable.sql` | Finalizar asientos existentes de forma segura | [ ] |
| 3 | `sql/rpc_anular_asiento_contable.sql` | Anular asientos con motivo y auditoria | [ ] |
| 4 | `sql/rpc_contabilizar_documento_contable.sql` | Contabilizar documentos validados | [ ] |
| 5 | `sql/rpc_cerrar_periodo_contable.sql` | Cerrar periodos sin saltar bloqueos | [ ] |
| 6 | `sql/rpc_cheques.sql` | Operaciones transaccionales de cheques y pago seguro | [ ] |
| 7 | `sql/contabilidad_formal_rls_revisable.sql` | Proteger tablas contables y transiciones criticas | [ ] |
| 8 | `sql/movimientos_operativos_rls_propuesto.sql` | Proteger movimientos operativos | [ ] |
| 9 | `sql/impuestos_configuracion_contabilidad_rls.sql` | Proteger configuracion fiscal por funcion | [ ] |

Antes de ejecutar:

- Confirmar que las tablas, columnas, funciones auxiliares e idempotencia
  requeridas existen.
- Revisar policies y triggers actuales que cada script valida.
- Ejecutar en una ventana controlada y conservar evidencia.
- No omitir excepciones por policies o triggers no versionados.
- Probar con sesiones `authenticated`; no usar `service_role` para validar RLS.

Despues de ejecutar:

- Consultar `pg_policies` y funciones instaladas.
- Confirmar grants para `authenticated` y revocaciones para `anon`/`public`.
- Ejecutar las pruebas negativas de auditor, usuario sin empresa y usuario sin
  funcion.
- Registrar fecha, responsable, resultado y evidencia de cada script.

## 5. Checklist tecnico final

| Verificacion | Estado actual | Evidencia requerida antes de entrega |
|---|---|---|
| `npm run build` | Aprobado | Next.js compilo, valido TypeScript y genero 34 paginas |
| `git diff --check` | Aprobado | Sin errores |
| Rama de entrega limpia | Confirmada antes de crear este documento | Reconfirmar antes de merge |
| `main` limpio y actualizado | Pendiente | Confirmar despues del merge aprobado |
| Variables de entorno | Pendiente | Revisar valores productivos y secretos de servidor |
| Supabase conectado | Pendiente | Login y consulta en proyecto productivo correcto |
| RLS aplicado | Pendiente | Evidencia de `pg_policies` y pruebas negativas |
| RPCs aplicadas | Pendiente | Evidencia de funciones y pruebas positivas/negativas |
| Usuarios base creados | Pendiente | Lista aprobada de usuarios activos |
| Empresas asignadas | Pendiente | Matriz usuario-empresa aprobada |
| Funciones operativas asignadas | Pendiente | Matriz de permisos aprobada por empresa |
| Reportes visibles | Pendiente | Prueba por empresa, periodo, fecha y moneda |
| Exportaciones funcionando | Pendiente | CSV Excel y vistas imprimibles verificadas |

## 6. Prueba minima obligatoria

Antes de entregar, completar como minimo:

- [ ] Usuario autorizado inicia sesion y solo ve sus empresas.
- [ ] Usuario sin empresa no consulta datos empresariales.
- [ ] Auditor consulta y exporta, pero no puede escribir, pagar ni cerrar.
- [ ] Auxiliar crea asiento borrador, documento y distribucion.
- [ ] Auxiliar no finaliza ni anula asientos.
- [ ] Contador revisor finaliza y anula por RPC.
- [ ] Creacion directa de asiento registrado es rechazada.
- [ ] Documento invalido no puede contabilizarse.
- [ ] Periodo con bloqueos no puede cerrarse.
- [ ] Periodo valido cierra mediante RPC y deja auditoria.
- [ ] Usuario con `pagador_cheque` paga un cheque autorizado.
- [ ] Admin sin `pagador_cheque` no puede pagar.
- [ ] Pago de cheque genera movimiento operativo activo y auditable.
- [ ] Reportes formales excluyen borradores y anulados.
- [ ] CSV abre correctamente en Excel y respeta filtros.
- [ ] Vista imprimible permite guardar PDF desde el navegador.

La evidencia detallada debe registrarse en
[Prueba integral de contabilidad operativa](prueba-integral-contabilidad-operativa.md).

## 7. Pendientes reales antes de produccion

Estos pendientes no se resuelven solamente con codigo:

1. Ejecutar la prueba integral con usuarios reales y sesiones autenticadas.
2. Validar el catalogo contable, especialmente `tipo` y `subtipo`, para que los
   estados financieros tengan clasificacion suficiente.
3. Obtener aprobacion del contador responsable sobre reportes, saldos, periodos
   y reglas de cierre.
4. Crear un backup verificable antes de aplicar SQL o habilitar operacion.
5. Confirmar que todos los SQL criticos estan aplicados en el Supabase correcto.
6. Configurar y aprobar usuarios, empresas, modulos y funciones operativas.
7. Definir responsable y canal de soporte para la salida a produccion.
8. Confirmar `main` limpio y actualizado despues del merge aprobado.

## 8. Limitaciones que deben comunicarse

- Excel se exporta como CSV compatible con Excel.
- PDF se genera desde la impresion del navegador.
- El balance general formal depende de la clasificacion `tipo`/`subtipo` del
  catalogo de cuentas.
- La contabilizacion documental no crea automaticamente un asiento contable.
- Los SQL revisables deben inspeccionarse antes de ejecutarse.

## 9. Criterio de listo para entrega

Control+ puede declararse **listo para entrega operativa** solamente cuando:

- [ ] No existen bugs bloqueantes abiertos.
- [ ] El build de produccion y `git diff --check` finalizan correctamente.
- [ ] `main` contiene los cambios aprobados y esta limpio.
- [ ] Variables productivas y conexion a Supabase estan verificadas.
- [ ] Los SQL criticos requeridos estan revisados y aplicados.
- [ ] RLS y RPCs pasan pruebas positivas y negativas.
- [ ] Usuarios, empresas, modulos y funciones estan configurados y aprobados.
- [ ] La prueba minima obligatoria esta completada con evidencia.
- [ ] El contador responsable aprobo catalogo, reportes y cierre.
- [ ] Existe un backup previo a produccion.
- [ ] La documentacion fue entregada a usuarios, administradores y soporte.

Si cualquiera de estos puntos criticos queda pendiente, el estado correcto es
**listo para validacion final**, no **entrega aprobada**.

## 10. Aprobacion final

| Area | Responsable | Estado | Fecha | Evidencia o firma |
|---|---|---|---|---|
| Negocio | | Pendiente | | |
| Contabilidad | | Pendiente | | |
| Administracion Control+ | | Pendiente | | |
| Seguridad/Supabase | | Pendiente | | |
| Soporte tecnico | | Pendiente | | |

## 11. Recomendacion final

Proceder con una ventana controlada de validacion final: crear backup, aplicar y
verificar SQL critico, configurar usuarios y permisos, ejecutar la prueba minima
con evidencia y obtener aprobacion contable. Con esos puntos aprobados y sin bugs
bloqueantes, Control+ queda en condicion de entrega operativa.

## 12. Acta tecnica de entrega operativa

Esta acta debe completarse con evidencia del entorno productivo y ser aprobada
por los responsables indicados. Los campos pendientes no deben marcarse como
aprobados solamente por existir en el repositorio.

### Identificacion de la entrega

| Campo | Valor |
|---|---|
| Sistema | Control+ |
| Fecha de preparacion del acta | 2026-06-08 |
| Fecha efectiva de entrega | Pendiente |
| Version/rama | `release/entrega-operativa-control-plus` |
| Estado tecnico del repositorio | Build y `git diff --check` aprobados |
| Estado de entrega | Listo para validacion final; entrega aprobada pendiente |

### Confirmaciones operativas

| Confirmacion | Estado | Responsable | Fecha | Evidencia u observaciones |
|---|---|---|---|---|
| SQL critico revisado y aplicado en Supabase | Pendiente | | | Registrar scripts, orden y resultado |
| RLS y RPCs verificados con sesiones autenticadas | Pendiente | | | Adjuntar pruebas positivas y negativas |
| Usuarios productivos configurados | Pendiente | | | Adjuntar lista aprobada de perfiles activos |
| Empresas productivas configuradas y asignadas | Pendiente | | | Adjuntar matriz usuario-empresa |
| Funciones operativas asignadas por empresa | Pendiente | | | Adjuntar matriz de permisos aprobada |
| Backup previo a produccion realizado | Pendiente | | | Registrar fecha, responsable y ubicacion controlada |
| Prueba minima obligatoria ejecutada | Pendiente | | | Enlazar evidencia de la prueba integral |
| Catalogo `tipo`/`subtipo` validado | Pendiente | | | Registrar revision de clasificacion contable |
| Reportes y exportaciones validados | Pendiente | | | Adjuntar muestras aprobadas |
| Aprobacion contable recibida | Pendiente | | | Firma o confirmacion del contador responsable |
| Documentacion entregada a usuarios y soporte | Pendiente | | | Registrar destinatarios y fecha |

### SQL aplicado

Completar la fecha, responsable y resultado real de cada script:

| Archivo | Aplicado | Fecha | Responsable | Resultado/evidencia |
|---|---|---|---|---|
| `sql/rpc_asientos_contables.sql` | Pendiente | | | |
| `sql/rpc_finalizar_asiento_contable.sql` | Pendiente | | | |
| `sql/rpc_anular_asiento_contable.sql` | Pendiente | | | |
| `sql/rpc_contabilizar_documento_contable.sql` | Pendiente | | | |
| `sql/rpc_cerrar_periodo_contable.sql` | Pendiente | | | |
| `sql/rpc_cheques.sql` | Pendiente | | | |
| `sql/contabilidad_formal_rls_revisable.sql` | Pendiente | | | |
| `sql/movimientos_operativos_rls_propuesto.sql` | Pendiente | | | |
| `sql/impuestos_configuracion_contabilidad_rls.sql` | Pendiente | | | |

### Resumen de configuracion entregada

| Elemento | Cantidad o referencia | Estado | Evidencia |
|---|---|---|---|
| Usuarios configurados | Pendiente | Pendiente | |
| Empresas configuradas | Pendiente | Pendiente | |
| Asignaciones usuario-empresa | Pendiente | Pendiente | |
| Funciones operativas asignadas | Pendiente | Pendiente | |
| Periodos contables abiertos | Pendiente | Pendiente | |
| Fondos y chequeras configurados | Pendiente | Pendiente | |

### Observaciones finales

Registrar aqui excepciones aceptadas, limitaciones comunicadas, incidencias
resueltas durante la salida y cualquier condicion acordada para soporte:

______________________________________________________________________________

______________________________________________________________________________

______________________________________________________________________________

### Aceptacion del acta

| Area | Nombre | Estado | Fecha | Firma o confirmacion |
|---|---|---|---|---|
| Responsable de negocio | | Pendiente | | |
| Contador responsable | | Pendiente | | |
| Administracion Control+ | | Pendiente | | |
| Seguridad/Supabase | | Pendiente | | |
| Soporte tecnico | | Pendiente | | |

La entrega puede declararse aprobada cuando todas las confirmaciones criticas de
esta acta tengan evidencia, no existan bugs bloqueantes y las areas responsables
hayan registrado su aceptacion.
