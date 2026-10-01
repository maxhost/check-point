export class MarketingApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly fields: Record<string, string> = {},
    readonly suspensionReason?: string,
    readonly uncertain = false,
    copy?: string,
  ) {
    super(
      copy ||
        (uncertain
          ? "No pudimos confirmar el cambio. Consulta el estado antes de reintentar."
          : "No pudimos completar la operación."),
    );
  }
}

const reasons: Record<string, string> = {
  unauthorized: "Tu sesión terminó. Vuelve a ingresar.",
  not_member: "No tienes una membresía activa.",
  missing_permission: "No tienes permiso para administrar marketing.",
  not_owner: "Solo el propietario puede finalizar esta campaña.",
  email_not_verified: "Verifica tu email para continuar.",
  business_suspended: "El negocio está suspendido.",
  business_closed: "El negocio está cerrado.",
  plan_not_allowed: "Tu plan no incluye campañas.",
  no_loyalty_reward:
    "No se puede activar: necesitas un programa de fidelización con un premio.",
  no_usable_location: "No hay locales activos con ubicación para proximidad.",
  campaign_expired: "La fecha de fin ya pasó.",
  template_already_live: "Esta plantilla ya tiene una campaña en curso.",
  template_not_live: "Esta plantilla ya no tiene una campaña en curso.",
  template_not_editable:
    "Esta plantilla tiene parámetros congelados. Finalízala y lanza una nueva campaña.",
  not_editable: "Esta campaña ya no se puede editar.",
  invalid_transition: "El estado de la campaña cambió. Actualiza la vista.",
  not_found: "No encontramos esta campaña.",
  invalid_body: "No pudimos enviar los datos. Revísalos e intenta de nuevo.",
  validation: "Revisa los campos señalados.",
};

export function errorText(error: MarketingApiError) {
  return error.code ? (reasons[error.code] ?? error.message) : error.message;
}

export async function marketingRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new MarketingApiError(0, undefined, {}, undefined, method !== "GET");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const code = typeof payload.code === "string" ? payload.code : undefined;
    const fields =
      code === "validation" &&
      payload.fields &&
      typeof payload.fields === "object"
        ? (payload.fields as Record<string, string>)
        : {};
    throw new MarketingApiError(
      response.status,
      code,
      fields,
      typeof payload.suspensionReason === "string"
        ? payload.suspensionReason
        : undefined,
      false,
      code ? reasons[code] : undefined,
    );
  }
  if (!data || typeof data !== "object")
    throw new MarketingApiError(
      response.status,
      undefined,
      {},
      undefined,
      method !== "GET",
    );
  return data as T;
}

export const asMarketingError = (reason: unknown) =>
  reason instanceof MarketingApiError
    ? reason
    : new MarketingApiError(0, undefined, {}, undefined, true);
