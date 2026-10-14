import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Spec 0090 §7 — LA FIRMA DEL WEBHOOK, con `node:crypto` y **cero dependencias**.
 *
 * Es el formato **Standard Webhooks** que usa OpenAI (ADR 0082 §8): HMAC-SHA256 sobre
 * `id.timestamp.body`, resultado en base64, header `webhook-signature: v1,<firma>` y secreto
 * `whsec_<base64>`. La entrada es **publica y no autenticada por sesion**, asi que esto es lo
 * unico que separa al proveedor de cualquiera que conozca la URL.
 *
 * El orden es la regla (§7, DoD): **firma → ventana de tiempo → recien ahi se toca la base.**
 * Un id desconocido lo resuelve el llamador; aca no se lee una fila.
 */

/** Tolerancia de replay. Cinco minutos: lo que el contrato declara. */
export const CALLBACK_TOLERANCE_SECONDS = 300;

export type CallbackVerification =
  | { ok: true; eventId: string; jobId: string }
  | {
      ok: false;
      reason:
        | "no_secret"
        | "missing_headers"
        | "bad_timestamp"
        | "stale_timestamp"
        | "bad_signature"
        | "bad_payload";
    };

export function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
  opts: { secret: string | undefined; now?: Date },
): CallbackVerification {
  const secret = opts.secret;
  if (!secret) return { ok: false, reason: "no_secret" };
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing_headers" };
  }
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || !/^\d+$/.test(timestamp.trim())) {
    return { ok: false, reason: "bad_timestamp" };
  }
  const now = opts.now ?? new Date();
  const drift = Math.abs(Math.floor(now.getTime() / 1000) - seconds);
  if (drift > CALLBACK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  const expected = signPayload(secret, `${id}.${timestamp}.${rawBody}`);
  if (!matchesAny(signature, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  const jobId = jobIdFromPayload(rawBody);
  if (!jobId) return { ok: false, reason: "bad_payload" };
  return { ok: true, eventId: id, jobId };
}

/** La firma esperada, en base64. `whsec_` es prefijo del secreto, no parte de la clave. */
export function signPayload(secret: string, payload: string): string {
  const material = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(material, "base64");
  return createHmac("sha256", key).update(payload, "utf8").digest("base64");
}

/**
 * El header admite **varias** firmas separadas por espacio (rotacion de secreto), cada una
 * como `v<n>,<base64>`. Se compara en tiempo constante y **solo** las de version `v1`.
 */
function matchesAny(header: string, expected: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  let matched = false;
  for (const part of header.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const candidate = Buffer.from(value, "utf8");
    if (candidate.byteLength !== expectedBuffer.byteLength) continue;
    // Sin corto circuito: se recorren todas para no filtrar por tiempo cual acerto.
    if (timingSafeEqual(candidate, expectedBuffer)) matched = true;
  }
  return matched;
}

/**
 * **Del cuerpo se toma SOLO el id** (§7.3). Todo lo demas del payload se descarta: el
 * resultado se va a buscar a la API del proveedor. Un cuerpo que trajera un borrador no
 * tiene por donde entrar.
 */
export function jobIdFromPayload(rawBody: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  const data = body.data as Record<string, unknown> | undefined;
  const candidate = data?.id ?? body.id;
  if (typeof candidate !== "string") return null;
  const jobId = candidate.trim();
  return jobId.length > 0 && jobId.length <= 200 ? jobId : null;
}
