# Matriz de permisos Control+

## 1. Como interpretar la matriz

Los permisos indicados aplican solamente cuando el perfil esta activo, la empresa
esta asignada, el modulo esta habilitado y la funcion esta activa para esa
empresa. RLS y RPCs vuelven a validar las operaciones sensibles.

`Ver` y `Exportar` significan consultar datos permitidos de la empresa. Exportar
no concede permisos de escritura.

## 2. Matriz principal

| Funcion | Puede ver | Puede crear o preparar | Puede finalizar | Puede anular | Puede cerrar | Puede exportar | No puede hacer por esta funcion sola |
|---|---|---|---|---|---|---|---|
| `auxiliar_contable` | Contabilidad y documentos permitidos | Asientos borrador, documentos y distribuciones | No | No | No | Reportes permitidos por modulo y empresa | Registrar directamente, finalizar, anular, cerrar, administrar catalogo o configuracion |
| `contador_revisor` | Contabilidad, documentos y revision | Puede preparar y revisar trabajo contable | Asientos mediante RPC | Asientos mediante RPC y motivo | No | Reportes permitidos por modulo y empresa | Cerrar, administrar catalogo o configuracion sin funcion especializada |
| `auditor_solo_lectura` | Datos y reportes permitidos | No | No | No | No | Si, para empresas permitidas | Cualquier escritura, pago, cierre, finalizacion o anulacion |
| `contabilidad_catalogo_admin` | Catalogo permitido | Cuentas del catalogo | No | No | No | Reportes permitidos por modulo y empresa | Crear/finalizar/anular asientos, configurar impuestos o cerrar por esta funcion sola |
| `contabilidad_configuracion` | Configuracion contable y fiscal permitida | Configuracion contable/fiscal | No | No | No | Reportes permitidos por modulo y empresa | Finalizar, anular o cerrar por esta funcion sola |
| `contabilidad_cierre_periodo` | Periodos y previsualizacion | Preparar periodos cuando el flujo lo permite | No | No | Periodos validos mediante RPC | Reportes permitidos por modulo y empresa | Saltar bloqueos, cerrar por update directo o revisar asientos por esta funcion sola |
| `pagador_cheque` | Cheques permitidos | No concede creacion por si sola | Pago de cheque autorizado, no finalizacion contable | No concede anulacion por si sola | No | Reportes permitidos por modulo y empresa | Autorizar cheques, pagar no autorizados o ignorar fondo/moneda |

## 3. Acciones contables por funcion

| Accion | Auxiliar | Contador revisor | Auditor | Catalogo admin | Configuracion | Cierre |
|---|---:|---:|---:|---:|---:|---:|
| Crear asiento borrador | Si | Si | No | No | No | No |
| Crear asiento registrado directamente | No | No | No | No | No | No |
| Finalizar asiento | No | Si | No | No | No | No |
| Anular asiento | No | Si | No | No | No | No |
| Registrar documento | Si | Si | No | No | No | No |
| Guardar distribucion | Si | Si | No | No | No | No |
| Revisar/contabilizar documento | No | Si | No | No | No | No |
| Administrar catalogo | No | No | No | Si | No | No |
| Administrar configuracion fiscal/contable | No | No | No | No | Si | No |
| Previsualizar y cerrar periodo | No | No | No | No | No | Si |
| Consultar reportes permitidos | Si | Si | Si | Si | Si | Si |
| Exportar reportes permitidos | Si | Si | Si | Si | Si | Si |

## 4. Cheques y movimientos

| Accion | Regla operativa |
|---|---|
| Crear cheque | Depende del acceso al modulo, empresa y reglas vigentes de creacion; auditor bloqueado |
| Autorizar cheque | Depende de funciones/reglas de autorizacion; solo estado pendiente |
| Pagar cheque | Requiere `pagador_cheque`; solo estado Autorizado |
| Anular cheque | Depende de permisos y estado; requiere motivo; un pagado no se anula desde el flujo normal |
| Crear movimiento operativo | Requiere empresa activa asignada y no ser auditor |
| Anular movimiento operativo | Requiere permiso de anulacion, estado activo y motivo |
| Eliminar movimiento | Bloqueado; se usa anulacion logica |

## 5. Reglas transversales

- `auditor_solo_lectura` no debe combinarse con funciones de escritura en la
  misma empresa.
- Un usuario sin empresa no debe consultar ni exportar datos empresariales.
- Los reportes formales usan solo asientos registrados.
- Asientos borrador y anulados no aparecen como registrados.
- `registrar_asiento_completo` solo crea borradores.
- Finalizacion, anulacion, contabilizacion documental y cierre usan flujos seguros.
- El pago de cheque exige `pagador_cheque`, incluso para roles administrativos.
- Los permisos de una empresa no se trasladan automaticamente a otra.

## 6. Perfiles recomendados

| Perfil operativo | Funciones sugeridas | Separacion recomendada |
|---|---|---|
| Preparador contable | `auxiliar_contable` | No asignar revision ni cierre salvo necesidad aprobada |
| Revisor contable | `contador_revisor` | Separar de preparacion cuando sea posible |
| Responsable de catalogo | `contabilidad_catalogo_admin` | No agregar revision o cierre automaticamente |
| Responsable de configuracion | `contabilidad_configuracion` | Limitar a empresas bajo su responsabilidad |
| Responsable de cierre | `contabilidad_cierre_periodo` | Revisar bloqueos y evidencia antes de cerrar |
| Auditor | `auditor_solo_lectura` | No combinar con ninguna funcion de escritura |
| Pagador | `pagador_cheque` | Separar de autorizacion cuando sea posible |
