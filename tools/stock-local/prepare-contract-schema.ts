// Produce concrete post-contract Drizzle sources for review, without editing the checkout/journal.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const destination = process.argv[2];
if (!destination || !destination.startsWith("/private/tmp/"))
  throw new Error("Provide a /private/tmp/ artifact directory");
mkdirSync(destination, { recursive: true });
const stockSource = readFileSync(
  new URL("../../packages/db/src/schema/modules/stock.ts", import.meta.url),
  "utf8",
);
const marker = stockSource.indexOf("export const stockMovements");
let stockItems = stockSource.slice(0, marker);
stockItems = stockItems.replace(
  / {4}\/\*\* Costo por unidad base[\s\S]*?lastUnitCost: numeric\("last_unit_cost", \{ precision: 14, scale: 6 \}\),\n/,
  "",
);
stockItems = stockItems.replace(
  / {4}check\(\n {6}"stock_item_last_unit_cost_check",[\s\S]*?\n {4}\),\n/,
  "",
);
const stock =
  stockItems +
  stockSource
    .slice(marker)
    .replace(
      'locationId: uuid("location_id"),',
      'locationId: uuid("location_id").notNull(),',
    );
if (
  stock
    .slice(0, stock.indexOf("export const stockMovements"))
    .includes("last_unit_cost")
)
  throw new Error(
    "Unexpected legacy item schema shape; review before contract",
  );
const pos = readFileSync(
  new URL("../../packages/db/src/schema/modules/pos.ts", import.meta.url),
  "utf8",
).replace(
  'locationId: uuid("location_id").references(() => locations.id, {',
  'locationId: uuid("location_id").notNull().references(() => locations.id, {',
);
writeFileSync(`${destination}/stock.ts`, stock, { flag: "wx" });
writeFileSync(`${destination}/pos.ts`, pos, { flag: "wx" });
