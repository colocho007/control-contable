# PowerPoint ejecutivo Control+

## Proposito

Estructura breve para presentar Control+ ante responsables ejecutivos,
operativos y contables, solicitar la validacion ejecutiva y acordar una prueba
controlada.

### Leyenda de estado

- **Confirmado:** disponible y verificado en el repositorio.
- **Pendiente:** requiere configuracion, evidencia productiva o aprobacion.
- **Fase posterior:** no incluido en el alcance operativo inicial.

---

## Diapositiva 1

**Numero:** 1

**Titulo:** Control+

**Mensaje principal:** Plataforma interna de control administrativo, contable y
operativo, preparada para entrega operativa y validacion ejecutiva.

**Bullets:**

- Control multiempresa.
- Procesos trazables y permisos definidos.
- Estado: lista para prueba controlada.

**Nota para el presentador:** El objetivo de la reunion es aprobar una
validacion con alcance acotado, usuarios reales y evidencia documentada.

**Sugerencia visual:** Portada limpia con el nombre Control+, subtitulo y una
etiqueta visible: `Lista para validacion ejecutiva`.

---

## Diapositiva 2

**Numero:** 2

**Titulo:** El problema actual

**Mensaje principal:** La informacion dispersa y los procesos manuales reducen
la trazabilidad y aumentan el riesgo operativo.

**Bullets:**

- Informacion distribuida entre archivos, personas y herramientas.
- Seguimiento manual y responsabilidades poco visibles.
- Riesgo de duplicidad, omisiones y permisos informales.
- Reportes que requieren consolidacion manual.
- Dificultad para separar operaciones por empresa.

**Nota para el presentador:** El reto no es solo registrar informacion; es
mantener orden, evidencia y capacidad de consulta oportuna.

**Sugerencia visual:** Diagrama simple de varias fuentes dispersas que convergen
en una necesidad central de control.

---

## Diapositiva 3

**Numero:** 3

**Titulo:** Que es Control+

**Mensaje principal:** Un sistema interno multiempresa que centraliza procesos y
controla el acceso segun usuario, empresa, rol y funcion.

**Bullets:**

- Centraliza contabilidad, cheques, movimientos y documentos.
- Organiza reportes, exportaciones y auditoria.
- Separa datos y responsabilidades por empresa.
- Exige permisos explicitos para acciones sensibles.

**Nota para el presentador:** Control+ integra la operacion base sin depender de
funciones que se encuentran fuera del alcance operativo inicial.

**Sugerencia visual:** Control+ al centro, conectado con cuatro bloques:
operacion, contabilidad, reportes y auditoria.

---

## Diapositiva 4

**Numero:** 4

**Titulo:** Modulos incluidos

**Mensaje principal:** El alcance actual cubre los flujos administrativos,
contables y operativos necesarios para una prueba controlada.

**Bullets:**

- Usuarios, empresas y permisos operativos.
- Contabilidad, documentos, distribuciones y cierres.
- Cheques, pagos y movimientos operativos.
- Impuestos y configuracion controlada.
- Reportes, exportaciones, auditoria y monitoreo.

**Nota para el presentador:** Los modulos visibles como `Fase posterior` o `No
incluido en alcance operativo inicial` no deben presentarse como funciones
cerradas.

**Sugerencia visual:** Mosaico de modulos en dos grupos: `Confirmado` y `Fase
posterior`, usando colores claramente distintos.

---

## Diapositiva 5

**Numero:** 5

**Titulo:** Seguridad y control

**Mensaje principal:** Las acciones criticas dependen de permisos, empresa,
funcion operativa y estado del proceso.

**Bullets:**

- RLS y RPCs criticas preparadas para control en servidor.
- Acceso por empresa y funciones operativas explicitas.
- Auditor de solo lectura sin permisos de escritura.
- Sin borrado fisico en datos criticos.
- Acciones sensibles con historial y auditoria.

**Nota para el presentador:** La aplicacion y verificacion productiva de RLS y
RPCs en Supabase permanece **Pendiente** hasta contar con evidencia.

**Sugerencia visual:** Capas de seguridad: sesion, empresa, funcion, validacion
servidor y auditoria.

---

## Diapositiva 6

**Numero:** 6

**Titulo:** Control automatico progresivo

**Mensaje principal:** Control+ esta disenado para aumentar el control
automatico de forma progresiva, manteniendo decisiones sensibles bajo
responsabilidad humana.

**Bullets:**

- **Confirmado:** validaciones de permisos, estados, balance y bloqueos.
- **Confirmado:** registro de historial y auditoria en operaciones criticas.
- **Pendiente:** validar los controles con usuarios y datos reales.
- **Fase posterior:** automatizaciones e integraciones no incluidas inicialmente.

**Nota para el presentador:** El sistema automatiza controles verificables, no
reemplaza aprobaciones contables u operativas ni promete integraciones futuras.

**Sugerencia visual:** Escalera de tres niveles: `Control confirmado`,
`Validacion pendiente` y `Fase posterior`.

---

## Diapositiva 7

**Numero:** 7

**Titulo:** Ciclo contable controlado

**Mensaje principal:** Control+ separa preparacion, revision, registro, cierre y
consulta para conservar evidencia del ciclo completo.

**Bullets:**

- Creacion de asientos como borrador.
- Revision, finalizacion y anulacion controladas.
- Documentos y distribuciones contables.
- Cierre mensual con previsualizacion y bloqueos.
- Reportes formales basados solo en asientos registrados.

**Nota para el presentador:** Un periodo no puede cerrarse con borradores,
documentos pendientes o diferencias contables.

**Sugerencia visual:** Flujo horizontal: borrador, revision, registrado, cierre
y reportes.

---

## Diapositiva 8

**Numero:** 8

**Titulo:** Reportes y exportaciones

**Mensaje principal:** La informacion registrada puede consultarse y entregarse
con filtros consistentes para revision contable y operativa.

**Bullets:**

- Balance de comprobacion, libro diario y libro mayor.
- Estado de resultados base, movimientos y cierres.
- Filtros por empresa, periodo, fechas y moneda.
- Excel mediante CSV compatible.
- PDF mediante impresion del navegador.

**Nota para el presentador:** El balance general formal depende de la correcta
clasificacion `tipo` y `subtipo` del catalogo contable.

**Sugerencia visual:** Captura autorizada de un reporte junto a iconos discretos
de CSV e impresion.

---

## Diapositiva 9

**Numero:** 9

**Titulo:** Monitoreo operativo

**Mensaje principal:** El monitoreo presenta informacion real disponible y
distingue claramente lo correcto, pendiente o no verificable desde el cliente.

**Bullets:**

- Sesion, rol y empresas asignadas.
- Usuarios, empresas y funciones operativas activas.
- Conteos contables, documentos y movimientos.
- Estados visibles: `Correcto`, `Pendiente` y `Error`.
- RLS y RPCs requieren verificacion complementaria en Supabase.

**Nota para el presentador:** El monitoreo no presenta confirmaciones falsas; lo
que no puede verificarse desde la aplicacion se identifica expresamente.

**Sugerencia visual:** Panel tipo semaforo con tres tarjetas de estado y una
captura sin datos sensibles.

---

## Diapositiva 10

**Numero:** 10

**Titulo:** Estado actual confirmado

**Mensaje principal:** El repositorio y el paquete de entrega estan preparados
para iniciar la validacion ejecutiva y operativa.

**Bullets:**

- **Confirmado:** codigo integrado y build de produccion exitoso.
- **Confirmado:** reportes, exportaciones y documentacion de entrega.
- **Confirmado:** SQL criticos preparados y documentados.
- **Confirmado:** Finanzas y Monitoreo preparados para presentacion operativa.
- **Confirmado:** admin no se asigna por rol a acciones operativas.

**Nota para el presentador:** SQL preparado no significa SQL aplicado. La
evidencia de Supabase debe completarse antes del uso real.

**Sugerencia visual:** Dos columnas: `Confirmado en repositorio` y `Requiere
evidencia productiva`.

---

## Diapositiva 11

**Numero:** 11

**Titulo:** Pendientes para uso real

**Mensaje principal:** Los pendientes principales son de configuracion,
validacion y aprobacion, no de ampliacion funcional.

**Bullets:**

- Aplicar y verificar SQL, RPCs y RLS en Supabase.
- Configurar usuarios, empresas y funciones despues de la aprobacion.
- Validar el catalogo contable, especialmente `tipo` y `subtipo`.
- Ejecutar la prueba integral con usuarios reales.
- Obtener aprobacion contable y operativa.

**Nota para el presentador:** Tambien se requiere backup previo, evidencia de
resultados y cierre formal de actas.

**Sugerencia visual:** Checklist ejecutivo con todos los elementos marcados como
`Pendiente`.

---

## Diapositiva 12

**Numero:** 12

**Titulo:** Prueba controlada propuesta

**Mensaje principal:** Validar el sistema con alcance acotado permite obtener
evidencia real antes de ampliar su uso.

**Bullets:**

- Seleccionar entre una y tres empresas iniciales.
- Configurar usuarios reales y funciones aprobadas.
- Cargar catalogo, periodo y datos minimos controlados.
- Ejecutar ciclos contables, pagos, reportes y exportaciones.
- Registrar resultados, observaciones y aprobaciones.

**Nota para el presentador:** La prueba debe incluir casos permitidos y
bloqueados para confirmar permisos, controles y trazabilidad.

**Sugerencia visual:** Linea de tiempo breve: preparar, ejecutar, revisar,
corregir bloqueantes y aprobar.

---

## Diapositiva 13

**Numero:** 13

**Titulo:** Beneficios esperados

**Mensaje principal:** Control+ convierte procesos dispersos en flujos
controlados, consultables y auditables.

**Bullets:**

- Mayor trazabilidad de acciones y responsables.
- Informacion organizada y separada por empresa.
- Permisos claros y mejor separacion de responsabilidades.
- Menor dependencia de hojas de calculo para consolidacion.
- Base preparada para crecimiento controlado.

**Nota para el presentador:** Los beneficios se confirmaran durante la prueba
controlada mediante evidencia operativa y contable.

**Sugerencia visual:** Comparacion simple `Antes` y `Con Control+`, sin cifras no
validadas.

---

## Diapositiva 14

**Numero:** 14

**Titulo:** Decision requerida

**Mensaje principal:** Se solicita aprobar la prueba controlada y definir las
condiciones necesarias para ejecutarla.

**Bullets:**

- Aprobar el inicio de la prueba controlada.
- Definir empresas iniciales y responsables.
- Autorizar la configuracion posterior de usuarios y permisos finales.
- Designar responsables contable, operativo y tecnico.
- Definir fecha, alcance y criterio de exito.

**Nota para el presentador:** La decision propuesta no autoriza un uso ampliado;
autoriza una validacion controlada con evidencia y aprobaciones.

**Sugerencia visual:** Tarjeta final con la decision solicitada, responsables y
fecha objetivo.

---

## Recomendaciones visuales generales

- Usar formato panoramico 16:9 y una idea principal por diapositiva.
- Aplicar una leyenda constante: verde para `Confirmado`, ambar para
  `Pendiente` y gris para `Fase posterior`.
- Usar como maximo una captura real por diapositiva y ocultar datos sensibles.
- Evitar tablas extensas; trasladar el detalle a las notas del presentador.
- Mantener tipografia, iconos y colores consistentes con Control+.

## Pendientes antes de la reunion

- Confirmar audiencia, decision esperada y duracion disponible.
- Seleccionar capturas autorizadas y revisar que no contengan datos sensibles.
- Confirmar el estado real de SQL, RLS y RPCs antes de presentar la diapositiva
  10.
- Definir las empresas y responsables propuestos para la prueba controlada.
- Preparar respuesta contable sobre la clasificacion `tipo`/`subtipo` del
  catalogo.
