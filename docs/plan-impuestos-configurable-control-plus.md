# Plan de Impuestos Configurable de Control+

Fecha: 2026-06-09

Rama: `feature/plan-impuestos-configurable`

## 1. Esquema confirmado

### `impuestos_configuracion`

La tabla permite configurar por empresa: identificador fiscal, nombre, tipo,
porcentaje, cuenta contable de referencia, aplicación en compras, aplicación en
ventas, aplicación de retención, referencias opcionales a proveedor o cliente,
estado activo, observaciones, responsables de creación/actualización y
metadatos.

### `impuestos_documentos`

La tabla permite capturar documentos fiscales para revisión con empresa, origen,
proveedor o cliente, NIT, serie, número, fechas, moneda, tipo de cambio,
subtotal, IVA, total, crédito fiscal, débito fiscal, retenciones, estado,
sensibilidad y observaciones.

### Relaciones disponibles

- `proveedores.plan_impuesto_id` referencia opcionalmente una configuración.
- `clientes.plan_impuesto_id` referencia opcionalmente una configuración.
- `documentos_contables_revision` dispone de IVA, ISR, total y referencias de
  proveedor o cliente, pero no se conecta automáticamente desde este alcance.

## 2. Conteos actuales

| Tabla | Conteo confirmado |
| --- | ---: |
| `impuestos_configuracion` | 0 |
| `impuestos_documentos` | 0 |
| `proveedores` | 0 |
| `clientes` | 0 |
| `documentos_contables_revision` | 0 |

## 3. Configuración disponible

El módulo Impuestos queda presentado como **Base Operativa Configurable** por
empresa. Permite visualizar y, para usuarios autorizados, registrar
configuraciones fiscales revisables con:

- Nombre.
- Tipo.
- Porcentaje.
- Aplicación en compras.
- Aplicación en ventas.
- Aplicación de retención.
- Estado activo.
- Observaciones.

La pantalla muestra como referencias configurables:

- Pequeño contribuyente.
- Régimen general.
- Exento / no sujeto.
- Sujeto a retención.
- Caso especial manual.

El estado vacío visible es:
`No hay configuraciones fiscales registradas para esta empresa.`

La pantalla advierte que la configuración debe revisarse y validarse por el
área contable antes de afectar reportes, pagos o contabilidad.

## 4. Relación con Proveedores

Proveedores conserva la referencia opcional `plan_impuesto_id`. La tarjeta de
cada proveedor muestra el nombre del plan encontrado o
`Sin plan fiscal asignado.` cuando no existe una asignación.

No se obliga a seleccionar un plan fiscal y no se afecta la conexión de lectura
con Cuentas por Pagar.

## 5. Relación con Clientes

Clientes conserva la referencia opcional `plan_impuesto_id`. La tarjeta de cada
cliente muestra el nombre del plan encontrado o `Sin plan fiscal asignado.`
cuando no existe una asignación.

No se obliga a seleccionar un plan fiscal y no se afecta la conexión de lectura
con Cuentas por Cobrar.

## 6. Relación con Documentos

`app/impuestos` consulta y muestra `impuestos_documentos` como captura fiscal
para revisión y validación. Los montos capturados no se presentan como cálculo
fiscal definitivo.

`documentos_contables_revision` no se consulta directamente en el módulo
Impuestos dentro de este alcance. Su relación fiscal queda disponible para una
fase posterior validada.

## 7. Operaciones no automatizadas

- No se calculan impuestos definitivos automáticamente.
- No se aplican impuestos ni retenciones de forma definitiva.
- No se generan declaraciones fiscales automáticas.
- No se crean pagos ni cuentas por pagar fiscales.
- No se crean asientos contables.
- No se promete exactitud fiscal garantizada.

Fase posterior: aplicación automática validada de impuestos, retenciones y
asientos fiscales.

## 8. Riesgos fiscales controlados

- La interfaz declara expresamente que la configuración requiere validación
  contable.
- Las configuraciones se muestran por empresa.
- Los planes fiscales de proveedores y clientes son opcionales.
- Los documentos fiscales permanecen como registros revisables.
- Los estados vacíos son profesionales para los conteos actuales en cero.
- Los mensajes técnicos no se presentan directamente al usuario.

La validez fiscal de nombres, porcentajes, regímenes, retenciones y cuentas
contables sigue dependiendo de revisión profesional autorizada.

## 9. Pruebas manuales

1. Abrir `/impuestos` con una empresa autorizada sin configuraciones y confirmar
   el estado vacío exacto.
2. Confirmar la advertencia visible de revisión y validación contable.
3. Revisar que los cinco regímenes configurables aparezcan como referencia.
4. Registrar una configuración controlada con usuario autorizado y verificar
   nombre, tipo, porcentaje, aplicaciones, estado y observaciones.
5. Abrir `/proveedores` y confirmar el texto de plan fiscal sin asignación.
6. Abrir `/clientes` y confirmar el texto de plan fiscal sin asignación.
7. Asignar una configuración existente durante una prueba controlada y confirmar
   que se muestra su nombre.
8. Confirmar que no se crean impuestos definitivos, declaraciones ni asientos.

## 10. Veredicto

- **Plan de impuestos:** Base operativa configurable.
- **Cálculo fiscal definitivo:** No, requiere validación contable.
- **Listo para presentación:** Sí, como base operativa configurable y revisable.

## Alcance protegido

- No se tocaron RLS, RPC ni archivos SQL.
- No se crearon tablas.
- No se instalaron paquetes.
- No se borraron datos.
- No se cambiaron permisos ni autenticación.
- No se modificó lógica crítica fiscal o contable.
