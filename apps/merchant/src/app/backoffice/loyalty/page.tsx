"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ModuleHeader, Toast } from "../../components/ui";

type Kind = "points" | "stamps";
type Template = { id: string; title: string; templateMarkdown: string };
type Program = {
  id: string;
  kind: Kind;
  configuration: Record<string, unknown>;
  status: "active" | "closing" | "inactive";
  activatedAt: string;
  earningEndsAt: string | null;
  redemptionEndsAt: string | null;
  termsMarkdown: string;
};
type Context = {
  business: { timezone: string };
  program: Program | null;
};

export default function LoyaltyProgramPage() {
  const [context, setContext] = useState<Context | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [kind, setKind] = useState<Kind>("points");
  const [singular, setSingular] = useState("Punto");
  const [plural, setPlural] = useState("Puntos");
  const [stampName, setStampName] = useState("Sello");
  const [target, setTarget] = useState(10);
  const [terms, setTerms] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [earningEndsAt, setEarningEndsAt] = useState("");
  const [redemptionEndsAt, setRedemptionEndsAt] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const program = context?.program ?? null;
  const timezone = context?.business.timezone ?? "America/Guayaquil";

  function populate(next: Context) {
    if (!next.program) {
      setSelectedTemplateIds([]);
      return;
    }
    setKind(next.program.kind);
    setTerms(next.program.termsMarkdown);
    setSelectedTemplateIds([]);
    if (next.program.kind === "points") {
      setSingular(String(next.program.configuration.unitSingular ?? "Punto"));
      setPlural(String(next.program.configuration.unitPlural ?? "Puntos"));
    } else {
      setStampName(String(next.program.configuration.unitName ?? "Sello"));
      setTarget(Number(next.program.configuration.target ?? 10));
    }
  }

  async function load() {
    try {
      const [programResponse, templateResponse] = await Promise.all([
        fetch("/api/loyalty-program"),
        fetch("/api/loyalty-terms/templates"),
      ]);
      if (!programResponse.ok || !templateResponse.ok) throw new Error();
      const next = (await programResponse.json()) as Context;
      setContext(next);
      populate(next);
      setTemplates(
        ((await templateResponse.json()) as { templates: Template[] })
          .templates,
      );
    } catch {
      setError("No pudimos cargar tu programa. Intenta recargar la página.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/loyalty-program", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          configuration:
            kind === "points"
              ? { unitSingular: singular, unitPlural: plural }
              : { unitName: stampName, target },
          clauses: [
            ...selectedTemplateIds.map((templateId) => ({ templateId })),
            ...(terms.trim() ? [{ text: terms }] : []),
          ],
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "No pudimos guardar el programa.");
      setEditing(false);
      setNotice(program ? "Programa actualizado." : "Programa activado.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos guardar el programa.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function closeProgram() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/loyalty-program", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ earningEndsAt, redemptionEndsAt }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "No pudimos iniciar el cierre.");
      setClosing(false);
      setConfirmClose(false);
      setNotice("El cierre del programa fue programado.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos iniciar el cierre.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!context) return <LoyaltySkeleton />;
  const isClosing = program?.status === "closing";
  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-page">
        <Toast message={notice} onDismiss={() => setNotice(null)} />
        <ModuleHeader
          eyebrow="Programa de fidelización"
          title={
            isClosing
              ? "Tu programa está en cierre"
              : program && !editing
                ? "Tu programa está activo"
                : "Premia a tus clientes"
          }
          description={
            isClosing
              ? `No se podrá modificar. Los horarios se muestran en ${timezone}.`
              : "Elige una única forma de acumular beneficios en tu negocio."
          }
          closeHref="/backoffice"
          onClose={editing ? () => setConfirmDiscard(true) : undefined}
        />
        {program && !editing ? (
          <>
            <section className="panel loyalty-panel">
              <h2>
                {program.kind === "points"
                  ? "Programa de puntos"
                  : "Programa de sellos"}
              </h2>
              <p>
                {isClosing
                  ? "El programa conserva los beneficios ya otorgados hasta su fecha final de canje."
                  : "Puedes actualizar su configuración y sus términos mientras permanezca activo."}
              </p>
              {isClosing ? (
                <dl className="closing-summary">
                  <div>
                    <dt>Fin de acumulación</dt>
                    <dd>{formatDate(program.earningEndsAt, timezone)}</dd>
                  </div>
                  <div>
                    <dt>Canje hasta</dt>
                    <dd>{formatDate(program.redemptionEndsAt, timezone)}</dd>
                  </div>
                </dl>
              ) : (
                <>
                  <button className="button" onClick={() => setEditing(true)}>
                    Editar programa
                  </button>
                  <button
                    className="text-button danger-text"
                    type="button"
                    onClick={() => setClosing(!closing)}
                  >
                    Cerrar programa
                  </button>
                  {closing && (
                    <div className="transition-fields">
                      <h3>Cierre del programa</h3>
                      <p>
                        Desde el fin de acumulación no se otorgarán más
                        beneficios. Las personas podrán canjear los ya obtenidos
                        hasta la fecha final.
                      </p>
                      <label>
                        Fin de acumulación
                        <input
                          type="datetime-local"
                          value={earningEndsAt}
                          onChange={(event) =>
                            setEarningEndsAt(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Fecha final de canje
                        <input
                          type="datetime-local"
                          value={redemptionEndsAt}
                          onChange={(event) =>
                            setRedemptionEndsAt(event.target.value)
                          }
                        />
                      </label>
                      <p className="field-help">Zona horaria: {timezone}.</p>
                      <button
                        className="button danger"
                        type="button"
                        disabled={saving || !earningEndsAt || !redemptionEndsAt}
                        onClick={() => setConfirmClose(true)}
                      >
                        Continuar con el cierre
                      </button>
                    </div>
                  )}
                </>
              )}
              {error && <p className="form-error">{error}</p>}
            </section>
            <section className="panel loyalty-panel">
              <h2>Términos y condiciones</h2>
              <p className="published-term">{program.termsMarkdown}</p>
            </section>
          </>
        ) : isClosing ? null : (
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
                      onChange={(event) =>
                        setTarget(Number(event.target.value))
                      }
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
                Son informativos. Puedes partir de una plantilla y editar el
                texto antes de guardar.
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
        )}
        <p className="field-help">
          <Link href="/backoffice">Volver al Backoffice</Link>
        </p>
        <ConfirmDialog
          open={confirmDiscard}
          title="¿Salir sin guardar?"
          description="Los cambios no se aplicarán al programa activo."
          confirmLabel="Salir sin guardar"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            setEditing(false);
            populate(context);
          }}
        />
        <ConfirmDialog
          open={confirmClose}
          title="¿Programar el cierre?"
          description="No podrás editar el programa después de confirmar. Los beneficios se conservarán sólo hasta la fecha final de canje."
          confirmLabel="Programar cierre"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => void closeProgram()}
        />
      </div>
    </main>
  );
}

function formatDate(value: string | null, timezone: string) {
  return value
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

function LoyaltySkeleton() {
  return (
    <main className="merchant-shell" aria-busy="true">
      <div className="brand-page loyalty-page loyalty-skeleton">
        <span className="skeleton-line skeleton-eyebrow" />
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-description" />
        <section className="panel loyalty-panel">
          <span className="skeleton-line skeleton-section-title" />
          <span className="skeleton-line skeleton-card" />
        </section>
      </div>
    </main>
  );
}
