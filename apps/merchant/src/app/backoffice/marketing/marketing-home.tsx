"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Clock } from "iconoir-react";
import { Alert } from "../../../ui";
import {
  asMarketingError,
  errorText,
  marketingRequest,
  type MarketingApiError,
} from "./marketing-api";
import {
  MarketingConfirm,
  MarketingError,
  MarketingLoading,
  MarketingPanel,
  MarketingShell,
  MarketingToast,
} from "./marketing-ui";
import type {
  Campaign,
  MarketingSettings,
  TemplateView,
} from "./marketing-types";
import { CampaignsList } from "./campaigns-list";
import { TemplateRow } from "./template-row";

export function MarketingHome({
  isOwner,
  canReadLocations,
}: {
  isOwner: boolean;
  canReadLocations: boolean;
}) {
  const [templates, setTemplates] = useState<TemplateView[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [error, setError] = useState<MarketingApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TemplateView | null>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, list, config] = await Promise.all([
        marketingRequest<{ templates: TemplateView[] }>(
          "/api/marketing/templates",
        ),
        marketingRequest<{ campaigns: Campaign[] }>("/api/marketing/campaigns"),
        marketingRequest<{ settings: MarketingSettings }>(
          "/api/marketing/settings",
        ).catch(() => null),
      ]);
      setTemplates(catalog.templates);
      setCampaigns(list.campaigns);
      setTimeZone(config?.settings?.timeZone ?? null);
    } catch (reason) {
      setError(asMarketingError(reason));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function action(template: TemplateView, name: "activate" | "disable") {
    if (writing.current || (name === "disable" && !isOwner) || !template.live)
      return;
    writing.current = true;
    setBusy(true);
    try {
      if (name === "disable")
        await marketingRequest(
          `/api/marketing/templates/${encodeURIComponent(template.key)}/disable`,
          "POST",
        );
      else
        await marketingRequest(
          `/api/marketing/campaigns/${template.live.id}/activate`,
          "POST",
        );
      setConfirm(null);
      setNotice(
        name === "disable"
          ? "Campaña finalizada. Los turnos activos se retirarán en el próximo refresco."
          : "Campaña reanudada.",
      );
      await load();
    } catch (reason) {
      const failure = asMarketingError(reason);
      setError(failure);
      setNotice(errorText(failure));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  if (!templates && !error) return <MarketingLoading />;
  return (
    <MarketingShell
      title="Campañas"
      description="Prendé una campaña para configurarla. Quedará activa cuando la guardes en el editor."
    >
      <MarketingToast message={notice} dismiss={() => setNotice(null)} />
      {error && (
        <MarketingError
          error={error}
          retry={() => void load()}
          isOwner={isOwner}
        />
      )}
      {templates && (
        <>
          {templates.length === 0 && (
            <MarketingPanel title="Todavía no hay plantillas">
              <p>
                Volvé más tarde para encontrar campañas listas para activar.
              </p>
            </MarketingPanel>
          )}
          {templates.length > 0 && (
            <MarketingPanel
              title="Campañas listas para usar"
              description="Cada fila muestra si la campaña está prendida y cuándo termina."
            >
              <ul>
                {templates.map((template) => (
                  <TemplateRow
                    key={template.key}
                    template={template}
                    timeZone={timeZone}
                    isOwner={isOwner}
                    busy={busy}
                    onFinalize={() => setConfirm(template)}
                    onResume={() => void action(template, "activate")}
                  />
                ))}
              </ul>
            </MarketingPanel>
          )}
          <MarketingPanel
            title="Campañas a medida"
            description="Definí tu audiencia, el mensaje, los locales y un cupón opcional."
          >
            <CampaignsList
              campaigns={campaigns.filter((campaign) => !campaign.templateKey)}
              showCreate={canReadLocations}
            />
            {!canReadLocations && (
              <Alert className="mt-5" title="Necesitás acceso a Locales">
                Para crear una campaña a medida se deben elegir locales. Pedile
                al propietario el permiso de Locales.
              </Alert>
            )}
          </MarketingPanel>
          <MarketingPanel
            title="Horario de push"
            description="Elegí cuándo pueden salir los avisos de tus campañas."
          >
            <Link
              className="marketing-link"
              href="/backoffice/marketing/settings"
            >
              <Clock aria-hidden className="size-5" /> Configurar horario{" "}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </MarketingPanel>
        </>
      )}
      <MarketingConfirm
        open={Boolean(confirm)}
        title="¿Finalizar esta corrida?"
        danger
        busy={busy}
        confirmLabel="Finalizar corrida"
        description={`Los parámetros y resultados de esta corrida quedarán guardados. Para cambiarla tendrás que activar una nueva.\n${confirm?.live?.couponLabel ? `Los cupones ya emitidos seguirán válidos hasta ${new Date(confirm.live.endsAt!).toLocaleDateString("es-EC")}.` : ""}\nLos turnos activos se retiran en el próximo refresco.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void action(confirm, "disable");
        }}
      />
    </MarketingShell>
  );
}
