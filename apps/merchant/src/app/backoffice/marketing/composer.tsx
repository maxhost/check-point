"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  asMarketingError,
  marketingRequest,
  MarketingApiError,
} from "./marketing-api";
import type { Campaign, Location, MarketingSettings } from "./marketing-types";
import {
  customBody,
  customErrors,
  initialCustomDraft,
  type CustomDraft,
} from "./custom-draft";
import type { AudiencePreview } from "./custom-fields";
import { ComposerView } from "./composer-view";
import { localBusinessDate } from "./marketing-date";
import type { Campaign as ServerCampaign } from "../../../server/marketing/campaign-store";
import type { AudiencePreview as ServerPreview } from "../../../server/marketing/audience-preview";

function serializedCampaign(campaign: ServerCampaign): Campaign {
  return {
    ...campaign,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt?.toISOString() ?? null,
    activatedAt: campaign.activatedAt?.toISOString() ?? null,
    endedAt: campaign.endedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
  };
}

export function CampaignComposer({
  campaignId,
  currencyCode = "USD",
  isOwner = true,
  canReadLocations = true,
  canReadCatalog = false,
  locations: initialLocations,
  initialPreview,
  campaign: initialCampaign,
  remainingQuota,
}: {
  campaignId?: string;
  currencyCode?: string;
  isOwner?: boolean;
  canReadLocations?: boolean;
  canReadCatalog?: boolean;
  locations?: Location[];
  initialPreview?: ServerPreview;
  campaign?: ServerCampaign;
  remainingQuota?: number;
}) {
  const router = useRouter();
  const effectiveId = campaignId ?? initialCampaign?.id;
  const [locations, setLocations] = useState<Location[] | null>(
    initialLocations ?? null,
  );
  const [settings, setSettings] = useState<MarketingSettings | null>(
    initialLocations
      ? {
          timeZone: "America/Guayaquil",
          pushWindow: { startHour: 9, endHour: 21 },
        }
      : null,
  );
  const [draft, setDraft] = useState<CustomDraft | null>(
    initialLocations
      ? initialCustomDraft(
          initialCampaign ? serializedCampaign(initialCampaign) : null,
          "America/Guayaquil",
          initialLocations.map((location) => location.id),
        )
      : null,
  );
  const [preview, setPreview] = useState<AudiencePreview | null>(
    initialPreview ?? null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<MarketingApiError | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const writing = useRef(false);
  const previewSequence = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [doors, config, stored] = await Promise.all([
        canReadLocations
          ? marketingRequest<{ locations: Location[] }>("/api/locations")
          : Promise.resolve({ locations: [] }),
        marketingRequest<{ settings: MarketingSettings }>(
          "/api/marketing/settings",
        ),
        effectiveId
          ? marketingRequest<{ campaign: Campaign }>(
              `/api/marketing/campaigns/${encodeURIComponent(effectiveId)}`,
            )
          : Promise.resolve(null),
      ]);
      if (stored?.campaign.templateKey)
        throw new MarketingApiError(409, "template_not_editable");
      if (
        stored?.campaign.status !== undefined &&
        !["draft", "paused"].includes(stored.campaign.status)
      )
        throw new MarketingApiError(409, "not_editable");
      setLocations(doors.locations);
      setSettings(config.settings);
      setDraft(
        (current) =>
          current ?? {
            ...initialCustomDraft(
              stored?.campaign ?? null,
              config.settings.timeZone,
              doors.locations
                .filter((location) => location.status === "active")
                .map((location) => location.id),
            ),
            ...(stored
              ? {}
              : {
                  startsAt: localBusinessDate(
                    new Date().toISOString(),
                    config.settings.timeZone,
                  ),
                }),
          },
      );
    } catch (reason) {
      setError(asMarketingError(reason));
    }
  }, [effectiveId, canReadLocations]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!draft || !locations) return;
    const sequence = ++previewSequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          dormantDays: String(draft.dormantDays),
          locationIds: draft.locationIds.join(","),
        });
        const data = await marketingRequest<{ preview: AudiencePreview }>(
          `/api/marketing/audience-preview?${query}`,
        );
        if (sequence === previewSequence.current) {
          setPreview(data.preview);
          setPreviewError(null);
        }
      } catch {
        if (sequence === previewSequence.current) {
          setPreview(null);
          setPreviewError("Volvé a intentar cambiando los días o los locales.");
        }
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft?.dormantDays, draft?.locationIds, locations]);

  function change(patch: Partial<CustomDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setFields((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  }
  function review(activate: boolean) {
    if (
      !draft ||
      !settings ||
      error?.status === 401 ||
      error?.status === 403 ||
      error?.uncertain
    )
      return;
    const issues = customErrors(draft, settings.timeZone);
    setFields(issues);
    if (Object.keys(issues).length) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            '[aria-invalid="true"] input, [aria-invalid="true"] textarea',
          )
          ?.focus(),
      );
      return;
    }
    if (activate) setConfirm(true);
    else void save(false);
  }
  async function save(activate: boolean) {
    if (
      !draft ||
      !settings ||
      writing.current ||
      createdId ||
      error?.status === 401 ||
      error?.status === 403 ||
      error?.uncertain
    )
      return;
    writing.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = customBody(draft, settings.timeZone);
      const data = await marketingRequest<{ campaign: Campaign }>(
        effectiveId
          ? `/api/marketing/campaigns/${encodeURIComponent(effectiveId)}`
          : "/api/marketing/campaigns",
        effectiveId ? "PATCH" : "POST",
        body,
      );
      const id = data.campaign.id;
      setCreatedId(id);
      if (activate) {
        try {
          await marketingRequest(
            `/api/marketing/campaigns/${id}/activate`,
            "POST",
          );
        } catch (reason) {
          setError(asMarketingError(reason));
          setConfirm(false);
          setNotice(
            "El borrador se guardó. La activación necesita atención; consultá la campaña antes de reintentar.",
          );
          return;
        }
      }
      router.push(`/backoffice/marketing/${id}`);
    } catch (reason) {
      const failure = asMarketingError(reason);
      setError(failure);
      setFields(failure.fields);
      setConfirm(false);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return (
    <ComposerView
      effectiveId={effectiveId}
      currencyCode={currencyCode}
      isOwner={isOwner}
      canReadLocations={canReadLocations}
      canReadCatalog={canReadCatalog}
      locations={locations}
      settings={settings}
      draft={draft}
      preview={preview}
      previewError={previewError}
      error={error}
      fields={fields}
      confirm={confirm}
      busy={busy}
      createdId={createdId}
      notice={notice}
      remainingQuota={remainingQuota}
      load={load}
      change={change}
      review={review}
      save={save}
      setConfirm={setConfirm}
      setNotice={setNotice}
    />
  );
}
