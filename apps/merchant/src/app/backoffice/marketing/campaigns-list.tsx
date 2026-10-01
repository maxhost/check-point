import Link from "next/link";
import type { CampaignOverview } from "../../../server/marketing/campaign-list";
import type { Campaign } from "./marketing-types";
import { STATUS_LABELS } from "./campaign-labels";

export function CampaignsList({
  campaigns,
  overviews,
  showCreate = true,
}: {
  campaigns?: Campaign[];
  overviews?: CampaignOverview[];
  showCreate?: boolean;
}) {
  const rows = overviews ?? campaigns?.map((campaign) => ({ campaign })) ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.length === 0 && <p>Todavía no creaste ninguna campaña.</p>}
      {rows.map((row) => {
        const campaign = row.campaign;
        const overview = "lastAudience" in row ? row : null;
        return (
          <Link
            key={campaign.id}
            className="marketing-card-link"
            href={`/backoffice/marketing/${campaign.id}`}
          >
            <span className="text-sm font-semibold text-content-muted">
              {STATUS_LABELS[campaign.status]}
            </span>
            <strong className="mt-1 block">{campaign.name}</strong>
            <span className="mt-1 block text-sm">
              {campaign.templateKey === "welcome"
                ? "Se entrega al activar notificaciones en CheckPass"
                : `Dormidos hace ${campaign.dormantDays} días`}
            </span>
            {overview && (
              <span className="mt-3 block text-sm">
                {overview.lastAudience
                  ? `Último tick: ${overview.lastAudience.total} personas, ${overview.lastAudience.reachable} alcanzables por Wallet.`
                  : "Todavía no corrió ningún tick sobre esta campaña."}
              </span>
            )}
            {overview && (
              <span className="mt-1 block text-sm">
                {overview.activeTurns} turnos activos ·{" "}
                {overview.windowPurchases} de {overview.doneTurns} compraron
                durante su ventana
              </span>
            )}
            <span className="mt-3 block font-semibold">Ver campaña →</span>
          </Link>
        );
      })}
      {showCreate && (
        <Link className="marketing-card-link" href="/backoffice/marketing/new">
          <strong>Crear campaña a medida</strong>
          <span className="mt-1 block text-sm">Definí tus propias reglas.</span>
        </Link>
      )}
    </div>
  );
}
