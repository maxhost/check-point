"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ModuleHeader, Toast } from "../../components/ui";

type Kind = "points" | "stamps";
type Template = {
  id: string;
  title: string;
  category: string;
  templateMarkdown: string;
  version: string;
};
type Program = {
  activeVersion: {
    kind: string;
    configuration: Record<string, unknown>;
    effectiveFrom: string;
  } | null;
};

export default function LoyaltyProgramPage() {
  const [kind, setKind] = useState<Kind>("points");
  const [singular, setSingular] = useState("Punto");
  const [plural, setPlural] = useState("Puntos");
  const [stampName, setStampName] = useState("Sello");
  const [target, setTarget] = useState(10);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<
    Record<string, string>
  >({});
  const [customClause, setCustomClause] = useState("");
  const [earningEndsAt, setEarningEndsAt] = useState("");
  const [redemptionEndsAt, setRedemptionEndsAt] = useState("");
  const [program, setProgram] = useState<Program | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [programResponse, templatesResponse] = await Promise.all([
      fetch("/api/loyalty-program"),
      fetch("/api/loyalty-terms/templates"),
    ]);
    if (programResponse.ok)
      setProgram((await programResponse.json()) as Program);
    if (templatesResponse.ok)
      setTemplates(
        ((await templatesResponse.json()) as { templates: Template[] })
          .templates,
      );
  }
  useEffect(() => {
    void load();
  }, []);

  async function publish() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/loyalty-program", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        configuration:
          kind === "points"
            ? { unitSingular: singular, unitPlural: plural }
            : { unitName: stampName, target },
        clauses: [
          ...Object.entries(selectedTemplates).map(([templateId, text]) => ({
            templateId,
            text,
          })),
          ...(customClause.trim() ? [{ text: customClause }] : []),
        ],
        earningEndsAt: earningEndsAt || undefined,
        redemptionEndsAt: redemptionEndsAt || undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setSaving(false);
    if (!response.ok) {
      setError(payload?.error ?? "No pudimos publicar el programa.");
      return;
    }
    setNotice("Programa publicado. Esta versión ya queda protegida.");
    await load();
  }

  const active = program?.activeVersion;
  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-page">
        <Toast message={notice} onDismiss={() => setNotice(null)} />
        <ModuleHeader
          eyebrow="Programa de fidelización"
          title={active ? "Publica una nueva versión" : "Premia a tus clientes"}
          description={
            active
              ? `Versión ${active.kind === "points" ? "de Puntos" : "de Sellos"} activa desde ${new Date(active.effectiveFrom).toLocaleDateString("es-EC")}. Publicar no modifica su historia.`
              : "Elige una única forma de acumular beneficios en tu negocio."
          }
          closeHref="/backoffice"
        />
        <section className="panel loyalty-panel">
          <h2>Modalidad</h2>
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
            </>
          )}
          {active && (
            <div className="transition-fields">
              <h3>Cierre de la versión actual</h3>
              <p>
                Los nuevos beneficios entrarán en la nueva versión. Define hasta
                cuándo deja de acumular y hasta cuándo puede canjearse la
                actual.
              </p>
              <label>
                Fin de acumulación
                <input
                  type="datetime-local"
                  value={earningEndsAt}
                  onChange={(event) => setEarningEndsAt(event.target.value)}
                />
              </label>
              <label>
                Fin de canje
                <input
                  type="datetime-local"
                  value={redemptionEndsAt}
                  onChange={(event) => setRedemptionEndsAt(event.target.value)}
                />
              </label>
            </div>
          )}
        </section>
        <section className="panel loyalty-panel">
          <h2>Términos y condiciones</h2>
          <p>
            Selecciona cláusulas de la biblioteca y edita o añade texto propio.
            Las plantillas son borradores editoriales y deben revisarse para tu
            jurisdicción.
          </p>
          {templates.map((template) => (
            <Fragment key={template.id}>
              <label className="terms-template">
                <input
                  type="checkbox"
                  checked={template.id in selectedTemplates}
                  onChange={() =>
                    setSelectedTemplates((current) =>
                      template.id in current
                        ? Object.fromEntries(
                            Object.entries(current).filter(
                              ([id]) => id !== template.id,
                            ),
                          )
                        : {
                            ...current,
                            [template.id]: template.templateMarkdown,
                          },
                    )
                  }
                />
                <span>
                  <strong>{template.title}</strong>
                  <small>{template.templateMarkdown}</small>
                </span>
              </label>
              {template.id in selectedTemplates && (
                <label className="terms-clause-editor">
                  Editar copia de “{template.title}”
                  <textarea
                    value={selectedTemplates[template.id]}
                    onChange={(event) =>
                      setSelectedTemplates((current) => ({
                        ...current,
                        [template.id]: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </Fragment>
          ))}
          <label>
            Cláusula adicional
            <textarea
              value={customClause}
              onChange={(event) => setCustomClause(event.target.value)}
              placeholder="Añade una condición específica de tu negocio"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="button"
            disabled={saving}
            onClick={() => void publish()}
          >
            {saving
              ? "Publicando…"
              : active
                ? "Publicar nueva versión"
                : "Publicar programa"}
          </button>
        </section>
        <p className="field-help">
          <Link href="/backoffice">Volver al Backoffice</Link>
        </p>
      </div>
    </main>
  );
}
