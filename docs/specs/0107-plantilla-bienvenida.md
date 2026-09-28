---
spec: 0107
fecha: 2026-09-27
estado: borrador
resumen: Plantilla #1+#2 «Bienvenida» (`welcome`), implementa el ADR 0099. Cupon con premio estructurado a cada alta nueva al INSTALAR el pase (registro Apple, callback firmado de Google, alta con pase ya instalado, barrido en el tick); vale desde el dia siguiente (zona del negocio) o misma visita; vence 7/15/30 d con push de aviso 1/3/7 d antes; tope mensual por negocio; filtro Apple durable por negocio; oferta en la pagina de alta; estado `scheduled` en los cupones del cliente. Migracion `0052`. Contrato `specs/0107-contratos-de-api.md`.
disjunta: si
archivos: apps/merchant/drizzle/0052_*, apps/merchant/src/server/schema/{campaign,campaign-coupon,consumer}.ts + nuevo schema/welcome-device.ts, apps/merchant/src/server/marketing/{templates,template-input,template-store,reward-input,campaign-values,push-delivery,tick}.ts + nuevos welcome-*.ts, apps/merchant/src/server/wallet/ nuevo google-callback.ts, apps/merchant/src/server/consumer/{enrollment,coupons,coupon-status}.ts + nuevo enroll-landing.ts, rutas de passkit register, enroll y nueva google/callback, tools/google-wallet-callback.ts, docs/specs/0101-contratos-de-api.md, docs/specs/0107-contratos-de-api.md
---

# 0107 — Plantilla «Bienvenida»

> Implementa el **ADR 0099**. Las decisiones del owner estan textuales en `docs/TASKS.md` (bloque
> «WORKTREE motor»); lo marcado *(ORQUESTADOR)* es consecuencia tecnica elegida por el orquestador.
> Plantilla grande (`TEMPLATE.md`): tres dominios (marketing, wallet, consumidor) y migracion.

## Problema

El catalogo no tiene nada de bienvenida (ADR 0091). Un cliente que se da de alta no recibe ningun
motivo para volver, y es la campaña que mas pesa con bases chicas. El premio emitible ya existe
(spec 0106); falta la plantilla, el momento de entrega (pase instalado, que hoy el sistema no
distingue de pase generado: `wallet/core.ts:183`), la vigencia propia, el antiabuso y el anuncio.

## Alcance

**Entra (5 entregas, cada una desplegable):**
- **E1** Migracion `0052`, plantilla `welcome` en el catalogo, `enable`/`disable`, DTO `Campaign`.
- **E2** Entrega del regalo: registro Apple, alta con pase ya instalado, barrido en el tick; tope
  mensual; filtro Apple durable.
- **E3** Callback de Google (`save`) firmado + script que configura `callbackOptions` en la clase.
- **E4** Push de aviso de vencimiento.
- **E5** `welcomeOffer` en la landing del alta; estado `scheduled` en los cupones del cliente.

**No entra:**
- UI (ADR 0070): la pagina de alta, la tarjeta de la plantilla y la lista de cupones son de GPT,
  contra `specs/0107-contratos-de-api.md`.
- Resultados propios de la bienvenida (altas → segunda visita): los generales de cupon de la 0106
  alcanzan hasta que el owner pida otra cosa. Holdout (ADR 0099: sin holdout).
- Free vs premium (owner: «lo pensaremos luego»): sigue el gate `campaigns.enabled`.
- Aviso al cliente al RECIBIR el regalo (push o «Ultima novedad» del pase): nadie lo pidio.
- Migrar prod y configurar la clase de Google (orquestador, con OK del owner).

## Diseño

### Especificación técnica

#### 1. Migracion `0052_plantilla_bienvenida.sql` (via `drizzle-kit generate`)

`core.campaign` — columnas nuevas, todas nullable:

| Columna | Tipo | Regla |
|---|---|---|
| `welcome_valid_days` | integer | `in (7, 15, 30)` |
| `welcome_reminder_days` | integer | `in (1, 3, 7)` y `< welcome_valid_days` |
| `welcome_monthly_cap` | integer | `between 1 and 10000` *(ORQUESTADOR: el owner dijo «numero libre»; el rango es de plataforma)* |
| `welcome_redeem_from` | text | `in ('next_day', 'same_visit')` |

Checks de `core.campaign`:
- `core_campaign_template_key_check` suma `'welcome'`.
- `core_campaign_welcome_shape_check`: `(coalesce(template_key,'') = 'welcome') =` (las cuatro
  columnas no nulas), y con `welcome` ademas `coupon_label is not null` y `coupon_max_redemptions is
  null`. ⚠️ `coalesce` obligatorio (mismo motivo que `core_campaign_balance_shape_check`, `:192`).
- `core_campaign_channel_check` (`:106`) pasa a `(coalesce(template_key,'') = 'welcome') = (not
  channel_proximity and not channel_push)`: la bienvenida va SIN canal y el resto con al menos uno.
- `core_campaign_coupon_all_or_nothing_check` (`:143`): con `welcome`, `coupon_max_redemptions` es
  null y los otros dos no; sin `welcome`, igual que hoy.
- `core_campaign_coupon_needs_end_check` (`:162`): se exime `welcome` (su cupon vence por sus dias).

`core.campaign_coupon`:
- `welcome_membership_id uuid references consumer.program_membership` + **unique NO parcial**
  `core_campaign_coupon_welcome_unique` (un regalo por alta, para siempre; `on conflict
  (welcome_membership_id) do nothing` sin predicado, como `turn_id`/`push_id`).
- `core_campaign_coupon_single_origin_check` pasa a «a lo sumo uno de `turn_id`, `push_id`,
  `welcome_membership_id`».
- `reminder_queue_id uuid references consumer.wallet_push_queue` + unique, nullable: el push de
  aviso encolado (solo cupones de bienvenida: check `reminder_queue_id is null or
  welcome_membership_id is not null`).

`consumer.wallet_pass`: `google_saved_at timestamptz` nullable (solo Google; lo escribe el callback).

Tabla nueva `core.welcome_device` (`schema/welcome-device.ts`): `id`, `business_id` (fk, cascade),
`device_library_id text not null`, `coupon_id` (fk a `campaign_coupon`), `created_at`; **unique
`(business_id, device_library_id)`**. Es el filtro Apple durable: NO se borra al desregistrar.

Todas las filas de prod cumplen los checks nuevos (ninguna tiene `welcome`; las columnas nuevas nacen
null). Orden de prod: **migrar ANTES del deploy** (el codigo nuevo escribe `welcome`).

#### 2. Catalogo y `enable` (E1)

- `templates.ts`: `TemplateKey` suma `welcome`; `TemplateGroup` suma `welcome` (rango 1, sin
  convivencia: no decide pushes). Definicion nueva `welcome: {...} | null` en `TemplateDefinition`:
  `validDays {options [7,15,30], default 15}`, `reminderDays {options [1,3,7], default 3}`,
  `monthlyCap {min 1, max 10000, default 50}`, `redeemFrom {options ['next_day','same_visit'],
  default 'next_day'}`. `dormantDays` pasa a `... | null` (`welcome` = null). Plantilla `welcome`:
  «Bienvenida», `channels: []`, `couponRecommended: true`, `couponAllowed: true`, **`couponRequired:
  true`** (campo nuevo; el resto `false`), mensaje def. `"Sumate hoy y en tu próxima visita te llevás
  un regalo"` *(ORQUESTADOR, texto; es el titular de la oferta en la pagina de alta)*. Va PRIMERA en
  el catalogo.
- `template-input.ts` con `welcome`: `channels` presente → 400 `channels`; `dormantDays` presente →
  400 `dormantDays` (la columna guarda su default, ignorado); `excludedLocationIds` no vacio → 400
  `excludedLocationIds`; sin cupon → 400 `couponLabel`; `couponMaxRedemptions` presente → 400
  `couponMaxRedemptions`; `endsAt` opcional aun con cupon; `welcomeValidDays`,
  `welcomeReminderDays`, `welcomeMonthlyCap`, `welcomeRedeemFrom` validados contra la definicion
  (ausente → default); `welcomeReminderDays >= welcomeValidDays` → 400 `welcomeReminderDays`. En otra
  plantilla, cualquier `welcome*` presente → 400 con ese campo.
- `template-store.ts` escribe las cuatro columnas; `campaign-values.ts`/DTO `Campaign` exponen
  `welcome: { validDays, reminderDays, monthlyCap, redeemFrom } | null`.
- `disable` no cambia. Los cupones ya entregados siguen vivos hasta su `valid_until` (ADR 0094 §2).

#### 3. Entrega del regalo (E2) — `marketing/welcome-issue.ts` (nuevo)

`issueWelcomeGifts(consumerId, now, trigger?: { deviceLibraryId?: string })` en UNA transaccion, por
cada membresia del consumidor cuyo negocio tenga una campaña `welcome` **elegible**:
`status = 'active'`, `starts_at <= now`, `ends_at` null o `> now`, negocio `status = 'active'`,
`campaignsAllowedFor` verdadero (`marketing/plan-gate.ts:62`). Para cada una, en este orden:

1. `membership.created_at >= campaign.activated_at` (si no: no se entrega — «ya enrolados»).
2. **Pase instalado:** existe `wallet_push_device` de un `wallet_pass` Apple del consumidor, o su
   `wallet_pass` Google tiene `google_saved_at`. El `deviceLibraryId` del trigger cuenta aunque su
   fila todavia no sea visible.
3. **Filtro Apple:** ninguno de los `device_library_id` del consumidor (los registrados + el del
   trigger) esta en `core.welcome_device` para ESE negocio.
4. **Tope:** `select ... for update` de la fila de la campaña; se cuentan los cupones con
   `welcome_membership_id` no nulo del NEGOCIO (cualquier campaña `welcome` suya) cuyo `created_at`
   cae en el mes calendario ACTUAL en `core.business.timezone`; entrega sii `count < monthly_cap`.
5. Inserta el cupon con `rewardSnapshot` (`coupon-issue.ts:36`), `welcome_membership_id`,
   `valid_from` = `now` (`same_visit`) o el **inicio del dia local siguiente** en la zona del negocio
   (`next_day`), `valid_until` = `now + valid_days`; `on conflict (welcome_membership_id) do
   nothing`. Si inserto, registra cada `device_library_id` del consumidor en `welcome_device` (`on
   conflict do nothing`).

Disparadores (todos **best-effort**: un fallo se loguea con `console.error` y no cambia la respuesta):
- Registro Apple (`POST .../registrations/[passTypeId]/[serialNumber]`): despues de
  `registerDevice`, con el `deviceLibraryId`.
- Alta (`POST /api/public/enroll/[programId]`): despues de `enroll`, sin trigger (cubre al cliente
  que ya tenia el pase instalado por otro negocio).
- Callback de Google (E3).
- **Barrido del tick** (`tick.ts`, despues del paso 1b, dentro de la misma transaccion y el mismo
  lock): consumidores con una membresia elegible sin regalo y con pase instalado → `issueWelcomeGifts`.
  Recupera un disparador perdido. `TickSummary` suma `welcomeIssued`.

El mostrador no cambia: ya oculta el cupon hasta `valid_from` (`counter/coupon-scan.ts:72`) y
rechaza su canje fuera de vigencia con `coupon_not_active` (`counter/coupon-decision.ts:66`).

#### 4. Callback de Google (E3)

- `server/wallet/google-callback.ts` (nuevo): verificacion `ECv2SigningOnly` con `node:crypto`
  (sin dependencia nueva): claves raiz de `https://pay.google.com/gp/m/issuer/keys` (cache en memoria
  con su `keyExpiration`); verifica la firma de `intermediateSigningKey.signedKey` con una raiz sobre
  `len‖"GooglePayPasses"‖len‖"ECv2SigningOnly"‖len‖signedKey` y su expiracion; verifica `signature`
  con la intermedia sobre `len‖"GooglePayPasses"‖len‖<issuerId>‖len‖"ECv2SigningOnly"‖len‖
  signedMessage` (largos de 4 bytes little-endian; ECDSA P-256 SHA-256, firmas DER). La fuente de
  claves es inyectable para los tests.
- Ruta `POST /api/public/wallet/google/callback` (nueva, `runtime = "nodejs"`): firma invalida o
  cuerpo malformado → 401/400 sin escribir nada; `classId` distinto de `loyaltyClassId(issuer)` →
  200 sin efecto; `eventType = "save"` → `wallet_pass` Google con `serial_number` = `objectId` sin el
  prefijo `<issuer>.`; setea `google_saved_at` si es null y llama `issueWelcomeGifts`; `del` → 200
  sin efecto. Idempotente (el `nonce` no se guarda: todo efecto ya lo es).
- `tools/google-wallet-callback.ts`: PATCH de `callbackOptions.url` de la clase con la SA existente;
  idempotente; lo corre el orquestador con OK.

#### 5. Push de aviso (E4) — `marketing/welcome-reminder.ts` (nuevo)

- Paso del tick (despues del barrido): cupones con `welcome_membership_id`, sin canje, con
  `reminder_queue_id` null, `valid_from <= now < valid_until` y `now >= valid_until -
  reminder_days` (de su campaña), membresia sin `marketing_opt_out_at` → encola un `campaign` en
  `wallet_push_queue` (titulo = nombre del negocio; cuerpo *(ORQUESTADOR)* `"Tu regalo de
  bienvenida vence en {n} días"`, `n` = dias enteros que faltan, minimo 1) y guarda
  `reminder_queue_id`, en la misma transaccion. Un cupon, un aviso.
- Gate al entregar: `gateCampaignPush` (`push-delivery.ts`) hoy manda sin mas una fila `campaign` sin
  `campaign_push` (`:53`). Cambia: sin `campaign_push`, busca el cupon por `reminder_queue_id` y
  decide con `decideReminderGate` (pura): canjeado, vencido, sin membresia u opt-out → `cancel`; fuera
  del horario del negocio → `reschedule` (`nextSendableAt`); si no, `send` sin click id. Sin cupon
  detras → `send` (lo de hoy).

#### 6. Lectura para la UI (E5)

- `getEnrollLanding` se mueve a `server/consumer/enroll-landing.ts` (re-exportado por
  `enrollment.ts`, que esta en 303 lineas) y suma `welcomeOffer: { message, label, kind, rule,
  validDays, redeemFrom } | null` — `null` si no hay campaña `welcome` elegible (§3) o el tope del mes
  ya se alcanzo. Nunca expone costo, tope ni ids internos.
- Cupones del cliente (`consumer/coupons.ts`, `coupon-status.ts`): el grupo vigente incluye tambien
  los cupones sin canje con `valid_from > now`, con estado nuevo **`scheduled`** y campo nuevo
  `validFrom`. Precedencia: `redeemed` → `expired` → `unavailable` → `scheduled` → `valid`. Orden del
  grupo vigente: `valid`, `scheduled`, `unavailable`.

### Arquitectura de referencia

ADR 0091 (catalogo por flujo), 0092 (plantillas), 0093/0094 (cupon y vigencia), 0095 (canal push,
horario), 0037 (cola de push), 0098 (premio), **0099** (esta).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0052_plantilla_bienvenida.sql` + `meta/` | crear (generate) |
| `src/server/schema/campaign.ts`, `campaign-coupon.ts`, `consumer.ts` | editar |
| `src/server/schema/welcome-device.ts` (+ export del indice de schema) | crear |
| `src/server/marketing/templates.ts`, `template-input.ts`, `template-store.ts`, `reward-input.ts`, `campaign-values.ts`, `push-delivery.ts`, `tick.ts` | editar |
| `src/server/marketing/welcome-issue.ts`, `welcome-reminder.ts` (+ `*-store.ts` si pasan 300) | crear |
| `src/server/wallet/google-callback.ts` | crear |
| `src/app/api/public/wallet/google/callback/route.ts` | crear |
| `src/app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route.ts` | editar |
| `src/app/api/public/enroll/[programId]/route.ts` | editar |
| `src/server/consumer/enrollment.ts` (mover landing), `enroll-landing.ts` (crear), `coupons.ts`, `coupon-status.ts` | editar/crear |
| `tools/google-wallet-callback.ts` | crear |
| tests: `welcome-issue.test.ts`, `welcome-reminder.test.ts`, `google-callback.test.ts`, `coupon-status.test.ts`, `templates.test.ts`, `template-input.test.ts` + `marketing-welcome*.neon.integration.test.ts` | crear/editar |
| `docs/specs/0101-contratos-de-api.md` (§4.1/§4.2: remision a la 0107), `docs/specs/0107-contratos-de-api.md` | editar/crear |

(Rutas relativas a `apps/merchant/` salvo `docs/` y `tools/`. Todo archivo ≤ 300 lineas: `tick.ts`
esta en 254, `push-delivery.ts` en 245, `template-store.ts` en 288 → lo nuevo va en archivos nuevos.)

### Disjunta?

Si. GPT trabaja la UI en `main` (`app/**` de pantallas); esta spec no toca `.tsx`.

### Archivos compartidos

Ninguno.

## Definition of Done

- [ ] `0052` generada y aplicada en la rama de CI por `tools/neon-test.sh`; los checks nuevos
  rechazan `welcome` con canal, sin cupon, con `coupon_max_redemptions` o con recordatorio ≥ vigencia.
- [ ] `GET /api/marketing/templates` lista `welcome` primera con su bloque `welcome`; `enable` con
  cupon y `{}` crea la campaña con 15/3/50/`next_day`, sin canal y sin `ends_at`.
- [ ] Un alta nueva con pase Apple instalado recibe UN cupon; `valid_from` = inicio del dia local
  siguiente; el mostrador no lo muestra hoy y si mañana.
- [ ] Ya enrolado, tope alcanzado, iPhone ya premiado por ese negocio → sin cupon.
- [ ] Callback de Google firmado `save` → `google_saved_at` y cupon; firma invalida → 401 sin efecto.
- [ ] Tick a `valid_until − 3 d` encola UN aviso; canjeado antes del envio → `cancelled`.
- [ ] `welcomeOffer` en la landing; cupon `scheduled` con `validFrom` en la lista del cliente.
- [ ] Contrato `0107-contratos-de-api.md` escrito. Seis gates verdes (`test:e2e` comparado contra el
  rojo previo `loyalty-tour-help.spec.ts:40`) + los `.neon.integration` de marketing y consumer.

## Plan de pruebas y verificación

- [ ] **Unit** `welcome-issue.test.ts` (reglas puras extraidas: elegibilidad, inicio del dia local,
  mes local), `welcome-reminder.test.ts` (`decideReminderGate`, momento del aviso),
  `google-callback.test.ts` (claves generadas en el test: raiz → intermedia → mensaje; firma alterada,
  intermedia vencida, recipient ajeno → rechazo), `coupon-status.test.ts` (precedencia con `scheduled`),
  `template-input.test.ts` (los 400 de §2).
- [ ] **Integracion** `marketing-welcome*.neon.integration.test.ts`: negocio con `timezone`
  `America/Guayaquil`, programa, plantilla encendida; los casos de M1–M13 con asserts por SQL; doble
  disparador (registro + tick) → un solo cupon.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`;
  `pnpm run build`; `pnpm test:e2e`; `tools/neon-test.sh` con los archivos nuevos + `marketing-templates*`,
  `marketing-tick`, `marketing-push*`, consumer coupons y counter coupon.
- [ ] **QA del owner** (al final): encender la Bienvenida en un negocio de prueba; abrir
  `/enroll/[programId]` y ver la oferta; alta con iPhone; instalar el pase; ver el regalo «desde
  mañana» en la cuenta; escanear hoy (no aparece) y mañana (aparece y se canjea). Lo mismo con Android.

### Mutaciones (presupuesto: 13; clase: errores PLAUSIBLES de vigencia, antiabuso y cableado)

Todo mecanismo NUEVO salvo los existentes citados en §1–§6 (verificados en el arbol el 2026-09-27:
`push-delivery.ts:53`, `coupon-scan.ts:72`, `coupon-decision.ts:66`, `consumer/coupons.ts:115`,
`schema/campaign.ts:106,143,162`). Cada ejemplo DISTINGUE la regla de la mutada (calculado a mano).
Protocolo: skill `protocolo-de-verificacion`.

| # | Mecanismo | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | dia siguiente en la zona del negocio | inicio del dia siguiente en UTC | integracion: entrega el 2026-10-01 21:00 local (02:00Z del 02) → `valid_from` = 2026-10-02 05:00Z (mutada: 2026-10-03 00:00Z); escaneo del 02 a las 10:00 local lo muestra |
| M2 | solo altas nuevas | quitar `created_at >= activated_at` | integracion: alta antes de encender, instalacion despues → sin cupon |
| M3 | tope estricto | `<` → `<=` | integracion: tope 1; dos altas instaladas → un solo cupon |
| M4 | mes en la zona del negocio | mes en UTC | integracion: tope 1; cupon 2026-09-30 21:00 local (01-10 02:00Z); alta 2026-10-01 10:00 local → recibe |
| M5 | filtro Apple durable | quitar el paso 3 | integracion: iPhone D premiado con A, A borra el pase (DELETE del registro), B se registra con D → sin cupon |
| M6 | filtro Apple por negocio | el filtro ignora `business_id` | integracion: D premiado en X; B se da de alta en Y y registra D → recibe |
| M7 | cableado del registro Apple | borrar la llamada en la ruta | integracion: POST de registro (sin tick) → cupon |
| M8 | cableado del callback Google | borrar la llamada en la ruta | integracion: `save` firmado con la fuente de claves del test → cupon |
| M9 | verificacion de firma | aceptar sin verificar la firma del mensaje | unit + ruta: mensaje firmado con otra intermedia → 401, `google_saved_at` null |
| M10 | regla del gate del aviso | ignorar el canje | unit: `decideReminderGate` con cupon canjeado → `cancel` |
| M11 | cableado del gate | dejar `if (!facts) return send` sin buscar el cupon | integracion: aviso encolado, cupon canjeado, `gateCampaignPush` → fila `cancelled` |
| M12 | momento del aviso | `valid_from + reminder_days` en vez de `valid_until − reminder_days` | integracion: 15 d / 3 d; tick a entrega + 5 d → sin aviso |
| M13 | cupon visible antes de valer | quitar `scheduled` del grupo vigente | integracion: dia de la entrega, `GET /api/public/consumer/coupons` lista el cupon `scheduled` con `validFrom` |

**Declarado fuera:** el formato REAL de la firma de Google (los tests firman con claves propias; se
prueba en el QA con un Android); el registro real de Apple (QA con iPhone); la concurrencia del tope
con dos transacciones simultaneas (el `for update` se revisa en lectura, sin carrera ejecutada); el
texto del push en pantallas de iOS/Android.

## Handoff requerido

Un implementador para toda la spec y un revisor independiente al final (`docs/AGENT-WORKFLOW.md`, ADR
0071). Entregas desplegables E1→E5; cada deploy con migracion pide OK del owner (la `0052` va en E1,
antes del deploy). La configuracion de `callbackOptions` (E3) se corre con OK, despues del deploy de E3.

## Abierto

Nada bloqueante: todas las decisiones de producto estan en el ADR 0099. **Falta el OK del owner a esta
spec** para pasarla a `cerrada`.
