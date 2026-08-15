import { type ApnsCredentials, ApnsGoneError, sendApnsEmptyPush } from "./apns";
import { postGoogleMessage } from "./google";

export { ApnsGoneError };

/** One Apple target: a device APNs token under a Pass Type ID (the `apns-topic`). */
export type AppleTarget = { pushToken: string; passTypeId: string };

/** A materialized notice (the "Última novedad" snapshot) to push out. */
export type PushMessage = { header: string; body: string };

/**
 * Provider-agnostic push channel (same philosophy as `WalletProvider`/`OtpChannel`):
 * `apple` wakes a device via an empty APNs push, `google` appends a message to the
 * Loyalty Object. The `fake`/`console` channel records calls and hits no network, so
 * the worker and every test run without paying Apple. `sendApple` throws
 * {@link ApnsGoneError} on a dead token (410) so the worker can delete that device.
 */
export interface PushChannel {
  readonly kind: "apple-google" | "fake";
  sendApple(target: AppleTarget): Promise<void>;
  sendGoogle(serialNumber: string, message: PushMessage): Promise<void>;
}

/** A recorded fake call, for test assertions. */
export type FakeCall =
  | { kind: "apple"; pushToken: string; passTypeId: string }
  | { kind: "google"; serialNumber: string; message: PushMessage };

/**
 * In-memory channel for dev/test. Records every call; never touches the network.
 * `goneTokens` drives the 410 → device-deletion path; `failTokens` drives a generic
 * (non-410) APNs failure so a test can assert it is recorded, not swallowed.
 */
export class FakePushChannel implements PushChannel {
  readonly kind = "fake" as const;
  readonly calls: FakeCall[] = [];
  constructor(
    private readonly goneTokens: Set<string> = new Set(),
    private readonly failTokens: Set<string> = new Set(),
  ) {}

  async sendApple(target: AppleTarget): Promise<void> {
    this.calls.push({
      kind: "apple",
      pushToken: target.pushToken,
      passTypeId: target.passTypeId,
    });
    if (this.goneTokens.has(target.pushToken))
      throw new ApnsGoneError(target.pushToken);
    if (this.failTokens.has(target.pushToken))
      throw new Error("APNs responded 403");
  }

  async sendGoogle(serialNumber: string, message: PushMessage): Promise<void> {
    this.calls.push({ kind: "google", serialNumber, message });
  }
}

/** Real channel: APNs over HTTP/2 for Apple, `addMessage` for Google. */
class RealPushChannel implements PushChannel {
  readonly kind = "apple-google" as const;
  constructor(
    private readonly apns: ApnsCredentials | null,
    private readonly apnsHost: string | undefined,
    private readonly google: { saJson: string; issuerId: string } | null,
  ) {}

  async sendApple(target: AppleTarget): Promise<void> {
    if (!this.apns) return; // Apple not configured → no-op (Google may still push).
    await sendApnsEmptyPush(this.apns, {
      passTypeId: target.passTypeId,
      pushToken: target.pushToken,
      host: this.apnsHost,
    });
  }

  async sendGoogle(serialNumber: string, message: PushMessage): Promise<void> {
    if (!this.google) return;
    await postGoogleMessage(this.google, serialNumber, message);
  }
}

type Env = Record<string, string | undefined>;

function apnsFromEnv(env: Env): ApnsCredentials | null {
  const keyId = env.APPLE_APNS_KEY_ID;
  const teamId = env.APPLE_APNS_TEAM_ID ?? env.APPLE_TEAM_ID;
  // Base64 `.p8` (ADR 0024) decoded to PEM; falls back to a raw PEM if provided.
  const raw = env.APPLE_APNS_KEY_P8;
  if (!keyId || !teamId || !raw) return null;
  const p8Pem = raw.includes("BEGIN")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return { keyId, teamId, p8Pem };
}

function googleFromEnv(env: Env) {
  const saJson = env.GOOGLE_WALLET_SA_JSON;
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  return saJson && issuerId ? { saJson, issuerId } : null;
}

/** The Apple Pass Type ID used as the APNs topic (matches the emission default). */
export function passTypeIdFromEnv(env: Env = process.env): string {
  return env.APPLE_PASS_TYPE_ID ?? "pass.com.mipasaporte.dev";
}

/**
 * Selects the push channel from the environment. Uses the real channel only when
 * `WALLET_PUSH_CHANNEL=real` (or `NODE_ENV=production`); otherwise the fake channel,
 * so the worker and tests never hit APNs/Google. A shared fake instance is reused so
 * a caller can inspect `.calls`.
 */
export function pushChannelFromEnv(env: Env = process.env): PushChannel {
  const wantsReal =
    env.WALLET_PUSH_CHANNEL === "real" || env.NODE_ENV === "production";
  if (!wantsReal) return sharedFake();
  return new RealPushChannel(
    apnsFromEnv(env),
    env.APNS_HOST,
    googleFromEnv(env),
  );
}

let cachedFake: FakePushChannel | null = null;
function sharedFake(): FakePushChannel {
  if (!cachedFake) cachedFake = new FakePushChannel();
  return cachedFake;
}
