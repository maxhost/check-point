"use client";

/**
 * Spec 0064, fase B — LA TARJETA DE ALTA A PLUS, sacada de `subscription-console.tsx`.
 *
 * CORTE DE TAMAÑO HECHO ANTES DE AGREGAR, no después (anexo, fase B): la consola estaba en
 * 264/300 y esta fase le suma la fecha de renovación, el importe con su recibo, el modal de
 * confirmación del intervalo y el aviso del modal de baja. Extender primero y dividir después
 * es cómo un archivo termina en 370 líneas con el hook gritando a cada edición.
 *
 * NO TIENE HOOKS, Y ES DELIBERADO. `billingInterval` sigue viviendo en la consola:
 *  - es lo que viaja en el body del Checkout, así que la consola —que es la que llama a
 *    `fetch`— tiene que poder leerlo sin un estado espejo;
 *  - la sonda de clicks (`billing-click-probe.test.ts`) siembra los `useState` POR POSICIÓN, y
 *    su índice 0 es justamente `billingInterval`. Mover el estado acá le corría los índices a
 *    un test que pinnea que el período elegido es el que se postea.
 * Sin hooks, además, la sonda puede invocar este componente con `expand()` para llegar al
 * botón, que es lo que hace con el `PlanCard` del onboarding.
 *
 * ESTA TARJETA NO DECIDE SI SE OFRECE EL ALTA: la consola la renderiza sólo cuando
 * `offers.upgrade` no es `null`, y eso lo decidió `subscriptionOffers` en el servidor. Un `if`
 * de producto acá sería una segunda regla que puede divergir de esa tabla.
 */
export function UpgradeCard({
  label,
  billingInterval,
  onSelectInterval,
  onCheckout,
  busy,
}: {
  /** La etiqueta que decidió el servidor: «Mejorar a Plus» o «Volver a Plus» (estado `none`). */
  label: string;
  billingInterval: "month" | "year";
  onSelectInterval: (interval: "month" | "year") => void;
  onCheckout: () => void;
  busy: boolean;
}) {
  return (
    <article className="plan-card" aria-label="Plan Plus">
      <p className="plan-card-eyebrow">Para hacer crecer tu negocio</p>
      <h2>Plus</h2>
      <p className="plan-card-price">
        {billingInterval === "year" ? "USD 200" : "USD 20"}
        <small> / {billingInterval === "year" ? "año" : "mes"}</small>
      </p>
      <div className="billing-toggle" aria-label="Período de facturación">
        <button
          type="button"
          className={billingInterval === "month" ? "active" : ""}
          aria-pressed={billingInterval === "month"}
          onClick={() => onSelectInterval("month")}
        >
          Mensual
        </button>
        <button
          type="button"
          className={billingInterval === "year" ? "active" : ""}
          aria-pressed={billingInterval === "year"}
          onClick={() => onSelectInterval("year")}
        >
          Anual <span>Ahorra USD 40</span>
        </button>
      </div>
      <ul className="plan-card-features">
        <li>3 locales activos</li>
        <li>Campañas y beneficios avanzados</li>
        <li>Analíticas para hacer crecer el negocio</li>
      </ul>
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={onCheckout}
      >
        {label}
      </button>
    </article>
  );
}
