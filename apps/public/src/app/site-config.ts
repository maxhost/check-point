const fallbackSiteUrl = "https://www.checkpass.club";

export const siteUrl = (process.env.PUBLIC_SITE_URL ?? fallbackSiteUrl).replace(
  /\/$/,
  "",
);

export const onboardingUrl =
  process.env.MERCHANT_ONBOARDING_URL ??
  `${fallbackSiteUrl}/es/business/onboarding`;

export const consumerWalletUrl =
  process.env.CONSUMER_WALLET_URL ?? `${fallbackSiteUrl}/wallet`;
