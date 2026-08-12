import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripeConfiguration } from "./stripe-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStripeConfiguration", () => {
  it("usa exclusivamente el conjunto test", () => {
    vi.stubEnv("STRIPE_ENVIRONMENT", "test");
    vi.stubEnv("STRIPE_SECRET_KEY_TEST", "sk_test_example");
    vi.stubEnv("STRIPE_PRICE_PLUS_MONTHLY_TEST", "price_test_month");
    vi.stubEnv("STRIPE_PRICE_PLUS_YEARLY_TEST", "price_test_year");
    vi.stubEnv("STRIPE_SECRET_KEY_LIVE", "sk_live_example");
    vi.stubEnv("STRIPE_PRICE_PLUS_MONTHLY_LIVE", "price_live_month");
    vi.stubEnv("STRIPE_PRICE_PLUS_YEARLY_LIVE", "price_live_year");

    expect(getStripeConfiguration()).toMatchObject({
      environment: "test",
      secretKey: "sk_test_example",
      monthlyPriceId: "price_test_month",
      yearlyPriceId: "price_test_year",
    });
  });

  it("rechaza una clave que no pertenece al modo seleccionado", () => {
    vi.stubEnv("STRIPE_ENVIRONMENT", "test");
    vi.stubEnv("STRIPE_SECRET_KEY_TEST", "sk_live_example");
    vi.stubEnv("STRIPE_PRICE_PLUS_MONTHLY_TEST", "price_test_month");
    vi.stubEnv("STRIPE_PRICE_PLUS_YEARLY_TEST", "price_test_year");

    expect(getStripeConfiguration).toThrow(
      "La clave Stripe no coincide con STRIPE_ENVIRONMENT.",
    );
  });
});
