import { describe, expect, it } from "vitest";
import {
  LocationError,
  isProviderSelection,
  locationLimitForPlan,
  parseLocationName,
  resolveAddress,
  toLocationDTO,
  type LocationRow,
} from "./locations";

/**
 * Spec 0061 — the decisions of the locations domain that are PURE, with a table of cases
 * as the oracle. Everything that touches the database (the plan cap under the lock, the
 * superseded verification, the counter guard) is pinned by the `*.neon.integration`
 * files: none of it is claimed here.
 */
describe("locations — plan cap (spec 0061, decision 2)", () => {
  it.each([
    ["free", 1],
    ["plus", 3],
  ])("plan %s allows %i active locations", (plan, limit) => {
    expect(locationLimitForPlan(plan)).toBe(limit);
  });

  it.each([[null], [undefined], ["enterprise"], [""], ["FREE"]])(
    "an unknown plan (%p) falls back to the most restrictive tier",
    (plan) => {
      expect(locationLimitForPlan(plan as string | null)).toBe(1);
    },
  );
});

describe("locations — address classification (spec 0061, decision 3)", () => {
  it.each([
    [
      "a picked suggestion",
      { provider: "geoapify", longitude: -78.5, latitude: -0.2 },
      true,
    ],
    ["a provider without coordinates", { provider: "geoapify" }, false],
    [
      "a provider with only longitude",
      { provider: "geoapify", longitude: -78.5 },
      false,
    ],
    [
      "NaN coordinates",
      { provider: "geoapify", longitude: NaN, latitude: 1 },
      false,
    ],
    [
      "string coordinates",
      { provider: "geoapify", longitude: "-78.5", latitude: "-0.2" },
      false,
    ],
    ["plain typed text", { label: "Av. Amazonas 123" }, false],
    [
      "another provider",
      { provider: "mapbox", longitude: 1, latitude: 2 },
      false,
    ],
  ])("%s → provider selection: %o", (_case, input, expected) => {
    expect(isProviderSelection(input)).toBe(expected);
  });

  it("typed text becomes owner_typed with NO coordinates", async () => {
    const address = await resolveAddress(
      { label: "  Av. Amazonas 123  " },
      "EC",
    );
    expect(address).toEqual({
      source: "owner_typed",
      provider: null,
      providerPlaceId: null,
      label: "Av. Amazonas 123",
      longitude: null,
      latitude: null,
      countryCode: "EC",
      snapshot: {},
      attribution: null,
    });
  });

  it("a body claiming a provider WITHOUT coordinates never fabricates one", async () => {
    // The dangerous shape: `provider` present, coordinates missing. It must fall to the
    // typed class, not to an invented point (ADR 0054: a wrong datum is a lie).
    const address = await resolveAddress(
      { label: "Calle sin número", provider: "geoapify" },
      "EC",
    );
    expect(address.source).toBe("owner_typed");
    expect(address.longitude).toBeNull();
    expect(address.latitude).toBeNull();
    expect(address.provider).toBeNull();
  });

  it("an empty typed address is rejected", async () => {
    await expect(resolveAddress({ label: "   " }, "EC")).rejects.toMatchObject({
      status: 422,
      code: "invalid_input",
    });
  });

  it("an unsupported country is rejected before anything is written", async () => {
    await expect(
      resolveAddress({ label: "Rue de Rivoli" }, "FR"),
    ).rejects.toBeInstanceOf(LocationError);
    await expect(
      resolveAddress({ label: "Rue de Rivoli" }, "FR"),
    ).rejects.toMatchObject({ status: 422, code: "unsupported_country" });
  });
});

describe("locations — name validation", () => {
  it("trims", () => {
    expect(parseLocationName("  Sucursal Centro  ")).toBe("Sucursal Centro");
  });

  it.each([[""], ["   "], [null], [undefined], [42], [{}]])(
    "rejects %p",
    (value) => {
      expect(() => parseLocationName(value)).toThrow(LocationError);
    },
  );

  it("rejects a name over 120 characters", () => {
    expect(() => parseLocationName("x".repeat(121))).toThrow(LocationError);
    expect(parseLocationName("x".repeat(120))).toHaveLength(120);
  });
});

describe("locations — the DTO is an allow-list (spec 0061, decision 5)", () => {
  it("keeps exactly name, address and status — and drops everything else", () => {
    const row = {
      id: "loc-1",
      name: "Centro",
      addressLabel: "Av. Amazonas 123",
      status: "active",
      // Columns that exist on `core.location` and must NEVER reach the browser: the raw
      // provider payload, the coordinates, and the provenance pointer. If a future
      // `select()` widens and these ride along, this test goes red.
      addressSnapshot: { formatted: "Av. Amazonas 123", place_id: "secret" },
      longitude: "-78.5",
      latitude: "-0.2",
      countryCode: "EC",
      activeVerificationId: "ver-1",
      businessId: "biz-1",
    } as unknown as LocationRow;

    expect(Object.keys(toLocationDTO(row)).sort()).toEqual([
      "addressLabel",
      "id",
      "name",
      "status",
    ]);
  });

  it("normalizes any unexpected status to 'active' rather than leaking it", () => {
    const dto = toLocationDTO({
      id: "loc-1",
      name: "Centro",
      addressLabel: "Av. Amazonas 123",
      status: "archived",
    });
    expect(dto.status).toBe("archived");
    expect(
      toLocationDTO({
        id: "loc-1",
        name: "Centro",
        addressLabel: "x",
        status: "weird",
      }).status,
    ).toBe("active");
  });
});
