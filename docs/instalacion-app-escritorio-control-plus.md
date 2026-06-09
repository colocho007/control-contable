# Instalacion de Control+ como aplicacion de escritorio

## Que es la app de escritorio Control+

Control+ puede instalarse desde Google Chrome o Microsoft Edge como una
aplicacion web de escritorio.

La aplicacion instalada:

- Aparece con el nombre `Control+`.
- Usa un icono propio.
- Abre en una ventana independiente del navegador.
- Inicia en `/login`.
- Mantiene el acceso protegido por el inicio de sesion existente.
- Conserva la sesion solamente cuando el navegador y la politica de seguridad
  lo permiten.

La instalacion no convierte Control+ en una aplicacion publica de tienda y no
modifica la autenticacion.

## Requisitos

- Usar una URL publicada mediante HTTPS.
- Tener Google Chrome o Microsoft Edge actualizado.
- Contar con un usuario autorizado de Control+.
- Mantener acceso a internet y conexion con Supabase.

## Instalar en Google Chrome

1. Abrir la URL autorizada de Control+ en Google Chrome.
2. Confirmar que la pagina mostrada corresponde al login de Control+.
3. Abrir el menu de Chrome.
4. Seleccionar `Transmitir, guardar y compartir` y luego `Instalar pagina como
   aplicacion`, o usar el icono de instalacion disponible en la barra de
   direcciones.
5. Confirmar el nombre `Control+`.
6. Seleccionar `Instalar`.

Chrome creara un acceso en el sistema operativo. Segun la configuracion del
equipo, tambien puede ofrecer crear un acceso directo en el escritorio o anclar
la aplicacion.

## Instalar en Microsoft Edge

1. Abrir la URL autorizada de Control+ en Microsoft Edge.
2. Confirmar que la pagina mostrada corresponde al login de Control+.
3. Abrir el menu de Edge.
4. Seleccionar `Aplicaciones`.
5. Seleccionar `Instalar Control+`.
6. Confirmar la instalacion y las opciones de acceso directo permitidas.

## Abrir desde el escritorio

- Usar el acceso directo `Control+` creado por Chrome o Edge.
- Tambien puede abrirse desde la lista de aplicaciones instaladas del
  navegador.
- Al abrirse, Control+ inicia en `/login`.
- Si existe una sesion valida conservada por el navegador, la aplicacion puede
  mantenerla conforme a las reglas actuales del sistema.

La aplicacion nunca omite el control de autenticacion ni guarda contrasenas en
el codigo.

## Desinstalar

### Google Chrome

1. Abrir Control+ como aplicacion.
2. Abrir el menu de la ventana.
3. Seleccionar `Desinstalar Control+`.
4. Confirmar la desinstalacion.

### Microsoft Edge

1. Abrir `edge://apps`.
2. Buscar Control+.
3. Abrir las opciones de la aplicacion.
4. Seleccionar `Desinstalar`.

Desinstalar la aplicacion no elimina el usuario ni los datos almacenados en
Control+.

## Limitaciones

- Requiere conexion a internet; no se configuraron capacidades offline.
- La disponibilidad del boton de instalacion depende del navegador, HTTPS y las
  politicas administradas del equipo.
- No se distribuye mediante Microsoft Store, Chrome Web Store ni otra tienda.
- La sesion puede expirar conforme a las reglas de seguridad existentes.
- Los iconos incluidos son placeholders operativos limpios con la marca `C+`.
  Deben reemplazarse por el arte final oficial cuando sea aprobado.
- La instalacion no otorga permisos adicionales dentro de Control+.

## Recomendacion para usuarios autorizados

- Instalar Control+ solamente en equipos autorizados y protegidos.
- No compartir la sesion ni las credenciales.
- Cerrar sesion al terminar el trabajo, especialmente en equipos compartidos.
- Reportar cualquier acceso inesperado al responsable administrativo.

## Verificacion tecnica

Antes de distribuir la instalacion:

1. Publicar Control+ mediante HTTPS.
2. Abrir DevTools y revisar `Application > Manifest`.
3. Confirmar nombre `Control+`, iconos, color y `start_url` igual a `/login`.
4. Instalar en Chrome y Edge.
5. Cerrar y abrir la aplicacion instalada.
6. Confirmar que inicia en `/login` y que la autenticacion conserva su
   comportamiento actual.
7. Confirmar que el icono se muestra correctamente en escritorio y barra de
   tareas.
