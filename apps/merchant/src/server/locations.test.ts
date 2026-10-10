import { describe, expect, it } from "vitest";
import {
  LocationError,
  effectiveLocationLimit,
  isProviderSelection,
  parseLocationName,
  resolveAddress,
  toLocationDTO,
  type AddressInput,
  type LocationRow,
} from "./locations";
import {
  testSelectionToken,
  TRUJUI_PLACE,
} from "./places/selection-test-support";

process.env.BETTER_AUTH_SECRET ||= "unit-secret-at-least-32-chars-long-xxxx";

/**
 * Spec 0061 — the decisions of the locations domain that are PURE, with a table of cases
 * as the oracle. Everything that touches the database (the plan cap under the lock, the
 * superseded verification, the counter guard) is pinned by the `*.neon.integration`
 * files: none of it is claimed here.
 */
/**
 * Spec 0189 §D2 — el tope EFECTIVO de locales: el del plan EFECTIVO de la fila (prueba vigente,
 * plan pago con suscripción viva, o `none` sin acceso). Una cancelación programada ya NO baja el
 * tope: el negocio usa lo pagado hasta el fin del periodo (ADR 0134 §8).
 *
 * Lo que esta tabla NO pinnea: que los LLAMADORES usen esta función bajo el lock (eso es
 * `locations-races.neon.integration.test.ts`). El MENSAJE de `limitReached` y las columnas que
 * lee `planLocationLimit` viven en `locations-plan-cap.test.ts`.
 */
describe("locations — tope efectivo por plan efectivo (spec 0189 §D2)", () => {
  const NOW = new Date("2026-10-10T12:00:00.000Z");
  const FUTURE = new Date(NOW.getTime() + 1);
  const PAST = new Date(NOW.getTime() - 1);
  const row = (
    plan: string,
    stripeSubscriptionId: string | null,
    trialEndsAt: Date | null,
    status = "active",
  ) => ({ plan, status, stripeSubscriptionId, trialEndsAt });

  it.each<[string, ReturnType<typeof row> | null, number]>([
    ["prueba vigente", row("trial", null, FUTURE), 3],
    ["prueba vencida, sin suscripción", row("trial", null, PAST), 1],
    ["base con suscripción viva", row("base", "sub_1", PAST), 1],
    ["plus con suscripción viva", row("plus", "sub_1", PAST), 3],
    [
      "plus muerto con la prueba vencida",
      row("plus", "sub_1", PAST, "canceled"),
      1,
    ],
    [
      "plus muerto con la prueba vigente",
      row("plus", "sub_1", FUTURE, "canceled"),
      3,
    ],
    ["sin fila de suscripción", null, 1],
  ])("%s → %i", (_name, subscription, expected) => {
    expect(effectiveLocationLimit(subscription, NOW)).toBe(expected);
  });

  it("la fila de un `leftJoin` sin suscripción (columnas nulas) es fail-closed", () => {
    expect(
      effectiveLocationLimit(
        {
          plan: null,
          status: null,
          stripeSubscriptionId: null,
          trialEndsAt: null,
        },
        NOW,
      ),
    ).toBe(1);
  });
});

describe("locations — address classification (spec 0061 decision 3, spec 0155)", () => {
  it.each([
    ["a picked place (selection token)", { selectionToken: "abc.def" }, true],
    ["an empty token", { selectionToken: "" }, false],
    ["a non-string token", { selectionToken: 42 }, false],
    ["plain typed text", { label: "Av. Amazonas 123" }, false],
    [
      "the old Geoapify body (no token)",
      { provider: "geoapify", longitude: -78.5, latitude: -0.2 },
      false,
    ],
  ])("%s → provider selection: %o", (_case, input, expected) => {
    // The body is untrusted JSON: any shape can arrive, so the test passes it as such.
    expect(isProviderSelection(input as AddressInput)).toBe(expected);
  });

  it("a valid token becomes provider_verified/google with the token's data, ignoring the label", async () => {
    const address = await resolveAddress(
      {
        label: "lo que diga el navegador",
        selectionToken: testSelectionToken(),
      },
      "EC",
    );
    expect(address).toMatchObject({
      source: "provider_verified",
      provider: "google",
      providerPlaceId: "ChIJ-test-cuenca",
      label: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
      longitude: "-79.0137",
      latitude: "-2.9081",
      countryCode: "EC",
      attribution: null,
    });
  });

  it("a token from another country → 422 address_country_mismatch", async () => {
    await expect(
      resolveAddress(
        { selectionToken: testSelectionToken(TRUJUI_PLACE) },
        "UY",
      ),
    ).rejects.toMatchObject({ status: 422, code: "address_country_mismatch" });
  });

  it("a tampered token → 422 invalid_selection, never a typed fallback", async () => {
    const [payload] = testSelectionToken().split(".");
    await expect(
      resolveAddress(
        { label: "Calle 1", selectionToken: `${payload}.AAAA` },
        "EC",
      ),
    ).rejects.toMatchObject({ status: 422, code: "invalid_selection" });
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

  it("the old Geoapify body is typed text: its coordinates are never stored", async () => {
    // The dangerous shape: a body that CLAIMS a point. Without a signed token it must fall
    // to the typed class, not to the browser's coordinates (ADR 0054: a wrong datum is a lie).
    const address = await resolveAddress(
      {
        label: "Calle sin número",
        provider: "geoapify",
        longitude: 1,
        latitude: 2,
      },
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
