export type Kind = "points" | "stamps";
export type Template = { id: string; title: string; templateMarkdown: string };
export type ProgramAccrual = {
  mode: "per_amount" | "per_purchase";
  grant: number;
  blockAmount: number | null;
};
export type ProgramReward = {
  type: "catalog_product" | "custom" | "discount";
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  imagePath: string | null;
};
export type Program = {
  id: string;
  kind: Kind;
  configuration: Record<string, unknown>;
  status: "active" | "closing" | "inactive";
  activatedAt: string;
  earningEndsAt: string | null;
  redemptionEndsAt: string | null;
  termsMarkdown: string;
  stampImagePath: string | null;
  cardBackgroundColor: string | null;
  cardBackgroundColor2: string | null;
  cardBackgroundGradientAngle: number | null;
  cardBorderColor: string | null;
  accrual: ProgramAccrual | null;
  rewards: ProgramReward[];
};
export type Business = {
  name: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
};
export type Context = {
  business: Business;
  program: Program | null;
};
