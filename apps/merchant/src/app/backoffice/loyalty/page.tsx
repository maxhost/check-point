"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/confirm-dialog";
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
  activeTerms: { renderedClause: string }[];
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
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [redemptionEndsAt, setRedemptionEndsAt] = useState("");
  const [editingVersion, setEditingVersion] = useState(false);
  const [program, setProgram] = useState<Program | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [programResponse, templatesResponse] = await Promise.all([
        fetch("/api/loyalty-program"),
        fetch("/api/loyalty-terms/templates"),
      ]);
      if (!programResponse.ok || !templatesResponse.ok) {
        throw new Error("No pudimos cargar el programa.");
      }
      const nextProgram = (await programResponse.json()) as Program;
      setProgram(nextProgram);
      if (nextProgram.activeVersion && !editingVersion) {
        const config = nextProgram.activeVersion.configuration;
        if (nextProgram.activeVersion.kind === "points") {
          setKind("points");
          setSingular(String(config.unitSingular ?? "Punto"));
          setPlural(String(config.unitPlural ?? "Puntos"));
        } else if (nextProgram.activeVersion.kind === "stamps") {
          setKind("stamps");
          setStampName(String(config.unitName ?? "Sello"));
          setTarget(Number(config.target ?? 10));
        }
      }
      setTemplates(
        ((await templatesResponse.json()) as { templates: Template[] })
          .templates,
      );
    } catch {
      setError("No pudimos cargar tu programa. Intenta recargar la página.");
    } finally {
      setLoading(false);
    }
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
        effectiveFrom: effectiveFrom || undefined,
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
    setEditingVersion(false);
    await load();
  }

  const active = program?.activeVersion;
  if (loading) return <LoyaltySkeleton />;
  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-page">
        <Toast message={notice} onDismiss={() => setNotice(null)} />
        <ModuleHeader
          eyebrow="Programa de fidelización"
          title={
            active && !editingVersion
              ? "Tu programa está activo"
              : active
                ? "Crear nueva versión"
                : "Premia a tus clientes"
          }
          description={
            active
              ? `Versión ${active.kind === "points" ? "de Puntos" : "de Sellos"} activa desde ${new Date(active.effectiveFrom).toLocaleDateString("es-EC")}. Publicar no modifica su historia.`
              : "Elige una única forma de acumular beneficios en tu negocio."
          }
          closeHref="/backoffice"
          onClose={editingVersion ? () => setConfirmDiscard(true) : undefined}
        />
        {active && !editingVersion ? (
          <>
            <section className="panel loyalty-panel">
              <h2>Versión activa</h2>
              <p>
                Programa de {active.kind === "points" ? "Puntos" : "Sellos"}.
                Sus términos publicados quedan disponibles para las personas que
                lo usan.
              </p>
              <button
                className="button"
                onClick={() => setEditingVersion(true)}
              >
                Crear nueva versión
              </button>
            </section>
            <section className="panel loyalty-panel">
              <h2>Términos publicados</h2>
              {program?.activeTerms.map((term, index) => (
                <p key={index} className="published-term">
                  {term.renderedClause}
                </p>
              ))}
            </section>
          </>
        ) : (
          <>
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
                      <strong>
                        {value === "points" ? "Puntos" : "Sellos"}
                      </strong>
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
                      onChange={(event) =>
                        setTarget(Number(event.target.value))
                      }
                    />
                  </label>
                </>
              )}
              {active && (
                <div className="transition-fields">
                  <h3>Vigencia de la nueva versión</h3>
                  <p>
                    Desde la fecha de entrada en vigencia, las nuevas
                    acumulaciones irán a esta versión. La anterior deja de
                    acumular ese día y sus beneficios podrán canjearse hasta la
                    fecha que indiques.
                  </p>
                  <label>
                    Entrada en vigencia
                    <input
                      type="datetime-local"
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    Fin de canje
                    <input
                      type="datetime-local"
                      value={redemptionEndsAt}
                      onChange={(event) =>
                        setRedemptionEndsAt(event.target.value)
                      }
                    />
                  </label>
                </div>
              )}
            </section>
            <section className="panel loyalty-panel">
              <h2>Términos y condiciones</h2>
              <p>
                Selecciona cláusulas de la biblioteca y edita o añade texto
                propio. Las plantillas son borradores editoriales y deben
                revisarse para tu jurisdicción.
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
          </>
        )}
        <ConfirmDialog
          open={confirmDiscard}
          title="¿Salir sin publicar esta versión?"
          description="Los cambios que hiciste no se aplicarán. Tu programa activo seguirá igual."
          confirmLabel="Salir sin guardar"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            setEditingVersion(false);
          }}
        />
      </div>
    </main>
  );
}

function LoyaltySkeleton() {
  return (
    <main
      className="merchant-shell"
      aria-busy="true"
      aria-label="Cargando programa de fidelización"
    >
      <div className="brand-page loyalty-page loyalty-skeleton">
        <span className="skeleton-line skeleton-eyebrow" />
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-description" />
        <section className="panel loyalty-panel">
          <span className="skeleton-line skeleton-section-title" />
          <span className="skeleton-line skeleton-card" />
          <span className="skeleton-line skeleton-card" />
        </section>
      </div>
    </main>
  );
}
