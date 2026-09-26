export type Brand = {
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  brandRevision: number;
  logoVersion: number;
  logoPath: string | null;
};

export const brandColors = [
  ["brandPrimaryColor", "Primario"],
  ["brandComplementaryColor", "Complementario"],
  ["brandAccentColor", "Acento"],
] as const;
export const validBrandColor = (value: string) =>
  /^#[0-9a-fA-F]{6}$/.test(value);

export class BrandRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public uncertain = false,
  ) {
    super(message);
  }
}

export function isBrand(value: unknown): value is Brand {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    [
      "id",
      "name",
      "timezone",
      "currencyCode",
      ...brandColors.map(([key]) => key),
    ].every((key) => typeof data[key] === "string") &&
    Number.isInteger(data.brandRevision) &&
    Number(data.brandRevision) >= 1 &&
    Number.isInteger(data.logoVersion) &&
    (data.logoPath === null || typeof data.logoPath === "string")
  );
}

export async function requestBrand(init?: RequestInit): Promise<Brand> {
  let response: Response;
  try {
    response = await fetch("/api/brand", init);
  } catch {
    throw new BrandRequestError(
      "No pudimos confirmar el resultado. Revisá la conexión y consultá la marca actual.",
      0,
      init?.method === "PUT",
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new BrandRequestError(
      typeof payload?.error === "string"
        ? payload.error
        : "No pudimos acceder a la marca. Intentá nuevamente.",
      response.status,
    );
  if (!isBrand(payload))
    throw new BrandRequestError(
      "No pudimos confirmar la respuesta de la marca. Consultá la versión guardada.",
      response.status,
      init?.method === "PUT",
    );
  return payload;
}
