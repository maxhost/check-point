import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QA_ACCOUNTS,
  publicQaAccounts,
  qaLoginEnabled,
  resolveQaAccount,
} from "./qa-login";

/** Spec 0150 — la decision pura del login de QA (temporal). */
describe("qaLoginEnabled (spec 0150)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin la variable → apagada", () => {
    vi.stubEnv("QA_LOGIN_ENABLED", undefined);
    expect(qaLoginEnabled()).toBe(false);
  });

  it.each(["1", "TRUE", "true ", "yes", " true"])("%j → apagada", (value) => {
    vi.stubEnv("QA_LOGIN_ENABLED", value);
    expect(qaLoginEnabled()).toBe(false);
  });

  it('"true" exacto → prendida, y se lee en cada llamada', () => {
    vi.stubEnv("QA_LOGIN_ENABLED", "true");
    expect(qaLoginEnabled()).toBe(true);
    vi.stubEnv("QA_LOGIN_ENABLED", "false");
    expect(qaLoginEnabled()).toBe(false);
  });
});

describe("la tabla fija de cuentas (spec 0150)", () => {
  it("son exactamente las 3 de la spec, en su orden y con sus ids", () => {
    expect(QA_ACCOUNTS).toEqual([
      {
        account: "panaderia",
        label: "Panaderia",
        businessId: "f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0",
        userId: "13b520cd-54a7-4acc-9072-06162a7a1993",
      },
      {
        account: "barberia",
        label: "Barberia",
        businessId: "c512bbd2-b203-43f6-8fe5-24778387a331",
        userId: "2857ac6d-2df0-4b25-9e45-77ecadea3a32",
      },
      {
        account: "gym",
        label: "Gym",
        businessId: "02e37e89-66a4-4d1e-9f92-d83e6f4856af",
        userId: "481c2661-a756-48e9-bb15-3b182cb16e49",
      },
    ]);
  });

  it("lo publico lleva solo `account` y `label`", () => {
    for (const entry of publicQaAccounts()) {
      expect(Object.keys(entry).sort()).toEqual(["account", "label"]);
    }
  });

  it("resolveQaAccount: solo un `account` de la tabla resuelve", () => {
    expect(resolveQaAccount("gym")?.userId).toBe(
      "481c2661-a756-48e9-bb15-3b182cb16e49",
    );
    for (const bad of [
      "admin",
      "",
      "GYM",
      "13b520cd-54a7-4acc-9072-06162a7a1993",
      undefined,
      null,
      42,
      { account: "gym" },
    ]) {
      expect(resolveQaAccount(bad)).toBeNull();
    }
  });

  it("resolveQaAccount usa la tabla que recibe, no la global", () => {
    const own = [
      { account: "x", label: "X", businessId: "b", userId: "u" },
    ] as const;
    expect(resolveQaAccount("x", own)?.userId).toBe("u");
    expect(resolveQaAccount("gym", own)).toBeNull();
  });
});
