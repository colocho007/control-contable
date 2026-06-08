# Preparacion de datos para presentacion operativa Control+

## Objetivo

Preparar un entorno visualmente limpio para una presentacion operativa sin
eliminar informacion critica, romper trazabilidad ni confundir esta limpieza con
un procedimiento de produccion.

Este documento no autoriza borrados automaticos. Cualquier limpieza debe
revisarse, respaldarse y ejecutarse manualmente por un responsable autorizado.

## Regla principal

Antes de modificar datos:

1. Confirmar el proyecto Supabase y la empresa objetivo.
2. Crear un backup verificable.
3. Identificar relaciones, auditoria y documentos asociados.
4. Preferir inactivar, archivar, cancelar o anular de forma logica.
5. Registrar responsable, fecha, motivo y evidencia.

## Datos que pueden prepararse de forma controlada

Solamente sobre empresas reservadas para presentacion y despues de revisar sus
dependencias:

- Borradores de trabajo sin valor operativo, usando sus estados disponibles.
- Tareas no requeridas, mediante cancelacion logica.
- Movimientos creados exclusivamente para preparacion, mediante anulacion logica.
- Cheques no pagados que puedan anularse mediante el flujo autorizado.
- Asientos borrador que no deban conservarse, usando el flujo permitido de
  anulacion cuando aplique.
- Documentos pendientes sin valor operativo, usando estados de rechazo,
  observacion o archivo disponibles.
- Alertas temporales del monitoreo, utilizando sus estados de revision,
  resolucion o archivo.

La limpieza debe conservar los registros necesarios para explicar trazabilidad,
reportes, permisos y auditoria durante la presentacion.

## Datos que no deben borrarse

- Usuarios de Supabase Auth y perfiles productivos.
- Asignaciones usuario-empresa y funciones aprobadas.
- Empresas productivas.
- Catalogo contable aprobado.
- Periodos contables cerrados.
- Asientos registrados o anulados.
- Movimientos operativos vinculados con pagos reales.
- Cheques pagados.
- Auditoria, historial, logs y evidencias documentales.
- Configuracion fiscal o contable productiva.
- Fondos, chequeras y saldos productivos.
- Policies, triggers, RPCs, tablas o configuracion de seguridad.

## Orden recomendado

1. Crear y comprobar backup.
2. Seleccionar una empresa exclusiva o autorizada para presentacion.
3. Confirmar que no contiene operaciones productivas.
4. Revisar usuarios y funciones que participaran.
5. Revisar catalogo, periodo abierto, fondos y chequeras.
6. Identificar registros que deben conservarse para mostrar el flujo.
7. Marcar como cancelados, archivados o anulados los registros no requeridos.
8. Revisar reportes, dashboard, flujo efectivo y auditoria.
9. Ejecutar la prueba minima de presentacion.
10. Registrar los cambios realizados y completar el checklist.

## Diferencia entre presentacion y produccion real

### Preparacion para presentacion

- Usa alcance reducido y datos autorizados.
- Busca claridad visual sin ocultar errores reales.
- Puede conservar pocos registros representativos.
- Debe mantener auditoria y trazabilidad.
- No valida por si sola la salida productiva.

### Produccion real

- Requiere usuarios, empresas y funciones aprobadas.
- Requiere SQL critico aplicado y verificado.
- Requiere backup, prueba integral y aprobacion contable.
- No debe limpiarse para mejorar una presentacion.
- Debe conservar historial y evidencia conforme a las reglas operativas.

## SQL propuesto

No se incluye SQL de borrado. Si se requiere una correccion masiva, debe
prepararse en una rama y documento separados, limitarse a una empresa
explicitamente autorizada, usar transaccion, incluir verificaciones previas y
posteriores, y quedar sujeto a revision antes de ejecutarse.

## Checklist previo a presentacion

- [ ] Backup creado y verificable.
- [ ] Empresa de presentacion confirmada.
- [ ] No existen operaciones productivas dentro del alcance seleccionado.
- [ ] Usuarios y funciones revisados.
- [ ] Admin no aparece como responsable operativo por defecto.
- [ ] Registros representativos revisados.
- [ ] Reportes y exportaciones revisados.
- [ ] Monitoreo muestra datos reales o estados pendientes claros.
- [ ] No se ejecutaron borrados fisicos.
- [ ] Cambios y observaciones quedaron documentados.
