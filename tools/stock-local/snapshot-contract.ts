// Generate the reviewed post-contract schema snapshot as an artifact, never rewrite journal.
import { readFileSync, writeFileSync } from "node:fs";
const destination = process.argv[2];
if (!destination || !destination.startsWith("/private/tmp/"))
  throw new Error("Provide a /private/tmp/ artifact destination");
const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/db/drizzle/meta/0083_snapshot.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
delete snapshot.tables["stock.item"].columns.last_unit_cost;
delete snapshot.tables["stock.item"].checkConstraints
  .stock_item_last_unit_cost_check;
snapshot.tables["stock.movement"].columns.location_id.notNull = true;
snapshot.tables["pos.pos_order"].columns.location_id.notNull = true;
writeFileSync(destination, JSON.stringify(snapshot, null, 2) + "\n", {
  flag: "wx",
});
