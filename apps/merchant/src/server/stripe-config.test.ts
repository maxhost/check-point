import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripeConfiguration } from "./stripe-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Spec 0189 §D5: los CUATRO precios por entorno (base y plus, mensual y anual). */
function stubPrices(suffix: "TEST" | "LIVE", tag: string) {
  vi.stubEnv(`STRIPE_PRICE_BASE_MONTHLY_${suffix}`, `price_${tag}_base_month`);
  vi.stubEnv(`STRIPE_PRICE_BASE_YEARLY_${suffix}`, `price_${tag}_base_year`);
  vi.stubEnv(`STRIPE_PRICE_PLUS_MONTHLY_${suffix}`, `price_${tag}_plus_month`);
  vi.stubEnv(`STRIPE_PRICE_PLUS_YEARLY_${suffix}`, `price_${tag}_plus_year`);
}

describe("getStripeConfiguration", () => {
  it("usa exclusivamente el conjunto test, con los cuatro precios", () => {
    vi.stubEnv("STRIPE_ENVIRONMENT", "test");
    vi.stubEnv("STRIPE_SECRET_KEY_TEST", "sk_test_example");
    stubPrices("TEST", "test");
    vi.stubEnv("STRIPE_SECRET_KEY_LIVE", "sk_live_example");
    stubPrices("LIVE", "live");

    expect(getStripeConfiguration()).toMatchObject({
      environment: "test",
      secretKey: "sk_test_example",
      priceIds: {
        base: { month: "price_test_base_month", year: "price_test_base_year" },
        plus: { month: "price_test_plus_month", year: "price_test_plus_year" },
      },
    });
  });

  it("falta cualquiera de los cuatro precios → la configuración falla", () => {
    vi.stubEnv("STRIPE_ENVIRONMENT", "test");
    vi.stubEnv("STRIPE_SECRET_KEY_TEST", "sk_test_example");
    stubPrices("TEST", "test");
    vi.stubEnv("STRIPE_PRICE_BASE_YEARLY_TEST", "");

    expect(getStripeConfiguration).toThrow(
      "STRIPE_PRICE_BASE_YEARLY_TEST no está configurada.",
    );
  });

  it("rechaza una clave que no pertenece al modo seleccionado", () => {
    vi.stubEnv("STRIPE_ENVIRONMENT", "test");
    vi.stubEnv("STRIPE_SECRET_KEY_TEST", "sk_live_example");
    stubPrices("TEST", "test");

    expect(getStripeConfiguration).toThrow(
      "La clave Stripe no coincide con STRIPE_ENVIRONMENT.",
    );
  });
});
