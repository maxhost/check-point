import { describe, expect, it } from "vitest";
import { restoredStage } from "./onboarding-flow";

describe("restauración del alta 0157", () => {
  it("empieza en negocio sin sesión", () =>
    expect(restoredStage({ authenticated: false })).toBe("business"));
  it("manda al panel toda sesión", () =>
    expect(
      restoredStage({
        authenticated: true,
        business: { id: "b", name: "Café", slug: "cafe" },
      }),
    ).toBe("panel"));
});
