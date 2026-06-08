# Checklist de produccion Control+

## 1. Uso del checklist

Complete este documento antes de entregar Control+ para operacion. Registre
responsable, fecha, evidencia y resultado de cada punto.

Estados sugeridos: `Pendiente`, `Aprobado`, `Fallido`, `Bloqueado`, `No aplica`.

## 2. Plataforma y variables de entorno

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` corresponde al proyecto productivo | | | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` corresponde al proyecto productivo | | | |
| `SUPABASE_SERVICE_ROLE_KEY` existe solo en servidor y no se expone al cliente | | | |
| Supabase Auth permite iniciar sesion con usuarios autorizados | | | |
| La aplicacion productiva apunta al Supabase correcto | | | |
| `npm run build` finaliza correctamente | | | |
| No existen secretos productivos en archivos versionados | | | |

## 3. Base de datos y seguridad

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| Scripts SQL fueron revisados antes de ejecutarse | | | |
| RLS formal contable esta aplicado y habilitado | | | |
| RLS de `public.movimientos` esta aplicado y habilitado | | | |
| RLS de configuracion fiscal esta aplicado y habilitado | | | |
| No existen policies no versionadas pendientes de revision | | | |
| No existen policies esperadas con `USING true` o `WITH CHECK true` | | | |
| DELETE esta bloqueado donde corresponde | | | |
| RPC `registrar_asiento_completo` esta aplicada | | | |
| RPC `finalizar_asiento_contable` esta aplicada | | | |
| RPC `anular_asiento_contable` esta aplicada | | | |
| RPC `contabilizar_documento_contable` esta aplicada | | | |
| RPC `cerrar_periodo_contable` esta aplicada | | | |
| RPCs transaccionales de cheques estan aplicadas | | | |
| `pagar_cheque_transaccional` exige `pagador_cheque` | | | |
| Tablas y RPCs de idempotencia requeridas estan disponibles | | | |

## 4. Datos operativos iniciales

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| Empresas productivas estan activas y correctamente identificadas | | | |
| Usuarios base estan creados y activos | | | |
| Empresas estan asignadas a los usuarios correctos | | | |
| Modulos estan asignados segun responsabilidad | | | |
| Funciones operativas estan asignadas por empresa | | | |
| Ningun auditor combina funciones de escritura en la misma empresa | | | |
| Existe al menos un periodo contable abierto valido | | | |
| Catalogo de cuentas esta cargado y permite movimientos donde corresponde | | | |
| Tipo y subtipo del catalogo permiten clasificacion financiera suficiente | | | |
| Configuracion contable y fiscal requerida esta cargada | | | |
| Fondos estan activos, con moneda y saldos revisados | | | |
| Chequeras y numeros fisicos estan configurados cuando aplican | | | |

## 5. Pruebas de acceso y permisos

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| Usuario autorizado inicia sesion | | | |
| Usuario inactivo no opera | | | |
| Usuario sin empresa no consulta datos empresariales | | | |
| Auditor consulta y exporta, pero no escribe | | | |
| Auxiliar crea borradores, documentos y distribuciones | | | |
| Auxiliar no finaliza, anula ni cierra | | | |
| Contador revisor finaliza y anula por RPC | | | |
| Usuario sin funcion especializada no ve acciones sensibles | | | |
| Admin sin `pagador_cheque` no paga cheques | | | |

## 6. Pruebas operativas criticas

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| Crear asiento produce estado borrador | | | |
| Registrar/finalizar directo desde creacion es rechazado | | | |
| Finalizar asiento produce estado registrado | | | |
| Anular asiento exige motivo y deja auditoria | | | |
| Documento con distribucion valida puede contabilizarse | | | |
| Documento invalido no puede contabilizarse | | | |
| Movimiento operativo puede crearse por usuario permitido | | | |
| Anulacion de movimiento es logica y exige motivo | | | |
| Pago de cheque autorizado genera movimiento activo correcto | | | |
| Cheque no autorizado no puede pagarse | | | |
| Configuracion fiscal exige `contabilidad_configuracion` | | | |

## 7. Reportes, exportaciones y cierre

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| Balance de comprobacion usa solo asientos registrados | | | |
| Libro diario y libro mayor usan solo asientos registrados | | | |
| Estado de resultados respeta clasificacion disponible | | | |
| Reportes filtran por empresa, periodo, fecha y moneda | | | |
| Auditor puede consultar reportes permitidos | | | |
| Usuario sin empresa no obtiene reportes | | | |
| CSV abre correctamente en Excel con caracteres especiales | | | |
| CSV neutraliza valores que podrian ejecutarse como formula | | | |
| Vista imprimible permite imprimir o guardar PDF | | | |
| Exportaciones no incluyen metadatos internos ni JSON | | | |
| Previsualizacion de cierre muestra todos los bloqueos | | | |
| Periodo con pendientes o diferencia no cierra | | | |
| Periodo valido cierra por RPC y deja auditoria | | | |

## 8. Respaldo y entrega

| Verificacion | Resultado | Responsable | Evidencia |
|---|---|---|---|
| Existe respaldo reciente de la base antes de entrega | | | |
| Se verifico procedimiento de restauracion o recuperacion | | | |
| Scripts SQL ejecutados y su orden quedaron documentados | | | |
| Responsables operativos recibieron sus usuarios | | | |
| Manual de usuario fue entregado | | | |
| Manual administrativo fue entregado | | | |
| Matriz de permisos fue revisada y aprobada | | | |
| Prueba integral fue completada y firmada | | | |
| Riesgos o limitaciones pendientes fueron aceptados | | | |
| Canal y responsable de soporte quedaron definidos | | | |

## 9. Limitaciones que deben comunicarse

- Excel se exporta como CSV compatible con Excel.
- PDF se obtiene desde la impresion del navegador.
- El balance general formal depende de la clasificacion disponible en el catalogo.
- La contabilizacion documental no crea automaticamente un asiento contable.
- Control+ no automatiza tramites SAT desde los flujos documentados.

## 10. Aprobacion

| Rol | Nombre | Fecha | Firma o confirmacion |
|---|---|---|---|
| Responsable de negocio | | | |
| Responsable contable | | | |
| Administrador Control+ | | | |
| Soporte tecnico | | | |
