import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businessConfiguration,
  businesses,
  sessions,
  users,
} from "@mi-pasaporte/db/schema";
import { businessHttp } from "../../../server/business/http";
import {
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  dropPosWorld,
  type PosWorld,
} from "./pos-integration-support";
let world: PosWorld, other: PosWorld;
function api(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = world.ownerCookie,
) {
  return businessHttp(
    new Request("http://localhost:3001/api/business/" + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    [path],
  );
}
const rows = () =>
  getDb()
    .select()
    .from(businessConfiguration)
    .where(eq(businessConfiguration.businessId, world.seed.business.id));
const read = async () => (await api("sales-units")).json();
async function response(
  response: Response,
  status: number,
  expected?: unknown,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const value = await response.json();
  if (expected) expect(value).toMatchObject(expected);
  return value;
}
describe.skipIf(!posIntegrationEnabled)("0242 business sales units", () => {
  beforeAll(async () => {
    world = await seedPosWorld("0242 sales units A");
    other = await seedPosWorld("0242 sales units B");
  }, 240000);
  afterAll(async () => {
    for (const fixture of [world, other]) {
      if (!fixture) continue;
      await dropPosWorld(fixture);
      await getDb().delete(users).where(eq(users.id, fixture.seed.userId));
      const ids = [fixture.seed.userId, ...fixture.extraUsers];
      const remaining = await Promise.all([
        getDb().select().from(users).where(inArray(users.id, ids)),
        getDb().select().from(sessions).where(inArray(sessions.userId, ids)),
        getDb()
          .select()
          .from(businesses)
          .where(eq(businesses.id, fixture.seed.business.id)),
      ]);
      expect(remaining).toEqual([[], [], []]);
    }
  }, 240000);
  it("GET defaults without writing; invalid first writes roll back configuration insertion", async () => {
    await getDb()
      .delete(businessConfiguration)
      .where(eq(businessConfiguration.businessId, world.seed.business.id));
    expect(await response(await api("sales-units"), 200)).toEqual({
      salesMassUnits: ["kg"],
      revision: 1,
    });
    expect(await rows()).toEqual([]);
    await response(
      await api("sales-units", "PUT", { salesMassUnits: ["lb"], revision: 2 }),
      409,
      { code: "business_revision_conflict" },
    );
    expect(await rows()).toEqual([]);
    expect(
      (
        await api("regional", "PUT", {
          timezone: "invalid",
          currencyCode: "USD",
          revision: 1,
        })
      ).status,
    ).toBe(422);
    expect(await rows()).toEqual([]);
  }, 120000);
  it("valid saves preserve regional/fiscal values and all three writers share revision", async () => {
    const regional = await (await api("regional")).json();
    const fiscal = await (await api("fiscal")).json();
    const initial = await read();
    const saved = await response(
      await api("sales-units", "PUT", {
        salesMassUnits: ["kg", "lb", "g"],
        revision: initial.revision,
      }),
      200,
    );
    expect(saved).toEqual({
      salesMassUnits: ["kg", "lb", "g"],
      revision: initial.revision + 1,
    });
    expect(await read()).toEqual(saved);
    expect(await (await api("regional")).json()).toEqual({
      ...regional,
      revision: saved.revision,
    });
    expect(await (await api("fiscal")).json()).toEqual({
      ...fiscal,
      revision: saved.revision,
    });
    for (const [path, input] of [
      ["regional", regional],
      ["fiscal", fiscal],
    ] as const) {
      expect((await api(path, "PUT", input)).status).toBe(409);
      const current = await read();
      const sibling = await api(path, "PUT", {
        ...input,
        revision: current.revision,
      });
      expect(sibling.status).toBe(200);
      expect((await sibling.json()).revision).toBe(current.revision + 1);
      await response(
        await api("sales-units", "PUT", {
          ...saved,
          revision: current.revision,
        }),
        409,
        { code: "business_revision_conflict" },
      );
      expect(await read()).toEqual({
        ...saved,
        revision: current.revision + 1,
      });
    }
  }, 120000);
  it("rejects invalid units, revisions and unrelated fields without changing data", async () => {
    const before = await rows();
    const current = await read();
    await response(
      await api("sales-units", "PUT", { salesMassUnits: ["kg"] }),
      422,
      {
        code: "invalid_sales_units",
        fields: { salesMassUnits: expect.any(String) },
      },
    );
    const invalid = [
      {},
      { salesMassUnits: null },
      { salesMassUnits: [] },
      { salesMassUnits: ["kg", "kg"] },
      { salesMassUnits: ["oz"] },
      { salesMassUnits: [null] },
      { salesMassUnits: "kg" },
      { salesMassUnits: ["kg"], revision: null },
      { salesMassUnits: ["kg"], revision: 0 },
      { salesMassUnits: ["kg"], revision: 1.5 },
      { salesMassUnits: ["kg"], revision: "1" },
      ...[
        "timezone",
        "currencyCode",
        "chargesVat",
        "saleVatRate",
        "recoversPurchaseVat",
        "businessId",
      ].map((key) => ({ salesMassUnits: ["kg"], [key]: "foreign" })),
    ];
    for (const input of invalid) {
      await response(
        await api("sales-units", "PUT", {
          revision: current.revision,
          ...input,
        }),
        422,
        {
          code: "invalid_sales_units",
          fields: { salesMassUnits: expect.any(String) },
        },
      );
    }
    for (const raw of ["{", "null", "[]"]) {
      await response(
        await businessHttp(
          new Request("http://localhost:3001/api/business/sales-units", {
            method: "PUT",
            headers: {
              cookie: world.ownerCookie,
              "content-type": "application/json",
            },
            body: raw,
          }),
          ["sales-units"],
        ),
        400,
        { code: "invalid_body" },
      );
    }
    expect(await rows()).toEqual(before);
  }, 120000);
  it("one of two PUTs with the same revision wins", async () => {
    const current = await read();
    const results = await Promise.all(
      [["lb"], ["g"]].map((salesMassUnits) =>
        api("sales-units", "PUT", {
          salesMassUnits,
          revision: current.revision,
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = await response(
      results.find((r) => r.status === 200)!,
      200,
    );
    await response(
      results.find((r) => r.status === 409)!,
      409,
      { code: "business_revision_conflict" },
    );
    expect(await read()).toEqual(winner);
    expect(winner.revision).toBe(current.revision + 1);
  }, 120000);
  it("owner/business staff can save; no session and unrelated permissions cannot; tenant B cannot change A", async () => {
    const delegated = await posStaff(world, ["business"]);
    const denied = await posStaff(world, ["pos", "catalog", "brand"]);
    for (const method of ["GET", "PUT"]) {
      const input =
        method === "PUT"
          ? { salesMassUnits: ["kg"], revision: (await read()).revision }
          : undefined;
      await response(await api("sales-units", method, input, ""), 401);
      await response(
        await api("sales-units", method, input, denied.cookie),
        403,
        { code: "missing_permission" },
      );
      await response(
        await api("sales-units", method, input, delegated.cookie),
        200,
      );
    }
    const before = await rows();
    const foreign = await (
      await api("sales-units", "GET", undefined, other.ownerCookie)
    ).json();
    await response(
      await api(
        "sales-units",
        "PUT",
        { salesMassUnits: ["lb"], revision: foreign.revision },
        other.ownerCookie,
      ),
      200,
    );
    expect(await rows()).toEqual(before);
    await response(await api("sales-units", "DELETE"), 404);
  }, 120000);
  it("a real DB write failure returns private safe 503 and rolls back units/revision", async () => {
    const current = await read();
    await getDb()
      .update(businessConfiguration)
      .set({ revision: 2147483647 })
      .where(eq(businessConfiguration.businessId, world.seed.business.id));
    try {
      const before = await rows();
      const failure = await response(
        await api("sales-units", "PUT", {
          salesMassUnits: ["g"],
          revision: 2147483647,
        }),
        503,
      );
      expect(failure).toEqual({
        code: "business_unavailable",
        error: "No pudimos acceder a la configuración del negocio.",
      });
      expect(await rows()).toEqual(before);
    } finally {
      await getDb()
        .update(businessConfiguration)
        .set({ revision: current.revision })
        .where(eq(businessConfiguration.businessId, world.seed.business.id));
    }
  }, 120000);
  // Canonical mass products and their catalog race remain CP2c gates: constraint 0105 stays intact.
});
