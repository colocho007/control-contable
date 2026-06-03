# Auditoria total Control+ antes de pruebas reales

Fecha de revision: 2026-06-03

## 1. Resumen ejecutivo

Control+ muestra una base de seguridad fuerte para una prueba controlada: proxy de rutas privadas, validacion de modulo en la mayoria de paginas, permisos por empresa, filtros de empresas operativas en modulos clave, auditoria central, signed URLs para documentos privados, rate limit persistente, idempotencia en flujos criticos y reinicio/limpieza con enfoque no destructivo.

Se aplicaron dos correcciones seguras durante esta auditoria:

- `app/usuarios/page.tsx`: se agrego `idempotency_key` al flujo legado de creacion de perfiles para cumplir el contrato actual de `/api/admin/perfiles`.
- `app/api/admin/perfiles/route.ts`: si la RPC de rate limit persistente aun no esta instalada o falla, la ruta conserva el rate limit local en memoria y no rompe la creacion con error 500.

Recomendacion general: listo para prueba controlada con contador si se ejecutan/revisan los SQL pendientes y se validan flujos funcionales con datos reales. `Finanzas` y `Tareas` fueron reforzados para trabajar por empresa operativa.

## 2. Estado general del sistema

- Autenticacion: Supabase Auth validado via proxy y helpers.
- Autorizacion: la mayoria de modulos usan `validarAccesoModuloUsuario`; `Admin` y `Monitoreo` usan validacion directa de usuario activo/rol.
- Empresas: Dashboard, Reportes y Calendario usan `obtenerEmpresasOperativasDesdeIds`/`esEmpresaOperativaVisible`; Cheques aplica filtro propio equivalente.
- Documentos: `documentos-tramites` usa bucket privado y `createSignedUrl`; `obtenerUrlDocumento` valida estado, bucket, ruta y empresa.
- Auditoria: amplia cobertura con `auditoria_eventos`; el riesgo transaccional detectado en limpieza de empresas y pagos CxP/CxC quedo corregido en SQL versionado.
- SQL: las RPC `security definer` versionadas usan `set search_path = public`.

## 3. Hallazgos criticos

No se confirmo un hallazgo CRITICO explotable en las superficies revisadas. No obstante, hay hallazgos ALTOS que deben resolverse antes de considerar el sistema listo para uso real amplio.

## 4. Hallazgos altos

### ALTO-1: Modulo Finanzas legacy sin empresa_id obligatorio ni permisos por empresa - Corregido

Archivo: `app/finanzas/page.tsx`

Evidencia:

- `obtenerMovimientos()` consulta `movimientos` sin filtro por `empresa_id`.
- `crearMovimiento()` inserta `movimientos` sin `empresa_id`, moneda ni empresa validada.
- El modulo restringe a `admin`, pero mezcla alcance global con datos financieros.

Impacto: puede crear movimientos sin empresa y afectar reportes operativos si se usa en paralelo con Contabilidad/Reportes.

Correccion posterior: `app/finanzas/page.tsx` ahora valida acceso antes de cargar, filtra empresas permitidas y operativas, consulta movimientos por `empresa_id`, exige empresa/moneda al crear, separa KPIs GTQ/USD, bloquea auditor solo lectura para mutaciones y anula con filtro `id + empresa_id`.

### ALTO-2: Tareas usa bucket publico de evidencias y updates solo por id - Corregido

Archivo: `app/tareas/page.tsx`

Evidencia:

- Sube archivos a bucket `evidencias` y obtiene URL publica con `getPublicUrl`.
- `completarTarea()` y `eliminarTarea()` actualizan por `.eq("id", id)` sin agregar `.eq("empresa_id", ...)`.
- La pantalla filtra localmente por empresas permitidas, pero el update depende de RLS para blindaje definitivo.

Correccion posterior: `app/tareas/page.tsx` ahora filtra empresas permitidas/operativas, consulta por `empresa_id`, completa/cancela con `id + empresa_id`, sube evidencias a `documentos-tramites`, audita creacion/completado/cancelacion/bloqueos de auditor, y no usa estado invalido `Cancelada`.

### ALTO-3: Auditoria de bloqueos dentro de RPC puede revertirse si luego se hace `raise exception` - Corregido parcialmente

Archivos:

- `sql/rpc_limpieza_empresas.sql`
- `sql/rpc_pagos_cxp_cxc.sql`

Evidencia:

- `rpc_limpieza_empresas.sql` inserta en `auditoria_eventos`/`intentos_bloqueados` y luego ejecuta `raise exception` cuando hay dependencias.
- `rpc_pagos_cxp_cxc.sql` intenta marcar idempotencia `fallida` dentro de `exception when others` y luego hace `raise`.

Impacto: en PostgreSQL, si la excepcion aborta la transaccion del RPC, esos cambios pueden no persistir. La UI recibe error, pero el registro de bloqueo/fallo puede perderse.

Correccion posterior: `sql/rpc_limpieza_empresas.sql` ahora devuelve `ok:false` en bloqueos esperados despues de auditar; `sql/rpc_pagos_cxp_cxc.sql` devuelve `ok:false` despues de marcar idempotencia `fallida` dentro de la operacion. `sql/rpc_rate_limit_operativo.sql` ya conservaba el patron correcto para limite excedido.

### ALTO-4: Modulo Usuarios legacy duplicado con Admin Operativo

Archivo: `app/usuarios/page.tsx`

Evidencia:

- Usa `/api/admin/perfiles` para crear perfiles.
- Antes de esta auditoria no enviaba `idempotency_key`; fue corregido.
- Sigue siendo un flujo paralelo al Admin Operativo, con menos controles de asignaciones.

Impacto: aumenta la superficie de administracion y puede confundir operadores.

Recomendacion: mantener solo para casos limitados o redirigir creacion/asignacion de usuarios al Admin Operativo.

## 5. Hallazgos medios

### MEDIO-1: Modulos grandes aun dependen parcialmente de validaciones frontend

Archivos: `app/cheques/page.tsx`, `app/ordenes-compra/page.tsx`, `app/importaciones/page.tsx`, `app/admin/page.tsx`

Hay idempotencia local/persistente y validaciones, pero muchas mutaciones directas se hacen desde cliente. Esto es aceptable solo si RLS y policies estan alineadas. Para produccion financiera, conviene mover acciones criticas a RPC transaccionales.

### MEDIO-2: Logs tecnicos en consola

Archivos: multiples `app/**` y `lib/**`

Hay muchos `console.error`/`console.warn`. En general no imprimen secretos, pero algunos pueden incluir objetos de Supabase o errores crudos. Riesgo medio en navegadores compartidos.

Recomendacion: normalizar logger seguro y mensajes resumidos.

### MEDIO-3: SQL versionado con grants amplios a `authenticated`

Archivos:

- `sql/seguridad_operativa.sql`
- `sql/monitoreo_alertas.sql`
- RPCs en `sql/*.sql`

Los grants se apoyan en RLS/policies y validaciones internas. No es necesariamente incorrecto, pero debe validarse en Supabase con `sql/auditoria_rls_control_plus.sql`.

### MEDIO-4: Limpieza de empresa usa excepcion controlada con DELETE

Archivo: `sql/rpc_limpieza_empresas.sql`

El `DELETE` esta acotado a empresa 100% vacia y es la unica excepcion documentada. Los bloqueos esperados devuelven `ok:false` para conservar auditoria/intentos bloqueados.

### MEDIO-5: Componentes de documentos relacionados no aplican rate limit de apertura

Archivo: `components/DocumentosEntidad.tsx`

Usa `obtenerUrlDocumento`, que valida bucket/ruta/estado, pero no aplica el helper `registrarRateLimitOperativo` que si existe en `app/documentos/page.tsx`.

## 6. Hallazgos bajos

- Hay mojibake en textos (`estÃ¡`, `auditorÃ­a`, etc.) en varios archivos; no bloquea seguridad pero afecta UX.
- `app/tareas/page.tsx` fue reescrito para usar cancelacion logica sin estado invalido; queda pendiente validar en Supabase que las columnas de cancelacion existan en todos los entornos.
- Algunas pantallas muestran alert/toast genericos; conviene un sistema de mensajes uniforme.

## 7. Hallazgos por modulo

### Dashboard

Revisado: `app/dashboard/page.tsx`.

Estado: filtra empresas operativas con `obtenerEmpresasOperativasDesdeIds`; no se observaron consultas antes de validar acceso.

### Admin

Revisado: `app/admin/page.tsx`, `app/api/admin/perfiles/route.ts`.

Estado: idempotencia persistente, anti doble envio, auditoria y proteccion contra quitar propio acceso administrativo. Se corrigio fallback de rate limit persistente en API.

### Monitoreo

Revisado: `app/monitoreo-sistema/page.tsx`, `sql/monitoreo_alertas.sql`.

Estado: restringido por rol admin; persistencia de alertas con RLS admin. Revisar que la tabla de logs opcional no exponga detalles sensibles si se habilita.

### Empresas

Revisado: `app/empresas/page.tsx`, `lib/empresasOperativas.ts`, `sql/rpc_limpieza_empresas.sql`.

Estado: crear/editar/archivar auditado; limpieza segura usa previsualizacion y RPC. Los bloqueos de eliminacion fisica devuelven JSON controlado y conservan auditoria.

### Proveedores y Clientes

Revisado: `app/proveedores/page.tsx`, `app/clientes/page.tsx`.

Estado: validan modulo, empresas permitidas, auditor solo lectura y auditoria. Tienen controles de duplicados y estado activo/inactivo.

### Cheques

Revisado: `app/cheques/page.tsx`.

Estado: idempotencia persistente/local, borradores, auditoria e historial. Filtra empresas/fondos/chequeras operativas. Por tamano del modulo, recomiendo pruebas funcionales intensivas por accion.

### Ordenes de compra

Revisado: `app/ordenes-compra/page.tsx`.

Estado: protege borradores, `borrador_id`, crear/firmar/observar con idempotencia, historial y auditoria. Validar en pruebas concurrencia de firmas multiples.

### Contabilidad

Revisado: `app/contabilidad/page.tsx`, `lib/contabilidadV2.ts`, `lib/estadosFinancieros.ts`.

Estado: separa asientos formales de movimientos operativos; valida moneda GTQ/USD y periodos. Mantener prueba controlada de cierre mensual antes de produccion.

### CxP/CxC

Revisado: `app/cuentas-pagar/page.tsx`, `app/cuentas-cobrar/page.tsx`, `sql/rpc_pagos_cxp_cxc.sql`.

Estado: pagos/anulaciones via RPC con idempotencia. El marcado `fallida` ahora se conserva porque la RPC devuelve `ok:false` en fallos esperados dentro de la operacion.

### Reportes

Revisado: `app/reportes/page.tsx`, `lib/reportesFinancieros.ts`.

Estado: empresas operativas, limites de exportacion, rate limit, auditoria y separacion de monedas en estados formales.

### Documentos

Revisado: `app/documentos/page.tsx`, `components/DocumentosEntidad.tsx`, `lib/documentosTramites.ts`.

Estado: bucket privado y signed URLs temporales. Pendiente: rate limit tambien en componente embebido.

### Historial

Revisado: `app/historial/page.tsx`.

Estado: consulta sensible auditada, exportaciones limitadas y rate limit. No hay borrado.

### Importaciones

Revisado: `app/importaciones/page.tsx`.

Estado: limites de archivo/filas, columnas, duplicados, idempotencia, rate limit y auditoria parcial. Requiere pruebas con datos reales por cada tipo.

### Calendario

Revisado: `app/calendario/page.tsx`, `lib/calendarioOperativo.ts`.

Estado: empresas operativas, eventos manuales y automaticos, acciones manuales acotadas. No se observo creacion en empresa archivada si el filtro operativo se mantiene.

### Reinicio controlado

Revisado: `app/reinicio-controlado/page.tsx`, `lib/reinicioControlado.ts`.

Estado: dry-run, confirmacion exacta, deteccion de empresa prueba/inactiva/archivada, no borra usuarios/permisos/auditoria/documentos. Requiere ejecucion solo por admin/jefe.

### Tareas y Finanzas

Revisado: `app/tareas/page.tsx`, `app/finanzas/page.tsx`.

Estado: `Tareas` fue reforzado con empresas operativas, evidencia privada, updates por `id + empresa_id`, auditoria y bloqueo de auditor solo lectura. `Finanzas` fue reforzado como capa operativa V1 segura por empresa; no crea asientos ni modifica Contabilidad V2 formal.

## 8. Archivos revisados

Se revisaron mediante lectura directa o busquedas dirigidas:

- `app/**/page.tsx`
- `app/api/admin/perfiles/route.ts`
- `components/DocumentosEntidad.tsx`
- `components/InactivitySessionGuard.tsx`
- `components/Sidebar.tsx`
- `lib/auditoria.ts`
- `lib/auth.ts`
- `lib/borradoresTrabajo.ts`
- `lib/calendarioOperativo.ts`
- `lib/contabilidadV2.ts`
- `lib/documentosTramites.ts`
- `lib/empresasOperativas.ts`
- `lib/estadosFinancieros.ts`
- `lib/exportaciones.ts`
- `lib/funcionesOperativas.ts`
- `lib/permisosEmpresas.ts`
- `lib/rateLimitOperativo.ts`
- `lib/reinicioControlado.ts`
- `lib/reportesFinancieros.ts`
- `lib/supabase.ts`
- `lib/validarAccesoModuloUsuario.ts`
- `lib/validarModuloActivo.ts`
- `lib/validarUsuarioActivo.ts`
- `proxy.ts`
- `package.json`
- `next.config.mjs`
- `tsconfig.json`
- `sql/*.sql`

## 9. Archivos modificados

- `app/usuarios/page.tsx`
- `app/api/admin/perfiles/route.ts`
- `docs/auditoria-total-controlplus.md`

## 10. Cambios aplicados

1. Se agrego `generarIdempotencyKeyCrearUsuario()` en `app/usuarios/page.tsx`.
2. El flujo legacy de creacion de perfil en Usuarios ahora envia `idempotency_key` con prefijo `controlplus_idempotency_admin:crear_usuario_operativo:`.
3. `/api/admin/perfiles` mantiene rate limit local si falla la RPC `registrar_rate_limit_operativo`, en lugar de cortar con 500.
4. `sql/rpc_limpieza_empresas.sql` devuelve JSON controlado para bloqueos esperados y conserva auditoria/intentos bloqueados.
5. `sql/rpc_pagos_cxp_cxc.sql` conserva idempotencia `fallida` devolviendo `ok:false` en vez de relanzar dentro del bloque transaccional.
6. `app/empresas/page.tsx`, `app/cuentas-pagar/page.tsx` y `app/cuentas-cobrar/page.tsx` manejan respuestas RPC `ok:false`.

## 11. SQL pendiente si aplica

Ejecutar/revisar en Supabase antes de prueba real:

- `sql/seguridad_operativa.sql`
- `sql/rpc_rate_limit_operativo.sql`
- `sql/rpc_pagos_cxp_cxc.sql`
- `sql/monitoreo_alertas.sql`
- `sql/rpc_limpieza_empresas.sql`

SQL recomendado pendiente:

- Revisar si se desea llevar el mismo patron JSON controlado a otras validaciones esperadas que hoy lanzan excepcion antes de escribir evidencia.

## 12. Pruebas ejecutadas

- `git diff --check`
- `npm run build`

## 13. Resultado de npm run build

Correcto.

Resumen:

- `next build` compilo correctamente.
- TypeScript finalizo sin errores.
- Se generaron 27 paginas estaticas.
- Proxy/Middleware quedo incluido en el build.

## 14. Resultado de git diff --check

Correcto.

Resultado:

- Sin errores de whitespace.
- Avisos esperados en Windows: Git indica que `LF` sera reemplazado por `CRLF` en los archivos TypeScript tocados cuando Git los procese.

## 15. Lista final de pendientes

1. Ampliar patron `ok:false` a validaciones esperadas adicionales si se desea evitar excepciones de negocio en RPCs.
2. Integrar rate limit de apertura en `components/DocumentosEntidad.tsx`.
3. Ejecutar y verificar SQL pendientes en Supabase.
4. Ejecutar pruebas funcionales con contador: crear empresa real, proveedor/cliente, OC, cheque, CxP/CxC, documento, reporte, tarea y cierre contable.
5. Revisar RLS real en Supabase con `sql/auditoria_rls_control_plus.sql`.
6. Reducir logs tecnicos crudos en navegador.

## 16. Recomendacion listo/no listo

No listo para carga real completa.

Listo para prueba controlada con contador si:

- Se usa `Finanzas` solo como capa operativa V1 reforzada, por empresa y sin mezclar monedas.
- Se validan los flujos reforzados de `Tareas` con evidencia privada y movimiento operativo opcional.
- Se ejecutan los SQL pendientes.
- Se prueba el flujo completo con una empresa real nueva y datos acotados.
