# Paquete de entrega operativa Control+

## Identificacion

| Campo | Valor |
|---|---|
| Sistema | Control+ |
| Estado | Entrega operativa, pendiente de aprobacion final |
| Fecha de preparacion | 2026-06-08 |
| Rama base | `main` |
| Rama de entrega | `release/paquete-entrega-control-plus` |

## Descripcion

Control+ es un sistema de gestion administrativa, financiera y contable por
empresa. Incluye controles de acceso por usuario, empresa, modulo y funcion
operativa; flujos contables formales; movimientos operativos; cheques; impuestos;
reportes; exportaciones y auditoria.

Este paquete organiza la documentacion, SQL critico, validaciones y actas
necesarias para completar una entrega operativa controlada. La existencia de los
archivos no confirma que el SQL este aplicado ni que la configuracion productiva
este aprobada.

## Modulos incluidos

- Administracion de usuarios, empresas, modulos y funciones operativas.
- Contabilidad formal: catalogo, configuracion, asientos, documentos,
  distribuciones y cierres.
- Cheques, fondos, autorizacion y pagos.
- Movimientos operativos.
- Impuestos y configuracion fiscal.
- Reportes contables y operativos.
- Exportaciones CSV compatibles con Excel y vistas imprimibles.
- Historial, auditoria y monitoreo.

## Documentos incluidos

- [Indice de documentos](indice-documentos.md)
- [SQL criticos](sql-criticos.md)
- [Checklist de entrega final](checklist-entrega-final.md)
- [Acta de cierre del paquete](acta-cierre-paquete.md)
- [Entrega final Control+](../entrega-final-control-plus.md)
- [Checklist de produccion](../checklist-produccion-control-plus.md)
- [Prueba integral](../prueba-integral-contabilidad-operativa.md)

## SQL criticos incluidos

El paquete referencia nueve scripts SQL criticos:

1. RLS formal contable.
2. Creacion transaccional de asientos borrador.
3. Finalizacion segura de asientos.
4. Anulacion segura de asientos.
5. Contabilizacion segura de documentos.
6. Cierre seguro de periodos.
7. Operaciones transaccionales de cheques.
8. RLS de movimientos operativos.
9. RLS de configuracion fiscal.

El detalle, orden recomendado y verificaciones estan en
[SQL criticos](sql-criticos.md).

## Requisitos antes de produccion

- Confirmar `main` limpio, actualizado y aprobado.
- Crear un backup verificable de Supabase.
- Confirmar variables de entorno productivas y proyecto Supabase correcto.
- Revisar policies, triggers, tablas, columnas y dependencias antes de aplicar SQL.
- Aplicar y verificar los SQL criticos.
- Configurar usuarios, empresas, modulos y funciones operativas.
- Validar el catalogo contable, especialmente `tipo` y `subtipo`.
- Confirmar al menos un periodo contable abierto valido.
- Ejecutar la prueba integral con usuarios reales y sesiones autenticadas.
- Obtener aprobacion contable y completar las actas.

## Orden recomendado de despliegue

1. Aprobar ventana de despliegue y responsables.
2. Confirmar rama de entrega y `main` limpio.
3. Ejecutar `npm run build` y `git diff --check`.
4. Verificar variables de entorno y conexion al Supabase correcto.
5. Crear y comprobar backup previo.
6. Revisar y aplicar SQL critico en el orden documentado.
7. Ejecutar `notify pgrst, 'reload schema';`.
8. Verificar policies, funciones, grants y triggers.
9. Configurar usuarios, empresas, modulos y funciones.
10. Preparar datos operativos iniciales.
11. Ejecutar validaciones y prueba integral.
12. Obtener aprobaciones y completar acta de cierre.

## Orden recomendado de validacion

1. Inicio de sesion y aislamiento por empresa.
2. Permisos negativos: auditor, usuario sin empresa y usuario sin funcion.
3. Creacion, finalizacion y anulacion de asientos.
4. Documentos, distribuciones y contabilizacion.
5. Previsualizacion y cierre de periodo.
6. Creacion y anulacion de movimientos.
7. Autorizacion y pago de cheque con movimiento generado.
8. Configuracion fiscal por funcion.
9. Reportes formales y filtros.
10. Exportaciones CSV y vistas imprimibles.
11. Auditoria de operaciones e intentos bloqueados.
12. Revision contable y firma de aceptacion.

## Pendientes reales antes de aprobacion final

- Aplicar y verificar SQL en el entorno productivo.
- Configurar y aprobar usuarios, empresas y funciones.
- Ejecutar la prueba integral con usuarios reales.
- Validar la clasificacion `tipo`/`subtipo` del catalogo.
- Obtener aprobacion del contador responsable.
- Crear backup previo a produccion.
- Completar el checklist y las actas con evidencia.

## Limitaciones comunicadas

- Excel se entrega mediante CSV compatible con Excel.
- PDF se genera mediante la impresion del navegador.
- El balance general formal depende de la clasificacion `tipo`/`subtipo` del
  catalogo.
- La prueba integral debe ejecutarse con usuarios reales.
