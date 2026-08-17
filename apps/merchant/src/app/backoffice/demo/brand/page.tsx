"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { read, save, type DemoState } from "../../../demo";
import { ModuleHeader, Toast } from "../../../components/ui";
const valid = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
const timezones = [
  "America/Guayaquil",
  "America/Bogota",
  "America/Lima",
  "America/Panama",
  "America/Argentina/Buenos_Aires",
];
export default function BrandPage() {
  const [data, setData] = useState<DemoState | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setData(read()), []);
  if (!data)
    return (
      <main className="merchant-shell">
        <div className="module-placeholder">
          <h1>Primero completa el onboarding</h1>
          <Link className="button" href="/onboarding">
            Ir al onboarding
          </Link>
        </div>
      </main>
    );
  const color = (key: keyof DemoState["colors"], value: string) =>
    setData({ ...data, colors: { ...data.colors, [key]: value } });
  const submit = () => {
    if (
      !data.businessName ||
      Object.values(data.colors).some((value) => !valid(value))
    )
      return setToast("Revisa el nombre y los colores.");
    save({
      ...data,
      branches: data.applyTimezoneToAllLocations
        ? data.branches.map((branch) => ({
            ...branch,
            timezone: data.timezone,
          }))
        : data.branches,
    });
    setToast("Marca guardada.");
  };
  return (
    <main className="merchant-shell">
      <div className="brand-page">
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <ModuleHeader
          eyebrow="Marca"
          title="La identidad de tu negocio"
          description="Así se verá tu negocio en CheckPass Club."
          closeHref="/backoffice/demo"
        />
        <section
          className="brand-preview"
          style={
            {
              "--primary": data.colors.primary,
              "--complementary": data.colors.complementary,
            } as React.CSSProperties
          }
        >
          <div className="brand-logo">
            {preview ? (
              <img src={preview} alt="Vista previa del logo" />
            ) : data.logo ? (
              "Logo"
            ) : (
              data.businessName.slice(0, 2).toUpperCase()
            )}
          </div>
          <strong>{data.businessName || "Tu negocio"}</strong>
          <span>Vista previa de marca</span>
        </section>
        <section className="panel">
          <label>
            Nombre del negocio
            <input
              value={data.businessName}
              onChange={(e) =>
                setData({ ...data, businessName: e.target.value })
              }
            />
          </label>
          <label>
            Logo
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  setData({ ...data, logo: selected.name });
                  setPreview(URL.createObjectURL(selected));
                }
              }}
            />
          </label>
          {(preview || data.logo) && (
            <button
              className="small-button"
              onClick={() => {
                setPreview(null);
                setData({ ...data, logo: "" });
                if (file.current) file.current.value = "";
              }}
            >
              Quitar logo
            </button>
          )}
          <h2 className="color-heading">Colores</h2>
          {(
            [
              ["primary", "Primario"],
              ["complementary", "Complementario"],
              ["accent", "Acento"],
            ] as const
          ).map(([key, label]) => (
            <label className="color-field" key={key}>
              {label}
              <span>
                <input
                  type="color"
                  value={valid(data.colors[key]) ? data.colors[key] : "#000000"}
                  onChange={(e) => color(key, e.target.value)}
                />
                <input
                  value={data.colors[key]}
                  onChange={(e) => color(key, e.target.value)}
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
                value={data.timezone}
                onChange={(event) =>
                  setData({ ...data, timezone: event.target.value })
                }
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={data.applyTimezoneToAllLocations}
                onChange={(event) =>
                  setData({
                    ...data,
                    applyTimezoneToAllLocations: event.target.checked,
                  })
                }
              />
              <span>Aplicar esta zona horaria a todos los locales</span>
            </label>
            <p className="field-help">
              {data.applyTimezoneToAllLocations
                ? "Al guardar, todos tus locales usarán esta zona horaria."
                : "Cada nuevo local definirá su zona horaria de manera individual."}
            </p>
          </section>
          <button className="button" onClick={submit}>
            Guardar marca
          </button>
        </section>
      </div>
    </main>
  );
}
