# Manual de usuario Control+

## 1. Objetivo

Este manual explica el uso operativo basico de Control+. Las opciones visibles
dependen del usuario, las empresas asignadas, los modulos habilitados y las
funciones operativas activas para cada empresa.

Si una opcion no aparece, confirme sus permisos con el administrador. No intente
resolverlo usando otra empresa o la cuenta de otra persona.

## 2. Inicio de sesion y empresa

1. Abra Control+ e ingrese con su usuario autorizado.
2. Si el sistema informa que el usuario esta inactivo, contacte al administrador.
3. Seleccione la empresa sobre la que trabajara.
4. Confirme siempre la empresa antes de crear, revisar, pagar, cerrar o exportar.

Un usuario solo debe ver datos de empresas que tenga asignadas activamente. Si
aparece una empresa incorrecta, detenga la operacion y reporte el caso.

## 3. Uso basico de los modulos

- Use los filtros de empresa, fecha, periodo, moneda y estado antes de consultar.
- Revise mensajes de confirmacion y bloqueos antes de repetir una accion.
- No cierre la pagina durante una operacion critica.
- No repita rapidamente una accion de pago, cierre, finalizacion o anulacion.
- Registre motivos claros cuando el sistema los solicite.
- Recargue el listado despues de una operacion si el cambio no aparece de inmediato.

## 4. Contabilidad

### Crear un asiento borrador

Requiere una funcion contable de preparacion, como `auxiliar_contable` o
`contador_revisor`, para la empresa seleccionada.

1. Abra Contabilidad y seleccione Crear asiento.
2. Seleccione empresa, periodo abierto, fecha y moneda.
3. Ingrese una descripcion clara.
4. Agregue al menos dos lineas con cuentas que permitan movimientos.
5. Confirme que debe y haber cuadren.
6. Guarde el asiento.

El asiento se crea como borrador. Crear un asiento no lo registra ni lo finaliza.

### Finalizar un asiento

Requiere `contador_revisor`.

1. Localice un asiento preparado y balanceado.
2. Revise encabezado, periodo, moneda, cuentas y detalle.
3. Use Finalizar.
4. Confirme la operacion.

La finalizacion cambia un asiento existente a estado registrado mediante el flujo
seguro del sistema. Los asientos borrador no aparecen en reportes formales.

### Anular un asiento

Requiere `contador_revisor`.

1. Localice el asiento que debe anularse.
2. Use Anular.
3. Escriba un motivo suficiente y confirme.

La anulacion es logica y queda auditada. No borra el asiento. Un asiento anulado
no debe mostrarse como registrado en reportes formales.

### Documentos contables

1. Abra la seccion de documentos para revision.
2. Registre proveedor o cliente, tipo, numero, fechas, moneda y montos.
3. Adjunte o confirme el respaldo documental requerido.
4. Guarde el documento para revision.

Un documento no puede marcarse como contabilizado si no cumple las validaciones
de respaldo y distribucion. La contabilizacion documental no crea
automaticamente un asiento contable.

### Distribuciones

Requiere una funcion contable de preparacion.

1. Abra el documento.
2. Seleccione Distribucion contable.
3. Ingrese cuentas, debe, haber y moneda.
4. Confirme que la distribucion este balanceada.
5. Guarde indicando el motivo o referencia solicitado.

### Cierres mensuales

Requiere `contabilidad_cierre_periodo`.

1. Seleccione la empresa y un periodo abierto.
2. Abra la previsualizacion de cierre.
3. Revise asientos borrador, asientos en revision, documentos pendientes,
   observados o vencidos, balance y advertencias.
4. Resuelva todos los bloqueos.
5. Cierre el periodo e ingrese observaciones cuando correspondan.

El cierre no se permite por actualizacion directa. Se registra quien cerro el
periodo, la fecha y la auditoria correspondiente.

### Reportes contables

Los reportes formales usan solamente asientos registrados. Estan disponibles:

- Balance de comprobacion.
- Libro diario.
- Libro mayor.
- Estado de resultados base.
- Resumen de movimientos operativos.
- Cierres y periodos contables.

Use siempre los filtros de empresa, periodo, fecha y moneda antes de interpretar
o exportar resultados.

### Exportaciones

- Excel se entrega como archivo CSV compatible con Excel.
- Los CSV incluyen codificacion UTF-8 y respetan los filtros cargados.
- Las vistas imprimibles permiten imprimir o guardar como PDF desde el navegador.
- Revise empresa, periodo, moneda y fechas en el encabezado antes de distribuir.

## 5. Cheques

### Crear un cheque

1. Seleccione empresa, fondo, moneda y forma de pago.
2. Ingrese beneficiario, concepto, monto y fecha.
3. Si corresponde, seleccione chequera y numero fisico disponible.
4. Guarde y envie a autorizacion.

El fondo y la chequera deben estar activos y usar una moneda compatible.

### Autorizar un cheque

La opcion depende de las funciones y reglas operativas de autorizacion asignadas.

1. Revise beneficiario, concepto, monto, fondo y respaldo.
2. Autorice solamente cheques pendientes de autorizacion.
3. Confirme que el cheque pase a Autorizado y que los fondos queden comprometidos.

### Pagar un cheque

Requiere `pagador_cheque` activo para la empresa. Ser administrador, jefe o
supervisor no sustituye esta funcion.

1. Seleccione un cheque Autorizado.
2. Revise fondo, moneda y monto.
3. Use Pagar y confirme.
4. Confirme el estado Pagado y el movimiento operativo generado.

El movimiento generado debe conservar empresa, moneda, monto, estado activo y
el usuario que ejecuto el pago.

### Anular un cheque

La opcion solo aparece cuando el estado y los permisos lo permiten. Ingrese un
motivo claro. Un cheque pagado no se anula desde el flujo normal de anulacion.

## 6. Movimientos operativos

Los movimientos representan ingresos o egresos operativos.

- Seleccione siempre la empresa correcta.
- Registre tipo, descripcion, fecha, moneda y monto.
- Un auditor de solo lectura no puede crear ni anular movimientos.
- La anulacion es logica, requiere motivo y no borra el registro.
- Los movimientos anulados deben mantenerse para trazabilidad.

## 7. Impuestos y configuracion

La consulta depende de la empresa asignada. Modificar configuracion fiscal o
contable requiere `contabilidad_configuracion`.

Antes de guardar:

1. Confirme empresa y vigencia.
2. Revise nombre, porcentaje, moneda y valores aplicables.
3. Evite duplicar configuraciones.
4. Verifique el resultado despues de guardar.

Control+ no automatiza tramites SAT desde este flujo.

## 8. Reportes y exportaciones

1. Abra Reportes.
2. Seleccione empresa, periodo, rango de fechas y moneda.
3. Aplique los filtros.
4. Revise que la pantalla muestre el alcance esperado.
5. Exporte el reporte individual o abra su vista imprimible.

Un auditor de solo lectura puede consultar y exportar reportes de sus empresas,
pero no puede modificar datos.

El balance general formal y la clasificacion del estado de resultados dependen de
que el catalogo de cuentas tenga `tipo` y `subtipo` suficientes. El sistema no
debe inventar clasificaciones faltantes.

## 9. Errores comunes

| Mensaje o situacion | Que hacer |
|---|---|
| No aparece una empresa | Solicite al administrador revisar la asignacion activa. |
| No aparece un boton sensible | Confirme la funcion operativa para esa empresa. |
| Usuario inactivo | Contacte al administrador; no use otra cuenta. |
| Periodo cerrado o bloqueado | Seleccione un periodo abierto o solicite revision. |
| Asiento descuadrado | Corrija debe y haber antes de finalizar. |
| Documento no contabiliza | Revise adjunto, distribucion, balance y estado. |
| Periodo no cierra | Abra la previsualizacion y resuelva todos los bloqueos. |
| Cheque no paga | Confirme estado Autorizado, fondo, moneda y `pagador_cheque`. |
| Exportacion vacia | Aplique filtros validos y confirme que existen datos permitidos. |
| Vista imprimible no abre | Permita ventanas emergentes para Control+ y vuelva a intentar. |

Cuando reporte un incidente, incluya usuario, empresa, modulo, fecha, accion,
mensaje recibido e identificador del registro. No comparta contrasenas.
