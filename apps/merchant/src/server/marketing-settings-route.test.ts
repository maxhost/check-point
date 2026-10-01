import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0103 §11 — `GET`/`PATCH /api/marketing/settings` at the HTTP layer. The guard is
 * doubled (`_auth`, the only way to choose the caller without a session) and so is `./db`;
 * `campaignError`, `readJson` and the parser stay REAL. Isolation between businesses is
 * pinned against the database in `marketing-push-enable.neon.integration.test.ts`.
 */
const world = vi.hoisted(() => ({
  auth: vi.fn(),
  rows: [] as unknown[],
  sets: [] as unknown[],
}));

vi.mock("../app/api/marketing/_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/api/marketing/_auth")>()),
  requireMarketingOwner: world.auth,
}));

vi.mock("@mi-pasaporte/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => world.rows }) }),
    }),
    update: () => ({
      set: (values: unknown) => {
        world.sets.push(values);
        return { where: async () => undefined };
      },
    }),
  }),
}));

import { GET, PATCH } from "../app/api/marketing/settings/route";

const BUSINESS = "11111111-1111-4111-8111-111111111111";
const patch = (body: unknown) =>
  PATCH(
    new Request("https://merchant.test/api/marketing/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const get = () =>
  GET(new Request("https://merchant.test/api/marketing/settings"));

describe("api/marketing/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.sets = [];
    world.rows = [{ startHour: 9, endHour: 21, timeZone: "America/Guayaquil" }];
    world.auth.mockResolvedValue({ business: { id: BUSINESS }, userId: "u-1" });
  });

  it("GET answers the business's hours and zone", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: {
        pushWindow: { startHour: 9, endHour: 21 },
        timeZone: "America/Guayaquil",
      },
    });
  });

  it("PATCH with a valid window writes it and answers the same shape as GET", async () => {
    world.rows = [{ startHour: 8, endHour: 20, timeZone: "America/Guayaquil" }];
    const response = await patch({ pushWindow: { startHour: 8, endHour: 20 } });
    expect(response.status).toBe(200);
    expect(world.sets).toEqual([
      { pushWindowStartHour: 8, pushWindowEndHour: 20 },
    ]);
    expect(await response.json()).toEqual({
      settings: {
        pushWindow: { startHour: 8, endHour: 20 },
        timeZone: "America/Guayaquil",
      },
    });
  });

  it.each([
    { startHour: 21, endHour: 9 },
    { startHour: 9, endHour: 25 },
    { startHour: 9.5, endHour: 21 },
  ])(
    "PATCH %o is a 400 `validation` with `fields.pushWindow` and writes nothing",
    async (pushWindow) => {
      const response = await patch({ pushWindow });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("validation");
      expect(body.fields).toEqual({ pushWindow: expect.any(String) });
      expect(world.sets).toEqual([]);
    },
  );

  it("a body that is not JSON is 400 `invalid_body`", async () => {
    const response = await patch("{no-json");
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_body");
  });

  it("the guard's refusal is the answer, and nothing is read or written", async () => {
    world.auth.mockResolvedValue({
      response: NextResponse.json(
        { code: "missing_permission" },
        { status: 403 },
      ),
    });
    expect((await get()).status).toBe(403);
    expect(
      (await patch({ pushWindow: { startHour: 8, endHour: 20 } })).status,
    ).toBe(403);
    expect(world.sets).toEqual([]);
  });
});
