import { CatalogError, uuidPattern } from "./core";

export type ImageAction = "keep" | "replace" | "remove";

export type ProductInput = {
  name: string;
  categoryId: string | null;
  unitPrice: string | null;
  unitCost: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
  imageAction: ImageAction;
  uploadId: string | null;
};

/** numeric(12,2) range: prices/costs must fit and be non-negative. */
const MAX_MONEY = 9_999_999_999.99;

function parseOptionalMoney(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new CatalogError(
      422,
      `${label} debe ser un número mayor o igual a 0.`,
    );
  }
  if (amount > MAX_MONEY) {
    throw new CatalogError(422, `${label} es demasiado grande.`);
  }
  return amount.toFixed(2);
}

function parseCategoryId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && uuidPattern.test(value)) return value;
  throw new CatalogError(422, "La categoría no es válida.");
}

function parseImage(input: Record<string, unknown>): {
  imageAction: ImageAction;
  uploadId: string | null;
} {
  const action = input.imageAction;
  if (action === "remove") return { imageAction: "remove", uploadId: null };
  if (action === "replace") {
    if (typeof input.uploadId !== "string" || !input.uploadId) {
      throw new CatalogError(422, "Falta la imagen cargada.");
    }
    return { imageAction: "replace", uploadId: input.uploadId };
  }
  return { imageAction: "keep", uploadId: null };
}

export function validateProductInput(value: unknown): ProductInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogError(422, "La solicitud no es válida.");
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) {
    throw new CatalogError(
      422,
      "El nombre es obligatorio (máximo 120 caracteres).",
    );
  }
  const categoryId = parseCategoryId(input.categoryId);
  const unitPrice = parseOptionalMoney(input.unitPrice, "El precio");
  const unitCost = parseOptionalMoney(input.unitCost, "El coste");
  const availableAllLocations = input.availableAllLocations !== false;
  let locationIds: string[] = [];
  if (!availableAllLocations) {
    const raw = input.locationIds;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new CatalogError(
        422,
        "Selecciona al menos un local o habilita todos los locales.",
      );
    }
    locationIds = [...new Set(raw.map((id) => String(id)))];
    if (!locationIds.every((id) => uuidPattern.test(id))) {
      throw new CatalogError(422, "Hay un local inválido en la selección.");
    }
  }
  return {
    name,
    categoryId,
    unitPrice,
    unitCost,
    availableAllLocations,
    locationIds,
    ...parseImage(input),
  };
}

export function validateCategoryName(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogError(422, "La solicitud no es válida.");
  }
  const raw = (value as Record<string, unknown>).name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > 60) {
    throw new CatalogError(
      422,
      "El nombre de la categoría es obligatorio (máximo 60 caracteres).",
    );
  }
  return name;
}
