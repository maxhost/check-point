import { useEffect, useState } from "react";

export type Kind = "points" | "stamps";
export type Template = { id: string; title: string; templateMarkdown: string };
export type Program = {
  id: string;
  kind: Kind;
  configuration: Record<string, unknown>;
  status: "active" | "closing" | "inactive";
  activatedAt: string;
  earningEndsAt: string | null;
  redemptionEndsAt: string | null;
  termsMarkdown: string;
};
export type Context = {
  business: { name: string; countryCode: string; timezone: string };
  program: Program | null;
};

export function useLoyaltyProgram() {
  const [context, setContext] = useState<Context | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [kind, setKind] = useState<Kind>("points");
  const [singular, setSingular] = useState("Punto");
  const [plural, setPlural] = useState("Puntos");
  const [stampName, setStampName] = useState("Sello");
  const [target, setTarget] = useState(10);
  const [terms, setTerms] = useState("");
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [earningEndsAt, setEarningEndsAt] = useState("");
  const [redemptionEndsAt, setRedemptionEndsAt] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const program = context?.program ?? null;
  const timezone = context?.business.timezone ?? "America/Guayaquil";
  const isClosing = program?.status === "closing";

  function populate(next: Context) {
    if (!next.program) return;
    setKind(next.program.kind);
    setTerms(next.program.termsMarkdown);
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

  /** Resolves the terms variables against the live form so the inserted copy is final text. */
  function insertTemplate(template: Template) {
    const variables: Record<string, string> = {
      business_legal_name: context?.business.name ?? "",
      program_name: kind === "points" ? plural : stampName,
      program_kind: kind,
      country_code: context?.business.countryCode ?? "",
    };
    const rendered = template.templateMarkdown.replace(
      /{{([a-z_]+)}}/g,
      (whole, variable: string) => variables[variable] ?? whole,
    );
    setTerms((current) =>
      current.trim() ? `${current.trim()}\n\n${rendered}` : rendered,
    );
  }

  async function save() {
    if (!terms.trim()) {
      setError("Añade al menos una cláusula de términos antes de guardar.");
      return;
    }
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
          clauses: [{ text: terms }],
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

  async function cancelClose() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/loyalty-program", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel-close" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "No pudimos cancelar el cierre.");
      setConfirmCancel(false);
      setNotice("El cierre fue cancelado. El programa vuelve a estar activo.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos cancelar el cierre.",
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    context,
    templates,
    kind,
    singular,
    plural,
    stampName,
    target,
    terms,
    editing,
    closing,
    earningEndsAt,
    redemptionEndsAt,
    confirmDiscard,
    confirmClose,
    confirmCancel,
    saving,
    notice,
    error,
    program,
    timezone,
    isClosing,
    setKind,
    setSingular,
    setPlural,
    setStampName,
    setTarget,
    setTerms,
    insertTemplate,
    setEditing,
    setClosing,
    setEarningEndsAt,
    setRedemptionEndsAt,
    setConfirmDiscard,
    setConfirmClose,
    setConfirmCancel,
    setNotice,
    populate,
    save,
    closeProgram,
    cancelClose,
  };
}

export type LoyaltyVm = ReturnType<typeof useLoyaltyProgram>;
