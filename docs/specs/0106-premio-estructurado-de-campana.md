---
spec: 0106
fecha: 2026-09-27
estado: implementada
resumen: Implementa el ADR 0098 en CUATRO ENTREGAS independientes, cada una desplegable y con su contrato para la UI — E1 premio con tipo en campañas y plantillas (+ migracion 0049 y snapshot al cupon), E2 mostrador (scan con tipo/regla, canje que acredita sellos/puntos extra), E3 cupones del cliente con su regla, E4 resultados por premio. Contrato HTTP en `specs/0106-contratos-de-api.md`.
disjunta: no
archivos: apps/merchant/drizzle, apps/merchant/src/server/{schema,marketing,counter,consumer}, apps/merchant/src/app/api/{marketing,counter,public/consumer}, docs/specs/0101-contratos-de-api.md
---

# 0106 — Premio estructurado de campaña

## Problema

El premio de una campaña es texto (`coupon_label` 1..40 + costo + tope, `schema/campaign.ts:66-69`).
No se puede comparar entre campañas por premio, un descuento no tiene su valor como dato, no existen
sellos/puntos extra y el cajero y el cliente no ven condiciones. El ADR 0098 decidio premio con TIPO,
sin catalogo propio. Ademas, **medido:** `couponProductId` solo se valida como uuid
(`marketing/campaign-input.ts:142-146`) y la FK acepta productos de cualquier negocio
(`schema/campaign.ts:69`): hoy es inocuo porque es informativo; con esta spec seria una fuga.

## Forma de trabajo (pedido del owner, 2026-09-27)

**Cuatro entregas, en orden, cada una commit + push propio**, para que GPT haga la UI de cada una
contra el contrato mientras sigue la siguiente. **Un implementador para las cuatro y un revisor al
final** (ADR 0071). **Presupuesto de pruebas acotado:** solo lo que protege plata, saldo y
aislamiento; el resto se declara. Nada de retroactivos: la migracion no mide prod ni convierte datos
salvo el `UPDATE` minimo para que los checks nuevos entren.

## Alcance

**Entra:** E1–E4 descritas abajo, la migracion `0049` y el contrato `specs/0106-contratos-de-api.md`
(+ una linea en `0101` §2/§3.2/§4.2 que lo enlaza).

**No entra:**
- UI de cualquier tipo (ADR 0070: la hace GPT). **Tampoco se tocan** `app/backoffice/marketing/**`
  ni `app/backoffice/counter/**`: GPT los esta reescribiendo en `main`.
- Cashback extra (PARQUEADO #61). Catalogo de premios (ADR 0098 §1).
- Componer el texto visible en el servidor: lo compone la UI (sabe el idioma); la API lo exige.
- Chequear el tipo de programa al EMITIR un cupon de extras: se emite y el canje lo rechaza si el
  programa cambio (ADR 0098 §6). Consecuencia declarada, no hallazgo.
- Los snapshots de `campaign_turn` (`coupon_label_snapshot`/`coupon_cost_snapshot`,
  `schema/campaign-turn.ts:80-84`): siguen como estan; el turno mide proximidad, no premios.
- El gate de email verificado de `api/marketing` (PARQUEADO #56): sigue parqueado.

## Diseño

### Modelo de datos — migracion `apps/merchant/drizzle/0049_premio_estructurado.sql`

**`core.campaign`** (columnas nuevas, todas nullable):

| Columna | Tipo | Regla |
|---|---|---|
| `coupon_kind` | text | `in ('free_product','two_for_one','discount','extra_stamps','extra_points')` |
| `coupon_discount_unit` | text | `in ('percent','amount')` |
| `coupon_discount_value` | numeric(12,2) | `percent`: entero 1..100; `amount`: > 0 |
| `coupon_extra_units` | integer | 1..1000 |
| `coupon_rule` | text | trim, 1..2000 (techo tecnico, no de UX) |

Checks nuevos: (a) `coupon_kind` null ⇔ `coupon_label` null (se suma al todo-o-nada existente);
(b) `discount` ⇔ unit y value no nulos, y ningun otro tipo los lleva; (c) `extra_*` ⇔
`coupon_extra_units` no nulo; (d) `coupon_product_id` solo con `free_product`/`two_for_one`;
(e) `coupon_rule` null si no hay cupon. `coupon_label` sigue 1..40 (va al push:
`marketing/push-text.ts:8-10`).

**`core.campaign_coupon`** (snapshot, ADR 0098 §8): `kind_snapshot` (NOT NULL tras backfill),
`product_id` (FK `products`, `on delete set null`), `discount_unit_snapshot`,
`discount_value_snapshot`, `currency_code_snapshot` (NOT NULL si unit `amount`, del
`business.currency_code` al emitir), `extra_units_snapshot`, `rule_snapshot`. Mismos checks de forma
que la campaña.

**`core.coupon_redemption`**: `kind_snapshot` (NOT NULL tras backfill), `product_id` (FK set null),
`units_granted` y `balance_after` (integer, no nulos ⇔ `kind_snapshot in ('extra_stamps','extra_points')`).

**Backfill minimo** (sin medir, es idempotente): `update … set coupon_kind/kind_snapshot =
'free_product' where` label no nulo / siempre, en las tres tablas, antes de los `SET NOT NULL` y checks.

### E1 — Premio con tipo en campañas y plantillas

- `parseCoupon` (`marketing/campaign-input.ts:103-155`) pasa a validar el premio como UNA decision:
  lo actual + `couponKind`, `couponDiscountUnit`, `couponDiscountValue`, `couponExtraUnits`,
  `couponRule`, con las reglas de la tabla. **`couponKind` ausente con cupon → `free_product`**
  (compatibilidad: la UI vieja manda solo el trio y no se toca). Errores 400 `validation` por campo,
  mismo formato de hoy. El PATCH reemplaza el premio entero si nombra cualquier clave del premio
  (hoy lo hace con 4 claves, `campaign-input.ts:257-275`: se amplia la lista).
- **Aislamiento (nuevo):** en `createCampaign`, `updateCampaign` (`marketing/campaign-store.ts`) y
  `enableTemplate` (`marketing/template-store.ts:127-224`), un `couponProductId` que no es un
  producto del negocio → 400 `validation` en `couponProductId`, mismo mensaje que un id invalido
  (no revela si existe en otro negocio).
- **Extras vs programa:** `extra_stamps` exige programa operativo de `kind='stamps'`,
  `extra_points` de `kind='points'` (mismo criterio que `accreditableProgram`,
  `counter/resolve.ts:28-60`); si no → 400 `validation` en `couponKind`.
- `couponRefused` (`marketing/balance-input.ts:99-110`) rechaza tambien las claves nuevas y
  `couponProductId` en #7/#8.
- **DTO `Campaign`** (`campaign-store.ts:52-55`, `:78-81`) suma los 5 campos; el `Campaign` de
  `GET /templates` (`live`) hereda. `GET /api/marketing/campaigns*` y `/templates` suman
  `currencyCode` del negocio a nivel respuesta (hoy ningun DTO de marketing lo devuelve).
- **Emision:** los dos emisores copian el premio entero: proximidad (`marketing/placement.ts:79-87`,
  valores de `placement-store.ts:145-146,171-172`) y push (`marketing/push-delivery.ts:169-201`, SQL
  crudo: sumar columnas al `returning` y al `insert`). `couponToIssue`/`pushCouponToIssue`
  (`marketing/coupon-issue.ts`) devuelven el snapshot completo.
- Resultados: `results.coupon` (`marketing/results.ts:80-86`) suma `kind`.

### E2 — Mostrador

- **Scan:** `loadActiveCoupon` (`counter/coupon-store.ts:45-78`) y el DTO `ActiveCoupon` (`:22-27`)
  suman `kind`, `rule`, `discountUnit`, `discountValue`, `currencyCode`, `extraUnits`. Siguen sin id
  de consumidor/membresia ni costo.
- **Canje:** en `persistCouponRedemption` (`:150-284`), dentro de la MISMA transaccion y despues de
  `decideCouponRedemption` (`:227-234`), si el cupon es `extra_*`:
  1. lee con `FOR UPDATE` la membresia del cupon y su programa;
  2. si el programa no esta `active`/`closing`, o su `kind` no es la unidad del cupon, o la membresia
     no es de ese programa → **409 `program_changed`**, sin escribir nada (cupon sigue sin usar);
  3. suma `extra_units_snapshot` a `stamps_count` o `points_balance` y guarda `units_granted` y
     `balance_after` en la `coupon_redemption`.
  **No crea `core."order"`** (no es visita, ADR 0098 §6). La idempotencia existente (unicos
  `coupon_id` y `(business_id, client_request_id)`, `23505` → reread, `counter/coupon.ts:67-85`)
  cubre el saldo: si el insert aborta, la suma se revierte con la transaccion.
- Respuesta de `POST /api/counter/coupon-redeem` (`counter/coupon.ts:32-39`) suma `kind`,
  `unitsGranted`, `balanceAfter` (null si no es extra). En un reread idempotente se devuelven los
  guardados.
- Push de recibo: sigue `buildCouponBody(label)` (`wallet/push-text.ts:62-64`); la actualizacion del
  pase con el saldo nuevo va por el mismo push transaccional que ya se encola (`coupon-store.ts:266-280`).

### E3 — Cupones del cliente

`GET /api/public/consumer/coupons` con la sesion de consumidor (`consumer/session.ts:37`, cookie
`consumer_session`). Devuelve los cupones de ESE consumidor con el mismo predicado que el scan
(vigentes y sin canje), de todos sus negocios: `id`, `businessId`, `businessName`, `label`, `kind`,
`rule`, `discountUnit`, `discountValue`, `currencyCode`, `extraUnits`, `validUntil`. **No** devuelve
nombre de campaña (es interno del comercio), costo, ni ids de membresia. Sin sesion → `401 unauthenticated` (como `public/consumer/marketing-opt-out`).

### E3b — Cupones no validos (ajuste, decision del owner 2026-09-27)

Un comercio suspendido NO oculta los cupones: la lista del cliente suma `status`, `reason` y
`redeemedAt` e incluye los canjeados, vencidos y no disponibles, con la precedencia, el historial
(90 dias / 50) y el orden del contrato §E3. Estado calculado con `core.business.status`
(`schema/business.ts:108-109`: `active`/`suspended`/`closed`) y la existencia de `coupon_redemption`.
El mostrador ya rechaza a un comercio no activo (`server/api-owner.ts:37`, `counter/core.ts:68`): esto
solo lo hace visible al cliente. Mutacion **M5b**: invertir la precedencia de `unavailable` sobre
`valid` (un cupon de comercio suspendido sale `valid`) → rojo en la integracion.

### E4 — Resultados por premio

`GET /api/marketing/rewards/results?from=YYYY-MM-DD&to=YYYY-MM-DD` (guard de marketing existente,
`requireMarketingOwner`), en la zona horaria del negocio, rango maximo 366 dias (400 `validation`).
Agrupa `coupon_redemption` del negocio por `kind_snapshot` + `product_id`: `redeemed`,
`incurredCost` (suma de `cost_snapshot`), `unitsGranted` (suma, solo extras), `label` = nombre
actual del producto o, sin producto, el `label_snapshot` mas reciente del grupo. Mas `currencyCode`.
Calidad del dato `estimado_configurado`, como `results.coupon`.

### Arquitectura de referencia

ADR 0098 (esta decision), 0093/0094 (cupon y vigencia), 0070 (API sin UI), 0064/0065 (motor), 0071.

## Archivos

| Archivo | Entrega | Accion |
|---|---|---|
| `apps/merchant/drizzle/0049_premio_estructurado.sql` + `meta/` | E1 | crear |
| `src/server/schema/{campaign,campaign-coupon,campaign-turn}.ts` | E1 | editar |
| `src/server/marketing/{campaign-input,campaign-store,template-input,template-store,balance-input,coupon-issue,placement,placement-store,push-delivery,results,results-store}.ts` | E1/E4 | editar |
| `src/app/api/marketing/campaigns/**`, `templates/**` | E1 | editar (currencyCode) |
| `src/server/counter/{coupon-store,coupon,coupon-decision}.ts` | E2 | editar |
| `src/app/api/public/consumer/coupons/route.ts` + `src/server/consumer/coupons.ts` | E3 | crear |
| `src/app/api/marketing/rewards/results/route.ts` | E4 | crear |
| tests y `*-support.ts` que siembran cupones (lista en «Plan de pruebas») | todas | editar |
| `docs/specs/0106-contratos-de-api.md` | — | ya creado (orquestador) |
| `docs/specs/0101-contratos-de-api.md` | E1 | una linea de enlace en §2, §3.2, §4.2 |

(rutas `src/…` relativas a `apps/merchant/`)

### Disjunta?

**No** con la UI de marketing y mostrador de GPT (consume este contrato) — por eso esta spec **no
toca** `app/backoffice/**`. Con specs de motor abiertas: ninguna en curso.

### Archivos compartidos

| Que | Quien | Cuando |
|---|---|---|
| `specs/0106-contratos-de-api.md` | orquestador | antes de despachar (hecho) |

## Definition of Done

Por entrega: gates verdes local, commit y push. Al final: PASS del revisor.

- [ ] **E1** — campaña y plantilla aceptan y devuelven los 5 tipos con sus campos; sin `couponKind`
      el trio viejo sigue funcionando como `free_product`; producto de otro negocio → 400; extras
      contra el programa equivocado → 400; ambos emisores copian el premio entero al cupon;
      `currencyCode` en las respuestas. Migracion `0049` aplicada a prod **con OK del owner**.
- [ ] **E2** — el scan devuelve tipo, regla y valores; canjear `extra_*` suma una sola vez al saldo
      correcto, no crea `order`, devuelve `unitsGranted`/`balanceAfter`; programa cambiado → 409
      `program_changed` y el cupon sigue canjeable si el programa vuelve a coincidir.
- [ ] **E3** — un consumidor ve solo sus cupones vigentes sin canje, con regla; nunca los de otro.
- [ ] **E4** — agregado por tipo+producto solo del negocio del owner.
- [ ] Contrato `0106` coincide con lo implementado (el revisor lo contrasta campo a campo).

## Plan de pruebas y verificación

**Presupuesto: 6 mutaciones, una por invariante de plata/saldo/aislamiento. Condicion de corte:
cada una la caza un test existente o nuevo por el motivo correcto; si dos vueltas seguidas del
revisor terminan en «el fix abrio otra», se corta y se declara.** Clase de error a cazar: los
plausibles (olvidar un filtro, sumar fuera de la transaccion, no copiar un campo).

| # | Mutacion (etiqueta `MUTATION`) | Donde | Lo caza |
|---|---|---|---|
| M1 | quitar el chequeo de negocio de `couponProductId` | helper nuevo de E1 llamado desde `campaign-store.ts`/`template-store.ts` | integracion: producto de otro negocio → 400 |
| M2 | no copiar `kind`/`rule` en el emisor push | `marketing/push-delivery.ts` (insert de `campaign_coupon`) | integracion `marketing-push-delivery`: cupon emitido trae tipo y regla |
| M3 | quitar la comparacion de `kind` programa↔cupon | `counter/coupon-store.ts` (paso 2 de E2) | integracion: programa de puntos + cupon de sellos → 409 y saldo intacto |
| M4 | sumar el saldo en otra transaccion/antes del lock | `counter/coupon-store.ts` | integracion `counter-coupon-races`: dos canjes concurrentes → una sola suma |
| M5 | quitar el filtro por consumidor | `server/consumer/coupons.ts` | integracion: el consumidor B no ve el cupon de A |
| M6 | quitar el filtro por negocio | agregado de E4 | integracion: canjes de otro negocio no suman |

Ademas, unit table-driven en `campaign-input.test.ts` (un caso valido e invalido por tipo, y el
default `free_product`). **Declarado fuera:** validacion exhaustiva de combinaciones de checks de la
base (los cubre el propio `CHECK`), textos de push, UI.

Suites a tocar/correr: unit de `marketing/` y `counter/`; `.neon.integration`: `counter-coupon`,
`counter-coupon-races`, `counter-coupon-validity`, `marketing-coupon-issue`,
`marketing-push-delivery`, `marketing-templates`, `marketing-results` + las nuevas de E3/E4, via
`tools/neon-test.sh <archivo>`. Soportes que siembran cupones: `marketing-integration-support.ts`,
`marketing-push-support.ts`, `marketing-coupon-support.ts`, `counter-coupon-support.ts`,
`marketing-results-support.ts`.

Comandos (Node 24, root): `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`,
`pnpm run format:check`, `pnpm run build`. **`test:e2e` no aplica** (no se toca UI ni CSS).

**QA del owner (al final, con la UI de GPT):** activar «Te extrañamos» con «2x1 en Café» + regla
«solo medianos»; recibir el cupon; verlo con la regla en la cuenta; escanear y ver tipo y regla;
repetir con «3 sellos extra» y ver el saldo subir en el pase sin sumar visita.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. El implementador deja en el handoff, por entrega, el sha del
commit. Solo un PASS del revisor marca la spec `implementada`.

## Abierto

Nada bloqueante.
