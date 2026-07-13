# Inventario canónico de Supabase V1

- Proyecto: `control-contable`
- Rama: `fix/supabase-inventario-canonico-v1`
- Estado: clasificación y diseño
- Cambios remotos: ninguno
- Producción: NO-GO

## 1. Objetivo

Clasificar cada objeto detectado en Supabase remoto, Git y la aplicación antes de diseñar cualquier baseline o remediación.

Este inventario no autoriza cambios remotos ni confirma que un objeto deba conservarse o eliminarse.

## 2. Estados de clasificación

Cada objeto deberá quedar en uno de estos estados:

- `CANONICO_REPRODUCIBLE`: existe remotamente, es requerido y tiene definición local confiable.
- `VIGENTE_NO_REPRODUCIBLE`: existe remotamente y parece vigente, pero falta una definición local completa.
- `ESPERADO_NO_REMOTO`: la aplicación o Git lo espera, pero no existe en Supabase remoto.
- `HISTORICO`: existe, pero corresponde a una versión anterior o ya sustituida.
- `BACKUP_NO_TOCAR`: pertenece a un schema de respaldo y queda fuera de toda remediación.
- `PENDIENTE_VALIDACION`: no existe evidencia suficiente para clasificarlo.
- `CANDIDATO_RETIRO`: parece innecesario, pero no puede eliminarse sin revisar dependencias y uso real.

## 3. Reglas obligatorias

- No modificar schemas de backup.
- No ejecutar `sql/planilla_rls_base.sql`.
- No volver a ejecutar la migración V2 de empleados.
- No usar `supabase db push`.
- No eliminar objetos por nombre, duplicidad aparente o antigüedad.
- No asumir que un archivo SQL fue desplegado.
- No asumir que un objeto remoto tiene fuente local reproducible.
- Toda clasificación debe incluir evidencia y decisión pendiente.

## 4. Clasificación inicial de objetos críticos

### 4.1 Relación `public.planillas`

- Estado: `ESPERADO_NO_REMOTO`.
- Evidencia: la aplicación y archivos locales hacen referencia a `planillas`.
- Evidencia remota: no fue detectada en el snapshot R01-R37.
- Riesgo: funciones de planilla pueden fallar por relación inexistente.
- Decisión pendiente: definir su estructura canónica antes de crear cualquier migración.

### 4.2 Función `public.generar_cheques_de_chequera`

- Estado: `VIGENTE_NO_REPRODUCIBLE`.
- Evidencia: existe en Supabase remoto.
- Evidencia local: no se identificó una definición completa y confiable en Git.
- Riesgo: el comportamiento remoto no puede reconstruirse desde el repositorio.
- Decisión pendiente: revisar dependencias, cuerpo y uso real antes de versionarla.

### 4.3 Bucket `evidencias`

- Estado: `PENDIENTE_VALIDACION`.
- Evidencia: el bucket existe remotamente y está configurado como público.
- Riesgo: exposición no confirmada de documentos o archivos.
- Decisión pendiente: confirmar el uso funcional, tipos MIME y tamaño máximo esperado.

### 4.4 Tablas con RLS activo y sin policies

Estado general: `PENDIENTE_VALIDACION`.

Objetos detectados:

- `public.actividad`.
- `public.empleados_operaciones_idempotentes`.
- `public.movimientos_historial`.
- `public.notificaciones`.
- `public.pagos_cuentas_por_cobrar`.

Evidencia: las cinco tablas existen remotamente, tienen RLS habilitado y no poseen policies.

Comportamiento actual: acceso denegado para roles sujetos a RLS, salvo operaciones ejecutadas mediante funciones privilegiadas o propietarios.

Riesgo: alguna tabla funcional podría estar bloqueada accidentalmente o depender de una RPC no auditada completamente.

Decisión pendiente: clasificar cada tabla como interna, histórica o funcional antes de crear policies.

### 4.5 Privilegios predeterminados del schema `public`

- Estado: `PENDIENTE_VALIDACION`.
- Evidencia: los privilegios predeterminados conceden capacidades amplias a `anon` y `authenticated` sobre futuras tablas, secuencias y funciones.
- Riesgo: cada objeto nuevo podría heredar permisos excesivos automáticamente.
- Decisión pendiente: diseñar una matriz mínima de privilegios antes de preparar SQL de remediación.
- Restricción: no revocar permisos remotamente durante esta fase.

### 4.6 Privilegios efectivos de los roles API

#### Rol `anon`

- Estado: `PENDIENTE_VALIDACION`.
- Evidencia: posee ejecución efectiva sobre 32 funciones públicas.
- Evidencia: posee `USAGE`, `SELECT` y `UPDATE` sobre las 22 secuencias detectadas en `public`.
- Riesgo: las secuencias no están protegidas por RLS y algunas funciones usan privilegios elevados.
- Decisión pendiente: identificar cuáles funciones requieren acceso anónimo antes de diseñar revocaciones.

#### Rol `authenticated`

- Estado: `PENDIENTE_VALIDACION`.
- Evidencia: posee `TRUNCATE` efectivo sobre cinco tablas operativas sensibles.
- Tablas: `control_assist_auditoria`, `idempotency_keys_operativas`, `intentos_bloqueados`, `monitoreo_alertas` y `rate_limits_operativos`.
- Riesgo: `TRUNCATE` no está limitado por RLS.
- Decisión pendiente: determinar el propietario funcional y el conjunto mínimo de permisos requerido.

- Restricción general: no modificar grants ni ejecutar revocaciones durante esta fase.

### 4.7 Funciones `SECURITY DEFINER`

- Estado general: `PENDIENTE_VALIDACION`.
- Evidencia: se detectaron 22 funciones `SECURITY DEFINER` ejecutables por `PUBLIC`.
- Evidencia: existen 32 funciones privilegiadas con `search_path=public`.
- Evidencia: `handle_new_user()` no posee un `search_path` explícito.
- Control positivo: las funciones V2 de empleados usan una ruta vacía explícita.
- Riesgo: una función privilegiada podría resolver objetos inseguros o permitir operaciones sin validar usuario, empresa y rol.
- Decisión pendiente: revisar individualmente cuerpo, propietario, permisos, parámetros, multiempresa e idempotencia.
- Prioridad especial: auditar primero `handle_new_user()` y las funciones relacionadas con pagos, cheques, empresas, órdenes y roles.
- Restricción: no modificar cuerpos, permisos ni configuración de funciones durante esta fase.

### 4.8 Constraints pendientes de validación

- Estado general: `PENDIENTE_VALIDACION`.
- Evidencia: existen dos constraints remotos marcados como `NOT VALID`.
- Constraint: `empleados_planilla_importacion_fk_v2`.
- Constraint: `empleados_correo_formato_v2`.
- Riesgo: los datos existentes podrían incumplir la relación o el formato esperado.
- Decisión pendiente: ejecutar únicamente consultas de diagnóstico de datos antes de diseñar su validación.
- Restricción: no ejecutar `VALIDATE CONSTRAINT` ni modificar datos durante esta fase.

### 4.9 Exposición de schemas mediante PostgREST

- Estado: `PENDIENTE_VALIDACION`.
- Evidencia: los valores `pgrst.db_schemas` y `pgrst.db_extra_search_path` no fueron visibles durante la auditoría.
- Riesgo: no está confirmado qué schemas pueden consultarse mediante la API de Supabase.
- Decisión pendiente: verificar la configuración desde el panel del proyecto o mediante una fuente administrativa autorizada.
- Restricción: no modificar la configuración de API ni asumir que únicamente `public` está expuesto.

## 5. Matriz inicial de decisión

| Objeto o grupo | Estado | Evidencia principal | Próxima decisión |
|---|---|---|---|
| `public.planillas` | `ESPERADO_NO_REMOTO` | Requerido localmente y ausente en el snapshot remoto | Diseñar estructura canónica |
| `public.generar_cheques_de_chequera` | `VIGENTE_NO_REPRODUCIBLE` | Existe remotamente sin definición local confiable | Auditar cuerpo, dependencias y uso |
| Bucket `evidencias` | `PENDIENTE_VALIDACION` | Existe remotamente como público | Confirmar exposición, MIME y tamaño |
| Cinco tablas con RLS sin policies | `PENDIENTE_VALIDACION` | RLS activo y ninguna policy | Clasificar como internas, históricas o funcionales |
| Default privileges de `public` | `PENDIENTE_VALIDACION` | Permisos amplios heredables | Diseñar matriz mínima de grants |
| Acceso de `anon` a funciones y secuencias | `PENDIENTE_VALIDACION` | EXECUTE y permisos efectivos detectados | Identificar acceso anónimo realmente requerido |
| `TRUNCATE` de `authenticated` | `PENDIENTE_VALIDACION` | Permiso efectivo sobre cinco tablas sensibles | Definir permisos operativos mínimos |
| Funciones `SECURITY DEFINER` | `PENDIENTE_VALIDACION` | Ejecución pública y rutas de búsqueda débiles | Auditar cada función individualmente |
| Dos constraints `NOT VALID` | `PENDIENTE_VALIDACION` | Validación estructural pendiente | Diagnosticar datos existentes |
| Configuración PostgREST | `PENDIENTE_VALIDACION` | Schemas expuestos no confirmados | Verificar configuración administrativa |

Esta matriz no autoriza modificaciones remotas, eliminación de objetos ni ejecución de migraciones.
