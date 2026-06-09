# Auditoria operativa de Proveedores y Clientes

Fecha: 2026-06-09  
Rama: `feature/proveedores-clientes-entrega`

## Diagnostico antes

- Las tablas `proveedores` y `clientes` existen en el proyecto Supabase configurado.
- Proveedores ya mostraba un error controlado de carga y el estado vacio solicitado.
- Clientes interrumpia toda la carga si fallaba cualquiera de sus consultas auxiliares. Esto podia dejar la pantalla sin datos utiles y sin un bloque visible que explicara el problema.
- Ambas pantallas cargaban empresas permitidas, pero la lista visible mezclaba registros de todas las empresas asignadas aunque el formulario tuviera una empresa seleccionada.
- Los errores de escritura de Supabase podian mostrarse directamente al usuario.
- La inactivacion usaba `window.prompt`.
- Los textos y metadatos presentaban CxP/CxC e impuestos como preparados, aunque esa integracion no esta cerrada dentro del alcance operativo inicial.

## Columnas encontradas

La verificacion se realizo con consultas REST de solo lectura y `limit=0`, sin leer filas ni modificar datos.

### Proveedores

`id`, `empresa_id`, `empresa`, `nit`, `nombre`, `razon_social`, `nombre_comercial`,
`direccion`, `telefono`, `correo`, `contacto`, `estado`, `observaciones`,
`cuenta_por_pagar_id`, `plan_impuesto_id`, `dias_credito`, `banco`,
`cuenta_bancaria`, `tipo_cuenta`, `moneda`, `tipo_proveedor`, `saldo_pendiente`,
`created_at`, `actualizado_at`, `creado_por`, `actualizado_por`.

No existe `creado_at` en `proveedores`.

### Clientes

`id`, `empresa_id`, `nit`, `nombre`, `razon_social`, `nombre_comercial`,
`direccion`, `telefono`, `correo`, `contacto`, `estado`, `observaciones`,
`cuenta_por_cobrar_id`, `plan_impuesto_id`, `limite_credito`, `dias_credito`,
`creado_at`, `actualizado_at`, `creado_por`, `actualizado_por`.

No existe `created_at` en `clientes`.

Las consultas de las pantallas usan las variantes correctas de fecha para cada tabla.

## Cambios realizados

- Las listas de proveedores y clientes ahora muestran solo la empresa seleccionada.
- Clientes conserva los resultados disponibles si falla una consulta auxiliar y muestra un error controlado.
- Los fallos de validacion de acceso muestran un estado controlado sin autorizar la vista de datos.
- Los usuarios sin empresas asignadas reciben un estado vacio profesional.
- Los auditores de solo lectura no ven formularios ni botones de edicion.
- Se retiraron los botones de inactivacion que dependian de `window.prompt`; el estado se administra desde la edicion autorizada.
- Los errores de Supabase ya no se muestran de forma cruda.
- Los textos y metadatos identifican la relacion con CxP/CxC e impuestos como `Fase posterior`.
- Se mantuvieron las consultas restringidas a empresas permitidas.

## Operativo para entrega

- Carga por empresas permitidas y visualizacion por empresa seleccionada.
- Estados de carga, sin datos, error controlado y fase posterior.
- Creacion y edicion de datos maestros con los campos existentes en el esquema.
- Estado activo/inactivo mediante edicion.
- Bloqueo visual y logico para auditor de solo lectura.
- Sin borrado fisico y sin automatizaciones contables nuevas.

## Fase posterior

- Integracion completa y automatica con CxP, CxC e impuestos.
- Confirmacion de permisos granulares adicionales para crear o editar, aparte del auditor de solo lectura y las asignaciones de empresa actuales.
- Flujo dedicado de cambio de estado con motivo separado, si se aprueba como requisito operativo.

## Pruebas manuales sugeridas

1. Entrar a `/proveedores` y `/clientes` con un usuario con una empresa asignada y datos.
2. Cambiar la empresa seleccionada y confirmar que la lista solo muestra registros de esa empresa.
3. Probar una empresa sin registros y confirmar los mensajes exactos de estado vacio.
4. Crear y editar un registro valido en cada modulo.
5. Cambiar el estado a Inactivo desde la edicion y registrar observaciones.
6. Entrar con auditor de solo lectura y confirmar que no aparecen formularios ni botones de edicion.
7. Entrar con usuario sin empresa y confirmar que no se muestran datos empresariales.
8. Simular un fallo de consulta y confirmar que aparece un error controlado, sin pantalla en blanco ni HTTP 400 visible.

## Riesgos pendientes

- La autorizacion de escritura depende de las reglas existentes de empresa, acceso al modulo y auditor de solo lectura. No se modificaron RLS ni RPCs.
- La disponibilidad real de cuentas contables e impuestos depende de sus tablas, permisos y configuracion por empresa.
- La prueba manual autenticada con empresas con y sin datos requiere usuarios de prueba disponibles.

## Alcance respetado

- No se tocaron archivos SQL, RLS ni RPCs.
- No se instalaron paquetes.
- No se borraron datos ni se uso `.delete()`.
- No se agregaron automatizaciones contables.
- No se usa `alert()` ni se muestra `Proximamente`.
