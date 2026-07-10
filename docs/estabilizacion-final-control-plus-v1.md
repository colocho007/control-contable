# Estabilizacion final Control+ V1

Fecha: 2026-07-09  
Rama: `hardening/estabilizacion-final-control-plus-v1`  
Objetivo: estabilizacion final para prueba operativa controlada y presentacion empresarial.

## Alcance aplicado

Se trabajo sin agregar modulos nuevos, sin crear CRM/RRHH/asistente/firma digital/n8n, sin tocar SQL, RLS, autenticacion, politicas de Supabase ni estructura de base de datos.

No se uso `git add .` y no se hizo commit automatico.

## Archivos revisados

- `app/dashboard/page.tsx`
- `app/cheques/page.tsx`
- `app/reportes/page.tsx`
- `app/auxiliar/page.tsx`
- `app/monitoreo-sistema/page.tsx`
- `app/admin/page.tsx`
- `app/usuarios/page.tsx`
- `app/api/admin/perfiles/route.ts`
- `components/Sidebar.tsx`
- `components/InactivitySessionGuard.tsx`
- `package.json`
- Documentacion local de Next.js 16 en `node_modules/next/dist/docs/`

## Problemas encontrados

### Build y TypeScript

- `npx tsc --noEmit` finalizo sin errores.
- `npm run build` finalizo correctamente con Next.js 16.2.6.
- El primer intento de build en paralelo agoto el tiempo configurado, pero al ejecutarlo aislado con mas margen completo correctamente.

### Consola y experiencia de presentacion

- El Dashboard mostraba toasts de error por fallos secundarios de metricas/listas. Eso podia ensuciar la presentacion aunque la sesion ya estuviera validada.
- Cheques mostraba mensajes crudos derivados de `error.message` en varios flujos.
- Cheques usaba `window.location.href` en salidas de acceso.
- Habia textos visibles con acentos que podian verse mal segun codificacion/consola en Dashboard, Auxiliar y Monitoreo.

### Dashboard

- La validacion principal ya liberaba la pantalla despues de confirmar sesion/perfil.
- La carga secundaria de empresas, tareas, movimientos, ordenes y cheques todavia podia mostrar error global al usuario.

### Usuarios y roles

- La UI ya mantenia visibles solamente estos roles: `Jefe`, `Supervisor`, `Contador`, `Auxiliar`, `Auditor`.
- `app/api/admin/perfiles/route.ts` ya restringia roles asignables a `jefe`, `supervisor`, `contador`, `auxiliar`, `auditor`.
- Los perfiles `admin` existentes se conservan como control interno y se filtran de la administracion normal de usuarios.

### Cheques, Reportes, Auxiliar y Monitoreo

- No se encontraron `console.log` ni `debugger` en la revision focal.
- No se agregaron llamadas `.delete()`.
- Monitoreo ya tenia detalle tecnico en panel secundario; se conservaron los detalles tecnicos fuera de la vista primaria.
- Queda deuda de lint/React Compiler preexistente por funciones usadas antes de declararse, `Date.now()` en render y `any` en modulos grandes.

## Problemas corregidos

### Dashboard

- Los errores secundarios de carga operativa ya no bloquean la pantalla ni muestran toasts tecnicos al usuario.
- Si falla la carga secundaria, el Dashboard limpia empresas, tareas, movimientos, ordenes y cheques para mostrar estados vacios.
- Se corrigieron textos visibles de validacion tardia y comentarios visibles para evitar problemas de codificacion.

### Cheques

- Las redirecciones de acceso ahora usan `router.replace`.
- Los toasts principales de error ya no muestran `error.message` crudo al usuario.
- Se dejaron mensajes humanos para fallos de borrador, fondo, chequera, creacion, autorizacion, rechazo, anulacion y pago.

### Auxiliar

- Se ajusto el mensaje de acceso y el estado sin empresas a un texto humano: `Sin datos disponibles para esta empresa.`

### Reportes

- Se ajusto el estado sin empresas operativas a: `Sin datos disponibles para esta empresa.`

### Monitoreo Sistema

- Se ajustaron textos humanos principales a ASCII limpio para evitar mojibake en presentacion.
- Se mantuvo la jerarquia: que paso, modulo, riesgo, estado, fecha y accion recomendada primero; detalle tecnico separado.

## Riesgos pendientes

### Lint / React Compiler

La revision focal con ESLint aun reporta deuda preexistente en varios archivos. No bloquea el build, pero conviene planificar una fase posterior de limpieza.

Ejemplos:

- Funciones usadas antes de declararse en Dashboard, Auxiliar, Reportes y Cheques.
- `Date.now()`/`Math.random()` marcados por reglas de pureza en Cheques/Reportes/Guard.
- `setState` sincronico en effects en Sidebar/Monitoreo.
- `any` y funciones no usadas en Cheques y librerias grandes.

Corregir todo esto implicaria mover funciones, extraer hooks o refactorizar modulos grandes. No se hizo para no redisenar arquitectura ni tocar logica sensible.

### Dependencias

`npm audit --omit=dev` sigue reportando:

- `xlsx`: severidad alta, Prototype Pollution y ReDoS, sin fix disponible.
- `postcss` via `next`: severidad moderada. `npm audit` sugiere `--force`, pero eso propone una version incompatible/breaking de Next.

No se ejecuto `npm audit fix --force` y no se actualizaron dependencias mayores.

### Seguridad/produccion

- La seguridad real sigue dependiendo de Supabase/RLS/RPC ya existentes. No se tocaron SQL, RLS ni autenticacion.
- Debe validarse con usuarios reales que auditor, auxiliar, contador, jefe y supervisor tengan permisos correctos.
- Debe validarse que `xlsx` se use solo con archivos controlados o con mitigaciones operativas durante la prueba.

## Resultado de build

Comando ejecutado:

```bash
npm run build
```

Resultado:

- Compilacion optimizada: correcta.
- TypeScript durante build: correcto.
- Generacion de paginas estaticas: 34/34 correcta.
- API route detectada: `/api/admin/perfiles`.
- Proxy detectado.

Estado: **build aprobado**.

## Recomendacion final

Control+ V1 queda **listo para prueba operativa controlada y presentacion empresarial**, con reservas.

No se recomienda declararlo listo para produccion abierta hasta cerrar o aceptar formalmente:

- Deuda ESLint/React Compiler.
- Riesgo de `xlsx` sin fix disponible.
- Validacion operativa con usuarios reales y datos representativos.
- Evidencia de permisos/RLS/RPC en el entorno Supabase correcto.
