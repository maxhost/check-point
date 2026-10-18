import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  h,
  secret,
  nativeSession,
  joined,
  surfaces,
  makeRequest,
  domainCalls,
} from "./backoffice-scope-http.test-support";
import { backofficeScopeKey } from "./backoffice-scope";
import { backofficeScopeFailure } from "./backoffice-scope-http";
const mark = (
  sessionId = "session-a",
  userId = "user-a",
  businessId = "business-a",
) => backofficeScopeKey({ sessionId, userId, businessId }, secret);
const changed = {
  code: "backoffice_context_changed",
  error: "Tu sesión cambió. Actualiza el panel para continuar.",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BETTER_AUTH_SECRET", secret);
  h.native.mockResolvedValue(nativeSession());
  h.join.mockResolvedValue(joined());
  h.read.mockResolvedValue({ state: "ready", cards: [], nextReminderAt: null });
  h.decide.mockResolvedValue({ cards: [] });
  h.list.mockResolvedValue([]);
  h.toggle.mockResolvedValue({ id: "synthetic-module", enabled: true });
  h.facts.mockResolvedValue({ items: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("legacy absence alone skips native context and secret requirements", async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "");
  expect(
    await backofficeScopeFailure(
      new Request("https://merchant.test"),
      "business-a",
    ),
  ).toBeNull();
  expect(h.native).not.toHaveBeenCalled();
  expect(h.join).not.toHaveBeenCalled();
});
it.each([
  "",
  "x",
  "a".repeat(63),
  "a".repeat(65),
  "A".repeat(64),
  "g".repeat(64),
])(
  "malformed header rejects without a scope/signing auth read",
  async (header) => {
    const response = await backofficeScopeFailure(
      makeRequest(surfaces[0], header),
      "business-a",
    );
    expect(response?.status).toBe(409);
    expect(await response?.json()).toEqual(changed);
    expect(response?.headers.get("cache-control")).toBe("private, no-store");
    expect(h.native).not.toHaveBeenCalled();
  },
);
it.each(surfaces)(
  "$name legacy preserves success and never requires raw session ID/secret",
  async (surface) => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    h.native.mockResolvedValue({ user: { id: "user-a", emailVerified: true } });
    const response = await surface.call(makeRequest(surface));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(h.native).toHaveBeenCalledTimes(1);
    expect(h.join).toHaveBeenCalledTimes(1);
  },
);
it.each(surfaces)(
  "$name matching scope shares auth/JOIN and allows original domain",
  async (surface) => {
    const response = await surface.call(makeRequest(surface, mark()));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(h.native).toHaveBeenCalledTimes(1);
    expect(h.join).toHaveBeenCalledTimes(1);
    expect(domainCalls()).toBe(1);
  },
);
it.each(surfaces)(
  "$name mismatch has exact private409 and no read/exposure/write",
  async (surface) => {
    const response = await surface.call(
      makeRequest(surface, mark("session-other")),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(changed);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
    expect(h.native).toHaveBeenCalledTimes(1);
    expect(h.join).toHaveBeenCalledTimes(1);
  },
);
it.each(surfaces)(
  "$name empty is opt-in mismatch rather than legacy",
  async (surface) => {
    expect((await surface.call(makeRequest(surface, ""))).status).toBe(409);
    expect(domainCalls()).toBe(0);
  },
);
it.each(surfaces)(
  "$name cookie auth denial takes precedence over malformed scope",
  async (surface) => {
    h.native.mockResolvedValue(null);
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
    expect(h.join).not.toHaveBeenCalled();
  },
);
it.each(surfaces)(
  "$name suspended and billing denials precede409",
  async (surface) => {
    const data = joined();
    data.member.businessStatus = "suspended";
    h.join.mockResolvedValue(data);
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("business_suspended");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
  },
);
it.each(surfaces)("$name blocked billing precedes409", async (surface) => {
  const data = joined();
  h.join.mockResolvedValue({
    ...data,
    billing: {
      access: "blocked",
      trialEndsAt: null,
      failure: {
        status: 402,
        code: "payment_required",
        message: "Pago requerido",
      },
    },
  });
  const response = await surface.call(makeRequest(surface, "bad"));
  expect(response.status).toBe(402);
  expect((await response.json()).code).toBe("payment_required");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(domainCalls()).toBe(0);
});
it.each(surfaces.slice(0, 3))(
  "$name staff PIN precedes409 without extra selection",
  async (surface) => {
    const data = joined();
    data.member.role = "staff";
    data.member.pinMustChange = true;
    h.join.mockResolvedValue(data);
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("pin_change_required");
    expect(domainCalls()).toBe(0);
    expect(h.join).toHaveBeenCalledTimes(1);
  },
);
it.each([surfaces[2], surfaces[3], surfaces[5]])(
  "$name owner email precedes409; sisters omit gate",
  async (surface) => {
    h.native.mockResolvedValue({
      ...nativeSession(),
      user: { id: "user-a", emailVerified: false },
    });
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("email_not_verified");
    expect(domainCalls()).toBe(0);
  },
);
it.each([surfaces[0], surfaces[1], surfaces[4]])(
  "$name email-exempt owner still reaches scope",
  async (surface) => {
    h.native.mockResolvedValue({
      ...nativeSession(),
      user: { id: "user-a", emailVerified: false },
    });
    expect((await surface.call(makeRequest(surface, "bad"))).status).toBe(409);
    expect(domainCalls()).toBe(0);
  },
);
it("binds new session for the same account/business without selecting another mode", async () => {
  h.native.mockResolvedValue({
    ...nativeSession(),
    session: { id: "session-new" },
  });
  expect(
    (await surfaces[0].call(makeRequest(surfaces[0], mark()))).status,
  ).toBe(409);
  expect(h.join.mock.calls[0]?.[1]).toBe("active-member");
  expect(h.join).toHaveBeenCalledTimes(1);
  expect(domainCalls()).toBe(0);
});
it("staff A / owner B uses the guard's exact mode instead of page/owner reselection", async () => {
  h.join.mockImplementation(async (_user, mode) => {
    const data = joined();
    if (mode === "active-owner") data.member.id = "business-b";
    else data.member.role = "staff";
    return data;
  });
  expect(
    (await surfaces[0].call(makeRequest(surfaces[0], mark()))).status,
  ).toBe(200);
  expect(h.join.mock.calls.map((c) => c[1])).toEqual(["active-member"]);
});
it.each(surfaces)(
  "$name native auth rejection is a private503, never409",
  async (surface) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.native.mockRejectedValue(new TypeError("private-infrastructure-secret"));
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain(
      "private-infrastructure-secret",
    );
    expect(domainCalls()).toBe(0);
  },
);
it.each(surfaces)(
  "$name handled domain failure is private503",
  async (surface) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const fn of [h.read, h.decide, h.list, h.toggle, h.facts, h.tour])
      fn.mockRejectedValue(new Error("private-domain-secret"));
    const response = await surface.call(makeRequest(surface, mark()));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain(
      "private-domain-secret",
    );
  },
);
it.each([surfaces[1], surfaces[3], surfaces[5]])(
  "$name body validation retains native code with private cache",
  async (surface) => {
    const response = await surface.call(makeRequest(surface, mark(), null));
    expect(response.status).toBe(surface.name === "tour POST" ? 400 : 422);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
  },
);
it.each(surfaces)(
  "$name missing membership denies before malformed scope",
  async (surface) => {
    h.join.mockResolvedValue(null);
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
  },
);
it.each(surfaces)(
  "$name invalid signing configuration is unavailable, never409",
  async (surface) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const response = await surface.call(makeRequest(surface, mark()));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
  },
);

it.each(surfaces.slice(0, 2))(
  "$name missing analytics permission precedes409",
  async (surface) => {
    const data = joined();
    data.member.role = "staff";
    data.member.permissions = [];
    h.join.mockResolvedValue(data);
    const response = await surface.call(makeRequest(surface, "bad"));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("missing_permission");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(domainCalls()).toBe(0);
  },
);
