# Limpieza IA Control+ V1

Fecha: 2026-07-09  
Rama: `hardening/limpieza-ia-control-plus-v1`  
Objetivo: limpieza segura de textos, detalles tecnicos visibles y restos ligeros de deuda generada, sin agregar funciones ni tocar base de datos.

## Archivos revisados

- `app/dashboard/page.tsx`
- `app/usuarios/page.tsx`
- `app/empresas/page.tsx`
- `app/cheques/page.tsx`
- `app/reportes/page.tsx`
- `app/auxiliar/page.tsx`
- `app/monitoreo-sistema/page.tsx`
- `app/documentos/page.tsx`
- `app/impuestos/page.tsx`
- `app/conciliacion-bancaria/page.tsx`
- `app/ordenes-compra/page.tsx`
- `components/Sidebar.tsx`
- `components/InactivitySessionGuard.tsx`
- `components/DocumentosEntidad.tsx`
- `lib/*` en busquedas de seguridad y restos tecnicos

## Archivos modificados

- `app/documentos/page.tsx`
- `app/impuestos/page.tsx`
- `app/conciliacion-bancaria/page.tsx`
- `app/ordenes-compra/page.tsx`
- `docs/limpieza-ia-control-plus-v1.md`

## Problemas encontrados

- `app/documentos/page.tsx` mostraba metadatos con `JSON.stringify` dentro de la tabla principal. Aunque estaba en un `details`, exponia JSON crudo al usuario.
- `app/impuestos/page.tsx` tenia placeholders visibles con terminos tecnicos como `UUID`, `ID texto` y `Impuesto ID`.
- `app/conciliacion-bancaria/page.tsx` tenia un mensaje de validacion que mencionaba `UUID valido` y un rotulo tecnico con acento susceptible a mojibake en consola.
- `app/ordenes-compra/page.tsx` mostraba `error.message` crudo en varios toasts de borradores y operaciones.
- Se revisaron textos mal codificados tipo `DÃ`, `Ã`, `Â`; no quedaron coincidencias en las paginas principales revisadas despues de la limpieza.
- No se encontraron `console.log` ni `debugger` en la revision focal.
- No se encontraron nuevas llamadas `.delete()` en `app`, `components` o `lib`.

## Correcciones aplicadas

- En Documentos, el detalle de metadatos ahora se presenta como `Detalle tecnico`, con lista resumida y filtrada:
  - no imprime JSON crudo;
  - omite claves sensibles o identificadores;
  - resume objetos anidados como `Detalle registrado`.
- En Impuestos, los placeholders tecnicos se cambiaron por textos de usuario:
  - `Impuesto ID` -> `Codigo de impuesto`;
  - `Cuenta contable UUID` -> `Cuenta contable relacionada`;
  - `Proveedor ID texto` -> `Proveedor relacionado`;
  - `Cliente ID texto` -> `Cliente relacionado`;
  - `Responsable UUID` -> `Responsable relacionado`.
- En Conciliacion bancaria, el error de identificador interno ya no menciona UUID.
- En Ordenes de compra, los toasts ya no muestran `error.message` crudo en recuperacion, descarte, autoguardado, creacion, firma y observacion.
- Se normalizaron textos de orden reutilizada para evitar problemas de codificacion.

## Riesgos pendientes

- Monitoreo Sistema conserva `JSON.stringify` para hash/localStorage y resumen tecnico secundario. No se cambio porque no aparece como mensaje principal al usuario.
- Persisten logs tecnicos con `console.warn` y `console.error` en varios modulos; se dejaron porque sirven para soporte durante prueba controlada.
- Hay deuda preexistente de lint/React Compiler en paginas grandes; no se corrigio para evitar refactor masivo.
- Algunos flujos aun requieren datos reales de Supabase para validar experiencia completa; Supabase puede estar pausado durante esta limpieza.

## Cosas que NO se tocaron por seguridad

- No se tocaron SQL, RLS, politicas de Supabase ni estructura de base de datos.
- No se modifico autenticacion.
- No se modifico `.env.local`.
- No se agregaron modulos nuevos.
- No se agregaron automatizaciones grandes.
- No se agrego `.delete()` nuevo.
- No se habilito borrado destructivo.
- No se actualizaron dependencias.
- No se ejecuto `npm audit fix --force`.
- No se hizo commit automatico.
- No se uso `git add .`.

## Verificaciones

### TypeScript

Comando:

```bash
npx tsc --noEmit
```

Resultado: aprobado.

### Build

Comando:

```bash
npm run build
```

Resultado: aprobado.

Resumen:

- Compilacion optimizada correcta.
- TypeScript dentro del build correcto.
- Generacion estatica correcta: 34/34 paginas.
- API detectada: `/api/admin/perfiles`.
- Proxy detectado.

## Recomendacion

La rama puede cerrarse si el build final aprueba y el equipo acepta mantener como pendientes los logs tecnicos y la deuda de lint/React Compiler para una fase posterior. Esta limpieza no cambia reglas de negocio ni seguridad de base de datos.
