import Stripe from "stripe";

export type StripeEnvironment = "test" | "live";

type StripeConfiguration = {
  environment: StripeEnvironment;
  secretKey: string;
  webhookSecret?: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
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
    monthlyPriceId: readRequired(`STRIPE_PRICE_PLUS_MONTHLY_${suffix}`),
    yearlyPriceId: readRequired(`STRIPE_PRICE_PLUS_YEARLY_${suffix}`),
  };
}

export function getStripeClient(configuration = getStripeConfiguration()) {
  return new Stripe(configuration.secretKey);
}
