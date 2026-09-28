"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "../../../../ui";
import type { Campaign as ServerCampaign } from "../../../../server/marketing/campaign-store";
import type { CampaignResults as ServerResults } from "../../../../server/marketing/results";
import {
  asMarketingError,
  marketingRequest,
  type MarketingApiError,
} from "../marketing-api";
import {
  MarketingConfirm,
  MarketingError,
  MarketingPanel,
  MarketingShell,
  MarketingToast,
} from "../marketing-ui";
import type { Campaign, CampaignResults } from "../marketing-types";
import {
  ACTION_LABELS,
  PAUSE_REASON_LABELS,
  STATUS_LABELS,
  availableActions,
} from "../campaign-labels";
import { CampaignResultsView } from "../results-view";
import { money, REWARD_KIND_LABELS } from "../reward-labels";

type CampaignLike = Campaign | ServerCampaign;
const dateLabel = (value: string | Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "sin fecha de fin";

export function CampaignDetail({
  campaign: initial,
  results,
  locationNames,
  currencyCode,
  isOwner = true,
  refresh,
  loadError,
}: {
  campaign: CampaignLike;
  results: CampaignResults | ServerResults;
  locationNames: Record<string, string>;
  currencyCode: string;
  isOwner?: boolean;
  refresh?: () => void;
  loadError?: MarketingApiError | null;
}) {
  const [campaign, setCampaign] = useState<CampaignLike>(initial);
  useEffect(() => setCampaign(initial), [initial]);
  const [error, setError] = useState<MarketingApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"end" | "archive" | null>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const actions = availableActions(campaign.status).filter((action) => {
    if ((action === "end" || action === "archive") && !isOwner) return false;
    if (campaign.templateKey && action === "archive") return false;
    return true;
  });

  async function run(action: "activate" | "pause" | "end" | "archive") {
    if (
      writing.current ||
      ((action === "end" || action === "archive") && !isOwner)
    )
      return;
    writing.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const url =
        action === "end" && campaign.templateKey
          ? `/api/marketing/templates/${encodeURIComponent(campaign.templateKey)}/disable`
          : `/api/marketing/campaigns/${campaign.id}/${action}`;
      const response = await marketingRequest<{
        campaign: Campaign;
        notice?: string;
      }>(url, "POST");
      setCampaign(response.campaign);
      setConfirm(null);
      setNotice(
        response.notice ??
          `Campaña ${STATUS_LABELS[response.campaign.status].toLowerCase()}.`,
      );
      refresh?.();
    } catch (reason) {
      setError(asMarketingError(reason));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  return (
    <MarketingShell
      title={campaign.name}
      description="Configuración y resultados de esta corrida."
      closeHref="/backoffice/marketing"
    >
      <MarketingToast message={notice} dismiss={() => setNotice(null)} />
      {(error || loadError) && (
        <MarketingError
          error={(error || loadError)!}
          retry={refresh}
          isOwner={isOwner}
        />
      )}
      <MarketingPanel title="La campaña">
        <span className="inline-flex rounded-full border border-border-strong bg-surface-subtle px-3 py-1 text-sm font-semibold">
          {STATUS_LABELS[campaign.status]}
        </span>
        {campaign.status === "paused" && campaign.pauseReason && (
          <Alert className="mt-4" kind="warning" title="Campaña pausada">
            {PAUSE_REASON_LABELS[campaign.pauseReason] ??
              "La campaña está pausada."}
          </Alert>
        )}
        <dl className="marketing-details mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt>Audiencia</dt>
            <dd>Dormidos hace {campaign.dormantDays} días</dd>
          </div>
          <div>
            <dt>Canales</dt>
            <dd>
              {campaign.channels
                .map((channel) => (channel === "push" ? "Push" : "Proximidad"))
                .join(" y ")}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt>Mensaje</dt>
            <dd>{campaign.message}</dd>
          </div>
          <div>
            <dt>Vigencia</dt>
            <dd>
              Desde {dateLabel(campaign.startsAt)} hasta{" "}
              {dateLabel(campaign.endsAt)}
            </dd>
          </div>
          <div>
            <dt>Locales</dt>
            <dd>
              {campaign.locationIds.length
                ? Object.keys(locationNames).length
                  ? campaign.locationIds
                      .map((id) => locationNames[id] ?? "local archivado")
                      .join(", ")
                  : `${campaign.locationIds.length} locales seleccionados`
                : "No se usan locales en esta corrida"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt>Cupón</dt>
            <dd>
              {campaign.couponLabel === null
                ? "Sin cupón"
                : campaign.couponKind
                  ? `${campaign.couponLabel} · ${REWARD_KIND_LABELS[campaign.couponKind]} · ${money(campaign.couponCost ?? "0", currencyCode)} por canje · tope ${campaign.couponMaxRedemptions}`
                  : `${campaign.couponLabel} · ${currencyCode} ${campaign.couponCost} por canje · tope ${campaign.couponMaxRedemptions}`}
            </dd>
          </div>
          {campaign.couponKind === "discount" && (
            <div>
              <dt>Descuento</dt>
              <dd>
                {campaign.couponDiscountUnit === "percent"
                  ? `${Number(campaign.couponDiscountValue)} %`
                  : money(campaign.couponDiscountValue ?? "0", currencyCode)}
              </dd>
            </div>
          )}
          {(campaign.couponKind === "extra_stamps" ||
            campaign.couponKind === "extra_points") && (
            <div>
              <dt>Se acredita al canjear</dt>
              <dd>
                {campaign.couponExtraUnits}{" "}
                {campaign.couponKind === "extra_stamps" ? "sellos" : "puntos"}
              </dd>
            </div>
          )}
          {campaign.couponRule && (
            <div className="sm:col-span-2">
              <dt>Condiciones</dt>
              <dd>{campaign.couponRule}</dd>
            </div>
          )}
          {campaign.nearRewardStamps !== null && (
            <div>
              <dt>Faltante máximo</dt>
              <dd>
                {campaign.nearRewardStamps} sellos o{" "}
                {campaign.nearRewardPercent} % en puntos
              </dd>
            </div>
          )}
          {campaign.rewardRepeat && (
            <div>
              <dt>Repetición</dt>
              <dd>
                {campaign.rewardRepeat === "once"
                  ? "Una vez"
                  : "Cada 30 días, hasta dos veces"}
              </dd>
            </div>
          )}
        </dl>
        {campaign.templateKey && (
          <p className="mt-4 text-sm text-content-muted">
            Para cambiar los parámetros, finalizá esta corrida y activá una
            nueva desde el catálogo.
          </p>
        )}
        <div className="mt-6 flex flex-col flex-wrap gap-3 sm:flex-row">
          {!campaign.templateKey &&
            (campaign.status === "draft" || campaign.status === "paused") && (
              <Link
                className="marketing-link"
                href={`/backoffice/marketing/${campaign.id}/edit`}
              >
                Editar
              </Link>
            )}
          {actions.map((action) => (
            <Button
              key={action}
              variant={
                action === "activate"
                  ? "primary"
                  : action === "end" || action === "archive"
                    ? "danger"
                    : "secondary"
              }
              isDisabled={busy}
              onPress={() =>
                action === "end" || action === "archive"
                  ? setConfirm(action)
                  : void run(action)
              }
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      </MarketingPanel>
      <CampaignResultsView
        results={results}
        currencyCode={currencyCode}
        channels={campaign.channels}
      />
      <MarketingConfirm
        open={Boolean(confirm)}
        title={
          confirm === "archive" ? "¿Archivar campaña?" : "¿Finalizar campaña?"
        }
        description={`${confirm === "archive" ? "La campaña quedará archivada." : "Para cambiarla tendrás que lanzar una corrida nueva. Los turnos activos se retirarán en el próximo refresco."}${campaign.couponLabel ? `\nLos cupones ya emitidos seguirán vigentes hasta ${dateLabel(campaign.endsAt)}.` : ""}`}
        confirmLabel={confirm === "archive" ? "Archivar" : "Finalizar"}
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void run(confirm);
        }}
      />
    </MarketingShell>
  );
}
