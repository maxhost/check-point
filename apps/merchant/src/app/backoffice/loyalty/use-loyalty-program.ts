import { useEffect, useRef, useState } from "react";
import { loyaltyRequest, asLoyaltyError, LoyaltyApiError } from "./loyalty-api";
import { isContext, areTemplates } from "./loyalty-response";
import { programPayload } from "./program-payload";
import { firstInvalidStep } from "./program-form-state";
import { useStampUpload } from "./use-stamp-upload";
import { type BrandDefaults, useCardDesign } from "./use-card-design";
import { useRewards } from "./use-rewards";
import type { Business, Context, Kind, Template } from "./loyalty-types";

export type {
  Business,
  Context,
  Kind,
  Program,
  ProgramAccrual,
  ProgramReward,
  Template,
} from "./loyalty-types";

const brandDefaultsOf = (business: Business): BrandDefaults => ({
  primary: business.brandPrimaryColor,
  complementary: business.brandComplementaryColor,
  accent: business.brandAccentColor,
});

export function useLoyaltyProgram({
  isOwner,
  canReadCatalog,
}: {
  isOwner: boolean;
  canReadCatalog: boolean;
}) {
  const writing = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoyaltyApiError | null>(null);
  const [operationError, setOperationError] = useState<LoyaltyApiError | null>(
    null,
  );
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [stampPlural, setStampPlural] = useState<unknown>(undefined);
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
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const stamp = useStampUpload();
  const card = useCardDesign();
  const earn = useRewards();

  const program = context?.program ?? null;
  const timezone = context?.business.timezone ?? "America/Guayaquil";
  const currencyCode = context?.business.currencyCode ?? "USD";
  const isClosing = program?.status === "closing";

  function populate(next: Context) {
    stamp.reset();
    const brand = brandDefaultsOf(next.business);
    if (!next.program) {
      card.applyDefaults(brand);
      earn.reset();
      return;
    }
    setKind(next.program.kind);
    setTerms(next.program.termsMarkdown);
    if (next.program.kind === "points") {
      setSingular(String(next.program.configuration.unitSingular ?? "Punto"));
      setPlural(String(next.program.configuration.unitPlural ?? "Puntos"));
    } else {
      setStampPlural(next.program.configuration.unitPlural);
      setStampName(String(next.program.configuration.unitName ?? "Sello"));
      setTarget(Number(next.program.configuration.target ?? 10));
    }
    card.hydrate(next.program, brand);
    earn.hydrate(next.program);
  }

  async function load(preserveDraft = false, afterWrite = false) {
    setLoading(true);
    setLoadError(null);
    try {
      const [next, termsData] = await Promise.all([
        loyaltyRequest<Context>("/api/loyalty-program"),
        loyaltyRequest<{ templates: Template[] }>(
          "/api/loyalty-terms/templates",
        ),
      ]);
      if (!isContext(next) || !areTemplates(termsData))
        throw new LoyaltyApiError(200);
      setContext(next);
      setTemplates(termsData.templates);
      setRefreshFailed(false);
      setOperationError(null);
      if (!preserveDraft) populate(next);
      if (afterWrite) {
        setEditing(false);
        setClosing(false);
        stamp.reset();
      }
      return true;
    } catch (reason) {
      setLoadError(asLoyaltyError(reason));
      if (afterWrite) setRefreshFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    void earn.loadCatalog(canReadCatalog);
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

  async function write(method: string, body: unknown, success: string) {
    if (
      writing.current ||
      refreshFailed ||
      loadError?.status === 401 ||
      loadError?.status === 403 ||
      operationError?.status === 401 ||
      operationError?.status === 403
    )
      return;
    writing.current = true;
    setSaving(true);
    setOperationError(null);
    setError(null);
    try {
      const result = await loyaltyRequest<{
        programId?: string;
        created?: boolean;
        ok?: boolean;
      }>("/api/loyalty-program", method, body);
      if (
        method === "PUT"
          ? typeof result.programId !== "string" ||
            typeof result.created !== "boolean"
          : result.ok !== true
      )
        throw new LoyaltyApiError(200, undefined, undefined, true);
      setNotice(success);
      await load(false, true);
    } catch (reason) {
      const failure = asLoyaltyError(reason);
      setOperationError(failure);
      setError(failure.message);
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }
  async function save() {
    if (
      writing.current ||
      refreshFailed ||
      operationError?.status === 401 ||
      operationError?.status === 403 ||
      loadError?.status === 401 ||
      loadError?.status === 403 ||
      firstInvalidStep(vm()) ||
      stamp.isAnalyzing ||
      stamp.pending
    )
      return;
    // Acquire before preparing an upload, which is itself an asynchronous write.
    writing.current = true;
    setSaving(true);
    try {
      const stampAction = kind === "stamps" ? stamp.action : "keep";
      const stampUploadId =
        stampAction === "replace" ? await stamp.upload() : null;
      writing.current = false;
      await write(
        "PUT",
        programPayload(vm(), stampPlural, stampUploadId),
        program ? "Programa actualizado." : "Programa activado.",
      );
    } catch (reason) {
      const failure = asLoyaltyError(reason);
      setOperationError(failure);
      setError(failure.message);
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }
  async function closeProgram() {
    if (!isOwner) return;
    setConfirmClose(false);
    await write(
      "DELETE",
      { earningEndsAt, redemptionEndsAt },
      "El cierre del programa fue programado.",
    );
  }
  async function cancelClose() {
    if (!isOwner) return;
    setConfirmCancel(false);
    await write(
      "PATCH",
      { action: "cancel-close" },
      "El cierre fue cancelado.",
    );
  }
  function vm() {
    return {
      context,
      isOwner,
      canReadCatalog,
      loading,
      loadError,
      operationError,
      refreshFailed,
      load,
      clearAccessError: () => setOperationError(null),
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
      errorToast,
      program,
      timezone,
      currencyCode,
      isClosing,
      stamp,
      card,
      earn,
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
      setErrorToast,
      populate,
      save,
      closeProgram,
      cancelClose,
    };
  }
  return vm();
}

export type LoyaltyVm = ReturnType<typeof useLoyaltyProgram>;
