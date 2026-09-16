import type { CampaignResults } from "../../../server/marketing/results";
import { QUALITY_LABELS } from "./campaign-labels";

/**
 * The results section (spec 0065, «Resultados»). It RENDERS the DTO and decides nothing:
 * the literal title of the purchases block and the gating of the effect line at 30
 * holdouts both live in `results.ts`, with their own unit tests. A screen that re-derived
 * either would be a second definition of a product guarantee — «compraron durante su
 * ventana», never «generados por la campaña» — and the two would drift.
 *
 * Every block prints its QUALITY (ADR 0021), because an observed count, a configured
 * estimate and an inference from a control group are not the same kind of number and the
 * owner is going to spend money on the difference.
 */

function Quality({ value }: { value: keyof typeof QUALITY_LABELS }) {
  return <small className="quality">{QUALITY_LABELS[value]}</small>;
}

export function CampaignResultsView({
  results,
  currencyCode,
}: {
  results: CampaignResults;
  currencyCode: string;
}) {
  const { audience, turns, windowPurchases, effect, coupon } = results;
  return (
    <section className="campaign-results">
      <h2>Resultados</h2>

      <article className="result-block">
        <h3>Audiencia del último tick</h3>
        <Quality value={audience.quality} />
        {audience.photo === null ? (
          <p className="counter-hint">
            Todavía no corrió ningún tick sobre esta campaña.
          </p>
        ) : (
          <ul>
            <li>{audience.photo.total} personas en la audiencia</li>
            <li>{audience.photo.reachable} alcanzables por Wallet</li>
            <li>{audience.photo.noLocation} sin local atribuible</li>
            <li>{audience.photo.optOut} con las promociones apagadas</li>
            <li>{audience.photo.cooldown} en cooldown</li>
          </ul>
        )}
      </article>

      <article className="result-block">
        <h3>Turnos</h3>
        <Quality value={turns.quality} />
        <ul>
          <li>{turns.queued} en cola</li>
          <li>{turns.active} activos</li>
          <li>{turns.done} terminados</li>
          <li>{turns.held} retenidos</li>
        </ul>
      </article>

      <article className="result-block">
        <h3>{windowPurchases.title}</h3>
        <Quality value={windowPurchases.quality} />
        <ul>
          <li>
            Con turno: {windowPurchases.placed.purchases} de{" "}
            {windowPurchases.placed.of}
          </li>
          <li>
            Retenidos: {windowPurchases.held.purchases} de{" "}
            {windowPurchases.held.of}
          </li>
        </ul>
        {effect.quality === "estimada" ? (
          <p className="result-effect">
            Estimación del efecto: {effect.extraCustomers >= 0 ? "+" : ""}
            {effect.extraCustomers} clientes <Quality value={effect.quality} />
          </p>
        ) : (
          <p className="result-effect">
            Todavía sin señal: hacen falta {effect.needed} turnos retenidos y
            hay {effect.holdoutN}. <Quality value={effect.quality} />
          </p>
        )}
      </article>

      <article className="result-block">
        <h3>Cupones</h3>
        <Quality value={coupon.quality} />
        {coupon.label === null ? (
          <p className="counter-hint">Esta campaña no tiene cupón.</p>
        ) : (
          <p>
            {coupon.label}: {coupon.redeemed} de {coupon.cap} canjeados ·{" "}
            {currencyCode} {coupon.incurredCost ?? "0.00"} de costo estimado
            incurrido
          </p>
        )}
      </article>

      <article className="result-block">
        <h3>Por local</h3>
        <Quality value={results.byLocation.quality} />
        {results.byLocation.rows.length === 0 ? (
          <p className="counter-hint">Todavía no hay turnos por local.</p>
        ) : (
          <ul>
            {results.byLocation.rows.map((row) => (
              <li key={row.locationId}>
                {row.name}: {row.turns} turnos · {row.windowPurchases} compraron
                en su ventana · {row.redemptions} canjes
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="result-block">
        <h3>Alcance del pase</h3>
        <Quality value={results.passReach.quality} />
        <p>
          Estás en el pase de {results.passReach.inPass} de tus{" "}
          {results.passReach.members} clientes.
        </p>
      </article>
    </section>
  );
}
