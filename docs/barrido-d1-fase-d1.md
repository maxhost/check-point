# Barrido sistematico de afirmaciones — spec 0063, fase D1 (revisor)

Metodo: por cada docblock que AFIRMA un invariante, una mutacion que lo falsifica, ejecutada
contra los 7 archivos que pueden verla (`billing-routes`, `billing.neon`, `billing-interval`,
`billing-routes-auth`, `locations-races`, `billing-cancel-guards`, `billing-checkout-guards`;
+`billing-store` cuando la mutacion toca `store.ts`). Driver: `/tmp/mutate.py` + `/tmp/sweep.sh`.
Backups limpios en `/tmp/rev3/` (y `/tmp/mut-backup-cancel.ts`). Baseline: 39 tests en los 7.

## Rondas anteriores (afirmaciones ya mutadas, todas ROJAS salvo donde se dice)

| # | Afirmacion | Donde | Mutacion | Resultado |
|---|---|---|---|---|
| A1 | «actua sobre el negocio del CALLER, nunca uno nombrado en el request» | `_auth.ts` | MUT-E: el body gana | ROJO 5 — `expected '2222…' to be '1111…'`, las 5 rutas |
| A2 | el gate reusa `ownerContext`, que filtra `status='active'` | `_auth.ts` | MUT-F: sacar el filtro | ROJO 1 / **suite completa** — `checkout: expected 409 to be 403` (owner DESACTIVADO). Unico rojo en 117 archivos |
| A3 | `readBody` tolera la ausencia de body | `_auth.ts` | MUT-B: sacar el try/catch | ROJO 1 — `expected 503 to be 400` |
| A4 | el orden de `cancel`: escribir la intencion ANTES de Stripe | `cancel` | M5 | ROJO 2 — `expected 'fulfilled' to be 'rejected'` + `expected null to be 'free'` |
| A5 | el revert corre SOLO si esta peticion creo el estado | `cancel` | MUT-A (B1) | ROJO 1 — `expected null to be 'free'` |
| A6 | `settle-free` es el alias de `cancel`; decide la FILA, no la URL | `settle-free` | MUT-D (B2) | ROJO 1 — `expected [] to include 'subscriptions.update:sub_vivo…'` |
| A7 | la `idempotencyKey` del Checkout es FIJA | `checkout` | MUT-K (B3) | ROJO 1 — `- "checkout:<id>:month"` / `+ "…:month:1789152462334"` |
| A8 | la clave de `customers.create` es fija por negocio | `checkout` | MUT-G | ROJO 1 — `expected [ undefined ] to deeply equal [ 'billing:customer:<uuid>' ]` |
| A9 | `resume` limpia `cancel_at`, no solo `cancel_at_period_end` | `resume` | MUT-J (B4) | VERDE 38/38 en la 4a ronda → **cerrado por el delta**; a re-verificar |
| A10 | `has_more` → `interval_ambiguous` | `interval` | MUT-I | VERDE en la 4a ronda → **cerrado por el delta**; a re-verificar |
| A11 | el fake tiene UNA canasta de claves por superficie | fake | MUT-L: re-mezclar | ROJO 1 — `expected [] to deeply equal […(2)]`; el lector de `updateKeys` NO se inmuta |
| A12 | el gate viejo (membresia por el body) ya no existe | `checkout` | M6 | ROJO 8 / 3 archivos; **5 por el motivo equivocado**, el oraculo real son los 3 de `-auth` |

## Barrido nuevo (S1–S18)

| # | Afirmacion (docblock) | Mutacion | Resultado |
|---|---|---|---|
| S1 | `_auth.ts:186` `decideUnderLock`: «el conteo que alimenta `downgrade_blocked` tiene que leerse BAJO EL LOCK, o entre la verificacion y la escritura cabe un desarchivado (ADR 0054 §2)» | sacar `lockBusiness` de `decideUnderLock` | **VERDE 39/39** |
| S2 | `_auth.ts:219` «`subscription` pasa SIEMPRE por `toSubscriptionView`, asi que los 3 campos internos no pueden viajar» | devolver la fila CRUDA | ROJO 1 — `expected [ 'businessId', …(9) ] to deeply equal [ 'interval', 'pendingPlan', …(3) ]` |
| S3 | `_auth.ts:77` «lo que no sea un `BillingError` es un 503: NUNCA se filtra el mensaje de una excepcion cualquiera» | filtrar `error.message` | **VERDE 39/39** |
| S4 | `checkout:22` «gate de plan: un negocio con suscripcion viva recibe 409 `subscription_live` en vez de abrir un segundo Checkout y COBRAR DOS VECES» | saltear `decideUnderLock` (lock+leer, sin decidir) | **VERDE 39/39** |
| S5 | `checkout:36` «se verifica que la sesion este ABIERTA; si no, 409 `checkout_session_stale`, porque mandar al owner a una sesion completada es un FALSO EXITO» | sacar el chequeo | ROJO 1 — `expected 200 to be 409` |
| S6 | `checkout` `publicOrigin` normaliza la barra final | sacar el `.replace(/\/+$/,"")` | **VERDE 39/39** |
| S7 | `cancel:33` «la llamada de red NUNCA ocurre con el lock tomado (`shared.ts:38-48`)» | mover `confirmAtStripe` DENTRO de la transaccion | **ROJO 7 / 7 archivos — PERO POR TIMEOUT, no por una asercion**: `Error: Test timed out in 60000ms` x7. La red dentro del lock se auto-deadlockea (`confirmAtStripe` abre OTRA transaccion mientras la de afuera tiene el row lock). La consecuencia es observable; ninguna asercion la nombra. **Efecto colateral que hay que saber: los timeouts dejaron filas huerfanas y envenenaron la rama** (ver el hallazgo de los literales fijos) |
| S8 | `cancel:102` «solo se revierte ante un error determinista, NUNCA ante `StripeConnectionError` ni un timeout» | tratar el `ConnectionError` como determinista | ROJO 1 — `expected null to be 'free'` |
| S9 | `cancel:170` «se mira `type`/`rawType`/`statusCode` y no `instanceof`, que se rompe si el que construyo el error cargo otra copia del modulo» | dejar solo la rama `type` | **VERDE 48/48** (alcance reducido, sin `billing.neon`). Confirmado ademas de forma estatica: los UNICOS constructores de error de Stripe en toda la suite son `StripeConnectionError` y `StripeInvalidRequestError`, y los dos traen `type`, asi que las ramas `rawType` y `statusCode` son **inalcanzables por la suite** |
| S10 | `cancel:142` «`pending_plan_at` sale de `cancel_at` y de ningun otro lado (D5.f prohibe `items.data[0]`)» | leer `items.data[0].current_period_end` | ROJO 1 — `expected 2027-01-15T00:00:00.000Z to deeply equal 2026-10-01T00:00:00.000Z` |
| S11 | `resume:~20` «el orden es el INVERSO de `cancel` —primero Stripe— porque el estado conservador es seguir capado; al reves un fallo de red devolveria el tope a 3 con la cancelacion viva» | limpiar ANTES de llamar a Stripe (verificado que el parche hace eso) | **VERDE 39/39** |
| S12 | `resume:43` «la clave lleva `pending_plan_at`: un `cancel→resume→cancel→resume` estrena una nueva porque la fecha cambio» | clave FIJA | **VERDE 39/39** |
| S13 | `resume:33` «las TRES columnas juntas: dejar `downgrade_requested_at` puesto haria que un `deleted` AJENO se clasificara esperado y aterrizara en `free` en vez de `none`» | `clearPendingPlan` no limpia la marca | ROJO 3 / 8 archivos — `billing-store.test.ts > clearPendingPlan ... no deja downgrade_requested_at puesto` y `billing-cancel-guards > resume limpia el cancel_at EXPLICITO` (`expected [ Array(3) ] to deeply equal [ null, null, null ]`) |
| S14 | `interval:34` «`payment_behavior: error_if_incomplete` es NORMATIVO» (= M17) | sacarlo | ROJO (= M17 confirmada) — `billing-interval > tarjeta rechazada: 402 y NADA aplicado` → `expected 200 to be 402` |
| S15 | `interval:41` «el `interval` de la fila lo escribe el WEBHOOK, no esta ruta; asi no hay dos escritores» | que la ruta lo escriba | ROJO 1 — `billing-interval > mensual → anual ...` → `expected 'year' to be 'month'` |
| S16 | `interval` la clave lleva `current_period_end` | clave fija | **VERDE 48/48** |
| S17 | `interval` `isCardError` mira `type` Y `rawType` | dejar solo `type` | **VERDE 48/48** (misma prueba estatica que S9: ningun test construye un error sin `type`) |
| S18 | `settle-free:7` «`settleToFree` limpia `stripe_subscription_id` — sin eso, `subscription_live` 409 PARA SIEMPRE» (= M14) | no limpiarlo | ROJO 3 / 8 archivos (= M14 confirmada) — `expected 'sub_muerta' to be null` + las dos de `billing-store.test.ts` sobre el `SET` exacto |


## Resumen del barrido nuevo

**18 afirmaciones mutadas. 9 ROJAS (pinneadas), 1 roja-por-timeout, 9 VERDES (sin oraculo).**

VERDES, en orden de gravedad:
1. **S4 — el gate de plan de `checkout`.** Saltear `decidePlanChange` entero deja 39/39 VERDE. La
   DECISION esta pinneada en los units de la fase A; el **CABLEADO** no. Es el hueco de
   `choosePushPromptView` que `CLAUDE.md` describe, sobre la propiedad cuyo daño es **cobrar dos
   veces**. Ningun test de integracion llama a `checkout` sobre una suscripcion VIVA.
2. **S1 — el read-modify-write bajo lock de `decideUnderLock`.** Sacar `lockBusiness` deja 39/39
   VERDE. Es el ADR 0054 §2 citado en el propio docblock. (El lock del WEBHOOK si tiene oraculo
   —M4—; el de la RUTA no.)
3. **S11 — el orden invertido de `resume`.** Limpiar antes de llamar a Stripe deja 39/39 VERDE. Es
   el espejo de M5, que para `cancel` SI muerde.
4. **S3 — `billingErrorResponse` no filtra el mensaje de una excepcion cualquiera.** Filtrarlo deja
   39/39 VERDE. El docblock lo afirma con «nunca».
5. **S12 / S16 — las `idempotencyKey` de `resume` e `interval`.** Fijarlas deja verde. Las de
   `cancel` (A4/A5) y `checkout` (A7/A8) SI tienen oraculo; estas dos no.
6. **S9 / S17 — las ramas `rawType` / `statusCode` de `isDeterministicRejection` e `isCardError`.**
   Inalcanzables por la suite: ningun test construye un error sin `type`. El docblock las justifica
   («un `instanceof` se rompe si el que construyo el error cargo otra copia del modulo»).
7. **S6 — la normalizacion de la barra final de `MERCHANT_PUBLIC_ORIGIN`.** Cosmetica.

## Hallazgo aparte, encontrado POR el barrido

**`billing.neon.integration.test.ts` es el unico archivo de integracion nuevo con literales de
Stripe FIJOS** (`livePlus("bloqueado"|"ciclo"|"orden"|"red"|"determinista")`, `randomUUID` = 0),
contra la decision 10 del propio implementador («tienen que ser UNICOS POR CORRIDA: los uniques son
GLOBALES»). `billing-interval` esta a medias (2 fijos + 3 random); `-cancel-guards`,
`-checkout-guards` y `locations-races` estan limpios. **Consecuencia observada de verdad en esta
sesion:** una corrida abortada (mi S7, por timeout) dejo filas con esos ids y a partir de ahi
`billing.neon` muere **en el SEED** con `Failed query: insert into core.subscription`, un rojo que
se lee como bug de producto y no lo es — el sintoma exacto que la decision 10 existe para evitar.
**La rama quedo envenenada y hay que limpiarla** (no corri SQL destructivo: queda para el
orquestador).
