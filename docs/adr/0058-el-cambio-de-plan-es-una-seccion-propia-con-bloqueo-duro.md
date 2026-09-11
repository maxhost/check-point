---
adr: 0058
fecha: 2026-09-10
estado: aceptada
resumen: El cambio de plan vive en una seccion propia del backoffice; el upgrade sigue por Stripe Checkout y se aplica al confirmarse el pago, el downgrade y la cancelacion son de bloqueo duro (sin estado intermedio) y exigen cumplir las condiciones del plan destino antes de ejecutarse.
---

# 0058 — El cambio de plan es una seccion propia, con bloqueo duro

Contexto: hoy no existe ningun camino de upgrade/downgrade en el producto.
`POST /api/billing/checkout` es la unica ruta de billing y su unico llamador es
`app/onboarding/page.tsx:158`; `plan` solo se LEE en el backoffice
(`backoffice/page.tsx:62`), nunca se escribe desde el producto. Un negocio que
eligio `free` en el onboarding **no tiene forma de pagar**.

## Decisiones del owner (2026-09-10)

1. **Existe una seccion de gestion de suscripcion en el backoffice.** Ahi el owner
   ve su plan actual y elige moverse de plan A → B, sea hacia arriba o hacia abajo.
   No es un boton suelto: es la superficie donde se administra la suscripcion.

2. **Upgrade: sigue siendo Stripe Checkout, como hoy.** Elegir un plan superior
   lleva a Stripe a pagar; el plan se aplica **cuando el pago esta confirmado**, por
   la via del webhook, no en el click.

3. **Downgrade: bloqueo duro.** Si el negocio no cumple las condiciones del plan
   destino, el cambio **no se puede ejecutar**. Primero se le pide al owner que archive
   los locales que sobren (el usuario elige cuales quedan activos); recien cuando
   cumple, baja de plan. Condiciones del plan inferior:
   - **un solo local activo** (tope del plan `free`, `PLAN_LOCATION_LIMITS`);
   - **sin campanas de marketing corriendo** — feature que **todavia no existe**.

   **Precision agregada el 2026-09-10, porque la redaccion original era mia y era
   demasiado amplia.** La primera version de esta decision decia «sin estado
   intermedio — no existe un estado "downgrade pendiente"». Lo que el owner rechazo
   fue la pregunta tal como se la hice: un estado del tipo *«downgrade pendiente,
   elegi que locales archivar»* que permita pedir la baja sin cumplir todavia. Eso
   sigue prohibido. **No** rechazo registrar que una suscripcion ya esta **programada
   para terminar** al fin del periodo pagado — al contrario, la decision 4 lo exige, y
   sin persistirlo no hay forma de implementarla. Un revisor independiente marco la
   contradiccion aparente entre las decisiones 3 y 4; no es del owner, es de mi
   redaccion, y queda corregida aca.

4. **Existe un boton "cancelar suscripcion"**, disponible si el negocio esta en un
   plan de pago. Al finalizar el periodo ya pagado, el negocio baja al plan gratis.

5. **El bug del webhook se arregla en este arco**, al implementarlo: hoy
   `api/stripe/webhook/route.ts:59` escribe `plan: "plus"` a secas para **cualquier**
   evento `customer.subscription.*`, incluido `deleted`, asi que una cancelacion baja
   el `status` y deja el `plan` en `"plus"` para siempre.

6. **El tope de locales se endurece (2026-09-10, respondiendo al hallazgo de mas
   abajo):** «**no podes dar de alta ni desarchivar locales si el plan en el que estas
   no te lo permite**» — palabras del owner. Es una regla de **transicion**: lo que
   queda prohibido es *aumentar* la cantidad de locales activos por encima del tope, y
   por lo tanto una baja ya programada baja el tope al del plan destino. Lo que la
   regla **no** dice es que hacer cuando el plan cae sin que nadie pase por la UI
   (dunning, dashboard de Stripe) y el negocio queda por encima del tope: eso sigue
   abierto (spec 0063, §Abierto-2).

8. **El boton de cancelar NUNCA se muestra bloqueado (2026-09-10).** El bloqueo duro de la
   decision 3 es del **servidor**, no de la UI: «el usuario no sabria que debe hacer». El
   boton esta siempre habilitado; al apretarlo se abre un **modal que le dice que tiene que
   hacer antes de continuar** (cuantos locales archivar, y el link para hacerlo), y el
   **«Confirmar»** del downgrade solo esta disponible cuando el negocio ya cumple las
   condiciones. Un boton deshabilitado sin explicacion queda descartado.

9. **A1 y su `plus` sin suscripcion: se arregla en Stripe, no en codigo (2026-09-10).** El
   estado real de A1 (`plan='plus'` puesto a mano por SQL para el QA de la 0061, sin
   `stripe_subscription_id`) lo resuelve el owner **creando la suscripcion Plus de verdad en
   Stripe**. No se escribe un camino de producto para ese estado: el codigo conserva el
   rechazo `no_subscription` como **guard defensivo**, no como flujo. Nota operativa: al
   crearla hay que dejarla vinculada (metadata `businessId` o el `stripe_customer_id` de la
   fila), o el webhook no va a poder resolver el negocio.

10. **El cambio de intervalo mensual ↔ anual ENTRA en el alcance (2026-09-10).** No cambia el
    tope de locales (es el mismo plan), asi que no toca el invariante.
    **ACOTADO el mismo dia por el owner, despues de ver el costo del sentido inverso:
    «entregamos mensual a anual, no anual a mensual».** Motivo tecnico, verificado en la doc del
    SDK: `proration_behavior: 'none'` **no** significa «al final del periodo» — «we don't
    generate any credits for the old subscription's unused time. We still reset the billing date
    and **bill immediately**» (`cjs/resources/Subscriptions.d.ts:50`), o sea que el cliente
    pierde lo que ya pago y se le cobra de nuevo; y agendarlo al fin del año exige
    `subscription_schedules`, superficie nueva de la API. El sentido inverso es la **tarea 55**.
    **Quien lea este ADR para implementar: el alcance vigente es UN solo sentido.**

11. **El impago no baja el plan: bloquea el acceso.** Decision propia por su tamaño y su radio
    de daño → **ADR 0059**, que ademas **cierra el hallazgo del downgrade involuntario** de
    este ADR: al no bajar nunca el plan por un cobro fallido, no aparece un negocio en `free`
    por encima del tope. Se implementa en su propia spec (**tarea 54**), no en la 0063.

7. **Orden respecto del arco de marketing/campanas: el cambio de plan va PRIMERO**
   (2026-09-10). El owner habia planteado construir campanas antes; con el argumento de
   que el acoplamiento es una sola linea (la lista de bloqueantes vive en una funcion y
   el bloqueante de campanas se le suma cuando existan) y de que hoy **ningun negocio
   `free` de prod puede pagar**, decidio arrancar por esta feature. Le corresponde el
   numero de spec **0063**.

12. **«Sin suscripcion» es un estado propio, y NO es `free` (2026-09-10).** Correccion del
    owner a una premisa que esta spec tenia mal: *«si Stripe devuelve delete para la
    suscripcion, no deberia caer en free, deberia caer como lo que es: sin suscripcion. Porque
    esa es la realidad: free es una suscripcion, plus es otra, enterprise es otra; si tenemos
    "delete" eso no es ninguna de las tres. Entonces bloquea, y el usuario debe ajustarse para
    bajar a free o pagar para volver a su plan.»** Consecuencias:
    - Un `customer.subscription.deleted` **inesperado** lleva el negocio a **`plan = 'none'`**
      (sin suscripcion) y lo **bloquea**, con dos salidas: **ajustarse y bajar a `free`** (pasa
      por la misma condicion de locales y el mismo modal), o **pagar** para volver a su plan.
    - **Un `deleted` ESPERADO no bloquea.** Si la baja la programo el propio producto
      (`pending_plan = 'free'` ya escrito, o sea que el owner ya paso por el modal, archivo y
      confirmo), el `deleted` de fin de periodo aterriza en **`free`**, que es lo que pidio.
      Sin esta distincion, el flujo de cancelacion del ADR 0058 §4 terminaria **bloqueando** a
      quien hizo todo bien — es un hallazgo de esta correccion, no una decision del owner.
    - Con esto **el invariante queda cerrado del todo**: ya no existe ningun camino por el que
      un negocio llegue a `free` sin pasar por la verificacion de locales. El «residual» que el
      ADR declaraba (cancelar desde el dashboard de Stripe) deja de ser un agujero: bloquea.
    - `enterprise` sigue **sin existir** y esta spec no lo crea; la mencion del owner fue
      ilustrativa. Ojo con la consecuencia ya documentada en `locations/core.ts`: un plan que no
      este en `PLAN_LOCATION_LIMITS` cae al tope mas restrictivo (1).

## Hallazgos a decidir (NO acordados con nadie)

- **El bloqueo en el momento de cancelar no alcanza para sostener el invariante.**
  Chequear "un solo local activo" cuando el owner aprieta cancelar deja abierto el
  camino legal: sigue en `plus` hasta el fin del periodo, y mientras siga en `plus`
  reactivar locales hasta el tope 3 es una operacion **valida**
  (`locations/store.ts:70` compara contra el limite del plan **vigente**). Al cerrar
  el periodo, el plan pasa a `free` con 3 locales activos — exactamente el estado que
  la decision (3) prohibe. El invariante hay que sostenerlo **tambien en el momento en
  que el plan cambia de verdad** (el webhook), no solo en el click.
  **CERRADO.** El camino voluntario lo cierra la decision 6 (con la baja programada el tope
  ya es 1, asi que no se puede volver a subir). El **involuntario** lo cierra la decision 11
  / **ADR 0059**: un impago **no baja el plan**, bloquea el acceso, asi que nunca aparece un
  negocio en `free` por encima del tope por esa via. Queda un unico residual declarado: una
  cancelacion hecha **desde el dashboard de Stripe**, que el producto no ofrece — ahi rige el
  fallback de transicion (se tolera el sobre-tope, no se archiva nada, no se puede aumentar).
- **La premisa del ADR 0056 queda invalidada por la decision (1).** Ese ADR decidio
  **no** restringir por rol `POST /api/billing/checkout` con este argumento textual:
  «No existe una UI de upgrade posterior ni una ruta desde la consola de mostrador al
  onboarding, por lo que no hay un escenario de producto en el que un staff pueda
  llegar a Checkout». Una seccion de plan en el backoffice **crea** ese escenario. La
  ruta hoy solo verifica que exista una fila en `memberships` — **ni el rol ni el
  `status`** (`api/billing/checkout/route.ts:31-42`), y el alta de staff inserta
  `role: 'staff'`, `status: 'active'` en esa misma tabla (`server/staff.ts:136`). O sea
  que sin tocar eso, un staff — incluso uno **desactivado** — podria iniciar un checkout
  o cambiar el plan del negocio. Es el mismo agujero de clase que el `operatorBusiness`
  sin `status = 'active'` de la spec 0055 — y **no es un hallazgo nuevo**: la fila de la
  spec 0057 en `INDEX.md` ya lo dejo anotado como «abierto, no decidido por el owner»
  (`api/billing/checkout` no filtra por `status`). Lo que cambia con la decision (1) es
  que deja de ser teorico.

## Consecuencias

- El ADR 0056 queda **superado en su punto de checkout**: la restriccion que declaraba
  redundante deja de serlo en el momento en que existe esta seccion. El resto de ese
  ADR (el toast del login) no se toca.
- La lista de bloqueantes del downgrade vive en **un solo lugar** en el servidor. Hoy
  tiene un unico bloqueante real (locales activos); el de campanas lo agrega la spec de
  campanas cuando esas existan. No se escribe hoy un chequeo contra una feature que no
  existe — seria andamiaje sin su tarea.
- No hay migracion prevista: `core.subscription` ya tiene `plan`, `interval`, `status`,
  `stripe_customer_id`, `stripe_subscription_id`. Si la decision del hallazgo (1) pide
  persistir algo mas, la spec lo declara.
- **El orden quedo cerrado por la decision 7**: esta feature va primero, con el numero
  de spec **0063**. El arco de campanas le suma despues su bloqueante de downgrade a la
  funcion que la 0063 deja lista.
- **La spec 0063 corrigio este ADR en un punto de hecho.** Su primera version paso por
  dos revisores independientes y por verificacion empirica contra la base de prod; de ahi
  salio que el estado de prod que este ADR daba por sentado estaba **viejo** (A1 figura en
  `plus` pero **sin suscripcion de Stripe** y con **1** local activo, no «locales de
  sobra»). El unico negocio con una suscripcion real es Negocio B. El detalle y las
  consultas estan en la spec; no se repiten aca.
