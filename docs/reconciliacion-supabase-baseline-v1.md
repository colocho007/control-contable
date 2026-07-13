# Reconciliación segura de Supabase y diseño del baseline — Fase 1

- **Proyecto:** `control-contable`
- **Repositorio:** `colocho007/control-contable`
- **Rama:** `fix/supabase-baseline-reconciliacion-v1`
- **Commit local inventariado:** `0de637d`
- **Fecha:** 13 de julio de 2026 (`America/Guatemala`)
- **Estado:** metodología preparada; no se ha consultado ni modificado Supabase remoto

## 1. Objetivo

Preparar una reconciliación reproducible y exclusivamente de lectura entre cuatro fuentes que hoy no pueden considerarse equivalentes:

1. el esquema que realmente exista en el proyecto Supabase remoto;
2. los 29 archivos `sql/*.sql`;
3. la única migración disponible en `supabase/migrations`;
4. los objetos que la aplicación usa desde `app/`, `components/` y `lib/`.

Esta fase produce un snapshot de metadatos y una metodología de comparación. No decide todavía el esquema canónico, no crea el baseline y no propone sentencias de reparación.

El script preparado es [`sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql`](../sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql). Contiene **37 consultas de inventario independientes**.

## 2. Alcance

El inventario local cubrió:

- 30 archivos SQL de entrada: 29 scripts manuales y una migración, sin contar el snapshot creado por esta fase;
- 11,945 líneas físicas de SQL;
- 60 relaciones referenciadas por la aplicación;
- 21 RPC distintas usadas por la aplicación, incluida una selección dinámica entre dos nombres;
- tablas, vistas, columnas, constraints, índices, triggers, funciones, policies, RLS, grants, owners, secuencias, extensiones, ENUM, Storage e historial de migraciones;
- ACL explícitas por columna, membresías directas/transitivas de roles API y privilegios efectivos derivados;
- los dos settings no sensibles allowlisted que describen schemas de PostgREST, únicamente cuando sean visibles en la sesión del SQL Editor;
- usos dinámicos de `.from(...)`, embeds/alias PostgREST y el bucket de documentos;
- riesgos de orden, duplicidad y reejecución de scripts antiguos.

El snapshot remoto se limita a metadatos estructurales. No consulta contenido contable, laboral ni documental.

### Resumen local observado

| Categoría | Inventario local | Nota |
|---|---:|---|
| Tablas definidas | 30 | 23 son relaciones usadas directamente; 7 son auxiliares SQL |
| Funciones definidas | 41 | 33 declaran ejecución con privilegios del propietario |
| Procedimientos | 0 | Ninguna definición local |
| Vistas/materializadas | 0 | La aplicación espera una vista remota |
| Índices | 82 declaraciones / 80 nombres | Un nombre aparece tres veces |
| Policies | 144 declaraciones / 140 pares nombre-tabla | Cuatro declaraciones están duplicadas |
| Triggers | 4 | En tres archivos |
| PK / FK | 30 / 119 | Conteo sintáctico local |
| UNIQUE / CHECK | 4 / 101 | Además existen 22 índices únicos |
| Tablas con RLS | 38 | 61 activaciones repetidas; ninguna con RLS forzado |
| Secuencias explícitas | 0 | Dos secuencias serían implícitas por columnas identity |
| ENUM / extensiones / schemas | 0 | Su estado depende del remoto |
| Bucket/Storage policies | 0 | Sólo existe una comprobación diagnóstica del bucket esperado |

Estos conteos describen texto versionado; no demuestran que los objetos existan ni tengan la misma forma en producción.

## 3. Restricciones de esta fase

- No ejecutar SQL remoto como parte de este trabajo.
- No alterar datos, esquema, roles, policies, Storage ni configuración.
- No usar `supabase db push`, `supabase migration up`, reparaciones de historial ni comandos equivalentes.
- No editar migraciones existentes ni código funcional.
- No leer, imprimir ni copiar valores de `.env.local`.
- No consultar `pg_authid` ni filas de identidad, negocio o archivos de Storage.
- No consultar `pgrst.jwt_secret` ni otra configuración sensible de PostgREST; R37 se limita a `pgrst.db_schemas` y `pgrst.db_extra_search_path`.
- No instalar ni actualizar dependencias.
- No interpretar un script manual como evidencia de despliegue.
- No convertir las definiciones devueltas por el catálogo en un plan de reparación.
- No añadir, confirmar ni publicar cambios Git desde esta fase.

Las salidas remotas tendrán información útil para un atacante —estructura, nombres, owners y privilegios— y deben tratarse como evidencia restringida.

## 4. Cómo comprobar que el SQL es realmente de sólo lectura

La revisión debe tener cuatro capas:

1. **Forma de cada sentencia.** Después de ignorar comentarios y literales, cada una de las 37 sentencias debe comenzar con `SELECT` o `WITH` y terminar con un único punto y coma.
2. **CTE recursivos.** Un bloque que comienza con `WITH` también debe contener únicamente subconsultas de lectura. No basta con revisar la primera palabra.
3. **Funciones invocadas.** Sólo se aceptan funciones de catálogo o built-ins sin efecto mutable. Se rechazan funciones de usuario, secuencias, locks, notificaciones, cambios de configuración, acceso a archivos y ejecución remota.
4. **Ausencias específicas.** No debe existir `SELECT INTO`, invocación de RPC de negocio, referencia a `pg_authid`, filas de `auth.users`, `storage.objects` o tablas `public` de negocio, ni, dentro de R37, lectura de settings fuera de sus dos nombres allowlisted o de `pgrst.jwt_secret`.

La comprobación local mínima recomendada es:

```powershell
rg -n -i '^\s*(create|alter|drop|grant|revoke|insert|update|delete|truncate|call|do|copy|merge|begin|commit|rollback|set|reset|vacuum|analyze|refresh|cluster|reindex|lock|notify|listen|unlisten|execute)\b' sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql
rg -n -i '\b(select\s+into|nextval|setval|set_config|pg_advisory|pg_notify|dblink|pg_terminate_backend|lo_import|lo_export)\b' sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql
rg -n -i '\b(pg_authid|auth\s*\.\s*users|storage\s*\.\s*objects|pgrst\s*\.\s*jwt_secret)\b' sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql
rg -n -i "current_setting\s*\(\s*'pgrst\." sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql
rg -n '^-- [0-9]{2}\.' sql/auditoria/01_snapshot_metadatos_supabase_solo_lectura.sql
```

Los tres primeros comandos deben devolver cero coincidencias; el cuarto debe mostrar exactamente los dos settings allowlisted de R37 y el quinto debe devolver 37 encabezados. Además se debe aplicar una revisión léxica que elimine comentarios y literales antes de contar sentencias y buscar mutaciones, `SELECT INTO`, funciones peligrosas y catálogos/relaciones prohibidos; los argumentos literales de `current_setting` se validan por separado contra la allowlist de R37. R01 conserva legítimamente `server_version` y `server_version_num`. Para una aprobación formal se debe usar un parser PostgreSQL y exigir nodos superiores y CTE de tipo consulta, sin cláusula `INTO`. No se instaló un parser en esta fase.

La allowlist manual observada incluye funciones `pg_catalog` de inspección, formateo, ACL, JSON, hash y texto. R34 agrega `aclexplode`; R36 agrega `has_table_privilege`, `has_any_column_privilege`, `has_sequence_privilege` y `has_function_privilege`; R37 agrega sólo `current_setting(..., true)` para sus dos nombres allowlisted. `has_function_privilege` consulta permisos de catálogo y no invoca la rutina examinada. `pg_get_functiondef` sólo se usa dentro de `md5`/`octet_length`; el cuerpo no sale en el resultado. `pg_get_indexdef`, `pg_get_triggerdef`, `pg_get_constraintdef` y `pg_get_viewdef` devuelven evidencia de catálogo solicitada, no instrucciones aprobadas para replay.

Como defensa adicional, cuando se ejecute manualmente debe usarse un rol auditor sin permisos de escritura y una sesión marcada externamente como read-only, si el entorno dispone de ambos controles. Eso no sustituye la revisión del archivo.

## 5. Ejecución manual en Supabase SQL Editor

La ejecución corresponde a una persona autorizada y ocurre **después** de esta fase:

1. Abrir el proyecto Supabase correcto y confirmar visualmente organización, proyecto y entorno. No pegar project refs, claves ni conexiones en este documento.
2. Abrir un query nuevo en SQL Editor y copiar el archivo sin agregar prefijos, sufijos ni comandos de sesión.
3. Ejecutar primero los resultados 01, 02 y 03, un bloque a la vez. Confirmar versión y schemas. El resultado 02 incluye además los indicadores `storage_buckets_disponible` e `historial_migraciones_disponible` mediante `to_regclass`, sin leer esas tablas.
4. Ejecutar los resultados 04–23 individualmente. Guardar cada grid antes de continuar.
5. Ejecutar el resultado 24 sólo si `storage_buckets_disponible` es verdadero en el resultado 02.
6. Ejecutar el resultado 25 sólo si `historial_migraciones_disponible` es verdadero en el resultado 02. La consulta no devuelve cuerpos de migración.
7. Ejecutar 26–37 individualmente y conservar también resultados vacíos. En R34 y R36, “cero filas” es evidencia relevante, no un error. R35 debe devolver al menos una fila de estado para cada uno de sus cuatro roles de origen, aunque el rol no exista o carezca de membresías.
8. En R37, `disponible = false`, `valor = null` y el diagnóstico de configuración no visible significan **desconocido desde esa sesión**; no autorizan a inferir `public` ni ausencia de exposición. Confirmar que el grid contiene exactamente los dos parámetros allowlisted.
9. Si un bloque falla por versión o ausencia de un objeto Supabase, guardar el número, el error completo y la versión PostgreSQL; no improvisar una variante que consulte datos.
10. Cerrar el editor sin guardar credenciales ni crear snippets públicos.

Los grids 04, 05–10, 19, 20, 24 y 34–37 pueden contener metadatos estructurales sensibles. Deben revisarse **dentro del SQL Editor antes de exportar**. Si aparece un email, UUID personal, JWT, clave, password, token u otro secreto, cancelar la exportación cruda, no copiar el valor y registrar sólo la identidad del resultado, el motivo de redacción y un hash calculado dentro del perímetro autorizado.

Una condición `to_regclass(...)` no evita el error de parse de una consulta que referencia directamente una relación ausente. Por eso los bloques 24 y 25 se condicionan manualmente, sin SQL dinámico.

## 6. Resultados que deben guardarse

Registrar los 37 resultados, uno por bloque, con nombres deterministas. Un grid que supere la revisión de privacidad puede guardarse como CSV; uno que contenga un literal sensible se guarda únicamente como evidencia redactada/manifiesto, nunca como CSV crudo:

```text
01_version_postgresql.csv
02_esquemas_relevantes.csv
03_relaciones_public.csv
04_columnas_public.csv
05_claves_primarias.csv
06_claves_foraneas.csv
07_restricciones_unicas.csv
08_restricciones_control.csv
09_indices_public.csv
10_triggers.csv
11_rutinas.csv
12_argumentos_y_retorno.csv
13_propietarios_rutinas.csv
14_modo_seguridad_rutinas.csv
15_proconfig_y_ruta.csv
16_privilegios_rutinas.csv
17_privilegios_relaciones_secuencias.csv
18_estado_rls.csv
19_policies_completas.csv
20_vistas.csv
21_secuencias.csv
22_extensiones.csv
23_tipos_enum.csv
24_storage.csv
25_historial_migraciones_supabase.csv
26_objetos_esperados_ausentes.csv
27_policies_duplicadas_o_historicas.csv
28_grants_roles_api.csv
29_rutinas_publicas.csv
30_rutinas_privilegiadas_ruta.csv
31_tablas_expuestas_sin_rls.csv
32_rls_sin_policies.csv
33_propietarios_inesperados.csv
34_privilegios_columnas.csv
35_membresias_roles_api.csv
36_privilegios_efectivos_roles_api.csv
37_esquemas_postgrest_expuestos.csv
```

Junto a los CSV debe guardarse un manifiesto fuera del repositorio con:

- fecha/hora y zona horaria;
- resultado 01 completo;
- usuario auditor utilizado, sin credenciales;
- SHA-256 del SQL ejecutado después de normalizar sus finales de línea a LF;
- confirmación de completitud 01–37 y, para R37, disponibilidad observada de cada setting allowlisted;
- conteo de filas por resultado;
- errores o resultados omitidos y su justificación;
- SHA-256 de cada CSV.

El almacén debe estar cifrado, con control de acceso y retención definida. No añadir las salidas crudas al repositorio ni enviarlas por correo/chat sin revisión de privacidad.

## 7. Datos que no deben copiarse

Nunca copiar ni consultar:

- filas de empleados, salarios, DPI, NIT, IGSS, cuentas bancarias o planilla;
- movimientos, cheques, pagos, clientes, proveedores o documentos;
- `auth.users`, identidades, emails, hashes o factores MFA;
- nombres/paths de `storage.objects`, contenidos o signed URLs;
- JWT, anon key, service role key, passwords, DSN, cookies o secretos;
- valores de variables de entorno;
- cualquier setting de PostgREST distinto de los dos nombres allowlisted en R37;
- `pg_proc.prosrc`, cuerpos de funciones o el campo de sentencias del historial de migraciones;
- `last_value` de secuencias, conteos de filas o tamaños que revelen volumen de negocio.

Las expresiones de defaults, constraints, views, triggers y policies son metadatos requeridos, pero podrían contener literales sensibles por un diseño defectuoso. El resultado 04 aplica una redacción preventiva a defaults sospechosos. Los nombres de roles, rutas de membresía, capacidades efectivas y schemas expuestos también son evidencia de seguridad restringida. Todo debe revisarse dentro del entorno autorizado antes de exportarlo.

## 8. Cómo comparar los resultados con Git

Usar identidad estructural, no posición ni formato:

| Clase | Clave de comparación |
|---|---|
| Relación | `schema + nombre + relkind` |
| Columna | `schema + relación + ordinal/nombre` |
| Constraint | `schema + tabla + nombre + tipo` |
| Índice | `schema + tabla + nombre` |
| Trigger | `schema + tabla + nombre` |
| Rutina | `schema + nombre + argumentos de identidad` |
| Policy | `schema + tabla + nombre` |
| Vista | `schema + nombre` |
| ACL directa/default | `clase + schema + objeto + beneficiario + privilegio` |
| ACL por columna | `schema + relación + columna + otorgante + beneficiario + privilegio` |
| Membresía de rol | `rol origen + rol concedido + profundidad + ruta` |
| Privilegio efectivo | `rol + clase + schema + objeto/firma + privilegio` |
| Setting PostgREST | `nombre del setting` |
| Storage | `bucket id/nombre`, y policy por `tabla + nombre` |

Procedimiento:

1. Verificar hashes y conteos del paquete recibido.
2. Ordenar cada resultado por su clave compuesta sin cambiar expresiones.
3. Normalizar sólo identificadores no entrecomillados y espacios para el primer diff; conservar siempre el valor original.
4. Comparar las 60 relaciones con 03/04, los 30 `CREATE TABLE` locales y los usos de aplicación.
5. Comparar PK/FK/UNIQUE/CHECK e índices con 05–09, no sólo por nombre: definición y validación importan.
6. Comparar las 41 funciones locales y 21 RPC usadas con 11–16, 29 y 30. Los overloads se distinguen por argumentos de identidad.
7. Comparar el conjunto completo de policies con 18/19/27. Una policy remota adicional puede ampliar acceso aunque todas las esperadas existan.
8. Comparar ACL directas/default con 16/17/28/29, ACL de columna con 34, rutas de membresía con 35 y capacidades efectivas con 36. Ninguna de esas fuentes sustituye a las demás.
9. Comparar la vista y Storage con 20 y 24; actualmente no tienen fuente local reproducible. Contrastar además los schemas de API visibles en 37.
10. Comparar la única migración local con 25 únicamente por identidad/orden. La palabra “aplicada” en un archivo no prueba historial remoto.
11. Registrar cada diferencia en la matriz, con evidencia remota, evidencia Git, confianza y propietario de decisión.

No comparar únicamente hashes cuando una definición cambia por diferencias benignas de pretty-print. Tampoco considerar equivalentes dos objetos sólo porque comparten nombre.

### ACL explícita, membresía y privilegio efectivo

Una ACL directa o predeterminada describe cómo quedó registrado un grant; no demuestra por sí sola la capacidad efectiva de un rol. R36 calcula esa capacidad mediante las funciones `has_*_privilege`, que también pueden resultar verdaderas por `PUBLIC`, ownership o una membresía heredada. A la inversa, `has_any_column_privilege = true` no prueba que exista una ACL específica en `pg_attribute.attacl`: un privilegio de tabla también la satisface. R34 es la evidencia separada de grants explícitos por columna.

Las membresías de R35 pueden ampliar acceso a `anon`, `authenticated`, `service_role` o `authenticator`. La ruta y la opción heredable de cada tramo determinan si la herencia automática continúa; para catálogos anteriores que no exponen esa opción por grant, R35 usa `rolinherit` del rol miembro como fallback. `admin_option` describe capacidad de delegar una membresía y no prueba acceso a un objeto. Un `REVOKE` aplicado a la tabla tampoco elimina necesariamente un grant concedido separadamente sobre una columna, por lo que R34 debe reconciliarse aunque la ACL de tabla parezca restrictiva.

R36 informa permisos de objeto, no acceso final a filas ni operatividad del endpoint: deben comprobarse además la existencia del rol en R35, `USAGE` del schema, RLS, policies, seguridad de vistas y configuración PostgREST. R37 sólo observa los dos settings allowlisted desde la sesión que ejecuta el snapshot. `pgrst.db_schemas` identifica schemas expuestos cuando es visible; `pgrst.db_extra_search_path` amplía la ruta auxiliar de las solicitudes pero no crea endpoints por sí solo. Un valor `null` deja el estado desconocido, porque PostgREST también puede recibir configuración fuera de esa sesión.

## 9. Las 60 relaciones usadas por la aplicación

La lista se obtuvo de 339 llamadas estáticas `.from("literal")`, más resolución manual de llamadas dinámicas. Son 59 tablas esperadas y una vista esperada; la clase real se confirma con el resultado 03.

```text
activos_fijos
activos_fijos_depreciaciones
activos_fijos_movimientos
asientos_contables
auditoria_eventos
borradores_trabajo
calendario_eventos
catalogo_cuentas
chequeras
cheques
cheques_fisicos
cheques_historial
clientes
conciliacion_ajustes
conciliacion_cuentas_bancarias
conciliacion_estados_cuenta
conciliacion_movimientos_banco
conciliacion_vinculos
cuentas_por_cobrar
cuentas_por_pagar
distribuciones_documentos_contables
documentos_contables_revision
documentos_tramites
empleados_planilla
empresas
fondos_empresa
idempotency_keys_operativas
importaciones_empleados
impuestos_calendario
impuestos_configuracion
impuestos_documentos
impuestos_periodos
impuestos_resumen_periodo
intentos_bloqueados
logs
modulos_sistema
monitoreo_alertas
movimientos
movimientos_historial
ordenes_compra
ordenes_compra_firmas
ordenes_compra_historial
pagos_cuentas_por_cobrar
pagos_cuentas_por_pagar
perfiles
periodos_contables
planilla_configuracion_tasas
planilla_prestamos_descuentos
planillas
planillas_periodos
proveedores
proyectos_centros_costo
proyectos_movimientos
proyectos_presupuestos
reinicios_controlados
tareas
usuario_empresas
usuario_funciones_operativas
usuario_modulos
vista_resumen_chequeras
```

Las llamadas dinámicas no agregan una relación 61:

- `app/empresas/page.tsx:582` usa una allowlist de dependencias;
- `app/importaciones/page.tsx:1922` resuelve cinco tablas ya listadas;
- `lib/reinicioControlado.ts:750` recibe nueve literales ya incluidos;
- `lib/documentosTramites.ts:299,582` apunta a Storage, no a `public`;
- `app/empleados/page.tsx:36` elige dinámicamente entre dos RPC incluidas.

## 10. Relaciones sin `CREATE TABLE` local

Sólo 23 de las 60 relaciones tienen definición local de tabla. Las **37 sin `CREATE TABLE` local** son:

```text
asientos_contables
auditoria_eventos
borradores_trabajo
calendario_eventos
catalogo_cuentas
chequeras
cheques
cheques_fisicos
cheques_historial
clientes
cuentas_por_cobrar
cuentas_por_pagar
distribuciones_documentos_contables
documentos_contables_revision
documentos_tramites
empresas
fondos_empresa
impuestos_configuracion
logs
modulos_sistema
movimientos
movimientos_historial
ordenes_compra
ordenes_compra_firmas
ordenes_compra_historial
pagos_cuentas_por_cobrar
pagos_cuentas_por_pagar
perfiles
periodos_contables
planillas
proveedores
reinicios_controlados
tareas
usuario_empresas
usuario_funciones_operativas
usuario_modulos
vista_resumen_chequeras
```

`vista_resumen_chequeras` se clasifica como vista esperada, no tabla, pero se conserva en esta lista porque no existe ninguna definición local del objeto. `impuestos_configuracion` no tiene definición base local; sólo hay `ALTER`, índices, RLS, grants/revokes y policies parciales que presuponen su existencia.

Las 23 relaciones de aplicación con `CREATE TABLE` local son:

```text
activos_fijos
activos_fijos_depreciaciones
activos_fijos_movimientos
conciliacion_ajustes
conciliacion_cuentas_bancarias
conciliacion_estados_cuenta
conciliacion_movimientos_banco
conciliacion_vinculos
empleados_planilla
idempotency_keys_operativas
importaciones_empleados
impuestos_calendario
impuestos_documentos
impuestos_periodos
impuestos_resumen_periodo
intentos_bloqueados
monitoreo_alertas
planilla_configuracion_tasas
planilla_prestamos_descuentos
planillas_periodos
proyectos_centros_costo
proyectos_movimientos
proyectos_presupuestos
```

Siete tablas auxiliares se crean localmente pero no son una `.from("literal")` directa de la aplicación: `control_assist_auditoria`, `empleados_cuentas_bancarias`, `empleados_historial`, `empleados_operaciones_idempotentes`, `importaciones_empleados_filas`, `planilla_detalle` y `rate_limits_operativos`.

## 11. RPC usadas por la aplicación

| RPC | Primera evidencia | Definición local |
|---|---|---|
| `actualizar_empleado_v2` | `app/empleados/page.tsx:36` | migración V2:392 |
| `anular_asiento_contable` | `lib/contabilidadV2.ts:1966` | `sql/rpc_anular_asiento_contable.sql:5` |
| `anular_cheque_transaccional` | `app/cheques/page.tsx:2239` | `sql/rpc_cheques.sql:913` |
| `anular_pago_cxc` | `app/cuentas-cobrar/page.tsx:688` | `sql/rpc_pagos_cxp_cxc.sql:703` |
| `anular_pago_cxp` | `app/cuentas-pagar/page.tsx:694` | `sql/rpc_pagos_cxp_cxc.sql:252` |
| `autorizar_cheque_transaccional` | `app/cheques/page.tsx:2092` | `sql/rpc_cheques.sql:527` |
| `cerrar_periodo_contable` | `lib/contabilidadV2.ts:2409` | `sql/rpc_cerrar_periodo_contable.sql:5` |
| `contabilizar_documento_contable` | `lib/contabilidadV2.ts:1759` | `sql/rpc_contabilizar_documento_contable.sql:4` |
| `crear_cheque_transaccional` | `app/cheques/page.tsx:1885` | `sql/rpc_cheques.sql:13` |
| `crear_empleado_v2` | `app/planilla/page.tsx:545` | migración V2:321 |
| `eliminar_empresa_vacia_segura` | `app/empresas/page.tsx:733` | `sql/rpc_limpieza_empresas.sql:11` |
| `finalizar_asiento_contable` | `lib/contabilidadV2.ts:2003` | `sql/rpc_finalizar_asiento_contable.sql:6` |
| `generar_cheques_de_chequera` | `app/cheques/page.tsx:1591` | **Ausente** |
| `importar_empleados_v2` | `components/ImportarEmpleadosExcel.tsx:52` | migración V2:528 |
| `pagar_cheque_transaccional` | `app/cheques/page.tsx:2339` | `sql/rpc_cheques.sql:1112` |
| `rechazar_cheque_transaccional` | `app/cheques/page.tsx:2165` | `sql/rpc_cheques.sql:719` |
| `registrar_asiento_completo` | `lib/contabilidadV2.ts:1184` | `sql/rpc_asientos_contables.sql:7` |
| `registrar_pago_cxc` | `app/cuentas-cobrar/page.tsx:564` | `sql/rpc_pagos_cxp_cxc.sql:472` |
| `registrar_pago_cxp` | `app/cuentas-pagar/page.tsx:570` | `sql/rpc_pagos_cxp_cxc.sql:18` |
| `registrar_rate_limit_operativo` | `lib/rateLimitOperativo.ts:80` | `sql/rpc_rate_limit_operativo.sql:9` |
| `validar_importacion_empleados_v2` | `components/ImportarEmpleadosExcel.tsx:36` | migración V2:509 |

Son 21 nombres: 20 tienen alguna definición local y `generar_cheques_de_chequera` depende por completo del remoto. La existencia de una definición local no prueba que la firma, body, owner, `proconfig` o ACL coincidan.

El resultado 26 verifica que las 20 firmas conocidas existan como función por nombre y tipos de entrada. Para `generar_cheques_de_chequera`, si el nombre existe devuelve expresamente `nombre_presente_firma_no_versionada`, sin declarar compatibilidad; si no existe, informa ausencia. Los nombres/modos de parámetros y la cantidad de defaults se validan con el resultado 12. Esto es obligatorio porque PostgREST resuelve las claves JSON enviadas por `.rpc()` contra los nombres de argumentos.

## 12. Funciones definidas localmente

Se detectaron 41 nombres únicos y ningún procedimiento:

```text
actualizar_empleado_v2
anular_asiento_contable
anular_cheque_transaccional
anular_pago_cxc
anular_pago_cxp
autorizar_cheque_transaccional
cerrar_periodo_contable
contabilidad_autorizado
contabilidad_empresa_permitida
contabilizar_documento_contable
crear_cheque_transaccional
crear_empleado_v2
eliminar_empresa_vacia_segura
empleados_empresa_permitida_v2
empleados_fallar_operacion_v2
empleados_puede_escribir_v2
empleados_puede_estado_v2
empleados_puede_sensible_v2
empleados_reservar_operacion_v2
empleados_snapshot_auditable_v2
empleados_try_bigint_v2
empleados_try_date_v2
empleados_try_integer_v2
empleados_try_numeric_v2
empleados_try_uuid_v2
empleados_validar_fila_v2
finalizar_asiento_contable
importar_empleados_v2
monitoreo_alertas_set_actualizado_at
movimientos_empresa_asignada
movimientos_puede_anular
movimientos_puede_escribir
pagar_cheque_transaccional
rechazar_cheque_transaccional
registrar_asiento_completo
registrar_pago_cxc
registrar_pago_cxp
registrar_rate_limit_operativo
seguridad_operativa_set_actualizado_at
validar_anulacion_movimiento_operativo
validar_importacion_empleados_v2
```

Los resultados 11–16 deben compararse por firma completa. Una coincidencia sólo por nombre mezclaría overloads. El resultado 11 entrega hash y longitud de la definición sin exportar su body.

## 13. Vistas y buckets esperados

### Vista

- `public.vista_resumen_chequeras`
- Uso: `app/cheques/page.tsx:881`.
- Estado local: no existe ningún `CREATE VIEW` ni materialized view.
- Evidencia requerida: resultado 20, incluidos owner, definición, `security_invoker`, barrera y grants.

### Bucket

- `documentos-tramites`
- Constante: `lib/documentosTramites.ts:102`.
- Upload: `lib/documentosTramites.ts:298-303`.
- La aplicación exige que sea privado: `lib/documentosTramites.ts:565-566`.
- Usa URL firmada: `lib/documentosTramites.ts:581-583`.
- Estado local: no hay creación del bucket ni policies de `storage.objects` versionadas.
- Evidencia requerida: resultado 24, sin consultar paths ni owners de archivos.

## 14. Matriz de reconciliación inicial

“Pendiente R03/R20” significa que no existe todavía evidencia remota. No es una afirmación de presencia ni equivalencia.

| Objeto remoto esperado | Objeto local | ¿Coincide? | Diferencia preliminar | Riesgo si diverge |
|---|---|---|---|---|
| `activos_fijos` | `sql/activos_fijos_base.sql:6` | Pendiente R03 | Por determinar | Alto: estructura/RLS |
| `activos_fijos_depreciaciones` | `sql/activos_fijos_base.sql:123` | Pendiente R03 | Por determinar | Alto: cálculo financiero |
| `activos_fijos_movimientos` | `sql/activos_fijos_base.sql:79` | Pendiente R03 | Por determinar | Alto: trazabilidad |
| `asientos_contables` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: contabilidad |
| `auditoria_eventos` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: evidencia |
| `borradores_trabajo` | Sin definición base | No determinable | Remoto no versionado si existe | Medio: workflow |
| `calendario_eventos` | Sin definición base | No determinable | Remoto no versionado si existe | Medio |
| `catalogo_cuentas` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: contabilidad |
| `chequeras` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: tesorería |
| `cheques` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: tesorería |
| `cheques_fisicos` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: integridad |
| `cheques_historial` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: trazabilidad |
| `clientes` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: tenant/PII |
| `conciliacion_ajustes` | `sql/conciliacion_bancaria_base.sql:162` | Pendiente R03 | Por determinar | Alto: conciliación |
| `conciliacion_cuentas_bancarias` | `sql/conciliacion_bancaria_base.sql:21` | Pendiente R03 | Por determinar | Alto: datos bancarios |
| `conciliacion_estados_cuenta` | `sql/conciliacion_bancaria_base.sql:47` | Pendiente R03 | Por determinar | Alto: integridad |
| `conciliacion_movimientos_banco` | `sql/conciliacion_bancaria_base.sql:79` | Pendiente R03 | Por determinar | Alto: integridad |
| `conciliacion_vinculos` | `sql/conciliacion_bancaria_base.sql:129` | Pendiente R03 | Por determinar | Alto: integridad |
| `cuentas_por_cobrar` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: finanzas |
| `cuentas_por_pagar` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: finanzas |
| `distribuciones_documentos_contables` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: contabilidad |
| `documentos_contables_revision` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: workflow contable |
| `documentos_tramites` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: documentos |
| `empleados_planilla` | `sql/planilla_base.sql:10` + migración | Pendiente R03 | Dos estados locales posibles | Alto: PII/planilla |
| `empresas` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: raíz tenant |
| `fondos_empresa` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: fondos |
| `idempotency_keys_operativas` | `sql/seguridad_operativa.sql:83` | Pendiente R03 | Por determinar | Alto: replay |
| `importaciones_empleados` | migración V2:55 | Pendiente R03 | Migración declara no ejecutada | Alto: PII/importación |
| `impuestos_calendario` | `sql/impuestos_base.sql:149` | Pendiente R03 | Por determinar | Medio |
| `impuestos_configuracion` | Sin base; con ALTER/índices/RLS/grants/policies | No determinable | Falta definición base | Alto: cálculo contable |
| `impuestos_documentos` | `sql/impuestos_base.sql:49` | Pendiente R03 | Por determinar | Alto: fiscal |
| `impuestos_periodos` | `sql/impuestos_base.sql:21` | Pendiente R03 | Por determinar | Alto: fiscal |
| `impuestos_resumen_periodo` | `sql/impuestos_base.sql:109` | Pendiente R03 | Por determinar | Alto: fiscal |
| `intentos_bloqueados` | `sql/seguridad_operativa.sql:55` | Pendiente R03 | Por determinar | Medio: seguridad |
| `logs` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: auditoría/privacidad |
| `modulos_sistema` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: autorización |
| `monitoreo_alertas` | `sql/monitoreo_alertas.sql:5` | Pendiente R03 | Por determinar | Medio |
| `movimientos` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: finanzas |
| `movimientos_historial` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: trazabilidad |
| `ordenes_compra` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: compras |
| `ordenes_compra_firmas` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: aprobación |
| `ordenes_compra_historial` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: trazabilidad |
| `pagos_cuentas_por_cobrar` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: pagos |
| `pagos_cuentas_por_pagar` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: pagos |
| `perfiles` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: autorización |
| `periodos_contables` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: cierres |
| `planilla_configuracion_tasas` | `sql/planilla_base.sql:145` | Pendiente R03 | Por determinar | Alto: cálculo |
| `planilla_prestamos_descuentos` | `sql/planilla_base.sql:169` | Pendiente R03 | Por determinar | Alto: planilla |
| `planillas` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: planilla |
| `planillas_periodos` | `sql/planilla_base.sql:46` | Pendiente R03 | Por determinar | Alto: planilla |
| `proveedores` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: tenant/finanzas |
| `proyectos_centros_costo` | `sql/proyectos_centros_costo_base.sql:6` | Pendiente R03 | Por determinar | Alto: imputación |
| `proyectos_movimientos` | `sql/proyectos_centros_costo_base.sql:84` | Pendiente R03 | Por determinar | Alto: integridad |
| `proyectos_presupuestos` | `sql/proyectos_centros_costo_base.sql:52` | Pendiente R03 | Por determinar | Alto: presupuesto |
| `reinicios_controlados` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: operaciones |
| `tareas` | Sin definición base | No determinable | Remoto no versionado si existe | Medio |
| `usuario_empresas` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: tenant |
| `usuario_funciones_operativas` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: autorización |
| `usuario_modulos` | Sin definición base | No determinable | Remoto no versionado si existe | Alto: autorización |
| `vista_resumen_chequeras` | Sin definición de vista | Pendiente R20 | Vista remota no versionada si existe | Alto: tenant/finanzas |

### RPC usadas

| Objeto remoto esperado | Objeto local | ¿Coincide? | Diferencia preliminar | Riesgo si diverge |
|---|---|---|---|---|
| `actualizar_empleado_v2` | migración V2:392 | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: PII |
| `anular_asiento_contable` | `rpc_anular_asiento_contable.sql:5` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: contabilidad |
| `anular_cheque_transaccional` | `rpc_cheques.sql:913` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: tesorería |
| `anular_pago_cxc` | `rpc_pagos_cxp_cxc.sql:703` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: pagos |
| `anular_pago_cxp` | `rpc_pagos_cxp_cxc.sql:252` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: pagos |
| `autorizar_cheque_transaccional` | `rpc_cheques.sql:527` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: tesorería |
| `cerrar_periodo_contable` | `rpc_cerrar_periodo_contable.sql:5` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: cierres |
| `contabilizar_documento_contable` | `rpc_contabilizar_documento_contable.sql:4` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: contabilidad |
| `crear_cheque_transaccional` | `rpc_cheques.sql:13` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: tesorería |
| `crear_empleado_v2` | migración V2:321 | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: PII |
| `eliminar_empresa_vacia_segura` | `rpc_limpieza_empresas.sql:11` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: destructiva |
| `finalizar_asiento_contable` | `rpc_finalizar_asiento_contable.sql:6` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: contabilidad |
| `generar_cheques_de_chequera` | Sin definición local | Pendiente R11/R16 | Remoto no versionado si existe | Alto: tesorería |
| `importar_empleados_v2` | migración V2:528 | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: PII/importación |
| `pagar_cheque_transaccional` | `rpc_cheques.sql:1112` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: pagos |
| `rechazar_cheque_transaccional` | `rpc_cheques.sql:719` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: tesorería |
| `registrar_asiento_completo` | `rpc_asientos_contables.sql:7` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: contabilidad |
| `registrar_pago_cxc` | `rpc_pagos_cxp_cxc.sql:472` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: pagos |
| `registrar_pago_cxp` | `rpc_pagos_cxp_cxc.sql:18` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: pagos |
| `registrar_rate_limit_operativo` | `rpc_rate_limit_operativo.sql:9` | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: abuso/disponibilidad |
| `validar_importacion_empleados_v2` | migración V2:509 | Pendiente R11/R12/R16 | Firma/body hash/ACL por comparar | Alto: PII/BOLA |

### Tablas auxiliares y Storage

| Objeto remoto esperado | Objeto local | ¿Coincide? | Diferencia preliminar | Riesgo si diverge |
|---|---|---|---|---|
| `control_assist_auditoria` | `seguridad_operativa.sql:110` | Pendiente R03 | No usada por `.from` directa | Alto: auditoría |
| `empleados_cuentas_bancarias` | migración V2:137 | Pendiente R03 | No usada por `.from` directa | Alto: datos bancarios |
| `empleados_historial` | migración V2:114 | Pendiente R03 | No usada por `.from` directa | Alto: trazabilidad/PII |
| `empleados_operaciones_idempotentes` | migración V2:82 | Pendiente R03 | No usada por `.from` directa | Alto: replay |
| `importaciones_empleados_filas` | migración V2:97 | Pendiente R03 | No usada por `.from` directa | Alto: PII/importación |
| `planilla_detalle` | `planilla_base.sql:93` | Pendiente R03 | No usada por `.from` directa | Alto: planilla |
| `rate_limits_operativos` | `seguridad_operativa.sql:20` | Pendiente R03 | No usada por `.from` directa | Medio: disponibilidad |
| bucket `documentos-tramites` | Sin definición local | Pendiente R24 | Bucket/policies/config no versionados | Alto: documentos |
| Conjunto de policies | 144 declaraciones locales | Pendiente R19/R27 | Set remoto completo por comparar | Alto: autorización |
| ACL de objeto para roles API | 65 grants y 94 revokes locales | Pendiente R16/R17/R28/R29 | ACL directa/default por comparar | Alto: exposición |
| ACL explícita por columna | Sin inventario local consolidado | Pendiente R34 | Puede persistir aunque se revoque el privilegio de tabla | Alto: exposición parcial |
| Membresías de roles API | Sin definición local reproducible | Pendiente R35 | Rutas directas/transitivas y herencia por comparar | Alto: expansión de acceso |
| Privilegios efectivos API | Resultado combinado de ACL, ownership, PUBLIC y membresías | Pendiente R36 | Capacidad efectiva por objeto/firma por comparar | Alto: exposición real |
| Schemas PostgREST | Sin configuración versionada confirmada | Pendiente R37 | `db_schemas` expone API; la ruta extra sólo auxilia resolución | Alto: superficie API |
| Owners y `proconfig` | Owners implícitos; 41 funciones | Pendiente R13/R15/R33 | Owner/config remoto por comparar | Alto: privilegios |

No se debe marcar “coincide” hasta comparar definición y controles, no sólo existencia.

## 15. Clasificación de diferencias

| Clase | Definición | Evidencia primaria | Tratamiento en esta fase |
|---|---|---|---|
| Objeto remoto ausente en Git | Existe remoto pero no hay definición local reproducible | 03, 11, 20, 24 vs inventario local | Registrar; no extraer ni desplegar automáticamente |
| Objeto Git ausente remoto | Hay definición/uso local pero no aparece en snapshot | 03, 11, 26 | Bloqueo funcional potencial; confirmar proyecto/schema |
| Definición diferente | Mismo objeto, columnas/firma/constraint/índice/body hash distinto | 04–12 | Comparación semántica y decisión humana |
| Policy adicional | Remoto contiene policy no versionada | 19, 27 | Revisar combinación permisiva/restrictiva y roles |
| Grant directo/default adicional | ACL de objeto excede lo esperado | 16, 17, 28, 29 | Revisar beneficiario, delegación y defaults |
| Grant de columna adicional | `attacl` concede acceso específico no reflejado por la ACL de tabla | 34 | Revisar columna, beneficiario y revokes históricos |
| Membresía inesperada | Un rol API pertenece directa o transitivamente a otro rol no previsto | 35 | Revisar ruta, tramo heredable, `rolinherit` y `admin_option` |
| Privilegio efectivo inesperado | Una función `has_*_privilege` confirma capacidad no explicada por la ACL directa esperada | 36 | Trazar PUBLIC, ownership, membresía, schema, RLS y policies |
| Configuración PostgREST inesperada | `db_schemas` visible incluye un schema no aprobado, o la ruta auxiliar difiere | 37 | Separar exposición de API y resolución auxiliar; `null` permanece desconocido |
| Función con `search_path` distinto | `proconfig` remoto no coincide o es inseguro | 15, 30 | Revisar owner, referencias calificadas y ACL |
| Vista insegura | Owner-rights, grants amplios o definición cruza tenant | 20 | Revisión manual y pruebas A/B futuras |
| Storage no versionado | Bucket/policies/config existen sólo remoto | 24 | Registrar configuración exacta; no copiar objetos |

Una policy adicional permisiva puede ampliar acceso por OR. Una tabla con RLS y cero policies puede ser un deny-all intencional; no debe clasificarse automáticamente como vulnerabilidad.

## 16. Criterios para decidir qué estado conservar

La decisión no es “remoto gana” ni “Git gana”. Para cada objeto se evalúa:

1. **Uso real:** qué rutas, RPC y jobs dependen de él.
2. **Linaje:** historial remoto, antigüedad del archivo, comentarios de despliegue y orden entre scripts.
3. **Seguridad:** tenant, rol, estado activo, RLS, ACL de objeto/columna, membresías, privilegios efectivos, owner, `search_path`, schemas PostgREST, invoker/definer y Storage.
4. **Integridad:** PK/FK/UNIQUE/CHECK, nulabilidad, defaults, locks e idempotencia.
5. **Compatibilidad:** firma RPC, columnas seleccionadas, embeds FK y estados usados por UI.
6. **Datos existentes:** sólo en una fase posterior y mediante estadísticas aprobadas, nunca copiando filas sensibles a esta evidencia.
7. **Pruebas:** posibilidad de reconstruir un entorno vacío y ejecutar pruebas actor A/B con datos sintéticos, verificando rutas de membresía, grants por columna, capacidades efectivas y superficie PostgREST.
8. **Reversibilidad:** plan de rollback probado y propietario de aprobación.

Reglas conservadoras:

- Un objeto remoto usado pero ausente de Git se conserva operativo temporalmente hasta documentarlo; eso no lo convierte en diseño aprobado.
- Un objeto local ausente remoto no se despliega sólo para “completar” el inventario.
- Una policy más permisiva nunca se conserva por compatibilidad sin análisis de abuso.
- Una policy más restrictiva tampoco se adopta sin probar disponibilidad y roles legítimos.
- Owners administrados de Supabase deben respetar sus expectativas de plataforma; `auth` y `storage` requieren especial cautela.
- Toda decisión necesita evidencia, aprobador técnico y aprobador de negocio/seguridad.

## 17. Plan futuro para crear el baseline — todavía no ejecutable

Después de cerrar la matriz:

1. Congelar cambios de esquema y nombrar responsables por dominio.
2. Aprobar qué definición conservar por objeto y documentar excepciones.
3. Diseñar en una fase posterior un baseline limpio, ordenado y sin datos de negocio.
4. Separar estructura, RLS, ACL de objeto/columna, membresías, funciones, configuración PostgREST, Storage y seeds de referencia.
5. Reconstruir un Supabase local/staging vacío usando sólo el futuro baseline.
6. Comparar ese entorno con el snapshot aprobado mediante schema diff de sólo lectura.
7. Ejecutar tests de firmas RPC, tenant A/B, roles/membresías, ACL directa/efectiva, RLS, constraints, exposición PostgREST, concurrencia y Storage con datos ficticios.
8. Preparar migraciones incrementales, rollback, backups y ventana de cambio.
9. Someter el paquete a revisión de seguridad y contabilidad antes de cualquier promoción.

Esta lista es metodología. No contiene ni autoriza DDL de reparación.

## 18. Riesgos de ejecutar scripts antiguos

1. La única migración, `202607110001_maestro_empleados_seguridad_v2.sql`, dice expresamente **NO EJECUTADA** en sus líneas 1–3. Depende además de objetos previos no migrados.
2. Los scripts `*_base.sql` usan formas idempotentes por nombre; pueden aceptar silenciosamente una tabla remota cuya definición diverge.
3. `sql/rpc_pagos_cxp_cxc.sql:13-16` elimina firmas anteriores antes de definir las actuales; fuera de orden podría romper clientes u overloads.
4. `sql/rpc_limpieza_empresas.sql` contiene una función privilegiada destructiva; no debe tratarse como inventario.
5. `sql/modulos_contables_base.sql` es un seed que cambia filas, no un baseline estructural.
6. `sql/movimientos_operativos_rls_propuesto.sql:3` dice que no debe ejecutarse automáticamente y modifica objetos sin definición base local.
7. `sql/contabilidad_formal_rls_revisable.sql` aplica 28 policies y dos funciones sobre seis tablas sin `CREATE TABLE` local.
8. `sql/impuestos_rls_base.sql` y `sql/impuestos_configuracion_contabilidad_rls.sql` repiten las mismas cuatro policies de `impuestos_configuracion`.
9. `empleados_planilla` tiene dos estados locales incompatibles: policies legacy y cierre V2. No deben coexistir por defecto.
10. Las 144 policies locales son permisivas. Policies remotas adicionales con nombres desconocidos podrían ampliar acceso.
11. Diez funciones privilegiadas no muestran revocación local explícita de PUBLIC; un grant posterior a `authenticated` no elimina por sí mismo el privilegio predeterminado.
12. No hay fuente local para owners, default privileges, grants de secuencias, extensiones, la vista, el bucket ni sus policies.
13. Un revoke de tabla en un script antiguo no demuestra que se hayan retirado grants concedidos por separado sobre columnas; R34 debe cerrar esa brecha.
14. Las membresías remotas y la configuración efectiva de schemas PostgREST pueden ampliar acceso sin una fuente Git reproducible.

Ningún script antiguo debe ejecutarse para “ver qué falta”. Primero se obtiene y revisa el snapshot.

## 19. Advertencia obligatoria sobre Planilla

> **NO EJECUTAR `sql/planilla_rls_base.sql`.**

La migración V2 advierte en `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql:739-740` que volver a ejecutarlo restauraría grants y policies directas que el cierre V2 pretende retirar. El script legacy concede lectura/escritura directa a `authenticated` y define 20 policies. Tampoco debe ejecutarse parcialmente, copiarse al SQL Editor ni usarse como mecanismo de diagnóstico.

## 20. Próximo paso al recibir los resultados

1. Verificar manifiesto, hashes, versión y que estén los 37 resultados o errores justificados.
2. Revisar privacidad antes de mover los CSV a cualquier repositorio de evidencia.
3. Poblar la matriz objeto por objeto y clasificar cada diferencia con la taxonomía de la sección 15.
4. Resolver primero: objetos usados ausentes, RPC/firma, vista, bucket, RLS/policies, ACL por columna, membresías, privilegios efectivos, schemas PostgREST, funciones privilegiadas y owners.
5. Solicitar validaciones puntuales de sólo lectura si un resultado es ambiguo; no ampliar a filas de negocio.
6. Emitir un dictamen de reconciliación: coincidencias, drift, estado a conservar y bloqueos.
7. Sólo después abrir una Fase 2 separada para diseñar el baseline y sus pruebas. Esta Fase 1 no lo crea.

## 21. Guía de interpretación de las 37 consultas

| Resultado | Pregunta que responde |
|---:|---|
| 01 | ¿Qué versión y rol produjeron la evidencia? |
| 02 | ¿Qué schemas existen, quién los posee y qué ACL tienen? |
| 03 | ¿Qué tablas/vistas existen en `public` y cuál es su clase? |
| 04 | ¿Qué columnas, tipos, nulabilidad y defaults existen? |
| 05–08 | ¿Qué PK, FK, UNIQUE y CHECK están realmente desplegados/validados? |
| 09 | ¿Qué índices existen y cuál es su definición de catálogo? |
| 10 | ¿Qué triggers existen y qué función invocan? |
| 11–16 | ¿Qué rutinas, firmas, owners, modo, config y ACL existen? |
| 17 | ¿Qué ACL directas/default tienen tablas, vistas y secuencias? |
| 18–19 | ¿Dónde está RLS y cuál es el conjunto completo de policies? |
| 20 | ¿Cómo están definidas y protegidas las vistas? |
| 21–23 | ¿Qué secuencias, extensiones y ENUM existen? |
| 24 | ¿Qué configuración/policies/grants de Storage existen sin leer objetos? |
| 25 | ¿Qué versiones aparecen en el historial Supabase? |
| 26 | ¿Qué relaciones o firmas RPC esperadas faltan en `public`? |
| 27 | ¿Qué policies parecen semánticamente duplicadas o históricas? |
| 28–29 | ¿Qué grants alcanzan roles API y qué rutinas quedan públicas? |
| 30 | ¿Qué funciones privilegiadas carecen de ruta vacía explícita? |
| 31 | ¿Qué tablas tienen ACL API pero no RLS? |
| 32 | ¿Qué tablas tienen RLS y cero policies? |
| 33 | ¿Qué owners salen de la allowlist inicial? |
| 34 | ¿Qué ACL explícitas conceden `SELECT`, `INSERT`, `UPDATE` o `REFERENCES` sobre columnas de `public`/`storage`? |
| 35 | ¿Qué membresías directas/transitivas parten de `anon`, `authenticated`, `service_role` o `authenticator`, por qué ruta y con qué señales de herencia/ciclo? |
| 36 | ¿Qué privilegios efectivos tienen `anon`, `authenticated` y `service_role` sobre relaciones, secuencias, funciones o procedimientos de `public`/`storage`? |
| 37 | ¿Son visibles desde esta sesión los dos settings allowlisted de schemas PostgREST y qué valor reportan? |

El patrón de nombres históricos en 27 es sólo una señal de revisión; no prueba obsolescencia. La allowlist de 33 es inicial y debe confirmarse contra la documentación y configuración del proyecto. R35 distingue rol ausente, rol sin membresías, membresía directa y transitiva; profundidad 1 significa directa. La ruta de OID, la bandera de ciclo y el límite de 16 tramos impiden recursión no acotada, mientras `truncada_por_limite` sólo se activa si quedó otro tramo no cíclico sin recorrer. En PostgreSQL que expone una opción de herencia por grant, R35 la incorpora por tramo; en versiones anteriores usa `rolinherit` del rol miembro como fallback compatible.

R34 y R36 no son duplicados: R34 enumera ACL específicas de columna y R36 calcula capacidades efectivas. R37 tampoco prueba por sí solo la configuración completa del servicio: `null` no equivale a `public`, y la ruta extra no es una lista de endpoints expuestos.

## 22. Referencias primarias

- [Catálogos de sistema PostgreSQL](https://www.postgresql.org/docs/current/catalogs-overview.html).
- [`pg_attribute.attacl` y ACL por columna](https://www.postgresql.org/docs/current/catalog-pg-attribute.html).
- [`pg_auth_members` y relaciones de membresía](https://www.postgresql.org/docs/current/catalog-pg-auth-members.html).
- [Funciones PostgreSQL de consulta de privilegios](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE).
- [Configuración de schemas y ruta auxiliar de PostgREST](https://docs.postgrest.org/en/v14/references/configuration.html#db-schemas).
- [`pg_policy` y relación con RLS](https://www.postgresql.org/docs/current/catalog-pg-policy.html).
- [Buckets y controles de acceso de Supabase Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- [Owners administrados de Supabase](https://supabase.com/docs/guides/platform/permissions).
- [CLI de Supabase e historial `supabase_migrations.schema_migrations`](https://supabase.com/docs/reference/cli/introduction).

Estas referencias explican los catálogos y expectativas de plataforma. No sustituyen el snapshot del proyecto concreto.
