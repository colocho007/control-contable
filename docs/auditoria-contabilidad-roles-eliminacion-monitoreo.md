# Auditoría de contabilidad, roles, eliminación y monitoreo

Fecha de revisión: 11 de junio de 2026  
Rama: `audit/contabilidad-roles-eliminacion-monitoreo`  
Alcance: revisión estática de interfaz y lógica de aplicación. No se modificaron SQL, RLS, políticas Supabase, autenticación ni datos.

## Resumen ejecutivo

Control+ ya aplica varias prácticas correctas: no se encontraron llamadas directas `.delete()` en los módulos auditados; Contabilidad, Finanzas, Cheques, CxP y CxC usan anulación; Usuarios y Documentos usan desactivación; y Documentos abre archivos privados mediante URL firmada temporal. Monitoreo Sistema también presenta mensaje, módulo, severidad, acción recomendada, estado, fecha y usuario, con detalle técnico colapsable.

Sin embargo, la política de roles visible no coincide con el objetivo solicitado. El módulo Usuarios permite crear `admin` desde la interfaz y el endpoint de creación también lo acepta. Admin Operativo evita crear `admin`, pero permite asignarlo al editar. Además, los roles visibles actuales incluyen perfiles no contemplados en la lista objetivo y no incluyen `auxiliar` ni `auditor` como roles base.

Los módulos Impuestos y Conciliación bancaria están en una fase principalmente registral: permiten insertar registros y seleccionar estados directamente, mientras que las acciones de cerrar, conciliar, contabilizar o anular son botones informativos sin ejecución. Esto deja el control de ciclo de vida incompleto. Órdenes de compra permite firmar, aprobar y observar, pero no ofrece cancelación/anulación controlada.

Se encontraron textos mal codificados visibles concentrados en Cheques y Monitoreo Sistema. También se muestran identificadores técnicos al usuario en Usuarios, Contabilidad, Conciliación bancaria y Monitoreo.

## Estado de módulos contables

| Módulo | Tablas o fuentes principales observadas | Crea / modifica | Anula / archiva / desactiva | Estado de control |
|---|---|---|---|---|
| Contabilidad | `movimientos`, `movimientos_historial`; mediante `lib/contabilidadV2.ts`: `catalogo_cuentas`, `periodos_contables`, `asientos_contables`, `documentos_contables_revision`, `distribuciones_documentos_contables`, `impuestos_configuracion` | Movimientos, cuentas, impuestos, documentos de revisión, distribuciones, periodos y asientos | Anula movimientos y asientos; inactiva configuración de impuestos; finaliza asientos y cierra periodos | Control contable amplio. No hay eliminación física. Revisar separación entre movimiento operativo y asiento formal. |
| Auxiliar | `tareas`, `documentos_tramites`, `cheques` | Solo consulta en esta página | No ofrece eliminación | Panel de lectura. Puede mostrar `usuario_id` cuando falta nombre y `Empresa #ID` cuando falta catálogo. |
| Finanzas | `movimientos`, `movimientos_historial` | Crea movimientos | Anula movimientos con motivo e historial | Buen patrón de anulación; no elimina físicamente. |
| Cheques | `cheques`, `cheques_historial`, `fondos_empresa`, `chequeras`, `cheques_fisicos`, `vista_resumen_chequeras`, borradores e idempotencia | Crea fondos, chequeras y cheques; autoriza, rechaza y paga mediante RPC | La función llamada `archivarCheque` ejecuta anulación transaccional | No elimina. El nombre interno “archivar” y la acción real “anular” deben unificarse. Presenta abundante mojibake visible. |
| Órdenes de compra | `ordenes_compra`, `ordenes_compra_firmas`, `ordenes_compra_historial`, borradores e idempotencia | Crea, firma y aprueba; permite observar/rechazar | No hay anulación ni cancelación controlada visible | Riesgo alto: falta ciclo formal para cancelar/anular una orden emitida o aprobada. |
| Cuentas por Pagar | `cuentas_por_pagar`, `pagos_cuentas_por_pagar`, `proveedores`, `documentos_contables_revision` | Crea/edita cuentas y registra pagos | Anula cuentas y pagos con motivo; pagos usan RPC | Buen enfoque general. Debe impedir edición sustancial después de pagos o cierre y conservar reversión trazable. |
| Cuentas por Cobrar | `cuentas_por_cobrar`, `pagos_cuentas_por_cobrar`, `clientes`, `documentos_contables_revision` | Crea/edita cuentas y registra pagos | Anula cuentas y pagos con motivo; pagos usan RPC | Mismo criterio que CxP: reversión/anulación, nunca borrado físico. |
| Impuestos | `impuestos_configuracion`, `impuestos_documentos`, `impuestos_periodos`, `impuestos_resumen_periodo`, `impuestos_calendario` | Inserta configuración, documentos, periodos, resúmenes y calendario | “Anular”, “Cerrar”, “Declarar” y “Cumplir” son acciones de fase posterior sin implementación | Riesgo crítico funcional: registros fiscales permiten escoger estados al crear, pero no existe flujo controlado de transición/anulación. |
| Conciliación bancaria | `conciliacion_cuentas_bancarias`, `conciliacion_estados_cuenta`, `conciliacion_movimientos_banco`, `conciliacion_vinculos`, `conciliacion_ajustes` | Inserta cuentas, estados, movimientos, vínculos y ajustes | “Cerrar”, “Conciliar”, “Aprobar”, “Contabilizar” y “Anular” no están implementados | Riesgo alto: fase registral sin ciclo de control. Solicita “Entidad UUID opcional”, un dato técnico visible. |
| Flujo de efectivo | `movimientos`, `fondos_empresa` | Solo consulta/agregación | No ofrece eliminación | Panel derivado de fuentes financieras; debe mantenerse sin mutaciones. |
| Documentos | `documentos_tramites`, `empresas`, `intentos_bloqueados`; bucket `documentos-tramites` | Sube archivos y metadata | Desactiva metadata; no borra físicamente archivo | Base privada sólida. Falta carpeta privada/oculta con permiso especial separado. |
| Reportes | Datos agregados de movimientos, fondos, cheques, órdenes, tareas, CxP/CxC, asientos y periodos | Consulta y exporta | No ofrece eliminación | Correcto como módulo de lectura. |
| Usuarios | `perfiles` | Crea perfiles mediante `/api/admin/perfiles` | Desactiva perfiles | No elimina, pero permite crear Administrador y muestra UID técnico. |
| Admin Operativo | `perfiles`, `empresas`, `usuario_empresas`, `usuario_modulos`, `usuario_funciones_operativas`, `modulos_sistema`, borradores e idempotencia | Crea usuarios, cambia rol/estado y sincroniza permisos | Desactiva asignaciones; no elimina | Permite asignar `admin` al editar; roles base y funciones operativas están mezclados conceptualmente. |
| Historial | `auditoria_eventos`, `empresas`, `intentos_bloqueados` | Consulta y exporta; audita consultas | No ofrece eliminación | Correcto como registro inmutable desde UI. Puede exponer IDs técnicos en eventos si faltan nombres. |
| Monitoreo Sistema | `auditoria_eventos`, `logs`, `monitoreo_alertas`, perfiles, módulos, asignaciones, borradores y contadores contables | Cambia activación global de módulos y estados de alertas | Archiva alertas; no elimina | Presentación operativa avanzada, pero clasificación heurística y exposición de IDs requieren ajuste. |

## Roles encontrados

### Roles base visibles o aceptados

- `admin`, `jefe`, `supervisor`, `contador`, `tesorero`, `firmante`, `firmante_oc`, `iniciador`, `iniciador_gestion`, `empleado`.
- Usuarios muestra: Empleado, Contador, Supervisor, Jefe y Administrador.
- Admin Operativo excluye `admin` al crear, pero lo incluye al editar.
- El endpoint `/api/admin/perfiles` acepta crear cualquiera de los roles del sistema, incluido `admin`.
- Monitoreo Sistema solo admite `admin`.
- Sidebar y varias páginas consideran administrativos a `admin`, `jefe` y `supervisor`.

### Funciones operativas encontradas

- Contabilidad: `auxiliar_contable`, `contador_revisor`, `contabilidad_catalogo_admin`, `contabilidad_configuracion`, `contabilidad_cierre_periodo`.
- Auditoría: `auditor_solo_lectura`.
- Cheques: `firmante_cheque`, `autorizador_cheque`, `pagador_cheque`, `revisor_cheque`.
- Órdenes: `creador_orden`, `firmante_orden`, `autorizador_compra`.

Existe una distinción útil entre rol base y función por empresa, pero la interfaz no la explica suficientemente y usa nombres parecidos, por ejemplo `contador` frente a `contador_revisor`, o el rol futuro `auditor` frente a `auditor_solo_lectura`.

## Roles recomendados

Roles visibles permitidos:

| Rol visible | Uso recomendado |
|---|---|
| Jefe | Supervisión operativa, aprobaciones y asignación limitada de permisos. |
| Supervisor | Coordinación operativa sin capacidad de crear/asignar superusuario. |
| Contador | Trabajo contable según funciones específicas por empresa. |
| Auxiliar | Preparación y carga, sin revisión final, cierres ni anulaciones sensibles. |
| Auditor | Solo lectura; no combinar con funciones de escritura. |

El `admin` principal debe permanecer como control interno/superusuario:

- No debe aparecer en selectores de creación o edición comunes.
- No debe poder asignarse mediante el endpoint operativo normal.
- Su administración debe quedar fuera de Usuarios y Admin Operativo, mediante procedimiento excepcional auditado.
- Debe distinguirse visual y técnicamente de Jefe/Supervisor.
- Los roles `tesorero`, `firmante`, iniciadores y similares deben migrarse a funciones operativas por empresa, no mantenerse como roles base visibles.

## Reglas de eliminación por módulo

| Módulo / registro | Regla recomendada |
|---|---|
| Movimientos financieros y contables | Anulación controlada con motivo, usuario, fecha e historial. Nunca eliminación física. |
| Asientos contables | Anulación/reversión mediante operación formal. Nunca eliminación física. |
| Catálogo contable | Desactivación si no tiene uso; no eliminar cuentas referenciadas. |
| Periodos contables | Cierre/reapertura excepcional auditada; no eliminar. |
| Cheques, chequeras, fondos y pagos | Anulación o desactivación según tipo. Cheques pagados requieren reversión formal, no borrado. |
| Órdenes de compra | Cancelación/anulación controlada con motivo y estado anterior/nuevo. No eliminar órdenes emitidas o aprobadas. |
| CxP/CxC y pagos | Anulación o reversión; no eliminar si existe documento, pago o relación contable. |
| Impuestos y documentos fiscales | Anulación/reemplazo versionado. Nunca eliminación física. |
| Conciliaciones, vínculos y ajustes | Anulación/desvinculación auditada; ajustes contabilizados requieren reversión. |
| Documentos | Desactivación/archivado. Archivo físico solo bajo retención aprobada y procedimiento excepcional. |
| Usuarios | Desactivación. Nunca eliminar historial ni identidad referenciada. |
| Permisos/asignaciones | Desactivación con auditoría; no borrado silencioso. |
| Auditoría, historial y alertas | No permitido eliminar desde interfaz. Alertas pueden archivarse. |
| Reportes, Auxiliar y Flujo de efectivo | No aplica: son vistas de consulta. |

## Qué puede eliminar el administrador principal

La eliminación definitiva debe ser excepcional, con doble confirmación, previsualización de dependencias, motivo obligatorio y auditoría sensible. Puede considerarse únicamente para:

- Borradores incompletos que nunca fueron emitidos, aprobados, contabilizados ni vinculados.
- Archivos huérfanos sin metadata, después de revisión de retención y dependencia.
- Datos inequívocamente de prueba/demo, mediante reinicio controlado y nunca mezclados con datos reales.
- Catálogos o configuraciones sin referencias, si la política de retención lo permite.

No debe eliminar definitivamente registros oficiales aunque sea administrador principal. El superusuario debe poder ejecutar la operación de reversión/anulación excepcional, no borrar evidencia.

## Qué debe anularse y no eliminarse

- Asientos, movimientos, cheques, pagos, CxP, CxC, órdenes emitidas/aprobadas, impuestos, declaraciones, documentos fiscales, conciliaciones y ajustes.
- Toda anulación debe conservar el registro original, estado anterior/nuevo, motivo, usuario, fecha y vínculo a reversión cuando corresponda.
- Una anulación no debe reutilizarse como “archivado”; cada estado debe tener semántica consistente.

## Propuesta de carpeta oculta / privada

Estado actual:

- Se usa el bucket `documentos-tramites`.
- El path se construye como `{empresa_id}/{modulo}/{uuid}-{nombre-limpio}`.
- Se valida que la ruta comience con la empresa del documento.
- Los archivos se abren con URL firmada temporal de cinco minutos.
- La UI no muestra la ruta técnica durante la apertura normal.
- La desactivación cambia metadata a `inactivo`, sin borrar el archivo.

Propuesta:

- Crear una categoría lógica visible como **Privado** o **Confidencial**, no una ruta técnica visible.
- Mantener almacenamiento privado y separación por empresa: `{empresa_id}/privado/{identificador}`.
- Añadir un atributo funcional como `visibilidad = privada` o `clasificacion = confidencial`.
- Permitir acceso solo a administrador principal o a una función especial, por ejemplo `documentos_privados`, asignada explícitamente por empresa.
- No inferir permiso únicamente desde `sensible`; “sensible” clasifica el documento, mientras “privado” controla visibilidad.
- Registrar apertura, descarga, carga, desactivación y cambio de clasificación.
- Mostrar nombre amigable, empresa, propietario, clasificación y fecha; nunca bucket, path, UUID ni URL.
- Mantener la eliminación física fuera de la UI común y sujeta a retención/documentación.

## Auditoría de Monitoreo Sistema

### Capacidades presentes

- Acceso limitado actualmente a `admin`.
- Consume alertas persistidas, auditoría real, logs técnicos, módulos, usuarios, asignaciones, borradores y contadores contables.
- Cada alerta incluye mensaje, módulo, severidad/riesgo, posible causa, acción recomendada, estado, fecha, usuario y empresa cuando aplica.
- Permite pasar alertas a Pendiente, En revisión, Resuelta o Archivada.
- El detalle técnico está en una sección colapsable “Detalle Técnico”.
- Filtra algunas claves sensibles de metadata como password, token, secret, clave, JWT y cookie.

### Hallazgos

- La clasificación de auditoría depende de búsqueda de palabras dentro de texto y JSON. Puede marcar eventos normales como errores o perder fallas sin palabras conocidas.
- `logs` se consulta con `select("*")`; el esquema y sensibilidad de campos no están delimitados en la aplicación.
- Cuando no existe nombre, muestra `usuario_id`; cuando no existe catálogo de empresa, muestra `Empresa {id}`.
- El detalle técnico muestra ID de alerta y pares de metadata en fuente monoespaciada. Está colapsado, pero debe reservarse al superusuario o permiso técnico.
- Se mezclan alertas operativas reales con inventarios informativos como módulos activos, usuarios trabajando y asignaciones.
- Los estados pueden caer a `localStorage` si la persistencia no está activa, lo cual no constituye control compartido ni trazabilidad central.
- Hay cuatro usos visibles de `En revisiÃ³n`, que rompen el estado y pueden impedir filtros consistentes frente a `En revisión`.

### Recomendación de presentación

La vista principal debe mostrar únicamente:

- Qué pasó.
- Módulo.
- Riesgo.
- Acción recomendada.
- Estado.
- Fecha.
- Usuario relacionado, si aplica.

Mover IDs, fuente, entidad, ruta, metadata, JSON y mensajes internos a “Detalle técnico”, visible solo con permiso especial. Separar “Alertas que requieren acción” de “Estado operativo/inventario”.

## Textos mal codificados encontrados

La búsqueda en `app`, `components` y `lib` encontró 41 coincidencias activas: 37 en `app/cheques/page.tsx` y 4 en `app/monitoreo-sistema/page.tsx`.

### Cheques

Ejemplos y corrección esperada:

- `DepÃ³sito` → `Depósito`.
- `estÃ¡`, `mÃ³dulo`, `SesiÃ³n`, `vÃ¡lida` → `está`, `módulo`, `Sesión`, `válida`.
- `nÃºmero`, `lÃ­mite` → `número`, `límite`.
- `autorizaciÃ³n`, `descripciÃ³n`, `anulaciÃ³n` → `autorización`, `descripción`, `anulación`.
- `DÃ³lares USD` y `DÃ³lares (USD)` → `Dólares USD` y `Dólares (USD)`.
- `Â¿Deseas...` → `¿Deseas...`.
- `â€”` → `—` o separador visual consistente.
- `â†’` → `→` o texto “a”.

El mojibake no solo afecta etiquetas: también aparece en valores de estado como `Pendiente de autorizaciÃ³n` y tipo `DepÃ³sito`. Corregirlos requiere revisar compatibilidad con datos existentes para evitar romper filtros.

### Monitoreo Sistema

- Cuatro comparaciones/filtros usan `En revisiÃ³n` en lugar de `En revisión`.
- Riesgo: una alerta persistida con el valor correcto podría no contarse ni mostrarse en los paneles filtrados.

### Otros textos técnicos visibles

- Usuarios solicita y muestra “UID existente de Supabase Auth”.
- Contabilidad muestra `ID: {impuesto_id}`.
- Conciliación bancaria solicita “Entidad UUID opcional”.
- Monitoreo muestra IDs, UUIDs y metadata en detalle técnico, y usa IDs como fallback visible.
- Auxiliar usa `usuario_id` o `Empresa #ID` cuando faltan nombres.

## Riesgos críticos

1. La interfaz Usuarios y el endpoint `/api/admin/perfiles` permiten crear/asignar `admin`, contrario al requisito de superusuario interno.
2. Impuestos no tiene flujo real de anulación, cierre o declaración; permite registrar estados directamente y muestra acciones futuras sin ejecución.
3. Los valores mojibake usados como estados/tipos en Cheques y Monitoreo pueden producir registros o filtros incompatibles, no solo defectos visuales.

## Riesgos altos

1. Admin Operativo permite cambiar el rol de otro usuario a `admin`.
2. Órdenes de compra no tiene cancelación/anulación controlada.
3. Conciliación bancaria no implementa cierre, conciliación, contabilización ni anulación.
4. No existe permiso especial para documentos privados; `sensible` no equivale a carpeta oculta.
5. Monitoreo clasifica eventos con patrones heurísticos y consulta `logs` completos, con riesgo de ruido o exposición técnica.
6. Los roles visibles actuales no coinciden con Jefe, Supervisor, Contador, Auxiliar y Auditor; roles y funciones operativas están mezclados.

## Recomendaciones priorizadas

1. Retirar `admin` de todos los selectores y rechazarlo en creación/cambio operativo; reservar el superusuario a procedimiento excepcional.
2. Definir catálogo único de roles visibles y migrar tesorería, firma e iniciación a funciones por empresa.
3. Corregir mojibake con una migración controlada de constantes y, antes de cambiar valores persistidos, inventariar estados/tipos existentes.
4. Implementar transiciones controladas para Impuestos, Conciliación y Órdenes: motivo, permisos, auditoría, estado anterior/nuevo y reversión.
5. Formalizar una matriz central de eliminación/anulación y reutilizarla en cada módulo.
6. Añadir clasificación y permiso `documentos_privados`, manteniendo bucket privado, separación por empresa y URLs firmadas.
7. Separar alertas accionables de inventario informativo en Monitoreo; definir tipos de evento explícitos y limitar campos de `logs`.
8. Sustituir IDs/UUIDs visibles por nombres y referencias de negocio; dejar identificadores solo en detalle técnico autorizado.
9. Añadir pruebas de interfaz y autorización para impedir creación/asignación de admin y para validar transiciones de estado.

## Archivos revisados

Páginas y componentes principales:

- `app/contabilidad/page.tsx`
- `app/auxiliar/page.tsx`
- `app/finanzas/page.tsx`
- `app/cheques/page.tsx`
- `app/ordenes-compra/page.tsx`
- `app/cuentas-pagar/page.tsx`
- `app/cuentas-cobrar/page.tsx`
- `app/impuestos/page.tsx`
- `app/conciliacion-bancaria/page.tsx`
- `app/flujo-efectivo/page.tsx`
- `app/documentos/page.tsx`
- `components/DocumentosEntidad.tsx`
- `app/reportes/page.tsx`
- `app/usuarios/page.tsx`
- `app/admin/page.tsx`
- `app/api/admin/perfiles/route.ts`
- `app/historial/page.tsx`
- `app/monitoreo-sistema/page.tsx`
- `components/Sidebar.tsx`

Lógica compartida y documentación de referencia:

- `lib/contabilidadV2.ts`
- `lib/documentosTramites.ts`
- `lib/auditoria.ts`
- `lib/auth.ts`
- `lib/funcionesOperativas.ts`
- `lib/permisosEmpresas.ts`
- `lib/reportesFinancieros.ts`
- `lib/estadosFinancieros.ts`
- `lib/reinicioControlado.ts`
- `docs/matriz-permisos-control-plus.md`
- `docs/auditoria-total-controlplus.md`
- `docs/monitoreo-alertas-operativas-control-plus.md`

## Próxima rama sugerida

`fix/roles-eliminacion-monitoreo-textos`

Orden recomendado dentro de la rama: bloquear creación/asignación de `admin`, normalizar roles visibles, corregir mojibake sin romper valores persistidos, completar reglas de anulación y luego ajustar Documentos/Monitoreo.
