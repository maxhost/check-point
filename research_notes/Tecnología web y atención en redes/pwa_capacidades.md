# Capacidades web/PWA en iOS y Android (estado a sept. 2026) para una PWA «Mis beneficios»

> Convención de confianza: **[alta]** = fuente primaria leída (webkit.org, developer.chrome.com, developer.android.com, blog de Google); **[media]** = fuente secundaria o snippet de búsqueda; **[no verificado]** = conocimiento previo del investigador sin fuente leída en esta sesión (está en Gaps o marcado así). Fecha de investigación: 2026-09-29.

## Matriz resumen (lectura rápida)

| Capacidad | iOS / iPadOS (Safari/WebKit) | Android (Chrome) | ¿Requiere instalar en Home Screen? | Confianza |
|---|---|---|---|---|
| Web Push (Push API + service worker) | Sí desde iOS/iPadOS 16.4, solo web app en Home Screen, pedido de permiso tras gesto del usuario | Sí (desde hace años), también en pestaña del navegador | iOS: **sí**. Android: **no** | iOS [alta]; Android [no verificado versión] |
| Declarative Web Push (JSON sin JS) | Sí desde iOS/iPadOS 18.4 (Home Screen); macOS Safari 18.5 | No encontré soporte en Chrome | iOS: sí | iOS [alta]; Chrome [gap] |
| Push silencioso | No: `userVisibleOnly: true` obligatorio; si no mostrás notificación se revoca la suscripción | Chrome también exige `userVisibleOnly: true` [no verificado]; sin push silencioso real | — | iOS [alta] |
| Badging API (número en el ícono) | Sí desde iOS 16.4, Home Screen; permiso ligado al de notificaciones | Parcial / punto de notificación, no número garantizado [no verificado] | Sí en ambos (necesita ícono instalado) | iOS [alta] |
| Geolocalización | Solo en primer plano (API estándar); reportado que pide permiso cada sesión en PWA | Solo en primer plano | No | [media] |
| Geofencing / geoloc. en segundo plano | **No existe** en la web | **No existe** en la web | — | [no verificado; ver Gaps] |
| Periodic Background Sync | No | Sí, solo PWA instalada, frecuencia según engagement | Android: sí | Android [alta]; iOS [media] |
| Background Sync / Background Fetch | No | Sí [no verificado versión] | — | iOS [media] |
| Notification Triggers (notificación programada local) | Nunca existió | Abandonado (origin trial Chrome 80–83, nunca a estable) | — | [media] |
| Web NFC | No | Sí, Chrome 89+ Android, solo NDEF, página visible, gesto del usuario | No | Android [alta]; iOS [media] |
| Web Share (compartir saliente) | Sí [no verificado versión] | Sí | No | [no verificado] |
| Share Target / App Shortcuts (manifest) | No | Sí (vía WebAPK) [no verificado versión] | Android: sí | iOS [media] |
| Contact Picker | No en estable [no verificado] | Sí Chrome Android [no verificado] | No | [no verificado] |
| Prompt de instalación (`beforeinstallprompt`) | No hay prompt programático; instalación manual vía Compartir → Añadir a pantalla de inicio | Sí (prompt + WebAPK) | — | iOS [media] |
| «Cualquier sitio abre como web app» | Sí desde iOS/iPadOS 26: cero requisitos de instalabilidad | n/a | — | [alta] |
| Auto-revocación de permiso de notificaciones | No reportado | Sí (Chrome Android y desktop, anunciado 10-oct-2025) para sitios con poco engagement y mucho volumen; **no aplica a web apps instaladas** | Instalar protege | [alta] |
| App Clips (entrada nativa sin instalar desde QR/NFC) | Sí; notificaciones efímeras 8 h sin pedir permiso | n/a | No (es nativo) | [media] |
| Google Play Instant / Instant Apps | n/a | **Discontinuado desde dic. 2025** | — | [alta] |

## Web Push en iOS y Android: requisitos, Declarative Web Push, silent push, límites y UX de permisos

### Takeaway
En iOS la notificación web solo existe para la PWA **agregada a la pantalla de inicio** (16.4+), con permiso pedido tras un gesto del usuario y sin push silencioso; desde 18.4 se puede usar Declarative Web Push (JSON que el sistema muestra sin service worker, con `navigate` y `app_badge`). En Chrome el push funciona también desde la pestaña, pero Chrome silencia/oculta el pedido de permiso a sitios con baja aceptación y desde oct-2025 revoca automáticamente el permiso a sitios poco usados que mandan mucho — **excepto a web apps instaladas**.

### Cited Findings
- iOS 16.4: Web Push para web apps de Home Screen requiere (1) agregada a Home Screen, (2) manifest con `display` `standalone` o `fullscreen`, (3) el pedido de permiso «en respuesta a interacción directa del usuario» — [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) [alta]
- iOS: los permisos de notificación se administran por web app en Ajustes > Notificaciones, como una app nativa, e integran Modos de Concentración (Focus), sincronizados entre dispositivos — [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) [alta]
- Push en una pestaña normal de Safari iOS no está soportado; solo PWA instalada — [instantpwa.com](https://instantpwa.com/answers/can-pwa-send-push-notifications-ios) [media]
- Declarative Web Push: disponible en iOS/iPadOS 18.4 para web apps de Home Screen y en macOS 15.5 (Safari 18.5); no requiere service worker ni JavaScript; mensaje JSON estandarizado con `title` (obligatorio), `body`, `navigate` (URL obligatoria que se abre al tocar), `app_badge` (opcional), `silent`, `lang`/`dir`; «la mayoría de los miembros opcionales de NotificationOptions también se pueden especificar» — [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) [alta]
- Declarative Web Push: si hay service worker instalado igual recibe el evento `push` y puede reemplazar la notificación (campo `mutable`); si no muestra nada, se usa la notificación declarativa de fallback — [WebKit 16535](https://webkit.org/blog/16535/meet-declarative-web-push/) [alta]; Safari 26.2 corrigió la lectura del campo `mutable` — [WebKit Safari 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) [alta]
- Silent push: WebKit exige `userVisibleOnly: true`; con el modelo clásico, «si un handler no muestra la notificación visible por cualquier motivo, revocamos su suscripción push». Con Declarative Web Push esa penalización desaparece porque la notificación se muestra sola — [WebKit 16535](https://webkit.org/blog/16535/meet-declarative-web-push/) [alta]
- Declarative Web Push también presentado en WWDC25 — [Apple Developer, WWDC25 sesión 235](https://developer.apple.com/videos/play/wwdc2025/235/) [media, no abierta]
- Safari 26.4 y 26.5 no agregan nada de web apps/push/badging/geolocalización/manifest — [WebKit 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/), [WebKit 26.5](https://webkit.org/blog/17938/webkit-features-for-safari-26-5/) [alta]
- Chrome: «Quieter Notification UI» reemplaza el popup por un ícono de campana en la barra de direcciones para sitios con baja tasa de aceptación o usuarios que suelen bloquear — [Insider: Quieter Permission UI](https://insiderone.com/quieter-permission-ui-for-web-push/) [media]
- Chrome (desde Chrome 84) bloquea notificaciones abusivas: sitios con mensajes falsos que imitan chats/alertas, phishing o malware — [OneSignal](https://onesignal.com/blog/chrome-will-block-abusive-notifications/); [Insider](https://insiderone.com/restricting-abusive-notifications-chrome-84s-new-update-to-protect-users-from-intrusive-websites/) [media]
- Chrome (anuncio 10-oct-2025, Android y desktop): revoca automáticamente el permiso de notificaciones a sitios con «muy bajo engagement y alto volumen de notificaciones»; «menos del 1% de todas las notificaciones recibe alguna interacción»; **«no revoca notificaciones de ninguna web app instalada»**; el usuario es avisado y puede re-otorgar o desactivar la función; los sitios que mandan menos vieron más engagement — [Google blog: automatic notification permission](https://blog.google/chromium/automatic-notification-permission/) [alta]
- Google dice haber bloqueado más de 7.000 millones de notificaciones no deseadas por día en Android en Q1 2026 — [Chrome Unboxed](https://chromeunboxed.com/how-google-blocked-7-billion-abusive-notifications-a-day-to-clean-up-chrome/) [media, secundaria]
- Android 16 (10-jun-2025) introdujo «notification cooldown»: en una ráfaga la primera alerta suena completa y las siguientes dentro de ~1 minuto son más silenciosas/minimizadas — [PushEngage](https://www.pushengage.com/notification-crackdown-compliance/) [media, fuente de proveedor]

### Inferences
- Para iOS, la PWA **tiene que** ser instalada antes de poder notificar: el primer contacto (QR en el comercio) no puede terminar en «activar avisos» sin pasar por Añadir a Home Screen.
- Declarative Web Push es la opción robusta en iOS: elimina el riesgo de perder la suscripción si el service worker falla, y permite actualizar el badge (`app_badge`) en el mismo push.
- En Android conviene empujar la instalación (WebAPK) no solo por UX sino porque **protege de la auto-revocación** de Chrome.
- La tasa de aceptación del permiso afecta la UX del prompt en Chrome (quiet UI): pedir el permiso solo en un momento contextual (p. ej. al sumar el primer beneficio) en vez de al cargar la página.

### Gaps
- No encontré documentación oficial de Apple de un **presupuesto/rate limit numérico** de Web Push en iOS (más allá de la regla de visibilidad). Tampoco de Chrome/FCM para web push (hay límites de FCM/TTL, no verificados en esta sesión).
- No verifiqué en fuente primaria si iOS muestra **imágenes** (`image`) o **botones de acción** (`actions`) en notificaciones web; la creencia general es que no se muestran en iOS y sí en Android Chrome, pero **no verificado**.
- No encontré si Chrome implementa Declarative Web Push (a sept-2026). Sin fuente.

## Badging API (número en el ícono de la app)

### Takeaway
En iOS 16.4+ la web app de Home Screen puede fijar un número en el ícono con `navigator.setAppBadge()`, que se muestra cuando el usuario concedió notificaciones; también se puede fijar vía `app_badge` en Declarative Web Push. En Android el comportamiento depende del launcher (no verificado).

### Cited Findings
- Home Screen web apps soportan la Badging API desde iOS/iPadOS 16.4; el badge se puede modificar «incluso antes de que se conceda el permiso para mostrar el contador», y se muestra una vez concedido el permiso de notificaciones; se controla aparte en Ajustes de Notificaciones — [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) [alta]
- Declarative Web Push acepta `app_badge` opcional — [WebKit 16535](https://webkit.org/blog/16535/meet-declarative-web-push/) [alta]

### Inferences
- Un contador «N beneficios disponibles» en el ícono es viable en iOS sin abrir la app, alimentado por push.

### Gaps
- Android Chrome: no verifiqué si `setAppBadge` muestra número o solo un punto (en Android los badges de launcher suelen derivar de notificaciones activas). **No verificado**.

## Geolocalización y geofencing

### Takeaway
La web solo tiene geolocalización en primer plano (con la página abierta y permiso). No hay API web de geofencing ni de ubicación en segundo plano en ninguna plataforma; «avisar al pasar cerca de un comercio» no es posible desde una PWA — solo desde nativo (o desde los pases de Wallet con ubicaciones relevantes, fuera de este alcance).

### Cited Findings
- En iOS PWA la geolocalización «funciona parcialmente» y «necesita permiso cada sesión» — [MagicBell 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) [media, secundaria]
- Safari 26.2 no trae novedades de geolocalización — [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) [alta]

### Inferences
- Para «cerca tuyo» en la home de Mis beneficios: pedir ubicación al abrir, ordenar por cercanía; no prometer avisos por proximidad desde la web.

### Gaps
- No leí fuente primaria que afirme explícitamente «no existe geofencing web en 2026»; la W3C Geofencing API fue abandonada hace años (**no verificado en esta sesión**). El comportamiento exacto de persistencia del permiso de ubicación en PWA iOS 26 no está verificado en fuente primaria.

## Ejecución en segundo plano (Periodic Background Sync, Background Fetch, trabajo disparado por push)

### Takeaway
iOS no ofrece ejecución en segundo plano para web apps salvo el handler de `push` (que debe mostrar notificación). Chrome Android ofrece Periodic Background Sync solo para PWAs instaladas y con engagement, además de Background Sync/Fetch. Las notificaciones programadas locales (Notification Triggers) están muertas: todo aviso tiene que salir del servidor.

### Cited Findings
- Periodic Background Sync (Chrome): solo tras instalar y lanzar la app como aplicación distinta; frecuencia según el site engagement score; `periodicsync` no se dispara si el engagement es 0; el ejemplo usa `minInterval` de 1 día; se alinea con cuán seguido se usa la app y con energía/conectividad — [Chrome for Developers: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync) [alta]
- iOS: Background Sync, Periodic Sync y Background Fetch «no funcionan» — [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) [media]
- Notification Triggers (`showTrigger`/`TimestampTrigger`) corrió como origin trial en Chrome (hasta ~Chrome 83), nunca llegó a estable y fue removido; nunca existió en Safari — [Chrome for Developers: Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers); [Chrome Platform Status](https://chromestatus.com/feature/5133150283890688) [media: el estado «removido» viene del resumen de búsqueda, no de la página leída]

### Inferences
- Toda re-activación («te queda 1 sello», «vence tu beneficio») tiene que planificarse en el servidor y enviarse como push.

### Gaps
- Versiones exactas de Background Sync / Background Fetch en Chrome no verificadas.

## Web NFC, Web Share, Share Target, Contact Picker, App Shortcuts, Launch Handler, File Handling

### Takeaway
Para un flujo de escaneo: Web NFC sirve **solo en Android** (leer/escribir tags NDEF con la página visible). En iOS, un tag NFC o QR con URL abre Safari/la web app vía el lector del sistema, sin API web. Share Target y App Shortcuts son Android-only (requieren instalación).

### Cited Findings
- Web NFC: Chrome 89, solo Android; HTTPS, top-level frame; requiere gesto del usuario y permiso «nfc»; página visible; solo NDEF (texto, URL, MIME, smart poster, external); no soporta ISO-DEP/NFC-A/B/F, P2P ni HCE (emulación de tarjeta); bloqueado con pantalla apagada o dispositivo bloqueado — [Chrome for Developers: Web NFC](https://developer.chrome.com/docs/capabilities/nfc) [alta]
- iOS: Web NFC, Web Bluetooth, WebUSB no soportados; Share Target y App Shortcuts no soportados — [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) [media]

### Inferences
- Web NFC no sirve para que el teléfono del cliente actúe como tarjeta (no hay HCE): el caso útil es que el **comercio** (Android) lea un tag o que el cliente toque un tag NDEF con URL — lo que en iOS funciona igual por el sistema sin API.
- Web Share (saliente) sirve para «compartí este beneficio/comercio» (referidos).

### Gaps
- No verifiqué en esta sesión: versiones de Web Share en Safari, Contact Picker (Chrome Android; en Safari detrás de flag), Launch Handler y File Handling en Android. Todos **no verificados**; baja relevancia para el flujo.

## Fricción de instalación: iOS 26, EU DMA, Android prompt/WebAPK

### Takeaway
iOS/iPadOS 26 bajó la fricción: **cualquier sitio** agregado a Home Screen abre como web app por defecto, sin requisitos de manifest, pero sigue sin haber prompt programático: el usuario tiene que ir a Compartir → Añadir a pantalla de inicio. En la UE, Apple revirtió en marzo-2024 el plan de quitar las web apps (iOS 17.4); siguen funcionando. Android tiene prompt de instalación y WebAPK.

### Cited Findings
- Safari 26.0: «Por defecto, todo sitio agregado a la pantalla de inicio abre como web app»; el usuario puede desactivar «Abrir como web app» para agregarlo como marcador; «ahora hay cero requisitos de instalabilidad en Safari» en iOS 26 / iPadOS 26 — [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) [alta]
- Safari 26: íconos SVG soportados — [WebKit WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/) [media, snippet]
- Safari 26.0 incluye Digital Credentials API (pedir documentos de identidad desde Apple Wallet) — [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) [alta]
- iOS: no hay prompt automático de instalación (`beforeinstallprompt` no existe) — [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) [media]
- UE/DMA: Apple anunció quitar las Home Screen web apps en la UE con iOS 17.4 y lo **revirtió** el 1-mar-2024: «seguiremos ofreciendo la capacidad existente de Home Screen web apps en la UE», construidas sobre WebKit — [TechCrunch](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/); [9to5Mac](https://9to5mac.com/2024/03/01/apple-home-screen-web-apps-ios-17-eu/) [media-alta]. **Contradicción**: MagicBell (2026) afirma que en la UE desde iOS 17.4 «las PWAs ya no corren standalone y el push no funciona» — [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide); eso describe la beta revertida y **parece desactualizado/erróneo**.
- Almacenamiento: MagicBell afirma que si el usuario no abre la PWA en una semana se borra todo el cache — [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) [media]; **dudoso**: la regla de 7 días de ITP históricamente cuenta días de uso de Safari y WebKit dijo que las Home Screen web apps tienen su propio conteo (no verificado en esta sesión).

### Inferences
- En iOS la instalación es el gran cuello de botella del canal push: hace falta una pantalla propia que enseñe «Compartir → Añadir a pantalla de inicio», idealmente en el momento de valor (después del primer sello).
- iOS 26 elimina el problema de un manifest mal configurado, pero no el del gesto manual.

### Gaps
- No verifiqué en fuente primaria el flujo exacto de Add to Home Screen en iOS 26 (si el menú Compartir lo muestra más arriba) ni si navegadores de terceros en iOS pueden agregar web apps (se sabe desde iOS 16.4, **no verificado aquí**).
- Criterios actuales de instalabilidad/WebAPK de Chrome Android 2026 no verificados.

## App Clips e Instant Apps como entrada «sin instalar» desde QR/NFC

### Takeaway
App Clips siguen siendo la única entrada nativa sin instalación en iOS, y pueden notificar **8 horas** sin pedir permiso (extensible a hasta una semana), limitado a usos transaccionales. En Android no hay equivalente: Google Play Instant se apagó en diciembre de 2025.

### Cited Findings
- App Clips: al abrirlo, iOS concede permiso de notificaciones por 8 horas sin preguntar (clave `NSAppClipRequestEphemeralUserNotification` en Info.plist); se puede pedir extender hasta 1 semana; Apple limita las notificaciones de App Clips a casos transaccionales — [Airship Docs](https://www.airship.com/docs/developer/sdk-integration/apple/push-notifications/app-clips/); [OneSignal](https://documentation.onesignal.com/docs/en/app-clip-support) [media; la página de Apple no se pudo leer: [Apple Developer](https://developer.apple.com/documentation/appclip/enabling-notifications-in-app-clips)]
- Google Play Instant: «a partir de diciembre 2025, las Instant Apps no pueden publicarse en Google Play y todas las APIs Instant de Google Play services dejarán de funcionar. Los usuarios ya no recibirán Instant Apps por ningún mecanismo»; Google recomienda deeplinks a la app normal — [Android Developers: Google Play Instant](https://developer.android.com/topic/google-play-instant) [alta]

### Inferences
- Un App Clip requiere tener una app nativa en App Store (el Clip es parte de ella): no encaja con una estrategia solo-web, y su notificación de 8 h/1 semana no reemplaza un canal de re-enganche a largo plazo.
- En Android la «entrada sin instalar» es simplemente la web (PWA en Chrome con push desde la pestaña).

### Gaps
- No confirmé en la doc de Apple (no cargó) el límite exacto de «hasta 1 semana» ni restricciones de App Clip 2026 (tamaño, invocación por NFC/QR/App Clip Code).

## Novedades 2025-2026 relevantes

### Takeaway
Lo nuevo que importa es: Declarative Web Push (iOS 18.4 / macOS 15.5), «todo sitio es web app» en iOS 26, y del lado de Chrome/Android el endurecimiento contra notificaciones (auto-revocación salvo PWAs instaladas, cooldown en Android 16). Safari 26.2–26.5 no trajo nada nuevo para PWAs. Notification Triggers sigue muerto.

### Cited Findings
- Ver fuentes arriba: [WebKit 16535](https://webkit.org/blog/16535/meet-declarative-web-push/), [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [WebKit 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/), [WebKit 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/), [WebKit 26.5](https://webkit.org/blog/17938/webkit-features-for-safari-26-5/), [Google blog](https://blog.google/chromium/automatic-notification-permission/).
- Safari 18.5/macOS 15.5 lleva Declarative Web Push al Mac, entregando notificaciones aun con el sitio cerrado y ahorrando batería — [MacRumors](https://www.macrumors.com/2025/05/12/safari-web-push-update-macos-15-5/) [media]

### Inferences
- Un producto que dependa de iOS 18.4+ para Declarative Web Push cubre a casi toda la base activa a sept-2026 (inferencia, sin dato de adopción).

### Gaps
- No revisé notas de Safari 26.1 ni 26.3, ni la beta de Safari 27 (WWDC 2026): podría haber novedades de web apps no cubiertas aquí.
