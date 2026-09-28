import { describe, expect, it } from "vitest";
import {
  ecKeyPair,
  rootSource,
  signedCallback,
} from "../google-callback-support";
import {
  GoogleCallbackError,
  lengthValue,
  verifyGoogleCallback,
} from "./google-callback";

/**
 * `ECv2SigningOnly` verification (spec 0107 §4) with keys generated HERE: root →
 * intermediate → message. Each «no» is read on the error's STATUS, so a verification that
 * threw for another reason (a TypeError) cannot pass for a refusal.
 */

const ISSUER = "3388000000012345678";
const NOW = new Date("2026-10-01T12:00:00.000Z");
const root = ecKeyPair();
const intermediate = ecKeyPair();
const MESSAGE = {
  classId: `${ISSUER}.mipasaporte_identity`,
  objectId: `${ISSUER}.serial-1`,
  eventType: "save",
  expTimeMillis: NOW.getTime() + 60_000,
  nonce: "n-1",
};

async function statusOf(
  body: unknown,
  issuer = ISSUER,
  keys = rootSource(root),
) {
  try {
    await verifyGoogleCallback(body, issuer, NOW, keys);
  } catch (error) {
    if (error instanceof GoogleCallbackError) return error.status;
    throw error;
  }
  return 200;
}

const valid = () =>
  signedCallback({ issuerId: ISSUER, message: MESSAGE, root, intermediate });

describe("verifyGoogleCallback", () => {
  it("lengthValue is 4 bytes little-endian + UTF-8, per part", () => {
    expect(lengthValue("ab", "ñ").toString("hex")).toBe(
      "02000000" + "6162" + "02000000" + "c3b1",
    );
  });

  it("accepts a chain root → intermediate → message and returns the message", async () => {
    await expect(
      verifyGoogleCallback(valid(), ISSUER, NOW, rootSource(root)),
    ).resolves.toEqual({
      classId: MESSAGE.classId,
      objectId: MESSAGE.objectId,
      eventType: "save",
    });
  });

  it("ORACULO DE M9: a message signed by ANOTHER intermediate is a 401", async () => {
    const body = signedCallback({
      issuerId: ISSUER,
      message: MESSAGE,
      root,
      intermediate,
      messageSigner: ecKeyPair(),
    });
    expect(await statusOf(body)).toBe(401);
  });

  it("a tampered message is a 401", async () => {
    const body = valid();
    body.signedMessage = body.signedMessage.replace("save", "del");
    expect(await statusOf(body)).toBe(401);
  });

  it("an intermediate not signed by a trusted root is a 401", async () => {
    expect(await statusOf(valid(), ISSUER, rootSource(ecKeyPair()))).toBe(401);
  });

  it("an EXPIRED intermediate is a 401", async () => {
    const body = signedCallback({
      issuerId: ISSUER,
      message: MESSAGE,
      root,
      intermediate,
      intermediateExpiration: String(NOW.getTime() - 1),
    });
    expect(await statusOf(body)).toBe(401);
  });

  it("a message for ANOTHER recipient (issuer) is a 401", async () => {
    expect(await statusOf(valid(), "9999999999999999999")).toBe(401);
  });

  it("an expired message is a 401", async () => {
    const body = signedCallback({
      issuerId: ISSUER,
      message: { ...MESSAGE, expTimeMillis: NOW.getTime() - 1 },
      root,
      intermediate,
    });
    expect(await statusOf(body)).toBe(401);
  });

  it("a body that is not the envelope is a 400", async () => {
    expect(await statusOf({})).toBe(400);
    expect(await statusOf(null)).toBe(400);
    expect(await statusOf({ ...valid(), protocolVersion: "ECv2" })).toBe(400);
  });
});
