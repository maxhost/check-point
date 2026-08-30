import { afterEach, describe, expect, it } from "vitest";
import { config, middleware } from "./middleware";

/**
 * Pins the only DoD criterion of spec 0046 whose evidence was otherwise the emitted
 * bundle rather than a test: `/forgot-password` must answer 503 while the feature is
 * off. Renaming the env var or widening the matcher now turns something red.
 */
afterEach(() => {
  delete process.env.PASSWORD_RECOVERY_ENABLED;
});

describe("forgot-password gate middleware (spec 0046)", () => {
  it("answers 503 when the feature is off", () => {
    expect(middleware().status).toBe(503);
  });

  it("answers 503 for any value other than the exact string 'true'", () => {
    process.env.PASSWORD_RECOVERY_ENABLED = "1";
    expect(middleware().status).toBe(503);
    process.env.PASSWORD_RECOVERY_ENABLED = "TRUE";
    expect(middleware().status).toBe(503);
  });

  it("lets the page through when the feature is on", () => {
    process.env.PASSWORD_RECOVERY_ENABLED = "true";
    // `NextResponse.next()` is a 200 pass-through, not a 503 short-circuit.
    expect(middleware().status).not.toBe(503);
  });

  it("only intercepts /forgot-password", () => {
    // A wider matcher would put this gate in front of unrelated routes.
    expect(config.matcher).toEqual(["/forgot-password"]);
  });
});
