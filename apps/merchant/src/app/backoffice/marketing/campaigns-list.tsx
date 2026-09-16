import Link from "next/link";
import { ModuleHeader } from "../../components/ui";
import type { CampaignOverview } from "../../../server/marketing/campaign-list";
import { STATUS_LABELS, formatDay } from "./campaign-labels";

/**
 * The listing (spec 0065, «Lo que ve el owner»). No state and no `"use client"`: every
 * number is already decided by the server and the only interaction is a link. A console
 * component here would ship the whole list to the browser to render the same markup.
 */
export function CampaignsList({
  overviews,
}: {
  overviews: CampaignOverview[];
}) {
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Campañas"
          title="Volvé a llamar a tus clientes dormidos"
          description="Tu local aparece en el Wallet de quien no viene hace tiempo cuando pasa cerca. No hay envío: la cola decide a quién le toca."
          closeHref="/backoffice"
        />
        <Link
          className="button campaign-create"
          href="/backoffice/marketing/new"
        >
          + Nueva campaña
        </Link>
        <section className="locations-list">
          <h2>Tus campañas</h2>
          {overviews.length === 0 && (
            <p className="counter-hint">Todavía no creaste ninguna campaña.</p>
          )}
          {overviews.map((overview) => (
            <CampaignRow key={overview.campaign.id} overview={overview} />
          ))}
        </section>
      </div>
    </main>
  );
}

function CampaignRow({ overview }: { overview: CampaignOverview }) {
  const { campaign, lastAudience } = overview;
  return (
    <article className="campaign-card">
      <div>
        <span className={`status ${campaign.status}`}>
          {STATUS_LABELS[campaign.status]}
        </span>
        <h2>{campaign.name}</h2>
        <p>
          Dormidos hace {campaign.dormantDays} días · desde{" "}
          {formatDay(campaign.startsAt)} hasta {formatDay(campaign.endsAt)}
        </p>
        <strong>
          {lastAudience === null
            ? "Todavía no corrió ningún tick sobre esta campaña."
            : `Último tick: ${lastAudience.total} personas, ${lastAudience.reachable} alcanzables por Wallet.`}
        </strong>
        <small>
          {overview.activeTurns} turnos activos · {overview.windowPurchases} de{" "}
          {overview.doneTurns} compraron durante su ventana
        </small>
      </div>
      <div>
        <Link
          className="small-button"
          href={`/backoffice/marketing/${campaign.id}`}
        >
          Ver campaña →
        </Link>
      </div>
    </article>
  );
}
