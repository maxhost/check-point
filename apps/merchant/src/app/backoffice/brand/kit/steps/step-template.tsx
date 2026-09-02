import { TEMPLATES, type TemplateId } from "../templates/types";

// Step 1 (spec 0041): pick one of the 5 curated templates and, when the business has
// 2+ locales, the QR scope — Global (one poster, no `loc`) or per-local (a poster per
// local, each with its own `?loc=`). With a single local the scope selector is hidden.

export function StepTemplate({
  templateId,
  onTemplate,
  hasLocalScopes,
  scopeMode,
  onScopeMode,
}: {
  templateId: TemplateId;
  onTemplate: (id: TemplateId) => void;
  hasLocalScopes: boolean;
  scopeMode: "global" | "local";
  onScopeMode: (mode: "global" | "local") => void;
}) {
  return (
    <div className="brand-kit-templates">
      <p className="brand-kit-hint">
        Elegí una plantilla. Vas a poder ajustar colores y textos en la vista
        previa.
      </p>
      <ul className="brand-kit-template-grid">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`brand-kit-template ${
                t.id === templateId ? "is-selected" : ""
              }`}
              aria-pressed={t.id === templateId}
              onClick={() => onTemplate(t.id)}
            >
              <span
                className={`brand-kit-thumb thumb-${t.id}`}
                aria-hidden="true"
              >
                <span className="brand-kit-thumb-qr" />
              </span>
              <strong>{t.label}</strong>
              <small>{t.rubro}</small>
            </button>
          </li>
        ))}
      </ul>

      {hasLocalScopes && (
        <fieldset className="brand-kit-scope">
          <legend>Alcance del QR</legend>
          <label>
            <input
              type="radio"
              name="scope"
              checked={scopeMode === "global"}
              onChange={() => onScopeMode("global")}
            />
            <span>
              <strong>Global</strong>
              <small>Un solo afiche para todos los locales.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="scope"
              checked={scopeMode === "local"}
              onChange={() => onScopeMode("local")}
            />
            <span>
              <strong>Por local</strong>
              <small>
                Un afiche por local; cada alta queda atribuida a su local.
              </small>
            </span>
          </label>
        </fieldset>
      )}
    </div>
  );
}
