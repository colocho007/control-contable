# Manual administrativo Control+

## 1. Objetivo

Este manual describe la preparacion y mantenimiento de usuarios para la entrega
operativa de Control+. Los permisos efectivos resultan de cuatro elementos:

1. Perfil activo y rol.
2. Empresa asignada activamente.
3. Modulo habilitado.
4. Funcion operativa activa para esa empresa.

Una funcion operativa no sustituye la empresa ni el modulo. Un rol amplio no
debe usarse como sustituto de funciones explicitas en operaciones sensibles.

## 2. Gestion de usuarios

1. Abra Administracion con un usuario autorizado.
2. Seleccione o cree el perfil.
3. Asigne un rol acorde a sus responsabilidades generales.
4. Active solamente las empresas necesarias.
5. Active solamente los modulos necesarios.
6. Asigne funciones operativas por empresa.
7. Guarde y revise el resultado y la auditoria.

Desactive el perfil cuando la persona ya no deba ingresar. Evite compartir
usuarios entre personas.

## 3. Roles

Los roles disponibles incluyen `admin`, `jefe`, `supervisor`, `contador`,
`tesorero`, `firmante`, `firmante_oc`, `iniciador`, `iniciador_gestion` y
`empleado`.

El rol describe una responsabilidad general. Para contabilidad formal, cierre,
configuracion y pago de cheques deben asignarse las funciones operativas
correspondientes. No asuma que `admin`, `jefe` o `supervisor` pueden ejecutar una
accion sensible sin su funcion explicita.

## 4. Empresas asignadas

- Asigne solo empresas que el usuario necesita operar o consultar.
- Las funciones se asignan por empresa, no de manera global.
- Retirar una empresa debe retirar tambien el acceso operativo a sus datos.
- Revise asignaciones inactivas y duplicadas antes de entregar usuarios.
- Pruebe cada usuario con una sesion real, sin service role.

## 5. Funciones operativas contables y de pago

### `auxiliar_contable`

Puede preparar trabajo contable: crear asientos borrador, registrar documentos y
guardar distribuciones. No finaliza ni anula asientos y no cierra periodos.

### `contador_revisor`

Puede revisar, finalizar y anular asientos mediante los flujos seguros. Tambien
puede revisar y contabilizar documentos cuando cumplen validaciones. No
administra catalogo, configuracion o cierres sin las funciones especializadas.

### `auditor_solo_lectura`

Permite consulta de la empresa asignada sin escritura. Puede revisar reportes y
exportaciones permitidas. No crea, modifica, finaliza, anula, paga ni cierra.

No puede combinarse con funciones operativas de escritura en la misma empresa.

### `contabilidad_catalogo_admin`

Permite administrar el catalogo de cuentas contables. No concede por si sola
permiso para crear, finalizar o anular asientos.

### `contabilidad_configuracion`

Permite administrar configuracion contable y fiscal de la empresa. No concede
por si sola cierre de periodos ni revision de asientos.

### `contabilidad_cierre_periodo`

Permite preparar periodos, previsualizar bloqueos y cerrar periodos validos. No
permite saltar bloqueos ni cerrar por actualizacion directa.

### `pagador_cheque`

Permite pagar cheques autorizados para la empresa. No concede autorizacion de
cheques ni reemplaza las validaciones de fondo, moneda y estado.

### Funciones relacionadas

Control+ tambien incluye funciones operativas para cheques y ordenes, como
`firmante_cheque`, `autorizador_cheque`, `revisor_cheque`, `creador_orden`,
`firmante_orden` y `autorizador_compra`. Asignelas solo cuando el proceso real
del usuario lo requiera.

## 6. Buenas practicas de asignacion

- Aplique minimo privilegio: solo empresa, modulo y funcion necesarios.
- Separe preparacion, revision, cierre y pago cuando el equipo lo permita.
- Asigne funciones por responsabilidad real, no por conveniencia temporal.
- Revise permisos al cambiar puestos, empresas o responsabilidades.
- Use usuarios individuales y mantenga perfiles inactivos fuera de operacion.
- Documente quien aprobo cada cambio de permisos.
- Valide en la aplicacion y mediante una operacion negativa controlada.

## 7. Combinaciones a evitar

- Nunca combine `auditor_solo_lectura` con funciones de escritura en la misma empresa.
- Evite que una sola persona prepare, revise, cierre y pague salvo aprobacion formal.
- No asigne `pagador_cheque` a quien solo autoriza.
- No asigne `contabilidad_cierre_periodo` a quien solo prepara borradores.
- No use `contabilidad_catalogo_admin` para compensar falta de permisos contables.
- No asigne todas las empresas ni todos los modulos como configuracion predeterminada.

## 8. Preparar usuarios tipo

### Auditor

1. Active el perfil.
2. Asigne exclusivamente las empresas que auditara.
3. Habilite los modulos de consulta requeridos.
4. Asigne `auditor_solo_lectura` en cada empresa.
5. No asigne ninguna funcion operativa de escritura en esas empresas.
6. Pruebe consulta y exportacion.
7. Pruebe que crear, modificar, anular, pagar y cerrar sean rechazados.

### Contador preparador

1. Asigne las empresas y el modulo Contabilidad.
2. Asigne `auxiliar_contable`.
3. Agregue `contabilidad_catalogo_admin` o `contabilidad_configuracion` solo si
   tambien es responsable de esas tareas.
4. Pruebe que crea borradores y distribuciones.
5. Pruebe que no finaliza, anula ni cierra sin funciones adicionales.

### Contador revisor

1. Asigne las empresas y el modulo Contabilidad.
2. Asigne `contador_revisor`.
3. Agregue `contabilidad_cierre_periodo` solo si debe ejecutar cierres.
4. Agregue funciones de catalogo o configuracion solo si corresponden.
5. Pruebe finalizacion y anulacion mediante RPC.
6. Pruebe que no administra areas sin funcion especializada.

### Pagador de cheque

1. Asigne la empresa y el modulo Cheques.
2. Asigne `pagador_cheque`.
3. No dependa del rol administrativo para habilitar el pago.
4. Pruebe un cheque autorizado.
5. Confirme que se genera el movimiento operativo.
6. Pruebe que un cheque no autorizado sea rechazado.

## 9. Revision de auditoria

Use Historial para revisar eventos por empresa, modulo, accion y fecha. Use
Monitoreo del Sistema cuando corresponda revisar fallas, eventos sensibles o
resultados parciales.

Revise especialmente:

- Cambios de perfil, empresa, modulo y funcion.
- Creacion, finalizacion y anulacion de asientos.
- Contabilizacion documental.
- Cierres de periodo.
- Pagos y anulaciones.
- Exportaciones de reportes.
- Intentos bloqueados.

La auditoria ayuda a investigar, pero no sustituye aprobaciones, respaldos ni
revision periodica de permisos.

## 10. Revision periodica recomendada

- Semanal: usuarios inactivos, intentos bloqueados y operaciones sensibles.
- Mensual: asignaciones por empresa, funciones contables, cierres y pagadores.
- Antes de cada cierre: responsables, periodo abierto y bloqueos.
- Antes de entrega o cambio mayor: ejecutar la prueba integral documentada.
