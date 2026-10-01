/**
 * The PURE Google Wallet constructors: the Loyalty Class/Object ids, the Loyalty Object
 * itself and the two request shapes (`addMessage` and the silent object `PATCH`). No
 * network and no secrets — split out of `google.ts` so that file keeps only the JWT/HTTP
 * side and both stay under the file-size budget (spec 0065 phase A4, which is what grew
 * this half: the pass locations). Re-exported from `./google` so existing importers do
 * not change.
 */

import { WALLET_BRAND } from "./core";
import { MAX_PASS_LOCATIONS } from "./pass-locations";
import type { PassBuildInput } from "./provider";

/** Class suffix under the issuer — the single CheckPass Club identity Loyalty Class. */
export const GOOGLE_CLASS_SUFFIX = "mipasaporte_identity";

/** Fully-qualified Loyalty Class id (`<issuerId>.<suffix>`). */
export function loyaltyClassId(issuerId: string): string {
  return `${issuerId}.${GOOGLE_CLASS_SUFFIX}`;
}

/**
 * Loyalty Object id = `<issuerId>.<serialNumber>`. The serialNumber is base64url
 * (`A-Za-z0-9-_`), all valid Google object-id characters — no `.`/`+`/`/` to escape.
 */
export function loyaltyObjectId(
  issuerId: string,
  serialNumber: string,
): string {
  return `${issuerId}.${serialNumber}`;
}

/** The part of the Loyalty Object that CHANGES with the marketing state — the same two
 * fields the silent `PATCH` of `pass_refresh` sends (spec 0065). */
export type PassObjectContent = Pick<
  PassBuildInput,
  "latestMessage" | "passLocations"
>;

/**
 * The doors of the pass as Google's geofences (spec 0065).
 *
 * **The field is `merchantLocations`, NOT `locations`.** `locations` still exists on the
 * Loyalty Object and still validates, but Google documents it as deprecated and
 * explicitly "not supported to trigger geo notifications": writing the old name is a
 * SILENT no-op — object accepted, notification never fired. Capped at
 * {@link MAX_PASS_LOCATIONS}, the same doors Apple gets.
 */
function merchantLocations(
  content: PassObjectContent,
): Record<string, unknown>[] {
  return content.passLocations
    .slice(0, MAX_PASS_LOCATIONS)
    .map((l) => ({ latitude: l.latitude, longitude: l.longitude }));
}

/**
 * The text modules of the Loyalty Object: the single "Última novedad" slot (ADR 0033)
 * plus ONE module per turn door.
 *
 * Google has **no per-location text** — `merchantLocations` carries coordinates only, so
 * the geo notification it raises is generic. The message therefore has to live in a
 * module of the pass itself (`id: turn-<id>`, `header: 'Cerca tuyo'`), which is what the
 * consumer reads after opening the pass the notification points at. Sliced by the same
 * cap as the locations so no module describes a door that was not shipped.
 */
function textModulesData(
  content: PassObjectContent,
): Record<string, unknown>[] {
  const modules: Record<string, unknown>[] = [];
  if (content.latestMessage)
    modules.push({
      id: "latest",
      header: "Última novedad",
      body: content.latestMessage,
    });
  for (const l of content.passLocations.slice(0, MAX_PASS_LOCATIONS)) {
    if (!l.turn) continue;
    modules.push({
      id: `turn-${l.turn.turnId}`,
      header: "Cerca tuyo",
      body: `${l.businessName} — ${l.turn.message}`,
    });
  }
  return modules;
}

/**
 * The body of the silent object `PATCH` (spec 0065, class `pass_refresh`): the doors and
 * the text modules of this consumer, right now.
 *
 * It sends the **complete** arrays this product owns — including the "Última novedad"
 * module — instead of only the marketing ones. That way the body is correct whether
 * Google merges or replaces an array field, with no dependency on `PATCH` array
 * semantics we have not measured; sending only `merchantLocations` + the turn modules
 * would, under replace semantics, wipe the consumer's last transactional notice.
 */
export function buildObjectPatch(
  content: PassObjectContent,
): Record<string, unknown> {
  return {
    merchantLocations: merchantLocations(content),
    textModulesData: textModulesData(content),
  };
}

/** Builds the Loyalty Object for one consumer (barcode = qrToken; link "Ver mis programas"). */
export function buildLoyaltyObject(
  input: PassBuildInput,
  issuerId: string,
): Record<string, unknown> {
  const programsUrl = `${input.origin}/c/${input.webViewToken}`;
  const holder = `${input.firstName} ${input.lastName}`.trim();
  return {
    id: loyaltyObjectId(issuerId, input.serialNumber),
    classId: loyaltyClassId(issuerId),
    state: "ACTIVE",
    accountName: holder || WALLET_BRAND.organizationName,
    accountId: input.serialNumber,
    barcode: {
      type: "QR_CODE",
      value: input.qrToken,
    },
    // "Última novedad" (ADR 0033) + one module per turn door, and the geofences — the
    // same two fields the silent `PATCH` refreshes, built by the same helpers so an
    // emission and a refresh can never disagree about what the pass shows.
    ...buildObjectPatch(input),
    linksModuleData: {
      uris: [
        {
          uri: programsUrl,
          description: "Ver mis programas",
          id: "programs",
        },
      ],
    },
  };
}

const WALLETOBJECTS = "https://walletobjects.googleapis.com/walletobjects/v1";

/**
 * The `addMessage` request for one Loyalty Object (spec 0033): a POST that appends a
 * dated message to the object so Google Wallet raises a notification. Pure so the
 * URL/body can be asserted without a network call (the fake channel uses this shape).
 *
 * `messageType: TEXT_AND_NOTIFY` is REQUIRED for a push notification — the default
 * (`TEXT`) only appends the message to the pass silently, with no notification. This is
 * what makes "te dieron puntos" actually reach the phone.
 */
export function buildAddMessageRequest(
  issuerId: string,
  serialNumber: string,
  message: { header: string; body: string },
): { url: string; body: Record<string, unknown> } {
  const objectId = loyaltyObjectId(issuerId, serialNumber);
  return {
    url: `${WALLETOBJECTS}/loyaltyObject/${objectId}/addMessage`,
    body: {
      message: {
        header: message.header,
        body: message.body,
        id: `msg-${Date.now()}`,
        messageType: "TEXT_AND_NOTIFY",
      },
    },
  };
}

/**
 * The SILENT update request for one Loyalty Object (spec 0065, class `pass_refresh`):
 * a `PATCH` on the object itself, which merges the given fields and raises NO
 * notification. It is a different endpoint from `addMessage` on purpose — `addMessage`
 * always notifies (`TEXT_AND_NOTIFY`, {@link buildAddMessageRequest}), so refreshing the
 * pass through it would ring the consumer's phone, which is exactly what the
 * `pass_refresh` class exists to avoid. Pure so the URL/body are asserted without a
 * network call.
 *
 * The BODY is the caller's: A3 wires the transport with an empty patch and phase A4 of
 * spec 0065 fills it (`merchantLocations` + the per-turn text modules).
 */
export function buildPatchObjectRequest(
  issuerId: string,
  serialNumber: string,
  patch: Record<string, unknown>,
): { url: string; body: Record<string, unknown> } {
  const objectId = loyaltyObjectId(issuerId, serialNumber);
  return {
    url: `${WALLETOBJECTS}/loyaltyObject/${objectId}`,
    body: { ...patch },
  };
}
