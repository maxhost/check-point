---
fecha: 2026-08-15
resumen: El push del pase de Wallet no se envía inline desde el request — se encola en una tabla `wallet_push_queue` escrita en la MISMA transacción que el evento que lo dispara (outbox transaccional), y la drena un worker; hay dos clases con prioridad, `transactional` (acreditación de 0030 — inmediata, preempta) y `campaign` (marketing futuro — diferida), con un cooldown mínimo por-consumidor entre dos avisos; el pase compartido lleva un único slot "Última novedad" y cada fila de la cola es su propia notificación (Apple: campo con `changeMessage` + APNs pull; Google: `addMessage`).
estado: aceptada; extiende el ADR 0033 (canal de push) y consume 0013 (proveedores intercambiables) / 0024 (secretos); habilita la spec 0033
---

# ADR 0037 — Cola de push de Wallet con prioridad transaccional > campaña y cooldown

## Contexto

El ADR 0033 fijó **un pase de identidad único y casi-estático** por consumidor y separó el
**canal de push a la spec 0033**. La 0029 ya dejó los ganchos (`webServiceURL` +
`authenticationToken`, registro `wallet_pass`). Falta decidir **cómo se materializa y se ordena
un aviso**, porque el pase es **compartido entre todos los programas** y tiene **un solo slot
visible** ("Última novedad" — ADR 0033 §3): no hay campos de progreso por-programa donde escribir.

Hechos del entorno relevantes:

- El otorgamiento (spec 0030) ya persiste **atómica e idempotentemente** en `persistGrant`
  (`counter/orders.ts`): un `INSERT order` + update de saldo en una transacción. Es el disparador
  natural del aviso "te dieron puntos/sellos".
- **Apple** no acepta un "push con texto": el APNs de PassKit es una **notificación vacía** que
  despierta al dispositivo para que **haga pull** del pase; iOS muestra el `changeMessage` del
  **campo que cambió** entre el pase cacheado y el nuevo. **Google** sí empuja texto directo
  (`addMessage`/`PATCH` sobre el Loyalty Object), sin registro de dispositivos.
- Escenario del owner (2026-08-14): Comercio A dispara una **campaña** (feature futura) y, en ese
  mismo momento, el cliente se acredita en Comercio B. El aviso **transaccional de B** —el cliente
  acaba de hacer el gesto físico— tiene que ser **inmediato y preemptar** la campaña de A; la de A
  sale **minutos después**, respetando un espaciado.
- Ya existe infra de **crons de Vercel** apuntando a `/api/internal/*` (loyalty-expiry,
  assets-cleanup); Vercel corre Node (APNs por HTTP/2 con `node:http2` es viable).

Enviar el push **inline** desde el request de acreditación sería frágil: acopla la latencia del
grant a la de APNs/Google, pierde el aviso si el proveedor falla, y no da forma de **ordenar ni
espaciar** cuando dos negocios notifican al mismo consumidor sobre un pase de un solo slot.

## Decisión

1. **Outbox transaccional, no push inline.** El aviso se **encola** insertando una fila en
   `consumer.wallet_push_queue` **dentro de la misma transacción** que el evento que lo dispara
   (para 0030: dentro de `persistGrant`). Invariante: un pedido acreditado ⇔ existe su fila de
   push; si el grant hace rollback, no hay aviso huérfano. La entrega es **at-least-once** con
   reintento (el worker es idempotente por fila).

2. **Dos clases con prioridad.** `class ∈ {transactional, campaign}`.
   - `transactional` (acreditación 0030; a futuro: canjes) → **alta prioridad, inmediata,
     preempta**, saltea el cooldown.
   - `campaign` (marketing/campañas — **la feature productora aún no existe**) → **baja
     prioridad, diferida**, respeta el cooldown.
   La clase `campaign` se **provisiona ahora** (enum + prioridad + cooldown ya diseñados) pero
   **no** se implementa su productor: cuando exista la feature de campañas, solo **inserta filas
   de baja prioridad** — sin repintar el motor.

3. **Cooldown por-consumidor.** Un tiempo mínimo configurable entre dos push al **mismo
   consumidor** (default del orden de algunos minutos, en constante de entorno). El
   `transactional` **lo saltea** (sale ya y **empuja** el `not_before` de cualquier `campaign`
   en cola a `ahora + cooldown`); el `campaign` solo sale cuando `ahora ≥ last_push_at +
   cooldown`. Orden de drenado por consumidor: primero `transactional` por antigüedad, luego
   `campaign` por `not_before`.

4. **Dispatch inmediato best-effort + cron como red de seguridad.** Tras commitear el grant, el
   request dispara un **envío best-effort no bloqueante** de la fila `transactional` (para que el
   aviso se sienta inmediato, sin esperar al cron). El **worker de cron**
   (`/api/internal/wallet-push`) **barre** lo pendiente: reintenta fallidas, envía las `campaign`
   cuando vencen su `not_before`, y cubre cualquier `transactional` que el dispatch inline no
   alcanzó. La durabilidad la da la cola, no el dispatch inline.

5. **Un solo slot "Última novedad"; cada fila es una notificación.** El pase compartido lleva un
   único campo "Última novedad" cuyo valor es el **último** aviso enviado; pero **cada fila de la
   cola es su propio evento de notificación** (un APNs pull / un `addMessage`), así dos negocios
   que notifican cerca en el tiempo **no se pisan el aviso** aunque el campo solo guarde el
   último snapshot. Materialización por proveedor: **Apple** — el worker actualiza el mensaje del
   consumidor y manda un APNs vacío a los dispositivos registrados; el pull trae el pase con el
   campo cambiado y su `changeMessage`. **Google** — `addMessage` directo sobre el objeto.

6. **La rotación del pase (pérdida de dispositivo / recuperación de cuenta) reusa este canal.**
   La 0033 provee el **mecanismo** de rotación (rotar `qr_token` + `web_view_token`, invalidar
   registros de dispositivo, re-empujar el pase); el **disparador** es la recuperación por OTP de
   la **spec 0032** (que lo invocará cuando se implemente).

## Consecuencias

- **La spec 0033** implementa este ADR: `wallet_push_queue` + worker con prioridad/cooldown, el
  enqueue outbox dentro de `persistGrant` (0030), el web service PassKit + APNs, el
  `addMessage`/`PATCH` de Google, el campo "Última novedad" en el pase Apple, y el mecanismo de
  rotación. Migración aditiva **0021**.
- **La spec 0030** recibe un **retoque acotado**: `persistGrant` encola la fila `transactional`
  en su transacción (no cambia su contrato público ni su idempotencia).
- **La spec 0031** (notificación + landing) consume el canal: el aviso de "te dieron un sello" ya
  sale por acá; su trabajo es la **superficie web rica**, no el transporte.
- **La spec 0032** (recuperación por OTP) invoca el mecanismo de rotación de la 0033.
- **La feature de campañas (futura)** solo produce filas `campaign`; hereda prioridad y cooldown
  sin tocar el worker.
- **Secreto nuevo (APNs):** auth key `.p8` de Apple + Key ID + Team ID (ADR 0024, base64 en
  entorno). Google no suma secretos (el mismo service account que emite ya puede `addMessage`).
  Sin paquetes nuevos: APNs = JWT ES256 (`node:crypto`) sobre HTTP/2 (`node:http2`).
- **`PushChannel` intercambiable** (misma filosofía que `WalletProvider`/`OtpChannel`): `apple`
  (APNs), `google` (addMessage) y `fake`/`console` para dev/test sin secretos — el worker y los
  tests corren sin pagar Apple.
