const fallbackSiteUrl = "https://www.checkpass.club";

export const siteUrl = (process.env.PUBLIC_SITE_URL ?? fallbackSiteUrl).replace(
  /\/$/,
  "",
);

// Un subdominio por audiencia (ADR 0106): el alta vive en `business.`, la billetera en `my.`.
export const onboardingUrl =
  process.env.MERCHANT_ONBOARDING_URL ??
  "https://business.checkpass.club/es/business/onboarding";

export const consumerWalletUrl =
  process.env.CONSUMER_WALLET_URL ?? "https://my.checkpass.club/wallet";
