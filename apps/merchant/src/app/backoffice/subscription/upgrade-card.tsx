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
    <article
      className="min-w-0 rounded-lg border border-border bg-surface p-4 text-content sm:p-6"
      aria-label="Plan Plus"
    >
      <p className="text-sm text-content-muted">Para hacer crecer tu negocio</p>
      <h2 className="mt-2 text-xl font-bold">Plus</h2>
      <p className="mt-4 text-3xl font-bold text-content">
        {billingInterval === "year" ? "USD 200" : "USD 20"}
        <small className="text-sm font-semibold text-content-muted">
          {" "}
          / {billingInterval === "year" ? "año" : "mes"}
        </small>
      </p>
      <div
        className="mt-5 grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-subtle p-1"
        role="group"
        aria-label="Período de facturación"
      >
        <button
          type="button"
          className={`min-h-12 rounded-sm px-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${billingInterval === "month" ? "bg-surface text-content shadow-sm" : "text-content-muted"}`}
          aria-pressed={billingInterval === "month"}
          onClick={() => onSelectInterval("month")}
        >
          Mensual
        </button>
        <button
          type="button"
          className={`min-h-12 rounded-sm px-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${billingInterval === "year" ? "bg-surface text-content shadow-sm" : "text-content-muted"}`}
          aria-pressed={billingInterval === "year"}
          onClick={() => onSelectInterval("year")}
        >
          Anual{" "}
          <span className="block text-xs text-content-muted">
            Ahorras USD 40
          </span>
        </button>
      </div>
      <ul className="mt-5 grid gap-3 border-t border-border pt-5 text-sm">
        <li className="flex gap-2">
          <span aria-hidden="true" className="font-bold text-primary">
            ✓
          </span>
          3 locales activos
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="font-bold text-primary">
            ✓
          </span>
          Campañas y beneficios avanzados
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="font-bold text-primary">
            ✓
          </span>
          Analíticas para hacer crecer el negocio
        </li>
      </ul>
      <button
        data-variant="primary"
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-base font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-disabled disabled:text-on-disabled"
        type="button"
        disabled={busy}
        onClick={onCheckout}
      >
        {label}
      </button>
    </article>
  );
}
