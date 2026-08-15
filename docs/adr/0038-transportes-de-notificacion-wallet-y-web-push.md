---
fecha: 2026-08-15
resumen: Las notificaciones al consumidor tienen DOS transportes seleccionables e independientes — `wallet` (pase Apple/Google, spec 0033) y `webpush` (Web Push del navegador, spec 0037) — sobre un mismo modelo de aviso/cola (ADR 0037). Web Push arranca **solo Android** (en iOS el pase de Apple ya muestra notificaciones ricas y Web Push exige instalar PWA en pantalla de inicio); el aviso transaccional hace fan-out a los transportes que el consumidor tenga; las campañas futuras eligen transporte ("vía wallet" / "vía browser") porque sus tasas de conversión difieren.
estado: aceptada; extiende el ADR 0037 (cola de push) y el ADR 0033 (canal de Wallet); habilita la spec 0037
---

# ADR 0038 — Transportes de notificación: Wallet y Web Push (Android)

## Contexto

La spec 0033 entregó el push del **pase de Wallet** (Apple APNs + Google `addMessage`). El QA en
vivo del owner (2026-08-15, Android) reveló un límite del transporte de Google: `addMessage`
—aun con `messageType: TEXT_AND_NOTIFY`— muestra un **banner genérico** ("Mensaje nuevo / Presiona
para ver el pase"); el emisor **no controla el texto del banner** en Android, el aviso real queda
**dentro del pase**. En **iOS** el pase de Apple sí renderiza el `changeMessage` con el texto real
en la notificación → ahí no hay problema.

Es decir: en **Android** el pase notifica con poca información; en **iOS** notifica bien.

**Web Push** (Push API + Service Worker + VAPID) da **control total del contenido** de la
notificación en Android **desde un sitio web común, sin instalar app**. En **iOS** Web Push existe
desde 16.4 pero **solo si el sitio se agrega a la pantalla de inicio** (PWA) — fricción alta — y el
pase de Apple ya cubre iOS con notificaciones ricas, así que Web Push en iOS aporta poco hoy.

Tasas de conversión relevadas (2026-08-15, fuentes en la spec 0037): el **pase de Wallet** tiene
open rate **~90%** (el pase ya está guardado, sin inbox ni spam) pero contenido acotado en Android;
**Web Push** tiene opt-in **~5–6%** de visitantes (10–15% con buen prompt) y open rate **~34%
(promocional) / ~65% (automatizado)** con control total del contenido. Son **funnels distintos**.

## Decisión

1. **Dos transportes de notificación, independientes y seleccionables**, sobre el mismo modelo de
   aviso/cola de la ADR 0037:
   - **`wallet`** — el pase Apple/Google (spec 0033), ya implementado.
   - **`webpush`** — Web Push del navegador (spec 0037, nueva).
   No se mezclan: cada uno tiene su registro (dispositivos APNs / suscripciones Web Push), su
   materialización y su canal. La cola es el punto común.

2. **Web Push arranca solo Android.** El prompt de permiso y la suscripción se ofrecen **solo en
   user-agents Android**; iOS se cubre con el pase de Apple (notificación rica sin fricción). Es una
   decisión revisable: si más adelante se justifica la PWA en iOS, se habilita ahí también.

3. **El aviso transaccional hace fan-out a los transportes que el consumidor tenga.** "Te dieron
   puntos" sale **siempre por el pase** (como hoy) y **además por Web Push** si el consumidor está
   suscripto en Android. Esto es lo que finalmente muestra el texto rico ("Se acreditaron X puntos
   en tu cuenta 🎉") en la pantalla de Android.

4. **Las campañas (futuras) eligen transporte explícitamente** — "notificar vía wallet" o "vía
   browser" (o ambos) — porque las tasas de conversión difieren (alcance alto y contenido acotado del
   pase vs. alcance menor y contenido rico de Web Push). La 0037 **provisiona** la dimensión de
   transporte en el modelo; el **productor de campañas no se construye acá** (igual que la clase
   `campaign` en la ADR 0037).

5. **Se reutiliza la maquinaria de la ADR 0037** (outbox transaccional, prioridad, cooldown,
   worker). El cooldown es **por consumidor y por aviso**, no por transporte: un mismo aviso que sale
   por pase + Web Push cuenta como **uno** para el espaciado.

## Consecuencias

- **La spec 0037** implementa el transporte Web Push: claves **VAPID** (secreto nuevo), **service
  worker**, captura de suscripción (Android), tabla `web_push_subscription`, un `PushChannel`
  `webpush`, y el fan-out del transaccional. Un `404`/`410` del endpoint borra la suscripción (igual
  que el `410` de APNs en 0033).
- **El modelo de la cola gana una dimensión de transporte** (columna/enum), sin repintar el worker.
- **Secreto nuevo:** par de claves VAPID (`WEB_PUSH_VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` + subject).
  El cifrado de payload (RFC 8291/8188) probablemente justifique un paquete (`web-push`) — se decide
  en la spec 0037.
- **Anti-fuga:** las claves de suscripción (`p256dh`, `auth`) y el `endpoint` nunca se serializan en
  un DTO (patrón del proyecto).
- **iOS sin cambios:** sigue con el pase de Apple. La asimetría iOS/Android es intencional y está
  documentada.
