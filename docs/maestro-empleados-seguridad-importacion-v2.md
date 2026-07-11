# Maestro de Empleados: seguridad e importación V2

Fecha: 2026-07-11  
Rama: `feature/maestro-empleados-seguridad-importacion-v2`  
Migración creada pero no ejecutada: `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql`.

## Estado anterior y esquema detectado

Esta rama no contenía la pantalla V1: `/empleados` volvía a redirigir a `/usuarios`. `empleados_planilla` está definido en `sql/planilla_base.sql` y usado desde Planilla con identificación mínima, ingreso/retiro, puesto/área, contrato, jornada, salario y campos bancarios de texto. Los scripts locales proponen RLS por empresa, escritura para Jefe/Supervisor o funciones `auxiliar_contable`/`contador_revisor`, auditor de solo lectura y DELETE bloqueado.

Hay tres realidades que no deben confundirse:

1. El repositorio define tablas, índices y policies propuestas.
2. El código V2 espera además `version` y las RPC V2.
3. Solo una inspección autorizada de Supabase puede confirmar qué está desplegado. La UI muestra un mensaje humano si la migración todavía no existe.

### Corrección de la auditoría bloqueante

La primera propuesta se descartó antes de ejecutarse. Tenía SQL demasiado compactado, `search_path` inseguro, referencias sin esquema, casts capaces de abortar lotes, idempotencia global, confianza en decisiones del navegador, duplicados resueltos con el primer resultado, updates sin versión por fila y un snapshot histórico demasiado amplio. El mismo archivo fue reescrito en UTF-8 porque nunca se ejecutó ni comprometió. El `UPDATE` final de importaciones ahora asigna explícitamente empresa_ids, estado mediante CASE/END, creados, actualizados, omitidos, rechazados, completado_at y resultado.

Tipos confirmados en el repositorio: `empleados_planilla.id` y `perfiles.id` son UUID; `empresa_id` es bigint. Policies y código comparan `perfiles.id = auth.uid()`, pero no se detectó una FK versionada directa a `auth.users`; esa convención debe verificarse remotamente. `usuario_empresas` y `usuario_funciones_operativas` relacionan usuario y empresa, y los scripts de integridad usan FK compuestas `(empleado_id, empresa_id)`.

## Archivos modificados

- `app/empleados/page.tsx`: maestro separado, listado, ficha manual e importación.
- `components/ImportarEmpleadosExcel.tsx`: flujo de plantilla, validación, preview, confirmación e historial.
- `components/Sidebar.tsx`: entrada Empleados separada de Usuarios.
- `lib/empleadosExcel.ts`: generación y lectura defensiva de XLSX.
- `app/globals.css`: contraste oscuro encapsulado.
- Migración y este documento.

## Migración propuesta

La migración es aditiva y compatible con `empleados_planilla`. Agrega datos personales/contacto/laborales faltantes, `version`, `origen_registro` e `importacion_id`; no renombra ni elimina columnas. Crea:

- `importaciones_empleados` y `importaciones_empleados_filas`;
- `empleados_historial`, sin valores completos de DPI/NIT/IGSS/cuenta/salario;
- `empleados_cuentas_bancarias`, que guarda máscara y referencia a secreto, nunca cuenta completa;
- índices compuestos y de búsqueda;
- helpers de empresa, escritura y acceso sensible;
- RPC de crear, actualizar con versión, validar Excel e importar atómicamente.

`nombre_completo` se deriva de nombres/apellidos para evitar divergencia. DPI no se hace único global: se conserva la regla por empresa. Sexo queda nullable y no se usa en UI hasta validar necesidad legal/configurable.

## RLS propuesta

- Aislamiento mediante empresa asignada o admin interno.
- Jefe/Supervisor y funciones contables autorizadas pueden escribir; `auditor_solo_lectura` bloquea mutaciones.
- Historial e importaciones se consultan solo dentro del ámbito autorizado.
- Las tablas nuevas no ofrecen policies de mutación directa: las operaciones pasan por RPC.
- La tabla bancaria concede solo columnas no secretas. `secreto_referencia` no se concede al cliente.
- Admin interno no se vuelve rol asignable y los accesos sensibles deben auditarse.

La RLS de `empleados_planilla` existente debe compararse antes de aplicar. La migración no elimina policies desconocidas.

Las policies `planilla_empleados_select_empresa`, `planilla_empleados_insert_empresa`, `planilla_empleados_update_empresa` y `planilla_empleados_delete_bloqueado` aparecen en `sql/planilla_rls_base.sql`; esto no confirma Supabase remoto. La integración final migró Planilla a RPC. La misma migración V2 ahora elimina explícitamente las policies versionadas de INSERT/UPDATE, revoca INSERT/UPDATE/DELETE a `authenticated`, reemplaza SELECT por `empleados_select_empresa_v2` y conserva DELETE bloqueado. Un preflight aborta si encuentra otra policy remota de escritura no versionada. `service_role` y propietario no se revocan.

Todas las funciones `SECURITY DEFINER` usan `SET search_path = ''`, referencias calificadas y revocación para PUBLIC/anon. Solo las RPC necesarias y el helper invocado por RLS reciben EXECUTE para `authenticated`.

## RPC e historial

Implementadas en SQL: `crear_empleado_v2`, `actualizar_empleado_v2`, `validar_importacion_empleados_v2` e `importar_empleados_v2`. Validan empresa/rol, versión o idempotencia, escriben historial y devuelven mensajes humanos. Inactivación, retiro y reactivación usan la actualización versionada y quedan clasificadas en historial según la transición.

Actualizar salario también queda versionado, pero antes de producción amplia conviene una RPC exclusiva con doble autorización. Banco/revelación requieren KMS o Vault real; no se implementa cifrado ficticio. Reversión de importación queda pendiente: solo será segura después de comprobar dependencias de cada alta y reconstruir updates desde historial; no se permite DELETE masivo.

## Idempotencia y concurrencia

- `version` habilita optimistic locking; un update obsoleto devuelve conflicto y exige recargar.
- Alta manual usa una llave UUID y marca el origen para replay.
- Importación usa `archivo_hash + versión de plantilla` e idempotency key únicas.
- Código y DPI mantienen constraints por empresa; NIT/IGSS tienen índices para detección.
- Preview detecta coincidencias por empresa + código/DPI/NIT/IGSS. Nombre + nacimiento queda como advertencia futura, no actualización automática.

La reserva corregida usa `(usuario_id, tipo_operacion, ambito_hash, idempotency_key)` y request hash. Un advisory lock transaccional serializa dobles envíos; los replays solo se consultan dentro del mismo actor, operación y ámbito. El archivo se hace único por `(usuario_id, ambito_hash, archivo_hash, plantilla_version)`, no globalmente.

Estados de operación: `reservada`, `completada` y `fallida`. Completada + mismo hash devuelve replay; hash distinto se rechaza. Fallida + mismo hash puede reservarse nuevamente de forma controlada. Una reserva de más de diez minutos se considera recuperable. Los retornos controlados posteriores a reservar finalizan como completados o fallidos; un error estructural no capturado revierte toda la transacción y, por tanto, también libera la reserva.

## Importación Excel

1. “Descargar plantilla” genera XLSX real con hojas Empleados, Instrucciones y Catálogos, versión y fecha; la fila ejemplo está identificada y no contiene datos reales.
2. Solo acepta `.xlsx`, máximo 5 MB y 1,000 filas.
3. El navegador calcula SHA-256, rechaza macros y fórmulas y normaliza/controla longitud de textos.
4. La RPC valida permisos, obligatorios, fechas/formato, montos, estado, moneda, correo y duplicados.
5. Preview muestra fila, empleado, empresa, estado, errores, advertencias y acción crear/actualizar/ignorar/corregir.
6. Nada persiste antes de confirmación.
7. La RPC crea/actualiza por fila, registra resultado e historial y devuelve conteos.
8. Historial muestra las últimas importaciones accesibles.

Las cuentas bancarias no forman parte de la plantilla. La importación respeta los mismos permisos de escritura del maestro.

La RPC de importación no confía en empleado, estado técnico ni versión enviados por el cliente. Sí recibe `decision_usuario`, pero verifica su compatibilidad contra la acción recalculada. `ignorar` omite; `corregir` deja pendiente/rechazada; `crear` exige cero coincidencias; `actualizar` exige exactamente una. Revalida datos y permisos. Helpers `try_*` evitan que casts inválidos aborten el lote. Coincidencias por código, DPI, NIT, IGSS o nombre+nacimiento que apunten a varios UUID quedan ambiguas y rechazadas. No se asume DPI global.

El ordinal técnico se genera con `jsonb_array_elements(...) WITH ORDINALITY`; no usa el número manipulable del navegador. La fila original queda únicamente en `fila_origen` como referencia.

Cada actualización usa `id + empresa_id + version_esperada` y comprueba exactamente una fila afectada. Si cambió la versión, esa fila se rechaza por concurrencia sin sobrescribir. La acción final se calcula en servidor.

## Seguridad de archivos y riesgo XLSX

La protección del archivo es parcial y apta solo para uso interno controlado. PostgreSQL recibe JSON y metadatos declarados por el navegador: no puede comprobar binario XLSX, MIME, macros, fórmulas, tamaño real ni hash real. El cliente limita `.xlsx`, 5 MB y 1,000 filas, calcula SHA-256 y rechaza fórmulas/macros, pero un cliente modificado puede falsear esos metadatos. Para producción pública el binario deberá procesarse en un entorno confiable o almacenarse temporalmente en bucket privado. Esta corrección no agrega Storage, Edge Function ni backend.

`npm audit` reporta para `xlsx@0.18.5` vulnerabilidades altas de prototype pollution (`GHSA-4r6h-8v6p-xvw6`) y ReDoS (`GHSA-5pgg-2g8v-p4x9`), sin fix disponible en npm. Los límites reducen impacto pero no eliminan el riesgo. Recomendación: evaluar una librería mantenida o mover el parseo a un worker/servicio aislado con timeout y memoria limitada antes de habilitar carga masiva a todos los usuarios. No se actualizó ninguna dependencia.

## Datos sensibles y riesgos pendientes

- Las columnas antiguas `banco`/`cuenta_bancaria` pueden seguir en texto plano hasta una migración de datos autorizada.
- La pantalla no consulta cuentas completas nuevas.
- Debe verificarse drift y RLS remota.
- La importación cliente depende de una librería vulnerable.
- Falta RPC bancaria conectada a KMS, aprobación sensible y auditoría de revelación.
- Falta reversión controlada y prueba de dependencias.
- Falta rate limit específico, pruebas de concurrencia y carga.
- Los datos importados no deben alimentar Planilla hasta aprobar reglas legales y snapshots.

El historial usa una lista permitida: código, nombre, puesto, área, contrato, jornada, fechas laborales, estado, activo y moneda, más indicadores booleanos de cambio salarial. Excluye DPI, NIT, IGSS, cuenta/referencia, dirección, teléfono, correo, nacimiento y observaciones. Auxiliar no puede cambiar identificadores ni salario; estado requiere Jefe/Supervisor/admin. Sin embargo, las policies directas heredadas siguen siendo un riesgo hasta migrar Planilla.

Actualización Excel permitida: nombres, apellidos, puesto, área, contrato, jornada, ingreso/retiro, motivo de retiro, estado, salario, bonificación, teléfono y correo. No sobrescribe código, DPI, NIT, IGSS, nacimiento, nacionalidad, estado civil, dirección, residencia, ocupación ni centro de trabajo en empleados existentes. No cuenta como actualización una fila sin cambios. Importar requiere permiso sensible y cambiar estado requiere permiso de estado adicional.

### Estado de seguridad

- **Resuelto en la propuesta:** validación de datos del servidor, idempotencia por actor/operación/ámbito, concurrencia optimista, historial con lista permitida y RLS de tablas nuevas.
- **Parcial:** seguridad del XLSX en navegador, policies remotas no verificadas y vínculo Auth/perfiles.
- **Pendiente:** aplicar/probar en PostgreSQL y staging, KMS/Vault y reemplazar o aislar `xlsx`.

## Cierre funcional con Planilla

La auditoría de `app`, `components` y `lib` encontró una sola mutación directa: `app/planilla/page.tsx` creaba empleados con INSERT. Las otras referencias eran SELECT. No existían UPDATE, DELETE, UPSERT, inactivación, retiro, reactivación ni suspensión desde Planilla.

`guardarEmpleado` ahora usa `crear_empleado_v2` y mapea empresa, código, nombres, apellidos, DPI, NIT, IGSS, ingreso, puesto, área, salario, bonificación, moneda, estado y observaciones. Planilla todavía no captura contrato/jornada, por lo que envía null sin inventar UI. No hay fallback a INSERT.

La UI conserva una llave por fingerprint del payload. Doble clic se bloquea con ref sin depender del render; una respuesta lenta no duplica; un fallo de red conserva formulario y llave para reintento; cambiar datos crea una operación nueva; éxito/replay limpia formulario, invalida la llave y recarga el listado. Mensajes `ok/mensaje` se muestran directamente; transport errors pasan por el sanitizador existente.

Búsqueda final permitida:

- `app/empleados/page.tsx`: SELECT paginado.
- `app/planilla/page.tsx`: SELECT para cargar empleados.

No quedan `.insert`, `.update`, `.delete` ni `.upsert` asociados directamente con `empleados_planilla` en código cliente.

Pruebas pendientes de staging: doble clic; timeout después del commit y replay; cambio de formulario después de fallo; duplicado; rol sin permiso; auditor; empresa ajena; listado después de crear; Planilla con migración aplicada.

## Consultas remotas de solo lectura (no ejecutadas)

```sql
-- Columnas y tipos reales.
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'empleados_planilla'
order by ordinal_position;

-- Policies efectivas.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'empleados_planilla'
order by policyname;

-- Grants de tabla y columna para authenticated.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'empleados_planilla' and grantee = 'authenticated';
select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'empleados_planilla' and grantee = 'authenticated';

-- Funciones V2 y seguridad.
select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) arguments,
       p.prosecdef, p.proconfig, pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like '%empleado%v2%'
order by p.proname;

-- Índices y constraints.
select indexname, indexdef from pg_catalog.pg_indexes
where schemaname = 'public' and tablename = 'empleados_planilla';
select c.conname, c.contype, pg_catalog.pg_get_constraintdef(c.oid)
from pg_catalog.pg_constraint c
where c.conrelid = 'public.empleados_planilla'::pg_catalog.regclass;

-- Convención perfiles/Auth (solo conteos, sin exponer identidades).
select count(*) perfiles, count(u.id) vinculados_auth, count(*) - count(u.id) sin_auth
from public.perfiles p left join auth.users u on u.id = p.id;

-- Comparar este resultado con sql/planilla_rls_base.sql antes de aplicar V2.
```

No ejecutar `sql/planilla_rls_base.sql` después de V2: restauraría grants/policies directas.

## Pasos manuales de Supabase y orden de aplicación

1. Exportar esquema/policies/grants/triggers/RPC remotos y comparar.
2. Respaldar `empleados_planilla` y probar restauración.
3. Ejecutar la migración en staging con un rol propietario autorizado.
4. Validar constraints pendientes y revisar cualquier fila incompatible.
5. Probar RLS con Jefe, Supervisor, Contador, Auxiliar, Auditor, admin y empresa ajena.
6. Probar alta/update concurrentes, replay e importación repetida.
7. Ejecutar una importación pequeña sin datos bancarios y reconciliar conteos/historial.
8. Solo entonces desplegar UI V2 y monitorear rechazos/tiempos.

## Pruebas obligatorias

- Usuario sin sesión/inactivo/módulo/empresa.
- Auditor intentando crear, actualizar e importar.
- Auxiliar intentando acceder a secreto bancario.
- ID de otra empresa y payload con empresa manipulada.
- Update con versión obsoleta y doble submit.
- Mismo hash/idempotency key dos veces.
- XLSX vacío, renombrado, >5 MB, >1,000 filas, macro, fórmula y encabezados inválidos.
- Duplicados por código, DPI, NIT e IGSS dentro de empresa.
- Mismo DPI en otra empresa conforme a política documentada.
- Importación parcial y error por fila sin datos técnicos.
- Historial sin datos sensibles completos.

## Rollback

Antes de usar las nuevas columnas/RPC, rollback de aplicación: volver a la versión previa de UI; las adiciones son compatibles. No borrar tablas/columnas automáticamente. Si ya hubo importaciones, conservarlas y marcar la importación como revertida solo mediante una migración/RPC autorizada; las altas sin dependencias podrán inactivarse y los updates se corregirán desde historial. Restaurar desde respaldo solo como procedimiento de incidente aprobado.

No existe PostgreSQL ni Supabase local en este entorno. La migración no fue ejecutada ni parseada por un motor real; la revisión fue estática y staging sigue siendo obligatorio.

## Verificaciones

- `npx tsc --noEmit`: correcto, código 0.
- `npm run build`: correcto, código 0; 34 rutas generadas.
- `git diff --check`: correcto, sin errores de whitespace.
