import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recovery = vi.hoisted(() => ({
  requestRecovery: vi.fn(),
  resendRecovery: vi.fn(),
  verifyRecovery: vi.fn(),
  completeRecoveryProfile: vi.fn(),
}));

vi.mock("./consumer/recovery", () => recovery);

import { POST as requestRoute } from "../app/api/public/recovery/request/route";
import { POST as resendRoute } from "../app/api/public/recovery/resend/route";
import { POST as verifyRoute } from "../app/api/public/recovery/verify/route";
import { POST as profileRoute } from "../app/api/public/recovery/profile/route";

function post(path: string, body: unknown, cookie?: string) {
  return new NextRequest(`https://checkpass.test${path}`, {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
    body: JSON.stringify(body),
  });
}

describe("public recovery route DTOs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("request and resend expose only their closed public DTOs", async () => {
    recovery.requestRecovery.mockResolvedValue({
      challengeId: "challenge-1",
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    });
    const requested = await requestRoute(
      post("/api/public/recovery/request", {
        phoneE164: "+593999999999",
        countryIso: "EC",
      }),
    );
    expect(requested.status).toBe(202);
    expect(await requested.json()).toEqual({
      challengeId: "challenge-1",
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    });

    recovery.resendRecovery.mockResolvedValue({ expiresInSeconds: 239 });
    const resent = await resendRoute(
      post("/api/public/recovery/resend", { challengeId: "challenge-1" }),
    );
    expect(resent.status).toBe(202);
    expect(await resent.json()).toEqual({ expiresInSeconds: 239 });
  });

  it("verify keeps session/onboarding tokens HttpOnly and out of JSON", async () => {
    recovery.verifyRecovery.mockResolvedValue({
      next: "wallet",
      sessionToken: "session-secret",
    });
    const wallet = await verifyRoute(
      post("/api/public/recovery/verify", {
        challengeId: "challenge-1",
        code: "123456",
      }),
    );
    expect(await wallet.json()).toEqual({ next: "wallet" });
    expect(wallet.headers.get("set-cookie")).toContain("HttpOnly");
    expect(wallet.headers.get("set-cookie")).not.toBeNull();

    recovery.verifyRecovery.mockResolvedValue({
      next: "profile",
      onboardingToken: "onboarding-secret",
    });
    const profile = await verifyRoute(
      post("/api/public/recovery/verify", {
        challengeId: "challenge-2",
        code: "123456",
      }),
    );
    expect(await profile.json()).toEqual({ next: "profile" });
    expect(profile.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("profile consumes its scoped cookie and returns no bearer token", async () => {
    recovery.completeRecoveryProfile.mockResolvedValue({
      sessionToken: "new-session-secret",
    });
    const response = await profileRoute(
      post(
        "/api/public/recovery/profile",
        { firstName: "Ana", lastName: "Paz", countryIso: "EC" },
        "consumer_recovery_onboarding=onboarding-secret",
      ),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ next: "wallet" });
    expect(recovery.completeRecoveryProfile).toHaveBeenCalledWith(
      expect.anything(),
      "onboarding-secret",
    );
  });
});
