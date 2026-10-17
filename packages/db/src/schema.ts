// Barrel for the merchant database schema. Split by domain to stay within the
// file-size budget; every `from "./schema"` import resolves here unchanged.
export * from "./schema/_schemas";
export * from "./schema/auth";
export * from "./schema/platform-auth";
export * from "./schema/auth-start";
export * from "./schema/business";
export * from "./schema/membership";
export * from "./schema/staff-person";
export * from "./schema/onboarding-tour";
export * from "./schema/billing";
export * from "./schema/staff-pin";
export * from "./schema/loyalty";
export * from "./schema/loyalty-reward";
export * from "./schema/consumer";
export * from "./schema/wallet-push";
export * from "./schema/web-push";
export * from "./schema/catalog";
export * from "./schema/payment-methods";
export * from "./schema/commissions";
export * from "./schema/sale-commission";
export * from "./schema/catalog-import";
// Spec 0224 / ADR 0143: el registro unico de uso de la IA.
export * from "./schema/ai-request";
export * from "./schema/order";
export * from "./schema/reward-redemption";
export * from "./schema/campaign";
export * from "./schema/campaign-turn";
export * from "./schema/campaign-coupon";
export * from "./schema/campaign-push";
export * from "./schema/welcome-device";
export * from "./schema/business-customer";
export * from "./schema/valley";
export * from "./schema/cross-sale";
export * from "./schema/balance-expiry";
export * from "./schema/business-module";
// Spec 0210 / ADR 0138: los esquemas de los modulos. Este barril es la UNICA pieza del core que
// los nombra (drizzle lee un solo archivo); ningun otro archivo de `schema/` importa de `modules/`.
export * from "./schema/modules/stock";
export * from "./schema/modules/recipes";
export * from "./schema/modules/profitability";
// Spec 0220 / ADR 0141 §6: el POS y Mesas.
export * from "./schema/modules/pos";

export * from "./schema/module-event";
