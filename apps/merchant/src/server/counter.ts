// Barrel for the counter (mostrador) domain — spec 0030. Split by concern to stay
// within the file-size budget; every `from "../counter"` import resolves here.
export { CounterError, operatorBusiness } from "./counter/core";
export type { OperatorBusiness } from "./counter/core";
export { resolveScan } from "./counter/resolve";
export type { ResolveResult } from "./counter/resolve";
export { grantAccrual } from "./counter/grant";
export type { GrantResult } from "./counter/grant";
