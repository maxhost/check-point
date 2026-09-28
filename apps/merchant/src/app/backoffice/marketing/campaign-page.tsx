"use client";
import { useCallback, useEffect, useState } from "react";
import {
  asMarketingError,
  marketingRequest,
  type MarketingApiError,
} from "./marketing-api";
import {
  MarketingError,
  MarketingLoading,
  MarketingShell,
} from "./marketing-ui";
import type { Campaign, CampaignResults, Location } from "./marketing-types";
import { CampaignDetail } from "./[id]/campaign-detail";

export function CampaignPage({
  id,
  isOwner,
  canReadLocations,
  currencyCode,
}: {
  id: string;
  isOwner: boolean;
  canReadLocations: boolean;
  currencyCode: string;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [results, setResults] = useState<CampaignResults | null>(null);
  const [locationNames, setLocationNames] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<MarketingApiError | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [campaignData, resultsData, doors] = await Promise.all([
        marketingRequest<{ campaign: Campaign }>(
          `/api/marketing/campaigns/${encodeURIComponent(id)}`,
        ),
        marketingRequest<{ results: CampaignResults }>(
          `/api/marketing/campaigns/${encodeURIComponent(id)}/results`,
        ),
        canReadLocations
          ? marketingRequest<{ locations: Location[] }>("/api/locations").catch(
              () => null,
            )
          : Promise.resolve(null),
      ]);
      setCampaign(campaignData.campaign);
      setResults(resultsData.results);
      setLocationNames(
        Object.fromEntries(
          (doors?.locations ?? []).map((location) => [
            location.id,
            location.name,
          ]),
        ),
      );
    } catch (reason) {
      setError(asMarketingError(reason));
    }
  }, [id, canReadLocations]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!campaign && !error)
    return <MarketingLoading label="Cargando campaña…" />;
  if (error && !campaign)
    return (
      <MarketingShell
        title="Campaña"
        description="No pudimos abrir esta campaña."
        closeHref="/backoffice/marketing"
      >
        <MarketingError
          error={error}
          isOwner={isOwner}
          retry={() => void load()}
        />
      </MarketingShell>
    );
  return campaign && results ? (
    <CampaignDetail
      campaign={campaign}
      results={results}
      locationNames={locationNames}
      currencyCode={currencyCode}
      isOwner={isOwner}
      refresh={() => void load()}
      loadError={error}
    />
  ) : null;
}
