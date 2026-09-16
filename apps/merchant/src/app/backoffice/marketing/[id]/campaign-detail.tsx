"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ModuleHeader, Toast } from "../../../components/ui";
import type { Campaign } from "../../../../server/marketing/campaign-store";
import {
  isEditable,
  type CampaignAction,
} from "../../../../server/marketing/campaign-transitions";
import type { CampaignResults } from "../../../../server/marketing/results";
import {
  ACTION_LABELS,
  PAUSE_REASON_LABELS,
  STATUS_LABELS,
  availableActions,
  formatDay,
} from "../campaign-labels";
import { CampaignResultsView } from "../results-view";

/**
 * The detail screen (spec 0065): the definition, the four actions and the results.
 *
 * The buttons offered come from `availableActions`, which reads the SAME transition table
 * the routes read — a second list here is how the screen ends up offering a button the
 * server answers with 409 `invalid_transition`.
 *
 * `notice` is displayed and not swallowed: `pause` and `end` do NOT retire the live
 * turns, the next tick does, and an owner who reads «pausada» while their door is still
 * on a customer's pass would reasonably think it failed.
 */
export function CampaignDetail({
  campaign: initial,
  results,
  locationNames,
  currencyCode,
}: {
  campaign: Campaign;
  results: CampaignResults;
  locationNames: Record<string, string>;
  currencyCode: string;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: CampaignAction) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/marketing/campaigns/${campaign.id}/${action}`,
        { method: "POST" },
      );
      const payload = (await res.json().catch(() => null)) as {
        campaign?: Campaign;
        notice?: string;
        error?: string;
      } | null;
      if (!res.ok || !payload?.campaign)
        throw new Error(payload?.error ?? "No pudimos aplicar esa acción.");
      setCampaign(payload.campaign);
      setNotice(
        payload.notice ??
          `Campaña ${STATUS_LABELS[payload.campaign.status].toLowerCase()}.`,
      );
      // The results are server-rendered: after a transition they are stale (the tick may
      // have moved turns since) and a refresh is what re-reads them.
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos aplicar esa acción.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Campaña"
          title={campaign.name}
          closeHref="/backoffice/marketing"
        />
        <Toast
          message={error ?? notice}
          kind={error ? "error" : "success"}
          onDismiss={() => {
            setError(null);
            setNotice(null);
          }}
        />
        <section className="rule-builder">
          <span className={`status ${campaign.status}`}>
            {STATUS_LABELS[campaign.status]}
          </span>
          {campaign.status === "paused" && campaign.pauseReason !== null && (
            <p className="field-help">
              {PAUSE_REASON_LABELS[campaign.pauseReason] ??
                campaign.pauseReason}
            </p>
          )}
          <ul>
            <li>Dormidos hace {campaign.dormantDays} días</li>
            <li>Mensaje: «{campaign.message}»</li>
            <li>
              Locales:{" "}
              {campaign.locationIds
                .map((id) => locationNames[id] ?? "local archivado")
                .join(", ")}
            </li>
            <li>
              Desde {formatDay(campaign.startsAt)} hasta{" "}
              {formatDay(campaign.endsAt)}
            </li>
            <li>
              {campaign.couponLabel === null
                ? "Sin cupón"
                : `Cupón: ${campaign.couponLabel} · ${currencyCode} ${campaign.couponCost} por canje · tope ${campaign.couponMaxRedemptions}`}
            </li>
          </ul>
          <div className="composer-actions">
            {isEditable(campaign.status) && (
              <Link
                className="small-button"
                href={`/backoffice/marketing/${campaign.id}/edit`}
              >
                Editar
              </Link>
            )}
            {availableActions(campaign.status).map((action) => (
              <button
                key={action}
                className={action === "activate" ? "button" : "small-button"}
                disabled={busy}
                onClick={() => void run(action)}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </section>
        <CampaignResultsView results={results} currencyCode={currencyCode} />
      </div>
    </main>
  );
}
