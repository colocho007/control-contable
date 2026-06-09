# Conexión operativa de Proveedores y Clientes con CxP y CxC

Fecha: 2026-06-09

Rama: `feature/conexion-operativa-cxp-cxc-proveedores-clientes`

## 1. Esquema confirmado

La conexión utiliza únicamente las columnas confirmadas de las tablas
`proveedores`, `clientes`, `cuentas_por_pagar` y `cuentas_por_cobrar`.

La relación de lectura para Proveedores es:

- `cuentas_por_pagar.proveedor_id = proveedores.id`
- `cuentas_por_pagar.empresa_id = proveedores.empresa_id`

La relación de lectura para Clientes es:

- `cuentas_por_cobrar.cliente_id = clientes.id`
- `cuentas_por_cobrar.empresa_id = clientes.empresa_id`

Los resúmenes consultan identificador, empresa, entidad relacionada, número y
fecha de documento, fecha de vencimiento, moneda, saldo pendiente y estado.

## 2. Conteos actuales

| Tabla | Registros confirmados |
| --- | ---: |
| Proveedores | 0 |
| Clientes | 0 |
| Cuentas por pagar | 0 |
| Cuentas por cobrar | 0 |
| Pagos de cuentas por pagar | 0 |
| Pagos de cuentas por cobrar | 0 |

## 3. Conexión lista

Proveedores consulta las cuentas por pagar visibles para las empresas permitidas
y calcula un resumen por proveedor. Clientes realiza el mismo proceso con
cuentas por cobrar.

La conexión es exclusivamente de lectura y resumen. Si una consulta relacionada
falla, se conserva la pantalla de datos maestros disponible y se muestra un
mensaje operativo controlado.

## 4. Información mostrada en Proveedores

- Saldo pendiente total por pagar.
- Cantidad de cuentas por pagar.
- Cantidad de cuentas vencidas con saldo pendiente.
- Última cuenta por fecha de documento.
- Estado general: sin cuentas, al día, pendiente o con cuentas vencidas.
- Estado vacío: `Este proveedor aún no tiene cuentas por pagar registradas.`
- Alcance visible: `Fase posterior: pagos, impuestos y contabilidad con validación.`

## 5. Información mostrada en Clientes

- Saldo pendiente total por cobrar.
- Cantidad de cuentas por cobrar.
- Cantidad de cuentas vencidas con saldo pendiente.
- Última cuenta por fecha de documento.
- Estado general: sin cuentas, al día, pendiente o con cuentas vencidas.
- Estado vacío: `Este cliente aún no tiene cuentas por cobrar registradas.`
- Alcance visible: `Fase posterior: cobros, impuestos y contabilidad con validación.`

## 6. Operaciones no automatizadas

- No se crean cuentas por pagar ni cuentas por cobrar.
- No se crean pagos ni cobros.
- No se aplican impuestos.
- No se crean asientos contables.
- No se modifica la lógica crítica de pagos, cobros, impuestos o contabilidad.

## 7. Riesgos controlados

- Las consultas están limitadas a empresas permitidas.
- La relación exige coincidencia de entidad y empresa.
- No se consultan tablas de pagos o cobros.
- No se muestran mensajes técnicos al usuario.
- Las tablas vacías producen estados vacíos profesionales.
- Los errores parciales no dejan una carga infinita.

La validación visual con cuentas relacionadas requiere datos representativos,
porque los conteos actuales son cero.

## 8. Fase posterior

- Creación controlada de CxP desde documentos.
- Creación controlada de CxC desde documentos.
- Pagos y cobros validados.
- Impuestos.
- Contabilidad.

## 9. Pruebas manuales

1. Abrir `/proveedores` y confirmar carga sin pantalla blanca.
2. Abrir `/clientes` y confirmar carga sin pantalla blanca.
3. Confirmar los estados vacíos con los conteos actuales.
4. Con datos representativos, verificar que cada cuenta se asigne únicamente a
   la entidad y empresa correctas.
5. Confirmar saldo total, cantidad, vencidas, última cuenta y estado general.
6. Simular un fallo de la consulta relacionada y confirmar el mensaje controlado.
7. Confirmar que no aparecen acciones para crear cuentas, pagos, cobros o asientos
   desde los nuevos resúmenes.

## 10. Veredicto

- **Proveedores conectado a CxP en lectura:** Sí.
- **Clientes conectado a CxC en lectura:** Sí.
- **Listo para presentación como operativo inicial conectado:** Sí, sujeto a una
  validación visual final con datos representativos.

## Alcance protegido

- No se tocaron RLS, RPC ni archivos SQL.
- No se crearon tablas.
- No se instalaron paquetes.
- No se borraron datos.
- No se cambiaron permisos ni autenticación.
- No se modificó lógica crítica de pagos, cobros, impuestos o contabilidad.

## Validación técnica

- `npm run build`: exitoso; compilación y TypeScript sin errores.
- `/proveedores`: HTTP 200, sin error de servidor.
- `/clientes`: HTTP 200, sin error de servidor.
- `git diff --check`: sin observaciones.
- Los archivos modificados no contienen diálogos nativos, borrado físico ni el
  texto futuro prohibido.
- La búsqueda general mantiene coincidencias heredadas fuera de este alcance;
  no fueron modificadas para respetar la restricción sobre lógica crítica.
