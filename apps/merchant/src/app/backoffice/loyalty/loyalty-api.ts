export class LoyaltyApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    public suspensionReason?: string,
    public uncertain = false,
  ) {
    super(
      code
        ? (messages[code] ?? "No pudimos completar esta operación.")
        : uncertain
          ? "No pudimos confirmar el resultado. Consultá el programa antes de volver a guardar."
          : "No pudimos completar esta operación.",
    );
  }
}
const messages: Record<string, string> = {
  unauthorized: "Tu sesión terminó. Volvé a ingresar.",
  not_member: "No tenés una membresía activa.",
  missing_permission: "No tenés permiso para administrar fidelización.",
  email_not_verified: "Verificá tu email para continuar.",
  business_suspended: "El negocio está suspendido.",
  business_closed: "El negocio está cerrado.",
  not_owner: "Esta acción es solo para propietarios.",
  invalid_body: "No pudimos enviar el programa. Revisá los datos.",
  invalid_program: "Revisá los datos del programa y volvé a intentar.",
  program_exists:
    "El estado del programa cambió. Consultá el programa antes de continuar.",
  program_unavailable: "El programa no está disponible. Volvé a intentar.",
};
export async function loyaltyRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new LoyaltyApiError(0, undefined, undefined, method !== "GET");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    throw new LoyaltyApiError(
      response.status,
      typeof error.code === "string" ? error.code : undefined,
      typeof error.suspensionReason === "string"
        ? error.suspensionReason
        : undefined,
    );
  }
  if (!data || typeof data !== "object")
    throw new LoyaltyApiError(
      response.status,
      undefined,
      undefined,
      method !== "GET",
    );
  return data as T;
}
export const asLoyaltyError = (error: unknown) =>
  error instanceof LoyaltyApiError
    ? error
    : new LoyaltyApiError(0, undefined, undefined, true);
