import { useRef } from "react";
import { AutoGrowTextarea } from "./ui";
import type { LoyaltyVm } from "./use-loyalty-program";

export function ProgramEditor({ vm }: { vm: LoyaltyVm }) {
  const {
    program,
    kind,
    singular,
    plural,
    stampName,
    target,
    terms,
    templates,
    saving,
    error,
    stamp,
    setKind,
    setSingular,
    setPlural,
    setStampName,
    setTarget,
    setTerms,
    insertTemplate,
    setErrorToast,
    save,
  } = vm;
  const stampInput = useRef<HTMLInputElement>(null);
  const stampPreview =
    stamp.preview ??
    (!stamp.removed ? (program?.stampImagePath ?? null) : null);
  return (
    <>
      <section className="panel loyalty-panel">
        <h2>{program ? "Editar programa" : "Modalidad"}</h2>
        {!program && (
          <div className="loyalty-types" role="radiogroup">
            {(["points", "stamps"] as const).map((value) => (
              <label
                className={`plan ${kind === value ? "selected" : ""}`}
                key={value}
              >
                <input
                  className="sr-only"
                  type="radio"
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                <span className="loyalty-choice-content">
                  <strong>{value === "points" ? "Puntos" : "Sellos"}</strong>
                  <span>
                    {value === "points"
                      ? "Una unidad flexible para premios."
                      : "Una tarjeta que se completa con visitas."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        {kind === "points" ? (
          <>
            <label>
              Nombre singular
              <input
                value={singular}
                onChange={(event) => setSingular(event.target.value)}
              />
            </label>
            <label>
              Nombre plural
              <input
                value={plural}
                onChange={(event) => setPlural(event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Nombre del sello
              <input
                value={stampName}
                onChange={(event) => setStampName(event.target.value)}
              />
            </label>
            <label>
              Sellos para completar
              <input
                type="number"
                min="2"
                max="50"
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
              />
            </label>
            <div className="stamp-image-field">
              <strong>Diseño del sello</strong>
              {stampPreview && (
                <div className="stamp-image-row">
                  <img
                    className="stamp-image-preview"
                    src={stampPreview}
                    alt="Vista previa del sello"
                  />
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      stamp.remove();
                      if (stampInput.current) stampInput.current.value = "";
                    }}
                  >
                    Quitar
                  </button>
                </div>
              )}
              <input
                ref={stampInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  stamp.choose(event.target.files?.[0], setErrorToast)
                }
              />
              <p className="field-help">
                PNG, JPEG o WebP · máximo 5 MB · hasta 2048 × 2048 px. Se aplica
                al guardar.
              </p>
            </div>
          </>
        )}
      </section>
      <section className="panel loyalty-panel">
        <h2>Términos y condiciones</h2>
        <p>
          Son informativos. Inserta una plantilla como punto de partida y edita
          el texto antes de guardar.
        </p>
        <div className="template-actions">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="terms-template-insert"
              onClick={() => insertTemplate(template)}
            >
              + {template.title}
            </button>
          ))}
        </div>
        <label>
          Texto de términos
          <AutoGrowTextarea
            className="loyalty-terms-input"
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="Escribe los términos o inserta una plantilla"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          className="button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving
            ? "Guardando…"
            : program
              ? "Guardar cambios"
              : "Activar programa"}
        </button>
      </section>
    </>
  );
}
