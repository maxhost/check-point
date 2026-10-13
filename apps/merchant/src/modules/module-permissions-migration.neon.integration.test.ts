import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { memberships } from "@mi-pasaporte/db/schema";
import { seedMember } from "../server/counter-integration-support";
import {
  type ModuleWorld,
  dropModuleWorld,
  modulesIntegrationEnabled,
  seedModuleWorld,
} from "./modules-integration-support";

/**
 * Spec 0216 §Plan 4 — LA PARTE DE DATOS DE LA MIGRACION 0078, con el SQL EXACTO del archivo (la
 * sentencia despues del ultimo `--> statement-breakpoint`), corrido dentro de una transaccion que
 * se DESHACE: la rama de pruebas ya tiene la 0078 aplicada por `tools/neon-test.sh`, asi que asi
 * se mide sobre filas sembradas sin tocar las de otras suites.
 *
 * Todo integrante con `catalog` recibe `stock` y `recipes` sin duplicar; quien no tiene `catalog`
 * y el owner no cambian; correrla dos veces da lo mismo.
 */

const MIGRATION = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "db",
  "drizzle",
  "0078_permisos_de_modulos.sql",
);

function dataStatement(): string {
  const parts = readFileSync(MIGRATION, "utf8").split(
    "--> statement-breakpoint",
  );
  return parts[parts.length - 1]
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

let world: ModuleWorld;
const members: Record<string, string> = {};

const SEEDS: Record<string, string[]> = {
  soloCatalog: ["catalog"],
  catalogYStock: ["catalog", "counter", "stock"],
  yaCompleto: ["catalog", "stock", "recipes"],
  sinCatalog: ["counter"],
};

beforeAll(async () => {
  world = await seedModuleWorld("Migracion 0078");
  for (const [name, permissions] of Object.entries(SEEDS)) {
    members[name] = await seedMember({
      businessId: world.businessId,
      permissions,
    });
    world.users.push(members[name]);
  }
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
}, 240_000);

async function readAll(tx: DbTransaction) {
  const out: Record<string, string[]> = {};
  for (const [name, userId] of Object.entries({
    ...members,
    owner: world.ownerId,
  })) {
    const [row] = await tx
      .select({ permissions: memberships.permissions })
      .from(memberships)
      .where(
        and(
          eq(memberships.businessId, world.businessId),
          eq(memberships.userId, userId),
        ),
      );
    out[name] = row.permissions;
  }
  return out;
}

describe.skipIf(!modulesIntegrationEnabled)(
  "migracion 0078: catalog → +stock +recipes (spec 0216)",
  () => {
    it("el archivo trae la sentencia de datos (piso: si no, el test no mide nada)", () => {
      expect(dataStatement()).toMatch(/^UPDATE "core"\."business_membership"/);
    });

    it("suma stock y recipes a quien tiene catalog, sin duplicar; el resto y el owner no cambian; idempotente", async () => {
      const ROLLBACK = new Error("rollback");
      const seen: Record<string, string[]>[] = [];
      await withDbTransaction(async (tx) => {
        await tx.execute(sql.raw(dataStatement()));
        seen.push(await readAll(tx));
        await tx.execute(sql.raw(dataStatement()));
        seen.push(await readAll(tx));
        throw ROLLBACK;
      }).catch((error) => {
        if (error !== ROLLBACK) throw error;
      });
      const expected = {
        soloCatalog: ["catalog", "stock", "recipes"],
        catalogYStock: ["catalog", "counter", "stock", "recipes"],
        yaCompleto: ["catalog", "stock", "recipes"],
        sinCatalog: ["counter"],
        owner: [],
      };
      expect(seen).toEqual([expected, expected]);
    }, 120_000);
  },
);
