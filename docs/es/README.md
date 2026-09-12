# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | Español | [Français](../fr/README.md) | [Deutsch](../de/README.md) | [Русский](../ru/README.md)

Mejoras de calidad de vida para móviles en el perfil web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), empaquetadas como un único plugin. Todo se renderiza a través de los slots y señales de estado del propio host — sin toma del layout, sin widgets flotantes, sin sondear el DOM del chat.

## Qué incluye

- **Fila de reinicio** — una entrada "Reiniciar servicio" en Ajustes → General. Pide confirmación, reinicia el proceso de `dsh` y recarga la página automáticamente cuando el servicio vuelve a responder.
- **Interruptores de modalidad de entrada** — casillas text/image/video en cada fila de modelo del editor de proveedores nativo, que escriben el array `input` del modelo en `settings.yaml` (con copia de seguridad junto al archivo). Los modelos de catálogo sin una ruta personalizada muestran los interruptores en solo lectura.
- **Cajón para pantallas estrechas** — por debajo de 1024px la barra lateral se reduce a un pequeño chip en la esquina que conserva el toggle del propio host; al expandirla, la barra completa flota como un cajón sobre el contenido a ancho completo, y al elegir una sesión vuelve a cerrarse. El chip y el cajón se intercambian de forma atómica (sin animación de geometría que pueda congelarse cuando el hilo principal está ocupado), y un toque que cierra el cajón lo contrae en ese mismo fotograma en lugar de esperar a que el host vuelva a renderizar — de modo que un teléfono que ejecuta muchas sesiones a la vez no puede dejar el cajón atascado a medio expandir, y el chip cerrado nunca se queda en blanco sobre un raíl que el host ya ha vaciado.
- **Pestañas de ajustes en pantallas estrechas** — por debajo de 700px la navegación lateral del diálogo de ajustes se convierte en una fila de pestañas con desplazamiento horizontal.
- **Menú de modelos a ancho completo** — por debajo de 700px el menú de modelos del compositor se re-ancla justo al ancho del teléfono (márgenes de 12px) en lugar de quedar fuera de la pantalla; el host sigue controlando la colocación vertical sobre el disparador.
- **Tarjeta de pregunta desplazable** — por debajo de 1024px una pregunta pendiente ya no puede enterrar sus propias opciones: la pregunta queda acotada a su propia región desplazable, de modo que una pregunta larga se desplaza dentro de esa región mientras la lista de opciones de abajo se queda con el espacio que quede y las opciones, la fila de envío y los botones de minimizar y cerrar permanecen en pantalla y accesibles. Una pregunta corta no se ve afectada, y la tarjeta sigue ajustándose a su contenido.
- **Alternativa al panel de detalles** — el panel de herramientas a pantalla completa cuyo control de cierre no responde en el host actual no se renderiza en pantallas estrechas, de modo que no puede bloquear el chat.
- **Reactividad a prueba de tormentas** — los observadores del cajón/menú y el sondeador de ajustes reaccionan a una ráfaga de mensajes en streaming a una velocidad limitada y se repliegan mientras el host no está accesible; si el raíl se remonta durante una reconexión, el estado del cajón se conserva en lugar de parpadear, y los toques que cierran el cajón se reintentan a través de un remontaje en lugar de caer en un toggle obsoleto: muchas sesiones transmitiendo a la vez ya no congelan la entrada ni hacen temblar la barra lateral hasta dejarla inclickeable, esté abierta o cerrada.
- **Guardia del catálogo de subagentes** — el host sirve el catálogo de subagentes enumerando todo el corpus de sesiones en cada petición (~1s con un historial largo), y su cliente pregunta en cada selección, hover de chip y evento de pertenencia. El plugin envuelve ese refresco: a un padre sin hijos en la lista viva de sesiones no se le pregunta nunca, a un padre se le vuelve a preguntar como máximo una vez cada 2,5s, y los inicios de refresco se espacian — un fan-out de subagentes ya no agota al host con recorridos completos del corpus.
- **Chips de linaje que se abren con un clic** — en escritorio, los chips de subagentes ("N subagents" y el conmutador de título de subagentes) solo se abren al pasar el ratón en el host actual; un clic no hace nada. El plugin traduce un clic en un chip al par de eventos de hover que el host ya entiende, de modo que hacer clic abre y cierra el árbol (las migas de los ancestros conservan su navegación al hacer clic).
- **Recuperador de cabecera en pantallas estrechas** — por debajo de 1024px los chips de la cabecera de sesión (linaje, trabajos, preajuste) son más anchos que el teléfono y solo responden al hover. Se pliegan en una sola píldora (`≡ título · N agents · M jobs`); al tocarla se abre una hoja a ancho completo con el linaje de la sesión (cada ancestro tocable, cada uno con su número de descendientes), el árbol de subagentes enraizado en la raíz de la familia — las filas se renderizan desde la lista viva de sesiones y las ramas obtienen su catálogo bajo demanda a través del refresco con guardia — y los trabajos en segundo plano de esta sesión. En escritorio no cambia nada.
- **Autoactualización** — el paquete del cliente se sirve inmutable por revisión, así que una pestaña de teléfono puede seguir días con una build antigua. La página compara la revisión con la que arrancó contra la que el servidor publica ahora y se recarga a sí misma cuando la página está inactiva (nunca mientras se escribe un borrador), u ofrece un banner tocable.
- **Regulación del render de la lista de sesiones** — el host envía un frame de valor completo por cada cambio de proyección de cada sesión adjunta, y la vista de temporización de un subagente en ejecución cambia en cada evento confirmado, por lo que una flota ocupada en segundo plano emite 50-150 frames/s a la página. Cada frame volvía a renderizar toda la lista de sesiones (cada reconstrucción recorre todos los resúmenes más un barrido de caché O(n²) — medido como la mayor parte del tiempo del hilo principal, congelando la página hasta recargar). El plugin agrupa esos re-renderizados en un intervalo final adaptativo mientras los valores siguen llegando sin cambios a los almacenes por sesión — el streaming en segundo plano ya no congela la página, en cualquier sesión, nueva o antigua.
- **Interruptores por función** — el plugin instala una sección `dsh-mobile-upgrade` en Ajustes → Plugins con un interruptor por función.

## Capturas de pantalla

El chip flotante y el cajón de sesiones (anotados):

| | |
|---|---|
| ![Chip flotante](../../res/shot-floating-chip.png) | ![Cajón de sesiones](../../res/shot-drawer.png) |

## Instalación

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Reinicie `dsh web` y abra el perfil web en su teléfono: la fila de reinicio aparece en Ajustes → General y los interruptores en Ajustes → Plugins → dsh-mobile-upgrade. Los adjuntos usan el sistema de adjuntos propio del compositor del host.

Requiere `dsh` 0.1.5-rc.1 o posterior (el sistema de adjuntos integrado del host reemplazó la función de subida de este plugin).

## Configuración

La tarjeta de ajustes del plugin admite:

| Clave | Por defecto | Significado |
|---|---|---|
| `restartEnabled` | `true` | Ofrecer la fila de reinicio y su ruta |

## Interruptores por función

Cada función anterior puede activarse o desactivarse en Ajustes → Plugins → dsh-mobile-upgrade (surte efecto en la siguiente carga de la página), o anularse por dispositivo con una clave de `localStorage` — `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus`, `mfx-net`, `mfx-questions`, `mfx-selfupdate`, `mfx-agents`, `mfx-header`, `mfx-listthrottle` — donde el valor `"0"` desactiva la función.

## Limitaciones conocidas

- El cliente se engancha a elementos concretos de la interfaz del host por sus nombres de clase CSS hash (menú, toggle del cajón, editor de proveedores, chips de la cabecera de sesión). Si una build del host los renombra, las funciones afectadas se degradan hasta que este plugin se actualice; todo lo demás sigue funcionando. La región de la tarjeta de pregunta se localiza en cambio a través del propio gancho `data-question-key` de la tarjeta, de modo que una build del host que solo rehaga el hash de sus módulos CSS la mantiene funcionando.
- El recuperador de cabecera y el shim de clic de linaje cabalgan sobre los propios datos del host (la lista viva de sesiones y sus catálogos de subagentes); no añaden peticiones más allá de las obtenciones de ramas bajo guardia, y un toque sobre una fila cuyo modo aún está cargando se completa por sí solo cuando ese catálogo llega.
- Los interruptores de modalidad de entrada solo pueden modificar rutas de proveedores que usted haya personalizado; las rutas de solo catálogo son de solo lectura por diseño, porque fabricar una sección de catálogo colapsa el directorio de modelos.

## Notas de seguridad

Las rutas HTTP del plugin (reinicio, edición de ajustes) no realizan autenticación propia — confían en la superficie web de `dsh` en la que se cargan. Antes de exponerlo más allá de localhost, colóquelo tras la misma barrera que protege el resto de la interfaz (autenticación en proxy inverso, enlace a loopback).

## Enlaces de la comunidad

- [Linux.Do](https://linux.do) — Una comunidad para compartir y debatir sobre tecnología.

## Licencia

Distribuido bajo la [Synthetic Source License (SySL), versión 1.0](LICENSE).

> AVISO: Este software incluye código generado por inteligencia artificial. Consulte el archivo LICENSE para conocer los términos de la Synthetic Source License, incluidos los requisitos de divulgación de modelos.
