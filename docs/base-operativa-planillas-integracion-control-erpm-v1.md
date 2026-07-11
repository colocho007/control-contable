# Base operativa de planillas e integración — Control ERPM v1

Fecha de revisión: 2026-07-11  
Rama: `erpm/base-operativa-planillas-integracion-v1`  
Alcance: auditoría estática del repositorio y diseño técnico ejecutable. No incluye inspección de datos ni del esquema remoto de Supabase.

## 1. Resumen ejecutivo

Control ERPM tiene una base reutilizable y no necesita reconstruirse desde cero. Ya existen autenticación con Supabase, protección de rutas, asignación multiempresa, módulos operativos con persistencia, auditoría, idempotencia en operaciones seleccionadas, documentos privados, contabilidad formal, CxP/CxC, cheques, conciliación y una primera base de planilla.

La plataforma todavía no constituye un circuito productivo completo de nómina. El módulo Planilla guarda maestro mínimo de empleados, períodos, tasas y préstamos/descuentos, pero no opera `planilla_detalle`, no calcula nómina, no implementa novedades mensuales, prestaciones, aprobación multinivel, archivo bancario, confirmación de pago, conciliación, contabilización ni acumulados anuales. `/empleados` redirige a `/usuarios`, por lo que hoy no existe un Maestro de Empleados autónomo y coherente.

La primera implementación debe consolidar el Maestro de Empleados y el motor transaccional de movimientos/planilla antes de automatizar pagos o formatos oficiales. Todo resultado automático debe permanecer como borrador revisable. Ningún pago, presentación a una institución o asiento definitivo debe ejecutarse sin aprobación humana.

Limitación probatoria: los archivos `sql/*.sql` muestran diseño previsto, no prueban que tablas, constraints, funciones o policies estén desplegados. Antes de producción debe compararse el esquema remoto, sus grants y sus policies con el repositorio mediante una revisión autorizada.

## 2. Estado real de cada módulo

| Módulo | Estado observable | Persistencia y conexión | Riesgos / faltantes principales |
|---|---|---|---|
| Empresas | Funcional | CRUD sobre `empresas`; desactivación; revisión de dependencias; RPC de eliminación segura | Eliminación física es sensible; depende de RPC/RLS desplegados; consultas de dependencias desde cliente |
| Usuarios | Parcialmente funcional | Lee/desactiva `perfiles`; alta mediante API administrativa | La creación requiere UID ya existente en Auth; asignación de empresas/módulos no forma una transacción única |
| Roles y permisos | Parcial | `perfiles.rol`, `usuario_empresas`, `usuario_modulos`, `usuario_funciones_operativas`; controles UI y RLS propuesto | Nombres de roles y funciones se mezclan; varios controles se hacen en cliente; debe probarse autorización negativa real |
| Empleados | No funcional como módulo propio | `/empleados` redirige a `/usuarios` | Confunde empleado con usuario del sistema; no hay ficha integral, versionado ni privacidad por campo |
| Planilla | Base operativa parcial | CRUD de inserción para `empleados_planilla`, `planillas_periodos`, tasas y préstamos/descuentos | Sin edición visible, cálculo, detalle, estados productivos, prestaciones, pagos ni contabilidad; carga listas completas |
| Documentos | Funcional parcial | `documentos_tramites` y Storage mediante `lib/documentosTramites.ts`; consulta, carga, descarga, estados y exportación | No está tipificado específicamente para expediente laboral; debe verificarse bucket privado y RLS remoto |
| Proveedores | Funcional parcial | CRUD, relación por `empresa_id`, consulta CxP y configuración contable/impuestos | La integración es informativa/preparatoria; no completa pago→notificación→conciliación→asiento |
| Clientes | Funcional parcial | CRUD, relación por `empresa_id`, consulta CxC y configuración contable/impuestos | Falta circuito cerrado de aplicación de cobro conciliado e idempotencia transversal |
| Cuentas por pagar | Funcional parcial | Obligaciones y pagos; RPC de registro/anulación; documentos de respaldo | “Preparado para transferencias” no equivale a transferencia; sin archivo bancario versionado ni confirmación bancaria formal |
| Cuentas por cobrar | Funcional parcial | Obligaciones y pagos; RPC de registro/anulación; documentos de respaldo | No existe aplicación automática desde conciliación ni regla única contra doble aplicación extremo a extremo |
| Cheques | Funcional avanzado | Fondos, chequeras, cheques físicos, historial, funciones operativas, RPC, idempotencia y contabilización al marcar pagado | Acción “pagado” depende de confirmación humana y RPC; debe probarse atomicidad, doble clic y reversión |
| Bancos | Parcial, distribuido | Cuentas bancarias de conciliación, fondos y chequeras | No existe maestro bancario/beneficiarios central ni validación de cuenta del empleado/proveedor |
| Conciliación bancaria | Base funcional parcial | Cuentas, estados, movimientos, vínculos y ajustes | Entrada principalmente manual; no se observa importador bancario con hash, motor de coincidencia, cierre/reapertura ni aplicación CxP/CxC |
| Contabilidad | Funcional avanzado pero desacoplado | Catálogo, períodos, documentos en revisión, distribuciones, asientos, detalle, cierre, anulación y finalización mediante RPC | Planilla/conciliación no generan borradores contables conectados; coexistencia de `movimientos` y contabilidad formal exige límites claros |
| Reportes | Funcional para fuentes actuales | Reportes financieros, CxP/CxC, cheques, órdenes, tareas, estados contables y exportación | No existe Informe del Empleador ni reportes de nómina/acumulados; varias consultas pueden cargar conjuntos amplios |
| Historial | Funcional parcial | Lee `auditoria_eventos`, filtra y exporta con límites | Auditoría en varias pantallas es “best effort”; una operación puede persistir aunque falle su auditoría |
| Monitoreo | Funcional parcial | Consulta perfiles, módulos, auditoría, logs, borradores, contabilidad y alertas | Parte del estado de alertas usa `localStorage`; no sustituye observabilidad de servidor ni alertamiento externo |
| Dashboard | Funcional de lectura | Agrega tareas, movimientos, órdenes y cheques | No incluye métricas reales de planilla ni estados del circuito laboral |
| API administrativas | Funcional y endurecida en un caso | `POST /api/admin/perfiles` valida sesión, rol, Auth, rate limit e idempotencia | Es la única API de dominio observada; gran parte de la mutación ocurre directamente desde el navegador |
| Proxy / rutas | Funcional para autenticación | Verifica usuario Supabase y protege rutas declaradas | Solo autentica; no autoriza módulo, rol o empresa. La seguridad final depende de API/RPC/RLS |

Clasificación transversal: no se detectaron transferencias bancarias reales ni envíos automáticos a IGSS/MINTRAB. Los botones de fases posteriores en Planilla son deliberadamente no operativos. El riesgo de duplicidad es alto donde no hay constraint único/idempotencia de dominio; bajo solo donde la operación usa llave persistente y constraint remoto verificado.

## 3. Archivos revisados

- Rutas: `app/empleados/page.tsx`, `app/planilla/page.tsx`, `app/empresas/page.tsx`, `app/usuarios/page.tsx`, `app/documentos/page.tsx`, `app/proveedores/page.tsx`, `app/clientes/page.tsx`, `app/cuentas-pagar/page.tsx`, `app/cuentas-cobrar/page.tsx`, `app/cheques/page.tsx`, `app/conciliacion-bancaria/page.tsx`, `app/contabilidad/page.tsx`, `app/reportes/page.tsx`, `app/historial/page.tsx`, `app/monitoreo-sistema/page.tsx`, `app/dashboard/page.tsx`, `app/importaciones/page.tsx`, `app/api/admin/perfiles/route.ts`.
- Seguridad y acceso: `proxy.ts`, `lib/auth.ts`, `lib/validarUsuarioActivo.ts`, `lib/validarModuloActivo.ts`, `lib/validarAccesoModuloUsuario.ts`, `lib/permisosEmpresas.ts`, `lib/funcionesOperativas.ts`, `lib/rateLimitOperativo.ts`, `lib/auditoria.ts`.
- Dominio: `lib/documentosTramites.ts`, `lib/contabilidadV2.ts`, `lib/reportesFinancieros.ts`, `lib/estadosFinancieros.ts`, `lib/empresasOperativas.ts`, `lib/exportaciones.ts`.
- SQL leído como diseño versionado: planilla, conciliación, contabilidad formal, pagos CxP/CxC, cheques, seguridad operativa, auditoría, rate limiting y módulos contables bajo `sql/`.

No se consultó `.env.local`, no se inspeccionó el proyecto remoto de Supabase y no se ejecutó SQL.

## 4. Tablas y relaciones detectadas desde el código

### Núcleo organizacional

- `perfiles(id)` representa usuarios autenticados y su rol; el ID coincide con Auth.
- `usuario_empresas(usuario_id, empresa_id)` delimita empresas asignadas.
- `modulos_sistema` y `usuario_modulos` controlan visibilidad/acceso por módulo.
- `usuario_funciones_operativas` agrega capacidades por empresa (por ejemplo, auxiliar contable, contador revisor o funciones de cheques).
- `auditoria_eventos`, `intentos_bloqueados`, `idempotency_keys_operativas`, `rate_limits_operativos` soportan trazabilidad y controles.

### Planilla

- `empleados_planilla.empresa_id → empresas.id`.
- `planillas_periodos.empresa_id → empresas.id`.
- `planilla_detalle(periodo_id, empleado_id, empresa_id)` está definido en SQL, pero no usado por la pantalla actual.
- `planilla_configuracion_tasas.empresa_id → empresas.id`.
- `planilla_prestamos_descuentos(empleado_id, empresa_id) → empleados_planilla(id, empresa_id)` está reforzado en SQL separado.
- Índices únicos propuestos: código y DPI por empresa; período por empresa/año/mes/tipo/moneda; detalle por período/empleado.

### Operación financiera

- `proveedores.empresa_id → empresas.id`; `cuentas_por_pagar.proveedor_id` debe ser la relación formal, no nombre libre.
- `clientes.empresa_id → empresas.id`; `cuentas_por_cobrar.cliente_id` debe ser la relación formal.
- `pagos_cuentas_por_pagar` y `pagos_cuentas_por_cobrar` registran aplicaciones.
- `documentos_contables_revision` sirve como fuente/documento contable preparatorio.
- `cheques`, `chequeras`, `cheques_fisicos`, `fondos_empresa`, `cheques_historial` forman el subsistema de cheque.
- `conciliacion_cuentas_bancarias → conciliacion_estados_cuenta → conciliacion_movimientos_banco`; `conciliacion_vinculos` enlaza movimientos y fuentes; `conciliacion_ajustes` conserva diferencias.
- `catalogo_cuentas`, `periodos_contables`, `asientos_contables`, `movimientos_contables_detalle`, `documentos_contables_revision` y `distribuciones_documentos_contables` forman contabilidad formal.

### Riesgo semántico

`movimientos` es una tabla operativa genérica usada por finanzas, dashboard, tareas, importaciones y contabilidad heredada. No debe reutilizarse sin más como “movimiento mensual de nómina”: carece del contrato laboral, período, tipo parametrizado, cantidad, aprobaciones y relación única necesarios. Debe conservarse como dominio separado o migrarse explícitamente.

## 5. Funciones que sí operan

- Inicio/cierre de sesión y verificación de usuario activo.
- Protección por autenticación de rutas enumeradas en `proxy.ts`.
- Consulta de módulo, empresas permitidas/operativas y funciones operativas.
- Alta de perfil existente en Auth mediante API con rol asignable restringido, rate limit, idempotencia y auditoría.
- CRUD operativo de empresas, clientes, proveedores y obligaciones, sujeto a RLS remoto.
- Registro de pagos CxP/CxC mediante RPC y anulación controlada, sujeto a despliegue de dichas funciones.
- Gestión de cheques con historial, funciones segregadas e idempotencia en operaciones clave.
- Gestión manual de cuentas/estados/movimientos/vínculos/ajustes de conciliación.
- Catálogo y períodos contables, documentos en revisión, borradores de asiento balanceados, finalización, anulación y cierre mediante RPC.
- Carga y consulta de documentos de trámite en Storage, con descarga controlada por la librería.
- Reportes, historial y exportaciones con límites operativos y auditoría.
- En Planilla: alta y lectura de empleados mínimos, períodos, tasas y préstamos/descuentos.

## 6. Funciones parciales

- Multiempresa: el cliente filtra por IDs asignados y existen RLS propuestas, pero falta verificación remota y pruebas negativas.
- Aprobaciones: hay funciones/roles y flujos en cheques/contabilidad, no un motor uniforme de aprobaciones.
- Auditoría: amplia pero no atómica; en varias rutas el guardado continúa si falla la auditoría.
- Documentos: infraestructura genérica disponible, no expediente laboral con clasificación, vigencia y acceso por sensibilidad.
- Conciliación: persistencia manual disponible, sin ingestión robusta, matching ni cierre integral.
- Pagos: se registran aplicaciones y cheques; transferencia bancaria es preparación, no ejecución ni confirmación externa.
- Planilla: maestro mínimo y configuración, sin ejecución de nómina.

## 7. Funciones solamente visuales o inexistentes

- Cálculo de planilla y generación de `planilla_detalle`.
- Carga masiva de empleados activos al período.
- Novedades/movimientos mensuales por empleado.
- Revisión, observaciones, corrección y aprobación multinivel de planilla.
- Bono 14, aguinaldo, vacaciones, indemnización y liquidación calculados/versionados.
- Archivo bancario de nómina y confirmación de pago.
- Acumulados laborales anuales e Informe del Empleador.
- Plantillas oficiales versionadas.
- Extracción inteligente de documentos del empleado.
- Motor automático de coincidencias bancarias.
- Notificación confirmada al proveedor; correo/WhatsApp no está implementado como circuito de pago.

## 8. Mapa de integración entre módulos

### Flujo laboral objetivo

`Empresa → Empleado → Contrato/expediente → Período → Movimientos → Cálculo versionado → Revisión → Aprobación → Lote/archivo bancario → Confirmación de pago → Conciliación → Borrador contable → Registro contable → Acumulados → Informe del Empleador`

Existente hoy: `Empresa → empleados_planilla` y `Empresa → planillas_periodos`; también existen tasas/descuentos. El resto está desconectado.

### Proveedor

`Proveedor(id) → CxP(proveedor_id) → preparación de pago → aprobación → instrumento/lote → confirmación → pago aplicado → conciliacion_vinculos → borrador/asiento → notificación`

Existente: proveedor→CxP, pagos registrados, documentos y cheque. Incompleto: transferencia versionada, confirmación externa, vínculo automático con conciliación, idempotencia transversal, asiento derivado y notificación posterior.

### Cliente

`Cliente(id) → CxC(cliente_id) → cobro recibido → movimiento bancario → conciliación → aplicación a CxC → borrador/asiento`

Existente: cliente→CxC y pagos registrados. Incompleto: movimiento bancario conciliado→aplicación idempotente→asiento.

Regla general: toda relación debe usar IDs y `empresa_id`; nombres, referencias y descripciones solo son snapshots legibles. Un vínculo no puede cruzar empresas y debe existir constraint compuesto cuando dos entidades llevan `empresa_id`.

## 9. Maestro de Empleados propuesto

### Estado actual

`empleados_planilla` conserva: empresa, código, nombres, apellidos, DPI, NIT, IGSS, fecha de ingreso, puesto, departamento, salario base, bonificación incentivo, moneda, activo, estado y observaciones. Se guardan realmente por inserción desde Planilla. No se observan fecha de nacimiento, nacionalidad, sexo, estado civil, fotografía, dirección, municipio, teléfono, correo, ocupación, centro de trabajo, contrato, retiro, jornada, cuenta bancaria, familia, emergencia ni expediente laboral estructurado.

### Modelo propuesto, sin inventar requisitos oficiales

- `empleados`: identidad estable, empresa, código, nombres, estado y fechas laborales principales.
- `empleados_identificacion`: DPI/NIT/IGSS y atributos oficiales opcionales, con acceso restringido.
- `empleados_contacto`: dirección normalizada, municipio/departamento y medios de contacto.
- `empleados_relaciones_laborales`: puesto, ocupación, centro, contrato, jornada, salario, ingreso/retiro y vigencia; cada cambio crea una nueva versión.
- `empleados_cuentas_bancarias`: banco, tipo, cuenta cifrada/tokenizada, últimos dígitos, titular, estado de validación y vigencia.
- `empleados_dependientes`, `empleados_beneficiarios`, `empleados_contactos_emergencia`: entidades separadas, no JSON libre.
- `empleados_documentos`: relación con documento privado, tipo, vigencia, estado de revisión y hash.
- `empleados_cambios`: before/after mínimo, actor, razón, aprobación y timestamp.

No duplicar `perfiles`: un empleado puede no ser usuario, y un usuario puede no ser empleado. Si coinciden, usar una FK opcional explícita.

### Protección

DPI, NIT, IGSS, cuenta bancaria, fecha de nacimiento, dirección y familia requieren RLS específica, enmascaramiento en UI/exportaciones, auditoría de lectura sensible y cifrado o tokenización para cuenta completa. Los logs nunca deben contener valores completos. Salario y prestaciones requieren permisos laborales/contables por empresa. Cambios de identidad, banco, salario, contrato y retiro deben versionarse.

## 10. Movimientos mensuales

Crear un catálogo versionado `tipos_movimiento_planilla` con naturaleza ingreso/descuento/aporte/provisión, unidad, fórmula o captura manual, cuentas contables configurables y vigencia. No codificar reglas legales permanentes en UI.

Crear `movimientos_planilla` con: `id`, `empresa_id`, `empleado_id`, `periodo_id`, `tipo_movimiento_id`, cantidad, unidad, monto, moneda, documento_id, origen, estado, creado/revisado/aprobado por y fechas, versión e `idempotency_key`. Constraint compuesto debe impedir cruzar empresa entre empleado y período. Una clave de negocio debe evitar duplicar importaciones o generación automática.

Estados recomendados del movimiento: `BORRADOR → EN_REVISION → OBSERVADO/CORREGIDO → APROBADO → APLICADO`; anulación lógica con razón, nunca borrado contable. Cambios posteriores a aprobación generan reversión o nueva versión.

No existe hoy una estructura equivalente completa. `planilla_detalle` guarda totales calculados, y `planilla_prestamos_descuentos` solo cubre préstamos/descuentos recurrentes. `movimientos` genérico no debe sustituirla.

## 11. Flujo de Planilla

### Capacidad actual por requisito

| Capacidad | Estado |
|---|---|
| Crear períodos | Funcional parcial; inserta y el índice SQL propone evitar duplicados |
| Evitar períodos duplicados | Requiere confirmar constraint remoto; no hay prevalidación transaccional en UI |
| Seleccionar empresa | Funcional con empresas permitidas/operativas |
| Cargar empleados activos | Solo lectura global; no crea snapshot del período |
| Registrar novedades | Inexistente |
| Calcular ingresos/descuentos/neto/horas extra | Inexistente |
| Tasas IGSS/IRTRA/INTECAP/ISR | Configuración básica; cálculo inexistente y legalidad no validada |
| Prestaciones y liquidación | Inexistente |
| Resumen | Solo conteos/salarios base, no resultado de planilla |
| Revisar/observar/aprobar/cerrar/reabrir | Inexistente en UI de Planilla |
| Exportar/archivo bancario | Inexistente |
| Historial | Auditoría de altas; no historial completo de transición/cálculo |

### Estados productivos y transiciones

| Desde | Hacia | Actor mínimo | Condición |
|---|---|---|---|
| BORRADOR | EN_REVISIÓN | Auxiliar/Contador | Validaciones completas y snapshot generado |
| EN_REVISIÓN | CON_OBSERVACIONES | Contador/Supervisor | Observación obligatoria |
| CON_OBSERVACIONES | CORREGIDA | Auxiliar | Observaciones atendidas; nueva versión |
| CORREGIDA | EN_REVISIÓN | Auxiliar/Contador | Reenvío explícito |
| EN_REVISIÓN | APROBADA | Contador/Supervisor según política | Cálculo congelado y segregación respetada |
| APROBADA | ARCHIVO_BANCARIO_GENERADO | Contador | Plantilla vigente y validación de cuentas |
| ARCHIVO_BANCARIO_GENERADO | PAGO_EN_PROCESO | Jefe | Autorización explícita; no implica pago |
| PAGO_EN_PROCESO | PAGO_CONFIRMADO | Jefe/función de tesorería | Evidencia/referencia bancaria obligatoria |
| PAGO_CONFIRMADO | CONCILIADA | Contador | Todos los pagos aplicables vinculados o excepción aprobada |
| CONCILIADA | CONTABILIZADA | Contador revisor | Borrador balanceado finalizado una sola vez |
| CONTABILIZADA | CERRADA | Jefe | Acumulados actualizados y controles completos |

Reapertura solo desde estados autorizados mediante evento separado, razón, aprobador distinto cuando aplique y reversión de efectos posteriores. No editar silenciosamente una planilla aprobada/pagada.

## 12. Roles y aprobaciones

Roles visibles: Jefe, Supervisor, Contador, Auxiliar y Auditor. `admin` se conserva como interno y la API ya impide asignarlo desde la administración normal.

| Acción | Auxiliar | Contador | Supervisor | Jefe | Auditor |
|---|---:|---:|---:|---:|---:|
| Consultar empresa asignada | Sí | Sí | Sí | Sí | Sí |
| Crear/corregir empleado y movimientos | Sí | Sí | Según política | Consulta | No |
| Adjuntar respaldo | Sí | Sí | Sí | Consulta | Consulta |
| Enviar a revisión | Sí | Sí | Sí | No | No |
| Observar/devolver | No | Sí | Sí | Sí | No |
| Aprobar cálculo | No | Sí, si segregación permite | Sí | Según política | No |
| Generar archivo | No | Sí | Consulta | Autoriza | No |
| Confirmar pago | No | No por defecto | No por defecto | Sí/función tesorería | No |
| Conciliar/preparar asiento | No | Sí | Consulta | Consulta | No |
| Finalizar asiento/cerrar/reabrir | No | Finalizar según función | No | Cerrar/reabrir | No |
| Auditoría/exportación | Limitada | Sí | Sí | Sí | Sí, solo lectura |

La autorización debe evaluarse en servidor/RPC/RLS, no solo ocultando botones. “Rol” define responsabilidad general; `usuario_funciones_operativas` debe conceder capacidades por empresa. Nadie debe preparar y aprobar la misma operación cuando la política exija segregación.

## 13. Pagos y notificaciones

Modelo futuro: `obligaciones_pago → lotes_pago → instrucciones_pago → aprobaciones_pago → evidencias_pago → aplicaciones_pago → conciliacion_vinculos → contabilización → notificaciones_pago`.

- Una instrucción preparada conserva estado `PREPARADA`, nunca `PAGADA`.
- Archivo bancario es un artefacto versionado con hash, plantilla, creador y aprobación; no una transferencia.
- Confirmación exige referencia, fecha, monto, cuenta origen y evidencia; constraint/idempotencia impide doble pago.
- Aplicación CxP/CxC y evento de auditoría deben ejecutarse atómicamente mediante función de servidor.
- Notificación se crea únicamente después de confirmación. Su fallo produce `NOTIFICACION_PENDIENTE` sin revertir el pago.
- No habrá conexión bancaria directa en esta fase.

Estado actual: CxP/CxC y cheques cubren partes del flujo; no existe el agregado de pago completo ni notificación posterior verificable.

## 14. Conciliación bancaria

La base actual permite registrar cuentas, estados, movimientos, vínculos y ajustes. El flujo productivo requerido agrega:

1. Subida privada del archivo original.
2. `sha256` + cuenta + rango para impedir reimportación.
3. Parser por plantilla bancaria versionada; nunca inventar columnas.
4. Normalización inmutable de fecha, monto, referencia y descripción.
5. Candidatos de coincidencia exacta/probable con puntuación y razones.
6. Revisión humana de probable, sin coincidencia y duplicado.
7. Vínculo único o distribución controlada a cheque, transferencia, CxP, CxC, empleado u otro documento.
8. Cierre con totales, excepciones y aprobación; reapertura auditada.

Comisiones bancarias deben crear un ajuste/borrador, no asiento definitivo. Cheques en circulación y pagos no reflejados permanecen partidas conciliatorias. Depósitos no identificados no deben aplicarse automáticamente a un cliente.

## 15. Integración contable

Definir `configuracion_contable_planilla` por empresa y vigencia para conceptos: sueldos por pagar, bancos, bonificaciones, horas extra, cuotas laborales/patronales, anticipos, préstamos, descuentos, vacaciones, Bono 14, aguinaldo, indemnizaciones y liquidaciones.

Al aprobar/cerrar hitos, generar `documentos_contables_revision` y distribuciones como borrador con `origen_modulo`, `entidad_tipo`, `entidad_id`, versión e idempotency key única. El contador revisa y finaliza mediante el mecanismo contable existente. Nunca crear dos asientos para la misma versión de planilla/pago/conciliación.

La reversión crea asiento inverso relacionado; no borra el asiento registrado. El cierre contable debe impedir contabilizar en período cerrado. La plataforma ya soporta borradores, balance, finalización, anulación y cierre; falta adaptar fuentes de planilla y conciliación a ese contrato.

## 16. Infraestructura de plantillas oficiales

Crear infraestructura reutilizable, sin cargar formatos inventados:

- `plantillas_documentales`: institución, nombre, propósito, año/versión, formato, vigencia, estado y archivo original privado.
- `plantillas_columnas`: posición, encabezado exacto, tipo, obligatoriedad, regla y transformación autorizada.
- `plantillas_versiones`: snapshot inmutable, hash, configurador, revisor y fechas.
- `archivos_generados`: plantilla_version_id, entidad fuente, hash, estado, almacenamiento, creador/revisor y errores.
- `validaciones_archivo`: fila/campo, severidad y resultado.

Aplicaciones: Informe del Empleador, archivo bancario, Planilla Electrónica IGSS y futuros formatos oficiales. Una plantilla publicada es inmutable; corregir implica nueva versión.

## 17. Informe del Empleador

Fuente autorizada: Maestro vigente + movimientos aprobados + planillas cerradas + acumulados anuales. El número y orden de columnas provienen exclusivamente del Excel oficial vigente.

Flujo: cargar original oficial → configurar versión → mapear campos → validar muestra → aprobar plantilla → generar borrador → reportar faltantes → revisión humana → generar versión final → almacenar hash/archivo → posteriormente adjuntar constancia de presentación.

No existe implementación actual. No se debe fijar “43 campos” ni alterar hojas, encabezados, orden o formatos sin el archivo oficial.

## 18. IGSS

La base actual solo guarda número IGSS y permite configurar tasas nominales. Eso no demuestra cálculo legal, planilla electrónica ni presentación.

La implementación futura debe usar reglas versionadas por vigencia, bases y topes configurables respaldados por documentación oficial; separar cuota laboral, patronal y otras contribuciones; conservar el cálculo por empleado y versión; validar contra plantilla oficial vigente; producir archivo revisable y nunca enviarlo automáticamente.

## 19. Seguridad y privacidad

- RLS obligatoria en toda tabla por empresa; superusuario interno separado de roles visibles.
- FK compuestas `(id, empresa_id)` para impedir referencias cruzadas.
- Storage privado, rutas impredecibles, descarga mediante URL firmada corta y autorización previa.
- Enmascarar DPI/cuenta/IGSS; auditoría de lectura y exportación sensible.
- Prohibir update directo de estados finales; usar RPC transaccional con transición permitida.
- Idempotencia persistente y constraint único para cálculo, archivo, confirmación, aplicación y asiento.
- Bloqueo de doble submit en UI es complementario, no garantía.
- Eliminación lógica; retención y reversión para registros financieros/laborales.
- Paginación server-side y columnas explícitas; no descargar todo para filtrar.
- Rate limit distribuido para APIs sensibles; el límite en memoria no sirve por sí solo en múltiples instancias.
- Logs estructurados sin secretos ni datos completos; correlación por operación.

Pruebas negativas obligatorias: usuario sin sesión; inactivo; rol incorrecto; empresa no asignada; ID de otra empresa; modificación directa vía REST; cambio de estado no permitido; actor que prepara y aprueba; repetición de idempotency key; doble submit concurrente; documento ajeno; URL firmada vencida; exportación masiva; período cerrado; planilla pagada editada; doble conciliación; doble asiento; archivo duplicado; payload con empresa manipulada; auditor sin mutación.

## 20. Riesgos críticos

1. `/empleados` apunta a usuarios: identidad laboral y acceso al sistema están conceptualmente mezclados.
2. El circuito de planilla termina antes del cálculo; no hay trazabilidad de resultado por empleado.
3. SQL versionado puede no estar desplegado; una UI segura no compensa RLS ausente.
4. Muchas mutaciones ocurren desde cliente; seguridad depende totalmente de RLS/RPC correctas.
5. Auditoría no siempre es atómica con la operación.
6. Datos sensibles de empleado aparecen completos en tabla de Planilla.
7. Falta paginación en Planilla y otras vistas que consultan todos los registros permitidos.
8. Estados y roles usan variantes textuales; pueden divergir entre UI, SQL y funciones.
9. No hay idempotencia transversal planilla→pago→conciliación→asiento.
10. `movimientos` genérico puede producir acoplamiento o doble contabilización si se reutiliza sin contrato.
11. Conciliación manual no previene por sí misma importación/operación duplicada.
12. No hay infraestructura de plantilla oficial ni evidencia de reglas laborales versionadas.

## 21. Cambios de base de datos que serán necesarios

Requieren diseño SQL exacto y autorización previa:

- Evolución/normalización de `empleados_planilla` a Maestro de Empleados y tablas sensibles/versionadas.
- Movimientos mensuales, catálogo versionado y respaldos.
- Snapshots/versiones de cálculo de planilla y detalle inmutable.
- Flujo de estados, observaciones, aprobaciones y reaperturas.
- Acumulados laborales y prestaciones por vigencia.
- Lotes/instrucciones/evidencias/aplicaciones de pago.
- Beneficiarios y cuentas bancarias protegidas.
- Hash/importaciones/candidatos/cierres de conciliación.
- Configuración contable de conceptos e idempotencia de asientos origen.
- Plantillas, columnas, versiones, archivos generados y validaciones.
- Índices de empresa, estado, período, empleado, fechas y claves de negocio.
- RPC transaccionales para transiciones y efectos múltiples.

No se ejecutó ni modificó SQL durante esta auditoría.

## 22. RLS que deberá revisarse

- Confirmar despliegue de `planilla_rls_base.sql` y grants; probar que DELETE está bloqueado.
- Separar lectura de datos laborales generales de lectura sensible/bancaria/familiar/salarial.
- Policies por empresa y función para movimientos, planilla, aprobaciones, pagos y plantillas.
- Prohibir al actor actualizar directamente campos de aprobación/confirmación.
- Permitir Auditor solo SELECT y exportaciones autorizadas.
- Validar service role exclusivamente en servidor.
- Revisar `auditoria_eventos`, idempotencia e intentos bloqueados para evitar falsificación desde cliente.
- Confirmar RLS de Storage y ownership de documentos laborales.
- Auditar policies actuales de CxP/CxC, conciliación, contabilidad, cheques y `movimientos` contra escalamiento horizontal.

## 23. APIs requeridas

Preferir Route Handlers/RPC transaccionales para acciones sensibles:

- `POST /api/empleados`, `PATCH /api/empleados/:id` con versionado y enmascaramiento.
- `POST /api/planillas/periodos`, `/movimientos`, `/calcular`, `/transicionar`, `/reabrir`.
- `POST /api/planillas/:id/archivos-bancarios` y `/confirmaciones-pago` sin ejecutar transferencias.
- `POST /api/conciliacion/importaciones`, `/candidatos`, `/vinculos`, `/cerrar`, `/reabrir`.
- `POST /api/contabilidad/borradores-desde-origen` idempotente.
- `POST /api/plantillas`, `/validar`, `/generar`.
- Descarga autorizada de documentos/archivos mediante URL firmada corta.

Cada endpoint: sesión, usuario activo, módulo, empresa, rol/función, esquema validado, idempotencia, rate limit, transacción y auditoría. Las consultas de listas deben paginar y admitir filtros server-side.

## 24. Orden de implementación por fases

1. **Contrato y seguridad:** confirmar esquema remoto, nomenclatura de estados/roles, pruebas RLS negativas y diccionario de datos.
2. **Maestro de Empleados:** separar de usuarios, migrar sin pérdida, privacidad, versionado y expediente documental.
3. **Períodos y movimientos:** catálogo versionado, novedades, snapshots e idempotencia.
4. **Motor de cálculo:** reglas configurables, detalle reproducible, diferencias y prestaciones, siempre borrador.
5. **Workflow:** revisión, observaciones, aprobación, cierre y reapertura segregada.
6. **Pagos preparados:** lotes, archivos por plantilla oficial y confirmación manual con evidencia.
7. **Conciliación:** importación con hash, matching asistido, revisión y cierre.
8. **Contabilidad:** generación idempotente de borradores y finalización humana.
9. **Acumulados y oficiales:** plantillas versionadas, Informe del Empleador e IGSS con archivos oficiales vigentes.
10. **Escala/operación:** paginación, jobs controlados, métricas, alertas, backups y pruebas de carga.

## 25. Criterios de aceptación de producción

- Ningún usuario accede o muta otra empresa, ni por UI ni REST/RPC.
- Cálculo reproducible: misma versión de entradas/reglas produce mismo resultado y hash.
- No existen duplicados bajo concurrencia en período, movimiento importado, pago, conciliación o asiento.
- Estados solo cambian por transiciones válidas y actores autorizados.
- Preparación, aprobación y confirmación están segregadas según política.
- Datos sensibles están cifrados/enmascarados, con exportación auditada.
- Planilla aprobada/pagada es inmutable; cambios usan versión/reversión.
- Toda cifra puede rastrearse a empleado, movimiento, documento, regla, actor y asiento.
- Archivos oficiales preservan exactamente la plantilla aprobada y su hash.
- Fallo de notificación no altera el pago; queda pendiente y reintentable.
- Listados paginados, índices verificados y consultas medidas con volumen representativo.
- Backups/restauración probados, monitoreo de servidor activo y runbooks disponibles.
- TypeScript, build, pruebas unitarias/integración/RLS/E2E/concurrencia y seguridad pasan en CI.
- Pruebas de carga y dimensionamiento sustentan cualquier afirmación de escala.

## 26. Qué no se modificó

- No se modificaron SQL, migraciones, RLS, autenticación, Supabase, `proxy.ts` ni `.env.local`.
- No se ejecutaron transferencias, envíos, notificaciones ni integraciones externas.
- No se agregaron CRM, RRHH separado, asistente, n8n, firma digital ni componentes de otros productos.
- No se inventaron campos/columnas oficiales ni formatos bancarios.
- No se borraron datos ni se hicieron cambios destructivos.
- No se prepararon cambios con Git ni se creó commit.

## Decisión técnica

La base permite avanzar sin reconstrucción si se trata como plataforma parcial y se corrige primero la frontera de dominio Empleado/Usuario. Se recomienda conservar autenticación, multiempresa, documentos, auditoría, idempotencia, conciliación y contabilidad; construir encima un núcleo laboral versionado y transaccional. Intentar conectar directamente la UI actual de Planilla con pagos o contabilidad antes de completar movimientos, cálculo, aprobación e idempotencia aumentaría el riesgo operativo y no debe hacerse.
