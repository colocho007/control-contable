# Auditoria visual y operativa Control+

## Objetivo

Registrar la revision previa a presentacion de las rutas operativas principales,
sus conexiones visibles, estados vacios, acciones disponibles y mensajes de
error.

La revision no modifica RLS, RPCs, datos, configuracion de usuarios ni reglas
contables.

## Resumen ejecutivo

Estado despues de la revision:

- Las 34 rutas del proyecto compilan correctamente.
- Proveedores ya no puede quedar indefinidamente en validacion si falla una
  consulta o dependencia.
- Finanzas conserva la consulta de movimientos sin la columna `categoria`.
- Dashboard, Empresas, Usuarios, Finanzas y Reportes ya no usan `alert()` del
  navegador.
- Los ultimos textos visibles detectados como `Proximamente` fueron sustituidos
  por `Fase posterior`.
- Los botones deshabilitados de acciones futuras en Activos Fijos y Flujo de
  Efectivo fueron retirados.
- Cheques y Ordenes filtran autorizadores o firmantes por funcion operativa
  explicita.
- Tareas filtra responsables por funcion contable asignada.
- Monitoreo distingue datos reales, valores pendientes y verificaciones que
  deben realizarse desde Supabase.

## Diagnostico antes y despues

| Hallazgo | Antes | Despues |
|---|---|---|
| Proveedores podia quedar en blanco o cargando | Una excepcion durante inicializacion dejaba `validandoAcceso` activo sin manejo global | Inicializacion protegida con captura, cierre de carga y mensaje controlado |
| Errores de Proveedores | Cada consulta podia mostrar el mensaje crudo de Supabase | Se registra detalle en consola y se muestra un mensaje operativo resumido |
| Proveedores sin empresa | El formulario se mostraba sin empresa operativa disponible | Se oculta el formulario y se muestra estado vacio profesional |
| Proveedores sin registros | Mensaje generico ligado a filtros | Muestra `No hay proveedores registrados para esta empresa.` cuando no hay busqueda |
| Finanzas y rutas ejecutivas | Usaban dialogos nativos `alert()` | Usan notificaciones controladas mediante `react-hot-toast` |
| Acciones futuras visibles | Activos Fijos y Flujo de Efectivo mostraban botones deshabilitados | Se reemplazaron por una explicacion breve de `Fase posterior` |
| Texto visible fuera de alcance | Persistian textos visibles equivalentes a `Proximamente` | Se sustituyeron por lenguaje de alcance operativo |
| Importaciones | Un error visible mencionaba empresas de prueba | Ahora indica `empresas no operativas` |

## Causa de la pantalla en blanco de Proveedores

La causa confirmada por revision de codigo era una inicializacion sin manejo
global de errores. Si fallaba la carga de acceso, empresas permitidas, funciones
operativas o cualquiera de las consultas auxiliares, la ejecucion podia salir
antes de desactivar `validandoAcceso`. El usuario quedaba sin una salida visual
clara.

Correcciones:

- Manejo global de errores durante inicializacion.
- Finalizacion garantizada de los estados de carga.
- Mensaje controlado cuando las consultas son incompletas.
- Estado vacio cuando no hay empresas operativas.
- Formulario oculto hasta contar con una empresa valida.

No se encontraron gradientes, blobs, fondos absolutos ni capas decorativas
superpuestas en `app/proveedores/page.tsx`. La unica posicion absoluta
corresponde al icono del campo de busqueda.

## Modulos revisados

| Modulo | Resultado de revision estatica | Validacion manual pendiente |
|---|---|---|
| Dashboard / Inicio | Tarjetas usan consultas reales y mensajes controlados | Confirmar conteos con sesion autenticada |
| Empresas | Lista y estado usan `estado`; dialogos nativos retirados | Probar empresas activas, inactivas y estado vacio |
| Admin / Usuarios | Empresas y funciones se administran desde los flujos existentes | Confirmar permisos y datos nulos con usuarios reales |
| Proveedores | Carga protegida, estado vacio y errores controlados | Confirmar esquema productivo de columnas y RLS |
| Finanzas | Consulta `movimientos` sin `categoria`; estado vacio disponible | Confirmar ausencia de HTTP 400 con Supabase productivo |
| Contabilidad | Catalogo, periodos, asientos, documentos, cierres y reportes conservados | Ejecutar prueba integral contable |
| Cheques | Autorizadores y pagadores dependen de funciones operativas | Probar creacion, autorizacion y pago |
| Ordenes de compra | Firmantes dependen de `firmante_orden` o `autorizador_compra` | Probar orden sin firmantes configurados |
| Tareas | Responsables dependen de `auxiliar_contable` o `contador_revisor` | Probar empresa sin responsables autorizados |
| Impuestos | Acciones futuras se ocultan; configuracion conserva control existente | Confirmar `contabilidad_configuracion` en Supabase |
| Conciliacion bancaria | Seccion identificada como `Fase posterior`; acciones futuras se ocultan | Confirmar que las tablas base cargan |
| Planilla | Acciones futuras se ocultan mediante el componente existente | Confirmar datos base y estados vacios |
| Proyectos | Integraciones identificadas como `Fase posterior` | Confirmar proyectos, presupuestos y movimientos |
| Reportes | Reportes y exportaciones conservados; dialogos nativos retirados | Probar filtros, CSV e impresion |
| Monitoreo | Muestra conteos reales y estados `Correcto`, `Pendiente` y `Error` | Verificar RPCs y RLS directamente en Supabase |
| Importaciones | Mensaje visible alineado con empresas no operativas | Probar archivo controlado |

## Conexiones entre modulos confirmadas en codigo

- Proveedores prepara referencias para cuentas por pagar, documentos,
  impuestos, cheques y reportes.
- Finanzas consulta y registra sobre `movimientos`.
- Contabilidad enlaza catalogo, periodos, asientos, documentos, distribuciones,
  cierres y reportes.
- Cheques crea movimientos operativos al pagar mediante el flujo existente.
- Reportes consume informacion contable formal y movimientos operativos.
- Monitoreo consulta perfiles, modulos, auditoria y conteos operativos reales.

Estas conexiones deben confirmarse con datos y sesiones autenticadas en el
entorno Supabase de presentacion.

## Admin y responsables operativos

Confirmado en codigo:

- Cheques no selecciona autorizadores o pagadores solamente por rol admin.
- Ordenes de compra no selecciona firmantes solamente por rol admin.
- Tareas no selecciona responsables solamente por rol admin.
- Cuando no hay usuarios autorizados, los formularios muestran un mensaje
  claro y mantienen el selector vacio.

Observacion de esquema:

- Las pantallas Admin y Usuarios consultan `public.perfiles`, no
  `public.usuarios`. Debe confirmarse que `perfiles` es la fuente oficial del
  proyecto antes de la presentacion. No se cambio esta conexion durante la
  auditoria.

## Modulos en fase posterior

Se mantienen identificados como fase posterior o fuera del alcance operativo
inicial:

- Automatizaciones e integraciones de Activos Fijos.
- Acciones de registro, proyeccion y conciliacion desde Flujo de Efectivo.
- Integraciones adicionales de Proyectos.
- Acciones no implementadas de Planilla, Impuestos y Conciliacion Bancaria.

Los botones de acciones no implementadas se ocultan donde ya existia el
componente `BotonProximamente`.

## Pendientes reales

- Navegar todas las rutas con una sesion autenticada y empresas asignadas.
- Confirmar que las columnas consultadas por Proveedores existen en Supabase.
- Confirmar que Finanzas no recibe HTTP 400 en el entorno conectado.
- Verificar RLS y RPCs directamente desde Supabase.
- Confirmar si `public.perfiles` es la fuente oficial de usuarios.
- Ejecutar pruebas de permisos con admin, operador, pagador, revisor y auditor.
- Revisar visualmente datos reales y estados vacios en resolucion de
  presentacion.
- Sustituir en una revision posterior los dialogos nativos que permanecen en
  rutas fuera de la navegacion principal auditada: Calendario, Documentos,
  Historial y Reinicio Controlado.

## Pruebas manuales sugeridas antes de presentacion

1. Iniciar sesion con un usuario que tenga una empresa operativa asignada.
2. Navegar `/dashboard`, `/empresas`, `/admin`, `/proveedores`, `/finanzas`,
   `/contabilidad`, `/cheques`, `/ordenes-compra`, `/tareas`, `/impuestos`,
   `/conciliacion-bancaria`, `/planilla`, `/proyectos`, `/reportes` y
   `/monitoreo-sistema`.
3. Confirmar que cada ruta carga, muestra datos reales o un estado vacio.
4. Abrir Proveedores con y sin registros; confirmar que nunca queda en blanco.
5. Abrir Finanzas y revisar la consola/red para confirmar ausencia de HTTP 400.
6. Confirmar que admin no aparece como firmante, autorizador, pagador o
   responsable sin una funcion operativa explicita.
7. Confirmar que las acciones no implementadas no muestran botones utilizables.
8. Probar reportes, exportacion CSV y vista imprimible.
9. Revisar Monitoreo y comparar sus conteos con Supabase.
10. Registrar evidencia y observaciones antes de la validacion ejecutiva.

## Validaciones tecnicas

- `npm run build`: exitoso.
- `git diff --check`: sin errores.
- RLS modificada: no.
- RPCs modificadas: no.
- Paquetes instalados: no.
- Datos eliminados: no.
- Uso nuevo de `.delete()`: no.
