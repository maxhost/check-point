import { describe, expect, it } from "vitest";
import {
  CALLBACK_TOLERANCE_SECONDS,
  jobIdFromPayload,
  signPayload,
  verifyWebhookSignature,
} from "./catalog-import/providers/openai-callback";

/**
 * Spec 0090 §7 — LA FIRMA DEL CALLBACK. Es lo **unico** que separa al proveedor de
 * cualquiera que conozca la URL: la ruta es publica y no tiene sesion.
 *
 * Los cuatro rechazos que la spec exige, mas el quinto (cuerpo alterado con firma vieja), y
 * todos aseveran **el motivo**, no solo que no pasó: un `ok:false` por una env faltante se
 * lee igual que uno por la propiedad y no probaria nada.
 *
 * ORACULO DE M1 (aceptar una firma invalida) y DE M2 (sacar la tolerancia de timestamp).
 */
const SECRET = `whsec_${Buffer.from("un-secreto-de-webhook-de-prueba").toString("base64")}`;
const OTRO_SECRETO = `whsec_${Buffer.from("otro-secreto-distinto-igual-largo").toString("base64")}`;
const BODY = JSON.stringify({
  id: "evt_1",
  type: "response.completed",
  data: { id: "resp_abc" },
});

const AHORA = new Date("2026-09-22T12:00:00.000Z");
const ts = (date: Date) => String(Math.floor(date.getTime() / 1000));

function headersDe(opts: {
  id?: string;
  timestamp?: string;
  signature?: string;
}): Headers {
  const headers = new Headers();
  headers.set("webhook-id", opts.id ?? "evt_1");
  headers.set("webhook-timestamp", opts.timestamp ?? ts(AHORA));
  if (opts.signature !== undefined) {
    headers.set("webhook-signature", opts.signature);
  }
  return headers;
}

const firmaDe = (secret: string, id: string, timestamp: string, body: string) =>
  `v1,${signPayload(secret, `${id}.${timestamp}.${body}`)}`;

const valida = (body = BODY, date = AHORA) =>
  headersDe({
    timestamp: ts(date),
    signature: firmaDe(SECRET, "evt_1", ts(date), body),
  });

describe("firma del webhook del proveedor (spec 0090 §7)", () => {
  it("una firma valida pasa y devuelve el jobId del payload", () => {
    expect(
      verifyWebhookSignature(valida(), BODY, { secret: SECRET, now: AHORA }),
    ).toEqual({ ok: true, eventId: "evt_1", jobId: "resp_abc" });
  });

  it("un byte alterado en la firma NO pasa", () => {
    const buena = firmaDe(SECRET, "evt_1", ts(AHORA), BODY);
    const rota = buena.slice(0, -1) + (buena.endsWith("A") ? "B" : "A");
    expect(
      verifyWebhookSignature(headersDe({ signature: rota }), BODY, {
        secret: SECRET,
        now: AHORA,
      }),
    ).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("el secreto equivocado NO pasa", () => {
    const headers = headersDe({
      signature: firmaDe(OTRO_SECRETO, "evt_1", ts(AHORA), BODY),
    });
    expect(
      verifyWebhookSignature(headers, BODY, { secret: SECRET, now: AHORA }),
    ).toEqual({ ok: false, reason: "bad_signature" });
  });

  /** ORACULO DE M2: sin la ventana de replay, esto pasaria. */
  it("un timestamp de hace 10 minutos NO pasa (replay)", () => {
    const viejo = new Date(AHORA.getTime() - 10 * 60 * 1000);
    expect(
      verifyWebhookSignature(valida(BODY, viejo), BODY, {
        secret: SECRET,
        now: AHORA,
      }),
    ).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("la tolerancia es de 5 minutos: justo adentro pasa, un segundo afuera no", () => {
    expect(CALLBACK_TOLERANCE_SECONDS).toBe(300);
    const borde = new Date(AHORA.getTime() - 300 * 1000);
    expect(
      verifyWebhookSignature(valida(BODY, borde), BODY, {
        secret: SECRET,
        now: AHORA,
      }).ok,
    ).toBe(true);
    const afuera = new Date(AHORA.getTime() - 301 * 1000);
    expect(
      verifyWebhookSignature(valida(BODY, afuera), BODY, {
        secret: SECRET,
        now: AHORA,
      }),
    ).toEqual({ ok: false, reason: "stale_timestamp" });
    // Y tambien hacia el FUTURO: un reloj adelantado no abre la ventana.
    const futuro = new Date(AHORA.getTime() + 301 * 1000);
    expect(
      verifyWebhookSignature(valida(BODY, futuro), BODY, {
        secret: SECRET,
        now: AHORA,
      }),
    ).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("un cuerpo alterado con la firma vieja NO pasa", () => {
    const headers = valida(BODY);
    const otroCuerpo = JSON.stringify({
      id: "evt_1",
      data: { id: "resp_del_atacante" },
    });
    expect(
      verifyWebhookSignature(headers, otroCuerpo, {
        secret: SECRET,
        now: AHORA,
      }),
    ).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("sin secreto configurado NO pasa nada — fail closed", () => {
    expect(
      verifyWebhookSignature(valida(), BODY, {
        secret: undefined,
        now: AHORA,
      }),
    ).toEqual({ ok: false, reason: "no_secret" });
  });

  it("sin los headers de Standard Webhooks NO pasa", () => {
    const headers = new Headers();
    headers.set("webhook-id", "evt_1");
    expect(
      verifyWebhookSignature(headers, BODY, { secret: SECRET, now: AHORA }),
    ).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("el header admite varias firmas y alcanza con que UNA sea la buena", () => {
    const headers = headersDe({
      signature: `v1,ZmFsc2E= ${firmaDe(SECRET, "evt_1", ts(AHORA), BODY)}`,
    });
    expect(
      verifyWebhookSignature(headers, BODY, { secret: SECRET, now: AHORA }).ok,
    ).toBe(true);
  });

  it("una firma de otra VERSION no se acepta", () => {
    const headers = headersDe({
      signature: firmaDe(SECRET, "evt_1", ts(AHORA), BODY).replace(
        "v1,",
        "v2,",
      ),
    });
    expect(
      verifyWebhookSignature(headers, BODY, { secret: SECRET, now: AHORA }),
    ).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("la firma se calcula sobre `id.timestamp.body`: cambiar el id la invalida", () => {
    const headers = headersDe({
      id: "evt_2",
      signature: firmaDe(SECRET, "evt_1", ts(AHORA), BODY),
    });
    expect(
      verifyWebhookSignature(headers, BODY, { secret: SECRET, now: AHORA }),
    ).toEqual({ ok: false, reason: "bad_signature" });
  });
});

describe("del cuerpo del webhook solo sale el id", () => {
  it("lee `data.id`, y si no está, `id`", () => {
    expect(jobIdFromPayload(BODY)).toBe("resp_abc");
    expect(jobIdFromPayload(JSON.stringify({ id: "resp_solo" }))).toBe(
      "resp_solo",
    );
  });

  it("un cuerpo que no es JSON, o sin id, no produce nada", () => {
    expect(jobIdFromPayload("no soy json")).toBeNull();
    expect(jobIdFromPayload(JSON.stringify({ data: {} }))).toBeNull();
    expect(jobIdFromPayload(JSON.stringify({ data: { id: 7 } }))).toBeNull();
  });
});
