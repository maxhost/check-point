import { describe, expect, it } from "vitest";
import { buildPassJson } from "./wallet/apple";
import { buildLoyaltyObject, buildObjectPatch } from "./wallet/google-object";
import {
  MAX_PASS_LOCATIONS,
  type PassLocation,
  type PassPlacementRow,
  toPassLocations,
} from "./wallet/pass-locations";
import type { PassBuildInput } from "./wallet/provider";

/**
 * The doors of spec 0065 reaching the pass (phase A4): the pure mapper from
 * `consumer.pass_placement` and the two builders that render it. No DB — the reader is
 * `pass-locations-store.ts` and the wiring of the three emission call-sites has its own
 * file (`wallet-pass-locations-wiring.test.ts`).
 */

const BASE: PassBuildInput = {
  serialNumber: "serial-abc_123-XYZ",
  qrToken: "QR-TOKEN-abc123_-",
  firstName: "Marcos",
  lastName: "Pérez",
  origin: "https://app.mipasaporte.test",
  webViewToken: "WEB-VIEW-TOKEN-xyz_-",
  passLocations: [],
};

function row(over: Partial<PassPlacementRow> = {}): PassPlacementRow {
  return {
    locationId: "loc-1",
    latitude: "-34.6083000",
    longitude: "-58.3712000",
    relevantText: "Bar La Esquina: 2x1 en picadas",
    businessName: "Bar La Esquina",
    turnId: null,
    turnMessage: null,
    ...over,
  };
}

function door(over: Partial<PassLocation> = {}): PassLocation {
  return {
    locationId: "loc-1",
    latitude: -34.6083,
    longitude: -58.3712,
    relevantText: "Bar La Esquina: 2x1 en picadas",
    businessName: "Bar La Esquina",
    turn: null,
    ...over,
  };
}

describe("toPassLocations: pass_placement rows → renderable doors", () => {
  it("returns the coordinates as NUMBERS, not the driver's numeric strings", () => {
    const [d] = toPassLocations([row()]);
    expect(typeof d.latitude).toBe("number");
    expect(typeof d.longitude).toBe("number");
    expect(d.latitude).toBe(-34.6083);
    expect(d.longitude).toBe(-58.3712);
  });

  it("DROPS a door without coordinates (nullable by spec 0061) and keeps the rest", () => {
    const doors = toPassLocations([
      row({ locationId: "no-geo", latitude: null, longitude: null }),
      row({ locationId: "lat-only", longitude: null }),
      row({ locationId: "lng-only", latitude: null }),
      row({ locationId: "good" }),
    ]);
    expect(doors.map((d) => d.locationId)).toEqual(["good"]);
  });

  it("drops a non-numeric coordinate instead of shipping NaN", () => {
    const doors = toPassLocations([
      row({ latitude: "" }),
      row({ latitude: "x" }),
    ]);
    expect(doors).toEqual([]);
  });

  it("builds the turn only when the row carries a turn WITH its message snapshot", () => {
    const [utility] = toPassLocations([row()]);
    expect(utility.turn).toBeNull();
    const [orphan] = toPassLocations([
      row({ turnId: "t-1", turnMessage: null }),
    ]);
    expect(orphan.turn).toBeNull();
    const [turn] = toPassLocations([
      row({ turnId: "t-1", turnMessage: "2x1 en picadas" }),
    ]);
    expect(turn.turn).toEqual({ turnId: "t-1", message: "2x1 en picadas" });
  });

  it("preserves the order the reader asked the database for", () => {
    const doors = toPassLocations([
      row({ locationId: "a" }),
      row({ locationId: "b" }),
      row({ locationId: "c" }),
    ]);
    expect(doors.map((d) => d.locationId)).toEqual(["a", "b", "c"]);
  });
});

describe("buildPassJson: Apple `locations`", () => {
  const twelve = Array.from({ length: 12 }, (_, i) =>
    door({
      locationId: `loc-${i}`,
      latitude: -34 - i / 100,
      longitude: -58 - i / 100,
      relevantText: `Puerta ${i}`,
    }),
  );
  const pass = buildPassJson({
    ...BASE,
    passLocations: twelve,
    passTypeIdentifier: "pass.com.mipasaporte.test",
    teamIdentifier: "TEAM123456",
    authenticationToken: "auth-token-raw",
  });
  const locations = pass.locations as Record<string, unknown>[];

  it(`caps the array at Apple's ${MAX_PASS_LOCATIONS}`, () => {
    expect(MAX_PASS_LOCATIONS).toBe(10);
    expect(locations).toHaveLength(10);
    expect(locations.map((l) => l.relevantText)).toEqual(
      twelve.slice(0, 10).map((d) => d.relevantText),
    );
  });

  it("carries latitude/longitude as numbers plus the relevantText of the door", () => {
    expect(locations[0]).toEqual({
      latitude: -34,
      longitude: -58,
      relevantText: "Puerta 0",
    });
    for (const l of locations) {
      expect(typeof l.latitude).toBe("number");
      expect(typeof l.longitude).toBe("number");
      expect(typeof l.relevantText).toBe("string");
    }
  });

  it("does NOT write maxDistance — not on the pass, not on a location (ADR 0065)", () => {
    expect("maxDistance" in pass).toBe(false);
    for (const l of locations)
      expect(Object.keys(l).sort()).toEqual([
        "latitude",
        "longitude",
        "relevantText",
      ]);
    expect(JSON.stringify(pass)).not.toContain("maxDistance");
  });

  it("a consumer with no doors gets an empty array, not a missing key", () => {
    const empty = buildPassJson({
      ...BASE,
      passTypeIdentifier: "pass.com.mipasaporte.test",
      teamIdentifier: "TEAM123456",
      authenticationToken: "auth-token-raw",
    });
    expect(empty.locations).toEqual([]);
  });
});

describe("buildLoyaltyObject: Google merchantLocations + per-turn modules", () => {
  const doors = [
    door({
      locationId: "u-1",
      relevantText: "Café Central: te faltan 2 sellos",
      businessName: "Café Central",
    }),
    door({
      locationId: "t-loc",
      latitude: -34.61,
      longitude: -58.38,
      relevantText: "Bar La Esquina: 2x1 en picadas",
      businessName: "Bar La Esquina",
      turn: { turnId: "turn-uuid-1", message: "2x1 en picadas" },
    }),
  ];
  const object = buildLoyaltyObject(
    { ...BASE, latestMessage: "Se acreditó 1 sello 🎉", passLocations: doors },
    "3388000000000000000",
  );

  it("writes `merchantLocations` with numeric coordinates", () => {
    expect(object.merchantLocations).toEqual([
      { latitude: -34.6083, longitude: -58.3712 },
      { latitude: -34.61, longitude: -58.38 },
    ]);
    for (const l of object.merchantLocations as Record<string, unknown>[])
      expect(typeof l.latitude).toBe("number");
  });

  it("does NOT use the deprecated `locations` field (a silent no-op for geo triggers)", () => {
    expect("locations" in object).toBe(false);
    expect(Object.keys(object)).toContain("merchantLocations");
  });

  it("adds one 'Cerca tuyo' module per turn door, next to 'Última novedad'", () => {
    expect(object.textModulesData).toEqual([
      {
        id: "latest",
        header: "Última novedad",
        body: "Se acreditó 1 sello 🎉",
      },
      {
        id: "turn-turn-uuid-1",
        header: "Cerca tuyo",
        body: "Bar La Esquina — 2x1 en picadas",
      },
    ]);
  });

  it("a utility-only door adds no module (Google has no per-location text to show)", () => {
    const utilityOnly = buildLoyaltyObject(
      { ...BASE, passLocations: [doors[0]] },
      "3388000000000000000",
    );
    expect(utilityOnly.merchantLocations).toHaveLength(1);
    expect(utilityOnly.textModulesData).toEqual([]);
  });

  it("caps merchantLocations and the modules at the same 10 doors", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      door({
        locationId: `loc-${i}`,
        latitude: -34 - i / 100,
        turn: { turnId: `t-${i}`, message: `oferta ${i}` },
      }),
    );
    const big = buildLoyaltyObject(
      { ...BASE, passLocations: many },
      "3388000000000000000",
    );
    expect(big.merchantLocations).toHaveLength(10);
    expect(big.textModulesData).toHaveLength(10);
  });
});

describe("buildObjectPatch: the body of the silent pass_refresh PATCH", () => {
  it("ships the doors AND the 'Última novedad' module, so a refresh never wipes it", () => {
    const patch = buildObjectPatch({
      latestMessage: "Se acreditaron 30 puntos 🎉",
      passLocations: [
        door({ turn: { turnId: "t-9", message: "postre gratis" } }),
      ],
    });
    expect(patch).toEqual({
      merchantLocations: [{ latitude: -34.6083, longitude: -58.3712 }],
      textModulesData: [
        {
          id: "latest",
          header: "Última novedad",
          body: "Se acreditaron 30 puntos 🎉",
        },
        {
          id: "turn-t-9",
          header: "Cerca tuyo",
          body: "Bar La Esquina — postre gratis",
        },
      ],
    });
  });

  it("a consumer with no doors and no notice patches EMPTY arrays (the pass is cleared)", () => {
    expect(
      buildObjectPatch({ latestMessage: null, passLocations: [] }),
    ).toEqual({ merchantLocations: [], textModulesData: [] });
  });
});
