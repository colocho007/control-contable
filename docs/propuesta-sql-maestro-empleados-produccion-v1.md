# Propuesta SQL — Maestro de Empleados de producción v1

Estado: propuesta no ejecutada.  
Fecha: 2026-07-11.  
Requiere autorización, revisión del esquema remoto, respaldo y pruebas en un entorno no productivo.

## 1. Tablas detectadas

El código y `sql/planilla_base.sql` definen `public.empleados_planilla` como tabla actual. Se relaciona con:

- `public.empresas(id)` mediante `empresa_id`;
- `public.perfiles(id)` mediante `creado_por` y `actualizado_por`;
- `public.planilla_detalle(empleado_id)`;
- `public.planilla_prestamos_descuentos(empleado_id)`.

El código también dispone de `documentos_tramites`, que acepta `entidad_tipo` y `entidad_id`. Puede relacionar documentos privados usando `entidad_tipo = 'empleados_planilla'` y el UUID del empleado, sujeto a RLS/Storage verificados.

La existencia de estos archivos no prueba que el esquema remoto coincida. Antes de ejecutar una migración se debe obtener el catálogo real de columnas, constraints, índices, triggers, grants y policies.

## 2. Columnas actuales detectadas

`id`, `empresa_id`, `codigo_empleado`, `nombres`, `apellidos`, `dpi`, `nit`, `igss_numero`, `fecha_ingreso`, `fecha_egreso`, `puesto`, `departamento`, `tipo_contrato`, `jornada`, `salario_base`, `bonificacion_incentivo`, `moneda`, `forma_pago`, `banco`, `cuenta_bancaria`, `activo`, `estado`, `observaciones`, `creado_por`, `creado_at`, `actualizado_por`, `actualizado_at`.

Constraints versionados:

- montos no negativos;
- moneda `GTQ` o `USD`;
- estado `Activo`, `Inactivo`, `Suspendido` o `Egresado`;
- código único por empresa cuando no es nulo;
- DPI único por empresa cuando no es nulo/vacío;
- índices de empresa/activo/estado y DPI.

## 3. Columnas faltantes para el alcance solicitado

No existen en el modelo versionado: fecha de nacimiento, nacionalidad, estado civil, sexo, teléfono, correo, dirección, municipio, ocupación, centro de trabajo, motivo de retiro, tipo de cuenta bancaria, titular de cuenta y estado de validación bancaria.

No se propone `nombre_completo` almacenado: debe derivarse de nombres y apellidos para evitar divergencia. Tampoco se agregan familia, beneficiarios ni prestaciones en esta fase.

## 4. Estrategia de migración propuesta

Evitar seguir ampliando una sola tabla con datos de distinta sensibilidad. Mantener `empleados_planilla` como identidad compatible y crear extensiones uno-a-uno. Los nombres finales deben validarse con el esquema remoto.

```sql
begin;

-- Extensión general laboral/contacto. Todas las adiciones son nuevas y no borran datos.
create table if not exists public.empleados_datos_personales (
  empleado_id uuid primary key,
  empresa_id bigint not null,
  fecha_nacimiento date,
  nacionalidad text,
  estado_civil text,
  sexo text,
  telefono text,
  correo text,
  direccion text,
  municipio text,
  ocupacion text,
  centro_trabajo text,
  motivo_retiro text,
  creado_por uuid references public.perfiles(id),
  creado_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id),
  actualizado_at timestamptz,
  constraint empleados_datos_personales_empleado_empresa_fk
    foreign key (empleado_id, empresa_id)
    references public.empleados_planilla(id, empresa_id),
  constraint empleados_datos_personales_correo_formato
    check (correo is null or correo = '' or correo ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

-- Datos bancarios separados por sensibilidad y para soportar vigencias futuras.
create table if not exists public.empleados_cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null,
  empresa_id bigint not null,
  banco text not null,
  tipo_cuenta text,
  cuenta_cifrada text not null,
  cuenta_ultimos4 text,
  titular text,
  estado_validacion text not null default 'pendiente',
  validado_por uuid references public.perfiles(id),
  validado_at timestamptz,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id),
  creado_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id),
  actualizado_at timestamptz,
  constraint empleados_cuentas_empleado_empresa_fk
    foreign key (empleado_id, empresa_id)
    references public.empleados_planilla(id, empresa_id),
  constraint empleados_cuentas_estado_check
    check (estado_validacion in ('pendiente', 'confirmada', 'rechazada')),
  constraint empleados_cuentas_vigencia_check
    check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- Historial inmutable sin valores bancarios/DPI completos en metadata.
create table if not exists public.empleados_historial (
  id bigint generated always as identity primary key,
  empleado_id uuid not null,
  empresa_id bigint not null,
  accion text not null,
  estado_anterior text,
  estado_nuevo text,
  campos_modificados text[] not null default '{}',
  motivo text,
  actor_id uuid not null references public.perfiles(id),
  creado_at timestamptz not null default now(),
  metadatos jsonb not null default '{}'::jsonb,
  constraint empleados_historial_empleado_empresa_fk
    foreign key (empleado_id, empresa_id)
    references public.empleados_planilla(id, empresa_id)
);

commit;
```

Notas obligatorias:

- `sexo` solo debe habilitarse si un requisito legal validado lo exige; no se propone catálogo ni valores sin esa fuente.
- Banco, tipo de cuenta y estado de validación requieren catálogos/reglas aprobados antes de añadir constraints cerrados.
- `cuenta_cifrada` requiere una estrategia de cifrado del lado servidor/KMS; no debe guardar texto plano ni cifrar en el navegador con una clave expuesta.
- Antes de crear las FK compuestas se debe confirmar que existe un índice único `(id, empresa_id)` en `empleados_planilla`; está propuesto en `planilla_grants_integridad_detalle.sql`.
- Los valores actuales de `banco` y `cuenta_bancaria` deben migrarse con un proceso auditado. No se deben borrar hasta verificar conteos y hashes.

## 5. Migración compatible de datos existentes

1. Crear tablas nuevas sin cambiar lecturas actuales.
2. Crear índice único `(id, empresa_id)` si no existe.
3. Copiar por lotes las cuentas actuales mediante una función de servidor que cifre el valor y derive últimos cuatro caracteres.
4. Comparar total de empleados con cuenta, total migrado y total rechazado.
5. Cambiar la aplicación para leer/escribir mediante API/RPC autorizada.
6. Mantener temporalmente las columnas antiguas como solo lectura.
7. Solo en una migración futura y autorizada, tras respaldo y período de compatibilidad, retirar los valores antiguos. Esta propuesta no incluye `DROP COLUMN`.

Rollback seguro antes del cambio de aplicación: dejar de escribir las tablas nuevas y volver a las columnas actuales; no borrar las nuevas tablas hasta completar análisis. Después de migrar datos bancarios, cualquier rollback debe preservar ambas fuentes y reconciliarlas.

## 6. Índices y constraints propuestos

```sql
create unique index if not exists idx_empleados_planilla_id_empresa
  on public.empleados_planilla (id, empresa_id);

create index if not exists idx_empleados_datos_empresa
  on public.empleados_datos_personales (empresa_id, empleado_id);

create index if not exists idx_empleados_datos_correo_lower
  on public.empleados_datos_personales (empresa_id, lower(correo))
  where correo is not null and correo <> '';

create unique index if not exists idx_empleados_cuenta_activa
  on public.empleados_cuentas_bancarias (empleado_id)
  where activo = true;

create index if not exists idx_empleados_historial_empleado_fecha
  on public.empleados_historial (empresa_id, empleado_id, creado_at desc);
```

No se propone unicidad global del DPI. El índice actual es por empresa; cualquier cambio requiere decisión jurídica/operativa sobre recontrataciones y empleo multiempresa.

## 7. RLS y grants necesarios

No ejecutar las siguientes ideas sin revisión completa:

- Habilitar RLS en las tres tablas nuevas y revocar acceso de `anon`/`public`.
- Lectura general solo para perfil activo con empresa asignada.
- `auditor_solo_lectura`: SELECT, nunca INSERT/UPDATE/DELETE.
- Escritura básica: Jefe/Supervisor o funciones `auxiliar_contable`/`contador_revisor`, de acuerdo con la policy actual.
- Cuenta bancaria completa: no conceder SELECT directo de `cuenta_cifrada` al navegador. Exponer únicamente últimos cuatro dígitos en una vista segura; revelar/actualizar mediante API o RPC SECURITY DEFINER revisada para Jefe/Contador autorizado.
- Salario y datos personales sensibles requieren vistas/RPC separadas o privilegios de columna. RLS por fila no oculta columnas.
- Historial: INSERT solo mediante trigger/RPC; SELECT por empresa y rol; UPDATE/DELETE siempre bloqueados.
- Storage: bucket privado, policy por `empresa_id`, entidad y módulo; URL firmada corta después de autorización.

Riesgo actual: cualquier usuario con SELECT permitido sobre `empleados_planilla` puede solicitar las columnas sensibles directamente a PostgREST aunque la UI las enmascare. La interfaz reduce exposición accidental, pero no es una frontera de seguridad suficiente.

## 8. RPC/API recomendadas

- `crear_empleado_v1(payload, idempotency_key)`.
- `actualizar_empleado_v1(empleado_id, version_esperada, payload)`.
- `registrar_retiro_empleado_v1(empleado_id, fecha, motivo)`.
- `cambiar_estado_empleado_v1(empleado_id, estado, motivo)`.
- `guardar_cuenta_empleado_v1(...)` con cifrado en servidor.
- `revelar_cuenta_empleado_v1(empleado_id, motivo)` con auditoría de lectura.

Cada operación debe validar sesión, perfil activo, módulo, empresa, función, transición, versión optimista e idempotencia; debe escribir historial en la misma transacción.

## 9. Riesgos

- Divergencia entre SQL versionado y remoto.
- Datos bancarios actuales en texto plano.
- Enmascaramiento exclusivamente visual.
- Historial `best effort` fuera de la transacción.
- Duplicidad al migrar una cuenta varias veces.
- Campos libres sin catálogos oficiales aprobados.
- Impacto en Planilla si se cambia la PK o tabla base.

## 10. Orden de ejecución autorizado

1. Exportar catálogo remoto y comparar drift.
2. Respaldar tablas y probar restauración.
3. Corregir/confirmar índice `(id, empresa_id)`.
4. Crear extensiones e índices en staging.
5. Crear y probar RLS/grants/vistas/RPC.
6. Ejecutar pruebas negativas multiempresa y por rol.
7. Migrar una muestra bancaria cifrada y reconciliar.
8. Adaptar aplicación y ejecutar E2E/concurrencia.
9. Desplegar gradualmente con métricas y rollback disponible.

## 11. Validaciones posteriores

- Ninguna referencia cruza empresas.
- Auditor no muta registros.
- Auxiliar no revela cuenta completa.
- Lectura directa no devuelve `cuenta_cifrada`.
- Retiro no elimina empleado ni movimientos.
- Fechas y montos cumplen constraints.
- Dos solicitudes concurrentes no crean duplicados.
- Historial se crea atómicamente.
- Documentos de otro empleado/empresa no son accesibles.
- Conteos y últimos cuatro dígitos coinciden después de migración.

