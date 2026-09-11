---
adr: 0059
fecha: 2026-09-10
estado: aceptada
resumen: Un cobro fallido no baja el plan ni archiva locales: tras un maximo de 3 reintentos dentro de la misma semana se BLOQUEA el acceso del comercio (backoffice, cuenta y mostrador) con un modal que pide pagar para rehabilitar. Quedarse SIN suscripcion (un delete inesperado de Stripe) bloquea igual, y se sale ajustandose a free o pagando. Eso convierte el "downgrade involuntario" en un bloqueo reversible y deja el invariante de locales intacto.
---

# 0059 — El impago bloquea el acceso, no baja el plan

> ## ⚠️ SUPERADO EN UN PUNTO — LEER ANTES QUE EL RESTO
>
> **Lo que de este ADR YA NO VALE: el §5 dice que un `deleted` «esperado» se reconoce porque
> tiene `pending_plan='free'` ya escrito por el producto. ES FALSO Y ES PELIGROSO.**
> `pending_plan` lo escribe **tambien el webhook**, ante cualquier `cancel_at_period_end: true`
> — que es justo lo que setea el boton «Cancel subscription» del **dashboard de Stripe**. Con esa
> regla, cancelar desde el dashboard con 3 locales activos clasificaba la baja como «esperada» y
> aterrizaba en **`free` con 3 activos**: el estado exacto que este arco existe para prohibir.
>
> **Lo reemplaza el [ADR 0060](0060-la-baja-esperada-se-prueba-con-una-marca-que-solo-escribimos-nosotros.md):**
> el discriminante es **`downgrade_requested_at`**, una columna que **solo escriben nuestras
> rutas**. El webhook nunca la escribe; solo la limpia cuando la baja se consuma.
>
> **TODO LO DEMAS DE ESTE ADR SIGUE VIGENTE** — que el impago no baja el plan, los 3 reintentos,
> el bloqueo de acceso, que `plan='none'` bloquea, las dos causas con sus dos salidas, y que el
> bloqueo tiene que dejar pasar `/backoffice/subscription` y `/backoffice/locations`. Lo unico
> superado es **de que campo se lee la intencion**, no la decision de producto.

Nace de una pregunta abierta de la spec 0063: que hace el producto cuando el plan **cae sin
que nadie pase por la UI** (cobro fallido, dunning agotado), dejando un negocio en `free` con
mas locales activos que el tope.

## Decision del owner (2026-09-10)

1. **El impago no baja el plan.** Si llega la fecha de cobro y el cliente no paga, se esperan
   **un maximo de 3 reintentos, los tres dentro de la misma semana**.
2. **Agotados los reintentos, se bloquea el acceso** hasta que pague. El bloqueo cubre las
   tres superficies que el owner nombro: **el backoffice, su cuenta y el mostrador**.
3. **El bloqueo se comunica con un modal** que dice que hay que pagar para rehabilitar, en
   cuanto intenta entrar a cualquiera de esas superficies.
4. Por lo tanto **el «downgrade involuntario» deja de existir como camino**: el plan se
   mantiene, los locales se mantienen, y lo que cambia es el **acceso**. El unico downgrade
   posible es el voluntario, que pasa por el modal de condiciones del ADR 0058 §8.

5. **Quedarse sin suscripcion bloquea igual (ADR 0058 §12).** Un `deleted` **inesperado** de
   Stripe no es `free`: es **`plan = 'none'`**, y tambien bloquea. Las dos salidas son
   **ajustarse para bajar a `free`** (misma condicion de locales, mismo modal — y sin tocar
   Stripe, porque no hay suscripcion que cancelar) o **pagar** para volver al plan. Un `deleted`
   **esperado** (el de fin de periodo) NO bloquea: aterriza en `free`. **[SUPERADO POR EL ADR
   0060 — el discriminante NO es `pending_plan`, que lo escribe tambien el webhook ante cualquier
   `cancel_at_period_end` y por lo tanto tambien el boton del dashboard de Stripe, sino
   `downgrade_requested_at`, que solo escriben nuestras rutas.]**

   Por lo tanto el bloqueo tiene **dos causas** y **salidas distintas**:

   | Causa | Estado en la fila | Salidas |
   |---|---|---|
   | Impago (dunning agotado) | `plan` intacto, `status='unpaid'` | pagar |
   | Sin suscripcion | `plan='none'` | bajar a `free` (ajustandose) **o** pagar |

## Consecuencias

- **El invariante de locales de la spec 0063 queda intacto sin necesidad de tolerar un
  sobre-tope.** Al no bajar el plan, nunca aparece un negocio en `free` con 3 locales activos
  por causa de un impago. La decision 6 del ADR 0058 (no aumentar activos por encima del tope)
  sigue siendo la unica regla necesaria.
- **El camino residual que este ADR declaraba abierto quedo CERRADO por la decision 5.** Si el
  owner cancela desde el dashboard de Stripe, el `deleted` llega y el negocio **no cae a
  `free`**: cae a `plan='none'` y **bloquea**. Ya no hay ningun camino por el que un negocio
  llegue a `free` sin pasar por la verificacion de locales. Mientras siga bloqueado con mas
  locales activos que el tope, la regla de transicion los sostiene (no se archiva nada y no se
  puede aumentar).
- **El bloqueo TIENE que dejar pasar dos pantallas, o sus propias salidas son inalcanzables:**
  `/backoffice/subscription` (para pagar o bajar a `free`) y `/backoffice/locations` (para
  archivar y poder bajar a `free`). Un bloqueo total del backoffice deja al comercio sin forma
  de salir del bloqueo. Es el requisito mas facil de romper de esta feature.
- **Los 3 reintentos en la misma semana son configuracion de Stripe, no codigo nuestro**
  (Billing → «Manage failed payments» → retry schedule). **Y hay un requisito duro que hay que
  verificar antes de confiar en este ADR:** el default de Stripe al agotar los reintentos es
  **cancelar la suscripcion**. Si queda asi, Stripe manda `customer.subscription.deleted`, el
  plan cae a `free` y esta decision no se cumple. La cuenta tiene que estar configurada para
  dejar la suscripcion en **`unpaid`** (o `past_due`) en vez de cancelarla. Sin ese cambio de
  configuracion, el ADR es una intencion, no un comportamiento.
- **El disparador del bloqueo es el estado de la suscripcion, no un contador propio.** No se
  cuentan reintentos en nuestra base: el bloqueo se enciende cuando la suscripcion queda en
  `unpaid` (o en `past_due` con `next_payment_attempt: null`, que es Stripe diciendo «no vuelvo
  a intentar» — `Invoices.d.ts:336`). Un contador propio seria una segunda fuente de verdad
  para algo que Stripe ya decide.
- **El bloqueo es una superficie transversal, y por eso NO entra en la spec 0063.** Hoy
  gatean 8 paginas del backoffice mas la API de catalogo, y el mostrador pasa por
  `requireBackofficeSession` (`backoffice/counter/page.tsx:16`), asi que el bloqueo se
  implementa en ese guard compartido — un solo lugar, y con el radio de daño mas grande del
  producto: un bug ahi deja a **todos** los comercios afuera de su propio panel. Va en su
  propia spec (**tarea 54**), con su propio DoD y su propia QA.
- **Mientras esa spec no exista, el estado interino es explicito:** la 0063 registra
  `past_due` / `unpaid` en `status` y `plan='none'` cuando corresponde, y **no** bloquea nada.
  Un negocio moroso conserva `plus` y el acceso completo — que es lo que pasa hoy igual, asi que
  no es una regresion. Un negocio en `plan='none'` queda con el tope en 1 (el fallback de
  `locationLimitForPlan`), o sea que **no puede crecer**, pero sigue operando. La 0063 **si**
  entrega la salida «bajar a `free`», asi que el estado no es un callejon: lo que falta es el
  bloqueo, no la salida.
- El modal de pago necesita una via de pago desde el bloqueo (la URL hospedada de la factura
  impaga, o el portal). Eso lo define la spec de la tarea 54.
