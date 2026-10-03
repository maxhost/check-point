# Notificaciones — donde estan los limites

Para quien vuelve en seis meses y no sabe donde mirar. Spec 0141 (ADR 0115 §5): los limites de notificaciones viven
en **un solo archivo**. Las rutas y los `archivo:linea` de este doc se verificaron contra el arbol al escribirlo
(2026-10-02); si una linea se corrio, buscá el nombre de la constante.

## 1. Que avisos hay y por donde salen

Cada aviso es una fila de `wallet_push_queue` con una clase:

- **`transactional`** — aviso de mostrador: acreditar, canjear un premio, canjear un cupon.
- **`campaign`** — la campaña de un comercio (hoy, Bienvenida y Venta cruzada; ADR 0115).
- **`reminder`** — el recordatorio del dia sin compra (spec 0111 D6).
- **`pass_refresh`** — silencioso: actualiza el pase, nunca suena.

Por donde salen (ADR 0115 §2, implementado en la spec 0139; la decision vive en `planTransports`,
`apps/merchant/src/server/wallet/push-transports.ts:199`):

| Clase | Con notificaciones de la PWA activas | Sin ellas |
|---|---|---|
| `campaign` | push de la PWA | solo dentro de la app, nunca Wallet |
| `transactional` | push de la PWA | solo dentro de la app (Actividad, ADR 0116) |
| `reminder` | Wallet; si no hay pase, push de la PWA | — |
| `pass_refresh` | actualiza el pase (Apple + Google, sin sonido) | — |

Un aviso que no tiene por donde sonar se cierra `suppressed`/`no_channel` y no gasta el presupuesto de 24 h
(ADR 0116).

## 2. Donde estan los limites

**`packages/domain/src/server/notifications/limits.ts`** — el UNICO lugar donde se cambia un limite. Sin logica,
solo constantes; los modulos que las aplican las importan y las re-exportan con el mismo nombre (asi ningun import
de afuera cambio). Desde `apps/*` se importa como `@mi-pasaporte/domain/server/notifications/limits`.

| Constante | Valor | Que limita | Lo lee |
|---|---|---|---|
| `COUNTER_NOTICES_PER_24H` (`limits.ts:33`) | `2` | avisos de mostrador con sonido por cliente en 24 h; los siguientes se acreditan en silencio | `decideBudget` (`apps/merchant/src/server/wallet/push-budget.ts:35`) |
| `NOTIFYING_PER_24H` (`limits.ts:40`) | `3` | avisos con sonido por cliente en 24 h, sumando `transactional` + `campaign` + `reminder`. Nacio del tope de Google Wallet; desde el ADR 0115 §5 se conserva por decision del owner | `decideBudget` |
| `BUDGET_WINDOW_MS` (`limits.ts:42`) | 24 h | la ventana movil del presupuesto | `decideBudget`, `loadBudget` (`apps/merchant/src/server/wallet/push-budget-store.ts:19`, el SQL en `:23`) |
| `COOLDOWN_MINUTES` (`limits.ts:47`) | env `WALLET_PUSH_COOLDOWN_MINUTES` o `3` | separacion minima entre dos avisos al mismo cliente (ADR 0037) | `apps/merchant/src/server/wallet/push.ts` |
| `COOLDOWN_MS` (`limits.ts:51`) | `COOLDOWN_MINUTES` en ms | idem, en ms; tambien es el backoff tras un intento fallido (`BACKOFF_MS`, `push.ts:39`) | `push.ts:195`, `apps/merchant/src/server/wallet/push-worker.ts:121` |
| `REMINDER_CUTOFF_MINUTE` (`limits.ts:56`) | 21:00 | ningun recordatorio a partir de las 21:00 locales | `decideReminder` (`packages/domain/src/server/wallet/reminder.ts:118`) |
| `REMINDER_EARLIEST_MINUTE` (`limits.ts:59`) | 9:00 | piso del horario del recordatorio | `reminderTargetMinute` (`reminder.ts:60`) |
| `REMINDER_LATEST_MINUTE` (`limits.ts:61`) | 20:30 (corte − 30) | techo del horario del recordatorio | `reminderTargetMinute` |
| `REMINDER_SPACING_MS` (`limits.ts:63`) | 20 h | como mucho un recordatorio por cliente en ese lapso | `decideReminder`, `packages/domain/src/server/wallet/reminder-store.ts:167` (SQL) |
| `WELCOME_MONTHLY_CAP` (`limits.ts:68`) | `{ min: 1, max: 10000, default: 50 }` | cupones reclamados por mes de la Bienvenida (el comercio elige dentro de min–max) | `TEMPLATES`, `packages/domain/src/server/marketing/templates.ts:140` |
| `CROSS_MONTHLY_CAP` (`limits.ts:70`) | `{ min: 1, max: 10000, default: 50 }` | idem, Venta cruzada | `CROSS_TEMPLATE`, `packages/domain/src/server/marketing/cross-rules.ts:64` |
| `VALLEY_MONTHLY_CAP` (`limits.ts:72`) | `{ min: 1, max: 10000, default: 50 }` | idem, Horas valle (apagada, spec 0138) | `VALLEY_TEMPLATE`, `packages/domain/src/server/marketing/valley-rules.ts:47` |
| `CROSS_LOTTERY_EPSILON` (`limits.ts:80`) | `0.2` | la parte de la loteria de la Venta cruzada que se sortea pareja entre las elegibles (owner, ADR 0117 §13: «20 % editable») | `DEFAULT_LOTTERY_LIMITS` (`packages/domain/src/server/marketing/cross-lottery.ts:59`); se registra en cada decision (`cross-sale.ts`) |
| `CROSS_LOTTERY_DECAY_METERS` (`limits.ts:82`) | `1000` | cercania `c = e^(−d/1000)`, d = metros al local mas cercano de B (spec 0143 §3) | `DEFAULT_LOTTERY_LIMITS` |
| `CROSS_LOTTERY_BEHIND_MIN` (`limits.ts:84`) | `0.5` | piso del factor de atraso `a = (1 + F)/(1 + R)` | `DEFAULT_LOTTERY_LIMITS` |
| `CROSS_LOTTERY_BEHIND_MAX` (`limits.ts:86`) | `2` | techo del factor de atraso | `DEFAULT_LOTTERY_LIMITS` |
| `CROSS_LOTTERY_NEW_CUSTOMER_BONUS` (`limits.ts:88`) | `1.5` | bono H4 al comercio sin clientes nuevos en su mes local | `DEFAULT_LOTTERY_LIMITS` |
| `CROSS_LOTTERY_POLICY` (`limits.ts:90`) | `"h4-v1"` | nombre de la politica, registrado en cada decision (`core.cross_decision.policy`) | `decideCrossSale` (`packages/domain/src/server/marketing/cross-sale.ts`) |
| `DEFAULT_PLACEMENT_LIMITS` (`limits.ts:110`) | turnos activos 5, cuota por comercio 50, separacion 400 m, holdout 10 %, cooldown 30 dias, 3 slots de utilidad, ventana 5 dias, 10 slots, texto 120 | la proximidad en el pase (spec 0065; apagada, spec 0138) | `planConsumerPlacement` (`packages/domain/src/server/marketing/placement-plan.ts:262`), `apps/merchant/src/server/marketing/tick.ts:208`, `audience-preview.ts:146`, `composer-summary.ts:19` |

## 3. Como cambiar uno

1. Editar el valor en `packages/domain/src/server/notifications/limits.ts`. En el servidor no hay que tocar nada mas.
   **Excepcion, en pantalla:** el texto de la proximidad en el backoffice repite a mano la cuota y el holdout
   («de 50 turnos simultáneos», «Un 10 % al azar», `apps/merchant/src/app/backoffice/marketing/custom-fields.tsx:188-189`).
   Si se cambian `businessQuota` u `holdoutRate`, ese texto hay que cambiarlo aparte (es UI, zona de GPT).
2. Actualizar su literal en **`apps/merchant/src/server/notifications/limits.test.ts`**. Si no se actualiza, ese test
   se pone rojo: es a proposito, para que ningun cambio de limite pase en silencio. (Vive en `apps/merchant` porque
   ningun proyecto de vitest corre tests bajo `packages/`.) El presupuesto de 24 h tambien lo fija
   `apps/merchant/src/server/wallet-push-budget.test.ts:35-37`.
3. Gates: `pnpm verify` con Node 24 (ADR 0113). Para el presupuesto y el recordatorio, ademas, las suites Neon
   `wallet-push-budget.neon.integration` y `wallet-reminder.neon.integration` con `tools/neon-test.sh <archivo>`
   (nunca contra `DATABASE_URL`).

`apps/merchant/src/server/notifications/limits-wiring.test.ts` prueba que cada lector LEE el modulo (lo mockea con
valores centinela); no hay que tocarlo para cambiar un valor.

## 4. Lo que NO esta en el modulo, y donde esta

- **El horario de campañas de cada comercio** (default 9 a 21): ya es por comercio y su default vive en la base,
  columnas `core.business.push_window_start_hour`/`push_window_end_hour` (`packages/db/src/schema/business.ts:87-88`).
  El comercio lo edita por `PATCH /api/marketing/settings` (`apps/merchant/src/app/api/marketing/settings/route.ts`);
  lo aplica `packages/domain/src/server/marketing/push-window.ts`. Moverlo al modulo exigiria una migracion.
- **Lo operativo de la cola**: `MAX_PUSH_ATTEMPTS`, `BACKOFF_MS`, `STALE_CLAIM_*` (`push.ts:35-52`).
- **Las reglas que DISPARAN el recordatorio** (no lo limitan): `DEFAULT_REMINDER_MINUTE`, `MIN_SCANS_FOR_HABIT`,
  `REMINDER_LEAD_MINUTES`, `SCAN_QUIET_MS`, `COUPON_EXPIRING_MS`, `INACTIVE_MS` (`reminder.ts:21-39`).
- **Largos de texto y topes del pase**: `MAX_NOTICE_BODY` (`packages/domain/src/server/wallet/push-text.ts:19`),
  `MAX_PASS_LOCATIONS` (`packages/domain/src/server/wallet/pass-locations.ts:16`).
- **El rate limit HTTP del pase**: `packages/domain/src/server/wallet/pass-rate-limit.ts`.

## 5bis. Quien drena la cola (ADR 0118)

El aviso de mostrador sale en el momento (inline, `after()`). Todo lo diferido —campañas detras de la separacion de
3 min, reintentos, el recordatorio del dia sin compra (se planifica dentro del worker) y el regalo misterio de la
Venta cruzada— sale cuando corre el worker `GET /api/internal/wallet-push`.

- **Lo llama cron-job.org** (cuenta del owner), modo «Personalizado»: minutos 0, 10, 20, 30, 40, 50; horas 7 a 17
  (ultima corrida 17:50); zona `America/Guayaquil`; email al desactivarse encendido.
- URL `https://business.checkpass.club/api/internal/wallet-push`, `GET`, header `Authorization: Bearer <CRON_SECRET>`
  (el mismo valor que la variable de Vercel; si se rota, cambia tambien en GitHub, que lo usan `marketing-tick.yml` y
  `catalog-import-reconcile.yml`).
- **Cambiar el horario:** en la pantalla del job, sin deploy. Hasta las 21:00 = sumar las horas 18, 19 y 20; 24 h =
  todas. Fuera de horario Neon duerme; cada hora de mas la mantiene despierta.
- **Consecuencias aceptadas (7 a 18):** lo diferido despues de las 17:50 sale a las 7:00; el recordatorio cuya hora
  objetivo cae despues de las 17:50 no sale.
- Si cron-job.org desactiva el job (mas de 25 fallos seguidos), la cola espera hasta reactivarlo a mano. Verificado el
  2026-10-03: «Run now» → HTTP 200, 7 recordatorios `sent` en la base.
- Antes lo llamaba `.github/workflows/wallet-push-cron.yml` (borrado): GitHub lo corria cada 2,4–7,8 h.

## 5. Limites por comercio

**No estan decididos** (ADR 0115 §5: «la idea es que cada comercio tenga su limite»; los valores por comercio no se
definieron). El modulo es la puerta: cuando se decidan, se cambia desde ahi. Hoy no hay funciones por comercio ni
columnas, a proposito.

## 6. Enlaces

- `docs/adr/0115-campanas-por-la-pwa.md` (§2 canales, §5 limites)
- `docs/adr/0116-avisos-de-mostrador-en-actividad.md`
- `docs/specs/0111-aviso-del-escaneo-y-recordatorio.md` (presupuesto de 24 h y recordatorio)
- `docs/specs/0139-canales-pwa-y-avisos-en-actividad.md` (canales)
- `docs/specs/0140-avisos-de-mostrador-en-actividad.md` (Actividad)
- `docs/specs/0141-limites-de-notificaciones-en-un-solo-lugar.md` (este modulo)
