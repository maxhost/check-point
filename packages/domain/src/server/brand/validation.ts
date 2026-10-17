import { BrandError, colorPattern, type LogoAction } from "./core";

function nonEmpty(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BrandError(422, `${field} es obligatorio.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > 120) {
    throw new BrandError(422, `${field} no puede superar 120 caracteres.`);
  }
  return normalized;
}

function color(value: unknown, field: string) {
  if (typeof value !== "string" || !colorPattern.test(value)) {
    throw new BrandError(422, `${field} debe ser un color hexadecimal válido.`);
  }
  return value.toUpperCase();
}

export function validateBrandInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrandError(422, "Los datos de marca no son válidos.");
  }
  const input = value as Record<string, unknown>;
  const logoAction = input.logoAction;
  if (
    logoAction !== "keep" &&
    logoAction !== "replace" &&
    logoAction !== "remove"
  ) {
    throw new BrandError(422, "La acción del logo no es válida.");
  }
  if (!Number.isInteger(input.revision) || Number(input.revision) < 1) {
    throw new BrandError(422, "La revisión de marca no es válida.");
  }
  const uploadId = input.uploadId;
  if (logoAction === "replace" && (typeof uploadId !== "string" || !uploadId)) {
    throw new BrandError(422, "Selecciona un logo válido antes de guardar.");
  }
  if (logoAction !== "replace" && uploadId !== undefined) {
    throw new BrandError(422, "La carga de logo no corresponde a esta acción.");
  }
  // `cropped` says the blob came from the 1:1 client cropper, so the server can decode it
  // under the strict pixel bound. Same shape rule as `uploadId`: only meaningful with
  // `replace`. Declaring it can only tighten the bound, never loosen it (spec 0040).
  const cropped = input.cropped;
  if (cropped !== undefined && typeof cropped !== "boolean") {
    throw new BrandError(422, "La marca de recorte no es válida.");
  }
  if (logoAction !== "replace" && cropped !== undefined) {
    throw new BrandError(
      422,
      "La marca de recorte no corresponde a esta acción.",
    );
  }
  if (
    [
      "timezone",
      "currencyCode",
      "chargesVat",
      "saleVatRate",
      "recoversPurchaseVat",
    ].some((key) => Object.hasOwn(input, key))
  )
    throw new BrandError(
      422,
      "La configuración regional y fiscal se gestiona en Negocio.",
    );
  return {
    name: nonEmpty(input.name, "El nombre"),
    brandPrimaryColor: color(input.brandPrimaryColor, "El color primario"),
    brandComplementaryColor: color(
      input.brandComplementaryColor,
      "El color complementario",
    ),
    brandAccentColor: color(input.brandAccentColor, "El color de acento"),
    revision: Number(input.revision),
    logoAction: logoAction as LogoAction,
    uploadId: uploadId as string | undefined,
    cropped: cropped === true,
  };
}
