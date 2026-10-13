export type StockUnit = "g" | "ml" | "unit";
export type EntryUnit = StockUnit | "kg" | "l";
export type StockItem = {
  id: string;
  name: string;
  unit: StockUnit;
  status: "active" | "archived";
};
export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  unit: StockUnit;
  kind: "purchase" | "adjustment";
  quantity: string;
  countedQuantity: string | null;
  totalCost: string | null;
  createdAt: string;
  occurredAt: string;
};
export type StockLine = {
  key: string;
  itemId: string | null;
  name: string;
  quantity: string;
  unit: EntryUnit;
  totalCost: string;
  sourceText?: string;
};
export type StockDraft = {
  lines: {
    itemId: string | null;
    name: string;
    isNew: boolean;
    quantity: string;
    unit: EntryUnit;
    totalCost: string | null;
    sourceText: string;
  }[];
  unparsed: string[];
};
export const units = [
  { id: "g", label: "Gramos" },
  { id: "kg", label: "Kilogramos" },
  { id: "ml", label: "Mililitros" },
  { id: "l", label: "Litros" },
  { id: "unit", label: "Unidades" },
];
export function baseUnit(unit: EntryUnit): StockUnit {
  return unit === "kg" ? "g" : unit === "l" ? "ml" : unit;
}
export function blankLine(key: string): StockLine {
  return {
    key,
    itemId: null,
    name: "",
    quantity: "",
    unit: "unit",
    totalCost: "",
  };
}
function decimal(value: string, scale: number, integers: number): string {
  const normalized = value.trim().replace(",", ".");
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(normalized))
    throw new Error(`Usa un número positivo con hasta ${scale} decimales.`);
  const [whole, fraction] = normalized.split(".");
  const clean = whole.replace(/^0+(?=\d)/, "");
  if (clean.length > integers)
    throw new Error("La cantidad o el precio es demasiado grande.");
  return clean + (fraction ? `.${fraction}` : "");
}
/** Conversión exacta para conteos: la API espera la unidad base, no kg/l. */
export function countedQuantity(value: string, unit: EntryUnit): string {
  const normalized = decimal(value, 3, 11);
  const [whole, fraction = ""] = normalized.split(".");
  let scaled = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  if (unit === "kg" || unit === "l") scaled *= 1000n;
  if (scaled >= 10n ** 14n) throw new Error("La cantidad es demasiado grande.");
  return `${scaled / 1000n}.${String(scaled % 1000n).padStart(3, "0")}`;
}
export function entryLines(lines: StockLine[], items: StockItem[]) {
  if (lines.length < 1 || lines.length > 30)
    throw new Error("Añade entre 1 y 30 ítems.");
  return lines.map((line, index) => {
    try {
      const quantity = decimal(line.quantity, 3, 11);
      if (Number(quantity) <= 0)
        throw new Error("La cantidad debe ser mayor que cero.");
      countedQuantity(quantity, line.unit);
      const totalCost = line.totalCost.trim()
        ? decimal(line.totalCost, 2, 10)
        : null;
      const item = items.find((item) => item.id === line.itemId);
      if (line.itemId && (!item || item.status !== "active"))
        throw new Error("Selecciona un insumo activo.");
      if (item && item.unit !== baseUnit(line.unit))
        throw new Error("La unidad no coincide con la del insumo.");
      const name = line.name.trim();
      if (!line.itemId && (!name || name.length > 80))
        throw new Error("El nombre debe tener entre 1 y 80 caracteres.");
      if (
        !line.itemId &&
        items.some(
          (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      )
        throw new Error("Ese insumo ya existe. Selecciónalo en la lista.");
      return {
        ...(line.itemId ? { itemId: line.itemId } : { newItem: { name } }),
        quantity,
        unit: line.unit,
        totalCost,
      };
    } catch (cause) {
      throw new Error(
        `Ítem ${index + 1}: ${cause instanceof Error ? cause.message : "Revisa los datos."}`,
      );
    }
  });
}
