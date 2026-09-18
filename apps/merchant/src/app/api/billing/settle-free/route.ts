import { downgradeToFree } from "../_downgrade";

/**
 * Spec 0063, D10 — `POST /api/billing/settle-free`: LA SALIDA del estado «sin suscripción»
 * (`plan='none'`), y también la del `plus` cuya suscripción murió (el caso de A1 en prod).
 * Es la única operación de plan que NO toca Stripe: escribe el `SET` completo de D10
 * (`settleToFree` en `billing/store.ts`), que limpia `stripe_subscription_id` — sin eso
 * `hasLiveSubscription` seguiría siendo verdadero y el negocio comería `subscription_live`
 * 409 PARA SIEMPRE, sin poder volver nunca a Plus.
 *
 * POR QUÉ ES LITERALMENTE EL MISMO HANDLER QUE `cancel`, y no una copia: D10 dice que esta
 * salida «es la MISMA rama de `decidePlanChange` (`intent: "downgrade"`), no una segunda
 * regla que pueda divergir», y la tabla de D6 les da el mismo conjunto de errores. Lo que
 * decide si se toca Stripe o no es la FILA (`hasLiveSubscription`), no la URL: sobre una
 * suscripción muerta el `decidePlanChange` devuelve `settle_to_free` y no se llama a Stripe
 * ni una vez; sobre una viva devuelve `schedule_downgrade` y se cancela al fin del periodo,
 * que es lo correcto —settlear en local una suscripción que Stripe sigue facturando sería
 * dejar de cobrarle al negocio el plan que paga—.
 *
 * Las dos URLs existen porque la UI tiene dos entradas (D7): el botón de bajar de plan desde
 * `plus`, y «Ajustarme y bajar a Free» desde `none`. La condición de locales y el modal son
 * los mismos.
 */
export const POST = downgradeToFree;
