import { CatalogError, uuidPattern } from "./core";

export type ImageAction = "keep" | "replace" | "remove" | "stock";

export type ProductInput = {
  name: string;
  categoryId: string | null;
  unitPrice: string | null;
  unitCost: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
  imageAction: ImageAction;
  uploadId: string | null;
  provider: string | null;
  photoId: string | null;
  /** True when the blob came from the 1:1 client cropper → strict decode bound (spec 0040). */
  cropped: boolean;
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
  provider: string | null;
  photoId: string | null;
  cropped: boolean;
} {
  const action = input.imageAction;
  const base = {
    uploadId: null,
    provider: null,
    photoId: null,
    cropped: false,
  };
  // `cropped` only travels with `replace` (same rule as `uploadId`): it marks a blob the
  // client cropper already bounded to 2048², and can only tighten the server's decode
  // bound, never widen it (spec 0040, decision 5).
  const cropped = input.cropped;
  if (cropped !== undefined && typeof cropped !== "boolean") {
    throw new CatalogError(422, "La marca de recorte no es válida.");
  }
  if (action !== "replace" && cropped !== undefined) {
    throw new CatalogError(
      422,
      "La marca de recorte no corresponde a esta acción.",
    );
  }
  if (action === "remove") return { imageAction: "remove", ...base };
  if (action === "replace") {
    if (typeof input.uploadId !== "string" || !input.uploadId) {
      throw new CatalogError(422, "Falta la imagen cargada.");
    }
    return {
      imageAction: "replace",
      ...base,
      uploadId: input.uploadId,
      cropped: cropped === true,
    };
  }
  if (action === "stock") {
    if (typeof input.provider !== "string" || !input.provider) {
      throw new CatalogError(422, "Falta el proveedor de la imagen.");
    }
    if (typeof input.photoId !== "string" || !input.photoId) {
      throw new CatalogError(422, "Falta la imagen seleccionada.");
    }
    return {
      imageAction: "stock",
      ...base,
      provider: input.provider,
      photoId: input.photoId,
    };
  }
  return { imageAction: "keep", ...base };
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
