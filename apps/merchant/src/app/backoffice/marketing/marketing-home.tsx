"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Clock } from "iconoir-react";
import { Alert, Button } from "../../../ui";
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
import type { Campaign, TemplateView } from "./marketing-types";
import { STATUS_LABELS } from "./campaign-labels";
import { CampaignsList } from "./campaigns-list";

const channelName = { proximity: "Proximidad", push: "Push" };
const groups: Record<string, { title: string; description: string }> = {
  reactivation: {
    title: "Volver a verlos",
    description:
      "Acompañá a quienes dejaron de venir, desde la primera ausencia hasta la recuperación.",
  },
  balance: {
    title: "Acercarlos al premio",
    description:
      "Avisá cuando falta poco o cuando ya tienen un premio para canjear.",
  },
};

export function MarketingHome({
  isOwner,
  canReadLocations,
}: {
  isOwner: boolean;
  canReadLocations: boolean;
}) {
  const [templates, setTemplates] = useState<TemplateView[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<MarketingApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TemplateView | null>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, list] = await Promise.all([
        marketingRequest<{ templates: TemplateView[] }>(
          "/api/marketing/templates",
        ),
        marketingRequest<{ campaigns: Campaign[] }>("/api/marketing/campaigns"),
      ]);
      setTemplates(catalog.templates);
      setCampaigns(list.campaigns);
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
      title="Campañas que trabajan por vos"
      description="Elegí una campaña lista para usar o armá una a medida."
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
          {Array.from(new Set(templates.map((template) => template.group))).map(
            (group) => {
              const items = templates
                .filter((template) => template.group === group)
                .sort((a, b) => a.rank - b.rank);
              return (
                <MarketingPanel
                  key={group}
                  title={groups[group]?.title ?? group}
                  description={groups[group]?.description}
                >
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {items.map((template) => (
                      <article
                        key={template.key}
                        className="flex min-w-0 flex-col rounded-md border border-border bg-surface-subtle p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-lg font-bold">
                            {template.title}
                          </h3>
                          <span className="rounded-full border border-border-strong px-3 py-1 text-sm font-semibold">
                            {template.live
                              ? STATUS_LABELS[template.live.status]
                              : "Apagada"}
                          </span>
                        </div>
                        <p className="mt-3 flex-1 text-sm leading-6 text-content-muted">
                          {template.description}
                        </p>
                        <p className="mt-3 text-sm text-content-muted">
                          {template.channels
                            .map((channel) => channelName[channel])
                            .join(" · ")}
                        </p>
                        {template.live && (
                          <p className="mt-3 text-sm">
                            Desde{" "}
                            {new Date(
                              template.live.activatedAt ??
                                template.live.createdAt,
                            ).toLocaleDateString("es-EC")}
                          </p>
                        )}
                        <div className="mt-5 flex flex-col gap-2">
                          {template.live ? (
                            <>
                              <Link
                                className="marketing-link"
                                href={`/backoffice/marketing/${template.live.id}`}
                              >
                                Ver campaña{" "}
                                <ArrowRight aria-hidden className="size-4" />
                              </Link>
                              {template.live.status === "paused" && (
                                <Button
                                  variant="secondary"
                                  isLoading={busy}
                                  onPress={() =>
                                    void action(template, "activate")
                                  }
                                >
                                  Reanudar
                                </Button>
                              )}
                              {isOwner && template.live.status !== "draft" && (
                                <Button
                                  variant="quiet"
                                  isDisabled={busy}
                                  onPress={() => setConfirm(template)}
                                >
                                  Finalizar corrida
                                </Button>
                              )}
                            </>
                          ) : (
                            <Link
                              className="marketing-link marketing-link-primary"
                              href={`/backoffice/marketing/templates/${encodeURIComponent(template.key)}`}
                            >
                              Configurar y activar{" "}
                              <ArrowRight aria-hidden className="size-4" />
                            </Link>
                          )}
                        </div>
                        {template.runs.length > 0 && (
                          <div className="mt-4 border-t border-border pt-3 text-sm">
                            <p className="font-semibold">
                              Corridas anteriores ({template.runs.length})
                            </p>
                            <ul className="mt-2 grid gap-2">
                              {template.runs.map((run) => (
                                <li key={run.id}>
                                  <Link
                                    className="underline underline-offset-2"
                                    href={`/backoffice/marketing/${run.id}`}
                                  >
                                    {run.activatedAt
                                      ? new Date(
                                          run.activatedAt,
                                        ).toLocaleDateString("es-EC")
                                      : "Sin fecha"}{" "}
                                    · {STATUS_LABELS[run.status]}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </MarketingPanel>
              );
            },
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
