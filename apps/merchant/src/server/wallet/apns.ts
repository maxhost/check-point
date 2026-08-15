import { connect } from "node:http2";
import { createSign } from "node:crypto";

/** APNs auth material: the `.p8` provider key (PEM) plus its Key ID and Team ID. */
export type ApnsCredentials = {
  keyId: string;
  teamId: string;
  /** PEM of the ES256 `.p8` provider key. */
  p8Pem: string;
};

/** Production APNs host; the sandbox host is swapped in dev via `APNS_HOST`. */
export const APNS_HOST = "https://api.push.apple.com";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Builds the APNs provider **JWT (ES256)**: header `{alg:'ES256', kid}`, claims
 * `{iss: teamId, iat}`. Signed with the `.p8` EC key via `node:crypto`, emitting a
 * JOSE (raw R‖S, `ieee-p1363`) signature — not the DER default — so Apple accepts it.
 * The token is reusable for ~1h; the caller may cache it.
 */
export function buildApnsJwt(creds: ApnsCredentials, now = new Date()): string {
  const header = { alg: "ES256", kid: creds.keyId };
  const claims = { iss: creds.teamId, iat: Math.floor(now.getTime() / 1000) };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signature = createSign("SHA256")
    .update(signingInput)
    .sign({ key: creds.p8Pem, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

/**
 * The HTTP/2 request headers for a PassKit update push: bearer JWT + `apns-topic`
 * = the Pass Type ID. PassKit wakes the device to pull; the payload is empty.
 * Pure so the topic/payload can be asserted without opening a socket.
 */
export function buildApnsRequest(opts: {
  jwt: string;
  passTypeId: string;
  pushToken: string;
}): {
  headers: Record<string, string>;
  path: string;
  payload: string;
} {
  return {
    headers: {
      ":method": "POST",
      "apns-topic": opts.passTypeId,
      "apns-push-type": "background",
      "apns-priority": "5",
      authorization: `bearer ${opts.jwt}`,
    },
    path: `/3/device/${opts.pushToken}`,
    // Empty PassKit payload: the pull carries the new pass, not this body.
    payload: "{}",
  };
}

/** Thrown on a 410 from APNs: the device token is dead → delete the registration. */
export class ApnsGoneError extends Error {
  constructor(readonly pushToken: string) {
    super("APNs token is no longer valid (410)");
  }
}

/**
 * Sends one empty PassKit push over HTTP/2 to `api.push.apple.com`. Resolves on a
 * 200; throws {@link ApnsGoneError} on 410 (dead token) and a generic Error on any
 * other status. Only runs on the real `apple` channel — tests use the fake channel.
 */
export async function sendApnsEmptyPush(
  creds: ApnsCredentials,
  opts: { passTypeId: string; pushToken: string; host?: string },
): Promise<void> {
  const jwt = buildApnsJwt(creds);
  const req = buildApnsRequest({
    jwt,
    passTypeId: opts.passTypeId,
    pushToken: opts.pushToken,
  });
  const client = connect(opts.host ?? APNS_HOST);
  try {
    await new Promise<void>((resolve, reject) => {
      client.on("error", reject);
      const stream = client.request({ ...req.headers, ":path": req.path });
      let status = 0;
      stream.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
      });
      stream.on("error", reject);
      stream.on("end", () => {
        if (status === 200) return resolve();
        if (status === 410) return reject(new ApnsGoneError(opts.pushToken));
        reject(new Error(`APNs responded ${status}`));
      });
      stream.setEncoding("utf8");
      stream.on("data", () => {});
      stream.write(req.payload);
      stream.end();
    });
  } finally {
    client.close();
  }
}
