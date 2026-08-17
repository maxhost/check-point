"use client";

import { useEffect, useState } from "react";
import { PosterPreview } from "../poster-preview";
import type { QrStyle } from "../qr-render";
import type { PosterColors, TemplateId } from "../templates/types";
import type { Paper } from "../brand-kit-wizard";
import type { KitBusiness, KitScope } from "../../../../../server/brand-kit/data";

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
        {perLocal && (
          <label className="brand-kit-field">
            Local
            <select
              value={activeLocationId}
              onChange={(e) => onActiveLocation(e.target.value)}
            >
              {locationScopes.map((s) => (
                <option key={s.key} value={s.locationId ?? ""}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
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

        <label className="brand-kit-field">
          Título
          <input
            type="text"
            value={headline}
            maxLength={80}
            onChange={(e) => onHeadline(e.target.value)}
          />
        </label>
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
            Imprimir
          </button>
          {perLocal && (
            <button
              type="button"
              className="brand-kit-print-all"
              onClick={() => setPrintReq("all")}
            >
              Imprimir todos los locales
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
