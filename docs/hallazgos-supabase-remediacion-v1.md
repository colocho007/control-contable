# Hallazgos y plan de remediación Supabase V1

- Proyecto: `control-contable`
- Rama: `fix/supabase-hallazgos-remediacion-v1`
- Evidencia base: snapshot remoto R01–R37
- Tipo de auditoría: exclusivamente lectura
- Estado general: **NO-GO para producción**

## 1. Alcance completado

Se ejecutaron y revisaron los resultados R01–R37 del snapshot estructural.

R25 fue omitido correctamente porque el historial de migraciones no estaba disponible en el proyecto remoto.

No se modificaron datos, tablas, funciones, policies, roles, Storage ni configuración de Supabase.

## 2. Hallazgos bloqueantes

### 2.1 Drift entre aplicación, Git y esquema remoto

- La aplicación espera la relación `planillas`, pero no existe remotamente.
- La función `generar_cheques_de_chequera` existe remotamente, pero no tiene una definición local reproducible identificada.
- Existen tablas y vistas remotas adicionales que deben clasificarse como vigentes, históricas o no reproducibles.

### 2.2 Grants predeterminados excesivos

Los privilegios predeterminados de `public` conceden capacidades demasiado amplias a `anon` y `authenticated` sobre futuras:

- tablas;
- secuencias;
- funciones.

Esto puede reproducir automáticamente la exposición cada vez que se cree un objeto nuevo.

### 2.3 Acceso anónimo excesivo

El rol `anon` posee privilegios efectivos sobre numerosas tablas, secuencias y funciones de `public`.

Aunque RLS limita el acceso final a filas, permanecen expuestos privilegios que no dependen totalmente de RLS, incluyendo:

- `REFERENCES`;
- `TRIGGER`;
- uso y modificación de secuencias;
- ejecución de funciones.

### 2.4 Secuencias públicas expuestas

`anon` y `authenticated` tienen efectivamente:

- `USAGE`;
- `SELECT`;
- `UPDATE`;

sobre las 22 secuencias detectadas en `public`.

Las secuencias no están protegidas por policies RLS.

### 2.5 TRUNCATE para authenticated

`authenticated` tiene `TRUNCATE` efectivo sobre:

- `control_assist_auditoria`;
- `idempotency_keys_operativas`;
- `intentos_bloqueados`;
- `monitoreo_alertas`;
- `rate_limits_operativos`.

`TRUNCATE` no está limitado por RLS y debe tratarse como hallazgo de prioridad alta.

### 2.6 Funciones públicas privilegiadas

Se detectaron 32 funciones de `public` ejecutables por `PUBLIC`.

De ellas, 22 son `SECURITY DEFINER` y se ejecutan con privilegios del propietario `postgres`.

La superficie incluye operaciones sensibles de:

- cheques;
- pagos CxC y CxP;
- empresas;
- órdenes de compra;
- roles y autorizaciones;
- rate limiting.

Debe verificarse que cada función valide internamente:

- `auth.uid()`;
- empresa autorizada;
- rol o función operativa;
- identidad recibida en parámetros;
- idempotencia;
- pertenencia multiempresa.

### 2.7 Search path de funciones privilegiadas

Se detectaron:

- 32 funciones `SECURITY DEFINER` con `search_path=public`;
- `handle_new_user()` sin configuración explícita;
- `rls_auto_enable()` con `search_path=pg_catalog`.

La configuración más débil es `handle_new_user()`.

Las funciones V2 de empleados con ruta vacía explícita quedaron correctamente endurecidas.

### 2.8 Policies de autorización pendientes

La revisión de policies identificó riesgos que requieren validación funcional:

- posible autoasignación de privilegios en `usuario_funciones_operativas`;
- updates demasiado amplios en órdenes y firmas;
- updates administrativos sin alcance multiempresa suficientemente visible;
- posible cambio de `empresa_id` durante updates;
- posibilidad de falsificar registros de auditoría o historial;
- modificación demasiado amplia de cheques.

### 2.9 RLS habilitado sin policies

Las siguientes tablas de `public` tienen RLS activo y ninguna policy:

- `actividad`;
- `empleados_operaciones_idempotentes`;
- `movimientos_historial`;
- `notificaciones`;
- `pagos_cuentas_por_cobrar`.

Actualmente funcionan como deny-all para roles sujetos a RLS, pero debe documentarse cuáles son internas y cuáles necesitan acceso funcional.

### 2.10 Constraints no validados

Existen dos restricciones `NOT VALID`:

- FK `empleados_planilla_importacion_fk_v2`;
- CHECK `empleados_correo_formato_v2`.

No deben validarse hasta comprobar que los datos existentes cumplen las reglas.

### 2.11 Storage

El bucket `evidencias` es público y no tiene límite de tamaño o tipo MIME confirmado.

Debe definirse si la exposición pública es intencional antes de cualquier cambio.

### 2.12 Duplicidad y deuda estructural

Se detectaron:

- policies duplicadas o históricas;
- índices potencialmente redundantes;
- objetos remotos sin fuente local reproducible;
- propietarios de esquemas que requieren actualizar la allowlist del auditor.

No deben eliminarse objetos únicamente por coincidencia aparente.

### 2.13 Configuración PostgREST desconocida

Los settings:

- `pgrst.db_schemas`;
- `pgrst.db_extra_search_path`;

no fueron visibles desde el SQL Editor.

Por tanto, los esquemas realmente expuestos por PostgREST permanecen sin confirmar.

## 3. Controles positivos confirmados

- Todas las tablas revisadas tienen RLS habilitado.
- No existen tablas sin RLS accesibles por `anon` o `authenticated`.
- No existen triggers deshabilitados.
- Las dos vistas detectadas usan `security_invoker=true`.
- No se detectaron owners inesperados en tablas, vistas, funciones o secuencias.
- No existen membresías transitivas ni escaladas de roles API.
- Los permisos bancarios de `empleados_cuentas_bancarias` están limitados a columnas autorizadas.
- Los índices detectados están válidos, listos y activos.
- Todas las claves primarias están validadas.

## 4. Orden obligatorio de remediación

1. Establecer el inventario canónico remoto frente a Git.
2. Determinar qué objetos remotos deben conservarse.
3. Crear definiciones reproducibles para objetos vigentes.
4. Corregir default privileges de `public`.
5. Retirar privilegios peligrosos de `anon`.
6. Retirar `TRUNCATE` y permisos innecesarios de `authenticated`.
7. Restringir `EXECUTE` de RPC y funciones auxiliares.
8. Auditar cuerpos de funciones `SECURITY DEFINER`.
9. Endurecer `search_path`.
10. Corregir policies multiempresa y de autorización.
11. Clasificar tablas con RLS sin policies.
12. Validar constraints solamente después de auditar datos.
13. Revisar Storage.
14. Eliminar duplicidades únicamente con pruebas de dependencia.
15. Construir un baseline reproducible.
16. Ejecutar pruebas de regresión y seguridad antes de producción.

## 5. Restricciones de la remediación

- No modificar schemas de backup.
- No ejecutar scripts históricos completos.
- No ejecutar `sql/planilla_rls_base.sql`.
- No volver a ejecutar la migración V2 de empleados.
- No usar `supabase db push` hasta aprobar el baseline.
- No aplicar cambios remotos sin revisión previa del SQL.
- No eliminar tablas, policies, índices o funciones sin verificar dependencias.
- No cambiar objetos administrados de `auth` o `storage` junto con objetos propios de `public`.
