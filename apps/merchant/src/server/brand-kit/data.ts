import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { businesses, locations, loyaltyPrograms } from "../schema";
import { enrollUrl } from "./enroll-url";
import { renderEnrollQr } from "./qr";

// Brand kit data layer (spec 0041). Gathers, in one round-trip, everything the wizard
// needs: the business marca (name + 3 colors + public `logoPath`, NEVER the internal
// R2 `logoObjectKey`), the single operational program (its id + kind), the list of
// locales, and a pre-rendered EC-H QR SVG per scope (global + one per local when 2+).

/** Client-facing marca shape. Built by allow-list so it can NEVER serialize the
 * internal R2 `logoObjectKey` — only the public `logoPath` (same rule as brandResponse). */
export type KitBusiness = {
  name: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoPath: string | null;
};

export type KitLocation = { id: string; name: string };

/** One poster scope: global or a specific local. `qrSvg` is the EC-H, black-module QR
 * (pre-rendered server-side); the client recolors/overlays it without a round-trip. */
export type KitScope = {
  key: string;
  label: string;
  locationId: string | null;
  enrollUrl: string;
  qrSvg: string;
};

export type BrandKitReady = {
  status: "ready";
  business: KitBusiness;
  program: { id: string; kind: string };
  locations: KitLocation[];
  globalScope: KitScope;
  /** Empty when the business has fewer than 2 locales (no per-local posters). */
  locationScopes: KitScope[];
  defaults: { headline: string; subheadline: string };
};

/** No operational program (`active`/`closing`) → the whole wizard is blocked. The
 * "no logo" state is NOT here: it only blocks step 2, so `logoPath: null` carries it. */
export type BrandKitData = BrandKitReady | { status: "no_program" };

type BusinessRow = {
  id: string;
  name: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoObjectKey: string | null;
  logoVersion: number;
};

/** Pure marca DTO: strips `logoObjectKey`, derives the public `logoPath`. Testable. */
export function kitBusinessDTO(row: BusinessRow): KitBusiness {
  return {
    name: row.name,
    brandPrimaryColor: row.brandPrimaryColor,
    brandComplementaryColor: row.brandComplementaryColor,
    brandAccentColor: row.brandAccentColor,
    logoPath: row.logoObjectKey
      ? `/api/public/brands/${row.id}/logo?v=${row.logoVersion}`
      : null,
  };
}

/** Default poster copy by program `kind`. Editable in the preview (never persisted). */
export function kitDefaults(kind: string): {
  headline: string;
  subheadline: string;
} {
  if (kind === "stamps") {
    return {
      headline: "Completá tu tarjeta y llevate premios",
      subheadline: "Escaneá el código y sumá tu primer sello.",
    };
  }
  if (kind === "points") {
    return {
      headline: "Sumá puntos en cada visita",
      subheadline: "Escaneá el código y empezá a ganar.",
    };
  }
  return {
    headline: "Sumate a nuestro programa",
    subheadline: "Escaneá el código y registrate en segundos.",
  };
}

async function buildScope(
  origin: string,
  programId: string,
  key: string,
  label: string,
  locationId: string | null,
): Promise<KitScope> {
  const url = enrollUrl(origin, programId, locationId);
  return { key, label, locationId, enrollUrl: url, qrSvg: await renderEnrollQr(url) };
}

/**
 * Loads the brand-kit payload for `businessId`, deriving absolute enroll URLs from the
 * request `origin`. Returns `no_program` when the business has no operational program
 * (the wizard cannot enroll anyone). Per-local scopes are produced only for a business
 * with 2+ locales (spec: with 1 local there is no scope selector).
 */
export async function getBrandKitData(
  businessId: string,
  origin: string,
): Promise<BrandKitData> {
  const db = getDb();

  const [business] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      brandPrimaryColor: businesses.brandPrimaryColor,
      brandComplementaryColor: businesses.brandComplementaryColor,
      brandAccentColor: businesses.brandAccentColor,
      // Selected only to derive `logoPath`; the R2 key never leaves the server.
      logoObjectKey: businesses.logoObjectKey,
      logoVersion: businesses.logoVersion,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business) return { status: "no_program" };

  const [program] = await db
    .select({ id: loyaltyPrograms.id, kind: loyaltyPrograms.kind })
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.businessId, businessId),
        inArray(loyaltyPrograms.status, ["active", "closing"]),
      ),
    )
    .limit(1);
  if (!program) return { status: "no_program" };

  const locationList = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.businessId, businessId))
    .orderBy(asc(locations.name));

  const globalScope = await buildScope(
    origin,
    program.id,
    "global",
    "Global (todos los locales)",
    null,
  );

  const locationScopes =
    locationList.length >= 2
      ? await Promise.all(
          locationList.map((loc) =>
            buildScope(origin, program.id, loc.id, loc.name, loc.id),
          ),
        )
      : [];

  return {
    status: "ready",
    business: kitBusinessDTO(business),
    program: { id: program.id, kind: program.kind },
    locations: locationList,
    globalScope,
    locationScopes,
    defaults: kitDefaults(program.kind),
  };
}
