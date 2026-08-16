import {
  type VapidSigningKey,
  audienceOf,
  buildVapidJwt,
  importVapidKey,
  vapidAuthHeader,
  vapidFromEnv,
} from "./vapid";
import { encryptWebPushPayload } from "./webpush-crypto";

/** One push target: the endpoint URL plus the client's RFC 8291 key material. */
export type WebPushTarget = {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
};

/** The notice to deliver; serialized to the SW as `{title, body, url}`. */
export type WebPushPayload = { title: string; body: string; url?: string };

/**
 * Thrown when the push service reports the subscription is dead (404/410): the caller
 * deletes the row, exactly like {@link ApnsGoneError} for a dead APNs token in spec 0033.
 */
export class WebPushGoneError extends Error {
  constructor(readonly endpoint: string) {
    super("Web Push subscription is no longer valid (404/410)");
  }
}

/**
 * Provider-agnostic Web Push channel (same philosophy as the wallet `PushChannel`):
 * `real` encrypts (RFC 8291) + signs a VAPID JWT (RFC 8292) + POSTs to the endpoint;
 * `fake` records calls and hits no network, so the worker and every test run without a
 * push service. `send` throws {@link WebPushGoneError} on a dead endpoint so the caller
 * prunes the subscription; any other failure throws a generic Error (recorded, not fatal).
 */
export interface WebPushChannel {
  readonly kind: "web-push" | "fake";
  send(target: WebPushTarget, payload: WebPushPayload): Promise<void>;
}

/** A recorded fake call, for test assertions. */
export type FakeWebPushCall = {
  endpoint: string;
  payload: WebPushPayload;
};

/**
 * In-memory channel for dev/test. Records every call; never touches the network.
 * `goneEndpoints` drives the 404/410 → subscription-deletion path; `failEndpoints`
 * drives a generic (non-gone) failure so a test can assert it is recorded, not swallowed.
 */
export class FakeWebPushChannel implements WebPushChannel {
  readonly kind = "fake" as const;
  readonly calls: FakeWebPushCall[] = [];
  constructor(
    private readonly goneEndpoints: Set<string> = new Set(),
    private readonly failEndpoints: Set<string> = new Set(),
  ) {}

  async send(target: WebPushTarget, payload: WebPushPayload): Promise<void> {
    this.calls.push({ endpoint: target.endpoint, payload });
    if (this.goneEndpoints.has(target.endpoint))
      throw new WebPushGoneError(target.endpoint);
    if (this.failEndpoints.has(target.endpoint))
      throw new Error("push service responded 500");
  }
}

/** How long the push service should retain an undelivered message (seconds). */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/** Real channel: RFC 8291 encryption + RFC 8292 VAPID auth over `fetch`. */
class RealWebPushChannel implements WebPushChannel {
  readonly kind = "web-push" as const;
  constructor(
    private readonly key: VapidSigningKey,
    private readonly ttl: number = DEFAULT_TTL_SECONDS,
  ) {}

  async send(target: WebPushTarget, payload: WebPushPayload): Promise<void> {
    const body = encryptWebPushPayload(
      Buffer.from(JSON.stringify(payload), "utf8"),
      { p256dhKey: target.p256dhKey, authKey: target.authKey },
    );
    const jwt = buildVapidJwt(this.key, audienceOf(target.endpoint));
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthHeader(jwt, this.key.publicKey),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(this.ttl),
        Urgency: "high",
      },
      // A Node Buffer is a Uint8Array; a fresh copy avoids exposing the pooled backing store.
      body: new Uint8Array(body),
    });
    if (res.status === 201 || res.status === 202) return;
    if (res.status === 404 || res.status === 410)
      throw new WebPushGoneError(target.endpoint);
    throw new Error(`push service responded ${res.status}`);
  }
}

type Env = Record<string, string | undefined>;

let cachedFake: FakeWebPushChannel | null = null;
function sharedFake(): FakeWebPushChannel {
  if (!cachedFake) cachedFake = new FakeWebPushChannel();
  return cachedFake;
}

/**
 * Selects the Web Push channel from the environment. Uses the real channel only when
 * VAPID keys are configured AND `WALLET_PUSH_CHANNEL=real` (or `NODE_ENV=production`);
 * otherwise the shared fake, so the worker and tests never hit a push service. Returns
 * null when Web Push is disabled (no VAPID keys) — the caller skips the transport.
 */
export function webPushChannelFromEnv(
  env: Env = process.env,
): WebPushChannel | null {
  const wantsReal =
    env.WALLET_PUSH_CHANNEL === "real" || env.NODE_ENV === "production";
  if (!wantsReal) return sharedFake();
  const keys = vapidFromEnv(env);
  if (!keys) return null; // no VAPID → transport disabled (analogous to a 503 provider).
  return new RealWebPushChannel(importVapidKey(keys));
}
