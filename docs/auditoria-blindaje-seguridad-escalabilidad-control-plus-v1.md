# Auditoria defensiva de seguridad y escalabilidad - Control+ V1

Fecha: 2026-07-09  
Rama revisada: `security/auditoria-blindaje-control-plus-v1`  
Alcance: auditoria estatica defensiva sobre Next.js, TypeScript, Supabase y Vercel. No se hicieron pruebas ofensivas, fuerza bruta, ataques externos ni cambios en SQL, RLS, autenticacion, estructura de base de datos o `.env.local`.

## Resumen ejecutivo

Control+ V1 muestra una base razonable para una prueba operativa controlada: hay validaciones de sesion en rutas principales, validacion de modulo en paginas sensibles, roles visibles limitados en interfaz, controles de idempotencia en flujos criticos como cheques, ordenes de compra y creacion administrativa de perfiles, y no se encontro uso de `service_role` en componentes cliente.

La plataforma no debe considerarse lista para produccion abierta sin una fase de hardening tecnico. Los principales riesgos estan en cobertura incompleta de proteccion por `proxy.ts`, ausencia de headers de seguridad configurados en Next/Vercel, paginacion desigual para crecimiento alto, rate limiting no uniforme y dependencia fuerte de RLS/validaciones por pagina para aislar empresas.

Recomendacion: listo para pasar a hardening tecnico controlado. No listo para produccion amplia hasta cerrar los puntos criticos y validar RLS con Supabase activo.

## Riesgos criticos

1. Cobertura incompleta de rutas protegidas en `proxy.ts`.
   - `proxy.ts` protege rutas principales como `dashboard`, `usuarios`, `empresas`, `cheques`, `ordenes-compra`, `documentos`, `reportes` y `monitoreo-sistema`.
   - Existen rutas reales no incluidas en el matcher, como `auxiliar`, `impuestos`, `conciliacion-bancaria`, `activos-fijos`, `flujo-efectivo`, `planilla` y `proyectos`.
   - En esas rutas la defensa depende de validaciones dentro de pagina, helpers y RLS. Debe verificarse de forma sistematica que ninguna ruta sensible quede accesible solo por UI.

2. No hay headers de seguridad configurados en `next.config.mjs`.
   - `next.config.mjs` esta sin configuracion de headers.
   - Falta definir politica para CSP, `X-Frame-Options` o `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` y endurecimiento de recursos externos.
   - Para una plataforma empresarial interna, esto debe cerrarse antes de produccion.

3. Riesgo de aislamiento multiempresa si RLS o filtros por `empresa_id` fallan.
   - Muchas pantallas filtran por empresas permitidas desde frontend/helpers.
   - El control final debe vivir en RLS, RPCs y validacion server-side.
   - Cuando Supabase este activo, es obligatorio ejecutar pruebas negativas: usuario de empresa A intentando leer, listar, modificar o exportar datos de empresa B.

## Riesgos medios

1. Rate limiting e idempotencia desiguales.
   - `app/api/admin/perfiles/route.ts` tiene rate limiting e idempotencia.
   - Cheques y ordenes de compra tienen protecciones contra doble envio.
   - Subidas, importaciones, impuestos, conciliacion bancaria, creacion de empresas y exportaciones deben revisarse para bloqueo visual, idempotencia persistente y limites por usuario/empresa/IP.

2. Paginacion y carga inicial no uniformes.
   - Algunas pantallas tienen limites defensivos: documentos, reportes, auxiliar y monitoreo.
   - Otras areas pueden crecer con consultas por empresa o por listas completas y sufrir con cientos de empresas o miles de usuarios.
   - Se recomienda paginacion server-side, filtros obligatorios y agregaciones por RPC antes de escalar.

3. Uso de `window.document.write` para exportaciones imprimibles.
   - `lib/exportaciones.ts` escapa campos con `escaparHtml`, lo que reduce el riesgo.
   - Aun asi, la generacion de HTML imprimible debe mantenerse como superficie controlada y no aceptar HTML arbitrario.

4. Eliminacion fisica de empresas vacias.
   - `app/empresas/page.tsx` conserva un flujo destructivo condicionado para empresas sin dependencias.
   - Debe mantenerse fuera de registros contables oficiales y con auditoria clara.

5. Errores tecnicos visibles.
   - Se corrigieron mensajes puntuales de API/UI para evitar mostrar `UID`, proveedor interno o errores tecnicos como mensaje principal.
   - Aun quedan mensajes tecnicos en consola, metadata de auditoria o secciones secundarias; deben revisarse por flujo antes de demos empresariales.

## Riesgos bajos

1. Uso de identificadores internos en codigo.
   - Hay uso legitimo de UUIDs para idempotencia, perfiles y entidades.
   - El riesgo no es su existencia sino mostrarlos como mensaje principal al usuario final.

2. Logs de soporte.
   - Se observan `console.warn` y `console.error` en varios modulos.
   - No deben eliminarse a ciegas; conviene normalizar mensajes de UI y dejar detalle tecnico solo en consola o auditoria interna.

3. Enlaces externos.
   - Los `window.open` revisados usan `noopener,noreferrer`.
   - Debe mantenerse el mismo criterio para cualquier nuevo preview o exportacion.

## Archivos revisados

- `proxy.ts`
- `next.config.mjs`
- `app/api/admin/perfiles/route.ts`
- `app/admin/page.tsx`
- `app/usuarios/page.tsx`
- `app/dashboard/page.tsx`
- `app/empresas/page.tsx`
- `app/documentos/page.tsx`
- `components/DocumentosEntidad.tsx`
- `app/cheques/page.tsx`
- `app/ordenes-compra/page.tsx`
- `app/reportes/page.tsx`
- `app/auxiliar/page.tsx`
- `app/monitoreo-sistema/page.tsx`
- `app/impuestos/page.tsx`
- `app/conciliacion-bancaria/page.tsx`
- `lib/supabase.ts`
- `lib/exportaciones.ts`
- `lib/reportesFinancieros.ts`
- `.gitignore`
- `package.json`

## Archivos modificados

- `app/api/admin/perfiles/route.ts`
  - Se suavizaron mensajes tecnicos de API para no exponer `UID`, proveedor interno o detalles de autenticacion como texto principal.
- `app/admin/page.tsx`
  - Se suavizaron textos visibles de creacion de usuario operativo.
- `app/usuarios/page.tsx`
  - Se suavizaron textos visibles de identificador interno.
- `docs/auditoria-blindaje-seguridad-escalabilidad-control-plus-v1.md`
  - Documento de auditoria defensiva.

## Hallazgos de control de acceso

- `proxy.ts` valida sesion para un grupo importante de rutas, pero no cubre todas las rutas reales del proyecto.
- La documentacion de Next.js 16 para `proxy.ts` indica que debe usarse como chequeo optimista y no como unico control de autorizacion.
- Varias paginas sensibles usan validaciones de modulo, perfil activo y empresa permitida.
- `app/api/admin/perfiles/route.ts` valida sesion, perfil activo, rol creador permitido, rol asignable, idempotencia y rate limiting.
- Riesgo pendiente: confirmar con Supabase activo que cada lectura/escritura de datos por `empresa_id` esta protegida por RLS, no solo por filtros de UI.
- Riesgo pendiente: probar manipulacion defensiva de IDs en URL, formularios y requests internos sin ejecutar ataques reales ni tocar datos productivos.

## Hallazgos de roles

- Roles visibles confirmados en interfaz:
  - `jefe`
  - `supervisor`
  - `contador`
  - `auxiliar`
  - `auditor`
- `admin` aparece como rol interno operativo para autorizacion de alto nivel, pero no como rol asignable normal desde interfaz.
- `app/api/admin/perfiles/route.ts` refuerza server-side que solo se asignen los roles visibles permitidos.
- Riesgo pendiente: auditar todas las rutas API futuras para evitar depender solamente de ocultar botones o menus en UI.

## Hallazgos de claves y variables de entorno

- No se encontro `.env.local` versionado.
- `.gitignore` ignora `.env*`.
- `SUPABASE_SERVICE_ROLE_KEY` aparece en `app/api/admin/perfiles/route.ts`, del lado servidor.
- No se encontro `service_role` en componentes cliente.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se usan como claves publicas esperadas.
- No se modificaron claves ni variables.
- Riesgo pendiente: validar en Vercel que `SUPABASE_SERVICE_ROLE_KEY` solo exista como variable server-side y que no se exponga por prefijo `NEXT_PUBLIC_`.

## Hallazgos de anti-repeticiones

- Cheques y ordenes de compra muestran controles de idempotencia y estados de procesamiento para evitar doble submit.
- Creacion administrativa de perfiles usa `idempotency_key`, limite operativo por IP/usuario y registro persistente.
- Documentos y reportes tienen limites y controles para exportacion repetida.
- Riesgo pendiente: fortalecer idempotencia persistente en flujos de empresas, impuestos, conciliacion, importaciones y subida de archivos si pasan a uso intensivo.
- Recomendacion: cada accion sensible debe tener bloqueo visual, idempotency key persistente y respuesta humana en caso de duplicado.

## Hallazgos de exposicion tecnica

- Se corrigieron mensajes visibles relacionados con `UID`, proveedor interno y errores tecnicos de creacion de perfiles.
- `monitoreo-sistema` mantiene una vista humana primero y deja detalle tecnico en zonas secundarias.
- No se encontro `dangerouslySetInnerHTML` en `app`, `components` o `lib`.
- `lib/exportaciones.ts` usa `document.write` para una ventana imprimible, con escape de HTML en datos dinamicos revisados.
- Riesgo pendiente: revisar todos los `error.message` que llegan a `toast`, estados vacios o alertas para evitar JSON crudo, trazas o mensajes de proveedor.

## Hallazgos de seguridad frontend

- Falta configuracion global de headers de seguridad.
- Los `window.open` revisados incluyen `noopener,noreferrer`.
- No se detecto uso directo de `dangerouslySetInnerHTML`.
- Las vistas de documentos usan URLs firmadas/obtenidas por helpers; cuando Supabase este activo debe validarse expiracion, permisos de bucket y acceso por empresa.
- Recomendacion: definir una politica CSP compatible con Next/Vercel y revisar previews de archivos para tipos MIME permitidos.

## Hallazgos de rate limiting y abuso

- Existe rate limiting especifico en `app/api/admin/perfiles/route.ts`.
- Deben agregarse limites en capa Vercel/WAF o middleware equivalente para:
  - login y recuperacion de acceso
  - creacion de usuarios
  - subida de documentos
  - exportacion/generacion de reportes
  - acciones contables sensibles
  - endpoints administrativos
- No se implemento WAF ni servicio externo en esta auditoria.

## Hallazgos de escalabilidad

- Documentos, reportes, auxiliar y monitoreo ya usan limites defensivos en varias consultas.
- El riesgo principal esta en crecimiento multiempresa: listas por `empresa_id`, dashboards con multiples fuentes, tablas grandes y exportaciones.
- Tablas de alto crecimiento esperado:
  - documentos
  - cheques
  - movimientos
  - tareas
  - auditoria/eventos
  - ordenes de compra
  - impuestos
  - usuarios/perfiles
  - empresas
- Riesgo con cientos de empresas:
  - consultas con `.in("empresa_id", ids)` muy grandes
  - dashboards agregando demasiadas fuentes
  - permisos calculados muchas veces desde cliente
- Riesgo con miles de usuarios:
  - busquedas sin indice suficiente
  - tablas administrativas sin paginacion server-side
  - rate limiting por memoria en instancias serverless si no hay respaldo persistente
- Recomendacion: filtros obligatorios por empresa/fecha/estado, paginacion server-side, cursores, indices por `empresa_id`, `created_at`, `fecha`, `estado`, RPCs agregadas y virtualizacion de tablas grandes.

## Hallazgos de eliminacion y acciones destructivas

- No se encontro `.delete()` directo en `app`, `components` o `lib` durante esta auditoria.
- Se identifico flujo de eliminacion de empresas vacias en `app/empresas/page.tsx`.
- Recomendacion: para registros oficiales como cheques, pagos, impuestos, documentos fiscales, asientos y cierres, mantener anulacion, archivo o reversa, no borrado fisico sin trazabilidad.

## Recomendaciones para Supabase cuando este activo

1. Ejecutar pruebas negativas de RLS por empresa y por rol.
2. Validar politicas de storage y expiracion de signed URLs.
3. Revisar grants de RPCs y funciones administrativas.
4. Confirmar indices para tablas de alto volumen.
5. Activar observabilidad de consultas lentas y revisar `pg_stat_statements` si esta disponible.
6. Probar usuario sin empresa activa, usuario inactivo, rol sin permiso y empresa suspendida.
7. Verificar que `service_role` solo se use en rutas servidor y nunca en cliente.

## Recomendaciones para Vercel/WAF

1. Configurar headers de seguridad globales.
2. Definir rate limiting para APIs administrativas, subida de archivos, reportes y login.
3. Limitar tamano de requests para uploads y APIs sensibles.
4. Activar proteccion contra bots si la app queda expuesta a internet.
5. Considerar allowlist por IP o acceso privado si sera una plataforma interna.
6. Registrar errores con identificador de soporte, no con traza visible al usuario.

## Que NO se toco por seguridad

- No se modifico SQL.
- No se modifico RLS.
- No se modifico autenticacion.
- No se modifico estructura de base de datos.
- No se modifico `.env.local`.
- No se agregaron modulos nuevos.
- No se agregaron automatizaciones grandes.
- No se implemento WAF ni rate limiting externo.
- No se hicieron pruebas ofensivas reales.
- No se uso `git add .`.
- No se hizo commit.

## Proximos pasos ordenados

1. Completar cobertura de rutas protegidas y validar server-side cada modulo sensible.
2. Configurar headers de seguridad en Next/Vercel.
3. Ejecutar suite de pruebas negativas de RLS con Supabase activo.
4. Revisar idempotencia persistente en empresas, impuestos, conciliacion e importaciones.
5. Agregar paginacion server-side y filtros obligatorios a tablas de crecimiento alto.
6. Definir limites WAF/rate limiting para endpoints y acciones sensibles.
7. Revisar mensajes `error.message` visibles por flujo y normalizarlos.
8. Validar storage, previews y tipos de archivo permitidos.
9. Documentar politica contable de anulacion/archivo/reversa para registros oficiales.

## Verificaciones finales

- `npx tsc --noEmit`: exitoso, sin errores.
- `npm run build`: exitoso con Next.js 16.2.6 y Turbopack. Compilo correctamente, ejecuto TypeScript, genero 34 paginas estaticas y dejo `app/api/admin/perfiles` como ruta dinamica.
- `git status`: ejecutado al cierre de la auditoria. Hay cambios locales sin commit en los archivos listados en "Archivos modificados".
