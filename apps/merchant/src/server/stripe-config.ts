import Stripe from "stripe";

export type StripeEnvironment = "test" | "live";

/**
 * Spec 0189 §D5 / ADR 0134 §4-§5: los CUATRO precios de Stripe — plan base y superior, mensual
 * y anual. Falta cualquiera → la configuracion falla (las rutas contestan 503
 * `stripe_not_configured`), igual que antes con los dos de Plus.
 */
export type PriceIds = {
  base: { month: string; year: string };
  plus: { month: string; year: string };
};

type StripeConfiguration = {
  environment: StripeEnvironment;
  secretKey: string;
  webhookSecret?: string;
  priceIds: PriceIds;
};

function readEnvironment(): StripeEnvironment {
  const environment = process.env.STRIPE_ENVIRONMENT;
  if (environment === "test" || environment === "live") return environment;
  throw new Error("STRIPE_ENVIRONMENT debe ser test o live.");
}

function readRequired(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurada.`);
  return value;
}

export function getStripeConfiguration(): StripeConfiguration {
  const environment = readEnvironment();
  const suffix = environment === "test" ? "TEST" : "LIVE";
  const secretKey = readRequired(`STRIPE_SECRET_KEY_${suffix}`);
  if ((environment === "test") !== secretKey.startsWith("sk_test_")) {
    throw new Error("La clave Stripe no coincide con STRIPE_ENVIRONMENT.");
  }
  return {
    environment,
    secretKey,
    webhookSecret: process.env[`STRIPE_WEBHOOK_SECRET_${suffix}`],
    priceIds: {
      base: {
        month: readRequired(`STRIPE_PRICE_BASE_MONTHLY_${suffix}`),
        year: readRequired(`STRIPE_PRICE_BASE_YEARLY_${suffix}`),
      },
      plus: {
        month: readRequired(`STRIPE_PRICE_PLUS_MONTHLY_${suffix}`),
        year: readRequired(`STRIPE_PRICE_PLUS_YEARLY_${suffix}`),
      },
    },
  };
}

export function getStripeClient(configuration = getStripeConfiguration()) {
  return new Stripe(configuration.secretKey);
}
