---
adr: 0136
fecha: 2026-10-10
estado: aceptada
resumen: El saldo (puntos, sellos y, cuando exista, cashback) vence ENTERO si pasan N meses sin compras ni canjes en ese comercio. Es opcional y lo elige cada comercio entre 3, 6, 9 o 12 meses, en todos los planes. El plazo cuenta desde la ultima compra o canje (`business_customer.last_visit_at`, o el alta si nunca vino) y nunca desde antes del dia en que se activo o acorto la regla. El cliente recibe avisos a los 20, 10 y 5 dias y el dia del vencimiento («hoy vencen»), y ningun saldo vence sin que ese ultimo aviso se haya emitido. Un barrido diario (el cron existente `loyalty-expiry`) emite los avisos y pone el saldo en 0, dejando una fila de auditoria.
---

# 0136 — Vencimiento del saldo por inactividad

## Contexto

Hoy nada vence: el saldo vive en `consumer.program_membership` (`points_balance`, `stamps_count`) y solo cambia por
una compra (`counter/orders.ts:145`, que tambien usa el POS) o un canje (`counter/redemptions.ts`). El `expired` de
`core.loyalty_program_event` es el cierre del programa, no del saldo. El vencimiento estaba parqueado (#61, owner
2026-09-26) y el owner lo eligio como primera funcionalidad despues de los planes pagos (2026-10-10).

Decisiones del owner (2026-10-10), en sus palabras: «Cada punto o sello vence si no se hacen compras o no se usan a
los 6 meses, por ejemplo»; «deberia ser opcional, no obligatorio. Cada comercio puede elegir su plazo»; avisos «20
dias antes, 10 dias antes, 5 dias antes, el dia del vencimiento»; «aplica para sellos, puntos y cashback cuando lo
tengamos». Y por pregunta cerrada: el plazo cuenta desde que se activa (nadie pierde nada ese dia); plazos 3, 6, 9 o
12 meses; el aviso del dia dice «hoy vencen»; esta en todos los planes.

## Decision

1. **Por inactividad, el saldo entero.** No hay vencimiento por lote (cada punto con su fecha): no hay un libro por
   unidad y la regla del owner es de inactividad. Cualquier compra o canje en el comercio reinicia el plazo.
2. **Actividad = `core.business_customer.last_visit_at`** (compra o canje en mostrador o POS; un cupon siempre va
   atado a una orden). Es el dato que ya mantienen todos los caminos que mueven el saldo, en la misma transaccion
   (`customers/projection.ts`). Si nunca vino, cuenta el alta (`program_membership.enrolled_at`). El regalo de la
   Bienvenida no es una visita y no reinicia el plazo.
3. **Fecha de vencimiento** (fecha local del comercio, `business.timezone`):
   `vence_el = fecha_local(max(ultima_actividad, desde)) + N meses`, donde `desde` es el momento en que el comercio
   activo la regla o acorto el plazo (alargarlo no mueve `desde`). El saldo se pierde al terminar ese dia.
4. **Nadie pierde saldo sin el aviso «hoy vencen».** El barrido solo pone en 0 un saldo cuyo aviso del dia ya se
   emitio (fila en la cola, haya o no canal de push). Si el cron falto un dia, o el comercio estuvo bloqueado, el
   barrido emite el aviso atrasado y vence al dia siguiente. Es la regla que hace justo el caso borde sin mas
   maquinaria.
5. **Avisos a los 20, 10 y 5 dias y el dia del vencimiento.** Se emite solo el mas urgente que corresponda y no se
   repite (uno por umbral y por fecha de vencimiento): un cron atrasado no dispara una rafaga. Van por la cola
   existente como clase `transactional` (es sobre el saldo del cliente, no marketing): aparecen en Actividad, cuentan
   en el presupuesto de 24 h y NO los corta la baja de promociones.
6. **Comercio sin acceso (ADR 0134) o programa no activo: no hay avisos ni vencimientos.** Su mostrador no anda; el
   cliente no tendria como evitar la perdida.
7. **El barrido es el cron diario que ya existe** (`/api/internal/loyalty-expiry`, `5 5 * * *` = 00:05 en Ecuador).
   Hobby no da precision horaria; el aviso sale a las 10:00 locales del comercio (`not_before`).
8. **Cada vencimiento deja una fila** (`core.balance_expiration`) con lo que se perdio, y cada cambio de la regla un
   evento `expiry_changed` en `core.loyalty_program_event`.
9. **Concurrencia (ADR 0054 §2):** el vencimiento bloquea la fila de la membresia, re-lee actividad y saldo DESPUES del
   lock y decide con una funcion pura. Una compra que entra durante el barrido nunca se borra.
10. **Cashback no se construye aca.** Cuando exista, su saldo entra en la misma regla (decision del owner).

## Consecuencias

- Los terminos del programa no se reescriben: la regla viaja como dato (`balanceExpiryMonths`) y la pantalla la muestra
  junto a los terminos. Reescribir el markdown versionado (ADR 0026) seria otra decision.
- La fecha que ve el cliente es la nominal; si el aviso del dia salio tarde, el saldo vence un dia despues de lo
  mostrado (a favor del cliente).
- Un aviso ya encolado sale aunque el comercio apague la regla en las horas previas: aceptado.
- El pase de Wallet es uno para toda la red y no muestra saldos: no cambia.
