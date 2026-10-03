---
adr: 0116
fecha: 2026-10-02
estado: aceptada
resumen: Cierra el «solo dentro de la app» del ADR 0115 §2. Los avisos de mostrador se listan en Actividad de my.checkpass.club, tengan o no notificaciones; los de campaña ya estaban (su cupon). Un aviso que no tiene por donde sonar se cierra `suppressed`/`no_channel` y no gasta el presupuesto de 24 h, y solo el recordatorio escribe la «Ultima novedad» del pase.
---

# 0116 — Los avisos de mostrador se ven en Actividad

## Contexto

El ADR 0115 §2 manda campañas (`campaign`) y avisos de mostrador (`transactional`) por push de la PWA y, sin
notificaciones, «solo dentro de la app». Medido el 2026-10-02 al abrir la spec 2 del 0115:

- La app tiene una seccion tipo inbox: **Actividad** («TUS NOVEDADES»,
  `apps/consumer/src/app/(consumer)/wallet/activity-view.tsx`). Se arma con los **cupones validos** y los
  **programas** del cliente; no lee la cola de avisos.
- Un cupon de campaña ya aparece ahi («Tenés un beneficio disponible»). Un aviso de mostrador («+1 sello»,
  «canjeaste X») **no**.
- `consumer.wallet_push_queue` guarda cada aviso con `title`, `body` y `created_at`; ninguna rutina la purga.

## Decision

### 1. Actividad lista los avisos de mostrador (owner)

Owner, 2026-10-02, ante «¿un aviso de mostrador sin notificaciones tiene que aparecer en Actividad?»: **«Sí, en
Actividad»** (despues de señalar textual «my.checkpass.club si tiene una seccion tipo "inbox" revisa el
codigo»). Aparecen **todos** los avisos `transactional` del cliente, **tengan o no notificaciones**: Actividad es
el historial, no el respaldo de un push fallido. El servidor los expone (contrato HTTP, ADR 0070); la pantalla es
de GPT (ADR 0114).

### 2. Un aviso sin canal no gasta el presupuesto (deriva de una decision ya tomada)

Un `transactional` o `campaign` de un cliente **sin suscripcion de Web Push** no tiene por donde sonar. Se cierra
`suppressed` con `last_error = 'no_channel'`, no `sent`. El presupuesto de 24 h cuenta **notificaciones** (spec 0111:
«el owner hablo de notificaciones, no de un canal»), y algo que no sono no es una; contarlo le quitaria lugar al
recordatorio por Wallet. Una campaña sin canal **igual emite su cupon** (ADR 0115 D1: «si las notificaciones no
estan activadas todavia recibe los beneficios»).

### 3. Solo el recordatorio escribe la «Ultima novedad» del pase

`latest_message` es lo que el pase muestra y lo que hace sonar a Apple en la proxima descarga (`changeMessage`,
documentado en `push-budget-store.ts`). Si `campaign` y `transactional` lo siguieran escribiendo, el siguiente
recordatorio por Wallet haria sonar el aviso de mostrador viejo: la Wallet se gastaria en eso, que es lo que el 0115
§2 prohibe. Desde ahora lo escribe **solo** `reminder`.

## Consecuencias

- El pase de Wallet deja de mostrar el ultimo aviso de mostrador; muestra el ultimo recordatorio.
- Lo implementa la **spec 0139** (spec 2 del ADR 0115), con el contrato de `GET /api/public/consumer/notices`.
- Los avisos de campaña en Actividad siguen viniendo por su cupon; no se listan de la cola (hoy ninguna campaña
  encendida encola `campaign`, spec 0138).
