import type { PosCouponRefV2 } from "../contracts";
import { inputObject, inputUuid, invalidPosInput } from "./measured-line-input";
import { parsePayments } from "./settlement";

/** Syntax only: references are authorized after the locked closed-order replay. */
export function parseMeasuredCloseInput(raw: unknown) {
  const value = inputObject(raw, [
    "clientRequestId",
    "version",
    "membershipId",
    "coupon",
    "payments",
  ]);
  if (
    typeof value.version !== "number" ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    value.version > 2147483647
  )
    invalidPosInput();
  const membershipId =
    value.membershipId === undefined
      ? null
      : inputUuid(value.membershipId, "membershipId");
  let coupon: PosCouponRefV2 | null = null;
  if (value.coupon !== undefined && value.coupon !== null) {
    const ref = inputObject(value.coupon, [
      "couponId",
      "productId",
      "targetSourceLineId",
    ]);
    coupon = {
      couponId: inputUuid(ref.couponId, "couponId"),
      ...(ref.productId !== undefined
        ? {
            productId:
              ref.productId === null
                ? null
                : inputUuid(ref.productId, "productId"),
          }
        : {}),
      ...(ref.targetSourceLineId !== undefined
        ? {
            targetSourceLineId: inputUuid(
              ref.targetSourceLineId,
              "targetSourceLineId",
            ),
          }
        : {}),
    };
    if (!membershipId) invalidPosInput();
  }
  if (value.payments !== undefined) {
    if (!Array.isArray(value.payments)) invalidPosInput();
    for (const payment of value.payments) {
      const entry = inputObject(payment, ["methodId", "amount"]);
      inputUuid(entry.methodId, "methodId");
    }
  }
  return {
    clientRequestId: inputUuid(value.clientRequestId, "clientRequestId"),
    version: value.version,
    membershipId,
    coupon,
    payments: parsePayments(value.payments),
  };
}
