import {
  backofficeScopeHeaders,
  type BackofficeRequestOptions,
} from "./backoffice-scope-request";

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
  options?: BackofficeRequestOptions,
): Promise<T> {
  const scopeHeaders = backofficeScopeHeaders(options?.scopeKey);
  let additionalHeaders: Headers | undefined;
  if (options?.headers !== undefined) {
    additionalHeaders = new Headers(options.headers);
    if (body instanceof FormData) additionalHeaders.delete("content-type");
    else if (body !== undefined)
      additionalHeaders.set("content-type", "application/json");
    for (const [name, value] of Object.entries(scopeHeaders ?? {}))
      additionalHeaders.set(name, value);
  }
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
    ...(scopeHeaders
      ? {
          headers: {
            ...(body !== undefined && !(body instanceof FormData)
              ? { "content-type": "application/json" }
              : {}),
            ...scopeHeaders,
          },
        }
      : {}),
    ...(additionalHeaders ? { headers: additionalHeaders } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
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
