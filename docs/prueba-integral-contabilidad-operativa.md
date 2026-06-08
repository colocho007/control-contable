# Prueba integral de contabilidad operativa

Fecha de preparacion: 2026-06-07

Estado inicial: pendiente de ejecucion en staging o entorno controlado.

Documentacion relacionada para entrega:

- [Manual de usuario Control+](manual-usuario-control-plus.md)
- [Manual administrativo Control+](manual-admin-control-plus.md)
- [Checklist de produccion Control+](checklist-produccion-control-plus.md)
- [Matriz de permisos Control+](matriz-permisos-control-plus.md)

## 1. Objetivo y alcance

Confirmar que UI, permisos por empresa, funciones operativas, RLS y RPCs trabajan
de forma coherente en los flujos contables y operativos criticos.

Esta guia no ejecuta SQL de seguridad, no modifica policies y no sustituye una
revision previa de los scripts pendientes en Supabase.

Reglas de ejecucion:

- Usar una empresa exclusiva para QA con datos acotados.
- No usar empresas marcadas como `prueba`, `demo` o `testing`: varias RPC las
  consideran no operativas.
- Ejecutar cada caso con una sesion real del usuario indicado.
- No usar service role para pruebas de permisos o RLS.
- Registrar IDs creados, capturas, mensaje recibido y resultado real.
- Reutilizar una llave de idempotencia solo en los casos que prueban replay.
- No cerrar el periodo principal hasta completar los demas casos. Para probar
  cierre, usar un segundo periodo limpio.

### Trazabilidad del alcance

| Bloque | Casos principales |
|---|---|
| Contabilidad formal | POS-02, POS-03, COH-07, COH-08 |
| Asientos borrador/finalizacion/anulacion | POS-01 a POS-03, NEG-01, NEG-02, NEG-07, NEG-18, NEG-19, COH-01, COH-02, RSK-01 |
| Documentos contables | POS-04, POS-05, POS-07, NEG-03, NEG-06, NEG-16, NEG-17, COH-03, COH-09 |
| Distribuciones | POS-06, NEG-06, NEG-17 |
| Cierre de periodos | POS-13, POS-14, NEG-05, NEG-11, NEG-15, NEG-22 |
| Movimientos operativos | POS-08 a POS-10, NEG-08, NEG-09, NEG-20, NEG-21, COH-05, COH-06 |
| Cheques/pagos | PRE-09, POS-11, NEG-10, COH-04, RSK-02 |
| Impuestos/configuracion | POS-12, NEG-04, NEG-11, NEG-15 |
| Auditor solo lectura | POS-15, NEG-06 a NEG-11 |
| Usuario sin empresa | PRE-06, NEG-12, NEG-13 |
| Reportes/dashboard/flujo efectivo | POS-16, COH-06 a COH-08 |

Estados para completar la matriz:

- `Pendiente`
- `Aprobado`
- `Fallido`
- `Bloqueado`
- `No aplica`

## 2. Riesgos conocidos antes de ejecutar

### Alto

1. RSK-01 mitigado en `fix/bloquear-registro-directo-asientos`:
   `registrar_asiento_completo` rechaza `p_tipo = registrado`, `finalizar` o
   `finalizado` con codigo `registro_directo_no_permitido` y solo crea
   borradores. Mantener el caso de regresion RSK-01.
2. RSK-02 mitigado en `fix/exigir-pagador-cheque-rpc`: tanto la UI como
   `pagar_cheque_transaccional` exigen `pagador_cheque` activo para la empresa,
   sin bypass por rol administrativo o de jefatura. Mantener el caso de
   regresion RSK-02.

Mantener ambos casos como pruebas de regresion antes de aprobar el despliegue.

### Medio

- Las pruebas negativas por UI no bastan: un boton oculto confirma UX, pero el
  rechazo real debe verificarse tambien mediante una llamada autenticada.
- Un periodo con documentos o asientos pendientes bloquea el cierre. Preparar un
  periodo limpio independiente evita resultados ambiguos.
- La contabilizacion documental no crea asiento automatico.
- Estado de resultados y balance general dependen de `tipo` y `subtipo` del
  catalogo. Las cuentas sin clasificacion suficiente se reportan como limitacion
  y no se asignan de forma inventada.

### Bajo

- Dashboard, reportes y flujo de efectivo pueden necesitar recarga para reflejar
  movimientos nuevos o anulados.

## 3. Datos minimos de prueba

Crear o confirmar estos datos antes de iniciar:

| Dato | Cantidad minima | Requisitos |
|---|---:|---|
| Empresa QA operativa | 1 | Estado operativo; no usar nombre/estado prueba, demo o testing |
| Periodo contable principal | 1 | Abierto; incluye la fecha actual |
| Periodo contable para cierre | 1 | Abierto y sin documentos/asientos pendientes |
| Cuentas contables | 2 | Activas, permiten movimientos, misma empresa o globales |
| Cuenta debito | 1 | Para asiento y distribucion |
| Cuenta credito | 1 | Para asiento y distribucion |
| Archivo documental | 1 | PDF/JPG/PNG valido para respaldo activo |
| Configuracion fiscal | 1 | Nombre unico, porcentaje valido y moneda |
| Movimiento importable | 1 | Referencia unica, monto positivo, empresa QA |
| Cheque autorizado | 1 | Monto positivo, empresa QA, estado `Autorizado` |
| Fondo para cheque | 1 | Activo, moneda compatible y saldo suficiente si aplica |

Valores sugeridos:

- Asiento: debito GTQ 100.00 y credito GTQ 100.00.
- Documento: total GTQ 100.00.
- Distribucion: debito GTQ 100.00 y credito GTQ 100.00.
- Movimiento manual: ingreso GTQ 25.00.
- Movimiento importado: egreso GTQ 15.00 con referencia
  `QA-MOV-20260607-001`.
- Motivos de anulacion: al menos 5 caracteres.

Registrar identificadores:

| Identificador | Valor |
|---|---|
| `empresa_id` | |
| `periodo_principal_id` | |
| `periodo_cierre_id` | |
| `cuenta_debito_id` | |
| `cuenta_credito_id` | |
| `asiento_borrador_id` | |
| `asiento_finalizado_id` | |
| `documento_id` | |
| `movimiento_manual_id` | |
| `movimiento_importado_id` | |
| `cheque_id` | |
| `movimiento_cheque_id` | |

## 4. Usuarios y asignaciones

Todos los perfiles deben estar activos. Excepto el usuario sin empresa, asignar
la empresa QA mediante `usuario_empresas.activo = true`.

| Usuario QA | Empresa asignada | Funciones activas requeridas |
|---|---|---|
| Admin explicito | Si | `auxiliar_contable`, `contador_revisor`, `contabilidad_catalogo_admin`, `contabilidad_configuracion`, `contabilidad_cierre_periodo`, `pagador_cheque` |
| Auxiliar | Si | `auxiliar_contable` |
| Revisor | Si | `contador_revisor` |
| Auditor | Si | Solo `auditor_solo_lectura` |
| Sin empresa | No | Ninguna |
| Empresa sin funciones | Si | Ninguna contable |

No combinar `auditor_solo_lectura` con funciones de escritura en la misma
empresa.

## 5. Matriz resumida de permisos esperados

Leyenda: `P` permitido, `D` denegado, `L` solo lectura.

| Accion | Admin explicito | Auxiliar | Revisor | Auditor | Sin empresa | Empresa sin funciones |
|---|---:|---:|---:|---:|---:|---:|
| Consultar contabilidad/reportes | P | P | P | L | D | P |
| Crear asiento borrador | P | P | P | D | D | D |
| Finalizar asiento | P | D | P | D | D | D |
| Anular asiento | P | D | P | D | D | D |
| Crear documento contable | P | P | P | D | D | D |
| Crear distribucion | P | P | P | D | D | D |
| Contabilizar documento | P | D | P | D | D | D |
| Configurar impuestos | P | D | D | D | D | D |
| Preparar/cerrar periodo | P | D | D | D | D | D |
| Crear movimiento operativo | P | P | P | D | D | P |
| Anular movimiento operativo | P | D | P por RLS/Finanzas | D | D | D |
| Importar movimientos | P | Segun acceso al modulo | Segun acceso al modulo | D por RLS | D | Segun acceso al modulo |
| Pagar cheque autorizado | P con `pagador_cheque` | D | D | D | D | D |

Notas:

- La creacion de movimientos operativos exige empresa asignada y no ser auditor;
  no exige una funcion contable especializada en RLS.
- Contabilidad UI solo muestra anulacion de movimientos a
  `admin/supervisor/jefe`. Finanzas tambien permite `contador_revisor` o rol
  contador.
- El pago de cheque debe probarse por UI y llamada autenticada para confirmar que
  ambas capas exigen `pagador_cheque`.

## 6. Checklist previo

| ID | Verificacion | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| PRE-01 | SQL requerido aplicado en staging | RPCs y policies versionadas disponibles | | Pendiente |
| PRE-02 | Policies de tablas objetivo revisadas | Sin policies desconocidas o abiertas | | Pendiente |
| PRE-03 | Seis usuarios pueden iniciar sesion | Perfil activo y rol esperado | | Pendiente |
| PRE-04 | Asignaciones por empresa verificadas | Coinciden con seccion 4 | | Pendiente |
| PRE-05 | Funciones operativas verificadas | Coinciden con seccion 4 | | Pendiente |
| PRE-06 | Empresa QA visible solo a asignados | Sin empresa no puede consultarla | | Pendiente |
| PRE-07 | Periodo principal abierto | Permite crear/finalizar/anular | | Pendiente |
| PRE-08 | Dos cuentas validas disponibles | Activas y permiten movimientos | | Pendiente |
| PRE-09 | Cheque autorizado preparado | Monto positivo y empresa QA | | Pendiente |

## 7. Checklist funcional positivo

| ID | Usuario | Funcion | Accion | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| POS-01 | Auxiliar | `auxiliar_contable` | Crear asiento balanceado | Se crea en `borrador`; no afecta balance formal | | Pendiente |
| POS-02 | Revisor | `contador_revisor` | Finalizar POS-01 | RPC cambia a `registrado`; aparece en balance/reportes | | Pendiente |
| POS-03 | Revisor | `contador_revisor` | Anular un asiento registrado con motivo | RPC cambia a `anulado`; conserva motivo/auditoria | | Pendiente |
| POS-04 | Auxiliar | `auxiliar_contable` | Crear documento contable GTQ 100 | Estado inicial `Pendiente` | | Pendiente |
| POS-05 | Auxiliar | `auxiliar_contable` | Adjuntar respaldo activo | Documento queda con respaldo consultable | | Pendiente |
| POS-06 | Auxiliar | `auxiliar_contable` | Crear distribucion 100/100 | Dos lineas activas y balanceadas | | Pendiente |
| POS-07 | Revisor | `contador_revisor` | Contabilizar documento | RPC cambia a `Contabilizado`; no crea asiento automatico | | Pendiente |
| POS-08 | Empresa sin funciones | Empresa asignada | Crear movimiento operativo | RLS permite movimiento `activo` con `creado_por` | | Pendiente |
| POS-09 | Revisor desde Finanzas | `contador_revisor` | Anular movimiento con motivo | Estado `anulado`; solo campos de anulacion cambian | | Pendiente |
| POS-10 | Admin explicito | Acceso Importaciones | Importar movimiento con referencia unica | Inserta `activo`, `creado_por` correcto y sin duplicado | | Pendiente |
| POS-11 | Admin explicito | `pagador_cheque` | Pagar cheque autorizado | Cheque queda `Pagado`; crea un solo movimiento egreso | | Pendiente |
| POS-12 | Admin explicito | `contabilidad_configuracion` | Crear configuracion fiscal | Registro visible en Impuestos y Contabilidad | | Pendiente |
| POS-13 | Admin explicito | `contabilidad_cierre_periodo` | Previsualizar periodo limpio | Muestra empresa, periodo, fechas, estado, conteos separados, debe, haber, diferencia, balance, bloqueos y advertencias | | Pendiente |
| POS-14 | Admin explicito | `contabilidad_cierre_periodo` | Cerrar periodo limpio | RPC cambia a `cerrado`; queda auditoria | | Pendiente |
| POS-15 | Auditor | `auditor_solo_lectura` | Consultar contabilidad y movimientos | Puede consultar empresa asignada sin controles de escritura | | Pendiente |
| POS-16 | Usuarios asignados | Segun perfil | Abrir Reportes, Dashboard y Flujo Efectivo | Solo muestran empresas asignadas y datos coherentes | | Pendiente |
| POS-17 | Auditor | `auditor_solo_lectura` | Consultar balance, diario, mayor, resultados, movimientos y cierres | Puede consultar sin escribir; solo asientos registrados en reportes formales | | Pendiente |
| POS-18 | Auditor | `auditor_solo_lectura` | Exportar CSV y abrir vistas imprimibles de reportes permitidos | Exporta exactamente datos filtrados, con encabezado, pie Control+ y sin metadatos internos | | Pendiente |

## 8. Checklist negativo de permisos y validaciones

Para cada caso, verificar primero que la UI oculte/deshabilite la accion y luego
intentar la operacion mediante una llamada autenticada sin service role.

| ID | Usuario | Accion prohibida | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| NEG-01 | Auxiliar | Finalizar asiento | UI sin boton; RPC rechaza por falta de `contador_revisor` | | Pendiente |
| NEG-02 | Auxiliar | Anular asiento | UI sin boton; RPC rechaza | | Pendiente |
| NEG-03 | Auxiliar | Contabilizar documento | UI sin accion; RPC rechaza | | Pendiente |
| NEG-04 | Revisor | Configurar impuestos | Empresa no aparece como configurable; RLS rechaza | | Pendiente |
| NEG-05 | Revisor | Cerrar periodo | UI sin accion; RPC rechaza | | Pendiente |
| NEG-06 | Auditor | Crear asiento/documento/distribucion | UI oculta y backend rechaza | | Pendiente |
| NEG-07 | Auditor | Finalizar/anular asiento | UI oculta y RPC rechaza | | Pendiente |
| NEG-08 | Auditor | Crear/anular movimiento | UI bloquea y RLS rechaza | | Pendiente |
| NEG-09 | Auditor | Importar movimiento | INSERT rechazado por RLS | | Pendiente |
| NEG-10 | Auditor | Pagar cheque | UI bloquea y RPC rechaza | | Pendiente |
| NEG-11 | Auditor | Configurar impuestos/cerrar periodo | UI oculta y backend rechaza | | Pendiente |
| NEG-12 | Sin empresa | Consultar empresa QA | SELECT no devuelve filas | | Pendiente |
| NEG-13 | Sin empresa | Ejecutar cualquier RPC con `empresa_id` QA | RPC rechaza por falta de asignacion | | Pendiente |
| NEG-14 | Empresa sin funciones | Crear asiento/documento | UI oculta y RLS/RPC rechaza | | Pendiente |
| NEG-15 | Empresa sin funciones | Configurar impuestos/cerrar periodo | UI oculta y backend rechaza | | Pendiente |
| NEG-16 | Revisor | Contabilizar documento sin respaldo | RPC rechaza | | Pendiente |
| NEG-17 | Revisor | Contabilizar documento sin distribucion balanceada | RPC rechaza | | Pendiente |
| NEG-18 | Revisor | Finalizar asiento descuadrado o con cuenta invalida | RPC rechaza | | Pendiente |
| NEG-19 | Revisor | Anular asiento con motivo menor a 5 caracteres | RPC rechaza | | Pendiente |
| NEG-20 | Usuario autorizado | Anular movimiento cambiando tambien monto/empresa | Trigger rechaza toda la actualizacion | | Pendiente |
| NEG-21 | Usuario autorizado | DELETE de movimiento/asiento/documento | Permiso/RLS rechaza | | Pendiente |
| NEG-22 | Admin cierre | Cerrar periodo con borrador pendiente | Previsualizacion y RPC bloquean | | Pendiente |
| NEG-23 | Admin cierre | Cerrar periodo con documento pendiente, observado o vencido | Previsualizacion identifica cada estado y RPC bloquea | | Pendiente |
| NEG-24 | Admin cierre | Cerrar periodo con diferencia entre debe y haber | Previsualizacion muestra descuadre y RPC bloquea | | Pendiente |
| NEG-25 | Admin cierre | Intentar cerrar periodo bloqueado o cerrado | UI no ofrece cierre y RPC rechaza por estado | | Pendiente |
| NEG-26 | Usuario sin empresa | Consultar reportes contables | No obtiene empresas, asientos, movimientos ni periodos | | Pendiente |
| NEG-27 | Usuario asignado | Consultar reportes formales con borradores/anulados existentes | Borradores y anulados no aparecen en balance, diario, mayor ni resultados | | Pendiente |
| NEG-28 | Usuario sin empresa | Intentar exportar reportes | No hay datos ni acciones efectivas de exportacion | | Pendiente |
| NEG-29 | Usuario asignado | Exportar texto iniciado con formula CSV | Celda se neutraliza y no se ejecuta como formula en Excel | | Pendiente |

## 9. Casos de coherencia e idempotencia

| ID | Caso | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| COH-01 | Repetir finalizar asiento con la misma llave | Replay controlado o rechazo de llave usada; no duplica efectos | | Pendiente |
| COH-02 | Repetir anular asiento con la misma llave | Replay controlado; una sola auditoria efectiva | | Pendiente |
| COH-03 | Repetir contabilizar documento con la misma llave | No duplica transicion ni auditoria efectiva | | Pendiente |
| COH-04 | Repetir pago de cheque con la misma llave | Un cheque pagado y un solo movimiento generado | | Pendiente |
| COH-05 | Importar dos veces la misma referencia | Segunda importacion queda excluida/rechazada | | Pendiente |
| COH-06 | Movimiento anulado en reportes | Cuenta como anulado y deja de afectar ingresos/egresos activos | | Pendiente |
| COH-07 | Asiento borrador en balance formal | No afecta balance hasta finalizar | | Pendiente |
| COH-08 | Asiento anulado en balance formal | Deja de afectar balance formal | | Pendiente |
| COH-09 | Documento contabilizado | No crea asiento automatico | | Pendiente |

## 10. Casos para confirmar riesgos conocidos

Ejecutar solo en staging y con datos desechables.

| ID | Riesgo | Prueba | Resultado seguro esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| RSK-01 | Registro directo de asiento mitigado | Como revisor, llamar `registrar_asiento_completo` con `p_tipo = registrado`, `finalizar` y `finalizado` | Rechaza con `registro_directo_no_permitido`; no crea asiento ni llave de idempotencia | | Pendiente |
| RSK-02 | Pago sin funcion especializada mitigado | Usuario asignado, admin o jefatura sin `pagador_cheque` llama directamente `pagar_cheque_transaccional` | Rechaza con `funcion_pagador_cheque_requerida`; no paga ni reserva idempotencia | | Pendiente |

Ramas sugeridas si se confirman:

- `fix/registrar-asiento-solo-borrador` (mitigado por `fix/bloquear-registro-directo-asientos`)
- `fix/pagar-cheque-exige-pagador` (mitigado por `fix/exigir-pagador-cheque-rpc`)

## 11. Verificaciones en Supabase

Ejecutar estas consultas con acceso administrativo solo para inspeccionar
resultados. Las pruebas de RLS deben realizarse con sesiones reales de usuario.

```sql
-- Asignaciones y funciones de la empresa QA.
select ue.usuario_id, ue.empresa_id, ue.activo, p.rol, p.activo as perfil_activo
from public.usuario_empresas ue
join public.perfiles p on p.id = ue.usuario_id
where ue.empresa_id = :empresa_id
order by p.rol, ue.usuario_id;

select usuario_id, empresa_id, funcion, activo
from public.usuario_funciones_operativas
where empresa_id = :empresa_id
order by usuario_id, funcion;

-- Estados creados durante la prueba.
select id, empresa_id, estado, creado_por, anulado_por, motivo_anulacion
from public.asientos_contables
where empresa_id = :empresa_id
order by creado_at desc;

select id, empresa_id, estado, creado_por, anulado_por, motivo_anulacion, referencia
from public.movimientos
where empresa_id = :empresa_id
order by fecha desc, id desc;

select id, empresa_id, estado, creado_por, revisado_por, contabilizado_por
from public.documentos_contables_revision
where empresa_id = :empresa_id
order by creado_at desc;

select documento_contable_id, cuenta_id, debito, credito, moneda, activo
from public.distribuciones_documentos_contables
where empresa_id = :empresa_id
order by creado_at desc;

-- Evidencia de auditoria e idempotencia.
select modulo, accion, entidad_tipo, entidad_id, estado_anterior, estado_nuevo, origen
from public.auditoria_eventos
where empresa_id = :empresa_id
order by creado_at desc;

select modulo, accion, estado, entidad_tipo, entidad_id, idempotency_key
from public.idempotency_keys_operativas
where empresa_id = :empresa_id
order by creado_at desc;
```

Sustituir `:empresa_id` por el ID real antes de ejecutar.

## 12. Criterio de aprobacion

La prueba integral se considera aprobada cuando:

- Todos los casos positivos obligatorios estan `Aprobado`.
- Todos los casos negativos son rechazados por backend, no solo ocultos en UI.
- No existen escrituras visibles entre empresas no asignadas.
- Auditor solo lectura no produce ninguna escritura.
- No se duplican movimientos, asientos ni efectos por reintentos.
- Balance, reportes, Dashboard y Flujo Efectivo reflejan estados correctos.
- Los riesgos `RSK-01` y `RSK-02` quedan rechazados o documentados como bugs.

## 13. Registro de hallazgos

| Severidad | Caso | Descripcion | Evidencia | Rama propuesta | Estado |
|---|---|---|---|---|---|
| Alto/Medio/Bajo | | | | | Pendiente |
