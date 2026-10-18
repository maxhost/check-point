export class BusinessRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fields?: { salesMassUnits?: string },
    public products?: { id: string; name: string }[],
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
      typeof data?.code === "string" ? data.code : undefined,
      typeof data?.fields?.salesMassUnits === "string"
        ? { salesMassUnits: data.fields.salesMassUnits }
        : undefined,
      Array.isArray(data?.products)
        ? data.products
            .filter((item: unknown): item is { id: string; name: string } =>
              Boolean(
                item &&
                typeof item === "object" &&
                "id" in item &&
                typeof item.id === "string" &&
                "name" in item &&
                typeof item.name === "string",
              ),
            )
            .map(({ id, name }: { id: string; name: string }) => ({ id, name }))
        : undefined,
    );
  return data as T;
}
