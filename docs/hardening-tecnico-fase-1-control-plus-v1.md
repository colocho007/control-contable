# Hardening tecnico Fase 1 - Control+ V1

Fecha: 2026-07-09  
Rama revisada: `security/hardening-tecnico-fase-1-control-plus-v1`  
Base: `docs/auditoria-blindaje-seguridad-escalabilidad-control-plus-v1.md`

## Resumen

Se aplicaron correcciones defensivas pequenas para cerrar los hallazgos mas directos de la auditoria: headers de seguridad en Next.js, mayor cobertura de rutas internas en `proxy.ts` y mensajes humanos para evitar exposicion de identificadores tecnicos en errores visibles.

No se hicieron cambios en SQL, RLS, autenticacion de Supabase, estructura de base de datos, `.env.local`, dependencias ni modulos nuevos.

## Archivos revisados

- `docs/auditoria-blindaje-seguridad-escalabilidad-control-plus-v1.md`
- `next.config.mjs`
- `proxy.ts`
- `app/api/admin/perfiles/route.ts`
- `app/admin/page.tsx`
- `app/usuarios/page.tsx`
- `app/dashboard/page.tsx`
- `app/documentos/page.tsx`
- `app/cheques/page.tsx`
- `app/impuestos/page.tsx`
- `app/conciliacion-bancaria/page.tsx`
- `app/ordenes-compra/page.tsx`
- `app/reportes/page.tsx`
- `app/auxiliar/page.tsx`
- `app/monitoreo-sistema/page.tsx`
- `lib/documentosTramites.ts`
- Documentacion local de Next.js 16 en `node_modules/next/dist/docs`

## Archivos modificados

- `next.config.mjs`
- `proxy.ts`
- `app/admin/page.tsx`
- `lib/documentosTramites.ts`
- `docs/hardening-tecnico-fase-1-control-plus-v1.md`

Nota: `app/api/admin/perfiles/route.ts` y `app/usuarios/page.tsx` ya tenian correcciones de mensajes provenientes de la auditoria previa y fueron revisados sin nuevos cambios en esta fase.

## Headers agregados

Se agrego configuracion global de headers en `next.config.mjs` con:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

La CSP aplicada es conservadora y compatible con Next.js/Supabase/Vercel:

- Permite recursos propios con `default-src 'self'`.
- Permite scripts y estilos inline por compatibilidad con Next.js sin nonce/SRI en esta fase.
- Permite imagenes, media y conexiones hacia `https://*.supabase.co` y `wss://*.supabase.co`.
- Bloquea objetos embebidos con `object-src 'none'`.
- Bloquea framing externo con `frame-ancestors 'none'` y `X-Frame-Options: DENY`.

Pendiente: endurecer CSP en una fase posterior con nonce o SRI si se valida que no rompe hidratacion, estilos, previews, PWA ni Supabase.

## Rutas protegidas revisadas

Se reviso y amplio la cobertura de `proxy.ts`.

Rutas solicitadas confirmadas como protegidas:

- `/dashboard`
- `/admin`
- `/usuarios`
- `/empresas`
- `/documentos`
- `/cheques`
- `/impuestos`
- `/conciliacion-bancaria`
- `/ordenes-compra`
- `/reportes`
- `/auxiliar`
- `/monitoreo-sistema`
- `/contabilidad`
- `/cuentas-pagar`
- `/cuentas-cobrar`
- `/finanzas`
- `/historial`
- `/tareas`

Rutas internas adicionales incluidas por cobertura defensiva:

- `/activos-fijos`
- `/flujo-efectivo`
- `/planilla`
- `/proyectos`
- `/clientes`
- `/proveedores`
- `/importaciones`
- `/calendario`
- `/reinicio-controlado`
- `/empleados`

Se mantuvo `/login` como ruta publica necesaria, con redireccion a `/dashboard` cuando ya hay sesion valida. No se agrego bloqueo a assets, `_next`, favicon ni recursos publicos.

## Riesgos corregidos

1. Ausencia de headers de seguridad.
   - Se agregaron headers defensivos globales en `next.config.mjs`.

2. Cobertura incompleta de proxy para rutas internas.
   - Se incluyeron rutas reales que estaban fuera de `protectedRoutes` y del matcher.

3. Mensajes visibles con detalle interno en respaldo documental.
   - `lib/documentosTramites.ts` ya no expone `entidad_id`, modulo, tipo o ID interno en errores que pueden llegar a toast.

4. Error visible al guardar permisos administrativos.
   - `app/admin/page.tsx` muestra un mensaje humano y deja el detalle tecnico para consola/auditoria.

## Validacion defensiva ligera

- `app/api/admin/perfiles/route.ts` mantiene `ROLES_ASIGNABLES` limitado a:
  - `jefe`
  - `supervisor`
  - `contador`
  - `auxiliar`
  - `auditor`
- `app/admin/page.tsx` mantiene `ROLES_VISIBLES` sin `admin`.
- `app/usuarios/page.tsx` mantiene `ROLES_VISIBLES` sin `admin`.
- `admin` se conserva como rol interno operativo para autorizacion, no como rol normal asignable desde interfaz.
- No se agregaron roles nuevos.

## Riesgos pendientes

1. CSP aun conservadora.
   - `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'` quedan por compatibilidad.
   - Requiere fase posterior con nonce/SRI y pruebas visuales/navegador.

2. Proxy no reemplaza autorizacion real.
   - La validacion final debe seguir en servidor, helpers y RLS.
   - Con Supabase activo deben ejecutarse pruebas negativas por empresa, rol y modulo.

3. Rate limiting y WAF.
   - No se implemento WAF ni rate limiting externo.
   - Debe configurarse en Vercel/capa perimetral para login, API administrativa, uploads y reportes.

4. Errores visibles restantes.
   - Quedan usos de `getErrorMessage(error)` en flujos administrativos que parecen humanos por validaciones locales, pero deben revisarse con datos reales y Supabase activo.

5. Escalabilidad.
   - Esta fase no agrega paginacion server-side ni cambios de indices.
   - Siguen pendientes filtros obligatorios, paginacion y pruebas con volumen.

## Cosas que NO se tocaron por seguridad

- SQL
- RLS
- Autenticacion de Supabase
- `.env.local`
- Estructura de base de datos
- Dependencias mayores
- `npm audit fix --force`
- Modulos nuevos
- Pruebas ofensivas
- Fuerza bruta, exploits o ataques
- `git add .`
- Commits automaticos

## Verificaciones finales

- `npx tsc --noEmit`: exitoso, sin errores.
- `npm run build`: exitoso con Next.js 16.2.6 y Turbopack. Compilo correctamente, ejecuto TypeScript y genero 34 paginas estaticas.
- `git status`: ejecutado al cierre. Hay cambios locales sin staging en los archivos de esta fase.

## Recomendacion final

Se recomienda cerrar la rama de hardening tecnico Fase 1 despues de revision humana. La rama queda apta para avanzar a una Fase 2 enfocada en CSP estricta, pruebas negativas de RLS con Supabase activo, rate limiting/WAF y paginacion server-side.
