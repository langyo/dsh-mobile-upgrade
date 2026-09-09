# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | Español | [Français](../fr/README.md) | [Deutsch](../de/README.md) | [Русский](../ru/README.md)

Mejoras de calidad de vida para móviles en el perfil web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), empaquetadas como un único plugin. Todo se renderiza a través de los slots y señales de estado del propio host — sin toma del layout, sin widgets flotantes, sin sondear el DOM del chat.

## Qué incluye

- **Subida de adjuntos en el compositor** — un botón de clip junto a la fila de herramientas del compositor. Las imágenes pasan por la ruta nativa de adjuntos por pegado del editor; cualquier otro archivo se sube al servidor y su ruta absoluta se pega en el borrador para que el agente pueda leerlo con sus herramientas de archivos.
- **Fila de reinicio** — una entrada "Reiniciar servicio" en Ajustes → General. Pide confirmación, reinicia el proceso de `dsh` y recarga la página automáticamente cuando el servicio vuelve a responder.
- **Interruptores de modalidad de entrada** — casillas text/image/video en cada fila de modelo del editor de proveedores nativo, que escriben el array `input` del modelo en `settings.yaml` (con copia de seguridad junto al archivo). Los modelos de catálogo sin una ruta personalizada muestran los interruptores en solo lectura.
- **Cajón para pantallas estrechas** — por debajo de 1024px la barra lateral se reduce a un pequeño chip en la esquina que conserva el toggle del propio host; al expandirla, la barra completa flota como un cajón sobre el contenido a ancho completo, y al elegir una sesión vuelve a cerrarse.
- **Pestañas de ajustes en pantallas estrechas** — por debajo de 700px la navegación lateral del diálogo de ajustes se convierte en una fila de pestañas con desplazamiento horizontal.
- **Menú de modelos a ancho completo** — por debajo de 700px el menú de modelos del compositor se re-ancla justo al ancho del teléfono (márgenes de 12px) en lugar de quedar fuera de la pantalla; el host sigue controlando la colocación vertical sobre el disparador.
- **Alternativa al panel de detalles** — el panel de herramientas a pantalla completa cuyo control de cierre no responde en el host actual no se renderiza en pantallas estrechas, de modo que no puede bloquear el chat.
- **Interruptores por función** — el plugin instala una sección `mobile-ui-fix` en Ajustes → Plugins con un interruptor por función.

## Capturas de pantalla

El chip flotante, el cajón de sesiones, las pestañas de ajustes en pantallas estrechas y el botón de adjuntos del compositor (anotados):

| | |
|---|---|
| ![Chip flotante](../../res/shot-floating-chip.png) | ![Cajón de sesiones](../../res/shot-drawer.png) |
| ![Pestañas de ajustes](../../res/shot-settings-tabs.png) | ![Adjuntos](../../res/shot-composer-attach.png) |

## Instalación

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Reinicie `dsh web` y abra el perfil web en su teléfono: el clip aparece en el compositor, la fila de reinicio en Ajustes → General y los interruptores en Ajustes → Plugins → mobile-ui-fix.

Requiere `dsh` 0.1.2-rc.1 o posterior.

## Configuración

La tarjeta de ajustes del plugin admite:

| Clave | Por defecto | Significado |
|---|---|---|
| `uploadDir` | `<dsh home>/mobile-uploads` | Dónde se guardan las subidas que no son imágenes |
| `restartEnabled` | `true` | Ofrecer la fila de reinicio y su ruta |

## Interruptores por función

Cada función anterior puede activarse o desactivarse en Ajustes → Plugins → mobile-ui-fix (surte efecto en la siguiente carga de la página), o anularse por dispositivo con una clave de `localStorage` — `mfx-attach`, `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus` — donde el valor `"0"` desactiva la función.

## Limitaciones conocidas

- El cliente se engancha a elementos concretos de la interfaz del host por sus nombres de clase CSS hash (menú, toggle del cajón, editor de proveedores). Si una build del host los renombra, las funciones afectadas se degradan hasta que este plugin se actualice; todo lo demás sigue funcionando.
- Los interruptores de modalidad de entrada solo pueden modificar rutas de proveedores que usted haya personalizado; las rutas de solo catálogo son de solo lectura por diseño, porque fabricar una sección de catálogo colapsa el directorio de modelos.

## Notas de seguridad

Las rutas HTTP del plugin (subida, reinicio, edición de ajustes) no realizan autenticación propia — confían en la superficie web de `dsh` en la que se cargan. Antes de exponerlo más allá de localhost, colóquelo tras la misma barrera que protege el resto de la interfaz (autenticación en proxy inverso, enlace a loopback).

## Enlaces de la comunidad

- [Linux.Do](https://linux.do) — Una comunidad para compartir y debatir sobre tecnología.

## Licencia

Distribuido bajo la [Synthetic Source License (SySL), versión 1.0](LICENSE).

> AVISO: Este software incluye código generado por inteligencia artificial. Consulte el archivo LICENSE para conocer los términos de la Synthetic Source License, incluidos los requisitos de divulgación de modelos.
