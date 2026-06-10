# Corrección de Acceso Rápido al Dashboard - Presentación

## 1. Causa encontrada
El flujo inicial de carga era monolítico. El estado `validandoAcceso` se mantenía activo hasta que finalizaban todas las consultas operativas (empresas, tareas, movimientos, órdenes y cheques). La latencia acumulada de estas peticiones secuenciales o en paralelo bloqueaba la entrada al sistema por varios segundos.

## 2. Qué estaba bloqueando
- El `await Promise.all([...])` de datos operativos dentro de la inicialización de sesión.
- Consultas de permisos de empresa que no son críticas para la validación de identidad.
- La falta de un temporizador de gracia para la respuesta de los servicios.

## 3. Archivos modificados
- `app/dashboard/page.tsx`

## 4. Qué se corrigió
- **Desacoplamiento:** Se separó la validación de sesión de la carga de datos. `setValidandoAcceso(false)` se ejecuta inmediatamente después de confirmar el perfil.
- **Carga en segundo plano:** Los datos operativos ahora se cargan asincrónicamente usando `cargandoDashboard`, permitiendo que el usuario vea el Sidebar y la estructura del Dashboard sin demora.
- **Timeout de 10s:** Se añadió un control de tiempo para evitar la pantalla de carga infinita, ofreciendo opciones claras de recuperación (Reintentar / Login).
- **Higiene de código:** Eliminación de funciones de carga duplicadas (`obtenerNombresEmpresas`).

## 5. Comportamiento esperado
1. El usuario entra y la validación de sesión toma menos de 1 segundo (en condiciones normales).
2. La pantalla "Validando credenciales" desaparece casi al instante.
3. Las métricas y gráficos muestran estados de carga individuales mientras el usuario ya puede interactuar con el menú.

## 6. Resultado de npm run build
**ESTADO: PASSED**