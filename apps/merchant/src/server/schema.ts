// Barrel for the merchant database schema. Split by domain to stay within the
// file-size budget; every `from "./schema"` import resolves here unchanged.
export * from "./schema/_schemas";
export * from "./schema/auth";
export * from "./schema/business";
export * from "./schema/loyalty";
