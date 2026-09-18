import type {
  BusinessSummary,
  CreateBusinessInput,
  OnboardingPrefill,
  OnboardingState,
  ProgramSummary,
  WizardApiCode,
} from "./contracts";

export class WizardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: WizardApiCode,
    readonly suspensionReason?: string,
  ) {
    super(message);
    this.name = "WizardApiError";
  }
}

async function responseBody(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init?.body
      ? { "content-type": "application/json", ...init.headers }
      : init?.headers,
  });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new WizardApiError(
      typeof body.error === "string"
        ? body.error
        : "No pudimos completar la solicitud.",
      response.status,
      typeof body.code === "string" ? (body.code as WizardApiCode) : undefined,
      typeof body.suspensionReason === "string"
        ? body.suspensionReason
        : undefined,
    );
  }
  return body as T;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  // Spec 0074 — la ruta existe y se llama SIEMPRE, tambien en desarrollo. Hubo un
  // sustituto de `sessionStorage` mientras la 0074 estaba sin implementar; se retiro
  // porque hacia que la ruta real no se ejercitara ni una vez fuera de produccion.
  const response = await fetch("/api/onboarding/state", {
    credentials: "same-origin",
  });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new WizardApiError(
      typeof body.error === "string"
        ? body.error
        : "No pudimos recuperar tu avance.",
      response.status,
      typeof body.code === "string" ? (body.code as WizardApiCode) : undefined,
    );
  }
  return body as OnboardingState;
}

export function startMerchantAuth(email: string) {
  return jsonRequest<{ sent: boolean }>("/api/merchant/auth/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function getOnboardingPrefill() {
  return jsonRequest<OnboardingPrefill>("/api/onboarding/prefill");
}

export async function createBusiness(input: CreateBusinessInput) {
  const result = await jsonRequest<{ businessId: string; slug: string }>(
    "/api/onboarding/business",
    { method: "POST", body: JSON.stringify(input) },
  );
  const business: BusinessSummary = {
    id: result.businessId,
    name: input.name.trim(),
    slug: result.slug,
  };
  return business;
}

export async function createProgram(target: number, rewardLabel: string) {
  const result = await jsonRequest<{ programId: string; created: boolean }>(
    "/api/onboarding/program",
    {
      method: "POST",
      body: JSON.stringify({
        target,
        reward: { type: "custom", label: rewardLabel.trim() },
      }),
    },
  );
  const program: ProgramSummary = { id: result.programId, kind: "stamps" };
  return program;
}

export const qrDownloadPath = "/api/loyalty-program/qr?format=png&download=1";

export async function getQrImage() {
  const response = await fetch("/api/loyalty-program/qr?format=svg", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await responseBody(response);
    throw new WizardApiError(
      typeof body.error === "string" ? body.error : "No pudimos generar tu QR.",
      response.status,
      typeof body.code === "string" ? (body.code as WizardApiCode) : undefined,
      typeof body.suspensionReason === "string"
        ? body.suspensionReason
        : undefined,
    );
  }
  return response.blob();
}

export async function getQrPng() {
  const response = await fetch("/api/loyalty-program/qr?format=png", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await responseBody(response);
    throw new WizardApiError(
      typeof body.error === "string"
        ? body.error
        : "No pudimos preparar el QR para compartir.",
      response.status,
      typeof body.code === "string" ? (body.code as WizardApiCode) : undefined,
    );
  }
  return response.blob();
}
