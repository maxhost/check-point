"use client";

import { useEffect, useRef, useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";

type Brand = {
  id: string;
  name: string;
  timezone: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  brandRevision: number;
  logoVersion: number;
  logoPath: string | null;
};

const timezones = [
  "America/Argentina/Buenos_Aires",
  "America/Asuncion",
  "America/Bogota",
  "America/Guayaquil",
  "America/Lima",
  "America/Mexico_City",
  "America/Montevideo",
  "America/Santiago",
  "America/Sao_Paulo",
];
const colors = [
  ["brandPrimaryColor", "Primario"],
  ["brandComplementaryColor", "Complementario"],
  ["brandAccentColor", "Acento"],
] as const;
const validColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [draft, setDraft] = useState<Brand | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removedLogo, setRemovedLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

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

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError("El logo debe ser PNG, JPEG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El logo debe pesar como máximo 5 MB.");
      return;
    }
    setError(null);
    setSelectedLogo(file);
    setRemovedLogo(false);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function removeLogo() {
    setSelectedLogo(null);
    setRemovedLogo(true);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  async function uploadSelectedLogo() {
    if (!selectedLogo) return null;
    const prepared = await fetch("/api/brand/logo-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: selectedLogo.type,
        byteSize: selectedLogo.size,
      }),
    });
    const preparation = (await prepared.json().catch(() => null)) as {
      uploadId?: string;
      uploadUrl?: string;
      error?: string;
    } | null;
    if (!prepared.ok || !preparation?.uploadId || !preparation.uploadUrl) {
      throw new Error(
        preparation?.error ?? "No pudimos preparar la carga del logo.",
      );
    }
    const uploaded = await fetch(preparation.uploadUrl, {
      method: "PUT",
      headers: { "content-type": selectedLogo.type },
      body: selectedLogo,
    });
    if (!uploaded.ok)
      throw new Error("No pudimos cargar el logo. Intenta nuevamente.");
    return preparation.uploadId;
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
      const logoAction = selectedLogo
        ? "replace"
        : removedLogo
          ? "remove"
          : "keep";
      const uploadId = await uploadSelectedLogo();
      const response = await fetch("/api/brand", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          timezone: draft.timezone,
          brandPrimaryColor: draft.brandPrimaryColor,
          brandComplementaryColor: draft.brandComplementaryColor,
          brandAccentColor: draft.brandAccentColor,
          revision: brand.brandRevision,
          logoAction,
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
      setSelectedLogo(null);
      setRemovedLogo(false);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      if (fileInput.current) fileInput.current.value = "";
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
  const visibleLogo = previewUrl ?? (!removedLogo ? brand.logoPath : null);
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
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => chooseLogo(event.target.files?.[0])}
            />
          </label>
          <p className="field-help">
            PNG, JPEG o WebP · máximo 5 MB · hasta 2048 × 2048 px.
          </p>
          {visibleLogo && (
            <button type="button" className="small-button" onClick={removeLogo}>
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
          <section
            className="timezone-settings"
            aria-labelledby="timezone-title"
          >
            <h2 id="timezone-title" className="color-heading">
              Zona horaria
            </h2>
            <label>
              Zona horaria del negocio
              <select
                value={draft.timezone}
                onChange={(event) =>
                  setDraft({ ...draft, timezone: event.target.value })
                }
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-help">
              Las fechas y horarios de tus programas y campañas se interpretan
              en esta zona.
            </p>
          </section>
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
