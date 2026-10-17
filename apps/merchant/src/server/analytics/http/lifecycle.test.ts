import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  decide: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("../../api-permission", () => ({
  requireApiPermissionSinGateDeEmail: mocks.auth,
}));
vi.mock("../../api-owner", () => ({
  apiOwnerFailureResponse: (failure: {
    status: number;
    code: string;
    message: string;
  }) =>
    Response.json(
      { code: failure.code, error: failure.message },
      { status: failure.status },
    ),
}));
vi.mock("../lifecycle", () => ({
  decideInboxCard: mocks.decide,
  cleanupInbox: mocks.cleanup,
  readInbox: vi.fn(),
}));
vi.mock("../evaluation", () => ({
  evaluateBusiness: vi.fn(),
  evaluateDueBusinesses: vi.fn(),
}));
vi.mock("../queries", () => ({
  AnalyticsError: class extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  readDay: vi.fn(),
  readHistory: vi.fn(),
}));
import { AnalyticsError } from "../queries";
import { cardPOST, cleanupGET, legacyCardPOST } from "./index";

const id = "00000000-0000-4000-8000-000000000008";
const command = {
  expectedVersion: "context-1",
  operationId: "00000000-0000-4000-8000-000000000099",
};
function request(body: unknown = command) {
  return new Request(
    `https://merchant.invalid/api/analytics/inbox/${id}/resolve`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  mocks.auth.mockResolvedValue({
    business: { id: "business-from-guard" },
    userId: "actor-from-guard",
    role: "owner",
    permissions: ["analytics"],
  });
  mocks.decide.mockResolvedValue({ cards: [], nextReminderAt: null });
  mocks.cleanup.mockResolvedValue({
    cutoff: "2026-07-22T15:00:00.000Z",
    deleted: 2,
    skipped: 1,
    budgetExhausted: false,
  });
});

describe("inbox v2 HTTP boundary", () => {
  it.each([401, 403])(
    "preserves auth failure %s without calling mutation",
    async (status) => {
      mocks.auth.mockResolvedValue({
        failure: {
          status,
          code: status === 401 ? "unauthorized" : "missing_permission",
          message: "Sin acceso",
        },
      });
      expect((await cardPOST(request(), id, "resolve")).status).toBe(status);
      expect(mocks.decide).not.toHaveBeenCalled();
    },
  );

  it("uses only guard tenant and actor, ignoring forged body identifiers", async () => {
    const response = await cardPOST(
      request({ ...command, businessId: "foreign", actorId: "foreign" }),
      id,
      "resolve",
    );
    expect(response.status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(
      {
        businessId: "business-from-guard",
        actorId: "actor-from-guard",
        cardId: id,
        decision: "resolve",
        ...command,
      },
      expect.objectContaining({ role: "owner" }),
    );
  });

  it.each([
    null,
    {},
    { ...command, expectedVersion: "" },
    { ...command, operationId: "" },
  ])("rejects malformed command without a write: %j", async (body) => {
    expect((await cardPOST(request(body), id, "resolve")).status).toBe(422);
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and unknown IDs before services", async () => {
    const malformed = new Request("https://merchant.invalid", {
      method: "POST",
      body: "{",
    });
    expect((await cardPOST(malformed, id, "ignore")).status).toBe(422);
    expect((await cardPOST(request(), "not-a-card", "ignore")).status).toBe(
      404,
    );
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it.each(["2026-10-21T10:00", "not-a-date", "2026-02-30T10:00:00Z"])(
    "rejects reminder without a real ISO instant: %s",
    async (remindAt) => {
      expect(
        (await cardPOST(request({ ...command, remindAt }), id, "snooze"))
          .status,
      ).toBe(422);
      expect(mocks.decide).not.toHaveBeenCalled();
    },
  );

  it("passes zoned reminder to the single lifecycle validator", async () => {
    const remindAt = "2026-10-21T10:30:00-05:00";
    expect(
      (await cardPOST(request({ ...command, remindAt }), id, "snooze")).status,
    ).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(
      expect.objectContaining({ remindAt }),
      expect.any(Object),
    );
  });

  it.each([
    [404, "card_not_found"],
    [409, "card_context_changed"],
    [409, "card_expired"],
    [409, "operation_conflict"],
    [422, "invalid_decision"],
    [422, "invalid_reminder"],
  ] as const)(
    "preserves domain %s %s without reinterpretation",
    async (status, code) => {
      mocks.decide.mockRejectedValue(
        new AnalyticsError(status, code, "Revisa el aviso."),
      );
      const response = await cardPOST(request(), id, "resolve");
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
    },
  );

  it("rejects old accept/dismiss semantics without modifying a card", async () => {
    const response = await legacyCardPOST(request(), id);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "inbox_contract_changed",
    });
    expect(mocks.decide).not.toHaveBeenCalled();
  });
});

describe("internal cleanup authentication", () => {
  it("does not run without a configured or matching bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(
      (await cleanupGET(new Request("https://merchant.invalid"))).status,
    ).toBe(401);
    vi.stubEnv("CRON_SECRET", "private-test-secret");
    expect(
      (
        await cleanupGET(
          new Request("https://merchant.invalid", {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("delegates bounded cleanup and returns only aggregate evidence", async () => {
    vi.stubEnv("CRON_SECRET", "private-test-secret");
    const response = await cleanupGET(
      new Request("https://merchant.invalid", {
        headers: { authorization: "Bearer private-test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cutoff: "2026-07-22T15:00:00.000Z",
      deleted: 2,
      skipped: 1,
      budgetExhausted: false,
    });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
});
