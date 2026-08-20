import { afterEach, describe, expect, it } from "vitest";
import {
  requestRecovery,
  resendRecovery,
  verifyRecovery,
} from "./consumer/recovery";

describe("recovery rollout flag", () => {
  afterEach(() => delete process.env.RECOVERY_ENABLED);

  it("fails closed before provider or database access", async () => {
    process.env.RECOVERY_ENABLED = "false";
    await expect(requestRecovery({})).rejects.toMatchObject({
      code: "recovery_disabled",
      status: 503,
    });
    await expect(resendRecovery({})).rejects.toMatchObject({
      code: "recovery_disabled",
      status: 503,
    });
    await expect(verifyRecovery({})).rejects.toMatchObject({
      code: "recovery_disabled",
      status: 503,
    });
  });
});
