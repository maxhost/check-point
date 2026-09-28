import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import {
  type GoogleRootKey,
  type RootKeySource,
  lengthValue,
} from "./wallet/google-callback";

/**
 * Keys and envelopes of Google's `ECv2SigningOnly` callback, made up by the TESTS (spec
 * 0107): a root key the test trusts, an intermediate it signs and a message the
 * intermediate signs — built with the SAME byte layout `verifyGoogleCallback` checks. Real
 * Google keys are not in the repo; the real format is the owner's QA (declared).
 */

export type TestKeyPair = { publicKey: KeyObject; privateKey: KeyObject };

export function ecKeyPair(): TestKeyPair {
  return generateKeyPairSync("ec", { namedCurve: "prime256v1" });
}

const spki = (key: KeyObject) =>
  key.export({ format: "der", type: "spki" }).toString("base64");

const der = (data: Buffer, key: KeyObject) =>
  sign("sha256", data, { key, dsaEncoding: "der" }).toString("base64");

export function rootKeyOf(
  pair: TestKeyPair,
  keyExpiration = "4102444800000",
): GoogleRootKey {
  return {
    keyValue: spki(pair.publicKey),
    protocolVersion: "ECv2SigningOnly",
    keyExpiration,
  };
}

export function rootSource(...pairs: TestKeyPair[]): RootKeySource {
  return async () => pairs.map((pair) => rootKeyOf(pair));
}

export function signedCallback(opts: {
  issuerId: string;
  message: Record<string, unknown>;
  root: TestKeyPair;
  intermediate: TestKeyPair;
  /** The key that signs the MESSAGE (default: the intermediate). */
  messageSigner?: TestKeyPair;
  intermediateExpiration?: string;
}) {
  const signedKey = JSON.stringify({
    keyValue: spki(opts.intermediate.publicKey),
    keyExpiration: opts.intermediateExpiration ?? "4102444800000",
  });
  const signedMessage = JSON.stringify(opts.message);
  return {
    protocolVersion: "ECv2SigningOnly",
    intermediateSigningKey: {
      signedKey,
      signatures: [
        der(
          lengthValue("GooglePayPasses", "ECv2SigningOnly", signedKey),
          opts.root.privateKey,
        ),
      ],
    },
    signedMessage,
    signature: der(
      lengthValue(
        "GooglePayPasses",
        opts.issuerId,
        "ECv2SigningOnly",
        signedMessage,
      ),
      (opts.messageSigner ?? opts.intermediate).privateKey,
    ),
  };
}
