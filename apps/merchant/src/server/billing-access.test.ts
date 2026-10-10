import { describe, expect, it } from "vitest";

import {
  billingAccess,
  billingAccessFailure,
  trialDaysLeft,
} from "@mi-pasaporte/domain/server/billing-access";
import { ACCESS_CASES, NOW } from "./billing-access-cases";

/**
 * Spec 0189 §Plan de pruebas, T1 — `billingAccess` contra la tabla de casos compartida con la
 * versión SQL (T2). ORÁCULO DE M1: el caso «vence EXACTAMENTE en now» separa `>` de `>=`.
 */
describe("billingAccess — el eje de acceso (T1)", () => {
  it.each(ACCESS_CASES)("$name → $expected", ({ row, expected }) => {
    expect(billingAccess(row, NOW)).toBe(expected);
  });
});

describe("billingAccessFailure — el 402 de los guards", () => {
  it("con acceso no hay fallo", () => {
    expect(billingAccessFailure("trial", null)).toBeNull();
    expect(billingAccessFailure("subscribed", null)).toBeNull();
  });

  it("bloqueado sin suscripción previa: «Tu prueba terminó…»", () => {
    expect(
      billingAccessFailure("blocked", {
        plan: "trial",
        stripeCustomerId: null,
      }),
    ).toEqual({
      status: 402,
      code: "payment_required",
      message: "Tu prueba terminó. Elige un plan para seguir.",
    });
    expect(billingAccessFailure("blocked", null)?.message).toBe(
      "Tu prueba terminó. Elige un plan para seguir.",
    );
    // Un customer sin plan `none` (abrió Checkout en la prueba y no pagó) sigue en prueba.
    expect(
      billingAccessFailure("blocked", {
        plan: "trial",
        stripeCustomerId: "cus_1",
      })?.message,
    ).toBe("Tu prueba terminó. Elige un plan para seguir.");
  });

  it("bloqueado con `none` y customer: «Tu suscripción terminó…»", () => {
    expect(
      billingAccessFailure("blocked", {
        plan: "none",
        stripeCustomerId: "cus_1",
      }),
    ).toEqual({
      status: 402,
      code: "payment_required",
      message: "Tu suscripción terminó. Elige un plan para seguir.",
    });
  });
});

describe("trialDaysLeft — §D10", () => {
  const DAY = 86_400_000;
  it("días enteros redondeados hacia arriba, solo en prueba", () => {
    expect(trialDaysLeft("trial", new Date(NOW.getTime() + 1), NOW)).toBe(1);
    expect(trialDaysLeft("trial", new Date(NOW.getTime() + DAY), NOW)).toBe(1);
    expect(trialDaysLeft("trial", new Date(NOW.getTime() + DAY + 1), NOW)).toBe(
      2,
    );
    expect(
      trialDaysLeft("trial", new Date(NOW.getTime() + 90 * DAY), NOW),
    ).toBe(90);
  });

  it("fuera de la prueba es `null`", () => {
    const end = new Date(NOW.getTime() + DAY);
    expect(trialDaysLeft("subscribed", end, NOW)).toBeNull();
    expect(trialDaysLeft("blocked", end, NOW)).toBeNull();
    expect(trialDaysLeft("trial", null, NOW)).toBeNull();
  });
});
