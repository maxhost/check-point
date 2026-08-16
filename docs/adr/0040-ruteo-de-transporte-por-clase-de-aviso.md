---
fecha: 2026-08-16
resumen: El transporte de una notificación se decide por la CLASE del aviso, no por fan-out a todo lo que el consumidor tenga. El aviso **transaccional** (acreditación) sale SOLO por **wallet** (Apple/Google); si el consumidor no tiene un pase alcanzable, cae por **fallback a Web Push**. El **Web Push deja de ser transporte por defecto del transaccional** y pasa a ser transporte de **campaña** (el productor elige wallet/browser). Esto elimina las notificaciones duplicadas que el QA real halló en iOS (pase + Web Push a la vez) y simplifica el ruteo: no hay que inspeccionar plataforma ni PWA, la clase basta. Supersede el punto 3 (fan-out del transaccional) del ADR 0038; el resto del ADR 0038 sigue vigente.
estado: aceptada; supersede el ADR 0038 §3 (fan-out del transaccional); extiende el ADR 0037 (cola) y el ADR 0039 (iOS); habilita la spec 0038
---

# ADR 0040 — Ruteo de transporte por clase de aviso (transaccional = wallet, Web Push = campaña)

## Contexto

El ADR 0038 §3 decidió que **el aviso transaccional hace fan-out a todos los transportes que el
consumidor tenga**: "te dieron puntos" salía por el pase **y además** por Web Push si había
suscripción. El QA real (2026-08-16, iPhone + Android del owner) mostró la consecuencia no deseada:

- **iOS con pase en Wallet + PWA instalada** → llegan **dos** notificaciones por el mismo evento
  (la del pase de Apple **y** la de Web Push). Duplicado molesto.
- En **Android** el mismo evento dispara el banner genérico de Google **y** el Web Push rico a la
  vez.

La causa es estructural: el fan-out del transaccional no distingue a qué transporte mandar; manda a
todos. Para deduplicar "bien" haría falta inspeccionar, por consumidor, si tiene pase Apple, pase
Google, PWA instalada y en qué plataforma — lógica frágil y llena de casos borde (ver la matriz
descartada más abajo).

El owner pidió **simplificar el modelo**: que la **clase** del aviso decida el transporte.

## Decisión

1. **El transporte se decide por la `class` del aviso** (la columna ya existente en
   `wallet_push_queue`), no por fan-out a todo lo disponible:

   - **`transactional`** (acreditación: puntos, sellos, canje) → **wallet** (Apple APNs +
     Google `addMessage`). **No** se envía Web Push.
   - **`campaign`** (futuro, p. ej. cercanía al comercio) → transporte **a elección de la
     campaña** (wallet, browser, o ambos). El productor de campañas —que **no se construye
     acá**— es quien elige; hoy no hay filas `campaign` en circulación.

2. **Fallback del transaccional a Web Push.** Si el consumidor **no tiene un pase de wallet
   alcanzable**, el aviso transaccional cae por **Web Push**. "Alcanzable" =

   - Apple: existe un `wallet_push_device` (token APNs) de un `wallet_pass` provider=`apple`
     del consumidor, **o**
   - Google: existe un `wallet_pass` provider=`google` del consumidor.

   El fallback dispara **solo** cuando no hay wallet alcanzable → **nunca** coexiste con el
   transporte wallet → **nunca** hay duplicado. Y evita que un usuario que instaló la PWA / dio
   permiso pero **no** agregó el pase quede mudo.

3. **El Web Push deja de ser transporte por defecto del transaccional.** Sigue existiendo la
   maquinaria completa (canal, suscripciones, cifrado, VAPID de la spec 0037); cambia **cuándo**
   se usa: como **fallback** del transaccional y como transporte **de campaña**.

4. **La captura del permiso de Web Push se ofrece por plataforma en la confirmación del enroll**,
   porque es la única forma de que el fallback de Android sea real:

   - **iOS (Safari)**: instructivo "añadir a pantalla de inicio" (como hoy) — en iOS el Web Push
     exige PWA (ADR 0039) y de todos modos el pase de Apple cubre iOS con notificación rica.
   - **Android (y desktop)**: **botón de permiso de notificación** en el momento de la
     confirmación. En Android el Web Push funciona en la **pestaña normal** (sin instalar), así
     que el permiso se puede pedir ahí y deja creada la suscripción que el fallback usará.

5. **La dedup ya no mira plataforma ni PWA.** La `class` basta. Se descarta la matriz por
   plataforma (iOS 1-4 / Android 1-2) que se evaluó antes: era correcta pero mucho más compleja
   (había que cruzar presencia de device Apple × suscripción iOS × PWA), con casos borde
   multi-dispositivo. La regla por clase es equivalente para el caso de un teléfono por persona y
   drásticamente más simple.

6. **Se mantiene el cooldown por consumidor y por aviso** (ADR 0037/0038): una fila de cola = un
   aviso, ahora con **menos** transportes seleccionados. No cambia el worker ni la cola.

## Consecuencias

- **Android transaccional con pase de Google vuelve al banner genérico de Google.** Era la
  motivación original del Web Push en Android (contenido rico); se cambia por simplicidad y
  no-duplicado. El **contenido rico** en Android llega recién con las **campañas** (que eligen
  Web Push). Trade aceptado explícitamente por el owner.
- **Un usuario sin pase alcanzable recibe el transaccional por Web Push** (fallback), siempre que
  haya dado permiso — de ahí el botón de Android en la confirmación (punto 4).
- **La spec 0038** implementa: (a) el ruteo por clase en el fan-out del transaccional
  (`deliverTransports`) con la señal "wallet alcanzable"; (b) el opt-in de notificación por
  plataforma en la confirmación del enroll (reusa el `PushPrompt` existente). No hay migración ni
  secreto nuevo: `class` y las tablas ya existen.
- **El Web Push como transporte de campaña queda provisionado, no construido** (igual que la
  clase `campaign` en el ADR 0037): el productor de campañas lo consumirá.
- **iOS**: el pase de Apple sigue siendo el transporte del transaccional; el instructivo de
  instalación se mantiene para el portal/pase. Sin duplicado.
