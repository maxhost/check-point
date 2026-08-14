import { randomBytes } from "node:crypto";
import { buildApplePkpass, certSigner, selfSignedSigner } from "./apple";
import { buildGoogleSaveUrl as buildRealGoogleSaveUrl } from "./google";
import { fakeBuildGoogleSaveUrl } from "./fake";

/** Everything a provider needs to build one consumer's identity pass. */
export type PassBuildInput = {
  /** Stable `wallet_pass.serialNumber` (Apple serialNumber / Google object id). */
  serialNumber: string;
  /** The consumer's global `qrToken` (0028) — the pass barcode. */
  qrToken: string;
  firstName: string;
  lastName: string;
  /** Request-derived absolute origin (no base-URL env); used for the hooks/links. */
  origin: string;
  /** Bearer token for the "Ver mis programas" magic-link (`${origin}/c/${webViewToken}`). */
  webViewToken: string;
};

export type ApplePassResult = {
  bytes: Buffer;
  mime: "application/vnd.apple.pkpass";
  /** Raw Apple web-service authenticationToken — caller stores only its hash. */
  authenticationToken: string;
};

/**
 * Provider-agnostic wallet interface (same philosophy as `OtpChannel`, 0032).
 * `appleConfigured`/`googleConfigured` let the routes answer 503 when the
 * requested provider has no signing material available.
 */
export interface WalletProvider {
  readonly appleConfigured: boolean;
  readonly googleConfigured: boolean;
  buildApplePass(input: PassBuildInput): Promise<ApplePassResult>;
  buildGoogleSaveUrl(input: PassBuildInput): Promise<string>;
}

/** Thrown when a route asks for a provider that is not configured → mapped to 503. */
export class WalletProviderUnconfiguredError extends Error {
  constructor(readonly provider: "apple" | "google") {
    super(`Wallet provider not configured: ${provider}`);
  }
}

type Env = Record<string, string | undefined>;

function appleSecrets(env: Env) {
  const p12 = env.APPLE_PASS_CERT_P12;
  const wwdr = env.APPLE_WWDR_CERT;
  const teamId = env.APPLE_TEAM_ID;
  const passTypeId = env.APPLE_PASS_TYPE_ID;
  if (p12 && wwdr && teamId && passTypeId)
    return {
      p12,
      wwdr,
      teamId,
      passTypeId,
      password: env.APPLE_PASS_CERT_PASSWORD ?? "",
    };
  return null;
}

function googleSecrets(env: Env) {
  const saJson = env.GOOGLE_WALLET_SA_JSON;
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  if (saJson && issuerId) return { saJson, issuerId };
  return null;
}

/**
 * Whether the `console`/`fake` provider may stand in for missing real secrets.
 * Allowed outside production (dev/test) or when explicitly requested — so the
 * 0029 builders verify end-to-end without paying Apple. In production a missing
 * real provider stays unconfigured (→ 503), matching the deferred-$99 reality.
 */
function fakeAllowed(env: Env): boolean {
  const explicit =
    env.WALLET_PROVIDER === "fake" || env.WALLET_PROVIDER === "console";
  return explicit || env.NODE_ENV !== "production";
}

/** Selects the provider from the environment (secrets present and/or WALLET_PROVIDER). */
export function walletProviderFromEnv(env: Env = process.env): WalletProvider {
  const apple = appleSecrets(env);
  const google = googleSecrets(env);
  const allowFake = fakeAllowed(env);
  const appleConfigured = Boolean(apple) || allowFake;
  const googleConfigured = Boolean(google) || allowFake;

  return {
    appleConfigured,
    googleConfigured,
    async buildApplePass(input) {
      if (!appleConfigured) throw new WalletProviderUnconfiguredError("apple");
      const signer = apple
        ? certSigner({
            p12Base64: apple.p12,
            password: apple.password,
            wwdrBase64: apple.wwdr,
          })
        : selfSignedSigner();
      const passTypeIdentifier =
        apple?.passTypeId ?? "pass.com.mipasaporte.dev";
      const teamIdentifier = apple?.teamId ?? "MIPASAPORTE0";
      const authenticationToken = randomBytes(32).toString("base64url");
      const bytes = await buildApplePkpass(
        { ...input, passTypeIdentifier, teamIdentifier, authenticationToken },
        signer,
      );
      return {
        bytes,
        mime: "application/vnd.apple.pkpass",
        authenticationToken,
      };
    },
    async buildGoogleSaveUrl(input) {
      if (!googleConfigured)
        throw new WalletProviderUnconfiguredError("google");
      if (google)
        return buildRealGoogleSaveUrl(input, {
          saJson: google.saJson,
          issuerId: google.issuerId,
        });
      return fakeBuildGoogleSaveUrl(input);
    },
  };
}

let cached: WalletProvider | null = null;
/** Process-wide provider, resolved once from the environment. */
export function getWalletProvider(): WalletProvider {
  if (!cached) cached = walletProviderFromEnv();
  return cached;
}
