// Barrel for the merchant database schema. Split by domain to stay within the
// file-size budget; every `from "./schema"` import resolves here unchanged.
export * from "./schema/_schemas";
export * from "./schema/auth";
export * from "./schema/business";
export * from "./schema/loyalty";
export * from "./schema/loyalty-reward";
export * from "./schema/consumer";
export * from "./schema/otp";
export * from "./schema/web-push";
export * from "./schema/catalog";
export * from "./schema/order";
