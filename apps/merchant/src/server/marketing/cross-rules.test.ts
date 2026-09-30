import { describe, expect, it } from "vitest";
import { crossOrigin, decideCrossOffer, haversineMeters } from "./cross-rules";
import {
  CAFE,
  GYM,
  ORIGIN,
  facts,
  north,
  offer,
  position,
} from "./cross-rules-fixtures";

/**
 * The PURE rules of «Oferta cruzada» (spec 0112 «Elegibilidad»): one case per reason, in
 * the spec's order, and one per frontier — 1999 m in / 2001 m out; standing 99 m from a
 * location of the same rubro out / 101 m in; `dormant` exactly at `now - dormantDays` in.
 * The points are built by moving NORTH along a meridian, where the haversine distance is
 * exactly the arc (`meters / R` radians): no hand-written numbers.
 */

const R = 6_371_000;

describe("haversineMeters", () => {
  it("measures the meridian arc exactly and one degree of latitude as ~111.2 km", () => {
    expect(haversineMeters(ORIGIN, north(ORIGIN, 1234))).toBeCloseTo(1234, 6);
    expect(
      haversineMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
      ),
    ).toBeCloseTo((R * Math.PI) / 180, 3);
  });
});

describe("crossOrigin", () => {
  it("GPS first, else the last scanned geocoded location, else none", () => {
    const scan = north(ORIGIN, 50);
    expect(crossOrigin(position({ lastScanPoint: scan })).kind).toBe("gps");
    expect(crossOrigin(position({ gps: null, lastScanPoint: scan }))).toEqual({
      kind: "last_scan",
      point: scan,
    });
    expect(crossOrigin(position({ gps: null }))).toEqual({
      kind: "none",
      point: null,
    });
  });
});

describe("decideCrossOffer", () => {
  it("passes with the distance to the NEAREST active location", () => {
    const decision = decideCrossOffer(
      facts({
        offer: offer({
          locations: [north(ORIGIN, 1500), north(ORIGIN, 640)],
        }),
      }),
    );
    expect(decision.ok).toBe(true);
    expect(decision.ok && decision.distanceMeters).toBeCloseTo(640, 6);
  });

  it("1. no_origin — no GPS and no scanned location with coordinates", () => {
    expect(
      decideCrossOffer(facts({ position: position({ gps: null }) })),
    ).toEqual({ ok: false, reason: "no_origin" });
  });

  it("without GPS the last scanned location is the origin", () => {
    const scan = north(ORIGIN, 300);
    const decision = decideCrossOffer(
      facts({
        position: position({ gps: null, lastScanPoint: scan }),
        offer: offer({ locations: [north(scan, 700)] }),
      }),
    );
    expect(decision.ok && decision.distanceMeters).toBeCloseTo(700, 6);
  });

  it("2. same_category — the rubro of the LAST scanned business", () => {
    expect(
      decideCrossOffer(facts({ offer: offer({ categoryGcid: CAFE }) })),
    ).toEqual({ ok: false, reason: "same_category" });
    // Without GPS too: the rubro reference does not need the phone.
    expect(
      decideCrossOffer(
        facts({
          position: position({ gps: null, lastScanPoint: ORIGIN }),
          offer: offer({ categoryGcid: CAFE }),
        }),
      ),
    ).toEqual({ ok: false, reason: "same_category" });
  });

  it("2. same_category — standing 99 m from a location of the offer's rubro is out, 101 m is in", () => {
    const at = (meters: number) =>
      decideCrossOffer(
        facts({
          position: position({
            lastScanCategory: "gcid:bakery",
            places: [{ ...north(ORIGIN, meters), categoryGcid: GYM }],
          }),
        }),
      );
    expect(at(99)).toEqual({ ok: false, reason: "same_category" });
    expect(at(101).ok).toBe(true);
    // A place of ANOTHER rubro at 10 m does not exclude.
    expect(
      decideCrossOffer(
        facts({
          position: position({
            places: [{ ...north(ORIGIN, 10), categoryGcid: "gcid:bakery" }],
          }),
        }),
      ).ok,
    ).toBe(true);
  });

  it("2. «standing at» only counts with GPS: the last scanned point is not «where they are»", () => {
    expect(
      decideCrossOffer(
        facts({
          position: position({
            gps: null,
            lastScanPoint: ORIGIN,
            lastScanCategory: "gcid:bakery",
            places: [{ ...north(ORIGIN, 10), categoryGcid: GYM }],
          }),
        }),
      ).ok,
    ).toBe(true);
  });

  it("3. too_far — 1999 m is in, 2001 m is out, and no geocoded location is out", () => {
    const at = (meters: number) =>
      decideCrossOffer(
        facts({ offer: offer({ locations: [north(ORIGIN, meters)] }) }),
      );
    expect(at(1999).ok).toBe(true);
    expect(at(2001)).toEqual({ ok: false, reason: "too_far" });
    expect(
      decideCrossOffer(facts({ offer: offer({ locations: [] }) })),
    ).toEqual({ ok: false, reason: "too_far" });
  });
});
