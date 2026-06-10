# Auditoría Integral de Control+ y Monitoreo del Sistema

**Fecha:** 2026-06-12  
**Rama de auditoría:** `audit/control-plus-revision-integral-monitoreo`  
**Estado del Build:** Exitoso (Next.js 16.2.6)

## 1. Resumen Ejecutivo
Control+ se encuentra en una fase de consolidación técnica. La arquitectura base es sólida, con un uso intensivo de Next.js, Supabase y una capa de seguridad operativa basada en RPCs e Idempotencia. Sin embargo, existe una brecha significativa entre los módulos "Operativos Iniciales" (Contabilidad, Cheques, Proveedores) y los módulos de "Estructura Base" (Planilla, Impuestos, Activos Fijos), los cuales aún no tienen lógica de negocio conectada. El módulo de **Monitoreo Sistema** tiene una base de datos excelente pero requiere una interfaz que permita la toma de decisiones ejecutivas.

## 2. Estado General del Sistema
- **Autenticación:** Estable a través de Supabase Auth.
- **Seguridad:** RLS habilitado en la mayoría de tablas; políticas pendientes de endurecimiento en módulos nuevos.
- **Arquitectura:** Híbrida; mezcla mutaciones directas desde el cliente con RPCs transaccionales de servidor (`security definer`).
- **Rutas:** 34 rutas funcionales detectadas.

## 3. Módulos Listos para Presentación (Estado Verde)
- **Dashboard:** Métricas reales y filtrado por empresa operativa.
- **Contabilidad V2:** Flujo de asientos, borradores, documentos y cierres.
- **Cheques:** Flujo transaccional completo con reserva de cheques físicos.
- **Proveedores / Clientes:** Gestión de maestros con validación de acceso y estados vacíos.
- **Administración Operativa:** Gestión de roles, funciones por empresa y perfiles.

## 4. Módulos Operativos con Observaciones (Estado Ámbar)
- **Finanzas:** Funciona, pero es una versión V1 simplificada que no genera asientos automáticos.
- **Tareas:** Reforzado recientemente, pero requiere validación de columnas de cancelación en producción.
- **Cuentas por Pagar/Cobrar:** Operativos vía RPC, pero con interfaces que aún exponen mensajes técnicos de error.
- **Reportes:** Generan información correcta, pero la calidad visual del PDF depende del motor de impresión del navegador.

## 5. Módulos que requieren corrección antes de entrega (Estado Rojo)
- **Planilla / Impuestos / Conciliación:** Solo existen como bases estructurales (tablas). La UI muestra "Fase posterior", pero no deben presentarse como funcionales.
- **Activos Fijos / Proyectos:** Sin lógica de depreciación o movimientos conectada a contabilidad formal.
- **Importaciones:** Alto riesgo de error si el archivo CSV no es perfecto; falta manejo de errores más amigable.

## 6. Fallas Visuales Encontradas
- **Inconsistencia en Diálogos:** Algunos módulos usan `react-hot-toast` mientras otros aún disparan `window.confirm` o `window.alert` nativos (Finanzas, Documentos).
- **Mojibake:** Persisten caracteres mal codificados en mensajes de historial y auditoría (`está`, `operación`).
- **Responsive:** Tablas extensas en Contabilidad y Cheques requieren scroll horizontal forzado en pantallas menores a 1440px.

## 7. Fallas Operativas Encontradas
- **Carga Infinita:** Si una consulta auxiliar falla en módulos legacy, el estado de carga (`loading`) no siempre se desactiva, dejando la pantalla bloqueada.
- **Validación de Admin:** El rol `admin` a veces salta validaciones que debería cumplir (como tener una función operativa asignada para pagar).

## 8. Riesgos Técnicos y de Seguridad
- **Prioridad Crítica:** RLS en tablas nuevas (`planilla`, `impuestos`) permite `SELECT` pero las políticas de `INSERT/UPDATE` son genéricas.
- **Prioridad Alta:** Exposición de mensajes crudos de PostgreSQL/Supabase en la UI, revelando nombres de columnas o restricciones de base de datos.
- **Prioridad Media:** Logs técnicos (`console.error`) activos en producción, exponiendo objetos de error completos.

## 9. Auditoría Especial: Monitoreo Sistema

### Diagnóstico de Datos
- **Origen de Alertas:** Tabla `public.monitoreo_alertas`. Los datos son reales y provienen de validaciones del sistema e intentos bloqueados.
- **Clasificación:** Existe severidad (`critica` a `info`) y estado (`Pendiente`, `Resuelta`).
- **Acción Recomendada:** La tabla tiene campos `accion_recomendada` y `posible_causa`, pero la UI rara vez los muestra de forma prominente.

### Diagnóstico Visual y UX
- **Diseño:** Es funcional pero parece una tabla de logs técnicos. No es "presentable" para un director financiero o de IT.
- **Uso de Ancho:** No aprovecha el ancho completo (centrado en contenedor estrecho).
- **Metadatos:** El campo JSON `metadatos` se muestra crudo o no se muestra, perdiendo información valiosa sobre el error.

### Conclusión del Módulo
Actualmente es un **Visor de Logs mejorado**, no un **Centro de Control**. Sirve para que un técnico entienda qué falló, pero no para que un administrador gestione la salud del sistema.

## 10. Recomendaciones Priorizadas

### Prioridad Crítica (Inmediato)
1. **Blindaje RLS:** Aplicar `sql/contabilidad_formal_rls_revisable.sql` y `sql/movimientos_operativos_rls_propuesto.sql`.
2. **Manejo de Errores:** Envolver inicializaciones de módulos en `try/catch` globales para evitar pantallas blancas.

### Prioridad Alta (Antes de Presentación)
1. **Limpieza de UI:** Sustituir todos los `alert()` y `confirm()` nativos por componentes de la librería UI del proyecto.
2. **Ocultar "Proximamente":** Asegurar que todo lo que no es funcional use la etiqueta "Fase posterior" y oculte botones de acción.

### Prioridad Media (Post-Presentación)
1. **Refactor de Monitoreo:** Convertir el visor de alertas en un Dashboard de salud del sistema.
2. **Normalización de Logs:** Implementar un logger que capture errores sin exponerlos al usuario final.

## 11. Plan de Corrección por Fases

### Fase 1: Seguridad y Estabilidad (Rama `fix/seguridad-estabilidad-base`)
- Aplicación de RLS pendiente.
- Corrección de manejadores de carga infinita.
- Reemplazo de diálogos nativos.

### Fase 2: Excelencia Visual (Rama `ui/refactor-consistencia-visual`)
- Corrección de mojibake.
- Ajustes de responsive en tablas críticas.
- Normalización de mensajes de éxito/error.

### Fase 3: Centro de Control (Rama `feature/monitoreo-operativo-v2`)
- Rediseño de Monitoreo Sistema.
- Integración de métricas de Rate Limit e Idempotencia en la vista de monitoreo.

## 12. Resultado de Build (`npm run build`)
**Resultado:** `PASSED`
- **Rutas estáticas:** 34 generadas.
- **TypeScript:** 0 errores (después de correcciones en perfiles e idempotencia).
- **Tamaño de bundle:** Dentro de los límites esperados.

---
**Recomendación sobre Monitoreo Sistema:**  
El módulo debe dejar de ser una lista de errores para convertirse en un tablero de **Salud Operativa**. Debe mostrar:
1. Resumen de intentos bloqueados (Seguridad).
2. Estado de los servicios de Supabase (Infraestructura).
3. Alertas de inconsistencia contable (Negocio).

**Próxima rama sugerida:**  
`fix/consolidacion-operativa-auditoria` (Para resolver los Hallazgos Altos antes de tocar Monitoreo).
```

### Resumen de la Auditoría para GEMINI CODE ASSIST:

1.  **Rama trabajada:** `audit/control-plus-revision-integral-monitoreo`.
2.  **Documento creado:** `docs/auditoria-integral-control-plus-monitoreo.md`.
3.  **Resultado de build:** Exitoso, sin errores de TypeScript.
4.  **Fallas Críticas:** RLS incompleto en módulos de "Fase posterior" y falta de manejo global de errores en inicialización de páginas.
5.  **Fallas Altas:** Uso de alertas nativas del navegador y exposición de errores técnicos de SQL al usuario.
6.  **Módulos Presentables:** Dashboard, Contabilidad V2, Cheques, Proveedores y Admin Operativo.
7.  **Módulos que requieren corrección:** Finanzas (V1 legacy), Importaciones (frágil) y los módulos estructurales (Planilla, Impuestos, etc.) que deben ser marcados claramente como no disponibles.
8.  **Recomendación sobre Monitoreo:** El backend es sólido pero la UI es demasiado técnica. Debe evolucionar de un "Visor de Logs" a un "Centro de Salud Operativa".
9.  **Próxima rama sugerida:** `fix/consolidacion-operativa-auditoria` para limpiar los riesgos de seguridad y estabilidad detectados.

He cumplido con el objetivo de no modificar el código operativo, limitándome a la documentación técnica exhaustiva para preparar el terreno para las correcciones.

<!--
[PROMPT_SUGGESTION]Genera un plan detallado de tareas para la rama fix/consolidacion-operativa-auditoria basado en este documento.[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]Diseña el esquema de componentes React para la versión V2 del módulo de Monitoreo Sistema (Salud Operativa).[/PROMPT_SUGGESTION]