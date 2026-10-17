export class BusinessRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function businessRequest<T>(
  path: string,
  body?: unknown,
  method = "PUT",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `/api/business/${path}`,
      body === undefined
        ? { cache: "no-store" }
        : {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch {
    throw new BusinessRequestError(
      "No pudimos confirmar el resultado. Revisa tu conexión y actualiza los datos antes de guardar nuevamente.",
      0,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new BusinessRequestError(
      typeof data?.error === "string"
        ? data.error
        : "No pudimos cargar los datos. Intenta nuevamente.",
      response.status,
      data?.code,
    );
  return data as T;
}
