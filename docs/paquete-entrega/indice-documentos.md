# Indice de documentos de entrega Control+

## Documentos principales

| Documento | Proposito | Responsable principal |
|---|---|---|
| [Manual de usuario](../manual-usuario-control-plus.md) | Explica inicio de sesion, seleccion de empresa y operacion de contabilidad, cheques, movimientos, impuestos, reportes y exportaciones. | Usuarios operativos y soporte |
| [Manual administrativo](../manual-admin-control-plus.md) | Explica usuarios, roles, empresas, modulos, funciones operativas, buenas practicas y auditoria. | Administrador Control+ |
| [Checklist de produccion](../checklist-produccion-control-plus.md) | Verifica plataforma, Supabase, seguridad, datos iniciales, pruebas, respaldo y aprobacion. | Responsable tecnico y operativo |
| [Matriz de permisos](../matriz-permisos-control-plus.md) | Define el alcance de funciones contables, auditoria, pagos y reglas transversales. | Administracion y responsables de negocio |
| [Prueba integral](../prueba-integral-contabilidad-operativa.md) | Contiene casos positivos, negativos, coherencia, idempotencia y evidencia esperada. | QA, soporte y responsables operativos |
| [Entrega final](../entrega-final-control-plus.md) | Consolida estado por modulo, SQL requerido, pendientes, criterio de entrega y acta tecnica. | Responsables de entrega |

## Documentos del paquete

| Documento | Proposito |
|---|---|
| [README del paquete](README.md) | Resume alcance, requisitos, orden de despliegue y pendientes. |
| [SQL criticos](sql-criticos.md) | Organiza el orden, proposito y verificacion de los nueve scripts criticos. |
| [Checklist de entrega final](checklist-entrega-final.md) | Lista marcable para la ventana final de produccion. |
| [Acta de cierre](acta-cierre-paquete.md) | Registra responsables, estado, observaciones, pendientes aceptados y firmas. |

## Uso recomendado

1. Leer este indice y el README del paquete.
2. Completar el checklist de produccion.
3. Revisar y aplicar los SQL segun `sql-criticos.md`.
4. Ejecutar la prueba integral con usuarios reales.
5. Completar el checklist de entrega final.
6. Completar y firmar el acta tecnica y el acta de cierre.

## Limitaciones documentadas

- Excel se exporta mediante CSV compatible.
- PDF se obtiene mediante impresion del navegador.
- El balance general formal depende de `tipo`/`subtipo` del catalogo.
- La prueba integral requiere usuarios reales y sesiones autenticadas.
