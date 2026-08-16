"use client";

import { useEffect, useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { useIsTouch } from "../catalog/use-is-touch";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  ACCEPTED_IMAGE_LABEL,
} from "../../../lib/image-formats";
import { RegionalFields } from "./regional-fields";
import { useBrandLogo } from "./use-brand-logo";

type Brand = {
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  brandRevision: number;
  logoVersion: number;
  logoPath: string | null;
};

const colors = [
  ["brandPrimaryColor", "Primario"],
  ["brandComplementaryColor", "Complementario"],
  ["brandAccentColor", "Acento"],
] as const;
const validColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [draft, setDraft] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logo = useBrandLogo();
  const isTouch = useIsTouch();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const response = await fetch("/api/brand");
      const payload = (await response.json().catch(() => null)) as
        | Brand
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("id" in payload)) {
        throw new Error(
          (payload as { error?: string } | null)?.error ??
            "No pudimos cargar la marca.",
        );
      }
      setBrand(payload);
      setDraft(payload);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos cargar la marca.",
      );
    }
  }

  async function save() {
    if (!brand || !draft) return;
    if (
      !draft.name.trim() ||
      !colors.every(([key]) => validColor(draft[key]))
    ) {
      setError("Revisa el nombre y los colores de marca.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const uploadId = await logo.upload();
      const response = await fetch("/api/brand", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          timezone: draft.timezone,
          currencyCode: draft.currencyCode,
          brandPrimaryColor: draft.brandPrimaryColor,
          brandComplementaryColor: draft.brandComplementaryColor,
          brandAccentColor: draft.brandAccentColor,
          revision: brand.brandRevision,
          logoAction: logo.action,
          ...(uploadId ? { uploadId } : {}),
        }),
      });
      const saved = (await response.json().catch(() => null)) as
        | Brand
        | { error?: string }
        | null;
      if (!response.ok || !saved || !("id" in saved)) {
        throw new Error(
          (saved as { error?: string } | null)?.error ??
            "No pudimos guardar la marca.",
        );
      }
      setBrand(saved);
      setDraft(saved);
      logo.reset();
      setNotice("Marca guardada.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos guardar la marca.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!brand || !draft) return <BrandSkeleton error={error} />;
  const visibleLogo = logo.preview ?? (!logo.removed ? brand.logoPath : null);
  return (
    <main className="merchant-shell">
      <div className="brand-page">
        <Toast
          message={error ?? notice}
          kind={error ? "error" : "success"}
          onDismiss={() => {
            setError(null);
            setNotice(null);
          }}
        />
        <ModuleHeader
          eyebrow="Marca"
          title="La identidad de tu negocio"
          description="Así se verá tu negocio en Mi Pasaporte."
          closeHref="/backoffice"
        />
        <section
          className="brand-preview"
          style={
            {
              "--primary": draft.brandPrimaryColor,
              "--complementary": draft.brandComplementaryColor,
            } as React.CSSProperties
          }
        >
          <div className="brand-logo">
            {visibleLogo ? (
              <img src={visibleLogo} alt={`Logo de ${draft.name}`} />
            ) : (
              draft.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <strong>{draft.name || "Tu negocio"}</strong>
          <span>Vista previa de marca</span>
        </section>
        <section className="panel brand-form">
          <label>
            Nombre del negocio
            <input
              value={draft.name}
              maxLength={120}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label>
            Logo
            <input
              ref={logo.fileInput}
              type="file"
              accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
              onChange={(event) =>
                logo.choose(event.target.files?.[0], setError)
              }
            />
          </label>
          <p className="field-help">
            {ACCEPTED_IMAGE_LABEL} · máximo 5 MB · se ajusta a 2048 px.
          </p>
          {visibleLogo && (
            <button
              type="button"
              className="small-button"
              onClick={logo.remove}
            >
              Quitar logo
            </button>
          )}
          <h2 className="color-heading">Colores</h2>
          {colors.map(([key, label]) => (
            <label className="color-field" key={key}>
              {label}
              <span>
                <input
                  type="color"
                  value={validColor(draft[key]) ? draft[key] : "#000000"}
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
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                  aria-label={`Código hexadecimal ${label.toLowerCase()}`}
                />
              </span>
            </label>
          ))}
          <RegionalFields
            timezone={draft.timezone}
            currencyCode={draft.currencyCode}
            onTimezoneChange={(timezone) => setDraft({ ...draft, timezone })}
            onCurrencyChange={(currencyCode) =>
              setDraft({ ...draft, currencyCode })
            }
          />
          <button
            className="button"
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Guardando…" : "Guardar marca"}
          </button>
        </section>
      </div>
    </main>
  );
}

function BrandSkeleton({ error }: { error: string | null }) {
  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-skeleton" aria-busy="true">
        {error ? (
          <p className="form-error">{error}</p>
        ) : (
          <>
            <span className="skeleton-line skeleton-eyebrow" />
            <span className="skeleton-line skeleton-title" />
            <span className="skeleton-line skeleton-description" />
            <section className="panel skeleton-card" />
          </>
        )}
      </div>
    </main>
  );
}
