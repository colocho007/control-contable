# Reglas de eliminación de Control+

Fecha: 11 de junio de 2026

## Alcance

Este documento clasifica el tratamiento permitido de registros en Control+. No
autoriza borrado destructivo, no cambia SQL, RLS, políticas de Supabase,
autenticación ni datos reales.

Principio general: un registro con efecto operativo, contable, financiero,
fiscal, documental o de auditoría debe conservarse. Cuando deje de ser válido,
se anula, revierte, desactiva o archiva con motivo, usuario y fecha.

## Se puede eliminar

La interfaz normal no debe ofrecer eliminación física. Solo puede evaluarse una
eliminación definitiva mediante procedimiento excepcional del administrador
principal cuando se cumplan todas estas condiciones:

- Es un borrador incompleto que nunca fue emitido, aprobado, contabilizado,
  pagado, firmado ni vinculado.
- Es un archivo huérfano sin metadata ni relación con registros del sistema.
- Es información inequívocamente de prueba o demostración, separada de datos
  reales y cubierta por un reinicio controlado.
- Es un catálogo o configuración sin referencias, sin historial y cuya
  retención no sea obligatoria.

Toda evaluación futura debe incluir previsualización de dependencias, doble
confirmación, motivo obligatorio y auditoría sensible. Esta fase no implementa
esas operaciones.

## Debe anularse

Se anulan o revierten, nunca se eliminan físicamente:

- Movimientos financieros y contables.
- Asientos contables y sus efectos.
- Cheques emitidos, autorizados, rechazados o pagados.
- Pagos, cuentas por pagar y cuentas por cobrar.
- Órdenes de compra emitidas, firmadas o aprobadas.
- Impuestos, declaraciones y documentos fiscales.
- Conciliaciones, vínculos y ajustes bancarios.

La anulación debe conservar el registro original, estado anterior y nuevo,
motivo, usuario, fecha y vínculo con la reversión cuando corresponda.

## Debe archivarse o desactivarse

Se archivan o desactivan, conservando historial y relaciones:

- Usuarios y perfiles.
- Empresas fuera de operación.
- Asignaciones de empresa, módulo y funciones operativas.
- Documentos y su metadata.
- Cuentas de catálogo que ya tuvieron uso.
- Configuraciones que dejaron de aplicar.
- Chequeras y fondos que ya no están activos.
- Alertas de monitoreo resueltas que ya no requieren atención inmediata.

Archivar no equivale a anular. La acción debe reflejar con claridad si el
registro dejó de estar activo o si una operación perdió validez.

## Solo administrador principal

Quedan fuera de la interfaz operativa normal y reservadas al administrador
principal:

- Evaluar una eliminación definitiva excepcional.
- Ejecutar reinicios controlados sobre datos de prueba.
- Gestionar el rol interno `admin`.
- Revisar dependencias, retención y evidencia antes de cualquier depuración.
- Autorizar reaperturas, reversiones o anulaciones excepcionales según el
  módulo.

El administrador principal tampoco debe eliminar registros oficiales,
contables, fiscales, financieros, de auditoría o con relaciones históricas.

## Registros que nunca se eliminan desde interfaz

- Auditoría, historial e intentos bloqueados.
- Eventos y evidencia de seguridad.
- Registros oficiales contables, financieros y fiscales.
- Identidades referenciadas por operaciones.
- Evidencia de aprobaciones, firmas, pagos, anulaciones y reversiones.

## Matriz resumida

| Registro | Tratamiento |
|---|---|
| Borrador sin emisión ni vínculos | Evaluación excepcional de eliminación |
| Movimiento, asiento, cheque, pago, CxP o CxC | Anular o revertir |
| Orden emitida o aprobada | Cancelar o anular |
| Impuesto, declaración o documento fiscal | Anular o reemplazar con versión |
| Conciliación, vínculo o ajuste | Desvincular, anular o revertir |
| Usuario, empresa, permiso o configuración | Desactivar |
| Documento | Archivar o desactivar |
| Auditoría, historial o evidencia de seguridad | Conservar |
| Alerta de monitoreo | Resolver o archivar |

## Pendientes de implementación

- Definir procedimientos excepcionales por módulo.
- Validar dependencias antes de permitir cualquier depuración.
- Incorporar confirmaciones y auditoría para operaciones excepcionales.
- Probar reglas con usuarios y datos de prueba antes de habilitar cambios.

