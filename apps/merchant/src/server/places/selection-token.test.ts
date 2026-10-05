import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  SELECTION_TTL_MS,
  SelectionError,
  signSelection,
  verifySelection,
} from "./selection-token";
import { CUENCA_PLACE } from "./selection-test-support";

process.env.BETTER_AUTH_SECRET ||= "unit-secret-at-least-32-chars-long-xxxx";
const secret = process.env.BETTER_AUTH_SECRET;

afterEach(() => {
  process.env.BETTER_AUTH_SECRET = secret;
});

const NOW = new Date("2026-10-04T12:00:00Z");
const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
/** Firma un payload arbitrario con la clave del contrato (HMAC del secreto con la etiqueta). */
const resign = (value: unknown) => {
  const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update("places-selection-v1")
    .digest();
  const payload = b64(value);
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
};
const decode = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("selection token (spec 0155)", () => {
  it("ida y vuelta: devuelve lo firmado, con v, provider y exp a 2 h", () => {
    const token = signSelection(CUENCA_PLACE, NOW);
    expect(verifySelection(token, NOW)).toEqual({
      v: 1,
      provider: "google",
      ...CUENCA_PLACE,
      exp: NOW.getTime() + SELECTION_TTL_MS,
    });
    expect(SELECTION_TTL_MS).toBe(2 * 60 * 60 * 1000);
  });

  // ORACULO DE M1: el token esta VIGENTE, asi que el vencimiento no lo caza; solo la firma.
  it("un digito de latitude cambiado con la firma vieja → SelectionError", () => {
    const [payload, signature] = signSelection(CUENCA_PLACE, NOW).split(".");
    const tampered = { ...decode(payload), latitude: -3.9081 };
    expect(() => verifySelection(`${b64(tampered)}.${signature}`, NOW)).toThrow(
      SelectionError,
    );
    // Control: el mismo payload sin tocar, con esa firma, pasa.
    expect(verifySelection(`${payload}.${signature}`, NOW).latitude).toBe(
      CUENCA_PLACE.latitude,
    );
  });

  it("un token firmado con OTRO secreto → SelectionError", () => {
    process.env.BETTER_AUTH_SECRET = "otro-secreto-de-al-menos-32-caracteres";
    const foreign = signSelection(CUENCA_PLACE, NOW);
    process.env.BETTER_AUTH_SECRET = secret;
    expect(() => verifySelection(foreign, NOW)).toThrow(SelectionError);
  });

  it("vencido → SelectionError; un ms antes de vencer, vale", () => {
    const token = signSelection(CUENCA_PLACE, NOW);
    const exp = NOW.getTime() + SELECTION_TTL_MS;
    expect(() => verifySelection(token, new Date(exp))).toThrow(SelectionError);
    expect(verifySelection(token, new Date(exp - 1)).placeId).toBe(
      CUENCA_PLACE.placeId,
    );
  });

  it.each([
    ["sin punto", "abc"],
    ["basura", "%%%.###"],
    ["tres partes", "a.b.c"],
    ["vacio", ""],
    ["no es texto", 42],
    ["ausente", undefined],
  ])("forma invalida (%s) → SelectionError", (_case, token) => {
    expect(() => verifySelection(token, NOW)).toThrow(SelectionError);
  });

  it("una version distinta, aun bien firmada, no se acepta", () => {
    // Se re-firma con la clave derivada del contrato: la firma es VALIDA, asi que lo unico
    // que lo rechaza es `v`. Control: el mismo re-firmado con `v: 1` pasa.
    const [payload] = signSelection(CUENCA_PLACE, NOW).split(".");
    expect(verifySelection(resign({ ...decode(payload), v: 1 }), NOW).v).toBe(
      1,
    );
    expect(() =>
      verifySelection(resign({ ...decode(payload), v: 2 }), NOW),
    ).toThrow(SelectionError);
  });

  it("un pais no soportado dentro del token no se acepta", () => {
    const token = signSelection({ ...CUENCA_PLACE, countryCode: "US" }, NOW);
    expect(() => verifySelection(token, NOW)).toThrow(SelectionError);
  });

  it("sin BETTER_AUTH_SECRET: firmar y verificar LANZAN, y no es un SelectionError", () => {
    const token = signSelection(CUENCA_PLACE, NOW);
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => signSelection(CUENCA_PLACE, NOW)).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    let thrown: unknown;
    try {
      verifySelection(token, NOW);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(SelectionError);
  });
});
