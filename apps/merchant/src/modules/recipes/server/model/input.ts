import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, parseDecimal } from "../../../decimal";
import { ModuleError, invalidBody } from "../../../errors";
import { QUANTITY } from "../../../stock/numbers";
import { MAX_RECIPE_LINES, MAX_COMPONENTS } from "../contracts";
import { notFound } from "./common";
const itemNotFound = () => notFound("item");
const UNITS: Record<string, { base: string; factor: bigint }> = {
  g: { base: "g", factor: 1n },
  kg: { base: "g", factor: 1000n },
  ml: { base: "ml", factor: 1n },
  l: { base: "ml", factor: 1000n },
  unit: { base: "unit", factor: 1n },
};
/** `numeric(14,3)`: la cantidad convertida tiene que ser menor que 10^11. */
const QUANTITY_LIMIT = 10n ** 14n;
const MAX_NAME = 80;

/** Linea con insumo existente: `{ itemId, quantity }` (+ `base` si vino `unit`). Linea nueva:
 * `{ newName, base, quantity }`. `quantity` siempre en la unidad base, escala 3. */
export type NewLine =
  | { itemId: string; quantity: bigint; base?: string }
  | { newName: string; base: string; quantity: bigint };

function lineError(index: number, status: number, code: string, msg: string) {
  return new ModuleError(status, code, `Línea ${index + 1}: ${msg}`, {
    line: index,
  });
}

/** Valida `{ lines: [...] }` sin tocar la base. */
export function parseRecipeLines(body: Record<string, unknown>): NewLine[] {
  if (!Array.isArray(body.lines))
    throw invalidBody("`lines` tiene que ser una lista.");
  if (body.lines.length > MAX_RECIPE_LINES) {
    throw new ModuleError(
      422,
      "too_many_lines",
      `Una receta puede tener hasta ${MAX_RECIPE_LINES} insumos.`,
    );
  }
  const seen = new Set<string>();
  return body.lines.map((raw: unknown, index: number): NewLine => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw invalidBody();
    const line = raw as Record<string, unknown>;
    const hasNew = line.newItem !== undefined && line.newItem !== null;
    if (hasNew && line.itemId !== undefined && line.itemId !== null) {
      throw lineError(
        index,
        422,
        "invalid_line",
        "tiene que traer un insumo existente o uno nuevo, no los dos.",
      );
    }
    let unit: { base: string; factor: bigint } | undefined;
    if (line.unit !== undefined && line.unit !== null) {
      unit = typeof line.unit === "string" ? UNITS[line.unit] : undefined;
      if (!unit) {
        throw lineError(
          index,
          422,
          "invalid_unit",
          "la unidad tiene que ser g, kg, ml, l o unit.",
        );
      }
    }
    const said = parseDecimal(line.quantity, QUANTITY);
    if (said <= 0n) {
      throw new ModuleError(
        422,
        "invalid_quantity",
        "La cantidad tiene que ser mayor que cero.",
      );
    }
    const quantity = said * (unit?.factor ?? 1n);
    if (quantity >= QUANTITY_LIMIT) {
      throw lineError(
        index,
        422,
        "invalid_number",
        "la cantidad es demasiado alta.",
      );
    }
    if (hasNew) {
      const rawName = (line.newItem as Record<string, unknown>)?.name;
      const name = typeof rawName === "string" ? rawName.trim() : "";
      if (name.length === 0 || name.length > MAX_NAME) {
        throw lineError(
          index,
          422,
          "invalid_name",
          `el nombre del insumo tiene que tener entre 1 y ${MAX_NAME} caracteres.`,
        );
      }
      if (!unit) {
        throw lineError(
          index,
          422,
          "invalid_unit",
          "un insumo nuevo necesita su unidad.",
        );
      }
      return { newName: name, base: unit.base, quantity };
    }
    if (!isUuid(line.itemId)) throw itemNotFound();
    const itemId = (line.itemId as string).trim().toLowerCase();
    if (seen.has(itemId)) {
      throw new ModuleError(
        422,
        "duplicate_item",
        "Un insumo aparece dos veces en la receta.",
      );
    }
    seen.add(itemId);
    return unit ? { itemId, quantity, base: unit.base } : { itemId, quantity };
  });
}

export function recipeName(raw: unknown) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || [...name].length > 120)
    throw new ModuleError(
      422,
      "invalid_name",
      "El nombre tiene que tener entre 1 y 120 caracteres.",
    );
  return name;
}
export function parseComposition(body: Record<string, unknown>) {
  if (typeof body.isCombo !== "boolean" || !Array.isArray(body.recipes))
    throw invalidBody();
  if (body.recipes.length > MAX_COMPONENTS)
    throw new ModuleError(
      422,
      "too_many_components",
      "Un producto puede tener hasta 50 recetas.",
    );
  if (!body.isCombo && body.recipes.length > 1)
    throw new ModuleError(
      422,
      "combo_required",
      "Marca el producto como combo para usar varias recetas.",
    );
  const seen = new Set<string>();
  return {
    isCombo: body.isCombo,
    recipes: body.recipes.map((raw: unknown, position) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw invalidBody();
      const value = raw as Record<string, unknown>;
      if (!isUuid(value.recipeId)) throw notFound("recipe");
      const recipeId = (value.recipeId as string).trim().toLowerCase();
      if (seen.has(recipeId))
        throw new ModuleError(
          422,
          "duplicate_recipe",
          "Una receta aparece dos veces.",
        );
      seen.add(recipeId);
      const quantity = parseDecimal(value.quantity, QUANTITY);
      if (quantity <= 0n)
        throw new ModuleError(
          422,
          "invalid_quantity",
          "La cantidad tiene que ser mayor que cero.",
        );
      return { recipeId, quantity: formatDecimal(quantity, 3), position };
    }),
  };
}
