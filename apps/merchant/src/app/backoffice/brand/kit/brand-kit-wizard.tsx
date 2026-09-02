"use client";

import { useState } from "react";
import { ModuleHeader } from "../../../components/ui";
import type { QrStyle } from "./qr-render";
import { StepBrandCheck } from "./steps/step-brand-check";
import { StepPreview } from "./steps/step-preview";
import { StepTemplate } from "./steps/step-template";
import type { PosterColors, TemplateId } from "./templates/types";
import type {
  BrandKitReady,
  KitScope,
} from "../../../../server/brand-kit/data";

// Brand kit wizard (spec 0041): 3 steps — choose template (+ scope when 2+ locales) →
// check logo/colors → preview & print. The state is central (same pattern as the loyalty
// program-editor). Nothing here persists to the saved marca: color/text overrides live
// only for this print. The QR SVGs are pre-rendered server-side (one per scope) and only
// recolored/overlaid client-side.

const STEPS = ["template", "brand", "preview"] as const;
type StepId = (typeof STEPS)[number];

const STEP_LABEL: Record<StepId, string> = {
  template: "Plantilla",
  brand: "Marca",
  preview: "Vista previa",
};

/** A business with 2+ locales gets the scope selector and per-local posters. */
export type Paper = "a4" | "a5";

export function BrandKitWizard({ data }: { data: BrandKitReady }) {
  const hasLocalScopes = data.locationScopes.length >= 2;
  const [index, setIndex] = useState(0);
  const [templateId, setTemplateId] = useState<TemplateId>("minimal");
  // Scope: "global" or a specific locationId (only meaningful with 2+ locales).
  const [scopeMode, setScopeMode] = useState<"global" | "local">("global");
  const [activeLocationId, setActiveLocationId] = useState<string>(
    data.locationScopes[0]?.locationId ?? "",
  );
  const [colors, setColors] = useState<PosterColors>({
    primary: data.business.brandPrimaryColor,
    complementary: data.business.brandComplementaryColor,
    accent: data.business.brandAccentColor,
  });
  const [label, setLabel] = useState(data.defaults.label);
  const [headline, setHeadline] = useState(data.defaults.headline);
  const [subheadline, setSubheadline] = useState(data.defaults.subheadline);
  const [qrStyle, setQrStyle] = useState<QrStyle>("black");
  const [paper, setPaper] = useState<Paper>("a4");

  const step = STEPS[index];
  const hasLogo = data.business.logoPath !== null;
  // The only gate to advancing: step 2 needs a logo to paint the poster.
  const canAdvance = step === "brand" ? hasLogo : true;
  const isLast = step === "preview";

  const activeScope: KitScope =
    scopeMode === "local" && hasLocalScopes
      ? (data.locationScopes.find((s) => s.locationId === activeLocationId) ??
        data.globalScope)
      : data.globalScope;

  return (
    <main className="merchant-shell">
      <div className="brand-kit">
        <ModuleHeader
          eyebrow="Marca"
          title="Afiche de enrolamiento"
          description="Generá el afiche imprimible con el QR para sumar clientes en tu local."
          closeHref="/backoffice/brand"
        />

        <ol className="brand-kit-steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`brand-kit-step ${i === index ? "is-active" : ""} ${
                i < index ? "is-done" : ""
              }`}
            >
              <span className="brand-kit-step-n">{i + 1}</span>
              {STEP_LABEL[s]}
            </li>
          ))}
        </ol>

        <section className="brand-kit-body">
          {step === "template" && (
            <StepTemplate
              templateId={templateId}
              onTemplate={setTemplateId}
              hasLocalScopes={hasLocalScopes}
              scopeMode={scopeMode}
              onScopeMode={setScopeMode}
            />
          )}
          {step === "brand" && (
            <StepBrandCheck business={data.business} hasLogo={hasLogo} />
          )}
          {step === "preview" && (
            <StepPreview
              templateId={templateId}
              business={data.business}
              colors={colors}
              onColors={setColors}
              label={label}
              onLabel={setLabel}
              headline={headline}
              onHeadline={setHeadline}
              subheadline={subheadline}
              onSubheadline={setSubheadline}
              qrStyle={qrStyle}
              onQrStyle={setQrStyle}
              paper={paper}
              onPaper={setPaper}
              scopeMode={scopeMode}
              hasLocalScopes={hasLocalScopes}
              locationScopes={data.locationScopes}
              activeScope={activeScope}
              activeLocationId={activeLocationId}
              onActiveLocation={setActiveLocationId}
            />
          )}
        </section>

        <div className="brand-kit-nav">
          <button
            type="button"
            className="brand-kit-back"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Atrás
          </button>
          {!isLast && (
            <button
              type="button"
              className="brand-kit-next"
              disabled={!canAdvance}
              onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
