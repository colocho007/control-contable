# Centro de Salud Operativa y Monitoreo - Control+

## 1. Resumen de Cambios
El módulo de Monitoreo ha evolucionado de un visor de logs técnicos a un **Centro de Salud Operativa** diseñado para la toma de decisiones.

- **Vista Ejecutiva:** Resumen superior con indicadores de salud del sistema y conteo de incidencias por severidad.
- **Priorización Humana:** Las alertas ya no se clasifican solo por error técnico, sino por impacto en el negocio (Crítica, Alta, Media, Baja).
- **Flujo de Trazabilidad:** Implementación de estados para gestionar el ciclo de vida de una incidencia (Pendiente -> En revisión -> Resuelta).
- **Higiene de Datos:** Se oculta la complejidad técnica (JSON, metadatos, IDs internos) en una sección colapsable exclusiva para administradores.
- **Acciones Directas:** Capacidad de navegar al módulo afectado y actualizar el estado de la alerta desde la misma tarjeta.

## 2. Clasificación de Severidad (Prioridad)
| Nivel | Impacto Operativo | Ejemplo |
|---|---|---|
| **Crítica** | Bloquea la operación, seguridad o el acceso principal. | Intento de bypass de RLS, fallo en cierre contable. |
| **Alta** | Requiere atención prioritaria para evitar errores financieros. | Cheque vencido, documento observado, fallo de carga CSV. |
| **Media** | Requiere seguimiento pero permite la operación continua. | Asiento en borrador antiguo, tarea próxima a vencer. |
| **Baja** | Informativa o preventiva. | Cambio de rol de usuario, actualización de perfil. |

## 3. Estados de la Alerta
- **Pendiente:** Alerta detectada por el sistema, aún no atendida.
- **En revisión:** Un responsable está investigando la causa.
- **Revisada:** Se ha analizado, se conoce el riesgo pero está en espera de corrección.
- **Resuelta:** El problema operativo o técnico ha sido subsanado.
- **Archivada:** Incidencia antigua que se conserva para historial pero sale de la vista principal.

## 4. Tipos de Alertas Soportadas
1. **Seguridad:** Cambios en roles, permisos denegados por servidor.
2. **Financieras:** Pagos vencidos, cheques sin fondos, descuadres.
3. **Estructurales:** Catálogo de cuentas vacío, empresas sin configuración fiscal.
4. **Técnicas:** Fallos en RPCs, errores de comunicación con Supabase.

## 5. Acciones del Usuario
- **Gestionar Estado:** Selector rápido para mover la alerta en el flujo de trabajo.
- **Ir al Módulo:** Enlace inteligente que redirige al origen del problema.
- **Detalle Técnico:** Sección colapsable que oculta IDs internos y objetos JSON por defecto para mejorar la legibilidad.

## 6. Pendientes (Próximas Fases)
- Integración con servicios de notificación (Email/Push) para alertas Críticas.
- Panel de "Uptime" de servicios externos.

## 7. Validación Técnica
- **Build:** `npm run build` ejecutado exitosamente.
- **Rutas:** `/monitoreo-sistema` optimizada para ancho completo.
- **Seguridad:** El detalle técnico se renderiza condicionalmente según el perfil del usuario.

## 8. Necesidades de Datos (Pendientes de Migración)
Para una funcionalidad perfecta, se recomienda en el futuro:
1. **Columna `empresa_nombre` en `monitoreo_alertas`**: Actualmente se calcula en el cliente; sería más eficiente tener el snapshot del nombre de la empresa en la tabla de alertas.
2. **Tabla `uptime_servicios`**: Para monitorear la disponibilidad de la API de Supabase y servicios de mensajería desde la UI.
3. **Campo `vencimiento_alerta`**: Para alertas financieras (como cheques) que deben escalar automáticamente si no se resuelven en N horas.