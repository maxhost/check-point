const fallbackSiteUrl = "https://www.checkpass.club";

export const siteUrl = (process.env.PUBLIC_SITE_URL ?? fallbackSiteUrl).replace(
  /\/$/,
  "",
);

// Un subdominio por audiencia (ADR 0106): el alta vive en `business.`, la billetera en `my.`.
const registrationUrl = new URL(
  process.env.MERCHANT_ONBOARDING_URL ??
    "https://business.checkpass.club/es/business/onboarding",
);
registrationUrl.searchParams.set("signup", "1");
export const onboardingUrl = registrationUrl.toString();

export const consumerWalletUrl =
  process.env.CONSUMER_WALLET_URL ?? "https://my.checkpass.club/wallet";
