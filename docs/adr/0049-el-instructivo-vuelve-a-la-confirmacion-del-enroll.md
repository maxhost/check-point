---
adr: 0049
fecha: 2026-09-05
estado: aceptada
resumen: Revierte la decisión 3 de la spec 0050 (mandada por el owner tras QA en vivo) y enmienda la consecuencia del ADR 0048 que prohibía enlazar el manifest en el enroll. El instructivo "Agregar a inicio" vuelve a la confirmación del enroll — mover la instalación a /wallet agregaba dos pasos y era pésimo flujo. Para que el ícono instalado ahí abra el wallet correcto, el 201 del enroll devuelve `walletManifestPath` (el manifest con `?c=<token>`) y la confirmación lo inyecta como `<link rel="manifest">`. Devolver eso es seguro porque viaja en la MISMA respuesta que ya setea la cookie de sesión: mismo destinatario, mismo poder.
---

# 0049 — El instructivo vuelve a la confirmación del enroll

> **Revierte la decisión 3 de la spec 0050** ("tras enrolarse, el usuario va a su wallet")
> y **enmienda la consecuencia del ADR 0048** que decía que la página del enroll "no enlaza
> el manifest y no debe hacerlo". **El núcleo del 0048 queda intacto**: el token viaja en
> la URL del manifest, nunca en la cookie.

## Contexto

La spec 0050 arregló el ícono instalado quitando el instructivo de la confirmación del
enroll y mandando al usuario a `/wallet` a instalarse ahí. El QA en vivo del owner
(2026-09-05) confirmó que el mecanismo funciona — **y que el flujo es inaceptable**: el
usuario recién enrolado tiene que descubrir un botón, navegar a otra página y recién ahí
recibir las instrucciones. El flujo requerido por el owner es:

1. Me enrolo.
2. Veo la felicitación **con** las instrucciones de "Agregar a inicio" **y** el botón de
   Apple Wallet, en la misma pantalla.
3. Agrego a inicio ahí mismo.
4. Abro el ícono y estoy **dentro de mi wallet**.

## Por qué la 0050 no lo hizo así

El bloqueo era real: la confirmación es client-side y el cliente no tenía el
`webViewToken`, así que no podía enlazar el manifest per-consumidor. La 0050 lo esquivó
moviendo la instalación; este ADR lo resuelve de frente.

## Decisión

1. **El 201 del enroll devuelve `walletManifestPath`**: la ruta relativa del manifest ya
   armada (`/wallet/manifest.webmanifest?c=<token>`, token URL-encodeado). Se elige la
   ruta armada y no el token crudo: capacidad mínima, un solo propósito.
2. **La confirmación del enroll inyecta `<link rel="manifest" href={walletManifestPath}>`**
   en el `<head>` al llegar al estado "done". Antes de enrolarse la página sigue **sin**
   manifest (un ícono agregado desde el formulario no tiene wallet que abrir).
3. **El instructivo iOS vuelve a la confirmación**, renderizado **directo** (como antes de
   la 0050, desacoplado de que VAPID esté configurado) junto al botón de Apple Wallet.
   Android/desktop conservan su `PushPrompt` (spec 0038).
4. `/wallet` no cambia: conserva su `generateMetadata` y su instructivo condicional — sigue
   siendo la superficie correcta para quien llega por otro camino.

## Por qué devolver `walletManifestPath` es seguro

**La sesión se emite sólo en el 201** (`issueSession` corre después de un `enroll` exitoso;
un teléfono ya miembro muere antes con 409). O sea: la respuesta que lleva el
`walletManifestPath` es la **misma** que setea la cookie de sesión — mismo destinatario,
mismo instante, mismo poder. Quien tiene esa respuesta ya tiene la sesión completa del
wallet; el token no le concede nada adicional. El `web_view_token` además ya es at-bearer
por diseño (ADR 0014) y ya viaja dentro del pase de Wallet. La regla dura de `CLAUDE.md`
sobre DTOs (claves internas de R2) no aplica: esto no es una clave interna, es la
credencial del propio usuario entregada al propio usuario.

**Invariante a blindar con test:** `walletManifestPath` aparece **únicamente** en el 201.
Ningún error (400/409/422/429/503) lo incluye, porque ninguno emite sesión.

## Riesgo asumido y plan B

Si Safari no honrara un `<link rel="manifest">` inyectado dinámicamente, el ícono
capturaría la URL del enroll (el bug original) en esos dispositivos. El QA en vivo del
owner es el oráculo — su dispositivo ya demostró honrar `start_url` instalando desde
`/wallet`. **Plan B documentado, no implementado:** confirmación server-renderizada (una
ruta de confirmación con sesión que emite el manifest por `generateMetadata`).
