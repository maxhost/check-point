import { describe, expect, it } from "vitest";
import {
  LocationError,
  effectiveLocationLimit,
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

/**
 * Spec 0063, D2 — el tope EFECTIVO: el menor entre el plan VIGENTE y el plan DESTINO.
 *
 * El agujero que cierra: con una baja ya programada el negocio sigue en `plus` hasta el
 * fin del periodo, así que comparar contra el plan vigente deja desarchivar hasta 3
 * locales y al cerrar el periodo queda `free` con 3 activos — el estado que la spec entera
 * existe para prohibir.
 *
 * Lo que esta tabla NO pinnea: que los LLAMADORES usen esta función bajo el lock. Eso es
 * la carrera de desarchivado con `pending_plan` sembrado, que vive en
 * `locations-races.neon.integration.test.ts` y es fase B — hoy ese archivo no menciona
 * `pending_plan` (verificado por grep). Acá se pinnea la decisión, no el cableado.
 *
 * Tampoco están acá el MENSAJE de `limitReached` ni la derivación de `pendingDowngrade`
 * dentro de `planLocationLimit`: viven en `locations-plan-cap.test.ts`, partidos sólo por
 * el límite de 300 líneas de este archivo.
 */
describe("locations — tope efectivo con baja programada (spec 0063, D2)", () => {
  it.each<[string | null | undefined, string | null | undefined, number]>([
    // Sin baja programada manda el plan vigente, tal cual antes de esta spec.
    ["plus", null, 3],
    ["plus", undefined, 3],
    ["free", null, 1],
    ["none", null, 1],
    // Con la baja a `free` programada el tope cae YA, aunque el plan vigente siga `plus`.
    ["plus", "free", 1],
    ["free", "free", 1],
    // Un plan desconocido cae al tope más restrictivo por el fallback, de los dos lados.
    ["enterprise", null, 1],
    ["plus", "enterprise", 1],
    [null, null, 1],
  ])("plan %s + pendiente %s → %s", (plan, pendingPlan, expected) => {
    expect(effectiveLocationLimit(plan, pendingPlan)).toBe(expected);
  });

  it.each([[""], ["   "]])(
    "un `pending_plan` %s NO es una baja programada [R1-N8]",
    (pendingPlan) => {
      // El string vacío es el caso nombrado en la spec: sin este guard el tope caería a 1
      // sin que nadie haya programado nada, y el owner perdería locales por una columna
      // vacía. (`"   "` cae en 1 por el fallback de plan desconocido, no por el guard: se
      // asevera lo que la función hace, que es distinto del caso `""`.)
      expect(effectiveLocationLimit("plus", pendingPlan)).toBe(
        pendingPlan === "" ? 3 : 1,
      );
    },
  );

  it("es `min`, no «el pendiente gana»: un upgrade programado NO sube el tope", () => {
    // Si el pendiente ganara, un `free` con un `plus` programado permitiría 3 locales
    // ANTES de que el pago esté confirmado.
    expect(effectiveLocationLimit("free", "plus")).toBe(1);
    expect(effectiveLocationLimit("none", "plus")).toBe(1);
  });
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
