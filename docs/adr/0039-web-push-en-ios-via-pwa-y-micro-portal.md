---
fecha: 2026-08-15
resumen: Web Push se habilita también en **iOS**, no solo Android (supersede el punto 2 del ADR 0038). En iOS el permiso y la suscripción **solo existen dentro de la PWA instalada en la pantalla de inicio** (iOS 16.4+), nunca en la landing de Safari — el flujo vive en **dos contextos**: (1) Safari muestra el registro + cómo añadir a inicio + un **escape hatch** que da el pase de Wallet directo sin instalar; (2) el ícono del home abre el **micro-portal** (la página post-registro ya existente `(consumer)/wallet`, hecha instalable) y **ahí** se pide permiso y se crea la `PushSubscription`. El micro-portal es la pieza **load-bearing** de iOS y se construye ahora. El token del portal es el `web_view_token` existente (rota con el `qr_token` en la recuperación de cuenta; esa rotación también purga las suscripciones Web Push). La motivación es asimétrica y explícita: iOS gana Web Push por el valor del portal (el pase de Apple ya notifica rico); Android lo gana por el contenido de la notificación (el banner de Google es genérico). Cripto **sin dependencia** (`node:crypto`): VAPID JWT ES256 (precedente 0033) + cifrado RFC 8291 verificado contra el vector del Apéndice A.
estado: aceptada; supersede el punto "Web Push solo Android" del ADR 0038; extiende 0037/0033; reencuadra la spec 0037
---

# ADR 0039 — Web Push en iOS vía PWA instalada y micro-portal

## Contexto

El ADR 0038 decidió dos transportes de notificación (`wallet` / `webpush`) y arrancó Web
Push **solo en Android** (punto 2, marcado como "revisable"), con el argumento de que en
iOS el pase de Apple ya notifica rico y Web Push exige instalar una PWA. La directiva del
owner (2026-08-15) revisa esa decisión: **la 0037 incluye iOS también.**

El motivo no es que en iOS falten notificaciones — el pase de Apple ya las da ricas. El
motivo es que el **micro-portal en la pantalla de inicio** (ver programas, cupones, el QR a
mano) tiene **valor propio**, y una vez instalado, Web Push viene **de yapa**. La asimetría
con Android es intencional:

- **Android:** Web Push existe para dar el **contenido rico de la notificación** que el
  banner genérico de Google (`addMessage`) no controla. Se suscribe **en la pestaña**, sin
  instalar nada.
- **iOS:** Web Push existe como **beneficio secundario de instalar el portal**. Y en iOS la
  Push API **solo funciona con el sitio instalado como PWA en la pantalla de inicio** (iOS
  16.4+): el permiso (`Notification.requestPermission()`) y la creación de la
  `PushSubscription` **solo se pueden hacer dentro de la PWA standalone**, con un gesto del
  usuario — **nunca desde la pestaña de Safari**. Además iOS **no** permite disparar "Añadir
  a inicio" por código (no hay `beforeinstallprompt`): solo se puede **instruir** al usuario.

## Decisión

1. **Web Push se habilita en iOS y Android** (supersede el punto 2 del ADR 0038). El resto
   del ADR 0038 (dos transportes independientes, fan-out del transaccional, campañas eligen
   transporte, reutilizar la cola/cooldown de 0037) **sigue vigente**.

2. **En iOS el flujo vive en dos contextos:**
   - **(1) Landing de Safari** (tras escanear el QR y registrarse, spec 0028): muestra
     **cómo añadir Mi Pasaporte a la pantalla de inicio** (instrucciones inline: Compartir →
     Añadir a inicio → Añadir; **no** popup, no se puede automatizar). El texto vende el
     **valor del portal** (programas, cupones, QR), no solo notificaciones.
   - **(2) El ícono del home abre el micro-portal** (PWA standalone) — y **ese es el único
     lugar** donde iOS puede pedir permiso y crear la `PushSubscription`. Al abrirlo por
     primera vez, el portal ofrece el permiso; ahí también se ve el pase y se añade a Wallet.

3. **Escape hatch en iOS.** El pase de Apple **no necesita** la PWA para funcionar. Para no
   gatear el canal wallet (~90% open rate) detrás de la instalación, la landing de Safari
   ofrece un camino secundario **"solo dame mi pase de Wallet"** que muestra el botón de
   Apple Wallet ahí mismo. Quien instala tiene todo (portal + notificaciones + pase); quien
   no instala igual se lleva el pase — solo se pierde las notificaciones web (que en iOS ya
   cubre el pase). No se pierde ninguna alta de Wallet por forzar la instalación.

4. **El micro-portal es load-bearing y se construye ahora.** Es la página post-registro **ya
   existente** `apps/merchant/src/app/(consumer)/wallet` (QR + botones de Wallet + lista
   mínima de programas, spec 0029), a la que la 0037 le agrega **manifest + service worker**
   para hacerla **instalable** y capturar el permiso/suscripción al abrirse en standalone. El
   **contenido rico** del portal (dashboard "Ver mis programas") **sigue siendo la spec 0031**
   — la 0037 solo construye el mínimo instalable. Esto **elimina** la dependencia con 0031
   que tenía el borrador previo.

5. **El token del portal es el `web_view_token` existente** (`consumer_account`, spec 0029),
   accedido por el magic-link `/c/[webViewToken]`. Igual que el `qr_token`, **rota al
   recuperar la cuenta** (feature futura, spec 0032): `rotatePassCredentials`
   (`wallet/rotate.ts`) ya rota ambos y borra devices. La 0037 **extiende esa rotación para
   purgar también las `web_push_subscription`** del dispositivo viejo — así, recuperar la
   cuenta deja el ícono viejo muerto (404) y corta sus notificaciones (simetría con el borrado
   de devices; correcto de seguridad ante pérdida de dispositivo).

6. **Android sin cambios respecto del ADR 0038:** se suscribe en la pestaña (no requiere
   instalar); el "añadir a inicio" se puede ofrecer para engagement (`beforeinstallprompt`)
   pero no es requisito del push.

7. **Cripto sin dependencia (`node:crypto`).** El **VAPID JWT** (RFC 8292) es ES256 sobre
   P-256 — la misma familia que el JWT de APNs que la spec 0033 ya hace nativo, sin paquetes.
   El **cifrado del payload** (RFC 8291/8188 `aes128gcm`) se implementa con las primitivas de
   `node:crypto` (`createECDH`/`diffieHellman`, `hkdf`, `createCipheriv('aes-128-gcm')`) y se
   **verifica contra el vector de prueba trabajado del Apéndice A del RFC 8291** — ese vector
   es el oráculo externo que el CLAUDE.md exige para bendecir cripto DIY. Se evita así la
   dependencia `web-push` y su costo operativo recurrente (re-warm del store de pnpm bajo el
   sandbox de codex).

## Consecuencias

- **La spec 0037** cambia de alcance (título/scope: iOS + Android, no solo Android) y se
  reescribe: los dos contextos de iOS, el micro-portal instalable a partir de la página
  existente, el escape hatch, el purge de suscripciones en la rotación, y la cripto nativa
  con el vector del RFC. **Deja de depender de la spec 0031** para su mínimo instalable.
- **PWA:** se agregan `manifest` + `sw.js` en `apps/merchant/public` (hoy solo hay
  `wallet-logo.png`). El `start_url`/scope del portal encapsula el `web_view_token`; instalar
  con un token concreto significa que la rotación del token deja el ícono viejo inservible
  (deseado).
- **`rotatePassCredentials`** gana un paso: borrar las `web_push_subscription` del consumidor
  al rotar (lo consumirá la recuperación de 0032).
- **Secreto nuevo:** par de claves VAPID (`WEB_PUSH_VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` +
  subject `mailto:`), igual que en el ADR 0038.
- **Sin dependencia nueva:** no hay que re-warmear el store de pnpm por este trabajo.
- **iOS deja de ser una asimetría "pendiente":** queda cubierto por PWA + portal, con la
  motivación (valor del portal, no la notificación) documentada.
