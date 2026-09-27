---
adr: 0093
fecha: 2026-09-26
estado: aceptada
resumen: El cupon de una campaña deja de vivir en el TURNO de proximidad y pasa a ser una fila propia, `core.campaign_coupon` = «el cupon de ESTE cliente en ESTA campaña», con su ventana de validez y su snapshot de label/costo. El canal (proximidad hoy, push en la B1) solo lo EMITE; el mostrador lo canjea escaneando el pase sin saber por donde llego. `coupon_redemption` referencia al cupon, no al turno. Un cupon emitido sobrevive a lo que le pase al turno (opt-out, local archivado); lo corta solo el estado de la campaña, su ventana, su canje o el tope.
---

# 0093 — El cupon es del cliente en la campaña, no del canal

## Contexto

La spec 0065 implemento el cupon ADENTRO del turno de proximidad: `campaign_turn` guarda
`coupon_label_snapshot`/`coupon_cost_snapshot`, `coupon_redemption.turn_id` es `NOT NULL` y el
mostrador busca un `campaign_turn` `active` para pintar y canjear el cupon
(`server/counter/coupon-store.ts:57`). Con un solo canal, «el cliente fue alcanzado» y «tiene un
turno» eran lo mismo.

La spec B (canal push de campaña) rompe esa igualdad. Al plantearle al owner que un push con premio
llegaria a gente que despues no podria canjearlo, respondio (2026-09-26): «no comprendo porque atamos
un cupon a un mecanismo especifico como push o proximidad? esto es ridiculo». Y eligio hacer el
desacople en una spec PROPIA antes de la B1.

Medido en prod (`red-violet-38772073`/`main`, 2026-09-26): `core.campaign`, `core.campaign_turn` y
`core.coupon_redemption` tienen **0 filas**. La migracion puede reestructurar sin backfill.

## Decision

1. **Entidad nueva `core.campaign_coupon`**: el cupon de un consumidor en una campaña. Lleva
   `campaign_id`, `business_id`, `consumer_id`, `membership_id`, `label_snapshot`,
   `cost_snapshot`, `valid_from`, `valid_until` y la PROCEDENCIA (`turn_id`, nullable y unico). El
   snapshot se toma al emitir: editar la campaña despues no reescribe un cupon ya dado (misma regla
   que hoy tienen los snapshots del turno).
2. **El canal emite, el mostrador canjea.** La proximidad emite un cupon cuando ACTIVA un turno que
   no es holdout y cuya campaña tiene cupon, valido por la ventana del turno. La B1 agrega la
   emision por push. El mostrador no sabe ni pregunta por que canal llego.
3. **`coupon_redemption` referencia `coupon_id`** (unico, `NOT NULL`) en lugar de `turn_id`. El
   resultado del turno (`outcome = 'coupon_redeemed'`) se sigue escribiendo cuando el cupon tiene
   `turn_id`: el turno sigue siendo la unidad de medicion de la proximidad.
4. **Un cupon emitido es del cliente.** Lo invalidan solo: la campaña deja de estar `active`, la
   ventana `valid_from..valid_until` no incluye `now`, ya fue canjeado, o se agoto el tope de la
   campaña. NO lo invalida que su turno se cancele por `opt_out`, `location_archived`,
   `location_without_coordinates` o `membership_gone` — *(ORQUESTADOR: consecuencia del desacople,
   no decision explicita del owner; se le informa al pedirle el OK de la spec)*. Un `membership_gone`
   igual lo deja inutil en la practica: sin membresia no hay escaneo que lo encuentre.
5. **El contrato del mostrador deja de hablar de turnos**: `turnId` → `couponId`, `windowEnd` →
   `validUntil`, `unknown_turn` → `unknown_coupon`, `turn_not_active` → `coupon_not_active`. Un
   nombre que describe el mecanismo viejo es el mismo acople que este ADR viene a cortar.

## Consecuencias

- El holdout sigue sin cupon, pero ahora por construccion (no se emite) y no por una guarda del
  canje. La guarda del canje pierde el caso `holdout`.
- La B1 agrega la emision por push y decide que pasa si el cliente ya tiene un cupon vivo de la
  misma campaña (la B0 no lo necesita: hay a lo sumo un turno vivo por negocio y consumidor).
- `turn_id` nullable no tiene uso en la B0: lo consume la B1 (emision por push, sin turno), que
  esta en `docs/TASKS.md`.
- Los cupones como catalogo propio del comercio (spec 0021, revivida en el orden de marketing)
  siguen fuera: esto es el cupon DE UNA CAMPAÑA, no un catalogo.

## Alternativas descartadas

- **Dejar el cupon en el turno y crear un turno «fantasma» para el push.** Un turno es un prestamo
  de un lugar del pase (ADR 0065); fingirlo para el push contaminaria la cuota, el cooldown y el
  merito.
- **Que el push habilite canjear «por N dias» buscando el push en la cola.** Acopla el mostrador a
  `wallet_push_queue`, que es un outbox, y repite el problema con otro canal.
- **Invalidar el cupon cuando se cancela el turno.** Vuelve a atar el cupon al canal por la puerta
  de atras: un cliente al que le archivaron la puerta de su turno perderia un cupon que ya vio.
