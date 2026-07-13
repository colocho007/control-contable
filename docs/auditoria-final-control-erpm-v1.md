# Auditoría final exhaustiva, defensiva y basada en evidencia

## 1. Portada

**Sistema:** Control ERPM / Control+
**Repositorio:** `colocho007/control-contable`
**Proyecto auditado:** `C:\Users\User\control-contable`
**Rama obligatoria:** `audit/auditoria-final-control-erpm-v1`
**Commit auditado:** `0de637d` (`merge: integrar Maestro de Empleados V2`)
**Tipo de revisión:** estática, local, defensiva, de arquitectura, seguridad, lógica empresarial y calidad
**Objetivo de referencia:** OWASP ASVS 5.0.0 nivel 2; esta revisión **no** constituye certificación ni afirmación de cumplimiento formal
**Dictamen principal:** **NO-GO para producción y para piloto con datos reales**

Este documento refleja el código y los artefactos locales disponibles en el commit indicado. No afirma que la instancia remota de Supabase tenga exactamente ese esquema ni que el sistema sea invulnerable.

## 2. Fecha

Auditoría realizada el **13 de julio de 2026**, zona horaria **America/Guatemala**.

## 3. Alcance

Se incluyeron los 146 archivos versionados: 34 en `app/`, 5 en `components/`, 19 en `lib/`, 30 SQL (29 scripts y una migración), configuración de Next.js/TypeScript/ESLint, manifiestos y lockfile, tipos, documentación y activos públicos. Se analizaron:

- autenticación, sesión, proxy, autorización de interfaz y service role;
- 30 páginas, una Route Handler y ausencia de Server Actions;
- 60 relaciones de datos estáticas usadas por la aplicación, una vista referenciada y un bucket;
- 41 funciones SQL, 33 `SECURITY DEFINER`, 144 declaraciones de policies, 38 tablas con `ENABLE ROW LEVEL SECURITY`, 4 triggers y 82 índices;
- multiempresa, roles, módulos, RLS, grants, RPC, concurrencia, idempotencia, pagos, cheques, contabilidad y Empleados V2;
- Excel, carga/descarga de archivos, XSS, CSRF, CORS, CSP, secretos, dependencias, disponibilidad, privacidad, logs y manejo de errores;
- estado de Git, historial de nombres sensibles y patrones de secretos sin mostrar valores.

## 4. Limitaciones

- Por restricción expresa no se consultó ni modificó Supabase remoto, no se ejecutó SQL, no se aplicaron migraciones y no se usaron datos reales.
- El repositorio no contiene un baseline completo de base de datos. Por ello, `pg_policies`, grants, propietarios, `proacl`, `proconfig`, constraints, vistas, Auth y Storage efectivos quedan pendientes de contraste remoto de sólo lectura.
- No se ejecutaron exploits XLSX, fuerza bruta, carga, DoS ni concurrencia destructiva.
- No existe runner ni suite automatizada de tests. Las pruebas actor A/B, MFA, revocación, RLS y concurrencia requieren un Supabase local o staging aislado con datos ficticios.
- Los valores de `.env.local` no se leyeron ni se imprimieron. Sólo se confirmó la presencia de los nombres de variables y que el archivo está ignorado.
- Todos los archivos versionados fueron inventariados y sometidos a búsquedas transversales. La revisión semántica profunda se concentró en los 30 SQL y en rutas críticas; no se hizo lectura manual línea por línea de cada página de dominio extensa ni de los 37 documentos históricos.
- Un defecto “confirmado” significa confirmado en el código versionado. Cuando su explotación depende del despliegue real, se indica expresamente; no se presume que un script manual esté aplicado.

## 5. Metodología

1. Se congeló alcance lógico en la rama existente y se verificó un árbol inicialmente limpio.
2. Se inventariaron rutas, clientes Supabase, relaciones, RPC, policies, grants, triggers, datos sensibles y flujos.
3. Se revisó la documentación local de Next.js 16.2.6 para Proxy, Route Handlers, autenticación, data security, CSP y headers antes de evaluar el código.
4. Se ejecutaron TypeScript, lint, build, `npm audit`, `npm outdated`, verificaciones Git y un smoke test localhost sin credenciales ni mutaciones.
5. Se modelaron actores, activos, fronteras de confianza y escenarios multiempresa.
6. Se trazó cada hallazgo a evidencia `archivo:línea`, impacto, reproducción segura, reparación y regresión.
7. Se usaron como marco conceptual [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/), [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/), [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS), CWE y las cheat sheets oficiales de [CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) y [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

No se calculó una puntuación de cumplimiento ASVS: faltan evidencia dinámica, configuración del proveedor y estado remoto.

## 6. Versiones

| Componente | Versión observada | Nota |
|---|---:|---|
| Aplicación | `0.1.0` | Privada |
| Next.js | `16.2.6` | App Router y `proxy.ts` |
| React / React DOM | `19.2.4` | 29 páginas cliente |
| TypeScript | `5.9.3` | `strict: false`, `skipLibCheck: true` |
| Node / npm usados en auditoría | `24.15.0` / `11.12.1` | No fijados en `engines` ni `packageManager` |
| `@supabase/ssr` | `0.10.3` | Hay actualización `0.12.0`; requiere migración probada |
| `@supabase/supabase-js` | `2.105.4` | Wanted/Latest `2.110.3` |
| `@supabase/auth-helpers-nextjs` | `0.15.0` | No soportado y sin usos en fuentes |
| `xlsx` | `0.18.5` | Dos advisories altos; npm no ofrece versión corregida |
| ESLint | `9.39.4` | Quality gate falla |
| Lockfile | v3, 494 entradas | Integridad presente en las 493 entradas transitivas |

## 7. Resumen ejecutivo

El proyecto tiene controles valiosos: proxy completo para páginas conocidas, `auth.getUser()` en servidor, service role confinado a una Route Handler, Empleados V2 con RPC, locks e idempotencia, RLS explícita en varios módulos, exports con neutralización de fórmulas, paths de Storage saneados y una base de CSP/headers. TypeScript y build terminan correctamente.

Sin embargo, esos controles no forman todavía una frontera consistente. La aplicación entrega el anon client al navegador y ejecuta 126 escrituras directas fuera de la API; por tanto, RLS/RPC son el control real. El repositorio sólo contiene una migración formal y no contiene DDL/RLS de 37 de las 60 relaciones consumidas. No es posible reconstruir o demostrar el estado efectivo de autorización.

La evidencia de código confirma riesgos altos: oráculo BOLA en la prevalidación de empleados; acceso completo a DPI/NIT/IGSS/salario por empresa sin autorización de módulo/columna; auditor que puede importar si combina funciones; pagos CxP/CxC sin función y sin negar auditor; cheques con bypass de empresa, sin segregación y con carrera de fondos; importaciones financieras que omiten RPC y transacciones; alta administrativa que permite a supervisor/jefe crear pares o superiores mediante service role; estados contables incompletos; parser `xlsx` vulnerable; uploads sin límites o validación; y un sink persistente de `javascript:` hacia `router.push` condicionado por RLS.

Conteo final de hallazgos:

| Crítica | Alta | Media | Baja | Informativa | Total |
|---:|---:|---:|---:|---:|---:|
| 0 | 19 | 11 | 1 | 2 | 33 |

Estados: **27 confirmados en repositorio**, **3 probables**, **1 necesita validación** y **2 hipótesis descartadas**. No se asignó severidad crítica sin validación segura del estado remoto. Los dos escenarios de cheques podrían escalar a crítica si el retest confirma despliegue y efecto financiero multiempresa material.

## 8. Lo bueno

- Rama correcta, sin merge abierto, sin conflictos y árbol inicialmente limpio.
- No se encontraron `.env`, llaves privadas, JWT ni archivos de riesgo versionados o en nombres históricos.
- Todas las páginas privadas conocidas están incluidas en `proxy.ts`; el proxy y la API usan `auth.getUser()`.
- Service role sólo aparece en `app/api/admin/perfiles/route.ts` y el cliente privilegiado se construye después de autenticación, perfil activo, rol y validación del body.
- Empleados V2 revoca escritura directa, usa `search_path=''`, referencias calificadas, allowlists, locks, idempotencia y control optimista en el update individual.
- Varias policies combinan `USING` y `WITH CHECK`, filtran empresa y niegan `DELETE` o auditor en escritura.
- Los RPC principales de contabilidad/pagos bloquean registros y agrupan parte de la lógica en transacciones.
- El importador V2 limita a 5 MB/1,000 filas, calcula SHA-256 y rechaza macros/fórmulas; los exports CSV neutralizan fórmulas y el HTML imprimible escapa valores.
- Storage usa nombres aleatorios, `upsert:false`, rutas con prefijo de empresa, URLs firmadas breves y revalida bucket/path antes de firmar.
- No se encontraron `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, SQL crudo de cliente ni CORS permisivo.
- CSP contiene `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` y existen XFO, nosniff, Referrer-Policy y Permissions-Policy.
- `npx tsc --noEmit` y `npm run build` terminaron en 0; el lock usa sólo registry npm con integridad y sin hooks raíz de instalación.

## 9. Lo malo

- No existe fuente de verdad reproducible de Supabase: 29 SQL manuales y sólo una migración, que además se etiqueta “NO EJECUTADA”.
- La autorización de módulo vive en React; las policies SQL versionadas no consultan `usuario_modulos`.
- El modelo combina roles globales, funciones por empresa y policies permisivas sin un helper único de denegación por defecto.
- Datos laborales y bancarios completos llegan al navegador aunque la UI oculte partes.
- Flujos financieros alternos realizan escrituras directas y operaciones parciales.
- El lint falla con 114 errores y 48 warnings, y no existe suite de tests.
- Los límites de rate, idempotencia y auditoría son manipulables o fail-open en varios caminos.
- `xlsx@0.18.5` procesa entradas no confiables y no tiene fix disponible en npm.
- Faltan controles de archivo, retención, minimización, MFA/step-up y endurecimiento de sesión demostrable.

## 10. Lo que hay que mejorar

La prioridad no es añadir más comprobaciones visuales, sino establecer una única capa autoritativa cerca del dato: baseline migrable, helpers de autorización empresa+módulo+función+activo, views/DTO de columnas mínimas, RPC transaccionales para estados sensibles, auditoría append-only y pruebas adversariales actor A/B. Después deben abordarse sesión/MFA, CSP por nonce, uploads en cuarentena, dependencias y quality gates.

## 11. GO / GO CON CONDICIONES / NO-GO

| Destino | Dictamen | Condiciones |
|---|---|---|
| Producción con datos reales | **NO-GO** | Hay fallos altos confirmados de autorización, integridad y privacidad. |
| Piloto interno conectado a datos reales | **NO-GO** | “Interno” no reduce el riesgo de usuario comprometido, error o abuso privilegiado. |
| Piloto aislado con datos sintéticos | **GO CON CONDICIONES** | Supabase separado; sin secretos/datos reales; deshabilitar altas administrativas, cheques, pagos, importaciones, documentos y Empleados sensibles; usuarios ficticios; logging y borrado al finalizar. |
| Desarrollo local estático | **GO CON CONDICIONES** | Mantener prohibición de SQL remoto y no interpretar build exitoso como seguridad. |

## 12. Hallazgos por severidad

**Altos:** F-001 a F-019.
**Medios:** F-020 a F-030.
**Bajo:** F-031.
**Informativos/descartados:** F-032 y F-033.
**Críticos:** ninguno confirmado con la evidencia permitida.

## 13. Tabla ejecutiva

| ID | Severidad | Estado | Título abreviado | P | Bloquea producción |
|---|---|---|---|---:|---|
| F-001 | Alta | Confirmado | Baseline Supabase no reproducible / drift | P0 | Sí |
| F-002 | Alta | Confirmado | RLS no aplica autorización de módulo | P0 | Sí |
| F-003 | Alta | Confirmado | Exposición de datos laborales sensibles | P0 | Sí |
| F-004 | Alta | Confirmado | BOLA/oráculo en prevalidación de empleados | P0 | Sí |
| F-005 | Alta | Confirmado | Auditor puede importar empleados | P0 | Sí |
| F-006 | Alta | Confirmado | Importación V2: fuga, TOCTOU y dedupe débil | P0 | Sí |
| F-007 | Alta | Confirmado | Elevación vertical en alta de perfiles | P0 | Sí |
| F-008 | Alta | Confirmado | CxP/CxC sin rol/función y auditor escribe | P0 | Sí |
| F-009 | Alta | Confirmado | Cheques: tenant bypass y sin SoD | P0 | Sí |
| F-010 | Alta | Probable | Sobrecompromiso y recálculo de fondos | P0 | Sí |
| F-011 | Alta | Confirmado | Mass assignment y transiciones directas | P0 | Sí |
| F-012 | Alta | Confirmado | Cambios administrativos no atómicos | P0 | Sí |
| F-013 | Alta | Confirmado | Importador financiero evita RPC | P0 | Sí |
| F-014 | Alta | Confirmado | Contabilización/finalización incompletas | P0 | Sí |
| F-015 | Alta | Confirmado | Idempotencia y rate limit controlables | P0 | Sí |
| F-016 | Alta | Confirmado | `xlsx` vulnerable con entrada no confiable | P0 | Sí |
| F-017 | Alta | Confirmado | Upload documental sin controles | P0 | Sí |
| F-018 | Alta | Probable | Sink XSS persistente en Monitoreo | P0 | Sí |
| F-019 | Alta | Confirmado | Mojibake rompe estado de cheques | P0 | Sí |
| F-020 | Media | Confirmado | Cookies SSR/inactividad frágiles | P1 | Sí |
| F-021 | Media | Necesita validación | MFA, recuperación y Auth assurance | P1 | Sí |
| F-022 | Media | Confirmado | CSRF/body/IP/rate limit de API | P1 | Sí |
| F-023 | Media | Confirmado | API parcial, replay y errores internos | P1 | Sí |
| F-024 | Media | Probable | `SECURITY DEFINER` inconsistente | P1 | Sí |
| F-025 | Media | Confirmado | CSP/HSTS/cache incompletos | P1 | No |
| F-026 | Media | Confirmado | Auditoría, logs y privacidad insuficientes | P1 | No |
| F-027 | Media | Confirmado | Invariantes y ciclo de vida incompletos | P2 | No |
| F-028 | Media | Confirmado | Disponibilidad y límites insuficientes | P1 | No |
| F-029 | Media | Confirmado | Lint/strict/tests: quality gate fallido | P1 | Sí |
| F-030 | Media | Confirmado | Supply chain y entorno no reproducible | P2 | No |
| F-031 | Baja | Confirmado | Consulta de auditoría RLS puede falsear | P3 | No |
| F-032 | Informativa | Descartado | Service role no se usa antes de checks | — | No |
| F-033 | Informativa | Descartado | Sin secreto versionado detectado | — | No |

## 14. Arquitectura

```text
Navegador no confiable
  ├─ React Client Components (29 páginas)
  ├─ anon key pública + sesión Supabase en cookies legibles por JS
  ├─ PostgREST directo: SELECT/INSERT/UPDATE/RPC
  └─ Storage directo: upload y signed URL
           │
           ├──────────── HTTPS/WSS ────────────┐
           │                                    │
Vercel / Next.js 16                             │
  ├─ proxy.ts: autentica páginas con getUser    │
  ├─ headers/CSP globales                       │
  └─ POST /api/admin/perfiles                   │
       ├─ cliente anon + cookie: auth/perfil    │
       └─ service role: Auth Admin + tablas ────┤
                                                ▼
Supabase
  ├─ Auth: credenciales, JWT, refresh
  ├─ PostgREST: RLS/grants = frontera principal
  ├─ PostgreSQL: tablas, policies, RPC SECURITY DEFINER
  └─ Storage: bucket documentos-tramites
```

La mayoría de operaciones no pasan por una BFF de Next.js. El proxy es una barrera de navegación, no de datos; un navegador manipulado puede llamar PostgREST/RPC directamente. La corrección debe estar en RLS/RPC/vistas, no sólo en botones o redirects.

## 15. Superficie de ataque

| Superficie | Entrada | Activos | Control actual | Brecha dominante |
|---|---|---|---|---|
| Login Supabase | email/password | credenciales/sesión | mensajes genéricos parciales | MFA/rate/policy no verificables; password se recorta |
| 28 rutas privadas | URL/cookie | todos los módulos | proxy `getUser` | rol/activo/empresa sólo después, en cliente |
| PostgREST directo | JWT + JSON/filtros | 60 relaciones | RLS/grants | baseline y policies raíz ausentes; módulo no aplicado |
| 21 RPC usadas | parámetros JSON | finanzas/empleados | checks variables | BOLA, rol, SoD, replay y concurrencia inconsistentes |
| API de perfiles | cookie + JSON | Auth/perfiles/roles | auth+rol+service role | jerarquía global, CSRF/body/rate y atomicidad |
| Excel | `.xlsx/.xls/.csv` | navegador y datos | 5 MB/1,000 filas parcial | parser vulnerable; validación después de parse |
| Storage | `File` arbitrario | documentos/bucket | path único/signed URL | sin tipo/tamaño/firma/AV/cuota/compensación |
| Export/print | datos consultados | PII/finanzas | escaping/formula neutralization | autorización/minimización depende de consulta |
| Monitoreo | rutas/eventos DB | sesión admin | React escaping | `router.push` con ruta persistida no validada |
| SQL manual | ejecución humana | esquema completo | comentarios/preflight parcial | orden/drift no reproducible; script inseguro reactivable |

### Actores y escenarios de abuso

| Actor | Escenario defensivo relevante | Resultado actual |
|---|---|---|
| Anónimo | entrar ruta/API, body grande, rotar IP | páginas redirigen y API autentica; Map/body siguen expuestos |
| Autenticado sin empresa | invocar prevalidación/import/rate directamente | BOLA de preview y tablas de control no exigen siempre perfil activo/empresa |
| Usuario empresa A | sustituir UUID/`empresa_id` de B | varias policies filtran; cheques/import/view no ofrecen garantía completa |
| Auxiliar/contador | cambiar campos de estado/totales no visibles | grants directos permiten intentarlo; RLS no es field-level |
| Auditor | llamar RPC de escritura o combinar funciones | pagos/import empleados permiten caminos de escritura |
| Supervisor/jefe | crear rol par/superior u operar empresa no asignada | API/cheques tienen bypass confirmado en código |
| Admin | autoaprobar, exportar PII, abrir ruta persistida | falta SoD/step-up; sink XSS condicionado |
| Usuario inactivo | conservar JWT y llamar tablas auxiliares | algunas policies sólo usan `auth.uid()` |
| Cuenta comprometida | usar sesión browser/refresh y alcance multiempresa | MFA/step-up no demostrados; tokens legibles por JS |
| Navegador manipulado | omitir botones/helpers y llamar PostgREST | RLS/RPC es la única defensa real |
| Bot/IP distribuida | evadir rate o agotar Map/body/parser | controles parciales/fail-open |
| UUID conocido | enumerar empleado o Auth sin perfil | F-004/F-007, con precondiciones descritas |
| Insider malicioso | fraude, borrado, logs fabricados | SoD/auditoría/retención incompletos |

### Inyecciones y sinks

No se confirmó SQL injection, command injection, SSRF, path traversal, CRLF/header injection, CSS injection, `eval`, `innerHTML` ni JavaScript dinámico. El SQL dinámico usa identificadores de allowlist o parámetros enlazados; los paths de documento se sanean y aleatorizan. Sí se confirmó un sink URL potencialmente XSS (F-018), parser con prototype pollution/ReDoS (F-016), MIME/upload no validado (F-017) y fórmula Excel no rechazada en el importador legacy. CSV/HTML exportados tienen neutralización/escaping. URLs remotas/callbacks de Auth y CORS/CDN desplegados necesitan validación externa.

## 16. Fronteras de confianza

1. **Internet/navegador → Vercel:** todos los headers, body, UUID, `empresa_id`, rol visual, archivos e idempotency keys son no confiables.
2. **Client Component → Supabase anon:** React no es frontera de seguridad. RLS/RPC debe recalcular sujeto, empresa, módulo y transición.
3. **Cookie/JWT → perfil de negocio:** autenticación no equivale a usuario activo, empresa asignada ni función autorizada.
4. **Empresa A ↔ empresa B:** cada objeto padre/hijo, view, RPC e historial necesita filtro tenant propio y FK compuesta.
5. **Anon ↔ service role:** service role omite RLS; toda operación debe ocurrir después de validación completa y en transacción limitada.
6. **Bytes/archivo → parser/datos:** extensión, MIME y valores del navegador no son evidencia de contenido seguro.
7. **Git/migraciones → Supabase remoto:** los scripts locales no prueban despliegue; el drift es una frontera operativa.
8. **Logs/auditoría → evidencia:** eventos escritos por cliente o fuera de la transacción no son evidencia autoritativa.

## 17. Inventario de rutas

| Tipo | Rutas |
|---|---|
| Pública | `/login` |
| Entrada | `/` reexporta Dashboard, pero `proxy.ts` redirige a `/login` o `/dashboard` |
| Protegidas (28) | `/activos-fijos`, `/admin`, `/auxiliar`, `/calendario`, `/cheques`, `/clientes`, `/conciliacion-bancaria`, `/contabilidad`, `/cuentas-cobrar`, `/cuentas-pagar`, `/dashboard`, `/documentos`, `/empleados`, `/empresas`, `/finanzas`, `/flujo-efectivo`, `/historial`, `/importaciones`, `/impuestos`, `/monitoreo-sistema`, `/ordenes-compra`, `/planilla`, `/proveedores`, `/proyectos`, `/reinicio-controlado`, `/reportes`, `/tareas`, `/usuarios` |
| Assets públicos | manifest, iconos PNG, favicon y SVG bajo `public/` |

`proxy.ts:4-33,88-120` cubre las 28 páginas privadas. No hay rutas dinámicas con parámetros. El smoke test localhost confirmó `/login` 200, una ruta inexistente 404 y headers globales en ambos.

## 18. Inventario de APIs

| Endpoint | Método | Auth | Autorización | Validación | Privilegio | Resultado de auditoría |
|---|---|---|---|---|---|---|
| `/api/admin/perfiles` | `POST` | cookie + `auth.getUser()` | perfil activo y rol `admin/jefe/supervisor` | UUID, email, rol e idempotency prefix; faltan CT/body/origin/máximos | service role + `auth.admin.getUserById` | F-007, F-022, F-023 |

No hay otras Route Handlers ni Server Actions. `GET /api/admin/perfiles` devolvió 405 localmente. Consumidores: `app/usuarios/page.tsx:146` y `app/admin/page.tsx:890`. La API no está en el matcher del proxy, pero realiza autenticación propia.

## 19. Inventario de tablas

### Relaciones usadas por la aplicación (60)

`activos_fijos`, `activos_fijos_depreciaciones`, `activos_fijos_movimientos`, `asientos_contables`, `auditoria_eventos`, `borradores_trabajo`, `calendario_eventos`, `catalogo_cuentas`, `chequeras`, `cheques`, `cheques_fisicos`, `cheques_historial`, `clientes`, `conciliacion_ajustes`, `conciliacion_cuentas_bancarias`, `conciliacion_estados_cuenta`, `conciliacion_movimientos_banco`, `conciliacion_vinculos`, `cuentas_por_cobrar`, `cuentas_por_pagar`, `distribuciones_documentos_contables`, `documentos_contables_revision`, `documentos_tramites`, `empleados_planilla`, `empresas`, `fondos_empresa`, `idempotency_keys_operativas`, `importaciones_empleados`, `impuestos_calendario`, `impuestos_configuracion`, `impuestos_documentos`, `impuestos_periodos`, `impuestos_resumen_periodo`, `intentos_bloqueados`, `logs`, `modulos_sistema`, `monitoreo_alertas`, `movimientos`, `movimientos_historial`, `ordenes_compra`, `ordenes_compra_firmas`, `ordenes_compra_historial`, `pagos_cuentas_por_cobrar`, `pagos_cuentas_por_pagar`, `perfiles`, `periodos_contables`, `planilla_configuracion_tasas`, `planilla_prestamos_descuentos`, `planillas`, `planillas_periodos`, `proveedores`, `proyectos_centros_costo`, `proyectos_movimientos`, `proyectos_presupuestos`, `reinicios_controlados`, `tareas`, `usuario_empresas`, `usuario_funciones_operativas`, `usuario_modulos`, `vista_resumen_chequeras`.

Sólo 23 de esas relaciones tienen `CREATE TABLE` local: activos (3), conciliación (5), `empleados_planilla`, seguridad operativa (3), importaciones, impuestos (4), monitoreo, planilla (3) y proyectos (3). Las otras **37** no tienen un `CREATE TABLE` local, aunque algunos scripts las alteran.

### Tablas creadas por SQL pero no usadas estáticamente por la app (7)

`control_assist_auditoria`, `empleados_cuentas_bancarias`, `empleados_historial`, `empleados_operaciones_idempotentes`, `importaciones_empleados_filas`, `planilla_detalle`, `rate_limits_operativos`.

### Vistas y Storage

- `vista_resumen_chequeras` se consume en `app/cheques/page.tsx:881`; no existe `CREATE VIEW`, por lo que no se puede confirmar `security_invoker`, propietario, grants ni filtro tenant.
- Bucket `documentos-tramites` en `lib/documentosTramites.ts:102`; no hay DDL/policies de Storage versionadas.

### Datos sensibles

| Categoría | Ejemplos | Ubicación principal |
|---|---|---|
| Identidad | DPI, NIT, IGSS, nombre, fecha nacimiento | `empleados_planilla`, imports, historiales |
| Laboral | salario, bonificación, contrato, puesto, retiro | empleados/planilla |
| Bancario | banco, cuenta legacy, cuenta enmascarada, fondos, cheques | empleados, proveedores, documentos, cheques |
| Financiero/fiscal | asientos, pagos, impuestos, presupuestos, saldos | contabilidad, CxP/CxC, impuestos, proyectos |
| Documental | archivos, MIME, paths, metadata, trámites | Storage + `documentos_tramites` |
| Seguridad | perfiles, roles, empresas, funciones, módulos, intentos | tablas raíz de autorización y seguridad operativa |
| Auditoría | usuario, empresa, entidad, estado, errores, IP hasheada | auditoría, logs, historiales, alertas |

## 20. Inventario de RPC

### Invocadas por la aplicación (21)

`actualizar_empleado_v2`, `anular_asiento_contable`, `anular_cheque_transaccional`, `anular_pago_cxc`, `anular_pago_cxp`, `autorizar_cheque_transaccional`, `cerrar_periodo_contable`, `contabilizar_documento_contable`, `crear_cheque_transaccional`, `crear_empleado_v2`, `eliminar_empresa_vacia_segura`, `finalizar_asiento_contable`, `generar_cheques_de_chequera`, `importar_empleados_v2`, `pagar_cheque_transaccional`, `rechazar_cheque_transaccional`, `registrar_asiento_completo`, `registrar_pago_cxc`, `registrar_pago_cxp`, `registrar_rate_limit_operativo`, `validar_importacion_empleados_v2`.

`generar_cheques_de_chequera` no tiene definición local. Las demás se distribuyen entre la migración V2 y scripts manuales.

### Funciones SQL definidas (41)

| Grupo | Funciones |
|---|---|
| Empleados V2 (17) | `empleados_try_bigint/integer/numeric/date/uuid_v2`, `empleados_empresa_permitida_v2`, `empleados_puede_escribir_v2`, `empleados_puede_sensible_v2`, `empleados_puede_estado_v2`, `empleados_snapshot_auditable_v2`, `empleados_reservar_operacion_v2`, `empleados_fallar_operacion_v2`, `crear_empleado_v2`, `actualizar_empleado_v2`, `empleados_validar_fila_v2`, `validar_importacion_empleados_v2`, `importar_empleados_v2` |
| Contabilidad (7) | `contabilidad_empresa_permitida`, `contabilidad_autorizado`, `registrar_asiento_completo`, `anular_asiento_contable`, `cerrar_periodo_contable`, `finalizar_asiento_contable`, `contabilizar_documento_contable` |
| Movimientos/seguridad (7) | `movimientos_empresa_asignada`, `movimientos_puede_escribir`, `movimientos_puede_anular`, `validar_anulacion_movimiento_operativo`, `seguridad_operativa_set_actualizado_at`, `monitoreo_alertas_set_actualizado_at`, `registrar_rate_limit_operativo` |
| Pagos (4) | `registrar_pago_cxp`, `anular_pago_cxp`, `registrar_pago_cxc`, `anular_pago_cxc` |
| Cheques (5) | `crear`, `autorizar`, `rechazar`, `anular`, `pagar_cheque_transaccional` |
| Administración (1) | `eliminar_empresa_vacia_segura` |

Se observaron 33 `SECURITY DEFINER`. V2 usa el patrón fuerte `search_path=''`; la mayoría de los definers anteriores usan `search_path=public` y revocaciones inconsistentes.

## 21. Inventario de policies

El repositorio declara **144 policies** (aprox. 140 nombres únicos por duplicación) y activa RLS en 38 tablas; no aparece `FORCE ROW LEVEL SECURITY`.

| Archivo/grupo | Policies | Tablas/área | Observación |
|---|---:|---|---|
| `activos_fijos_rls_base.sql` | 12 | activos, movimientos, depreciaciones | SELECT/INSERT/UPDATE amplios por empresa/rol |
| `conciliacion_bancaria_rls_base.sql` | 20 | cinco tablas | Estados/totales mutables directamente |
| `contabilidad_formal_rls_revisable.sql` | 28 | seis relaciones | Helpers y preflight parcial; `search_path=public` |
| `impuestos_rls_base.sql` | 20 | cinco tablas | Escritura directa de estados/valores |
| `impuestos_configuracion_contabilidad_rls.sql` | 4 | configuración | Definiciones duplicadas/alternativas |
| `movimientos_operativos_rls_propuesto.sql` | 4 | movimientos | Archivo marcado “propuesto” |
| `monitoreo_alertas.sql` | 4 | alertas | Mutación directa por roles permitidos |
| `proyectos_centros_costo_rls_base.sql` | 12 | proyectos/presupuestos/movimientos | Totales y estado sin RPC |
| `planilla_rls_base.sql` | 20 | empleados/períodos/detalle/tasas/préstamos | La V2 advierte no reejecutarlo |
| `seguridad_operativa.sql` | 14 | rate, intentos, idempotencia, control assist | Usuarios pueden escribir registros de control |
| Migración Empleados V2 | 6 | imports, filas, historial, bancos, empleados | Buen endurecimiento de escritura; SELECT demasiado amplio |

Cuatro triggers: `rate_limits_operativos_actualizado_at_trg`, `idempotency_keys_operativas_actualizado_at_trg`, `monitoreo_alertas_actualizado_at_trg` y `validar_anulacion_movimiento_operativo`.

Conclusión de inventario: el número de policies no demuestra cobertura. PostgreSQL combina policies permisivas con `OR`; el preflight V2 sólo rechaza policies desconocidas de escritura, no de lectura. Una policy legacy de SELECT puede sobrevivir.

## 22. Matriz de roles

### Resultado esperado por actor

Leyenda: `R` leer; `W` crear/actualizar operativo; `A` aprobar/anular; `S` datos sensibles; `U` administrar usuarios; `—` denegado. Siempre debe aplicarse empresa activa y módulo asignado.

| Actor | Empresa | R | W | A | Importar | Exportar | S | U |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Anónimo | ninguna | — | — | — | — | — | — | — |
| Autenticado sin empresa | ninguna | sólo perfil mínimo | — | — | — | — | — | — |
| Auxiliar | asignada | R | W limitada | — | según función | según módulo | — | — |
| Contador | asignada | R | W contable | según función/SoD | según función | según módulo | sólo `contador_revisor` | — |
| Auditor | asignada | R | — | — | — | R controlada | enmascarado/mínimo | — |
| Supervisor | asignada | R | W | A distinta del creador | según módulo | sí | sólo necesidad | U sólo subordinados y empresa |
| Jefe | asignada | R | W | A distinta del creador | según módulo | sí | necesidad justificada | U sólo alcance propio |
| Admin | global explícito | R | W | A con SoD | sí | sí | auditado/step-up | sí, con MFA/step-up |

### Módulo × responsabilidad × control esperado

| Módulo | Responsabilidad | Acción sensible | Control esperado | Evidencia actual |
|---|---|---|---|---|
| Dashboard/Finanzas/Flujo/Reportes | agregación y export | leer/exportar | DTO por empresa+módulo | depende de RLS; datos amplios al cliente |
| Admin/Usuarios | roles, módulos, empresas | administrar usuarios | jerarquía, tenant, MFA, transacción | F-007/F-012 |
| Empresas | ciclo de vida tenant | modificar/eliminar | admin + lock + FK completas | F-001/F-027 |
| Clientes/Proveedores | terceros y bancos | CRUD/export | empresa+función; banco mínimo | RLS raíz no versionada |
| Cheques | crear/autorizar/pagar/anular | fondos y SoD | empresa siempre + actores distintos | F-009/F-010/F-019 |
| Órdenes de compra | crear/firmar | aprobación | iniciador ≠ firmante; transacción | import evita firmas, F-013 |
| Contabilidad/Auxiliar | asientos/documentos/cierre | finalizar/anular/cerrar | período, balance, revisor distinto | F-011/F-014 |
| CxP/CxC | pagos y anulaciones | movimiento de fondos | cajero/pagador, auditor deny | F-008 |
| Conciliación | estados y vínculos | cerrar/ajustar | RPC de transición | escritura directa, F-011 |
| Impuestos | períodos/declaraciones | declarar/cerrar | función fiscal + invariantes | escritura directa, F-011/F-027 |
| Planilla/Empleados | PII y salarios | ver/importar/pagar | columna mínima, función sensible | F-003 a F-006 |
| Activos fijos | depreciar/contabilizar | valor libro | RPC + invariantes | escritura directa, F-011/F-027 |
| Proyectos | presupuestos/ejecución | comprometer fondos | función + constraints | escritura directa, F-011/F-027 |
| Documentos/Tareas/Calendario | archivos y colaboración | upload/descarga | tipo/tamaño/bucket/tenant | F-017 |
| Importaciones | carga masiva | múltiples módulos | RPC por tipo, no tabla dinámica | F-013/F-016 |
| Historial/Monitoreo | evidencia y alertas | cambiar estado/abrir ruta | append-only/URL allowlist | F-018/F-026 |
| Reinicio controlado | limpieza/recuperación | borrar/reiniciar | admin, bandera inmutable, dry-run | F-027 |

La matriz describe el comportamiento objetivo. El código actual se desvía especialmente en auditor, supervisor/jefe global, lectura sensible y operaciones directas.

## 23. Hallazgos detallados

### F-001 — Baseline Supabase no reproducible y drift no verificable

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A02:2025, A08:2025, API9 / ASVS 8.2.1, 8.4.1, 15.1.1 / CWE-16 |
| Archivo y línea | `supabase/migrations/202607110001_maestro_empleados_seguridad_v2.sql:2,685-710,739-740`; `docs/maestro-empleados-seguridad-importacion-v2.md:5,141`; 29 archivos `sql/*.sql` |
| Módulo / actor | Supabase y todos los módulos / operador de despliegue, usuario autenticado |
| Esfuerzo / prioridad / bloquea | Grande (2–4 semanas) / P0 / **Sí** |

**Precondiciones y abuso.** Basta con desplegar desde un conjunto parcial o ejecutar scripts manuales en distinto orden. Una policy/vista/grant remoto no versionado puede mantener acceso que Git aparenta cerrar; en particular, V2 preflighta escrituras desconocidas pero no SELECT. `sql/planilla_rls_base.sql` puede restaurar grants inseguros si se reejecuta.

**Evidencia.** Hay una sola migración formal, marcada `NO EJECUTADA`, frente al estado informado “aplicada”. La aplicación usa 60 relaciones; 37 no tienen `CREATE TABLE` local. No hay DDL de `vista_resumen_chequeras`, tablas raíz de autorización ni policies de Storage. Hay 0 `FORCE RLS`. Los 29 SQL restantes son “base”, “propuesto” o “revisable”, no una secuencia migrable.

**Impacto técnico / empresarial / multiempresa.** No se puede reconstruir, revisar ni revertir con certeza el control de acceso. Un drift puede producir fuga, fraude o indisponibilidad entre empresas y vuelve no repetible cualquier dictamen de seguridad.

**Reproducción local segura.** En PostgreSQL/Supabase local vacío, aplicar sólo `supabase/migrations`; registrar dependencias/objetos ausentes y comparar el esquema resultante con las 60 relaciones requeridas. Inyectar una policy SELECT legacy en local y comprobar que el preflight V2 no aborta.

**Corrección mínima.** Exportar sólo metadatos sanitizados del estado autorizado, versionar tablas/policies/grants/vistas/Storage faltantes y reconciliar el comentario “NO EJECUTADA”. **Ideal:** baseline inmutable más migraciones incrementales, roles de propietario dedicados y CI que compare `pg_class`, constraints, `pg_policies`, grants, `proacl`, `proconfig`, vistas, triggers y Storage.

**Regresión.** Crear base desde cero, aplicar todas las migraciones y exigir diff de esquema 0; cualquier policy no allowlisted debe fallar el pipeline. **Riesgo residual:** errores operativos o configuración de Auth/CDN fuera de la base; mitigarlos con change control y snapshots.

### F-002 — La autorización de módulo no existe en RLS/RPC

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, API5 / ASVS 8.2.1, 8.3.1, 8.4.1 / CWE-862, CWE-863 |
| Archivo y línea | `lib/validarAccesoModuloUsuario.ts:5-80`; `proxy.ts:56-82`; `sql/planilla_rls_base.sql:60-81`; migración V2 `:715-732`; `sql/contabilidad_formal_rls_revisable.sql:99-145` |
| Módulo / actor | Todos / usuario activo asignado sin módulo |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** Un usuario está asignado a la empresa A pero no al módulo Planilla, Impuestos o Contabilidad. Manipula el navegador y llama PostgREST directamente. El sidebar/redirect no participa.

**Evidencia.** `usuario_modulos` sólo se consulta en cliente. Ninguna policy/helper de negocio versionado lo consulta; normalmente basta perfil activo + empresa, o un rol global. El proxy sólo autentica. Se detectaron 126 escrituras Supabase directas fuera de la Route Handler.

**Impacto técnico / empresarial / multiempresa.** BFLA: acceso a módulos no contratados/asignados, incluida información fiscal, bancaria y laboral. El filtro de empresa puede impedir A→B, pero no evita acceso no autorizado dentro de A; policies globales amplían también el riesgo entre empresas.

**Reproducción local segura.** Crear usuario ficticio U asignado a A, desactivar `usuario_modulos.planilla` y ejecutar con su JWT un SELECT directo de `empleados_planilla`. Resultado esperado: cero filas o `permission denied`; el SQL versionado actual permitiría filas si las policies están desplegadas tal cual.

**Corrección mínima.** Helper SQL central `usuario_activo + empresa_activa + módulo + función` y uso en toda policy/RPC. **Ideal:** views/RPC por caso de uso y grants mínimos, con deny explícito de auditor antes de roles permisivos.

**Regresión.** Matriz automatizada por cada módulo con usuario asignado/no asignado, empresa A/B, activo/inactivo y llamada directa sin UI. **Riesgo residual:** nuevas tablas que omitan el helper; mitigarlo con tests de catálogo y revisión de migraciones.

### F-003 — DPI, NIT, IGSS y salarios completos llegan a usuarios no sensibles

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, API3 / ASVS 8.2.3, 14.1.1, 14.2.6 / CWE-200, CWE-359 |
| Archivo y línea | `sql/planilla_base.sql:16-30`; migración V2 `:712-732`; `app/empleados/page.tsx:16,22,32,42-44` |
| Módulo / actor | Planilla/Empleados / auxiliar, auditor, supervisor con empresa |
| Esfuerzo / prioridad / bloquea | Medio (3–5 días) / P0 / **Sí** |

**Precondiciones y abuso.** El actor sólo necesita lectura de la empresa. Abre DevTools o inspecciona el estado/response; no necesita que la tabla visual muestre el salario.

**Evidencia.** V2 concede SELECT completo de `empleados_planilla` a `authenticated` con policy por empresa. La tabla legacy contiene DPI/NIT/IGSS/salario/cuenta bancaria. El frontend solicita esos campos para todas las filas; la tabla oculta salario a algunos roles, pero el modal/estado conserva datos completos y los campos `password` sólo los enmascaran visualmente.

**Impacto técnico / empresarial / multiempresa.** Exposición de PII, remuneración y banco; riesgo de fraude interno y pérdida de confianza. En principio queda dentro de empresa, pero F-001/F-002 impiden garantizarlo para el estado remoto.

**Reproducción local segura.** Con empleados ficticios, iniciar como auditor/auxiliar y capturar la respuesta del listado. Verificar que las claves sensibles están presentes aunque la celda diga “Restringido”.

**Corrección mínima.** Revocar SELECT directo y crear vista de listado sin sensibles; detalle sensible mediante RPC con función específica. **Ideal:** clasificación de datos, views por rol, enmascaramiento servidor, separar/migrar cuenta bancaria legacy y cifrar secretos necesarios.

**Regresión.** Afirmar ausencia de columnas, no sólo valores enmascarados, para auxiliar/auditor; contador revisor autorizado recibe sólo lo necesario y deja evento de auditoría. **Riesgo residual:** screenshots/exports de usuarios legítimos; aplicar trazabilidad y minimización.

### F-004 — BOLA/oráculo cross-tenant en `validar_importacion_empleados_v2`

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, API1 / ASVS 8.2.2, 8.3.1, 8.4.1 / CWE-639, CWE-200 |
| Archivo y línea | Migración V2 `:466-517`, especialmente `:477-505,509-517` |
| Módulo / actor | Empleados V2 / cualquier autenticado, incluso sin empresa o inactivo |
| Esfuerzo / prioridad / bloquea | Pequeño (≤1 día) / P0 / **Sí** |

**Precondiciones y abuso.** Con un JWT válido, el actor envía hasta 1,000 filas con `empresa_id` ajena e identificadores/nombre+fecha. Aunque la función añade el error “empresa no autorizada”, sigue consultando esa empresa y devuelve `empleado_existente_id` y `version_esperada`.

**Evidencia.** La RPC externa sólo comprueba `auth.uid()`. El helper de fila no retorna inmediatamente al fallar autorización; ejecuta la búsqueda y compone la respuesta con UUID/versión.

**Impacto técnico / empresarial / multiempresa.** Oráculo masivo de existencia y correlación de empleados entre tenants; facilita enumeración de PII, ataques dirigidos y futuras BOLA. No entrega todo el registro, por eso se mantiene Alta y no Crítica.

**Reproducción local segura.** En Supabase local, crear A/B con personas ficticias. Con U de A llamar la RPC para una fila de B y comparar respuestas de identificador existente/no existente; no usar UUID ni datos reales.

**Corrección mínima.** Fallar antes de cualquier búsqueda si perfil, activo, módulo, función o empresa no están autorizados y no devolver IDs internos en validación. **Ideal:** endpoint/RPC con respuesta indistinguible, rate server-side y batch sólo de empresas autorizadas recalculadas.

**Regresión.** A→B, usuario sin empresa e inactivo deben devolver el mismo error estable, sin UUID, versión ni diferencias por existencia. **Riesgo residual:** inferencia temporal; normalizar camino y límites.

### F-005 — La importación permite escritura a un auditor con roles combinados

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, API5 / ASVS 8.2.1, 8.3.3, 8.4.1 / CWE-863 |
| Archivo y línea | Migración V2 `:189-215,528-550` |
| Módulo / actor | Empleados V2 / auditor con `contador_revisor` o rol permisivo |
| Esfuerzo / prioridad / bloquea | Pequeño / P0 / **Sí** |

**Precondiciones y abuso.** Un perfil conserva `auditor_solo_lectura` y además recibe `contador_revisor`, o tiene rol admin/jefe. Invoca `importar_empleados_v2` directamente.

**Evidencia.** `empleados_puede_escribir_v2` niega auditor, pero `empleados_puede_sensible_v2` no. La importación construye el alcance con el helper sensible y después inserta/actualiza. Crear/actualizar individual sí usa el helper de escritura, por lo que los flujos son inconsistentes.

**Impacto técnico / empresarial / multiempresa.** Un rol diseñado como sólo lectura puede alterar salarios/estado laboral por lote dentro de empresas asignadas. Combinado con roles globales puede aumentar el alcance.

**Reproducción local segura.** Usuario ficticio con ambas funciones, importación de una fila ficticia; la RPC debe rechazar antes de reservar operación. Probar también admin+jefe+auditor.

**Corrección mínima.** Toda escritura sensible debe depender de `puede_escribir`, con `auditor => false` como primera regla. **Ideal:** impedir combinaciones incompatibles con constraint/trigger y usar capacidades positivas por operación.

**Regresión.** Tabla de combinaciones de rol/función; cualquier combinación que incluya auditor debe quedar read-only. **Riesgo residual:** asignaciones heredadas incoherentes; ejecutar saneamiento auditado.

### F-006 — Contrato de importación V2 permite fuga, sobrescritura y duplicados

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, A06:2025, API6 / ASVS 2.3.3, 2.3.4, 8.4.1, 15.4.1 / CWE-367, CWE-362, CWE-200 |
| Archivo y línea | Migración V2 `:26-31,79-80,260-273,514-555,565,598-633`; `lib/empleadosExcel.ts:137-180` |
| Módulo / actor | Empleados/importación / usuario autorizado y concurrente |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** (a) Una importación abarca A+B y el lector sólo pertenece a A; (b) el empleado cambia tras preview; (c) otro usuario o hash declarado distinto reimporta la misma identidad.

**Evidencia.** La policy de cabecera/filas usa “cualquiera de `empresa_ids`”, no todas ni `fila.empresa_id`. La ejecución vuelve a leer la versión vigente y la usa, sin comparar la versión vista en preview. El servidor sólo valida formato del hash, no bytes; locks/dedupe incluyen usuario/scope exacto. NIT/IGSS tienen índices no únicos. Varios campos de plantilla se ignoran silenciosamente al crear/actualizar/importar.

**Impacto técnico / empresarial / multiempresa.** Filas/IDs de B visibles desde A; lost update; doble empleado o importación; falsa confianza en SHA/idempotencia; datos incompletos.

**Reproducción local segura.** Con datos ficticios: crear import A+B y consultar como A; hacer preview v1, actualizar a v2 y confirmar; enviar mismo contenido con dos usuarios/hashes declarados. No ejecutar contra remoto.

**Corrección mínima.** Fila filtrada por su `empresa_id`; exigir todas las empresas para cabecera; ligar confirmación a `empleado_id+version+request_hash`; uniques normalizados y lock por empresa/identidad. **Ideal:** bytes en bucket de cuarentena, hash servidor, job transaccional y contrato versionado que rechace campos no procesados.

**Regresión.** A nunca ve filas B; preview obsoleto produce conflicto; dos usuarios generan un efecto; round-trip de cada columna. **Riesgo residual:** duplicados semánticos legítimos; resolver mediante workflow de revisión.

### F-007 — Supervisor/jefe puede crear un par o superior global mediante service role

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, API5 / ASVS 8.2.1, 8.3.1, 8.4.1 / CWE-269, CWE-863 |
| Archivo y línea | `app/api/admin/perfiles/route.ts:6-7,127-153,206-255,367-398,450-460` |
| Módulo / actor | Admin/Usuarios / supervisor o jefe autenticado |
| Esfuerzo / prioridad / bloquea | Medio / P0 / **Sí** |

**Precondiciones y abuso.** Existe un usuario Auth aún sin perfil, y el actor conoce/coordina su UUID y correo. Un supervisor o jefe solicita crearle rol `supervisor` o `jefe`; no existe jerarquía entre creador y asignable ni empresa en el request.

**Evidencia.** `ROLES_CREACION` incluye admin, jefe y supervisor; `ROLES_ASIGNABLES` incluye jefe y supervisor. Tras checks de sesión/activo/rol/body, el service client confirma Auth y hace insert global en `perfiles`. No valida que el nuevo rol sea inferior ni limita tenant. Varios RPC tratan esos roles como globales.

**Impacto técnico / empresarial / multiempresa.** Elevación vertical y creación de una identidad privilegiada global; puede encadenarse con F-009 y administración de asignaciones. La precondición de una cuenta Auth no perfilada reduce la severidad de Crítica a Alta.

**Reproducción local segura.** En proyecto local aislado, crear dos usuarios ficticios; dar rol supervisor al actor y dejar al objetivo sin perfil. POST válido asignando supervisor/jefe; esperar 403. Confirmar que no se crea el perfil.

**Corrección mínima.** Sólo admin con AAL2 puede crear roles administrativos; jerarquía estricta y empresa obligatoria. **Ideal:** workflow de invitación/alta atómico, aprobación dual para roles altos, scopes tenant y service function con allowlist de columnas.

**Regresión.** Matriz creador×rol destino×empresa; UUID/correo ajeno, cuenta ya perfilada y rol par/superior deben fallar y auditarse. **Riesgo residual:** admin legítimo comprometido; MFA, step-up, alertas y aprobación dual.

### F-008 — CxP/CxC permite pagos/anulaciones a cualquier usuario asignado

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, A06:2025, API5/API6 / ASVS 2.3.5, 8.2.1, 8.3.3 / CWE-862, CWE-841 |
| Archivo y línea | `sql/rpc_pagos_cxp_cxc.sql:45-66,150-167,252-294,472-520,703-745` |
| Módulo / actor | CxP/CxC / usuario activo asignado, incluido auditor |
| Esfuerzo / prioridad / bloquea | Medio / P0 / **Sí** |

**Precondiciones y abuso.** Actor activo pertenece a A, sin función pagador/cajero o con `auditor_solo_lectura`. Invoca los RPC de registrar/anular; la idempotency key puede omitirse.

**Evidencia.** Los cuatro RPC verifican perfil activo y empresa/admin, pero no rol operativo ni deny de auditor. La llave es opcional. Hay controles positivos de lock de cuenta y sobrepago, pero no resuelven autorización.

**Impacto técnico / empresarial / multiempresa.** Pago o reversión financiera no autorizada, manipulación de saldo y fraude interno dentro del tenant; roles globales/estado remoto pueden ampliar alcance.

**Reproducción local segura.** Cuenta ficticia de Q100, usuario auditor de A; llamar registrar y anular directamente. Ambos deben devolver código de autorización estable y no cambiar saldo/auditoría.

**Corrección mínima.** Función explícita `pagador/cajero`, auditor deny primero, empresa activa e idempotencia obligatoria. **Ideal:** SoD creador/aprobador/pagador, límites por monto y step-up para importes altos.

**Regresión.** Actor sin función, auditor, inactivo, A→B, key ausente/replay/payload distinto y dos requests concurrentes. **Riesgo residual:** fraude de pagador legítimo; límites, doble aprobación y monitoreo.

### F-009 — Cheques omite alcance de empresa y segregación de funciones

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, API1/API5/API6 / ASVS 2.3.5, 8.2.1, 8.2.2, 8.4.1 / CWE-639, CWE-863 |
| Archivo y línea | `sql/rpc_cheques.sql:215-238,603-615,795-816,989-1010,1112-1240` |
| Módulo / actor | Cheques / supervisor, jefe, admin o roles combinados |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** Supervisor de A conoce IDs de B o un creador también actúa como autorizador/pagador. Invoca RPC directamente, sin UI.

**Evidencia.** Crear/rechazar/anular permite que roles globales eviten empresa; autorizar no exige pertenencia. No hay comprobación `creado_por != autorizado_por != pagado_por`. Un rol elevado combinado con auditor puede saltar bloqueos en varias transiciones.

**Impacto técnico / empresarial / multiempresa.** Creación, aprobación, rechazo/anulación o pago cross-tenant y autoaprobación de instrumentos financieros. Es el mayor riesgo de integridad; se mantiene Alta porque el despliegue remoto no fue confirmado.

**Reproducción local segura.** A/B ficticias: supervisor sólo A intenta operar cheque B; creador intenta autorizar y pagar su cheque; actor con auditor+supervisor intenta cada transición. Todo debe fallar sin revelar existencia.

**Corrección mínima.** Empresa obligatoria en cada transición, derivada del cheque y validada en servidor; auditor deny con precedencia; actores distintos. **Ideal:** máquina de estados y capacidades por empresa, doble aprobación por umbral, ledger/auditoría atómicos.

**Regresión.** Matriz rol×empresa×transición×actor previo y pruebas de ID alterado. **Riesgo residual:** colusión entre usuarios autorizados; límites y detección de patrones.

### F-010 — Los fondos de cheques pueden sobrecomprometerse o recalcularse mal

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Probable / Alta / Alta en la carrera, Media en fallback remoto |
| OWASP / ASVS / CWE | A06:2025, API6 / ASVS 2.3.3, 2.3.4, 15.4.1 / CWE-362, CWE-682 |
| Archivo y línea | `sql/rpc_cheques.sql:266-330,617-654,1337-1358` |
| Módulo / actor | Cheques/fondos / usuarios autorizados concurrentes |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** Dos cheques pendientes caben individualmente pero no juntos; se autorizan concurrentemente. Alternativamente, el despliegue carece de `recalcular_fondo_empresa` y entra al fallback de pago.

**Evidencia.** Crear comprueba disponibilidad sin reservar; autorizar no bloquea/revalida el fondo antes de comprometer. El fallback resta comprometidos pero no demuestra incorporar pagos ya ejecutados; la función de recálculo no está definida en el repositorio.

**Impacto técnico / empresarial / multiempresa.** Fondos negativos o ficticios, cheques sin respaldo y estados inconsistentes por empresa. No hay evidencia de fuga de datos, pero sí potencial pérdida financiera.

**Reproducción local segura.** Fondo ficticio Q100; crear dos pendientes de Q80 y autorizar en dos conexiones coordinadas. Sólo uno debe confirmar. Pagar uno y comprobar que disponible nunca aumenta incorrectamente.

**Corrección mínima.** Bloquear fila de fondo y reservar/revalidar atómicamente al autorizar; eliminar fallback ambiguo. **Ideal:** ledger inmutable con movimientos reservados/comprometidos/pagados y constraint de no negativo.

**Regresión.** Barrera concurrente repetida, retry, timeout posterior al commit y recálculo desde ledger. **Riesgo residual:** deadlocks/contención; orden de locks, retry acotado y métricas.

### F-011 — Escritura directa permite mass assignment y saltar transiciones

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, A06:2025, API3/API5 / ASVS 2.3.3, 8.2.1, 8.2.3 / CWE-915, CWE-841 |
| Archivo y línea | `sql/planilla_rls_base.sql:23-33,275+`; `sql/impuestos_rls_base.sql:26-42,413+`; `sql/conciliacion_bancaria_rls_base.sql:27-43,285+`; RLS de activos/proyectos; 133 escrituras Supabase directas |
| Módulo / actor | Planilla, impuestos, conciliación, activos, proyectos, contabilidad / usuario con write por empresa |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** Usuario autorizado para una operación menor modifica el JSON directo y cambia `estado`, totales, autor, fechas, cierre o campos de auditoría.

**Evidencia.** Los grants conceden `SELECT, INSERT, UPDATE` de tabla y las policies suelen validar empresa/rol, no columnas ni transición. Se puede intentar marcar una planilla pagada, un impuesto declarado, conciliación cerrada o depreciación contabilizada sin RPC. `usuario_modulos` tampoco participa.

**Impacto técnico / empresarial / multiempresa.** BOPLA/mass assignment, fraude contable y pérdida de provenance dentro de empresa; FKs simples/manuales pueden permitir referencias cruzadas A/B.

**Reproducción local segura.** Con registros ficticios en borrador, enviar PATCH directo cambiando sólo estados/totales/provenance. Debe denegarse aunque el usuario pueda editar el concepto ordinario.

**Corrección mínima.** Revocar updates de columnas críticas y usar RPC de transición. **Ideal:** grants por columna, máquina de estados, constraints/triggers de inmutabilidad y auditoría transaccional.

**Regresión.** Payloads con campos extra, cambios de `empresa_id`, creador, total y estado para cada módulo. **Riesgo residual:** errores en nuevas transiciones; generación de tests desde catálogo de estados.

### F-012 — Roles, empresas, módulos y funciones se actualizan sin transacción

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, A06:2025, A08:2025 / ASVS 2.3.3, 8.3.2, 16.3.1 / CWE-664, CWE-841 |
| Archivo y línea | `app/admin/page.tsx:1079-1204,1258-1287,1353-1382,1464-1495` |
| Módulo / actor | Admin / admin, jefe o supervisor |
| Esfuerzo / prioridad / bloquea | Medio / P0 / **Sí** |

**Precondiciones y abuso.** Una de las múltiples requests falla o se interrumpe después de cambiar perfil pero antes de sincronizar empresas/módulos/funciones.

**Evidencia.** Primero se actualiza `perfiles`; luego se hacen varias operaciones directas por cada conjunto. El `catch` sólo marca idempotencia fallida, no revierte. La auditoría también es posterior/fail-open.

**Impacto técnico / empresarial / multiempresa.** Privilegios parciales, rol global con empresas antiguas, bloqueo de acceso o combinaciones incompatibles como auditor+escritura. Puede abrir acceso entre tenants.

**Reproducción local segura.** En base local, forzar error en cada etapa con una FK ficticia y verificar rollback total. El código actual deja etapas anteriores persistidas.

**Corrección mínima.** Una RPC transaccional que revalide operador y actualice los cuatro conjuntos. **Ideal:** documento de autorización versionado, lock optimista, diff, aprobación para cambios altos y outbox de auditoría.

**Regresión.** Fallo después de cada sentencia, doble submit, versión obsoleta y cambio concurrente por dos admins; estado final debe ser todo-o-nada. **Riesgo residual:** mala configuración legítima; preview/diff y aprobación.

### F-013 — El importador genérico evita RPC financieros y deja operaciones parciales

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, A06:2025, API5/API6 / ASVS 2.3.3, 2.3.4, 8.3.1 / CWE-841, CWE-362 |
| Archivo y línea | `app/importaciones/page.tsx:367,759-805,1339-1344,1832-1875,1920-1955`; `app/ordenes-compra/page.tsx:1405-1501` |
| Módulo / actor | Importaciones, cheques, órdenes y tablas configuradas / usuario con módulo importaciones |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** Usuario con módulo genérico importa cheques u órdenes. En cheques, falla/reserva concurrente después del insert; en otros tipos, el navegador llama `.from(tabla).insert(registros)`.

**Evidencia.** Sólo se valida el módulo `importaciones`. Cheque se inserta fila a fila y luego se reserva el físico en otra request; no se comprueba `count` cero. Se omite `crear_cheque_transaccional`. Órdenes nacen `Pendiente`, sin filas de firmas ni estado normal `Pendiente de firmas`. Idempotencia persistente cae a temporal permisiva.

**Impacto técnico / empresarial / multiempresa.** Cheque creado con físico aún disponible, doble reserva, órdenes fuera del circuito de firmas, operaciones parciales y controles cliente omitibles. RLS raíz no versionada impide garantizar empresa.

**Reproducción local segura.** Importar dos cheques ficticios que compiten por el mismo físico; forzar fallo de update; importar orden y comparar cabecera/firmas con flujo normal.

**Corrección mínima.** Deshabilitar tipos financieros del importador hasta tener RPC por tipo. **Ideal:** job transaccional servidor, autorización por operación, locks, uniques, idempotencia y auditoría atómicas.

**Regresión.** Fallo en cada paso, dos imports concurrentes, key repetida/con payload distinto, A→B y auditor. Cero filas huérfanas. **Riesgo residual:** lotes grandes; staging, reanudación y compensación formal.

### F-014 — Contabilización y finalización no preservan invariantes esenciales

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A06:2025, API6 / ASVS 2.3.3, 2.3.5, 8.3.1 / CWE-840, CWE-841 |
| Archivo y línea | `sql/rpc_contabilizar_documento_contable.sql:72-115`; `sql/rpc_finalizar_asiento_contable.sql:182-256` |
| Módulo / actor | Contabilidad / contador revisor o rol elevado |
| Esfuerzo / prioridad / bloquea | Medio / P0 / **Sí** |

**Precondiciones y abuso.** Actor contabiliza documento en estado no final o finaliza asiento con fecha fuera del período/creado por él mismo.

**Evidencia.** “Contabilizar” no exige aprobación, período abierto, igualdad distribución-total ni crea/vincula asiento; sólo cambia estado. “Finalizar” comprueba período abierto pero no que la fecha del asiento esté en rango ni revisor distinto.

**Impacto técnico / empresarial / multiempresa.** Estados que afirman contabilidad inexistente, cifras en período incorrecto y ausencia de SoD; reportes y cierres dejan de ser confiables dentro de la empresa.

**Reproducción local segura.** Documento ficticio pendiente y distribución balanceada de importe distinto; período abierto con asiento fuera de fechas; creador=finalizador. Todas deben fallar.

**Corrección mínima.** Agregar checks y vincular asiento atómico. **Ideal:** máquina documental→asiento, reglas por moneda/fecha, revisor distinto y cierre que revalide el conjunto.

**Regresión.** Matriz estado, total, moneda, período, fecha, actor y replay. **Riesgo residual:** reglas contables específicas no modeladas; revisión funcional y tests de aceptación.

### F-015 — Idempotencia y rate limit operativo son controlables por el cliente

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A01:2025, A06:2025, API4/API6 / ASVS 2.3.4, 2.4.1, 4.1.3 / CWE-307, CWE-362, CWE-400 |
| Archivo y línea | `sql/seguridad_operativa.sql:90-111,163-171`; `sql/rpc_rate_limit_operativo.sql:54-210`; RPC pagos/cheques; `lib/rateLimitOperativo.ts:96-129` |
| Módulo / actor | Seguridad operativa / usuario autenticado o bot |
| Esfuerzo / prioridad / bloquea | Grande / P0 / **Sí** |

**Precondiciones y abuso.** Usuario llama RPC de rate con clave/límite/ventana/IP elegidos; ocupa una idempotency key global, modifica su estado o repite con key opcional. Si falla rate RPC, el helper permite continuar.

**Evidencia.** `authenticated` recibe escritura directa sobre tablas de control. Key de idempotencia es global única, no `(usuario,empresa,acción,key)`. Varios RPC hacen SELECT→INSERT, no comparan hash en replay ni respetan expiración. El rate RPC acepta y sobrescribe sujeto/límites aportados. El fallback cliente devuelve `permitido:true` sin límite local real.

**Impacto técnico / empresarial / multiempresa.** Key-squatting, replay/doble efecto, evasión/denegación de rate y contaminación de buckets de otros sujetos; disponibilidad e integridad financiera.

**Reproducción local segura.** Dos usuarios ficticios usan la misma key; mismo usuario repite key con payload distinto; caller intenta elegir límite 1/ventana extrema/clave ajena; simular timeout RPC.

**Corrección mínima.** Revocar escritura directa y derivar sujeto/empresa/límites en servidor; key obligatoria y hash comparado. **Ideal:** reserva atómica `INSERT ... ON CONFLICT`, scope compuesto, TTL/recovery y enforcement dentro de cada RPC mutante.

**Regresión.** Un efecto bajo concurrencia, replay idéntico devuelve resultado, distinto da 409, usuario no colisiona con otro y fallo del store niega acción sensible. **Riesgo residual:** caída global del store; circuit breaker y operación degradada explícita.

### F-016 — `xlsx@0.18.5` procesa archivos no confiables con advisories altos

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A03:2025, API4 / ASVS 5.2.3, 15.1.1 / CWE-1321, CWE-1333 |
| Archivo y línea | `package.json:22`; `package-lock.json:7344-7347`; `lib/empleadosExcel.ts:137-152`; `app/importaciones/page.tsx:1040-1094,1166` |
| Módulo / actor | Excel/importaciones / usuario que entrega archivo manipulado |
| Esfuerzo / prioridad / bloquea | Medio / P0 / **Sí** mientras import esté habilitado |

**Precondiciones y abuso.** Usuario hace que un operador abra un workbook manipulado. El parse ocurre en Client Component; el daño se concentra en la pestaña/sesión del operador, no en filesystem servidor.

**Evidencia.** `npm audit` reporta prototype pollution [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), afectado `<0.19.3`, y ReDoS [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9), afectado `<0.20.2`; npm no tiene fix. Ambos flujos ejecutan `XLSX.read` antes del límite de filas y antes de rechazo de macros/fórmulas. El legacy acepta XLS/XLSX/CSV sin MIME, magic, macros ni fórmulas.

**Impacto técnico / empresarial / multiempresa.** Bloqueo de pestaña, posible alteración de objetos en contexto autenticado y entrada masiva no validada. No se ejecutó exploit; la explotabilidad exacta de pollution queda contextual.

**Reproducción local segura.** No usar PoC público ni datos reales. Tras actualizar en rama de reparación, usar corpus benigno de regresión y fuzzer acotado en worker aislado; medir timeout/memoria con límites estrictos.

**Corrección mínima.** Deshabilitar importación o reemplazar parser por versión/distribución mantenida y verificada. SheetJS documenta distribución actual fuera de npm; validar procedencia e integridad antes de adoptarla. **Ideal:** parse server/worker sandbox, límites de descompresión/dimensiones, cuarentena y formato CSV estricto cuando sea suficiente.

**Regresión.** Archivos válidos, corruptos, fórmula, macro, dimensión enorme, compresión hostil y timeout. **Riesgo residual:** zero-days de parser; aislamiento y cuotas.

### F-017 — Upload documental carece de tamaño, tipo, firma, AV y compensación

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta; bucket remoto no verificado |
| OWASP / ASVS / CWE | A05:2025, A06:2025, API4 / ASVS 5.1.1, 5.2.1–5.2.4, 5.4.3 / CWE-434, CWE-400 |
| Archivo y línea | `lib/documentosTramites.ts:281-340,535-589`; `components/DocumentosEntidad.tsx:308-313` |
| Módulo / actor | Documentos/tareas / usuario con upload |
| Esfuerzo / prioridad / bloquea | Medio / P0 / **Sí** para módulo documental |

**Precondiciones y abuso.** Actor selecciona archivo grande, MIME falso, HTML/SVG/ejecutable o muchos objetos. Si falla metadata, el objeto queda almacenado.

**Evidencia.** Sólo se exige nombre; no hay tamaño, extensión, firma, AV, cuota, conteo ni frecuencia. Se confía en `File.type`; input sin `accept`. Si insert de metadata falla, se conserva deliberadamente el objeto y se devuelve path. No hay job de retención/huérfanos versionado. Positivos: path saneado/UUID, `upsert:false`, signed URL y validación de prefijo.

**Impacto técnico / empresarial / multiempresa.** Agotamiento/costo, malware/phishing, contenido activo servido por URL firmada, archivos sin trazabilidad. El acceso A→B depende de policies de bucket ausentes en Git.

**Reproducción local segura.** Bucket local: archivos ficticios sobredimensionado, MIME falso, doble extensión, HTML/SVG y ráfaga pequeña; forzar fallo de metadata y comprobar borrado. AV con string de prueba aprobado por el equipo, nunca malware real.

**Corrección mínima.** Límite/allowlist/firma en servicio servidor, `Content-Disposition: attachment` y compensación. **Ideal:** subida a cuarentena, AV/CDR, cuotas tenant, estado pendiente, worker y recolector de huérfanos/retención.

**Regresión.** Cada tipo inválido debe rechazarse antes de persistir; A no firma/descarga B; fallo metadata deja 0 objetos. **Riesgo residual:** archivos válidos maliciosos; sandbox y educación.

### F-018 — Ruta persistida no confiable llega a `router.push` y puede ejecutar JavaScript

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Probable / Alta / Media-alta |
| OWASP / ASVS / CWE | A05:2025, API8 / ASVS 2.2.2, 3.4.3, 8.3.1 / CWE-79 |
| Archivo y línea | `lib/borradoresTrabajo.ts:83-125`; `app/monitoreo-sistema/page.tsx:792-798,1149-1169,1701`; docs Next local `use-router.md:53` |
| Módulo / actor | Borradores/Monitoreo / usuario autenticado contra admin que hace clic |
| Esfuerzo / prioridad / bloquea | Pequeño / P0 / **Sí** |

**Precondiciones y abuso.** RLS permite al actor insertar/actualizar su borrador y Monitoreo leerlo; se corrige la inconsistencia de estado o existe una fila con estado consultado. Actor persiste `javascript:`/URL peligrosa y un admin pulsa “ir”.

**Evidencia.** Sólo se valida que `ruta` no esté vacía. Monitoreo propaga `trabajo.ruta` a `router.push`. Next.js 16 advierte que un `javascript:` no saneado se ejecuta. CSP permite `unsafe-inline` y los tokens de sesión son legibles por JS. Hoy Monitoreo filtra `estado='activo'`, mientras la librería usa `borrador/completado/...`; esto rompe el panel y reduce la cadena actual, no elimina el sink.

**Impacto técnico / empresarial / multiempresa.** XSS persistente con interacción de admin: acciones privilegiadas, lectura de datos accesibles y movimiento lateral entre tenants. Explotación remota depende de policies no versionadas.

**Reproducción local segura.** Sin JavaScript activo: guardar strings `data:`, `//example.invalid`, `https://example.invalid` y `javascript:void(0)` en entorno local; instrumentar la función de navegación y afirmar rechazo sin ejecutar payload.

**Corrección mínima.** Aceptar sólo rutas relativas de allowlist (`/^\/[a-z0-9\-\/]*$/` más normalización estricta), nunca esquemas, `//`, backslash o controles. **Ideal:** guardar enum de módulo y resolver ruta constante en UI; CSP con nonce.

**Regresión.** Corpus de esquemas/codificación doble/Unicode y rutas internas válidas; corregir estado del monitor únicamente junto con el saneamiento. **Riesgo residual:** nuevos sinks URL; regla estática y revisión.

### F-019 — Mojibake crea un estado de cheque incompatible con la UI

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Alta / Alta |
| OWASP / ASVS / CWE | A06:2025 / ASVS 2.2.2, 15.4.1 / CWE-176 |
| Archivo y línea | `sql/rpc_cheques.sql:400,438,626`; `app/cheques/page.tsx:2520,2541,3394,3764` |
| Módulo / actor | Cheques / operador normal |
| Esfuerzo / prioridad / bloquea | Pequeño / P0 / **Sí** para cheques |

**Precondiciones y abuso.** Crear cheque mediante RPC versionada y luego listar/autorizar con UI que compara literal UTF-8 correcto.

**Evidencia.** SQL usa `Pendiente de autorizaciÃ³n`; React usa `Pendiente de autorización`. El escaneo UTF-8 confirmó cuatro ocurrencias reales en SQL; el resto del aparente mojibake de consola se descartó salvo documentos históricos.

**Impacto técnico / empresarial / multiempresa.** Constraint, filtros y transiciones pueden fallar o dejar cheques invisibles/inoperables. Afecta disponibilidad e integridad de cada empresa, no aislamiento por sí solo.

**Reproducción local segura.** Ejecutar unit/integration local con dato ficticio: salida de crear debe coincidir byte a byte con enum compartido y ser autorizable inmediatamente.

**Corrección mínima.** Migración de datos/literal canónico UTF-8. **Ideal:** enum/check único y tipos generados compartidos, con política de encoding en CI.

**Regresión.** Crear→listar→autorizar→pagar y búsqueda automática de secuencias mojibake en SQL. **Riesgo residual:** datos históricos con variantes; inventariar y normalizar bajo backup.

### F-020 — Integración SSR pierde cookies renovadas y el timeout es sólo cliente

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A07:2025 / ASVS 3.3.1, 3.3.2, 3.3.4, 7.4.2 / CWE-613, CWE-1004 |
| Archivo y línea | `proxy.ts:42-65`; API `:90,113-125`; `components/InactivitySessionGuard.tsx:9-13,71-75,115-189`; `node_modules/@supabase/ssr/src/createServerClient.ts:19-20,51-59`; defaults `utils/constants.ts:3-9` |
| Módulo / actor | Sesión / usuario, atacante con XSS |
| Esfuerzo / prioridad / bloquea | Medio / P1 / **Sí** |

**Precondiciones y abuso.** Token se renueva en API/redirect o hay varias pestañas. Para robo se requiere XSS/compromiso del contexto navegador.

**Evidencia.** Se usan callbacks legacy `get/set/remove` en vez de `getAll/setAll`. Redirect copia nombre/valor y descarta opciones. La API acumula cookies en `NextResponse.next()` que nunca devuelve. Defaults instalados son `SameSite=Lax` (positivo), `httpOnly:false`, sin `secure` explícito y max-age 400 días; el modelo browser necesita leer tokens. El guard de 30 minutos sólo escribe, no lee `localStorage`, no escucha otras pestañas y puede ser manipulado/deshabilitado.

**Impacto técnico / empresarial / multiempresa.** Refresh no persistido, cierres aleatorios/reuso, control de inactividad no autoritativo y mayor impacto de XSS sobre todas las empresas accesibles al usuario.

**Reproducción local segura.** Token ficticio cercano a expirar: llamar API y comparar `Set-Cookie` realmente devuelto; dos pestañas con actividad en una y reloj instrumentado. No capturar tokens reales.

**Corrección mínima.** `getAll/setAll`, conservar atributos y adjuntar cookies a cada respuesta; sincronizar pestañas y validar usuario activo en DB. **Ideal:** BFF para acciones sensibles con cookies Secure/HttpOnly donde la arquitectura lo permita, timeout absoluto/inactividad servidor y revocación central.

**Regresión.** Refresh, cookies fragmentadas, redirects, logout, dos pestañas, tab throttling, perfil inactivo y role change. **Riesgo residual:** XSS si se mantiene token browser; CSP estricta y menor alcance.

### F-021 — MFA, recuperación, password policy y revocación no son demostrables

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Necesita validación / Media / Alta sobre ausencia en app, Baja sobre proveedor |
| OWASP / ASVS / CWE | A07:2025, API2 / ASVS 6.1.1, 6.2.2, 7.4.5, 7.5.3 / CWE-308, CWE-521 |
| Archivo y línea | `app/login/page.tsx:13-55`; ausencia de rutas recovery/callback/MFA |
| Módulo / actor | Auth/admin / bot, cuenta comprometida, admin sin MFA |
| Esfuerzo / prioridad / bloquea | Grande / P1 / **Sí** para producción financiera |

**Precondiciones y abuso.** Credential stuffing/password spraying contra proveedor, cuenta admin AAL1 comprometida o recuperación/callback mal configurados en dashboard Supabase.

**Evidencia.** Sólo `signInWithPassword`; no hay MFA/challenge/AAL, recuperación, cambio de contraseña, reauth reciente ni step-up. `password.trim()` altera contraseñas válidas con espacios. El mensaje distingue email no confirmado. CAPTCHA, rate, política de password, OTP, URLs permitidas, sesiones concurrentes y revocación sólo pueden residir en configuración remota, no revisada.

**Impacto técnico / empresarial / multiempresa.** Toma de cuenta, especialmente peligrosa para admin/supervisor con alcance global. No se declara vulnerabilidad confirmada del proveedor.

**Reproducción local segura.** En tenant de prueba, sin fuerza bruta: una credencial inválida y una cuenta no confirmada; verificar mensaje uniforme. Probar password con espacios, AAL1 versus acción sensible, recovery y callback allowlist.

**Corrección mínima.** No recortar password; mensajes uniformes; documentar/verificar configuración Auth. **Ideal:** MFA/AAL2 obligatorio para administradores y step-up en roles, pagos, cheques, export sensible; recovery seguro, revocación y alertas.

**Regresión.** AAL1 rechazado, AAL2 aceptado, recovery no enumera, callbacks externos fallan, perfil inactivo pierde acceso inmediatamente. **Riesgo residual:** phishing/MFA fatigue; FIDO2 y awareness.

### F-022 — La API administrativa carece de controles HTTP/CSRF y rate robusto

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta; IP depende del proxy |
| OWASP / ASVS / CWE | A01:2025, API4/API8 / ASVS 3.5.1, 3.5.2, 4.1.3, 2.4.1 / CWE-352, CWE-307, CWE-400 |
| Archivo y línea | `app/api/admin/perfiles/route.ts:19-29,43-96,136-180,210-248` |
| Módulo / actor | API Admin / sitio same-site hostil, bot, IP rotativa |
| Esfuerzo / prioridad / bloquea | Medio / P1 / **Sí** |

**Precondiciones y abuso.** Cookies se envían desde un origen same-site o atacante rota/spoofea IP si infraestructura acepta XFF del cliente. Envía JSON con MIME incorrecto/body grande o muchas claves IP.

**Evidencia.** No valida `Content-Type`, `Content-Length`, Origin, Referer ni `Sec-Fetch-Site`; strings/body sin máximos. Confía en primer XFF/X-Real-IP. `Map` global no tiene eviction/tamaño, se consume antes de auth, no se comparte serverless; límite por usuario incluye IP. Si falla rate persistente continúa con el local. SameSite=Lax y ausencia de CORS abierto son mitigaciones, no defensa para same-site/XSS.

**Impacto técnico / empresarial / multiempresa.** CSRF contextual, abuso de endpoint y memoria, evasión distribuida; combinado con F-007 crea perfiles privilegiados.

**Reproducción local segura.** `text/plain` JSON, Origin sibling ficticio, body justo sobre límite definido en test, XFF alterno y dos instancias; sin carga masiva. Esperar 415/403/413/429.

**Corrección mínima.** JSON exclusivo, límites, Origin/Host/Sec-Fetch y headers de proveedor confiables. **Ideal:** WAF/store atómico, límites independientes por usuario/IP/acción, LRU/TTL y CSRF token o patrón BFF apropiado.

**Regresión.** MIME, extra fields, body profundo/grande, origin, XFF, rotación IP, restart e indisponibilidad del store. **Riesgo residual:** botnet; reputación/risk scoring y MFA.

### F-023 — Alta de perfil, idempotencia y auditoría de API no son atómicas

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A06:2025, A09:2025, A10:2025, API6 / ASVS 2.3.3, 16.3.1, 16.5.1, 16.5.3 / CWE-703, CWE-754 |
| Archivo y línea | API `:294-365,450-506`; en particular `:318-325,343-363,354,462-466` |
| Módulo / actor | API Admin / operador autorizado, requests concurrentes |
| Esfuerzo / prioridad / bloquea | Medio / P1 / **Sí** |

**Precondiciones y abuso.** Dos solicitudes compiten o se repite key con nombre/payload cambiado; falla auditoría o actualización final después del insert de perfil.

**Evidencia.** SELECT→INSERT de idempotencia no es una reserva atómica desde aplicación; replay completado no compara hash y `request_hash` omite nombre. Perfil, auditoría y estados de idempotencia son requests separadas con service role. Si auditoría falla se conserva perfil y se devuelve warning. Error de insert concatena `insertError.message` al cliente.

**Impacto técnico / empresarial / multiempresa.** Perfil creado sin evidencia, replay incoherente, estados “en proceso” y filtración de nombres/constraints SQL. Afecta autorización global.

**Reproducción local segura.** Dos POST concurrentes limitados con misma key; repetir key cambiando nombre; forzar fallo de `auditoria_eventos`. Verificar un solo efecto y rollback completo.

**Corrección mínima.** RPC service-side transaccional y errores genéricos. **Ideal:** reserva/hash canónico, outbox/append-only y recuperación de estados con TTL.

**Regresión.** Key idéntica/payload idéntico, distinto, concurrencia y fallo después de cada etapa. **Riesgo residual:** Auth Admin y DB no comparten transacción; workflow compensatorio explícito.

### F-024 — `SECURITY DEFINER` usa `search_path` y ACL inconsistentes

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Probable / Media / Alta sobre código, Media sobre explotación |
| OWASP / ASVS / CWE | A02:2025, A05:2025, API8 / ASVS 8.3.1, 15.1.1 / CWE-426, CWE-732 |
| Archivo y línea | V2 `:178-219,282-676`; scripts RPC con `set search_path=public`; `sql/rpc_cheques.sql:1429-1455`; pagos `:923-926` |
| Módulo / actor | PostgreSQL/RPC / anon o usuario con CREATE en schema |
| Esfuerzo / prioridad / bloquea | Medio / P1 / **Sí** hasta validar ACL |

**Precondiciones y abuso.** ACL remoto permite shadowing/CREATE o EXECUTE heredado de PUBLIC/anon. Actor invoca o suplanta objeto resuelto por nombre no calificado.

**Evidencia.** V2 es positivo: `search_path=''`, calificación y revocaciones. Otros ~22 definers usan `public`; diez funciones (rate, limpieza, cuatro pagos y varias de cheques) no muestran `REVOKE ... FROM PUBLIC, anon` antes de grant. Las funciones hacen auth interno, lo que reduce pero no elimina superficie.

**Impacto técnico / empresarial / multiempresa.** Elevación de privilegio a owner y bypass RLS si ACL remota es débil; alcance potencial global.

**Reproducción local segura.** Inspeccionar `proowner/proacl/proconfig` y privilegios CREATE en local; como rol de prueba intentar shadowing sin ejecutar lógica destructiva. Debe ser imposible.

**Corrección mínima.** `search_path=''`, referencias calificadas y revocar PUBLIC/anon. **Ideal:** owner sin login, default privileges endurecidos y grants sólo a roles RPC dedicados.

**Regresión.** Query de catálogo que falla CI ante definer no allowlisted, path distinto o EXECUTE público. **Riesgo residual:** extensiones/owners privilegiados; inventario periódico.

### F-025 — CSP/headers tienen buena base, pero `unsafe-inline`, wildcard y HSTS faltante

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A02:2025, A05:2025 / ASVS 3.4.1, 3.4.3, 3.4.4–3.4.6, 14.3.2 / CWE-693 |
| Archivo y línea | `next.config.mjs:4-49`; smoke localhost 13-07-2026 |
| Módulo / actor | HTTP global / atacante XSS/red |
| Esfuerzo / prioridad / bloquea | Medio / P1 / **No**, salvo encadenamiento F-018 |

**Precondiciones y abuso.** Existe un sink XSS o transporte inicial sin HSTS del host. Script inline puede ejecutarse y `connect-src https://*.supabase.co` facilita exfiltrar a otro proyecto Supabase.

**Evidencia.** Producción mantiene `script-src 'unsafe-inline'` y style inline; `unsafe-eval` sólo dev (positivo). `base-uri 'self'` en vez de `none`; no nonce/hash/strict-dynamic/reporting, HSTS ni `poweredByHeader:false`. Local: CSP/XFO/nosniff presentes en 200/404/405; HSTS ausente. `/login` recibió `s-maxage=31536000`; 404 fue no-store. El CDN podría añadir HSTS, no verificado.

**Impacto técnico / empresarial / multiempresa.** Menor contención de XSS y exfiltración; caching de shells no mostró datos sensibles, pero respuestas auth/API deben ser no-store.

**Reproducción local segura.** Inspeccionar headers de página, API, redirect, 404/500 y script inline benigno sin nonce en preview. No insertar payload.

**Corrección mínima.** Host Supabase exacto, HSTS en host, `poweredByHeader:false`, `base-uri 'none'`, no-store en respuestas sensibles. **Ideal gradual:** (1) CSP Report-Only/telemetría; (2) inventario inline; (3) nonce por request desde Proxy según guía Next 16, aceptando render dinámico, o SRI/hashes donde aplique; (4) retirar `unsafe-inline` de script y luego style; (5) probar todas las respuestas.

**Regresión.** Headers en 2xx/3xx/4xx/5xx/API, fetch a otro Supabase bloqueado y script sin nonce bloqueado. **Riesgo residual:** extensiones/navegador antiguo; XSS prevention primaria sigue siendo validación/sinks seguros.

### F-026 — Auditoría, logs, minimización y retención no son autoritativos

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A09:2025, API3 / ASVS 14.2.6, 16.2.1, 16.3.1, 16.4.1 / CWE-778, CWE-532 |
| Archivo y línea | `lib/auditoria.ts:66-142`; `app/admin/page.tsx:249-266`; API `:469-506`; `app/importaciones/page.tsx:1922-1927`; 230 `console.error`, 68 `console.warn` |
| Módulo / actor | Auditoría/privacidad / usuario, operador, atacante con DevTools |
| Esfuerzo / prioridad / bloquea | Grande / P1 / **No** por sí solo |

**Precondiciones y abuso.** Una mutación tiene éxito y el insert de auditoría falla, o el cliente fabrica/omite evento si RLS lo permite. Errores Supabase completos se muestran en consola/UI.

**Evidencia.** Eventos se construyen desde navegador y suelen insertarse después de la operación; varios flujos continúan. SQL concede escritura de tablas de control. No hay retención visible para auditoría, intentos, histories, rate o idempotencia. Listados amplios y `.select()` sin columnas pueden incorporar futuras PII. SQL/API devuelven `SQLERRM`/mensajes DB. No se confirmó token, password, DPI completo ni key impresa deliberadamente.

**Impacto técnico / empresarial / multiempresa.** Huecos o eventos falsos, sobrecolección/retención indefinida, exposición de IDs/esquema y baja capacidad forense por tenant.

**Reproducción local segura.** Forzar fallo de tabla de auditoría tras mutación ficticia; intentar evento fabricado; agregar columna sensible de prueba y observar DTO amplio; revisar consola sin secretos reales.

**Corrección mínima.** Auditoría dentro de RPC/trigger, errores públicos estables y selects explícitos. **Ideal:** append-only con writer dedicado, outbox, clasificación/retención/borrado, acceso segregado y monitoreo de cambios de rol/empresa, export, cierres/anulaciones.

**Regresión.** Mutación crítica sin evento debe revertir o producir outbox; usuario no puede alterar logs; escáner de secretos/PII. **Riesgo residual:** insider con acceso a logs; WORM/export externo y separación.

### F-027 — Invariantes, empresa activa y limpieza destructiva son incompletas

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Media-alta |
| OWASP / ASVS / CWE | A06:2025, A10:2025 / ASVS 2.2.2, 2.3.3, 8.3.2 / CWE-20, CWE-841 |
| Archivo y línea | `sql/integridad_impuestos_conciliacion.sql:58-210`; `sql/planilla_integridad_empresa_empleado.sql:22-39`; `sql/planilla_grants_integridad_detalle.sql:88-113`; `sql/rpc_limpieza_empresas.sql:163-320`; migración V2 `:366-377,440-449,599-633` |
| Módulo / actor | Planilla, impuestos, conciliación, activos, proyectos, empresas / usuario autorizado, admin |
| Esfuerzo / prioridad / bloquea | Grande / P2 / **No** tras cerrar altos relacionados |

**Precondiciones y abuso.** Scripts de FKs compuestas no están aplicados; empresa archivada conserva asignación; empresa real coincide con criterios mutables de limpieza; import contiene campos que el RPC ignora.

**Evidencia.** Los tres SQL de integridad citados agregan FKs compuestas después de los esquemas base, pero siguen fuera de migraciones. Helpers no validan consistentemente estado de `empresas`. Limpieza decide candidatos por nombre/estado mutable, usa una allowlist fija de dependencias, no bloquea primero ni comprueba `ROW_COUNT`. La revisión de los DDL relevantes no encontró una cobertura uniforme de invariantes aritméticas/fiscales/depreciación/presupuesto; RPC V2 omite campos del contrato.

**Impacto técnico / empresarial / multiempresa.** Relaciones A↔B inválidas, operación sobre empresa archivada, borrado erróneo, cifras inconsistentes y pérdida silenciosa de campos.

**Reproducción local segura.** Insertar hijo B bajo padre A; operar empresa archivada; dry-run de limpieza con empresa ficticia renombrada; round-trip de todas las columnas V2. Nunca ejecutar limpieza remota.

**Corrección mínima.** Migrar FKs/constraints y helper de empresa activa; deshabilitar limpieza hasta endurecer. **Ideal:** introspección de FKs, bandera inmutable de tenant de prueba, lock/dry-run/aprobación, constraints diferibles y contrato de import versionado.

**Regresión.** Referencia cross-tenant falla, archivada niega, empresa real jamás candidata y todas las columnas hacen round-trip o se rechazan. **Riesgo residual:** reglas contables cambiantes; versionar políticas de negocio.

### F-028 — Límites de disponibilidad son parciales o posteriores al trabajo costoso

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A10:2025, API4 / ASVS 2.3.4, 2.4.1, 5.2.1, 5.2.3 / CWE-400 |
| Archivo y línea | API `:19-29,210-215`; Excel legacy `:1088-1094,1166`; `lib/borradoresTrabajo.ts:192-218`; uploads `:281-318`; loaders/exports amplios |
| Módulo / actor | API, import, documentos, listados / bot o usuario |
| Esfuerzo / prioridad / bloquea | Medio / P1 / **No** si módulos riesgosos están deshabilitados |

**Precondiciones y abuso.** Body/JSON profundo, workbook comprimido pequeño, uploads o tablas con muchos registros, claves IP únicas.

**Evidencia.** Body API sin límite; `XLSX.read` síncrono antes de filas; upload sin tamaño/cuota; Map sin eviction; varios listados y borradores sin paginación; `.select()` completo en tres puntos; exports dependen del volumen cargado. No se ejecutó carga ni DoS.

**Impacto técnico / empresarial / multiempresa.** CPU/memoria de pestaña o función, costos Storage/DB y degradación compartida entre tenants.

**Reproducción local segura.** Límites unitarios, no saturación: body justo sobre umbral, workbook de dimensiones declaradas altas pero pequeño, 101 registros con página 100, 21 claves para Map con máximo test 20.

**Corrección mínima.** Rechazo temprano de bytes/profundidad, paginación y TTL/LRU. **Ideal:** cuotas tenant, timeouts, workers, índices medidos y budgets de consultas/export.

**Regresión.** Tests de frontera N−1/N/N+1, timeout y cancelación. **Riesgo residual:** picos legítimos; backpressure y observabilidad.

### F-029 — El quality gate falla y no hay tests automatizados

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A06:2025, A08:2025 / ASVS 15.1.1, 15.4.1 / CWE-710 |
| Archivo y línea | `tsconfig.json:10-11`; 37 archivos lint; `package.json:5-10` sin `test` |
| Módulo / actor | Calidad global / equipo de desarrollo |
| Esfuerzo / prioridad / bloquea | Grande / P1 / **Sí** como quality gate |

**Precondiciones y abuso.** Un cambio activa efectos/hooks mutables o un `any` oculta contrato; build no ejecuta lint y no existe regresión automática.

**Evidencia.** Lint: 114 errores/48 warnings: 64 `no-explicit-any`, 27 hook immutability, 26 exhaustive-deps, 9 set-state-in-effect, 8 purity, entre otros. `strict:false`, `skipLibCheck:true`. 18 promesas potencialmente fire-and-forget requieren triage. No hay script/test files/config de Jest/Vitest/Playwright/Cypress. TypeScript/build 0 no invalidan este hallazgo.

**Impacto técnico / empresarial / multiempresa.** Mayor probabilidad de estados obsoletos, doble request y regresiones de seguridad/negocio no detectadas.

**Reproducción local segura.** `npm run lint` devuelve 1; `rg` de tests devuelve vacío. No hay actor malicioso directo.

**Corrección mínima.** Hacer lint 0 sin suppressions generales y activar reglas gradualmente. **Ideal:** strict TS, unit/integration/E2E con Supabase local, tests de concurrencia y quality gates CI obligatorios.

**Regresión.** `tsc`, lint, build y suites 0; cobertura de hallazgos P0. **Riesgo residual:** tests incompletos; mutation testing/revisión humana.

### F-030 — Dependencias moderadas, paquete obsoleto y entorno sin fijar

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Media / Alta |
| OWASP / ASVS / CWE | A03:2025 / ASVS 15.1.1 / CWE-1104 |
| Archivo y línea | `package.json`; `package-lock.json:1366-1370,5675-5678,6432-6438,7104-7111` |
| Módulo / actor | Supply chain / dependencia comprometida, build operator |
| Esfuerzo / prioridad / bloquea | Medio / P2 / **No** por sí solo |

**Precondiciones y abuso.** CSS aportado por atacante llega a PostCSS vulnerable, tooling procesa YAML/código no confiable o entornos Node distintos resuelven/comportan diferente.

**Evidencia.** Audit total: xlsx alta (F-016), cadena next/postcss moderada, js-yaml dev moderada y Babel dev baja. PostCSS advisory es contextual: no se halló CSS de usuario/innerHTML. `@supabase/auth-helpers-nextjs` está no soportado y sin imports. 15 paquetes outdated, 13 duplicados transitivos, 5 paquetes extraneous en `node_modules`; no `engines`/`packageManager`. Positivo: lock íntegro, sólo npm registry, sin hooks raíz.

**Impacto técnico / empresarial / multiempresa.** Exposición futura, builds no idénticos y superficie innecesaria. No se confirmó exploit PostCSS/dev en runtime.

**Reproducción local segura.** `npm audit --omit=dev --json`, `npm ls --depth=0` y build en versión Node fijada. No procesar CSS/YAML hostil.

**Corrección mínima.** Eliminar auth-helper no usado, fijar Node/npm y planear updates parche/minor. No seguir la sugerencia de bajar Next a 9. **Ideal:** Renovate/Dependabot, SBOM, provenance, CI limpio `npm ci` y revisión del tarball SheetJS alternativo.

**Regresión.** Audit con excepciones documentadas/fecha, `npm ci` reproducible y suite completa. **Riesgo residual:** advisories sin parche; compensación/feature disable.

### F-031 — El SQL de auditoría RLS puede producir falsos diagnósticos

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Confirmado / Baja / Alta |
| OWASP / ASVS / CWE | A02:2025 / ASVS 15.1.1 / CWE-754 |
| Archivo y línea | `sql/auditoria_rls_control_plus.sql:53,166-187` |
| Módulo / actor | Herramienta de auditoría / operador |
| Esfuerzo / prioridad / bloquea | Pequeño / P3 / **No** |

**Precondiciones y abuso.** Existe tabla homónima en otro schema o el operador interpreta la salida como inventario completo.

**Evidencia.** Join a `pg_class` por `relname` sin ligar correctamente `relnamespace` de `c`; puede duplicar/falsear. La lista es fija y no inventaría funciones/vistas/objetos nuevos; Storage sólo se consulta, no se define.

**Impacto técnico / empresarial / multiempresa.** Falsa sensación de cobertura o ruido; no concede acceso directamente.

**Reproducción local segura.** Crear schema/table homónima ficticia y ejecutar sólo la consulta diagnóstica local; observar duplicado.

**Corrección mínima.** Unir `c.relnamespace='public'::regnamespace`. **Ideal:** inventario dinámico completo con expected-state versionado y salida machine-readable.

**Regresión.** Homónimos no alteran salida y objetos nuevos aparecen como desviación. **Riesgo residual:** lectura desactualizada; CI periódico.

### F-032 — Hipótesis descartada: service role antes de finalizar checks

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Descartado / Informativa / Alta |
| OWASP / ASVS / CWE | A01:2025, API5 / ASVS 8.3.1 / CWE-863 (hipótesis) |
| Archivo y línea | `app/api/admin/perfiles/route.ts:98-111,127-153,206-255` |
| Módulo / actor | API Admin / anónimo |
| Esfuerzo / prioridad / bloquea | Ninguno / — / **No** |

**Precondiciones y escenario evaluado.** Se investigó si un anónimo podía alcanzar `auth.admin`/DB privilegiada antes de auth, rol y validación.

**Evidencia.** El valor de entorno se lee y se comprueba al inicio, pero el cliente service role se construye en `:250`, después de `getUser`, perfil activo, rate, rol y validación de UUID/email/rol/idempotency. Su primer uso privilegiado es posterior. No aparece en cliente.

**Impacto técnico / empresarial / multiempresa.** La hipótesis concreta queda descartada. F-007 y F-023 siguen aplicando a la autorización/atomicidad posterior.

**Reproducción local segura.** POST sin sesión debe devolver 401 y no producir llamada `auth.admin`; usar mocks/spies locales.

**Corrección mínima.** Conservar el orden y añadir una prueba explícita.

**Corrección ideal.** Encapsular service role en un módulo `server-only` con una interfaz mínima.

**Prueba de regresión.** El spy privilegiado debe permanecer en cero para respuestas 401/403/400.

**Riesgo residual.** Una refactorización futura puede adelantar el cliente; mantener la prueba como gate.

### F-033 — Hipótesis descartada: secreto versionado o histórico detectable

| Campo | Valor |
|---|---|
| Estado / severidad / confianza | Descartado / Informativa / Media-alta |
| OWASP / ASVS / CWE | A02:2025 / ASVS 13.3.1 / CWE-798 (hipótesis) |
| Archivo y línea | `.gitignore:34`; `lib/supabase.ts:3-4`; `proxy.ts:39-40`; `app/api/admin/perfiles/route.ts:98-100` |
| Módulo / actor | Secretos / lector del repositorio |
| Esfuerzo / prioridad / bloquea | Ninguno / — / **No** |

**Precondiciones y escenario evaluado.** Se buscaron `.env`, PEM, backups/dumps, JWT y valores hardcoded sin imprimir secretos.

**Evidencia.** 0 nombres sensibles versionados/históricos, 0 patrones JWT y 0 private-key headers en todas las revisiones Git. `.env.local` está ignorado y no trackeado; sólo contiene los nombres esperados. Service role sólo se referencia como variable servidor; anon key es pública por diseño. No se inspeccionaron secretos de Vercel/Supabase ni capturas externas.

**Impacto técnico / empresarial / multiempresa.** No se encontró exposición en el alcance; no prueba ausencia en plataformas externas.

**Reproducción local segura.** Repetir scanner que sólo emita archivo/tipo, nunca valor, y secret scanning del proveedor.

**Corrección mínima.** No rotar sin evidencia; conservar `.env*` ignorado y revisar alertas del proveedor.

**Corrección ideal.** Secret manager, scanning pre-commit/CI e inventario/respuesta documentados.

**Prueba de regresión.** Todo commit debe fallar ante un patrón validado de secreto ficticio.

**Riesgo residual.** Secretos fuera de Git, source maps o logs de despliegue; revisarlos con permisos apropiados.

## 24. Dependencias

### Resultado de `npm audit`

| Paquete/cadena | Severidad | Entorno | Estado/contexto | Tratamiento |
|---|---|---|---|---|
| `xlsx@0.18.5` | Alta | Producción | Prototype pollution y ReDoS; procesa archivos de usuario | Urgente: F-016; deshabilitar/reemplazar |
| `next@16.2.6` → `postcss@8.4.31` | Moderada | Producción | Requiere CSS no confiable reserializado; no se halló ese flujo | Evaluar fix upstream/compensación; no bajar Next a 9 |
| `js-yaml@4.1.1` vía ESLint | Moderada | Desarrollo | DoS con YAML hostil; app no parsea YAML de usuario | Actualizar tooling de forma controlada |
| `@babel/core@7.29.0` vía hooks ESLint | Baja | Desarrollo | No afecta si sólo compila código confiable | Actualizar tooling |

Referencias de las dependencias adicionales: [PostCSS GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [js-yaml GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) y [Babel GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8).

`npm audit --json`: 5 paquetes vulnerables (1 alta, 3 moderadas, 1 baja). `--omit=dev`: xlsx alta y cadena next/postcss moderada (3 paquetes). No se ejecutó `audit fix`.

### `npm outdated` al 13-07-2026

| Paquete | Current | Wanted | Latest |
|---|---:|---:|---:|
| `@supabase/ssr` | 0.10.3 | 0.10.3 | 0.12.0 |
| `@supabase/supabase-js` | 2.105.4 | 2.110.3 | 2.110.3 |
| `@tailwindcss/postcss` | 4.2.4 | 4.3.2 | 4.3.2 |
| `@types/node` | 20.19.40 | 20.19.43 | 26.1.1 |
| `@types/react` | 19.2.14 | 19.2.17 | 19.2.17 |
| `eslint` | 9.39.4 | 9.39.5 | 10.7.0 |
| `eslint-config-next` | 16.2.6 | 16.2.6 | 16.2.10 |
| `framer-motion` | 12.38.0 | 12.42.2 | 12.42.2 |
| `lucide-react` | 1.14.0 | 1.24.0 | 1.24.0 |
| `next` | 16.2.6 | 16.2.6 | 16.2.10 |
| `react` | 19.2.4 | 19.2.4 | 19.2.7 |
| `react-dom` | 19.2.4 | 19.2.4 | 19.2.7 |
| `recharts` | 3.8.1 | 3.9.2 | 3.9.2 |
| `tailwindcss` | 4.2.4 | 4.3.2 | 4.3.2 |
| `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |

Clasificación: xlsx es seguridad urgente; Supabase/Next/React patch-minor son recomendados con retest; ESLint/TypeScript/@types Node mayores son cambios mayores, no mezclar; auth-helpers debe eliminarse por no usado/no soportado. `xlsx` no figura outdated porque npm conserva 0.18.5 como última. El lock es íntegro y sin Git/tarballs externos. Hay 13 paquetes con versiones transitivas múltiples y 5 extraneous en `node_modules`; deben desaparecer con un `npm ci` futuro, no durante esta auditoría.

## 25. Autenticación

| Control | Evidencia | Evaluación |
|---|---|---|
| Login | `signInWithPassword`, error inválido genérico | Parcialmente positivo; email no confirmado se distingue |
| Logout | Sidebar, Dashboard, guard e inactivo llaman `signOut` | Presente; probar revocación y back/cache |
| Proxy | `getUser()` para todas las páginas privadas | Positivo como control optimista; no autoriza datos |
| Usuario inactivo | helper cliente y muchas policies | Parcial; algunas tablas de control/import siguen sólo `auth.uid()` |
| Cambio rol/empresa | la DB se consulta frecuentemente | Puede ser inmediato si RLS efectiva; sesión/JWT remoto no verificado |
| Cookies/refresh | browser cookies + SSR callbacks legacy | F-020; SameSite=Lax positivo, HttpOnly no viable en modelo actual |
| Sesiones concurrentes/revocación | sin control app visible | Necesita configuración/prueba de Supabase |
| MFA/AAL/step-up | no implementado | F-021 |
| Rate/CAPTCHA/bots | no visible en login app | Necesita configuración del proveedor/WAF |
| Callback/open redirect | no hay callback app | Allowlist de Supabase no verificada |

Un usuario inactivo puede ser expulsado al cargar una página, pero la denegación fuerte debe ocurrir en toda policy/RPC. Un navegador manipulado puede omitir el helper. No se usa `user_metadata` para autorización, lo cual es positivo.

## 26. Contraseñas

- El formulario recorta la contraseña con `trim()`, alterando un secreto válido; debe enviarla exactamente.
- Credenciales inválidas usan mensaje conjunto; “Email not confirmed” permite distinguir una clase de cuenta.
- No hay UI de recuperación/cambio, reautenticación reciente, MFA o AAL2.
- Longitud, complejidad basada en breached-password, rate de password/OTP, CAPTCHA, bloqueo inteligente y correo de recuperación pertenecen a Supabase Auth y no se pudieron verificar.
- No se realizó fuerza bruta, spraying ni credential stuffing. El retest debe usar pocos intentos controlados y configuración exportada, no ataques reales.
- Objetivo: password manager/autocomplete, política de longitud moderna, protección anti-automatización del proveedor y FIDO2/TOTP para privilegiados; no imponer complejidad arbitraria sin análisis de usabilidad.

## 27. Multiempresa

El aislamiento actual es inconsistente:

- positivo: muchas policies comparan `empresa_id` con `usuario_empresas`, y V2 usa helpers calificados;
- negativo: roles globales evitan pertenencia en cheques; módulo no se valida en DB; importaciones A+B usan criterio “alguna empresa”; prevalidación consulta B aun tras negar; faltan FKs compuestas versionadas y DDL de tablas raíz/views;
- auditor no tiene deny universal; una combinación de funciones reabre escritura;
- algunas policies sólo verifican asignación, no que `empresas` esté activa;
- service role y views pueden eludir RLS, por lo que necesitan scopes/`security_invoker` explícitos.

La separación multiempresa **no puede considerarse correcta** hasta cerrar F-001–F-010 y ejecutar una matriz directa A/B contra REST, RPC, views y Storage. Ocultar selector, botón o menú no es control.

### Revisión de lógica empresarial

| Invariante | Control observado | Brecha |
|---|---|---|
| Negativos/extremos/moneda | varias UI/RPC validan montos y moneda | límites/precisión/constraints no son uniformes; cliente es evadible |
| Fechas | Empleados impide retiro anterior en UI | asiento puede quedar fuera del período; reglas DB no completas |
| Balance/cierre | `registrar_asiento_completo` valida balance y locks | contabilizar documento no crea asiento; direct update evita transición |
| Doble pago/cheque | locks parciales e idempotencia | key opcional/race; fondos sobrecomprometibles |
| Doble empleado/import | hash, locks y algunos índices | hash declarado, scope por usuario y NIT/IGSS no únicos |
| Reversión repetida | estados/RPC en varios flujos | permisos y hashes/replay inconsistentes; errores SQL expuestos |
| Estado inválido/creador/auditoría | policies por empresa | columnas críticas mutables y auditoría posterior |
| Lost update | update individual V2 usa `version` | import ignora versión del preview; admin multi-request |
| Export no autorizado | UI/módulo y fórmula neutralizada | autorización/minimización depende de RLS/query amplio |

## 28. Supabase

### Clientes y privilegios

- Browser anon singleton: `lib/supabase.ts`.
- Server anon con cookies: `proxy.ts` y Route Handler.
- Service role: sólo Route Handler, servidor, después de checks (control positivo F-032).
- Variables públicas: URL y anon key; privada: service role. No hay service key en bundle detectada.

### RLS, grants y RPC

- 144 policies/38 RLS/33 definers indican esfuerzo significativo, pero cobertura no equivale a seguridad.
- V2 es el mejor patrón técnico: path vacío, nombres calificados, revokes, locks, versión y límites.
- Scripts antiguos usan grants de tabla amplios, `search_path=public`, revokes incompletos y estados directos.
- `service_role` y owner omiten RLS; la API debe reducir su blast radius.
- `vista_resumen_chequeras`, Storage y 37 relaciones carecen de definición local completa.

### Evidencia remota mínima requerida

Dump de sólo metadatos, sin filas ni secretos: `pg_policies`; `relrowsecurity/relforcerowsecurity`; grants/column privileges; `pg_proc` con owner/ACL/config/definición; constraints/índices/triggers; view definitions/`reloptions`; policies/bucket settings; `supabase_migrations.schema_migrations`; configuración Auth exportable. Compararlo con un expected-state revisado antes de cualquier GO.

## 29. Empleados V2

### Controles correctos

- escritura directa a `empleados_planilla` revocada; UI usa RPC;
- `search_path=''`, nombres calificados, allowlists, advisory locks y savepoints por fila;
- idempotencia, `version` en update individual, 1,000 filas/5 MB y snapshots que evitan algunos secretos;
- tabla bancaria nueva excluye `secreto_referencia` del grant.

### Brechas

- SELECT completo revela salario/PII/cuenta legacy a cualquier miembro de empresa;
- prevalidación BOLA consulta tenant ajeno y devuelve UUID/versión;
- import usa helper sensible que no niega auditor;
- policy A+B filtra por “alguna empresa”, no fila;
- preview no vincula versión de confirmación; hash/bytes y dedupe son declarativos/por usuario;
- NIT/IGSS no son únicos y locks por usuario permiten carreras cruzadas;
- campos de plantilla aceptados se ignoran en RPC; manual/import no tienen contrato equivalente;
- comentario/documentación de migración contradice el estado informado.

Dictamen específico: **NO-GO para Empleados V2 con datos reales** hasta F-001, F-003–F-006 y tests por columnas/roles.

## 30. Excel

| Aspecto | Empleados V2 | Importador genérico | Evaluación |
|---|---|---|---|
| Extensión | sólo `.xlsx` | `.xlsx`, `.xls`, `.csv` | Parcial |
| Tamaño | 5 MB antes de parse | 5 MB antes de parse | Positivo parcial |
| Filas | 1,000 después de parse | 1,000 después de parse | No limita costo de parse |
| MIME/magic | No | No | Brecha |
| Macros/fórmulas | Rechaza, pero después de parse | No rechaza | Brecha alta legacy |
| Celdas/texto | límites/neutralización | desigual | Parcial |
| Hash | SHA-256 browser | hash browser | Servidor no ve bytes |
| Revalidación servidor | estructura JSON parcial | RLS/tablas directas | Insuficiente |
| Atomicidad | RPC por lote/savepoint | inserts directos/parciales | Genérico inseguro |
| Parser | xlsx 0.18.5 en cliente | xlsx 0.18.5 en cliente | F-016 |

No se ejecutó un workbook malicioso. La ruta segura futura requiere reemplazar/aislar parser, validar bytes/dimensiones/descompresión, aplicar schema servidor, neutralizar fórmulas, job transaccional e idempotencia basada en bytes confiables.

## 31. APIs

Sólo existe `POST /api/admin/perfiles`:

- **Método:** POST; GET local 405.
- **Auth:** `getUser`; perfil activo; roles admin/jefe/supervisor.
- **Empresa:** no existe en contrato; brecha global F-007.
- **Schema:** allowlists parciales; extra fields se ignoran, no mass assignment directo; faltan máximos/body/CT.
- **Rate:** memoria+RPC; IP no confiable/serverless/fail-open, F-022.
- **Idempotencia:** prefix y tabla, pero hash/replay/atomicidad insuficientes, F-023.
- **CSRF/CORS:** sin ACAO abierto; SameSite=Lax ayuda. No Origin/Referer/CT; riesgo same-site.
- **Cache/timeouts:** no `Cache-Control` explícito ni timeout; POST normalmente no cacheable, pero debe declararse no-store.
- **Logs/errores:** IP hasheada (positivo), mensajes DB crudos y auditoría posterior.
- **Service role:** valor leído antes de auth, pero cliente/uso privilegiado sólo después de auth, activo, rol y body; hipótesis temprana descartada.

## 32. CSP

Política actual:

- fuertes: `default-src self`, `object-src none`, `frame-ancestors none`, `form-action self`, XFO DENY, nosniff, referrer y permissions;
- débiles: `script-src unsafe-inline`, style inline, Supabase wildcard, `base-uri self`, sin HSTS app, reporting, nonce/hash, strict-dynamic ni host exacto;
- `unsafe-eval` sólo desarrollo, comportamiento correcto;
- localhost comprobó CSP/XFO/nosniff en página, API 405 y 404; HSTS ausente.

Plan gradual sin romper Next.js: primero Report-Only y telemetría; inventariar inline/styles; fijar origen Supabase; implementar nonce por request siguiendo la documentación local de Next 16 y medir el costo de render dinámico, o hashes/SRI para activos estáticos aplicables; retirar `unsafe-inline` de script, luego de style; validar 2xx/3xx/4xx/5xx y hydration. No se modificó la CSP en esta auditoría.

## 33. Privacidad

No se emite conclusión legal. Técnicamente:

- se procesan DPI/NIT/IGSS, salario, cuenta bancaria, dirección, teléfono, correo, archivos e historiales;
- el listado de empleados infringe minimización al enviar sensibles antes de autorizar vista;
- `.select()`/DTO amplios pueden incorporar futuras columnas;
- la cuenta bancaria legacy completa convive con tabla nueva enmascarada;
- exports/print tienen defensas de fórmula/HTML, pero autorización depende del query;
- no se evidencia cifrado de campo, matriz de clasificación, retención, derecho de eliminación, backup policy ni borrado de objetos;
- logs/auditoría/idempotencia conservan nombres, correos, IDs/keys y metadata sin retención visible;
- signed URLs cortas y paths tenant son controles positivos, condicionados a policies de bucket.

Acciones: inventario de datos/propósito, views mínimas, enmascaramiento server-side, cifrado/secret manager para datos bancarios necesarios, retención diferenciada, export auditado, borrado/hold documentado y revisión de backups.

## 34. Disponibilidad

Riesgos confirmados: parser síncrono vulnerable; body/upload sin límites; Map sin eviction; rate serverless no global; listados/borradores sin paginación; exports en navegador; operaciones masivas; ausencia de timeouts/cancelación; locks/idempotencia inconsistentes. No se ejecutaron carga ni DoS.

Controles: límite 5 MB/1,000 filas, algunas `.limit/.range`, advisory/row locks en RPC, `Retry-After`, dedupe parcial y signed URLs. Objetivo: budgets por request/tenant, paginación obligatoria, cuotas, body/depth limits, worker, timeouts, backpressure, TTL/retención, índices medidos con `EXPLAIN` en staging y alertas de saturación.

## 35. Logs

Se observan entidades de auditoría, intentos bloqueados, historiales, alertas, usuario/empresa/fecha/resultado e IP hasheada en la API. Son buenos bloques de construcción. Las brechas son atomicidad, escritura desde cliente, retención y sobrecolección.

Inventario estático: 0 `console.log`, 230 `console.error`, 68 `console.warn`; 228 pasan objetos de error sin normalización. No se confirmó impresión deliberada de tokens, claves, password, DPI o cuenta completa. SQL/API pueden exponer `SQLERRM`/mensajes Supabase. Deben registrarse cambios de rol/empresa, salarios, exports, imports, cierres, anulaciones, MFA y resultados con correlation ID; nunca secretos o identificadores completos innecesarios.

## 36. Controles positivos

1. Cobertura completa de páginas privadas por proxy y uso servidor de `getUser`.
2. Service role aislado en servidor y no usado antes de checks.
3. Ausencia detectada de secretos versionados/históricos.
4. Patrón V2 con revokes, RPC, path vacío, locks, versionado y límites.
5. Policies con empresa/activo/`USING+WITH CHECK` en numerosos módulos.
6. Pagos bloquean cuenta padre y evitan sobrepago básico; pagar cheque exige función pagador y niega auditor.
7. Contabilidad valida balance/cuentas/moneda en partes de sus RPC.
8. No SQL dinámico construido con input cliente; identificadores dinámicos observados provienen de allowlist y valores se enlazan.
9. Excel V2 rechaza fórmulas/macros y calcula SHA; CSV neutraliza fórmulas.
10. React escapa texto; no hay sinks HTML/eval; print escapa y `window.open` usa noopener/noreferrer.
11. Storage path único/tenant, no upsert y signed URLs breves.
12. CSP/headers base presentes en respuestas locales.
13. Lockfile íntegro, registry único, sin scripts raíz de instalación.
14. TypeScript y build exitosos.

Estos controles reducen riesgo, pero no compensan los P0 ni prueban cumplimiento formal.

## 37. Pruebas ejecutadas

### Git y automatización

| Comando/prueba | Exit | Duración | Resultado |
|---|---:|---:|---|
| `git branch --show-current` | 0 | <1 s | Rama correcta |
| `git status`, `git status --short` inicial | 0 | <1 s | Limpio |
| `git log -10 --oneline --decorate` | 0 | <1 s | HEAD `0de637d`; sin merge abierto |
| `git diff --check` | 0 | 0.7 s | Sin whitespace en tracked diff |
| `git diff --cached --check` | 0 | <1 s | Sin staged diff |
| búsqueda `<<<<<<< / ======= / >>>>>>>` | 0 | <1 s | 0 archivos |
| `npx tsc --noEmit` | 0 | 32.3 s | Sin diagnósticos |
| `npm run lint` | 1 | 118.6 s | 114 errores, 48 warnings |
| `npm run build` | 0 | 126.9 s | 34 salidas estáticas; API dinámica; detectó `.env.local` sin imprimir valores |
| `npm audit --json` | 1 | 28.0 s | 5 paquetes vulnerables |
| `npm audit --omit=dev --json` | 1 | 4.1 s | xlsx alta + next/postcss moderada |
| `npm outdated` | 1 | 8.4 s | 15 paquetes con versión posterior |
| `npm ls --depth=0` | 0 con problemas reportados | 2.5 s | 5 paquetes extraneous |
| smoke Next local puerto 3107 | 0 | 14.8 s | login 200; API GET 405; 404; proceso detenido |
| scan nombres/JWT/PEM en historia | 0 | 43.4 s | 0 patrones/archivos |

Los exit 1 de lint/audit/outdated no significan que el comando no pudiera ejecutarse: comunican hallazgos. El build de Next no ejecutó el lint, por lo que su éxito no supera el quality gate.

### Smoke de headers localhost

| Ruta | Status | CSP | XFO | nosniff | HSTS | Cache-Control |
|---|---:|---|---|---|---|---|
| `/login` | 200 | Sí | DENY | Sí | No | `s-maxage=31536000` |
| `/api/admin/perfiles` GET | 405 | Sí | DENY | Sí | No | no explícito |
| `/__audit_missing__` | 404 | Sí | DENY | Sí | No | private/no-cache/no-store |

No se enviaron cookies, credenciales ni cuerpos mutantes y no se tocó Supabase remoto.

### Búsquedas transversales

- TODO/FIXME/HACK reales con límites de palabra: 0.
- `@ts-ignore`/`@ts-expect-error`: 0; `eslint-disable`: 1 (`app/dashboard/page.tsx:180`).
- `any`: 64 líneas/10 archivos; mayor concentración en reportes, importaciones, cheques y reinicio.
- `dangerouslySetInnerHTML`, `innerHTML`, `eval`, constructor Function ejecutable: 0.
- Catch vacío: 2, ambos documentan fallo auxiliar de storage local.
- Promesas sin `await`/`void`/catch detectadas por checker auxiliar: 18; requieren triage, no se declaran 18 bugs.
- Aserciones `process.env...!`: 4.
- SQL `SELECT *`: 60 ejecutables, principalmente `SELECT * INTO` internos; `.select("*")`: 0; `.select()` sin columnas: 3.
- Escrituras Supabase directas: 133; 126 fuera de Route Handler.
- Browser storage: 36 usos localStorage/1 sessionStorage para preferencias, actividad, idempotencia/estado; no JWT explícito.
- Encoding: 4 ocurrencias funcionales de mojibake en `rpc_cheques.sql`; otras ocurrencias se limitaron a docs históricos.

### Comandos/incidencias auxiliares

Todos los comandos obligatorios pudieron ejecutarse. Dos probes iniciales de PowerShell tuvieron errores de sintaxis/parsing (`if` inline y `ConvertFrom-Json` sobre lock); se repitieron con comandos compatibles y evidencia equivalente. Consultas exploratorias a versiones npm inexistentes devolvieron E404 antes de verificar las versiones correctas. Ninguna incidencia alteró archivos versionados ni invalida los resultados.

## 38. Pruebas omitidas

Omitidas por restricción o falta de entorno aislado:

- POST real sin sesión, usuario sin empresa/inactivo, A→B, UUID/empresa/rol alterados y llamadas RPC directas;
- campos extra, content-type incorrecto, body grande/profundo, Origin/Referer y CSRF dinámico;
- replay/idempotency payload distinto y concurrencia de pagos/cheques/imports;
- MFA, CAPTCHA, password policy, recovery, OTP, callbacks, sesiones concurrentes y revocación de Supabase Auth;
- explotación prototype pollution/ReDoS, zip bomb, macros, malware, MIME spoof, EICAR y uploads grandes;
- SQL/migraciones/policies/grants/constraints/views/Storage remotos o locales ejecutados;
- carga, DoS, fuerza bruta, password spraying, credential stuffing o ataques destructivos;
- verificación de datos/logs/backups/retención reales, WAF/CDN/Vercel y secretos desplegados;
- suite unit/integration/E2E: no existe runner ni tests en el repositorio;
- auditoría formal de accesibilidad con axe/lector de pantalla, estados de foco, doble clic/back tras logout y UX de errores/carga;
- `npm audit fix`, installs, updates, `depcheck` u otras herramientas no instaladas.

Las pruebas solicitadas de HTML, fórmula Excel, extensión, fila inválida y versión obsoleta se revisaron estáticamente, pero no se ejecutaron con payloads. Deben pasar a Supabase local/staging con datos ficticios durante el retest.

## 39. Evidencia

### Git

- Rama: `audit/auditoria-final-control-erpm-v1`.
- HEAD: `0de637d`; los siguientes commits incluyen V2 (`16aab76`, `c8932c5`, `5381795`).
- `MERGE_HEAD` ausente; 0 markers de conflicto; diffs staged/unstaged inicialmente vacíos.
- `.env.local` ignorado/no trackeado; 0 filenames sensibles en Git/historia; 0 JWT/PEM detectados.
- Estado final: 0 staged, 0 cambios tracked y un único untracked permitido, `docs/auditoria-final-control-erpm-v1.md`.

### Código y SQL

Las referencias de cada F-001–F-033 son la evidencia primaria. Métricas reproducibles: 146 tracked; 30 páginas; 1 API; 0 Server Actions; 60 relaciones; 30 `CREATE TABLE`; 41 funciones; 33 definers; 144 policies; 38 RLS; 4 triggers; 82 índices; 30 SQL/11,945 líneas.

### Fuentes externas

- OWASP Top 10:2025, API Top 10:2023, ASVS 5.0.0 y Cheat Sheet Series, enlazados en metodología.
- Advisories GitHub revisados de xlsx: [CVE-2023-30533](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) y [CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
- Documentación oficial de [instalación SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/) para evaluar una distribución mantenida fuera de npm; no se instaló.
- Guías de Next.js usadas desde `node_modules/next/dist/docs/`, correspondientes exactamente a 16.2.6; en particular, `use-router.md:53` documenta el riesgo de URLs no confiables.

### Escala de confianza

- **Alta:** flujo/literal/policy ausente o presente directamente en código.
- **Media:** cadena requiere ACL, configuración o interacción no verificadas.
- **Baja:** depende predominantemente de proveedor remoto.

La severidad valora impacto y precondiciones, no sólo la categoría OWASP. No se elevó a crítica ningún caso sin validación de despliegue/efecto.

## 40. Riesgos que bloquean producción

1. **Fuente de verdad:** F-001 y policies/views/Storage raíz no verificables.
2. **Autorización/tenant:** F-002–F-009, F-011, F-012 y F-024.
3. **Integridad financiera:** F-008–F-015 y F-019.
4. **PII/empleados:** F-003–F-006.
5. **Entrada no confiable:** F-016–F-018.
6. **Sesión/admin:** F-020–F-023.
7. **Quality gate:** F-029.

No basta con “aceptar” estos riesgos para producción: varios permiten modificar dinero/roles o leer PII. Una mitigación temporal sólo es aceptable si deshabilita de forma autoritativa el módulo y el endpoint/RPC, no si oculta el menú.

## 41. Riesgos no bloqueantes

Después de cerrar los anteriores, pueden gestionarse por plan y aceptación explícita:

- CSP/HSTS/reporting y cache: F-025, siempre que F-018 esté cerrado y el host aporte HSTS temporalmente.
- retención/minimización/logging: F-026, con plan fechado y sin datos excesivos nuevos;
- constraints/ciclo de vida adicionales: F-027, tras asegurar FKs tenant y deshabilitar limpieza;
- optimización de disponibilidad: F-028, con límites temporales/feature flags;
- dependencia moderada contextual y mantenimiento: F-030;
- precisión de la consulta de auditoría: F-031.

“No bloqueante” no significa innecesario; significa que puede cerrarse tras P0/P1 con compensaciones medibles.

## 42. Top 10 de correcciones

1. Congelar producción/datos reales y obtener un snapshot de metadatos remoto de sólo lectura; reconciliar baseline/migraciones.
2. Corregir inmediatamente el BOLA de `validar_importacion_empleados_v2` y el bypass de auditor.
3. Implementar autorización SQL central `activo + empresa activa + módulo + función + deny auditor` en toda tabla/RPC/view.
4. Revocar SELECT completo de empleados y publicar DTO/views mínimos con acceso sensible explícito.
5. Corregir cheques: empresa en cada transición, SoD, reserva/ledger de fondos y literal UTF-8.
6. Corregir CxP/CxC con función pagador, auditor deny, key obligatoria y pruebas concurrentes.
7. Sustituir importaciones financieras directas por RPC/jobs transaccionales por tipo.
8. Restringir alta administrativa a jerarquía/tenant/AAL2 y hacer perfil+asignaciones+auditoría atómicos.
9. Deshabilitar/reemplazar xlsx vulnerable y endurecer Excel/uploads con límites, magic, cuarentena y AV.
10. Crear suite automatizada A/B/roles/estados/concurrencia y exigir tsc+lint+build+tests+schema diff en CI.

## 43. Plan de 24 horas

- Ratificar **NO-GO** y bloquear despliegue/promoción.
- Deshabilitar autoritativamente en el entorno de prueba compartido: importaciones, uploads, alta de perfiles, cheques/pagos y lectura sensible hasta hotfix; no sólo ocultar UI.
- Revisar y retirar combinaciones auditor+función de escritura y cuentas supervisor/jefe globales innecesarias.
- Preparar snapshot de metadatos remoto de sólo lectura, con autorización separada, sin datos ni secretos.
- Hotfix P0 pequeño: retorno temprano BOLA, auditor deny, jerarquía de alta, allowlist de rutas antes de arreglar estado de Monitoreo, y bloquear import legacy.
- Añadir pruebas unitarias de esos hotfixes antes de aplicar. No ejecutar `planilla_rls_base.sql`.
- Abrir registro de incident/risk owner por F-001–F-019; no rotar claves sin indicio de exposición.

## 44. Plan de 7 días

- Construir baseline migrable y reconciliar drift en staging; versionar tables raíz, view y Storage.
- Diseñar helper único de autorización y aplicarlo primero a empleados, perfiles, cheques, CxP/CxC.
- Implementar views mínimas de empleado y retirar cuenta bancaria legacy de lecturas.
- Rehacer cheques/fondos y pagos con locks, SoD e idempotencia obligatoria.
- Retirar importaciones financieras directas; reemplazar/aislar xlsx o mantener feature apagada.
- Mover alta/asignaciones administrativas a transacción/RPC; arreglar cookies SSR.
- Establecer lint 0 para archivos tocados y suite mínima de roles A/B + concurrencia.

## 45. Plan de 30 días

- Extender autorización/RPC de transición a planilla, impuestos, conciliación, activos, proyectos y contabilidad.
- Migrar FKs compuestas, constraints de estado/aritmética y auditoría append-only.
- Implementar pipeline de archivo: cuarentena, firma mágica, AV/CDR, cuotas, compensación y retención.
- MFA/AAL2/step-up para privilegiados y operaciones de alto monto; recuperación/revocación probadas.
- CSP Report-Only, origen Supabase exacto, HSTS verificado y plan nonce medido.
- CI reproducible con Node/npm fijados, `npm ci`, schema diff, tsc/lint/build/tests/audit y secret scan.

## 46. Plan de 60 días

- Completar DTO/views por clasificación de datos y cifrado/minimización bancaria.
- Añadir observabilidad tenant: roles, empresas, salarios, exports, imports, cierres, anulaciones, denegaciones y rate.
- Jobs de retención para audit/idempotency/rate/huérfanos; política de backups/borrado.
- Paginación/budgets/timeouts/worker para listados, exports e importaciones; medir índices y locks.
- Eliminar `unsafe-inline` de script mediante nonce/hash y avanzar style; validar errores/redirects/API.
- Endurecer definers, owners/default privileges y retirar scripts manuales ejecutables fuera de migraciones.

## 47. Plan de 90 días

- Retest integral ASVS 5.0 L2 basado en evidencia, sin declarar cumplimiento automático.
- Pentest independiente sobre staging con datos sintéticos: BOLA/BFLA, tenant, Auth, Storage, XSS, business flows y concurrencia.
- Tabletop de respuesta a incidente/robo de sesión/fraude y restauración desde backup.
- Revisar segregación de funciones con negocio y aprobar matriz formal de roles/capacidades.
- SBOM/provenance/dependency policy, renovación automatizada y revisión trimestral de drift.
- Decisión GO por comité técnico/negocio/seguridad sólo si se cumplen criterios de cierre.

## 48. Plan de retesteo

1. Levantar Supabase local vacío desde migraciones; schema diff 0.
2. Sembrar únicamente datos ficticios: empresas A/B, cada rol, sin empresa, inactivo y combinaciones incompatibles.
3. Ejecutar REST directo y UI para R/C/U/D, aprobar, anular, importar, exportar y sensibles por módulo.
4. Probar 21 RPC: auth, activo, empresa, función, parámetros, key/hash, replay, rollback y errores.
5. Concurrencia coordinada: fondos/cheques, pagos, empleados/versiones, imports y admin; un solo efecto.
6. Views/Storage: A nunca lee/firma B; MIME/tamaño/magic/cuota/huérfano.
7. Auth: MFA/AAL, recovery, callbacks, invalidación, cambio rol/empresa e inactividad multi-tab.
8. API: 401/403/405/415/413/429, Origin, XFF, body extra/profundo y cookies refresh.
9. Frontend: ruta XSS corpus, HTML, CSV/formula, back tras logout, double click y estados de carga.
10. Headers 2xx/3xx/4xx/5xx; CSP report y nonce; no-store en sensibles.
11. Quality/supply chain: tsc/lint/build/tests/audit/SBOM/secret/schema scan.
12. Repetir con staging idéntico a producción y metadatos comparados, sin datos reales durante pruebas adversariales.

Cada test debe registrar actor, tenant, request, resultado esperado/real, cambios DB y evento auditado; no registrar tokens/PII.

## 49. Criterios de cierre

- F-001–F-024 y F-029 cerrados o, sólo para un módulo deshabilitado autoritativamente, no alcanzables y con fecha/owner.
- 0 críticas, 0 altas abiertas y 0 medias marcadas “bloquea producción”.
- Baseline desde cero y diff remoto de metadatos 0; migrations/history coherentes.
- Matriz A/B/roles/API/RPC/Storage 100% en verde, incluidos auditor/inactivo/sin empresa.
- Cero escrituras directas de transiciones críticas y cero SELECT de PII no autorizada.
- Concurrencia de fondos/pagos/import/admin produce un efecto y rollback íntegro.
- xlsx vulnerable fuera de rutas de entrada; upload pipeline aprobado.
- MFA/AAL2 para privilegiados; sesión/refresh/revocación probados.
- `tsc`, lint, build y suites retornan 0; audit sin altas de producción o excepción compensada con feature off.
- CSP/headers verificados en Vercel; HSTS y no-store efectivos.
- Logs/auditoría sin secretos/PII excesiva, append-only y con retención.
- Sign-off conjunto de producto, contabilidad, seguridad y operaciones; riesgo residual documentado.

## 50. Riesgo residual

| Momento | Riesgo | Razón |
|---|---|---|
| Actual | **Muy alto** | Acceso/PII/finanzas y estado DB no reproducible |
| Tras hotfix 24h | Alto | Se reducen cadenas directas, persiste arquitectura/drift |
| Tras 7–30 días y retest | Medio | Quedan configuración, insider, parser/Storage y errores nuevos |
| Objetivo antes de producción | Medio-bajo aceptado | Ningún alto abierto, defensa en profundidad y monitoreo |

Siempre permanecerán riesgo de cuenta privilegiada comprometida, colusión, vulnerabilidad de proveedor/dependencia, error humano y reglas contables incompletas. Deben gestionarse con MFA, SoD, mínimo privilegio, backups, monitoreo, change control y revisión periódica; no puede garantizarse seguridad absoluta.

## 51. Archivos revisados

**Todos los 146 archivos tracked** se inventariaron y escanearon. Distribución: raíz 11, `app/` 34, `components/` 5, `docs/` 37, `lib/` 19, `public/` 9, `sql/` 29, `supabase/` 1, `types/` 1.

Revisión profunda:

- los 30 SQL completos y la migración V2;
- `proxy.ts`, `next.config.mjs`, `package*.json`, `tsconfig.json`, ESLint y Git metadata;
- Route Handler completa, login/layout, sesión, auth/permisos, rate/idempotencia/auditoría;
- documentos/Storage, Excel/export, borradores, Empleados;
- rangos críticos de Admin, Usuarios, Importaciones, Cheques, Contabilidad, Pagos, Órdenes y Monitoreo.

Revisión transversal de todo `app/components/lib`: rutas, directivas cliente, Supabase/Auth, relaciones/RPC, mutaciones, selects, env/service role, storage/browser storage, sinks XSS/URLs, archivos/Excel, logging, errores, promesas y tipos. Docs se usaron para detectar instrucciones, claims de despliegue y contradicciones. Assets binarios se inventariaron por nombre/tipo; no se hizo análisis forense de píxeles.

Además se leyeron únicamente las fuentes instaladas necesarias de `@supabase/ssr` y las guías locales de Next.js 16.2.6.

## 52. Archivos no revisados

No quedó ningún archivo tracked completamente fuera del inventario/scan. No obstante, quedaron fuera de revisión semántica manual línea por línea:

- páginas de dominio grandes no críticas en todos sus detalles visuales y los 37 docs históricos completos;
- valores de `.env.local` por prohibición; sólo nombres/estado Git;
- `.next/`, `tsconfig.tsbuildinfo` y demás generados ignorados;
- la mayor parte de `node_modules` (salvo manifests/lock, fuentes SSR y docs Next relevantes);
- artefactos fuera del workspace: configuración Vercel/Supabase, secrets, source maps desplegados, WAF/CDN, logs, backups y datos;
- esquema/rows/policies/grants/Auth/Storage remotos.

Esta delimitación evita presentar un scan automático como lectura humana exhaustiva y define la evidencia que debe añadirse al retest.

## 53. Conclusión honesta

Control+ muestra una evolución clara hacia controles serios —especialmente en Empleados V2, headers, signed URLs, RPC e idempotencia—, pero todavía mezcla controles de UI, scripts manuales y privilegios directos de una manera que no sostiene una frontera empresarial verificable. El build exitoso confirma compilabilidad, no seguridad ni corrección contable.

La respuesta a “¿puede entrar a producción?” es **no**. Tampoco debe pilotarse con datos reales. Un piloto aislado y sintético puede ser útil si los módulos P0 están autoritativamente apagados. El camino a GO es concreto: baseline reproducible, autorización central en DB, columnas mínimas, transacciones/SoD, entrada de archivos segura, sesión/MFA, auditoría autoritativa y una suite actor A/B que demuestre el resultado.

No se declara que el sistema sea inhackeable ni se garantiza seguridad absoluta. El dictamen debe reabrirse si cambia el commit, el esquema remoto, la configuración Auth/Storage/Vercel o las dependencias.
