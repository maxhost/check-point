import type {
  OnboardingPrefill,
  OnboardingState,
  PlaceSelection,
  PlaceSuggestion,
  SignupBusiness,
  SignupResult,
  WizardApiCode,
} from "./contracts";

export class WizardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: WizardApiCode,
    readonly field?: string,
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
      typeof body.field === "string" ? body.field : undefined,
      typeof body.suspensionReason === "string"
        ? body.suspensionReason
        : undefined,
    );
  }
  return body as T;
}

export function getOnboardingState() {
  return jsonRequest<OnboardingState>("/api/onboarding/state");
}

export function getOnboardingPrefill() {
  return jsonRequest<OnboardingPrefill>("/api/onboarding/prefill");
}

export function autocompletePlaces(input: string, sessionToken: string) {
  return jsonRequest<{ suggestions: PlaceSuggestion[] }>(
    "/api/places/autocomplete",
    {
      method: "POST",
      body: JSON.stringify({ input, sessionToken }),
    },
  );
}

export function selectPlace(placeId: string, sessionToken: string) {
  return jsonRequest<Omit<PlaceSelection, "suggestion">>(
    "/api/places/details",
    {
      method: "POST",
      body: JSON.stringify({ placeId, sessionToken }),
    },
  );
}

export function signupMerchant(email: string, business: SignupBusiness) {
  return jsonRequest<SignupResult>("/api/onboarding/signup", {
    method: "POST",
    body: JSON.stringify({ email, business }),
  });
}

export function requestMerchantLogin(email: string) {
  return jsonRequest<{ accepted: boolean }>("/api/merchant/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function requestVerificationEmail() {
  return jsonRequest<{ sent: boolean; verified: boolean }>(
    "/api/merchant/auth/verify-email",
    { method: "POST" },
  );
}
