import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0103 §9 — `POST /api/public/push/click`. The writer is doubled; what is pinned is
 * the contract: 204 for ANY uuid (known or not — the endpoint reveals no ids), 400
 * `invalid_body` otherwise, and the id reaching the writer untouched. The `update` itself
 * (first click wins, only a sent push) is pinned against the database in
 * `marketing-push-delivery.neon.integration.test.ts`.
 */
const world = vi.hoisted(() => ({ recordPushClick: vi.fn() }));
vi.mock("./marketing/push-delivery", () => ({
  recordPushClick: world.recordPushClick,
}));

import { POST } from "../app/api/public/push/click/route";

const ID = "33333333-3333-4333-8333-333333333333";
const click = (body: unknown) =>
  POST(
    new Request("https://merchant.test/api/public/push/click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/public/push/click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.recordPushClick.mockResolvedValue(undefined);
  });

  it("a uuid is 204 with no body, and reaches the writer as is", async () => {
    const response = await click({ id: ID });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(world.recordPushClick).toHaveBeenCalledWith(ID);
  });

  it.each([{}, { id: "nope" }, { id: 7 }, "{no-json", null])(
    "%o is 400 `invalid_body` and writes nothing",
    async (body) => {
      const response = await click(body);
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_body");
      expect(world.recordPushClick).not.toHaveBeenCalled();
    },
  );
});
