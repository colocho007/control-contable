# Corrección de contraste en tema claro y módulo Auxiliar

Fecha: 11 de junio de 2026  
Rama: `fix/contraste-tema-claro-auxiliar-cuadros`

## Problema detectado

El tema claro cambiaba fondos oscuros por superficies blancas, pero conservaba
textos `cyan-100`, `cyan-200`, `cyan-300` y `cyan-400`. Esto reducía el
contraste de títulos, cifras, enlaces, badges y avisos en Reportes, Auxiliar,
Sidebar y otros módulos que reutilizan esas clases.

Auxiliar también mostraba una sección de próximos pasos y espacios de acciones
sin conexión operativa. Aunque las acciones no ejecutaban lógica, su ubicación
podía sugerir que existían funciones disponibles.

## Archivos modificados

- `app/globals.css`
- `components/Sidebar.tsx`
- `app/reportes/page.tsx`
- `app/auxiliar/page.tsx`
- `docs/correccion-contraste-tema-claro-auxiliar.md`

## Correcciones de contraste

- Se remapearon tonos cyan claros a un cyan oscuro y legible en tema claro.
- Se reforzó el contraste de bordes cyan en superficies claras.
- Se ajustaron también colores semánticos verdes, amarillos, ámbar y rojos
  claros para conservar legibilidad en avisos y estados.
- El elemento activo del Sidebar ahora usa la variable adaptable
  `--primary`.
- Reportes usa `--primary` en títulos y cifras contables destacadas.
- Los botones sólidos y el tema oscuro conservan su comportamiento visual.

## Ajustes en Reportes

- Los títulos de “Exportaciones para entrega” usan un color primario legible.
- Cada exportación muestra claramente `Disponible` o `No disponible`.
- Las exportaciones disponibles mantienen apariencia de acción.
- Los controles no disponibles muestran estilo gris, cursor bloqueado y dejan
  de parecer botones normales activos.
- Se reforzó el contraste de cifras destacadas en balance, diario, mayor,
  resultados y resúmenes por moneda.

## Ajustes en Auxiliar

- “Próximos pasos” se reemplazó por “Automatizaciones previstas”.
- Se agregó el texto:
  “Estas funciones están previstas para una fase posterior de automatización.”
- Cada función pendiente se presenta como una fila informativa discreta con
  badge `Fase posterior`.
- Se eliminó la columna `Acciones` de tareas porque no contenía acciones
  conectadas.
- Se eliminaron espacios de acciones sin función en documentos y cheques.
- Los estados vacíos ahora muestran:
  “Sin datos disponibles para esta empresa.”
- La bandeja se identifica explícitamente como informativa.

## Cuadros informativos o pendientes

Los indicadores de tareas, documentos, cheques y vencimientos permanecen como
resúmenes informativos. No tienen interacción ni estilo de botón.

Las funciones pendientes son:

- Tomar tarea.
- Asignación automática al auxiliar.
- Historial de preparación.
- Envío al contador.
- Corrección o rechazo.
- Evidencia obligatoria.
- Integración con documentos y cheques.

## Pendiente para fase posterior

- Conectar las automatizaciones de Auxiliar con flujos operativos reales.
- Definir permisos, estados y auditoría antes de habilitar acciones.
- Realizar validación visual final con usuarios en navegadores y pantallas de
  presentación.

## Validación

- `git diff --check`: correcto.
- `npm run build`: correcto.
- Next.js 16.2.6 compiló correctamente, TypeScript terminó sin errores y se
  generaron 34 páginas.

No se modificaron SQL, RLS, autenticación ni datos reales.

