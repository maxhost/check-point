import { Camera, MediaImage, Palette } from "iconoir-react";
import { TextField } from "../../../ui";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  ACCEPTED_IMAGE_LABEL,
} from "../../../lib/image-formats";
import type { Brand } from "./brand-api";
import type { useBrandLogo } from "./use-brand-logo";
import { useBrandTour } from "./brand-tour-context";

export function BrandIdentity({
  draft,
  setDraft,
  logo,
  visibleLogo,
  isTouch,
  disabled,
  setError,
}: {
  draft: Brand;
  setDraft: (brand: Brand) => void;
  logo: ReturnType<typeof useBrandLogo>;
  visibleLogo: string | null;
  isTouch: boolean;
  disabled: boolean;
  setError: (message: string) => void;
}) {
  const tour = useBrandTour();
  async function choose(file: File | undefined) {
    const notify = tour.ticket();
    try {
      const result = await logo.choose(file, setError);
      if (result === "crop") notify({ type: "cropping" });
      if (result === "selected") notify({ type: "selected" });
    } catch {
      setError("No pudimos preparar la imagen. Intentá nuevamente.");
    }
  }
  return (
    <div className="brand-identity-group" data-tour="brand-identity-logo">
      <section
        className="brand-section"
        aria-labelledby="identity-title"
        data-tour="brand-name"
      >
        <header className="brand-section-head">
          <span aria-hidden="true">
            <Palette />
          </span>
          <div>
            <h2 id="identity-title">Identidad</h2>
            <p>El nombre principal con el que te verán tus clientes.</p>
          </div>
        </header>
        <TextField
          className="brand-field"
          isDisabled={disabled}
          label="Nombre del negocio"
          value={draft.name}
          maxLength={120}
          placeholder="Ej. Café Milca"
          onChange={(name) => setDraft({ ...draft, name })}
          isRequired
        />
      </section>

      <section
        className="brand-section"
        aria-labelledby="logo-title"
        data-tour="brand-logo"
      >
        <header className="brand-section-head">
          <span aria-hidden="true">
            <MediaImage />
          </span>
          <div>
            <h2 id="logo-title">Logo</h2>
            <p>Usá una imagen cuadrada, clara y fácil de reconocer.</p>
          </div>
        </header>
        <div className="brand-logo-editor">
          <div className="brand-logo-thumb" aria-hidden="true">
            {visibleLogo ? (
              <img src={visibleLogo} alt="" />
            ) : (
              draft.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="brand-logo-actions">
            <button
              className="small-button"
              type="button"
              disabled={disabled || logo.isAnalyzing}
              onClick={() => logo.fileInput.current?.click()}
            >
              <MediaImage aria-hidden="true" />
              {visibleLogo ? "Cambiar logo" : "Elegir logo"}
            </button>
            {isTouch && (
              <button
                className="small-button"
                type="button"
                disabled={disabled || logo.isAnalyzing}
                onClick={() => logo.cameraInput.current?.click()}
              >
                <Camera aria-hidden="true" /> Tomar foto
              </button>
            )}
            {visibleLogo && (
              <button
                type="button"
                className="brand-remove-logo"
                data-tour="brand-remove"
                disabled={disabled}
                onClick={() => {
                  logo.remove();
                  tour.notify({ type: "removed" });
                }}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
        <div className="sr-only">
          <label htmlFor="brand-logo-file">Seleccionar archivo de logo</label>
        </div>
        <input
          className="sr-only"
          id="brand-logo-file"
          ref={logo.fileInput}
          type="file"
          accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
          disabled={disabled || logo.isAnalyzing}
          onChange={(event) => {
            void choose(event.target.files?.[0]);
          }}
        />
        {isTouch && (
          <input
            className="sr-only"
            ref={logo.cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled || logo.isAnalyzing}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
            }}
          />
        )}
        <p className="brand-file-help">
          {logo.isAnalyzing
            ? "Preparando imagen…"
            : `${ACCEPTED_IMAGE_LABEL} · máximo 5 MB · se ajusta a 2048 px.`}
        </p>
      </section>
    </div>
  );
}
