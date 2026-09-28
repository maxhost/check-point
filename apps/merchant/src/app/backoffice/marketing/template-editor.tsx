"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "../../../ui";
import {
  asMarketingError,
  errorText,
  marketingRequest,
  MarketingApiError,
} from "./marketing-api";
import {
  MarketingConfirm,
  MarketingError,
  MarketingPanel,
  MarketingShell,
  MarketingToast,
} from "./marketing-ui";
import type {
  Campaign,
  CouponKind,
  Location,
  MarketingSettings,
  TemplateView,
} from "./marketing-types";
import {
  initialTemplateDraft,
  templateDraftBody,
  templateDraftErrors,
  type TemplateDraft,
} from "./template-draft";
import { TemplateFields } from "./template-fields";
import { readMarketingLocations } from "./marketing-locations";
import { useTemplateExit } from "./template-exit";
import { MarketingTemplateSkeleton } from "./marketing-skeletons";
import { rewardConfirmation } from "./reward-draft";

export function TemplateEditor({
  templateKey,
  isOwner,
  canReadLocations,
  canReadCatalog = false,
}: {
  templateKey: string;
  isOwner: boolean;
  canReadLocations: boolean;
  canReadCatalog?: boolean;
}) {
  const [template, setTemplate] = useState<TemplateView | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);
  const [couponKinds, setCouponKinds] = useState<CouponKind[] | null>(null);
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [error, setError] = useState<MarketingApiError | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const writing = useRef(false);
  const editing = Boolean(template && !template.live);
  const exit = useTemplateExit(editing);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, config, doors] = await Promise.all([
        marketingRequest<{
          templates: TemplateView[];
          currencyCode: string;
          couponKinds: CouponKind[];
        }>("/api/marketing/templates"),
        marketingRequest<{ settings: MarketingSettings }>(
          "/api/marketing/settings",
        ),
        readMarketingLocations(canReadLocations),
      ]);
      const found = catalog.templates.find((item) => item.key === templateKey);
      if (!found) throw new MarketingApiError(404, "not_found");
      setTemplate(found);
      setCurrencyCode(catalog.currencyCode);
      setCouponKinds(catalog.couponKinds);
      setSettings(config.settings);
      setLocations(doors);
      setDraft((current) => current ?? initialTemplateDraft(found));
    } catch (reason) {
      setError(asMarketingError(reason));
    }
  }, [canReadLocations, templateKey]);
  useEffect(() => {
    void load();
  }, [load]);

  function change(patch: Partial<TemplateDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setFields((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  }
  function review() {
    if (
      !template ||
      !draft ||
      !settings ||
      !couponKinds ||
      error?.status === 401 ||
      error?.status === 403 ||
      error?.uncertain
    )
      return;
    setAttempted(true);
    const issues = templateDraftErrors(
      template,
      draft,
      settings.timeZone,
      couponKinds,
    );
    setFields(issues);
    if (Object.keys(issues).length) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            '[aria-invalid="true"] input, [aria-invalid="true"] textarea, [aria-invalid="true"] button',
          )
          ?.focus(),
      );
      return;
    }
    setConfirm(true);
  }
  async function activate() {
    if (
      !template ||
      !draft ||
      !settings ||
      writing.current ||
      error?.status === 401 ||
      error?.status === 403 ||
      error?.uncertain
    )
      return;
    writing.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = templateDraftBody(
        template,
        draft,
        settings.timeZone,
        locations !== null && draft.channels.includes("proximity"),
      );
      await marketingRequest<{ campaign: Campaign }>(
        `/api/marketing/templates/${encodeURIComponent(template.key)}/enable`,
        "POST",
        body,
      );
      setConfirm(false);
      exit.activated();
    } catch (reason) {
      const failure = asMarketingError(reason);
      setConfirm(false);
      setFields(failure.fields);
      setError(failure);
      if (failure.code === "no_loyalty_reward") setToast(errorText(failure));
      if (failure.code === "template_already_live") void load();
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  if (!template && !error) return <MarketingTemplateSkeleton />;
  return (
    <MarketingShell
      title={
        template ? `Configurá «${template.title}»` : "Configurar plantilla"
      }
      description="La campaña seguirá apagada hasta que guardes y confirmes la activación."
      closeHref="/backoffice/marketing"
      onClose={editing ? () => exit.ask() : undefined}
    >
      <MarketingToast
        kind="error"
        message={toast}
        dismiss={() => setToast(null)}
      />
      {error && error.code !== "no_loyalty_reward" && (
        <MarketingError
          error={error}
          retry={() => void load()}
          isOwner={isOwner}
        />
      )}
      {template?.live && (
        <Alert
          kind="warning"
          title="Esta plantilla ya tiene una corrida en curso"
        >
          <Link
            className="underline"
            href={`/backoffice/marketing/${template.live.id}`}
          >
            Ver la corrida actual
          </Link>
        </Alert>
      )}
      {template &&
        draft &&
        settings &&
        currencyCode &&
        couponKinds &&
        !template.live && (
          <MarketingPanel
            title="Configuración"
            description={template.description}
          >
            <div className="max-w-3xl">
              <TemplateFields
                template={template}
                draft={draft}
                settings={settings}
                locations={locations}
                canReadCatalog={canReadCatalog}
                couponKinds={couponKinds}
                currencyCode={currencyCode}
                change={change}
                errors={attempted || Object.keys(fields).length ? fields : {}}
              />
              {error?.code === "validation" && (
                <Alert
                  kind="error"
                  title="Revisá los campos señalados"
                  className="mt-5"
                />
              )}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  isDisabled={
                    busy ||
                    error?.status === 401 ||
                    error?.status === 403 ||
                    Boolean(error?.uncertain)
                  }
                  onPress={review}
                >
                  Guardar y activar
                </Button>
                <Button variant="secondary" onPress={() => exit.ask()}>
                  Volver al listado
                </Button>
              </div>
            </div>
          </MarketingPanel>
        )}
      <MarketingConfirm
        open={confirm}
        busy={busy}
        title={`¿Guardar y activar «${template?.title ?? "esta plantilla"}»?`}
        confirmLabel="Guardar y activar"
        description={
          draft && settings
            ? `Canales: ${draft.channels.map((channel) => (channel === "push" ? "Push" : "Proximidad")).join(" y ")}\nAusencia: ${draft.dormantDays} días\nMensaje: ${draft.message.trim()}\nInicio: ${draft.startsAt || "Ahora"}\nFin: ${draft.endsAt || "Sin fecha de fin"}${draft.coupon && currencyCode ? `\nPremio: ${rewardConfirmation(draft, currencyCode)}` : ""}${template?.nearReward ? `\nUmbral: ${draft.nearRewardStamps} sellos o ${draft.nearRewardPercent} % en puntos` : ""}${template?.repeat ? `\nRepetición: ${draft.rewardRepeat === "every_30_days" ? "cada 30 días, hasta dos veces" : "una vez"}` : ""}\nZona horaria: ${settings.timeZone}`
            : ""
        }
        onCancel={() => setConfirm(false)}
        onConfirm={() => void activate()}
      />
      <MarketingConfirm
        open={Boolean(exit.target)}
        title="¿Salir sin activar la campaña?"
        description="La campaña seguirá apagada. Los cambios que hiciste en el editor se perderán."
        confirmLabel="Salir sin activar"
        cancelLabel="Seguir editando"
        danger
        onCancel={exit.stay}
        onConfirm={exit.leave}
      />
    </MarketingShell>
  );
}
