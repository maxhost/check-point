---
adr: 0063
fecha: 2026-09-13
estado: aceptada
resumen: La baja a Free deja de programarse a fin de periodo y pasa a ser INMEDIATA, sin devolver ni acreditar el tiempo pagado. El diferimiento se cambia por un AVISO («te conviene volver el dia X»), porque el estado diferido creaba una contradiccion visible: el merchant seguia pagando Plus y ya no podia usar sus locales. Efecto lateral: «Reanudar» sale de nuestro flujo, pero el estado diferido puede seguir LLEGANDO desde el dashboard de Stripe, asi que la regla del tope efectivo se queda.
---

# 0063 — La baja de plan es inmediata y sin devolucion

## Contexto

La spec 0063 entrego la baja como **cancelacion programada a fin de periodo**: se confirma hoy y
Stripe la ejecuta en la fecha de renovacion. Para que el negocio no aterrizara en `free` con mas
locales de los que ese plan permite, el tope de locales pasa a ser **`min(plan vigente, plan
pendiente)` desde el momento en que se programa** (`locations/core.ts`).

**Lo cazo el owner en el QA de prod, y es una contradiccion real que ninguna revision vio** porque
cada mitad, por separado, es correcta:

> «hoy hice upgrade y luego downgrade a free y me dice que perdere el plus el 13 de octubre, pero
> entonces deberia tener las funciones plus hasta el 13 de octubre»

El merchant **paga Plus hasta el 13 de octubre y desde el minuto cero solo puede tener 1 local**.
Se le cobra un plan que ya no puede usar. Los tests estaban todos en verde: **cada regla cumplia su
contrato y la composicion era incoherente**, que es una clase de defecto que la revision por
mutacion no encuentra — no hay ningun invariante roto que mutar.

## Decision

**La baja a Free es INMEDIATA.** Al confirmar: se cancela la suscripcion en Stripe en el acto, el
plan pasa a `free` y el acceso a las funciones Plus se pierde en ese momento.

**NO se devuelve ni se acredita el tiempo pagado.** Respuesta literal del owner (2026-09-13):
«Sin reembolso, no devolvemos plata. indicamos cuando le conviene para aprovechar el plan completo,
si baja ahora, pierde acceso inmediato.»

**En lugar del diferimiento, la UI AVISA cuando conviene bajar**: un texto del tipo «te conviene
volver el <fecha>» —dos dias antes de la renovacion— para que el merchant aproveche el periodo que
ya pago en vez de perderlo.

**El modal de la baja tiene que decir que es inmediata y que se pierde el acceso**, antes de
confirmar. Hoy no lo dice, porque hasta ahora no era cierto.

## Lo que se verifico antes de decidir (no supuesto)

- **`subscriptions.cancel` no prorratea por default.** `SubscriptionCancelParams.prorate` esta
  documentado como «Will generate a proration invoice item that credits remaining unused time…
  **Defaults to `false`**» (`esm/resources/Subscriptions.d.ts`, stripe@22.5.0). O sea que **cancelar
  sin parametros es exactamente lo que el owner pidio**: sin credito y sin devolucion.
- **Ojo con la palabra «reembolso», que fue el motivo de preguntar dos veces:** el prorrateo de
  Stripe acredita **saldo a favor en el customer**, NO devuelve plata a la tarjeta; un reembolso
  real es otra llamada contra el cargo. Son productos distintos para el merchant. **Con esta
  decision no se usa ninguno de los dos.**
- **La fecha de renovacion ya la sabemos derivar:** sale de `items.data[0].current_period_end` del
  `retrieve` (`billing/derive-rules.ts:79`), que es de donde hoy se calcula `pending_plan_at`. No
  hace falta infraestructura nueva para el aviso.

## Consecuencias

- **«Reanudar suscripcion» sale del flujo propio**, y con el sale el bug D4 del QA (falla siempre).
  **PERO NO SE PUEDE BORRAR EL ESTADO:** el boton de cancelar del **dashboard de Stripe** setea
  `cancel_at_period_end` y nuestro webhook escribe `pending_plan='free'` igual. Es el mismo hecho
  que obligo al ADR 0060 y a la columna `downgrade_requested_at`. **La baja diferida puede seguir
  APARECIENDO aunque la app no la cree nunca**, y que hace la app cuando llega es una decision
  abierta de la spec 0064.
- **`effectiveLocationLimit` = `min(vigente, pendiente)` SE QUEDA**, por lo mismo: deja de dispararse
  por nuestra propia baja, pero sigue siendo lo unico que impide aterrizar en `free` con 3 locales
  activos cuando la baja la programo otro.
- **El bloqueo duro por locales activos se queda y ahora es coherente**: se archiva, se baja, y se
  pierde Plus en el acto. Antes se archivaba hoy para un efecto que ocurria en un mes.
- **Se pierde una comodidad real y hay que decirlo:** la baja programada se ejecutaba sola. El aviso
  «volve el dia X» es **manual**: si el merchant se olvida, paga un mes mas. Es el precio de la
  coherencia, y el owner lo eligio sabiendolo.
- No cambia el upgrade, ni el cambio de intervalo, ni la salida del estado muerto (D10).

## Que NO decide este ADR

Los cuatro huecos de UI que el mismo QA encontro (etiqueta del intervalo, modal de confirmacion del
cambio de intervalo, fecha de proximo pago, importe cobrado + recibo) son **alcance de la spec
0064**, no de este ADR: son omisiones de la spec 0063, no una decision de diseño nueva.
