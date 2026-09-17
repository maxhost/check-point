import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AuthStartError,
  START_RATE_LIMITS,
  UNDELIVERABLE_EMAIL_DOMAIN,
  hashClientIp,
  isUndeliverableEmail,
  normalizeEmail,
} from "./auth-start";

/**
 * Spec 0067 §2 — la parte SIN BASE de `POST /api/merchant/auth/start`. La decisión que
 * importa —email conocido NO abre sesión— no es pura: necesita la base y vive en
 * `auth-start.neon.integration.test.ts`, que es donde muerde la mutación #4.
 */
const codeOf = (value: unknown) => {
  try {
    normalizeEmail(value);
    return "<sin error>";
  } catch (error) {
    return error instanceof AuthStartError ? error.code : "<otro error>";
  }
};

describe("normalizeEmail", () => {
  it("recorta y baja a minúsculas", () => {
    expect(normalizeEmail("  Ana@LaFarmacia.COM ")).toBe("ana@lafarmacia.com");
  });

  it.each([
    [""],
    [null],
    [42],
    ["sin-arroba"],
    ["sin@dominio"],
    ["con espacio@x.com"],
    [`${"a".repeat(250)}@x.com`],
  ])("rechaza %s con invalid_email", (value) => {
    expect(codeOf(value)).toBe("invalid_email");
  });
});

describe("hashClientIp", () => {
  it("hashea el PRIMER hop de x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(hashClientIp(headers)).toBe(
      createHash("sha256").update("1.2.3.4").digest("hex"),
    );
  });

  it("cae a x-real-ip y devuelve null cuando no hay ninguno", () => {
    expect(hashClientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe(
      createHash("sha256").update("5.6.7.8").digest("hex"),
    );
    expect(hashClientIp(new Headers())).toBeNull();
  });

  // La IP NUNCA queda en claro: la tabla guarda el hash y es lo único que se compara.
  it("no devuelve la IP en claro", () => {
    expect(hashClientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).not.toContain(
      "5.6.7.8",
    );
  });
});

describe("los cupos del start", () => {
  // Son decisión de esta spec, no del owner, y están declarados en el contrato §5. Si
  // alguien los mueve, el contrato queda mintiendo: por eso están pinneados acá.
  it("son los tres del contrato", () => {
    expect(START_RATE_LIMITS).toEqual({
      ipPerHour: 20,
      emailPerHour: 5,
      emailPerDay: 10,
    });
  });
});

describe("isUndeliverableEmail", () => {
  // LA RAZÓN DE QUE ESTA FUNCIÓN EXISTA, en una aserción: el email sintético del staff
  // **pasa** `normalizeEmail`, porque `staff` `.` `invalid` es forma válida. Sin este corte
  // aparte, `verify-email` con sesión de integrante emitía un token real y gastaba cupo.
  it("el email sintético del staff PASA la forma, y aun así es no entregable", () => {
    const sintetico = `staff-abc123@${UNDELIVERABLE_EMAIL_DOMAIN}`;
    expect(normalizeEmail(sintetico)).toBe(sintetico);
    expect(isUndeliverableEmail(sintetico)).toBe(true);
  });

  it("no cambió la forma que acuña `staff-create.ts`", () => {
    // La constante reemplazó a un literal; si alguien la mueve, las filas de staff que ya
    // existen dejarían de ser reconocidas como no entregables.
    expect(UNDELIVERABLE_EMAIL_DOMAIN).toBe("staff.invalid");
    expect(`staff-abc-123@${UNDELIVERABLE_EMAIL_DOMAIN}`).toBe(
      "staff-abc-123@staff.invalid",
    );
  });

  it("discrimina: un owner real y un dominio que sólo se le parece no son no entregables", () => {
    expect(isUndeliverableEmail("ana@lafarmacia.com")).toBe(false);
    // El `.invalid` tiene que ser el FINAL del dominio, no un pedazo del medio.
    expect(isUndeliverableEmail("ana@nostaff.invalid.com")).toBe(false);
    expect(isUndeliverableEmail("ana@otro.invalid")).toBe(false);
  });

  it("no se evade con mayúsculas", () => {
    expect(isUndeliverableEmail("STAFF-X@STAFF.INVALID")).toBe(true);
  });
});
