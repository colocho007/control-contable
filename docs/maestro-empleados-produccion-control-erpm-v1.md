# Maestro de Empleados de producción — Control ERPM v1

Fecha: 2026-07-11  
Rama: `feature/maestro-empleados-produccion-v1`

## 1. Objetivo

Establecer la primera fase operativa del Maestro de Empleados como dominio distinto de los usuarios del sistema y como base de futuras planillas, prestaciones, documentos y procesos contables. Esta fase no implementa planilla completa, bancos, pagos ni conciliación.

## 2. Estado anterior

`app/empleados/page.tsx` era una redirección directa a `/usuarios`. El alta básica de empleados vivía dentro de Planilla y solo permitía insertar registros; no había ficha independiente, edición, retiro, paginación ni tratamiento visual de datos sensibles.

## 3. Archivos revisados

- `app/empleados/page.tsx`, `app/planilla/page.tsx`, `app/usuarios/page.tsx`.
- `components/Sidebar.tsx`, `components/DocumentosEntidad.tsx`.
- `lib/supabase.ts`, acceso a módulo, usuarios activos, empresas permitidas/operativas, funciones operativas, auditoría y documentos.
- `proxy.ts` y la ruta protegida `/empleados`.
- `sql/planilla_base.sql`, integridad de empleado/empresa, grants y RLS de Planilla.
- `docs/base-operativa-planillas-integracion-control-erpm-v1.md` y auditorías relacionadas.
- Documentación local de Next.js 16.2.6 para Client Components.

## 4. Archivos modificados

- `app/empleados/page.tsx`.
- `components/Sidebar.tsx`.
- `docs/maestro-empleados-produccion-control-erpm-v1.md`.
- `docs/propuesta-sql-maestro-empleados-produccion-v1.md`.

El documento base de auditoría ya existía sin seguimiento en esta rama y no fue alterado en esta implementación.

## 5. Separación empleados/usuarios

`/empleados` ya no redirige. Presenta el maestro laboral basado en `empleados_planilla`. `/usuarios` mantiene perfiles de acceso, roles y activación del sistema. No se modificó Auth ni se agregó relación implícita entre un perfil y un empleado.

## 6. Modelo actual detectado

La interfaz utiliza únicamente columnas existentes en `empleados_planilla`: empresa, código, nombres/apellidos, DPI, NIT, IGSS, ingreso/egreso, puesto, departamento, contrato, jornada, salario, bonificación, moneda, forma de pago, banco, cuenta, estado, observaciones y timestamps.

No existen en el SQL versionado fecha de nacimiento, nacionalidad, estado civil, sexo, teléfono, correo, dirección, municipio, ocupación, centro de trabajo, motivo de retiro, tipo/titular/validación de cuenta. No aparecen como controles falsos. Su modelo seguro se propone por separado.

## 7. Funciones implementadas

- Listado con selección de empresa, búsqueda, estado, puesto y paginación server-side de 25 filas.
- Estados de carga, error y vacío con textos humanos.
- Creación de empleado sin exigir cuenta bancaria.
- Consulta de ficha y edición.
- Cambio de estado e inicio de retiro con confirmación; nunca DELETE.
- Validación de empresa, nombres, apellidos, ingreso, retiro, montos y estado.
- Prevención de doble envío mediante estado `guardando` y botón bloqueado.
- Auditoría sin DPI, NIT, IGSS, cuenta ni salario en metadata.
- Acciones y salario condicionados por rol/función.
- Acceso desde Sidebar como “Empleados”, separado de “Usuarios” y reutilizando la clave de módulo `planilla` existente.

## 8. Datos sensibles

DPI se enmascara en el listado. DPI, NIT, IGSS y cuenta se ocultan por defecto en ficha y cuentan con control mostrar/ocultar. Cuenta completa y salario se condicionan visualmente a Jefe/Contador/admin o función `contador_revisor`. No se muestran UUID, JSON, valores sensibles en mensajes ni errores técnicos.

Limitación crítica: Supabase/RLS actual controla filas por empresa, no columnas. Un usuario con SELECT puede consultar directamente valores completos si las columnas están expuestas por PostgREST. El enmascaramiento implementado evita exposición casual en UI, pero la seguridad real por columna depende de la propuesta de vistas/API/RPC/RLS aún no autorizada.

## 9. Roles y permisos

- Jefe/admin y Supervisor: escritura conforme a las policies versionadas.
- Contador/Auxiliar: escritura solo cuando poseen `contador_revisor` o `auxiliar_contable`; esto refleja la policy actual, no solo botones.
- Auditor con `auditor_solo_lectura`: consulta sin mutaciones.
- Salario y banco completo: visibilidad UI restringida; requiere endurecimiento del servidor para ser una garantía.

No se modificaron policies. El alta/edición sigue dependiendo de que `planilla_rls_base.sql` esté desplegado y sea equivalente al esquema remoto.

## 10. Validaciones

- Empresa autorizada obligatoria.
- Nombres/apellidos e ingreso obligatorios.
- Retiro igual o posterior al ingreso.
- Salario y bonificación no negativos.
- Estado limitado a valores existentes del constraint.
- Cuenta opcional con aviso de incompletitud.
- Empresa inmutable al editar para impedir traslado accidental.
- Update combina ID y empresa para reducir riesgo de referencia manipulada.
- Duplicidad se delega a índices únicos por empresa y se presenta con mensaje humano.

Correo no se captura porque la columna no existe. Su validación se incluye en la propuesta SQL.

## 11. Limitaciones

- No hay teléfono/dirección ni ficha personal completa sin migración.
- No hay historial transaccional; `auditoria_eventos` se registra después del guardado y puede fallar independientemente.
- No hay control de concurrencia optimista ni idempotency key persistente para crear/editar.
- El filtro de puestos refleja los puestos presentes en la página cargada, no un catálogo completo.
- RLS remota no fue inspeccionada; los scripts locales son evidencia de intención, no despliegue.
- Banco y cuenta permanecen en las columnas actuales de texto plano hasta una migración autorizada.

## 12. SQL/RLS pendiente

`docs/propuesta-sql-maestro-empleados-produccion-v1.md` detalla extensiones personales, cuentas cifradas, historial, índices, constraints, migración compatible, RPC y policies. No se creó ni ejecutó un archivo SQL ejecutable y no se modificó RLS.

## 13. Conexiones futuras

El UUID estable de `empleados_planilla` y `empresa_id` permiten relacionar posteriormente movimientos, períodos, detalle, prestaciones, documentos, pagos, conciliación, asientos y acumulados mediante IDs. `documentos_tramites` ya admite `entidad_tipo = 'empleados_planilla'` y `entidad_id`, pero la conexión UI y la verificación de Storage/RLS quedan para una fase autorizada.

Documentos previstos: solicitud, DPI, NIT, contrato, constancias y documentos bancarios, siempre en bucket privado y con URL firmada corta. No se implementó extracción con IA.

## 14. Riesgos

- Seguridad por columna insuficiente en el esquema actual.
- Cuenta bancaria potencialmente almacenada en texto plano.
- Auditoría no atómica.
- Falta de versionado de contrato, salario y banco.
- Posible drift entre repositorio y Supabase.
- La edición directa desde cliente depende totalmente de RLS.
- Falta de catálogo oficial para ocupación, centro, jornada, contrato y bancos.

## 15. Resultado de TypeScript

`npx tsc --noEmit`: correcto, código de salida 0.

## 16. Resultado del build

`npm run build`: correcto, código de salida 0. Next.js 16.2.6 compiló correctamente y generó las 34 rutas, incluida `/empleados`.

## 17. Recomendación final

La interfaz puede operar como V1 limitada sobre el modelo actual para identificar, listar y mantener empleados. Antes de capturar datos personales ampliados o usar cuentas para pagos, se debe autorizar y desplegar la separación de datos sensibles, cifrado de cuenta, historial transaccional y acceso mediante servidor. Después puede integrarse movimientos mensuales; no conviene conectar pagos o planilla completa antes de cerrar esas garantías.
