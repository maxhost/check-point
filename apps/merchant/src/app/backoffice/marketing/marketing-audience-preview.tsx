"use client";
import { useEffect, useState } from "react";
import { Alert } from "../../../ui";
import { marketingRequest } from "./marketing-api";
import type { Channel, Location } from "./marketing-types";

type Preview = {
  total: number;
  reachable: number;
  noLocation: number;
  cooldown: number;
  eligible: number;
};

export function MarketingAudiencePreview({
  templateKey,
  channels,
  dormantDays,
  locations,
  excludedLocationIds,
}: {
  templateKey: string;
  channels: Channel[];
  dormantDays: number;
  locations: Location[] | null;
  excludedLocationIds: string[];
}) {
  const supported =
    (templateKey === "missed_you" || templateKey === "win_back") &&
    channels.includes("proximity") &&
    dormantDays >= 7 &&
    locations !== null;
  const [result, setResult] = useState<{
    key: string;
    preview: Preview | null;
    failed: boolean;
  } | null>(null);
  const locationIds = locations
    ?.filter(
      (location) =>
        location.status === "active" &&
        !excludedLocationIds.includes(location.id),
    )
    .map((location) => location.id)
    .join(",");
  const key = `${dormantDays}:${locationIds ?? ""}`;

  useEffect(() => {
    if (!supported) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          dormantDays: String(dormantDays),
          locationIds: locationIds ?? "",
        });
        const data = await marketingRequest<{ preview: Preview }>(
          `/api/marketing/audience-preview?${query}`,
        );
        if (current) {
          setResult({ key, preview: data.preview, failed: false });
        }
      } catch {
        if (current) {
          setResult({ key, preview: null, failed: true });
        }
      }
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [supported, dormantDays, locationIds, key]);

  if (!supported)
    return (
      <Alert title="Alcance de la campaña">
        El alcance se calcula al activar y lo vas a ver en los resultados.
      </Alert>
    );
  if (result?.key === key && result.failed)
    return (
      <Alert kind="warning" title="No pudimos consultar el alcance">
        Puedes continuar; el alcance se verá en los resultados.
      </Alert>
    );
  if (result?.key !== key || !result.preview)
    return (
      <p role="status" className="text-sm text-content-muted">
        Calculando el alcance por proximidad…
      </p>
    );
  return (
    <Alert
      title={`Hoy son ${result.preview.total} personas · alcance por proximidad`}
    >
      {result.preview.reachable} alcanzables por Wallet ·{" "}
      {result.preview.noLocation} sin local atribuible ·{" "}
      {result.preview.cooldown} en cooldown · {result.preview.eligible}
      elegibles ahora.
      {channels.includes("push") && (
        <p className="mt-2">
          El alcance de push se calcula al activar y lo vas a ver en los
          resultados.
        </p>
      )}
    </Alert>
  );
}
