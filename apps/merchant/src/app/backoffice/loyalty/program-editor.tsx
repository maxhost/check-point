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
    selectedTemplateIds,
    saving,
    error,
    setKind,
    setSingular,
    setPlural,
    setStampName,
    setTarget,
    setTerms,
    setSelectedTemplateIds,
    save,
  } = vm;
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
              <p className="field-help">
                La carga se habilitará con R2. El modelo ya reserva la
                referencia segura de imagen.
              </p>
            </div>
          </>
        )}
      </section>
      <section className="panel loyalty-panel">
        <h2>Términos y condiciones</h2>
        <p>
          Son informativos. Puedes partir de una plantilla y editar el texto
          antes de guardar.
        </p>
        <div className="template-actions">
          {templates.map((template) => (
            <label key={template.id} className="terms-template">
              <input
                type="checkbox"
                checked={selectedTemplateIds.includes(template.id)}
                onChange={() =>
                  setSelectedTemplateIds((current) =>
                    current.includes(template.id)
                      ? current.filter((id) => id !== template.id)
                      : [...current, template.id],
                  )
                }
              />
              <span>{template.title}</span>
            </label>
          ))}
        </div>
        <label>
          Texto de términos
          <textarea
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="Escribe o añade una plantilla"
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
