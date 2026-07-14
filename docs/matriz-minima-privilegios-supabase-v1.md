# Matriz mínima de privilegios de Supabase V1

- Proyecto: `control-contable`
- Rama: `fix/supabase-matriz-privilegios-v1`
- Estado: diseño y revisión
- Cambios remotos: ninguno
- Producción: NO-GO

## 1. Objetivo

Diseñar el conjunto mínimo de privilegios para los roles `anon`, `authenticated` y `service_role` antes de preparar cualquier SQL de remediación.

Este documento no autoriza revocaciones, grants, cambios de policies ni modificaciones remotas.

## 2. Principios obligatorios

- Denegar por defecto y conceder únicamente lo necesario.
- RLS no sustituye el control de `EXECUTE`, secuencias, `TRUNCATE`, `REFERENCES` ni `TRIGGER`.
- Ninguna función `SECURITY DEFINER` debe ser pública sin justificación y validaciones internas.
- Los permisos deben definirse por función operativa y alcance multiempresa.
- `service_role` debe utilizarse únicamente desde procesos internos confiables.
- No modificar privilegios de schemas de backup.
- No ejecutar revocaciones o grants durante esta fase.

## 3. Criterio inicial por rol

### Rol `anon`

- Acceso solamente a operaciones públicas expresamente aprobadas.
- Sin acceso directo a tablas internas, secuencias o funciones administrativas.
- Sin `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` ni `TRIGGER` por defecto.

### Rol `authenticated`

- Acceso únicamente a tablas y RPC requeridas por usuarios autenticados.
- Toda operación debe respetar usuario, empresa, rol y policies RLS.
- Sin `TRUNCATE` sobre tablas operativas.
- Sin modificación directa de secuencias.

### Rol `service_role`

- Reservado para backend, automatizaciones y tareas administrativas confiables.
- No debe exponerse en navegador, cliente móvil ni variables públicas.
- Sus operaciones deben conservar auditoría e idempotencia.

## 4. Matriz inicial por tipo de privilegio

| Objeto o capacidad | `anon` | `authenticated` | `service_role` | Criterio |
|---|---|---|---|---|
| Tablas internas | Denegado | Según RLS y necesidad funcional | Permitido según proceso interno | Sin grants amplios por defecto |
| Secuencias | Denegado | Denegado | Permitido únicamente cuando sea necesario | Evitar `SELECT`, `USAGE` y `UPDATE` generales |
| Funciones públicas | Solo lista aprobada | Solo lista aprobada | Según backend autorizado | Revisar `EXECUTE` individualmente |
| Funciones `SECURITY DEFINER` | Denegado por defecto | Denegado por defecto | Permitido con validaciones internas | Validar usuario, empresa, rol e idempotencia |
| `TRUNCATE` | Denegado | Denegado | Solo mantenimiento controlado | No está protegido por RLS |
| `REFERENCES` | Denegado | Denegado salvo necesidad técnica | Según migraciones controladas | No requerido por uso normal de la aplicación |
| `TRIGGER` | Denegado | Denegado | Solo administración de esquema | No requerido por clientes API |
| Storage público | Solo lectura expresamente aprobada | Según policies | Administración controlada | Confirmar bucket, MIME y tamaño |

La matriz es preliminar y no constituye SQL ejecutable.

## 5. Diferencias detectadas frente al modelo mínimo

### 5.1 Rol `anon`

- Tiene ejecución efectiva sobre 32 funciones públicas.
- Tiene `USAGE`, `SELECT` y `UPDATE` sobre las 22 secuencias detectadas en `public`.
- El estado actual excede el criterio de denegación por defecto.
- Decisión pendiente: identificar la lista exacta de funciones que realmente requieren acceso anónimo.

### 5.2 Rol `authenticated`

- Tiene `TRUNCATE` efectivo sobre cinco tablas operativas sensibles.
- Tablas afectadas: `control_assist_auditoria`, `idempotency_keys_operativas`, `intentos_bloqueados`, `monitoreo_alertas` y `rate_limits_operativos`.
- El estado actual contradice el criterio de prohibir `TRUNCATE` a clientes autenticados.
- Decisión pendiente: confirmar que ninguna operación funcional depende de ese privilegio.

### 5.3 Privilegios predeterminados

- Los objetos nuevos pueden heredar permisos amplios sobre tablas, secuencias y funciones.
- El estado actual puede volver a crear exposición aunque se corrijan objetos individuales.
- Decisión pendiente: diseñar primero la configuración futura y después la corrección de objetos existentes.

### 5.4 Funciones privilegiadas

- Existen funciones `SECURITY DEFINER` ejecutables por `PUBLIC`.
- Varias funciones usan `search_path=public` y `handle_new_user()` no tiene ruta explícita.
- Decisión pendiente: revisar cada función antes de modificar `EXECUTE` o su configuración.

Esta sección registra diferencias; no contiene sentencias `GRANT`, `REVOKE` ni cambios remotos.

## 6. Validaciones previas a cualquier remediación

Antes de preparar SQL deben completarse estas verificaciones:

- Confirmar qué funciones necesita realmente el rol `anon`.
- Confirmar qué tablas y RPC utiliza directamente el rol `authenticated`.
- Revisar dependencias funcionales antes de retirar permisos sobre secuencias.
- Confirmar que ninguna función depende de `TRUNCATE` concedido a `authenticated`.
- Auditar individualmente las funciones `SECURITY DEFINER`.
- Verificar `auth.uid()`, empresa autorizada, rol operativo e idempotencia dentro de cada RPC sensible.
- Confirmar los schemas expuestos mediante PostgREST.
- Clasificar el bucket `evidencias` y sus policies de Storage.
- Separar privilegios futuros, mediante default privileges, de los privilegios existentes.
- Preparar pruebas positivas y negativas para cada rol antes de aplicar cambios.

## 7. Orden propuesto de trabajo

1. Inventariar funciones ejecutables por `anon` y `authenticated`.
2. Clasificar cada función como pública, autenticada, interna o candidata a retiro.
3. Revisar funciones `SECURITY DEFINER` y su `search_path`.
4. Diseñar default privileges mínimos para objetos futuros.
5. Diseñar revocaciones específicas para objetos existentes.
6. Preparar pruebas de regresión por módulo.
7. Revisar el SQL antes de cualquier ejecución remota.

Producción permanece en estado NO-GO hasta completar las validaciones y pruebas.
