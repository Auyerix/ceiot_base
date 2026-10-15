# Frontend de dispositivos CEIOT

Interfaz independiente en HTML, CSS y JavaScript, sin React, Vite, dependencias externas ni compilación. Permite listar, buscar y registrar dispositivos utilizando la API existente. No modifica `api/index.js`.

## Copiar y probar en Linux

1. Copiá esta carpeta completa a `api/spa/static/frontend_device` dentro de tu proyecto en la máquina virtual.
2. Ejecutá tu API como lo hacés habitualmente, desde la carpeta `api`. El servidor actual resuelve `spa/static` respecto del directorio desde el que se inicia.
3. En el navegador de la máquina virtual, abrí `http://localhost:8080/frontend_device/`.

Si abrís el navegador desde Windows, usá la dirección o el puerto redirigido con el que accedés a tu API en VirtualBox, agregando `/frontend_device/`. `localhost` siempre corresponde a la máquina donde está el navegador.

No abras `index.html` con doble clic. La página debe servirse desde la misma API. No requiere otro servidor ni instalar paquetes. Para actualizar el diseño o la lógica, copiá nuevamente los archivos modificados y recargá el navegador.

## Contrato existente

- `GET /device`: lista JSON con campos `device_id`, `name` y `key`.
- `POST /device`: JSON `{ "id": "02", "n": "Sensor del living", "k": "123456" }`; responde texto.
- Las rutas son relativas al origen de la página, por lo que también funcionan con la IP de la máquina virtual.
- Las claves no se muestran en las tarjetas ni se guardan en almacenamiento del navegador. El endpoint existente igualmente las incluye en su respuesta.
- Los dispositivos se almacenan en memoria y se reinician con la API.
- El formulario consulta la lista antes de enviar para advertir sobre IDs repetidos. La API no impone unicidad y esta comprobación no evita altas simultáneas desde otros clientes.
- Se rechazan campos vacíos y comillas simples porque el endpoint actual concatena SQL. Esto es una compatibilidad del formulario, no una validación del backend.
- “Registrado en la API” indica existencia del registro; no indica que el sensor esté conectado o enviando mediciones.

## Comprobación manual en la máquina virtual

1. Confirmar que aparecen los dispositivos existentes.
2. Crear un dispositivo con ID nuevo y verificar que aparece en la lista.
3. Buscarlo por nombre e ID.
4. Intentar registrar el mismo ID y verificar el mensaje.
5. Probar Mostrar/Ocultar clave y el diseño en una ventana angosta.
6. Si la API deja de responder, verificar los mensajes de error y el botón Actualizar.

La aplicación no fue ejecutada en el equipo de desarrollo.
