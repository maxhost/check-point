import { WizardApiError } from "../[locale]/(merchant)/business/onboarding/_lib/onboarding-api";
import type { SessionView } from "../../server/session-view";

export class StaffAccessError extends WizardApiError {
  constructor(
    message: string,
    status: number,
    readonly reason?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message, status);
  }
}

export type StaffLogin = {
  userId: string;
  mustChangePin: boolean;
  landing: string;
};

async function request(
  url: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
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
    throw new StaffAccessError("No pudimos conectar. Vuelve a intentar.", 503);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new StaffAccessError(
      typeof data?.error === "string"
        ? data.error
        : "No pudimos continuar. Vuelve a intentar.",
      response.status,
      typeof data?.code === "string" ? data.code : undefined,
      typeof data?.retryAfterSeconds === "number" &&
        Number.isFinite(data.retryAfterSeconds)
        ? data.retryAfterSeconds
        : undefined,
    );
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new StaffAccessError(
      "No pudimos confirmar la respuesta. Vuelve a intentar.",
      502,
    );
  return data;
}

export async function loginStaff(
  identifier: string,
  pin: string,
): Promise<StaffLogin> {
  const data = await request("/api/merchant/auth/staff", {
    identifier: identifier.trim(),
    pin,
  });
  const staff = data.staff as StaffLogin | undefined;
  if (
    !staff ||
    typeof staff.userId !== "string" ||
    !staff.userId ||
    typeof staff.mustChangePin !== "boolean" ||
    typeof staff.landing !== "string" ||
    !/^\/backoffice(?:[/?#]|$)/.test(staff.landing) ||
    staff.landing.includes("\\")
  ) {
    throw new StaffAccessError(
      "No pudimos confirmar el acceso. Vuelve a intentar.",
      502,
    );
  }
  return staff;
}

/** No se continúa con una sesión ajena, inactiva ni sin permisos. El servidor sigue autorizando cada ruta. */
export async function activeStaffSession(
  expectedUserId?: string,
): Promise<string | null> {
  const session = (await request(
    "/api/merchant/session",
  )) as unknown as SessionView;
  if (
    session.authenticated !== true ||
    typeof session.user?.id !== "string" ||
    !session.user.id
  )
    throw new StaffAccessError("Tu sesión venció. Vuelve a ingresar.", 401);
  if (expectedUserId && session.user.id !== expectedUserId)
    throw new StaffAccessError(
      "No pudimos confirmar tu sesión. Vuelve a ingresar.",
      401,
    );
  if (!session.membership || session.membership.status !== "active")
    return null;
  if (session.membership.role !== "staff")
    throw new StaffAccessError(
      "Esta sesión no corresponde a un integrante del equipo. Vuelve a ingresar.",
      403,
    );
  if (
    !Array.isArray(session.membership.permissions) ||
    !session.membership.permissions.every(
      (permission) => typeof permission === "string",
    )
  )
    throw new StaffAccessError(
      "No pudimos confirmar tus permisos. Vuelve a intentar.",
      502,
    );
  return session.membership.permissions.length ? session.user.id : null;
}

export async function changeStaffPin(
  userId: string,
  currentPin: string,
  newPin: string,
) {
  const result = await request(`/api/staff/${encodeURIComponent(userId)}/pin`, {
    currentPin,
    newPin,
  });
  if (result.ok !== true || result.mustChangePin !== false)
    throw new StaffAccessError(
      "No pudimos confirmar el cambio de PIN. Vuelve a intentar.",
      502,
    );
}

export function accessError(error: unknown): StaffAccessError {
  return error instanceof StaffAccessError
    ? error
    : new StaffAccessError("No pudimos continuar. Vuelve a intentar.", 503);
}
