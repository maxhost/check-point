export type PanelSession = {
  authenticated: boolean;
  user?: { id: string };
  business?: {
    id: string;
    status: string;
    timezone: string;
    enabledModules: string[];
    currencyCode: string;
  } | null;
  membership?: { role: string; status: string; permissions: string[] } | null;
};

export class PanelRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
    readonly payload: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function panelRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : body instanceof FormData
        ? { body }
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new PanelRequestError(
      payload?.error ?? "No pudimos completar la acción. Intenta otra vez.",
      payload?.code,
      response.status,
      payload ?? {},
    );
  if (!payload)
    throw new Error("No pudimos leer la respuesta. Intenta otra vez.");
  return payload as T;
}
