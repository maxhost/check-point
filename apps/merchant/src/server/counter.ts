// Barrel for the counter (mostrador) domain — spec 0030. Split by concern to stay
// within the file-size budget; every `from "../counter"` import resolves here.
export {
  CounterError,
  operatorBusiness,
} from "@mi-pasaporte/domain/server/counter/core";
export type {
  CounterOperator,
  OperatorBusiness,
} from "@mi-pasaporte/domain/server/counter/core";
export { resolveScan } from "./counter/resolve";
export type { ResolveResult } from "./counter/resolve";
export { grantAccrual } from "./counter/grant";
export type { GrantResult } from "./counter/grant";
export { redeemReward } from "./counter/redeem";
export type { RedeemResult } from "./counter/redeem";
export { validateCoupon } from "./counter/coupon-validate";
export type { CouponValidateResult } from "./counter/coupon-validate";
export { removeCoupon } from "./counter/coupon-remove";
export type { CouponRemoveResult } from "./counter/coupon-remove";
export { getCouponState } from "./counter/coupon-state";
export type { CounterCoupon, CounterCouponState } from "./counter/coupon-state";
export { listTodaysAccreditations } from "./counter/history";
export type { AccreditationDTO } from "./counter/history";
