# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | Español | [Français](../fr/README.md) | [Deutsch](../de/README.md) | [Русский](../ru/README.md)

Mejoras de calidad de vida para móviles en el perfil web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), empaquetadas como un único plugin. Casi todo se renderiza a través de los slots y señales de estado del propio host — sin toma del layout, sin sondear el DOM del chat. Algunos overlays son DOM puro en posición fija a propósito — el chip/tarjeta de conexión de la esquina inferior izquierda, el banner de autoactualización, el toast compartido: deben seguir vivos justo mientras el árbol React del host está congelado.

## Qué incluye

- **Fila de reinicio** — una entrada "Reiniciar servicio" en Ajustes → General. Pide confirmación, reinicia el proceso de `dsh` y recarga la página automáticamente cuando el servicio vuelve a responder.
- **Tarjeta de pregunta desplazable** — por debajo de 1024px una pregunta pendiente ya no puede enterrar sus propias opciones: la pregunta queda acotada a su propia región desplazable, de modo que una pregunta larga se desplaza dentro de esa región mientras la lista de opciones de abajo se queda con el espacio que quede y las opciones, la fila de envío y los botones de minimizar y cerrar permanecen en pantalla y accesibles. Una pregunta corta no se ve afectada, y la tarjeta sigue ajustándose a su contenido.
- **Reactividad a prueba de tormentas** — el observador de todo el documento de la tarjeta de pregunta y el sondeador de ajustes reaccionan a una ráfaga de mensajes en streaming a una velocidad limitada y se repliegan mientras el host no está accesible: muchas sesiones transmitiendo a la vez ya no congelan la entrada ni entorpecen la página, y la barra lateral queda en manos del diseño nativo del host para pantallas estrechas.
- **Guardia del catálogo de subagentes** — el host sirve el catálogo de subagentes enumerando todo el corpus de sesiones en cada petición (~1s con un historial largo), y su cliente pregunta en cada selección, hover de chip y evento de pertenencia. El plugin envuelve ese refresco: a un padre sin hijos en la lista viva de sesiones no se le pregunta nunca, a un padre se le vuelve a preguntar como máximo una vez cada 2,5s, y los inicios de refresco se espacian — un fan-out de subagentes ya no agota al host con recorridos completos del corpus.
- **Chips de linaje que se abren con un clic** — en escritorio, los chips de subagentes ("N subagents" y el conmutador de título de subagentes) solo se abren al pasar el ratón en el host actual; un clic no hace nada. El plugin traduce un clic en un chip al par de eventos de hover que el host ya entiende, de modo que hacer clic abre y cierra el árbol (las migas de los ancestros conservan su navegación al hacer clic).
- **Recuperador de cabecera en pantallas estrechas** — por debajo de 1024px los chips de la cabecera de sesión (linaje, trabajos, preajuste) son más anchos que el teléfono y solo responden al hover. Se pliegan en una sola píldora (`≡ título · N agents · M jobs`); al tocarla se abre una hoja a ancho completo con el linaje de la sesión (cada ancestro tocable, cada uno con su número de descendientes), el árbol de subagentes enraizado en la raíz de la familia — las filas se renderizan desde la lista viva de sesiones y las ramas obtienen su catálogo bajo demanda a través del refresco con guardia — y los trabajos en segundo plano de esta sesión. En escritorio no cambia nada.
- **Autoactualización** — el paquete del cliente se sirve inmutable por revisión, así que una pestaña de teléfono puede seguir días con una build antigua. La página compara la revisión con la que arrancó contra la que el servidor publica ahora y se recarga a sí misma cuando la página está inactiva (nunca mientras se escribe un borrador), u ofrece un banner tocable.
- **Regulación del render de la lista de sesiones** — el host envía un frame de valor completo por cada cambio de proyección de cada sesión adjunta, y la vista de temporización de un subagente en ejecución cambia en cada evento confirmado, por lo que una flota ocupada en segundo plano emite 50-150 frames/s a la página. Cada frame volvía a renderizar toda la lista de sesiones (cada reconstrucción recorre todos los resúmenes más un barrido de caché O(n²) — medido como la mayor parte del tiempo del hilo principal, congelando la página hasta recargar). El plugin agrupa esos re-renderizados en un intervalo final adaptativo mientras los valores siguen llegando sin cambios a los almacenes por sesión — el streaming en segundo plano ya no congela la página, en cualquier sesión, nueva o antigua.
- **Tarjeta de conexión** — el control de conexión de la esquina inferior izquierda del host no muestra reacción alguna al clic: el reintento que pide vuelve a sumergirse en el mismo transporte atascado, el aviso de recuperación es un div no clicable que desaparece por temporizador, y la barra lateral estrecha de raíl/cajón ni siquiera lo renderiza. Este plugin ancla el estado con un chip de DOM puro en esa esquina (vivo incluso con el árbol React del host congelado) y muestra encima una tarjeta semipersistente: permanece mientras el puntero esté dentro, se autodescarta al salir, y lleva las dos acciones que sí funcionan: una reconexión inmediata a través del servicio de conexión y una actualización manual completa de la página. Las peticiones `/api/` atascadas o fallidas aparecen en el mismo sitio: una insignia con el recuento en el chip y, dentro de la tarjeta, una lista de peticiones junto con una prueba de vida — por más peticiones que se cuelguen o fallen, ya no aparece ninguna advertencia junto a los controles del compositor.
- **Interruptores por función** — el plugin instala una sección `dsh-mobile-upgrade` en Ajustes → Plugins con un interruptor por función.

## Capturas de pantalla

Las pestañas de ajustes en pantallas estrechas y el recuperador de cabecera (anotados):

| | |
|---|---|
| ![Pestañas de ajustes](../../res/shot-settings-tabs.png) | ![Recuperador de cabecera](../../res/shot-header-collector.png) |

## Instalación

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Reinicie `dsh web` y abra el perfil web en su teléfono: la fila de reinicio aparece en Ajustes → General y los interruptores en Ajustes → Plugins → dsh-mobile-upgrade. Los adjuntos usan el sistema de adjuntos propio del compositor del host.

Requiere `dsh` 0.2.0-rc.2 o posterior (el sistema de adjuntos integrado del host reemplazó la función de subida de este plugin). El host trae ahora por sí mismo la pieza de pantalla estrecha — un cajón con sus botones de apertura en las esquinas superiores de la ventana —, de modo que este plugin deja de tocar la barra lateral: su propia toma de control del cajón y el botón flotante se retiraron en lugar de seguir peleándose con la implementación nativa; lo que queda son las mejoras de abajo.

## Configuración

La tarjeta de ajustes del plugin enumera un interruptor por función (véase «Interruptores por función»); `restartEnabled` también controla la ruta de reinicio:

| Clave | Por defecto | Significado |
|---|---|---|
| `restartEnabled` | `true` | Ofrecer la fila de reinicio y su ruta |

## Interruptores por función

Cada función anterior puede activarse o desactivarse en Ajustes → Plugins → dsh-mobile-upgrade (surte efecto en la siguiente carga de la página), o anularse por dispositivo con una clave de `localStorage` — `mfx-restart`, `mfx-net`, `mfx-questions`, `mfx-selfupdate`, `mfx-agents`, `mfx-header`, `mfx-listthrottle`, `mfx-conn` — donde el valor `"0"` desactiva la función. La clave `mfx-drawer` del cajón retirado y su posición de arrastre guardada por dispositivo (`mfx-chip-side` / `mfx-chip-top`) ya no se leen; borrarlas es opcional.

## Limitaciones conocidas

- El cliente se engancha a elementos de la interfaz del host a través de contratos `data-*` publicados — el `data-question-key` de la tarjeta de pregunta y el asiento `data-slot` del recuperador de cabecera — y, donde el host no publica atributo, por la parte local de un nombre de clase de módulo CSS (`_crumbs`, `_tabs`, `_headingBlock`). Los ganchos orientados a la barra lateral que usaba el cajón retirado (`data-sidebar-*`, `data-rightbar-col`, `data-shortcut-modal`, `_sidebarCol`) desaparecieron con él. Todos sobreviven a una reconstrucción: el hash delante del nombre local es lo único que cambia una reconstrucción. Si una build del host renombra los contratos que quedan, las funciones afectadas se degradan hasta que este plugin se actualice; todo lo demás sigue funcionando.
- El recuperador de cabecera y el shim de clic de linaje cabalgan sobre los propios datos del host (la lista viva de sesiones y sus catálogos de subagentes); no añaden peticiones más allá de las obtenciones de ramas bajo guardia, y un toque sobre una fila cuyo modo aún está cargando se completa por sí solo cuando ese catálogo llega.
- Los interruptores de modalidad de entrada solo pueden modificar rutas de proveedores que usted haya personalizado; las rutas de solo catálogo son de solo lectura por diseño, porque fabricar una sección de catálogo colapsa el directorio de modelos.

## Notas de seguridad

Las rutas HTTP del plugin (reinicio, edición de ajustes) no realizan autenticación propia — confían en la superficie web de `dsh` en la que se cargan. Antes de exponerlo más allá de localhost, colóquelo tras la misma barrera que protege el resto de la interfaz (autenticación en proxy inverso, enlace a loopback).

## Enlaces de la comunidad

- [Linux.Do](https://linux.do) — Una comunidad para compartir y debatir sobre tecnología.

## Licencia

Distribuido bajo la [Synthetic Source License (SySL), versión 1.0](LICENSE).

> AVISO: Este software incluye código generado por inteligencia artificial. Consulte el archivo LICENSE para conocer los términos de la Synthetic Source License, incluidos los requisitos de divulgación de modelos.
