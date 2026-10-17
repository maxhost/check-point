/** Invoke only through tools/neon-test.sh for CI, or after an explicit production authorization. */
import { withDbTransaction } from "@mi-pasaporte/db";
import { resolveExistingLocationCities } from "../../apps/merchant/src/server/analytics/context/cities";
if (
  process.env.NEON_INTEGRATION_ISOLATED !== "true" ||
  !process.env.NEON_INTEGRATION_DATABASE_URL
)
  throw new Error("Use the isolated CI wrapper");
console.log(await withDbTransaction(resolveExistingLocationCities));
