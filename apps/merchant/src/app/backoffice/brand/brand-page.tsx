"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MagicWand, Palette, Settings } from "iconoir-react";
import { ModuleHeader, Toast } from "../../components/ui";
import { useIsTouch } from "../catalog/use-is-touch";
import { RegionalFields } from "./regional-fields";
import { BrandIdentity } from "./brand-identity";
import { BrandRecovery } from "./brand-recovery";
import { brandColors, validBrandColor } from "./brand-api";
import { BrandSkeleton } from "./brand-skeleton";
import { useBrandEditor } from "./use-brand-editor";
import { BrandTourProvider, useBrandTour } from "./brand-tour-context";
import { BrandTourController } from "./brand-tour-controller";
export { BrandSkeleton } from "./brand-skeleton";

// Keep the canvas cropper out of the initial bundle (ADR 0041).
const ImageCropper = dynamic(() => import("../../components/image-cropper"), {
  ssr: false,
});
export default function BrandPage({ isOwner = true }: { isOwner?: boolean }) {
  return (
    <BrandTourProvider>
      <BrandEditor isOwner={isOwner} />
    </BrandTourProvider>
  );
}
function BrandEditor({ isOwner }: { isOwner: boolean }) {
  const editor = useBrandEditor();
  const {
    brand,
    draft,
    setDraft,
    saving,
    notice,
    setNotice,
    error,
    setError,
    logo,
    accessDenied,
    needsReview,
    save,
  } = editor;
  const tour = useBrandTour();
  const isTouch = useIsTouch();
  if (!brand || !draft)
    return (
      <>
        <BrandSkeleton error={error} />
        {error && !accessDenied && (
          <div className="merchant-shell brand-load-retry">
            <button
              className="button"
              disabled={editor.loading}
              onClick={() => void editor.load()}
            >
              {editor.loading ? "Cargando…" : "Reintentar"}
            </button>
          </div>
        )}
      </>
    );
  const visibleLogo = logo.preview ?? (!logo.removed ? brand.logoPath : null);
  return (
    <main className="merchant-shell">
      <div className="brand-page">
        <Toast
          message={error ?? notice}
          durationMs={error ? null : 4000}
          kind={error ? "error" : "success"}
          onDismiss={() => {
            setError(null);
            setNotice(null);
          }}
        />
        <ModuleHeader
          eyebrow="Marca"
          title="La identidad de tu negocio"
          description="Así se verá tu negocio en CheckPass Club."
          closeHref="/backoffice"
        />
        <div className="brand-toolbar">
          <div>
            <strong>Personalizá tu presencia</strong>
            <span>Los cambios se aplican en todas las experiencias.</span>
          </div>
          {isOwner && (
            <Link className="button alt" href="/backoffice/brand/kit">
              <MagicWand aria-hidden="true" /> Crear afiche
            </Link>
          )}
        </div>
        <BrandTourController
          isOwner={isOwner}
          blocked={
            saving || Boolean(logo.pending) || logo.isAnalyzing || needsReview
          }
          accessDenied={accessDenied}
          needsReview={needsReview}
          hasLogo={Boolean(visibleLogo)}
          onNotice={setNotice}
        />
        <BrandRecovery editor={editor} />
        <div className="brand-layout">
          <section
            className="brand-preview"
            data-tour="brand-preview"
            aria-label="Vista previa de marca"
            style={
              {
                "--primary": draft.brandPrimaryColor,
                "--complementary": draft.brandComplementaryColor,
              } as React.CSSProperties
            }
          >
            <p>Vista previa</p>
            <div className="brand-preview-content">
              <div className="brand-logo">
                {visibleLogo ? (
                  <img src={visibleLogo} alt={`Logo de ${draft.name}`} />
                ) : (
                  draft.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <strong>{draft.name || "Tu negocio"}</strong>
                <span>Tu marca en CheckPass Club</span>
              </div>
            </div>
            <div className="brand-preview-swatches" aria-hidden="true">
              {brandColors.map(([key]) => (
                <i key={key} style={{ background: draft[key] }} />
              ))}
            </div>
          </section>
          <div className="brand-editor">
            <BrandIdentity
              draft={draft}
              setDraft={setDraft}
              logo={logo}
              visibleLogo={visibleLogo}
              isTouch={isTouch}
              disabled={saving || accessDenied}
              setError={setError}
            />
            <section
              className="brand-section"
              aria-labelledby="colors-title"
              data-tour="brand-colors"
            >
              <header className="brand-section-head">
                <span aria-hidden="true">
                  <Palette />
                </span>
                <div>
                  <h2 id="colors-title">Paleta de colores</h2>
                  <p>Definí los tonos que identifican a tu negocio.</p>
                </div>
              </header>
              <div className="brand-colors-grid">
                {brandColors.map(([key, label]) => (
                  <label
                    className="brand-color-field"
                    key={key}
                    data-tour={`brand-${key === "brandPrimaryColor" ? "primary" : key === "brandComplementaryColor" ? "complementary" : "accent"}`}
                  >
                    <span>{label}</span>
                    <div>
                      <input
                        aria-label={`Elegir color ${label.toLowerCase()}`}
                        type="color"
                        disabled={saving || accessDenied}
                        value={
                          validBrandColor(draft[key]) ? draft[key] : "#000000"
                        }
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [key]: event.target.value.toUpperCase(),
                          })
                        }
                      />
                      <input
                        value={draft[key]}
                        maxLength={7}
                        disabled={saving || accessDenied}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                        aria-label={`Código hexadecimal ${label.toLowerCase()}`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section
              className="brand-section"
              aria-labelledby="regional-title"
              data-tour="brand-regional"
            >
              <header className="brand-section-head">
                <span aria-hidden="true">
                  <Settings />
                </span>
                <div>
                  <h2 id="regional-title">Configuración regional</h2>
                  <p>Controlá cómo se interpretan horarios y precios.</p>
                </div>
              </header>
              <RegionalFields
                disabled={saving || accessDenied}
                timezone={draft.timezone}
                currencyCode={draft.currencyCode}
                onTimezoneChange={(timezone) =>
                  setDraft({ ...draft, timezone })
                }
                onCurrencyChange={(currencyCode) =>
                  setDraft({ ...draft, currencyCode })
                }
              />
            </section>

            <div className="brand-save-bar" data-tour="brand-save">
              <div>
                <strong>¿Todo listo?</strong>
                <span>Revisá la vista previa antes de guardar.</span>
              </div>
              <button
                className="button"
                type="button"
                disabled={
                  saving ||
                  Boolean(logo.pending) ||
                  logo.isAnalyzing ||
                  accessDenied ||
                  needsReview
                }
                onClick={() => void save()}
              >
                {saving ? "Guardando…" : "Guardar marca"}
              </button>
            </div>
          </div>
        </div>
        {logo.pending && logo.pendingSrc && (
          <ImageCropper
            src={logo.pendingSrc}
            surface="logo"
            onDone={(blob, type) => {
              logo.applyCrop(blob, type);
              tour.notify({ type: "selected" });
            }}
            onCancel={() => {
              logo.cancelCrop();
              tour.notify({ type: "cancel-crop" });
            }}
          />
        )}
      </div>
    </main>
  );
}
