"use client";

import { useEffect, useState } from "react";
import { Printer } from "iconoir-react";
import Link from "next/link";
import { SelectField, TextField } from "../../../../../ui";
import { PosterPreview } from "../poster-preview";
import type { QrStyle } from "../qr-render";
import type { PosterColors, TemplateId } from "../templates/types";
import type { Paper } from "../brand-kit-wizard";
import type {
  KitBusiness,
  KitScope,
} from "../../../../../server/brand-kit/data";

// Step 3 (spec 0041): live preview + print. Colors/texts/QR-style are override-only (never
// persisted to the marca). Print leaves ONLY the poster on the page at the chosen size
// (A4/A5) via a dynamic @page rule + `@media print` in globals.css → "Guardar como PDF".
// With a per-local scope you can walk the locales and print the current one or all.

const QR_STYLES: { id: QrStyle; label: string }[] = [
  { id: "black", label: "Negro clásico" },
  { id: "tinted", label: "Teñido de marca" },
  { id: "logo", label: "Con logo al centro" },
];

export function StepPreview({
  templateId,
  business,
  colors,
  onColors,
  label,
  onLabel,
  headline,
  onHeadline,
  subheadline,
  onSubheadline,
  qrStyle,
  onQrStyle,
  paper,
  onPaper,
  scopeMode,
  hasLocalScopes,
  locationScopes,
  activeScope,
  activeLocationId,
  onActiveLocation,
}: {
  templateId: TemplateId;
  business: KitBusiness;
  colors: PosterColors;
  onColors: (c: PosterColors) => void;
  label: string;
  onLabel: (v: string) => void;
  headline: string;
  onHeadline: (v: string) => void;
  subheadline: string;
  onSubheadline: (v: string) => void;
  qrStyle: QrStyle;
  onQrStyle: (s: QrStyle) => void;
  paper: Paper;
  onPaper: (p: Paper) => void;
  scopeMode: "global" | "local";
  hasLocalScopes: boolean;
  locationScopes: KitScope[];
  activeScope: KitScope;
  activeLocationId: string;
  onActiveLocation: (id: string) => void;
}) {
  const perLocal = scopeMode === "local" && hasLocalScopes;
  // Which posters go to the printer: just the active scope, or every local.
  const [printReq, setPrintReq] = useState<null | "current" | "all">(null);
  const printScopes: KitScope[] =
    printReq === "all" ? locationScopes : [activeScope];

  useEffect(() => {
    if (!printReq) return;
    window.print();
    setPrintReq(null);
  }, [printReq]);

  const hasLogo = business.logoPath !== null;

  function poster(scope: KitScope) {
    return (
      <PosterPreview
        templateId={templateId}
        businessName={business.name}
        logoPath={business.logoPath}
        colors={colors}
        qrSvg={scope.qrSvg}
        qrStyle={qrStyle}
        label={label}
        headline={headline}
        subheadline={subheadline}
      />
    );
  }

  return (
    <div className="brand-kit-preview">
      {/* Dynamic page size for the print dialog (A4 / A5), no margins to keep the QR whole. */}
      <style>{`@media print { @page { size: ${
        paper === "a4" ? "A4" : "A5"
      }; margin: 0; } }`}</style>

      <div className="brand-kit-controls no-print">
        <header className="brand-kit-step-intro">
          <p className="eyebrow">Personalización</p>
          <h2>Ajustá tu afiche</h2>
          <p>Los cambios se reflejan al instante en la vista previa.</p>
        </header>
        <div className="brand-kit-brand-note">
          <p>
            {hasLogo
              ? "Usamos el logo, el nombre y los colores guardados en tu marca."
              : `Como todavía no hay un logo, el afiche mostrará el nombre “${business.name}”.`}
          </p>
          <Link href="/backoffice/brand">Editar marca</Link>
        </div>
        {perLocal && (
          <SelectField
            className="brand-kit-field"
            label="Local"
            description="La atribución del QR corresponderá a este local."
            options={locationScopes.map((scope) => ({
              id: scope.locationId ?? "",
              label: scope.label,
            }))}
            selectedKey={activeLocationId}
            onSelectionChange={(key) => onActiveLocation(String(key))}
          />
        )}

        <div className="brand-kit-colors">
          <label className="brand-kit-field">
            Primario
            <input
              type="color"
              value={colors.primary}
              onChange={(e) => onColors({ ...colors, primary: e.target.value })}
            />
          </label>
          <label className="brand-kit-field">
            Complementario
            <input
              type="color"
              value={colors.complementary}
              onChange={(e) =>
                onColors({ ...colors, complementary: e.target.value })
              }
            />
          </label>
          <label className="brand-kit-field">
            Acento
            <input
              type="color"
              value={colors.accent}
              onChange={(e) => onColors({ ...colors, accent: e.target.value })}
            />
          </label>
        </div>

        <TextField
          className="brand-kit-field"
          label="Texto junto al logo"
          value={label}
          maxLength={48}
          onChange={onLabel}
        />
        <TextField
          className="brand-kit-field"
          label="Título"
          value={headline}
          maxLength={80}
          onChange={onHeadline}
        />
        <label className="brand-kit-field">
          Subtítulo
          <textarea
            value={subheadline}
            maxLength={160}
            rows={2}
            onChange={(e) => onSubheadline(e.target.value)}
          />
        </label>

        <fieldset className="brand-kit-field brand-kit-qrstyle">
          <legend>Estilo del QR</legend>
          {QR_STYLES.map((s) => (
            <label key={s.id}>
              <input
                type="radio"
                name="qrstyle"
                checked={qrStyle === s.id}
                disabled={s.id === "logo" && !hasLogo}
                onChange={() => onQrStyle(s.id)}
              />
              {s.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="brand-kit-field brand-kit-paper">
          <legend>Tamaño</legend>
          <label>
            <input
              type="radio"
              name="paper"
              checked={paper === "a4"}
              onChange={() => onPaper("a4")}
            />
            A4
          </label>
          <label>
            <input
              type="radio"
              name="paper"
              checked={paper === "a5"}
              onChange={() => onPaper("a5")}
            />
            A5
          </label>
        </fieldset>

        <p className="brand-kit-url">
          Este QR abre: <code>{activeScope.enrollUrl}</code>
        </p>

        <div className="brand-kit-print-actions">
          <button
            type="button"
            className="brand-kit-print"
            onClick={() => setPrintReq("current")}
          >
            <Printer aria-hidden="true" /> Imprimir
          </button>
          {perLocal && (
            <button
              type="button"
              className="brand-kit-print-all"
              onClick={() => setPrintReq("all")}
            >
              <Printer aria-hidden="true" /> Imprimir todos los locales
            </button>
          )}
        </div>
      </div>

      {/* On-screen: the active poster, scaled to page proportion. */}
      <div className="brand-kit-stage no-print">{poster(activeScope)}</div>

      {/* Print-only: one page per poster to print. Hidden on screen. */}
      <div className="brand-kit-print-area print-only">
        {printScopes.map((s) => (
          <div className="brand-kit-print-page" key={s.key}>
            {poster(s)}
          </div>
        ))}
      </div>
    </div>
  );
}
