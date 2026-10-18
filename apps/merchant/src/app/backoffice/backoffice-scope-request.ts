import type { BackofficeContextChanged } from "../../backoffice-context-contract";

export type BackofficeScopeOptions = Readonly<{ scopeKey?: string }>;
export type BackofficeRequestOptions = BackofficeScopeOptions &
  Readonly<{ signal?: AbortSignal }>;

export class BackofficeScopeRequestError extends Error {
  readonly code = "backoffice_scope_invalid";

  constructor() {
    super(
      "El contexto del panel no está disponible. Actualiza el panel para continuar.",
    );
  }
}

/** Pass the value captured at intent start, never a getter resolved after await. */
export function backofficeScopeHeaders(
  scopeKey: string | undefined,
): Record<string, string> | undefined {
  if (scopeKey === undefined) return undefined; // Legacy caller, no protocol opt-in.
  if (typeof scopeKey !== "string" || !/^[a-f0-9]{64}$/.test(scopeKey))
    throw new BackofficeScopeRequestError();
  return { "X-Backoffice-Scope": scopeKey };
}

/** Only classification. No authorization, recovery, navigation or replay. */
export function isBackofficeContextChanged(
  failure: unknown,
): failure is { code: BackofficeContextChanged["code"] } {
  return (
    failure !== null &&
    typeof failure === "object" &&
    "code" in failure &&
    failure.code === "backoffice_context_changed"
  );
}
